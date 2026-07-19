"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveDataReader = void 0;
const protobuf = require("protobufjs");
var fs = require('fs');
const path = require('path');
const DBPFReader_js_1 = require("./DBPFReader.js");
class SaveDataReader {
    static get root() {
        if (this._root)
            return this._root;
        let time = Date.now();
        let schemaFile = path.join(__dirname, "files", "master_schema.proto");
        if (!fs.existsSync(schemaFile)) {
            throw new Error("Protobuf schema file not found: " + schemaFile);
        }
        this._root = protobuf.loadSync(schemaFile);
        this._root.resolveAll();
        console.log("[SAVEDATAREADER] Protobuf root loaded in ", Date.now() - time, "ms");
        return this._root;
    }
    static getSaveFileName(saveFilePath) {
        let root = this.root;
        if (!fs.existsSync(saveFilePath)) {
            throw new Error("Save file does not exist: " + saveFilePath);
        }
        let pack = new DBPFReader_js_1.Pack(saveFilePath);
        pack.checkFile();
        pack.calculateIndexList();
        if (pack.error) {
            throw new Error("Error reading save file: " + saveFilePath);
        }
        let saveDataEntry = pack.index_List.find(entry => entry.r_type === 0x0D);
        if (!saveDataEntry) {
            throw new Error("Save data entry not found in save file: " + saveFilePath);
        }
        const SaveGameDataNameOnly = root.lookupType("EA.Sims4.SaveGameDataNameOnly");
        let decoded = SaveGameDataNameOnly.decode(saveDataEntry.getByteArray());
        let object = SaveGameDataNameOnly.toObject(decoded, {
            enums: String,
            bytes: Buffer,
            defaults: true
        });
        object = SaveDataReader.convertLongObjects(object);
        if (!object.saveSlot || !object.saveSlot.slotName) {
            throw new Error("Slot name not found in save data entry in save file: " + saveFilePath);
        }
        return object.saveSlot.slotName;
    }
    static getSaveSlotNameFromBuffer(buffer) {
        let root = this.root;
        const SaveGameDataNameOnly = root.lookupType("EA.Sims4.SaveGameDataNameOnly");
        let decoded = SaveGameDataNameOnly.decode(buffer);
        let object = SaveGameDataNameOnly.toObject(decoded, {
            enums: String,
            bytes: Buffer,
            defaults: true
        });
        object = SaveDataReader.convertLongObjects(object);
        if (!object.saveSlot || !object.saveSlot.slotName) {
            throw new Error("Slot name not found in save data buffer.");
        }
        return object.saveSlot.slotName;
    }
    static getSaveDataObject(saveFilePath) {
        let root = this.root;
        if (!fs.existsSync(saveFilePath)) {
            throw new Error("Save file does not exist: " + saveFilePath);
        }
        let pack = new DBPFReader_js_1.Pack(saveFilePath);
        pack.checkFile();
        pack.calculateIndexList();
        if (pack.error) {
            throw new Error("Error reading save file: " + saveFilePath);
        }
        let saveDataEntry = pack.index_List.find(entry => entry.r_type === 0x0D);
        if (!saveDataEntry) {
            throw new Error("Save data entry not found in save file: " + saveFilePath);
        }
        const SaveGameData = root.lookupType("EA.Sims4.SaveGameData");
        let decoded = SaveGameData.decode(saveDataEntry.getByteArray());
        let object = SaveGameData.toObject(decoded, {
            enums: String,
            bytes: Buffer,
            defaults: true
        });
        return SaveDataReader.convertLongObjects(object);
    }
    static convertLongObjects(obj) {
        //Convert all {low: number, high: number, unsigned: bool} to 64bit hex strings recursively
        if (obj === null || obj === undefined)
            return obj;
        if (typeof obj !== "object")
            return obj;
        for (let key of Object.keys(obj)) {
            let val = obj[key];
            if (val && typeof val === "object") {
                if (typeof val.low === "number" && typeof val.high === "number" && typeof val.unsigned === "boolean") {
                    // Convert to hex string, handling unsigned correctly
                    let low = BigInt(val.low >>> 0);
                    let high = BigInt(val.high >>> 0);
                    let bigIntValue = (high << 32n) | low;
                    obj[key] = bigIntValue.toString(16).padStart(16, '0');
                }
                else {
                    obj[key] = SaveDataReader.convertLongObjects(val);
                }
            }
        }
        return obj;
    }
}
exports.SaveDataReader = SaveDataReader;
SaveDataReader._root = null;
