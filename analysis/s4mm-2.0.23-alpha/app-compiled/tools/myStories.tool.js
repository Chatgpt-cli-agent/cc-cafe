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
exports.ToolMyStories = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
class ToolMyStories {
    constructor(main) {
        this.idMap = new Map();
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-my-stories", async (event, args) => {
            switch (args.action) {
                case "get-all-local-stories":
                    return this.getAllLocalStories();
                case "create-new-story":
                    return this.createNewStory(args.name);
                case "get-story-by-id":
                    if (!args.id)
                        throw new Error("No id provided");
                    return this.getStoryById(args.id);
                case "delete-story-by-id":
                    if (!args.id)
                        throw new Error("No id provided");
                    return this.deleteStoryById(args.id);
            }
            throw new Error("Unknown action");
        });
    }
    getAllLocalStories() {
        let stories = [];
        //Get local stories directory
        let localStoriesDir = this.mainApp.folderStructureController.getFolder("local-stories");
        if (!localStoriesDir || !fs.existsSync(localStoriesDir))
            return stories;
        let dirs = fs.readdirSync(localStoriesDir);
        for (let d of dirs) {
            let fullPath = path_1.default.join(localStoriesDir, d);
            let infoFile = path_1.default.join(fullPath, "info.json");
            if (fs.existsSync(infoFile)) {
                try {
                    let infoData = fs.readFileSync(infoFile, "utf-8");
                    let infoObj = JSON.parse(infoData);
                    infoObj.basePath = fullPath;
                    stories.push(infoObj);
                }
                catch (err) {
                    console.error("Error reading story info file:", infoFile, err);
                }
            }
        }
        return stories;
    }
    createNewStory(name) {
        let localStoriesDir = this.mainApp.folderStructureController.getFolder("local-stories");
        if (!localStoriesDir || !fs.existsSync(localStoriesDir))
            throw new Error("Local stories folder does not exist");
        let folderIno = fs.statSync(localStoriesDir).ino;
        let id = Date.now() + folderIno + "";
        let infoObj = {
            name: name || "New Story",
            id: id,
            created: Date.now(),
            modified: Date.now(),
            description: "",
            thumbnail: ""
        };
        //Create folder
        let storyFolder = path_1.default.join(localStoriesDir, id);
        if (fs.existsSync(storyFolder))
            throw new Error("Story folder already exists");
        fs.mkdirSync(storyFolder);
        //Create info file
        let infoFile = path_1.default.join(storyFolder, "info.json");
        fs.writeFileSync(infoFile, JSON.stringify(infoObj, null, 2));
        infoObj.basePath = storyFolder;
        return infoObj;
    }
    deleteStoryById(id) {
        let localStoriesDir = this.mainApp.folderStructureController.getFolder("local-stories");
        if (!localStoriesDir || !fs.existsSync(localStoriesDir))
            throw new Error("Local stories folder does not exist");
        let storyFolder = path_1.default.join(localStoriesDir, id);
        if (!fs.existsSync(storyFolder))
            return false;
        fs.rmdirSync(storyFolder, { recursive: true });
        return true;
    }
    getStoryById(id) {
        let localStoriesDir = this.mainApp.folderStructureController.getFolder("local-stories");
        if (!localStoriesDir || !fs.existsSync(localStoriesDir))
            throw new Error("Local stories folder does not exist");
        let storyFolder = path_1.default.join(localStoriesDir, id);
        if (!fs.existsSync(storyFolder))
            return undefined;
        let infoFile = path_1.default.join(storyFolder, "info.json");
        if (!fs.existsSync(infoFile))
            return undefined;
        let infoData = fs.readFileSync(infoFile, "utf-8");
        let infoObj = JSON.parse(infoData);
        infoObj.basePath = storyFolder;
        return infoObj;
    }
}
exports.ToolMyStories = ToolMyStories;
