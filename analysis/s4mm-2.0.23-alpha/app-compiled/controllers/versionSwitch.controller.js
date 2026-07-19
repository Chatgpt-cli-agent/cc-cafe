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
exports.VersionSwitchController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_2 = require("electron");
const DeleteHelper_1 = require("../utils/DeleteHelper");
const settings_1 = require("../data/settings");
class VersionSwitchController {
    constructor(main) {
        this.specialInfoFileName = "version_migration_info.json";
        this.followersToTransfer = [];
        this.fingerprintCategoriesMap = new Map();
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("version-switch", async (event, data) => {
            switch (data.action) {
                case "check-old-version":
                    const oldVersionExists = this.checkIfOldDataFolderExists();
                    return { exists: oldVersionExists.exists, path: oldVersionExists.path };
                case "has-special-info":
                    const specialInfo = this.checkForSpecialInfo();
                    return specialInfo;
                case "save-special-info":
                    this.saveSpecialInfo(data.info);
                    return { success: true };
                case "transfer-settings":
                    return await this.transferSettings(data.dataFolder);
                case "transfer-database-entries":
                    return await this.transferDatabaseEntries(data.dataFolder);
                case "delete-old-data":
                    const deleteSuccess = await this.deleteOldData(data.dataFolder);
                    return { success: deleteSuccess };
                default:
                    throw new Error("No valid action or parameters");
            }
        });
        electron_1.ipcMain.on("version-switch", (event, data) => {
            switch (data.action) {
                case "open-old-data-folder":
                    this.openOldDataFolder();
                    break;
                default:
                    console.log("No valid action or parameters");
            }
        });
    }
    checkForSpecialInfo() {
        let obj = {
            forceSkip: false,
            moveError: false,
        };
        let oldDataFolderPath = this.getOldDataFolderPath();
        if (!oldDataFolderPath || !fs.existsSync(oldDataFolderPath))
            return obj;
        let specialInfoFilePath = path_1.default.join(oldDataFolderPath, this.specialInfoFileName);
        if (!fs.existsSync(specialInfoFilePath))
            return obj;
        try {
            const fileContent = fs.readFileSync(specialInfoFilePath, "utf-8");
            const parsedContent = JSON.parse(fileContent);
            obj.forceSkip = parsedContent.forceSkip || false;
            obj.moveError = parsedContent.moveError || false;
        }
        catch (error) {
            console.error("Error reading or parsing special info file:", error);
        }
        return obj;
    }
    saveSpecialInfo(info) {
        const oldDataFolderPath = this.getOldDataFolderPath();
        if (!oldDataFolderPath || !fs.existsSync(oldDataFolderPath))
            return;
        const specialInfoFilePath = path_1.default.join(oldDataFolderPath, this.specialInfoFileName);
        try {
            fs.writeFileSync(specialInfoFilePath, JSON.stringify(info), "utf-8");
        }
        catch (error) {
            console.error("Error writing special info file:", error);
        }
    }
    checkIfOldDataFolderExists() {
        const oldDataFolderPath = this.getOldDataFolderPath();
        return { exists: fs.existsSync(oldDataFolderPath), path: oldDataFolderPath };
    }
    getOldDataFolderPath() {
        const documentsPath = electron_2.app.getPath("documents");
        return path_1.default.join(documentsPath, "Sims 4 Mod Manager Data");
    }
    openOldDataFolder() {
        const oldDataFolderPath = this.getOldDataFolderPath();
        if (fs.existsSync(oldDataFolderPath)) {
            this.mainApp.ipcCollections.simpleTasksCollection.openFolder(oldDataFolderPath);
        }
    }
    //Transfer
    async transferSettings(dataFolder) {
        let oldJsonFilePath = path_1.default.join(dataFolder, "settings.json");
        if (!fs.existsSync(oldJsonFilePath))
            return true;
        try {
            const oldSettingsContent = fs.readFileSync(oldJsonFilePath, "utf-8");
            const oldSettings = JSON.parse(oldSettingsContent);
            const settingsController = this.mainApp.settingsController;
            let settingsAsObj = settingsController.getSettingsAsJson();
            //Go over each value of old settings and if it exists in the new settings and is not undefined, transfer it
            for (const key in oldSettings) {
                if (oldSettings.hasOwnProperty(key) && settingsAsObj.hasOwnProperty(key) && !key.toLowerCase().includes("language")) {
                    const oldValue = oldSettings[key];
                    if (oldValue !== undefined) {
                        settingsAsObj[key] = oldValue;
                    }
                }
            }
            let toSave = settings_1.Settings.from(settingsAsObj);
            settingsController.saveSettings(toSave);
        }
        catch (error) {
            console.error("Error transferring settings:", error);
            return false;
        }
        return true;
    }
    async transferDatabaseEntries(dataFolder) {
        //Categories and CurseForge follwers
        //Connect to old database
        let oldDbKnex;
        try {
            oldDbKnex = await this.getKnexForOldDatabase(dataFolder);
        }
        catch (error) {
            console.error("Error connecting to old database:", error);
            return false;
        }
        //Followers
        let followers = [];
        try {
            followers = await oldDbKnex("Follower").pluck("name");
        }
        catch (error) {
            console.error("Error fetching followers from old database:", error);
        }
        this.followersToTransfer = followers;
        //Read Categories
        let categories = [];
        let filesMap = new Map();
        try {
            categories = await oldDbKnex("Categories").select(["name", "autotag", "onpreview", "tags", "ntags", "order", "id"]);
            let files = await oldDbKnex("Files").select(["fingerprint", "categories"]).whereNot("categories", "");
            for (let file of files) {
                if (file.fingerprint) {
                    //filesMap.push({fingerprint: file.fingerprint, categories: categories});
                    filesMap.set(file.fingerprint, file.categories);
                }
            }
        }
        catch (error) {
            console.error("Error fetching categories from old database:", error);
        }
        //Write categories to new database
        let knex = this.mainApp.databaseController.getKnex();
        let idMap = new Map();
        if (categories.length > 0) {
            try {
                for (let category of categories) {
                    let existing = await knex("categories").where("name", category.name).first();
                    if (existing)
                        continue;
                    let oldId = category.id;
                    delete category.id; //Remove id to avoid conflicts with new database
                    await knex("categories").insert(category);
                    //Get id of the inserted category and map it to the old id, so we can later transfer the categories of the files correctly
                    let newCategory = await knex("categories").where("name", category.name).first();
                    if (newCategory) {
                        idMap.set(oldId, newCategory.id);
                    }
                }
            }
            catch (error) {
                console.error("Error writing categories to new database:", error);
            }
        }
        //Translate filesMap with idMap
        let translatedFilesMap = new Map();
        for (let [fingerprint, categories] of filesMap.entries()) {
            let categoryIds = categories.split("<").join("").split(">").map((id) => parseInt(id));
            let idSet = new Set();
            for (let id of categoryIds) {
                let transferredId = idMap.get(id);
                if (transferredId)
                    idSet.add(transferredId);
            }
            if (idSet.size > 0 && fingerprint) {
                translatedFilesMap.set(fingerprint, idSet);
            }
        }
        this.fingerprintCategoriesMap = translatedFilesMap;
        filesMap.clear();
        idMap.clear();
        //Close old database connection
        try {
            await oldDbKnex.destroy();
        }
        catch (error) {
            console.error("Error closing old database connection:", error);
        }
        return true;
    }
    async getKnexForOldDatabase(dataFolder) {
        let oldDbPath = path_1.default.join(dataFolder, "db_cc.sqlite");
        if (!fs.existsSync(oldDbPath))
            throw new Error("Old database not found");
        let knex = require("knex")({
            client: "sqlite3",
            connection: {
                filename: oldDbPath
            },
            useNullAsDefault: true,
        });
        return knex;
    }
    async deleteOldData(dataFolder) {
        if (!fs.existsSync(dataFolder))
            return true;
        console.log("[VERSION SWITCH] Deleting old data folder: " + dataFolder);
        return await DeleteHelper_1.DeleteHelper.deleteFolder(dataFolder);
        //return true; //For now we do not delete the old data, because it is safer to just let the user do it manually after checking that everything is transferred correctly. Deleting the old data automatically can lead to data loss if something went wrong during the transfer.
    }
}
exports.VersionSwitchController = VersionSwitchController;
