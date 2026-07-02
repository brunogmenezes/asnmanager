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
    console.log('Conectado para atualizar o banco de dados (Adição de LOA Files)...');

    // Adicionar loa_files à tabela asn_connections
    await client.query(`
      ALTER TABLE asn_connections ADD COLUMN IF NOT EXISTS loa_files JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('Coluna loa_files adicionada com sucesso.');

    console.log('Atualização do esquema para LOA Files concluída!');
  } catch (err) {
    console.error('Erro ao atualizar esquema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

update();
