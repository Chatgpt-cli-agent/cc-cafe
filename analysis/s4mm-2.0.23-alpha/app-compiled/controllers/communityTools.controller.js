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
exports.CommuintyToolsController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const communityApi_1 = require("../utils/communityApi");
const FolderArchive_1 = require("../utils/FolderArchive");
class CommuintyToolsController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("community-tools", async (event, args) => {
            switch (args.action) {
                case "share-mod-folder":
                    return await this.shareModFolder(event, args.accessToken, args.name, args.isNsfw);
                default:
                    throw new Error("Invalid action: " + args.action);
            }
        });
    }
    async createCurrentArchive() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Knex not initialized");
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        if (!tmpFolder || !fs.existsSync(tmpFolder))
            throw new Error("Tmp folder not initialized");
        let modfolderPath = this.mainApp.settings.s_path_mod;
        let selectionArray = ["path", "fingerprint", "type", "name", "casp", "cobj", "clip", "size"];
        let folderArchive = new FolderArchive_1.FolderArchive();
        const batchSize = 1000;
        let offset = 0;
        let searching = true;
        while (searching) {
            let files = await knex("files").select(selectionArray).offset(offset).limit(batchSize).where("type", "<", 3);
            if (files.length == 0) {
                searching = false;
                break;
            }
            offset += batchSize;
            console.log("Batch loaded: " + files.length);
            folderArchive.addDatabaseBatch(files, modfolderPath);
            if (files.length < batchSize)
                searching = false;
        }
        return folderArchive;
    }
    async shareModFolder(event, accessToken, name, isNsfw) {
        let af = await this.createCurrentArchive();
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        if (!tmpFolder || !fs.existsSync(tmpFolder))
            throw new Error("Tmp folder not initialized");
        let tmpFile = path_1.default.join(tmpFolder, "s4mm_folder_" + Date.now() + ".s4mmfsf");
        await af.writeAsArchiveFile(tmpFile);
        if (!fs.existsSync(tmpFile)) {
            throw new Error("Failed to create folder structure file");
        }
        let suc = await communityApi_1.CommunityApi.uploadSharedModFolderFile(tmpFile, accessToken, name, {
            fileCount: af.filesCount,
            folderSize: af.totalSize,
            folderCount: af.subFoldersCount,
            isNsfw: isNsfw
        });
        if (!suc || !suc.success) {
            throw new Error("Failed to upload folder structure file");
        }
        console.log("Folder structure file uploaded");
        return suc;
    }
}
exports.CommuintyToolsController = CommuintyToolsController;
