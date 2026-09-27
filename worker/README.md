# Visitor notifier — Cloudflare Worker

`visitor-worker.js` is the complete source for the Worker at
`https://flat-bush-3ad6.nassaranwar.workers.dev/`.

It contains **no secrets**. The Telegram credentials stay as Worker
environment secrets and are read at runtime:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## Deploy

1. Cloudflare dashboard → Workers & Pages → this Worker → **Edit code**
   (or `wrangler deploy`).
2. Replace the whole script with the contents of `visitor-worker.js`.
3. Confirm the two secrets still exist under **Settings → Variables and
   Secrets** (type: *Secret*). Do not paste them into the code.
4. **Save and deploy.**

## What it does

- Accepts `POST` JSON only, from `https://nassaranwar-boop.github.io`.
- Handles `OPTIONS` (CORS preflight); `Access-Control-Allow-Origin` is the
  exact site origin, never `*`.
- Reads Cloudflare request metadata (`request.cf`, `CF-*` headers) for the
  approximate **network** location.
- Merges it with the browser data and sends **one** Telegram message.
- The raw visitor IP (`CF-Connecting-IP`) is used only as a throttle key —
  it is never written into the Telegram message.

Bump `WORKER_VERSION` when you change the format so the message's META
section shows which build ran.
