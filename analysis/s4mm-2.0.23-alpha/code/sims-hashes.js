const FNV_OFFSET_BASIS_64 = BigInt('0xcbf29ce484222325');
const FNV_PRIME_64 = BigInt('0x100000001b3');
const FNV_MASK_64 = BigInt('0xffffffffffffffff');

const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;
const FNV_MASK_32 = 0xffffffff;

const FNV_OFFSET_BASIS_24 = 0x811c9d;
const FNV_PRIME_24 = 0x010001;
const FNV_MASK_24 = 0xffffff;

function fnv1_64(str,useHighBit=false) {
    let hash = FNV_OFFSET_BASIS_64;
    for (let i = 0; i < str.length; i++) {
        hash = hash * FNV_PRIME_64;
        hash = hash ^ BigInt(str.charCodeAt(i));
        hash = hash & FNV_MASK_64; // Ensure the hash stays within 64 bits
    }
    hash = useHighBit ? highBit(hash):hash;
    return {hex: hash.toString(16), num: hash};
}

function fnv1_32(str,useHighBit=false) {
    let hash = FNV_OFFSET_BASIS_32;
    for (let i = 0; i < str.length; i++) {
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        hash = (hash ^ str.charCodeAt(i)) >>> 0; // Ensure XOR stays within 32 bits
    }
    hash = useHighBit ? highBit(hash):hash;
    return {hex: hash.toString(16), num: hash};
}

function fnv1_24(str,useHighBit=false) {
    let hash = FNV_OFFSET_BASIS_24;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * FNV_PRIME_24) & FNV_MASK_24;
        hash = (hash ^ str.charCodeAt(i)) & FNV_MASK_24;
    }
    hash = useHighBit ? highBit(hash):hash;
    return {hex: hash.toString(16), num: hash};
}

function highBit(num) {
    let hexStr = num.toString(16).toUpperCase();
    let firstChar = hexStr.charAt(0);

    switch (firstChar) {
        case '0': firstChar = '8'; break;
        case '1': firstChar = '9'; break;
        case '2': firstChar = 'A'; break;
        case '3': firstChar = 'B'; break;
        case '4': firstChar = 'C'; break;
        case '5': firstChar = 'D'; break;
        case '6': firstChar = 'E'; break;
        case '7': firstChar = 'F'; break;
    }

    const modifiedHexStr = firstChar + hexStr.slice(1);
    const modifiedNum = BigInt('0x' + modifiedHexStr);
    return  modifiedNum ;
}

function instanceId(str,useHighBit=false) {
    str = str.toLowerCase();
   return fnv1_64(str,useHighBit);
}

module.exports = { fnv1_64, fnv1_32, fnv1_24, instanceId };