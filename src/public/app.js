/* -------------------------------------------------------------
   BGP Core - Client ASN Manager Frontend JavaScript
   ------------------------------------------------------------- */

// Global State
const State = {
  routers: [],
  contracts: [],
  connections: [],
  prefixes: [],
  operatorAsns: [], // Added for Settings
  // Pagination variables for lists (all default to 5)
  routersPage: 1,
  routersLimit: 5,
  dashboardPage: 1,
  dashboardLimit: 5,
  connectionsPage: 1,
  connectionsLimit: 5,
  prefixesPage: 1,
  prefixesLimit: 5,
  contractsPage: 1,
  contractsLimit: 5,
  settingsPage: 1, // Added for Settings
  settingsLimit: 5, // Added for Settings
  // Wizard temporary prefix state
  tempPrefixes: [],
  tempLoaFiles: []
};

// DOM Elements & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFormSubmissions();
  
  // Quick Add Button on Top Bar
  document.getElementById('btn-quick-add').addEventListener('click', () => {
    openConnectionModal();
  });

  // Cancel edit buttons
  document.getElementById('btn-cancel-router-edit').addEventListener('click', cancelRouterEdit);
  document.getElementById('btn-cancel-contract-edit').addEventListener('click', cancelContractEdit);
  document.getElementById('btn-cancel-prefix-edit').addEventListener('click', closePrefixModal);
  document.getElementById('btn-cancel-setting-edit').addEventListener('click', cancelSettingEdit);

  // Settings settings form submission
  document.getElementById('settings-form').addEventListener('submit', saveSetting);

  // Zabbix sync button listeners
  document.getElementById('btn-zabbix-sync').addEventListener('click', triggerZabbixSync);
  document.getElementById('btn-zabbix-test-sync').addEventListener('click', triggerZabbixSync);

  // Zabbix settings form submission
  document.getElementById('zabbix-form').addEventListener('submit', saveZabbixSettings);

  // Search inputs listeners
  document.getElementById('dashboard-search').addEventListener('input', () => {
    State.dashboardPage = 1;
    renderDashboardConnectionsTable();
  });
  document.getElementById('connections-search').addEventListener('input', () => {
    State.connectionsPage = 1;
    renderConnectionsTable();
  });
  document.getElementById('routers-search').addEventListener('input', () => {
    State.routersPage = 1;
    renderRoutersTable();
  });
  document.getElementById('prefixes-search').addEventListener('input', () => {
    State.prefixesPage = 1;
    renderPrefixesTable();
  });

  // File input change handler for LOAs
  const fileInput = document.getElementById('conn-loa-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          State.tempLoaFiles.push({
            name: file.name,
            size: file.size,
            data: event.target.result // Base64 Data URL
          });
          renderConnectionLoaFiles();
        };
        reader.readAsDataURL(file);
      });
      // Reset input value so same file can be selected again
      fileInput.value = '';
    });
  }

  // Init Wizard, Autocomplete and Pagination listeners
  initAutocomplete();
  initWizard();
  initPaginationListeners();

  // Initial Data Load
  loadAll();

  // Routers pagination listeners
  document.getElementById('routers-limit-select').addEventListener('change', (e) => {
    State.routersLimit = parseInt(e.target.value);
    State.routersPage = 1;
    renderRoutersTable();
  });
  document.getElementById('btn-routers-prev').addEventListener('click', () => {
    if (State.routersPage > 1) {
      State.routersPage--;
      renderRoutersTable();
    }
  });
  document.getElementById('btn-routers-next').addEventListener('click', () => {
    const searchVal = document.getElementById('routers-search') ? document.getElementById('routers-search').value.toLowerCase().trim() : '';
    const filteredCount = State.routers.filter(router => {
      if (!searchVal) return true;
      return (router.name && router.name.toLowerCase().includes(searchVal)) ||
             (router.ip_address && router.ip_address.toLowerCase().includes(searchVal)) ||
             (router.location && router.location.toLowerCase().includes(searchVal));
    }).length;
    
    const totalPages = Math.ceil(filteredCount / State.routersLimit) || 1;
    if (State.routersPage < totalPages) {
      State.routersPage++;
      renderRoutersTable();
    }
  });
});

// -------------------------------------------------------------
// Toast Alerts System
// -------------------------------------------------------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = document.createElement('i');
  icon.className = type === 'success' 
    ? 'fa-solid fa-circle-check toast-icon' 
    : 'fa-solid fa-circle-exclamation toast-icon';
    
  const text = document.createElement('span');
  text.className = 'toast-message';
  text.innerText = message;
  
  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);
  
  // Slide out and remove toast after 4s
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Toast especial para exibir link do PDF gerado
function showPdfToast(url) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast success';
  toast.style.minWidth = '340px';
  toast.style.gap = '10px';
  toast.style.paddingRight = '16px';

  // Icon
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-file-pdf toast-icon';
  icon.style.fontSize = '20px';
  icon.style.color = '#10b981';

  // Text block
  const textBlock = document.createElement('div');
  textBlock.style.display = 'flex';
  textBlock.style.flexDirection = 'column';
  textBlock.style.gap = '6px';
  textBlock.style.flex = '1';

  const title = document.createElement('span');
  title.innerText = 'PDF gerado com sucesso!';
  title.style.fontWeight = '600';
  title.style.fontSize = '13px';
  title.style.color = '#f3f4f6';

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'background: rgba(6,182,212,0.15)',
    'border: 1px solid rgba(6,182,212,0.4)',
    'border-radius: 6px',
    'padding: 4px 10px',
    'font-size: 12px',
    'font-weight: 600',
    'color: #22d3ee',
    'text-decoration: none',
    'width: fit-content',
    'transition: background 0.2s'
  ].join(';');
  link.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;"></i> Abrir PDF';
  link.onmouseenter = () => link.style.background = 'rgba(6,182,212,0.28)';
  link.onmouseleave = () => link.style.background = 'rgba(6,182,212,0.15)';

  textBlock.appendChild(title);
  textBlock.appendChild(link);

  toast.appendChild(icon);
  toast.appendChild(textBlock);
  container.appendChild(toast);

  // Auto-remove after 7s (longer since it has an action link)
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 7000);
}

// -------------------------------------------------------------
// Navigation & Tab Switching
// -------------------------------------------------------------
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  const tabMeta = {
    dashboard: { title: 'Dashboard Geral', subtitle: 'Visão unificada das conexões de rede BGP dos clientes provedores.' },
    connections: { title: 'Conexões ASN', subtitle: 'Associação de contratos de trânsito IP, VLANs, roteadores e endereços de peer.' },
    prefixes: { title: 'Prefixos Permitidos', subtitle: 'Cadastro e regras de anúncio de prefixos IP (Prefix Limits) de cada ASN.' },
    routers: { title: 'Roteadores BGP', subtitle: 'Gerenciamento dos roteadores de borda conectados aos clientes.' },
    contracts: { title: 'Contratos', subtitle: 'Gestão de contratos e prazos de validade com os provedores.' },
    zabbix: { title: 'Integração Zabbix', subtitle: 'Configurações de sincronização da API JSON-RPC do Zabbix.' },
    settings: { title: 'Minhas Configurações', subtitle: 'Gerencie seus ASNs de trânsito próprios e os nomes de exibição nos memorandos.' }
  };

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      
      // Update sidebar styling
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Show appropriate pane
      tabPanes.forEach(pane => {
        if (pane.id === `tab-${tabId}`) {
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
      
      // Update Top Nav Titles
      if (tabMeta[tabId]) {
        pageTitle.innerText = tabMeta[tabId].title;
        pageSubtitle.innerText = tabMeta[tabId].subtitle;
      }

      // Reload data to reflect edits
      loadAll();
    });
  });
}

// -------------------------------------------------------------
// Data Fetching & Rendering
// -------------------------------------------------------------
async function loadAll() {
  await Promise.all([
    loadRouters(),
    loadContracts(),
    loadConnections(),
    loadPrefixes(),
    loadZabbixSettings(),
    loadOperatorAsns()
  ]);
  
  updateDashboardStats();
  populateDropdowns();
}

async function loadOperatorAsns() {
  try {
    const res = await fetch('/api/operator-asns');
    if (!res.ok) throw new Error();
    State.operatorAsns = await res.json();
    renderSettingsTable();
  } catch (err) {
    showToast('Falha ao carregar ASNs da operadora.', 'error');
  }
}

async function loadRouters() {
  try {
    const res = await fetch('/api/routers');
    if (!res.ok) throw new Error();
    State.routers = await res.json();
    renderRoutersTable();
  } catch (err) {
    showToast('Falha ao buscar roteadores do banco de dados.', 'error');
  }
}

async function loadContracts() {
  try {
    const res = await fetch('/api/contracts');
    if (!res.ok) throw new Error();
    State.contracts = await res.json();
    renderContractsTable();
  } catch (err) {
    showToast('Falha ao carregar contratos.', 'error');
  }
}

async function loadConnections() {
  try {
    const res = await fetch('/api/connections');
    if (!res.ok) throw new Error();
    State.connections = await res.json();
    renderConnectionsTable();
    renderDashboardConnectionsTable();
  } catch (err) {
    showToast('Falha ao carregar conexões ASN.', 'error');
  }
}

async function loadPrefixes() {
  try {
    const res = await fetch('/api/prefixes');
    if (!res.ok) throw new Error();
    State.prefixes = await res.json();
    renderPrefixesTable();
  } catch (err) {
    showToast('Falha ao carregar prefixos autorizados.', 'error');
  }
}

// Render Routers List
function renderRoutersTable() {
  const tbody = document.querySelector('#routers-table tbody');
  tbody.innerHTML = '';
  
  const searchInput = document.getElementById('routers-search');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = State.routers.filter(router => {
    if (!searchVal) return true;
    return (router.name && router.name.toLowerCase().includes(searchVal)) ||
           (router.ip_address && router.ip_address.toLowerCase().includes(searchVal)) ||
           (router.location && router.location.toLowerCase().includes(searchVal));
  });

  // Calculate pagination variables
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / State.routersLimit) || 1;
  
  // Guard page range
  if (State.routersPage > totalPages) {
    State.routersPage = totalPages;
  }
  if (State.routersPage < 1) {
    State.routersPage = 1;
  }

  // Update Indicator and buttons states in DOM
  const pageIndicator = document.getElementById('routers-page-indicator');
  const btnPrev = document.getElementById('btn-routers-prev');
  const btnNext = document.getElementById('btn-routers-next');

  if (pageIndicator) {
    pageIndicator.innerText = `Página ${State.routersPage} de ${totalPages}`;
  }
  if (btnPrev) {
    btnPrev.disabled = State.routersPage === 1;
  }
  if (btnNext) {
    btnNext.disabled = State.routersPage === totalPages;
  }

  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center">Nenhum roteador encontrado.</td></tr>';
    return;
  }

  // Slice list for current page
  const start = (State.routersPage - 1) * State.routersLimit;
  const end = start + State.routersLimit;
  const pageItems = filtered.slice(start, end);
  
  pageItems.forEach(router => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(router.name)}</strong></td>
      <td><code>${escapeHtml(router.ip_address)}</code></td>
      <td>${escapeHtml(router.location || '-')}</td>
      <td class="actions-cell">
        <button class="btn-action btn-action-edit" onclick="editRouter(${router.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-action btn-action-delete" onclick="deleteRouter(${router.id})"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Contracts List
function renderContractsTable() {
  const tbody = document.querySelector('#contracts-table tbody');
  tbody.innerHTML = '';

  const totalItems = State.contracts.length;
  const totalPages = Math.ceil(totalItems / State.contractsLimit) || 1;

  if (State.contractsPage > totalPages) {
    State.contractsPage = totalPages;
  }
  if (State.contractsPage < 1) {
    State.contractsPage = 1;
  }

  // Update DOM elements
  const pageIndicator = document.getElementById('contracts-page-indicator');
  const btnPrev = document.getElementById('btn-contracts-prev');
  const btnNext = document.getElementById('btn-contracts-next');

  if (pageIndicator) pageIndicator.innerText = `Página ${State.contractsPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = State.contractsPage === 1;
  if (btnNext) btnNext.disabled = State.contractsPage === totalPages;
  
  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">Nenhum contrato cadastrado.</td></tr>';
    return;
  }

  const start = (State.contractsPage - 1) * State.contractsLimit;
  const end = start + State.contractsLimit;
  const pageItems = State.contracts.slice(start, end);
  
  pageItems.forEach(contract => {
    const tr = document.createElement('tr');
    const badgeClass = contract.status === 'active' ? 'badge-active' : contract.status === 'suspended' ? 'badge-suspended' : 'badge-inactive';
    const statusText = contract.status === 'active' ? 'Ativo' : contract.status === 'suspended' ? 'Suspenso' : 'Cancelado';
    
    tr.innerHTML = `
      <td><strong>${escapeHtml(contract.contract_number)}</strong></td>
      <td>${escapeHtml(contract.client_name)}</td>
      <td><span class="badge ${badgeClass}">${statusText}</span></td>
      <td>${formatDate(contract.start_date)}</td>
      <td>${contract.end_date ? formatDate(contract.end_date) : '<span class="text-muted">Sem término</span>'}</td>
      <td class="actions-cell">
        <button class="btn-action btn-action-edit" onclick="editContract(${contract.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-action btn-action-delete" onclick="deleteContract(${contract.id})"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Connections List
function renderConnectionsTable() {
  const tbody = document.querySelector('#connections-table tbody');
  tbody.innerHTML = '';
  
  const searchInput = document.getElementById('connections-search');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = State.connections.filter(conn => {
    if (!searchVal) return true;
    const asnStr = conn.asn ? `as${conn.asn}`.toLowerCase() : '';
    const asnValStr = conn.asn ? conn.asn.toString() : '';
    return asnValStr.includes(searchVal) ||
           asnStr.includes(searchVal) ||
           (conn.client_name && conn.client_name.toLowerCase().includes(searchVal)) ||
           (conn.contract_number && conn.contract_number.toLowerCase().includes(searchVal)) ||
           conn.vlan.toString().includes(searchVal) ||
           (conn.ipv4_router && conn.ipv4_router.toLowerCase().includes(searchVal)) ||
           (conn.ipv4_client && conn.ipv4_client.toLowerCase().includes(searchVal)) ||
           (conn.ipv6_router && conn.ipv6_router.toLowerCase().includes(searchVal)) ||
           (conn.ipv6_client && conn.ipv6_client.toLowerCase().includes(searchVal)) ||
           (conn.switch_a && conn.switch_a.toLowerCase().includes(searchVal)) ||
           (conn.port_a && conn.port_a.toLowerCase().includes(searchVal)) ||
           (conn.switch_z && conn.switch_z.toLowerCase().includes(searchVal)) ||
           (conn.port_z && conn.port_z.toLowerCase().includes(searchVal)) ||
           (conn.vpn_type && conn.vpn_type.toLowerCase().includes(searchVal));
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / State.connectionsLimit) || 1;

  if (State.connectionsPage > totalPages) {
    State.connectionsPage = totalPages;
  }
  if (State.connectionsPage < 1) {
    State.connectionsPage = 1;
  }

  // Update DOM elements
  const pageIndicator = document.getElementById('connections-page-indicator');
  const btnPrev = document.getElementById('btn-connections-prev');
  const btnNext = document.getElementById('btn-connections-next');

  if (pageIndicator) pageIndicator.innerText = `Página ${State.connectionsPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = State.connectionsPage === 1;
  if (btnNext) btnNext.disabled = State.connectionsPage === totalPages;

  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-muted text-center">Nenhuma conexão ASN encontrada.</td></tr>';
    return;
  }

  const start = (State.connectionsPage - 1) * State.connectionsLimit;
  const end = start + State.connectionsLimit;
  const pageItems = filtered.slice(start, end);
  
  pageItems.forEach(conn => {
    const tr = document.createElement('tr');
    const badgeClass = conn.status === 'active' ? 'badge-active' : 'badge-inactive';
    const statusText = conn.status === 'active' ? 'Ativo' : 'Inativo';
    
    if (conn.service_type === 'l2l') {
      tr.innerHTML = `
        <td><strong>${conn.asn ? 'AS' + conn.asn : '<span class="text-muted">Sem ASN</span>'}</strong></td>
        <td>
          <strong>${escapeHtml(conn.client_name)}</strong>
          <span class="text-sub">Contrato: ${escapeHtml(conn.contract_number)}</span>
        </td>
        <td><span class="card-badge" style="background: rgba(6, 182, 212, 0.15); color: #22d3ee; border-color: rgba(6, 182, 212, 0.3); font-weight:600;">L2L ${conn.vpn_type}</span></td>
        <td><code>${conn.vlan}</code></td>
        <td>
          <span class="text-sm">Lado A: <code>${escapeHtml(conn.switch_a)}</code></span>
          <span class="text-sub">Porta: <code>${escapeHtml(conn.port_a)}</code></span>
        </td>
        <td>
          <span class="text-sm">Lado Z: <code>${escapeHtml(conn.switch_z)}</code></span>
          <span class="text-sub">Porta: <code>${escapeHtml(conn.port_z)}</code></span>
        </td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td class="actions-cell">
          <button class="btn-action btn-action-edit" onclick="editConnection(${conn.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action btn-action-delete" onclick="deleteConnection(${conn.id})"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td><strong>${conn.asn ? 'AS' + conn.asn : '<span class="text-muted">Sem ASN</span>'}</strong></td>
        <td>
          <strong>${escapeHtml(conn.client_name)}</strong>
          <span class="text-sub">Contrato: ${escapeHtml(conn.contract_number)}</span>
          ${conn.loa_files && conn.loa_files.length > 0 ? `
            <div class="loa-badges-container" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
              ${conn.loa_files.map(file => `
                <a href="/${file.path}" target="_blank" class="card-badge" style="display:inline-flex; align-items:center; gap:4px; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size:10px; padding: 2px 6px; text-decoration:none;" title="Baixar LOA: ${escapeHtml(file.name)}">
                  <i class="fa-solid fa-file-pdf"></i> LOA
                </a>
              `).join('')}
            </div>
          ` : ''}
        </td>
        <td>${escapeHtml(conn.router_name)}</td>
        <td><code>${conn.vlan}</code></td>
        <td>
          ${conn.ipv4_router ? `
            <span class="text-sm">Roteador: <code>${escapeHtml(conn.ipv4_router)}</code></span>
            <span class="text-sub">Cliente: <code>${escapeHtml(conn.ipv4_client)}</code></span>
          ` : '<span class="text-muted text-xs">Sem IPv4</span>'}
        </td>
        <td>
          ${conn.ipv6_router ? `
            <span class="text-sm">Roteador: <code>${escapeHtml(conn.ipv6_router)}</code></span>
            <span class="text-sub">Cliente: <code>${escapeHtml(conn.ipv6_client)}</code></span>
          ` : '<span class="text-muted text-xs">Sem IPv6</span>'}
        </td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td class="actions-cell">
          <button class="btn-action btn-action-edit" onclick="editConnection(${conn.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action btn-action-delete" onclick="deleteConnection(${conn.id})"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
    }
    tbody.appendChild(tr);
  });
}

// Render Dashboard Overview Table
function renderDashboardConnectionsTable() {
  const tbody = document.querySelector('#dashboard-connections-table tbody');
  tbody.innerHTML = '';
  
  const searchInput = document.getElementById('dashboard-search');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = State.connections.filter(conn => {
    if (!searchVal) return true;
    const asnStr = conn.asn ? `as${conn.asn}`.toLowerCase() : '';
    const asnValStr = conn.asn ? conn.asn.toString() : '';
    return asnValStr.includes(searchVal) ||
           asnStr.includes(searchVal) ||
           (conn.client_name && conn.client_name.toLowerCase().includes(searchVal)) ||
           (conn.contract_number && conn.contract_number.toLowerCase().includes(searchVal)) ||
           conn.vlan.toString().includes(searchVal) ||
           (conn.ipv4_router && conn.ipv4_router.toLowerCase().includes(searchVal)) ||
           (conn.ipv4_client && conn.ipv4_client.toLowerCase().includes(searchVal)) ||
           (conn.ipv6_router && conn.ipv6_router.toLowerCase().includes(searchVal)) ||
           (conn.ipv6_client && conn.ipv6_client.toLowerCase().includes(searchVal)) ||
           (conn.switch_a && conn.switch_a.toLowerCase().includes(searchVal)) ||
           (conn.port_a && conn.port_a.toLowerCase().includes(searchVal)) ||
           (conn.switch_z && conn.switch_z.toLowerCase().includes(searchVal)) ||
           (conn.port_z && conn.port_z.toLowerCase().includes(searchVal)) ||
           (conn.vpn_type && conn.vpn_type.toLowerCase().includes(searchVal));
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / State.dashboardLimit) || 1;

  if (State.dashboardPage > totalPages) {
    State.dashboardPage = totalPages;
  }
  if (State.dashboardPage < 1) {
    State.dashboardPage = 1;
  }

  // Update DOM elements
  const pageIndicator = document.getElementById('dashboard-page-indicator');
  const btnPrev = document.getElementById('btn-dashboard-prev');
  const btnNext = document.getElementById('btn-dashboard-next');

  if (pageIndicator) pageIndicator.innerText = `Página ${State.dashboardPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = State.dashboardPage === 1;
  if (btnNext) btnNext.disabled = State.dashboardPage === totalPages;

  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-muted text-center">Nenhuma conexão ASN encontrada.</td></tr>';
    return;
  }

  const start = (State.dashboardPage - 1) * State.dashboardLimit;
  const end = start + State.dashboardLimit;
  const pageItems = filtered.slice(start, end);
  
  pageItems.forEach(conn => {
    const tr = document.createElement('tr');
    const badgeClass = conn.status === 'active' ? 'badge-active' : 'badge-inactive';
    const statusText = conn.status === 'active' ? 'Ativo' : 'Inativo';
    
    let colRouter = escapeHtml(conn.router_name);
    let colPeers = `
      ${conn.ipv4_client ? `<div style="font-size: 12px;"><code>${escapeHtml(conn.ipv4_client)}</code></div>` : ''}
      ${conn.ipv6_client ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;"><code>${escapeHtml(conn.ipv6_client)}</code></div>` : ''}
      ${!conn.ipv4_client && !conn.ipv6_client ? '<span class="text-muted text-xs">Sem IPs</span>' : ''}
    `;
    let colPrefixes = `<span class="card-badge">${conn.prefix_count} prefixos</span>`;
    
    if (conn.service_type === 'l2l') {
      colRouter = `<span class="card-badge" style="background: rgba(6, 182, 212, 0.15); color: #22d3ee; border-color: rgba(6, 182, 212, 0.3); font-weight:600;">L2L ${conn.vpn_type}</span>`;
      colPeers = `
        <div style="font-size: 12px;" title="Switch A / Porta">Lado A: <code>${escapeHtml(conn.switch_a)} (${escapeHtml(conn.port_a)})</code></div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;" title="Switch Z / Porta">Lado Z: <code>${escapeHtml(conn.switch_z)} (${escapeHtml(conn.port_z)})</code></div>
      `;
      colPrefixes = `<span class="text-muted">N/A (L2L)</span>`;
    }
    
    tr.innerHTML = `
      <td><strong>${conn.asn ? 'AS' + conn.asn : '<span class="text-muted">Sem ASN</span>'}</strong></td>
      <td>
        <strong>${escapeHtml(conn.client_name)}</strong>
        ${conn.loa_files && conn.loa_files.length > 0 ? `
          <div style="display:flex; gap:4px; margin-top:4px;">
            ${conn.loa_files.map(file => `
              <a href="/${file.path}" target="_blank" class="card-badge" style="display:inline-flex; align-items:center; gap:4px; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size:9px; padding: 1px 4px; text-decoration:none;" title="Baixar LOA: ${escapeHtml(file.name)}">
                <i class="fa-solid fa-file-pdf"></i> LOA
              </a>
            `).join('')}
          </div>
        ` : ''}
      </td>
      <td>${colRouter}</td>
      <td><span class="badge badge-active">${conn.vlan}</span></td>
      <td style="line-height: 1.4;">
        ${colPeers}
      </td>
      <td>${colPrefixes}</td>
      <td><span class="badge ${badgeClass}">${statusText}</span></td>
      <td style="white-space: nowrap;">
        <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 12px; margin-right: 4px;" onclick="openTopologyModal(${conn.id})">
          <i class="fa-solid fa-diagram-project"></i> Mapa
        </button>
        <button class="btn btn-secondary btn-glow" style="padding: 6px 10px; font-size: 12px;" onclick="exportConnectionPDF(${conn.id})">
          <i class="fa-solid fa-file-pdf" style="color: #f87171;"></i> PDF
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Allowed Prefixes
function renderPrefixesTable() {
  const tbody = document.querySelector('#prefixes-table tbody');
  tbody.innerHTML = '';
  
  const searchInput = document.getElementById('prefixes-search');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = State.prefixes.filter(prefix => {
    if (!searchVal) return true;
    return (
      (prefix.asn && prefix.asn.toString().includes(searchVal)) ||
      (prefix.client_name && prefix.client_name.toLowerCase().includes(searchVal)) ||
      (prefix.prefix && prefix.prefix.toLowerCase().includes(searchVal)) ||
      (prefix.description && prefix.description.toLowerCase().includes(searchVal))
    );
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / State.prefixesLimit) || 1;

  if (State.prefixesPage > totalPages) {
    State.prefixesPage = totalPages;
  }
  if (State.prefixesPage < 1) {
    State.prefixesPage = 1;
  }

  // Update DOM elements
  const pageIndicator = document.getElementById('prefixes-page-indicator');
  const btnPrev = document.getElementById('btn-prefixes-prev');
  const btnNext = document.getElementById('btn-prefixes-next');

  if (pageIndicator) pageIndicator.innerText = `Página ${State.prefixesPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = State.prefixesPage === 1;
  if (btnNext) btnNext.disabled = State.prefixesPage === totalPages;

  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">Nenhum prefixo cadastrado.</td></tr>';
    return;
  }

  const start = (State.prefixesPage - 1) * State.prefixesLimit;
  const end = start + State.prefixesLimit;
  const pageItems = filtered.slice(start, end);
  
  pageItems.forEach(prefix => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>AS${prefix.asn}</strong></td>
      <td>${escapeHtml(prefix.client_name)}</td>
      <td><code>${escapeHtml(prefix.prefix)}</code></td>
      <td><code>/${prefix.max_length}</code></td>
      <td>${escapeHtml(prefix.description || '-')}</td>
      <td class="actions-cell">
        <button class="btn-action btn-action-edit" onclick="editPrefix(${prefix.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-action btn-action-delete" onclick="deletePrefix(${prefix.id})"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Update Dashboard Counter Cards
function updateDashboardStats() {
  document.getElementById('stat-connections-count').innerText = State.connections.length;
  document.getElementById('stat-routers-count').innerText = State.routers.length;
  document.getElementById('stat-contracts-count').innerText = State.contracts.length;
  document.getElementById('stat-prefixes-count').innerText = State.prefixes.length;
}

// Populate dropdown lists in forms
function populateDropdowns() {
  const prefixConnSelect = document.getElementById('prefix-asn-conn-id');
  const selectedPrefixConn = prefixConnSelect.value;
  
  prefixConnSelect.innerHTML = '<option value="">Selecione a conexão ASN...</option>';
  State.connections.forEach(conn => {
    prefixConnSelect.innerHTML += `<option value="${conn.id}">AS${conn.asn} - ${escapeHtml(conn.client_name)}</option>`;
  });
  
  prefixConnSelect.value = selectedPrefixConn;

  // Populando o select de ASN da Operadora (Lado A) no modal de conexão
  const opAsnSelect = document.getElementById('conn-operator-asn');
  if (opAsnSelect) {
    const selectedOpAsn = opAsnSelect.value;
    opAsnSelect.innerHTML = '';
    
    if (State.operatorAsns.length === 0) {
      opAsnSelect.innerHTML = '<option value="264426">AS264426 - Operadora Principal (Padrão)</option>';
    } else {
      State.operatorAsns.forEach(op => {
        opAsnSelect.innerHTML += `<option value="${op.asn}">AS${op.asn} - ${escapeHtml(op.name)}</option>`;
      });
    }
    
    // Restaurar seleção
    if (selectedOpAsn) {
      opAsnSelect.value = selectedOpAsn;
    } else if (State.operatorAsns.length > 0) {
      opAsnSelect.value = State.operatorAsns[0].asn;
    }
  }
}

// -------------------------------------------------------------
// Form Submissions Actions (POST / PUT)
// -------------------------------------------------------------
function initFormSubmissions() {
  
  // Router Form Submit
  const routerForm = document.getElementById('router-form');
  routerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('router-id').value;
    const body = {
      name: document.getElementById('router-name').value,
      ip_address: document.getElementById('router-ip').value,
      location: document.getElementById('router-location').value
    };
    
    const url = id ? `/api/routers/${id}` : '/api/routers';
    const method = id ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (!res.ok) {
        showToast(data.error || 'Erro ao salvar roteador.', 'error');
        return;
      }
      
      showToast(id ? 'Roteador atualizado com sucesso!' : 'Roteador criado com sucesso!');
      routerForm.reset();
      cancelRouterEdit();
      loadAll();
    } catch (err) {
      showToast('Falha na conexão com o servidor.', 'error');
    }
  });

  // Contract Form Submit
  const contractForm = document.getElementById('contract-form');
  contractForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('contract-id').value;
    const body = {
      contract_number: document.getElementById('contract-number').value,
      client_name: document.getElementById('contract-client-name').value,
      status: document.getElementById('contract-status').value,
      start_date: document.getElementById('contract-start-date').value,
      end_date: document.getElementById('contract-end-date').value || null
    };
    
    const url = id ? `/api/contracts/${id}` : '/api/contracts';
    const method = id ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (!res.ok) {
        showToast(data.error || 'Erro ao salvar contrato.', 'error');
        return;
      }
      
      showToast(id ? 'Contrato atualizado com sucesso!' : 'Contrato criado com sucesso!');
      contractForm.reset();
      cancelContractEdit();
      loadAll();
    } catch (err) {
      showToast('Falha na comunicação com a API.', 'error');
    }
  });

  // Connection Form Submit
  const connectionForm = document.getElementById('connection-form');
  connectionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('connection-id').value;
    const serviceType = document.getElementById('conn-service-type').value;
    
    const asnVal = document.getElementById('conn-asn').value.trim();
    const body = {
      asn: serviceType === 'l2l' ? null : (asnVal ? parseInt(asnVal) : null),
      contract_id: document.getElementById('conn-contract-id').value,
      vlan: document.getElementById('conn-vlan').value,
      status: document.getElementById('conn-status').value,
      service_type: serviceType,
      switch_a: document.getElementById('conn-switch-a').value,
      port_a: document.getElementById('conn-port-a').value,
      switch_z: document.getElementById('conn-switch-z').value,
      port_z: document.getElementById('conn-port-z').value
    };

    if (serviceType === 'bgp') {
      body.operator_asn = document.getElementById('conn-operator-asn').value;
      body.router_id = document.getElementById('conn-router-id').value;
      body.ipv4_router = document.getElementById('conn-ipv4-router').value;
      body.ipv4_client = document.getElementById('conn-ipv4-client').value;
      body.ipv6_router = document.getElementById('conn-ipv6-router').value;
      body.ipv6_client = document.getElementById('conn-ipv6-client').value;
      body.prefixes = !id ? State.tempPrefixes : [];
      body.loa_files = State.tempLoaFiles;
      body.vpn_type = null;
    } else {
      body.vpn_type = document.getElementById('conn-vpn-type').value;
      body.prefixes = [];
    }
    
    const url = id ? `/api/connections/${id}` : '/api/connections';
    const method = id ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (!res.ok) {
        showToast(data.error || 'Erro ao salvar conexão ASN.', 'error');
        return;
      }
      
      showToast(id ? 'Conexão ASN atualizada!' : 'Conexão ASN cadastrada com sucesso!');
      closeConnectionModal();
      loadAll();
    } catch (err) {
      showToast('Falha ao processar requisição.', 'error');
    }
  });

  // Prefix Form Submit
  const prefixForm = document.getElementById('prefix-form');
  prefixForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prefix-id').value;
    const body = {
      asn_connection_id: document.getElementById('prefix-asn-conn-id').value,
      prefix: document.getElementById('prefix-cidr').value,
      max_length: document.getElementById('prefix-max-length').value,
      description: document.getElementById('prefix-description').value
    };
    
    const url = id ? `/api/prefixes/${id}` : '/api/prefixes';
    const method = id ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (!res.ok) {
        showToast(data.error || 'Erro ao salvar prefixo.', 'error');
        return;
      }
      
      showToast(id ? 'Prefixo atualizado com sucesso!' : 'Prefixo cadastrado com sucesso!');
      closePrefixModal();
      loadAll();
    } catch (err) {
      showToast('Erro ao enviar dados do prefixo.', 'error');
    }
  });
}

// -------------------------------------------------------------
// Edit / Cancel Actions
// -------------------------------------------------------------

// Router Edit
function editRouter(id) {
  const router = State.routers.find(r => r.id === id);
  if (!router) return;
  
  document.getElementById('router-id').value = router.id;
  document.getElementById('router-name').value = router.name;
  document.getElementById('router-ip').value = router.ip_address;
  document.getElementById('router-location').value = router.location || '';
  
  document.getElementById('router-form-title').innerText = 'Editar Roteador';
  document.getElementById('btn-cancel-router-edit').style.display = 'inline-block';
}

function cancelRouterEdit() {
  document.getElementById('router-id').value = '';
  document.getElementById('router-form').reset();
  document.getElementById('router-form-title').innerText = 'Cadastrar Roteador BGP';
  document.getElementById('btn-cancel-router-edit').style.display = 'none';
}

// Contract Edit
function editContract(id) {
  const contract = State.contracts.find(c => c.id === id);
  if (!contract) return;
  
  document.getElementById('contract-id').value = contract.id;
  document.getElementById('contract-number').value = contract.contract_number;
  document.getElementById('contract-client-name').value = contract.client_name;
  document.getElementById('contract-status').value = contract.status;
  document.getElementById('contract-start-date').value = contract.start_date.substring(0, 10);
  document.getElementById('contract-end-date').value = contract.end_date ? contract.end_date.substring(0, 10) : '';
  
  document.getElementById('contract-form-title').innerText = 'Editar Contrato';
  document.getElementById('btn-cancel-contract-edit').style.display = 'inline-block';
}

function cancelContractEdit() {
  document.getElementById('contract-id').value = '';
  document.getElementById('contract-form').reset();
  document.getElementById('contract-form-title').innerText = 'Cadastrar Contrato';
  document.getElementById('btn-cancel-contract-edit').style.display = 'none';
}

// Connection Edit
function editConnection(id) {
  const conn = State.connections.find(c => c.id === id);
  if (!conn) return;
  
  document.getElementById('connection-id').value = conn.id;
  document.getElementById('conn-asn').value = conn.asn;
  document.getElementById('conn-operator-asn').value = conn.operator_asn || 264426;
  
  // Set autocompletes text values and hidden IDs
  document.getElementById('conn-contract-id').value = conn.contract_id;
  document.getElementById('conn-contract-search').value = `${conn.contract_number} - ${conn.client_name}`;
  
  document.getElementById('conn-vlan').value = conn.vlan;
  document.getElementById('conn-status').value = conn.status;

  const serviceType = conn.service_type || 'bgp';
  toggleServiceTypeFields(serviceType);

  if (serviceType === 'bgp') {
    document.getElementById('conn-router-id').value = conn.router_id || '';
    document.getElementById('conn-router-search').value = conn.router_name || '';
    document.getElementById('conn-ipv4-router').value = conn.ipv4_router || '';
    document.getElementById('conn-ipv4-client').value = conn.ipv4_client || '';
    document.getElementById('conn-ipv6-router').value = conn.ipv6_router || '';
    document.getElementById('conn-ipv6-client').value = conn.ipv6_client || '';
    
    State.tempLoaFiles = conn.loa_files || [];
    
    // Populate L2L fields for BGP if set
    document.getElementById('conn-switch-a').value = conn.switch_a || '';
    document.getElementById('conn-port-a').value = conn.port_a || '';
    document.getElementById('conn-switch-z').value = conn.switch_z || '';
    document.getElementById('conn-port-z').value = conn.port_z || '';
    document.getElementById('conn-vpn-type').value = 'VPWS';
  } else {
    State.tempLoaFiles = [];
    document.getElementById('conn-switch-a').value = conn.switch_a || '';
    document.getElementById('conn-port-a').value = conn.port_a || '';
    document.getElementById('conn-switch-z').value = conn.switch_z || '';
    document.getElementById('conn-port-z').value = conn.port_z || '';
    document.getElementById('conn-vpn-type').value = conn.vpn_type || 'VPWS';

    // Clear BGP fields
    document.getElementById('conn-router-id').value = '';
    document.getElementById('conn-router-search').value = '';
    document.getElementById('conn-ipv4-router').value = '';
    document.getElementById('conn-ipv4-client').value = '';
    document.getElementById('conn-ipv6-router').value = '';
    document.getElementById('conn-ipv6-client').value = '';
  }
  
  document.getElementById('connection-modal-title').innerText = 'Editar Conexão ASN';
  openConnectionModal();
}

// Prefix Edit
function editPrefix(id) {
  const prefix = State.prefixes.find(p => p.id === id);
  if (!prefix) return;
  
  document.getElementById('prefix-id').value = prefix.id;
  document.getElementById('prefix-asn-conn-id').value = prefix.asn_connection_id;
  document.getElementById('prefix-conn-search').value = prefix.asn ? `AS${prefix.asn} - ${prefix.client_name}` : prefix.client_name;
  document.getElementById('prefix-cidr').value = prefix.prefix;
  document.getElementById('prefix-max-length').value = prefix.max_length;
  document.getElementById('prefix-description').value = prefix.description || '';
  
  document.getElementById('prefix-form-title').innerText = 'Editar Prefixo';
  openPrefixModal();
}

function cancelPrefixEdit() {
  document.getElementById('prefix-id').value = '';
  document.getElementById('prefix-asn-conn-id').value = '';
  document.getElementById('prefix-conn-search').value = '';
  document.getElementById('prefix-form').reset();
  document.getElementById('prefix-form-title').innerText = 'Registrar Novo Prefixo';
}

// -------------------------------------------------------------
// Delete Actions (DELETE)
// -------------------------------------------------------------
async function deleteRouter(id) {
  if (!confirm('Deseja realmente excluir este roteador?')) return;
  try {
    const res = await fetch(`/api/routers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao excluir roteador.', 'error');
      return;
    }
    showToast('Roteador excluído!');
    loadAll();
  } catch (err) {
    showToast('Erro de rede ao excluir roteador.', 'error');
  }
}

async function deleteContract(id) {
  if (!confirm('Deseja realmente excluir este contrato? Todas as conexões vinculadas serão removidas.')) return;
  try {
    const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao excluir contrato.', 'error');
      return;
    }
    showToast('Contrato excluído!');
    loadAll();
  } catch (err) {
    showToast('Erro de rede ao excluir contrato.', 'error');
  }
}

// ─── Custom Confirm Modal ─────────────────────────────────────
// Replaces native confirm() to work even in sandboxed environments.
// Usage: const ok = await showConfirm({ title, message, warning, btnLabel })
function showConfirm({ title = 'Confirmar exclusão', message = '', warning = '', btnLabel = 'Excluir' } = {}) {
  return new Promise(resolve => {
    const modal     = document.getElementById('confirm-modal');
    const titleEl   = document.getElementById('confirm-modal-title');
    const msgEl     = document.getElementById('confirm-modal-message');
    const warnEl    = document.getElementById('confirm-modal-warning');
    const btnOk     = document.getElementById('confirm-modal-ok');
    const btnCancel = document.getElementById('confirm-modal-cancel');
    const btnLabel_ = document.getElementById('confirm-modal-btn-label');

    titleEl.innerText   = title;
    msgEl.innerText     = message;
    btnLabel_.innerText = btnLabel;

    if (warning) {
      warnEl.innerText   = warning;
      warnEl.style.display = 'block';
    } else {
      warnEl.style.display = 'none';
    }

    modal.classList.add('show');

    function cleanup(result) {
      modal.classList.remove('show');
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      resolve(result);
    }
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
  });
}

async function deleteConnection(id) {
  const conn = State.connections.find(c => c.id === id);
  if (!conn) return;

  // Check if connection has associated prefixes
  const prefixCount = State.prefixes.filter(p => p.asn_connection_id === id).length;

  if (prefixCount > 0) {
    await showConfirm({
      title: 'Exclusão Bloqueada',
      message: `A conexão AS${conn.asn} — ${conn.client_name} possui ${prefixCount} prefixo(s) autorizado(s) associado(s).`,
      warning: `⚠ Remova todos os prefixos desta conexão antes de excluí-la.\n\nAcesse a aba "Prefixos Permitidos" e filtre pela conexão AS${conn.asn}.`,
      btnLabel: 'Entendido'
    });
    // Override the ok button to just close (no delete)
    // showConfirm always resolves — just return without deleting
    return;
  }

  const confirmed = await showConfirm({
    title: 'Excluir Conexão ASN',
    message: `Deseja realmente remover a conexão AS${conn.asn} — ${conn.client_name}? Esta ação não pode ser desfeita.`,
    btnLabel: 'Excluir Conexão'
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/connections/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao remover conexão.', 'error');
      return;
    }
    showToast('Conexão ASN removida com sucesso!');
    loadAll();
  } catch (err) {
    showToast('Erro de rede ao remover conexão.', 'error');
  }
}

async function deletePrefix(id) {
  const prefix = State.prefixes.find(p => p.id === id);
  const label = prefix ? `${prefix.prefix} (AS${prefix.asn})` : `#${id}`;

  const confirmed = await showConfirm({
    title: 'Excluir Prefixo Autorizado',
    message: `Deseja remover o prefixo ${label}? Esta ação não pode ser desfeita.`,
    btnLabel: 'Excluir Prefixo'
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/prefixes/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao remover prefixo.', 'error');
      return;
    }
    showToast('Prefixo autorizado removido!');
    loadAll();
  } catch (err) {
    showToast('Erro de rede ao remover prefixo.', 'error');
  }
}

// -------------------------------------------------------------
// Modal Management Helpers
// -------------------------------------------------------------
function openConnectionModal() {
  const isEditing = document.getElementById('connection-id').value !== '';
  State.tempPrefixes = [];
  renderWizardPrefixes();
  renderConnectionLoaFiles();
  
  // Reset Wizard step state
  showWizardStep(1);

  if (isEditing) {
    // Hide wizard indicators and buttons, show submit directly
    document.querySelector('.wizard-progress').style.display = 'none';
    document.getElementById('btn-wizard-next').style.display = 'none';
    document.getElementById('btn-wizard-submit').style.display = 'inline-block';
  } else {
    // Show wizard indicators, Next button, hide submit
    document.getElementById('connection-id').value = '';
    document.getElementById('connection-form').reset();
    State.tempLoaFiles = [];
    renderConnectionLoaFiles();
    
    // Default to BGP service type
    toggleServiceTypeFields('bgp');

    // Set first operator ASN from state if loaded, else fallback
    if (State.operatorAsns.length > 0) {
      document.getElementById('conn-operator-asn').value = State.operatorAsns[0].asn;
    } else {
      document.getElementById('conn-operator-asn').value = '264426';
    }

    document.getElementById('conn-contract-id').value = '';
    document.getElementById('conn-router-id').value = '';
    document.getElementById('conn-contract-search').value = '';
    document.getElementById('conn-router-search').value = '';
    
    document.querySelector('.wizard-progress').style.display = 'flex';
    document.getElementById('btn-wizard-next').style.display = 'inline-block';
    document.getElementById('btn-wizard-submit').style.display = 'none';
    document.getElementById('connection-modal-title').innerText = 'Nova Conexão ASN';
  }
  document.getElementById('connection-modal').classList.add('show');
}

function closeConnectionModal() {
  document.getElementById('connection-modal').classList.remove('show');
  document.getElementById('connection-id').value = '';
  document.getElementById('connection-modal-title').innerText = 'Nova Conexão ASN';
  // Hide suggestions if open
  document.getElementById('conn-contract-suggestions').classList.remove('show');
  document.getElementById('conn-router-suggestions').classList.remove('show');
  document.getElementById('conn-switch-a-suggestions').classList.remove('show');
  document.getElementById('conn-switch-z-suggestions').classList.remove('show');
  document.getElementById('conn-port-a-suggestions').classList.remove('show');
  document.getElementById('conn-port-z-suggestions').classList.remove('show');
}

function openPrefixModal() {
  document.getElementById('prefix-modal').classList.add('show');
}

function closePrefixModal() {
  document.getElementById('prefix-modal').classList.remove('show');
  document.getElementById('prefix-conn-suggestions').classList.remove('show');
  cancelPrefixEdit();
}

function renderConnectionLoaFiles() {
  const container = document.getElementById('conn-loa-files-list');
  if (!container) return;
  container.innerHTML = '';

  State.tempLoaFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'loa-file-item';
    item.style = 'display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-glass);';
    
    // File label
    const info = document.createElement('div');
    info.style = 'display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-main);';
    info.innerHTML = `<i class="fa-regular fa-file-pdf" style="color: #ef4444; font-size: 16px;"></i> <span>${escapeHtml(file.name)}</span> <span style="font-size: 11px; color: var(--text-muted);">(${formatBytes(file.size)})</span>`;

    // Action button (remove)
    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn-action';
    btnRemove.style = 'background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;';
    btnRemove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    btnRemove.addEventListener('click', () => {
      State.tempLoaFiles.splice(index, 1);
      renderConnectionLoaFiles();
    });

    item.appendChild(info);
    item.appendChild(btnRemove);
    container.appendChild(item);
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// -------------------------------------------------------------
// Formatting & Utilities
// -------------------------------------------------------------
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// ZABBIX INTEGRATION HELPERS
// ==========================================

async function loadZabbixSettings() {
  try {
    const res = await fetch('/api/zabbix/settings');
    if (!res.ok) throw new Error();
    const settings = await res.json();
    
    const urlEl = document.getElementById('zabbix-status-url');
    const authEl = document.getElementById('zabbix-status-auth');
    const syncEl = document.getElementById('zabbix-status-sync');
    
    if (!settings) {
      urlEl.innerText = 'Não configurado';
      authEl.innerText = 'Nenhuma';
      syncEl.innerText = 'Nunca';
      return;
    }

    // Populate form values
    document.getElementById('zabbix-url').value = settings.url;
    if (settings.hasToken) {
      document.getElementById('zabbix-token').value = '********';
    } else {
      document.getElementById('zabbix-token').value = '';
    }
    document.getElementById('zabbix-username').value = settings.username || '';
    if (settings.hasPassword) {
      document.getElementById('zabbix-password').value = '********';
    } else {
      document.getElementById('zabbix-password').value = '';
    }

    // Update Status Panel
    urlEl.innerText = settings.url;
    
    if (settings.url.toLowerCase() === 'mock') {
      authEl.innerText = 'Simulação (Sem Autenticação)';
    } else if (settings.hasToken) {
      authEl.innerText = 'Token de API (Recomendado)';
    } else if (settings.username) {
      authEl.innerText = `Usuário/Senha (Legado - ${settings.username})`;
    } else {
      authEl.innerText = 'Nenhuma';
    }
    
    syncEl.innerText = settings.last_sync ? new Date(settings.last_sync).toLocaleString('pt-BR') : 'Nunca';
    
  } catch (err) {
    console.error('Erro ao carregar configurações do Zabbix:', err);
  }
}

async function saveZabbixSettings(e) {
  e.preventDefault();
  
  const urlVal = document.getElementById('zabbix-url').value;
  let tokenVal = document.getElementById('zabbix-token').value;
  const usernameVal = document.getElementById('zabbix-username').value;
  let passwordVal = document.getElementById('zabbix-password').value;

  // Prevent saving placeholders
  if (tokenVal === '********') tokenVal = undefined;
  if (passwordVal === '********') passwordVal = undefined;

  const body = {
    url: urlVal,
    token: tokenVal || null,
    username: usernameVal || null,
    password: passwordVal || null
  };

  try {
    const res = await fetch('/api/zabbix/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    
    if (!res.ok) {
      showToast(data.error || 'Erro ao salvar configurações do Zabbix.', 'error');
      return;
    }

    showToast('Configurações do Zabbix salvas com sucesso!');
    await loadZabbixSettings();
  } catch (err) {
    showToast('Falha na comunicação com o servidor.', 'error');
  }
}

async function triggerZabbixSync() {
  const btnSync = document.getElementById('btn-zabbix-sync');
  const btnTest = document.getElementById('btn-zabbix-test-sync');
  
  const originalBtnSyncHtml = btnSync.innerHTML;
  const originalBtnTestHtml = btnTest.innerHTML;

  // Show loading state
  btnSync.disabled = true;
  btnTest.disabled = true;
  btnSync.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
  btnTest.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';

  showToast('Iniciando sincronização com Zabbix. Aguarde...', 'info');

  try {
    const res = await fetch('/api/zabbix/sync', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Falha na sincronização do Zabbix.', 'error');
      return;
    }

    const msg = `${data.message} (${data.inserted} novos, ${data.updated} atualizados, ${data.total} no total)`;
    showToast(msg, 'success');
    
    await loadAll();
  } catch (err) {
    showToast('Erro ao sincronizar dados com Zabbix.', 'error');
  } finally {
    btnSync.disabled = false;
    btnTest.disabled = false;
    btnSync.innerHTML = originalBtnSyncHtml;
    btnTest.innerHTML = originalBtnTestHtml;
  }
}

// ==========================================
// TOPOLOGY DIAGRAM HANDLERS
// ==========================================

function openTopologyModal(connId) {
  const conn = State.connections.find(c => c.id === connId);
  if (!conn) return;

  const container = document.getElementById('topology-diagram-container');
  if (!container) return;

  if (conn.service_type === 'l2l') {
    container.innerHTML = `
      <div class="topology-container">
        <!-- Left Node: Switch Lado A -->
        <div class="topology-node">
          <div class="node-icon-wrapper node-edge" style="background: linear-gradient(135deg, var(--color-secondary), #0891b2); box-shadow: 0 0 15px var(--color-secondary-glow);">
            <i class="fa-solid fa-network-wired"></i>
          </div>
          <span class="node-name">${escapeHtml(conn.switch_a)}</span>
          <span class="node-name" style="color: #22d3ee; font-size: 13px;">Lado A</span>
          <span class="node-details">Switch de Acesso/Core</span>
          <span class="node-details" style="margin-top: 4px; color: #22d3ee; font-family: monospace; font-size: 11px;">Porta: ${escapeHtml(conn.port_a)}</span>
        </div>

        <!-- Middle Link -->
        <div class="topology-link-container">
          <div class="link-details">VLAN ${conn.vlan} (Transporte L2L)</div>
          <div class="topology-link" style="background: linear-gradient(90deg, var(--color-secondary) 0%, var(--color-primary) 100%); box-shadow: 0 0 8px var(--color-secondary-glow);"></div>
          <div class="link-ips">
            <div style="color: #22d3ee; font-weight: 700; font-size: 11px; margin-bottom: 2px; text-shadow: 0 0 5px rgba(6, 182, 212, 0.4);">${conn.vpn_type} VPN</div>
            <div>Circuito LAN-TO-LAN</div>
          </div>
        </div>

        <!-- Right Node: Switch Lado Z -->
        <div class="topology-node">
          <div class="node-icon-wrapper node-client" style="background: linear-gradient(135deg, var(--color-primary), #7c3aed); box-shadow: 0 0 15px var(--color-primary-glow);">
            <i class="fa-solid fa-network-wired"></i>
          </div>
          <span class="node-name">${escapeHtml(conn.switch_z)}</span>
          <span class="node-name" style="color: #a78bfa; font-size: 13px;">Lado Z ${conn.asn ? '(AS' + conn.asn + ')' : '(Sem ASN)'}</span>
          <span class="node-details">${escapeHtml(conn.client_name)}</span>
          <span class="node-details" style="margin-top: 4px; color: #a78bfa; font-family: monospace; font-size: 11px;">Porta: ${escapeHtml(conn.port_z)}</span>
        </div>
      </div>

      <!-- L2L Note Section -->
      <div class="topology-prefixes-section" style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 16px;">
        <i class="fa-solid fa-circle-info" style="margin-right: 6px; color: var(--color-secondary);"></i>
        <span>Este circuito é um transporte de camada 2 (LAN-TO-LAN). Filtros de prefixos BGP não se aplicam a esta conexão.</span>
      </div>
    `;
  } else {
    const connPrefixes = State.prefixes.filter(p => p.asn_connection_id === connId);
    let prefixesHtml = '';
    if (connPrefixes.length === 0) {
      prefixesHtml = '<p class="text-muted text-sm">Nenhum prefixo registrado/permitido para anúncio desta sessão.</p>';
    } else {
      prefixesHtml = '<div class="topology-prefixes-list">';
      connPrefixes.forEach(p => {
        prefixesHtml += `
          <div class="topology-prefix-tag">
            <i class="fa-solid fa-route" style="color: var(--color-primary);"></i>
            <span>CIDR: <code>${escapeHtml(p.prefix)}</code></span>
            <span class="text-muted">Max Length: <code>/${p.max_length}</code></span>
          </div>
        `;
      });
      prefixesHtml += '</div>';
    }

    const hasL2L = conn.switch_a && conn.switch_z;

    if (hasL2L) {
      container.innerHTML = `
        <div class="topology-container four-nodes">
          <!-- Node 1: Edge Router -->
          <div class="topology-node">
            <div class="node-icon-wrapper node-edge">
              <i class="fa-solid fa-server"></i>
            </div>
            <span class="node-name">${escapeHtml(conn.router_name)}</span>
            <span class="node-name" style="color: #22d3ee; font-size: 11px;">AS${conn.operator_asn || 264426}</span>
            <span class="node-details">Edge Gateway</span>
            ${conn.ipv4_router ? `<span class="node-details" style="font-family: monospace; font-size: 10px;">${escapeHtml(conn.ipv4_router)}</span>` : ''}
            ${conn.ipv6_router ? `<span class="node-details" style="font-family: monospace; font-size: 10px;">${escapeHtml(conn.ipv6_router)}</span>` : ''}
          </div>

          <!-- Link 1: Router to Switch A -->
          <div class="topology-link-container">
            <div class="link-details">Físico</div>
            <div class="topology-link" style="background: rgba(255,255,255,0.08); box-shadow: none;"></div>
          </div>

          <!-- Node 2: Switch Lado A -->
          <div class="topology-node">
            <div class="node-icon-wrapper node-edge" style="background: linear-gradient(135deg, var(--color-secondary), #0891b2); box-shadow: 0 0 10px rgba(6,182,212,0.3);">
              <i class="fa-solid fa-network-wired"></i>
            </div>
            <span class="node-name">${escapeHtml(conn.switch_a)}</span>
            <span class="node-name" style="color: #22d3ee; font-size: 11px;">Lado A</span>
            <span class="node-details">Porta: ${escapeHtml(conn.port_a)}</span>
          </div>

          <!-- Link 2: Switch A to Switch Z (VLAN L2L link) -->
          <div class="topology-link-container">
            <div class="link-details">VLAN ${conn.vlan}</div>
            <div class="topology-link" style="background: linear-gradient(90deg, var(--color-secondary) 0%, var(--color-primary) 100%);"></div>
            <div class="link-ips">
              <div style="color: #c084fc; font-weight:700;">L2L Transport</div>
            </div>
          </div>

          <!-- Node 3: Switch Lado Z -->
          <div class="topology-node">
            <div class="node-icon-wrapper node-client" style="background: linear-gradient(135deg, var(--color-primary), #7c3aed); box-shadow: 0 0 10px rgba(139,92,246,0.3);">
              <i class="fa-solid fa-network-wired"></i>
            </div>
            <span class="node-name">${escapeHtml(conn.switch_z)}</span>
            <span class="node-name" style="color: #a78bfa; font-size: 11px;">Lado Z</span>
            <span class="node-details">Porta: ${escapeHtml(conn.port_z)}</span>
          </div>

          <!-- Link 3: Switch Z to Client ASN -->
          <div class="topology-link-container">
            <div class="link-details">BGP Peering</div>
            <div class="topology-link" style="background: rgba(255,255,255,0.08); box-shadow: none;"></div>
          </div>

          <!-- Node 4: Client ASN -->
          <div class="topology-node">
            <div class="node-icon-wrapper node-client">
              <i class="fa-solid fa-circle-nodes"></i>
            </div>
            <span class="node-name">${escapeHtml(conn.client_name)}</span>
            <span class="node-name" style="color: #a78bfa; font-size: 11px;">AS${conn.asn}</span>
            <span class="node-details">Cliente Provedor</span>
            ${conn.ipv4_client ? `<span class="node-details" style="font-family: monospace; font-size: 10px;">${escapeHtml(conn.ipv4_client)}</span>` : ''}
            ${conn.ipv6_client ? `<span class="node-details" style="font-family: monospace; font-size: 10px;">${escapeHtml(conn.ipv6_client)}</span>` : ''}
          </div>
        </div>

        <!-- Announced Prefixes Section -->
        <div class="topology-prefixes-section">
          <h4 class="topology-prefixes-title">Prefixos Autorizados para Anúncio</h4>
          ${prefixesHtml}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="topology-container">
          <!-- Left Node: Edge Router -->
          <div class="topology-node">
            <div class="node-icon-wrapper node-edge">
              <i class="fa-solid fa-server"></i>
            </div>
            <span class="node-name">${escapeHtml(conn.router_name)}</span>
            <span class="node-name" style="color: #22d3ee; font-size: 13px;">AS${conn.operator_asn || 264426}</span>
            <span class="node-details">BGP Edge Gateway</span>
            ${conn.ipv4_router ? `<span class="node-details" style="margin-top: 4px; color: #22d3ee; font-family: monospace; font-size: 11px;">IPv4 (Lado A): ${escapeHtml(conn.ipv4_router)}</span>` : ''}
            ${conn.ipv6_router ? `<span class="node-details" style="color: #22d3ee; font-family: monospace; font-size: 11px;">IPv6 (Lado A): ${escapeHtml(conn.ipv6_router)}</span>` : ''}
          </div>

          <!-- Middle Link -->
          <div class="topology-link-container">
            <div class="link-details">VLAN ${conn.vlan} (Sessão BGP)</div>
            <div class="topology-link"></div>
            <div class="link-ips">
              <div style="color: #10b981; font-weight: 700; font-size: 11px; margin-bottom: 2px; text-shadow: 0 0 5px rgba(16, 185, 129, 0.4);">ESTABLISHED</div>
              <div>Link de Trânsito IP</div>
            </div>
          </div>

          <!-- Right Node: Client ASN -->
          <div class="topology-node">
            <div class="node-icon-wrapper node-client">
              <i class="fa-solid fa-circle-nodes"></i>
            </div>
            <span class="node-name">${escapeHtml(conn.client_name)}</span>
            <span class="node-name" style="color: #a78bfa; font-size: 13px;">AS${conn.asn}</span>
            <span class="node-details">Cliente Provedor</span>
            ${conn.ipv4_client ? `<span class="node-details" style="margin-top: 4px; color: #a78bfa; font-family: monospace; font-size: 11px;">IPv4 (Lado Z): ${escapeHtml(conn.ipv4_client)}</span>` : ''}
            ${conn.ipv6_client ? `<span class="node-details" style="color: #a78bfa; font-family: monospace; font-size: 11px;">IPv6 (Lado Z): ${escapeHtml(conn.ipv6_client)}</span>` : ''}
          </div>
        </div>

        <!-- Announced Prefixes Section -->
        <div class="topology-prefixes-section">
          <h4 class="topology-prefixes-title">Prefixos Autorizados para Anúncio</h4>
          ${prefixesHtml}
        </div>
      `;
    }
  }

  document.getElementById('topology-modal').classList.add('show');
}

function closeTopologyModal() {
  document.getElementById('topology-modal').classList.remove('show');
}

// ==========================================
// EXPORT PEERING BGP CONFIGURATION TO PDF
// ==========================================

function exportConnectionPDF(connId) {
  const conn = State.connections.find(c => c.id === connId);
  if (!conn) return;

  const connPrefixes = State.prefixes.filter(p => p.asn_connection_id === connId);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const darkBlue   = [15, 23, 42];   // #0f172a
  const cyan        = [6, 182, 212];  // #06b6d4
  const purple      = [139, 92, 246]; // #8b5cf6
  const gray        = [100, 116, 139];
  const lightGray   = [240, 242, 245];
  const white       = [255, 255, 255];
  const textDark    = [30, 41, 59];

  const pageW = 210;
  const marginL = 15;
  const marginR = 195;

  const opAsnRecord = State.operatorAsns.find(o => o.asn === (conn.operator_asn || 264426));
  const opName = conn.operator_name || 'Operadora Principal';
  const hasLogo = opAsnRecord && opAsnRecord.logo_base64;

  // Dark header bar
  doc.setFillColor(...darkBlue);
  doc.rect(0, 0, pageW, 32, 'F');

  // Logo on the LEFT side of the header
  let titleX = marginL;
  if (hasLogo) {
    try {
      const mimeMatch = opAsnRecord.logo_base64.match(/^data:image\/(\w+);base64,/);
      const rawFmt = mimeMatch ? mimeMatch[1].toUpperCase() : 'PNG';
      const fmt = rawFmt === 'JPG' ? 'JPEG' : (['PNG','JPEG','WEBP','GIF'].includes(rawFmt) ? rawFmt : 'PNG');
      doc.addImage(opAsnRecord.logo_base64, fmt, marginL, 4, 40, 24);
      titleX = marginL + 44; // title starts after logo
    } catch(e) { /* silent */ }
  }

  // Check if it is a LAN-TO-LAN service type
  if (conn.service_type === 'l2l') {
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('DADOS DO TRANSPORTE L2L', titleX, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 215, 235);
    doc.text(`${opName}  |  LAN-TO-LAN`, titleX, 25);

    let y = 40;
    const colW = (pageW - 2 * marginL - 5) / 2;
    const colAx = marginL;
    const colZx = marginL + colW + 5;
    const cardH = 33;

    // Card backgrounds
    doc.setFillColor(232, 240, 253); // light cyan tint for A
    doc.roundedRect(colAx, y, colW, cardH, 2, 2, 'F');
    doc.setFillColor(244, 240, 255); // light purple tint for Z
    doc.roundedRect(colZx, y, colW, cardH, 2, 2, 'F');

    // LADO A header
    doc.setFillColor(...cyan);
    doc.roundedRect(colAx, y, colW, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...white);
    doc.text('LADO A — SWITCH / PORTA', colAx + 3, y + 5.5);

    // LADO A content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    const lineH = 6.5;
    let ay = y + 12;
    doc.setFont('helvetica', 'bold'); doc.text('Switch:', colAx + 3, ay); doc.setFont('helvetica', 'normal'); doc.text(conn.switch_a || '', colAx + 18, ay); ay += lineH;
    doc.setFont('helvetica', 'bold'); doc.text('Porta:', colAx + 3, ay); doc.setFont('helvetica', 'normal'); doc.text(conn.port_a || '', colAx + 18, ay); ay += lineH;

    // LADO Z header
    doc.setFillColor(...purple);
    doc.roundedRect(colZx, y, colW, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...white);
    doc.text('LADO Z — SWITCH / PORTA', colZx + 3, y + 5.5);

    // LADO Z content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    let zy = y + 12;
    doc.setFont('helvetica', 'bold'); doc.text('Cliente:', colZx + 3, zy); doc.setFont('helvetica', 'normal');
    const clientLines = doc.splitTextToSize(conn.client_name, colW - 22);
    doc.text(clientLines, colZx + 18, zy); zy += lineH * Math.max(1, clientLines.length);
    doc.setFont('helvetica', 'bold'); doc.text('ASN:', colZx + 3, zy); doc.setFont('helvetica', 'normal'); doc.text(conn.asn ? `AS${conn.asn}` : 'Sem ASN', colZx + 18, zy); zy += lineH;
    doc.setFont('helvetica', 'bold'); doc.text('Switch:', colZx + 3, zy); doc.setFont('helvetica', 'normal'); doc.text(conn.switch_z || '', colZx + 18, zy); zy += lineH;
    doc.setFont('helvetica', 'bold'); doc.text('Porta:', colZx + 3, zy); doc.setFont('helvetica', 'normal'); doc.text(conn.port_z || '', colZx + 18, zy);

    y += cardH + 10;

    // Line separator
    doc.setLineWidth(0.3);
    doc.setDrawColor(200, 200, 210);
    doc.line(marginL, y, marginR, y);
    y += 8;

    // Characteristics title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...darkBlue);
    doc.text('CARACTERISTICAS DO TRANSPORTE L2L', marginL, y);
    y += 8;

    // Details box
    doc.setFillColor(248, 250, 252); // light slate background
    doc.roundedRect(marginL, y, pageW - 2 * marginL, 30, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginL, y, pageW - 2 * marginL, 30, 2, 2, 'D');

    doc.setFontSize(8.5);
    doc.setTextColor(...textDark);
    let dy = y + 8;
    doc.setFont('helvetica', 'bold'); doc.text('Tipo de VPN:', marginL + 5, dy); doc.setFont('helvetica', 'normal'); doc.text(conn.vpn_type || 'VPWS', marginL + 40, dy); dy += 8;
    doc.setFont('helvetica', 'bold'); doc.text('VLAN do Transporte:', marginL + 5, dy); doc.setFont('helvetica', 'normal'); doc.text(conn.vlan.toString(), marginL + 40, dy); dy += 8;
    doc.setFont('helvetica', 'bold'); doc.text('Status da Conexao:', marginL + 5, dy); doc.setFont('helvetica', 'normal'); doc.text(conn.status === 'active' ? 'Ativo' : 'Inativo', marginL + 40, dy);

    // Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...gray);
    doc.text('Documento gerado automaticamente pelo ASN Provider Manager.', marginL, 290);
    doc.text(`${opName}  |  LAN-TO-LAN`, marginR, 290, { align: 'right' });

    const clientSafeName = conn.client_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/(^_+|_+$)/g, '');

    const fileName = conn.asn ? `l2l_as${conn.asn}_${clientSafeName}.pdf` : `l2l_${clientSafeName}.pdf`;

    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfData: pdfBase64, fileName })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) { showToast(data.error, 'error'); return; }
        window.open(data.url, '_blank');
        showPdfToast(data.url);
      })
      .catch(() => showToast('Erro ao enviar dados do PDF ao servidor.', 'error'));
    } catch (err) {
      showToast('Erro ao gerar dados do PDF.', 'error');
    }
    return;
  }

  // Header title — to the right of logo (or full left if no logo)
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('DADOS DA SESSAO BGP', titleX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 215, 235);
  doc.text(`${opName}  |  AS${conn.operator_asn || 264426}`, titleX, 25);

  // ─── SECTION: LADO A & LADO Z ──────────────────────────────
  let y = 40;

  const colW = (pageW - 2 * marginL - 5) / 2;  // equal halves
  const colAx = marginL;
  const colZx = marginL + colW + 5;
  const cardH = 42;

  // Card backgrounds
  doc.setFillColor(232, 240, 253); // light cyan tint for A
  doc.roundedRect(colAx, y, colW, cardH, 2, 2, 'F');
  doc.setFillColor(244, 240, 255); // light purple tint for Z
  doc.roundedRect(colZx, y, colW, cardH, 2, 2, 'F');

  // LADO A header
  doc.setFillColor(...cyan);
  doc.roundedRect(colAx, y, colW, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...white);
  doc.text('LADO A — OPERADORA', colAx + 3, y + 5.5);

  // LADO A content (no GW field)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  const lineH = 6.5;
  let ay = y + 12;
  doc.setFont('helvetica', 'bold'); doc.text('ASN:', colAx + 3, ay); doc.setFont('helvetica', 'normal'); doc.text(`AS${conn.operator_asn || 264426}`, colAx + 18, ay); ay += lineH;
  doc.setFont('helvetica', 'bold'); doc.text('IPv4:', colAx + 3, ay); doc.setFont('helvetica', 'normal'); doc.text(conn.ipv4_router || 'N/A', colAx + 18, ay); ay += lineH;
  doc.setFont('helvetica', 'bold'); doc.text('IPv6:', colAx + 3, ay); doc.setFont('helvetica', 'normal');
  const ipv6RouterLines = doc.splitTextToSize(conn.ipv6_router || 'N/A', colW - 22);
  doc.text(ipv6RouterLines, colAx + 18, ay);

  // LADO Z header
  doc.setFillColor(...purple);
  doc.roundedRect(colZx, y, colW, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...white);
  doc.text('LADO Z — CLIENTE', colZx + 3, y + 5.5);

  // LADO Z content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  let zy = y + 12;
  doc.setFont('helvetica', 'bold'); doc.text('Cliente:', colZx + 3, zy); doc.setFont('helvetica', 'normal');
  const clientLines = doc.splitTextToSize(conn.client_name, colW - 25);
  doc.text(clientLines, colZx + 22, zy); zy += lineH * Math.max(1, clientLines.length);
  doc.setFont('helvetica', 'bold'); doc.text('ASN:', colZx + 3, zy); doc.setFont('helvetica', 'normal'); doc.text(`AS${conn.asn}`, colZx + 22, zy); zy += lineH;
  doc.setFont('helvetica', 'bold'); doc.text('VLAN:', colZx + 3, zy); doc.setFont('helvetica', 'normal'); doc.text(`${conn.vlan}`, colZx + 22, zy); zy += lineH;
  doc.setFont('helvetica', 'bold'); doc.text('IPv4:', colZx + 3, zy); doc.setFont('helvetica', 'normal'); doc.text(conn.ipv4_client || 'N/A', colZx + 22, zy); zy += lineH;
  doc.setFont('helvetica', 'bold'); doc.text('IPv6:', colZx + 3, zy); doc.setFont('helvetica', 'normal');
  const ipv6ClientLines = doc.splitTextToSize(conn.ipv6_client || 'N/A', colW - 22);
  doc.text(ipv6ClientLines, colZx + 22, zy);

  y += cardH + 10;

  // ─── SECTION: PREFIXOS ─────────────────────────────────────
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 210);
  doc.line(marginL, y, marginR, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkBlue);
  doc.text('PREFIXOS AUTORIZADOS PARA ANUNCIO', marginL, y);
  y += 6;

  if (connPrefixes.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text('Nenhum prefixo registrado para esta conexao BGP.', marginL, y + 4);
  } else {
    // Split by IP version: IPv6 contains ":", IPv4 does not
    const prefixesV4 = connPrefixes.filter(p => !p.prefix.includes(':'));
    const prefixesV6 = connPrefixes.filter(p =>  p.prefix.includes(':'));

    // Column dimensions
    const pColW = (pageW - 2 * marginL - 6) / 2;
    const pColAx = marginL;       // left: IPv4
    const pColBx = marginL + pColW + 6; // right: IPv6

    // Helper to draw a prefix column
    function drawPrefixColumn(prefixes, colX, colW, headerColor, headerLabel, startY) {
      let cy = startY;

      // Column header strip
      doc.setFillColor(...headerColor);
      doc.roundedRect(colX, cy, colW, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...white);
      doc.text(headerLabel, colX + 3, cy + 5);
      cy += 10;

      if (prefixes.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...gray);
        doc.text('Nenhum prefixo.', colX + 3, cy);
        return cy + 8;
      }

      doc.setFontSize(8.5);
      prefixes.forEach((p, idx) => {
        if (cy > 278) {
          doc.addPage();
          cy = 15;
        }

        // Prefix number + CIDR
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textDark);
        const prefixLines = doc.splitTextToSize(`${idx + 1}. ${p.prefix}`, colW - 4);
        doc.text(prefixLines, colX + 3, cy);
        cy += 5 * prefixLines.length;

        // Max mask
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        doc.setFontSize(7.5);
        doc.text(`Max: /${p.max_length}`, colX + 5, cy);
        cy += 4;

        // Description (if exists)
        if (p.description && p.description.trim()) {
          const descLines = doc.splitTextToSize(p.description, colW - 8);
          doc.text(descLines, colX + 5, cy);
          cy += 4 * descLines.length;
        }

        cy += 3; // spacing between prefixes
      });

      return cy;
    }

    const endV4 = drawPrefixColumn(prefixesV4, pColAx, pColW, [16, 185, 129],  'IPv4 — Prefixos Anunciados', y);
    const endV6 = drawPrefixColumn(prefixesV6, pColBx, pColW, [245, 158, 11], 'IPv6 — Prefixos Anunciados', y);

    y = Math.max(endV4, endV6);
  }

  // ─── FOOTER ────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  doc.text('Documento gerado automaticamente pelo ASN Provider Manager.', marginL, 290);
  doc.text(`${opName}  |  AS${conn.operator_asn || 264426}`, marginR, 290, { align: 'right' });

  // ─── SAVE ──────────────────────────────────────────────────
  const clientSafeName = conn.client_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/(^_+|_+$)/g, '');

  const fileName = `bgp_as${conn.asn}_${clientSafeName}.pdf`;

  try {
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    
    fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfData: pdfBase64, fileName })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) { showToast(data.error, 'error'); return; }
      window.open(data.url, '_blank');
      showPdfToast(data.url);
    })
    .catch(() => showToast('Erro ao enviar dados do PDF ao servidor.', 'error'));
  } catch (err) {
    showToast('Erro ao gerar dados do PDF.', 'error');
  }
}

// ==========================================
// AUTOCOMPLETE FOR WIZARD
// ==========================================

function initAutocomplete() {
  const contractInput = document.getElementById('conn-contract-search');
  const contractHidden = document.getElementById('conn-contract-id');
  const contractSug = document.getElementById('conn-contract-suggestions');

  const routerInput = document.getElementById('conn-router-search');
  const routerHidden = document.getElementById('conn-router-id');
  const routerSug = document.getElementById('conn-router-suggestions');

  const switchAInput = document.getElementById('conn-switch-a');
  const switchASug = document.getElementById('conn-switch-a-suggestions');

  const switchZInput = document.getElementById('conn-switch-z');
  const switchZSug = document.getElementById('conn-switch-z-suggestions');

  const prefixConnInput = document.getElementById('prefix-conn-search');
  const prefixConnHidden = document.getElementById('prefix-asn-conn-id');
  const prefixConnSug = document.getElementById('prefix-conn-suggestions');

  // Wire Contract Autocomplete
  contractInput.addEventListener('input', () => {
    const val = contractInput.value.toLowerCase().trim();
    if (!val) {
      contractHidden.value = '';
      contractSug.innerHTML = '';
      contractSug.classList.remove('show');
      return;
    }

    const matches = State.contracts.filter(c => 
      c.status === 'active' && 
      (c.contract_number.toLowerCase().includes(val) || c.client_name.toLowerCase().includes(val))
    );

    contractSug.innerHTML = '';
    if (matches.length === 0) {
      contractSug.innerHTML = '<div class="autocomplete-suggestion text-muted" style="cursor:default;">Nenhum contrato ativo encontrado</div>';
    } else {
      matches.forEach(c => {
        const div = document.createElement('div');
        div.className = 'autocomplete-suggestion';
        div.innerHTML = `
          <strong>${escapeHtml(c.contract_number)}</strong>
          <span class="autocomplete-suggestion-sub">${escapeHtml(c.client_name)}</span>
        `;
        div.addEventListener('mousedown', (e) => {
          // Use mousedown instead of click to fire before blur
          contractInput.value = `${c.contract_number} - ${c.client_name}`;
          contractHidden.value = c.id;
          contractSug.classList.remove('show');
        });
        contractSug.appendChild(div);
      });
    }
    contractSug.classList.add('show');
  });

  // Wire Router Autocomplete
  routerInput.addEventListener('input', () => {
    const val = routerInput.value.toLowerCase().trim();
    if (!val) {
      routerHidden.value = '';
      routerSug.innerHTML = '';
      routerSug.classList.remove('show');
      return;
    }

    const matches = State.routers.filter(r => 
      r.name.toLowerCase().includes(val) || (r.ip_address && r.ip_address.toLowerCase().includes(val))
    );

    routerSug.innerHTML = '';
    if (matches.length === 0) {
      routerSug.innerHTML = '<div class="autocomplete-suggestion text-muted" style="cursor:default;">Nenhum roteador encontrado</div>';
    } else {
      matches.forEach(r => {
        const div = document.createElement('div');
        div.className = 'autocomplete-suggestion';
        div.innerHTML = `
          <strong>${escapeHtml(r.name)}</strong>
          <span class="autocomplete-suggestion-sub">IP: ${escapeHtml(r.ip_address)}</span>
        `;
        div.addEventListener('mousedown', (e) => {
          routerInput.value = r.name;
          routerHidden.value = r.id;
          routerSug.classList.remove('show');
        });
        routerSug.appendChild(div);
      });
    }
    routerSug.classList.add('show');
  });

  // Wire Switch A Autocomplete
  switchAInput.addEventListener('input', () => {
    const val = switchAInput.value.toLowerCase().trim();
    if (!val) {
      switchASug.innerHTML = '';
      switchASug.classList.remove('show');
      return;
    }

    const matches = State.routers.filter(r => 
      r.name.toLowerCase().includes(val) || (r.ip_address && r.ip_address.toLowerCase().includes(val))
    );

    switchASug.innerHTML = '';
    if (matches.length === 0) {
      switchASug.innerHTML = '<div class="autocomplete-suggestion text-muted" style="cursor:default;">Nenhum roteador/switch encontrado</div>';
    } else {
      matches.forEach(r => {
        const div = document.createElement('div');
        div.className = 'autocomplete-suggestion';
        div.innerHTML = `
          <strong>${escapeHtml(r.name)}</strong>
          <span class="autocomplete-suggestion-sub">IP: ${escapeHtml(r.ip_address)}</span>
        `;
        div.addEventListener('mousedown', (e) => {
          switchAInput.value = r.name;
          switchASug.classList.remove('show');
        });
        switchASug.appendChild(div);
      });
    }
    switchASug.classList.add('show');
  });

  // Wire Switch Z Autocomplete
  switchZInput.addEventListener('input', () => {
    const val = switchZInput.value.toLowerCase().trim();
    if (!val) {
      switchZSug.innerHTML = '';
      switchZSug.classList.remove('show');
      return;
    }

    const matches = State.routers.filter(r => 
      r.name.toLowerCase().includes(val) || (r.ip_address && r.ip_address.toLowerCase().includes(val))
    );

    switchZSug.innerHTML = '';
    if (matches.length === 0) {
      switchZSug.innerHTML = '<div class="autocomplete-suggestion text-muted" style="cursor:default;">Nenhum roteador/switch encontrado</div>';
    } else {
      matches.forEach(r => {
        const div = document.createElement('div');
        div.className = 'autocomplete-suggestion';
        div.innerHTML = `
          <strong>${escapeHtml(r.name)}</strong>
          <span class="autocomplete-suggestion-sub">IP: ${escapeHtml(r.ip_address)}</span>
        `;
        div.addEventListener('mousedown', (e) => {
          switchZInput.value = r.name;
          switchZSug.classList.remove('show');
        });
        switchZSug.appendChild(div);
      });
    }
    switchZSug.classList.add('show');
  });

  // Wire Port A Autocomplete
  const portAInput = document.getElementById('conn-port-a');
  const portASug = document.getElementById('conn-port-a-suggestions');

  portAInput.addEventListener('input', () => {
    handlePortAutocomplete(portAInput, portASug, switchAInput.value);
  });
  portAInput.addEventListener('focus', () => {
    handlePortAutocomplete(portAInput, portASug, switchAInput.value);
  });

  // Wire Port Z Autocomplete
  const portZInput = document.getElementById('conn-port-z');
  const portZSug = document.getElementById('conn-port-z-suggestions');

  portZInput.addEventListener('input', () => {
    handlePortAutocomplete(portZInput, portZSug, switchZInput.value);
  });
  portZInput.addEventListener('focus', () => {
    handlePortAutocomplete(portZInput, portZSug, switchZInput.value);
  });

  // Close suggestions on blur
  contractInput.addEventListener('blur', () => {
    setTimeout(() => contractSug.classList.remove('show'), 200);
  });
  routerInput.addEventListener('blur', () => {
    setTimeout(() => routerSug.classList.remove('show'), 200);
  });
  switchAInput.addEventListener('blur', () => {
    setTimeout(() => switchASug.classList.remove('show'), 200);
  });
  switchZInput.addEventListener('blur', () => {
    setTimeout(() => switchZSug.classList.remove('show'), 200);
  });
  portAInput.addEventListener('blur', () => {
    setTimeout(() => portASug.classList.remove('show'), 200);
  });
  portZInput.addEventListener('blur', () => {
    setTimeout(() => portZSug.classList.remove('show'), 200);
  });

  // Wire Prefix ASN Connection Autocomplete
  if (prefixConnInput) {
    const handlePrefixConnAutocomplete = () => {
      const val = prefixConnInput.value.toLowerCase().trim();
      
      // Filter only connections of type BGP because L2L doesn't announce BGP prefixes
      const matches = State.connections.filter(c => 
        c.service_type === 'bgp' && 
        (!val || (c.asn && c.asn.toString().includes(val)) || (c.client_name && c.client_name.toLowerCase().includes(val)))
      );

      prefixConnSug.innerHTML = '';
      if (matches.length === 0) {
        prefixConnSug.innerHTML = '<div class="autocomplete-suggestion text-muted" style="cursor:default;">Nenhuma conexão BGP encontrada</div>';
      } else {
        matches.forEach(c => {
          const div = document.createElement('div');
          div.className = 'autocomplete-suggestion';
          div.innerHTML = `
            <strong>AS${c.asn}</strong>
            <span class="autocomplete-suggestion-sub">${escapeHtml(c.client_name)}</span>
          `;
          div.addEventListener('mousedown', () => {
            prefixConnInput.value = `AS${c.asn} - ${c.client_name}`;
            prefixConnHidden.value = c.id;
            prefixConnSug.classList.remove('show');
          });
          prefixConnSug.appendChild(div);
        });
      }
      prefixConnSug.classList.add('show');
    };

    prefixConnInput.addEventListener('input', handlePrefixConnAutocomplete);
    prefixConnInput.addEventListener('focus', handlePrefixConnAutocomplete);
    prefixConnInput.addEventListener('blur', () => {
      setTimeout(() => prefixConnSug.classList.remove('show'), 200);
    });
  }
}

/**
 * Handles Zabbix ports lookup dynamically on-demand
 */
async function handlePortAutocomplete(portInput, portSug, switchValue) {
  const val = portInput.value.toLowerCase().trim();
  
  if (!switchValue) {
    portSug.innerHTML = '';
    portSug.classList.remove('show');
    return;
  }

  const router = State.routers.find(r => r.name.toLowerCase() === switchValue.toLowerCase());
  if (!router || !router.zabbix_hostid) {
    portSug.innerHTML = '';
    portSug.classList.remove('show');
    return;
  }

  // Prevent loading list multiple times if query hasn't changed and dropdown is showing
  if (portSug.classList.contains('show') && portSug.dataset.currentHost === router.zabbix_hostid && !val) {
    return;
  }

  // Show loading indicator
  portSug.innerHTML = '<div class="autocomplete-suggestion text-muted" style="cursor:default;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando interfaces...</div>';
  portSug.classList.add('show');
  portSug.dataset.currentHost = router.zabbix_hostid;

  try {
    const res = await fetch(`/api/zabbix/hosts/${router.zabbix_hostid}/interfaces`);
    if (!res.ok) throw new Error();
    const list = await res.json();
    
    const matches = val 
      ? list.filter(item => item.toLowerCase().includes(val))
      : list;

    portSug.innerHTML = '';
    if (matches.length === 0) {
      portSug.innerHTML = '<div class="autocomplete-suggestion text-muted" style="cursor:default;">Nenhuma interface correspondente</div>';
    } else {
      matches.forEach(item => {
        const div = document.createElement('div');
        div.className = 'autocomplete-suggestion';
        
        let displayHtml = escapeHtml(item);
        const parenIndex = item.indexOf('(');
        if (parenIndex !== -1) {
          const mainPart = item.substring(0, parenIndex);
          const descPart = item.substring(parenIndex);
          displayHtml = `<strong>${escapeHtml(mainPart)}</strong> <span class="autocomplete-suggestion-sub" style="opacity: 0.7;">${escapeHtml(descPart)}</span>`;
        }

        div.innerHTML = displayHtml;
        div.addEventListener('mousedown', (e) => {
          portInput.value = parseInterfaceName(item);
          portSug.classList.remove('show');
        });
        portSug.appendChild(div);
      });
    }
    portSug.classList.add('show');
  } catch (err) {
    console.error('Erro ao buscar interfaces dinamicamente:', err);
    portSug.innerHTML = '<div class="autocomplete-suggestion text-muted" style="cursor:default;">Erro ao carregar do Zabbix</div>';
  }
}

/**
 * Parses Zabbix interface application string to extract clean interface name (e.g. hundred-gigabit-ethernet-1/1/1)
 */
function parseInterfaceName(tagValue) {
  let clean = tagValue || '';
  if (clean.startsWith('Interface ')) {
    clean = clean.substring(10);
  }
  const parenIndex = clean.indexOf('(');
  if (parenIndex !== -1) {
    clean = clean.substring(0, parenIndex);
  }
  return clean.trim();
}

// ==========================================
// WIZARD FOR MULTI-STEP CONNECTION
// ==========================================

function toggleServiceTypeFields(type) {
  const bgpFields = document.getElementById('bgp-fields-group');
  const l2lFields = document.getElementById('l2l-fields-group');
  const bgpL2lDivider = document.getElementById('bgp-l2l-divider');
  const btnBgp = document.getElementById('btn-service-bgp');
  const btnL2l = document.getElementById('btn-service-l2l');
  const serviceTypeInput = document.getElementById('conn-service-type');
  
  const lblVlan = document.getElementById('lbl-conn-vlan');
  const lblStatus = document.getElementById('lbl-conn-status');
  const lblAsn = document.getElementById('lbl-conn-asn');
  const inputAsn = document.getElementById('conn-asn');
  
  // Buttons for wizard
  const btnNext = document.getElementById('btn-wizard-next');
  const btnSubmit = document.getElementById('btn-wizard-submit');
  const wizardProgress = document.querySelector('.wizard-progress');
  const isEditing = document.getElementById('connection-id').value !== '';

  serviceTypeInput.value = type;

  if (type === 'bgp') {
    bgpFields.style.display = 'contents';
    l2lFields.style.display = 'none';
    if (bgpL2lDivider) bgpL2lDivider.style.display = 'block';
    btnBgp.classList.add('active');
    btnL2l.classList.remove('active');
    
    lblVlan.innerText = 'ID da VLAN';
    lblStatus.innerText = 'Status da Conexão';
    lblAsn.innerText = 'ASN do Cliente (Lado Z) *';
    inputAsn.required = true;
    
    if (!isEditing) {
      wizardProgress.style.display = 'flex';
      btnNext.style.display = 'inline-block';
      btnSubmit.style.display = 'none';
    }
  } else {
    bgpFields.style.display = 'none';
    l2lFields.style.display = 'contents';
    if (bgpL2lDivider) bgpL2lDivider.style.display = 'none';
    btnBgp.classList.remove('active');
    btnL2l.classList.add('active');
    
    lblVlan.innerText = 'VLAN do Transporte';
    lblStatus.innerText = 'Status da Conexão';
    lblAsn.innerText = 'ASN do Cliente (Lado Z) (Opcional)';
    inputAsn.required = false;
    inputAsn.value = ''; // Clear value for LAN-TO-LAN
    
    wizardProgress.style.display = 'none';
    btnNext.style.display = 'none';
    btnSubmit.style.display = 'inline-block';
  }
}

function initWizard() {
  const btnNext = document.getElementById('btn-wizard-next');
  const btnBack = document.getElementById('btn-wizard-back');
  const btnSubmit = document.getElementById('btn-wizard-submit');
  const btnAddPrefix = document.getElementById('btn-wizard-add-prefix');

  // Wire Selector Toggle click handlers
  document.getElementById('btn-service-bgp').addEventListener('click', () => toggleServiceTypeFields('bgp'));
  document.getElementById('btn-service-l2l').addEventListener('click', () => toggleServiceTypeFields('l2l'));

  btnNext.addEventListener('click', () => {
    // Basic validation of Step 1 inputs before moving
    const serviceType = document.getElementById('conn-service-type').value;
    const asn = document.getElementById('conn-asn').value;
    const vlan = document.getElementById('conn-vlan').value;
    const contractId = document.getElementById('conn-contract-id').value;

    if (!vlan || !contractId) {
      showToast('Por favor, preencha os campos Contrato e VLAN.', 'error');
      return;
    }

    if (serviceType === 'bgp' && !asn) {
      showToast('Por favor, preencha o campo ASN do Cliente.', 'error');
      return;
    }

    if (serviceType === 'bgp') {
      const routerId = document.getElementById('conn-router-id').value;
      const ipv4r = document.getElementById('conn-ipv4-router').value.trim();
      const ipv4c = document.getElementById('conn-ipv4-client').value.trim();
      const ipv6r = document.getElementById('conn-ipv6-router').value.trim();
      const ipv6c = document.getElementById('conn-ipv6-client').value.trim();

      if (!routerId) {
        showToast('Por favor, selecione o roteador conectado.', 'error');
        return;
      }

      const hasIPv4 = ipv4r && ipv4c;
      const hasIPv6 = ipv6r && ipv6c;

      if (!hasIPv4 && !hasIPv6) {
        showToast('Por favor, preencha os dados de IPv4 (Lado A e Lado Z) ou de IPv6 (Lado A e Lado Z) para a Sessão BGP.', 'error');
        return;
      }

      if ((ipv4r && !ipv4c) || (!ipv4r && ipv4c)) {
        showToast('Para configurar IPv4, ambos os campos (Lado A e Lado Z) são obrigatórios.', 'error');
        return;
      }

      if ((ipv6r && !ipv6c) || (!ipv6r && ipv6c)) {
        showToast('Para configurar IPv6, ambos os campos (Lado A e Lado Z) são obrigatórios.', 'error');
        return;
      }
      
      // Move to Step 2
      showWizardStep(2);
    } else {
      // L2L is single step, next is not shown, but if hit, do nothing
      return;
    }
  });

  btnBack.addEventListener('click', () => {
    showWizardStep(1);
  });

  // Add prefix locally inside Step 2
  btnAddPrefix.addEventListener('click', () => {
    const cidrInput = document.getElementById('wizard-prefix-cidr');
    const maxLenInput = document.getElementById('wizard-prefix-max-length');
    const descInput = document.getElementById('wizard-prefix-description');

    const prefix = cidrInput.value.trim();
    const max_length = parseInt(maxLenInput.value);
    const description = descInput.value.trim();

    if (!prefix || isNaN(max_length)) {
      showToast('Digite um bloco CIDR e a Máscara Máxima permitida.', 'error');
      return;
    }

    // Basic CIDR syntax regex validation
    if (!prefix.includes('/')) {
      showToast('O bloco CIDR deve conter barra (ex: /24 ou /48).', 'error');
      return;
    }

    // Add to state list
    State.tempPrefixes.push({ prefix, max_length, description });
    renderWizardPrefixes();

    // Clear prefix forms inputs
    cidrInput.value = '';
    maxLenInput.value = '';
    descInput.value = '';
  });
}

function showWizardStep(step) {
  const step1 = document.getElementById('connection-step-1');
  const step2 = document.getElementById('connection-step-2');
  const dot1 = document.getElementById('wizard-dot-1');
  const dot2 = document.getElementById('wizard-dot-2');
  const btnNext = document.getElementById('btn-wizard-next');
  const btnBack = document.getElementById('btn-wizard-back');
  const btnCancel = document.getElementById('btn-wizard-cancel');
  const btnSubmit = document.getElementById('btn-wizard-submit');

  if (step === 1) {
    step1.style.display = 'block';
    step2.style.display = 'none';
    dot1.classList.add('active');
    dot2.classList.remove('active');
    
    btnNext.style.display = 'inline-block';
    btnBack.style.display = 'none';
    btnCancel.style.display = 'inline-block';
    btnSubmit.style.display = 'none';
  } else {
    step1.style.display = 'none';
    step2.style.display = 'block';
    dot1.classList.remove('active');
    dot2.classList.add('active');
    
    btnNext.style.display = 'none';
    btnBack.style.display = 'inline-block';
    btnCancel.style.display = 'none';
    btnSubmit.style.display = 'inline-block';
  }
}

function renderWizardPrefixes() {
  const list = document.getElementById('wizard-prefixes-list');
  if (!list) return;

  list.innerHTML = '';
  if (State.tempPrefixes.length === 0) {
    list.innerHTML = '<div class="text-muted text-sm text-center" style="width: 100%; padding-top: 15px;">Nenhum prefixo adicionado ainda.</div>';
    return;
  }

  State.tempPrefixes.forEach((p, idx) => {
    const tag = document.createElement('div');
    tag.className = 'topology-prefix-tag';
    tag.style.justifyContent = 'space-between';
    tag.style.width = 'calc(50% - 5px)';
    tag.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <i class="fa-solid fa-route" style="color: var(--color-secondary);"></i>
        <div>
          <code>${escapeHtml(p.prefix)}</code>
          <span class="text-sub" style="font-size:10px;">Max: /${p.max_length}</span>
        </div>
      </div>
      <button type="button" class="btn-action btn-action-delete" style="width:22px; height:22px; font-size:10px; border-radius:50%;" onclick="removeWizardPrefix(${idx})">
        &times;
      </button>
    `;
    list.appendChild(tag);
  });
}

function removeWizardPrefix(idx) {
  State.tempPrefixes.splice(idx, 1);
  renderWizardPrefixes();
}

// ==========================================
// PAGINATION EVENT LISTENERS FOR ALL TABLES
// ==========================================
function initPaginationListeners() {
  // 1. Dashboard Table
  document.getElementById('dashboard-limit-select').addEventListener('change', (e) => {
    State.dashboardLimit = parseInt(e.target.value);
    State.dashboardPage = 1;
    renderDashboardConnectionsTable();
  });
  document.getElementById('btn-dashboard-prev').addEventListener('click', () => {
    if (State.dashboardPage > 1) {
      State.dashboardPage--;
      renderDashboardConnectionsTable();
    }
  });
  document.getElementById('btn-dashboard-next').addEventListener('click', () => {
    const searchVal = document.getElementById('dashboard-search') ? document.getElementById('dashboard-search').value.toLowerCase().trim() : '';
    const filteredCount = State.connections.filter(conn => {
      if (!searchVal) return true;
      const asnStr = conn.asn ? `as${conn.asn}`.toLowerCase() : '';
      const asnValStr = conn.asn ? conn.asn.toString() : '';
      return asnValStr.includes(searchVal) ||
             asnStr.includes(searchVal) ||
             (conn.client_name && conn.client_name.toLowerCase().includes(searchVal)) ||
             (conn.contract_number && conn.contract_number.toLowerCase().includes(searchVal)) ||
             conn.vlan.toString().includes(searchVal) ||
             (conn.ipv4_router && conn.ipv4_router.toLowerCase().includes(searchVal)) ||
             (conn.ipv4_client && conn.ipv4_client.toLowerCase().includes(searchVal)) ||
             (conn.ipv6_router && conn.ipv6_router.toLowerCase().includes(searchVal)) ||
             (conn.ipv6_client && conn.ipv6_client.toLowerCase().includes(searchVal));
    }).length;
    
    const totalPages = Math.ceil(filteredCount / State.dashboardLimit) || 1;
    if (State.dashboardPage < totalPages) {
      State.dashboardPage++;
      renderDashboardConnectionsTable();
    }
  });

  // 2. Connections Table
  document.getElementById('connections-limit-select').addEventListener('change', (e) => {
    State.connectionsLimit = parseInt(e.target.value);
    State.connectionsPage = 1;
    renderConnectionsTable();
  });
  document.getElementById('btn-connections-prev').addEventListener('click', () => {
    if (State.connectionsPage > 1) {
      State.connectionsPage--;
      renderConnectionsTable();
    }
  });
  document.getElementById('btn-connections-next').addEventListener('click', () => {
    const searchVal = document.getElementById('connections-search') ? document.getElementById('connections-search').value.toLowerCase().trim() : '';
    const filteredCount = State.connections.filter(conn => {
      if (!searchVal) return true;
      const asnStr = conn.asn ? `as${conn.asn}`.toLowerCase() : '';
      const asnValStr = conn.asn ? conn.asn.toString() : '';
      return asnValStr.includes(searchVal) ||
             asnStr.includes(searchVal) ||
             (conn.client_name && conn.client_name.toLowerCase().includes(searchVal)) ||
             (conn.contract_number && conn.contract_number.toLowerCase().includes(searchVal)) ||
             conn.vlan.toString().includes(searchVal) ||
             (conn.ipv4_router && conn.ipv4_router.toLowerCase().includes(searchVal)) ||
             (conn.ipv4_client && conn.ipv4_client.toLowerCase().includes(searchVal)) ||
             (conn.ipv6_router && conn.ipv6_router.toLowerCase().includes(searchVal)) ||
             (conn.ipv6_client && conn.ipv6_client.toLowerCase().includes(searchVal));
    }).length;

    const totalPages = Math.ceil(filteredCount / State.connectionsLimit) || 1;
    if (State.connectionsPage < totalPages) {
      State.connectionsPage++;
      renderConnectionsTable();
    }
  });

  // 3. Prefixes Table
  document.getElementById('prefixes-limit-select').addEventListener('change', (e) => {
    State.prefixesLimit = parseInt(e.target.value);
    State.prefixesPage = 1;
    renderPrefixesTable();
  });
  document.getElementById('btn-prefixes-prev').addEventListener('click', () => {
    if (State.prefixesPage > 1) {
      State.prefixesPage--;
      renderPrefixesTable();
    }
  });
  document.getElementById('btn-prefixes-next').addEventListener('click', () => {
    const searchVal = document.getElementById('prefixes-search') ? document.getElementById('prefixes-search').value.toLowerCase().trim() : '';
    const filteredCount = State.prefixes.filter(prefix => {
      if (!searchVal) return true;
      return (
        (prefix.asn && prefix.asn.toString().includes(searchVal)) ||
        (prefix.client_name && prefix.client_name.toLowerCase().includes(searchVal)) ||
        (prefix.prefix && prefix.prefix.toLowerCase().includes(searchVal)) ||
        (prefix.description && prefix.description.toLowerCase().includes(searchVal))
      );
    }).length;

    const totalPages = Math.ceil(filteredCount / State.prefixesLimit) || 1;
    if (State.prefixesPage < totalPages) {
      State.prefixesPage++;
      renderPrefixesTable();
    }
  });

  // 4. Contracts Table
  document.getElementById('contracts-limit-select').addEventListener('change', (e) => {
    State.contractsLimit = parseInt(e.target.value);
    State.contractsPage = 1;
    renderContractsTable();
  });
  document.getElementById('btn-contracts-prev').addEventListener('click', () => {
    if (State.contractsPage > 1) {
      State.contractsPage--;
      renderContractsTable();
    }
  });
  document.getElementById('btn-contracts-next').addEventListener('click', () => {
    const totalPages = Math.ceil(State.contracts.length / State.contractsLimit) || 1;
    if (State.contractsPage < totalPages) {
      State.contractsPage++;
      renderContractsTable();
    }
  });

  // 5. Settings Table
  document.getElementById('settings-limit-select').addEventListener('change', (e) => {
    State.settingsLimit = parseInt(e.target.value);
    State.settingsPage = 1;
    renderSettingsTable();
  });
  document.getElementById('btn-settings-prev').addEventListener('click', () => {
    if (State.settingsPage > 1) {
      State.settingsPage--;
      renderSettingsTable();
    }
  });
  document.getElementById('btn-settings-next').addEventListener('click', () => {
    const totalPages = Math.ceil(State.operatorAsns.length / State.settingsLimit) || 1;
    if (State.settingsPage < totalPages) {
      State.settingsPage++;
      renderSettingsTable();
    }
  });

  // Logo upload zone interactions
  initLogoUpload();
}

// ==========================================
// CONFIGURATIONS (Settings / operator_asns)
// ==========================================

// Current selected logo base64 (kept in memory during form editing)
let _currentLogoBase64 = null;

function initLogoUpload() {
  const zone = document.getElementById('logo-upload-zone');
  const fileInput = document.getElementById('setting-logo-file');
  const placeholder = document.getElementById('logo-upload-placeholder');
  const previewWrap = document.getElementById('logo-preview-wrap');
  const previewImg = document.getElementById('setting-logo-preview');
  const removeBtn = document.getElementById('btn-remove-logo');

  // Click zone to open file picker
  zone.addEventListener('click', (e) => {
    if (e.target === removeBtn || removeBtn.contains(e.target)) return;
    fileInput.click();
  });

  // File selected via dialog
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) processLogoFile(file);
  });

  // Drag & drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processLogoFile(file);
  });

  // Remove logo button
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearLogoPreview();
  });
}

function processLogoFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Por favor, selecione um arquivo de imagem válido.', 'error');
    return;
  }
  if (file.size > 1024 * 1024) {
    showToast('A imagem deve ter no máximo 1MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    _currentLogoBase64 = e.target.result; // Full data URL: "data:image/png;base64,..."
    showLogoPreview(e.target.result);
  };
  reader.readAsDataURL(file);
}

function showLogoPreview(src) {
  document.getElementById('logo-upload-placeholder').style.display = 'none';
  const wrap = document.getElementById('logo-preview-wrap');
  wrap.style.display = 'inline-block';
  document.getElementById('setting-logo-preview').src = src;
}

function clearLogoPreview() {
  _currentLogoBase64 = null;
  document.getElementById('setting-logo-file').value = '';
  document.getElementById('setting-logo-preview').src = '';
  document.getElementById('logo-preview-wrap').style.display = 'none';
  document.getElementById('logo-upload-placeholder').style.display = 'flex';
}

function renderSettingsTable() {
  const tbody = document.querySelector('#settings-table tbody');
  tbody.innerHTML = '';
  
  const totalItems = State.operatorAsns.length;
  const totalPages = Math.ceil(totalItems / State.settingsLimit) || 1;

  if (State.settingsPage > totalPages) {
    State.settingsPage = totalPages;
  }
  if (State.settingsPage < 1) {
    State.settingsPage = 1;
  }

  // Update DOM elements
  const pageIndicator = document.getElementById('settings-page-indicator');
  const btnPrev = document.getElementById('btn-settings-prev');
  const btnNext = document.getElementById('btn-settings-next');

  if (pageIndicator) pageIndicator.innerText = `Página ${State.settingsPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = State.settingsPage === 1;
  if (btnNext) btnNext.disabled = State.settingsPage === totalPages;

  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center">Nenhum ASN da operadora configurado.</td></tr>';
    return;
  }

  const start = (State.settingsPage - 1) * State.settingsLimit;
  const end = start + State.settingsLimit;
  const pageItems = State.operatorAsns.slice(start, end);
  
  pageItems.forEach(item => {
    const tr = document.createElement('tr');
    const logoHtml = item.logo_base64
      ? `<img src="${item.logo_base64}" class="logo-thumb" alt="Logo AS${item.asn}" title="${escapeHtml(item.name)}">`
      : `<div class="logo-thumb-placeholder"><i class="fa-regular fa-image"></i></div>`;
    
    tr.innerHTML = `
      <td style="width: 50px; text-align: center;">${logoHtml}</td>
      <td><strong>AS${item.asn}</strong></td>
      <td>${escapeHtml(item.name)}</td>
      <td class="actions-cell">
        <button class="btn-action btn-action-edit" onclick="editSetting(${item.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-action btn-action-delete" onclick="deleteSetting(${item.id})"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function saveSetting(e) {
  e.preventDefault();
  const id = document.getElementById('setting-id').value;
  const body = {
    asn: document.getElementById('setting-asn').value,
    name: document.getElementById('setting-name').value,
    // Include logo: if a new one was selected use it; null means clear; undefined means keep (PUT only)
    logo_base64: _currentLogoBase64 !== undefined ? _currentLogoBase64 : undefined
  };

  // For PUT: if no logo change was made (_currentLogoBase64 is undefined
  // meaning we never touched it), don't send the field at all
  // We track this via _currentLogoBase64 being either a string, null, or undefined
  if (id && _currentLogoBase64 === undefined) {
    delete body.logo_base64; // keep existing
  }

  const url = id ? `/api/operator-asns/${id}` : '/api/operator-asns';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao salvar configuração.', 'error');
      return;
    }

    showToast(id ? 'Configuração atualizada!' : 'Novo ASN da operadora cadastrado!');
    cancelSettingEdit();
    loadAll();
  } catch (err) {
    showToast('Falha ao processar requisição.', 'error');
  }
}

function editSetting(id) {
  const item = State.operatorAsns.find(o => o.id === id);
  if (!item) return;

  document.getElementById('setting-id').value = item.id;
  document.getElementById('setting-asn').value = item.asn;
  document.getElementById('setting-name').value = item.name;

  // Restore logo preview if exists
  _currentLogoBase64 = undefined; // undefined = not changed yet
  if (item.logo_base64) {
    showLogoPreview(item.logo_base64);
  } else {
    clearLogoPreview();
  }

  document.getElementById('settings-form-title').innerText = 'Editar ASN Operadora';
  document.getElementById('btn-cancel-setting-edit').style.display = 'inline-block';
}

function cancelSettingEdit() {
  document.getElementById('setting-id').value = '';
  document.getElementById('settings-form').reset();
  document.getElementById('settings-form-title').innerText = 'Cadastrar ASN Operadora';
  document.getElementById('btn-cancel-setting-edit').style.display = 'none';
  _currentLogoBase64 = null;
  clearLogoPreview();
}

async function deleteSetting(id) {
  if (!confirm('Deseja realmente excluir este ASN?')) return;
  try {
    const res = await fetch(`/api/operator-asns/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao excluir ASN.', 'error');
      return;
    }
    showToast('Configuração excluída!');
    loadAll();
  } catch (err) {
    showToast('Erro de rede ao excluir configuração.', 'error');
  }
}
