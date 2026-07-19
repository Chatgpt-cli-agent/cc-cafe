"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.PackageOperations = void 0;
var DBPFReader_1 = require("./DBPFReader");
var fs = require('fs');
var path = require('path');
var _dbpf = require('./DBPFReader.js');
var PackageOperations = /** @class */ (function () {
    function PackageOperations() {
    }
    /**
     *
     *
     * @param file Path of the merged file
     * @param destination Path were results should be saved to
     * @param mergeFolder Path of temp folder to write fileparts to
     * @param relevantPackages Subfiles that need to be modified
     * @param mode Type of action (0 - export & keep | 1 - export & remove | 2 - remove)
     */
    PackageOperations.unmergeFile = function (file, destination, mergeFolder, relevantPackages, mode) {
        var pack = new DBPFReader_1.Pack(file);
        pack.checkFile();
        if (pack.error)
            throw new Error("Error in reading pack: " + file);
        pack.calculateIndexList();
        if (!pack.isS4SMerged)
            throw new Error("No merge manifest found in: " + file);
        if (!fs.existsSync(destination) && mode != 2)
            throw new Error("Invalid destination: " + destination);
        if (!fs.existsSync(mergeFolder) && mode != 2)
            throw new Error("Invalid merge folder: " + mergeFolder);
        //Current manifest
        var mainifest = pack.getS4SMergedManifestComplete();
        var mainifestObj = mainifest.toObj();
        var mPackages = mainifestObj.packages;
        //EntriesMap
        var entries = pack.index_List;
        var entriesMap = new Map();
        for (var index = 0; index < entries.length; index++) {
            var entrie = entries[index];
            entriesMap.set(entrie.getKey(), entrie);
        }
        //Create new files 
        var newPackages = [];
        if (mode == 0 || mode == 1) {
            for (var index = 0; index < relevantPackages.length; index++) {
                var fileInfo = relevantPackages[index];
                var name_1 = fileInfo.name;
                var resources = fileInfo.resources;
                var packFolder = path.join(mergeFolder, Date.now() + "_" + name_1);
                fs.mkdirSync(packFolder);
                if (!fs.existsSync(packFolder))
                    throw new Error("Failed to create unmerge subfolder");
                var fileEntries = [];
                //Export files
                for (var index_1 = 0; index_1 < resources.length; index_1++) {
                    var key = resources[index_1];
                    if (!entriesMap.has(key))
                        throw new Error("Package contains incomplete files: " + name_1);
                    var entrieFromMap = entriesMap.get(key);
                    if (!entrieFromMap)
                        throw new Error("Item not in map");
                    var entrie = entrieFromMap;
                    var entrieFile = path.join(packFolder, key + ".bnry");
                    var entrieContent = entrie === null || entrie === void 0 ? void 0 : entrie.getByteArrayRaw();
                    if (!entrieContent || entrieContent.length == 0)
                        throw new Error("Package contains empty files: " + key);
                    fs.writeFileSync(entrieFile, entrieContent);
                    if (!fs.existsSync)
                        throw new Error("Package failed to save part file: " + key);
                    var newEntrie = new DBPFReader_1.IndexEnty(entrieFile, entrie.r_type, entrie.r_group, entrie.i_hi, entrie.i_lo, 0, entrie.filesize, entrie.memsize, entrie.com, entrie.unknown);
                    fileEntries.push(newEntrie);
                }
                //Create and save new package file
                var fileName = name_1 + ".package";
                var newFile = path.join(packFolder, fileName);
                var newPack = new DBPFReader_1.Pack(newFile);
                newPack.index_List = fileEntries;
                newPack.saveToFile(newFile);
                if (!fs.existsSync(newFile))
                    throw new Error("Failed to create new package file: " + fileName);
                newPackages.push({
                    filepath: newFile,
                    packageName: name_1,
                    folder: packFolder
                });
            }
        }
        //Remove old versions
        if (mode > 0) {
            var keepPackages = __spreadArray([], mPackages, true);
            var keepResources = new Set();
            for (var index = keepPackages.length - 1; index >= 0; index--) {
                var element = keepPackages[index];
                var keep = true;
                for (var i = 0; i < relevantPackages.length; i++) {
                    if (_dbpf.S4SMMFile.compareObjs(relevantPackages[i], element)) {
                        keepPackages.splice(index, 1);
                        i = relevantPackages.length;
                        keep = false;
                    }
                }
                if (keep) {
                    for (var i = 0; i < element.resources.length; i++) {
                        keepResources.add(element.resources[i]);
                    }
                }
            }
            //Remove all resources from the package
            for (var index = 0; index < relevantPackages.length; index++) {
                var fileInfo = relevantPackages[index];
                var resources = fileInfo.resources;
                for (var i = 0; i < resources.length; i++) {
                    var key = resources[i];
                    if (!keepResources.has(key))
                        pack.removeEntryByKey(key);
                }
            }
            //Redo the Mainifest
            var nM = new DBPFReader_1.S4SMMFile();
            nM.version = 1;
            nM.name = mainifest.name;
            nM.setPackagesFromObjFrom(keepPackages);
            if (mainifest.key)
                pack.removeEntryByKey(mainifest.key);
            var nMBuffer = nM.toBuffer();
            var nMEntri = new DBPFReader_1.IndexEnty("", 0x7FB6AD8A, 0, 0, 0, 0, nMBuffer.length, nMBuffer.length, 0, 1);
            nMEntri.setBuffer(nMBuffer);
            pack.index_List.push(nMEntri);
            console.log(fs.statSync(file).ino);
            pack.saveToFile(file);
            console.log(fs.statSync(file).ino);
        }
        //Move files to destination
        for (var index = 0; index < newPackages.length; index++) {
            var newPackage = newPackages[index];
            var baseName = newPackage.packageName;
            var ext = ".package";
            var dir = destination;
            var counter = 1;
            var des = path.join(dir, baseName + ext);
            while (fs.existsSync(des)) {
                des = path.join(dir, "".concat(baseName, "(").concat(counter, ")").concat(ext));
                counter++;
            }
            fs.copyFileSync(newPackage.filepath, des);
            fs.rm(newPackage.folder, { recursive: true, force: true }, function (err) {
                if (err) {
                    throw err;
                }
            });
        }
    };
    PackageOperations.removeFromMerged = function (file, relevantPackages) {
        this.unmergeFile(file, "", "", relevantPackages, 2);
    };
    PackageOperations.removeFromMergedAndCopyTo = function (file, destination, mergeFolder, relevantPackages) {
        this.unmergeFile(file, destination, mergeFolder, relevantPackages, 1);
    };
    PackageOperations.copyToFromMerged = function (file, destination, mergeFolder, relevantPackages) {
        this.unmergeFile(file, destination, mergeFolder, relevantPackages, 0);
    };
    PackageOperations.unmergeAllTo = function (file, destination, mergeFolder) {
        var pack = new _dbpf.Pack(file);
        pack.checkFile();
        if (pack.error)
            throw new Error("Error in reading pack: " + file);
        pack.calculateIndexList();
        if (!pack.isS4SMerged)
            throw new Error("No merge manifest found in: " + file);
        if (!fs.existsSync(destination))
            throw new Error("Invalid destination: " + destination);
        if (!fs.existsSync(mergeFolder))
            throw new Error("Invalid merge folder: " + mergeFolder);
        var mainifest = pack.getS4SMergedManifest();
        this.unmergeFile(file, destination, mergeFolder, mainifest.packages, 0);
    };
    return PackageOperations;
}());
exports.PackageOperations = PackageOperations;
