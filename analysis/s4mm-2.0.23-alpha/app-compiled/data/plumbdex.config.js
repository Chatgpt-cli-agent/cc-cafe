"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlumbDexConfig = void 0;
class PlumbDexConfig {
    static get backendUrl() {
        return PlumbDexConfig.currentBackendUrl;
    }
    static get frontendUrl() {
        return PlumbDexConfig.currentFrontendUrl;
    }
    static setBackendUrl(url) {
        if (!url || url.trim() === "") {
            PlumbDexConfig.currentBackendUrl = PlumbDexConfig.defaultBackendUrl;
        }
        else {
            PlumbDexConfig.currentBackendUrl = url;
        }
    }
    static setFrontendUrl(url) {
        if (!url || url.trim() === "") {
            PlumbDexConfig.currentFrontendUrl = PlumbDexConfig.defaultFrontendUrl;
        }
        else {
            PlumbDexConfig.currentFrontendUrl = url;
        }
    }
    static useOverride() {
        return PlumbDexConfig.currentBackendUrl !== PlumbDexConfig.defaultBackendUrl ||
            PlumbDexConfig.currentFrontendUrl !== PlumbDexConfig.defaultFrontendUrl;
    }
}
exports.PlumbDexConfig = PlumbDexConfig;
PlumbDexConfig.defaultBackendUrl = "https://backend.gametimedev.de/plumbdex";
PlumbDexConfig.defaultFrontendUrl = "https://plumbdex.gametimedev.de";
PlumbDexConfig.currentBackendUrl = PlumbDexConfig.defaultBackendUrl;
PlumbDexConfig.currentFrontendUrl = PlumbDexConfig.defaultFrontendUrl;
