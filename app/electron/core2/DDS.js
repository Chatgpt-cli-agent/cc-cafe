"use strict";
//THIS IS THE OLD VERSION AND SHOULD NOT BE USED
Object.defineProperty(exports, "__esModule", { value: true });
exports.DDSConverter = exports.DDSHeader = exports.DSTResource = void 0;
const DBPFReader_1 = require("./DBPFReader");
const Jimp = require('jimp');
class DSTResource {
    constructor(buffer) {
        this.width = 0;
        this.height = 0;
        this.isShuffled = false;
        this.buffer = buffer;
        this.prase(this.buffer);
    }
    prase(buffer) {
        if (!buffer)
            throw new Error("Buffer is empty");
        let bb = new DBPFReader_1.ByteBuffer(buffer);
        this.header = new DDSHeader();
        this.header.prase(bb.getSection(128));
        if (this.header.fourCC != FourCC.DST1 &&
            this.header.fourCC != FourCC.DST3 &&
            this.header.fourCC != FourCC.DST5) {
            this.isShuffled = false;
        }
        else {
            this.isShuffled = true;
        }
        this.height = this.header.height;
        this.width = this.header.width;
    }
    toDDSBuffer() {
        if (this.buffer == undefined)
            throw new Error("Buffer is empty");
        if (!this.isShuffled) {
            return this.buffer;
        }
        else {
            //Unshuffel
            return this.unshuffle(this.buffer);
        }
    }
    unshuffle(buffer) {
        if (this.header == undefined)
            throw new Error("Header is empty");
        let bb = new DBPFReader_1.ByteBuffer(buffer);
        let newHeader = new DDSHeader();
        newHeader.prase(bb.getSection(128));
        let dataOffset = 128;
        let dataSize = bb.max - dataOffset;
        bb.pos = dataOffset;
        let temp = bb.getSection(dataSize);
        let bbTme = new DBPFReader_1.ByteBuffer(temp);
        let bw = new DBPFReader_1.BinaryWritter();
        //bw.arr = bb.getSection(dataSize);
        if (this.header.fourCC == FourCC.DST1) {
            //Updated 
            newHeader.fourCC = FourCC.DXT1;
            bw.writeBytes(newHeader.unprase());
            var blockOffset2 = 0;
            var blockOffset3 = blockOffset2 + (dataSize >> 1);
            // probably a better way to do this
            var count = (blockOffset3 - blockOffset2) / 4;
            for (let i = 0; i < count; i++) {
                bbTme.pos = blockOffset2;
                bw.writeBytes(bbTme.getSection(4));
                bbTme.pos = blockOffset3;
                bw.writeBytes(bbTme.getSection(4));
                blockOffset2 += 4;
                blockOffset3 += 4;
            }
        }
        else if (this.header.fourCC == FourCC.DST3) {
            newHeader.fourCC = FourCC.DXT3;
            bw.writeBytes(newHeader.unprase());
            throw new Error("Not implemented yet");
        }
        else if (this.header.fourCC == FourCC.DST5) {
            newHeader.fourCC = FourCC.DXT5;
            bw.writeBytes(newHeader.unprase());
            var blockOffset0 = 0;
            var blockOffset2 = blockOffset0 + (dataSize >> 3);
            var blockOffset1 = blockOffset2 + (dataSize >> 2);
            var blockOffset3 = blockOffset1 + (6 * dataSize >> 4);
            var count = (blockOffset2 - blockOffset0) / 2;
            for (let i = 0; i < count; i++) {
                bbTme.pos = blockOffset0;
                bw.writeBytes(bbTme.getSection(2));
                bbTme.pos = blockOffset1;
                bw.writeBytes(bbTme.getSection(6));
                bbTme.pos = blockOffset2;
                bw.writeBytes(bbTme.getSection(4));
                bbTme.pos = blockOffset3;
                bw.writeBytes(bbTme.getSection(4));
                blockOffset0 += 2;
                blockOffset1 += 6;
                blockOffset2 += 4;
                blockOffset3 += 4;
            }
        }
        else {
            throw new Error("Invalid FourCC");
        }
        return bw.toBuffer();
    }
}
exports.DSTResource = DSTResource;
class DDSHeader {
    constructor() {
        this.size = 0;
        this.flags = 0;
        this.height = 0;
        this.width = 0;
        this.pitchOrLinearSize = 0;
        this.depth = 0;
        this.mipMapCount = 0;
        this.surfaceFlags = 0;
        this.cubemapFlags = 0;
        this.fourCC = FourCC.None;
        //PixelFormat
        this.pfSize = 0;
        this.pfFlags = 0;
        this.pfFourCC = 0;
        this.pfRGBBitCount = 0;
        this.pfRBitMask = 0;
        this.pfGBitMask = 0;
        this.pfBBitMask = 0;
        this.pfABitMask = 0;
    }
    prase(buffer) {
        //this.buffer = buffer;
        let bb = new DBPFReader_1.ByteBuffer(buffer);
        //Read Magic
        let magic = bb.getInt();
        if (magic != 0x20534444)
            throw new Error("Invalid DDS Header");
        this.size = bb.getInt();
        this.flags = bb.getInt();
        this.height = bb.getInt();
        this.width = bb.getInt();
        this.pitchOrLinearSize = bb.getInt();
        this.depth = bb.getInt();
        this.mipMapCount = bb.getInt();
        let reserved1 = bb.getSection(44);
        //Pixel Format
        this.pfSize = bb.getInt();
        this.pfFlags = bb.getInt();
        this.pfFourCC = bb.getInt();
        this.pfRGBBitCount = bb.getInt();
        this.pfRBitMask = bb.getInt();
        this.pfGBitMask = bb.getInt();
        this.pfBBitMask = bb.getInt();
        this.pfABitMask = bb.getInt();
        this.surfaceFlags = bb.getInt();
        this.cubemapFlags = bb.getInt();
        let reserved2 = bb.getSection(12);
        this.fourCC = this.pfFourCC;
    }
    unprase() {
        let bw = new DBPFReader_1.BinaryWritter();
        bw.writeInt(0x20534444);
        bw.writeInt(this.size);
        bw.writeInt(this.flags);
        bw.writeInt(this.height);
        bw.writeInt(this.width);
        bw.writeInt(this.pitchOrLinearSize);
        bw.writeInt(this.depth);
        bw.writeInt(this.mipMapCount);
        bw.writeEmptyBytes(44);
        bw.writeInt(this.pfSize);
        bw.writeInt(this.pfFlags);
        bw.writeInt(this.fourCC);
        bw.writeInt(this.pfRGBBitCount);
        bw.writeInt(this.pfRBitMask);
        bw.writeInt(this.pfGBitMask);
        bw.writeInt(this.pfBBitMask);
        bw.writeInt(this.pfABitMask);
        bw.writeInt(this.surfaceFlags);
        bw.writeInt(this.cubemapFlags);
        bw.writeEmptyBytes(12);
        return bw.toBuffer();
    }
}
exports.DDSHeader = DDSHeader;
class DDSConverter {
    static async pngBufferToDdsBuffer(buffer) {
        const image = await Jimp.read(buffer);
        const width = image.getWidth();
        const height = image.getHeight();
        let packages = [];
        for (let y = 0; y < height; y = y + 4) {
            for (let x = 0; x < width; x = x + 4) {
                let colors = this.getAllColors(x, y, image);
                let pack = {
                    a0: 0xff,
                    a1: 0xff,
                    aMapHi: 0, //4
                    aMapLo: 0, //2
                    c0: 0,
                    c1: 0,
                    cMap: 0
                };
                let { c0, c1 } = this.pca(colors);
                pack.c0 = this.rgbToDXT5Color(c0);
                pack.c1 = this.rgbToDXT5Color(c1);
                let palette = this.createPalette(c0, c1);
                const bestIndices = colors.map((color) => this.findBestColorIndex(color, palette));
                let value = "";
                bestIndices.forEach((index) => {
                    value = (index.toString(2).padStart(2, "0")) + value;
                });
                pack.cMap = parseInt(value, 2);
                packages.push(pack);
            }
        }
        //Create Header
        let bw = new DBPFReader_1.BinaryWritter();
        bw.writeInt(0x20534444);
        bw.writeInt(0x7C);
        bw.writeInt(0x81007);
        bw.writeInt(height);
        bw.writeInt(width);
        bw.writeInt(width * 4);
        bw.writeInt(0x0);
        bw.writeInt(0x1);
        bw.writeEmptyBytes(44);
        bw.writeInt(0x20);
        bw.writeInt(0x4);
        bw.writeInt(0x35545844);
        bw.writeEmptyBytes(20);
        bw.writeInt(0x1000);
        bw.writeEmptyBytes(16);
        for (let index = 0; index < packages.length; index++) {
            const element = packages[index];
            //Alpha
            bw.writeByte(element.a0);
            bw.writeByte(element.a1);
            bw.writeInt(0x0);
            bw.writeShort(0x0);
            //Color
            bw.writeShort(element.c0);
            bw.writeShort(element.c1);
            bw.writeInt(element.cMap);
        }
        return bw.toBuffer();
    }
    static getAllColors(x, y, image) {
        let colors = [];
        for (let u = 0; u < 4; u++) {
            for (let v = 0; v < 4; v++) {
                colors.push(Jimp.intToRGBA(image.getPixelColor(x + v, y + u)));
            }
        }
        return colors;
    }
    static pca(pixels) {
        let mean = { r: 0, g: 0, b: 0 };
        for (let i = 0; i < pixels.length; i++) {
            mean.r += pixels[i].r;
            mean.g += pixels[i].g;
            mean.b += pixels[i].b;
        }
        mean.r /= pixels.length;
        mean.g /= pixels.length;
        mean.b /= pixels.length;
        let cov = { rr: 0, rg: 0, rb: 0, gg: 0, gb: 0, bb: 0 };
        for (let i = 0; i < pixels.length; i++) {
            let dr = pixels[i].r - mean.r;
            let dg = pixels[i].g - mean.g;
            let db = pixels[i].b - mean.b;
            cov.rr += dr * dr;
            cov.rg += dr * dg;
            cov.rb += dr * db;
            cov.gg += dg * dg;
            cov.gb += dg * db;
            cov.bb += db * db;
        }
        let maxVariance = Math.max(cov.rr, cov.gg, cov.bb);
        let principalComponent = { r: 0, g: 0, b: 0 };
        if (maxVariance === cov.rr) {
            principalComponent.r = 1;
        }
        else if (maxVariance === cov.gg) {
            principalComponent.g = 1;
        }
        else {
            principalComponent.b = 1;
        }
        let minProj = Infinity;
        let maxProj = -Infinity;
        let minColor = null;
        let maxColor = null;
        for (let i = 0; i < pixels.length; i++) {
            let proj = pixels[i].r * principalComponent.r + pixels[i].g * principalComponent.g + pixels[i].b * principalComponent.b;
            if (proj < minProj) {
                minProj = proj;
                minColor = pixels[i];
            }
            if (proj > maxProj) {
                maxProj = proj;
                maxColor = pixels[i];
            }
        }
        return { c0: maxColor, c1: minColor };
    }
    static rgbToDXT5Color(color) {
        const r5 = Math.floor((color.r * 31) / 255);
        const g6 = Math.floor((color.g * 63) / 255);
        const b5 = Math.floor((color.b * 31) / 255);
        const cColor = (r5 << 11) | (g6 << 5) | b5;
        return cColor;
    }
    static createPalette(c0, c1) {
        function interpolateColor(c0, c1, factor) {
            return {
                r: Math.round(c0.r * (1 - factor) + c1.r * factor),
                g: Math.round(c0.g * (1 - factor) + c1.g * factor),
                b: Math.round(c0.b * (1 - factor) + c1.b * factor)
            };
        }
        const color2 = interpolateColor(c0, c1, 2 / 3);
        const color3 = interpolateColor(c0, c1, 1 / 3);
        return [c0, c1, color2, color3];
    }
    static findBestColorIndex(pixelColor, palette) {
        let bestIndex = 0;
        let bestDistance = this.calculateEuclideanDistance(pixelColor, palette[0]);
        for (let i = 1; i < palette.length; i++) {
            const distance = this.calculateEuclideanDistance(pixelColor, palette[i]);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }
        return bestIndex;
    }
    static calculateEuclideanDistance(color1, color2) {
        return Math.sqrt(Math.pow(color1.r - color2.r, 2) + Math.pow(color1.g - color2.g, 2) + Math.pow(color1.b - color2.b, 2));
    }
    static async ddsBufferToPngBuffer(buffer) {
        //Check if DXT1 or DXT5 in Header
        let bb = new DBPFReader_1.ByteBuffer(buffer);
        let header = new DDSHeader();
        header.prase(bb.getSection(128));
        let fourCC = header.fourCC;
        if (fourCC == FourCC.DXT1) {
            return await this.ddsBufferToPngBufferDXT1(buffer);
        }
        else if (fourCC == FourCC.DXT5) {
            return await this.ddsBufferToPngBufferDXT5(buffer);
        }
        throw new Error("Unsupported DDS format");
    }
    static async ddsBufferToPngBufferDXT5(buffer) {
        const headerSize = 128;
        const width = buffer.readUInt32LE(16);
        const height = buffer.readUInt32LE(12);
        const mipMapCount = buffer.readUInt32LE(28);
        const image = new Jimp(width, height);
        let offset = headerSize;
        for (let mip = 0; mip < 1 && mip < mipMapCount; mip++) {
            const mipWidth = Math.max(1, width >> mip);
            const mipHeight = Math.max(1, height >> mip);
            for (let y = 0; y < mipHeight; y += 4) {
                for (let x = 0; x < mipWidth; x += 4) {
                    const a0 = buffer.readUInt8(offset);
                    const a1 = buffer.readUInt8(offset + 1);
                    const aMap = buffer.readUInt32LE(offset + 2);
                    const c0 = buffer.readUInt16LE(offset + 8);
                    const c1 = buffer.readUInt16LE(offset + 10);
                    const cMap = buffer.readUInt32LE(offset + 12);
                    offset += 16;
                    const colors = this.createPalette(this.dxt5ColorToRGB(c0), this.dxt5ColorToRGB(c1));
                    for (let i = 0; i < 16; i++) {
                        const colorIndex = (cMap >> (i * 2)) & 0x03;
                        const color = colors[colorIndex];
                        //console.log(color);
                        const alpha = this.getAlpha(a0, a1, aMap, i);
                        const rgba = Jimp.rgbaToInt(color.r, color.g, color.b, alpha);
                        const px = x + (i % 4);
                        const py = y + Math.floor(i / 4);
                        if (px < width && py < height) {
                            image.setPixelColor(rgba, px, py);
                        }
                    }
                }
            }
        }
        return await image.getBufferAsync(Jimp.MIME_PNG);
    }
    static dxt5ColorToRGB(color) {
        const r = ((color >> 11) & 0x1F) * 255 / 31;
        const g = ((color >> 5) & 0x3F) * 255 / 63;
        const b = (color & 0x1F) * 255 / 31;
        return { r, g, b };
    }
    static getAlpha(a0, a1, aMap, index) {
        const alphaIndex = (aMap >> (index * 3)) & 0x07;
        if (alphaIndex === 0)
            return a0;
        if (alphaIndex === 1)
            return a1;
        if (a0 > a1) {
            return ((8 - alphaIndex) * a0 + (alphaIndex - 1) * a1) / 7;
        }
        else {
            if (alphaIndex === 6)
                return 0;
            if (alphaIndex === 7)
                return 255;
            return ((6 - alphaIndex) * a0 + (alphaIndex - 1) * a1) / 5;
        }
    }
    static async ddsBufferToPngBufferDXT1(buffer) {
        const headerSize = 128;
        const width = buffer.readUInt32LE(16);
        const height = buffer.readUInt32LE(12);
        const mipMapCount = buffer.readUInt32LE(28);
        const image = new Jimp(width, height);
        let offset = headerSize;
        for (let mip = 0; mip < 1 && mip < mipMapCount; mip++) {
            const mipWidth = Math.max(1, width >> mip);
            const mipHeight = Math.max(1, height >> mip);
            for (let y = 0; y < mipHeight; y += 4) {
                for (let x = 0; x < mipWidth; x += 4) {
                    const c0 = buffer.readUInt16LE(offset);
                    const c1 = buffer.readUInt16LE(offset + 2);
                    const cMap = buffer.readUInt32LE(offset + 4);
                    offset += 8;
                    const colors = this.createPaletteDXT1(this.dxt1ColorToRGB(c0), this.dxt1ColorToRGB(c1));
                    for (let i = 0; i < 16; i++) {
                        const colorIndex = (cMap >> (i * 2)) & 0x03;
                        const color = colors[colorIndex];
                        const rgba = Jimp.rgbaToInt(color.r, color.g, color.b, 255); // No alpha in DXT1
                        const px = x + (i % 4);
                        const py = y + Math.floor(i / 4);
                        if (px < width && py < height) {
                            image.setPixelColor(rgba, px, py);
                        }
                    }
                }
            }
        }
        return await image.getBufferAsync(Jimp.MIME_PNG);
    }
    static dxt1ColorToRGB(color) {
        const r = ((color >> 11) & 0x1F) * 255 / 31;
        const g = ((color >> 5) & 0x3F) * 255 / 63;
        const b = (color & 0x1F) * 255 / 31;
        return { r, g, b };
    }
    static createPaletteDXT1(c0, c1) {
        const palette = [c0, c1];
        if (this.isColor0Greater(c0, c1)) {
            // Interpolate two additional colors
            palette.push(this.interpolateColor(c0, c1, 2 / 3));
            palette.push(this.interpolateColor(c0, c1, 1 / 3));
        }
        else {
            // Interpolate one additional color and add black
            palette.push(this.interpolateColor(c0, c1, 1 / 2));
            palette.push({ r: 0, g: 0, b: 0 }); // Black
        }
        return palette;
    }
    static isColor0Greater(c0, c1) {
        // Compare the 16-bit values of c0 and c1
        const c0Value = (c0.r << 16) | (c0.g << 8) | c0.b;
        const c1Value = (c1.r << 16) | (c1.g << 8) | c1.b;
        return c0Value > c1Value;
    }
    static interpolateColor(c0, c1, factor) {
        return {
            r: Math.round(c0.r * (1 - factor) + c1.r * factor),
            g: Math.round(c0.g * (1 - factor) + c1.g * factor),
            b: Math.round(c0.b * (1 - factor) + c1.b * factor),
        };
    }
}
exports.DDSConverter = DDSConverter;
var FourCC;
(function (FourCC) {
    FourCC[FourCC["DST1"] = 827609924] = "DST1";
    FourCC[FourCC["DST3"] = 861164356] = "DST3";
    FourCC[FourCC["DST5"] = 894718788] = "DST5";
    FourCC[FourCC["DXT1"] = 827611204] = "DXT1";
    FourCC[FourCC["DXT3"] = 861165636] = "DXT3";
    FourCC[FourCC["DXT5"] = 894720068] = "DXT5";
    FourCC[FourCC["ATI1"] = 826889281] = "ATI1";
    FourCC[FourCC["ATI2"] = 843666497] = "ATI2";
    FourCC[FourCC["None"] = 0] = "None";
})(FourCC || (FourCC = {}));
