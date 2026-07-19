"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
console.log("Preload script loaded.");
electron_1.contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        on: (channel, listener) => electron_1.ipcRenderer.on(channel, listener),
        send: (channel, data) => electron_1.ipcRenderer.send(channel, data),
        invoke: async (channel, data) => {
            try {
                return await electron_1.ipcRenderer.invoke(channel, data);
            }
            catch (error) {
                console.error(`Error in ipcRenderer.invoke for channel "${channel}":`, error);
                throw error; // Re-throw the error so it propagates to the renderer process
            }
        },
        removeAllListeners: (channel) => electron_1.ipcRenderer.removeAllListeners(channel),
    },
    webFrame: {
        setZoomFactor: (factor) => electron_1.webFrame.setZoomFactor(factor),
        getZoomFactor: () => electron_1.webFrame.getZoomFactor(),
    },
    getFilePath: (file) => {
        return electron_1.webUtils.getPathForFile(file);
    },
});
