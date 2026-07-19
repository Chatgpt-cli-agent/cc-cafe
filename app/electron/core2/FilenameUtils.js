"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertFilename = exports.clearName = exports.isScriptFile = exports.isPackageFile = exports.getIsActive = exports.isSims4File = void 0;
const isSims4File = (filename) => {
    if (!filename)
        throw new Error("Incorrect input");
    const upper = filename.toUpperCase();
    return (upper.endsWith(".PACKAGE") ||
        upper.endsWith(".PACKAGEOFF") ||
        upper.endsWith(".TS4SCRIPT") ||
        upper.endsWith(".TS4SCRIPTOFF"));
};
exports.isSims4File = isSims4File;
const getIsActive = (filename) => {
    if (!filename)
        throw new Error("Incorrect input");
    const upper = filename.toUpperCase();
    if (upper.endsWith(".TS4SCRIPTOFF") || upper.endsWith(".PACKAGEOFF")) {
        return false;
    }
    else if (upper.endsWith(".TS4SCRIPT") || upper.endsWith(".PACKAGE")) {
        return true;
    }
    throw new Error("Not a proper file");
};
exports.getIsActive = getIsActive;
const isPackageFile = (filename) => {
    if (!filename)
        throw new Error("Incorrect input");
    const upper = filename.toUpperCase();
    return upper.endsWith(".PACKAGE") || upper.endsWith(".PACKAGEOFF");
};
exports.isPackageFile = isPackageFile;
const isScriptFile = (filename) => {
    if (!filename)
        throw new Error("Incorrect input");
    const upper = filename.toUpperCase();
    return upper.endsWith(".TS4SCRIPT") || upper.endsWith(".TS4SCRIPTOFF");
};
exports.isScriptFile = isScriptFile;
const clearName = (filename) => {
    return (0, exports.convertFilename)(filename, true);
};
exports.clearName = clearName;
const convertFilename = (filename, isActivated) => {
    if (!filename)
        throw new Error("Incorrect input");
    const dotIndex = filename.lastIndexOf(".");
    if (dotIndex === -1)
        throw new Error("Not a proper file");
    const preStr = filename.substring(0, dotIndex);
    const ext = filename.substring(dotIndex + 1).toUpperCase();
    if (isActivated === undefined)
        isActivated = ext.endsWith("OFF");
    if (ext.startsWith("PACKAGE")) {
        return preStr + ".package" + (isActivated ? "" : "OFF");
    }
    else if (ext.startsWith("TS4SCRIPT")) {
        return preStr + ".ts4script" + (isActivated ? "" : "OFF");
    }
    else {
        return preStr + "." + ext;
    }
};
exports.convertFilename = convertFilename;
