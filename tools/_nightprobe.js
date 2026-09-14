/* what colour does a wall actually end up, after dark */
const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 640 } });
  await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  const click = async (sel) => { await p.evaluate((s) => { const t = [...document.querySelectorAll("button")]
      .find((x) => x.matches(s)); if (t) t.click(); }, sel); await p.waitForTimeout(600); };
  await click('[data-go="single"]'); await click('[data-char="0"]'); await click('[data-next="chars"]');
  await click('[data-night="1"]'); await click('[data-track="1"]'); await click('[data-next="tracks"]');
  await p.waitForFunction(() => { try { return window.__RACE_DEBUG().racers.some((r) => r.isPlayer); }
    catch (e) { return false; } }, { timeout: 60000, polling: 250 }).catch(() => {});
  console.log(JSON.stringify(await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    const kinds = {};
    for (const pr of d.props) kinds[pr.kind] = (kinds[pr.kind] || 0) + 1;
    return { id: d.trackDef.id, night: !!d.trackDef.night, kinds };
  }), null, 1));
  await b.close();
})();
