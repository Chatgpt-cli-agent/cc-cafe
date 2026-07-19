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
exports.SmallTools = void 0;
var fs = require('fs');
var fsExtra = require('fs-extra');
var path = require('path');
var SmallTools = /** @class */ (function () {
    function SmallTools() {
    }
    SmallTools.emptyFolders = function (folderpath) {
        if (!folderpath || !fs.existsSync(folderpath))
            return undefined;
        var arr = [];
        var whiteList = new Set();
        whiteList.add(".DS_Store".toLowerCase());
        var otherFiles = [];
        this.getHighestEmptyFolder(folderpath, arr, whiteList, otherFiles, true);
        var arrn = [];
        for (var index = 0; index < arr.length; index++) {
            var element = arr[index];
            arrn.push({ path: element.path, hasSubfolders: element.hasSubfolders, name: path.basename(element.path) });
        }
        return {
            folders: arrn,
            otherfiles: otherFiles
        };
    };
    SmallTools.getHighestEmptyFolder = function (folderpath, resultArr, whiteList, otherFiles, isBase) {
        //Count Elements
        var simsFilesCount = 0;
        var otherFilesCount = 0;
        var subSimsFilesCount = 0;
        var subOtherFilesCount = 0;
        var hasSubfolders = false;
        var empty = [];
        var onlyOther = [];
        var files = fs.readdirSync(folderpath);
        for (var index = 0; index < files.length; index++) {
            var filename = files[index];
            var filepath = path.join(folderpath, filename);
            if (this.isSimsFile(filename)) {
                simsFilesCount++;
            }
            else if (this.isFolder(filepath)) {
                //Is Sub Folder
                hasSubfolders = true;
                var folder = this.getHighestEmptyFolder(filepath, resultArr, whiteList, otherFiles);
                subSimsFilesCount += folder.ts;
                subOtherFilesCount += folder.ts;
                if (folder.ts == 0 && folder.to == 0) {
                    empty.push(folder);
                }
            }
            else if (whiteList.has(filename.toLowerCase())) {
                //Nix
            }
            else {
                otherFilesCount++;
                otherFiles.push({
                    filename: filename,
                    filepath: filepath
                });
            }
        }
        var ts = simsFilesCount + subSimsFilesCount;
        var to = otherFilesCount + subOtherFilesCount;
        var obj = {
            path: folderpath,
            sfc: simsFilesCount,
            ofc: otherFilesCount,
            ssfc: subSimsFilesCount,
            sofc: subOtherFilesCount,
            ts: ts,
            to: to,
            hasSubfolders: hasSubfolders
        };
        if ((ts != 0 || to != 0 || isBase) && empty.length > 0) {
            resultArr.push.apply(resultArr, empty);
        }
        return obj;
    };
    SmallTools.getFolderFilesCount = function (folderpath) {
        var whiteList = new Set();
        whiteList.add(".DS_Store".toLowerCase());
        return this.getHighestEmptyFolder(folderpath, [], whiteList, [], false);
    };
    SmallTools.isSimsFile = function (filename) {
        var name = filename.toLowerCase();
        return name.endsWith(".package") || name.endsWith(".packageoff")
            || name.endsWith(".ts4script") || name.endsWith(".ts4scriptoff");
    };
    SmallTools.isFolder = function (filepath) {
        return fs.lstatSync(filepath).isDirectory();
    };
    //AutoSort
    SmallTools.autoSortTool = function (knex, structure, modFolderPath) {
        return __awaiter(this, void 0, void 0, function () {
            var movedFiles, issues, casResult, index, file, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!structure.cas)
                            throw new Error("No known Structure found");
                        console.log("Start AutoSort");
                        movedFiles = 0;
                        issues = [];
                        return [4 /*yield*/, this.createCASFolderstructur(knex, structure.cas, modFolderPath)];
                    case 1:
                        casResult = _a.sent();
                        index = 0;
                        _a.label = 2;
                    case 2:
                        if (!(index < casResult.files.length)) return [3 /*break*/, 7];
                        file = casResult.files[index];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.moveFile(file, knex, modFolderPath)];
                    case 4:
                        _a.sent();
                        if (fs.existsSync(path.join(file.movePath, file.name))) {
                            movedFiles++;
                        }
                        else {
                            issues.push({ file: file, error: "File not moved" });
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        issues.push({ file: file, error: error_1 });
                        return [3 /*break*/, 6];
                    case 6:
                        index++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/, {
                            movedFiles: movedFiles,
                            issues: issues,
                            csCas: casResult.cantSortFiles,
                            fpCas: casResult.folderPairs
                        }];
                }
            });
        });
    };
    SmallTools.autoSortToolUserOverwrite = function (knex, items, modFolderPath) {
        return __awaiter(this, void 0, void 0, function () {
            var movedFiles, issues, index, item, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        movedFiles = 0;
                        issues = [];
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < items.length)) return [3 /*break*/, 11];
                        item = items[index];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 9, , 10]);
                        if (!(item.movePath && item.movePath.length > 0 && (path.join(item.path, item.name) != path.join(item.movePath, item.name)))) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.moveFile(item, knex, modFolderPath, true)];
                    case 3:
                        _a.sent();
                        if (fs.existsSync(path.join(item.movePath, item.name))) {
                            movedFiles++;
                        }
                        else {
                            issues.push({ file: item, error: "File not moved" });
                        }
                        return [3 /*break*/, 8];
                    case 4:
                        if (!(item.autosort != undefined)) return [3 /*break*/, 6];
                        //Set AutoSort 
                        return [4 /*yield*/, knex("Files").where("id", item.id).update({ autosort: item.autosort })];
                    case 5:
                        //Set AutoSort 
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 6: 
                    //Set AutoSort to null
                    return [4 /*yield*/, knex("Files").where("id", item.id).update({ autosort: null })];
                    case 7:
                        //Set AutoSort to null
                        _a.sent();
                        _a.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_2 = _a.sent();
                        issues.push({ file: item, error: error_2 });
                        return [3 /*break*/, 10];
                    case 10:
                        index++;
                        return [3 /*break*/, 1];
                    case 11: return [2 /*return*/, {
                            movedFiles: movedFiles,
                            issues: issues
                        }];
                }
            });
        });
    };
    SmallTools.moveFile = function (file_1, knex_1, modFolderPath_1) {
        return __awaiter(this, arguments, void 0, function (file, knex, modFolderPath, autoSortOverwrite) {
            var oldPath, newPath, mfolder, modFolderLength, parts, data;
            if (autoSortOverwrite === void 0) { autoSortOverwrite = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        oldPath = path.join(file.path, file.name);
                        newPath = path.join(file.movePath, file.name);
                        if (!!fs.existsSync(file.movePath)) return [3 /*break*/, 2];
                        return [4 /*yield*/, fsExtra.ensureDir(file.movePath)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [4 /*yield*/, fsExtra.move(oldPath, newPath, { overwrite: false })];
                    case 3:
                        _a.sent();
                        mfolder = "";
                        modFolderLength = modFolderPath.split(path.sep).length;
                        parts = file.movePath.split(path.sep);
                        if (modFolderLength < parts.length) {
                            mfolder = parts[modFolderLength];
                        }
                        data = { path: file.movePath, mfolder: mfolder };
                        if (autoSortOverwrite)
                            data.autosort = file.autosort == undefined ? null : file.autosort;
                        if (!(fs.existsSync(newPath) && !fs.existsSync(oldPath))) return [3 /*break*/, 5];
                        return [4 /*yield*/, knex("Files").where("id", file.id).update(data)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        if (!autoSortOverwrite) return [3 /*break*/, 7];
                        return [4 /*yield*/, knex("Files").where("id", file.id).update({ autosort: data.autosort })];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    SmallTools.createCASFolderstructur = function (knex, structure, modFolderPath) {
        return __awaiter(this, void 0, void 0, function () {
            var options, req, files, requiredFolderIds, folderPathIDMap, cantSortFiles, folderPairs, _i, _a, key;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        options = {
                            multiBundleToMiddle: true
                        };
                        req = knex.from("Files").select("Files.id", "Files.name", "Files.path", "Files.ino", "Casp.bodyType", "Files.autosort").where("Files.casp", 1).where(function (qb) {
                            qb.whereNot("Files.autosort", "-").orWhereNull("Files.autosort");
                        }).join("Casp", "Files.ino", "Casp.ino");
                        return [4 /*yield*/, req];
                    case 1:
                        files = _b.sent();
                        requiredFolderIds = new Set();
                        folderPathIDMap = new Map();
                        //Create folderMap
                        this.extendFolderMap(folderPathIDMap, path.join(modFolderPath, "CAS"), structure);
                        cantSortFiles = [];
                        //Remove all files with simple body type of undefined and extend file with simple body type
                        files = files.filter(function (file) {
                            var simpleBodyType = undefined;
                            if (file.autosort == null || !file.autosort.startsWith("[")) {
                                simpleBodyType = _this.getSimpleCasBodyType(file.bodyType, options);
                            }
                            else if (file.autosort == "-") {
                                return false;
                            }
                            else {
                                simpleBodyType = file.autosort;
                            }
                            if (simpleBodyType && file.path != folderPathIDMap.get(simpleBodyType)) {
                                file.simpleBodyType = simpleBodyType;
                                file.movePath = folderPathIDMap.get(simpleBodyType);
                                requiredFolderIds.add(simpleBodyType);
                                return file.movePath != undefined && !fs.existsSync(path.join(file.movePath, file.name));
                            }
                            else if (simpleBodyType && file.path == folderPathIDMap.get(simpleBodyType)) {
                                //Nix
                            }
                            else {
                                cantSortFiles.push(file);
                            }
                            return false;
                        });
                        folderPairs = [];
                        for (_i = 0, _a = Array.from(folderPathIDMap.keys()); _i < _a.length; _i++) {
                            key = _a[_i];
                            folderPairs.push({ id: key, path: folderPathIDMap.get(key) });
                        }
                        return [2 /*return*/, { files: files, cantSortFiles: cantSortFiles, folderPairs: folderPairs }];
                }
            });
        });
    };
    SmallTools.extendFolderMap = function (folderMap, folderpath, sub) {
        if (sub.length == 0)
            return;
        for (var index = 0; index < sub.length; index++) {
            var element = sub[index];
            var newFolderPath = path.join(folderpath, element.name);
            folderMap.set(element.type, newFolderPath);
            this.extendFolderMap(folderMap, newFolderPath, element.sub);
        }
    };
    SmallTools.getSimpleCasBodyType = function (bodyType, options) {
        if (!bodyType || bodyType.length < 3)
            return undefined;
        var parts = bodyType.split(":");
        //console.log(parts);
        //New
        if (parts.length == 1)
            return parts[0];
        var tSet = new Set();
        var mSet = new Set();
        var bSet = new Set();
        var specifics = [];
        for (var index = 0; index < parts.length; index++) {
            var element = parts[index];
            var subParts = element.split("-");
            if (subParts.length >= 1)
                tSet.add(subParts[0]);
            if (subParts.length >= 2)
                mSet.add(subParts[1]);
            if (subParts.length >= 3)
                bSet.add(subParts[2]);
            if (subParts.length >= 3) {
                specifics.push(element);
            }
        }
        //If only one type retrun longest
        parts.sort(function (a, b) { return a.length - b.length; });
        if (mSet.size == 1 && tSet.size == 1 && bSet.size == 1) {
            //One specific bottom type
            return parts[parts.length - 1];
        }
        else if (options.multiBundleToMiddle && mSet.size == 1 && tSet.size == 1) {
            //Common middle type
            return tSet.values().next().value + "-" + mSet.values().next().value;
        }
        else if (specifics.length == 1) {
            //Return if only one is specific type
            return specifics[0];
        }
        else {
            //No specific type
            //console.log(parts);
            return undefined;
        }
        /*//OLD
        if(parts.length>2)return undefined;
        if(parts.length==1)return parts[0];
        parts.sort((a,b)=>a.length-b.length);
        return parts[1].includes(parts[0]) ? parts[1] : undefined;*/
    };
    return SmallTools;
}());
exports.SmallTools = SmallTools;
