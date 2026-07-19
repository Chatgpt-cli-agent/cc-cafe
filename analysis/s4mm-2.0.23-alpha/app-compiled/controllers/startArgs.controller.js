"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartArgsController = void 0;
const IPCExtras_1 = require("../utils/IPCExtras");
class StartArgsController {
    constructor(main) {
        //Startup options
        this.maxThreadCount = 64;
        this.localServer = false;
        this.data = [];
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        //Nix
    }
    handleStartArgs(args, intialStart = false) {
        console.log("[START-ARGS] Start Args: ", args);
        args.forEach((arg) => {
            if (arg.startsWith("sims4modmanager://")) {
                try {
                    this.handleDeepLink(arg);
                }
                catch (error) {
                    console.error("Error handling deep link: ", error);
                }
            }
            else if (arg.startsWith("--localserver")) {
                this.localServer = true;
            }
            else if (arg.startsWith("--maxthreads=")) {
                let threadCount = parseInt(arg.split("=")[1]);
                if (!isNaN(threadCount) && threadCount > 0 && threadCount <= this.maxThreadCount) {
                    this.mainApp.workersController.theadCount = threadCount;
                }
                else {
                    console.error("Invalid thread count specified. Using default.");
                }
            }
        });
    }
    processInitalStartArgs() {
        if (this.localServer) {
            let folder = this.mainApp.folderStructureController.getFolder("s4mm-data");
            if (folder)
                IPCExtras_1.IPCExtras.startLocalServer(folder);
        }
    }
    handleDeepLink(url) {
        let deepLinkName = "sims4modmanager://";
        if (url.startsWith(deepLinkName)) {
            url = url.substring(deepLinkName.length);
        }
        let parts = url.split("?");
        let action = parts.shift();
        if (action) {
            action = action.replace("/", "");
        }
        let data = parts.join("?");
        switch (action) {
            case "login":
                DeepLinkActions.handleLogin(this.mainApp, data);
                break;
            case "login-user":
                DeepLinkActions.handleLoginUser(this.mainApp, data);
                break;
            case "":
                DeepLinkActions.handleEmpty(this.mainApp, data);
                break;
            case "login-community":
                DeepLinkActions.handleCommunityLogin(this.mainApp, data);
                break;
            case "direct-download":
                DeepLinkActions.handleDirectDownload(this.mainApp, data);
            default:
                console.error("Unknown deep link action: ", action);
                break;
        }
    }
    handleDataAfterStart() {
        for (let i = this.data.length - 1; i >= 0; i--) {
            let item = this.data[i];
            switch (item.type) {
                case "direct-download":
                    this.mainApp.downloadController.addDirectDownload(item.value.url, item.value.name);
                    this.data.splice(i, 1);
                    break;
                default:
                    console.error("Unknown start data type: ", item.type);
                    break;
            }
        }
    }
}
exports.StartArgsController = StartArgsController;
class DeepLinkActions {
    static handleLogin(app, data) {
        if (!data.startsWith("code="))
            throw new Error("Invalid data format");
        data = data.substring("code=".length);
        let code = data;
        let mainWindow = app.mainWindowController.getWindow();
        if (!mainWindow)
            throw new Error("Main window not found");
        mainWindow.webContents.send("overwolf", { action: "login-with-code", code: code });
    }
    static handleLoginUser(app, data) {
        if (!data.startsWith("data="))
            throw new Error("Invalid data format");
        data = data.substring("data=".length);
        let userData = JSON.parse(decodeURI(data));
        let mainWindow = app.mainWindowController.getWindow();
        if (!mainWindow)
            throw new Error("Main window not found");
        mainWindow.webContents.send("overwolf", { action: "login", data: userData });
    }
    static handleCommunityLogin(app, data) {
        if (!data.startsWith("token="))
            throw new Error("Invalid data format");
        data = data.substring("token=".length);
        let token = data;
        let mainWindow = app.mainWindowController.getWindow();
        if (!mainWindow)
            throw new Error("Main window not found");
        //mainWindow.webContents.send("community-account", { action: "community-login", token: token });
        IPCExtras_1.IPCExtras.sendFromMain(mainWindow, "community-account", { action: "token-login", token: token });
    }
    static handleEmpty(app, data) {
        if (!data.startsWith("result="))
            throw new Error("Invalid data format");
        data = data.substring("result=".length);
        let result = data;
        let mainWindow = app.mainWindowController.getWindow();
        if (!mainWindow)
            throw new Error("Main window not found");
        if (result == "success" || result == "cancel") {
            mainWindow.webContents.send("overwolf", { action: "tebex-checkout", result: result });
        }
    }
    static handleDirectDownload(app, data) {
        if (!data.startsWith("url="))
            throw new Error("Invalid data format");
        console.log("Handling direct download with data: ", data);
        //url= (required) - The URL to download. Must be URL-encoded.
        //name= (optional) - The name to save the file as. Must be URL-encoded. If not provided, the filename will be extracted from the URL.
        let name = undefined;
        const nameIndex = data.indexOf("&name=");
        if (nameIndex !== -1) {
            name = decodeURIComponent(data.substring(nameIndex + "&name=".length));
            data = data.substring(0, nameIndex);
        }
        let url = decodeURIComponent(data.substring("url=".length));
        console.log("Extracted URL: ", url);
        console.log("Extracted Name: ", name);
        if (app.isFullyStarted) {
            app.downloadController.addDirectDownload(url, name);
        }
        else {
            app.startArgsController.data.push({ type: "direct-download", value: { url, name } });
        }
    }
}
