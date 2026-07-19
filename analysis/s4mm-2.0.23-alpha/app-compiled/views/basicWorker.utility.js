"use strict";
// basicWorker.utility.ts
const { parentPort } = require('electron');
const { CommunityFileInfoBundle: CommunityFileInfoBundleUtil } = require("../../app-compiled/utils/CommunityFileInfoBundle");
const { BatchHelper: BatchHelperUtil } = require("../../app-compiled/utils/BatchHelper");
const { FileImportHelper: FileImportHelperUtil } = require("../../app-compiled/utils/FileImport");
const GameStateUtil = require("../../app-compiled/utils/GameState").GameState;
const { ToolPolyCountWorkerUtils: ToolPolyCountWorkerUtilsUtil } = require("../../app-compiled/tools/polycount.tool");
const { ToolRMapWorkerUtils: ToolRMapWorkerUtilsUtil } = require("../../app-compiled/tools/rmap.tool");
const { ToolHQTexturesWorkerUtils: ToolHQTexturesWorkerUtilsUtil } = require("../../app-compiled/tools/hqtextures.tool");
const { ToolCCDetectWorkerUtils: ToolCCDetectWorkerUtilsUtil } = require("../../app-compiled/tools/ccdetect.tool");
let gamestatecontrollerUtil = undefined;
function gameStateChange(data) {
    if (parentPort) {
        parentPort.postMessage({
            channel: "gamestate-controller",
            action: "update-game-state",
            isGameRunning: data.gameIsOpen
        });
    }
}
// Sicherheitscheck: Nur ausführen, wenn wir im richtigen Prozess sind
if (!parentPort) {
    console.error("FATAL: parentPort ist undefined. Dieser Worker muss via utilityProcess.fork() gestartet werden!");
}
else {
    parentPort.on('message', async (data) => {
        let result = undefined;
        try {
            if (data.task) {
                switch (data.task.action) {
                    case "insert-or-update-file":
                        result = await FileImportHelperUtil.importUpdateFileWorker(data.task.data, data.sharedData);
                        break;
                    case "calc-poly-cas-count":
                        result = ToolPolyCountWorkerUtilsUtil.calcPolyCountForCaspDBElement(data.task.data);
                        break;
                    case "findClosestHash":
                        result = await ToolCCDetectWorkerUtilsUtil.findClosestHash(data.task.data);
                        break;
                    // ... (andere Cases wie gehabt)
                }
                parentPort.postMessage({
                    index: data.index,
                    result: result,
                    channel: data.channel,
                    action: data.returnAction
                });
            }
        }
        catch (error) {
            console.error("[UtilityWorker Error]:", error);
        }
    });
    // Melden, dass der Prozess bereit ist
    parentPort.postMessage('worker-ready');
}
