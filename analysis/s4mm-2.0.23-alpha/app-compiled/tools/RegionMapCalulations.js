"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RMAPUtils = void 0;
const DBPFReader_1 = require("../sims/DBPFReader");
const WorkerQueue_1 = require("../utils/WorkerQueue");
var fs = require('fs');
class RMAPUtils {
    static meshExtremPoints(mesh) {
        let result = {
            x: { min: undefined, max: undefined },
            y: { min: undefined, max: undefined },
            z: { min: undefined, max: undefined }
        };
        if (!mesh || !mesh.vertex)
            return undefined;
        let vertexs = mesh.vertex;
        for (let i = 0; i < vertexs.length; i++) {
            // x, z, y 
            let x = vertexs[i].p[0];
            let y = vertexs[i].p[2];
            let z = vertexs[i].p[1];
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
    }
    static getMeshMap(pack) {
        let geomsEntries = pack.getFilteredIndexEntries(0x015A1849);
        let meshMap = new Map();
        for (let entry of geomsEntries) {
            let geom = new DBPFReader_1.GEOMFile(entry.getByteArray());
            let meshes = geom.chunks;
            meshMap.set(entry.getKey(), meshes);
        }
        return meshMap;
    }
    static getRMapDataObjects(pack) {
        let items = [];
        let rMapsEntries = pack.getFilteredIndexEntries(0xAC16FBEC);
        items = rMapsEntries.map(entry => (new DBPFReader_1.RMAPFile(entry.getByteArray()).dataObject));
        return items;
    }
    static checkBounds(extremPoints, bounds) {
        if (bounds.x && ((extremPoints.x.min !== undefined && extremPoints.x.min < bounds.x.min) || (extremPoints.x.max !== undefined && extremPoints.x.max > bounds.x.max)))
            return false;
        if (bounds.y && ((extremPoints.y.min !== undefined && extremPoints.y.min < bounds.y.min) || (extremPoints.y.max !== undefined && extremPoints.y.max > bounds.y.max)))
            return false;
        if (bounds.z && ((extremPoints.z.min !== undefined && extremPoints.z.min < bounds.z.min) || (extremPoints.z.max !== undefined && extremPoints.z.max > bounds.z.max)))
            return false;
        return true;
    }
    static extendExtremPoints(newPoint, base) {
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
    }
    static roughlyEqual(pointA, pointB, threshold, consider = "XYZ") {
        let checkX = consider.includes("X");
        let checkY = consider.includes("Y");
        let checkZ = consider.includes("Z");
        if (!checkX && !checkY && !checkZ)
            return false;
        let p1HasX = pointA.x.min !== undefined && pointA.x.max !== undefined;
        let p2HasX = pointB.x.min !== undefined && pointB.x.max !== undefined;
        let p1HasY = pointA.y.min !== undefined && pointA.y.max !== undefined;
        let p2HasY = pointB.y.min !== undefined && pointB.y.max !== undefined;
        let p1HasZ = pointA.z.min !== undefined && pointA.z.max !== undefined;
        let p2HasZ = pointB.z.min !== undefined && pointB.z.max !== undefined;
        if (checkX && (!p1HasX || !p2HasX))
            return false;
        if (checkY && (!p1HasY || !p2HasY))
            return false;
        if (checkZ && (!p1HasZ || !p2HasZ))
            return false;
        let xIsSame = true;
        let yIsSame = true;
        let zIsSame = true;
        if (checkX && pointA.x.max !== undefined && pointB.x.max !== undefined) {
            let xDiff = Math.abs(pointA.x.max - pointB.x.max);
            xIsSame = xDiff < threshold;
        }
        if (checkY && pointA.y.max !== undefined && pointB.y.max !== undefined) {
            let yDiff = Math.abs(pointA.y.max - pointB.y.max);
            yIsSame = yDiff < threshold;
        }
        if (checkZ && pointA.z.max !== undefined && pointB.z.max !== undefined) {
            let zDiff = Math.abs(pointA.z.max - pointB.z.max);
            zIsSame = zDiff < threshold;
        }
        return xIsSame && yIsSame && zIsSame;
    }
    static checkFile(file, typeArray, options) {
        let typeSet = new Map();
        typeArray.forEach((type) => {
            if (type && type.type && type.bounds) {
                typeSet.set(type.type, type.bounds);
            }
        });
        try {
            let pack = new DBPFReader_1.Pack(file);
            pack.checkFile();
            pack.calculateIndexList();
            let meshMap = RMAPUtils.getMeshMap(pack);
            let rMapObjects = RMAPUtils.getRMapDataObjects(pack);
            let badItems = [];
            rMapObjects.forEach(rmap => {
                let geomBlocks = rmap.geomReferenceBlockList;
                //Sort by region from highest to lowest
                geomBlocks.sort((a, b) => b.region - a.region);
                geomBlocks.forEach((geomBlock) => {
                    if (typeSet.has(geomBlock.region)) {
                        let bounds = typeSet.get(geomBlock.region);
                        let tgiList = geomBlock.tgiList;
                        tgiList.forEach((tgi) => {
                            let mesh = meshMap.get(tgi.key);
                            if (!mesh || mesh.length != 1)
                                return;
                            if (options.ignoreSmallMeshes > 0 && mesh[0].faces.length < options.ignoreSmallMeshes)
                                return;
                            let extremPoints = RMAPUtils.meshExtremPoints(mesh[0]);
                            if (!extremPoints)
                                return;
                            let check = RMAPUtils.checkBounds(extremPoints, bounds);
                            if (check)
                                return;
                            badItems.push({
                                meshkey: tgi.key,
                                region: geomBlock.region,
                                extremPoints: extremPoints,
                            });
                        });
                    }
                    else if (geomBlock.region == 0 && options.compareAgainstBase && badItems.length > 0) {
                        console.log("Compare against base");
                        let tgiList = geomBlock.tgiList;
                        let baseExtremPoints = { x: { min: undefined, max: undefined }, y: { min: undefined, max: undefined }, z: { min: undefined, max: undefined } };
                        tgiList.forEach((tgi) => {
                            let mesh = meshMap.get(tgi.key);
                            if (!mesh || mesh.length != 1)
                                return;
                            let extremPoints = RMAPUtils.meshExtremPoints(mesh[0]);
                            if (!extremPoints)
                                return;
                            //console.log(extremPoints);
                            RMAPUtils.extendExtremPoints(extremPoints, baseExtremPoints);
                        });
                        badItems = badItems.filter((item) => {
                            let issueRegion = item.region;
                            let zMin = baseExtremPoints.z ? baseExtremPoints.z.min : undefined;
                            let zMax = baseExtremPoints.z ? baseExtremPoints.z.max : undefined;
                            if (zMax != undefined && zMin != undefined && (issueRegion == 2 || issueRegion == 3)) {
                                let roughlyEqual = RMAPUtils.roughlyEqual(item.extremPoints, baseExtremPoints, 0.02, "Z");
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
            if (badItems.length > 0) {
                return {
                    file: file,
                    items: badItems
                };
            }
        }
        catch (error) {
            console.log(error);
            return undefined;
        }
        return undefined;
    }
    static handelToolsRequest(data, event, workersController, translate) {
        let files = data.files;
        let types = data.types;
        let options = data.options;
        let loadingChannel = data.channel;
        let tasks = [];
        files.forEach((file) => {
            tasks.push({
                action: "check-file-rmap-bounds",
                data: {
                    file: file,
                    types: types,
                    options: options
                }
            });
        });
        new WorkerQueue_1.WorkerQueue(workersController, tasks, {}, (progress) => {
            event.sender.send(loadingChannel, { value: (progress.index + 1), max: progress.max, title: translate.get("TOOLS.CCDETECT.I12", "Processing..."), close: false });
        }, (results) => {
            event.sender.send(loadingChannel, { close: true });
            let filteredData = results.filter((result) => result.data !== undefined);
            let mappedData = filteredData.map((result) => {
                return {
                    issues: result.data.items,
                    id: result.task.data.file.id,
                    ino: result.task.data.file.ino
                };
            });
            event.sender.send(data.backChannel, { action: "set-results", items: mappedData });
        });
    }
}
exports.RMAPUtils = RMAPUtils;
