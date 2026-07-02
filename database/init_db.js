require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const config = {
  host: process.env.DB_HOST || '172.16.152.2',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '91lS!&*Ke',
};

async function init() {
  console.log('Iniciando conexão com PostgreSQL...');
  
  // 1. Conectar ao banco padrão 'postgres' para criar o banco de dados se não existir
  const client = new Client({
    ...config,
    database: 'postgres',
  });

  try {
    await client.connect();
    
    // Verificar se o banco de dados 'provedores_asn' existe
    const dbRes = await client.query("SELECT 1 FROM pg_database WHERE datname = 'provedores_asn'");
    if (dbRes.rowCount === 0) {
      console.log("Banco de dados 'provedores_asn' não existe. Criando...");
      await client.query("CREATE DATABASE provedores_asn");
      console.log("Banco de dados 'provedores_asn' criado com sucesso.");
    } else {
      console.log("Banco de dados 'provedores_asn' já existe.");
    }
  } catch (err) {
    console.error('Erro ao conectar ou criar banco de dados inicial:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  // 2. Conectar especificamente ao 'provedores_asn' para aplicar schema e seed
  const appClient = new Client({
    ...config,
    database: 'provedores_asn',
  });

  try {
    await appClient.connect();
    console.log('Conectado ao banco de dados provedores_asn. Aplicando schema...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await appClient.query(schemaSql);
    console.log('Schema SQL executado com sucesso.');

    // Verificar se já há roteadores cadastrados para evitar rodar o seed múltiplas vezes
    const checkSeed = await appClient.query('SELECT COUNT(*) FROM routers');
    if (Number(checkSeed.rows[0].count) === 0) {
      console.log('Banco de dados vazio. Aplicando dados de demonstração (seed)...');
      const seedPath = path.join(__dirname, 'seed.sql');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await appClient.query(seedSql);
      console.log('Seed SQL executado com sucesso.');
    } else {
      console.log('Banco de dados já contém registros. Ignorando o script de seed.');
    }
    
    console.log('Banco de dados inicializado e estruturado com sucesso!');
  } catch (err) {
    console.error('Erro ao estruturar o banco de dados:', err.message);
    process.exit(1);
  } finally {
    await appClient.end();
  }
}

init();
