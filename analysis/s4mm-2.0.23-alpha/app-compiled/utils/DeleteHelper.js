"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteHelper = void 0;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const winTrash = require('win-trash');
const recyclebin = require('recycle-bin');
class DeleteHelper {
    static async deleteFile(filepath, directDelete = false) {
        if (!filepath)
            return true;
        if (!fs_1.default.existsSync(filepath))
            return true;
        if (directDelete) {
            fs_1.default.unlinkSync(filepath);
            return fs_1.default.existsSync(filepath) == false;
        }
        //First Method (Nativ electron)
        try {
            await electron_1.shell.trashItem(filepath);
            if (!fs_1.default.existsSync(filepath))
                return true;
        }
        catch (error) {
            console.log("[DELETE-FAILED] NATIV DELETE FAILED  - " + filepath);
            console.log(error);
        }
        //Only Windows
        try {
            if (process.platform == "win32") {
                await winTrash([filepath]);
                if (!fs_1.default.existsSync(filepath))
                    return true;
            }
        }
        catch (error) {
            console.log("[DELETE-FAILED] OTHER SHELL  - " + filepath);
            console.log(error);
        }
        //Rb
        try {
            await recyclebin([filepath]);
            if (!fs_1.default.existsSync(filepath))
                return true;
        }
        catch (error) {
            console.log("[DELETE-FAILED] recyclebin  - " + filepath);
            console.log(error);
        }
        return false;
    }
    static async deleteFolder(folderpath, directDelete = false) {
        if (!folderpath)
            return true;
        if (!fs_1.default.existsSync(folderpath))
            return true;
        if (directDelete) {
            fs_1.default.rmdirSync(folderpath, { recursive: true });
            return fs_1.default.existsSync(folderpath) == false;
        }
        //First Method (Nativ electron)
        try {
            await electron_1.shell.trashItem(folderpath);
            if (!fs_1.default.existsSync(folderpath))
                return true;
        }
        catch (error) {
            console.log("[DELETE-FAILED] NATIV DELETE FAILED  - " + folderpath);
            console.log(error);
        }
        //Only Windows
        try {
            if (process.platform == "win32") {
                await winTrash([folderpath]);
                if (!fs_1.default.existsSync(folderpath))
                    return true;
            }
        }
        catch (error) {
            console.log("[DELETE-FAILED] OTHER SHELL  - " + folderpath);
            console.log(error);
        }
        //Rb
        try {
            await recyclebin([folderpath]);
            if (!fs_1.default.existsSync(folderpath))
                return true;
        }
        catch (error) {
            console.log("[DELETE-FAILED] recyclebin  - " + folderpath);
            console.log(error);
        }
        return false;
    }
    static async deleteDataByInoFromDatabase(inos, knex) {
        if (!inos || inos.length == 0)
            return;
        try {
            await knex("Files").whereIn("ino", inos).delete();
            await knex("Entries").whereIn("ino", inos).delete();
            await knex("CasPart").whereIn("ino", inos).delete();
            await knex("CobjCom").whereIn("ino", inos).delete();
        }
        catch (error) {
            console.error("[DELETE-FAILED] Failed to delete data by ino from database", error);
        }
    }
}
exports.DeleteHelper = DeleteHelper;
