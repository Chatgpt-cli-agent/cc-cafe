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
exports.GameIdsController = exports.GameFiles = void 0;
var WorkerQueue_1 = require("./WorkerQueue");
var fs = require('fs');
var path = require('path');
var NAMEUTIL = require('./FilenameUtil.js');
var GameFiles = exports.GameFiles = /** @class */ (function () {
    function GameFiles() {
    }
    GameFiles.getGameVersion = function (folder) {
        var file = path.join(folder, "GameVersion.txt");
        var v = "-";
        if (!fs.existsSync(file))
            return v;
        try {
            var data = fs.readFileSync(file, 'utf8').trim();
            v = data.replace(/\0/g, '');
            v = v.replace(/[^0-9.]/g, '');
        }
        catch (err) {
        }
        return v;
    };
    GameFiles.getAllPackages = function (folder) {
        var arr = [];
        this.addAllPackageFiles(arr, folder);
        return arr;
    };
    GameFiles.addAllPackageFiles = function (arr, folder) {
        var _this = this;
        if (!fs.existsSync(folder))
            return;
        var isFolder = fs.lstatSync(folder).isDirectory();
        if (isFolder) {
            var files = fs.readdirSync(folder);
            files.forEach(function (element) {
                var fp = path.join(folder, element);
                _this.addAllPackageFiles(arr, fp);
            });
        }
        else if (NAMEUTIL.isPackageFile(folder) && !folder.includes("Strings")) {
            arr.push(folder);
        }
    };
    GameFiles.saveList = function (doc, game) {
        //Get Game Version
        var version = this.getGameVersion(doc);
        if (version == "-") {
            //Error - No Game Version
            return { "error": "No game version detected!" };
        }
        //Get all Package Files
        var packages = [];
        packages = this.getAllPackages(game);
        if (packages.length < 1) {
            //Error - No Package Files
            return { "error": "No game files found!" };
        }
        return { "version": version, "packages": packages };
    };
    GameFiles.getVersionFromFile = function (file) {
        var v = "-";
        if (!fs.existsSync(file))
            return v;
        try {
            var data = fs.readFileSync(file, 'utf8');
            var json = JSON.parse(data);
            v = json.version;
        }
        catch (error) {
        }
        return v;
    };
    GameFiles.getSet = function (file) {
        var set = new Set();
        if (!fs.existsSync(file))
            return set;
        try {
            var data = fs.readFileSync(file, 'utf8');
            var json = JSON.parse(data);
            var ids = json.ids;
            ids.forEach(function (element) {
                set.add(element);
            });
        }
        catch (error) {
        }
        return set;
    };
    GameFiles.getSets = function (file) {
        var setSmall = new Set();
        var setBig = new Set();
        if (!fs.existsSync(file))
            return [setBig, setSmall];
        var okTypes = new Set();
        okTypes.add("034aeecb"); // Cas
        okTypes.add("0354796a"); // Skin
        okTypes.add("545ac67a"); // Trait
        okTypes.add("545ac67a"); // Aspiration
        okTypes.add("9d1ab874"); // SCPT
        okTypes.add("c5f6763e"); // SMOD
        okTypes.add("319e4f1d"); //Cobj
        okTypes.add("d5f0f921"); //Cwal
        okTypes.add("b4f762c9"); //CFLR
        try {
            var data = fs.readFileSync(file, 'utf8');
            var json = JSON.parse(data);
            var ids = json.ids;
            ids.forEach(function (element) {
                setBig.add(element);
                var arr = element.split("-");
                var value = "0x" + arr[2].toLocaleUpperCase();
                if (okTypes.has(arr[0])) {
                    setSmall.add(value);
                }
            });
        }
        catch (error) {
        }
        return [setBig, setSmall];
    };
    GameFiles.getPlayerActiveColor = function (gameFolderPath) {
        var defFile = this.getDefaultIniFile(gameFolderPath);
        if (!defFile)
            return { error: "No Default.ini file!", error_code: 2 };
        try {
            var fileData = fs.readFileSync(defFile).toString();
            var lines = fileData.split("\n");
            for (var index = 0; index < lines.length; index++) {
                var line = lines[index].trim();
                if (line.startsWith("playeractivecolor")) {
                    var numberPart = line.split("=")[1].split("#")[0].trim();
                    var numbers = numberPart.split(",").map(function (value) {
                        return Number(value.trim());
                    });
                    if (numbers.length != 4)
                        throw new Error("Not a valid color");
                    return {
                        r: numbers[0],
                        g: numbers[1],
                        b: numbers[2],
                        a: numbers[3]
                    };
                }
            }
        }
        catch (error) {
            return { error: "Failed to read Default.ini file!", error_code: 3 };
        }
        return { error: "Failed to read Default.ini file!", error_code: 3 };
    };
    GameFiles.setPlayerActiveColor = function (gameFolderPath, tempFolder, color) {
        return __awaiter(this, void 0, void 0, function () {
            var defFile, fileData, lines, edited, index, line, newLine, newData, newFile, result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        defFile = this.getDefaultIniFile(gameFolderPath);
                        if (!defFile)
                            return [2 /*return*/, { error: "No Default.ini file!", error_code: 2 }];
                        if (!tempFolder || !fs.existsSync(tempFolder))
                            return [2 /*return*/, { error: "No Temp folder", error_code: 0 }];
                        if (!color || color.r == undefined
                            || color.g == undefined || color.b == undefined
                            || color.a == undefined) {
                            return [2 /*return*/, { error: "Invalid Color!", error_code: 4 }];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        fileData = fs.readFileSync(defFile).toString();
                        lines = fileData.split("\n");
                        edited = false;
                        for (index = 0; index < lines.length; index++) {
                            line = lines[index].trim();
                            if (line.startsWith("playeractivecolor")) {
                                newLine = "playeractivecolor = ";
                                newLine = newLine + color.r.toFixed(2) + ", ";
                                newLine = newLine + color.g.toFixed(2) + ", ";
                                newLine = newLine + color.b.toFixed(2) + ", ";
                                newLine = newLine + color.a.toFixed(2) + "   # Modified by Sims 4 Mod Manager (Default values: 0.43, 0.78, 0.12, 1.00)";
                                lines[index] = newLine;
                                index = lines.length;
                                edited = true;
                            }
                        }
                        if (!edited) return [3 /*break*/, 3];
                        newData = lines.join("\n");
                        newFile = path.join(tempFolder, "Default_" + Date.now() + ".ini");
                        fs.writeFileSync(newFile, newData);
                        return [4 /*yield*/, this.copyFileSudo(defFile, newFile)];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, { suc: result, color: color }];
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        return [2 /*return*/, { error: error_1, error_code: 3 }];
                    case 5: return [2 /*return*/, { error: "Failed to save to Default.ini file!", error_code: 4 }];
                }
            });
        });
    };
    GameFiles.getDefaultIniFile = function (gameFolderPath) {
        if (!gameFolderPath)
            return undefined;
        var file = path.join(gameFolderPath, "Game", "Bin", "Default.ini");
        if (fs.existsSync(file))
            return file;
        return undefined;
    };
    GameFiles.copyFileSudo = function (oldFile, newFile) {
        return __awaiter(this, void 0, void 0, function () {
            var ino_nf, sudo, options, command, movePromise, moved, ino_of, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!fs.existsSync(newFile))
                            return [2 /*return*/, false];
                        ino_nf = fs.statSync(newFile).ino;
                        sudo = require('electron-sudo');
                        options = {
                            name: 'Sims 4 Mod Manager'
                        };
                        command = "move /y \"" + newFile + "\" \"" + oldFile + "\"";
                        movePromise = function (c, o) {
                            return new Promise(function (resolve, reject) {
                                sudo.exec(c, o, function (error) {
                                    if (error != null && error != undefined)
                                        reject(error);
                                    resolve(true);
                                });
                            });
                        };
                        moved = false;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, movePromise(command, options)];
                    case 2:
                        _a.sent();
                        if (fs.existsSync(oldFile)) {
                            ino_of = fs.statSync(oldFile).ino;
                            moved = !fs.existsSync(newFile) && ino_nf == ino_of;
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        moved = false;
                        return [3 /*break*/, 4];
                    case 4:
                        if (fs.existsSync(newFile)) {
                            try {
                                fs.unlinkSync(newFile);
                            }
                            catch (error) {
                                console.log(error);
                            }
                        }
                        return [2 /*return*/, moved];
                }
            });
        });
    };
    GameFiles.getInstalledPacks = function (gameFolderPath, isMac) {
        if (!gameFolderPath || !fs.existsSync(gameFolderPath))
            return undefined;
        var folder = gameFolderPath;
        //Mac
        if (isMac) {
            var base = path.join(path.dirname(path.dirname(gameFolderPath)), "The Sims 4 Packs");
            if (!base || !fs.existsSync(base))
                return undefined;
            folder = base;
        }
        var items = fs.readdirSync(folder);
        var packs = [];
        for (var index = 0; index < items.length; index++) {
            var itemname = items[index];
            if (itemname.startsWith("EP") || itemname.startsWith("GP") || itemname.startsWith("SP")) {
                packs.push(itemname);
            }
        }
        return packs;
    };
    GameFiles.loadSmallGameIds = function (knex) {
        return __awaiter(this, void 0, void 0, function () {
            var version, address, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, GameFiles.getCheckedGameVersion(knex)];
                    case 1:
                        version = _a.sent();
                        version = version == "-" ? undefined : version;
                        if (version == undefined) {
                            GameFiles.gameIDs_small = new Set();
                            return [2 /*return*/];
                        }
                        if (GameFiles.gameIds_version == version && GameFiles.gameIDs_small.size > 0) {
                            console.log("GameIds were not reloaded!");
                            return [2 /*return*/];
                        }
                        GameFiles.gameIDs_small = new Set();
                        return [4 /*yield*/, knex.from("GameIds").select("address")];
                    case 2:
                        address = _a.sent();
                        address.forEach(function (element) {
                            GameFiles.gameIDs_small.add(element.address);
                        });
                        GameFiles.gameIds_version = version;
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GameFiles.getGameInfo = function (knex, folderDocuments) {
        return __awaiter(this, void 0, void 0, function () {
            var sv, gv;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, GameFiles.getCheckedGameVersion(knex)];
                    case 1:
                        sv = _a.sent();
                        gv = GameFiles.getGameVersion(folderDocuments);
                        return [2 /*return*/, {
                                gv: gv == "-" ? undefined : gv,
                                sv: sv == "-" ? undefined : sv
                            }];
                }
            });
        });
    };
    GameFiles.sendGameInfo = function (eventSender, event, knex, folderDocuments) {
        return __awaiter(this, void 0, void 0, function () {
            var v, v_c;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        v = "-";
                        v_c = GameFiles.getGameVersion(folderDocuments);
                        return [4 /*yield*/, GameFiles.getCheckedGameVersion(knex)];
                    case 1:
                        v = _a.sent();
                        eventSender(event, "settong-tab-0", {
                            "action": "update-version",
                            "version": v,
                            "current": v == v_c
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    GameFiles.getCheckedGameVersion = function (knex) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, knex.from("Data").where("id", 1)];
                    case 1:
                        data = _a.sent();
                        if (data && data.length > 0) {
                            return [2 /*return*/, data[0].value];
                        }
                        else {
                            return [2 /*return*/, "-"];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    GameFiles.gameIds_version = undefined;
    GameFiles.gameIDs_small = new Set();
    return GameFiles;
}());
var GameIdsController = /** @class */ (function () {
    function GameIdsController(knex) {
        this.workers = [];
        this.knex = knex;
        this.createTableIfNeeded();
    }
    GameIdsController.prototype.checkTabel = function (cols, table) {
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
    GameIdsController.prototype.createTableIfNeeded = function () {
        return __awaiter(this, void 0, void 0, function () {
            var has_gameIds, cols, _a, has_gamefiles, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        console.log("[DATABASE] Check GameIds");
                        return [4 /*yield*/, this.knex.schema.hasTable('GameIds')];
                    case 1:
                        has_gameIds = _c.sent();
                        cols = ["ino", "type", "instance", "group", "address"];
                        _a = !has_gameIds;
                        if (_a) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.checkTabel(cols, "GameIds")];
                    case 2:
                        _a = !(_c.sent());
                        _c.label = 3;
                    case 3:
                        if (!_a) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.knex.schema.createTable("GameIds", function (table) {
                                table.increments();
                                table.integer("ino").notNullable();
                                table.integer("type");
                                table.integer("group");
                                table.text("instance");
                                table.text("address"),
                                    table.foreign("ino").references("GameFiles.ino");
                            })];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5:
                        console.log("[DATABASE] Check GameFiles");
                        return [4 /*yield*/, this.knex.schema.hasTable('GameFiles')];
                    case 6:
                        has_gamefiles = _c.sent();
                        _b = !has_gamefiles;
                        if (_b) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.checkTabel(["ino", "path"], "GameFiles")];
                    case 7:
                        _b = !(_c.sent());
                        _c.label = 8;
                    case 8:
                        if (!_b) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.knex.schema.createTable("GameFiles", function (table) {
                                table.integer("ino").notNullable();
                                table.text("path");
                                table.primary("ino");
                            })];
                    case 9:
                        _c.sent();
                        _c.label = 10;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    GameIdsController.prototype.reloadIds = function (folderDocuments, folderGame, channel, eventSender, translate, event, workers) {
        return __awaiter(this, void 0, void 0, function () {
            var title, obj, tasks, index, packageFile, task, workerQ;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.knex('Data').insert({
                            id: 1,
                            type: "game-version",
                            value: "-"
                        }).onConflict('id').merge()];
                    case 1:
                        _a.sent();
                        GameFiles.gameIDs_small = new Set();
                        GameFiles.sendGameInfo(eventSender, event, this.knex, folderDocuments);
                        title = translate.get("MAIN.TITLE.I15", "Preparing files...");
                        eventSender(event, channel, { "value": 0, "max": 1, "title": title, "close": false });
                        obj = GameFiles.saveList(folderDocuments, folderGame);
                        if (obj.error) {
                            eventSender(event, channel, { "close": true });
                            eventSender(event, "toast", { "msg": obj.error, "duration": 3000 });
                            return [2 /*return*/];
                        }
                        tasks = [];
                        for (index = 0; index < obj.packages.length; index++) {
                            packageFile = obj.packages[index];
                            task = {
                                action: "get-packge-ressources",
                                data: {
                                    path: packageFile
                                }
                            };
                            tasks.push(task);
                        }
                        workerQ = new WorkerQueue_1.WorkerQueue(workers, Date.now(), tasks, function (progress) {
                            eventSender(event, channel, { "value": (progress.index + 1), "max": progress.max, "title": translate.get("MAIN.TITLE.I24", "Reading files..."), "close": false });
                        }, function (results) {
                            //Done
                            //eventSender(event, channel, { "close": true });
                            //console.log("Done!");
                            //console.log(results[0].data);
                            _this.handleReloadDataResult(obj, results, channel, eventSender, translate, event, folderDocuments);
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    GameIdsController.prototype.handleReloadDataResult = function (versionData, result, channel, eventSender, translate, event, folderDocuments) {
        return __awaiter(this, void 0, void 0, function () {
            var gameFiles, title, count, index, index_1, element, batchSize, lastIno, cleanGameFiles, doubleInos, i, element, i, batch, j, element, i, batch, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        gameFiles = [];
                        title = translate.get("MAIN.TITLE.I25", "Saving data...");
                        count = 0;
                        index = 0;
                        eventSender(event, channel, { "value": 0, "max": 1, "title": title, "close": false });
                        for (index_1 = 0; index_1 < result.length; index_1++) {
                            element = result[index_1].data;
                            count += element.ressources.length;
                            gameFiles.push({ ino: element.ino, path: element.path });
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 16, , 17]);
                        return [4 /*yield*/, this.knex.schema.dropTableIfExists('GameIds')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.knex.schema.dropTableIfExists('GameFiles')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.createTableIfNeeded()];
                    case 4:
                        _a.sent();
                        batchSize = 5000;
                        //Check for double inos
                        //Sort by ino
                        gameFiles.sort(function (a, b) {
                            return a.ino - b.ino;
                        });
                        lastIno = -1;
                        cleanGameFiles = [];
                        doubleInos = new Set();
                        for (i = 0; i < gameFiles.length; i++) {
                            element = gameFiles[i];
                            if (element.ino == lastIno) {
                                doubleInos.add(element.ino);
                                console.log("[THIS IS BAD] Double Ino: " + element.ino + " - " + element.path);
                            }
                            else {
                                cleanGameFiles.push(element);
                            }
                            lastIno = element.ino;
                        }
                        if (doubleInos.size > 0) {
                            console.log("[GAME FILES] Double Inos: " + doubleInos.size);
                            eventSender(event, "toast", { "msg": "Error: The Mod Manager encountered issues\nrecognizing and classifying some files, which\nmay limit certain functions. Currently, no\nfix is available.", "duration": 15000 });
                        }
                        i = 0;
                        _a.label = 5;
                    case 5:
                        if (!(i < cleanGameFiles.length)) return [3 /*break*/, 8];
                        batch = cleanGameFiles.slice(i, i + batchSize);
                        //Only DEBUG
                        if (batch.length > 0 && i == 0) {
                            //Print examle
                            console.log("GameFiles Example: " + JSON.stringify(batch[0]));
                            //Print types
                            console.log({
                                ino: typeof batch[0].ino,
                                path: typeof batch[0].path
                            });
                        }
                        return [4 /*yield*/, this.knex.batchInsert("GameFiles", batch, 128)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        i += batchSize;
                        return [3 /*break*/, 5];
                    case 8:
                        j = 0;
                        _a.label = 9;
                    case 9:
                        if (!(j < result.length)) return [3 /*break*/, 14];
                        element = result[j].data;
                        i = 0;
                        _a.label = 10;
                    case 10:
                        if (!(i < element.ressources.length)) return [3 /*break*/, 13];
                        batch = element.ressources.slice(i, i + batchSize);
                        //Only DEBUG
                        if (batch.length > 0 && j == 0 && i == 0) {
                            console.log("GameIds Example: " + JSON.stringify(batch[0]));
                            //Print types
                            console.log({
                                ino: typeof batch[0].ino,
                                type: typeof batch[0].type,
                                group: typeof batch[0].group,
                                instance: typeof batch[0].instance,
                                address: typeof batch[0].address
                            });
                        }
                        return [4 /*yield*/, this.knex.batchInsert("GameIds", batch, 256)];
                    case 11:
                        _a.sent();
                        index += batch.length;
                        eventSender(event, channel, { "value": index, "max": count, "title": title, "close": false });
                        _a.label = 12;
                    case 12:
                        i += batchSize;
                        return [3 /*break*/, 10];
                    case 13:
                        j++;
                        return [3 /*break*/, 9];
                    case 14: 
                    //Insert Game Version
                    return [4 /*yield*/, this.knex('Data').insert({
                            id: 1,
                            type: "game-version",
                            value: versionData.version
                        }).onConflict('id').merge()];
                    case 15:
                        //Insert Game Version
                        _a.sent();
                        GameFiles.sendGameInfo(eventSender, event, this.knex, folderDocuments);
                        console.log('Data cleared and inserted successfully.');
                        return [3 /*break*/, 17];
                    case 16:
                        error_4 = _a.sent();
                        console.error('Error clearing and inserting data:', error_4);
                        return [3 /*break*/, 17];
                    case 17:
                        eventSender(event, channel, { "close": true });
                        return [2 /*return*/];
                }
            });
        });
    };
    return GameIdsController;
}());
exports.GameIdsController = GameIdsController;
