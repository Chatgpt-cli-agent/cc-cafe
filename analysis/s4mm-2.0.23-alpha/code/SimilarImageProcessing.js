var sharp = require('sharp');

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


async function processImageBuffer(bufferIn) {

    try {
        const { data, info } = await sharp(bufferIn)
            .resize(targetWidth, targetHeight, {
                fit: 'cover'
            })
            .grayscale()
            .raw()
            .toBuffer({ resolveWithObject: true });
        const width = info.width;
        const height = info.height;

        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x++) {
                const idx = (info.width * y + x) * info.channels;
                data[idx] = 0; // Red
                data[idx + 1] = 0; // Green
                data[idx + 2] = 0; // Blue
                if (info.channels === 4) {
                    data[idx + 3] = 255; // Alpha
                }
            }
        }

        const min = Math.min(...data);
        const max = Math.max(...data);
        const normalizedData = data.map(value => ((value - min) / (max - min)) * 255);

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

        return await sharp(Buffer.from(edgeData), {
                raw: {
                    width: width,
                    height: height,
                    channels: 1
                }
            }).extract({ left: 0, top: 0, width: width, height: height - 27 })
            .jpeg()
            .toBuffer();
    } catch (err) {
        console.error('Error processing image:', err);
    }
    return undefined;
}

async function processImageBufferWithOptions(bufferIn, options = {}) {
    let {
        grayscale = false,
            addBlack = true,
            normalize = true,
            edgeDetection = false,
            removeBottom = true
    } = options;

    if (edgeDetection) grayscale = true;

    try {
        let { data, info } = grayscale ? (await sharp(bufferIn)
            .resize(targetWidth, targetHeight, {
                fit: 'cover'
            })
            .grayscale()
            .raw()
            .toBuffer({ resolveWithObject: true })) : (await sharp(bufferIn)
            .resize(targetWidth, targetHeight, {
                fit: 'cover'
            })
            .raw()
            .toBuffer({ resolveWithObject: true }));

        const width = info.width;
        const height = info.height;

        if (addBlack) {
            for (let y = 0; y < 32; y++) {
                for (let x = 0; x < 32; x++) {
                    const idx = (info.width * y + x) * info.channels;
                    data[idx] = 0; // Red
                    data[idx + 1] = 0; // Green
                    data[idx + 2] = 0; // Blue
                    if (info.channels === 4) {
                        data[idx + 3] = 255; //
                    }
                }
            }
        }

        if (normalize) {
            const min = Math.min(...data);
            const max = Math.max(...data);
            data = data.map(value => ((value - min) / (max - min)) * 255);
        }

        if (edgeDetection) {
            const edgeData = new Uint8Array(width * height);

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let gx = 0;
                    let gy = 0;

                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixel = data[(y + ky) * width + (x + kx)];
                            gx += pixel * sobelX[ky + 1][kx + 1];
                            gy += pixel * sobelY[ky + 1][kx + 1];
                        }
                    }

                    const magnitude = Math.sqrt(gx * gx + gy * gy);
                    edgeData[y * width + x] = magnitude > 255 ? 255 : magnitude;
                }
            }

            data = edgeData;
        }

        if (removeBottom) {
            return await sharp(Buffer.from(data), {
                    raw: {
                        width: width,
                        height: height,
                        channels: edgeDetection ? 1 : info.channels
                    }
                }).extract({ left: 0, top: 0, width: width, height: height - 27 })
                .jpeg()
                .toBuffer();
        } else {
            return await sharp(Buffer.from(data), {
                    raw: {
                        width: width,
                        height: height,
                        channels: edgeDetection ? 1 : info.channels
                    }
                }).jpeg()
                .toBuffer();
        }
    } catch (err) {
        console.error('Error processing image:', err);
    }
    return undefined;
}

module.exports = { processImageBuffer, processImageBufferWithOptions };