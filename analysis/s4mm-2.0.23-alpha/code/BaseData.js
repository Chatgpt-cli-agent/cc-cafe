"use strict";
exports.__esModule = true;
exports.BaseDataValues = exports.BaseData = void 0;
var fs = require('fs');
var BaseData = /** @class */ (function () {
    function BaseData(file) {
        this.data = new BaseDataValues();
        this.file = file;
    }
    BaseData.prototype.saveFile = function () {
        if (!this.file || this.file.length == 0) {
            console.log("BaseData-saveFile: No file Path");
            return "BaseData-saveFile: No file Path";
        }
        try {
            fs.writeFileSync(this.file, JSON.stringify(this.data), 'utf8');
            console.log("Saved File");
            return "Saved File";
        }
        catch (error) {
            console.log(error);
            return error;
        }
    };
    BaseData.prototype.loadFile = function () {
        if (!this.file || this.file.length == 0 || !fs.existsSync(this.file)) {
            console.log("BaseData-loadFile: No file Path -> " + this.file);
            return;
        }
        try {
            var data = fs.readFileSync(this.file, 'utf8');
            var bd = BaseDataValues.from(JSON.parse(data));
            this.data = bd;
        }
        catch (err) {
            console.log(err);
        }
        //console.log(JSON.stringify(this.data));
    };
    return BaseData;
}());
exports.BaseData = BaseData;
var BaseDataValues = /** @class */ (function () {
    function BaseDataValues() {
        this.dataFolder = "";
        this.oldDataFolder = "";
        this.userDataFolder = false;
        this.dataFolder = "";
        this.userDataFolder = false;
        this.oldDataFolder = "";
    }
    BaseDataValues.from = function (json) {
        return Object.assign(new BaseDataValues(), json);
    };
    return BaseDataValues;
}());
exports.BaseDataValues = BaseDataValues;
