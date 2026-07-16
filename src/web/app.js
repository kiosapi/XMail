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

// ---- SVG icon strings (no emoji) ----
const ICON = {
  inbox: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 6 10-6"/></svg>',
  mail: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m2 7 10 6 10-6"/></svg>',
  warning: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  copy: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  paperclip: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
};

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
  $('appSubtitle').textContent = `Disposable inbox for ${appConfig.mailDomain}`;
  $('localPartInput').placeholder = `Custom or leave blank @${appConfig.mailDomain}`;

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
    opt.textContent = 'No inbox';
    $('inboxSelect').appendChild(opt);
    $('messageCount').textContent = '0 messages';
    $('messageList').innerHTML = `<div class="empty-state"><div class="empty-icon">${ICON.inbox}</div><div class="title">No Inboxes</div><div class="sub">Tap New to create a disposable address.</div></div>`;
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
  const messages = await fetchJson(`/api/inboxes/${encodeURIComponent(address)}/messages`);
  $('messageCount').textContent = `${messages.length} message${messages.length !== 1 ? 's' : ''}`;

  if (!messages.length) {
    $('messageList').innerHTML = `<div class="empty-state"><div class="empty-icon">${ICON.mail}</div><div class="title">Inbox Empty</div><div class="sub">Emails sent here will appear automatically.</div></div>`;
    return;
  }

  $('messageList').innerHTML = messages
    .map((msg) => {
      const otpHtml = msg.otp_code
        ? `<div class="message-badges"><span class="otp-chip" data-otp="${msg.otp_code}">${ICON.shield}<span>${msg.otp_code}</span></span></div>`
        : '';
      const attachments = JSON.parse(msg.attachments || '[]');
      const attHtml =
        attachments.length > 0
          ? `${otpHtml ? '' : '<div class="message-badges">'}${otpHtml ? '' : `<span class="att-badge">${ICON.paperclip}${attachments.length} attachment${attachments.length > 1 ? 's' : ''}</span>`}${otpHtml ? '' : '</div>'}`
          : otpHtml;
      const bodyPreview = (msg.body_text || '').slice(0, 120);

      return `
      <div class="message-item ${msg.is_read ? '' : 'unread'}" data-msg-id="${msg.id}">
        <div class="message-top">
          <div class="message-from">${escapeHtml(msg.from_name || msg.from_address)}</div>
          <div class="message-time">${formatDate(msg.received_at)}</div>
        </div>
        <div class="message-subject">${escapeHtml(msg.subject)}</div>
        ${attHtml}
        <div class="message-preview">${escapeHtml(bodyPreview)}${bodyPreview.length >= 120 ? '...' : ''}</div>
      </div>`;
    })
    .join('');

  // OTP chip click
  document.querySelectorAll('.otp-chip').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const otp = el.dataset.otp;
      navigator.clipboard.writeText(otp);
      showToast(`OTP copied: ${otp}`);
    });
  });

  // Message click
  document.querySelectorAll('.message-item').forEach((el) => {
    el.addEventListener('click', () => openMessage(el.dataset.msgId));
  });
}

// ---- Message detail ----

async function openMessage(msgId) {
  const address = $('inboxSelect').value;
  const msg = await fetchJson(`/api/inboxes/${encodeURIComponent(address)}/messages/${msgId}`);

  $('modalSubject').textContent = msg.subject;
  $('modalFrom').textContent = msg.from_name ? `${msg.from_name} <${msg.from_address}>` : msg.from_address;
  $('modalDate').textContent = formatDate(msg.received_at);

  if (msg.otp_code) {
    $('modalOtpText').textContent = `OTP: ${msg.otp_code}`;
    $('modalOtpBadge').classList.remove('hidden');
    $('modalOtpBadge').onclick = () => {
      navigator.clipboard.writeText(msg.otp_code);
      showToast(`OTP copied: ${msg.otp_code}`);
    };
  } else {
    $('modalOtpBadge').classList.add('hidden');
  }

  const attachments = JSON.parse(msg.attachments || '[]');
  if (attachments.length > 0) {
    $('modalAttachments').innerHTML =
      `<div style="font-weight:600;margin-bottom:6px;">Attachments</div>` +
      attachments.map((a) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">${ICON.paperclip}${escapeHtml(a.filename)} <span style="color:var(--label-tertiary)">(${formatSize(a.size)})</span></div>`).join('');
    $('modalAttachments').classList.remove('hidden');
  } else {
    $('modalAttachments').classList.add('hidden');
  }

  const content = msg.body_html || `<pre style="white-space:pre-wrap;font-family:inherit;padding:16px;">${escapeHtml(msg.body_text)}</pre>`;
  $('modalFrame').srcdoc = content;

  $('messageModal').classList.remove('hidden');
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
    showToast('No addresses to export');
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
  let html = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${stats.totals.inboxes}</div><div class="stat-label">Total Inboxes</div></div>
      <div class="stat-card"><div class="stat-num">${stats.totals.messages}</div><div class="stat-label">Total Emails</div></div>
    </div>
    <table class="stats-table"><tr><th>Date</th><th>Emails</th><th>Inboxes</th></tr>`;

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
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ---- Theme ----

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  localStorage.setItem('xmail_theme', theme);
}

// ---- Event listeners ----

$('copyBtn').addEventListener('click', async () => {
  if (!$('inboxSelect').value) return;
  await navigator.clipboard.writeText($('inboxSelect').value);
  showToast('Address copied');
});

$('refreshBtn').addEventListener('click', loadMessages);

$('newBtn').addEventListener('click', () => {
  toggleExpandable('newBox');
});
$('bulkBtn').addEventListener('click', () => {
  toggleExpandable('bulkBox');
});
$('settingsBtn').addEventListener('click', async () => {
  if (toggleExpandable('settingsBox')) await loadSettings();
});
$('statsBtn').addEventListener('click', async () => {
  if (toggleExpandable('statsBox')) await loadStats();
});

function toggleExpandable(id) {
  const boxes = ['newBox', 'bulkBox', 'settingsBox', 'statsBox'];
  const target = $(id);
  const willOpen = target.classList.contains('hidden');
  boxes.forEach((b) => $(b).classList.add('hidden'));
  if (willOpen) target.classList.remove('hidden');
  return willOpen;
}

$('inboxSelect').addEventListener('change', loadMessages);

$('deleteBtn').addEventListener('click', async () => {
  if (!$('inboxSelect').value) return;
  if (!confirm(`Delete inbox ${$('inboxSelect').value}?`)) return;
  const target = $('inboxSelect').value;
  await fetchJson(`/api/inboxes/${encodeURIComponent(target)}?purge=1`, { method: 'DELETE' });
  await loadInboxes();
  showToast('Inbox deleted');
});

$('createCustomBtn').addEventListener('click', async () => {
  const localPart = $('localPartInput').value.trim();
  const domain = $('domainSelect').value;
  const inbox = await fetchJson('/api/inboxes', {
    method: 'POST',
    body: JSON.stringify({ localPart, domain }),
  });
  $('localPartInput').value = '';
  $('newBox').classList.add('hidden');
  await loadInboxes(inbox.address);
  showToast('Inbox created');
});

$('createRandomBtn').addEventListener('click', async () => {
  const domain = $('domainSelect').value;
  const inbox = await fetchJson('/api/inboxes', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });
  $('newBox').classList.add('hidden');
  await loadInboxes(inbox.address);
  showToast('Random inbox created');
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

applyTheme(localStorage.getItem('xmail_theme') || 'dark');

// Nav bar scrolled state
window.addEventListener('scroll', () => {
  const navBar = document.querySelector('.nav-bar');
  if (window.scrollY > 10) navBar.classList.add('scrolled');
  else navBar.classList.remove('scrolled');
}, { passive: true });

Promise.all([loadConfig(), ensureSession()])
  .then(() => loadInboxes())
  .catch((err) => {
    console.error(err);
    $('messageList').innerHTML = `<div class="empty-state"><div class="empty-icon">${ICON.warning}</div><div class="title">Connection Error</div><div class="sub">${escapeHtml(err.message)}</div></div>`;
  });
