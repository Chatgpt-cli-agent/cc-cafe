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
exports.NumberArrayBinaryUtil = void 0;
const fs = __importStar(require("fs"));
class NumberArrayBinaryUtil {
    /**
     * Writes an array of unsigned numbers to a binary file.
     * Format: [count (4 bytes LE)][n1 (4 bytes LE)][n2 (4 bytes LE)]...
     */
    static writeToFile(filePath, numbers) {
        const buffer = this.toByteArray(numbers);
        fs.writeFileSync(filePath, buffer);
    }
    /**
     * Reads an array of unsigned numbers from a binary file.
     * Expects format: [count (4 bytes LE)][n1 (4 bytes LE)][n2 (4 bytes LE)]...
     */
    static readFromFile(filePath) {
        const buffer = fs.readFileSync(filePath);
        return this.fromByteArray(buffer);
    }
    /**
     * Converts an array of numbers to a Buffer (byte array).
     */
    static toByteArray(numbers) {
        const buffer = Buffer.alloc(4 + numbers.length * 4);
        buffer.writeUInt32LE(numbers.length, 0);
        numbers.forEach((num, i) => buffer.writeUInt32LE(num, 4 + i * 4));
        return buffer;
    }
    /**
     * Converts a Buffer (byte array) to an array of numbers.
     */
    static fromByteArray(buffer) {
        const count = buffer.readUInt32LE(0);
        const numbers = [];
        for (let i = 0; i < count; i++) {
            numbers.push(buffer.readUInt32LE(4 + i * 4));
        }
        return numbers;
    }
}
exports.NumberArrayBinaryUtil = NumberArrayBinaryUtil;
