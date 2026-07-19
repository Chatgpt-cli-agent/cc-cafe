"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolTGIChecker = void 0;
const electron_1 = require("electron");
const TGICheck_1 = require("../utils/TGICheck");
class ToolTGIChecker {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-tgi-checker", async (event, data) => {
            switch (data.action) {
                case "check":
                    return await this.checkTGI(data.options); // Placeholder for the actual check logic
                default:
                    throw new Error("No valid action or parameters");
            }
        });
    }
    async checkTGI(options) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not available");
        return await (0, TGICheck_1.checkCASTgiList)(knex, options);
    }
}
exports.ToolTGIChecker = ToolTGIChecker;
