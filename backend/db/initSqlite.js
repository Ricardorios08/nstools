/**
 * initSqlite.js
 * Script de migración ONE-TIME:
 *   - Crea la tabla user en SQLite (si no existe)
 *   - Copia todos los usuarios desde la base MariaDB (tabla user) al nuevo SQLite
 *   - Si el usuario ya existe en SQLite lo omite (no duplica)
 *
 * Uso: node backend/db/initSqlite.js
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mariadb = require('mariadb');
const Database = require('better-sqlite3');

const SQLITE_PATH = path.join(__dirname, 'users.sqlite');

async function main() {
    console.log('=== Migración MariaDB → SQLite ===\n');

    // ── 1. Abrir / crear SQLite ──────────────────────────────────────────────
    const sqlite = new Database(SQLITE_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS user (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_usuario TEXT NOT NULL UNIQUE,
            password       TEXT NOT NULL,
            rol            TEXT NOT NULL DEFAULT 'viewer'
        )
    `);
    console.log('✔ SQLite listo:', SQLITE_PATH);

    // ── 2. Conectar a MariaDB con superadmin ────────────────────────────────
    const superUser = process.env.SUPERADMIN_MARIA_USER || process.env.MARIA_USER;
    const superPass = process.env.SUPERADMIN_MARIA_PASS || process.env.MARIA_PASS;
    const dbName    = process.env.MARIA_USER_DB_NAME || 'user';

    console.log(`\nConectando a MariaDB: ${superUser}@${process.env.MARIA_HOST}:${process.env.MARIA_PORT}/${dbName}`);

    let conn;
    try {
        conn = await mariadb.createConnection({
            host:     process.env.MARIA_HOST,
            port:     parseInt(process.env.MARIA_PORT || '3306'),
            user:     superUser,
            password: superPass,
            database: dbName,
            connectTimeout: 10000,
        });
        console.log('✔ Conectado a MariaDB\n');
    } catch (err) {
        console.error('✘ No se pudo conectar a MariaDB:', err.message);
        console.log('\n⚠ Si MariaDB no está disponible, creá los usuarios manualmente con:');
        console.log('  node backend/db/initSqlite.js --manual');
        process.exit(1);
    }

    // ── 3. Traer usuarios de MariaDB ────────────────────────────────────────
    let mariaUsers;
    try {
        mariaUsers = await conn.query('SELECT id, nombre_usuario, password, rol FROM user');
        console.log(`Usuarios encontrados en MariaDB: ${mariaUsers.length}`);
    } catch (err) {
        console.error('✘ Error al leer la tabla user en MariaDB:', err.message);
        await conn.end();
        process.exit(1);
    }
    await conn.end();

    // ── 4. Insertar en SQLite ───────────────────────────────────────────────
    const insert = sqlite.prepare(`
        INSERT OR IGNORE INTO user (nombre_usuario, password, rol)
        VALUES (@nombre_usuario, @password, @rol)
    `);

    let migrados = 0;
    let omitidos = 0;

    const migrate = sqlite.transaction((users) => {
        for (const u of users) {
            const info = insert.run({
                nombre_usuario: u.nombre_usuario,
                password:       u.password,
                rol:            u.rol || 'viewer',
            });
            if (info.changes > 0) migrados++;
            else omitidos++;
        }
    });

    migrate(mariaUsers);

    console.log(`\n✔ Migración completa:`);
    console.log(`   Migrados: ${migrados}`);
    console.log(`   Omitidos (ya existían): ${omitidos}`);

    // ── 5. Verificar ────────────────────────────────────────────────────────
    const total = sqlite.prepare('SELECT COUNT(*) as cnt FROM user').get();
    const lista = sqlite.prepare('SELECT id, nombre_usuario, rol FROM user').all();
    console.log(`\nUsuarios en SQLite (${total.cnt} total):`);
    lista.forEach(u => console.log(`   [${u.id}] ${u.nombre_usuario} — ${u.rol}`));

    sqlite.close();
    console.log('\n✅ Listo. El backend ya puede usar users.sqlite para autenticación.\n');
}

main().catch(err => {
    console.error('Error inesperado:', err);
    process.exit(1);
});
