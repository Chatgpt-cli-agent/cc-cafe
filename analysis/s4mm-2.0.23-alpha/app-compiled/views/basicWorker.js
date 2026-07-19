"use strict";
const { CommunityFileInfoBundle } = require("../../app-compiled/utils/CommunityFileInfoBundle");
const { BatchHelper } = require("../../app-compiled/utils/BatchHelper");
const { FileImportHelper } = require("../../app-compiled/utils/FileImport");
const GameState = require("../../app-compiled/utils/GameState").GameState;
var { ipcRenderer } = require('electron');
const { ToolPolyCountWorkerUtils } = require("../../app-compiled/tools/polycount.tool");
const { ToolRMapWorkerUtils } = require("../../app-compiled/tools/rmap.tool");
const { ToolHQTexturesWorkerUtils } = require("../../app-compiled/tools/hqtextures.tool");
const { ToolCCDetectWorkerUtils } = require("../../app-compiled/tools/ccdetect.tool");
//Simulated load
async function delayLoad(timeInMs) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeInMs);
    });
}
ipcRenderer.on("work-queue", async (event, data) => {
    let result = undefined;
    try {
        switch (data.task.action) {
            case "insert-or-update-file":
                result = await FileImportHelper.importUpdateFileWorker(data.task.data, data.sharedData);
                break;
            case "activate-deactivate":
                result = await BatchHelper.activateDeactivateFileWorker(data.task.data, data.sharedData);
                break;
            case "bundle-file-info":
                result = await CommunityFileInfoBundle.createBundle(data.task.data.fingerprint);
                break;
            case "bundle-file-thumbnail":
                result = await CommunityFileInfoBundle.createThumbnailBundle(data.task.data.fingerprint, data.task.data.image_source, data.task.data.image);
                break;
            case "calc-poly-cas-count":
                result = ToolPolyCountWorkerUtils.calcPolyCountForCaspDBElement(data.task.data);
                break;
            case "calc-poly-cobj-count":
                result = ToolPolyCountWorkerUtils.calcPolyCountForCobjDBElement(data.task.data);
                break;
            case "check-file-rmap-bounds":
                result = ToolRMapWorkerUtils.checkFileRmapBounds(data.task.data);
                break;
            case "recalc-package-file":
                result = await BatchHelper.recalcPackageFileWorker(data.task.data);
                break;
            case "refresh-internal-thumbnail":
                result = await BatchHelper.refreshInternalThumbnailWorker(data.task.data, data.sharedData);
                break;
            case "scan-game-file":
                result = await BatchHelper.scanGameFileWorker(data.task.data);
                break;
            case "get-hq-texture-info":
                result = await ToolHQTexturesWorkerUtils.getHQTextureInfo(data.task.data, data.sharedData);
                break;
            case "exportAllThumbnails":
                result = await ToolCCDetectWorkerUtils.exportAllThumbnails(data.task.data);
                break;
            case "findClosestHash":
                result = await ToolCCDetectWorkerUtils.findClosestHash(data.task.data);
                break;
        }
    }
    catch (error) {
        console.log(error);
        console.log("Data: " + JSON.stringify(data));
    }
    // Send the result back to the main process
    event.sender.send(data.channel, {
        index: data.index,
        result: result,
        action: data.returnAction ? data.returnAction : undefined,
    });
    // Clean up references
    result = null;
    data.task.data = null;
    data.sharedData = null;
});
//GameState
let gamestatecontroller = undefined;
function createGameStateController(isMac, settings) {
    gamestatecontroller = new GameState(gameStateChange, 5000, 20000, isMac);
    if (!gamestatecontroller)
        return;
    gamestatecontroller.setGameFolder(settings.s_game_orgin);
    gamestatecontroller.updateIsOn(settings.s_game_state_check == true);
}
function gameStateChange(data) {
    //ipcRenderer.send("simple-task", { channel: "app", data: data, task: "send-to-win" });
    ipcRenderer.send("gamestate-controller", { action: "update-game-state", isGameRunning: data.gameIsOpen });
}
ipcRenderer.on("gamestate", async (event, data) => {
    switch (data.action) {
        case "create-controller":
            if (gamestatecontroller)
                return;
            createGameStateController(data.isMac, data.settings);
            break;
        case "start-game":
            if (!gamestatecontroller)
                return;
            gamestatecontroller.startGame(data.gamepath, data.isMac, data.args);
            break;
        case "update-settings":
            if (!gamestatecontroller)
                return;
            gamestatecontroller.setGameFolder(data.settings.s_game_orgin);
            gamestatecontroller.updateIsOn(data.settings.s_game_state_check == true);
            break;
        case "focus-change":
            if (!gamestatecontroller)
                return;
            gamestatecontroller.changeFocusState(data.focus);
            break;
    }
});
console.log('Worker is ready');
ipcRenderer.send('worker-ready');
