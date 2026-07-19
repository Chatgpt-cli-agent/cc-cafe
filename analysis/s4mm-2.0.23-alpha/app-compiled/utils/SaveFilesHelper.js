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
exports.SaveFilesHelper = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SaveFilesHelper {
    static getGroupedSaveFiles(savesFolder) {
        if (!fs.existsSync(savesFolder))
            return [];
        let saveFileGroups = [];
        let fileMap = new Map();
        let files = fs.readdirSync(savesFolder);
        files.forEach(file => {
            if (!file.includes(".save") || !file.startsWith("Slot_"))
                return;
            let filenameWithoutExt = file.split(".")[0];
            let filesInGroup = fileMap.get(filenameWithoutExt);
            if (!filesInGroup) {
                filesInGroup = [];
                fileMap.set(filenameWithoutExt, filesInGroup);
            }
            filesInGroup.push(file);
        });
        fileMap.forEach((filesInGroup, groupName) => {
            let slotNumber = parseInt(groupName.split("_")[1], 16);
            let obj = {
                groupName: groupName,
                slotNumber: slotNumber,
                mainFile: null,
                verFiles: [],
            };
            filesInGroup.forEach(file => {
                let fullPath = path.join(savesFolder, file);
                let stats = fs.statSync(fullPath);
                let fileObj = {
                    fileName: file,
                    fullPath: fullPath,
                    size: stats.size,
                    modifiedTime: Math.floor(stats.mtimeMs),
                };
                if (file.endsWith(".save")) {
                    obj.mainFile = fileObj;
                }
                else {
                    obj.verFiles.push(fileObj);
                }
            });
            if (obj.mainFile)
                saveFileGroups.push(obj);
        });
        return saveFileGroups;
    }
}
exports.SaveFilesHelper = SaveFilesHelper;
