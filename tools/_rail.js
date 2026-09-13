const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  await p.evaluate(() => { const t = [...document.querySelectorAll("button")].find((x) => x.matches('[data-keeps="1"]')); if (t) t.click(); });
  await p.waitForTimeout(900);
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
    const out = { stage: g(stage), overlay: g(ov), panel: g(panel), rail: g(rail), more: g(more),
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
