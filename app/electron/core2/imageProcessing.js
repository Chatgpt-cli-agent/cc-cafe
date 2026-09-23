"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessing = void 0;
const sharp_1 = __importDefault(require("sharp"));
class ImageProcessing {
    /**
     * Resize an image to the specified width and height.
     * @param {Buffer} buffer - The image buffer to resize.
     * @param {number} width - The desired width of the resized image.
     * @param {number} height - The desired height of the resized image.
     * @returns {Promise<Buffer>} - A promise that resolves to the resized image buffer.
     */
    static async cropImage(buffer, options) {
        try {
            const image = (0, sharp_1.default)(buffer);
            const metadata = await image.metadata();
            let { x, y, width, height } = options;
            x = Math.floor(x);
            y = Math.floor(y);
            if (x < 0)
                x = 0;
            if (y < 0)
                y = 0;
            if (metadata.width !== undefined && x + width > metadata.width) {
                width = metadata.width - x;
            }
            if (metadata.height !== undefined && y + height > metadata.height) {
                height = metadata.height - y;
            }
            const croppedImage = await image
                .extract({ left: x, top: y, width, height })
                .toBuffer();
            return croppedImage;
        }
        catch (error) {
            throw new Error(`Error cropping image: ${error.message}`);
        }
    }
    static async resizeImageToBuffer(imagepath, width, height) {
        try {
            const image = (0, sharp_1.default)(imagepath);
            const resizedImage = await image.resize(width, height).toBuffer();
            return resizedImage;
        }
        catch (error) {
            throw new Error(`Error resizing image: ${error.message}`);
        }
    }
    static async resizeImageToFile(imagepath, width, height, outputPath) {
        try {
            const image = (0, sharp_1.default)(imagepath);
            await image.resize(width, height).toFile(outputPath);
        }
        catch (error) {
            throw new Error(`Error resizing image: ${error.message}`);
        }
    }
    static async convertImageToWebP(imagepath, outputPath, options) {
        try {
            const image = (0, sharp_1.default)(imagepath);
            if (options) {
                await image.webp(options).toFile(outputPath);
            }
            else {
                await image.webp().toFile(outputPath);
            }
        }
        catch (error) {
            throw new Error(`Error converting image to WebP: ${error.message}`);
        }
    }
    static async convertAndCompressImageToWebP(imagePath, outputPath, options) {
        try {
            const image = (0, sharp_1.default)(imagePath);
            // Get metadata to determine the original dimensions
            const metadata = await image.metadata();
            // Calculate the resize dimensions to ensure the image does not exceed 148px
            let width = metadata.width || 0;
            let height = metadata.height || 0;
            if (width > 148 || height > 148) {
                if (width > height) {
                    height = Math.round((148 / width) * height);
                    width = 148;
                }
                else {
                    width = Math.round((148 / height) * width);
                    height = 148;
                }
            }
            let o = {
                quality: 20,
                effort: 6
            };
            if (options && options.quality != undefined)
                o.quality = options.quality;
            if (options && options.effort != undefined)
                o.effort = options.effort;
            // Convert to WebP and compress as much as possible
            await image
                .resize(width, height) // Resize to fit within 148px
                .webp(o) // Compress with low quality and high effort
                .toFile(outputPath);
            console.log(`Image converted and compressed to WebP: ${outputPath}`);
        }
        catch (error) {
            throw new Error(`Error converting and compressing image to WebP: ${error.message}`);
        }
    }
    static async convertAndCompressImageToWebpBuffer(imagePath, options) {
        try {
            const image = (0, sharp_1.default)(imagePath);
            // Get metadata to determine the original dimensions
            const metadata = await image.metadata();
            // Calculate the resize dimensions to ensure the image does not exceed 148px
            let width = metadata.width || 0;
            let height = metadata.height || 0;
            if (width > 148 || height > 148) {
                if (width > height) {
                    height = Math.round((148 / width) * height);
                    width = 148;
                }
                else {
                    width = Math.round((148 / height) * width);
                    height = 148;
                }
            }
            let o = {
                quality: 20,
                effort: 6
            };
            if (options && options.quality != undefined)
                o.quality = options.quality;
            if (options && options.effort != undefined)
                o.effort = options.effort;
            // Convert to WebP and compress as much as possible
            let buffer = await image
                .resize(width, height) // Resize to fit within 148px
                .webp(o) // Compress with low quality and high effort
                .toBuffer();
            return buffer;
        }
        catch (error) {
            throw new Error(`Error converting and compressing image to WebP: ${error.message}`);
        }
    }
    static async combineImages(baseImage, overlayImages, combinedImage) {
        // Load base image
        const base = (0, sharp_1.default)(baseImage);
        const { width, height } = await base.metadata();
        if (overlayImages.length === 0) {
            await base.toFile(combinedImage);
            return;
        }
        // Prepare overlays: resize each to base dimensions
        const overlays = await Promise.all(overlayImages.map(async (imgPath) => {
            return {
                input: await (0, sharp_1.default)(imgPath).resize(width, height).toBuffer()
            };
        }));
        // Composite overlays over base
        await base
            .composite(overlays)
            .toFile(combinedImage);
    }
}
exports.ImageProcessing = ImageProcessing;
