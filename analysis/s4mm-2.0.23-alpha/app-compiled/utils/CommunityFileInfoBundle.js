"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityFileInfoBundle = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const Helper_1 = require("./Helper");
const imageProcessing_1 = require("./imageProcessing");
const BundleBufferUtil_1 = require("./BundleBufferUtil");
class CommunityFileInfoBundle {
    static async createBundle(fingerprint) {
        console.log("Creating community file info bundle for fingerprint:", fingerprint);
        //Basic File Data
        let fileData = await electron_1.ipcRenderer.invoke("db-files", { action: "get-by-fingerprint", fingerprint: fingerprint, options: {
                select: ["ino", "name", "path", "image", "image_source", "type", "cf_id", "cf_file_id", "size", "fingerprint"]
            } });
        if (!fileData || fileData.length === 0) {
            return null;
        }
        let file = fileData[0];
        //Entries
        let entries = [];
        /*
        //Skip this for now, as we are not using entries in the bundle
        if(file.type==1 && file.ino){//Only Package Files
            let rawEntries = await ipcRenderer.invoke("db-entries",{action:"get-by-ino",ino:file.ino});
            if(rawEntries && rawEntries.length > 0){
                entries = rawEntries.map((entry:any) => entry.address);
            }
        }
        */
        //Hash File
        let filepath = path_1.default.join(file.path, file.name);
        let hash = "-";
        try {
            hash = await Helper_1.Helper.hashFile(filepath);
        }
        catch (error) {
            console.error("Error hashing file: ", error);
            return null;
        }
        //Get file name
        let filename = file.name;
        let ext = path_1.default.extname(filename);
        let namewithoutext = path_1.default.basename(filename, ext);
        //obj.fileinfo.name = namewithoutext;
        //Prepare thumbnail#
        let thumbnailBuffer = null;
        if (file.image && fs_1.default.existsSync(file.image)) {
            let thumbnail = file.image;
            //let thumbnailpath = path.join(tmpFolder, hash+".webp");
            try {
                thumbnailBuffer = await imageProcessing_1.ImageProcessing.convertAndCompressImageToWebpBuffer(thumbnail, { quality: 80, effort: 6 });
            }
            catch (error) {
                console.error("Error converting image to WebP: ", error);
                return null;
            }
        }
        //Bundle Info
        let bundleInfo = {
            fileinfo: {
                fingerprint: fingerprint, //String
                hash: hash, //String
                filetype: file.type, //Number
                name: namewithoutext, //String
                size: file.size //Number
            },
            thumbnail: {
                source: file.image_source, //number
                thumbnailBuffer: thumbnailBuffer //Buffer or null
            },
            entries: entries // Array of strings
        };
        let bundleBuffer = BundleBufferUtil_1.BundleBufferUtil.toBuffer(bundleInfo);
        console.log("Bundle created successfully for fingerprint:", fingerprint);
        return {
            bundleBuffer: bundleBuffer,
            fingerprint: fingerprint
        };
    }
    static async createThumbnailBundle(fingerprint, image_source, image) {
        let thumbnailBuffer = null;
        if (image && fs_1.default.existsSync(image)) {
            let thumbnail = image;
            //let thumbnailpath = path.join(tmpFolder, hash+".webp");
            try {
                thumbnailBuffer = await imageProcessing_1.ImageProcessing.convertAndCompressImageToWebpBuffer(thumbnail, { quality: 80, effort: 6 });
            }
            catch (error) {
                console.error("Error converting image to WebP: ", error);
                return null;
            }
        }
        let bundleInfo = {
            type: "extend-thumbnail",
            thumbnail: {
                source: image_source,
                thumbnailBuffer: thumbnailBuffer
            },
            fingerprint: fingerprint
        };
        let bundleBuffer = BundleBufferUtil_1.BundleBufferUtil.toBuffer(bundleInfo);
        console.log("Bundle created successfully for fingerprint:", fingerprint);
        return {
            bundleBuffer: bundleBuffer,
            fingerprint: fingerprint
        };
    }
}
exports.CommunityFileInfoBundle = CommunityFileInfoBundle;
