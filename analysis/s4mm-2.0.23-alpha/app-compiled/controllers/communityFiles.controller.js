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
exports.CommuintyFilesController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const IPCExtras_1 = require("../utils/IPCExtras");
const communityApi_1 = require("../utils/communityApi");
const WorkerQueue_1 = require("../utils/WorkerQueue");
const BundleBufferUtil_1 = require("../utils/BundleBufferUtil");
const NumberArrayBinaryUtil_1 = require("../utils/NumberArrayBinaryUtil");
class CommuintyFilesController {
    constructor(main) {
        //Data
        this.syncData = undefined;
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("community-files-loading", async (event, args) => {
            switch (args.action) {
                case "sync-files-check":
                    if (!args.accessToken || !args.refreshToken)
                        throw new Error("Missing tokens");
                    return await this.syncCheckFiles(event, args.loadding, args.accessToken, args.refreshToken);
                case "sync-files":
                    if (!args.accessToken || !args.refreshToken)
                        throw new Error("Missing tokens");
                    return await this.syncFiles(event, args.loadding, args.accessToken, args.refreshToken);
                case "clear-community-files":
                    return await this.clearCommunityFilesTable();
                default:
                    throw new Error("Invalid action: " + args.action);
            }
        });
        electron_1.ipcMain.handle("community-files-health", async (event, args) => {
            switch (args.action) {
                case "send-health-report":
                    if (!args.type)
                        throw new Error("Missing type");
                    if (!args.accessToken)
                        throw new Error("Missing tokens");
                    return await this.sendHealthReport(args.type, args.fingerprints || [], args.accessToken);
                default:
                    throw new Error("Invalid action: " + args.action);
            }
        });
    }
    async syncCheckFiles(event, loading, accessToken, refreshToken) {
        console.log("Checking community files...");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        //Sets
        let missingFingerprints = new Set();
        //Get all files that have a fingerprint, fingerprint > 0 and size is under 1500000 while not join with CommunityFiles over fingerprint 
        let files = await knex("Files")
            .select([knex.raw('CAST(Files.ino AS TEXT) AS ino'), "Files.fingerprint"])
            .leftJoin("CommunityFiles", "Files.fingerprint", "CommunityFiles.fingerprint")
            .where("Files.fingerprint", ">", 0)
            .andWhere("Files.size", "<", 150000000)
            .andWhere("Files.type", "<", 3)
            .andWhere("CommunityFiles.fingerprint", null);
        if (files.length > 0) {
            //Print example
            console.log("Example file: ", files[0]);
        }
        //Sync Files
        let batchSize = 1000;
        let batches = Math.ceil(files.length / batchSize);
        let foundItems = [];
        let time = Date.now();
        for (let i = 0; i < batches; i++) {
            let batch = files.slice(i * batchSize, (i + 1) * batchSize);
            console.log("Batch: ", i);
            console.log("Batch size: ", batch.length);
            let fingerprints = batch.map((file) => file.fingerprint);
            //Check fingerprints
            try {
                let checkedAccesToken = await communityApi_1.CommunityApi.checkAndRefreshAccessToken(accessToken, refreshToken);
                if (!checkedAccesToken)
                    throw new Error("No valid access token");
                let result = await communityApi_1.CommunityApi.checkFingerprints(fingerprints, checkedAccesToken);
                if (result && result.missing) {
                    result.missing.forEach((fingerprint) => {
                        missingFingerprints.add(+fingerprint);
                    });
                }
                if (result && result.found && result.found.length > 0) {
                    result.found.forEach((item) => {
                        //console.warn("CHANGE THIS BACK!!!!!");
                        //missingFingerprints.add(+item.fingerprint);
                        foundItems.push({
                            fingerprint: item.fingerprint,
                            last_check: time,
                            main_name: item.name,
                            has_thumbnail: item.hasThumbnail == true
                        });
                    });
                }
            }
            catch (error) {
                console.error("Error checking fingerprints: ", error);
            }
            //Insert or update found items
            if (foundItems.length > 0) {
                await this.updateSimpleCommunityFile(foundItems);
                foundItems = [];
            }
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, { action: "progress", index: (i + 1), max: batches });
            }
        }
        //Check for Updates to extend existing community files
        let updateThumbnails = await this.checkForThumbnialsUpdate(knex);
        this.syncData = {
            checked: Date.now(),
            missing: missingFingerprints,
            updateThumbnails: updateThumbnails
        };
        console.log("Processing time: ", Date.now() - time);
    }
    async checkForThumbnialsUpdate(knex) {
        let req = knex("Files")
            .leftJoin("CommunityFiles", "Files.fingerprint", "CommunityFiles.fingerprint")
            .where((qb) => {
            //File has thumbnail but community file does not have thumbnail
            qb.where("Files.image_source", ">", 0).andWhereNot("CommunityFiles.has_thumbnail", 1);
        }).select([knex.raw('CAST(Files.ino AS TEXT) AS ino'), "Files.fingerprint", "Files.image_source", "Files.image"]).distinct("Files.fingerprint");
        let files = await req;
        return files ? files : [];
    }
    async syncFiles(event, loading, accessToken, refreshToken) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        if (!tmpFolder || !fs.existsSync(tmpFolder))
            throw new Error("Tmp folder not found");
        if (!this.syncData) {
            console.log("No Sync Data");
            return;
        }
        console.log("Files to sync: ", this.syncData.missing.size);
        let fingerprints = Array.from(this.syncData.missing);
        let updateThumbnails = this.syncData.updateThumbnails;
        this.syncData = undefined;
        let scanTime = Date.now();
        let tasks = [];
        fingerprints.forEach((fingerprint, index) => {
            tasks.push({
                action: "bundle-file-info",
                data: {
                    fingerprint: fingerprint
                }
            });
        });
        updateThumbnails.forEach((file) => {
            tasks.push({
                action: "bundle-file-thumbnail",
                data: {
                    fingerprint: file.fingerprint,
                    image_source: file.image_source,
                    image: file.image
                }
            });
        });
        if (tasks.length == 0) {
            console.log("No tasks to process");
            return;
        }
        const maxBundelSize = 8 * 1024 * 1024; // 8 MB max bundle size
        let bundelFiles = [];
        bundelFiles.push(new BundleBufferUtil_1.BundleBufferFile(tmpFolder));
        let totalSize = 0;
        let workerPromise = new Promise((resolve, reject) => {
            new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {}, async (progress) => {
                //OnProgress
                if (loading) {
                    IPCExtras_1.IPCExtras.send(event, loading, { action: "progress", index: Math.floor(progress.index / progress.max * 100), max: 150 });
                }
                if (progress.result && progress.result.bundleBuffer) {
                    //bundleFile.addBufferToEnd(progress.result.bundleBuffer);
                    //delete progress.result.bundleBuffer;
                    let bufferSize = Buffer.byteLength(progress.result.bundleBuffer);
                    let bundleFile = bundelFiles[bundelFiles.length - 1];
                    totalSize += bufferSize;
                    if (bundleFile.size + bufferSize > maxBundelSize) {
                        //Create new bundle file
                        bundleFile = new BundleBufferUtil_1.BundleBufferFile(tmpFolder);
                        bundelFiles.push(bundleFile);
                        console.log("New bundle file created: ", bundleFile.filepath);
                    }
                    bundleFile.addBufferToEnd(progress.result.bundleBuffer);
                    delete progress.result.bundleBuffer;
                }
            }, async (results) => {
                //OnFinish
                console.log("Syncings done. Total time: ", Date.now() - scanTime);
                resolve();
            });
        });
        await workerPromise;
        for (let i = 0; i < bundelFiles.length; i++) {
            let bundleFile = bundelFiles[i];
            let progress = 100 + Math.ceil((i + 1) / bundelFiles.length * 50);
            let max = 150;
            if (fs.existsSync(bundleFile.filepath)) {
                let checkedAccesToken = await communityApi_1.CommunityApi.checkAndRefreshAccessToken(accessToken, refreshToken);
                if (!checkedAccesToken)
                    throw new Error("No valid access token");
                console.log("Uploading bundle file: ", bundleFile.filepath);
                let result = await communityApi_1.CommunityApi.uploadFileInfoBundle(bundleFile.filepath, checkedAccesToken);
                if (result && result.success) {
                    console.log("Bundle uploaded successfully");
                    //Update community files
                    let updateItems = [];
                    updateThumbnails.forEach((file) => {
                        updateItems.push({
                            fingerprint: file.fingerprint,
                            has_thumbnail: true
                        });
                    });
                    await this.updateSimpleCommunityFile(updateItems);
                }
                else {
                    throw new Error("Error uploading bundle file: " + (result ? result.status : "Unknown error"));
                }
                //Delete bundle file
                try {
                    //console.log("Deleting bundle file: ", bundleFile.filepath);
                    //console.warn("Skip for testig")
                    await fs_1.promises.unlink(bundleFile.filepath);
                    console.log("Bundle file deleted: ", bundleFile.filepath);
                }
                catch (error) {
                    console.error("Error deleting bundle file: ", error);
                }
                if (loading) {
                    IPCExtras_1.IPCExtras.send(event, loading, { action: "progress", index: progress, max: max });
                }
            }
            else {
                console.warn("Bundle file not created: ", bundleFile.filepath);
            }
        }
        //Upload bundle
        /*if(fs.existsSync(bundleFile.filepath)){
            console.log("Uploading bundle file: ", bundleFile.filepath);
            let checkedAccesToken = await CommunityApi.checkAndRefreshAccessToken(accessToken,refreshToken);
            if(!checkedAccesToken) throw new Error("No valid access token");
            let result = await CommunityApi.uploadFileInfoBundle(bundleFile.filepath,checkedAccesToken);
            if(result && result.success){
                console.log("Bundle uploaded successfully");

                //Update community files
                let updateItems: any[] = [];
                updateThumbnails.forEach((file:any) => {
                    updateItems.push({
                        fingerprint: file.fingerprint,
                        has_thumbnail: true
                    });
                });
                await this.updateSimpleCommunityFile(updateItems);

            }else{
                throw new Error("Error uploading bundle file: " + (result ? result.status : "Unknown error"));
            }

            //Delete bundle file
            try {
                console.log("Deleting bundle file: ", bundleFile.filepath);
                console.warn("Skip for testig")
                //await fsPromises.unlink(bundleFile.filepath);
                //console.log("Bundle file deleted: ", bundleFile.filepath);
            } catch (error) {
                console.error("Error deleting bundle file: ", error);
            }
        }*/
    }
    async updateSimpleCommunityFile(items) {
        if (false) {
            console.log("Skipping updateSimpleCommunityFile");
            console.log("NEEDS TO BE REMOVED FOR PRODUCTION");
            return;
        }
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        try {
            await knex.transaction(async (trx) => {
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    await trx("CommunityFiles").insert(item).onConflict("fingerprint").merge();
                }
            });
        }
        catch (error) {
            console.error("Error inserting found items: ", error);
        }
    }
    async clearCommunityFilesTable() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        try {
            await knex.transaction(async (trx) => {
                await trx("CommunityFiles").delete();
                await trx("CommunitySpecificReportedFiles").delete();
            });
            console.log("Community files table cleared");
        }
        catch (error) {
            console.error("Error clearing community files table: ", error);
        }
    }
    //Health stuff
    async sendHealthReport(type, fingerprintsInput, accessToken) {
        const maxFingerprintsPerDirectInsert = 100;
        let validTypes = new Set(["ALL_WORKING", "ALL_BROKEN", "SPECIFIC_BROKEN"]);
        if (!validTypes.has(type))
            throw new Error("Invalid type: " + type);
        if (!accessToken)
            throw new Error("Missing tokens");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        let gameVersion = this.mainApp.gameController.getInstalledGameVersion();
        if (!gameVersion)
            throw new Error("Game version not found");
        let fingerprintSet = new Set(fingerprintsInput.filter((fp) => typeof fp === 'number' && fp > 0));
        if (type == "ALL_WORKING" || type == "ALL_BROKEN") {
            let allFileFingerprints = await knex("files").select("fingerprint");
            if (allFileFingerprints) {
                allFileFingerprints.forEach((file) => {
                    if (file.fingerprint && file.fingerprint > 0)
                        fingerprintSet.add(file.fingerprint);
                });
            }
        }
        console.log("Sending health report for type: ", type);
        console.log("Fingerprints: ", fingerprintSet.size);
        let fingerprint = [];
        let fingerprintBundleFile = undefined;
        //Check with database if "Specific Broken" fingerprints already exist
        if (type == "SPECIFIC_BROKEN") {
            let existingFingerprints = await knex("CommunitySpecificReportedFiles")
                .where("game_version", gameVersion)
                .andWhere("report_type", type)
                .select("fingerprint");
            if (existingFingerprints && existingFingerprints.length > 0) {
                existingFingerprints.forEach((fp) => {
                    fingerprintSet.delete(fp.fingerprint);
                });
            }
        }
        //Bundle into file if over 
        if (fingerprintSet.size > maxFingerprintsPerDirectInsert) {
            //Create bundle file
            let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
            if (!tmpFolder || !fs.existsSync(tmpFolder))
                throw new Error("Tmp folder not found");
            let tmpFingerprintFile = path_1.default.join(tmpFolder, "fingerprints_bundle_" + type + "_" + Date.now() + ".bin");
            NumberArrayBinaryUtil_1.NumberArrayBinaryUtil.writeToFile(tmpFingerprintFile, Array.from(fingerprintSet));
            if (fs.existsSync(tmpFingerprintFile)) {
                fingerprintBundleFile = tmpFingerprintFile;
                console.log("Fingerprint bundle file created: ", fingerprintBundleFile);
            }
        }
        else {
            fingerprint = Array.from(fingerprintSet);
        }
        //Send to server
        let response = await communityApi_1.CommunityApi.uploadHealthReport(accessToken, gameVersion, type, fingerprint, fingerprintBundleFile);
        if (fingerprintBundleFile && fs.existsSync(fingerprintBundleFile)) {
            try {
                await fs_1.promises.unlink(fingerprintBundleFile);
                console.log("Fingerprint bundle file deleted: ", fingerprintBundleFile);
            }
            catch (error) {
                console.error("Error deleting fingerprint bundle file: ", error);
            }
        }
        if (type == "SPECIFIC_BROKEN" && fingerprintSet.size > 0 && response && response.success) {
            // Fingrerprints to "CommunitySpecificReportedFiles" table
            try {
                await knex.transaction(async (trx) => {
                    for (let i = 0; i < fingerprintsInput.length; i++) {
                        let fingerprint = fingerprintsInput[i];
                        if (fingerprint && fingerprint > 0) {
                            await trx("CommunitySpecificReportedFiles").insert({
                                fingerprint: fingerprint,
                                report_type: type,
                                game_version: gameVersion
                            });
                        }
                    }
                });
            }
            catch (error) {
                console.error("Error inserting specific reported files: ", error);
            }
        }
        return response;
    }
}
exports.CommuintyFilesController = CommuintyFilesController;
