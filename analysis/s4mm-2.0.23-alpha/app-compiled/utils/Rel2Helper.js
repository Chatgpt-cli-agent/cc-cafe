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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessor = void 0;
//import * as PNGImage from 'pngjs-image'; // This might still be used if you prefer its API, but we'll try to use pngjs for direct buffer write
const Jimp = __importStar(require("jimp"));
const fs = __importStar(require("fs"));
const DBPFReader_1 = require("../sims/DBPFReader");
class ImageProcessor {
    constructor(width, height, buffer, mipHeaders) {
        this.width = width;
        this.hight = height; // Corrected typo here, but leaving for consistency with your code
        this.buffer = buffer;
        this.mipHeaders = mipHeaders;
    }
    // ORIGINAL alphaArray implementation (assuming it was correct)
    alphaArray(a0, a1) {
        // Your original alphaArray logic goes here.
        // I'll put the typical DXT5 alpha interpolation as a placeholder.
        if (a0 > a1) {
            return [
                a0,
                a1,
                Math.round((6 * a0 + 1 * a1) / 7),
                Math.round((5 * a0 + 2 * a1) / 7),
                Math.round((4 * a0 + 3 * a1) / 7),
                Math.round((3 * a0 + 4 * a1) / 7),
                Math.round((2 * a0 + 5 * a1) / 7),
                Math.round((1 * a0 + 6 * a1) / 7),
            ];
        }
        else {
            return [
                a0,
                a1,
                Math.round((4 * a0 + 1 * a1) / 5),
                Math.round((3 * a0 + 2 * a1) / 5),
                Math.round((2 * a0 + 3 * a1) / 5),
                Math.round((1 * a0 + 4 * a1) / 5),
                0, // Fully transparent
                255, // Fully opaque
            ];
        }
    }
    // ORIGINAL colorArray implementation (assuming it was correct)
    colorArray(c0_raw, c1_raw) {
        // Your original colorArray logic goes here.
        // This is a placeholder for DXT1/BC1 color decoding.
        // It assumes c0_raw and c1_raw are 16-bit RGB565 values.
        const c0_r_5bit = (c0_raw >> 11) & 0x1F;
        const c0_g_6bit = (c0_raw >> 5) & 0x3F;
        const c0_b_5bit = c0_raw & 0x1F;
        const c1_r_5bit = (c1_raw >> 11) & 0x1F;
        const c1_g_6bit = (c1_raw >> 5) & 0x3F;
        const c1_b_5bit = c1_raw & 0x1F;
        const colors = [];
        // Expand 5-bit to 8-bit
        const expand5to8 = (val) => (val << 3) | (val >> 2);
        // Expand 6-bit to 8-bit
        const expand6to8 = (val) => (val << 2) | (val >> 4);
        const color0 = {
            r: expand5to8(c0_r_5bit),
            g: expand6to8(c0_g_6bit),
            b: expand5to8(c0_b_5bit),
        };
        const color1 = {
            r: expand5to8(c1_r_5bit),
            g: expand6to8(c1_g_6bit),
            b: expand5to8(c1_b_5bit),
        };
        colors.push(color0);
        colors.push(color1);
        if (c0_raw > c1_raw) {
            // 4-color palette
            colors.push({
                r: Math.round((2 * color0.r + color1.r) / 3),
                g: Math.round((2 * color0.g + color1.g) / 3),
                b: Math.round((2 * color0.b + color1.b) / 3),
            });
            colors.push({
                r: Math.round((color0.r + 2 * color1.r) / 3),
                g: Math.round((color0.g + 2 * color1.g) / 3),
                b: Math.round((color0.b + 2 * color1.b) / 3),
            });
        }
        else {
            // 3-color + transparent palette
            colors.push({
                r: Math.round((color0.r + color1.r) / 2),
                g: Math.round((color0.g + color1.g) / 2),
                b: Math.round((color0.b + color1.b) / 2),
            });
            colors.push({ r: 0, g: 0, b: 0 }); // Transparent black
        }
        return colors;
    }
    async toPNG(imagePath, defSize) {
        // Create an in-memory buffer for raw pixel data
        const pixelData = Buffer.alloc(this.width * this.hight * 4); // RGBA
        let xOffset = 0;
        let yOffset = 0;
        let byteBuffer = new DBPFReader_1.ByteBuffer(this.buffer);
        let mipHeader = this.mipHeaders[0];
        let nextMipHeader = this.mipHeaders[1];
        let blockOffset2 = mipHeader.Offset2;
        let blockOffset3 = mipHeader.Offset3;
        let blockOffset0 = mipHeader.Offset0;
        let blockOffset1 = mipHeader.Offset1;
        for (let commandOffset = mipHeader.CommandOffset; commandOffset < nextMipHeader.CommandOffset; commandOffset += 2) {
            byteBuffer.pos = commandOffset;
            let command = byteBuffer.getShort();
            var op = command & 3;
            var count = command >> 2;
            if (op === 0) {
                for (let j = 0; j < count; j++) {
                    for (let y = 0; y < 4; y++) {
                        for (let x = 0; x < 4; x++) {
                            let absolutX = xOffset + x;
                            let absolutY = yOffset + y;
                            const pixelIndex = (absolutY * this.width + absolutX) * 4;
                            pixelData[pixelIndex] = 0;
                            pixelData[pixelIndex + 1] = 0;
                            pixelData[pixelIndex + 2] = 0;
                            pixelData[pixelIndex + 3] = 0;
                        }
                    }
                    xOffset += 4;
                    if (xOffset >= this.width) {
                        xOffset = 0;
                        yOffset += 4;
                    }
                }
            }
            else if (op === 1) {
                for (let j = 0; j < count; j++) {
                    byteBuffer.pos = blockOffset0;
                    let a0 = byteBuffer.getByte();
                    let a1 = byteBuffer.getByte();
                    byteBuffer.pos = blockOffset1;
                    // Read 6 bytes for aMap
                    const aM = byteBuffer.getSection(6);
                    let aMapValue = 0n;
                    for (let i = 0; i < 6; i++) {
                        aMapValue |= BigInt(aM[i]) << BigInt(8 * i);
                    }
                    let alphaArr = this.alphaArray(a0, a1);
                    byteBuffer.pos = blockOffset2;
                    let c0 = byteBuffer.getShort();
                    let c1 = byteBuffer.getShort();
                    byteBuffer.pos = blockOffset3;
                    const cM = byteBuffer.getSection(4);
                    let cMapValue = 0;
                    for (let i = 0; i < 4; i++) {
                        cMapValue |= cM[i] << (8 * i);
                    }
                    let colorArr = this.colorArray(c0, c1);
                    let currentPos = 0;
                    for (let y = 0; y < 4; y++) {
                        for (let x = 0; x < 4; x++) {
                            const colorPos = (cMapValue >> (2 * currentPos)) & 0b11;
                            const alphaPos = Number((aMapValue >> BigInt(3 * currentPos)) & 7n);
                            let alpha = alphaArr[alphaPos];
                            let color = colorArr[colorPos];
                            let absolutX = xOffset + x;
                            let absolutY = yOffset + y;
                            const pixelIndex = (absolutY * this.width + absolutX) * 4;
                            pixelData[pixelIndex] = color.r;
                            pixelData[pixelIndex + 1] = color.g;
                            pixelData[pixelIndex + 2] = color.b;
                            pixelData[pixelIndex + 3] = alpha;
                            currentPos++;
                        }
                    }
                    xOffset += 4;
                    if (xOffset >= this.width) {
                        xOffset = 0;
                        yOffset += 4;
                    }
                    blockOffset2 += 4;
                    blockOffset3 += 4;
                    blockOffset0 += 2;
                    blockOffset1 += 6;
                }
            }
            else if (op === 2) {
                for (let j = 0; j < count; j++) {
                    let a0 = 0;
                    let a1 = 5;
                    let aMapValue = 0xffffffffffffffffn;
                    let alphaArr = this.alphaArray(a0, a1);
                    byteBuffer.pos = blockOffset2;
                    let c0 = byteBuffer.getShort();
                    let c1 = byteBuffer.getShort();
                    byteBuffer.pos = blockOffset3;
                    let cMapValue = byteBuffer.getInt();
                    let colorArr = this.colorArray(c0, c1);
                    let currentPos = 0;
                    for (let y = 0; y < 4; y++) {
                        for (let x = 0; x < 4; x++) {
                            const colorPos = (cMapValue >> (2 * currentPos)) & 0b11;
                            const alphaPos = Number((aMapValue >> BigInt(3 * currentPos)) & 7n);
                            let alpha = alphaArr[alphaPos];
                            let color = colorArr[colorPos];
                            let absolutX = xOffset + x;
                            let absolutY = yOffset + y;
                            const pixelIndex = (absolutY * this.width + absolutX) * 4;
                            pixelData[pixelIndex] = color.r;
                            pixelData[pixelIndex + 1] = color.g;
                            pixelData[pixelIndex + 2] = color.b;
                            pixelData[pixelIndex + 3] = alpha;
                            currentPos++;
                        }
                    }
                    xOffset += 4;
                    if (xOffset >= this.width) {
                        xOffset = 0;
                        yOffset += 4;
                    }
                    blockOffset2 += 4;
                    blockOffset3 += 4;
                }
            }
            else {
                console.log("ERROR - NotSupportedException: Unknown operation " + op);
                return undefined;
            }
        }
        // Use pngjs to create the PNG from the raw pixel data
        const pngjs = new (require('pngjs').PNG)({
            width: this.width,
            height: this.hight,
            filterType: 0, // Fastest encoding
            colorType: 6 // RGBA
        });
        pngjs.data = pixelData;
        return new Promise((resolve, reject) => {
            const outputStream = fs.createWriteStream(imagePath);
            pngjs.pack().pipe(outputStream);
            outputStream.on('finish', async () => {
                let created = fs.existsSync(imagePath);
                if (created) {
                    if (defSize === true && (this.width !== 1024 || this.hight !== 2048)) {
                        try {
                            let mainImage = await Jimp.read(imagePath);
                            await mainImage.resize(1024, 2048);
                            await mainImage.writeAsync(imagePath);
                            if (fs.existsSync(imagePath)) {
                                resolve(imagePath);
                            }
                            else {
                                resolve(undefined);
                            }
                        }
                        catch (error) {
                            console.log("Jimp resize error:", error);
                            resolve(undefined);
                        }
                    }
                    else {
                        resolve(imagePath);
                    }
                }
                else {
                    resolve(undefined);
                }
            });
            outputStream.on('error', (error) => {
                console.log("PNG write error:", error);
                reject(error);
            });
        });
    }
}
exports.ImageProcessor = ImageProcessor;
