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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStateController = void 0;
const electron_1 = require("electron");
const IPCExtras_1 = require("../utils/IPCExtras");
const fs = __importStar(require("fs"));
const GameFiles_1 = require("../utils/GameFiles");
class GameStateController {
    constructor(main) {
        this.workingWorker = undefined;
        this.isGameRunning = false;
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.on("gamestate-controller", (event, data) => {
            switch (data.action) {
                case "update-game-state":
                    if (data.isGameRunning !== undefined) {
                        this.updateGameState(data.isGameRunning);
                    }
                    break;
                case "start-game":
                    this.startGame(data.args);
                    break;
            }
        });
        electron_1.ipcMain.handle("gamestate-controller", async (event, data) => {
            switch (data.action) {
                case "get-game-state":
                    let settings = this.mainApp.settings;
                    return {
                        real: this.isGameRunning,
                        gameState: (settings && settings.s_game_state_check) ? this.isGameRunning : false
                    };
                case "get-game-packs":
                    return this.getInstalledPacks();
                default:
                    throw new Error("No valid action specified for GameStateController");
            }
        });
    }
    async start() {
        if (this.workingWorker)
            return;
        let workers = await this.mainApp.workersController.getAtLeastOneReadyWorker();
        if (workers.length == 0) {
            throw new Error("No workers available to start GameStateController");
        }
        let pWorker = workers[0];
        pWorker.activeClaimed.add("gamestate");
        this.workingWorker = pWorker.worker;
        this.workingWorker.webContents.send("gamestate", {
            action: "create-controller",
            settings: this.mainApp.settings,
            isMac: process.platform === "darwin"
        });
        console.log("[GameStateController] Game state controller initialized in worker.");
    }
    updateSettings() {
        //Not implemented yet
        if (!this.workingWorker)
            return;
        this.workingWorker.webContents.send("gamestate", {
            action: "update-settings",
            settings: this.mainApp.settings
        });
    }
    updateFocusState(focus) {
        if (!this.workingWorker)
            return;
        try {
            console.log("[GameStateController] Focus state changed: " + (focus ? "Focused" : "Unfocused"));
            this.workingWorker.webContents.send("gamestate", {
                action: "focus-change",
                focus: focus
            });
        }
        catch (error) {
            console.error("[GameStateController] Error updating focus state:", error);
        }
    }
    updateGameState(isOpen) {
        if (isOpen === this.isGameRunning)
            return;
        this.isGameRunning = isOpen;
        console.log("[GameStateController] Game state updated: " + (isOpen ? "Game is running" : "Game is not running"));
        let mainWindow = this.mainApp.mainWindowController.mainWindow;
        if (!mainWindow) {
            console.warn("[GameStateController] Main window not available to update game state.");
            return;
        }
        console.log("[GameStateController] Sending game state update to main window. Is game running: " + isOpen);
        IPCExtras_1.IPCExtras.sendFromMain(mainWindow, "app", {
            action: "game-state-change",
            gameIsOpen: isOpen
        });
    }
    getInstalledPacks() {
        let gameFolder = this.mainApp.settings.s_game_orgin;
        if (!gameFolder || !fs.existsSync(gameFolder))
            return undefined;
        let installedPacks = GameFiles_1.GameFiles.getInstalledPacks(gameFolder, process.platform === "darwin");
        return installedPacks;
    }
    startGame(args) {
        if (this.isGameRunning) {
            console.warn("[GameStateController] Game is already running. Cannot start again.");
            return;
        }
        if (!this.workingWorker) {
            console.error("[GameStateController] No worker available to start the game.");
            return;
        }
        console.log("[GameStateController] Starting game with args:", args);
        this.workingWorker.webContents.send("gamestate", {
            action: "start-game",
            gamepath: this.mainApp.settings.s_game_orgin,
            isMac: process.platform === "darwin",
            args: args
        });
    }
    isRunning() {
        return this.isGameRunning;
    }
}
exports.GameStateController = GameStateController;
