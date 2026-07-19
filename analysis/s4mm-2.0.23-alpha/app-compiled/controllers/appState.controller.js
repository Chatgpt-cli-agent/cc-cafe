"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStateController = void 0;
const electron_1 = require("electron");
class AppStateController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
        this.onFocusChange();
    }
    initIPC() {
    }
    //Changes
    onFocusChange() {
        electron_1.app.on('browser-window-focus', () => {
            this.mainApp.gameStateController.updateFocusState(true);
        });
        electron_1.app.on('browser-window-blur', () => {
            this.mainApp.gameStateController.updateFocusState(false);
        });
    }
}
exports.AppStateController = AppStateController;
