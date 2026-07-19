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
exports.LanguageService = exports.LanguageController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const https = __importStar(require("https"));
const form_data_1 = __importDefault(require("form-data"));
const axios_1 = __importDefault(require("axios"));
class LanguageController {
    constructor(main) {
        this.LANGUAGELISTPHPURL = "https://api.gametimedev.de/S4MM/language/languages.php";
        this.LANGUAGEUPLOADPHPURL = "https://api.gametimedev.de/S4MM/language/upload.php";
        this.LANGUAGEUPLOADCCTESTPHPURL = "https://api.gametimedev.de/S4MM/language/uploadToCCSwiperTest.php";
        this.mainWindow = null;
        this.readyToShow = false;
        this.onReadyToShow = null;
        this.onDidFailLoad = null;
        this.onlineResult = [];
        this.onlineChecked = false;
        this.mainApp = main;
        LanguageService.setInstance(this);
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.on("language-controller", (event, data) => {
            if (data.action == "save-file") {
                this.saveTranslationFile(data.translation, data.name);
            }
        });
        electron_1.ipcMain.handle('language-controller', async (event, data) => {
            if (data.action == "update-languages") {
                return this.updateLanguages();
            }
            else if (data.action == "get-local-languages") {
                return this.getLocalLanguages();
            }
            else if (data.action == "get-combined-languages") {
                return await this.getCombindedLanguages();
            }
            else if (data.action == "download-language" && data.url && data.filename) {
                return await this.downloadLanguage(data.url, data.filename);
            }
            else if (data.action == "get-language-content" && data.filepath) {
                return this.getLanguageContent(data.filepath);
            }
            else if (data.action == "save-translation-file" && data.translation) {
                return await this.saveTranslationFile(event, data.translation, data.name);
            }
            else if (data.action == "open-translation-file") {
                return await this.openTranslationFile(event);
            }
            else if (data.action == "upload-translation" && data.translation && data.info) {
                return await this.uploadTranslation(data.translation, data.info, data.ccswiper);
            }
            throw new Error("Unknown action: " + data.action);
        });
        /*this.getOnlineLanguages().then((languages:any) => {
            console.log("Languages: ", languages);
        });*/
    }
    getLocalLanguage(filename) {
        let languagesFolder = this.mainApp.folderStructureController.getFolder("languages");
        if (!languagesFolder || !fs.existsSync(languagesFolder)) {
            console.error("Languages folder not found: ", languagesFolder);
            return undefined;
        }
        let filepath = path_1.default.join(languagesFolder, filename);
        if (!fs.existsSync(filepath)) {
            console.error("Language file not found: ", filepath);
            return undefined;
        }
        let file = fs.readFileSync(filepath, 'utf8');
        let json = JSON.parse(file);
        return json;
    }
    getLocalLanguages() {
        let items = [];
        let uniqueItems = new Map();
        let languagesFolder = this.mainApp.folderStructureController.getFolder("languages");
        if (!languagesFolder || !fs.existsSync(languagesFolder)) {
            console.error("Languages folder not found: ", languagesFolder);
            return items;
        }
        let files = fs.readdirSync(languagesFolder);
        //Filter for only json file with a name that splits into 5 parts using "."
        files = files.filter((file) => {
            return file.endsWith(".json") && file.split(".").length == 5;
        });
        files.forEach((file) => {
            let fileParts = file.split(".");
            let english = fileParts[0];
            let native = fileParts[1];
            let createdAt = parseInt(fileParts[2]);
            let author = fileParts[3];
            let key = `${english}-${author}`;
            let obj = {
                key: key,
                english: english,
                native: native,
                createdAt: createdAt,
                author: author,
                file: file,
                filepath: path_1.default.join(languagesFolder, file),
            };
            if (!uniqueItems.has(key) || uniqueItems.get(key).createdAt < createdAt) {
                uniqueItems.set(key, obj);
            }
        });
        return Array.from(uniqueItems.values());
    }
    async getOnlineLanguages(forceReload = false) {
        if (this.onlineResult.length > 0 && !forceReload) {
            return new Promise((resolve) => {
                resolve(this.onlineResult);
            });
        }
        else {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Request timed out after 30 seconds'));
                }, 30000);
                const request = https.get(this.LANGUAGELISTPHPURL, (response) => {
                    clearTimeout(timeout);
                    if (response.statusCode < 200 || response.statusCode > 299) {
                        reject(new Error('Failed to load page, status code: ' + response.statusCode));
                    }
                    const body = [];
                    response.on('data', (chunk) => body.push(chunk));
                    response.on('end', () => resolve(this.onlineLanguageJsonToArray(body.join(''))));
                });
                request.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });
        }
    }
    onlineLanguageJsonToArray(jsonString) {
        let items = [];
        let uniqueItems = new Map();
        try {
            const json = JSON.parse(jsonString);
            let base = json.base;
            let files = json.files;
            if (!base || !files)
                throw new Error("Invalid JSON structure: Missing 'base' or 'files' property.");
            files.forEach((file) => {
                let fileParts = file.split(".");
                if (fileParts.length != 5)
                    return;
                let english = fileParts[0];
                let native = fileParts[1];
                let createdAt = parseInt(fileParts[2]);
                let author = fileParts[3];
                let key = `${english}-${author}`;
                let obj = {
                    key: key,
                    english: english,
                    native: native,
                    createdAt: createdAt,
                    author: author,
                    file: file,
                    url: base + file,
                };
                if (!uniqueItems.has(key) || uniqueItems.get(key).createdAt < createdAt) {
                    uniqueItems.set(key, obj);
                }
            });
            items = Array.from(uniqueItems.values());
        }
        catch (error) {
            console.error("Error parsing JSON:", error);
        }
        return items;
    }
    async updateLanguages() {
        console.log("[LANGUAGE] Update languages started");
        let items = await this.getCombindedLanguages();
        //console.log("Combined languages: ", items);
        let needsUpdate = items.filter((item) => {
            return item.updateAvailable == true;
        });
        for (let i = 0; i < needsUpdate.length; i++) {
            let item = needsUpdate[i];
            console.log("Updating language: ", item);
            await this.updateLanguageFile(item);
        }
        console.log("[LANGUAGE] Update languages finished");
    }
    async getCombindedLanguages() {
        let items = [];
        //Online
        try {
            let result = await this.getOnlineLanguages(false);
            this.onlineResult = result;
        }
        catch (error) {
            console.log("Error getting online languages: ");
            console.log(error);
        }
        this.onlineChecked = true;
        //Local
        let localLanguages = this.getLocalLanguages();
        //Combine
        let onlineMap = new Map();
        this.onlineResult.forEach((item) => {
            onlineMap.set(item.key, item);
        });
        localLanguages.forEach((item) => {
            let onlineItem = onlineMap.get(item.key);
            if (onlineItem) {
                item.local = {
                    createdAt: item.createdAt,
                    file: item.file,
                };
                item.online = {
                    createdAt: onlineItem.createdAt,
                    file: onlineItem.file,
                };
                item.url = onlineItem.url;
                item.updateAvailable = false;
                if (item.local.createdAt > item.online.createdAt) {
                    //Local is newer
                }
                else if (item.local.createdAt == item.online.createdAt) {
                    //Same version
                }
                else {
                    //Online is newer
                    item.updateAvailable = true;
                    item.createdAt = item.online.createdAt;
                }
                items.push(item);
                onlineMap.delete(item.key);
            }
            else {
                items.push(item);
            }
        });
        //Add online only items
        Array.from(onlineMap.values()).forEach((item) => {
            items.push(item);
        });
        items.forEach((item) => {
            this.extendLanuageItem(item);
        });
        return items;
    }
    async updateLanguageFile(item) {
        //Prepare folders
        let languagesFolder = this.mainApp.folderStructureController.getFolder("languages");
        if (!languagesFolder || !fs.existsSync(languagesFolder)) {
            console.error("Languages folder not found: ", languagesFolder);
            return;
        }
        let newFile = path_1.default.join(languagesFolder, item.online.file);
        let oldFile = path_1.default.join(languagesFolder, item.local.file);
        //Download new file
        let url = item.url;
        try {
            await this.downloadFile(url, newFile);
        }
        catch (error) {
            console.log("Error downloading file: ", error);
            return;
        }
        //Check if file exists and delete old file
        if (fs.existsSync(oldFile) && fs.existsSync(newFile)) {
            fs.unlinkSync(oldFile);
            console.log("Deleted old file: ", oldFile);
        }
        //Update users settings if needed
        let settings = this.mainApp.settings;
        let languagePath = settings.s_language_path;
        if (languagePath && languagePath != "" && languagePath == oldFile) {
            settings.s_language_path = newFile;
            this.mainApp.settingsController.saveSettings(settings);
            console.log("Updated settings with new language file: ", newFile);
        }
    }
    async downloadFile(url, dest) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest, { flags: "w" });
            const request = https.get(url, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                }
                else {
                    file.close();
                    fs.unlink(dest, () => { }); // Delete temp file
                    reject(new Error(`Server responded with ${response.statusCode}: ${response.statusMessage}`));
                }
            });
            request.on("error", (err) => {
                file.close();
                fs.unlink(dest, () => { }); // Delete temp file
                reject(new Error(`Request error: ${err.message}`));
            });
            file.on("finish", () => {
                file.close(); // Ensure the file is properly closed
                resolve();
            });
            file.on("error", (err) => {
                file.close();
                fs.unlink(dest, () => { }); // Delete temp file
                reject(new Error(`File write error: ${err.message}`));
            });
            request.setTimeout(30000, () => {
                request.destroy();
                file.close();
                fs.unlink(dest, () => { }); // Delete temp file
                reject(new Error("Request timed out after 30 seconds"));
            });
        });
    }
    extendLanuageItem(item) {
        if (!item || item.english == undefined)
            return;
        let en = item.english.toLowerCase();
        switch (en) {
            case "italian":
                item.emoji = "🇮🇹";
                item.flag = "1F1EE-1F1F9.svg";
                item.locale = "it";
                break;
            case "russian":
                item.emoji = "🇷🇺";
                item.flag = "1F1F7-1F1FA.svg";
                item.locale = "ru";
                break;
            case "german":
                item.emoji = "🇩🇪";
                item.flag = "1F1E9-1F1EA.svg";
                item.locale = "de";
                break;
            case "japanese":
                item.emoji = "🇯🇵";
                item.flag = "1F1EF-1F1F5.svg";
                item.locale = "ja";
                break;
            case "chinese":
                item.emoji = "🇨🇳";
                item.flag = "1F1E8-1F1F3.svg";
                item.locale = "zh";
                break;
            case "chinese (simplified)":
                item.emoji = "🇨🇳";
                item.flag = "1F1E8-1F1F3.svg";
                item.locale = "zh";
                break;
            case "korean":
                item.emoji = "🇰🇷";
                item.flag = "1F1F0-1F1F7.svg";
                item.locale = "ko";
                break;
            case "polish":
                item.emoji = "🇵🇱";
                item.flag = "1F1F5-1F1F1.svg";
                item.locale = "pl";
                break;
            case "french":
                item.emoji = "🇫🇷";
                item.flag = "1F1EB-1F1F7.svg";
                item.locale = "fr";
                break;
            case "spanish":
                item.emoji = "🇪🇸";
                item.flag = "1F1EA-1F1F8.svg";
                item.locale = "es";
                break;
            case "portuguese":
                item.emoji = "🇧🇷";
                item.flag = "1F1E7-1F1F7.svg";
                item.locale = "pt";
                break;
            case "turkish":
                item.emoji = "🇹🇷";
                item.flag = "1F1F9-1F1F7.svg";
                item.locale = "tr";
                break;
            case "swedish":
                item.emoji = "🇸🇪";
                item.flag = "1F1F8-1F1EA.svg";
                item.locale = "sv";
                break;
            case "brazilian portuguese":
                item.emoji = "🇧🇷";
                item.flag = "1F1E7-1F1F7.svg";
                item.locale = "pt-BR";
                break;
            case "norwegian":
                item.emoji = "🇳🇴";
                item.flag = "1F1F3-1F1F4.svg";
                item.locale = "no";
                break;
            case "slovensky":
                item.emoji = "🇸🇰";
                item.flag = "1F1F8-1F1F0.svg";
                item.locale = "sk";
                break;
            case "traditional chinese (taiwan)":
                item.emoji = "🇹🇼";
                item.flag = "1F1F9-1F1FC.svg";
                item.locale = "zh-TW";
                break;
            case "ukrainian":
                item.emoji = "🇺🇦";
                item.flag = "1F1FA-1F1E6.svg";
                item.locale = "uk";
                break;
            case "thai":
                item.emoji = "🇹🇭";
                item.flag = "1F1F9-1F1ED.svg";
                item.locale = "th";
                break;
            default:
                item.emoji = "-";
                item.flag = "2754.svg";
                item.locale = "-";
                break;
        }
    }
    async downloadLanguage(url, filename) {
        let languagesFolder = this.mainApp.folderStructureController.getFolder("languages");
        if (!languagesFolder || !fs.existsSync(languagesFolder))
            throw new Error("Languages folder not found: " + languagesFolder);
        let filepath = path_1.default.join(languagesFolder, filename);
        await this.downloadFile(url, filepath);
        if (!fs.existsSync(filepath)) {
            throw new Error("File not found: " + filepath);
        }
        let combinedLanguages = await this.getCombindedLanguages();
        return {
            success: true,
            combinedLanguages: combinedLanguages,
            filepath: filepath
        };
    }
    getLanguageContent(filepath) {
        if (!fs.existsSync(filepath))
            throw new Error("File not found: " + filepath);
        let file = fs.readFileSync(filepath, 'utf8');
        let json = JSON.parse(file);
        return json;
    }
    async saveTranslationFile(event, translation, name = undefined) {
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            throw new Error("No sender");
        let languagesFolder = this.mainApp.folderStructureController.getFolder("languages");
        if (!languagesFolder || !fs.existsSync(languagesFolder))
            languagesFolder = electron_1.app.getPath("documents");
        if (name)
            languagesFolder = path_1.default.join(languagesFolder, name);
        let folder = await electron_1.dialog.showSaveDialog(browserWindow, {
            title: "Save translation",
            defaultPath: languagesFolder,
            filters: [
                { name: 'JSON', extensions: ['json'] },
            ]
        });
        if (folder && folder.filePath) {
            let filepath = folder.filePath;
            if (!filepath.endsWith(".json")) {
                filepath += ".json";
            }
            fs.writeFileSync(filepath, JSON.stringify(translation, null, 4), 'utf8');
            console.log("Saved translation to: ", filepath);
            return true;
        }
        else {
            console.error("No file selected or error saving file.");
            return false;
        }
    }
    async openTranslationFile(event) {
        const browserWindow = electron_1.BrowserWindow.fromWebContents(event.sender) || undefined;
        if (!browserWindow)
            throw new Error("No sender");
        let languagesFolder = this.mainApp.folderStructureController.getFolder("languages");
        if (!languagesFolder || !fs.existsSync(languagesFolder))
            languagesFolder = electron_1.app.getPath("documents");
        let folder = await electron_1.dialog.showOpenDialog(browserWindow, {
            title: "Open translation",
            defaultPath: languagesFolder,
            properties: ['openFile'],
            filters: [
                { name: 'JSON', extensions: ['json'] },
            ]
        });
        if (folder && folder.filePaths && folder.filePaths.length > 0) {
            let filepath = folder.filePaths[0];
            if (!filepath.endsWith(".json")) {
                throw new Error("File is not a json file: " + filepath);
            }
            let file = fs.readFileSync(filepath, 'utf8');
            let json = JSON.parse(file);
            return json;
        }
        else {
            console.error("No file selected or error opening file.");
            return undefined;
        }
    }
    async uploadTranslation(translation, info, ccswiper) {
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        if (!tmpFolder || !fs.existsSync(tmpFolder))
            throw new Error("Tmp folder not found: " + tmpFolder);
        let time = Math.floor(Date.now() / 1000);
        let id = this.makeid(8);
        let fileName = time + "_" + id + ".json";
        let complete = {
            "info": info,
            "translation": translation
        };
        let tmpFilePath = path_1.default.join(tmpFolder, fileName);
        fs.writeFileSync(tmpFilePath, JSON.stringify(complete, null, 4), 'utf8');
        console.log("Saved translation to: ", tmpFilePath);
        let formData = new form_data_1.default();
        formData.append('file', fs.createReadStream(tmpFilePath));
        try {
            await (0, axios_1.default)({
                method: "post",
                url: ccswiper == true ? this.LANGUAGEUPLOADCCTESTPHPURL : this.LANGUAGEUPLOADPHPURL,
                data: formData,
                headers: { "Content-Type": "multipart/form-data" },
            });
            console.log("File uploaded successfully: ", tmpFilePath);
            fs.unlinkSync(tmpFilePath); // Delete the temp file after upload
            return {
                success: true
            };
        }
        catch (error) {
            console.error("Error uploading file: ", error);
            return {
                success: false,
                error: error
            };
        }
    }
    makeid(length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXY';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
}
exports.LanguageController = LanguageController;
class LanguageService {
    static setInstance(instance) {
        this.instance = instance;
    }
    static setLanguageFile(file) {
        if (!this.instance)
            return;
        if (!fs.existsSync(file))
            return;
        if (file == this.loadedLanguage?.file)
            return;
        try {
            let data = fs.readFileSync(file, 'utf8');
            let obj = JSON.parse(data);
            this.loadedLanguage = {
                file: file,
                data: obj
            };
            console.log("[LANGUAGE-TRANSLATE] Loaded language file: ", file);
        }
        catch (error) {
            console.log(error);
        }
    }
    static get(value, fallback = "") {
        if (!this.instance)
            return fallback;
        if (!this.loadedLanguage || !value || value.trim().length == 0)
            return fallback;
        let parts = value.split(".");
        let result = this.getByValue(this.loadedLanguage.data, parts);
        if (result)
            return result;
        return fallback;
    }
    static getByValue(obj, arr) {
        try {
            let value = arr[0];
            arr.splice(0, 1);
            let nObj = obj[value];
            if (nObj && arr.length > 0) {
                return this.getByValue(nObj, arr);
            }
            else if ((typeof nObj) == (typeof "")) {
                return nObj;
            }
            else {
                return undefined;
            }
        }
        catch (error) {
            return undefined;
        }
    }
}
exports.LanguageService = LanguageService;
LanguageService.loadedLanguage = undefined;
