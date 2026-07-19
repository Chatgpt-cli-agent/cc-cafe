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
exports.Image = void 0;
var fs = require('fs');
var zlib = require("zlib");
var sharp = require('sharp');
var path = require('path');
var Buffer = require('buffer').Buffer;
var PNGImage = require('@nodebug/pngjs-image');
var Jimp = require("jimp");
var util = require('util');
var curseforge = require('@meza/curseforge-fingerprint');
var Pack = require('./DBPFReader.js').Pack;
var IndexEnty = require('./DBPFReader.js').IndexEnty;
var options = { level: 9, windowBits: 15 };
var Image = /** @class */ (function () {
    function Image() {
    }
    Image.toImage = function (file, outImage) {
        try {
            var buf = fs.readFileSync(file);
            var pixels = [];
            var pos = 0;
            console.log(buf.length);
            while (pos < buf.length - 4) {
                var obj = {
                    a: buf[pos],
                    r: buf[pos + 1],
                    g: buf[pos + 2],
                    b: buf[pos + 3]
                };
                pos += 4;
                pixels.push(obj);
            }
            var image = PNGImage.createImage(1920, 1080);
            var index = 0;
            for (var i = 0; i < 1080; i++) {
                for (var j = 0; j < 1920; j++) {
                    var obj = pixels[index];
                    index++;
                    if (obj)
                        image.setPixel(j, i, { red: obj.r, green: obj.g, blue: obj.b, alpha: obj.a });
                }
            }
            image.writeImageSync(outImage);
        }
        catch (error) {
            console.log(error);
        }
    };
    Image.decompressImage = function (fIn, fOut) {
        var buf = fs.readFileSync(fIn);
        var inflated = zlib.inflateSync(buf);
        fs.writeFileSync(fOut, inflated);
    };
    Image.compressImage = function (fIn, fOut) {
        var buf = fs.readFileSync(fIn);
        var deflate = zlib.deflateSync(buf, options);
        fs.writeFileSync(fOut, deflate);
    };
    Image.imageToPixelArray = function (file, fOut) {
        return __awaiter(this, void 0, void 0, function () {
            var readImagePromise, image, byteArray, index, y, x, color, buf, deflate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        readImagePromise = function () {
                            return new Promise(function (resolve, reject) {
                                PNGImage.readImage(file, function (err, image) {
                                    if (err)
                                        return reject(err);
                                    resolve(image);
                                });
                            });
                        };
                        return [4 /*yield*/, readImagePromise()];
                    case 1:
                        image = _a.sent();
                        if (!image)
                            return [2 /*return*/];
                        byteArray = [];
                        index = 0;
                        for (y = 0; y < 1080; y++) {
                            for (x = 0; x < 1920; x++) {
                                color = {
                                    alpha: image.getAlpha(index),
                                    red: image.getRed(index),
                                    green: image.getGreen(index),
                                    blue: image.getBlue(index)
                                };
                                index++;
                                byteArray.push(color.alpha);
                                byteArray.push(color.red);
                                byteArray.push(color.green);
                                byteArray.push(color.blue);
                            }
                        }
                        buf = new Buffer(byteArray);
                        deflate = zlib.deflateSync(buf, options);
                        fs.writeFileSync(fOut, deflate);
                        return [2 /*return*/];
                }
            });
        });
    };
    Image.getGPXBuffer = function (fPre, fPost, imageFile) {
        var bufPre = fs.readFileSync(fPre);
        var bufPost = fs.readFileSync(fPost);
        var bufImage = fs.readFileSync(imageFile);
        //Image Info
        var imageInfo = Buffer.alloc(13);
        imageInfo.writeUInt16LE(2367); //TagIdLength
        imageInfo.writeInt32LE(bufImage.length + 13, 2); //-5?
        imageInfo.writeUInt16LE(119, 6); //CharacterID
        imageInfo.writeUInt8(5, 8); //Format
        imageInfo.writeUInt16LE(1920, 9); //Width
        imageInfo.writeUInt16LE(1080, 11); //Height
        var buf = Buffer.concat([bufPre, imageInfo, bufImage, bufPost]);
        buf.writeUInt32LE(buf.length, 4);
        return buf;
    };
    Image.moveAndInsert = function (knex, file, modFolder, imagePath, name, imageFolder) {
        return __awaiter(this, void 0, void 0, function () {
            var stats, fingerprint, imageFile, imageSource, pack, cover, im, buf, folderName, desFolder, filename, filePath, obj, entry, sel, items;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!fs.existsSync(file) || !fs.existsSync(modFolder) || !fs.existsSync(imagePath) || !fs.existsSync(imageFolder))
                            return [2 /*return*/, undefined];
                        stats = fs.statSync(file);
                        fingerprint = -1;
                        try {
                            if (stats.size < 150000000) {
                                fingerprint = curseforge.fingerprint(file);
                            }
                            else {
                                console.log("[Error] File to big - size: " + stats.size + " | path: " + file);
                            }
                        }
                        catch (error) {
                            console.log(error);
                        }
                        imageFile = "";
                        imageSource = 0;
                        try {
                            pack = new Pack(file);
                            pack.checkFile();
                            if (pack.error)
                                throw new Error("Internal");
                            pack.calculateIndexList();
                            cover = pack.getEntryIfExists(0xAA00AA00, 0x0, "0000000000000000");
                            if (cover) {
                                im = path.join(imageFolder, "[CC]" + stats.ino + ".png");
                                buf = cover.getByteArray();
                                fs.writeFileSync(im, buf);
                                if (fs.existsSync(im)) {
                                    imageFile = im;
                                    imageSource = 1;
                                }
                            }
                        }
                        catch (error) {
                            console.log(error);
                        }
                        folderName = "Custom Loading Screens";
                        desFolder = path.join(modFolder, folderName);
                        if (!fs.existsSync(desFolder)) {
                            fs.mkdirSync(desFolder);
                            if (!fs.existsSync(desFolder))
                                return [2 /*return*/, undefined];
                        }
                        filename = name + ".package";
                        filePath = path.join(desFolder, filename);
                        if (fs.existsSync(filePath))
                            return [2 /*return*/, undefined];
                        fs.renameSync(file, filePath);
                        if (!fs.existsSync(filePath))
                            return [2 /*return*/, undefined];
                        obj = {
                            "path": desFolder,
                            "mfolder": folderName,
                            "ino": stats.ino,
                            "clear_name": filename,
                            "name": filename,
                            "image": imageFile,
                            "image_source": imageSource,
                            "casp": 0,
                            "cobj": 0,
                            "clip": 0,
                            "ressourcen": "62ecc59a-00000000-432d1d2addffc6d8",
                            "error": 0,
                            "recolor": 0,
                            "merged": 0,
                            "categories": "",
                            "checked": 0,
                            "fingerprint": fingerprint,
                            "mtime": stats.mtime,
                            "size": stats.size,
                            "indownloads": null,
                            "cf_id": 0
                        };
                        return [4 /*yield*/, knex.from("Files").insert(obj)];
                    case 1:
                        _a.sent();
                        entry = {
                            ino: stats.ino,
                            type: 1659684250,
                            group: 0,
                            instance: "432d1d2addffc6d8"
                        };
                        return [4 /*yield*/, knex.from("Entries").insert(entry)];
                    case 2:
                        _a.sent();
                        sel = ["id", "path", "name", "clear_name", "image", "categories", "merged", "recolor", "casp", "mtime", "size", "ino"];
                        return [4 /*yield*/, knex.from("Files").select(sel).where("ino", stats.ino)];
                    case 3:
                        items = _a.sent();
                        if (items.length == 1) {
                            return [2 /*return*/, items[0]];
                        }
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    //Image
    Image.resizeImage = function (imagePath, outFile) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    return [2 /*return*/, this.resizeImageTo(imagePath, outFile, 1920, 1080)];
                }
                catch (error) {
                    return [2 /*return*/, undefined];
                }
                return [2 /*return*/];
            });
        });
    };
    Image.resizeImageTo = function (imagePath, outFile, resX, resY) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!imagePath || !fs.existsSync(imagePath)) {
                            console.log("[resizeImageTo] Image not found!");
                            console.log(imagePath);
                            return [2 /*return*/, undefined];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, sharp(imagePath)
                                .resize(resX, resY)
                                .toFile(outFile)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.log(error_1);
                        return [2 /*return*/, undefined];
                    case 4:
                        if (fs.existsSync(outFile)) {
                            return [2 /*return*/, outFile];
                        }
                        console.log("[resizeImageTo] Image not saved!");
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    Image.resizeImageToBuffer = function (imagePath, resX, resY) {
        return __awaiter(this, void 0, void 0, function () {
            var image, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!imagePath || !fs.existsSync(imagePath))
                            return [2 /*return*/, undefined];
                        image = undefined;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Jimp.read(imagePath)];
                    case 2:
                        image = _a.sent();
                        if (!image)
                            return [2 /*return*/, undefined];
                        image.cover(resX, resY);
                        return [2 /*return*/, image.getBufferAsync(Jimp.MIME_PNG)];
                    case 3:
                        error_2 = _a.sent();
                        console.log(undefined);
                        return [2 /*return*/, undefined];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    //Thumbnail
    Image.createThumbnail = function (imagePath, type) {
        return __awaiter(this, void 0, void 0, function () {
            var overlayPath, overlayImage, image, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        overlayPath = path.join(__dirname, "data", type);
                        console.log(overlayPath);
                        if (!imagePath || !fs.existsSync(imagePath) || !fs.existsSync(overlayPath))
                            return [2 /*return*/, undefined];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Jimp.read(overlayPath)];
                    case 2:
                        overlayImage = _a.sent();
                        return [4 /*yield*/, Jimp.read(imagePath)];
                    case 3:
                        image = _a.sent();
                        if (!image)
                            return [2 /*return*/, undefined];
                        image.cover(204, 296);
                        image.composite(overlayImage, 0, 0);
                        return [2 /*return*/, image.getBufferAsync(Jimp.MIME_PNG)];
                    case 4:
                        error_3 = _a.sent();
                        console.log(error_3);
                        return [2 /*return*/, undefined];
                    case 5:
                        ;
                        return [2 /*return*/];
                }
            });
        });
    };
    //Better Code
    Image.getGpxBufferLoadingScreen = function (image1080, fPre, fPost, compressed, options) {
        return __awaiter(this, void 0, void 0, function () {
            var imageBuffer, bufPre, bufPost, fullColorString, matchResult, colorByteArray, pos, gfxBuffer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.imageToBuffer(image1080, true)];
                    case 1:
                        imageBuffer = _a.sent();
                        bufPre = fs.readFileSync(fPre);
                        bufPost = fs.readFileSync(fPost);
                        //Options
                        if (options.showTips == false || options.tipsColor != "#FFFFFF") {
                            fullColorString = (options.showTips ? "FF" : "00") + options.tipsColor.replace("#", "");
                            matchResult = fullColorString.match(/.{1,2}/g);
                            colorByteArray = matchResult ? matchResult.map(function (v) { return parseInt(v, 16); }) : [];
                            pos = 0x373e4d - 0x371611;
                            bufPost[pos] = colorByteArray[1];
                            bufPost[pos + 1] = colorByteArray[2];
                            bufPost[pos + 2] = colorByteArray[3];
                            bufPost[pos + 3] = colorByteArray[0];
                        }
                        gfxBuffer = this.createGFXBufferLoadingScreen(bufPre, bufPost, imageBuffer);
                        if (compressed) {
                            return [2 /*return*/, zlib.deflateSync(gfxBuffer, options)];
                        }
                        return [2 /*return*/, gfxBuffer];
                }
            });
        });
    };
    Image.getGpxBufferMainMenu = function (image1080, fPre, fPost, compressed) {
        return __awaiter(this, void 0, void 0, function () {
            var imageBuffer, bufPre, bufPost, gfxBuffer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.imageToBuffer(image1080, true)];
                    case 1:
                        imageBuffer = _a.sent();
                        bufPre = fs.readFileSync(fPre);
                        bufPost = fs.readFileSync(fPost);
                        gfxBuffer = this.createGFXBufferMainMenu(bufPre, bufPost, imageBuffer);
                        if (compressed) {
                            return [2 /*return*/, zlib.deflateSync(gfxBuffer, options)];
                        }
                        return [2 /*return*/, gfxBuffer];
                }
            });
        });
    };
    Image.createGFXBufferLoadingScreen = function (pre, post, image) {
        var imageInfo = Buffer.alloc(13);
        imageInfo.writeUInt16LE(2367); //TagIdLength
        imageInfo.writeInt32LE(image.length + 13 - 6, 2); //-6?
        imageInfo.writeUInt16LE(119, 6); //CharacterID
        imageInfo.writeUInt8(5, 8); //Format
        imageInfo.writeUInt16LE(1920, 9); //Width
        imageInfo.writeUInt16LE(1080, 11); //Height
        var buf = Buffer.concat([pre, imageInfo, image, post]);
        buf.writeUInt32LE(buf.length, 4);
        return buf;
    };
    Image.createGFXBufferMainMenu = function (pre, post, image) {
        var imageInfo = Buffer.alloc(13);
        imageInfo.writeUInt16LE(2367); //TagIdLength
        imageInfo.writeInt32LE(image.length + 13 - 6, 2); //-6?
        imageInfo.writeUInt16LE(1002, 6); //CharacterID
        imageInfo.writeUInt8(5, 8); //Format
        imageInfo.writeUInt16LE(1920, 9); //Width
        imageInfo.writeUInt16LE(1080, 11); //Height
        var buf = Buffer.concat([pre, imageInfo, image, post]);
        buf.writeUInt32LE(buf.length, 4);
        return buf;
    };
    Image.imageToBuffer = function (file, compressed) {
        return __awaiter(this, void 0, void 0, function () {
            var readImagePromise, image, byteArray, index, y, x, color, buf;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        readImagePromise = function () {
                            return new Promise(function (resolve, reject) {
                                PNGImage.readImage(file, function (err, image) {
                                    if (err)
                                        return reject(err);
                                    resolve(image);
                                });
                            });
                        };
                        return [4 /*yield*/, readImagePromise()];
                    case 1:
                        image = _a.sent();
                        if (!image) {
                            throw new Error("Image is undefinded!");
                        }
                        if (image.getWidth() != 1920 || image.getHeight() != 1080) {
                            throw new Error("Wrong dimensions!");
                        }
                        byteArray = [];
                        index = 0;
                        for (y = 0; y < 1080; y++) {
                            for (x = 0; x < 1920; x++) {
                                color = {
                                    alpha: image.getAlpha(index),
                                    red: image.getRed(index),
                                    green: image.getGreen(index),
                                    blue: image.getBlue(index)
                                };
                                index++;
                                byteArray.push(color.alpha);
                                byteArray.push(color.red);
                                byteArray.push(color.green);
                                byteArray.push(color.blue);
                            }
                        }
                        buf = new Buffer(byteArray);
                        if (compressed) {
                            return [2 /*return*/, zlib.deflateSync(buf, options)];
                        }
                        return [2 /*return*/, buf];
                }
            });
        });
    };
    Image.createLoadingScreenPackage = function (packageFile, imageFile, pre, post, optionsRaw) {
        return __awaiter(this, void 0, void 0, function () {
            var options, gfx, newPack, gfxFileEntry, thumBuffer, thumEntry;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            showTips: true,
                            tipsColor: "#FFFFFF"
                        };
                        if (optionsRaw && optionsRaw.showTips != undefined)
                            options.showTips = optionsRaw.showTips;
                        if (optionsRaw && optionsRaw.tipsColor != undefined)
                            options.tipsColor = optionsRaw.tipsColor;
                        return [4 /*yield*/, Image.getGpxBufferLoadingScreen(imageFile, pre, post, false, options)];
                    case 1:
                        gfx = _a.sent();
                        newPack = new Pack(packageFile);
                        gfxFileEntry = new IndexEnty(packageFile, 0x62ECC59A, 0x0, 0x432D1D2A, 0xDDFFC6D8, 0, gfx.length, gfx.length, 0x0, 0x01);
                        gfxFileEntry.setBuffer(gfx);
                        newPack.index_List.push(gfxFileEntry);
                        return [4 /*yield*/, Image.createThumbnail(imageFile, "img_loading_cover.png")];
                    case 2:
                        thumBuffer = _a.sent();
                        if (thumBuffer) {
                            thumEntry = new IndexEnty(packageFile, 0xAA00AA00, 0x0, 0x0, 0x0, 0, thumBuffer.length, thumBuffer.length, 0x0, 0x01);
                            thumEntry.setBuffer(thumBuffer);
                            newPack.index_List.push(thumEntry);
                        }
                        newPack.saveToFile(packageFile);
                        return [2 /*return*/];
                }
            });
        });
    };
    Image.createMainMenuPackage = function (packageFile, imageFile, pre, post, sideFadeLeft, options, tmpFolder) {
        return __awaiter(this, void 0, void 0, function () {
            var inputImage, overlayImage, image, error_4, gfx, newPack, gfxFileEntry, thumBuffer, thumEntry;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        inputImage = imageFile;
                        if (!(options && options.useBlackSideFade)) return [3 /*break*/, 6];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, Jimp.read(sideFadeLeft)];
                    case 2:
                        overlayImage = _a.sent();
                        return [4 /*yield*/, Jimp.read(imageFile)];
                    case 3:
                        image = _a.sent();
                        image.composite(overlayImage, 0, 0);
                        inputImage = path.join(tmpFolder, "black_side_fade_image.png");
                        return [4 /*yield*/, image.writeAsync(inputImage)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_4 = _a.sent();
                        console.log(error_4);
                        return [3 /*break*/, 6];
                    case 6: return [4 /*yield*/, Image.getGpxBufferMainMenu(inputImage, pre, post, false)];
                    case 7:
                        gfx = _a.sent();
                        newPack = new Pack(packageFile);
                        gfxFileEntry = new IndexEnty(packageFile, 0x62ECC59A, 0x0, 0x6D20AB71, 0x641B1539, 0, gfx.length, gfx.length, 0x0, 0x01);
                        gfxFileEntry.setBuffer(gfx);
                        newPack.index_List.push(gfxFileEntry);
                        return [4 /*yield*/, Image.createThumbnail(imageFile, "img_main_menu_cover.png")];
                    case 8:
                        thumBuffer = _a.sent();
                        if (thumBuffer) {
                            thumEntry = new IndexEnty(packageFile, 0xAA00AA00, 0x0, 0x0, 0x0, 0, thumBuffer.length, thumBuffer.length, 0x0, 0x01);
                            thumEntry.setBuffer(thumBuffer);
                            newPack.index_List.push(thumEntry);
                        }
                        newPack.saveToFile(packageFile);
                        return [2 /*return*/];
                }
            });
        });
    };
    return Image;
}());
exports.Image = Image;
