"use strict";
exports.__esModule = true;

const path = require('path');

var CurseForge = /** @class */ (function() {

    function CurseForge(knex) {
        this.list = [];
        this.window = undefined;
        this.knex = knex;
    }


    CurseForge.prototype.setWindow = function(win) {
        this.window = win;
    }


    CurseForge.prototype.addItemWindowns = function(args) {
        args.forEach(el => {
            if (el.startsWith("sims4modmanager//")) this.addItemURL(el);
        });
    }

    CurseForge.prototype.convertItemUrl = function(url) {
        //sims4modmanager//fileId=4136927
        let id = undefined;
        if (url.includes("sims4modmanager//")) {

            let clean = decodeURI(url);
            clean = clean.replace(/\$\§\$/g, "\"");
            let parts = clean.replace("sims4modmanager//", "");
            parts = parts.replace("itemData=", "");
            parts = parts.replace("/", "");



            try {
                console.log("str: " + parts);
                let idNumber = Number(parts);
                let item = {
                    "id": idNumber
                };
                return item
            } catch (err) {
                return undefined;
            }

            /*
            parts = parts.replace("/", "");
            let paras = parts.split("&");
            let obj = {};

            paras.forEach(element => {
                let sp = element.split("=");
                if (sp.length == 2) {
                    obj[sp[0]] = sp[1];
                }

            });

            if (obj.fileId) {
                id = obj.fileId;
            }

            //console.log(obj);
            */

        } else {
            return id;
        }
    }


    CurseForge.prototype.addItemURL = function(url) {
        //sims4modmanager//fileId=4136927
        let id = undefined;
        if (url.includes("sims4modmanager//")) {

            let clean = decodeURI(url);
            clean = clean.replace(/\$\§\$/g, "\"");
            let parts = clean.replace("sims4modmanager//", "");
            parts = parts.replace("itemData=", "");

            if (parts.endsWith("/")) parts.substring(0, parts.length - 1);
            if (!parts.startsWith("{") || !parts.endsWith("}")) return;

            id = JSON.parse(parts);


            /*
            parts = parts.replace("/", "");
            let paras = parts.split("&");
            let obj = {};

            paras.forEach(element => {
                let sp = element.split("=");
                if (sp.length == 2) {
                    obj[sp[0]] = sp[1];
                }

            });

            if (obj.fileId) {
                id = obj.fileId;
            }

            //console.log(obj);
            */

        } else {
            return;
        }



        if (id == undefined) return;

        this.addItem(id);
    }

    CurseForge.prototype.addItem = function(id) {
        let con = false;
        this.list.forEach(element => {
            if (element.id == id.id) {
                con = true;
            }
        });

        if (!con) this.list.push(id);

        this.update();
    }

    CurseForge.prototype.addCCBasket = function(data) {
        if (!data) return;

        data.forEach((element) => {

            this.addItem(element);

        });

    }

    CurseForge.prototype.remove = function(id) {
        for (let index = this.list.length - 1; index > 0; index--) {
            const element = this.list[index];
            if (element.id == id) {
                this.list.splice(index, 1);
            }
        }
        this.update();
    }

    CurseForge.prototype.update = function() {
        if (!this.window) return;
        this.window.webContents.send("tab-control", { "downloadCount": this.list.length });
        this.window.webContents.send("cf-downloads", { "action": "display", "list": this.list });
    }

    CurseForge.prototype.getIdList = function() {
        return this.list;
    }

    return CurseForge;
}());

exports.CurseForge = CurseForge;