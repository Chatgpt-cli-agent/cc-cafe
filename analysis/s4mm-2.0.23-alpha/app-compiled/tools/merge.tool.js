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
exports.ToolMerge = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const PackageOperations_1 = require("../utils/PackageOperations");
class ToolMerge {
    constructor(main) {
        this.IPCADDRESS = "FileModificationController";
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle(this.IPCADDRESS, async (event, data) => {
            switch (data.action) {
                case "merge-copy-to-external":
                    this.copyToFromMerged(data.file, data.destination, data.packages);
                    return { success: true };
                case "merge-delete-from-file":
                    this.deleteFromMerged(data.file, data.packages);
                    return { success: true };
                case "merge-extract":
                    await this.extract(data.file, data.destination, data.packages, data.shouldDelete, data.ino);
                    return { extract: true };
                default:
                    throw new Error("No action");
            }
        });
    }
    getTmpMergeFolder() {
        let tmpMergeFolder = this.mainApp.folderStructureController.getFolder("tmp-merge");
        if (!tmpMergeFolder || !fs.existsSync(tmpMergeFolder)) {
            throw new Error("No tmp merge folder found");
        }
        return tmpMergeFolder;
    }
    copyToFromMerged(file, destination, relevantPackages) {
        return PackageOperations_1.PackageOperations.copyToFromMerged(file, destination, this.getTmpMergeFolder(), relevantPackages);
    }
    deleteFromMerged(file, relevantPackages) {
        return PackageOperations_1.PackageOperations.removeFromMerged(file, relevantPackages);
    }
    async extract(file, destination, relevantPackages, shouldDelete, ino) {
        PackageOperations_1.PackageOperations.unmergeFile(file, destination, this.getTmpMergeFolder(), relevantPackages, shouldDelete ? 0 : 1);
    }
}
exports.ToolMerge = ToolMerge;
