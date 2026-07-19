"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameOptions = void 0;
const path = require('path');
const fs = require('fs');
const readline = require('readline');
class GameOptions {
    static async readOptions(optionsFilePath) {
        //No Files
        if (!fs.existsSync(optionsFilePath)) {
            return undefined;
        }
        //Read files
        let options = {};
        const fileStream = fs.createReadStream(optionsFilePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        for await (const line of rl) {
            //console.log(`Line from file: ${line}`);
            if (line && line.includes("=")) {
                let arr = line.split("=");
                let key = arr[0].trim();
                let value = arr[1].trim();
                if (/^\d+$/.test(value)) {
                    value = Number(value);
                }
                options[key] = value;
            }
        }
        return options;
    }
    static getOptionsFile(gameFolderDocuments) {
        //No Folder
        if (!gameFolderDocuments || !fs.existsSync(gameFolderDocuments)) {
            return undefined;
        }
        let file = path.join(gameFolderDocuments, "Options.ini");
        //No File
        if (fs.existsSync(file)) {
            return file;
        }
        return undefined;
    }
    static async getOptionsInfo(gameFolderDocuments) {
        let error = {
            error: "File not found!",
            error_code: 1
        };
        let file = this.getOptionsFile(gameFolderDocuments);
        if (!file)
            return error;
        try {
            let options = await this.readOptions(file);
            if (!options) {
                return {
                    error: "File not found!",
                    error_code: 1
                };
            }
            return options;
        }
        catch (error_msg) {
            return {
                error: error_msg,
                error_code: 2
            };
        }
    }
    static async writeOptions(gameFolderDocuments, keyValuePair) {
        let file = this.getOptionsFile(gameFolderDocuments);
        if (!file)
            return false;
        if (!keyValuePair || !keyValuePair.key || keyValuePair.value == undefined)
            return false;
        try {
            const fileStream = fs.createReadStream(file);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            let data = "";
            for await (const line of rl) {
                let isKey = false;
                if (line && line.includes("=")) {
                    let arr = line.split("=");
                    let key = arr[0].trim();
                    if (key == keyValuePair.key) {
                        isKey = true;
                        data += key + " = " + keyValuePair.value + "\r\n";
                    }
                }
                if (!isKey) {
                    data += line + "\r\n";
                }
            }
            fs.writeFileSync(file, data);
            //console.log(data);
        }
        catch (error) {
            console.log(error);
            return false;
        }
        return true;
    }
}
exports.GameOptions = GameOptions;
