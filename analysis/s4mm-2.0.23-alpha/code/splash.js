const { ipcRenderer } = require('electron');

var img = document.getElementById("img");
var el_prorgess = undefined;
var el_line_1 = document.getElementById("line_1");
var el_line_2 = document.getElementById("line_2");

//CurseFogre Toggle
let cf_time_start = undefined;
let cf_timeout = 60000 * 1; // 1 Minutes
let cf_visible = false;
let cf_wasDisplayed = false


function showCFInfo(value) {
    var box_cf_long_load = document.getElementById("box_cf_long_load");
    if (value) {
        box_cf_long_load.style.display = "flex";
        cf_visible = true;
    } else {
        box_cf_long_load.style.display = "none";
        cf_visible = false;
    }
}

function disableCurseForge() {
    showCFInfo(false);
    ipcRenderer.send("simple-task", { "task": "turn-curseforge-off" });
}

function keepCurseForge() {
    showCFInfo(false);
    //ipcRenderer.send("simple-task", { "task": "turn-curseforge-off" });
}

function checkCFTimeout() {
    let comp = Date.now() - cf_timeout;
    if (!cf_visible && !cf_wasDisplayed && comp > cf_time_start) {
        cf_wasDisplayed = true;
        showCFInfo(true);
    }
}

function closeApp() {
    ipcRenderer.send("titlebar", 2);
}


/*
ipcRenderer.invoke('some-name', "someArgument").then((result) => {
    // ...
});*/

ipcRenderer.on("splash", (event, data) => {
    handelSplashData(data);
});

function handelSplashData(data) {
    if (data.step == -1) {
        //alert("Image: " + data.image);
        img.src = data.image;
    } else if (data.step == 1) {
        if (data.suc) {
            step1_finish();
        } else {
            alert("FILES COULD NOT BE SAVED!");
            quitCall();
        }
    } else if (data.step == 2) {
        if (data.suc) {
            step2_finish();
        } else {
            alert("Database not connected");
            quitCall();
        }
    } else if (data.step == 3) {
        if (data.suc) {
            step3_finish();
        } else {
            alert("Settings could not be loaded!");
            quitCall();
        }
    } else if (data.step == 4) {
        if (data.finished) {
            step4_finish(); //Trigger pint
        } else {
            if (data.subStep == 1) {
                ipcRenderer.send("splash", { "step": 4, "subStep": 2 });
            } else if (data.task) {
                step4_update(data);
            }
        }
    } else if (data.step == 5) {
        if (data.subStep == 1) {
            step5_update(data);
        } else if (data.subStep == 2) {
            step5_finish();
        }
    } else if (data.step == 6) {
        if (data.finished) {
            step6_finish();
        } else if (data.subStep == 2 || data.subStep == 3 || data.subStep == 4 || data.subStep == 1 || data.subStep == 6) {
            step6_update(data);
        } else if (data.subStep == 5) {
            step6_finish();
        }
    } else if (data.step == -2) {
        setLines(data.line1, data.line2);
    } else if (data.action = "recalc-at-startup") {
        recalcAtStartup(data);
    }
}

function recalcAtStartup(data) {
    let l2 = "CAS & COBJ values must be recalculated due to an update";
    let l1 = "Progress: " + data.current + "/" + data.max;
    setProgress(data.current / data.max * 140);
    setLines(l1, l2);
}

function quitCall() {
    alert("Sims 4 Mod Manager failed to start!")
    ipcRenderer.send("titlebar", 2);
}

function setProgress(value) {
    try {
        if (el_prorgess == undefined) {
            el_prorgess = document.getElementById("progress");
        }
        if (el_prorgess == undefined) {
            console.log("NO BAR!")
        } else {
            el_prorgess.value = value;
            //console.log("VALUE: " + el_prorgess.value)
        }

    } catch (error) {
        console.log(error);
    }
    //console.log(value);
}

function setLines(line1, line2) {
    el_line_1.innerText = line1;
    el_line_2.innerText = line2;
}


//Steps
//Create BaseFolder Structur 5%
function step1_initCall() {
    setLines("Prepare/locate storage location...", "");
    ipcRenderer.send("splash", { "step": 1 });
}

function step1_finish() {
    setProgress(5);
    step2_initCall();
}


//Link DataBase 5% (10)
function step2_initCall() {
    setLines("Create local database...", "");
    ipcRenderer.send("splash", { "step": 2 });
}

function step2_finish() {
    setProgress(10);
    step3_initCall();
}

//Load Settings 10% (20)
function step3_initCall() {
    setLines("Loading user settings...", "");
    ipcRenderer.send("splash", { "step": 3 });
}

function step3_finish() {
    setProgress(20);
    step4_initCall();
}

//Fill Database 70% (90)
function step4_initCall() {
    setLines("Create Workers...", "");
    ipcRenderer.send("splash", { "step": 4, "subStep": 1 });
}


let s4_offsets = [0.04, 0.24, 0.44, 0.64, 1];
let s4_parts = [0.4, 0.20, 0.20, 0.20, 0.36];
let s4_tasks = [
    "Check files...",
    "Calculate INO values:",
    "Fetch values from database:",
    "Compare values:",
    "Loading files:"
];

function step4_update(data) {
    if (!data.task || !data.current || !data.max) return;
    if (data.task > 4) return;
    let task = data.task;
    let current = data.current;
    let max = data.max;

    //Text Info
    let text = s4_tasks[task];
    if (task > 0) text = text + " " + current + "/" + max;
    setLines(text, "");

    //Value
    let v = (current / max) * s4_parts[task];
    if (task > 0) v = v + s4_offsets[task - 1];
    v = (v * 70) + 20;
    setProgress(v);
    console.log(task + " " + v);


    //console.log(JSON.stringify(data));
    /*
    cc_pos++;
    console.log(data.name);
    let v = (cc_pos / cc_count) * 40;
    setProgress(20 + v)

    setLines("[" + (cc_pos) + "/" + cc_count + "] Last loaded: " + data.name, "");
    //if (cc_pos == cc_count) {
    //    step4_finish();
    //}*/
}

function step4_finish() {
    setProgress(90);
    step5_initCall();
}

//Check Database 10% (100)
function step5_initCall() {
    setLines("Run special startup options...", "");
    ipcRenderer.send("splash", { "step": 5 });
}

function step5_update(data) {

    if (!task) return;

    let current = data.current;
    let max = data.max;

    //Value
    let v = (current / max) * s4_parts[task];
    v = (v * 10) + 90;
    setProgress(v);
}

function step5_finish() {
    setProgress(100);
    step6_initCall();
}


//CurseForge
function step6_initCall() {
    setLines("Checking internet connection...", "");
    ipcRenderer.send("splash", { "step": 6 });
}

function step6_update(data) {

    if (!cf_time_start) cf_time_start = Date.now();
    checkCFTimeout();


    if (data.subStep == 2) {
        setProgress(110);
        setLines("Checking CurseForge updates...", "");
        //ipcRenderer.send("splash", { "step": 6, "subStep": 2 });
    } else if (data.subStep == 3) {
        setProgress(120);
        setLines("Downloading images...", "");
        //ipcRenderer.send("splash", { "step": 6, "subStep": 3 });
    } else if (data.subStep == 4) {
        if (!data.current || !data.max) return;
        let current = data.current;
        let max = data.max;

        //Text Info
        let text = "Downloading images... " + current + "/" + max;
        setLines(text, "");

        //Value
        let v = (current / max);
        v = (v * 20) + 120;
        setProgress(v);

        //setProgress(120);
        //setLines("Downloading images...", "");
        //ipcRenderer.send("splash", { "step": 6, "subStep": 3 });
    } else if (data.subStep == 1) {
        if (!data.current || !data.max) return;
        let current = data.current;
        let max = data.max;

        //Text Info
        let text = "Checking CurseForge files... " + current + "/" + max;
        setLines(text, "");

        //Value
        let v = (current / max);
        v = (v * 10) + 100;
        setProgress(v);

        //setProgress(120);
        //setLines("Downloading images...", "");
        //ipcRenderer.send("splash", { "step": 6, "subStep": 3 });
    } else if (data.subStep == 6) {
        if (!data.current || !data.max) return;
        let current = data.current;
        let max = data.max;

        //Text Info
        let text = "Write to database... " + current + "/" + max;
        setLines(text, "");
        //setProgress(120);
        //setLines("Downloading images...", "");
        //ipcRenderer.send("splash", { "step": 6, "subStep": 3 });
    }
}

function step6_finish() {
    setProgress(140);
    ipcRenderer.send("splash", { "step": 7 });
}

//Advanced
function changeAdvancedPopup(value) {
    var box = document.getElementById("box_advanced");
    if (value) {
        box.style.display = "flex";
    } else {
        box.style.display = "none";
    }
}

function openLogsFolder() {
    ipcRenderer.send("simple-task", { "task": "open-log-folder" });
}


//Start Application


//Start Loading :)
setTimeout(function() { step1_initCall(); }, 500);