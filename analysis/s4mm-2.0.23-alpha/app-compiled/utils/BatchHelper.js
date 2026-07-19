"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchHelper = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DBPFReader_1 = require("../sims/DBPFReader");
const Helper_1 = require("./Helper");
class BatchHelper {
    static async activateDeactivateFileWorker(fileData, sharedData) {
        let result = {
            needsDatabaseUpdate: false,
            updateData: undefined
        };
        let turnActive = fileData.turnActive;
        if (turnActive == undefined)
            throw new Error("No turnActive provided");
        let ino = fileData.ino;
        if (!ino)
            throw new Error("No ino provided");
        let name = fileData.name;
        let filepath = fileData.path;
        if (!name || !filepath) {
            let fileData = await ipcRenderer.invoke("db-files", { action: "get-by-ino", ino: ino.toString() });
            if (!fileData)
                throw new Error("No file data found for ino: " + ino);
            name = fileData.name;
            filepath = fileData.path;
        }
        let completeFilepath = path_1.default.join(filepath, name);
        if (!fs_1.default.existsSync(completeFilepath))
            throw new Error("File not found: " + completeFilepath);
        //fileBase without extension
        let fileBase = path_1.default.basename(name, path_1.default.extname(name));
        let fileExt = path_1.default.extname(name);
        if (fileExt.toLowerCase().endsWith("off"))
            fileExt = fileExt.substring(0, fileExt.length - 3);
        let newName = fileBase + fileExt + (turnActive ? "" : "OFF");
        let newFilepath = path_1.default.join(filepath, newName);
        //Rename File
        try {
            fs_1.default.renameSync(completeFilepath, newFilepath);
            result.updateData = {
                ino: ino,
                name: newName
            };
            result.needsDatabaseUpdate = true;
        }
        catch (error) {
            console.error("Error renaming file", error);
            throw new Error("Error renaming file: " + error);
        }
        return result;
    }
    static async recalcPackageFileWorker(data) {
        //Base values
        let ino = data.ino;
        let filepath = path_1.default.join(data.path, data.name);
        if (!ino)
            throw new Error("No ino provided");
        if (!filepath)
            throw new Error("No filepath provided");
        if (!fs_1.default.existsSync(filepath))
            throw new Error("File not found: " + filepath);
        let baseData = {
            ino: ino
        };
        baseData.casp = 0;
        baseData.cobj = 0;
        baseData.clip = 0;
        baseData.merged = 0;
        baseData.recolor = 0;
        baseData.xml_types = "";
        // Reload
        let idb = {
            ressoucen_insert: [],
            ressoucen_update: [],
            files: [],
            casparts_insert: [],
            cobj_com_insert_update: [],
            cascombined_insert: []
        };
        if (fs_1.default.existsSync(filepath)) {
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
            baseData.casp = iip.includesCasp ? 1 : 0;
            baseData.cobj = iip.includesCobj ? 1 : 0;
            baseData.clip = iip.includesClip ? 1 : 0;
            baseData.smod = iip.includesSmod ? 1 : 0;
            baseData.merged = iip.isMerged ? 1 : 0;
            baseData.recolor = iip.isRecolor ? 1 : 0;
        }
        await ipcRenderer.invoke("files-loading-extra", {
            action: "update-recalc-package-file",
            ino: ino,
            baseData: baseData,
            idb: idb,
            fast: data.fast ? true : false
        });
        return null;
    }
    static async refreshInternalThumbnailWorker(data, sharedData) {
        let ino = data.ino;
        if (!ino)
            throw new Error("No ino provided");
        let imagesFolder = sharedData.imagesFolder;
        if (!imagesFolder || !fs_1.default.existsSync(imagesFolder))
            throw new Error("No images folder found");
        let filepath = path_1.default.join(data.path, data.name);
        if (!ino)
            throw new Error("No ino provided");
        if (!filepath)
            throw new Error("No filepath provided");
        if (!fs_1.default.existsSync(filepath))
            throw new Error("File not found: " + filepath);
        let baseData = {
            ino: ino
        };
        try {
            let pack = new DBPFReader_1.Pack(filepath);
            pack.checkFile();
            if (pack.error)
                throw new Error("Internal package file error");
            let iip = new DBPFReader_1.ImportInfoPack(pack);
            iip.analyze();
            let thumbnail = await iip.exportBiggestThumbnail(imagesFolder, ino);
            if (thumbnail) {
                baseData.image = thumbnail;
                baseData.image_source = 1;
                //console.log("Thumbnail found for package file:", thumbnail);
            }
            else {
                return null;
            }
        }
        catch (error) {
            console.error("FileImportHelper.importNewPackageFile", error);
            return;
        }
        await ipcRenderer.invoke("files-loading-extra", {
            action: "update-recalc-package-file",
            ino: ino,
            baseData: baseData,
            fast: true,
            skipDelete: true
        });
    }
    static async scanGameFileWorker(data) {
        //Checks
        let filepath = data.filepath;
        if (!filepath)
            throw new Error("No filepath provided");
        if (!fs_1.default.existsSync(filepath)) {
            console.error("File not found:", filepath);
            return null;
        }
        if (!filepath.toLowerCase().endsWith(".package")) {
            console.error("File is not a package file:", filepath);
            return null;
        }
        let bigStats = fs_1.default.statSync(filepath, { bigint: true });
        let inoStr = bigStats.ino.toString();
        //Processing
        let gameIds = [];
        let pack = new DBPFReader_1.Pack(filepath);
        pack.checkFile();
        if (!pack.error) {
            pack.calculateIndexList();
            let indexList = pack.index_List;
            for (let index of indexList) {
                gameIds.push({
                    ino: inoStr,
                    type: index.r_type,
                    group: index.r_group,
                    instance: index.r_instance.toString(16).padStart(16, '0'),
                    address: index.getKey()
                });
            }
        }
        //Send to main process
        await ipcRenderer.invoke("game-scan", {
            action: "insert-game-ids",
            gameIds: gameIds
        });
        return {
            ino: inoStr,
            filepath: filepath,
            count: gameIds.length
        };
    }
}
exports.BatchHelper = BatchHelper;
