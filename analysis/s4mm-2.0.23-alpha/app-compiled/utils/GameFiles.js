"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameFiles = void 0;
var fs = require('fs');
const path = require('path');
class GameFiles {
    static getGameVersion(folder) {
        let file = path.join(folder, "GameVersion.txt");
        let v = "-";
        if (!fs.existsSync(file))
            return v;
        try {
            let data = fs.readFileSync(file, 'utf8').trim();
            v = data.replace(/\0/g, '');
            v = v.replace(/[^0-9.]/g, '');
        }
        catch (err) {
        }
        return v;
    }
    static getInstalledPacks(gameFolderPath, isMac) {
        if (!gameFolderPath || !fs.existsSync(gameFolderPath))
            return undefined;
        let folder = gameFolderPath;
        //Mac
        if (isMac) {
            let base = path.join(path.dirname(path.dirname(gameFolderPath)), "The Sims 4 Packs");
            if (!base || !fs.existsSync(base))
                return undefined;
            folder = base;
        }
        let items = fs.readdirSync(folder);
        let packs = [];
        for (let index = 0; index < items.length; index++) {
            const itemname = items[index];
            if (itemname.startsWith("EP") || itemname.startsWith("GP") || itemname.startsWith("SP")) {
                packs.push(itemname);
            }
        }
        return packs;
    }
}
exports.GameFiles = GameFiles;
GameFiles.gameIds_version = undefined;
GameFiles.gameIDs_small = new Set();
