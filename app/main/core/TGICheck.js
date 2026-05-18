var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var batchSize = 200;
var path = require("path");
var fs = require('fs');
var Pack = require("./DBPFReader.js").Pack;
function getCaspsTGILists(database) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, database.from("Casp").select(["ino", "tgi_list"])];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function getGameAddresses(database) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = Set.bind;
                    return [4 /*yield*/, database.from("GameIds").select("address")];
                case 1: return [2 /*return*/, new (_a.apply(Set, [void 0, (_b.sent()).map(function (element) { return element.address; })]))()];
            }
        });
    });
}
function getEntriesValues(database) {
    return __awaiter(this, void 0, void 0, function () {
        var addressMapEntries, entries;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    addressMapEntries = new Map();
                    return [4 /*yield*/, database.from("Entries").select(["type", "group", "instance", "ino"])];
                case 1:
                    entries = _a.sent();
                    entries.forEach(function (element) {
                        var _a;
                        var ap = [
                            element.type.toString(16).padStart(8, "0"),
                            element.group.toString(16).padStart(8, "0"),
                            element.instance
                        ];
                        var address = ap.join("-");
                        if (!addressMapEntries.has(address)) {
                            var entrySet = new Set();
                            addressMapEntries.set(address, entrySet);
                        }
                        (_a = addressMapEntries.get(address)) === null || _a === void 0 ? void 0 : _a.add(element.ino);
                    });
                    return [2 /*return*/, addressMapEntries];
            }
        });
    });
}
function isRelevant(threshold, total, missing) {
    if (threshold == 0)
        return missing > 0;
    if (threshold == 1)
        return missing == total;
    return missing / total > threshold;
}
function extendMissingItems(database, itemsMissing) {
    return __awaiter(this, void 0, void 0, function () {
        var sel, filesMap, i, batch, inos, batchResults, _loop_1, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sel = ["ino", "name", "path", "id"];
                    filesMap = new Map();
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < itemsMissing.length)) return [3 /*break*/, 4];
                    batch = itemsMissing.slice(i, i + batchSize);
                    inos = batch.map(function (item) { return item.ino; });
                    return [4 /*yield*/, database.from('Files')
                            .whereIn('ino', inos)
                            .select(sel)];
                case 2:
                    batchResults = _a.sent();
                    batchResults.forEach(function (element) {
                        filesMap.set(element.ino, element);
                    });
                    _a.label = 3;
                case 3:
                    i += batchSize;
                    return [3 /*break*/, 1];
                case 4:
                    _loop_1 = function (i) {
                        var item = itemsMissing[i];
                        var fileInfo = filesMap.get(item.ino);
                        if (!fileInfo)
                            return "continue";
                        var file = path.join(fileInfo.path, fileInfo.name);
                        if (!fs.existsSync(file))
                            return "continue";
                        var addressesLod = new Set();
                        var addressesDiffuse = new Set();
                        try {
                            var pack = new Pack(file);
                            pack.checkFile();
                            if (pack.error)
                                return "continue";
                            pack.calculateIndexList();
                            pack.calulateCASPFiles();
                            if (!pack.caspResource)
                                return "continue";
                            var caspFiles = pack.caspResource.caspFiles;
                            if (!caspFiles || caspFiles.length == 0)
                                return "continue";
                            var reducedCaspFiles_1 = [];
                            caspFiles.forEach(function (caspFile) {
                                var reduced = caspFile.getLodAndDiffuse();
                                reducedCaspFiles_1.push(reduced);
                                //if(reduced.diffuse)addressesDiffuse.add(reduced.diffuse);
                                //reduced.lod.forEach((address:string) => {
                                //    addressesLod.add(address);
                                //});
                            });
                            /*item.casAddresses = {
                                lod:Array.from(addressesLod),
                                diffuse:Array.from(addressesDiffuse)
                            }*/
                            item.caspFiles = reducedCaspFiles_1;
                            item.file = file;
                        }
                        catch (error) {
                            console.log(error);
                        }
                    };
                    //Process Items
                    for (i = 0; i < itemsMissing.length; i++) {
                        _loop_1(i);
                    }
                    return [2 /*return*/, itemsMissing];
            }
        });
    });
}
/**
 * Loads a set of addresses from the database and checks for missing addresses.
 *
 * @param database - The database connection object.
 * @param searchMeshLevel - The level of search for mesh addresses (0 = ignore, 1 = search all missing, 2 = search at least one missing).
 * @param searchTextureLevel - The level of search for texture addresses (0 = ignore, 1 = search all missing, 2 = search at least one missing).
 * @returns A promise that resolves to an object containing arrays of missing items and item relations.
 */
function loadAdressSet(database, options) {
    return __awaiter(this, void 0, void 0, function () {
        var triggerPoint, onlyLodAndDiffuse, moreThanOneLodLevel, oneInstanceIsEnough, ignoreBiggerLod, addressSetGame, addressMapEntries, casps, itemsMissing, itemsRelations, _loop_2, index;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(options);
                    triggerPoint = (options && options.triggerPoint != undefined) ? options.triggerPoint : 0.5;
                    onlyLodAndDiffuse = (options && options.onlyLodAndDiffuse != undefined) ? options.onlyLodAndDiffuse : true;
                    moreThanOneLodLevel = (options && options.moreThanOneLodLevel != undefined) ? options.moreThanOneLodLevel : false;
                    oneInstanceIsEnough = (options && options.oneInstanceIsEnough != undefined) ? options.oneInstanceIsEnough : true;
                    ignoreBiggerLod = (options && options.ignoreBiggerLod != undefined) ? options.ignoreBiggerLod : 3;
                    return [4 /*yield*/, getGameAddresses(database)];
                case 1:
                    addressSetGame = _a.sent();
                    return [4 /*yield*/, getEntriesValues(database)];
                case 2:
                    addressMapEntries = _a.sent();
                    return [4 /*yield*/, getCaspsTGILists(database)];
                case 3:
                    casps = _a.sent();
                    itemsMissing = [];
                    itemsRelations = [];
                    _loop_2 = function (index) {
                        var element = casps[index];
                        if (element.tgi_list == null)
                            return "continue";
                        // Split the TGI list into individual addresses
                        var addresses = element.tgi_list.split(":");
                        var relations = new Set();
                        var needsGameContent = false;
                        var missing = new Set();
                        var textureCount = 0;
                        var meshCount = 0;
                        var missingTextures = 0;
                        var missingMeshes = 0;
                        // Check each address in the TGI list
                        addresses.forEach(function (address) {
                            var isTexture = address.startsWith("3453CF95");
                            var isMesh = address.startsWith("015a1849");
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
                                var entryRelations = addressMapEntries.get(address);
                                if (!(entryRelations === null || entryRelations === void 0 ? void 0 : entryRelations.has(element.ino))) {
                                    entryRelations === null || entryRelations === void 0 ? void 0 : entryRelations.forEach(function (entry) {
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
                    };
                    // Iterate through each CASP TGI list
                    for (index = 0; index < casps.length; index++) {
                        _loop_2(index);
                    }
                    if (!onlyLodAndDiffuse) return [3 /*break*/, 5];
                    return [4 /*yield*/, extendMissingItems(database, itemsMissing)];
                case 4:
                    itemsMissing = _a.sent();
                    itemsMissing = itemsMissing.filter(function (item) {
                        if (!item.caspFiles)
                            return false;
                        var missingAddresses = new Set();
                        var relevant = false;
                        for (var index = 0; index < item.caspFiles.length; index++) {
                            var caspFile = item.caspFiles[index];
                            //Diffuse
                            if (caspFile.diffuse) {
                                var inGame = addressSetGame.has(caspFile.diffuse);
                                var inEntries = addressMapEntries.has(caspFile.diffuse);
                                if (!inGame && !inEntries) {
                                    missingAddresses.add(caspFile.diffuse);
                                    relevant = true;
                                }
                            }
                            //Lod
                            var lodLevels = caspFile.lod;
                            for (var j = 0; j < lodLevels.length; j++) {
                                var level = lodLevels[j];
                                var addresses = level.list;
                                var total = addresses.length;
                                var missing = 0;
                                var resultList = [];
                                var installedInstances = new Set();
                                var lodMissingAddresses = new Set();
                                for (var i = 0; i < addresses.length; i++) {
                                    var address = addresses[i];
                                    var inGame = addressSetGame.has(address);
                                    var inEntries = addressMapEntries.has(address);
                                    if (!inGame && !inEntries) {
                                        lodMissingAddresses.add(address);
                                        missing++;
                                    }
                                    else {
                                        var instance = address.split("-")[2];
                                        installedInstances.add(instance);
                                    }
                                    resultList.push({ address: address, inGame: inGame, inEntries: inEntries, missing: !inGame && !inEntries });
                                }
                                if (oneInstanceIsEnough) {
                                    for (var i = 0; i < addresses.length; i++) {
                                        var address = addresses[i];
                                        var instance = address.split("-")[2];
                                        if (installedInstances.has(instance) && lodMissingAddresses.has(address)) {
                                            lodMissingAddresses.delete(address);
                                            missing--;
                                        }
                                    }
                                }
                                var lodRelevant = isRelevant(triggerPoint, total, missing);
                                level.isRelevant = lodRelevant;
                                level.resultList = resultList;
                                if (lodRelevant && (lodLevels.length > 1 || !moreThanOneLodLevel) && !(level.level > ignoreBiggerLod)) {
                                    Array.from(lodMissingAddresses).forEach(function (address) { return missingAddresses.add(address); });
                                    relevant = true;
                                }
                            }
                        }
                        item.missing = Array.from(missingAddresses);
                        return relevant;
                    });
                    return [3 /*break*/, 6];
                case 5:
                    itemsMissing = itemsMissing.filter(function (item) {
                        var meshTrigger = isRelevant(triggerPoint, item.meshes.total, item.meshes.missing);
                        var textureTrigger = isRelevant(triggerPoint, item.textures.total, item.textures.missing);
                        return meshTrigger || textureTrigger;
                    });
                    _a.label = 6;
                case 6: return [2 /*return*/, { itemsMissing: itemsMissing, itemsRelations: itemsRelations }];
            }
        });
    });
}
function checkCASTgiList(database, options) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadAdressSet(database, options)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
module.exports = checkCASTgiList;
/*async function main(){
    const db = require("../../test/utils/database.js");
    let result = await checkCASTgiList(db,{
        triggerPoint: 0.5,
        onlyLodAndDiffuse: true,
        moreThanOneLodLevel: true,
        oneInstanceIsEnough: true
    });
    console.log(result);
    
    process.exit();
};

main();
*/ 
