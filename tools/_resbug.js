/* Reproduce the broken results panel: her race, her course, her result. */
const { chromium } = require("playwright-core");
const fontroute = require("./_fontroute");
const OUT = "/tmp/claude-0/-home-user-anniversary-gift/6a722488-bd45-5266-a49d-0fc55c5f6428/scratchpad/";
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const [tag, w, h] of [["3x2", 1512, 982], ["wide", 1280, 800], ["phone", 956, 440]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5,
      isMobile: w < 1000, hasTouch: w < 1000 });
    const f = await fontroute.attach(ctx);
    if (!f) await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
    await p.waitForTimeout(600);
    await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
    await p.waitForTimeout(9000);
    const click = async (s) => { await p.evaluate((q) => { const t = [...document.querySelectorAll("button")]
      .find((x) => x.matches(q)); if (t) t.click(); }, s); await p.waitForTimeout(600); };
    await click('[data-go="single"]'); await click('[data-char="0"]'); await click('[data-next="chars"]');
    await click('[data-track="5"]');   /* The Long Way Home */
    await click('[data-next="tracks"]');
    await p.waitForFunction(() => { try { const d = window.__RACE_DEBUG(); return d && d.racers && d.racers.length; }
      catch (e) { return false; } }, { timeout: 60000, polling: 250 }).catch(() => {});
    await p.waitForTimeout(1200);
    await p.evaluate(() => { let d = window.__RACE_DEBUG();
      for (let i = 0; i < 600 && window.__RACE_DEBUG().state !== "race"; i++) d.step(1/60);
      d = window.__RACE_DEBUG(); const me = d.racers.find((x) => x.isPlayer);
      me.finishTime = 166.5; me.coins = 10; me.place = 1; d.finishRace(); });
    await p.waitForTimeout(2600);
    const r = await p.evaluate(() => {
      const g = (e) => { if (!e) return null; const b = e.getBoundingClientRect();
        return { t: Math.round(b.top), b: Math.round(b.bottom), h: Math.round(b.height) }; };
      const st = document.querySelector(".rc-stage"), ov = document.querySelector(".rc-overlay");
      const pn = document.querySelector(".rc-panel");
      const out = { stage: g(st), overlay: g(ov), panel: g(pn),
        ovScrollTop: ov ? ov.scrollTop : null, ovScrollH: ov ? ov.scrollHeight : null, ovClientH: ov ? ov.clientHeight : null,
        pnScrollTop: pn ? pn.scrollTop : null, pnScrollH: pn ? pn.scrollHeight : null, pnClientH: pn ? pn.clientHeight : null,
        parts: {} };
      for (const sel of [".rc-h", ".rc-sub", ".rc-podium", ".rc-rest", ".rc-split", ".rc-msg", ".rc-earned", ".rc-row"]) {
        const e = document.querySelector(".rc-panel " + sel);
        out.parts[sel] = e ? g(e) : "MISSING";
      }
      return out;
    });
    console.log("=== " + tag + " " + w + "x" + h + " ===");
    console.log(JSON.stringify(r, null, 1));
    if (errs.length) console.log("PAGEERRORS:", errs.slice(0, 3));
    await p.screenshot({ path: OUT + "resbug-" + tag + ".png" });
    await ctx.close();
  }
  await b.close();
})();
