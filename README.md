# XMail

Enhanced disposable email service on Cloudflare Workers — built on the proven [Tempik](https://github.com/hirotomasato/tempik) foundation with major feature upgrades.

## Features

| Feature | Description |
|---------|-------------|
| **OTP Auto-Extract** | Automatically detects and highlights verification codes (4-8 digits) from email subject/body |
| **HTML Email Support** | Renders HTML emails in sandboxed iframe — not just plain text |
| **Attachment Metadata** | Captures filename, size, and content type of attachments |
| **API Key Authentication** | Optional API key protection for sensitive endpoints (stats, search, admin) |
| **Webhook Forwarding** | POST to your URL when an email arrives — perfect for bot triggers |
| **Telegram Notifications** | Real-time email notifications to Telegram (per-inbox configurable) |
| **Auto-Expiry (Cron)** | Inboxes auto-delete after configurable TTL (default 24h) via Cron Trigger |
| **Message Pruning** | Keeps max N messages per inbox to prevent D1 bloat |
| **Stats Dashboard** | Daily email/inbox counts, total counts — visible in web UI |
| **Bulk Inbox Creation** | Create up to 100 inboxes at once, export to clipboard |
| **Search** | Search across all session inboxes by subject, sender, or body |
| **Dark/Light Theme** | Toggle between dark and light themes — preference saved |
| **Message Detail Modal** | Click any email to view full HTML content in a modal |

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Router:** Hono
- **Email Parsing:** PostalMime
- **Database:** Cloudflare D1 (SQLite)
- **Cron:** Cloudflare Cron Triggers
- **Static Hosting:** Cloudflare Workers Assets
- **Language:** TypeScript
- **CLI:** Wrangler v4

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Login to Cloudflare
npx wrangler login

# 3. Create D1 database
npx wrangler d1 create xmail-db
# Copy database_id → wrangler.toml

# 4. Apply schema
npx wrangler d1 execute xmail-db --remote --file=src/db/schema.sql

# 5. Deploy
npx wrangler deploy

# 6. Setup Email Routing (catch-all → xmail Worker) in Cloudflare Dashboard
```

## Configuration

All config is in `wrangler.toml` under `[vars]`:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `XMail` | Display name in UI |
| `MAIL_DOMAIN` | `kilo.web.id` | Domain for disposable email addresses |
| `WEB_HOST` | `mail.kilo.web.id` | Web UI hostname |
| `AUTO_EXPIRY_HOURS` | `24` | Inbox TTL in hours (0 = never expire) |
| `MAX_MESSAGES_PER_INBOX` | `100` | Max messages kept per inbox (0 = unlimited) |

### Secrets (set via `wrangler secret put`)

| Secret | Description |
|--------|-------------|
| `API_KEYS` | Comma-separated API keys for auth (empty = auth disabled) |
| `TG_BOT_TOKEN` | Telegram bot token for notifications |

## API Reference

### Authentication

- **Session endpoints** (inbox/message CRUD): use `x-session-id` header (anonymous sessions)
- **Protected endpoints** (stats, search, admin): require `x-api-key` header or `?key=` query param

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config` | None | App configuration |
| GET | `/api/session` | None | Create/retrieve session |
| GET | `/api/inboxes` | Session | List session inboxes |
| POST | `/api/inboxes` | Session | Create inbox (`{localPart?, domain?, label?}`) |
| POST | `/api/inboxes/bulk` | Session | Bulk create (`{count, domain?}`) |
| DELETE | `/api/inboxes/:address` | Session | Unlink or purge (`?purge=1`) |
| GET | `/api/inboxes/:address/messages` | Session | List messages |
| GET | `/api/inboxes/:address/messages/:id` | Session | Get single message (marks read) |
| GET | `/api/inboxes/:address/otp` | Session | Get latest OTP code |
| GET | `/api/inboxes/:address/settings` | Session | Get inbox settings |
| PUT | `/api/inboxes/:address/settings` | Session | Set webhook/Telegram config |
| GET | `/api/stats` | API Key | Daily + total stats |
| GET | `/api/search?q=...` | API Key + Session | Search messages |
| POST | `/api/admin/expire` | API Key | Manually trigger expiry cron |

## Project Structure

```
xmail/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
└── src/
    ├── index.ts               # Entry: fetch() + email() + scheduled() handlers
    ├── email-handler.ts       # Inbound email processing (OTP, webhook, TG)
    ├── api/
    │   └── routes.ts          # Hono router: all API endpoints
    ├── db/
    │   ├── schema.sql         # D1 tables
    │   └── queries.ts         # Typed query functions
    ├── utils/
    │   ├── random-address.ts  # Human-like random email generator
    │   └── otp.ts             # OTP code extractor
    └── web/
        ├── index.html         # Frontend UI
        ├── app.js             # Frontend logic
        └── styles.css         # Dark/Light theme
```

## License

MIT
