/**
 * Cloudflare Worker — anniversary visitor notifier.
 *
 * Receives one JSON payload per visit/reopen from the site's frontend
 * tracker, enriches it with Cloudflare's own request metadata (request.cf
 * and CF-* headers), and sends ONE formatted Telegram message.
 *
 * Secrets live ONLY in the Worker environment and are never returned to
 * the browser or written into the message:
 *   - TELEGRAM_BOT_TOKEN
 *   - TELEGRAM_CHAT_ID
 *
 * Privacy:
 *   - The visitor's raw IP is used only to reply to Telegram's API layer
 *     via Cloudflare; it is NEVER placed in the Telegram message.
 *   - Precise GPS is only ever what the browser supplied through its own
 *     permission prompt. Network location is Cloudflare's approximate,
 *     IP-derived guess and is labelled as such.
 *
 * Deploy: paste this as the Worker's module code (Quick Edit / Wrangler),
 * keep the two secrets, and Save/Deploy.
 */

const ALLOWED_ORIGINS = [
  "https://nassaranwar-boop.github.io"
];

const WORKER_VERSION = "2026-09-20-FULL-6";

// Tiny in-memory throttle (per isolate; best-effort abuse guard only).
const RECENT = new Map();
const RATE_WINDOW_MS = 4000;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    // ---- CORS preflight ----
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // ---- Only POST is accepted ----
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, cors);
    }

    // ---- Restrict to the site origin ----
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ ok: false, error: "forbidden_origin" }, 403, cors);
    }

    // ---- Content-Type must be JSON ----
    const ct = request.headers.get("Content-Type") || "";
    if (!ct.toLowerCase().includes("application/json")) {
      return json({ ok: false, error: "unsupported_media_type" }, 415, cors);
    }

    // ---- Parse JSON safely ----
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ ok: false, error: "invalid_json" }, 400, cors);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ ok: false, error: "invalid_payload" }, 400, cors);
    }

    // ---- Light rate limit, keyed on a coarse client signal ----
    const key = request.headers.get("CF-Connecting-IP") || "anon";
    const now = Date.now();
    const prev = RECENT.get(key) || 0;
    RECENT.set(key, now);
    if (RECENT.size > 500) RECENT.clear();
    if (now - prev < RATE_WINDOW_MS) {
      return json({ ok: true, throttled: true }, 202, cors);
    }

    // ---- Secrets present? ----
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      // Do not reveal which is missing beyond a generic code.
      return json({ ok: false, error: "server_not_configured" }, 500, cors);
    }

    // ---- Build and send the message ----
    const cf = request.cf || {};
    const headers = request.headers;
    const message = buildMessage(body, cf, headers);

    try {
      const tg = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: true
          })
        }
      );

      if (!tg.ok) {
        // Read Telegram's description for our own return, but do not echo
        // anything containing the token (the URL is never in the body).
        let desc = "";
        try { const j = await tg.json(); desc = (j && j.description) || ""; } catch (e) {}
        return json({ ok: false, error: "telegram_failed", status: tg.status, detail: desc }, 502, cors);
      }
    } catch (e) {
      return json({ ok: false, error: "telegram_unreachable" }, 502, cors);
    }

    return json({ ok: true, version: WORKER_VERSION }, 200, cors);
  }
};

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors }
  });
}

// HTML-escape for Telegram parse_mode=HTML.
function esc(v) {
  if (v === null || v === undefined || v === "") return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Value or a clear "Unavailable" — never undefined/null in the text.
function val(v) {
  if (v === null || v === undefined || v === "") return "Unavailable";
  return esc(v);
}

function yesno(v) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "Unavailable";
}

function num(v, digits) {
  if (typeof v !== "number" || !isFinite(v)) return null;
  return digits === undefined ? v : Number(v.toFixed(digits));
}

const DIV = "\n━━━━━━━━━━━━━━━━━━\n";

function buildMessage(b, cf, headers) {
  const isReopen = b.visitType === "reopen";
  const heading = isReopen
    ? "🔁 ANNIVERSARY GIFT REOPENED"
    : "🔔 ANNIVERSARY GIFT OPENED";

  let out = "<b>" + heading + "</b>\n";

  // ---- VISIT ----
  out += "\n🟢 <b>VISIT</b>\n";
  out += "Type: " + (isReopen ? "REOPEN / RETURN" : "INITIAL VISIT") + "\n";
  out += "Time (UTC): " + esc(new Date().toISOString()) + "\n";
  if (b.localTime) out += "Client time: " + val(b.localTime) + "\n";

  // ---- DEVICE ----
  out += DIV + "📱 <b>DEVICE</b>\n";
  out += "Device: " + val(b.device) + "\n";
  out += "OS: " + val(b.os) + "\n";
  out += "Browser: " + val(b.browser) + "\n";
  out += "Browser version: " + val(b.browserVersion) + "\n";
  out += "Engine: " + val(b.engine) + "\n";
  out += "Touchscreen: " + yesno(b.touchscreen) + "\n";
  out += "Max touch points: " + (typeof b.maxTouchPoints === "number" ? b.maxTouchPoints : "Unavailable") + "\n";

  // ---- DISPLAY ----
  out += DIV + "📐 <b>DISPLAY</b>\n";
  out += "Screen: " + val(b.screenWidth) + " × " + val(b.screenHeight) + "\n";
  out += "Viewport: " + val(b.viewportWidth) + " × " + val(b.viewportHeight) + "\n";
  out += "Orientation: " + val(b.orientation) + "\n";
  out += "Device pixel ratio: " + val(b.devicePixelRatio) + "\n";

  // ---- PRECISE LOCATION (browser GPS only) ----
  out += DIV + "📍 <b>PRECISE LOCATION</b> (browser GPS)\n";
  const gps = b.gps || {};
  if (gps.available && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
    const lat = num(gps.latitude, 6), lon = num(gps.longitude, 6);
    out += "Status: AVAILABLE\n";
    out += "Latitude: " + lat + "\n";
    out += "Longitude: " + lon + "\n";
    out += "Accuracy: " + (num(gps.accuracy, 0) !== null ? "±" + num(gps.accuracy, 0) + " m" : "Unavailable") + "\n";
    out += "Altitude: " + (num(gps.altitude, 1) !== null ? num(gps.altitude, 1) + " m" : "Unavailable") + "\n";
    out += "Altitude accuracy: " + (num(gps.altitudeAccuracy, 0) !== null ? "±" + num(gps.altitudeAccuracy, 0) + " m" : "Unavailable") + "\n";
    out += "Heading: " + (num(gps.heading, 0) !== null ? num(gps.heading, 0) + "°" : "Unavailable") + "\n";
    out += "Speed: " + (num(gps.speed, 1) !== null ? num(gps.speed, 1) + " m/s" : "Unavailable") + "\n";
    out += "Google Maps: https://www.google.com/maps?q=" + lat + "," + lon + "\n";
  } else {
    out += "Status: UNAVAILABLE\n";
    out += "Reason: " + val(gps.reason) + "\n";
    out += "Permission: " + val(b.locationPermission) + "\n";
  }

  // ---- NETWORK LOCATION (Cloudflare, approximate, NOT GPS) ----
  out += DIV + "🌍 <b>NETWORK / IP-BASED LOCATION</b> (approximate)\n";
  out += "Country: " + val(cf.country || headers.get("CF-IPCountry")) + "\n";
  out += "Continent: " + val(cf.continent) + "\n";
  out += "Region: " + val(cf.region) + "\n";
  out += "Region code: " + val(cf.regionCode) + "\n";
  out += "City: " + val(cf.city) + "\n";
  out += "Postal code: " + val(cf.postalCode) + "\n";
  out += "Metro code: " + val(cf.metroCode) + "\n";
  out += "Timezone: " + val(cf.timezone) + "\n";
  out += "Approx lat/lon: " + val(cf.latitude) + ", " + val(cf.longitude) + "\n";
  out += "ASN: " + val(cf.asn) + "\n";
  out += "Organization: " + val(cf.asOrganization) + "\n";

  // ---- CONNECTION ----
  const c = b.connection || {};
  out += DIV + "📡 <b>CONNECTION</b>\n";
  out += "Type: " + val(c.type) + "\n";
  out += "Effective type: " + val(c.effectiveType) + "\n";
  out += "Downlink: " + (typeof c.downlink === "number" ? c.downlink + " Mbps" : "Unavailable") + "\n";
  out += "RTT: " + (typeof c.rtt === "number" ? c.rtt + " ms" : "Unavailable") + "\n";
  out += "Save data: " + yesno(c.saveData) + "\n";

  // ---- LANGUAGE & TIME ----
  out += DIV + "🗣 <b>LANGUAGE & TIME</b>\n";
  out += "Language: " + val(b.language) + "\n";
  out += "Languages: " + val((b.languages || []).join(", ")) + "\n";
  out += "Browser timezone: " + val(b.timezone) + "\n";

  // ---- SOURCE ----
  out += DIV + "🔗 <b>SOURCE</b>\n";
  out += "Referrer: " + val(b.referrer) + "\n";
  out += "Origin: " + val(b.origin) + "\n";
  out += "Page: " + val(b.page) + "\n";

  // ---- USER AGENT ----
  out += DIV + "🌐 <b>USER AGENT</b>\n" + val(b.userAgent) + "\n";

  // ---- CLOUDFLARE / TECH (no IP) ----
  out += DIV + "☁️ <b>CLOUDFLARE</b>\n";
  out += "CF-Ray: " + val(headers.get("CF-Ray")) + "\n";
  out += "HTTP: " + val(cf.httpProtocol) + "\n";
  out += "TLS: " + val(cf.tlsVersion) + "\n";

  // ---- META ----
  out += DIV + "🧩 <b>META</b>\n";
  out += "Tracker: " + val(b.trackerVersion) + "\n";
  out += "Worker: " + WORKER_VERSION + "\n";
  out += "Permission state: " + val(b.locationPermission) + "\n";

  // Telegram hard-caps a message at 4096 chars.
  if (out.length > 4090) out = out.slice(0, 4085) + "\n…";
  return out;
}
