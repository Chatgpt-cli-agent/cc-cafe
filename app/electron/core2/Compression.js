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
exports.Compression = void 0;
const zlib = __importStar(require("zlib"));
/**
 * Port of s4pi Compression utility to TypeScript
 */
class Compression {
    /**
     * Uncompresses a buffer using either Zlib or RefPack (EA's format)
     */
    static uncompress(buffer, memsize) {
        if (memsize < 2)
            return Buffer.alloc(0);
        const header0 = buffer[0];
        const header1 = buffer[1];
        // 0x78 is the standard Zlib header (DEFLATE)
        if (header0 === 0x78) {
            return zlib.inflateSync(buffer);
        }
        // 0xFB in the second byte indicates EA's RefPack
        else if (header1 === 0xFB) {
            return this.oldDecompress(buffer);
        }
        else {
            throw new Error(`Unrecognized compression format, header: 0x${header0.toString(16)}${header1.toString(16)}`);
        }
    }
    /**
     * Compresses a buffer using Zlib (DEFLATE)
     */
    static compress(buffer) {
        if (buffer.length === 0)
            return Buffer.alloc(0);
        // The C# code uses DeflaterOutputStream which defaults to Zlib
        return zlib.deflateSync(buffer);
    }
    /**
     * Implementation of EA's RefPack decompression logic
     */
    static oldDecompress(compressed) {
        let offset = 0;
        const compressionType = compressed[offset++];
        const isNot80 = compressionType !== 0x80;
        // Read the uncompressed size from the header
        const sizeArray = Buffer.alloc(4);
        const startLoop = isNot80 ? 2 : 3;
        for (let i = startLoop; i >= 0; i--) {
            sizeArray[i] = compressed[offset++];
        }
        const decompressedSize = sizeArray.readInt32LE(0);
        const outData = Buffer.alloc(decompressedSize);
        let outPos = 0;
        while (outPos < decompressedSize && offset < compressed.length) {
            const byte0 = compressed[offset++];
            if (byte0 <= 0x7F) {
                const byte1 = compressed[offset++];
                const numPlainText = byte0 & 0x03;
                const numToCopy = ((byte0 & 0x1C) >> 2) + 3;
                const copyOffset = ((byte0 & 0x60) << 3) + byte1 + 1;
                outPos = this.copyPlainText(compressed, outData, numPlainText, offset, outPos);
                offset += numPlainText;
                outPos = this.copyCompressedText(outData, numToCopy, outPos, copyOffset);
            }
            else if (byte0 <= 0xBF) {
                const byte1 = compressed[offset++];
                const byte2 = compressed[offset++];
                const numPlainText = (byte1 >> 6) & 0x03;
                const numToCopy = (byte0 & 0x3F) + 4;
                const copyOffset = ((byte1 & 0x3F) << 8) + byte2 + 1;
                outPos = this.copyPlainText(compressed, outData, numPlainText, offset, outPos);
                offset += numPlainText;
                outPos = this.copyCompressedText(outData, numToCopy, outPos, copyOffset);
            }
            else if (byte0 <= 0xDF) {
                const byte1 = compressed[offset++];
                const byte2 = compressed[offset++];
                const byte3 = compressed[offset++];
                const numPlainText = byte0 & 0x03;
                const numToCopy = ((byte0 & 0x0C) << 6) + byte3 + 5;
                const copyOffset = ((byte0 & 0x10) << 12) + (byte1 << 8) + byte2 + 1;
                outPos = this.copyPlainText(compressed, outData, numPlainText, offset, outPos);
                offset += numPlainText;
                outPos = this.copyCompressedText(outData, numToCopy, outPos, copyOffset);
            }
            else if (byte0 <= 0xFB) {
                const numPlainText = ((byte0 & 0x1F) << 2) + 4;
                outPos = this.copyPlainText(compressed, outData, numPlainText, offset, outPos);
                offset += numPlainText;
            }
            else {
                const numPlainText = byte0 & 0x03;
                outPos = this.copyPlainText(compressed, outData, numPlainText, offset, outPos);
                offset += numPlainText;
            }
        }
        return outData;
    }
    static copyPlainText(src, dest, count, srcOffset, destOffset) {
        for (let i = 0; i < count; i++) {
            dest[destOffset++] = src[srcOffset++];
        }
        return destOffset;
    }
    static copyCompressedText(dest, count, destOffset, copyOffset) {
        const startIdx = destOffset - copyOffset;
        for (let i = 0; i < count; i++) {
            dest[destOffset++] = dest[startIdx + i];
        }
        return destOffset;
    }
}
exports.Compression = Compression;
