"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileActionsCollection = void 0;
const electron_1 = require("electron");
const DeleteHelper_1 = require("../utils/DeleteHelper");
class FileActionsCollection {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("file-action", async (event, data) => {
            switch (data.action) {
                case "delete-file":
                    if (!data.filepath)
                        throw new Error("No filepath provided for delete-file action");
                    return await DeleteHelper_1.DeleteHelper.deleteFile(data.filepath, this.mainApp.settings.s_direct_delete);
                default:
                    console.warn("Unknown file action requested:", data.action);
                    throw new Error("Unknown file action: " + data.action);
            }
        });
    }
}
exports.FileActionsCollection = FileActionsCollection;
