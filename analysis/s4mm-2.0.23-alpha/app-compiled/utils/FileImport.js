"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileImportHelper = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const DBPFReader_1 = require("../sims/DBPFReader");
const Helper_1 = require("./Helper");
const categories_controller_1 = require("../controllers/categories.controller");
const Fingerprint_1 = require("./Fingerprint");
class FileImportHelper {
    static async importFileWithPath(filepath, sharedData) {
        let fileData = {
            name: path_1.default.basename(filepath),
            folder_base: path_1.default.dirname(filepath),
            folder_sp: "",
            last_check: Date.now()
        };
        return await this.importUpdateFileWorker(fileData, sharedData);
    }
    static async importUpdateFileWorker(fileData, sharedData) {
        //File basics
        let fileName = fileData.name;
        let filePath = path_1.default.join(fileData.folder_base, fileData.folder_sp);
        let fileExtRaw = path_1.default.extname(fileName);
        let isDeactivated = fileExtRaw.toLowerCase().endsWith("off");
        let isPackageFile = fileExtRaw.toLowerCase().endsWith("package") || fileExtRaw.toLowerCase().endsWith("packageoff");
        let isScriptFile = fileExtRaw.toLowerCase().endsWith("ts4script") || fileExtRaw.toLowerCase().endsWith("ts4scriptoff");
        let mfolder = Helper_1.Helper.calcMFolderWithPath(filePath, sharedData.modFolderPath);
        //Get BigInt stats
        let file = path_1.default.join(filePath, fileName);
        let stats = fs_1.default.statSync(file, { bigint: true });
        let ino = stats.ino;
        let fileDataObject = {
            name: fileName,
            ext: fileExtRaw,
            filePath: filePath,
            mfolder: mfolder ? mfolder : "",
            isDeactivated: isDeactivated,
            isPackageFile: isPackageFile,
            isScriptFile: isScriptFile,
            stats: stats,
            last_check: fileData.last_check
        };
        //Check if file is already in database
        let databaseEntry = undefined;
        if (!sharedData || sharedData.skipInoCheck == undefined || sharedData.skipInoCheck == false) {
            try {
                let result = await ipcRenderer.invoke("files-loading", { action: "ino-db-lookup", ino: ino.toString(), last_check: fileData.last_check, options: { select: ["path", "name", "mfolder", "mtime", "size"] } });
                if (result && result.length > 0) {
                    databaseEntry = result[0];
                }
            }
            catch (error) {
                console.error("FileImportHelper.importUpdateFileWorker", error);
            }
        }
        //Handel file appropiate
        let idb = undefined;
        if (databaseEntry) {
            //File already in database
            idb = await FileImportHelper.importUpdateFile(fileDataObject, sharedData, databaseEntry);
        }
        else if (isPackageFile) {
            //Import new Package File
            idb = await FileImportHelper.importNewPackageFile(fileDataObject, sharedData);
        }
        else if (isScriptFile) {
            //Import new Script File
            idb = await FileImportHelper.importNewScriptFile(fileDataObject, sharedData);
        }
        else {
            //Import new Other File
            idb = await FileImportHelper.importNewOtherFile(fileDataObject, sharedData);
        }
        if (idb) {
            return {
                idb: idb,
                suc: true,
                imported: false
            };
        }
        throw new Error("Unknown file type");
    }
    static async importUpdateFile(fileDataObject, sharedData, databaseEntry) {
        //console.log("importUpdateFile",fileDataObject);
        //console.log("Database Entry",databaseEntry);
        let file = path_1.default.join(fileDataObject.filePath, fileDataObject.name);
        let statsNormal = fs_1.default.statSync(file);
        //File info
        let fileDatabaseObject = {
            ino: fileDataObject.stats.ino.toString(),
            path: fileDataObject.filePath,
            name: fileDataObject.name,
            mfolder: fileDataObject.mfolder,
            mtime: Math.floor(statsNormal.mtimeMs / 1000),
            size: statsNormal.size,
            last_check: fileDataObject.last_check
        };
        //Check if some values changed
        let changed = false;
        if (databaseEntry) {
            if (databaseEntry.path != fileDatabaseObject.path) {
                fileDatabaseObject.path = fileDatabaseObject.path;
                console.log("File path changed:", databaseEntry.path, "->", fileDatabaseObject.path);
                changed = true;
            }
            if (databaseEntry.name != fileDatabaseObject.name) {
                fileDatabaseObject.name = fileDatabaseObject.name;
                console.log("File name changed:", databaseEntry.name, "->", fileDatabaseObject.name);
                changed = true;
            }
            if (databaseEntry.mfolder != fileDatabaseObject.mfolder) {
                fileDatabaseObject.mfolder = fileDatabaseObject.mfolder;
                console.log("File mfolder changed:", databaseEntry.mfolder, "->", fileDatabaseObject.mfolder);
                changed = true;
            }
            if (databaseEntry.mtime != fileDatabaseObject.mtime) {
                fileDatabaseObject.mtime = fileDatabaseObject.mtime;
                console.log("File mtime changed:", databaseEntry.mtime, "->", fileDatabaseObject.mtime);
                changed = true;
            }
            if (databaseEntry.size != fileDatabaseObject.size) {
                fileDatabaseObject.size = fileDatabaseObject.size;
                console.log("File size changed:", databaseEntry.size, "->", fileDatabaseObject.size);
                changed = true;
            }
        }
        let idb = {
            ressoucen_insert: [],
            ressoucen_update: [],
            files: [],
            casparts_insert: [],
            cobj_com_insert_update: []
        };
        if (changed)
            idb.files.push(fileDatabaseObject);
        return idb;
    }
    static async importNewPackageFile(fileDataObject, sharedData) {
        //console.log("importNewPackageFile",fileDataObject);
        let internalError = false;
        let imageFolder = sharedData.modImageFolder;
        let file = path_1.default.join(fileDataObject.filePath, fileDataObject.name);
        //Small stats
        let statsNormal = fs_1.default.statSync(file);
        //Calculate file fingerprint
        let fingerprint = -1;
        try {
            if (statsNormal.size < 150000000) {
                fingerprint = Fingerprint_1.Fingerprint.computeFile(file);
            }
        }
        catch (error) {
            console.log(error);
        }
        //File info
        let fileDatabaseObject = {
            ino: fileDataObject.stats.ino.toString(),
            path: fileDataObject.filePath,
            name: fileDataObject.name,
            mfolder: fileDataObject.mfolder,
            type: fileDataObject.isPackageFile ? 1 : (fileDataObject.isScriptFile ? 2 : 0),
            casp: false,
            cobj: false,
            clip: false,
            xml_types: "",
            image: "",
            image_source: 0,
            merged: false,
            recolor: false,
            cf_checked: false,
            cf_id: null,
            cf_file_id: null,
            fingerprint: fingerprint,
            mtime: Math.floor(statsNormal.mtimeMs / 1000),
            size: statsNormal.size,
            last_check: fileDataObject.last_check,
            categories: fileDataObject.categories || "",
            minor: -1,
            major: -1
        };
        if (sharedData && sharedData.categories) {
            fileDatabaseObject.categories = categories_controller_1.CategoriesControllerWorkerUtils.modifyFilesCategories(fileDataObject.name, "", sharedData.categories);
        }
        if (sharedData && sharedData.fingerprintCategoriesMap && fileDatabaseObject.fingerprint) {
            fileDatabaseObject.categories = categories_controller_1.CategoriesControllerWorkerUtils.extendWithMigratedCategories(sharedData, fileDatabaseObject.categories, fileDatabaseObject.fingerprint);
        }
        if (sharedData && sharedData.options && sharedData.options.thumbnailOverride) {
            fileDatabaseObject.image = sharedData.options.thumbnailOverride.image;
            fileDatabaseObject.image_source = sharedData.options.thumbnailOverride.source;
        }
        let idb = {
            ressoucen_insert: [],
            ressoucen_update: [],
            files: [],
            casparts_insert: [],
            cobj_com_insert_update: []
        };
        let casparts = [];
        let cascombined = [];
        //Data from package file
        try {
            let pack = new DBPFReader_1.Pack(file);
            pack.checkFile();
            fileDatabaseObject.minor = pack.minor;
            fileDatabaseObject.major = pack.major;
            if (pack.error)
                throw new Error("Internal package file error");
            let iip = new DBPFReader_1.ImportInfoPack(pack);
            iip.analyze();
            //Thumbnail
            if (!fileDatabaseObject.image) {
                let thumbnail = await iip.exportBiggestThumbnail(imageFolder, fileDataObject.stats.ino);
                if (thumbnail) {
                    fileDatabaseObject.image = thumbnail;
                    fileDatabaseObject.image_source = 1;
                }
            }
            //Ressoucen
            idb.ressoucen_insert = iip.resourcenList.map((item) => {
                item.ino = fileDataObject.stats.ino.toString();
                return item;
            });
            //Casparts
            casparts = iip.caspFiles.map((caspFile) => {
                let item = caspFile.getDatabaseValues();
                item.ino = fileDataObject.stats.ino.toString();
                return item;
            });
            //Combined Casparts
            cascombined = iip.getCombindedCaspData().map((caspCombined) => {
                caspCombined.ino = fileDataObject.stats.ino.toString();
                return caspCombined;
            });
            //Cobj
            if (iip.includesCobj) {
                pack.calulateCOBJFiles();
                let cobjRes = pack.cobjResource;
                if (cobjRes) {
                    //console.log(cobjRes);
                    let bb = Helper_1.Helper.numberSetToHexString(cobjRes.buyCat);
                    let bu = Helper_1.Helper.numberSetToHexString(cobjRes.buildSet);
                    let pat = Helper_1.Helper.numberSetToHexString(cobjRes.patternSet);
                    let ot = Helper_1.Helper.numberSetToHexString(cobjRes.otherSet);
                    let obj_cobj = {
                        "ino": fileDatabaseObject.ino,
                        "pmin": cobjRes.pMin,
                        "pmax": cobjRes.pMax,
                        "bb": bb.length > 0 ? bb : null,
                        "bu": bu.length > 0 ? bu : null,
                        "pat": pat.length > 0 ? pat : null,
                        "ot": ot.length > 0 ? ot : null,
                    };
                    idb.cobj_com_insert_update.push(obj_cobj);
                }
            }
            //XML
            if (iip.includesXml) {
                pack.calculateXMLFiles();
                if (pack.xmlResource) {
                    fileDatabaseObject.xml_types = pack.xmlResource.cTypesCombinedString ? pack.xmlResource.cTypesCombinedString : "";
                }
            }
            //Thumbnail from PosePack
            if (!fileDatabaseObject.image && pack.xmlResource && pack.xmlResource.primaryThumbnailInstances.length > 0) {
                console.log(file);
                console.log(pack.xmlResource);
                let primaryThumbnailInstances = pack.xmlResource.primaryThumbnailInstances[0];
                let thumEntry = pack.getEntryIfExists(0x00B2D882, undefined, primaryThumbnailInstances);
                if (thumEntry) {
                    //Export DDS Image
                    let thumbnail = await iip.export_IMG(imageFolder, fileDataObject.stats.ino, thumEntry);
                    if (thumbnail) {
                        fileDatabaseObject.image = thumbnail;
                        fileDatabaseObject.image_source = 1;
                    }
                }
            }
            //Basics
            fileDatabaseObject.casp = iip.includesCasp;
            fileDatabaseObject.cobj = iip.includesCobj;
            fileDatabaseObject.clip = iip.includesClip;
            fileDatabaseObject.smod = iip.includesSmod;
            fileDatabaseObject.merged = iip.isMerged;
            fileDatabaseObject.recolor = iip.isRecolor;
        }
        catch (error) {
            console.error("FileImportHelper.importNewPackageFile", error, file);
            internalError = true;
        }
        idb.files.push(fileDatabaseObject);
        if (casparts.length > 0) {
            idb.casparts_insert = casparts;
        }
        if (cascombined.length > 0) {
            idb.cascombined_insert = cascombined;
        }
        return idb;
    }
    static async importNewScriptFile(fileDataObject, sharedData) {
        //console.log("importNewScriptFile",fileDataObject);
        let file = path_1.default.join(fileDataObject.filePath, fileDataObject.name);
        //Small stats
        let statsNormal = fs_1.default.statSync(file);
        //Calculate file fingerprint
        let fingerprint = -1;
        try {
            if (statsNormal.size < 150000000) {
                fingerprint = Fingerprint_1.Fingerprint.computeFile(file);
            }
        }
        catch (error) {
            console.log(error);
        }
        //File info
        let fileDatabaseObject = {
            ino: fileDataObject.stats.ino.toString(),
            path: fileDataObject.filePath,
            name: fileDataObject.name,
            mfolder: fileDataObject.mfolder,
            type: fileDataObject.isPackageFile ? 1 : (fileDataObject.isScriptFile ? 2 : 0),
            casp: false,
            cobj: false,
            clip: false,
            image: "",
            image_source: 0,
            merged: false,
            recolor: false,
            cf_checked: false,
            cf_id: null,
            cf_file_id: null,
            fingerprint: fingerprint,
            mtime: Math.floor(statsNormal.mtimeMs / 1000),
            size: statsNormal.size,
            last_check: fileDataObject.last_check,
            categories: fileDataObject.categories || ""
        };
        if (sharedData && sharedData.categories) {
            fileDatabaseObject.categories = categories_controller_1.CategoriesControllerWorkerUtils.modifyFilesCategories(fileDataObject.name, "", sharedData.categories);
        }
        else {
            console.warn("No categories found in sharedData, using empty categories for script file import.");
        }
        if (sharedData && sharedData.options && sharedData.options.thumbnailOverride) {
            fileDatabaseObject.image = sharedData.options.thumbnailOverride.image;
            fileDatabaseObject.image_source = sharedData.options.thumbnailOverride.source;
        }
        let idb = {
            ressoucen_insert: [],
            ressoucen_update: [],
            files: [fileDatabaseObject],
            casparts_insert: [],
            cobj_com_insert_update: []
        };
        return idb;
    }
    static async importNewOtherFile(fileDataObject, sharedData) {
        let file = path_1.default.join(fileDataObject.filePath, fileDataObject.name);
        //Small stats
        let statsNormal = fs_1.default.statSync(file);
        //Calculate file fingerprint
        let fingerprint = -1;
        try {
            if (statsNormal.size < 150000000) {
                fingerprint = Fingerprint_1.Fingerprint.computeFile(file);
            }
        }
        catch (error) {
            console.log(error);
        }
        if (fileDataObject.name.toLowerCase() == "resource.cfg") {
            fingerprint = -1;
        }
        //File info
        let fileDatabaseObject = {
            ino: fileDataObject.stats.ino.toString(),
            path: fileDataObject.filePath,
            name: fileDataObject.name,
            mfolder: fileDataObject.mfolder,
            type: 3, // Other file type
            casp: false,
            cobj: false,
            clip: false,
            image: "",
            image_source: 0,
            merged: false,
            recolor: false,
            cf_checked: false,
            cf_id: null,
            cf_file_id: null,
            fingerprint: fingerprint,
            mtime: Math.floor(statsNormal.mtimeMs / 1000),
            size: statsNormal.size,
            last_check: fileDataObject.last_check,
            categories: fileDataObject.categories || ""
        };
        if (sharedData && sharedData.categories) {
            fileDatabaseObject.categories = categories_controller_1.CategoriesControllerWorkerUtils.modifyFilesCategories(fileDataObject.name, "", sharedData.categories);
        }
        else {
            console.warn("No categories found in sharedData, using empty categories for script file import.");
        }
        if (sharedData && sharedData.options && sharedData.options.thumbnailOverride) {
            fileDatabaseObject.image = sharedData.options.thumbnailOverride.image;
            fileDatabaseObject.image_source = sharedData.options.thumbnailOverride.source;
        }
        let idb = {
            ressoucen_insert: [],
            ressoucen_update: [],
            files: [fileDatabaseObject],
            casparts_insert: [],
            cobj_com_insert_update: []
        };
        return idb;
    }
    static handleFilesForImport(files, unpackFolder) {
        if (!unpackFolder || !fs_1.default.existsSync(unpackFolder))
            throw new Error("Unpack folder not found");
        const prefix = "s4mm_unpack_";
        //Clear unpack folder
        let unpackFolderFiles = fs_1.default.readdirSync(unpackFolder);
        for (let i = 0; i < unpackFolderFiles.length; i++) {
            let file = path_1.default.join(unpackFolder, unpackFolderFiles[i]);
            try {
                if (unpackFolderFiles[i].startsWith(prefix))
                    fs_1.default.rmSync(file, { recursive: true });
            }
            catch (error) {
                console.error("FileImportHelper.handleZipAndRar", error);
            }
        }
        //Sort files
        let filesZip = [];
        let otherFiles = [];
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            let ext = path_1.default.extname(file.name).toLowerCase();
            if (ext === ".zip") {
                filesZip.push(file);
            }
            else {
                otherFiles.push(file);
            }
        }
        //Unpack zip files
        for (let i = 0; i < filesZip.length; i++) {
            let file = filesZip[i];
            let filePath = file.path;
            let unpackPath = path_1.default.join(unpackFolder, prefix + file.name.replace(/[^a-zA-Z0-9]/g, "_"));
            this.extractZipFile(filePath, unpackPath);
            let files = this.getAllFilesInFolder(unpackPath).map((f) => {
                f.parent = file;
                return f;
            });
            otherFiles = otherFiles.concat(files);
        }
        //Extract file info with fingerprint
        for (let i = 0; i < otherFiles.length; i++) {
            let file = otherFiles[i];
            let filePath = file.path;
            let fingerprint = this.getFingerprint(filePath);
            file.fingerprint = fingerprint;
        }
        return otherFiles;
    }
    static getAllFilesInFolder(folder) {
        let files = [];
        if (!fs_1.default.existsSync(folder))
            return files;
        let folderFiles = fs_1.default.readdirSync(folder);
        for (let i = 0; i < folderFiles.length; i++) {
            let file = path_1.default.join(folder, folderFiles[i]);
            if (fs_1.default.statSync(file).isDirectory()) {
                files = files.concat(this.getAllFilesInFolder(file));
            }
            else {
                files.push({
                    name: folderFiles[i],
                    path: file,
                });
            }
        }
        return files;
    }
    static getFingerprint(filePath) {
        let statsNormal = fs_1.default.statSync(filePath);
        let fingerprint = -1;
        try {
            if (statsNormal.size < 150000000) {
                fingerprint = Fingerprint_1.Fingerprint.computeFile(filePath);
            }
        }
        catch (error) {
            console.log(error);
        }
        return fingerprint;
    }
    static async extractZipFile(filePath, unpackFolder) {
        if (!fs_1.default.existsSync(unpackFolder)) {
            fs_1.default.mkdirSync(unpackFolder, { recursive: true });
        }
        if (!fs_1.default.existsSync(unpackFolder))
            throw new Error("Failed to create unpack folder");
        if (!fs_1.default.existsSync(filePath))
            throw new Error("File not found");
        try {
            // Load the zip file
            const zip = new adm_zip_1.default(filePath);
            // Extract all contents to the output folder
            zip.extractAllTo(unpackFolder, true);
            console.log(`Extracted zip file to: ${unpackFolder}`);
        }
        catch (error) {
            console.error("Error extracting zip file:", error);
            throw new Error("Failed to extract zip file");
        }
    }
    static getAllFilesFromFolder(folderpath, basepath = "") {
        if (!folderpath || !fs_1.default.existsSync(folderpath))
            return [];
        if (!basepath) {
            // Set the basepath on the initial call to ensure relative paths are calculated correctly
            basepath = folderpath;
        }
        let combindedFiles = [];
        const stats = fs_1.default.statSync(folderpath);
        // If it's a file, return it directly
        if (!stats.isDirectory()) {
            const relativepath = path_1.default.relative(basepath, folderpath);
            return [{
                    filepath: folderpath,
                    filename: path_1.default.basename(folderpath),
                    fileext: path_1.default.extname(folderpath),
                    relativepath: path_1.default.dirname(relativepath),
                }];
        }
        // If it's a directory, iterate through its contents
        const folderFiles = fs_1.default.readdirSync(folderpath);
        for (const element of folderFiles) {
            const filePath = path_1.default.join(folderpath, element);
            const files = this.getAllFilesFromFolder(filePath, basepath);
            combindedFiles = combindedFiles.concat(files);
        }
        return combindedFiles;
    }
}
exports.FileImportHelper = FileImportHelper;
