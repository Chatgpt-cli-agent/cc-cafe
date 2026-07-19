"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThumbnailCacheResource = exports.Thumbnail = exports.ThumbnailSimHousehold = exports.ThumbnailDataSim = exports.ThumbnailDataSimCasPart = exports.ThumbnailDataGeneric = exports.ThumbnailData = exports.ThumbnailType = void 0;
/**
 * Hilfsklasse für das binäre Lesen aus einem Byte-Array.
 */
class BinaryReader {
    constructor(data) {
        this.position = 0;
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }
    readByte() { return this.view.getUint8(this.position++); }
    readUInt32() {
        const val = this.view.getUint32(this.position, true);
        this.position += 4;
        return val;
    }
    // Liest eine 64-bit unsigned Integer und gibt sie als 32Bit Hex-String zurück
    readUInt64() {
        const low = this.view.getUint32(this.position, true);
        const high = this.view.getUint32(this.position + 4, true);
        this.position += 8;
        return ((BigInt(high) << 32n) | BigInt(low)).toString(16).padStart(16, '0');
    }
}
/**
 * Entspricht dem TGIBlock in s4pi.
 */
class TGIBlock {
    constructor(br) {
        this.typeID = 0;
        this.groupID = 0;
        this.instanceID = "0";
        this.typeID = br.readUInt32();
        this.groupID = br.readUInt32();
        this.instanceID = br.readUInt64();
    }
    getKey() {
        let tStr = this.typeID.toString(16).padStart(8, '0');
        let gStr = this.groupID.toString(16).padStart(8, '0');
        let iStr = this.instanceID.padStart(16, '0');
        return `${tStr}-${gStr}-${iStr}`;
    }
}
var ThumbnailType;
(function (ThumbnailType) {
    ThumbnailType[ThumbnailType["OBJECT"] = 0] = "OBJECT";
    ThumbnailType[ThumbnailType["SIM"] = 1] = "SIM";
    ThumbnailType[ThumbnailType["SIM_BUST"] = 2] = "SIM_BUST";
    ThumbnailType[ThumbnailType["SIM_CAS_PRESET"] = 3] = "SIM_CAS_PRESET";
    ThumbnailType[ThumbnailType["SIM_CAS_PART"] = 4] = "SIM_CAS_PART";
    ThumbnailType[ThumbnailType["SIM_COMPLETE_HEAD"] = 5] = "SIM_COMPLETE_HEAD";
    ThumbnailType[ThumbnailType["SIM_FEATURED_OUTFIT"] = 6] = "SIM_FEATURED_OUTFIT";
    ThumbnailType[ThumbnailType["SIM_FULLBODY"] = 7] = "SIM_FULLBODY";
    ThumbnailType[ThumbnailType["SIM_PORTRAIT_CAS"] = 8] = "SIM_PORTRAIT_CAS";
    ThumbnailType[ThumbnailType["SIM_HOUSEHOLD"] = 9] = "SIM_HOUSEHOLD";
    ThumbnailType[ThumbnailType["FLOOR"] = 10] = "FLOOR";
    ThumbnailType[ThumbnailType["WALL"] = 11] = "WALL";
    ThumbnailType[ThumbnailType["MODEL"] = 12] = "MODEL";
    ThumbnailType[ThumbnailType["AVATAR"] = 13] = "AVATAR";
    ThumbnailType[ThumbnailType["LOT_BLUEPRINT"] = 14] = "LOT_BLUEPRINT";
    ThumbnailType[ThumbnailType["FENCE"] = 15] = "FENCE";
    ThumbnailType[ThumbnailType["STAIR"] = 16] = "STAIR";
    ThumbnailType[ThumbnailType["RAILING"] = 17] = "RAILING";
    ThumbnailType[ThumbnailType["FLOORTRIM_FRIEZE"] = 18] = "FLOORTRIM_FRIEZE";
    ThumbnailType[ThumbnailType["ROOFTRIM"] = 19] = "ROOFTRIM";
    ThumbnailType[ThumbnailType["LOT_PREVIEW"] = 20] = "LOT_PREVIEW";
    ThumbnailType[ThumbnailType["MAGALOG"] = 21] = "MAGALOG";
    ThumbnailType[ThumbnailType["MAGALOG_MASK"] = 22] = "MAGALOG_MASK";
    ThumbnailType[ThumbnailType["MEMORY"] = 23] = "MEMORY";
    ThumbnailType[ThumbnailType["GALLERY"] = 24] = "GALLERY";
    ThumbnailType[ThumbnailType["PHOTOBOOTH_FAMILY"] = 25] = "PHOTOBOOTH_FAMILY";
    ThumbnailType[ThumbnailType["SIM_TRAVEL"] = 26] = "SIM_TRAVEL";
    ThumbnailType[ThumbnailType["MAGALOG_EXCHANGE"] = 27] = "MAGALOG_EXCHANGE";
    ThumbnailType[ThumbnailType["ROOF_PATTERN"] = 28] = "ROOF_PATTERN";
    ThumbnailType[ThumbnailType["CEILING_RAIL"] = 29] = "CEILING_RAIL";
    ThumbnailType[ThumbnailType["LOT_PAINT"] = 30] = "LOT_PAINT";
    ThumbnailType[ThumbnailType["WORLDMAP_LOT"] = 31] = "WORLDMAP_LOT";
    ThumbnailType[ThumbnailType["SIM_GALLERY"] = 32] = "SIM_GALLERY";
    ThumbnailType[ThumbnailType["BUNDLE_PREVIEW"] = 33] = "BUNDLE_PREVIEW";
    ThumbnailType[ThumbnailType["SIM_MANNEQUIN_OUTFIT"] = 34] = "SIM_MANNEQUIN_OUTFIT";
    ThumbnailType[ThumbnailType["SIM_PORTRAIT"] = 35] = "SIM_PORTRAIT";
})(ThumbnailType || (exports.ThumbnailType = ThumbnailType = {}));
const THUMBNAIL_TYPE_SIM = [
    1, 2, 3, 4, 5, 6, 7, 34, 8, 9, 25, 26, 32, 35
]; // Entspricht thumbnailTypeSim Array
class ThumbnailData {
    constructor(serializationID) {
        this.serializationID = serializationID;
    }
    static factory(br, type) {
        const sid = br.readUInt32();
        if (THUMBNAIL_TYPE_SIM.includes(type)) {
            if (sid === 0x11111111)
                return new ThumbnailDataSimCasPart(sid, br);
            if (sid === 0x00000001)
                return new ThumbnailDataSim(sid, br);
            if (sid === 0x00000002)
                return new ThumbnailSimHousehold(sid, br);
            return new ThumbnailDataGeneric(sid);
        }
        else if (type === ThumbnailType.MODEL || type === ThumbnailType.OBJECT) {
            return new ThumbnailDataModelObject(sid, br);
        }
        return new ThumbnailDataGeneric(sid);
    }
}
exports.ThumbnailData = ThumbnailData;
class ThumbnailDataGeneric extends ThumbnailData {
    constructor(sid) { super(sid); }
}
exports.ThumbnailDataGeneric = ThumbnailDataGeneric;
class ThumbnailDataSimCasPart extends ThumbnailData {
    constructor(sid, br) {
        super(sid);
        this.gender = br.readByte();
    }
}
exports.ThumbnailDataSimCasPart = ThumbnailDataSimCasPart;
class ThumbnailDataSim extends ThumbnailData {
    constructor(sid, br) {
        super(sid);
        this.simID = br.readUInt64();
        this.pose = br.readUInt32();
    }
}
exports.ThumbnailDataSim = ThumbnailDataSim;
class ThumbnailSimHousehold extends ThumbnailData {
    constructor(sid, br) {
        super(sid);
        this.familyID = br.readUInt64();
    }
}
exports.ThumbnailSimHousehold = ThumbnailSimHousehold;
class ModelData {
    constructor(br) {
        this.position = []; // Quaternion: x, y, z, w
        this.modelKey = br.readUInt64();
        for (let i = 0; i < 4; i++) {
            // Quaternion besteht meist aus 4 floats (32-bit)
            const view = new DataView(new ArrayBuffer(4));
            // Hinweis: s4pi Quaternion liest 4 floats
            // Hier vereinfacht als Platzhalter für float-Leselogik:
            this.position.push(0.0);
            br.position += 4;
        }
    }
}
class ThumbnailDataModelObject extends ThumbnailData {
    constructor(sid, br) {
        super(sid);
        this.modelData = [];
        this.additionalInfo = new Map();
        this.flags = sid & 0xFFFF0000;
        const count = sid & 0xFFFF;
        for (let i = 0; i < count; i++) {
            this.modelData.push(new ModelData(br));
        }
        // Flags abarbeiten
        if (this.flags & 0x80000000)
            this.additionalInfo.set(0x80000000, br.readUInt64());
        if (this.flags & 0x01000000)
            this.additionalInfo.set(0x01000000, br.readUInt32());
        if (this.flags & 0x40000000)
            this.additionalInfo.set(0x40000000, br.readUInt32());
        if (this.flags & 0x02000000)
            this.additionalInfo.set(0x02000000, br.readUInt32());
        // hasModelIndex logic
        if ((this.flags & 0x003C0000) !== 0) {
            this.additionalInfo.set(0x003C0000, br.readByte());
        }
    }
}
class Thumbnail {
    constructor(br) {
        this.data = null;
        this.type = br.readUInt32();
        this.size = br.readUInt32();
        this.versionType = br.readUInt32();
        this.resourceID = br.readUInt64();
        this.index = br.readUInt32();
        // ThumbnailDataList logic (Byte count: 0 oder 1)
        const hasData = br.readByte() !== 0;
        if (hasData) {
            this.data = ThumbnailData.factory(br, this.type);
        }
        this.resourceKey = new TGIBlock(br);
        this.isAlias = br.readByte() !== 0;
    }
}
exports.Thumbnail = Thumbnail;
class ThumbnailCacheResource {
    constructor(data) {
        this.thumbnails = [];
        const br = new BinaryReader(data);
        this.version = br.readUInt32();
        this.nextInstanceValue = br.readUInt64();
        let count = br.readUInt32();
        while (br.position < data.length) {
            try {
                this.thumbnails.push(new Thumbnail(br));
            }
            catch (e) {
                break;
            }
        }
    }
}
exports.ThumbnailCacheResource = ThumbnailCacheResource;
