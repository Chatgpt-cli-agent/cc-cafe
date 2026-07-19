"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Translate = void 0;
var fs = require('fs');
var fsExtra = require('fs-extra');
var path = require('path');
var Translate = /** @class */ (function () {
    function Translate() {
        this.loadedLanguage = undefined;
    }
    Translate.prototype.setLanguageWithFile = function (file) {
        if (!file || !fs.existsSync(file))
            return;
        try {
            var data = fs.readFileSync(file, 'utf8');
            var obj = JSON.parse(data);
            this.loadedLanguage = obj;
        }
        catch (error) {
            console.log(error);
        }
    };
    Translate.prototype.setLanguageJson = function (obj) {
        this.loadedLanguage = obj;
    };
    Translate.prototype.get = function (value, fallback) {
        if (!this.loadedLanguage || !value || value.trim().length == 0)
            return fallback;
        var parts = value.split(".");
        var result = this.getByValue(this.loadedLanguage, parts);
        if (result)
            return result;
        return fallback;
    };
    Translate.prototype.getByValue = function (obj, arr) {
        try {
            var value = arr[0];
            arr.splice(0, 1);
            var nObj = obj[value];
            if (nObj && arr.length > 0) {
                return this.getByValue(nObj, arr);
            }
            else if ((typeof nObj) == (typeof "")) {
                return nObj;
            }
            else {
                return undefined;
            }
        }
        catch (error) {
            return undefined;
        }
    };
    return Translate;
}());
exports.Translate = Translate;
