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
exports.MainWindowController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const LanguageHelper_1 = require("../utils/LanguageHelper");
const IPCExtras_1 = require("../utils/IPCExtras");
class MainWindowController {
    constructor(main) {
        this.showDev = false;
        this.mainWindow = null;
        this.readyToShow = false;
        this.onReadyToShow = null;
        this.onDidFailLoad = null;
        this.isLoaded = false;
        this.lastWindowBounds = null;
        this.lastPrimaryDisplaySize = null;
        this.isClosing = false;
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.on("main-window", (event, data) => {
            if (data && data.action == "close-app") {
                this.closeEverything();
            }
        });
        electron_1.ipcMain.on("titlebar", (event, data) => {
            if (data == "0")
                this.mainWindow?.minimize();
            if (data == "1")
                this.mainWindow?.maximize();
            if (data == "2")
                this.closeEverything();
            if (data == "fullscreen") {
                if (this.mainWindow?.isFullScreen()) {
                    this.mainWindow?.setFullScreen(false);
                }
                else {
                    this.mainWindow?.setFullScreen(true);
                }
            }
        });
        electron_1.ipcMain.handle("main-window", async (event, data) => {
            if (data && data.action == "get-start-bundle")
                return await this.getStartInfoBundle();
            throw new Error("No valid action or paramerter");
        });
        electron_1.ipcMain.handle('get-file-path', (event, file) => {
            return file.path; // Return the file path
        });
    }
    async loadMainWindow() {
        if (this.mainWindow != null)
            throw new Error("Main Window already exists");
        let preloadPath = path_1.default.join(__dirname, '../preloads/main-preload.js');
        // Load last window state from settings
        let winOptions = {
            width: 1165,
            height: 720,
            minWidth: 1120,
            minHeight: 669,
            autoHideMenuBar: true,
            frame: false,
            show: false,
            icon: __dirname + '/icon.ico',
            webPreferences: {
                preload: preloadPath,
                nodeIntegration: false,
                contextIsolation: true,
            },
        };
        let screenInfo = await this.restoreWindowState();
        if (screenInfo.width && screenInfo.height) {
            winOptions.width = screenInfo.width;
            winOptions.height = screenInfo.height;
        }
        if (screenInfo.x !== undefined && screenInfo.y !== undefined) {
            winOptions.x = screenInfo.x;
            winOptions.y = screenInfo.y;
        }
        this.mainWindow = new electron_1.BrowserWindow(winOptions);
        // Restore maximized state if needed
        console.log("[MAIN-WINDOW] Maximized state:", screenInfo.maximized);
        if (screenInfo.maximized) {
            this.mainWindow.once('focus', () => {
                console.log("[MAIN-WINDOW] Restoring maximized state...");
                this.mainWindow.maximize();
            });
        }
        this.mainWindow.loadFile('./views/main/index.html');
        this.mainWindow.webContents.on('did-fail-load', () => {
            console.log('[ERROR] Did fail load main window');
            if (this.onDidFailLoad)
                this.onDidFailLoad();
        });
        // Track window move, resize, maximize, unmaximize
        this.intiWindowTracking();
        this.mainWindow.on('ready-to-show', async () => {
            this.readyToShow = true;
            setTimeout(() => {
                if (this.onReadyToShow)
                    this.onReadyToShow();
            }, 200);
        });
    }
    intiWindowTracking() {
        if (this.mainWindow == null)
            throw new Error("Main Window not loaded");
        this.mainWindow.on('move', async () => {
            let bounds = this.mainWindow.getBounds();
            const { screen } = require('electron');
            let primaryDisplay = screen.getPrimaryDisplay();
            this.lastPrimaryDisplaySize = primaryDisplay.size;
            this.lastWindowBounds = bounds;
        });
        this.mainWindow.on('resize', async () => {
            let bounds = this.mainWindow.getBounds();
            const { screen } = require('electron');
            let primaryDisplay = screen.getPrimaryDisplay();
            this.lastPrimaryDisplaySize = primaryDisplay.size;
            this.lastWindowBounds = bounds;
        });
        // Save maximized state
        this.mainWindow.on('maximize', async () => {
            let knex = this.mainApp.databaseController.getKnex();
            if (knex) {
                await knex('KeyData').where({ key: 'window_maximized' }).del();
                await knex('KeyData').insert({ key: 'window_maximized', value: '1' });
            }
        });
        this.mainWindow.on('unmaximize', async () => {
            let knex = this.mainApp.databaseController.getKnex();
            if (knex) {
                await knex('KeyData').where({ key: 'window_maximized' }).del();
                await knex('KeyData').insert({ key: 'window_maximized', value: '0' });
            }
        });
        this.mainWindow.on('close', async () => {
            this.closeEverything();
        });
    }
    async saveWindowState() {
        console.log("[MAIN-WINDOW] Saving window state...");
        if (this.lastPrimaryDisplaySize == null || this.lastWindowBounds == null)
            return;
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        //Insert or update values in database
        let window_x = this.lastWindowBounds.x;
        let window_y = this.lastWindowBounds.y;
        let window_width = this.lastWindowBounds.width;
        let window_height = this.lastWindowBounds.height;
        let display_width = this.lastPrimaryDisplaySize.width;
        let display_height = this.lastPrimaryDisplaySize.height;
        await knex('KeyData').where({ key: 'window_x' }).del();
        await knex('KeyData').insert({ key: 'window_x', value: window_x.toString() });
        await knex('KeyData').where({ key: 'window_y' }).del();
        await knex('KeyData').insert({ key: 'window_y', value: window_y.toString() });
        await knex('KeyData').where({ key: 'window_width' }).del();
        await knex('KeyData').insert({ key: 'window_width', value: window_width.toString() });
        await knex('KeyData').where({ key: 'window_height' }).del();
        await knex('KeyData').insert({ key: 'window_height', value: window_height.toString() });
        await knex('KeyData').where({ key: 'display_width' }).del();
        await knex('KeyData').insert({ key: 'display_width', value: display_width.toString() });
        await knex('KeyData').where({ key: 'display_height' }).del();
        await knex('KeyData').insert({ key: 'display_height', value: display_height.toString() });
        // Save maximized state
        if (this.mainWindow && this.mainWindow.isMaximized()) {
            await knex('KeyData').where({ key: 'window_maximized' }).del();
            await knex('KeyData').insert({ key: 'window_maximized', value: '1' });
        }
        else {
            await knex('KeyData').where({ key: 'window_maximized' }).del();
            await knex('KeyData').insert({ key: 'window_maximized', value: '0' });
        }
        console.log("[MAIN-WINDOW] Window state saved.");
    }
    async restoreWindowState() {
        console.log("[MAIN-WINDOW] Restoring window state...");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not initialized");
        let window_x = undefined;
        ;
        let window_y = undefined;
        let window_width = undefined;
        let window_height = undefined;
        let display_width = undefined;
        let display_height = undefined;
        let row = await knex('KeyData').where({ key: 'window_x' }).first();
        if (row)
            window_x = parseInt(row.value);
        row = await knex('KeyData').where({ key: 'window_y' }).first();
        if (row)
            window_y = parseInt(row.value);
        row = await knex('KeyData').where({ key: 'window_width' }).first();
        if (row)
            window_width = parseInt(row.value);
        row = await knex('KeyData').where({ key: 'window_height' }).first();
        if (row)
            window_height = parseInt(row.value);
        row = await knex('KeyData').where({ key: 'display_width' }).first();
        if (row)
            display_width = parseInt(row.value);
        row = await knex('KeyData').where({ key: 'display_height' }).first();
        if (row)
            display_height = parseInt(row.value);
        // Maximized state
        let maximized = true;
        row = await knex('KeyData').where({ key: 'window_maximized' }).first();
        //if(row && row.value === '1') maximized = true;
        if (row && row.value === '0')
            maximized = false;
        console.log("[MAIN-WINDOW] Window state restored.");
        //Check if display size has changed
        const { screen } = require('electron');
        let primaryDisplay = screen.getPrimaryDisplay();
        let currentDisplayWidth = primaryDisplay.size.width;
        let currentDisplayHeight = primaryDisplay.size.height;
        if (display_width !== currentDisplayWidth || display_height !== currentDisplayHeight) {
            //Return default if display size has changed
            return {
                x: undefined,
                y: undefined,
                width: undefined,
                height: undefined,
                maximized: true
            };
        }
        return {
            x: window_x,
            y: window_y,
            width: window_width,
            height: window_height,
            maximized: maximized
        };
    }
    showMainWindow() {
        if (this.mainWindow == null)
            throw new Error("Main Window not loaded");
        this.mainWindow.show();
        console.log("[MAIN-WINDOW] Main window shown.");
        IPCExtras_1.IPCExtras.sendFromMain(this.mainWindow, "app", {
            action: "trigger-start-bundle"
        });
        this.mainApp.mainWindowIsReady();
        this.isLoaded = true;
        if (this.showDev)
            this.mainWindow.webContents.openDevTools();
    }
    async getStartInfoBundle() {
        //Get check Ino
        let checkIno = 0;
        try {
            checkIno = fs.statSync(electron_1.app.getPath("userData")).ino;
        }
        catch (error) {
            console.log(error);
        }
        //Check if CMP is required
        let cmp = false;
        try {
            cmp = await electron_1.app.overwolf.isCMPRequired();
        }
        catch (err) {
            cmp = true;
            console.log(err);
        }
        //Load settings
        let settings = this.mainApp.settings;
        //Load user selected language
        let language = LanguageHelper_1.LanguageHelper.getLanguage(settings);
        let data = {
            checkIno: checkIno,
            settings: settings,
            needsCMP: cmp,
            language: language,
            version: this.mainApp.ipcCollections.generalCollection.getVersion(),
            versionMigration: {
                followersToTransfer: this.mainApp.versionSwitchController.followersToTransfer,
            }
        };
        return data;
    }
    async closeEverything() {
        if (this.isClosing)
            return;
        this.isClosing = true;
        await this.saveWindowState();
        if (this.mainWindow) {
            this.mainWindow.close();
        }
        //Close all workers
        this.mainApp.workersController.closeAllWorkers();
        //Close all remaining windows
        electron_1.BrowserWindow.getAllWindows().forEach((win) => {
            win.close();
        });
        // Finally, quit the app
        setTimeout(() => {
            electron_1.app.exit(0);
            electron_1.app.quit();
        }, 1000);
    }
    getWindow() {
        return this.mainWindow;
    }
}
exports.MainWindowController = MainWindowController;
