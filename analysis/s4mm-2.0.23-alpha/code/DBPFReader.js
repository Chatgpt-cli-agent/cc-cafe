"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimsHashes = exports.Helper = exports.TagType = exports.BodyType = exports.COBJMapper = exports.CASPMapper = exports.MTSTFile = exports.MTRLFile = exports.MATDFile = exports.MeshFile = exports.MLODFile = exports.MODLFile = exports.VBUFFile = exports.IBUFFile = exports.VRTFFile = exports.ChunkEntry = exports.ChunkEntryList = exports.GenericRCOLFile = exports.S4SMMFile = exports.GameFiles = exports.STBLFile = exports.GEOMResource = exports.ZoneObjItem = exports.ZoneObjFile = exports.GEOMFile = exports.RMAPFile = exports.CLIPResource = exports.COBJResource = exports.COBJFile = exports.OBJDFile = exports.CASPResource = exports.CASPFile = exports.LRLEFile = exports.REL2File = exports.CompressUtil = exports.Basic = exports.PackHandler = exports.BinaryWritter = exports.BufferOperations = exports.ByteBuffer = exports.SimsPatterns = exports.TrayFiles = exports.IndexEnty = exports.SaveFile = exports.ModelGroup = exports.COBJPack = exports.Pack = void 0;
var fs = require('fs');
var zlib = require("zlib");
var sharp = require('sharp');
var path = require('path');
var Buffer = require('buffer').Buffer;
var PNGImage = require('@nodebug/pngjs-image');
var Jimp = require("jimp");
var readUleb128 = require("uleb128_33").readUleb128;
var NAMEUTIL = require('./FilenameUtil.js');
var _a = require('./DDS.js'), DSTResource = _a.DSTResource, DDSConverter = _a.DDSConverter;
var Pack = /** @class */ (function () {
    function Pack(file) {
        this.fileID = 0;
        this.inoId = -1;
        this.modified = false;
        this.resources = new Set();
        this.isS4SMerged = false;
        this.file = file;
        this.error = false;
        this.index_Count = 0;
        this.index_Offset = 0;
        this.index_Size = 0;
        this.index_List = [];
    }
    Pack.prototype.checkFile = function () {
        try {
            this.fileID = fs.openSync(this.file);
            var buf = Buffer.alloc(0x60);
            fs.readSync(this.fileID, buf, 0, 0x60);
            fs.closeSync(this.fileID);
            var bb = new ByteBuffer(buf);
            if (bb.getInt() != 0x46504244) {
                this.error = true;
                return;
            }
            bb.pos = 36;
            this.index_Count = bb.getInt();
            bb.pos = 44;
            this.index_Size = bb.getInt();
            bb.pos = 64;
            this.index_Offset = bb.getInt();
        }
        catch (err) {
            this.error = true;
        }
    };
    Pack.prototype.calculateIndexList = function () {
        try {
            this.index_List = [];
            var buf = Buffer.alloc(this.index_Size);
            this.fileID = fs.openSync(this.file);
            fs.readSync(this.fileID, buf, 0, buf.length, this.index_Offset);
            fs.closeSync(this.fileID);
            var bb = new ByteBuffer(buf);
            //console.log(buf);
            bb.pos = 4;
            this.isS4SMerged = false;
            for (var index = 0; index < this.index_Count; index++) {
                var r_type = bb.getInt();
                var r_group = bb.getInt();
                var i_hi = bb.getInt();
                var i_lo = bb.getInt();
                var chunckOffset = bb.getInt();
                var filesize = (bb.getInt() << 1) >>> 1;
                var memsize = bb.getInt();
                var com = bb.getShort();
                var unknown = bb.getShort();
                var entry = new IndexEnty(this.file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown);
                if (entry.type == TagType.S4SMM)
                    this.isS4SMerged = true;
                if (r_type < 0)
                    this.error = true;
                if (r_group < 0)
                    this.error = true;
                this.resources.add(r_type.toString(16).padStart(8, "0") + "-" +
                    r_group.toString(16).padStart(8, "0") + "-" +
                    i_hi.toString(16).padStart(8, "0") + i_lo.toString(16).padStart(8, "0"));
                this.index_List.push(entry);
            }
        }
        catch (err) {
            console.log(err);
            //fs.closeSync(this.fileID);
            this.error = true;
        }
    };
    Pack.prototype.exportThumnails = function (folder, complex, simpleName) {
        return __awaiter(this, void 0, void 0, function () {
            var list, index, element, inp, n_typ, n_group, n_inst, name_1, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        list = [];
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < this.index_List.length)) return [3 /*break*/, 6];
                        element = this.index_List[index];
                        if (!(element.type == TagType.THUM || element.type == TagType.S4MMTHUM)) return [3 /*break*/, 5];
                        inp = element.getByteArray();
                        n_typ = element.r_type.toString(16).padStart(8, "0");
                        n_group = element.r_group.toString(16).padStart(8, "0");
                        n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                        name_1 = "0x" + n_inst + ".png";
                        if (simpleName == false || simpleName == undefined) {
                            name_1 = n_typ + "-" + n_group + "-" + n_inst + ".png";
                        }
                        file = folder + path.sep + name_1;
                        if (!(element.type == TagType.S4MMTHUM)) return [3 /*break*/, 2];
                        fs.writeFileSync(file, inp);
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, PackHandler.saveBufferToFile(file, inp, complex)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        if (fs.existsSync(file)) {
                            list.push(file);
                        }
                        _a.label = 5;
                    case 5:
                        index++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, list];
                }
            });
        });
    };
    Pack.prototype.exportThumnailsSpecial = function (folder, complex, simpleName, replace) {
        return __awaiter(this, void 0, void 0, function () {
            var list, index, element, inp, n_typ, n_group, n_inst, name_2, file, n_typ, n_group, n_inst, name_3, file, inp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        list = [];
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < this.index_List.length)) return [3 /*break*/, 6];
                        element = this.index_List[index];
                        if (!(element.r_type == 0x3c1af1f2 && replace)) return [3 /*break*/, 3];
                        inp = element.getByteArray();
                        n_typ = element.r_type.toString(16).padStart(8, "0");
                        n_group = element.r_group.toString(16).padStart(8, "0");
                        n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                        name_2 = "0x" + n_inst + ".png";
                        if (simpleName == false || simpleName == undefined) {
                            name_2 = n_typ + "-" + n_group + "-" + n_inst + ".png";
                        }
                        file = folder + path.sep + name_2;
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, inp, complex)];
                    case 2:
                        _a.sent();
                        if (fs.existsSync(file)) {
                            list.push({
                                name: name_2,
                                path: folder
                            });
                        }
                        return [3 /*break*/, 5];
                    case 3:
                        if (!(element.r_type == 0x3c1af1f2 && replace == false)) return [3 /*break*/, 5];
                        n_typ = element.r_type.toString(16).padStart(8, "0");
                        n_group = element.r_group.toString(16).padStart(8, "0");
                        n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                        name_3 = "0x" + n_inst + ".png";
                        if (simpleName == false || simpleName == undefined) {
                            name_3 = n_typ + "-" + n_group + "-" + n_inst + ".png";
                        }
                        file = folder + path.sep + name_3;
                        if (!!fs.existsSync(file)) return [3 /*break*/, 5];
                        inp = element.getByteArray();
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, inp, complex)];
                    case 4:
                        _a.sent();
                        if (fs.existsSync(file)) {
                            list.push({
                                name: name_3,
                                folder: folder
                            });
                        }
                        _a.label = 5;
                    case 5:
                        index++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, list];
                }
            });
        });
    };
    Pack.prototype.exportCASThumnails = function (folder, simpleName, replace, complex) {
        return __awaiter(this, void 0, void 0, function () {
            var list, index, element, inp, n_typ, n_group, n_inst, ext, name_4, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        list = [];
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < this.index_List.length)) return [3 /*break*/, 5];
                        element = this.index_List[index];
                        if (!(element.r_type == 0x3c1af1f2)) return [3 /*break*/, 4];
                        inp = element.getByteArray();
                        n_typ = element.r_type.toString(16).padStart(8, "0");
                        n_group = element.r_group.toString(16).padStart(8, "0");
                        n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                        ext = "jpeg";
                        name_4 = "0x" + n_inst + "." + ext;
                        if (simpleName == false || simpleName == undefined) {
                            name_4 = n_typ + "-" + n_group + "-" + n_inst + "." + ext;
                        }
                        file = folder + path.sep + name_4;
                        if (!(!fs.existsSync(file) || replace)) return [3 /*break*/, 3];
                        return [4 /*yield*/, PackHandler.saveCASCOBJImageBufferToFile(file, inp, complex)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        if (fs.existsSync(file)) {
                            list.push({
                                name: name_4,
                                path: folder
                            });
                        }
                        else {
                            console.log("File dosent exist! - " + file);
                        }
                        _a.label = 4;
                    case 4:
                        index++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/, list];
                }
            });
        });
    };
    Pack.prototype.exportCOBJThumnails = function (folder, simpleName, replace, complex) {
        return __awaiter(this, void 0, void 0, function () {
            var list, itemMap, index, element, key, item, elements, index, element, inp, n_typ, n_group, n_inst, ext, name_5, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        list = [];
                        itemMap = new Map();
                        for (index = 0; index < this.index_List.length; index++) {
                            element = this.index_List[index];
                            if (element.r_type == 0x3C2A8647) {
                                key = element.getInstanceString();
                                item = itemMap.get(key);
                                if (!item || item.memsize < element.memsize)
                                    itemMap.set(key, element);
                            }
                        }
                        elements = Array.from(itemMap.values());
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < elements.length)) return [3 /*break*/, 5];
                        element = elements[index];
                        inp = element.getByteArray();
                        n_typ = element.r_type.toString(16).padStart(8, "0");
                        n_group = element.r_group.toString(16).padStart(8, "0");
                        n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                        ext = "jpeg";
                        name_5 = "0x" + n_inst + "." + ext;
                        if (simpleName == false || simpleName == undefined) {
                            name_5 = n_typ + "-" + n_group + "-" + n_inst + "." + ext;
                        }
                        file = folder + path.sep + name_5;
                        if (!(!fs.existsSync(file) || replace)) return [3 /*break*/, 3];
                        return [4 /*yield*/, PackHandler.saveCASCOBJImageBufferToFile(file, inp, complex)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        if (fs.existsSync(file)) {
                            list.push({
                                name: name_5,
                                path: folder
                            });
                        }
                        else {
                            console.log("File dosent exist! - " + file);
                        }
                        _a.label = 4;
                    case 4:
                        index++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/, list];
                }
            });
        });
    };
    Pack.prototype.exportBiggest = function (folderPath) {
        return __awaiter(this, void 0, void 0, function () {
            var biggest, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        biggest = this.getBiggestThumIndexEntry();
                        if (!(biggest != undefined)) return [3 /*break*/, 3];
                        file = folderPath + path.sep + "[CC]" + this.inoId + ".png";
                        if (!(biggest.type == TagType.S4MMTHUM)) return [3 /*break*/, 1];
                        fs.writeFileSync(file, biggest.getByteArray());
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, PackHandler.saveBufferToFile(file, biggest.getByteArray(), false)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    Pack.prototype.getBiggestThumIndexEntry = function () {
        var biggest;
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.THUM || element.type == TagType.S4MMTHUM) {
                if (biggest == undefined) {
                    biggest = element;
                }
                else {
                    if (biggest.memsize < element.memsize)
                        biggest = element;
                }
            }
        }
        return biggest;
    };
    Pack.prototype.calulateCASPFiles = function () {
        //Read Casp
        var files = [];
        var hasGeom = false;
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.CASP) {
                var casp = new CASPFile(element.getByteArray());
                casp.instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                //console.log(casp.instanceID);
                if (!casp.error)
                    files.push(casp);
            }
            else if (element.type == TagType.GEOM) {
                hasGeom = true;
            }
        }
        if (files.length == 0)
            return;
        var cr = new CASPResource();
        //CombineCasp
        for (var index = 0; index < files.length; index++) {
            var element = files[index];
            cr.addFile(element);
        }
        cr.isRecolor = (!hasGeom && cr.propIds.size != 0 && cr.checkRecolor());
        this.caspResource = cr;
    };
    Pack.prototype.calulateCOBJFiles = function () {
        var hasGeom = false;
        var files = [];
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.COBJ
                || element.type == TagType.CFLR
                || element.type == TagType.CWAL) {
                var cobj = new COBJFile(element.getByteArray(), element.r_type);
                cobj.instanceID = Basic.getInstanceKey(element);
                if (!cobj.error)
                    files.push(cobj);
            }
            else if (element.type == TagType.GEOM) {
                hasGeom = true;
            }
        }
        if (files.length == 0)
            return;
        var cr = new COBJResource();
        //CombineCobj
        for (var index = 0; index < files.length; index++) {
            var element = files[index];
            cr.addFile(element);
        }
        this.cobjResource = cr;
    };
    Pack.prototype.calulateCLIPFiles = function () {
        var hasCLIP = false;
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.CLIP) {
                //let casp: CASPFile = new CASPFile(element.getByteArray());
                //casp.instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                //if (!casp.error) files.push(casp);
                hasCLIP = true;
            }
        }
        if (hasCLIP)
            this.clipResource = new CLIPResource();
    };
    Pack.prototype.calulateGEOMFiles = function () {
        //Read GEOM
        var files = [];
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.GEOM) {
                var geom = new GEOMFile(element.getByteArray());
                geom.instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                //console.log(casp.instanceID);
                if (!geom.error) {
                    files.push(geom);
                    console.log(geom.toString());
                }
            }
        }
        if (files.length == 0)
            return;
        var gFile = new GEOMResource();
        gFile.files = files;
        this.geomResource = gFile;
    };
    Pack.prototype.calulateGEOMSizeMapFiles = function () {
        var map = new Map();
        //Read GEOM
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.GEOM) {
                var geom = new GEOMFile(element.getByteArray(), true);
                geom.instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                var key = element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                if (!geom.error) {
                    map.set(key, { vertex: geom.vertexCount, faces: geom.facesCount });
                }
            }
        }
        return map;
    };
    Pack.prototype.calulateGEOMSizeMapFilesCASP = function () {
        var map = new Map();
        if (!this.caspResource)
            return map;
        var caspFiles = this.caspResource.caspFiles;
        var lodMap = new Map();
        var propIdMap = new Map();
        for (var index = 0; index < caspFiles.length; index++) {
            var caspFile = caspFiles[index];
            var lodLevels = caspFile.lodLevels;
            for (var i = 0; i < lodLevels.length; i++) {
                var element = lodLevels[i];
                for (var j = 0; j < element.list.length; j++) {
                    var id = element.list[j];
                    lodMap.set(id, element.level);
                    propIdMap.set(id, caspFile.propID);
                }
            }
        }
        var oMap = new Map();
        var items = [];
        var min = Number.MAX_SAFE_INTEGER;
        var max = 0;
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.GEOM) {
                var key = element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                if (lodMap.has(key)) {
                    var geom = new GEOMFile(element.getByteArray(), true);
                    geom.instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                    if (!geom.error) {
                        var propID = propIdMap.get(key);
                        if (geom.vertexCount > max) {
                            max = geom.vertexCount;
                        }
                        if (geom.vertexCount < min) {
                            min = geom.vertexCount;
                        }
                        var m = new Map();
                        if (oMap.has(propID)) {
                            m = oMap.get(propID);
                        }
                        m.set(key, { v: geom.vertexCount, f: geom.facesCount, l: lodMap.get(key) });
                        oMap.set(propID, m);
                    }
                }
            }
        }
        var keys = Array.from(oMap.keys());
        for (var index = 0; index < keys.length; index++) {
            var element = keys[index];
            var map_1 = oMap.get(element);
            var ids = [];
            var innerKeys = Array.from(map_1.keys());
            for (var index_1 = 0; index_1 < innerKeys.length; index_1++) {
                var innerKey = innerKeys[index_1];
                var obj = map_1.get(innerKey);
                obj.i = innerKey;
                ids.push(obj);
            }
            items.push({
                pi: element,
                d: ids
            });
        }
        return {
            ma: max,
            mi: min,
            i: items
        };
    };
    Pack.prototype.calulateGEOMByInstance = function (instanceID) {
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            var key = element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
            key = key.toLowerCase();
            if (key == instanceID) {
                var geom = new GEOMFile(element.getByteArray());
                if (!geom.error) {
                    return geom.chunks;
                }
                //console.log("Found Data");
            }
        }
        return undefined;
    };
    Pack.prototype.getEntryIfExists = function (type, group, instance) {
        if (type == undefined && group == undefined && instance == undefined)
            return undefined;
        ;
        for (var index = this.index_List.length - 1; index >= 0; index--) {
            var element = this.index_List[index];
            var con_type = (type == undefined || type == element.r_type);
            var con_group = (group == undefined || group == element.r_group);
            var con_instance = (instance == undefined || instance === Basic.getInstanceKey(element));
            if (con_type && con_group && con_instance) {
                return element;
            }
        }
        return undefined;
    };
    Pack.prototype.getEntryIfExistsByKey = function (key) {
        for (var index = this.index_List.length - 1; index >= 0; index--) {
            var element = this.index_List[index];
            var con_key = element.getKey();
            if (con_key == key)
                return element;
        }
        return undefined;
    };
    Pack.prototype.exportCacheThumbnails = function (casCobjPath, moodPath) {
        return __awaiter(this, void 0, void 0, function () {
            var maxMood, moodSet, list, mood, cobjMap, index, element, inp, instanceId, file, size, key, sizeToBeat, keys, index, element, inp, instanceId, file, index, pos, el, inp, file;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.index_Count != this.index_List.length) {
                            this.calculateIndexList();
                        }
                        maxMood = 10;
                        moodSet = new Set();
                        moodSet.add(0xC2);
                        moodSet.add(0xD2);
                        moodSet.add(0xF2);
                        moodSet.add(0x102);
                        moodSet.add(0x132);
                        moodSet.add(0x152);
                        moodSet.add(0x162);
                        moodSet.add(0x172);
                        list = [];
                        mood = [];
                        cobjMap = new Map();
                        index = 0;
                        _b.label = 1;
                    case 1:
                        if (!(index < this.index_List.length)) return [3 /*break*/, 5];
                        element = this.index_List[index];
                        if (!(element.r_type == 0x3C1AF1F2)) return [3 /*break*/, 3];
                        inp = element.getByteArray();
                        instanceId = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                        instanceId = instanceId.toUpperCase();
                        file = casCobjPath + path.sep + instanceId + ".png";
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, inp, true)];
                    case 2:
                        _b.sent();
                        if (fs.existsSync(file)) {
                            list.push(file);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        if (element.r_type == 0x3C2A8647) {
                            size = element.memsize;
                            key = element.r_type + "-" + element.i_hi + element.i_lo;
                            if (cobjMap.has(key)) {
                                sizeToBeat = (_a = cobjMap.get(key)) === null || _a === void 0 ? void 0 : _a.memsize;
                                if (sizeToBeat && sizeToBeat < size)
                                    cobjMap.set(key, element);
                            }
                            else {
                                cobjMap.set(key, element);
                            }
                        }
                        else if (element.r_type == 0x16CCF748 && moodSet.has(element.r_group)) {
                            mood.push(element);
                        }
                        _b.label = 4;
                    case 4:
                        index++;
                        return [3 /*break*/, 1];
                    case 5:
                        keys = Array.from(cobjMap.keys());
                        index = 0;
                        _b.label = 6;
                    case 6:
                        if (!(index < keys.length)) return [3 /*break*/, 9];
                        element = cobjMap.get(keys[index]);
                        if (element == undefined)
                            return [3 /*break*/, 8];
                        inp = element.getByteArray();
                        instanceId = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                        instanceId = instanceId.toUpperCase();
                        file = casCobjPath + path.sep + instanceId + ".png";
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, inp, true)];
                    case 7:
                        _b.sent();
                        if (fs.existsSync(file)) {
                            list.push(file);
                        }
                        _b.label = 8;
                    case 8:
                        index++;
                        return [3 /*break*/, 6];
                    case 9:
                        if (!(moodPath.length != 0 && fs.existsSync(moodPath))) return [3 /*break*/, 13];
                        index = 0;
                        _b.label = 10;
                    case 10:
                        if (!(index < maxMood && mood.length != 0)) return [3 /*break*/, 13];
                        pos = Math.floor(Math.random() * mood.length);
                        el = mood[pos];
                        mood.slice(pos, 1);
                        inp = el.getByteArray();
                        file = moodPath + path.sep + index + ".png";
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, inp, true)];
                    case 11:
                        _b.sent();
                        _b.label = 12;
                    case 12:
                        index++;
                        return [3 /*break*/, 10];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    Pack.prototype.getCASItemsList = function () {
        var _this = this;
        if (!this.caspResource)
            return [];
        var caspFiles = this.caspResource.caspFiles;
        var items = new Map();
        for (var index = 0; index < caspFiles.length; index++) {
            var element = caspFiles[index];
            var propID = element.propID;
            var l = [];
            if (items.has(propID)) {
                l = items.get(propID);
            }
            l.push(element);
            items.set(propID, l);
        }
        var list = [];
        var keys = Array.from(items.keys());
        var _loop_1 = function (index) {
            var key = keys[index];
            var obj = items.get(key);
            var caspData = [];
            var data = undefined;
            var sharedName = "";
            obj.forEach(function (element) {
                if (data == undefined) {
                    data = {};
                    var cr = new CASPResource();
                    cr.addFile(element);
                    data.age = _this.setToStringList(cr.age);
                    data.gender = _this.setToStringList(cr.gender);
                    data.bodyType = _this.setToStringList(cr.bodyType);
                    data.casFlags = _this.setToStringList(cr.casFlags);
                    data.priSortOrder = _this.setToStringList(cr.priSortOrder);
                    data.tgi = _this.setToStringList(cr.tgi_list);
                    /*
                    data.bodyType=element.bodyType;
                    data.bodySubType=element.bodySubType;
                    data.ageGender=element.ageGender;
                    data.primSortIndex=element.primSortIndex;*/
                    sharedName = element.name;
                }
                else {
                    var cname = element.name;
                    for (var index_2 = 0; index_2 < Math.min(cname.length, sharedName.length); index_2++) {
                        var isSame = cname.charAt(index_2) == sharedName.charAt(index_2);
                        if (!isSame) {
                            sharedName = sharedName.substring(0, index_2);
                            index_2 = cname.length;
                        }
                    }
                }
                var robj = {
                    instanceID: element.instanceID,
                    name: element.name,
                    flagList: element.flagList,
                    secSortIndex: element.secSortIndex,
                    swatches: element.swatches,
                    lod: element.lodLevels,
                    regionMap: undefined,
                    diffuseMap: undefined
                };
                if (element.regionMapIndex >= 0 && element.regionMapIndex < element.TGIList.length) {
                    var regionMap = element.TGIList[element.regionMapIndex];
                    robj.regionMap = regionMap;
                }
                if (element.diffuseIndex >= 0 && element.diffuseIndex < element.TGIList.length) {
                    var diffuseMap = element.TGIList[element.diffuseIndex];
                    robj.diffuseMap = diffuseMap;
                }
                caspData.push(robj);
            });
            data.sharedName = sharedName;
            list.push({ "propID": key, "items": caspData, "data": data });
        };
        for (var index = 0; index < keys.length; index++) {
            _loop_1(index);
        }
        return list;
    };
    Pack.prototype.setToStringList = function (set) {
        var result = "";
        var isFirst = true;
        set.forEach(function (value) {
            if (isFirst) {
                result = value;
                isFirst = false;
            }
            else {
                result += ":" + value;
            }
        });
        return result;
    };
    Pack.prototype.addOrOverrideEntry = function (type, group, instance, buffer) {
        instance = instance.toLowerCase();
        this.removeEntry(type, group, instance);
        var _a = Helper.hexStringToHiLo(instance), hi = _a.hi, lo = _a.lo;
        var ne = new IndexEnty(this.file, type, group, hi, lo, 0, buffer.length, buffer.length, 0x0, 0x01);
        this.modified = true;
        ne.setBuffer(buffer);
        this.index_List.push(ne);
    };
    Pack.prototype.removeEntry = function (type, group, instance) {
        if (type == undefined && group == undefined && instance == undefined)
            return;
        for (var index = this.index_List.length - 1; index >= 0; index--) {
            var element = this.index_List[index];
            var con_type = (type == undefined || type == element.r_type);
            var con_group = (group == undefined || group == element.r_group);
            var con_instance = (instance == undefined || instance === Basic.getInstanceKey(element));
            if (con_type && con_group && con_instance) {
                this.index_List.splice(index, 1);
                this.modified = true;
            }
        }
    };
    Pack.prototype.removeEntryByKey = function (key) {
        for (var index = this.index_List.length - 1; index >= 0; index--) {
            var element = this.index_List[index];
            if (Basic.getStingKey(element) == key) {
                this.index_List.splice(index, 1);
                this.modified = true;
            }
        }
    };
    Pack.prototype.getStartBuffer = function () {
        try {
            this.fileID = fs.openSync(this.file);
            var buf = Buffer.alloc(0x60);
            fs.readSync(this.fileID, buf, 0, 0x60);
            fs.closeSync(this.fileID);
            return buf;
        }
        catch (err) {
            throw new Error("Unable to read Start Buffer");
        }
    };
    Pack.prototype.createEndBufferFromIndexList = function (indexList) {
        try {
            var bufferSize = 4 + indexList.length * 32; // Adjust the size based on your structure
            var buf = Buffer.alloc(bufferSize);
            var bb_1 = new ByteBuffer(buf);
            bb_1.pos = 4; // Start position
            indexList.forEach(function (entry) {
                bb_1.putInt(entry.r_type);
                bb_1.putInt(entry.r_group);
                bb_1.putInt(entry.i_hi);
                bb_1.putInt(entry.i_lo);
                bb_1.putInt(entry.chunckOffset);
                bb_1.putInt((entry.filesize & 0x0FFFFFFF) + 0x80000000);
                bb_1.putInt(entry.memsize);
                bb_1.putShort(entry.com);
                bb_1.putShort(entry.unknown);
            });
            return buf;
        }
        catch (err) {
            console.log(err);
            this.error = true;
            return null;
        }
    };
    Pack.prototype.createStartBuffer = function (index_Count, index_Size, index_Offset) {
        var buf = Buffer.alloc(0x60);
        var bb = new ByteBuffer(buf);
        bb.putInt(0x46504244);
        bb.putByte(0x2);
        bb.pos = 8;
        bb.putByte(1);
        bb.pos = 36;
        bb.putInt(index_Count);
        bb.pos = 44;
        bb.putInt(index_Size);
        bb.pos = 60;
        bb.putByte(0x03);
        bb.pos = 64;
        bb.putInt(index_Offset);
        return bb.array;
    };
    Pack.prototype.toBuffer = function () {
        var index_Count = this.index_List.length;
        var index_Size = 0; //How big is the end part
        var index_Offset = 0x60; //Were does the index part start (60+sizeof all item)
        var buffers = [];
        var index_List = [];
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            buffers.push(element.getByteArrayRaw());
            index_List.push(new IndexEnty(element.file, element.r_type, element.r_group, element.i_hi, element.i_lo, index_Offset, element.filesize, element.memsize, element.com, element.unknown));
            index_Offset = index_Offset + element.filesize;
        }
        var endBuffer = this.createEndBufferFromIndexList(index_List);
        index_Size = endBuffer.length;
        var startBuffer = this.createStartBuffer(index_Count, index_Size, index_Offset);
        buffers.push(endBuffer);
        buffers.unshift(startBuffer);
        return Buffer.concat(buffers);
    };
    Pack.prototype.saveToFile = function (filePath) {
        fs.writeFileSync(filePath, this.toBuffer());
    };
    Pack.prototype.getS4SMergedManifest = function () {
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.S4SMM) {
                var s4smmfile = new S4SMMFile(element);
                if (s4smmfile.error)
                    throw new Error("Failed to read mainifest: " + s4smmfile.error);
                return s4smmfile.toObj();
            }
        }
        throw new Error("No manifest found!");
    };
    Pack.prototype.getS4SMergedManifestComplete = function () {
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.S4SMM) {
                var s4smmfile = new S4SMMFile(element);
                if (s4smmfile.error)
                    throw new Error("Failed to read mainifest: " + s4smmfile.error);
                return s4smmfile;
            }
        }
        throw new Error("No manifest found!");
    };
    Pack.prototype.getFilteredIndexEntries = function (type) {
        return this.index_List.filter(function (value) { return value.r_type == type; });
    };
    Pack.prototype.getCOBJModels = function (tmpImageFolderPath) {
        return __awaiter(this, void 0, void 0, function () {
            var cobjEntries, objdEntries, instanceGroups, buildBuyFileGroups, modelsMap, stblEntries, infoStringsMap, keys, values, items, _loop_2, index;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.cobjResource)
                            this.calulateCOBJFiles();
                        if (!this.cobjResource)
                            return [2 /*return*/, undefined];
                        cobjEntries = this.getFilteredIndexEntries(0x319E4F1D);
                        objdEntries = this.getFilteredIndexEntries(0xC0DB5AE7);
                        instanceGroups = new Map();
                        cobjEntries.forEach(function (value) {
                            var instance = Basic.getInstanceKey(value);
                            var items = instanceGroups.get(instance);
                            if (!items) {
                                items = { cobj: undefined, objd: undefined };
                            }
                            items.cobj = value;
                            instanceGroups.set(instance, items);
                        });
                        objdEntries.forEach(function (value) {
                            var instance = Basic.getInstanceKey(value);
                            var items = instanceGroups.get(instance);
                            if (!items) {
                                items = { cobj: undefined, objd: undefined };
                            }
                            items.objd = value;
                            instanceGroups.set(instance, items);
                        });
                        buildBuyFileGroups = Array.from(instanceGroups.values());
                        buildBuyFileGroups.filter(function (value) {
                            return value.cobj != undefined && value.objd != undefined;
                        });
                        modelsMap = new Map();
                        buildBuyFileGroups.forEach(function (value) {
                            var objd = value.objd;
                            var objdFile = new OBJDFile(objd.getByteArray());
                            if (objdFile.model) {
                                objdFile.model.forEach(function (valueTGI) {
                                    var modelKey = Basic.tgiToKey(valueTGI);
                                    var modelEntry = _this.getEntryIfExistsByKey(modelKey);
                                    if (modelEntry != undefined) {
                                        var items_1 = modelsMap.get(modelEntry);
                                        if (!items_1)
                                            items_1 = [];
                                        items_1.push(value);
                                        modelsMap.set(modelEntry, items_1);
                                    }
                                    else {
                                        console.log("Model not found: " + modelKey);
                                    }
                                });
                            }
                        });
                        stblEntries = this.getFilteredIndexEntries(0x220557DA);
                        infoStringsMap = new Map();
                        stblEntries.forEach(function (entrie) {
                            if (entrie.i_hi != 0)
                                return;
                            var stblFile = new STBLFile(entrie.getByteArray());
                            var entries = stblFile.entries;
                            entries.forEach(function (value) {
                                var key = value.key;
                                var text = value.value;
                                infoStringsMap.set(key, text);
                            });
                        });
                        keys = Array.from(modelsMap.keys());
                        values = Array.from(modelsMap.values());
                        items = [];
                        _loop_2 = function (index) {
                            var key, value, modelFile, meshes, texturesAll, textures, textureEntries, order, internalTextures, texturePaths, index_3, element, inp, dst, ddsBuffer, key_1, file, nb, cobjs, firstName, firstDescription, texturesArray, swatches, index_4, element, cobjObject;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        key = keys[index];
                                        value = values[index];
                                        modelFile = new GenericRCOLFile(key.getByteArray());
                                        meshes = modelFile.getMeshTesting();
                                        texturesAll = modelFile.getTextures();
                                        textures = new Map();
                                        textureEntries = new Set();
                                        order = 0;
                                        texturesAll.forEach(function (value) {
                                            var key = Basic.tgiToKey(value);
                                            var entry = _this.getEntryIfExistsByKey(key);
                                            if (entry != undefined) {
                                                textureEntries.add(entry);
                                            }
                                            if (!textures.has(key)) {
                                                textures.set(key, { key: key, internal: entry != undefined, order: order });
                                                order++;
                                            }
                                        });
                                        internalTextures = Array.from(textureEntries);
                                        texturePaths = [];
                                        if (!tmpImageFolderPath) return [3 /*break*/, 4];
                                        index_3 = 0;
                                        _b.label = 1;
                                    case 1:
                                        if (!(index_3 < internalTextures.length)) return [3 /*break*/, 4];
                                        element = internalTextures[index_3];
                                        inp = element.getByteArray();
                                        dst = new DSTResource(inp);
                                        ddsBuffer = dst.toDDSBuffer();
                                        key_1 = element.getKey();
                                        file = tmpImageFolderPath + path.sep + key_1 + ".png";
                                        return [4 /*yield*/, DDSConverter.ddsBufferToPngBuffer(ddsBuffer)];
                                    case 2:
                                        nb = _b.sent();
                                        if (nb)
                                            fs.writeFileSync(file, nb);
                                        if (fs.existsSync(file)) {
                                            texturePaths.push({ key: key_1, path: file });
                                        }
                                        _b.label = 3;
                                    case 3:
                                        index_3++;
                                        return [3 /*break*/, 1];
                                    case 4:
                                        cobjs = [];
                                        firstName = undefined;
                                        firstDescription = undefined;
                                        value.forEach(function (value) {
                                            var cobj = value.cobj;
                                            var cobjFile = new COBJFile(cobj.getByteArray(), cobj.r_type);
                                            var simpleData = cobjFile.getSimpleData();
                                            simpleData.name = "UNKNOWN";
                                            simpleData.description = "-";
                                            simpleData.instanceID = Basic.getInstanceKey(cobj);
                                            if (cobjFile.nameHash && infoStringsMap.has(cobjFile.nameHash)) {
                                                simpleData.name = infoStringsMap.get(cobjFile.nameHash);
                                                if (firstName == undefined)
                                                    firstName = simpleData.name;
                                            }
                                            if (cobjFile.descriptionHash && infoStringsMap.has(cobjFile.descriptionHash)) {
                                                simpleData.description = infoStringsMap.get(cobjFile.descriptionHash);
                                                if (firstDescription == undefined)
                                                    firstDescription = simpleData.description;
                                            }
                                            cobjs.push(simpleData);
                                        });
                                        texturesArray = Array.from(textures.values());
                                        swatches = [];
                                        for (index_4 = 0; index_4 < texturesArray.length; index_4++) {
                                            element = texturesArray[index_4];
                                            if (element.internal) {
                                                swatches.push({
                                                    textureKey: element.key,
                                                    isInternal: element.internal,
                                                    order: element.order,
                                                    colors: [0, 0, 0],
                                                    cobjKey: undefined
                                                });
                                            }
                                        }
                                        cobjObject = {
                                            meshes: meshes,
                                            name: firstName ? firstName : "UNKNOWN",
                                            desciption: firstDescription ? firstDescription : "-",
                                            texturesPaths: texturePaths,
                                            textures: texturesArray,
                                            cobjs: cobjs,
                                            swatches: swatches
                                        };
                                        items.push(cobjObject);
                                        return [2 /*return*/];
                                }
                            });
                        };
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < keys.length)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_2(index)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, items];
                }
            });
        });
    };
    return Pack;
}());
exports.Pack = Pack;
var COBJPack = /** @class */ (function () {
    function COBJPack(p) {
        this.pack = p;
    }
    COBJPack.prototype.getModelFileGroups = function () {
        var _this = this;
        //Get all relevant files
        //Instance Mapping
        var cobjFiles = new Map();
        var objdFiles = new Map();
        var mlodFiles = new Map();
        var stringValueHashes = new Map();
        //Key Mapping
        var modelFiles = new Map();
        var textureFiles = new Map();
        this.pack.index_List.forEach(function (value) {
            var instance = Basic.getInstanceKey(value);
            var key = value.getKey();
            if (value.r_type == 0x319E4F1D) { //COBJ
                var cobj = new COBJFile(value.getByteArray(), value.r_type);
                cobjFiles.set(instance, cobj);
            }
            else if (value.r_type == 0xC0DB5AE7) { //OBJD
                var objd = new OBJDFile(value.getByteArray());
                objdFiles.set(instance, objd);
            }
            else if (value.r_type == 0x01661233) { //MODL
                var model = new GenericRCOLFile(value.getByteArray());
                modelFiles.set(key, model);
            }
            else if (value.r_type == 0x01D10F34) { //MLOD
                var mlod = new GenericRCOLFile(value.getByteArray());
                var items_2 = mlodFiles.get(instance);
                if (!items_2)
                    items_2 = [];
                items_2.push(mlod);
                mlodFiles.set(instance, items_2);
            }
            else if (value.r_type == 0x00B2D882) { //_IMG
                textureFiles.set(key, value);
            }
            else if (value.r_type == 0x220557DA) { //STBL
                var stblFile = new STBLFile(value.getByteArray());
                stblFile.entries.forEach(function (entry) {
                    stringValueHashes.set(entry.key, entry.value);
                });
            }
        });
        //Find pairs
        var modelGroups = new Map();
        cobjFiles.forEach(function (cobj, key) {
            var objd = objdFiles.get(key);
            if (!objd)
                return;
            cobj.instanceID = key;
            var pair = { cobj: cobj, objd: objd };
            var modelKeys = objd.model;
            if (!modelKeys || modelKeys.length == 0)
                return;
            var modelTGIKey = Basic.tgiToKey(modelKeys[0]);
            var model = modelFiles.get(modelTGIKey);
            if (!model)
                return;
            var mg = modelGroups.get(modelTGIKey);
            if (mg) {
                //Update
                mg.infoPairs.push(pair);
            }
            else {
                //insert
                var mlods = mlodFiles.get(modelTGIKey.split("-")[2]);
                if (!mlods)
                    mlods = [];
                mg = new ModelGroup(_this.pack, model, mlods, [pair]);
                //Set Info
                var loadedName = stringValueHashes.get(cobj.nameHash);
                var loadedDescription = stringValueHashes.get(cobj.descriptionHash);
                var name_6 = loadedName ? loadedName : "UNKNOWN";
                var description = loadedDescription ? loadedDescription : "-";
                mg.setInfo(name_6, description);
            }
            modelGroups.set(modelTGIKey, mg);
        });
        var items = [];
        modelGroups.forEach(function (value, key) {
            value.processData();
            items.push(value.getInfoObject());
        });
        return items;
    };
    return COBJPack;
}());
exports.COBJPack = COBJPack;
var ModelGroup = /** @class */ (function () {
    function ModelGroup(pack, model, mlods, infoPairs) {
        this.mainMlod = undefined;
        this.infoPairs = [];
        this.useModelNotLods = false;
        this.swatches = [];
        this.name = "";
        this.description = "";
        this.fullMeshes = [];
        this.pack = pack;
        this.model = model;
        this.mlods = mlods;
        this.infoPairs = infoPairs;
    }
    ModelGroup.prototype.setInfo = function (name, description) {
        this.name = name;
        this.description = description;
    };
    ModelGroup.prototype.processData = function () {
        this.findMainMLod();
        this.prepareSwaches();
        this.prepareMeshes();
    };
    ModelGroup.prototype.retryWithModelNotMLod = function () {
        this.useModelNotLods = true;
        this.mainMlod = this.model;
        this.prepareSwaches();
        this.prepareMeshes();
    };
    ModelGroup.prototype.findMainMLod = function () {
        var _this = this;
        //Find biggest mlod
        this.mlods.forEach(function (value) {
            if (!value || !value.buffer)
                return;
            var size = value.buffer.length;
            if (_this.mainMlod == undefined || (_this.mainMlod.buffer && size > _this.mainMlod.buffer.length)) {
                _this.mainMlod = value;
            }
        });
        if (this.mainMlod == undefined) {
            this.useModelNotLods = true;
            this.mainMlod = this.model;
        }
    };
    ModelGroup.prototype.prepareSwaches = function () {
        var _this = this;
        this.swatches = [];
        if (!this.mainMlod)
            return;
        //Find MTST & MATDs
        var blocklist = this.mainMlod.blockList;
        if (!blocklist)
            return;
        var chunkEntries = blocklist.chunkEntries;
        if (!chunkEntries)
            return;
        var mtstFile = undefined;
        var matdIndexMap = new Map();
        for (var index = 0; index < chunkEntries.length; index++) {
            var chunkEntrie = chunkEntries[index];
            if (chunkEntrie.file && chunkEntrie.file instanceof MTSTFile) {
                if (mtstFile) {
                    console.log("Multiple MTST Files found");
                }
                else {
                    mtstFile = chunkEntrie.file;
                }
            }
            else if (chunkEntrie.file && chunkEntrie.file instanceof MATDFile) {
                var matd = chunkEntrie.file;
                matdIndexMap.set(index, matd);
            }
        }
        if (!mtstFile) {
            console.log("No MTST File found");
            if (!this.useModelNotLods) {
                console.log("Retry with Model/Switching to Model");
                this.retryWithModelNotMLod();
            }
            return;
        }
        var matdFiles = new Map();
        mtstFile.entries.forEach(function (value) {
            if (value.materialState != 0)
                return;
            var index = value.index;
            var materialVariant = value.materialVariant;
            var matd = matdIndexMap.get(index);
            if (!matd)
                return;
            matdFiles.set(materialVariant, matd);
        });
        this.infoPairs.forEach(function (value) {
            var cobj = value.cobj;
            var objd = value.objd;
            var colors = cobj.colors;
            if (colors.length == 0)
                colors.push(0);
            var materialNameHash = objd.materialVariantHash;
            var matd = matdFiles.get(materialNameHash);
            if (!matd)
                return;
            var diffuseTexture = matd.getDiffuseTexture();
            if (!diffuseTexture)
                return;
            var swatch = {
                textureKey: Basic.tgiToKey(diffuseTexture),
                colors: colors,
                instance: cobj.instanceID,
                materialVariant: materialNameHash
            };
            _this.swatches.push(swatch);
            //console.log(materialNameHash);
        });
        //console.log(this.swatches);
    };
    ModelGroup.prototype.prepareMeshes = function () {
        var _this = this;
        if (!this.mainMlod)
            return;
        var mLodFile = undefined;
        var blocklist = this.mainMlod.blockList;
        if (!blocklist)
            return;
        var chunkEntries = blocklist.chunkEntries;
        if (!chunkEntries)
            return;
        var indexOffest = 0;
        for (var index = 0; index < chunkEntries.length; index++) {
            var chunkEntrie = chunkEntries[index];
            if (chunkEntrie.file && chunkEntrie.file instanceof MLODFile) {
                if (!mLodFile) {
                    mLodFile = chunkEntrie.file;
                    indexOffest = chunkEntrie.index;
                }
                else {
                    console.log("Multiple MLOD Files found");
                }
            }
        }
        if (!mLodFile)
            return;
        var meshInfos = mLodFile.meshInfos;
        meshInfos.forEach(function (meshInfo) {
            var m = meshInfo.materialIndexSplit;
            var vf = meshInfo.vertexFormatIndexSplit;
            var vb = meshInfo.vertexBufferIndexSplit;
            var ib = meshInfo.indexBufferIndexSplit;
            if (!m || !vf || !vb || !ib) {
                console.log("Missing Mesh Data [Info] (m,vf,vb,ib)");
                return;
            }
            var mChunk = chunkEntries[m.index + indexOffest];
            var vfChunk = chunkEntries[vf.index + indexOffest];
            var vbChunk = chunkEntries[vb.index + indexOffest];
            var ibChunk = chunkEntries[ib.index + indexOffest];
            if (!mChunk || !vfChunk || !vbChunk || !ibChunk) {
                console.log("Missing Mesh Data [Chunk] (m,vf,vb,ib)");
            }
            //Check if correct
            var isMaterialInfo = mChunk.file && mChunk.file instanceof MTSTFile;
            if (!isMaterialInfo) {
                console.log("Material info Info not found");
                /*console.log({
                    mIndex:m.index,
                    mChunk:mChunk,
                    mLodFile:mLodFile
                });
                console.log("");*/
                return;
            }
            var isVertexFormat = vfChunk.file && vfChunk.file instanceof VRTFFile;
            if (!isVertexFormat) {
                console.log("Vertex Format Info not found");
                return;
            }
            var isVertexBuffer = vbChunk.file && vbChunk.file instanceof VBUFFile;
            if (!isVertexBuffer) {
                console.log("Vertex Buffer Info not found");
                return;
            }
            var isIndexBuffer = ibChunk.file && ibChunk.file instanceof IBUFFile;
            if (!isIndexBuffer) {
                console.log("Index Buffer Info not found");
                return;
            }
            //Create Mesh
            var mFile = mChunk.file;
            var vfFile = vfChunk.file;
            var vbFile = vbChunk.file;
            var ibFile = ibChunk.file;
            var vertex = vbFile.getVertices(vfFile);
            var faces = ibFile.getFaces();
            //Accectable Material Variants
            var mvSet = new Set();
            mFile.entries.forEach(function (value) {
                if (value.materialState == 0) {
                    mvSet.add(value.materialVariant);
                }
            });
            var mvArray = Array.from(mvSet);
            //Combine Data
            var obj = {
                faces: faces,
                vertex: vertex,
                materialVariants: mvArray,
                name: meshInfo.name
            };
            _this.fullMeshes.push(obj);
        });
    };
    ModelGroup.prototype.getInfoObject = function () {
        var obj = {
            name: this.name,
            description: this.description,
            swatches: this.swatches,
            meshes: this.fullMeshes,
            cobjs: this.infoPairs.map(function (value) { return value.cobj.getSimpleData(); })
        };
        return obj;
    };
    return ModelGroup;
}());
exports.ModelGroup = ModelGroup;
var SaveFile = /** @class */ (function () {
    function SaveFile(file) {
        this.fileID = 0;
        this.save_data = undefined;
        this.inoId = -1;
        this.file = file;
        this.error = false;
        this.index_Count = 0;
        this.index_Offset = 0;
        this.index_Size = 0;
        this.index_List = [];
    }
    SaveFile.prototype.checkFile = function () {
        try {
            this.fileID = fs.openSync(this.file);
            var buf = Buffer.alloc(0x60);
            fs.readSync(this.fileID, buf, 0, 0x60);
            fs.closeSync(this.fileID);
            var bb = new ByteBuffer(buf);
            if (bb.getInt() != 0x46504244) {
                this.error = true;
                return;
            }
            bb.pos = 0x24;
            this.index_Count = bb.getInt();
            bb.pos = 0x2c;
            this.index_Size = bb.getInt();
            bb.pos = 0x40;
            this.index_Offset = bb.getInt();
        }
        catch (err) {
            this.error = true;
        }
    };
    SaveFile.prototype.calculateIndexList = function () {
        try {
            this.index_List = [];
            var buf = Buffer.alloc(this.index_Size);
            this.fileID = fs.openSync(this.file);
            fs.readSync(this.fileID, buf, 0, buf.length, this.index_Offset);
            fs.closeSync(this.fileID);
            var bb = new ByteBuffer(buf);
            var type = bb.getInt();
            if (type == 0x02)
                bb.pos = bb.pos + 4;
            for (var index = 0; index < this.index_Count; index++) {
                var r_type = 0;
                var r_group = 0;
                var i_hi = 0;
                var i_lo = 0;
                var chunckOffset = 0;
                var filesize = 0;
                var memsize = 0;
                var com = 0;
                var unknown = 0;
                if (type == 0x00) {
                    r_type = bb.getInt();
                    r_group = bb.getInt();
                    i_hi = bb.getInt();
                    i_lo = bb.getInt();
                    chunckOffset = bb.getInt();
                    filesize = bb.getInt();
                    memsize = bb.getInt();
                    com = bb.getShort();
                    unknown = bb.getShort();
                }
                else {
                    r_type = bb.getInt();
                    r_group = 0;
                    i_hi = bb.getInt();
                    i_lo = bb.getInt();
                    chunckOffset = bb.getInt();
                    filesize = bb.getInt();
                    memsize = bb.getInt();
                    com = bb.getShort();
                    unknown = bb.getShort();
                }
                var entry = new IndexEnty(this.file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown);
                if (r_type < 0)
                    this.error = true;
                this.index_List.push(entry);
                if (r_type == 0x0D)
                    this.save_data = entry;
            }
        }
        catch (err) {
            console.log(err);
            this.error = true;
        }
    };
    SaveFile.prototype.exportSaveSlotThumnails = function (folder, slotNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var index, element, inp, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < this.index_List.length)) return [3 /*break*/, 4];
                        element = this.index_List[index];
                        if (!(element.r_type == 0x14)) return [3 /*break*/, 3];
                        inp = element.getByteArray();
                        file = path.join(folder, "savefile_thumbnail_" + slotNumber.toString(16) + ".png");
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, inp, true)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, file];
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, ""];
                }
            });
        });
    };
    SaveFile.prototype.hasExtraImages = function () {
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.r_type == 0x0F || element.r_type == 0xe88db35f) {
                return true;
            }
        }
        return false;
    };
    SaveFile.prototype.exportAllImages = function (folder) {
        return __awaiter(this, void 0, void 0, function () {
            var t_e88db35f, t_0000000f, index, element, inp, key, file, complex;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        t_e88db35f = [];
                        t_0000000f = [];
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < this.index_List.length)) return [3 /*break*/, 4];
                        element = this.index_List[index];
                        if (!(element.r_type == 0x0F || element.r_type == 0xe88db35f)) return [3 /*break*/, 3];
                        inp = element.getByteArray();
                        key = Basic.getStingKey(element);
                        file = path.join(folder, key + ".png");
                        complex = element.r_type == 0xe88db35f ? false : true;
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, inp, complex)];
                    case 2:
                        _a.sent();
                        if (fs.existsSync(file)) {
                            switch (element.r_type) {
                                case 0xe88db35f:
                                    t_e88db35f.push(file);
                                    break;
                                case 0x0f:
                                    t_0000000f.push(file);
                                    break;
                            }
                        }
                        _a.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, {
                            t_e88db35f: t_e88db35f,
                            t_0000000f: t_0000000f
                        }];
                }
            });
        });
    };
    SaveFile.prototype.getSimsCC = function () {
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.r_type == 0xD) {
                var inp = element.getByteArray();
                return SimsPatterns.searchSimsCC(new ByteBuffer(inp));
            }
        }
        return undefined;
    };
    SaveFile.prototype.getHouseholds = function () {
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.r_type == 0xD) {
                var inp = element.getByteArray();
                return SimsPatterns.searchHouseHold(new ByteBuffer(inp));
            }
        }
        return undefined;
    };
    SaveFile.prototype.getHouseHoldThumbnails = function (hhList, localCache, imagefolder, gameImageFolder, gamefiles) {
        return __awaiter(this, void 0, void 0, function () {
            var hhInstancesSet, index, hhInstancesMap, pack, indexList, index, element, key, compObj, imageMap, keys, index, key, element, file, index, element, key, hhInstancesSet, hhInstancesMap, imageMap, index, element, instanceArr, index, key, file, gp, gameFile, pack, indexList, index, element, key, compObj, keys, index, key, element, file, index, element, key, thum;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!hhList || hhList.length == 0)
                            return [2 /*return*/, hhList];
                        if (!fs.existsSync(imagefolder)) {
                            console.log("No Image Folder for cache images");
                            return [2 /*return*/, hhList];
                        }
                        if (!fs.existsSync(localCache)) return [3 /*break*/, 5];
                        hhInstancesSet = new Set();
                        for (index = 0; index < hhList.length; index++) {
                            hhInstancesSet.add(hhList[index].householdInstance);
                        }
                        hhInstancesMap = new Map();
                        pack = new Pack(localCache);
                        pack.checkFile();
                        pack.calculateIndexList();
                        indexList = pack.index_List;
                        for (index = 0; index < indexList.length; index++) {
                            element = indexList[index];
                            key = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                            if (element.r_type == 0x3BD45407 && hhInstancesSet.has(key)) {
                                compObj = hhInstancesMap.get(key);
                                if (element.r_group.toString(16).endsWith("2")) {
                                    hhInstancesMap.set(key, element);
                                    hhInstancesSet.delete(key);
                                }
                                else if (compObj && element.filesize < compObj.filesize) {
                                    //nix
                                }
                                else {
                                    hhInstancesMap.set(key, element);
                                }
                            }
                        }
                        imageMap = new Map();
                        keys = Array.from(hhInstancesMap.keys());
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < keys.length)) return [3 /*break*/, 4];
                        key = keys[index];
                        element = hhInstancesMap.get(key);
                        file = path.join(imagefolder, "hhi_" + key + ".png");
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, element.getByteArray(), true)];
                    case 2:
                        _a.sent();
                        if (fs.existsSync(file)) {
                            imageMap.set(key, file);
                        }
                        _a.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4:
                        for (index = 0; index < hhList.length; index++) {
                            element = hhList[index];
                            key = element.householdInstance;
                            element.thumbnail = imageMap.get(key);
                        }
                        _a.label = 5;
                    case 5:
                        if (!(gamefiles && fs.existsSync(gameImageFolder) && gamefiles.length > 0)) return [3 /*break*/, 10];
                        hhInstancesSet = new Set();
                        hhInstancesMap = new Map();
                        imageMap = new Map();
                        for (index = 0; index < hhList.length; index++) {
                            element = hhList[index];
                            if (!element.thumbnail && element.gameId)
                                hhInstancesSet.add(element.gameId);
                        }
                        instanceArr = Array.from(hhInstancesSet.keys());
                        for (index = 0; index < instanceArr.length; index++) {
                            key = instanceArr[index];
                            file = path.join(gameImageFolder, "hhi_" + key + ".png");
                            if (fs.existsSync(file)) {
                                imageMap.set(key, file);
                                hhInstancesSet.delete(key);
                            }
                        }
                        //Search in file
                        if (hhInstancesSet.size > 0) {
                            for (gp = 0; gp < gamefiles.length; gp++) {
                                gameFile = gamefiles[gp];
                                try {
                                    pack = new Pack(gameFile);
                                    pack.checkFile();
                                    pack.calculateIndexList();
                                    indexList = pack.index_List;
                                    for (index = 0; index < indexList.length; index++) {
                                        element = indexList[index];
                                        key = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                                        if (element.r_type == 0x3BD45407 && hhInstancesSet.has(key)) {
                                            compObj = hhInstancesMap.get(key);
                                            if (element.r_group.toString(16).endsWith("2")) {
                                                hhInstancesMap.set(key, element);
                                                hhInstancesSet.delete(key);
                                            }
                                            else if (compObj && element.filesize < compObj.filesize) {
                                                //nix
                                            }
                                            else {
                                                hhInstancesMap.set(key, element);
                                            }
                                        }
                                    }
                                }
                                catch (error) {
                                    console.log(error);
                                }
                            }
                        }
                        keys = Array.from(hhInstancesMap.keys());
                        index = 0;
                        _a.label = 6;
                    case 6:
                        if (!(index < keys.length)) return [3 /*break*/, 9];
                        key = keys[index];
                        element = hhInstancesMap.get(key);
                        file = path.join(gameImageFolder, "hhi_" + key + ".png");
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, element.getByteArray(), true)];
                    case 7:
                        _a.sent();
                        if (fs.existsSync(file)) {
                            imageMap.set(key, file);
                        }
                        _a.label = 8;
                    case 8:
                        index++;
                        return [3 /*break*/, 6];
                    case 9:
                        for (index = 0; index < hhList.length; index++) {
                            element = hhList[index];
                            key = element.gameId;
                            if (!key)
                                continue;
                            thum = imageMap.get(key);
                            if (!element.thumbnail && thum)
                                element.thumbnail = thum;
                            //This will not work since old version with a thumbnail will be null
                        }
                        _a.label = 10;
                    case 10: return [2 /*return*/, hhList];
                }
            });
        });
    };
    SaveFile.prototype.expandHouseholdsWithZoneInfo = function (hhList) {
        var zoneids = new Set();
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.type == TagType.ZONEOBJ && element.memsize > 160)
                zoneids.add(Basic.getInstanceKey(element));
        }
        for (var index = 0; index < hhList.length; index++) {
            var element = hhList[index];
            if (element.lot) {
                element.hasLot = zoneids.has(element.lot);
            }
            else {
                element.hasLot = false;
            }
        }
        return hhList;
    };
    SaveFile.prototype.getSaveName = function () {
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            if (element.r_type == 0xD) {
                var inp = element.getByteArray();
                return SimsPatterns.searchSaveName(new ByteBuffer(inp));
            }
        }
        console.log("No 0xD File in save?");
        return undefined;
    };
    SaveFile.groupFiles = function (folder) {
        var data = [];
        if (!fs.existsSync(folder))
            return data;
        var files = fs.readdirSync(folder);
        var map = new Map();
        for (var index = 0; index < files.length; index++) {
            var element = files[index];
            if (element.includes(".")) {
                var baseFilename = element.split(".")[0];
                if (baseFilename.startsWith("Slot_") && baseFilename.length == 13) {
                    var file = path.join(folder, element);
                    var stats = fs.statSync(file);
                    var fileObj = {
                        filename: element,
                        path: file,
                        size: stats.size,
                        atimeMs: stats.atimeMs,
                        mtimeMs: stats.mtimeMs,
                        ctimeMs: stats.ctimeMs,
                        ino: stats.ino,
                        isMain: element.endsWith(".save")
                    };
                    var arr = [];
                    if (map.has(baseFilename)) {
                        arr = map.get(baseFilename);
                    }
                    arr.push(fileObj);
                    map.set(baseFilename, arr);
                }
            }
        }
        var keys = Array.from(map.keys());
        keys.forEach(function (key) {
            if (!key.includes("_"))
                return;
            var slotNumber = parseInt(key.split("_")[1], 16);
            var mainFile = undefined;
            var mainCTime = 0;
            var mainIno = -1;
            var files = map.get(key);
            for (var index = 0; index < files.length; index++) {
                var element = files[index];
                if (element.isMain == true) {
                    index = files.length;
                    mainFile = element.path,
                        mainCTime = element.ctimeMs;
                    mainIno = element.ino;
                }
            }
            if (!mainFile)
                return;
            data.push({
                slot: slotNumber,
                mainFile: mainFile,
                mainCTime: mainCTime,
                mainIno: mainIno,
                files: files
            });
        });
        data.sort(function (a, b) {
            return b.mainCTime - a.mainCTime;
        });
        return data;
    };
    SaveFile.prototype.getZoneObjByInstance = function (instance) {
        var item = undefined;
        for (var index = 0; index < this.index_List.length; index++) {
            var element = this.index_List[index];
            var key = Basic.getInstanceKey(element);
            if (element.type == TagType.ZONEOBJ && key == instance) {
                item = element;
                index = this.index_List.length;
            }
        }
        if (!item)
            return item;
        return new ZoneObjFile(item.getByteArray());
    };
    SaveFile.prototype.exportZoneThumbnail = function (instance, folder) {
        return __awaiter(this, void 0, void 0, function () {
            var images, index, element, itemInstance, filename, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        images = [];
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < this.index_List.length)) return [3 /*break*/, 4];
                        element = this.index_List[index];
                        //Not 0x10 0x13
                        if (!(element.r_type == 0x0f || element.r_type == 0x12)) {
                            return [3 /*break*/, 3];
                        }
                        itemInstance = Basic.getInstanceKey(element);
                        if (itemInstance != instance)
                            return [3 /*break*/, 3];
                        filename = element.r_type.toString(16).padStart(8, "0") + "-" + itemInstance + ".png";
                        file = path.join(folder, filename);
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, element.getByteArray(), true)];
                    case 2:
                        _a.sent();
                        if (fs.existsSync(file)) {
                            images.push(file);
                        }
                        _a.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, images];
                }
            });
        });
    };
    SaveFile.prototype.exportZoneThumbnailAll = function (folder) {
        return __awaiter(this, void 0, void 0, function () {
            var images, index, element, itemInstance, filename, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        images = [];
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < this.index_List.length)) return [3 /*break*/, 4];
                        element = this.index_List[index];
                        //Not 0x10 0x13
                        if (!(element.r_type == 0x0f || element.r_type == 0x12)) {
                            return [3 /*break*/, 3];
                        }
                        itemInstance = Basic.getInstanceKey(element);
                        filename = element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + itemInstance + ".png";
                        file = path.join(folder, filename);
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, element.getByteArray(), true)];
                    case 2:
                        _a.sent();
                        if (fs.existsSync(file)) {
                            images.push({
                                zoneID: itemInstance,
                                file: file,
                                type: element.r_type
                            });
                        }
                        _a.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, images];
                }
            });
        });
    };
    SaveFile.prototype.getZones = function () {
        if (!this.save_data)
            return [];
        return SimsPatterns.serachZones(new ByteBuffer(this.save_data.getByteArray()));
    };
    return SaveFile;
}());
exports.SaveFile = SaveFile;
var IndexEnty = /** @class */ (function () {
    function IndexEnty(file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown) {
        this.file = file;
        this.r_type = r_type;
        this.r_group = r_group;
        this.i_hi = i_hi;
        this.i_lo = i_lo;
        this.chunckOffset = chunckOffset;
        this.filesize = filesize;
        this.memsize = memsize;
        this.com = com;
        this.unknown = unknown;
        this.type = TagType.NONE;
        this.calcType();
    }
    IndexEnty.prototype.calcType = function () {
        if (this.r_type == 0x034AEECB) {
            this.type = TagType.CASP;
        }
        else if (this.r_type == 1008398834 ||
            this.r_type == 221481530 ||
            this.r_type == 382531400 ||
            this.r_type == 1009419847 ||
            this.r_type == 1529359685 ||
            this.r_type == 2389771869 ||
            this.r_type == 2626836499 ||
            this.r_type == 2717855684 ||
            this.r_type == 3061216162 ||
            this.r_type == 3449676359 ||
            this.r_type == 3784093410 ||
            this.r_type == 3797200494) {
            this.type = TagType.THUM;
        }
        else if (this.r_type == 0x319E4F1D) {
            this.type = TagType.COBJ;
        }
        else if (this.r_type == 0x015A1849) {
            this.type = TagType.GEOM;
        }
        else if (this.r_type == 0x00B2D882) {
            this.type = TagType.IMG;
        }
        else if (this.r_type == 0x6B20C4F3) {
            this.type = TagType.CLIP;
        }
        else if (this.r_type == 0xBC4A5044) {
            this.type = TagType.CLHD;
        }
        else if (this.r_type == 0x7DF2169C) {
            this.type = TagType.XML;
        }
        else if (this.r_type == 0x3BD45407) {
            this.type = TagType.HHI;
        }
        else if (this.r_type == 0x56278554) {
            this.type = TagType.SGI;
        }
        else if (this.r_type == 0xd5f0f921) {
            this.type = TagType.CWAL;
        }
        else if (this.r_type == 0xb4f762c9) {
            this.type = TagType.CFLR;
        }
        else if (this.r_type == 0x01d0e75d) {
            this.type = TagType.MATD;
        }
        else if (this.r_type == 0x220557da) {
            this.type = TagType.STBL;
        }
        else if (this.r_type == 0x06) {
            this.type = TagType.ZONEOBJ;
        }
        else if (this.r_type == 0x7FB6AD8A) {
            this.type = TagType.S4SMM;
        }
        else if (this.r_type == 0xAA00AA00) {
            this.type = TagType.S4MMTHUM;
        }
        else if (this.r_type == 0xAC16FBEC) {
            this.type = TagType.RMAP;
        }
        else {
            this.type = TagType.OTHER;
        }
    };
    IndexEnty.prototype.print = function () {
        console.log("Type: " + this.type + " Type[value]: 0x" + this.r_type.toString(16) +
            " Group: 0x" + this.r_group.toString(16) +
            " Instance: 0x" + this.i_hi.toString(16) + this.i_lo.toString(16) +
            " Offset: 0x" + this.chunckOffset.toString(16) +
            " Filesize: 0x" + this.filesize.toString(16) +
            " Memsize: 0x" + this.memsize.toString(16) +
            " Compressed: 0x" + this.com.toString(16) +
            " Unknown: 0x" + this.unknown.toString(16));
    };
    IndexEnty.prototype.getByteArray = function () {
        var fileID = 0;
        try {
            fileID = fs.openSync(this.file);
            var buf = Buffer.alloc(this.memsize);
            fs.readSync(fileID, buf, 0, buf.length, this.chunckOffset);
            fs.closeSync(fileID);
            if (this.com == 0) {
                return buf;
            }
            else {
                var bb = new ByteBuffer(buf);
                var h0 = bb.getByte();
                var h1 = bb.getByte();
                var isSimple = true;
                if (h0 == 0x78) {
                    isSimple = true;
                }
                else if (h1 == 0xFB) {
                    isSimple = false;
                }
                else {
                    throw new Error("Unknown compression");
                }
                if (isSimple) {
                    var inflated = zlib.inflateSync(buf);
                    return inflated;
                }
                else {
                    //Old
                    return CompressUtil.decompressOld(buf, h0);
                }
            }
        }
        catch (err) {
            console.log(err);
            //console.log("Hallo -> " + this.file);
            //fs.closeSync(fileID);
            return Buffer.alloc(0);
        }
    };
    IndexEnty.prototype.getByteArrayRaw = function () {
        if (this.buf)
            return this.buf;
        var fileID = 0;
        try {
            fileID = fs.openSync(this.file);
            var buf = Buffer.alloc(this.filesize);
            fs.readSync(fileID, buf, 0, buf.length, this.chunckOffset);
            fs.closeSync(fileID);
            return buf;
        }
        catch (err) {
            console.log(err);
            return Buffer.alloc(0);
        }
    };
    IndexEnty.prototype.getKey = function () {
        return Basic.getStingKey(this);
    };
    IndexEnty.prototype.getInstanceString = function () {
        return Basic.getInstanceKey(this);
    };
    IndexEnty.prototype.setBuffer = function (buf) {
        this.buf = buf;
    };
    return IndexEnty;
}());
exports.IndexEnty = IndexEnty;
var TrayFiles = /** @class */ (function () {
    function TrayFiles(file) {
        this.buffer = undefined;
        this.householdname = "";
        this.instanceMap = new Map();
        this.file = file;
        CASPMapper.calcAll();
    }
    TrayFiles.prototype.prepareBuffer = function () {
        var readBuffer = fs.readFileSync(this.file);
        this.buffer = new ByteBuffer(readBuffer);
    };
    TrayFiles.prototype.searchSimsCC = function () {
        if (!this.buffer)
            this.prepareBuffer();
        if (!this.buffer)
            return;
        return SimsPatterns.searchSimsCC(this.buffer);
        /*
        //Get Sims
        this.buffer.pos = 0;
        let sims =  SimsPatterns.simNamePattern(this.buffer);

        //Get Sims CC
        for (let index = 0; index < sims.length; index++) {
            const sim = sims[index];
            let startOffest = sim.firstName.length+sim.lastName.length+12;
            let instances = SimsPatterns.casCCPattern(this.buffer, sim.start+startOffest, sim.end);
            sim.instances = instances;
        }

        return sims;*/
    };
    TrayFiles.getDetailedFileGroup = function (folder, localCache, tmpFolder) {
        return __awaiter(this, void 0, void 0, function () {
            var data, fileGroups, index, element, expanded;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        data = [];
                        if (!folder || !fs.existsSync(folder))
                            return [2 /*return*/, data];
                        fileGroups = this.groupFiles(folder);
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < fileGroups.length)) return [3 /*break*/, 4];
                        element = fileGroups[index];
                        return [4 /*yield*/, this.expandFileGroup(element, localCache, tmpFolder)];
                    case 2:
                        expanded = _a.sent();
                        if (expanded)
                            data.push(expanded);
                        _a.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, data];
                }
            });
        });
    };
    TrayFiles.expandFileGroup = function (files, localCache, tmpFolder) {
        return __awaiter(this, void 0, void 0, function () {
            var name, creator, description, thumbnail, mainFile, type, hhiFile, trayItem, blueprintFile, householdBinary, room, index, element, item, obj;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        name = undefined;
                        creator = undefined;
                        description = undefined;
                        thumbnail = undefined;
                        mainFile = files[0];
                        type = 0;
                        hhiFile = undefined;
                        trayItem = undefined;
                        blueprintFile = undefined;
                        householdBinary = undefined;
                        room = undefined;
                        for (index = 0; index < files.length; index++) {
                            element = files[index];
                            if (element.filename.endsWith(".room"))
                                room = element.filepath;
                            if (element.filename.endsWith(".blueprint"))
                                blueprintFile = element.filepath;
                            if (element.filename.endsWith(".householdbinary"))
                                householdBinary = element.filepath;
                            if (element.filename.endsWith(".trayitem"))
                                trayItem = element.filepath;
                            if (element.filename.endsWith(".hhi"))
                                hhiFile = element.filename;
                        }
                        if (!(householdBinary && !blueprintFile && !room)) return [3 /*break*/, 2];
                        type = 1;
                        return [4 /*yield*/, this.checkCacheForHHI(hhiFile, localCache, tmpFolder)];
                    case 1:
                        //Look for Thumbnail
                        thumbnail = _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        if (!householdBinary && blueprintFile && !room) {
                            type = 2;
                        }
                        else if (!householdBinary && !blueprintFile && room) {
                            type = 3;
                        }
                        else {
                            type = -1;
                        }
                        _a.label = 3;
                    case 3:
                        item = this.checkTrayitemForName(trayItem, type);
                        if (item) {
                            name = item.name;
                            creator = item.creator;
                            description = item.description;
                        }
                        obj = {
                            files: files,
                            name: name,
                            creator: creator,
                            description: description,
                            thumbnail: thumbnail,
                            mainFile: mainFile,
                            type: type
                        };
                        return [2 /*return*/, obj];
                }
            });
        });
    };
    TrayFiles.checkTrayitemForName = function (filepath, type) {
        if (type == -1)
            return undefined;
        var name = undefined;
        var creator = undefined;
        var description = undefined;
        if (!filepath || !fs.existsSync(filepath))
            return undefined;
        try {
            var readBuffer = fs.readFileSync(filepath);
            var buffer = new ByteBuffer(readBuffer);
            buffer.pos = 0x26;
            if (type == 2)
                buffer.pos = 0x27;
            if (type == 3)
                buffer.pos = 0x27;
            //Read Name
            var decoder = new TextDecoder('utf-8');
            var hhnLength = buffer.readUnsignedLeb128();
            var nameBuffer = buffer.getSection(hhnLength);
            name = decoder.decode(nameBuffer);
            buffer.pos = buffer.pos + 1;
            //Description
            var descriptionLength = buffer.readUnsignedLeb128();
            if (descriptionLength > 0) {
                var descriptionBuffer = buffer.getSection(descriptionLength);
                description = decoder.decode(descriptionBuffer);
                if (type == 1)
                    buffer.pos += 1;
            }
            //Read Creator
            buffer.pos += 7;
            //buffer.pos+=7;
            //buffer.pos+=7;
            var creatorLength = buffer.readUnsignedLeb128();
            var creatorBuffer = buffer.getSection(creatorLength);
            creator = decoder.decode(creatorBuffer);
            var obj = {
                creator: creator,
                name: name,
                description: description
            };
            //console.log(obj);
            return obj;
        }
        catch (error) {
            console.log(error);
        }
        return undefined;
    };
    TrayFiles.checkCacheForHHI = function (filename, localCache, tmpFolder) {
        return __awaiter(this, void 0, void 0, function () {
            var image, keys, key, hhiEntry, hhiSize, pack, items, index, element, isHHI, groupMatch, inp, file, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        image = undefined;
                        if (!filename || !localCache || !fs.existsSync(localCache))
                            return [2 /*return*/, image];
                        keys = this.getFileKeys(filename);
                        if (!keys)
                            return [2 /*return*/, image];
                        key = keys.t0.substring(0, 6);
                        hhiEntry = undefined;
                        hhiSize = 0;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        pack = new Pack(localCache);
                        pack.checkFile();
                        pack.calculateIndexList();
                        items = pack.index_List;
                        for (index = 0; index < items.length; index++) {
                            element = items[index];
                            isHHI = element.r_type == 0x3bd45407;
                            groupMatch = element.r_group.toString(16).padStart(8, "0").startsWith(key);
                            if (isHHI && groupMatch && element.memsize > hhiSize) {
                                hhiSize = element.memsize;
                                hhiEntry = element;
                            }
                        }
                        if (!hhiEntry) return [3 /*break*/, 3];
                        inp = hhiEntry.getByteArray();
                        file = path.join(tmpFolder, filename.split(".")[0] + ".png");
                        return [4 /*yield*/, PackHandler.saveBufferToFile(file, inp, true)];
                    case 2:
                        _a.sent();
                        if (fs.existsSync(file))
                            return [2 /*return*/, file];
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.log(error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, image];
                }
            });
        });
    };
    TrayFiles.groupFiles = function (folder) {
        var _this = this;
        var data = [];
        if (!fs.existsSync(folder))
            return data;
        var files = fs.readdirSync(folder);
        //Get base tray file
        var trayFiles = [];
        var restFiles = [];
        files.forEach(function (filename) {
            if (filename.endsWith(".trayitem")) {
                trayFiles.push(filename);
            }
            else {
                restFiles.push(filename);
            }
        });
        //Bundle
        trayFiles.forEach(function (filename) {
            var keys = _this.getFileKeys(filename);
            if (!keys)
                return;
            var files = [];
            files.push(filename);
            for (var index = 0; index < restFiles.length; index++) {
                var element = restFiles[index];
                var restKeys = _this.getFileKeys(element);
                if (restKeys && restKeys.t2 == keys.t2 && restKeys.t3_num >= keys.t3_num) {
                    files.push(element);
                }
            }
            var filesWithDetails = [];
            for (var index = 0; index < files.length; index++) {
                var element = files[index];
                var filepath = path.join(folder, element);
                var stats = fs.statSync(filepath);
                var file = {
                    filename: element,
                    filepath: filepath,
                    stats: stats
                };
                filesWithDetails.push(file);
            }
            data.push(filesWithDetails);
        });
        return data;
    };
    TrayFiles.getFileKeys = function (filename) {
        if (!filename)
            return undefined;
        if (filename.charAt(10) != "!" || filename.charAt(29) != ".")
            return undefined;
        var t0 = filename.substring(2, 10);
        var t1 = filename.substring(13, 15);
        var t2 = filename.substring(15, 25);
        var t3 = filename.substring(25, 29);
        var t3_num = parseInt(t3, 16);
        return {
            t0: t0,
            t1: t1,
            t2: t2,
            t3: t3,
            t3_num: t3_num
        };
    };
    return TrayFiles;
}());
exports.TrayFiles = TrayFiles;
var SimsPatterns = /** @class */ (function () {
    function SimsPatterns() {
    }
    SimsPatterns.serachZones = function (buffer) {
        var items = [];
        buffer.pos = buffer.max - 20;
        var last = buffer.max;
        while (buffer.pos > 0) {
            var pos = buffer.pos;
            var b0 = buffer.array[pos] == 0x01; //0x01
            var b1 = buffer.array[pos + 1] == 0x09; //0x09
            var b3 = buffer.array[pos + 10] == 0x12; //0x12
            if (!b1 || !b3) {
                buffer.pos = pos - 1;
                continue;
            }
            //ZoneID
            buffer.pos = pos + 2;
            var zone_id = buffer.getLongStringAlt();
            //Name
            buffer.pos = pos + 11;
            var nameLength = buffer.readUnsignedLeb128();
            var nameBuffer = buffer.getSection(nameLength);
            var decoder = new TextDecoder('utf-8');
            var name_7 = decoder.decode(nameBuffer);
            //Description
            /*buffer.pos+=68;
            let desByte = buffer.getByte() == 0x72;
            let description = "";
            if(desByte){
                let desLength = buffer.readUnsignedLeb128();
                let desBuffer = buffer.getSection(desLength);
                const decoder = new TextDecoder('utf-8');
                description = decoder.decode(desBuffer);
            }*/
            var despos = buffer.pos;
            var description = undefined;
            while (despos < last && !description) {
                buffer.pos = despos;
                var startByte = buffer.getByte() == 0x72;
                if (!startByte) {
                    despos++;
                }
                else {
                    var desLength = buffer.readUnsignedLeb128();
                    var desBuffer = buffer.getSection(desLength);
                    var decoder_1 = new TextDecoder('utf-8');
                    var descriptionTmp = decoder_1.decode(desBuffer);
                    var checkByte = buffer.getByte();
                    despos++;
                    if (checkByte == 0x80) {
                        description = descriptionTmp;
                    }
                }
            }
            var item = {
                zone_id: zone_id,
                name: name_7,
                description: description
            };
            //&& zone_id.startsWith("04")
            if (zone_id) {
                last = pos;
                items.push(item);
                buffer.pos = pos - 5;
            }
            else {
                buffer.pos = 0;
            }
        }
        return items;
    };
    SimsPatterns.searchSaveName = function (buffer) {
        var result = undefined;
        buffer.pos + 4;
        while (buffer.pos < buffer.max) {
            var position = buffer.pos;
            var b1 = buffer.array[position];
            if (b1 != 0x58 && b1 != 0x61) {
                buffer.pos++;
                continue;
            }
            var runPos = buffer.pos - 2;
            while (runPos > 1) {
                var isPosibleStart = buffer.array[runPos - 2] == 0x4a;
                if (!isPosibleStart) {
                    runPos--;
                }
                else {
                    var nameLength = buffer.array[runPos - 1];
                    var gap = position - runPos;
                    //console.log(nameLength + " - "+gap);
                    if (nameLength == gap) {
                        var startPos = runPos;
                        buffer.pos = startPos;
                        var nameBuffer = buffer.getSection(nameLength);
                        var decoder = new TextDecoder('utf-8');
                        var name_8 = decoder.decode(nameBuffer);
                        return name_8;
                    }
                    runPos--;
                }
            }
            buffer.pos++;
        }
        return result;
    };
    SimsPatterns.searchSimsCC = function (buffer) {
        //Get Sims
        buffer.pos = 0;
        var sims = SimsPatterns.simNamePattern(buffer);
        //Get Sims CC
        for (var index = 0; index < sims.length; index++) {
            var sim = sims[index];
            var startOffest = sim.firstName.length + sim.lastName.length + 12;
            var instances = SimsPatterns.casCCPattern(buffer, sim.start + startOffest, sim.end);
            sim.instances = instances;
        }
        return sims;
    };
    SimsPatterns.searchHouseHold = function (buffer) {
        buffer.pos = 0;
        var sims = SimsPatterns.householdPattern(buffer);
        return sims;
    };
    SimsPatterns.simNamePattern = function (buf) {
        buf.pos += 11;
        var result = [];
        while (buf.pos < buf.max) {
            var b1 = buf.array[buf.pos - 1] == 0x2a;
            var b2 = buf.array[buf.pos - 10] == 0x21;
            var pos = buf.pos;
            if (!(b1 && b2)) {
                buf.pos = pos + 1;
                continue;
            }
            //Check Names
            var startPos = pos;
            var endPos = buf.max;
            var firstName = "";
            var lastName = "";
            var fnLength = buf.getByte();
            var emptyByte = 0;
            var lnLength = -1;
            if (fnLength != 1 && fnLength > 0) {
                var nameBuffer = buf.getSection(fnLength);
                var decoder = new TextDecoder('utf-8');
                firstName = decoder.decode(nameBuffer);
                emptyByte = buf.getByte();
                lnLength = buf.getByte();
                if (lnLength != 1 && lnLength > 0) {
                    var lastNameBuffer = buf.getSection(lnLength);
                    lastName = decoder.decode(lastNameBuffer);
                }
            }
            if (firstName.length > 0 && lastName.length > 0 && emptyByte == 0x32) {
                //Get household instance
                var oldPos = buf.pos;
                buf.pos = pos - 9;
                var i_lo = buf.getInt().toString(16).padStart(8, "0");
                var i_hi = buf.getInt().toString(16).padStart(8, "0");
                var householdInstance = i_hi + i_lo;
                buf.pos = oldPos;
                var obj = {
                    firstName: firstName,
                    lastName: lastName,
                    householdInstance: householdInstance,
                    start: startPos,
                    end: endPos
                };
                if (result.length > 0) {
                    result[result.length - 1].end = startPos;
                }
                result.push(obj);
                buf.pos += 10;
            }
            else {
                buf.pos = pos + 1;
            }
        }
        return result;
    };
    SimsPatterns.householdPattern = function (buf) {
        buf.pos = buf.max - 1;
        var result = [];
        var last = buf.max;
        while (buf.pos > 1) {
            var b4 = buf.array[buf.pos - 1];
            var pos = buf.pos;
            if (!(b4 == 0x1a)) {
                buf.pos = pos - 1;
                continue;
            }
            //Check Names
            var startPos = pos;
            var householdName = "";
            var money = 0;
            //Name
            var nameLength = buf.getByte();
            var emptyByte = 0;
            if (nameLength != 1 && nameLength > 0) {
                var nameBuffer = buf.getSection(nameLength);
                var decoder = new TextDecoder('utf-8');
                householdName = decoder.decode(nameBuffer);
                emptyByte = buf.getByte();
            }
            if (emptyByte != 0x21) {
                buf.pos = pos - 1;
                continue;
            }
            //Lot Instance
            var i_lo = buf.getInt().toString(16).padStart(8, "0");
            var i_hi = buf.getInt().toString(16).padStart(8, "0");
            var lot = i_hi + i_lo;
            //SecureByte
            var byteCheck = buf.getByte() == 0x28;
            if (!byteCheck) {
                buf.pos = pos - 1;
                continue;
            }
            //Money
            money = buf.readUnsignedLeb128();
            //My Household
            var myHousehold = undefined;
            var oldPos = buf.pos;
            myHousehold = this.myHousehold(buf, last);
            buf.pos = oldPos;
            /*
            buf.pos = buf.pos+7;
            let bc03 = buf.getByte()==0x03;
            //if(!bc03){buf.pos=pos+1;continue;}
            let p1 = buf.getByte()==0x50;
            let p2 = buf.getByte()==0x00;
            let played = (!(p1 && p2) && myHousehold==1) ? 1 : 0;
            //if(myHousehold==0 && played==1)played=0;
            */
            //Description 
            oldPos = buf.pos;
            var description = undefined;
            var desObj = this.hhDescription(buf, last);
            if (desObj)
                description = desObj.description;
            buf.pos = oldPos;
            //GameHHID
            oldPos = buf.pos;
            var gameHHID = this.hhGameID(buf, householdName, last);
            buf.pos = oldPos;
            if (householdName.length > 0) {
                //Get household instance
                var oldPos_1 = buf.pos;
                buf.pos = pos - 9;
                var i_lo_1 = buf.getInt().toString(16).padStart(8, "0");
                var i_hi_1 = buf.getInt().toString(16).padStart(8, "0");
                var householdInstance = i_hi_1 + i_lo_1;
                buf.pos = oldPos_1;
                var obj = {
                    householdName: householdName,
                    householdInstance: householdInstance,
                    myHousehold: myHousehold,
                    lot: lot,
                    gameId: gameHHID,
                    description: description,
                    money: money,
                    start: startPos,
                    end: last
                };
                /*if(result.length>0){
                    result[result.length-1].end = startPos;
                }*/
                result.push(obj);
                last = pos - 1;
                buf.pos = pos - 2;
            }
            else {
                buf.pos = pos - 1;
            }
        }
        /*//Clean Descriptions & MyHousehold
        for (let index = 0; index < result.length; index++) {
            const current = result[index];

            //If description
            if(current.description){
                let data = current.description;
                if(data.end<=current.end && data.start>current.start){
                    current.description = data.description;
                }else{
                    current.description = undefined;
                }
            }

            //If MyHousehold
            if(current.myHousehold){
                let data = current.myHousehold;
                if(data.end<=current.end && data.start>current.start){
                    current.myHousehold = data.myHousehold;
                }else{
                    current.description = undefined;
                }
            }else{
                current.myHousehold = -1;
            }
        }*/
        return result;
    };
    SimsPatterns.hhDescription = function (buf, max) {
        while (buf.pos < max) {
            var b1 = buf.array[buf.pos - 5] == 0x82;
            var b2 = buf.array[buf.pos - 4] == 0x02;
            var b3 = buf.array[buf.pos - 3] == 0x00;
            var b4 = buf.array[buf.pos - 2] == 0x92;
            var b5 = buf.array[buf.pos - 1] == 0x01;
            var pos = buf.pos;
            if (!(b1 && b2 && b3 && b4 && b5)) {
                buf.pos = pos + 1;
                continue;
            }
            //Check Names
            var startPos = pos;
            var des = "";
            var desLength = buf.readUnsignedLeb128();
            var emptyByte = 0;
            if (desLength != 1 && desLength > 0) {
                var nameBuffer = buf.getSection(desLength);
                var decoder = new TextDecoder('utf-8');
                des = decoder.decode(nameBuffer);
                emptyByte = buf.getByte();
            }
            if (emptyByte == 0x98) {
                var result = {
                    start: startPos,
                    end: buf.pos,
                    description: des
                };
                return result;
            }
            buf.pos = pos + 1;
        }
        return undefined;
    };
    SimsPatterns.hhGameID = function (buf, name, max) {
        while (buf.pos < max) {
            var b1 = buf.array[buf.pos - 2] == 0xE8;
            var b2 = buf.array[buf.pos - 1] == 0x01;
            // let b3 = buf.array[buf.pos] == 0xF8;
            var pos = buf.pos;
            if (!(b1 && b2)) {
                buf.pos = pos + 1;
                continue;
            }
            var value = buf.readLeb128();
            var b3 = buf.getByte();
            if (b3 == 248) {
                return value.toString(16).padStart(16, "0");
            }
            else {
                buf.pos = pos + 1;
            }
        }
        return undefined;
    };
    SimsPatterns.myHousehold = function (buf, max) {
        while (buf.pos < max) {
            var b1 = buf.array[buf.pos - 3];
            var b2 = buf.array[buf.pos - 2];
            var b3 = buf.array[buf.pos - 1];
            var b4 = buf.array[buf.pos];
            var pos = buf.pos;
            if (!(b1 == 0x70 && b3 == 0x82 && b4 == 0x01 && (b2 == 0x01 || b2 == 0x00))) {
                buf.pos = pos + 1;
                continue;
            }
            return b2;
        }
        return undefined;
    };
    SimsPatterns.casCCPatternOld = function (buf, start, end) {
        var result = [];
        if (end > buf.max)
            end = buf.max;
        var lastFound = 40;
        var instanceMap = new Map();
        buf.pos = start;
        while (buf.pos < end) {
            var pos = buf.pos;
            var b1 = buf.array[pos - 6] == 0x48;
            var b2 = buf.array[pos - 5] == 0x01;
            var b3 = buf.array[pos - 4] == 0x50;
            var b4 = buf.array[pos - 3] == 0xFF;
            var b5 = buf.array[pos - 2] == 0xFF;
            var b6 = buf.array[pos - 1] == 0xFF;
            var b7 = buf.array[pos] == 0xFF;
            if (b1 && b2 && b3 && b4 && b5 && b6 && b7) {
                var items = this.searchCCInstanceBackwardsOld(buf, (pos - 6), lastFound);
                if (items) {
                    //Handle Items
                    for (var index = 0; index < items.length; index++) {
                        var element = items[index];
                        instanceMap.set(element.instance, element);
                    }
                }
                lastFound = pos;
                buf.pos = pos + 1;
            }
            else {
                buf.pos++;
            }
        }
        result = Array.from(instanceMap.values());
        return result;
    };
    SimsPatterns.searchCCInstanceBackwardsOld = function (buf, startpos, lastPos) {
        var found = false;
        var listStartPos = 0;
        var items = [];
        var typeList = [];
        var typeListSize = 0;
        var typeListStart = 0;
        buf.pos = startpos;
        while (buf.pos > lastPos + 3 && !found) {
            var b1 = buf.array[buf.pos - 2] == 0x3a;
            var b2 = buf.array[buf.pos] == 0x0a;
            if (b1 && b2) {
                found = true;
                typeListSize = buf.array[buf.pos + 1];
                typeListStart = buf.pos + 2;
                listStartPos = (buf.pos - 2) - (8 * typeListSize);
            }
            buf.pos--;
        }
        if (!found)
            return undefined;
        //Types 
        buf.pos = typeListStart;
        for (var index = 0; index < typeListSize; index++) {
            typeList.push(buf.getByte());
        }
        //Instances
        buf.pos = listStartPos;
        for (var index = 0; index < typeListSize; index++) {
            var value = buf.getLongString();
            buf.pos += 8;
            var t = CASPMapper.NumberToType.get(typeList[index]);
            if (t)
                t = CASPMapper.TypeToValueArray.get(t);
            var item = {
                instance: value,
                type: t
            };
            items.push(item);
        }
        return items;
    };
    SimsPatterns.casCCPattern = function (buf, start, end) {
        var result = [];
        if (end > buf.max)
            end = buf.max;
        var lastFound = 40;
        var instanceMap = new Map();
        buf.pos = start;
        while (buf.pos < end) {
            var pos = buf.pos;
            var b0 = buf.array[pos - 3];
            var b1 = buf.array[pos - 2];
            var b2 = buf.array[pos - 1];
            var b3 = buf.array[pos];
            if (b0 == 0x3a && b2 == 0x0a && ((b1 - b3) == 2)) {
                var partLength = b3;
                var items = this.searchCCInstanceBackwards(buf, start, end, partLength, pos);
                if (items) {
                    for (var index = 0; index < items.length; index++) {
                        var element = items[index];
                        instanceMap.set(element.instance, element);
                    }
                }
                lastFound = pos;
                buf.pos = pos + 1;
            }
            else {
                buf.pos++;
            }
        }
        result = Array.from(instanceMap.values());
        return result;
    };
    SimsPatterns.searchCCInstanceBackwards = function (buf, sPos, ePos, partLength, partPos) {
        var items = [];
        var typeList = [];
        //Types 
        buf.pos = partPos + 1;
        for (var index = 0; index < partLength; index++) {
            typeList.push(buf.getByte());
        }
        //Instances
        buf.pos = partPos - 3 - (partLength * 8);
        for (var index = 0; index < partLength; index++) {
            var value = buf.getLongString();
            buf.pos += 8;
            var t = CASPMapper.NumberToType.get(typeList[index]);
            if (t)
                t = CASPMapper.TypeToValueArray.get(t);
            var item = {
                instance: value,
                type: t
            };
            items.push(item);
        }
        return items;
    };
    return SimsPatterns;
}());
exports.SimsPatterns = SimsPatterns;
var ByteBuffer = /** @class */ (function () {
    function ByteBuffer(array) {
        this.array = array;
        this.pos = 0;
        this.max = array.length;
    }
    //1 Byte
    ByteBuffer.prototype.getByte = function () {
        if (this.pos < this.max) {
            var byte = this.array[this.pos];
            this.pos++;
            return byte;
        }
        else {
            return -1;
        }
    };
    //2 Bytes
    ByteBuffer.prototype.getShort = function () {
        if (this.pos + 1 < this.max) {
            var arr = this.array.slice(this.pos, this.pos + 2);
            this.pos = this.pos + 2;
            return this.byteArrayToNumber(arr);
        }
        else {
            return -1;
        }
    };
    //4 Bytes
    ByteBuffer.prototype.getInt = function () {
        if (this.pos + 3 < this.max) {
            var arr = this.array.slice(this.pos, this.pos + 4);
            this.pos = this.pos + 4;
            return this.byteArrayToNumber(arr);
        }
        else {
            return -1;
        }
    };
    // 2 Bytes (Signed)
    ByteBuffer.prototype.getSignedShort = function () {
        if (this.pos + 1 < this.max) {
            var arr = this.array.slice(this.pos, this.pos + 2);
            this.pos = this.pos + 2;
            var view_1 = new DataView(new ArrayBuffer(2));
            arr.forEach(function (byte, index) { return view_1.setUint8(index, byte); });
            return view_1.getInt16(0, true); // true for little-endian
        }
        else {
            return -1;
        }
    };
    // 4 Bytes (Signed)
    ByteBuffer.prototype.getSignedInt = function () {
        if (this.pos + 3 < this.max) {
            var arr = this.array.slice(this.pos, this.pos + 4);
            this.pos = this.pos + 4;
            var view_2 = new DataView(new ArrayBuffer(4));
            arr.forEach(function (byte, index) { return view_2.setUint8(index, byte); });
            return view_2.getInt32(0, true); // true for little-endian
        }
        else {
            return -1;
        }
    };
    //4 Bytes
    ByteBuffer.prototype.getFloat = function () {
        if (this.pos + 3 < this.max) {
            var arr = this.array.slice(this.pos, this.pos + 4);
            this.pos = this.pos + 4;
            return Buffer.from(arr).readFloatLE(0);
        }
        else {
            return 0;
        }
    };
    ByteBuffer.prototype.getFloat32 = function () {
        var buffer = this.getSection(4);
        var uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        var view = new DataView(uint8Array.buffer);
        return view.getFloat32(0, false); // true for little-endian
    };
    //8 Bytes
    ByteBuffer.prototype.getLong = function () {
        if (this.pos + 7 < this.max) {
            var arr = this.array.slice(this.pos, this.pos + 8);
            this.pos = this.pos + 8;
            return this.byteArrayToLong(arr);
        }
        else {
            throw new Error("Buffer not big enugh!");
        }
    };
    ByteBuffer.prototype.putByte = function (value) {
        if (this.pos < this.max) {
            this.array[this.pos] = value & 0xFF;
            this.pos++;
        }
    };
    ByteBuffer.prototype.putBytes = function (values) {
        for (var index = 0; index < values.length; index++) {
            var element = values[index];
            this.putByte(element);
        }
    };
    // 2 Bytes
    ByteBuffer.prototype.putShort = function (value) {
        if (this.pos + 1 < this.max) {
            this.array[this.pos + 1] = (value >> 8) & 0xFF;
            this.array[this.pos + 0] = value & 0xFF;
            this.pos += 2;
        }
    };
    // 4 Bytes
    ByteBuffer.prototype.putInt = function (value) {
        if (this.pos + 3 < this.max) {
            this.array[this.pos + 3] = (value >> 24) & 0xFF;
            this.array[this.pos + 2] = (value >> 16) & 0xFF;
            this.array[this.pos + 1] = (value >> 8) & 0xFF;
            this.array[this.pos + 0] = value & 0xFF;
            this.pos += 4;
        }
    };
    // 8 Bytes
    ByteBuffer.prototype.putLong = function (value) {
        if (this.pos + 7 < this.max) {
            for (var i = 7; i >= 0; i++) {
                this.array[this.pos + i] = Number((value >> BigInt((7 - i) * 8)) & BigInt(0xFF));
            }
            this.pos += 8;
        }
    };
    ByteBuffer.prototype.getLongString = function () {
        if (this.pos + 7 < this.max) {
            var arr = this.array.slice(this.pos, this.pos + 8);
            return "0x" + arr.readBigUInt64LE().toString(16).padStart(16, "0").toUpperCase();
        }
        else {
            return undefined;
        }
    };
    ByteBuffer.prototype.getLongStringAlt = function () {
        if (this.pos + 7 < this.max) {
            var v1 = this.getInt().toString(16).padStart(8, "0");
            var v2 = this.getInt().toString(16).padStart(8, "0");
            return v2 + v1;
        }
        else {
            return undefined;
        }
    };
    ByteBuffer.prototype.skip = function (l) {
        this.pos = this.pos + l;
    };
    ByteBuffer.prototype.getSection = function (l) {
        var r = this.array.slice(this.pos, this.pos + l);
        this.pos = this.pos + l;
        return r;
    };
    //https://stackoverflow.com/questions/8482309/converting-javascript-integer-to-byte-array-and-back
    ByteBuffer.prototype.byteArrayToLong = function (byteArray) {
        var value = BigInt(0);
        for (var i = byteArray.length - 1; i >= 0; i--) {
            value = (value * BigInt(256)) + BigInt(byteArray[i]);
        }
        return value;
    };
    ;
    ByteBuffer.prototype.byteArrayToNumber = function (byteArray) {
        var value = 0;
        for (var i = byteArray.length - 1; i >= 0; i--) {
            value = (value * 256) + byteArray[i];
        }
        return value;
    };
    ;
    ByteBuffer.prototype.readUnsignedLeb128 = function () {
        var result = 0;
        var cur = 0;
        var count = 0;
        do {
            cur = this.getByte();
            result |= (cur & 0x7f) << (count * 7);
            count++;
        } while (((cur & 0x80) == 0x80) && count < 5);
        if ((cur & 0x80) == 0x80) {
            return -1;
        }
        return result;
    };
    ByteBuffer.prototype.readLeb128 = function () {
        var data = readUleb128(this.array.subarray(this.pos));
        if (!data)
            return BigInt(0);
        this.pos += data.length;
        return BigInt(data.value);
        ;
    };
    ByteBuffer.prototype.readTGIItemByOrdner = function (order) {
        return Basic.getTGIListItemByOrdner(this, order);
    };
    ByteBuffer.prototype.readString = function () {
        var l = this.getInt();
        return this.getSection(l).toString();
    };
    ByteBuffer.prototype.toBuffer = function () {
        return Buffer.from(this.array);
    };
    return ByteBuffer;
}());
exports.ByteBuffer = ByteBuffer;
var BufferOperations = /** @class */ (function () {
    function BufferOperations() {
    }
    BufferOperations.findAll = function (buffer, pattern) {
        var positions = [];
        for (var index = 0; index < buffer.length - pattern.length + 1; index++) {
            var elements = buffer.subarray(index, index + pattern.length);
            var found = this.compateArrays(Array.from(elements), pattern);
            if (found) {
                positions.push(index);
                index += pattern.length - 1;
            }
        }
        return positions;
    };
    BufferOperations.compateArrays = function (a, b) {
        if (a.length != b.length)
            return false;
        for (var index = 0; index < a.length; index++) {
            var element = a[index];
            if (element != b[index])
                return false;
        }
        return true;
    };
    BufferOperations.hexStringToByteArray = function (hex) {
        if (hex.length % 2 != 0)
            hex = "0" + hex;
        var result = [];
        for (var index = 0; index < hex.length; index += 2) {
            var element = hex.substring(index, index + 2);
            result.push(parseInt(element, 16));
        }
        return result.reverse();
    };
    return BufferOperations;
}());
exports.BufferOperations = BufferOperations;
var BinaryWritter = /** @class */ (function () {
    function BinaryWritter() {
        this.arr = new Uint8Array(65536 * 4);
        this.pos = 0;
    }
    BinaryWritter.prototype.seek = function (np) {
        this.pos = np;
        if (this.pos > this.arr.length)
            this.doubleSize(this.pos - this.arr.length);
    };
    BinaryWritter.prototype.numToUint8Array = function (num) {
        var arr = new Uint8Array(8);
        for (var i = 0; i < 8; i++)
            arr.set([num / Math.pow(0x100, i)], 7 - i);
        return arr;
    };
    BinaryWritter.prototype.writeByte = function (value) {
        this.doubleSize(1);
        this.arr[this.pos] = value;
        this.pos++;
    };
    BinaryWritter.prototype.writeShort = function (value) {
        this.doubleSize(2);
        var st = value.toString(16).padStart(4, "0");
        this.arr[this.pos] = Number("0x" + st.substring(2, 4));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(0, 2));
        this.pos++;
    };
    BinaryWritter.prototype.writeInt = function (value) {
        this.doubleSize(4);
        var st = value.toString(16).padStart(8, "0");
        this.arr[this.pos] = Number("0x" + st.substring(6, 8));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(4, 6));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(2, 4));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(0, 2));
        this.pos++;
    };
    BinaryWritter.prototype.writeLong = function (value) {
        this.doubleSize(8);
        var st = value.toString(16).padStart(16, "0");
        this.arr[this.pos] = Number("0x" + st.substring(14, 16));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(12, 14));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(10, 12));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(8, 10));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(6, 8));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(4, 6));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(2, 4));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(0, 2));
        this.pos++;
    };
    BinaryWritter.prototype.writeBigInt = function (value) {
        this.doubleSize(8);
        var st = value.toString(16).padStart(16, "0");
        this.arr[this.pos] = Number("0x" + st.substring(14, 16));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(12, 14));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(10, 12));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(8, 10));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(6, 8));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(4, 6));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(2, 4));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(0, 2));
        this.pos++;
    };
    BinaryWritter.prototype.writeBigIntCap = function (value) {
        this.doubleSize(8);
        var st = value.toString(16).padStart(16, "0");
        this.arr[this.pos] = Number("0x" + st.substring(14, 16));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(12, 14));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(10, 12));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(8, 10));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(6, 8));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(4, 6));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(2, 4));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(0, 2));
        this.pos++;
    };
    BinaryWritter.prototype.writeBytes = function (values) {
        for (var index = 0; index < values.length; index++) {
            var element = values[index];
            this.writeByte(element);
        }
    };
    BinaryWritter.prototype.writeEmptyBytes = function (count) {
        for (var index = 0; index < count; index++) {
            this.writeByte(0);
        }
    };
    BinaryWritter.prototype.writeFloat = function (value) {
        this.doubleSize(4);
        var buffer = Buffer.alloc(4);
        buffer.writeFloatLE(value, 0);
        this.writeBytes(buffer);
    };
    BinaryWritter.prototype.doubleSize = function (addValue) {
        if ((this.pos + addValue - 1) < this.arr.length)
            return;
        var newArr = new Uint8Array(this.arr.length + 65536);
        for (var index = 0; index < this.arr.length; index++) {
            var element = this.arr[index];
            newArr[index] = element;
        }
        this.arr = newArr;
    };
    BinaryWritter.prototype.toBuffer = function () {
        return Buffer.from(this.arr.subarray(0, this.pos));
    };
    BinaryWritter.prototype.writeTGIListItem = function (tgiListItem, writeType) {
        switch (writeType) {
            case "TGI":
                this.writeInt(tgiListItem.type);
                this.writeInt(tgiListItem.group);
                this.writeBigInt(tgiListItem.instance);
                break;
            case "ITG":
                this.writeBigInt(tgiListItem.instance);
                this.writeInt(tgiListItem.type);
                this.writeInt(tgiListItem.group);
                break;
            default:
                throw new Error("Unknown structure type: " + writeType);
        }
    };
    BinaryWritter.prototype.writeString = function (value) {
        var length = value.length;
        this.writeInt(length);
        this.writeBytes(Buffer.from(value, "utf-8"));
    };
    BinaryWritter.prototype.writeTGIItemByOrdner = function (tgi, order) {
        if (order === void 0) { order = 4; }
        if (!tgi)
            return;
        var readType = "TGI";
        switch (order) {
            case 0:
                readType = "TGI";
                break;
            case 1:
                readType = "TIG";
                break;
            case 2:
                readType = "GTI";
                break;
            case 3:
                readType = "GIT";
                break;
            case 4:
                readType = "ITG";
                break;
            case 5:
                readType = "IGT";
                break;
            default:
                throw new Error("Unknown structure type: " + order);
        }
        var parts = readType.split("");
        this.writeByte(order);
        for (var index = 0; index < parts.length; index++) {
            var element = parts[index];
            switch (element) {
                case "T":
                    this.writeInt(tgi.type);
                    break;
                case "G":
                    this.writeInt(tgi.group);
                    break;
                case "I":
                    this.writeBigIntCap(tgi.instance);
                    break;
                default:
                    throw new Error("Unknown structure type: " + element);
            }
        }
    };
    BinaryWritter.prototype.writeTGIItemByOrdnerType = function (tgi, order, writeType) {
        if (!tgi)
            return;
        var readType = "TGI";
        switch (order) {
            case 0:
                readType = "TGI";
                break;
            case 1:
                readType = "TIG";
                break;
            case 2:
                readType = "GTI";
                break;
            case 3:
                readType = "GIT";
                break;
            case 4:
                readType = "ITG";
                break;
            case 5:
                readType = "IGT";
                break;
            default:
                throw new Error("Unknown structure type: " + order);
        }
        var parts = readType.split("");
        if (writeType)
            this.writeByte(order);
        for (var index = 0; index < parts.length; index++) {
            var element = parts[index];
            switch (element) {
                case "T":
                    this.writeInt(tgi.type);
                    break;
                case "G":
                    this.writeInt(tgi.group);
                    break;
                case "I":
                    this.writeBigIntCap(tgi.instance);
                    break;
                default:
                    throw new Error("Unknown structure type: " + element);
            }
        }
    };
    return BinaryWritter;
}());
exports.BinaryWritter = BinaryWritter;
var PackHandler = /** @class */ (function () {
    function PackHandler() {
    }
    //Saves let buffer to file (use complex, when export from EA)
    PackHandler.saveBufferToFile = function (file, buffer, isComplex) {
        return __awaiter(this, void 0, void 0, function () {
            var inp, arr, png, alpha, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        inp = buffer;
                        if (Array.isArray(inp)) {
                            arr = Buffer.from(inp);
                        }
                        else {
                            arr = inp;
                        }
                        if (!(arr.length != 0 && arr.length > 40)) return [3 /*break*/, 6];
                        if (!(!isComplex && false)) return [3 /*break*/, 1];
                        fs.writeFileSync(file, arr);
                        return [3 /*break*/, 6];
                    case 1:
                        png = arr.slice(32, arr.length);
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, sharp(png).extractChannel('red').options.input.buffer];
                    case 3:
                        alpha = _a.sent();
                        return [4 /*yield*/, sharp(arr, { failOnError: false }).ensureAlpha().joinChannel(alpha).toFile(file)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_2 = _a.sent();
                        console.error(error_2);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    PackHandler.saveCASCOBJImageBufferToFile = function (file, buffer, isComplex) {
        return __awaiter(this, void 0, void 0, function () {
            var inp, arr, png, alpha, im, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        inp = buffer;
                        if (Array.isArray(inp)) {
                            arr = Buffer.from(inp);
                        }
                        else {
                            arr = inp;
                        }
                        if (!(arr.length != 0 && arr.length > 40)) return [3 /*break*/, 6];
                        png = arr.slice(32, arr.length);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, sharp(png).extractChannel('red').toBuffer()];
                    case 2:
                        alpha = _a.sent();
                        return [4 /*yield*/, sharp(arr, { failOnError: false }).ensureAlpha().joinChannel(alpha).png().toBuffer()];
                    case 3:
                        im = _a.sent();
                        return [4 /*yield*/, sharp(im).flatten({ background: '#e3ebf3' }).toFile(file)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_3 = _a.sent();
                        console.error(error_3);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    PackHandler.isBufferJpg = function (buf) {
        return false;
    };
    PackHandler.isBufferPng = function (buf) {
        return false;
    };
    return PackHandler;
}());
exports.PackHandler = PackHandler;
var Basic = /** @class */ (function () {
    function Basic() {
    }
    Basic.cleanName = function (name) {
        return NAMEUTIL.clearName(name);
        ;
    };
    Basic.getStingKey = function (element) {
        return element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
    };
    Basic.getInstanceKey = function (element) {
        return element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
    };
    Basic.combineHiLoToBigInt = function (hi, lo) {
        var hiBigInt = BigInt(hi);
        var loBigInt = BigInt(lo);
        return (hiBigInt << BigInt(32)) | loBigInt;
    };
    Basic.getTGIListItem = function (bb, readType) {
        var type = 0;
        var group = 0;
        var instance = BigInt(0);
        switch (readType) {
            case "TGI":
                type = bb.getInt();
                group = bb.getInt();
                instance = bb.getLong();
                return { type: type, group: group, instance: instance };
            case "ITG":
                instance = bb.getLong();
                type = bb.getInt();
                group = bb.getInt();
                return { type: type, group: group, instance: instance };
            default:
                throw new Error("Unknown structure type: " + readType);
        }
    };
    Basic.getTGIListItemByOrdner = function (bb, order) {
        var readType = "TGI";
        switch (order) {
            case 0:
                readType = "TGI";
                break;
            case 1:
                readType = "TIG";
                break;
            case 2:
                readType = "GTI";
                break;
            case 3:
                readType = "GIT";
                break;
            case 4:
                readType = "ITG";
                break;
            case 5:
                readType = "IGT";
                break;
            default:
                throw new Error("Unknown structure type: " + order);
        }
        var type = 0;
        var group = 0;
        var instance = BigInt(0);
        var parts = readType.split("");
        for (var index = 0; index < parts.length; index++) {
            var element = parts[index];
            switch (element) {
                case "T":
                    type = bb.getInt();
                    break;
                case "G":
                    group = bb.getInt();
                    break;
                case "I":
                    instance = bb.getLong();
                    break;
                default:
                    throw new Error("Unknown structure type: " + element);
            }
        }
        return { type: type, group: group, instance: instance };
    };
    Basic.indicesToFaces = function (indices, count) {
        if (count === void 0) { count = 3; }
        var faces = [];
        for (var index = 0; index < indices.length; index += count) {
            var face = [];
            for (var i = 0; i < count; i++) {
                face.push(indices[index + i]);
            }
            faces.push(face);
        }
        return faces;
    };
    Basic.tgiToKey = function (tgi) {
        return tgi.type.toString(16).padStart(8, "0") + "-" + tgi.group.toString(16).padStart(8, "0") + "-" + tgi.instance.toString(16).padStart(16, "0");
    };
    Basic.swapFirstAndLast4Bytes = function (bigIntValue) {
        // Mask to get the first 4 bytes (32 bits)
        var first4BytesMask = BigInt("0xFFFFFFFF00000000");
        // Mask to get the last 4 bytes (32 bits)
        var last4BytesMask = BigInt("0x00000000FFFFFFFF");
        // Extract the first 4 bytes and shift them to the position of the last 4 bytes
        var first4Bytes = (bigIntValue & first4BytesMask) >> BigInt(32);
        // Extract the last 4 bytes and shift them to the position of the first 4 bytes
        var last4Bytes = (bigIntValue & last4BytesMask) << BigInt(32);
        // Combine the swapped bytes
        return first4Bytes | last4Bytes;
    };
    return Basic;
}());
exports.Basic = Basic;
var CompressUtil = /** @class */ (function () {
    function CompressUtil() {
    }
    CompressUtil.intFromBytes = function (byteArray) {
        var value = 0;
        for (var i = byteArray.length - 1; i >= 0; i--) {
            value = (value * 256) + byteArray[i];
        }
        return value;
    };
    CompressUtil.decompressOld = function (compressed, compressionType) {
        var r = new ByteBuffer(compressed);
        var type = compressionType != 0x80;
        var sizeArray = [0, 0, 0, 0];
        r.pos = 2;
        for (var i = type ? 2 : 3; i >= 0; i--) {
            sizeArray[i] = r.getByte();
        }
        var dataSize = this.intFromBytes(sizeArray);
        var data = new Array(dataSize);
        var refObj = { position: 0, };
        while (refObj.position < dataSize) {
            var byte0 = r.getByte();
            if (byte0 <= 0x7F) {
                var byte1 = r.getByte();
                var numPlainText = byte0 & 0x03;
                var numToCopy = ((byte0 & 0x1C) >> 2) + 3;
                var copyOffest = ((byte0 & 0x60) << 3) + byte1 + 1;
                this.copyPlainText(r, data, numPlainText, refObj);
                this.copyCompressedText(r, data, numToCopy, refObj, copyOffest);
            }
            else if (byte0 <= 0XBF && byte0 > 0x7F) {
                var byte1 = r.getByte();
                var byte2 = r.getByte();
                var numPlainText = ((byte1 & 0xC0) >> 6) & 0x03;
                var numToCopy = (byte0 & 0x3F) + 4;
                var copyOffest = ((byte1 & 0x3F) << 8) + byte2 + 1;
                this.copyPlainText(r, data, numPlainText, refObj);
                this.copyCompressedText(r, data, numToCopy, refObj, copyOffest);
            }
            else if (byte0 <= 0xDF && byte0 > 0xBF) {
                var byte1 = r.getByte();
                var byte2 = r.getByte();
                var byte3 = r.getByte();
                var numPlainText = byte0 & 0x03;
                var numToCopy = ((byte0 & 0x0C) << 6) + byte3 + 5;
                var copyOffest = ((byte0 & 0x10) << 12) + (byte1 << 8) + byte2 + 1;
                this.copyPlainText(r, data, numPlainText, refObj);
                this.copyCompressedText(r, data, numToCopy, refObj, copyOffest);
            }
            else if (byte0 <= 0xFB && byte0 > 0xDF) {
                var numPlainText = ((byte0 & 0x1F) << 2) + 4;
                this.copyPlainText(r, data, numPlainText, refObj);
            }
            else if (byte0 <= 0xFF && byte0 > 0xFB) {
                var numPlainText = (byte0 & 0x03);
                this.copyPlainText(r, data, numPlainText, refObj);
            }
        }
        return Buffer.from(data);
    };
    CompressUtil.copyPlainText = function (r, data, numPlainText, positionObj) {
        // Copy data one at a time
        for (var i = 0; i < numPlainText; positionObj.position++, i++) {
            data[positionObj.position] = r.getByte();
        }
    };
    CompressUtil.copyCompressedText = function (r, data, numToCopy, positionObj, copyOffest) {
        var currentPosition = positionObj.position;
        // Copy data one at a time
        for (var i = 0; i < numToCopy; i++, positionObj.position++) {
            data[positionObj.position] = data[currentPosition - copyOffest + i];
        }
    };
    return CompressUtil;
}());
exports.CompressUtil = CompressUtil;
var REL2File = /** @class */ (function () {
    function REL2File(buffer) {
        //Basic Values
        this.hight = 0;
        this.width = 0;
        this.version = 0;
        this.fourcc = 0;
        this.mipCount = 0;
        this.unknown0E = 0;
        this.mipHeaders = [];
        this.buffer = buffer;
        this.calculateData();
    }
    REL2File.prototype.calculateData = function () {
        var byteBuffer = new ByteBuffer(this.buffer);
        //Basic Infos
        this.fourcc = byteBuffer.getInt();
        this.version = byteBuffer.getInt();
        this.width = byteBuffer.getShort();
        this.hight = byteBuffer.getShort();
        this.mipCount = byteBuffer.getShort();
        this.unknown0E = byteBuffer.getShort();
        //MipHeads
        for (var index = 0; index < this.mipCount; index++) {
            var header = {
                CommandOffset: byteBuffer.getInt(),
                Offset2: byteBuffer.getInt(),
                Offset3: byteBuffer.getInt(),
                Offset0: byteBuffer.getInt(),
                Offset1: byteBuffer.getInt()
            };
            this.mipHeaders.push(header);
        }
        this.mipHeaders.push({
            CommandOffset: this.mipHeaders[0].CommandOffset,
            Offset2: this.mipHeaders[0].Offset2,
            Offset3: this.mipHeaders[0].Offset3,
            Offset0: this.mipHeaders[0].Offset0,
            Offset1: byteBuffer.array.length
        });
        //this.mipHeaders[this.mipCount].Offset1 = byteBuffer.array.length;
        //console.log(this.mipHeaders);
    };
    REL2File.prototype.toDDS = function (color) {
        var bw = new BinaryWritter();
        //DDS Magic Word
        bw.writeByte(0x44);
        bw.writeByte(0x44);
        bw.writeByte(0x53);
        bw.writeByte(0x20);
        //Basic Info
        var size = (18 * 4) + (8 * 4) + (5 * 4);
        bw.writeInt(size); //Size
        bw.writeInt(0x000A1007); //Texture
        bw.writeInt(this.hight); //Hight
        bw.writeInt(this.width); //Width
        bw.writeInt(2097152); //PitchOrLinearSize ? 
        bw.writeInt(1); //Depth ?
        bw.writeInt(this.mipCount); //MipCount
        for (var index = 0; index < 11; index++) {
            bw.writeInt(0);
        } //Reversed1 ?
        //PixelFormat
        bw.writeInt(32);
        bw.writeInt(0x4);
        bw.writeInt(this.fourcc);
        bw.writeInt(32); //RGBBitCount
        bw.writeInt(0x00FF0000); //redBitMask
        bw.writeInt(0x0000FF00); //greenBitMask
        bw.writeInt(0x000000FF); //blueBitMask
        bw.writeInt(0xFF000000); //alphaBitMask
        //Other
        bw.writeInt(4198408); //surfaceFlags
        bw.writeInt(0); //cubeMapFlags
        for (var index = 0; index < 3; index++) {
            bw.writeInt(0);
        } //Reversed2 ?
        //Write Pixels
        var fullTransparentAlpha = [0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        var fullOpaqueAlpha = [0x00, 0x05, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
        var colorTest = [0xeb, 0x5a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        var byteBuffer = new ByteBuffer(this.buffer);
        //return bw.toBuffer();
        for (var index = 0; index < this.mipCount; index++) {
            var mipHeader = this.mipHeaders[index];
            var nextMipHeader = this.mipHeaders[index + 1];
            var blockOffset2 = mipHeader.Offset2;
            var blockOffset3 = mipHeader.Offset3;
            var blockOffset0 = mipHeader.Offset0;
            var blockOffset1 = mipHeader.Offset1;
            for (var commandOffset = mipHeader.CommandOffset; commandOffset < nextMipHeader.CommandOffset; commandOffset += 2) {
                byteBuffer.pos = commandOffset;
                var command = byteBuffer.getShort();
                //console.log("command:"+command);
                var op = command & 3;
                var count = command >> 2;
                if (op == 0) {
                    for (var j = 0; j < count; j++) {
                        if (color == undefined) {
                            fullTransparentAlpha.forEach(function (b) { bw.writeByte(b); });
                            fullTransparentAlpha.forEach(function (b) { bw.writeByte(b); });
                        }
                        else {
                            fullOpaqueAlpha.forEach(function (b) { bw.writeByte(b); });
                            colorTest.forEach(function (b) { bw.writeByte(b); });
                        }
                    }
                }
                else if (op == 1) {
                    for (var j = 0; j < count; j++) {
                        this.csWrite(bw, byteBuffer, blockOffset0, 2);
                        this.csWrite(bw, byteBuffer, blockOffset1, 6);
                        this.csWrite(bw, byteBuffer, blockOffset2, 4);
                        this.csWrite(bw, byteBuffer, blockOffset3, 4);
                        blockOffset2 += 4;
                        blockOffset3 += 4;
                        blockOffset0 += 2;
                        blockOffset1 += 6;
                    }
                }
                else if (op == 2) {
                    for (var j = 0; j < count; j++) {
                        fullOpaqueAlpha.forEach(function (b) { bw.writeByte(b); });
                        this.csWrite(bw, byteBuffer, blockOffset2, 4);
                        this.csWrite(bw, byteBuffer, blockOffset3, 4);
                        blockOffset2 += 4;
                        blockOffset3 += 4;
                    }
                }
                else {
                    console.log("ERROR - NotSupportedException");
                }
                if (blockOffset0 != nextMipHeader.Offset0 ||
                    blockOffset1 != nextMipHeader.Offset1 ||
                    blockOffset2 != nextMipHeader.Offset2 ||
                    blockOffset3 != nextMipHeader.Offset3) {
                    //console.log("ERROR - InvalidOperationException");
                }
            }
        }
        //console.log(bw.toBuffer());
        return bw.toBuffer();
    };
    REL2File.prototype.toPNG = function (imagePath, defSize) {
        return __awaiter(this, void 0, void 0, function () {
            var image, xOffset, yOffset, byteBuffer, index, mipHeader, nextMipHeader, blockOffset2, blockOffset3, blockOffset0, blockOffset1, commandOffset, command, op, count, j, currentPos, y, x, absolutX, absolutY, color, j, a0, a1, aM0, aM1, aM2, aM3, aM4, aM5, aMap, alphaArr, c0, c1, cM0, cM1, cM2, cM3, cMap, colorArr, currentPos, y, x, colorStr, alphaStr, colorPos, alphaPos, alpha, color, absolutX, absolutY, pixel, j, a0, a1, aMap2, aMap4, aMap, alphaArr, c0, c1, cMap, colorArr, currentPos, y, x, colorPos, alphaPos, alpha, color, absolutX, absolutY, created, mainImage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        image = PNGImage.createImage(this.width, this.hight);
                        xOffset = 0;
                        yOffset = 0;
                        byteBuffer = new ByteBuffer(this.buffer);
                        for (index = 0; index < 1; index++) {
                            mipHeader = this.mipHeaders[index];
                            nextMipHeader = this.mipHeaders[index + 1];
                            blockOffset2 = mipHeader.Offset2;
                            blockOffset3 = mipHeader.Offset3;
                            blockOffset0 = mipHeader.Offset0;
                            blockOffset1 = mipHeader.Offset1;
                            for (commandOffset = mipHeader.CommandOffset; commandOffset < nextMipHeader.CommandOffset; commandOffset += 2) {
                                byteBuffer.pos = commandOffset;
                                command = byteBuffer.getShort();
                                op = command & 3;
                                count = command >> 2;
                                if (op == 0) {
                                    for (j = 0; j < count; j++) {
                                        currentPos = 0;
                                        for (y = 0; y < 4; y++) {
                                            for (x = 0; x < 4; x++) {
                                                absolutX = xOffset + (3 - x);
                                                absolutY = yOffset + (3 - y);
                                                color = {
                                                    r: 0,
                                                    g: 0,
                                                    b: 0
                                                };
                                                image.setAt(absolutX, absolutY, { red: color.r, green: color.g, blue: color.b, alpha: 0 });
                                                currentPos++;
                                            }
                                        }
                                        xOffset += 4;
                                        if (xOffset >= this.width) {
                                            xOffset = 0;
                                            yOffset += 4;
                                        }
                                        //fullTransparentAlpha.forEach((b)=>{bw.writeByte(b)});
                                        //fullTransparentAlpha.forEach((b)=>{bw.writeByte(b)});
                                    }
                                }
                                else if (op == 1) {
                                    for (j = 0; j < count; j++) {
                                        //Alpha
                                        byteBuffer.pos = blockOffset0;
                                        a0 = byteBuffer.getByte();
                                        a1 = byteBuffer.getByte();
                                        byteBuffer.pos = blockOffset1;
                                        aM0 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM1 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM2 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM3 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM4 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM5 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aMap = aM5 + aM4 + aM3 + aM2 + aM1 + aM0;
                                        alphaArr = this.alphaArray(a0, a1);
                                        //Color
                                        byteBuffer.pos = blockOffset2;
                                        c0 = byteBuffer.getShort();
                                        c1 = byteBuffer.getShort();
                                        byteBuffer.pos = blockOffset3;
                                        cM0 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        cM1 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        cM2 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        cM3 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        cMap = cM3 + cM2 + cM1 + cM0;
                                        colorArr = this.colorArray(c0, c1);
                                        currentPos = 0;
                                        for (y = 0; y < 4; y++) {
                                            for (x = 0; x < 4; x++) {
                                                colorStr = cMap.substring((2 * currentPos), (2 * currentPos) + 2);
                                                alphaStr = aMap.substring((3 * currentPos), (3 * currentPos) + 3);
                                                colorPos = parseInt(colorStr, 2);
                                                alphaPos = parseInt(alphaStr, 2);
                                                alpha = alphaArr[alphaPos];
                                                color = colorArr[colorPos];
                                                absolutX = xOffset + (3 - x);
                                                absolutY = yOffset + (3 - y);
                                                pixel = { red: color.r, green: color.g, blue: color.b, alpha: alpha };
                                                image.setAt(absolutX, absolutY, pixel);
                                                currentPos++;
                                            }
                                        }
                                        xOffset += 4;
                                        if (xOffset >= this.width) {
                                            xOffset = 0;
                                            yOffset += 4;
                                        }
                                        //this.csWrite(bw,byteBuffer,blockOffset0,2);
                                        //this.csWrite(bw,byteBuffer,blockOffset1,6);
                                        //this.csWrite(bw,byteBuffer,blockOffset2,4);
                                        //this.csWrite(bw,byteBuffer,blockOffset3,4);
                                        blockOffset2 += 4;
                                        blockOffset3 += 4;
                                        blockOffset0 += 2;
                                        blockOffset1 += 6;
                                    }
                                }
                                else if (op == 2) {
                                    for (j = 0; j < count; j++) {
                                        a0 = 0;
                                        a1 = 5;
                                        aMap2 = 0xffff.toString(2).padStart(16, "0");
                                        aMap4 = 0xffffffff.toString(2).padStart(32, "0");
                                        aMap = aMap4 + aMap2;
                                        alphaArr = this.alphaArray(a0, a1);
                                        //Color
                                        byteBuffer.pos = blockOffset2;
                                        c0 = byteBuffer.getShort();
                                        c1 = byteBuffer.getShort();
                                        byteBuffer.pos = blockOffset3;
                                        cMap = byteBuffer.getInt().toString(2).padStart(32, "0");
                                        colorArr = this.colorArray(c0, c1);
                                        currentPos = 0;
                                        for (y = 0; y < 4; y++) {
                                            for (x = 0; x < 4; x++) {
                                                colorPos = parseInt(cMap.substring((2 * currentPos), (2 * currentPos) + 2), 2);
                                                alphaPos = parseInt(aMap.substring((3 * currentPos), (3 * currentPos) + 3), 2);
                                                alpha = alphaArr[alphaPos];
                                                color = colorArr[colorPos];
                                                absolutX = xOffset + (3 - x);
                                                absolutY = yOffset + (3 - y);
                                                image.setAt(absolutX, absolutY, { red: color.r, green: color.g, blue: color.b, alpha: alpha });
                                                currentPos++;
                                            }
                                        }
                                        xOffset += 4;
                                        if (xOffset >= this.width) {
                                            xOffset = 0;
                                            yOffset += 4;
                                        }
                                        //fullOpaqueAlpha.forEach((b)=>{bw.writeByte(b)});
                                        //this.csWrite(bw,byteBuffer,blockOffset2,4);
                                        //this.csWrite(bw,byteBuffer,blockOffset3,4);
                                        blockOffset2 += 4;
                                        blockOffset3 += 4;
                                    }
                                }
                                else {
                                    console.log("ERROR - NotSupportedException");
                                }
                            }
                        }
                        //Return image and last check
                        try {
                            image.writeImageSync(imagePath);
                        }
                        catch (error) {
                            console.log(error);
                        }
                        created = fs.existsSync(imagePath);
                        if (!created) return [3 /*break*/, 6];
                        if (!(defSize == true && (this.width != 1024 || this.hight != 2048))) return [3 /*break*/, 4];
                        return [4 /*yield*/, Jimp.read(imagePath)];
                    case 1:
                        mainImage = _a.sent();
                        return [4 /*yield*/, mainImage.resize(1024, 2048)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, mainImage.writeAsync(imagePath)];
                    case 3:
                        _a.sent();
                        if (fs.existsSync(imagePath)) {
                            return [2 /*return*/, imagePath];
                        }
                        else {
                            return [2 /*return*/, undefined];
                        }
                        return [3 /*break*/, 5];
                    case 4: return [2 /*return*/, imagePath];
                    case 5: return [3 /*break*/, 7];
                    case 6: return [2 /*return*/, undefined];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    REL2File.prototype.toPNGTesting = function (imagePath, defSize) {
        return __awaiter(this, void 0, void 0, function () {
            var iWidth, iHight, mipMapStart, image, xOffset, yOffset, byteBuffer, index, mipHeader, nextMipHeader, blockOffset2, blockOffset3, blockOffset0, blockOffset1, commandOffset, command, op, count, j, currentPos, y, x, absolutX, absolutY, color, j, a0, a1, aM0, aM1, aM2, aM3, aM4, aM5, aMap, alphaArr, c0, c1, cM0, cM1, cM2, cM3, cMap, colorArr, currentPos, y, x, colorStr, alphaStr, colorPos, alphaPos, alpha, color, absolutX, absolutY, pixel, j, a0, a1, aMap2, aMap4, aMap, alphaArr, c0, c1, cMap, colorArr, currentPos, y, x, colorPos, alphaPos, alpha, color, absolutX, absolutY, created, mainImage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        iWidth = this.width;
                        iHight = this.hight;
                        mipMapStart = 0;
                        if (iHight == 4096 && iWidth == 2048) {
                            iHight = iHight / 2;
                            iWidth = iWidth / 2;
                            mipMapStart = 1;
                        }
                        image = PNGImage.createImage(iWidth, iHight);
                        xOffset = 0;
                        yOffset = 0;
                        byteBuffer = new ByteBuffer(this.buffer);
                        for (index = mipMapStart; index < (mipMapStart + 1); index++) {
                            mipHeader = this.mipHeaders[index];
                            nextMipHeader = this.mipHeaders[index + 1];
                            blockOffset2 = mipHeader.Offset2;
                            blockOffset3 = mipHeader.Offset3;
                            blockOffset0 = mipHeader.Offset0;
                            blockOffset1 = mipHeader.Offset1;
                            for (commandOffset = mipHeader.CommandOffset; commandOffset < nextMipHeader.CommandOffset; commandOffset += 2) {
                                byteBuffer.pos = commandOffset;
                                command = byteBuffer.getShort();
                                op = command & 3;
                                count = command >> 2;
                                if (op == 0) {
                                    for (j = 0; j < count; j++) {
                                        currentPos = 0;
                                        for (y = 0; y < 4; y++) {
                                            for (x = 0; x < 4; x++) {
                                                absolutX = xOffset + (3 - x);
                                                absolutY = yOffset + (3 - y);
                                                color = {
                                                    r: 0,
                                                    g: 0,
                                                    b: 0
                                                };
                                                image.setAt(absolutX, absolutY, { red: color.r, green: color.g, blue: color.b, alpha: 0 });
                                                currentPos++;
                                            }
                                        }
                                        xOffset += 4;
                                        if (xOffset >= iWidth) {
                                            xOffset = 0;
                                            yOffset += 4;
                                        }
                                        //fullTransparentAlpha.forEach((b)=>{bw.writeByte(b)});
                                        //fullTransparentAlpha.forEach((b)=>{bw.writeByte(b)});
                                    }
                                }
                                else if (op == 1) {
                                    for (j = 0; j < count; j++) {
                                        //Alpha
                                        byteBuffer.pos = blockOffset0;
                                        a0 = byteBuffer.getByte();
                                        a1 = byteBuffer.getByte();
                                        byteBuffer.pos = blockOffset1;
                                        aM0 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM1 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM2 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM3 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM4 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aM5 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        aMap = aM5 + aM4 + aM3 + aM2 + aM1 + aM0;
                                        alphaArr = this.alphaArray(a0, a1);
                                        //Color
                                        byteBuffer.pos = blockOffset2;
                                        c0 = byteBuffer.getShort();
                                        c1 = byteBuffer.getShort();
                                        byteBuffer.pos = blockOffset3;
                                        cM0 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        cM1 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        cM2 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        cM3 = byteBuffer.getByte().toString(2).padStart(8, "0");
                                        cMap = cM3 + cM2 + cM1 + cM0;
                                        colorArr = this.colorArray(c0, c1);
                                        currentPos = 0;
                                        for (y = 0; y < 4; y++) {
                                            for (x = 0; x < 4; x++) {
                                                colorStr = cMap.substring((2 * currentPos), (2 * currentPos) + 2);
                                                alphaStr = aMap.substring((3 * currentPos), (3 * currentPos) + 3);
                                                colorPos = parseInt(colorStr, 2);
                                                alphaPos = parseInt(alphaStr, 2);
                                                alpha = alphaArr[alphaPos];
                                                color = colorArr[colorPos];
                                                absolutX = xOffset + (3 - x);
                                                absolutY = yOffset + (3 - y);
                                                pixel = { red: color.r, green: color.g, blue: color.b, alpha: alpha };
                                                image.setAt(absolutX, absolutY, pixel);
                                                currentPos++;
                                            }
                                        }
                                        xOffset += 4;
                                        if (xOffset >= iWidth) {
                                            xOffset = 0;
                                            yOffset += 4;
                                        }
                                        //this.csWrite(bw,byteBuffer,blockOffset0,2);
                                        //this.csWrite(bw,byteBuffer,blockOffset1,6);
                                        //this.csWrite(bw,byteBuffer,blockOffset2,4);
                                        //this.csWrite(bw,byteBuffer,blockOffset3,4);
                                        blockOffset2 += 4;
                                        blockOffset3 += 4;
                                        blockOffset0 += 2;
                                        blockOffset1 += 6;
                                    }
                                }
                                else if (op == 2) {
                                    for (j = 0; j < count; j++) {
                                        a0 = 0;
                                        a1 = 5;
                                        aMap2 = 0xffff.toString(2).padStart(16, "0");
                                        aMap4 = 0xffffffff.toString(2).padStart(32, "0");
                                        aMap = aMap4 + aMap2;
                                        alphaArr = this.alphaArray(a0, a1);
                                        //Color
                                        byteBuffer.pos = blockOffset2;
                                        c0 = byteBuffer.getShort();
                                        c1 = byteBuffer.getShort();
                                        byteBuffer.pos = blockOffset3;
                                        cMap = byteBuffer.getInt().toString(2).padStart(32, "0");
                                        colorArr = this.colorArray(c0, c1);
                                        currentPos = 0;
                                        for (y = 0; y < 4; y++) {
                                            for (x = 0; x < 4; x++) {
                                                colorPos = parseInt(cMap.substring((2 * currentPos), (2 * currentPos) + 2), 2);
                                                alphaPos = parseInt(aMap.substring((3 * currentPos), (3 * currentPos) + 3), 2);
                                                alpha = alphaArr[alphaPos];
                                                color = colorArr[colorPos];
                                                absolutX = xOffset + (3 - x);
                                                absolutY = yOffset + (3 - y);
                                                image.setAt(absolutX, absolutY, { red: color.r, green: color.g, blue: color.b, alpha: alpha });
                                                currentPos++;
                                            }
                                        }
                                        xOffset += 4;
                                        if (xOffset >= iWidth) {
                                            xOffset = 0;
                                            yOffset += 4;
                                        }
                                        //fullOpaqueAlpha.forEach((b)=>{bw.writeByte(b)});
                                        //this.csWrite(bw,byteBuffer,blockOffset2,4);
                                        //this.csWrite(bw,byteBuffer,blockOffset3,4);
                                        blockOffset2 += 4;
                                        blockOffset3 += 4;
                                    }
                                }
                                else {
                                    console.log("ERROR - NotSupportedException");
                                }
                            }
                        }
                        //Return image and last check
                        try {
                            image.writeImageSync(imagePath);
                        }
                        catch (error) {
                            console.log(error);
                        }
                        created = fs.existsSync(imagePath);
                        if (!created) return [3 /*break*/, 6];
                        if (!(defSize == true && (iWidth != 1024 || iHight != 2048))) return [3 /*break*/, 4];
                        return [4 /*yield*/, Jimp.read(imagePath)];
                    case 1:
                        mainImage = _a.sent();
                        return [4 /*yield*/, mainImage.resize(1024, 2048)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, mainImage.writeAsync(imagePath)];
                    case 3:
                        _a.sent();
                        if (fs.existsSync(imagePath)) {
                            return [2 /*return*/, imagePath];
                        }
                        else {
                            return [2 /*return*/, undefined];
                        }
                        return [3 /*break*/, 5];
                    case 4: return [2 /*return*/, imagePath];
                    case 5: return [3 /*break*/, 7];
                    case 6: return [2 /*return*/, undefined];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    REL2File.prototype.csWrite = function (bw, byteBuffer, offset, size) {
        for (var index = 0; index < size; index++) {
            byteBuffer.pos = offset + index;
            bw.writeByte(byteBuffer.getByte());
        }
    };
    REL2File.prototype.addHexColorBase = function (color, colorBase, alphaPure) {
        var r = parseInt(colorBase.substring(0, 2), 16);
        var g = parseInt(colorBase.substring(2, 4), 16);
        var b = parseInt(colorBase.substring(4, 6), 16);
        var rgb = {
            r: r,
            g: g,
            b: b
        };
        var alpha = alphaPure / 255;
        if (alpha == 0) {
            return rgb;
        } //Is Only Base
        //Mix colors
        var ratio = 1; // alpha
        rgb.r = Math.round((color.r * alpha / ratio) + (r * 1 * (1 - alpha) / ratio)); // red
        rgb.g = Math.round((color.g * alpha / ratio) + (g * 1 * (1 - alpha) / ratio)); // green
        rgb.b = Math.round((color.b * alpha / ratio) + (b * 1 * (1 - alpha) / ratio)); // blue
        return rgb;
    };
    REL2File.prototype.colorArray = function (c0, c1) {
        var arr = [];
        arr.push(this.colorToRGB(c0));
        arr.push(this.colorToRGB(c1));
        if (c0 > c1) {
            arr.push(this.mixColors(c0, c1, (2 / 3), (1 / 3)));
            arr.push(this.mixColors(c0, c1, (1 / 3), (2 / 3)));
        }
        else {
            arr.push(this.mixColors(c0, c1, (1 / 2), (1 / 2)));
            arr.push(this.colorToRGB(0));
        }
        return arr;
    };
    REL2File.prototype.mixColors = function (c0, c1, cv1, cv2) {
        var color0 = this.colorToRGB(c0);
        var color1 = this.colorToRGB(c1);
        var r = Math.floor((cv1 * color0.r) + (cv2 * color1.r));
        var g = Math.floor((cv1 * color0.g) + (cv2 * color1.g));
        var b = Math.floor((cv1 * color0.b) + (cv2 * color1.b));
        var colorObj = {
            r: r,
            g: g,
            b: b
        };
        return colorObj;
    };
    REL2File.prototype.colorToRGB = function (color) {
        var scale = function (fromRange, toRange, value) {
            var d = (toRange[1] - toRange[0]) / (fromRange[1] - fromRange[0]);
            return Math.floor((value - fromRange[0]) * d + toRange[0]);
        };
        var colorBin = color.toString(2).padStart(16, "0");
        var r_32 = parseInt(colorBin.substring(0, 5), 2);
        var g_64 = parseInt(colorBin.substring(5, 11), 2);
        var b_32 = parseInt(colorBin.substring(11, 16), 2);
        var colorObj = {
            r: scale([0, 31], [0, 255], r_32),
            g: scale([0, 63], [0, 255], g_64),
            b: scale([0, 31], [0, 255], b_32)
        };
        return colorObj;
    };
    REL2File.prototype.alphaArray = function (a0, a1) {
        var arr = [];
        var a2, a3, a4, a5, a6, a7;
        if (a0 > a1) {
            a2 = Math.floor(((6 * a0) + (1 * a1)) / 7);
            a3 = Math.floor(((5 * a0) + (2 * a1)) / 7);
            a4 = Math.floor(((4 * a0) + (3 * a1)) / 7);
            a5 = Math.floor(((3 * a0) + (4 * a1)) / 7);
            a6 = Math.floor(((2 * a0) + (5 * a1)) / 7);
            a7 = Math.floor(((1 * a0) + (6 * a1)) / 7);
        }
        else {
            a2 = Math.floor(((4 * a0) + (1 * a1)) / 5);
            a3 = Math.floor(((3 * a0) + (2 * a1)) / 5);
            a4 = Math.floor(((2 * a0) + (3 * a1)) / 5);
            a5 = Math.floor(((1 * a0) + (4 * a1)) / 5);
            a6 = 0;
            a7 = 255;
        }
        arr.push(a0);
        arr.push(a1);
        arr.push(a2);
        arr.push(a3);
        arr.push(a4);
        arr.push(a5);
        arr.push(a6);
        arr.push(a7);
        return arr;
    };
    return REL2File;
}());
exports.REL2File = REL2File;
var LRLEFile = /** @class */ (function () {
    function LRLEFile(buffer) {
        //Basic Values
        this.magic = 0;
        this.height = 0;
        this.width = 0;
        this.version = 0;
        this.numMipMaps = 0;
        this.mipMapOffsets = [];
        this.pixelArray = [];
        this.mipPositons = [];
        this.mips = [];
        this.buffer = buffer;
        this.calculateData();
    }
    LRLEFile.prototype.calculateData = function () {
        var byteBuffer = new ByteBuffer(this.buffer);
        this.magic = byteBuffer.getInt();
        if (this.magic != 0x454C524C) {
            throw new Error("Wrong file type");
        }
        this.version = byteBuffer.getInt();
        if (!(this.version == 0x32303056 || this.version == 0x0)) {
            throw new Error("LRLE Version not supported!");
        }
        this.width = byteBuffer.getShort();
        this.height = byteBuffer.getShort();
        this.numMipMaps = byteBuffer.getInt();
        this.mipMapOffsets = [];
        for (var index = 0; index < this.numMipMaps; index++) {
            this.mipMapOffsets.push(byteBuffer.getInt());
        }
        if (this.version == 0x32303056) {
            var numPixels = byteBuffer.getInt();
            this.pixelArray = [];
            for (var index = 0; index < numPixels; index++) {
                var b1 = byteBuffer.getByte();
                var b2 = byteBuffer.getByte();
                var b3 = byteBuffer.getByte();
                var b4 = byteBuffer.getByte();
                this.pixelArray.push([b1, b2, b3, b4]);
            }
        }
        this.mips = [];
        this.mipPositons = [];
        for (var index = 0; index < this.numMipMaps; index++) {
            var pos = byteBuffer.pos;
            this.mipPositons.push(pos);
            var toRead = 0;
            if (index < this.numMipMaps - 1) {
                toRead = this.mipMapOffsets[index + 1] - this.mipMapOffsets[index];
            }
            else {
                toRead = byteBuffer.array.length - pos;
            }
            this.mips.push(byteBuffer.getSection(toRead));
        }
    };
    LRLEFile.prototype.exportImage = function (filepath, defsize) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.version == 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.exportImageV1(filepath, defsize)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 2:
                        if (!(this.version == 0x32303056)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.exportImageV2(filepath, defsize)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4: throw new Error("Unknown LRLE Version!");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    LRLEFile.prototype.exportImageV1 = function (filepath, defsize) {
        return __awaiter(this, void 0, void 0, function () {
            var mipLevel, mip, tot, pointer, pixelPointer, w, h, index, pixels, currentInstruction, previousInstruction, count, instruct, obj2, i, obj0, i, calc, newPixels, i, blockPixels, x, y, w1, i, j, image, xp, yp, index, r, g, b, a;
            return __generator(this, function (_a) {
                mipLevel = 0;
                if (defsize && this.width != 1024) {
                    switch (this.width) {
                        case 2048:
                            mipLevel = 1;
                            break;
                        case 4096:
                            mipLevel = 2;
                            break;
                    }
                }
                mip = this.mips[mipLevel];
                tot = 0;
                pointer = 0;
                pixelPointer = 0;
                w = this.width;
                h = this.height;
                for (index = 0; index < mipLevel; index++) {
                    w = w / 2;
                    h = h / 2;
                }
                pixels = new Array(w * h * 4);
                currentInstruction = 0;
                previousInstruction = 0;
                count = 0;
                while (pointer < mip.length) {
                    instruct = mip[pointer] & 3;
                    switch (instruct) {
                        case 1:
                            previousInstruction = currentInstruction;
                            currentInstruction = pointer;
                            count = mip[pointer] >> 2;
                            pointer++;
                            tot += count;
                            this.copyArray(mip, pointer, pixels, pixelPointer, 4 * count);
                            pixelPointer += 4 * count;
                            pointer += 4 * count;
                            break;
                        case 2: //run of single embedded color
                            previousInstruction = currentInstruction;
                            currentInstruction = pointer;
                            obj2 = this.getPixelRunLength(mip, pointer);
                            count = obj2.count;
                            pointer = obj2.pointer;
                            tot += count;
                            pointer++;
                            for (i = 0; i < count; i++) {
                                this.copyArray(mip, pointer, pixels, pixelPointer, 4);
                                pixelPointer += 4;
                            }
                            pointer += 4;
                            break;
                        case 0: //run of zero's
                            previousInstruction = currentInstruction;
                            currentInstruction = pointer;
                            obj0 = this.getPixelRunLength(mip, pointer);
                            count = obj0.count;
                            pointer = obj0.pointer;
                            tot += count;
                            pointer++;
                            for (i = 0; i < count * 4; i++) {
                                pixels[pixelPointer] = 0;
                                pixelPointer++;
                            }
                            break;
                        case 3:
                            //Another type of RLE to parse, great.
                            previousInstruction = currentInstruction;
                            currentInstruction = pointer;
                            count = mip[pointer] >> 2;
                            pointer++;
                            calc = this.readEmbeddedRLE(mip, count, pointer);
                            newPixels = calc.result;
                            pointer = calc.pointer;
                            //console.log(newPixels);
                            for (i = 0; i < count; i++) {
                                pixels[pixelPointer] = newPixels[i];
                                pixels[pixelPointer + 1] = newPixels[i + count];
                                pixels[pixelPointer + 2] = newPixels[i + 2 * count];
                                pixels[pixelPointer + 3] = newPixels[i + 3 * count];
                                pixelPointer += 4;
                            }
                            tot += count;
                            break;
                        default:
                            throw new Error("Somthing went wrong [exportImageV1]");
                    }
                }
                blockPixels = new Array(pixels.length);
                x = 0, y = 0;
                w1 = w * 4;
                for (i = 0; i < pixels.length; i += 64) {
                    for (j = 0; j < 4; j++) {
                        this.copyArray(pixels, i + (j * 16), blockPixels, (y * w1) + x, 16);
                        y++;
                    }
                    x += 16;
                    if (x >= w1) {
                        x = 0;
                    }
                    else {
                        y -= 4;
                    }
                }
                image = PNGImage.createImage(w, h);
                xp = 0;
                yp = 0;
                for (index = 0; index < blockPixels.length; index += 4) {
                    r = blockPixels[index + 2];
                    g = blockPixels[index + 1];
                    b = blockPixels[index + 0];
                    a = blockPixels[index + 3];
                    image.setAt(xp, yp, { red: r, green: g, blue: b, alpha: a });
                    xp++;
                    if (xp == w) {
                        xp = 0;
                        yp++;
                    }
                }
                image.writeImageSync(filepath);
                return [2 /*return*/];
            });
        });
    };
    LRLEFile.prototype.exportImageV2 = function (filepath, defsize) {
        return __awaiter(this, void 0, void 0, function () {
            var mipLevel, mip, tot, pointer, pixelPointer, w, h, index, pixels, currentInstruction, previousInstruction, count, obj, count_1, i, obj, count_2, i, obj, count_3, i, obj_1, index, obj, count_4, index, i, obj, count_5, b1, b2, index, i, blockPixels, x, y, w1, i, j, image, xp, yp, index, r, g, b, a;
            return __generator(this, function (_a) {
                mipLevel = 0;
                if (defsize && this.width != 1024) {
                    switch (this.width) {
                        case 2048:
                            mipLevel = 1;
                            break;
                        case 4096:
                            mipLevel = 2;
                            break;
                    }
                }
                mip = this.mips[mipLevel];
                tot = 0;
                pointer = 0;
                pixelPointer = 0;
                w = this.width;
                h = this.height;
                for (index = 0; index < mipLevel; index++) {
                    w = w / 2;
                    h = h / 2;
                }
                pixels = new Array(w * h * 4);
                currentInstruction = 0;
                previousInstruction = 0;
                count = 0;
                try {
                    while (pointer < mip.length) {
                        if ((mip[pointer] & 0x01) > 0 && (mip[pointer] & 0x02) > 0) // bits 1 & 2 set - copy following pixel values
                         {
                            previousInstruction = pointer;
                            obj = this.getPixelRunLength(mip, pointer);
                            count_1 = obj.count;
                            pointer = obj.pointer;
                            tot += count_1;
                            pointer++;
                            for (i = 0; i < count_1; i++) {
                                this.copyArray(mip, pointer, pixels, pixelPointer, 4);
                                pixelPointer += 4;
                                pointer += 4;
                            }
                        }
                        else if ((mip[pointer] & 0x01) == 0 && (mip[pointer] & 0x02) > 0 && (mip[pointer] & 0x04) > 0) //bits 2 & 4 set - repeat following pixel
                         {
                            previousInstruction = pointer;
                            obj = this.getRepeatRunLength(mip, pointer);
                            count_2 = obj.count;
                            pointer = obj.pointer;
                            tot += count_2;
                            pointer++;
                            for (i = 0; i < count_2; i++) {
                                this.copyArray(mip, pointer, pixels, pixelPointer, 4);
                                pixelPointer += 4;
                            }
                            pointer += 4;
                        }
                        else if ((mip[pointer] & 0x01) > 0 && (mip[pointer] & 0x02) == 0) //copy pixels for following indexes
                         {
                            previousInstruction = pointer;
                            obj = this.getPixelRunLength(mip, pointer);
                            count_3 = obj.count;
                            pointer = obj.pointer;
                            tot += count_3;
                            pointer++;
                            for (i = 0; i < count_3; i++) {
                                obj_1 = this.getColorIndex(mip, pointer);
                                index = obj_1.count;
                                pointer = obj_1.pointer;
                                this.copyArray(this.pixelArray[index], 0, pixels, pixelPointer, 4);
                                pixelPointer += 4;
                                pointer++;
                            }
                        }
                        else if ((mip[pointer] & 0x02) > 0 && (mip[pointer] & 0x01) == 0 && (mip[pointer] & 0x04) == 0) //repeat count, one let index
                         {
                            previousInstruction = pointer;
                            obj = this.getRepeatRunLength(mip, pointer);
                            count_4 = obj.count;
                            pointer = obj.pointer;
                            // let count = (mip[pointer] >= 0x80) ? RunReader(mip, ref pointer) : mip[pointer] / 8;
                            tot += count_4;
                            pointer++;
                            index = mip[pointer];
                            for (i = 0; i < count_4; i++) {
                                this.copyArray(this.pixelArray[index], 0, pixels, pixelPointer, 4);
                                pixelPointer += 4;
                            }
                            pointer++;
                        }
                        else if ((mip[pointer] & 0x04) > 0 && (mip[pointer] & 0x01) == 0 && (mip[pointer] & 0x02) == 0) //repeat count, two let index
                         {
                            previousInstruction = pointer;
                            obj = this.getRepeatRunLength(mip, pointer);
                            count_5 = obj.count;
                            pointer = obj.pointer;
                            // let count = (mip[pointer] >= 0x80) ? RunReader(mip, ref pointer) : mip[pointer] / 8;
                            tot += count_5;
                            pointer++;
                            b1 = mip[pointer] & 0xFF;
                            b2 = (mip[pointer + 1] & 0xFF) << 8;
                            index = b1 | b2;
                            for (i = 0; i < count_5; i++) {
                                this.copyArray(this.pixelArray[index], 0, pixels, pixelPointer, 4);
                                pixelPointer += 4;
                            }
                            pointer += 2;
                        }
                        else {
                            throw new Error("LRLE V2 ERROR");
                        }
                    }
                }
                catch (error) {
                    console.log(error);
                }
                blockPixels = new Array(pixels.length);
                x = 0, y = 0;
                w1 = w * 4;
                for (i = 0; i < pixels.length; i += 64) {
                    for (j = 0; j < 4; j++) {
                        this.copyArray(pixels, i + (j * 16), blockPixels, (y * w1) + x, 16);
                        y++;
                    }
                    x += 16;
                    if (x >= w1) {
                        x = 0;
                    }
                    else {
                        y -= 4;
                    }
                }
                image = PNGImage.createImage(w, h);
                xp = 0;
                yp = 0;
                for (index = 0; index < blockPixels.length; index += 4) {
                    r = blockPixels[index + 2];
                    g = blockPixels[index + 1];
                    b = blockPixels[index + 0];
                    a = blockPixels[index + 3];
                    image.setAt(xp, yp, { red: r, green: g, blue: b, alpha: a });
                    xp++;
                    if (xp == w) {
                        xp = 0;
                        yp++;
                    }
                }
                image.writeImageSync(filepath);
                return [2 /*return*/];
            });
        });
    };
    LRLEFile.prototype.getPixelRunLength = function (mip0, pointer) {
        var count = ((mip0[pointer] & 0x7f) >> 2);
        var shift = 5;
        while ((mip0[pointer] & 0x80) != 0) {
            pointer++;
            count += (((mip0[pointer] & 0x7f)) << shift);
            shift += 7;
        }
        return { count: count, pointer: pointer };
    };
    LRLEFile.prototype.getRepeatRunLength = function (mip0, pointer) {
        var count = ((mip0[pointer] & 0x7F) >> 3);
        var shift = 4;
        while ((mip0[pointer] & 0x80) != 0) {
            pointer++;
            count += (((mip0[pointer] & 0x7f)) << shift);
            shift += 7;
        }
        return { count: count, pointer: pointer };
    };
    LRLEFile.prototype.getColorIndex = function (mip0, pointer) {
        var count = ((mip0[pointer] & 0x7f));
        var shift = 7;
        while ((mip0[pointer] & 0x80) != 0) {
            pointer++;
            count += (((mip0[pointer] & 0x7f)) << shift);
            shift += 7;
        }
        return { count: count, pointer: pointer };
    };
    LRLEFile.prototype.readEmbeddedRLE = function (data, pixelCount, pointer) {
        var result = new Array(pixelCount * 4);
        var resultPtr = 0;
        while (resultPtr < pixelCount * 4) {
            if ((data[pointer] & 1) == 1) //run of bytes
             {
                var count = (data[pointer] & 0x7F) >> 1;
                if ((data[pointer] & 0x80) == 0x80) {
                    pointer++;
                    count += ((data[pointer]) << 6);
                }
                pointer++;
                this.copyArray(data, pointer, result, resultPtr, count);
                resultPtr += count;
                pointer += count;
            }
            else if ((data[pointer] & 2) == 2) //repeating run
             {
                var count = (data[pointer] & 0x7F) >> 2;
                if ((data[pointer] & 0x80) == 0x80) {
                    pointer++;
                    count += (data[pointer]) << 5;
                }
                pointer++;
                for (var i = 0; i < count; i++) {
                    result[resultPtr] = data[pointer];
                    resultPtr++;
                }
                pointer++;
            }
            else //run of zero's
             {
                var count = (data[pointer] & 0x7F) >> 2;
                if ((data[pointer] & 0x80) == 0x80) {
                    pointer++;
                    count += (data[pointer]) << 5;
                }
                for (var i = 0; i < count; i++) {
                    result[resultPtr] = 0;
                    resultPtr++;
                }
                pointer++;
            }
        }
        return { result: result, pointer: pointer };
    };
    LRLEFile.prototype.copyArray = function (arr0, pos0, arr1, pos1, count) {
        for (var index = 0; index < count; index++) {
            var index0 = pos0 + index;
            var index1 = pos1 + index;
            arr1[index1] = arr0[index0];
        }
    };
    return LRLEFile;
}());
exports.LRLEFile = LRLEFile;
var CASPFile = /** @class */ (function () {
    function CASPFile(buffer) {
        this.instanceID = "";
        this.error = false;
        //Values
        this.version = 0;
        this.tgiOffset = 0;
        this.presetCount = 0;
        this.name = "";
        this.propID = 0;
        this.flagList = [];
        this.bodyType = 0;
        this.bodySubType = 0;
        this.ageGender = 0;
        this.species = 0;
        this.packID = 0;
        this.TGIList = [];
        this.primSortIndex = undefined;
        this.secSortIndex = undefined;
        this.swatches = [];
        this.sortLayer = 0;
        this.lodLevels = [];
        this.diffuseIndex = -1;
        this.shadowIndex = -1;
        this.compositionMode = 0;
        this.regionMapIndex = -1;
        this.buffer = buffer;
        this.calculateData();
    }
    CASPFile.prototype.calculateData = function () {
        var byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getInt();
        this.tgiOffset = byteBuffer.getInt();
        this.tgiOffset += 8;
        this.presetCount = byteBuffer.getInt();
        this.handleName(byteBuffer);
        if (this.error)
            return;
        this.primSortIndex = byteBuffer.getFloat();
        this.secSortIndex = byteBuffer.getShort();
        this.propID = byteBuffer.getInt();
        byteBuffer.skip(4);
        if (this.version >= 0x32)
            byteBuffer.skip(28);
        if (this.version >= 0x29 && this.version < 0x32)
            byteBuffer.skip(1 + 1 + 8 + 8 + 8);
        if (this.version == 0x28)
            byteBuffer.skip(1 + 1 + 8 + 8);
        if (this.version == 0x25)
            byteBuffer.skip(1 + 8 + 8);
        if (this.version <= 0x20)
            byteBuffer.skip(13);
        var length_flag = byteBuffer.getInt() & 0x000000ff;
        for (var i = 0; i < length_flag; i++) {
            var pair = { "a": byteBuffer.getShort(), "b": byteBuffer.getShort() };
            this.flagList.push(pair);
            if (this.version >= 0x21)
                byteBuffer.skip(2);
        }
        if (this.version >= 0x2b)
            byteBuffer.skip(4 + 4 + 4 + 4 + 1);
        if (this.version <= 0x2a)
            byteBuffer.skip(4 + 4 + 4 + 1);
        this.bodyType = byteBuffer.getInt();
        this.bodySubType = byteBuffer.getInt();
        this.ageGender = byteBuffer.getInt();
        var posBefore = byteBuffer.pos;
        if (this.version >= 0x20) {
            this.species = byteBuffer.getInt();
        }
        if (this.version >= 34) {
            this.packID = byteBuffer.getShort();
        }
        else {
            this.packID = 0;
        }
        byteBuffer.pos = posBefore;
        //Swatch color
        if (this.version >= 0x25) {
            byteBuffer.skip(16);
        }
        else if (this.version == 0x20) {
            byteBuffer.skip(6);
        }
        else {
            byteBuffer.skip(2);
        }
        var swatchColorListLength = byteBuffer.getByte();
        for (var index = 0; index < swatchColorListLength; index++) {
            var color = byteBuffer.getInt();
            this.swatches.push(color);
        }
        if (this.version == 0x1A) {
            byteBuffer.skip(12 + 4 - 7);
        }
        else if (this.version <= 0x1c) {
            byteBuffer.skip(12 + 4);
        }
        else if (this.version == 0x1E) {
            byteBuffer.skip(29);
        }
        else if (this.version == 0x1F) {
            byteBuffer.skip(33); // Is Wrong
        }
        else if (this.version >= 0x20 && this.version <= 0x25) {
            byteBuffer.skip(33);
        }
        else if (this.version >= 0x28 && this.version <= 0x29) {
            byteBuffer.skip(49);
        }
        else if (this.version >= 0x2A && this.version < 0x2E) {
            byteBuffer.skip(49);
        }
        else if (this.version >= 0x2E) {
            byteBuffer.skip(102);
        }
        byteBuffer.pos = byteBuffer.pos - 4;
        this.sortLayer = byteBuffer.getInt();
        //LOD
        var lodLength = byteBuffer.getByte();
        var lodList = [];
        for (var index = 0; index < lodLength; index++) {
            var lodLevel = byteBuffer.getByte();
            var unused = byteBuffer.getInt();
            var lodAssetListLength = byteBuffer.getByte();
            for (var assetIndex = 0; assetIndex < lodAssetListLength; assetIndex++) {
                var sorting = byteBuffer.getInt();
                var specLevel = byteBuffer.getInt();
                var castShadow = byteBuffer.getInt();
            }
            var byteIndexListLength = byteBuffer.getByte();
            var geomList = [];
            for (var byteIndex = 0; byteIndex < byteIndexListLength; byteIndex++) {
                var byteIndexValue = byteBuffer.getByte();
                geomList.push(byteIndexValue);
            }
            var arr = [];
            var obj = {
                "level": lodLevel,
                "indexList": geomList,
                "list": arr
            };
            lodList.push(obj);
        }
        //Slot key?
        var slotLength = byteBuffer.getByte();
        for (var index = 0; index < slotLength; index++) {
            var value = byteBuffer.getByte();
        }
        //DiffuseKey
        this.diffuseIndex = byteBuffer.getByte();
        this.shadowIndex = byteBuffer.getByte();
        this.compositionMode = byteBuffer.getByte();
        this.regionMapIndex = byteBuffer.getByte();
        //TGI
        byteBuffer.pos = this.tgiOffset;
        var size = byteBuffer.getByte();
        for (var i = 0; i < size; i++) {
            var d = byteBuffer.getSection(8);
            var l3 = d.readBigUInt64LE();
            var l2 = byteBuffer.getInt();
            var l1 = byteBuffer.getInt();
            var st = l1.toString(16).padStart(8, "0") + "-" + l2.toString(16).padStart(8, "0") + "-" + l3.toString(16).padStart(16, "0");
            this.TGIList.push(st);
        }
        try {
            for (var index = 0; index < lodList.length; index++) {
                var element = lodList[index];
                var ids = [];
                for (var i = 0; i < element.indexList.length; i++) {
                    var value = element.indexList[i];
                    ids.push(this.TGIList[value]);
                }
                element.list = ids;
            }
            this.lodLevels = lodList;
        }
        catch (error) {
            console.log("ERROR in version: " + this.version.toString(16));
            this.error = true;
        }
    };
    CASPFile.prototype.handleName = function (byteBuffer) {
        var word_length = this.readUnsignedLeb128(byteBuffer);
        //console.log("Length: "+word_length);
        if (word_length == -1) {
            this.error = true;
            return;
        }
        var nameBuffer = byteBuffer.getSection(word_length);
        this.name = String.fromCharCode.apply(String, Array.from(nameBuffer));
    };
    CASPFile.prototype.readUnsignedLeb128 = function (bb) {
        var result = 0;
        var cur = 0;
        var count = 0;
        do {
            cur = bb.getByte();
            result |= (cur & 0x7f) << (count * 7);
            count++;
        } while (((cur & 0x80) == 0x80) && count < 5);
        if ((cur & 0x80) == 0x80) {
            return -1;
        }
        return result;
    };
    CASPFile.prototype.getRelevantAddresses = function () {
        var lodSet = new Set();
        this.lodLevels.forEach(function (level) {
            level.list.forEach(function (address) {
                lodSet.add(address);
            });
        });
        return {
            lod: Array.from(lodSet),
            diffuse: (this.diffuseIndex != -1) ? this.TGIList[this.diffuseIndex] : undefined
        };
    };
    CASPFile.prototype.getLodAndDiffuse = function () {
        return {
            instance: this.instanceID,
            lod: this.lodLevels,
            diffuse: (this.diffuseIndex != -1) ? this.TGIList[this.diffuseIndex] : undefined
        };
    };
    return CASPFile;
}());
exports.CASPFile = CASPFile;
var CASPResource = /** @class */ (function () {
    function CASPResource() {
        this.species = new Set();
        this.packIDs = new Set();
        this.age = new Set();
        this.gender = new Set();
        this.bodyType = new Set();
        this.bodyTypePlain = new Set();
        this.casFlags = new Set();
        this.instances = new Set();
        this.tgi_list = new Set();
        this.hasGeometry = false;
        this.isRecolor = false;
        this.isMerged = false;
        this.propIds = new Set(); // length != 1 -> merged
        this.priSortOrder = new Set();
        this.secSortOrder = new Set();
        this.caspFiles = [];
    }
    CASPResource.prototype.addFile = function (file) {
        this.caspFiles.push(file);
        var id = file.propID.toString(16).padStart(8, "0");
        if (this.propIds.has(id)) {
            return;
        }
        this.propIds.add(id);
        this.isMerged = this.propIds.size > 1;
        //Fill TGI
        for (var index = 0; index < file.TGIList.length; index++) {
            var element = file.TGIList[index];
            if (!this.tgi_list.has(element))
                this.tgi_list.add(element);
        }
        //Instances
        this.instances.add(file.instanceID);
        //AgeGender
        var ag_bin = file.ageGender.toString(2).padStart(16, "0");
        //Age
        if (ag_bin.charAt(15) == "1")
            this.age.add("[BABY]");
        if (ag_bin.charAt(14) == "1")
            this.age.add("[TODDLER]");
        if (ag_bin.charAt(13) == "1")
            this.age.add("[CHILD]");
        if (ag_bin.charAt(12) == "1")
            this.age.add("[TEEN]");
        if (ag_bin.charAt(11) == "1")
            this.age.add("[YOUNGADULT]");
        if (ag_bin.charAt(10) == "1")
            this.age.add("[ADULT]");
        if (ag_bin.charAt(9) == "1")
            this.age.add("[ELDER]");
        if (ag_bin.charAt(8) == "1")
            this.age.add("[INFANT]");
        //Gender
        if (ag_bin.charAt(2) == "1")
            this.gender.add("[FEMALE]");
        if (ag_bin.charAt(3) == "1")
            this.gender.add("[MALE]");
        //BodyType
        var bodyTypes = [];
        CASPMapper.readValues(file.bodyType, file.flagList, bodyTypes);
        var bodyTag = CASPMapper.NumberToType.get(file.bodyType);
        if (bodyTag != undefined)
            this.bodyTypePlain.add(bodyTag);
        //console.log(bodyTypes);
        for (var index = 0; index < bodyTypes.length; index++) {
            var element = bodyTypes[index];
            var str = CASPMapper.getArrayFormTag(element);
            if (str.length != 0) {
                this.bodyType.add(str);
                //console.log(str);
            }
        }
        //Cas flags
        var list = file.flagList;
        for (var index = 0; index < list.length; index++) {
            var element = list[index];
            var tag = element.a;
            var value = element.b;
            var st = "0x" + tag.toString(16).padStart(4, "0") + "-0x" + value.toString(16).padStart(4, "0");
            this.casFlags.add(st);
        }
        //Sort Order
        this.priSortOrder.add(file.primSortIndex);
        this.secSortOrder.add(file.secSortIndex);
        //Species
        this.species.add(file.species);
        //PackID
        if (file.packID != 0)
            this.packIDs.add(file.packID);
    };
    CASPResource.prototype.checkRecolor = function () {
        if (this.bodyType.size == 0)
            return false;
        var onlyGood = true;
        this.bodyTypePlain.forEach(function (element) {
            if (CASPMapper.PartsWithoutGeom.has(element)) {
                onlyGood = false;
            }
        });
        return onlyGood;
    };
    return CASPResource;
}());
exports.CASPResource = CASPResource;
var OBJDFile = /** @class */ (function () {
    function OBJDFile(buffer) {
        this.instanceID = "";
        this.error = false;
        this.version = 0;
        this.unk1 = 0;
        this.name = "";
        this.tuning = "";
        this.tuningID = BigInt(0);
        this.propertyIDList = [];
        this.icon = undefined;
        this.rig = undefined;
        this.slot = undefined;
        this.model = undefined;
        this.footprint = undefined;
        this.simpleList = [];
        this.materialVariant = "";
        this.materialVariantHash = 0;
        this.unknown1 = 0;
        this.simoleonPrice = 0;
        this.positiveEnvironmentScore = 0.0;
        this.negativeEnvironmentScore = 0.0;
        this.thumbnailGeometryState = 0;
        this.Unknown2 = false;
        //CatalogTagList environmentScoreEmotionTags;
        this.environmentScores = [];
        this.unknown3 = BigInt(0);
        this.isBaby = false;
        this.unknown4 = [];
        if (!buffer)
            return;
        this.buffer = buffer;
        this.calculateData();
    }
    OBJDFile.prototype.calculateData = function () {
        if (!this.buffer)
            throw new Error("No Buffer");
        var byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getShort();
        var tablePositon = byteBuffer.getInt();
        this.propertyIDList = [];
        this.simpleList = [];
        byteBuffer.pos = tablePositon;
        var entryCount = byteBuffer.getShort();
        for (var index = 0; index < entryCount; index++) {
            var type = byteBuffer.getInt();
            this.propertyIDList.push(type);
            var offset = byteBuffer.getInt();
            var nextPos = byteBuffer.pos;
            byteBuffer.pos = offset;
            var tgiType = undefined;
            switch (type) {
                case PropertyID.Name:
                    this.name = byteBuffer.readString();
                    break;
                case PropertyID.Tuning:
                    this.tuning = byteBuffer.readString();
                    break;
                case PropertyID.TuningID:
                    this.tuningID = byteBuffer.getLong();
                    break;
                case PropertyID.Icon:
                    this.icon = this.readTGIBlock(byteBuffer);
                    break;
                case PropertyID.Rig:
                    this.rig = this.readTGIBlock(byteBuffer);
                    break;
                case PropertyID.Slot:
                    this.slot = this.readTGIBlock(byteBuffer);
                    break;
                case PropertyID.Model:
                    //console.log("modelTyoe: "+tgiType);
                    this.model = this.readTGIBlock(byteBuffer);
                    break;
                case PropertyID.Footprint:
                    this.footprint = this.readTGIBlock(byteBuffer);
                    break;
                case PropertyID.Components:
                    var compCount = byteBuffer.getInt();
                    for (var j = 0; j < compCount; j++) {
                        this.simpleList.push(byteBuffer.getInt());
                    }
                    break;
                case PropertyID.MaterialVariant:
                    this.materialVariant = byteBuffer.readString();
                    this.materialVariantHash = Number(SimsHashes.fnv1_32(this.materialVariant, false).num);
                    break;
                case PropertyID.Unknown1:
                    this.unk1 = byteBuffer.getByte();
                    break;
                case PropertyID.SimoleonPrice:
                    this.simoleonPrice = byteBuffer.getInt();
                    break;
                case PropertyID.PositiveEnvironmentScore:
                    this.positiveEnvironmentScore = byteBuffer.getFloat();
                    break;
                case PropertyID.NegativeEnvironmentScore:
                    this.negativeEnvironmentScore = byteBuffer.getFloat();
                    break;
                case PropertyID.ThumbnailGeometryState:
                    this.thumbnailGeometryState = byteBuffer.getInt();
                    break;
                case PropertyID.Unknown2:
                    this.Unknown2 = byteBuffer.getByte() == 1;
                    break;
                case PropertyID.EnvironmentScoreEmotionTags:
                    console.log("Cant Read EnvironmentScoreEmotionTags");
                    //Ignore!
                    /*let countESET = byteBuffer.getInt();
                    let tags = [];
                    for (let j = 0; j < countESET; j++) {
                        tags.push(byteBuffer.getInt());
                    }*/
                    break;
                case PropertyID.EnvironmentScores:
                    var count = byteBuffer.getInt();
                    for (var i = 0; i < count; i++) {
                        this.environmentScores.push(byteBuffer.getFloat());
                    }
                    break;
                case PropertyID.Unknown3:
                    this.unknown3 = byteBuffer.getLong();
                    break;
                case PropertyID.IsBaby:
                    this.isBaby = byteBuffer.getByte() == 1;
                    break;
                case PropertyID.Unknown4:
                    var c4 = byteBuffer.getInt();
                    for (var i = 0; i < c4; i++) {
                        this.unknown4.push(byteBuffer.getByte());
                    }
                    break;
            }
            byteBuffer.pos = nextPos;
        }
        /*this.unk1 = byteBuffer.getInt();
        let nameLength =  byteBuffer.getInt(); //? readUnsignedLeb128
        this.name = byteBuffer.getSection(nameLength).toString();
        let tuningLength = byteBuffer.getInt();
        this.tuning = byteBuffer.getSection(tuningLength).toString();
        this.tuningID = byteBuffer.getLong();*/
    };
    OBJDFile.prototype.readTGIBlock = function (bb, order) {
        if (order === void 0) { order = 4; }
        var count = bb.getInt() / 4;
        var tgiList = [];
        for (var i = 0; i < count; i++) {
            var instance = BigInt(0);
            var type = 0;
            var group = 0;
            if (order == 4) {
                instance = bb.getLong();
                instance = Basic.swapFirstAndLast4Bytes(instance); // swap instance
                type = bb.getInt();
                group = bb.getInt();
            }
            else if (order == 0) {
                type = bb.getInt();
                group = bb.getInt();
                instance = bb.getLong();
                instance = Basic.swapFirstAndLast4Bytes(instance);
            }
            tgiList.push({ instance: instance, type: type, group: group });
        }
        return tgiList;
    };
    OBJDFile.prototype.writeTGIBlock = function (bw, tgiList, order) {
        if (order === void 0) { order = 4; }
        var count = tgiList.length * 4;
        bw.writeInt(count);
        for (var i = 0; i < tgiList.length; i++) {
            var _a = tgiList[i], instance = _a.instance, type = _a.type, group = _a.group;
            if (order == 4) {
                instance = Basic.swapFirstAndLast4Bytes(instance); // swap instance back
                bw.writeBigInt(instance);
                bw.writeInt(type);
                bw.writeInt(group);
            }
            else if (order == 0) {
                bw.writeInt(type);
                bw.writeInt(group);
                instance = Basic.swapFirstAndLast4Bytes(instance); // swap instance back
                bw.writeBigInt(instance);
            }
        }
    };
    OBJDFile.prototype.calulateNewBuffer = function () {
        var bw = new BinaryWritter();
        bw.writeShort(this.version);
        // Placeholder for table position
        var tablePositionOffset = bw.pos;
        bw.writeInt(0);
        var entryOffsets = [];
        for (var _i = 0, _a = this.propertyIDList; _i < _a.length; _i++) {
            var type = _a[_i];
            entryOffsets.push({ type: type, offset: bw.pos });
            switch (type) {
                case PropertyID.Name:
                    bw.writeString(this.name);
                    break;
                case PropertyID.Tuning:
                    bw.writeString(this.tuning);
                    break;
                case PropertyID.TuningID:
                    bw.writeBigIntCap(this.tuningID);
                    break;
                case PropertyID.Icon:
                    if (this.icon)
                        this.writeTGIBlock(bw, this.icon);
                    break;
                case PropertyID.Rig:
                    if (this.rig)
                        this.writeTGIBlock(bw, this.rig);
                    break;
                case PropertyID.Slot:
                    if (this.slot)
                        this.writeTGIBlock(bw, this.slot);
                    break;
                case PropertyID.Model:
                    if (this.model)
                        this.writeTGIBlock(bw, this.model);
                    break;
                case PropertyID.Footprint:
                    if (this.footprint)
                        this.writeTGIBlock(bw, this.footprint);
                    break;
                case PropertyID.Components:
                    bw.writeInt(this.simpleList.length);
                    for (var _b = 0, _c = this.simpleList; _b < _c.length; _b++) {
                        var item = _c[_b];
                        bw.writeInt(item);
                    }
                    break;
                case PropertyID.MaterialVariant:
                    bw.writeString(this.materialVariant);
                    break;
                case PropertyID.Unknown1:
                    bw.writeByte(this.unk1);
                    break;
                case PropertyID.SimoleonPrice:
                    bw.writeInt(this.simoleonPrice);
                    break;
                case PropertyID.PositiveEnvironmentScore:
                    bw.writeFloat(this.positiveEnvironmentScore);
                    break;
                case PropertyID.NegativeEnvironmentScore:
                    bw.writeFloat(this.negativeEnvironmentScore);
                    break;
                case PropertyID.ThumbnailGeometryState:
                    bw.writeInt(this.thumbnailGeometryState);
                    break;
                case PropertyID.Unknown2:
                    bw.writeByte(this.Unknown2 ? 1 : 0);
                    break;
                case PropertyID.EnvironmentScores:
                    bw.writeInt(this.environmentScores.length);
                    for (var _d = 0, _e = this.environmentScores; _d < _e.length; _d++) {
                        var score = _e[_d];
                        bw.writeFloat(score);
                    }
                    break;
                case PropertyID.Unknown3:
                    bw.writeBigIntCap(this.unknown3);
                    break;
                case PropertyID.IsBaby:
                    bw.writeByte(this.isBaby ? 1 : 0);
                    break;
                case PropertyID.Unknown4:
                    bw.writeInt(this.unknown4.length);
                    for (var _f = 0, _g = this.unknown4; _f < _g.length; _f++) {
                        var item = _g[_f];
                        bw.writeByte(item);
                    }
                    break;
            }
        }
        // Update table position
        var tablePosition = bw.pos;
        bw.seek(tablePositionOffset);
        bw.writeInt(tablePosition);
        bw.seek(tablePosition);
        // Write entry count
        bw.writeShort(this.propertyIDList.length);
        for (var _h = 0, entryOffsets_1 = entryOffsets; _h < entryOffsets_1.length; _h++) {
            var data = entryOffsets_1[_h];
            bw.writeInt(data.type);
            bw.writeInt(data.offset); // Placeholder for offset
        }
        return bw.toBuffer();
    };
    return OBJDFile;
}());
exports.OBJDFile = OBJDFile;
var COBJFile = /** @class */ (function () {
    function COBJFile(buffer, type) {
        this.instanceID = "";
        this.error = false;
        this.type = 0;
        this.version = 0;
        this.nameHash = 0;
        this.descriptionHash = 0;
        this.commonBlockVersion = 0;
        this.devCategoryFlags = 0;
        this.price = 0;
        this.tgiBlockList = [];
        this.catalogTagList = new Set();
        this.sellingpoints = [];
        this.unlockByHash = 0;
        this.unlockedByHash = 0;
        this.swatchColorsSortPriority = 0;
        this.varientThumbImageHash = BigInt(0);
        this.auralMaterialsVersion = 0;
        this.auralMaterials1 = 0;
        this.auralMaterials2 = 0;
        this.auralMaterials3 = 0;
        this.auralPropertiesVersion = 0;
        this.auralQuality = 0;
        this.auralAmbientObject = 0;
        this.ambienceFileInstanceId = BigInt(0);
        this.isOverrideAmbience = 0;
        this.unknown01 = 0;
        this.unknown02 = 0;
        this.unused0 = 0;
        this.unused1 = 0;
        this.unused2 = 0;
        this.placementFlagsHigh = 0;
        this.placementFlagsLow = 0;
        this.slotTypeSet = BigInt(0);
        this.slotDecoSize = 0;
        this.catalogGroup = BigInt(0);
        this.stateUsage = 0;
        this.colors = [];
        this.fenceHeight = 0;
        this.isStackable = 0;
        this.canItemDepreciate = 0;
        this.packId = 0;
        this.packFlag = 0;
        this.fallbackObjectKey = undefined;
        this.buffer = buffer;
        this.type = type;
        this.calculateData();
    }
    COBJFile.prototype.calculateData = function () {
        var byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getInt();
        this.commonBlockVersion = byteBuffer.getInt();
        this.nameHash = byteBuffer.getInt();
        this.descriptionHash = byteBuffer.getInt();
        this.price = byteBuffer.getInt();
        var thumbnailHash = byteBuffer.pos += 8;
        this.devCategoryFlags = byteBuffer.getInt();
        //CountedTGIBlockList
        var size_TGIBlockList = byteBuffer.getByte();
        for (var i = 0; i < size_TGIBlockList; i++) {
            this.tgiBlockList.push({
                c: byteBuffer.getLong(),
                a: byteBuffer.getInt(),
                b: byteBuffer.getInt()
            });
        }
        if (this.commonBlockVersion == 0x09) {
            byteBuffer.pos = byteBuffer.pos + 2;
        }
        else {
            this.packId = byteBuffer.getShort();
            this.packFlag = byteBuffer.getByte();
            byteBuffer.pos = byteBuffer.pos + 9;
        }
        //CatalogTagList
        var size_CatalogTagList = byteBuffer.getInt();
        for (var i = 0; i < size_CatalogTagList; i++) {
            var value = byteBuffer.getShort();
            if (this.commonBlockVersion != 0x09)
                byteBuffer.pos = byteBuffer.pos + 2;
            this.catalogTagList.add(value);
        }
        //SellingPoints
        this.sellingpoints = [];
        var count = byteBuffer.getInt();
        for (var i = 0; i < count; i++) {
            var commodity = byteBuffer.getShort();
            var amount = byteBuffer.getInt();
            this.sellingpoints.push({ commodity: commodity, amount: amount });
        }
        //Other
        this.unlockByHash = byteBuffer.getInt();
        this.unlockedByHash = byteBuffer.getInt();
        this.swatchColorsSortPriority = byteBuffer.getShort();
        this.varientThumbImageHash = byteBuffer.getLong();
        //More
        this.auralMaterialsVersion = byteBuffer.getInt();
        this.auralMaterials1 = byteBuffer.getInt();
        this.auralMaterials2 = byteBuffer.getInt();
        this.auralMaterials3 = byteBuffer.getInt();
        this.auralPropertiesVersion = byteBuffer.getInt();
        this.auralQuality = byteBuffer.getInt();
        if (this.auralPropertiesVersion > 1) {
            this.auralAmbientObject = byteBuffer.getInt();
        }
        if (this.auralPropertiesVersion == 3) {
            this.ambienceFileInstanceId = byteBuffer.getLong();
            this.isOverrideAmbience = byteBuffer.getByte();
        }
        if (this.auralPropertiesVersion == 4) {
            this.unknown01 = byteBuffer.getByte();
        }
        if (this.auralPropertiesVersion == 5) {
            this.unknown02 = byteBuffer.getShort();
        }
        this.unused0 = byteBuffer.getInt();
        this.unused1 = byteBuffer.getInt();
        this.unused2 = byteBuffer.getInt();
        this.placementFlagsHigh = byteBuffer.getInt();
        this.placementFlagsLow = byteBuffer.getInt();
        this.slotTypeSet = byteBuffer.getLong();
        this.slotDecoSize = byteBuffer.getByte();
        this.catalogGroup = byteBuffer.getLong();
        this.stateUsage = byteBuffer.getByte();
        this.colors = [];
        var colorCount = byteBuffer.getByte();
        for (var i = 0; i < colorCount; i++) {
            this.colors.push(byteBuffer.getInt());
        }
        this.fenceHeight = byteBuffer.getInt();
        this.isStackable = byteBuffer.getByte();
        this.canItemDepreciate = byteBuffer.getByte();
        if (this.version >= 0x19) {
            this.fallbackObjectKey = byteBuffer.readTGIItemByOrdner(4);
        }
    };
    COBJFile.prototype.getSimpleData = function () {
        return {
            price: this.price,
            catalogTagList: Array.from(this.catalogTagList),
            colors: this.colors,
            nameHash: this.nameHash,
            descriptionHash: this.descriptionHash
        };
    };
    COBJFile.prototype.toBuffer = function () {
        var byteBuffer = new BinaryWritter();
        byteBuffer.writeInt(this.version);
        byteBuffer.writeInt(this.commonBlockVersion);
        byteBuffer.writeInt(this.nameHash);
        byteBuffer.writeInt(this.descriptionHash);
        byteBuffer.writeInt(this.price);
        byteBuffer.writeLong(0);
        byteBuffer.writeInt(this.devCategoryFlags);
        // CountedTGIBlockList
        byteBuffer.writeByte(this.tgiBlockList.length);
        for (var i = 0; i < this.tgiBlockList.length; i++) {
            byteBuffer.writeBigIntCap(this.tgiBlockList[i].c);
            byteBuffer.writeInt(this.tgiBlockList[i].a);
            byteBuffer.writeInt(this.tgiBlockList[i].b);
        }
        if (this.commonBlockVersion == 0x09) {
            byteBuffer.writeShort(0);
        }
        else {
            byteBuffer.writeShort(this.packId);
            byteBuffer.writeByte(this.packFlag);
            for (var i = 0; i < 9; i++) {
                byteBuffer.writeByte(0);
            }
        }
        // CatalogTagList
        byteBuffer.writeInt(this.catalogTagList.size);
        for (var _i = 0, _a = Array.from(this.catalogTagList); _i < _a.length; _i++) {
            var value = _a[_i];
            byteBuffer.writeShort(value);
            if (this.commonBlockVersion != 0x09)
                byteBuffer.writeShort(0);
        }
        // SellingPoints
        byteBuffer.writeInt(this.sellingpoints.length);
        for (var i = 0; i < this.sellingpoints.length; i++) {
            byteBuffer.writeShort(this.sellingpoints[i].commodity);
            byteBuffer.writeInt(this.sellingpoints[i].amount);
        }
        // Other
        byteBuffer.writeInt(this.unlockByHash);
        byteBuffer.writeInt(this.unlockedByHash);
        byteBuffer.writeShort(this.swatchColorsSortPriority);
        byteBuffer.writeBigIntCap(this.varientThumbImageHash);
        // More
        byteBuffer.writeInt(this.auralMaterialsVersion);
        byteBuffer.writeInt(this.auralMaterials1);
        byteBuffer.writeInt(this.auralMaterials2);
        byteBuffer.writeInt(this.auralMaterials3);
        byteBuffer.writeInt(this.auralPropertiesVersion);
        byteBuffer.writeInt(this.auralQuality);
        if (this.auralPropertiesVersion > 1) {
            byteBuffer.writeInt(this.auralAmbientObject);
        }
        if (this.auralPropertiesVersion == 3) {
            byteBuffer.writeBigIntCap(this.ambienceFileInstanceId);
            byteBuffer.writeByte(this.isOverrideAmbience);
        }
        if (this.auralPropertiesVersion == 4) {
            byteBuffer.writeByte(this.unknown01);
        }
        if (this.auralPropertiesVersion == 5) {
            byteBuffer.writeShort(this.unknown02);
        }
        byteBuffer.writeInt(this.unused0);
        byteBuffer.writeInt(this.unused1);
        byteBuffer.writeInt(this.unused2);
        byteBuffer.writeInt(this.placementFlagsHigh);
        byteBuffer.writeInt(this.placementFlagsLow);
        byteBuffer.writeBigIntCap(this.slotTypeSet);
        byteBuffer.writeByte(this.slotDecoSize);
        byteBuffer.writeBigIntCap(this.catalogGroup);
        byteBuffer.writeByte(this.stateUsage);
        // Colors
        byteBuffer.writeByte(this.colors.length);
        for (var i = 0; i < this.colors.length; i++) {
            byteBuffer.writeInt(this.colors[i]);
        }
        byteBuffer.writeInt(this.fenceHeight);
        byteBuffer.writeByte(this.isStackable);
        byteBuffer.writeByte(this.canItemDepreciate);
        if (this.version >= 0x19) {
            byteBuffer.writeTGIItemByOrdnerType(this.fallbackObjectKey, 4, false);
        }
        //16 empty bytes
        for (var i = 0; i < 16; i++) {
            byteBuffer.writeByte(0);
        }
        return byteBuffer.toBuffer();
    };
    return COBJFile;
}());
exports.COBJFile = COBJFile;
var COBJResource = /** @class */ (function () {
    function COBJResource() {
        this.pMin = 900000000000;
        this.pMax = 0;
        this.prices = new Set();
        this.buyCat = new Set();
        this.buildSet = new Set();
        this.patternSet = new Set();
        this.otherSet = new Set();
        this.hasGeometry = false;
        this.cobjFiles = [];
    }
    COBJResource.prototype.addFile = function (file) {
        this.cobjFiles.push(file);
        //Preis
        this.prices.add(file.price);
        if (file.price < this.pMin)
            this.pMin = file.price;
        if (file.price > this.pMax)
            this.pMax = file.price;
        //catalogTagList
        var arr = Array.from(file.catalogTagList);
        for (var index = 0; index < arr.length; index++) {
            var value = arr[index];
            if (COBJMapper.buildBuySet.has(value)) {
                this.buyCat.add(value);
            }
            else if (COBJMapper.buildSet.has(value)) {
                this.buildSet.add(value);
            }
            else if (COBJMapper.patternSet.has(value)) {
                this.patternSet.add(value);
            }
            else if (COBJMapper.otherSet.has(value)) {
                this.otherSet.add(value);
            }
        }
    };
    return COBJResource;
}());
exports.COBJResource = COBJResource;
var CLIPResource = /** @class */ (function () {
    function CLIPResource() {
        this.propIds = new Set(); // length != 1 -> merged
    }
    return CLIPResource;
}());
exports.CLIPResource = CLIPResource;
var RMAPFile = /** @class */ (function () {
    function RMAPFile(buffer) {
        this.error = false;
        this.conextVersion = 0;
        this.publicKeyCount = 0;
        this.externalKeyCount = 0;
        this.delayLoadKeyCount = 0;
        this.objectCount = 0;
        this.publicKeys = [];
        this.externalKeys = [];
        this.delayLoadKeys = [];
        this.objectPosition = 0;
        this.objectLength = 0;
        this.objectVersion = 0;
        this.geomReferenceBlockList = [];
        if (buffer) {
            this.buffer = buffer;
            this.calculateData();
        }
    }
    RMAPFile.prototype.calculateData = function () {
        if (!this.buffer)
            throw new Error("No Buffer");
        var byteBuffer = new ByteBuffer(this.buffer);
        this.conextVersion = byteBuffer.getInt();
        this.publicKeyCount = byteBuffer.getInt();
        this.externalKeyCount = byteBuffer.getInt();
        this.delayLoadKeyCount = byteBuffer.getInt();
        this.objectCount = byteBuffer.getInt();
        for (var i = 0; i < this.publicKeyCount; i++) {
            var tgi = Basic.getTGIListItem(byteBuffer, "ITG");
            if (tgi)
                this.publicKeys.push(tgi);
        }
        for (var i = 0; i < this.externalKeyCount; i++) {
            var tgi = Basic.getTGIListItem(byteBuffer, "ITG");
            if (tgi)
                this.externalKeys.push(tgi);
        }
        for (var i = 0; i < this.delayLoadKeyCount; i++) {
            var tgi = Basic.getTGIListItem(byteBuffer, "ITG");
            if (tgi)
                this.delayLoadKeys.push(tgi);
        }
        this.objectPosition = byteBuffer.getInt();
        this.objectLength = byteBuffer.getInt();
        this.objectVersion = byteBuffer.getInt();
        //GEOMReferenceBlockList
        var size_GEOMReferenceBlockList = byteBuffer.getInt();
        for (var i = 0; i < size_GEOMReferenceBlockList; i++) {
            var item = {
                isReplacement: false,
                layer: 0,
                region: 0,
                tgiList: []
            };
            item.region = byteBuffer.getInt();
            item.layer = byteBuffer.getFloat();
            item.isReplacement = byteBuffer.getByte() == 1;
            var count = byteBuffer.getInt();
            for (var i_1 = 0; i_1 < count; i_1++) {
                var tgi = Basic.getTGIListItem(byteBuffer, "ITG");
                if (tgi)
                    item.tgiList.push(tgi);
            }
            this.geomReferenceBlockList.push(item);
        }
    };
    RMAPFile.prototype.calulateNewBuffer = function () {
        var bw = new BinaryWritter();
        bw.writeInt(this.conextVersion);
        bw.writeInt(this.publicKeys.length);
        bw.writeInt(this.externalKeys.length);
        bw.writeInt(this.delayLoadKeys.length);
        bw.writeInt(this.objectCount);
        for (var i = 0; i < this.publicKeys.length; i++) {
            var element = this.publicKeys[i];
            bw.writeTGIListItem(element, "ITG");
        }
        for (var i = 0; i < this.externalKeys.length; i++) {
            var element = this.externalKeys[i];
            bw.writeTGIListItem(element, "ITG");
        }
        for (var i = 0; i < this.delayLoadKeys.length; i++) {
            var element = this.delayLoadKeys[i];
            bw.writeTGIListItem(element, "ITG");
        }
        bw.writeInt(bw.pos + 8); //Object Position
        var objectLength = 4;
        for (var i = 0; i < this.geomReferenceBlockList.length; i++) {
            var element = this.geomReferenceBlockList[i];
            objectLength += 13 + (element.tgiList.length * 16);
        }
        bw.writeInt(objectLength + 4); //Object Length
        bw.writeInt(this.objectVersion);
        bw.writeInt(this.geomReferenceBlockList.length);
        for (var i = 0; i < this.geomReferenceBlockList.length; i++) {
            var element = this.geomReferenceBlockList[i];
            bw.writeInt(element.region);
            bw.writeFloat(element.layer);
            bw.writeByte(element.isReplacement ? 1 : 0);
            bw.writeInt(element.tgiList.length);
            for (var j = 0; j < element.tgiList.length; j++) {
                var tgi = element.tgiList[j];
                bw.writeTGIListItem(tgi, "ITG");
            }
        }
        return bw.toBuffer();
    };
    Object.defineProperty(RMAPFile.prototype, "dataObject", {
        get: function () {
            var expandedGeomReferenceBlockList = [];
            this.geomReferenceBlockList.forEach(function (element) {
                var newTGIList = [];
                var obj = {
                    region: element.region,
                    layer: element.layer,
                    isReplacement: element.isReplacement,
                    tgiList: newTGIList
                };
                element.tgiList.forEach(function (tgi) {
                    var newTgi = {
                        type: tgi.type,
                        group: tgi.group,
                        instanceStr: tgi.instance.toString(16).padStart(16, "0"),
                        key: tgi.type.toString(16).padStart(8, "0") + "-" + tgi.group.toString(16).padStart(8, "0") + "-" + tgi.instance.toString(16).padStart(16, "0")
                    };
                    newTGIList.push(newTgi);
                });
                expandedGeomReferenceBlockList.push(obj);
            });
            return {
                //conextVersion:this.conextVersion,
                //publicKeyCount:this.publicKeyCount,
                //externalKeyCount:this.externalKeyCount,
                //delayLoadKeyCount:this.delayLoadKeyCount,
                //objectCount:this.objectCount,
                //publicKeys:this.publicKeys,
                //externalKeys:this.externalKeys,
                //delayLoadKeys:this.delayLoadKeys,
                //objectPosition:this.objectPosition,
                //objectLength:this.objectLength,
                //objectVersion:this.objectVersion,
                geomReferenceBlockList: expandedGeomReferenceBlockList
            };
        },
        enumerable: false,
        configurable: true
    });
    return RMAPFile;
}());
exports.RMAPFile = RMAPFile;
var GEOMFile = /** @class */ (function () {
    function GEOMFile(buffer, onlyValues) {
        this.onlyValues = false;
        this.instanceID = "";
        this.error = false;
        //Values
        this.version = 0;
        this.chunks = [];
        this.vertexCount = -1;
        this.facesCount = -1;
        this.buffer = buffer;
        if (typeof onlyValues !== 'undefined') {
            this.onlyValues = onlyValues;
        }
        this.calculateData();
    }
    GEOMFile.prototype.calculateData = function () {
        var byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getInt();
        //console.log("Version: "+this.version.toString(16));
        //PubicChunks +4 (int)
        //Unused +4 (int)
        //PubicChunks +4 (int)
        //Counted TGI Block List +4 (int) ? Liste immer leer?
        byteBuffer.skip(4 + 4 + 4);
        //ChunkEntryList 
        var chunkEntryListLength = byteBuffer.getInt();
        //console.log("CHLength: "+chunkEntryListLength)
        //console.log("0x"+chunkEntryListLength.toSt ring(16));
        for (var index = 0; index < chunkEntryListLength; index++) {
            var che_intance = byteBuffer.getLong();
            var che_type = byteBuffer.getInt();
            var che_group = byteBuffer.getInt();
            //? 2 unknown ints
            byteBuffer.skip(4 + 4);
            var che_typeTag = byteBuffer.getInt();
            var che_version = byteBuffer.getInt();
            //? 2 unknown ints
            byteBuffer.skip(4 + 4);
            var che_shader = byteBuffer.getInt();
            //? 5 unknown ints
            byteBuffer.skip(16);
            //console.log("InnerVersion: "+che_version.toString(16));
            //MTNF
            var che_shaderDataListLength = byteBuffer.getInt();
            for (var che_s_index = 0; che_s_index < che_shaderDataListLength; che_s_index++) {
                var value = byteBuffer.getInt();
                byteBuffer.skip(12); //Data
                //console.log("0x"+value.toString(16))
            }
            //console.log("POS (End SDATA): "+byteBuffer.pos.toString(16))
            var mergeGroup = byteBuffer.getInt();
            var sortOrder = byteBuffer.getInt();
            //console.log("mergeGroup: 0x"+mergeGroup.toString(16));
            //console.log("sortOrder: 0x"+sortOrder.toString(16));
            //Big Skip to Vertex
            //console.log("POS: "+byteBuffer.pos.toString(16))
            //OLD
            /*
            if(che_version==0x0E){
                //byteBuffer.skip(4+(10*16)+4);
                byteBuffer.skip(4+(9*16)+4);
            }else if(che_version==0x0C){
                byteBuffer.skip(4+(8*16)); //Correct for Most
                //byteBuffer.skip(4+(10*16)+4); // Somtimes?
            }else{
                this.error = true;
                return;
            }*/
            //Stupid
            var max = 16 * 24;
            var found = false;
            var pre1 = 1;
            var pre2 = 1;
            for (var index_5 = max; index_5 >= 0; index_5--) {
                var value = byteBuffer.getInt();
                var next = byteBuffer.getInt();
                byteBuffer.pos = byteBuffer.pos - 4;
                if (value > 0 && value < 12 && next > 0 && next < 12 && pre1 == 0 && pre2 != 0) {
                    index_5 = -1;
                    byteBuffer.pos = byteBuffer.pos - 8;
                    //console.log("FOUND: 0x"+value);
                    found = true;
                }
                pre1 = pre2;
                pre2 = value;
            }
            if (!found) {
                this.error = true;
                console.log("Error: " + this.instanceID);
                return;
            }
            //console.log("POS: "+byteBuffer.pos.toString(16))
            var vertexDataLength = byteBuffer.getInt();
            this.vertexCount = vertexDataLength;
            //console.log("VERTEX Length: "+vertexDataLength.toString(16));
            var vertexFormatList = [];
            var vertexFormatListLenght = byteBuffer.getInt();
            var vertexPartLength = 0;
            //console.log("VertexFormatList: 0x"+vertexFormatListLenght.toString(16));
            for (var vfi = 0; vfi < vertexFormatListLenght; vfi++) {
                var value = byteBuffer.getInt();
                var extra_1 = byteBuffer.getInt();
                var extra_2 = byteBuffer.getByte();
                var obj = {
                    value: value,
                    e1: extra_1,
                    e2: extra_2
                };
                vertexFormatList.push(obj);
                vertexPartLength += this.getVertexFormatLength(value);
            }
            var vertexList = [];
            if (!this.onlyValues) {
                for (var vIndex = 0; vIndex < vertexDataLength; vIndex++) {
                    var vertex = {};
                    for (var vfi = 0; vfi < vertexFormatList.length; vfi++) {
                        var vertexFormatType = vertexFormatList[vfi].value;
                        this.addVertex(vertexFormatType, byteBuffer, vertex);
                    }
                    if (!this.onlyValues)
                        vertexList.push(vertex);
                }
            }
            else {
                var skip = vertexPartLength * vertexDataLength;
                byteBuffer.skip(skip);
            }
            var facesList = [];
            byteBuffer.skip(5);
            var faceDataLengthTotal = byteBuffer.getInt();
            var facesDataLength = faceDataLengthTotal / 3;
            this.facesCount = facesDataLength;
            if (!this.onlyValues) {
                for (var fIndex = 0; fIndex < facesDataLength; fIndex++) {
                    var v1 = byteBuffer.getShort();
                    var v2 = byteBuffer.getShort();
                    var v3 = byteBuffer.getShort();
                    var face = [v1, v2, v3];
                    facesList.push(face);
                }
                var chunk = {
                    vertex: vertexList,
                    faces: facesList
                };
                this.chunks.push(chunk);
            }
        }
    };
    GEOMFile.prototype.addVertex = function (type, byteBuffer, obj) {
        if (type == 0x1) {
            //Position
            var pos_x = byteBuffer.getFloat();
            var pos_y = byteBuffer.getFloat();
            var pos_z = byteBuffer.getFloat();
            var arr = [];
            arr.push(pos_x);
            arr.push(pos_y);
            arr.push(pos_z);
            obj.p = arr;
        }
        else if (type == 0x2) {
            //Normals
            var normal_x = byteBuffer.getFloat();
            var normal_y = byteBuffer.getFloat();
            var normal_z = byteBuffer.getFloat();
            var arr = [];
            arr.push(normal_x);
            arr.push(normal_y);
            arr.push(normal_z);
            obj.n = arr;
        }
        else if (type == 0x3) {
            //UV 
            var uv1 = byteBuffer.getFloat();
            ;
            var uv2 = byteBuffer.getFloat();
            if (obj.u) {
                obj.u.push(uv1);
                obj.u.push(uv2);
            }
            else {
                var arr = [];
                arr.push(uv1);
                arr.push(uv2);
                obj.u = arr;
            }
        }
        else if (type == 0x7) {
            //Color
            var color = byteBuffer.getInt();
            obj.c = color;
        }
        else if (type == 0x4) {
            //Bones
            byteBuffer.skip(4);
        }
        else if (type == 0x5) {
            //Weights
            byteBuffer.skip(4);
        }
        else if (type == 0x6) {
            //Tangent Normal
            byteBuffer.skip(12);
        }
        else if (type == 0xA) {
            //VertexID
            byteBuffer.skip(4);
        }
        /*
        //Pos
                let pos_x = byteBuffer.getFloat();
                let pos_y = byteBuffer.getFloat();
                let pos_z = byteBuffer.getFloat();

                //Normal
                let normal_x = byteBuffer.getFloat();
                let normal_y = byteBuffer.getFloat();
                let normal_z = byteBuffer.getFloat();

                //UV
                let uvs : any [] = [];
                let uvCount = 0;
                if(che_version==0x0E){
                    uvCount=4;
                }else if(che_version==0x0C){
                    uvCount=6;
                }
                for (let ui = 0; ui < uvCount; ui++) {
                    const element = byteBuffer.getFloat();
                    uvs.push(element);
                }


                let color = 0;
                if(che_version==0x0E){
                    
                    //Color
                    color = byteBuffer.getInt();
                    //Bones
                    byteBuffer.skip(4);

                    //Weights
                    byteBuffer.skip(4);

                    //TangentNormal
                    byteBuffer.skip(12);

                }else if(che_version==0x0C){
                    //Bones
                    byteBuffer.skip(4);
                    //Weights
                    byteBuffer.skip(4);
                    //VertexID
                    byteBuffer.skip(4);
                    //Color
                    color = byteBuffer.getInt();
                    //TangentNormal
                    byteBuffer.skip(12);
                }


                
               
                

                let vertex = {
                    color:color,
                    px:pos_x,
                    py:pos_y,
                    pz:pos_z,
                    nx:normal_x,
                    ny:normal_y,
                    nz:normal_z,
                    uv:uvs,
                    chversion:che_version
                };
               
                //if(vIndex < vertexDataLength)console.log(pos_x+" : "+pos_y+" : "+pos_z);
                //if(vIndex > vertexDataLength-5)console.log(vertex);
                if(vIndex <1)console.log(vertex);
         */
    };
    GEOMFile.prototype.getVertexFormatLength = function (type) {
        if (type == 0x1) {
            return 12;
        }
        else if (type == 0x2) {
            return 12;
            ;
        }
        else if (type == 0x3) {
            return 8;
        }
        else if (type == 0x7) {
            return 4;
        }
        else if (type == 0x4) {
            return 4;
        }
        else if (type == 0x5) {
            return 4;
        }
        else if (type == 0x6) {
            return 12;
        }
        else if (type == 0xA) {
            return 4;
        }
        return 0;
    };
    GEOMFile.prototype.toString = function () {
        return "GEOM v" + this.version;
    };
    return GEOMFile;
}());
exports.GEOMFile = GEOMFile;
var ZoneObjFile = /** @class */ (function () {
    function ZoneObjFile(buffer) {
        this.instanceID = "";
        this.error = false;
        //Types
        //0x09 - object_id      [8 Bytes, ID] 
        //0x11 - owner_id       [8 Bytes, ID] 
        //0x19 - parent_id      [8 Bytes, ID]   Optional
        //0x0D - pos_x          [4 Bytes, float] 
        //0x15 - pos_y          [4 Bytes, float] 
        //0x1D - pos_z          [4 Bytes, float] 
        //0x25 - rot_x          [4 Bytes, float] 
        //0x2D - rot_y          [4 Bytes, float] 
        //0x35 - rot_z          [4 Bytes, float] 
        //0x3D - rot_w          [4 Bytes, float] 
        //0x01 - is_new         [1 Byte, boolean]
        //0x02 - is_new_obj     [1 Byte, boolean] ?!
        //0x68 - cost           [LEB128] 
        //0x71 - baby_sim_id    [8 Bytes, ID] 
        //0x02 - buybuilduseFlag [LEB128] ?!
        //0x - createdFromTmp 
        //0x - 
        //0x - 
        //Values
        this.zone_id = undefined;
        this.type = undefined;
        this.version = 0;
        this.items = [];
        this.idOffestSet = new Set();
        this.debugItems = [];
        this.buffer = buffer;
        this.calculateData();
    }
    ZoneObjFile.prototype.calculateData = function () {
        var byteBuffer = new ByteBuffer(this.buffer);
        var z1 = byteBuffer.getInt().toString(16).padStart(8, "0");
        var z2 = byteBuffer.getInt().toString(16).padStart(8, "0");
        this.zone_id = z2 + z1;
        byteBuffer.pos += 5;
        this.type = "0x" + byteBuffer.getInt().toString(16).padStart(8, "0");
        this.version = byteBuffer.getInt();
        byteBuffer.pos += 12 + 16;
        //let len = byteBuffer.getInt();
        //byteBuffer.pos+=len;
        //console.log("Pos: 0x"+byteBuffer.pos.toString(16))
        //Search Pattern
        /*while((byteBuffer.pos+16)<byteBuffer.max){
            let pos = byteBuffer.pos;
            let byte_obj = byteBuffer.array[pos] == 0x09;
            let byte_owner = byteBuffer.array[pos+9] == 0x11;
            let byte_unkn = byteBuffer.array[pos+18] == 0x2a;
            if(!byte_obj || !byte_owner){
                byteBuffer.pos = pos+1;
                continue;
            }
            byteBuffer.getByte(); // 0x09
            let p1 = byteBuffer.pos;
            let object_id = byteBuffer.getLongStringAlt();
            byteBuffer.getByte(); // 0x11
            let p2 = byteBuffer.pos;
            let owner_id = byteBuffer.getLongStringAlt();
            byteBuffer.pos+=2;
            if(object_id && owner_id){
                this.items.push(new ZoneObjItem(object_id,owner_id));
                this.idOffestSet.add(p1);
                this.idOffestSet.add(p2);
            }
        }*/
        var enterPos = byteBuffer.pos;
        byteBuffer.pos = byteBuffer.max - 20;
        var lastEnd = byteBuffer.max;
        while (byteBuffer.pos > enterPos) {
            var pos = byteBuffer.pos;
            var byte_obj = byteBuffer.array[pos] == 0x09;
            var byte_owner = byteBuffer.array[pos + 9] == 0x11;
            var byte_unkn = byteBuffer.array[pos + 18] == 0x2a;
            if (!byte_obj || !byte_owner) {
                byteBuffer.pos = pos - 1;
                continue;
            }
            byteBuffer.getByte(); // 0x09
            var p1 = byteBuffer.pos;
            var object_id = byteBuffer.getLongStringAlt();
            byteBuffer.getByte(); // 0x11
            var p2 = byteBuffer.pos;
            var owner_id = byteBuffer.getLongStringAlt();
            byteBuffer.pos += 2;
            //if(object_id && owner_id){
            //    this.items.push(new ZoneObjItem(object_id,owner_id));
            //}
            var serachPos = byteBuffer.pos;
            /*
            //Cost
            let costs = [];
            while(byteBuffer.pos<lastEnd){
                let pos = byteBuffer.pos;
                if(byteBuffer.getByte()==0x68){
                    let value = byteBuffer.readUnsignedLeb128();
                    let afterByte = byteBuffer.getByte();
                    costs.push({
                        value:("0x"+value.toString(16).padStart(8,"0")),
                        after:("0x"+afterByte.toString(16))
                    });
                    byteBuffer.pos = pos+1;
                }else{
                    //Nix
                }
            }
            */
            //Guid
            byteBuffer.pos = serachPos;
            var guids = [];
            while (byteBuffer.pos < lastEnd) {
                var pos_1 = byteBuffer.pos;
                if (byteBuffer.getByte() == 0xf0 && byteBuffer.getByte() == 0x01) {
                    var value = byteBuffer.readLeb128();
                    var afterByte = byteBuffer.getByte();
                    guids.push({
                        value: value.toString(16).padStart(16, "0"),
                        //start:("0x"+pos.toString(16)),
                        //after:("0x"+afterByte.toString(16)),
                        //bevor:("0x"+byteBuffer.array[pos-1].toString(16))
                    });
                    byteBuffer.pos = pos_1 + 1;
                }
                else {
                    //Nix
                }
            }
            this.debugItems.push({
                object_id: object_id,
                owner_id: owner_id,
                //costs:costs,
                guids: guids,
                //start:("0x"+pos.toString(16)),
                //end:("0x"+lastEnd.toString(16))
            });
            if (guids.length == 1 && object_id && owner_id) {
                this.items.push(new ZoneObjItem(object_id, owner_id, guids[0].value));
                lastEnd = pos;
                byteBuffer.pos = pos - 16;
            }
            else {
                byteBuffer.pos = pos - 1;
            }
            this.debugItems.push({
                object_id: object_id,
                owner_id: owner_id,
                //costs:costs,
                guids: guids,
                //start:("0x"+pos.toString(16)),
                //end:("0x"+lastEnd.toString(16))
            });
            lastEnd = pos;
            byteBuffer.pos = pos - 16;
        }
    };
    return ZoneObjFile;
}());
exports.ZoneObjFile = ZoneObjFile;
var ZoneObjItem = /** @class */ (function () {
    function ZoneObjItem(object_id, owner_id, guid) {
        this.object_id = undefined;
        this.owner_id = undefined;
        this.guid = undefined;
        this.object_id = object_id;
        this.owner_id = owner_id;
        this.guid = guid;
    }
    return ZoneObjItem;
}());
exports.ZoneObjItem = ZoneObjItem;
var GEOMResource = /** @class */ (function () {
    function GEOMResource() {
        this.files = [];
    }
    return GEOMResource;
}());
exports.GEOMResource = GEOMResource;
var STBLFile = /** @class */ (function () {
    function STBLFile(buffer) {
        this.instanceID = "";
        this.error = false;
        this.version = 5;
        this.compressed = 0;
        this.stringDataLenght = 0;
        this.entries = [];
        if (buffer) {
            this.buffer = buffer;
            this.calculateData();
        }
    }
    //Read
    STBLFile.prototype.calculateData = function () {
        if (!this.buffer)
            return;
        var byteBuffer = new ByteBuffer(this.buffer);
        //Magic
        var magic = byteBuffer.getInt();
        if (magic != 0x4C425453) {
            //Not STBL
            this.error = true;
            return;
        }
        //Basic Values
        this.version = byteBuffer.getShort();
        this.compressed = byteBuffer.getByte();
        var numberEntries = byteBuffer.getLong();
        var res0 = byteBuffer.getByte();
        var res1 = byteBuffer.getByte();
        this.stringDataLenght = byteBuffer.getInt();
        //Strings
        var decoder = new TextDecoder('utf-8');
        for (var index = 0; index < numberEntries; index++) {
            var key = byteBuffer.getInt();
            var flag = byteBuffer.getByte();
            var strLenght = byteBuffer.getShort();
            var textBuffer = byteBuffer.getSection(strLenght);
            var str = decoder.decode(textBuffer);
            var obj = {
                key: key,
                flag: flag,
                value: str
            };
            this.entries.push(obj);
        }
    };
    //Write
    STBLFile.prototype.addEntrie = function (item) {
        this.entries.push(item);
    };
    STBLFile.prototype.toBuffer = function () {
        var bw = new BinaryWritter();
        //Magic
        bw.writeByte(0x53);
        bw.writeByte(0x54);
        bw.writeByte(0x42);
        bw.writeByte(0x4c);
        //Basic Values
        bw.writeShort(5); //Version
        bw.writeByte(0); // Compressed
        bw.writeLong(this.entries.length); //EntiresLength
        bw.writeByte(0); //Rev0
        bw.writeByte(0); //Rev1
        bw.writeInt(this.stringDataLength());
        //Write Values
        var encoder = new TextEncoder();
        for (var index = 0; index < this.entries.length; index++) {
            var element = this.entries[index];
            bw.writeInt(element.key);
            bw.writeByte(element.flag);
            var value = element.value;
            var data = encoder.encode(value);
            bw.writeShort(data.length);
            for (var j = 0; j < data.length; j++) {
                bw.writeByte(data[j]);
            }
        }
        return bw.toBuffer();
    };
    STBLFile.prototype.stringDataLength = function () {
        var count = 0;
        var encoder = new TextEncoder();
        for (var index = 0; index < this.entries.length; index++) {
            var element = this.entries[index];
            var data = encoder.encode(element.value);
            count += data.length;
        }
        return count;
    };
    return STBLFile;
}());
exports.STBLFile = STBLFile;
var GameFiles = /** @class */ (function () {
    function GameFiles() {
    }
    GameFiles.getThumbnailFiles = function (gameFolder) {
        var files = [];
        if (!fs.existsSync(gameFolder))
            return files;
        var set = new Set();
        this.checkFolderForThumbnailPackage(gameFolder, set);
        return Array.from(set.keys());
    };
    GameFiles.checkFolderForThumbnailPackage = function (folder, set) {
        var _this = this;
        try {
            fs.readdirSync(folder).forEach(function (filename) {
                var filepath = path.join(folder, filename);
                var stats = fs.lstatSync(filepath);
                if (NAMEUTIL.isPackageFile(filepath) && filepath.includes("thumbnail") && stats.isFile()) {
                    set.add(filepath);
                    return;
                }
                else if (stats.isDirectory()) {
                    _this.checkFolderForThumbnailPackage(filepath, set);
                }
            });
        }
        catch (error) {
            console.log(error);
        }
    };
    return GameFiles;
}());
exports.GameFiles = GameFiles;
var S4SMMFile = /** @class */ (function () {
    function S4SMMFile(entry) {
        this.fileID = 0;
        this.version = 0;
        this.name = "";
        this.error = undefined;
        //folders?
        this.packages = [];
        if (entry) {
            this.entry = entry;
            this.key = Basic.getStingKey(entry);
            this.readFile();
        }
    }
    S4SMMFile.prototype.setPackagesFromObjFrom = function (packages) {
        this.packages = [];
        for (var index = 0; index < packages.length; index++) {
            var item = packages[index];
            var res = [];
            for (var i = 0; i < item.resources.length; i++) {
                var valueString = item.resources[i];
                try {
                    var parts = valueString.split("-");
                    var type = parseInt(parts[0], 16);
                    var group = parseInt(parts[1], 16);
                    var instance = BigInt("0x" + parts[2]);
                    res.push({
                        type: type,
                        group: group,
                        instance: instance
                    });
                }
                catch (error) {
                    console.log(error);
                }
            }
            this.packages.push({
                name: item.name,
                resources: res
            });
        }
    };
    S4SMMFile.prototype.readFile = function () {
        if (!this.entry)
            return false;
        try {
            this.fileID = fs.openSync(this.entry.file);
            var buf = this.entry.getByteArray();
            var bb = new ByteBuffer(buf);
            var decoder = new TextDecoder('utf-8');
            //Version
            this.version = bb.getInt();
            //Name
            var nameLenth = bb.getInt();
            this.name = decoder.decode(bb.getSection(nameLenth));
            //Unknown
            var u1 = bb.getInt();
            //Packages
            var packageCount = bb.getInt();
            for (var index = 0; index < packageCount; index++) {
                var pNameLength = bb.getInt();
                var pName = decoder.decode(bb.getSection(pNameLength));
                var resCount = bb.getInt();
                var resources = [];
                for (var u = 0; u < resCount; u++) {
                    var r_i = bb.getLong();
                    var r_t = bb.getInt();
                    var r_g = bb.getInt();
                    resources.push({ type: r_t, group: r_g, instance: r_i });
                }
                this.packages.push({
                    name: pName,
                    resources: resources
                });
            }
            return true;
        }
        catch (error) {
            this.error = error;
            return false;
        }
    };
    S4SMMFile.prototype.toBuffer = function () {
        var encoder = new TextEncoder();
        var bb = new BinaryWritter();
        var version = 1;
        bb.writeInt(version);
        // Name
        var nameBytes = encoder.encode(this.name);
        bb.writeInt(nameBytes.length);
        bb.writeBytes(nameBytes);
        // Unknown (assuming a fixed value for simplicity)
        var unknown = 0;
        bb.writeInt(unknown);
        // Packages
        bb.writeInt(this.packages.length);
        this.packages.forEach(function (pkg) {
            var pNameBytes = encoder.encode(pkg.name);
            bb.writeInt(pNameBytes.length);
            bb.writeBytes(pNameBytes);
            bb.writeInt(pkg.resources.length);
            pkg.resources.forEach(function (res) {
                bb.writeBigInt(res.instance);
                bb.writeInt(res.type);
                bb.writeInt(res.group);
            });
        });
        return bb.toBuffer();
    };
    S4SMMFile.prototype.toObj = function () {
        var simplePackages = [];
        for (var index = 0; index < this.packages.length; index++) {
            var element = this.packages[index];
            var resources = [];
            for (var u = 0; u < element.resources.length; u++) {
                var r = element.resources[u];
                var o = {
                    type: r.type.toString(16).padStart(8, "0"),
                    group: r.group.toString(16).padStart(8, "0"),
                    instance: r.instance.toString(16).padStart(16, "0")
                };
                resources.push(o.type + "-" + o.group + "-" + o.instance);
            }
            simplePackages.push({
                name: element.name,
                resources: resources
            });
        }
        return {
            name: this.name,
            packages: simplePackages
        };
    };
    S4SMMFile.compareObjs = function (obj1, obj2) {
        if (obj1.name !== obj2.name)
            return false;
        if (obj1.resources.length !== obj2.resources.length)
            return false;
        for (var i = 0; i < obj1.resources.length; i++) {
            if (obj1.resources[i] !== obj2.resources[i])
                return false;
        }
        return true;
    };
    ;
    return S4SMMFile;
}());
exports.S4SMMFile = S4SMMFile;
var GenericRCOLFile = /** @class */ (function () {
    function GenericRCOLFile(buffer) {
        this.error = false;
        this.version = 0;
        this.publicChunks = 0;
        this.unused = 0;
        this.resources = [];
        if (!buffer)
            return;
        this.buffer = buffer;
        this.calculateData();
    }
    GenericRCOLFile.prototype.calculateData = function () {
        var _a;
        if (!this.buffer)
            throw new Error("No Buffer");
        var byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getInt();
        this.publicChunks = byteBuffer.getInt();
        this.unused = byteBuffer.getInt();
        var countResources = byteBuffer.getInt();
        var countChunks = byteBuffer.getInt();
        var chunks = [];
        for (var index = 0; index < countChunks; index++) {
            var obj = byteBuffer.readTGIItemByOrdner(4);
            if (obj)
                chunks.push(obj);
        }
        this.resources = [];
        for (var index = 0; index < countResources; index++) {
            var obj = byteBuffer.readTGIItemByOrdner(4);
            if (obj)
                this.resources.push(obj);
        }
        var indexs = [];
        for (var index = 0; index < countChunks; index++) {
            var rie = {
                position: byteBuffer.getInt(),
                length: byteBuffer.getInt(),
            };
            indexs.push(rie);
        }
        if (countChunks == 1) {
            indexs[0].position = 0x2c + (countResources * 16);
            indexs[0].length = byteBuffer.max - indexs[0].position;
            if (((_a = chunks[0]) === null || _a === void 0 ? void 0 : _a.type) == 0) {
                var tag = byteBuffer.getSection(4).toString();
                chunks[0].type = 0;
                throw new Error("Tag: " + tag);
            }
        }
        this.blockList = new ChunkEntryList(byteBuffer, chunks, indexs);
    };
    GenericRCOLFile.prototype.getMeshTesting = function () {
        var _a;
        var vbufs = [];
        var vrtfs = [];
        var ibufs = [];
        var list = ((_a = this.blockList) === null || _a === void 0 ? void 0 : _a.chunkEntries) || [];
        for (var index = 0; index < list.length; index++) {
            var element = list[index];
            if (element.file instanceof VBUFFile) {
                vbufs.push(element.file);
            }
            else if (element.file instanceof VRTFFile) {
                vrtfs.push(element.file);
            }
            else if (element.file instanceof IBUFFile) {
                ibufs.push(element.file);
            }
        }
        var defVrtf = new VRTFFile();
        defVrtf.loadDefaults();
        var vertex0;
        var vertex1;
        var indices0;
        var indices1;
        try {
            vertex0 = vbufs[0].getVertices(defVrtf);
            vertex1 = vbufs[1].getVertices(vrtfs[0]);
            indices0 = ibufs[0].indices;
            indices1 = ibufs[1].indices;
        }
        catch (e) {
            console.log({ block: this });
            console.log({ list: list });
            console.log({
                vbufs: vbufs,
                vrtfs: vrtfs,
                ibufs: ibufs
            });
            console.log(e);
            return [];
        }
        var meshes = [
            {
                vertex: vertex0,
                faces: Basic.indicesToFaces(indices0)
            },
            {
                vertex: vertex1,
                faces: Basic.indicesToFaces(indices1)
            }
        ];
        return meshes;
    };
    GenericRCOLFile.prototype.getTextures = function () {
        var _a;
        var textures = [];
        var list = ((_a = this.blockList) === null || _a === void 0 ? void 0 : _a.chunkEntries) || [];
        for (var index = 0; index < list.length; index++) {
            var element = list[index];
            if (element.file instanceof MATDFile) {
                var obj = element.file.getDiffuseTexture();
                if (obj)
                    textures.push(obj);
            }
        }
        return textures;
    };
    GenericRCOLFile.prototype.overrideMTSTandMATD = function (swatches) {
        //Find first MTST and example MATD with Diffuse Map
        var mtst = undefined;
        var mtstChunk = undefined;
        var matd = undefined;
        var matdChunk = undefined;
        if (!this.blockList)
            throw new Error("No blocklist");
        var list = this.blockList.chunkEntries || [];
        for (var index = 0; index < list.length; index++) {
            var element = list[index];
            if (!mtst && element.file instanceof MTSTFile) {
                mtst = element.file;
                mtstChunk = element;
            }
            else if (element.file instanceof MATDFile) { //Take last (first would be !matd)
                var matdFile = element.file;
                var hasDiffuseKey = matdFile.getDiffuseTexture() != undefined;
                if (hasDiffuseKey) {
                    matd = matdFile;
                    matdChunk = element;
                }
            }
        }
        if (!mtst || !matd || !matdChunk || !mtstChunk)
            return this.toBufferBasedOnChunks();
        //let mtstOffset = mtstChunk.index;
        var mtstOffset = list.length;
        mtst.entries = mtst.entries.splice(0, 2);
        //Add Swatches
        var tgi = matdChunk.tgiBlock;
        if (!tgi)
            throw new Error("No TGI");
        for (var index = 0; index < swatches.length; index++) {
            var swatchData = swatches[index].data;
            //MTST
            var matdIndexNormal = mtstOffset + (2 * index);
            var matdIndexBurnt = matdIndexNormal + 1;
            var materialVariant = Number(swatchData.materialVariantHashValues.num);
            mtst.entries.push({
                index: matdIndexNormal,
                materialState: 0x0,
                materialVariant: materialVariant
            });
            mtst.entries.push({
                index: matdIndexBurnt,
                materialState: 0xC3867C32,
                materialVariant: materialVariant
            });
            var newMATD = new MATDFile(matd.buffer);
            newMATD.materialNameHash += index + 1;
            if (newMATD.mtrl) {
                for (var j = 0; j < newMATD.mtrl.shaderDataList.length; j++) {
                    var shader = newMATD.mtrl.shaderDataList[j];
                    if (shader.field == 0x6CC0FD85) {
                        newMATD.mtrl.shaderDataList[j].data = {
                            type: 0x00B2D882,
                            group: 0x80000000,
                            instance: swatchData.instance
                        };
                    }
                }
            }
            var newMATDBuffer = newMATD.toBuffer();
            var newChunkNormal = new ChunkEntry({ type: tgi.type, group: tgi.group, instance: (tgi.instance + BigInt(matdIndexNormal)) }, newMATDBuffer, matdIndexNormal);
            list.push(newChunkNormal);
            var newMATDB = new MATDFile(matd.buffer);
            newMATDB.materialNameHash += index + 2;
            if (newMATDB.mtrl) {
                for (var j = 0; j < newMATDB.mtrl.shaderDataList.length; j++) {
                    var shader = newMATDB.mtrl.shaderDataList[j];
                    if (shader.field == 0x6CC0FD85) {
                        newMATDB.mtrl.shaderDataList[j].data = {
                            type: 0x00B2D882,
                            group: 0x80000000,
                            instance: swatchData.instance
                        };
                    }
                }
            }
            var newMATDBufferB = newMATDB.toBuffer();
            var newChunkNormalB = new ChunkEntry({ type: tgi.type, group: tgi.group, instance: (tgi.instance + BigInt(matdIndexBurnt)) }, newMATDBufferB, matdIndexBurnt);
            list.push(newChunkNormalB);
        }
        mtstChunk.buffer = mtst.toBuffer();
        this.blockList.chunkEntries = list;
        //console.log({mtst:mtst,matd:matd});
        //console.log({mtstChunk:mtstChunk,matdChunk:matdChunk});
        //Testing
        //let folder = "C:\\Users\\fabis\\Desktop\\QuickTest\\GRF";
        //let rawFile = path.join(folder,"raw.bnry");
        //let newFile = path.join(folder,"new.bnry");
        //fs.writeFileSync(rawFile,this.buffer);
        //fs.writeFileSync(newFile,this.toBufferBasedOnChunks());
        return this.toBufferBasedOnChunks();
    };
    GenericRCOLFile.prototype.toBufferBasedOnChunks = function () {
        if (!this.blockList || !this.blockList.chunkEntries)
            return;
        var byteBuffer = new BinaryWritter();
        byteBuffer.writeInt(this.version);
        byteBuffer.writeInt(this.publicChunks);
        byteBuffer.writeInt(this.unused);
        var countResources = this.resources.length;
        var countChunks = this.blockList.chunkEntries.length;
        byteBuffer.writeInt(countResources);
        byteBuffer.writeInt(countChunks);
        for (var index = 0; index < countChunks; index++) {
            var element = this.blockList.chunkEntries[index];
            if (element.tgiBlock)
                byteBuffer.writeTGIItemByOrdnerType(element.tgiBlock, 4, false);
        }
        for (var index = 0; index < countResources; index++) {
            var element = this.resources[index];
            if (element)
                byteBuffer.writeTGIItemByOrdnerType(element, 4, false);
        }
        var startOffest = byteBuffer.pos + (8 * countChunks);
        for (var index = 0; index < countChunks; index++) {
            var element = this.blockList.chunkEntries[index];
            if (element.buffer) {
                var elementSize = element.buffer.length;
                var position = startOffest;
                startOffest += elementSize;
                byteBuffer.writeInt(position);
                byteBuffer.writeInt(elementSize);
            }
        }
        //Write all files
        for (var index = 0; index < countChunks; index++) {
            var element = this.blockList.chunkEntries[index];
            var fileBuffer = element.buffer;
            if (fileBuffer) {
                byteBuffer.writeBytes(fileBuffer);
            }
        }
        return byteBuffer.toBuffer();
    };
    return GenericRCOLFile;
}());
exports.GenericRCOLFile = GenericRCOLFile;
var ChunkEntryList = /** @class */ (function () {
    //parentTGIBlocks:TGIList|undefined;
    function ChunkEntryList(bb, chunks, indexs) {
        this.chunkEntries = [];
        for (var i = 0; i < indexs.length; i++) {
            var index = indexs[i];
            bb.pos = index.position;
            var data = bb.getSection(index.length);
            var ce = new ChunkEntry(chunks[i], data, i);
            this.chunkEntries.push(ce);
        }
    }
    return ChunkEntryList;
}());
exports.ChunkEntryList = ChunkEntryList;
var ChunkEntry = /** @class */ (function () {
    function ChunkEntry(tgiBlock, buffer, index) {
        this.index = index;
        this.tgiBlock = tgiBlock;
        this.buffer = buffer;
        var bb = new ByteBuffer(buffer);
        var magic = bb.getInt();
        bb.pos = 0;
        switch (magic) {
            case 0x4c444f4d: //MODL
                this.file = new MODLFile(buffer);
                //console.log(this.file);
                break;
            case 0x4454414d: //MATD
                this.file = new MATDFile(buffer);
                break;
            case 0x444f4c4d: //MLOD
                this.file = new MLODFile(buffer);
                //console.log(this.file);
                break;
            case 0x46554256: //VBUF
                this.file = new VBUFFile(buffer);
                //console.log(this.file);
                //process.exit();
                break;
            case 0x46554249: //IBUF
                this.file = new IBUFFile(buffer);
                break;
            case 0x46545256: //VRTF
                this.file = new VRTFFile(buffer);
                break;
            case 0x5453544d: //MTST
                this.file = new MTSTFile(buffer);
                break;
        }
    }
    return ChunkEntry;
}());
exports.ChunkEntry = ChunkEntry;
var VRTFFile = /** @class */ (function () {
    function VRTFFile(buffer) {
        this.magic = 0;
        this.version = 0;
        this.stride = 0;
        this.extendedFormat = false;
        this.layouts = [];
        if (!buffer)
            return;
        this.buffer = buffer;
        this.calculateData();
    }
    VRTFFile.prototype.calculateData = function () {
        if (!this.buffer)
            throw new Error("No Buffer");
        //fs.writeFileSync("C:\\Users\\fabis\\Pictures\\Frame-CC-Testing\\VRTF_Frame.bnry",this.buffer);
        var bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x46545256)
            throw new Error("Not VRTF");
        this.version = bb.getInt();
        this.stride = bb.getInt();
        var count = bb.getInt();
        this.extendedFormat = bb.getInt() > 0 ? true : false; // Stange but used in refrerence
        this.layouts = [];
        for (var index = 0; index < count; index++) {
            var usage = bb.getByte();
            var usageIndex = bb.getByte();
            var format = bb.getByte();
            var offset = bb.getByte();
            var element = {
                usage: usage,
                usageIndex: usageIndex,
                format: format,
                offset: offset
            };
            this.layouts.push(element);
        }
    };
    VRTFFile.prototype.getFirstOfUsage = function (usage) {
        for (var index = 0; index < this.layouts.length; index++) {
            var element = this.layouts[index];
            if (element.usage == usage)
                return element;
        }
        return undefined;
    };
    VRTFFile.prototype.getAllOfUsage = function (usage) {
        var list = [];
        for (var index = 0; index < this.layouts.length; index++) {
            var element = this.layouts[index];
            if (element.usage == usage)
                list.push(element);
        }
        return list;
    };
    VRTFFile.prototype.loadDefaults = function () {
        this.version = 0x2;
        this.stride = 16;
        this.extendedFormat = false;
        var layout1 = {
            format: 12,
            offset: 0,
            usage: 0,
            usageIndex: 0
        };
        var layout2 = {
            format: 255,
            offset: 8,
            usage: 2,
            usageIndex: 0
        };
        this.layouts = [];
        this.layouts.push(layout1);
        this.layouts.push(layout2);
    };
    VRTFFile.floatCountFromFormat = function (format) {
        switch (format) {
            case ElementFormat.Float1:
                return 1;
            case ElementFormat.Float2:
            case ElementFormat.UShort2N:
            case ElementFormat.Short2:
                return 2;
            case ElementFormat.Short4:
            case ElementFormat.Short4N:
            case ElementFormat.UByte4N:
            case ElementFormat.UShort4N:
            case ElementFormat.Float3:
                return 3;
            case ElementFormat.ColorUByte4:
            case ElementFormat.Float4:
            case ElementFormat.Short4_DropShadow:
                return 4;
            default:
                throw new Error("Unknown Format: " + format);
        }
    };
    VRTFFile.byteSizeFromFormat = function (f) {
        switch (f) {
            case ElementFormat.Float1:
            case ElementFormat.UByte4:
            case ElementFormat.ColorUByte4:
            case ElementFormat.UByte4N:
            case ElementFormat.UShort2N:
            case ElementFormat.Short2:
                return 4;
            case ElementFormat.UShort4N:
            case ElementFormat.Float2:
            case ElementFormat.Short4:
            case ElementFormat.Short4N:
            case ElementFormat.Short4_DropShadow:
                return 8;
            case ElementFormat.Float3:
                return 12;
            case ElementFormat.Float4:
                return 16;
            default:
                throw new Error("Unknown Format: " + f);
        }
    };
    return VRTFFile;
}());
exports.VRTFFile = VRTFFile;
var IBUFFile = /** @class */ (function () {
    function IBUFFile(buffer) {
        this.magic = 0;
        this.version = 0;
        this.flags = 0;
        this.displayListUsage = 0;
        this.indices = [];
        this.buffer = buffer;
        this.calculateData();
    }
    IBUFFile.prototype.calculateData = function () {
        //fs.writeFileSync("C:\\Users\\fabis\\Pictures\\Frame-CC-Testing\\IBUF_Frame.bnry",this.buffer);
        var bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x46554249)
            throw new Error("Not IBUF");
        this.version = bb.getInt();
        this.flags = bb.getInt();
        this.displayListUsage = bb.getInt();
        var is32Bit = (this.flags & 0x2) != 0;
        var length = (bb.max - bb.pos) / (is32Bit ? 4 : 2);
        var last = 0;
        this.indices = [];
        for (var index = 0; index < length; index++) {
            var cur = is32Bit ? bb.getSignedInt() : bb.getSignedShort();
            if ((this.flags & 0x1) != 0) {
                cur += last;
            }
            this.indices.push(cur);
            last = cur;
        }
    };
    IBUFFile.prototype.getFaces = function (corners) {
        if (corners === void 0) { corners = 3; }
        //Check if can be divided by 3
        if (this.indices.length % corners != 0) {
            throw new Error("Not a valid face count");
        }
        var faces = [];
        for (var index = 0; index < this.indices.length; index += corners) {
            var face = [];
            for (var i = 0; i < corners; i++) {
                face.push(this.indices[index + i]);
            }
            faces.push(face);
        }
        return faces;
    };
    return IBUFFile;
}());
exports.IBUFFile = IBUFFile;
var VBUFFile = /** @class */ (function () {
    function VBUFFile(buffer) {
        this.magic = 0;
        this.version = 0;
        this.flags = 0;
        this.swizzleInfo = 0;
        this.buffer = buffer;
        this.calculateData();
    }
    VBUFFile.prototype.calculateData = function () {
        //fs.writeFileSync("C:\\Users\\fabis\\Pictures\\Frame-CC-Testing\\VBUF_Frame.bnry",this.buffer);
        var bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x46554256)
            throw new Error("Not VBUF");
        this.version = bb.getInt();
        this.flags = bb.getInt();
        this.swizzleInfo = bb.getInt();
        this.dataBuffer = bb.getSection(bb.max - bb.pos);
    };
    VBUFFile.prototype.getVertices = function (vrtf, uvscales) {
        if (uvscales === void 0) { uvscales = [0.00003051851, 0.00003051851, 0.00003051851]; }
        var position = vrtf.getFirstOfUsage(0x0);
        var normal = vrtf.getFirstOfUsage(0x1);
        var uv = vrtf.getAllOfUsage(0x2);
        var blendIndices = vrtf.getFirstOfUsage(0x3);
        var blendWeights = vrtf.getFirstOfUsage(0x4);
        var tangents = vrtf.getFirstOfUsage(0x5);
        var color = vrtf.getFirstOfUsage(0x6);
        var vertices = [];
        if (!this.dataBuffer)
            throw new Error("No DataBuffer");
        var bb = new ByteBuffer(this.dataBuffer);
        var stride = vrtf.stride;
        var count = bb.max / stride;
        for (var index = 0; index < count; index++) {
            var vData = bb.getSection(stride);
            var vbb = new ByteBuffer(vData);
            var vertex = {};
            if (position != undefined) {
                var p = [];
                p = this.readFloatData(vbb, position);
                vertex.p = p;
            }
            if (normal != undefined) {
                var n = [];
                n = this.readFloatData(vbb, normal);
                vertex.n = n;
            }
            if (uv && uv.length > 0) {
                var uvs = [];
                for (var i = 0; i < uv.length; i++) {
                    var scale = i < uvscales.length && uvscales[i] != 0 ? uvscales[i] : uvscales[0];
                    var uvData = this.readUVData(vbb, uv[i], scale);
                    uvs.push(uvData);
                }
                vertex.uvc = uvs;
                if (uvs.length >= 1 && uvs[0].length >= 2) {
                    var uvSimple = [uvs[0][0], uvs[0][1]];
                    vertex.u = uvSimple;
                }
            }
            vertices.push(vertex);
        }
        return vertices;
    };
    VBUFFile.prototype.readFloatData = function (bb, layout) {
        bb.pos = layout.offset;
        var scalar;
        var output = [];
        var outputSize = VRTFFile.floatCountFromFormat(layout.format);
        for (var index = 0; index < outputSize; index++) {
            output.push(0);
        }
        switch (layout.format) {
            case ElementFormat.Float1:
            case ElementFormat.Float2:
            case ElementFormat.Float3:
            case ElementFormat.Float4:
                for (var i = 0; i < output.length; i++) {
                    bb.pos = (i * 4) + layout.offset;
                    output[i] += bb.getFloat();
                }
                break;
            case ElementFormat.Short2:
                for (var i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    output[i] += bb.getSignedShort() / 32767;
                }
                break;
            case ElementFormat.Short4:
                bb.pos = 3 * 2;
                scalar = bb.getSignedShort();
                if (scalar == 0)
                    scalar = 32767;
                for (var i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    output[i] += bb.getSignedShort() / scalar;
                }
                break;
            case ElementFormat.UShort4N:
                bb.pos = (3 * 2) + layout.offset;
                scalar = bb.getShort();
                if (scalar == 0)
                    scalar = 511;
                for (var i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    output[i] += bb.getShort() / scalar;
                }
                break;
            case ElementFormat.UByte4N:
                bb.pos = 3 + layout.offset;
                scalar = bb.getByte();
                if (scalar == 0)
                    scalar = 127;
                for (var i = 0; i < output.length; i++) {
                    bb.pos = i + layout.offset;
                    output[i] += bb.getByte() / scalar;
                }
                break;
            default:
                console.log("Unknown Format: " + layout.format);
        }
        return output;
    };
    VBUFFile.prototype.readUVData = function (bb, layout, scale) {
        if (scale === void 0) { scale = 0.00003051851; }
        var output = [];
        var outputSize = VRTFFile.floatCountFromFormat(layout.format);
        for (var index = 0; index < outputSize; index++) {
            output.push(0);
        }
        switch (layout.format) {
            case ElementFormat.Short2:
                for (var i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    var value = bb.getSignedShort();
                    output[i] += value * scale;
                }
                break;
            case ElementFormat.Short4:
                for (var i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    var value = bb.getSignedShort();
                    output[i] += value / 32767;
                }
                break;
            case ElementFormat.Short4_DropShadow:
                for (var i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    var value = bb.getSignedShort();
                    if (i < output.length - 1) {
                        output[i] += value / 32767;
                    }
                    else {
                        output[i] += value / 511;
                    }
                }
                break;
            default:
                return this.readFloatData(bb, layout);
        }
        return output;
    };
    return VBUFFile;
}());
exports.VBUFFile = VBUFFile;
var MODLFile = /** @class */ (function () {
    function MODLFile(buffer) {
        this.magic = 0;
        this.version = 0;
        this.buffer = buffer;
        this.calculateData();
    }
    MODLFile.prototype.calculateData = function () {
        var bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x4c444f4d) {
            throw new Error("Not MODL");
        }
        this.version = bb.getInt();
        var count = bb.getInt();
        this.bounds = {
            min: {
                x: bb.getFloat(),
                y: bb.getFloat(),
                z: bb.getFloat()
            },
            max: {
                x: bb.getFloat(),
                y: bb.getFloat(),
                z: bb.getFloat()
            }
        };
        //Dont Care currently not relevant
    };
    return MODLFile;
}());
exports.MODLFile = MODLFile;
var MLODFile = /** @class */ (function () {
    function MLODFile(buffer) {
        this.magic = 0;
        this.version = 0;
        this.meshInfos = [];
        this.buffer = buffer;
        this.calculateData();
    }
    MLODFile.prototype.calculateData = function () {
        var bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x444f4c4d) {
            throw new Error("Not MLOD");
        }
        this.version = bb.getInt();
        var count = bb.getInt();
        this.meshInfos = [];
        for (var index = 0; index < count; index++) {
            //Mesh File?
            var mesh = new MeshFile(bb, this);
            this.meshInfos.push(mesh);
        }
    };
    return MLODFile;
}());
exports.MLODFile = MLODFile;
var MeshFile = /** @class */ (function () {
    function MeshFile(bb, mLodFile) {
        this.name = 0;
        this.materialIndex = 0;
        this.vertexFormatIndex = 0;
        this.vertexBufferIndex = 0;
        this.indexBufferIndex = 0;
        this.materialIndexSplit = undefined;
        this.vertexFormatIndexSplit = undefined;
        this.vertexBufferIndexSplit = undefined;
        this.indexBufferIndexSplit = undefined;
        this.primitiveType = undefined;
        this.flags = undefined;
        this.streamOffset = 0;
        this.startVertex = 0;
        this.startIndex = 0;
        this.minVertexIndex = 0;
        this.vertexCount = 0;
        this.primitiveCount = 0;
        this.bounds = undefined;
        this.skinControllerIndex = 0;
        this.jointReferences = undefined;
        this.meshMaterialIndex = 0;
        this.geometryStates = undefined;
        this.parentBoneName = 0;
        this.mirrorPlane = undefined;
        this.sortOrderHint = 0;
        this.boundingBoxBones = undefined;
        this.bb = bb;
        this.mLodFile = mLodFile;
        this.calculateData();
    }
    MeshFile.prototype.calculateData = function () {
        var size = this.bb.getInt();
        this.name = this.bb.getInt();
        this.materialIndex = this.bb.getInt();
        this.vertexFormatIndex = this.bb.getInt();
        this.vertexBufferIndex = this.bb.getInt();
        this.indexBufferIndex = this.bb.getInt();
        this.materialIndexSplit = {
            type: (this.materialIndex & 0xF0000000) >> 28,
            index: this.materialIndex & 0x0FFFFFFF
        };
        this.vertexFormatIndexSplit = {
            type: (this.vertexFormatIndex & 0xF0000000) >> 28,
            index: this.vertexFormatIndex & 0x0FFFFFFF
        };
        this.vertexBufferIndexSplit = {
            type: (this.vertexBufferIndex & 0xF0000000) >> 28,
            index: this.vertexBufferIndex & 0x0FFFFFFF
        };
        this.indexBufferIndexSplit = {
            type: (this.indexBufferIndex & 0xF0000000) >> 28,
            index: this.indexBufferIndex & 0x0FFFFFFF
        };
        var val = this.bb.getInt();
        this.primitiveType = val & 0x000000FF;
        this.flags = (val >> 8);
        this.streamOffset = this.bb.getInt();
        this.startVertex = this.bb.getSignedInt();
        this.startIndex = this.bb.getSignedInt();
        this.minVertexIndex = this.bb.getSignedInt();
        this.vertexCount = this.bb.getSignedInt();
        this.primitiveCount = this.bb.getSignedInt();
        this.bounds = new BoundingBox(this.bb);
        this.skinControllerIndex = this.bb.getInt();
        this.jointReferences = [];
        var count = this.bb.getInt();
        for (var index = 0; index < count; index++) {
            this.jointReferences.push(this.bb.getInt());
            //Not sure if this is correct
        }
        this.meshMaterialIndex = this.bb.getInt();
        var geometryStateCount = this.bb.getInt();
        this.geometryStates = [];
        for (var index = 0; index < geometryStateCount; index++) {
            this.geometryStates.push({
                name: this.bb.getInt(),
                startIndex: this.bb.getSignedInt(),
                minVertexIndex: this.bb.getSignedInt(),
                vertexCount: this.bb.getSignedInt(),
                primitiveCount: this.bb.getSignedInt()
            });
        }
        if (this.mLodFile.version > 0x00000201) {
            this.parentBoneName = this.bb.getInt();
            this.mirrorPlane = {
                x: this.bb.getFloat(),
                y: this.bb.getFloat(),
                z: this.bb.getFloat(),
                w: this.bb.getFloat()
            };
        }
        if (this.mLodFile.version > 0x00000203) {
            this.sortOrderHint = this.bb.getInt();
        }
        if (this.mLodFile.version >= 0x00000206 && (this.flags & 0x4000) > 0 && this.jointReferences.length > 0) {
            this.boundingBoxBones = [];
            for (var i = 0; i < this.jointReferences.length; i++) {
                this.boundingBoxBones.push(new BoundingBox(this.bb));
            }
        }
    };
    return MeshFile;
}());
exports.MeshFile = MeshFile;
var BoundingBox = /** @class */ (function () {
    function BoundingBox(bb) {
        this.min = new Vertex(bb);
        this.max = new Vertex(bb);
    }
    return BoundingBox;
}());
var Vertex = /** @class */ (function () {
    function Vertex(bb) {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        if (bb)
            this.read(bb);
    }
    Vertex.prototype.read = function (bb) {
        this.x = bb.getFloat();
        this.y = bb.getFloat();
        this.z = bb.getFloat();
    };
    return Vertex;
}());
var MATDFile = /** @class */ (function () {
    function MATDFile(buffer) {
        this.magic = 0;
        this.version = 0;
        this.materialNameHash = 0;
        this.shader = 0;
        this.isVideoSurface = false;
        this.isPaintingSurface = false;
        this.buffer = buffer;
        this.calculateData();
    }
    MATDFile.prototype.calculateData = function () {
        var bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x4454414d) {
            throw new Error("Not MATD");
        }
        this.version = bb.getInt();
        this.materialNameHash = bb.getInt();
        this.shader = bb.getInt();
        var length = bb.getInt();
        var start;
        if (this.version < 0x00000103) {
            start = bb.pos;
        }
        else {
            this.isVideoSurface = bb.getInt() != 0;
            this.isPaintingSurface = bb.getInt() != 0;
            start = bb.pos;
        }
        if (start + length > bb.max) {
            throw new Error("Length Error");
        }
        //Read MTRL
        var mtrlBuffer = bb.getSection(length);
        this.mtrl = new MTRLFile(mtrlBuffer);
    };
    MATDFile.prototype.toBuffer = function () {
        var bb = new BinaryWritter();
        bb.writeInt(this.magic);
        if (this.magic != 0x4454414d) {
            throw new Error("Not MATD");
        }
        bb.writeInt(this.version);
        bb.writeInt(this.materialNameHash);
        bb.writeInt(this.shader);
        if (!this.mtrl)
            throw new Error("No mtrl");
        var mtrlBuffer = this.mtrl.toBuffer();
        var length = mtrlBuffer.length;
        bb.writeInt(length);
        if (this.version >= 0x00000103) {
            bb.writeInt(this.isVideoSurface ? 1 : 0);
            bb.writeInt(this.isPaintingSurface ? 1 : 0);
        }
        bb.writeBytes(mtrlBuffer);
        return bb.toBuffer();
    };
    MATDFile.prototype.getDiffuseTexture = function () {
        if (!this.mtrl)
            return undefined;
        var list = this.mtrl.shaderDataList;
        for (var index = 0; index < list.length; index++) {
            var element = list[index];
            if (element.field == 0x6CC0FD85 && element.data) {
                return element.data;
            }
        }
        return undefined;
    };
    return MATDFile;
}());
exports.MATDFile = MATDFile;
var MTRLFile = /** @class */ (function () {
    function MTRLFile(buffer) {
        this.magic = 0;
        this.mtrlUnknown1 = 0;
        this.mtrlUnknown2 = 0;
        this.mtrlUnknown3 = 0;
        this.shaderDataList = [];
        this.buffer = buffer;
        this.calculateData();
    }
    MTRLFile.prototype.calculateData = function () {
        var bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x4c52544d) {
            throw new Error("Not MTRL");
        }
        this.mtrlUnknown1 = bb.getInt();
        this.mtrlUnknown2 = bb.getShort();
        this.mtrlUnknown3 = bb.getShort();
        var count = bb.getInt();
        for (var index = 0; index < count; index++) {
            var field = bb.getInt();
            var sdType = bb.getInt();
            var c = bb.getInt();
            var offset = bb.getInt();
            var pos = bb.pos;
            bb.pos = offset;
            var data = this.readData(bb, sdType, c);
            bb.pos = pos;
            this.shaderDataList.push({
                field: field,
                sdType: sdType,
                count: c,
                offset: offset,
                data: data
            });
        }
    };
    MTRLFile.prototype.readData = function (bb, sdType, count) {
        switch (sdType) {
            case 0x1:
                switch (count) {
                    case 1:
                        return [bb.getFloat()];
                    case 2:
                        return [bb.getFloat(), bb.getFloat()];
                    case 3:
                        return [bb.getFloat(), bb.getFloat(), bb.getFloat()];
                    case 4:
                        return [bb.getFloat(), bb.getFloat(), bb.getFloat(), bb.getFloat()];
                }
                throw new Error("Invalid count!");
            case 0x2:
                switch (count) {
                    case 1:
                        return [bb.getInt()];
                }
                throw new Error("Invalid count!");
            case 0x4: //Texture
                switch (count) {
                    case 4:
                        return bb.readTGIItemByOrdner(4);
                    case 5:
                        var obj = bb.readTGIItemByOrdner(4);
                        var zero = bb.getInt();
                        if (zero != 0)
                            throw new Error("No zero padding?!");
                        return obj;
                }
                throw new Error("Invalid count!");
            case 0x00010004:
                switch (count) {
                    case 4:
                        return bb.readTGIItemByOrdner(4);
                }
                throw new Error("Invalid count!");
        }
        return undefined;
    };
    MTRLFile.prototype.toBuffer = function () {
        var bb = new BinaryWritter();
        bb.writeInt(this.magic);
        if (this.magic != 0x4c52544d) {
            throw new Error("Not MTRL");
        }
        bb.writeInt(this.mtrlUnknown1);
        bb.writeShort(this.mtrlUnknown2);
        bb.writeShort(this.mtrlUnknown3);
        var count = this.shaderDataList.length;
        bb.writeInt(count);
        var offsets = [];
        var currentPos = bb.pos + count * 16; // 16 bytes for each entry (4 ints)
        for (var index = 0; index < count; index++) {
            var entry = this.shaderDataList[index];
            bb.writeInt(entry.field);
            bb.writeInt(entry.sdType);
            bb.writeInt(entry.count);
            offsets.push(currentPos);
            bb.writeInt(currentPos);
            currentPos += this.calculateDataSize(entry.sdType, entry.count);
        }
        for (var index = 0; index < count; index++) {
            var entry = this.shaderDataList[index];
            bb.pos = offsets[index];
            this.writeData(bb, entry.sdType, entry.count, entry.data);
        }
        return bb.toBuffer();
    };
    MTRLFile.prototype.calculateDataSize = function (sdType, count) {
        switch (sdType) {
            case 0x1:
                return count * 4; // float size
            case 0x2:
                return count * 4; // int size
            case 0x4:
                return count == 4 ? 16 : 20; // TGIItem size
            case 0x00010004:
                return 16; // TGIItem size
            default:
                throw new Error("Invalid sdType!");
        }
    };
    MTRLFile.prototype.writeData = function (bb, sdType, count, data) {
        switch (sdType) {
            case 0x1:
                for (var i = 0; i < count; i++) {
                    bb.writeFloat(data[i]);
                }
                break;
            case 0x2:
                for (var i = 0; i < count; i++) {
                    bb.writeInt(data[i]);
                }
                break;
            case 0x4:
                if (count == 4) {
                    bb.writeTGIItemByOrdnerType(data, 4, false);
                }
                else if (count == 5) {
                    bb.writeTGIItemByOrdnerType(data, 4, false);
                    bb.writeInt(0); // zero padding
                }
                else {
                    throw new Error("Invalid count!");
                }
                break;
            case 0x00010004:
                if (count == 4) {
                    bb.writeTGIItemByOrdnerType(data, 4, false);
                }
                else {
                    throw new Error("Invalid count!");
                }
                break;
            default:
                throw new Error("Invalid sdType!");
        }
    };
    return MTRLFile;
}());
exports.MTRLFile = MTRLFile;
var MTSTFile = /** @class */ (function () {
    function MTSTFile(buffer) {
        this.magic = 0;
        this.version = 0;
        this.nameHash = 0;
        this.entries = [];
        this.indexUnused = 0;
        this.is200 = false;
        this.buffer = buffer;
        this.calculateData();
    }
    MTSTFile.prototype.calculateData = function () {
        var bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x5453544d) {
            throw new Error("Not MTRL");
        }
        this.version = bb.getInt();
        this.nameHash = bb.getInt();
        this.indexUnused = bb.getInt();
        this.is200 = this.version < 0x300;
        var count = bb.getInt();
        this.entries = [];
        for (var i = 0; i < count; i++) {
            var index = undefined;
            var materialState = undefined;
            var materialVariant = undefined;
            index = (bb.getInt() & 0x0FFFFFFF);
            materialState = bb.getInt();
            if (!this.is200)
                materialVariant = bb.getInt();
            this.entries.push({
                index: index,
                materialState: materialState,
                materialVariant: materialVariant
            });
        }
    };
    MTSTFile.prototype.toBuffer = function () {
        var bb = new BinaryWritter();
        bb.writeInt(this.magic);
        bb.writeInt(this.version);
        bb.writeInt(this.nameHash);
        bb.writeInt(this.indexUnused);
        this.is200 = this.version < 0x300;
        var count = this.entries.length;
        bb.writeInt(count);
        for (var i = 0; i < count; i++) {
            var entry = this.entries[i];
            var index = entry.index & 0x0FFFFFFF;
            var materialState = entry.materialState;
            var materialVariant = entry.materialVariant;
            bb.writeInt(index);
            bb.writeInt(materialState);
            if (!this.is200) {
                bb.writeInt(materialVariant);
            }
        }
        return bb.toBuffer();
    };
    return MTSTFile;
}());
exports.MTSTFile = MTSTFile;
var CASPMapper = /** @class */ (function () {
    function CASPMapper() {
    }
    CASPMapper.calcIntToBodyMap = function () {
        var map = new Map();
        map.set(0, BodyType.ALL);
        map.set(1, BodyType.HATS);
        map.set(2, BodyType.HAIR);
        map.set(3, BodyType.HEAD);
        map.set(4, BodyType.FACE);
        map.set(5, BodyType.FULLBODY);
        map.set(6, BodyType.TOPS);
        map.set(7, BodyType.BOTTOMS);
        map.set(8, BodyType.SHOES);
        map.set(9, BodyType.ACCESSORIES);
        map.set(0x0A, BodyType.PIERCINGS);
        map.set(0x0B, BodyType.GLASSES);
        map.set(0x0C, BodyType.NECKLACES);
        map.set(0x0D, BodyType.GLOVES);
        map.set(0x0E, BodyType.BRACELETS);
        map.set(0x0F, BodyType.BRACELETS);
        map.set(0x10, BodyType.PIERCINGS); //LipRingLeft
        map.set(0x11, BodyType.PIERCINGS); //LipRingRight
        map.set(0x12, BodyType.PIERCINGS); //NoseRingLeft
        map.set(0x13, BodyType.PIERCINGS); //NoseRingRight
        map.set(0x14, BodyType.PIERCINGS); //BrowRingLeft
        map.set(0x15, BodyType.PIERCINGS); //BrowRingRight
        map.set(0x16, BodyType.RINGS);
        map.set(0x17, BodyType.RINGS);
        map.set(0x18, BodyType.RINGS); //RingThirdLeft
        map.set(0x19, BodyType.RINGS); //RingThirdRight
        map.set(0x1A, BodyType.RINGS);
        map.set(0x1B, BodyType.RINGS);
        map.set(0x1C, BodyType.FACIALHAIR);
        map.set(0x1D, BodyType.LIPS);
        map.set(0x1E, BodyType.EYE_SHADOW);
        map.set(0x1F, BodyType.EYELINER);
        map.set(0x20, BodyType.CHEEKS);
        map.set(0x21, BodyType.FACEPAINT);
        map.set(0x22, BodyType.EYES);
        map.set(0x23, BodyType.EYES);
        map.set(0x24, BodyType.SOCKS);
        map.set(0x25, BodyType.EYELASHES);
        map.set(0x26, BodyType.SKINDETAILS); //ForeheadCrease
        map.set(0x27, BodyType.SKINDETAILS);
        map.set(0x28, BodyType.SKINDETAILS); //DimpleLeft
        map.set(0x29, BodyType.SKINDETAILS); //DimpleRight
        map.set(0x2A, BodyType.LEGGINS);
        map.set(0x2B, BodyType.FACEPAINT);
        map.set(0x2C, BodyType.FACEPAINT);
        map.set(0x2D, BodyType.TATTOOS);
        map.set(0x2E, BodyType.TATTOOS);
        map.set(0x2F, BodyType.TATTOOS);
        map.set(0x30, BodyType.TATTOOS);
        map.set(0x31, BodyType.TATTOOS);
        map.set(0x32, BodyType.TATTOOS);
        map.set(0x33, BodyType.TATTOOS);
        map.set(0x34, BodyType.TATTOOS);
        map.set(0x35, BodyType.TATTOOS);
        map.set(0x36, BodyType.TATTOOS);
        map.set(0x71, BodyType.TATTOOS); // Tattos Head
        map.set(0x37, BodyType.FACEPAINT);
        map.set(0x38, BodyType.SKINDETAILS);
        map.set(0x39, BodyType.SKINDETAILS); //MouthCrease
        map.set(0x3A, BodyType.ALL);
        map.set(0x49, BodyType.FINGERNAILS);
        map.set(0x4A, BodyType.TOENAILS);
        this.NumberToType = map;
    };
    CASPMapper.calcIntToElement = function () {
        var map = new Map();
        map.set(99, BodyType.HAIR);
        map.set(78, BodyType.FACIALHAIR);
        map.set(79, BodyType.HATS);
        map.set(80, BodyType.MAKEUP);
        map.set(81, BodyType.TOPS);
        map.set(82, BodyType.BOTTOMS);
        map.set(83, BodyType.FULLBODY);
        map.set(84, BodyType.SHOES);
        map.set(85, BodyType.ACCESSORIES);
        map.set(92, BodyType.ACCESSORIESFACE);
        this.NumberToElement = map;
    };
    CASPMapper.calcIntToTag = function () {
        var map = new Map();
        //Hair
        map.set(0x0296, BodyType.SHORT);
        map.set(0x0334, BodyType.MEDIUM);
        map.set(0x0298, BodyType.LONG);
        map.set(0x087D, BodyType.UPDO);
        //Bottoms
        map.set(152, BodyType.PANTS);
        map.set(153, BodyType.SKIRTS);
        map.set(154, BodyType.SHORTS);
        map.set(381, BodyType.SKINTIGHT);
        map.set(382, BodyType.JEANS);
        map.set(945, BodyType.CROPPED);
        map.set(946, BodyType.UNDERWEAR); //Female
        map.set(1040, BodyType.UNDERWEAR); //Male
        map.set(1235, BodyType.SWIMWEAR);
        map.set(1238, BodyType.SWIMWEAR); //Swimshorts
        //Tops
        map.set(155, BodyType.BLOUSES);
        map.set(156, BodyType.VESTS);
        map.set(295, BodyType.JACKETS);
        map.set(296, BodyType.TSHIRTS);
        map.set(297, BodyType.SWEATERS);
        map.set(360, BodyType.TANKS);
        map.set(395, BodyType.BUTTONUP);
        map.set(941, BodyType.SWEATSHIRTS);
        map.set(942, BodyType.SUITJACKETS);
        map.set(943, BodyType.POLOS);
        map.set(944, BodyType.BRASSIERES);
        map.set(1236, BodyType.SWIMSUITS);
        //Hat
        map.set(371, BodyType.BRIMMED);
        map.set(372, BodyType.BRIMLESS);
        map.set(373, BodyType.CAPS);
        //Full Body
        map.set(374, BodyType.JUMPSUITS);
        map.set(375, BodyType.LONGDRESSES);
        map.set(376, BodyType.SHORTDRESSES);
        map.set(377, BodyType.FULL_BODY_SUITS); //SUIT??
        map.set(947, BodyType.OUTERWEAR);
        map.set(948, BodyType.COSTUMES);
        map.set(949, BodyType.ROBES);
        map.set(950, BodyType.LINGERIE);
        map.set(951, BodyType.APRONS);
        map.set(952, BodyType.JUMPSUITS); //Overall?
        map.set(1237, BodyType.SWIMSUITS);
        //FacialHair
        map.set(378, BodyType.BEARDS);
        map.set(379, BodyType.GOATEES);
        map.set(380, BodyType.MOUSTACHES);
        //SHOES
        map.set(383, BodyType.BOOTS); //Booties?
        map.set(384, BodyType.BOOTS);
        map.set(385, BodyType.FLATS);
        map.set(386, BodyType.HEELS);
        map.set(387, BodyType.BOOTS);
        map.set(388, BodyType.FLATS);
        map.set(389, BodyType.LOAFERS);
        map.set(390, BodyType.SANDALS);
        map.set(391, BodyType.SLIPPERS);
        map.set(392, BodyType.SNEAKERS);
        map.set(393, BodyType.WEDGES);
        this.NumberToTag = map;
    };
    CASPMapper.calcTypeToArray = function () {
        var map = new Map();
        map.set(BodyType.BODYUP, "[T1]");
        map.set(BodyType.BODYDOWN, "[T2]");
        map.set(BodyType.ALL, "");
        //Head
        map.set(BodyType.FACE, "[T1]-[M1]-[B1]");
        map.set(BodyType.SKINDETAILS, "[T1]-[M1]-[B2]");
        map.set(BodyType.TEETH, "[T1]-[M1]-[B3]");
        map.set(BodyType.HEAD, "[T1]-[M1]");
        map.set(BodyType.SHORT, "[T1]-[M2]-[B1]");
        map.set(BodyType.MEDIUM, "[T1]-[M2]-[B2]");
        map.set(BodyType.LONG, "[T1]-[M2]-[B3]");
        map.set(BodyType.UPDO, "[T1]-[M2]-[B4]");
        map.set(BodyType.HAIR, "[T1]-[M2]");
        map.set(BodyType.BEARDS, "[T1]-[M3]-[B1]");
        map.set(BodyType.GOATEES, "[T1]-[M3]-[B2]");
        map.set(BodyType.MOUSTACHES, "[T1]-[M3]-[B3]");
        map.set(BodyType.FACIALHAIR, "[T1]-[M3]");
        map.set(BodyType.BRIMMED, "[T1]-[M4]-[B1]");
        map.set(BodyType.BRIMLESS, "[T1]-[M4]-[B2]");
        map.set(BodyType.CAPS, "[T1]-[M4]-[B3]");
        map.set(BodyType.HATS, "[T1]-[M4]");
        map.set(BodyType.PIERCINGS, "[T1]-[M5]-[B1]");
        map.set(BodyType.GLASSES, "[T1]-[M5]-[B2]");
        map.set(BodyType.NECKLACES, "[T1]-[M5]-[B3]");
        map.set(BodyType.ACCESSORIESFACE, "[T1]-[M5]");
        map.set(BodyType.EYES, "[T1]-[M6]-[B1]");
        map.set(BodyType.EYELINER, "[T1]-[M6]-[B2]");
        map.set(BodyType.CHEEKS, "[T1]-[M6]-[B3]");
        map.set(BodyType.LIPS, "[T1]-[M6]-[B4]");
        map.set(BodyType.FACEPAINT, "[T1]-[M6]-[B5]");
        map.set(BodyType.EYE_SHADOW, "[T1]-[M6]-[B6]");
        map.set(BodyType.EYELASHES, "[T1]-[M6]-[B7]");
        map.set(BodyType.MAKEUP, "[T1]-[M6]");
        //Body
        map.set(BodyType.BODIES, "[T2]-[M7]-[B1]");
        map.set(BodyType.TATTOOS, "[T2]-[M7]-[B2]");
        map.set(BodyType.BODY, "[T2]-[M7]");
        map.set(BodyType.BLOUSES, "[T2]-[M8]-[B1]");
        map.set(BodyType.JACKETS, "[T2]-[M8]-[B2]");
        map.set(BodyType.TSHIRTS, "[T2]-[M8]-[B3]");
        map.set(BodyType.SWEATERS, "[T2]-[M8]-[B4]");
        map.set(BodyType.TANKS, "[T2]-[M8]-[B5]");
        map.set(BodyType.BUTTONUP, "[T2]-[M8]-[B6]");
        map.set(BodyType.SWEATSHIRTS, "[T2]-[M8]-[B7]");
        map.set(BodyType.SUITJACKETS, "[T2]-[M8]-[B8]");
        map.set(BodyType.POLOS, "[T2]-[M8]-[B9]");
        map.set(BodyType.BRASSIERES, "[T2]-[M8]-[B10]");
        map.set(BodyType.SWIMSUITS, "[T2]-[M8]-[B11]");
        map.set(BodyType.VESTS, "[T2]-[M8]-[B12]");
        map.set(BodyType.TOPS, "[T2]-[M8]");
        map.set(BodyType.JUMPSUITS, "[T2]-[M9]-[B1]");
        map.set(BodyType.LONGDRESSES, "[T2]-[M9]-[B2]");
        map.set(BodyType.SHORTDRESSES, "[T2]-[M9]-[B3]");
        map.set(BodyType.SETS, "[T2]-[M9]-[B4]");
        map.set(BodyType.OUTERWEAR, "[T2]-[M9]-[B5]");
        map.set(BodyType.COSTUMES, "[T2]-[M9]-[B6]");
        map.set(BodyType.ROBES, "[T2]-[M9]-[B7]");
        map.set(BodyType.LINGERIE, "[T2]-[M9]-[B8]");
        map.set(BodyType.APRONS, "[T2]-[M9]-[B9]");
        map.set(BodyType.FULL_BODY_SUITS, "[T2]-[M9]-[B11]");
        map.set(BodyType.FULLBODY, "[T2]-[M9]");
        map.set(BodyType.PANTS, "[T2]-[M10]-[B1]");
        map.set(BodyType.SKIRTS, "[T2]-[M10]-[B2]");
        map.set(BodyType.SHORTS, "[T2]-[M10]-[B3]");
        map.set(BodyType.SKINTIGHT, "[T2]-[M10]-[B4]");
        map.set(BodyType.JEANS, "[T2]-[M10]-[B5]");
        map.set(BodyType.CROPPED, "[T2]-[M10]-[B6]");
        map.set(BodyType.UNDERWEAR, "[T2]-[M10]-[B7]");
        map.set(BodyType.SWIMWEAR, "[T2]-[M10]-[B8]");
        map.set(BodyType.BOTTOMS, "[T2]-[M10]");
        map.set(BodyType.BRACELETS, "[T2]-[M11]-[B1]");
        map.set(BodyType.GLOVES, "[T2]-[M11]-[B2]");
        map.set(BodyType.RINGS, "[T2]-[M11]-[B3]");
        map.set(BodyType.FINGERNAILS, "[T2]-[M11]-[B4]");
        map.set(BodyType.TOENAILS, "[T2]-[M11]-[B5]");
        map.set(BodyType.LEGGINS, "[T2]-[M11]-[B6]");
        map.set(BodyType.SOCKS, "[T2]-[M11]-[B7]");
        map.set(BodyType.ACCESSORIES, "[T2]-[M11]");
        map.set(BodyType.SANDALS, "[T2]-[M12]-[B1]");
        map.set(BodyType.FLATS, "[T2]-[M12]-[B2]");
        map.set(BodyType.LOAFERS, "[T2]-[M12]-[B3]");
        map.set(BodyType.SLIPPERS, "[T2]-[M12]-[B4]");
        map.set(BodyType.HEELS, "[T2]-[M12]-[B5]");
        map.set(BodyType.WEDGES, "[T2]-[M12]-[B6]");
        map.set(BodyType.SNEAKERS, "[T2]-[M12]-[B7]");
        map.set(BodyType.BOOTS, "[T2]-[M12]-[B8]");
        map.set(BodyType.SHOES, "[T2]-[M12]");
        this.TypeToValueArray = map;
    };
    CASPMapper.calcPartsWithoutGeom = function () {
        this.PartsWithoutGeom = new Set();
        this.PartsWithoutGeom.add(BodyType.TATTOOS);
        this.PartsWithoutGeom.add(BodyType.MAKEUP);
        this.PartsWithoutGeom.add(BodyType.LIPS);
        this.PartsWithoutGeom.add(BodyType.EYELINER);
        this.PartsWithoutGeom.add(BodyType.EYES);
        this.PartsWithoutGeom.add(BodyType.FACEPAINT);
        this.PartsWithoutGeom.add(BodyType.FACE);
        this.PartsWithoutGeom.add(BodyType.CHEEKS);
        this.PartsWithoutGeom.add(BodyType.EYE_SHADOW);
        this.PartsWithoutGeom.add(BodyType.SKINDETAILS);
    };
    CASPMapper.calcAll = function () {
        this.calcIntToBodyMap();
        this.calcIntToElement();
        this.calcIntToTag();
        this.calcTypeToArray();
        this.calcPartsWithoutGeom();
    };
    CASPMapper.getArrayFormTag = function (b) {
        var arr = "";
        if (this.TypeToValueArray.has(b)) {
            var r = this.TypeToValueArray.get(b);
            if (r != undefined) {
                return r;
            }
        }
        return arr;
    };
    CASPMapper.readValues = function (body_value, flags, result) {
        if (this.NumberToElement.size == 0 || this.NumberToElement.size == 0 || this.NumberToTag.size == 0) {
            this.calcAll();
        }
        //Base Value
        if (this.NumberToType.has(body_value)) {
            result.push(this.NumberToType.get(body_value));
        }
        //Flags
        for (var i = 0; i < flags.length; i++) {
            var element = flags[i];
            var tag = element.a;
            var v = element.b;
            var hasElement = this.NumberToElement.has(tag);
            if (hasElement && this.NumberToTag.has(v)) {
                result.push(this.NumberToTag.get(v));
            }
        }
    };
    CASPMapper.NumberToType = new Map();
    CASPMapper.NumberToElement = new Map();
    CASPMapper.NumberToTag = new Map();
    CASPMapper.TypeToValueArray = new Map();
    CASPMapper.PartsWithoutGeom = new Set();
    return CASPMapper;
}());
exports.CASPMapper = CASPMapper;
var COBJMapper = /** @class */ (function () {
    function COBJMapper() {
    }
    COBJMapper.buildSet = new Set([
        232,
        233,
        242,
        250,
        251,
        535,
        536,
        537,
        538,
        539,
        540,
        541,
        542,
        543,
        544,
        545,
        546,
        547,
        548,
        549,
        550,
        551,
        552,
        554,
        555,
        556,
        557,
        558,
        559,
        560,
        561,
        653,
        782,
        787,
        906,
        915,
        918,
        919,
        974,
        975,
        976,
        977,
        981,
        1062,
        1063,
        1064,
        1065,
        1066,
        1067,
        1068,
        1069,
        1070,
        1081,
        1226,
        1227,
        1441,
        1442
    ]);
    COBJMapper.buildBuySet = new Set([
        221,
        217,
        222,
        218,
        219,
        225,
        971,
        914,
        223,
        220,
        916,
        229,
        214,
        212,
        962,
        963,
        1123,
        216,
        215,
        210,
        211,
        917,
        1126,
        213,
        1072,
        228,
        180,
        182,
        920,
        181,
        183,
        184,
        192,
        969,
        457,
        968,
        441,
        173,
        175,
        174,
        970,
        458,
        456,
        202,
        446,
        207,
        964,
        965,
        197,
        978,
        200,
        824,
        2188,
        198,
        785,
        201,
        196,
        199,
        823,
        209,
        167,
        172,
        179,
        203,
        204,
        206,
        310,
        205,
        1718,
        208,
        161,
        164,
        1122,
        162,
        163,
        169,
        171,
        55356,
        177,
        189,
        187,
        913,
        190,
        188,
        972,
        973,
        1945,
        1976,
        966,
        967,
        185,
        186,
        193,
        191,
        226,
        227,
        1071,
        230,
        2385,
        2382,
        2380,
        2381,
        2384,
        2383,
        165,
        166,
        168,
        176,
        224,
        170,
        178,
        194,
        195,
        231,
        252,
        428,
        429,
        430,
        440,
        979,
        1228,
        1246,
        1261,
        1352,
        1496
    ]);
    COBJMapper.patternSet = new Set([
        94,
        298,
        299,
        300,
        301,
        302,
        303,
        304,
        305,
        306,
        307,
        308,
        309,
        408,
        409,
        410,
        411,
        412,
        413,
        414,
        415
    ]);
    COBJMapper.otherSet = new Set([
        1353,
        1354,
        1355,
        1356,
        1357,
        1358,
        1359,
        1360,
        1361,
        1362,
        1363,
        1364,
        1459,
        18436,
        24578,
        24612,
        24613,
        24614,
        93,
        270,
        271,
        272,
        273,
        274,
        275,
        276,
        407,
        468,
        864,
        1041,
        1042,
        1043,
        1044,
        1045,
        1046,
        1047,
        1048,
        1049,
        1050,
        1051,
        1052,
        1053,
        1159
    ]);
    return COBJMapper;
}());
exports.COBJMapper = COBJMapper;
var BodyType;
(function (BodyType) {
    BodyType[BodyType["BODYUP"] = 0] = "BODYUP";
    BodyType[BodyType["BODYDOWN"] = 1] = "BODYDOWN";
    BodyType[BodyType["ALL"] = 2] = "ALL";
    BodyType[BodyType["HEAD"] = 3] = "HEAD";
    BodyType[BodyType["FACE"] = 4] = "FACE";
    BodyType[BodyType["SKINDETAILS"] = 5] = "SKINDETAILS";
    BodyType[BodyType["TEETH"] = 6] = "TEETH";
    BodyType[BodyType["SHORT"] = 7] = "SHORT";
    BodyType[BodyType["MEDIUM"] = 8] = "MEDIUM";
    BodyType[BodyType["LONG"] = 9] = "LONG";
    BodyType[BodyType["UPDO"] = 10] = "UPDO";
    BodyType[BodyType["HAIR"] = 11] = "HAIR";
    BodyType[BodyType["BEARDS"] = 12] = "BEARDS";
    BodyType[BodyType["GOATEES"] = 13] = "GOATEES";
    BodyType[BodyType["MOUSTACHES"] = 14] = "MOUSTACHES";
    BodyType[BodyType["FACIALHAIR"] = 15] = "FACIALHAIR";
    BodyType[BodyType["BRIMMED"] = 16] = "BRIMMED";
    BodyType[BodyType["BRIMLESS"] = 17] = "BRIMLESS";
    BodyType[BodyType["CAPS"] = 18] = "CAPS";
    BodyType[BodyType["HATS"] = 19] = "HATS";
    BodyType[BodyType["PIERCINGS"] = 20] = "PIERCINGS";
    BodyType[BodyType["GLASSES"] = 21] = "GLASSES";
    BodyType[BodyType["NECKLACES"] = 22] = "NECKLACES";
    BodyType[BodyType["ACCESSORIES"] = 23] = "ACCESSORIES";
    BodyType[BodyType["ACCESSORIESFACE"] = 24] = "ACCESSORIESFACE";
    BodyType[BodyType["EYES"] = 25] = "EYES";
    BodyType[BodyType["EYELINER"] = 26] = "EYELINER";
    BodyType[BodyType["CHEEKS"] = 27] = "CHEEKS";
    BodyType[BodyType["LIPS"] = 28] = "LIPS";
    BodyType[BodyType["FACEPAINT"] = 29] = "FACEPAINT";
    BodyType[BodyType["MAKEUP"] = 30] = "MAKEUP";
    BodyType[BodyType["BODIES"] = 31] = "BODIES";
    BodyType[BodyType["TATTOOS"] = 32] = "TATTOOS";
    BodyType[BodyType["BODY"] = 33] = "BODY";
    BodyType[BodyType["BLOUSES"] = 34] = "BLOUSES";
    BodyType[BodyType["JACKETS"] = 35] = "JACKETS";
    BodyType[BodyType["TSHIRTS"] = 36] = "TSHIRTS";
    BodyType[BodyType["SWEATERS"] = 37] = "SWEATERS";
    BodyType[BodyType["TANKS"] = 38] = "TANKS";
    BodyType[BodyType["BUTTONUP"] = 39] = "BUTTONUP";
    BodyType[BodyType["SWEATSHIRTS"] = 40] = "SWEATSHIRTS";
    BodyType[BodyType["SUITJACKETS"] = 41] = "SUITJACKETS";
    BodyType[BodyType["POLOS"] = 42] = "POLOS";
    BodyType[BodyType["BRASSIERES"] = 43] = "BRASSIERES";
    BodyType[BodyType["SWIMSUITS"] = 44] = "SWIMSUITS";
    BodyType[BodyType["VESTS"] = 45] = "VESTS";
    BodyType[BodyType["TOPS"] = 46] = "TOPS";
    BodyType[BodyType["JUMPSUITS"] = 47] = "JUMPSUITS";
    BodyType[BodyType["LONGDRESSES"] = 48] = "LONGDRESSES";
    BodyType[BodyType["SHORTDRESSES"] = 49] = "SHORTDRESSES";
    BodyType[BodyType["SETS"] = 50] = "SETS";
    BodyType[BodyType["OUTERWEAR"] = 51] = "OUTERWEAR";
    BodyType[BodyType["COSTUMES"] = 52] = "COSTUMES";
    BodyType[BodyType["ROBES"] = 53] = "ROBES";
    BodyType[BodyType["LINGERIE"] = 54] = "LINGERIE";
    BodyType[BodyType["APRONS"] = 55] = "APRONS";
    BodyType[BodyType["FULLBODY"] = 56] = "FULLBODY";
    BodyType[BodyType["PANTS"] = 57] = "PANTS";
    BodyType[BodyType["SKIRTS"] = 58] = "SKIRTS";
    BodyType[BodyType["SHORTS"] = 59] = "SHORTS";
    BodyType[BodyType["SKINTIGHT"] = 60] = "SKINTIGHT";
    BodyType[BodyType["JEANS"] = 61] = "JEANS";
    BodyType[BodyType["CROPPED"] = 62] = "CROPPED";
    BodyType[BodyType["UNDERWEAR"] = 63] = "UNDERWEAR";
    BodyType[BodyType["SWIMWEAR"] = 64] = "SWIMWEAR";
    BodyType[BodyType["BOTTOMS"] = 65] = "BOTTOMS";
    BodyType[BodyType["BRACELETS"] = 66] = "BRACELETS";
    BodyType[BodyType["GLOVES"] = 67] = "GLOVES";
    BodyType[BodyType["RINGS"] = 68] = "RINGS";
    BodyType[BodyType["FINGERNAILS"] = 69] = "FINGERNAILS";
    BodyType[BodyType["TOENAILS"] = 70] = "TOENAILS";
    BodyType[BodyType["LEGGINS"] = 71] = "LEGGINS";
    BodyType[BodyType["SOCKS"] = 72] = "SOCKS";
    BodyType[BodyType["SANDALS"] = 73] = "SANDALS";
    BodyType[BodyType["FLATS"] = 74] = "FLATS";
    BodyType[BodyType["LOAFERS"] = 75] = "LOAFERS";
    BodyType[BodyType["SLIPPERS"] = 76] = "SLIPPERS";
    BodyType[BodyType["HEELS"] = 77] = "HEELS";
    BodyType[BodyType["WEDGES"] = 78] = "WEDGES";
    BodyType[BodyType["SNEAKERS"] = 79] = "SNEAKERS";
    BodyType[BodyType["BOOTS"] = 80] = "BOOTS";
    BodyType[BodyType["SHOES"] = 81] = "SHOES";
    BodyType[BodyType["FULL_BODY_SUITS"] = 82] = "FULL_BODY_SUITS";
    BodyType[BodyType["EYE_SHADOW"] = 83] = "EYE_SHADOW";
    BodyType[BodyType["EYELASHES"] = 84] = "EYELASHES";
})(BodyType || (exports.BodyType = BodyType = {}));
var TagType;
(function (TagType) {
    TagType[TagType["CASP"] = 0] = "CASP";
    TagType[TagType["THUM"] = 1] = "THUM";
    TagType[TagType["S4MMTHUM"] = 2] = "S4MMTHUM";
    TagType[TagType["OTHER"] = 3] = "OTHER";
    TagType[TagType["COBJ"] = 4] = "COBJ";
    TagType[TagType["GEOM"] = 5] = "GEOM";
    TagType[TagType["CLIP"] = 6] = "CLIP";
    TagType[TagType["XML"] = 7] = "XML";
    TagType[TagType["CLHD"] = 8] = "CLHD";
    TagType[TagType["IMG"] = 9] = "IMG";
    TagType[TagType["HHI"] = 10] = "HHI";
    TagType[TagType["SGI"] = 11] = "SGI";
    TagType[TagType["NONE"] = 12] = "NONE";
    TagType[TagType["CWAL"] = 13] = "CWAL";
    TagType[TagType["CFLR"] = 14] = "CFLR";
    TagType[TagType["MATD"] = 15] = "MATD";
    TagType[TagType["STBL"] = 16] = "STBL";
    TagType[TagType["ZONEOBJ"] = 17] = "ZONEOBJ";
    TagType[TagType["S4SMM"] = 18] = "S4SMM";
    TagType[TagType["RMAP"] = 19] = "RMAP";
})(TagType || (exports.TagType = TagType = {}));
var Helper = /** @class */ (function () {
    function Helper() {
    }
    Helper.getBodyTypes = function (file) {
        var bodyType = new Set();
        var bodyTypePlain = new Set();
        //BodyType
        var bodyTypes = [];
        CASPMapper.readValues(file.bodyType, file.flagList, bodyTypes);
        var bodyTag = CASPMapper.NumberToType.get(file.bodyType);
        if (bodyTag != undefined)
            bodyTypePlain.add(bodyTag);
        for (var index = 0; index < bodyTypes.length; index++) {
            var element = bodyTypes[index];
            var str = CASPMapper.getArrayFormTag(element);
            if (str.length != 0) {
                bodyType.add(str);
            }
        }
        return bodyType;
    };
    Helper.hexStringToHiLo = function (hexString) {
        if (hexString.length !== 16) {
            throw new Error('Hex string must be 16 characters long');
        }
        var hiHex = hexString.slice(0, 8);
        var loHex = hexString.slice(8, 16);
        var hi = parseInt(hiHex, 16);
        var lo = parseInt(loHex, 16);
        return { hi: hi, lo: lo };
    };
    return Helper;
}());
exports.Helper = Helper;
var SimsHashes = /** @class */ (function () {
    function SimsHashes() {
    }
    SimsHashes.fnv1_64 = function (strInput, useHighBit) {
        if (useHighBit === void 0) { useHighBit = false; }
        var str = strInput.toLowerCase();
        var hash = this.FNV_OFFSET_BASIS_64;
        for (var i = 0; i < str.length; i++) {
            hash = hash * this.FNV_PRIME_64;
            hash = hash ^ BigInt(str.charCodeAt(i));
            hash = hash & this.FNV_MASK_64;
        }
        hash = useHighBit ? this.highBit(hash) : hash;
        return { hex: hash.toString(16), num: hash };
    };
    SimsHashes.fnv1_32 = function (strInput, useHighBit) {
        if (useHighBit === void 0) { useHighBit = false; }
        var str = strInput.toLowerCase();
        var hash = this.FNV_OFFSET_BASIS_32;
        for (var i = 0; i < str.length; i++) {
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
            hash = (hash ^ str.charCodeAt(i)) >>> 0;
        }
        useHighBit ? this.highBit(hash) : hash;
        return { hex: hash.toString(16), num: hash };
    };
    SimsHashes.highBit = function (num) {
        var hexStr = num.toString(16).toUpperCase();
        var firstChar = hexStr.charAt(0);
        switch (firstChar) {
            case '0':
                firstChar = '8';
                break;
            case '1':
                firstChar = '9';
                break;
            case '2':
                firstChar = 'A';
                break;
            case '3':
                firstChar = 'B';
                break;
            case '4':
                firstChar = 'C';
                break;
            case '5':
                firstChar = 'D';
                break;
            case '6':
                firstChar = 'E';
                break;
            case '7':
                firstChar = 'F';
                break;
        }
        var modifiedHexStr = firstChar + hexStr.slice(1);
        var modifiedNum = BigInt('0x' + modifiedHexStr);
        return modifiedNum;
    };
    SimsHashes.instanceId = function (str, useHighBit) {
        if (useHighBit === void 0) { useHighBit = false; }
        str = str.toLowerCase();
        return this.fnv1_64(str, useHighBit);
    };
    SimsHashes.FNV_OFFSET_BASIS_64 = BigInt('0xcbf29ce484222325');
    SimsHashes.FNV_PRIME_64 = BigInt('0x100000001b3');
    SimsHashes.FNV_MASK_64 = BigInt('0xffffffffffffffff');
    SimsHashes.FNV_OFFSET_BASIS_32 = 0x811c9dc5;
    SimsHashes.FNV_PRIME_32 = 0x01000193;
    SimsHashes.FNV_MASK_32 = 0xffffffff;
    return SimsHashes;
}());
exports.SimsHashes = SimsHashes;
var PropertyID;
(function (PropertyID) {
    PropertyID[PropertyID["Name"] = 3891296134] = "Name";
    PropertyID[PropertyID["Tuning"] = 2031068348] = "Tuning";
    PropertyID[PropertyID["TuningID"] = 3113485211] = "TuningID";
    PropertyID[PropertyID["Icon"] = 3403602056] = "Icon";
    PropertyID[PropertyID["Rig"] = 3792088655] = "Rig";
    PropertyID[PropertyID["Slot"] = 2324017139] = "Slot";
    PropertyID[PropertyID["Model"] = 2367728838] = "Model";
    PropertyID[PropertyID["Footprint"] = 1819507416] = "Footprint";
    PropertyID[PropertyID["Components"] = 3873710587] = "Components";
    PropertyID[PropertyID["MaterialVariant"] = 3973425503] = "MaterialVariant";
    PropertyID[PropertyID["Unknown1"] = 2894994368] = "Unknown1";
    PropertyID[PropertyID["SimoleonPrice"] = 3841260196] = "SimoleonPrice";
    PropertyID[PropertyID["PositiveEnvironmentScore"] = 1916190442] = "PositiveEnvironmentScore";
    PropertyID[PropertyID["NegativeEnvironmentScore"] = 1157395730] = "NegativeEnvironmentScore";
    PropertyID[PropertyID["ThumbnailGeometryState"] = 1110702240] = "ThumbnailGeometryState";
    PropertyID[PropertyID["Unknown2"] = 3963032294] = "Unknown2";
    PropertyID[PropertyID["EnvironmentScoreEmotionTags"] = 561163966] = "EnvironmentScoreEmotionTags";
    PropertyID[PropertyID["EnvironmentScores"] = 3704652692] = "EnvironmentScores";
    PropertyID[PropertyID["Unknown3"] = 1391981756] = "Unknown3";
    PropertyID[PropertyID["IsBaby"] = 2934340124] = "IsBaby";
    PropertyID[PropertyID["Unknown4"] = 4086524560] = "Unknown4";
})(PropertyID || (PropertyID = {}));
var ElementFormat;
(function (ElementFormat) {
    ElementFormat[ElementFormat["Float1"] = 0] = "Float1";
    ElementFormat[ElementFormat["Float2"] = 1] = "Float2";
    ElementFormat[ElementFormat["Float3"] = 2] = "Float3";
    ElementFormat[ElementFormat["Float4"] = 3] = "Float4";
    ElementFormat[ElementFormat["UByte4"] = 4] = "UByte4";
    ElementFormat[ElementFormat["ColorUByte4"] = 5] = "ColorUByte4";
    ElementFormat[ElementFormat["Short2"] = 6] = "Short2";
    ElementFormat[ElementFormat["Short4"] = 7] = "Short4";
    ElementFormat[ElementFormat["UByte4N"] = 8] = "UByte4N";
    ElementFormat[ElementFormat["Short2N"] = 9] = "Short2N";
    ElementFormat[ElementFormat["Short4N"] = 10] = "Short4N";
    ElementFormat[ElementFormat["UShort2N"] = 11] = "UShort2N";
    ElementFormat[ElementFormat["UShort4N"] = 12] = "UShort4N";
    ElementFormat[ElementFormat["Dec3N"] = 13] = "Dec3N";
    ElementFormat[ElementFormat["UDec3N"] = 14] = "UDec3N";
    ElementFormat[ElementFormat["Float16_2"] = 15] = "Float16_2";
    ElementFormat[ElementFormat["Float16_4"] = 16] = "Float16_4";
    ElementFormat[ElementFormat["Short4_DropShadow"] = 255] = "Short4_DropShadow";
})(ElementFormat || (ElementFormat = {}));
/*
let p = new Pack(testFile);
p.checkFile();
p.calculateIndexList();
//p.exportBiggest("C:\\Users\\fabis\\S4MM Data\\test");
p.calulateCASPFiles();*/ 
