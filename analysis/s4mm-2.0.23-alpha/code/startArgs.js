"use strict";
exports.__esModule = true;
exports.StartArgs = void 0;
var StartArgs = /** @class */ (function () {
    function StartArgs() {
    }
    StartArgs.readStartArgs = function (args) {
        var values = JSON.parse(JSON.stringify(this.defaultValues));
        console.log(args);
        for (var index = 0; index < args.length; index++) {
            var cValue = args[index];
            switch (cValue) {
                case "--threadCount":
                    if (args[index + 1] == undefined || !this.isSimpleInteger(args[index + 1]))
                        return this.invalidArgs();
                    values.threadCount = +args[index + 1];
                    index++;
                    break;
                case "--showWorker":
                    values.showWorker = true;
                    break;
                case "--extraLog":
                    values.extraLog = true;
                    break;
                case "--noLogFile":
                    values.extraLog = true;
                    break;
                case "--disableHardwareAcceleration":
                    values.disableHardwareAcceleration = true;
                    break;
                default:
                    //Nix
                    break;
            }
        }
        console.log(values);
        return values;
    };
    StartArgs.invalidArgs = function () {
        return this.defaultValues;
    };
    StartArgs.isSimpleInteger = function (str) { var num = Number(str); return Number.isInteger(num) && !str.includes('.') && !str.includes(','); };
    StartArgs.defaultValues = {
        threadCount: undefined,
        showWorker: false,
        extraLog: false,
        noLogFile: false,
        disableHardwareAcceleration: false
    };
    return StartArgs;
}());
exports.StartArgs = StartArgs;
