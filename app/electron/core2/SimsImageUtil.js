"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimsImageUtil = void 0;
const DBPFReader_1 = require("./DBPFReader");
var fs = require('fs');
var zlib = require("zlib");
const sharp = require('sharp');
const path = require('path');
const { Buffer } = require('buffer');
const PNGImage = require('@nodebug/pngjs-image');
const Jimp = require("jimp");
const options = { level: 9, windowBits: 15 };
class SimsImageUtil {
    static toImage(file, outImage) {
        try {
            let buf = fs.readFileSync(file);
            let pixels = [];
            let pos = 0;
            console.log(buf.length);
            while (pos < buf.length - 4) {
                let obj = {
                    a: buf[pos],
                    r: buf[pos + 1],
                    g: buf[pos + 2],
                    b: buf[pos + 3]
                };
                pos += 4;
                pixels.push(obj);
            }
            var image = PNGImage.createImage(1920, 1080);
            let index = 0;
            for (let i = 0; i < 1080; i++) {
                for (let j = 0; j < 1920; j++) {
                    let obj = pixels[index];
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
    }
    static decompressImage(fIn, fOut) {
        let buf = fs.readFileSync(fIn);
        var inflated = zlib.inflateSync(buf);
        fs.writeFileSync(fOut, inflated);
    }
    static compressImage(fIn, fOut) {
        let buf = fs.readFileSync(fIn);
        var deflate = zlib.deflateSync(buf, options);
        fs.writeFileSync(fOut, deflate);
    }
    static async imageToPixelArray(file, fOut) {
        const readImagePromise = () => {
            return new Promise((resolve, reject) => {
                PNGImage.readImage(file, function (err, image) {
                    if (err)
                        return reject(err);
                    resolve(image);
                });
            });
        };
        let image = await readImagePromise();
        if (!image)
            return;
        let byteArray = [];
        let index = 0;
        for (let y = 0; y < 1080; y++) {
            for (let x = 0; x < 1920; x++) {
                let color = {
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
        let buf = new Buffer(byteArray);
        let deflate = zlib.deflateSync(buf, options);
        fs.writeFileSync(fOut, deflate);
    }
    static getGPXBuffer(fPre, fPost, imageFile) {
        let bufPre = fs.readFileSync(fPre);
        let bufPost = fs.readFileSync(fPost);
        let bufImage = fs.readFileSync(imageFile);
        //Image Info
        let imageInfo = Buffer.alloc(13);
        imageInfo.writeUInt16LE(2367); //TagIdLength
        imageInfo.writeInt32LE(bufImage.length + 13, 2); //-5?
        imageInfo.writeUInt16LE(119, 6); //CharacterID
        imageInfo.writeUInt8(5, 8); //Format
        imageInfo.writeUInt16LE(1920, 9); //Width
        imageInfo.writeUInt16LE(1080, 11); //Height
        let buf = Buffer.concat([bufPre, imageInfo, bufImage, bufPost]);
        buf.writeUInt32LE(buf.length, 4);
        return buf;
    }
    //Image
    static async resizeImage(imagePath, outFile) {
        try {
            return this.resizeImageTo(imagePath, outFile, 1920, 1080);
        }
        catch (error) {
            return undefined;
        }
    }
    static async resizeImageTo(imagePath, outFile, resX, resY) {
        if (!imagePath || !fs.existsSync(imagePath)) {
            console.log("[resizeImageTo] Image not found!");
            console.log(imagePath);
            return undefined;
        }
        try {
            await sharp(imagePath)
                .resize(resX, resY)
                .toFile(outFile);
        }
        catch (error) {
            console.log(error);
            return undefined;
        }
        if (fs.existsSync(outFile)) {
            return outFile;
        }
        console.log("[resizeImageTo] Image not saved!");
        return undefined;
    }
    static async resizeImageToBuffer(imagePath, resX, resY) {
        if (!imagePath || !fs.existsSync(imagePath))
            return undefined;
        let image = undefined;
        try {
            image = await Jimp.read(imagePath);
            if (!image)
                return undefined;
            image.cover(resX, resY);
            return image.getBufferAsync(Jimp.MIME_PNG);
        }
        catch (error) {
            console.log(undefined);
            return undefined;
        }
    }
    //Thumbnail
    static async createThumbnail(imagePath, type) {
        let overlayPath = path.join(__dirname, "files", type);
        console.log(overlayPath);
        if (!imagePath || !fs.existsSync(imagePath) || !fs.existsSync(overlayPath))
            return undefined;
        try {
            const overlayImage = await Jimp.read(overlayPath);
            let image = await Jimp.read(imagePath);
            if (!image)
                return undefined;
            image.cover(204, 296);
            image.composite(overlayImage, 0, 0);
            return image.getBufferAsync(Jimp.MIME_PNG);
        }
        catch (error) {
            console.log(error);
            return undefined;
        }
        ;
    }
    //Better Code
    static async getGpxBufferLoadingScreen(image1080, fPre, fPost, compressed, options) {
        let imageBuffer = await this.imageToBuffer(image1080, true);
        let bufPre = fs.readFileSync(fPre);
        let bufPost = fs.readFileSync(fPost);
        //Options
        if (options.showTips == false || options.tipsColor != "#FFFFFF") {
            //Create Color Array
            let fullColorString = (options.showTips ? "FF" : "00") + options.tipsColor.replace("#", "");
            let matchResult = fullColorString.match(/.{1,2}/g);
            let colorByteArray = matchResult ? matchResult.map((v) => parseInt(v, 16)) : [];
            //Replace Color in Post
            let pos = 0x373e4d - 0x371611;
            bufPost[pos] = colorByteArray[1];
            bufPost[pos + 1] = colorByteArray[2];
            bufPost[pos + 2] = colorByteArray[3];
            bufPost[pos + 3] = colorByteArray[0];
        }
        let gfxBuffer = this.createGFXBufferLoadingScreen(bufPre, bufPost, imageBuffer);
        if (compressed) {
            return zlib.deflateSync(gfxBuffer, options);
        }
        return gfxBuffer;
    }
    static async getGpxBufferMainMenu(image1080, fPre, fPost, compressed) {
        let imageBuffer = await this.imageToBuffer(image1080, true);
        let bufPre = fs.readFileSync(fPre);
        let bufPost = fs.readFileSync(fPost);
        let gfxBuffer = this.createGFXBufferMainMenu(bufPre, bufPost, imageBuffer);
        if (compressed) {
            return zlib.deflateSync(gfxBuffer, options);
        }
        return gfxBuffer;
    }
    static createGFXBufferLoadingScreen(pre, post, image) {
        let imageInfo = Buffer.alloc(13);
        imageInfo.writeUInt16LE(2367); //TagIdLength
        imageInfo.writeInt32LE(image.length + 13 - 6, 2); //-6?
        imageInfo.writeUInt16LE(120, 6); //CharacterID
        imageInfo.writeUInt8(5, 8); //Format
        imageInfo.writeUInt16LE(1920, 9); //Width
        imageInfo.writeUInt16LE(1080, 11); //Height
        let buf = Buffer.concat([pre, imageInfo, image, post]);
        buf.writeUInt32LE(buf.length, 4);
        return buf;
    }
    static createGFXBufferMainMenu(pre, post, image) {
        let imageInfo = Buffer.alloc(13);
        imageInfo.writeUInt16LE(2367); //TagIdLength
        imageInfo.writeInt32LE(image.length + 13 - 6, 2); //-6?
        imageInfo.writeUInt16LE(1208, 6); //CharacterID
        imageInfo.writeUInt8(5, 8); //Format
        imageInfo.writeUInt16LE(1920, 9); //Width
        imageInfo.writeUInt16LE(1080, 11); //Height
        let buf = Buffer.concat([pre, imageInfo, image, post]);
        buf.writeUInt32LE(buf.length, 4);
        return buf;
    }
    static async imageToBuffer(file, compressed) {
        const readImagePromise = () => {
            return new Promise((resolve, reject) => {
                PNGImage.readImage(file, function (err, image) {
                    if (err)
                        return reject(err);
                    resolve(image);
                });
            });
        };
        let image = await readImagePromise();
        if (!image) {
            throw new Error("Image is undefinded!");
        }
        if (image.getWidth() != 1920 || image.getHeight() != 1080) {
            throw new Error("Wrong dimensions!");
        }
        let byteArray = [];
        let index = 0;
        for (let y = 0; y < 1080; y++) {
            for (let x = 0; x < 1920; x++) {
                let color = {
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
        let buf = new Buffer(byteArray);
        if (compressed) {
            return zlib.deflateSync(buf, options);
        }
        return buf;
    }
    static async createLoadingScreenPackage(packageFile, imageFile, pre, post, optionsRaw) {
        console.log("[createLoadingScreenPackage] Start");
        let options = {
            showTips: true,
            tipsColor: "#FFFFFF"
        };
        if (optionsRaw && optionsRaw.showTips != undefined)
            options.showTips = optionsRaw.showTips;
        if (optionsRaw && optionsRaw.tipsColor != undefined)
            options.tipsColor = optionsRaw.tipsColor;
        console.log("[createLoadingScreenPackage] Options:", options);
        console.log("[createLoadingScreenPackage] Getting GPX buffer...");
        let gfx;
        try {
            gfx = await SimsImageUtil.getGpxBufferLoadingScreen(imageFile, pre, post, false, options);
            console.log("[createLoadingScreenPackage] GPX buffer created, length:", gfx.length);
        }
        catch (err) {
            console.error("[createLoadingScreenPackage] Error creating GPX buffer:", err);
            return;
        }
        console.log("[createLoadingScreenPackage] Creating new Pack...");
        let newPack = new DBPFReader_1.Pack(packageFile);
        console.log("[createLoadingScreenPackage] Creating IndexEnty for main image...");
        let gfxFileEntry = new DBPFReader_1.IndexEnty(packageFile, 0x62ECC59A, 0x0, 0x432D1D2A, 0xDDFFC6D8, 0, gfx.length, gfx.length, 0x0, 0x01);
        gfxFileEntry.setBuffer(gfx);
        newPack.index_List.push(gfxFileEntry);
        console.log("[createLoadingScreenPackage] Creating thumbnail...");
        let thumBuffer;
        try {
            thumBuffer = await SimsImageUtil.createThumbnail(imageFile, "img_loading_cover.png");
            if (thumBuffer) {
                console.log("[createLoadingScreenPackage] Thumbnail created, length:", thumBuffer.length);
                let thumEntry = new DBPFReader_1.IndexEnty(packageFile, 0xAA00AA00, 0x0, 0x0, 0x0, 0, thumBuffer.length, thumBuffer.length, 0x0, 0x01);
                thumEntry.setBuffer(thumBuffer);
                newPack.index_List.push(thumEntry);
            }
            else {
                console.log("[createLoadingScreenPackage] Thumbnail not created.");
            }
        }
        catch (err) {
            console.error("[createLoadingScreenPackage] Error creating thumbnail:", err);
        }
        console.log("[createLoadingScreenPackage] Saving package to file:", packageFile);
        newPack.saveToFile(packageFile);
        console.log("[createLoadingScreenPackage] Done.");
    }
    static async createMainMenuPackage(packageFile, imageFile, pre, post, sideFadeLeft, options, tmpFolder) {
        let inputImage = imageFile;
        /*if(options && options.useBlackSideFade){
            try {
                let overlayImage = await Jimp.read(sideFadeLeft);
                let image = await Jimp.read(imageFile);
                image.composite(overlayImage, 0, 0);
                inputImage = path.join(tmpFolder,"black_side_fade_image.png");
                await image.writeAsync(inputImage);
            } catch (error) {
                console.log(error);
            }
        }*/
        let gfx = await SimsImageUtil.getGpxBufferMainMenu(inputImage, pre, post, false);
        let newPack = new DBPFReader_1.Pack(packageFile);
        //0x6D20AB71641B1539
        //0x6D20AB71 0x641B1539
        let gfxFileEntry = new DBPFReader_1.IndexEnty(packageFile, 0x62ECC59A, 0x0, 0x6D20AB71, 0x641B1539, 0, gfx.length, gfx.length, 0x0, 0x01);
        gfxFileEntry.setBuffer(gfx);
        newPack.index_List.push(gfxFileEntry);
        //Thumbnail
        let thumBuffer = await SimsImageUtil.createThumbnail(imageFile, "img_main_menu_cover.png");
        if (thumBuffer) {
            let thumEntry = new DBPFReader_1.IndexEnty(packageFile, 0xAA00AA00, 0x0, 0x0, 0x0, 0, thumBuffer.length, thumBuffer.length, 0x0, 0x01);
            thumEntry.setBuffer(thumBuffer);
            newPack.index_List.push(thumEntry);
        }
        newPack.saveToFile(packageFile);
    }
}
exports.SimsImageUtil = SimsImageUtil;
