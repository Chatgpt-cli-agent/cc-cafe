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
exports.ToolGameOptions = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const GameOptions_1 = require("../utils/GameOptions");
class ToolGameOptions {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-game-options", async (event, data) => {
            switch (data.action) {
                case "get-options":
                    return await this.getOptions();
                case "change-options":
                    return await this.changeOptions(data);
                default:
                    throw new Error("Unknown action: " + data.action);
            }
        });
    }
    async getOptions() {
        let gameFolderDocuments = this.mainApp.settings.s_game_documents;
        if (!gameFolderDocuments || !fs.existsSync(gameFolderDocuments)) {
            throw new Error("Game folder documents not set.");
        }
        return await GameOptions_1.GameOptions.getOptionsInfo(gameFolderDocuments);
    }
    async changeOptions(data) {
        let gameFolderDocuments = this.mainApp.settings.s_game_documents;
        if (!gameFolderDocuments || !fs.existsSync(gameFolderDocuments)) {
            throw new Error("Game folder documents not set.");
        }
        return await GameOptions_1.GameOptions.writeOptions(gameFolderDocuments, data);
    }
}
exports.ToolGameOptions = ToolGameOptions;
