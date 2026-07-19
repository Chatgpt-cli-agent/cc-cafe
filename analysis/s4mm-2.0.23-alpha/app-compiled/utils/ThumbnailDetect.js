"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThumbnailDetect = void 0;
const electron_1 = require("electron");
const WorkerQueue_1 = require("./WorkerQueue");
const SimilarImageProcessing_1 = require("./SimilarImageProcessing");
const IPCExtras_1 = require("./IPCExtras");
const imageHash = require('image-hash-local-only');
var fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const screenshot = require('screenshot-desktop');
let saveDebugImages = false;
let logTimes = false;
class ThumbnailDetect {
    constructor(main, ignorSetup) {
        this.ipcChannel = "thumbnail-detect";
        this.isMac = process.platform === "darwin";
        this.workerIndex = 0;
        this.listenerOn = false;
        this.folderMain = "./thumbnailDetect";
        this.folderImages = "./thumbnailDetect/Images";
        this.folderItems = "./thumbnailDetect/Items";
        this.hashMap = new Map();
        this.id = 0;
        this.itemsId = 0;
        this.itemsMap = new Map();
        this.overlay = undefined;
        this.settings = {
            overlayOn: true,
            hotkeys: {
                startStop: "",
                trigger: ""
            },
            timeLogs: false,
            saveScreenshot: false,
            saveProcessed: false,
            imGrayscale: false,
            imTopBox: true,
            imBottomCut: true,
            imNormalize: true,
            imEdgeDetect: false,
            hashSize: 128
        };
        this.lastPos = [];
        this.swipeServer = undefined;
        this.main = main;
        this.setupFolders();
        if (!ignorSetup)
            this.setupOther();
        this.stopTriggerListener();
        this.cleanItemsFolder();
        let mainWindow = main.mainWindowController.getWindow();
        if (mainWindow)
            IPCExtras_1.IPCExtras.sendFromMain(mainWindow, "screenshot-detect-service", { action: "send-settings" });
    }
    setSwipeServer(server) {
        this.swipeServer = server;
    }
    setupOther() {
        electron_1.ipcMain.handle(this.ipcChannel, async (event, data) => {
            let result = undefined;
            if (data.action == "get-status") {
                return { status: this.isListening() };
            }
            else if (data.action == "change-status") {
                if (data.settings) {
                    this.updateSettings(data.settings);
                }
                if (data.status) {
                    console.log("Trigged Here");
                    this.startTriggerListener();
                }
                else {
                    this.stopTriggerListener();
                }
                return { status: this.isListening() };
            }
            throw new Error("No action");
        });
        electron_1.ipcMain.on(this.ipcChannel + "_on", (event, data) => {
            if (data.action == "match-result") {
                this.handleMatchResult(data);
            }
            else if (data.action == "update-main-window") {
                this.sendIpcMessage("screenshot-detect-service", { action: "update-status", isOn: this.listenerOn });
            }
            else if (data.action == "close-from-overlay") {
                this.stopTriggerListener();
                this.updateMainWindowSate();
            }
            else if (data.action == "update-settings") {
                this.updateSettings(data.settings);
            }
            else if (data.action == "change-status") {
                this.stateChange(data);
                //return {status:this.isListening()};
            }
            else if (data.action == "list-get") {
                this.sendListUpdate();
            }
            else if (data.action == "list-clear") {
                this.itemsMap = new Map();
                this.sendListUpdate();
            }
            else if (data.action == "list-remove" && data.id != undefined) {
                this.removeItem(data.id);
            }
            else if (data.action == "list-delete-update" && data.ids != undefined) {
                this.removeDeletedFiles(data.ids);
            }
        });
    }
    sendListUpdate() {
        let valuesArray = Array.from(this.itemsMap.values());
        valuesArray.sort((a, b) => a.id - b.id);
        this.sendIpcMessage("screenshot-detect-service", {
            action: "set-items",
            items: valuesArray
        });
    }
    removeItem(id) {
        this.itemsMap.delete(id);
        this.sendIpcMessage("screenshot-detect-service", {
            action: "remove-item",
            id: id
        });
    }
    removeDeletedFiles(ids) {
        let toDelete = new Set(ids);
        let keys = Array.from(this.itemsMap.keys());
        for (let index = 0; index < keys.length; index++) {
            const key = keys[index];
            let element = this.itemsMap.get(key);
            if (element) {
                if (!element.info)
                    continue;
                if (!element.info.file)
                    continue;
                if (toDelete.has(element.info.file.ino)) {
                    element.info.file = undefined;
                }
                for (let u = element.info.otherFiles.length - 1; u >= 0; u--) {
                    const otherFile = element.info.otherFiles[u];
                    if (toDelete.has(otherFile.ino)) {
                        element.info.otherFiles.splice(u, 1);
                    }
                }
                if (element.info.file == undefined && element.info.otherFiles.length > 0) {
                    element.info.file = element.info.otherFiles.shift();
                }
                if (element.info.file == undefined) {
                    this.itemsMap.delete(key);
                }
                else {
                    this.itemsMap.set(key, element);
                }
            }
            else {
                this.itemsMap.delete(key);
            }
        }
        this.sendListUpdate();
    }
    stateChange(data) {
        try {
            if (data.settings) {
                this.updateSettings(data.settings);
            }
            if (data.status) {
                console.log("Trigged Here");
                this.startTriggerListener();
            }
            else {
                this.stopTriggerListener();
            }
        }
        catch (error) {
            try {
                this.stopTriggerListener();
            }
            catch (e0) {
                console.log(e0);
            }
            this.sendIpcMessage("screenshot-detect-service", {
                action: "handle-error",
                error: error
            });
        }
        this.sendIpcMessage("screenshot-detect-service", {
            action: "update-state",
            isOn: this.listenerOn
        });
    }
    setupFolders() {
        this.folderImages = this.main.folderStructureController.getFolder("thumbnails");
        this.folderMain = this.main.folderStructureController.getFolder("tool-thumbnailDetect");
        this.folderItems = this.main.folderStructureController.getFolder("tool-thumbnailDetect-items");
    }
    cleanItemsFolder() {
        let folderPath = this.main.folderStructureController.getFolder("tool-thumbnailDetect-items");
        if (!folderPath || !fs.existsSync(folderPath))
            return;
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                console.error('Error reading directory:', err);
                return;
            }
            files.forEach((file) => {
                if (file.startsWith('item_') && file.endsWith('.jpeg')) {
                    fs.unlink(path.join(folderPath, file), (err) => {
                        if (err) {
                            console.error('Error deleting file:', file, err);
                        }
                    });
                }
            });
        });
    }
    updateSettings(data) {
        if (!data)
            return;
        let os = this.settings;
        this.settings = data;
        if (data.saveScreenshot != undefined)
            saveDebugImages = data.saveScreenshot;
        if (data.timeLogs != undefined)
            logTimes = data.timeLogs;
        this.updateHotKeys(os, data);
    }
    async updateHotKeys(os, ns) {
        if (os.hotkeys.startStop != ns.hotkeys.startStop) {
            if (os.hotkeys.startStop != "" && electron_1.globalShortcut.isRegistered(os.hotkeys.startStop)) {
                try {
                    electron_1.globalShortcut.unregister(os.hotkeys.startStop);
                }
                catch (error) {
                    console.log(error);
                }
            }
            console.log("[SHORTCUTS] Register: " + ns.hotkeys.startStop);
            try {
                await electron_1.globalShortcut.register(ns.hotkeys.startStop, () => {
                    console.log("Toggle Tool!");
                    if (this.listenerOn) {
                        this.stopTriggerListener();
                    }
                    else {
                        this.startTriggerListener();
                    }
                    this.updateMainWindowSate();
                });
            }
            catch (error) {
                //Rest
                this.sendIpcMessage("screenshot-detect-service", { action: "reset-hotkey" });
            }
        }
    }
    async setHotKey(newHotKey, oldHotKey) {
        if (oldHotKey != "" && electron_1.globalShortcut.isRegistered(oldHotKey)) {
            try {
                electron_1.globalShortcut.unregister(oldHotKey);
            }
            catch (error) {
                console.log(error);
            }
        }
        console.log("[SHORTCUTS] Register: " + newHotKey);
        try {
            await electron_1.globalShortcut.register(newHotKey, () => {
                this.runScan();
            });
        }
        catch (error) {
            console.log("Failed to register hotkey: " + newHotKey);
            this.sendIpcMessage("screenshot-detect-service", { action: "handle-error", error: { message: "Failed to bind hotkey! - " + newHotKey } });
        }
    }
    async removeHotKey(hotKey) {
        try {
            electron_1.globalShortcut.unregister(hotKey);
        }
        catch (error) {
            console.log(error);
        }
    }
    updateMainWindowSate() {
        this.sendIpcMessage("screenshot-detect-service", { action: "update-state", isOn: this.listenerOn });
    }
    isListening() {
        return this.listenerOn;
    }
    startTriggerListener() {
        console.log("startTriggerListener");
        if (this.listenerOn)
            return;
        this.listenerOn = true;
        this.loadThumbnailsHash();
        this.setHotKey(this.settings.hotkeys.trigger, "");
        if (this.overlay == undefined && this.settings.overlayOn && !this.isMac) {
            this.startOverlay();
        }
    }
    stopTriggerListener() {
        if (!this.listenerOn)
            return;
        this.listenerOn = false;
        this.removeHotKey(this.settings.hotkeys.trigger);
        if (this.overlay) {
            if (this.overlay.isDestroyed()) {
                this.overlay = undefined;
            }
            if (this.overlay && !this.overlay.closed)
                this.overlay.close();
            this.overlay = undefined;
        }
    }
    startOverlay() {
        try {
            let window = new electron_1.BrowserWindow({
                width: 340 * 1,
                height: 236 * 1,
                x: 20,
                y: 20,
                show: true,
                alwaysOnTop: true,
                transparent: true,
                frame: false,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });
            window.loadFile('./views/ccdetect/ccDetector.html');
            window.setMenu(null);
            window.setAlwaysOnTop(true, 'pop-up-menu');
            window.setVisibleOnAllWorkspaces(true);
            window.setFullScreenable(false);
            // Make the window mouse transparent
            //window.setIgnoreMouseEvents(true);
            window.on("ready-to-show", () => {
                //window.webContents.openDevTools();
            });
            this.overlay = window;
        }
        catch (err) {
            console.log("[ERROR-OVERLAY]: " + err);
        }
    }
    async runScan() {
        let t = Date.now();
        let displays = electron_1.screen.getAllDisplays();
        let cursorPosition = electron_1.screen.getCursorScreenPoint();
        ;
        let cursorDisplayData = calculateCursorPositionWithScale(cursorPosition, displays);
        if (!cursorDisplayData)
            return;
        try {
            let sDisplays = await screenshot.listDisplays();
            let screenId = getScreenId(cursorDisplayData.display.raw, sDisplays);
            let image = await screenshot({ format: 'jpg', screen: screenId });
            if (logTimes)
                console.log(`Getting Image and cursor data took ${(Date.now() - t)}ms`);
            this.processImage(image, cursorDisplayData, true).then((result) => {
                this.addNewItemToList(result);
            }).catch((err) => {
                console.log(err);
            });
        }
        catch (error) {
            console.log(error);
        }
    }
    async handleMatchResult(data) {
        console.log("handleMatchResult");
        console.log(data);
        let item = this.itemsMap.get(data.index);
        if (!item) {
            console.log("NO Match found in itemsmap");
            console.log(data);
            return;
        }
        //TODO Bat match Check
        //if()
        //Send info
        let info = await this.getInfoByThumbnailId(data.result.id);
        item.info = info;
        item.state = 2;
        if (data.result) {
            item.distance = data.result.distance;
            item.hashSize = data.result.hashSize;
        }
        this.sendIpcMessage("screenshot-detect-service", { action: "update-item", item: item });
        if (this.overlay)
            this.overlay.webContents.send("screenshot-detect-service", { action: "update-item", item: item });
    }
    async getInfoByThumbnailId(id) {
        try {
            let knex = this.main.databaseController.getKnex();
            let thumbnailItems = await knex.from("Thumbnails").where("id", id).select(["id", knex.raw("CAST(ino as TEXT) as ino"), "image", "instance"]);
            if (thumbnailItems.length != 1) {
                return undefined;
            }
            thumbnailItems[0].thumbnailFolder = this.folderImages;
            let mainFile = undefined;
            let otherFiles = [];
            //Get main File by ino if posible
            if (thumbnailItems[0].ino != 0) { //Check if cache file
                let files = await knex.from("Files").where("ino", thumbnailItems[0].ino).select([knex.raw("CAST(ino as TEXT) as ino"), "name", "path", "image", "merged", "recolor", "size", "mtime"]);
                if (files.length == 1)
                    mainFile = files[0];
            }
            //Get Files by instance
            otherFiles = await knex.from('Entries')
                .distinct()
                .select(knex.raw("CAST(Files.ino as TEXT) as ino"), 'Files.name', 'Files.path', 'Files.image', 'Files.merged', 'Files.recolor', 'Files.size', 'Files.mtime')
                .join('Files', 'Entries.ino', 'Files.ino')
                .where('Entries.instance', thumbnailItems[0].instance);
            if (!mainFile && otherFiles.length > 0) {
                mainFile = otherFiles.shift();
            }
            else if (mainFile && otherFiles.length > 0) {
                otherFiles = otherFiles.filter((item) => item.id != mainFile.id);
            }
            console.warn("INSTANCE MATCH WILL NOT WORK AT THE MOMENT SINCE INCTANCE IS A NUMBER AND NOT HEXSTRING!");
            //Other thumbnail
            let otherImage = undefined;
            if (thumbnailItems[0]) {
                otherImage = thumbnailItems[0].thumbnailFolder + "/" + thumbnailItems[0].image;
            }
            if (mainFile) {
                return {
                    thumbnail: thumbnailItems[0],
                    file: mainFile,
                    otherFiles: otherFiles,
                    otherImage: otherImage
                };
            }
            return undefined;
        }
        catch (error) {
            console.log(error);
            return undefined;
        }
    }
    addNewItemToList(obj) {
        this.itemsId++;
        obj.id = this.itemsId;
        if (obj.state != 0)
            this.itemsMap.set(obj.id, obj);
        this.sendIpcMessage("screenshot-detect-service", { action: "new-item", item: obj });
        if (this.overlay)
            this.overlay.webContents.send("screenshot-detect-service", { action: "new-item", item: obj });
        if (obj.state == 1)
            this.findMatchHash(obj);
    }
    async findMatchHash(obj) {
        let workerId = this.workerIndex;
        let workers = this.main.workersController.workers;
        this.workerIndex++;
        if (this.workerIndex >= workers.length)
            this.workerIndex = 0;
        if (workers.length == 0)
            return;
        /*
        //Old Version
        this.workers[workerId].webContents.send("work-queue",{
            index:obj.id,
            task:{
                action:"findClosestHash",
                data:{
                    item:obj,
                    hashmap:this.hashMap,
                    options:this.settings
                }
            },
            channel:this.ipcChannel+"_on",
            returnAction:"match-result"
        });*/
        //New Version
        let tt = Date.now();
        let batchesCount = workers.length;
        let batchSize = Math.ceil(this.hashMap.size / batchesCount);
        let tasks = [];
        let arr = Array.from(this.hashMap);
        //Create imageHash
        let imageHash = undefined;
        try {
            if (obj.imageProcessed)
                imageHash = await generateHash(obj.imageProcessed, this.settings.hashSize);
        }
        catch (error) {
            console.log(error);
        }
        for (let index = 0; index < batchesCount; index++) {
            let start = index * batchSize;
            let end = start + batchSize;
            if (end > this.hashMap.size)
                end = this.hashMap.size;
            let subMap = new Map(arr.slice(start, end));
            tasks.push({
                action: "findClosestHash",
                data: {
                    item: obj,
                    hashmap: subMap,
                    options: this.settings,
                    imageHash: imageHash
                }
            });
        }
        if (logTimes)
            console.log(`Prep time was ${(Date.now() - tt)}ms`);
        let workerQ = new WorkerQueue_1.WorkerQueue(this.main.workersController, tasks, {}, (progress) => {
            //Nix
        }, (results) => {
            if (this.settings.saveProcessed == false)
                fs.unlinkSync(obj.imageProcessed);
            let bestResult = {
                id: null,
                distance: Infinity,
                hashSize: imageHash ? imageHash.length : (this.settings.hashSize * 4),
                time: 0
            };
            for (let index = 0; index < results.length; index++) {
                const element = results[index];
                if (element && element.data && element.data.distance < bestResult.distance) {
                    bestResult.id = element.data.id;
                    bestResult.distance = element.data.distance;
                    bestResult.time = element.data.time;
                }
            }
            if (logTimes)
                console.log(`Match found in ${(Date.now() - tt)}ms`);
            this.handleMatchResult({ index: obj.id, result: bestResult });
        });
    }
    loadThumbnailsHash() {
        let knex = this.main.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        knex.from("Thumbnails").select("hash", "id").then((result) => {
            for (let index = 0; index < result.length; index++) {
                const element = result[index];
                this.hashMap.set(element.id, element.hash);
            }
        });
    }
    async processImage(image, cdd, direct) {
        let id = this.id;
        this.id++;
        let returnObj = {
            id: id,
            state: 0,
            error: undefined,
            image: undefined,
            imageProcessed: undefined
        };
        try {
            let moitorImageBuffer = (this.isMac || direct) ? image : await cropImage(image, cdd.display);
            let t = Date.now();
            let result = await this.findGreenBorder(moitorImageBuffer, cdd);
            if (logTimes)
                console.log(`findGreenBorder took ${(Date.now() - t)}ms`);
            if (result) {
                let imp_item = path.join(this.folderItems, "item_" + id + "_" + Date.now() + ".jpeg");
                let imp_item_p = path.join(this.folderItems, "item_" + id + "_" + Date.now() + "_p.jpeg");
                let itemImageBuffer = await cropImage(moitorImageBuffer, result);
                let procces = await (0, SimilarImageProcessing_1.processImageBufferWithOptions)(itemImageBuffer, {
                    grayscale: this.settings.imGrayscale,
                    addBlack: this.settings.imTopBox,
                    normalize: this.settings.imNormalize,
                    edgeDetection: this.settings.imEdgeDetect,
                    removeBottom: this.settings.imBottomCut,
                });
                fs.writeFileSync(imp_item, itemImageBuffer);
                fs.writeFileSync(imp_item_p, procces);
                returnObj.state = 1;
                returnObj.image = imp_item;
                returnObj.imageProcessed = imp_item_p;
                return returnObj;
            }
            return returnObj;
        }
        catch (error) {
            console.log(error);
            throw new Error("Invalid image");
        }
    }
    async testingWithImage(imagePath, x, y) {
        let imageBuffer = fs.readFileSync(imagePath);
        try {
            let result = await this.findGreenBorder(imageBuffer, { cursor: {
                    xm: x,
                    ym: y
                } });
            if (result) {
                console.log(result);
                let imp_item = path.join(this.folderMain, "item.png");
                let itemImageBuffer = await cropImage(imageBuffer, result);
                fs.writeFileSync(imp_item, itemImageBuffer);
            }
        }
        catch (error) {
            console.log(error);
        }
    }
    async findGreenBorder(imageBuf, cdd) {
        try {
            let t = Date.now();
            const { data, info } = await sharp(imageBuf).raw().toBuffer({ resolveWithObject: true });
            if (logTimes)
                console.log(`   findGreenBorder-sharp(imageBuf) took ${(Date.now() - t)}ms`);
            t = Date.now();
            let frame = await getFrameSharp(data, info, cdd.cursor.xm, cdd.cursor.ym, this.folderMain, this.isMac);
            if (logTimes)
                console.log(`   findGreenBorder-getFrame() took ${(Date.now() - t)}ms`);
            if (saveDebugImages)
                console.log(frame);
            if (frame) {
                let result = {
                    imageWidth: info.width,
                    imagehHeight: info.height,
                    x: frame.left.x + 1,
                    y: frame.top.y + 1,
                    width: frame.width - 1,
                    height: frame.height - 1
                };
                let s = scaleRectangle(result, 0.98);
                return s;
            }
        }
        catch (error) {
            throw new Error(`Error checking pixel colors: ${error.message}`);
        }
        return undefined;
    }
    sendIpcMessage(channel, data) {
        //this.main.mainWindowController.getWindow()?.webContents.send(channel,data);
        let mainWindow = this.main.mainWindowController.getWindow();
        if (mainWindow) {
            console.log("Sending from cc detect:", {
                channel: channel,
                data: data
            });
            IPCExtras_1.IPCExtras.sendFromMain(mainWindow, channel, data);
        }
        else {
            console.log("[ERROR] No Main Window found to send IPC message");
            return;
        }
        if (this.swipeServer) {
            this.swipeServer.webContents.send("ipc-connect-send", { channel: channel, data: data });
        }
    }
}
exports.ThumbnailDetect = ThumbnailDetect;
async function cropImage(buffer, options) {
    try {
        const image = sharp(buffer);
        const metadata = await image.metadata();
        // Ensure the crop area does not exceed the image boundaries
        let { x, y, width, height } = options;
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0)
            x = 0;
        if (y < 0)
            y = 0;
        if (x + width > metadata.width)
            width = metadata.width - x;
        if (y + height > metadata.height)
            height = metadata.height - y;
        const croppedImage = await image
            .extract({ left: x, top: y, width, height })
            .toBuffer();
        return croppedImage;
    }
    catch (error) {
        throw new Error(`Error cropping image: ${error.message}`);
    }
}
function calculateCursorPositionWithScale(cursorPosition, displays) {
    //Find cursorPos in Screen
    let xSmall = 0;
    let ySmall = 0;
    let xP = undefined;
    let yP = undefined;
    let cDisplay = undefined;
    for (const display of displays) {
        const { x, y, width, height } = display.bounds;
        if (x < xSmall)
            xSmall = x;
        if (y < ySmall)
            ySmall = y;
        if (cursorPosition.x >= x && cursorPosition.x < x + width &&
            cursorPosition.y >= y && cursorPosition.y < y + height) {
            const relativeX = cursorPosition.x - x;
            const relativeY = cursorPosition.y - y;
            xP = relativeX;
            yP = relativeY;
            cDisplay = display;
        }
    }
    if (!(xP != undefined && yP != undefined && cDisplay)) {
        console.log("Cursor not found");
        return null;
    }
    let cursor = {
        xm: Math.floor(xP * cDisplay.scaleFactor),
        ym: Math.floor(yP * cDisplay.scaleFactor)
    };
    //Fix ScreenScaling
    displays.forEach((display) => {
        display.newBounds = {
            width: factorRounding(display.bounds.width, display.scaleFactor),
            height: factorRounding(display.bounds.height, display.scaleFactor),
            x: Math.floor(display.nativeOrigin.x * display.scaleFactor),
            y: Math.floor(display.nativeOrigin.y * display.scaleFactor)
        };
    });
    displaysToZeroPosNewBounds(displays);
    //Get Main offset
    let offet = { x: 0, y: 0 };
    displays.forEach((display) => {
        if (display.bounds.x == 0 && display.bounds.y == 0) {
            offet.x = display.newBounds.x;
            offet.y = display.newBounds.y;
        }
    });
    let display = {
        width: factorRounding(cDisplay.bounds.width, cDisplay.scaleFactor),
        height: factorRounding(cDisplay.bounds.height, cDisplay.scaleFactor),
        x: Math.ceil(cDisplay.nativeOrigin.x * cDisplay.scaleFactor + offet.x),
        y: Math.ceil(cDisplay.nativeOrigin.y * cDisplay.scaleFactor + offet.y),
        raw: cDisplay
    };
    return {
        display: display,
        cursor: cursor
    };
}
function displaysToZeroPosNewBounds(displays) {
    let min = { x: 0, y: 0 };
    let max = { x: 0, y: 0 };
    //Find extrems
    for (let index = 0; index < displays.length; index++) {
        const display = displays[index];
        const bounds = display.newBounds;
        //Min
        if (bounds.x < min.x)
            min.x = bounds.x;
        if (bounds.y < min.y)
            min.y = bounds.y;
        //Max
        if ((bounds.x + bounds.width) > max.x)
            max.x = bounds.x + bounds.width;
        if ((bounds.y + bounds.height) > max.y)
            max.y = bounds.y + bounds.height;
    }
    //Correct for extrems
    let correction = { x: (min.x * -1), y: (min.y * -1) };
    for (let index = 0; index < displays.length; index++) {
        const display = displays[index];
        display.newBounds.x = display.bounds.x + correction.x;
        display.newBounds.y = display.bounds.y + correction.y;
    }
}
function scaleRectangle(rect, multiplier) {
    const newWidth = Math.floor(rect.width * multiplier);
    const newHeight = Math.floor(rect.height * multiplier);
    const deltaX = Math.floor((rect.width - newWidth) / 2);
    const deltaY = Math.floor((rect.height - newHeight) / 2);
    return {
        imageWidth: rect.imageWidth,
        imageHeight: rect.imageHeight,
        x: rect.x + deltaX,
        y: rect.y + deltaY,
        width: newWidth,
        height: newHeight
    };
}
function findRectangle(left, right, top, down) {
    const targetAspectRatio = 104 / 148;
    const tolerance = 0.05;
    for (const l of left) {
        for (const r of right) {
            for (const t of top) {
                for (const d of down) {
                    const width = r.x - l.x;
                    const height = d.y - t.y;
                    const aspectRatio = width / height;
                    if (Math.abs(aspectRatio - targetAspectRatio) <= tolerance) {
                        return {
                            left: l,
                            right: r,
                            top: t,
                            down: d,
                            width,
                            height,
                            aspectRatio
                        };
                    }
                }
            }
        }
    }
    return undefined;
}
async function extractGreenAndBinarize(data, info, threshold, greenMult, searchSpace) {
    let redBlueMult = -2;
    for (let y = searchSpace.yMin; y < searchSpace.yMax; y++) {
        for (let x = searchSpace.xMin; x < searchSpace.xMax; x++) {
            const idx = (info.width * y + x) * info.channels;
            const red = data[idx];
            const green = data[idx + 1];
            const blue = data[idx + 2];
            const newRed = redBlueMult * red - greenMult * green + redBlueMult * blue;
            const newGreen = redBlueMult * red + greenMult * green + redBlueMult * blue;
            const newBlue = redBlueMult * red - greenMult * green + redBlueMult * blue;
            const brightness = 0.299 * Math.min(255, Math.max(0, newRed)) + 0.587 * Math.min(255, Math.max(0, newGreen)) + 0.114 * Math.min(255, Math.max(0, newBlue));
            const color = brightness > threshold ? 255 : 0;
            data[idx + 1] = color; // Green 
            if (saveDebugImages) {
                data[idx + 0] = color;
                data[idx + 2] = color;
            }
        }
    }
}
function calculateXYRange(width, height, x, y, range) {
    const maxDimension = Math.max(width, height);
    const rangeInPixels = range * maxDimension;
    const xMin = Math.max(0, x - rangeInPixels);
    const xMax = Math.min(width, x + rangeInPixels);
    const yMin = Math.max(0, y - rangeInPixels);
    const yMax = Math.min(height, y + rangeInPixels);
    return {
        xMin: Math.round(xMin),
        xMax: Math.round(xMax),
        yMin: Math.round(yMin),
        yMax: Math.round(yMax)
    };
}
function getLinesArrayWithSearchSpace(data, info, x, y, direction, searchSpace) {
    if (!(direction == "up" || direction == "down" || direction == "left" || direction == "right"))
        throw new Error("Invalid Direction");
    let arr = [];
    const width = info.width;
    const height = info.height;
    const radiusX = Math.floor((searchSpace.xMax - searchSpace.xMin) / 2);
    const radiusY = Math.floor((searchSpace.yMax - searchSpace.yMin) / 2);
    if (direction == "down" || direction == "right") {
        // Plus
        const isHorizontal = direction == "right";
        for (let index = isHorizontal ? x : y; index < (isHorizontal ? Math.min(x + radiusX, width) : Math.min(y + radiusY, height)); index++) {
            let lineSize = getLineLengthSharp(data, info, isHorizontal ? index : x, isHorizontal ? y : index, isHorizontal);
            if (lineSize > 0) {
                arr.push({
                    length: lineSize,
                    x: isHorizontal ? index : x,
                    y: isHorizontal ? y : index
                });
            }
        }
    }
    else {
        // Minus
        const isHorizontal = direction == "left";
        for (let index = isHorizontal ? x : y; index >= (isHorizontal ? Math.max(x - radiusX, 0) : Math.max(y - radiusY, 0)); index--) {
            let lineSize = getLineLengthSharp(data, info, isHorizontal ? index : x, isHorizontal ? y : index, isHorizontal);
            if (lineSize > 0) {
                arr.push({
                    length: lineSize,
                    x: isHorizontal ? index : x,
                    y: isHorizontal ? y : index
                });
            }
        }
    }
    return arr;
}
function isPixelGreen255(data, info, x, y) {
    const idx = (info.width * y + x) * info.channels + 1; // Index for the green channel
    return data[idx] === 255;
}
function getLineLengthSharp(data, info, x, y, isHorizontal) {
    const width = info.width;
    const height = info.height;
    const max = isHorizontal ? height : width;
    let pos = isHorizontal ? y : x;
    if (!isPixelGreen255(data, info, x, y))
        return 0;
    let pixelCount = 1;
    // -
    for (let index = pos - 1; index >= 0 && index < max; index--) {
        let isWhite = isPixelGreen255(data, info, isHorizontal ? x : index, isHorizontal ? index : y);
        if (isWhite) {
            pixelCount++;
        }
        else {
            index = -1;
        }
    }
    // +
    for (let index = pos + 1; index < max; index++) {
        let isWhite = isPixelGreen255(data, info, isHorizontal ? x : index, isHorizontal ? index : y);
        if (isWhite) {
            pixelCount++;
        }
        else {
            index = max;
        }
    }
    return pixelCount;
}
async function getFrameSharp(data, info, cursorX, cursorY, toolFolder, isMac) {
    const width = info.width;
    const height = info.height;
    cursorX = Math.floor(cursorX);
    cursorY = Math.floor(cursorY);
    const searchSpace = calculateXYRange(width, height, cursorX, cursorY, 0.1);
    // Process images
    let t = Date.now();
    //Values
    let greenTreshold = isMac ? 80 : 40;
    let greenMult = isMac ? 2.1 : 2.5;
    await extractGreenAndBinarize(data, info, greenTreshold, greenMult, searchSpace);
    if (logTimes)
        console.log(`extractGreenAndThreshold took ${(Date.now() - t)}ms`);
    t = Date.now();
    // Find frame
    let linesLeft = getLinesArrayWithSearchSpace(data, info, cursorX, cursorY, "left", searchSpace);
    let linesRight = getLinesArrayWithSearchSpace(data, info, cursorX, cursorY, "right", searchSpace);
    let linesTop = getLinesArrayWithSearchSpace(data, info, cursorX, cursorY, "up", searchSpace);
    let linesDown = getLinesArrayWithSearchSpace(data, info, cursorX, cursorY, "down", searchSpace);
    if (logTimes)
        console.log(`getLinesArray (all 4) took ${(Date.now() - t)}ms`);
    if (saveDebugImages && toolFolder) {
        let filePaht = path.join(toolFolder, "vison.jpg");
        try {
            const idx = (info.width * cursorY + cursorX) * info.channels;
            data[idx] = 255;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            await sharp(data, {
                raw: {
                    width: info.width,
                    height: info.height,
                    channels: info.channels
                }
            }).toFile(filePaht);
        }
        catch (error) {
            console.log(error);
        }
    }
    // Sort
    linesLeft.sort((a, b) => b.length - a.length);
    linesRight.sort((a, b) => b.length - a.length);
    linesTop.sort((a, b) => b.length - a.length);
    linesDown.sort((a, b) => b.length - a.length);
    if (linesLeft.length == 0 || linesRight.length == 0 || linesTop.length == 0 || linesDown.length == 0) {
        if (saveDebugImages) {
            console.log("No Frame fround");
            console.log({ cursorX, cursorY });
            console.log({
                linesLeft,
                linesRight,
                linesTop,
                linesDown
            });
        }
        return undefined;
    }
    let rectangle = findRectangle(linesLeft, linesRight, linesTop, linesDown);
    if (saveDebugImages) {
        console.log("rectangle -> " + (rectangle != undefined));
        console.log(rectangle);
    }
    if (!rectangle)
        return undefined;
    return rectangle;
}
function getScreenId(eDisplay, sDisplays) {
    for (let index = 0; index < sDisplays.length; index++) {
        const display = sDisplays[index];
        if (factorRounding(eDisplay.nativeOrigin.x, eDisplay.scaleFactor) == display.left && factorRounding(eDisplay.nativeOrigin.y, eDisplay.scaleFactor) == display.top) {
            return display.id;
        }
    }
    return undefined;
}
function factorRounding(value, factor) {
    return Math.round((value * factor) / 5) * 5;
}
function generateHash(filePath, bitSize) {
    return new Promise((resolve, reject) => {
        imageHash.imageHash(filePath, bitSize, true, (err, hash) => {
            if (err)
                reject(undefined);
            resolve(hash);
        });
    });
}
;
