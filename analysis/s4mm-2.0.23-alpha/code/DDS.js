"use strict";
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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
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
exports.__esModule = true;
exports.DDSConverter = exports.DDSHeader = exports.DSTResource = void 0;
var DBPFReader_1 = require("./DBPFReader");
var Jimp = require('jimp');
var DSTResource = /** @class */ (function () {
    function DSTResource(buffer) {
        this.width = 0;
        this.height = 0;
        this.isShuffled = false;
        this.buffer = buffer;
        this.prase(this.buffer);
    }
    DSTResource.prototype.prase = function (buffer) {
        if (!buffer)
            throw new Error("Buffer is empty");
        var bb = new DBPFReader_1.ByteBuffer(buffer);
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
    };
    DSTResource.prototype.toDDSBuffer = function () {
        if (this.buffer == undefined)
            throw new Error("Buffer is empty");
        if (!this.isShuffled) {
            return this.buffer;
        }
        else {
            //Unshuffel
            return this.unshuffle(this.buffer);
        }
    };
    DSTResource.prototype.unshuffle = function (buffer) {
        if (this.header == undefined)
            throw new Error("Header is empty");
        var bb = new DBPFReader_1.ByteBuffer(buffer);
        var newHeader = new DDSHeader();
        newHeader.prase(bb.getSection(128));
        var dataOffset = 128;
        var dataSize = bb.max - dataOffset;
        bb.pos = dataOffset;
        var temp = bb.getSection(dataSize);
        var bbTme = new DBPFReader_1.ByteBuffer(temp);
        var bw = new DBPFReader_1.BinaryWritter();
        //bw.arr = bb.getSection(dataSize);
        if (this.header.fourCC == FourCC.DST1) {
            //Updated 
            newHeader.fourCC = FourCC.DXT1;
            bw.writeBytes(newHeader.unprase());
            var blockOffset2 = 0;
            var blockOffset3 = blockOffset2 + (dataSize >> 1);
            // probably a better way to do this
            var count = (blockOffset3 - blockOffset2) / 4;
            for (var i = 0; i < count; i++) {
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
            for (var i = 0; i < count; i++) {
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
    };
    return DSTResource;
}());
exports.DSTResource = DSTResource;
var DDSHeader = /** @class */ (function () {
    function DDSHeader() {
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
    DDSHeader.prototype.prase = function (buffer) {
        //this.buffer = buffer;
        var bb = new DBPFReader_1.ByteBuffer(buffer);
        //Read Magic
        var magic = bb.getInt();
        if (magic != 0x20534444)
            throw new Error("Invalid DDS Header");
        this.size = bb.getInt();
        this.flags = bb.getInt();
        this.height = bb.getInt();
        this.width = bb.getInt();
        this.pitchOrLinearSize = bb.getInt();
        this.depth = bb.getInt();
        this.mipMapCount = bb.getInt();
        var reserved1 = bb.getSection(44);
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
        var reserved2 = bb.getSection(12);
        this.fourCC = this.pfFourCC;
    };
    DDSHeader.prototype.unprase = function () {
        var bw = new DBPFReader_1.BinaryWritter();
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
    };
    return DDSHeader;
}());
exports.DDSHeader = DDSHeader;
var DDSConverter = /** @class */ (function () {
    function DDSConverter() {
    }
    DDSConverter.pngBufferToDdsBuffer = function (buffer) {
        return __awaiter(this, void 0, void 0, function () {
            var image, width, height, packages, y, _loop_1, this_1, x, bw, index, element;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Jimp.read(buffer)];
                    case 1:
                        image = _a.sent();
                        width = image.getWidth();
                        height = image.getHeight();
                        packages = [];
                        for (y = 0; y < height; y = y + 4) {
                            _loop_1 = function (x) {
                                var colors = this_1.getAllColors(x, y, image);
                                var pack = {
                                    a0: 0xff,
                                    a1: 0xff,
                                    aMapHi: 0,
                                    aMapLo: 0,
                                    c0: 0,
                                    c1: 0,
                                    cMap: 0
                                };
                                var _b = this_1.pca(colors), c0 = _b.c0, c1 = _b.c1;
                                pack.c0 = this_1.rgbToDXT5Color(c0);
                                pack.c1 = this_1.rgbToDXT5Color(c1);
                                var palette = this_1.createPalette(c0, c1);
                                var bestIndices = colors.map(function (color) { return _this.findBestColorIndex(color, palette); });
                                var value = "";
                                bestIndices.forEach(function (index) {
                                    value = (index.toString(2).padStart(2, "0")) + value;
                                });
                                pack.cMap = parseInt(value, 2);
                                packages.push(pack);
                            };
                            this_1 = this;
                            for (x = 0; x < width; x = x + 4) {
                                _loop_1(x);
                            }
                        }
                        bw = new DBPFReader_1.BinaryWritter();
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
                        for (index = 0; index < packages.length; index++) {
                            element = packages[index];
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
                        return [2 /*return*/, bw.toBuffer()];
                }
            });
        });
    };
    DDSConverter.getAllColors = function (x, y, image) {
        var colors = [];
        for (var u = 0; u < 4; u++) {
            for (var v = 0; v < 4; v++) {
                colors.push(Jimp.intToRGBA(image.getPixelColor(x + v, y + u)));
            }
        }
        return colors;
    };
    DDSConverter.pca = function (pixels) {
        var mean = { r: 0, g: 0, b: 0 };
        for (var i = 0; i < pixels.length; i++) {
            mean.r += pixels[i].r;
            mean.g += pixels[i].g;
            mean.b += pixels[i].b;
        }
        mean.r /= pixels.length;
        mean.g /= pixels.length;
        mean.b /= pixels.length;
        var cov = { rr: 0, rg: 0, rb: 0, gg: 0, gb: 0, bb: 0 };
        for (var i = 0; i < pixels.length; i++) {
            var dr = pixels[i].r - mean.r;
            var dg = pixels[i].g - mean.g;
            var db = pixels[i].b - mean.b;
            cov.rr += dr * dr;
            cov.rg += dr * dg;
            cov.rb += dr * db;
            cov.gg += dg * dg;
            cov.gb += dg * db;
            cov.bb += db * db;
        }
        var maxVariance = Math.max(cov.rr, cov.gg, cov.bb);
        var principalComponent = { r: 0, g: 0, b: 0 };
        if (maxVariance === cov.rr) {
            principalComponent.r = 1;
        }
        else if (maxVariance === cov.gg) {
            principalComponent.g = 1;
        }
        else {
            principalComponent.b = 1;
        }
        var minProj = Infinity;
        var maxProj = -Infinity;
        var minColor = null;
        var maxColor = null;
        for (var i = 0; i < pixels.length; i++) {
            var proj = pixels[i].r * principalComponent.r + pixels[i].g * principalComponent.g + pixels[i].b * principalComponent.b;
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
    };
    DDSConverter.rgbToDXT5Color = function (color) {
        var r5 = Math.floor((color.r * 31) / 255);
        var g6 = Math.floor((color.g * 63) / 255);
        var b5 = Math.floor((color.b * 31) / 255);
        var cColor = (r5 << 11) | (g6 << 5) | b5;
        return cColor;
    };
    DDSConverter.createPalette = function (c0, c1) {
        function interpolateColor(c0, c1, factor) {
            return {
                r: Math.round(c0.r * (1 - factor) + c1.r * factor),
                g: Math.round(c0.g * (1 - factor) + c1.g * factor),
                b: Math.round(c0.b * (1 - factor) + c1.b * factor)
            };
        }
        var color2 = interpolateColor(c0, c1, 2 / 3);
        var color3 = interpolateColor(c0, c1, 1 / 3);
        return [c0, c1, color2, color3];
    };
    DDSConverter.findBestColorIndex = function (pixelColor, palette) {
        var bestIndex = 0;
        var bestDistance = this.calculateEuclideanDistance(pixelColor, palette[0]);
        for (var i = 1; i < palette.length; i++) {
            var distance = this.calculateEuclideanDistance(pixelColor, palette[i]);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }
        return bestIndex;
    };
    DDSConverter.calculateEuclideanDistance = function (color1, color2) {
        return Math.sqrt(Math.pow(color1.r - color2.r, 2) + Math.pow(color1.g - color2.g, 2) + Math.pow(color1.b - color2.b, 2));
    };
    DDSConverter.ddsBufferToPngBuffer = function (buffer) {
        return __awaiter(this, void 0, void 0, function () {
            var headerSize, width, height, mipMapCount, image, offset, mip, mipWidth, mipHeight, y, x, a0, a1, aMap, c0, c1, cMap, colors, i, colorIndex, color, alpha, rgba, px, py;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        headerSize = 128;
                        width = buffer.readUInt32LE(16);
                        height = buffer.readUInt32LE(12);
                        mipMapCount = buffer.readUInt32LE(28);
                        image = new Jimp(width, height);
                        offset = headerSize;
                        for (mip = 0; mip < 1 && mip < mipMapCount; mip++) {
                            mipWidth = Math.max(1, width >> mip);
                            mipHeight = Math.max(1, height >> mip);
                            for (y = 0; y < mipHeight; y += 4) {
                                for (x = 0; x < mipWidth; x += 4) {
                                    a0 = buffer.readUInt8(offset);
                                    a1 = buffer.readUInt8(offset + 1);
                                    aMap = buffer.readUInt32LE(offset + 2);
                                    c0 = buffer.readUInt16LE(offset + 8);
                                    c1 = buffer.readUInt16LE(offset + 10);
                                    cMap = buffer.readUInt32LE(offset + 12);
                                    offset += 16;
                                    colors = this.createPalette(this.dxt5ColorToRGB(c0), this.dxt5ColorToRGB(c1));
                                    for (i = 0; i < 16; i++) {
                                        colorIndex = (cMap >> (i * 2)) & 0x03;
                                        color = colors[colorIndex];
                                        alpha = this.getAlpha(a0, a1, aMap, i);
                                        rgba = Jimp.rgbaToInt(color.r, color.g, color.b, alpha);
                                        px = x + (i % 4);
                                        py = y + Math.floor(i / 4);
                                        if (px < width && py < height) {
                                            image.setPixelColor(rgba, px, py);
                                        }
                                    }
                                }
                            }
                        }
                        return [4 /*yield*/, image.getBufferAsync(Jimp.MIME_PNG)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DDSConverter.dxt5ColorToRGB = function (color) {
        var r = ((color >> 11) & 0x1F) * 255 / 31;
        var g = ((color >> 5) & 0x3F) * 255 / 63;
        var b = (color & 0x1F) * 255 / 31;
        return { r: r, g: g, b: b };
    };
    DDSConverter.getAlpha = function (a0, a1, aMap, index) {
        var alphaIndex = (aMap >> (index * 3)) & 0x07;
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
    };
    return DDSConverter;
}());
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
