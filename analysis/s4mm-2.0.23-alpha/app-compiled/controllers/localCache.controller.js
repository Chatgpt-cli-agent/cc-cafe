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
exports.LocalCacheController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const DBPFReader_1 = require("../sims/DBPFReader");
const ThumbnailCache_1 = require("../sims/ThumbnailCache");
class LocalCacheController {
    constructor(main) {
        this.loadedCacheData = null;
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle('local-thumb-cache', async (event, data) => {
            switch (data.action) {
                case 'get-cache-data': {
                    let obj = await this.getCacheData();
                    obj.sims = Array.from(obj.sims.values());
                    obj.houseHolds = Array.from(obj.houseHolds.values());
                    return obj;
                }
                default:
                    throw new Error("Action not recognized: " + data.action);
            }
        });
    }
    async getCacheData() {
        const localThumCacheFile = path_1.default.join(this.mainApp.settings.s_game_documents, "localthumbcache.package");
        if (this.loadedCacheData) {
            // Check if the cache file has been updated
            if (fs.existsSync(localThumCacheFile)) {
                const stats = fs.statSync(localThumCacheFile);
                const mtimems = Math.floor(stats.mtimeMs);
                if (this.loadedCacheData.mtimems !== mtimems) {
                    console.log("Cache file is outdated. Reloading cache data.");
                    await this.loadCacheData();
                }
            }
            else {
                console.warn("Cache file does not exist. Returning loaded cache data.");
            }
        }
        else {
            // Load cache data for the first time
            await this.loadCacheData();
        }
        return this.loadedCacheData;
    }
    async loadCacheData(exportBiggestThumbnails = true) {
        if (!this.mainApp.settings.s_game_documents)
            throw new Error("Game documents path not set in settings.");
        if (!fs.existsSync(this.mainApp.settings.s_game_documents))
            throw new Error("Game documents path does not exist: " + this.mainApp.settings.s_game_documents);
        let localThumCacheFile = path_1.default.join(this.mainApp.settings.s_game_documents, "localthumbcache.package");
        if (!fs.existsSync(localThumCacheFile))
            throw new Error("Local thumb cache file does not exist: " + localThumCacheFile);
        //Read file
        let pack = new DBPFReader_1.Pack(localThumCacheFile);
        pack.checkFile();
        pack.calculateIndexList();
        if (pack.error)
            throw new Error("Error reading local thumb cache package file: " + localThumCacheFile);
        //Get TMCT 0xB93A9915 entry
        let tmctEntry = pack.getEntryIfExists(0xB93A9915, undefined, undefined);
        if (!tmctEntry)
            throw new Error("No TMCT entry found in local thumb cache package file: " + localThumCacheFile);
        let tcr = new ThumbnailCache_1.ThumbnailCacheResource(tmctEntry.getByteArray());
        //Get File stats
        let stats = fs.statSync(localThumCacheFile);
        let mtimems = Math.floor(stats.mtimeMs);
        //Prepare cache data
        let cacheData = {
            mtimems: mtimems,
            path: localThumCacheFile,
            tcr: tcr,
            houseHolds: new Map(),
            sims: new Map()
        };
        //Process thumbnails
        for (let thumb of tcr.thumbnails) {
            if (!thumb.data)
                continue;
            let data = thumb.data;
            let size = thumb.size;
            let key = thumb.resourceKey.getKey();
            if (data instanceof ThumbnailCache_1.ThumbnailSimHousehold) {
                let familyID = data.familyID;
                let hhData = cacheData.houseHolds.get(familyID);
                if (!hhData) {
                    hhData = {
                        id: familyID,
                        thumbnails: []
                    };
                    cacheData.houseHolds.set(familyID, hhData);
                }
                hhData.thumbnails.push({
                    key: key,
                    size: size,
                    thumbnail: thumb
                });
                //Check for biggest
                if (!hhData.biggest) {
                    hhData.biggest = key;
                }
                else {
                    let currentBiggestThumb = hhData.thumbnails.sort((a, b) => b.size - a.size)[0];
                    hhData.biggest = currentBiggestThumb.key;
                }
                cacheData.houseHolds.set(familyID, hhData);
            }
            else if (data instanceof ThumbnailCache_1.ThumbnailDataSim) {
                let simID = data.simID;
                let simData = cacheData.sims.get(simID);
                if (!simData) {
                    simData = {
                        id: simID,
                        thumbnails: []
                    };
                    cacheData.sims.set(simID, simData);
                }
                simData.thumbnails.push({
                    key: key,
                    size: size,
                    thumbnail: thumb
                });
                //Check for biggest
                if (!simData.biggest) {
                    simData.biggest = key;
                }
                else {
                    let currentBiggestThumb = simData.thumbnails.sort((a, b) => b.size - a.size)[0];
                    simData.biggest = currentBiggestThumb.key;
                }
                cacheData.sims.set(simID, simData);
            }
        }
        //Export biggest thumbnails
        if (exportBiggestThumbnails) {
            let exportFolder = this.mainApp.folderStructureController.getFolder("local-thumb-cache");
            await this.exportBiggestThumbnails(exportFolder, cacheData, pack);
        }
        this.loadedCacheData = cacheData;
    }
    async exportBiggestThumbnails(folderPath, cacheData, pack) {
        if (!folderPath || folderPath.trim().length == 0 || !fs.existsSync(folderPath))
            throw new Error("Invalid export folder path: " + folderPath);
        let versionFilePath = path_1.default.join(folderPath, "lastMTimeMs.txt");
        //Skip if already exported
        if (fs.existsSync(versionFilePath)) {
            let content = fs.readFileSync(versionFilePath, "utf-8");
            let lastMTimeMs = parseFloat(content);
            console.log("Last exported biggest thumbnails mtime ms: ", lastMTimeMs);
            if (!isNaN(lastMTimeMs) && lastMTimeMs == cacheData.mtimems) {
                console.log("Biggest thumbnails already exported and up to date. Skipping export.");
                return;
            }
        }
        //Export households
        for (const hhData of cacheData.houseHolds.values()) {
            if (!hhData.biggest)
                continue;
            let thumbEntry = pack.getEntryIfExistsByKey(hhData.biggest);
            if (!thumbEntry)
                continue;
            let thumbData = thumbEntry.getByteArray();
            let ext = ".png";
            let exportPath = path_1.default.join(folderPath, `household_${hhData.id}${ext}`);
            await DBPFReader_1.PackHandler.saveBufferToFile(exportPath, thumbData, true);
        }
        //Export sims
        for (const simData of cacheData.sims.values()) {
            if (!simData.biggest)
                continue;
            let thumbEntry = pack.getEntryIfExistsByKey(simData.biggest);
            if (!thumbEntry)
                continue;
            let thumbData = thumbEntry.getByteArray();
            let ext = ".png";
            let exportPath = path_1.default.join(folderPath, `sim_${simData.id}${ext}`);
            await DBPFReader_1.PackHandler.saveBufferToFile(exportPath, thumbData, true);
        }
        //Save version text file
        fs.writeFileSync(versionFilePath, cacheData.mtimems.toString(), "utf-8");
    }
    async getRelatedThumbnails(simsIds, householdsIds) {
        await this.getCacheData();
        let result = {
            sims: [],
            households: []
        };
        let folder = this.mainApp.folderStructureController.getFolder("local-thumb-cache");
        //Sims
        for (let simId of simsIds) {
            let fileName = `sim_${simId}.png`;
            let filePath = path_1.default.join(folder, fileName);
            if (fs.existsSync(filePath)) {
                result.sims.push({
                    simId: simId,
                    image: filePath
                });
            }
        }
        //Households
        for (let hhId of householdsIds) {
            let fileName = `household_${hhId}.png`;
            let filePath = path_1.default.join(folder, fileName);
            if (fs.existsSync(filePath)) {
                result.households.push({
                    householdId: hhId,
                    image: filePath
                });
            }
        }
        return result;
    }
}
exports.LocalCacheController = LocalCacheController;
