"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBInfo = void 0;
class DBInfo {
}
exports.DBInfo = DBInfo;
DBInfo.structure = [
    {
        "name": "Files",
        "columns": [
            { "name": "ino", "type": "bigInteger", "unique": true, "notNullable": true, "primary": true },
            { "name": "path", "type": "text" },
            { "name": "mfolder", "type": "text" },
            { "name": "name", "type": "text" },
            { "name": "type", "type": "integer" },
            { "name": "minor", "type": "integer", "defaultTo": -1 },
            { "name": "major", "type": "integer", "defaultTo": -1 },
            { "name": "casp", "type": "boolean" },
            { "name": "cobj", "type": "boolean" },
            { "name": "clip", "type": "boolean" },
            { "name": "smod", "type": "boolean", "defaultTo": false },
            { "name": "xml_types", "type": "text", "defaultTo": "" },
            { "name": "categories", "type": "text" },
            { "name": "image", "type": "text" },
            { "name": "image_source", "type": "text" },
            { "name": "merged", "type": "boolean" },
            { "name": "recolor", "type": "boolean" },
            { "name": "cf_checked", "type": "boolean" },
            { "name": "cf_id", "type": "integer" },
            { "name": "cf_file_id", "type": "integer" },
            { "name": "fingerprint", "type": "integer" },
            { "name": "mtime", "type": "integer" },
            { "name": "size", "type": "integer" },
            { "name": "last_check", "type": "integer" },
            { "name": "checked", "type": "integer", "defaultTo": 0 },
            { "name": "dd_id", "type": "integer" },
        ],
        "foreignKeys": [
            { "column": "cf_id", "references": "CurseForge.id" }
        ]
    },
    {
        "name": "CommunityFiles",
        "columns": [
            { "name": "fingerprint", "type": "integer", "unique": true, "notNullable": true, "primary": true },
            { "name": "main_name", "type": "text" },
            { "name": "checked_name", "type": "text" },
            { "name": "has_thumbnail", "type": "boolean" },
            { "name": "uploaded_thumbnail", "type": "boolean" },
            { "name": "last_check", "type": "integer" }
        ]
    },
    {
        "name": "Entries",
        "columns": [
            { "name": "id", "type": "increments" },
            { "name": "ino", "type": "bigInteger", "notNullable": true },
            { "name": "type", "type": "integer" },
            { "name": "group", "type": "integer" },
            { "name": "instance", "type": "bigInteger" },
            { "name": "instancehex", "type": "text" },
            { "name": "game", "type": "boolean" },
            { "name": "address", "type": "text" },
        ],
        "foreignKeys": [
            { "column": "ino", "references": "Files.ino" }
        ]
    },
    {
        "name": "CasPart",
        "columns": [
            { "name": "id", "type": "increments" },
            { "name": "ino", "type": "bigInteger", "notNullable": true },
            { "name": "propId", "type": "integer" },
            { "name": "instance", "type": "text" },
            { "name": "swatch", "type": "text" },
            { "name": "age", "type": "text" },
            { "name": "gender", "type": "text" },
            { "name": "body", "type": "text" },
            { "name": "packId", "type": "integer" },
            { "name": "species", "type": "integer" },
            { "name": "primSort", "type": "float" },
            { "name": "sortLayer", "type": "integer" },
            { "name": "casFlags", "type": "text" },
        ],
        "foreignKeys": [
            { "column": "ino", "references": "Files.ino" }
        ]
    },
    {
        "name": "CasCombined",
        "columns": [
            { "name": "id", "type": "increments" },
            { "name": "ino", "type": "bigInteger", "notNullable": true },
            { "name": "tgilist", "type": "text" },
        ]
    },
    {
        "name": "CobjCom",
        "columns": [
            { "name": "ino", "type": "bigInteger", "unique": true, "notNullable": true, "primary": true },
            { "name": "pmax", "type": "integer" },
            { "name": "pmin", "type": "integer" },
            { "name": "bb", "type": "text" },
            { "name": "pat", "type": "text" },
            { "name": "bu", "type": "text" },
            { "name": "ot", "type": "text" }
        ]
    },
    {
        "name": "CurseForge",
        "columns": [
            { "name": "id", "type": "increments", "primary": true },
            { "name": "name", "type": "text" },
            { "name": "primaryAuthor", "type": "text" },
            { "name": "categories", "type": "text" },
            { "name": "link", "type": "text" },
            { "name": "thumbnail", "type": "text" },
            { "name": "mainFileId", "type": "integer" },
            { "name": "complexity", "type": "integer", "defaultTo": 0 },
            { "name": "manual", "type": "integer", "defaultTo": 0 },
            { "name": "isSupported", "type": "integer", "defaultTo": 0 },
            { "name": "latestFingerprints", "type": "text", "defaultTo": "" },
        ]
    },
    {
        "name": "CommunitySpecificReportedFiles",
        "columns": [
            { "name": "id", "type": "increments", "primary": true },
            { "name": "game_version", "type": "integer" },
            { "name": "fingerprint", "type": "integer" },
            { "name": "report_type", "type": "text" },
            { "name": "report_date", "type": "integer" }
        ]
    },
    {
        "name": "KeyData",
        "columns": [
            { "name": "id", "type": "increments", "primary": true },
            { "name": "key", "type": "text", "unique": true, "notNullable": true },
            { "name": "value", "type": "text" }
        ]
    },
    {
        "name": "GameIds",
        "columns": [
            { "name": "id", "type": "increments", "primary": true },
            { "name": "ino", "type": "text" },
            { "name": "address", "type": "text" },
            { "name": "instance", "type": "text" },
            { "name": "type", "type": "integer" },
            { "name": "group", "type": "integer" }
        ]
    },
    {
        "name": "GameFiles",
        "columns": [
            { "name": "ino", "type": "text", "primary": true },
            { "name": "path", "type": "text" }
        ]
    },
    {
        "name": "Thumbnails",
        "columns": [
            { "name": "id", "type": "increments", "primary": true },
            { "name": "ino", "type": "bigInteger", "notNullable": true },
            { "name": "iik", "type": "text", "unique": true, "notNullable": true },
            { "name": "instance", "type": "text" },
            { "name": "type", "type": "integer" },
            { "name": "hash", "type": "text" },
            { "name": "image", "type": "text" },
        ]
    },
    {
        "name": "Categories",
        "columns": [
            { "name": "id", "type": "increments", "primary": true },
            { "name": "name", "type": "text", "notNullable": true },
            { "name": "order", "type": "integer", "defaultTo": 0 },
            { "name": "autotag", "type": "boolean", "defaultTo": false },
            { "name": "onpreview", "type": "boolean", "defaultTo": false },
            { "name": "tags", "type": "text", "defaultTo": "" },
            { "name": "ntags", "type": "text", "defaultTo": "" },
            { "name": "special", "type": "integer", "defaultTo": 0 }, // 0 - None | 1 - Save File Custom Category
            { "name": "data", "type": "text", "defaultTo": "" }
        ]
    },
    {
        "name": "DirectDownloads",
        "columns": [
            { "name": "id", "type": "increments", "primary": true },
            { "name": "url", "type": "text" },
            { "name": "name", "type": "text" },
            { "name": "added_date", "type": "integer" },
            { "name": "status", "type": "integer", "defaultTo": 0 } // 0 - Pending | 1 - Downloading | 2 - Completed | 3 - Failed || 4 - Blocked
        ]
    }
];
