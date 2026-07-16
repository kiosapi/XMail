const $ = (id) => document.getElementById(id);
const app = $('app');

let appConfig = { appName: 'XMail', mailDomain: 'kilo.web.id', mailDomains: ['kilo.web.id'], webHost: '', authRequired: false };
const SESSION_KEY = 'xmail_session_id';
let sessionId = localStorage.getItem(SESSION_KEY) || '';
let currentApiKey = localStorage.getItem('xmail_api_key') || '';
let inboxes = [];
let selectedInbox = null;
let messages = [];
let selectedMessage = null;
let unreadCounts = {};

const ICON = {
  compose: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  inbox: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 6 10-6"/></svg>',
  bulk: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>',
  stats: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="13" y="8" width="3" height="10" rx="1"/><path d="M19 5v13"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  refresh: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>',
  delete: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  shield: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  paperclip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  mail: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 6 10-6"/></svg>',
  empty: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m2 7 10 6 10-6"/></svg>',
  copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  sparkle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>',
  dice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  save: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

// ==================== API ====================
async function fetchJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (sessionId) headers['x-session-id'] = sessionId;
  if (currentApiKey) headers['x-api-key'] = currentApiKey;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(dt) {
  const d = new Date(dt.includes('T') ? dt : dt.replace(' ', 'T'));
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return d.toLocaleString('en-US',{hour:'2-digit',minute:'2-digit'});
  if (diff < 604800) return d.toLocaleString('en-US',{weekday:'short',hour:'2-digit',minute:'2-digit'});
  return d.toLocaleString('en-US',{month:'short',day:'numeric'});
}

function formatFullDate(dt) {
  const d = new Date(dt.includes('T') ? dt : dt.replace(' ', 'T'));
  return d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

function getInitial(addr) {
  return (addr || '?')[0].toUpperCase();
}

function showToast(text) {
  let tc = $('toastContainer');
  if (!tc) { tc = document.createElement('div'); tc.id = 'toastContainer'; tc.className = 'toast-container'; document.body.appendChild(tc); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' + escapeHtml(text);
  tc.appendChild(el);
  setTimeout(() => { el.classList.add('fadeout'); setTimeout(() => el.remove(), 200); }, 2000);
}

// ==================== Init ====================
async function init() {
  applyTheme(localStorage.getItem('xmail_theme') || 'dark');
  appConfig = await fetchJson('/api/config');
  document.title = appConfig.appName;
  let sid = await fetchJson('/api/session');
  sessionId = sid.sessionId;
  localStorage.setItem(SESSION_KEY, sessionId);
  await loadInboxes();
  render();
}

async function loadInboxes() {
  inboxes = await fetchJson('/api/inboxes');
  for (const ib of inboxes) {
    try { unreadCounts[ib.address] = 0; } catch(e) {}
  }
  if (inboxes.length > 0 && !selectedInbox) selectedInbox = inboxes[0].address;
}

async function loadMessages() {
  if (!selectedInbox) { messages = []; return; }
  messages = await fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/messages');
  renderMessages();
}

async function openMessage(msgId) {
  if (!selectedInbox) return;
  selectedMessage = msgId;
  const msg = await fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/messages/' + msgId);
  renderReadingPane(msg);
  await loadMessages();
  openReadingPaneMobile();
}

// ==================== Actions ====================
async function createInbox(localPart, domain) {
  const ib = await fetchJson('/api/inboxes', { method: 'POST', body: JSON.stringify({ localPart, domain }) });
  await loadInboxes();
  selectedInbox = ib.address;
  closeModal();
  render();
  showToast('Inbox created');
  await loadMessages();
}

async function createBulk() {
  const count = parseInt($('bulkCount').value) || 5;
  const domain = $('bulkDomain') ? $('bulkDomain').value : appConfig.mailDomain;
  const res = await fetchJson('/api/inboxes/bulk', { method: 'POST', body: JSON.stringify({ count, domain }) });
  if ($('bulkResult')) { $('bulkResult').value = res.addresses.join('\n'); $('bulkResult').classList.remove('hidden'); }
  await loadInboxes();
  render();
  showToast(res.count + ' inboxes created');
}

async function deleteInbox(addr) {
  await fetchJson('/api/inboxes/' + encodeURIComponent(addr) + '?purge=1', { method: 'DELETE' });
  if (selectedInbox === addr) { selectedInbox = null; messages = []; }
  await loadInboxes();
  render();
  showToast('Inbox deleted');
}

async function saveSettings() {
  const wh = $('setWebhook').value.trim();
  const tg = $('setTelegram').value.trim();
  await fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/settings', {
    method: 'PUT',
    body: JSON.stringify({ webhook_url: wh || null, telegram_chat_id: tg || null })
  });
  closeModal();
  showToast('Settings saved');
}

async function loadStats() {
  const stats = await fetchJson('/api/stats?days=7');
  let html = '<div class="stats-grid"><div class="stat-card"><div class="stat-num">' + stats.totals.inboxes + '</div><div class="stat-label">Total Inboxes</div></div><div class="stat-card"><div class="stat-num">' + stats.totals.messages + '</div><div class="stat-label">Total Emails</div></div></div>';
  html += '<table class="stats-table"><tr><th>Date</th><th>Emails</th><th>Inboxes</th></tr>';
  stats.daily.forEach(function(d) { html += '<tr><td>' + d.date + '</td><td>' + d.total_emails + '</td><td>' + d.total_inboxes + '</td></tr>'; });
  html += '</table>';
  return html;
}

// ==================== Theme ====================
function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  localStorage.setItem('xmail_theme', theme);
}

// ==================== Rendering ====================
function render() {
  let html = '<div class="layout">';
  // Sidebar
  html += '<div class="sidebar" id="sidebar">';
  html += '<div class="sidebar-header"><div class="sidebar-logo">' + ICON.inbox + '</div><h1>' + escapeHtml(appConfig.appName || 'XMail') + '</h1></div>';
  html += '<button class="sidebar-compose" onclick="openNewModal()">' + ICON.compose + ' Compose</button>';
  html += '<div class="sidebar-content">';
  html += '<div class="sidebar-section"><div class="sidebar-section-label">Mailboxes</div>';
  html += '<div class="sidebar-item active">' + ICON.inbox + '<span>All Inboxes</span><span class="badge">' + inboxes.length + '</span></div>';
  html += '<div class="sidebar-item" onclick="openBulkModal()">' + ICON.bulk + '<span>Bulk Create</span></div>';
  html += '</div>';
  html += '<div class="sidebar-section"><div class="sidebar-section-label">Inboxes</div>';
  inboxes.forEach(function(ib) {
    html += '<div class="sidebar-item' + (ib.address === selectedInbox ? ' active' : '') + '" onclick="selectInbox(\'' + escapeHtml(ib.address) + '\')">' + ICON.inbox + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(ib.address) + '</span></div>';
  });
  html += '</div>';
  html += '</div>';
  html += '<div class="sidebar-footer"><button class="sidebar-footer-btn" onclick="openStatsModal()" title="Stats">' + ICON.stats + '</button><button class="sidebar-footer-btn" onclick="toggleTheme()" title="Theme" id="themeBtn">' + (document.body.classList.contains('light') ? ICON.sun : ICON.moon) + '</button></div>';
  html += '</div>';

  // Backdrop for mobile
  html += '<div class="backdrop" id="backdrop" onclick="closeSidebar()"></div>';

  // Main area
  html += '<div class="main-area">';
  // Topbar
  html += '<div class="topbar"><button class="topbar-menu-btn" onclick="openSidebar()">' + ICON.menu + '</button>';
  html += '<div class="topbar-search">' + ICON.search + '<input type="text" placeholder="Search..." id="searchInput" oninput="handleSearch(this.value)"></div>';
  html += '<div class="topbar-actions"><button class="topbar-btn" onclick="loadMessages()" title="Refresh">' + ICON.refresh + '</button>';
  if (selectedInbox) html += '<button class="topbar-btn" onclick="deleteInbox(\'' + escapeHtml(selectedInbox) + '\')" title="Delete">' + ICON.delete + '</button>';
  html += '</div></div>';

  // Content area
  html += '<div class="content-area">';
  // Inbox list pane
  html += '<div class="inbox-list-pane"><div class="inbox-list-header"><h2>Inboxes</h2><span class="inbox-list-count">' + inboxes.length + ' total</span></div>';
  html += '<div class="inbox-list" id="inboxList">';
  if (inboxes.length === 0) {
    html += '<div class="inbox-list-empty"><div class="icon">' + ICON.mail + '</div><div class="title">No Inboxes</div><div class="sub">Create one to get started</div></div>';
  } else {
    inboxes.forEach(function(ib) {
      html += '<div class="inbox-item' + (ib.address === selectedInbox ? ' active' : '') + '" onclick="selectInbox(\'' + escapeHtml(ib.address) + '\')">';
      html += '<div class="inbox-item-avatar">' + getInitial(ib.address) + '</div>';
      html += '<div class="inbox-item-info"><div class="inbox-item-address">' + escapeHtml(ib.address) + '</div>';
      html += '<div class="inbox-item-meta">' + (ib.last_email_at ? formatDate(ib.last_email_at) : 'No emails yet') + '</div></div>';
      html += '</div>';
    });
  }
  html += '</div></div>';

  // Reading pane
  html += '<div class="reading-pane" id="readingPane"><div class="reading-empty" id="readingEmpty"><div class="icon">' + ICON.empty + '</div><div class="title">No Message Selected</div><div class="sub">Select an inbox and a message to read</div></div></div>';
  html += '</div>'; // content-area
  html += '</div>'; // main-area
  html += '</div>'; // layout

  // Toast container
  html += '<div class="toast-container" id="toastContainer"></div>';

  app.innerHTML = html;
  renderMessages();
}

function renderMessages() {
  const list = $('inboxList');
  if (!list) return;
  let html = '';
  if (inboxes.length === 0) {
    html = '<div class="inbox-list-empty"><div class="icon">' + ICON.mail + '</div><div class="title">No Inboxes</div><div class="sub">Create one to get started</div></div>';
  } else {
    inboxes.forEach(function(ib) {
      const msgs = (selectedInbox === ib.address) ? messages : [];
      html += '<div class="inbox-item' + (ib.address === selectedInbox ? ' active' : '') + '" onclick="selectInbox(\'' + escapeHtml(ib.address) + '\')">';
      html += '<div class="inbox-item-avatar">' + getInitial(ib.address) + '</div>';
      html += '<div class="inbox-item-info"><div class="inbox-item-address">' + escapeHtml(ib.address) + '</div>';
      if (msgs.length > 0) {
        const last = msgs[0];
        html += '<div class="inbox-item-meta">' + escapeHtml(last.subject || '(no subject)') + ' - ' + formatDate(last.received_at) + '</div>';
      } else {
        html += '<div class="inbox-item-meta">' + (ib.last_email_at ? formatDate(ib.last_email_at) : 'No emails') + '</div>';
      }
      html += '</div>';
      if (msgs.length > 0) html += '<span class="inbox-item-badge">' + msgs.length + '</span>';
      html += '</div>';
    });
    // Render messages under selected inbox
    if (selectedInbox && messages.length > 0) {
      messages.forEach(function(msg) {
        html += '<div class="inbox-item' + (msg.id === selectedMessage ? ' active' : '') + '" onclick="openMessage(\'' + msg.id + '\')" style="padding-left:40px;">';
        html += '<div class="inbox-item-avatar" style="width:28px;height:28px;font-size:12px;">' + getInitial(msg.from_address) + '</div>';
        html += '<div class="inbox-item-info"><div class="inbox-item-address" style="font-size:13px;">' + escapeHtml(msg.from_name || msg.from_address) + '</div>';
        html += '<div class="inbox-item-meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(msg.subject) + (msg.otp_code ? ' - OTP: ' + msg.otp_code : '') + '</div></div>';
        html += '<div style="font-size:11px;color:var(--label-tertiary);white-space:nowrap;">' + formatDate(msg.received_at) + '</div>';
        html += '</div>';
      });
    }
  }
  list.innerHTML = html;
}

function renderReadingPane(msg) {
  const pane = $('readingPane');
  if (!pane) return;
  let html = '<div class="message-detail">';
  html += '<div class="message-detail-header">';
  // Back button for mobile
  html += '<button class="topbar-menu-btn" onclick="closeReadingPaneMobile()" style="display:flex;margin-bottom:8px;">' + ICON.back + '</button>';
  html += '<div class="message-detail-subject">' + escapeHtml(msg.subject) + '</div>';
  html += '<div class="message-detail-sender">';
  html += '<div class="sender-avatar">' + getInitial(msg.from_address) + '</div>';
  html += '<div class="sender-info"><div class="sender-name">' + escapeHtml(msg.from_name || msg.from_address) + '</div><div class="sender-email">' + escapeHtml(msg.from_address) + '</div></div>';
  html += '<div class="message-date">' + formatFullDate(msg.received_at) + '</div>';
  html += '</div></div>';
  // OTP bar
  if (msg.otp_code) {
    html += '<div class="message-otp-bar" onclick="navigator.clipboard.writeText(\'' + msg.otp_code + '\');showToast(\'OTP copied: ' + msg.otp_code + '\')">';
    html += '<div class="otp-icon">' + ICON.shield + '</div>';
    html += '<div class="otp-info"><div class="otp-label">Verification Code</div><div class="otp-code">' + msg.otp_code + '</div></div>';
    html += '<div class="otp-copy-hint">Tap to copy</div></div>';
  }
  // Attachments
  const atts = JSON.parse(msg.attachments || '[]');
  if (atts.length > 0) {
    html += '<div class="message-attachments"><div class="attachments-label">Attachments</div>';
    atts.forEach(function(a) { html += '<div class="attachment-chip">' + ICON.paperclip + escapeHtml(a.filename) + ' (' + formatSize(a.size) + ')</div>'; });
    html += '</div>';
  }
  // Body
  const content = msg.body_html || '<pre style="white-space:pre-wrap;padding:24px;font-family:inherit;">' + escapeHtml(msg.body_text) + '</pre>';
  html += '<div class="message-body"><iframe id="msgFrame" sandbox="allow-same-origin"></iframe></div>';
  html += '</div>';
  pane.innerHTML = html;
  const frame = $('msgFrame');
  if (frame) frame.srcdoc = content;
}

// ==================== Modals ====================
function openNewModal() {
  let domainOpts = (appConfig.mailDomains || [appConfig.mailDomain]).map(function(d) { return '<option value="' + d + '">@' + d + '</option>'; }).join('');
  showModal('<div class="modal-header"><div class="modal-title">New Inbox</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div class="form-group"><label>Username</label><input id="newLocalPart" placeholder="Custom or leave blank for random"></div>' +
    '<div class="form-group"><label>Domain</label><select id="newDomain">' + domainOpts + '</select></div>',
    '<button class="btn btn-secondary" onclick="createInbox(\'\',document.getElementById(\'newDomain\').value)">' + ICON.dice + ' Random</button>' +
    '<button class="btn btn-primary" onclick="createInbox(document.getElementById(\'newLocalPart\').value,document.getElementById(\'newDomain\').value)">' + ICON.sparkle + ' Create</button>'
  );
}

function openBulkModal() {
  let domainOpts = (appConfig.mailDomains || [appConfig.mailDomain]).map(function(d) { return '<option value="' + d + '">@' + d + '</option>'; }).join('');
  showModal('<div class="modal-header"><div class="modal-title">Bulk Create</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div class="form-row"><div class="form-group"><label>Count</label><input id="bulkCount" type="number" value="5" min="1" max="100"></div><div class="form-group"><label>Domain</label><select id="bulkDomain">' + domainOpts + '</select></div></div>' +
    '<textarea id="bulkResult" class="bulk-result hidden" readonly placeholder="Addresses will appear here..."></textarea>',
    '<button class="btn btn-secondary" onclick="copyBulkResult()">' + ICON.copy + ' Export</button>' +
    '<button class="btn btn-primary" onclick="createBulk()">' + ICON.bulk + ' Create Bulk</button>'
  );
}

function openSettingsModal() {
  showModal('<div class="modal-header"><div class="modal-title">Inbox Settings</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div class="form-group"><label>Webhook URL</label><input id="setWebhook" placeholder="https://example.com/webhook"></div>' +
    '<div class="form-group"><label>Telegram Chat ID</label><input id="setTelegram" placeholder="123456789"></div>',
    '<button class="btn btn-primary" onclick="saveSettings()">' + ICON.save + ' Save Settings</button>'
  );
  fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/settings').then(function(s) {
    if ($('setWebhook')) $('setWebhook').value = s.webhook_url || '';
    if ($('setTelegram')) $('setTelegram').value = s.telegram_chat_id || '';
  });
}

async function openStatsModal() {
  showModal('<div class="modal-header"><div class="modal-title">Statistics</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div id="statsContent">Loading...</div>', ''
  );
  const html = await loadStats();
  const c = $('statsContent');
  if (c) c.innerHTML = html;
}

function showModal(headerHtml, bodyHtml, footerHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = '<div class="modal">' + headerHtml + '<div class="modal-body">' + bodyHtml + '</div>' + (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') + '</div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  const o = $('modalOverlay');
  if (o) o.remove();
}

function copyBulkResult() {
  const t = $('bulkResult');
  if (!t || !t.value) { showToast('No addresses to export'); return; }
  navigator.clipboard.writeText(t.value);
  showToast('Copied ' + t.value.split('\n').length + ' addresses');
}

// ==================== Navigation ====================
async function selectInbox(addr) {
  selectedInbox = addr;
  selectedMessage = null;
  render();
  await loadMessages();
  closeSidebar();
}

function handleSearch(q) {
  // Simple client-side filter
  const items = document.querySelectorAll('.inbox-item');
  q = q.toLowerCase();
  items.forEach(function(item) {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(q) ? '' : 'none';
  });
}

function toggleTheme() {
  const current = localStorage.getItem('xmail_theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
  render();
}

// Mobile sidebar
function openSidebar() {
  const s = $('sidebar'); const b = $('backdrop');
  if (s) s.classList.add('open');
  if (b) b.classList.add('visible');
}
function closeSidebar() {
  const s = $('sidebar'); const b = $('backdrop');
  if (s) s.classList.remove('open');
  if (b) b.classList.remove('visible');
}

// Mobile reading pane
function openReadingPaneMobile() {
  const r = $('readingPane');
  if (r && window.innerWidth <= 768) r.classList.add('open');
}
function closeReadingPaneMobile() {
  const r = $('readingPane');
  if (r) r.classList.remove('open');
}

// Expose to global
window.createInbox = createInbox;
window.createBulk = createBulk;
window.deleteInbox = deleteInbox;
window.saveSettings = saveSettings;
window.openNewModal = openNewModal;
window.openBulkModal = openBulkModal;
window.openSettingsModal = openSettingsModal;
window.openStatsModal = openStatsModal;
window.closeModal = closeModal;
window.copyBulkResult = copyBulkResult;
window.selectInbox = selectInbox;
window.openMessage = openMessage;
window.handleSearch = handleSearch;
window.toggleTheme = toggleTheme;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.closeReadingPaneMobile = closeReadingPaneMobile;
window.loadMessages = loadMessages;

// Start
init().catch(function(err) {
  console.error(err);
  app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;color:#8e8e93;"><div style="font-size:17px;font-weight:600;margin-bottom:6px;">Connection Error</div><div style="font-size:14px;">' + escapeHtml(err.message) + '</div></div>';
});
