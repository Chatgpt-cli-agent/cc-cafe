"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Fingerprint = void 0;
const curseforge = require('@meza/curseforge-fingerprint');
const fs_1 = __importDefault(require("fs"));
class Fingerprint {
    static computeHash(buffer) {
        const multiplex = 1540483477; // Use 32-bit integer
        const length = buffer.length;
        let num1 = this.computeNormalizedLength(buffer);
        let num2 = (1 ^ num1) >>> 0; // Ensure 32-bit unsigned integer
        let num3 = 0;
        let num4 = 0;
        for (let index = 0; index < length; ++index) {
            const b = buffer[index];
            if (!this.isWhitespaceCharacter(b)) {
                num3 = (num3 | (b << num4)) >>> 0; // Ensure 32-bit unsigned integer
                num4 += 8;
                if (num4 === 32) {
                    const num6 = this.multiplyUint32(num3, multiplex);
                    ;
                    const num7 = (this.multiplyUint32((num6 ^ (num6 >>> 24)), multiplex)) >>> 0;
                    num2 = ((this.multiplyUint32(num2, multiplex)) ^ num7) >>> 0;
                    num3 = 0;
                    num4 = 0;
                }
            }
        }
        if (num4 > 0) {
            num2 = (this.multiplyUint32((num2 ^ num3), multiplex)) >>> 0;
        }
        const num6 = (this.multiplyUint32((num2 ^ (num2 >>> 13)), multiplex)) >>> 0;
        return (num6 ^ (num6 >>> 15)) >>> 0;
    }
    static computeNormalizedLength(buffer) {
        let num1 = 0;
        const length = buffer.length;
        for (let index = 0; index < length; ++index) {
            if (!this.isWhitespaceCharacter(buffer[index])) {
                ++num1;
            }
        }
        return num1 >>> 0; // Ensure 32-bit unsigned integer
    }
    static isWhitespaceCharacter(b) {
        return b === 9 || b === 10 || b === 13 || b === 32;
    }
    static multiplyUint32(a, b) {
        return Math.imul(a, b);
    }
    static computeFile(filePath) {
        if (!fs_1.default.existsSync(filePath))
            throw new Error(`File not found: ${filePath}`);
        const buffer = fs_1.default.readFileSync(filePath);
        return Fingerprint.computeBuffer(buffer);
    }
    static computeBuffer(buffer) {
        let fingerprint = -1;
        try {
            fingerprint = curseforge.computeFingerprint(buffer);
            return fingerprint;
        }
        catch (error) {
            // If the curseforge library fails, fall back to our own implementation
        }
        try {
            fingerprint = this.computeHash(buffer);
            return fingerprint;
        }
        catch (error) {
            // If our own implementation fails, return -1
            return -1;
        }
    }
}
exports.Fingerprint = Fingerprint;
