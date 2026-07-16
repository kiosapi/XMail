<div align="center">

# XMail

**Enhanced disposable email service on Cloudflare Workers**

A modern, self-hosted disposable email platform with a Gmail-inspired 3-pane interface. Built on Cloudflare's edge network — zero server costs, infinite scale.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.4-E36002)](https://hono.dev/)
[![D1 Database](https://img.shields.io/badge/Cloudflare-D1-0052CC)](https://developers.cloudflare.com/d1/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## Features

### Core
| Feature | Description |
|---------|-------------|
| **Modern Email UI** | Gmail-inspired 3-pane layout — sidebar, inbox list, reading pane |
| **Fully Responsive** | Desktop 3-pane → Tablet 2-pane → Mobile single column with slide-in detail |
| **Dark / Light Theme** | Toggle between themes — preference saved to localStorage |
| **SVG Icons** | Clean, consistent icon set — no emoji |
| **SPA Frontend** | Vanilla JS single-page app — no framework, no build step |

### Email
| Feature | Description |
|---------|-------------|
| **Multi-Domain Support** | Unlimited mail domains — add/remove via API or UI |
| **OTP Auto-Extract** | Automatically detects and highlights verification codes (4-8 digits) |
| **HTML Email Support** | Renders HTML emails in sandboxed iframe |
| **Attachment Metadata** | Captures filename, size, and content type |
| **Star Messages** | Star/unstar important messages |
| **Delete Messages** | Individual message deletion |
| **Inbox Labels** | Custom labels for inbox organization |
| **Email Forwarding** | Forward incoming emails to a real address (per-inbox) |

### Automation
| Feature | Description |
|---------|-------------|
| **Webhook Forwarding** | POST to your URL when email arrives — perfect for bot triggers |
| **Telegram Notifications** | Real-time email notifications to Telegram (per-inbox) |
| **Auto-Expiry (Cron)** | Inboxes auto-delete after configurable TTL via Cron Trigger |
| **Message Pruning** | Keeps max N messages per inbox to prevent D1 bloat |

### Management
| Feature | Description |
|---------|-------------|
| **Bulk Inbox Creation** | Create up to 100 inboxes at once, export to clipboard |
| **Export All** | Export all inbox addresses as plain text |
| **Stats Dashboard** | Daily email/inbox counts, total counts |
| **Search** | Real-time search across all session inboxes |
| **Domain Management** | Add/remove mail domains via UI (admin key protected) |
| **API Key Auth** | Optional protection for sensitive endpoints |
| **Admin Keys** | Separate admin keys for domain management |
| **CORS Support** | Cross-origin API access enabled |
| **Health Check** | `/api/health` endpoint for monitoring |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Cloudflare Workers |
| **Framework** | Hono |
| **Email Parsing** | PostalMime |
| **Database** | Cloudflare D1 (SQLite) |
| **Cron** | Cloudflare Cron Triggers |
| **Static Assets** | Cloudflare Workers Assets |
| **Language** | TypeScript |
| **CLI** | Wrangler v4 |
| **Frontend** | Vanilla JS SPA — no framework, no build step |

---

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/kiosapi/XMail.git
cd XMail
npm install --legacy-peer-deps

# 2. Login to Cloudflare
npx wrangler login

# 3. Create D1 database
npx wrangler d1 create xmail-db
# Copy the database_id into wrangler.toml

# 4. Apply schema
npx wrangler d1 execute xmail-db --remote --file=src/db/schema.sql

# 5. Deploy
npx wrangler deploy

# 6. Enable Email Routing + catch-all → Worker for each domain in Cloudflare Dashboard
```

---

## Multi-Domain Setup

XMail supports unlimited mail domains. Configure via:

1. **wrangler.toml** (comma-separated):
```toml
[vars]
MAIL_DOMAIN = "domain1.com,domain2.com,domain3.com"
```

2. **API** (dynamic, requires admin key):
```bash
# Add domain
curl -X POST https://mail.example.com/api/domains \
  -H "x-api-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain":"newdomain.com"}'

# Remove domain
curl -X DELETE https://mail.example.com/api/domains/newdomain.com \
  -H "x-api-key: YOUR_ADMIN_KEY"
```

3. **UI**: Sidebar → Domains → Add/Remove

**Per-domain requirement**: Each domain must have Cloudflare Email Routing enabled with catch-all rule set to the `xmail` worker.

---

## Configuration

All config is in `wrangler.toml` under `[vars]`:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `XMail` | Display name |
| `MAIL_DOMAIN` | `kilo.web.id,asuw.fun` | Comma-separated mail domains |
| `WEB_HOST` | `mail.kilo.web.id` | Web UI hostname |
| `AUTO_EXPIRY_HOURS` | `24` | Inbox TTL in hours (0 = never) |
| `MAX_MESSAGES_PER_INBOX` | `100` | Max messages per inbox (0 = unlimited) |

### Secrets

```bash
# API keys for auth (comma-separated, empty = auth disabled)
npx wrangler secret put API_KEYS

# Admin keys for domain management (comma-separated)
npx wrangler secret put ADMIN_KEYS

# Telegram bot token
npx wrangler secret put TG_BOT_TOKEN
```

---

## API Reference

### Authentication

- **Session endpoints**: `x-session-id` header (anonymous sessions)
- **Protected endpoints** (stats, search): `x-api-key` header
- **Admin endpoints** (domains, expire): `x-api-key` with admin key

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/config` | None | App configuration |
| `GET` | `/api/session` | None | Create/retrieve session |
| `GET` | `/api/health` | None | Health check |
| `GET` | `/api/domains` | None | List active domains |
| `POST` | `/api/domains` | Admin | Add domain `{domain, label?}` |
| `DELETE` | `/api/domains/:domain` | Admin | Deactivate domain |
| `GET` | `/api/inboxes` | Session | List session inboxes |
| `POST` | `/api/inboxes` | Session | Create inbox `{localPart?, domain?, label?}` |
| `POST` | `/api/inboxes/bulk` | Session | Bulk create `{count, domain?}` |
| `DELETE` | `/api/inboxes/:address` | Session | Delete inbox (`?purge=1`) |
| `PUT` | `/api/inboxes/:address/label` | Session | Set inbox label `{label}` |
| `GET` | `/api/inboxes/:address/messages` | Session | List messages |
| `GET` | `/api/inboxes/:address/messages/:id` | Session | Get single message |
| `DELETE` | `/api/inboxes/:address/messages/:id` | Session | Delete message |
| `PUT` | `/api/inboxes/:address/messages/:id/star` | Session | Toggle star |
| `GET` | `/api/inboxes/:address/otp` | Session | Get latest OTP code |
| `GET` | `/api/inboxes/:address/settings` | Session | Get inbox settings |
| `PUT` | `/api/inboxes/:address/settings` | Session | Set webhook/TG/forward |
| `GET` | `/api/export` | Session | Export all addresses |
| `GET` | `/api/stats` | API Key | Daily + total stats |
| `GET` | `/api/search?q=` | API Key | Search messages |
| `POST` | `/api/admin/expire` | Admin | Manual expiry trigger |

### Example Flow

```bash
# 1. Get session
SESSION=$(curl -s https://mail.example.com/api/session | jq -r '.sessionId')

# 2. Create inbox on specific domain
INBOX=$(curl -s -X POST https://mail.example.com/api/inboxes \
  -H "x-session-id: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"localPart":"test","domain":"asuw.fun"}' | jq -r '.address')

# 3. Check OTP after email arrives
curl -s "https://mail.example.com/api/inboxes/$(jq -rn --arg v "$INBOX" '$v|@uri')/otp" \
  -H "x-session-id: $SESSION"
```

---

## Project Structure

```
XMail/
├── wrangler.toml              # Worker config, D1, routes, cron
├── package.json
├── tsconfig.json
├── migrate.sql                # Schema migration (v1 → v2)
└── src/
    ├── index.ts               # Entry: fetch() + email() + scheduled()
    ├── email-handler.ts       # Inbound email (OTP, webhook, TG, forward)
    ├── api/
    │   └── routes.ts          # Hono router: all API endpoints
    ├── db/
    │   ├── schema.sql         # D1 schema v2 (7 tables)
    │   └── queries.ts         # Typed query functions
    ├── utils/
    │   ├── random-address.ts  # Human-like random email generator
    │   └── otp.ts             # OTP code extractor
    └── web/
        ├── index.html         # SPA shell
        ├── app.js             # Frontend SPA (vanilla JS)
        └── styles.css         # Modern responsive design system
```

---

## Responsive Layout

| Width | Layout |
|-------|--------|
| `> 1024px` | Full 3-pane: sidebar (260px) + inbox list (340px) + reading pane |
| `769–1024px` | Narrower sidebar (220px) + inbox list (300px) + reading pane |
| `481–768px` | Sidebar drawer + inbox list full width + reading pane slides in |
| `≤ 480px` | Mobile: single column, slide-in reading pane, hamburger menu |

---

## License

MIT
