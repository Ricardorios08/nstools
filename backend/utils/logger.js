const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '../logs/audit.log');
const LOG_DIR = path.join(__dirname, '../logs');

/**
 * Writes a log entry to the audit file.
 * @param {string} user - Username or 'SYSTEM'
 * @param {string} action - Action performed (e.g., LOGIN, SEARCH, EXPORT)
 * @param {string} details - Additional info
 * @param {object} req - Optional Express request object to extract IP/Metadata
 */
const logAction = (user, action, details = '', req = null) => {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }

        const timestamp = new Date().toLocaleString();
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : 'N/A';
        const logEntry = `[${timestamp}] [IP: ${ip}] [USER: ${user}] [ACTION: ${action}] ${details}\n`;

        fs.appendFileSync(LOG_PATH, logEntry);
        
        // Also log to console for development visibility
        console.log(`[AUDIT] ${logEntry.trim()}`);
    } catch (err) {
        console.error('[LOGGER ERROR] Could not write to audit log:', err.message);
    }
};

module.exports = {
    logAction
};
