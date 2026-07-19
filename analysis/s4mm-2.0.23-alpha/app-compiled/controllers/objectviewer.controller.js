"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectViewerController = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
const DBPFReader_1 = require("../sims/DBPFReader");
const imageProcessing_1 = require("../utils/imageProcessing");
const DDSUtil_1 = require("../utils/DDSUtil");
class ObjectViewerController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle('objectviewer', async (event, data) => {
            switch (data.action) {
                case 'get-cas-info':
                    return await this.getCASObjectData(data.ino, data.address);
                case 'get-cobj-info':
                    return await this.getCobjObjectData(data.ino, data.address);
                case 'get-model':
                    return await this.getModelObjectData(data.ino, data.addresses);
                case 'get-all-base-body-meshes':
                    return await this.getAllBaseBodyMesh();
                case 'extract-texture':
                    return await this.extractTexture(data.ino, data.address);
                case 'combine-cas-textures':
                    return await this.combineCasTextures(data.textures, data.sessionId, data.gender || 2);
                default:
                    throw new Error(`Unknown action: ${data.action}`);
            }
        });
    }
    //Mesh
    async getFileInfo(knex, ino) {
        let file = await knex('Files').select([knex.raw("CAST(ino AS TEXT) AS ino"), "name", "path"]).where("ino", ino).andWhere("type", 1).first();
        if (!file)
            throw new Error(`File with ino ${ino} not found`);
        let filepath = path_1.default.join(file.path, file.name);
        if (!fs.existsSync(filepath))
            throw new Error(`File ${filepath} does not exist`);
        return { file, filepath };
    }
    async getCobjObjectData(ino, address) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        let addressParts = address.split("-");
        if (addressParts.length != 3)
            throw new Error("Invalid address format");
        let typeAddress = addressParts[0];
        let groupAddress = addressParts[1];
        let instanceAddress = addressParts[2];
        let ro = {
            ino: ino,
            swatches: [],
            currentSwatch: null,
            meshes: [],
            address: address
        };
        let { file, filepath } = await this.getFileInfo(knex, ino);
        //Load the pack and analyze it
        let pack = new DBPFReader_1.Pack(filepath);
        pack.checkFile();
        if (pack.error) {
            console.warn(`Error reading pack file ${filepath}: ${pack.error}`);
            return ro; // Return empty object if error occurs
        }
        pack.calculateIndexList();
        let cobjPack = new DBPFReader_1.COBJPack(pack);
        let test = cobjPack.getModelFileGroups();
        test.forEach((group) => {
            let isMatch = false;
            group.swatches.forEach((swatch) => {
                swatch.ino = ino;
                swatch.swatch = swatch.colors.join(":");
                if (swatch.instance == instanceAddress) {
                    isMatch = true;
                    ro.currentSwatch = swatch;
                }
            });
            if (isMatch) {
                ro.swatches.push(...group.swatches);
                ro.meshes.push(...group.meshes);
            }
        });
        return ro;
    }
    async getCASObjectData(ino, address) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        let addressParts = address.split("-");
        if (addressParts.length != 3)
            throw new Error("Invalid address format");
        let typeAddress = addressParts[0];
        let groupAddress = addressParts[1];
        let instanceAddress = addressParts[2];
        let ro = {
            ino: ino,
            swatches: [],
            currentSwatch: null,
            address: address
        };
        let { file, filepath } = await this.getFileInfo(knex, ino);
        //Load the pack and analyze it
        let pack = new DBPFReader_1.Pack(filepath);
        pack.checkFile();
        if (pack.error) {
            console.warn(`Error reading pack file ${filepath}: ${pack.error}`);
            return ro; // Return empty object if error occurs
        }
        let iip = new DBPFReader_1.ImportInfoPack(pack);
        iip.analyze();
        //Find the primary casp file
        let caspFiles = iip.caspFiles;
        let primaryCaspFile = caspFiles.find(casp => casp.instanceID == instanceAddress);
        if (!primaryCaspFile) {
            console.warn(`No CASP file found for instance ${instanceAddress} in pack ${filepath}`);
            return ro; // Return empty object if no CASP file found
        }
        let propId = primaryCaspFile.propId;
        caspFiles = caspFiles.filter(casp => casp.propId == propId);
        caspFiles.forEach(casp => {
            let swatchData = casp.getSwatchValues();
            swatchData.ino = ino;
            ro.swatches.push(swatchData);
            if (casp.instanceID == instanceAddress) {
                ro.currentSwatch = swatchData;
            }
        });
        return ro;
    }
    async getModelObjectData(ino, addresses) {
        if (!Array.isArray(addresses) || addresses.length === 0) {
            throw new Error("Addresses must be a non-empty array");
        }
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        let { file, filepath } = await this.getFileInfo(knex, ino);
        console.log(`Getting model object data for ino ${ino} with addresses`, addresses);
        let missingAddresses = new Set(addresses);
        let models = [];
        //Internal (from mod file)
        let m0 = await this.getModelFromFile(filepath, addresses);
        m0.forEach((model) => {
            if (missingAddresses.has(model.address)) {
                models.push(model);
                missingAddresses.delete(model.address);
            }
        });
        if (missingAddresses.size == 0)
            return { models, missingAddresses: [] };
        //External Mod (from another mod file)
        console.log("Missing addresses after internal check:", Array.from(missingAddresses));
        let potentialFiles = await knex('Files')
            .distinct([knex.raw("CAST(Files.ino AS TEXT) AS ino"), "Files.name", "Files.path"])
            .join("Entries", "Files.ino", "Entries.ino")
            .whereIn("Entries.address", Array.from(missingAddresses));
        if (potentialFiles.length > 0) {
            for (let index = 0; index < potentialFiles.length; index++) {
                const element = potentialFiles[index];
                const filepath = path_1.default.join(element.path, element.name);
                if (!filepath || !fs.existsSync(filepath)) {
                    console.warn(`Potential file ${filepath} does not exist, skipping.`);
                    continue; // Skip if file does not exist
                }
                let m1 = await this.getModelFromFile(filepath, Array.from(missingAddresses));
                m1.forEach((model) => {
                    if (missingAddresses.has(model.address)) {
                        models.push(model);
                        missingAddresses.delete(model.address);
                    }
                });
            }
        }
        if (missingAddresses.size == 0)
            return { models, missingAddresses: [] };
        //External Game (from game files)
        console.log("Missing addresses after external mod check:", Array.from(missingAddresses));
        potentialFiles = await knex('GameFiles')
            .distinct([knex.raw("CAST(GameFiles.ino AS TEXT) AS ino"), "GameFiles.path"])
            .join("GameIds", "GameFiles.ino", "GameIds.ino")
            .whereIn("GameIds.address", Array.from(missingAddresses));
        if (potentialFiles.length > 0) {
            for (let index = 0; index < potentialFiles.length; index++) {
                const element = potentialFiles[index];
                const filepath = element.path;
                if (!filepath || !fs.existsSync(filepath)) {
                    console.warn(`Potential file ${filepath} does not exist, skipping.`);
                    continue; // Skip if file does not exist
                }
                let m1 = await this.getModelFromFile(filepath, Array.from(missingAddresses));
                m1.forEach((model) => {
                    if (missingAddresses.has(model.address)) {
                        models.push(model);
                        missingAddresses.delete(model.address);
                    }
                });
            }
        }
        if (missingAddresses.size == 0)
            return { models, missingAddresses: [] };
        throw new Error(`Could not find models for addresses: ${Array.from(missingAddresses).join(", ")}`);
    }
    async getModelFromFile(filepath, addresses) {
        let pack = new DBPFReader_1.Pack(filepath);
        pack.checkFile();
        if (pack.error) {
            console.warn(`Error reading pack file ${filepath}: ${pack.error}`);
            return; // Return if error occurs
        }
        let models = [];
        pack.calculateIndexList();
        pack.index_List.forEach((entry) => {
            let key = entry.getKey();
            if (addresses.includes(key)) {
                //entries.push(entry);
                let modelData = this.readModelOrGeom(entry);
                if (modelData) {
                    models.push({
                        address: key,
                        data: modelData
                    });
                }
            }
        });
        return models;
    }
    readModelOrGeom(entry) {
        let address = entry.getKey();
        if (address.startsWith("015a1849")) {
            //GEOM
            let geom = new DBPFReader_1.GEOMFile(entry.getByteArray());
            return geom.chunks;
        }
        else {
            throw new Error(`Unsupported address type for ${address}`);
        }
    }
    async getAllBaseBodyMesh() {
        let time = Date.now();
        let gameFolder = this.mainApp.settings.s_game_orgin;
        if (!gameFolder || !fs.existsSync(gameFolder)) {
            throw new Error("Game folder is not set or does not exist.");
        }
        let bodyPartsFolder = this.mainApp.folderStructureController.getFolder("cas-body-parts");
        if (!bodyPartsFolder || !fs.existsSync(bodyPartsFolder)) {
            throw new Error("Body parts folder is not available.");
        }
        let clientDeltaBuild0 = path_1.default.join(gameFolder, "Data", "Client", "ClientDeltaBuild0.package");
        if (!fs.existsSync(clientDeltaBuild0)) {
            throw new Error(`ClientDeltaBuild0 package does not exist at ${clientDeltaBuild0}`);
        }
        let parts = CasBodyParts.parts;
        let missing = new Map();
        parts.forEach(part => {
            let partFile = path_1.default.join(bodyPartsFolder, `${part.name}.s4mmgeom`);
            if (fs.existsSync(partFile)) {
                part.data = JSON.parse(fs.readFileSync(partFile, 'utf-8'));
            }
            else {
                missing.set(part.key, part.name);
            }
        });
        if (missing.size == 0) {
            console.log(`All body parts loaded from cache in ${Date.now() - time}ms`);
            return parts;
        }
        let missingKeys = Array.from(missing.keys());
        //Load missing parts from ClientDeltaBuild0
        let models = await this.getModelFromFile(clientDeltaBuild0, missingKeys);
        models.forEach((model) => {
            let part = parts.find(p => p.key === model.address);
            if (part) {
                part.data = model.data;
                //Save to body parts folder
                let partFile = path_1.default.join(bodyPartsFolder, `${part.name}.s4mmgeom`);
                fs.writeFileSync(partFile, JSON.stringify(model.data, null, 2));
            }
            else {
                console.warn(`Part ${model.address} not found in predefined parts.`);
            }
        });
        console.log(`Loaded ${models.length} body parts from ClientDeltaBuild0 in ${Date.now() - time}ms`);
        return parts;
    }
    //Texture
    async extractTexture(ino, address, extraCheck = true) {
        let time = Date.now();
        if (!ino || !address) {
            throw new Error("Invalid parameters: ino and address are required");
        }
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        let tmpFolder = this.mainApp.folderStructureController.getFolder("tmp");
        if (!tmpFolder || !fs.existsSync(tmpFolder))
            throw new Error("Temporary folder is not available.");
        let { file, filepath } = await this.getFileInfo(knex, ino);
        let filesource = 0; //1 = internal, 2 = external mod, 3 = external game
        console.log(`[OBJECT-VIEW] Extracting texture for ino ${ino} and address ${address} from file ${filepath}`);
        //Internal (from mod file)
        let pack = new DBPFReader_1.Pack(filepath);
        pack.checkFile();
        if (pack.error) {
            console.warn(`Error reading pack file ${filepath}: ${pack.error}`);
            return; // Return if error occurs
        }
        pack.calculateIndexList();
        let entry = pack.index_List.find(e => e.getKey() === address);
        if (entry)
            filesource = 1;
        //External Mod (from another mod file)
        //External Game (from game files)
        if (!entry) {
            console.warn(`No entry found for address ${address} in file ${filepath}`);
            if (extraCheck && address.toLowerCase().startsWith("3453cf95")) {
                return await this.extractTexture(ino, address.toLowerCase().replace("3453cf95", "2bc04edf"), false);
            }
            return {
                ino: ino,
                address: address,
                filepath: null,
                filesource: filesource
            };
        }
        //Extract texture
        if (entry.r_type == 0x3453CF95) {
            //RLE2
            let rle2 = new DBPFReader_1.REL2File(entry.getByteArray());
            let texturePath = path_1.default.join(tmpFolder, `${ino}_${address}.png`);
            await rle2.toPNG(texturePath);
            console.log(`Extracted RLE2 texture to ${texturePath} in ${Date.now() - time}ms`);
            return {
                ino: ino,
                address: address,
                filepath: fs.existsSync(texturePath) ? texturePath : null,
                filesource: filesource
            };
        }
        else if (entry.r_type == 0x00b2d882) {
            //_IMG (DXT)
            let inp = entry.getByteArray();
            let dst = new DDSUtil_1.DSTResource(inp);
            let ddsBuffer = dst.toDDSBuffer();
            let texturePath = path_1.default.join(tmpFolder, `${ino}_${address}.png`);
            let nb = await DDSUtil_1.DDSConverter.ddsBufferToPngBuffer(ddsBuffer);
            if (nb)
                fs.writeFileSync(texturePath, nb);
            console.log(`Extracted _IMG texture to ${texturePath} in ${Date.now() - time}ms`);
            return {
                ino: ino,
                address: address,
                filepath: fs.existsSync(texturePath) ? texturePath : null,
                filesource: filesource
            };
        }
        else if (entry.r_type == 0x2BC04EDF) {
            //LRLE
            let inp = entry.getByteArray();
            let lrle = new DBPFReader_1.LRLEFile(inp);
            let texturePath = path_1.default.join(tmpFolder, `${ino}_${address}.png`);
            await lrle.exportImage(texturePath, true);
            console.log(`Extracted LRLE texture to ${texturePath} in ${Date.now() - time}ms`);
            return {
                ino: ino,
                address: address,
                filepath: fs.existsSync(texturePath) ? texturePath : null,
                filesource: filesource
            };
        }
        else {
            throw new Error(`Unsupported entry type for ${address}: ${entry.r_type}`);
        }
    }
    async combineCasTextures(textures, sessionId, gender = 1) {
        let time = Date.now();
        let modelFolder = this.mainApp.folderStructureController.getFolder("model-viewer");
        if (!modelFolder || !fs.existsSync(modelFolder))
            throw new Error("Model viewer folder is not available.");
        let modelCombinedFolder = this.mainApp.folderStructureController.getFolder("combined-textures");
        if (!modelCombinedFolder || !fs.existsSync(modelCombinedFolder)) {
            throw new Error("Combined textures folder is not available.");
        }
        //Base image
        let backupBaseImage = path_1.default.join(__dirname, "..", "files", "base.png");
        let imageName = "unknown_texture.png";
        if (gender == 1) { //Male
            imageName = "man_texture.png";
        }
        else if (gender == 2) { //Female
            imageName = "woman_texture.png";
        }
        let baseImage = path_1.default.join(modelFolder, imageName);
        console.log(`Using base image: ${baseImage}`);
        if (!fs.existsSync(baseImage)) {
            console.log(`Base image ${baseImage} does not exist, copying from backup.`);
            console.log(`Backup base image: ${backupBaseImage}`);
            fs.copyFileSync(backupBaseImage, baseImage, fs.constants.COPYFILE_EXCL);
        }
        if (!fs.existsSync(baseImage)) {
            throw new Error(`Base image ${baseImage} does not exist`);
        }
        //Combine textures
        let combinedImage = path_1.default.join(modelCombinedFolder, `${sessionId}_combined.png`);
        let texturePaths = [];
        textures.forEach((texture) => {
            texturePaths.push(texture.filepath);
        });
        await imageProcessing_1.ImageProcessing.combineImages(baseImage, texturePaths, combinedImage);
        console.log(`Combined textures into ${combinedImage} in ${Date.now() - time}ms`);
        return {
            combinedTexture: fs.existsSync(combinedImage) ? combinedImage : null,
        };
    }
}
exports.ObjectViewerController = ObjectViewerController;
class CasBodyParts {
}
CasBodyParts.parts = [
    {
        name: "woman_adult_upper_body",
        key: "015a1849-00e2bf6e-e29b147e75b6208d"
    },
    {
        name: "woman_adult_lower_body",
        key: "015a1849-000ca85a-562009b9d4fbc1c2"
    },
    {
        name: "woman_adult_head",
        key: "015a1849-00d1b738-3e68f8b6f44da2aa"
    },
    {
        name: "woman_adult_feet",
        key: "015a1849-00e7c7da-c8a0134251653019"
    },
    {
        name: "man_adult_upper_body",
        key: "015a1849-00cfd5c4-facb14f02cd72951"
    },
    {
        name: "man_adult_lower_body",
        key: "015a1849-0006dfa8-2edd43b93759561f"
    },
    {
        name: "man_adult_head",
        key: "015a1849-00954737-c7b7131033261079"
    },
    {
        name: "man_adult_feet",
        key: "015a1849-009c671e-7d8d53bd26112391"
    }
];
