"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImageBufferWithOptions = exports.processImageBuffer = void 0;
const sharp_1 = __importDefault(require("sharp"));
const targetWidth = 104;
const targetHeight = 148;
const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
];
const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1]
];
/**
 * Processes an image buffer by resizing, grayscaling, normalizing, applying an edge detection filter,
 * and then cropping the bottom part.
 * @param bufferIn The input image buffer.
 * @returns A Promise that resolves to the processed image buffer in JPEG format, or undefined if an error occurs.
 */
async function processImageBuffer(bufferIn) {
    try {
        const { data, info } = await (0, sharp_1.default)(bufferIn)
            .resize(targetWidth, targetHeight, {
            fit: 'cover'
        })
            .grayscale()
            .raw()
            .toBuffer({ resolveWithObject: true });
        const width = info.width;
        const height = info.height;
        let processedData = new Uint8Array(data); // Use a mutable copy for modifications
        // Add black square to the top-left corner
        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x++) {
                const idx = (info.width * y + x) * info.channels;
                processedData[idx] = 0; // Red
                processedData[idx + 1] = 0; // Green
                processedData[idx + 2] = 0; // Blue
                if (info.channels === 4) {
                    processedData[idx + 3] = 255; // Alpha
                }
            }
        }
        // Normalize pixel values
        const min = Math.min(...processedData);
        const max = Math.max(...processedData);
        const normalizedData = new Uint8Array(processedData.map(value => ((value - min) / (max - min)) * 255));
        // Apply Sobel edge detection
        const edgeData = new Uint8Array(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0;
                let gy = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixel = normalizedData[(y + ky) * width + (x + kx)];
                        gx += pixel * sobelX[ky + 1][kx + 1];
                        gy += pixel * sobelY[ky + 1][kx + 1];
                    }
                }
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edgeData[y * width + x] = magnitude > 255 ? 255 : magnitude;
            }
        }
        // Crop the bottom part and convert to JPEG
        return await (0, sharp_1.default)(Buffer.from(edgeData), {
            raw: {
                width: width,
                height: height,
                channels: 1 // Grayscale output from edge detection
            }
        })
            .extract({ left: 0, top: 0, width: width, height: height - 27 })
            .jpeg()
            .toBuffer();
    }
    catch (err) {
        console.error('Error processing image:', err);
    }
    return undefined;
}
exports.processImageBuffer = processImageBuffer;
/**
 * Processes an image buffer with configurable options.
 * @param bufferIn The input image buffer.
 * @param options An object containing processing options.
 * @returns A Promise that resolves to the processed image buffer in JPEG format, or undefined if an error occurs.
 */
async function processImageBufferWithOptions(bufferIn, options = {}) {
    let { grayscale = false, addBlack = true, normalize = true, edgeDetection = false, removeBottom = true } = options;
    if (edgeDetection)
        grayscale = true;
    try {
        let sharpInstance = (0, sharp_1.default)(bufferIn)
            .resize(targetWidth, targetHeight, {
            fit: 'cover'
        });
        if (grayscale) {
            sharpInstance = sharpInstance.grayscale();
        }
        const { data, info } = await sharpInstance.raw().toBuffer({ resolveWithObject: true });
        const width = info.width;
        const height = info.height;
        let processedData = new Uint8Array(data);
        if (addBlack) {
            for (let y = 0; y < 32; y++) {
                for (let x = 0; x < 32; x++) {
                    const idx = (info.width * y + x) * info.channels;
                    processedData[idx] = 0;
                    processedData[idx + 1] = 0;
                    processedData[idx + 2] = 0;
                    if (info.channels === 4) {
                        processedData[idx + 3] = 255;
                    }
                }
            }
        }
        if (normalize) {
            const min = Math.min(...processedData);
            const max = Math.max(...processedData);
            processedData = new Uint8Array(processedData.map(value => ((value - min) / (max - min)) * 255));
        }
        if (edgeDetection) {
            const edgeData = new Uint8Array(width * height);
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let gx = 0;
                    let gy = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixel = processedData[(y + ky) * width + (x + kx)];
                            gx += pixel * sobelX[ky + 1][kx + 1];
                            gy += pixel * sobelY[ky + 1][kx + 1];
                        }
                    }
                    const magnitude = Math.sqrt(gx * gx + gy * gy);
                    edgeData[y * width + x] = magnitude > 255 ? 255 : magnitude;
                }
            }
            processedData = edgeData;
        }
        let outputSharpInstance = (0, sharp_1.default)(Buffer.from(processedData), {
            raw: {
                width: width,
                height: height,
                channels: edgeDetection ? 1 : info.channels
            }
        });
        if (removeBottom) {
            outputSharpInstance = outputSharpInstance.extract({ left: 0, top: 0, width: width, height: height - 27 });
        }
        return await outputSharpInstance.jpeg().toBuffer();
    }
    catch (err) {
        console.error('Error processing image:', err);
    }
    return undefined;
}
exports.processImageBufferWithOptions = processImageBufferWithOptions;
