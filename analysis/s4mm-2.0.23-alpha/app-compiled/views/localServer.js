"use strict";
var { ipcRenderer } = require('electron');
var os = require('os');
var express = require('express');
var cors = require('cors');
const port = 3334;
var appExpress = express();
async function startServer(baseFolder) {
    appExpress.use(cors());
    appExpress.options('*', cors());
    appExpress.use(express.static(baseFolder));
    appExpress.use(express.json({ limit: '80mb' }));
    appExpress.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        next();
    });
    appExpress.listen(port, () => {
        console.log(`[SERVER-EXPRESS] Listening on http://localhost:${port}/`);
    });
    appExpress.get('/online', (req, res) => {
        let name = os.userInfo().username;
        const isWin = process.platform === "win32";
        const isMac = process.platform === "darwin";
        if (isWin)
            name = `${name}'s PC`;
        if (isMac)
            name = `${name}'s Mac`;
        res.send({
            status: "online",
            name: name
        });
    });
    appExpress.post('/ipc', (req, res) => {
        const body = req.body;
        if (body) {
            console.log("Received message: ", body);
            handleMessage(body);
        }
        res.send({ status: "ok" });
    });
    appExpress.get('/results', (req, res) => {
        res.send({ results: results });
        results = [];
    });
}
let results = [];
function sendMessage(body) {
    results.push(body);
}
function handleMessage(obj) {
    try {
        if (obj.type === "send") {
            ipcSend(obj);
        }
        else if (obj.type === "invoke") {
            ipcInvoke(obj);
        }
        else if (obj.type) {
            console.log("Unknown message type: " + obj.type);
        }
    }
    catch (error) {
        console.log(error);
    }
}
function ipcSend(sendObj) {
    ipcRenderer.send(sendObj.channel, sendObj.data);
}
async function ipcInvoke(invokeObj) {
    let result = undefined;
    let error = undefined;
    try {
        result = await ipcRenderer.invoke(invokeObj.channel, invokeObj.data);
    }
    catch (e1) {
        console.log(e1);
        error = e1;
    }
    const obj = {
        type: "invoke",
        id: invokeObj.id,
        data: result,
        error: error
    };
    sendMessage(obj);
}
ipcRenderer.on("ipc-connect-send", async (event, data) => {
    data.type = "send";
    sendMessage(data);
});
ipcRenderer.on("setup", async (event, data) => {
    startServer(data.baseFolder);
});
module.exports = {
    startServer
};
