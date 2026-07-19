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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
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
exports.__esModule = true;
exports.LanguageHelper = void 0;
var fs = require('fs');
var path = require('path');
var https = require('https');
var bl = require('bl');
var apiLink = "https://api.gametimedev.de/S4MM/language/languages.php";
var LanguageHelper = /** @class */ (function () {
    function LanguageHelper() {
    }
    LanguageHelper.convertOldToObject = function (text) {
        var _this = this;
        var result = {};
        var parts = text.split("\n");
        parts.forEach(function (element) {
            if (!element.includes("="))
                return;
            var spIndex = element.indexOf("=");
            var key = element.substring(0, spIndex);
            var value = element.substring(spIndex + 1);
            if (_this.mapObj[key]) {
                value = value.replace("\r", "");
                var modernKey = _this.mapObj[key];
                //result.push({"key":modernKey,"value":value});
                result[modernKey] = value;
            }
        });
        return result;
    };
    LanguageHelper.loadDefault = function (languageFolder, def) {
        if (!fs.existsSync(languageFolder) || !fs.existsSync(def))
            return;
        var filenames = fs.readdirSync(def);
        filenames.forEach(function (element) {
            var file = path.join(def, element);
            var des = path.join(languageFolder, element);
            if (element.endsWith(".json")) {
                fs.copyFileSync(file, des);
            }
        });
    };
    LanguageHelper.getLanguages = function (languageFolder) {
        var array = [];
        if (!fs.existsSync(languageFolder))
            return array;
        var filenames = fs.readdirSync(languageFolder);
        filenames.forEach(function (element) {
            var file = path.join(languageFolder, element);
            array.push({ "path": file, "name": element });
        });
        return array;
    };
    LanguageHelper.getOnlineLanguages = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (this.onlineResult.length > 0) {
                    return [2 /*return*/, new Promise(function (resolve) {
                            resolve(_this.onlineResult);
                        })];
                }
                else {
                    return [2 /*return*/, new Promise(function (resolve, reject) {
                            // select http or https module, depending on reqested url
                            var request = https.get(apiLink, function (response) {
                                // handle http errors
                                if (response.statusCode < 200 || response.statusCode > 299) {
                                    reject(new Error('Failed to load page, status code: ' + response.statusCode));
                                }
                                // temporary data holder
                                var body = [];
                                // on every content chunk, push it to the data array
                                response.on('data', function (chunk) { return body.push(chunk); });
                                response.on('end', function () { return resolve(body.join('')); });
                            });
                            // handle connection errors of the request
                            request.on('error', function (err) { return reject(err); });
                        })];
                }
                return [2 /*return*/];
            });
        });
    };
    LanguageHelper.downloadLanguage = function (url, folder, name) {
        return __awaiter(this, void 0, void 0, function () {
            var dest;
            return __generator(this, function (_a) {
                dest = path.join(folder, name);
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var file = fs.createWriteStream(dest, { flags: "w" });
                        var request = https.get(url, function (response) {
                            if (response.statusCode === 200) {
                                response.pipe(file);
                            }
                            else {
                                file.close();
                                fs.unlink(dest, function () { }); // Delete temp file
                                reject("Server responded with ".concat(response.statusCode, ": ").concat(response.statusMessage));
                            }
                        });
                        request.on("error", function (err) {
                            file.close();
                            fs.unlink(dest, function () { }); // Delete temp file
                            reject(err.message);
                        });
                        file.on("finish", function () {
                            resolve(name);
                        });
                        file.on("error", function (err) {
                            file.close();
                            if (err.code === "EEXIST") {
                                reject("File already exists");
                            }
                            else {
                                fs.unlink(dest, function () { }); // Delete temp file
                                reject(err.message);
                            }
                        });
                    })];
            });
        });
    };
    LanguageHelper.cleanByName = function (languageFolder, filename) {
        if (!fs.existsSync(languageFolder))
            return;
        var filenames = fs.readdirSync(languageFolder);
        filenames.forEach(function (element) {
            if (element != filename) {
                var file = path.join(languageFolder, element);
                var sp1 = element.split(".");
                var sp2 = filename.split(".");
                if (sp1.length == sp2.length && sp1.length == 5) {
                    var b1 = sp1[0] == sp2[0];
                    var b2 = sp1[1] == sp2[1];
                    var b3 = sp1[3] == sp2[3];
                    if (b1 && b2 && b3) {
                        console.log("Delete: " + file);
                        fs.unlinkSync(file);
                    }
                }
            }
        });
    };
    LanguageHelper.mapObj = {
        "general_delete": "GENERAL.DELETE",
        "cas_cat_Shoes": "CASVALUE.23_SHOES",
        "filter_cas_gender": "POPUPS.EDITVIEW.CAS2",
        "folders_add_new_folder": "FOLDER.ADDFOLDER",
        "cas_cat_Tattoos": "CASVALUE.47_TATTOOS",
        "import_thum": "POPUPS.EDITVIEW.THUMBNAIL",
        "filter_more_loaded": "FILTER.ACTIV",
        "cas_outfit_ColdWeather": "CASVALUE.11_COLD_WEATHER",
        "cas_cat_Gloves": "CASVALUE.79_GLOVES",
        "cas_cat_Loafers": "CASVALUE.87_LOAFERS",
        "cas_cat_Shorts": "CASVALUE.72_SHORTS",
        "cas_cat_Jumpsuits": "CASVALUE.60_JUMPSUITS",
        "cas_cat_Hair": "CASVALUE.13_HAIR",
        "filter_cas_head": "FILTER.CAS_.HEAD",
        "main_categories": "NAVBAR.CATEGORIES",
        "cas_cat_Costumes": "CASVALUE.65_COSTUMES",
        "cas_cat_Cheeks": "CASVALUE.42_CHEEKS",
        "main_prob": "NAVBAR.PROBLEMS",
        "item_load": "GENERAL.LOAD",
        "filter_clip_isS4S_PosePack": "POPUPS.EDITVIEW.T4",
        "cas_cat_Lips": "CASVALUE.43_LIPS",
        "cas_cat_Heels": "CASVALUE.89_HEELS",
        "cas_cat_Polos": "CASVALUE.56_POLOS",
        "cas_outfit_Swimwear": "CASVALUE.77_SWIMWEAR",
        "cas_outfit_Party": "CASVALUE.5_PARTY",
        "cas_cat_Sets": "CASVALUE.63_SETS",
        "cas_cat_Skirts": "CASVALUE.71_SKIRTS",
        "cas_cat_Face": "CASVALUE.24_FACE",
        "settings_behavior": "SETTINGS.BEHAVIOR",
        "cas_cat_ShortDresses": "CASVALUE.62_SHORT_DRESSES",
        "cas_cat_Tanks": "CASVALUE.52_TANKS",
        "filter_more_merged": "FILTER.MERGED",
        "cas_cat_Brimmed": "CASVALUE.34_BRIMMED",
        "cas_cat_ButtonUp": "CASVALUE.53_BUTTON_UP",
        "cas_cat_Outerwear": "CASVALUE.64_OUTERWEAR",
        "main_help": "NAVBAR.HELPABOUT",
        "cas_outfit_Everyday": "CASVALUE.0_EVERYDAY",
        "cas_cat_Goatees": "CASVALUE.32_GOATEES",
        "cas_cat_Wedges": "CASVALUE.90_WEDGES",
        "cas_outfit_Sleep": "CASVALUE.3_SLEEP",
        "cas_cat_Fingernails": "CASVALUE.81_FINGERNAILS",
        "cas_cat_Underwear": "CASVALUE.76_UNDERWEAR",
        "cas_cat_Boots": "CASVALUE.92_BOOTS",
        "cas_cat_Toenails": "CASVALUE.82_TOENAILS",
        "edit_recalc": "POPUPS.EDITVIEW.RECALC",
        "cas_outfit_Career": "CASVALUE.6_CAREER",
        "cas_cat_Sweaters": "CASVALUE.51_SWEATERS",
        "general_add": "GENERAL.ADD",
        "help_thanks": "HELP.CREDIT",
        "cas_cat_Sweatshirts": "CASVALUE.54_SWEATSHIRTS",
        "general_version": "POPUPS.VERSION.TITLE",
        "cas_cat_Rings": "CASVALUE.80_RINGS",
        "cas_outfit_Bathing": "CASVALUE.4_BATHING",
        "cas_cat_Short": "CASVALUE.27_SHORT",
        "settings_readCacheThum_button": "SETTINGS.T_GENERAL.ANALYZE_BT",
        "cas_cat_Eyes": "CASVALUE.40_EYES",
        "selection_count": "SELECT.COUNT",
        "cas_cat_Eyeshadow": "CASVALUE.45_EYESHADOW",
        "cas_cat_FacialHair": "CASVALUE.14_FACIAL_HAIR",
        "cas_cat_Updo": "CASVALUE.30_UPDO",
        "cas_cat_Medium": "CASVALUE.28_MEDIUM",
        "edit_stats": "POPUPS.EDITVIEW.STAT8",
        "cas_cat_Long": "CASVALUE.29_LONG",
        "cas_cat_Glasses": "CASVALUE.38_GLASSES",
        "settings_general": "SETTINGS.GENERAL",
        "cas_outfit_RetailUniforms": "CASVALUE.8_RETAIL_UNIFORMS",
        "filter_search": "FILTER.SEARCH",
        "categories_Rename_Title": "CATEGORIES.ITEM_T3",
        "cas_cat_Bottoms": "CASVALUE.21_BOTTOMS",
        "cas_cat_Aprons": "CASVALUE.68_APRONS",
        "filter_cas_age": "POPUPS.EDITVIEW.CAS1",
        "cas_cat_Brimless": "CASVALUE.35_BRIMLESS",
        "cas_cat_Jeans": "CASVALUE.74_JEANS",
        "cas_cat_Sandals": "CASVALUE.85_SANDALS",
        "pack_rename": "POPUPS.RENAME.CATEGORIES_R2",
        "splash_loading": "GENERAL.LOADING",
        "cas_cat_Slippers": "CASVALUE.88_SLIPPERS",
        "cas_cat_Jackets": "CASVALUE.49_JACKETS",
        "import_title": "NAVBAR.IMPORT",
        "edit_save": "GENERAL.SAVECHANGES",
        "cas_cat_Bodies": "CASVALUE.46_BODIES",
        "cas_cat_LongDresses": "CASVALUE.61_LONG_DRESSES",
        "edit_image_setFile": "POPUPS.EDITVIEW.THUMBNAIL_SELECT",
        "sg_w1": "ADBANNER.ADM_2",
        "main_settings": "NAVBAR.SETTINGS",
        "cas_cat_Caps": "CASVALUE.36_CAPS",
        "cas_cat_T-Shirts": "CASVALUE.50_T-SHIRTS",
        "cas_cat_Sneakers": "CASVALUE.91_SNEAKERS",
        "cas_cat_Pants": "CASVALUE.70_PANTS",
        "edit_bt_relations": "POPUPS.EDITVIEW.T5",
        "cas_cat_Piercings": "CASVALUE.37_PIERCINGS",
        "cas_cat_Moustaches": "CASVALUE.33_MOUSTACHES",
        "import_next": "POPUPS.IMPORT.TNEXT",
        "cas_outfit_Athletic": "CASVALUE.2_ATHLETIC",
        "cas_cat_Beards": "CASVALUE.31_BEARDS",
        "cas_cat_Cropped": "CASVALUE.75_CROPPED",
        "cas_cat_Lingerie": "CASVALUE.67_LINGERIE",
        "cas_cat_SuitJackets": "CASVALUE.55_SUIT_JACKETS",
        "filter_more_recolor": "FILTER.RECOLOR",
        "settings_unloadAll_button": "SETTINGS.T_GENERAL.DEACTIVATEALL_BT",
        "item_unload": "GENERAL.UNLOAD",
        "cas_outfit_Witch": "CASVALUE.9_WITCH",
        "cas_cat_Blouses": "CASVALUE.48_BLOUSES",
        "settings_loadAll_button": "SETTINGS.T_GENERAL.ACTIVATEALL_BT",
        "settings_apparence": "SETTINGS.APPEARANCE",
        "save_mod_list_selector_type": "POPUPS.EDITVIEW.STAT10",
        "cas_cat_SkinDetails": "CASVALUE.25_SKIN_DETAILS",
        "cas_cat_Eyeliner": "CASVALUE.41_EYELINER",
        "cas_cat_Hats": "CASVALUE.15_HATS",
        "settings_change_path": "SETTINGS.T_GENERAL.CHANGEPATH",
        "edit_value_cobj": "POPUPS.EDITVIEW.T3",
        "cas_cat_FullBody": "CASVALUE.20_FULL_BODY",
        "edit_openFolder": "POPUPS.EDITVIEW.STAT7",
        "cas_cat_Swimsuits": "CASVALUE.58_SWIMSUITS",
        "pop_loading_unloadAll_title": "S_SETTINGS.MI_18",
        "edit_fileAndName": "POPUPS.EDITVIEW.STAT1",
        "cas_cat_Bracelets": "CASVALUE.78_BRACELETS",
        "edit_value_cas": "POPUPS.EDITVIEW.T2",
        "cas_cat_Robes": "CASVALUE.66_ROBES",
        "cas_cat_Teeth": "CASVALUE.26_TEETH",
        "edit_openS4S": "POPUPS.EDITVIEW.STAT5",
        "filter_more_unloaded": "FILTER.DEACTIVE",
        "categories_Add_New": "CATEGORIES.ADDNEW",
        "cas_cat_Makeup": "CASVALUE.17_MAKEUP",
        "cas_cat_Brassieres": "CASVALUE.57_BRASSIERES",
        "cas_cat_Socks": "CASVALUE.84_SOCKS",
        "cas_outfit_Formal": "CASVALUE.1_FORMAL",
        "main_folders": "NAVBAR.FOLDER",
        "cas_cat_Body": "CASVALUE.18_BODY",
        "cas_cat_Vests": "CASVALUE.59_VESTS",
        "theme_editor_bt_pre": "SETTINGS.T_PROANDAPP.PREVIEW",
        "cas_cat_Necklaces": "CASVALUE.39_NECKLACES",
        "cas_cat_Flats": "CASVALUE.86_FLATS",
        "cas_cat_Tops": "CASVALUE.19_TOPS"
    };
    LanguageHelper.onlineResult = "";
    return LanguageHelper;
}());
exports.LanguageHelper = LanguageHelper;
