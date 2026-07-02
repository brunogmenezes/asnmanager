-- Inserção de dados iniciais para demonstração e testes

-- 1. Cadastrar Roteadores de Borda
INSERT INTO routers (name, ip_address, location) VALUES
('Edge-Router-01 (São Paulo)', '172.16.200.1', 'Datacenter SP1 - Rack A12'),
('Edge-Router-02 (Rio de Janeiro)', '172.16.200.2', 'Datacenter RJ1 - Rack B04')
ON CONFLICT (name) DO NOTHING;

-- 2. Cadastrar Contratos
INSERT INTO contracts (contract_number, client_name, status, start_date, end_date) VALUES
('CONTRATO-2026-001', 'FibraMais Telecomunicações LTDA', 'active', '2026-01-01', '2027-01-01'),
('CONTRATO-2026-002', 'LinkRapido Provedor de Internet', 'active', '2026-03-15', NULL),
('CONTRATO-2026-003', 'NetSpeed Brasil Internet Segura', 'suspended', '2025-06-01', '2026-06-01')
ON CONFLICT (contract_number) DO NOTHING;

-- 3. Cadastrar Conexões ASN
-- Conexão 1: FibraMais (ASN 65100) -> Edge-Router-01 (Vlan 100)
-- Como precisamos dos IDs gerados dinamicamente, fazemos subconsultas
INSERT INTO asn_connections (asn, contract_id, router_id, vlan, ipv4_router, ipv4_client, ipv6_router, ipv6_client, status)
SELECT 
    65100, 
    c.id, 
    r.id, 
    100, 
    '192.168.100.1', 
    '192.168.100.2', 
    '2001:db8:100::1', 
    '2001:db8:100::2', 
    'active'
FROM contracts c, routers r
WHERE c.contract_number = 'CONTRATO-2026-001' AND r.name = 'Edge-Router-01 (São Paulo)';

-- Conexão 2: LinkRapido (ASN 65200) -> Edge-Router-02 (Vlan 200)
INSERT INTO asn_connections (asn, contract_id, router_id, vlan, ipv4_router, ipv4_client, ipv6_router, ipv6_client, status)
SELECT 
    65200, 
    c.id, 
    r.id, 
    200, 
    '192.168.200.1', 
    '192.168.200.2', 
    '2001:db8:200::1', 
    '2001:db8:200::2', 
    'active'
FROM contracts c, routers r
WHERE c.contract_number = 'CONTRATO-2026-002' AND r.name = 'Edge-Router-02 (Rio de Janeiro)';

-- 4. Cadastrar Prefixos Permitidos
-- Prefixos para ASN 65100 (conexão id correspondente)
INSERT INTO permitted_prefixes (asn_connection_id, prefix, max_length, description)
SELECT 
    ac.id, 
    '198.51.100.0/22', 
    24, 
    'Bloco IPv4 principal do cliente FibraMais'
FROM asn_connections ac
WHERE ac.asn = 65100;

INSERT INTO permitted_prefixes (asn_connection_id, prefix, max_length, description)
SELECT 
    ac.id, 
    '2001:db8:a000::/48', 
    48, 
    'Bloco IPv6 principal do cliente FibraMais'
FROM asn_connections ac
WHERE ac.asn = 65100;

-- Prefixos para ASN 65200
INSERT INTO permitted_prefixes (asn_connection_id, prefix, max_length, description)
SELECT 
    ac.id, 
    '203.0.113.0/24', 
    24, 
    'Bloco IPv4 do cliente LinkRapido'
FROM asn_connections ac
WHERE ac.asn = 65200;
