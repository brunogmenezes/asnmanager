require('dotenv').config();
const { Client } = require('pg');

const config = {
  host: process.env.DB_HOST || '172.16.152.2',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '91lS!&*Ke',
  database: process.env.DB_NAME || 'provedores_asn',
};

async function migrate() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('Conectado ao banco de dados para criação da tabela operator_asns...');

    // 1. Criar a tabela operator_asns
    await client.query(`
      CREATE TABLE IF NOT EXISTS operator_asns (
        id SERIAL PRIMARY KEY,
        asn INTEGER NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela operator_asns criada ou já existente.');

    // 2. Inserir o registro padrão (264426 - Operadora Principal)
    await client.query(`
      INSERT INTO operator_asns (asn, name) 
      VALUES (264426, 'Operadora Principal') 
      ON CONFLICT (asn) DO NOTHING;
    `);
    console.log('Registro de seeding padrão inserido/verificado.');

    console.log('Migração de operator_asns concluída com sucesso!');
  } catch (err) {
    console.error('Erro na migração:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
