"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FoldersUtils = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class FoldersUtils {
    // Get all files in a folder and its subfolders, with optional filtering by file types and folder depth (-1 for unlimited depth)
    static async getAllFilesInFolder(folderPath, filesTypes, folderDepth = -1) {
        let results = [];
        let files = this.readFolder(folderPath, folderDepth);
        if (filesTypes && filesTypes.length > 0) {
            files = files.filter(file => {
                const ext = path_1.default.extname(file).toLowerCase();
                return filesTypes.includes(ext);
            });
        }
        results = results.concat(files);
        return results;
    }
    static readFolder(folderPath, folderDepth = -1, currentDepth = 0) {
        let results = [];
        if (folderDepth != -1 && currentDepth > folderDepth) {
            return results;
        }
        const list = fs_1.default.readdirSync(folderPath);
        list.forEach((file) => {
            const filePath = path_1.default.join(folderPath, file);
            const stat = fs_1.default.statSync(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(this.readFolder(filePath, folderDepth, currentDepth + 1));
            }
            else {
                results.push(filePath);
            }
        });
        return results;
    }
    static extendWithInfo(filepaths) {
        return filepaths.map(filepath => {
            const stat = fs_1.default.statSync(filepath);
            return {
                filepath: filepath,
                name: path_1.default.basename(filepath),
                size: stat.size,
                ino: stat.ino.toString(),
                uKey: stat.ino.toString() + "-" + stat.size.toString()
            };
        });
    }
}
exports.FoldersUtils = FoldersUtils;
