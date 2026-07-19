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
exports.FileLoadingController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const fsPromises = __importStar(require("fs/promises"));
const WorkerQueue_1 = require("../utils/WorkerQueue");
const IPCExtras_1 = require("../utils/IPCExtras");
const folder_util_1 = require("../utils/folder.util");
class FileLoadingController {
    constructor(main) {
        // Prepared files
        this.filesInfo = undefined;
        this.databaseFilesMap = new Map();
        this.databaseFilesTimestamp = 0;
        this.databaseFiledScannedSet = new Set();
        //Batch Insert/Updating
        this.importDataBundle = {
            ressoucen_insert: [],
            ressoucen_update: [],
            files: [],
            casparts_insert: [],
            cobj_com_insert_update: [],
            cascombined_insert: []
        };
        this.loadTimes = {
            insertRessoucen: 0,
            insertFiles: 0,
            insertCasparts: 0,
            cobj_com_insert_update: 0,
            cascombined_insert: 0
        };
        this.activeIDBs = new Set();
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("files-loading", async (event, data) => {
            switch (data.action) {
                case "get-all-sims-files": {
                    let folderPath = this.mainApp.settings.s_path_mod;
                    if (data.folderPath != undefined)
                        folderPath = data.folderPath;
                    if (folderPath.length == 0 || fs.existsSync(folderPath) == false)
                        throw new Error("Invalid path");
                    let filesInfo = await folder_util_1.FolderUtil.getFiles(folderPath, false);
                    this.filesInfo = filesInfo;
                    return { suc: true, filesCount: filesInfo.files.length, filesInfoId: filesInfo.id };
                }
                case "scan-files": {
                    if (data.filesInfoId == undefined || data.channel == undefined)
                        break;
                    if (!this.filesInfo)
                        throw new Error("No files loaded");
                    if (data.filesInfoId != this.filesInfo.id)
                        throw new Error("Invalid filesInfoId");
                    this.scanAllFiles(data.filesInfoId, { channel: data.channel, sender: event.sender });
                    return { suc: true };
                }
                case "remove-ghost-files": {
                    if (data.last_check == undefined || data.channel == undefined)
                        break;
                    await this.removeGhostFiles(data.last_check, { channel: data.channel, sender: event.sender });
                    console.log("[GHOST-FILES] Remove ghost files finished");
                    return { suc: true };
                }
                case "recalc-package-files": {
                    return await this.recalcPackageFiles(event, data.loading, data.inos || []);
                }
                case "refresh-internal-thumbnails": {
                    return await this.refreshInternalThumbnails(event, data.loading, data.inos || []);
                }
                case "ino-db-lookup": {
                    if (data.ino == undefined)
                        throw new Error("No ino provided");
                    if (!this.databaseFilesMap.has(data.ino) || data.last_check == undefined || this.databaseFilesTimestamp != data.last_check) {
                        return await this.mainApp.databaseController.getByIno(data.ino, { select: ["path", "name", "mfolder", "mtime", "size"] });
                    }
                    this.databaseFiledScannedSet.add(data.ino);
                    return [this.databaseFilesMap.get(data.ino)];
                }
                default:
                    throw new Error("No action or invalid paramerters");
            }
        });
        electron_1.ipcMain.handle("files-loading-extra", async (event, data) => {
            switch (data.action) {
                case "update-recalc-package-file": {
                    return await this.handlePartialRecalcResults(data);
                }
                default:
                    throw new Error("Unknown action: " + data.action);
            }
        });
        electron_1.ipcMain.on("files-loading", async (event, data) => {
        });
    }
    async scanAllFiles(filesInfoId, senderInfo) {
        if (!this.filesInfo)
            throw new Error("No files loaded");
        if (filesInfoId != this.filesInfo.id)
            throw new Error("Invalid filesInfoId");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        //Prepare files
        let files = this.filesInfo.files;
        let base = this.filesInfo.base;
        this.filesInfo = undefined;
        let last_check = Date.now();
        //Load data from database
        let dbFiles = [];
        let time = Date.now();
        dbFiles = await knex("Files").select(knex.raw('CAST(ino AS TEXT) AS ino'), 'name', 'path', 'mtime', 'size', 'mfolder');
        let dbScanTime = Date.now() - time;
        console.log("[SCANALLFILES] Database scan time: ", dbScanTime, "ms");
        this.databaseFilesMap.clear();
        this.databaseFiledScannedSet.clear();
        this.databaseFilesTimestamp = last_check;
        console.log("[SCANALLFILES] Set databaseFilesTimestamp: ", this.databaseFilesTimestamp, " with ", dbFiles.length, " files");
        this.databaseFilesMap = new Map(dbFiles.map(file => [file.ino, file]));
        //rest loading times
        this.loadTimes = {
            insertRessoucen: 0,
            insertFiles: 0,
            insertCasparts: 0
        };
        //Prepare Tasks
        let tasks = files.map((element) => {
            return {
                action: "insert-or-update-file",
                data: {
                    name: element.name,
                    folder_base: base,
                    folder_sp: element.sp,
                    last_check: last_check
                }
            };
        });
        let autoRunCategories = await this.mainApp.categoriesController.getAutoRunCategories();
        let sharedData = {
            modImageFolder: this.mainApp.folderStructureController.getFolder("mods-images"),
            modFolderPath: this.mainApp.settings.s_path_mod,
            categories: autoRunCategories,
            fingerprintCategoriesMap: this.mainApp.versionSwitchController.fingerprintCategoriesMap
        };
        if (!sharedData.modImageFolder)
            throw new Error("No mod image folder");
        new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, sharedData, (progress) => {
            if (progress.result && progress.result.idb && progress.result.suc) {
                this.insertOrUpdateFile(progress.result.idb);
                progress.result.imported = true;
                delete progress.result.idb;
            }
            if (senderInfo && senderInfo.sender) {
                IPCExtras_1.IPCExtras.send(senderInfo, senderInfo.channel, {
                    action: "scan-files-progress",
                    index: progress.index,
                    max: progress.max,
                    filename: progress.task && progress.task.data && progress.task.data.name ? progress.task.data.name : undefined
                });
            }
        }, async (results) => {
            await this.handelInsertAndUpdateData();
            console.log("[SCANALLFILES] All files scanned and database updated. Total time: ", Date.now() - last_check, "ms");
            if (senderInfo && senderInfo.sender) {
                IPCExtras_1.IPCExtras.send(senderInfo, senderInfo.channel, {
                    action: "scan-files-finished",
                    last_check: last_check,
                });
            }
        });
    }
    //Ghostfiles
    async removeGhostFiles(last_check, senderInfo) {
        console.log("[GHOST-FILES] Remove ghost files");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        let startTime = Date.now();
        if (last_check != this.databaseFilesTimestamp) {
            console.log("[GHOST-FILES] last_check  = ", last_check, " databaseFilesTimestamp = ", this.databaseFilesTimestamp);
            throw new Error("Last check timestamp does not match the current database timestamp");
        }
        //0. Find all ghost files ions
        let scannedIonsArray = Array.from(this.databaseFiledScannedSet);
        scannedIonsArray.forEach(ino => {
            this.databaseFilesMap.delete(ino);
        });
        let ghostFilesInos = Array.from(this.databaseFilesMap.keys()).filter(ino => !scannedIonsArray.includes(ino));
        this.databaseFiledScannedSet.clear();
        this.databaseFilesMap.clear();
        this.databaseFilesTimestamp = 0;
        if (ghostFilesInos.length === 0) {
            console.log("[GHOST-FILES] No ghost files to remove");
            if (senderInfo && senderInfo.sender) {
                IPCExtras_1.IPCExtras.send(senderInfo, senderInfo.channel, {
                    action: "remove-ghost-files-finished",
                    last_check: last_check,
                });
            }
            return;
        }
        console.log("Found ghost files to remove: ", ghostFilesInos.length, "INOs");
        // 1. Fetch all ghost files and their associated data in one go
        const IN_BATCH_SIZE_GET = 500; // As requested
        // Helper to split array into chunks
        const chunkArrayGet = (array, chunkSize) => {
            const chunks = [];
            for (let i = 0; i < array.length; i += chunkSize) {
                chunks.push(array.slice(i, i + chunkSize));
            }
            return chunks;
        };
        // Split the initial list of INOs into batches for the subsequent SELECT query
        const initialInosBatches = chunkArrayGet(ghostFilesInos, IN_BATCH_SIZE_GET);
        let ghostFiles = [];
        // Fetch all ghost files and their associated data in batches
        // This addresses the potential "too big query" issue for the SELECT statement
        for (const batch of initialInosBatches) {
            const batchFiles = await knex
                .from("Files")
                .whereIn("ino", batch) // Use the current batch
                .select([knex.raw("CAST(ino as TEXT) as ino"), "type", "image", "casp", "cobj"]);
            ghostFiles = ghostFiles.concat(batchFiles); // Accumulate results
        }
        if (ghostFiles.length === 0) {
            console.log("[GHOST-FILES] No ghost files to remove");
            if (senderInfo && senderInfo.sender) {
                IPCExtras_1.IPCExtras.send(senderInfo, senderInfo.channel, {
                    action: "remove-ghost-files-finished",
                    last_check: last_check,
                });
            }
            return;
        }
        const inosToRemove = ghostFiles.map((file) => file.ino);
        const imagePathsToUnlink = [];
        // Collect image paths for later unlinking
        for (const file of ghostFiles) {
            if (file.image) {
                imagePathsToUnlink.push(file.image);
            }
        }
        // Define a safe batch size for WHERE IN clauses
        // A common safe number is 500-1000, especially for SQLite or to be universally safe.
        // Adjust based on your database and typical 'ino' string length.
        const IN_BATCH_SIZE = 600; // For SQLite (older versions) or a generally safe number
        // Helper to split array into chunks
        const chunkArray = (array, chunkSize) => {
            const chunks = [];
            for (let i = 0; i < array.length; i += chunkSize) {
                chunks.push(array.slice(i, i + chunkSize));
            }
            return chunks;
        };
        const inosBatches = chunkArray(inosToRemove, IN_BATCH_SIZE);
        // Use a transaction for atomicity (important!)
        await knex.transaction(async (trx) => {
            // Iterate over batches for each deletion
            for (const batch of inosBatches) {
                // Delete from CasPart and CasCombined if 'casp' flag is true for any ghost file in this batch
                const caspInosBatch = batch.filter((ino) => ghostFiles.find((f) => f.ino === ino)?.casp);
                if (caspInosBatch.length > 0) {
                    await trx("CasPart").whereIn("ino", caspInosBatch).delete();
                    await trx("CasCombined").whereIn("ino", caspInosBatch).delete();
                }
                // Delete from Entries if 'type' is 1 for any ghost file in this batch
                const entryInosBatch = batch.filter((ino) => ghostFiles.find((f) => f.ino === ino)?.type === 1);
                if (entryInosBatch.length > 0) {
                    await trx("Entries").whereIn("ino", entryInosBatch).delete();
                }
                // Delete from CobjCom if 'cobj' flag is true for any ghost file in this batch
                const cobjInosBatch = batch.filter((ino) => ghostFiles.find((f) => f.ino === ino)?.cobj);
                if (cobjInosBatch.length > 0) {
                    await trx("CobjCom").whereIn("ino", cobjInosBatch).delete();
                }
                // Finally, delete from the main 'Files' table for this batch
                await trx("Files").whereIn("ino", batch).delete();
            }
        });
        // Handle file system unlinking (asynchronously and in parallel)
        const unlinkPromises = imagePathsToUnlink.map(async (imagePath) => {
            try {
                if (fs.existsSync(imagePath) == false)
                    return; // Skip if file does not exist
                await fsPromises.access(imagePath);
                await fsPromises.unlink(imagePath);
            }
            catch (error) {
                if (error.code === 'ENOENT') {
                    console.warn(`Image file not found (already removed?): ${imagePath}`);
                }
                else {
                    console.error(`Failed to unlink image ${imagePath}:`, error);
                }
            }
        });
        await Promise.all(unlinkPromises);
        if (senderInfo && senderInfo.sender) {
            IPCExtras_1.IPCExtras.send(senderInfo, senderInfo.channel, {
                action: "remove-ghost-files-finished",
                last_check: last_check,
                removedCount: inosToRemove.length
            });
        }
        console.log("[GHOST-FILES] Remove ghost files finished: ", Date.now() - startTime, "ms");
    }
    async insertOrUpdateFile(importDatabaseBundle, forceUpdate = false) {
        /*console.log("Insert/Update File: ", {
            ressoucen_insert: importDatabaseBundle.ressoucen_insert.length,
            ressoucen_update: importDatabaseBundle.ressoucen_update.length,
            files: importDatabaseBundle.files.length,
            casparts_insert: importDatabaseBundle.casparts_insert.length,
            cobj_com_insert_update: importDatabaseBundle.cobj_com_insert_update.length,
            cascombined_insert: importDatabaseBundle.cascombined_insert ? importDatabaseBundle.cascombined_insert.length : 0
        });*/
        if (importDatabaseBundle.ressoucen_insert && importDatabaseBundle.ressoucen_insert.length > 0) {
            this.importDataBundle.ressoucen_insert = this.importDataBundle.ressoucen_insert.concat(importDatabaseBundle.ressoucen_insert);
        }
        if (importDatabaseBundle.ressoucen_update && importDatabaseBundle.ressoucen_update.length > 0) {
            this.importDataBundle.ressoucen_update = this.importDataBundle.ressoucen_update.concat(importDatabaseBundle.ressoucen_update);
        }
        if (importDatabaseBundle.files && importDatabaseBundle.files.length > 0) {
            this.importDataBundle.files = this.importDataBundle.files.concat(importDatabaseBundle.files);
        }
        if (importDatabaseBundle.casparts_insert && importDatabaseBundle.casparts_insert.length > 0) {
            this.importDataBundle.casparts_insert = this.importDataBundle.casparts_insert.concat(importDatabaseBundle.casparts_insert);
        }
        if (importDatabaseBundle.cobj_com_insert_update && importDatabaseBundle.cobj_com_insert_update.length > 0) {
            this.importDataBundle.cobj_com_insert_update = this.importDataBundle.cobj_com_insert_update.concat(importDatabaseBundle.cobj_com_insert_update);
        }
        if (importDatabaseBundle.cascombined_insert && importDatabaseBundle.cascombined_insert.length > 0 && this.importDataBundle.cascombined_insert != undefined) {
            this.importDataBundle.cascombined_insert = this.importDataBundle.cascombined_insert.concat(importDatabaseBundle.cascombined_insert);
        }
        if (forceUpdate || this.importDataBundle.files.length > 250
            || this.importDataBundle.ressoucen_insert.length > 5000
            || this.importDataBundle.casparts_insert.length > 1500
            || this.importDataBundle.cobj_com_insert_update.length > 500
            || (this.importDataBundle.cascombined_insert != undefined && this.importDataBundle.cascombined_insert.length > 500)) {
            await this.handelInsertAndUpdateData();
        }
    }
    async handelInsertAndUpdateData() {
        let current = this.importDataBundle;
        this.activeIDBs.add(current);
        this.importDataBundle = {
            ressoucen_insert: [],
            ressoucen_update: [],
            files: [],
            casparts_insert: [],
            cobj_com_insert_update: [],
            cascombined_insert: []
        };
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        //Insert Ressoucen in batches
        let ressoucen_chunk_size = 300;
        if (current.ressoucen_insert.length > 0) {
            let time = Date.now();
            try {
                await knex.batchInsert("Entries", current.ressoucen_insert, ressoucen_chunk_size);
                this.loadTimes.insertRessoucen += Date.now() - time;
                //console.log("Insert Ressoucen: ", Date.now() - time);
                current.ressoucen_insert = [];
            }
            catch (error) {
                console.error("Insert Ressoucen", error);
            }
        }
        //Insert Caspart in batches
        let caspart_chunk_size = 300;
        if (current.casparts_insert.length > 0) {
            let time = Date.now();
            try {
                await knex.batchInsert("CasPart", current.casparts_insert, caspart_chunk_size);
                this.loadTimes.insertCasparts += Date.now() - time;
                //console.log("Insert CasPart: ", Date.now() - time);
                current.casparts_insert = [];
            }
            catch (error) {
                console.error("Insert CasPart", error);
            }
        }
        //Insert Cascombined in batches
        if (current.cascombined_insert && current.cascombined_insert.length > 0) {
            let time = Date.now();
            try {
                await knex.batchInsert("CasCombined", current.cascombined_insert, 300);
                this.loadTimes.cascombined_insert += Date.now() - time;
                //console.log("Insert CasCombined: ", Date.now() - time);
                console.log("CasCombined inserted: ", current.cascombined_insert.length);
                current.cascombined_insert = [];
            }
            catch (error) {
                console.error("Insert CasCombined", error);
            }
        }
        //Insert/Update Files in batches
        if (current.files.length > 0) {
            let time = Date.now();
            try {
                await knex.transaction((trx) => {
                    const queries = [];
                    current.files.forEach(file => {
                        const query = knex("Files")
                            .insert(file)
                            .onConflict("ino").merge()
                            .transacting(trx);
                        queries.push(query);
                    });
                    Promise.all(queries)
                        .then(trx.commit)
                        .catch(trx.rollback);
                });
                this.loadTimes.insertFiles += Date.now() - time;
                //console.log("Insert Files: ", Date.now() - time);
                //current.files = [];
                console.log("Files inserted: ", current.files.length);
            }
            catch (error) {
                console.error("Insert Files", error);
            }
        }
        //Insert/Update CobjCom in batches
        if (current.cobj_com_insert_update.length > 0) {
            let time = Date.now();
            try {
                await knex.transaction((trx) => {
                    const queries = [];
                    current.cobj_com_insert_update.forEach(file => {
                        const query = knex("CobjCom")
                            .insert(file)
                            .onConflict("ino").merge()
                            .transacting(trx);
                        queries.push(query);
                    });
                    Promise.all(queries)
                        .then(trx.commit)
                        .catch(trx.rollback);
                });
                this.loadTimes.cobj_com_insert_update += Date.now() - time;
                //console.log("Insert Files: ", Date.now() - time);
                //current.files = [];
                //console.log("cobj_com_insert_update inserted: ", current.cobj_com_insert_update.length);
            }
            catch (error) {
                console.error("Insert cobj_com_insert_update", error);
            }
        }
        this.activeIDBs.delete(current);
        //console.log("Times: ",this.loadTimes);
    }
    //Recalculate all package files (CASP/COBJ)
    async recalcPackageFiles(event, loading, inos) {
        let fast = false;
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        let files = [];
        const selection = [knex.raw('CAST(ino AS TEXT) AS ino'), 'name', 'path', 'type'];
        if (inos && inos.length > 0) {
            //Get only files with the given inos
            files = await knex("Files")
                .whereIn("ino", inos)
                .andWhere("type", 1) // Package files
                .select(selection);
        }
        else {
            //Get all files
            files = await knex("Files")
                .where("type", 1) // Package files
                .select(selection);
            //Fast
            fast = true;
        }
        if (fast) {
            await knex("Entries").delete();
            await knex("CasPart").delete();
            await knex("CobjCom").delete();
            await knex("CasCombined").delete();
        }
        let tasks = files.map((file) => {
            return {
                action: "recalc-package-file",
                data: {
                    ino: file.ino,
                    name: file.name,
                    path: file.path,
                    fast: fast
                }
            };
        });
        console.log("Tasks prepared: ", tasks.length);
        if (tasks.length == 0) {
            return;
        }
        let workerPromise = new Promise((resolve, reject) => {
            new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {}, async (progress) => {
                //OnProgress
                if (loading) {
                    IPCExtras_1.IPCExtras.send(event, loading, { index: progress.index, max: progress.max, action: "progress" });
                }
                /*try{
                    await this.handlePartialRecalcResults(progress);
                }catch (error) {
                    console.error("Error handling partial recalc results", error);
                }*/
            }, async (results) => {
                await this.handelInsertAndUpdateData();
                resolve();
            });
        });
        await workerPromise;
    }
    async handlePartialRecalcResults(data) {
        if (!data || !data.baseData)
            return;
        let { baseData, fast } = data;
        let ino = baseData.ino;
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        //Update database
        let updateData = JSON.parse(JSON.stringify(baseData));
        delete updateData.ino;
        await knex("Files").update(updateData).where("ino", baseData.ino);
        //Delete old ressoucen
        if (!fast && data.skipDelete !== true) {
            try {
                await knex("Entries").where("ino", ino).delete(); // Remove from Entries table
                await knex("CasPart").where("ino", ino).delete(); // Remove from CasPart table
                await knex("CobjCom").where("ino", ino).delete(); // Remove from CobjCom table       
            }
            catch (error) {
                console.error(`Failed to remove file ${ino} from database:`, error);
            }
        }
        //Insert new ressoucen
        if (data.idb)
            await this.insertOrUpdateFile(data.idb);
    }
    //Reset thumbnails
    async refreshInternalThumbnails(event, loading, inos) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        let imagesFolder = this.mainApp.folderStructureController.getFolder("mods-images");
        if (!imagesFolder || !fs.existsSync(imagesFolder))
            throw new Error("No images folder found");
        let files = [];
        const selection = [knex.raw('CAST(ino AS TEXT) AS ino'), 'name', 'path', 'type', 'image_source', 'image'];
        if (inos && inos.length > 0) {
            //Get only files with the given inos
            files = await knex("Files")
                .whereIn("ino", inos)
                .andWhere("type", 1) // Package files 
                .andWhere((qb) => {
                qb.where("image_source", 1).orWhere("image_source", 0);
            })
                .select(selection);
        }
        else {
            //Get all files
            files = await knex("Files")
                .where("type", 1) // Package files
                .andWhere((qb) => {
                qb.where("image_source", 1).orWhere("image_source", 0);
            })
                .select(selection);
        }
        if (files.length == 0) {
            return;
        }
        let tasks = files.map((file) => {
            return {
                action: "refresh-internal-thumbnail",
                data: {
                    ino: file.ino,
                    name: file.name,
                    path: file.path,
                    imagesource: file.image_source,
                    image: file.image
                }
            };
        });
        console.log("Tasks prepared: ", tasks.length);
        if (tasks.length == 0) {
            return;
        }
        let workerPromise = new Promise((resolve, reject) => {
            new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, { imagesFolder: imagesFolder }, async (progress) => {
                if (loading) {
                    IPCExtras_1.IPCExtras.send(event, loading, { index: progress.index, max: progress.max, action: "progress" });
                }
            }, async (results) => {
                await this.handelInsertAndUpdateData();
                resolve();
            });
        });
        await workerPromise;
    }
}
exports.FileLoadingController = FileLoadingController;
FileLoadingController.WINDOWS_BLOCKLIST = new Set([
    '$RECYCLE.BIN',
    'SYSTEM VOLUME INFORMATION',
    '$RECOVERY',
    'DSHOME',
    'CONFIG.MSI',
    'PAGEFILE.SYS',
    'HIBERFIL.SYS',
    'SWAPFILE.SYS'
]);
