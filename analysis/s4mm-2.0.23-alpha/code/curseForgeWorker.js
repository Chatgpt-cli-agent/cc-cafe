const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const util = require('util');
const axios = require('axios');
const Downloader = require("nodejs-file-downloader");

var knex = undefined;
let curseForgeImages = [];
let filesUpdate = [];
let filesFingerprintSet = new Set();
let apiKey = "";
var logFolderPath = undefined;

//Temp
let timeWhole = 0;
let itemsWhole = 0;

async function setup(baseFolder) {

    logFolder = path.join(baseFolder, "logs");
    baseFolderPath = baseFolder;

    if (!fs.existsSync(baseFolderPath)) {
        alert("Wrong Path");
        return false;
    }

    //Log
    if(logFolderPath){
        var log_file = fs.createWriteStream(logFolderPath + '/curseForge.log', { flags: 'w' });
        var log_stdout = process.stdout;
        console.log = function(d) { //
            log_file.write(util.format(d) + '\n');
            log_stdout.write(util.format(d) + '\n');
        };
    }

    //Conect to Database
    let dbpath = baseFolderPath + path.sep + 'db_cc.sqlite';
    if (fs.existsSync(dbpath)) {
        knex = require("knex")({
            client: "sqlite3",
            connection: {
                filename: path.join(baseFolderPath, 'db_cc.sqlite')
            },
            useNullAsDefault: true
        });

        //Start Action !!!!
        console.log("[CURSEFORGE] Connected to database");
        return true;
    } else {
        console.log("[CURSEFORGE] NOT connected to database");
        return false;
    }
}

async function startCurseForgeFingerprintCheck() {

    filesUpdate = [];
    filesFingerprintSet = new Set();

    function skipStep() {
        step2();
    }

    function nextStep() {
        step2();
    }

    let isConnected = !!await require('dns').promises.resolve('google.com').catch(() => {});
    hasInternet = isConnected;
    if (!isConnected) {
        skipStep();
        return;
    }

    //Normal batch size 256
    let batchSize = 512;

    knex.from("Files").where("cf_id", null).select("fingerprint").then((result) => {
        let set = new Set();
        result.forEach(element => {
            if (element.fingerprint != undefined && element.fingerprint != null) set.add(element.fingerprint);
        });
        if (result.length == 0) {
            nextStep();
            return;
        }
        let arr = Array.from(set);

        let batches = [];
        while (arr.length > 0) {
            if (arr.length > batchSize) {
                batches.push(arr.splice(0, batchSize));
            } else {
                batches.push(arr.splice(0, arr.length));
            }
        }

        console.log("Batches: " + batches.length);
        sendSplashUpdate({ "step": 6, "subStep": 1, "max": batches.length, "current": 0 });
        sendBatch(batches, 0, set);

        //console.log("Fingerprints: " + arr.length);
    });

    async function sendBatch(arrays, pos, fingerprintSet) {
        if (pos > arrays.length - 1) {

            //Update
            await saveFilesToDataBase();

            nextStep();
            return;
        }
        let array = arrays[pos];
        let arraySet = new Set(array);
        let data = {
            "fingerprints": array
        }
        let innerHeader = { "Accept": 'application/json', "Content-Type": "application/json" }
        innerHeader["x-api-key"] = apiKey;
        const HEADER = {
            headers: innerHeader
        };
        const BODY = data;
        axios.post("https://api.curseforge.com/v1/fingerprints", BODY, HEADER).then(async(result) => {
            await handleFingerPrintResult(result.data.data, arraySet, fingerprintSet);
            let p = pos + 1;
            sendSplashUpdate({ "step": 6, "subStep": 1, "max": arrays.length, "current": p });

            sendBatch(arrays, p, fingerprintSet);

            //sendBatch(arrays, p)
            //nextStep();
        }).catch(async(err) => {
            console.log(err);
            let p = pos + 1;
            sendBatch(arrays, p, fingerprintSet);
        });
    }
}

async function saveFilesToDataBase() {
    let sTime = Date.now();
    //fs.writeFileSync("C:\\Users\\fabis\\Desktop\\out\\test.json", JSON.stringify(filesUpdate), 'utf8');

    //console.log("");
    //console.log("");

    let completeSize = filesUpdate.length;
    let batches = [];
    let batchSize = 256;

    //Get IDS
    let idsObj = []
    try {
        idsObj = await knex.from("Files").select(["id","fingerprint"]);
    } catch (error) {
        console.log(error);
    }
    let idMap = new Map();
    for (let index = 0; index < idsObj.length; index++) {
        const element = idsObj[index];
        let arr = [];
        if(idMap.has(element.fingerprint))arr = idMap.get(element.fingerprint);
        arr.push(element.id);
        idMap.set(element.fingerprint, arr);
    }

    let filesWithID = [];
    for (let index = 0; index < filesUpdate.length; index++) {
        const element = filesUpdate[index];
        let fingerprint = element.value;
        let arr = idMap.get(fingerprint);
        if(!arr)continue;

        for (let j = 0; j < arr.length; j++) {
            const id = arr[j];
            let obj = {
                key:"id",
                value: id,
                data:{
                    cf_id: element.data.cf_id,
                    cf_file_id : element.data.cf_file_id
                }
            };
            filesWithID.push(obj);
        }

    }

    while (filesWithID.length > 0) {
        if (filesWithID.length > batchSize) {
            batches.push(filesWithID.splice(0, batchSize));
        } else {
            batches.push(filesWithID.splice(0, filesWithID.length));
        }
    }



    sendSplashUpdate({ "step": 6, "subStep": 6, "max": batches.length, "current": 0 });

    for (let index = 0; index < batches.length; index++) {
        const element = batches[index];
        //let itemTime = Date.now();
        await filesBatch(element);
        sendSplashUpdate({ "step": 6, "subStep": 6, "max": batches.length, "current": (index + 1) });
        //console.log("[SQL-" + index + "]: " + (Date.now() - itemTime) + "ms");
    }

    //console.log("");
    console.log("[SQL-ALL]: " + (Date.now() - sTime) + "ms   | Size: " + completeSize);
    // console.log("");
    filesUpdate = [];
    filesFingerprintSet = new Set();
}

async function handleFingerPrintResult(result, fSet, fingerprintSet) {
    let exactMatches = result.exactMatches;
    let partialMatches = result.partialMatches;
    let unmatchedFingerprints = result.unmatchedFingerprints;

    let fingerMap = new Map();
    let topFiles = new Map();

    if (exactMatches && exactMatches != null) {
        exactMatches.forEach((element) => {
            let pID = element.id;
            let fileID = element.file.id;

            if ((element.file && element.file.isAvailable == false) || element.latestFiles.length == 0 || (element.file && element.file.gameId != 78062)) {
                //Bad file
                //console.log("[CURSEFORGE] Bad File -> " + pID);
            } else {
                let latestFingerPrints = new Map();

                //Latest
                if (element.latestFiles && element.latestFiles.length > 0) {
                    element.latestFiles.forEach((latestFile) => {
                        let lid = latestFile.id;
                        latestFile.modules.forEach((file) => {
                            let fp = file.fingerprint;
                            latestFingerPrints.set(fp, lid);
                            topFiles.set(fp, pID);
                        })
                    });
                }

                element.file.modules.forEach((file) => {
                    let fp = file.fingerprint;
                    topFiles.set(fp, pID);
                    if (latestFingerPrints.has(fp)) {
                        let id = latestFingerPrints.get(fp);
                        fingerMap.set(fp, id);
                    } else {
                        fingerMap.set(fp, fileID);
                    }
                    fSet.delete(fp);
                })
            }
        });
    }

    if (partialMatches && partialMatches != null) {
        partialMatches.forEach((element) => {
            let pID = element.id;
            let fileID = element.file.id;

            if ((element.file && element.file.isAvailable == false) || element.latestFiles.length == 0 || (element.file && element.file.gameId != 78062)) {
                //Bad file
                //console.log("[CURSEFORGE] Bad File -> " + pID);
            } else {
                //topFiles.set(pID, fileID);
                let latestFingerPrints = new Map();

                //Latest
                if (element.latestFiles && element.latestFiles.length > 0) {
                    element.latestFiles.forEach((latestFile) => {
                        let lid = latestFile.id;
                        latestFile.modules.forEach((file) => {
                            let fp = file.fingerprint;
                            latestFingerPrints.set(fp, lid);
                            topFiles.set(fp, pID);
                        })
                    });
                }

                element.file.modules.forEach((file) => {
                    let fp = file.fingerprint;
                    topFiles.set(fp, pID);
                    if (latestFingerPrints.has(fp)) {
                        let id = latestFingerPrints.get(fp);
                        fingerMap.set(fp, id);
                    } else {
                        fingerMap.set(fp, fileID);
                    }
                    fSet.delete(fp);
                })
            }
        });
    }

    if (unmatchedFingerprints && unmatchedFingerprints != null) {
        partialMatches.forEach((element) => {
            let fp = element;
            fingerMap.set(fp, 0);
            fSet.delete(fp);
        });
    }

    fSet.forEach((element) => {
        fingerMap.set(element, 0);
    });
    let updateData = [];
    fingerMap.forEach((value, key) => {
        let projektID = null;
        let fileID = value;
        if (topFiles.has(key)) projektID = topFiles.get(key);
        if (fileID == 0) {
            fileID = null;
            projektID = 0;
        }
        if (fingerprintSet.has(key) && !filesFingerprintSet.has(key)) {
            updateData.push({
                "key": "fingerprint",
                "value": key,
                "data": {
                    "cf_id": projektID,
                    "cf_file_id": fileID
                }
            });
            filesFingerprintSet.add(key);
        }
    });
    filesUpdate.push(...updateData);
}

function filesBatch(files) {
    return knex.transaction(trx => {
        const queries = [];
        files.forEach(file => {
            const query = knex('Files')
                .where(file.key, file.value)
                .update(file.data)
                .transacting(trx);
            queries.push(query);
        });

        Promise.all(queries)
            .then(trx.commit)
            .catch(trx.rollback);
    });
}

function curseForgeUpdateBatch(files) {
    return knex.transaction(trx => {
        const queries = [];
        files.forEach(file => {
            const query = knex('CurseForge')
                .where(file.key, file.value)
                .insert(file.data)
                .onConflict(file.key).merge()
                .transacting(trx);
            queries.push(query);
        });

        Promise.all(queries)
            .then(trx.commit)
            .catch(trx.rollback);
    });
}

async function checkForUpdatesForge() {

    sendSplashUpdate({ "step": 6, "subStep": 2 });

    function skipStep() {
        step3();
    }

    function nextStep() {
        step3();
    }

    console.log("[CURSEFORGE] Checking for Updates");
    knex.from("Files").where((qb) => {
        qb.whereNot("cf_id", null);
        qb.whereNot("cf_id", 1);
    }).select("cf_id").then((result) => {
        let idSet = new Set();
        result.forEach((element) => { idSet.add(element.cf_id) });
        let idArr = Array.from(idSet);

        let data = {
            "modIds": idArr
        }

        if (idArr.length == 0) {
            skipStep();
            return;
        }

        let innerHeader = { "Accept": 'application/json', "Content-Type": "application/json" }
        innerHeader["x-api-key"] = "$2a$10$87N.onn5OiHZ7IXVvohTPegNQAkcx37YvlcCZsBZhOpmoO2ycH5um";
        const HEADER = {
            headers: innerHeader
        };
        const BODY = data;
        axios.post("https://api.curseforge.com/v1/mods", BODY, HEADER).then(async(result) => {
            //console.log(JSON.stringify(result.data));
            if (result == null || result.length == 0) {
                nextStep();
                return;
            }
            await handleUpdatesResult(result.data.data);
            nextStep();

        }).catch((err) => {
            console.log(err);
            skipStep();
        });

    });
}

async function handleUpdatesResult(result) {
    //console.log(result);
    let list = [];
    let imageList = [];
    result.forEach((curseForgeData) => {
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

        let obj = {
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
        }

        let imageObj = {
            "id": id,
            "logoThumbnail": logoThumbnail
        }

        imageList.push(imageObj);
        list.push({ "key": "id", "value": id, "data": obj });
    });
    await curseForgeUpdateBatch(list);
    curseForgeImages = imageList;
}

async function downloadImages(isStart) {
    let maxDownloads = 1;
    let currentDownloads = 0;
    let downloadIndex = 0;

    sendSplashUpdate({ "step": 6, "subStep": 3 });

    function finish() {
        step4();
    }

    async function downloadIMG(element) {

        try {
            const downloader = new Downloader({
                url: element.logoThumbnail,
                directory: imageFolder,
                cloneFiles: false,
                fileName: "[CF]" + element.id + ".png"
            });
            const { filePath, downloadStatus } = await downloader.download();
        } catch (error) {
            //Nix
            console.log("[ERROR] ID: " + element.id);
            console.log(error);
        } finally {
            left--;
            currentDownloads--;
            if (currentDownloads < 0) currentDownloads = 0;
            let current = max - left;
            sendSplashUpdate({ "step": 6, "subStep": 4, "current": current, "max": max });
            handleEnd();
        }
    }

    async function downloadNext() {
        for (let index = downloadIndex; index < missing.length && index < downloadIndex + maxDownloads - currentDownloads; index++) {
            const element = missing[index];
            currentDownloads++;
            downloadIndex = index + 1;
            downloadIMG(element);
        }
    }

    async function handleEnd() {
        if (left > 0) {
            //Nix
            downloadNext();
            return;
        }

        await setCurseForgeImages();
        finish();
    }



    let imageFolder = baseFolderPath + path.sep + "images";
    let missing = [];

    for (let index = 0; index < curseForgeImages.length; index++) {
        const element = curseForgeImages[index];
        let file = imageFolder + path.sep + "[CF]" + element.id + ".png";
        if (!fs.existsSync(file)) {
            missing.push(element);
        }
    }

    let max = missing.length;
    let left = max;
    handleEnd();
}

async function setCurseForgeImages() {

    let list = await knex("Files").select(["Files.id", "Files.cf_id"]).where((b1) => {
        b1.orWhere("Files.image_source", null);
        b1.orWhere("Files.image_source", 0);
        b1.orWhere((b2 => {
            b2.where("primaryCategoryId", 5091)
            b2.where((b3) => {
                b3.orWhere("Files.image_source", null);
                b3.orWhere("Files.image_source", 0);
                b3.orWhere("Files.image_source", 1);
            })
        }))
    }).join("CurseForge", 'Files.cf_id', 'CurseForge.id');

    let updateList = [];

    list.forEach((element) => {
        let file = baseFolderPath + path.sep + "images" + path.sep + "[CF]" + element.cf_id + ".png";
        if (fs.existsSync(file)) {
            updateList.push({
                "key": "id",
                "value": element.id,
                "data": {
                    "image_source": 4,
                    "image": file
                }
            })
        }
    })
    await filesBatch(updateList);
}


function step1() {
    startCurseForgeFingerprintCheck();
}

function step2() {
    checkForUpdatesForge();
}

function step3() {
    downloadImages();
}

function step4() {
    //Finish
    ipcRenderer.send("splash", {
        step: 7
    });
}

function sendSplashUpdate(obj) {
    //console.log(obj);
    ipcRenderer.send("splash", {
        "action": "ipc-send",
        "data": obj
    });
}

function sendChannelUpdate(channel, obj) {
    console.log(obj);
}

async function isCurseForgeOn() {
    return true;
}

ipcRenderer.on("start", async(event, data) => {
    console.log("[CURSEFORGE] Start");
    let connected = false;
    if (data.logFolderPath) logFolderPath = data.logFolderPath;
    if (data.apiKey) apiKey = data.apiKey;
    if (data.baseFolderPath) connected = setup(data.baseFolderPath);

    if (!connected) {
        //Not Connected close CurseForge
    }

    //Start Steps
    step1();
});