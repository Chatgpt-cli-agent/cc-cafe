"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsController = void 0;
const cas_tool_1 = require("../tools/cas.tool");
const ccdetect_tool_1 = require("../tools/ccdetect.tool");
const ccswiper_tool_1 = require("../tools/ccswiper.tool");
const disablePacks_tool_1 = require("../tools/disablePacks.tool");
const dups_tool_1 = require("../tools/dups.tool");
const gameoptions_tool_1 = require("../tools/gameoptions.tool");
const hqtextures_tool_1 = require("../tools/hqtextures.tool");
const idconflicts_tool_1 = require("../tools/idconflicts.tool");
const loadingscreen_tool_1 = require("../tools/loadingscreen.tool");
const mainmenu_tool_1 = require("../tools/mainmenu.tool");
const merge_tool_1 = require("../tools/merge.tool");
const myStories_tool_1 = require("../tools/myStories.tool");
const otherFiles_tool_1 = require("../tools/otherFiles.tool");
const polycount_tool_1 = require("../tools/polycount.tool");
const rmap_tool_1 = require("../tools/rmap.tool");
const simple_tool_1 = require("../tools/simple.tool");
const tgichecker_tools_1 = require("../tools/tgichecker.tools");
class ToolsController {
    constructor(main) {
        //Tools
        this.tools = [];
        this.mainApp = main;
        this.loadTools();
    }
    loadTools() {
        this.tools.push(new dups_tool_1.ToolDups(this.mainApp)); //0
        this.tools.push(new simple_tool_1.ToolSimple(this.mainApp)); //1
        this.tools.push(new idconflicts_tool_1.ToolIDConflicts(this.mainApp)); //2
        this.tools.push(new loadingscreen_tool_1.ToolLoadingScreen(this.mainApp)); //3
        this.tools.push(new mainmenu_tool_1.ToolMainMenu(this.mainApp)); //4
        this.tools.push(new gameoptions_tool_1.ToolGameOptions(this.mainApp)); //5
        this.tools.push(new disablePacks_tool_1.ToolDisablePacks(this.mainApp)); //6
        this.tools.push(new polycount_tool_1.ToolPolyCount(this.mainApp)); //7
        this.tools.push(new rmap_tool_1.ToolRMap(this.mainApp)); //8
        this.tools.push(new tgichecker_tools_1.ToolTGIChecker(this.mainApp)); //9
        this.tools.push(new cas_tool_1.ToolCas(this.mainApp)); //10
        this.tools.push(new hqtextures_tool_1.ToolHQTextures(this.mainApp)); //11
        this.tools.push(new ccdetect_tool_1.ToolCCDetect(this.mainApp)); //12
        this.tools.push(new merge_tool_1.ToolMerge(this.mainApp)); //13
        this.tools.push(new otherFiles_tool_1.ToolOtherFiles(this.mainApp)); //14
        this.tools.push(new myStories_tool_1.ToolMyStories(this.mainApp)); //15
        this.tools.push(new ccswiper_tool_1.ToolCCSwiper(this.mainApp)); //16
    }
}
exports.ToolsController = ToolsController;
