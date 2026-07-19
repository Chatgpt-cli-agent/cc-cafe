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
exports.ToolSimple = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
class ToolSimple {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle('tool-simple', async (event, data) => {
            switch (data.action) {
                case "empty-folder":
                    return await this.emptyFolder();
                default:
                    throw new Error("No action specified");
            }
        });
    }
    async emptyFolder() {
        let folderpath = this.mainApp.settings.s_path_mod;
        if (!folderpath || !fs.existsSync(folderpath)) {
            throw new Error("No folder path specified or folder does not exist");
        }
        if (!folderpath || !fs.existsSync(folderpath))
            return undefined;
        let arr = [];
        let whiteList = new Set();
        whiteList.add(".DS_Store".toLowerCase());
        let otherFiles = [];
        this.getHighestEmptyFolder(folderpath, arr, whiteList, otherFiles, true);
        let arrn = [];
        for (let index = 0; index < arr.length; index++) {
            const element = arr[index];
            arrn.push({ path: element.path, hasSubfolders: element.hasSubfolders, name: path_1.default.basename(element.path) });
        }
        return {
            folders: arrn,
            otherfiles: otherFiles
        };
    }
    getHighestEmptyFolder(folderpath, resultArr, whiteList, otherFiles, isBase) {
        //Count Elements
        let simsFilesCount = 0;
        let otherFilesCount = 0;
        let subSimsFilesCount = 0;
        let subOtherFilesCount = 0;
        let hasSubfolders = false;
        let empty = [];
        let onlyOther = [];
        let files = fs.readdirSync(folderpath);
        for (let index = 0; index < files.length; index++) {
            const filename = files[index];
            const filepath = path_1.default.join(folderpath, filename);
            if (this.isSimsFile(filename)) {
                simsFilesCount++;
            }
            else if (this.isFolder(filepath)) {
                //Is Sub Folder
                hasSubfolders = true;
                let folder = this.getHighestEmptyFolder(filepath, resultArr, whiteList, otherFiles);
                subSimsFilesCount += folder.ts;
                subOtherFilesCount += folder.ts;
                if (folder.ts == 0 && folder.to == 0) {
                    empty.push(folder);
                }
            }
            else if (whiteList.has(filename.toLowerCase())) {
                //Nix
            }
            else {
                otherFilesCount++;
                otherFiles.push({
                    filename: filename,
                    filepath: filepath
                });
            }
        }
        let ts = simsFilesCount + subSimsFilesCount;
        let to = otherFilesCount + subOtherFilesCount;
        let obj = {
            path: folderpath,
            sfc: simsFilesCount,
            ofc: otherFilesCount,
            ssfc: subSimsFilesCount,
            sofc: subOtherFilesCount,
            ts: ts,
            to: to,
            hasSubfolders: hasSubfolders
        };
        if ((ts != 0 || to != 0 || isBase) && empty.length > 0) {
            resultArr.push(...empty);
        }
        return obj;
    }
    isFolder(filepath) {
        return fs.lstatSync(filepath).isDirectory();
    }
    isSimsFile(filename) {
        let name = filename.toLowerCase();
        return name.endsWith(".package") || name.endsWith(".packageoff")
            || name.endsWith(".ts4script") || name.endsWith(".ts4scriptoff");
    }
}
exports.ToolSimple = ToolSimple;
