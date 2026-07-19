"use strict";
// TypeScript version of swipeServer.js
// Cleaned up and refactored for type safety and clarity
var { ipcRenderer } = require('electron');
var path = require('path');
var fs = require('fs');
var util = require('util');
var express = require('express');
var cors = require('cors');
var { WebSocketServer } = require('ws');
var os = require('os');
let app = express();
let imageFolder;
let baseFolder;
let logFolder;
const PORT_WSS = 8080;
const PORT_EXPRESS = 3000;
let connected = false;
let connected_name = undefined;
let online = false;
let wsp = undefined;
const ccSwiperVersion = 6;
// IPC IONIC CONNECTION
const localListener = new Map();
ipcRenderer.on('ipc-connect-send', async (_event, data) => {
    data.type = 'send';
    sendMessageIPC(data);
});
function handleMessageIPC(buffer) {
    try {
        const obj = JSON.parse(buffer.toString());
        //console.log('[IPC CONNECT] Received:', obj);
        switch (obj.type) {
            case 'send':
                ipcSendSwiper(obj);
                break;
            case 'invoke':
                ipcInvokeSwiper(obj);
                break;
            case 'base': {
                const fun = localListener.get(obj.channel);
                if (fun)
                    fun(obj.data);
                break;
            }
            case 'ping':
                // Already handled with each message received
                break;
            default:
                sendMessageIPC({ type: 'toast', msg: 'Invalid request! (No type)' });
        }
    }
    catch (error) {
        console.log(error);
    }
}
function setupLocalListener() {
    localListener.set('status', (data) => {
        if (!data)
            return;
        if (data.action === 'set-name') {
            connected_name = data.name;
            sendInfo();
        }
    });
    localListener.set('cards', (data) => {
        if (!data)
            return;
        if (data.action === 'ask-for-cards') {
            handleAskForCards(data.filter, data.count ?? 3, data.returnChannel, data.forceReload);
        }
        else if (data.action === 'process-card') {
            handleProcessCard(data);
        }
    });
}
function ipcSendSwiper(sendObj) {
    ipcRenderer.send(sendObj.channel, sendObj.data);
}
async function ipcInvokeSwiper(invokeObj) {
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
        type: 'invoke',
        id: invokeObj.id,
        data: result,
        error: error,
    };
    sendMessageIPC(obj);
}
function sendMessageIPC(body) {
    if (!connected || !wsp)
        return;
    wsp.send(JSON.stringify(body));
    //console.log('[IPC CONNECT] Sent:', body);
}
// LocalSwipe
let localCards = [];
let sendCards = [];
let lastFilter = '';
function resetCards() {
    localCards = [];
    sendCards = [];
}
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
async function handleAskForCards(filter, count, returnChannel, forceReload) {
    const newFilter = JSON.stringify(filter);
    const sameFilter = newFilter === lastFilter;
    lastFilter = newFilter;
    const result = {
        items: [],
        sendItems: [],
        isEmpty: true,
        newSearch: false,
    };
    if (!sameFilter || forceReload) {
        resetCards();
        result.newSearch = true;
        try {
            const cards = await ipcRenderer.invoke('cc-swiper', { action: 'run-filter', filter });
            localCards = shuffle(cards);
        }
        catch (error) {
            console.log(error);
            result.isEmpty = true;
        }
    }
    sendCards = sendCards.filter((element) => fs.existsSync(path.join(element.path, element.name)));
    result.sendItems.push(...sendCards);
    if (localCards.length > 0) {
        let newCards = localCards.splice(0, count);
        newCards = newCards.filter((element) => fs.existsSync(path.join(element.path, element.name)));
        sendCards.push(...newCards);
        result.items = newCards;
    }
    result.isEmpty = localCards.length === 0;
    console.log(result);
    sendMessageIPC({
        type: 'send',
        channel: returnChannel,
        data: { action: 'add-cards', result },
    });
}
async function handleProcessCard(data) {
    if (!data || !data.id || data.state === undefined)
        return;
    sendCards = sendCards.filter((element) => element.id !== data.id);
    try {
        await ipcRenderer.invoke('cc-swiper', { action: 'update-state', id: data.id, state: data.state });
    }
    catch (err) {
        console.log(err);
    }
}
// Interface
let lastPing = 0;
const pingLimit = 3;
const pingInterval = 7000;
function handlePing() {
    lastPing = Date.now();
}
function pingConnection() {
    setInterval(() => {
        if (!connected || !wsp)
            return;
        if (lastPing + pingInterval < Date.now())
            sendMessageIPC({ type: 'ping' });
        const maxTime = lastPing + pingLimit * pingInterval;
        if (maxTime < Date.now()) {
            closeConnection();
        }
    }, pingInterval);
}
function closeConnection() {
    if (!wsp)
        return;
    wsp.close(1000, 'Closing connection');
}
async function startCCSwiperServer() {
    const wss = new WebSocketServer({ port: PORT_WSS });
    console.log('[SERVER-SOCKET] Listening on ws://localhost:8080/');
    online = true;
    wss.on('connection', (ws) => {
        if (connected) {
            ws.close(1000, 'Only one connection allowed');
            console.log('[CLIENT] New connection attempt rejected');
            return;
        }
        console.log('[CLIENT] Client connected');
        wsp = ws;
        handlePing();
        connected_name = 'Unknown';
        if (!connected) {
            connected = true;
            const obj = {
                type: 'send',
                channel: 'app',
                data: { action: 'init-connection' },
            };
            sendMessageIPC(obj);
        }
        else {
            connected = true;
        }
        sendInfo();
        ws.on('message', (message) => {
            handlePing();
            handleMessageIPC(message);
        });
        ws.on('close', () => {
            console.log('[CLIENT] Client disconnected');
            connected = false;
            wsp = undefined;
            connected_name = undefined;
            sendInfo();
        });
        ws.on('error', (error) => {
            console.log('[CLIENT] ERROR');
            console.log(error);
            ws.close(1000, 'Closed! Error');
            connected = false;
            wsp = undefined;
            connected_name = undefined;
            sendInfo();
        });
    });
    app.use(cors());
    app.options('*', cors());
    app.use(express.static(baseFolder));
    app.use(express.json({ limit: '80mb' }));
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        next();
    });
    app.listen(PORT_EXPRESS, '0.0.0.0', () => {
        console.log(`[SERVER-EXPRESS] Listening on http://0.0.0.0:${PORT_EXPRESS}/`);
        online = true;
    });
    app.get('/online', (_req, res) => {
        let name = os.userInfo().username;
        const isWin = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        if (isWin)
            name = `${name}'s PC`;
        if (isMac)
            name = `${name}'s Mac`;
        res.send({
            status: 'online',
            name,
            version: ccSwiperVersion,
            connection: {
                connected,
                name: connected_name,
                ws: wsp !== undefined,
            },
        });
    });
    pingConnection();
}
function sendInfo() {
    const info = {
        action: 'info',
        status: 2,
        connected,
        online,
        name: connected_name,
    };
    ipcRenderer.send('swiper', { action: 'send-info', info });
}
async function setup(baseFolderP, _f, logFolderPath) {
    imageFolder = path.join(baseFolderP, 'mods-assets', 'images');
    baseFolder = baseFolderP;
    logFolder = logFolderPath;
    if (!fs.existsSync(imageFolder) || !fs.existsSync(baseFolderP)) {
        return false;
    }
    /*if (logFolder && fs.existsSync(logFolder)) {
      const log_file = fs.createWriteStream(path.join(logFolder, 'swipe_server.log'), { flags: 'w' });
      const log_stdout = process.stdout;
      console.log = function (d: any) {
        log_file.write(util.format(d) + '\n');
        log_stdout.write(util.format(d) + '\n');
      };
    }*/
    console.log(`[Server] Started Server - ${process.pid}`);
    try {
        setupLocalListener();
        await startCCSwiperServer();
    }
    catch (error) {
        online = false;
        console.log('[SERVER] Failed to start server');
        console.log(error);
        return false;
    }
    sendInfo();
    return true;
}
ipcRenderer.on('setup', async (_event, data) => {
    console.log('[SWIPE SERVER] Setup called', data);
    const suc = await setup(data.baseFolderPath, data.filter, data.logFolderPath);
    console.log('[SWIPE SERVER] Setup finished', suc);
    ipcRenderer.send('swiper', { action: 'setup-info', ok: suc });
});
ipcRenderer.on('get-info', async () => {
    sendInfo();
});
console.log('[SWIPE SERVER] Loaded swipeServer.ts');
