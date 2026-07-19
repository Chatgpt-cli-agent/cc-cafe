const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const util = require('util')
var CRC32 = require("crc-32");
const winTrash = require('win-trash');
const recyclebin = require('recycle-bin');
const RMAPUtils = require('./RegionMapCalulations.js').RMAPUtils;

const _dbpf = require('./DBPFReader.js');
const _helper = require('./Helper.js');
const Notes = require('./Notes.js').Notes;
const curseforge = require('@meza/curseforge-fingerprint');
const NAMEUTIL = require('./FilenameUtil.js');
const imageHash = require('image-hash-local-only');

const { DSTResource, DDSConverter } = require('./DDS.js');

const { processImageBuffer, processImageBufferWithOptions } = require('./SimilarImageProcessing.js');

const GAMESTATE = require('./GameState.js').GameState;

var baseFolderPath = "";
var logFolderPath = undefined;
let modFolder = "";
var casSimPath_thumbnails = "";
let workerID = -1;
let checkCach = false;

let log_file = undefined;
let log_stdout = undefined;

let extraLogs = false;

console.log = function(d) { //
    if (log_file) log_file.write(util.format(d) + '\n');
    if (log_stdout) log_stdout.write(util.format(d) + '\n');
};

let meshCach = new Map();

function setup(wID, bfp, cc, data) {
    checkCach = cc;
    if (wID != undefined) workerID = wID;

    if (data && data.casSimPath_thumbnails) casSimPath_thumbnails = data.casSimPath_thumbnails;

    //Log
    createBaseFolder(bfp);
    if (logFolderPath) {
        log_file = fs.createWriteStream(logFolderPath + '/workerLog_' + workerID + '.log', { flags: 'w' });
        log_stdout = process.stdout;
    }
    console.log("[WORKER] Started Worker - " + process.pid);
    //Conect to Database
    return true;
}

function getFileStats(filePath) {
    return fs.statSync(filePath);
}

function createBaseFolder(bfp) {
    baseFolderPath = bfp;
    if (!fs.existsSync(baseFolderPath)) {
        fs.mkdirSync(baseFolderPath);
    }

    //Images
    let images = baseFolderPath + path.sep + "images";
    if (fs.existsSync(baseFolderPath) && !fs.existsSync(images)) {
        fs.mkdirSync(images);
    }

    //Tmp
    let tmp = baseFolderPath + path.sep + "temp";
    if (fs.existsSync(baseFolderPath) && !fs.existsSync(tmp)) {
        fs.mkdirSync(tmp);
    }

    //Cache
    let cFolder = baseFolderPath + path.sep + "cache";
    if (fs.existsSync(baseFolderPath) && !fs.existsSync(cFolder)) {
        fs.mkdirSync(cFolder);
    }

    //Mood
    let cMood = cFolder + path.sep + "mood";
    if (fs.existsSync(cFolder) && !fs.existsSync(cMood)) {
        fs.mkdirSync(cMood);
    }

    //Mood
    let cCASCOBJ = cFolder + path.sep + "cas-cobj";
    if (fs.existsSync(cFolder) && !fs.existsSync(cCASCOBJ)) {
        fs.mkdirSync(cCASCOBJ);
    }

    tmpFolderPath = tmp;

    console.log("[DATA-PATH]: " + baseFolderPath + " (" + fs.existsSync(baseFolderPath) + ")");
}


//Dups & Conflicts
let crc32Update = [];
async function calcCRC32(element) {
    const eID = element.id;
    const ePath = element.path + path.sep + element.name;
    if (fs.existsSync(ePath)) {
        checksum = crcPart(ePath);
        crc32Update.push({ "id": eID, "crc": checksum })
    }
    if (crc32Update.length > 150) await updataCRC();
}

function crcPart(filePath) {
    let fileID = fs.openSync(filePath);
    let bufferSize = 2048;
    let size = (fs.statSync(filePath)).size;
    if (bufferSize > size) bufferSize = size - 1;
    let buf = Buffer.alloc(bufferSize);
    fs.readSync(fileID, buf, 0, bufferSize, (size - bufferSize - 1));
    fs.closeSync(fileID);
    let checksum = CRC32.buf(buf, 0);
    return checksum;

}

async function updataCRC() {
    if (crc32Update.length == 0) return;
    //Bulk update crc
    try {
        //await crcBatch(crc32Update);
        crc32Update = [];
    } catch (error) {
        console.log(error);
    }
}


//Import & File Handeling
let tagCatalog = [];
let cacheImageMap = new Map();
var filesMap = new Map();
var casps_Insert = [];
var casps_Update = [];
var cobj_Insert = [];
var cobj_Update = [];
var caspPart_Update = [];
var caspPart_Insert = [];
var caspPart_Update_Key = [];
let fileUpdate = [];
let entries_insert = [];

async function handleLoadFile(element) {
    let clear_name = element.name;
    let filepath = element.filepath;
    let eName = element.name;
    let folderPath = "";
    let stats = getFileStats(filepath);
    let inoId = stats.ino;
    let eImg = {};
    let curseForgeData = undefined;

    if (element.curseforge) curseForgeData = element.curseforge;
    if (element.image) eImg = element.image;
    let lastIndex = String(filepath).lastIndexOf(path.sep);
    if (lastIndex > 0) {
        folderPath = String(filepath).substring(0, lastIndex);
    }


    folderPath = folderPath;
    clear_name = NAMEUTIL.clearName(eName);

    try {
        const rows = await getRowsWithIno(inoId);
        let l = rows.length;
        //File Not it Datebase

        if (l == 0) {
            //Insert new Data
            await addFileToDataBase(filepath, clear_name, eName, stats, folderPath, eImg, curseForgeData);
        } else {
            let rowElement = rows[0];
            let size = stats.size;
            let mTimeString = stats.mtime;
            let data = new Date(mTimeString);
            let mtime = Math.floor(data.valueOf() / 1000);
            let needUpdate = (rowElement.name != eName) || (rowElement.clear_name != clear_name) || (rowElement.path != folderPath) || (rowElement.size != size) || (rowElement.mtime != mtime);
            if (!needUpdate) {
                return -1;
            }

            let mainfolder = folderPath.split(path.sep)[modFolder.split(path.sep).length];
            if (!mainfolder) mainfolder = "";

            let upElement = {
                "key": "id",
                "value": rowElement.id,
                "data": {
                    "name": eName,
                    "path": folderPath,
                    "mfolder": mainfolder,
                    "clear_name": clear_name,
                    "mtime": mtime,
                    "size": size,
                    "indownloads": inModFolder(folderPath) ? null : true
                }
            };

            fileUpdate.push(upElement);
            //Update info
            //TO-DO Compere Last Change Date 
        }
    } catch (er) {
        console.log(er);
    }

    return inoId;
}


function inModFolder(filepath) {
    return filepath.startsWith(modFolder);
}

function checkcacheImage(item) {
    if (cacheImageMap.size == 0 || !item || !item.ressourcen) {
        return "";
    }
    let list = getCacheImagesFromRessoucen(item.ressourcen);
    if (list.length == 0) return "";
    return list[0];
}

function getCacheImagesFromRessoucen(ressouce) {
    let list = [];


    if (!ressouce || ressouce == undefined || ressouce == null || ressouce.length == 0 || ressouce.trim().length == 0) return list;

    let items = ressouce.split(":");
    items.forEach(element => {
        if (element.startsWith("034aeecb") || element.startsWith("319e4f1d")) {
            let sp = element.split("-");
            if (sp.length == 3) {
                let inst = sp[2].toUpperCase();
                if (cacheImageMap.has(inst)) {
                    let p = cacheImageMap.get(inst);
                    list.push(p);
                }
            }
        }
    });

    return list;
}

async function addFileToDataBase(filepath, clear_name, name, stats, pP, image, curseForgeData) {

    let hasImage = image.path && image.source && image.path.length != 0 && image.source != 0;
    let imageFolder = baseFolderPath + path.sep + "images";

    //Stats
    let inoId = stats.ino;
    let size = stats.size;
    let mTimeString = stats.mtime;
    let data = new Date(mTimeString);
    let mtime = Math.floor(data.valueOf() / 1000);

    let folderpath = path.dirname(filepath);
    let mainfolder = folderpath.split(path.sep)[modFolder.split(path.sep).length];
    if (!mainfolder) mainfolder = "";

    let isCurseForge = curseForgeData != undefined;
    let c_id = 0;
    let isMod = false;
    if (isCurseForge) {
        c_id = curseForgeData.id;
        isMod = curseForgeData.classId == 5089;
    }


    let pack = undefined;
    let filelow = filepath.toLocaleLowerCase();
    let isPackage = filelow.endsWith(".package") || filelow.endsWith(".packageoff");
    if (isPackage) pack = new _dbpf.Pack(filepath);
    if (isPackage) {
        try {
            pack.checkFile();
            if (!pack.error && fs.existsSync(imageFolder)) {
                pack.inoId = inoId;
                pack.calculateIndexList();
                if (!hasImage) await pack.exportBiggest(imageFolder);
                pack.calulateCASPFiles();
                pack.calulateCOBJFiles();
                pack.calulateCLIPFiles();

                let items = pack.index_List;
                for (let index = 0; index < items.length; index++) {
                    const element = items[index];
                    entries_insert.push({
                        ino: inoId,
                        type: element.r_type,
                        group: element.r_group,
                        instance: _dbpf.Basic.getInstanceKey(element)
                    });
                }

            }
        } catch (err) {
            console.log("Error in: " + filepath);
            console.log(err);
            console.log("");
        }
    }

    //Define base values
    let id_casp = 0;
    let obj_casp = undefined;
    let id_cobj = 0;
    let obj_cobj = undefined;
    let id_clip = 0;
    let error = 0;
    let isRecolor = 0;
    let isMerged = 0;
    let categories = "";

    //Check for special types (CASP, COBJ & CLIP)
    if (pack && pack.caspResource != undefined) {
        let casp = pack.caspResource;
        if (casp.isMerged == true) isMerged = 1;
        if (casp.isRecolor == true) isRecolor = 1;
        let pSort = null;
        let sSort = null;
        if (casp.priSortOrder.size == 1) pSort = casp.priSortOrder.values().next().value;
        if (casp.secSortOrder.size == 1) sSort = casp.secSortOrder.values().next().value;
        obj_casp = {
            "ino": inoId,
            "age": _helper.Helper.setToString(casp.age),
            "gender": _helper.Helper.setToString(casp.gender),
            "bodyType": _helper.Helper.setToString(casp.bodyType),
            "casFlags": _helper.Helper.setToString(casp.casFlags),
            "tgi_list": _helper.Helper.setToString(casp.tgi_list),
            "instances": _helper.Helper.setToString(casp.instances),
            "pSort": pSort,
            "sSort": sSort,
            "species": _helper.Helper.numberSetToHexString(casp.species),
            "packIDs": _helper.Helper.numberSetToHexString(casp.packIDs)
        }
        id_casp = 1;

        //CaspParts
        for (let index = 0; index < casp.caspFiles.length; index++) {
            const caspFile = casp.caspFiles[index];

            let ageArr = [];
            let genderArr = [];
            let ag_bin = caspFile.ageGender.toString(2).padStart(16, "0");
            //Age
            if (ag_bin.charAt(15) == "1") ageArr.push("[BABY]");
            if (ag_bin.charAt(14) == "1") ageArr.push("[TODDLER]");
            if (ag_bin.charAt(13) == "1") ageArr.push("[CHILD]");
            if (ag_bin.charAt(12) == "1") ageArr.push("[TEEN]");
            if (ag_bin.charAt(11) == "1") ageArr.push("[YOUNGADULT]");
            if (ag_bin.charAt(10) == "1") ageArr.push("[ADULT]");
            if (ag_bin.charAt(9) == "1") ageArr.push("[ELDER]");
            if (ag_bin.charAt(8) == "1") ageArr.push("[INFANT]");
            //Gender
            if (ag_bin.charAt(2) == "1") genderArr.push("[FEMALE]");
            if (ag_bin.charAt(3) == "1") genderArr.push("[MALE]");


            //BodyType
            let bodyType = Array.from(_dbpf.Helper.getBodyTypes(caspFile)).join(":");

            let caspFileItem = {
                propId: caspFile.propID,
                ino: inoId,
                swatch: caspFile.swatches.join(":"),
                instanceId: caspFile.instanceID,
                age: ageArr.join(":"),
                gender: genderArr.join(":"),
                bodyType: bodyType,
                primSortIndex: caspFile.primSortIndex,
                sortLayer: caspFile.sortLayer,
                packID: caspFile.packID,
                species: caspFile.species
            };
            //console.log(caspFileItem);
            caspPart_Insert.push(caspFileItem);
        }



    }
    if (pack && pack.cobjResource != undefined) {
        id_cobj = 1;
        let cobj = pack.cobjResource;

        let bb = _helper.Helper.numberSetToHexString(cobj.buyCat);
        let bu = _helper.Helper.numberSetToHexString(cobj.buildSet);
        let pat = _helper.Helper.numberSetToHexString(cobj.patternSet);
        let ot = _helper.Helper.numberSetToHexString(cobj.otherSet);

        obj_cobj = {
            "ino": inoId,
            "pmin": cobj.pMin,
            "pmax": cobj.pMax,
            "bb": bb.length > 0 ? bb : null,
            "bu": bu.length > 0 ? bu : null,
            "pat": pat.length > 0 ? pat : null,
            "ot": ot.length > 0 ? ot : null,
        }
    }
    if (pack && pack.clipResource != undefined) {
        id_clip = 1;
    }

    //CheckCategories
    let fileBaseName = path.basename(name);
    for (let index = 0; index < tagCatalog.length; index++) {
        const tagCatalogObj = tagCatalog[index];
        let categoireTag = tagCatalogObj.catgorie;
        let tag = tagCatalogObj.tag.toLocaleLowerCase();
        if (fileBaseName.toLocaleLowerCase().includes(tag) && !categories.includes(categoireTag)) {
            categories = categories + categoireTag;
        }
    }


    //Calculate ressourcen
    let resources = null;
    if (pack && !pack.error) {
        resources = _helper.Helper.setToString(pack.resources);
    } else if (pack && !clear_name.endsWith("ts4script")) {
        error = 1;
    }

    //Check for images
    //Normal image
    let imObj = getImageIfPossible(inoId, c_id, isMod);
    //Cache Thumbnail

    if (hasImage) {
        imObj = image;
        if (image.source == -1) {
            imObj = { "path": "", "source": 0 };
        }
    } else if (imObj.source == 0 && (id_casp != 1 || id_cobj != 1)) {
        let data = {
            "ressourcen": resources,
        };

        let cacheImage = checkcacheImage(data);
        if (cacheImage.length > 0) {
            imObj.path = cacheImage;
            imObj.source = 3;
        }
    }


    //Bundle Info 
    let resultObj = undefined;
    if (isMerged == 0 && id_casp > 0 && id_cobj > 0) {
        isMerged = 1;
    }

    let fingerprint = -1;
    try {
        if (size < 150000000) {
            fingerprint = curseforge.fingerprint(filepath);
        } else {
            console.log("[Error] File to big - size: " + size + " | path: " + filepath);
        }
    } catch (error) {
        console.log(error);
    }

    resultObj = {
        "path": pP,
        "mfolder": mainfolder,
        "ino": inoId,
        "clear_name": clear_name,
        "name": name,
        "image": imObj.path,
        "image_source": imObj.source,
        "casp": pack && pack.caspResource != undefined ? 1 : 0,
        "cobj": id_cobj,
        "clip": id_clip,
        "ressourcen": resources,
        "error": error,
        "recolor": isRecolor,
        "merged": isMerged,
        "categories": categories,
        "checked": 0,
        "fingerprint": fingerprint,
        "mtime": mtime,
        "size": size,
        "indownloads": inModFolder(pP) ? null : true
    };


    if (c_id != 0) {
        resultObj.cf_id = c_id;
    }

    if (isCurseForge && curseForgeData.downloadTime) {
        resultObj.downloadTime = curseForgeData.downloadTime;
    }


    crc = 0;
    try {
        crc = crcPart(filepath);
        resultObj.crc = crc;
    } catch (error) {
        //nix

    }

    if (curseForgeData != undefined) {
        let id = curseForgeData.id;
        let name = curseForgeData.name;
        let primaryAuthor = "";
        let dateModified = curseForgeData.dateModified;
        let primaryCategoryId = curseForgeData.primaryCategoryId;
        let categories = JSON.stringify(curseForgeData.categories);
        let logo = "";
        let logoThumbnail = "";
        let latestFiles = "";
        let cfLink = "";

        if (curseForgeData.authors && curseForgeData.authors.length > 0) primaryAuthor = curseForgeData.authors[0].name;
        if (curseForgeData.logo && curseForgeData.logo.thumbnailUrl) logoThumbnail = curseForgeData.logo.thumbnailUrl;
        if (curseForgeData.logo && curseForgeData.logo.url) logo = curseForgeData.logo.url;
        if (curseForgeData.links && curseForgeData.links.websiteUrl) cfLink = curseForgeData.links.websiteUrl;
        if (curseForgeData.latestFiles && curseForgeData.latestFiles.length != 0) {
            curseForgeData.latestFiles.forEach((el) => {
                latestFiles += "<" + el.id + ">";
            });
        }

        const result = await ipcRenderer.invoke('curseforge-insert-merge', {
            "id": id,
            "name": name,
            "primaryAuthor": primaryAuthor,
            "dateModified": dateModified,
            "primaryCategoryId": primaryCategoryId,
            "categories": categories,
            "logo": logo,
            "logoThumbnail": logoThumbnail,
            "latestFiles": latestFiles,
            "link": cfLink
        });


        //Save File ID
        if (curseForgeData.downloadLinks) {
            let fileID = null;
            for (let index = 0; index < curseForgeData.downloadLinks.length && fileID == null; index++) {
                const element = curseForgeData.downloadLinks[index];
                let contains = false;
                element.fingerprints.forEach((finger) => {
                    if (fingerprint == finger) contains = true;
                });

                if (contains) {
                    fileID = element.fileID;
                }
            }

            if (fileID != null) {
                resultObj.cf_file_id = fileID;
            }


        }
    }

    if (resultObj != undefined) filesMap.set(inoId, resultObj);
    if (obj_casp != undefined) casps_Insert.push(obj_casp);
    if (obj_cobj != undefined) cobj_Insert.push(obj_cobj);

    await handleMemory();
}

function getImageIfPossible(inoId, c_id, isMod) {
    let imageFolder = baseFolderPath + path.sep + "images";

    let correctedName = "" + inoId;
    var pre = ["[USER]", "[CC]", "[CACHE]"];

    if (!isMod) {
        //Normal Images
        for (let index = 0; index < pre.length; index++) {
            const element = pre[index];
            let imagepath = imageFolder + path.sep + element + correctedName + ".png"
                //console.log("Path: "+imagepath+" | Spacer: "+sp);

            if (fs.existsSync(imagepath)) {
                //console.log("IMG: " + imagepath);

                let s = 0;
                if (index == 0) { s = 2; } else if (index == 1) { s = 1; } else if (index == 2) { s = 3; }

                return { "path": imagepath, "source": s };
            }
        }
    }

    //Curse
    let curseImage = imageFolder + path.sep + "[CF]" + c_id + ".png";
    if (fs.existsSync(curseImage)) {
        return { "path": curseImage, "source": 4 };
    }

    return { "path": "", "source": 0 };
}

async function getRowsWithIno(ino) {

    let result = [];

    try {


        result = await ipcRenderer.invoke('getRowsWithIno', ino);
    } catch (error) {
        console.log("getRowsWithIno ERROR!")
        console.log(error);
    }

    return result;
}


async function insertAll() {
    let result = await ipcRenderer.invoke('insertAndUpdate', {
        "casps_Insert": casps_Insert,
        "casps_Update": casps_Update,
        "cobj_Insert": cobj_Insert,
        "cobj_Update": cobj_Update,
        "file_Insert": Array.from(filesMap.values()),
        "file_Update": fileUpdate,
        "filesMap": filesMap,
        "caspPart_Update": caspPart_Update,
        "caspPart_Update_Key": caspPart_Update_Key,
        "entries_insert": entries_insert,
        "caspPart_Insert": caspPart_Insert
    });


    if (result && result.cobj_Insert == true) cobj_Insert = [];
    if (result && result.cobj_Update == true) cobj_Update = [];
    if (result && result.casps_Insert == true) casps_Insert = [];
    if (result && result.casps_Update == true) casps_Update = [];
    if (result && result.file_Insert == true) filesMap = new Map();
    if (result && result.file_Update == true) fileUpdate = [];
    if (result && result.caspPart_Update == true) caspPart_Update = [];
    if (result && result.caspPart_Update_Key == true) caspPart_Update_Key = [];
    if (result && result.entries_insert == true) entries_insert = [];
    if (result && result.caspPart_Insert == true) caspPart_Insert = [];

    if (filesMap.size > 0 ||
        caspPart_Update_Key.length > 0 ||
        caspPart_Update.length > 0 ||
        cobj_Update.length > 0 ||
        casps_Insert.length > 0 ||
        casps_Update.length > 0 ||
        fileUpdate.length > 0 ||
        caspPart_Update.length > 0 ||
        caspPart_Update_Key.length > 0 ||
        entries_insert.length > 0) {
        console.log("Not empty!");
    }

}

async function handleMemory() {
    if (filesMap.size < 500 &&
        caspPart_Update_Key.length < 500 &&
        caspPart_Update.length < 500 &&
        cobj_Update.length < 500 &&
        casps_Insert.length < 500 &&
        casps_Update.length < 500 &&
        fileUpdate.length < 500 &&
        caspPart_Update.length < 500 &&
        caspPart_Update_Key.length < 500 &&
        entries_insert.length < 500 &&
        caspPart_Insert.length < 500) return;
    try {
        await insertAll();
    } catch (error) {
        console.log(error);
    }
}

//Recalc Item
async function recalcItem(element, update) {


    let filePath = element.path + path.sep + element.name;
    //Load Pack

    if (!fs.existsSync(filePath)) {
        return;
    }

    let ino = element.ino;
    let id = element.id;

    let pack = undefined;
    let filelow = filePath.toLocaleLowerCase();
    let isPackage = filelow.endsWith(".package") || filelow.endsWith(".packageoff");
    if (isPackage) pack = new _dbpf.Pack(filePath);
    if (isPackage) {
        try {
            pack.checkFile();
            if (!pack.error) {
                pack.calculateIndexList();
                pack.calulateCASPFiles();
                pack.calulateCOBJFiles();
                pack.calulateCLIPFiles();

                let items = pack.index_List;
                for (let index = 0; index < items.length; index++) {
                    const element = items[index];
                    entries_insert.push({
                        ino: ino,
                        type: element.r_type,
                        group: element.r_group,
                        instance: _dbpf.Basic.getInstanceKey(element)
                    });
                }
            }
        } catch (err) {
            console.log("Error in: " + filePath);
            console.log(err);
            console.log("");
        }
    }

    let id_casp = element.casp;
    let id_cobj = element.cobj;
    let id_clip = element.clip;
    let obj_casp = undefined;
    let obj_cobj = undefined;
    let clear_name = _helper.Helper.clearName(element.name);
    let error = 0;
    let isRecolor = 0;
    let isMerged = 0;



    //CASP
    if (pack && pack.caspResource != undefined) {
        let casp = pack.caspResource;
        if (casp.isMerged == true) isMerged = 1;
        if (casp.isRecolor == true) isRecolor = 1;
        let pSort = null;
        let sSort = null;
        if (casp.priSortOrder.size == 1) pSort = casp.priSortOrder.values().next().value;
        if (casp.secSortOrder.size == 1) sSort = casp.secSortOrder.values().next().value;

        obj_casp = {
            "ino": ino,
            "age": _helper.Helper.setToString(casp.age),
            "gender": _helper.Helper.setToString(casp.gender),
            "bodyType": _helper.Helper.setToString(casp.bodyType),
            "casFlags": _helper.Helper.setToString(casp.casFlags),
            "tgi_list": _helper.Helper.setToString(casp.tgi_list),
            "instances": _helper.Helper.setToString(casp.instances),
            "pSort": pSort,
            "sSort": sSort,
            "species": _helper.Helper.numberSetToHexString(casp.species),
            "packIDs": _helper.Helper.numberSetToHexString(casp.packIDs)
        }
        id_casp = 1;
        //Insert
        casps_Insert.push(obj_casp);

        //CASPART
        //CaspParts
        for (let index = 0; index < casp.caspFiles.length; index++) {
            const caspFile = casp.caspFiles[index];

            let ageArr = [];
            let genderArr = [];
            let ag_bin = caspFile.ageGender.toString(2).padStart(16, "0");
            //Age
            if (ag_bin.charAt(15) == "1") ageArr.push("[BABY]");
            if (ag_bin.charAt(14) == "1") ageArr.push("[TODDLER]");
            if (ag_bin.charAt(13) == "1") ageArr.push("[CHILD]");
            if (ag_bin.charAt(12) == "1") ageArr.push("[TEEN]");
            if (ag_bin.charAt(11) == "1") ageArr.push("[YOUNGADULT]");
            if (ag_bin.charAt(10) == "1") ageArr.push("[ADULT]");
            if (ag_bin.charAt(9) == "1") ageArr.push("[ELDER]");
            if (ag_bin.charAt(8) == "1") ageArr.push("[INFANT]");
            //Gender
            if (ag_bin.charAt(2) == "1") genderArr.push("[FEMALE]");
            if (ag_bin.charAt(3) == "1") genderArr.push("[MALE]");


            //BodyType
            let bodyType = Array.from(_dbpf.Helper.getBodyTypes(caspFile)).join(":");


            //CaspPart
            //Delete Old
            //if (update) await ipcRenderer.invoke("deleteByIno", { list: [ino], db: "CasParts" });


            //console.log(caspFile);

            //Calculate NEW
            let caspFileItem = {
                propId: caspFile.propID,
                ino: ino,
                swatch: caspFile.swatches.join(":"),
                instanceId: caspFile.instanceID,
                age: ageArr.join(":"),
                gender: genderArr.join(":"),
                bodyType: bodyType,
                primSortIndex: caspFile.primSortIndex,
                sortLayer: caspFile.sortLayer,
                packID: caspFile.packID,
                species: caspFile.species
            };
            //console.log(caspFileItem);

            caspPart_Insert.push(caspFileItem);
        }

    } else {
        id_casp = 0;
    }


    //COBJ
    if (pack && pack.cobjResource != undefined) {
        id_cobj = 1;
        let cobj = pack.cobjResource;

        let bb = _helper.Helper.numberSetToHexString(cobj.buyCat);
        let bu = _helper.Helper.numberSetToHexString(cobj.buildSet);
        let pat = _helper.Helper.numberSetToHexString(cobj.patternSet);
        let ot = _helper.Helper.numberSetToHexString(cobj.otherSet);

        obj_cobj = {
            "ino": ino,
            "pmin": cobj.pMin,
            "pmax": cobj.pMax,
            "bb": bb.length > 0 ? bb : null,
            "bu": bu.length > 0 ? bu : null,
            "pat": pat.length > 0 ? pat : null,
            "ot": ot.length > 0 ? ot : null,
        }
        if (obj_cobj != undefined) cobj_Insert.push(obj_cobj);
    } else {
        id_cobj = 0;
    }

    //CLIP
    if (pack && pack.clipResource != undefined) {
        id_clip = 1;
    } else {
        id_clip = 0;
    }


    //Other
    let resources = null;
    if (isMerged == 0 && id_casp > 0 && id_cobj > 0) {
        isMerged = 1;
    }
    if (pack && !pack.error) {
        resources = _helper.Helper.setToString(pack.resources);
    } else if (pack && !clear_name.endsWith("ts4script")) {
        error = 1;
    }

    //Update in Files
    fileUpdate.push({
        "key": "id",
        "value": id,
        "data": {
            "casp": id_casp,
            "cobj": id_cobj,
            "clip": id_clip,
            "ressourcen": resources,
            "recolor": isRecolor,
            "error": error,
            "merged": isMerged
        }
    });



    if (update) {
        await insertAll();
    } else if (entries_insert.length > 20000) {
        await handleMemory();
    }
}

//Import Single File
async function importSingleFile(data) {
    let filePath = data.path;
    let note = data.note;
    let destination = data.destination;
    let image = data.image;
    let name = data.name;
    let resultCode = 2;
    // 2 = OK
    // 4 = Failed
    // 6 = In system
    //Move file to location
    let newFile = destination + path.sep + name;
    if (fs.existsSync(filePath) && fs.existsSync(destination) && !fs.existsSync(newFile)) {
        //fs.renameSync(filePath, newFile);
        await ipcRenderer.invoke("movefile", { source: filePath, destination: newFile });
        if (!fs.existsSync(newFile)) {
            resultCode = 4;
        }
    } else {
        resultCode = 4;
    }
    let eImg = {};
    //Import File
    if (resultCode == 2) {
        let stats = getFileStats(newFile);
        let inoId = stats.ino;
        //Save Image
        if (image.path && image.path.length != 0) {
            let im_path = image.path;
            let im_source = image.source;

            let newImagePath;
            if (im_source == -1) {
                newImagePath = "none";
            } else if (im_source != 4) {
                let imageFolder = baseFolderPath + path.sep + "images";

                var pre = ["", "[CC]", "[USER]", "[CACHE]"];

                newImagePath = imageFolder + path.sep + pre[im_source] + inoId + ".png";

                fs.copyFileSync(im_path, newImagePath);
            } else if (im_source == 4) {
                newImagePath = im_path;
            }


            eImg = { "path": newImagePath, "source": im_source };
        }
        let rows = await getRowsWithIno(inoId);
        let l = rows.length;
        if (l > 0) {
            resultCode = 4;
        } else {
            let curseforge = undefined;
            if (data.curseForge) {
                curseforge = data.curseForge.data;
                let fileID = data.curseForge.fileID;
                let downloadLinks = [{
                    "fingerprints": [data.curseForge.fingerprint],
                    "fileID": fileID
                }];

                curseforge.downloadLinks = downloadLinks;
            }
            await handleLoadFile({ "name": name, "filepath": newFile, "image": eImg, "curseforge": curseforge });
            await insertAll();
            rows = await getRowsWithIno(inoId);
            l = rows.length;
            if (l != 1) {
                resultCode = 4;
            }
        }
    }

    //Send end event
    let element = {
        "resultCode": resultCode,
        "path": filePath,
        "action": "import-done"
    };

    //Save Note
    if (note.trim().length != 0) {
        let stats = getFileStats(newFile);
        if (stats.ino) {
            let ino = stats.ino;
            Notes.updateNoteByIno(ino, _helper.Helper.clearName(name), note, data.s_path_mod)
        }
    }
    //event.sender.send("import-popup", element);


    return element;

}

//Reload All
async function ra_ino(_element) {
    const element = _element;
    let stats = getFileStats(element.filepath);
    let inoId = stats.ino;
    let size = stats.size;
    let mTimeString = stats.mtime;
    let data = new Date(mTimeString);
    let mtime = Math.floor(data.valueOf() / 1000);
    let result = { "action": "getWork", "finished": true, "ino": inoId, "filepath": element.filepath, "mtime": mtime, "size": size };
    return result;
}

//Get Ressouces
function getRessouces(element) {
    let b = new Set();
    if (!fs.existsSync(element)) return b;
    let pack = new _dbpf.Pack(element);
    try {
        pack.checkFile();
        if (!pack.error) {
            pack.calculateIndexList();
            let s = pack.resources;
            return s;
        }
    } catch (err) {
        console.log("Error in: " + element);
        console.log(err);
        console.log("");
    }
    return b;
}


//DELETE
async function doubleDelete(filepath) {
    let firstTry = false;
    let secondTry = false;
    let thirdTry = false;
    let fourthTry = false;
    let fifthTry = false;

    console.log("[DELETE-INFO] Try to delete:  - " + filepath);

    //First Try Nativ Electron
    /*try {
        await shell.trashItem(filepath);
        firstTry = true;
    } catch (error) {
        console.log("[DELETE-FAILED] NATIV DELETE FAILED  - " + filepath);
        console.log(error);
    }*/

    let dd = 0;
    try {
        dd = await ipcRenderer.invoke("directDelete", filepath);
    } catch (error) {
        console.log(error)
    }
    if (dd == 1) return;
    if (dd == -1) { throw new Error('[DELETE-FAILED] Direct delete failed!'); }

    if (firstTry) return;

    //Trash NPM Modual
    try {
        await ipcRenderer.invoke("trash", filepath);
        secondTry = true;
    } catch (error) {
        console.log("[DELETE-FAILED] NPM TRASH  - " + filepath);
        console.log(error);
    }

    if (secondTry) return;

    //Only Windows
    try {
        if (!(process.platform === "darwin")) {
            await winTrash([filepath]);
            thirdTry = true;
        }
    } catch (error) {
        console.log("[DELETE-FAILED] OTHER SHELL  - " + filepath);
        console.log(error);
    }

    if (thirdTry) return;

    //Trash array
    try {
        await ipcRenderer.invoke("trash", [filepath])
            //await trash.default([filepath]);
        fourthTry = true;
    } catch (error) {
        console.log("[DELETE-FAILED] TRASH ARRAY  - " + filepath);
        console.log(error);
    }

    if (fourthTry) return;


    //Rb
    try {
        await recyclebin([filepath]);
        fifthTry = true;
    } catch (error) {
        console.log("[DELETE-FAILED] recyclebin  - " + filepath);
        console.log(error);
    }

    if (fifthTry) return;

    throw new Error('[DELETE-FAILED] ALL WAYS');
}

//Export thumbnail
async function exportThumb(element, update, folder) {
    let filePath = element.path + path.sep + element.name;

    if (!fs.existsSync(filePath)) {
        return;
    }

    let isCache = false;
    if (element.isLocalCache == true) isCache = true;
    let pack = new _dbpf.Pack(filePath);
    try {
        pack.checkFile();
        if (!pack.error) {
            pack.calculateIndexList();
            await pack.exportThumnailsSpecial(folder, isCache, true, false);
        }
    } catch (err) {
        console.log("Error in: " + filePath);
        console.log(err);
        console.log("");
    }
}


//Handle file
ipcRenderer.on("insert-all", async(event, data) => {
    try {
        await insertAll();
    } catch (err) {
        console.log(err);
    } finally {
        ipcRenderer.send("basic-worker", { "action": "close-worker" });
    }
});

ipcRenderer.on("handle-file", async(event, data) => {
    if (!data.element) return
    if (data.modFolder) modFolder = data.modFolder;

    console.log("[handle-file] - " + JSON.stringify(data));

    let p = data.element;
    let name = path.basename(p);
    let id = -1;


    try {
        id = await handleLoadFile({ "name": name, "filepath": p });
    } catch (err) {
        console.log(err);
    } finally {
        ipcRenderer.send("basic-worker", { "action": "getWork", "inoId": id });
    }
});

ipcRenderer.on("recalc-file", async(event, data) => {
    if (!data.element) return
    let updated = false;
    if (data.single && data.single == true) updated = true;

    try {
        await recalcItem(data.element, updated);
    } catch (err) {
        console.log("Error: (" + JSON.stringify(data.element) + ")" + err);
    }

    if (!updated) {
        ipcRenderer.send("basic-worker", { "action": "getWork" });
    } else {
        ipcRenderer.send("basic-worker", { "action": "close-worker" });
    }

});

ipcRenderer.on("export-thumbnails", async(event, data) => {
    if (!data.element) return
    let updated = false;
    if (data.single && data.single == true) updated = true;

    try {
        await exportThumb(data.element, updated, data.folder);
    } catch (err) {
        console.log("Error: (" + JSON.stringify(data.element) + ")" + err);
    }

    if (!updated) {
        ipcRenderer.send("basic-worker", { "action": "getWork" });
    } else {
        ipcRenderer.send("basic-worker", { "action": "close-worker" });
    }

});


//CAS Simulator
async function getCasPartDisplay(data, casSimPath_images) {
    let result = {
        error: true,
        err_msg: ""
    };

    result.inData = data;
    result.action = "mesh-and-texture";

    //Get FilePath
    let filepath = "";
    let db_Data = await ipcRenderer.invoke('basicWorkerKnex', { action: "getCasPartDisplay-files", ino: data.ino });
    if (!db_Data || db_Data.length < 0) {
        result.err_msg = "File not in database";
        console.log(result);
        return result; // No Item in Database
    }
    filepath = path.join(db_Data[0].path, db_Data[0].name);
    if (!fs.existsSync(filepath)) {
        result.err_msg = "File does not exist";
        console.log(result);
        return result; // No Item in Database
    }
    //Get CASPFile
    let packageTime = Date.now();
    let packageFiles = [];
    let pack;
    try {
        pack = new _dbpf.Pack(filepath);
        pack.checkFile();
        if (!pack.error) {
            pack.calculateIndexList();
            packageFiles = pack.index_List;
        } else {
            result.err_msg = "Failed to read file"
            console.log(result);
            return result; // Error while reading
        }
    } catch (error) {
        result.err_msg = error;
        console.log(result);
        return result; // Error while reading
    }
    console.log("[TIME] Package: " + (Date.now() - packageTime) + "ms");


    //Search CASPFile
    let caspTime = Date.now();
    let caspFile = undefined;
    let texture = undefined
    let texturePath = "";
    for (let index = 0; index < packageFiles.length; index++) {
        const element = packageFiles[index];
        let instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0")
        if (instanceID == data.instanceId && element.r_type == 0x034AEECB) {
            caspFile = new _dbpf.CASPFile(element.getByteArray());
            if (!caspFile.error) {
                let diffKey = caspFile.diffuseIndex;
                try {
                    texture = caspFile.TGIList[diffKey];
                } catch (error) {
                    //Nix
                }
            }
        }
    }
    console.log("[TIME] CaspFile: " + (Date.now() - caspTime) + "ms");

    //Get Texture
    let textureTime = Date.now();
    let filePath = path.join(casSimPath_images, texture + ".png");
    if (fs.existsSync(filePath)) {
        texturePath = filePath;
    } else if (texture && (texture.startsWith("3453cf95") || texture.startsWith("2bc04edf"))) {
        let textureWasFound = false;
        let image = await getTextureFromFile(texture, packageFiles, casSimPath_images, false);
        if (image) {
            //In Same File
            texturePath = image;
        } else if (!textureWasFound && texture) {
            //Search other files
            let files = await ipcRenderer.invoke('basicWorkerKnex', { action: "key-to-file", key: texture });
            if (files.length > 0) {
                let altFile = path.join(files[0].path, files[0].name);
                if (fs.existsSync(altFile)) {
                    try {
                        let altPack = new _dbpf.Pack(altFile);
                        altPack.checkFile();
                        if (!altPack.error) {
                            altPack.calculateIndexList();
                            let altPackageFiles = pack.index_List;
                            let altImage = await getTextureFromFile(texture, altPackageFiles, casSimPath_images, false);
                            console.log("Use texture from different file");
                            if (altImage) {
                                texturePath = altImage;
                            }
                        }
                    } catch (error) {
                        console.log(result);
                    }
                }
            }
        }
    } else if (texture) {
        console.log("[CAS] Unsupported texture " + texture);
        result.err_msg = "unsupported-texture";
    }
    console.log("[TIME] Texture: " + (Date.now() - textureTime) + "ms");

    //Get Mesh
    let meshTime = Date.now();
    let meshes = [];
    if (caspFile && caspFile.lodLevels.length > 0 && pack) {
        let lod = caspFile.lodLevels[0];
        let notFound = [];

        //Check Current File
        for (let index = 0; index < lod.list.length; index++) {
            const geomID = lod.list[index];
            let cached = meshCach.get(geomID);
            if (cached) {
                meshes.push(cached);
                cached.time = meshTime;
                meshCach.set(geomID, cached);
            } else {
                let geom = pack.calulateGEOMByInstance(geomID);
                if (geom && geom.length > 0) {
                    let mesh = geom[0];
                    mesh.geomID = geomID;
                    meshes.push(mesh);

                    mesh.time = meshTime;
                    meshCach.set(geomID, mesh);
                } else {
                    notFound.push(geomID);
                }
            }
        }

        //Look in Other Files
        let lastRessourcen = "";
        let lastFilePath = "";
        for (let index = 0; index < notFound.length; index++) {
            const key = notFound[index];
            let filePath = undefined;
            if (lastRessourcen.includes(key) && lastFilePath) {
                filePath = lastFilePath;
            } else {
                let fileData = await ipcRenderer.invoke('basicWorkerKnex', { action: "key-to-file", key: key });
                if (fileData && fileData.length > 0) {
                    filePath = path.join(fileData[0].path, fileData[0].name);
                    lastFilePath = filePath;
                    lastRessourcen = fileData[0].ressourcen;
                }
            }

            if (filePath && fs.existsSync(filePath)) {
                try {
                    let altPack = new _dbpf.Pack(filePath);
                    altPack.checkFile();
                    if (!altPack.error) {
                        altPack.calculateIndexList();
                        let geom = altPack.calulateGEOMByInstance(key);
                        if (geom && geom.length > 0) {
                            let mesh = geom[0];
                            mesh.geomID = key;
                            meshes.push(mesh);
                            mesh.time = meshTime;
                            meshCach.set(geomID, mesh);
                        }
                    }
                } catch (error) {
                    console.log(result);
                }
            }
        }


    }
    console.log("[TIME] Mesh: " + (Date.now() - meshTime) + "ms");


    result.meshes = meshes;
    result.texture = texturePath;
    result.error = false;

    return result;
}


async function getTextureFromFile(textureKey, packageFiles, casSimPath_images, otherCheck) {
    for (let index = 0; index < packageFiles.length; index++) {
        const element = packageFiles[index];
        let key = element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
        if (key == textureKey && element.r_type == 0x3453cf95) {
            try {
                let rel2 = new _dbpf.REL2File(element.getByteArray());
                let filePath = path.join(casSimPath_images, key + ".png")
                let imageSaved = await rel2.toPNGTesting(filePath, true);
                if (imageSaved) {
                    return filePath
                } else {
                    return undefined;
                }
            } catch (error) {
                return undefined;
            }
        } else if (key == textureKey && element.r_type == 0x2bc04EDF) {
            try {
                let lrle = new _dbpf.LRLEFile(element.getByteArray());
                let filePath = path.join(casSimPath_images, key + ".png")
                await lrle.exportImage(filePath, true);
                if (fs.existsSync(filePath)) {
                    return filePath
                } else {
                    return undefined;
                }
            } catch (error) {
                console.log("ERROR: " + error);
                return undefined;
            }
        }
    }

    //NotFound 
    if (!otherCheck) {
        if (textureKey.startsWith("3453cf95-")) {
            let tk = textureKey.replace("3453cf95-", "2bc04edf-");
            return await getTextureFromFile(tk, packageFiles, casSimPath_images, true);
        } else if (textureKey.startsWith("2bc04edf-")) {
            let tk = textureKey.replace("2bc04edf-", "3453cf95-");
            return await getTextureFromFile(tk, packageFiles, casSimPath_images, true);
        }
    }

    return undefined;

}

async function clearMeshCache() {

    let storeTime = 35000;
    let checkTime = Date.now() - storeTime;

    let keys = Array.from(meshCach.keys());
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        let obj = meshCach.get(key);
        if (obj && obj.time && obj.time < checkTime) {
            meshCach.delete(key);
        }

    }
}



//Utils
function fillFolder(folder, arr) {
    if (fs.lstatSync(folder).isDirectory()) {
        fs.readdirSync(folder).forEach(file => {
            fillFolder(folder + path.sep + file, arr);
        });

    } else if (NAMEUTIL.isSims4File(folder)) {
        arr.push(folder);
    }
}


function moveFolderDataAsComplex(baseFolder, downloadFolder, movedFiles) {


    function addFile(filepath, name, folder) {
        if (NAMEUTIL.isSims4File(file)) {
            movedFiles.push({
                "name": name,
                "folder": folder,
                "path": filepath
            });
        }
    }

    function addFolder(folder) {
        fs.readdirSync(folder).forEach((f) => {
            let itemPath = path.join(folder, f);
            let isFolder = false;
            let isFile = false;
            try {
                if (fs.lstatSync(itemPath).isDirectory()) {
                    isFolder = true;
                    isFile = false;
                } else {
                    isFile = true;
                    isFolder = false;
                }
            } catch (error) {
                console.log(error);
                return;
            }

            if (isFile) addFile(itemPath, f, folder);
            if (isFolder) addFolder(itemPath);

        });
    }

    fs.readdirSync(downloadFolder).forEach((f) => {
        let itemPath = path.join(downloadFolder, f);
        let isFolder = false;
        let isFile = false;
        try {
            if (fs.lstatSync(itemPath).isDirectory()) {
                isFolder = true;
                isFile = false;
            } else {
                isFile = true;
                isFolder = false;
            }
        } catch (error) {
            return;
        }

        let newPath = path.join(baseFolder, f);
        try {
            fsExtra.moveSync(itemPath, newPath, { overwrite: true });
        } catch (err) {
            console.log(err)
        }

        if (isFile) addFile(itemPath, f, baseFolder);
        if (isFolder) addFolder(itemPath);

    });

}

//https://stackoverflow.com/questions/13786160/copy-folder-recursively-in-node-js

function copyFileSync(source, target, movedFiles) {

    var targetFile = target;

    // If target is a directory, a new file with the same name will be created
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
    let nf = path.join(target, path.basename(source));
    if (fs.existsSync(nf) && (NAMEUTIL.isSims4File(source))) {
        movedFiles.push({
            "name": path.basename(source),
            "path": nf
        });
    }
}

function copyFolderRecursiveSync(source, target, movedFiles) {
    var files = [];

    // Check if folder needs to be created or integrated
    var targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
    }

    // Copy
    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function(file) {
            var curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder, movedFiles);
            } else {
                copyFileSync(curSource, targetFolder, movedFiles);
            }
        });
    }
}

function handelCalcPolyCasCount(event, element) {

    const file = path.join(element.path, element.name);
    //console.log(file);

    try {
        let pack = new _dbpf.Pack(file);
        pack.checkFile();
        if (!pack.error) {
            pack.calculateIndexList();
            pack.calulateCASPFiles();
            let r = pack.calulateGEOMSizeMapFilesCASP();
            if (r) return r;
        }
    } catch (err) {
        console.log("Error in: " + file);
        console.log(err);
        console.log("");
    }
    return undefined;

}

async function cfdownload(event, data) {

    if (extraLogs) console.log("[cfdownload] 1");

    if (data.modFolder) modFolder = data.modFolder;
    if (data.tagCatalog) tagCatalog = data.tagCatalog;
    if (data.cacheImageMap) {
        //Base
        try {
            let t = JSON.parse(data.cacheImageMap);
            let nMap = new Map(Object.entries(t));
            if (nMap.size != 0) {
                cacheImageMap = nMap;
            }
        } catch (err) {
            console.log(err);
        }
    }

    if (extraLogs) console.log("[cfdownload] 2");

    //if(extraLogs)console.log("MODFOLDER: " + modFolder);



    //Import
    let mode = data.data.downloadMode;
    let item = data.data.item;
    let modpack = item.modpack;
    let modPackDownload = data.data.modpackmode == 0 && modpack;
    if (item && item.isComplex) mode = 4;
    let folder = data.data.itemFolder;
    let creator = item.authors[0].name;
    let override = false;
    if (item.downloadInfo && item.downloadInfo.override == true) override = true;
    if (creator == undefined) creator = "ERROR";

    if (extraLogs) console.log("[cfdownload] 3");

    //Remove old Files from Database
    if (data.data.item && data.data.item.filesToDelete) {
        let toDelete = data.data.item.filesToDelete;
        await ipcRenderer.invoke("deleteByIno", { list: toDelete, db: "Files" });
    }

    if (extraLogs) console.log("[cfdownload] 4");

    //Get Files if installed
    let installedFiles = await ipcRenderer.invoke("filesByCfId", item.id)

    //Remove Old Files
    let failed = 0;
    if ((mode != 2 || override) && installedFiles.length > 0) {
        let toDelete = [];
        installedFiles.forEach((element) => {
            let fileINO = element.ino;
            if (fileINO) toDelete.push(fileINO);
        });

        await ipcRenderer.invoke("deleteByIno", { list: toDelete, db: "Files" });

        for (let index = 0; index < installedFiles.length; index++) {
            const element = installedFiles[index];
            let file = element.path + path.sep + element.name;
            if (fs.existsSync(file) && (NAMEUTIL.isSims4File(file))) {
                try {
                    await doubleDelete(file);
                } catch (err) {
                    console.log("[ERROR] Failed to delete old files")
                    console.log(err);
                    failed++;
                }
            }
        }
    }

    if (extraLogs) console.log("[cfdownload] 5");

    if (failed > 0) {
        let msg = "Failed to install/update a Mod/CC - " + item.name;
        ipcRenderer.send("simple-task", { "task": "toast", "msg": msg, "duration": 3000 });
        return;
    }

    if (extraLogs) console.log("[cfdownload] 6");

    //Read Files
    let files = [];
    fillFolder(folder, files);

    if (extraLogs) console.log("[cfdownload] 7");

    //Move File according to Mode
    let destination = undefined;
    if (override == false && mode != 4) {
        if (modPackDownload) { //Modpack Mode
            let modpackFolder = modFolder + path.sep + modpack.name;
            try {
                await ipcRenderer.invoke("filenamify", { value: modpack.name, options: { replacement: '_' } })
            } catch (e1) {
                console.log(e1);
            }
            if (!fs.existsSync(modpackFolder)) {
                fs.mkdirSync(modpackFolder);
                try {
                    if (fs.existsSync(modpackFolder)) {
                        let ino = fs.statSync(modpackFolder).ino;
                        ipcRenderer.send("download", { action: "folder-cover", ino: ino, tag: modpack.cover, mode: 2 });
                    }
                } catch (error) {
                    console.log(error);
                }
            }

            destination = modpackFolder;
        } else if (mode == 0) { //Simple Mode
            destination = modFolder;
            if (extraLogs) console.log("[cfdownload] 7.1");
        } else if (mode == 1) { //Creator Folder
            if (extraLogs) console.log("[cfdownload] 7.2");
            let creatorFolder = modFolder + path.sep + creator;
            if (!fs.existsSync(creatorFolder)) {
                fs.mkdirSync(creatorFolder);
                try {
                    if (fs.existsSync(creatorFolder)) {
                        let ino = fs.statSync(creatorFolder).ino;
                        ipcRenderer.send("download", { action: "folder-cover", ino: ino, tag: creator, mode: 1 });
                    }
                } catch (error) {
                    console.log(error);
                }
            }
            if (extraLogs) console.log("[cfdownload] 7.2.1");
            destination = creatorFolder;
        }
        if (destination != undefined) {
            if (extraLogs) console.log("[cfdownload] 7.0.1");
            let nFiles = [];
            for (let index = 0; index < files.length; index++) {
                const element = files[index];
                let baseName = path.basename(element);
                let oldFile = element;
                let newFile = destination + path.sep + baseName;
                //fs.renameSync(oldFile, newFile);
                await ipcRenderer.invoke("movefile", { source: oldFile, destination: newFile });
                nFiles.push({
                    "name": baseName,
                    "folder": destination,
                    "path": newFile
                });

            }
            if (extraLogs) console.log("[cfdownload] 7.0.2");
            fsExtra.removeSync(folder);
            files = nFiles;
            if (extraLogs) console.log("[cfdownload] 7.0.3");
        } else {
            let nFiles = [];
            files.forEach((element) => {
                let baseName = path.basename(element);
                let oldFile = element;
                nFiles.push({
                    "name": baseName,
                    "folder": folder,
                    "path": oldFile
                });
            });
            files = nFiles;
        }
    } else if (override == true && mode != 4) {
        if (extraLogs) console.log("[cfdownload] 7.3");
        //Try to find folder
        let folderSet = new Set();
        installedFiles.forEach((element) => {
            folderSet.add(element.path);
        });

        if (extraLogs) console.log("[cfdownload] 7.3.1");
        if (folderSet.size == 1) destination = Array.from(folderSet)[0];

        //console.log(folderSet);

        if (destination == undefined) destination = modFolder;

        let nFiles = [];
        for (let index = 0; index < files.length; index++) {
            const element = files[index];
            let baseName = path.basename(element);
            let oldFile = element;
            let newFile = destination + path.sep + baseName;
            await ipcRenderer.invoke("movefile", { source: oldFile, destination: newFile });
            //fs.renameSync(oldFile, newFile);
            nFiles.push({
                "name": baseName,
                "folder": destination,
                "path": newFile
            });
        }

        if (extraLogs) console.log("[cfdownload] 7.3.2");
        fsExtra.removeSync(folder);
        files = nFiles;
        if (extraLogs) console.log("[cfdownload] 7.3.3");
    } else if (mode == 4) {
        //if(extraLogs)console.log("[cfdownload] 7.4");
        //Complex Mode
        files = [];
        console.log("Complex Mode");
        fs.readdirSync(folder).forEach((f) => {
            let file = path.join(folder, f);
            let isFolder = fs.lstatSync(file).isDirectory();
            if (isFolder) {
                copyFolderRecursiveSync(file, modFolder, files);
            } else {
                copyFileSync(file, modFolder, files);
            }
        });
        console.log("Complex Mode - Done");
        console.log(JSON.stringify(files));
        fsExtra.emptyDirSync(folder);
    }


    if (extraLogs) console.log("[cfdownload] 8");
    //Import Files into Database
    for (let index = 0; index < files.length; index++) {
        const element = files[index];
        let obj = {
            "name": element.name,
            "filepath": element.path,
            "curseforge": item
        };
        await handleLoadFile(obj)
    }
    if (extraLogs) console.log("[cfdownload] 9");
    await insertAll();
    if (extraLogs) console.log("[cfdownload] 10");
    ipcRenderer.send("swiper", { "action": "update-last-cf-time" });

}


//Queue Actions
async function exportAllThumbnails(data) {

    let item = data.item;
    let directory = data.folder;
    let options = data.options;

    let file = path.join(item.path, item.name);
    if (!fs.existsSync(file)) {
        console.log("File does not exist - " + file);
        return undefined
    }

    let isCache = data.isCache;
    let needHash = data.needHash;
    let pack = new _dbpf.Pack(file);
    let images = undefined;
    try {
        pack.checkFile();
        if (!pack.error) {
            pack.calculateIndexList();
            images = [];
            let imagesCAS = await pack.exportCASThumnails(directory, true, true, isCache);
            //let imagesCOBJ = await pack.exportCOBJThumnails(directory, true, true, isCache);
            if (imagesCAS && imagesCAS.length > 0) images.push(...imagesCAS);
            //if (imagesCOBJ && imagesCOBJ.length > 0) images.push(...imagesCOBJ);
        }
    } catch (err) {
        console.log("Error in: " + file);
        console.log(err);
    }
    if (images == undefined || !needHash) return undefined;

    //Hash
    let hashed = [];
    for (let index = 0; index < images.length; index++) {
        const image = images[index];
        const imagePath = path.join(image.path, image.name);
        if (!fs.existsSync(imagePath)) continue;
        try {
            let pImageBuffer = await processImageBufferWithOptions(fs.readFileSync(imagePath), {
                grayscale: options.imGrayscale,
                addBlack: options.imTopBox,
                normalize: options.imNormalize,
                edgeDetection: options.imEdgeDetect,
                removeBottom: options.imBottomCut,
            });
            const hash = await generateHashBufferJpeg(pImageBuffer, options.hashSize);
            let instance = image.name.replace("0x", "");
            instance = instance.substring(0, instance.indexOf("."))
            image.db = {
                ino: item.ino,
                hash: hash,
                image: image.name,
                instance: instance
            }
            hashed.push(image);
        } catch (error) {
            console.log({ file: file, image: imagePath, data: data });
            console.log(error);
        }
    }
    return hashed;

}

const generateHash = (filePath, bitSize) => {
    return new Promise((resolve, reject) => {
        imageHash.imageHash(filePath, bitSize, true, (err, hash) => {
            if (err) reject(err);
            resolve(hash);
        });
    });

};

const generateHashBufferJpeg = (buffer, bitSize) => {
    return new Promise((resolve, reject) => {
        imageHash.imageHash({
            ext: 'image/jpeg',
            data: buffer
        }, bitSize, true, (err, hash) => {
            if (err) reject(err);
            resolve(hash);
        });
    });
};

const hammingDistance = (hash1, hash2) => {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) {
            distance++;
        }
    }
    return distance;
};

async function findClosestHash(data) {
    let hashmap = data.hashmap;
    let item = data.item;
    let options = data.options;

    try {
        let newHash = undefined;
        if (data.imageHash != undefined) {
            newHash = data.imageHash;
        } else {
            newHash = await generateHash(item.imageProcessed, options.hashSize);
        }
        let closestMatch = null;
        let smallestDistance = Infinity;

        let time = Date.now();
        for (let [id, hash] of hashmap.entries()) {
            const distance = hammingDistance(newHash, hash);

            if (distance < smallestDistance) {
                smallestDistance = distance;
                closestMatch = id;
            }
        }
        return {
            id: closestMatch,
            distance: smallestDistance,
            time: (Date.now() - time)
        }

    } catch (error) {
        console.log("");
        console.log(data.item)
        console.log(error);
        return undefined;
    }
}

async function checkAndReloadThumbnail(item) {

    let result = {
        id: item.id,
        image_source: 0,
        image: ""
    }

    //Check if thumbnails exists
    let image = undefined;
    let image_s = 0;
    if (item.image && item.image.length > 0 && fs.existsSync(item.image)) {
        image = item.image;
        image_s = item.image_source;
    }

    let file = path.join(item.path, item.name);
    if (!fs.existsSync(file)) return result;

    if (!(file.toLocaleLowerCase().endsWith(".package") || file.toLocaleLowerCase().endsWith(".packageoff"))) {
        //Not a package File
        if (image) {
            return undefined;
        } else {
            return result;
        }
    }

    try {
        let pack = new _dbpf.Pack(file);
        pack.checkFile();
        if (!pack.error) {
            pack.calculateIndexList();
            let bt = pack.getBiggestThumIndexEntry();
            if (bt != undefined) {
                try {
                    if (image && fs.existsSync(image) && (image.endsWith(".png") || image.endsWith(".jpeg"))) fs.unlinkSync(image);
                } catch (eo01) {
                    console.log(eo01);
                }
                let imageFile = path.join(baseFolderPath, "images", "[CC]" + item.ino + ".png");
                if (bt.r_type == 0xAA00AA00) {
                    fs.writeFileSync(imageFile, bt.getByteArray());
                } else {
                    await _dbpf.PackHandler.saveBufferToFile(imageFile, bt.getByteArray(), false);
                }

                if (fs.existsSync(imageFile)) {
                    result.image_source = 1;
                    result.image = imageFile;
                }
                return result;
            } else {
                if (image) {
                    return undefined;
                } else {
                    return result;
                }
            }
        }
    } catch (error) {
        console.log(error);
    }


    return result;
}

async function getPackageRessources(filepath) {
    if (!fs.existsSync(filepath)) return;
    let ressources = [];
    let error = undefined;
    //Get ino
    let stats = getFileStats(filepath);
    let ino = stats.ino;

    try {
        let pack = new _dbpf.Pack(filepath);
        pack.checkFile();
        if (pack.error) throw new Error("Bad file " + filepath);
        pack.calculateIndexList();
        let list = pack.index_List;
        for (let index = 0; index < list.length; index++) {
            const element = list[index];
            let obj = {
                ino: ino,
                type: element.r_type,
                group: element.r_group,
                instance: element.getInstanceString(),
                address: element.getKey()
            };
            ressources.push(obj);
        }
    } catch (err) {
        error = err;
    }

    return {
        ino: ino,
        path: filepath,
        ressources: ressources,
        error: error
    };
}

async function checkFileRmapBounds(data) {
    let file = data.file;
    let types = data.types;
    let options = {
        compareAgainstBase: false,
        ignoreSmallMeshes: false
    };
    let userOptions = data.options;
    if (userOptions) {
        if (userOptions.compareAgainstBase != undefined) options.compareAgainstBase = userOptions.compareAgainstBase;
        if (userOptions.ignoreSmallMeshes != undefined) options.ignoreSmallMeshes = userOptions.ignoreSmallMeshes;
    }

    let filepath = path.join(file.path, file.name);
    if (!fs.existsSync(filepath)) return undefined;
    try {
        return RMAPUtils.checkFile(filepath, types, options);
    } catch (error) {
        console.log(error);
    }
    return undefined;
}

async function exportCobjTexture(data) {
    let packageFilePath = data.filepath;
    let key = data.key;
    let tmpFolderPath = data.tmpFolderPath;

    let pack = new _dbpf.Pack(packageFilePath);
    pack.checkFile();
    if (pack.error) {
        return { error: true, msg: "Failed to read file" };
    }
    pack.calculateIndexList();
    let entry = pack.getEntryIfExistsByKey(key);
    if (!entry) {
        return { error: true, msg: "Entry not found" };
    }

    //Create 
    let inp = entry.getByteArray();
    let dst = new DSTResource(inp);
    let ddsBuffer = dst.toDDSBuffer();
    let file = tmpFolderPath + path.sep + key + ".png";
    let nb = await DDSConverter.ddsBufferToPngBuffer(ddsBuffer);
    if (nb) fs.writeFileSync(file, nb);
    if (fs.existsSync(file)) {
        return { error: false, file: file };
    } else {
        return { error: true, msg: "Failed to convert to png" };
    }
}

async function scanAndInsertSaveFile(data) {
    let r = {
        success: false,
        error: undefined
    }

    if (!data || !data.saveFile) {
        r.error = "No file data provided";
        return r;
    }

    let file = data.saveFile.mainFile;
    let fileIno = data.saveFile.mainIno;
    let fileName = data.saveFile.mainFileName;
    let fileCTime = data.saveFile.mainCTime;
    let slot = data.saveFile.slot;

    r.mainIno = fileIno;
    r.mainCTime = fileCTime;
    r.inoTimeKey = data.saveFile.inoTimeKey;
    r.slot = slot;


    if (!fs.existsSync(file)) {
        r.error = "File does not exist";
        return r;
    }

    let fstats = fs.statSync(file);
    r.scanCTime = fstats.ctimeMs;
    r.newIno = fstats.ino;

    let savefile = new _dbpf.SaveFile(file);
    savefile.checkFile();
    if (savefile.error) {
        r.error = "Failed to read file";
        return r;
    }
    savefile.calculateIndexList();

    let simsCC = savefile.getSimsCC();
    let houseHolds = savefile.getHouseholds();

    if (!simsCC || !houseHolds) {
        r.error = "Failed to read file";
        return r;
    }

    let householdsMap = new Map();
    houseHolds.forEach((element) => {
        householdsMap.set(element.householdInstance, element);
    });

    //Combine
    let ccCas = [];
    simsCC.forEach((element) => {
        let fullSimName = element.firstName + " " + element.lastName;
        let household = householdsMap.get(element.householdInstance);
        let householdName = "Unknown";
        if (household) householdName = household.householdName;
        let isPlayedHousehold = false;
        if (household) isPlayedHousehold = household.myHousehold == 0;

        let instances = element.instances;
        instances.forEach((instanceObj) => {
            let instance = instanceObj.instance.replace("0x", "");
            let entry = {
                instance: instance.toLowerCase(),
                played: isPlayedHousehold,
                sim_name: fullSimName,
                household_name: householdName,
                save_file_name: fileName,
                save_file_ino: fileIno,
                save_file_ctime: fileCTime,
                slot: slot
            };
            ccCas.push(entry);
        });

    });


    //Insert Cas into Database
    let callItem = {
        chunkSize: 500,
        tableName: "SaveScan",
        mergeOn: "id",
        list: ccCas
    }
    try {
        let suc = await ipcRenderer.invoke("insert-update-chunks", callItem);
        if (!suc) {
            r.error = "Failed to insert into database";
            return r;
        }
    } catch (error) {
        console.log(error);
        r.error = "Failed to insert into database";
        return r;
    }


    /*//Tmp save as json
    let folder = "C:\\Users\\fabis\\Desktop\\QuickTest\\Save";
    let simsFile = path.join(folder, "sims.json");
    let houseFile = path.join(folder, "house.json");
    let ccCasFile = path.join(folder, "ccCas.json");
    fs.writeFileSync(simsFile, JSON.stringify(simsCC, null, 2));
    fs.writeFileSync(houseFile, JSON.stringify(houseHolds, null, 2));
    fs.writeFileSync(ccCasFile, JSON.stringify(ccCas, null, 2));*/

    r.success = true;
    return r;
}


//GameState
let gamestatecontroller = undefined;

function createGameStateController(isMac, settings) {
    gamestatecontroller = new GAMESTATE(gameStateChange, 5000, 20000, isMac);
    gamestatecontroller.setGameFolder(settings.s_game_orgin);
    gamestatecontroller.updateIsOn(settings.s_game_state_check == true);
}

function gameStateChange(data) {
    ipcRenderer.send("simple-task", { channel: "app", data: data, task: "send-to-win" });
    ipcRenderer.send("simple-task", { task: "set-game-state", isGameRunning: data.gameIsOpen });
}

ipcRenderer.on("gamestate", async(event, data) => {
    if (!gamestatecontroller) return;
    if (data.action == "start-game") {
        gamestatecontroller.startGame(data.gamepath, data.isMac, data.args);
    } else if (data.action == "update-settings") {
        gamestatecontroller.setGameFolder(data.settings.s_game_orgin);
        gamestatecontroller.updateIsOn(data.settings.s_game_state_check == true);
    } else if (data.action = "focus-change") {
        gamestatecontroller.changeFocusState(data.focus);
    }
});


//All IPC listener 
ipcRenderer.on("work-queue", async(event, data) => {
    let result = undefined;
    try {
        switch (data.task.action) {
            case "exportAllThumbnails":
                result = await exportAllThumbnails(data.task.data);
                break;
            case "findClosestHash":
                result = await findClosestHash(data.task.data);
                break;
            case "checkAndReloadThumbnail":
                result = await checkAndReloadThumbnail(data.task.data.item);
                break;
            case "get-packge-ressources":
                result = await getPackageRessources(data.task.data.path);
                break;
            case "check-file-rmap-bounds":
                result = await checkFileRmapBounds(data.task.data);
                break;
            case "export-cobj-texture":
                result = await exportCobjTexture(data.task.data);
                break;
            case "scan-and-insert-save-file":
                result = await scanAndInsertSaveFile(data.task.data);
                break
        }
    } catch (error) {
        console.log(error);
        console.log("Data: " + JSON.stringify(data));
    }

    event.sender.send(data.channel, {
        index: data.index,
        result: result,
        action: data.returnAction ? data.returnAction : undefined
    });
});

ipcRenderer.on("work", async(event, data) => {
    if (data.action == "reload-all") {
        if (data.step == 0) {
            ipcRenderer.send("basic-worker", { "action": "getWork" });
        }
    } else if (data.action == "check-file") {
        let result = { "action": "getWork", "finished": true };
        try {
            let r = await ra_ino(data.element);
            if (r) {
                result = r;
            } else {
                console.log("ERROR!");
                console.log(data);
            }
        } catch (error) {
            console.log(error);
            console.log(data);
        } finally {
            ipcRenderer.send("basic-worker", result);
        }
        //ipcRenderer.send("basic-worker", { "action": "getWork", "finished": true, "element": el });
    } else if (data.action == "ask-for-work") {
        ipcRenderer.send("basic-worker", { "action": "getWork" });
    } else if (data.action == "calc-crc") {
        await calcCRC32(data.element);
        ipcRenderer.send("basic-worker", { "action": "getWork" });
    } else if (data.action == "save-crc") {
        await updataCRC(data.element);
        ipcRenderer.send("basic-worker", { "action": "close-worker" });
    } else if (data.action == "get-ressouces") {
        let res = getRessouces(data.element);
        ipcRenderer.send("basic-worker", { "action": "getWork", "ressouces": res });
    } else if (data.action == "calc-poly-cas-count") {
        //let element = getRessouces(data.element);
        //console.log(data);
        let obj = handelCalcPolyCasCount(event, data.element);
        //if (obj) {result.data = obj;}
        //console.log("Ich war hier!");
        let result = data.element;
        if (obj) result.geom_casp = obj;
        ipcRenderer.send("basic-worker", { "action": "getWork", "data": result });

    }
});

ipcRenderer.on("importSingleFile", async(event, data) => {
    if (!data.tagCatalog || !data.cacheImageMap || !data.data) return;
    if (data.modFolder) modFolder = data.modFolder;
    //Base
    try {
        let t = JSON.parse(data.cacheImageMap);
        let nMap = new Map(Object.entries(t));
        if (nMap.size != 0) {
            cacheImageMap = nMap;
        }
    } catch (err) {
        console.log(err);
    }
    tagCatalog = data.tagCatalog;

    let element = await importSingleFile(data.data);

    ipcRenderer.send("basic-worker", { "action": "close-worker", "element": element });

});

ipcRenderer.on("importCurseForgeFiles", async(event, data) => {
    try {
        await cfdownload(event, data);
    } catch (error) {
        console.log("Error in cfdownload!")
        console.log(error);
    }
    ipcRenderer.send("basic-worker-download", { "action": "close-worker" });
});

ipcRenderer.on("getCasPartInfo", async(event, data) => {
    let result = undefined;

    let start = Date.now();
    try {
        result = await getCasPartDisplay(data.data, data.casSimPath_images);
    } catch (error) {
        console.log(error);
    }
    let timeUsed = Date.now() - start;

    console.log("[GetCasPartInfo] took " + timeUsed + "ms");

    let item = {
        "action": "send-CasPartInfo",
        "result": result,
        "channel": data.data.channel
    }
    ipcRenderer.send("basic-worker-actions", item);
    clearMeshCache();
});


ipcRenderer.on('invoke-worker-function', async(event, data) => {
    console.log('Data received from main:', data);
    let result = {
        error: undefined,
        data: undefined
    };
    try {
        if (data.action = "import-single") {
            modFolder = data.modFolder;
            let ino = await handleLoadFile({ name: path.basename(data.filepath), filepath: data.filepath });
            await insertAll();
            let rows = await getRowsWithIno(ino);
            if (rows.length > 0) {
                result.data = rows[0];
            }
        }
    } catch (error) {
        result.error = error;
        ipcRenderer.send('renderer-worker-response', result);
    }
    ipcRenderer.send('renderer-worker-response', result);
});



ipcRenderer.on("update-data", async(event, data) => {
    if (!data.tagCatalog || !data.cacheImageMap) return;
    //Base
    try {
        let t = JSON.parse(data.cacheImageMap);
        let nMap = new Map(Object.entries(t));
        if (nMap.size != 0) {
            cacheImageMap = nMap;
        }
    } catch (err) {
        console.log(err);
    }
    tagCatalog = data.tagCatalog;

    ipcRenderer.send("basic-worker", { "action": "getWork" });
});

ipcRenderer.on("setup", async(event, data) => {

    logFolderPath = data.logsFolder;

    let suc = setup(data.workerID, data.baseFolderPath, data.checkCach, data);

    //GameState
    if (data.checkGameState == true) {
        createGameStateController(data.isMac, data.settings);
    }

    if (suc) {
        ipcRenderer.send("basic-worker", { "action": "ready" });
    }
});

//Worker is ready call
ipcRenderer.send("basic-worker", { "action": "getSetup" });

module.exports = handleLoadFile;