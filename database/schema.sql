-- Criação do esquema inicial para gerenciamento de ASNs
CREATE TABLE IF NOT EXISTS routers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    ip_address INET NOT NULL,
    location VARCHAR(255),
    zabbix_hostid VARCHAR(50) UNIQUE, -- ID correspondente do host no Zabbix
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    contract_number VARCHAR(100) NOT NULL UNIQUE,
    client_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asn_connections (
    id SERIAL PRIMARY KEY,
    asn INTEGER NOT NULL CHECK (asn > 0 AND asn <= 4294967295),
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    router_id INTEGER NOT NULL REFERENCES routers(id) ON DELETE RESTRICT,
    vlan INTEGER NOT NULL CHECK (vlan >= 1 AND vlan <= 4094),
    ipv4_router INET NOT NULL,
    ipv4_client INET NOT NULL,
    ipv6_router INET NOT NULL,
    ipv6_client INET NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    loa_files JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_asn_router_vlan UNIQUE (router_id, vlan) -- Impede VLANs duplicadas no mesmo roteador
);

CREATE TABLE IF NOT EXISTS permitted_prefixes (
    id SERIAL PRIMARY KEY,
    asn_connection_id INTEGER NOT NULL REFERENCES asn_connections(id) ON DELETE CASCADE,
    prefix CIDR NOT NULL, -- Valida automaticamente se é um bloco CIDR válido
    max_length INTEGER NOT NULL CHECK (max_length >= 8 AND max_length <= 128),
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações da integração com Zabbix
CREATE TABLE IF NOT EXISTS zabbix_settings (
    id SERIAL PRIMARY KEY,
    url VARCHAR(255) NOT NULL,
    token VARCHAR(255),
    username VARCHAR(100),
    password VARCHAR(255),
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
