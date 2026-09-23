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
exports.ArchiveUtil = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const unrar = __importStar(require("node-unrar-js"));
const adm_zip_1 = __importDefault(require("adm-zip"));
class ArchiveUtil {
    // Check if the archive contains any Sims 4 relevant files (e.g., .package, .ts4script)
    static containsSimsFiles(files) {
        const simsFileExtensions = [".package", ".ts4script"];
        return files.some(file => {
            const ext = path_1.default.extname(file.name).toLowerCase();
            return simsFileExtensions.includes(ext);
        });
    }
    static filterSimsFiles(files) {
        const simsFileExtensions = [".package", ".ts4script"];
        return files.filter(file => {
            const ext = path_1.default.extname(file.name).toLowerCase();
            return simsFileExtensions.includes(ext);
        });
    }
    // Get a list of files in the archive with their internal paths and sizes
    static async getFileListFromArchive(archivePath) {
        const fileExtension = archivePath.split('.').pop()?.toLowerCase();
        if (fileExtension === "zip") {
            return await this.zipContentList(archivePath);
        }
        else if (fileExtension === "rar") {
            return await this.rarContentList(archivePath);
        }
        else {
            throw new Error("Unsupported archive format: " + fileExtension);
        }
    }
    static async zipContentList(archivePath) {
        if (!fs_1.default.existsSync(archivePath)) {
            throw new Error("Archive file does not exist: " + archivePath);
        }
        const zip = new adm_zip_1.default(archivePath);
        const zipEntries = zip.getEntries(); // Get all files and folders
        return zipEntries
            .filter(entry => !entry.isDirectory) // Filter out directory entries
            .filter(entry => !entry.entryName.startsWith("__MACOSX/") && !entry.entryName.startsWith(".DS_Store") && !entry.entryName.startsWith("._")) // Remove MacOS __MACOSX folder and its contents and other meta files
            .map(entry => {
            return {
                name: entry.name,
                internalPath: entry.entryName,
                size: entry.header.size
            };
        });
    }
    static async rarContentList(archivePath) {
        if (!fs_1.default.existsSync(archivePath)) {
            throw new Error("Archive file does not exist: " + archivePath);
        }
        const data = fs_1.default.readFileSync(archivePath);
        const buf = Uint8Array.from(data).buffer;
        const extractor = await unrar.createExtractorFromData({ data: buf });
        const list = extractor.getFileList();
        const listArcHeader = list.arcHeader;
        const fileHeaders = [...list.fileHeaders].filter((file) => { return file && file.packSize > 0; }).filter((file) => { return !file.name.startsWith("__MACOSX/") && !file.name.startsWith(".DS_Store") && !file.name.startsWith("._"); }); // Remove MacOS __MACOSX folder and its contents and other meta files
        return fileHeaders.map((file) => {
            return {
                name: file.name.split("/").pop(),
                internalPath: file.name,
                size: file.unpSize
            };
        });
    }
    // Extract a specific file from the archive
    static async extractFileFromArchive(archivePath, internalPath) {
        const fileExtension = archivePath.split('.').pop()?.toLowerCase();
        if (fileExtension === "zip") {
            return await this.extractFileFromZip(archivePath, internalPath);
        }
        else if (fileExtension === "rar") {
            return await this.extractFileFromRar(archivePath, internalPath);
        }
        else {
            throw new Error("Unsupported archive format: " + fileExtension);
        }
    }
    static async extractFileFromZip(archivePath, internalPath) {
        if (!fs_1.default.existsSync(archivePath)) {
            throw new Error("Archive file does not exist: " + archivePath);
        }
        const zip = new adm_zip_1.default(archivePath);
        const entry = zip.getEntry(internalPath);
        if (!entry) {
            throw new Error("File not found in archive: " + internalPath);
        }
        return entry.getData();
    }
    static async extractFileFromRar(archivePath, internalPath) {
        if (!fs_1.default.existsSync(archivePath)) {
            throw new Error("Archive file does not exist: " + archivePath);
        }
        const data = fs_1.default.readFileSync(archivePath);
        const buf = Uint8Array.from(data).buffer;
        const extractor = await unrar.createExtractorFromData({ data: buf });
        const list = extractor.getFileList();
        const fileHeaders = [...list.fileHeaders].filter((file) => { return file && file.packSize > 0; });
        const targetFile = fileHeaders.find((file) => file.name === internalPath);
        if (!targetFile) {
            throw new Error("File not found in archive: " + internalPath);
        }
        const extracted = extractor.extract({ files: [internalPath] });
        const files = [...extracted.files];
        let fileData = files[0].extraction;
        if (!fileData)
            throw new Error("Failed to extract file data from archive: " + internalPath);
        return Buffer.from(fileData);
    }
    // Extract all files from the archive to a specified directory
    static async extractAllFromArchive(archivePath, outputDir) {
        const fileExtension = archivePath.split('.').pop()?.toLowerCase();
        if (fileExtension === "zip") {
            const zip = new adm_zip_1.default(archivePath);
            zip.extractAllTo(outputDir, true);
        }
        else if (fileExtension === "rar") {
            const data = fs_1.default.readFileSync(archivePath);
            const buf = Uint8Array.from(data).buffer;
            const extractor = await unrar.createExtractorFromData({ data: buf });
            const extracted = extractor.extract();
            const files = [...extracted.files];
            for (const file of files) {
                if (file.extraction) {
                    const outputPath = path_1.default.join(outputDir, file.fileHeader.name);
                    fs_1.default.mkdirSync(path_1.default.dirname(outputPath), { recursive: true });
                    fs_1.default.writeFileSync(outputPath, Buffer.from(file.extraction));
                }
            }
        }
        else {
            throw new Error("Unsupported archive format: " + fileExtension);
        }
    }
}
exports.ArchiveUtil = ArchiveUtil;
