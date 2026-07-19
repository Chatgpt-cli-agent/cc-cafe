"use strict";
exports.__esModule = true;
exports.BodyType = exports.CASPMapper = exports.ByteBuffer = exports.SimsPatterns = exports.TrayFiles = void 0;
var fs = require('fs');
var leb = require('leb128');
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
    TrayFiles.prototype.readFile = function () {
        var readBuffer = fs.readFileSync(this.file);
        this.buffer = new ByteBuffer(readBuffer);
        this.buffer.pos = 28 - 1;
        //Housename
        var hhnLength = this.buffer.readUnsignedLeb128();
        var nameBuffer = this.buffer.getSection(hhnLength);
        this.householdname = String.fromCharCode.apply(String, Array.from(nameBuffer));
        this.buffer.pos += 4;
        //CC Files
        var lastFound = 40;
        while (this.buffer.pos < this.buffer.max) {
            var pos = this.buffer.pos;
            var b1 = this.buffer.array[pos - 6] == 0x48;
            var b2 = this.buffer.array[pos - 5] == 0x01;
            var b3 = this.buffer.array[pos - 4] == 0x50;
            var b4 = this.buffer.array[pos - 3] == 0xFF;
            var b5 = this.buffer.array[pos - 2] == 0xFF;
            var b6 = this.buffer.array[pos - 1] == 0xFF;
            var b7 = this.buffer.array[pos] == 0xFF;
            if (b1 && b2 && b3 && b4 && b5 && b6 && b7) {
                var items = this.searchBackwards(this.buffer, (pos - 6), lastFound);
                if (items) {
                    //Handle Items
                    for (var index = 0; index < items.length; index++) {
                        var element = items[index];
                        this.instanceMap.set(element.instance, element);
                    }
                }
                lastFound = pos;
                this.buffer.pos = pos + 1;
            }
            else {
                this.buffer.pos++;
            }
        }
    };
    TrayFiles.prototype.searchBackwards = function (buf, startpos, lastPos) {
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
    TrayFiles.prototype.searchValues = function (set_cc, set_game) {
        var readBuffer = fs.readFileSync(this.file);
        this.buffer = new ByteBuffer(readBuffer);
        var result = [];
        while (this.buffer.pos + 7 < this.buffer.max) {
            //let value = this.buffer.getLongStay();
            var valueStr = this.buffer.getLongString();
            var obj = {
                instance: valueStr,
                positon: ("0x" + this.buffer.pos.toString(16)),
                positonNumber: this.buffer.pos,
                origin: "unknown"
            };
            if (valueStr && set_cc.has(valueStr)) {
                obj.origin = "CC";
                result.push(obj);
                this.buffer.pos = this.buffer.pos + 1;
            }
            else if (valueStr && set_game.has(valueStr)) {
                obj.origin = "Game";
                result.push(obj);
                this.buffer.pos = this.buffer.pos + 1;
            }
            else {
                this.buffer.pos = this.buffer.pos + 1;
            }
        }
        return result;
    };
    TrayFiles.searchValuesInBuffer = function (set_cc, set_game, readBuffer) {
        var buffer = new ByteBuffer(readBuffer);
        var result = [];
        while (buffer.pos + 7 < buffer.max) {
            var valueStr = buffer.getLongString();
            var obj = {
                instance: valueStr,
                positon: ("0x" + buffer.pos.toString(16)),
                positonNumber: buffer.pos,
                origin: "unknown"
            };
            if (valueStr && set_cc.has(valueStr)) {
                obj.origin = "CC";
                result.push(obj);
                buffer.pos = buffer.pos + 1;
            }
            else if (valueStr && set_game.has(valueStr)) {
                obj.origin = "Game";
                result.push(obj);
                buffer.pos = buffer.pos + 1;
            }
            else {
                buffer.pos = buffer.pos + 1;
            }
        }
        return result;
    };
    TrayFiles.prototype.searchSimsCC = function () {
        if (!this.buffer)
            this.prepareBuffer();
        if (!this.buffer)
            return;
        //Get Sims
        this.buffer.pos = 0;
        var sims = SimsPatterns.simNamePattern(this.buffer);
        //Get Sims CC
        for (var index = 0; index < sims.length; index++) {
            var sim = sims[index];
            var startOffest = sim.firstName.length + sim.lastName.length + 12;
            var instances = SimsPatterns.casCCPattern(this.buffer, sim.start + startOffest, sim.end);
            sim.instances = instances;
        }
        return sims;
    };
    return TrayFiles;
}());
exports.TrayFiles = TrayFiles;
var SimsPatterns = /** @class */ (function () {
    function SimsPatterns() {
    }
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
                firstName = String.fromCharCode.apply(String, Array.from(nameBuffer));
                emptyByte = buf.getByte();
                lnLength = buf.getByte();
                if (lnLength != 1 && lnLength > 0) {
                    var lastNameBuffer = buf.getSection(lnLength);
                    lastName = String.fromCharCode.apply(String, Array.from(lastNameBuffer));
                }
            }
            if (firstName.length > 0 && lastName.length > 0 && emptyByte == 0x32) {
                var obj = {
                    firstName: firstName,
                    lastName: lastName,
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
    SimsPatterns.casCCPattern = function (buf, start, end) {
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
                var items = this.searchCCInstanceBackwards(buf, (pos - 6), lastFound);
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
    SimsPatterns.searchCCInstanceBackwards = function (buf, startpos, lastPos) {
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
            return this.byteArrayToLong(arr);
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
            return this.byteArrayToLong(arr);
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
    //8 Bytes
    ByteBuffer.prototype.getLong = function () {
        if (this.pos + 7 < this.max) {
            var arr = this.array.slice(this.pos, this.pos + 8);
            this.pos = this.pos + 8;
            return this.byteArrayToLong(arr);
        }
        else {
            return -1;
        }
    };
    ByteBuffer.prototype.getLongStay = function () {
        if (this.pos + 7 < this.max) {
            var arr = this.array.slice(this.pos, this.pos + 8);
            var buf = Buffer.from(arr);
            var nu = Number(buf.readBigUInt64LE());
            return nu;
        }
        else {
            return -1;
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
    return ByteBuffer;
}());
exports.ByteBuffer = ByteBuffer;
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
        map.set(0x25, BodyType.FACEPAINT);
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
})(BodyType = exports.BodyType || (exports.BodyType = {}));
