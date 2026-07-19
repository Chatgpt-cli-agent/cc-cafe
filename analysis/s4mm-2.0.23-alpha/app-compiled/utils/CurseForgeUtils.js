"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurseForgeUtils = void 0;
class CurseForgeUtils {
    static isSupportedClass(classId) {
        if (!classId)
            return false;
        return classId == 5089 || classId == 5339 || classId == 5437 || classId == 8140;
    }
}
exports.CurseForgeUtils = CurseForgeUtils;
