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
exports.SettingsController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const settings_1 = require("../data/settings");
const path_1 = __importDefault(require("path"));
const language_controller_1 = require("./language.controller");
class SettingsController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("settings", async (event, data) => {
            if (data.action == "get-settings")
                return this.mainApp.settings;
            if (data.action == "set-settings")
                return this.saveSettings(data.settings);
            if (data.action == "reset-settings")
                return this.saveSettings(new settings_1.Settings());
            if (data.action == "load-settings")
                return this.loadSettings();
            if (data.action == "check-sims-paths")
                return this.checkAndSerachSimsPaths();
            if (data.action == "change-path" && data.id != undefined) {
                return this.changePath(data.id, event);
            }
            throw new Error("No valid action or parameters");
        });
        electron_1.ipcMain.on("settings-save", (event, data) => {
            this.saveSettings(data);
        });
    }
    //Settings
    saveSettings(settings) {
        this.setSettings(settings);
        let baseFolder = this.mainApp.folderStructureController.getFolder("s4mm-data");
        let settingsPath = baseFolder + "/settings.json";
        this.settingsUpdated();
        try {
            fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');
            console.log("[SETTINGS] Settings saved");
        }
        catch (error) {
            console.log(error);
            console.log("[ERROR] Failed to save settings");
        }
    }
    loadSettings() {
        let baseFolder = this.mainApp.folderStructureController.getFolder("s4mm-data");
        let settingsPath = baseFolder + "/settings.json";
        if (!fs.existsSync(settingsPath)) {
            let settings = new settings_1.Settings();
            this.saveSettings(settings);
            return settings;
        }
        try {
            let data = fs.readFileSync(settingsPath, 'utf8');
            let settingsJson = JSON.parse(data);
            let settings = settings_1.Settings.from(settingsJson);
            console.log("[SETTINGS] Settings loaded");
            this.setSettings(settings);
            this.settingsUpdated();
            return settings;
        }
        catch (error) {
            console.log(error);
            console.log("[ERROR] Failed to load settings");
            return new settings_1.Settings();
        }
    }
    getSettingsAsJson() {
        return JSON.parse(JSON.stringify(this.mainApp.settings));
    }
    setSettings(settings) {
        this.mainApp.settings = settings;
        console.log("[SETTINGS] Settings updated in main app");
        language_controller_1.LanguageService.setLanguageFile(settings.s_language_path);
    }
    settingsUpdated() {
        this.mainApp.gameStateController.updateSettings();
    }
    checkAndSerachSimsPaths() {
        let settings = this.mainApp.settings;
        //Clear if invalid
        if (!fs.existsSync(settings.s_path_mod))
            settings.s_path_mod = "";
        if (!fs.existsSync(settings.s_game_documents))
            settings.s_game_documents = "";
        if (!fs.existsSync(settings.s_game_orgin))
            settings.s_game_orgin = "";
        //Documents EA/Sims folder
        if (settings.s_game_documents == "") {
            let simsDataFolder = this.searchForSimsDataFolder();
            if (simsDataFolder != "")
                settings.s_game_documents = simsDataFolder;
        }
        //Mod folder path
        if (settings.s_path_mod == "") {
            let modFolder = this.searchForModFolder(settings.s_game_documents);
            if (modFolder != "")
                settings.s_path_mod = modFolder;
        }
        //Game folder
        if (settings.s_game_orgin == "") {
            let gameFolder = this.searchForGameFolder();
            if (gameFolder != "")
                settings.s_game_orgin = gameFolder;
        }
        this.saveSettings(settings);
        return {
            s_path_mod: settings.s_path_mod,
            s_game_documents: settings.s_game_documents,
            s_game_origin: settings.s_game_orgin
        };
    }
    searchForSimsDataFolder() {
        let documentsFolder = electron_1.app.getPath('documents');
        let eaFolder = path_1.default.join(documentsFolder, "Electronic Arts");
        if (!fs.existsSync(eaFolder))
            return "";
        //Quick 
        let en = path_1.default.join(eaFolder, "The Sims 4");
        let de = path_1.default.join(eaFolder, "Die Sims 4");
        let fr = path_1.default.join(eaFolder, "Les Sims 4");
        let es = path_1.default.join(eaFolder, "Los Sims 4");
        if (fs.existsSync(en))
            return en;
        if (fs.existsSync(de))
            return de;
        if (fs.existsSync(fr))
            return fr;
        if (fs.existsSync(es))
            return es;
        let folders = fs.readdirSync(eaFolder);
        for (let index = 0; index < folders.length; index++) {
            const elementName = folders[index];
            if (elementName.toLowerCase().endsWith("sims 4")) {
                return path_1.default.join(eaFolder, elementName);
            }
        }
        return "";
    }
    searchForModFolder(simsDataFolder) {
        if (simsDataFolder == "")
            return "";
        let modsFolder = path_1.default.join(simsDataFolder, "Mods");
        if (fs.existsSync(modsFolder))
            return modsFolder;
        return "";
    }
    searchForGameFolder() {
        let isMac = process.platform === 'darwin';
        let isWin = process.platform === 'win32';
        if (!isMac && !isWin)
            return "";
        let possibleFolders = [];
        if (isMac) {
            //MacOS
            let home = electron_1.app.getPath('home');
            possibleFolders = [
                "/Applications/EA Games/",
                "/Applications/Origin Games/",
                path_1.default.join(home, "Applications"),
                path_1.default.join(home, "Applications", "EA Games"),
            ];
        }
        else {
            possibleFolders = [
                "C:\\Program Files\\Origin Games\\The Sims 4",
                "C:\\Program Files (x86)\\Origin Games\\The Sims 4",
                "C:\\Program Files\\EA Games\\The Sims 4",
                "C:\\Program Files (x86)\\EA Games\\The Sims 4",
                "C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Sims 4",
                "C:\\Program Files\\Steam\\steamapps\\common\\The Sims 4"
            ];
        }
        for (let index = 0; index < possibleFolders.length; index++) {
            const element = possibleFolders[index];
            if (fs.existsSync(element) && isWin) {
                return element;
            }
            else if (fs.existsSync(element)) {
                let sims4App = path_1.default.join(element, "The Sims 4.app");
                if (fs.existsSync(sims4App)) {
                    return path_1.default.join(element, "The Sims 4.app", "Contents");
                }
            }
        }
        return "";
    }
    async changePath(id, event) {
        //0 - Mod folder
        //1 - Sims documents folder
        //2 - Sims Game folder
        //3 - S4S folder
        if (id == undefined || id < 0 || id > 3)
            throw new Error("Invalid ID for change path");
        let obj = {
            folderpath: undefined,
            error: true
        };
        //Set default path to documents folder
        let defaultPath = electron_1.app.getPath('documents');
        if (id == 2 && fs.existsSync("C:\\Program Files (x86)")) {
            defaultPath = "C:\\Program Files (x86)";
        }
        let filters = [];
        if (id == 3 && process.platform === 'darwin') {
            filters.push({ name: "Application", extensions: ["app"] });
        }
        else if (id == 3 && process.platform === 'win32') {
            filters.push({ name: "Application", extensions: ["exe"] });
        }
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            return { error: true, message: "No sender" };
        let folder = await electron_1.dialog.showOpenDialog(browserWindow, {
            properties: [id == 3 ? "openFile" : "openDirectory"],
            title: "Select a folder/file",
            defaultPath: defaultPath,
            filters: filters
        });
        if (folder && folder.filePaths && folder.filePaths.length == 1) {
            obj.error = false;
            obj.folderpath = folder.filePaths[0];
            if (id == 2) {
                if (process.platform === 'darwin')
                    obj.folderpath = path_1.default.join(obj.folderpath, "Contents");
                if (!this.checkGameFolderSimple(obj.folderpath)) {
                    obj.error = true;
                    obj.message = "Invalid game folder selected";
                    return obj;
                }
            }
        }
        return obj;
    }
    checkGameFolderSimple(folderpath) {
        if (!fs.existsSync(folderpath))
            return false;
        let data = folderpath + path_1.default.sep + "Data";
        let delta = folderpath + path_1.default.sep + "Delta";
        if (!fs.existsSync(data))
            return false;
        if (!fs.existsSync(delta))
            return false;
        return true;
    }
}
exports.SettingsController = SettingsController;
