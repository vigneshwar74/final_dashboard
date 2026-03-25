const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const useSsl =
  process.env.PGSSL === 'true' ||
  (process.env.NODE_ENV === 'production' &&
    connectionString &&
    !connectionString.includes('localhost') &&
    !connectionString.includes('127.0.0.1'));

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
