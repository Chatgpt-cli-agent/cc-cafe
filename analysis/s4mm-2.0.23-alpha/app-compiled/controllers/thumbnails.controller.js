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
exports.ThumbnailsController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const WorkerQueue_1 = require("../utils/WorkerQueue");
const IPCExtras_1 = require("../utils/IPCExtras");
const DBPFReader_1 = require("../sims/DBPFReader");
class ThumbnailsController {
    constructor(main) {
        //Instance Mao
        this.instanceThumbnailMap = new Map();
        this.instanceThumbnailMapCreatedAt = 0;
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("thumbnails", async (event, data) => {
            switch (data.action) {
                case "create-instance-map":
                    return this.createInstanceThumbnailMap();
                case "get-instance-thumbnail":
                    return this.getInstanceThumbnail(data.instance, data.ino);
                default:
                    throw new Error("No valid action or parameters");
            }
        });
        electron_1.ipcMain.on("MassThumbnails", (event, data) => {
            if (data.action == "export-for-screenshot") {
                this.exportWithLoading(data.files, data.channel, event, data.returnInfo, data.s4documents, data.options);
            }
            else if (data.action == "reload-all-thumbnails" && data.channel) {
                this.reloadAllThubnails(data.channel, event);
            }
        });
        electron_1.ipcMain.handle("MassThumbnails", async (event, data) => {
            let result = undefined;
            if (data.action == "get-screenshot-relevant-files") {
                try {
                    return await this.getRelevantFilesForScreenshotTool();
                }
                catch (error) {
                    throw new Error("Failed");
                }
            }
            else if (data.action = "reset-thumbnails-db") {
                try {
                    let knex = this.mainApp.databaseController.getKnex();
                    await knex.from('Thumbnails').truncate();
                    return { sucsess: true };
                }
                catch (error) {
                    throw new Error("Failed");
                }
            }
            throw new Error("No action");
        });
    }
    async createInstanceThumbnailMap() {
        let time = Date.now();
        //Check if last is older than 5 minutes
        if (time - this.instanceThumbnailMapCreatedAt < 5 * 60 * 1000) {
            console.log(`[ThumbnailsController] Instance Thumbnail Map already created, skipping creation.`);
            return;
        }
        //CAS  Thumbnail - 0x3C1AF1F2
        //COBJ Thumbnail - 0x3C2A8647
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        this.instanceThumbnailMap.clear();
        this.instanceThumbnailMapCreatedAt = Date.now();
        await this.addInstanceThumbnailByFiles(knex);
        await this.addInstanceThumbnailByCache();
        console.log(`[ThumbnailsController] Instance Thumbnail Map created in ${Date.now() - time}ms`);
    }
    async addInstanceThumbnailByFiles(knex) {
        let combinedEntriesAndFiles = await knex("Entries")
            .innerJoin("Files", "Entries.ino", "Files.ino")
            .where("Entries.type", 0x3C1AF1F2)
            .orWhere("Entries.type", 0x3C2A8647)
            .select([
            knex.raw("CAST(Entries.ino AS TEXT) as ino"),
            "Entries.address",
            "Files.name",
            "Files.path",
        ]);
        combinedEntriesAndFiles.forEach((entry) => {
            let instance = entry.address.split("-")[2];
            let filepath = path_1.default.join(entry.path, entry.name);
            let address = entry.address;
            let ino = entry.ino;
            this.addToInstanceThumbnailMap(instance, filepath, address, ino);
        });
    }
    async addInstanceThumbnailByCache() {
        let gameFolderDoucuments = this.mainApp.settings.s_game_documents;
        if (!gameFolderDoucuments || !fs.existsSync(gameFolderDoucuments)) {
            return;
        }
        let localCacheFile = path_1.default.join(gameFolderDoucuments, "localthumbcache.package");
        if (!fs.existsSync(localCacheFile)) {
            return;
        }
        try {
            let pack = new DBPFReader_1.Pack(localCacheFile);
            pack.checkFile();
            if (pack.error)
                throw new Error(`Error while reading local cache file: ${pack.error}`);
            pack.calculateIndexList();
            pack.index_List.forEach((index) => {
                if (index.r_type !== 0x3C1AF1F2 && index.r_type !== 0x3C2A8647)
                    return;
                let address = index.getKey();
                let instance = index.getInstanceString();
                this.addToInstanceThumbnailMap(instance, localCacheFile, address, "cache");
            });
        }
        catch (error) {
            console.error(`[ThumbnailsController] Error while reading local cache file: ${error}`);
            return;
        }
    }
    addToInstanceThumbnailMap(instance, filepath, address, ino) {
        if (!this.instanceThumbnailMap.has(instance)) {
            this.instanceThumbnailMap.set(instance, []);
        }
        let locationInfo = {
            address: address,
            filepath: filepath,
            instance: instance,
            ino: ino
        };
        this.instanceThumbnailMap.get(instance)?.push(locationInfo);
    }
    //Thumbails
    async getInstanceThumbnail(instance, ino) {
        if (!this.instanceThumbnailMap.has(instance)) {
            return { found: false, withIno: false };
        }
        let locations = this.instanceThumbnailMap.get(instance);
        if (!locations || locations.length === 0) {
            return { found: false, withIno: false };
        }
        let locationIndex = 0;
        for (let index = 0; index < locations.length; index++) {
            const element = locations[index];
            if (element.ino == ino) {
                locationIndex = index;
                break;
            }
        }
        let location = locations[locationIndex];
        let withIno = location.ino == ino;
        let filepath = location.filepath;
        let address = location.address;
        let imageIno = location.ino;
        let imageName = `${address.replace(/-/g, "_")}_${imageIno}.png`;
        let thumbnailsFolder = this.mainApp.folderStructureController.getFolder("thumbnails");
        if (!thumbnailsFolder) {
            throw new Error("Thumbnails folder not found");
        }
        let thumbnailPath = path_1.default.join(thumbnailsFolder, imageName);
        //Exists thumbnail?
        if (fs.existsSync(thumbnailPath)) {
            return { found: true, withIno: withIno, image: thumbnailPath };
        }
        //Check in file
        if (!fs.existsSync(filepath)) {
            return { found: false, withIno: withIno };
        }
        try {
            let pack = new DBPFReader_1.Pack(filepath);
            pack.checkFile();
            if (pack.error)
                throw new Error(`Error while reading pack file: ${pack.error}`);
            pack.calculateIndexList();
            let indexEnty = pack.getEntryIfExistsByKey(address);
            if (!indexEnty) {
                return { found: false, withIno: withIno };
            }
            await DBPFReader_1.PackHandler.saveBufferToFile(thumbnailPath, indexEnty.getByteArray(), false);
            if (fs.existsSync(thumbnailPath)) {
                return { found: true, withIno: withIno, image: thumbnailPath };
            }
            else {
                return { found: false, withIno: withIno };
            }
        }
        catch (error) {
            return { found: false, withIno: withIno };
        }
    }
    //Mass Thumbnails
    async getRelevantFilesForScreenshotTool() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        return await knex.from('Files')
            .join(knex.from('Entries')
            .leftJoin('Thumbnails', 'Entries.instancehex', 'Thumbnails.instance')
            .distinct('Entries.ino')
            .where((qb) => {
            qb.where('Entries.type', 1008398834); // CAS
            //qb.orWhere('Entries.type',1009419847); //COBJ
        })
            .whereNull('Thumbnails.instance')
            .as('filteredEntries'), 'Files.ino', 'filteredEntries.ino')
            .select(["Files.path", "Files.name", knex.raw("CAST(Files.ino AS TEXT) as ino")]);
    }
    async exportWithLoading(files, loadingChannel, event, returnInfo, s4documents, options) {
        delete options.overlayOn;
        delete options.hotkeys;
        delete options.timeLogs;
        delete options.saveScreenshot;
        delete options.saveProcessed;
        let tasks = [];
        for (let index = 0; index < files.length; index++) {
            const element = files[index];
            tasks.push({
                action: "exportAllThumbnails",
                data: {
                    item: element,
                    folder: this.mainApp.folderStructureController.getFolder("thumbnails"),
                    isCache: false,
                    needHash: true,
                    options: options
                }
            });
        }
        if (s4documents && s4documents.length > 0) {
            let cacheFile = path_1.default.join(s4documents, "localthumbcache.package");
            if (fs.existsSync(cacheFile)) {
                let task = {
                    action: "exportAllThumbnails",
                    data: {
                        item: {
                            name: "localthumbcache.package",
                            path: s4documents,
                            ino: 0
                        },
                        folder: this.mainApp.folderStructureController.getFolder("thumbnails"),
                        isCache: true,
                        needHash: true,
                        options: options
                    }
                };
                tasks.push(task);
            }
        }
        let workerQ = new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {}, (progress) => {
            IPCExtras_1.IPCExtras.send(event, loadingChannel, { value: (progress.index + 1), max: progress.max, title: "Exporting thumbnails", close: false });
        }, (results) => {
            IPCExtras_1.IPCExtras.send(event, loadingChannel, { close: true });
            console.log("Export Done");
            this.saveExportResultsToDatabase(results, event, returnInfo);
        });
    }
    async saveExportResultsToDatabase(files, event, returnInfo) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        let itemsMap = new Map();
        for (let index = 0; index < files.length; index++) {
            const r = files[index];
            if (!r.data || !r.data)
                continue;
            for (let u = 0; u < r.data.length; u++) {
                const element = r.data[u];
                if (element.db) {
                    let key = element.db.ino + "-" + element.db.instance;
                    element.db.iik = key;
                    itemsMap.set(key, element.db);
                }
            }
        }
        let items = Array.from(itemsMap.values());
        this.insertThumbnails(knex, items, 500)
            .then(() => {
            if (returnInfo) {
                IPCExtras_1.IPCExtras.send(event, returnInfo.channel, {
                    action: returnInfo.action
                });
            }
        })
            .catch((error) => {
            console.error('Error inserting data:', error);
            IPCExtras_1.IPCExtras.send(event, "toast", {
                msg: error,
                duration: 5000
            });
        });
    }
    async reloadAllThubnails(loadingChannel, event) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        let tasks = [];
        let files = [];
        try {
            files = await knex.from("Files").select([knex.raw("CAST(ino as Text) as ino"), "path", "name", "image", "image_source"]);
            for (let index = 0; index < files.length; index++) {
                const element = files[index];
                tasks.push({
                    action: "checkAndReloadThumbnail",
                    data: {
                        item: element
                    }
                });
            }
        }
        catch (error) {
            console.log(error);
            IPCExtras_1.IPCExtras.send(event, loadingChannel, { close: true });
            IPCExtras_1.IPCExtras.send(event, "toast", { "msg": "FAILED TO COMPLETE ACTION", "duration": 2000 });
            return;
        }
        let workerQ = new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {}, (progress) => {
            IPCExtras_1.IPCExtras.send(event, loadingChannel, { value: (progress.index + 1), max: progress.max, title: "Exporting thumbnails", close: false });
        }, async (results) => {
            let chunkSize = 500;
            //console.log(JSON.stringify(results[0]));
            let items = results.filter((element) => (element.data !== undefined));
            try {
                await knex.transaction(async (trx) => {
                    for (let i = 0; i < items.length; i += chunkSize) {
                        const chunk = items.slice(i, i + chunkSize);
                        const queries = chunk.map((item) => {
                            return knex.from('Files')
                                .where('ino', item.data.ino)
                                .update({
                                image: item.data.image,
                                image_source: item.data.image_source
                            })
                                .transacting(trx);
                        });
                        await Promise.all(queries);
                        console.log("Chunk " + i);
                    }
                });
            }
            catch (error) {
                console.log(error);
                IPCExtras_1.IPCExtras.send(event, "toast", { "msg": "FAILED TO COMPLETE ACTION", "duration": 2000 });
                IPCExtras_1.IPCExtras.send(event, loadingChannel, { close: true });
                return;
            }
            IPCExtras_1.IPCExtras.send(event, loadingChannel, { close: true });
            console.log("Export Done");
        });
    }
    async insertThumbnails(knex, thumbnails, chunkSize) {
        await knex.transaction(async (trx) => {
            for (let i = 0; i < thumbnails.length; i += chunkSize) {
                const chunk = thumbnails.slice(i, i + chunkSize);
                await trx('Thumbnails')
                    .insert(chunk)
                    .onConflict('iik')
                    .merge();
            }
        });
    }
}
exports.ThumbnailsController = ThumbnailsController;
