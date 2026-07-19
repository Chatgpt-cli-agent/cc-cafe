"use strict";
exports.__esModule = true;
exports.Helper = void 0;
var fs = require('fs');
var fsExtra = require('fs-extra');
var path = require('path');
var AdmZip = require("adm-zip");
var curseforge = require('@meza/curseforge-fingerprint');
var NAMEUTIL = require('./FilenameUtil.js');
var Helper = /** @class */ (function () {
    function Helper() {
    }
    Helper.setToString = function (set) {
        return Array.from(set).join(':');
    };
    Helper.numberSetToHexString = function (set) {
        var st = [];
        var arr = Array.from(set);
        for (var index = 0; index < arr.length; index++) {
            st.push(arr[index].toString(16).padStart(4, "0"));
        }
        return st.join(':');
    };
    Helper.fixMacPath = function (path) {
        var result = this.replaceAll(path, "\\ ", " ");
        ;
        return result;
    };
    Helper.replaceAll = function (str, find, replace) {
        return str.replace(new RegExp(this.escapeRegExp(find), 'g'), replace);
    };
    Helper.escapeRegExp = function (string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    };
    Helper.clearName = function (name) {
        return NAMEUTIL.clearName(name);
    };
    Helper.writeReadme = function (file) {
        var content = "Thank you for using Sims 4 Mod Manager <3\n\n[What is in this folder?]\nIn this folder data like thumbnails, log files or file\nproperties are stored. This data has NOTHING to do with\nthe actual game! You can delete this folder if you have\nuninstalled Sims 4 Mod Manager.";
        fs.writeFile(file, content, function (err) {
            //Is not important
        });
    };
    //Folder Unpacker
    Helper.handleZipFiles = function (tmpFolder, fileList) {
        var result = [];
        //Clean Folder
        if (fs.existsSync(tmpFolder))
            fsExtra.emptyDirSync(tmpFolder);
        var simpleFiles = [];
        var basicFiles = { "name": "Simple Files", "files": simpleFiles, "good": true };
        var zipFiles = [];
        var rarFiles = [];
        var other = [];
        for (var index = 0; index < fileList.length; index++) {
            var element = fileList[index];
            var filename = element.name;
            var fingerprint = null;
            try {
                fingerprint = curseforge.fingerprint(element.path);
            }
            catch (error) {
                console.log(error);
            }
            element.fingerprint = fingerprint;
            if (NAMEUTIL.isSims4File(filename)) {
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
        for (var index = 0; index < zipFiles.length; index++) {
            try {
                var element = zipFiles[index];
                var destionation = tmpFolder + path.sep + element.name.replace(".zip", "") + "_ZIP";
                if (fs.existsSync(destionation)) {
                    fsExtra.emptyDirSync(destionation);
                }
                //console.log("Destination: "+destionation);
                //console.log("Path: "+element.path);
                //fs.mkdirSync(destionation);
                var zip = new AdmZip(element.path);
                zip.extractAllTo(destionation, true);
                var files = this.getFilesFromFolder(destionation);
                if (files.length > 0) {
                    var ep = { "name": element.name, "files": files, "good": true, "fingerprint": null };
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
            var ep = { "name": "Not supported", "files": other, "good": false };
            result.push(ep);
        }
        return result;
    };
    Helper.getFilesFromFolder = function (folder) {
        var _this = this;
        if (!fs.existsSync(folder)) {
            return [];
        }
        var files = [];
        var arr = fs.readdirSync(folder);
        //console.log(folder+" "+arr.length);
        arr.forEach(function (file) {
            var filePath = folder + path.sep + file;
            if (fs.lstatSync(filePath).isDirectory()) {
                _this.getFilesFromFolder(filePath).forEach((function (element) {
                    files.push(element);
                }));
            }
            else if (!file.endsWith(".DS_Store")) {
                var obj = { "name": file, "path": filePath };
                var fingerprint = null;
                try {
                    fingerprint = curseforge.fingerprint(filePath);
                }
                catch (error) {
                    console.log(error);
                }
                obj.fingerprint = fingerprint;
                files.push(obj);
            }
        });
        return files;
    };
    return Helper;
}());
exports.Helper = Helper;
function fixMacPath(path) {
    var result = replaceAll(path, "\\ ", " ");
    ;
    return result;
}
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
