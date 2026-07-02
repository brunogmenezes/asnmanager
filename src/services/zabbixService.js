const pool = require('../db');

/**
 * Service to manage connection and sync with Zabbix API
 */
class ZabbixService {
  
  /**
   * Get settings from database
   */
  async getSettings() {
    const res = await pool.query('SELECT * FROM zabbix_settings ORDER BY id DESC LIMIT 1');
    if (res.rowCount === 0) return null;
    return res.rows[0];
  }

  /**
   * Save settings in database
   */
  async saveSettings(settings) {
    const { url, token, username, password } = settings;
    
    // Check if configuration already exists
    const check = await pool.query('SELECT id FROM zabbix_settings');
    
    if (check.rowCount > 0) {
      // Update existing
      const res = await pool.query(
        `UPDATE zabbix_settings 
         SET url = $1, token = $2, username = $3, password = $4
         WHERE id = (SELECT id FROM zabbix_settings ORDER BY id DESC LIMIT 1)
         RETURNING *`,
        [url.trim(), token ? token.trim() : null, username ? username.trim() : null, password ? password.trim() : null]
      );
      return res.rows[0];
    } else {
      // Insert new
      const res = await pool.query(
        `INSERT INTO zabbix_settings (url, token, username, password)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [url.trim(), token ? token.trim() : null, username ? username.trim() : null, password ? password.trim() : null]
      );
      return res.rows[0];
    }
  }

  /**
   * Authenticate and fetch hosts from Zabbix API
   */
  async fetchHostsFromZabbix(settings) {
    const { url, token, username, password } = settings;

    // Check if we are running in simulation/mock mode
    if (url.toLowerCase() === 'mock' || url.toLowerCase() === 'simulacao') {
      return this.getMockHosts();
    }

    let authToken = token;

    // If no token is provided, authenticate with username and password
    if (!authToken) {
      if (!username || !password) {
        throw new Error('Autenticação inválida: Forneça um Token API ou Usuário/Senha.');
      }
      
      console.log(`Efetuando login no Zabbix em: ${url}`);
      try {
        const loginRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'user.login',
            params: { username, password },
            id: 1
          })
        });

        if (!loginRes.ok) {
          throw new Error(`HTTP Error: ${loginRes.status}`);
        }

        const loginData = await loginRes.json();
        if (loginData.error) {
          throw new Error(`Zabbix Login Error: ${loginData.error.message} (${loginData.error.data || ''})`);
        }

        authToken = loginData.result;
      } catch (err) {
        throw new Error(`Falha de conexão com Zabbix: ${err.message}`);
      }
    }

    // Now fetch the hosts from Zabbix
    console.log(`Buscando hosts do Zabbix usando token/sessão...`);
    try {
      const hostsRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'host.get',
          params: {
            output: ['hostid', 'host', 'name'],
            selectInterfaces: ['ip', 'main', 'type'],
            filter: {
              status: '0' // Only monitored hosts
            }
          },
          auth: authToken,
          id: 2
        })
      });

      if (!hostsRes.ok) {
        throw new Error(`HTTP Error: ${hostsRes.status}`);
      }

      const hostsData = await hostsRes.json();
      if (hostsData.error) {
        throw new Error(`Zabbix API Error: ${hostsData.error.message}`);
      }

      const zabbixHosts = hostsData.result || [];
      return zabbixHosts.map(h => {
        // Find primary/main IP address, or fallback to any interface IP
        let ip = '127.0.0.1';
        if (h.interfaces && h.interfaces.length > 0) {
          const mainInterface = h.interfaces.find(i => i.main === '1') || h.interfaces[0];
          ip = mainInterface.ip;
        }
        return {
          zabbix_hostid: h.hostid,
          name: h.name || h.host,
          ip_address: ip,
          location: `Importado do Zabbix (HostID: ${h.hostid})`
        };
      });

    } catch (err) {
      throw new Error(`Erro ao obter hosts do Zabbix: ${err.message}`);
    }
  }

  /**
   * Sync Zabbix hosts into our local database
   */
  async sync() {
    const settings = await this.getSettings();
    if (!settings) {
      throw new Error('Integração com Zabbix não configurada. Configure a integração primeiro.');
    }

    const hosts = await this.fetchHostsFromZabbix(settings);
    let inserted = 0;
    let updated = 0;

    for (const host of hosts) {
      // Check if we already have this host by zabbix_hostid
      const check = await pool.query('SELECT id FROM routers WHERE zabbix_hostid = $1', [host.zabbix_hostid]);
      
      if (check.rowCount > 0) {
        // Update host name, IP address and location
        await pool.query(
          `UPDATE routers 
           SET name = $1, ip_address = $2, location = $3
           WHERE zabbix_hostid = $4`,
          [host.name, host.ip_address, host.location, host.zabbix_hostid]
        );
        updated++;
      } else {
        // Insert new router. If the name is already taken by a manually registered router, we skip or append
        try {
          await pool.query(
            `INSERT INTO routers (name, ip_address, location, zabbix_hostid)
             VALUES ($1, $2, $3, $4)`,
            [host.name, host.ip_address, host.location, host.zabbix_hostid]
          );
          inserted++;
        } catch (err) {
          // If name collision, try appending host ID to the name
          if (err.code === '23505') {
            await pool.query(
              `INSERT INTO routers (name, ip_address, location, zabbix_hostid)
               VALUES ($1, $2, $3, $4)`,
              [`${host.name} (Zabbix-${host.zabbix_hostid})`, host.ip_address, host.location, host.zabbix_hostid]
            );
            inserted++;
          } else {
            console.error(`Erro ao inserir roteador Zabbix ${host.name}:`, err.message);
          }
        }
      }
    }

    // Update last_sync timestamp
    await pool.query(
      `UPDATE zabbix_settings 
       SET last_sync = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [settings.id]
    );

    return { inserted, updated, total: hosts.length };
  }

  /**
   * Simulated mock Zabbix hosts for fallback/testing
   */
  getMockHosts() {
    console.log('Utilizando hosts simulados (Mock Zabbix)...');
    return [
      {
        zabbix_hostid: '10501',
        name: 'Zabbix-Router-Core-SP1',
        ip_address: '172.16.210.1',
        location: 'Mock Zabbix - SP Rack A1'
      },
      {
        zabbix_hostid: '10502',
        name: 'Zabbix-Router-Core-RJ2',
        ip_address: '172.16.210.2',
        location: 'Mock Zabbix - RJ Rack B3'
      },
      {
        zabbix_hostid: '10503',
        name: 'Zabbix-BGP-Borda-POA',
        ip_address: '172.16.210.3',
        location: 'Mock Zabbix - POA Rack C1'
      },
      {
        zabbix_hostid: '10504',
        name: 'Zabbix-BGP-Borda-DF',
        ip_address: '172.16.210.4',
        location: 'Mock Zabbix - DF Rack E4'
      }
    ];
  }

  /**
   * Fetch unique interface tags/applications from Zabbix host items
   */
  async getHostInterfaceTags(hostId) {
    const settings = await this.getSettings();
    if (!settings) {
      throw new Error('Zabbix settings not configured.');
    }

    if (settings.url.toLowerCase() === 'mock' || settings.url.toLowerCase() === 'simulacao') {
      let hostName = 'Switch';
      try {
        const dbRes = await pool.query('SELECT name FROM routers WHERE zabbix_hostid = $1', [hostId]);
        if (dbRes.rowCount > 0) {
          hostName = dbRes.rows[0].name;
        }
      } catch (err) {
        console.error('Erro ao buscar nome do roteador no banco:', err.message);
      }
      return this.getMockInterfaceTags(hostName);
    }

    let authToken = settings.token;
    if (!authToken) {
      authToken = await this.authenticate(settings);
    }

    console.log(`Buscando itens do host Zabbix ${hostId} para extrair portas...`);
    try {
      const response = await fetch(settings.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'item.get',
          params: {
            hostids: [hostId],
            output: ['itemid'],
            selectTags: ['tag', 'value'],
            selectApplications: ['name']
          },
          auth: authToken,
          id: 3
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`Zabbix API Error: ${data.error.message}`);
      }

      const items = data.result || [];
      const tagsSet = new Set();

      items.forEach(item => {
        // Zabbix 6.0+ Tags
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach(t => {
            if (t.tag === 'Application' && t.value && t.value.startsWith('Interface') && t.value !== 'Interface Traffic') {
              tagsSet.add(t.value);
            }
          });
        }
        // Zabbix 5.0 Applications
        if (item.applications && Array.isArray(item.applications)) {
          item.applications.forEach(app => {
            if (app.name && app.name.startsWith('Interface') && app.name !== 'Interface Traffic') {
              tagsSet.add(app.name);
            }
          });
        }
      });

      return Array.from(tagsSet).sort();
    } catch (err) {
      throw new Error(`Erro ao obter portas do Zabbix: ${err.message}`);
    }
  }

  /**
   * Helper to perform authentication with user/password
   */
  async authenticate(settings) {
    const { url, username, password } = settings;
    console.log(`Efetuando login no Zabbix em: ${url}`);
    const loginRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'user.login',
        params: { username, password },
        id: 1
      })
    });

    if (!loginRes.ok) {
      throw new Error(`HTTP Error: ${loginRes.status}`);
    }

    const loginData = await loginRes.json();
    if (loginData.error) {
      throw new Error(`Zabbix Login Error: ${loginData.error.message}`);
    }

    return loginData.result;
  }

  getMockInterfaceTags(hostName) {
    const cleanName = hostName || 'Switch';
    if (cleanName.toUpperCase().includes('DM4615-BGG')) {
      return [
        "Interface gigabit-ethernet-1/1/1(CAMERAS)",
        "Interface gigabit-ethernet-1/1/2(MONITOR_ENERGIA)",
        "Interface gigabit-ethernet-1/1/3()",
        "Interface gigabit-ethernet-1/1/4()",
        "Interface lag-1(LACP-ARAGUATINS)",
        "Interface lag-3(SAO-DOMINGOS)",
        "Interface ten-gigabit-ethernet-1/1/1()",
        "Interface ten-gigabit-ethernet-1/1/2(S-DOMINGOS)",
        "Interface ten-gigabit-ethernet-1/1/3()",
        "Interface ten-gigabit-ethernet-1/1/4(CH44-ARAGUATINS)"
      ];
    }

    if (cleanName.toUpperCase().includes('6730-01-PLAN') || cleanName.toUpperCase().includes('S6730-01-PLAN')) {
      return [
        "Interface hundred-gigabit-ethernet-1/1/1(ELETRONET-LADO_RIVER-01-H3)",
        "Interface hundred-gigabit-ethernet-1/1/2(ELETRONET-LADO_RIVER-01-H2)",
        "Interface hundred-gigabit-ethernet-1/1/3(NE40-01-100GE0/3/1)",
        "Interface hundred-gigabit-ethernet-1/1/4(NE40-01-100GE0/3/0)",
        "Interface hundred-gigabit-ethernet-1/1/5(4770-CARDRUM)",
        "Interface hundred-gigabit-ethernet-1/1/6(4770-CARDRUM)",
        "Interface hundred-gigabit-ethernet-1/1/7(FNA-01-PLAN)",
        "Interface hundred-gigabit-ethernet-1/1/8(LIVRE)",
        "Interface hundred-gigabit-ethernet-1/1/9(DM4770-PLAN-02)",
        "Interface hundred-gigabit-ethernet-1/1/10(S6730-01-PLAN)",
        "Interface hundred-gigabit-ethernet-1/1/11(S6730-01-PLAN)"
      ];
    }

    return [
      `Interface hundred-gigabit-ethernet-1/1/1(${cleanName})`,
      `Interface hundred-gigabit-ethernet-1/1/2(${cleanName})`,
      `Interface hundred-gigabit-ethernet-1/1/3(${cleanName})`,
      `Interface hundred-gigabit-ethernet-1/1/4(${cleanName})`,
      `Interface hundred-gigabit-ethernet-1/1/30(${cleanName})`,
      `Interface hundred-gigabit-ethernet-1/1/31(${cleanName})`,
      `Interface hundred-gigabit-ethernet-1/1/32(${cleanName})`,
      `Interface lag-1(LACP-${cleanName}-UPLINK)`,
      `Interface lag-2(LACP-${cleanName}-BACKBONE)`,
      `Interface ten-gigabit-ethernet-1/1/1(${cleanName}-SERVIDORES)`,
      `Interface ten-gigabit-ethernet-1/1/2(${cleanName}-UPLINK)`
    ];
  }
}

module.exports = new ZabbixService();
