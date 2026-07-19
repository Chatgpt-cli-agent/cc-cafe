const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const util = require('util')
const express = require('express');
const app = express();
const cors = require('cors');
const WebSocket = require('ws');

//Server
const port = 3334;
async function startServer(baseFolder) {

    app.use(cors());
    app.options('*', cors());

    app.use(express.static(baseFolder));

    app.use(express.json({ limit: '80mb' }));
    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        //res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    });
    app.listen(port, function() {
        console.log('[SERVER-EXPRESS] Listening on http://localhost:' + port + '/');
    });

    app.get('/online', (req, res) => {
        let name = require("os").userInfo().username;
        var isWin = process.platform === "win32";
        var isMac = process.platform === "darwin";
        if (isWin) name = name + "'s PC";
        if (isMac) name = name + "'s Mac";
        res.send({
            "status": "online",
            "name": name
        });
    });

    app.post('/ipc', (req, res) => {
        //Get json Body
        let body = req.body;
        if (body) {
            console.log("Received message: ", body);
            handleMessage(body);
        }
        res.send({ status: "ok" });
    });

    app.get('/results', (req, res) => {
        res.send({ results: results });
        results = [];
    });
}


//Back And Forth

let results = [];

function sendMessage(body) {
    //console.log("Sending message: " + JSON.stringify(body));
    //wsp.send(JSON.stringify(body));
    results.push(body);
}

function handleMessage(obj) {
    try {
        //let obj = JSON.parse(buffer.toString());
        //console.log(obj);
        if (obj.type == "send") {
            ipcSend(obj);
        } else if (obj.type == "invoke") {
            ipcInvoke(obj);
        } else if (obj.type) {
            console.log("Unknown message type: " + obj.type);
        }
    } catch (error) {
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
    } catch (e1) {
        console.log(e1);
        error = e1;
    }
    let obj = {
        type: "invoke",
        id: invokeObj.id,
        data: result,
        error: error
    }
    sendMessage(obj);
}




//IPC
ipcRenderer.on("ipc-connect-send", async(event, data) => {
    data.type = "send";
    sendMessage(data);
});

ipcRenderer.on("setup", async(event, data) => {
    startServer(data.baseFolder);
});