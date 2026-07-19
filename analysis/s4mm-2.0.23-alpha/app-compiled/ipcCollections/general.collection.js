"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneralCollection = void 0;
const electron_1 = require("electron");
class GeneralCollection {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("s4mm", async (event, data) => {
            if (data.action == "get-version") {
                return this.getVersion();
            }
            throw new Error("No action or invalid parameters");
        });
        electron_1.ipcMain.on("openUrl", (event, data) => {
            if (data.url != undefined) {
                require('electron').shell.openExternal(data.url);
            }
        });
    }
    getVersion() {
        let versionString = electron_1.app.getVersion();
        let version = {
            major: 0,
            minor: 0,
            patch: 0,
            isPre: false,
            preVersion: 0,
            isBeta: false,
            isAlpha: false,
            plainString: versionString,
            numString: "",
            small: "",
            full: ""
        };
        version.isAlpha = versionString.includes("alpha");
        version.isBeta = versionString.includes("beta");
        version.isPre = versionString.includes("pre");
        let parts = versionString.split("-");
        let versionParts = parts[0].split(".");
        if (versionParts.length == 3) {
            version.major = parseInt(versionParts[0]);
            version.minor = parseInt(versionParts[1]);
            version.patch = parseInt(versionParts[2]);
        }
        for (let index = 1; index < parts.length; index++) {
            const element = parts[index];
            if (element.includes("pre")) {
                version.preVersion = parseInt(element.replace("pre", ""));
            }
        }
        version.numString = version.major + "." + version.minor + "." + version.patch;
        version.small = (version.isBeta ? "B-" : "") + version.numString + (version.isPre ? "-pre" + version.preVersion : "");
        version.full = (version.isBeta ? "Beta " : "") + version.numString + (version.isPre ? " Pre" + version.preVersion : "");
        ;
        return version;
    }
}
exports.GeneralCollection = GeneralCollection;
