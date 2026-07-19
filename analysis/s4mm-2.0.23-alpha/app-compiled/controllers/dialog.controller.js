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
exports.DialogController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const SimsImageUtil_1 = require("../utils/SimsImageUtil");
class DialogController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("dialog", async (event, data) => {
            if (data.action == "open-choose-folder")
                return this.openChooseFolderDialog(data.options, event);
            if (data.action == "open-choose-files-to-import")
                return this.openChooseFilesToImportDialog(data.options, event);
            if (data.action == "open-choose-image")
                return this.openChooseImageDialog(data.options, event);
            if (data.action == "open-choose-images-multiple")
                return this.openChooseImagesMultipleDialog(data.options, event);
            if (data.action == "save-package-file")
                return this.savePackageFileDialog(data, event);
            if (data.action == "save-file")
                return this.saveFileDialog(data, event);
            if (data.action == "open-file")
                return this.openFileDialog(data, event);
            throw new Error("No valid action or parameters");
        });
    }
    async openChooseFolderDialog(options, event) {
        if (!event || event.sender == null)
            return { error: true, message: "No sender" };
        let obj = {
            folderpath: undefined,
            error: true
        };
        let defaultPath = options && options.defaultPath ? options.defaultPath : require("os").homedir();
        if (options && options.defaultPathType == "documents") {
            let documents = electron_1.app.getPath("documents");
            if (fs.existsSync(documents))
                defaultPath = documents;
        }
        else if (options && options.defaultPathType == "downloads") {
            let downloads = electron_1.app.getPath("downloads");
            if (fs.existsSync(downloads))
                defaultPath = downloads;
        }
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            return { error: true, message: "No sender" };
        let folder = await electron_1.dialog.showOpenDialog(browserWindow, {
            properties: ["openDirectory"],
            title: "Select a folder",
            defaultPath: defaultPath
        });
        if (folder && folder.filePaths && folder.filePaths.length == 1) {
            obj.error = false;
            obj.folderpath = folder.filePaths[0];
        }
        return obj;
    }
    async openChooseFilesToImportDialog(options, event) {
        if (!event || event.sender == null)
            return { error: true, message: "No sender" };
        let obj = {
            folderpaths: undefined,
            error: true
        };
        let defaultPath = options && options.defaultPath ? options.defaultPath : require("os").homedir();
        if (options && options.defaultPathType == "documents") {
            let documents = electron_1.app.getPath("documents");
            if (fs.existsSync(documents))
                defaultPath = documents;
        }
        else if (options && options.defaultPathType == "downloads") {
            let downloads = electron_1.app.getPath("downloads");
            if (fs.existsSync(downloads))
                defaultPath = downloads;
        }
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            return { error: true, message: "No sender" };
        let folder = await electron_1.dialog.showOpenDialog(browserWindow, {
            properties: ["openFile", "multiSelections"],
            title: "Select files to import",
            defaultPath: defaultPath,
            filters: [
                {
                    name: "Supported Files",
                    extensions: ["package", "packageOFF", "ts4script", "ts4scriptOFF", "zip"]
                }
            ]
        });
        if (folder && folder.filePaths && folder.filePaths.length > 0) {
            obj.error = false;
            obj.folderpaths = folder.filePaths;
            obj.files = folder.filePaths.map((filepath) => {
                return {
                    name: path_1.default.basename(filepath),
                    path: filepath
                };
            });
        }
        return obj;
    }
    async openChooseImageDialog(options, event) {
        if (!event || event.sender == null)
            return { error: true, message: "No sender" };
        let obj = {
            imagepath: undefined,
            error: true
        };
        let defaultPath = options && options.defaultPath ? options.defaultPath : require("os").homedir();
        if (options && options.defaultPathType == "pictures") {
            let documents = electron_1.app.getPath("pictures");
            if (fs.existsSync(documents))
                defaultPath = documents;
        }
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            return { error: true, message: "No sender" };
        let image = await electron_1.dialog.showOpenDialog(browserWindow, {
            properties: ["openFile"],
            title: "Select an image",
            defaultPath: defaultPath,
            filters: [
                { name: "Images", extensions: ["jpg", "jpeg", "png"] }
            ]
        });
        if (image && image.filePaths && image.filePaths.length == 1) {
            obj.error = false;
            if (options.resize && options.resize.x && options.resize.y) {
                let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
                if (!tmpFolder)
                    throw new Error("No tmp folder found");
                let resizedPath = path_1.default.join(tmpFolder, "resized_" + Date.now() + "." + options.resize.type);
                let r = await SimsImageUtil_1.SimsImageUtil.resizeImageTo(image.filePaths[0], resizedPath, options.resize.x, options.resize.y);
                if (!r) {
                    obj.error = true;
                    obj.message = "Failed to resize image";
                }
                else {
                    obj.imagepath = resizedPath;
                }
            }
            else {
                obj.imagepath = image.filePaths[0];
            }
        }
        return obj;
    }
    async openChooseImagesMultipleDialog(options, event) {
        if (!event || event.sender == null)
            return { error: true, message: "No sender" };
        let obj = {
            imagepaths: [],
            error: true
        };
        let defaultPath = options && options.defaultPath ? options.defaultPath : require("os").homedir();
        if (options && options.defaultPathType == "pictures") {
            let documents = electron_1.app.getPath("pictures");
            if (fs.existsSync(documents))
                defaultPath = documents;
        }
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || this.mainApp.mainWindowController.mainWindow || undefined;
        if (!browserWindow)
            return { error: true, message: "No sender" };
        let images = await electron_1.dialog.showOpenDialog(browserWindow, {
            properties: ["openFile", "multiSelections"],
            title: "Select images",
            defaultPath: defaultPath,
            filters: [
                { name: "Images", extensions: ["jpg", "jpeg", "png"] }
            ]
        });
        if (images && images.filePaths && images.filePaths.length > 0) {
            obj.error = false;
            obj.imagepaths = images.filePaths;
        }
        if (options.copyTmp) {
            let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
            if (!tmpFolder)
                throw new Error("No tmp folder found");
            let copiedPaths = [];
            for (let imagePath of obj.imagepaths) {
                let ext = path_1.default.extname(imagePath);
                let copiedPath = path_1.default.join(tmpFolder, "copied_" + Date.now() + "_" + path_1.default.basename(imagePath));
                try {
                    fs.copyFileSync(imagePath, copiedPath);
                    copiedPaths.push(copiedPath);
                }
                catch (e) {
                    console.error("Failed to copy file: " + imagePath, e);
                }
            }
            obj.imagepaths = copiedPaths;
        }
        return obj;
    }
    async savePackageFileDialog(options, event) {
        if (!event || event.sender == null)
            return { error: true, message: "No sender" };
        let obj = {
            filepath: undefined,
            error: true
        };
        let defaultPath = options && options.defaultPath ? options.defaultPath : require("os").homedir();
        if (options && options.defaultPathType == "documents") {
            let documents = electron_1.app.getPath("documents");
            if (fs.existsSync(documents))
                defaultPath = documents;
        }
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            return { error: true, message: "No sender" };
        let file = await electron_1.dialog.showSaveDialog(browserWindow, {
            title: "Save Package File",
            defaultPath: path_1.default.join(defaultPath, options.filename || "new_file.package"),
            filters: [
                { name: "Sims 4 Package", extensions: ["package", "packageOff"] }
            ]
        });
        if (file && file.filePath && file.filePath.trim().length > 0) {
            obj.error = false;
            obj.filepath = file.filePath;
        }
        return obj;
    }
    async saveFileDialog(options, event) {
        if (!event || event.sender == null)
            return { error: true, message: "No sender" };
        if (!options || !options.filename)
            throw new Error("No filename provided in options");
        if (!options.filters) {
            throw new Error("No filters provided in options");
        }
        let obj = {
            filepath: undefined,
            error: true
        };
        let defaultPath = options && options.defaultPath ? options.defaultPath : require("os").homedir();
        if (options && options.defaultPathType == "documents") {
            let documents = electron_1.app.getPath("documents");
            if (fs.existsSync(documents))
                defaultPath = documents;
        }
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            return { error: true, message: "No sender" };
        let file = await electron_1.dialog.showSaveDialog(browserWindow, {
            title: options.title,
            defaultPath: path_1.default.join(defaultPath, options.filename),
            filters: options.filters
        });
        if (file && file.filePath && file.filePath.trim().length > 0) {
            obj.error = false;
            obj.filepath = file.filePath;
            //Check if filenames ends with one of the filter extensions
            let validExtension = false;
            for (let filter of options.filters) {
                if (filter.extensions && filter.extensions.length > 0) {
                    for (let ext of filter.extensions) {
                        if (file.filePath.toLowerCase().endsWith("." + ext.toLowerCase())) {
                            validExtension = true;
                            break;
                        }
                    }
                }
                if (validExtension)
                    break;
            }
            if (!validExtension) {
                //Add the first filter extension to the filename
                let firstFilter = options.filters[0];
                if (firstFilter && firstFilter.extensions && firstFilter.extensions.length > 0) {
                    file.filePath += "." + firstFilter.extensions[0];
                }
            }
        }
        return obj;
    }
    async openFileDialog(options, event) {
        if (!event || event.sender == null)
            return { error: true, message: "No sender" };
        let obj = {
            filepath: undefined,
            error: true
        };
        let defaultPath = options && options.defaultPath ? options.defaultPath : require("os").homedir();
        if (options && options.defaultPathType == "documents") {
            let documents = electron_1.app.getPath("documents");
            if (fs.existsSync(documents))
                defaultPath = documents;
        }
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            return { error: true, message: "No sender" };
        let file = await electron_1.dialog.showOpenDialog(browserWindow, {
            properties: ["openFile"],
            title: options.title || "Open File",
            defaultPath: defaultPath,
            filters: options.filters || []
        });
        if (file && file.filePaths && file.filePaths.length == 1) {
            obj.error = false;
            obj.filepath = file.filePaths[0];
        }
        return obj;
    }
}
exports.DialogController = DialogController;
