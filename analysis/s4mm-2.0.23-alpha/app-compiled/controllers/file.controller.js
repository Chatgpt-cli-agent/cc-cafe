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
exports.FileController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const DBPFReader_1 = require("../sims/DBPFReader");
const IPCExtras_1 = require("../utils/IPCExtras");
const DeleteHelper_1 = require("../utils/DeleteHelper");
const Helper_1 = require("../utils/Helper");
const FilenameUtils_1 = require("../utils/FilenameUtils");
const language_controller_1 = require("./language.controller");
const crypto = require("crypto");
class FileController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("file-extra", async (event, data) => {
            if (data.action == "extend-with-cache") {
                return this.extendThumbnailsWithCache(data.channel ? { channel: data.channel, sender: event.sender } : undefined);
            }
            else if (data.action == "has-cache") {
                return this.hasLocalCacheFile();
            }
            throw new Error("Unknown action");
        });
        electron_1.ipcMain.on("file-io", (event, data) => {
            if (data.action == "load-unload") {
                this.loadUnloadFilesWithUpdate(event, data).catch((err) => {
                    console.log(err);
                });
            }
            else if (data.action == "delete") {
                this.deleteFilesWithUpdate(event, data).catch((err) => {
                    console.log(err);
                });
            }
            else if (data.action == "delete-curseforge-mod") {
                this.deleteCurseForgeModWithUpdate(event, data).catch((err) => {
                    console.log(err);
                });
            }
            else if (data.action == "delete-folder") {
                this.deleteFolderWithUpdate(event, data).catch((err) => {
                    console.log(err);
                });
            }
            else if (data.action == "delete-folders") {
                this.deleteFolders(event, data).catch((err) => {
                    console.log(err);
                });
            }
            else if (data.action == "delete-other-files") {
                this.deleteFilesOtherWithUpdate(event, data).catch((err) => {
                    console.log(err);
                });
            }
            else if (data.action == "add-folder") {
                /*addFolder(event, data).catch((err) => {
                    console.log(err);
                });*/
            }
            else if (data.action == "folder-info") {
                /*getFolderInfo(event, data).catch((err) => {
                    console.log(err);
                });*/
            }
            else if (data.action == "rename-folder") {
                this.renameFolderWithUpdate(event, data).catch((err) => {
                    console.log(err);
                });
            }
            else if (data.action == "move") {
                this.moveFilesWithUpdate(event, data).catch((err) => {
                    console.log(err);
                });
            }
            else if (data.action == "reload-files") {
                //reloadAllFiles(event, data, false);
            }
            else if (data.action == "copy-ext") {
                this.copyExt(event, data).catch((err) => {
                    console.log(err);
                    if (data.loading)
                        IPCExtras_1.IPCExtras.send(event, data.loading, { "close": true });
                });
            }
            else if (data.action == "move-folder") { // New IPC handler for moving folders
                this.moveFolderWithUpdate(event, data).catch((err) => {
                    console.error("Error moving folder:", err);
                });
            }
        });
        electron_1.ipcMain.handle("file-get", async (event, data) => {
            switch (data.action) {
                case "edit-view-data":
                    console.log("Provided data:", data);
                    return await this.getEditViewData(data);
                case "ino-where-in-with-missing":
                    return await this.getInoWhereInWithMissing(data);
                case 'get-cobj-extra-data':
                    return await this.getCobjExtraData(data);
                default:
                    throw new Error("No action was provided!");
            }
        });
        electron_1.ipcMain.handle("file-data", async (event, data) => {
            switch (data.action) {
                case "save-edit-view-change":
                    return await this.saveEditViewChanges(data);
                case "reload-edit-view-data":
                    return await this.reloadEditViewData(data);
                default:
                    throw new Error("No action was provided!");
            }
        });
    }
    async getInoWhereInWithMissing(data) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        let sel = [knex.raw('CAST(Files.ino AS TEXT) AS ino'), "path", "name", "image", "size", "mtime", "fingerprint"];
        if (data.action == "ino-where-in-with-missing") {
            let inos = data.inos;
            let files = await knex.from("Files").select(sel).whereIn("ino", inos);
            let missingSet = new Set(inos);
            files.forEach((element) => { missingSet.delete(element.ino); });
            return { files: files, missing: Array.from(missingSet) };
        }
        return undefined;
    }
    async removeFileByIno(ino) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        //Get file = 
        let items = await knex("files").where("ino", ino).select(["type", "image", "casp", "cobj"]);
        if (items.length == 0)
            return true;
        let item = items[0];
        //From Files
        await knex("files").where("ino", ino).delete();
        //Unlink image
        if (item.image && fs.existsSync(item.image)) {
            try {
                fs.unlinkSync(item.image);
            }
            catch (error) {
                console.error("Failed to unlink image", item.image);
            }
        }
        //Remove CasPart
        if (item.casp) {
            await knex("CasPart").where("ino", ino).delete();
            await knex("CasCombined").where("ino", ino).delete();
        }
        //Remove Entries
        if (item.type == 1) {
            await knex("Entries").where("ino", ino).delete();
        }
        //Remove CobjCom
        if (item.cobj) {
            await knex("CobjCom").where("ino", ino).delete();
        }
        return true;
    }
    async extendThumbnailsWithCache(senderInfo) {
        const BATCH_SIZE = 500;
        const startTime = Date.now();
        console.log("[EXTEND-THUMBNAILS] Starting thumbnail extension with cache...");
        // --- Configuration and Pre-checks ---
        const simsDataFolder = this.mainApp.settings.s_game_documents;
        const imageFolder = this.mainApp.folderStructureController.getFolder("mods-images");
        const cachefile = simsDataFolder ? path_1.default.join(simsDataFolder, "localthumbcache.package") : '';
        const requiredPaths = [
            { path: simsDataFolder, name: "Sims data folder" },
            { path: imageFolder, name: "Image folder" },
            { path: cachefile, name: "Cache file" }
        ];
        for (const { path: p, name } of requiredPaths) {
            if (!p || !fs.existsSync(p)) {
                console.error(`Error: ${name} not found or path is invalid: ${p}`);
                return false;
            }
        }
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex) {
            console.error("Error: Database connection (knex) not available.");
            return false;
        }
        // --- Cache File Processing ---
        const packLoadStartTime = Date.now();
        let pack;
        try {
            pack = new DBPFReader_1.Pack(cachefile);
            pack.checkFile();
            if (pack.error) {
                throw new Error(`Pack file check failed: ${pack.error}`);
            }
            pack.calculateIndexList();
            console.log(`[EXTEND-THUMBNAILS] Cache file processed in ${Date.now() - packLoadStartTime} ms.`);
        }
        catch (error) {
            console.error(`Error processing cache file ${cachefile}:`, error);
            return false;
        }
        const thumbnails = new Map();
        const thumbnailMapStartTime = Date.now();
        for (const entry of pack.index_List) {
            if (entry.type === DBPFReader_1.TagType.THUM) {
                const key = DBPFReader_1.Basic.getInstanceKey(entry);
                const existing = thumbnails.get(key);
                // Store the thumbnail if it's new or has a larger filesize (potentially higher quality)
                if (!existing || existing.filesize < entry.filesize) {
                    //console.log(`Adding/updating thumbnail entry for key ${key} with filesize ${entry.filesize}`); 
                    thumbnails.set(key, entry);
                }
            }
        }
        console.log(`[EXTEND-THUMBNAILS] Thumbnail map created with ${thumbnails.size} entries in ${Date.now() - thumbnailMapStartTime} ms.`);
        if (thumbnails.size === 0) {
            console.log("[EXTEND-THUMBNAILS] No thumbnails found in the cache file.");
            return false;
        }
        // --- Database Query for Files Needing Thumbnails ---
        const dbQueryStartTime = Date.now();
        const filesToUpdate = await knex("files")
            .where("type", 1) // Assuming type 1 is relevant for these files
            .andWhere("image_source", 0) // Assuming 0 means missing thumbnail
            .andWhere((qb) => {
            qb.where("casp", 1).orWhere("cobj", 1); // Specific conditions for file types
        })
            .select(knex.raw('CAST(ino AS TEXT) AS ino')); // Ensure 'ino' is text for consistent keys
        console.log(`[EXTEND-THUMBNAILS] Found ${filesToUpdate.length} files needing thumbnails in ${Date.now() - dbQueryStartTime} ms.`);
        if (filesToUpdate.length === 0) {
            console.log("[EXTEND-THUMBNAILS] No files found that require thumbnail extension.");
            return false;
        }
        // --- Batch Processing and Thumbnail Assignment ---
        const processingStartTime = Date.now();
        let updatedCount = 0;
        for (let i = 0; i < filesToUpdate.length; i += BATCH_SIZE) {
            const batch = filesToUpdate.slice(i, i + BATCH_SIZE);
            const inosInBatch = batch.map((file) => file.ino);
            // Fetch all relevant entries for the current batch
            const entriesInBatchQueryStartTime = Date.now();
            const entriesForBatch = await knex("Entries")
                .whereIn("ino", inosInBatch)
                .andWhere((qb) => {
                qb.where("type", 832458525).orWhere("type", 55242443); // Specific entry types
            })
                .select([
                knex.raw('CAST(ino AS TEXT) AS ino'),
                knex.raw('instancehex AS instance')
            ]);
            console.log(`[EXTEND-THUMBNAILS] Fetched ${entriesForBatch.length} entries for batch in ${Date.now() - entriesInBatchQueryStartTime} ms.`);
            const entriesByIno = new Map();
            for (const entry of entriesForBatch) {
                if (!entriesByIno.has(entry.ino)) {
                    //console.log(`Creating new entry list for ino ${entry.ino} with first instance ${entry.instance}`);
                    entriesByIno.set(entry.ino, []);
                }
                entriesByIno.get(entry.ino).push(entry.instance);
            }
            await Promise.all(batch.map(async (file, index) => {
                const instanceKeys = entriesByIno.get(file.ino) || [];
                let thumbnailApplied = false;
                for (const key of instanceKeys) {
                    const thumbnailEntry = thumbnails.get(key);
                    //console.log(`Checking file ${file.ino} with entry key ${key}. Thumbnail entry:`, thumbnailEntry ? "Found" : "Not found");
                    if (thumbnailEntry) {
                        const imageFilePath = path_1.default.join(imageFolder, `c_${key}.png`);
                        //console.log(`Processing file ${file.ino} with entry key ${key}. Thumbnail found in cache, attempting to save to ${imageFilePath}...`);
                        try {
                            const imageData = thumbnailEntry.getByteArray();
                            // Ensure the directory exists before saving
                            await fs.promises.mkdir(imageFolder, { recursive: true });
                            await DBPFReader_1.PackHandler.saveBufferToFile(imageFilePath, imageData, true);
                            // Verify file creation before updating DB
                            if (fs.existsSync(imageFilePath)) {
                                await knex("files")
                                    .where("ino", file.ino)
                                    .update({ image: imageFilePath, image_source: 3 }); // image_source 2 indicates cache
                                updatedCount++;
                                thumbnailApplied = true;
                                break; // Move to the next file once a thumbnail is found and applied
                            }
                            else {
                                console.warn(`Warning: Image file not found after save for ${key}`);
                            }
                        }
                        catch (saveError) {
                            console.error(`Error saving thumbnail for ${key} to ${imageFilePath}:`, saveError);
                        }
                    }
                }
                // Send progress update for each file, even if no thumbnail was applied for it
                if (senderInfo) {
                    senderInfo.sender.send(senderInfo.channel, {
                        action: "extend-with-cache-progress",
                        index: i + index + 1,
                        max: filesToUpdate.length,
                    });
                }
            }));
        }
        console.log(`[EXTEND-THUMBNAILS] Processed ${filesToUpdate.length} files. Successfully updated ${updatedCount} thumbnails in ${Date.now() - processingStartTime} ms.`);
        console.log(`[EXTEND-THUMBNAILS] Total operation completed in ${Date.now() - startTime} ms.`);
        return true;
    }
    hasLocalCacheFile() {
        let result = {
            hasLocalCache: false,
            hasSimsData: false
        };
        let simsDataFolder = this.mainApp.settings.s_game_documents;
        if (!simsDataFolder || !fs.existsSync(simsDataFolder))
            return result;
        result.hasSimsData = true;
        let cachefile = path_1.default.join(simsDataFolder, "localthumbcache.package");
        result.hasLocalCache = fs.existsSync(cachefile);
        return result;
    }
    //Load/Unload files
    async loadUnloadFilesWithUpdate(event, data) {
        const { action, list: inos, load: state, loading } = data;
        if (action !== "load-unload")
            return;
        const updatedInos = await this.loadUnloadFiles(inos, state, (progress) => {
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, {
                    value: progress.index,
                    max: progress.max,
                    title: progress.index + "/" + progress.max,
                    close: false,
                });
            }
        });
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 1,
                max: 1,
                title: "Done",
                close: true,
            });
        }
        IPCExtras_1.IPCExtras.send(event, "file-io", {
            action: "load-unload",
            list: updatedInos
        });
        //event.sender.send("file-io-complete", { action, updatedInos });
    }
    async loadUnloadFiles(inos, state, onProgress) {
        const updatedInos = [];
        const BATCH_SIZE = 500;
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        if (!inos || inos.length === 0)
            return updatedInos;
        let processedCount = 0;
        for (let i = 0; i < inos.length; i += BATCH_SIZE) {
            const batch = inos.slice(i, i + BATCH_SIZE);
            const files = await knex("files")
                .whereIn("ino", batch)
                .whereNot("type", 3)
                .select([knex.raw('CAST(ino AS TEXT) AS ino'), "name", "path"]);
            await Promise.all(files.map(async (file) => {
                const { ino, name, path: filePath } = file;
                const isOff = name.toLowerCase().endsWith("off");
                if (isOff === !state) {
                    return;
                }
                let newName;
                if (state) {
                    newName = name.substring(0, name.length - 3);
                }
                else {
                    newName = `${name}OFF`;
                }
                const oldPath = path_1.default.join(filePath, name);
                const newPath = path_1.default.join(filePath, newName);
                try {
                    fs.renameSync(oldPath, newPath);
                }
                catch (error) {
                    console.error(`Failed to rename file ${filePath}:`, error);
                    return;
                }
                try {
                    await knex("Files")
                        .where("ino", ino)
                        .update({ name: newName });
                    updatedInos.push({ ino, name: newName });
                }
                catch (error) {
                    console.error(`Failed to update database for file ${ino}:`, error);
                }
                // Update progress after processing each file
                processedCount++;
                if (onProgress) {
                    onProgress({ index: processedCount, max: inos.length });
                }
            }));
        }
        return updatedInos;
    }
    //Delete files
    async deleteFilesWithUpdate(event, data) {
        const { action, list: inos, loading } = data;
        if (action !== "delete")
            return;
        const deletedInos = await this.deleteFiles(inos, (progress) => {
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, {
                    value: progress.index,
                    max: progress.max,
                    title: progress.index + "/" + progress.max,
                    close: false,
                });
            }
        });
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 1,
                max: 1,
                title: "Done",
                close: true,
            });
        }
        IPCExtras_1.IPCExtras.send(event, "file-io", {
            action: "delete",
            list: deletedInos,
        });
    }
    async deleteFiles(inos, onProgress) {
        const deletedInos = [];
        const BATCH_SIZE = 500;
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        if (!inos || inos.length === 0)
            return deletedInos;
        let processedCount = 0;
        for (let i = 0; i < inos.length; i += BATCH_SIZE) {
            const batch = inos.slice(i, i + BATCH_SIZE);
            const files = await knex("files")
                .whereIn("ino", batch)
                .select([knex.raw('CAST(ino AS TEXT) AS ino'), "name", "path", "image"]);
            await Promise.all(files.map(async (file) => {
                const { ino, name, path: filePath } = file;
                const fullPath = path_1.default.join(filePath, name);
                //Delete Main file
                try {
                    if (fs.existsSync(fullPath)) {
                        // Delete the file
                        await DeleteHelper_1.DeleteHelper.deleteFile(fullPath, this.mainApp.settings.s_direct_delete);
                    }
                }
                catch (error) {
                    console.error(`Failed to delete file ${fullPath}:`, error);
                    return;
                }
                try {
                    await knex("Files").where("ino", ino).delete(); // Remove from database
                    await knex("Entries").where("ino", ino).delete(); // Remove from Entries table
                    await knex("CasPart").where("ino", ino).delete(); // Remove from CasPart table
                    await knex("CobjCom").where("ino", ino).delete(); // Remove from CobjCom table
                    await knex("CasCombined").where("ino", ino).delete(); // Remove from CasCombined table
                    deletedInos.push(ino);
                }
                catch (error) {
                    console.error(`Failed to remove file ${ino} from database:`, error);
                }
                //Delete image
                if (file.image && fs.existsSync(file.image)) {
                    try {
                        fs.unlinkSync(file.image);
                    }
                    catch (error) {
                        console.error("Failed to unlink image", file.image);
                    }
                }
                // Update progress after processing each file
                processedCount++;
                if (onProgress) {
                    onProgress({ index: processedCount, max: inos.length });
                }
            }));
        }
        return deletedInos;
    }
    //Delete CurseForge Mod
    async deleteCurseForgeModWithUpdate(event, data) {
        const { action, list, loading } = data;
        if (action !== "delete-curseforge-mod")
            return;
        const deletedInos = await this.deleteMods(list, (progress) => {
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, {
                    value: progress.index,
                    max: progress.max,
                    title: progress.index + "/" + progress.max,
                    close: false,
                });
            }
        });
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 1,
                max: 1,
                title: "Done",
                close: true,
            });
        }
        IPCExtras_1.IPCExtras.send(event, "file-io", {
            action: "delete",
            list: deletedInos,
        });
    }
    async deleteMods(ids, onProgress) {
        const deletedInos = [];
        const BATCH_SIZE = 500;
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        if (!ids || ids.length === 0)
            return deletedInos;
        let processedCount = 0;
        const files = await knex("files")
            .whereIn("cf_id", ids)
            .select([knex.raw('CAST(ino AS TEXT) AS ino'), "name", "path", "image"]);
        await Promise.all(files.map(async (file) => {
            const { ino, name, path: filePath } = file;
            const fullPath = path_1.default.join(filePath, name);
            //Delete Main file
            try {
                if (fs.existsSync(fullPath)) {
                    // Delete the file
                    await DeleteHelper_1.DeleteHelper.deleteFile(fullPath, this.mainApp.settings.s_direct_delete);
                }
            }
            catch (error) {
                console.error(`Failed to delete file ${fullPath}:`, error);
                return;
            }
            try {
                await knex("Files").where("ino", ino).delete(); // Remove from database
                await knex("Entries").where("ino", ino).delete(); // Remove from Entries table
                await knex("CasPart").where("ino", ino).delete(); // Remove from CasPart table
                await knex("CobjCom").where("ino", ino).delete(); // Remove from CobjCom table
                await knex("CasCombined").where("ino", ino).delete(); // Remove from CasCombined table
                deletedInos.push(ino);
            }
            catch (error) {
                console.error(`Failed to remove file ${ino} from database:`, error);
            }
            //Delete image
            if (file.image && fs.existsSync(file.image)) {
                try {
                    fs.unlinkSync(file.image);
                }
                catch (error) {
                    console.error("Failed to unlink image", file.image);
                }
            }
            // Update progress after processing each file
            processedCount++;
            if (onProgress) {
                onProgress({ index: processedCount, max: files.length });
            }
        }));
        return deletedInos;
    }
    //Delete other files
    async deleteFilesOtherWithUpdate(event, data) {
        const { action, list, loading } = data;
        if (action !== "delete-other-files")
            return;
        const deletedFiles = await this.deleteFilesOther(list, (progress) => {
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, {
                    value: progress.index,
                    max: progress.max,
                    title: progress.index + "/" + progress.max,
                    close: false,
                });
            }
        });
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 1,
                max: 1,
                title: "Done",
                close: true,
            });
        }
        IPCExtras_1.IPCExtras.send(event, "file-io", {
            action: "delete-other-files",
            list: deletedFiles,
        });
    }
    async deleteFilesOther(files, onProgress) {
        const deletedFiles = [];
        if (!files || files.length === 0)
            return deletedFiles;
        let processedCount = 0;
        await Promise.all(files.map(async (filePath) => {
            try {
                if (fs.existsSync(filePath)) {
                    // Delete the file
                    await DeleteHelper_1.DeleteHelper.deleteFile(filePath, this.mainApp.settings.s_direct_delete);
                    deletedFiles.push(filePath);
                }
            }
            catch (error) {
                console.error(`Failed to delete file ${filePath}:`, error);
                return;
            }
            // Update progress after processing each file
            processedCount++;
            if (onProgress) {
                onProgress({ index: processedCount, max: files.length });
            }
        }));
        return deletedFiles;
    }
    //Move files
    async moveFilesWithUpdate(event, data) {
        const { action, list: inos, path: destinationPath, loading } = data;
        if (action !== "move")
            return;
        const updatedInos = await this.moveFiles(inos, destinationPath, (progress) => {
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, {
                    value: progress.index,
                    max: progress.max,
                    title: progress.index + "/" + progress.max,
                    close: false,
                });
            }
        });
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 1,
                max: 1,
                title: "Done",
                close: true,
            });
        }
        IPCExtras_1.IPCExtras.send(event, "file-io", {
            action: "move",
            list: updatedInos,
        });
    }
    async moveFiles(inos, destinationPath, onProgress) {
        const updatedInos = [];
        const BATCH_SIZE = 500;
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        if (!inos || inos.length === 0)
            return updatedInos;
        let processedCount = 0;
        //mfolder
        let mfolder = Helper_1.Helper.calcMFolder(destinationPath, this.mainApp);
        for (let i = 0; i < inos.length; i += BATCH_SIZE) {
            const batch = inos.slice(i, i + BATCH_SIZE);
            const files = await knex("files")
                .whereIn("ino", batch)
                .select([knex.raw('CAST(ino AS TEXT) AS ino'), "name", "path"]);
            await Promise.all(files.map(async (file) => {
                const { ino, name, path: filePath } = file;
                const oldPath = path_1.default.join(filePath, name);
                const newPath = path_1.default.join(destinationPath, name);
                try {
                    // Ensure the destination directory exists
                    if (!fs.existsSync(destinationPath)) {
                        fs.mkdirSync(destinationPath, { recursive: true });
                    }
                    // Move the file
                    fs.renameSync(oldPath, newPath);
                }
                catch (error) {
                    console.error(`Failed to move file ${oldPath} to ${newPath}:`, error);
                    return;
                }
                try {
                    // Update the database with the new path
                    await knex("files")
                        .where("ino", ino)
                        .update({ path: destinationPath, mfolder: mfolder });
                    updatedInos.push({ ino, name, newPath });
                }
                catch (error) {
                    console.error(`Failed to update database for file ${ino}:`, error);
                }
                // Update progress after processing each file
                processedCount++;
                if (onProgress) {
                    onProgress({ index: processedCount, max: inos.length });
                }
            }));
        }
        return updatedInos;
    }
    //Move to exernal location
    async copyExt(event, data) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        let title = language_controller_1.LanguageService.get("MAIN.TITLE.I10", "Copy files...");
        let loadingCH = data.loading;
        let loading = loadingCH != undefined && loadingCH.length != 0;
        let list = data.list;
        let resultList = [];
        let max = list.length;
        let newPath = data.path;
        let deleteAfterCopy = data.deleteAfterCopy || false;
        let deletedInos = [];
        if (newPath == undefined || !fs.existsSync(newPath)) {
            IPCExtras_1.IPCExtras.send(event, "display-error", { "action": "alert", "info": language_controller_1.LanguageService.get("MAIN.ERROR.PATH_NOT_FOUND", "Path Not Found!") });
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loadingCH, { "close": true });
            }
            return;
        }
        let error = 0;
        let failed = 0;
        for (let index = 0; index < list.length; index++) {
            const item_id = list[index];
            const result = await knex.select().where("ino", item_id).from("Files");
            if (result.length != 1) {
                continue;
            }
            ;
            let element = result[0];
            let file = element.path + path_1.default.sep + element.name;
            if (!fs.existsSync(file)) {
                error++;
                continue;
            }
            let newFile = newPath + path_1.default.sep + element.name;
            if (fs.existsSync(newFile)) {
                let msg = element.name + " - " + language_controller_1.LanguageService.get("MAIN.TOAST.T4", 'Could not be copied.\nFile already exists in this folder.');
                IPCExtras_1.IPCExtras.send(event, "toast", { "msg": msg, "duration": 3000 });
                error++;
                continue;
            }
            let worked = false;
            try {
                fs.copyFileSync(file, newFile);
                worked = true;
            }
            catch (err) {
                failed++;
            }
            if (fs.existsSync(newFile) && worked && deleteAfterCopy) {
                try {
                    let inos = await this.deleteFiles([item_id], undefined);
                    deletedInos.push(...inos);
                }
                catch (err) {
                    failed++;
                }
            }
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loadingCH, { "value": (index + 1), "max": max, "title": title, "close": false });
            }
        }
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loadingCH, { "close": true });
        }
        if (deletedInos.length > 0) {
            IPCExtras_1.IPCExtras.send(event, "file-io", {
                action: "delete",
                list: deletedInos,
            });
        }
    }
    //Rename folder
    async renameFolderWithUpdate(event, data) {
        const { action, loading, path: oldPath, name: foldername } = data;
        if (action !== "rename-folder")
            return;
        console.log(data);
        const newPath = path_1.default.join(path_1.default.dirname(oldPath), foldername);
        if (fs.existsSync(newPath)) {
            if (loading)
                IPCExtras_1.IPCExtras.send(event, loading, { "close": true });
            IPCExtras_1.IPCExtras.send(event, "toast", { "msg": 'A folder with this name already exists.', "duration": 1500 });
            return;
        }
        const renamed = await this.renameFolder(oldPath, newPath, (progress) => {
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, {
                    value: progress.index,
                    max: progress.max,
                    title: progress.index + "/" + progress.max,
                    close: false,
                });
            }
        });
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 1,
                max: 1,
                title: "Done",
                close: true,
            });
        }
        IPCExtras_1.IPCExtras.send(event, "file-io", {
            action: "rename-folder",
            suc: renamed
        });
    }
    async renameFolder(oldPath, newPath, onProgress) {
        const BATCH_SIZE = 500;
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        if (fs.existsSync(newPath)) {
            return false;
        }
        try {
            // Rename the folder
            fs.renameSync(oldPath, newPath);
        }
        catch (error) {
            console.error(`Failed to rename folder ${oldPath} to ${newPath}:`, error);
            return false;
        }
        try {
            // Fetch all affected files
            const affectedFiles = await knex("Files")
                .where("path", oldPath)
                .orWhere("path", "like", `${oldPath}${path_1.default.sep}%`)
                .select([knex.raw('CAST(ino AS TEXT) AS ino'), "path"]);
            if (affectedFiles.length === 0) {
                console.log("No files to update in the database.");
                return true;
            }
            let processedCount = 0;
            // Process files in batches
            for (let i = 0; i < affectedFiles.length; i += BATCH_SIZE) {
                const batch = affectedFiles.slice(i, i + BATCH_SIZE);
                // Prepare batch updates
                const updates = batch.map((file) => {
                    const relativePath = path_1.default.relative(oldPath, file.path); // Get the relative path
                    const updatedPath = path_1.default.join(newPath, relativePath); // Construct the new path
                    const mFolder = Helper_1.Helper.calcMFolder(updatedPath, this.mainApp); // Calculate mfolder
                    return { ino: file.ino, path: updatedPath, mfolder: mFolder };
                });
                // Perform batch update
                await Promise.all(updates.map(async (update) => {
                    await knex("Files")
                        .where("ino", update.ino)
                        .update({ path: update.path, mfolder: update.mfolder });
                }));
                // Update progress
                processedCount += batch.length;
                if (onProgress) {
                    onProgress({ index: processedCount, max: affectedFiles.length });
                }
            }
        }
        catch (error) {
            console.error(`Failed to update database for folder ${oldPath}:`, error);
            return false;
        }
        return true;
    }
    //Delete folder
    async deleteFolderWithUpdate(event, data) {
        const { action, loading, path: folderPath } = data;
        if (action !== "delete-folder")
            return;
        const deleted = await this.deleteFolder(folderPath, (progress) => {
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, {
                    value: progress.index,
                    max: progress.max,
                    title: progress.index + "/" + progress.max,
                    close: false,
                });
            }
        });
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 1,
                max: 1,
                title: "Done",
                close: true,
            });
        }
        IPCExtras_1.IPCExtras.send(event, "file-io", {
            action: "delete-folder",
            suc: deleted
        });
    }
    async deleteFolder(folderPath, onProgress) {
        const BATCH_SIZE = 500;
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        if (!fs.existsSync(folderPath)) {
            console.error(`Folder ${folderPath} does not exist.`);
            return false;
        }
        try {
            // Fetch all files in the folder and its subfolders
            const affectedFiles = await knex("Files")
                .where("path", folderPath)
                .orWhere("path", "like", `${folderPath}${path_1.default.sep}%`)
                .select([knex.raw('CAST(ino AS TEXT) AS ino')]);
            if (affectedFiles.length === 0) {
                console.log("No files to delete in the folder.");
            }
            else {
                // Extract the ino values
                const inos = affectedFiles.map((file) => file.ino);
                // Use the existing deleteFiles function to handle file deletions
                await this.deleteFiles(inos, onProgress);
            }
            // Delete the folder and its contents
            //fs.rmdirSync(folderPath, { recursive: true });
            await DeleteHelper_1.DeleteHelper.deleteFile(folderPath, this.mainApp.settings.s_direct_delete);
        }
        catch (error) {
            console.error(`Failed to delete folder ${folderPath}:`, error);
            return false;
        }
        return true;
    }
    //Delete Folders
    async deleteFolders(event, data) {
        console.log("deleteFolders called with data:", data);
        const { action, paths, loading } = data;
        if (action !== "delete-folders")
            return;
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 0,
                max: paths.length,
                title: 0 / +paths.length,
                close: false,
            });
        }
        const deletedPaths = await this.deleteFoldersWithUpdate(paths, (progress) => {
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, {
                    value: progress.index,
                    max: progress.max,
                    title: progress.index + "/" + progress.max,
                    close: false,
                });
            }
        });
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 1,
                max: 1,
                title: "Done",
                close: true,
            });
        }
        IPCExtras_1.IPCExtras.send(event, "file-io", {
            action: "delete-folders",
            list: deletedPaths
        });
    }
    async deleteFoldersWithUpdate(paths, onProgress) {
        const deletedPaths = [];
        const BATCH_SIZE = 500;
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        paths = paths.filter((p) => p && fs.existsSync(p)); // Filter out non-existing paths
        if (!paths || paths.length === 0)
            return deletedPaths;
        let processedCount = 0;
        for (let i = 0; i < paths.length; i += BATCH_SIZE) {
            const batch = paths.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (folderPath) => {
                try {
                    // Delete the folder and its contents
                    await DeleteHelper_1.DeleteHelper.deleteFolder(folderPath, this.mainApp.settings.s_direct_delete);
                    deletedPaths.push(folderPath);
                    console.log(`Deleted folder: ${folderPath}`);
                    // Remove folder entries from the database
                    let inos = await knex("Files")
                        .where("path", "like", `${folderPath}${path_1.default.sep}%`)
                        .orWhere("path", folderPath)
                        .select([knex.raw('CAST(ino AS TEXT) AS ino')]);
                    inos = inos.map((file) => file.ino);
                    await DeleteHelper_1.DeleteHelper.deleteDataByInoFromDatabase(inos, knex);
                }
                catch (error) {
                    console.error(`Failed to delete folder ${folderPath}:`, error);
                }
                // Update progress after processing each folder
                processedCount++;
                if (onProgress) {
                    onProgress({ index: processedCount, max: paths.length });
                }
            }));
        }
        return deletedPaths;
    }
    /**
     * Moves a folder and all its contents (files and subfolders) to a new destination,
     * updating the database entries for all affected files.
     * @param event The IPC event object.
     * @param data Object containing oldPath (source folder), newPath (destination folder), and optional loading indicator.
     */
    async moveFolderWithUpdate(event, data) {
        let { action, loading, oldPath, newPath } = data;
        if (action !== "move-folder")
            return;
        console.log(`Attempting to move folder from ${oldPath} to ${newPath}`);
        //Adjust paths
        let oldPathFolderName = path_1.default.basename(oldPath);
        if (oldPath.endsWith(path_1.default.sep)) {
            oldPath = oldPath.slice(0, -1); // Remove trailing slash if present
        }
        if (newPath.endsWith(path_1.default.sep)) {
            newPath = newPath.slice(0, -1); // Remove trailing slash if present
        }
        newPath = path_1.default.join(newPath, oldPathFolderName); // Ensure the new path includes the folder name
        console.log(`Adjusted paths: oldPath=${oldPath}, newPath=${newPath}`);
        //Check if the source folder exists and the destination does not
        if (!fs.existsSync(oldPath)) {
            if (loading)
                IPCExtras_1.IPCExtras.send(event, loading, { "close": true });
            IPCExtras_1.IPCExtras.send(event, "toast", { "msg": 'Source folder does not exist.', "duration": 5000 });
            console.error(`Source folder not found: ${oldPath}`);
            return;
        }
        //Check if the destination folder already exists
        if (fs.existsSync(newPath)) {
            if (loading)
                IPCExtras_1.IPCExtras.send(event, loading, { "close": true });
            IPCExtras_1.IPCExtras.send(event, "toast", { "msg": 'A folder or file already exists at the destination.', "duration": 5000 });
            console.error(`Destination already exists: ${newPath}`);
            return;
        }
        //Check if the destination path is a subfolder of the source path
        if (newPath.startsWith(oldPath + path_1.default.sep)) {
            if (loading)
                IPCExtras_1.IPCExtras.send(event, loading, { "close": true });
            IPCExtras_1.IPCExtras.send(event, "toast", { "msg": 'Cannot move a folder into itself.', "duration": 5000 });
            console.error(`Cannot move folder into itself: ${oldPath} -> ${newPath}`);
            return;
        }
        const moved = await this.moveFolder(oldPath, newPath, (progress) => {
            if (loading) {
                IPCExtras_1.IPCExtras.send(event, loading, {
                    value: progress.index,
                    max: progress.max,
                    title: progress.title || `${progress.index}/${progress.max}`,
                    close: false,
                });
            }
        });
        if (loading) {
            IPCExtras_1.IPCExtras.send(event, loading, {
                value: 1,
                max: 1,
                title: "Done",
                close: true,
            });
        }
        IPCExtras_1.IPCExtras.send(event, "file-io", {
            action: "move-folder",
            suc: moved
        });
    }
    /**
     * Recursively moves a folder and its contents, updating database paths.
     * @param oldFolderPath The original path of the folder to move.
     * @param newFolderPath The new destination path for the folder.
     * @param onProgress Callback for progress updates.
     * @returns True if the move was successful, false otherwise.
     */
    async moveFolder(oldFolderPath, newFolderPath, onProgress) {
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        try {
            // 1. Move the folder on the file system
            await fs_1.promises.rename(oldFolderPath, newFolderPath);
            console.log(`Folder moved from ${oldFolderPath} to ${newFolderPath}`);
            // 2. Update database entries for all files within the moved folder
            // Select all files whose paths start with the old folder path
            const affectedFiles = await knex("Files")
                .where("path", oldFolderPath) // Files directly in the old folder
                .orWhere("path", "like", `${oldFolderPath}${path_1.default.sep}%`) // Files in subfolders
                .select([knex.raw('CAST(ino AS TEXT) AS ino'), "path"]);
            if (affectedFiles.length === 0) {
                console.log("No files in the database associated with the moved folder. No database update needed.");
                return true;
            }
            let processedCount = 0;
            const totalFiles = affectedFiles.length;
            const BATCH_SIZE = 100; // Adjust batch size as needed
            for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
                const batch = affectedFiles.slice(i, i + BATCH_SIZE);
                const updates = batch.map((file) => {
                    // Calculate the relative path from the old base folder
                    const relativePath = path_1.default.relative(oldFolderPath, file.path);
                    // Construct the new absolute path
                    const updatedPath = path_1.default.join(newFolderPath, relativePath);
                    // Recalculate mfolder for the new path
                    const mFolder = Helper_1.Helper.calcMFolder(updatedPath, this.mainApp);
                    return { ino: file.ino, path: updatedPath, mfolder: mFolder };
                });
                await Promise.all(updates.map(async (update) => {
                    await knex("Files")
                        .where("ino", update.ino)
                        .update({ path: update.path, mfolder: update.mfolder });
                }));
                processedCount += batch.length;
                if (onProgress) {
                    onProgress({
                        index: processedCount,
                        max: totalFiles,
                        title: `Updating database for moved files: ${processedCount}/${totalFiles}`
                    });
                }
            }
            console.log(`Successfully updated database for ${processedCount} files after folder move.`);
            return true;
        }
        catch (error) {
            console.error(`Failed to move folder ${oldFolderPath} to ${newFolderPath} or update database:`, error);
            return false;
        }
    }
    //Get Data
    async getEditViewData(data) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        //full ["base","casp","cobj","clip","relation","note","images","curseForge","s4sMerged"];
        let sel = data.sel || ["base", "note"];
        if (data.selFull)
            sel = ["base", "casp", "cobj", "clip", "relation", "note", "images", "curseForge", "s4sMerged", "poseData"];
        let id = data.id || data.ino;
        if (!id)
            throw new Error("No id provided");
        //Basic data
        let basicData = await this.getBasicData(id, knex);
        if (!basicData)
            return null;
        //Images
        let images = [];
        if (sel.includes("images")) {
            try {
                images = await this.getImages(basicData);
            }
            catch (error) {
                console.error("Failed to get images:", error);
            }
        }
        //Note
        let note = null;
        if (sel.includes("note")) {
            let ino = basicData.ino;
            let filename = (0, FilenameUtils_1.clearName)(basicData.name);
            note = this.mainApp.noteController.getNote(ino, filename);
        }
        //Internal 
        let filepath = path_1.default.join(basicData.path, basicData.name);
        let s4sMerged = null;
        let casp = null;
        if ((sel.includes("s4sMerged") || sel.includes("casp")) && fs.existsSync(filepath)) {
            let pack = new DBPFReader_1.Pack(filepath);
            pack.checkFile();
            if (!pack.error) {
                pack.calculateIndexList();
                //Casp
                if (sel.includes("casp") && basicData.casp) {
                    casp = await this.getCaspData(pack, basicData, knex);
                }
                //S4S Merged
                if (sel.includes("s4sMerged") && pack.isS4SMerged) {
                    try {
                        let manifestInfo = pack.getS4SMergedManifest();
                        manifestInfo.resources = Array.from(pack.resources);
                        s4sMerged = manifestInfo;
                    }
                    catch (error) {
                        //Nix
                        console.log(error);
                    }
                }
                else {
                    console.log("S4S Merged data not requested or pack is not S4S Merged.", {
                        notRequested: !sel.includes("s4sMerged"),
                        isS4SMerged: pack.isS4SMerged
                    });
                }
            }
        }
        //CobjCom
        let cobj = null;
        if (sel.includes("cobj") && basicData.cobj) {
            cobj = await this.getCobjData(basicData, knex);
        }
        //CurseForge
        let curseForge = null;
        if (sel.includes("curseForge") && basicData.cf_id) {
            let curseID = basicData.cf_id;
            const curseResultComplete = await knex.select().where("id", curseID).from("CurseForge");
            const modFiles = await knex.select([knex.raw('CAST(Files.ino AS TEXT) AS ino'), "image", "name", "image_source", "ino"]).where("cf_id", curseID).from("Files");
            if (curseResultComplete && curseResultComplete.length == 1) {
                curseForge = curseResultComplete[0];
                /*let downloadedCurseForgeImage = null;
                let cfImagePath = baseFolderPath + path.sep + "images" + path.sep + "[CF]" + curseID + ".png";
                if (fs.existsSync(cfImagePath)) downloadedCurseForgeImage = cfImagePath;
                    if (curseResult) {
                        curseForge = curseResult;
                        curseForge.cfImage = downloadedCurseForgeImage;
                        curseForge.files = modFiles;
                }*/
                curseForge.files = modFiles;
            }
        }
        //PoseData
        let poseData = null;
        if (sel.includes("poseData") && basicData.clip) {
            try {
                poseData = await this.getPoseData(basicData);
            }
            catch (error) {
                console.error("Failed to get pose data for clip:", error);
            }
        }
        let returnObject = {
            id: id,
            base: basicData,
            casp: casp,
            cobj: cobj,
            clip: null,
            relation: null,
            note: note,
            images: images,
            curseForge: curseForge,
            s4sMerged: s4sMerged,
            poseData: poseData
        };
        //console.log("Returning edit view data:", returnObject);
        return returnObject;
    }
    async getBasicData(id, knex) {
        const q = knex.from("Files").select(["*", knex.raw('CAST(ino AS TEXT) AS ino')]).where("ino", id);
        const result = await q;
        return result.length > 0 ? result[0] : null;
    }
    async getImages(basicData) {
        const images = [];
        if (!basicData)
            return images;
        //From image
        if (basicData.image && fs.existsSync(basicData.image)) {
            let checksum = "";
            try {
                const fileBuffer = fs.readFileSync(basicData.image);
                checksum = crypto.createHash("sha1").update(fileBuffer).digest("hex");
            }
            catch (error) {
                console.error("Failed to read image file:", error);
            }
            images.push({
                "source": +basicData.image_source,
                "path": basicData.image,
                "thum": true,
                "checksum": checksum
            });
        }
        //From pack
        let filepath = path_1.default.join(basicData.path, basicData.name);
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        if (!fs.existsSync(tmpFolder)) {
            throw new Error("Temporary folder does not exist");
        }
        if (basicData.type == 1 && fs.existsSync(filepath)) {
            let pack = new DBPFReader_1.Pack(filepath);
            pack.checkFile();
            if (pack.error) {
                console.error("Pack check failed for file:", filepath);
                return images;
            }
            pack.calculateIndexList();
            //Get all THUM entries
            let thums = pack.index_List.filter((entry) => (entry.type === DBPFReader_1.TagType.THUM || entry.type === DBPFReader_1.TagType.S4MMTHUM));
            for (let entry of thums) {
                //let imageFile = path.join(tmpFolder, "c_" + `${Date.now()}_${entry.getKey()}.png`);
                let imageFile = path_1.default.join(tmpFolder, `${entry.getKey()}.png`);
                // Save the thumbnail to a temporary file
                try {
                    const inp = entry.getByteArray();
                    if (entry.type == DBPFReader_1.TagType.THUM) {
                        await DBPFReader_1.PackHandler.saveBufferToFile(imageFile, inp, true);
                    }
                    else if (entry.type == DBPFReader_1.TagType.S4MMTHUM) {
                        fs.writeFileSync(imageFile, inp); // S4MMTHUM is already in PNG format
                    }
                }
                catch (error) {
                    console.error("Failed to save thumbnail data:", error);
                    continue; // Skip this entry if saving fails
                }
                let checksum = "";
                try {
                    const fileBuffer = fs.readFileSync(imageFile);
                    checksum = crypto.createHash("sha1").update(fileBuffer).digest("hex");
                }
                catch (error) {
                    console.error("Failed to read image file:", error);
                }
                images.push({
                    "source": 1,
                    "path": imageFile,
                    "thum": false,
                    "checksum": checksum
                });
            }
        }
        return images;
    }
    async getCaspData(pack, basicData, knex) {
        let casp = null;
        if (!basicData || !basicData.casp) {
            return casp;
        }
        //Get all CasParts
        let casParts = await knex.from("CasPart").select([
            "instance",
            "age",
            "body",
            "casFlags",
            "gender",
            "packId",
            "primSort",
            "sortLayer",
            "species",
            "swatch",
            "propId"
        ]).where("ino", basicData.ino);
        if (casParts.length === 0) {
            return casp;
        }
        casp = DBPFReader_1.CASPFile.combine(casParts);
        casp.parts = casParts;
        return casp;
    }
    async getCobjData(basicData, knex) {
        let cobj = null;
        if (!basicData || !basicData.cobj) {
            return cobj;
        }
        //Get all CobjCom
        let cobjComs = await knex.from("CobjCom").select([
            "pmax",
            "pmin",
            "bb",
            "pat",
            "bu",
            "ot"
        ]).where("ino", basicData.ino);
        if (cobjComs.length === 0) {
            return cobj;
        }
        cobj = cobjComs[0];
        return cobj;
    }
    async getCobjExtraData(data) {
        let ino = data.id || data.ino;
        if (!ino)
            throw new Error("No id/ino provided");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        let filepath = undefined;
        if (data.filepath && data.filename) {
            filepath = path_1.default.join(data.filepath, data.filename);
        }
        else if (data.id != undefined) {
            let db_Data = await knex.from("Files").select(["name", "path"]).where("ino", ino);
            if (db_Data.length > 0) {
                filepath = path_1.default.join(db_Data[0].path, db_Data[0].name);
            }
        }
        if (!filepath || !fs.existsSync(filepath))
            throw new Error("File not found");
        let pack = new DBPFReader_1.Pack(filepath);
        pack.checkFile();
        if (pack.error)
            throw new Error("Failed to read file");
        pack.calculateIndexList();
        let cobjPack = new DBPFReader_1.COBJPack(pack);
        return cobjPack.getModelFileGroups();
    }
    async getPoseData(basicData) {
        let file = path_1.default.join(basicData.path, basicData.name);
        if (!fs.existsSync(file))
            throw new Error("File not found");
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        if (!fs.existsSync(tmpFolder))
            throw new Error("Temporary folder does not exist");
        let posePacks = await DBPFReader_1.PosePackHelper.getPosePacksFromFile(file, tmpFolder);
        return posePacks;
    }
    //Save
    async saveEditViewChanges(changes) {
        let id = changes.id || changes.ino;
        if (!id)
            throw new Error("No id/ino provided");
        console.log("Changes to save:", changes);
        let baseData = null;
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        baseData = await this.getBasicData(id, knex);
        if (!baseData)
            throw new Error("No base data found for id/ino: " + id);
        //Note
        if (changes.note != undefined) {
            let note = changes.note.trim();
            if (note.length == 0)
                note = null; //If empty, set to null
            let ino = changes.ino || changes.id;
            let filename = (0, FilenameUtils_1.clearName)(baseData.name);
            await this.mainApp.noteController.saveNote(ino, filename, note);
        }
        //Rename
        let name = changes.name;
        if (name && name != "-") {
            let filepath = baseData.path + path_1.default.sep + baseData.name;
            if (fs.existsSync(filepath)) {
                let ex = path_1.default.extname(baseData.name);
                let nName = name + ex;
                let newFile = baseData.path + path_1.default.sep + nName;
                if (!fs.existsSync(newFile)) {
                    fs.renameSync(filepath, newFile);
                    if (fs.existsSync(newFile)) {
                        baseData.name = nName;
                    }
                }
            }
        }
        //Save new Thumbnail
        let image = changes.image;
        let imageFolder = this.mainApp.folderStructureController.getFolder("mods-images");
        if (image != undefined && image.path && image.source != undefined) {
            if (fs.existsSync(image.path) && fs.existsSync(imageFolder)) {
                let types = ["NONE", "[CC]", "[USER]", "[CACHE]", "[CF]"];
                let newFile = imageFolder + path_1.default.sep + types[image.source] + baseData.ino + ".png";
                let oldImage = baseData.image;
                if (oldImage.length && oldImage.length != 0 && fs.existsSync(oldImage)) {
                    //await doubleDelete(oldImage);
                }
                fs.copyFileSync(image.path, newFile);
                if (fs.existsSync(newFile)) {
                    baseData.image = newFile;
                    baseData.image_source = image.source;
                }
            }
        }
        //Update Database
        await knex('Files').update({
            "name": baseData.name,
            "image": baseData.image,
            "image_source": baseData.image_source
        }).where("ino", baseData.ino);
        return {
            base: baseData,
            note: this.mainApp.noteController.getNote(baseData.ino, (0, FilenameUtils_1.clearName)(baseData.name))
        };
    }
    async reloadEditViewData(data) {
        let id = data.id || data.ino;
        if (!id)
            throw new Error("No id/ino provided");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        let baseData = await this.getBasicData(id, knex);
        if (!baseData)
            throw new Error("No base data found for id/ino: " + id);
        //Reset
        baseData.casp = 0;
        baseData.cobj = 0;
        baseData.clip = 0;
        baseData.merged = 0;
        baseData.recolor = 0;
        baseData.xml_types = "";
        try {
            await knex("Entries").where("ino", id).delete(); // Remove from Entries table
            await knex("CasPart").where("ino", id).delete(); // Remove from CasPart table
            await knex("CobjCom").where("ino", id).delete(); // Remove from CobjCom table
            await knex("CasCombined").where("ino", id).delete(); // Remove from CasCombined table        
        }
        catch (error) {
            console.error(`Failed to remove file ${id} from database:`, error);
        }
        // Reload
        let idb = {
            ressoucen_insert: [],
            ressoucen_update: [],
            files: [],
            casparts_insert: [],
            cobj_com_insert_update: [],
            cascombined_insert: [],
        };
        let filepath = path_1.default.join(baseData.path, baseData.name);
        if (fs.existsSync(filepath)) {
            let pack = new DBPFReader_1.Pack(filepath);
            pack.checkFile();
            if (pack.error) {
                console.error("Pack check failed for file:", filepath);
                return null;
            }
            let iip = new DBPFReader_1.ImportInfoPack(pack);
            iip.analyze();
            //Ressoucen
            idb.ressoucen_insert = iip.resourcenList.map((item) => {
                item.ino = baseData.ino.toString();
                return item;
            });
            //Casparts
            idb.casparts_insert = iip.caspFiles.map((caspFile) => {
                let item = caspFile.getDatabaseValues();
                item.ino = baseData.ino.toString();
                return item;
            });
            //Combined Casparts
            idb.cascombined_insert = iip.getCombindedCaspData().map((caspCombined) => {
                caspCombined.ino = baseData.ino.toString();
                return caspCombined;
            });
            //Cobj
            if (iip.includesCobj) {
                pack.calulateCOBJFiles();
                let cobjRes = pack.cobjResource;
                if (cobjRes) {
                    console.log(cobjRes);
                    let bb = Helper_1.Helper.numberSetToHexString(cobjRes.buyCat);
                    let bu = Helper_1.Helper.numberSetToHexString(cobjRes.buildSet);
                    let pat = Helper_1.Helper.numberSetToHexString(cobjRes.patternSet);
                    let ot = Helper_1.Helper.numberSetToHexString(cobjRes.otherSet);
                    let obj_cobj = {
                        "ino": baseData.ino,
                        "pmin": cobjRes.pMin,
                        "pmax": cobjRes.pMax,
                        "bb": bb.length > 0 ? bb : null,
                        "bu": bu.length > 0 ? bu : null,
                        "pat": pat.length > 0 ? pat : null,
                        "ot": ot.length > 0 ? ot : null,
                    };
                    idb.cobj_com_insert_update.push(obj_cobj);
                }
            }
            //Clip
            if (iip.includesXml) {
                pack.calculateXMLFiles();
                if (pack.xmlResource) {
                    baseData.xml_types = pack.xmlResource.cTypesCombinedString ? pack.xmlResource.cTypesCombinedString : "";
                }
            }
            baseData.casp = iip.includesCasp;
            baseData.cobj = iip.includesCobj;
            baseData.clip = iip.includesClip;
            baseData.smod = iip.includesSmod;
            baseData.merged = iip.isMerged;
            baseData.recolor = iip.isRecolor;
            //Update Files
            await knex('Files').update({
                "casp": baseData.casp ? 1 : 0,
                "cobj": baseData.cobj ? 1 : 0,
                "clip": baseData.clip ? 1 : 0,
                "smod": baseData.smod ? 1 : 0,
                "merged": baseData.merged ? 1 : 0,
                "recolor": baseData.recolor ? 1 : 0,
                "xml_types": baseData.xml_types ? baseData.xml_types : ""
            }).where("ino", baseData.ino);
            //Insert idb
            await this.mainApp.fileLoadingController.insertOrUpdateFile(idb, true);
            return true;
        }
    }
}
exports.FileController = FileController;
