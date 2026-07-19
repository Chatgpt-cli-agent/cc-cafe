"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCCollections = void 0;
const batchActions_collection_1 = require("./batchActions.collection");
const fileActions_collection_1 = require("./fileActions.collection");
const filesFilter_collection_1 = require("./filesFilter.collection");
const general_collection_1 = require("./general.collection");
const simpleGet_collection_1 = require("./simpleGet.collection");
const simpleTasks_collection_1 = require("./simpleTasks.collection");
class IPCCollections {
    constructor(main) {
        this.mainApp = main;
        this.generalCollection = new general_collection_1.GeneralCollection(this.mainApp);
        this.batchActionsController = new batchActions_collection_1.BatchActionsCollection(this.mainApp);
        this.filesFilterCollection = new filesFilter_collection_1.FilesFilterCollection(this.mainApp);
        this.simpleGetCollection = new simpleGet_collection_1.SimpleGetCollection(this.mainApp);
        this.simpleTasksCollection = new simpleTasks_collection_1.SimpleTasksCollection(this.mainApp);
        this.fileActionsCollection = new fileActions_collection_1.FileActionsCollection(this.mainApp);
    }
}
exports.IPCCollections = IPCCollections;
