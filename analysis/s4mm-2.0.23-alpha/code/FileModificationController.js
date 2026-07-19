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
exports.FileModificationController = void 0;
var electron_1 = require("electron");
var PackageOperations_1 = require("./PackageOperations");
var fs = require('fs');
var path = require('path');
var FileModificationController = /** @class */ (function () {
    function FileModificationController(knex, baseFolder, translate) {
        this.IPCADDRESS = "FileModificationController";
        this.knex = knex;
        this.mergeFolder = "";
        this.createFolderIfNeeded(baseFolder);
        this.translate = translate;
        this.setupIpc();
    }
    FileModificationController.prototype.createFolderIfNeeded = function (baseFolder) {
        var toolsFolder = path.join(baseFolder, "tools");
        if (!fs.existsSync(toolsFolder)) {
            fs.mkdirSync(toolsFolder);
        }
        var mergeFolder = path.join(toolsFolder, "tmp-merge");
        if (fs.existsSync(toolsFolder) && !fs.existsSync(mergeFolder)) {
            fs.mkdirSync(mergeFolder);
        }
        if (fs.existsSync(mergeFolder))
            this.mergeFolder = mergeFolder;
    };
    FileModificationController.prototype.setupIpc = function () {
        var _this = this;
        electron_1.ipcMain.on(this.IPCADDRESS, function (event, data) {
            console.log(_this.IPCADDRESS + "_on: ");
            console.log(data);
        });
        electron_1.ipcMain.handle(this.IPCADDRESS, function (event, data) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log(this.IPCADDRESS + "_handle: ");
                        console.log(data);
                        if (!(data.action == "merge-copy-to-external")) return [3 /*break*/, 1];
                        this.copyToFromMerged(data.file, data.destination, data.packages);
                        return [2 /*return*/, { success: true }];
                    case 1:
                        if (!(data.action == "merge-delete-from-file")) return [3 /*break*/, 2];
                        this.deleteFromMerged(data.file, data.packages);
                        return [2 /*return*/, { success: true }];
                    case 2:
                        if (!(data.action == "merge-extract")) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.extract(data.file, data.destination, data.packages, data.shouldDelete, data.ino)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, { extract: true }];
                    case 4: throw new Error("No action");
                }
            });
        }); });
    };
    FileModificationController.prototype.copyToFromMerged = function (file, destination, relevantPackages) {
        return PackageOperations_1.PackageOperations.copyToFromMerged(file, destination, this.mergeFolder, relevantPackages);
    };
    FileModificationController.prototype.deleteFromMerged = function (file, relevantPackages) {
        return PackageOperations_1.PackageOperations.removeFromMerged(file, relevantPackages);
    };
    FileModificationController.prototype.extract = function (file, destination, relevantPackages, shouldDelete, ino) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                PackageOperations_1.PackageOperations.unmergeFile(file, destination, this.mergeFolder, relevantPackages, shouldDelete ? 0 : 1);
                return [2 /*return*/];
            });
        });
    };
    return FileModificationController;
}());
exports.FileModificationController = FileModificationController;
