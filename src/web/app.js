const $ = (id) => document.getElementById(id);

let appConfig = {
  appName: 'XMail',
  mailDomain: 'example.com',
  mailDomains: ['example.com'],
  webHost: 'mail.example.com',
  authRequired: false,
};

const SESSION_KEY = 'xmail_session_id';
let sessionId = localStorage.getItem(SESSION_KEY) || '';
let currentApiKey = localStorage.getItem('xmail_api_key') || '';

// ---- API helpers ----

async function fetchJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (sessionId) headers['x-session-id'] = sessionId;
  if (currentApiKey) headers['x-api-key'] = currentApiKey;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---- Config ----

async function loadConfig() {
  appConfig = await fetchJson('/api/config', { headers: {} });
  document.title = appConfig.appName;
  $('appTitle').textContent = appConfig.appName;
  $('appSubtitle').textContent = `Disposable inbox for ${appConfig.mailDomain}`;
  $('localPartInput').placeholder = `username atau kosongkan untuk random @${appConfig.mailDomain}`;

  const domains = appConfig.mailDomains || [appConfig.mailDomain];
  $('domainSelect').innerHTML = '';
  domains.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `@${d}`;
    $('domainSelect').appendChild(opt);
  });
  if (domains.length <= 1) $('domainSelect').style.display = 'none';
}

// ---- Session ----

async function ensureSession() {
  const payload = await fetchJson('/api/session');
  sessionId = payload.sessionId;
  localStorage.setItem(SESSION_KEY, sessionId);
}

// ---- Inboxes ----

async function loadInboxes(selectedAddress) {
  const inboxes = await fetchJson('/api/inboxes');
  $('inboxSelect').innerHTML = '';

  if (!inboxes.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Belum ada inbox';
    $('inboxSelect').appendChild(opt);
    $('currentInbox').textContent = 'No inbox selected';
    $('messageList').innerHTML =
      '<div class="empty-state"><div class="icon">📬</div><div class="title">No inboxes yet</div><div class="sub">Click <b>New</b> to create a disposable email address.</div></div>';
    $('messageCount').textContent = '0 messages';
    return;
  }

  inboxes.forEach((inbox) => {
    const opt = document.createElement('option');
    opt.value = inbox.address;
    opt.textContent = inbox.address;
    $('inboxSelect').appendChild(opt);
  });

  $('inboxSelect').value =
    selectedAddress && inboxes.some((x) => x.address === selectedAddress)
      ? selectedAddress
      : inboxes[0].address;

  await loadMessages();
}

async function loadMessages() {
  const address = $('inboxSelect').value;
  if (!address) return;
  $('currentInbox').textContent = address;
  const messages = await fetchJson(`/api/inboxes/${encodeURIComponent(address)}/messages`);
  $('messageCount').textContent = `${messages.length} messages`;

  if (!messages.length) {
    $('messageList').innerHTML =
      '<div class="empty-state"><div class="icon">✉️</div><div class="title">Inbox empty</div><div class="sub">Emails sent to this address will appear here.</div></div>';
    return;
  }

  $('messageList').innerHTML = messages
    .map((msg) => {
      const otpHtml = msg.otp_code
        ? `<span class="otp-badge" onclick="navigator.clipboard.writeText('${msg.otp_code}'); showToast('OTP copied: ${msg.otp_code}');">🔐 ${msg.otp_code}</span>`
        : '';
      const unreadDot = msg.is_read ? '' : '<span class="unread-dot">●</span>';
      const attachments = JSON.parse(msg.attachments || '[]');
      const attHtml =
        attachments.length > 0
          ? `<span class="att-badge">📎 ${attachments.length} attachment(s)</span>`
          : '';
      const bodyPreview = (msg.body_text || '').slice(0, 120);

      return `
      <div class="message-item ${msg.is_read ? '' : 'unread'}" data-msg-id="${msg.id}">
        <div class="message-top">
          <div class="message-from">${unreadDot} ${msg.from_name || msg.from_address}</div>
          <div class="message-time">${formatDate(msg.received_at)}</div>
        </div>
        <div class="message-subject">${escapeHtml(msg.subject)}</div>
        ${otpHtml}
        ${attHtml}
        <div class="message-preview">${escapeHtml(bodyPreview)}${bodyPreview.length >= 120 ? '...' : ''}</div>
      </div>`;
    })
    .join('');

  // Click to open
  document.querySelectorAll('.message-item').forEach((el) => {
    el.addEventListener('click', () => openMessage(el.dataset.msgId));
  });
}

// ---- Message detail ----

async function openMessage(msgId) {
  const address = $('inboxSelect').value;
  const msg = await fetchJson(
    `/api/inboxes/${encodeURIComponent(address)}/messages/${msgId}`
  );

  $('modalSubject').textContent = msg.subject;
  $('modalFrom').textContent = msg.from_name ? `${msg.from_name} <${msg.from_address}>` : msg.from_address;
  $('modalDate').textContent = formatDate(msg.received_at);

  // OTP badge
  if (msg.otp_code) {
    $('modalOtpBadge').textContent = `🔐 OTP: ${msg.otp_code}`;
    $('modalOtpBadge').classList.remove('hidden');
    $('modalOtpBadge').onclick = () => {
      navigator.clipboard.writeText(msg.otp_code);
      showToast(`OTP copied: ${msg.otp_code}`);
    };
  } else {
    $('modalOtpBadge').classList.add('hidden');
  }

  // Attachments
  const attachments = JSON.parse(msg.attachments || '[]');
  if (attachments.length > 0) {
    $('modalAttachments').innerHTML =
      '<b>Attachments:</b><br>' +
      attachments.map((a) => `📎 ${a.filename} (${formatSize(a.size)})`).join('<br>');
    $('modalAttachments').classList.remove('hidden');
  } else {
    $('modalAttachments').classList.add('hidden');
  }

  // Body — prefer HTML, fallback to text
  const frame = $('modalFrame');
  const content = msg.body_html || `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(msg.body_text)}</pre>`;
  frame.srcdoc = content;

  $('messageModal').classList.remove('hidden');

  // Refresh list to mark as read
  await loadMessages();
}

// ---- Bulk ----

async function bulkCreate() {
  const count = parseInt($('bulkCount').value, 10) || 1;
  const domain = $('domainSelect').value;
  const result = await fetchJson('/api/inboxes/bulk', {
    method: 'POST',
    body: JSON.stringify({ count, domain }),
  });
  $('bulkResult').value = result.addresses.join('\n');
  $('bulkResult').classList.remove('hidden');
  await loadInboxes();
  showToast(`Created ${result.count} inboxes`);
}

function bulkExport() {
  const text = $('bulkResult').value;
  if (!text) {
    showToast('No bulk addresses to export');
    return;
  }
  navigator.clipboard.writeText(text);
  showToast(`Copied ${text.split('\n').length} addresses`);
}

// ---- Settings ----

async function loadSettings() {
  const address = $('inboxSelect').value;
  if (!address) return;
  const settings = await fetchJson(`/api/inboxes/${encodeURIComponent(address)}/settings`);
  $('webhookInput').value = settings.webhook_url || '';
  $('telegramInput').value = settings.telegram_chat_id || '';
}

async function saveSettings() {
  const address = $('inboxSelect').value;
  if (!address) return;
  await fetchJson(`/api/inboxes/${encodeURIComponent(address)}/settings`, {
    method: 'PUT',
    body: JSON.stringify({
      webhook_url: $('webhookInput').value.trim() || null,
      telegram_chat_id: $('telegramInput').value.trim() || null,
    }),
  });
  showToast('Settings saved');
  $('settingsBox').classList.add('hidden');
}

// ---- Stats ----

async function loadStats() {
  if (appConfig.authRequired && !currentApiKey) {
    $('statsContent').textContent = 'API key required for stats';
    return;
  }
  const stats = await fetchJson('/api/stats?days=7');
  const totalInboxes = stats.totals.inboxes;
  const totalMessages = stats.totals.messages;

  let html = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${totalInboxes}</div><div class="stat-label">Total Inboxes</div></div>
      <div class="stat-card"><div class="stat-num">${totalMessages}</div><div class="stat-label">Total Emails</div></div>
    </div>
    <table class="stats-table"><tr><th>Date</th><th>New Emails</th><th>New Inboxes</th></tr>`;

  stats.daily.forEach((d) => {
    html += `<tr><td>${d.date}</td><td>${d.total_emails}</td><td>${d.total_inboxes}</td></tr>`;
  });
  html += '</table>';

  $('statsContent').innerHTML = html;
}

// ---- Helpers ----

function showToast(text) {
  const tc = $('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  tc.appendChild(el);
  setTimeout(() => {
    el.classList.add('fadeout');
    setTimeout(() => el.remove(), 200);
  }, 1800);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(dt) {
  const d = new Date(dt.includes('T') ? dt : dt.replace(' ', 'T'));
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Theme ----

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  $('themeToggle').textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem('xmail_theme', theme);
}

// ---- Event listeners ----

$('copyBtn').addEventListener('click', async () => {
  if (!$('inboxSelect').value) return;
  await navigator.clipboard.writeText($('inboxSelect').value);
  showToast('📋 Copied to clipboard');
});

$('refreshBtn').addEventListener('click', loadMessages);
$('newBtn').addEventListener('click', () => {
  $('newBox').classList.toggle('hidden');
  $('bulkBox').classList.add('hidden');
});
$('bulkBtn').addEventListener('click', () => {
  $('bulkBox').classList.toggle('hidden');
  $('newBox').classList.add('hidden');
});
$('settingsBtn').addEventListener('click', async () => {
  $('settingsBox').classList.toggle('hidden');
  if (!$('settingsBox').classList.contains('hidden')) await loadSettings();
});
$('statsBtn').addEventListener('click', async () => {
  $('statsBox').classList.toggle('hidden');
  if (!$('statsBox').classList.contains('hidden')) await loadStats();
});
$('inboxSelect').addEventListener('change', loadMessages);

$('deleteBtn').addEventListener('click', async () => {
  if (!$('inboxSelect').value) return;
  if (!confirm(`Delete inbox ${$('inboxSelect').value}?`)) return;
  const target = $('inboxSelect').value;
  await fetchJson(`/api/inboxes/${encodeURIComponent(target)}?purge=1`, { method: 'DELETE' });
  await loadInboxes();
});

$('createCustomBtn').addEventListener('click', async () => {
  const localPart = $('localPartInput').value.trim();
  const domain = $('domainSelect').value;
  const inbox = await fetchJson('/api/inboxes', {
    method: 'POST',
    body: JSON.stringify({ localPart, domain }),
  });
  $('localPartInput').value = '';
  await loadInboxes(inbox.address);
});

$('createRandomBtn').addEventListener('click', async () => {
  const domain = $('domainSelect').value;
  const inbox = await fetchJson('/api/inboxes', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });
  await loadInboxes(inbox.address);
});

$('bulkCreateBtn').addEventListener('click', bulkCreate);
$('bulkExportBtn').addEventListener('click', bulkExport);
$('saveSettingsBtn').addEventListener('click', saveSettings);

$('themeToggle').addEventListener('click', () => {
  const current = localStorage.getItem('xmail_theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

$('modalClose').addEventListener('click', () => $('messageModal').classList.add('hidden'));
$('messageModal').addEventListener('click', (e) => {
  if (e.target === $('messageModal')) $('messageModal').classList.add('hidden');
});

// ---- Init ----

const savedTheme = localStorage.getItem('xmail_theme') || 'dark';
applyTheme(savedTheme);

Promise.all([loadConfig(), ensureSession()])
  .then(() => loadInboxes())
  .catch((err) => {
    console.error(err);
    $('messageList').innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><div class="title">Connection error</div><div class="sub">${escapeHtml(err.message)}</div></div>`;
  });
