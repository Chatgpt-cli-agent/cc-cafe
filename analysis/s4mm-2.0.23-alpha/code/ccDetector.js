const { ipcRenderer } = require('electron');
const path = require('path');

const aliveTime = 4000;

var closeButton = document.getElementById("bt_close");
closeButton.onclick = function() {
    ipcRenderer.send("thumbnail-detect_on", { action: "close-from-overlay" });
};

ipcRenderer.on("screenshot-detect-service", (event, data) => {
    console.log(data);
    if (data && data.item && (data.action == "new-item" || data.action == "update-item")) processItem(data.item);
});

var item_1 = document.getElementById("item-1");
var item_2 = document.getElementById("item-2");
var item_3 = document.getElementById("item-2");
var item_1_img = document.getElementById("item-1-img");
var item_2_img = document.getElementById("item-2-img");
var bottomText = document.getElementById("bottom-message");
var warningText = document.getElementById("warning");
let current = undefined;

function setImageOfItem(item, src) {
    item.src = src;
}

function setText(element, text) {
    element.innerText = text;
}

function processItem(item) {
    resetAll()
    current = item;

    if (!item.image) {
        //No CC Detected
        toggleExist(warningText, true);
        goAway();
        return;
    }

    //Set image
    setImageOfItem(item_1_img, item.image);
    toggleExist(item_1, true);

    if (item.state == 2 && !item.info) {
        //Not found!
        setText(bottomText, "No result!");
        toggleExist(item_3, true);
    } else {
        setText(bottomText, "Proccesing...");
    }

    //Has secound
    if (item.info && item.info.thumbnail) {
        setImageOfItem(item_2_img, path.join(item.info.thumbnail.thumbnailFolder, item.info.thumbnail.image));
        toggleExist(item_2, true);
        setText(bottomText, "Found item/items");
    } else {
        toggleExist(item_2, false);
    }
    goAway();
}

function goAway() {
    let c = current;
    setTimeout(() => {
        if (c == current) resetAll();
    }, aliveTime)
}

function resetAll() {
    setText(bottomText, "Waiting for screenshot...");
    toggleExist(item_1, false);
    toggleExist(item_2, false);
    toggleExist(item_3, false);
    toggleExist(warningText, false);

}





//UI
function setStyle(element, style) {
    element.style.display = style;
}

function toggleExist(element, alive) {
    setStyle(element, alive ? "flex" : "none");
}