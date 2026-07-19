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
exports.ToolRMapWorkerUtils = exports.ToolRMap = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const WorkerQueue_1 = require("../utils/WorkerQueue");
const IPCExtras_1 = require("../utils/IPCExtras");
const RegionMapCalulations_1 = require("./RegionMapCalulations");
class ToolRMap {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-rmap", async (event, data) => {
            switch (data.action) {
                case "get-files-with-rmap":
                    return await this.getFilesWithRMap();
                case "process-files":
                    return await this.processFiles(data, event);
                default:
                    throw new Error("Unknown action: " + data.action);
            }
        });
    }
    async getFilesWithRMap() {
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex) {
            throw new Error("Database connection is not available.");
        }
        let sel = [knex.raw('CAST(Files.ino AS TEXT) AS ino'), "Files.name", "Files.path", "Files.image"];
        let files = await knex
            .select(sel)
            .from('Files')
            .join('Entries', 'Files.ino', 'Entries.ino')
            .where('Entries.type', 0xAC16FBEC)
            .distinct();
        return files;
    }
    async processFiles(data, event) {
        let { files, types, options, loading } = data;
        if (!files || !Array.isArray(files) || files.length === 0) {
            throw new Error("No files provided for processing.");
        }
        if (!types || !Array.isArray(types) || types.length === 0) {
            throw new Error("No types provided for processing.");
        }
        let tasks = [];
        files.forEach((file) => {
            tasks.push({
                action: "check-file-rmap-bounds",
                data: {
                    file: file,
                    types: types,
                    options: options
                }
            });
        });
        let workerPromise = new Promise((resolve, reject) => {
            new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {}, async (progress) => {
                //OnProgress
                if (loading) {
                    IPCExtras_1.IPCExtras.send(event, loading, { close: false, value: progress.index, max: progress.max, title: (progress.index + "/" + progress.max) });
                }
            }, async (results) => {
                resolve(results.filter((item) => item && item.data).map((result) => {
                    return {
                        issues: result.data.items,
                        id: result.task.data.file.id,
                        ino: result.task.data.file.ino
                    };
                }));
            });
        });
        let items = await workerPromise;
        if (loading)
            IPCExtras_1.IPCExtras.send(event, loading, { "close": true });
        return {
            type: "rmap",
            items: items
        };
    }
}
exports.ToolRMap = ToolRMap;
class ToolRMapWorkerUtils {
    static checkFileRmapBounds(data) {
        let file = data.file;
        let types = data.types;
        let options = {
            compareAgainstBase: false,
            ignoreSmallMeshes: false
        };
        let userOptions = data.options;
        if (userOptions) {
            if (userOptions.compareAgainstBase != undefined)
                options.compareAgainstBase = userOptions.compareAgainstBase;
            if (userOptions.ignoreSmallMeshes != undefined)
                options.ignoreSmallMeshes = userOptions.ignoreSmallMeshes;
        }
        let filepath = path_1.default.join(file.path, file.name);
        if (!fs.existsSync(filepath))
            return undefined;
        try {
            return RegionMapCalulations_1.RMAPUtils.checkFile(filepath, types, options);
        }
        catch (error) {
            console.log(error);
        }
        return undefined;
    }
}
exports.ToolRMapWorkerUtils = ToolRMapWorkerUtils;
