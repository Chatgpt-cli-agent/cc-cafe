"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DdsToPng = void 0;
var fs = require('fs');
var _dbpf = require('./DBPFReader.js');
var parse = require('parse-dds');
var toArrayBuffer = require('buffer-to-arraybuffer');
var PNGImage = require('@nodebug/pngjs-image');
var DdsToPng = /** @class */ (function () {
    function DdsToPng(ddsBuffer) {
        this.hight = 2048;
        this.width = 1024;
        this.type = "";
        this.offset = 128;
        this.pixelCount = 0;
        this.ddsBuffer = ddsBuffer;
        var dds = parse(toArrayBuffer(ddsBuffer));
        var image = dds.images[0];
        this.type = dds.format;
        this.hight = image.shape[1];
        this.width = image.shape[0];
        this.offset = image.offset;
        this.pixelCount = image.length;
    }
    DdsToPng.prototype.saveImage = function (imagePath, colorHex) {
        var image = PNGImage.createImage(this.width, this.hight);
        var buffer = new _dbpf.ByteBuffer(this.ddsBuffer);
        buffer.pos = this.offset;
        var steps = this.pixelCount / 16;
        var xOffset = 0;
        var yOffset = 0;
        for (var index = 0; index < steps; index++) {
            //Alpha
            var a0 = buffer.getByte();
            var a1 = buffer.getByte();
            var aMap2 = buffer.getShort().toString(2).padStart(16, "0");
            var aMap4 = buffer.getInt().toString(2).padStart(32, "0");
            var aMap = aMap4 + aMap2;
            var alphaArr = this.alphaArray(a0, a1);
            //Color
            var c0 = buffer.getShort();
            var c1 = buffer.getShort();
            var cMap = buffer.getInt().toString(2).padStart(32, "0");
            var colorArr = this.colorArray(c0, c1);
            //SetPixels
            var currentPos = 0;
            for (var y = 0; y < 4; y++) {
                for (var x = 0; x < 4; x++) {
                    var colorPos = parseInt(cMap.substring((2 * currentPos), (2 * currentPos) + 2), 2);
                    var alphaPos = parseInt(aMap.substring((3 * currentPos), (3 * currentPos) + 3), 2);
                    var alpha = alphaArr[alphaPos];
                    var color = colorArr[colorPos];
                    var absolutX = xOffset + (4 - x);
                    var absolutY = yOffset + (4 - y);
                    if (colorHex != undefined) {
                        var nc = this.addHexColorBase(color, colorHex, alpha);
                        image.setAt(absolutX, absolutY, { red: nc.r, green: nc.g, blue: nc.b, alpha: 255 });
                    }
                    else {
                        image.setAt(absolutX, absolutY, { red: color.r, green: color.g, blue: color.b, alpha: alpha });
                    }
                    currentPos++;
                }
            }
            xOffset += 4;
            if (xOffset >= this.width) {
                xOffset = 0;
                yOffset += 4;
            }
        }
        /*image.writeImage(imagePath, function (err:any) {
            if (err) { console.log(err); throw err;}
            console.log("Saved file: "+imagePath);
        });*/
        try {
            image.writeImageSync(imagePath);
        }
        catch (error) {
            console.log(error);
        }
        var created = fs.existsSync(imagePath);
        if (created) {
            return imagePath;
        }
        else {
            return undefined;
        }
    };
    DdsToPng.prototype.addHexColorBase = function (color, colorBase, alphaPure) {
        var r = parseInt(colorBase.substring(0, 2), 16);
        var g = parseInt(colorBase.substring(2, 4), 16);
        var b = parseInt(colorBase.substring(4, 6), 16);
        var rgb = {
            r: r,
            g: g,
            b: b
        };
        var alpha = alphaPure / 255;
        if (alpha == 0) {
            return rgb;
        } //Is Only Base
        //Mix colors
        var base = [69, 109, 160, 1];
        var added = [61, 47, 82, 0.8];
        var mix = [];
        var ratio = 1; // alpha
        rgb.r = Math.round((color.r * alpha / ratio) + (r * 1 * (1 - alpha) / ratio)); // red
        rgb.g = Math.round((color.g * alpha / ratio) + (g * 1 * (1 - alpha) / ratio)); // green
        rgb.b = Math.round((color.b * alpha / ratio) + (b * 1 * (1 - alpha) / ratio)); // blue
        return rgb;
    };
    DdsToPng.prototype.colorArray = function (c0, c1) {
        var arr = [];
        arr.push(this.colorToRGB(c0));
        arr.push(this.colorToRGB(c1));
        if (c0 > c1) {
            arr.push(this.mixColors(c0, c1, (2 / 3), (1 / 3)));
            arr.push(this.mixColors(c0, c1, (1 / 3), (2 / 3)));
        }
        else {
            arr.push(this.mixColors(c0, c1, (1 / 2), (1 / 2)));
            arr.push(this.colorToRGB(0));
        }
        return arr;
    };
    DdsToPng.prototype.mixColors = function (c0, c1, cv1, cv2) {
        var color0 = this.colorToRGB(c0);
        var color1 = this.colorToRGB(c1);
        var r = Math.floor((cv1 * color0.r) + (cv2 * color1.r));
        var g = Math.floor((cv1 * color0.g) + (cv2 * color1.g));
        var b = Math.floor((cv1 * color0.b) + (cv2 * color1.b));
        var colorObj = {
            r: r,
            g: g,
            b: b
        };
        return colorObj;
    };
    DdsToPng.prototype.colorToRGB = function (color) {
        var scale = function (fromRange, toRange, value) {
            var d = (toRange[1] - toRange[0]) / (fromRange[1] - fromRange[0]);
            return Math.floor((value - fromRange[0]) * d + toRange[0]);
        };
        var colorBin = color.toString(2).padStart(16, "0");
        var r_32 = parseInt(colorBin.substring(0, 5), 2);
        var g_64 = parseInt(colorBin.substring(5, 11), 2);
        var b_32 = parseInt(colorBin.substring(11, 16), 2);
        var colorObj = {
            r: scale([0, 31], [0, 255], r_32),
            g: scale([0, 63], [0, 255], g_64),
            b: scale([0, 31], [0, 255], b_32)
        };
        return colorObj;
    };
    DdsToPng.prototype.alphaArray = function (a0, a1) {
        var arr = [];
        var a2, a3, a4, a5, a6, a7;
        if (a0 > a1) {
            a2 = Math.floor(((6 * a0) + (1 * a1)) / 7);
            a3 = Math.floor(((5 * a0) + (2 * a1)) / 7);
            a4 = Math.floor(((4 * a0) + (3 * a1)) / 7);
            a5 = Math.floor(((3 * a0) + (4 * a1)) / 7);
            a6 = Math.floor(((2 * a0) + (5 * a1)) / 7);
            a7 = Math.floor(((1 * a0) + (6 * a1)) / 7);
        }
        else {
            a2 = Math.floor(((4 * a0) + (1 * a1)) / 5);
            a3 = Math.floor(((3 * a0) + (2 * a1)) / 5);
            a4 = Math.floor(((2 * a0) + (3 * a1)) / 5);
            a5 = Math.floor(((1 * a0) + (4 * a1)) / 5);
            a6 = 0;
            a7 = 255;
        }
        arr.push(a0);
        arr.push(a1);
        arr.push(a2);
        arr.push(a3);
        arr.push(a4);
        arr.push(a5);
        arr.push(a6);
        arr.push(a7);
        return arr;
    };
    return DdsToPng;
}());
exports.DdsToPng = DdsToPng;
