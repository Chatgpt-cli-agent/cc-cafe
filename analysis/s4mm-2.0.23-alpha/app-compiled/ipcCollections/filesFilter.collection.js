"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesFilterCollection = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const IPCExtras_1 = require("../utils/IPCExtras");
class FilesFilterCollection {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        //Old IPCs
        electron_1.ipcMain.on("file-getFolderItems-HomeTab", async (event, args) => {
            //console.log("file-getFolderItems-HomeTab",args);
            this.overviewMainFolder(args.filter).then((result) => {
                IPCExtras_1.IPCExtras.send(event, "file-getFolderItems-HomeTab", { files: result });
            }).catch((err) => {
                console.error("Error in file-getFolderItems-HomeTab", err);
            });
        });
        electron_1.ipcMain.on("file-getFolderItems-FolderTab", async (event, data) => {
            //console.log("[file-getFolderItems-FolderTab]" + JSON.stringify(data));
            let options = {};
            if (data.deep && data.path && data.path.length > 0) {
                options.partPath = data.path;
            }
            else if (!data.deep && data.path && data.path.length > 0) {
                options.exactPath = data.path;
            }
            this.runFilter(data.filter, options).then((result) => {
                IPCExtras_1.IPCExtras.send(event, "file-getFolderItems-FolderTab", { "requestId": data.requestId, "files": result });
            });
        });
        electron_1.ipcMain.handle("filter-run", async (event, data) => {
            switch (data.action) {
                case "only-inos":
                    return this.filterOnlyInos(data.filter);
                default:
                    throw new Error("Unknown action " + data.action);
            }
        });
    }
    async overviewMainFolder(filter) {
        let time = Date.now();
        /*let options = {
            orderBy:"Files.mfolder"
        };*/
        let result = await this.runFilter(filter, undefined);
        if (!result || result.length == 0)
            return [];
        let modFolderPath = this.mainApp.settings.s_path_mod;
        let modFolderParts = modFolderPath.split(path_1.default.sep).length;
        let mFolderMap = new Map();
        result.forEach((file) => {
            let obj = mFolderMap.get(file.mfolder);
            if (!obj) {
                obj = {
                    name: file.mfolder,
                    files: [],
                    path: undefined,
                    isUnsorted: !file.mfolder || file.mfolder.length == 0,
                };
                mFolderMap.set(file.mfolder, obj);
            }
            obj.files.push(file);
            if (!obj.path || obj.path.length == 0) {
                let fileParts = file.path.split(path_1.default.sep);
                let mFolderPath = fileParts.slice(0, modFolderParts + 1).join(path_1.default.sep);
                obj.path = mFolderPath;
            }
            mFolderMap.set(file.mfolder, obj);
        });
        console.log("[HomeRequest] took " + (Date.now() - time) + "ms");
        return Array.from(mFolderMap.values());
    }
    async filterOnlyInos(filter) {
        let full = await this.runFilter(filter, undefined);
        let inos = full.map((f) => f.ino);
        return inos;
    }
    async runFilter(filter, options) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("No database connection");
        //Basic Selection
        let selectionArray = [knex.raw('CAST(Files.ino AS TEXT) AS ino')];
        let defaultSelection = ["Files.mfolder", "Files.path", "Files.name", "Files.image", "Files.categories", "Files.merged", "Files.recolor", "Files.mtime", "Files.size", "Files.major", "Files.minor", "Files.type", "Files.fingerprint"];
        if (options && options.selection && options.selection.length > 0) {
            selectionArray.push(...options.selection);
        }
        else {
            selectionArray.push(...defaultSelection);
        }
        //Extend if needed
        if (filter && filter.t_cas) {
            selectionArray.push("CasPart.primSort");
            selectionArray.push("CasPart.SortLayer");
        }
        //Basic Query
        let query = knex.from("Files").select(selectionArray);
        //Filter
        //Path
        if (options && options.exactPath && options.exactPath.length > 0) {
            query.where("Files.path", options.exactPath);
        }
        else if (options && options.partPath && options.partPath.length > 0) {
            query.where((qb) => {
                qb.where("Files.path", options.partPath).orWhereLike("Files.path", options.partPath + path_1.default.sep + "%");
            });
        }
        //Main Filters
        this.extendBasicSearchAndStats(query, filter, knex);
        this.extendCASPFilter(query, filter, knex);
        this.extendCOBJFilter(query, filter, knex);
        this.extendClipFilter(query, filter, knex);
        this.extendOtherFilter(query, filter, knex);
        this.extendSModFilter(query, filter, knex);
        this.extentByTypeFilter(query, filter, knex);
        this.extendCategoriesFilter(query, filter, knex);
        //Package Entries
        this.extendEntriesFilter(query, filter, knex);
        //XML Types
        this.extendXMLTypesFilter(query, filter, knex);
        //Save Game Filter
        //TO-DO Needs to be re-implemented
        //Order by
        if (options && options.orderBy) {
            query.orderBy(options.orderBy, options.orderDirection || "asc");
        }
        query.groupBy("Files.ino");
        let files = await query;
        //After query processing
        if (filter && filter.s_broken) {
            //Filter out broken files
            let brokenFingerprints = this.mainApp.plumbdexController.getFingerprintSet();
            files = files.filter((file) => {
                if (!file.fingerprint || file.fingerprint.length == 0)
                    return false;
                return brokenFingerprints.has(file.fingerprint);
            });
        }
        return files;
    }
    extendEntriesFilter(query, filter, knex) {
        if (!filter || !filter.entries || filter.entries.length == 0)
            return;
        //Filter by Entries
        console.log("Extend Entries Filter", filter.entries);
        let entries = knex("Entries").select("Entries.ino").where((qb) => {
            filter.entries.forEach((entrie) => {
                let address = [entrie.t, entrie.g, entrie.i].join("-").toLowerCase();
                ;
                if (entrie.mode == "and") {
                    qb.andWhere("address", address);
                    /*qb.andWhere((eq:any) => {
                        if (entrie.t) eq.andWhere("type", parseInt(entrie.t, 16));
                        if (entrie.g) eq.andWhere("group", parseInt(entrie.g, 16));
                        if (entrie.i) eq.andWhere("instance", entrie.i.toLowerCase());
                    });*/
                }
                else {
                    qb.orWhere("address", address);
                    /*qb.orWhere((eq:any) => {
                        if (entrie.t) eq.andWhere("type", parseInt(entrie.t, 16));
                        if (entrie.g) eq.andWhere("group", parseInt(entrie.g, 16));
                        if (entrie.i) eq.andWhere("instance", entrie.i.toLowerCase());
                    });*/
                }
            });
        }).as("e1");
        //query.distinct(knex.raw('CAST(Files.ino AS TEXT) AS ino')).innerJoin(entries, "Files.ino", "e1.ino");
        query.innerJoin(entries, "Files.ino", "e1.ino");
    }
    extendBasicSearchAndStats(query, filter, knex) {
        if (!filter)
            return;
        //Seach in name
        if (filter.search_value && filter.search_value.length > 0) {
            query.whereRaw("Files.name LIKE '%" + filter.search_value.replace(/_/g, "\\_") + "%' ESCAPE '\\'");
        }
        //Stats
        if (filter.s_active) {
            query.whereLike("name", "%" + ".package");
        }
        if (filter.s_deactive) {
            query.whereLike("name", "%" + ".packageOFF");
        }
        if (filter.s_merged) {
            query.where("merged", 1);
        }
        if (filter.s_recolor) {
            query.where("recolor", 1);
        }
        if (filter.s_cf_only) {
            query.whereNot("cf_id", null);
            query.whereNot("cf_id", 0);
        }
        if (filter.s_cf_none) {
            query.where((qb1) => {
                qb1.where("cf_id", null).orWhere("cf_id", 0);
            });
        }
        if (filter.ccs_swiped == false && filter.s_thum != 0) {
            if (filter.s_thum == 1)
                query.whereNot("image_source", 0);
            if (filter.s_thum == -1)
                query.where("image_source", 0);
        }
        //Categories
        if (filter.categorie && filter.categorie != 0) {
            query.whereLike("categories", "%<" + filter.categorie + ">%");
        }
        //TS3 Package
        if (filter.s_ts3_package) {
            query.where((qb) => {
                qb.where("major", 2);
                qb.where("minor", 0);
            });
        }
    }
    extendCASPFilter(query, filter, knex) {
        if (!filter || !filter.t_cas)
            return;
        //Join with CasPart over ino
        query.innerJoin("CasPart", "Files.ino", "CasPart.ino");
        //Gender
        if (filter.cas_gender == 1) {
            query.whereLike("CasPart.gender", "%" + "[Male]" + "%");
        }
        else if (filter.cas_gender == 2) {
            query.whereLike("CasPart.gender", "%" + "[Female]" + "%");
        }
        //Age
        if (filter.cas_age == 1) {
            query.whereLike("CasPart.age", "%" + "[TODDLER]" + "%");
        }
        else if (filter.cas_age == 2) {
            query.whereLike("CasPart.age", "%" + "[CHILD]" + "%");
        }
        else if (filter.cas_age == 3) {
            query.whereLike("CasPart.age", "%" + "[TEEN]" + "%");
        }
        else if (filter.cas_age == 4) {
            query.whereLike("CasPart.age", "%" + "[YOUNGADULT]" + "%");
        }
        else if (filter.cas_age == 5) {
            query.whereLike("CasPart.age", "%" + "[ADULT]" + "%");
        }
        else if (filter.cas_age == 6) {
            query.whereLike("CasPart.age", "%" + "[ELDER]" + "%");
        }
        else if (filter.cas_age == 7) {
            query.whereLike("CasPart.age", "%" + "[INFANT]" + "%");
        }
        //Outfit Categorie
        if (filter.cas_outfit.length != 0) {
            query.whereLike("CasPart.casFlags", "%" + filter.cas_outfit + "%");
        }
        //Species
        if (filter.cas_species != 0 && filter.cas_species != undefined) {
            query.whereLike("CasPart.species", "%" + filter.cas_species.toString(16).padStart(4, "0") + "%");
        }
        //Categorie (Hat,Tops etc...)
        if (filter.cas_body == 1 || filter.cas_body == 2) {
            if (filter.cas_cat == 0) {
                query.whereLike("CasPart.body", "%" + "[T" + filter.cas_body + "]" + "%");
            }
            else if (filter.cas_cat_sub == 0) {
                query.whereLike("CasPart.body", "%" + "[T" + filter.cas_body + "]-[M" + filter.cas_cat + "]" + "%");
            }
            else {
                query.whereLike("CasPart.body", "%" + "[T" + filter.cas_body + "]-[M" + filter.cas_cat + "]-[B" + filter.cas_cat_sub + "]" + "%");
            }
        }
        //query.distinct(knex.raw('CAST(Files.ino AS TEXT) AS ino'));
    }
    extendCOBJFilter(query, filter, knex) {
        if (!filter || !filter.t_cobj)
            return;
        //Join with CasPart over ino
        query.innerJoin("CobjCom", "Files.ino", "CobjCom.ino");
        if (filter.cobj_type == 2 && filter.cobj_tags.length > 0) {
            //Build Buy
            query.where((tq) => {
                for (let index = 0; index < filter.cobj_tags.length; index++) {
                    const tag = filter.cobj_tags[index];
                    if (index == 0) {
                        tq.whereLike("CobjCom.bb", "%" + tag + "%");
                    }
                    else {
                        tq.orWhereLike("CobjCom.bb", "%" + tag + "%");
                    }
                }
            });
        }
        if (filter.cobj_type == 3 && filter.cobj_tags.length > 0) {
            //Pattern
            query.where((tq) => {
                for (let index = 0; index < filter.cobj_tags.length; index++) {
                    const tag = filter.cobj_tags[index];
                    if (index == 0) {
                        tq.whereLike("CobjCom.pat", "%" + tag + "%");
                    }
                    else {
                        tq.orWhereLike("CobjCom.pat", "%" + tag + "%");
                    }
                }
            });
        }
        if (filter.cobj_type == 1 && filter.cobj_tags.length > 0) {
            //Build
            query.where((tq) => {
                for (let index = 0; index < filter.cobj_tags.length; index++) {
                    const tag = filter.cobj_tags[index];
                    if (index == 0) {
                        tq.whereLike("CobjCom.bu", "%" + tag + "%");
                    }
                    else {
                        tq.orWhereLike("CobjCom.bu", "%" + tag + "%");
                    }
                }
            });
        }
        if (filter.cobj_type == 4 && filter.cobj_tags.length > 0) {
            //Build
            query.where((tq) => {
                for (let index = 0; index < filter.cobj_tags.length; index++) {
                    const tag = filter.cobj_tags[index];
                    if (index == 0) {
                        tq.whereLike("CobjCom.ot", "%" + tag + "%");
                    }
                    else {
                        tq.orWhereLike("CobjCom.ot", "%" + tag + "%");
                    }
                }
            });
        }
        //query.distinct(knex.raw('CAST(Files.ino AS TEXT) AS ino'));
    }
    extendClipFilter(query, filter, knex) {
        if (!filter || !filter.t_clip)
            return;
        query.whereNot("clip", 0);
        if (filter.clip_pose_pack) {
            query.where("xml_types", "LIKE", "%PosePackInstance%");
        }
    }
    extendOtherFilter(query, filter, knex) {
        if (!filter || !filter.t_other)
            return;
        query.where("clip", 0);
        query.where("casp", 0);
        query.where("cobj", 0);
        query.where("smod", 0);
    }
    extentByTypeFilter(query, filter, knex) {
        let showAllFiles = this.mainApp.settings.s_show_all_files;
        if (!showAllFiles) {
            query.whereNot("type", 3); //Exclude type 3 (Non Sims 4 Files)
            return;
        }
        if (showAllFiles && filter && filter.t_other_t3) {
            query.where("type", 3); //Include only type 3 (Non Sims 4 Files)
            return;
        }
    }
    extendSModFilter(query, filter, knex) {
        if (!filter || !filter.t_smod)
            return;
        query.where("smod", 1);
    }
    extendCategoriesFilter(query, filter, knex) {
        if (!filter || !filter.categories || filter.categories.length == 0)
            return;
        //Filter by Categories
        let positiveCategories = [];
        let negativeCategories = [];
        for (let cat of filter.categories) {
            if (cat.mode == 1) {
                //Positive
                positiveCategories.push("<" + cat.id + ">");
            }
            else if (cat.mode == -1) {
                //Negative
                negativeCategories.push("<" + cat.id + ">");
            }
        }
        //Files.categories LIKE '%<catId>%'
        query.where((builder) => {
            // 1. MUST have ALL positive categories (AND logic)
            for (const catString of positiveCategories) {
                builder.where('categories', 'LIKE', `%${catString}%`);
            }
            // 2. MUST NOT have ANY negative categories
            for (const catString of negativeCategories) {
                builder.whereNot('categories', 'LIKE', `%${catString}%`);
            }
        });
    }
    extendXMLTypesFilter(query, filter, knex) {
        if (!filter || (!filter.xml_types_pos && !filter.xml_types_neg))
            return;
        //Positive
        if (filter.xml_types_pos && filter.xml_types_pos.length > 0) {
            filter.xml_types_pos.forEach((type) => {
                query.whereLike("xml_types", "%" + type + "%");
            });
        }
        //Negative
        if (filter.xml_types_neg && filter.xml_types_neg.length > 0) {
            filter.xml_types_neg.forEach((type) => {
                query.whereNotLike("xml_types", "%" + type + "%");
            });
        }
    }
}
exports.FilesFilterCollection = FilesFilterCollection;
