"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerQueue = void 0;
const electron_1 = require("electron");
class WorkerQueue {
    constructor(wc, tasks, sharedData, onProgress, onFinish) {
        this.finished = false;
        this.tasks = [];
        this.done = new Set();
        this.index = 0;
        this.results = [];
        this.sharedData = undefined;
        this.startedAt = Date.now();
        this.listener = undefined;
        this.wc = wc;
        this.channel = "WorkerQueue_" + Date.now() + "_" + generateRandomString(8);
        this.tasks = tasks;
        this.onProgress = onProgress;
        this.onFinish = onFinish;
        this.sharedData = sharedData;
        this.prepareIpc();
        this.kickstartWork();
    }
    prepareIpc() {
        this.listener = (event, data) => {
            this.handleResponse(event, data);
        };
        electron_1.ipcMain.on(this.channel, this.listener);
    }
    handleResponse(event, data) {
        if (!data || data.index == undefined)
            return;
        if (!this.done.has(data.index)) {
            this.done.add(data.index);
            this.results.push({
                task: this.tasks[data.index],
                data: data.result
            });
        }
        else {
            console.warn(`Task ${data.index} already done`);
            return;
        }
        const currentProgress = this.done.size;
        const isFinished = currentProgress === this.tasks.length;
        this.onProgress({
            index: currentProgress,
            max: this.tasks.length,
            result: data.result,
            task: this.tasks[data.index]
        });
        if (isFinished) {
            if (this.finished)
                return;
            this.finished = true;
            if (this.listener) {
                electron_1.ipcMain.removeListener(this.channel, this.listener);
            }
            this.wc.clearQueueClaims(this.channel);
            this.wc.spinnDownIdleWorkersIfNeeded();
            this.onFinish(this.results);
            return;
        }
        const progress = currentProgress / this.tasks.length;
        this.wc.spinnupAdditionalWorkerIfNeeded(progress, this.startedAt);
        this.assignTasksToIdleWorkers();
        if (this.index < this.tasks.length) {
            event.sender.send("work-queue", {
                index: this.index,
                task: this.tasks[this.index],
                channel: this.channel,
                sharedData: this.sharedData
            });
            this.index++;
        }
    }
    async kickstartWork() {
        if (this.tasks.length == 0) {
            if (this.listener)
                electron_1.ipcMain.removeListener(this.channel, this.listener);
            this.onFinish(this.results);
            this.wc.clearQueueClaims(this.channel);
            this.wc.spinnDownIdleWorkersIfNeeded();
            return;
        }
        this.onProgress({
            index: this.done.size,
            max: this.tasks.length,
            result: undefined,
            task: undefined
        });
        this.index = 0;
        let readyWorkers = await this.wc.getAtLeastOneReadyWorker();
        for (let i = 0; i < readyWorkers.length && i < this.tasks.length; i++) {
            let workerObj = readyWorkers[this.index];
            this.wc.addClaimByWO(workerObj, this.channel);
            workerObj.worker.webContents.send("work-queue", {
                index: this.index,
                task: this.tasks[this.index],
                channel: this.channel,
                sharedData: this.sharedData
            });
            this.index++;
        }
    }
    async assignTasksToIdleWorkers() {
        let allReady = await this.wc.getAtLeastOneReadyWorker();
        for (let workerObj of allReady) {
            if (!workerObj.activeClaimed.has(this.channel) && this.index < this.tasks.length) {
                this.wc.addClaimByWO(workerObj, this.channel);
                workerObj.worker.webContents.send("work-queue", {
                    index: this.index,
                    task: this.tasks[this.index],
                    channel: this.channel,
                    sharedData: this.sharedData
                });
                this.index++;
            }
        }
    }
}
exports.WorkerQueue = WorkerQueue;
function generateRandomString(length) {
    return Math.random().toString(36).substring(2, 2 + length);
}
