"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainApp = void 0;
const electron_1 = require("electron");
const splash_controller_1 = require("./controllers/splash.controller");
const folderStructure_controller_1 = require("./controllers/folderStructure.controller");
const io_controller_1 = require("./controllers/io.controller");
const settings_1 = require("./data/settings");
const settings_controller_1 = require("./controllers/settings.controller");
const dialog_controller_1 = require("./controllers/dialog.controller");
const database_controller_1 = require("./controllers/database.controller");
const workers_controller_1 = require("./controllers/workers.controller");
const fileLoading_controller_1 = require("./controllers/fileLoading.controller");
const file_controller_1 = require("./controllers/file.controller");
const curseforge_controller_1 = require("./controllers/curseforge.controller");
const mainWindow_controller_1 = require("./controllers/mainWindow.controller");
const appState_controller_1 = require("./controllers/appState.controller");
const startArgs_controller_1 = require("./controllers/startArgs.controller");
const language_controller_1 = require("./controllers/language.controller");
const ipcCollections_1 = require("./ipcCollections/ipcCollections");
const errorDisplay_1 = require("./utils/errorDisplay");
const fileImport_controller_1 = require("./controllers/fileImport.controller");
const communityFiles_controller_1 = require("./controllers/communityFiles.controller");
const communityTools_controller_1 = require("./controllers/communityTools.controller");
const path_1 = __importDefault(require("path"));
const game_controller_1 = require("./controllers/game.controller");
const note_controller_1 = require("./controllers/note.controller");
const tools_controller_1 = require("./controllers/tools.controller");
const gamestate_controller_1 = require("./controllers/gamestate.controller");
const overwolf_controller_1 = require("./controllers/overwolf.controller");
const keydata_controller_1 = require("./controllers/keydata.controller");
const objectviewer_controller_1 = require("./controllers/objectviewer.controller");
const thumbnails_controller_1 = require("./controllers/thumbnails.controller");
const categories_controller_1 = require("./controllers/categories.controller");
const update_controller_1 = require("./controllers/update.controller");
const macMenuTemplate_1 = require("./data/macMenuTemplate");
const curseforgeDownloads_controller_1 = require("./controllers/curseforgeDownloads.controller");
const plumbdex_controller_1 = require("./controllers/plumbdex.controller");
const saveFiles_controller_1 = require("./controllers/saveFiles.controller");
const localCache_controller_1 = require("./controllers/localCache.controller");
const versionSwitch_controller_1 = require("./controllers/versionSwitch.controller");
const downloads_controller_1 = require("./controllers/downloads.controller");
let mainapp = null;
const deepLinkName = "sims4modmanager";
// Cache URLs that arrive before the app is ready
let pendingDeepLinks = [];
// Ensure only one instance of the app
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', (event, argv) => {
        // Focus the existing window if a second instance is attempted
        if (mainapp && mainapp.mainWindowController) {
            const mainWindow = mainapp.mainWindowController.getWindow();
            if (mainWindow) {
                if (mainWindow.isMinimized())
                    mainWindow.restore();
                mainWindow.focus();
                if (mainapp)
                    mainapp.startArgsController.handleStartArgs(argv);
            }
        }
    });
    // Handle macOS deep links
    electron_1.app.on('open-url', (event, url) => {
        event.preventDefault();
        if (mainapp && mainapp.startArgsController) {
            mainapp.startArgsController.handleStartArgs([url]);
        }
        else {
            // Store the link if the controller isn't ready yet
            pendingDeepLinks.push(url);
        }
    });
    electron_1.app.on('ready', () => {
        const menu = electron_1.Menu.buildFromTemplate(macMenuTemplate_1.MacMenuTemplate.template);
        electron_1.Menu.setApplicationMenu(menu);
        mainapp = MainApp.getInstance(process.argv);
        // Process any links that were caught during startup
        if (pendingDeepLinks.length > 0) {
            pendingDeepLinks.forEach(link => {
                mainapp?.startArgsController.handleStartArgs([link]);
            });
            pendingDeepLinks = [];
        }
        if (process.defaultApp) {
            if (process.argv.length >= 2) {
                electron_1.app.setAsDefaultProtocolClient(deepLinkName, process.execPath, [path_1.default.resolve(process.argv[1])]);
            }
        }
        else {
            electron_1.app.setAsDefaultProtocolClient(deepLinkName);
        }
    });
    electron_1.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
}
class MainApp {
    static getInstance(args) {
        if (!MainApp.instance) {
            MainApp.instance = new MainApp(args);
        }
        return MainApp.instance;
    }
    constructor(args) {
        this.osName = process.platform;
        this.isFullyStarted = false;
        this.settings = new settings_1.Settings();
        errorDisplay_1.ErrorDisplay.mainApp = this;
        this.startArgsController = new startArgs_controller_1.StartArgsController(this);
        if (args)
            this.startArgsController.handleStartArgs(args, true);
        this.curseForgeController = new curseforge_controller_1.CurseForgeController(this);
        this.fileController = new file_controller_1.FileController(this);
        this.fileLoadingController = new fileLoading_controller_1.FileLoadingController(this);
        this.workersController = new workers_controller_1.WorkersController(this);
        this.databaseController = new database_controller_1.DatabaseController(this);
        this.dialogController = new dialog_controller_1.DialogController(this);
        this.settingsController = new settings_controller_1.SettingsController(this);
        this.ioController = new io_controller_1.IoController(this);
        this.folderStructureController = new folderStructure_controller_1.FolderStructureController(this);
        this.splashController = new splash_controller_1.SplashController(this);
        this.mainWindowController = new mainWindow_controller_1.MainWindowController(this);
        this.languageController = new language_controller_1.LanguageController(this);
        this.fileImportController = new fileImport_controller_1.FileImportController(this);
        this.commuintyFilesController = new communityFiles_controller_1.CommuintyFilesController(this);
        this.commuintyToolsController = new communityTools_controller_1.CommuintyToolsController(this);
        this.gameController = new game_controller_1.GameController(this);
        this.noteController = new note_controller_1.NoteController(this);
        this.toolsController = new tools_controller_1.ToolsController(this);
        this.gameStateController = new gamestate_controller_1.GameStateController(this);
        this.overwolfController = new overwolf_controller_1.OverwolfController(this);
        this.keyDataController = new keydata_controller_1.KeyDataController(this);
        this.objectViewerController = new objectviewer_controller_1.ObjectViewerController(this);
        this.thumbnailsController = new thumbnails_controller_1.ThumbnailsController(this);
        this.categoriesController = new categories_controller_1.CategoriesController(this);
        this.updateController = new update_controller_1.UpdateController(this);
        this.curseforgeDownloadsController = new curseforgeDownloads_controller_1.CurseforgeDownloadsController(this);
        this.plumbdexController = new plumbdex_controller_1.PlumbDexController(this);
        this.saveFilesController = new saveFiles_controller_1.SaveFileController(this);
        this.localCacheController = new localCache_controller_1.LocalCacheController(this);
        this.versionSwitchController = new versionSwitch_controller_1.VersionSwitchController(this);
        this.downloadController = new downloads_controller_1.DownloadController(this);
        this.ipcCollections = new ipcCollections_1.IPCCollections(this);
        this.appStateController = new appState_controller_1.AppStateController(this);
        this.splashController.startApp();
        console.log("[MAIN] App started");
    }
    mainAppIsReady() {
        this.startArgsController.processInitalStartArgs();
    }
    mainWindowIsReady() {
        this.isFullyStarted = true;
        this.gameStateController.start();
        this.noteController.loadNotesFromFile();
        this.toolsController.tools[12]?.prepareObject();
        setTimeout(() => {
            this.startArgsController.handleDataAfterStart();
        }, 5000);
    }
}
exports.MainApp = MainApp;
