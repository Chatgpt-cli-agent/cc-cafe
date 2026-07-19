"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openMac = void 0;
const child_process_1 = require("child_process");
/**
 * Opens files from a shell.
 * By default, opens each file using the default application for that file.
 * If the file is in the form of a URL, the file will be opened as a URL.
 *
 * @param filenames The files to open.
 * @param options Options to open the file.
 * @param callback Called with null on success, or an error object that contains a property 'code' with the exit code of the process.
 * @returns The child process object or a string if `test` option is true.
 */
function openMac(filenames, options = {}, callback) {
    if (!filenames) {
        return false;
    }
    const cmd = ["open"];
    let test = false;
    if (options.test === true) {
        delete options.test;
        test = true;
    }
    for (const [key, value] of Object.entries(options)) {
        if (value === true) {
            cmd.push(`-${key}`);
        }
        else if (typeof value === "string") {
            cmd.push(`-${key} "${value}"`);
        }
    }
    cmd.push(escapeShell(filenames));
    if (test) {
        return cmd.join(" ");
    }
    else {
        return (0, child_process_1.exec)(cmd.join(" "), callback);
    }
}
exports.openMac = openMac;
/**
 * Escapes a string for use in a shell command.
 *
 * @param value The value to escape.
 * @returns The escaped string.
 */
function escapeShell(value) {
    return `"${value}"`;
}
