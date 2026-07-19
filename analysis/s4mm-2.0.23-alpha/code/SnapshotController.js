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
exports.SnapshotController = void 0;
var electron_1 = require("electron");
var fs = require('fs');
var fsExtra = require('fs-extra');
var path = require('path');
var SnapshotController = /** @class */ (function () {
    function SnapshotController(folder, knex) {
        this.folder = folder;
        this.knex = knex;
    }
    SnapshotController.prototype.getSnapshots = function () {
        var snapshots = [];
        if (!fs.existsSync(this.folder))
            return snapshots;
        var files = fs.readdirSync(this.folder);
        for (var index = 0; index < files.length; index++) {
            var element = files[index];
            if (!element.endsWith("_info.json"))
                continue;
            var data = this.readJson(path.join(this.folder, element));
            var id = Number(element.replace("_info.json", ""));
            if (data) {
                data["id"] = id;
                snapshots.push(data);
            }
        }
        return snapshots;
    };
    SnapshotController.prototype.readJson = function (jsonFile) {
        try {
            var strData = fs.readFileSync(jsonFile);
            var jsonObj = JSON.parse(strData);
            return jsonObj;
        }
        catch (error) {
        }
        return undefined;
    };
    SnapshotController.prototype.deleteSnapshot = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var infoFile, dataFile, error_1, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        infoFile = path.join(this.folder, id + "_info.json");
                        dataFile = path.join(this.folder, id + "_data.json");
                        if (!fs.existsSync(infoFile)) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, electron_1.shell.trashItem(infoFile)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.log(error_1);
                        return [3 /*break*/, 4];
                    case 4:
                        if (!fs.existsSync(dataFile)) return [3 /*break*/, 8];
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, electron_1.shell.trashItem(dataFile)];
                    case 6:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        error_2 = _a.sent();
                        console.log(error_2);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    SnapshotController.prototype.getSnapshot = function (id) {
        var infoFile = path.join(this.folder, id + "_info.json");
        var dataFile = path.join(this.folder, id + "_data.json");
        var snapshot = {
            info: undefined,
            data: undefined,
            infoFile: infoFile,
            dataFile: dataFile
        };
        if (fs.existsSync(infoFile)) {
            snapshot.info = this.readJson(infoFile);
        }
        if (fs.existsSync(dataFile)) {
            snapshot.data = this.readJson(dataFile);
        }
        return snapshot;
    };
    SnapshotController.prototype.overrideJsonFile = function (file, data) {
        fs.writeFileSync(file, JSON.stringify(data));
    };
    SnapshotController.prototype.saveSnapshot = function (name, createdBy, modFolder, dateOverride) {
        return __awaiter(this, void 0, void 0, function () {
            var date, infoFile, dataFile, info, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        date = Date.now();
                        if (dateOverride)
                            date = dateOverride;
                        infoFile = path.join(this.folder, date + "_info.json");
                        dataFile = path.join(this.folder, date + "_data.json");
                        info = {
                            name: name,
                            createdBy: createdBy,
                            date: date,
                            size: 0
                        };
                        return [4 /*yield*/, this.getCurrentSnapshotData(modFolder)];
                    case 1:
                        data = _a.sent();
                        fs.writeFileSync(dataFile, JSON.stringify(data));
                        if (fs.existsSync(dataFile)) {
                            info.size = fs.statSync(dataFile).size;
                        }
                        fs.writeFileSync(infoFile, JSON.stringify(info));
                        return [2 /*return*/, date];
                }
            });
        });
    };
    SnapshotController.prototype.getCurrentSnapshotData = function (modFolder) {
        return __awaiter(this, void 0, void 0, function () {
            var rawData, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.knex.from("Files").select(["ino", "path", "name", "clear_name"]).where("indownloads", null)];
                    case 1:
                        rawData = _a.sent();
                        data = [];
                        rawData.forEach(function (element) {
                            var obj = {
                                ino: element.ino,
                                name: element.clear_name,
                                path: element.path.substring(modFolder.length),
                                isActive: !element.name.toLowerCase().endsWith("off")
                            };
                            data.push(obj);
                        });
                        return [2 /*return*/, data];
                }
            });
        });
    };
    SnapshotController.prototype.compareToCurrent = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var time, rawData, inoMap, nameMap, f_change, f_gone, f_new, index, element, obj_1, newFileName, dirName, ext, requestedName, obj_2, timeNeeded, obj;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        time = Date.now();
                        return [4 /*yield*/, this.knex.from("Files").select(["ino", "path", "name", "clear_name"]).where("indownloads", null)];
                    case 1:
                        rawData = _a.sent();
                        inoMap = new Map();
                        nameMap = new Map();
                        rawData.forEach(function (element) {
                            var obj = {
                                ino: element.ino,
                                name: element.clear_name,
                                filepath: path.join(element.path, element.name),
                                isActive: !element.name.toLowerCase().endsWith("off")
                            };
                            inoMap.set(element.ino, obj);
                            nameMap.set(element.clear_name, obj);
                        });
                        rawData = undefined;
                        f_change = [];
                        f_gone = [];
                        f_new = [];
                        //Change and Gone
                        for (index = data.length - 1; index >= 0; index--) {
                            element = data[index];
                            //ino
                            if (inoMap.has(element.ino)) {
                                obj_1 = inoMap.get(element.ino);
                                if (obj_1.isActive == element.isActive) {
                                    //No change
                                }
                                else {
                                    newFileName = path.basename(obj_1.filepath, path.extname(obj_1.filepath));
                                    dirName = path.dirname(obj_1.filepath);
                                    ext = path.extname(obj_1.name);
                                    requestedName = "";
                                    if (obj_1.isActive) {
                                        //File should be off
                                        requestedName = newFileName + ext + "OFF";
                                    }
                                    else {
                                        //File should be on
                                        requestedName = newFileName + ext;
                                    }
                                    obj_1.requestedName = requestedName;
                                    obj_1.requestedPath = path.join(dirName, requestedName);
                                    f_change.push(obj_1);
                                }
                                inoMap.delete(element.ino);
                            }
                            else if (nameMap.has(element.name)) {
                                obj_2 = nameMap.get(element.name);
                                if (obj_2.isActive == element.isActive) {
                                    //No change
                                }
                                else {
                                    //Change
                                    f_change.push(obj_2);
                                }
                                inoMap.delete(element.ino);
                            }
                            else {
                                //Deleted
                                f_gone.push(element);
                            }
                        }
                        //New
                        f_new = Array.from(inoMap.values());
                        timeNeeded = Date.now() - time;
                        obj = {
                            f_change: f_change,
                            f_gone: f_gone,
                            f_new: f_new
                        };
                        return [2 /*return*/, obj];
                }
            });
        });
    };
    SnapshotController.prototype.handleSnapshotRequest = function (request, event) {
        return __awaiter(this, void 0, void 0, function () {
            function errorClose() {
                //Send error Msg
                console.log("Error: Close!");
                event.sender.send(request.channel, { action: "load-result", error: true });
                return;
            }
            var snapshot, compareData, mode, returnObj, updates, index, element, fOld, fNew, index, element, dirName, oldFileName, newFileName, oldFilePath, newFilePath;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!request || !request.id || request.mode == undefined || !request.channel) {
                            errorClose();
                            return [2 /*return*/];
                        }
                        snapshot = this.getSnapshot(request.id);
                        if (!snapshot || !snapshot.data) {
                            errorClose();
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.compareToCurrent(snapshot.data)];
                    case 1:
                        compareData = _a.sent();
                        mode = request.mode;
                        returnObj = {
                            mode: mode,
                            compareData: compareData,
                            action: "load-result",
                            error: false
                        };
                        updates = [];
                        //Change based on Snap
                        if (mode > 0 && compareData.f_change) {
                            for (index = 0; index < compareData.f_change.length; index++) {
                                element = compareData.f_change[index];
                                fOld = element.filepath;
                                fNew = element.requestedPath;
                                if (!fOld || !fNew || !fs.existsSync(fOld) || fs.existsSync(fNew)) {
                                    console.log("Failed");
                                    console.log(element);
                                    console.log({
                                        fOld: fOld,
                                        fNew: fNew
                                    });
                                    continue;
                                }
                                fs.renameSync(fOld, fNew);
                                if (!fs.existsSync(fNew)) {
                                    console.log("Failed to Rename", element);
                                    continue;
                                }
                                updates.push({
                                    ino: element.ino,
                                    data: {
                                        name: element.requestedName
                                    }
                                });
                            }
                        }
                        //Change New based on Modef_new
                        if (mode > 1 && compareData.f_new) {
                            for (index = 0; index < compareData.f_new.length; index++) {
                                element = compareData.f_new[index];
                                if ((element.isActive && mode == 2) || (!element.isActive && mode == 3))
                                    continue;
                                dirName = path.dirname(element.filepath);
                                oldFileName = path.basename(element.filepath);
                                newFileName = mode == 2 ? oldFileName.substring(0, oldFileName.length - 3) : (oldFileName + "OFF");
                                oldFilePath = element.filepath;
                                newFilePath = path.join(dirName, newFileName);
                                if (!fs.existsSync(oldFilePath) || fs.existsSync(newFilePath)) {
                                    console.log("Failed", element);
                                    continue;
                                }
                                fs.renameSync(oldFilePath, newFilePath);
                                if (!fs.existsSync(newFilePath)) {
                                    console.log("Failed", element);
                                    continue;
                                }
                                updates.push({
                                    ino: element.ino,
                                    data: {
                                        name: newFileName
                                    }
                                });
                            }
                        }
                        if (!(updates.length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.knex.transaction(function (trx) {
                                var queries = [];
                                updates.forEach(function (file) {
                                    var query = _this.knex.from('Files')
                                        .where("ino", file.ino)
                                        .update(file.data)
                                        .transacting(trx);
                                    queries.push(query);
                                });
                                Promise.all(queries)
                                    .then(trx.commit)
                                    .catch(trx.rollback);
                            })];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        //console.log(returnObj);
                        event.sender.send(request.channel, returnObj);
                        return [2 /*return*/];
                }
            });
        });
    };
    return SnapshotController;
}());
exports.SnapshotController = SnapshotController;
/*
export class Snapshot{

    //Info
    name:string = "";
    date:number = 0;
    createdBy = 0; //0-User 1-Mod Manager

    //Files
    files: any[] = [];
    
}
*/ 
