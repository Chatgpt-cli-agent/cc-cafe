"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = void 0;
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
class GameState {
    constructor(updateFunction, loopspeedFast, loopspeedSlow, isMac) {
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
    setGameFolder(gameFolder) {
        if (!gameFolder || gameFolder.length == 0) {
            this.gameFolder = undefined;
            return;
        }
        this.gameFolder = gameFolder;
        console.log("[GAMEFOLDER] New game folder path was set");
    }
    startGame(gameFolder, isMac, args) {
        if (isMac) {
            //Mac
            let executable = path.dirname(gameFolder);
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
            let executable = path.join(gameFolder, "Game", "Bin", "TS4_x64.exe");
            if (!fs.existsSync(executable))
                return false;
            executable = "\"" + executable + "\"";
            ;
            if (args)
                executable = executable + " " + args;
            child_process.exec(executable);
        }
        setTimeout(() => {
            this.checkGameState(this);
        }, 1000);
        return true;
    }
    updateIfChange(gameIsOpen, list) {
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
    }
    async checkGameState(self) {
        if (self.checking || !self || !self.isOn) {
            return;
        }
        let searchType = self.isMac ? "The Sims 4.app" : "TS4_x64.exe";
        self.checking = true;
        try {
            let list = [];
            if (self.isMac) {
                try {
                    const stdout = child_process.execSync(`pgrep -fl "${searchType}"`).toString();
                    list = stdout.split('\n').map((line) => ({ cmd: line }));
                }
                catch (eNoItems) {
                    //Nix
                }
                let gameIsOpen = self.checkIfGameIsOpen(list);
                self.updateIfChange(gameIsOpen, list);
            }
            else {
                let command = `tasklist /FI "IMAGENAME eq ${searchType}" /FO CSV /NH`;
                const stdout = child_process.execSync(command).toString();
                let found = false;
                stdout.split('\n').forEach((line) => {
                    const [name] = line.split(',');
                    let clean = name.replace(/"/g, '');
                    if (clean == searchType) {
                        found = true;
                        list.push({ name: clean });
                    }
                });
                let gameIsOpen = found;
                self.updateIfChange(gameIsOpen, list);
            }
        }
        catch (error) {
            console.log(error);
        }
        self.checking = false;
    }
    checkIfGameIsOpen(list) {
        if (list == undefined || list.length == 0)
            return false;
        for (let index = 0; index < list.length; index++) {
            const element = list[index];
            const name = element.name;
            if (this.isMac && element.cmd.includes("The Sims 4.app")) {
                return true;
                //Mac 
                //if(!this.gameFolder)return true;
                //let binGame = element.bin.toLowerCase();
                //return binGame.startsWith(this.gameFolder.toLowerCase().replace(/\/\//g, "/"));
            }
            else if (!this.isMac && (name == "TS4_DX9_x64.exe" || name == "TS4_x64.exe")) {
                return true;
                //Windows
                //if(!this.gameFolder)return true;
                //let binGame = element.bin.toLowerCase();
                //return binGame.startsWith(this.gameFolder.toLowerCase());
            }
        }
        return false;
    }
    changeFocusState(inFocus) {
        this.inFocus = inFocus;
        this.changeIntervalSpeed(inFocus ? this.loopspeedFast : this.loopspeedSlow);
        this.checkGameState(this);
    }
    startStop(start) {
        if (start) {
            this.changeIntervalSpeed(this.inFocus ? this.loopspeedFast : this.loopspeedSlow);
            return;
        }
        this.changeIntervalSpeed(0);
    }
    updateIsOn(isOn) {
        this.isOn = isOn;
        this.startStop(true);
    }
    changeIntervalSpeed(speed) {
        if (!this.isOn)
            speed = 0;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        if (speed == 0)
            return;
        this.checkGameState(this);
        this.intervalId = setInterval(() => {
            this.checkGameState(this);
        }, speed);
    }
}
exports.GameState = GameState;
