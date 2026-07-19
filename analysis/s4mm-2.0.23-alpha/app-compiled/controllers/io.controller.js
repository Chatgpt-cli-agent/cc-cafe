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
exports.IoController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
class IoController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.on("io", (event, data) => {
            console.log("io", data);
        });
        electron_1.ipcMain.handle("io-checks", async (event, data) => {
            if (data.action == "check-folder-permissions" && data.folder != undefined)
                return this.ioCheckFolderPermissons(data.folder);
            throw new Error("No valid action or parameters");
        });
        electron_1.ipcMain.handle("io", async (event, data) => {
            if (data.action == "create-folder" && ((data.name && data.path) || data.fullpath)) {
                let name = data.name || path_1.default.basename(data.fullpath);
                let folderPath = data.path || path_1.default.dirname(data.fullpath);
                return this.crateFolder(folderPath, name);
            }
            throw new Error("No valid action or parameters");
        });
    }
    //IO Checks
    async ioCheckFolderPermissons(folderPath) {
        const result = { readable: false, writable: false, exists: false };
        try {
            // Check if folder exists
            await fs_1.promises.access(folderPath, fs_1.constants.F_OK);
            result.exists = true;
        }
        catch {
            result.exists = false;
        }
        try {
            // Check read permission
            await fs_1.promises.access(folderPath, fs_1.constants.R_OK);
            result.readable = true;
        }
        catch {
            result.readable = false;
        }
        try {
            // Check write permission
            await fs_1.promises.access(folderPath, fs_1.constants.W_OK);
            result.writable = true;
        }
        catch {
            result.writable = false;
        }
        if (result.writable && fs.existsSync(folderPath)) {
            //Try to write a test file
            let testFile = path_1.default.join(folderPath, "s4mm_permisson_test_file.txt");
            try {
                fs.writeFileSync(testFile, "test", 'utf8');
                fs.unlinkSync(testFile);
            }
            catch (error) {
                console.log("[Permission Test] Failed to write test file");
                console.log(error);
                result.writable = false;
            }
        }
        return result;
    }
    crateFolder(folderPath, folderName) {
        if (!folderPath || !fs.existsSync(folderPath))
            return -2;
        let fullPath = path_1.default.join(folderPath, folderName);
        if (fs.existsSync(fullPath))
            return -1;
        try {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        catch (error) {
            console.log("[Create Folder] Failed to create folder", error);
            return -2;
        }
        return fs.existsSync(fullPath) ? 1 : -2;
    }
}
exports.IoController = IoController;
