"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorUtil = void 0;
const electron_1 = require("electron");
class ErrorUtil {
    static showError(error) {
        electron_1.dialog.showErrorBox('Error', error);
    }
}
exports.ErrorUtil = ErrorUtil;
