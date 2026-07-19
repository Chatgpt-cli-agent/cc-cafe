"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settings = void 0;
class Settings {
    constructor() {
        // Paths
        this.s_path_mod = "";
        this.s_game_documents = "";
        this.s_game_orgin = "";
        this.s_language_path = "";
        this.s_s4s = "";
        this.s_language = "en";
        // General settings
        this.s_analyzeOnStart = false;
        this.s_item_size = 5;
        this.s_item_auto_size = true;
        this.s_use_pages = true;
        this.s_pages_size = 30;
        this.s_page_rows = 3;
        this.s_page_use_rows = false;
        this.s_accept_cmp = false;
        this.s_first_start = true;
        this.s_windowZoom = 100;
        this.s_prerelease = false;
        // UI settings
        this.s_cc_swiper_simple = true;
        this.s_cc_swiper_preview = true;
        this.s_ac_color = "#76f066";
        this.s_sharp_corner = false;
        this.s_inverted = false;
        // Download settings
        this.s_download_modus = 0;
        this.s_download_modus_modpacks = 0;
        this.s_download_language = true;
        //Other
        this.s_local_download_folder = "";
        this.s_local_download_delete = true;
        this.s_allow_direct_download = false;
        // CAS (Create-a-Sim) settings
        this.s_cas_rows = 2;
        this.s_tool_fav = [];
        this.s_cas_no_info = false;
        this.s_cas_focus = true;
        this.s_cas_no_thumb_tip = false;
        this.s_pop_cas_thum_info = false;
        // Community settings
        this.s_community_report_thanks = false;
        this.s_use_community = true;
        // Prototype and experimental features
        this.s_prototype = false;
        this.s_secret_features = false;
        // Miscellaneous
        this.s_info_sort_alert = 0;
        this.s_pages_mode = 0;
        this.s_ow_user = undefined;
        this.s_start_folder = false;
        this.s_start_overview = 1;
        this.s_move_suggestions = true;
        this.s_game_state_check = true;
        this.s_direct_delete = false;
        this.s_use_cls_randomizer = false;
        this.s_sgo_autostart = false;
        this.s_sgo_overlay = false;
        this.s_show_dual_ad = true;
        this.s_show_all_files = false;
        this.s_ads_enabled = false;
        this.s_show_worker_stats = false;
        this.s_max_load_change = 5;
        this.s_xml_filter_tags = ["PosePackInstance", "XmlInjector"];
        // CurseForge settings
        this.s_use_curseforge = true;
        this.s_complex_filter = true;
        this.s_complex_filter_types = [
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".txt",
            ".pdf"
        ];
    }
    // Static method to create a Settings instance from JSON
    static from(json) {
        return Object.assign(new Settings(), json);
    }
}
exports.Settings = Settings;
