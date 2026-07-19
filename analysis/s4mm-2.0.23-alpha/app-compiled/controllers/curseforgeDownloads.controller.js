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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurseforgeDownloadsController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const fsExtra = __importStar(require("fs-extra"));
const IPCExtras_1 = require("../utils/IPCExtras");
const path = __importStar(require("path"));
const Downloader = require("nodejs-file-downloader");
let appRef = process.platform === "darwin" ? "app://s4mmm-electron-app-mac" : "app://s4mm-electron-app-win";
const FileImport_1 = require("../utils/FileImport");
const ArchiveUtil_1 = require("../utils/ArchiveUtil");
class CurseforgeDownloadsController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("curseforge-downloads", async (event, data) => {
            try {
                switch (data.action) {
                    case "download-file":
                        return await this.downloadFile(data.downloadFile);
                    case "import-file":
                        return await this.importFiles(data.downloadFile, data.projectData, data.filepath, data.downloadItemFolder, data.handleAsComplex);
                    case "clean-up-file":
                        return await this.downloadCleanup(data.filepath, data.cf_id, data.downloadItemFolder);
                    case "complexity-check":
                        return await this.checkComplexity(data.cf_id);
                    case "set-complexity":
                        return await this.setComplexity(data.cf_id, data.complexity);
                    default:
                        throw new Error("Unknown action: " + data.action);
                }
            }
            catch (error) {
                throw error; // Rethrow the error to be caught in the calling function for proper handling
            }
        });
        electron_1.ipcMain.handle("curseforge-updates", async (event, data) => {
            switch (data.action) {
                case "change-update-mode":
                    return await this.changeUpdateMode(data.id, data.isManual);
                case "get-update-mode":
                    return await this.getUpdateMode(data.id);
                case "get-updates":
                    return await this.getUpdates();
                case "get-all-manual-updates":
                    return await this.getAllManualUpdates();
                default:
                    throw new Error("Unknown action: " + data.action);
            }
        });
        console.log("[CF-DOWNLOADS] Initializing IPC listeners for curseforge-downloads");
        electron_1.ipcMain.on("curseforge-downloads", (event, data) => {
            console.log("[CF-DOWNLOADS] Received curseforge-downloads event:", data);
            switch (data.action) {
                case "add-to-download-queue":
                    this.addToDownloadQueue(data.items, data.projectData);
                    break;
                default:
                    console.warn("Unknown action in curseforge-downloads:", data.action);
                    break;
            }
        });
    }
    addToDownloadQueue(items, prokectData) {
        const mainWindow = this.mainApp.mainWindowController.getWindow();
        if (!mainWindow || !items)
            return;
        IPCExtras_1.IPCExtras.sendFromMain(mainWindow, "curseforge-download-service", {
            action: "add-to-queue",
            items: items,
            projectData: prokectData,
            startIfPaused: true
        });
    }
    async downloadFile(downloadfile) {
        let cf_id = downloadfile.modId;
        let file_id = downloadfile.id;
        let downloadUrl = downloadfile.downloadUrl;
        if (!cf_id || !file_id || !downloadUrl) {
            throw new Error("Invalid download file data");
        }
        let downloadFolder = this.mainApp.folderStructureController.getFolder("cf-downloads");
        if (!downloadFolder || !fs.existsSync(downloadFolder))
            throw new Error("Download folder not found in folder structure.");
        //Downloadfile and folder
        const downloadItemFolder = path.join(downloadFolder, "_" + cf_id);
        if (fs.existsSync(downloadFolder)) {
            try {
                fs.rmSync(downloadItemFolder, { recursive: true, force: true });
                console.log("Download item folder cleaned up:", downloadItemFolder);
            }
            catch (error) {
                console.error("Error cleaning up download item folder:", error);
                throw new Error("Could not clean up download item folder: " + downloadItemFolder);
            }
        }
        if (!fs.existsSync(downloadItemFolder)) {
            try {
                fs.mkdirSync(downloadItemFolder, { recursive: true });
                console.log("Download item folder created:", downloadItemFolder);
            }
            catch (error) {
                console.error("Error creating download item folder:", error);
                throw new Error("Could not create download item folder: " + downloadItemFolder);
            }
        }
        //Check download folder and access
        if (!fs.existsSync(downloadFolder)) {
            throw new Error("Download folder does not exist.");
        }
        try {
            fs.accessSync(downloadFolder, fs.constants.W_OK);
        }
        catch {
            throw new Error("Download folder is not writable.");
        }
        const mainWindow = this.mainApp.mainWindowController.getWindow();
        //Download file
        let lastProgress = 0;
        let error = null;
        const downloader = new Downloader({
            url: downloadUrl,
            directory: downloadItemFolder,
            cloneFiles: false,
            headers: {
                'Accept': '*/*',
                'Connection': 'keep-alive',
                "Referer": appRef,
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Sims4ModManager/1.2.13-beta-pre1 Chrome/126.0.6478.234 Electron/31.7.8 Safari/537.36"
            },
            onProgress: (progress, chunk, remainingSize) => {
                if ((progress - lastProgress >= 2 || progress === 100) && mainWindow) { // Update only if progress increased by 5% or it's the last update
                    lastProgress = progress;
                    IPCExtras_1.IPCExtras.sendFromMain(mainWindow, "curseforge-download-service", {
                        action: "update-current-progress",
                        cf_file_id: file_id,
                        cf_id: cf_id,
                        progress: progress,
                    });
                }
            },
            onError: (er) => {
                console.error("Download error:", error);
                error = {
                    message: "Download failed",
                    downloadUrl: downloadUrl,
                    error: er.message || "Unknown error"
                };
            }
        });
        const { filePath, downloadStatus } = await downloader.download();
        return {
            filePath: filePath,
            downloadStatus: downloadStatus,
            downloadItemFolder: downloadItemFolder,
            downloadUrl: downloadUrl,
            error: error,
            cf_id: cf_id,
            file_id: file_id
        };
    }
    async importFiles(downloadFile, projectData, filepath, downloadItemFolder, handleAsComplex) {
        let destination = this.mainApp.settings.s_path_mod;
        if (!downloadFile || !projectData || !filepath || !downloadItemFolder) {
            throw new Error("Invalid parameters for importFiles");
        }
        if (!fs.existsSync(filepath) || !fs.existsSync(downloadItemFolder)) {
            throw new Error("Filepath or download item folder does not exist.");
        }
        if (!destination || !fs.existsSync(destination)) {
            throw new Error("Mod folder does not exist or is not set in settings.");
        }
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        if (projectData.cf_id < 0) {
            //Direct download
            return await this.importDirectDownload(downloadFile, projectData, filepath, downloadItemFolder);
        }
        // Unzip and check content
        let unpackedFolder = path.join(downloadItemFolder, "unpacked");
        // Check if the unpacked folder already exists, if not create it
        if (!fs.existsSync(unpackedFolder)) {
            fs.mkdirSync(unpackedFolder, { recursive: true });
        }
        // Unzip the file
        await FileImport_1.FileImportHelper.extractZipFile(filepath, unpackedFolder);
        let files = FileImport_1.FileImportHelper.getAllFilesFromFolder(unpackedFolder);
        if (files.length == 0)
            throw new Error("No files found in the unpacked folder. Please check the zip file.");
        // Get mod files from database
        let cf_id = projectData.id;
        let extistingFiles = await knex.from("Files").where({ cf_id: cf_id }).select("name", "path", knex.raw("CAST(ino AS TEXT) AS ino"), "cf_id", "cf_file_id", "fingerprint", "categories");
        let commonCategories = [];
        let commonCategoriesMap = new Map();
        if (extistingFiles) {
            // Check for common file categories
            extistingFiles.forEach((file) => {
                if (file.categories && file.categories.length > 0) {
                    try {
                        let catNums = file.categories.split(">").map((value) => {
                            let numValueStr = value.replace("<", "").replace(">", "");
                            let numValue = parseInt(numValueStr, 10);
                            if (!isNaN(numValue))
                                return numValue;
                            return null; // Skip invalid numbers
                        }).filter((num) => num !== null);
                        catNums.forEach((num) => {
                            let count = commonCategoriesMap.get(num) || 0;
                            commonCategoriesMap.set(num, count + 1);
                        });
                    }
                    catch (error) {
                        console.error("Error parsing categories for file:", file.name, error);
                    }
                }
            });
            // Get all shared categories
            commonCategoriesMap.forEach((count, categoryId) => {
                if (count == extistingFiles.length) { // If the category is present in all files
                    commonCategories.push(categoryId);
                }
            });
            // Remove old mod files
            let deletedInos = await this.mainApp.fileController.deleteFiles(extistingFiles.map((file) => file.ino));
            if (!deletedInos || deletedInos.length != extistingFiles.length) {
                throw new Error("Could not delete all old mod files. Deleted: " + deletedInos.length + ", Expected: " + extistingFiles.length);
            }
        }
        // Determin new install location
        let oldPathSet = new Set();
        if (extistingFiles)
            extistingFiles.forEach((file) => { oldPathSet.add(file.path); });
        if (oldPathSet.size == 1) {
            destination = Array.from(oldPathSet)[0]; // If all files have the same path, use that path
        }
        else if (this.mainApp.settings.s_download_modus == 1 && projectData && projectData.authors && projectData.authors.length > 0) {
            //Creator mode
            let primaryAuthor = projectData.authors[0].name;
            if (!primaryAuthor)
                throw new Error("Primary author not found in project data.");
            destination = path.join(destination, primaryAuthor);
            if (!fs.existsSync(destination)) {
                fs.mkdirSync(destination, { recursive: true });
            }
        }
        if (!fs.existsSync(destination)) {
            throw new Error("Destination folder does not exist: " + destination);
        }
        // Move files to new location
        let importedFiles = [];
        if (handleAsComplex) {
            //Complex file handling (Copy content of unpacked folder into mod folder)
            //console.warn("Not implemented yet: Complex file handling");
            importedFiles = await this.copyFolderContents(unpackedFolder, destination);
        }
        else {
            // Simple file handling (Onlymove sims files)
            for (let index = 0; index < files.length; index++) {
                const file = files[index];
                if (!(file.fileext.toLowerCase().includes("package") || file.fileext.toLowerCase().includes("ts4script"))) {
                    continue; // Skip non-package and non-ts4script files
                }
                let oldFilePath = file.filepath;
                let newFilePath = path.join(destination, file.filename);
                if (!fs.existsSync(oldFilePath)) {
                    console.warn("File does not exist, skipping:", oldFilePath);
                    continue;
                }
                if (fs.existsSync(newFilePath)) {
                    console.warn("File already exists, skipping:", newFilePath);
                    continue;
                }
                fs.copyFileSync(oldFilePath, newFilePath);
                fs.unlinkSync(oldFilePath);
                if (fs.existsSync(newFilePath)) {
                    importedFiles.push(newFilePath);
                }
            }
        }
        // Import new files
        let importedFileInfos = [];
        for (let index = 0; index < importedFiles.length; index++) {
            const element = importedFiles[index];
            let newFile = await this.mainApp.fileImportController.importSingleFile(element);
            if (newFile)
                importedFileInfos.push(newFile);
        }
        //Sync curseForge info
        if (importedFileInfos && importedFileInfos.length > 0) {
            await knex.from("Files").whereIn("ino", importedFileInfos.map((file) => file.ino)).update({
                cf_id: cf_id,
                cf_file_id: downloadFile.id,
                cf_checked: Date.now()
            });
        }
        //Extend with common categories
        if (commonCategories && commonCategories.length > 0) {
            for (let index = 0; index < importedFileInfos.length; index++) {
                const file = importedFileInfos[index];
                if (!file.categories || file.categories.length == 0) {
                    file.categories = commonCategories.map((catId) => {
                        return "<" + catId + ">";
                    }).join("");
                }
                else {
                    let existingCategories = file.categories;
                    commonCategories.forEach((catId) => {
                        if (!existingCategories.includes("<" + catId + ">")) {
                            existingCategories += "<" + catId + ">";
                        }
                    });
                    file.categories = existingCategories;
                }
                //Update file categories in database
                await knex.from("Files").where({ ino: file.ino }).update({
                    categories: file.categories
                });
            }
        }
        //If Complex update "CurseForge" table with complexity
        let insertUpdateCurseForgeData = this.mainApp.curseForgeController.handleCurseForgeDataResults([projectData]);
        if (handleAsComplex) {
            insertUpdateCurseForgeData.forEach((data) => {
                data.complexity = 2; // Set complexity to 2 for complex files
            });
        }
        await this.mainApp.curseForgeController.updateFilesCurseForgeData(knex, insertUpdateCurseForgeData);
        //thumbnails
        await this.mainApp.curseForgeController.downloadMissingThumbnails(true);
        return true;
    }
    async importDirectDownload(downloadFile, projectData, filepath, downloadItemFolder) {
        let cf_id = projectData.cf_id;
        let dd_id = Math.abs(cf_id);
        let fileExtension = path.extname(filepath).toLowerCase();
        let supportedExtensions = [".package", ".zip", ".rar"];
        if (!supportedExtensions.includes(fileExtension)) {
            throw new Error("Unsupported file type for direct download: " + fileExtension);
        }
        //Check filesize
        let stats = fs.statSync(filepath);
        let maxSize = 50 * 1024 * 1024; // 50 MB
        if (stats.size > maxSize) {
            throw new Error("File size exceeds the maximum allowed size of 50 MB.");
        }
        let filesToImport = [];
        if (fileExtension == ".zip" || fileExtension == ".rar") {
            // Extract files in tmp folder
            let tempExtractFolder = path.join(downloadItemFolder, "temp_extract");
            if (fs.existsSync(tempExtractFolder)) {
                fs.rmSync(tempExtractFolder, { recursive: true, force: true });
            }
            fs.mkdirSync(tempExtractFolder, { recursive: true });
            let files = (await ArchiveUtil_1.ArchiveUtil.getFileListFromArchive(filepath)).filter((item) => {
                let ext = path.extname(item.name).toLowerCase();
                return ext === ".package";
            });
            if (files.length == 0)
                throw new Error("No .package files found in the archive for direct download.");
            for (const f of files) {
                let extractedFilePath = path.join(tempExtractFolder, f.name);
                let buf = await ArchiveUtil_1.ArchiveUtil.extractFileFromArchive(filepath, f.name);
                fs.writeFileSync(extractedFilePath, buf);
                filesToImport.push(extractedFilePath);
            }
        }
        else {
            filesToImport.push(filepath);
        }
        const modFolder = this.mainApp.settings.s_path_mod;
        if (!modFolder || !fs.existsSync(modFolder))
            throw new Error("Mod folder does not exist or is not set in settings.");
        let knex = this.mainApp.databaseController.getKnex();
        //Try to copy files (if fail increace count)
        for (const filePath of filesToImport) {
            let fileName = path.basename(filePath);
            let destinationPath = path.join(modFolder, fileName);
            try {
                fs.copyFileSync(filePath, destinationPath);
                let file = await this.mainApp.fileImportController.importSingleFile(destinationPath);
                if (file) {
                    await knex.from("Files").where({ ino: file.ino }).update({
                        dd_id: dd_id
                    });
                }
            }
            catch (error) {
                console.error("Error copying file:", error);
            }
        }
        //Update Status in DirectDownloads table
        await knex.from("DirectDownloads").where({ id: dd_id }).update({
            status: 2 // Set status to completed
        });
        return true;
    }
    async downloadCleanup(filepath, cf_id, downloadItemFolder) {
        if (!cf_id) {
            throw new Error("No CF ID provided for clean-up. Check via id");
        }
        if (!downloadItemFolder) {
            console.warn("No download item folder provided for clean-up. Check via id");
            let downloadFolder = this.mainApp.folderStructureController.getFolder("cf-downloads");
            if (!downloadFolder || !fs.existsSync(downloadFolder))
                throw new Error("Download folder not found in folder structure.");
            //Downloadfile and folder
            downloadItemFolder = path.join(downloadFolder, "_" + cf_id);
        }
        if (!fs.existsSync(downloadItemFolder))
            return true;
        //Check if the foldername of the folderpath starts with "_"
        let folderName = path.basename(downloadItemFolder);
        if (!folderName.startsWith("_")) {
            throw new Error("Download item folder does not start with '_': " + downloadItemFolder);
        }
        console.log("Cleaning up download item folder:", downloadItemFolder);
        // Clean up the download item folder and delete it
        try {
            fs.rmSync(downloadItemFolder, { recursive: true, force: true });
            console.log("Download item folder cleaned up:", downloadItemFolder);
            return true;
        }
        catch (error) {
            console.error("Error cleaning up download item folder:", error);
            return false;
        }
    }
    async copyFolderContents(sourcePath, destinationPath) {
        const movedFiles = [];
        try {
            // Ensure the destination folder exists. If not, create it.
            await fsExtra.ensureDir(destinationPath);
            const filesAndFolders = await fsExtra.readdir(sourcePath);
            for (const item of filesAndFolders) {
                const sourceItemPath = `${sourcePath}/${item}`;
                const destinationItemPath = `${destinationPath}/${item}`;
                const stats = await fsExtra.stat(sourceItemPath);
                if (stats.isDirectory()) {
                    // If it's a directory, recursively call the function to copy its contents
                    const filesInSubfolder = await this.copyFolderContents(sourceItemPath, destinationItemPath);
                    movedFiles.push(...filesInSubfolder);
                }
                else {
                    // If it's a file, copy it to the destination
                    await fsExtra.copy(sourceItemPath, destinationItemPath, { overwrite: true });
                    movedFiles.push(destinationItemPath);
                }
            }
        }
        catch (error) {
            console.error(`Error copying folder contents from ${sourcePath} to ${destinationPath}:`, error);
            // You might want to handle the error more gracefully depending on your app's needs
            // e.g., throw a custom error or return an empty array.
            throw error;
        }
        return movedFiles;
    }
    async checkComplexity(cf_id) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        let fileInfo = await knex("CurseForge").where({ id: cf_id }).first();
        if (!fileInfo)
            return 0;
        return fileInfo.complexity;
    }
    async setComplexity(cf_id, complexity) {
        if (!cf_id || typeof complexity !== "number") {
            throw new Error("Invalid parameters for setComplexity");
        }
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        // Update complexity in CurseForge table
        await knex("CurseForge").where({ id: cf_id }).update({ complexity: complexity });
    }
    /*private async processQueue(): Promise<void> {
        if (this.isDownloading || this.isPaused || this.queue.length === 0) {
            return;
        }

        console.log("Processing queue, current queue length:", this.queue.length);

        this.isDownloading = true;
        const currentItem = this.queue[0];
        this.currentDownload = {
            cf_id: currentItem.cf_id,
            file_id: currentItem.file_id,
            status: "downloading",
            progress: 0 // Initial progress
        };

        let currentDownload = this.currentDownload;


        // Update item status to 'downloading'
        currentDownload.status = "preparing"; // Set status to preparing before downloading
        this.sendUpdatedDownloadItem();
        await this.updateQueueItemStatus(currentItem.cf_id, "downloading");
        this.sendQueueUpdated();

        try {
            const {downloadFile, projectData} = await this.getDownloadFileInfoByFileId(currentItem.cf_id, currentItem.file_id);
            if (!downloadFile || !projectData) {
                throw new Error("Could not get download URL.");
            }


            currentDownload.projectData = projectData; // Store the project data
            currentDownload.downloadUrl = downloadFile.downloadUrl; // Store the download URL

            if(currentDownload.downloadUrl === null || currentDownload.downloadUrl === undefined) {
                throw new Error("Download URL is null or undefined for CF ID: " + currentItem.cf_id + ", File ID: " + currentItem.file_id);
            }
            currentDownload.status = "downloading"; // Update status to downloading
            currentDownload.downloadFile = downloadFile; // Store the download file info
            this.sendUpdatedDownloadItem();

            let downloadFolder = this.mainApp.folderStructureController.getFolder("cf-downloads");
            if (!downloadFolder || !fs.existsSync(downloadFolder)) throw new Error("Download folder not found in folder structure.");


            const downloadPath = path.join(downloadFolder, "cf_" + currentItem.cf_id, `${currentItem.cf_id}_${currentItem.file_id}.zip`);

            const downloadItemFolder = path.join(downloadFolder, "_" + currentItem.cf_id);

            if (fs.existsSync(downloadItemFolder)) {
                // Clean content of the folder
                const files = fs.readdirSync(downloadItemFolder);
                files.forEach(file => {
                    const filePath = path.join(downloadItemFolder, file);
                    const stats = fs.lstatSync(filePath);
                    if (stats.isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                });
            } else {
                fs.mkdirSync(downloadItemFolder, { recursive: true });
            }

    

            let lastProgress = 0;
            const downloader = new Downloader({
                url: currentDownload.downloadUrl,
                directory: downloadItemFolder,
                cloneFiles: false,
                headers: {
                    "Referer": appRef,
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Sims4ModManager/1.2.13-beta-pre1 Chrome/126.0.6478.234 Electron/31.7.8 Safari/537.36"
                },
                onProgress: (progress: number, chunk: any, remainingSize: any) => {
                    currentDownload.progress = progress;
                    if (progress - lastProgress >= 2 || progress === 100) { // Update only if progress increased by 5% or it's the last update
                        lastProgress = progress;
                        console.log(`Download progress: ${progress}%`);
                        this.sendUpdatedDownloadItem();
                    }
                },
                onError: (error: any) => {
                    console.error("Download error:", error);
                    currentDownload.status = "failed"; // Update status to failed
                    currentDownload.error = error.message; // Store the error message
                    this.sendUpdatedDownloadItem();
                }
            });
            const { filePath, downloadStatus } = await downloader.download();
            console.log("Download completed:", filePath, downloadStatus);

            if(downloadStatus!="COMPLETE"){
                throw new Error("Download did not complete successfully. Status: " + downloadStatus);
            }

            //Check file integrity
            //console.log(currentDownload.downloadFile.hash)
            //Skip for now ...

            await this.updateQueueItemStatus(currentItem.cf_id, "downloaded");

            currentDownload.status = "importing"; // Update status to completed
            currentDownload.downloadPath = downloadPath; // Store the download path
            this.sendUpdatedDownloadItem();

            await this.importFiles([{
                cf_id: currentItem.cf_id,
                file_id: currentItem.file_id,
                status: "completed",
                downloadPath: downloadPath
            }]);

            currentDownload.status = "completed"; // Update status to completed
            this.sendUpdatedDownloadItem();

        } catch (error: any) {
            console.error("Download failed:", error);
            await this.updateQueueItemStatus(currentItem.cf_id, "failed", error.message);
        } finally {
            this.isDownloading = false;
            this.currentDownload = null; // Reset current download item
            setTimeout(()=>{
                this.sendUpdatedDownloadItem();
            },200);
            await this.initializeQueue();
            this.sendQueueUpdated();
            this.processQueue();
        }
    }*/
    //Updates
    async changeUpdateMode(id, isManual) {
        if (!id || typeof isManual !== "boolean") {
            throw new Error("Invalid parameters for changeUpdateMode");
        }
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        await knex("CurseForge").where({ id: id }).update({ manual: isManual ? 1 : 0 });
    }
    async getUpdateMode(id) {
        if (!id) {
            throw new Error("Invalid parameters for getUpdateMode");
        }
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        let result = await knex("CurseForge").where({ id: id }).first();
        return result ? result.manual === 1 : false;
    }
    async getUpdates() {
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        let files = await knex.from("Files").whereNotNull("cf_id").whereNot("cf_id", 0).select(["cf_id", "cf_file_id", "fingerprint"]);
        let curseForge = await knex.from("CurseForge").select("*").where("isSupported", 1);
        // CurseForge
        // id = cf_id
        // mainFileId
        // latestFingerprints (list of fingerprints joined by "," as string)
        let installedFingerprints = new Set();
        let installedMap = new Map();
        files.forEach((file) => {
            let set = installedMap.get(file.cf_id);
            if (!set)
                set = new Set();
            set.add(file.cf_file_id);
            installedMap.set(file.cf_id, set);
            if (file.fingerprint) {
                installedFingerprints.add(file.fingerprint);
            }
        });
        let autoUpdates = [];
        let manualUpdates = [];
        for (let i = 0; i < curseForge.length; i++) {
            const item = curseForge[i];
            if (!item || !item.id || !item.mainFileId)
                continue;
            let installedFiles = installedMap.get(item.id);
            if (!installedFiles) {
                continue; // Skip if no installed files found
            }
            if (installedFiles.has(item.mainFileId))
                continue; // Skip if main file is already installed
            // Check if the main file is in the installed fingerprints
            let latestFingerprints = item.latestFingerprints ? item.latestFingerprints.split(",").map((fp) => parseInt(fp, 10)).filter((fp) => !isNaN(fp)) : [];
            let allInstalled = true;
            latestFingerprints.forEach((fp) => {
                if (!installedFingerprints.has(fp)) {
                    allInstalled = false; // If any fingerprint is not installed, we need to update
                }
            });
            if (allInstalled) {
                //Update the Files with the fingerprint and cf_id to the current file id
                await knex.from("Files").where({ cf_id: item.id }).whereIn("fingerprint", latestFingerprints).update({
                    cf_checked: Date.now(),
                    cf_file_id: item.mainFileId
                });
                continue; // Skip if all latest fingerprints are installed
            }
            if (item.manual === 1) {
                manualUpdates.push(item);
            }
            else {
                autoUpdates.push(item);
            }
        }
        return {
            autoUpdates: autoUpdates,
            manualUpdates: manualUpdates
        };
    }
    async getAllManualUpdates() {
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        let items = await knex.from("CurseForge").where({ manual: 1 }).select("*");
        return items;
    }
}
exports.CurseforgeDownloadsController = CurseforgeDownloadsController;
