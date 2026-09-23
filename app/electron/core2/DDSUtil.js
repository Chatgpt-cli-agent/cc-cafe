"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DDSConverter = exports.DSTResource = exports.DDSHeader = exports.BinaryWritter = exports.ByteBuffer = void 0;
const buffer_1 = require("buffer"); // Node.js Buffer
const Jimp = require('jimp'); // Assuming Jimp is installed: npm install jimp
// --- Optimized ByteBuffer and BinaryWritter Implementations ---
// These are provided to make the code self-contained and efficient.
// If your original implementations from "../sims/DBPFReader" are already highly optimized
// (e.g., using a single internal buffer and managing pointers), you might keep them.
// However, for general refactoring, these direct Buffer-based versions are usually faster.
class ByteBuffer {
    constructor(buffer) {
        this.buffer = buffer;
        this.pos = 0;
        this.max = buffer.length;
    }
    // Reads a 32-bit unsigned integer (Little Endian) and advances position
    getInt() {
        if (this.pos + 4 > this.max)
            throw new Error("Buffer overflow when reading Int");
        const value = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        return value;
    }
    // Reads a 16-bit unsigned integer (Little Endian) and advances position
    getShort() {
        if (this.pos + 2 > this.max)
            throw new Error("Buffer overflow when reading Short");
        const value = this.buffer.readUInt16LE(this.pos);
        this.pos += 2;
        return value;
    }
    // Reads an 8-bit unsigned integer and advances position
    getByte() {
        if (this.pos + 1 > this.max)
            throw new Error("Buffer overflow when reading Byte");
        const value = this.buffer.readUInt8(this.pos);
        this.pos += 1;
        return value;
    }
    // Returns a slice of the buffer without creating a new Buffer instance
    // for the entire section. Use this carefully; for small, fixed-size reads
    // direct readUIntXLE is better. For larger blocks, slice is fine.
    getSection(length) {
        if (this.pos + length > this.max)
            throw new Error("Buffer overflow when reading section");
        const section = this.buffer.slice(this.pos, this.pos + length);
        this.pos += length;
        return section;
    }
    // Peeks a section without advancing the position
    peekSection(offset, length) {
        if (offset + length > this.max)
            throw new Error("Buffer overflow when peeking section");
        return this.buffer.slice(offset, offset + length);
    }
}
exports.ByteBuffer = ByteBuffer;
class BinaryWritter {
    constructor() {
        this.chunks = [];
        this.totalLength = 0;
    }
    // Writes a 32-bit unsigned integer (Little Endian)
    writeInt(value) {
        const buf = buffer_1.Buffer.allocUnsafe(4);
        buf.writeUInt32LE(value, 0);
        this.chunks.push(buf);
        this.totalLength += 4;
    }
    // Writes a 16-bit unsigned integer (Little Endian)
    writeShort(value) {
        const buf = buffer_1.Buffer.allocUnsafe(2);
        buf.writeUInt16LE(value, 0);
        this.chunks.push(buf);
        this.totalLength += 2;
    }
    // Writes an 8-bit unsigned integer
    writeByte(value) {
        const buf = buffer_1.Buffer.allocUnsafe(1);
        buf.writeUInt8(value, 0);
        this.chunks.push(buf);
        this.totalLength += 1;
    }
    // Appends a Buffer directly
    writeBytes(buffer) {
        this.chunks.push(buffer);
        this.totalLength += buffer.length;
    }
    // Appends `count` zero bytes
    writeEmptyBytes(count) {
        if (count > 0) {
            this.chunks.push(buffer_1.Buffer.alloc(count, 0));
            this.totalLength += count;
        }
    }
    // Concatenates all chunks into a single Buffer
    toBuffer() {
        return buffer_1.Buffer.concat(this.chunks, this.totalLength);
    }
}
exports.BinaryWritter = BinaryWritter;
// --- Original Enums and Classes with Refactored Methods ---
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
        // PixelFormat
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
        const bb = new ByteBuffer(buffer);
        // Read Magic
        const magic = bb.getInt();
        if (magic !== 0x20534444)
            throw new Error("Invalid DDS Header"); // 'DDS '
        this.size = bb.getInt();
        this.flags = bb.getInt();
        this.height = bb.getInt();
        this.width = bb.getInt();
        this.pitchOrLinearSize = bb.getInt();
        this.depth = bb.getInt();
        this.mipMapCount = bb.getInt();
        bb.pos += 44; // Skip reserved1
        // Pixel Format
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
        bb.pos += 12; // Skip reserved2
        this.fourCC = this.pfFourCC;
    }
    unprase() {
        const bw = new BinaryWritter();
        bw.writeInt(0x20534444); // Magic 'DDS '
        bw.writeInt(this.size);
        bw.writeInt(this.flags);
        bw.writeInt(this.height);
        bw.writeInt(this.width);
        bw.writeInt(this.pitchOrLinearSize);
        bw.writeInt(this.depth);
        bw.writeInt(this.mipMapCount);
        bw.writeEmptyBytes(44); // reserved1
        bw.writeInt(this.pfSize);
        bw.writeInt(this.pfFlags);
        bw.writeInt(this.fourCC); // Use this.fourCC directly
        bw.writeInt(this.pfRGBBitCount);
        bw.writeInt(this.pfRBitMask);
        bw.writeInt(this.pfGBitMask);
        bw.writeInt(this.pfBBitMask);
        bw.writeInt(this.pfABitMask);
        bw.writeInt(this.surfaceFlags);
        bw.writeInt(this.cubemapFlags);
        bw.writeEmptyBytes(12); // reserved2
        return bw.toBuffer();
    }
}
exports.DDSHeader = DDSHeader;
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
        const bb = new ByteBuffer(buffer);
        this.header = new DDSHeader();
        this.header.prase(bb.getSection(128)); // Read header section
        if (this.header.fourCC !== FourCC.DST1 &&
            this.header.fourCC !== FourCC.DST3 &&
            this.header.fourCC !== FourCC.DST5) {
            this.isShuffled = false;
        }
        else {
            this.isShuffled = true;
        }
        this.height = this.header.height;
        this.width = this.header.width;
    }
    toDDSBuffer() {
        if (this.buffer === undefined)
            throw new Error("Buffer is empty");
        if (!this.isShuffled) {
            return this.buffer;
        }
        else {
            // Unshuffle
            return this.unshuffle(this.buffer);
        }
    }
    unshuffle(buffer) {
        if (this.header === undefined)
            throw new Error("Header is empty");
        const dataOffset = 128;
        const dataSize = buffer.length - dataOffset;
        // Create a new header for the unshuffled DDS
        const newHeader = new DDSHeader();
        newHeader.prase(buffer.slice(0, dataOffset)); // Parse original header to copy properties
        // Pre-allocate the output buffer for the entire DDS file
        const outputBuffer = buffer_1.Buffer.alloc(dataOffset + dataSize);
        newHeader.unprase().copy(outputBuffer, 0); // Write the new header to the output buffer
        // Get a view of the data section of the original buffer
        const sourceData = buffer.slice(dataOffset);
        if (this.header.fourCC === FourCC.DST1) {
            newHeader.fourCC = FourCC.DXT1;
            newHeader.unprase().copy(outputBuffer, 0); // Overwrite header with DXT1
            const halfDataSize = dataSize >> 1; // dataSize / 2
            const count = halfDataSize / 4; // Number of 8-byte blocks (4 bytes from blockOffset2, 4 from blockOffset3)
            let outputOffset = dataOffset;
            for (let i = 0; i < count; i++) {
                // Read 4 bytes from blockOffset2 and write to output
                sourceData.copy(outputBuffer, outputOffset, i * 4, (i * 4) + 4);
                outputOffset += 4;
                // Read 4 bytes from blockOffset3 and write to output
                sourceData.copy(outputBuffer, outputOffset, halfDataSize + (i * 4), halfDataSize + (i * 4) + 4);
                outputOffset += 4;
            }
        }
        else if (this.header.fourCC === FourCC.DST3) {
            newHeader.fourCC = FourCC.DXT3;
            newHeader.unprase().copy(outputBuffer, 0); // Overwrite header with DXT3
            // Implement DST3 unshuffling here if needed, similar to DST5 or DST1
            throw new Error("DST3 unshuffling not implemented yet");
        }
        else if (this.header.fourCC === FourCC.DST5) {
            newHeader.fourCC = FourCC.DXT5;
            newHeader.unprase().copy(outputBuffer, 0); // Overwrite header with DXT5
            const blockOffset0End = dataSize >> 3; // dataSize / 8 (alpha 0-1)
            const blockOffset2End = blockOffset0End + (dataSize >> 2); // dataSize / 4 (alpha map)
            const blockOffset1End = blockOffset2End + (6 * dataSize >> 4); // 6 * dataSize / 16 (color 0-1)
            // blockOffset3End is dataSize (color map)
            const count = blockOffset0End / 2; // Number of 16-byte blocks (2+6+4+4)
            let currentSrcOffset0 = 0;
            let currentSrcOffset1 = blockOffset2End; // Starts after alpha map
            let currentSrcOffset2 = blockOffset0End; // Starts after alpha 0-1
            let currentSrcOffset3 = blockOffset1End; // Starts after color 0-1
            let outputOffset = dataOffset;
            for (let i = 0; i < count; i++) {
                // Write Alpha 0-1 (2 bytes)
                sourceData.copy(outputBuffer, outputOffset, currentSrcOffset0, currentSrcOffset0 + 2);
                outputOffset += 2;
                currentSrcOffset0 += 2;
                // Write Alpha Map (6 bytes)
                sourceData.copy(outputBuffer, outputOffset, currentSrcOffset1, currentSrcOffset1 + 6);
                outputOffset += 6;
                currentSrcOffset1 += 6;
                // Write Color 0-1 (4 bytes)
                sourceData.copy(outputBuffer, outputOffset, currentSrcOffset2, currentSrcOffset2 + 4);
                outputOffset += 4;
                currentSrcOffset2 += 4;
                // Write Color Map (4 bytes)
                sourceData.copy(outputBuffer, outputOffset, currentSrcOffset3, currentSrcOffset3 + 4);
                outputOffset += 4;
                currentSrcOffset3 += 4;
            }
        }
        else {
            throw new Error("Invalid FourCC for unshuffling");
        }
        return outputBuffer;
    }
}
exports.DSTResource = DSTResource;
class DDSConverter {
    static async pngBufferToDdsBuffer(buffer) {
        const image = await Jimp.read(buffer);
        const width = image.getWidth();
        const height = image.getHeight();
        // Pre-calculate the size of the DDS data section
        // Each 4x4 block is 16 bytes for DXT5 (8 bytes alpha + 8 bytes color)
        const dataSize = (width / 4) * (height / 4) * 16;
        const headerSize = 128;
        const outputBuffer = buffer_1.Buffer.alloc(headerSize + dataSize);
        let outputOffset = headerSize;
        // Create Header directly in the buffer
        outputBuffer.writeUInt32LE(0x20534444, 0); // Magic 'DDS '
        outputBuffer.writeUInt32LE(0x7C, 4); // Size of header
        outputBuffer.writeUInt32LE(0x81007, 8); // Flags (DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PITCH | DDSD_PIXELFORMAT | DDSD_LINEARSIZE | DDSD_MIPMAPCOUNT)
        outputBuffer.writeUInt32LE(height, 12);
        outputBuffer.writeUInt32LE(width, 16);
        outputBuffer.writeUInt32LE(dataSize, 20); // pitchOrLinearSize (linear size for compressed textures)
        outputBuffer.writeUInt32LE(0x0, 24); // Depth
        outputBuffer.writeUInt32LE(0x1, 28); // MipMapCount (1 for base image)
        // Skip 44 reserved bytes (bytes 32-75)
        outputBuffer.writeUInt32LE(0x20, 76); // PixelFormat size
        outputBuffer.writeUInt32LE(0x4, 80); // PixelFormat flags (DDPF_FOURCC)
        outputBuffer.writeUInt32LE(FourCC.DXT5, 84); // FourCC 'DXT5'
        // Skip 20 empty bytes (RGBBitCount, RBitMask, GBitMask, BBitMask, ABitMask)
        outputBuffer.writeUInt32LE(0x1000, 108); // SurfaceFlags (DDSCAPS_TEXTURE)
        // Skip 16 empty bytes (CubemapFlags, reserved2)
        // Direct access to Jimp's pixel data
        const imageData = image.bitmap.data; // This is a Uint8Array (R, G, B, A, R, G, B, A, ...)
        for (let y = 0; y < height; y += 4) {
            for (let x = 0; x < width; x += 4) {
                const colors = [];
                for (let u = 0; u < 4; u++) {
                    for (let v = 0; v < 4; v++) {
                        const pixelX = x + v;
                        const pixelY = y + u;
                        // Ensure we don't read out of bounds for non-multiple-of-4 dimensions
                        if (pixelX < width && pixelY < height) {
                            const pixelIndex = (pixelY * width + pixelX) * 4;
                            colors.push({
                                r: imageData[pixelIndex],
                                g: imageData[pixelIndex + 1],
                                b: imageData[pixelIndex + 2],
                                a: imageData[pixelIndex + 3]
                            });
                        }
                        else {
                            // Pad with transparent black if out of bounds (common for DXT)
                            colors.push({ r: 0, g: 0, b: 0, a: 0 });
                        }
                    }
                }
                // DXT5 Alpha Encoding (simplified for now, your original code didn't implement it fully)
                // For a proper DXT5 encoder, you'd need to find a0, a1, and aMap based on alpha values.
                // For simplicity, using dummy values as in your original code.
                const a0 = 0xFF; // Placeholder
                const a1 = 0x00; // Placeholder
                const aMapLo = 0x0000; // Placeholder
                const aMapHi = 0x0000; // Placeholder
                // Write Alpha block (8 bytes)
                outputBuffer.writeUInt8(a0, outputOffset);
                outputOffset += 1;
                outputBuffer.writeUInt8(a1, outputOffset);
                outputOffset += 1;
                outputBuffer.writeUInt16LE(aMapLo, outputOffset);
                outputOffset += 2; // Low 16 bits of alpha map
                outputBuffer.writeUInt32LE(aMapHi, outputOffset);
                outputOffset += 4; // High 32 bits of alpha map (total 48 bits, or 6 bytes)
                // Note: aMap is 6 bytes, not 4. Your original code wrote 0x0 and 0x0.
                // A correct DXT5 alpha map would involve 2 bytes for aMapLo and 4 bytes for aMapHi,
                // representing 16 3-bit alpha indices.
                const { c0, c1 } = this.pca(colors);
                const dxt5c0 = this.rgbToDXT5Color(c0);
                const dxt5c1 = this.rgbToDXT5Color(c1);
                const palette = this.createPalette(c0, c1);
                let cMap = 0;
                // Calculate cMap using bitwise operations for speed
                for (let i = 0; i < 16; i++) {
                    const colorIndex = this.findBestColorIndex(colors[i], palette);
                    cMap |= (colorIndex << (i * 2)); // Shift 2 bits for each index
                }
                // Write Color block (8 bytes)
                outputBuffer.writeUInt16LE(dxt5c0, outputOffset);
                outputOffset += 2;
                outputBuffer.writeUInt16LE(dxt5c1, outputOffset);
                outputOffset += 2;
                outputBuffer.writeUInt32LE(cMap, outputOffset);
                outputOffset += 4;
            }
        }
        return outputBuffer;
    }
    // Original helper functions (mostly unchanged, as they are mathematically correct)
    static getAllColors(x, y, image) {
        let colors = [];
        for (let u = 0; u < 4; u++) {
            for (let v = 0; v < 4; v++) {
                // Direct pixel access from Jimp's bitmap data for performance
                const pixelIndex = ((y + u) * image.bitmap.width + (x + v)) * 4;
                colors.push({
                    r: image.bitmap.data[pixelIndex],
                    g: image.bitmap.data[pixelIndex + 1],
                    b: image.bitmap.data[pixelIndex + 2],
                    a: image.bitmap.data[pixelIndex + 3]
                });
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
        let principalComponent = { r: 0, g: 0, b: 0 };
        // Find the component with the maximum variance
        // This is a simplified PCA, essentially finding the dominant color axis.
        if (cov.rr >= cov.gg && cov.rr >= cov.bb) {
            principalComponent.r = 1;
        }
        else if (cov.gg >= cov.rr && cov.gg >= cov.bb) {
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
        // Ensure minColor and maxColor are not null (handle empty pixels array, though unlikely for 4x4)
        if (!minColor || !maxColor) {
            // Fallback for edge cases, e.g., if pixels array is empty
            return { c0: { r: 0, g: 0, b: 0 }, c1: { r: 0, g: 0, b: 0 } };
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
        // DXT5 color interpolation (4-color palette)
        // c0, c1, (2c0 + c1)/3, (c0 + 2c1)/3
        const color2 = this.interpolateColor(c0, c1, 1 / 3); // (2*c0 + 1*c1) / 3
        const color3 = this.interpolateColor(c0, c1, 2 / 3); // (1*c0 + 2*c1) / 3
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
        return Math.sqrt(Math.pow(color1.r - color2.r, 2) +
            Math.pow(color1.g - color2.g, 2) +
            Math.pow(color1.b - color2.b, 2));
    }
    static async ddsBufferToPngBuffer(buffer) {
        const bb = new ByteBuffer(buffer);
        const header = new DDSHeader();
        header.prase(bb.peekSection(0, 128)); // Peek header without advancing global buffer pos
        const fourCC = header.fourCC;
        if (fourCC === FourCC.DXT1) {
            return await this.ddsBufferToPngBufferDXT1(buffer);
        }
        else if (fourCC === FourCC.DXT5) {
            return await this.ddsBufferToPngBufferDXT5(buffer);
        }
        throw new Error("Unsupported DDS format");
    }
    static async ddsBufferToPngBufferDXT5(buffer) {
        const headerSize = 128;
        const width = buffer.readUInt32LE(16);
        const height = buffer.readUInt32LE(12);
        const mipMapCount = buffer.readUInt32LE(28); // Not used beyond 0 for simplicity
        const image = new Jimp(width, height, (err) => {
            if (err)
                console.error("Error creating Jimp image:", err);
        });
        // Direct access to Jimp's pixel data for faster writing
        const imageData = image.bitmap.data; // This is a Uint8Array (R, G, B, A, R, G, B, A, ...)
        let offset = headerSize;
        // Only process the first mipmap level (mip = 0) as per original code
        const mipWidth = width;
        const mipHeight = height;
        for (let y = 0; y < mipHeight; y += 4) {
            for (let x = 0; x < mipWidth; x += 4) {
                // Read DXT5 block data
                const a0 = buffer.readUInt8(offset);
                const a1 = buffer.readUInt8(offset + 1);
                // aMap is 6 bytes (48 bits)
                const aMapLow = buffer.readUInt16LE(offset + 2); // First 2 bytes
                const aMapMid = buffer.readUInt16LE(offset + 4); // Next 2 bytes
                const aMapHigh = buffer.readUInt16LE(offset + 6); // Last 2 bytes
                const c0 = buffer.readUInt16LE(offset + 8);
                const c1 = buffer.readUInt16LE(offset + 10);
                const cMap = buffer.readUInt32LE(offset + 12);
                offset += 16; // Each DXT5 block is 16 bytes
                const colors = this.createPalette(this.dxt5ColorToRGB(c0), this.dxt5ColorToRGB(c1));
                for (let i = 0; i < 16; i++) {
                    const colorIndex = (cMap >> (i * 2)) & 0x03; // Extract 2-bit color index
                    const color = colors[colorIndex];
                    // Reconstruct the 48-bit alpha map from three 16-bit parts
                    const fullAMap = BigInt(aMapHigh) << BigInt(32) | BigInt(aMapMid) << BigInt(16) | BigInt(aMapLow);
                    const alphaIndex = Number((fullAMap >> BigInt(i * 3)) & BigInt(0x07)); // Extract 3-bit alpha index
                    const alpha = this.getAlpha(a0, a1, alphaIndex);
                    const px = x + (i % 4);
                    const py = y + Math.floor(i / 4);
                    if (px < width && py < height) {
                        const pixelDataIndex = (py * width + px) * 4;
                        imageData[pixelDataIndex] = color.r;
                        imageData[pixelDataIndex + 1] = color.g;
                        imageData[pixelDataIndex + 2] = color.b;
                        imageData[pixelDataIndex + 3] = alpha;
                    }
                }
            }
        }
        return await image.getBufferAsync(Jimp.MIME_PNG);
    }
    static dxt5ColorToRGB(color) {
        const r = Math.round(((color >> 11) & 0x1F) * 255 / 31);
        const g = Math.round(((color >> 5) & 0x3F) * 255 / 63);
        const b = Math.round((color & 0x1F) * 255 / 31);
        return { r, g, b };
    }
    static getAlpha(a0, a1, alphaIndex) {
        // DXT5 alpha interpolation
        if (a0 > a1) {
            switch (alphaIndex) {
                case 0: return a0;
                case 1: return a1;
                case 2: return Math.round((6 * a0 + 1 * a1) / 7);
                case 3: return Math.round((5 * a0 + 2 * a1) / 7);
                case 4: return Math.round((4 * a0 + 3 * a1) / 7);
                case 5: return Math.round((3 * a0 + 4 * a1) / 7);
                case 6: return Math.round((2 * a0 + 5 * a1) / 7);
                case 7: return Math.round((1 * a0 + 6 * a1) / 7);
                default: return 0; // Should not happen
            }
        }
        else { // a0 <= a1
            switch (alphaIndex) {
                case 0: return a0;
                case 1: return a1;
                case 2: return Math.round((4 * a0 + 1 * a1) / 5);
                case 3: return Math.round((3 * a0 + 2 * a1) / 5);
                case 4: return Math.round((2 * a0 + 3 * a1) / 5);
                case 5: return Math.round((1 * a0 + 4 * a1) / 5);
                case 6: return 0; // Transparent
                case 7: return 255; // Opaque
                default: return 0; // Should not happen
            }
        }
    }
    static async ddsBufferToPngBufferDXT1(buffer) {
        const headerSize = 128;
        const width = buffer.readUInt32LE(16);
        const height = buffer.readUInt32LE(12);
        const mipMapCount = buffer.readUInt32LE(28); // Not used beyond 0 for simplicity
        const image = new Jimp(width, height, (err) => {
            if (err)
                console.error("Error creating Jimp image:", err);
        });
        const imageData = image.bitmap.data; // Direct access to Jimp's pixel data
        let offset = headerSize;
        // Only process the first mipmap level (mip = 0) as per original code
        const mipWidth = width;
        const mipHeight = height;
        for (let y = 0; y < mipHeight; y += 4) {
            for (let x = 0; x < mipWidth; x += 4) {
                const c0 = buffer.readUInt16LE(offset);
                const c1 = buffer.readUInt16LE(offset + 2);
                const cMap = buffer.readUInt32LE(offset + 4);
                offset += 8; // Each DXT1 block is 8 bytes
                const colors = this.createPaletteDXT1(this.dxt1ColorToRGB(c0), this.dxt1ColorToRGB(c1));
                for (let i = 0; i < 16; i++) {
                    const colorIndex = (cMap >> (i * 2)) & 0x03; // Extract 2-bit color index
                    const color = colors[colorIndex];
                    const rgba = { r: color.r, g: color.g, b: color.b, a: 255 }; // DXT1 has no alpha channel, assume opaque
                    const px = x + (i % 4);
                    const py = y + Math.floor(i / 4);
                    if (px < width && py < height) {
                        const pixelDataIndex = (py * width + px) * 4;
                        imageData[pixelDataIndex] = rgba.r;
                        imageData[pixelDataIndex + 1] = rgba.g;
                        imageData[pixelDataIndex + 2] = rgba.b;
                        imageData[pixelDataIndex + 3] = rgba.a;
                    }
                }
            }
        }
        return await image.getBufferAsync(Jimp.MIME_PNG);
    }
    static dxt1ColorToRGB(color) {
        const r = Math.round(((color >> 11) & 0x1F) * 255 / 31);
        const g = Math.round(((color >> 5) & 0x3F) * 255 / 63);
        const b = Math.round((color & 0x1F) * 255 / 31);
        return { r, g, b };
    }
    static createPaletteDXT1(c0, c1) {
        const palette = [c0, c1];
        // DXT1 has two modes for its 4-color palette
        // If color0 > color1 (as 16-bit values), then 4 colors are interpolated.
        // Otherwise, 3 colors are interpolated, and the 4th is transparent black.
        // The comparison `isColor0Greater` is typically done on the 16-bit color values themselves.
        const c0Val = ((c0.r & 0xF8) << 8) | ((c0.g & 0xFC) << 3) | (c0.b >> 3);
        const c1Val = ((c1.r & 0xF8) << 8) | ((c1.g & 0xFC) << 3) | (c1.b >> 3);
        if (c0Val > c1Val) {
            palette.push(this.interpolateColor(c0, c1, 1 / 3)); // (2*c0 + 1*c1) / 3
            palette.push(this.interpolateColor(c0, c1, 2 / 3)); // (1*c0 + 2*c1) / 3
        }
        else {
            palette.push(this.interpolateColor(c0, c1, 1 / 2)); // (c0 + c1) / 2
            palette.push({ r: 0, g: 0, b: 0 }); // Transparent black (alpha is implicitly 0 for this index)
        }
        return palette;
    }
    // This helper was not used in your original DXT1 palette creation, but is standard for DXT1.
    // private static isColor0Greater(c0: { r: number; g: number; b: number }, c1: { r: number; g: number; b: number }) {
    //     // Compare the 16-bit values of c0 and c1
    //     const c0Value = ((c0.r & 0xF8) << 8) | ((c0.g & 0xFC) << 3) | (c0.b >> 3);
    //     const c1Value = ((c1.r & 0xF8) << 8) | ((c1.g & 0xFC) << 3) | (c1.b >> 3);
    //     return c0Value > c1Value;
    // }
    static interpolateColor(c0, c1, factor) {
        return {
            r: Math.round(c0.r * (1 - factor) + c1.r * factor),
            g: Math.round(c0.g * (1 - factor) + c1.g * factor),
            b: Math.round(c0.b * (1 - factor) + c1.b * factor),
        };
    }
}
exports.DDSConverter = DDSConverter;
