const $ = (id) => document.getElementById(id);
const app = $('app');

let appConfig = { appName: 'XMail', mailDomain: 'kilo.web.id', mailDomains: ['kilo.web.id'], webHost: '', authRequired: false };
const SESSION_KEY = 'xmail_session_id';
const ADMIN_KEY_KEY = 'xmail_admin_key';
let sessionId = localStorage.getItem(SESSION_KEY) || '';
let currentApiKey = localStorage.getItem('xmail_api_key') || '';
let adminKey = localStorage.getItem(ADMIN_KEY_KEY) || '';
let inboxes = [];
let selectedInbox = null;
let messages = [];
let selectedMessage = null;
let mailDomains = [];

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
  star: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFilled: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  export: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  forward: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>',
  label: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  health: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  qr: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21v.01M21 21v.01M17 21h4v-4"/></svg>',
  clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  shieldOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.7 14A6.9 6.9 0 0 0 19 11V8a7 7 0 0 0-14 0v3a6.9 6.9 0 0 0-.7 3"/><path d="M2 2l20 20"/><path d="M5 8a7 7 0 0 0 7 7"/></svg>',
  admin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>',
  telegram: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
  download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
};

// ==================== API ====================
async function fetchJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (sessionId) headers['x-session-id'] = sessionId;
  if (currentApiKey) headers['x-api-key'] = currentApiKey;
  if (adminKey) headers['x-admin-key'] = adminKey;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str || '').replace(/'/g, "\\'");
}

function formatDate(dt) {
  const d = new Date(dt.includes('T') ? dt : dt.replace(' ', 'T'));
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800) return d.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dt) {
  const d = new Date(dt.includes('T') ? dt : dt.replace(' ', 'T'));
  return d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function getInitial(addr) {
  return (addr || '?')[0].toUpperCase();
}

function avatarColor(str) {
  const colors = ['#e57373', '#ba68c8', '#7986cb', '#4fc3f7', '#4db6ac', '#aed581', '#ffb74d', '#a1887f', '#90a4ae', '#f06292', '#64b5f6', '#81c784'];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function showToast(text) {
  let tc = $('toastContainer');
  if (!tc) { tc = document.createElement('div'); tc.id = 'toastContainer'; tc.className = 'toast-container'; document.body.appendChild(tc); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = ICON.check + escapeHtml(text);
  tc.appendChild(el);
  setTimeout(() => { el.classList.add('fadeout'); setTimeout(() => el.remove(), 200); }, 2000);
}

// ==================== Init ====================
async function init() {
  applyTheme(localStorage.getItem('xmail_theme') || 'dark');
  appConfig = await fetchJson('/api/config');
  document.title = appConfig.appName;
  mailDomains = appConfig.mailDomains || [appConfig.mailDomain];
  let sid = await fetchJson('/api/session');
  sessionId = sid.sessionId;
  localStorage.setItem(SESSION_KEY, sessionId);
  await loadInboxes();
  render();
}

async function loadInboxes() {
  inboxes = await fetchJson('/api/inboxes');
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
  const domain = $('bulkDomain') ? $('bulkDomain').value : mailDomains[0];
  const res = await fetchJson('/api/inboxes/bulk', { method: 'POST', body: JSON.stringify({ count, domain }) });
  if ($('bulkResult')) { $('bulkResult').value = res.addresses.join('\n'); $('bulkResult').classList.remove('hidden'); }
  await loadInboxes();
  render();
  showToast(res.count + ' inboxes created');
}

async function deleteInbox(addr) {
  await fetchJson('/api/inboxes/' + encodeURIComponent(addr) + '?purge=1', { method: 'DELETE' });
  if (selectedInbox === addr) { selectedInbox = null; messages = []; selectedMessage = null; }
  await loadInboxes();
  render();
  showToast('Inbox deleted');
}

async function deleteMessage(msgId) {
  await fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/messages/' + msgId, { method: 'DELETE' });
  await loadMessages();
  closeReadingPaneMobile();
  render();
  showToast('Message deleted');
}

async function toggleStar(msgId) {
  const res = await fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/messages/' + msgId + '/star', { method: 'PUT' });
  await loadMessages();
  showToast(res.is_starred ? 'Starred' : 'Unstarred');
}

async function saveSettings() {
  const wh = $('setWebhook').value.trim();
  const tg = $('setTelegram').value.trim();
  const fw = $('setForward').value.trim();
  await fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/settings', {
    method: 'PUT',
    body: JSON.stringify({ webhook_url: wh || null, telegram_chat_id: tg || null, forward_to: fw || null })
  });
  closeModal();
  showToast('Settings saved');
}

async function saveLabel() {
  const label = $('setLabel').value.trim();
  await fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/label', {
    method: 'PUT', body: JSON.stringify({ label })
  });
  await loadInboxes();
  closeModal();
  render();
  showToast('Label saved');
}

async function exportInboxes() {
  const text = await fetch('/api/export', { headers: { 'x-session-id': sessionId } }).then(r => r.text());
  navigator.clipboard.writeText(text);
  showToast('Exported ' + text.split('\n').length + ' addresses');
}

async function addDomain() {
  const domain = $('newDomainInput').value.trim().toLowerCase();
  if (!domain) { showToast('Domain required'); return; }
  try {
    await fetchJson('/api/domains', { method: 'POST', body: JSON.stringify({ domain }) });
    appConfig = await fetchJson('/api/config');
    mailDomains = appConfig.mailDomains || [];
    closeModal();
    showToast('Domain added: ' + domain);
    render();
  } catch(e) { showToast('Error: ' + e.message); }
}

async function removeDomain(domain) {
  try {
    await fetchJson('/api/domains/' + encodeURIComponent(domain), { method: 'DELETE' });
    appConfig = await fetchJson('/api/config');
    mailDomains = appConfig.mailDomains || [];
    showToast('Domain removed: ' + domain);
    openDomainsModal();
  } catch(e) { showToast('Error: ' + e.message); }
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
  html += '<button class="sidebar-compose" onclick="openNewModal()">' + ICON.compose + ' New Inbox</button>';
  html += '<div class="sidebar-content">';
  html += '<div class="sidebar-section"><div class="sidebar-section-label">Actions</div>';
  html += '<div class="sidebar-item" onclick="openBulkModal()">' + ICON.bulk + '<span>Bulk Create</span></div>';
  html += '<div class="sidebar-item" onclick="exportInboxes()">' + ICON.export + '<span>Export All</span></div>';
  html += '<div class="sidebar-item" onclick="openClaimModal()">' + ICON.inbox + '<span>Reclaim Inbox</span></div>';
  html += '<div class="sidebar-item" onclick="openDomainsModal()">' + ICON.globe + '<span>Domains</span></div>';
  html += '<div class="sidebar-item" onclick="openBlocklistModal()">' + ICON.shieldOff + '<span>Blocklist</span></div>';
  html += '</div>';
  html += '<div class="sidebar-section"><div class="sidebar-section-label">Inboxes (' + inboxes.length + ')</div>';
  inboxes.forEach(function(ib) {
    const isActive = ib.address === selectedInbox;
    html += '<div class="sidebar-item' + (isActive ? ' active' : '') + '" onclick="selectInbox(\'' + escapeAttr(ib.address) + '\')">' + ICON.inbox + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(ib.label || ib.address) + '</span></div>';
  });
  html += '</div>';
  html += '</div>';
  html += '<div class="sidebar-footer"><button class="sidebar-footer-btn" onclick="openStatsModal()" title="Stats">' + ICON.stats + '</button><button class="sidebar-footer-btn" onclick="openSettingsModal()" title="Inbox Settings">' + ICON.settings + '</button><button class="sidebar-footer-btn" onclick="openAdminModal()" title="Admin Panel">' + ICON.admin + '</button><button class="sidebar-footer-btn" onclick="toggleTheme()" title="Theme">' + (document.body.classList.contains('light') ? ICON.sun : ICON.moon) + '</button></div>';
  html += '</div>';

  // Backdrop
  html += '<div class="backdrop" id="backdrop" onclick="closeSidebar()"></div>';

  // Main area
  html += '<div class="main-area">';
  html += '<div class="topbar"><button class="topbar-menu-btn" onclick="openSidebar()">' + ICON.menu + '</button>';
  html += '<div class="topbar-search">' + ICON.search + '<input type="text" placeholder="Search messages..." id="searchInput" oninput="handleSearch(this.value)"></div>';
  html += '<div class="topbar-actions"><button class="topbar-btn" onclick="loadMessages()" title="Refresh">' + ICON.refresh + '</button>';
  if (selectedInbox) {
    html += '<button class="topbar-btn" onclick="openLabelModal()" title="Label">' + ICON.label + '</button>';
    html += '<button class="topbar-btn" onclick="openTTLModal()" title="Set TTL">' + ICON.clock + '</button>';
    html += '<button class="topbar-btn" onclick="openQRModal()" title="QR Code">' + ICON.qr + '</button>';
    html += '<button class="topbar-btn" onclick="deleteInbox(\'' + escapeAttr(selectedInbox) + '\')" title="Delete Inbox">' + ICON.delete + '</button>';
  }
  html += '</div></div>';

  // Content area
  html += '<div class="content-area">';
  // Inbox list
  html += '<div class="inbox-list-pane"><div class="inbox-list-header"><h2>Inboxes</h2><span class="inbox-list-count">' + inboxes.length + ' total</span></div>';
  html += '<div class="inbox-list" id="inboxList"></div></div>';
  // Reading pane
  html += '<div class="reading-pane" id="readingPane"><div class="reading-empty"><div class="icon">' + ICON.empty + '</div><div class="title">No Message Selected</div><div class="sub">Select a message to read</div></div></div>';
  html += '</div></div></div>';
  html += '<div class="toast-container" id="toastContainer"></div>';

  app.innerHTML = html;
  renderInboxList();
  renderMessages();
}

function renderInboxList() {
  const list = $('inboxList');
  if (!list) return;
  let html = '';
  if (inboxes.length === 0) {
    html = '<div class="inbox-list-empty"><div class="icon">' + ICON.mail + '</div><div class="title">No Inboxes</div><div class="sub">Create one to get started</div></div>';
  } else {
    inboxes.forEach(function(ib) {
      const isActive = ib.address === selectedInbox;
      html += '<div class="inbox-item' + (isActive ? ' active' : '') + '" onclick="selectInbox(\'' + escapeAttr(ib.address) + '\')">';
      html += '<div class="inbox-item-avatar">' + getInitial(ib.label || ib.address) + '</div>';
      html += '<div class="inbox-item-info"><div class="inbox-item-address">' + escapeHtml(ib.label || ib.address) + '</div>';
      html += '<div class="inbox-item-meta">' + (ib.last_email_at ? formatDate(ib.last_email_at) : 'No emails') + '</div></div>';
      html += '</div>';
    });
    if (selectedInbox && messages.length > 0) {
      html += '<div style="padding:4px 16px;font-size:11px;font-weight:600;color:var(--label-tertiary);text-transform:uppercase;letter-spacing:0.5px;">Messages (' + messages.length + ')</div>';
      messages.forEach(function(msg) {
        const isActive = msg.id === selectedMessage;
        html += '<div class="inbox-item' + (isActive ? ' active' : '') + '" onclick="openMessage(\'' + msg.id + '\')" style="padding-left:32px;">';
        html += '<div class="inbox-item-avatar" style="width:28px;height:28px;font-size:11px;">' + getInitial(msg.from_address) + '</div>';
        html += '<div class="inbox-item-info"><div class="inbox-item-address" style="font-size:13px;font-weight:' + (msg.is_read ? '400' : '600') + ';">' + escapeHtml(msg.from_name || msg.from_address) + '</div>';
        html += '<div class="inbox-item-meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (msg.is_starred ? ICON.starFilled + ' ' : '') + escapeHtml(msg.subject) + (msg.otp_code ? ' - OTP:' + msg.otp_code : '') + '</div></div>';
        html += '<div style="font-size:11px;color:var(--label-tertiary);white-space:nowrap;">' + formatDate(msg.received_at) + '</div>';
        html += '</div>';
      });
    }
  }
  list.innerHTML = html;
}

function renderMessages() {
  renderInboxList();
}

function renderReadingPane(msg) {
  const pane = $('readingPane');
  if (!pane) return;
  const senderName = msg.from_name || msg.from_address;
  const color = avatarColor(msg.from_address);
  let html = '<div class="message-detail" style="border:1px solid var(--border);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;height:100%;display:flex;flex-direction:column;">';
  // Action bar
  html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--bg-elevated);flex-shrink:0;">';
  html += '<button class="topbar-menu-btn" onclick="closeReadingPaneMobile()" style="display:flex;">' + ICON.back + '</button>';
  html += '<div style="flex:1;"></div>';
  html += '<button class="topbar-btn" onclick="toggleStar(\'' + msg.id + '\')" title="Star" style="color:' + (msg.is_starred ? 'var(--yellow,#f5a623)' : '') + ';">' + (msg.is_starred ? ICON.starFilled : ICON.star) + '</button>';
  html += '<button class="topbar-btn" onclick="downloadEml(\'' + msg.id + '\')" title="Download .eml">' + ICON.download + '</button>';
  html += '<button class="topbar-btn" onclick="deleteMessage(\'' + msg.id + '\')" title="Delete" style="color:var(--red,#ff3b30);">' + ICON.delete + '</button>';
  html += '</div>';
  // Scrollable content
  html += '<div style="overflow-y:auto;flex:1;">';
  // Subject
  html += '<div style="padding:20px 24px 12px;"><div style="font-size:22px;font-weight:700;line-height:1.3;">' + escapeHtml(msg.subject) + '</div></div>';
  // Sender row
  html += '<div style="display:flex;align-items:center;gap:12px;padding:0 24px 16px;">';
  html += '<div style="width:40px;height:40px;border-radius:50%;background:' + color + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;flex-shrink:0;">' + getInitial(senderName) + '</div>';
  html += '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;">' + escapeHtml(senderName) + '</div><div style="font-size:13px;color:var(--label-tertiary);">' + escapeHtml(msg.from_address) + '</div></div>';
  html += '<div style="font-size:12px;color:var(--label-tertiary);text-align:right;white-space:nowrap;">' + formatFullDate(msg.received_at) + '</div>';
  html += '</div>';
  // OTP bar
  if (msg.otp_code) {
    html += '<div style="margin:0 24px 16px;padding:14px 16px;border-radius:10px;background:rgba(0,122,255,0.08);border:1px solid rgba(0,122,255,0.2);display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="navigator.clipboard.writeText(\'' + msg.otp_code + '\');showToast(\'OTP copied: ' + msg.otp_code + '\')">';
    html += '<div style="color:var(--blue,#007aff);flex-shrink:0;">' + ICON.shield + '</div>';
    html += '<div style="flex:1;"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--label-tertiary);">Verification Code</div><div style="font-size:24px;font-family:monospace;font-weight:700;letter-spacing:3px;color:var(--blue,#007aff);">' + msg.otp_code + '</div></div>';
    html += '<div style="font-size:11px;color:var(--label-tertiary);display:flex;align-items:center;gap:4px;">' + ICON.copy + ' Tap to copy</div>';
    html += '</div>';
  }
  // Attachments
  const atts = JSON.parse(msg.attachments || '[]');
  if (atts.length > 0) {
    html += '<div style="margin:0 24px 16px;"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--label-tertiary);margin-bottom:8px;">Attachments</div><div style="display:flex;flex-wrap:wrap;gap:8px;">';
    atts.forEach(function(a) {
      html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;background:var(--bg-elevated);border:1px solid var(--border);font-size:13px;">' + ICON.paperclip + escapeHtml(a.filename) + ' <span style="color:var(--label-tertiary);">' + formatSize(a.size) + '</span></div>';
    });
    html += '</div></div>';
  }
  // Body
  const content = msg.body_html || '<pre style="white-space:pre-wrap;padding:24px;font-family:inherit;margin:0;">' + escapeHtml(msg.body_text) + '</pre>';
  html += '<div style="margin:0 24px 24px;padding:20px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid var(--border);min-height:200px;"><iframe id="msgFrame" sandbox="allow-same-origin" style="width:100%;border:none;min-height:300px;"></iframe></div>';
  html += '</div></div>';
  pane.innerHTML = html;
  const frame = $('msgFrame');
  if (frame) frame.srcdoc = content;
}

// ==================== Modals ====================
function showModal(headerHtml, bodyHtml, footerHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = '<div class="modal">' + headerHtml + '<div class="modal-body">' + bodyHtml + '</div>' + (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') + '</div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() { const o = $('modalOverlay'); if (o) o.remove(); }

function openNewModal() {
  let domainOpts = mailDomains.map(function(d) { return '<option value="' + d + '">@' + d + '</option>'; }).join('');
  showModal(
    '<div class="modal-header"><div class="modal-title">New Inbox</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div class="form-group"><label>Username</label><input id="newLocalPart" placeholder="Custom or leave blank for random"></div><div class="form-group"><label>Domain</label><select id="newDomain">' + domainOpts + '</select></div>',
    '<button class="btn btn-secondary" onclick="createInbox(\'\',document.getElementById(\'newDomain\').value)">' + ICON.dice + ' Random</button><button class="btn btn-primary" onclick="createInbox(document.getElementById(\'newLocalPart\').value,document.getElementById(\'newDomain\').value)">' + ICON.sparkle + ' Create</button>'
  );
}

function openBulkModal() {
  let domainOpts = mailDomains.map(function(d) { return '<option value="' + d + '">@' + d + '</option>'; }).join('');
  showModal(
    '<div class="modal-header"><div class="modal-title">Bulk Create</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div class="form-row"><div class="form-group"><label>Count</label><input id="bulkCount" type="number" value="5" min="1" max="100"></div><div class="form-group"><label>Domain</label><select id="bulkDomain">' + domainOpts + '</select></div></div><textarea id="bulkResult" class="bulk-result hidden" readonly placeholder="Addresses will appear here..."></textarea>',
    '<button class="btn btn-secondary" onclick="copyBulkResult()">' + ICON.copy + ' Export</button><button class="btn btn-primary" onclick="createBulk()">' + ICON.bulk + ' Create Bulk</button>'
  );
}

function openSettingsModal() {
  if (!selectedInbox) { showToast('Select an inbox first'); return; }
  showModal(
    '<div class="modal-header"><div class="modal-title">Inbox Settings</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div class="form-group"><label>Webhook URL</label><input id="setWebhook" placeholder="https://example.com/webhook"></div><div class="form-group"><label>Telegram Chat ID</label><input id="setTelegram" placeholder="123456789"></div><div class="form-group"><label>Forward To</label><input id="setForward" placeholder="real@email.com"></div>',
    '<button class="btn btn-primary" onclick="saveSettings()">' + ICON.save + ' Save Settings</button>'
  );
  fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/settings').then(function(s) {
    if ($('setWebhook')) $('setWebhook').value = s.webhook_url || '';
    if ($('setTelegram')) $('setTelegram').value = s.telegram_chat_id || '';
    if ($('setForward')) $('setForward').value = s.forward_to || '';
  });
}

function openLabelModal() {
  if (!selectedInbox) return;
  const ib = inboxes.find(function(i) { return i.address === selectedInbox; });
  showModal(
    '<div class="modal-header"><div class="modal-title">Inbox Label</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div class="form-group"><label>Label</label><input id="setLabel" placeholder="e.g. Gmail Bot" value="' + escapeHtml(ib?.label || '') + '"></div>',
    '<button class="btn btn-primary" onclick="saveLabel()">' + ICON.save + ' Save Label</button>'
  );
}

function openDomainsModal() {
  let domainList = mailDomains.map(function(d) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;background:var(--bg-elevated);margin-bottom:6px;">' +
      '<span style="font-size:14px;font-weight:500;">' + escapeHtml(d) + '</span>' +
      '<button class="topbar-btn" onclick="removeDomain(\'' + escapeAttr(d) + '\')" title="Remove" style="width:28px;height:28px;color:var(--red);">' + ICON.close + '</button></div>';
  }).join('');
  showModal(
    '<div class="modal-header"><div class="modal-title">Manage Domains</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div style="margin-bottom:16px;">' + domainList + '</div><div class="form-group"><label>Add New Domain</label><div style="display:flex;gap:8px;"><input id="newDomainInput" placeholder="example.com" style="flex:1;"><button class="btn btn-primary" onclick="addDomain()" style="padding:12px 16px;">' + ICON.compose + '</button></div></div><p style="font-size:12px;color:var(--label-tertiary);">Note: Domain must have Cloudflare Email Routing enabled with catch-all set to the xmail worker.</p>',
    ''
  );
}

async function openStatsModal() {
  showModal('<div class="modal-header"><div class="modal-title">Statistics</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>', '<div id="statsContent">Loading...</div>', '');
  const html = await loadStats();
  const c = $('statsContent');
  if (c) c.innerHTML = html;
}

function openQRModal() {
  if (!selectedInbox) { showToast('Select an inbox first'); return; }
  const dark = !document.body.classList.contains('light');
  const qrUrl = '/api/inboxes/' + encodeURIComponent(selectedInbox) + '/qr?dark=' + (dark ? '1' : '0');
  showModal(
    '<div class="modal-header"><div class="modal-title">QR Code</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div style="text-align:center;padding:8px 0;"><div id="qrContainer" style="display:inline-flex;align-items:center;justify-content:center;padding:16px;background:' + (dark ? '#fff' : '#000') + ';border-radius:16px;margin-bottom:16px;min-width:252px;min-height:252px;"><span style="color:#888;font-size:13px;">Loading...</span></div><div style="font-size:16px;font-weight:600;margin-bottom:4px;word-break:break-all;">' + escapeHtml(selectedInbox) + '</div><div style="font-size:13px;color:var(--label-tertiary);">Scan to copy address</div></div>',
    '<button class="btn btn-primary" onclick="navigator.clipboard.writeText(\'' + escapeAttr(selectedInbox) + '\');showToast(\'Address copied\')">' + ICON.copy + ' Copy Address</button>'
  );
  fetch(qrUrl, { headers: { 'x-session-id': sessionId } }).then(function(r) { return r.text(); }).then(function(svg) {
    const c = $('qrContainer');
    if (c) c.innerHTML = svg;
  }).catch(function() {
    const c = $('qrContainer');
    if (c) c.innerHTML = '<span style="color:#f00;font-size:13px;">Failed to load QR</span>';
  });
}

function openTTLModal() {
  if (!selectedInbox) return;
  const ib = inboxes.find(function(i) { return i.address === selectedInbox; });
  let currentTTL = '24';
  if (ib && ib.expires_at) {
    const diff = (new Date(ib.expires_at.replace(' ', 'T')) - new Date()) / 3600000;
    currentTTL = Math.max(1, Math.round(diff)).toString();
  }
  showModal(
    '<div class="modal-header"><div class="modal-title">Set Expiry (TTL)</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div class="form-group"><label>Expiry (hours)</label><input id="ttlInput" type="number" value="' + currentTTL + '" min="1" max="720"></div><p style="font-size:12px;color:var(--label-tertiary);">0 = never expire. Max 720 hours (30 days). Inbox auto-deletes after this time.</p>',
    '<button class="btn btn-primary" onclick="saveTTL()">' + ICON.clock + ' Set TTL</button>'
  );
}

async function saveTTL() {
  const hours = parseInt($('ttlInput').value) || 0;
  await fetchJson('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/ttl', { method: 'PUT', body: JSON.stringify({ hours }) });
  closeModal();
  showToast('TTL set to ' + (hours || 'never') + ' hours');
  await loadInboxes();
  render();
}

async function openBlocklistModal() {
  showModal('<div class="modal-header"><div class="modal-title">Blocklist (Spam Filter)</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>', '<div id="blocklistContent">Loading...</div>', '');
  try {
    const entries = await fetchJson('/api/blocklist');
    let listHtml = '';
    if (entries.length === 0) {
      listHtml = '<div style="text-align:center;padding:24px;color:var(--label-tertiary);">No blocklist entries</div>';
    } else {
      listHtml = entries.map(function(e) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;background:var(--bg-elevated);margin-bottom:6px;"><div><div style="font-size:14px;font-weight:500;">' + escapeHtml(e.pattern) + '</div><div style="font-size:11px;color:var(--label-tertiary);">' + escapeHtml(e.match_type) + ' / ' + escapeHtml(e.scope) + '</div></div><button class="topbar-btn" onclick="removeBlocklist(' + e.id + ')" title="Remove" style="width:28px;height:28px;color:var(--red);">' + ICON.close + '</button></div>';
      }).join('');
    }
    const c = $('blocklistContent');
    if (c) c.innerHTML = listHtml + '<div class="form-group" style="margin-top:16px;"><label>Pattern</label><input id="blPattern" placeholder="*@spam.com or keyword"></div><div class="form-row"><div class="form-group"><label>Match Type</label><select id="blType"><option value="sender">Sender (email)</option><option value="domain">Domain</option><option value="subject">Subject contains</option></select></div><div class="form-group"><label>Scope</label><select id="blScope"><option value="global">Global (all inboxes)</option>' + (selectedInbox ? '<option value="' + escapeAttr(selectedInbox) + '">This inbox only</option>' : '') + '</select></div></div><button class="btn btn-primary" onclick="addBlocklist()" style="width:100%;">' + ICON.shieldOff + ' Add Block Rule</button>';
  } catch(e) {
    const c = $('blocklistContent');
    if (c) c.innerHTML = '<div style="text-align:center;padding:24px;color:var(--label-tertiary);">API key required to view blocklist</div>';
  }
}

async function addBlocklist() {
  const pattern = $('blPattern').value.trim();
  const matchType = $('blType').value;
  const scope = $('blScope').value;
  if (!pattern) { showToast('Pattern required'); return; }
  try {
    await fetchJson('/api/blocklist', { method: 'POST', body: JSON.stringify({ pattern, match_type: matchType, scope }) });
    showToast('Block rule added');
    openBlocklistModal();
  } catch(e) { showToast('Error: ' + e.message); }
}

async function removeBlocklist(id) {
  try {
    await fetchJson('/api/blocklist/' + id, { method: 'DELETE' });
    showToast('Block rule removed');
    openBlocklistModal();
  } catch(e) { showToast('Error: ' + e.message); }
}

function copyBulkResult() {
  const t = $('bulkResult');
  if (!t || !t.value) { showToast('No addresses to export'); return; }
  navigator.clipboard.writeText(t.value);
  showToast('Copied ' + t.value.split('\n').length + ' addresses');
}

// ==================== Admin Panel ====================
async function openAdminModal() {
  if (!adminKey) {
    showModal(
      '<div class="modal-header"><div class="modal-title">Admin Access</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
      '<div class="form-group"><label>Admin Key</label><input id="adminKeyInput" type="password" placeholder="Enter admin API key" onkeydown="if(event.key===\'Enter\')setAdminKey()"></div><p style="font-size:12px;color:var(--label-tertiary);">Enter your admin key to access server settings.</p>',
      '<button class="btn btn-primary" onclick="setAdminKey()">' + ICON.shield + ' Continue</button>'
    );
    return;
  }
  await loadAdminSettings();
}

function setAdminKey() {
  const key = $('adminKeyInput').value.trim();
  if (!key) { showToast('Key required'); return; }
  adminKey = key;
  localStorage.setItem(ADMIN_KEY_KEY, key);
  closeModal();
  openAdminModal();
}

async function loadAdminSettings() {
  showModal(
    '<div class="modal-header"><div class="modal-title">Admin Panel</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div id="adminContent" style="min-height:200px;">Loading...</div>',
    ''
  );
  try {
    const res = await fetch('/api/admin/settings', { headers: { 'x-api-key': adminKey } });
    if (!res.ok) throw new Error(await res.text());
    const settings = await res.json();
    renderAdminTabs(settings);
  } catch(e) {
    const c = $('adminContent');
    if (c) c.innerHTML = '<div style="text-align:center;padding:24px;color:var(--red,#ff3b30);">Error: ' + escapeHtml(e.message) + '</div><div style="text-align:center;"><button class="btn btn-secondary" onclick="adminKey=\'\';localStorage.removeItem(\'' + ADMIN_KEY_KEY + '\');closeModal();openAdminModal();">Reset Key</button></div>';
  }
}

function renderAdminTabs(settings) {
  const s = settings || {};
  const c = $('adminContent');
  if (!c) return;
  const tabStyle = 'padding:8px 16px;border:none;background:none;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;color:var(--label-secondary);';
  const tabActive = 'padding:8px 16px;border:none;background:none;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--accent);';
  let html = '<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:16px;">';
  html += '<button onclick="switchAdminTab(0)" id="atab0" style="' + tabActive + '">General</button>';
  html += '<button onclick="switchAdminTab(1)" id="atab1" style="' + tabStyle + '">Security</button>';
  html += '<button onclick="switchAdminTab(2)" id="atab2" style="' + tabStyle + '">' + ICON.telegram + ' Telegram</button>';
  html += '<button onclick="switchAdminTab(3)" id="atab3" style="' + tabStyle + '">Webhooks</button>';
  html += '</div>';
  // General
  html += '<div id="apanel0"><div class="form-group"><label>App Name</label><input id="adm_app_name" value="' + escapeAttr(s.app_name || '') + '"></div>';
  html += '<div class="form-group"><label>Auto Expiry (hours)</label><input id="adm_auto_expiry_hours" type="number" value="' + escapeAttr(String(s.auto_expiry_hours || '')) + '"></div>';
  html += '<div class="form-group"><label>Max Messages Per Inbox</label><input id="adm_max_messages_per_inbox" type="number" value="' + escapeAttr(String(s.max_messages_per_inbox || '')) + '"></div></div>';
  // Security
  html += '<div id="apanel1" style="display:none;"><div class="form-group"><label>API Keys (comma-separated)</label><textarea id="adm_api_keys" rows="3" style="font-family:monospace;font-size:12px;" placeholder="key1, key2">' + escapeHtml(Array.isArray(s.api_keys) ? s.api_keys.join(', ') : (s.api_keys || '')) + '</textarea></div>';
  html += '<div class="form-group"><label>Admin Keys (comma-separated)</label><textarea id="adm_admin_keys" rows="3" style="font-family:monospace;font-size:12px;" placeholder="key1, key2">' + escapeHtml(Array.isArray(s.admin_keys) ? s.admin_keys.join(', ') : (s.admin_keys || '')) + '</textarea></div></div>';
  // Telegram
  html += '<div id="apanel2" style="display:none;"><div class="form-group"><label>Telegram Bot Token</label><input id="adm_tg_bot_token" value="' + escapeAttr(s.tg_bot_token || '') + '" placeholder="123456:ABC-DEF..."></div>';
  html += '<button class="btn btn-secondary" onclick="setupTgWebhook()" style="margin-top:4px;">' + ICON.telegram + ' Setup Webhook</button>';
  html += '<p style="font-size:12px;color:var(--label-tertiary);margin-top:8px;">Sets the Telegram webhook to receive incoming messages on this worker.</p></div>';
  // Webhooks
  html += '<div id="apanel3" style="display:none;"><div class="form-group"><label>Webhook Secret</label><input id="adm_webhook_secret" value="' + escapeAttr(s.webhook_secret || '') + '" placeholder="Secret for webhook verification"></div></div>';
  // Save
  html += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);"><button class="btn btn-primary" onclick="saveAdminSettings()">' + ICON.save + ' Save Settings</button></div>';
  c.innerHTML = html;
}

function switchAdminTab(idx) {
  for (let i = 0; i < 4; i++) {
    const p = $('apanel' + i);
    const t = $('atab' + i);
    if (p) p.style.display = i === idx ? '' : 'none';
    if (t) { t.style.borderBottom = i === idx ? '2px solid var(--accent)' : '2px solid transparent'; t.style.color = i === idx ? 'var(--accent)' : 'var(--label-secondary)'; }
  }
}

async function saveAdminSettings() {
  const payload = {
    app_name: $('adm_app_name') ? $('adm_app_name').value.trim() : '',
    auto_expiry_hours: $('adm_auto_expiry_hours') ? parseInt($('adm_auto_expiry_hours').value) || 0 : 0,
    max_messages_per_inbox: $('adm_max_messages_per_inbox') ? parseInt($('adm_max_messages_per_inbox').value) || 0 : 0,
    api_keys: $('adm_api_keys') ? $('adm_api_keys').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [],
    admin_keys: $('adm_admin_keys') ? $('adm_admin_keys').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [],
    tg_bot_token: $('adm_tg_bot_token') ? $('adm_tg_bot_token').value.trim() : '',
    webhook_secret: $('adm_webhook_secret') ? $('adm_webhook_secret').value.trim() : ''
  };
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-api-key': adminKey },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    showToast('Settings saved');
    closeModal();
    appConfig = await fetchJson('/api/config');
    render();
  } catch(e) { showToast('Error: ' + e.message); }
}

async function setupTgWebhook() {
  try {
    const res = await fetch('/api/admin/tg/setup', { method: 'POST', headers: { 'x-api-key': adminKey } });
    if (!res.ok) throw new Error(await res.text());
    showToast('Telegram webhook setup complete');
  } catch(e) { showToast('Error: ' + e.message); }
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

function openSidebar() { const s = $('sidebar'); const b = $('backdrop'); if (s) s.classList.add('open'); if (b) b.classList.add('visible'); }
function closeSidebar() { const s = $('sidebar'); const b = $('backdrop'); if (s) s.classList.remove('open'); if (b) b.classList.remove('visible'); }
function openReadingPaneMobile() { const r = $('readingPane'); if (r && window.innerWidth <= 768) r.classList.add('open'); }
function closeReadingPaneMobile() { const r = $('readingPane'); if (r) r.classList.remove('open'); }

// Expose
window.createInbox = createInbox;
window.createBulk = createBulk;
window.deleteInbox = deleteInbox;
window.deleteMessage = deleteMessage;
window.toggleStar = toggleStar;
window.saveSettings = saveSettings;
window.saveLabel = saveLabel;
window.exportInboxes = exportInboxes;
window.addDomain = addDomain;
window.removeDomain = removeDomain;
window.openNewModal = openNewModal;
window.openBulkModal = openBulkModal;
window.openSettingsModal = openSettingsModal;
window.openLabelModal = openLabelModal;
window.openDomainsModal = openDomainsModal;
window.openStatsModal = openStatsModal;
window.openQRModal = openQRModal;
window.openTTLModal = openTTLModal;
window.saveTTL = saveTTL;
window.openBlocklistModal = openBlocklistModal;
window.addBlocklist = addBlocklist;
window.removeBlocklist = removeBlocklist;
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
window.openClaimModal = openClaimModal;
window.downloadEml = downloadEml;
window.openAdminModal = openAdminModal;
window.setAdminKey = setAdminKey;
window.switchAdminTab = switchAdminTab;
window.saveAdminSettings = saveAdminSettings;
window.setupTgWebhook = setupTgWebhook;

// ==================== Keyboard Shortcuts (#6) ====================
document.addEventListener('keydown', function(e) {
  // Skip if typing in input/textarea or modal open
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (document.getElementById('modalOverlay')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case 'j': // Next message
      e.preventDefault(); navigateMessage(1); break;
    case 'k': // Previous message
      e.preventDefault(); navigateMessage(-1); break;
    case 's': // Star current message
      if (selectedMessage) { e.preventDefault(); toggleStar(selectedMessage); } break;
    case 'd': // Delete current message
      if (selectedMessage) { e.preventDefault(); deleteMessage(selectedMessage); } break;
    case 'c': // Compose new inbox
      e.preventDefault(); openNewModal(); break;
    case '/': // Focus search
      e.preventDefault(); const si = document.getElementById('searchInput'); if (si) si.focus(); break;
    case 'escape': // Close reading pane on mobile
      closeReadingPaneMobile(); break;
  }
});

function navigateMessage(dir) {
  if (!selectedInbox || messages.length === 0) return;
  const idx = messages.findIndex(function(m) { return m.id === selectedMessage; });
  if (idx === -1) { if (dir > 0 && messages[0]) openMessage(messages[0].id); return; }
  const next = idx + dir;
  if (next >= 0 && next < messages.length) openMessage(messages[next].id);
}

// ==================== Inbox Reclaim (#8) ====================
function openClaimModal() {
  showModal(
    '<div class="modal-header"><div class="modal-title">Reclaim Inbox</div><button class="modal-close" onclick="closeModal()">' + ICON.close + '</button></div>',
    '<div class="form-group"><label>Inbox Address</label><input id="claimAddress" placeholder="test@kilo.web.id"></div><p style="font-size:12px;color:var(--label-tertiary);">Recover an existing inbox into this session. Useful if session was lost.</p>',
    '<button class="btn btn-primary" onclick="claimInbox()">' + ICON.inbox + ' Reclaim</button>'
  );
}

async function claimInbox() {
  const addr = $('claimAddress').value.trim().toLowerCase();
  if (!addr) { showToast('Address required'); return; }
  try {
    const res = await fetchJson('/api/inboxes/claim', { method: 'POST', body: JSON.stringify({ address: addr }) });
    closeModal();
    showToast('Inbox reclaimed: ' + addr);
    await loadInboxes();
    selectedInbox = addr;
    render();
    await loadMessages();
  } catch(e) { showToast('Error: ' + e.message); }
}

// ==================== .eml Download (#9) ====================
async function downloadEml(msgId) {
  if (!selectedInbox || !msgId) return;
  try {
    const res = await fetch('/api/inboxes/' + encodeURIComponent(selectedInbox) + '/messages/' + msgId + '/eml', {
      headers: { 'x-session-id': sessionId }
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = msgId + '.eml';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Downloaded .eml');
  } catch(e) { showToast('Error: ' + e.message); }
}

init().catch(function(err) {
  console.error(err);
  app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;color:#8e8e93;"><div style="font-size:17px;font-weight:600;margin-bottom:6px;">Connection Error</div><div style="font-size:14px;">' + escapeHtml(err.message) + '</div></div>';
});
