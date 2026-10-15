/**
 * setupDb.js
 * Se ejecuta al arrancar el servidor en producción.
 * Si users.sqlite no existe o está vacío, crea la tabla y
 * siembra un superadmin usando variables de entorno.
 * También asegura que el usuario conversor exista siempre.
 *
 * Variables requeridas en .env:
 *   SETUP_ADMIN_USER     — nombre del usuario administrador inicial
 *   SETUP_ADMIN_PASS     — contraseña en texto plano (se hashea aquí)
 *   SETUP_CONVERSOR_USER — nombre del usuario conversor (default: 'conversor')
 *   SETUP_CONVERSOR_PASS — contraseña del usuario conversor (default: 'conversor')
 */

const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'users.sqlite');

async function setupDb() {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // Crear tabla si no existe
    db.exec(`
        CREATE TABLE IF NOT EXISTS user (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_usuario TEXT NOT NULL UNIQUE,
            password       TEXT NOT NULL,
            rol            TEXT NOT NULL DEFAULT 'viewer',
            theme          TEXT NOT NULL DEFAULT 'dark'
        )
    `);

    const count = db.prepare('SELECT COUNT(*) as cnt FROM user').get();

    // ── 1. Si la base está vacía, crear el superadmin ───────────────────────
    if (count.cnt === 0) {
        const adminUser = process.env.SETUP_ADMIN_USER;
        const adminPass = process.env.SETUP_ADMIN_PASS;

        if (!adminUser || !adminPass) {
            console.warn('[SETUP DB] ⚠ SQLite vacío y no hay SETUP_ADMIN_USER/SETUP_ADMIN_PASS definidas.');
            console.warn('[SETUP DB]   El login no funcionará hasta que crees un usuario.');
        } else {
            const hashed = await bcrypt.hash(adminPass, 10);
            db.prepare(`
                INSERT INTO user (nombre_usuario, password, rol, theme)
                VALUES (?, ?, 'superadmin', 'dark')
            `).run(adminUser, hashed);
            console.log(`[SETUP DB] ✔ Usuario inicial creado: ${adminUser} (superadmin)`);
        }
    } else {
        console.log(`[SETUP DB] ✔ SQLite OK — ${count.cnt} usuario(s) existente(s)`);
    }

    // ── 2. Asegurar que el usuario conversor exista siempre ─────────────────
    const conversorUser = process.env.SETUP_CONVERSOR_USER || 'conversor';
    const conversorPass = process.env.SETUP_CONVERSOR_PASS || 'conversor';

    const existe = db.prepare('SELECT id FROM user WHERE nombre_usuario = ?').get(conversorUser);
    if (!existe) {
        const hashed = await bcrypt.hash(conversorPass, 10);
        db.prepare(`
            INSERT INTO user (nombre_usuario, password, rol, theme)
            VALUES (?, ?, 'conversor', 'dark')
        `).run(conversorUser, hashed);
        console.log(`[SETUP DB] ✔ Usuario conversor creado: ${conversorUser}`);
    } else {
        console.log(`[SETUP DB] ✔ Usuario conversor ya existe: ${conversorUser}`);
    }

    db.close();
}

module.exports = setupDb;
