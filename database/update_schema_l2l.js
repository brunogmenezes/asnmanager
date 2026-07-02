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
    console.log('Conectado para atualizar o banco de dados (Adição de LAN-TO-LAN/L2L)...');

    // 1. Adicionar colunas do L2L e tipo de serviço
    await client.query(`
      ALTER TABLE asn_connections ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) NOT NULL DEFAULT 'bgp' CHECK (service_type IN ('bgp', 'l2l'));
      ALTER TABLE asn_connections ADD COLUMN IF NOT EXISTS switch_a VARCHAR(100);
      ALTER TABLE asn_connections ADD COLUMN IF NOT EXISTS port_a VARCHAR(100);
      ALTER TABLE asn_connections ADD COLUMN IF NOT EXISTS switch_z VARCHAR(100);
      ALTER TABLE asn_connections ADD COLUMN IF NOT EXISTS port_z VARCHAR(100);
      ALTER TABLE asn_connections ADD COLUMN IF NOT EXISTS vpn_type VARCHAR(10) CHECK (vpn_type IN ('VPWS', 'VPLS'));
    `);
    console.log('Colunas de LAN-TO-LAN adicionadas com sucesso.');

    // 2. Tornar as colunas BGP-specific nulas (DROP NOT NULL)
    await client.query(`
      ALTER TABLE asn_connections ALTER COLUMN router_id DROP NOT NULL;
      ALTER TABLE asn_connections ALTER COLUMN ipv4_router DROP NOT NULL;
      ALTER TABLE asn_connections ALTER COLUMN ipv4_client DROP NOT NULL;
      ALTER TABLE asn_connections ALTER COLUMN ipv6_router DROP NOT NULL;
      ALTER TABLE asn_connections ALTER COLUMN ipv6_client DROP NOT NULL;
    `);
    console.log('Colunas específicas BGP configuradas como anuláveis.');

    console.log('Atualização do esquema para LAN-TO-LAN concluída com sucesso!');
  } catch (err) {
    console.error('Erro ao atualizar esquema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

update();
