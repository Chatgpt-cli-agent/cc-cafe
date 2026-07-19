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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveFileController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importStar(require("path"));
const DBPFReader_1 = require("../sims/DBPFReader");
const SaveDataReader_1 = require("../sims/SaveDataReader");
class SaveFileController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("save-files", async (event, data) => {
            switch (data.action) {
                case "get-all-files":
                    return await this.getAllSaveFiles();
                case "get-sims-and-households":
                    if (!data.filePath || data.filePath.trim().length === 0)
                        throw new Error("No file path provided");
                    return await this.getSimsAndHouseholdsInSave(data.filePath);
                case "get-combined-data":
                    if (!data.filePath || data.filePath.trim().length === 0)
                        throw new Error("No file path provided");
                    return await this.getSaveFileImportantData(data.filePath);
                case "check-casp-instance-source":
                    if (!data.instanceIds || !Array.isArray(data.instanceIds) || data.instanceIds.length === 0)
                        throw new Error("No instance ids provided");
                    return await this.checkCASPInstanceSource(data.instanceIds);
                case "get-sim-thumbnails":
                    if ((!data.simsIds || !Array.isArray(data.simsIds)) && (!data.householdsIds || !Array.isArray(data.householdsIds)))
                        throw new Error("No sims or households ids provided");
                    return await this.getSaveRelatedThumbnails(data.simsIds, data.householdsIds);
                case "read-zone-data":
                    if (!data.filePath || data.filePath.trim().length === 0)
                        throw new Error("No file path provided");
                    if (!data.zoneId || data.zoneId.trim().length === 0)
                        throw new Error("No zone id provided");
                    return await this.readZoneData(data.filePath, data.zoneId, data.fetchFiles);
                case "mods-by-inos":
                    if (!data.inos || !Array.isArray(data.inos) || data.inos.length === 0)
                        throw new Error("No inos provided");
                    return await this.getModsByInos(data.inos);
            }
            throw new Error("Unknown action");
        });
    }
    async getAllSaveFiles() {
        let time = Date.now();
        let saveFiles = [];
        let documentsPath = this.mainApp.settings.s_game_documents;
        if (!documentsPath || documentsPath.trim().length === 0)
            throw new Error("Game documents path is not set in settings.");
        let saveFolder = path_1.default.join(documentsPath, "saves");
        if (!fs.existsSync(saveFolder))
            throw new Error("Save folder does not exist: " + saveFolder);
        let files = await fs.readdirSync(saveFolder);
        let saveFilesList = files.filter(f => f.toLowerCase().endsWith(".save"));
        //Old Versions
        let oldVersionFilesList = files.filter(f => f.toLowerCase().includes(".save.ver"));
        let oldVersionMap = new Map();
        for (let index = 0; index < oldVersionFilesList.length; index++) {
            const element = oldVersionFilesList[index];
            let base = element.split(".save.ver")[0];
            if (!oldVersionMap.has(base))
                oldVersionMap.set(base, []);
            oldVersionMap.get(base)?.push(element);
        }
        //Get base files
        for (let index = 0; index < saveFilesList.length; index++) {
            const element = saveFilesList[index];
            let saveInfo = await this.getSaveFileInfo(path_1.default.join(saveFolder, element));
            if (saveInfo) {
                saveFiles.push(saveInfo);
            }
        }
        saveFiles.sort((a, b) => b.lastModified - a.lastModified);
        //Extend files with old versions
        for (let index = 0; index < saveFiles.length; index++) {
            const element = saveFiles[index];
            element.files = [];
            //Add primary file
            element.files.push({
                name: element.fileName,
                path: element.filePath,
                lastModified: element.lastModified,
                isPrimary: true,
                size: element.size,
            });
            if (oldVersionMap.has(element.fileName.split(".save")[0])) {
                let oldVersions = oldVersionMap.get(element.fileName.split(".save")[0]) || [];
                for (let v = 0; v < oldVersions.length; v++) {
                    const oldFile = oldVersions[v];
                    let oldFilePath = path_1.default.join(saveFolder, oldFile);
                    if (fs.existsSync(oldFilePath)) {
                        let stats = fs.statSync(oldFilePath);
                        element.files.push({
                            name: oldFile,
                            path: oldFilePath,
                            lastModified: Math.floor(stats.mtimeMs),
                            isPrimary: false,
                            size: stats.size,
                        });
                    }
                }
            }
        }
        console.log("[SAVEFILECONTROLLER] Total time to get all save files: ", Date.now() - time);
        return saveFiles;
    }
    async getSaveFileInfo(filePath) {
        if (!filePath || !fs.existsSync(filePath))
            return null;
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        try {
            let filename = (0, path_1.basename)(filePath);
            let saveFolder = path_1.default.dirname(filePath);
            let stats = fs.statSync(filePath);
            let lastModified = Math.floor(stats.mtimeMs);
            let slotnumber = parseInt(filename.split("_")[1], 16);
            //Thumbnail
            let saveFile = new DBPFReader_1.SaveFile(filePath);
            let thumbnail = null;
            saveFile.checkFile();
            saveFile.calculateIndexList();
            if (!saveFile.error) {
                thumbnail = await saveFile.exportSaveSlotThumnails(tmpFolder, slotnumber);
                if (!thumbnail || thumbnail.length === 0)
                    thumbnail = null;
            }
            //Slot name
            let saveGameData = saveFile.index_List.find((entry) => entry.r_type === 0x0D);
            let slotName = null;
            if (saveGameData) {
                let buffer = saveGameData.getByteArray();
                slotName = SaveDataReader_1.SaveDataReader.getSaveSlotNameFromBuffer(buffer);
            }
            return {
                fileName: filename,
                name: slotName,
                saveFolder: saveFolder,
                lastModified: lastModified,
                filePath: filePath,
                slotNumber: slotnumber,
                thumbnail: thumbnail,
                size: stats.size
            };
        }
        catch (error) {
            console.error("Error reading save file info: ", filePath, error);
            return null;
        }
    }
    async getSimsAndHouseholdsInSave(filePath) {
        if (!filePath || !fs.existsSync(filePath))
            return null;
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        let extractFolder = path_1.default.join(tmpFolder, "extract_" + Date.now());
        if (!fs.existsSync(extractFolder))
            fs.mkdirSync(extractFolder);
        try {
            console.log("Extracting save file for sims and households: ", filePath);
            let dataObject = SaveDataReader_1.SaveDataReader.getSaveDataObject(filePath);
            let simsData = dataObject.sims;
            let householdsData = dataObject.households;
            //Clean up
            fs.rmSync(extractFolder, { recursive: true, force: true });
            return { sims: simsData, households: householdsData };
        }
        catch (error) {
            console.error("Error extracting save file: ", filePath, error);
            return null;
        }
    }
    async getSaveFileImportantData(filePath, checkForThumbnails = true) {
        if (!filePath || !fs.existsSync(filePath))
            return null;
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        let zoneThumbnails = new Map();
        try {
            let pack = new DBPFReader_1.Pack(filePath);
            pack.checkFile();
            pack.calculateIndexList();
            if (pack.error)
                throw new Error("Error reading save file pack.");
            let zoneThumbnailsEntries = pack.index_List.filter(entry => entry.r_type === 0x0F);
            for (let i = 0; i < zoneThumbnailsEntries.length; i++) {
                const entry = zoneThumbnailsEntries[i];
                let buffer = entry.getByteArray();
                let instanceId = entry.r_instance.toString(16).padStart(16, '0');
                //Export thumbnail
                let filename = `zone_thumbnail_${instanceId}.png`;
                let thumbnailPath = path_1.default.join(tmpFolder, filename);
                await DBPFReader_1.PackHandler.saveBufferToFile(thumbnailPath, buffer, true);
                zoneThumbnails.set(instanceId, thumbnailPath);
            }
        }
        catch (err) {
            console.error("Error preparing to extract zone thumbnails: ", err);
        }
        try {
            console.log("Extracting save file for sims and households: ", filePath);
            //Get Primitive Data
            let dataObject = SaveDataReader_1.SaveDataReader.getSaveDataObject(filePath);
            let sims = dataObject.sims;
            let households = dataObject.households;
            let save_slot = dataObject.saveSlot;
            let zones = dataObject.zones;
            let neighborhoods = dataObject.neighborhoods;
            zones.forEach((zone) => {
                let instanceId = zone.zoneId;
                if (zoneThumbnails.has(instanceId)) {
                    zone.thumbnail = zoneThumbnails.get(instanceId);
                }
            });
            return { sims: sims, households: households, saveSlot: save_slot, zones: zones, neighborhoods: neighborhoods };
        }
        catch (error) {
            console.error("Error extracting save file: ", filePath, error);
            return null;
        }
    }
    async checkCASPInstanceSource(instanceIds) {
        if (!instanceIds || !Array.isArray(instanceIds) || instanceIds.length === 0)
            throw new Error("No instance ids provided");
        console.log("[SAVEFILECONTROLLER] Checking CASP instance source for ", instanceIds.length, " ids.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        //CASP 0x034AEECB
        let time = Date.now();
        let idsSet = new Set(instanceIds);
        //Check in Mods
        const BATCH_SIZE = 1000;
        let fromMods = [];
        let fromGame = [];
        let modInos = new Set();
        for (let i = 0; i < instanceIds.length; i += BATCH_SIZE) {
            const batch = instanceIds.slice(i, i + BATCH_SIZE);
            const batchResults = await knex
                .from("Entries")
                .select(knex.raw("instancehex as instance"), knex.raw("CAST(ino as TEXT) as ino"))
                .where("type", 0x034AEECB)
                .whereIn("instancehex", batch);
            fromMods = fromMods.concat(batchResults);
            //Remove found ids from set
            batchResults.forEach((r) => {
                idsSet.delete(r.instancehex);
                modInos.add(r.ino);
            });
        }
        //Check in Game files for remaining ids
        let remainingIds = Array.from(idsSet);
        for (let i = 0; i < remainingIds.length; i += BATCH_SIZE) {
            const batch = remainingIds.slice(i, i + BATCH_SIZE);
            const batchResults = await knex
                .from("GameIds")
                .select("instance", knex.raw("CAST(ino as TEXT) as ino"))
                .where("type", 0x034AEECB)
                .whereIn("instance", batch);
            fromGame = fromGame.concat(batchResults);
            //Remove found ids from set
            batchResults.forEach((r) => idsSet.delete(r.instancehex));
        }
        //Get Files for INOs from Mods
        let modFiles = [];
        console.log("[SAVEFILECONTROLLER] Mod INOs to fetch files for: ", modInos.size);
        if (modInos.size > 0) {
            let inosArr = Array.from(modInos);
            for (let i = 0; i < inosArr.length; i += BATCH_SIZE) {
                const batch = inosArr.slice(i, i + BATCH_SIZE);
                let selectionArray = [knex.raw('CAST(Files.ino AS TEXT) AS ino')];
                let defaultSelection = ["Files.mfolder", "Files.path", "Files.name", "Files.image", "Files.categories", "Files.merged", "Files.recolor", "Files.mtime", "Files.size", "Files.major", "Files.minor", "Files.type", "Files.fingerprint"];
                selectionArray.push(...defaultSelection);
                const batchResults = await knex.from("Files").select(selectionArray).whereIn("ino", batch);
                modFiles = modFiles.concat(batchResults);
            }
        }
        return { fromGame: fromGame, fromMods: fromMods, notFound: Array.from(idsSet), timeTaken: Date.now() - time, modFiles: modFiles };
        //console.log("Found CASP INOs: ", results);
    }
    async checkCOBJInstanceSource(instanceIds) {
        if (!instanceIds || !Array.isArray(instanceIds) || instanceIds.length === 0)
            throw new Error("No instance ids provided");
        console.log("[SAVEFILECONTROLLER] Checking COBJ instance source for ", instanceIds.length, " ids.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        //COBJ  0x319E4F1D
        let time = Date.now();
        let idsSet = new Set(instanceIds);
        const BATCH_SIZE = 1000;
        let fromMods = [];
        let fromGame = [];
        for (let i = 0; i < instanceIds.length; i += BATCH_SIZE) {
            const batch = instanceIds.slice(i, i + BATCH_SIZE);
            const batchResults = await knex
                .from("Entries")
                .select(knex.raw("instancehex as instance"), knex.raw("CAST(ino as TEXT) as ino"))
                .where("type", 0x319E4F1D)
                .whereIn("instancehex", batch);
            fromMods = fromMods.concat(batchResults);
            //Remove found ids from set
            batchResults.forEach((r) => idsSet.delete(r.instancehex));
        }
        //Check in Game files for remaining ids
        let remainingIds = Array.from(idsSet);
        for (let i = 0; i < remainingIds.length; i += BATCH_SIZE) {
            const batch = remainingIds.slice(i, i + BATCH_SIZE);
            const batchResults = await knex
                .from("GameIds")
                .select("instance")
                .where("type", 0x319E4F1D)
                .whereIn("instance", batch);
            fromGame = fromGame.concat(batchResults);
            //Remove found ids from set
            batchResults.forEach((r) => idsSet.delete(r.instancehex));
        }
        return { fromGame: fromGame, fromMods: fromMods, notFound: Array.from(idsSet), timeTaken: Date.now() - time };
    }
    async getSaveRelatedThumbnails(simsIds, householdsIds) {
        console.log("[SAVEFILECONTROLLER] Getting thumbnails for ", simsIds?.length, " sims and ", householdsIds?.length, " households.");
        return await this.mainApp.localCacheController.getRelatedThumbnails(simsIds, householdsIds);
    }
    async readZoneData(filePath, zoneId, fetchFiles = false) {
        if (!filePath || !fs.existsSync(filePath))
            throw new Error("File path does not exist: " + filePath);
        let save = new DBPFReader_1.SaveFile(filePath);
        save.checkFile();
        save.calculateIndexList();
        if (save.error)
            throw new Error("Error reading save file.");
        let zoneObject = save.getZoneObjByInstance(zoneId);
        if (!zoneObject)
            throw new Error("Zone with id " + zoneId + " not found in save file.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized.");
        let instanceIds = [];
        zoneObject.items.forEach(item => {
            let guid = item.guid;
            if (guid)
                instanceIds.push(guid);
        });
        let filesData = await this.checkCOBJInstanceSource(instanceIds);
        let files = [];
        if (filesData && filesData.fromMods && fetchFiles) {
            //Fetch files data
            let inoSet = new Set();
            filesData.fromMods.forEach((entry) => {
                inoSet.add(entry.ino);
            });
            let inoArray = Array.from(inoSet);
            const BATCH_SIZE = 1000;
            for (let i = 0; i < inoArray.length; i += BATCH_SIZE) {
                const batch = inoArray.slice(i, i + BATCH_SIZE);
                let selectionArray = [knex.raw('CAST(Files.ino AS TEXT) AS ino')];
                let defaultSelection = ["Files.mfolder", "Files.path", "Files.name", "Files.image", "Files.categories", "Files.merged", "Files.recolor", "Files.mtime", "Files.size", "Files.major", "Files.minor", "Files.type", "Files.fingerprint"];
                selectionArray.push(...defaultSelection);
                const batchResults = await knex.from("Files").select(selectionArray).whereIn("ino", batch);
                files = files.concat(batchResults);
            }
        }
        return {
            ...filesData,
            zoneId: zoneId,
            mods: files
        };
    }
    async getModsByInos(inos) {
        if (!inos || !Array.isArray(inos) || inos.length === 0)
            throw new Error("No inos provided.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized.");
        let files = [];
        const BATCH_SIZE = 1000;
        for (let i = 0; i < inos.length; i += BATCH_SIZE) {
            const batch = inos.slice(i, i + BATCH_SIZE);
            let selectionArray = [knex.raw('CAST(Files.ino AS TEXT) AS ino')];
            let defaultSelection = ["Files.mfolder", "Files.path", "Files.name", "Files.image", "Files.categories", "Files.merged", "Files.recolor", "Files.mtime", "Files.size", "Files.major", "Files.minor", "Files.type", "Files.fingerprint"];
            selectionArray.push(...defaultSelection);
            const batchResults = await knex.from("Files").select(selectionArray).whereIn("ino", batch);
            files = files.concat(batchResults);
        }
        return files;
    }
}
exports.SaveFileController = SaveFileController;
