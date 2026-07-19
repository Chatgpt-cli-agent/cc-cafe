"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCASTgiList = void 0;
const DBPFReader_1 = require("../sims/DBPFReader");
const batchSize = 200;
var path = require("path");
var fs = require('fs');
async function getCaspsTGILists(database) {
    return await database.from("CasCombined").select([database.raw('CAST(ino AS TEXT) AS ino'), "tgilist"]);
}
async function getGameAddresses(database) {
    return new Set((await database.from("GameIds").select("address")).map((element) => element.address));
}
async function getEntriesValues(database) {
    let addressMapEntries = new Map();
    let entries = await database.from("Entries").select(["address", database.raw('CAST(ino AS TEXT) AS ino')]);
    entries.forEach((element) => {
        let address = element.address;
        if (!addressMapEntries.has(address)) {
            let entrySet = new Set();
            addressMapEntries.set(address, entrySet);
        }
        addressMapEntries.get(address)?.add(element.ino);
    });
    return addressMapEntries;
}
function isRelevant(threshold, total, missing) {
    if (threshold == 0)
        return missing > 0;
    if (threshold == 1)
        return missing == total;
    return missing / total > threshold;
}
async function extendMissingItems(database, itemsMissing) {
    //Get Items
    let sel = [database.raw('CAST(ino AS TEXT) AS ino'), "name", "path"];
    let filesMap = new Map();
    for (let i = 0; i < itemsMissing.length; i += batchSize) {
        const batch = itemsMissing.slice(i, i + batchSize);
        const inos = batch.map(item => item.ino);
        const batchResults = await database.from('Files')
            .whereIn('ino', inos)
            .select(sel);
        batchResults.forEach((element) => {
            filesMap.set(element.ino, element);
        });
    }
    //Process Items
    for (let i = 0; i < itemsMissing.length; i++) {
        const item = itemsMissing[i];
        const fileInfo = filesMap.get(item.ino);
        if (!fileInfo)
            continue;
        let file = path.join(fileInfo.path, fileInfo.name);
        if (!fs.existsSync(file))
            continue;
        let addressesLod = new Set();
        let addressesDiffuse = new Set();
        try {
            let pack = new DBPFReader_1.Pack(file);
            pack.checkFile();
            if (pack.error)
                continue;
            pack.calculateIndexList();
            pack.calulateCASPFiles();
            if (!pack.caspResource)
                continue;
            let caspFiles = pack.caspResource.caspFiles;
            if (!caspFiles || caspFiles.length == 0)
                continue;
            let reducedCaspFiles = [];
            caspFiles.forEach((caspFile) => {
                let reduced = caspFile.getLodAndDiffuse();
                reducedCaspFiles.push(reduced);
            });
            item.caspFiles = reducedCaspFiles;
            item.file = file;
        }
        catch (error) {
            console.log(error);
        }
    }
    return itemsMissing;
}
async function loadAdressSet(database, options) {
    console.log(options);
    let triggerPoint = (options && options.triggerPoint != undefined) ? options.triggerPoint : 0.5;
    let onlyLodAndDiffuse = (options && options.onlyLodAndDiffuse != undefined) ? options.onlyLodAndDiffuse : true;
    let moreThanOneLodLevel = (options && options.moreThanOneLodLevel != undefined) ? options.moreThanOneLodLevel : false;
    let oneInstanceIsEnough = (options && options.oneInstanceIsEnough != undefined) ? options.oneInstanceIsEnough : true;
    let ignoreBiggerLod = (options && options.ignoreBiggerLod != undefined) ? options.ignoreBiggerLod : 3;
    // Load the sets of game addresses and entry values from the database
    let addressSetGame = await getGameAddresses(database);
    let addressMapEntries = await getEntriesValues(database);
    // Load the CASP TGI lists from the database
    let casps = await getCaspsTGILists(database);
    // Initialize arrays to store missing items and item relations
    let itemsMissing = [];
    let itemsRelations = [];
    // Iterate through each CASP TGI list
    for (let index = 0; index < casps.length; index++) {
        const element = casps[index];
        if (element.tgilist == null)
            continue;
        // Split the TGI list into individual addresses
        let addresses = element.tgilist.split(":");
        let relations = new Set();
        let needsGameContent = false;
        let missing = new Set();
        let textureCount = 0;
        let meshCount = 0;
        let missingTextures = 0;
        let missingMeshes = 0;
        // Check each address in the TGI list
        addresses.forEach((address) => {
            let isTexture = address.startsWith("3453cf95");
            let isMesh = address.startsWith("015a1849");
            if (!(isMesh || isTexture))
                return;
            if (isMesh)
                meshCount++;
            if (isTexture)
                textureCount++;
            if (addressSetGame.has(address)) {
                needsGameContent = true;
            }
            else if (addressMapEntries.has(address)) {
                let entryRelations = addressMapEntries.get(address);
                if (!entryRelations?.has(element.ino)) {
                    entryRelations?.forEach((entry) => {
                        if (entry != element.ino) {
                            relations.add(entry);
                        }
                    });
                }
            }
            else {
                missing.add(address);
                if (isMesh)
                    missingMeshes++;
                if (isTexture)
                    missingTextures++;
            }
        });
        // Remove the current element's ino from the relations set
        relations.delete(element.ino);
        // If there are missing addresses and the conditions are met, add to itemsMissing
        if (missing.size > 0) {
            itemsMissing.push({
                ino: element.ino,
                missing: Array.from(missing),
                needsGameContent: needsGameContent,
                relations: Array.from(relations),
                textures: { total: textureCount, missing: missingTextures },
                meshes: { total: meshCount, missing: missingMeshes }
            });
        }
        // If there are relations, add to itemsRelations
        if (relations.size > 0) {
            itemsRelations.push({
                ino: element.ino,
                relations: Array.from(relations)
            });
        }
    }
    //Process items
    //Load files
    if (onlyLodAndDiffuse) {
        itemsMissing = await extendMissingItems(database, itemsMissing);
        itemsMissing = itemsMissing.filter((item) => {
            if (!item.caspFiles)
                return false;
            let missingAddresses = new Set();
            let relevant = false;
            for (let index = 0; index < item.caspFiles.length; index++) {
                const caspFile = item.caspFiles[index];
                //Diffuse
                if (caspFile.diffuse) {
                    let inGame = addressSetGame.has(caspFile.diffuse);
                    let inEntries = addressMapEntries.has(caspFile.diffuse);
                    if (!inGame && !inEntries) {
                        missingAddresses.add(caspFile.diffuse);
                        relevant = true;
                    }
                }
                //Lod
                let lodLevels = caspFile.lod;
                for (let j = 0; j < lodLevels.length; j++) {
                    const level = lodLevels[j];
                    let addresses = level.list;
                    let total = addresses.length;
                    let missing = 0;
                    let resultList = [];
                    let installedInstances = new Set();
                    let lodMissingAddresses = new Set();
                    for (let i = 0; i < addresses.length; i++) {
                        const address = addresses[i];
                        let inGame = addressSetGame.has(address);
                        let inEntries = addressMapEntries.has(address);
                        if (!inGame && !inEntries) {
                            lodMissingAddresses.add(address);
                            missing++;
                        }
                        else {
                            let instance = address.split("-")[2];
                            installedInstances.add(instance);
                        }
                        resultList.push({ address: address, inGame: inGame, inEntries: inEntries, missing: !inGame && !inEntries });
                    }
                    if (oneInstanceIsEnough) {
                        for (let i = 0; i < addresses.length; i++) {
                            const address = addresses[i];
                            let instance = address.split("-")[2];
                            if (installedInstances.has(instance) && lodMissingAddresses.has(address)) {
                                lodMissingAddresses.delete(address);
                                missing--;
                            }
                        }
                    }
                    let lodRelevant = isRelevant(triggerPoint, total, missing);
                    level.isRelevant = lodRelevant;
                    level.resultList = resultList;
                    if (lodRelevant && (lodLevels.length > 1 || !moreThanOneLodLevel) && !(level.level > ignoreBiggerLod)) {
                        Array.from(lodMissingAddresses).forEach(address => missingAddresses.add(address));
                        relevant = true;
                    }
                }
            }
            item.missing = Array.from(missingAddresses);
            return relevant;
        });
    }
    else {
        itemsMissing = itemsMissing.filter((item) => {
            let meshTrigger = isRelevant(triggerPoint, item.meshes.total, item.meshes.missing);
            let textureTrigger = isRelevant(triggerPoint, item.textures.total, item.textures.missing);
            return meshTrigger || textureTrigger;
        });
    }
    return { itemsMissing, itemsRelations };
}
async function checkCASTgiList(database, options) {
    return await loadAdressSet(database, options);
}
exports.checkCASTgiList = checkCASTgiList;
module.exports = { checkCASTgiList };
