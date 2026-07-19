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
exports.PlumbDexController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const communityApi_1 = require("../utils/communityApi");
const NumberArrayBinaryUtil_1 = require("../utils/NumberArrayBinaryUtil");
const Downloader = require("nodejs-file-downloader");
class PlumbDexController {
    constructor(main) {
        this.brokenFingerprints = new Set();
        this.loadedHealthBundle = undefined;
        this.lastCheckedMap = new Map();
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("plumbdex", async (event, args) => {
            switch (args.action) {
                case "get-health-bundle":
                    return await this.getHealthBundle();
                case "load-most-recent-health-bundle":
                    return await this.loadMostRecentHealthBundle();
                case "get-broken-files":
                    return await this.getBrokenFiles();
                default:
                    throw new Error("Invalid action: " + args.action);
            }
        });
    }
    async getHealthBundle() {
        return this.loadedHealthBundle;
    }
    async getDownloadedHealthBundle() {
        let bundles = [];
        let healthDir = this.mainApp.folderStructureController.getFolder("health-bundles");
        if (!healthDir) {
            console.error("Health bundles directory not found");
            return bundles;
        }
        try {
            const files = await fs_1.promises.readdir(healthDir, { withFileTypes: true });
            for (const file of files) {
                if (file.isFile() && file.name.endsWith(".bin")) {
                    //Example health_bundle_broken_1.116.240.1020_1755464334553.bin
                    const filePath = path_1.default.join(healthDir, file.name);
                    const nameLower = file.name.toLowerCase().replace(".bin", "");
                    const parts = nameLower.split("_");
                    if (parts.length != 5)
                        continue; // Not a valid health bundle file
                    const gameVersion = parts[3];
                    const date = parseInt(parts[4]);
                    bundles.push({
                        file: filePath,
                        date: date,
                        gameVersion: gameVersion
                    });
                }
            }
        }
        catch (error) {
            console.error("Error reading health bundles directory:", error);
            return bundles;
        }
        return bundles;
    }
    async loadMostRecentHealthBundle() {
        const gameVersion = this.mainApp.gameController.getInstalledGameVersion();
        if (!gameVersion) {
            return { message: "Game version not found", code: "NO_GAME_VERSION" };
        }
        console.log("[PLUMBDEX] Loading most recent health bundle for game version:", gameVersion);
        // 1. Get Game Version
        // (Already done)
        // Get all downloaded bundles, sorted by date (most recent first)
        let downloadedBundles = await this.getDownloadedHealthBundle();
        downloadedBundles.sort((a, b) => b.date - a.date);
        // 2. Delete irrelevant versions
        const bundlesToDelete = downloadedBundles.filter(bundle => bundle.gameVersion !== gameVersion);
        for (const bundle of bundlesToDelete) {
            try {
                fs.unlinkSync(bundle.file);
                console.log("Deleted old health bundle:", bundle.file);
            }
            catch (error) {
                console.error("Error deleting old health bundle:", error);
            }
        }
        // Re-filter the downloaded bundles to only include the relevant ones
        downloadedBundles = downloadedBundles.filter(bundle => bundle.gameVersion === gameVersion);
        // 3. Try to fetch data if none exist or last check is old
        const currentTime = Date.now();
        const timeInPast = currentTime - (1000 * 60 * 15); // 15 minutes ago
        const lastChecked = this.lastCheckedMap.get(gameVersion) || 0;
        let mostRecentBundlePath = null;
        let loadedBundleData = undefined;
        if (downloadedBundles.length === 0 || lastChecked < timeInPast) {
            console.log("Checking for a new health bundle online...");
            this.lastCheckedMap.set(gameVersion, currentTime);
            const onlineData = await communityApi_1.CommunityApi.checkGameVersion(gameVersion);
            if (onlineData.success && onlineData.data && onlineData.data.healthBundleUrl) {
                console.log("[PLUMBDEX] New health bundle available online:", onlineData.data.healthBundleUrl);
                const bundleUrl = "https://data.gametimedev.de/community" + onlineData.data.healthBundleUrl;
                // 4. Download a newer version if needed
                const downloadedFilePath = await this.downloadHealthBundle(bundleUrl, gameVersion);
                if (downloadedFilePath) {
                    console.log("Downloaded new bundle:", downloadedFilePath);
                    mostRecentBundlePath = downloadedFilePath;
                    this.lastCheckedMap.set(gameVersion, currentTime);
                }
                else {
                    console.error("Failed to download the new health bundle.");
                    // Fallback to the most recent existing bundle if the download failed
                    if (downloadedBundles.length > 0) {
                        mostRecentBundlePath = downloadedBundles[0].file;
                    }
                }
            }
            else {
                console.log("No new health bundle available online or API check failed.");
                // If the API check fails, use the most recent downloaded bundle as a fallback
                if (downloadedBundles.length > 0) {
                    mostRecentBundlePath = downloadedBundles[0].file;
                }
                else if (onlineData && onlineData.status == 404) {
                    //Not found, no health bundle available
                    console.warn("No health bundle available online.");
                    return { message: "No health bundle available online", code: "NO_HEALTH_BUNDLE" };
                }
                else {
                    console.error("Error checking for health bundle online:", onlineData);
                    return { message: "Error checking for health bundle online", code: "API_ERROR" };
                }
            }
        }
        else {
            // Use the most recent downloaded bundle without checking the API
            console.log("Using the most recent downloaded bundle (check interval not met).");
            if (downloadedBundles.length > 0) {
                mostRecentBundlePath = downloadedBundles[0].file;
            }
        }
        // 5. Load the most recent one and send back current loaded bundle or error
        if (mostRecentBundlePath) {
            loadedBundleData = await this.loadBundle(mostRecentBundlePath);
        }
        else {
            console.warn("No health bundle found to load.");
            loadedBundleData = undefined;
        }
        this.loadedHealthBundle = loadedBundleData;
        return loadedBundleData;
    }
    async downloadHealthBundle(url, version) {
        const healthDir = this.mainApp.folderStructureController.getFolder("health-bundles");
        if (!healthDir) {
            console.error("Health bundles directory not found");
            return null;
        }
        const downloader = new Downloader({
            url: url,
            directory: healthDir,
            cloneFiles: false,
            headers: {
                "Referer": "S4MM",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Sims4ModManager/1.2.13-beta-pre1 Chrome/126.0.6478.234 Electron/31.7.8 Safari/537.36"
            },
            onProgress: (progress, chunk, remainingSize) => {
                console.log(`Downloading health bundle: ${progress}% completed, ${remainingSize} bytes remaining`);
            },
            onError: (er) => {
                console.error("Error downloading health bundle:", er);
            }
        });
        const { filePath, downloadStatus } = await downloader.download();
        console.log("[PLUMBDEX] Health bundle downloaded to:", filePath);
        console.log("[PLUMBDEX] Health bundle status:", downloadStatus);
        if (downloadStatus === 'COMPLETE' && fs.existsSync(filePath)) {
            return filePath;
        }
        return null;
    }
    async loadBundle(filePath) {
        console.log("Loading health bundle from:", filePath);
        if (!fs.existsSync(filePath)) {
            console.error("Health bundle file does not exist:", filePath);
            return { message: "Health bundle file not found", code: "FILE_NOT_FOUND" };
        }
        if (this.loadedHealthBundle && this.loadedHealthBundle.file === filePath) {
            return this.loadedHealthBundle; // Already loaded
        }
        try {
            let fingerprints = NumberArrayBinaryUtil_1.NumberArrayBinaryUtil.readFromFile(filePath);
            if (!fingerprints || fingerprints.length === 0) {
                console.error("No fingerprints found in the health bundle file:", filePath);
                return { message: "No fingerprints found in the health bundle", code: "NO_FINGERPRINTS" };
            }
            let info = this.getInfoFromBundlePath(filePath);
            if (!info)
                throw new Error("Invalid health bundle file name format");
            this.brokenFingerprints = new Set(fingerprints);
            this.loadedHealthBundle = {
                file: filePath,
                date: info.date,
                gameVersion: info.gameVersion,
                type: info.type,
            };
            return this.loadedHealthBundle;
        }
        catch (error) {
            console.error("Error reading health bundle file:", error);
            return { message: "Error reading health bundle file", code: "READ_ERROR" };
        }
    }
    getInfoFromBundlePath(bundlePath) {
        const fileName = path_1.default.basename(bundlePath).toLowerCase().replace(".bin", "");
        const parts = fileName.split('_');
        if (parts.length != 5)
            throw new Error("Invalid health bundle file name format");
        const gameVersion = parts[3];
        const date = parseInt(parts[4]);
        const type = parts[2];
        return { gameVersion, type, date };
    }
    async getBrokenFiles() {
        if (this.loadedHealthBundle === undefined) {
            throw new Error("No health bundle loaded");
        }
        if (this.brokenFingerprints.size === 0)
            return [];
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex) {
            throw new Error("Database connection not available");
        }
        let selectionArray = [knex.raw('CAST(Files.ino AS TEXT) AS ino')];
        let defaultSelection = ["Files.mfolder", "Files.path", "Files.name", "Files.image", "Files.fingerprint", "Files.categories", "Files.merged", "Files.recolor", "Files.mtime", "Files.size", "Files.major", "Files.minor", "Files.type"];
        selectionArray.push(...defaultSelection);
        const batchSize = 1000; // Eine angemessene Batch-Größe für SQLite
        const brokenFingerprintsArray = Array.from(this.brokenFingerprints);
        let allBrokenFiles = [];
        for (let i = 0; i < brokenFingerprintsArray.length; i += batchSize) {
            const batch = brokenFingerprintsArray.slice(i, i + batchSize);
            let files = await knex("Files")
                .select(selectionArray)
                .whereIn("Files.fingerprint", batch);
            allBrokenFiles.push(...files);
        }
        return allBrokenFiles;
    }
    getFingerprintSet() {
        console.log({
            size: this.brokenFingerprints.size,
            bundle: this.loadedHealthBundle
        });
        return this.brokenFingerprints;
    }
}
exports.PlumbDexController = PlumbDexController;
