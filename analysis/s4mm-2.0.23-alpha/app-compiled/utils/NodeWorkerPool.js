"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeWorkerPool = void 0;
const worker_threads_1 = require("worker_threads");
class NodeWorkerPool {
    constructor(threadCount, workerPath) {
        this.threadCount = threadCount;
        this.workerPath = workerPath;
        this.workers = [];
        this.taskQueue = [];
        this.activeTasks = 0;
        this.results = [];
        this.doneCount = 0;
        for (let i = 0; i < this.threadCount; i++) {
            this.workers.push(new worker_threads_1.Worker(this.workerPath));
        }
    }
    runTasks(tasks, sharedData, onProgress, onFinish) {
        this.taskQueue = tasks.map((t, i) => ({ task: t, index: i, sharedData }));
        this.results = [];
        this.doneCount = 0;
        const channel = `node_pool_${Date.now()}`;
        this.workers.forEach(worker => {
            worker.on('message', (message) => {
                if (message.channel === channel) {
                    this.doneCount++;
                    this.activeTasks--;
                    this.results.push(message);
                    onProgress({
                        index: this.doneCount,
                        max: tasks.length,
                        result: message.result,
                        task: tasks[message.index]
                    });
                    this.feedWorker(worker, channel);
                    if (this.doneCount === tasks.length) {
                        onFinish(this.results);
                        worker.removeAllListeners('message');
                    }
                }
            });
            worker.on('error', (err) => {
                console.error("Worker CRASHED:", err);
            });
            worker.on('exit', (code) => {
                if (code !== 0)
                    console.error(`Worker stopped with exit code ${code}`);
            });
            this.feedWorker(worker, channel);
        });
    }
    feedWorker(worker, channel) {
        if (this.taskQueue.length > 0) {
            const nextTask = this.taskQueue.shift();
            this.activeTasks++;
            worker.postMessage({ ...nextTask, channel });
        }
    }
    shutdown() {
        this.workers.forEach(w => w.terminate());
    }
}
exports.NodeWorkerPool = NodeWorkerPool;
