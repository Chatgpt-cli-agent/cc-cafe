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
exports.ToolLoadingScreen = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const SimsImageUtil_1 = require("../utils/SimsImageUtil");
class ToolLoadingScreen {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-loading-screen", async (event, data) => {
            switch (data.action) {
                case "get-loading-screen-packages":
                    // Logic to get the loading screen image
                    return await this.getLoadingScreenPackages();
                case "create-loading-screen":
                    return await this.createLoadingScreen(data);
                case "randomize":
                    return await this.randomizeLoadingScreen(data.inos);
                default:
                    throw new Error("No valid action or parameters");
            }
        });
    }
    async getLoadingScreenPackages() {
        let items = [];
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not available");
        let inosRaw = await knex.from("Entries")
            .select(knex.raw('CAST(ino AS TEXT) AS ino'))
            .where("type", 1659684250).andWhere("instance", "4840557244443510488")
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
    async createLoadingScreen(data) {
        let { image, filepath, options } = data;
        if (!image || !filepath) {
            throw new Error("Image and filepath are required to create a loading screen.");
        }
        let imPre = path_1.default.join(__dirname, "..", "files", "img_loading_pre.bnry");
        let imPost = path_1.default.join(__dirname, "..", "files", "img_loading_post.bnry");
        if (!fs.existsSync(imPre) || !fs.existsSync(imPost)) {
            throw new Error("Required image files for loading screen do not exist. - " + imPre + " or " + imPost);
        }
        let file = data.filepath;
        try {
            await SimsImageUtil_1.SimsImageUtil.createLoadingScreenPackage(file, data.image, imPre, imPost, data.options);
        }
        catch (error) {
            console.error("Issue occurred while creating loading screen package:", error);
            return { error: true, message: "Failed to create loading screen package: " + error };
        }
        console.log("Loading screen created successfully at:", file);
        if (fs.existsSync(file)) {
            if (file.toLowerCase().startsWith(this.mainApp.settings.s_path_mod.toLowerCase())) {
                /*let result = await callWorkerFunction({
                    action: "import-single",
                    filepath: data.filepath,
                    modFolder: settings.s_path_mod
                });*/
                //return result;
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
    async randomizeLoadingScreen(inos) {
        if (!Array.isArray(inos) || inos.length === 0)
            throw new Error("No inos provided");
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not available");
        // Fetch files matching the provided inos
        let files = await knex("Files")
            .select(["*", knex.raw('CAST(ino AS TEXT) AS ino')])
            .whereIn("ino", inos);
        files = files.filter((file) => {
            let filepath = path_1.default.join(file.path, file.name);
            let exists = fs.existsSync(filepath);
            if (exists) {
                return true;
            }
            missingInos.push(file.ino);
            return false;
        });
        const inosSet = new Set(inos);
        const onFiles = [];
        const offFiles = [];
        // Classify files as "on" or "off"
        for (const file of files) {
            inosSet.delete(file.ino);
            const filepath = path_1.default.join(file.path, file.name);
            if (!file.name.toLowerCase().endsWith("off")) {
                onFiles.push(file);
            }
            else {
                offFiles.push(file);
            }
        }
        const missingInos = Array.from(inosSet);
        // If no files or only one "on" file, nothing to randomize
        if ((onFiles.length + offFiles.length === 0) || (offFiles.length === 0 && onFiles.length === 1)) {
            return { onChanges: [], offChanges: [], missingInos };
        }
        const onChanges = [];
        const offChanges = [];
        // Turn all "on" files "off"
        for (const file of onFiles) {
            const oldFilePath = path_1.default.join(file.path, file.name);
            const newFileName = file.name + "OFF";
            const newFilePath = path_1.default.join(file.path, newFileName);
            if (fs.existsSync(oldFilePath)) {
                fs.renameSync(oldFilePath, newFilePath);
                offChanges.push({
                    ino: file.ino,
                    oldFileName: file.name,
                    newFileName,
                    oldFilePath,
                    newFilePath
                });
            }
        }
        // Randomly select one "off" file to turn "on"
        let candidates = offFiles.length > 0 ? offFiles : onFiles;
        let newOnFile = candidates[Math.floor(Math.random() * candidates.length)];
        // Turn the selected file "on"
        if (newOnFile) {
            const oldFilePath = path_1.default.join(newOnFile.path, newOnFile.name);
            const newFileName = newOnFile.name.toLowerCase().endsWith("off")
                ? newOnFile.name.slice(0, -3)
                : newOnFile.name;
            const newFilePath = path_1.default.join(newOnFile.path, newFileName);
            if (oldFilePath.toLowerCase() !== newFilePath.toLowerCase() &&
                fs.existsSync(oldFilePath) &&
                !fs.existsSync(newFilePath)) {
                fs.renameSync(oldFilePath, newFilePath);
                onChanges.push({
                    ino: newOnFile.ino,
                    oldFileName: newOnFile.name,
                    newFileName,
                    oldFilePath,
                    newFilePath
                });
            }
        }
        // Remove any offChanges that were also turned on
        const onInos = new Set(onChanges.map(item => item.ino));
        const filteredOffChanges = offChanges.filter(item => !onInos.has(item.ino));
        // Update database names
        for (const change of [...onChanges, ...filteredOffChanges]) {
            await knex("Files").where("ino", change.ino).update({ name: change.newFileName });
        }
        return {
            onChanges,
            offChanges: filteredOffChanges,
            missingInos
        };
    }
}
exports.ToolLoadingScreen = ToolLoadingScreen;
