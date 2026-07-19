"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverwolfController = void 0;
const electron_1 = require("electron");
class OverwolfController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.on("overwolf", (event, args) => {
            switch (args.action) {
                case "open-cmp-manage":
                    this.openCMPManage();
                    break;
                default:
                    console.error("Unknown action: ", args.action);
            }
        });
    }
    openCMPManage() {
        electron_1.app.overwolf.openAdPrivacySettingsWindow();
    }
}
exports.OverwolfController = OverwolfController;
