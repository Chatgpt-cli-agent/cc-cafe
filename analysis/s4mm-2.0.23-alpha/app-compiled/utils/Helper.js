"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Helper = void 0;
var fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const AdmZip = require("adm-zip");
const FilenameUtils_1 = require("../utils/FilenameUtils");
const Fingerprint_1 = require("./Fingerprint");
class Helper {
    static setToString(set) {
        return Array.from(set).join(':');
    }
    static numberSetToHexString(set) {
        let st = [];
        let arr = Array.from(set);
        for (let index = 0; index < arr.length; index++) {
            st.push(arr[index].toString(16).padStart(4, "0"));
        }
        return st.join(':');
    }
    static fixMacPath(path) {
        let result = this.replaceAll(path, "\\ ", " ");
        ;
        return result;
    }
    static replaceAll(str, find, replace) {
        return str.replace(new RegExp(this.escapeRegExp(find), 'g'), replace);
    }
    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
    static clearName(name) {
        return (0, FilenameUtils_1.clearName)(name);
    }
    static writeReadme(file) {
        let content = "Thank you for using Sims 4 Mod Manager <3\n\n[What is in this folder?]\nIn this folder data like thumbnails, log files or file\nproperties are stored. This data has NOTHING to do with\nthe actual game! You can delete this folder if you have\nuninstalled Sims 4 Mod Manager.";
        fs.writeFile(file, content, function (err) {
            //Is not important
        });
    }
    static hashFile(filepath) {
        return new Promise((resolve, reject) => {
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filepath);
            stream.on('data', (data) => {
                hash.update(data);
            });
            stream.on('end', () => {
                resolve(hash.digest('hex'));
            });
            stream.on('error', (err) => {
                reject(err);
            });
        });
    }
    //Folder Unpacker
    static handleZipFiles(tmpFolder, fileList) {
        let result = [];
        //Clean Folder
        if (fs.existsSync(tmpFolder))
            fsExtra.emptyDirSync(tmpFolder);
        let simpleFiles = [];
        let basicFiles = { "name": "Simple Files", "files": simpleFiles, "good": true };
        let zipFiles = [];
        let rarFiles = [];
        let other = [];
        for (let index = 0; index < fileList.length; index++) {
            const element = fileList[index];
            let filename = element.name;
            let fingerprint = null;
            try {
                fingerprint = Fingerprint_1.Fingerprint.computeFile(element.path);
            }
            catch (error) {
                console.log(error);
            }
            element.fingerprint = fingerprint;
            if ((0, FilenameUtils_1.isSims4File)(filename)) {
                simpleFiles.push(element);
            }
            else if (filename.endsWith(".zip")) {
                zipFiles.push(element);
            }
            else if (filename.endsWith(".rar")) {
                rarFiles.push(element);
            }
            else {
                other.push(element);
            }
        }
        if (simpleFiles.length != 0) {
            basicFiles.files = simpleFiles;
            result.push(basicFiles);
        }
        //Unzip Files
        for (let index = 0; index < zipFiles.length; index++) {
            try {
                const element = zipFiles[index];
                let destionation = tmpFolder + path.sep + element.name.replace(".zip", "") + "_ZIP";
                if (fs.existsSync(destionation)) {
                    fsExtra.emptyDirSync(destionation);
                }
                //console.log("Destination: "+destionation);
                //console.log("Path: "+element.path);
                //fs.mkdirSync(destionation);
                let zip = new AdmZip(element.path);
                zip.extractAllTo(destionation, true);
                let files = this.getFilesFromFolder(destionation);
                if (files.length > 0) {
                    let ep = { "name": element.name, "files": files, "good": true, "fingerprint": null };
                    //console.log("files: "+files);
                    result.push(ep);
                }
            }
            catch (err) {
                console.log("internal");
                console.log(err);
            }
        }
        if (other.length != 0) {
            let ep = { "name": "Not supported", "files": other, "good": false };
            result.push(ep);
        }
        return result;
    }
    static getFilesFromFolder(folder) {
        if (!fs.existsSync(folder)) {
            return [];
        }
        let files = [];
        let arr = fs.readdirSync(folder);
        //console.log(folder+" "+arr.length);
        arr.forEach((file) => {
            let filePath = folder + path.sep + file;
            if (fs.lstatSync(filePath).isDirectory()) {
                this.getFilesFromFolder(filePath).forEach((element => {
                    files.push(element);
                }));
            }
            else if (!file.endsWith(".DS_Store")) {
                let obj = { "name": file, "path": filePath };
                let fingerprint = null;
                try {
                    fingerprint = Fingerprint_1.Fingerprint.computeFile(filePath);
                }
                catch (error) {
                    console.log(error);
                }
                obj.fingerprint = fingerprint;
                files.push(obj);
            }
        });
        return files;
    }
    static calcMFolder(folderpath, mainApp) {
        let modsFolder = mainApp.settings.s_path_mod;
        if (!folderpath.startsWith(modsFolder)) {
            return "";
        }
        let subPath = folderpath.substring(modsFolder.length + 1, folderpath.length);
        let parts = subPath.split(path.sep);
        return parts[0];
    }
    static calcMFolderWithPath(folderpath, modsFolder) {
        if (!folderpath.startsWith(modsFolder)) {
            return "";
        }
        let subPath = folderpath.substring(modsFolder.length + 1, folderpath.length);
        let parts = subPath.split(path.sep);
        return parts[0];
    }
    static convertToHex(value) {
        // Check if the value is in scientific notation
        if (value.includes('e')) {
            // Split the scientific notation into base and exponent
            const [base, exponent] = value.split('e').map((part) => part.trim());
            const decimalPart = base.replace('.', ''); // Remove the decimal point
            const decimalPlaces = base.includes('.') ? base.split('.')[1].length : 0;
            // Calculate the full integer value as a string
            const fullIntegerString = BigInt(decimalPart) * BigInt(10) ** BigInt(Number(exponent) - decimalPlaces);
            // Convert the BigInt to a hexadecimal string
            return fullIntegerString.toString(16);
        }
        // If not in scientific notation, directly convert to BigInt and then to hex
        return BigInt(value).toString(16);
    }
}
exports.Helper = Helper;
function fixMacPath(path) {
    let result = replaceAll(path, "\\ ", " ");
    ;
    return result;
}
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
