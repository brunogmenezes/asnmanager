require('dotenv').config();
const { Client } = require('pg');

const config = {
  host: process.env.DB_HOST || '172.16.152.2',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '91lS!&*Ke',
  database: process.env.DB_NAME || 'provedores_asn',
};

async function update() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('Conectado para alterar coluna asn para NULLABLE...');
    await client.query(`
      ALTER TABLE asn_connections ALTER COLUMN asn DROP NOT NULL;
    `);
    console.log('Coluna asn configurada como anulável com sucesso.');
  } catch (err) {
    console.error('Erro ao atualizar esquema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

update();
