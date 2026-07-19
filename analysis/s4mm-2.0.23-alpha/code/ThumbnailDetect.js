"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.ThumbnailDetect = void 0;
var electron_1 = require("electron");
var processImageBufferWithOptions = require('./SimilarImageProcessing.js').processImageBufferWithOptions;
var imageHash = require('image-hash-local-only');
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var screenshot = require('screenshot-desktop');
var WorkerQueue = require('./WorkerQueue.js').WorkerQueue;
var saveDebugImages = false;
var logTimes = false;
var ThumbnailDetect = /** @class */ (function () {
    function ThumbnailDetect(mainWindow, toolsFolder, knex, thumbnailFolder, ignorSetup) {
        this.ipcChannel = "thumbnail-detect";
        this.isMac = process.platform === "darwin";
        this.workers = [];
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
        this.mainWindow = mainWindow;
        this.knex = knex;
        this.thumbnailFolder = thumbnailFolder;
        this.setupFolders(toolsFolder);
        if (!ignorSetup)
            this.setupOther();
        this.stopTriggerListener();
    }
    ThumbnailDetect.prototype.setWorkers = function (workers) {
        this.workers = workers;
    };
    ThumbnailDetect.prototype.setSwipeServer = function (server) {
        this.swipeServer = server;
    };
    ThumbnailDetect.prototype.setupOther = function () {
        var _this = this;
        electron_1.ipcMain.handle(this.ipcChannel, function (event, data) { return __awaiter(_this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                result = undefined;
                if (data.action == "get-status") {
                    return [2 /*return*/, { status: this.isListening() }];
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
                    return [2 /*return*/, { status: this.isListening() }];
                }
                throw new Error("No action");
            });
        }); });
        electron_1.ipcMain.on(this.ipcChannel + "_on", function (event, data) {
            if (data.action == "match-result") {
                _this.handleMatchResult(data);
            }
            else if (data.action == "update-main-window") {
                _this.sendIpcMessage("screenshot-detect-service", { action: "update-status", isOn: _this.listenerOn });
            }
            else if (data.action == "close-from-overlay") {
                _this.stopTriggerListener();
                _this.updateMainWindowSate();
            }
            else if (data.action == "update-settings") {
                _this.updateSettings(data.settings);
            }
            else if (data.action == "change-status") {
                _this.stateChange(data);
                //return {status:this.isListening()};
            }
            else if (data.action == "list-get") {
                _this.sendListUpdate();
            }
            else if (data.action == "list-clear") {
                _this.itemsMap = new Map();
                _this.sendListUpdate();
            }
            else if (data.action == "list-remove" && data.id != undefined) {
                _this.removeItem(data.id);
            }
            else if (data.action == "list-delete-update" && data.ids != undefined) {
                _this.removeDeletedFiles(data.ids);
            }
        });
    };
    ThumbnailDetect.prototype.sendListUpdate = function () {
        var valuesArray = Array.from(this.itemsMap.values());
        valuesArray.sort(function (a, b) { return a.id - b.id; });
        this.sendIpcMessage("screenshot-detect-service", {
            action: "set-items",
            items: valuesArray
        });
    };
    ThumbnailDetect.prototype.removeItem = function (id) {
        this.itemsMap["delete"](id);
        this.sendIpcMessage("screenshot-detect-service", {
            action: "remove-item",
            id: id
        });
    };
    ThumbnailDetect.prototype.removeDeletedFiles = function (ids) {
        var toDelete = new Set(ids);
        var keys = Array.from(this.itemsMap.keys());
        for (var index = 0; index < keys.length; index++) {
            var key = keys[index];
            var element = this.itemsMap.get(key);
            if (element) {
                if (!element.info)
                    continue;
                if (!element.info.file)
                    continue;
                if (toDelete.has(element.info.file.id)) {
                    element.info.file = undefined;
                }
                for (var u = element.info.otherFiles.length - 1; u >= 0; u--) {
                    var otherFile = element.info.otherFiles[u];
                    if (toDelete.has(otherFile.id)) {
                        element.info.otherFiles.splice(u, 1);
                    }
                }
                if (element.info.file == undefined && element.info.otherFiles.length > 0) {
                    element.info.file = element.info.otherFiles.shift();
                }
                if (element.info.file == undefined) {
                    this.itemsMap["delete"](key);
                }
                else {
                    this.itemsMap.set(key, element);
                }
            }
            else {
                this.itemsMap["delete"](key);
            }
        }
        this.sendListUpdate();
    };
    ThumbnailDetect.prototype.stateChange = function (data) {
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
    };
    ThumbnailDetect.prototype.setupFolders = function (toolsFolder) {
        //Create folders
        var fm = path.join(toolsFolder, "thumbnailDetect");
        var fi = path.join(fm, "thumbnails");
        var fti = path.join(fm, "items");
        if (fs.existsSync(fm) || fs.mkdirSync(fm)) {
            this.folderMain = fm;
        }
        if (fs.existsSync(fm) && (fs.existsSync(fi) || fs.mkdirSync(fi))) {
            this.folderImages = fi;
        }
        if (fs.existsSync(fm) && (fs.existsSync(fti) || fs.mkdirSync(fti))) {
            this.folderItems = fti;
            if (this.folderItems)
                this.cleanItemsFolder(this.folderItems);
        }
    };
    ThumbnailDetect.prototype.cleanItemsFolder = function (folderPath) {
        fs.readdir(folderPath, function (err, files) {
            if (err) {
                console.error('Error reading directory:', err);
                return;
            }
            files.forEach(function (file) {
                if (file.startsWith('item_') && file.endsWith('.png')) {
                    fs.unlink(path.join(folderPath, file), function (err) {
                        if (err) {
                            console.error('Error deleting file:', file, err);
                        }
                    });
                }
            });
        });
    };
    ThumbnailDetect.prototype.updateSettings = function (data) {
        if (!data)
            return;
        var os = this.settings;
        this.settings = data;
        if (data.saveScreenshot != undefined)
            saveDebugImages = data.saveScreenshot;
        if (data.timeLogs != undefined)
            logTimes = data.timeLogs;
        this.updateHotKeys(os, data);
    };
    ThumbnailDetect.prototype.updateHotKeys = function (os, ns) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(os.hotkeys.startStop != ns.hotkeys.startStop)) return [3 /*break*/, 4];
                        if (os.hotkeys.startStop != "" && electron_1.globalShortcut.isRegistered(os.hotkeys.startStop)) {
                            try {
                                electron_1.globalShortcut.unregister(os.hotkeys.startStop);
                            }
                            catch (error) {
                                console.log(error);
                            }
                        }
                        console.log("[SHORTCUTS] Register: " + ns.hotkeys.startStop);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, electron_1.globalShortcut.register(ns.hotkeys.startStop, function () {
                                console.log("Toggle Tool!");
                                if (_this.listenerOn) {
                                    _this.stopTriggerListener();
                                }
                                else {
                                    _this.startTriggerListener();
                                }
                                _this.updateMainWindowSate();
                            })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        //Rest
                        this.sendIpcMessage("screenshot-detect-service", { action: "reset-hotkey" });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ThumbnailDetect.prototype.setHotKey = function (newHotKey, oldHotKey) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (oldHotKey != "" && electron_1.globalShortcut.isRegistered(oldHotKey)) {
                            try {
                                electron_1.globalShortcut.unregister(oldHotKey);
                            }
                            catch (error) {
                                console.log(error);
                            }
                        }
                        console.log("[SHORTCUTS] Register: " + newHotKey);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, electron_1.globalShortcut.register(newHotKey, function () {
                                _this.runScan();
                            })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.log("Failed to register hotkey: " + newHotKey);
                        this.sendIpcMessage("screenshot-detect-service", { action: "handle-error", error: { message: "Failed to bind hotkey! - " + newHotKey } });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ThumbnailDetect.prototype.removeHotKey = function (hotKey) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    electron_1.globalShortcut.unregister(hotKey);
                }
                catch (error) {
                    console.log(error);
                }
                return [2 /*return*/];
            });
        });
    };
    ThumbnailDetect.prototype.updateMainWindowSate = function () {
        this.sendIpcMessage("screenshot-detect-service", { action: "update-state", isOn: this.listenerOn });
    };
    ThumbnailDetect.prototype.isListening = function () {
        return this.listenerOn;
    };
    ThumbnailDetect.prototype.startTriggerListener = function () {
        console.log("startTriggerListener");
        if (this.listenerOn)
            return;
        this.listenerOn = true;
        this.loadThumbnailsHash();
        this.setHotKey(this.settings.hotkeys.trigger, "");
        if (this.overlay == undefined && this.settings.overlayOn && !this.isMac) {
            this.startOverlay();
        }
    };
    ThumbnailDetect.prototype.stopTriggerListener = function () {
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
    };
    ThumbnailDetect.prototype.startOverlay = function () {
        try {
            var window_1 = new electron_1.BrowserWindow({
                width: 340 * 1,
                height: 210 * 1,
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
            window_1.loadFile('./code/ccDetector.html');
            window_1.setMenu(null);
            window_1.setAlwaysOnTop(true, 'pop-up-menu');
            window_1.setVisibleOnAllWorkspaces(true);
            window_1.setFullScreenable(false);
            // Make the window mouse transparent
            //window.setIgnoreMouseEvents(true);
            window_1.on("ready-to-show", function () {
                //window.webContents.openDevTools();
            });
            this.overlay = window_1;
        }
        catch (err) {
            console.log("[ERROR-OVERLAY]: " + err);
        }
    };
    ThumbnailDetect.prototype.runScan = function () {
        return __awaiter(this, void 0, void 0, function () {
            var t, displays, cursorPosition, cursorDisplayData, sDisplays, screenId, image, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        t = Date.now();
                        displays = electron_1.screen.getAllDisplays();
                        cursorPosition = electron_1.screen.getCursorScreenPoint();
                        ;
                        cursorDisplayData = calculateCursorPositionWithScale(cursorPosition, displays);
                        if (!cursorDisplayData)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, screenshot.listDisplays()];
                    case 2:
                        sDisplays = _a.sent();
                        screenId = getScreenId(cursorDisplayData.display.raw, sDisplays);
                        return [4 /*yield*/, screenshot({ format: 'jpg', screen: screenId })];
                    case 3:
                        image = _a.sent();
                        if (logTimes)
                            console.log("Getting Image and cursor data took ".concat((Date.now() - t), "ms"));
                        this.processImage(image, cursorDisplayData, true).then(function (result) {
                            _this.addNewItemToList(result);
                        })["catch"](function (err) {
                            console.log(err);
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _a.sent();
                        console.log(error_3);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    ThumbnailDetect.prototype.handleMatchResult = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var item, info;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("handleMatchResult");
                        console.log(data);
                        item = this.itemsMap.get(data.index);
                        if (!item) {
                            console.log("NO Match found in itemsmap");
                            console.log(data);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.getInfoByThumbnailId(data.result.id)];
                    case 1:
                        info = _a.sent();
                        item.info = info;
                        item.state = 2;
                        if (data.result) {
                            item.distance = data.result.distance;
                            item.hashSize = data.result.hashSize;
                        }
                        this.sendIpcMessage("screenshot-detect-service", { action: "update-item", item: item });
                        if (this.overlay)
                            this.overlay.webContents.send("screenshot-detect-service", { action: "update-item", item: item });
                        return [2 /*return*/];
                }
            });
        });
    };
    ThumbnailDetect.prototype.getInfoByThumbnailId = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var thumbnailItems, mainFile_1, otherFiles, files, otherImage, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, this.knex.from("Thumbnails").where("id", id).select(["id", "ino", "image", "instance"])];
                    case 1:
                        thumbnailItems = _a.sent();
                        if (thumbnailItems.length != 1) {
                            return [2 /*return*/, undefined];
                        }
                        thumbnailItems[0].thumbnailFolder = this.thumbnailFolder;
                        mainFile_1 = undefined;
                        otherFiles = [];
                        if (!(thumbnailItems[0].ino != 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.knex.from("Files").where("ino", thumbnailItems[0].ino).select(["id", "ino", "clear_name", "name", "path", "image", "merged", "recolor", "size", "mtime"])];
                    case 2:
                        files = _a.sent();
                        if (files.length == 1)
                            mainFile_1 = files[0];
                        _a.label = 3;
                    case 3: return [4 /*yield*/, this.knex.from('Entries')
                            .distinct()
                            .select('Files.id', 'Files.ino', 'Files.clear_name', 'Files.name', 'Files.path', 'Files.image', 'Files.merged', 'Files.recolor', 'Files.size', 'Files.mtime')
                            .join('Files', 'Entries.ino', 'Files.ino')
                            .where('Entries.instance', thumbnailItems[0].instance)];
                    case 4:
                        //Get Files by instance
                        otherFiles = _a.sent();
                        if (!mainFile_1 && otherFiles.length > 0) {
                            mainFile_1 = otherFiles.shift();
                        }
                        else if (mainFile_1 && otherFiles.length > 0) {
                            otherFiles = otherFiles.filter(function (item) { return item.id != mainFile_1.id; });
                        }
                        otherImage = undefined;
                        if (thumbnailItems[0]) {
                            otherImage = thumbnailItems[0].thumbnailFolder + "/" + thumbnailItems[0].image;
                        }
                        if (mainFile_1) {
                            return [2 /*return*/, {
                                    thumbnail: thumbnailItems[0],
                                    file: mainFile_1,
                                    otherFiles: otherFiles,
                                    otherImage: otherImage
                                }];
                        }
                        return [2 /*return*/, undefined];
                    case 5:
                        error_4 = _a.sent();
                        console.log(error_4);
                        return [2 /*return*/, undefined];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    ThumbnailDetect.prototype.addNewItemToList = function (obj) {
        this.itemsId++;
        obj.id = this.itemsId;
        if (obj.state != 0)
            this.itemsMap.set(obj.id, obj);
        this.sendIpcMessage("screenshot-detect-service", { action: "new-item", item: obj });
        if (this.overlay)
            this.overlay.webContents.send("screenshot-detect-service", { action: "new-item", item: obj });
        if (obj.state == 1)
            this.findMatchHash(obj);
    };
    ThumbnailDetect.prototype.findMatchHash = function (obj) {
        return __awaiter(this, void 0, void 0, function () {
            var workerId, tt, batchesCount, batchSize, tasks, arr, imageHash, error_5, index, start, end, subMap, workerQ;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        workerId = this.workerIndex;
                        this.workerIndex++;
                        if (this.workerIndex >= this.workers.length)
                            this.workerIndex = 0;
                        if (this.workers.length == 0)
                            return [2 /*return*/];
                        tt = Date.now();
                        batchesCount = this.workers.length;
                        batchSize = Math.ceil(this.hashMap.size / batchesCount);
                        tasks = [];
                        arr = Array.from(this.hashMap);
                        imageHash = undefined;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        if (!obj.imageProcessed) return [3 /*break*/, 3];
                        return [4 /*yield*/, generateHash(obj.imageProcessed, this.settings.hashSize)];
                    case 2:
                        imageHash = _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_5 = _a.sent();
                        console.log(error_5);
                        return [3 /*break*/, 5];
                    case 5:
                        for (index = 0; index < batchesCount; index++) {
                            start = index * batchSize;
                            end = start + batchSize;
                            if (end > this.hashMap.size)
                                end = this.hashMap.size;
                            subMap = new Map(arr.slice(start, end));
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
                            console.log("Prep time was ".concat((Date.now() - tt), "ms"));
                        workerQ = new WorkerQueue(this.workers, Date.now(), tasks, function (progress) {
                            //Nix
                        }, function (results) {
                            if (_this.settings.saveProcessed == false)
                                fs.unlinkSync(obj.imageProcessed);
                            var bestResult = {
                                id: null,
                                distance: Infinity,
                                hashSize: imageHash ? imageHash.length : (_this.settings.hashSize * 4),
                                time: 0
                            };
                            for (var index = 0; index < results.length; index++) {
                                var element = results[index];
                                if (element && element.data && element.data.distance < bestResult.distance) {
                                    bestResult.id = element.data.id;
                                    bestResult.distance = element.data.distance;
                                    bestResult.time = element.data.time;
                                }
                            }
                            if (logTimes)
                                console.log("Match found in ".concat((Date.now() - tt), "ms"));
                            _this.handleMatchResult({ index: obj.id, result: bestResult });
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    ThumbnailDetect.prototype.loadThumbnailsHash = function () {
        var _this = this;
        this.knex.from("Thumbnails").select("hash", "id").then(function (result) {
            for (var index = 0; index < result.length; index++) {
                var element = result[index];
                _this.hashMap.set(element.id, element.hash);
            }
        });
    };
    ThumbnailDetect.prototype.processImage = function (image, cdd, direct) {
        return __awaiter(this, void 0, void 0, function () {
            var id, returnObj, moitorImageBuffer, _a, t, result, imp_item, imp_item_p, itemImageBuffer, procces, error_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        id = this.id;
                        this.id++;
                        returnObj = {
                            id: id,
                            state: 0,
                            error: undefined,
                            image: undefined,
                            imageProcessed: undefined
                        };
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 9, , 10]);
                        if (!(this.isMac || direct)) return [3 /*break*/, 2];
                        _a = image;
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, cropImage(image, cdd.display)];
                    case 3:
                        _a = _b.sent();
                        _b.label = 4;
                    case 4:
                        moitorImageBuffer = _a;
                        t = Date.now();
                        return [4 /*yield*/, this.findGreenBorder(moitorImageBuffer, cdd)];
                    case 5:
                        result = _b.sent();
                        if (logTimes)
                            console.log("findGreenBorder took ".concat((Date.now() - t), "ms"));
                        if (!result) return [3 /*break*/, 8];
                        imp_item = path.join(this.folderItems, "item_" + id + "_" + Date.now() + ".jpeg");
                        imp_item_p = path.join(this.folderItems, "item_" + id + "_" + Date.now() + "_p.jpeg");
                        return [4 /*yield*/, cropImage(moitorImageBuffer, result)];
                    case 6:
                        itemImageBuffer = _b.sent();
                        return [4 /*yield*/, processImageBufferWithOptions(itemImageBuffer, {
                                grayscale: this.settings.imGrayscale,
                                addBlack: this.settings.imTopBox,
                                normalize: this.settings.imNormalize,
                                edgeDetection: this.settings.imEdgeDetect,
                                removeBottom: this.settings.imBottomCut
                            })];
                    case 7:
                        procces = _b.sent();
                        fs.writeFileSync(imp_item, itemImageBuffer);
                        fs.writeFileSync(imp_item_p, procces);
                        returnObj.state = 1;
                        returnObj.image = imp_item;
                        returnObj.imageProcessed = imp_item_p;
                        return [2 /*return*/, returnObj];
                    case 8: return [2 /*return*/, returnObj];
                    case 9:
                        error_6 = _b.sent();
                        console.log(error_6);
                        throw new Error("Invalid image");
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    ThumbnailDetect.prototype.testingWithImage = function (imagePath, x, y) {
        return __awaiter(this, void 0, void 0, function () {
            var imageBuffer, result, imp_item, itemImageBuffer, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        imageBuffer = fs.readFileSync(imagePath);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.findGreenBorder(imageBuffer, { cursor: {
                                    xm: x,
                                    ym: y
                                } })];
                    case 2:
                        result = _a.sent();
                        if (!result) return [3 /*break*/, 4];
                        console.log(result);
                        imp_item = path.join(this.folderMain, "item.png");
                        return [4 /*yield*/, cropImage(imageBuffer, result)];
                    case 3:
                        itemImageBuffer = _a.sent();
                        fs.writeFileSync(imp_item, itemImageBuffer);
                        _a.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_7 = _a.sent();
                        console.log(error_7);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    ThumbnailDetect.prototype.findGreenBorder = function (imageBuf, cdd) {
        return __awaiter(this, void 0, void 0, function () {
            var t, _a, data, info, frame, result, s, error_8;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        t = Date.now();
                        return [4 /*yield*/, sharp(imageBuf).raw().toBuffer({ resolveWithObject: true })];
                    case 1:
                        _a = _b.sent(), data = _a.data, info = _a.info;
                        if (logTimes)
                            console.log("   findGreenBorder-sharp(imageBuf) took ".concat((Date.now() - t), "ms"));
                        t = Date.now();
                        return [4 /*yield*/, getFrameSharp(data, info, cdd.cursor.xm, cdd.cursor.ym, this.folderMain, this.isMac)];
                    case 2:
                        frame = _b.sent();
                        if (logTimes)
                            console.log("   findGreenBorder-getFrame() took ".concat((Date.now() - t), "ms"));
                        if (saveDebugImages)
                            console.log(frame);
                        if (frame) {
                            result = {
                                imageWidth: info.width,
                                imagehHeight: info.height,
                                x: frame.left.x + 1,
                                y: frame.top.y + 1,
                                width: frame.width - 1,
                                height: frame.height - 1
                            };
                            s = scaleRectangle(result, 0.98);
                            return [2 /*return*/, s];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_8 = _b.sent();
                        throw new Error("Error checking pixel colors: ".concat(error_8.message));
                    case 4: return [2 /*return*/, undefined];
                }
            });
        });
    };
    ThumbnailDetect.prototype.sendIpcMessage = function (channel, data) {
        this.mainWindow.webContents.send(channel, data);
        if (this.swipeServer) {
            this.swipeServer.webContents.send("ipc-connect-send", { channel: channel, data: data });
        }
    };
    return ThumbnailDetect;
}());
exports.ThumbnailDetect = ThumbnailDetect;
function cropImage(buffer, options) {
    return __awaiter(this, void 0, void 0, function () {
        var image, metadata, x, y, width, height, croppedImage, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    image = sharp(buffer);
                    return [4 /*yield*/, image.metadata()];
                case 1:
                    metadata = _a.sent();
                    x = options.x, y = options.y, width = options.width, height = options.height;
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
                    return [4 /*yield*/, image
                            .extract({ left: x, top: y, width: width, height: height })
                            .toBuffer()];
                case 2:
                    croppedImage = _a.sent();
                    return [2 /*return*/, croppedImage];
                case 3:
                    error_9 = _a.sent();
                    throw new Error("Error cropping image: ".concat(error_9.message));
                case 4: return [2 /*return*/];
            }
        });
    });
}
function calculateCursorPositionWithScale(cursorPosition, displays) {
    //Find cursorPos in Screen
    var xSmall = 0;
    var ySmall = 0;
    var xP = undefined;
    var yP = undefined;
    var cDisplay = undefined;
    for (var _i = 0, displays_1 = displays; _i < displays_1.length; _i++) {
        var display_1 = displays_1[_i];
        var _a = display_1.bounds, x = _a.x, y = _a.y, width = _a.width, height = _a.height;
        if (x < xSmall)
            xSmall = x;
        if (y < ySmall)
            ySmall = y;
        if (cursorPosition.x >= x && cursorPosition.x < x + width &&
            cursorPosition.y >= y && cursorPosition.y < y + height) {
            var relativeX = cursorPosition.x - x;
            var relativeY = cursorPosition.y - y;
            xP = relativeX;
            yP = relativeY;
            cDisplay = display_1;
        }
    }
    if (!(xP != undefined && yP != undefined && cDisplay)) {
        console.log("Cursor not found");
        return null;
    }
    var cursor = {
        xm: Math.floor(xP * cDisplay.scaleFactor),
        ym: Math.floor(yP * cDisplay.scaleFactor)
    };
    //Fix ScreenScaling
    displays.forEach(function (display) {
        display.newBounds = {
            width: factorRounding(display.bounds.width, display.scaleFactor),
            height: factorRounding(display.bounds.height, display.scaleFactor),
            x: Math.floor(display.nativeOrigin.x * display.scaleFactor),
            y: Math.floor(display.nativeOrigin.y * display.scaleFactor)
        };
    });
    displaysToZeroPosNewBounds(displays);
    //Get Main offset
    var offet = { x: 0, y: 0 };
    displays.forEach(function (display) {
        if (display.bounds.x == 0 && display.bounds.y == 0) {
            offet.x = display.newBounds.x;
            offet.y = display.newBounds.y;
        }
    });
    var display = {
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
    var min = { x: 0, y: 0 };
    var max = { x: 0, y: 0 };
    //Find extrems
    for (var index = 0; index < displays.length; index++) {
        var display = displays[index];
        var bounds = display.newBounds;
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
    var correction = { x: (min.x * -1), y: (min.y * -1) };
    for (var index = 0; index < displays.length; index++) {
        var display = displays[index];
        display.newBounds.x = display.bounds.x + correction.x;
        display.newBounds.y = display.bounds.y + correction.y;
    }
}
function scaleRectangle(rect, multiplier) {
    var newWidth = Math.floor(rect.width * multiplier);
    var newHeight = Math.floor(rect.height * multiplier);
    var deltaX = Math.floor((rect.width - newWidth) / 2);
    var deltaY = Math.floor((rect.height - newHeight) / 2);
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
    var targetAspectRatio = 104 / 148;
    var tolerance = 0.05;
    for (var _i = 0, left_1 = left; _i < left_1.length; _i++) {
        var l = left_1[_i];
        for (var _a = 0, right_1 = right; _a < right_1.length; _a++) {
            var r = right_1[_a];
            for (var _b = 0, top_1 = top; _b < top_1.length; _b++) {
                var t = top_1[_b];
                for (var _c = 0, down_1 = down; _c < down_1.length; _c++) {
                    var d = down_1[_c];
                    var width = r.x - l.x;
                    var height = d.y - t.y;
                    var aspectRatio = width / height;
                    if (Math.abs(aspectRatio - targetAspectRatio) <= tolerance) {
                        return {
                            left: l,
                            right: r,
                            top: t,
                            down: d,
                            width: width,
                            height: height,
                            aspectRatio: aspectRatio
                        };
                    }
                }
            }
        }
    }
    return undefined;
}
function extractGreenAndBinarize(data, info, threshold, greenMult, searchSpace) {
    return __awaiter(this, void 0, void 0, function () {
        var redBlueMult, y, x, idx, red, green, blue, newRed, newGreen, newBlue, brightness, color;
        return __generator(this, function (_a) {
            redBlueMult = -2;
            for (y = searchSpace.yMin; y < searchSpace.yMax; y++) {
                for (x = searchSpace.xMin; x < searchSpace.xMax; x++) {
                    idx = (info.width * y + x) * info.channels;
                    red = data[idx];
                    green = data[idx + 1];
                    blue = data[idx + 2];
                    newRed = redBlueMult * red - greenMult * green + redBlueMult * blue;
                    newGreen = redBlueMult * red + greenMult * green + redBlueMult * blue;
                    newBlue = redBlueMult * red - greenMult * green + redBlueMult * blue;
                    brightness = 0.299 * Math.min(255, Math.max(0, newRed)) + 0.587 * Math.min(255, Math.max(0, newGreen)) + 0.114 * Math.min(255, Math.max(0, newBlue));
                    color = brightness > threshold ? 255 : 0;
                    data[idx + 1] = color; // Green 
                    if (saveDebugImages) {
                        data[idx + 0] = color;
                        data[idx + 2] = color;
                    }
                }
            }
            return [2 /*return*/];
        });
    });
}
function calculateXYRange(width, height, x, y, range) {
    var maxDimension = Math.max(width, height);
    var rangeInPixels = range * maxDimension;
    var xMin = Math.max(0, x - rangeInPixels);
    var xMax = Math.min(width, x + rangeInPixels);
    var yMin = Math.max(0, y - rangeInPixels);
    var yMax = Math.min(height, y + rangeInPixels);
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
    var arr = [];
    var width = info.width;
    var height = info.height;
    var radiusX = Math.floor((searchSpace.xMax - searchSpace.xMin) / 2);
    var radiusY = Math.floor((searchSpace.yMax - searchSpace.yMin) / 2);
    if (direction == "down" || direction == "right") {
        // Plus
        var isHorizontal = direction == "right";
        for (var index = isHorizontal ? x : y; index < (isHorizontal ? Math.min(x + radiusX, width) : Math.min(y + radiusY, height)); index++) {
            var lineSize = getLineLengthSharp(data, info, isHorizontal ? index : x, isHorizontal ? y : index, isHorizontal);
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
        var isHorizontal = direction == "left";
        for (var index = isHorizontal ? x : y; index >= (isHorizontal ? Math.max(x - radiusX, 0) : Math.max(y - radiusY, 0)); index--) {
            var lineSize = getLineLengthSharp(data, info, isHorizontal ? index : x, isHorizontal ? y : index, isHorizontal);
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
    var idx = (info.width * y + x) * info.channels + 1; // Index for the green channel
    return data[idx] === 255;
}
function getLineLengthSharp(data, info, x, y, isHorizontal) {
    var width = info.width;
    var height = info.height;
    var max = isHorizontal ? height : width;
    var pos = isHorizontal ? y : x;
    if (!isPixelGreen255(data, info, x, y))
        return 0;
    var pixelCount = 1;
    // -
    for (var index = pos - 1; index >= 0 && index < max; index--) {
        var isWhite = isPixelGreen255(data, info, isHorizontal ? x : index, isHorizontal ? index : y);
        if (isWhite) {
            pixelCount++;
        }
        else {
            index = -1;
        }
    }
    // +
    for (var index = pos + 1; index < max; index++) {
        var isWhite = isPixelGreen255(data, info, isHorizontal ? x : index, isHorizontal ? index : y);
        if (isWhite) {
            pixelCount++;
        }
        else {
            index = max;
        }
    }
    return pixelCount;
}
function getFrameSharp(data, info, cursorX, cursorY, toolFolder, isMac) {
    return __awaiter(this, void 0, void 0, function () {
        var width, height, searchSpace, t, greenTreshold, greenMult, linesLeft, linesRight, linesTop, linesDown, filePaht, idx, error_10, rectangle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    width = info.width;
                    height = info.height;
                    cursorX = Math.floor(cursorX);
                    cursorY = Math.floor(cursorY);
                    searchSpace = calculateXYRange(width, height, cursorX, cursorY, 0.1);
                    t = Date.now();
                    greenTreshold = isMac ? 80 : 40;
                    greenMult = isMac ? 2.1 : 2.5;
                    return [4 /*yield*/, extractGreenAndBinarize(data, info, greenTreshold, greenMult, searchSpace)];
                case 1:
                    _a.sent();
                    if (logTimes)
                        console.log("extractGreenAndThreshold took ".concat((Date.now() - t), "ms"));
                    t = Date.now();
                    linesLeft = getLinesArrayWithSearchSpace(data, info, cursorX, cursorY, "left", searchSpace);
                    linesRight = getLinesArrayWithSearchSpace(data, info, cursorX, cursorY, "right", searchSpace);
                    linesTop = getLinesArrayWithSearchSpace(data, info, cursorX, cursorY, "up", searchSpace);
                    linesDown = getLinesArrayWithSearchSpace(data, info, cursorX, cursorY, "down", searchSpace);
                    if (logTimes)
                        console.log("getLinesArray (all 4) took ".concat((Date.now() - t), "ms"));
                    if (!(saveDebugImages && toolFolder)) return [3 /*break*/, 5];
                    filePaht = path.join(toolFolder, "vison.jpg");
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    idx = (info.width * cursorY + cursorX) * info.channels;
                    data[idx] = 255;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    return [4 /*yield*/, sharp(data, {
                            raw: {
                                width: info.width,
                                height: info.height,
                                channels: info.channels
                            }
                        }).toFile(filePaht)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_10 = _a.sent();
                    console.log(error_10);
                    return [3 /*break*/, 5];
                case 5:
                    // Sort
                    linesLeft.sort(function (a, b) { return b.length - a.length; });
                    linesRight.sort(function (a, b) { return b.length - a.length; });
                    linesTop.sort(function (a, b) { return b.length - a.length; });
                    linesDown.sort(function (a, b) { return b.length - a.length; });
                    if (linesLeft.length == 0 || linesRight.length == 0 || linesTop.length == 0 || linesDown.length == 0) {
                        if (saveDebugImages) {
                            console.log("No Frame fround");
                            console.log({ cursorX: cursorX, cursorY: cursorY });
                            console.log({
                                linesLeft: linesLeft,
                                linesRight: linesRight,
                                linesTop: linesTop,
                                linesDown: linesDown
                            });
                        }
                        return [2 /*return*/, undefined];
                    }
                    rectangle = findRectangle(linesLeft, linesRight, linesTop, linesDown);
                    if (saveDebugImages) {
                        console.log("rectangle -> " + (rectangle != undefined));
                        console.log(rectangle);
                    }
                    if (!rectangle)
                        return [2 /*return*/, undefined];
                    return [2 /*return*/, rectangle];
            }
        });
    });
}
function getScreenId(eDisplay, sDisplays) {
    for (var index = 0; index < sDisplays.length; index++) {
        var display = sDisplays[index];
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
    return new Promise(function (resolve, reject) {
        imageHash.imageHash(filePath, bitSize, true, function (err, hash) {
            if (err)
                reject(undefined);
            resolve(hash);
        });
    });
}
;
