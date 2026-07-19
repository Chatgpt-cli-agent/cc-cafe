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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FramePackage = exports.FrameOverlay = exports.DXT5TOPNG = void 0;
var DBPFReader_1 = require("./DBPFReader");
var LoadingImage_1 = require("./LoadingImage");
var instanceId = require("./sims-hashes.js").instanceId;
var fs = require('fs');
var path = require('path');
var Jimp = require('jimp');
var DXT5TOPNG = /** @class */ (function () {
    function DXT5TOPNG() {
    }
    DXT5TOPNG.createDDSBufferFromPNGBuffer = function (buffer) {
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
                                    aMapHi: 0, //4
                                    aMapLo: 0, //2
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
    DXT5TOPNG.getAllColors = function (x, y, image) {
        var colors = [];
        for (var u = 0; u < 4; u++) {
            for (var v = 0; v < 4; v++) {
                colors.push(Jimp.intToRGBA(image.getPixelColor(x + v, y + u)));
            }
        }
        return colors;
    };
    DXT5TOPNG.pca = function (pixels) {
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
    DXT5TOPNG.rgbToDXT5Color = function (color) {
        var r5 = Math.floor((color.r * 31) / 255);
        var g6 = Math.floor((color.g * 63) / 255);
        var b5 = Math.floor((color.b * 31) / 255);
        var cColor = (r5 << 11) | (g6 << 5) | b5;
        return cColor;
    };
    DXT5TOPNG.createPalette = function (c0, c1) {
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
    DXT5TOPNG.findBestColorIndex = function (pixelColor, palette) {
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
    DXT5TOPNG.calculateEuclideanDistance = function (color1, color2) {
        return Math.sqrt(Math.pow(color1.r - color2.r, 2) + Math.pow(color1.g - color2.g, 2) + Math.pow(color1.b - color2.b, 2));
    };
    DXT5TOPNG.createPNGBufferFromDDSBuffer = function (buffer) {
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
    DXT5TOPNG.dxt5ColorToRGB = function (color) {
        var r = ((color >> 11) & 0x1F) * 255 / 31;
        var g = ((color >> 5) & 0x3F) * 255 / 63;
        var b = (color & 0x1F) * 255 / 31;
        return { r: r, g: g, b: b };
    };
    DXT5TOPNG.getAlpha = function (a0, a1, aMap, index) {
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
    return DXT5TOPNG;
}());
exports.DXT5TOPNG = DXT5TOPNG;
var FrameOverlay = /** @class */ (function () {
    function FrameOverlay() {
    }
    FrameOverlay.overlayImages = function (imagebase, overlays) {
        return __awaiter(this, void 0, void 0, function () {
            var baseImage, index, overlay, insertImage, overlayImage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!fs.existsSync(imagebase))
                            throw new Error("Image not found");
                        return [4 /*yield*/, Jimp.read(imagebase)];
                    case 1:
                        baseImage = _a.sent();
                        index = 0;
                        _a.label = 2;
                    case 2:
                        if (!(index < overlays.length)) return [3 /*break*/, 5];
                        overlay = overlays[index];
                        insertImage = overlay.image;
                        if (!insertImage && overlay.userImage)
                            insertImage = overlay.userImage;
                        if (!insertImage || !fs.existsSync(insertImage))
                            throw new Error("Image not found");
                        return [4 /*yield*/, Jimp.read(insertImage)];
                    case 3:
                        overlayImage = _a.sent();
                        overlayImage.cover(overlay.width, overlay.height);
                        baseImage.composite(overlayImage, overlay.x, overlay.y);
                        _a.label = 4;
                    case 4:
                        index++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, baseImage.getBufferAsync(Jimp.MIME_PNG)];
                    case 6: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return FrameOverlay;
}());
exports.FrameOverlay = FrameOverlay;
var FramePackage = /** @class */ (function () {
    function FramePackage(structureFile) {
        this.valid = false;
        this.structure = undefined;
        this.structureFile = undefined;
        this.readStructure(structureFile);
        this.structureFile = structureFile;
    }
    FramePackage.getAllFramePackages = function (toolFolder) {
        var arr = [];
        if (!fs.existsSync(toolFolder))
            return arr;
        var files = fs.readdirSync(toolFolder);
        files.forEach(function (file) {
            var sf = path.join(toolFolder, file, "structure.json");
            if (!fs.existsSync(sf))
                return;
            var p = new FramePackage(sf);
            arr.push(p);
        });
        return arr;
    };
    FramePackage.prototype.readStructure = function (structureFile) {
        this.valid = false;
        try {
            if (!structureFile || !fs.existsSync(structureFile))
                return;
            var data = undefined;
            data = JSON.parse(fs.readFileSync(structureFile).toString());
            //Base values
            var req = ["id", "name", "file", "thumbnail", "modi", "files"];
            for (var index = 0; index < req.length; index++) {
                var key = req[index];
                if (!(key in data))
                    return;
            }
            //Check files
            var folder = path.dirname(structureFile);
            var reqFiles = data.files;
            for (var index = 0; index < reqFiles.length; index++) {
                var file = reqFiles[index];
                if (!fs.existsSync(path.join(folder, file.name))) {
                    return;
                }
            }
            this.folder = folder;
            this.structure = data;
        }
        catch (error) {
            this.valid = false;
            console.log(error);
            return;
        }
        this.valid = true;
    };
    FramePackage.prototype.createPackge = function (swatches_1, outFile_1) {
        return __awaiter(this, arguments, void 0, function (swatches, outFile, creatorName) {
            var packageBase, packageNew, itemName, itemDescription, time, creator, baseInstance, firstImage, modlInstance, index, swatch, mode, baseTexturePath, textureBuffer, ddsBuffer, name_1, instanceRaw, instance, data, index, swatch, type, group, instance, itemStblNameKey, itemStblDescKey, itemStblKey, stbls, index, stbl, type, group, baseKey, instance, baseOBJDs, baseOBJD, index, swatch, type, group, instance, name_2, materialVariant, buf, baseCOBJs, index, swatch, type, group, instance, cobj, modls, index, grf, buf, type, group, instance, mlods, index, grf, buf, type, group, instance, ignoreTypes, baseEntries, thumBuffer, thumEntry;
            var _a;
            if (creatorName === void 0) { creatorName = "Unknown"; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.valid)
                            throw new Error("Invalid structure");
                        packageBase = new DBPFReader_1.Pack(path.join(this.folder, this.structure.file));
                        packageNew = new DBPFReader_1.Pack(outFile);
                        packageBase.checkFile();
                        if (packageBase.error)
                            throw new Error("Broken base package file");
                        packageBase.calculateIndexList();
                        itemName = "Test Name";
                        itemDescription = "Test Description";
                        time = getCurrentTimestamp();
                        creator = creatorName + "_S4MM";
                        baseInstance = undefined;
                        firstImage = undefined;
                        modlInstance = DBPFReader_1.SimsHashes.instanceId([creator, "S4MM_BB_Modle", time, "_modl"].join("_"));
                        console.log("Modl Instance", modlInstance.hex);
                        index = 0;
                        _b.label = 1;
                    case 1:
                        if (!(index < swatches.length)) return [3 /*break*/, 5];
                        swatch = swatches[index];
                        mode = swatch.mode;
                        baseTexturePath = path.join(this.folder, mode.base);
                        if (!firstImage && mode.inserts.length > 0 && mode.inserts[0].userImage != undefined)
                            firstImage = mode.inserts[0].userImage;
                        return [4 /*yield*/, FrameOverlay.overlayImages(baseTexturePath, mode.inserts)];
                    case 2:
                        textureBuffer = _b.sent();
                        return [4 /*yield*/, DXT5TOPNG.createDDSBufferFromPNGBuffer(textureBuffer)];
                    case 3:
                        ddsBuffer = _b.sent();
                        swatch.ddsTexture = ddsBuffer;
                        name_1 = [creator, mode.name, time, "set" + (index + 1)].join("_");
                        if (baseInstance == undefined) {
                            instanceRaw = instanceId(name_1, true);
                            baseInstance = instanceRaw.num;
                        }
                        instance = baseInstance + BigInt(index);
                        data = {
                            ddsBuffer: ddsBuffer,
                            name: name_1,
                            colors: adjustColors(swatch.colors),
                            instance: instance,
                            instanceHex: instance.toString(16).padStart(16, "0")
                        };
                        swatch.data = data;
                        _b.label = 4;
                    case 4:
                        index++;
                        return [3 /*break*/, 1];
                    case 5:
                        //Add Texture Entries
                        for (index = 0; index < swatches.length; index++) {
                            swatch = swatches[index];
                            type = 0x00B2D882;
                            group = 0x80000000;
                            instance = swatch.data.instanceHex;
                            packageNew.addOrOverrideEntry(type, group, instance, swatch.data.ddsBuffer);
                        }
                        itemStblNameKey = Number(DBPFReader_1.SimsHashes.fnv1_32(itemName).num);
                        itemStblDescKey = itemStblNameKey + 1;
                        itemStblKey = Number((modlInstance.num + BigInt(1)) & BigInt(0xFFFFFFF)).toString(16).padStart(8, "0");
                        stbls = packageBase.getFilteredIndexEntries(0x220557DA);
                        for (index = 0; index < stbls.length; index++) {
                            stbl = new DBPFReader_1.STBLFile(stbls[index].getByteArray());
                            stbl.entries = [
                                { key: itemStblNameKey, value: itemName, flag: 0x0 },
                                { key: itemStblDescKey, value: itemDescription, flag: 0x0 }
                            ];
                            type = 0x220557DA;
                            group = 0x80000000;
                            baseKey = stbls[index].getInstanceString().substring(0, 8);
                            instance = baseKey + itemStblKey;
                            packageNew.addOrOverrideEntry(type, group, instance, stbl.toBuffer());
                        }
                        baseOBJDs = packageBase.getFilteredIndexEntries(0xC0DB5AE7);
                        if (baseOBJDs.length == 0)
                            throw new Error("No OBJD found in base package");
                        baseOBJD = new DBPFReader_1.OBJDFile(baseOBJDs[0].getByteArray());
                        for (index = 0; index < swatches.length; index++) {
                            swatch = swatches[index];
                            type = 0xC0DB5AE7;
                            group = 0x80000000;
                            instance = swatch.data.instanceHex;
                            name_2 = swatch.data.name;
                            materialVariant = "set" + (index + 1) + "-materialVariant";
                            baseOBJD.name = name_2;
                            baseOBJD.materialVariant = materialVariant;
                            baseOBJD.model = [{
                                    type: 0x01661233,
                                    group: 0x0,
                                    instance: modlInstance.num
                                }];
                            swatch.data.materialVariant = materialVariant;
                            swatch.data.materialVariantHashValues = DBPFReader_1.SimsHashes.fnv1_32(materialVariant);
                            buf = baseOBJD.calulateNewBuffer();
                            //let tmp = path.join(tmpFolder,name+".binry");
                            //fs.writeFileSync(tmp,buf);
                            packageNew.addOrOverrideEntry(type, group, instance, buf);
                            //console.log(swatch);
                        }
                        baseCOBJs = packageBase.getFilteredIndexEntries(0x319E4F1D);
                        if (baseCOBJs.length == 0)
                            throw new Error("No COBJ found in base package");
                        for (index = 0; index < swatches.length; index++) {
                            swatch = swatches[index];
                            type = 0x319E4F1D;
                            group = 0x80000000;
                            instance = swatch.data.instanceHex;
                            cobj = new DBPFReader_1.COBJFile(baseCOBJs[0].getByteArray(), baseCOBJs[0].r_type);
                            cobj.nameHash = itemStblNameKey;
                            cobj.descriptionHash = itemStblDescKey;
                            cobj.colors = swatch.data.colors;
                            /*
                            let fileName = type.toString(16).padStart(8,"0")+"_"+group.toString(16).padStart(8,"0")+"_"+instance;
                            let folder = "G:\\User data\\Documents\\Sims 4 Mod Manager Data\\temp"
                            let fileBase = path.join(folder,fileName+"_base.binry");
                            let fileNew = path.join(folder,fileName+"_new.binry");
                            fs.writeFileSync(fileBase,baseCOBJs[0].getByteArray());
                            fs.writeFileSync(fileNew,cobj.toBuffer());
                            */
                            //Update swatches
                            packageNew.addOrOverrideEntry(type, group, instance, cobj.toBuffer());
                        }
                        modls = packageBase.getFilteredIndexEntries(0x01661233);
                        for (index = 0; index < modls.length; index++) {
                            grf = new DBPFReader_1.GenericRCOLFile(modls[index].getByteArray());
                            buf = grf.overrideMTSTandMATD(swatches);
                            type = 0x01661233;
                            group = modls[index].r_group;
                            instance = modlInstance.hex;
                            packageNew.addOrOverrideEntry(type, group, instance, buf);
                        }
                        mlods = packageBase.getFilteredIndexEntries(0x01D10F34);
                        for (index = 0; index < mlods.length; index++) {
                            grf = new DBPFReader_1.GenericRCOLFile(mlods[index].getByteArray());
                            buf = grf.overrideMTSTandMATD(swatches);
                            type = 0x01D10F34;
                            group = modls[index].r_group;
                            instance = modlInstance.hex;
                            packageNew.addOrOverrideEntry(type, group, instance, buf);
                        }
                        ignoreTypes = new Set([0x319E4F1D, 0xC0DB5AE7]);
                        baseEntries = packageBase.index_List.filter(function (entry) { return !ignoreTypes.has(entry.r_type); });
                        (_a = packageNew.index_List).push.apply(_a, baseEntries);
                        thumBuffer = undefined;
                        if (!firstImage) return [3 /*break*/, 7];
                        return [4 /*yield*/, LoadingImage_1.Image.createThumbnail(firstImage, "img_frame_tool_cover.png")];
                    case 6:
                        thumBuffer = _b.sent();
                        _b.label = 7;
                    case 7:
                        if (thumBuffer) {
                            thumEntry = new DBPFReader_1.IndexEnty(packageNew.file, 0xAA00AA00, 0x0, 0x0, 0x0, 0, thumBuffer.length, thumBuffer.length, 0x0, 0x01);
                            thumEntry.setBuffer(thumBuffer);
                            packageNew.index_List.push(thumEntry);
                        }
                        else {
                            console.log("Failed to create thumbnail!");
                        }
                        //Save Package
                        packageNew.saveToFile(outFile);
                        return [2 /*return*/];
                }
            });
        });
    };
    return FramePackage;
}());
exports.FramePackage = FramePackage;
function getCurrentTimestamp() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    var seconds = String(now.getSeconds()).padStart(2, '0');
    var milliseconds = String(now.getMilliseconds()).padStart(4, '0');
    return "".concat(year).concat(month).concat(day).concat(hours).concat(minutes).concat(seconds).concat(milliseconds);
}
function adjustColors(colorsS) {
    var colorsN = [];
    colorsS.forEach(function (color) {
        var c = color.replace("#", "").trim();
        if (c.length != 6)
            c = "000000";
        //Add alpha
        c = "FF" + c;
        //Connvert to number
        var numberValue = parseInt(c, 16);
        colorsN.push(numberValue);
    });
    return colorsN;
}
