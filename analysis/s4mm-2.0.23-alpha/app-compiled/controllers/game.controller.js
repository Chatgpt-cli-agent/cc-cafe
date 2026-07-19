"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const WorkerQueue_1 = require("../utils/WorkerQueue");
const IPCExtras_1 = require("../utils/IPCExtras");
const folder_util_1 = require("../utils/folder.util");
class GameController {
    constructor(main) {
        this.KEY_LAST_SCAN_VERSION = "last_scan_version";
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("game", async (event, data) => {
            switch (data.action) {
                case "get-game-version":
                    return this.getInstalledGameVersion();
                default:
                    throw new Error("No valid action or parameters");
            }
        });
        electron_1.ipcMain.handle("game-scan", async (event, data) => {
            switch (data.action) {
                case "scan-game":
                    return await this.scanGame(event, data.loading);
                case "can-scan":
                    return this.canScanGame();
                case "need-scan":
                    return await this.needScanGame();
                case "insert-game-ids":
                    return await this.insertGameIds(data.gameIds);
                case "get-scan-info":
                    return await this.getScanInfo();
                default:
                    throw new Error("No valid action or parameters");
            }
        });
    }
    getInstalledGameVersion() {
        let gameFolderDoucuments = this.mainApp.settings.s_game_documents;
        if (!gameFolderDoucuments || !fs.existsSync(gameFolderDoucuments)) {
            return null;
        }
        let gameVersionFile = path_1.default.join(gameFolderDoucuments, "GameVersion.txt");
        if (!fs.existsSync(gameVersionFile)) {
            return null;
        }
        // Read the game version from the file
        try {
            const version = fs.readFileSync(gameVersionFile, "utf8").trim();
            if (version) {
                //Remove any characters other than 0-9 and .
                const sanitizedVersion = version.replace(/[^0-9.]/g, "").trim();
                return sanitizedVersion || null;
            }
            console.log("Game version found:", version);
            return version || null;
        }
        catch (error) {
            console.error("Error reading game version file:", error);
            return null;
        }
    }
    async getScanInfo() {
        let scannedVersion = await this.mainApp.keyDataController.getKeyValue(this.KEY_LAST_SCAN_VERSION);
        let installedVersion = this.getInstalledGameVersion();
        return {
            scannedVersion,
            installedVersion,
            isCurrent: scannedVersion === installedVersion,
        };
    }
    canScanGame() {
        let gameFolderDocuments = this.mainApp.settings.s_game_documents;
        let gameFolderOrigin = this.mainApp.settings.s_game_orgin;
        if (!gameFolderDocuments || !fs.existsSync(gameFolderDocuments))
            return false;
        if (!gameFolderOrigin || !fs.existsSync(gameFolderOrigin))
            return false;
        let versionFile = path_1.default.join(gameFolderDocuments, "GameVersion.txt");
        if (!fs.existsSync(versionFile))
            return false;
        return true;
    }
    async needScanGame() {
        let gameFolderDocuments = this.mainApp.settings.s_game_documents;
        if (!gameFolderDocuments || !fs.existsSync(gameFolderDocuments))
            return false;
        let versionFile = path_1.default.join(gameFolderDocuments, "GameVersion.txt");
        if (!fs.existsSync(versionFile))
            return false;
        // Read the last scan version from settings
        let lastScanVersion = await this.mainApp.keyDataController.getKeyValue(this.KEY_LAST_SCAN_VERSION);
        if (!lastScanVersion) {
            return true; // No previous scan version, need to scan
        }
        // Read the current game version
        let currentGameVersion = this.getInstalledGameVersion();
        if (!currentGameVersion) {
            return false; // No game version found, no need to scan
        }
        // Compare versions
        return currentGameVersion !== lastScanVersion;
    }
    async scanGame(event, loading) {
        if (!this.canScanGame())
            throw new Error("Cannot scan game, missing game documents or origin folder.");
        let gameFolderOrigin = this.mainApp.settings.s_game_orgin;
        let gameVersion = this.getInstalledGameVersion();
        if (!gameVersion)
            throw new Error("No game version found, cannot scan game.");
        //Get files
        let { files, base } = await folder_util_1.FolderUtil.getFiles(gameFolderOrigin, true);
        files = files.map((file) => {
            return file.sp ? path_1.default.join(base, file.sp, file.name) : path_1.default.join(base, file.name);
        }).filter((filepath) => filepath.toLowerCase().endsWith(".package"));
        if (files.length === 0) {
            console.warn("No files found in the game folder, nothing to scan.");
            return;
        }
        //Clear version
        await this.mainApp.keyDataController.deleteKeyValue(this.KEY_LAST_SCAN_VERSION);
        //Clear all entries from "GameIds" table
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        await knex('GameIds').del();
        await knex('GameFiles').del();
        //Insert game files 
        let insertFiles = files.map((file) => {
            try {
                let inoBigStr = fs.statSync(file, { bigint: true }).ino.toString();
                return {
                    ino: inoBigStr, // Use bigint to avoid precision issues
                    path: file,
                };
            }
            catch (error) {
                return null;
            }
        }).filter((file) => file !== null);
        if (insertFiles.length > 0) {
            await knex.batchInsert("GameFiles", insertFiles, 500);
        }
        //Worker tasks
        let tasks = files.map((file) => {
            return {
                action: "scan-game-file",
                data: {
                    filepath: file
                }
            };
        });
        let workerPromise = new Promise((resolve, reject) => {
            new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {}, async (progress) => {
                //OnProgress
                if (loading) {
                    IPCExtras_1.IPCExtras.send(event, loading, { index: progress.index, max: progress.max, action: "progress" });
                }
            }, async (results) => {
                let totalCount = 0;
                results.forEach((result) => {
                    if (result.data && result.data.count) {
                        totalCount += result.data.count;
                    }
                });
                resolve(totalCount);
            });
        });
        let count = await workerPromise;
        if (count > 0) {
            //Save the current game version to settings
            await this.mainApp.keyDataController.setKeyValue(this.KEY_LAST_SCAN_VERSION, gameVersion);
            console.log("Game scan completed, total files scanned:", count);
        }
        console.log("Game scan completed, total files scanned:", { count, version: gameVersion });
        return {
            count: count,
            saved: count > 0,
            version: gameVersion
        };
    }
    async insertGameIds(gameIds) {
        //console.log("Inserting game IDs:", gameIds);
        if (gameIds.length === 0)
            return;
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        //Batch insert game IDs
        try {
            const batchSize = 500;
            await knex.batchInsert("GameIds", gameIds, batchSize);
        }
        catch (error) {
            console.error("Error inserting game IDs:", error);
            throw error;
        }
    }
}
exports.GameController = GameController;
