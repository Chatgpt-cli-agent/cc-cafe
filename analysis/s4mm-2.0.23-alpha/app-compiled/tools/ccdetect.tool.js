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
exports.ToolCCDetectWorkerUtils = exports.ToolCCDetect = void 0;
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const ThumbnailDetect_1 = require("../utils/ThumbnailDetect");
const DBPFReader_1 = require("../sims/DBPFReader");
const SimilarImageProcessing_1 = require("../utils/SimilarImageProcessing");
const imageHash = require('image-hash-local-only');
class ToolCCDetect {
    constructor(main) {
        this.thumbnailsDetect = undefined;
        this.mainApp = main;
        //this.thumbnailsDetect = new ThumbnailDetect(this.mainApp);
        this.initIPC();
    }
    initIPC() {
    }
    prepareObject() {
        if (this.thumbnailsDetect)
            return; // Already prepared
        this.thumbnailsDetect = new ThumbnailDetect_1.ThumbnailDetect(this.mainApp);
    }
}
exports.ToolCCDetect = ToolCCDetect;
class ToolCCDetectWorkerUtils {
    static async exportAllThumbnails(data) {
        let item = data.item;
        let directory = data.folder;
        let options = data.options;
        let file = path_1.default.join(item.path, item.name);
        if (!fs.existsSync(file)) {
            throw new Error("File does not exist: " + file);
        }
        let isCache = data.isCache;
        let needHash = data.needHash;
        let pack = new DBPFReader_1.Pack(file);
        let images = undefined;
        try {
            pack.checkFile();
            if (!pack.error) {
                pack.calculateIndexList();
                images = [];
                let imagesCAS = await pack.exportCASThumnails(directory, true, true, isCache);
                //let imagesCOBJ = await pack.exportCOBJThumnails(directory, true, true, isCache);
                if (imagesCAS && imagesCAS.length > 0)
                    images.push(...imagesCAS);
                //if (imagesCOBJ && imagesCOBJ.length > 0) images.push(...imagesCOBJ);
            }
        }
        catch (err) {
            console.log("Error in: " + file);
            console.log(err);
        }
        if (images == undefined || !needHash)
            return undefined;
        //Hash
        let hashed = [];
        for (let index = 0; index < images.length; index++) {
            const image = images[index];
            const imagePath = path_1.default.join(image.path, image.name);
            if (!fs.existsSync(imagePath))
                continue;
            try {
                let pImageBuffer = await (0, SimilarImageProcessing_1.processImageBufferWithOptions)(fs.readFileSync(imagePath), {
                    grayscale: options.imGrayscale,
                    addBlack: options.imTopBox,
                    normalize: options.imNormalize,
                    edgeDetection: options.imEdgeDetect,
                    removeBottom: options.imBottomCut,
                });
                const hash = await this.generateHashBufferJpeg(pImageBuffer, options.hashSize);
                let instance = image.name.replace("0x", "");
                instance = instance.substring(0, instance.indexOf("."));
                image.db = {
                    ino: item.ino,
                    hash: hash,
                    image: image.name,
                    instance: instance
                };
                hashed.push(image);
            }
            catch (error) {
                console.log({ file: file, image: imagePath, data: data });
                console.log(error);
            }
        }
        return hashed;
    }
    static async findClosestHash(data) {
        let hashmap = data.hashmap;
        let item = data.item;
        let options = data.options;
        try {
            let newHash = undefined;
            if (data.imageHash != undefined) {
                newHash = data.imageHash;
            }
            else {
                newHash = await this.generateHash(item.imageProcessed, options.hashSize);
            }
            let closestMatch = null;
            let smallestDistance = Infinity;
            let time = Date.now();
            for (let [id, hash] of hashmap.entries()) {
                const distance = this.hammingDistance(newHash, hash);
                if (distance < smallestDistance) {
                    smallestDistance = distance;
                    closestMatch = id;
                }
            }
            return {
                id: closestMatch,
                distance: smallestDistance,
                time: (Date.now() - time)
            };
        }
        catch (error) {
            console.log("");
            console.log(data.item);
            console.log(error);
            return undefined;
        }
    }
}
exports.ToolCCDetectWorkerUtils = ToolCCDetectWorkerUtils;
ToolCCDetectWorkerUtils.generateHash = (filePath, bitSize) => {
    return new Promise((resolve, reject) => {
        imageHash.imageHash(filePath, bitSize, true, (err, hash) => {
            if (err)
                reject(err);
            resolve(hash);
        });
    });
};
ToolCCDetectWorkerUtils.generateHashBufferJpeg = (buffer, bitSize) => {
    return new Promise((resolve, reject) => {
        imageHash.imageHash({
            ext: 'image/jpeg',
            data: buffer
        }, bitSize, true, (err, hash) => {
            if (err)
                reject(err);
            resolve(hash);
        });
    });
};
ToolCCDetectWorkerUtils.hammingDistance = (hash1, hash2) => {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) {
            distance++;
        }
    }
    return distance;
};
