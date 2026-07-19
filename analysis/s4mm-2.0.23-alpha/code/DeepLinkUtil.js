const handleDeepLink = (value, win) => {
    try {
        let webContents = undefined;
        if (win) webContents = win.webContents;
        //console.log(value);
        if (webContents == undefined) return;
        let item = new DeepLinkItem(value);
        console.log(item);
        if (!item.isValid) return;
        switch (item.type) {
            case "login":
                handleLogin(item, webContents);
                break;
            case "login-user":
                handleLoginUser(item, webContents);
                break;
            case "":
                handleEmpty(item, webContents);
                break;
            default:
                console.log("Unknown Deeplink type!");
        }
    } catch (error) {
        console.log(error);
    }
}

function handleLogin(item, webContents) {
    if (!item || !item.values || !item.values.code) return;
    let code = item.values.code;
    webContents.send("overwolf", { action: "login-with-code", code: code });
}

function handleLoginUser(item, webContents) {
    if (!item || !item.values || !item.values.data) return;
    try {
        let obj = JSON.parse(decodeURI(item.values.data));
        webContents.send("overwolf", { action: "login", data: obj });
    } catch (error) {
        console.log(error);
    }
    //webContents.send("app",{action:"login",data:item.values.data});
}

function handleEmpty(item, webContents) {
    //${YOUR_DEEPLINK_SCHEME}://?result=success
    //${YOUR_DEEPLINK_SCHEME}://?result=cancel

    //Is from Checkout
    if (!item.values || !item.values.result) return;
    if (item.values.result == "success" || item.values.result == "cancel") {
        webContents.send("overwolf", { action: "tebex-checkout", result: item.values.result });
    }
}

class DeepLinkItem {

    str = "";
    isValid = false;
    values = {};
    type = "unknown";

    constructor(deeplinkStr) {
        this.str = deeplinkStr;
        this.checkIfValid();
        if (!this.isValid) return;
        this.process();
    }

    checkIfValid() {
        this.isValid = this.str != undefined && this.str.startsWith("sims4modmanager://");
    }

    process() {
        //Type
        let dataStr = this.str.substring(18);
        let firstQuestionMark = dataStr.indexOf("?");
        if (firstQuestionMark == undefined) {
            this.type = dataStr;
            return;
        } else {
            this.type = dataStr.substring(0, firstQuestionMark);
            dataStr = dataStr.substring(firstQuestionMark + 1);
        }
        if (this.type.endsWith("/")) this.type = this.type.substring(0, this.type.length - 1);

        //Values
        while (dataStr.includes("=")) {
            let splitIndex = dataStr.indexOf("=");
            let key = dataStr.substring(0, splitIndex);
            let restStr = dataStr.substring(splitIndex + 1);
            let value = "";
            if (restStr.includes("&")) {
                let andPos = restStr.indexOf("&");
                value = restStr.substring(0, andPos);
                restStr = restStr.substring(andPos + 1)
            } else {
                value = restStr;
                restStr = "";
            }
            dataStr = restStr;
            if (key && value) {
                this.values[key] = value;
            }
        }
    }

}

exports.handleDeepLink = handleDeepLink;