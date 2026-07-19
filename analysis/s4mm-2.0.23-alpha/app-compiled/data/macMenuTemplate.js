"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MacMenuTemplate = void 0;
const electron_1 = require("electron");
class MacMenuTemplate {
}
exports.MacMenuTemplate = MacMenuTemplate;
_a = MacMenuTemplate;
MacMenuTemplate.template = [
    ...(process.platform === "darwin" ? [{
            label: electron_1.app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
    {
        label: "Edit",
        submenu: [
            { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
            { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
            { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
            { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
        ]
    },
    {
        role: 'help',
        submenu: [{
                label: 'Join the Discord Server',
                click: async () => {
                    const { shell } = require('electron');
                    await shell.openExternal('https://discord.com/invite/VbtKC5T2Aw');
                }
            },
            {
                label: 'Contact via Email',
                click: async () => {
                    const { shell } = require('electron');
                    await shell.openExternal('mailto:developer.gamtime@gmail.com');
                }
            },
            {
                label: 'Open Guide',
                click: async () => {
                    const { shell } = require('electron');
                    await shell.openExternal('https://s4mm-wiki.gametimedev.de/');
                }
            }
        ]
    },
];
