"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageHelper = void 0;
const fs_1 = __importDefault(require("fs"));
class LanguageHelper {
    static getLanguage(settings) {
        let languageFilePath = settings.s_language_path;
        if (!languageFilePath || !fs_1.default.existsSync(languageFilePath)) {
            settings.s_language_path = "";
            return undefined;
        }
        let languageFile = fs_1.default.readFileSync(languageFilePath, "utf8");
        if (!languageFile) {
            settings.s_language_path = "";
            return undefined;
        }
        let language = JSON.parse(languageFile);
        if (!language) {
            settings.s_language_path = "";
            return undefined;
        }
        return language;
    }
}
exports.LanguageHelper = LanguageHelper;
