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
exports.DatabaseController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const dbinfo_1 = require("../data/dbinfo");
class DatabaseController {
    constructor(main) {
        this.dbName = "s4mm.sqlite";
        this.needsCaspCobjRecalculation = false;
        this.mainApp = main;
        this.initIPC();
    }
    getKnex() {
        return this.knex;
    }
    initIPC() {
        electron_1.ipcMain.handle("db-init", async (event, data) => {
            if (data.action == "create-database")
                return this.createDatabase();
            if (data.action == "connect-database")
                return this.conntectToDatabase();
            if (data.action == "create-update-tables")
                return this.createUpdateTables();
            throw new Error("No valid action or parameters");
        });
        electron_1.ipcMain.handle("db-files", async (event, data) => {
            if (data.action == "get-by-ino" && data.ino != undefined)
                return await this.getByIno(data.ino, data.options);
            if (data.action == "get-by-fingerprint" && data.fingerprint != undefined)
                return await this.getByFingerprint(data.fingerprint, data.options);
            if (data.action == "inos-to-fingerprints" && data.inos != undefined && Array.isArray(data.inos)) {
                return await this.inosToFingerprints(data.inos);
            }
            throw new Error("No valid action or parameters");
        });
        electron_1.ipcMain.handle('db-entries', async (event, data) => {
            if (data.action == "get-by-ino" && data.ino != undefined) {
                return await this.getEntriesByIno(data.ino, data.options);
            }
            throw new Error("No valid action or parameters");
        });
        electron_1.ipcMain.handle('db-ino', async (event, data) => {
            switch (data.action) {
                case "is-database-empty":
                    return await this.isTableEmpty(data.tableName);
                default:
                    throw new Error("No valid action or parameters");
            }
        });
    }
    async createDatabase() {
        let dbPath = path_1.default.join(this.mainApp.folderStructureController.getFolder("s4mm-data"), this.dbName);
        // Check if db exists
        if (fs.existsSync(dbPath)) {
            console.log("[DB] Database already exists");
            return true;
        }
        // Create db
        let sqlite3 = require('sqlite3').verbose();
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error(err.message);
                    reject(err);
                }
                else {
                    resolve(true);
                }
            });
            db.close();
        });
    }
    conntectToDatabase() {
        let dbPath = path_1.default.join(this.mainApp.folderStructureController.getFolder("s4mm-data"), this.dbName);
        if (!fs.existsSync(dbPath))
            throw new Error("No valid database file");
        this.knex = require("knex")({
            client: "sqlite3",
            connection: {
                filename: dbPath
            },
            useNullAsDefault: true,
        });
        console.log('[DB] Connected to the database.');
        return true;
    }
    async createUpdateTables() {
        let tables = dbinfo_1.DBInfo.structure;
        for (let table of tables) {
            let tableName = table.name;
            let columns = table.columns;
            let foreignKeys = table.foreignKeys;
            let exists = await this.knex.schema.hasTable(tableName);
            if (!exists) {
                // Create table
                await this.knex.schema.createTable(tableName, (table) => {
                    for (let column of columns) {
                        let col = table[column.type](column.name);
                        if (column.unique)
                            col.unique();
                        if (column.notNullable)
                            col.notNullable();
                        if (column.primary)
                            col.primary();
                        if (column.defaultTo !== undefined)
                            col.defaultTo(column.defaultTo);
                    }
                });
                if (foreignKeys) {
                    for (let fk of foreignKeys) {
                        await this.knex.schema.table(tableName, (table) => {
                            table.foreign(fk.column).references(fk.references);
                        });
                    }
                }
            }
            else {
                // Update table
                // Not needed yet, added for future use
                // Update table - Add new columns if they don't exist
                const existingColumns = await this.knex(tableName).columnInfo();
                for (let column of columns) {
                    if (!existingColumns[column.name]) {
                        await this.knex.schema.table(tableName, (table) => {
                            let col = table[column.type](column.name);
                            if (column.unique)
                                col.unique();
                            if (column.notNullable)
                                col.notNullable();
                            if (column.primary)
                                col.primary(); // Primary key addition to existing table might need special handling depending on DB
                            if (column.defaultTo !== undefined)
                                col.defaultTo(column.defaultTo);
                        });
                        console.log(`[DB] Added column '${column.name}' to table '${tableName}'`);
                    }
                }
            }
        }
        return true;
    }
    //Simple requests
    async getByIno(ino, options) {
        if (!this.knex)
            throw new Error("No database connection");
        let sel = options && options.select ? options.select : ["*"];
        sel.push(this.knex.raw('CAST(ino AS TEXT) AS ino')); // Ensure ino is returned as string
        return await this.knex("files").where("ino", ino).select(sel);
    }
    async getByFingerprint(fingerprint, options) {
        if (!this.knex)
            throw new Error("No database connection");
        //Replace ino with this.knex.raw('CAST(ino AS TEXT) AS ino')
        if (options && options.select) {
            options.select = options.select.map((col) => {
                if (col === 'ino') {
                    return this.knex.raw('CAST(ino AS TEXT) AS ino');
                }
                return col;
            });
        }
        return await this.knex("files").where("fingerprint", fingerprint).select(options && options.select ? options.select : "*");
    }
    async getEntriesByIno(ino, options) {
        if (!this.knex)
            throw new Error("No database connection");
        return await this.knex("entries").where("ino", ino).select(options && options.select ? options.select : "*");
    }
    async inosToFingerprints(inos) {
        if (!this.knex)
            throw new Error("No database connection");
        if (!Array.isArray(inos))
            throw new Error("Inos must be an array");
        let results = await this.knex("files").whereIn("ino", inos).select("fingerprint");
        return results.map((result) => result.fingerprint);
    }
    async isTableEmpty(tableName) {
        let knex = this.getKnex();
        if (!knex)
            throw new Error("No database connection");
        try {
            const result = await knex(tableName).count('* as count');
            return result[0].count === 0;
        }
        catch (error) {
            console.error('Error checking if database is empty:', error);
            return false;
        }
    }
}
exports.DatabaseController = DatabaseController;
