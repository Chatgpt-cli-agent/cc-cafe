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
exports.ToolPolyCountWorkerUtils = exports.ToolPolyCount = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const IPCExtras_1 = require("../utils/IPCExtras");
const WorkerQueue_1 = require("../utils/WorkerQueue");
const DBPFReader_1 = require("../sims/DBPFReader");
class ToolPolyCount {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-polycount", async (event, data) => {
            switch (data.action) {
                case "casp-poly-count":
                    return await this.getCaspPolyCount(data, event);
                case "cobj-poly-count":
                    return await this.getCobjPolyCount(data, event);
                default:
                    throw new Error("Unknown action for polycount tool");
            }
        });
    }
    async getCaspPolyCount(data, event) {
        let { loading } = data;
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, { "value": 0, "max": 1, "title": "Searching for casp files...", "close": false });
        }
        // Find all files that include a casp model
        let files = await knex("Files")
            .join("Entries", "Files.ino", "Entries.ino")
            .select([
            knex.raw("CAST(Files.ino AS TEXT) AS ino"),
            "Files.path",
            "Files.name",
            "Files.image"
        ])
            .where("Entries.type", 22681673)
            .distinct();
        let tasks = files.map((file) => {
            return {
                action: "calc-poly-cas-count",
                data: {
                    ino: file.ino,
                    name: file.name,
                    path: file.path,
                    image: file.image
                }
            };
        });
        let workerPromise = new Promise((resolve, reject) => {
            new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {}, async (progress) => {
                //OnProgress
                if (loading) {
                    IPCExtras_1.IPCExtras.send(event, loading, { close: false, value: progress.index, max: progress.max, title: (progress.index + "/" + progress.max) });
                }
            }, async (results) => {
                resolve(results.filter((item) => item && item.data).map((item) => {
                    return item.data;
                }));
            });
        });
        let items = await workerPromise;
        if (loading)
            IPCExtras_1.IPCExtras.send(event, loading, { "close": true });
        return {
            type: "casp",
            items: items
        };
    }
    async getCobjPolyCount(data, event) {
        let { loading } = data;
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, { "value": 0, "max": 1, "title": "Searching for cobj files...", "close": false });
        }
        // Find all files that include a cobj model
        let files = await knex("Files")
            .join("Entries", "Files.ino", "Entries.ino")
            .select([
            knex.raw("CAST(Files.ino AS TEXT) AS ino"),
            "Files.path",
            "Files.name",
            "Files.image"
        ])
            .where("Entries.type", 0x01661233).orWhere("Entries.type", 0x01d10f34)
            .distinct();
        let tasks = files.map((file) => {
            return {
                action: "calc-poly-cobj-count",
                data: {
                    ino: file.ino,
                    name: file.name,
                    path: file.path,
                    image: file.image
                }
            };
        });
        let workerPromise = new Promise((resolve, reject) => {
            new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {}, async (progress) => {
                //OnProgress
                if (loading) {
                    IPCExtras_1.IPCExtras.send(event, loading, { close: false, value: progress.index, max: progress.max, title: (progress.index + "/" + progress.max) });
                }
            }, async (results) => {
                console.log("Cobj Poly Count Results: ", results);
                resolve(results.filter((item) => item && item.data).map((item) => {
                    return item.data;
                }));
            });
        });
        let items = await workerPromise;
        if (loading)
            IPCExtras_1.IPCExtras.send(event, loading, { "close": true });
        return {
            type: "cobj",
            items: items
        };
    }
}
exports.ToolPolyCount = ToolPolyCount;
class ToolPolyCountWorkerUtils {
    static calcPolyCountForCaspDBElement(data) {
        if (!data || !data.path || !data.name)
            return undefined;
        let file = path_1.default.join(data.path, data.name);
        let r = this.calcPolyCountForCaspFile(file);
        if (r)
            data.geom_casp = r;
        return data;
    }
    static calcPolyCountForCaspFile(file) {
        if (!file || !fs.existsSync(file))
            return undefined;
        try {
            let pack = new DBPFReader_1.Pack(file);
            pack.checkFile();
            if (!pack.error) {
                pack.calculateIndexList();
                pack.calulateCASPFiles();
                let r = pack.calulateGEOMSizeMapFilesCASP();
                if (r)
                    return r;
            }
        }
        catch (err) {
            console.log("Error in: " + file);
            console.log(err);
            console.log("");
        }
        return undefined;
    }
    static calcPolyCountForCobjDBElement(data) {
        if (!data || !data.path || !data.name)
            return undefined;
        let file = path_1.default.join(data.path, data.name);
        let r = this.calcPolyCountForCobjFile(file);
        if (r) {
            let geom_cobj = {
                ma: undefined,
                mi: undefined,
                i: []
            };
            let meshes = r;
            for (let index = 0; index < meshes.length; index++) {
                let mesh = meshes[index];
                let address = mesh.address;
                let meshInfo = mesh.meshInfo;
                let vertexCount = meshInfo.vertex;
                let faceCount = meshInfo.face;
                if (geom_cobj.mi == undefined || faceCount < geom_cobj.mi)
                    geom_cobj.mi = faceCount;
                if (geom_cobj.ma == undefined || faceCount > geom_cobj.ma)
                    geom_cobj.ma = faceCount;
                geom_cobj.i.push({
                    "address": address,
                    "pi": 1,
                    "d": [{ v: vertexCount, f: faceCount, i: address }]
                });
            }
            data.geom_cobj = geom_cobj;
        }
        return data;
    }
    static calcPolyCountForCobjFile(file) {
        if (!file || !fs.existsSync(file))
            return undefined;
        let pack = new DBPFReader_1.Pack(file);
        pack.checkFile();
        if (pack.error)
            return undefined;
        pack.calculateIndexList();
        let cobjModels = pack.index_List.filter((element) => {
            return element.r_type === 0x01661233 || element.r_type === 0x01d10f34;
        });
        let meshesGroups = [];
        for (let index = 0; index < cobjModels.length; index++) {
            const entry = cobjModels[index];
            let grcol = new DBPFReader_1.GenericRCOLFile(entry.getByteArray());
            let o = {
                address: entry.getKey(),
                meshInfo: grcol.getMeshesCounts(),
            };
            if (o.meshInfo && o.meshInfo.vertex > 0)
                meshesGroups.push(o);
        }
        return meshesGroups;
    }
}
exports.ToolPolyCountWorkerUtils = ToolPolyCountWorkerUtils;
