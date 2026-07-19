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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
exports.__esModule = true;
exports.GameOptions = void 0;
var path = require('path');
var fs = require('fs');
var readline = require('readline');
var GameOptions = /** @class */ (function () {
    function GameOptions() {
    }
    GameOptions.readOptions = function (optionsFilePath) {
        var e_1, _a;
        return __awaiter(this, void 0, void 0, function () {
            var options, fileStream, rl, rl_1, rl_1_1, line, arr, key, value, e_1_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        //No Files
                        if (!fs.existsSync(optionsFilePath)) {
                            return [2 /*return*/, undefined];
                        }
                        options = {};
                        fileStream = fs.createReadStream(optionsFilePath);
                        rl = readline.createInterface({
                            input: fileStream,
                            crlfDelay: Infinity
                        });
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, 7, 12]);
                        rl_1 = __asyncValues(rl);
                        _b.label = 2;
                    case 2: return [4 /*yield*/, rl_1.next()];
                    case 3:
                        if (!(rl_1_1 = _b.sent(), !rl_1_1.done)) return [3 /*break*/, 5];
                        line = rl_1_1.value;
                        //console.log(`Line from file: ${line}`);
                        if (line && line.includes("=")) {
                            arr = line.split("=");
                            key = arr[0].trim();
                            value = arr[1].trim();
                            if (/^\d+$/.test(value)) {
                                value = Number(value);
                            }
                            options[key] = value;
                        }
                        _b.label = 4;
                    case 4: return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 12];
                    case 6:
                        e_1_1 = _b.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 12];
                    case 7:
                        _b.trys.push([7, , 10, 11]);
                        if (!(rl_1_1 && !rl_1_1.done && (_a = rl_1["return"]))) return [3 /*break*/, 9];
                        return [4 /*yield*/, _a.call(rl_1)];
                    case 8:
                        _b.sent();
                        _b.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 11: return [7 /*endfinally*/];
                    case 12: return [2 /*return*/, options];
                }
            });
        });
    };
    GameOptions.getOptionsFile = function (gameFolderDocuments) {
        //No Folder
        if (!gameFolderDocuments || !fs.existsSync(gameFolderDocuments)) {
            return undefined;
        }
        var file = path.join(gameFolderDocuments, "Options.ini");
        //No File
        if (fs.existsSync(file)) {
            return file;
        }
        return undefined;
    };
    GameOptions.getOptionsInfo = function (gameFolderDocuments) {
        return __awaiter(this, void 0, void 0, function () {
            var error, file, options, error_msg_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        error = {
                            error: "File not found!",
                            error_code: 1
                        };
                        file = this.getOptionsFile(gameFolderDocuments);
                        console.log(file);
                        if (!file)
                            return [2 /*return*/, error];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.readOptions(file)];
                    case 2:
                        options = _a.sent();
                        if (!options) {
                            return [2 /*return*/, {
                                    error: "File not found!",
                                    error_code: 1
                                }];
                        }
                        return [2 /*return*/, options];
                    case 3:
                        error_msg_1 = _a.sent();
                        return [2 /*return*/, {
                                error: error_msg_1,
                                error_code: 2
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GameOptions.writeOptions = function (gameFolderDocuments, keyValuePair) {
        var e_2, _a;
        return __awaiter(this, void 0, void 0, function () {
            var file, fileStream, rl, data, rl_2, rl_2_1, line, isKey, arr, key, e_2_1, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        file = this.getOptionsFile(gameFolderDocuments);
                        if (!file)
                            return [2 /*return*/, false];
                        if (!keyValuePair || !keyValuePair.key || keyValuePair.value == undefined)
                            return [2 /*return*/, false];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 14, , 15]);
                        fileStream = fs.createReadStream(file);
                        rl = readline.createInterface({
                            input: fileStream,
                            crlfDelay: Infinity
                        });
                        data = "";
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 7, 8, 13]);
                        rl_2 = __asyncValues(rl);
                        _b.label = 3;
                    case 3: return [4 /*yield*/, rl_2.next()];
                    case 4:
                        if (!(rl_2_1 = _b.sent(), !rl_2_1.done)) return [3 /*break*/, 6];
                        line = rl_2_1.value;
                        isKey = false;
                        if (line && line.includes("=")) {
                            arr = line.split("=");
                            key = arr[0].trim();
                            if (key == keyValuePair.key) {
                                isKey = true;
                                data += key + " = " + keyValuePair.value + "\r\n";
                            }
                        }
                        if (!isKey) {
                            data += line + "\r\n";
                        }
                        _b.label = 5;
                    case 5: return [3 /*break*/, 3];
                    case 6: return [3 /*break*/, 13];
                    case 7:
                        e_2_1 = _b.sent();
                        e_2 = { error: e_2_1 };
                        return [3 /*break*/, 13];
                    case 8:
                        _b.trys.push([8, , 11, 12]);
                        if (!(rl_2_1 && !rl_2_1.done && (_a = rl_2["return"]))) return [3 /*break*/, 10];
                        return [4 /*yield*/, _a.call(rl_2)];
                    case 9:
                        _b.sent();
                        _b.label = 10;
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        if (e_2) throw e_2.error;
                        return [7 /*endfinally*/];
                    case 12: return [7 /*endfinally*/];
                    case 13:
                        fs.writeFileSync(file, data);
                        return [3 /*break*/, 15];
                    case 14:
                        error_1 = _b.sent();
                        console.log(error_1);
                        return [2 /*return*/, false];
                    case 15: return [2 /*return*/, true];
                }
            });
        });
    };
    return GameOptions;
}());
exports.GameOptions = GameOptions;
