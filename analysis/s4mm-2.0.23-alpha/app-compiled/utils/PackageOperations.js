"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageOperations = void 0;
const DBPFReader_1 = require("../sims/DBPFReader");
var fs = require('fs');
const path = require('path');
class PackageOperations {
    /**
     *
     *
     * @param file Path of the merged file
     * @param destination Path were results should be saved to
     * @param mergeFolder Path of temp folder to write fileparts to
     * @param relevantPackages Subfiles that need to be modified
     * @param mode Type of action (0 - export & keep | 1 - export & remove | 2 - remove)
     */
    static unmergeFile(file, destination, mergeFolder, relevantPackages, mode) {
        let pack = new DBPFReader_1.Pack(file);
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
        let mainifest = pack.getS4SMergedManifestComplete();
        let mainifestObj = mainifest.toObj();
        let mPackages = mainifestObj.packages;
        //EntriesMap
        let entries = pack.index_List;
        let entriesMap = new Map();
        for (let index = 0; index < entries.length; index++) {
            const entrie = entries[index];
            entriesMap.set(entrie.getKey(), entrie);
        }
        //Create new files 
        let newPackages = [];
        if (mode == 0 || mode == 1) {
            for (let index = 0; index < relevantPackages.length; index++) {
                const fileInfo = relevantPackages[index];
                const name = fileInfo.name;
                const resources = fileInfo.resources;
                let packFolder = path.join(mergeFolder, Date.now() + "_" + name);
                fs.mkdirSync(packFolder);
                if (!fs.existsSync(packFolder))
                    throw new Error("Failed to create unmerge subfolder");
                let fileEntries = [];
                //Export files
                for (let index = 0; index < resources.length; index++) {
                    const key = resources[index];
                    if (!entriesMap.has(key))
                        throw new Error("Package contains incomplete files: " + name);
                    let entrieFromMap = entriesMap.get(key);
                    if (!entrieFromMap)
                        throw new Error("Item not in map");
                    let entrie = entrieFromMap;
                    let entrieFile = path.join(packFolder, key + ".bnry");
                    let entrieContent = entrie?.getByteArrayRaw();
                    if (!entrieContent || entrieContent.length == 0)
                        throw new Error("Package contains empty files: " + key);
                    fs.writeFileSync(entrieFile, entrieContent);
                    if (!fs.existsSync)
                        throw new Error("Package failed to save part file: " + key);
                    let newEntrie = new DBPFReader_1.IndexEnty(entrieFile, entrie.r_type, entrie.r_group, entrie.i_hi, entrie.i_lo, 0, entrie.filesize, entrie.memsize, entrie.com, entrie.unknown);
                    fileEntries.push(newEntrie);
                }
                //Create and save new package file
                let fileName = name + ".package";
                let newFile = path.join(packFolder, fileName);
                let newPack = new DBPFReader_1.Pack(newFile);
                newPack.index_List = fileEntries;
                newPack.saveToFile(newFile);
                if (!fs.existsSync(newFile))
                    throw new Error("Failed to create new package file: " + fileName);
                newPackages.push({
                    filepath: newFile,
                    packageName: name,
                    folder: packFolder
                });
            }
        }
        //Remove old versions
        if (mode > 0) {
            let keepPackages = [...mPackages];
            let keepResources = new Set();
            for (let index = keepPackages.length - 1; index >= 0; index--) {
                const element = keepPackages[index];
                let keep = true;
                for (let i = 0; i < relevantPackages.length; i++) {
                    if (DBPFReader_1.S4SMMFile.compareObjs(relevantPackages[i], element)) {
                        keepPackages.splice(index, 1);
                        i = relevantPackages.length;
                        keep = false;
                    }
                }
                if (keep) {
                    for (let i = 0; i < element.resources.length; i++) {
                        keepResources.add(element.resources[i]);
                    }
                }
            }
            //Remove all resources from the package
            for (let index = 0; index < relevantPackages.length; index++) {
                const fileInfo = relevantPackages[index];
                const resources = fileInfo.resources;
                for (let i = 0; i < resources.length; i++) {
                    const key = resources[i];
                    if (!keepResources.has(key))
                        pack.removeEntryByKey(key);
                }
            }
            //Redo the Mainifest
            let nM = new DBPFReader_1.S4SMMFile();
            nM.version = 1;
            nM.name = mainifest.name;
            nM.setPackagesFromObjFrom(keepPackages);
            if (mainifest.key)
                pack.removeEntryByKey(mainifest.key);
            let nMBuffer = nM.toBuffer();
            let nMEntri = new DBPFReader_1.IndexEnty("", 0x7FB6AD8A, 0, 0, 0, 0, nMBuffer.length, nMBuffer.length, 0, 1);
            nMEntri.setBuffer(nMBuffer);
            pack.index_List.push(nMEntri);
            console.log(fs.statSync(file).ino);
            pack.saveToFile(file);
            console.log(fs.statSync(file).ino);
        }
        //Move files to destination
        for (let index = 0; index < newPackages.length; index++) {
            const newPackage = newPackages[index];
            let baseName = newPackage.packageName;
            let ext = ".package";
            let dir = destination;
            let counter = 1;
            let des = path.join(dir, baseName + ext);
            while (fs.existsSync(des)) {
                des = path.join(dir, `${baseName}(${counter})${ext}`);
                counter++;
            }
            fs.copyFileSync(newPackage.filepath, des);
            fs.rm(newPackage.folder, { recursive: true, force: true }, (err) => {
                if (err) {
                    throw err;
                }
            });
        }
    }
    static removeFromMerged(file, relevantPackages) {
        this.unmergeFile(file, "", "", relevantPackages, 2);
    }
    static removeFromMergedAndCopyTo(file, destination, mergeFolder, relevantPackages) {
        this.unmergeFile(file, destination, mergeFolder, relevantPackages, 1);
    }
    static copyToFromMerged(file, destination, mergeFolder, relevantPackages) {
        this.unmergeFile(file, destination, mergeFolder, relevantPackages, 0);
    }
    static unmergeAllTo(file, destination, mergeFolder) {
        let pack = new DBPFReader_1.Pack(file);
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
        let mainifest = pack.getS4SMergedManifest();
        this.unmergeFile(file, destination, mergeFolder, mainifest.packages, 0);
    }
}
exports.PackageOperations = PackageOperations;
