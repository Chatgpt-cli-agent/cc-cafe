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
exports.CurseForgeController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const axios_1 = __importDefault(require("axios"));
const path_1 = __importDefault(require("path"));
const dns = __importStar(require("dns"));
const IPCExtras_1 = require("../utils/IPCExtras");
const CurseForgeUtils_1 = require("../utils/CurseForgeUtils");
let Fuse = require('fuse.js');
class CurseForgeController {
    constructor(main) {
        this.HEADER = {
            headers: {
                "Accept": 'application/json',
                "Content-Type": "application/json",
                "User-Agent": "Sims 4 Mod Manager",
                "Referer": process.platform === "darwin" ? "app://s4mmm-electron-app-mac" : "app://s4mm-electron-app-win",
                "x-api-key": "$2a$10$87N.onn5OiHZ7IXVvohTPegNQAkcx37YvlcCZsBZhOpmoO2ycH5um"
            }
        };
        //Creator List
        this.listURL = 'https://api.gametimedev.de/S4MM/cf/creators.txt';
        this.attemptedCreatorListSync = 0;
        this.loadedCreatorList = [];
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("cf-files", async (event, data) => {
            if (data && data.action == "check-for-cf") {
                return await this.checkUnknowFilesForCurseForge(data.channel ? { sender: event.sender, channel: data.channel } : undefined);
            }
            else if (data && data.action == "check-for-updates") {
                return await this.checkForUpdates(data.channel ? { sender: event.sender, channel: data.channel } : undefined);
            }
            else if (data && data.action == "download-thumbnails") {
                return await this.downloadMissingThumbnails(data.onlyEssential == true, data.channel ? { sender: event.sender, channel: data.channel } : undefined);
            }
            throw new Error("No action found");
        });
        electron_1.ipcMain.handle("cf", async (event, data) => {
            switch (data.action) {
                case "check-network":
                    return await this.checkNetwork(data.domain);
                case "simple-file-info-by-cfids":
                    return await this.simpleFileInfoByCFIds(data.ids);
                case "prepare-creator-list":
                    return await this.prepareCreatorList();
                case "fuzy-creator-search":
                    return await this.fuzyCreatorSearch(data.name);
                default:
                    throw new Error(`[CURSEFORGE] No action found for: ${data.action}`);
            }
        });
        electron_1.ipcMain.on("curseforge", async (event, data) => {
            switch (data.action) {
                case "get-with-filter":
                    this.curseForgeHome(event, data);
                    break;
            }
        });
    }
    async checkForUpdates(senderInfo) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            return;
        //Get installed CF Mods (ID List)
        let installedModsSet = new Set((await knex
            .select(['cf_id'])
            .from('files')
            .where('cf_id', '>', 0)).map((item) => item.cf_id));
        //Stored CurseForge Mods
        let storedMods = (await knex.from("CurseForge").select("id")).map((item) => item.id);
        //Check for new Mods
        let modsToInsert = [];
        let modsToUpdate = [];
        let modsToDelete = [];
        for (const modId of storedMods) {
            if (modId && !installedModsSet.has(modId)) {
                modsToDelete.push(modId);
            }
            else if (modId && installedModsSet.has(modId)) {
                installedModsSet.delete(modId);
                modsToUpdate.push(modId);
            }
        }
        modsToInsert = Array.from(installedModsSet);
        //Progress
        const batchSize = 1000;
        let insertUpdateCombinde = modsToInsert.concat(modsToUpdate);
        let batchesCount = insertUpdateCombinde.length > 0 ? Math.ceil(insertUpdateCombinde.length / batchSize) : 0;
        let insertBatchCount = Math.ceil(modsToInsert.length / batchSize);
        let updateBatchCount = Math.ceil(modsToUpdate.length / batchSize);
        let deleteBatchCount = modsToDelete.length > 0 ? 1 : 0;
        let processIndex = 0;
        let progressMax = deleteBatchCount + batchesCount;
        //Delete Mods
        if (modsToDelete.length > 0) {
            await knex.transaction(async (trx) => {
                try {
                    const queries = modsToDelete.map((modId) => {
                        return knex("CurseForge")
                            .where("id", modId)
                            .delete()
                            .transacting(trx);
                    });
                    await Promise.all(queries);
                    await trx.commit();
                }
                catch (error) {
                    await trx.rollback();
                    console.error("Error deleting mods:", error);
                }
            });
            processIndex++;
            if (senderInfo) {
                senderInfo.sender.send(senderInfo.channel, {
                    action: 'simple-progress',
                    index: processIndex,
                    max: progressMax,
                });
            }
        }
        const dbQueue = [];
        for (let i = 0; i < batchesCount; i++) {
            let batch = insertUpdateCombinde.slice(i * batchSize, (i + 1) * batchSize);
            try {
                let data = { modIds: batch.map((item) => item) };
                console.log("[CF-UPDATES] Requesting CurseForge Data for Batch", i);
                const apiPromise = axios_1.default.post('https://api.curseforge.com/v1/mods', data, this.HEADER);
                if (dbQueue.length > 0) {
                    await Promise.race([
                        apiPromise,
                        Promise.all(dbQueue.map((entry) => entry.promise)),
                    ]);
                }
                const result = await apiPromise;
                if (result && result.data && result.data.data) {
                    let dbData = this.handleCurseForgeDataResults(result.data.data);
                    const dbUpdatePromise = this.updateFilesCurseForgeData(knex, dbData)
                        .then(() => {
                        const entry = dbQueue.find((e) => e.promise === dbUpdatePromise);
                        if (entry)
                            entry.resolved = true;
                    })
                        .catch((error) => {
                        console.error('Error updating database:', error);
                    });
                    dbQueue.push({ promise: dbUpdatePromise, resolved: false });
                    dbQueue.splice(0, dbQueue.length, ...dbQueue.filter((entry) => !entry.resolved));
                }
            }
            catch (error) {
                console.error('Error during API request:', error);
            }
            processIndex++;
            if (senderInfo) {
                senderInfo.sender.send(senderInfo.channel, {
                    action: 'simple-progress',
                    index: processIndex,
                    max: progressMax,
                });
            }
        }
        await Promise.all(dbQueue.map((entry) => entry.promise));
    }
    async checkUnknowFilesForCurseForge(senderInfo) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            return;
        let files = await knex
            .select(['fingerprint'])
            .from('files')
            .where('cf_checked', 0)
            .whereNot('fingerprint', -1);
        let batchTimes = [];
        const batchSize = 800;
        let batchesCount = Math.ceil(files.length / batchSize);
        if (senderInfo) {
            senderInfo.sender.send(senderInfo.channel, {
                action: 'simple-progress',
                index: 0,
                max: batchesCount,
            });
        }
        const dbQueue = [];
        for (let i = 0; i < batchesCount; i++) {
            let time = Date.now();
            let batch = files.slice(i * batchSize, (i + 1) * batchSize);
            try {
                let data = { fingerprints: batch.map((item) => item.fingerprint) };
                const apiPromise = axios_1.default.post('https://api.curseforge.com/v1/fingerprints', data, this.HEADER);
                if (dbQueue.length > 0) {
                    await Promise.race([
                        apiPromise,
                        Promise.all(dbQueue.map((entry) => entry.promise)),
                    ]);
                }
                const result = await apiPromise;
                if (result && result.data && result.data.data) {
                    let dbData = this.handleFingerprintResult(result.data.data);
                    const dbUpdatePromise = this.updateFilesCurseForgeRelation(knex, dbData)
                        .then(() => {
                        const entry = dbQueue.find((e) => e.promise === dbUpdatePromise);
                        if (entry)
                            entry.resolved = true;
                    })
                        .catch((error) => {
                        console.error('Error updating database:', error);
                    });
                    dbQueue.push({ promise: dbUpdatePromise, resolved: false });
                    dbQueue.splice(0, dbQueue.length, ...dbQueue.filter((entry) => !entry.resolved));
                }
            }
            catch (error) {
                console.error('Error during API request:', error);
            }
            batchTimes.push(Date.now() - time);
            if (senderInfo) {
                senderInfo.sender.send(senderInfo.channel, {
                    action: 'simple-progress',
                    index: i + 1,
                    max: batchesCount,
                });
            }
        }
        await Promise.all(dbQueue.map((entry) => entry.promise));
    }
    handleFingerprintResult(data) {
        let installedFingerprints = data.installedFingerprints ? data.installedFingerprints : [];
        let installedFingerprintsSet = new Set(installedFingerprints);
        let exactMatches = data.exactMatches ? data.exactMatches : [];
        let partialMatches = data.partialMatches ? data.partialMatches : [];
        //Create Map with all fingerprints
        let fingerprintFileMap = new Map();
        this.fillFingerprintMap(partialMatches, fingerprintFileMap, installedFingerprintsSet);
        this.fillFingerprintMap(exactMatches, fingerprintFileMap, installedFingerprintsSet);
        //Add missing fingerprints to map
        installedFingerprints.forEach((fingerprint) => {
            if (fingerprintFileMap.has(fingerprint))
                return;
            fingerprintFileMap.set(fingerprint, { cf_id: 0, cf_file_id: 0, fingerprint: fingerprint, cf_checked: 1 });
        });
        return Array.from(fingerprintFileMap.values());
    }
    fillFingerprintMap(matchArr, fingerprintFileMap, installedFingerprintsSet) {
        for (let i = 0; i < matchArr.length; i++) {
            let match = matchArr[i];
            if (!match.file || !match.file.modules)
                continue;
            let latestFiles = match.latestFiles ? match.latestFiles : [];
            let lfm = new Map();
            latestFiles.forEach((file) => {
                let cf_id = file.modId;
                let cf_file_id = file.id;
                let modules = file.modules ? file.modules : [];
                modules.forEach((module) => {
                    if (module.fingerprint && !lfm.has(module.fingerprint)) {
                        lfm.set(module.fingerprint, { cf_id: cf_id, cf_file_id: cf_file_id, fingerprint: module.fingerprint });
                    }
                });
            });
            let gameId = match.file.gameId;
            if (gameId != 78062)
                continue; // The Sims 4 Game ID
            let modules = match.file.modules;
            let fileId = match.file.id;
            let modId = match.file.modId;
            for (let j = 0; j < modules.length; j++) {
                let module = modules[j];
                let lfmData = lfm.get(module.fingerprint);
                if (lfmData) {
                    let fingerprint = module.fingerprint;
                    fingerprintFileMap.set(fingerprint, { cf_id: lfmData.cf_id, cf_file_id: lfmData.cf_file_id, fingerprint: fingerprint, cf_checked: 1 });
                }
                else if (module.fingerprint && installedFingerprintsSet.has(module.fingerprint)) {
                    let fingerprint = module.fingerprint;
                    fingerprintFileMap.set(fingerprint, { cf_id: modId, cf_file_id: fileId, fingerprint: fingerprint, cf_checked: 1 });
                }
            }
        }
    }
    async updateFilesCurseForgeRelation(knex, arr) {
        try {
            await knex.transaction(async (trx) => {
                try {
                    const queries = arr.map((file) => {
                        return knex("Files")
                            .where("fingerprint", file.fingerprint)
                            .update(file)
                            .transacting(trx);
                    });
                    await Promise.all(queries);
                    await trx.commit();
                }
                catch (error) {
                    await trx.rollback();
                    console.error("Error updating files:", error);
                }
            });
        }
        catch (error) {
            console.error("Updated CF Files Relations", error);
        }
    }
    handleCurseForgeDataResults(data) {
        let curseForgeItems = data.filter((item) => item && item.gameId == 78062).map((item) => {
            let fingerprints = new Set();
            if (item.latestFiles) {
                item.latestFiles.forEach((file) => {
                    if (file && file.modules && file.modules.length > 0) {
                        file.modules.forEach((module) => {
                            if (module && module.fingerprint)
                                fingerprints.add(module.fingerprint);
                        });
                    }
                });
            }
            let cfObject = {
                id: item.id,
                name: item.name,
                primaryAuthor: item.authors && item.authors.length >= 1 ? item.authors[0].name : "",
                categories: "",
                link: item.links && item.links.websiteUrl ? item.links.websiteUrl : "",
                thumbnail: item.logo && item.logo.thumbnailUrl ? item.logo.thumbnailUrl : "",
                mainFileId: item.mainFileId ? item.mainFileId : 0,
                isSupported: CurseForgeUtils_1.CurseForgeUtils.isSupportedClass(item.classId) ? 1 : 0,
                latestFingerprints: Array.from(fingerprints).map((fingerprint) => fingerprint.toString()).join(","),
            };
            //Handle Categories
            //item.categories ? item.categories.map((cat:any)=>("<"+cat.id+">")).join(",") :
            if (item.categories && item.categories.length > 0) {
                let ids = new Set();
                item.categories.forEach((cat) => {
                    if (cat && cat.id)
                        ids.add(cat.id);
                    if (cat && cat.parentCategoryId)
                        ids.add(cat.parentCategoryId);
                    if (cat && cat.classId)
                        ids.add(cat.classId);
                });
                cfObject.categories = Array.from(ids).map((id) => {
                    return "<" + id + ">";
                }).join(",");
            }
            return cfObject;
        });
        return curseForgeItems;
    }
    async updateFilesCurseForgeData(knex, arr) {
        try {
            await knex.transaction(async (trx) => {
                try {
                    const queries = arr.map((file) => {
                        return knex("CurseForge")
                            .insert(file)
                            .onConflict("id").merge()
                            .transacting(trx);
                    });
                    await Promise.all(queries);
                    await trx.commit();
                }
                catch (error) {
                    await trx.rollback();
                    console.error("Error updating files:", error);
                }
            });
        }
        catch (error) {
            console.error("Updated CF Files Data", error);
        }
        //Remove unsported file links
        let unsportedIds = arr.filter((item) => !item.isSupported).map((item) => item.id);
        if (!unsportedIds || unsportedIds.length == 0)
            return;
        const batchSize = 500;
        for (let i = 0; i < unsportedIds.length; i += batchSize) {
            const batch = unsportedIds.slice(i, i + batchSize);
            await knex.from("Files").whereIn("cf_id", batch).update({
                cf_checked: 1,
                cf_id: 0,
                cf_file_id: 0,
            });
        }
    }
    async downloadMissingThumbnails(onlyEssential, senderInfo) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            return;
        // CF Folder
        let cfImageFolder = this.mainApp.folderStructureController.getFolder("cf-images");
        if (!cfImageFolder || !fs.existsSync(cfImageFolder))
            return;
        // Get all thumbnails
        let thumbnails = [];
        if (onlyEssential) {
            thumbnails = await knex
                .from("CurseForge")
                .select(["CurseForge.id", "CurseForge.thumbnail"])
                .whereNotNull("CurseForge.thumbnail")
                .join("Files", "CurseForge.id", "Files.cf_id")
                .where("Files.image_source", 0);
        }
        else {
            thumbnails = await knex.from("CurseForge").select(["id", "thumbnail"]).whereNotNull("thumbnail");
        }
        // Filter thumbnails to download
        let thumbnailsToUpdate = [];
        let thumbnailsToDownload = thumbnails.filter((item) => {
            let thumbPath = path_1.default.join(cfImageFolder, item.id + ".png");
            let exists = fs.existsSync(thumbPath);
            if (!exists)
                return true;
            if (onlyEssential)
                thumbnailsToUpdate.push({ cf_id: item.id, image: thumbPath });
            return false;
        });
        // Update the database for the thumbnails that already exist
        if (onlyEssential) {
            await knex.transaction(async (trx) => {
                try {
                    const queries = thumbnailsToUpdate.map((item) => {
                        return knex("Files")
                            .where("cf_id", item.cf_id)
                            .update({
                            image_source: 3,
                            image: item.image,
                        })
                            .transacting(trx);
                    });
                    await Promise.all(queries);
                    await trx.commit();
                }
                catch (error) {
                    await trx.rollback();
                    console.error("Error updating database:", error);
                }
            });
        }
        console.log("[CF-THUMBNAILS] Thumbnails", thumbnails.length);
        console.log("[CF-THUMBNAILS] Thumbnails to download", thumbnailsToDownload.length);
        // Limit the number of concurrent downloads
        const CONCURRENT_DOWNLOADS = 3;
        const downloadQueue = [];
        let completedDownloads = 0;
        for (let i = 0; i < thumbnailsToDownload.length; i++) {
            const thumbnail = thumbnailsToDownload[i];
            const thumbPath = path_1.default.join(cfImageFolder, thumbnail.id + ".png");
            // Add the download task to the queue
            const downloadTask = this.downloadImage(thumbnail.thumbnail, thumbPath)
                .then(async () => {
                console.log(`[CF-THUMBNAILS] Downloaded: ${thumbnail.id}`);
                completedDownloads++;
                // Update the database if onlyEssential is true
                if (onlyEssential) {
                    try {
                        await knex("Files")
                            .where("cf_id", thumbnail.id)
                            .update({
                            image_source: 3,
                            image: thumbPath,
                        });
                        console.log(`[CF-THUMBNAILS] Updated database for cf_id: ${thumbnail.id}`);
                    }
                    catch (error) {
                        console.error(`Failed to update database for cf_id: ${thumbnail.id}`, error);
                    }
                }
                // Progress update after the download is completed
                if (senderInfo) {
                    senderInfo.sender.send(senderInfo.channel, {
                        action: "simple-progress",
                        index: completedDownloads,
                        max: thumbnailsToDownload.length,
                    });
                }
                // Mark the task as completed
                const entry = downloadQueue.find((e) => e.promise === downloadTask);
                if (entry)
                    entry.completed = true;
            })
                .catch((error) => {
                console.error(`Failed to download ${thumbnail.id}:`, error);
            });
            downloadQueue.push({ promise: downloadTask, completed: false });
            // Wait for some downloads to finish if the queue exceeds the limit
            if (downloadQueue.filter((entry) => !entry.completed).length >= CONCURRENT_DOWNLOADS) {
                await Promise.race(downloadQueue.map((entry) => entry.promise));
            }
        }
        // Wait for all remaining downloads to complete
        await Promise.all(downloadQueue.map((entry) => entry.promise));
        console.log("[CF-THUMBNAILS] All thumbnails downloaded.");
    }
    async downloadImage(url, filePath) {
        const writer = fs.createWriteStream(filePath);
        try {
            const response = await (0, axios_1.default)({
                url,
                method: "GET",
                responseType: "stream",
                timeout: 10000,
            });
            return new Promise((resolve, reject) => {
                response.data.pipe(writer);
                writer.on("finish", resolve);
                writer.on("error", async (error) => {
                    // Cleanup: Delete the incomplete file
                    try {
                        if (fs.existsSync(filePath)) {
                            await fs_1.promises.unlink(filePath);
                        }
                    }
                    catch (cleanupError) {
                        console.error(`Failed to clean up incomplete file: ${filePath}`, cleanupError);
                    }
                    reject(error);
                });
            });
        }
        catch (error) {
            // Cleanup: Delete the incomplete file if the request fails
            try {
                if (fs.existsSync(filePath)) {
                    await fs_1.promises.unlink(filePath);
                }
            }
            catch (cleanupError) {
                console.error(`Failed to clean up incomplete file: ${filePath}`, cleanupError);
            }
            throw error;
        }
    }
    async checkNetwork(domain) {
        let domainToCheck = domain ? domain : "bing.com";
        let timeoutDuration = 5000; // 5 seconds
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutDuration));
        // 2. Your existing DNS logic wrapped in a promise
        const dnsPromise = new Promise((resolve, reject) => {
            dns.lookup(domainToCheck, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
        try {
            // 3. Race them!
            await Promise.race([dnsPromise, timeoutPromise]);
            return { reachable: true };
        }
        catch (error) {
            // This will catch both DNS failures AND the 5s timeout
            console.error("Network check failed or timed out:", error);
            return { reachable: false };
        }
    }
    //Home And local files
    async curseForgeHome(event, data) {
        console.log("[CurseForgeController] curseForgeHome", data);
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            return;
        let imageFolder = this.mainApp.folderStructureController.getFolder("cf-images");
        let id_mod = 5089;
        let id_cas = 5339;
        let id_cobj = 5437;
        let id_translations = 8140;
        let filter = data.filter;
        console.log(filter);
        //Get Items (use Filter)
        let bigList = [];
        bigList = await knex.select(["CurseForge.id", "CurseForge.name", "CurseForge.primaryAuthor", "CurseForge.categories", "CurseForge.thumbnail", "CurseForge.link"])
            .from("Files")
            .join("CurseForge", "Files.cf_id", "CurseForge.id")
            .where((qb) => {
            qb.whereNot("Files.cf_id", null);
            qb.whereNot("Files.cf_id", 0);
            //SearchValue
            if (filter && filter.search_value.length > 0) {
                qb.where((qb1) => {
                    qb1.whereLike("CurseForge.name", "%" + filter.search_value + "%");
                    qb1.orWhere((qb2) => { qb2.whereLike("CurseForge.primaryAuthor", "%" + filter.search_value + "%"); });
                });
            }
            if (filter && filter.categorie_2 != 0) {
                qb.whereLike("CurseForge.categories", "%<" + filter.categorie_2 + ">%");
            }
            else if (filter && filter.categorie_1 != 0) {
                qb.whereLike("CurseForge.categories", "%<" + filter.categorie_1 + ">%");
            }
            else {
                //Primary Category
                if (filter && filter.type_mod) {
                    qb.whereLike("CurseForge.categories", "%" + id_mod + "%");
                }
                if (filter && filter.type_cas) {
                    qb.whereLike("CurseForge.categories", "%" + id_cas + "%");
                }
                if (filter && filter.type_cobj) {
                    qb.whereLike("CurseForge.categories", "%" + id_cobj + "%");
                }
                if (filter && filter.type_translation) {
                    qb.whereLike("CurseForge.categories", "%" + id_translations + "%");
                }
            }
        });
        //Combine Items
        let cleanMap = new Map();
        bigList.forEach((element) => {
            let id = element.id;
            if (cleanMap.has(id)) {
                //Do special stuff
            }
            else {
                let file = imageFolder + path_1.default.sep + "[CF]" + id + ".png";
                if (fs.existsSync(file))
                    element.localImage = file;
                cleanMap.set(id, element);
            }
        });
        let arr = Array.from(cleanMap.values());
        //Send Result
        console.log("[CurseForgeController] curseForgeHome - Send Result", arr.length);
        IPCExtras_1.IPCExtras.send(event, "curseforge-home", { "action": "curseforge-files", "list": arr });
        //eventSender(event, "curseforge-home", { "action": "curseforge-files", "list": arr });
    }
    async simpleFileInfoByCFIds(ids) {
        if (!ids || ids.length == 0)
            return [];
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not connected");
        //Files
        let files = await knex.select(["cf_id", "cf_file_id", "fingerprint", knex.raw("CAST(ino as TEXT) as ino"), "name", "image"]).from("Files").whereIn("cf_id", ids);
        //CurseForge Project data,
        let projects = await knex.select(["mainFileId", "id", "name"]).from("CurseForge").whereIn("id", ids);
        let queue = [];
        return { files, projects, queue };
    }
    async prepareCreatorList() {
        const cfFolder = this.mainApp.folderStructureController.getFolder("curseforge");
        if (!cfFolder || !fs.existsSync(cfFolder))
            throw new Error("CurseForge folder not found");
        const listPath = path_1.default.join(cfFolder, "creators.txt");
        if (!fs.existsSync(listPath) && this.attemptedCreatorListSync == 0) {
            await this.syncCreatorList();
            this.attemptedCreatorListSync++;
        }
        else if (fs.existsSync(listPath) && this.attemptedCreatorListSync == 0) {
            this.attemptedCreatorListSync++;
            this.syncCreatorList().then(() => {
                try {
                    this.loadedCreatorList = this.loadCreatorList();
                }
                catch (error) {
                    console.error("[CURSEFORGE] Failed to load creator list after sync:", error);
                }
            });
        }
        try {
            this.loadedCreatorList = this.loadCreatorList();
        }
        catch (error) {
            console.error("[CURSEFORGE] Failed to load creator list after sync:", error);
        }
        return {
            creatorCount: this.loadedCreatorList.length,
            cratorTxtExists: fs.existsSync(listPath),
            attemptedCreatorListSync: this.attemptedCreatorListSync
        };
    }
    loadCreatorList() {
        const cfFolder = this.mainApp.folderStructureController.getFolder("curseforge");
        if (!cfFolder || !fs.existsSync(cfFolder))
            throw new Error("CurseForge folder not found");
        const listPath = path_1.default.join(cfFolder, "creators.txt");
        if (!fs.existsSync(listPath))
            throw new Error("Creator list not found");
        const content = fs.readFileSync(listPath, "utf8");
        return content.split("\n").map(line => line.trim()).filter(line => line.length > 0);
    }
    async syncCreatorList() {
        const url = this.listURL;
        const cfFolder = this.mainApp.folderStructureController.getFolder("curseforge");
        if (!cfFolder || !fs.existsSync(cfFolder)) {
            throw new Error("CurseForge folder not found");
        }
        const etagPath = path_1.default.join(cfFolder, "creators_etag.txt");
        const listPath = path_1.default.join(cfFolder, "creators.txt");
        const savedEtag = fs.existsSync(etagPath)
            ? fs.readFileSync(etagPath, 'utf8').trim()
            : '';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
            console.log('[CURSEFORGE] Checking for creator list updates...');
            const response = await fetch(url, {
                headers: { 'If-None-Match': savedEtag },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.status === 304) {
                console.log('[CURSEFORGE] Success: Local version is already up to date.');
                return;
            }
            if (response.status === 200) {
                const content = await response.text();
                const newEtag = response.headers.get('etag');
                fs.writeFileSync(listPath, content);
                if (newEtag) {
                    fs.writeFileSync(etagPath, newEtag.trim());
                }
                console.log('[CURSEFORGE] Success: List updated to newest version.');
            }
            else {
                console.warn(`[CURSEFORGE] Server responded with status: ${response.status}`);
            }
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.error('[CURSEFORGE] Sync timed out. Using cached version.');
            }
            else {
                console.error('[CURSEFORGE] Sync failed:', error.message);
            }
            if (!fs.existsSync(listPath)) {
                console.error('[CURSEFORGE] Critical: No local creator list found to fallback on.');
            }
        }
    }
    async fuzyCreatorSearch(name) {
        let fuse = new Fuse(this.loadedCreatorList, {
            includeScore: true,
            threshold: 0.3
        });
        const results = fuse.search(name);
        //Sort by score and return only the names
        return results.sort((a, b) => a.score - b.score).map((result) => result.item);
    }
}
exports.CurseForgeController = CurseForgeController;
