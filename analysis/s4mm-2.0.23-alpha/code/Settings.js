"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
var fs = require('fs');
var path = require('path');
var Settings = /** @class */ (function () {
    function Settings(home) {
        this.s_game_documents = "";
        this.s_game_orgin = "";
        this.s_path_mod = "";
        this.s_analyzeOnStart = false;
        this.s_item_size = 5;
        this.s_use_pages = true;
        this.s_pages_size = 30;
        this.s_accept_cmp = false;
        this.s_first_start = true;
        this.s_windowZoom = 100;
        this.s_prerelease = false;
        this.s_language_path = "";
        this.s_s4s = "";
        this.s_cc_swiper_simple = true;
        this.s_cc_swiper_preview = true;
        this.s_download_modus = 0;
        this.s_download_modus_modpacks = 0;
        this.s_info_sort_alert = 0;
        this.s_use_curseforge = true;
        this.s_ac_color = "#76f066";
        this.s_problems_view_groups = false;
        this.s_cas_rows = 2;
        this.s_tool_fav = [];
        this.s_cas_no_info = false;
        this.s_cas_no_thumb_tip = false;
        this.s_cas_focus = true;
        this.s_pop_cas_thum_info = false;
        this.s_sharp_corner = false;
        this.s_inverted = false;
        this.s_pages_mode = 0;
        this.s_ow_user = undefined;
        this.s_community_report_thanks = false;
        this.s_use_community = true;
        this.s_prototype = false;
        this.s_start_overview = 1;
        this.s_start_folder = false;
        this.s_move_suggestions = true;
        this.s_game_state_check = true;
        this.s_download_language = true;
        this.s_direct_delete = false;
        this.s_use_cls_randomizer = false;
        this.s_sgo_autostart = false;
        this.s_sgo_overlay = false;
        this.s_secret_features = false;
        this.s_show_dual_ad = true;
        try {
            this.getDefaultModFolderLocation(home);
        }
        catch (error) {
            console.log("Error in getDefaultModFolderLocation:");
            console.log(error);
        }
    }
    Settings.prototype.getDefaultModFolderLocation = function (home) {
        if (!home || home.length == 0)
            return;
        var ohome = require("os").homedir();
        var isMac = process.platform === "darwin";
        //Sims 4 Studio
        var baseS4S = "????????";
        if (isMac && this.s_s4s.length == 0) {
            baseS4S = "/Applications/S4Studio.app";
        }
        else {
            baseS4S = "C:\\Program Files (x86)\\Sims 4 Studio\\S4Studio.exe";
        }
        if (fs.existsSync(baseS4S) && this.s_s4s.length == 0)
            this.s_s4s = baseS4S;
        //Game Folder
        //Windows
        var game_origin = "C:\\Program Files (x86)\\Origin Games\\The Sims 4";
        var game_ea = "C:\\Program Files\\EA Games\\The Sims 4";
        var game_ea_86 = "C:\\Program Files (x86)\\EA Games\\The Sims 4";
        var game_steam = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Sims 4";
        if (isMac) {
            var macPathOptions = [];
            macPathOptions.push(ohome + path.sep + "Applications");
            macPathOptions.push(ohome + path.sep + "Applications" + path.sep + "EA Games");
            macPathOptions.push("/Applications/EA Games/");
            console.log(macPathOptions);
            for (var i = 0; i < macPathOptions.length; i++) {
                var macPath = macPathOptions[i];
                if (fs.existsSync(macPath)) {
                    var appFiles = fs.readdirSync(macPath);
                    for (var index = 0; index < appFiles.length; index++) {
                        var element = appFiles[index];
                        var contentsFolder = macPath + path.sep + element + path.sep + "Contents";
                        if (element.endsWith("Sims 4.app") && (fs.existsSync(contentsFolder))) {
                            this.s_game_orgin = contentsFolder;
                            index = appFiles.length;
                            i = macPathOptions.length;
                            //What happes to the packfolder?
                        }
                    }
                }
            }
        }
        else {
            if (fs.existsSync(game_origin)) {
                this.s_game_orgin = game_origin;
            }
            else if (fs.existsSync(game_ea)) {
                this.s_game_orgin = game_ea;
            }
            else if (fs.existsSync(game_ea_86)) {
                this.s_game_orgin = game_ea_86;
            }
            else if (fs.existsSync(game_steam)) {
                this.s_game_orgin = game_steam;
            }
        }
        //EA Folder + Mod Folder
        var eaFolder = home + path.sep + "Electronic Arts";
        if (!fs.existsSync(eaFolder) || !fs.lstatSync(eaFolder).isDirectory()) {
            return;
        }
        var fList = fs.readdirSync(eaFolder);
        var folderName = "";
        for (var index = 0; index < fList.length; index++) {
            var element = fList[index];
            if (element.endsWith(" Sims 4")) {
                if (folderName.length == 0) {
                    folderName = element;
                }
                else if (folderName.length > element) {
                    folderName = element;
                }
            }
        }
        if (folderName.length != 0) {
            var docGameFolder = eaFolder + path.sep + folderName;
            if (!fs.existsSync(docGameFolder) || !fs.lstatSync(docGameFolder).isDirectory()) {
                return;
            }
            this.s_game_documents = docGameFolder;
            var mod_folder = docGameFolder + path.sep + "mods";
            if (!fs.existsSync(mod_folder) || !fs.lstatSync(mod_folder).isDirectory()) {
                return;
            }
            this.s_path_mod = mod_folder;
        }
    };
    Settings.prototype.checkPaths = function () {
        if (!this.checkPath(this.s_game_documents))
            this.s_game_documents = "";
        if (!this.checkPath(this.s_game_orgin))
            this.s_game_orgin = "";
        if (!this.checkPath(this.s_path_mod))
            this.s_path_mod = "";
    };
    Settings.prototype.checkPath = function (path) {
        if (path.length == 0)
            return true;
        if (fs.existsSync(path))
            return true;
        return false;
    };
    Settings.from = function (json, home) {
        var settings = Object.assign(new Settings(home), json);
        settings.checkPaths();
        return settings;
    };
    return Settings;
}());
exports.Settings = Settings;
