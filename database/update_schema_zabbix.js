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
    console.log('Conectado para atualizar o banco de dados...');

    // 1. Adicionar zabbix_hostid à tabela routers
    await client.query(`
      ALTER TABLE routers ADD COLUMN IF NOT EXISTS zabbix_hostid VARCHAR(50) UNIQUE;
    `);
    console.log('Coluna zabbix_hostid adicionada com sucesso.');

    // 2. Criar tabela zabbix_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS zabbix_settings (
          id SERIAL PRIMARY KEY,
          url VARCHAR(255) NOT NULL,
          token VARCHAR(255),
          username VARCHAR(100),
          password VARCHAR(255),
          last_sync TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela zabbix_settings criada com sucesso.');

    console.log('Atualização de esquema concluída!');
  } catch (err) {
    console.error('Erro ao atualizar esquema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

update();
