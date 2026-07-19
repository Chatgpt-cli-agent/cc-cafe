"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchActionsCollection = void 0;
const electron_1 = require("electron");
const WorkerQueue_1 = require("../utils/WorkerQueue");
const IPCExtras_1 = require("../utils/IPCExtras");
class BatchActionsCollection {
    constructor(main) {
        this.mainApp = main;
        this.initIPC();
    }
    initIPC() {
        electron_1.ipcMain.handle("batch-actions", async (event, data) => {
            if (data.action == "activate-deactivate-all") {
                return this.batchActivateDeactivateAll(data.turnActive, data.loadingChannel, event);
            }
            throw new Error("No action or invalid parameters");
        });
    }
    async batchRecalculateValues() {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Knex not initialized");
        let query = knex.from("Files").select([knex.raw('CAST(ino AS TEXT) AS ino'), "name", "path"]).where("type", 1);
        let items = await query;
        console.log("Items to update", items.length);
        let tasks = items.map((element) => {
            return {
                action: "recalculate-values",
                data: {
                    name: element.name,
                    path: element.path,
                    ino: element.ino
                }
            };
        });
    }
    async batchActivateDeactivateAll(turnActive, loadingChannel, event) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Knex not initialized");
        let query = knex.from("Files").select([knex.raw('CAST(ino AS TEXT) AS ino'), "name", "path"]).whereLike("name", "%OFF").whereNot("type", 3);
        if (!turnActive) {
            query = knex.from("Files").select([knex.raw('CAST(ino AS TEXT) AS ino'), "name", "path"]).whereNot("name", "like", "%OFF").whereNot("type", 3);
            ;
        }
        let items = await query;
        console.log("Items to update", items.length);
        let tasks = items.map((element) => {
            return {
                action: "activate-deactivate",
                data: {
                    name: element.name,
                    path: element.path,
                    ino: element.ino,
                    turnActive: turnActive,
                }
            };
        });
        this.handleTasks(tasks, loadingChannel, event);
    }
    async handleTasks(tasks, loadingChannel, event) {
        let knex = this.mainApp.databaseController.getKnex();
        if (!knex)
            throw new Error("Knex not initialized");
        new WorkerQueue_1.WorkerQueue(this.mainApp.workersController, tasks, {}, (progress) => {
            if (event && event.sender) {
                /*IPCExtras.send(event, loadingChannel, {
                    action:"scan-files-progress",
                    index: progress.index,
                    max: progress.max,
                    filename: progress.task && progress.task.data && progress.task.data.name ? progress.task.data.name : undefined
                });*/
                IPCExtras_1.IPCExtras.send(event, loadingChannel, {
                    close: false,
                    value: progress.index,
                    max: progress.max,
                    title: (progress.index + 1) + "/" + progress.max,
                    spinner: false,
                });
            }
        }, async (results) => {
            //console.log("Results",results);
            let dbUpdate = results.map((result) => {
                if (result.data && result.data.needsDatabaseUpdate) {
                    return {
                        ino: result.data.updateData.ino,
                        name: result.data.updateData.name
                    };
                }
                return undefined;
            }).filter((result) => { return result != undefined; });
            //Update "Files" table in batches
            let batchSize = 1000;
            let batches = Math.ceil(dbUpdate.length / batchSize);
            for (let i = 0; i < batches; i++) {
                let batch = dbUpdate.slice(i * batchSize, (i + 1) * batchSize);
                let time = Date.now();
                try {
                    await knex.transaction(async (trx) => {
                        const queries = [];
                        batch.forEach((file) => {
                            const query = knex("Files")
                                .where("ino", file.ino) // Match the row by "ino"
                                .update({
                                name: file.name, // Update the fields you need
                                path: file.path // Example: updating "path"
                            })
                                .transacting(trx);
                            queries.push(query);
                        });
                        await Promise.all(queries); // Wait for all updates to complete
                    });
                    console.log("Batch update time: ", Date.now() - time);
                }
                catch (error) {
                    console.error("Update Files", error);
                }
            }
            if (event && event.sender) {
                IPCExtras_1.IPCExtras.send(event, loadingChannel, {
                    close: true
                });
            }
        });
    }
}
exports.BatchActionsCollection = BatchActionsCollection;
