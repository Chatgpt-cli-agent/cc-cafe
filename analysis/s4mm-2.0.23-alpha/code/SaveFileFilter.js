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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveFileFilter = void 0;
var WorkerQueue_1 = require("./WorkerQueue");
var fs = require('fs');
var path = require('path');
var SaveFileFilter = /** @class */ (function () {
    function SaveFileFilter() {
    }
    SaveFileFilter.clearDatabase = function (knex) {
        return __awaiter(this, void 0, void 0, function () {
            var time;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!knex)
                            throw new Error("knex is required");
                        time = Date.now();
                        return [4 /*yield*/, knex('SaveScan').delete()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, knex('SaveFiles').delete()];
                    case 2:
                        _a.sent();
                        console.log("Clear SaveScan table in " + (Date.now() - time) + " ms");
                        return [2 /*return*/];
                }
            });
        });
    };
    SaveFileFilter.scanSaveFiles = function (saveFiles, workers, knex) {
        return __awaiter(this, void 0, void 0, function () {
            var tasks, rawResults, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tasks = [];
                        saveFiles.forEach(function (saveFile) {
                            var task = {
                                action: "scan-and-insert-save-file",
                                data: {
                                    saveFile: saveFile
                                }
                            };
                            tasks.push(task);
                        });
                        return [4 /*yield*/, this.runWorkerQueue(workers, tasks)];
                    case 1:
                        rawResults = _a.sent();
                        results = [];
                        rawResults.forEach(function (rawResult) {
                            if (rawResult.data) {
                                results.push(rawResult.data);
                            }
                            else {
                                var saveGame = undefined;
                                try {
                                    saveGame = rawResult.task.data.saveFile;
                                    results.push({
                                        success: false,
                                        error: "No data in result",
                                        mainIno: saveGame.mainIno,
                                        mainCTime: saveGame.mainCTime,
                                        inoTimeKey: saveGame.inoTimeKey
                                    });
                                }
                                catch (error) {
                                    console.log("Error getting saveGame from rawResult");
                                }
                            }
                        });
                        return [2 /*return*/, results];
                }
            });
        });
    };
    SaveFileFilter.runWorkerQueue = function (workers, tasks) {
        return new Promise(function (resolve, reject) {
            try {
                new WorkerQueue_1.WorkerQueue(workers, Date.now(), tasks, function (progress) {
                    // Handle progress updates here if needed
                    // eventSender(event, channel, { "value": (progress.index + 1), "max": progress.max, "title": translate.get("MAIN.TITLE.I24", "Reading files..."), "close": false });
                }, function (results) {
                    // Resolve the promise with the results
                    resolve(results);
                });
            }
            catch (error) {
                // Reject the promise if there is an error
                reject(error);
            }
        });
    };
    SaveFileFilter.calulateInstanceInoMapping = function (knex) {
        return __awaiter(this, void 0, void 0, function () {
            var sel, data, items, current, index, ino, row, hh, sim;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sel = ["SaveScan.sim_name", "SaveScan.household_name", "SaveScan.played", "SaveScan.save_file_name", "SaveScan.save_file_ino", "SaveScan.instance", "Entries.ino", "SaveScan.slot"];
                        return [4 /*yield*/, knex.from("SaveScan").select(sel).join("Entries", "SaveScan.instance", "Entries.instance").orderBy("Entries.ino", "asc")];
                    case 1:
                        data = _a.sent();
                        items = [];
                        current = {};
                        for (index = 0; index <= data.length; index++) {
                            ino = index < data.length ? data[index].ino : undefined;
                            if (current.ino !== ino) {
                                if (index != 0) {
                                    if (current.saveFilesInoSet)
                                        current.saveFilesInos = Array.from(current.saveFilesInoSet);
                                    delete current.saveFilesInoSet;
                                    items.push(current);
                                }
                                current = {
                                    ino: ino,
                                    hhMap: new Map(),
                                    saveFilesInoSet: new Set()
                                };
                            }
                            if (index < data.length) {
                                row = data[index];
                                current.saveFilesInoSet.add(row.save_file_ino);
                                hh = current.hhMap.get(row.household_name + "_" + row.save_file_ino);
                                if (!hh)
                                    hh = {
                                        name: row.household_name,
                                        simsMap: new Map(),
                                        saveFileIno: row.save_file_ino
                                    };
                                sim = hh.simsMap.get(row.sim_name);
                                if (!sim)
                                    sim = {
                                        name: row.sim_name,
                                        instancesSet: new Set()
                                    };
                                //Add instance
                                sim.instancesSet.add(row.instance);
                                hh.simsMap.set(row.sim_name, sim);
                                current.hhMap.set(row.household_name, hh);
                            }
                        }
                        items.forEach(function (item) {
                            var hh = Array.from(item.hhMap.values());
                            delete item.hhMap;
                            hh.forEach(function (household) {
                                var sims = Array.from(household.simsMap.values());
                                delete household.simsMap;
                                sims.forEach(function (sim) {
                                    sim.instances = Array.from(sim.instancesSet);
                                    delete sim.instancesSet;
                                });
                                household.sims = sims;
                            });
                            item.households = hh;
                        });
                        return [2 /*return*/, items];
                }
            });
        });
    };
    SaveFileFilter.updateOrInsertSaveFiles = function (saveFiles, knex) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        });
    };
    //Save Files
    SaveFileFilter.addAndUpdateChoosenSaveFiles = function (saveFiles, knex) {
        return __awaiter(this, void 0, void 0, function () {
            var slotsSet, slots, deleteQuery, insertQuery;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        slotsSet = new Set();
                        saveFiles.forEach(function (saveFile) {
                            slotsSet.add(saveFile.slot);
                        });
                        slots = Array.from(slotsSet);
                        deleteQuery = knex.from("SaveFiles").whereNotIn("slot", slots).delete();
                        if (!(slots.length > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, deleteQuery];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, knex.from("SaveFiles").delete()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        //Prepare SaveFiles
                        saveFiles.forEach(function (saveFile) {
                            delete saveFile.files;
                            delete saveFile.missing;
                            delete saveFile.changed;
                            delete saveFile.notloaded;
                        });
                        insertQuery = knex("SaveFiles").insert(saveFiles).onConflict("slot").merge();
                        if (!(saveFiles.length > 0)) return [3 /*break*/, 6];
                        return [4 /*yield*/, insertQuery];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [4 /*yield*/, this.getChoosenSaveFiles(knex)];
                    case 7: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SaveFileFilter.getChoosenSaveFiles = function (knex) {
        return __awaiter(this, void 0, void 0, function () {
            var saveFiles;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, knex.from("SaveFiles").select("*")];
                    case 1:
                        saveFiles = _a.sent();
                        //Process saveFiles
                        saveFiles.forEach(function (saveFile) {
                            var mainFile = saveFile.mainFile;
                            var missing = false;
                            var changed = false;
                            var notloaded = saveFile.scanCTime != saveFile.mainCTime;
                            if (fs.existsSync(mainFile)) {
                                var stats = fs.statSync(mainFile);
                                missing = false;
                                changed = (stats.ctimeMs != saveFile.mainCTime) || (stats.ino != saveFile.mainIno);
                                /*if(changed){
                                    console.log({
                                        ino:{
                                            old:saveFile.mainIno,
                                            new:stats.ino
                                        },
                                        cTime:{
                                            old:saveFile.mainCTime,
                                            new:stats.ctimeMs
                                        }
                                    })
                                }*/
                            }
                            else {
                                missing = true;
                                changed = false;
                            }
                            if (saveFile.thumbnail && !fs.existsSync(saveFile.thumbnail)) {
                                saveFile.thumbnail = undefined;
                            }
                            saveFile.missing = missing;
                            saveFile.changed = changed;
                            saveFile.notloaded = notloaded;
                        });
                        return [2 /*return*/, saveFiles];
                }
            });
        });
    };
    SaveFileFilter.checkAndUpdateSaveDatabases = function (workers, knex) {
        return __awaiter(this, void 0, void 0, function () {
            var saveFiles;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, knex.from("SaveFiles").select("*")];
                    case 1:
                        saveFiles = _a.sent();
                        if (saveFiles.length == 0) {
                            console.log("No save files in database");
                            return [2 /*return*/];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    SaveFileFilter.checkAndExpandSaveFile = function (saveFile) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        });
    };
    SaveFileFilter.clearOldAndLoadNew = function (knex, workers) {
        return __awaiter(this, void 0, void 0, function () {
            var saveFiles, loadedSaveGameSlots, toLoadSaveGames, deleteQuery, results, index, result, slot, scanCTime, updateQuery, mapping;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getChoosenSaveFiles(knex)];
                    case 1:
                        saveFiles = _a.sent();
                        if (!(saveFiles.length == 0)) return [3 /*break*/, 3];
                        console.log("No save files in database");
                        return [4 /*yield*/, knex('SaveScan').delete()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                    case 3:
                        loadedSaveGameSlots = new Set();
                        toLoadSaveGames = [];
                        saveFiles.forEach(function (saveFile) {
                            if (saveFile.notloaded || saveFile.changed) {
                                toLoadSaveGames.push(saveFile);
                            }
                            else {
                                loadedSaveGameSlots.add(saveFile.slot);
                            }
                        });
                        deleteQuery = knex('SaveScan').whereNotIn("slot", Array.from(loadedSaveGameSlots)).delete();
                        return [4 /*yield*/, deleteQuery];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this.scanSaveFiles(toLoadSaveGames, workers, knex)];
                    case 5:
                        results = _a.sent();
                        index = 0;
                        _a.label = 6;
                    case 6:
                        if (!(index < results.length)) return [3 /*break*/, 9];
                        result = results[index];
                        if (!(result.success && result.slot != undefined && result.scanCTime)) return [3 /*break*/, 8];
                        slot = result.slot;
                        scanCTime = result.scanCTime;
                        updateQuery = knex('SaveFiles').where("slot", slot).update({ scanCTime: scanCTime, mainCTime: scanCTime, mainIno: result.newIno });
                        //console.log("Result: "+JSON.stringify(result));
                        return [4 /*yield*/, updateQuery];
                    case 7:
                        //console.log("Result: "+JSON.stringify(result));
                        _a.sent();
                        _a.label = 8;
                    case 8:
                        index++;
                        return [3 /*break*/, 6];
                    case 9: return [4 /*yield*/, this.calulateInstanceInoMapping(knex)];
                    case 10:
                        mapping = _a.sent();
                        return [4 /*yield*/, this.getChoosenSaveFiles(knex)];
                    case 11:
                        //Refresh saves
                        saveFiles = _a.sent();
                        //console.log(saveFiles);
                        return [2 /*return*/, {
                                mapping: mapping,
                                saveFiles: saveFiles,
                                time: Date.now()
                            }];
                }
            });
        });
    };
    return SaveFileFilter;
}());
exports.SaveFileFilter = SaveFileFilter;
