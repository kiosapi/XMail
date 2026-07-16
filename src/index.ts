import api from './api/routes';
import { handleEmail } from './email-handler';
import type { EmailHandlerEnv } from './email-handler';
import type { ApiEnv } from './api/routes';
import { deleteExpiredInboxes, pruneOldMessages } from './db/queries';

/**
 * XMail — Enhanced disposable email service on Cloudflare Workers
 *
 * Handlers:
 * - fetch()  → API routes (static files served via Cloudflare Assets)
 * - email()  → inbound email processing (OTP, webhooks, Telegram)
 * - scheduled() → cron: auto-expire inboxes + prune old messages
 */

// Combined env bindings
export interface Env extends ApiEnv, EmailHandlerEnv {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route /api/* to Hono router (strip /api prefix)
    if (url.pathname.startsWith('/api/')) {
      const apiUrl = new URL(request.url);
      apiUrl.pathname = url.pathname.slice(4); // strip '/api'
      const apiRequest = new Request(apiUrl, request);
      return api.fetch(apiRequest, env, ctx);
    }

    return new Response('Not found', { status: 404 });
  },

  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleEmail(message, env);
  },

  /**
   * Cron trigger — runs hourly.
   * - Deletes expired inboxes (AUTO_EXPIRY_HOURS)
   * - Prunes old messages beyond MAX_MESSAGES_PER_INBOX per inbox
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const expired = await deleteExpiredInboxes(env.DB);
        const maxPerInbox = parseInt(env.MAX_MESSAGES_PER_INBOX || '0', 10);
        const pruned = await pruneOldMessages(env.DB, maxPerInbox);
        if (expired > 0 || pruned > 0) {
          console.log(`[xmail] Cron: expired ${expired} inboxes, pruned ${pruned} messages`);
        }
      })()
    );
  },
};
