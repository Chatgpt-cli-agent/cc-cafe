"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCExtras = void 0;
const electron_1 = require("electron");
class IPCExtras {
    static startLocalServer(baseFolder) {
        if (this.localServer)
            return;
        try {
            console.log("[IPCExtras] Starting Local Server...");
            let worker = new electron_1.BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });
            worker.loadFile('./views/local_server/index.html');
            worker.setMenu(null);
            worker.on("ready-to-show", () => {
                console.log("[IPCExtras] Local Server is ready.");
                worker.webContents.openDevTools();
                worker.webContents.send("setup", { baseFolder: baseFolder });
                //Focus on the window
                worker.focus();
            });
            this.localServer = worker;
        }
        catch (error) {
            console.log("[ERROR-LocalServer]: " + error);
        }
    }
    static send(event, channel, data) {
        if (!event || !event.sender || !channel)
            return;
        if (this.localServer) {
            this.localServer.webContents.send("ipc-connect-send", { channel: channel, data: data });
        }
        else {
            event.sender.send(channel, data);
        }
        if (this.ccSwiperServer) {
            this.ccSwiperServer.webContents.send("ipc-connect-send", { channel, data });
        }
    }
    static sendFromMain(mainWindow, channel, data) {
        if (!mainWindow || !channel)
            return;
        try {
            if (this.localServer) {
                this.localServer.webContents.send("ipc-connect-send", { channel: channel, data: data });
            }
            else {
                mainWindow.webContents.send(channel, data);
            }
            if (this.ccSwiperServer) {
                this.ccSwiperServer.webContents.send("ipc-connect-send", { channel, data });
            }
        }
        catch (error) {
            console.log("[ERROR-IPCExtras-sendFromMain]: " + error);
        }
    }
    static sendFromMainApp(mainApp, channel, data) {
        if (!mainApp || !mainApp.mainWindowController || !mainApp.mainWindowController.mainWindow || !channel)
            return;
        let mainWindow = mainApp.mainWindowController.mainWindow;
        if (mainWindow)
            IPCExtras.sendFromMain(mainWindow, channel, data);
    }
}
exports.IPCExtras = IPCExtras;
IPCExtras.localServer = undefined;
IPCExtras.ccSwiperServer = undefined;
