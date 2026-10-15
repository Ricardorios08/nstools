const mariadb = require('mariadb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_NAME = process.env.MARIA_DB_NAME || 'recaudacion2';

// Pool normal
const pool = mariadb.createPool({
     host: process.env.MARIA_HOST, 
     user: process.env.MARIA_USER, 
     password: process.env.MARIA_PASS,
     port: parseInt(process.env.MARIA_PORT || "3306"),
     database: DB_NAME,
     connectionLimit: 15,
     connectTimeout: 10000,
     acquireTimeout: 10000,
     allowPublicKeyRetrieval: true
});

// Pool para tareas administrativas (Regenerar auditoría, KILL QUERY, etc.)
const superadminPool = mariadb.createPool({
    host: process.env.MARIA_HOST,
    user: process.env.SUPERADMIN_MARIA_USER || process.env.MARIA_USER,
    password: process.env.SUPERADMIN_MARIA_PASS || process.env.MARIA_PASS,
    port: parseInt(process.env.MARIA_PORT || "3306"),
    connectionLimit: 5,
    connectTimeout: 10000,
    acquireTimeout: 10000,
    allowPublicKeyRetrieval: true
});

module.exports = {
    query: async (sql, params) => {
        let conn;
        try {
            conn = await pool.getConnection();
            const res = await conn.query(sql, params);
            return res;
        } finally {
            if (conn) conn.release();
        }
    },
    getConnection: () => pool.getConnection(),
    getSuperadminConnection: () => superadminPool.getConnection(),
    pool,
    superadminPool,
    queryRemote: async (sql, params) => {
        let conn;
        try {
            conn = await pool.getConnection();
            const res = await conn.query(sql, params);
            return res;
        } finally {
            if (conn) conn.release();
        }
    },
    getRemoteConnection: () => pool.getConnection(),
    remotePool: pool
};
