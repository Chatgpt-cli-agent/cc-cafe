"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerQueue = void 0;
var electron_1 = require("electron");
var WorkerQueue = /** @class */ (function () {
    function WorkerQueue(workers, id, tasks, onProgress, onFinish) {
        this.workers = [];
        this.tasks = [];
        this.done = new Set();
        this.index = 0;
        this.results = [];
        this.listener = undefined;
        this.workers = workers;
        this.channel = "WorkerQueue_" + id + generateRandomString(8);
        this.tasks = tasks;
        this.onProgress = onProgress;
        this.onFinish = onFinish;
        this.prepareIpc();
        this.kickstartWork();
    }
    WorkerQueue.prototype.prepareIpc = function () {
        var _this = this;
        this.listener = function (event, data) {
            _this.handleResponse(event, data);
        };
        electron_1.ipcMain.on(this.channel, this.listener);
    };
    WorkerQueue.prototype.handleResponse = function (event, data) {
        if (!data || data.index == undefined)
            return;
        this.done.add(data.index);
        //console.log("Progress "+this.done.size+"/"+this.tasks.length);
        this.results.push({
            task: this.tasks[data.index],
            data: data.result
        });
        if (this.tasks.length == this.done.size) {
            //Done
            if (this.listener)
                electron_1.ipcMain.removeListener(this.channel, this.listener);
            this.onFinish(this.results);
            return;
        }
        else {
            //Handle Progress
            this.onProgress({
                index: this.done.size,
                max: this.tasks.length,
                result: data.result,
                task: this.tasks[data.index]
            });
        }
        var nI = this.index;
        this.index++;
        if (nI < this.tasks.length) {
            event.sender.send("work-queue", {
                index: nI,
                task: this.tasks[nI],
                channel: this.channel
            });
        }
    };
    WorkerQueue.prototype.kickstartWork = function () {
        if (this.tasks.length == 0) {
            if (this.listener)
                electron_1.ipcMain.removeListener(this.channel, this.listener);
            this.onFinish(this.results);
            return;
        }
        this.onProgress({
            index: 0,
            max: this.tasks.length,
            result: undefined,
            task: undefined
        });
        this.index = this.workers.length > this.tasks.length ? this.tasks.length : this.workers.length;
        for (var i = 0; i < this.workers.length && i < this.tasks.length; i++) {
            var worker = this.workers[i];
            var task = this.tasks[i];
            worker.webContents.send("work-queue", {
                index: i,
                task: task,
                channel: this.channel
            });
        }
    };
    return WorkerQueue;
}());
exports.WorkerQueue = WorkerQueue;
function generateRandomString(length) {
    return Math.random().toString(36).substring(2, 2 + length);
}
