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
exports.GameState = void 0;
var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var GameState = /** @class */ (function () {
    function GameState(updateFunction, loopspeedFast, loopspeedSlow, isMac) {
        this.intervalId = undefined;
        this.gameIsOpen = false;
        this.inFocus = true;
        this.isOn = false;
        this.loopspeedFast = 5000;
        this.loopspeedSlow = 20000;
        this.updateFunction = undefined;
        this.isMac = false;
        this.checking = false;
        this.gameFolder = undefined;
        this.updateFunction = updateFunction;
        this.loopspeedFast = loopspeedFast;
        this.loopspeedSlow = loopspeedSlow;
        this.isMac = isMac;
    }
    GameState.prototype.setGameFolder = function (gameFolder) {
        if (!gameFolder || gameFolder.length == 0) {
            this.gameFolder = undefined;
            return;
        }
        this.gameFolder = gameFolder;
        console.log("[GAMEFOLDER] New game folder path was set");
    };
    GameState.prototype.startGame = function (gameFolder, isMac, args) {
        var _this = this;
        if (isMac) {
            //Mac
            var executable = path.dirname(gameFolder);
            if (!fs.existsSync(executable) || !executable.endsWith(".app"))
                return false;
            executable = "\"" + executable + "\"";
            ;
            if (args)
                executable = executable + " --args " + args;
            child_process.exec('open -a' + (executable));
        }
        else {
            //Windows
            var executable = path.join(gameFolder, "Game", "Bin", "TS4_x64.exe");
            if (!fs.existsSync(executable))
                return false;
            executable = "\"" + executable + "\"";
            ;
            if (args)
                executable = executable + " " + args;
            child_process.exec(executable);
        }
        setTimeout(function () {
            _this.checkGameState(_this);
        }, 1000);
        return true;
    };
    GameState.prototype.updateIfChange = function (gameIsOpen, list) {
        if (gameIsOpen == this.gameIsOpen)
            return;
        this.gameIsOpen = gameIsOpen;
        if (list != undefined) {
            console.log("[GAMESTATE-CHANGE] List: " + JSON.stringify(list));
        }
        else {
            console.log("[GAMESTATE-CHANGE] No list!");
        }
        console.log("[GAMESTATE-CHANGE] gameIsOpen: " + gameIsOpen);
        if (this.updateFunction)
            this.updateFunction({ action: "game-state-change", gameIsOpen: this.gameIsOpen });
    };
    GameState.prototype.checkGameState = function (self) {
        return __awaiter(this, void 0, void 0, function () {
            var searchType, list_1, stdout, gameIsOpen, command, stdout, found_1, gameIsOpen;
            return __generator(this, function (_a) {
                if (self.checking || !self || !self.isOn) {
                    return [2 /*return*/];
                }
                searchType = self.isMac ? "The Sims 4.app" : "TS4_x64.exe";
                self.checking = true;
                try {
                    list_1 = [];
                    if (self.isMac) {
                        try {
                            stdout = child_process.execSync("pgrep -fl \"".concat(searchType, "\"")).toString();
                            list_1 = stdout.split('\n').map(function (line) { return ({ cmd: line }); });
                        }
                        catch (eNoItems) {
                            //Nix
                        }
                        gameIsOpen = self.checkIfGameIsOpen(list_1);
                        self.updateIfChange(gameIsOpen, list_1);
                    }
                    else {
                        command = "tasklist /FI \"IMAGENAME eq ".concat(searchType, "\" /FO CSV /NH");
                        stdout = child_process.execSync(command).toString();
                        found_1 = false;
                        stdout.split('\n').forEach(function (line) {
                            var name = line.split(',')[0];
                            var clean = name.replace(/"/g, '');
                            if (clean == searchType) {
                                found_1 = true;
                                list_1.push({ name: clean });
                            }
                        });
                        gameIsOpen = found_1;
                        self.updateIfChange(gameIsOpen, list_1);
                    }
                }
                catch (error) {
                    console.log(error);
                }
                self.checking = false;
                return [2 /*return*/];
            });
        });
    };
    GameState.prototype.checkIfGameIsOpen = function (list) {
        if (list == undefined || list.length == 0)
            return false;
        for (var index = 0; index < list.length; index++) {
            var element = list[index];
            var name_1 = element.name;
            if (this.isMac && element.cmd.includes("The Sims 4.app")) {
                return true;
                //Mac 
                //if(!this.gameFolder)return true;
                //let binGame = element.bin.toLowerCase();
                //return binGame.startsWith(this.gameFolder.toLowerCase().replace(/\/\//g, "/"));
            }
            else if (!this.isMac && (name_1 == "TS4_DX9_x64.exe" || name_1 == "TS4_x64.exe")) {
                return true;
                //Windows
                //if(!this.gameFolder)return true;
                //let binGame = element.bin.toLowerCase();
                //return binGame.startsWith(this.gameFolder.toLowerCase());
            }
        }
        return false;
    };
    GameState.prototype.changeFocusState = function (inFocus) {
        this.inFocus = inFocus;
        this.changeIntervalSpeed(inFocus ? this.loopspeedFast : this.loopspeedSlow);
        this.checkGameState(this);
    };
    GameState.prototype.startStop = function (start) {
        if (start) {
            this.changeIntervalSpeed(this.inFocus ? this.loopspeedFast : this.loopspeedSlow);
            return;
        }
        this.changeIntervalSpeed(0);
    };
    GameState.prototype.updateIsOn = function (isOn) {
        this.isOn = isOn;
        this.startStop(true);
    };
    GameState.prototype.changeIntervalSpeed = function (speed) {
        var _this = this;
        if (!this.isOn)
            speed = 0;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        if (speed == 0)
            return;
        this.checkGameState(this);
        this.intervalId = setInterval(function () {
            _this.checkGameState(_this);
        }, speed);
    };
    return GameState;
}());
exports.GameState = GameState;
