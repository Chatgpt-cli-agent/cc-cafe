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
exports.ToolOtherFiles = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
class ToolOtherFiles {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-other-files", async (event, data) => {
            switch (data.action) {
                case "get-other-files":
                    return await this.getOtherFiles();
                default:
                    throw new Error("Unknown action for other files tool");
            }
        });
    }
    async getOtherFiles() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        let files = await knex("Files").where("type", 3).select(["*", knex.raw("CAST(ino AS TEXT) AS ino")]);
        files = files.filter((file) => {
            return file.path && file.name && fs.existsSync(path_1.default.join(file.path, file.name));
        });
        return files;
    }
}
exports.ToolOtherFiles = ToolOtherFiles;
