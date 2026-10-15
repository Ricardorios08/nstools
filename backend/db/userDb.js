const path = require('path');
const Database = require('better-sqlite3');

// SQLite database file lives next to this file
const DB_PATH = path.join(__dirname, 'users.sqlite');

let db;
try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // mejor concurrencia lectura/escritura
    db.pragma('foreign_keys = ON');

    // Crear tabla si no existe (primera vez)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_usuario TEXT NOT NULL UNIQUE,
            password       TEXT NOT NULL,
            rol            TEXT NOT NULL DEFAULT 'viewer'
        )
    `);

    console.log('[USER DB] SQLite inicializado correctamente:', DB_PATH);
} catch (err) {
    console.error('[USER DB] Error al abrir SQLite:', err.message);
    process.exit(1);
}

/**
 * Ejecuta una consulta SQL sobre la tabla de usuarios (SQLite).
 * La firma es compatible con la versión anterior basada en MariaDB:
 *   query(sql, params, rol)  — rol se ignora (ya no hay pool por rol)
 *
 * Soporta SELECT, INSERT, UPDATE y DELETE.
 * Devuelve siempre una Promise para mantener la interfaz async/await.
 */
const query = (sql, params = [], _rol = null) => {
    return new Promise((resolve, reject) => {
        try {
            const normalized = sql.trim().toUpperCase();
            if (normalized.startsWith('SELECT')) {
                const rows = db.prepare(sql).all(params);
                resolve(rows);
            } else {
                const info = db.prepare(sql).run(params);
                resolve(info);
            }
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Alias con la firma (rol, sql, params) para compatibilidad con queryWithRole.
 */
const queryWithRole = (rol, sql, params = []) => query(sql, params, rol);

module.exports = {
    query,
    queryWithRole,
    // Exponemos el objeto db por si algún módulo lo necesita directamente
    db,
    // Mantener aliases de pool para que no rompa si algo los importa
    adminPool: null,
    userPool: null,
};
