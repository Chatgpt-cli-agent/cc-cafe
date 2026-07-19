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
exports.SimpleTasksCollection = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const macOpen_1 = require("../utils/macOpen");
const IPCExtras_1 = require("../utils/IPCExtras");
class SimpleTasksCollection {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.on("simple-task", (event, data) => {
            switch (data.task) {
                case "open-folder":
                    this.openFolder(data.path);
                    break;
                case "open-file":
                    let filePath = data.filepath;
                    if (!filePath && data.path && data.filename) {
                        filePath = path_1.default.join(data.path, data.filename);
                    }
                    if (!filePath || !fs.existsSync(filePath)) {
                        throw new Error("File was not provided or does not exist: " + filePath);
                    }
                    this.openFile(filePath);
                    break;
                case "open-in-s4s":
                    let s4sopenFilePath = data.filepath;
                    if (!s4sopenFilePath && data.path && data.filename) {
                        s4sopenFilePath = path_1.default.join(data.path, data.filename);
                    }
                    this.openInS4S(s4sopenFilePath);
                    break;
                case "send-to-win":
                    console.log("Sending to main window:", data);
                    let mainWindow = this.mainApp.mainWindowController.getWindow();
                    if (mainWindow) {
                        IPCExtras_1.IPCExtras.sendFromMain(mainWindow, data.channel, data.data);
                    }
                    break;
                default:
                    console.warn("Unknown simple task requested:", data.task);
                    // Handle unknown tasks if needed
                    break;
            }
        });
        electron_1.ipcMain.handle("simple-task-invoke", async (event, data) => {
            switch (data.task) {
                case "fetch-api":
                    if (!data.url)
                        throw new Error("No URL provided for fetch-api task");
                    return await this.fetchApi(data.url, data.timeout);
                default:
                    throw new Error("Unknown simple task requested: " + data.task);
            }
        });
    }
    openFolder(folderpath) {
        if (!folderpath || !fs.existsSync(folderpath))
            return;
        //Is Windows
        if (process.platform !== 'darwin') {
            require('child_process').exec('explorer.exe \"' + folderpath + "\"");
        }
        else {
            (0, macOpen_1.openMac)(folderpath, { a: "Finder" }, function (error) { console.log(error); });
        }
    }
    openFile(filepath) {
        if (!filepath || !fs.existsSync(filepath))
            return;
        //Is Windows
        if (process.platform !== 'darwin') {
            require('child_process').exec('explorer.exe /select, \"' + (filepath) + "\"");
        }
        else {
            require('child_process').exec('open -R \"' + (filepath) + "\"");
        }
    }
    openInS4S(filepath) {
        if (!filepath || !fs.existsSync(filepath))
            throw new Error("File was not provided or does not exist: " + filepath);
        let s4sPath = this.mainApp.settings.s_s4s;
        if (!s4sPath || !fs.existsSync(s4sPath))
            throw new Error("S4S path is not set or does not exist: " + s4sPath);
        if (process.platform !== 'darwin') {
            require('child_process').exec('\"' + s4sPath + '\" \"' + filepath + "\"");
        }
        else {
            require('child_process').exec('open -F -a\"' + s4sPath + '\"  \"' + filepath + "\"");
        }
    }
    async fetchApi(url, timeout = 100000) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const controller = new AbortController();
            const signal = controller.signal;
            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error("Request timed out"));
            }, timeout);
            https.get(url, { signal }, (resp) => {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    clearTimeout(timeoutId);
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            }).on("error", (err) => {
                clearTimeout(timeoutId);
                reject(err);
            });
        });
    }
}
exports.SimpleTasksCollection = SimpleTasksCollection;
