"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUtils = void 0;
const { shell } = require('electron');
var isMac = process.platform === "darwin";
const winTrash = require('win-trash');
const recyclebin = require('recycle-bin');
var fs = require('fs');
class FileUtils {
    static async deleteFile(filepath, trash) {
        let firstTry = false;
        let secondTry = false;
        let thirdTry = false;
        let fourthTry = false;
        let fifthTry = false;
        console.log("[DELETE-INFO] Try to delete:  - " + filepath);
        //First Try Nativ Electron
        try {
            await shell.trashItem(filepath);
            firstTry = true;
        }
        catch (error) {
            console.log("[DELETE-FAILED] NATIV DELETE FAILED  - " + filepath);
            console.log(error);
        }
        if (firstTry && !fs.existsSync(filepath))
            return true;
        //Trash NPM Modual
        try {
            await trash.default(filepath);
            secondTry = true;
        }
        catch (error) {
            console.log("[DELETE-FAILED] NPM TRASH  - " + filepath);
            console.log(error);
        }
        if (secondTry && !fs.existsSync(filepath))
            return;
        //Only Windows
        try {
            if (!isMac) {
                await winTrash([filepath]);
                thirdTry = true;
            }
        }
        catch (error) {
            console.log("[DELETE-FAILED] OTHER SHELL  - " + filepath);
            console.log(error);
        }
        if (thirdTry && !fs.existsSync(filepath))
            return;
        //Trash array
        try {
            await trash.default([filepath]);
            fourthTry = true;
        }
        catch (error) {
            console.log("[DELETE-FAILED] TRASH ARRAY  - " + filepath);
            console.log(error);
        }
        if (fourthTry && !fs.existsSync(filepath))
            return;
        //Rb
        try {
            await recyclebin([filepath]);
            fifthTry = true;
        }
        catch (error) {
            console.log("[DELETE-FAILED] recyclebin  - " + filepath);
            console.log(error);
        }
        if (fifthTry && !fs.existsSync(filepath))
            return;
        throw new Error('[DELETE-FAILED] ALL WAYS');
    }
    static async deleteAllByIno(knex, ino) {
        await knex.from('CasParts').del().where('ino', ino);
        await knex.from('Casp').del().where('ino', ino);
        await knex.from('Cobj').del().where('ino', ino);
        await knex.from('Entries').del().where('ino', ino);
        await knex.from('Files').del().where('ino', ino);
        await knex.from('Thumbnails').del().where('ino', ino);
    }
}
exports.FileUtils = FileUtils;
