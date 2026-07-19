"use strict";
exports.__esModule = true;
exports.FolderCover = void 0;
var fs = require('fs');
var fsExtra = require('fs-extra');
var path = require('path');
var Downloader = require("nodejs-file-downloader");
var FolderCover = /** @class */ (function () {
    function FolderCover(coverFolderPath) {
        this.coverFolderPath = undefined;
        this.coverFolderPath = coverFolderPath;
    }
    FolderCover.prototype.setCoverFolderPath = function (coverFolderPath) {
        this.coverFolderPath = coverFolderPath;
    };
    FolderCover.prototype.downloadImage = function (tag, ino, mode) {
        if (!this.coverFolderPath || !fs.existsSync(this.coverFolderPath))
            return;
        var imageUrl = "";
        if (mode == 1)
            imageUrl = "https://api.gametimedev.de/curseforge/creators/" + tag + ".png";
        if (mode == 2)
            imageUrl = "https://api.gametimedev.de/S4MM/community/modpacks/images/" + tag + ".png";
        var filename = ino + ".png";
        var directory = this.coverFolderPath;
        var downloader = new Downloader({
            url: imageUrl,
            fileName: filename,
            directory: directory,
            cloneFiles: false
        });
        downloader.download().then(function () { })["finally"](function () {
            console.log("Download done");
        });
    };
    FolderCover.prototype.removeCoverByIno = function (ino) {
        if (!this.coverFolderPath || !fs.existsSync(this.coverFolderPath))
            return;
        var file = path.join(this.coverFolderPath, ino + ".png");
        if (!fs.existsSync(file))
            return;
        fs.unlinkSync(file);
    };
    FolderCover.prototype.removeCoverByFolder = function (folderPath) {
        if (!folderPath || folderPath.length == 0 || !fs.existsSync(folderPath))
            return;
        var ino = fs.statSync(folderPath).ino;
        this.removeCoverByIno(ino);
    };
    FolderCover.prototype.getCoverPathIfExistByIno = function (ino) {
        if (!this.coverFolderPath || !fs.existsSync(this.coverFolderPath))
            return undefined;
        var file = path.join(this.coverFolderPath, ino + ".png");
        return fs.existsSync(file) ? file : undefined;
    };
    FolderCover.prototype.getCoverPathIfExistByPath = function (folderPath) {
        if (!folderPath || folderPath.length == 0 || !fs.existsSync(folderPath))
            return undefined;
        var ino = fs.statSync(folderPath).ino;
        return this.getCoverPathIfExistByIno(ino);
    };
    FolderCover.prototype.addCoverByPath = function (folderPath, imagePath) {
        if (!folderPath || folderPath.length == 0 || !fs.existsSync(folderPath))
            return;
        var ino = fs.statSync(folderPath).ino;
        this.addCoverByIno(ino, imagePath);
    };
    FolderCover.prototype.addCoverByIno = function (ino, imagePath) {
        if (!this.coverFolderPath || !fs.existsSync(this.coverFolderPath) || !fs.existsSync(imagePath))
            return;
        var filename = ino + ".png";
        var directory = this.coverFolderPath;
        var filepath = path.join(directory, filename);
        try {
            fs.copyFile(imagePath, filepath, function (err) {
                if (err)
                    console.log(err);
            });
        }
        catch (error) {
            console.log(error);
        }
    };
    return FolderCover;
}());
exports.FolderCover = FolderCover;
