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
exports.MassThumbnails = void 0;
var electron_1 = require("electron");
var fs = require('fs');
var path = require('path');
var WorkerQueue = require('./WorkerQueue.js').WorkerQueue;
var MassThumbnails = /** @class */ (function () {
    function MassThumbnails(knex, thumbnailFolder, translate) {
        this.workers = [];
        this.knex = knex;
        this.thumbnailFolder = thumbnailFolder;
        this.translate = translate;
        this.createTableIfNeeded();
        this.setupIpc();
    }
    MassThumbnails.prototype.setupIpc = function () {
        var _this = this;
        electron_1.ipcMain.on("MassThumbnails", function (event, data) {
            if (data.action == "export-for-screenshot") {
                _this.exportWithLoading(data.files, data.channel, event, data.returnInfo, data.s4documents, data.options);
            }
            else if (data.action == "reload-all-thumbnails" && data.channel) {
                _this.reloadAllThubnails(data.channel, event);
            }
        });
        electron_1.ipcMain.handle("MassThumbnails", function (event, data) { return __awaiter(_this, void 0, void 0, function () {
            var result, error_1, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = undefined;
                        if (!(data.action == "get-screenshot-relevant-files")) return [3 /*break*/, 5];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.getRelevantFilesForScreenshotTool()];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_1 = _a.sent();
                        throw new Error("Failed");
                    case 4: return [3 /*break*/, 9];
                    case 5:
                        if (!(data.action = "reset-thumbnails-db")) return [3 /*break*/, 9];
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.knex.from('Thumbnails').truncate()];
                    case 7:
                        _a.sent();
                        return [2 /*return*/, { sucsess: true }];
                    case 8:
                        error_2 = _a.sent();
                        throw new Error("Failed");
                    case 9: throw new Error("No action");
                }
            });
        }); });
    };
    MassThumbnails.prototype.setWorkers = function (workers) {
        this.workers = workers;
    };
    MassThumbnails.prototype.checkTabel = function (cols, table) {
        return __awaiter(this, void 0, void 0, function () {
            var index, element, hasCol;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < cols.length)) return [3 /*break*/, 5];
                        element = cols[index];
                        return [4 /*yield*/, this.knex.schema.hasColumn(table, element)];
                    case 2:
                        hasCol = _a.sent();
                        if (!!hasCol) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.knex.schema.dropTableIfExists(table)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, false];
                    case 4:
                        index++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/, true];
                }
            });
        });
    };
    MassThumbnails.prototype.createTableIfNeeded = function () {
        return __awaiter(this, void 0, void 0, function () {
            var has_thumbnails, cols, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("[DATABASE] Check Thumbnails");
                        return [4 /*yield*/, this.knex.schema.hasTable('Thumbnails')];
                    case 1:
                        has_thumbnails = _b.sent();
                        cols = ["iik", "ino", "type", "instance", "hash", "image"];
                        _a = !has_thumbnails;
                        if (_a) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.checkTabel(cols, "Thumbnails")];
                    case 2:
                        _a = !(_b.sent());
                        _b.label = 3;
                    case 3:
                        if (!_a) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.knex.schema.createTable("Thumbnails", function (table) {
                                table.increments();
                                table.text('iik').unique().notNullable();
                                table.integer("ino").notNullable();
                                table.integer("type");
                                table.text("instance");
                                table.text("hash");
                                table.text("image");
                                table.foreign("ino").references("Files.ino");
                            })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    MassThumbnails.prototype.getRelevantFilesForScreenshotTool = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.knex.from('Files')
                            .join(this.knex.from('Entries')
                            .leftJoin('Thumbnails', 'Entries.instance', 'Thumbnails.instance')
                            .distinct('Entries.ino')
                            .where(function (qb) {
                            qb.where('Entries.type', 1008398834); // CAS
                            //qb.orWhere('Entries.type',1009419847); //COBJ
                        })
                            .whereNull('Thumbnails.instance')
                            .as('filteredEntries'), 'Files.ino', 'filteredEntries.ino')
                            .select(["Files.id", "Files.path", "Files.name", "Files.ino"])];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MassThumbnails.prototype.exportWithLoading = function (files, loadingChannel, event, returnInfo, s4documents, options) {
        return __awaiter(this, void 0, void 0, function () {
            var tasks, index, element, cacheFile, task, workerQ;
            var _this = this;
            return __generator(this, function (_a) {
                delete options.overlayOn;
                delete options.hotkeys;
                delete options.timeLogs;
                delete options.saveScreenshot;
                delete options.saveProcessed;
                tasks = [];
                for (index = 0; index < files.length; index++) {
                    element = files[index];
                    tasks.push({
                        action: "exportAllThumbnails",
                        data: {
                            item: element,
                            folder: this.thumbnailFolder,
                            isCache: false,
                            needHash: true,
                            options: options
                        }
                    });
                }
                if (s4documents && s4documents.length > 0) {
                    cacheFile = path.join(s4documents, "localthumbcache.package");
                    if (fs.existsSync(cacheFile)) {
                        task = {
                            action: "exportAllThumbnails",
                            data: {
                                item: {
                                    name: "localthumbcache.package",
                                    path: s4documents,
                                    ino: 0
                                },
                                folder: this.thumbnailFolder,
                                isCache: true,
                                needHash: true,
                                options: options
                            }
                        };
                        tasks.push(task);
                    }
                }
                workerQ = new WorkerQueue(this.workers, Date.now(), tasks, function (progress) {
                    event.sender.send(loadingChannel, { value: (progress.index + 1), max: progress.max, title: _this.translate.get("GENERAL.EXPORTTHUM", "Exporting thumbnails"), close: false });
                }, function (results) {
                    event.sender.send(loadingChannel, { close: true });
                    console.log("Export Done");
                    _this.saveExportResultsToDatabase(results, event, returnInfo);
                });
                return [2 /*return*/];
            });
        });
    };
    MassThumbnails.prototype.saveExportResultsToDatabase = function (files, event, returnInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var itemsMap, index, r, u, element, key, items;
            return __generator(this, function (_a) {
                itemsMap = new Map();
                for (index = 0; index < files.length; index++) {
                    r = files[index];
                    if (!r.data || !r.data)
                        continue;
                    for (u = 0; u < r.data.length; u++) {
                        element = r.data[u];
                        if (element.db) {
                            key = element.db.ino + "-" + element.db.instance;
                            element.db.iik = key;
                            itemsMap.set(key, element.db);
                        }
                    }
                }
                items = Array.from(itemsMap.values());
                this.insertThumbnails(this.knex, items, 500)
                    .then(function () {
                    if (returnInfo) {
                        event.sender.send(returnInfo.channel, {
                            action: returnInfo.action
                        });
                    }
                })["catch"](function (error) {
                    console.error('Error inserting data:', error);
                    event.sender.send("toast", {
                        msg: error,
                        duration: 5000
                    });
                });
                return [2 /*return*/];
            });
        });
    };
    MassThumbnails.prototype.reloadAllThubnails = function (loadingChannel, event) {
        return __awaiter(this, void 0, void 0, function () {
            var tasks, files, index, element, error_3, workerQ;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tasks = [];
                        files = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.knex.from("Files").select(["id", "ino", "path", "name", "image", "image_source"])];
                    case 2:
                        files = _a.sent();
                        for (index = 0; index < files.length; index++) {
                            element = files[index];
                            tasks.push({
                                action: "checkAndReloadThumbnail",
                                data: {
                                    item: element
                                }
                            });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.log(error_3);
                        event.sender.send(loadingChannel, { close: true });
                        event.sender.send("toast", { "msg": "FAILED TO COMPLETE ACTION", "duration": 2000 });
                        return [2 /*return*/];
                    case 4:
                        workerQ = new WorkerQueue(this.workers, Date.now(), tasks, function (progress) {
                            event.sender.send(loadingChannel, { value: (progress.index + 1), max: progress.max, title: _this.translate.get("GENERAL.EXPORTTHUM", "Exporting thumbnails"), close: false });
                        }, function (results) { return __awaiter(_this, void 0, void 0, function () {
                            var chunkSize, items, error_4;
                            var _this = this;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        chunkSize = 500;
                                        items = results.filter(function (element) { return (element.data !== undefined); });
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, this.knex.transaction(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                                                var i, chunk, queries;
                                                var _this = this;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            i = 0;
                                                            _a.label = 1;
                                                        case 1:
                                                            if (!(i < items.length)) return [3 /*break*/, 4];
                                                            chunk = items.slice(i, i + chunkSize);
                                                            queries = chunk.map(function (item) {
                                                                return _this.knex.from('Files')
                                                                    .where('id', item.data.id)
                                                                    .update({
                                                                    image: item.data.image,
                                                                    image_source: item.data.image_source
                                                                })
                                                                    .transacting(trx);
                                                            });
                                                            return [4 /*yield*/, Promise.all(queries)];
                                                        case 2:
                                                            _a.sent();
                                                            console.log("Chunk " + i);
                                                            _a.label = 3;
                                                        case 3:
                                                            i += chunkSize;
                                                            return [3 /*break*/, 1];
                                                        case 4: return [2 /*return*/];
                                                    }
                                                });
                                            }); })];
                                    case 2:
                                        _a.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_4 = _a.sent();
                                        console.log(error_4);
                                        event.sender.send("toast", { "msg": "FAILED TO COMPLETE ACTION", "duration": 2000 });
                                        event.sender.send(loadingChannel, { close: true });
                                        return [2 /*return*/];
                                    case 4:
                                        event.sender.send(loadingChannel, { close: true });
                                        console.log("Export Done");
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        return [2 /*return*/];
                }
            });
        });
    };
    /*async getAndExportTesting(){
        let relevantFiles : any[] = await this.knex.from('Files')
          .distinct('Files.id')
          .leftJoin('Entries', 'Files.ino', 'Entries.ino')
          .where((qb:any)=> {
            qb.where('Files.casp', 1).orWhere('Files.cobj', 1);
          })
          .andWhere('Entries.type', 1008398834)
          .whereNotExists((qb:any)=> {
            qb.select('*')
              .from('Thumbnails')
              .whereRaw('Thumbnails.instance = Entries.instance');
          }).select(["Files.id","Files.path","Files.name","Files.ino"]);
        

          if(relevantFiles.length==0){
            console.log("nothing to do here!")
            return;
          }

        let tasks : {action:string,data:any}[] = [];
        for (let index = 0; index < relevantFiles.length; index++) {
            const element = relevantFiles[index];
            tasks.push({
                action:"exportAllThumbnails",
                data:{
                    item:element,
                    folder:this.thumbnailFolder,
                    isCache:false,
                    needHash:true
                }
            })
        }
        let workerQ = new WorkerQueue(this.workers,Date.now(),tasks,(progress:any)=>{
            console.log(progress.index+"/"+progress.max);
        },(results:any)=>{
            console.log("Done")
            //console.log(JSON.stringify(results));
            this.procesImagesList(results)
        });
    }*/
    MassThumbnails.prototype.procesImagesList = function (resultsList) {
        var itemsMap = new Map();
        for (var index = 0; index < resultsList.length; index++) {
            var r = resultsList[index];
            if (!r.data || !r.data)
                continue;
            //if(index==0){
            //console.log(r.data);
            //}
            for (var u = 0; u < r.data.length; u++) {
                var element = r.data[u];
                if (element.db) {
                    var key = element.db.ino + "-" + element.db.instance;
                    element.db.iik = key;
                    itemsMap.set(key, element.db);
                }
            }
        }
        var items = Array.from(itemsMap.values());
        console.log("Items: " + items.length);
        this.insertThumbnails(this.knex, items, 500)
            .then(function () { return console.log('Data inserted successfully'); })["catch"](function (error) { return console.error('Error inserting data:', error); });
    };
    MassThumbnails.prototype.insertThumbnails = function (knex, thumbnails, chunkSize) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, knex.transaction(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                            var i, chunk;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        i = 0;
                                        _a.label = 1;
                                    case 1:
                                        if (!(i < thumbnails.length)) return [3 /*break*/, 4];
                                        chunk = thumbnails.slice(i, i + chunkSize);
                                        return [4 /*yield*/, trx('Thumbnails')
                                                .insert(chunk)
                                                .onConflict('iik')
                                                .merge()];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3:
                                        i += chunkSize;
                                        return [3 /*break*/, 1];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return MassThumbnails;
}());
exports.MassThumbnails = MassThumbnails;
