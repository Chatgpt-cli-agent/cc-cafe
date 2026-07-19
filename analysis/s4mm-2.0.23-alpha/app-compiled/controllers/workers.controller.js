"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkersController = void 0;
const electron_1 = require("electron");
const IPCExtras_1 = require("../utils/IPCExtras");
class WorkersController {
    constructor(main) {
        this.idCounter = 0;
        this.theadCount = 1;
        this.maxWorkerCount = 1;
        this.threadProcentage = 0.75; // Percentage of CPU threads to use for workers (default 75%)
        this.absoluteMaxWorkerCount = 11; // Absolute max worker count to prevent too many workers on high-core machines
        // Spin up new worker if queue exceeds this duration and it below QueueProgress threshold
        // Only used if there are less than maxWorkerCount workers available 
        this.spinnUpDelay = 5000;
        this.spinnDownDelay = 20000; // Reduce workers if they have been idle for this duration and there are more than 1 worker available
        this.spinnupQueueProgress = 0.35;
        this.spinnDownTimeout = null;
        this.spinningUp = false;
        this.workers = [];
        this.showWorkers = false;
        this.startedPreparingAt = 0;
        this.mainApp = main;
        this.maxWorkerCount = Math.max(1, Math.floor(require('os').cpus().length * this.threadProcentage));
        if (this.maxWorkerCount > this.absoluteMaxWorkerCount)
            this.maxWorkerCount = this.absoluteMaxWorkerCount;
        if (this.showWorkers)
            this.maxWorkerCount = 1;
        this.autoAdjustThreadCount();
        this.initIPC();
        this.updateWokerState(); // Initial state log
    }
    autoAdjustThreadCount() {
        let osThreadCount = require('os').cpus().length;
        this.theadCount = Math.max(1, Math.floor(osThreadCount * this.threadProcentage));
        if (this.theadCount > this.absoluteMaxWorkerCount)
            this.theadCount = this.absoluteMaxWorkerCount;
        //Only Testing
        if (this.showWorkers)
            this.theadCount = 1;
    }
    initIPC() {
        electron_1.ipcMain.on("worker-init", async (event, data) => {
            if (data.action == "create-worker" && data.channel) {
                this.createWorker(event, data.channel);
            }
        });
        electron_1.ipcMain.handle("worker-init", async (event, data) => {
            switch (data.action) {
                case "get-workers-state":
                    return this.workerState;
                default:
                    throw new Error("Unknown worker-init action: " + data.action);
            }
        });
    }
    async createWorker(returnEvent, returnChannel) {
        let time = Date.now();
        this.startedPreparingAt = time;
        console.log("[WORKER] Initializing workers...");
        this.closeAllWorkers(); // Calls updateWokerState internally
        for (let i = 0; i < this.theadCount; i++) {
            try {
                let id = this.idCounter + 1;
                this.idCounter = id;
                console.log("[WORKER] Started worker " + i);
                let worker = new electron_1.BrowserWindow({
                    show: this.showWorkers,
                    title: `Multithread Worker ${id}`,
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                });
                let workerObj = {
                    worker: worker,
                    isReady: false,
                    id: id,
                    activeClaimed: new Set()
                };
                worker.loadFile('./views/basic_worker/index.html');
                worker.setMenu(null);
                worker.on("ready-to-show", () => {
                    if (this.showWorkers)
                        worker.webContents.openDevTools();
                });
                worker.webContents.once('ipc-message', (event, channel, message) => {
                    if (channel === 'worker-ready') {
                        workerObj.isReady = true;
                        this.updateWorkerStatus(i, returnEvent, returnChannel);
                        this.checkAllWorkersReady(returnEvent, returnChannel);
                        this.updateWokerState();
                    }
                });
                this.workers.push(workerObj);
                this.idCounter++;
            }
            catch (err) {
                console.log("[ERROR-BASICWORKER]: " + err);
            }
        }
        this.updateWokerState();
        console.log(`[WORKER] All workers initialized in ${Date.now() - time}ms.`);
        return true;
    }
    async createNewWorkers(count) {
        let newTotal = this.workers.length + count;
        if (newTotal > this.maxWorkerCount) {
            console.log(`[WORKER] Limit exceeded. Adjusting count.`);
            count = this.maxWorkerCount - this.workers.length;
        }
        ;
        if (count <= 0)
            return;
        console.log(`[WORKER] Creating ${count} new workers...`);
        const creationPromises = [];
        for (let i = 0; i < count; i++) {
            const workerPromise = new Promise((resolve, reject) => {
                try {
                    let id = this.idCounter + 1;
                    this.idCounter = id;
                    let worker = new electron_1.BrowserWindow({
                        show: this.showWorkers,
                        title: `Multithread Worker ${id}`,
                        webPreferences: {
                            nodeIntegration: true,
                            contextIsolation: false
                        }
                    });
                    let workerObj = {
                        worker: worker,
                        isReady: false,
                        id: id,
                        activeClaimed: new Set()
                    };
                    this.workers.push(workerObj);
                    this.updateWokerState();
                    worker.loadFile('./views/basic_worker/index.html');
                    worker.webContents.once('ipc-message', (event, channel) => {
                        if (channel === 'worker-ready') {
                            workerObj.isReady = true;
                            console.log(`[WORKER] Worker ${workerObj.id} is ready.`);
                            this.updateWokerState();
                            resolve();
                        }
                    });
                    worker.webContents.on('did-fail-load', () => reject("Failed to load worker HTML"));
                }
                catch (err) {
                    reject(err);
                }
            });
            creationPromises.push(workerPromise);
        }
        try {
            await Promise.all(creationPromises);
            console.log(`[WORKER] All ${count} workers are now ready and initialized.`);
        }
        catch (error) {
            console.error("[ERROR]: One or more workers failed to initialize", error);
        }
    }
    async spinnupAdditionalWorkerIfNeeded(queueProgress, queueStartAt) {
        if (this.spinningUp)
            return;
        if (this.workers.length >= this.maxWorkerCount)
            return;
        if (queueProgress < this.spinnupQueueProgress)
            return;
        if (Date.now() - queueStartAt < this.spinnUpDelay)
            return;
        console.log("[WORKER] Spinning up additional worker due to queue progress and time...");
        let newWorkerCount = Math.min(1, this.maxWorkerCount - this.workers.length);
        this.spinningUp = true;
        await this.createNewWorkers(newWorkerCount);
        this.spinningUp = false;
    }
    spinnDownIdleWorkersIfNeeded() {
        console.log("[WORKER] Checking if idle workers need to be spun down...");
        if (this.workers.length <= 1)
            return;
        if (this.spinnDownTimeout) {
            clearTimeout(this.spinnDownTimeout);
            this.spinnDownTimeout = null;
        }
        this.spinnDownTimeout = setTimeout(() => {
            console.log("[WORKER] Checking for idle workers to spin down...");
            let changed = false;
            for (let i = this.workers.length - 1; i >= 1; i--) {
                let workerObj = this.workers[i];
                if (workerObj.activeClaimed.size === 0) {
                    console.log(`[WORKER] Spinning down idle worker ${workerObj.id}.`);
                    workerObj.worker.close();
                    this.workers.splice(i, 1);
                    changed = true;
                }
            }
            if (changed)
                this.updateWokerState();
        }, this.spinnDownDelay);
    }
    updateWorkerStatus(workerIndex, event, channel) {
        console.log(`[WORKER] Worker ${workerIndex} is ready.`);
        event.sender.send(channel, {
            action: "worker-ready",
            index: workerIndex,
            total: this.theadCount,
            ready: this.workers.filter((workerObj) => workerObj.isReady).length
        });
    }
    checkAllWorkersReady(event, channel) {
        let allReady = this.workers.every((workerObj) => workerObj.isReady);
        if (!allReady)
            return;
        let tookTime = Date.now() - this.startedPreparingAt;
        console.log('[WORKER] All workers are ready. Took ' + tookTime + 'ms.');
        event.sender.send(channel, { action: "all-workers-ready" });
    }
    closeAllWorkers() {
        this.workers.forEach((workerObj) => {
            workerObj.worker.close();
        });
        this.workers = [];
        this.updateWokerState(); // UPDATE: Pool empty
    }
    reduceWorkersToMinimum() {
        if (this.workers.length <= 1)
            return;
        console.log("[WORKER] Reducing workers to minimum...");
        let changed = false;
        for (let i = this.workers.length - 1; i > 0; i--) {
            let workerObj = this.workers[i];
            if (workerObj.activeClaimed.size === 0) {
                console.log(`[WORKER] Closing worker ${workerObj.id} to reduce to minimum.`);
                workerObj.worker.close();
                this.workers.splice(i, 1);
                changed = true;
            }
        }
        if (changed)
            this.updateWokerState();
    }
    async clearQueueClaims(queueId) {
        let changed = false;
        this.workers.forEach((workerObj) => {
            if (workerObj.activeClaimed.has(queueId)) {
                workerObj.activeClaimed.delete(queueId);
                console.log(`[WORKER] Cleared claim of worker ${workerObj.id} for queue ${queueId}.`);
                changed = true;
            }
        });
        if (changed)
            this.updateWokerState();
    }
    async getAtLeastOneReadyWorker() {
        let readyWorkers = this.workers.filter((workerObj) => workerObj.isReady);
        if (readyWorkers.length === 0) {
            await this.createNewWorkers(1);
            readyWorkers = this.workers.filter((workerObj) => workerObj.isReady);
        }
        return readyWorkers;
    }
    updateWokerState() {
        IPCExtras_1.IPCExtras.sendFromMainApp(this.mainApp, "app", {
            action: "worker-state-update",
            state: this.workerState
        });
    }
    addClaimByWO(workerObj, queueId) {
        if (!workerObj.activeClaimed.has(queueId)) {
            workerObj.activeClaimed.add(queueId);
            console.log(`[WORKER] Added claim of worker ${workerObj.id} for queue ${queueId}.`);
            this.updateWokerState();
        }
    }
    get workerState() {
        return {
            totalWorker: this.workers.length,
            maxWorker: this.maxWorkerCount,
            readyWorkers: this.workers.filter((workerObj) => workerObj.isReady).length,
            claimedWorkers: this.workers.filter((workerObj) => workerObj.activeClaimed.size > 0).length
        };
    }
}
exports.WorkersController = WorkersController;
