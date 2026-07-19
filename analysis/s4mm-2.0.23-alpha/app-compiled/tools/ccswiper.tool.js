"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolCCSwiper = void 0;
const electron_1 = require("electron");
const IPCExtras_1 = require("../utils/IPCExtras");
const { networkInterfaces } = require('os');
class ToolCCSwiper {
    constructor(main) {
        this.swipeServer = undefined;
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        console.log("[SWIPER] CCSwiper Tool IPC initialized.");
        electron_1.ipcMain.on("swiper", (event, data) => {
            console.log("[SWIPER]" + JSON.stringify(data));
            if (data.action == "get-ip") {
                let ip = this.getIp();
                console.log("[SWIPER] IPs: " + ip);
                IPCExtras_1.IPCExtras.send(event, "swiper", { "action": "set-ip", "ip": ip });
            }
            else if (data.action == "get-info") {
                this.serverInfo();
            }
            else if (data.action == "start-server") {
                this.startSwiperServer(event, data);
            }
            else if (data.action == "stop-server") {
                this.stopServer(event);
            }
            else if (data.action == "send-info") {
                console.log("[SWIPER] Sending info to UI");
                let win = this.mainApp.mainWindowController.getWindow();
                if (win)
                    IPCExtras_1.IPCExtras.sendFromMain(win, "swiper", data.info);
            }
            else if (data.action == "get-baseFolder") {
                //win.webContents.send("swiper", { "action": "set-baseFolder", "folder": baseFolderPath });
            }
            else if (data.action == "to-ui") {
                //win.webContents.send("swiper", data.data);
            }
            else if (data.action == "get-files") {
                if (this.swipeServer == undefined)
                    return;
                this.swipeServer.webContents.send("get-files", {});
            }
            else if (data.action == "get-files-check") {
                if (this.swipeServer == undefined) {
                    console.log("[SWIPER] Server is undefined");
                    return;
                }
                this.swipeServer.webContents.send("get-files-check", {});
            }
            else if (data.action == "update-filter") {
                if (this.swipeServer == undefined) {
                    console.log("[SWIPER] Server is undefined");
                    return;
                }
                this.swipeServer.webContents.send("update-filter", { "filter": data.filter });
            }
            else if (data.action == "update-last-cf-time") {
                //updateLastCFChanged();
            }
        });
        electron_1.ipcMain.handle('cc-swiper', async (event, data) => {
            if (data && data.action == "run-filter") {
                //return await runFilterCCSwiper(data.filter)
                return await this.mainApp.ipcCollections.filesFilterCollection.overviewMainFolder(data.filter);
            }
            else if (data && data.action == "update-state" && data.id && data.state != undefined) {
                /*let items = await knex.select(["categories"]).from("Files").where("id", data.id);
                if (!items || items.length != 1) return;
                let item = items[0];
                let categories = item.categories ? item.categories : "";
                categories = categories.replace("<-1>", "");
                categories = categories.replace("<-2>", "");
                categories = categories.replace("<-3>", "");
                if (data.state == 0) categories += "<-2>";
                if (data.state == -1) categories += "<-3>";
                if (data.state == 1) categories += "<-1>";
                await knex.from('Files').update("categories", categories).where("id", data.id);
                return;*/
            }
            else if (data && data.action == "cf-ids") {
                /*let items = [];
                let rawItems = await knex.from("Files").distinct('cf_id');
                rawItems.forEach((element) => items.push(element.cf_id));
                return items;*/
            }
            else if (data && data.action == "s4mm-values") {
                return await this.s4mmValues(data);
            }
            console.log("[cc-swiper] No action matched for: " + JSON.stringify(data));
            throw new Error("No action");
        });
        electron_1.ipcMain.on('cc-swiper', async (event, data) => {
            if (data && data.action == "uv-loading-update") {
                if (this.swipeServer)
                    this.swipeServer.webContents.send("ipc-connect-send", { channel: "CC-Swiper-Loading", data: data.rawData });
            }
        });
        /*setTimeout(() => {
            this.startSwiperServer(null, { filter: {} });
        }, 2000);*/
    }
    async s4mmValues(data) {
        let values = {
            settings: this.mainApp.settings,
            basepath: this.mainApp.folderStructureController.getFolder("s4mm-data"),
            isMac: this.mainApp.osName == "darwin",
            categories: []
        };
        /*try {
            values.categories = await categoriesController.categoriesGetBasic();
        } catch (error) {
            console.log(error)
        }*/
        let knex = this.mainApp.databaseController.getKnex();
        if (data.idSync) {
            let rawItems = await knex.from("Files").distinct('cf_id');
            values.ids = [];
            rawItems.forEach((element) => values.ids.push(element.cf_id));
        }
        return values;
    }
    getIp() {
        const nets = networkInterfaces();
        const results = Object.create(null);
        let ips = [];
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
                if (net.family === familyV4Value && !net.internal) {
                    if (!results[name]) {
                        results[name] = [];
                    }
                    ips.push(net.address);
                }
            }
        }
        return ips;
    }
    startSwiperServer(event, data) {
        if (this.swipeServer == undefined) {
            console.log("[SERVER] Try to startd");
            try {
                let worker = new electron_1.BrowserWindow({
                    show: false,
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                });
                worker.loadFile('./views/cc_swiper/index.html');
                worker.setMenu(null);
                this.swipeServer = worker;
                IPCExtras_1.IPCExtras.ccSwiperServer = worker;
                //if (thumbnailDetectController) thumbnailDetectController.setSwipeServer(swipeServer);
                //if (categoriesController) categoriesController.setSwipeServer(swipeServer);
                worker.on("closed", () => {
                    this.swipeServer = undefined;
                    IPCExtras_1.IPCExtras.ccSwiperServer = undefined;
                    //if (thumbnailDetectController) thumbnailDetectController.setSwipeServer(swipeServer);
                    //if (categoriesController) categoriesController.setSwipeServer(swipeServer);
                    this.serverInfo();
                });
                worker.on("ready-to-show", () => {
                    //Show debug info
                    worker.webContents.openDevTools();
                    worker.webContents.send("setup", {
                        "baseFolderPath": this.mainApp.folderStructureController.getFolder("s4mm-data"),
                        "filter": data.filter,
                        "logFolderPath": this.mainApp.folderStructureController.getFolder("logs")
                    });
                });
            }
            catch (err) {
                console.log("[ERROR-Server]: " + err);
            }
        }
        else {
            console.log("[SERVER] Server is already running");
            this.swipeServer.webContents.send("get-info", {});
        }
    }
    stopServer(event) {
        if (this.swipeServer != undefined) {
            this.swipeServer.close();
        }
        else {
            this.serverInfo();
        }
    }
    serverInfo() {
        if (this.swipeServer == undefined) {
            let def = {
                "action": "info",
                "status": 0,
                "connected": false,
                "online": false,
                "stats": {
                    "total": 0,
                    "left": 0,
                    "liked": 0,
                    "disliked": 0,
                    "skipped": 0,
                }
            };
            let win = this.mainApp.mainWindowController.getWindow();
            if (win) {
                IPCExtras_1.IPCExtras.sendFromMain(win, "swiper", def);
                console.log("[SWIPE SERVER] Sent server info to main window");
            }
            else {
                console.log("[SWIPE SERVER] Main window is undefined, cannot send server info");
            }
            return;
        }
        console.log("[SWIPE SERVER] Requesting server info from swipe server");
        this.swipeServer.webContents.send("get-info", {});
    }
}
exports.ToolCCSwiper = ToolCCSwiper;
