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
exports.FolderStructureController = void 0;
const electron_1 = require("electron");
const electron_2 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const error_util_1 = require("../utils/error.util");
const macOpen_1 = require("../utils/macOpen");
class FolderStructureController {
    constructor(mainApp) {
        this.baseFolder = undefined;
        this.folders = new Map();
        this.folderStructure = {
            key: "s4mm-data",
            name: "Sims 4 Mod Manager Data",
            folders: [
                {
                    key: "plumbdex",
                    name: "plumbdex",
                    folders: [
                        {
                            key: "health-bundles",
                            name: "health-bundles",
                        }
                    ]
                },
                {
                    key: "tools",
                    name: "tools",
                    folders: [
                        {
                            key: "tool-thumbnailDetect",
                            name: "thumbnailDetect",
                            folders: [
                                {
                                    key: "tool-thumbnailDetect-items",
                                    name: "items"
                                }
                            ]
                        },
                        {
                            key: "tool-disablePacks",
                            name: "disablePacks"
                        },
                        {
                            key: "model-viewer",
                            name: "model-viewer",
                            folders: [
                                {
                                    key: "combined-textures",
                                    name: "combined-textures"
                                },
                                {
                                    key: "cas-body-parts",
                                    name: "cas-body-parts"
                                }
                            ]
                        },
                        {
                            key: "tool-merge",
                            name: "tool-merge",
                            folders: [
                                {
                                    key: "tmp-merge",
                                    name: "tmp-merge"
                                }
                            ]
                        },
                        {
                            key: "tool-my-stories",
                            name: "tool-my-stories",
                            folders: [{
                                    key: "local-stories",
                                    name: "local-stories"
                                }]
                        },
                        {
                            key: "local-download-folder",
                            name: "local-download-folder"
                        }
                    ]
                },
                {
                    key: "cache",
                    name: "cache",
                    folders: [
                        {
                            key: "mood-images",
                            name: "mood-images"
                        },
                        {
                            key: "local-thumb-cache",
                            name: "local-thumb-cache"
                        }
                    ]
                },
                {
                    key: "mods-assets",
                    name: "mods-assets",
                    folders: [
                        {
                            key: "mods-images",
                            name: "images"
                        },
                        {
                            key: "thumbnails",
                            name: "thumbnails"
                        }
                    ]
                },
                {
                    key: "curseforge",
                    name: "curseforge",
                    folders: [
                        {
                            key: "cf-images",
                            name: "images"
                        },
                        {
                            key: "cf-downloads",
                            name: "downloads"
                        }
                    ]
                },
                {
                    key: "languages",
                    name: "languages"
                },
                {
                    key: "tmp",
                    name: "tmp"
                },
                {
                    key: "import-tmp",
                    name: "import-tmp"
                },
                {
                    key: "logs",
                    name: "logs"
                }
            ]
        };
        this.mainApp = mainApp;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.on("fsc", (event, data) => {
            if (data && data.action == "open-by-key" && data.key) {
                let folder = this.getFolder(data.key);
                if (folder)
                    this.openFolder(folder);
            }
            else if (data && data.action == "open-installation-directory") {
                let folderToOpen;
                if (process.platform === 'darwin') {
                    folderToOpen = path_1.default.join(electron_2.app.getPath('exe'), '../../..');
                }
                else {
                    folderToOpen = path_1.default.dirname(electron_2.app.getPath('exe'));
                }
                this.openFolder(folderToOpen);
            }
        });
        electron_1.ipcMain.handle("fsc", async (event, data) => {
            if (data.action == "create-update-folder-structure") {
                let f = this.createUpdateFolderStructure(data.folder);
                try {
                    this.cleanTmpFolder();
                }
                catch (e) {
                    console.error("Error cleaning tmp folder: ", e);
                }
                return f;
            }
            throw new Error("Unknown action");
        });
        electron_1.ipcMain.handle("get-from-fsc", async (event, data) => {
            if (data.action == "main-main-folder")
                return this.getMainDataFolder();
            throw new Error("Unknown action");
        });
        console.log("[FolderStructureController] initIPC");
    }
    getMainDataFolder() {
        if (this.baseFolder != undefined)
            return this.baseFolder;
        let userData = electron_2.app.getPath('userData');
        if (fs.existsSync(userData))
            this.baseFolder = userData;
        return userData;
    }
    createUpdateFolderStructure(folder) {
        let baseFolder = folder ? folder : this.getMainDataFolder();
        if (!baseFolder || !fs.existsSync(baseFolder))
            throw new Error("No valid base folder");
        //Check and create folder structure if needed
        let folderStructure = this.folderStructure;
        this.createUpdateFolder(baseFolder, folderStructure);
        return true;
    }
    createUpdateFolder(basePath, folder) {
        let folderpath = path_1.default.join(basePath, folder.name);
        console.log("[FSC] Create/Update Folder: " + folderpath);
        //Main Folder
        if (fs.existsSync(folderpath)) {
            this.folders.set(folder.key, folderpath);
        }
        else {
            fs.mkdirSync(folderpath);
            if (fs.existsSync(folderpath)) {
                this.folders.set(folder.key, folderpath);
            }
            else {
                throw new Error("Failed to create folder: " + folderpath);
            }
        }
        //Subfolders
        if (folder.folders) {
            folder.folders.forEach((subfolder) => {
                this.createUpdateFolder(folderpath, subfolder);
            });
        }
    }
    getFolder(key) {
        let folder = this.folders.get(key);
        if (folder)
            return folder;
        throw new Error("No folder found for key: " + key);
    }
    openFolder(folderPath) {
        if (!folderPath || !fs.existsSync(folderPath)) {
            error_util_1.ErrorUtil.showError("Folder not found: " + folderPath);
            return;
        }
        //Open folder
        if (process.platform === 'darwin') {
            (0, macOpen_1.openMac)(folderPath, { a: "Finder" }, function (error) {
                if (error) {
                    error_util_1.ErrorUtil.showError("Error opening folder: " + error);
                }
            });
        }
        else {
            require('child_process').exec('explorer.exe \"' + folderPath + "\"");
        }
    }
    cleanTmpFolder() {
        let tmpFolder = this.getFolder("tmp");
        if (!tmpFolder || !fs.existsSync(tmpFolder))
            return;
        let re = [".png", ".package", ".ts4script", ".zip", ".rar", ".jpg", ".jpeg", ".webp", ".dds"];
        let files = fs.readdirSync(tmpFolder);
        files.forEach(file => {
            let ext = path_1.default.extname(file).toLowerCase();
            if (re.includes(ext)) {
                try {
                    fs.rmSync(path_1.default.join(tmpFolder, file));
                }
                catch (e) {
                    console.error("Failed to delete tmp file: " + file, e);
                }
            }
        });
    }
}
exports.FolderStructureController = FolderStructureController;
