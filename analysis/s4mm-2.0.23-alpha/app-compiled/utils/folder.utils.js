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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderUtil = void 0;
const FilenameUtils_1 = require("./FilenameUtils");
const fsPromises = __importStar(require("fs/promises"));
class FolderUtil {
    async getAllSimsFiles(folderPath, onlySimsFiles = true) {
        let modfolderParts = folderPath.split(path.sep);
        if (modfolderParts.length < 2)
            throw new Error("Invalid path");
        let modfolderName = modfolderParts.pop();
        if (!modfolderName)
            throw new Error("Invalid path");
        let modFolderParent = modfolderParts.join(path.sep);
        let files = [];
        await this.checkFile(modFolderParent, modfolderName, folderPath, files, onlySimsFiles);
        return { files: files, base: folderPath, id: Date.now() };
    }
    async checkFile(filePath, fileName, baseFolder, files, onlySimsFiles) {
        const upperName = fileName.toUpperCase();
        if (fileName.startsWith(".") || FolderUtil.WINDOWS_BLOCKLIST.has(upperName)) {
            return;
        }
        let isSimsfile = (!onlySimsFiles) || (0, FilenameUtils_1.isSims4File)(fileName);
        if (isSimsfile) {
            files.push({
                name: fileName,
                sp: filePath.replace(baseFolder, "")
            });
        }
        else {
            let file = path.join(filePath, fileName);
            let stats = await fsPromises.stat(file);
            if (stats.isDirectory()) {
                let subFiles = await fsPromises.readdir(file);
                await Promise.all(subFiles.map(subFile => this.checkFile(file, subFile, baseFolder, files, onlySimsFiles)));
            }
        }
    }
}
exports.FolderUtil = FolderUtil;
FolderUtil.WINDOWS_BLOCKLIST = new Set([
    '$RECYCLE.BIN',
    'SYSTEM VOLUME INFORMATION',
    '$RECOVERY',
    'DSHOME',
    'CONFIG.MSI',
    'PAGEFILE.SYS',
    'HIBERFIL.SYS',
    'SWAPFILE.SYS'
]);
