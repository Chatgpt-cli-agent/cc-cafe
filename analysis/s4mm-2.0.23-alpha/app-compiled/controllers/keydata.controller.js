"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyDataController = void 0;
class KeyDataController {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
    }
    async getKeyValue(key) {
        // Logic to retrieve the value for the given key
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        try {
            const result = await knex('KeyData').select('value').where({ key: key }).first();
            if (result && result.value) {
                return JSON.parse(result.value).data;
            }
            return null;
        }
        catch (error) {
            console.error(`Error retrieving key ${key}:`, error);
            return null;
        }
    }
    setKeyValue(key, value) {
        // Logic to set the value for the given key
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        knex('KeyData').insert({ key: key, value: JSON.stringify({ data: value }) })
            .onConflict('key')
            .merge()
            .then(() => {
            console.log(`Key ${key} set to value ${value}`);
        })
            .catch((error) => {
            console.error(`Error setting key ${key}:`, error);
        });
    }
    async deleteKeyValue(key) {
        // Logic to delete the value for the given key
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Database connection is not available.");
        try {
            await knex('KeyData').where({ key: key }).del();
            console.log(`Key ${key} deleted`);
        }
        catch (error) {
            console.error(`Error deleting key ${key}:`, error);
        }
    }
}
exports.KeyDataController = KeyDataController;
