"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityApi = void 0;
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
class CommunityApi {
    static async checkFingerprints(fingerprints, accessToken) {
        try {
            const response = await this.instance.post('/file/check-fingerprints', { fingerprints: fingerprints }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            //console.log(response.data);
            return response.data;
        }
        catch (error) {
            console.error('Error checking fingerprints:', error);
            throw error;
        }
    }
    static async uploadFileInfo(data, accessToken) {
        const { fileinfo, thumbnail, entries } = data;
        const formData = new FormData();
        formData.append('fileinfo', JSON.stringify(fileinfo));
        formData.append('entries', JSON.stringify(entries));
        // If a thumbnail exists, add it to the form data
        if (thumbnail && thumbnail.path) {
            console.log('Thumbnail path:', thumbnail.path);
            formData.append('thumbnail', fs.createReadStream(thumbnail.path));
        }
        try {
            const response = await this.instance.post('/file/upload-info', formData, {
                headers: {
                    ...formData.getHeaders(), // Include form data headers
                    Authorization: `Bearer ${accessToken}`, // Add authorization header
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('Error uploading file info:', error.response?.data || error.message);
        }
    }
    static async uploadFileInfoBundle(budlePath, accessToken) {
        const formData = new FormData();
        formData.append('bundlefile', fs.createReadStream(budlePath));
        try {
            const response = await this.instanceBig.post('/file/upload-bundle', formData, {
                headers: {
                    ...formData.getHeaders(), // Include form data headers
                    Authorization: `Bearer ${accessToken}`, // Add authorization header
                },
            });
            return { success: response.status === 201, status: response.status };
        }
        catch (error) {
            console.error('Error uploading file info bundle:', error.response?.data || error.message);
            return { success: false, status: error.response?.status || 500 };
        }
    }
    static async uploadSharedModFolderFile(filepath, accessToken, name, extraInfo) {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filepath));
        formData.append('name', name);
        formData.append('extraInfo', extraInfo ? JSON.stringify(extraInfo) : '{}');
        try {
            const response = await this.instance.post('/folderfile/upload', formData, {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${accessToken}`
                },
            });
            console.log('Upload response:', response.data);
            console.log('Upload status:', response.status);
            return {
                success: response.status === 201,
                data: response.data
            };
        }
        catch (error) {
            console.error('Error uploading shared mod folder file:', error.response?.data || error.message);
            return { success: false }; // Return false if the upload failed
        }
    }
    static async uploadHealthReport(accessToken, gameVersion, type, fingerprints, fingerprintsFile) {
        const formData = new FormData();
        formData.append('type', type);
        formData.append('gameVersion', gameVersion);
        formData.append('fingerprints', JSON.stringify(fingerprints.map(f => f.toString()))); // Convert fingerprints to string array
        if (fingerprintsFile) {
            formData.append('fingerprintsFile', fs.createReadStream(fingerprintsFile));
        }
        try {
            const response = await this.instance.post('/file/health/report', formData, {
                headers: {
                    ...formData.getHeaders(), // Include form data headers
                    Authorization: `Bearer ${accessToken}`, // Add authorization header
                },
            });
            return { success: response.status === 201, status: response.status };
        }
        catch (error) {
            console.error('Error uploading health report:', error.response?.data || error.message);
            return { success: false, status: error.response?.status || 500 };
        }
    }
    static async refreshAccessToken(refreshToken) {
        try {
            const response = await this.instance.post('/auth/refresh-token', { refreshToken: refreshToken });
            if (response.status === 200) {
                return {
                    accessToken: response.data.accessToken,
                    refreshToken: response.data.refreshToken
                };
            }
            else {
                console.error('Failed to refresh access token:', response.statusText);
                return null;
            }
        }
        catch (error) {
            console.error('Error refreshing access token:', error.response?.data || error.message);
            return null;
        }
    }
    static async checkAndRefreshAccessToken(accessToken, refreshToken) {
        //Check if access will be vaid for at least 5 minutes
        const tokenData = this.parseJwt(accessToken);
        if (!tokenData || !tokenData.exp) {
            console.error('Invalid access token format');
            return null;
        }
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        const fiveMinutesInSeconds = 5 * 60; // 5 minutes in seconds
        if (tokenData.exp - currentTime > fiveMinutesInSeconds) {
            console.log('Access token is still valid for more than 5 minutes');
            return accessToken; // No need to refresh
        }
        console.log('Access token is expiring soon, refreshing...');
        // Refresh the access token
        const refreshedData = await this.refreshAccessToken(refreshToken);
        if (refreshedData && refreshedData.accessToken) {
            console.log('Access token refreshed successfully');
            return refreshedData.accessToken; // Return the new access token
        }
        else {
            console.error('Failed to refresh access token');
            return null; // Return null if refresh failed
        }
    }
    static parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
        }
        catch (error) {
            console.error('Error parsing JWT:', error);
            return null;
        }
    }
    static async checkGameVersion(versionStr) {
        if (!versionStr || versionStr.length < 5) {
            throw new Error("Invalid game version string");
        }
        try {
            const response = await this.instance.get(`/versioninfos/check/${versionStr}`);
            if (response.status === 200) {
                return {
                    success: true,
                    status: response.status,
                    data: response.data
                };
            }
            else {
                console.error('Failed to check game version:', response.statusText);
                return {
                    success: false,
                    status: response.status,
                    data: null
                };
            }
        }
        catch (error) {
            console.error('Error checking game version:', error.response?.data || error.message);
            return {
                success: false,
                status: error.response?.status || 500,
                data: null
            };
        }
    }
}
exports.CommunityApi = CommunityApi;
CommunityApi.instance = axios.create({
    baseURL: 'https://backend.gametimedev.de/community-api',
    //baseURL:"http://localhost:8003",
    timeout: 10000, // 10 seconds timeout
});
CommunityApi.instanceBig = axios.create({
    baseURL: 'https://backend.gametimedev.de/community-api',
    //baseURL:"http://localhost:8003",
    timeout: 1000 * 60 * 5, // 5 minutes timeout
});
