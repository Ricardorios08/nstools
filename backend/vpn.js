/**
 * VPN Auto-Connect Module
 * Starts OpenVPN with elevated privileges (UAC prompt) before the app needs database access.
 * Requires OpenVPN installed and vpn/ folder configured.
 */
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const VPN_DIR = path.join(__dirname, '..', 'vpn');
const OPENVPN_EXE = 'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe';

/**
 * Check if we can reach the target host (quick TCP connect test)
 */
function canReachHost(host, port, timeout = 2000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.on('error', () => { socket.destroy(); resolve(false); });
        socket.connect(port, host);
    });
}

/**
 * Check if OpenVPN tunnel is actually connected (not just the GUI/service running)
 */
function isVpnAlreadyRunning() {
    try {
        const output = execSync('ipconfig', { encoding: 'utf8' });
        // Split by adapter sections
        const sections = output.split(/\r?\n\r?\n/);
        for (const section of sections) {
            const lower = section.toLowerCase();
            // Find OpenVPN adapter sections (TAP or Wintun)
            if (lower.includes('openvpn') || lower.includes('tap-windows')) {
                // If it says "medios desconectados" or "Media disconnected" it's NOT connected
                if (lower.includes('desconectados') || lower.includes('disconnected')) {
                    continue; // This adapter is not active
                }
                // If it has an IPv4 address, the tunnel IS active
                if (lower.includes('ipv4') || lower.includes('direcci')) {
                    return true;
                }
            }
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Start OpenVPN with UAC elevation (popup) so no admin terminal is needed.
 * OpenVPN runs as a separate elevated process.
 */
function startVPN() {
    return new Promise((resolve, reject) => {
        const configFile = path.join(VPN_DIR, 'config.ovpn');
        const authFile = path.join(VPN_DIR, 'auth.txt');
        const logFile = path.join(VPN_DIR, 'vpn.log');

        if (!fs.existsSync(configFile)) {
            return reject(new Error(
                `VPN config not found at ${configFile}\n` +
                `See vpn/README.md for setup instructions.`
            ));
        }

        if (!fs.existsSync(OPENVPN_EXE)) {
            return reject(new Error(
                `OpenVPN not found at ${OPENVPN_EXE}\n` +
                `Install OpenVPN from https://openvpn.net/community-downloads/`
            ));
        }

        if (isVpnAlreadyRunning()) {
            console.log('[VPN] OpenVPN already running, skipping...');
            return resolve();
        }

        console.log('[VPN] Starting OpenVPN (you may see a UAC elevation prompt)...');

        // Clean old log
        try { fs.unlinkSync(logFile); } catch {}

        // Build the openvpn arguments
        const args = `--config "${configFile}" --cd "${VPN_DIR}" --log "${logFile}"`;

        // Use PowerShell Start-Process -Verb RunAs to get UAC elevation
        // This pops up the "Allow this app to make changes?" dialog
        const psCommand = `Start-Process -FilePath '${OPENVPN_EXE}' -ArgumentList '${args}' -Verb RunAs -WindowStyle Hidden`;

        exec(`powershell -Command "${psCommand}"`, (err) => {
            if (err) {
                return reject(new Error(`[VPN] Failed to start OpenVPN: ${err.message}`));
            }

            console.log('[VPN] OpenVPN process launched, waiting for connection...');

            // Poll the log file for "Initialization Sequence Completed"
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds max

            const checkInterval = setInterval(() => {
                attempts++;

                try {
                    if (fs.existsSync(logFile)) {
                        const log = fs.readFileSync(logFile, 'utf8');

                        if (log.includes('Initialization Sequence Completed')) {
                            clearInterval(checkInterval);
                            console.log('[VPN] ✅ Connected successfully!');
                            return resolve();
                        }

                        if (log.includes('AUTH_FAILED') || log.includes('SIGTERM')) {
                            clearInterval(checkInterval);
                            return reject(new Error('[VPN] Authentication failed. Check vpn/auth.txt'));
                        }
                    }
                } catch {}

                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('[VPN] Connection timed out after 30 seconds. Check vpn/vpn.log'));
                }
            }, 1000);
        });
    });
}

/**
 * Stop VPN (kill the elevated openvpn.exe process)
 */
function stopVPN() {
    try {
        if (isVpnAlreadyRunning()) {
            console.log('[VPN] Disconnecting...');
            execSync('taskkill /F /IM openvpn.exe', { stdio: 'ignore' });
        }
    } catch {}
}

module.exports = { startVPN, stopVPN, canReachHost, isVpnAlreadyRunning };
