const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const util = require('util');
const axios = require('axios');
const Downloader = require("nodejs-file-downloader");
const AdmZip = require("adm-zip");
const NAMEUTIL = require('./FilenameUtil.js');

const HEADER = {
    headers: { "Accept": 'application/json', "x-api-key": "$2a$10$87N.onn5OiHZ7IXVvohTPegNQAkcx37YvlcCZsBZhOpmoO2ycH5um" }
}

let appRef = process.platform === "darwin" ?  "app://s4mmm-electron-app-mac" : "app://s4mm-electron-app-win";
let userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Sims4ModManager/1.2.12-beta Chrome/126.0.6478.234 Electron/31.7.8 Safari/537.36";

let MODE = 0; // 0-Simple 1-CreatorFolder 3-Custom
const BASE = "https://api.curseforge.com";
let baseFolderPath = "G:\\User data\\Documents\\Sims 4 Mod Manager Data"
let downloadFolder = "";
let imageFolder = ""

downloadListIDAdd = [];

downloadList = [];
finishedDownloads = [];

idSet = new Set();
modpacks = new Map();


//Create Folders
function setup(bfp) {
    baseFolderPath = bfp;
    downloadFolder = bfp + path.sep + "downloads";
    imageFolder = bfp + path.sep + "images";


    console.log("[DOWNLOADER] Setup");
    console.log("- " + baseFolderPath);
    console.log("- " + downloadFolder);
    console.log("- " + imageFolder);

    cleanDownloadFolder();
}

//Clean Download Folder
function cleanDownloadFolder() {
    if (!fs.existsSync(downloadFolder)) return;
    fs.readdirSync(downloadFolder).forEach(file => {
        let folder = downloadFolder + path.sep + file;
        let count = 0;
        count = containsSimsFile(folder);
        //console.log(folder + " -> " + count);
        if (count == 0) {
            fs.rmSync(folder, { recursive: true, force: true });
        }
    });
}

function containsSimsFile(folder) {
    let v = 0;
    if (fs.lstatSync(folder).isDirectory()) {
        fs.readdirSync(folder).forEach(file => {
            let v1 = containsSimsFile((folder + path.sep + file));
            v = v + v1;
        });

    } else if (NAMEUTIL.isSims4File(folder)) {
        v = v + 1;
    }

    return v;
}



//setup(baseFolderPath);

//Get Data for all ids 
function fillDonloadList() {
    if (downloadListIDAdd.length == 0) {
        console.log("Finished");
        //console.log(downloadList);
        downloadFirstFile();
    } else {
        let id = downloadListIDAdd[0].id;
        downloadListIDAdd.shift();
        axios.get(BASE + '/v1/mods/' + id, HEADER)
            .then(function(response) {
                // handle success
                downloadList.push(response.data.data);
                update_downloadList();
            })
            .catch(function(error) {
                // handle error
                console.log(error);
            })
            .finally(function() {
                // always executed
                fillDonloadList();
            });
    }
}

//Start Dowloading
currentDownload = undefined;

function downloadFirstFile() {
    if (currentDownload != undefined) return;
    if (downloadList.length < 1) return;
    currentDownload = downloadList[0];
    downloadList.shift();
    update_downloadList();

    //Current
    currentDownload.status = 0;
    currentDownload.downloadProgress = 0;

    console.log("currentDownload:");
    console.log(currentDownload);

    //Simple Latest File
    if (!currentDownload.downloadLinks) {

        let mainFileId = currentDownload.mainFileId;
        currentDownload.downloadLinks = [];
        currentDownload.latestFiles.forEach((element) => {
            let downloadUrl = element.downloadUrl;
            let fileID = element.id;
            let fingerprints = [];
            if (downloadUrl != undefined &&
                downloadUrl != null &&
                fileID != undefined &&
                element.modules != undefined &&
                element.modules.length > 0 && fileID == mainFileId) {

                element.modules.forEach((modul) => {
                    fingerprints.push(modul.fingerprint)
                });
                currentDownload.downloadLinks.push({
                    "fileID": fileID,
                    "url": downloadUrl,
                    "fingerprints": fingerprints
                });
                //currentDownload.downloadLinks.push(downloadUrl);
            } else {
                //Get Old way
                console.log("This is bad");
            }
        });

        if (currentDownload.downloadLinks.length > 0) {
            downloadCurrent();
        } else {
            //Get Link Old Way
            let msg = currentDownload.name + " could not be downloaded!"
            ipcRenderer.send("simple-task", { "action": "toast", "msg": msg, "duration": 300 });
            nextItem();
        }



    } else {
        //Advanced
        downloadCurrent();
    }
}

function getFileIdsFromFolder(file, idSet) {
    if (fs.lstatSync(file).isDirectory()) {
        //Is folder
        fs.readdirSync(file).forEach((element) => {
            let filePath = file + path.sep + element;
            getFileIdsFromFolder(filePath, idSet);
        })
        return;
    }

    //Is File
    if (NAMEUTIL.isSims4File(file)) {
        let ino = fs.statSync(file).ino;
        idSet.add(ino);
    }

}

function downloadCurrent() {
    if (currentDownload == undefined) {
        console.log("Download is wrong");
        return;
    }

    if (!currentDownload.downloadLinks) {
        console.log("No Download Link");
        return;
    }

    let links = currentDownload.downloadLinks;
    let id = currentDownload.id;
    let folder = downloadFolder + path.sep + id;
    console.log(currentDownload);


    //Dependency
    let deps = new Set();
    if (currentDownload.latestFiles) {
        currentDownload.latestFiles.forEach((e1) => {
            if (e1.dependencies) {
                e1.dependencies.forEach((e2) => {
                    if (e2.relationType == 3) {
                        deps.add(e2.modId);
                    }
                })
            }
        })
    }


    (async() => {

        //Clear Folder
        if (fs.existsSync(folder)) {

            //Get Old Files
            let idSet = new Set();
            getFileIdsFromFolder(folder, idSet);
            currentDownload.filesToDelete = Array.from(idSet);

            //Clean Folder
            fsExtra.emptyDirSync(folder);
        }

        let lastUpdate = 0;
        let interval = 75;


        try {
            for (let index = 0; index < links.length; index++) {
                const link = links[index].url;
                const downloader = new Downloader({
                    url: link,
                    directory: folder,
                    cloneFiles: false,
                    headers: {
                        "Referer":appRef,
                        "User-Agent":userAgent
                    },
                    onProgress: function(percentage, chunk, remainingSize) {
                        //console.log("% ", percentage);
                        currentDownload.status = 1;
                        let cur = Date.now();
                        if (cur > (lastUpdate + interval)) {

                            currentDownload.downloadProgress = percentage;

                            update_current();
                            lastUpdate = cur;
                        }
                    },
                });
                const { filePath, downloadStatus } = await downloader.download();
            }

            currentDownload.status = 2;
            currentDownload.downloadProgress = "100.00";
            update_current();
            console.log("All done");

        } catch (error) {
            //IMPORTANT: Handle a possible error. An error is thrown in case of network errors, or status codes of 400 and above.
            //Note that if the maxAttempts is set to higher than 1, the error is thrown only if all attempts fail.
            console.log("Download failed", error);
        } finally {

            extractZip(folder)
                //finishedDownloads.push(currentDownload);
                //currentDownload = undefined;
                //downloadFirstFile();
        }
    })();



    downloadDependencies(Array.from(deps));


    //Download next 
    //downloadFirstFile();

}

async function downloadDependencies(list) {
    if (list.length == 0) return;
    list.forEach((element) => {
        axios.get(BASE + '/v1/mods/' + element, HEADER)
            .then(function(response) {
                // handle success
                //downloadList.push(response.data.data);
                let obj = response.data.data;
                let list = [];
                list.push(obj);
                ipcRenderer.send("cuseforge", {
                    "action": "addCCBasket-complete",
                    "data": list
                });
                //update_downloadList();
            })
            .catch(function(error) {
                // handle error
                console.log(error);
            })
            .finally(function() {
                // always executed
                //fillDonloadList();
            });
    })
}

async function extractZip(folder) {
    let files = fs.readdirSync(folder);
    let zips = [];
    files.forEach((element) => {
        if (element.endsWith(".zip")) zips.push(element);
    });

    let isComplex = false;
    let complexFiles = [];

    //Unzip Files
    for (let index = 0; index < zips.length; index++) {
        try {
            //Unzip
            const element = zips[index];
            let destionation = folder;
            let zip = new AdmZip(folder + path.sep + element);
            zip.extractAllTo(destionation, true);

            //Delet Zip
            fs.unlinkSync(folder + path.sep + element);

            //CheckFiles
            containsComplexFiles(destionation, complexFiles);
            isComplex = complexFiles.length > 0;

            //Save Data
            //let dataFiile = folder + path.sep + "data.json";
            //fs.writeFileSync(dataFiile, JSON.stringify(currentDownload), 'utf8');

            //Download Icon
            if (currentDownload.logo && currentDownload.logo.thumbnailUrl) {
                const downloader = new Downloader({
                    url: currentDownload.logo.thumbnailUrl,
                    directory: imageFolder,
                    cloneFiles: false,
                    fileName: "[CF]" + currentDownload.id + ".png",
                    headers: {
                        "Referer":appRef,
                        "User-Agent":userAgent
                    }
                });
                try {
                    currentDownload.status = 3;
                    update_current();
                    const { filePath, downloadStatus } = await downloader.download(); //Downloader.download() resolves with some useful properties.

                    console.log("Logo Donwloaded");

                } catch (error) {

                    console.log("Download failed", error);
                } finally {

                }
            }

        } catch (err) {
            console.log("internal")
            console.log(err);
        }
    }

    //Add Time
    currentDownload.downloadTime = Date.now();



    if (isComplex) {

        send_complexAlert(currentDownload, complexFiles, folder);
    } else {
        console.log("send_import_current was send");
        send_import_current(folder);
    }
}

function nextItem() {
    finishedDownloads.push(currentDownload);
    update_finished();
    currentDownload = undefined;
    downloadFirstFile();
    update_current();
}

function containsComplexFiles(file, complexFiles) {
    try {
        if (fs.lstatSync(file).isDirectory()) {
            try {
                fs.readdirSync(file).forEach((f) => { containsComplexFiles(path.join(file, f), complexFiles) });
            } catch (error) {
                console.log(error);
            }
        } else {
            //console.log("File: " + file)
            if (!NAMEUTIL.isSims4File(file) && !file.endsWith(".txt")) {
                complexFiles.push(file)
            }
        }
    } catch (error) {
        console.log(error);
    }
}

//IPC Send Updates
function update_current() {
    ipcRenderer.send("download", { "action": "update-current", "isEmpty": currentDownload == undefined, "current": currentDownload });
    update_isDownloading();
}

function update_downloadList() {
    ipcRenderer.send("download", { "action": "update-list", "list": downloadList });
    update_isDownloading();
}

function update_finished() {
    ipcRenderer.send("download", { "action": "update-finished", "list": finishedDownloads });
}

function update_isDownloading() {
    ipcRenderer.send("download", { "action": "set-is-downloading", "isDownloading": (downloadList.length != 0 || currentDownload != undefined) });
}

function send_import_current(folder) {

    //Expand with mod pack
    if (currentDownload &&
        currentDownload.downloadInfo &&
        currentDownload.downloadInfo.modpack &&
        modpacks.has(currentDownload.downloadInfo.modpack)) {
        currentDownload.modpack = modpacks.get(currentDownload.downloadInfo.modpack);
    }

    ipcRenderer.send("download", {
        "action": "import-project",
        "item": currentDownload,
        "itemFolder": folder,
        "downloadMode": MODE
    });
    console.log("send_import_current was send");
}

//Complex
let lastFolder = null;

function send_complexAlert(item, files, folder) {
    lastFolder = folder;
    ipcRenderer.send("download", {
        "action": "complex-alert",
        "item": item,
        "files": files,
        "folder": folder
    });
}

function cleanComplexFolder(folder) {
    if (folder == null) return;
    fsExtra.emptyDirSync(folder);
}


//Creator Folder image
async function downloadCreatorFolderCover(creatorName, foderIno) {

}


//IPC Inputs

ipcRenderer.on("resume-download", async(event, data) => {
    let resumeAction = data.resumeAction;
    if (resumeAction == 0) {
        //Skipp
        cleanComplexFolder(lastFolder);
        nextItem();
    }
    if (resumeAction == 1) send_import_current(lastFolder); // Basic
    if (resumeAction == 2) {
        currentDownload.isComplex = true;
        send_import_current(lastFolder);
        // Complex
    }
    lastFolder = null;
});

ipcRenderer.on("add-id", async(event, data) => {
    console.log("ADD IDS")
    console.log(data);
    if (data.list) {
        downloadListIDAdd.push(...data.list);
        fillDonloadList();
    }
});

ipcRenderer.on("add-id-complete", async(event, data) => {
    //console.log("ADD IDS")
    //console.log(data);
    if (data.modpack && data.modpack.id) {
        modpacks.set(data.modpack.id, data.modpack);
        console.log(modpacks);
    }
    if (data.list) {
        downloadList.push(...data.list);
        update_downloadList();
        fillDonloadList();
    }
});

ipcRenderer.on("remove-id", async(event, data) => {
    console.log("REMOVE ID")
    let id = data.id;
    if (!id) return;
    for (let index = downloadList.length - 1; index >= 0; index--) {
        const elementID = downloadList[index].id;
        if (elementID == id) {
            downloadList.splice(index, 1);
        }
    }
    update_downloadList();
});


ipcRenderer.on("next", async(event, data) => {
    nextItem();
});

ipcRenderer.on("setup", async(event, data) => {
    console.log("[DOWNLOADER] SETUP");
    if (data.baseFolderPath) setup(data.baseFolderPath);
});

ipcRenderer.on("set-mode", async(event, data) => {
    if (data.mode != undefined) MODE = data.mode;
    console.log("[DOWNLOADER] Modus: " + MODE);
});

ipcRenderer.on("check-images", async(event, data) => {
    if (!data.list || data.list.length == 0) return;
    console.log("check-images");
    //console.log(data.list);
    let installed = 0;
    for (let index = 0; index < data.list.length; index++) {
        const element = data.list[index];
        let file = imageFolder + path.sep + "[CF]" + element.id + ".png";
        if (!fs.existsSync(file)) {
            const downloader = new Downloader({
                url: element.logoThumbnail,
                directory: imageFolder,
                cloneFiles: false,
                fileName: "[CF]" + element.id + ".png",
                headers: {
                    "Referer":appRef,
                    "User-Agent":userAgent
                }
            });
            try {
                const { filePath, downloadStatus } = await downloader.download();
                console.log("Logo Donwloaded");

            } catch (error) {
                console.log("Download failed", error);
            } finally {
                installed++;
            }
        }

    }

    if (installed > 0) ipcRenderer.send("cuseforge", { "action": "set-images" });
});