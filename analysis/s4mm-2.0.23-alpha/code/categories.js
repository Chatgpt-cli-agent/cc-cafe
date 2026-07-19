"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Categories = void 0;
var path = require('path');
var fs = require('fs');
var Categories = /** @class */ (function () {
    function Categories(knex, loadUnloadFiles) {
        this.swipeServer = undefined;
        this.tagCatalog = [];
        this.tagSet = new Set();
        this.knex = knex;
        this.loadUnloadFiles = loadUnloadFiles;
    }
    Categories.prototype.setSwipeServer = function (server) {
        this.swipeServer = server;
    };
    Categories.prototype.eventSender = function (swipeServer, event, channel, data) {
        event.sender.send(channel, data);
        if (swipeServer)
            swipeServer.webContents.send("ipc-connect-send", { channel: channel, data: data });
    };
    Categories.prototype.categoriesAdd = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var cName, rows, id, categories;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cName = data.name;
                        return [4 /*yield*/, this.knex.select().where("name", cName).from("Categories")];
                    case 1:
                        rows = _a.sent();
                        if (rows.length != 0) {
                            this.eventSender(this.swipeServer, event, "categories", { "action": "name-in-use" });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.knex('Categories').insert({
                                "name": cName,
                                "autotag": 1,
                                "onpreview": 1,
                                "tags": "",
                                "ntags": ""
                            })];
                    case 2:
                        id = _a.sent();
                        data.id = id;
                        data.order = id;
                        this.categoriesUpdateOrder(event, data);
                        return [4 /*yield*/, this.knex.select().from("Categories").orderBy("order")];
                    case 3:
                        categories = _a.sent();
                        this.eventSender(this.swipeServer, event, "categories", { "action": "display", "categories": categories });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesRemove = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var cId, idTag, list, categories;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cId = data.id;
                        //Remove form Categories
                        return [4 /*yield*/, this.knex.where('id', cId).from("Categories").del()
                            //Remove form Files
                        ];
                    case 1:
                        //Remove form Categories
                        _a.sent();
                        idTag = "<" + cId + ">";
                        return [4 /*yield*/, this.knex.select(["id", "categories"]).from("Files").whereLike("categories", "%" + idTag + "%")];
                    case 2:
                        list = _a.sent();
                        list.forEach(function (element) { return __awaiter(_this, void 0, void 0, function () {
                            var old;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        old = element.categories;
                                        old = old.replace(idTag, "");
                                        return [4 /*yield*/, this.knex('Files').update("categories", old).where("id", element.id)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, this.knex.select().from("Categories").orderBy("order")];
                    case 3:
                        categories = _a.sent();
                        this.eventSender(this.swipeServer, event, "categories", { "action": "display", "categories": categories });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesUpdate = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var cId, cName, cAutotag, cOnpreview, cTags, cNTags, update, categories;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cId = data.id;
                        cName = data.name;
                        cAutotag = data.autotag;
                        cOnpreview = data.onpreview;
                        cTags = data.tags;
                        cNTags = data.ntags;
                        update = data.update;
                        return [4 /*yield*/, this.knex.where("id", cId).from("Categories").update({
                                "name": cName,
                                "autotag": cAutotag,
                                "onpreview": cOnpreview,
                                "tags": cTags,
                                "ntags": cNTags
                            })];
                    case 1:
                        _a.sent();
                        if (!update) {
                            this.categoriesGetLight(event);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.knex.select().from("Categories").orderBy("order")];
                    case 2:
                        categories = _a.sent();
                        this.eventSender(this.swipeServer, event, "categories", { "action": "display", "categories": categories });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesUpdateOrder = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var cId, cOrder, update, categories;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cId = data.id;
                        cOrder = data.order;
                        update = data.update;
                        return [4 /*yield*/, this.knex.where("id", cId).from("Categories").update({
                                "order": cOrder
                            })];
                    case 1:
                        _a.sent();
                        if (!update) {
                            this.categoriesGetLight(event);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.knex.select().from("Categories").orderBy("order")];
                    case 2:
                        categories = _a.sent();
                        this.eventSender(this.swipeServer, event, "categories", { "action": "display", "categories": categories });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesGet = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var categories;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.knex.select().from("Categories").orderBy("order")];
                    case 1:
                        categories = _a.sent();
                        this.eventSender(this.swipeServer, event, "categories", { "action": "display", "categories": categories });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesGetBasic = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.knex.select(["id", "name", "onpreview"]).from("Categories").orderBy("order")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Categories.prototype.categoriesGetLight = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var categories;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.knex.select(["id", "name", "onpreview"]).from("Categories").orderBy("order")];
                    case 1:
                        categories = _a.sent();
                        this.eventSender(this.swipeServer, event, "update-categories", { "action": "update-categories-values", "categories": categories });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesGetLightAsList = function () {
        return __awaiter(this, void 0, void 0, function () {
            var list;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        list = [];
                        return [4 /*yield*/, this.knex.select().from("Categories")];
                    case 1:
                        list = _a.sent();
                        return [2 /*return*/, list];
                }
            });
        });
    };
    Categories.prototype.categoriesAutoRun = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var channel, title, specialID, categories, max, selection, _loop_1, this_1, index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        channel = data.channel;
                        title = "Checking file names";
                        specialID = undefined;
                        if (data && data.specialID != undefined)
                            specialID = data.specialID;
                        categories = undefined;
                        if (!(specialID == undefined)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.knex.select(["id", "name", "tags", "ntags"]).from("Categories").where("autotag", 1).orderBy("order")];
                    case 1:
                        categories = _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.knex.select(["id", "name", "tags", "ntags"]).from("Categories").where("id", specialID).orderBy("order")];
                    case 3:
                        categories = _a.sent();
                        _a.label = 4;
                    case 4:
                        max = categories.length;
                        selection = ["id", "categories"];
                        this.eventSender(this.swipeServer, event, channel, { "value": 0, "max": max, "title": title, "close": false });
                        _loop_1 = function (index) {
                            var element, tags, ntags, idTag, req, items, i, element_1, old;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        element = categories[index];
                                        tags = [];
                                        if (element.tags)
                                            tags = element.tags.trim().length > 0 ? element.tags.split("§") : [];
                                        ntags = [];
                                        if (element.ntags)
                                            ntags = element.ntags.trim().length > 0 ? element.ntags.split("§") : [];
                                        idTag = "<" + element.id + ">";
                                        if (tags.length == 0 && ntags.length == 0) {
                                            this_1.eventSender(this_1.swipeServer, event, channel, { "value": (index + 1), "max": max, "title": title, "close": false });
                                            return [2 /*return*/, "continue"];
                                        }
                                        req = this_1.knex.select(selection).where(function (qb) {
                                            //Postive tags
                                            for (var j = 0; j < tags.length; j++) {
                                                var singleTag = tags[j].replace(/_/g, "\\_");
                                                if (singleTag.length != 0) {
                                                    if (j == 0) {
                                                        //qb.whereLike("name", "%" + singleTag + "%");
                                                        qb.whereRaw("name LIKE '%" + singleTag + "%' ESCAPE '\\'");
                                                    }
                                                    else {
                                                        //qb.orWhereLike("name", "%" + singleTag + "%");
                                                        qb.orWhereRaw("name LIKE '%" + singleTag + "%' ESCAPE '\\'");
                                                    }
                                                }
                                            }
                                            //Negativ tags
                                            for (var j = 0; j < ntags.length; j++) {
                                                var singleTag = ntags[j].replace(/_/g, "\\_");
                                                if (singleTag.length != 0) {
                                                    if (j == 0) {
                                                        //qb.whereLike("name", "%" + singleTag + "%");
                                                        qb.whereRaw("name NOT LIKE '%" + singleTag + "%' ESCAPE '\\'");
                                                    }
                                                    else {
                                                        //qb.orWhereLike("name", "%" + singleTag + "%");
                                                        qb.andWhereRaw("name NOT LIKE '%" + singleTag + "%' ESCAPE '\\'");
                                                    }
                                                }
                                            }
                                        }).andWhere(function (qb) {
                                            qb.where("categories", "not like", "%" + idTag + "%");
                                            qb.orWhereNull("categories");
                                        }).from("Files");
                                        return [4 /*yield*/, req];
                                    case 1:
                                        items = _b.sent();
                                        i = 0;
                                        _b.label = 2;
                                    case 2:
                                        if (!(i < items.length)) return [3 /*break*/, 7];
                                        element_1 = items[i];
                                        old = "";
                                        if (element_1.categories && element_1.categories != null)
                                            old = element_1.categories;
                                        old += idTag;
                                        if (!(old && old.trim().length == 0)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, this_1.knex('Files').update("categories", "").where("id", element_1.id)];
                                    case 3:
                                        _b.sent();
                                        return [3 /*break*/, 6];
                                    case 4: return [4 /*yield*/, this_1.knex('Files').update("categories", old).where("id", element_1.id)];
                                    case 5:
                                        _b.sent();
                                        _b.label = 6;
                                    case 6:
                                        i++;
                                        return [3 /*break*/, 2];
                                    case 7:
                                        this_1.eventSender(this_1.swipeServer, event, channel, { "value": (index + 1), "max": max, "title": title, "close": false });
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        index = 0;
                        _a.label = 5;
                    case 5:
                        if (!(index < categories.length)) return [3 /*break*/, 8];
                        return [5 /*yield**/, _loop_1(index)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        index++;
                        return [3 /*break*/, 5];
                    case 8:
                        //this.eventSender(this.swipeServer,event,channel, { "value": (index + 1), "max": max, "title": title, "close": false });
                        this.eventSender(this.swipeServer, event, channel, { "close": true });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesAutoRunNegativ = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var channel, title, specialID, categories, max, selection, _loop_2, this_2, index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        channel = data.channel;
                        title = "Checking file names";
                        specialID = undefined;
                        if (data && data.specialID != undefined)
                            specialID = data.specialID;
                        categories = undefined;
                        if (!(specialID == undefined)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.knex.select(["id", "name", "tags", "ntags"]).from("Categories").where("autotag", 1).orderBy("order")];
                    case 1:
                        categories = _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.knex.select(["id", "name", "tags", "ntags"]).from("Categories").where("id", specialID).orderBy("order")];
                    case 3:
                        categories = _a.sent();
                        _a.label = 4;
                    case 4:
                        max = categories.length;
                        selection = ["id", "categories"];
                        this.eventSender(this.swipeServer, event, channel, { "value": 0, "max": max, "title": title, "close": false });
                        _loop_2 = function (index) {
                            var element, tags, ntags, idTag, req, items, i, element_2, old;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        element = categories[index];
                                        tags = [];
                                        if (element.tags)
                                            tags = element.tags.trim().length > 0 ? element.tags.split("§") : [];
                                        ntags = [];
                                        if (element.ntags)
                                            ntags = element.ntags.trim().length > 0 ? element.ntags.split("§") : [];
                                        idTag = "<" + element.id + ">";
                                        if (tags.length == 0 && ntags.length == 0) {
                                            this_2.eventSender(this_2.swipeServer, event, channel, { "value": (index + 1), "max": max, "title": title, "close": false });
                                            return [2 /*return*/, "continue"];
                                        }
                                        req = this_2.knex.select(selection).where(function (qb) {
                                            for (var j = 0; j < ntags.length; j++) {
                                                var singleTag = ntags[j].replace(/_/g, "\\_");
                                                if (singleTag.length != 0) {
                                                    if (j == 0) {
                                                        //qb.whereLike("name", "%" + singleTag + "%");
                                                        qb.whereRaw("name LIKE '%" + singleTag + "%' ESCAPE '\\'");
                                                    }
                                                    else {
                                                        //qb.orWhereLike("name", "%" + singleTag + "%");
                                                        qb.orWhereRaw("name LIKE '%" + singleTag + "%' ESCAPE '\\'");
                                                    }
                                                }
                                            }
                                        }).andWhere(function (qb) {
                                            qb.where("categories", "like", "%" + idTag + "%");
                                            qb.orWhereNull("categories");
                                        }).from("Files");
                                        return [4 /*yield*/, req];
                                    case 1:
                                        items = _b.sent();
                                        i = 0;
                                        _b.label = 2;
                                    case 2:
                                        if (!(i < items.length)) return [3 /*break*/, 7];
                                        element_2 = items[i];
                                        old = "";
                                        if (element_2.categories && element_2.categories != null)
                                            old = element_2.categories;
                                        old = old.replace(idTag, "");
                                        if (!(old && old.trim().length == 0)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, this_2.knex('Files').update("categories", "").where("id", element_2.id)];
                                    case 3:
                                        _b.sent();
                                        return [3 /*break*/, 6];
                                    case 4: return [4 /*yield*/, this_2.knex('Files').update("categories", old).where("id", element_2.id)];
                                    case 5:
                                        _b.sent();
                                        _b.label = 6;
                                    case 6:
                                        i++;
                                        return [3 /*break*/, 2];
                                    case 7:
                                        this_2.eventSender(this_2.swipeServer, event, channel, { "value": (index + 1), "max": max, "title": title, "close": false });
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        index = 0;
                        _a.label = 5;
                    case 5:
                        if (!(index < categories.length)) return [3 /*break*/, 8];
                        return [5 /*yield**/, _loop_2(index)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        index++;
                        return [3 /*break*/, 5];
                    case 8:
                        //this.eventSender(this.swipeServer,event,channel, { "value": (index + 1), "max": max, "title": title, "close": false });
                        this.eventSender(this.swipeServer, event, channel, { "close": true });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesPopupInfo = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var channel, idList, idListSize, result, categories, cMap, index, element, rows, item, categorie, arr, values, _i, values_1, value, pos, count;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        channel = data.channel;
                        idList = data.ids;
                        idListSize = idList.length;
                        result = [];
                        return [4 /*yield*/, this.knex.select(["id", "name"]).from("Categories").orderBy("order")];
                    case 1:
                        categories = _a.sent();
                        cMap = new Map();
                        categories.forEach(function (element) {
                            element.count = 0;
                            cMap.set(element.id, element);
                        });
                        cMap.set(-1, { "id": -1, "name": "Liked", "count": 0 });
                        cMap.set(-2, { "id": -2, "name": "Skipped", "count": 0 });
                        cMap.set(-3, { "id": -3, "name": "Disliked", "count": 0 });
                        index = 0;
                        _a.label = 2;
                    case 2:
                        if (!(index < idList.length)) return [3 /*break*/, 5];
                        element = idList[index];
                        return [4 /*yield*/, this.knex.select("id", "categories").from("Files").where("id", element)];
                    case 3:
                        rows = _a.sent();
                        if (rows.length != 1)
                            return [3 /*break*/, 4];
                        item = rows[0];
                        categorie = item.categories;
                        if (categorie == null || categorie.length == 0 || !categorie.includes(">"))
                            return [3 /*break*/, 4];
                        arr = categorie.split(">");
                        arr.forEach(function (cat) {
                            cat = cat.replace("<", "");
                            if (cat.length != 0) {
                                var n = +cat;
                                if (cMap.has(n)) {
                                    var e = cMap.get(n);
                                    e.count = e.count + 1;
                                    cMap.set(n, e);
                                }
                            }
                        });
                        _a.label = 4;
                    case 4:
                        index++;
                        return [3 /*break*/, 2];
                    case 5:
                        values = Array.from(cMap.values());
                        for (_i = 0, values_1 = values; _i < values_1.length; _i++) {
                            value = values_1[_i];
                            pos = -1;
                            count = value.count;
                            if (count == idListSize) {
                                pos = 1;
                            }
                            else if (count != 0) {
                                pos = 0;
                            }
                            value.pos = pos;
                            result.push(value);
                        }
                        /*
                        //OLD CODE SLOW?
                        for (let index = 0; index < categories.length; index++) {
                            const element = categories[index];
                            let rows = await this.knex.select("id").from("Files").whereLike("categories", "%<" + element.id + ">%").andWhere((qb) => {
                                for (let j = 0; j < idList.length; j++) {
                                    const id = idList[j];
                                    if (j == 0) {
                                        qb.where("id", id);
                                    } else {
                                        qb.orWhere("id", id);
                                    }
                                }
                            });
                            let rowsCount = rows.length;
                            let pos = -1;
                            if (rowsCount == idListSize) {
                                pos = 1;
                            } else if (rowsCount != 0) {
                                pos = 0;
                            }
                            result.push({ "id": element.id, "name": element.name, "count": rowsCount, "pos": pos });
                        }
                    
                        */
                        this.eventSender(this.swipeServer, event, channel, { "categories": result, "action": "display" });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesPopupChange = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var channel, idList, cList, title, max, sel, result, index, element, rows, item, categorie, j, element_3, cID, cIDTag, change;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        channel = data.channel;
                        idList = data.ids;
                        cList = data.list;
                        title = "Update categories";
                        max = idList.length;
                        sel = ["id", "path", "name", "clear_name", "image", "categories", "recolor", "merged", "casp", "ino"];
                        result = [];
                        this.eventSender(this.swipeServer, event, channel, { "value": 0, "max": max, "title": title, "close": false });
                        index = 0;
                        _a.label = 1;
                    case 1:
                        if (!(index < idList.length)) return [3 /*break*/, 5];
                        element = idList[index];
                        return [4 /*yield*/, this.knex.select(sel).from("Files").where("id", element)];
                    case 2:
                        rows = _a.sent();
                        if (rows.length != 1)
                            return [3 /*break*/, 4];
                        item = rows[0];
                        categorie = item.categories;
                        if (categorie == null)
                            categorie = "";
                        for (j = 0; j < cList.length; j++) {
                            element_3 = cList[j];
                            cID = element_3.id;
                            cIDTag = "<" + cID + ">";
                            change = element_3.change;
                            if (change == 1 && !categorie.includes(cIDTag)) {
                                //Add
                                categorie += cIDTag;
                            }
                            else if (change == -1 && categorie.includes(cIDTag)) {
                                //Remove
                                categorie = categorie.replace(cIDTag, "");
                            }
                        }
                        return [4 /*yield*/, this.knex('Files').update("categories", categorie).where("id", item.id)];
                    case 3:
                        _a.sent();
                        item.categories = categorie;
                        result.push(item);
                        this.eventSender(this.swipeServer, event, channel, { "value": (index + 1), "max": max, "title": title, "close": false });
                        _a.label = 4;
                    case 4:
                        index++;
                        return [3 /*break*/, 1];
                    case 5:
                        this.eventSender(this.swipeServer, event, channel, { "close": true });
                        this.eventSender(this.swipeServer, event, "file-io", { "list": result, "action": "update-items-categories" });
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesPopupChangeSwipeSingle = function (id, swipe) {
        return __awaiter(this, void 0, void 0, function () {
            var sel, rows, item, categorie;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sel = ["id", "categories"];
                        return [4 /*yield*/, this.knex.select(sel).from("Files").where("id", id)];
                    case 1:
                        rows = _a.sent();
                        if (rows.length != 1)
                            return [2 /*return*/];
                        item = rows[0];
                        categorie = item.categories;
                        if (categorie == null)
                            categorie = "";
                        categorie = categorie.replace("<-1>", "");
                        categorie = categorie.replace("<-2>", "");
                        categorie = categorie.replace("<-3>", "");
                        if (swipe == 0)
                            categorie += "<-2>";
                        if (swipe == -1)
                            categorie += "<-3>";
                        if (swipe == 1)
                            categorie += "<-1>";
                        return [4 /*yield*/, this.knex('Files').update("categories", categorie).where("id", item.id)];
                    case 2:
                        _a.sent();
                        item.categories = categorie;
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.categoriesLoadUnloadItems = function (event, data) {
        return __awaiter(this, void 0, void 0, function () {
            var cId, list, numlist, index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cId = data.id;
                        return [4 /*yield*/, this.knex.select("id").from("Files").whereLike("categories", "%<" + cId + ">%")];
                    case 1:
                        list = _a.sent();
                        numlist = [];
                        for (index = 0; index < list.length; index++) {
                            numlist.push(list[index].id);
                        }
                        data.list = numlist;
                        if (this.loadUnloadFiles) {
                            this.loadUnloadFiles(event, data, false).catch(function (err) {
                                console.log(err);
                            });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    Categories.prototype.createTagCatalog = function () {
        return __awaiter(this, void 0, void 0, function () {
            var categories, _loop_3, index;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.tagCatalog = [];
                        this.tagSet = new Set();
                        return [4 /*yield*/, this.knex.select(["id", "name", "tags"]).from("Categories").orderBy("order")];
                    case 1:
                        categories = _a.sent();
                        _loop_3 = function (index) {
                            var element = categories[index];
                            var tagsStr = element.tags;
                            var tags = tagsStr.split("§");
                            var idTag = "<" + element.id + ">";
                            tags.forEach(function (tag) {
                                if (tag.trim().length != 0) {
                                    _this.tagCatalog.push({ "catgorie": idTag, "tag": tag });
                                    _this.tagSet.add(tag);
                                }
                            });
                        };
                        for (index = 0; index < categories.length; index++) {
                            _loop_3(index);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    //Import/Export
    Categories.prototype.categoriesExport = function (filepath) {
        return __awaiter(this, void 0, void 0, function () {
            var categories, files, categoriesObject, byteArr;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("[CATEGORIES] Exporting categories to: " + filepath);
                        return [4 /*yield*/, this.knex.from("Categories").select()];
                    case 1:
                        categories = _a.sent();
                        return [4 /*yield*/, this.knex.from("Files").select("clear_name", "categories").whereNot("categories", "")];
                    case 2:
                        files = _a.sent();
                        categoriesObject = {
                            "categories": categories,
                            "files": files
                        };
                        byteArr = this.categoriesObjectToByteArr(categoriesObject);
                        fs.writeFileSync(filepath, byteArr);
                        /*//Test reverse
                        let reverse = this.byteArrToCategoriesObject(byteArr);
                        let jsonFileReverse = filepath.replace(".s4mmcategories", "_reverse.json");
                        fs.writeFileSync(jsonFileReverse, JSON.stringify(reverse, null, 2));*/
                        return [2 /*return*/, fs.existsSync(filepath)];
                }
            });
        });
    };
    Categories.prototype.categoriesImport = function (filepath) {
        return __awaiter(this, void 0, void 0, function () {
            var byteArr, categoriesObject, categories, files, index, element;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("[CATEGORIES] Importing categories from: " + filepath);
                        if (!fs.existsSync(filepath)) {
                            throw new Error("File not found");
                        }
                        byteArr = fs.readFileSync(filepath);
                        categoriesObject = this.byteArrToCategoriesObject(byteArr);
                        //console.log(categoriesObject);
                        //Clean categories
                        return [4 /*yield*/, this.knex('Categories').del()];
                    case 1:
                        //console.log(categoriesObject);
                        //Clean categories
                        _a.sent();
                        categories = categoriesObject.categories;
                        return [4 /*yield*/, this.knex.batchInsert('Categories', categories, 100)];
                    case 2:
                        _a.sent();
                        //Clean files
                        return [4 /*yield*/, this.knex('Files').update("categories", "")];
                    case 3:
                        //Clean files
                        _a.sent();
                        files = categoriesObject.files;
                        index = 0;
                        _a.label = 4;
                    case 4:
                        if (!(index < files.length)) return [3 /*break*/, 7];
                        element = files[index];
                        return [4 /*yield*/, this.knex('Files').update("categories", element.categories).where("clear_name", element.clear_name)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        index++;
                        return [3 /*break*/, 4];
                    case 7: return [2 /*return*/, true];
                }
            });
        });
    };
    Categories.prototype.categoriesObjectToByteArr = function (categoriesObject) {
        var bufferArray = [];
        // Write Header
        var magicWord = 'CCEX';
        var version = 1;
        // Write Magic Word CCEX
        bufferArray.push(Buffer.from(magicWord, 'utf-8'));
        // Write Version 1
        var versionBuffer = Buffer.alloc(4);
        versionBuffer.writeInt32LE(version, 0);
        bufferArray.push(versionBuffer);
        // Write categories count (int)
        var categoriesCount = categoriesObject.categories.length;
        var categoriesCountBuffer = Buffer.alloc(4);
        categoriesCountBuffer.writeInt32LE(categoriesCount, 0);
        bufferArray.push(categoriesCountBuffer);
        // Write categories
        categoriesObject.categories.forEach(function (category) {
            //Write id (int)
            var idBuffer = Buffer.alloc(4);
            idBuffer.writeInt32LE(category.id, 0);
            bufferArray.push(idBuffer);
            // Write auto tag (bool)
            var autoTagBuffer = Buffer.alloc(1);
            autoTagBuffer.writeUInt8(category.autotag, 0);
            bufferArray.push(autoTagBuffer);
            // Write on preview (bool)
            var onPreviewBuffer = Buffer.alloc(1);
            onPreviewBuffer.writeUInt8(category.onpreview, 0);
            bufferArray.push(onPreviewBuffer);
            // Write order (int) (-1 if null)
            var orderBuffer = Buffer.alloc(4);
            orderBuffer.writeInt32LE(category.order == null ? -1 : category.order, 0);
            bufferArray.push(orderBuffer);
            // Write name
            var nameBuffer = Buffer.from(category.name, 'utf-8');
            var nameLengthBuffer = Buffer.alloc(4);
            nameLengthBuffer.writeInt32LE(nameBuffer.length, 0);
            bufferArray.push(nameLengthBuffer);
            bufferArray.push(nameBuffer);
            // Write tags
            var tagsBuffer = Buffer.from(category.tags, 'utf-8');
            var tagsLengthBuffer = Buffer.alloc(4);
            tagsLengthBuffer.writeInt32LE(tagsBuffer.length, 0);
            bufferArray.push(tagsLengthBuffer);
            bufferArray.push(tagsBuffer);
            // Write ntags
            var ntagsBuffer = Buffer.from(category.ntags, 'utf-8');
            var ntagsLengthBuffer = Buffer.alloc(4);
            ntagsLengthBuffer.writeInt32LE(ntagsBuffer.length, 0);
            bufferArray.push(ntagsLengthBuffer);
            bufferArray.push(ntagsBuffer);
        });
        // Write files count (long)
        var filesCount = categoriesObject.files.length;
        var filesCountBuffer = Buffer.alloc(8);
        filesCountBuffer.writeBigInt64LE(BigInt(filesCount), 0);
        bufferArray.push(filesCountBuffer);
        // Write files
        categoriesObject.files.forEach(function (file) {
            // Write clear_name
            var clearNameBuffer = Buffer.from(file.clear_name, 'utf-8');
            var clearNameLengthBuffer = Buffer.alloc(4);
            clearNameLengthBuffer.writeInt32LE(clearNameBuffer.length, 0);
            bufferArray.push(clearNameLengthBuffer);
            bufferArray.push(clearNameBuffer);
            // Convert categories
            var categories = file.categories.split(">").map(function (cat) { return parseInt(cat.replace("<", "")); });
            categories.pop(); // Remove last empty element
            // Write categories count (int)
            var categoriesCountBuffer = Buffer.alloc(4);
            categoriesCountBuffer.writeInt32LE(categories.length, 0);
            bufferArray.push(categoriesCountBuffer);
            // Write categories (short)
            categories.forEach(function (category) {
                var categoryBuffer = Buffer.alloc(2);
                categoryBuffer.writeInt16LE(category, 0);
                bufferArray.push(categoryBuffer);
            });
        });
        // Combine all buffers into one
        return Buffer.concat(bufferArray);
    };
    Categories.prototype.byteArrToCategoriesObject = function (byteArr) {
        var offset = 0;
        // Read Magic Word
        var magicWord = byteArr.toString('utf-8', offset, offset + 4);
        offset += 4;
        if (magicWord !== 'CCEX') {
            throw new Error('Invalid file format');
        }
        // Read Version
        var version = byteArr.readInt32LE(offset);
        offset += 4;
        if (version !== 1) {
            throw new Error('Unsupported version');
        }
        // Read categories count
        var categoriesCount = byteArr.readInt32LE(offset);
        offset += 4;
        var categories = [];
        for (var i = 0; i < categoriesCount; i++) {
            // Read id
            var id = byteArr.readInt32LE(offset);
            offset += 4;
            // Read auto tag
            var autotag = byteArr.readUInt8(offset);
            offset += 1;
            // Read on preview
            var onpreview = byteArr.readUInt8(offset);
            offset += 1;
            // Read order
            var order = byteArr.readInt32LE(offset);
            if (order < 0)
                order = null;
            offset += 4;
            // Read name
            var nameLength = byteArr.readInt32LE(offset);
            offset += 4;
            var name_1 = byteArr.toString('utf-8', offset, offset + nameLength);
            offset += nameLength;
            // Read tags
            var tagsLength = byteArr.readInt32LE(offset);
            offset += 4;
            var tags = byteArr.toString('utf-8', offset, offset + tagsLength);
            offset += tagsLength;
            // Read ntags
            var ntagsLength = byteArr.readInt32LE(offset);
            offset += 4;
            var ntags = byteArr.toString('utf-8', offset, offset + ntagsLength);
            offset += ntagsLength;
            categories.push({ id: id, autotag: autotag, onpreview: onpreview, order: order, name: name_1, tags: tags, ntags: ntags });
        }
        // Read files count
        var filesCount = byteArr.readBigInt64LE(offset);
        offset += 8;
        var files = [];
        for (var i = 0; i < filesCount; i++) {
            // Read clear_name
            var clearNameLength = byteArr.readInt32LE(offset);
            offset += 4;
            var clear_name = byteArr.toString('utf-8', offset, offset + clearNameLength);
            offset += clearNameLength;
            // Read categories count
            var fileCategoriesCount = byteArr.readInt32LE(offset);
            offset += 4;
            var fileCategories = [];
            for (var j = 0; j < fileCategoriesCount; j++) {
                var category = byteArr.readInt16LE(offset);
                offset += 2;
                fileCategories.push(category);
            }
            files.push({ clear_name: clear_name, categories: fileCategories.map(function (cat) { return "<".concat(cat, ">"); }).join('') });
        }
        return { categories: categories, files: files };
    };
    return Categories;
}());
exports.Categories = Categories;
