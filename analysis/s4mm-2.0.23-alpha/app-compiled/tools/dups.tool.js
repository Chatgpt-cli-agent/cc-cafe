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
exports.ToolDups = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const crc_32_1 = __importDefault(require("crc-32"));
const FilenameUtils_1 = require("../utils/FilenameUtils");
class ToolDups {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle('tool-dup', async (event, data) => {
            let result = {
                error: false,
                items: []
            };
            if (!data.type) {
                result.error = true;
                return result;
            }
            try {
                let list = await this.getDups(data.type);
                result.items = list;
                return result;
            }
            catch (error) {
                result.error = true;
                return result;
            }
        });
        electron_1.ipcMain.handle('tool-d1', async (event, data) => {
            if (!data.action)
                throw new Error("No action specified");
            if (data.action == "get") {
                let result = {
                    error: false,
                    items: []
                };
                try {
                    let list = await this.getD1();
                    result.items = list;
                    return result;
                }
                catch (error) {
                    result.error = true;
                    return result;
                }
            }
            else if (data.action == "rename") {
                if (!data.items || data.items.length == 0) {
                    throw new Error("No items to rename");
                }
                return await this.renameD1Items(data.items);
            }
            throw new Error("No action specified");
        });
    }
    async getDups(dupType) {
        let dups = [];
        if (dupType == "size") {
            dups = await this.getDupsContent();
        }
        else if (dupType == "clear_name") {
            dups = await this.getDupsName();
        }
        return dups;
    }
    async getDupsContent() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex) {
            throw new Error("Database not initialized");
        }
        let dups = [];
        let type = "size";
        let result = await knex("Files").select(type).groupBy(type).havingRaw('count(*) > 1');
        if (result.length == 0) {
            return dups;
        } // No Dups
        let sizeArr = [];
        for (let index = 0; index < result.length; index++) {
            const element = result[index];
            sizeArr.push(element.size);
        }
        let sel = [knex.raw('CAST(Files.ino AS TEXT) AS ino'), "path", "name", "image", "size", "mtime", "fingerprint"];
        let data = await knex("Files").select(sel).whereIn("size", sizeArr).orderBy([
            { column: 'size', order: 'desc' },
            { column: 'fingerprint' }
        ]);
        function crcPart(filePath) {
            let fileID = fs.openSync(filePath, 'r');
            let bufferSize = 2048;
            let size = (fs.statSync(filePath)).size;
            if (bufferSize > size)
                bufferSize = size - 1;
            let buf = Buffer.alloc(bufferSize);
            fs.readSync(fileID, buf, 0, bufferSize, (size - bufferSize - 1));
            fs.closeSync(fileID);
            let checksum = crc_32_1.default.buf(buf, 0);
            return checksum;
        }
        function handleGroup(group, lastFingerprint) {
            let pathSet = new Set();
            for (let index = group.length - 1; index >= 0; index--) {
                const element = group[index];
                let filepath = path_1.default.join(element.path, (0, FilenameUtils_1.clearName)(element.name));
                if (pathSet.has(filepath)) {
                    group.splice(index, 1);
                }
                pathSet.add(filepath);
            }
            if (lastFingerprint > 0 && group.length > 1) {
                dups.push(group);
            }
            else if (group.length > 1) {
                handelNoFingerprint(group);
            }
        }
        function handelNoFingerprint(group) {
            let crcMap = new Map();
            for (let index = 0; index < group.length; index++) {
                const element = group[index];
                let filePath = path_1.default.join(element.path, element.name);
                try {
                    let crcNumber = crcPart(filePath);
                    let data = crcMap.get(crcNumber);
                    if (!data) {
                        data = [];
                    }
                    data.push(element);
                    crcMap.set(crcNumber, data);
                }
                catch (error) {
                    console.log(error);
                }
            }
            let keys = Array.from(crcMap.keys());
            for (let index = 0; index < keys.length; index++) {
                let crcGroup = crcMap.get(keys[index]);
                if (crcGroup && crcGroup.length > 1) {
                    dups.push(crcGroup);
                }
            }
        }
        let lastSize = -1;
        let lastFingerPrint = -2;
        let lastGroup = [];
        for (let index = 0; index <= data.length; index++) {
            let size = -2;
            let fingerprint = -3;
            let element = undefined;
            if (index < data.length) {
                element = data[index];
                size = element.size;
                fingerprint = element.fingerprint;
                //Extend element data with last modified and created date
                let filePath = path_1.default.join(element.path, element.name);
                if (fs.existsSync(filePath)) {
                    let stats = fs.statSync(filePath);
                    element.mtime = Math.round(stats.mtimeMs);
                    //element.birthtime = Math.round(stats.birthtimeMs);
                }
                else {
                    element = undefined;
                }
            }
            if (size == lastSize && fingerprint == lastFingerPrint && element) {
                lastGroup.push(element);
            }
            else {
                handleGroup(lastGroup, lastFingerPrint);
                lastGroup = [];
                if (element) {
                    lastSize = size;
                    lastFingerPrint = fingerprint;
                    lastGroup.push(element);
                }
            }
        }
        return dups;
    }
    async getDupsName() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex) {
            throw new Error("Database not initialized");
        }
        let dups = [];
        let result = await knex("Files")
            .select("name")
            .groupBy("name")
            .havingRaw('count(*) > 1');
        if (result.length == 0) {
            return dups;
        } // No Dups
        let duplicateNames = result.map((item) => item.name);
        let sel = [knex.raw('CAST(Files.ino AS TEXT) AS ino'), "path", "name", "image", "size", "mtime", "fingerprint"];
        let data = await knex("Files").select(sel).whereIn("name", duplicateNames).orderBy("name");
        let lastName = "";
        let group = [];
        for (let index = 0; index <= data.length; index++) {
            let name = undefined;
            let element = undefined;
            if (index < data.length) {
                element = data[index];
                name = (0, FilenameUtils_1.clearName)(element.name);
            }
            if (name == lastName) {
                group.push(element);
            }
            else {
                if (group.length > 1) {
                    let pathSet = new Set();
                    for (let index = group.length - 1; index >= 0; index--) {
                        const element = group[index];
                        let filepath = path_1.default.join(element.path, (0, FilenameUtils_1.clearName)(element.name));
                        if (pathSet.has(filepath)) {
                            group.splice(index, 1);
                        }
                        pathSet.add(filepath);
                    }
                    if (group.length > 1)
                        dups.push(group);
                }
                group = [];
                if (element && name) {
                    lastName = name;
                    group.push(element);
                }
            }
        }
        return dups;
    }
    async getD1() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex) {
            throw new Error("Database not initialized");
        }
        let items = [];
        let result = await knex("Files").select(["name", knex.raw('CAST(Files.ino AS TEXT) AS ino'), "path", "image"]).whereLike("name", "[D%]%");
        function isDFile(name) {
            if (!name.startsWith("[D"))
                return false;
            let reg = /\[D[0-9]+\]/gm;
            return reg.test(name);
        }
        for (let index = 0; index < result.length; index++) {
            const element = result[index];
            if (isDFile((0, FilenameUtils_1.clearName)(element.name))) {
                let newName = (0, FilenameUtils_1.clearName)(element.name).substring((0, FilenameUtils_1.clearName)(element.name).indexOf("]") + 1);
                let newName_normal = element.name.substring(element.name.indexOf("]") + 1);
                let rename = path_1.default.join(element.path, newName);
                //let entriesWithName = await knex("Files").select(["id", "name", "clear_name", "path"]).where("clear_name", newName);
                element.rename = {
                    path: element.path,
                    name: newName_normal,
                    clear_name: newName,
                    existsLocal: fs.existsSync(rename),
                    existsSomewhere: false, //entriesWithName.length > 0,
                    files: [] //entriesWithName]
                };
                items.push(element);
            }
        }
        return items;
    }
    async renameD1Items(items) {
        //item type { ino: string, path: string, nameOld: string, newName: string }
        let result = {
            renamed: [],
            failed: 0
        };
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex) {
            throw new Error("Database not initialized");
        }
        for (let index = 0; index < items.length; index++) {
            let item = items[index];
            let oldPath = path_1.default.join(item.path, item.nameOld);
            let newPath = path_1.default.join(item.path, item.newName);
            if (newPath == oldPath)
                continue; //Nothing to do
            if (fs.existsSync(newPath)) {
                result.failed++;
                continue; //File already exists
            }
            try {
                fs.renameSync(oldPath, newPath);
                result.renamed.push({
                    ino: item.ino,
                    oldName: item.nameOld,
                    newName: item.newName
                });
                //Update database
                await knex("Files").where("ino", item.ino).update({
                    name: item.newName
                });
            }
            catch (error) {
                console.error("Error renaming file:", error);
                result.failed++;
                continue;
            }
        }
        return result;
    }
}
exports.ToolDups = ToolDups;
