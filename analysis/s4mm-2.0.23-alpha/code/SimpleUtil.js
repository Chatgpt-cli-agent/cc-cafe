const path = require('path');
const { networkInterfaces } = require('os');

const getIp = () => {
    const nets = networkInterfaces();
    const results = Object.create(null);
    let ips = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
            if (net.family === familyV4Value && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                ips.push(net.address);
            }
        }
    }
    return ips;
}

exports.getIp = getIp;