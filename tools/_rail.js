const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const W = +(process.argv[3] || 1280), H = +(process.argv[4] || 800);
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 1000, hasTouch: W < 1000 });
  await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  const where = process.argv[2] || "keeps";
  const click = async (sel) => { await p.evaluate((q) => { const t = [...document.querySelectorAll("button")]
    .find((x) => x.matches(q)); if (t) t.click(); }, sel); await p.waitForTimeout(700); };
  if (where === "keeps") { await click('[data-keeps="1"]'); }
  else {
    await click('[data-go="single"]'); await click('[data-char="0"]'); await click('[data-next="chars"]');
    await click('[data-track="0"]'); await click('[data-next="tracks"]');
    await p.waitForFunction(() => { try { const d = window.__RACE_DEBUG(); return d && d.racers && d.racers.length; }
      catch (e) { return false; } }, { timeout: 60000, polling: 250 }).catch(() => {});
    await p.waitForTimeout(1200);
    await p.evaluate(() => { let d = window.__RACE_DEBUG();
      for (let i = 0; i < 600 && window.__RACE_DEBUG().state !== "race"; i++) d.step(1/60);
      d = window.__RACE_DEBUG(); const me = d.racers.find((x) => x.isPlayer);
      me.finishTime = 177.6; me.coins = 8; me.place = 4; d.finishRace(); });
    await p.waitForTimeout(2600);
  }
  const r = await p.evaluate(() => {
    const g = (e) => { if (!e) return null; const b = e.getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom),
               w: Math.round(b.width), h: Math.round(b.height) }; };
    const stage = document.querySelector(".rc-stage");
    const ov = document.querySelector(".rc-overlay");
    const panel = document.querySelector(".rc-panel");
    const rail = document.querySelector(".rc-rail");
    const more = document.querySelector(".rc-rail-more");
    const dash = [...panel.querySelectorAll("b")].find((x) => x.textContent.trim() === "—");
    const out = { panelScroll: panel.scrollHeight, panelClient: panel.clientHeight,
                  ovScroll: ov.scrollHeight, ovClient: ov.clientHeight,
                  stage: g(stage), overlay: g(ov), panel: g(panel), rail: g(rail), more: g(more),
                  dash: g(dash), railOn: rail && rail.dataset.on, ovMore: ov.dataset.more,
                  railLeftStyle: rail && rail.style.left, ovPad: getComputedStyle(ov).padding };
    if (dash) {
      const d = dash.getBoundingClientRect();
      const hits = [];
      for (let i = 1; i <= 9; i++) {
        const q = document.elementFromPoint(d.left + d.width * i / 10, d.top + d.height / 2);
        hits.push(q ? q.tagName.toLowerCase() + "." + (typeof q.className === "string" ? q.className.trim().split(/\s+/)[0] : "") : "null");
      }
      out.hits = hits;
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await ctx.close(); await b.close();
})();
