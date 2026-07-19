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
exports.BundleBufferFile = exports.BundleBufferUtil = void 0;
const msgpack_1 = require("@msgpack/msgpack");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class BundleBufferUtil {
    // Serialize an object to a Buffer
    static toBuffer(obj) {
        return Buffer.from((0, msgpack_1.encode)(obj));
    }
    // Deserialize a Buffer back to an object
    static fromBuffer(buffer) {
        return (0, msgpack_1.decode)(buffer);
    }
    // Save to file
    static async toFile(obj, filepath) {
        const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        await fs.writeFile(filepath, BundleBufferUtil.toBuffer(obj));
    }
    // Load from file
    static async fromFile(filepath) {
        const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        const buffer = await fs.readFile(filepath);
        return BundleBufferUtil.fromBuffer(buffer);
    }
}
exports.BundleBufferUtil = BundleBufferUtil;
class BundleBufferFile {
    constructor(tmpFolderPath) {
        this.size = 0;
        let filename = Date.now() + ".s4mm.bundle";
        this.filepath = path_1.default.join(tmpFolderPath, filename);
    }
    addBufferToEnd(buffer) {
        let bufferSize = Buffer.byteLength(buffer);
        let sizeBuffer = Buffer.alloc(4);
        this.size += bufferSize;
        sizeBuffer.writeUInt32LE(bufferSize, 0);
        fs_1.default.writeFileSync(this.filepath, sizeBuffer, { flag: 'a' });
        fs_1.default.writeFileSync(this.filepath, buffer, { flag: 'a' });
    }
}
exports.BundleBufferFile = BundleBufferFile;
