// backend/db/testConnection.js
// Script de prueba para verificar la conectividad a MariaDB usando la misma configuración que la aplicación.
// Lee el .env ubicado en backend/.env y muestra los parámetros antes de intentar obtener una conexión.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mariadb = require('mariadb');

(async () => {
  const config = {
    host: process.env.MARIA_HOST,
    port: parseInt(process.env.MARIA_PORT || "3306", 10),
    user: process.env.MARIA_USER,
    password: process.env.MARIA_PASS,
    database: process.env.MARIA_DB_NAME,
    connectionLimit: 1,
    connectTimeout: 5000,
    acquireTimeout: 5000,
  };

  console.log('--- Parámetros de conexión ---');
  console.log(config);

  const pool = mariadb.createPool(config);

  try {
    const conn = await pool.getConnection();
    console.log('✅ Conexión exitosa a MariaDB');
    await conn.end();
  } catch (err) {
    console.error('❌ Error al obtener conexión:');
    console.error(err);
  } finally {
    await pool.end();
  }
})();
