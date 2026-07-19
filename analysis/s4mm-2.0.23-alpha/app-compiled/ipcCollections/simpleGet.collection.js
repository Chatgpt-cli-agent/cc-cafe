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
exports.SimpleGetCollection = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const FilenameUtils_1 = require("../utils/FilenameUtils");
class SimpleGetCollection {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("simple-get", async (event, data) => {
            if (data.action == "folder-info") {
                return await this.getFolderInfo(data);
            }
            else if (data.action == "folder-content") {
                return this.getFolderContent(data.path, data.withFiles == undefined ? true : data.withFiles);
            }
            else if (data.action == "folder-all") {
                return this.getAllSubFolders(data.path ? data.path : this.mainApp.settings.s_path_mod);
            }
            else if (data.action == "folder-filetypes" && data.path) {
                return this.getFileType(data.path);
            }
            else if (data.action == "get-folder-content") {
                return await this.getFolderContent(data.folderpath);
            }
            else if (data.action == "get-gamestate") {
                return { gameState: this.mainApp.gameStateController.isRunning() };
            }
            throw new Error("No action or invalid parameters - " + data.action);
        });
    }
    async getFolderInfo(data) {
        let folderPath = data.path;
        let extraData = false;
        if (data.extra != undefined)
            extraData = data.extra;
        if (folderPath.length == 0) {
            folderPath = this.mainApp.settings.s_path_mod;
        }
        if (!fs.existsSync(folderPath)) {
            return undefined;
        }
        let folderInfo = await this.getFolderInfo_Helper(folderPath, extraData);
        let obj = { "action": "display-folder", "folderInfo": folderInfo, "path": folderPath, "name": path_1.default.basename(folderPath) };
        return obj;
    }
    async getFolderInfo_Helper(folderPath, extraData) {
        let subfolders = [];
        let filecount = 0;
        try {
            var files = fs.readdirSync(folderPath);
            for (let index = 0; index < files.length; index++) {
                const element = files[index];
                const p = folderPath + path_1.default.sep + element;
                const stats = fs.lstatSync(p);
                const isFolder = stats.isDirectory() || stats.isSymbolicLink();
                if ((0, FilenameUtils_1.isSims4File)(element)) {
                    filecount++;
                }
                if (isFolder) {
                    let item = { "name": element, "path": p };
                    if (extraData) {
                        item.fileCount = 0;
                    }
                    subfolders.push(item);
                }
            }
        }
        catch (error) {
            console.log(error);
        }
        return { "subfolders": subfolders, "path": folderPath, "name": path_1.default.basename(folderPath), "fileCount": filecount };
    }
    getFolderContent(folderPath, withFiles = true) {
        let time = Date.now();
        console.log("[SimpleGetCollection] Started getting folder content for: " + folderPath + " withFiles: " + withFiles);
        let folder = folderPath ? folderPath : this.mainApp.settings.s_path_mod;
        let foldername = path_1.default.basename(folder);
        let rawFiles = fs.readdirSync(folder);
        let subfolders = [];
        let files = [];
        rawFiles.forEach(file => {
            let subfolderPath = path_1.default.join(folder, file);
            let isDirectory = fs.lstatSync(subfolderPath).isDirectory();
            if (isDirectory) {
                subfolders.push({
                    name: file,
                    path: subfolderPath
                });
            }
            else if (withFiles) {
                files.push({
                    name: file
                });
            }
        });
        console.log("[SimpleGetCollection] Finished getting folder content for: " + folderPath + " in " + (Date.now() - time) + "ms");
        return {
            name: foldername,
            path: folder,
            subfolders: subfolders,
            files: files
        };
    }
    getAllSubFolders(folderPath) {
        if (!folderPath || !fs.existsSync(folderPath))
            return undefined;
        return this.getSubFolders(folderPath);
    }
    getSubFolders(folderPath) {
        let foldername = path_1.default.basename(folderPath);
        let subfolders = [];
        let obj = {
            name: foldername,
            path: folderPath,
            subfolders: subfolders
        };
        let rawFiles = fs.readdirSync(folderPath);
        rawFiles.forEach(file => {
            let subfolderPath = path_1.default.join(folderPath, file);
            let isDirectory = fs.lstatSync(subfolderPath).isDirectory();
            if (isDirectory) {
                obj.subfolders.push(this.getSubFolders(subfolderPath));
            }
        });
        return obj;
    }
    getFileType(filePath) {
        let items = new Map();
        try {
            this.readFileTypes(filePath, items);
        }
        catch (error) {
            console.log(error);
        }
        let obj = [];
        items.forEach((value, key) => {
            obj.push({ name: key.substring(1).toUpperCase(), count: value });
        });
        return obj;
    }
    readFileTypes(folderPath, map) {
        let rawFiles = fs.readdirSync(folderPath);
        rawFiles.forEach(file => {
            let subfolderPath = path_1.default.join(folderPath, file);
            let isDirectory = fs.lstatSync(subfolderPath).isDirectory();
            if (isDirectory) {
                this.readFileTypes(subfolderPath, map);
            }
            else {
                let ext = path_1.default.extname(file).toLowerCase();
                if (map.has(ext)) {
                    map.set(ext, map.get(ext) + 1);
                }
                else {
                    map.set(ext, 1);
                }
            }
        });
    }
}
exports.SimpleGetCollection = SimpleGetCollection;
