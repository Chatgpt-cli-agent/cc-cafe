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
exports.CategoriesControllerWorkerUtils = exports.CategoriesController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const IPCExtras_1 = require("../utils/IPCExtras");
class CategoriesController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("categories", async (event, data) => {
            switch (data.action) {
                case "get":
                    return await this.getCategories();
                case "add":
                    return await this.addCategory(data.name);
                case "add-special":
                    return await this.addSpecialCategory(data.name, data.special, data.data, data.inos || [], data.remove || []);
                case "remove":
                    return await this.removeCategory(data.id);
                case "rename":
                    return await this.renameCategory(data.id, data.newName);
                case "auto-tag":
                    throw await this.autoTag(data.categoryIds, data.positive);
                case "update-order":
                    return await this.updateOrder(data.categories);
                case "update":
                    return await this.updateCategory(data.id, data.data);
                case "popup-info":
                    return await this.popupInfo(data.inos);
                case "popup-change":
                    return await this.popupChange(data.inos, data.list);
                case "get-ionos-of-category":
                    return await this.getIonosOfCategory(data.categoryId);
                case "export-categories":
                    return await this.exportCategories(data.filePath, data.withFiles);
                case "import-categories":
                    return await this.importCategories(data.filePath, data.withFiles);
                default:
                    throw new Error("Unknown action: " + data.action);
            }
        });
    }
    //Basic Operations
    async getCategories() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        return await knex("Categories").select("*").orderBy("order");
    }
    async addCategory(name) {
        if (!name)
            throw new Error("Category name is required.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        let result = {
            nameTaken: false,
            success: false
        };
        // Check if the category name already exists
        const existingCategory = await knex("Categories").where({ name }).first();
        if (existingCategory) {
            result.nameTaken = true;
            return result;
        }
        //Find biggest 
        const lastCategory = await knex("Categories").orderBy("order", "desc").first();
        let orderValue = 1;
        if (lastCategory) {
            orderValue = lastCategory.order + 1;
        }
        // Insert the new category
        await knex("Categories").insert({ name, order: orderValue });
        result.success = true;
        return result;
    }
    async addSpecialCategory(name, special, data, inos, remove) {
        if (!name)
            throw new Error("Category name is required.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        //Find biggest 
        const lastCategory = await knex("Categories").orderBy("order", "desc").first();
        let orderValue = 1;
        if (lastCategory) {
            orderValue = lastCategory.order + 1;
        }
        const result = await knex("Categories").insert({ name, special, data, order: orderValue }, ["id"]);
        const newCat = result[0];
        const id = newCat?.id || newCat;
        if (inos?.length > 0 && id) {
            const idTag = `<${id}>`;
            const batchSize = 100;
            for (let i = 0; i < inos.length; i += batchSize) {
                const batch = inos.slice(i, i + batchSize);
                await knex("Files").whereIn("ino", batch).update({
                    categories: knex.raw("TRIM(categories || ?)", [idTag])
                });
            }
        }
        //Remove categories
        if (remove?.length > 0) {
            //Remove from Files
            const removeTags = remove.map((r) => `<${r}>`);
            const batchSize = 100;
            for (let i = 0; i < inos.length; i += batchSize) {
                const batch = inos.slice(i, i + batchSize);
                await knex("Files").whereIn("ino", batch).update({
                    categories: knex.raw("TRIM(" + removeTags.map(() => "REPLACE(categories, ?, '')").join(") || ") + ")", removeTags)
                });
            }
            //Remove categories from DB
            for (const r of remove) {
                await knex("Categories").where({ id: r }).del();
            }
        }
        return { success: true, id };
    }
    async removeCategory(id) {
        if (!id)
            throw new Error("Category ID is required.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        await knex.where('id', id).from("Categories").del();
        //Remove form Files
        const idTag = `<${id}>`;
        const filesToUpdate = await knex("Files")
            .select(["ino", "categories"])
            .where("categories", "like", `%${idTag}%`);
        for (const file of filesToUpdate) {
            const updatedCategories = file.categories.replace(idTag, "").trim();
            await knex("Files")
                .update({ categories: updatedCategories })
                .where("ino", file.ino);
        }
    }
    async renameCategory(id, newName) {
        if (!id || !newName)
            throw new Error("Category ID and new name are required.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        let result = { nameTaken: false, success: false };
        // Check if the new name already exists
        const existingCategory = await knex("Categories").where({ name: newName }).first();
        if (existingCategory) {
            result.nameTaken = true;
            return result;
        }
        // Update the category name
        await knex("Categories").where({ id }).update({ name: newName });
        result.success = true;
        return result;
    }
    async updateOrder(order) {
        if (!order || !Array.isArray(order))
            throw new Error("Order must be an array.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        // Update the order of categories
        for (let i = 0; i < order.length; i++) {
            await knex("Categories").where({ id: order[i].id }).update({ order: i });
        }
    }
    async updateCategory(id, data) {
        if (!id || !data)
            throw new Error("Category ID and data are required.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        // Update the category with the provided data
        await knex("Categories").where({ id }).update(data);
    }
    //Applied
    async popupInfo(inos) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        let result = [];
        let categories = await knex.select(["id", "name", "special"]).from("Categories").orderBy("order");
        let cMap = new Map();
        categories.forEach((element) => {
            element.count = 0;
            cMap.set(element.id, element);
        });
        //cMap.set(-1, { "id": -1, "name": "Liked", "count": 0 });
        //cMap.set(-2, { "id": -2, "name": "Skipped", "count": 0 });
        //cMap.set(-3, { "id": -3, "name": "Disliked", "count": 0 });
        for (let index = 0; index < inos.length; index++) {
            const element = inos[index];
            let rows = await knex.select([knex.raw("CAST(ino as TEXT) as ino"), "categories"]).from("Files").where("ino", element);
            if (rows.length != 1)
                continue;
            let item = rows[0];
            let categorie = item.categories;
            if (categorie == null || categorie.length == 0 || !categorie.includes(">"))
                continue;
            let arr = categorie.split(">");
            arr.forEach((cat) => {
                cat = cat.replace("<", "");
                if (cat.length != 0) {
                    let n = +cat;
                    if (cMap.has(n)) {
                        let e = cMap.get(n);
                        e.count = e.count + 1;
                        cMap.set(n, e);
                    }
                }
            });
        }
        let values = Array.from(cMap.values());
        for (let value of values) {
            let pos = -1;
            let count = value.count;
            if (count == inos.length) {
                pos = 1;
            }
            else if (count != 0) {
                pos = 0;
            }
            value.pos = pos;
            result.push(value);
        }
        return result;
    }
    async popupChange(inos, list) {
        const knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        const sel = ["path", "name", "categories", knex.raw("CAST(ino as TEXT) as ino")];
        const result = [];
        // Batch select all files at once
        const files = await knex.select(sel).from("Files").whereIn("ino", inos);
        // Prepare updates
        const updates = [];
        for (const item of files) {
            let categories = item.categories ?? "";
            for (const { id: cID, change } of list) {
                const cIDTag = `<${cID}>`;
                if (change === 1 && !categories.includes(cIDTag)) {
                    categories += cIDTag;
                }
                else if (change === -1 && categories.includes(cIDTag)) {
                    categories = categories.replace(cIDTag, "");
                }
            }
            categories = categories.trim();
            updates.push({ ino: item.ino, categories });
            item.categories = categories;
            result.push(item);
        }
        // Batch updates in chunks of 500
        for (let i = 0; i < updates.length; i += 500) {
            const chunk = updates.slice(i, i + 500);
            const trx = await knex.transaction();
            try {
                for (const upd of chunk) {
                    await trx("Files").where("ino", upd.ino).update({ categories: upd.categories });
                }
                await trx.commit();
            }
            catch (err) {
                await trx.rollback();
                throw err;
            }
        }
        const mainWindow = this.mainApp.mainWindowController.getWindow();
        if (mainWindow) {
            IPCExtras_1.IPCExtras.sendFromMain(mainWindow, "file-io", { list: result, action: "update-items-categories" });
        }
    }
    //Other
    async getIonosOfCategory(categoryId) {
        if (!categoryId)
            throw new Error("Category ID is required.");
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        let files = await knex.select([knex.raw("CAST(ino as TEXT) as ino")]).from("Files").where("categories", "like", `%<${categoryId}>%`);
        return files.map((file) => file.ino);
    }
    //Auto-Tagging
    async autoTag(categoryIds, positive = true) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        let categories = await knex.select(["id", "name", "tags", "ntags"]).from("Categories").whereIn("id", categoryIds);
        categories = categories.map((cat) => {
            return {
                id: cat.id,
                name: cat.name,
                tags: cat.tags ? cat.tags.split("§").map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0) : [],
                ntags: cat.ntags ? cat.ntags.split("§").map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0) : []
            };
        });
        //Get all files
        let files = await knex.select([knex.raw("CAST(ino AS TEXT) AS ino"), "categories", "name"]).from("Files");
        let updates = [];
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            let oldCategoriesStr = file.categories || "";
            let newCategoriesStr = file.categories || "";
            newCategoriesStr = CategoriesControllerWorkerUtils.modifyFilesCategories(file.name, oldCategoriesStr, categories, positive);
            if (oldCategoriesStr == newCategoriesStr)
                continue; //No change
            //Update
            updates.push({ ino: file.ino, categories: newCategoriesStr });
        }
        //Batch update in chunks of 500
        let chunkSize = 500;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            const trx = await knex.transaction();
            try {
                for (const update of chunk) {
                    await trx("Files").where("ino", update.ino).update({ categories: update.categories });
                }
                await trx.commit();
            }
            catch (err) {
                await trx.rollback();
                throw err;
            }
        }
        return {
            success: true,
            count: updates.length
        };
    }
    async getAutoRunCategories() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        //Get all categories with auto-run enabled
        let categories = await knex.select(["id", "name", "tags", "ntags"]).from("Categories").where("autotag", 1);
        categories = categories.map((cat) => {
            return {
                id: cat.id,
                name: cat.name,
                tags: cat.tags ? cat.tags.split("§").map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0) : [],
                ntags: cat.ntags ? cat.ntags.split("§").map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0) : []
            };
        });
        console.log("[CATEGORIES] Categories for shared data:", categories);
        return categories;
    }
    //Import Export
    async exportCategories(filePath, withFiles = false) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        //Get all categories
        let categories = await knex.select(["id", "name", "tags", "ntags", "onpreview", "autotag"]).from("Categories").orderBy("order");
        let obj = {
            categories: categories,
            files: []
        };
        if (withFiles) {
            //Get all files with categories
            let files = await knex.select([knex.raw("CAST(ino AS TEXT) AS ino"), "name", "categories", "fingerprint"]).from("Files").whereNotNull("categories").andWhere("categories", "!=", "");
            obj.files = files;
        }
        //Write to file
        try {
            fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
        }
        catch (error) {
            console.error("Error writing categories to file:", error);
            throw new Error("Failed to export categories!");
        }
        return true;
    }
    async importCategories(filePath, withFiles = false) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection not initialized.");
        //Read file
        let data;
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        catch (error) {
            console.error("Error reading categories from file:", error);
            throw new Error("Failed to import categories!");
        }
        if (!data || !data.categories)
            throw new Error("Invalid categories data in file.");
        //ID Map old to new
        let idMap = new Map();
        //Insert categories
        for (const category of data.categories) {
            let oldID = category.id;
            delete category.id; //Remove old ID to insert new one
            const existingCategory = await knex("Categories").where({ name: category.name }).first();
            if (!existingCategory) {
                await knex("Categories").insert(category);
                //Get the new ID
                const newCategory = await knex("Categories").where({ name: category.name }).first();
                idMap.set(oldID, newCategory.id); //Map old ID to new ID
            }
            else {
                let updateData = {
                    tags: existingCategory.tags || "",
                    ntags: existingCategory.ntags || "",
                    onpreview: existingCategory.onpreview || 0,
                    autotag: existingCategory.autotag || 0
                };
                //Simple
                if (category.onpreview !== undefined)
                    updateData.onpreview = category.onpreview;
                if (category.autotag !== undefined)
                    updateData.autotag = category.autotag;
                //Join Tags
                let tagsSet = new Set((existingCategory.tags || "").split("§").map((tag) => tag.trim()));
                let nTagSet = new Set((existingCategory.ntags || "").split("§").map((tag) => tag.trim()));
                if (category.tags) {
                    category.tags.split("§").forEach((tag) => {
                        if (tag.trim().length > 0)
                            tagsSet.add(tag.trim());
                    });
                }
                if (category.ntags) {
                    category.ntags.split("§").forEach((tag) => {
                        if (tag.trim().length > 0)
                            nTagSet.add(tag.trim());
                    });
                }
                updateData.tags = Array.from(tagsSet).join("§");
                updateData.ntags = Array.from(nTagSet).join("§");
                idMap.set(oldID, existingCategory.id); //Map old ID to existing ID
                await knex("Categories").where({ id: existingCategory.id }).update(updateData);
            }
        }
        if (withFiles && data.files && Array.isArray(data.files) && data.files.length > 0) {
            for (let index = 0; index < data.files.length; index++) {
                const file = data.files[index];
                if (!file || !file.ino || !file.name || !file.categories)
                    continue; //Skip invalid files
                let databaseFiles = await knex("Files").where((qb) => {
                    qb.where("ino", file.ino);
                    qb.orWhere("name", "like", file.name.replace(/\.[^/.]+$/, "") + "%");
                    if (file.fingerprint && file.fingerprint > 0) {
                        qb.orWhere("fingerprint", file.fingerprint);
                    }
                }).select([knex.raw("CAST(ino AS TEXT) AS ino"), "categories"]);
                for (let j = 0; j < databaseFiles.length; j++) {
                    const dbf = databaseFiles[j];
                    //Combine Categories
                    let categoriesSet = new Set();
                    let existingCategories = dbf.categories ? dbf.categories.split(">").map((cat) => Number(cat.replace("<", "").trim())).filter((id) => {
                        return !isNaN(id) && id > 0;
                    }) : [];
                    existingCategories.forEach((id) => {
                        categoriesSet.add(id);
                    });
                    let newCategories = file.categories.split(">").map((cat) => Number(cat.replace("<", "").trim())).filter((id) => {
                        return !isNaN(id) && id > 0;
                    });
                    newCategories.forEach((id) => {
                        let newId = idMap.get(id);
                        if (newId) {
                            categoriesSet.add(newId);
                        }
                    });
                    await knex("Files").where("ino", dbf.ino).update({
                        categories: Array.from(categoriesSet).map(id => `<${id}>`).join("")
                    });
                }
            }
        }
        return true;
    }
}
exports.CategoriesController = CategoriesController;
class CategoriesControllerWorkerUtils {
    static modifyFilesCategories(filename, oldCategoriesStr, categories, positive = true) {
        filename = filename.toLowerCase();
        let oldCategoriesIds = new Set();
        let oldCategoriesSplit = oldCategoriesStr.split(">").map(cat => cat.replace("<", "").trim()).filter(cat => cat.length > 0);
        oldCategoriesSplit.forEach(cat => {
            let id = parseInt(cat);
            if (!isNaN(id)) {
                oldCategoriesIds.add(id);
            }
        });
        let changed = false;
        for (let index = 0; index < categories.length; index++) {
            const categorie = categories[index];
            let id = categorie.id;
            if (positive) {
                //Positive tagging
                //Add category if filename contains any of the tags
                let categoryIsNeeded = false;
                let contaisBadTag = false;
                if (categorie.tags && categorie.tags.length > 0) {
                    for (const tag of categorie.tags) {
                        if (filename.includes(tag)) {
                            categoryIsNeeded = true;
                            break;
                        }
                    }
                }
                if (categorie.ntags && categorie.ntags.length > 0) {
                    for (const tag of categorie.ntags) {
                        if (filename.includes(tag)) {
                            contaisBadTag = true;
                            break;
                        }
                    }
                }
                if (contaisBadTag) {
                    categoryIsNeeded = false;
                }
                if (categoryIsNeeded && !oldCategoriesIds.has(id)) {
                    oldCategoriesIds.add(id);
                    changed = true;
                }
                else if (!categoryIsNeeded && oldCategoriesIds.has(id)) {
                    //Only additive changes are allowed in positive tagging
                    //oldCategoriesIds.delete(id);
                    //changed = true;
                }
            }
            else {
                //Negative tagging
                //Remove category if filename contains a ntag 
                let categoryShouldBeRemoved = false;
                if (categorie.ntags && categorie.ntags.length > 0) {
                    for (const tag of categorie.ntags) {
                        if (filename.includes(tag)) {
                            categoryShouldBeRemoved = true;
                            break;
                        }
                    }
                }
                if (categoryShouldBeRemoved && oldCategoriesIds.has(id)) {
                    oldCategoriesIds.delete(id);
                    changed = true;
                }
                else if (!categoryShouldBeRemoved && !oldCategoriesIds.has(id)) {
                    //Only substractive changes are allowed in negative tagging
                    //oldCategoriesIds.add(id);
                    //changed = true;
                }
            }
        }
        if (!changed)
            return oldCategoriesStr;
        let newCategoriesStr = Array.from(oldCategoriesIds).map(id => `<${id}>`).join("");
        return newCategoriesStr;
    }
    static extendWithMigratedCategories(sharedData, categoriesString, fingerprint) {
        /*console.log("extendWithMigratedCategories",{
            sharedData,
            categoriesString,
            fingerprint
        })*/
        if (!sharedData || !sharedData.fingerprintCategoriesMap || sharedData.fingerprintCategoriesMap.size == 0)
            return categoriesString;
        if (!sharedData.fingerprintCategoriesMap.has(fingerprint))
            return categoriesString;
        let exStr = categoriesString;
        try {
            let cn = categoriesString.split(">").map(cat => cat.replace("<", "").trim()).filter(cat => cat.length > 0);
            let categoryIds = cn.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
            let migratedCategories = sharedData.fingerprintCategoriesMap.get(fingerprint);
            console.log({
                cn: cn,
                categoryIds: categoryIds,
                migratedCategories: migratedCategories
            });
            if (migratedCategories && migratedCategories.size > 0) {
                migratedCategories.forEach((catId) => {
                    if (!categoryIds.includes(catId)) {
                        exStr += `<${catId}>`;
                    }
                });
            }
        }
        catch (error) {
            console.error("Error extending categories with migrated categories:", error);
        }
        return exStr;
    }
}
exports.CategoriesControllerWorkerUtils = CategoriesControllerWorkerUtils;
