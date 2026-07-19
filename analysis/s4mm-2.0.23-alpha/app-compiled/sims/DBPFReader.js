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
exports.CASPMapper = exports.MixedHelpers = exports.PosePack = exports.PosePackHelper = exports.ThumCacheEntry = exports.ThumCacheTable = exports.MTSTFile = exports.MTRLFile = exports.MATDFile = exports.MeshFile = exports.MLODFile = exports.MODLFile = exports.VBUFFile = exports.IBUFFile = exports.VRTFFile = exports.ChunkEntry = exports.ChunkEntryList = exports.GenericRCOLFile = exports.XMLResource = exports.XMLFile = exports.S4SMMFile = exports.GameFiles = exports.STBLFile = exports.GEOMResource = exports.ZoneObjItem = exports.ZoneObjFile = exports.GEOMFile = exports.RMAPFile = exports.CLIPResource = exports.COBJResource = exports.COBJFile = exports.OBJDFile = exports.CASPResource = exports.CASPFile = exports.LRLEFile = exports.REL2File = exports.CompressUtil = exports.Basic = exports.PackHandler = exports.BinaryWritter = exports.BufferOperations = exports.ByteBuffer = exports.SimsPatterns = exports.TrayFiles = exports.IndexEnty = exports.SaveFile = exports.ModelGroup = exports.COBJPack = exports.ImportInfoPack = exports.Pack = void 0;
exports.SimsHashes = exports.Helper = exports.TagType = exports.BodyType = exports.COBJMapper = void 0;
var fs = require('fs');
var zlib = require("zlib");
const sharp = require('sharp');
const path = require('path');
const { Buffer } = require('buffer');
const PNGImage = require('@nodebug/pngjs-image');
const Jimp = require("jimp");
const { readUleb128 } = require("uleb128_33");
const fast_xml_parser_1 = require("fast-xml-parser");
const NAMEUTIL = __importStar(require("../utils/FilenameUtils"));
const DDSUtil_js_1 = require("../utils/DDSUtil.js");
const Rel2Helper_1 = require("../utils/Rel2Helper");
class Pack {
    constructor(file) {
        this.fileID = 0;
        this.minor = -1;
        this.major = -1;
        this.inoId = -1;
        this.modified = false;
        this.resources = new Set();
        this.isS4SMerged = false;
        this.file = file;
        this.error = false;
        this.minor = -1;
        this.major = -1;
        this.index_Count = 0;
        this.index_Offset = 0;
        this.index_Size = 0;
        this.index_List = [];
    }
    checkFile() {
        try {
            this.fileID = fs.openSync(this.file);
            let buf = Buffer.alloc(0x60);
            fs.readSync(this.fileID, buf, 0, 0x60);
            fs.closeSync(this.fileID);
            let bb = new ByteBuffer(buf);
            if (bb.getInt() != 0x46504244) {
                this.error = true;
                return;
            }
            this.major = bb.getInt();
            this.minor = bb.getInt();
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
    }
    calculateIndexList() {
        try {
            this.index_List = [];
            let buf = Buffer.alloc(this.index_Size);
            this.fileID = fs.openSync(this.file);
            fs.readSync(this.fileID, buf, 0, buf.length, this.index_Offset);
            fs.closeSync(this.fileID);
            let bb = new ByteBuffer(buf);
            this.isS4SMerged = false;
            let type = bb.getByte();
            if (type != 0x2 && type != 0 && type != 1 && type != 0x4 && type != 0x3 && type != 0x7)
                throw new Error("Unknown Index Entry Table Version! " + type);
            //bb.pos = type == 0x2 ? 8 : 4;
            switch (type) {
                case 0x2:
                    bb.pos = 8;
                    break;
                default:
                    bb.pos = 4;
            }
            let fixedHi = undefined;
            let fixedType = undefined;
            let fixedGroup = undefined;
            if (type == 0x4) {
                fixedHi = bb.getInt();
                if (!fixedHi)
                    throw new Error("Invalid Fixed Hi Value for Index Entry Table Version 4! " + fixedHi);
            }
            else if (type == 0x3) {
                fixedType = bb.getInt();
                fixedGroup = bb.getInt();
            }
            for (let index = 0; index < this.index_Count; index++) {
                switch (type) {
                    case 0x7: {
                        let r_type = bb.getInt();
                        let r_group = bb.getInt();
                        let i_hi = bb.getInt();
                        let i_lo = bb.getInt();
                        let chunckOffset = bb.getInt();
                        let filesize = (bb.getInt() << 1) >>> 1;
                        let memsize = bb.getInt();
                        let com = bb.getShort();
                        let unknown = bb.getShort();
                        let entry = new IndexEnty(this.file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown);
                        this.resources.add(entry.getKey());
                        this.index_List.push(entry);
                    }
                    case 0x3: {
                        let r_type = fixedType;
                        let r_group = fixedGroup;
                        let i_hi = bb.getInt();
                        let i_lo = bb.getInt();
                        let chunckOffset = bb.getInt();
                        let filesize = (bb.getInt() << 1) >>> 1;
                        let memsize = bb.getInt();
                        let com = bb.getShort();
                        let unknown = bb.getShort();
                        if (r_group != undefined && r_type != undefined) {
                            let entry = new IndexEnty(this.file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown);
                            this.resources.add(entry.getKey());
                            this.index_List.push(entry);
                        }
                        break;
                    }
                    case 0x4: {
                        let i_hi = fixedHi;
                        let r_type = bb.getInt();
                        let r_group = bb.getInt();
                        let i_lo = bb.getInt();
                        let chunckOffset = bb.getInt();
                        let filesize = (bb.getInt() << 1) >>> 1;
                        let memsize = bb.getInt();
                        let com = bb.getShort();
                        let unknown = bb.getShort();
                        if (i_hi) {
                            let entry = new IndexEnty(this.file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown);
                            this.resources.add(entry.getKey());
                            this.index_List.push(entry);
                        }
                        break;
                    }
                    case 0x2: {
                        let r_type = bb.getInt();
                        let r_group = 0;
                        let i_hi = bb.getInt();
                        let i_lo = bb.getInt();
                        let chunckOffset = bb.getInt();
                        let filesize = (bb.getInt() << 1) >>> 1;
                        let memsize = bb.getInt();
                        let com = bb.getShort();
                        let unknown = bb.getShort();
                        let entry = new IndexEnty(this.file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown);
                        this.resources.add(entry.getKey());
                        this.index_List.push(entry);
                        break;
                    }
                    case 0: {
                        let r_type = bb.getInt();
                        let r_group = bb.getInt();
                        let i_hi = bb.getInt();
                        let i_lo = bb.getInt();
                        let chunckOffset = bb.getInt();
                        let filesize = (bb.getInt() << 1) >>> 1;
                        let memsize = bb.getInt();
                        let com = bb.getShort();
                        let unknown = bb.getShort();
                        if (r_type < 0)
                            this.error = true;
                        if (r_group < 0)
                            this.error = true;
                        let entry = new IndexEnty(this.file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown);
                        this.resources.add(entry.getKey());
                        this.index_List.push(entry);
                        break;
                    }
                    default:
                        throw new Error("Unknown Index Entry Table Version! " + type);
                }
            }
            //if (entry.type == TagType.S4SMM) this.isS4SMerged = true;
            for (let index = 0; index < this.index_List.length; index++) {
                const element = this.index_List[index];
                if (element.type == TagType.S4SMM) {
                    this.isS4SMerged = true;
                }
            }
        }
        catch (err) {
            console.log(err);
            //fs.closeSync(this.fileID);
            this.error = true;
        }
    }
    async exportThumnails(folder, prefix, simpleName) {
        let list = [];
        this.index_List.sort((a, b) => {
            return a.filesize - b.filesize;
        });
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.THUM || element.type == TagType.S4MMTHUM) {
                let inp = element.getByteArray();
                let n_typ = element.r_type.toString(16).padStart(8, "0");
                let n_group = element.r_group.toString(16).padStart(8, "0");
                let n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                let name = "0x" + n_inst + ".png";
                if (simpleName == false || simpleName == undefined) {
                    name = n_typ + "-" + n_group + "-" + n_inst + ".png";
                }
                let file = folder + path.sep + prefix + name;
                if (element.type == TagType.S4MMTHUM) {
                    fs.writeFileSync(file, inp);
                }
                else {
                    await PackHandler.saveBufferToFile(file, inp, true, this.file);
                }
                if (fs.existsSync(file)) {
                    list.push(file);
                }
            }
        }
        return list;
    }
    async exportThumnailsSpecial(folder, complex, simpleName, replace) {
        let list = [];
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0x3c1af1f2 && replace) {
                let inp = element.getByteArray();
                let n_typ = element.r_type.toString(16).padStart(8, "0");
                let n_group = element.r_group.toString(16).padStart(8, "0");
                let n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                let name = "0x" + n_inst + ".png";
                if (simpleName == false || simpleName == undefined) {
                    name = n_typ + "-" + n_group + "-" + n_inst + ".png";
                }
                let file = folder + path.sep + name;
                await PackHandler.saveBufferToFile(file, inp, complex, this.file);
                if (fs.existsSync(file)) {
                    list.push({
                        name: name,
                        path: folder
                    });
                }
            }
            else if (element.r_type == 0x3c1af1f2 && replace == false) {
                let n_typ = element.r_type.toString(16).padStart(8, "0");
                let n_group = element.r_group.toString(16).padStart(8, "0");
                let n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                let name = "0x" + n_inst + ".png";
                if (simpleName == false || simpleName == undefined) {
                    name = n_typ + "-" + n_group + "-" + n_inst + ".png";
                }
                let file = folder + path.sep + name;
                if (!fs.existsSync(file)) {
                    let inp = element.getByteArray();
                    await PackHandler.saveBufferToFile(file, inp, complex, this.file);
                    if (fs.existsSync(file)) {
                        list.push({
                            name: name,
                            folder: folder
                        });
                    }
                }
            }
        }
        return list;
    }
    async exportCASThumnails(folder, simpleName, replace, complex) {
        let list = [];
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0x3c1af1f2) {
                let inp = element.getByteArray();
                let n_typ = element.r_type.toString(16).padStart(8, "0");
                let n_group = element.r_group.toString(16).padStart(8, "0");
                let n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                let ext = "jpeg";
                let name = "0x" + n_inst + "." + ext;
                if (simpleName == false || simpleName == undefined) {
                    name = n_typ + "-" + n_group + "-" + n_inst + "." + ext;
                }
                let file = folder + path.sep + name;
                if (!fs.existsSync(file) || replace)
                    await PackHandler.saveCASCOBJImageBufferToFile(file, inp, complex);
                if (fs.existsSync(file)) {
                    list.push({
                        name: name,
                        path: folder
                    });
                }
                else {
                    console.log("File dosent exist! - " + file);
                }
            }
        }
        return list;
    }
    async exportCOBJThumnails(folder, simpleName, replace, complex) {
        let list = [];
        //Get Biggest Items
        let itemMap = new Map();
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0x3C2A8647) {
                let key = element.getInstanceString();
                let item = itemMap.get(key);
                if (!item || item.memsize < element.memsize)
                    itemMap.set(key, element);
            }
        }
        let elements = Array.from(itemMap.values());
        for (let index = 0; index < elements.length; index++) {
            const element = elements[index];
            let inp = element.getByteArray();
            let n_typ = element.r_type.toString(16).padStart(8, "0");
            let n_group = element.r_group.toString(16).padStart(8, "0");
            let n_inst = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
            let ext = "jpeg";
            let name = "0x" + n_inst + "." + ext;
            if (simpleName == false || simpleName == undefined) {
                name = n_typ + "-" + n_group + "-" + n_inst + "." + ext;
            }
            let file = folder + path.sep + name;
            if (!fs.existsSync(file) || replace)
                await PackHandler.saveCASCOBJImageBufferToFile(file, inp, complex);
            if (fs.existsSync(file)) {
                list.push({
                    name: name,
                    path: folder
                });
            }
            else {
                console.log("File dosent exist! - " + file);
            }
        }
        return list;
    }
    async exportBiggest(folderPath) {
        let biggest = this.getBiggestThumIndexEntry();
        if (biggest != undefined) {
            let file = folderPath + path.sep + "[CC]" + this.inoId + ".png";
            if (biggest.type == TagType.S4MMTHUM) {
                fs.writeFileSync(file, biggest.getByteArray());
            }
            else {
                await PackHandler.saveBufferToFile(file, biggest.getByteArray(), false, this.file);
            }
        }
    }
    async getBiggestToFile(filepath) {
        let biggest = this.getBiggestThumIndexEntry();
        if (biggest != undefined) {
            if (biggest.type == TagType.S4MMTHUM) {
                fs.writeFileSync(filepath, biggest.getByteArray());
            }
            else {
                await PackHandler.saveBufferToFile(filepath, biggest.getByteArray(), false, this.file);
            }
        }
        return fs.existsSync(filepath);
    }
    getBiggestThumIndexEntry() {
        let biggest;
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
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
    }
    calculateXMLFiles() {
        let xmlResource = new XMLResource();
        for (let index = 0; index < this.index_List.length; index++) {
            let entry = this.index_List[index];
            if (entry.type == TagType.XML) {
                xmlResource.processXMLEntry(entry);
            }
        }
        this.xmlResource = xmlResource.cTypesCombinedString.length > 0 ? xmlResource : undefined;
    }
    calulateCASPFiles() {
        //Read Casp
        let files = [];
        let hasGeom = false;
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.CASP) {
                let casp = new CASPFile(element.getByteArray());
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
        let cr = new CASPResource();
        //CombineCasp
        for (let index = 0; index < files.length; index++) {
            const element = files[index];
            cr.addFile(element);
        }
        cr.isRecolor = (!hasGeom && cr.propIds.size != 0 && cr.checkRecolor());
        this.caspResource = cr;
    }
    calulateCOBJFiles() {
        let hasGeom = false;
        let files = [];
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.COBJ
                || element.type == TagType.CFLR
                || element.type == TagType.CWAL) {
                let cobj = new COBJFile(element.getByteArray(), element.r_type);
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
        let cr = new COBJResource();
        //CombineCobj
        for (let index = 0; index < files.length; index++) {
            const element = files[index];
            cr.addFile(element);
        }
        this.cobjResource = cr;
    }
    calulateCLIPFiles() {
        let hasCLIP = false;
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.CLIP) {
                //let casp: CASPFile = new CASPFile(element.getByteArray());
                //casp.instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                //if (!casp.error) files.push(casp);
                hasCLIP = true;
            }
        }
        if (hasCLIP)
            this.clipResource = new CLIPResource();
    }
    calulateGEOMFiles() {
        //Read GEOM
        let files = [];
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.GEOM) {
                let geom = new GEOMFile(element.getByteArray());
                geom.instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                //console.log(casp.instanceID);
                if (!geom.error) {
                    files.push(geom);
                    //console.log(geom.toString())
                }
            }
        }
        if (files.length == 0)
            return;
        let gFile = new GEOMResource();
        gFile.files = files;
        this.geomResource = gFile;
    }
    calulateGEOMSizeMapFiles() {
        let map = new Map();
        //Read GEOM
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.GEOM) {
                let geom = new GEOMFile(element.getByteArray(), true);
                geom.instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                let key = element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                if (!geom.error) {
                    map.set(key, { vertex: geom.vertexCount, faces: geom.facesCount });
                }
            }
        }
        return map;
    }
    calulateGEOMSizeMapFilesCASP() {
        let map = new Map();
        if (!this.caspResource)
            return map;
        let caspFiles = this.caspResource.caspFiles;
        let lodMap = new Map();
        let propIdMap = new Map();
        for (let index = 0; index < caspFiles.length; index++) {
            const caspFile = caspFiles[index];
            const lodLevels = caspFile.lodLevels;
            for (let i = 0; i < lodLevels.length; i++) {
                const element = lodLevels[i];
                for (let j = 0; j < element.list.length; j++) {
                    const id = element.list[j];
                    lodMap.set(id, element.level);
                    propIdMap.set(id, caspFile.propId);
                }
            }
        }
        let oMap = new Map();
        let items = [];
        let min = Number.MAX_SAFE_INTEGER;
        let max = 0;
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.GEOM) {
                let key = element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                if (lodMap.has(key)) {
                    let geom = new GEOMFile(element.getByteArray(), true);
                    geom.instanceID = "0x" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                    if (!geom.error) {
                        let propId = propIdMap.get(key);
                        if (geom.vertexCount > max) {
                            max = geom.vertexCount;
                        }
                        if (geom.vertexCount < min) {
                            min = geom.vertexCount;
                        }
                        let m = new Map();
                        if (oMap.has(propId)) {
                            m = oMap.get(propId);
                        }
                        m.set(key, { v: geom.vertexCount, f: geom.facesCount, l: lodMap.get(key) });
                        oMap.set(propId, m);
                    }
                }
            }
        }
        let keys = Array.from(oMap.keys());
        for (let index = 0; index < keys.length; index++) {
            const element = keys[index];
            let map = oMap.get(element);
            let ids = [];
            let innerKeys = Array.from(map.keys());
            for (let index = 0; index < innerKeys.length; index++) {
                const innerKey = innerKeys[index];
                let obj = map.get(innerKey);
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
    }
    calulateGEOMByInstance(instanceID) {
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            let key = element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
            key = key.toLowerCase();
            if (key == instanceID) {
                let geom = new GEOMFile(element.getByteArray());
                if (!geom.error) {
                    return geom.chunks;
                }
                //console.log("Found Data");
            }
        }
        return undefined;
    }
    getEntryIfExists(type, group, instance) {
        if (type == undefined && group == undefined && instance == undefined)
            return undefined;
        ;
        for (let index = this.index_List.length - 1; index >= 0; index--) {
            const element = this.index_List[index];
            let con_type = (type == undefined || type == element.r_type);
            let con_group = (group == undefined || group == element.r_group);
            let con_instance = (instance == undefined || instance === Basic.getInstanceKey(element));
            if (con_type && con_group && con_instance) {
                return element;
            }
        }
        return undefined;
    }
    getEntryIfExistsByKey(key) {
        for (let index = this.index_List.length - 1; index >= 0; index--) {
            const element = this.index_List[index];
            let con_key = element.getKey();
            if (con_key == key)
                return element;
        }
        return undefined;
    }
    async exportCacheThumbnails(casCobjPath, moodPath) {
        if (this.index_Count != this.index_List.length) {
            this.calculateIndexList();
        }
        let maxMood = 10;
        let moodSet = new Set();
        moodSet.add(0xC2);
        moodSet.add(0xD2);
        moodSet.add(0xF2);
        moodSet.add(0x102);
        moodSet.add(0x132);
        moodSet.add(0x152);
        moodSet.add(0x162);
        moodSet.add(0x172);
        //Check all files
        let list = [];
        let mood = [];
        let cobjMap = new Map();
        //CAS And Sorting
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0x3C1AF1F2) {
                //CAS
                let inp = element.getByteArray();
                let instanceId = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                instanceId = instanceId.toUpperCase();
                let file = casCobjPath + path.sep + instanceId + ".png";
                await PackHandler.saveBufferToFile(file, inp, true, this.file);
                if (fs.existsSync(file)) {
                    list.push(file);
                }
            }
            else if (element.r_type == 0x3C2A8647) {
                //COBJ
                let size = element.memsize;
                let key = element.r_type + "-" + element.i_hi + element.i_lo;
                if (cobjMap.has(key)) {
                    let sizeToBeat = cobjMap.get(key)?.memsize;
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
        }
        //Save Cobj
        let keys = Array.from(cobjMap.keys());
        for (let index = 0; index < keys.length; index++) {
            const element = cobjMap.get(keys[index]);
            if (element == undefined)
                continue;
            let inp = element.getByteArray();
            let instanceId = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
            instanceId = instanceId.toUpperCase();
            let file = casCobjPath + path.sep + instanceId + ".png";
            await PackHandler.saveBufferToFile(file, inp, true, this.file);
            if (fs.existsSync(file)) {
                list.push(file);
            }
        }
        //Mood
        if (moodPath.length != 0 && fs.existsSync(moodPath)) {
            for (let index = 0; index < maxMood && mood.length != 0; index++) {
                let pos = Math.floor(Math.random() * mood.length);
                let el = mood[pos];
                mood.slice(pos, 1);
                let inp = el.getByteArray();
                let file = moodPath + path.sep + index + ".png";
                await PackHandler.saveBufferToFile(file, inp, true, this.file);
                //if(fs.existsSync(file)){
                //    list.push(file);
                //}
            }
        }
    }
    getCASItemsList() {
        if (!this.caspResource)
            return [];
        let caspFiles = this.caspResource.caspFiles;
        let items = new Map();
        for (let index = 0; index < caspFiles.length; index++) {
            const element = caspFiles[index];
            let propId = element.propId;
            let l = [];
            if (items.has(propId)) {
                l = items.get(propId);
            }
            l.push(element);
            items.set(propId, l);
        }
        let list = [];
        let keys = Array.from(items.keys());
        for (let index = 0; index < keys.length; index++) {
            const key = keys[index];
            const obj = items.get(key);
            let caspData = [];
            let data = undefined;
            let sharedName = "";
            obj.forEach((element) => {
                if (data == undefined) {
                    data = {};
                    let cr = new CASPResource();
                    cr.addFile(element);
                    data.age = this.setToStringList(cr.age);
                    data.gender = this.setToStringList(cr.gender);
                    data.bodyType = this.setToStringList(cr.bodyType);
                    data.casFlags = this.setToStringList(cr.casFlags);
                    data.priSortOrder = this.setToStringList(cr.priSortOrder);
                    data.tgi = this.setToStringList(cr.tgi_list);
                    /*
                    data.bodyType=element.bodyType;
                    data.bodySubType=element.bodySubType;
                    data.ageGender=element.ageGender;
                    data.primSortIndex=element.primSortIndex;*/
                    sharedName = element.name;
                }
                else {
                    let cname = element.name;
                    for (let index = 0; index < Math.min(cname.length, sharedName.length); index++) {
                        const isSame = cname.charAt(index) == sharedName.charAt(index);
                        if (!isSame) {
                            sharedName = sharedName.substring(0, index);
                            index = cname.length;
                        }
                    }
                }
                let robj = {
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
                    let regionMap = element.TGIList[element.regionMapIndex];
                    robj.regionMap = regionMap;
                }
                if (element.diffuseIndex >= 0 && element.diffuseIndex < element.TGIList.length) {
                    let diffuseMap = element.TGIList[element.diffuseIndex];
                    robj.diffuseMap = diffuseMap;
                }
                caspData.push(robj);
            });
            data.sharedName = sharedName;
            list.push({ "propId": key, "items": caspData, "data": data });
        }
        return list;
    }
    setToStringList(set) {
        let result = "";
        let isFirst = true;
        set.forEach((value) => {
            if (isFirst) {
                result = value;
                isFirst = false;
            }
            else {
                result += ":" + value;
            }
        });
        return result;
    }
    addOrOverrideEntry(type, group, instance, buffer) {
        instance = instance.toLowerCase();
        this.removeEntry(type, group, instance);
        let { hi, lo } = Helper.hexStringToHiLo(instance);
        let ne = new IndexEnty(this.file, type, group, hi, lo, 0, buffer.length, buffer.length, 0x0, 0x01);
        this.modified = true;
        ne.setBuffer(buffer);
        this.index_List.push(ne);
    }
    removeEntry(type, group, instance) {
        if (type == undefined && group == undefined && instance == undefined)
            return;
        for (let index = this.index_List.length - 1; index >= 0; index--) {
            const element = this.index_List[index];
            let con_type = (type == undefined || type == element.r_type);
            let con_group = (group == undefined || group == element.r_group);
            let con_instance = (instance == undefined || instance === Basic.getInstanceKey(element));
            if (con_type && con_group && con_instance) {
                this.index_List.splice(index, 1);
                this.modified = true;
            }
        }
    }
    removeEntryByKey(key) {
        for (let index = this.index_List.length - 1; index >= 0; index--) {
            const element = this.index_List[index];
            if (Basic.getStingKey(element) == key) {
                this.index_List.splice(index, 1);
                this.modified = true;
            }
        }
    }
    getStartBuffer() {
        try {
            this.fileID = fs.openSync(this.file);
            let buf = Buffer.alloc(0x60);
            fs.readSync(this.fileID, buf, 0, 0x60);
            fs.closeSync(this.fileID);
            return buf;
        }
        catch (err) {
            throw new Error("Unable to read Start Buffer");
        }
    }
    createEndBufferFromIndexList(indexList) {
        try {
            let bufferSize = 4 + indexList.length * 32; // Adjust the size based on your structure
            let buf = Buffer.alloc(bufferSize);
            let bb = new ByteBuffer(buf);
            bb.pos = 4; // Start position
            indexList.forEach(entry => {
                bb.putInt(entry.r_type);
                bb.putInt(entry.r_group);
                bb.putInt(entry.i_hi);
                bb.putInt(entry.i_lo);
                bb.putInt(entry.chunckOffset);
                bb.putInt((entry.filesize & 0x0FFFFFFF) + 0x80000000);
                bb.putInt(entry.memsize);
                bb.putShort(entry.com);
                bb.putShort(entry.unknown);
            });
            return buf;
        }
        catch (err) {
            console.log(err);
            this.error = true;
            return null;
        }
    }
    createStartBuffer(index_Count, index_Size, index_Offset) {
        let buf = Buffer.alloc(0x60);
        let bb = new ByteBuffer(buf);
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
    }
    toBuffer() {
        let index_Count = this.index_List.length;
        let index_Size = 0; //How big is the end part
        let index_Offset = 0x60; //Were does the index part start (60+sizeof all item)
        let buffers = [];
        let index_List = [];
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            buffers.push(element.getByteArrayRaw());
            index_List.push(new IndexEnty(element.file, element.r_type, element.r_group, element.i_hi, element.i_lo, index_Offset, element.filesize, element.memsize, element.com, element.unknown));
            index_Offset = index_Offset + element.filesize;
        }
        let endBuffer = this.createEndBufferFromIndexList(index_List);
        index_Size = endBuffer.length;
        let startBuffer = this.createStartBuffer(index_Count, index_Size, index_Offset);
        buffers.push(endBuffer);
        buffers.unshift(startBuffer);
        return Buffer.concat(buffers);
    }
    saveToFile(filePath) {
        fs.writeFileSync(filePath, this.toBuffer());
    }
    getS4SMergedManifest() {
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.S4SMM) {
                let s4smmfile = new S4SMMFile(element);
                if (s4smmfile.error)
                    throw new Error("Failed to read mainifest: " + s4smmfile.error);
                return s4smmfile.toObj();
            }
        }
        throw new Error("No manifest found!");
    }
    getS4SMergedManifestComplete() {
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.S4SMM) {
                let s4smmfile = new S4SMMFile(element);
                if (s4smmfile.error)
                    throw new Error("Failed to read mainifest: " + s4smmfile.error);
                return s4smmfile;
            }
        }
        throw new Error("No manifest found!");
    }
    getFilteredIndexEntries(type) {
        return this.index_List.filter((value) => { return value.r_type == type; });
    }
    async getCOBJModels(tmpImageFolderPath) {
        if (!this.cobjResource)
            this.calulateCOBJFiles();
        if (!this.cobjResource)
            return undefined;
        let cobjEntries = this.getFilteredIndexEntries(0x319E4F1D);
        let objdEntries = this.getFilteredIndexEntries(0xC0DB5AE7);
        //Find pairs
        let instanceGroups = new Map();
        cobjEntries.forEach((value) => {
            let instance = Basic.getInstanceKey(value);
            let items = instanceGroups.get(instance);
            if (!items) {
                items = { cobj: undefined, objd: undefined };
            }
            items.cobj = value;
            instanceGroups.set(instance, items);
        });
        objdEntries.forEach((value) => {
            let instance = Basic.getInstanceKey(value);
            let items = instanceGroups.get(instance);
            if (!items) {
                items = { cobj: undefined, objd: undefined };
            }
            items.objd = value;
            instanceGroups.set(instance, items);
        });
        //Remove all Groups with not one of each
        let buildBuyFileGroups = Array.from(instanceGroups.values());
        buildBuyFileGroups.filter((value) => {
            return value.cobj != undefined && value.objd != undefined;
        });
        //Check for models/meshes
        let modelsMap = new Map();
        buildBuyFileGroups.forEach((value) => {
            let objd = value.objd;
            let objdFile = new OBJDFile(objd.getByteArray());
            if (objdFile.model) {
                objdFile.model.forEach((valueTGI) => {
                    let modelKey = Basic.tgiToKey(valueTGI);
                    let modelEntry = this.getEntryIfExistsByKey(modelKey);
                    if (modelEntry != undefined) {
                        let items = modelsMap.get(modelEntry);
                        if (!items)
                            items = [];
                        items.push(value);
                        modelsMap.set(modelEntry, items);
                    }
                    else {
                        console.log("Model not found: " + modelKey);
                    }
                });
            }
        });
        //Process STBLS
        let stblEntries = this.getFilteredIndexEntries(0x220557DA);
        let infoStringsMap = new Map();
        stblEntries.forEach((entrie) => {
            if (entrie.i_hi != 0)
                return;
            let stblFile = new STBLFile(entrie.getByteArray());
            let entries = stblFile.entries;
            entries.forEach((value) => {
                let key = value.key;
                let text = value.value;
                infoStringsMap.set(key, text);
            });
        });
        //Process Models
        let keys = Array.from(modelsMap.keys());
        let values = Array.from(modelsMap.values());
        let items = [];
        for (let index = 0; index < keys.length; index++) {
            const key = keys[index];
            const value = values[index];
            let modelFile = new GenericRCOLFile(key.getByteArray());
            //console.log(modelFile);
            let meshes = modelFile.getMeshTesting();
            let texturesAll = modelFile.getTextures();
            let textures = new Map();
            //Check Textures
            let textureEntries = new Set();
            let order = 0;
            texturesAll.forEach((value) => {
                let key = Basic.tgiToKey(value);
                let entry = this.getEntryIfExistsByKey(key);
                if (entry != undefined) {
                    textureEntries.add(entry);
                }
                if (!textures.has(key)) {
                    textures.set(key, { key: key, internal: entry != undefined, order: order });
                    order++;
                }
            });
            let internalTextures = Array.from(textureEntries);
            let texturePaths = [];
            //Export Textures
            if (tmpImageFolderPath) {
                for (let index = 0; index < internalTextures.length; index++) {
                    const element = internalTextures[index];
                    let inp = element.getByteArray();
                    let dst = new DDSUtil_js_1.DSTResource(inp);
                    let ddsBuffer = dst.toDDSBuffer();
                    let key = element.getKey();
                    let file = tmpImageFolderPath + path.sep + key + ".png";
                    let nb = await DDSUtil_js_1.DDSConverter.ddsBufferToPngBuffer(ddsBuffer);
                    if (nb)
                        fs.writeFileSync(file, nb);
                    if (fs.existsSync(file)) {
                        texturePaths.push({ key: key, path: file });
                    }
                }
            }
            //Cobjs
            let cobjs = [];
            let firstName = undefined;
            let firstDescription = undefined;
            value.forEach((value) => {
                let cobj = value.cobj;
                let cobjFile = new COBJFile(cobj.getByteArray(), cobj.r_type);
                let simpleData = cobjFile.getSimpleData();
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
            //Fake Swatches
            let texturesArray = Array.from(textures.values());
            let swatches = [];
            for (let index = 0; index < texturesArray.length; index++) {
                const element = texturesArray[index];
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
            let cobjObject = {
                meshes: meshes,
                name: firstName ? firstName : "UNKNOWN",
                desciption: firstDescription ? firstDescription : "-",
                texturesPaths: texturePaths,
                textures: texturesArray,
                cobjs: cobjs,
                swatches: swatches
            };
            items.push(cobjObject);
            //console.log(textureEntries);
        }
        return items;
    }
}
exports.Pack = Pack;
class ImportInfoPack {
    constructor(p) {
        this.resourcenList = [];
        this.includesCasp = false;
        this.includesCobj = false;
        this.includesClip = false;
        this.includesSmod = false;
        this.includesXml = false;
        this.includesGeom = false;
        this.includesModel = false;
        this.isMerged = false;
        this.isRecolor = false;
        this.biggestThumbnail = undefined;
        this.caspFiles = [];
        this.pack = p;
    }
    analyze() {
        if (this.pack.index_List.length == 0) {
            this.pack.calculateIndexList();
        }
        let casOnlyTattoos = false;
        let entries = this.pack.index_List;
        for (let index = 0; index < entries.length; index++) {
            const entry = entries[index];
            let type = entry.type;
            switch (type) {
                case TagType.XML:
                    this.includesXml = true;
                    break;
                case TagType.CASP:
                    this.includesCasp = true;
                    let casp = new CASPFile(entry.getByteArray());
                    casp.instanceBigInt = entry.r_instance;
                    casp.instanceID = Basic.getInstanceKey(entry);
                    this.caspFiles.push(casp);
                    let isTattoo = !casp.requriesGEOM();
                    if (isTattoo) {
                        casOnlyTattoos = true;
                    }
                    else {
                        casOnlyTattoos = false;
                    }
                    break;
                case TagType.CWAL:
                case TagType.CFLR:
                case TagType.COBJ:
                    this.includesCobj = true;
                    break;
                case TagType.CLIP:
                    this.includesClip = true;
                    break;
                case TagType.GEOM:
                    this.includesGeom = true;
                    break;
                case TagType.MODL:
                    this.includesModel = true;
                    break;
                case TagType.MLOD:
                    this.includesModel = true;
                    break;
                case TagType.S4SMM:
                    this.isMerged = true;
                    break;
                case TagType.THUM:
                case TagType.S4MMTHUM:
                    if (this.biggestThumbnail == undefined || entry.filesize > this.biggestThumbnail.filesize) {
                        this.biggestThumbnail = entry;
                    }
                    break;
                case TagType.SMOD:
                    this.includesSmod = true;
                    break;
            }
            let resource = { type: entry.r_type, group: entry.r_group, instance: entry.r_instance.toString(), instanceHex: entry.getInstanceString(), address: Basic.getStingKey(entry) };
            this.resourcenList.push(resource);
        }
        //Set Recolor
        this.isRecolor = (this.includesCasp && !this.includesGeom && !casOnlyTattoos) || (this.includesCobj && !this.includesModel);
        //Set Mereged
        //To-Do !!
    }
    async exportBiggestThumbnail(imageFolderPath, ino) {
        if (this.biggestThumbnail == undefined)
            return;
        let filename = ino.toString(16).padStart(16, "0") + ".png";
        let file = path.join(imageFolderPath, filename);
        let biggest = this.biggestThumbnail;
        if (biggest.type == TagType.S4MMTHUM) {
            fs.writeFileSync(file, biggest.getByteArray());
        }
        else {
            await PackHandler.saveBufferToFile(file, biggest.getByteArray(), false, this.pack.file);
        }
        return fs.existsSync(file) ? file : undefined;
    }
    async export_IMG(imageFolderPath, ino, thumEntry) {
        let filename = ino.toString(16).padStart(16, "0") + ".png";
        let file = path.join(imageFolderPath, filename);
        try {
            let bufferData = thumEntry.getByteArray();
            let dst = new DDSUtil_js_1.DSTResource(bufferData);
            let ddsBuffer = dst.toDDSBuffer();
            let nb = await DDSUtil_js_1.DDSConverter.ddsBufferToPngBuffer(ddsBuffer);
            if (nb) {
                fs.writeFileSync(file, nb);
            }
        }
        catch (error) {
            console.log("Failed to export _IMG: " + error);
        }
        return fs.existsSync(file) ? file : undefined;
    }
    getCombindedCaspData() {
        let items = [];
        //Only single file not singe propID !
        if (this.caspFiles.length == 0)
            return items;
        let tgiSet = new Set();
        this.caspFiles.forEach((caspFile) => {
            caspFile.TGIList.forEach((tgi) => {
                tgiSet.add(tgi);
            });
        });
        items.push({
            tgilist: Array.from(tgiSet).join(":"),
        });
        return items;
    }
}
exports.ImportInfoPack = ImportInfoPack;
class COBJPack {
    constructor(p) {
        this.pack = p;
    }
    getModelFileGroups(options) {
        //Get all relevant files
        //Instance Mapping
        let cobjFiles = new Map();
        let objdFiles = new Map();
        let mlodFiles = new Map();
        let stringValueHashes = new Map();
        //Key Mapping
        let modelFiles = new Map();
        let textureFiles = new Map();
        this.pack.index_List.forEach((value) => {
            let instance = Basic.getInstanceKey(value);
            let key = value.getKey();
            if (value.r_type == 0x319E4F1D) { //COBJ
                let cobj = new COBJFile(value.getByteArray(), value.r_type);
                if (!options || !options.instance || options.instance == value.getInstanceString())
                    cobjFiles.set(instance, cobj);
            }
            else if (value.r_type == 0xC0DB5AE7) { //OBJD
                let objd = new OBJDFile(value.getByteArray());
                if (!options || !options.instance || options.instance == value.getInstanceString())
                    objdFiles.set(instance, objd);
            }
            else if (value.r_type == 0x01661233) { //MODL
                let model = new GenericRCOLFile(value.getByteArray());
                modelFiles.set(key, model);
            }
            else if (value.r_type == 0x01D10F34) { //MLOD
                let mlod = new GenericRCOLFile(value.getByteArray());
                let items = mlodFiles.get(instance);
                if (!items)
                    items = [];
                items.push(mlod);
                mlodFiles.set(instance, items);
            }
            else if (value.r_type == 0x00B2D882) { //_IMG
                textureFiles.set(key, value);
            }
            else if (value.r_type == 0x220557DA) { //STBL
                let stblFile = new STBLFile(value.getByteArray());
                stblFile.entries.forEach((entry) => {
                    stringValueHashes.set(entry.key, entry.value);
                });
            }
        });
        //Find pairs
        let modelGroups = new Map();
        cobjFiles.forEach((cobj, key) => {
            let objd = objdFiles.get(key);
            if (!objd)
                return;
            cobj.instanceID = key;
            let pair = { cobj: cobj, objd: objd };
            let modelKeys = objd.model;
            if (!modelKeys || modelKeys.length == 0)
                return;
            let modelTGIKey = Basic.tgiToKey(modelKeys[0]);
            let model = modelFiles.get(modelTGIKey);
            if (!model)
                return;
            let mg = modelGroups.get(modelTGIKey);
            if (mg) {
                //Update
                mg.infoPairs.push(pair);
            }
            else {
                //insert
                let mlods = mlodFiles.get(modelTGIKey.split("-")[2]);
                if (!mlods)
                    mlods = [];
                mg = new ModelGroup(this.pack, model, mlods, [pair]);
                //Set Info
                let loadedName = stringValueHashes.get(cobj.nameHash);
                let loadedDescription = stringValueHashes.get(cobj.descriptionHash);
                let name = loadedName ? loadedName : "UNKNOWN";
                let description = loadedDescription ? loadedDescription : "-";
                mg.setInfo(name, description);
            }
            modelGroups.set(modelTGIKey, mg);
        });
        let items = [];
        modelGroups.forEach((value, key) => {
            value.processData();
            items.push(value.getInfoObject());
        });
        return items;
    }
}
exports.COBJPack = COBJPack;
class ModelGroup {
    constructor(pack, model, mlods, infoPairs) {
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
    setInfo(name, description) {
        this.name = name;
        this.description = description;
    }
    processData() {
        this.findMainMLod();
        this.prepareSwaches();
        this.prepareMeshes();
    }
    retryWithModelNotMLod() {
        this.useModelNotLods = true;
        this.mainMlod = this.model;
        this.prepareSwaches();
        this.prepareMeshes();
    }
    findMainMLod() {
        //Find biggest mlod
        this.mlods.forEach((value) => {
            if (!value || !value.buffer)
                return;
            let size = value.buffer.length;
            if (this.mainMlod == undefined || (this.mainMlod.buffer && size > this.mainMlod.buffer.length)) {
                this.mainMlod = value;
            }
        });
        if (this.mainMlod == undefined) {
            this.useModelNotLods = true;
            this.mainMlod = this.model;
        }
    }
    prepareSwaches() {
        this.swatches = [];
        if (!this.mainMlod)
            return;
        //Find MTST & MATDs
        let blocklist = this.mainMlod.blockList;
        if (!blocklist)
            return;
        let chunkEntries = blocklist.chunkEntries;
        if (!chunkEntries)
            return;
        let mtstFile = undefined;
        let matdIndexMap = new Map();
        for (let index = 0; index < chunkEntries.length; index++) {
            const chunkEntrie = chunkEntries[index];
            if (chunkEntrie.file && chunkEntrie.file instanceof MTSTFile) {
                if (mtstFile) {
                    console.log("Multiple MTST Files found");
                }
                else {
                    mtstFile = chunkEntrie.file;
                }
            }
            else if (chunkEntrie.file && chunkEntrie.file instanceof MATDFile) {
                let matd = chunkEntrie.file;
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
        let matdFiles = new Map();
        mtstFile.entries.forEach((value) => {
            if (value.materialState != 0)
                return;
            let index = value.index;
            let materialVariant = value.materialVariant;
            let matd = matdIndexMap.get(index);
            if (!matd)
                return;
            matdFiles.set(materialVariant, matd);
        });
        this.infoPairs.forEach((value) => {
            let cobj = value.cobj;
            let objd = value.objd;
            let colors = cobj.colors;
            if (colors.length == 0)
                colors.push(0);
            let materialNameHash = objd.materialVariantHash;
            let matd = matdFiles.get(materialNameHash);
            if (!matd)
                return;
            let diffuseTexture = matd.getDiffuseTexture();
            if (!diffuseTexture)
                return;
            let swatch = {
                textureKey: Basic.tgiToKey(diffuseTexture),
                colors: colors,
                instance: cobj.instanceID,
                materialVariant: materialNameHash
            };
            this.swatches.push(swatch);
            //console.log(materialNameHash);
        });
        //console.log(this.swatches);
    }
    prepareMeshes() {
        if (!this.mainMlod)
            return;
        let mLodFile = undefined;
        let blocklist = this.mainMlod.blockList;
        if (!blocklist)
            return;
        let chunkEntries = blocklist.chunkEntries;
        if (!chunkEntries)
            return;
        let indexOffest = 0;
        for (let index = 0; index < chunkEntries.length; index++) {
            const chunkEntrie = chunkEntries[index];
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
        let meshInfos = mLodFile.meshInfos;
        meshInfos.forEach((meshInfo) => {
            let m = meshInfo.materialIndexSplit;
            let vf = meshInfo.vertexFormatIndexSplit;
            let vb = meshInfo.vertexBufferIndexSplit;
            let ib = meshInfo.indexBufferIndexSplit;
            if (!m || !vf || !vb || !ib) {
                console.log("Missing Mesh Data [Info] (m,vf,vb,ib)");
                return;
            }
            let mChunk = chunkEntries[m.index + indexOffest];
            let vfChunk = chunkEntries[vf.index + indexOffest];
            let vbChunk = chunkEntries[vb.index + indexOffest];
            let ibChunk = chunkEntries[ib.index + indexOffest];
            if (!mChunk || !vfChunk || !vbChunk || !ibChunk) {
                console.log("Missing Mesh Data [Chunk] (m,vf,vb,ib)");
            }
            //Check if correct
            let isMaterialInfo = mChunk.file && mChunk.file instanceof MTSTFile;
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
            let isVertexFormat = vfChunk.file && vfChunk.file instanceof VRTFFile;
            if (!isVertexFormat) {
                console.log("Vertex Format Info not found");
                return;
            }
            let isVertexBuffer = vbChunk.file && vbChunk.file instanceof VBUFFile;
            if (!isVertexBuffer) {
                console.log("Vertex Buffer Info not found");
                return;
            }
            let isIndexBuffer = ibChunk.file && ibChunk.file instanceof IBUFFile;
            if (!isIndexBuffer) {
                console.log("Index Buffer Info not found");
                return;
            }
            //Create Mesh
            let mFile = mChunk.file;
            let vfFile = vfChunk.file;
            let vbFile = vbChunk.file;
            let ibFile = ibChunk.file;
            let vertex = vbFile.getVertices(vfFile);
            let faces = ibFile.getFaces();
            //Accectable Material Variants
            let mvSet = new Set();
            mFile.entries.forEach((value) => {
                if (value.materialState == 0) {
                    mvSet.add(value.materialVariant);
                }
            });
            let mvArray = Array.from(mvSet);
            //Combine Data
            let obj = {
                faces: faces,
                vertex: vertex,
                materialVariants: mvArray,
                name: meshInfo.name
            };
            this.fullMeshes.push(obj);
        });
    }
    getInfoObject() {
        let obj = {
            name: this.name,
            description: this.description,
            swatches: this.swatches,
            meshes: this.fullMeshes,
            cobjs: this.infoPairs.map((value) => { return value.cobj.getSimpleData(); }),
        };
        return obj;
    }
}
exports.ModelGroup = ModelGroup;
class SaveFile {
    constructor(file) {
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
    checkFile() {
        try {
            this.fileID = fs.openSync(this.file);
            let buf = Buffer.alloc(0x60);
            fs.readSync(this.fileID, buf, 0, 0x60);
            fs.closeSync(this.fileID);
            let bb = new ByteBuffer(buf);
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
    }
    calculateIndexList() {
        try {
            this.index_List = [];
            let buf = Buffer.alloc(this.index_Size);
            this.fileID = fs.openSync(this.file);
            fs.readSync(this.fileID, buf, 0, buf.length, this.index_Offset);
            fs.closeSync(this.fileID);
            let bb = new ByteBuffer(buf);
            let type = bb.getInt();
            if (type == 0x02)
                bb.pos = bb.pos + 4;
            for (let index = 0; index < this.index_Count; index++) {
                let r_type = 0;
                let r_group = 0;
                let i_hi = 0;
                let i_lo = 0;
                let chunckOffset = 0;
                let filesize = 0;
                let memsize = 0;
                let com = 0;
                let unknown = 0;
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
                let entry = new IndexEnty(this.file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown);
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
    }
    async exportSaveSlotThumnails(folder, slotNumber) {
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0x14) {
                let inp = element.getByteArray();
                let file = path.join(folder, "savefile_thumbnail_" + slotNumber.toString(16) + ".png");
                await PackHandler.saveBufferToFile(file, inp, true);
                return file;
            }
        }
        return "";
    }
    hasExtraImages() {
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0x0F || element.r_type == 0xe88db35f) {
                return true;
            }
        }
        return false;
    }
    async exportAllImages(folder) {
        //let t_00000010 : string[] = [];
        let t_e88db35f = [];
        let t_0000000f = [];
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0x0F || element.r_type == 0xe88db35f) {
                let inp = element.getByteArray();
                let key = Basic.getStingKey(element);
                let file = path.join(folder, key + ".png");
                let complex = element.r_type == 0xe88db35f ? false : true;
                await PackHandler.saveBufferToFile(file, inp, complex);
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
            }
        }
        return {
            t_e88db35f: t_e88db35f,
            t_0000000f: t_0000000f
        };
    }
    getSimsCC() {
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0xD) {
                let inp = element.getByteArray();
                return SimsPatterns.searchSimsCC(new ByteBuffer(inp));
            }
        }
        return undefined;
    }
    getHouseholds() {
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0xD) {
                let inp = element.getByteArray();
                return SimsPatterns.searchHouseHold(new ByteBuffer(inp));
            }
        }
        return undefined;
    }
    async getHouseHoldThumbnails(hhList, localCache, imagefolder, gameImageFolder, gamefiles) {
        if (!hhList || hhList.length == 0)
            return hhList;
        if (!fs.existsSync(imagefolder)) {
            console.log("No Image Folder for cache images");
            return hhList;
        }
        //if(!fs.existsSync(localCache))return hhList;
        //Use cache
        if (fs.existsSync(localCache)) {
            //Get Instance Set
            let hhInstancesSet = new Set();
            for (let index = 0; index < hhList.length; index++) {
                hhInstancesSet.add(hhList[index].householdInstance);
            }
            //Search in file
            let hhInstancesMap = new Map();
            let pack = new Pack(localCache);
            pack.checkFile();
            pack.calculateIndexList();
            let indexList = pack.index_List;
            for (let index = 0; index < indexList.length; index++) {
                const element = indexList[index];
                let key = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                if (element.r_type == 0x3BD45407 && hhInstancesSet.has(key)) {
                    let compObj = hhInstancesMap.get(key);
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
            let imageMap = new Map();
            let keys = Array.from(hhInstancesMap.keys());
            for (let index = 0; index < keys.length; index++) {
                const key = keys[index];
                let element = hhInstancesMap.get(key);
                let file = path.join(imagefolder, "hhi_" + key + ".png");
                await PackHandler.saveBufferToFile(file, element.getByteArray(), true);
                if (fs.existsSync(file)) {
                    imageMap.set(key, file);
                }
            }
            for (let index = 0; index < hhList.length; index++) {
                let element = hhList[index];
                let key = element.householdInstance;
                element.thumbnail = imageMap.get(key);
            }
        }
        //Use GameFiles
        if (gamefiles && fs.existsSync(gameImageFolder) && gamefiles.length > 0) {
            //Get Instance Set
            let hhInstancesSet = new Set();
            let hhInstancesMap = new Map();
            let imageMap = new Map();
            for (let index = 0; index < hhList.length; index++) {
                const element = hhList[index];
                if (!element.thumbnail && element.gameId)
                    hhInstancesSet.add(element.gameId);
            }
            //Search in Folder
            let instanceArr = Array.from(hhInstancesSet.keys());
            for (let index = 0; index < instanceArr.length; index++) {
                const key = instanceArr[index];
                const file = path.join(gameImageFolder, "hhi_" + key + ".png");
                if (fs.existsSync(file)) {
                    imageMap.set(key, file);
                    hhInstancesSet.delete(key);
                }
            }
            //Search in file
            if (hhInstancesSet.size > 0) {
                for (let gp = 0; gp < gamefiles.length; gp++) {
                    const gameFile = gamefiles[gp];
                    try {
                        let pack = new Pack(gameFile);
                        pack.checkFile();
                        pack.calculateIndexList();
                        let indexList = pack.index_List;
                        for (let index = 0; index < indexList.length; index++) {
                            const element = indexList[index];
                            let key = element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
                            if (element.r_type == 0x3BD45407 && hhInstancesSet.has(key)) {
                                let compObj = hhInstancesMap.get(key);
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
            let keys = Array.from(hhInstancesMap.keys());
            for (let index = 0; index < keys.length; index++) {
                const key = keys[index];
                let element = hhInstancesMap.get(key);
                let file = path.join(gameImageFolder, "hhi_" + key + ".png");
                await PackHandler.saveBufferToFile(file, element.getByteArray(), true);
                if (fs.existsSync(file)) {
                    imageMap.set(key, file);
                }
            }
            for (let index = 0; index < hhList.length; index++) {
                let element = hhList[index];
                let key = element.gameId;
                if (!key)
                    continue;
                let thum = imageMap.get(key);
                if (!element.thumbnail && thum)
                    element.thumbnail = thum;
                //This will not work since old version with a thumbnail will be null
            }
        }
        return hhList;
    }
    expandHouseholdsWithZoneInfo(hhList) {
        let zoneids = new Set();
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.type == TagType.ZONEOBJ && element.memsize > 160)
                zoneids.add(Basic.getInstanceKey(element));
        }
        for (let index = 0; index < hhList.length; index++) {
            const element = hhList[index];
            if (element.lot) {
                element.hasLot = zoneids.has(element.lot);
            }
            else {
                element.hasLot = false;
            }
        }
        return hhList;
    }
    getSaveName() {
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            if (element.r_type == 0xD) {
                let inp = element.getByteArray();
                return SimsPatterns.searchSaveName(new ByteBuffer(inp));
            }
        }
        console.log("No 0xD File in save?");
        return undefined;
    }
    static groupFiles(folder) {
        let data = [];
        if (!fs.existsSync(folder))
            return data;
        let files = fs.readdirSync(folder);
        let map = new Map();
        for (let index = 0; index < files.length; index++) {
            const element = files[index];
            if (element.includes(".")) {
                let baseFilename = element.split(".")[0];
                if (baseFilename.startsWith("Slot_") && baseFilename.length == 13) {
                    let file = path.join(folder, element);
                    let stats = fs.statSync(file);
                    let fileObj = {
                        filename: element,
                        path: file,
                        size: stats.size,
                        atimeMs: stats.atimeMs,
                        mtimeMs: stats.mtimeMs,
                        ctimeMs: stats.ctimeMs,
                        ino: stats.ino,
                        isMain: element.endsWith(".save")
                    };
                    let arr = [];
                    if (map.has(baseFilename)) {
                        arr = map.get(baseFilename);
                    }
                    arr.push(fileObj);
                    map.set(baseFilename, arr);
                }
            }
        }
        let keys = Array.from(map.keys());
        keys.forEach(key => {
            if (!key.includes("_"))
                return;
            let slotNumber = parseInt(key.split("_")[1], 16);
            let mainFile = undefined;
            let mainCTime = 0;
            let mainIno = -1;
            let files = map.get(key);
            for (let index = 0; index < files.length; index++) {
                const element = files[index];
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
        data.sort((a, b) => {
            return b.mainCTime - a.mainCTime;
        });
        return data;
    }
    getZoneObjByInstance(instance) {
        let item = undefined;
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            let key = Basic.getInstanceKey(element);
            if (element.type == TagType.ZONEOBJ && key == instance) {
                item = element;
                index = this.index_List.length;
            }
        }
        if (!item)
            return item;
        return new ZoneObjFile(item.getByteArray());
    }
    async exportZoneThumbnail(instance, folder) {
        let images = [];
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            //Not 0x10 0x13
            if (!(element.r_type == 0x0f || element.r_type == 0x12)) {
                continue;
            }
            let itemInstance = Basic.getInstanceKey(element);
            if (itemInstance != instance)
                continue;
            let filename = element.r_type.toString(16).padStart(8, "0") + "-" + itemInstance + ".png";
            let file = path.join(folder, filename);
            await PackHandler.saveBufferToFile(file, element.getByteArray(), true);
            if (fs.existsSync(file)) {
                images.push(file);
            }
        }
        return images;
    }
    async exportZoneThumbnailAll(folder) {
        let images = [];
        for (let index = 0; index < this.index_List.length; index++) {
            const element = this.index_List[index];
            //Not 0x10 0x13
            if (!(element.r_type == 0x0f || element.r_type == 0x12)) {
                continue;
            }
            let itemInstance = Basic.getInstanceKey(element);
            let filename = element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + itemInstance + ".png";
            let file = path.join(folder, filename);
            await PackHandler.saveBufferToFile(file, element.getByteArray(), true);
            if (fs.existsSync(file)) {
                images.push({
                    zoneID: itemInstance,
                    file: file,
                    type: element.r_type
                });
            }
        }
        return images;
    }
    getZones() {
        if (!this.save_data)
            return [];
        return SimsPatterns.serachZones(new ByteBuffer(this.save_data.getByteArray()));
    }
}
exports.SaveFile = SaveFile;
class IndexEnty {
    constructor(file, r_type, r_group, i_hi, i_lo, chunckOffset, filesize, memsize, com, unknown) {
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
    get r_instance() {
        let hi = this.i_hi;
        let lo = this.i_lo;
        let big = BigInt(hi);
        big = big << 32n;
        big = big + BigInt(lo);
        return big;
    }
    calcType() {
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
        else if (this.r_type == 0x01D10F34) {
            this.type = TagType.MLOD;
        }
        else if (this.r_type == 0x01661233) {
            this.type = TagType.MODL;
        }
        else if (this.r_type == 0xC5F6763E) {
            this.type = TagType.SMOD;
        }
        else {
            this.type = TagType.OTHER;
        }
    }
    print() {
        console.log("Type: " + this.type + " Type[value]: 0x" + this.r_type.toString(16) +
            " Group: 0x" + this.r_group.toString(16) +
            " Instance: 0x" + this.i_hi.toString(16) + this.i_lo.toString(16) +
            " Offset: 0x" + this.chunckOffset.toString(16) +
            " Filesize: 0x" + this.filesize.toString(16) +
            " Memsize: 0x" + this.memsize.toString(16) +
            " Compressed: 0x" + this.com.toString(16) +
            " Unknown: 0x" + this.unknown.toString(16));
    }
    getByteArray() {
        let fileID = 0;
        try {
            fileID = fs.openSync(this.file);
            let buf = Buffer.alloc(this.memsize);
            fs.readSync(fileID, buf, 0, buf.length, this.chunckOffset);
            fs.closeSync(fileID);
            if (this.com == 0) {
                return buf;
            }
            else {
                let bb = new ByteBuffer(buf);
                let h0 = bb.getByte();
                let h1 = bb.getByte();
                let isSimple = true;
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
    }
    getByteArrayRaw() {
        if (this.buf)
            return this.buf;
        let fileID = 0;
        try {
            fileID = fs.openSync(this.file);
            let buf = Buffer.alloc(this.filesize);
            fs.readSync(fileID, buf, 0, buf.length, this.chunckOffset);
            fs.closeSync(fileID);
            return buf;
        }
        catch (err) {
            console.log(err);
            return Buffer.alloc(0);
        }
    }
    getKey() {
        return Basic.getStingKey(this);
    }
    getInstanceString() {
        return Basic.getInstanceKey(this);
    }
    setBuffer(buf) {
        this.buf = buf;
    }
}
exports.IndexEnty = IndexEnty;
class TrayFiles {
    constructor(file) {
        this.buffer = undefined;
        this.householdname = "";
        this.instanceMap = new Map();
        this.file = file;
        CASPMapper.calcAll();
    }
    prepareBuffer() {
        let readBuffer = fs.readFileSync(this.file);
        this.buffer = new ByteBuffer(readBuffer);
    }
    searchSimsCC() {
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
    }
    static async getDetailedFileGroup(folder, localCache, tmpFolder) {
        let data = [];
        if (!folder || !fs.existsSync(folder))
            return data;
        //Get File Groups
        let fileGroups = this.groupFiles(folder);
        for (let index = 0; index < fileGroups.length; index++) {
            const element = fileGroups[index];
            let expanded = await this.expandFileGroup(element, localCache, tmpFolder);
            if (expanded)
                data.push(expanded);
        }
        return data;
    }
    static async expandFileGroup(files, localCache, tmpFolder) {
        let name = undefined;
        let creator = undefined;
        let description = undefined;
        let thumbnail = undefined;
        let mainFile = files[0];
        let type = 0;
        let hhiFile = undefined;
        let trayItem = undefined;
        let blueprintFile = undefined;
        let householdBinary = undefined;
        let room = undefined;
        for (let index = 0; index < files.length; index++) {
            const element = files[index];
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
        if (householdBinary && !blueprintFile && !room) {
            type = 1;
            //Look for Thumbnail
            thumbnail = await this.checkCacheForHHI(hhiFile, localCache, tmpFolder);
        }
        else if (!householdBinary && blueprintFile && !room) {
            type = 2;
        }
        else if (!householdBinary && !blueprintFile && room) {
            type = 3;
        }
        else {
            type = -1;
        }
        //Look for Name
        let item = this.checkTrayitemForName(trayItem, type);
        if (item) {
            name = item.name;
            creator = item.creator;
            description = item.description;
        }
        let obj = {
            files: files,
            name: name,
            creator: creator,
            description: description,
            thumbnail: thumbnail,
            mainFile: mainFile,
            type: type
        };
        return obj;
    }
    static checkTrayitemForName(filepath, type) {
        if (type == -1)
            return undefined;
        let name = undefined;
        let creator = undefined;
        let description = undefined;
        if (!filepath || !fs.existsSync(filepath))
            return undefined;
        try {
            let readBuffer = fs.readFileSync(filepath);
            let buffer = new ByteBuffer(readBuffer);
            buffer.pos = 0x26;
            if (type == 2)
                buffer.pos = 0x27;
            if (type == 3)
                buffer.pos = 0x27;
            //Read Name
            const decoder = new TextDecoder('utf-8');
            let hhnLength = buffer.readUnsignedLeb128();
            let nameBuffer = buffer.getSection(hhnLength);
            name = decoder.decode(nameBuffer);
            buffer.pos = buffer.pos + 1;
            //Description
            let descriptionLength = buffer.readUnsignedLeb128();
            if (descriptionLength > 0) {
                let descriptionBuffer = buffer.getSection(descriptionLength);
                description = decoder.decode(descriptionBuffer);
                if (type == 1)
                    buffer.pos += 1;
            }
            //Read Creator
            buffer.pos += 7;
            //buffer.pos+=7;
            //buffer.pos+=7;
            let creatorLength = buffer.readUnsignedLeb128();
            let creatorBuffer = buffer.getSection(creatorLength);
            creator = decoder.decode(creatorBuffer);
            let obj = {
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
    }
    static async checkCacheForHHI(filename, localCache, tmpFolder) {
        let image = undefined;
        if (!filename || !localCache || !fs.existsSync(localCache))
            return image;
        let keys = this.getFileKeys(filename);
        if (!keys)
            return image;
        let key = keys.t0.substring(0, 6);
        let hhiEntry = undefined;
        let hhiSize = 0;
        try {
            let pack = new Pack(localCache);
            pack.checkFile();
            pack.calculateIndexList();
            let items = pack.index_List;
            for (let index = 0; index < items.length; index++) {
                const element = items[index];
                const isHHI = element.r_type == 0x3bd45407;
                const groupMatch = element.r_group.toString(16).padStart(8, "0").startsWith(key);
                if (isHHI && groupMatch && element.memsize > hhiSize) {
                    hhiSize = element.memsize;
                    hhiEntry = element;
                }
            }
            if (hhiEntry) {
                let inp = hhiEntry.getByteArray();
                let file = path.join(tmpFolder, filename.split(".")[0] + ".png");
                await PackHandler.saveBufferToFile(file, inp, true);
                if (fs.existsSync(file))
                    return file;
            }
        }
        catch (error) {
            console.log(error);
        }
        return image;
    }
    static groupFiles(folder) {
        let data = [];
        if (!fs.existsSync(folder))
            return data;
        let files = fs.readdirSync(folder);
        //Get base tray file
        let trayFiles = [];
        let restFiles = [];
        files.forEach((filename) => {
            if (filename.endsWith(".trayitem")) {
                trayFiles.push(filename);
            }
            else {
                restFiles.push(filename);
            }
        });
        //Bundle
        trayFiles.forEach((filename) => {
            let keys = this.getFileKeys(filename);
            if (!keys)
                return;
            let files = [];
            files.push(filename);
            for (let index = 0; index < restFiles.length; index++) {
                const element = restFiles[index];
                let restKeys = this.getFileKeys(element);
                if (restKeys && restKeys.t2 == keys.t2 && restKeys.t3_num >= keys.t3_num) {
                    files.push(element);
                }
            }
            let filesWithDetails = [];
            for (let index = 0; index < files.length; index++) {
                const element = files[index];
                let filepath = path.join(folder, element);
                let stats = fs.statSync(filepath);
                let file = {
                    filename: element,
                    filepath: filepath,
                    stats: stats
                };
                filesWithDetails.push(file);
            }
            data.push(filesWithDetails);
        });
        return data;
    }
    static getFileKeys(filename) {
        if (!filename)
            return undefined;
        if (filename.charAt(10) != "!" || filename.charAt(29) != ".")
            return undefined;
        let t0 = filename.substring(2, 10);
        let t1 = filename.substring(13, 15);
        let t2 = filename.substring(15, 25);
        let t3 = filename.substring(25, 29);
        let t3_num = parseInt(t3, 16);
        return {
            t0: t0,
            t1: t1,
            t2: t2,
            t3: t3,
            t3_num: t3_num
        };
    }
}
exports.TrayFiles = TrayFiles;
class SimsPatterns {
    static serachZones(buffer) {
        let items = [];
        buffer.pos = buffer.max - 20;
        let last = buffer.max;
        while (buffer.pos > 0) {
            let pos = buffer.pos;
            let b0 = buffer.array[pos] == 0x01; //0x01
            let b1 = buffer.array[pos + 1] == 0x09; //0x09
            let b3 = buffer.array[pos + 10] == 0x12; //0x12
            if (!b1 || !b3) {
                buffer.pos = pos - 1;
                continue;
            }
            //ZoneID
            buffer.pos = pos + 2;
            let zone_id = buffer.getLongStringAlt();
            //Name
            buffer.pos = pos + 11;
            let nameLength = buffer.readUnsignedLeb128();
            let nameBuffer = buffer.getSection(nameLength);
            const decoder = new TextDecoder('utf-8');
            let name = decoder.decode(nameBuffer);
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
            let despos = buffer.pos;
            let description = undefined;
            while (despos < last && !description) {
                buffer.pos = despos;
                let startByte = buffer.getByte() == 0x72;
                if (!startByte) {
                    despos++;
                }
                else {
                    let desLength = buffer.readUnsignedLeb128();
                    let desBuffer = buffer.getSection(desLength);
                    const decoder = new TextDecoder('utf-8');
                    let descriptionTmp = decoder.decode(desBuffer);
                    let checkByte = buffer.getByte();
                    despos++;
                    if (checkByte == 0x80) {
                        description = descriptionTmp;
                    }
                }
            }
            let item = {
                zone_id: zone_id,
                name: name,
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
    }
    static searchSaveName(buffer) {
        let result = undefined;
        buffer.pos + 4;
        while (buffer.pos < buffer.max) {
            let position = buffer.pos;
            let b1 = buffer.array[position];
            if (b1 != 0x58 && b1 != 0x61) {
                buffer.pos++;
                continue;
            }
            let runPos = buffer.pos - 2;
            while (runPos > 1) {
                let isPosibleStart = buffer.array[runPos - 2] == 0x4a;
                if (!isPosibleStart) {
                    runPos--;
                }
                else {
                    let nameLength = buffer.array[runPos - 1];
                    let gap = position - runPos;
                    //console.log(nameLength + " - "+gap);
                    if (nameLength == gap) {
                        let startPos = runPos;
                        buffer.pos = startPos;
                        let nameBuffer = buffer.getSection(nameLength);
                        const decoder = new TextDecoder('utf-8');
                        let name = decoder.decode(nameBuffer);
                        return name;
                    }
                    runPos--;
                }
            }
            buffer.pos++;
        }
        return result;
    }
    static searchSimsCC(buffer) {
        //Get Sims
        buffer.pos = 0;
        let sims = SimsPatterns.simNamePattern(buffer);
        //Get Sims CC
        for (let index = 0; index < sims.length; index++) {
            const sim = sims[index];
            let startOffest = sim.firstName.length + sim.lastName.length + 12;
            let instances = SimsPatterns.casCCPattern(buffer, sim.start + startOffest, sim.end);
            sim.instances = instances;
        }
        return sims;
    }
    static searchHouseHold(buffer) {
        buffer.pos = 0;
        let sims = SimsPatterns.householdPattern(buffer);
        return sims;
    }
    static simNamePattern(buf) {
        buf.pos += 11;
        let result = [];
        while (buf.pos < buf.max) {
            let b1 = buf.array[buf.pos - 1] == 0x2a;
            let b2 = buf.array[buf.pos - 10] == 0x21;
            let pos = buf.pos;
            if (!(b1 && b2)) {
                buf.pos = pos + 1;
                continue;
            }
            //Check Names
            let startPos = pos;
            let endPos = buf.max;
            let firstName = "";
            let lastName = "";
            let fnLength = buf.getByte();
            let emptyByte = 0;
            let lnLength = -1;
            if (fnLength != 1 && fnLength > 0) {
                let nameBuffer = buf.getSection(fnLength);
                const decoder = new TextDecoder('utf-8');
                firstName = decoder.decode(nameBuffer);
                emptyByte = buf.getByte();
                lnLength = buf.getByte();
                if (lnLength != 1 && lnLength > 0) {
                    let lastNameBuffer = buf.getSection(lnLength);
                    lastName = decoder.decode(lastNameBuffer);
                }
            }
            if (firstName.length > 0 && lastName.length > 0 && emptyByte == 0x32) {
                //Get household instance
                let oldPos = buf.pos;
                buf.pos = pos - 9;
                let i_lo = buf.getInt().toString(16).padStart(8, "0");
                let i_hi = buf.getInt().toString(16).padStart(8, "0");
                let householdInstance = i_hi + i_lo;
                buf.pos = oldPos;
                let obj = {
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
    }
    static householdPattern(buf) {
        buf.pos = buf.max - 1;
        let result = [];
        let last = buf.max;
        while (buf.pos > 1) {
            let b4 = buf.array[buf.pos - 1];
            let pos = buf.pos;
            if (!(b4 == 0x1a)) {
                buf.pos = pos - 1;
                continue;
            }
            //Check Names
            let startPos = pos;
            let householdName = "";
            let money = 0;
            //Name
            let nameLength = buf.getByte();
            let emptyByte = 0;
            if (nameLength != 1 && nameLength > 0) {
                let nameBuffer = buf.getSection(nameLength);
                const decoder = new TextDecoder('utf-8');
                householdName = decoder.decode(nameBuffer);
                emptyByte = buf.getByte();
            }
            if (emptyByte != 0x21) {
                buf.pos = pos - 1;
                continue;
            }
            //Lot Instance
            let i_lo = buf.getInt().toString(16).padStart(8, "0");
            let i_hi = buf.getInt().toString(16).padStart(8, "0");
            let lot = i_hi + i_lo;
            //SecureByte
            let byteCheck = buf.getByte() == 0x28;
            if (!byteCheck) {
                buf.pos = pos - 1;
                continue;
            }
            //Money
            money = buf.readUnsignedLeb128();
            //My Household
            let myHousehold = undefined;
            let oldPos = buf.pos;
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
            let description = undefined;
            let desObj = this.hhDescription(buf, last);
            if (desObj)
                description = desObj.description;
            buf.pos = oldPos;
            //GameHHID
            oldPos = buf.pos;
            let gameHHID = this.hhGameID(buf, householdName, last);
            buf.pos = oldPos;
            if (householdName.length > 0) {
                //Get household instance
                let oldPos = buf.pos;
                buf.pos = pos - 9;
                let i_lo = buf.getInt().toString(16).padStart(8, "0");
                let i_hi = buf.getInt().toString(16).padStart(8, "0");
                let householdInstance = i_hi + i_lo;
                buf.pos = oldPos;
                let obj = {
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
    }
    static hhDescription(buf, max) {
        while (buf.pos < max) {
            let b1 = buf.array[buf.pos - 5] == 0x82;
            let b2 = buf.array[buf.pos - 4] == 0x02;
            let b3 = buf.array[buf.pos - 3] == 0x00;
            let b4 = buf.array[buf.pos - 2] == 0x92;
            let b5 = buf.array[buf.pos - 1] == 0x01;
            let pos = buf.pos;
            if (!(b1 && b2 && b3 && b4 && b5)) {
                buf.pos = pos + 1;
                continue;
            }
            //Check Names
            let startPos = pos;
            let des = "";
            let desLength = buf.readUnsignedLeb128();
            let emptyByte = 0;
            if (desLength != 1 && desLength > 0) {
                let nameBuffer = buf.getSection(desLength);
                const decoder = new TextDecoder('utf-8');
                des = decoder.decode(nameBuffer);
                emptyByte = buf.getByte();
            }
            if (emptyByte == 0x98) {
                let result = {
                    start: startPos,
                    end: buf.pos,
                    description: des
                };
                return result;
            }
            buf.pos = pos + 1;
        }
        return undefined;
    }
    static hhGameID(buf, name, max) {
        while (buf.pos < max) {
            let b1 = buf.array[buf.pos - 2] == 0xE8;
            let b2 = buf.array[buf.pos - 1] == 0x01;
            // let b3 = buf.array[buf.pos] == 0xF8;
            let pos = buf.pos;
            if (!(b1 && b2)) {
                buf.pos = pos + 1;
                continue;
            }
            let value = buf.readLeb128();
            let b3 = buf.getByte();
            if (b3 == 248) {
                return value.toString(16).padStart(16, "0");
            }
            else {
                buf.pos = pos + 1;
            }
        }
        return undefined;
    }
    static myHousehold(buf, max) {
        while (buf.pos < max) {
            let b1 = buf.array[buf.pos - 3];
            let b2 = buf.array[buf.pos - 2];
            let b3 = buf.array[buf.pos - 1];
            let b4 = buf.array[buf.pos];
            let pos = buf.pos;
            if (!(b1 == 0x70 && b3 == 0x82 && b4 == 0x01 && (b2 == 0x01 || b2 == 0x00))) {
                buf.pos = pos + 1;
                continue;
            }
            return b2;
        }
        return undefined;
    }
    static casCCPatternOld(buf, start, end) {
        let result = [];
        if (end > buf.max)
            end = buf.max;
        let lastFound = 40;
        let instanceMap = new Map();
        buf.pos = start;
        while (buf.pos < end) {
            let pos = buf.pos;
            let b1 = buf.array[pos - 6] == 0x48;
            let b2 = buf.array[pos - 5] == 0x01;
            let b3 = buf.array[pos - 4] == 0x50;
            let b4 = buf.array[pos - 3] == 0xFF;
            let b5 = buf.array[pos - 2] == 0xFF;
            let b6 = buf.array[pos - 1] == 0xFF;
            let b7 = buf.array[pos] == 0xFF;
            if (b1 && b2 && b3 && b4 && b5 && b6 && b7) {
                let items = this.searchCCInstanceBackwardsOld(buf, (pos - 6), lastFound);
                if (items) {
                    //Handle Items
                    for (let index = 0; index < items.length; index++) {
                        const element = items[index];
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
    }
    static searchCCInstanceBackwardsOld(buf, startpos, lastPos) {
        let found = false;
        let listStartPos = 0;
        let items = [];
        let typeList = [];
        let typeListSize = 0;
        let typeListStart = 0;
        buf.pos = startpos;
        while (buf.pos > lastPos + 3 && !found) {
            let b1 = buf.array[buf.pos - 2] == 0x3a;
            let b2 = buf.array[buf.pos] == 0x0a;
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
        for (let index = 0; index < typeListSize; index++) {
            typeList.push(buf.getByte());
        }
        //Instances
        buf.pos = listStartPos;
        for (let index = 0; index < typeListSize; index++) {
            let value = buf.getLongString();
            buf.pos += 8;
            let t = CASPMapper.NumberToType.get(typeList[index]);
            if (t)
                t = CASPMapper.TypeToValueArray.get(t);
            let item = {
                instance: value,
                type: t
            };
            items.push(item);
        }
        return items;
    }
    static casCCPattern(buf, start, end) {
        let result = [];
        if (end > buf.max)
            end = buf.max;
        let lastFound = 40;
        let instanceMap = new Map();
        buf.pos = start;
        while (buf.pos < end) {
            let pos = buf.pos;
            let b0 = buf.array[pos - 3];
            let b1 = buf.array[pos - 2];
            let b2 = buf.array[pos - 1];
            let b3 = buf.array[pos];
            if (b0 == 0x3a && b2 == 0x0a && ((b1 - b3) == 2)) {
                let partLength = b3;
                let items = this.searchCCInstanceBackwards(buf, start, end, partLength, pos);
                if (items) {
                    for (let index = 0; index < items.length; index++) {
                        const element = items[index];
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
    }
    static searchCCInstanceBackwards(buf, sPos, ePos, partLength, partPos) {
        let items = [];
        let typeList = [];
        //Types 
        buf.pos = partPos + 1;
        for (let index = 0; index < partLength; index++) {
            typeList.push(buf.getByte());
        }
        //Instances
        buf.pos = partPos - 3 - (partLength * 8);
        for (let index = 0; index < partLength; index++) {
            let value = buf.getLongString();
            buf.pos += 8;
            let t = CASPMapper.NumberToType.get(typeList[index]);
            if (t)
                t = CASPMapper.TypeToValueArray.get(t);
            let item = {
                instance: value,
                type: t
            };
            items.push(item);
        }
        return items;
    }
}
exports.SimsPatterns = SimsPatterns;
class ByteBuffer {
    constructor(array) {
        this.array = array;
        this.pos = 0;
        this.max = array.length;
    }
    //1 Byte
    getByte() {
        if (this.pos < this.max) {
            let byte = this.array[this.pos];
            this.pos++;
            return byte;
        }
        else {
            return -1;
        }
    }
    //2 Bytes
    getShort() {
        if (this.pos + 1 < this.max) {
            let arr = this.array.slice(this.pos, this.pos + 2);
            this.pos = this.pos + 2;
            return this.byteArrayToNumber(arr);
        }
        else {
            return -1;
        }
    }
    //4 Bytes
    getInt() {
        if (this.pos + 3 < this.max) {
            let arr = this.array.slice(this.pos, this.pos + 4);
            this.pos = this.pos + 4;
            return this.byteArrayToNumber(arr);
        }
        else {
            return -1;
        }
    }
    // 2 Bytes (Signed)
    getSignedShort() {
        if (this.pos + 1 < this.max) {
            let arr = this.array.slice(this.pos, this.pos + 2);
            this.pos = this.pos + 2;
            let view = new DataView(new ArrayBuffer(2));
            arr.forEach((byte, index) => view.setUint8(index, byte));
            return view.getInt16(0, true); // true for little-endian
        }
        else {
            return -1;
        }
    }
    // 4 Bytes (Signed)
    getSignedInt() {
        if (this.pos + 3 < this.max) {
            let arr = this.array.slice(this.pos, this.pos + 4);
            this.pos = this.pos + 4;
            let view = new DataView(new ArrayBuffer(4));
            arr.forEach((byte, index) => view.setUint8(index, byte));
            return view.getInt32(0, true); // true for little-endian
        }
        else {
            return -1;
        }
    }
    //4 Bytes
    getFloat() {
        if (this.pos + 3 < this.max) {
            let arr = this.array.slice(this.pos, this.pos + 4);
            this.pos = this.pos + 4;
            return Buffer.from(arr).readFloatLE(0);
        }
        else {
            return 0;
        }
    }
    getFloat32() {
        let buffer = this.getSection(4);
        const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        let view = new DataView(uint8Array.buffer);
        return view.getFloat32(0, false); // true for little-endian
    }
    //8 Bytes
    getLong() {
        if (this.pos + 7 < this.max) {
            let arr = this.array.slice(this.pos, this.pos + 8);
            this.pos = this.pos + 8;
            return this.byteArrayToLong(arr);
        }
        else {
            throw new Error("Buffer not big enugh!");
        }
    }
    putByte(value) {
        if (this.pos < this.max) {
            this.array[this.pos] = value & 0xFF;
            this.pos++;
        }
    }
    putBytes(values) {
        for (let index = 0; index < values.length; index++) {
            const element = values[index];
            this.putByte(element);
        }
    }
    // 2 Bytes
    putShort(value) {
        if (this.pos + 1 < this.max) {
            this.array[this.pos + 1] = (value >> 8) & 0xFF;
            this.array[this.pos + 0] = value & 0xFF;
            this.pos += 2;
        }
    }
    // 4 Bytes
    putInt(value) {
        if (this.pos + 3 < this.max) {
            this.array[this.pos + 3] = (value >> 24) & 0xFF;
            this.array[this.pos + 2] = (value >> 16) & 0xFF;
            this.array[this.pos + 1] = (value >> 8) & 0xFF;
            this.array[this.pos + 0] = value & 0xFF;
            this.pos += 4;
        }
    }
    // 8 Bytes
    putLong(value) {
        if (this.pos + 7 < this.max) {
            for (let i = 7; i >= 0; i++) {
                this.array[this.pos + i] = Number((value >> BigInt((7 - i) * 8)) & BigInt(0xFF));
            }
            this.pos += 8;
        }
    }
    getLongString() {
        if (this.pos + 7 < this.max) {
            let arr = this.array.slice(this.pos, this.pos + 8);
            return "0x" + arr.readBigUInt64LE().toString(16).padStart(16, "0").toUpperCase();
        }
        else {
            return undefined;
        }
    }
    getLongStringAlt() {
        if (this.pos + 7 < this.max) {
            let v1 = this.getInt().toString(16).padStart(8, "0");
            let v2 = this.getInt().toString(16).padStart(8, "0");
            return v2 + v1;
        }
        else {
            return undefined;
        }
    }
    skip(l) {
        this.pos = this.pos + l;
    }
    getSection(l) {
        let r = this.array.slice(this.pos, this.pos + l);
        this.pos = this.pos + l;
        return r;
    }
    //https://stackoverflow.com/questions/8482309/converting-javascript-integer-to-byte-array-and-back
    byteArrayToLong(byteArray) {
        var value = BigInt(0);
        for (var i = byteArray.length - 1; i >= 0; i--) {
            value = (value * BigInt(256)) + BigInt(byteArray[i]);
        }
        return value;
    }
    ;
    byteArrayToNumber(byteArray) {
        var value = 0;
        for (var i = byteArray.length - 1; i >= 0; i--) {
            value = (value * 256) + byteArray[i];
        }
        return value;
    }
    ;
    readUnsignedLeb128() {
        let result = 0;
        let cur = 0;
        let count = 0;
        do {
            cur = this.getByte();
            result |= (cur & 0x7f) << (count * 7);
            count++;
        } while (((cur & 0x80) == 0x80) && count < 5);
        if ((cur & 0x80) == 0x80) {
            return -1;
        }
        return result;
    }
    /*readLeb128(): BigInt {
        let data = readUleb128(this.array.subarray(this.pos));
        if (!data) return BigInt(0);
        this.pos += data.length;
        return BigInt(data.value);;
    }*/
    readLeb128() {
        let result = 0n;
        let shift = 0n;
        while (true) {
            // Ein Byte an der aktuellen Position lesen
            const byte = this.array[this.pos++];
            // Die unteren 7 Bits zum Ergebnis hinzufügen (als BigInt)
            result |= BigInt(byte & 0x7f) << shift;
            // Wenn das höchste Bit (MSB) nicht gesetzt ist, sind wir fertig
            if ((byte & 0x80) === 0) {
                break;
            }
            shift += 7n;
        }
        return result;
    }
    readTGIItemByOrdner(order) {
        return Basic.getTGIListItemByOrdner(this, order);
    }
    readString() {
        let l = this.getInt();
        return this.getSection(l).toString();
    }
    toBuffer() {
        return Buffer.from(this.array);
    }
}
exports.ByteBuffer = ByteBuffer;
class BufferOperations {
    static findAll(buffer, pattern) {
        let positions = [];
        for (let index = 0; index < buffer.length - pattern.length + 1; index++) {
            const elements = buffer.subarray(index, index + pattern.length);
            let found = this.compateArrays(Array.from(elements), pattern);
            if (found) {
                positions.push(index);
                index += pattern.length - 1;
            }
        }
        return positions;
    }
    static compateArrays(a, b) {
        if (a.length != b.length)
            return false;
        for (let index = 0; index < a.length; index++) {
            const element = a[index];
            if (element != b[index])
                return false;
        }
        return true;
    }
    static hexStringToByteArray(hex) {
        if (hex.length % 2 != 0)
            hex = "0" + hex;
        let result = [];
        for (let index = 0; index < hex.length; index += 2) {
            const element = hex.substring(index, index + 2);
            result.push(parseInt(element, 16));
        }
        return result.reverse();
    }
}
exports.BufferOperations = BufferOperations;
class BinaryWritter {
    constructor() {
        this.arr = new Uint8Array(65536 * 4);
        this.pos = 0;
    }
    seek(np) {
        this.pos = np;
        if (this.pos > this.arr.length)
            this.doubleSize(this.pos - this.arr.length);
    }
    numToUint8Array(num) {
        const arr = new Uint8Array(8);
        for (let i = 0; i < 8; i++)
            arr.set([num / 0x100 ** i], 7 - i);
        return arr;
    }
    writeByte(value) {
        this.doubleSize(1);
        this.arr[this.pos] = value;
        this.pos++;
    }
    writeShort(value) {
        this.doubleSize(2);
        let st = value.toString(16).padStart(4, "0");
        this.arr[this.pos] = Number("0x" + st.substring(2, 4));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(0, 2));
        this.pos++;
    }
    writeInt(value) {
        this.doubleSize(4);
        let st = value.toString(16).padStart(8, "0");
        this.arr[this.pos] = Number("0x" + st.substring(6, 8));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(4, 6));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(2, 4));
        this.pos++;
        this.arr[this.pos] = Number("0x" + st.substring(0, 2));
        this.pos++;
    }
    writeLong(value) {
        this.doubleSize(8);
        let st = value.toString(16).padStart(16, "0");
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
    }
    writeBigInt(value) {
        this.doubleSize(8);
        let st = value.toString(16).padStart(16, "0");
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
    }
    writeBigIntCap(value) {
        this.doubleSize(8);
        let st = value.toString(16).padStart(16, "0");
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
    }
    writeBytes(values) {
        for (let index = 0; index < values.length; index++) {
            const element = values[index];
            this.writeByte(element);
        }
    }
    writeEmptyBytes(count) {
        for (let index = 0; index < count; index++) {
            this.writeByte(0);
        }
    }
    writeFloat(value) {
        this.doubleSize(4);
        const buffer = Buffer.alloc(4);
        buffer.writeFloatLE(value, 0);
        this.writeBytes(buffer);
    }
    doubleSize(addValue) {
        if ((this.pos + addValue - 1) < this.arr.length)
            return;
        let newArr = new Uint8Array(this.arr.length + 65536);
        for (let index = 0; index < this.arr.length; index++) {
            const element = this.arr[index];
            newArr[index] = element;
        }
        this.arr = newArr;
    }
    toBuffer() {
        return Buffer.from(this.arr.subarray(0, this.pos));
    }
    writeTGIListItem(tgiListItem, writeType) {
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
    }
    writeString(value) {
        let length = value.length;
        this.writeInt(length);
        this.writeBytes(Buffer.from(value, "utf-8"));
    }
    writeTGIItemByOrdner(tgi, order = 4) {
        if (!tgi)
            return;
        let readType = "TGI";
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
        let parts = readType.split("");
        this.writeByte(order);
        for (let index = 0; index < parts.length; index++) {
            const element = parts[index];
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
    }
    writeTGIItemByOrdnerType(tgi, order, writeType) {
        if (!tgi)
            return;
        let readType = "TGI";
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
        let parts = readType.split("");
        if (writeType)
            this.writeByte(order);
        for (let index = 0; index < parts.length; index++) {
            const element = parts[index];
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
    }
}
exports.BinaryWritter = BinaryWritter;
class PackHandler {
    //Saves let buffer to file (use complex, when export from EA)
    static async saveBufferToFile(file, buffer, isComplex, originalFile) {
        let inp = buffer;
        let arr;
        if (Array.isArray(inp)) {
            arr = Buffer.from(inp);
        }
        else {
            arr = inp;
        }
        if (arr.length != 0 && arr.length > 40) {
            if (!isComplex && false) {
                fs.writeFileSync(file, arr);
            }
            else {
                let png = arr.slice(32, arr.length);
                try {
                    let alpha = await sharp(png).extractChannel('red').options.input.buffer;
                    await sharp(arr, { failOnError: false }).ensureAlpha().joinChannel(alpha).toFile(file);
                    //console.log(alpha);
                }
                catch (error) {
                    try {
                        await sharp(arr, { failOnError: false }).toFile(file);
                    }
                    catch (e2) {
                        console.error("Error saving file: " + file + " Original File: " + (originalFile ? originalFile : "N/A"));
                    }
                    //console.error(error);
                }
                //sharp(arr).ensureAlpha().joinChannel(alpha).toFile(file);
                /*
                sharp(png)
                    .extractChannel('red')
                    .toBuffer()
                    .then((alpha: any) => sharp(arr)
                        .ensureAlpha()
                        .joinChannel(alpha)
                        .toFile(file)
                    );
                */
            }
        }
    }
    static async saveCASCOBJImageBufferToFile(file, buffer, isComplex) {
        let inp = buffer;
        let arr;
        if (Array.isArray(inp)) {
            arr = Buffer.from(inp);
        }
        else {
            arr = inp;
        }
        if (arr.length != 0 && arr.length > 40) {
            let png = arr.slice(32, arr.length);
            try {
                let alpha = await sharp(png).extractChannel('red').toBuffer();
                let im = await sharp(arr, { failOnError: false }).ensureAlpha().joinChannel(alpha).png().toBuffer();
                await sharp(im).flatten({ background: '#e3ebf3' }).toFile(file);
            }
            catch (error) {
                console.error(error);
            }
        }
    }
    static isBufferJpg(buf) {
        return false;
    }
    static isBufferPng(buf) {
        return false;
    }
}
exports.PackHandler = PackHandler;
class Basic {
    static cleanName(name) {
        return NAMEUTIL.clearName(name);
        ;
    }
    static getStingKey(element) {
        return element.r_type.toString(16).padStart(8, "0") + "-" + element.r_group.toString(16).padStart(8, "0") + "-" + element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
    }
    static getInstanceKey(element) {
        return element.i_hi.toString(16).padStart(8, "0") + element.i_lo.toString(16).padStart(8, "0");
    }
    static combineHiLoToBigInt(hi, lo) {
        const hiBigInt = BigInt(hi);
        const loBigInt = BigInt(lo);
        return (hiBigInt << BigInt(32)) | loBigInt;
    }
    static getTGIListItem(bb, readType) {
        let type = 0;
        let group = 0;
        let instance = BigInt(0);
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
    }
    static getTGIListItemByOrdner(bb, order) {
        let readType = "TGI";
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
        let type = 0;
        let group = 0;
        let instance = BigInt(0);
        let parts = readType.split("");
        for (let index = 0; index < parts.length; index++) {
            const element = parts[index];
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
    }
    static indicesToFaces(indices, count = 3) {
        let faces = [];
        for (let index = 0; index < indices.length; index += count) {
            let face = [];
            for (let i = 0; i < count; i++) {
                face.push(indices[index + i]);
            }
            faces.push(face);
        }
        return faces;
    }
    static tgiToKey(tgi) {
        return tgi.type.toString(16).padStart(8, "0") + "-" + tgi.group.toString(16).padStart(8, "0") + "-" + tgi.instance.toString(16).padStart(16, "0");
    }
    static swapFirstAndLast4Bytes(bigIntValue) {
        // Mask to get the first 4 bytes (32 bits)
        const first4BytesMask = BigInt("0xFFFFFFFF00000000");
        // Mask to get the last 4 bytes (32 bits)
        const last4BytesMask = BigInt("0x00000000FFFFFFFF");
        // Extract the first 4 bytes and shift them to the position of the last 4 bytes
        const first4Bytes = (bigIntValue & first4BytesMask) >> BigInt(32);
        // Extract the last 4 bytes and shift them to the position of the first 4 bytes
        const last4Bytes = (bigIntValue & last4BytesMask) << BigInt(32);
        // Combine the swapped bytes
        return first4Bytes | last4Bytes;
    }
}
exports.Basic = Basic;
class CompressUtil {
    static intFromBytes(byteArray) {
        var value = 0;
        for (var i = byteArray.length - 1; i >= 0; i--) {
            value = (value * 256) + byteArray[i];
        }
        return value;
    }
    static decompressOld(compressed, compressionType) {
        let r = new ByteBuffer(compressed);
        let type = compressionType != 0x80;
        let sizeArray = [0, 0, 0, 0];
        r.pos = 2;
        for (let i = type ? 2 : 3; i >= 0; i--) {
            sizeArray[i] = r.getByte();
        }
        let dataSize = this.intFromBytes(sizeArray);
        let data = new Array(dataSize);
        let refObj = { position: 0, };
        while (refObj.position < dataSize) {
            let byte0 = r.getByte();
            if (byte0 <= 0x7F) {
                let byte1 = r.getByte();
                let numPlainText = byte0 & 0x03;
                let numToCopy = ((byte0 & 0x1C) >> 2) + 3;
                let copyOffest = ((byte0 & 0x60) << 3) + byte1 + 1;
                this.copyPlainText(r, data, numPlainText, refObj);
                this.copyCompressedText(r, data, numToCopy, refObj, copyOffest);
            }
            else if (byte0 <= 0XBF && byte0 > 0x7F) {
                let byte1 = r.getByte();
                let byte2 = r.getByte();
                let numPlainText = ((byte1 & 0xC0) >> 6) & 0x03;
                let numToCopy = (byte0 & 0x3F) + 4;
                let copyOffest = ((byte1 & 0x3F) << 8) + byte2 + 1;
                this.copyPlainText(r, data, numPlainText, refObj);
                this.copyCompressedText(r, data, numToCopy, refObj, copyOffest);
            }
            else if (byte0 <= 0xDF && byte0 > 0xBF) {
                let byte1 = r.getByte();
                let byte2 = r.getByte();
                let byte3 = r.getByte();
                let numPlainText = byte0 & 0x03;
                let numToCopy = ((byte0 & 0x0C) << 6) + byte3 + 5;
                let copyOffest = ((byte0 & 0x10) << 12) + (byte1 << 8) + byte2 + 1;
                this.copyPlainText(r, data, numPlainText, refObj);
                this.copyCompressedText(r, data, numToCopy, refObj, copyOffest);
            }
            else if (byte0 <= 0xFB && byte0 > 0xDF) {
                let numPlainText = ((byte0 & 0x1F) << 2) + 4;
                this.copyPlainText(r, data, numPlainText, refObj);
            }
            else if (byte0 <= 0xFF && byte0 > 0xFB) {
                let numPlainText = (byte0 & 0x03);
                this.copyPlainText(r, data, numPlainText, refObj);
            }
        }
        return Buffer.from(data);
    }
    static copyPlainText(r, data, numPlainText, positionObj) {
        // Copy data one at a time
        for (let i = 0; i < numPlainText; positionObj.position++, i++) {
            data[positionObj.position] = r.getByte();
        }
    }
    static copyCompressedText(r, data, numToCopy, positionObj, copyOffest) {
        let currentPosition = positionObj.position;
        // Copy data one at a time
        for (let i = 0; i < numToCopy; i++, positionObj.position++) {
            data[positionObj.position] = data[currentPosition - copyOffest + i];
        }
    }
}
exports.CompressUtil = CompressUtil;
class REL2File {
    constructor(buffer) {
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
    calculateData() {
        let byteBuffer = new ByteBuffer(this.buffer);
        //Basic Infos
        this.fourcc = byteBuffer.getInt();
        this.version = byteBuffer.getInt();
        this.width = byteBuffer.getShort();
        this.hight = byteBuffer.getShort();
        this.mipCount = byteBuffer.getShort();
        this.unknown0E = byteBuffer.getShort();
        //MipHeads
        for (let index = 0; index < this.mipCount; index++) {
            let header = {
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
    }
    toDDS(color) {
        let bw = new BinaryWritter();
        //DDS Magic Word
        bw.writeByte(0x44);
        bw.writeByte(0x44);
        bw.writeByte(0x53);
        bw.writeByte(0x20);
        //Basic Info
        let size = (18 * 4) + (8 * 4) + (5 * 4);
        bw.writeInt(size); //Size
        bw.writeInt(0x000A1007); //Texture
        bw.writeInt(this.hight); //Hight
        bw.writeInt(this.width); //Width
        bw.writeInt(2097152); //PitchOrLinearSize ? 
        bw.writeInt(1); //Depth ?
        bw.writeInt(this.mipCount); //MipCount
        for (let index = 0; index < 11; index++) {
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
        for (let index = 0; index < 3; index++) {
            bw.writeInt(0);
        } //Reversed2 ?
        //Write Pixels
        let fullTransparentAlpha = [0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        let fullOpaqueAlpha = [0x00, 0x05, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
        let colorTest = [0xeb, 0x5a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        let byteBuffer = new ByteBuffer(this.buffer);
        //return bw.toBuffer();
        for (let index = 0; index < this.mipCount; index++) {
            let mipHeader = this.mipHeaders[index];
            let nextMipHeader = this.mipHeaders[index + 1];
            let blockOffset2 = mipHeader.Offset2;
            let blockOffset3 = mipHeader.Offset3;
            let blockOffset0 = mipHeader.Offset0;
            let blockOffset1 = mipHeader.Offset1;
            for (let commandOffset = mipHeader.CommandOffset; commandOffset < nextMipHeader.CommandOffset; commandOffset += 2) {
                byteBuffer.pos = commandOffset;
                let command = byteBuffer.getShort();
                //console.log("command:"+command);
                var op = command & 3;
                var count = command >> 2;
                if (op == 0) {
                    for (let j = 0; j < count; j++) {
                        if (color == undefined) {
                            fullTransparentAlpha.forEach((b) => { bw.writeByte(b); });
                            fullTransparentAlpha.forEach((b) => { bw.writeByte(b); });
                        }
                        else {
                            fullOpaqueAlpha.forEach((b) => { bw.writeByte(b); });
                            colorTest.forEach((b) => { bw.writeByte(b); });
                        }
                    }
                }
                else if (op == 1) {
                    for (let j = 0; j < count; j++) {
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
                    for (let j = 0; j < count; j++) {
                        fullOpaqueAlpha.forEach((b) => { bw.writeByte(b); });
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
    }
    async toPNG(imagePath, defSize) {
        //await this.toPNGOLD(imagePath,defSize);
        await (new Rel2Helper_1.ImageProcessor(this.width, this.hight, this.buffer, this.mipHeaders)).toPNG(imagePath, defSize);
    }
    async toPNGOLD(imagePath, defSize) {
        var image = PNGImage.createImage(this.width, this.hight);
        let xOffset = 0;
        let yOffset = 0;
        //Read Data
        let byteBuffer = new ByteBuffer(this.buffer);
        for (let index = 0; index < 1; index++) {
            let mipHeader = this.mipHeaders[index];
            let nextMipHeader = this.mipHeaders[index + 1];
            let blockOffset2 = mipHeader.Offset2;
            let blockOffset3 = mipHeader.Offset3;
            let blockOffset0 = mipHeader.Offset0;
            let blockOffset1 = mipHeader.Offset1;
            for (let commandOffset = mipHeader.CommandOffset; commandOffset < nextMipHeader.CommandOffset; commandOffset += 2) {
                byteBuffer.pos = commandOffset;
                let command = byteBuffer.getShort();
                var op = command & 3;
                var count = command >> 2;
                if (op == 0) {
                    for (let j = 0; j < count; j++) {
                        //SetPixels
                        let currentPos = 0;
                        for (let y = 0; y < 4; y++) {
                            for (let x = 0; x < 4; x++) {
                                let absolutX = xOffset + (3 - x);
                                let absolutY = yOffset + (3 - y);
                                let color = {
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
                    for (let j = 0; j < count; j++) {
                        //Alpha
                        byteBuffer.pos = blockOffset0;
                        let a0 = byteBuffer.getByte();
                        let a1 = byteBuffer.getByte();
                        byteBuffer.pos = blockOffset1;
                        let aM0 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM1 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM2 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM3 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM4 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM5 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aMap = aM5 + aM4 + aM3 + aM2 + aM1 + aM0;
                        //let aMap = aM0 + aM1 + aM2 + aM3 + aM4 + aM5;
                        let alphaArr = this.alphaArray(a0, a1);
                        //Color
                        byteBuffer.pos = blockOffset2;
                        let c0 = byteBuffer.getShort();
                        let c1 = byteBuffer.getShort();
                        byteBuffer.pos = blockOffset3;
                        let cM0 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let cM1 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let cM2 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let cM3 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        //let cMap = cM0 + cM1 + cM2 + cM3;
                        let cMap = cM3 + cM2 + cM1 + cM0;
                        //let cMap = byteBuffer.getInt().toString(2).padStart(32,"0");
                        let colorArr = this.colorArray(c0, c1);
                        //SetPixels
                        let currentPos = 0;
                        for (let y = 0; y < 4; y++) {
                            for (let x = 0; x < 4; x++) {
                                let colorStr = cMap.substring((2 * currentPos), (2 * currentPos) + 2);
                                let alphaStr = aMap.substring((3 * currentPos), (3 * currentPos) + 3);
                                let colorPos = parseInt(colorStr, 2);
                                let alphaPos = parseInt(alphaStr, 2);
                                let alpha = alphaArr[alphaPos];
                                let color = colorArr[colorPos];
                                let absolutX = xOffset + (3 - x);
                                let absolutY = yOffset + (3 - y);
                                let pixel = { red: color.r, green: color.g, blue: color.b, alpha: alpha };
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
                    for (let j = 0; j < count; j++) {
                        //Alpha
                        let a0 = 0;
                        let a1 = 5;
                        let aMap2 = 0xffff.toString(2).padStart(16, "0");
                        let aMap4 = 0xffffffff.toString(2).padStart(32, "0");
                        let aMap = aMap4 + aMap2;
                        let alphaArr = this.alphaArray(a0, a1);
                        //Color
                        byteBuffer.pos = blockOffset2;
                        let c0 = byteBuffer.getShort();
                        let c1 = byteBuffer.getShort();
                        byteBuffer.pos = blockOffset3;
                        let cMap = byteBuffer.getInt().toString(2).padStart(32, "0");
                        let colorArr = this.colorArray(c0, c1);
                        //SetPixels
                        let currentPos = 0;
                        for (let y = 0; y < 4; y++) {
                            for (let x = 0; x < 4; x++) {
                                let colorPos = parseInt(cMap.substring((2 * currentPos), (2 * currentPos) + 2), 2);
                                let alphaPos = parseInt(aMap.substring((3 * currentPos), (3 * currentPos) + 3), 2);
                                let alpha = alphaArr[alphaPos];
                                let color = colorArr[colorPos];
                                let absolutX = xOffset + (3 - x);
                                let absolutY = yOffset + (3 - y);
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
        let created = fs.existsSync(imagePath);
        if (created) {
            //Resize?
            if (defSize == true && (this.width != 1024 || this.hight != 2048)) {
                let mainImage = await Jimp.read(imagePath);
                await mainImage.resize(1024, 2048);
                await mainImage.writeAsync(imagePath);
                if (fs.existsSync(imagePath)) {
                    return imagePath;
                }
                else {
                    return undefined;
                }
            }
            else {
                return imagePath;
            }
        }
        else {
            return undefined;
        }
    }
    async toPNGTesting(imagePath, defSize) {
        let iWidth = this.width;
        let iHight = this.hight;
        let mipMapStart = 0;
        if (iHight == 4096 && iWidth == 2048) {
            iHight = iHight / 2;
            iWidth = iWidth / 2;
            mipMapStart = 1;
        }
        var image = PNGImage.createImage(iWidth, iHight);
        let xOffset = 0;
        let yOffset = 0;
        let byteBuffer = new ByteBuffer(this.buffer);
        for (let index = mipMapStart; index < (mipMapStart + 1); index++) {
            let mipHeader = this.mipHeaders[index];
            let nextMipHeader = this.mipHeaders[index + 1];
            let blockOffset2 = mipHeader.Offset2;
            let blockOffset3 = mipHeader.Offset3;
            let blockOffset0 = mipHeader.Offset0;
            let blockOffset1 = mipHeader.Offset1;
            for (let commandOffset = mipHeader.CommandOffset; commandOffset < nextMipHeader.CommandOffset; commandOffset += 2) {
                byteBuffer.pos = commandOffset;
                let command = byteBuffer.getShort();
                var op = command & 3;
                var count = command >> 2;
                if (op == 0) {
                    for (let j = 0; j < count; j++) {
                        //SetPixels
                        let currentPos = 0;
                        for (let y = 0; y < 4; y++) {
                            for (let x = 0; x < 4; x++) {
                                let absolutX = xOffset + (3 - x);
                                let absolutY = yOffset + (3 - y);
                                let color = {
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
                    for (let j = 0; j < count; j++) {
                        //Alpha
                        byteBuffer.pos = blockOffset0;
                        let a0 = byteBuffer.getByte();
                        let a1 = byteBuffer.getByte();
                        byteBuffer.pos = blockOffset1;
                        let aM0 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM1 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM2 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM3 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM4 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aM5 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let aMap = aM5 + aM4 + aM3 + aM2 + aM1 + aM0;
                        //let aMap = aM0 + aM1 + aM2 + aM3 + aM4 + aM5;
                        let alphaArr = this.alphaArray(a0, a1);
                        //Color
                        byteBuffer.pos = blockOffset2;
                        let c0 = byteBuffer.getShort();
                        let c1 = byteBuffer.getShort();
                        byteBuffer.pos = blockOffset3;
                        let cM0 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let cM1 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let cM2 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        let cM3 = byteBuffer.getByte().toString(2).padStart(8, "0");
                        //let cMap = cM0 + cM1 + cM2 + cM3;
                        let cMap = cM3 + cM2 + cM1 + cM0;
                        //let cMap = byteBuffer.getInt().toString(2).padStart(32,"0");
                        let colorArr = this.colorArray(c0, c1);
                        //SetPixels
                        let currentPos = 0;
                        for (let y = 0; y < 4; y++) {
                            for (let x = 0; x < 4; x++) {
                                let colorStr = cMap.substring((2 * currentPos), (2 * currentPos) + 2);
                                let alphaStr = aMap.substring((3 * currentPos), (3 * currentPos) + 3);
                                let colorPos = parseInt(colorStr, 2);
                                let alphaPos = parseInt(alphaStr, 2);
                                let alpha = alphaArr[alphaPos];
                                let color = colorArr[colorPos];
                                let absolutX = xOffset + (3 - x);
                                let absolutY = yOffset + (3 - y);
                                let pixel = { red: color.r, green: color.g, blue: color.b, alpha: alpha };
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
                    for (let j = 0; j < count; j++) {
                        //Alpha
                        let a0 = 0;
                        let a1 = 5;
                        let aMap2 = 0xffff.toString(2).padStart(16, "0");
                        let aMap4 = 0xffffffff.toString(2).padStart(32, "0");
                        let aMap = aMap4 + aMap2;
                        let alphaArr = this.alphaArray(a0, a1);
                        //Color
                        byteBuffer.pos = blockOffset2;
                        let c0 = byteBuffer.getShort();
                        let c1 = byteBuffer.getShort();
                        byteBuffer.pos = blockOffset3;
                        let cMap = byteBuffer.getInt().toString(2).padStart(32, "0");
                        let colorArr = this.colorArray(c0, c1);
                        //SetPixels
                        let currentPos = 0;
                        for (let y = 0; y < 4; y++) {
                            for (let x = 0; x < 4; x++) {
                                let colorPos = parseInt(cMap.substring((2 * currentPos), (2 * currentPos) + 2), 2);
                                let alphaPos = parseInt(aMap.substring((3 * currentPos), (3 * currentPos) + 3), 2);
                                let alpha = alphaArr[alphaPos];
                                let color = colorArr[colorPos];
                                let absolutX = xOffset + (3 - x);
                                let absolutY = yOffset + (3 - y);
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
        let created = fs.existsSync(imagePath);
        if (created) {
            //Resize?
            if (defSize == true && (iWidth != 1024 || iHight != 2048)) {
                let mainImage = await Jimp.read(imagePath);
                await mainImage.resize(1024, 2048);
                await mainImage.writeAsync(imagePath);
                if (fs.existsSync(imagePath)) {
                    return imagePath;
                }
                else {
                    return undefined;
                }
            }
            else {
                return imagePath;
            }
        }
        else {
            return undefined;
        }
    }
    csWrite(bw, byteBuffer, offset, size) {
        for (let index = 0; index < size; index++) {
            byteBuffer.pos = offset + index;
            bw.writeByte(byteBuffer.getByte());
        }
    }
    addHexColorBase(color, colorBase, alphaPure) {
        let r = parseInt(colorBase.substring(0, 2), 16);
        let g = parseInt(colorBase.substring(2, 4), 16);
        let b = parseInt(colorBase.substring(4, 6), 16);
        let rgb = {
            r: r,
            g: g,
            b: b
        };
        let alpha = alphaPure / 255;
        if (alpha == 0) {
            return rgb;
        } //Is Only Base
        //Mix colors
        let ratio = 1; // alpha
        rgb.r = Math.round((color.r * alpha / ratio) + (r * 1 * (1 - alpha) / ratio)); // red
        rgb.g = Math.round((color.g * alpha / ratio) + (g * 1 * (1 - alpha) / ratio)); // green
        rgb.b = Math.round((color.b * alpha / ratio) + (b * 1 * (1 - alpha) / ratio)); // blue
        return rgb;
    }
    colorArray(c0, c1) {
        let arr = [];
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
    }
    mixColors(c0, c1, cv1, cv2) {
        let color0 = this.colorToRGB(c0);
        let color1 = this.colorToRGB(c1);
        let r = Math.floor((cv1 * color0.r) + (cv2 * color1.r));
        let g = Math.floor((cv1 * color0.g) + (cv2 * color1.g));
        let b = Math.floor((cv1 * color0.b) + (cv2 * color1.b));
        let colorObj = {
            r: r,
            g: g,
            b: b
        };
        return colorObj;
    }
    colorToRGB(color) {
        const scale = (fromRange, toRange, value) => {
            const d = (toRange[1] - toRange[0]) / (fromRange[1] - fromRange[0]);
            return Math.floor((value - fromRange[0]) * d + toRange[0]);
        };
        let colorBin = color.toString(2).padStart(16, "0");
        let r_32 = parseInt(colorBin.substring(0, 5), 2);
        let g_64 = parseInt(colorBin.substring(5, 11), 2);
        let b_32 = parseInt(colorBin.substring(11, 16), 2);
        let colorObj = {
            r: scale([0, 31], [0, 255], r_32),
            g: scale([0, 63], [0, 255], g_64),
            b: scale([0, 31], [0, 255], b_32)
        };
        return colorObj;
    }
    alphaArray(a0, a1) {
        let arr = [];
        let a2, a3, a4, a5, a6, a7;
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
    }
}
exports.REL2File = REL2File;
class LRLEFile {
    constructor(buffer) {
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
    calculateData() {
        let byteBuffer = new ByteBuffer(this.buffer);
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
        for (let index = 0; index < this.numMipMaps; index++) {
            this.mipMapOffsets.push(byteBuffer.getInt());
        }
        if (this.version == 0x32303056) {
            let numPixels = byteBuffer.getInt();
            this.pixelArray = [];
            for (let index = 0; index < numPixels; index++) {
                let b1 = byteBuffer.getByte();
                let b2 = byteBuffer.getByte();
                let b3 = byteBuffer.getByte();
                let b4 = byteBuffer.getByte();
                this.pixelArray.push([b1, b2, b3, b4]);
            }
        }
        this.mips = [];
        this.mipPositons = [];
        for (let index = 0; index < this.numMipMaps; index++) {
            const pos = byteBuffer.pos;
            this.mipPositons.push(pos);
            let toRead = 0;
            if (index < this.numMipMaps - 1) {
                toRead = this.mipMapOffsets[index + 1] - this.mipMapOffsets[index];
            }
            else {
                toRead = byteBuffer.array.length - pos;
            }
            this.mips.push(byteBuffer.getSection(toRead));
        }
    }
    async exportImage(filepath, defsize) {
        if (this.version == 0) {
            await this.exportImageV1(filepath, defsize);
        }
        else if (this.version == 0x32303056) {
            await this.exportImageV2(filepath, defsize);
        }
        else {
            throw new Error("Unknown LRLE Version!");
        }
    }
    async exportImageV1(filepath, defsize) {
        let mipLevel = 0;
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
        //Base Values
        let mip = this.mips[mipLevel];
        //Setup
        let tot = 0;
        let pointer = 0;
        let pixelPointer = 0;
        let w = this.width;
        let h = this.height;
        for (let index = 0; index < mipLevel; index++) {
            w = w / 2;
            h = h / 2;
        }
        let pixels = new Array(w * h * 4);
        let currentInstruction = 0;
        let previousInstruction = 0;
        let count = 0;
        while (pointer < mip.length) {
            let instruct = mip[pointer] & 3;
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
                    let obj2 = this.getPixelRunLength(mip, pointer);
                    count = obj2.count;
                    pointer = obj2.pointer;
                    tot += count;
                    pointer++;
                    for (let i = 0; i < count; i++) {
                        this.copyArray(mip, pointer, pixels, pixelPointer, 4);
                        pixelPointer += 4;
                    }
                    pointer += 4;
                    break;
                case 0: //run of zero's
                    previousInstruction = currentInstruction;
                    currentInstruction = pointer;
                    let obj0 = this.getPixelRunLength(mip, pointer);
                    count = obj0.count;
                    pointer = obj0.pointer;
                    tot += count;
                    pointer++;
                    for (let i = 0; i < count * 4; i++) {
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
                    let calc = this.readEmbeddedRLE(mip, count, pointer);
                    var newPixels = calc.result;
                    pointer = calc.pointer;
                    //console.log(newPixels);
                    for (let i = 0; i < count; i++) {
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
        let blockPixels = new Array(pixels.length);
        let x = 0, y = 0;
        let w1 = w * 4;
        for (let i = 0; i < pixels.length; i += 64) {
            for (let j = 0; j < 4; j++) {
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
        //Create Image
        var image = PNGImage.createImage(w, h);
        let xp = 0;
        let yp = 0;
        for (let index = 0; index < blockPixels.length; index += 4) {
            let r = blockPixels[index + 2];
            let g = blockPixels[index + 1];
            let b = blockPixels[index + 0];
            let a = blockPixels[index + 3];
            image.setAt(xp, yp, { red: r, green: g, blue: b, alpha: a });
            xp++;
            if (xp == w) {
                xp = 0;
                yp++;
            }
        }
        image.writeImageSync(filepath);
    }
    async exportImageV2(filepath, defsize) {
        //Base Values
        let mipLevel = 0;
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
        let mip = this.mips[mipLevel];
        //Setup
        let tot = 0;
        let pointer = 0;
        let pixelPointer = 0;
        let w = this.width;
        let h = this.height;
        for (let index = 0; index < mipLevel; index++) {
            w = w / 2;
            h = h / 2;
        }
        let pixels = new Array(w * h * 4);
        let currentInstruction = 0;
        let previousInstruction = 0;
        let count = 0;
        try {
            while (pointer < mip.length) {
                if ((mip[pointer] & 0x01) > 0 && (mip[pointer] & 0x02) > 0) // bits 1 & 2 set - copy following pixel values
                 {
                    previousInstruction = pointer;
                    let obj = this.getPixelRunLength(mip, pointer);
                    let count = obj.count;
                    pointer = obj.pointer;
                    tot += count;
                    pointer++;
                    for (let i = 0; i < count; i++) {
                        this.copyArray(mip, pointer, pixels, pixelPointer, 4);
                        pixelPointer += 4;
                        pointer += 4;
                    }
                }
                else if ((mip[pointer] & 0x01) == 0 && (mip[pointer] & 0x02) > 0 && (mip[pointer] & 0x04) > 0) //bits 2 & 4 set - repeat following pixel
                 {
                    previousInstruction = pointer;
                    let obj = this.getRepeatRunLength(mip, pointer);
                    let count = obj.count;
                    pointer = obj.pointer;
                    tot += count;
                    pointer++;
                    for (let i = 0; i < count; i++) {
                        this.copyArray(mip, pointer, pixels, pixelPointer, 4);
                        pixelPointer += 4;
                    }
                    pointer += 4;
                }
                else if ((mip[pointer] & 0x01) > 0 && (mip[pointer] & 0x02) == 0) //copy pixels for following indexes
                 {
                    previousInstruction = pointer;
                    let obj = this.getPixelRunLength(mip, pointer);
                    let count = obj.count;
                    pointer = obj.pointer;
                    tot += count;
                    pointer++;
                    for (let i = 0; i < count; i++) {
                        // let index = (mip[pointer] >= 0x80) ? IndexReader(mip, ref pointer) : mip[pointer];
                        let obj = this.getColorIndex(mip, pointer);
                        let index = obj.count;
                        pointer = obj.pointer;
                        this.copyArray(this.pixelArray[index], 0, pixels, pixelPointer, 4);
                        pixelPointer += 4;
                        pointer++;
                    }
                }
                else if ((mip[pointer] & 0x02) > 0 && (mip[pointer] & 0x01) == 0 && (mip[pointer] & 0x04) == 0) //repeat count, one let index
                 {
                    previousInstruction = pointer;
                    let obj = this.getRepeatRunLength(mip, pointer);
                    let count = obj.count;
                    pointer = obj.pointer;
                    // let count = (mip[pointer] >= 0x80) ? RunReader(mip, ref pointer) : mip[pointer] / 8;
                    tot += count;
                    pointer++;
                    let index = mip[pointer];
                    for (let i = 0; i < count; i++) {
                        this.copyArray(this.pixelArray[index], 0, pixels, pixelPointer, 4);
                        pixelPointer += 4;
                    }
                    pointer++;
                }
                else if ((mip[pointer] & 0x04) > 0 && (mip[pointer] & 0x01) == 0 && (mip[pointer] & 0x02) == 0) //repeat count, two let index
                 {
                    previousInstruction = pointer;
                    let obj = this.getRepeatRunLength(mip, pointer);
                    let count = obj.count;
                    pointer = obj.pointer;
                    // let count = (mip[pointer] >= 0x80) ? RunReader(mip, ref pointer) : mip[pointer] / 8;
                    tot += count;
                    pointer++;
                    let b1 = mip[pointer] & 0xFF;
                    let b2 = (mip[pointer + 1] & 0xFF) << 8;
                    let index = b1 | b2;
                    for (let i = 0; i < count; i++) {
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
        let blockPixels = new Array(pixels.length);
        let x = 0, y = 0;
        let w1 = w * 4;
        for (let i = 0; i < pixels.length; i += 64) {
            for (let j = 0; j < 4; j++) {
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
        //Create Image
        var image = PNGImage.createImage(w, h);
        let xp = 0;
        let yp = 0;
        for (let index = 0; index < blockPixels.length; index += 4) {
            let r = blockPixels[index + 2];
            let g = blockPixels[index + 1];
            let b = blockPixels[index + 0];
            let a = blockPixels[index + 3];
            image.setAt(xp, yp, { red: r, green: g, blue: b, alpha: a });
            xp++;
            if (xp == w) {
                xp = 0;
                yp++;
            }
        }
        image.writeImageSync(filepath);
    }
    getPixelRunLength(mip0, pointer) {
        let count = ((mip0[pointer] & 0x7f) >> 2);
        let shift = 5;
        while ((mip0[pointer] & 0x80) != 0) {
            pointer++;
            count += (((mip0[pointer] & 0x7f)) << shift);
            shift += 7;
        }
        return { count: count, pointer: pointer };
    }
    getRepeatRunLength(mip0, pointer) {
        let count = ((mip0[pointer] & 0x7F) >> 3);
        let shift = 4;
        while ((mip0[pointer] & 0x80) != 0) {
            pointer++;
            count += (((mip0[pointer] & 0x7f)) << shift);
            shift += 7;
        }
        return { count: count, pointer: pointer };
    }
    getColorIndex(mip0, pointer) {
        let count = ((mip0[pointer] & 0x7f));
        let shift = 7;
        while ((mip0[pointer] & 0x80) != 0) {
            pointer++;
            count += (((mip0[pointer] & 0x7f)) << shift);
            shift += 7;
        }
        return { count: count, pointer: pointer };
    }
    readEmbeddedRLE(data, pixelCount, pointer) {
        let result = new Array(pixelCount * 4);
        let resultPtr = 0;
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
                for (let i = 0; i < count; i++) {
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
                for (let i = 0; i < count; i++) {
                    result[resultPtr] = 0;
                    resultPtr++;
                }
                pointer++;
            }
        }
        return { result: result, pointer: pointer };
    }
    copyArray(arr0, pos0, arr1, pos1, count) {
        for (let index = 0; index < count; index++) {
            let index0 = pos0 + index;
            let index1 = pos1 + index;
            arr1[index1] = arr0[index0];
        }
    }
}
exports.LRLEFile = LRLEFile;
class CASPFile {
    constructor(buffer) {
        this.instanceID = "";
        this.instanceBigInt = BigInt(0);
        this.error = false;
        //Values
        this.version = 0;
        this.tgiOffset = 0;
        this.presetCount = 0;
        this.name = "";
        this.propId = 0;
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
    calculateData() {
        let byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getInt();
        this.tgiOffset = byteBuffer.getInt();
        this.tgiOffset += 8;
        this.presetCount = byteBuffer.getInt();
        this.handleName(byteBuffer);
        if (this.error)
            return;
        this.primSortIndex = byteBuffer.getFloat();
        this.secSortIndex = byteBuffer.getShort();
        this.propId = byteBuffer.getInt();
        byteBuffer.skip(4);
        if (this.version >= 0x32)
            byteBuffer.skip(27 + 1);
        if (this.version >= 0x29 && this.version < 0x32)
            byteBuffer.skip(1 + 1 + 8 + 8 + 8);
        if (this.version == 0x28)
            byteBuffer.skip(1 + 1 + 8 + 8);
        if (this.version == 0x25)
            byteBuffer.skip(1 + 8 + 8);
        if (this.version <= 0x20)
            byteBuffer.skip(13);
        if (this.version >= 0x33)
            byteBuffer.skip(12);
        let length_flag = byteBuffer.getInt() & 0x000000ff;
        for (let i = 0; i < length_flag; i++) {
            let pair = { "a": byteBuffer.getShort(), "b": byteBuffer.getShort() };
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
        let posBefore = byteBuffer.pos;
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
        let swatchColorListLength = byteBuffer.getByte();
        for (let index = 0; index < swatchColorListLength; index++) {
            let color = byteBuffer.getInt();
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
        let lodLength = byteBuffer.getByte();
        let lodList = [];
        for (let index = 0; index < lodLength; index++) {
            let lodLevel = byteBuffer.getByte();
            let unused = byteBuffer.getInt();
            let lodAssetListLength = byteBuffer.getByte();
            for (let assetIndex = 0; assetIndex < lodAssetListLength; assetIndex++) {
                let sorting = byteBuffer.getInt();
                let specLevel = byteBuffer.getInt();
                let castShadow = byteBuffer.getInt();
            }
            let byteIndexListLength = byteBuffer.getByte();
            let geomList = [];
            for (let byteIndex = 0; byteIndex < byteIndexListLength; byteIndex++) {
                let byteIndexValue = byteBuffer.getByte();
                geomList.push(byteIndexValue);
            }
            let arr = [];
            let obj = {
                "level": lodLevel,
                "indexList": geomList,
                "list": arr
            };
            lodList.push(obj);
        }
        //Slot key?
        let slotLength = byteBuffer.getByte();
        for (let index = 0; index < slotLength; index++) {
            let value = byteBuffer.getByte();
        }
        //DiffuseKey
        this.diffuseIndex = byteBuffer.getByte();
        this.shadowIndex = byteBuffer.getByte();
        this.compositionMode = byteBuffer.getByte();
        this.regionMapIndex = byteBuffer.getByte();
        //TGI
        byteBuffer.pos = this.tgiOffset;
        let size = byteBuffer.getByte();
        for (let i = 0; i < size; i++) {
            let d = byteBuffer.getSection(8);
            let l3 = d.readBigUInt64LE();
            let l2 = byteBuffer.getInt();
            let l1 = byteBuffer.getInt();
            let st = l1.toString(16).padStart(8, "0") + "-" + l2.toString(16).padStart(8, "0") + "-" + l3.toString(16).padStart(16, "0");
            this.TGIList.push(st);
        }
        try {
            for (let index = 0; index < lodList.length; index++) {
                const element = lodList[index];
                let ids = [];
                for (let i = 0; i < element.indexList.length; i++) {
                    const value = element.indexList[i];
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
    }
    handleName(byteBuffer) {
        let word_length = this.readUnsignedLeb128(byteBuffer);
        //console.log("Length: "+word_length);
        if (word_length == -1) {
            this.error = true;
            return;
        }
        let nameBuffer = byteBuffer.getSection(word_length);
        this.name = String.fromCharCode(...Array.from(nameBuffer));
    }
    readUnsignedLeb128(bb) {
        let result = 0;
        let cur = 0;
        let count = 0;
        do {
            cur = bb.getByte();
            result |= (cur & 0x7f) << (count * 7);
            count++;
        } while (((cur & 0x80) == 0x80) && count < 5);
        if ((cur & 0x80) == 0x80) {
            return -1;
        }
        return result;
    }
    getRelevantAddresses() {
        let lodSet = new Set();
        this.lodLevels.forEach((level) => {
            level.list.forEach((address) => {
                lodSet.add(address);
            });
        });
        return {
            lod: Array.from(lodSet),
            diffuse: (this.diffuseIndex != -1) ? this.TGIList[this.diffuseIndex] : undefined
        };
    }
    getLodAndDiffuse() {
        return {
            instance: this.instanceID,
            lod: this.lodLevels,
            diffuse: (this.diffuseIndex != -1) ? this.TGIList[this.diffuseIndex] : undefined
        };
    }
    getDatabaseValues() {
        //AgeGender
        let ageArray = [];
        let genderArray = [];
        let bodyTypeArray = [];
        let ag_bin = this.ageGender.toString(2).padStart(16, "0");
        //Age
        if (ag_bin.charAt(15) == "1")
            ageArray.push("[BABY]");
        if (ag_bin.charAt(14) == "1")
            ageArray.push("[TODDLER]");
        if (ag_bin.charAt(13) == "1")
            ageArray.push("[CHILD]");
        if (ag_bin.charAt(12) == "1")
            ageArray.push("[TEEN]");
        if (ag_bin.charAt(11) == "1")
            ageArray.push("[YOUNGADULT]");
        if (ag_bin.charAt(10) == "1")
            ageArray.push("[ADULT]");
        if (ag_bin.charAt(9) == "1")
            ageArray.push("[ELDER]");
        if (ag_bin.charAt(8) == "1")
            ageArray.push("[INFANT]");
        //Gender
        if (ag_bin.charAt(2) == "1")
            genderArray.push("[FEMALE]");
        if (ag_bin.charAt(3) == "1")
            genderArray.push("[MALE]");
        //BodyType
        let bodyTypes = [];
        CASPMapper.readValues(this.bodyType, this.flagList, bodyTypes);
        //let bodyTag = CASPMapper.NumberToType.get(this.bodyType);
        //if(bodyTag!=undefined)this.bodyTypePlain.add(bodyTag);
        for (let index = 0; index < bodyTypes.length; index++) {
            const element = bodyTypes[index];
            let str = CASPMapper.getArrayFormTag(element);
            if (str.length != 0) {
                bodyTypeArray.push(str);
            }
        }
        return {
            propId: this.propId,
            instance: this.instanceBigInt.toString(16).padStart(16, "0"),
            swatch: this.swatches.join(":"),
            age: ageArray.join(":"),
            gender: genderArray.join(":"),
            body: bodyTypeArray.join(":"),
            packId: 0,
            species: this.species,
            primSort: this.primSortIndex,
            sortLayer: this.sortLayer,
            casFlags: this.flagList.map((flag) => "0x" + flag.a.toString(16).padStart(4, "0") + "-0x" + flag.b.toString(16).padStart(4, "0")).join(":")
        };
    }
    getSwatchValues() {
        let databaseVaules = this.getDatabaseValues();
        return {
            propId: databaseVaules.propId,
            instance: databaseVaules.instance,
            swatch: databaseVaules.swatch,
            age: databaseVaules.age,
            gender: databaseVaules.gender,
            body: databaseVaules.body,
            species: databaseVaules.species,
            primSort: databaseVaules.primSort,
            sortLayer: databaseVaules.sortLayer,
            lodLevels: this.lodLevels,
            diffuseAddress: (this.diffuseIndex != -1) ? this.TGIList[this.diffuseIndex] : undefined,
            shadowAddress: (this.shadowIndex != -1) ? this.TGIList[this.shadowIndex] : undefined,
            compositionMode: this.compositionMode,
        };
    }
    requriesGEOM() {
        return this.lodLevels.length > 0;
    }
    static combine(parts) {
        //Combinded
        let age = new Set();
        let gender = new Set();
        let bodyType = new Set();
        let flags = new Set();
        let displayIndex = new Set();
        let sDisplayIndex = new Set();
        let files = [];
        let pFiles = new Map();
        parts.forEach((part) => {
            let propId = part.propId;
            let file = pFiles.get(propId);
            if (!file) {
                file = {
                    propId: propId,
                    swatches: [],
                    age: new Set(),
                    gender: new Set(),
                    bodyType: new Set(),
                    flags: new Set(),
                    displayIndex: new Set(),
                    sDisplayIndex: new Set()
                };
            }
            part.age.split(":").forEach((value) => {
                if (value.trim().length == 0)
                    return;
                file.age.add(value);
                age.add(value);
            });
            part.gender.split(":").forEach((value) => {
                if (value.trim().length == 0)
                    return;
                file.gender.add(value);
                gender.add(value);
            });
            part.body.split(":").forEach((value) => {
                if (value.trim().length == 0)
                    return;
                file.bodyType.add(value);
                bodyType.add(value);
            });
            part.casFlags.split(":").forEach((value) => {
                if (value.trim().length == 0)
                    return;
                file.flags.add(value);
                flags.add(value);
            });
            file.displayIndex.add(part.primSort);
            displayIndex.add(part.primSort);
            file.sDisplayIndex.add(part.sortLayer);
            sDisplayIndex.add(part.sortLayer);
            //Swatches
            file.swatches.push({
                instance: part.instance,
                colors: part.swatch.split(":").map((color) => { return Number(color); })
            });
            pFiles.set(propId, file);
        });
        let data = {
            combined: {
                age: Array.from(age).join(":"),
                gender: Array.from(gender).join(":"),
                bodyType: Array.from(bodyType).join(":"),
                flags: Array.from(flags).join(":"),
                displayIndex: displayIndex.size > 0 ? Array.from(displayIndex)[0] : 0,
                sDisplayIndex: sDisplayIndex.size > 0 ? Array.from(sDisplayIndex)[0] : 0
            },
            files: Array.from(pFiles.values()).map((file) => {
                return {
                    propId: file.propId,
                    swatches: file.swatches,
                    age: Array.from(file.age).join(":"),
                    gender: Array.from(file.gender).join(":"),
                    bodyType: Array.from(file.bodyType).join(":"),
                    flags: Array.from(file.flags).join(":"),
                    displayIndex: file.displayIndex.size > 0 ? Array.from(file.displayIndex)[0] : 0,
                    sDisplayIndex: file.sDisplayIndex.size > 0 ? Array.from(file.sDisplayIndex)[0] : 0
                };
            })
        };
        return data;
    }
}
exports.CASPFile = CASPFile;
class CASPResource {
    constructor() {
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
    addFile(file) {
        this.caspFiles.push(file);
        let id = file.propId.toString(16).padStart(8, "0");
        if (this.propIds.has(id)) {
            return;
        }
        this.propIds.add(id);
        this.isMerged = this.propIds.size > 1;
        //Fill TGI
        for (let index = 0; index < file.TGIList.length; index++) {
            const element = file.TGIList[index];
            if (!this.tgi_list.has(element))
                this.tgi_list.add(element);
        }
        //Instances
        this.instances.add(file.instanceID);
        //AgeGender
        let ag_bin = file.ageGender.toString(2).padStart(16, "0");
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
        let bodyTypes = [];
        CASPMapper.readValues(file.bodyType, file.flagList, bodyTypes);
        let bodyTag = CASPMapper.NumberToType.get(file.bodyType);
        if (bodyTag != undefined)
            this.bodyTypePlain.add(bodyTag);
        //console.log(bodyTypes);
        for (let index = 0; index < bodyTypes.length; index++) {
            const element = bodyTypes[index];
            let str = CASPMapper.getArrayFormTag(element);
            if (str.length != 0) {
                this.bodyType.add(str);
                //console.log(str);
            }
        }
        //Cas flags
        let list = file.flagList;
        for (let index = 0; index < list.length; index++) {
            const element = list[index];
            let tag = element.a;
            let value = element.b;
            let st = "0x" + tag.toString(16).padStart(4, "0") + "-0x" + value.toString(16).padStart(4, "0");
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
    }
    checkRecolor() {
        if (this.bodyType.size == 0)
            return false;
        let onlyGood = true;
        this.bodyTypePlain.forEach((element) => {
            if (CASPMapper.PartsWithoutGeom.has(element)) {
                onlyGood = false;
            }
        });
        return onlyGood;
    }
}
exports.CASPResource = CASPResource;
class OBJDFile {
    constructor(buffer) {
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
    calculateData() {
        if (!this.buffer)
            throw new Error("No Buffer");
        let byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getShort();
        let tablePositon = byteBuffer.getInt();
        this.propertyIDList = [];
        this.simpleList = [];
        byteBuffer.pos = tablePositon;
        let entryCount = byteBuffer.getShort();
        for (let index = 0; index < entryCount; index++) {
            let type = byteBuffer.getInt();
            this.propertyIDList.push(type);
            let offset = byteBuffer.getInt();
            let nextPos = byteBuffer.pos;
            byteBuffer.pos = offset;
            let tgiType = undefined;
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
                    let compCount = byteBuffer.getInt();
                    for (let j = 0; j < compCount; j++) {
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
                    let count = byteBuffer.getInt();
                    for (let i = 0; i < count; i++) {
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
                    let c4 = byteBuffer.getInt();
                    for (let i = 0; i < c4; i++) {
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
    }
    readTGIBlock(bb, order = 4) {
        let count = bb.getInt() / 4;
        let tgiList = [];
        for (let i = 0; i < count; i++) {
            let instance = BigInt(0);
            let type = 0;
            let group = 0;
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
    }
    writeTGIBlock(bw, tgiList, order = 4) {
        let count = tgiList.length * 4;
        bw.writeInt(count);
        for (let i = 0; i < tgiList.length; i++) {
            let { instance, type, group } = tgiList[i];
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
    }
    calulateNewBuffer() {
        let bw = new BinaryWritter();
        bw.writeShort(this.version);
        // Placeholder for table position
        let tablePositionOffset = bw.pos;
        bw.writeInt(0);
        let entryOffsets = [];
        for (let type of this.propertyIDList) {
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
                    for (let item of this.simpleList) {
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
                    for (let score of this.environmentScores) {
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
                    for (let item of this.unknown4) {
                        bw.writeByte(item);
                    }
                    break;
            }
        }
        // Update table position
        let tablePosition = bw.pos;
        bw.seek(tablePositionOffset);
        bw.writeInt(tablePosition);
        bw.seek(tablePosition);
        // Write entry count
        bw.writeShort(this.propertyIDList.length);
        for (let data of entryOffsets) {
            bw.writeInt(data.type);
            bw.writeInt(data.offset); // Placeholder for offset
        }
        return bw.toBuffer();
    }
}
exports.OBJDFile = OBJDFile;
class COBJFile {
    constructor(buffer, type) {
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
    calculateData() {
        let byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getInt();
        this.commonBlockVersion = byteBuffer.getInt();
        this.nameHash = byteBuffer.getInt();
        this.descriptionHash = byteBuffer.getInt();
        this.price = byteBuffer.getInt();
        let thumbnailHash = byteBuffer.pos += 8;
        this.devCategoryFlags = byteBuffer.getInt();
        //CountedTGIBlockList
        let size_TGIBlockList = byteBuffer.getByte();
        for (let i = 0; i < size_TGIBlockList; i++) {
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
        let size_CatalogTagList = byteBuffer.getInt();
        for (let i = 0; i < size_CatalogTagList; i++) {
            let value = byteBuffer.getShort();
            if (this.commonBlockVersion != 0x09)
                byteBuffer.pos = byteBuffer.pos + 2;
            this.catalogTagList.add(value);
        }
        //SellingPoints
        this.sellingpoints = [];
        let count = byteBuffer.getInt();
        for (let i = 0; i < count; i++) {
            let commodity = byteBuffer.getShort();
            let amount = byteBuffer.getInt();
            this.sellingpoints.push({ commodity: commodity, amount: amount });
        }
        //Other
        this.unlockByHash = byteBuffer.getInt();
        this.unlockedByHash = byteBuffer.getInt();
        this.swatchColorsSortPriority = byteBuffer.getShort();
        this.varientThumbImageHash = byteBuffer.getLong();
        switch (this.version) {
            case 0x6: {
                return;
            }
            default: {
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
            }
        }
        //More
        this.colors = [];
        let colorCount = byteBuffer.getByte();
        for (let i = 0; i < colorCount; i++) {
            this.colors.push(byteBuffer.getInt());
        }
        return;
        this.fenceHeight = byteBuffer.getInt();
        this.isStackable = byteBuffer.getByte();
        this.canItemDepreciate = byteBuffer.getByte();
        if (this.version > 0x19 && false) {
            this.fallbackObjectKey = byteBuffer.readTGIItemByOrdner(4);
        }
    }
    getSimpleData() {
        return {
            price: this.price,
            catalogTagList: Array.from(this.catalogTagList),
            colors: this.colors,
            nameHash: this.nameHash,
            descriptionHash: this.descriptionHash
        };
    }
    toBuffer() {
        let byteBuffer = new BinaryWritter();
        byteBuffer.writeInt(this.version);
        byteBuffer.writeInt(this.commonBlockVersion);
        byteBuffer.writeInt(this.nameHash);
        byteBuffer.writeInt(this.descriptionHash);
        byteBuffer.writeInt(this.price);
        byteBuffer.writeLong(0);
        byteBuffer.writeInt(this.devCategoryFlags);
        // CountedTGIBlockList
        byteBuffer.writeByte(this.tgiBlockList.length);
        for (let i = 0; i < this.tgiBlockList.length; i++) {
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
            for (let i = 0; i < 9; i++) {
                byteBuffer.writeByte(0);
            }
        }
        // CatalogTagList
        byteBuffer.writeInt(this.catalogTagList.size);
        for (let value of Array.from(this.catalogTagList)) {
            byteBuffer.writeShort(value);
            if (this.commonBlockVersion != 0x09)
                byteBuffer.writeShort(0);
        }
        // SellingPoints
        byteBuffer.writeInt(this.sellingpoints.length);
        for (let i = 0; i < this.sellingpoints.length; i++) {
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
        for (let i = 0; i < this.colors.length; i++) {
            byteBuffer.writeInt(this.colors[i]);
        }
        byteBuffer.writeInt(this.fenceHeight);
        byteBuffer.writeByte(this.isStackable);
        byteBuffer.writeByte(this.canItemDepreciate);
        if (this.version >= 0x19) {
            byteBuffer.writeTGIItemByOrdnerType(this.fallbackObjectKey, 4, false);
        }
        //16 empty bytes
        for (let i = 0; i < 16; i++) {
            byteBuffer.writeByte(0);
        }
        return byteBuffer.toBuffer();
    }
}
exports.COBJFile = COBJFile;
class COBJResource {
    constructor() {
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
    addFile(file) {
        this.cobjFiles.push(file);
        //Preis
        this.prices.add(file.price);
        if (file.price < this.pMin)
            this.pMin = file.price;
        if (file.price > this.pMax)
            this.pMax = file.price;
        //catalogTagList
        let arr = Array.from(file.catalogTagList);
        for (let index = 0; index < arr.length; index++) {
            const value = arr[index];
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
    }
}
exports.COBJResource = COBJResource;
class CLIPResource {
    constructor() {
        this.propIds = new Set(); // length != 1 -> merged
    }
}
exports.CLIPResource = CLIPResource;
class RMAPFile {
    constructor(buffer) {
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
    calculateData() {
        if (!this.buffer)
            throw new Error("No Buffer");
        let byteBuffer = new ByteBuffer(this.buffer);
        this.conextVersion = byteBuffer.getInt();
        this.publicKeyCount = byteBuffer.getInt();
        this.externalKeyCount = byteBuffer.getInt();
        this.delayLoadKeyCount = byteBuffer.getInt();
        this.objectCount = byteBuffer.getInt();
        for (let i = 0; i < this.publicKeyCount; i++) {
            let tgi = Basic.getTGIListItem(byteBuffer, "ITG");
            if (tgi)
                this.publicKeys.push(tgi);
        }
        for (let i = 0; i < this.externalKeyCount; i++) {
            let tgi = Basic.getTGIListItem(byteBuffer, "ITG");
            if (tgi)
                this.externalKeys.push(tgi);
        }
        for (let i = 0; i < this.delayLoadKeyCount; i++) {
            let tgi = Basic.getTGIListItem(byteBuffer, "ITG");
            if (tgi)
                this.delayLoadKeys.push(tgi);
        }
        this.objectPosition = byteBuffer.getInt();
        this.objectLength = byteBuffer.getInt();
        this.objectVersion = byteBuffer.getInt();
        //GEOMReferenceBlockList
        let size_GEOMReferenceBlockList = byteBuffer.getInt();
        for (let i = 0; i < size_GEOMReferenceBlockList; i++) {
            let item = {
                isReplacement: false,
                layer: 0,
                region: 0,
                tgiList: []
            };
            item.region = byteBuffer.getInt();
            item.layer = byteBuffer.getFloat();
            item.isReplacement = byteBuffer.getByte() == 1;
            let count = byteBuffer.getInt();
            for (let i = 0; i < count; i++) {
                let tgi = Basic.getTGIListItem(byteBuffer, "ITG");
                if (tgi)
                    item.tgiList.push(tgi);
            }
            this.geomReferenceBlockList.push(item);
        }
    }
    calulateNewBuffer() {
        let bw = new BinaryWritter();
        bw.writeInt(this.conextVersion);
        bw.writeInt(this.publicKeys.length);
        bw.writeInt(this.externalKeys.length);
        bw.writeInt(this.delayLoadKeys.length);
        bw.writeInt(this.objectCount);
        for (let i = 0; i < this.publicKeys.length; i++) {
            const element = this.publicKeys[i];
            bw.writeTGIListItem(element, "ITG");
        }
        for (let i = 0; i < this.externalKeys.length; i++) {
            const element = this.externalKeys[i];
            bw.writeTGIListItem(element, "ITG");
        }
        for (let i = 0; i < this.delayLoadKeys.length; i++) {
            const element = this.delayLoadKeys[i];
            bw.writeTGIListItem(element, "ITG");
        }
        bw.writeInt(bw.pos + 8); //Object Position
        let objectLength = 4;
        for (let i = 0; i < this.geomReferenceBlockList.length; i++) {
            const element = this.geomReferenceBlockList[i];
            objectLength += 13 + (element.tgiList.length * 16);
        }
        bw.writeInt(objectLength + 4); //Object Length
        bw.writeInt(this.objectVersion);
        bw.writeInt(this.geomReferenceBlockList.length);
        for (let i = 0; i < this.geomReferenceBlockList.length; i++) {
            const element = this.geomReferenceBlockList[i];
            bw.writeInt(element.region);
            bw.writeFloat(element.layer);
            bw.writeByte(element.isReplacement ? 1 : 0);
            bw.writeInt(element.tgiList.length);
            for (let j = 0; j < element.tgiList.length; j++) {
                const tgi = element.tgiList[j];
                bw.writeTGIListItem(tgi, "ITG");
            }
        }
        return bw.toBuffer();
    }
    get dataObject() {
        let expandedGeomReferenceBlockList = [];
        this.geomReferenceBlockList.forEach((element) => {
            let newTGIList = [];
            let obj = {
                region: element.region,
                layer: element.layer,
                isReplacement: element.isReplacement,
                tgiList: newTGIList
            };
            element.tgiList.forEach((tgi) => {
                let newTgi = {
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
    }
}
exports.RMAPFile = RMAPFile;
class GEOMFile {
    constructor(buffer, onlyValues) {
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
    calculateData() {
        let byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getInt();
        //console.log("Version: "+this.version.toString(16));
        //PubicChunks +4 (int)
        //Unused +4 (int)
        //PubicChunks +4 (int)
        //Counted TGI Block List +4 (int) ? Liste immer leer?
        byteBuffer.skip(4 + 4 + 4);
        //ChunkEntryList 
        let chunkEntryListLength = byteBuffer.getInt();
        //console.log("CHLength: "+chunkEntryListLength)
        //console.log("0x"+chunkEntryListLength.toSt ring(16));
        for (let index = 0; index < chunkEntryListLength; index++) {
            let che_intance = byteBuffer.getLong();
            let che_type = byteBuffer.getInt();
            let che_group = byteBuffer.getInt();
            //? 2 unknown ints
            byteBuffer.skip(4 + 4);
            let che_typeTag = byteBuffer.getInt();
            let che_version = byteBuffer.getInt();
            //? 2 unknown ints
            byteBuffer.skip(4 + 4);
            let che_shader = byteBuffer.getInt();
            //? 5 unknown ints
            byteBuffer.skip(16);
            //console.log("InnerVersion: "+che_version.toString(16));
            //MTNF
            let che_shaderDataListLength = byteBuffer.getInt();
            for (let che_s_index = 0; che_s_index < che_shaderDataListLength; che_s_index++) {
                let value = byteBuffer.getInt();
                byteBuffer.skip(12); //Data
                //console.log("0x"+value.toString(16))
            }
            //console.log("POS (End SDATA): "+byteBuffer.pos.toString(16))
            let mergeGroup = byteBuffer.getInt();
            let sortOrder = byteBuffer.getInt();
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
            let max = 16 * 24;
            let found = false;
            let pre1 = 1;
            let pre2 = 1;
            for (let index = max; index >= 0; index--) {
                let value = byteBuffer.getInt();
                let next = byteBuffer.getInt();
                byteBuffer.pos = byteBuffer.pos - 4;
                if (value > 0 && value < 12 && next > 0 && next < 12 && pre1 == 0 && pre2 != 0) {
                    index = -1;
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
            let vertexDataLength = byteBuffer.getInt();
            this.vertexCount = vertexDataLength;
            //console.log("VERTEX Length: "+vertexDataLength.toString(16));
            let vertexFormatList = [];
            let vertexFormatListLenght = byteBuffer.getInt();
            let vertexPartLength = 0;
            //console.log("VertexFormatList: 0x"+vertexFormatListLenght.toString(16));
            for (let vfi = 0; vfi < vertexFormatListLenght; vfi++) {
                let value = byteBuffer.getInt();
                let extra_1 = byteBuffer.getInt();
                let extra_2 = byteBuffer.getByte();
                let obj = {
                    value: value,
                    e1: extra_1,
                    e2: extra_2
                };
                vertexFormatList.push(obj);
                vertexPartLength += this.getVertexFormatLength(value);
            }
            let vertexList = [];
            if (!this.onlyValues) {
                for (let vIndex = 0; vIndex < vertexDataLength; vIndex++) {
                    let vertex = {};
                    for (let vfi = 0; vfi < vertexFormatList.length; vfi++) {
                        const vertexFormatType = vertexFormatList[vfi].value;
                        this.addVertex(vertexFormatType, byteBuffer, vertex);
                    }
                    if (!this.onlyValues)
                        vertexList.push(vertex);
                }
            }
            else {
                let skip = vertexPartLength * vertexDataLength;
                byteBuffer.skip(skip);
            }
            let facesList = [];
            byteBuffer.skip(5);
            let faceDataLengthTotal = byteBuffer.getInt();
            let facesDataLength = faceDataLengthTotal / 3;
            this.facesCount = facesDataLength;
            if (!this.onlyValues) {
                for (let fIndex = 0; fIndex < facesDataLength; fIndex++) {
                    let v1 = byteBuffer.getShort();
                    let v2 = byteBuffer.getShort();
                    let v3 = byteBuffer.getShort();
                    let face = [v1, v2, v3];
                    facesList.push(face);
                }
                let chunk = {
                    vertex: vertexList,
                    faces: facesList
                };
                this.chunks.push(chunk);
            }
        }
    }
    addVertex(type, byteBuffer, obj) {
        if (type == 0x1) {
            //Position
            let pos_x = byteBuffer.getFloat();
            let pos_y = byteBuffer.getFloat();
            let pos_z = byteBuffer.getFloat();
            let arr = [];
            arr.push(pos_x);
            arr.push(pos_y);
            arr.push(pos_z);
            obj.p = arr;
        }
        else if (type == 0x2) {
            //Normals
            let normal_x = byteBuffer.getFloat();
            let normal_y = byteBuffer.getFloat();
            let normal_z = byteBuffer.getFloat();
            let arr = [];
            arr.push(normal_x);
            arr.push(normal_y);
            arr.push(normal_z);
            obj.n = arr;
        }
        else if (type == 0x3) {
            //UV 
            let uv1 = byteBuffer.getFloat();
            ;
            let uv2 = byteBuffer.getFloat();
            if (obj.u) {
                obj.u.push(uv1);
                obj.u.push(uv2);
            }
            else {
                let arr = [];
                arr.push(uv1);
                arr.push(uv2);
                obj.u = arr;
            }
        }
        else if (type == 0x7) {
            //Color
            let color = byteBuffer.getInt();
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
    }
    getVertexFormatLength(type) {
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
    }
    toString() {
        return "GEOM v" + this.version;
    }
}
exports.GEOMFile = GEOMFile;
class ZoneObjFile {
    constructor(buffer) {
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
    calculateData() {
        let byteBuffer = new ByteBuffer(this.buffer);
        let z1 = byteBuffer.getInt().toString(16).padStart(8, "0");
        let z2 = byteBuffer.getInt().toString(16).padStart(8, "0");
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
        let enterPos = byteBuffer.pos;
        byteBuffer.pos = byteBuffer.max - 20;
        let lastEnd = byteBuffer.max;
        while (byteBuffer.pos > enterPos) {
            let pos = byteBuffer.pos;
            let byte_obj = byteBuffer.array[pos] == 0x09;
            let byte_owner = byteBuffer.array[pos + 9] == 0x11;
            let byte_unkn = byteBuffer.array[pos + 18] == 0x2a;
            if (!byte_obj || !byte_owner) {
                byteBuffer.pos = pos - 1;
                continue;
            }
            byteBuffer.getByte(); // 0x09
            let p1 = byteBuffer.pos;
            let object_id = byteBuffer.getLongStringAlt();
            byteBuffer.getByte(); // 0x11
            let p2 = byteBuffer.pos;
            let owner_id = byteBuffer.getLongStringAlt();
            byteBuffer.pos += 2;
            //if(object_id && owner_id){
            //    this.items.push(new ZoneObjItem(object_id,owner_id));
            //}
            let serachPos = byteBuffer.pos;
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
            let guids = [];
            while (byteBuffer.pos < lastEnd) {
                let pos = byteBuffer.pos;
                if (byteBuffer.getByte() == 0xf0 && byteBuffer.getByte() == 0x01) {
                    let value = byteBuffer.readLeb128();
                    let afterByte = byteBuffer.getByte();
                    guids.push({
                        value: value.toString(16).padStart(16, "0"),
                        //start:("0x"+pos.toString(16)),
                        //after:("0x"+afterByte.toString(16)),
                        //bevor:("0x"+byteBuffer.array[pos-1].toString(16))
                    });
                    byteBuffer.pos = pos + 1;
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
    }
}
exports.ZoneObjFile = ZoneObjFile;
class ZoneObjItem {
    constructor(object_id, owner_id, guid) {
        this.object_id = undefined;
        this.owner_id = undefined;
        this.guid = undefined;
        this.object_id = object_id;
        this.owner_id = owner_id;
        this.guid = guid;
    }
}
exports.ZoneObjItem = ZoneObjItem;
class GEOMResource {
    constructor() {
        this.files = [];
    }
}
exports.GEOMResource = GEOMResource;
class STBLFile {
    constructor(buffer) {
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
    calculateData() {
        if (!this.buffer)
            return;
        let byteBuffer = new ByteBuffer(this.buffer);
        //Magic
        let magic = byteBuffer.getInt();
        if (magic != 0x4C425453) {
            //Not STBL
            this.error = true;
            return;
        }
        //Basic Values
        this.version = byteBuffer.getShort();
        this.compressed = byteBuffer.getByte();
        let numberEntries = byteBuffer.getLong();
        let res0 = byteBuffer.getByte();
        let res1 = byteBuffer.getByte();
        this.stringDataLenght = byteBuffer.getInt();
        //Strings
        const decoder = new TextDecoder('utf-8');
        for (let index = 0; index < numberEntries; index++) {
            let key = byteBuffer.getInt();
            let flag = byteBuffer.getByte();
            let strLenght = byteBuffer.getShort();
            let textBuffer = byteBuffer.getSection(strLenght);
            let str = decoder.decode(textBuffer);
            let obj = {
                key: key,
                flag: flag,
                value: str
            };
            this.entries.push(obj);
        }
    }
    //Write
    addEntrie(item) {
        this.entries.push(item);
    }
    toBuffer() {
        let bw = new BinaryWritter();
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
        const encoder = new TextEncoder();
        for (let index = 0; index < this.entries.length; index++) {
            const element = this.entries[index];
            bw.writeInt(element.key);
            bw.writeByte(element.flag);
            let value = element.value;
            let data = encoder.encode(value);
            bw.writeShort(data.length);
            for (let j = 0; j < data.length; j++) {
                bw.writeByte(data[j]);
            }
        }
        return bw.toBuffer();
    }
    stringDataLength() {
        let count = 0;
        const encoder = new TextEncoder();
        for (let index = 0; index < this.entries.length; index++) {
            const element = this.entries[index];
            let data = encoder.encode(element.value);
            count += data.length;
        }
        return count;
    }
}
exports.STBLFile = STBLFile;
class GameFiles {
    static getThumbnailFiles(gameFolder) {
        let files = [];
        if (!fs.existsSync(gameFolder))
            return files;
        let set = new Set();
        this.checkFolderForThumbnailPackage(gameFolder, set);
        return Array.from(set.keys());
    }
    static checkFolderForThumbnailPackage(folder, set) {
        try {
            fs.readdirSync(folder).forEach((filename) => {
                let filepath = path.join(folder, filename);
                let stats = fs.lstatSync(filepath);
                if (NAMEUTIL.isPackageFile(filepath) && filepath.includes("thumbnail") && stats.isFile()) {
                    set.add(filepath);
                    return;
                }
                else if (stats.isDirectory()) {
                    this.checkFolderForThumbnailPackage(filepath, set);
                }
            });
        }
        catch (error) {
            console.log(error);
        }
    }
}
exports.GameFiles = GameFiles;
class S4SMMFile {
    constructor(entry) {
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
    setPackagesFromObjFrom(packages) {
        this.packages = [];
        for (let index = 0; index < packages.length; index++) {
            const item = packages[index];
            let res = [];
            for (let i = 0; i < item.resources.length; i++) {
                const valueString = item.resources[i];
                try {
                    const parts = valueString.split("-");
                    const type = parseInt(parts[0], 16);
                    const group = parseInt(parts[1], 16);
                    const instance = BigInt("0x" + parts[2]);
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
    }
    readFile() {
        if (!this.entry)
            return false;
        try {
            this.fileID = fs.openSync(this.entry.file);
            let buf = this.entry.getByteArray();
            let bb = new ByteBuffer(buf);
            const decoder = new TextDecoder('utf-8');
            //Version
            this.version = bb.getInt();
            //Name
            let nameLenth = bb.getInt();
            this.name = decoder.decode(bb.getSection(nameLenth));
            //Unknown
            let u1 = bb.getInt();
            //Packages
            let packageCount = bb.getInt();
            for (let index = 0; index < packageCount; index++) {
                let pNameLength = bb.getInt();
                let pName = decoder.decode(bb.getSection(pNameLength));
                let resCount = bb.getInt();
                let resources = [];
                for (let u = 0; u < resCount; u++) {
                    let r_i = bb.getLong();
                    let r_t = bb.getInt();
                    let r_g = bb.getInt();
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
    }
    toBuffer() {
        const encoder = new TextEncoder();
        const bb = new BinaryWritter();
        const version = 1;
        bb.writeInt(version);
        // Name
        const nameBytes = encoder.encode(this.name);
        bb.writeInt(nameBytes.length);
        bb.writeBytes(nameBytes);
        // Unknown (assuming a fixed value for simplicity)
        const unknown = 0;
        bb.writeInt(unknown);
        // Packages
        bb.writeInt(this.packages.length);
        this.packages.forEach(pkg => {
            const pNameBytes = encoder.encode(pkg.name);
            bb.writeInt(pNameBytes.length);
            bb.writeBytes(pNameBytes);
            bb.writeInt(pkg.resources.length);
            pkg.resources.forEach(res => {
                bb.writeBigInt(res.instance);
                bb.writeInt(res.type);
                bb.writeInt(res.group);
            });
        });
        return bb.toBuffer();
    }
    toObj() {
        let simplePackages = [];
        for (let index = 0; index < this.packages.length; index++) {
            const element = this.packages[index];
            let resources = [];
            for (let u = 0; u < element.resources.length; u++) {
                const r = element.resources[u];
                let o = {
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
    }
    static compareObjs(obj1, obj2) {
        if (obj1.name !== obj2.name)
            return false;
        if (obj1.resources.length !== obj2.resources.length)
            return false;
        for (let i = 0; i < obj1.resources.length; i++) {
            if (obj1.resources[i] !== obj2.resources[i])
                return false;
        }
        return true;
    }
    ;
}
exports.S4SMMFile = S4SMMFile;
class XMLFile {
    constructor(buffer) {
        this.data = null;
        this.error = false;
        if (buffer) {
            this.buffer = buffer;
            this.calculateData();
        }
    }
    calculateData() {
        if (!this.buffer)
            return;
        try {
            // Optionen konfigurieren, um Attribute (wie n, s, c) beizubehalten
            const options = {
                ignoreAttributes: false,
                attributeNamePrefix: "",
                parseAttributeValue: true
            };
            const parser = new fast_xml_parser_1.XMLParser(options);
            const xmlString = this.buffer.toString('utf-8');
            const jsonObj = parser.parse(xmlString);
            // Die Daten in der Instanz speichern
            this.data = jsonObj;
            this.error = false;
        }
        catch (err) {
            console.error("Fehler beim XML-Parsing:", err);
            this.error = true;
            this.data = null;
        }
    }
    get root() {
        return this.data?.I;
    }
}
exports.XMLFile = XMLFile;
class XMLResource {
    constructor() {
        this.cTypes = new Set();
        this.primaryThumbnailInstances = [];
    }
    processXMLFile(xmlFile) {
        let root = xmlFile.root;
        if (!root)
            return;
        if (root.c) {
            this.cTypes.add(root.c);
        }
        if (root.T) {
            for (let index = 0; index < root.T.length; index++) {
                const element = root.T[index];
                if (element.n == "icon" && element["#text"]) {
                    let instance = element["#text"].split(":").pop() || "";
                    this.primaryThumbnailInstances.push(instance.toLowerCase());
                }
            }
        }
    }
    processXMLBuffer(buffer) {
        let xml = new XMLFile(buffer);
        if (xml.error) {
            throw new Error("Error parsing XML");
        }
        ;
        this.processXMLFile(xml);
    }
    processXMLEntry(entry) {
        let data = entry.getByteArray();
        this.processXMLBuffer(data);
    }
    get cTypesCombinedString() {
        return Array.from(this.cTypes).join(" ");
    }
}
exports.XMLResource = XMLResource;
class GenericRCOLFile {
    constructor(buffer) {
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
    calculateData() {
        if (!this.buffer)
            throw new Error("No Buffer");
        let byteBuffer = new ByteBuffer(this.buffer);
        this.version = byteBuffer.getInt();
        this.publicChunks = byteBuffer.getInt();
        this.unused = byteBuffer.getInt();
        let countResources = byteBuffer.getInt();
        let countChunks = byteBuffer.getInt();
        let chunks = [];
        for (let index = 0; index < countChunks; index++) {
            let obj = byteBuffer.readTGIItemByOrdner(4);
            if (obj)
                chunks.push(obj);
        }
        this.resources = [];
        for (let index = 0; index < countResources; index++) {
            let obj = byteBuffer.readTGIItemByOrdner(4);
            if (obj)
                this.resources.push(obj);
        }
        let indexs = [];
        for (let index = 0; index < countChunks; index++) {
            let rie = {
                position: byteBuffer.getInt(),
                length: byteBuffer.getInt(),
            };
            indexs.push(rie);
        }
        if (countChunks == 1) {
            indexs[0].position = 0x2c + (countResources * 16);
            indexs[0].length = byteBuffer.max - indexs[0].position;
            if (chunks[0]?.type == 0) {
                let tag = byteBuffer.getSection(4).toString();
                chunks[0].type = 0;
                throw new Error("Tag: " + tag);
            }
        }
        this.blockList = new ChunkEntryList(byteBuffer, chunks, indexs);
    }
    getMeshTesting() {
        let vbufs = [];
        let vrtfs = [];
        let ibufs = [];
        let list = this.blockList?.chunkEntries || [];
        for (let index = 0; index < list.length; index++) {
            const element = list[index];
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
        let defVrtf = new VRTFFile();
        defVrtf.loadDefaults();
        let vertex0;
        let vertex1;
        let indices0;
        let indices1;
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
        let meshes = [
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
    }
    getTextures() {
        let textures = [];
        let list = this.blockList?.chunkEntries || [];
        for (let index = 0; index < list.length; index++) {
            const element = list[index];
            if (element.file instanceof MATDFile) {
                let obj = element.file.getDiffuseTexture();
                if (obj)
                    textures.push(obj);
            }
        }
        return textures;
    }
    overrideMTSTandMATD(swatches) {
        //Find first MTST and example MATD with Diffuse Map
        let mtst = undefined;
        let mtstChunk = undefined;
        let matd = undefined;
        let matdChunk = undefined;
        if (!this.blockList)
            throw new Error("No blocklist");
        let list = this.blockList.chunkEntries || [];
        for (let index = 0; index < list.length; index++) {
            const element = list[index];
            if (!mtst && element.file instanceof MTSTFile) {
                mtst = element.file;
                mtstChunk = element;
            }
            else if (element.file instanceof MATDFile) { //Take last (first would be !matd)
                let matdFile = element.file;
                let hasDiffuseKey = matdFile.getDiffuseTexture() != undefined;
                if (hasDiffuseKey) {
                    matd = matdFile;
                    matdChunk = element;
                }
            }
        }
        if (!mtst || !matd || !matdChunk || !mtstChunk)
            return this.toBufferBasedOnChunks();
        //let mtstOffset = mtstChunk.index;
        let mtstOffset = list.length;
        mtst.entries = mtst.entries.splice(0, 2);
        //Add Swatches
        let tgi = matdChunk.tgiBlock;
        if (!tgi)
            throw new Error("No TGI");
        for (let index = 0; index < swatches.length; index++) {
            const swatchData = swatches[index].data;
            //MTST
            let matdIndexNormal = mtstOffset + (2 * index);
            let matdIndexBurnt = matdIndexNormal + 1;
            let materialVariant = Number(swatchData.materialVariantHashValues.num);
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
            let newMATD = new MATDFile(matd.buffer);
            newMATD.materialNameHash += index + 1;
            if (newMATD.mtrl) {
                for (let j = 0; j < newMATD.mtrl.shaderDataList.length; j++) {
                    const shader = newMATD.mtrl.shaderDataList[j];
                    if (shader.field == 0x6CC0FD85) {
                        newMATD.mtrl.shaderDataList[j].data = {
                            type: 0x00B2D882,
                            group: 0x80000000,
                            instance: swatchData.instance
                        };
                    }
                }
            }
            let newMATDBuffer = newMATD.toBuffer();
            let newChunkNormal = new ChunkEntry({ type: tgi.type, group: tgi.group, instance: (tgi.instance + BigInt(matdIndexNormal)) }, newMATDBuffer, matdIndexNormal);
            list.push(newChunkNormal);
            let newMATDB = new MATDFile(matd.buffer);
            newMATDB.materialNameHash += index + 2;
            if (newMATDB.mtrl) {
                for (let j = 0; j < newMATDB.mtrl.shaderDataList.length; j++) {
                    const shader = newMATDB.mtrl.shaderDataList[j];
                    if (shader.field == 0x6CC0FD85) {
                        newMATDB.mtrl.shaderDataList[j].data = {
                            type: 0x00B2D882,
                            group: 0x80000000,
                            instance: swatchData.instance
                        };
                    }
                }
            }
            let newMATDBufferB = newMATDB.toBuffer();
            let newChunkNormalB = new ChunkEntry({ type: tgi.type, group: tgi.group, instance: (tgi.instance + BigInt(matdIndexBurnt)) }, newMATDBufferB, matdIndexBurnt);
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
    }
    toBufferBasedOnChunks() {
        if (!this.blockList || !this.blockList.chunkEntries)
            return;
        let byteBuffer = new BinaryWritter();
        byteBuffer.writeInt(this.version);
        byteBuffer.writeInt(this.publicChunks);
        byteBuffer.writeInt(this.unused);
        let countResources = this.resources.length;
        let countChunks = this.blockList.chunkEntries.length;
        byteBuffer.writeInt(countResources);
        byteBuffer.writeInt(countChunks);
        for (let index = 0; index < countChunks; index++) {
            const element = this.blockList.chunkEntries[index];
            if (element.tgiBlock)
                byteBuffer.writeTGIItemByOrdnerType(element.tgiBlock, 4, false);
        }
        for (let index = 0; index < countResources; index++) {
            const element = this.resources[index];
            if (element)
                byteBuffer.writeTGIItemByOrdnerType(element, 4, false);
        }
        let startOffest = byteBuffer.pos + (8 * countChunks);
        for (let index = 0; index < countChunks; index++) {
            const element = this.blockList.chunkEntries[index];
            if (element.buffer) {
                let elementSize = element.buffer.length;
                let position = startOffest;
                startOffest += elementSize;
                byteBuffer.writeInt(position);
                byteBuffer.writeInt(elementSize);
            }
        }
        //Write all files
        for (let index = 0; index < countChunks; index++) {
            const element = this.blockList.chunkEntries[index];
            let fileBuffer = element.buffer;
            if (fileBuffer) {
                byteBuffer.writeBytes(fileBuffer);
            }
        }
        return byteBuffer.toBuffer();
    }
    getMeshesCounts() {
        //let meshes : any = [];
        let vertexTotal = 0;
        let faceTotal = 0;
        let list = this.blockList?.chunkEntries || [];
        for (let index = 0; index < list.length; index++) {
            const element = list[index];
            if (element.file instanceof MLODFile) {
                let mlod = element.file;
                mlod.meshInfos.forEach((meshInfo) => {
                    let mesh = {
                        name: meshInfo.name,
                        vertexCount: meshInfo.vertexCount,
                        faceCount: meshInfo.primitiveCount
                    };
                    vertexTotal += meshInfo.vertexCount;
                    faceTotal += meshInfo.primitiveCount;
                    //meshes.push(mesh);
                });
            }
        }
        return { vertex: vertexTotal, face: faceTotal };
    }
}
exports.GenericRCOLFile = GenericRCOLFile;
class ChunkEntryList {
    //parentTGIBlocks:TGIList|undefined;
    constructor(bb, chunks, indexs) {
        this.chunkEntries = [];
        for (let i = 0; i < indexs.length; i++) {
            const index = indexs[i];
            bb.pos = index.position;
            let data = bb.getSection(index.length);
            let ce = new ChunkEntry(chunks[i], data, i);
            this.chunkEntries.push(ce);
        }
    }
}
exports.ChunkEntryList = ChunkEntryList;
class ChunkEntry {
    constructor(tgiBlock, buffer, index) {
        this.index = index;
        this.tgiBlock = tgiBlock;
        this.buffer = buffer;
        let bb = new ByteBuffer(buffer);
        let magic = bb.getInt();
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
}
exports.ChunkEntry = ChunkEntry;
class VRTFFile {
    constructor(buffer) {
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
    calculateData() {
        if (!this.buffer)
            throw new Error("No Buffer");
        //fs.writeFileSync("C:\\Users\\fabis\\Pictures\\Frame-CC-Testing\\VRTF_Frame.bnry",this.buffer);
        let bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x46545256)
            throw new Error("Not VRTF");
        this.version = bb.getInt();
        this.stride = bb.getInt();
        let count = bb.getInt();
        this.extendedFormat = bb.getInt() > 0 ? true : false; // Stange but used in refrerence
        this.layouts = [];
        for (let index = 0; index < count; index++) {
            let usage = bb.getByte();
            let usageIndex = bb.getByte();
            let format = bb.getByte();
            let offset = bb.getByte();
            let element = {
                usage: usage,
                usageIndex: usageIndex,
                format: format,
                offset: offset
            };
            this.layouts.push(element);
        }
    }
    getFirstOfUsage(usage) {
        for (let index = 0; index < this.layouts.length; index++) {
            const element = this.layouts[index];
            if (element.usage == usage)
                return element;
        }
        return undefined;
    }
    getAllOfUsage(usage) {
        let list = [];
        for (let index = 0; index < this.layouts.length; index++) {
            const element = this.layouts[index];
            if (element.usage == usage)
                list.push(element);
        }
        return list;
    }
    loadDefaults() {
        this.version = 0x2;
        this.stride = 16;
        this.extendedFormat = false;
        let layout1 = {
            format: 12,
            offset: 0,
            usage: 0,
            usageIndex: 0
        };
        let layout2 = {
            format: 255,
            offset: 8,
            usage: 2,
            usageIndex: 0
        };
        this.layouts = [];
        this.layouts.push(layout1);
        this.layouts.push(layout2);
    }
    static floatCountFromFormat(format) {
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
    }
    static byteSizeFromFormat(f) {
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
    }
}
exports.VRTFFile = VRTFFile;
class IBUFFile {
    constructor(buffer) {
        this.magic = 0;
        this.version = 0;
        this.flags = 0;
        this.displayListUsage = 0;
        this.indices = [];
        this.buffer = buffer;
        this.calculateData();
    }
    calculateData() {
        //fs.writeFileSync("C:\\Users\\fabis\\Pictures\\Frame-CC-Testing\\IBUF_Frame.bnry",this.buffer);
        let bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x46554249)
            throw new Error("Not IBUF");
        this.version = bb.getInt();
        this.flags = bb.getInt();
        this.displayListUsage = bb.getInt();
        let is32Bit = (this.flags & 0x2) != 0;
        let length = (bb.max - bb.pos) / (is32Bit ? 4 : 2);
        let last = 0;
        this.indices = [];
        for (let index = 0; index < length; index++) {
            let cur = is32Bit ? bb.getSignedInt() : bb.getSignedShort();
            if ((this.flags & 0x1) != 0) {
                cur += last;
            }
            this.indices.push(cur);
            last = cur;
        }
    }
    getFaces(corners = 3) {
        //Check if can be divided by 3
        if (this.indices.length % corners != 0) {
            throw new Error("Not a valid face count");
        }
        let faces = [];
        for (let index = 0; index < this.indices.length; index += corners) {
            let face = [];
            for (let i = 0; i < corners; i++) {
                face.push(this.indices[index + i]);
            }
            faces.push(face);
        }
        return faces;
    }
}
exports.IBUFFile = IBUFFile;
class VBUFFile {
    constructor(buffer) {
        this.magic = 0;
        this.version = 0;
        this.flags = 0;
        this.swizzleInfo = 0;
        this.buffer = buffer;
        this.calculateData();
    }
    calculateData() {
        //fs.writeFileSync("C:\\Users\\fabis\\Pictures\\Frame-CC-Testing\\VBUF_Frame.bnry",this.buffer);
        let bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x46554256)
            throw new Error("Not VBUF");
        this.version = bb.getInt();
        this.flags = bb.getInt();
        this.swizzleInfo = bb.getInt();
        this.dataBuffer = bb.getSection(bb.max - bb.pos);
    }
    getVertices(vrtf, uvscales = [0.00003051851, 0.00003051851, 0.00003051851]) {
        let position = vrtf.getFirstOfUsage(0x0);
        let normal = vrtf.getFirstOfUsage(0x1);
        let uv = vrtf.getAllOfUsage(0x2);
        let blendIndices = vrtf.getFirstOfUsage(0x3);
        let blendWeights = vrtf.getFirstOfUsage(0x4);
        let tangents = vrtf.getFirstOfUsage(0x5);
        let color = vrtf.getFirstOfUsage(0x6);
        let vertices = [];
        if (!this.dataBuffer)
            throw new Error("No DataBuffer");
        let bb = new ByteBuffer(this.dataBuffer);
        let stride = vrtf.stride;
        let count = bb.max / stride;
        for (let index = 0; index < count; index++) {
            let vData = bb.getSection(stride);
            let vbb = new ByteBuffer(vData);
            let vertex = {};
            if (position != undefined) {
                let p = [];
                p = this.readFloatData(vbb, position);
                vertex.p = p;
            }
            if (normal != undefined) {
                let n = [];
                n = this.readFloatData(vbb, normal);
                vertex.n = n;
            }
            if (uv && uv.length > 0) {
                let uvs = [];
                for (let i = 0; i < uv.length; i++) {
                    var scale = i < uvscales.length && uvscales[i] != 0 ? uvscales[i] : uvscales[0];
                    let uvData = this.readUVData(vbb, uv[i], scale);
                    uvs.push(uvData);
                }
                vertex.uvc = uvs;
                if (uvs.length >= 1 && uvs[0].length >= 2) {
                    let uvSimple = [uvs[0][0], uvs[0][1]];
                    vertex.u = uvSimple;
                }
            }
            vertices.push(vertex);
        }
        return vertices;
    }
    readFloatData(bb, layout) {
        bb.pos = layout.offset;
        let scalar;
        let output = [];
        let outputSize = VRTFFile.floatCountFromFormat(layout.format);
        for (let index = 0; index < outputSize; index++) {
            output.push(0);
        }
        switch (layout.format) {
            case ElementFormat.Float1:
            case ElementFormat.Float2:
            case ElementFormat.Float3:
            case ElementFormat.Float4:
                for (let i = 0; i < output.length; i++) {
                    bb.pos = (i * 4) + layout.offset;
                    output[i] += bb.getFloat();
                }
                break;
            case ElementFormat.Short2:
                for (let i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    output[i] += bb.getSignedShort() / 32767;
                }
                break;
            case ElementFormat.Short4:
                bb.pos = 3 * 2;
                scalar = bb.getSignedShort();
                if (scalar == 0)
                    scalar = 32767;
                for (let i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    output[i] += bb.getSignedShort() / scalar;
                }
                break;
            case ElementFormat.UShort4N:
                bb.pos = (3 * 2) + layout.offset;
                scalar = bb.getShort();
                if (scalar == 0)
                    scalar = 511;
                for (let i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    output[i] += bb.getShort() / scalar;
                }
                break;
            case ElementFormat.UByte4N:
                bb.pos = 3 + layout.offset;
                scalar = bb.getByte();
                if (scalar == 0)
                    scalar = 127;
                for (let i = 0; i < output.length; i++) {
                    bb.pos = i + layout.offset;
                    output[i] += bb.getByte() / scalar;
                }
                break;
            default:
                console.log("Unknown Format: " + layout.format);
        }
        return output;
    }
    readUVData(bb, layout, scale = 0.00003051851) {
        let output = [];
        let outputSize = VRTFFile.floatCountFromFormat(layout.format);
        for (let index = 0; index < outputSize; index++) {
            output.push(0);
        }
        switch (layout.format) {
            case ElementFormat.Short2:
                for (let i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    let value = bb.getSignedShort();
                    output[i] += value * scale;
                }
                break;
            case ElementFormat.Short4:
                for (let i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    let value = bb.getSignedShort();
                    output[i] += value / 32767;
                }
                break;
            case ElementFormat.Short4_DropShadow:
                for (let i = 0; i < output.length; i++) {
                    bb.pos = (i * 2) + layout.offset;
                    let value = bb.getSignedShort();
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
    }
}
exports.VBUFFile = VBUFFile;
class MODLFile {
    constructor(buffer) {
        this.magic = 0;
        this.version = 0;
        this.buffer = buffer;
        this.calculateData();
    }
    calculateData() {
        let bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x4c444f4d) {
            throw new Error("Not MODL");
        }
        this.version = bb.getInt();
        let count = bb.getInt();
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
    }
}
exports.MODLFile = MODLFile;
class MLODFile {
    constructor(buffer) {
        this.magic = 0;
        this.version = 0;
        this.meshInfos = [];
        this.buffer = buffer;
        this.calculateData();
    }
    calculateData() {
        let bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x444f4c4d) {
            throw new Error("Not MLOD");
        }
        this.version = bb.getInt();
        let count = bb.getInt();
        this.meshInfos = [];
        for (let index = 0; index < count; index++) {
            //Mesh File?
            let mesh = new MeshFile(bb, this);
            this.meshInfos.push(mesh);
        }
    }
}
exports.MLODFile = MLODFile;
class MeshFile {
    constructor(bb, mLodFile) {
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
    calculateData() {
        let size = this.bb.getInt();
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
        let val = this.bb.getInt();
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
        let count = this.bb.getInt();
        for (let index = 0; index < count; index++) {
            this.jointReferences.push(this.bb.getInt());
            //Not sure if this is correct
        }
        this.meshMaterialIndex = this.bb.getInt();
        let geometryStateCount = this.bb.getInt();
        this.geometryStates = [];
        for (let index = 0; index < geometryStateCount; index++) {
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
            for (let i = 0; i < this.jointReferences.length; i++) {
                this.boundingBoxBones.push(new BoundingBox(this.bb));
            }
        }
    }
}
exports.MeshFile = MeshFile;
class BoundingBox {
    constructor(bb) {
        this.min = new Vertex(bb);
        this.max = new Vertex(bb);
    }
}
class Vertex {
    constructor(bb) {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        if (bb)
            this.read(bb);
    }
    read(bb) {
        this.x = bb.getFloat();
        this.y = bb.getFloat();
        this.z = bb.getFloat();
    }
}
class MATDFile {
    constructor(buffer) {
        this.magic = 0;
        this.version = 0;
        this.materialNameHash = 0;
        this.shader = 0;
        this.isVideoSurface = false;
        this.isPaintingSurface = false;
        this.buffer = buffer;
        this.calculateData();
    }
    calculateData() {
        let bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x4454414d) {
            throw new Error("Not MATD");
        }
        this.version = bb.getInt();
        this.materialNameHash = bb.getInt();
        this.shader = bb.getInt();
        let length = bb.getInt();
        let start;
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
        let mtrlBuffer = bb.getSection(length);
        this.mtrl = new MTRLFile(mtrlBuffer);
    }
    toBuffer() {
        let bb = new BinaryWritter();
        bb.writeInt(this.magic);
        if (this.magic != 0x4454414d) {
            throw new Error("Not MATD");
        }
        bb.writeInt(this.version);
        bb.writeInt(this.materialNameHash);
        bb.writeInt(this.shader);
        if (!this.mtrl)
            throw new Error("No mtrl");
        let mtrlBuffer = this.mtrl.toBuffer();
        let length = mtrlBuffer.length;
        bb.writeInt(length);
        if (this.version >= 0x00000103) {
            bb.writeInt(this.isVideoSurface ? 1 : 0);
            bb.writeInt(this.isPaintingSurface ? 1 : 0);
        }
        bb.writeBytes(mtrlBuffer);
        return bb.toBuffer();
    }
    getDiffuseTexture() {
        if (!this.mtrl)
            return undefined;
        let list = this.mtrl.shaderDataList;
        for (let index = 0; index < list.length; index++) {
            const element = list[index];
            if (element.field == 0x6CC0FD85 && element.data) {
                return element.data;
            }
        }
        return undefined;
    }
}
exports.MATDFile = MATDFile;
class MTRLFile {
    constructor(buffer) {
        this.magic = 0;
        this.mtrlUnknown1 = 0;
        this.mtrlUnknown2 = 0;
        this.mtrlUnknown3 = 0;
        this.shaderDataList = [];
        this.buffer = buffer;
        this.calculateData();
    }
    calculateData() {
        let bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x4c52544d) {
            throw new Error("Not MTRL");
        }
        this.mtrlUnknown1 = bb.getInt();
        this.mtrlUnknown2 = bb.getShort();
        this.mtrlUnknown3 = bb.getShort();
        let count = bb.getInt();
        for (let index = 0; index < count; index++) {
            let field = bb.getInt();
            let sdType = bb.getInt();
            let c = bb.getInt();
            let offset = bb.getInt();
            let pos = bb.pos;
            bb.pos = offset;
            let data = this.readData(bb, sdType, c);
            bb.pos = pos;
            this.shaderDataList.push({
                field: field,
                sdType: sdType,
                count: c,
                offset: offset,
                data: data
            });
        }
    }
    readData(bb, sdType, count) {
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
                        let obj = bb.readTGIItemByOrdner(4);
                        let zero = bb.getInt();
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
    }
    toBuffer() {
        let bb = new BinaryWritter();
        bb.writeInt(this.magic);
        if (this.magic != 0x4c52544d) {
            throw new Error("Not MTRL");
        }
        bb.writeInt(this.mtrlUnknown1);
        bb.writeShort(this.mtrlUnknown2);
        bb.writeShort(this.mtrlUnknown3);
        let count = this.shaderDataList.length;
        bb.writeInt(count);
        let offsets = [];
        let currentPos = bb.pos + count * 16; // 16 bytes for each entry (4 ints)
        for (let index = 0; index < count; index++) {
            let entry = this.shaderDataList[index];
            bb.writeInt(entry.field);
            bb.writeInt(entry.sdType);
            bb.writeInt(entry.count);
            offsets.push(currentPos);
            bb.writeInt(currentPos);
            currentPos += this.calculateDataSize(entry.sdType, entry.count);
        }
        for (let index = 0; index < count; index++) {
            let entry = this.shaderDataList[index];
            bb.pos = offsets[index];
            this.writeData(bb, entry.sdType, entry.count, entry.data);
        }
        return bb.toBuffer();
    }
    calculateDataSize(sdType, count) {
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
    }
    writeData(bb, sdType, count, data) {
        switch (sdType) {
            case 0x1:
                for (let i = 0; i < count; i++) {
                    bb.writeFloat(data[i]);
                }
                break;
            case 0x2:
                for (let i = 0; i < count; i++) {
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
    }
}
exports.MTRLFile = MTRLFile;
class MTSTFile {
    constructor(buffer) {
        this.magic = 0;
        this.version = 0;
        this.nameHash = 0;
        this.entries = [];
        this.indexUnused = 0;
        this.is200 = false;
        this.buffer = buffer;
        this.calculateData();
    }
    calculateData() {
        let bb = new ByteBuffer(this.buffer);
        this.magic = bb.getInt();
        if (this.magic != 0x5453544d) {
            throw new Error("Not MTRL");
        }
        this.version = bb.getInt();
        this.nameHash = bb.getInt();
        this.indexUnused = bb.getInt();
        this.is200 = this.version < 0x300;
        let count = bb.getInt();
        this.entries = [];
        for (let i = 0; i < count; i++) {
            let index = undefined;
            let materialState = undefined;
            let materialVariant = undefined;
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
    }
    toBuffer() {
        let bb = new BinaryWritter();
        bb.writeInt(this.magic);
        bb.writeInt(this.version);
        bb.writeInt(this.nameHash);
        bb.writeInt(this.indexUnused);
        this.is200 = this.version < 0x300;
        let count = this.entries.length;
        bb.writeInt(count);
        for (let i = 0; i < count; i++) {
            let entry = this.entries[i];
            let index = entry.index & 0x0FFFFFFF;
            let materialState = entry.materialState;
            let materialVariant = entry.materialVariant;
            bb.writeInt(index);
            bb.writeInt(materialState);
            if (!this.is200) {
                bb.writeInt(materialVariant);
            }
        }
        return bb.toBuffer();
    }
}
exports.MTSTFile = MTSTFile;
class ThumCacheTable {
    constructor(buffer) {
        this.version = 0;
        this.nextInstanceValue = "0";
        this.entries = [];
        this.buffer = buffer;
        this.calculateData();
    }
    calculateData() {
        let bb = new ByteBuffer(this.buffer);
        this.version = bb.getInt();
        this.nextInstanceValue = bb.getLong().toString();
        let count = bb.getInt();
        this.entries = [];
        for (let index = 0; index < count; index++) {
            let entry = new ThumCacheEntry(bb);
            //if(index==0)console.log(entry);
            this.entries.push(entry);
        }
        /*

        let values : number[] = [];
        let gaps : number[] = [];
        let currentGap = 0;
        while(bb.pos<bb.max){
            currentGap++;
            let byte = bb.getByte();
            if(byte>0){
                if(currentGap==84){
                    values.push(0);
                }
                values.push(byte);
                if(currentGap>0){
                    gaps.push(currentGap);
                    currentGap=0;
                }
            }
        }

        console.log("Gaps: "+gaps.length);
        console.log(gaps);

        

        let arr = "AVATAR,BUNDLE_PREVIEW,CEILING_RAIL,FENCE,FLOOR,FLOORTRIM_FRIEZE,GALLERY,LOT_BLUEPRINT,LOT_PAINT,LOT_PREVIEW,MAGALOG,MAGALOG_EXCHANGE,MAGALOG_MASK,MEMORY,MODEL,OBJECT,PET_BREED,PET_BREED_COAT_PATTERN,PETS1,PETS2,PHOTOBOOTH_FAMILY,RAILING,ROOF_PATTERN,ROOFTRIM,SIM,SIM_BUST,SIM_CAS_PART,SIM_CAS_PRESET,SIM_COMPLETE_HEAD,SIM_FEATURED_OUTFIT,SIM_FULLBODY,SIM_GALLERY,SIM_HOUSEHOLD,SIM_MANNEQUIN_OUTFIT,SIM_PORTRAIT,SIM_PORTRAIT_CAS,SIM_TRAVEL,STAIR,TATTOO,WALL,WORLDMAP_LOT".split(",");

        if(arr.length!=values.length) throw new Error("Length mismatch "+arr.length+"!="+values.length);
        let pairs : any[] = [];
        for (let index = 0; index < arr.length; index++) {
            pairs.push({name:arr[index],value:values[index]});
        }
        for (let index = 0; index < pairs.length; index++) {
            const element = pairs[index];
            console.log(element.name+" = 0x"+element.value.toString(16).toUpperCase().padStart(2,'0')+",");
        }




        return;*/
    }
}
exports.ThumCacheTable = ThumCacheTable;
class ThumCacheEntry {
    constructor(bb) {
        this.ThumCacheSimType = new Set([
            ThumCacheEntryType.SIM,
            ThumCacheEntryType.SIM_BUST,
            ThumCacheEntryType.SIM_CAS_PRESET,
            ThumCacheEntryType.SIM_CAS_PART,
            ThumCacheEntryType.SIM_COMPLETE_HEAD,
            ThumCacheEntryType.SIM_FEATURED_OUTFIT,
            ThumCacheEntryType.SIM_FULLBODY,
            ThumCacheEntryType.SIM_MANNEQUIN_OUTFIT,
            ThumCacheEntryType.SIM_PORTRAIT_CAS,
            ThumCacheEntryType.SIM_HOUSEHOLD,
            ThumCacheEntryType.PHOTOBOOTH_FAMILY,
            ThumCacheEntryType.SIM_TRAVEL,
            ThumCacheEntryType.SIM_GALLERY,
            ThumCacheEntryType.SIM_PORTRAIT
        ]);
        // 9 - SIM_HOUSEHOLD
        // 32 - SIM_GALLERY
        this.bufferStartPos = 0;
        this.type = 0;
        this.size = 0;
        this.versionType = 0;
        this.resourceId = "0";
        this.index = 0;
        this.isPreset = false;
        this.thumbnailId = 0;
        this.gender = 0;
        this.simId = "0";
        this.pose = 0;
        this.familyId = "0";
        this.models = [];
        this.paintingKey = "0";
        this.paintingGroup = 0;
        this.geoState = 0;
        this.materialState = 0;
        this.modelIndex = 0;
        this.flags = 0;
        this.alias = 0;
        this.key = {
            type: 0,
            group: 0,
            instance: "0"
        };
        this.bufferStartPos = bb.pos;
        this.type = bb.getInt();
        this.size = bb.getInt();
        this.versionType = bb.getInt();
        this.resourceId = bb.getLong().toString();
        this.index = bb.getInt();
        this.processThumData(bb);
        this.key = {
            type: bb.getInt(),
            group: bb.getInt(),
            instance: bb.getLong().toString()
        };
        this.alias = bb.getByte();
        /*if(this.type==0){
            this.thumbnailId = -1;
        }else{
            this.thumbnailId = bb.getInt();
        }*/
        /*switch (this.thumbnailId){
            case -1: //NONE
                break;
            case 2: //HOUSEHOLD_THUMBNAIL_SERIALIZATION_ID
                this.familyId = bb.getLong().toString();
                break;
            case 1: //SIM_THUMBNAIL_SERIALIZATION_ID
                this.simId = bb.getLong().toString();
                this.pose = bb.getInt();
                break;
            case 286331153: // CAS_PART_THUMBNAIL_SERIALIZATION_ID
                this.gender = bb.getByte();
                break;
            case 3543935006: //LOT_BLUEPRINT
                //NIX
                break;
            case 3: //SIM_TRAVEL
                this.simId = bb.getLong().toString();
                console.log(this);
                break;
            default:
                console.log("Starting at "+start+" (0x"+start.toString(16)+")");
                console.log(this);
                throw new Error("Unknown ThumbnailId "+this.thumbnailId);
        }

        this.key = {
                    type: bb.getInt(),
                    group: bb.getInt(),
                    instance: bb.getLong().toString()
        };

        this.alias = bb.getByte();*/
    }
    processThumData(bb) {
        let serializationID = bb.getInt();
        if (this.ThumCacheSimType.has(this.type)) {
            if (serializationID == 0x11111111) {
                this.gender = bb.getByte();
                return;
            }
            else if (serializationID == 0x00000001) {
                this.simId = bb.getLong().toString();
                this.pose = bb.getInt();
                return;
            }
            else if (serializationID == 0x00000002) {
                this.familyId = bb.getLong().toString();
                return;
            }
            this.processModelObjectData(bb, serializationID);
            return;
        }
        else if (this.type == ThumCacheEntryType.MODEL || this.type == ThumCacheEntryType.OBJECT) {
            this.processModelObjectData(bb, serializationID);
            return;
        }
        throw new Error("No TableEntryData for ThumbnailType " + this.type + ".");
    }
    processModelObjectData(bb, serializationID) {
        console.log("Processing Model/Object Data");
        console.log("SerializationID: 0x" + serializationID.toString(16).toUpperCase().padStart(8, '0'));
        console.log("At Position: 0x" + (bb.pos - 4 + this.bufferStartPos).toString(16).toUpperCase().padStart(8, '0'));
        this.flags = serializationID & 0xFFFF0000;
        let dataType = serializationID & 0x0000FFFF;
        console.log({
            flags: this.flags,
            dataType: dataType
        });
        console.log(this);
        throw new Error("Not implemented");
    }
}
exports.ThumCacheEntry = ThumCacheEntry;
class PosePackHelper {
    static async getPosePacksFromFile(file, tmpThumFolder = undefined) {
        let posepacks = [];
        try {
            let pack = new Pack(file);
            pack.checkFile();
            pack.calculateIndexList();
            let strMap = new Map();
            pack.index_List.filter((entry) => entry.type == TagType.STBL).forEach((entry) => {
                let stbl = new STBLFile(entry.getByteArray());
                stbl.entries.forEach((stblEntry) => {
                    strMap.set(stblEntry.key.toString(), stblEntry.value);
                });
            });
            let xmlEntries = pack.index_List.filter((entry) => {
                return entry.type == TagType.XML;
            });
            let xmlFiles = [];
            xmlEntries.forEach((entry) => {
                let xmlFile = new XMLFile(entry.getByteArray());
                let root = xmlFile.root;
                if (!root)
                    return;
                if (root.c == "PosePackInstance")
                    xmlFiles.push(xmlFile);
            });
            for (let i = 0; i < xmlFiles.length; i++) {
                let xmlFile = xmlFiles[i];
                let posepack = new PosePack(xmlFile);
                if (!posepack.posePackInstance)
                    continue;
                //Extend with STBL
                let instance = posepack.posePackInstance;
                instance.displayName = strMap.get(instance.displayName) ?? instance.displayName;
                instance.sortName = strMap.get(instance.sortName) ?? instance.sortName;
                instance.description = strMap.get(instance.description) ?? instance.description;
                instance.creatorName = strMap.get(instance.creatorName) ?? instance.creatorName;
                if (tmpThumFolder && instance.icon) {
                    let iconInstance = instance.icon.split(":").pop();
                    let thumEntry = pack.getEntryIfExists(0x00B2D882, undefined, iconInstance);
                    if (thumEntry) {
                        let pngBuffer = await MixedHelpers.imgBufferToPng(thumEntry.getByteArray());
                        if (pngBuffer) {
                            let iconPath = path.join(tmpThumFolder, instance.icon.split(":").join("_") + ".png");
                            fs.writeFileSync(iconPath, pngBuffer);
                            if (fs.existsSync(iconPath))
                                instance.iconPath = iconPath;
                        }
                    }
                }
                for (let j = 0; j < instance.poseList.length; j++) {
                    let poseItem = instance.poseList[j];
                    poseItem.poseDisplayName = strMap.get(poseItem.poseDisplayName) ?? poseItem.poseDisplayName;
                    poseItem.poseDescription = strMap.get(poseItem.poseDescription) ?? poseItem.poseDescription;
                    if (tmpThumFolder && poseItem.icon) {
                        let iconInstance = poseItem.icon.split(":").pop();
                        let thumEntry = pack.getEntryIfExists(0x00B2D882, undefined, iconInstance);
                        if (thumEntry) {
                            let pngBuffer = await MixedHelpers.imgBufferToPng(thumEntry.getByteArray());
                            if (pngBuffer) {
                                let iconPath = path.join(tmpThumFolder, poseItem.icon.split(":").join("_") + ".png");
                                fs.writeFileSync(iconPath, pngBuffer);
                                if (fs.existsSync(iconPath))
                                    poseItem.iconPath = iconPath;
                            }
                        }
                    }
                }
                posepacks.push(instance);
            }
        }
        catch (error) {
            console.error("Error reading posepacks from file: ", error);
        }
        return posepacks;
    }
}
exports.PosePackHelper = PosePackHelper;
class PosePack {
    constructor(xmlFile) {
        let root = xmlFile.root;
        if (!root)
            throw new Error("Invalid XML File, no root element found.");
        if (root.c !== "PosePackInstance")
            throw new Error("Invalid XML File, root element is not PosePackInstance.");
        this.posePackInstance = this.parsePosePack(root);
    }
    parsePosePack(root) {
        const findVal = (arr, key) => arr.find(item => item.n === key)?.["#text"] ?? "";
        const instance = {
            displayName: String(findVal(root.T, "display_name")),
            sortName: String(findVal(root.T, "sort_name")),
            description: String(findVal(root.T, "description")),
            creatorName: String(findVal(root.T, "creator_name")),
            icon: String(findVal(root.T, "icon")),
            iconPath: undefined,
            poseList: []
        };
        if (root.L && root.L.U) {
            const poses = Array.isArray(root.L.U) ? root.L.U : [root.L.U];
            instance.poseList = poses.map((poseObj) => {
                const poseData = poseObj.T;
                return {
                    poseName: String(findVal(poseData, "pose_name")),
                    poseDisplayName: String(findVal(poseData, "pose_display_name")),
                    poseDescription: String(findVal(poseData, "pose_description")),
                    poseOrder: Number(findVal(poseData, "sort_order")),
                    icon: String(findVal(poseData, "icon")),
                    iconPath: undefined
                };
            });
        }
        return instance;
    }
}
exports.PosePack = PosePack;
class MixedHelpers {
    static async imgBufferToPng(bufferData) {
        try {
            let dst = new DDSUtil_js_1.DSTResource(bufferData);
            let ddsBuffer = dst.toDDSBuffer();
            let nb = await DDSUtil_js_1.DDSConverter.ddsBufferToPngBuffer(ddsBuffer);
            return nb;
        }
        catch (error) {
            console.log("Failed to export _IMG: " + error);
        }
        return undefined;
    }
}
exports.MixedHelpers = MixedHelpers;
var ThumCacheEntrySize;
(function (ThumCacheEntrySize) {
    ThumCacheEntrySize[ThumCacheEntrySize["SMALL"] = 0] = "SMALL";
    ThumCacheEntrySize[ThumCacheEntrySize["MEDIUM"] = 1] = "MEDIUM";
    ThumCacheEntrySize[ThumCacheEntrySize["LARGE"] = 2] = "LARGE";
    ThumCacheEntrySize[ThumCacheEntrySize["EXTRALARGE"] = 3] = "EXTRALARGE";
    ThumCacheEntrySize[ThumCacheEntrySize["ENORMOUS"] = 4] = "ENORMOUS";
    ThumCacheEntrySize[ThumCacheEntrySize["MAX"] = 5] = "MAX";
})(ThumCacheEntrySize || (ThumCacheEntrySize = {}));
var ThumCacheEntryType;
(function (ThumCacheEntryType) {
    ThumCacheEntryType[ThumCacheEntryType["AVATAR"] = 13] = "AVATAR";
    ThumCacheEntryType[ThumCacheEntryType["BUNDLE_PREVIEW"] = 33] = "BUNDLE_PREVIEW";
    ThumCacheEntryType[ThumCacheEntryType["CEILING_RAIL"] = 29] = "CEILING_RAIL";
    ThumCacheEntryType[ThumCacheEntryType["FENCE"] = 15] = "FENCE";
    ThumCacheEntryType[ThumCacheEntryType["FLOOR"] = 10] = "FLOOR";
    ThumCacheEntryType[ThumCacheEntryType["FLOORTRIM_FRIEZE"] = 18] = "FLOORTRIM_FRIEZE";
    ThumCacheEntryType[ThumCacheEntryType["GALLERY"] = 24] = "GALLERY";
    ThumCacheEntryType[ThumCacheEntryType["LOT_BLUEPRINT"] = 14] = "LOT_BLUEPRINT";
    ThumCacheEntryType[ThumCacheEntryType["LOT_PAINT"] = 30] = "LOT_PAINT";
    ThumCacheEntryType[ThumCacheEntryType["LOT_PREVIEW"] = 20] = "LOT_PREVIEW";
    ThumCacheEntryType[ThumCacheEntryType["MAGALOG"] = 21] = "MAGALOG";
    ThumCacheEntryType[ThumCacheEntryType["MAGALOG_EXCHANGE"] = 27] = "MAGALOG_EXCHANGE";
    ThumCacheEntryType[ThumCacheEntryType["MAGALOG_MASK"] = 22] = "MAGALOG_MASK";
    ThumCacheEntryType[ThumCacheEntryType["MEMORY"] = 23] = "MEMORY";
    ThumCacheEntryType[ThumCacheEntryType["MODEL"] = 12] = "MODEL";
    ThumCacheEntryType[ThumCacheEntryType["OBJECT"] = 0] = "OBJECT";
    ThumCacheEntryType[ThumCacheEntryType["PET_BREED"] = 38] = "PET_BREED";
    ThumCacheEntryType[ThumCacheEntryType["PET_BREED_COAT_PATTERN"] = 39] = "PET_BREED_COAT_PATTERN";
    ThumCacheEntryType[ThumCacheEntryType["PETS1"] = 36] = "PETS1";
    ThumCacheEntryType[ThumCacheEntryType["PETS2"] = 37] = "PETS2";
    ThumCacheEntryType[ThumCacheEntryType["PHOTOBOOTH_FAMILY"] = 25] = "PHOTOBOOTH_FAMILY";
    ThumCacheEntryType[ThumCacheEntryType["RAILING"] = 17] = "RAILING";
    ThumCacheEntryType[ThumCacheEntryType["ROOF_PATTERN"] = 28] = "ROOF_PATTERN";
    ThumCacheEntryType[ThumCacheEntryType["ROOFTRIM"] = 19] = "ROOFTRIM";
    ThumCacheEntryType[ThumCacheEntryType["SIM"] = 1] = "SIM";
    ThumCacheEntryType[ThumCacheEntryType["SIM_BUST"] = 2] = "SIM_BUST";
    ThumCacheEntryType[ThumCacheEntryType["SIM_CAS_PART"] = 4] = "SIM_CAS_PART";
    ThumCacheEntryType[ThumCacheEntryType["SIM_CAS_PRESET"] = 3] = "SIM_CAS_PRESET";
    ThumCacheEntryType[ThumCacheEntryType["SIM_COMPLETE_HEAD"] = 5] = "SIM_COMPLETE_HEAD";
    ThumCacheEntryType[ThumCacheEntryType["SIM_FEATURED_OUTFIT"] = 6] = "SIM_FEATURED_OUTFIT";
    ThumCacheEntryType[ThumCacheEntryType["SIM_FULLBODY"] = 7] = "SIM_FULLBODY";
    ThumCacheEntryType[ThumCacheEntryType["SIM_GALLERY"] = 32] = "SIM_GALLERY";
    ThumCacheEntryType[ThumCacheEntryType["SIM_HOUSEHOLD"] = 9] = "SIM_HOUSEHOLD";
    ThumCacheEntryType[ThumCacheEntryType["SIM_MANNEQUIN_OUTFIT"] = 34] = "SIM_MANNEQUIN_OUTFIT";
    ThumCacheEntryType[ThumCacheEntryType["SIM_PORTRAIT"] = 35] = "SIM_PORTRAIT";
    ThumCacheEntryType[ThumCacheEntryType["SIM_PORTRAIT_CAS"] = 8] = "SIM_PORTRAIT_CAS";
    ThumCacheEntryType[ThumCacheEntryType["SIM_TRAVEL"] = 26] = "SIM_TRAVEL";
    ThumCacheEntryType[ThumCacheEntryType["STAIR"] = 16] = "STAIR";
    ThumCacheEntryType[ThumCacheEntryType["TATTOO"] = 49] = "TATTOO";
    ThumCacheEntryType[ThumCacheEntryType["WALL"] = 11] = "WALL";
    ThumCacheEntryType[ThumCacheEntryType["WORLDMAP_LOT"] = 31] = "WORLDMAP_LOT";
})(ThumCacheEntryType || (ThumCacheEntryType = {}));
class CASPMapper {
    static calcIntToBodyMap() {
        let map = new Map();
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
        //map.set(0x26, BodyType.SKINDETAILS); //ForeheadCrease
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
        map.set(0x71, BodyType.TATTOOS); // TattooHead
        //map.set(0x37, BodyType.FACEPAINT);
        //map.set(0x38, BodyType.SKINDETAILS);
        //map.set(0x39, BodyType.SKINDETAILS); //MouthCrease
        map.set(0x3A, BodyType.ALL);
        map.set(0x49, BodyType.FINGERNAILS);
        map.set(0x4A, BodyType.TOENAILS);
        map.set(0x72, BodyType.WINGS);
        map.set(0x73, BodyType.HEADDECO);
        map.set(0x59, BodyType.SKINDETAILS); // SkinDetailAcnePuberty
        map.set(0x26, BodyType.SKINDETAILS); // SkinDetailCreaseForehead
        map.set(0x39, BodyType.SKINDETAILS); // SkinDetailCreaseMouth
        map.set(0x28, BodyType.SKINDETAILS); // SkinDetailDimpleLeft
        map.set(0x29, BodyType.SKINDETAILS); // SkinDetailDimpleRight
        map.set(0x27, BodyType.SKINDETAILS); // SkinDetailFreckles
        map.set(0x69, BodyType.SKINDETAILS); // SkinDetailHoofColor
        map.set(0x37, BodyType.SKINDETAILS); // SkinDetailMoleCheekLeft
        map.set(0x38, BodyType.SKINDETAILS); // SkinDetailMoleCheekRight
        map.set(0x2b, BodyType.SKINDETAILS); // SkinDetailMoleLipLeft
        map.set(0x2c, BodyType.SKINDETAILS); // SkinDetailMoleLipRight
        map.set(0x3e, BodyType.SKINDETAILS); // SkinDetailNoseColor
        this.NumberToType = map;
    }
    static calcIntToElement() {
        let map = new Map();
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
    }
    static calcIntToTag() {
        let map = new Map();
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
    }
    static calcTypeToArray() {
        let map = new Map();
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
        map.set(BodyType.HEADDECO, "[T1]-[M4]-[B4]");
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
        map.set(BodyType.WINGS, "[T2]-[M7]-[B3]");
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
    }
    static calcPartsWithoutGeom() {
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
    }
    static calcAll() {
        this.calcIntToBodyMap();
        this.calcIntToElement();
        this.calcIntToTag();
        this.calcTypeToArray();
        this.calcPartsWithoutGeom();
    }
    static getArrayFormTag(b) {
        let arr = "";
        if (this.TypeToValueArray.has(b)) {
            let r = this.TypeToValueArray.get(b);
            if (r != undefined) {
                return r;
            }
        }
        return arr;
    }
    static readValues(body_value, flags, result) {
        if (this.NumberToElement.size == 0 || this.NumberToElement.size == 0 || this.NumberToTag.size == 0) {
            this.calcAll();
        }
        //Base Value
        if (this.NumberToType.has(body_value)) {
            result.push(this.NumberToType.get(body_value));
        }
        //Flags
        for (let i = 0; i < flags.length; i++) {
            const element = flags[i];
            let tag = element.a;
            let v = element.b;
            let hasElement = this.NumberToElement.has(tag);
            if (hasElement && this.NumberToTag.has(v)) {
                result.push(this.NumberToTag.get(v));
            }
        }
    }
}
exports.CASPMapper = CASPMapper;
CASPMapper.NumberToType = new Map();
CASPMapper.NumberToElement = new Map();
CASPMapper.NumberToTag = new Map();
CASPMapper.TypeToValueArray = new Map();
CASPMapper.PartsWithoutGeom = new Set();
class COBJMapper {
}
exports.COBJMapper = COBJMapper;
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
    BodyType[BodyType["WINGS"] = 85] = "WINGS";
    BodyType[BodyType["HEADDECO"] = 86] = "HEADDECO";
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
    TagType[TagType["MLOD"] = 20] = "MLOD";
    TagType[TagType["MODL"] = 21] = "MODL";
    TagType[TagType["SMOD"] = 22] = "SMOD";
})(TagType || (exports.TagType = TagType = {}));
class Helper {
    static getBodyTypes(file) {
        let bodyType = new Set();
        let bodyTypePlain = new Set();
        //BodyType
        let bodyTypes = [];
        CASPMapper.readValues(file.bodyType, file.flagList, bodyTypes);
        let bodyTag = CASPMapper.NumberToType.get(file.bodyType);
        if (bodyTag != undefined)
            bodyTypePlain.add(bodyTag);
        for (let index = 0; index < bodyTypes.length; index++) {
            const element = bodyTypes[index];
            let str = CASPMapper.getArrayFormTag(element);
            if (str.length != 0) {
                bodyType.add(str);
            }
        }
        return bodyType;
    }
    static hexStringToHiLo(hexString) {
        if (hexString.length !== 16) {
            throw new Error('Hex string must be 16 characters long');
        }
        const hiHex = hexString.slice(0, 8);
        const loHex = hexString.slice(8, 16);
        const hi = parseInt(hiHex, 16);
        const lo = parseInt(loHex, 16);
        return { hi, lo };
    }
}
exports.Helper = Helper;
class SimsHashes {
    static fnv1_64(strInput, useHighBit = false) {
        let str = strInput.toLowerCase();
        let hash = this.FNV_OFFSET_BASIS_64;
        for (let i = 0; i < str.length; i++) {
            hash = hash * this.FNV_PRIME_64;
            hash = hash ^ BigInt(str.charCodeAt(i));
            hash = hash & this.FNV_MASK_64;
        }
        hash = useHighBit ? this.highBit(hash) : hash;
        return { hex: hash.toString(16), num: hash };
    }
    static fnv1_32(strInput, useHighBit = false) {
        let str = strInput.toLowerCase();
        let hash = this.FNV_OFFSET_BASIS_32;
        for (let i = 0; i < str.length; i++) {
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
            hash = (hash ^ str.charCodeAt(i)) >>> 0;
        }
        useHighBit ? this.highBit(hash) : hash;
        return { hex: hash.toString(16), num: hash };
    }
    static highBit(num) {
        let hexStr = num.toString(16).toUpperCase();
        let firstChar = hexStr.charAt(0);
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
        const modifiedHexStr = firstChar + hexStr.slice(1);
        const modifiedNum = BigInt('0x' + modifiedHexStr);
        return modifiedNum;
    }
    static instanceId(str, useHighBit = false) {
        str = str.toLowerCase();
        return this.fnv1_64(str, useHighBit);
    }
}
exports.SimsHashes = SimsHashes;
SimsHashes.FNV_OFFSET_BASIS_64 = BigInt('0xcbf29ce484222325');
SimsHashes.FNV_PRIME_64 = BigInt('0x100000001b3');
SimsHashes.FNV_MASK_64 = BigInt('0xffffffffffffffff');
SimsHashes.FNV_OFFSET_BASIS_32 = 0x811c9dc5;
SimsHashes.FNV_PRIME_32 = 0x01000193;
SimsHashes.FNV_MASK_32 = 0xffffffff;
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
