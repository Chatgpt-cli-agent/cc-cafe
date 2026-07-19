"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const IPCExtras_1 = require("../utils/IPCExtras");
const FoldersUtils_1 = require("../utils/FoldersUtils");
const DBPFReader_1 = require("../sims/DBPFReader");
const ArchiveUtil_1 = require("../utils/ArchiveUtil");
const Fingerprint_1 = require("../utils/Fingerprint");
class DownloadController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("downloads", async (event, data) => {
            switch (data.action) {
                case "get-default-download-path":
                    let dp = electron_1.app.getPath("downloads");
                    if (fs.existsSync(dp)) {
                        return dp;
                    }
                    return undefined;
                case "read-download-folder":
                    return await this.readDownloadFolder(data.folderPath);
                case "copy-and-import-file":
                    return await this.copyAndImportFile(data.fileInfo, data.targetPath);
                case "get-dd-entry":
                    return await this.getDDEntryById(data.id);
                case "update-dd-entry-status":
                    return await this.updateDDEntryStatus(data.id, data.status);
                case "get-dd-history":
                    return await this.getDDHistory(data.count, data.offset, data.onlyUsed);
                case "remove-dd-entry":
                    return await this.removeDDEntry(data.id);
                case "remove-dd-by-status":
                    return await this.removeDDByStatus(data.status);
                default:
                    throw new Error("Unknown action: " + data.action);
            }
        });
    }
    //Check for Downloads
    async readDownloadFolder(folderPath) {
        const downloadFolder = folderPath || this.mainApp.settings.s_local_download_folder;
        if (!downloadFolder || !fs.existsSync(downloadFolder))
            throw new Error("Download folder is not set or does not exist: " + downloadFolder);
        let tmpFolder = this.mainApp.folderStructureController.getFolder("local-download-folder");
        if (!tmpFolder || !fs.existsSync(tmpFolder))
            throw new Error("Local download folder is not set or does not exist in folder structure: " + tmpFolder);
        let typesToInclude = [".zip", ".rar", ".ts4script", ".package"];
        let filesPaths = await FoldersUtils_1.FoldersUtils.getAllFilesInFolder(downloadFolder, typesToInclude, 2);
        let filesInfo = FoldersUtils_1.FoldersUtils.extendWithInfo(filesPaths);
        //Filter out files over 2GB as they are unlikely to be Sims 4 mods and would cause performance issues
        filesInfo = filesInfo.filter(f => f.size <= 2 * 1024 * 1024 * 1024);
        let allUKeys = new Set(filesInfo.map(f => f.uKey).filter((key) => !!key));
        //Get all folders in the tmp folder and check if their uKey is in the allUKeys set, if not delete them
        let itemFolders = [];
        fs.readdirSync(tmpFolder, { withFileTypes: true }).forEach((dirent) => {
            if (dirent.isDirectory()) {
                itemFolders.push({
                    filepath: path_1.default.join(tmpFolder, dirent.name),
                    name: dirent.name,
                    uKey: dirent.name
                });
            }
        });
        //Remove all item folders that have a uKey that is not in the download files
        itemFolders.forEach(item => {
            if (!allUKeys.has(item.uKey)) {
                fs.rmSync(item.filepath, { recursive: true, force: true });
            }
        });
        let filesData = [];
        for (const file of filesInfo) {
            try {
                let data = await DownloadController.checkFile(tmpFolder, file);
                filesData.push(data);
            }
            catch (e) {
                //console.error("Error checking file: " + file.filepath, e);
                //Nix alles toll hier, wenn was schief geht einfach ignorieren. Nicht mein Problem :D
            }
        }
        let fingerprints = new Set(filesData.map(f => f.files.map(s => s.fingerprint)).flat());
        let knex = this.mainApp.databaseController.getKnex();
        let installedMods = await knex("files").whereIn("fingerprint", Array.from(fingerprints));
        //Add installed info to filesData
        filesData.forEach(file => {
            file.files.forEach(f => {
                let installed = installedMods.find((im) => im.fingerprint === f.fingerprint);
                if (installed) {
                    f.installedInfo = {
                        path: installed.path,
                        name: installed.name,
                        ino: installed.ino,
                        size: installed.size,
                        fingerprint: installed.fingerprint,
                    };
                }
            });
        });
        return filesData;
    }
    static async checkFile(tmpFolder, file) {
        let dataFile = path_1.default.join(tmpFolder, file.uKey, "data.json");
        if (fs.existsSync(dataFile)) {
            try {
                const rawContent = fs.readFileSync(dataFile, "utf-8");
                const data = JSON.parse(rawContent);
                if (!data.filename || !data.filepath || typeof data.isArchive !== 'boolean' || !Array.isArray(data.files)) {
                    throw new Error(`Invalid data structure in ${dataFile}`);
                }
                const lData = {
                    filename: data.filename,
                    filepath: data.filepath,
                    isArchive: data.isArchive,
                    uKey: file.uKey,
                    files: data.files
                };
                //Check if all thumbnail files exist
                lData.files.forEach(f => {
                    if (f.thumbnail && !fs.existsSync(f.thumbnail)) {
                        throw new Error(`Thumbnail file does not exist: ${f.thumbnail}`);
                    }
                });
                return lData;
            }
            catch (e) {
                fs.rmSync(path_1.default.join(tmpFolder, file.uKey), { recursive: true, force: true });
            }
        }
        //Read file
        let ext = path_1.default.extname(file.filepath).toLowerCase();
        let lData = undefined;
        let itemFolder = path_1.default.join(tmpFolder, file.uKey);
        if (!fs.existsSync(itemFolder)) {
            fs.mkdirSync(itemFolder);
        }
        switch (ext) {
            case ".ts4script":
                let cfId = Fingerprint_1.Fingerprint.computeFile(file.filepath);
                lData = {
                    filename: file.name,
                    filepath: file.filepath,
                    isArchive: false,
                    uKey: file.uKey,
                    files: [
                        this.handleScriptFile(tmpFolder, file.filepath, { ino: file.ino, size: file.size, fingerprint: cfId })
                    ]
                };
                break;
            case ".package":
                let single = await this.readPackageFile(itemFolder, file.filepath, { ino: file.ino, size: file.size, fingerprint: undefined });
                lData = {
                    filename: file.name,
                    filepath: file.filepath,
                    isArchive: false,
                    uKey: file.uKey,
                    files: [single]
                };
                break;
            case ".zip":
            case ".rar":
                let archiveFiles = await this.readArchiveFile(itemFolder, file);
                if (archiveFiles.length == 0)
                    throw new Error("Archive does not contain any Sims 4 relevant files: " + file.filepath);
                lData = {
                    filename: file.name,
                    filepath: file.filepath,
                    isArchive: true,
                    uKey: file.uKey,
                    files: archiveFiles
                };
                break;
            default:
                throw new Error("Unsupported file type: " + ext);
        }
        //Save data to tmp folder
        if (lData) {
            fs.writeFileSync(dataFile, JSON.stringify(lData));
            return lData;
        }
        else {
            throw new Error("Unsupported file type: " + ext);
        }
    }
    static handleScriptFile(tmpFolder, filePath, extra) {
        let size = extra ? extra.size : undefined;
        let ino = extra ? extra.ino : undefined;
        let fingerprint = extra ? extra.fingerprint : undefined;
        if (!size || !ino) {
            const stat = fs.statSync(filePath);
            size = stat.size;
            ino = stat.ino.toString();
        }
        if (!fingerprint) {
            fingerprint = Fingerprint_1.Fingerprint.computeFile(filePath);
        }
        if (!size || !ino || !fingerprint)
            throw new Error("Failed to get file info for package file: " + filePath);
        return {
            filename: path_1.default.basename(filePath),
            filepath: filePath,
            ino: ino,
            size: size,
            fingerprint: fingerprint
        };
    }
    static async readPackageFile(tmpFolder, filePath, extra) {
        let size = extra ? extra.size : undefined;
        let ino = extra ? extra.ino : undefined;
        let fingerprint = extra ? extra.fingerprint : undefined;
        if (!size || !ino) {
            const stat = fs.statSync(filePath);
            size = stat.size;
            ino = stat.ino.toString();
        }
        if (!fingerprint) {
            fingerprint = Fingerprint_1.Fingerprint.computeFile(filePath);
        }
        if (!size || !ino || !fingerprint)
            throw new Error("Failed to get file info for package file: " + filePath);
        try {
            let pack = new DBPFReader_1.Pack(filePath);
            pack.checkFile();
            pack.calculateIndexList();
            if (pack.error)
                throw new Error("Failed to read package file: " + filePath);
            let thumPath = path_1.default.join(tmpFolder, ino + "-" + size + ".png");
            let exists = await pack.getBiggestToFile(thumPath);
            return {
                filename: path_1.default.basename(filePath),
                filepath: filePath,
                ino: ino,
                size: size,
                thumbnail: exists ? thumPath : undefined,
                fingerprint: fingerprint
            };
        }
        catch (e) {
            console.error("Error reading package file: " + filePath, e);
            return {
                filename: path_1.default.basename(filePath),
                filepath: filePath,
                ino: ino,
                size: size,
                fingerprint: fingerprint
            };
        }
    }
    static async readArchiveFile(tmpFolder, file) {
        let archiveFiles = await ArchiveUtil_1.ArchiveUtil.getFileListFromArchive(file.filepath);
        let simsFiles = ArchiveUtil_1.ArchiveUtil.filterSimsFiles(archiveFiles);
        let containsSimsFiles = simsFiles.length > 0;
        if (!containsSimsFiles)
            return [];
        //Export files to tmp folder and get their info
        let aFolder = path_1.default.join(tmpFolder, "archive");
        if (fs.existsSync(aFolder)) {
            fs.rmSync(aFolder, { recursive: true, force: true });
        }
        fs.mkdirSync(aFolder);
        let files = [];
        //Extract all sims relevant files to tmp folder
        for (const f of simsFiles) {
            let internalPath = f.internalPath;
            let extractedBuffer = await ArchiveUtil_1.ArchiveUtil.extractFileFromArchive(file.filepath, internalPath);
            //Creat subfolder if needed
            if (internalPath.includes("/")) {
                let subfolder = internalPath.split("/").slice(0, -1).join("/");
                let subfolderPath = path_1.default.join(aFolder, subfolder);
                if (!fs.existsSync(subfolderPath)) {
                    fs.mkdirSync(subfolderPath, { recursive: true });
                }
            }
            //Save file
            let extractedFilePath = path_1.default.join(aFolder, internalPath);
            fs.writeFileSync(extractedFilePath, extractedBuffer);
            files.push({ filepath: extractedFilePath, internalPath: internalPath });
        }
        let sfs = [];
        for (const f of files) {
            const fp = f.filepath;
            const ext = path_1.default.extname(fp).toLowerCase();
            const stat = fs.statSync(fp);
            const fingerprint = Fingerprint_1.Fingerprint.computeFile(fp);
            if (ext === ".ts4script") {
                let single = this.handleScriptFile(tmpFolder, fp, { ino: stat.ino.toString(), size: stat.size, fingerprint: fingerprint });
                single.relativPath = f.internalPath; //Get relative path in archive
                sfs.push(single);
            }
            else if (ext === ".package") {
                let single = await this.readPackageFile(tmpFolder, fp, { ino: stat.ino.toString(), size: stat.size, fingerprint: fingerprint });
                single.relativPath = f.internalPath; //Get relative path in archive
                sfs.push(single);
            }
        }
        //Delete archive folder
        fs.rmSync(aFolder, { recursive: true, force: true });
        return sfs;
    }
    //Copy and import file
    async copyAndImportFile(ldf, targetPath) {
        if (!targetPath || !fs.existsSync(targetPath))
            throw new Error("Target path does not exist: " + targetPath);
        if (!ldf || !ldf.files || ldf.files.length == 0 || !fs.existsSync(ldf.filepath))
            throw new Error("Invalid file info provided for import");
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        if (!tmpFolder || !fs.existsSync(tmpFolder))
            throw new Error("Tmp folder does not exist in folder structure: " + tmpFolder);
        //1. Check if file with name already exists in target path
        for (let file of ldf.files) {
            let targetFilePath = path_1.default.join(targetPath, file.filename);
            if (fs.existsSync(targetFilePath))
                return "file-exists";
        }
        //2. Copy files 
        let filesToImport = [];
        if (ldf.isArchive) {
            for (let file of ldf.files) {
                let exportFilePath = path_1.default.join(tmpFolder, file.ino + "-" + file.size + path_1.default.extname(file.filename));
                let buffer = await ArchiveUtil_1.ArchiveUtil.extractFileFromArchive(ldf.filepath, file.relativPath || file.filename);
                fs.writeFileSync(exportFilePath, buffer);
                filesToImport.push({ filepath: exportFilePath, targetpath: path_1.default.join(targetPath, file.filename), deleteAfter: true });
            }
        }
        else {
            let targetFilePath = path_1.default.join(targetPath, ldf.filename);
            filesToImport.push({ filepath: ldf.filepath, targetpath: targetFilePath, deleteAfter: false });
        }
        for (let file of filesToImport) {
            fs.copyFileSync(file.filepath, file.targetpath);
            if (file.deleteAfter) {
                fs.rmSync(file.filepath, { force: true });
            }
        }
        //3. Add to database
        for (let file of filesToImport) {
            if (!fs.existsSync(file.targetpath)) {
                console.error("File does not exist after copying, skipping import:", file.targetpath);
                continue;
            }
            await this.mainApp.fileImportController.importSingleFile(file.targetpath);
        }
        return "imported";
    }
    //Direct download
    async addDirectDownload(url, name) {
        console.log("[DOWNLOAD-CONTROLLER] Adding direct download: ", url);
        const knex = this.mainApp.databaseController.getKnex();
        // 1. Prüfen, ob die URL bereits existiert (wir holen nur den letzten Status)
        /*const existingEntry = await knex("DirectDownloads")
            .where({ url: url })
            .orderBy("added_date", "desc")
            .first();

        if (existingEntry) {
            // Fall: Läuft bereits oder wartet (0 oder 1)
            if (existingEntry.status === 0 || existingEntry.status === 1) {
                console.log("[DOWNLOAD-CONTROLLER] Download bereits aktiv/ausstehend. Überspringe.");
                return;
            }

            // Fall: Bereits abgeschlossen (2) -> Als Dublette markieren
            if (existingEntry.status === 2) {
                await knex("DirectDownloads").insert({
                    url: url,
                    added_date: Date.now(),
                    status: 5 // Pos. Duplicate
                });
                return;
            }
        }*/
        // Standard-Logik für neue, fehlgeschlagene oder blockierte Downloads
        const defaultStatus = this.mainApp.settings.s_allow_direct_download ? 0 : 4;
        let id = undefined;
        await knex("DirectDownloads").insert({
            url: url,
            name: name || url.split("/").pop() || "",
            added_date: Date.now(),
            status: defaultStatus
        });
        // Get the ID of the inserted entry
        const insertedEntry = await knex("DirectDownloads").where({ url: url }).orderBy("added_date", "desc").first();
        id = insertedEntry ? insertedEntry.id : undefined;
        // UI Benachrichtigung, falls blockiert
        let bw = this.mainApp.mainWindowController.getWindow();
        if (!this.mainApp.settings.s_allow_direct_download && bw) {
            IPCExtras_1.IPCExtras.sendFromMain(bw, 'direct-download-service', {
                action: "blocked-download",
                url: url
            });
        }
        else if (bw && defaultStatus == 0 && id) {
            IPCExtras_1.IPCExtras.sendFromMain(bw, 'curseforge-download-service', {
                action: "add-to-queue",
                items: [{ cf_id: id * -1, cf_file_id: id * -1 }],
                startIfPaused: true
            });
        }
    }
    async getDDEntryById(id) {
        const knex = this.mainApp.databaseController.getKnex();
        const entry = await knex("DirectDownloads").where({ id: id }).first();
        return entry;
    }
    async updateDDEntryStatus(id, status) {
        let absoluteID = Math.abs(id);
        const knex = this.mainApp.databaseController.getKnex();
        await knex("DirectDownloads").where({ id: absoluteID }).update({ status: status });
    }
    async removeDDEntry(id) {
        let absoluteID = Math.abs(id);
        const knex = this.mainApp.databaseController.getKnex();
        await knex("DirectDownloads").where({ id: absoluteID }).delete();
    }
    async removeDDByStatus(status) {
        const knex = this.mainApp.databaseController.getKnex();
        await knex("DirectDownloads").where({ status: status }).delete();
    }
    async getDDHistory(count, offset, onlyUsed = true) {
        const knex = this.mainApp.databaseController.getKnex();
        let query = knex("DirectDownloads")
            .orderBy("added_date", "desc")
            .limit(count)
            .offset(offset);
        if (onlyUsed) {
            query = query.whereNot("status", 0);
        }
        const entries = await query;
        if (entries.length === 0)
            return [];
        const entryIds = entries.map((entry) => entry.id);
        const allFiles = await knex("Files")
            .whereIn("dd_id", entryIds);
        return entries.map((entry) => {
            return {
                ...entry,
                files: allFiles.filter((file) => file.dd_id === entry.id)
            };
        });
    }
}
exports.DownloadController = DownloadController;
