const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '172.16.152.2',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '91lS!&*Ke',
  database: process.env.DB_NAME || 'provedores_asn',
});

module.exports = pool;
