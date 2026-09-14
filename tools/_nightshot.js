/* a race after dark -- the sky, the palette and the lights */
const { chromium } = require("playwright-core");
const fonts = require("./_fontroute");
(async () => {
  const TRACK = process.env.TRACK || "0";
  const NIGHT = process.env.NIGHT !== "0";
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
  if (!(await fonts.attach(ctx)))
    await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  const click = async (sel) => { const hit = await p.evaluate((s) => {
      const t = [...document.querySelectorAll("button")].find((x) => x.matches(s));
      if (t) { t.click(); return true; } return false; }, sel);
    await p.waitForTimeout(650); return hit; };
  await click('[data-go="single"]'); await click('[data-char="0"]'); await click('[data-next="chars"]');
  if (NIGHT) console.log("night button:", await click('[data-night="1"]'));
  console.log("varnote:", await p.evaluate(() => {
    const n = document.querySelector(".rc-varnote"); return n ? n.textContent.trim() : "(none)"; }));
  await click(`[data-track="${TRACK}"]`); await click('[data-next="tracks"]');
  await p.waitForFunction(() => { try { return window.__RACE_DEBUG().racers.some((r) => r.isPlayer); }
    catch (e) { return false; } }, { timeout: 60000, polling: 250 }).catch(() => {});
  const info = await p.evaluate((frames) => {
    const d = window.__RACE_DEBUG();
    for (let i = 0; i < frames; i++) { d.input.up = true; d.step(1 / 60); }
    d.draw();
    const t = d.trackDef || (d.track && d.track.def) || null;
    return { id: t && t.id, night: !!(t && t.night), sky: t && t.sky, haze: t && t.haze,
             road: t && t.road, grass: t && t.grass };
  }, +(process.env.FRAMES || 60 * 9));
  console.log(JSON.stringify(info));
  await p.waitForTimeout(300);
  const stage = await p.$(".rc-stage");
  const box = await stage.boundingBox();
  await p.screenshot({ path: process.env.SHOT || "/tmp/claude-0/night.png", clip: box, timeout: 90000 });
  await b.close();
})();
