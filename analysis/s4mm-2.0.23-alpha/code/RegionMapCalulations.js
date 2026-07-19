"use strict";
exports.__esModule = true;
exports.RMAPUtils = void 0;
var fs = require('fs');
var DBPFReader_1 = require("./DBPFReader");
var WorkerQueue_1 = require("./WorkerQueue");
var RMAPUtils = /** @class */ (function () {
    function RMAPUtils() {
    }
    RMAPUtils.meshExtremPoints = function (mesh) {
        var result = {
            x: { min: undefined, max: undefined },
            y: { min: undefined, max: undefined },
            z: { min: undefined, max: undefined }
        };
        if (!mesh || !mesh.vertex)
            return undefined;
        var vertexs = mesh.vertex;
        for (var i = 0; i < vertexs.length; i++) {
            // x, z, y 
            var x = vertexs[i].p[0];
            var y = vertexs[i].p[2];
            var z = vertexs[i].p[1];
            if (result.x.min === undefined || x < result.x.min)
                result.x.min = x;
            if (result.x.max === undefined || x > result.x.max)
                result.x.max = x;
            if (result.y.min === undefined || y < result.y.min)
                result.y.min = y;
            if (result.y.max === undefined || y > result.y.max)
                result.y.max = y;
            if (result.z.min === undefined || z < result.z.min)
                result.z.min = z;
            if (result.z.max === undefined || z > result.z.max)
                result.z.max = z;
        }
        return result;
    };
    RMAPUtils.getMeshMap = function (pack) {
        var geomsEntries = pack.getFilteredIndexEntries(0x015A1849);
        var meshMap = new Map();
        for (var _i = 0, geomsEntries_1 = geomsEntries; _i < geomsEntries_1.length; _i++) {
            var entry = geomsEntries_1[_i];
            var geom = new DBPFReader_1.GEOMFile(entry.getByteArray());
            var meshes = geom.chunks;
            meshMap.set(entry.getKey(), meshes);
        }
        return meshMap;
    };
    RMAPUtils.getRMapDataObjects = function (pack) {
        var items = [];
        var rMapsEntries = pack.getFilteredIndexEntries(0xAC16FBEC);
        items = rMapsEntries.map(function (entry) { return (new DBPFReader_1.RMAPFile(entry.getByteArray()).dataObject); });
        return items;
    };
    RMAPUtils.checkBounds = function (extremPoints, bounds) {
        if (bounds.x && ((extremPoints.x.min !== undefined && extremPoints.x.min < bounds.x.min) || (extremPoints.x.max !== undefined && extremPoints.x.max > bounds.x.max)))
            return false;
        if (bounds.y && ((extremPoints.y.min !== undefined && extremPoints.y.min < bounds.y.min) || (extremPoints.y.max !== undefined && extremPoints.y.max > bounds.y.max)))
            return false;
        if (bounds.z && ((extremPoints.z.min !== undefined && extremPoints.z.min < bounds.z.min) || (extremPoints.z.max !== undefined && extremPoints.z.max > bounds.z.max)))
            return false;
        return true;
    };
    RMAPUtils.extendExtremPoints = function (newPoint, base) {
        if (newPoint.x.min !== undefined && (base.x.min === undefined || newPoint.x.min < base.x.min))
            base.x.min = newPoint.x.min;
        if (newPoint.x.max !== undefined && (base.x.max === undefined || newPoint.x.max > base.x.max))
            base.x.max = newPoint.x.max;
        if (newPoint.y.min !== undefined && (base.y.min === undefined || newPoint.y.min < base.y.min))
            base.y.min = newPoint.y.min;
        if (newPoint.y.max !== undefined && (base.y.max === undefined || newPoint.y.max > base.y.max))
            base.y.max = newPoint.y.max;
        if (newPoint.z.min !== undefined && (base.z.min === undefined || newPoint.z.min < base.z.min))
            base.z.min = newPoint.z.min;
        if (newPoint.z.max !== undefined && (base.z.max === undefined || newPoint.z.max > base.z.max))
            base.z.max = newPoint.z.max;
    };
    RMAPUtils.roughlyEqual = function (pointA, pointB, threshold, consider) {
        if (consider === void 0) { consider = "XYZ"; }
        var checkX = consider.includes("X");
        var checkY = consider.includes("Y");
        var checkZ = consider.includes("Z");
        if (!checkX && !checkY && !checkZ)
            return false;
        var p1HasX = pointA.x.min !== undefined && pointA.x.max !== undefined;
        var p2HasX = pointB.x.min !== undefined && pointB.x.max !== undefined;
        var p1HasY = pointA.y.min !== undefined && pointA.y.max !== undefined;
        var p2HasY = pointB.y.min !== undefined && pointB.y.max !== undefined;
        var p1HasZ = pointA.z.min !== undefined && pointA.z.max !== undefined;
        var p2HasZ = pointB.z.min !== undefined && pointB.z.max !== undefined;
        if (checkX && (!p1HasX || !p2HasX))
            return false;
        if (checkY && (!p1HasY || !p2HasY))
            return false;
        if (checkZ && (!p1HasZ || !p2HasZ))
            return false;
        var xIsSame = true;
        var yIsSame = true;
        var zIsSame = true;
        if (checkX && pointA.x.max !== undefined && pointB.x.max !== undefined) {
            var xDiff = Math.abs(pointA.x.max - pointB.x.max);
            xIsSame = xDiff < threshold;
        }
        if (checkY && pointA.y.max !== undefined && pointB.y.max !== undefined) {
            var yDiff = Math.abs(pointA.y.max - pointB.y.max);
            yIsSame = yDiff < threshold;
        }
        if (checkZ && pointA.z.max !== undefined && pointB.z.max !== undefined) {
            var zDiff = Math.abs(pointA.z.max - pointB.z.max);
            zIsSame = zDiff < threshold;
        }
        return xIsSame && yIsSame && zIsSame;
    };
    RMAPUtils.checkFile = function (file, typeArray, options) {
        var typeSet = new Map();
        typeArray.forEach(function (type) {
            if (type && type.type && type.bounds) {
                typeSet.set(type.type, type.bounds);
            }
        });
        try {
            var pack = new DBPFReader_1.Pack(file);
            pack.checkFile();
            pack.calculateIndexList();
            var meshMap_1 = RMAPUtils.getMeshMap(pack);
            var rMapObjects = RMAPUtils.getRMapDataObjects(pack);
            var badItems_1 = [];
            rMapObjects.forEach(function (rmap) {
                var geomBlocks = rmap.geomReferenceBlockList;
                //Sort by region from highest to lowest
                geomBlocks.sort(function (a, b) { return b.region - a.region; });
                geomBlocks.forEach(function (geomBlock) {
                    if (typeSet.has(geomBlock.region)) {
                        var bounds_1 = typeSet.get(geomBlock.region);
                        var tgiList = geomBlock.tgiList;
                        tgiList.forEach(function (tgi) {
                            var mesh = meshMap_1.get(tgi.key);
                            if (!mesh || mesh.length != 1)
                                return;
                            if (options.ignoreSmallMeshes > 0 && mesh[0].faces.length < options.ignoreSmallMeshes)
                                return;
                            var extremPoints = RMAPUtils.meshExtremPoints(mesh[0]);
                            if (!extremPoints)
                                return;
                            var check = RMAPUtils.checkBounds(extremPoints, bounds_1);
                            if (check)
                                return;
                            badItems_1.push({
                                meshkey: tgi.key,
                                region: geomBlock.region,
                                extremPoints: extremPoints
                            });
                        });
                    }
                    else if (geomBlock.region == 0 && options.compareAgainstBase && badItems_1.length > 0) {
                        console.log("Compare against base");
                        var tgiList = geomBlock.tgiList;
                        var baseExtremPoints_1 = { x: { min: undefined, max: undefined }, y: { min: undefined, max: undefined }, z: { min: undefined, max: undefined } };
                        tgiList.forEach(function (tgi) {
                            var mesh = meshMap_1.get(tgi.key);
                            if (!mesh || mesh.length != 1)
                                return;
                            var extremPoints = RMAPUtils.meshExtremPoints(mesh[0]);
                            if (!extremPoints)
                                return;
                            //console.log(extremPoints);
                            RMAPUtils.extendExtremPoints(extremPoints, baseExtremPoints_1);
                        });
                        badItems_1 = badItems_1.filter(function (item) {
                            var issueRegion = item.region;
                            var zMin = baseExtremPoints_1.z ? baseExtremPoints_1.z.min : undefined;
                            var zMax = baseExtremPoints_1.z ? baseExtremPoints_1.z.max : undefined;
                            if (zMax != undefined && zMin != undefined && (issueRegion == 2 || issueRegion == 3)) {
                                var roughlyEqual = RMAPUtils.roughlyEqual(item.extremPoints, baseExtremPoints_1, 0.02, "Z");
                                return !roughlyEqual;
                                /*//Knee & Calf
                                let height = zMax -zMin;
                                let tollerance = 0.02;
                                //let tolleranceOffset = (height/100)*tollerance;
                                //let baseMaxWithTollerance = zMax + tolleranceOffset;
                                let baseMaxWithTollerance = zMax + 0.02;
                                console.log({
                                    isBad : item.extremPoints.z.max > baseMaxWithTollerance,
                                    itemMaxZ : item.extremPoints.z.max,
                                    baseMaxWithTollerance : baseMaxWithTollerance,
                                });
                                return item.extremPoints.z.max > baseMaxWithTollerance;*/
                            }
                            return true;
                        });
                    }
                });
            });
            if (badItems_1.length > 0) {
                return {
                    file: file,
                    items: badItems_1
                };
            }
        }
        catch (error) {
            console.log(error);
            return undefined;
        }
        return undefined;
    };
    RMAPUtils.handelToolsRequest = function (data, event, workers, translate) {
        var files = data.files;
        var types = data.types;
        var options = data.options;
        var loadingChannel = data.channel;
        var tasks = [];
        files.forEach(function (file) {
            tasks.push({
                action: "check-file-rmap-bounds",
                data: {
                    file: file,
                    types: types,
                    options: options
                }
            });
        });
        new WorkerQueue_1.WorkerQueue(workers, Date.now(), tasks, function (progress) {
            event.sender.send(loadingChannel, { value: (progress.index + 1), max: progress.max, title: translate.get("TOOLS.CCDETECT.I12", "Processing..."), close: false });
        }, function (results) {
            event.sender.send(loadingChannel, { close: true });
            var filteredData = results.filter(function (result) { return result.data !== undefined; });
            var mappedData = filteredData.map(function (result) {
                return {
                    issues: result.data.items,
                    id: result.task.data.file.id,
                    ino: result.task.data.file.ino
                };
            });
            event.sender.send(data.backChannel, { action: "set-results", items: mappedData });
        });
    };
    return RMAPUtils;
}());
exports.RMAPUtils = RMAPUtils;
