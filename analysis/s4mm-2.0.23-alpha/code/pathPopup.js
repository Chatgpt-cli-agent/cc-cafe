const { ipcRenderer } = require('electron');

var bt_back = document.getElementById("bt_back");
var bt_confirm = document.getElementById("bt_confirm");
var bt_change_modFolder = document.getElementById("bt_change_modFolder");
var bt_change_simsFolder = document.getElementById("bt_change_simsFolder");
var bt_confirm = document.getElementById("bt_confirm");
var a_help = document.getElementById("a_help");
var input_modFolder = document.getElementById("input_modFolder");
var input_simsFolder = document.getElementById("input_simsFolder");

let value_modFolder = "";
let value_simsFilder = "";


ipcRenderer.on("pathPopup", (event, data) => {
    if (data.err) {
        alert(data.err);
    } else if (data.dialogResult && data.data) {
        if (data.dialogResult && data.dialogResult.canceled == false) {
            let paths = data.dialogResult.filePaths
            let path = "";
            if (paths.length > 0) path = paths[0];
            if (data.data.folder == 1) {
                input_modFolder.value = path;
                value_modFolder = path;
            } else if (data.data.folder == 2) {
                input_simsFolder.value = path;
                value_simsFilder = path;
            }
            checkValues();
        }
    }
});

function checkValues() {
    bt_confirm.disabled = (value_modFolder.length == 0);
}

bt_back.onclick = function() {
    ipcRenderer.send("pathPopup", { "action": "close" });
};

bt_confirm.onclick = function() {
    ipcRenderer.send("pathPopup", {
        "action": "confirm",
        "value_modFolder": value_modFolder,
        "value_simsFilder": value_simsFilder
    });
};

a_help.onclick = function() {
    ipcRenderer.send("openUrl", { "url": "http://gametimedev.de/S4MM/guide.html" });
};

bt_change_modFolder.onclick = function() {
    ipcRenderer.send("dialog", {
        "title": "Please select your Mod Folder",
        "type": 1,
        "channel": "pathPopup",
        "data": { "folder": 1 }
    });
};

bt_change_simsFolder.onclick = function() {
    ipcRenderer.send("dialog", {
        "title": "Please select your Sims 4 Folder (in documents)",
        "type": 1,
        "channel": "pathPopup",
        "data": { "folder": 2 }
    });
};