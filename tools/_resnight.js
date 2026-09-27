/* the results screen after a race run after dark */
const { chromium } = require("playwright-core");
const fonts = require("./_fontroute");
(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
  if (!(await fonts.attach(ctx)))
    await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 300)));
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  const click = async (sel) => {
    await p.evaluate((s) => { const t = [...document.querySelectorAll("button")].find((x) => x.matches(s));
      if (t) t.click(); }, sel);
    await p.waitForTimeout(700);
  };
  await click('[data-go="single"]');
  await click('[data-char="0"]');
  await click('[data-next="chars"]');
  await click('[data-night="1"]');
  await click('[data-track="0"]');
  await click('[data-next="tracks"]');
  await p.waitForFunction(() => { try { return window.__RACE_DEBUG().racers.some((r) => r.isPlayer); } catch (e) { return false; } },
                          { timeout: 60000, polling: 250 }).catch(() => {});
  await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    for (let i = 0; i < 60 * 140; i++) { d.input.up = true; d.step(1 / 60); }
    d.input.up = false;
    window.__RACE_DEBUG().finishRace();
  });
  await p.waitForTimeout(1600);
  console.log("state:", await p.evaluate(() => window.__RACE_DEBUG().state),
              " track:", await p.evaluate(() => window.__RACE_DEBUG().trackDef.id));
  console.log(await p.evaluate(() => {
    const ov = document.getElementById("rc-overlay");
    const txt = (ov ? ov.innerText : "").replace(/\n{2,}/g, "\n").trim();
    return txt.slice(0, 900);
  }));
  await b.close();
})();
