const express = require('express');
const router = express.Router();
const pool = require('./db');
const zabbixService = require('./services/zabbixService');
const fs = require('fs');
const path = require('path');

// Helper to save base64 files
function saveUploadedFiles(files) {
  if (!Array.isArray(files)) return [];
  
  const savedFiles = [];
  // Use public directory relative to this src/routes.js file
  const uploadDir = path.join(__dirname, 'public', 'uploads');
  
  // Ensure the directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  for (const file of files) {
    // If the file already has a path, keep it
    if (file.path && !file.data) {
      savedFiles.push({
        name: file.name,
        path: file.path,
        size: file.size,
        uploadedAt: file.uploadedAt || new Date().toISOString()
      });
      continue;
    }

    // Process new file with base64 data
    if (file.name && file.data && file.data.includes('base64,')) {
      try {
        const parts = file.data.split('base64,');
        if (parts.length !== 2) continue;

        const base64Data = parts[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Clean filename
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniquePrefix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        const filename = `${uniquePrefix}_${safeName}`;
        const filePath = path.join(uploadDir, filename);

        // Write file
        fs.writeFileSync(filePath, buffer);

        savedFiles.push({
          name: file.name,
          path: `uploads/${filename}`, // relative URL path
          size: buffer.length,
          uploadedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Erro ao salvar arquivo LOA:', err.message);
      }
    }
  }

  return savedFiles;
}

// Helper to send errors uniformly
const handleErrors = (res, error, defaultMsg = 'Erro na operação.') => {
  console.error(error);
  // Se o erro for do Postgres devido a formato IP inválido ou VLAN
  if (error.code === '22P02') {
    return res.status(400).json({ error: 'Formato de IP ou CIDR inválido.' });
  }
  if (error.code === '23505') {
    return res.status(400).json({ error: 'Registro duplicado. O valor informado já está em uso.' });
  }
  if (error.code === '23503') {
    return res.status(400).json({ error: 'Não é possível remover ou alterar este item pois ele está sendo referenciado por outro cadastro.' });
  }
  return res.status(500).json({ error: error.message || defaultMsg });
};

// ==========================================
// ROTEADORES (routers)
// ==========================================

// Listar Roteadores
router.get('/api/routers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM routers ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    handleErrors(res, error, 'Erro ao listar roteadores.');
  }
});

// Criar Roteador
router.post('/api/routers', async (req, res) => {
  const { name, ip_address, location } = req.body;
  if (!name || !ip_address) {
    return res.status(400).json({ error: 'Nome e Endereço IP são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO routers (name, ip_address, location) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), ip_address.trim(), location ? location.trim() : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleErrors(res, error, 'Erro ao criar roteador.');
  }
});

// Atualizar Roteador
router.put('/api/routers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, ip_address, location } = req.body;
  if (!name || !ip_address) {
    return res.status(400).json({ error: 'Nome e Endereço IP são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      'UPDATE routers SET name = $1, ip_address = $2, location = $3 WHERE id = $4 RETURNING *',
      [name.trim(), ip_address.trim(), location ? location.trim() : null, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Roteador não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    handleErrors(res, error, 'Erro ao atualizar roteador.');
  }
});

// Excluir Roteador
router.delete('/api/routers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM routers WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Roteador não encontrado.' });
    }
    res.json({ message: 'Roteador excluído com sucesso.' });
  } catch (error) {
    handleErrors(res, error, 'Erro ao excluir roteador.');
  }
});

// ==========================================
// CONTRATOS (contracts)
// ==========================================

// Listar Contratos
router.get('/api/contracts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contracts ORDER BY contract_number ASC');
    res.json(result.rows);
  } catch (error) {
    handleErrors(res, error, 'Erro ao listar contratos.');
  }
});

// Criar Contrato
router.post('/api/contracts', async (req, res) => {
  const { contract_number, client_name, status, start_date, end_date } = req.body;
  if (!contract_number || !client_name || !start_date) {
    return res.status(400).json({ error: 'Número do contrato, Nome do cliente e Data de início são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO contracts (contract_number, client_name, status, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        contract_number.trim(),
        client_name.trim(),
        status || 'active',
        start_date,
        end_date || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleErrors(res, error, 'Erro ao criar contrato.');
  }
});

// Atualizar Contrato
router.put('/api/contracts/:id', async (req, res) => {
  const { id } = req.params;
  const { contract_number, client_name, status, start_date, end_date } = req.body;
  if (!contract_number || !client_name || !start_date) {
    return res.status(400).json({ error: 'Número do contrato, Nome do cliente e Data de início são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      'UPDATE contracts SET contract_number = $1, client_name = $2, status = $3, start_date = $4, end_date = $5 WHERE id = $6 RETURNING *',
      [
        contract_number.trim(),
        client_name.trim(),
        status || 'active',
        start_date,
        end_date || null,
        id
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Contrato não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    handleErrors(res, error, 'Erro ao atualizar contrato.');
  }
});

// Excluir Contrato
router.delete('/api/contracts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM contracts WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Contrato não encontrado.' });
    }
    res.json({ message: 'Contrato excluído com sucesso.' });
  } catch (error) {
    handleErrors(res, error, 'Erro ao excluir contrato.');
  }
});

// ==========================================
// CONEXÕES ASN (asn_connections)
// ==========================================

// Listar Conexões ASN
router.get('/api/connections', async (req, res) => {
  try {
    const query = `
      SELECT 
        ac.*,
        c.client_name,
        c.contract_number,
        r.name as router_name,
        oa.name as operator_name,
        (SELECT COUNT(*) FROM permitted_prefixes WHERE asn_connection_id = ac.id) as prefix_count
      FROM asn_connections ac
      JOIN contracts c ON ac.contract_id = c.id
      LEFT JOIN routers r ON ac.router_id = r.id
      LEFT JOIN operator_asns oa ON ac.operator_asn = oa.asn
      ORDER BY ac.asn ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    handleErrors(res, error, 'Erro ao listar conexões ASN.');
  }
});

// Criar Conexão ASN com transação para múltiplos prefixos
router.post('/api/connections', async (req, res) => {
  const {
    asn,
    operator_asn, // ASN do Lado A (Operadora)
    contract_id,
    router_id,
    vlan,
    ipv4_router,
    ipv4_client,
    ipv6_router,
    ipv6_client,
    status,
    prefixes, // Array opcional de prefixos: [{ prefix: '...', max_length: 24, description: '...' }]
    service_type,
    switch_a,
    port_a,
    switch_z,
    port_z,
    vpn_type,
    loa_files
  } = req.body;

  const currentServiceType = service_type || 'bgp';

  if (!contract_id || !vlan) {
    return res.status(400).json({ error: 'Contrato e VLAN são obrigatórios.' });
  }

  const vlanInt = parseInt(vlan);
  if (isNaN(vlanInt) || vlanInt < 1 || vlanInt > 4094) {
    return res.status(400).json({ error: 'VLAN deve ser um número entre 1 e 4094.' });
  }

  let asnInt = null;
  if (asn) {
    asnInt = parseInt(asn);
    if (isNaN(asnInt) || asnInt <= 0 || asnInt > 4294967295) {
      return res.status(400).json({ error: 'ASN deve ser um número inteiro válido e positivo.' });
    }
  } else if (currentServiceType === 'bgp') {
    return res.status(400).json({ error: 'Para sessões BGP, o ASN do cliente é obrigatório.' });
  }

  const opAsnInt = parseInt(operator_asn || 264426);
  if (isNaN(opAsnInt) || opAsnInt <= 0 || opAsnInt > 4294967295) {
    return res.status(400).json({ error: 'ASN da Operadora (Lado A) deve ser um número inteiro válido.' });
  }

  // Validação específica por tipo de serviço
  if (currentServiceType === 'bgp') {
    if (!router_id) {
      return res.status(400).json({ error: 'Para sessões BGP, o Roteador Conectado é obrigatório.' });
    }
    const hasIPv4 = ipv4_router && ipv4_client;
    const hasIPv6 = ipv6_router && ipv6_client;
    if (!hasIPv4 && !hasIPv6) {
      return res.status(400).json({ error: 'Por favor, forneça a configuração de IPv4 (Lado A e Z) ou IPv6 (Lado A e Z) para a Sessão BGP.' });
    }
    if ((ipv4_router && !ipv4_client) || (!ipv4_router && ipv4_client)) {
      return res.status(400).json({ error: 'Para configurar IPv4, ambos os IPs (Lado A e Lado Z) são obrigatórios.' });
    }
    if ((ipv6_router && !ipv6_client) || (!ipv6_router && ipv6_client)) {
      return res.status(400).json({ error: 'Para configurar IPv6, ambos os IPs (Lado A e Lado Z) são obrigatórios.' });
    }
  } else if (currentServiceType === 'l2l') {
    if (!switch_a || !port_a || !switch_z || !port_z || !vpn_type) {
      return res.status(400).json({ error: 'Para LAN-TO-LAN (L2L), os switches, portas e tipo de VPN são obrigatórios.' });
    }
    if (vpn_type !== 'VPWS' && vpn_type !== 'VPLS') {
      return res.status(400).json({ error: 'Tipo de VPN deve ser VPWS ou VPLS.' });
    }
  } else {
    return res.status(400).json({ error: 'Tipo de serviço inválido. Deve ser bgp ou l2l.' });
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const processedLoas = currentServiceType === 'bgp' ? saveUploadedFiles(loa_files) : [];

    // 1. Inserir a Conexão ASN
    const connResult = await dbClient.query(
      `INSERT INTO asn_connections (
        asn, operator_asn, contract_id, router_id, vlan, 
        ipv4_router, ipv4_client, ipv6_router, ipv6_client, status,
        service_type, switch_a, port_a, switch_z, port_z, vpn_type,
        loa_files
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [
        asnInt,
        opAsnInt,
        contract_id,
        currentServiceType === 'bgp' ? router_id : null,
        vlanInt,
        currentServiceType === 'bgp' ? (ipv4_router && ipv4_router.trim() ? ipv4_router.trim() : null) : null,
        currentServiceType === 'bgp' ? (ipv4_client && ipv4_client.trim() ? ipv4_client.trim() : null) : null,
        currentServiceType === 'bgp' ? (ipv6_router && ipv6_router.trim() ? ipv6_router.trim() : null) : null,
        currentServiceType === 'bgp' ? (ipv6_client && ipv6_client.trim() ? ipv6_client.trim() : null) : null,
        status || 'active',
        currentServiceType,
        switch_a && switch_a.trim() ? switch_a.trim() : null,
        port_a && port_a.trim() ? port_a.trim() : null,
        switch_z && switch_z.trim() ? switch_z.trim() : null,
        port_z && port_z.trim() ? port_z.trim() : null,
        currentServiceType === 'l2l' ? vpn_type : null,
        JSON.stringify(processedLoas)
      ]
    );

    const connectionId = connResult.rows[0].id;

    // 2. Inserir os prefixos se fornecidos (Somente para BGP)
    if (currentServiceType === 'bgp' && prefixes && Array.isArray(prefixes) && prefixes.length > 0) {
      for (const p of prefixes) {
        if (!p.prefix || !p.max_length) {
          throw new Error('Formato de prefixo inválido: Prefixo e Máscara Máxima são obrigatórios.');
        }
        const maxLen = parseInt(p.max_length);
        if (isNaN(maxLen) || maxLen < 8 || maxLen > 128) {
          throw new Error('Formato de prefixo inválido: Comprimento máximo deve estar entre 8 e 128.');
        }

        await dbClient.query(
          `INSERT INTO permitted_prefixes (
            asn_connection_id, prefix, max_length, description
          ) VALUES ($1, $2, $3, $4)`,
          [
            connectionId,
            p.prefix.trim(),
            maxLen,
            p.description ? p.description.trim() : null
          ]
        );
      }
    }

    await dbClient.query('COMMIT');
    res.status(201).json(connResult.rows[0]);
  } catch (error) {
    await dbClient.query('ROLLBACK');
    handleErrors(res, error, 'Erro ao criar conexão ASN.');
  } finally {
    dbClient.release();
  }
});

// Atualizar Conexão ASN
router.put('/api/connections/:id', async (req, res) => {
  const { id } = req.params;
  const {
    asn,
    operator_asn,
    contract_id,
    router_id,
    vlan,
    ipv4_router,
    ipv4_client,
    ipv6_router,
    ipv6_client,
    status,
    service_type,
    switch_a,
    port_a,
    switch_z,
    port_z,
    vpn_type,
    loa_files
  } = req.body;

  const currentServiceType = service_type || 'bgp';

  if (!contract_id || !vlan) {
    return res.status(400).json({ error: 'Contrato e VLAN são obrigatórios.' });
  }

  const vlanInt = parseInt(vlan);
  if (isNaN(vlanInt) || vlanInt < 1 || vlanInt > 4094) {
    return res.status(400).json({ error: 'VLAN deve ser um número entre 1 e 4094.' });
  }

  let asnInt = null;
  if (asn) {
    asnInt = parseInt(asn);
    if (isNaN(asnInt) || asnInt <= 0 || asnInt > 4294967295) {
      return res.status(400).json({ error: 'ASN deve ser um número inteiro válido.' });
    }
  } else if (currentServiceType === 'bgp') {
    return res.status(400).json({ error: 'Para sessões BGP, o ASN do cliente é obrigatório.' });
  }

  const opAsnInt = parseInt(operator_asn || 264426);
  if (isNaN(opAsnInt) || opAsnInt <= 0 || opAsnInt > 4294967295) {
    return res.status(400).json({ error: 'ASN da Operadora (Lado A) deve ser um número inteiro válido.' });
  }

  // Validação específica por tipo de serviço
  if (currentServiceType === 'bgp') {
    if (!router_id) {
      return res.status(400).json({ error: 'Para sessões BGP, o Roteador Conectado é obrigatório.' });
    }
    const hasIPv4 = ipv4_router && ipv4_client;
    const hasIPv6 = ipv6_router && ipv6_client;
    if (!hasIPv4 && !hasIPv6) {
      return res.status(400).json({ error: 'Por favor, forneça a configuração de IPv4 (Lado A e Z) ou IPv6 (Lado A e Z) para a Sessão BGP.' });
    }
    if ((ipv4_router && !ipv4_client) || (!ipv4_router && ipv4_client)) {
      return res.status(400).json({ error: 'Para configurar IPv4, ambos os IPs (Lado A e Lado Z) são obrigatórios.' });
    }
    if ((ipv6_router && !ipv6_client) || (!ipv6_router && ipv6_client)) {
      return res.status(400).json({ error: 'Para configurar IPv6, ambos os IPs (Lado A e Lado Z) são obrigatórios.' });
    }
  } else if (currentServiceType === 'l2l') {
    if (!switch_a || !port_a || !switch_z || !port_z || !vpn_type) {
      return res.status(400).json({ error: 'Para LAN-TO-LAN (L2L), os switches, portas e tipo de VPN são obrigatórios.' });
    }
    if (vpn_type !== 'VPWS' && vpn_type !== 'VPLS') {
      return res.status(400).json({ error: 'Tipo de VPN deve ser VPWS ou VPLS.' });
    }
  } else {
    return res.status(400).json({ error: 'Tipo de serviço inválido. Deve ser bgp ou l2l.' });
  }

  try {
    const processedLoas = currentServiceType === 'bgp' ? saveUploadedFiles(loa_files) : [];

    const result = await pool.query(
      `UPDATE asn_connections SET 
        asn = $1, operator_asn = $2, contract_id = $3, router_id = $4, vlan = $5, 
        ipv4_router = $6, ipv4_client = $7, ipv6_router = $8, ipv6_client = $9, status = $10,
        service_type = $11, switch_a = $12, port_a = $13, switch_z = $14, port_z = $15, vpn_type = $16,
        loa_files = $17
      WHERE id = $18 RETURNING *`,
      [
        asnInt,
        opAsnInt,
        contract_id,
        currentServiceType === 'bgp' ? router_id : null,
        vlanInt,
        currentServiceType === 'bgp' ? (ipv4_router ? ipv4_router.trim() : null) : null,
        currentServiceType === 'bgp' ? (ipv4_client ? ipv4_client.trim() : null) : null,
        currentServiceType === 'bgp' ? (ipv6_router ? ipv6_router.trim() : null) : null,
        currentServiceType === 'bgp' ? (ipv6_client ? ipv6_client.trim() : null) : null,
        status || 'active',
        currentServiceType,
        switch_a && switch_a.trim() ? switch_a.trim() : null,
        port_a && port_a.trim() ? port_a.trim() : null,
        switch_z && switch_z.trim() ? switch_z.trim() : null,
        port_z && port_z.trim() ? port_z.trim() : null,
        currentServiceType === 'l2l' ? vpn_type : null,
        JSON.stringify(processedLoas),
        id
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Conexão ASN não encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    handleErrors(res, error, 'Erro ao atualizar conexão ASN.');
  }
});

// Excluir Conexão ASN
router.delete('/api/connections/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM asn_connections WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Conexão ASN não encontrada.' });
    }
    res.json({ message: 'Conexão ASN excluída com sucesso.' });
  } catch (error) {
    handleErrors(res, error, 'Erro ao excluir conexão ASN.');
  }
});

// ==========================================
// PREFIXOS PERMITIDOS (permitted_prefixes)
// ==========================================

// Listar Prefixos Permitidos
router.get('/api/prefixes', async (req, res) => {
  try {
    const query = `
      SELECT 
        pp.*,
        ac.asn,
        c.client_name
      FROM permitted_prefixes pp
      JOIN asn_connections ac ON pp.asn_connection_id = ac.id
      JOIN contracts c ON ac.contract_id = c.id
      ORDER BY ac.asn ASC, pp.prefix ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    handleErrors(res, error, 'Erro ao listar prefixos permitidos.');
  }
});

// Criar Prefixo Permitido
router.post('/api/prefixes', async (req, res) => {
  const { asn_connection_id, prefix, max_length, description } = req.body;
  if (!asn_connection_id || !prefix || !max_length) {
    return res.status(400).json({ error: 'Conexão ASN, Bloco de Prefixo CIDR e Máscara Máxima (Max Length) são obrigatórios.' });
  }

  const maxLengthInt = parseInt(max_length);
  if (isNaN(maxLengthInt) || maxLengthInt < 8 || maxLengthInt > 128) {
    return res.status(400).json({ error: 'O comprimento máximo (max_length) deve estar entre 8 e 128.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO permitted_prefixes (asn_connection_id, prefix, max_length, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [asn_connection_id, prefix.trim(), maxLengthInt, description ? description.trim() : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleErrors(res, error, 'Erro ao criar prefixo permitido.');
  }
});

// Atualizar Prefixo Permitido
router.put('/api/prefixes/:id', async (req, res) => {
  const { id } = req.params;
  const { asn_connection_id, prefix, max_length, description } = req.body;
  if (!asn_connection_id || !prefix || !max_length) {
    return res.status(400).json({ error: 'Conexão ASN, Bloco de Prefixo CIDR e Máscara Máxima são obrigatórios.' });
  }

  const maxLengthInt = parseInt(max_length);
  if (isNaN(maxLengthInt) || maxLengthInt < 8 || maxLengthInt > 128) {
    return res.status(400).json({ error: 'O comprimento máximo (max_length) deve estar entre 8 e 128.' });
  }

  try {
    const result = await pool.query(
      'UPDATE permitted_prefixes SET asn_connection_id = $1, prefix = $2, max_length = $3, description = $4 WHERE id = $5 RETURNING *',
      [asn_connection_id, prefix.trim(), maxLengthInt, description ? description.trim() : null, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro de prefixo não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    handleErrors(res, error, 'Erro ao atualizar prefixo permitido.');
  }
});

// Excluir Prefixo Permitido
router.delete('/api/prefixes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM permitted_prefixes WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro de prefixo não encontrado.' });
    }
    res.json({ message: 'Prefixo excluído com sucesso.' });
  } catch (error) {
    handleErrors(res, error, 'Erro ao excluir prefixo permitido.');
  }
});

// ==========================================
// INTEGRAÇÃO ZABBIX
// ==========================================

// Obter Configurações do Zabbix
router.get('/api/zabbix/settings', async (req, res) => {
  try {
    const settings = await zabbixService.getSettings();
    if (!settings) {
      return res.json(null);
    }
    // Ocultar informações confidenciais no retorno
    const safeSettings = {
      url: settings.url,
      username: settings.username,
      hasToken: !!settings.token,
      hasPassword: !!settings.password,
      last_sync: settings.last_sync
    };
    res.json(safeSettings);
  } catch (error) {
    handleErrors(res, error, 'Erro ao obter configurações do Zabbix.');
  }
});

// Salvar Configurações do Zabbix
router.post('/api/zabbix/settings', async (req, res) => {
  const { url, token, username, password } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'A URL do Zabbix é obrigatória (use "mock" para simulação).' });
  }
  try {
    const saved = await zabbixService.saveSettings({ url, token, username, password });
    res.json({ message: 'Configurações do Zabbix salvas com sucesso!', last_sync: saved.last_sync });
  } catch (error) {
    handleErrors(res, error, 'Erro ao salvar configurações do Zabbix.');
  }
});

// Executar Sincronização de Hosts do Zabbix
router.post('/api/zabbix/sync', async (req, res) => {
  try {
    const stats = await zabbixService.sync();
    res.json({
      message: 'Sincronização concluída com sucesso!',
      inserted: stats.inserted,
      updated: stats.updated,
      total: stats.total
    });
  } catch (error) {
    handleErrors(res, error, 'Erro ao sincronizar com Zabbix.');
  }
});

// Buscar portas/interfaces de um Host do Zabbix
router.get('/api/zabbix/hosts/:hostid/interfaces', async (req, res) => {
  const { hostid } = req.params;
  try {
    const interfaces = await zabbixService.getHostInterfaceTags(hostid);
    res.json(interfaces);
  } catch (error) {
    handleErrors(res, error, 'Erro ao buscar portas no Zabbix.');
  }
});

// ==========================================
// MINHAS CONFIGURAÇÕES (operator_asns)
// ==========================================

// Listar ASNs da operadora
router.get('/api/operator-asns', async (req, res) => {
  try {
    // Exclude logo_base64 from list for performance, use separate route for logo
    const result = await pool.query('SELECT id, asn, name, logo_base64, created_at FROM operator_asns ORDER BY asn ASC');
    res.json(result.rows);
  } catch (error) {
    handleErrors(res, error, 'Erro ao listar ASNs da operadora.');
  }
});

// Cadastrar ASN da operadora
router.post('/api/operator-asns', async (req, res) => {
  const { asn, name, logo_base64 } = req.body;
  if (!asn || !name) {
    return res.status(400).json({ error: 'ASN e Nome de exibição são obrigatórios.' });
  }
  const asnInt = parseInt(asn);
  if (isNaN(asnInt) || asnInt <= 0 || asnInt > 4294967295) {
    return res.status(400).json({ error: 'ASN inválido.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO operator_asns (asn, name, logo_base64) VALUES ($1, $2, $3) RETURNING *',
      [asnInt, name.trim(), logo_base64 || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleErrors(res, error, 'Erro ao cadastrar ASN da operadora.');
  }
});

// Atualizar ASN da operadora
router.put('/api/operator-asns/:id', async (req, res) => {
  const { id } = req.params;
  const { asn, name, logo_base64 } = req.body;
  if (!asn || !name) {
    return res.status(400).json({ error: 'ASN e Nome de exibição são obrigatórios.' });
  }
  const asnInt = parseInt(asn);
  if (isNaN(asnInt) || asnInt <= 0 || asnInt > 4294967295) {
    return res.status(400).json({ error: 'ASN inválido.' });
  }

  try {
    // If logo_base64 is explicitly null string (clear logo), set null; if undefined (not sent), keep existing
    let query, params;
    if (logo_base64 === undefined) {
      // Don't update logo column — keep existing
      query = 'UPDATE operator_asns SET asn = $1, name = $2 WHERE id = $3 RETURNING *';
      params = [asnInt, name.trim(), id];
    } else {
      // Update logo too (could be null to clear it, or new base64 string)
      query = 'UPDATE operator_asns SET asn = $1, name = $2, logo_base64 = $3 WHERE id = $4 RETURNING *';
      params = [asnInt, name.trim(), logo_base64 || null, id];
    }

    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    handleErrors(res, error, 'Erro ao atualizar ASN da operadora.');
  }
});

// Excluir ASN da operadora
router.delete('/api/operator-asns/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM operator_asns WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }
    res.json({ message: 'ASN da operadora excluído com sucesso.' });
  } catch (error) {
    handleErrors(res, error, 'Erro ao excluir ASN da operadora.');
  }
});

// Exportar PDF pre-gerado e salvar fisicamente no servidor para evitar intercepção de downloads UUID pelo Sandbox
router.post('/api/export-pdf', (req, res) => {
  const { pdfData, fileName } = req.body;
  if (!pdfData || !fileName) {
    return res.status(400).json({ error: 'Dados do PDF ou nome de arquivo não fornecidos.' });
  }

  const fs = require('fs');
  const path = require('path');

  try {
    const buffer = Buffer.from(pdfData, 'base64');
    const downloadsDir = path.join(__dirname, 'public', 'downloads');
    
    // Garantir que a pasta de downloads exista
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const filePath = path.join(downloadsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    res.json({
      success: true,
      url: `/downloads/${fileName}`,
      fileName: fileName
    });
  } catch (error) {
    console.error('Erro ao salvar PDF no servidor:', error);
    res.status(500).json({ error: 'Erro interno ao exportar arquivo PDF.' });
  }
});

module.exports = router;
