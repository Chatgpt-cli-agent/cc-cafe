"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderArchive = exports.FolderArchiveUtil = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class FolderArchiveUtil {
    static serializeTreeNode(node, buffer) {
        // Write folder name length (2 bytes) and name
        const nameBytes = Buffer.from(node.name, 'utf-8');
        buffer.writeUInt16LE(nameBytes.length); // Use 2 bytes for length
        buffer.writeString(node.name);
        // Write number of files
        buffer.writeUInt16LE(node.files.length);
        // Serialize files
        for (const file of node.files) {
            const fileNameBytes = Buffer.from(file.name, 'utf-8');
            buffer.writeUInt16LE(fileNameBytes.length); // Use 2 bytes for length
            buffer.writeString(file.name);
            buffer.writeUInt32LE(file.fingerprint);
            buffer.writeUInt8(file.type);
            // Pack booleans into a single byte
            let flags = 0;
            if (file.isActive)
                flags |= 1 << 0;
            if (file.isCASP)
                flags |= 1 << 1;
            if (file.isCOBJ)
                flags |= 1 << 2;
            if (file.isCLIP)
                flags |= 1 << 3;
            buffer.writeUInt8(flags);
        }
        // Write number of subfolders
        buffer.writeUInt16LE(node.subfolders.size);
        // Serialize subfolders
        for (const subfolder of node.subfolders.values()) {
            this.serializeTreeNode(subfolder, buffer);
        }
    }
    static createBinaryFile(root, version) {
        const buffer = new DynamicBuffer();
        // Write header
        const magic = 'S4MM-FSF';
        buffer.writeString(magic);
        buffer.writeUInt16LE(version);
        // Serialize the tree
        this.serializeTreeNode(root, buffer);
        // Return the final buffer
        return buffer.getBuffer();
    }
    static deserializeTreeNode(buffer, offset) {
        // Read folder name length (2 bytes) and name
        const nameLength = buffer.readUInt16LE(offset.value); // Use 2 bytes for length
        offset.value += 2;
        const name = buffer.toString("utf-8", offset.value, offset.value + nameLength);
        offset.value += nameLength;
        // Read number of files
        const fileCount = buffer.readUInt16LE(offset.value);
        offset.value += 2;
        const files = [];
        for (let i = 0; i < fileCount; i++) {
            // Read file name length (2 bytes) and name
            const fileNameLength = buffer.readUInt16LE(offset.value); // Use 2 bytes for length
            offset.value += 2;
            const fileName = buffer.toString("utf-8", offset.value, offset.value + fileNameLength);
            offset.value += fileNameLength;
            // Read fingerprint
            const fingerprint = buffer.readUInt32LE(offset.value);
            offset.value += 4;
            // Read type
            const type = buffer.readUInt8(offset.value);
            offset.value += 1;
            // Read flags (booleans packed into a byte)
            const flags = buffer.readUInt8(offset.value);
            offset.value += 1;
            const isActive = (flags & (1 << 0)) !== 0;
            const isCASP = (flags & (1 << 1)) !== 0;
            const isCOBJ = (flags & (1 << 2)) !== 0;
            const isCLIP = (flags & (1 << 3)) !== 0;
            files.push({ name: fileName, fingerprint, type, isActive, isCASP, isCOBJ, isCLIP });
        }
        // Read number of subfolders
        const subfolderCount = buffer.readUInt16LE(offset.value);
        offset.value += 2;
        const subfolders = new Map();
        for (let i = 0; i < subfolderCount; i++) {
            const subfolder = this.deserializeTreeNode(buffer, offset);
            subfolders.set(subfolder.name, subfolder);
        }
        return { name, files, subfolders };
    }
    static readBinaryFile(filePath) {
        const buffer = fs_1.default.readFileSync(filePath);
        let offset = { value: 0 };
        // Read and validate header
        const magic = buffer.toString("utf-8", offset.value, offset.value + 8);
        offset.value += 8;
        if (magic !== "S4MM-FSF") {
            throw new Error("Invalid file format");
        }
        // Read version
        const version = buffer.readUInt16LE(offset.value);
        offset.value += 2;
        console.log(`File version: ${version}`);
        if (version !== 1) {
            throw new Error("Unsupported file version");
        }
        // Deserialize the tree
        return this.deserializeTreeNode(buffer, offset);
    }
}
exports.FolderArchiveUtil = FolderArchiveUtil;
class FolderArchive {
    constructor() {
        this.version = 1;
        this.folderTree = null;
        this.filesCount = 0;
        this.totalSize = 0;
        this.subFoldersCount = 0;
    }
    addDatabaseBatch(files, modfolderPath) {
        files.forEach((file) => {
            //Folder
            let folderpath = this.harmonizePath(this.shortenPath(file.path, modfolderPath));
            let folderNode = this.getTreeNodeByPath(folderpath);
            //File
            let nameWithoutExtension = path_1.default.basename(file.name).split(".").slice(0, -1).join(".");
            let fileObj = {
                name: nameWithoutExtension,
                fingerprint: file.fingerprint >= 0 ? file.fingerprint : 0,
                type: file.type,
                isActive: file.name.toLowerCase().endsWith("off"),
                isCASP: file.casp == 1,
                isCOBJ: file.cobj == 1,
                isCLIP: file.clip == 1,
            };
            if (folderNode != null) {
                folderNode.files.push(fileObj);
                this.filesCount++;
                this.totalSize += file.size || 0;
                //console.log("Added file to folder: "+folderNode.name+" "+fileObj.name+" "+folderpath);
            }
        });
    }
    writeAsArchiveFile(filepath) {
        if (this.folderTree == null)
            throw new Error("No folder tree found");
        let buffer = FolderArchiveUtil.createBinaryFile(this.folderTree, this.version);
        fs_1.default.writeFileSync(filepath, buffer);
    }
    readFromArchiveFile(filepath) {
        this.folderTree = FolderArchiveUtil.readBinaryFile(filepath);
    }
    getTreeNodeByPath(folderpath) {
        let parts = folderpath.split("/");
        if (parts.length == 0)
            return null;
        if (this.folderTree == null) {
            this.folderTree = { name: parts[0], subfolders: new Map(), files: [] };
        }
        return this.getTreeNodeByPathRecursive(parts, this.folderTree);
    }
    getTreeNodeByPathRecursive(parts, node) {
        if (parts.length == 1) {
            if (node.subfolders.has(parts[0])) {
                return node.subfolders.get(parts[0]);
            }
            else {
                let newNode = { name: parts[0], subfolders: new Map(), files: [] };
                node.subfolders.set(parts[0], newNode);
                this.subFoldersCount++;
                return newNode;
            }
        }
        else if (parts.length > 1) {
            let subfolderName = parts.shift();
            if (node.subfolders.has(subfolderName)) {
                return this.getTreeNodeByPathRecursive(parts, node.subfolders.get(subfolderName));
            }
            else {
                let newNode = { name: subfolderName, subfolders: new Map(), files: [] };
                node.subfolders.set(subfolderName, newNode);
                this.subFoldersCount++;
                return this.getTreeNodeByPathRecursive(parts, newNode);
            }
        }
        else {
            return node;
        }
    }
    shortenPath(folderpath, modfolderPath) {
        if (!modfolderPath || !folderpath.startsWith(modfolderPath))
            return folderpath;
        let mfsp = modfolderPath.split(path_1.default.sep);
        mfsp.pop();
        let mf = mfsp.join(path_1.default.sep);
        return folderpath.substring(mf.length + 1, folderpath.length);
    }
    harmonizePath(folderpath) {
        // if folder is split by \ and / replace all with /
        if (path_1.default.sep == "\\" && folderpath.includes("\\")) {
            folderpath = folderpath.replace(/\\/g, "/");
        }
        return folderpath;
    }
}
exports.FolderArchive = FolderArchive;
/*export class FolderArchiveOLD {
    
    version : number = 1;
    folderPaths : Map<string,number> = new Map<string,number>();
    files : FolderArchiveFile[] = [];

    constructor(){

    }

    addDatabaseBatch(files:any[],modfolderPath?:string):void{
        files.forEach((file) => {
            
            //Folder
            let folderpath = this.harmonizePath(this.shortenPath(file.path,modfolderPath));
            let folderIndex = this.folderPaths.get(folderpath);
            if(folderIndex==undefined || folderIndex==null){
                folderIndex = this.folderPaths.size;
                this.folderPaths.set(folderpath,folderIndex);
            }

            //File
            let nameWithoutExtension = path.basename(file.name).split(".").slice(0, -1).join(".");
            let fileObj : FolderArchiveFile = {
                name: nameWithoutExtension,
                fingerprint: file.fingerprint,
                type: file.type,
                isActive: file.name.toLowerCase().endsWith("off"),
                isCASP: file.casp == 1,
                isCOBJ: file.cobj == 1,
                isCLIP: file.clip == 1,
                folderIndex: folderIndex
            };
            this.files.push(fileObj);
        });
    }

    writeAsArchiveFile(filepath:string):void{

    }

    readFromArchiveFile(filepath:string):void{

    }

    private shortenPath(folderpath:string,modfolderPath?:string):string{
        if(!modfolderPath || !folderpath.startsWith(modfolderPath)) return folderpath;
        let mfsp = modfolderPath.split(path.sep);
        mfsp.pop();
        let mf = mfsp.join(path.sep);
        return folderpath.substring(mf.length+1,folderpath.length);
    }

    private harmonizePath(folderpath:string):string{
        // if folder is split by \ and / replace all with /
        if(path.sep=="\\" && folderpath.includes("\\")){
            folderpath = folderpath.replace(/\\/g, "/");
        }
        return folderpath;
    }

    public mapToTree(folderMap: Map<string, number>): TreeNode {
        const root: TreeNode = { children: new Map() };
        folderMap.forEach((id, path) => {
            const parts = path.split("/");
            let currentNode = root;
    
            parts.forEach((part, index) => {
                if (!currentNode.children.has(part)) {
                    currentNode.children.set(part, { children: new Map() });
                }
                currentNode = currentNode.children.get(part)!;
                if (index === parts.length - 1) {
                    currentNode.id = id;
                }
            });
        });
        return root;
    }

}*/
class DynamicBuffer {
    constructor(initialChunkSize = 1024) {
        this.chunks = [];
        this.offset = 0;
        this.chunkSize = initialChunkSize;
        this.currentChunk = Buffer.alloc(this.chunkSize);
    }
    allocateNewChunk() {
        this.chunks.push(this.currentChunk.slice(0, this.offset));
        this.currentChunk = Buffer.alloc(this.chunkSize);
        this.offset = 0;
    }
    writeUInt8(value) {
        if (this.offset + 1 > this.chunkSize)
            this.allocateNewChunk();
        this.currentChunk.writeUInt8(value, this.offset);
        this.offset += 1;
    }
    writeUInt16LE(value) {
        if (this.offset + 2 > this.chunkSize)
            this.allocateNewChunk();
        this.currentChunk.writeUInt16LE(value, this.offset);
        this.offset += 2;
    }
    writeUInt32LE(value) {
        if (this.offset + 4 > this.chunkSize)
            this.allocateNewChunk();
        this.currentChunk.writeUInt32LE(value, this.offset);
        this.offset += 4;
    }
    writeString(value) {
        const stringBytes = Buffer.from(value, 'utf-8');
        if (this.offset + stringBytes.length > this.chunkSize)
            this.allocateNewChunk();
        stringBytes.copy(this.currentChunk, this.offset);
        this.offset += stringBytes.length;
    }
    getBuffer() {
        this.chunks.push(this.currentChunk.slice(0, this.offset));
        return Buffer.concat(this.chunks);
    }
}
