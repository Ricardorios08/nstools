const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  port: parseInt(process.env.PG_PORT || "5432"),
  database: process.env.PG_DATABASE || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
