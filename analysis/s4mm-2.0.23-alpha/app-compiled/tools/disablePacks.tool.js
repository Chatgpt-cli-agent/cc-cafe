"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolDisablePacks = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
class ToolDisablePacks {
    constructor(main) {
        this.checkedForUpdates = false;
        this.packs = [];
        this.downloadIconQueue = new Set();
        this.downloadQueueActive = false;
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-disablePacks", async (event, data) => {
            switch (data.action) {
                case "get-packs":
                    return await this.getPacks();
                case "load-packs":
                    return await this.loadPacks();
                default:
                    throw new Error("No valid action or parameters");
            }
        });
    }
    async getPacks() {
        if (this.packs.length > 0) {
            return this.extendPacks(this.packs);
        }
        await this.loadPacks();
        this.checkForUpdates();
        return this.extendPacks(this.packs);
    }
    async loadPacks() {
        // Pathes definitions
        //Provided
        let filesFolder = path_1.default.join(__dirname, "..", "files");
        let providedJsonFile = path_1.default.join(filesFolder, "sims-packs.json");
        let providedIconsFolder = path_1.default.join(filesFolder, "packicons");
        //Local
        let localPacksFolder = this.mainApp.folderStructureController.getFolder("tool-disablePacks");
        let localJsonFile = path_1.default.join(localPacksFolder, "sims-packs.json");
        //Check
        if (!fs.existsSync(providedJsonFile)) {
            throw new Error("Packs JSON file not found.");
        }
        if (!fs.existsSync(providedIconsFolder)) {
            throw new Error("Icons folder not found.");
        }
        //Read provided packs
        let providedPacks = JSON.parse(fs.readFileSync(providedJsonFile, "utf-8"));
        //Copy if missing
        if (!localPacksFolder || !fs.existsSync(localPacksFolder)) {
            this.packs = providedPacks;
            return;
        }
        //Copy Json
        if (!fs.existsSync(localJsonFile)) {
            fs.writeFileSync(localJsonFile, JSON.stringify(providedPacks, null, 2));
        }
        //Copy Icons
        let providedIcons = fs.readdirSync(providedIconsFolder).filter(file => file.endsWith(".webp"));
        for (let icon of providedIcons) {
            let providedIconPath = path_1.default.join(providedIconsFolder, icon);
            let localIconPath = path_1.default.join(localPacksFolder, icon);
            if (!fs.existsSync(localIconPath)) {
                fs.copyFileSync(providedIconPath, localIconPath);
            }
        }
        //Load local packs
        let localPacks = JSON.parse(fs.readFileSync(localJsonFile, "utf-8"));
        this.packs = localPacks;
    }
    extendPacks(packs) {
        let extendedPacks = JSON.parse(JSON.stringify(packs)); //Deep copy
        //Icons
        let iconsFolder = this.mainApp.folderStructureController.getFolder("tool-disablePacks");
        for (let packGroups of extendedPacks) {
            for (let pack of packGroups.items) {
                let iconPath = path_1.default.join(iconsFolder, pack.value + ".webp");
                pack.thumbnail = "https://data.gametimedev.de/community/dlc/" + pack.value + ".webp";
                if (fs.existsSync(iconPath)) {
                    pack.iconPath = iconPath;
                }
                else {
                    pack.iconPath = null;
                    this.downloadIconQueue.add(pack);
                }
                //Get onl 0-9 characters from value string
                pack.numIndex = Number(pack.value.replace(/[^0-9]/g, ""));
            }
        }
        //Sort
        for (let packGroups of extendedPacks) {
            packGroups.items.sort((a, b) => {
                return a.numIndex - b.numIndex;
            });
        }
        this.startDownloadMissingIcons();
        return extendedPacks;
    }
    async checkForUpdates() {
        if (this.checkedForUpdates)
            return;
        this.checkedForUpdates = true;
        let url = "https://backend.gametimedev.de/community-api/versioninfos/packs";
        //Fetch json from URL
        try {
            let response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch packs from URL: " + response.statusText);
            }
            let data = await response.json();
            if (!data || !data.groups) {
                throw new Error("Invalid data format received from URL.");
            }
            this.handleUpdateData(data);
        }
        catch (error) {
            console.error("Error checking for updates:", error);
            return;
        }
    }
    handleUpdateData(data) {
        let groups = data.groups;
        if (!Array.isArray(groups) || groups.length === 0) {
            console.warn("No valid groups found in update data.");
            return;
        }
        let packsMap = new Map();
        for (let group of groups) {
            for (let item of group.items) {
                item.group = group.name;
                item.value = item.id;
                item.thumbnail = "https://data.gametimedev.de/community/dlc/" + item.id + ".webp";
                if (!packsMap.has(item.id)) {
                    packsMap.set(item.id, item);
                }
            }
        }
        //Update packs
        for (let pack of this.packs) {
            for (let item of pack.items) {
                if (packsMap.has(item.value)) {
                    let updateItem = packsMap.get(item.value);
                    item.thumbnail = updateItem.thumbnail;
                    item.value = updateItem.value;
                    item.id = updateItem.id;
                    packsMap.delete(item.value); //Remove from map to avoid duplicates
                }
            }
        }
        let rest = Array.from(packsMap.values());
        if (rest.length > 0) {
            for (let groups of this.packs) {
                let groupname = groups.name;
                for (let item of rest) {
                    if (item.group === groupname) {
                        groups.items.push(item);
                    }
                }
            }
        }
        //Save updated packs
        let localPacksFolder = this.mainApp.folderStructureController.getFolder("tool-disablePacks");
        if (!localPacksFolder || !fs.existsSync(localPacksFolder)) {
            throw new Error("Local packs folder does not exist.");
        }
        let localJsonFile = path_1.default.join(localPacksFolder, "sims-packs.json");
        fs.writeFileSync(localJsonFile, JSON.stringify(this.packs, null, 2));
        console.log("[ToolDisablePacks] Updated packs saved to:", localJsonFile);
    }
    startDownloadMissingIcons() {
        if (this.downloadIconQueue.size === 0) {
            return;
        }
        if (this.downloadQueueActive) {
            return;
        }
        this.downloadQueueActive = true;
        this.workOnDownloadQueue();
    }
    workOnDownloadQueue() {
        if (this.downloadIconQueue.size === 0) {
            this.downloadQueueActive = false;
            return;
        }
        let pack = this.downloadIconQueue.values().next().value;
        this.downloadIconQueue.delete(pack);
        let iconUrl = "https://data.gametimedev.de/community/dlc/" + pack.value + ".webp";
        let iconPath = path_1.default.join(this.mainApp.folderStructureController.getFolder("tool-disablePacks"), pack.value + ".webp");
        if (!iconUrl || fs.existsSync(iconPath)) {
            this.workOnDownloadQueue(); // Continue with next icon
            return;
        }
        fetch(iconUrl)
            .then(response => {
            if (!response.ok) {
                throw new Error("Failed to download icon: " + response.statusText);
            }
            return response.arrayBuffer().then(arr => Buffer.from(arr));
        })
            .then(buffer => {
            fs.writeFileSync(iconPath, buffer);
            pack.iconPath = iconPath;
            console.log("Downloaded icon for pack:", pack.value);
            this.workOnDownloadQueue(); // Continue with next icon
        })
            .catch(error => {
            console.error("Error downloading icon for pack:", pack.value, error);
            this.workOnDownloadQueue(); // Continue with next icon even on error
        });
    }
}
exports.ToolDisablePacks = ToolDisablePacks;
