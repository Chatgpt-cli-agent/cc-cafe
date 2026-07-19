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
exports.FileImportController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const DBPFReader_1 = require("../sims/DBPFReader");
const FileImport_1 = require("../utils/FileImport");
const imageProcessing_1 = require("../utils/imageProcessing");
const Fingerprint_1 = require("../utils/Fingerprint");
class FileImportController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("file-import", async (event, data) => {
            switch (data.action) {
                case "get-files-ready":
                    return await this.getFilesReady(data.files);
                case "get-basic-info":
                    return await this.getBasicInfo(data.filepath);
                case "user-select-thumbnail":
                    return await this.userSelectThumbnail(event);
                case "import-file":
                    if (data.file && data.importFolder != undefined) {
                        return await this.importFile(data.file, data.importFolder);
                    }
                    else {
                        throw new Error("No valid file or import folder provided.");
                    }
            }
            throw new Error("No valid action provided.");
        });
    }
    async getFilesReady(files) {
        let importFolder = this.mainApp.folderStructureController.getFolder("import-tmp");
        if (!importFolder || !fs.existsSync(importFolder))
            throw new Error("No valid import folder found.");
        return FileImport_1.FileImportHelper.handleFilesForImport(files, importFolder);
    }
    async getBasicInfo(filepath) {
        if (!filepath || !fs.existsSync(filepath))
            throw new Error("No valid file path provided.");
        let result = {
            thumbnails: [],
            fingerprint: -1,
            isDupplicate: false,
            stats: undefined
        };
        //Thumnails
        if (filepath.toLowerCase().endsWith(".package") || filepath.toLowerCase().endsWith(".packageoff")) {
            try {
                let pack = new DBPFReader_1.Pack(filepath);
                pack.checkFile();
                if (pack.error)
                    throw new Error("Error reading file: " + pack.error);
                pack.calculateIndexList();
                let tmpFolder = this.mainApp.folderStructureController.getFolder("import-tmp");
                if (!tmpFolder || !fs.existsSync(tmpFolder))
                    throw new Error("No valid import folder found.");
                let thumbnails = await pack.exportThumnails(tmpFolder, "s4mm_thum_cc", false);
                if (thumbnails && thumbnails.length > 0) {
                    result.thumbnails = thumbnails;
                }
            }
            catch (error) {
                console.error("Error reading file", error);
            }
        }
        //Fingerprint
        let statsNormal = fs.statSync(filepath);
        result.stats = statsNormal;
        //Calculate file fingerprint
        try {
            if (statsNormal.size < 150000000) {
                result.fingerprint = Fingerprint_1.Fingerprint.computeFile(filepath);
            }
        }
        catch (error) {
            console.log(error);
        }
        if (result.fingerprint == -1)
            return result;
        //Check for dup?
        //TODO
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No valid database connection found.");
        try {
            let stats = fs.statSync(filepath);
            let size = stats.size;
            let items = await knex.from("Files").where("fingerprint", result.fingerprint).andWhere("size", size).select(knex.raw('CAST(ino AS TEXT) AS ino'));
            if (items && items.length > 0) {
                result.isDupplicate = true;
            }
        }
        catch (error) {
            console.error("Error getting file size", error);
        }
        return result;
    }
    async userSelectThumbnail(event) {
        //Dialog to open any image file
        if (!event || event.sender == null)
            throw new Error("No sender");
        let obj = {
            thumbnail: undefined,
            error: true
        };
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            throw new Error("No browserWindow");
        let files = await electron_1.dialog.showOpenDialog(browserWindow, {
            properties: ["openFile"],
            title: "Select a thumbnail",
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
            ]
        });
        if (!files || !files.filePaths || files.filePaths.length == 0) {
            obj.error = false;
            return obj;
        }
        let file = files.filePaths[0];
        //Crop image to 104x148
        let tmpFolder = this.mainApp.folderStructureController.getFolder("import-tmp");
        if (!tmpFolder || !fs.existsSync(tmpFolder))
            throw new Error("No valid import folder found.");
        let thum = path_1.default.join(tmpFolder, "s4mm_thum_user_selected_" + Date.now() + ".png");
        await imageProcessing_1.ImageProcessing.resizeImageToFile(file, 104, 148, thum);
        obj.thumbnail = thum;
        obj.error = !thum || !fs.existsSync(thum);
        return obj;
    }
    async importFile(file, importFolder) {
        if (importFolder == undefined)
            throw new Error("No valid import folder found.");
        if (importFolder.length == 0)
            importFolder = this.mainApp.settings.s_path_mod;
        if (!importFolder || !fs.existsSync(importFolder))
            throw new Error("No valid import folder found.");
        if (!file || !file.path || !fs.existsSync(file.path))
            throw new Error("No valid file path provided.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No valid database connection found.");
        let result = {
            error: true,
            message: "Unknown error",
            errorId: 0
        };
        //Data
        let filePath = file.path;
        let fileName = file.name;
        if (file.newName && file.newName.trim().length > 0) {
            fileName = file.newName.trim() + path_1.default.extname(fileName);
        }
        let newFilePath = path_1.default.join(importFolder, fileName);
        //Error 1: File is in mod folder
        let modFolderPath = this.mainApp.settings.s_path_mod;
        if (filePath.startsWith(modFolderPath + path_1.default.sep)) {
            result.error = true;
            result.message = "File is already in mod folder.";
            result.errorId = 1;
            return result;
        }
        //Error 2: File with same name already exists in mod folder
        if (fs.existsSync(newFilePath)) {
            result.error = true;
            result.message = "File with same name already exists in mod folder.";
            result.errorId = 2;
            return result;
        }
        //Copy file to new location
        try {
            await fs_1.promises.copyFile(filePath, newFilePath, fs_1.constants.COPYFILE_FICLONE);
            result.error = false;
        }
        catch (error) {
            //Error 3: Error copying file to mod folder
            console.error("Error copying file", error);
            result.error = true;
            result.message = "Error copying file: " + error;
            result.errorId = 3;
            return result;
        }
        //Checks if ino is in use
        let bigStats = fs.statSync(newFilePath, { bigint: true });
        let bigInoString = bigStats.ino.toString();
        try {
            let dbFiles = await knex("files").where("ino", bigInoString).select(knex.raw('CAST(ino AS TEXT) AS ino'));
            if (dbFiles && dbFiles.length > 0) {
                result.error = true;
                result.message = "File INO is already in database.";
                result.errorId = 4;
                return result;
            }
        }
        catch (error) {
            result.error = true;
            result.message = "Error checking file in database: " + error;
            result.errorId = 5;
            return result;
        }
        //Import file
        let sharedData = {
            modImageFolder: this.mainApp.folderStructureController.getFolder("mods-images"),
            modFolderPath: this.mainApp.settings.s_path_mod,
            options: {},
            skipInoCheck: true,
        };
        //Thumbnail
        if (file.thumbnails && file.thumbnails.length > 0) {
            let thumbnailPath = file.thumbnails[file.thumbnailIndex] || file.thumbnails[0];
            let source = 0;
            let filename = path_1.default.basename(thumbnailPath);
            if (filename.includes("s4mm_thum_cc"))
                source = 1;
            if (filename.includes("s4mm_thum_user_selected"))
                source = 2;
            if (filename.includes("s4mm_thum_user_cf"))
                source = 3;
            let imageFolder = this.mainApp.folderStructureController.getFolder("mods-images");
            if (!imageFolder || !fs.existsSync(imageFolder))
                throw new Error("No valid image folder found.");
            //Copy image to image folder
            let newImagePath = path_1.default.join(imageFolder, "f_" + bigStats.ino.toString(16).padStart(16, "0") + ".png");
            try {
                await fs_1.promises.copyFile(thumbnailPath, newImagePath, fs_1.constants.COPYFILE_FICLONE);
                if (fs.existsSync(newImagePath)) {
                    sharedData.options.thumbnailOverride = {
                        image: newImagePath,
                        source: source,
                    };
                }
            }
            catch (error) {
                console.error("Error copying thumbnail", error);
            }
        }
        else {
            sharedData.options.thumbnailOverride = {
                image: "",
                source: 0,
            };
        }
        let importResult = undefined;
        try {
            importResult = (await FileImport_1.FileImportHelper.importFileWithPath(newFilePath, sharedData)).idb;
        }
        catch (error) {
            result.error = true;
            result.message = "Error importing file: " + error;
            result.errorId = 6;
            return result;
        }
        //Update Database
        try {
            await this.mainApp.fileLoadingController.insertOrUpdateFile(importResult, true);
        }
        catch (error) {
            console.error("Error inserting file to database", error);
            result.error = true;
            result.message = "Error inserting file to database: " + error;
            result.errorId = 7;
            return result;
        }
        //Save node
        if (file.note) {
            let ino = bigStats.ino.toString();
            let note = file.note.trim();
            await this.mainApp.noteController.saveNote(ino, fileName, note);
        }
        //Finish
        result.error = false;
        result.message = "File imported successfully.";
        result.errorId = 0;
        return result;
    }
    async importSingleFile(filepath) {
        if (!filepath || !fs.existsSync(filepath))
            throw new Error("No valid file path provided.");
        let bigStats = fs.statSync(filepath, { bigint: true });
        let bigInoString = bigStats.ino.toString();
        let autoRunCategories = await this.mainApp.categoriesController.getAutoRunCategories();
        //Import file
        let sharedData = {
            modImageFolder: this.mainApp.folderStructureController.getFolder("mods-images"),
            modFolderPath: this.mainApp.settings.s_path_mod,
            options: {},
            skipInoCheck: true,
            categories: autoRunCategories,
        };
        let importResult = undefined;
        importResult = (await FileImport_1.FileImportHelper.importFileWithPath(filepath, sharedData)).idb;
        await this.mainApp.fileLoadingController.insertOrUpdateFile(importResult, true);
        //Get file from data
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No valid database connection found.");
        let file = await knex("files").select(["*", knex.raw('CAST(ino AS TEXT) AS ino')]).where("ino", bigInoString).first();
        if (!file)
            throw new Error("No file found with ino: " + bigInoString);
        return file;
    }
}
exports.FileImportController = FileImportController;
