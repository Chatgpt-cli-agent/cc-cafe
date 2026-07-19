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
exports.ToolMainMenu = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const SimsImageUtil_1 = require("../utils/SimsImageUtil");
const DDS_1 = require("../utils/DDS");
const DBPFReader_1 = require("../sims/DBPFReader");
const Compression_1 = require("../utils/Compression");
var zlib = require("zlib");
class ToolMainMenu {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-main-menu", async (event, data) => {
            switch (data.action) {
                case "get-packages":
                    // Logic to get the loading screen image
                    return await this.gePackages();
                case "create-package":
                    return await this.createPackage(data);
                case "create-background-pack":
                    return await this.createBackgroundPack(data);
                default:
                    throw new Error("No valid action or parameters");
            }
        });
    }
    async gePackages() {
        let items = [];
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not available");
        let inosRaw = await knex.from("Entries")
            .select(knex.raw('CAST(ino AS TEXT) AS ino'))
            .where("type", 1659684250).andWhere("instance", "7863473452888036665")
            .distinct();
        if (!Array.isArray(inosRaw) || inosRaw.length === 0) {
            return items;
        }
        let inos = inosRaw.map((item) => item.ino);
        let files = await knex.from("Files").select(["*", knex.raw('CAST(ino AS TEXT) AS ino')]).whereIn("ino", inos);
        if (!Array.isArray(files) || files.length === 0) {
            return items;
        }
        return files;
    }
    async createPackage(data) {
        let { image, filepath, options } = data;
        if (!image || !filepath) {
            throw new Error("Image and filepath are required to create a loading screen.");
        }
        let tmpFolderPath = this.mainApp.folderStructureController.getFolder("tmp");
        if (!tmpFolderPath || !fs.existsSync(tmpFolderPath)) {
            throw new Error("Temporary folder path not available");
        }
        let imPre = path_1.default.join(__dirname, "..", "files", "main_menu_pre.bnry");
        let imPost = path_1.default.join(__dirname, "..", "files", "main_menu_post.bnry");
        let sideFadeLeft = path_1.default.join(__dirname, "..", "files", "main_menu_fade.png");
        let file = data.filepath;
        await SimsImageUtil_1.SimsImageUtil.createMainMenuPackage(file, image, imPre, imPost, sideFadeLeft, options, tmpFolderPath);
        if (fs.existsSync(file)) {
            if (file.toLowerCase().startsWith(this.mainApp.settings.s_path_mod.toLowerCase())) {
                try {
                    let importedFile = await this.mainApp.fileImportController.importSingleFile(file);
                    return { error: false, file: file, importedFile: importedFile };
                }
                catch (error) {
                    console.log("Issue occurred while importing file:", error);
                    return { error: true, message: "Failed to import file: " + error };
                }
            }
            else {
                return { file: file, error: false };
            }
        }
        else {
            return { error: true };
        }
    }
    async createBackgroundPack(data) {
        let { images, filepath } = data;
        if (!images || !filepath) {
            throw new Error("Images and filepath are required to create a background pack.");
        }
        let tmpFolderPath = this.mainApp.folderStructureController.getFolder("tmp");
        if (!tmpFolderPath || !fs.existsSync(tmpFolderPath)) {
            throw new Error("Temporary folder path not available");
        }
        //Resize all images to 1920x1080 and save them in the temp folder
        let resizedImagePaths = [];
        for (let i = 0; i < images.length; i++) {
            let image = images[i];
            let resizedImagePath = path_1.default.join(tmpFolderPath, `resized_${i}.png`);
            let rI = await SimsImageUtil_1.SimsImageUtil.resizeImageTo(image, resizedImagePath, 1920, 1080);
            if (rI)
                resizedImagePaths.push(rI);
        }
        //Convert to DDS5 
        let ddsImagePaths = [];
        for (let i = 0; i < resizedImagePaths.length; i++) {
            let rImage = resizedImagePaths[i];
            let ddsImagePath = path_1.default.join(tmpFolderPath, `converted_${i}.dds`);
            let cI = await DDS_1.DDSConverter.pngBufferToDdsBuffer(fs.readFileSync(rImage));
            fs.writeFileSync(ddsImagePath, cI);
            if (fs.existsSync(ddsImagePath))
                ddsImagePaths.push(ddsImagePath);
        }
        console.log("Resized images:", resizedImagePaths);
        console.log("DDS images:", ddsImagePaths);
        let ids = [
            "7DED917E94DF99AE",
            "7DED917E94DF99AD",
            "495E1333995755CB",
            "495E1333995755C8",
            "5739DB941281F287",
            "5739DB941281F284",
            "2B84DB0A8A404E63",
            "2B84DB0A8A404E60",
            "524AEE0133724C0B",
            "524AEE0133724C08",
            "B91A3CDADF3AFB51",
            "B91A3CDADF3AFB52",
            "09371543DB2D6193",
            "F33BCC7BE5F6B47C",
            "F33BCC7BE5F6B47F"
        ];
        let pack = new DBPFReader_1.Pack(filepath);
        for (let i = 0; i < ddsImagePaths.length && i < ids.length; i++) {
            let ddsImagePath = ddsImagePaths[i];
            let bufferUncompressed = fs.readFileSync(ddsImagePath);
            let buffer = Compression_1.Compression.compress(bufferUncompressed);
            let instanceStr = ids[i];
            let type = 0x00B2D882;
            let group = 0x00000000;
            let hi_instance = parseInt(instanceStr.slice(0, 8), 16);
            let lo_instance = parseInt(instanceStr.slice(8, 16), 16);
            let ie = new DBPFReader_1.IndexEnty(filepath, type, group, hi_instance, lo_instance, 0, buffer.length, bufferUncompressed.length, 0x5A42, 1);
            ie.setBuffer(buffer);
            pack.index_List.push(ie);
        }
        pack.saveToFile(filepath);
    }
}
exports.ToolMainMenu = ToolMainMenu;
