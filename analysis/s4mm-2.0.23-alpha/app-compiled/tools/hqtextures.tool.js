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
exports.ToolHQTexturesWorkerUtils = exports.ToolHQTextures = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const WorkerQueue_1 = require("../utils/WorkerQueue");
const DBPFReader_1 = require("../sims/DBPFReader");
class ToolHQTextures {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-hq-textures", async (event, data) => {
            switch (data.action) {
                case "get-files-by-types":
                    return await this.getFilesByType(data.types);
                default:
                    throw new Error("Unknown action: " + data.action);
            }
        });
    }
    async getFilesByType(types) {
        if (!types || !Array.isArray(types) || types.length === 0) {
            throw new Error("Invalid types array provided.");
        }
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not available.");
        //Get Files
        let files = await knex("Files")
            .join("Entries", "Files.ino", "=", "Entries.ino")
            .whereIn("Entries.type", types)
            .distinct(knex.raw("CAST(Files.ino as TEXT) as ino"))
            .select([
            knex.raw("CAST(Files.ino as TEXT) as ino"),
            "Files.name",
            "Files.path",
            "Files.image"
        ]);
        //Prepere tasks for worker threads
        let tasks = files.map((file) => {
            return {
                action: "get-hq-texture-info",
                data: {
                    ino: file.ino,
                    name: file.name,
                    path: file.path,
                    image: file.image
                }
            };
        });
        //Extend files 
        let workerPromise = new Promise((resolve, reject) => {
            new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {
                types: types
            }, async (progress) => {
                //Progress callback
            }, async (results) => {
                resolve(results.filter((item) => item && item.data && item.data.textures).map((item) => {
                    //console.log("Processed item:", item);
                    return {
                        ino: item.data.ino,
                        textures: item.data.textures,
                        name: item.task.data.name,
                        path: item.task.data.path,
                        image: item.task.data.image
                    };
                }));
            });
        });
        //Wait for worker results
        return await workerPromise;
    }
}
exports.ToolHQTextures = ToolHQTextures;
class ToolHQTexturesWorkerUtils {
    static getHQTextureInfo(data, sharedData) {
        let types = sharedData.types;
        if (!types || !Array.isArray(types) || types.length === 0) {
            throw new Error("Invalid types array provided in shared data.");
        }
        if (!data || !data.ino || !data.name || !data.path) {
            throw new Error("Invalid data provided for HQ texture info.");
        }
        let filepath = path_1.default.join(data.path, data.name);
        if (!fs.existsSync(filepath)) {
            throw new Error("File does not exist: " + filepath);
        }
        let pack = new DBPFReader_1.Pack(filepath);
        pack.checkFile();
        if (pack.error) {
            throw new Error("Error reading file: " + pack.error);
        }
        pack.calculateIndexList();
        let entries = pack.index_List;
        let textures = [];
        for (let entry of entries) {
            switch (entry.r_type) {
                case 0x00B2D882: // _IMG
                    if (!types.includes(entry.r_type))
                        continue; // Skip if type not in requested types
                    let texture = this.readIMGTexture(entry);
                    if (texture)
                        textures.push(texture);
                    break;
                case 0x2BC04EDF: //LRLE
                    if (!types.includes(entry.r_type))
                        continue; // Skip if type not in requested types
                    let lrleTexture = this.readLRLETexture(entry);
                    if (lrleTexture)
                        textures.push(lrleTexture);
                    break;
                case 0x3453CF95: //RLE2
                    if (!types.includes(entry.r_type))
                        continue; // Skip if type not in requested types
                    let rle2Texture = this.readRLE2Texture(entry);
                    if (rle2Texture)
                        textures.push(rle2Texture);
                    break;
                default:
                    continue; // Skip unsupported types
            }
        }
        return {
            ino: data.ino,
            textures: textures
        };
    }
    static readLRLETexture(entry) {
        try {
            let entryData = entry.getByteArray();
            let lrleFile = new DBPFReader_1.LRLEFile(entryData);
            let width = lrleFile.width;
            let height = lrleFile.height;
            if (width && height) {
                return {
                    width: width,
                    height: height,
                    success: true,
                    key: entry.getKey()
                };
            }
            else {
                throw new Error("Invalid LRLE texture dimensions.");
            }
        }
        catch (error) {
            console.error("Error reading LRLE texture:", error);
            return {
                width: null,
                height: null,
                success: false,
                key: entry.getKey()
            };
        }
    }
    static readRLE2Texture(entry) {
        try {
            let entryData = entry.getByteArray();
            let rle2File = new DBPFReader_1.REL2File(entryData);
            let width = rle2File.width;
            let height = rle2File.hight;
            if (width && height) {
                return {
                    width: width,
                    height: height,
                    success: true,
                    key: entry.getKey()
                };
            }
            else {
                throw new Error("Invalid RLE2 texture dimensions.");
            }
        }
        catch (error) {
            console.error("Error reading RLE2 texture:", error);
            return {
                width: null,
                height: null,
                success: false,
                key: entry.getKey()
            };
        }
    }
    static readIMGTexture(entry) {
        return {
            width: null,
            height: null,
            success: false,
            key: entry.getKey()
        };
    }
}
exports.ToolHQTexturesWorkerUtils = ToolHQTexturesWorkerUtils;
