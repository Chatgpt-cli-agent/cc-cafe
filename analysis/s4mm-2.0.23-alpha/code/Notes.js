"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notes = void 0;
var fs = require('fs');
var path = require('path');
var Notes = /** @class */ (function () {
    function Notes() {
    }
    Notes.updateNoteByIno = function (ino, cname, note, basepath) {
        var file = basepath + path.sep + this.filename;
        if (fs.existsSync(file) && !this.readJson(file))
            return;
        if (note.length != 0) {
            var obj = { "note": note, "filename": cname };
            this.inoMap.set(ino, obj);
            this.nameMap.set(cname, obj);
            this.saveMapToJSON(file);
            return;
        }
        this.removeNoteByIno(ino, cname, basepath);
    };
    Notes.removeNoteByIno = function (ino, cname, basepath) {
        var file = basepath + path.sep + this.filename;
        if (!this.readJson(file))
            return;
        this.inoMap.delete(ino);
        this.nameMap.delete(cname);
        this.saveMapToJSON(file);
    };
    Notes.getNoteByInoOrName = function (ino, cname, basepath) {
        var file = basepath + path.sep + this.filename;
        var note = "";
        if (!this.readJson(file))
            return note;
        var inoItem = this.inoMap.get(ino);
        if (inoItem)
            return inoItem.note;
        var nameItem = this.nameMap.get(cname);
        if (nameItem)
            return nameItem.note;
        return note;
    };
    Notes.loadJSON = function (file) {
        var r = JSON.parse("{}");
        if (fs.existsSync(file)) {
            try {
                var data = fs.readFileSync(file, 'utf8');
                return JSON.parse(data);
            }
            catch (err) {
                //Settings faild -> use Defaults
            }
        }
        return r;
    };
    Notes.readJson = function (file) {
        if (this.loaded)
            return true;
        if (fs.existsSync(file)) {
            try {
                var data = fs.readFileSync(file, 'utf8');
                var jsonObj = JSON.parse(data);
                var keys = Object.keys(jsonObj);
                for (var index = 0; index < keys.length; index++) {
                    var key = Number(keys[index]);
                    var element = jsonObj[key];
                    if (!element)
                        continue;
                    //element.ino = key;
                    this.inoMap.set(key, element);
                    this.nameMap.set(element.filename, element);
                }
                //console.log(this.nameMap);
                this.loaded = true;
                return true;
            }
            catch (err) {
                //Settings faild -> use Defaults
            }
        }
        return false;
    };
    Notes.saveJSON = function (file, json) {
        fs.writeFileSync(file, JSON.stringify(json), 'utf8');
    };
    Notes.saveMapToJSON = function (file) {
        fs.writeFileSync(file, JSON.stringify(this.mapToObj(this.inoMap)), 'utf8');
    };
    Notes.mapToObj = function (map) {
        var obj = {};
        var keys = Array.from(map.keys());
        keys.forEach(function (key) {
            var item = map.get(key);
            obj[key] = item;
        });
        return obj;
    };
    Notes.filename = "notes.json";
    Notes.inoMap = new Map();
    Notes.nameMap = new Map();
    Notes.loaded = false;
    return Notes;
}());
exports.Notes = Notes;
