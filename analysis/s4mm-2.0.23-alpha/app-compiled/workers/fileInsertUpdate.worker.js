"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const { FileImportHelper } = require("../../app-compiled/utils/FileImport");
worker_threads_1.parentPort?.on('message', async (data) => {
    try {
        if (data.task && data.task.action === "insert-or-update-file") {
            //console.log("Processing insert-or-update-file task in worker with data: ", data.task);
            const result = await FileImportHelper.importUpdateFileWorkerWithDatabaseEntry(data.task.data, data.sharedData, data.task.databaseEntry.length > 0 ? data.task.databaseEntry[0] : null, data.task.data.stats);
            //Wait for 200ms to simulate processing time
            //await new Promise(resolve => setTimeout(resolve, 200));
            //console.log("Worker result: ", result);
            worker_threads_1.parentPort?.postMessage({
                index: data.index,
                result: result,
                channel: data.channel,
                action: data.returnAction || "insert-or-update-file-finished"
            });
        }
    }
    catch (error) {
        console.error("Error in worker thread: ", error);
        worker_threads_1.parentPort?.postMessage({
            index: data.index,
            error: error.message,
            channel: data.channel
        });
    }
});
console.log('Node Worker Thread is ready');
