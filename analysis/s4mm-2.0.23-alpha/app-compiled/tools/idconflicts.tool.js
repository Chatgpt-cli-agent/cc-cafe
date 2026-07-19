"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolIDConflicts = void 0;
const electron_1 = require("electron");
class ToolIDConflicts {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("tool-idconflicts", async (event, data) => {
            switch (data.action) {
                case "check":
                    return await this.checkForConflicts();
                case "reset":
                    return await this.resetWorking();
                case "set-working":
                    return await this.setWorking(data.ino, data.working);
                default:
                    throw new Error("Unknown action for ToolIDConflicts: " + data.action);
            }
        });
    }
    async checkForConflicts() {
        let time = Date.now();
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not connected");
        let [rawEntries, rawFiles] = await Promise.all([
            knex('Entries as e1')
                .where('e1.type', '>=', 0)
                .andWhere('e1.group', '>=', 0)
                .andWhere('e1.type', '<>', 2142678410)
                .andWhere('e1.instance', '<>', "0000000000000000")
                .select([
                knex.raw('CAST(e1.ino AS TEXT) AS ino'),
                knex.raw('CAST(e1.address AS TEXT) AS address')
            ]),
            knex('Files')
                .where('checked', '=', 0)
                .select([knex.raw('CAST(Files.ino AS TEXT) AS ino'), "path", "name", "image"])
        ]);
        console.log({
            entriesCount: rawEntries.length,
            filesCount: rawFiles.length
        });
        // Files Mapping
        let inoFilesMap = new Map();
        rawFiles.forEach((file) => {
            inoFilesMap.set(file.ino, file);
        });
        //Entries Mapping
        let addressMap = new Map();
        let inoMap = new Map();
        for (let index = 0; index < rawEntries.length; index++) {
            const element = rawEntries[index];
            let ino = element.ino;
            let address = element.address;
            //Ino
            let inoObj = new Set();
            if (inoMap.has(ino))
                inoObj = inoMap.get(ino);
            inoObj.add(address);
            inoMap.set(ino, inoObj);
            //Address
            let addressObj = new Set();
            if (addressMap.has(address))
                addressObj = addressMap.get(address);
            addressObj.add(ino);
            addressMap.set(address, addressObj);
            //let p = Math.ceil((index + 1) / rawEntries.length * 50);
            //eventSender(event,channel, { "value": p, "max": rawEntries.length, "title": title, "close": false });
        }
        rawEntries = [];
        //Creating Matchings
        let results = [];
        for (let index = 0; index < rawFiles.length; index++) {
            const file = rawFiles[index];
            if (!inoMap.has(file.ino))
                continue;
            let addressArr = Array.from(inoMap.get(file.ino));
            let result = undefined;
            for (let j = 0; j < addressArr.length; j++) {
                const address = addressArr[j];
                let filesSet = new Set(addressMap.get(address));
                filesSet.delete(file.ino);
                if (filesSet.size == 0)
                    continue;
                let filesArr = Array.from(filesSet);
                if (result == undefined) {
                    result = {
                        id: file.ino,
                        name: file.name,
                        image: file.image,
                        path: file.path,
                        connections: new Map()
                    };
                }
                for (let p = 0; p < filesArr.length; p++) {
                    const otherIno = filesArr[p];
                    let connectionItem = undefined;
                    if (result.connections.has(otherIno)) {
                        connectionItem = result.connections.get(otherIno);
                    }
                    else {
                        let inoFile = inoFilesMap.get(otherIno);
                        if (inoFile) {
                            connectionItem = {
                                id: inoFile.ino,
                                name: inoFile.name,
                                image: inoFile.image,
                                path: inoFile.path,
                                address: new Set()
                            };
                        }
                    }
                    if (connectionItem == undefined)
                        continue;
                    connectionItem.address.add(address);
                    result.connections.set(otherIno, connectionItem);
                }
            }
            //Fix
            if (result) {
                result.connections = Array.from(result.connections.values());
                for (let j = 0; j < result.connections.length; j++) {
                    const element = result.connections[j];
                    element.address = Array.from(element.address);
                }
                if (result.connections.length > 0)
                    results.push(result);
            }
            //let p = Math.ceil((index + 1) / rawFiles.length * 50) + 50;
            //eventSender(event,channel, { "value": p, "max": rawFiles.length, "title": title, "close": false });
        }
        let resultObj = { items: results, time: Date.now() - time };
        console.log("ID Conflicts found: " + results.length + " in " + (Date.now() - time) + "ms");
        return resultObj;
    }
    async resetWorking() {
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not connected");
        await knex('Files').update({ checked: 0 });
        console.log("Reset ID Conflict working files");
        return { status: "success" };
    }
    async setWorking(ino, working) {
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database not connected");
        await knex('Files').where('ino', ino).update({ checked: working ? 1 : 0 });
        console.log(`Set ID Conflict working file ${ino} to ${working}`);
        return { status: "success" };
    }
}
exports.ToolIDConflicts = ToolIDConflicts;
