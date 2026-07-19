"use strict";
exports.__esModule = true;

const https = require('https');
let url = "https://api.gametimedev.de/S4MM/getRelease.php";

var VersionHelper = /** @class */ (function() {

    function VersionHelper(version) {
        this.needsUpdate = false;
        this.checked = false;
        this.isPre = false;
        this.version = version;
        this.beta = false;
        this.preIndex = 0;
        this.t = 0;
        this.m = 0;
        this.b = 0;
        this.newVersion = {};

        //Pre
        if(this.version.includes("-pre")){
            let vsp = this.version.split("-pre");
            this.preIndex = vsp[1];
            this.version = vsp[0];
            this.isPre = true;
        }

        //Beta
        if (this.version.endsWith("-beta")) {
            this.beta = true;
            this.version = this.version.replace("-beta", "");
        } else if (this.version.endsWith("-alpha")) {
            this.beta = true;
            this.isPre = true;
            this.version = this.version.replace("-alpha", "");
        }

        //Version
        if (this.version.includes(".")) {
            let parts = this.version.split(".");
            if (parts.length == 3) {
                this.t = parts[0];
                this.m = parts[1];
                this.b = parts[2];
            }
        }
    }

    VersionHelper.prototype.needsUpdate = async function() {
        return this.needsUpdate;
    }

    VersionHelper.prototype.wasChecked = async function() {
        return this.checked;
    }

    VersionHelper.prototype.checkForUpdate = async function(pre, os) {
        let link = url + "?pre=" + pre + "&os=" + os;
        //console.log(link);
        https.get(link, (res) => {
            let body = "";
            res.on("data", (chunk) => {
                body += chunk;
            });
            res.on("end", () => {
                this.checked = true;
                try {
                    let json = JSON.parse(body);
                    //console.log(json);
                    this.needsUpdate = this.isNewer(json);
                } catch (error) {
                    console.log(error)
                        //NIX
                };
            });
        }).on("error", (error) => {
            console.log(error);
            this.checked = true;
        });
    }

    VersionHelper.prototype.isNewer = function(json) {
        //Check Json
        if (!json.hasOwnProperty('beta') ||
            !json.hasOwnProperty('t') ||
            !json.hasOwnProperty('m') ||
            !json.hasOwnProperty('b') ||
            !json.hasOwnProperty('isPre')) {
            return false;
        }

        if (json["isPre"] == true) this.isPre = true;

        //Set values
        let beta = json["beta"];
        let t = json["t"];
        let m = json["m"];
        let b = json["b"];

        this.newVersion = {
            "beta": beta,
            "t": t,
            "m": m,
            "b": b
        };


        if (beta == false && this.beta == true) {
            return true;
        } else if (beta == true && this.beta == false) {
            return false;
        }
        if (t > this.t) {
            return true;
        } else if (t < this.t) {
            return false;
        }
        if (m > this.m) {
            return true;
        } else if (m < this.m) {
            return false;
        }
        if (b > this.b) {
            return true;
        } else {
            return false;
        }
    }

    VersionHelper.prototype.getInfo = function() {
        let st_version_old = this.t + "." + this.m + "." + this.b;
        if (this.beta) st_version_old = "[B]" + st_version_old;

        let st_version_new = "-";
        let newVersion = this.newVersion;
        if (newVersion.hasOwnProperty('beta') && newVersion.hasOwnProperty('t') &&
            newVersion.hasOwnProperty('m') && newVersion.hasOwnProperty('b')) {
            st_version_new = newVersion.t + "." + newVersion.m + "." + newVersion.b;
            if (newVersion.beta) st_version_new = "[B]" + st_version_new;
        }

        let info = {
            "needsUpdate": this.needsUpdate,
            "isPrerelease": this.isPre,
            "newVersion": st_version_new,
            "oldVersion": st_version_old,
            "wasChecked": this.checked,
            "preIndex":this.preIndex
        };
        return info;
    }

    VersionHelper.prototype.fixImagesInChangelog = function(data) {
        let str = data.trim().split("\r\n").join("");
        while (str.includes("src=\"assets/")) {
            str = str.replace("src=\"assets/", "src=\"https://s4mm.gametimedev.de/assets/");
        }
        return str;
    }

    return VersionHelper;
}());

exports.VersionHelper = VersionHelper;