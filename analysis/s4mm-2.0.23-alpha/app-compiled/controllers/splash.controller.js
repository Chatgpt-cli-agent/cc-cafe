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
exports.SplashController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DBPFReader_1 = require("../sims/DBPFReader");
class SplashController {
    constructor(mainApp) {
        this.splashWindow = null;
        this.isStillActive = true;
        this.mainApp = mainApp;
        this.initIPC();
    }
    showSplash() {
        let isTesting = false;
        this.splashWindow = new electron_1.BrowserWindow({
            width: (isTesting ? 2 : 1) * 570,
            height: (isTesting ? 2 : 1) * 300,
            frame: false,
            alwaysOnTop: true,
            transparent: true,
            icon: __dirname + '/icon.ico',
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
        });
        let ref = this;
        this.splashWindow.on('close', function (e) {
            if (ref.isStillActive) {
                electron_1.app.quit();
            }
            ref.splashWindow = null;
        });
        this.splashWindow.loadFile('./views/splash/browser/index.html');
        this.splashWindow.on("ready-to-show", () => {
            if (this.splashWindow && isTesting)
                this.splashWindow.webContents.openDevTools();
        });
    }
    closeSplash() {
        if (this.splashWindow) {
            if (!this.splashWindow.isDestroyed()) {
                this.isStillActive = false;
                this.splashWindow.close();
                this.splashWindow = null;
                console.log("[SPLASH-CONTROLLER] Splash window closed successfully.");
            }
            else {
                console.warn("Attempted to close a splash window that was already destroyed.");
                this.splashWindow = null;
                this.isStillActive = false;
                console.log("[SPLASH-CONTROLLER] Splash window was already destroyed, setting to null.");
            }
        }
        else {
            console.log("[SPLASH-CONTROLLER] No splash window to close.");
        }
    }
    initIPC() {
        electron_1.ipcMain.on("splash-controller", (event, data) => {
            if (data.action == "splash-finished") {
                this.closeSplashAndStartMain();
            }
            else if (data.action == "splash-close") {
                this.closeSplash();
            }
        });
        electron_1.ipcMain.handle("splash-controller", async (event, data) => {
            if (data.action == "set-new-mod-folder")
                return this.setNewModFolder(data.modFolderPath);
            if (data.action == "get-mood-images")
                return this.extractMoodImages(data.options);
            if (data.action == "get-screenshots")
                return this.getScreenshots(data.options);
            if (data.action == "prepare-main-window") {
                return await this.prepareMainWindow();
            }
            throw new Error("Unknown action");
        });
    }
    startApp() {
        this.showSplash();
    }
    setNewModFolder(modFolderPath) {
        if (!modFolderPath || modFolderPath.length == 0 || !fs.existsSync(modFolderPath))
            return false;
        this.mainApp.settings.s_path_mod = modFolderPath;
        this.mainApp.settingsController.saveSettings(this.mainApp.settings);
        return true;
    }
    async closeSplashAndStartMain() {
        console.log("[SPLASH-CONTROLLER] Attempting to close splash and start main window...");
        if (this.splashWindow && this.mainApp.mainWindowController.readyToShow) {
            try {
                console.log("[SPLASH-CONTROLLER] Splash window exists and main window is ready to show. Closing splash...");
                this.closeSplash();
                //Wait for 2s to ensure splash is closed
                await new Promise(resolve => setTimeout(resolve, 250));
                console.log("[SPLASH-CONTROLLER] Showing main window...");
                this.mainApp.mainWindowController.showMainWindow();
                console.log("[SPLASH-CONTROLLER] Calling mainAppIsReady...");
                this.mainApp.mainAppIsReady();
            }
            catch (error) {
                console.error("Error while closing splash and starting main window:", error);
                if (this.splashWindow && !this.splashWindow.isDestroyed()) {
                    this.splashWindow.webContents.send("splash-controller", { action: "show-error", message: "Failed to start main window" });
                }
            }
        }
        else {
            console.warn("[SPLASH-CONTROLLER] Splash window or main window not ready. Retrying in 100ms...");
            console.log("[SPLASH-CONTROLLER] Splash window exists:", this.splashWindow !== null);
            console.log("[SPLASH-CONTROLLER] Main window ready to show:", this.mainApp.mainWindowController.readyToShow);
            setTimeout(() => {
                this.closeSplashAndStartMain();
            }, 100);
        }
    }
    async prepareMainWindow() {
        //this.mainApp.mainWindowController.onReadyToShow = () => {};
        //this.mainApp.mainWindowController.onDidFailLoad = () => {};
        //this.mainApp.mainWindowController.loadMainWindow();
        //Return as promise
        return new Promise((resolve, reject) => {
            this.mainApp.mainWindowController.onReadyToShow = () => {
                resolve({ success: true });
            };
            this.mainApp.mainWindowController.onDidFailLoad = () => {
                reject({ success: false });
            };
            this.mainApp.mainWindowController.loadMainWindow();
        });
    }
    //Fun
    async extractMoodImages(options) {
        let images = [];
        //Options
        let defMoodsList = [
            0xc2, 0xd2, 0xf2, 0x102, 0x132, 0x152, 0x162, 0x172, //Happy
            0xa2, // Ashamed
            0x1c2, //Frustrated
            0x1e2, // Anoyed/Sad
            0x82, // Confused/Crazy
            0x92, // Unwell
            0x12, // Angry
            0xb2 //Shocked
        ];
        let defMaxCount = 10;
        if (options && options.moodsList)
            defMoodsList = options.moodsList;
        if (options && options.maxCount)
            defMaxCount = options.maxCount;
        let moodSet = new Set(defMoodsList);
        //Mood folder
        let moodFolder = this.mainApp.folderStructureController.getFolder("mood-images");
        //File check
        let simsDataFolder = this.mainApp.settings.s_game_documents;
        if (simsDataFolder.length == 0 || !fs.existsSync(simsDataFolder))
            return images;
        let localThumbCache = path.join(simsDataFolder, "localthumbcache.package");
        if (!fs.existsSync(localThumbCache)) {
            //Check for old images
            let files = fs.readdirSync(moodFolder);
            for (let index = 0; index < files.length; index++) {
                const element = files[index];
                if (element.startsWith("s4mm_mood_") && element.endsWith(".png")) {
                    let file = path.join(moodFolder, element);
                    images.push(file);
                }
            }
            return images.splice(0, defMaxCount);
        }
        //Delet old images stat start with "s4mm_mood_"
        let filePrefix = "s4mm_mood_";
        let files = fs.readdirSync(moodFolder);
        for (let index = 0; index < files.length; index++) {
            const element = files[index];
            if (element.startsWith(filePrefix) && element.endsWith(".png")) {
                let file = path.join(moodFolder, element);
                fs.unlinkSync(file);
            }
        }
        //Read file
        try {
            let pack = new DBPFReader_1.Pack(localThumbCache);
            pack.checkFile();
            if (pack.error)
                throw new Error("Internal package file error");
            pack.calculateIndexList();
            //Get moods
            let allMoods = [];
            for (let index = 0; index < pack.index_List.length; index++) {
                const element = pack.index_List[index];
                if (element.r_type == 0x16CCF748 && moodSet.has(element.r_group)) {
                    allMoods.push(element);
                }
            }
            //Get random moods 
            let moods = [];
            while (moods.length < defMaxCount && allMoods.length > 0) {
                let index = Math.floor(Math.random() * allMoods.length);
                moods.push(allMoods[index]);
                allMoods.splice(index, 1);
            }
            //Extract images
            for (let index = 0; index < moods.length; index++) {
                const element = moods[index];
                let buffer = element.getByteArray();
                let name = filePrefix + element.getKey().split("-").join("_") + ".png";
                let image = path.join(moodFolder, name);
                await DBPFReader_1.PackHandler.saveBufferToFile(image, buffer, true);
                if (fs.existsSync(image))
                    images.push(image);
            }
        }
        catch (error) {
            console.log(error);
        }
        return images;
    }
    async getScreenshots(options) {
        let images = [];
        let defLimit = undefined;
        if (options && options.limit)
            defLimit = options.limit;
        //Get Folder
        let simsDataFolder = this.mainApp.settings.s_game_documents;
        if (simsDataFolder.length == 0 || !fs.existsSync(simsDataFolder))
            return images;
        let screenshotsFolder = path.join(simsDataFolder, "screenshots");
        if (!fs.existsSync(screenshotsFolder))
            return images;
        //Get files
        let files = fs.readdirSync(screenshotsFolder);
        let imageFiles = files.filter((file) => { return file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg"); });
        images = imageFiles.map((file) => { return path.join(screenshotsFolder, file); });
        if (defLimit == undefined)
            return images;
        let randomImages = [];
        while (randomImages.length < defLimit && images.length > 0) {
            let index = Math.floor(Math.random() * images.length);
            randomImages.push(images[index]);
            images.splice(index, 1);
        }
        return randomImages;
    }
}
exports.SplashController = SplashController;
