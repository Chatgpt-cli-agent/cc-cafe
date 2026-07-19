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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteController = void 0;
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
class NoteController {
    constructor(main) {
        this.filename = "notes.json";
        this.notesMap = new Map();
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
    }
    getNote(ino, filename) {
        let note = this.notesMap.get(ino);
        if (note && note.c) {
            return note.c;
        }
        return "";
    }
    saveNote(ino, filename, content) {
        if (content) {
            this.notesMap.set(ino, { c: content, f: filename });
        }
        else {
            this.notesMap.delete(ino);
        }
        this.saveNoteToFile();
    }
    saveNoteToFile() {
        let modFolder = this.mainApp.settings.s_path_mod;
        if (!modFolder || modFolder.length == 0 || !fs.existsSync(modFolder)) {
            console.error("Mod folder does not exist or is not set in settings.");
            return;
        }
        let notesFilePath = path_1.default.join(modFolder, this.filename);
        let notesData = Array.from(this.notesMap.entries()).map(([ino, data]) => ({ i: ino, c: data.c, f: data.f }));
        fs.writeFileSync(notesFilePath, JSON.stringify(notesData, null, 2), 'utf-8');
        console.log("[NOTES] Notes saved to file:", notesFilePath);
    }
    loadNotesFromFile() {
        let modFolder = this.mainApp.settings.s_path_mod;
        if (!modFolder || modFolder.length == 0 || !fs.existsSync(modFolder)) {
            console.error("Mod folder does not exist or is not set in settings.");
            return;
        }
        let notesFilePath = path_1.default.join(modFolder, this.filename);
        if (fs.existsSync(notesFilePath)) {
            let data = fs.readFileSync(notesFilePath, 'utf-8');
            let notesData = JSON.parse(data);
            notesData.forEach((note) => {
                this.notesMap.set(note.i, { c: note.c, f: note.f });
            });
            console.log("[NOTES] Notes loaded from file:", notesFilePath);
        }
        else {
            console.log("[NOTES] No notes file found, starting with empty notes.");
        }
    }
}
exports.NoteController = NoteController;
