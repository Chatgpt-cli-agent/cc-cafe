"use strict";
var __awaiter = (this && this.__awaiter) || function(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function(resolve) { resolve(value); }); }
    return new(P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }

        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }

        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] },
        f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;

    function verb(n) { return function(v) { return step([n, v]); }; }

    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return { value: op[1], done: false };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [0];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1];
                        t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2];
                        _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e];
            y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FFObject = void 0;
var fs = require('fs');
var fsExtra = require('fs-extra');
var path = require('path');
var Fuse = require('fuse.js');
var FFObject = /** @class */ (function() {
    function FFObject(id, snapshotController, modFolder, knex, channel, sender) {
        //Base
        this.id = 0;
        this.modFolder = "";
        this.knex = undefined;
        this.channel = "";
        this.sender = undefined;
        //Data
        this.items = [];
        this.nameGroups = [];
        this.folderNameMap = new Map();
        this.folderItems = [];
        this.fileGroups = [];
        //Extra
        this.goodTypes = new Set([
            "ac16fbec",
            "015a1849",
            "3453cf95",
            "ba856c78",
            "034aeecb",
            "00b2d882",
            "3c1af1f2",
            "220557da",
            "3c2a8647",
            "81ca1a10",
            "d382bf57",
            "03b4c61d",
            "01661233",
            "01d10f34",
            "319e4f1d",
            "c0db5ae7",
            "8eaf13de",
            "d3044521",
            "01d0e75d",
            "f1edbd86",
            "07576a17",
            "d5f0f921",
            "16ca6bc4",
            "b0118c15",
            "6bf15bbe",
            "2bc04edf",
            "b4f762c9",
            "3f0c529a",
            "7fb6ad8a",
            "b61de6b4",
            "1d6df1cf",
            "76bcf80c",
            "02019972"
        ]);
        this.id = id;
        this.snapshotController = snapshotController;
        this.knex = knex;
        this.modFolder = modFolder;
        this.channel = channel;
        this.sender = sender;
    }
    FFObject.prototype.sendError = function(err_msg) {
        if (!this.sender)
            return;
        console.log("[FFA] Error: ", err_msg);
        this.sender.send(this.channel, { error: true, error_msg: err_msg });
    };
    FFObject.prototype.sendData = function(data) {
        console.log("[FFA]  Send data: ", data);
        if (!this.sender)
            return;
        this.sender.send(this.channel, data);
    };
    FFObject.prototype.sendItemState = function() {
        if (!this.sender)
            return;
        /*this.sender.send(this.channel,{
            type:"item-state",
            unknown:this.items.length,
        });*/
    };
    FFObject.prototype.handleTask = function(task) {
        if (!task || task.taskId == undefined || task.id == undefined) {
            this.sendError("No/Incomplete Task!");
            return;
        }
        switch (task.taskId) {
            case 1:
                this.t_CreateSnapshot(task);
                break;
            case 2:
                this.t_GetDataFromDb(task);
                break;
            case 10:
                this.t_NoMods(task);
                break;
            default:
                this.sendError("Task was not definded!");
        }
    };
    FFObject.prototype.handleFileResult = function(result) {
        if (!result || result.gameStarted != true)
            return;
        this.items.forEach(function(element) {
            if (element.isActive && element.shouldBeActive)
                element.knownGood = true;
        });
    };
    //Tasks
    FFObject.prototype.t_CreateSnapshot = function(task) {
        return __awaiter(this, void 0, void 0, function() {
            var dateStr, sName, rId;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        dateStr = new Date(this.id).toDateString();
                        sName = "50/50 Assistant - " + dateStr;
                        return [4 /*yield*/ , this.snapshotController.saveSnapshot(sName, 1, this.modFolder, this.id)];
                    case 1:
                        rId = _a.sent();
                        if (rId != this.id) {
                            this.sendError("Failed to create Snapshot");
                            return [2 /*return*/ ];
                        }
                        this.sendData({
                            finished: true,
                            id: task.id,
                            taskId: task.taskId
                        });
                        return [2 /*return*/ ];
                }
            });
        });
    };
    FFObject.prototype.t_GetDataFromDb = function(task) {
        return __awaiter(this, void 0, void 0, function() {
            var startTime, uiEntries, setInoUI, _a, index, cfIdGroups, cfIds, fuseOptions, fuse, durationTime;
            var _this = this;
            return __generator(this, function(_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        //Clear
                        this.items = [];
                        this.nameGroups = [];
                        return [4 /*yield*/ , this.knex.select("ino").from("Entries").where("type", 1659684250)];
                    case 1:
                        uiEntries = _b.sent();
                        setInoUI = new Set();
                        uiEntries.forEach(function(element) { setInoUI.add(element.ino); });
                        //Get Base Files
                        _a = this;
                        return [4 /*yield*/ , this.knex.select(["id", "ino", "path", "name", "cobj", "casp", "mtime", "ressourcen", "mtime", "cf_id"]).from("Files").whereLike("name", "%.package").orWhereLike("name", "%.ts4script").orderBy("cf_id")];
                    case 2:
                        //Get Base Files
                        _a.items = _b.sent();
                        index = 0;
                        cfIdGroups = new Map();
                        this.items.forEach(function(element) {
                            element.sName = path.parse(element.name).name;
                            if (element.cf_id != undefined && element.cf_id > 0) {
                                var cfId = element.cf_id;
                                var cfGroup = cfIdGroups.get(cfId);
                                if (!cfGroup) {
                                    cfGroup = {
                                        type: "cf-project-id",
                                        groupInfo: {
                                            cf_id: cfId
                                        },
                                        itemsIndexes: []
                                    };
                                }
                                cfGroup.itemsIndexes.push(index);
                                cfIdGroups.set(cfId, cfGroup);
                            }
                            index++;
                        });
                        cfIds = Array.from(cfIdGroups.values());
                        cfIds.forEach(function(element) {
                            if (!element.itemsIndexes || element.itemsIndexes.length < 2)
                                return;
                            _this.fileGroups.push(element);
                            var fileGroupIndex = _this.fileGroups.length - 1;
                            for (var index_1 = 0; index_1 < element.itemsIndexes.length; index_1++) {
                                var itemIndex = element.itemsIndexes[index_1];
                                _this.items[itemIndex].fileGroupIndex = fileGroupIndex;
                            }
                        });
                        fuseOptions = {
                            isCaseSensitive: false,
                            // includeScore: false,
                            // shouldSort: true,
                            // includeMatches: false,
                            // findAllMatches: false,
                            minMatchCharLength: 4,
                            // location: 0,
                            threshold: 0.35,
                            distance: 20,
                            // useExtendedSearch: false,
                            // ignoreLocation: false,
                            // ignoreFieldNorm: false,
                            // fieldNormWeight: 1,
                            keys: [
                                "sName",
                            ]
                        };
                        fuse = new Fuse(this.items, fuseOptions);
                        //Go over all files
                        index = 0;
                        this.items.forEach(function(element) {
                            //Basic File info
                            element.isUI = setInoUI.has(element.ino);
                            element.sName = path.parse(element.name).name;
                            element.isActive = true;
                            element.shouldBeActive = true;
                            element.knownGood = false;
                            element.knownBad = false;
                            element.isScript = path.extname(element.name).toLowerCase() == ".ts4script";
                            element.isSimple = false;
                            //element.fileGroupIndex = undefined;
                            if (!element.isScript)
                                element.isSimple = _this.isSimple(element);
                            delete element.ressourcen;
                            //Sort into folder items
                            var folderItem = undefined;
                            var folderItemIndex = _this.folderNameMap.get(element.path);
                            if (folderItemIndex != undefined) {
                                folderItem = _this.folderItems[folderItemIndex];
                            } else {
                                folderItem = {
                                    path: element.path,
                                    hasScripts: false,
                                    files: [],
                                    tRecent: undefined,
                                    tOldest: undefined,
                                    allGood: false,
                                    isVirtuel: false
                                };
                                _this.folderItems.push(folderItem);
                                folderItemIndex = _this.folderItems.length - 1;
                                _this.folderNameMap.set(element.path, folderItemIndex);
                            }
                            if (folderItem) {
                                folderItem.files.push(index);
                                if (element.mtime) {
                                    var mtime = element.mtime;
                                    if (!folderItem.tRecent || folderItem.tRecent < mtime)
                                        folderItem.tRecent = mtime;
                                    if (!folderItem.tOldest || folderItem.tOldest > mtime)
                                        folderItem.tOldest = mtime;
                                }
                                if (element.isScript)
                                    folderItem.hasScripts = true;
                                _this.folderItems[folderItemIndex] = folderItem;
                            }
                            element.folderIndex = folderItemIndex;
                            //Script mod file groups
                            if (element.isScript && element.fileGroupIndex == undefined) {
                                /*console.log({
                                    info:"Needs fuse",
                                    element:element
                                })*/
                                _this.fuseGroup(fuse, element.sName, element);
                            }
                            index++;
                        });
                        //Check if virtual folders are needed
                        this.coverageAndVirtualFolders();
                        durationTime = Date.now() - startTime;
                        console.log("t_GetDataFromDb took " + durationTime + "ms to execute");
                        fs.writeFileSync("/Users/Fabian/Desktop/tmp.json", JSON.stringify(this.folderItems));
                        this.sendData({
                            finished: true,
                            id: task.id,
                            taskId: task.taskId
                        });
                        this.sendItemState();
                        return [2 /*return*/ ];
                }
            });
        });
    };
    FFObject.prototype.coverageAndVirtualFolders = function() {
        var allItemsCount = this.items.length;
        var vFolderMinCoverage = 20;
        var vFolderMaxFiles = Math.ceil((allItemsCount / 100) * vFolderMinCoverage);
        if (vFolderMaxFiles < 30)
            vFolderMaxFiles = 30;
        for (var index = 0; index < this.folderItems.length; index++) {
            var element = this.folderItems[index];
            var coverage = (element.files.length / allItemsCount) * 100;
            element.coverage = coverage;
            if (coverage < vFolderMinCoverage || element.files.length < vFolderMaxFiles)
                continue;
            this.splitFolder(element, vFolderMaxFiles, index);
        }
        /*this.folderItems.forEach((element:any) => {
            //Check how big the folder is compared to the total file count
            element.coverage = (element.files.length/allItemsCount)*100;

            //ToDO: Create "virtual" folder if coverage is over threshold (over 20% and over 30 Files)
            //Aber noch nicht sicher wie?
            if(element.coverage>=vFolderMinCoverage && element.files.length>=vFolderMaxFiles && element.is){
                //Folder needs to be split
                console.log("Needs to be split",element);
            }
        });*/
    };
    FFObject.prototype.splitFolder = function(folderItem, limit, folderItemIndex) {
        //Currently only stupid split ToDo
        console.log("Needs to be split", folderItem);
        var files = folderItem.files;
        folderItem.files = [];
        folderItem.isVirtuel = true;
        folderItem.hasScripts = false;
        folderItem.tRecent = undefined;
        folderItem.tOldest = undefined;
        var newItemIndex = this.folderItems.length;
        var newItem = {
            path: folderItem.path,
            hasScripts: false,
            files: [],
            tRecent: undefined,
            tOldest: undefined,
            allGood: false,
            isVirtuel: true
        };
        this.folderItems.push(newItem);
        //Split Files 
        //This is a stupid way and will likly leed to issues! ToDo
        var remainingFiles = [];
        var otherFiles = [];
        //THIS IS NOT OPTIMAL
        remainingFiles = files.splice(0, limit);
        otherFiles = files;
        this.addFilesToFolderItem(remainingFiles, folderItem, folderItemIndex);
        this.addFilesToFolderItem(otherFiles, newItem, newItemIndex);
    };
    FFObject.prototype.addFilesToFolderItem = function(files, folderItem, folderItemIndex) {
        var _this = this;
        //Need to add Items
        files.forEach(function(elementIndex) {
            folderItem.files.push(elementIndex);
            var element = _this.items[elementIndex];
            if (element.mtime) {
                var mtime = element.mtime;
                if (!folderItem.tRecent || folderItem.tRecent < mtime)
                    folderItem.tRecent = mtime;
                if (!folderItem.tOldest || folderItem.tOldest > mtime)
                    folderItem.tOldest = mtime;
            }
            if (element.isScript)
                folderItem.hasScripts = true;
        });
        if (folderItemIndex < this.folderItems.length) {
            var coverage = (folderItem.files.length / this.items.length) * 100;
            folderItem.coverage = coverage;
            this.folderItems[folderItemIndex] = folderItem;
        }
    };
    FFObject.prototype.isSimple = function(element) {
        var ressourcen = element.ressourcen.split(":");
        for (var index = 0; index < ressourcen.length; index++) {
            var rType = ressourcen[index].split("-")[0];
            if (!this.goodTypes.has(rType)) {
                return false;
            }
        }
        return true;
    };
    FFObject.prototype.fuseGroup = function(fuse, sName, item) {
        var results = fuse.search(sName);
        var fuseGroup = {
            type: "fuse-name",
            groupInfo: {
                name: sName
            },
            itemsIndexes: results.map(function(el) { return el.refIndex; }),
            /*allNames : results.map((el:any)=>el.item.name) //Only Tmp*/
        };
        this.fileGroups.push(fuseGroup);
        var fileGroupIndex = this.fileGroups.length - 1;
        for (var index = 0; index < fuseGroup.itemsIndexes.length; index++) {
            var itemIndex = fuseGroup.itemsIndexes[index];
            this.items[itemIndex].fileGroupIndex = fileGroupIndex;
        }
        //console.log(fuseGroup);
    };
    FFObject.prototype.t_NoMods = function(task) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        this.items.forEach(function(element) {
                            if (element.isActive)
                                element.shouldBeActive = false;
                        });
                        return [4 /*yield*/ , this.loadModFolderConfig()];
                    case 1:
                        _a.sent();
                        this.sendData({
                            finished: true,
                            id: task.id,
                            taskId: task.taskId
                        });
                        return [2 /*return*/ ];
                }
            });
        });
    };
    FFObject.prototype.loadModFolderConfig = function() {
        return __awaiter(this, void 0, void 0, function() {
            var updates, error, index, element, re, chunkSize, totalUpdates, i, chunk, error_1;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        updates = [];
                        error = false;
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < this.items.length)) return [3 /*break*/ , 4];
                        element = this.items[index];
                        if (element.shouldBeActive == element.isActive)
                            return [3 /*break*/ , 3];
                        return [4 /*yield*/ , this.changeWithoutUpdate(element)];
                    case 2:
                        re = _a.sent();
                        if (re.error == false && re.update) {
                            updates.push(re.update);
                        } else {
                            error = true;
                        }
                        _a.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/ , 1];
                    case 4:
                        chunkSize = 1000;
                        totalUpdates = updates.length;
                        i = 0;
                        _a.label = 5;
                    case 5:
                        if (!(i < totalUpdates)) return [3 /*break*/ , 10];
                        chunk = updates.slice(i, i + chunkSize);
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        return [4 /*yield*/ , this.updatePathBatch(chunk)];
                    case 7:
                        _a.sent();
                        return [3 /*break*/ , 9];
                    case 8:
                        error_1 = _a.sent();
                        console.log(error_1);
                        error_1 = true;
                        return [3 /*break*/ , 9];
                    case 9:
                        i += chunkSize;
                        return [3 /*break*/ , 5];
                    case 10:
                        return [2 /*return*/ ];
                }
            });
        });
    };
    FFObject.prototype.updatePathBatch = function(updates) {
        var _this = this;
        return this.knex.transaction(function(trx) {
            var queries = [];
            updates.forEach(function(update) {
                var query = _this.knex.from('Files')
                    .where('id', update.id)
                    .update(update.data)
                    .transacting(trx);
                queries.push(query);
            });
            Promise.all(queries)
                .then(trx.commit)
                .catch(trx.rollback);
        });
    };
    FFObject.prototype.changeWithoutUpdate = function(item) {
        var result = {
            error: true,
            update: undefined
        };
        var dirPath = item.path;
        var filename = item.sName;
        var exName = path.extname(item.name);
        var nExName = exName.toLowerCase().startsWith(".package") ? ".package" : ".ts4script";
        if (item.shouldBeActive == false)
            nExName += "OFF";
        var op = path.join(dirPath, item.name);
        var np = path.join(dirPath, filename + nExName);
        var ope = fs.existsSync(op);
        var npe = fs.existsSync(np);
        if (!ope && !npe) {
            console.log("No File/Db not uptpdate");
            result.err_msg = "No File/Db not uptpdate";
            return result;
        } else if (npe) {
            result.error = false;
            item.isActive = item.shouldBeActive;
            return result;
        }
        try {
            fs.renameSync(op, np);
        } catch (err) {
            result.error = true;
            result.err_msg = err;
            return result;
        }
        item.name = filename + nExName;
        item.isActive = item.shouldBeActive;
        var update = {
            id: item.id,
            data: {
                name: item.name
            }
        };
        result.error = false;
        result.update = update;
        return result;
    };
    return FFObject;
}());
exports.FFObject = FFObject;