/* SCREENSHOTS HAVE NEVER SHOWN THE REAL FONTS.

   Every shot tool aborts non-localhost requests, so the Google Fonts
   stylesheet never loads and every screenshot this project has ever taken
   was of the fallback stack. That is a fine way to judge layout and a
   useless one for judging type -- which is exactly what was being judged
   the last time the fonts were changed.

   The container can reach fonts.googleapis.com even though the browser
   cannot, so the faces are mirrored into the scratchpad once with curl and
   served back to the page from disk. Nothing about the site changes; the
   page asks for the same URLs and gets the same bytes.

   Attach with:  require("./_fontroute").attach(ctx)
*/
const fs = require("fs");
const path = require("path");
const DIR = "/tmp/claude-0/-home-user-anniversary-gift/6a722488-bd45-5266-a49d-0fc55c5f6428/scratchpad/fontcache";

function load() {
  const css = fs.readFileSync(path.join(DIR, "fonts.css"), "utf8");
  const map = new Map();
  for (const line of fs.readFileSync(path.join(DIR, "map.txt"), "utf8").split("\n")) {
    const [u, n] = line.trim().split(/\s+/);
    if (u && n) map.set(u, path.join(DIR, n));
  }
  return { css, map };
}

async function attach(ctx) {
  let cache = null;
  try { cache = load(); } catch (e) { return false; }
  await ctx.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith("http://127.0.0.1")) return r.continue();
    if (u.startsWith("https://fonts.googleapis.com/css2"))
      return r.fulfill({ status: 200, contentType: "text/css", body: cache.css });
    if (u.startsWith("https://fonts.gstatic.com/")) {
      const f = cache.map.get(u);
      if (f) return r.fulfill({ status: 200, contentType: "font/woff2", body: fs.readFileSync(f) });
    }
    return r.abort();
  });
  return true;
}
module.exports = { attach };
