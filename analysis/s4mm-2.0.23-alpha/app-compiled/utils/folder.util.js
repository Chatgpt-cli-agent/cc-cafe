"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderUtil = void 0;
const FilenameUtils_1 = require("./FilenameUtils");
const path_1 = __importDefault(require("path"));
const fdir_1 = require("fdir");
class FolderUtil {
    static async getFiles(folderPath, onlySimsFiles = false) {
        const start = Date.now();
        const api = new fdir_1.fdir()
            .withRelativePaths()
            .filter((filePath) => {
            const name = path_1.default.basename(filePath);
            const upper = name.toUpperCase();
            // Exact same filtering logic as your old code
            if (name.startsWith('.') || FolderUtil.WINDOWS_BLOCKLIST.has(upper)) {
                return false;
            }
            if (onlySimsFiles) {
                return (0, FilenameUtils_1.isSims4File)(name);
            }
            return true;
        })
            // Optional: exclude hidden directories more aggressively
            .exclude((dirPath) => {
            const name = path_1.default.basename(dirPath);
            return name.startsWith('.') || FolderUtil.WINDOWS_BLOCKLIST.has(name.toUpperCase());
        });
        const relativePaths = await api.crawl(folderPath).withPromise();
        const files = relativePaths.map((relPath) => ({
            name: path_1.default.basename(relPath),
            sp: path_1.default.dirname(relPath) || ""
        }));
        console.log(`[FILE-SCAN UltraFast${onlySimsFiles ? ' (Sims)' : ''}] ${Date.now() - start}ms | ${files.length} files`);
        return {
            files,
            base: folderPath,
            id: Date.now()
        };
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
