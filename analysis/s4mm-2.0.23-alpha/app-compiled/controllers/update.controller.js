"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateController = void 0;
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const electron_2 = require("electron");
class UpdateController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
        this.initializeUpdater();
    }
    initIPC() {
        electron_1.ipcMain.on("update-controller", (event, data) => {
            switch (data?.action) {
                case "quit-and-install":
                    electron_updater_1.autoUpdater.quitAndInstall();
                    break;
                case "check-for-updates":
                    this.checkForUpdates(data.channel || "beta");
                    break;
                case "download-update":
                    electron_updater_1.autoUpdater.downloadUpdate();
                    break;
                default:
                    throw new Error(`Unknown action: ${data?.action}`);
            }
        });
    }
    initializeUpdater() {
        console.log("[UPDATE-CONTROLLER] Initializing autoUpdater...");
        // Disable automatic downloads
        electron_updater_1.autoUpdater.autoDownload = true;
        electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;
        // Set up autoUpdater listeners
        electron_updater_1.autoUpdater.on('update-available', (info) => {
            console.log("[UPDATE-CONTROLLER] Update available.");
            console.log(`[UPDATE-CONTROLLER] Update Info: Version: ${info.version}, Release Date: ${info.releaseDate}, SHA512: ${info.sha512}, Files: ${JSON.stringify(info.files)}`);
            let mainWindow = this.mainApp.mainWindowController.getWindow();
            if (mainWindow) {
                mainWindow.webContents.send("update-service", {
                    action: "update-available",
                    updateInfo: info
                });
            }
            else {
                electron_2.dialog.showMessageBox({
                    type: 'info',
                    title: 'Update Available',
                    message: `A new version (${info.version}) is available. Released on: ${info.releaseDate}. Do you want to download and install it?`,
                    buttons: ['Yes', 'No']
                }).then(result => {
                    if (result.response === 0) { // 'Yes' button
                        electron_updater_1.autoUpdater.downloadUpdate();
                    }
                });
            }
        });
        electron_updater_1.autoUpdater.on('update-not-available', () => {
            console.log("[UPDATE-CONTROLLER] No updates available.");
            let mainWindow = this.mainApp.mainWindowController.getWindow();
            if (mainWindow) {
                mainWindow.webContents.send("update-service", { action: "update-not-available" });
            }
            else {
                electron_2.dialog.showMessageBox({
                    type: 'info',
                    title: 'No Updates',
                    message: 'You are already using the latest version.'
                });
            }
        });
        electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
            const progressMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`;
            console.log(progressMessage);
            let mainWindow = this.mainApp.mainWindowController.getWindow();
            if (mainWindow) {
                mainWindow.webContents.send("update-service", { action: "update-download-progress", progress: progressObj });
            }
        });
        electron_updater_1.autoUpdater.on('update-downloaded', () => {
            let mainWindow = this.mainApp.mainWindowController.getWindow();
            if (mainWindow) {
                mainWindow.webContents.send("update-service", { action: "update-downloaded" });
            }
            else {
                electron_2.dialog.showMessageBox({
                    type: 'info',
                    title: 'Update Downloaded',
                    message: 'The update has been downloaded. Do you want to install it now?',
                    buttons: ['Yes', 'No']
                }).then(result => {
                    if (result.response === 0) { // 'Yes' button
                        electron_updater_1.autoUpdater.quitAndInstall();
                    }
                });
            }
        });
    }
    checkForUpdates(channel = "beta") {
        console.log("[UPDATES] Checking for updates...");
        if (['latest', 'beta', 'alpha'].includes(channel)) {
            electron_updater_1.autoUpdater.channel = channel;
        }
        else {
            electron_updater_1.autoUpdater.channel = "beta";
        }
        console.log("[UPDATE-CONTROLLER] Checking for updates on channel: ", electron_updater_1.autoUpdater.channel);
        electron_updater_1.autoUpdater.checkForUpdates();
    }
}
exports.UpdateController = UpdateController;
