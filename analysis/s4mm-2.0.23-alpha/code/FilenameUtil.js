const path = require('path');

const isSims4File = (filename) => {
    if (!filename) throw new Error("Incorect input");
    let upper = filename.toUpperCase();
    if (upper.endsWith(".PACKAGE") ||
        upper.endsWith(".PACKAGEOFF") ||
        upper.endsWith(".TS4SCRIPT") ||
        upper.endsWith(".TS4SCRIPTOFF")) {
        return true;
    }
    return false;
}

const getIsActive = (filename) => {
    if (!filename) throw new Error("Incorect input");
    let upper = filename.toUpperCase();
    if (upper.endsWith(".TS4SCRIPTOFF") ||
        upper.endsWith(".PACKAGEOFF")) {
        return false;
    } else if (upper.endsWith(".TS4SCRIPT") ||
        upper.endsWith(".PACKAGE")) {
        return true
    }
    throw new Error("Not a propper file");
}

const isPackageFile = (filename) => {
    if (!filename) throw new Error("Incorect input");
    let upper = filename.toUpperCase();
    if (upper.endsWith(".PACKAGE") ||
        upper.endsWith(".PACKAGEOFF")) {
        return true;
    }
    return false;
}

const isScriptFile = (filename) => {
    if (!filename) throw new Error("Incorect input");
    let upper = filename.toUpperCase();
    if (upper.endsWith(".TS4SCRIPT") ||
        upper.endsWith(".TS4SCRIPTOFF")) {
        return true;
    }
    return false;
}

const clearName = (filename) => {
    return convertFilename(filename, true);
}

const convertFilename = (filename, isActivated) => {
    if (!filename) throw new Error("Incorect input");
    let dotIndex = filename.lastIndexOf(".");
    if (!dotIndex) throw new Error("Not a propper file");
    let preStr = filename.substring(0, dotIndex);
    let ext = filename.substring(dotIndex + 1).toUpperCase();
    if (isActivated == undefined) isActivated = ext.endsWith("OFF");
    if (ext.startsWith("PACKAGE")) {
        return preStr + ".package" + (isActivated ? "" : "OFF");
    } else if (ext.startsWith("TS4SCRIPT")) {
        return preStr + ".ts4script" + (isActivated ? "" : "OFF");
    } else {
        throw new Error("Unknown Filetype")
    }
}

exports.isSims4File = isSims4File;
exports.getIsActive = getIsActive;
exports.isPackageFile = isPackageFile;
exports.isScriptFile = isScriptFile;
exports.clearName = clearName;
exports.convertFilename = convertFilename;