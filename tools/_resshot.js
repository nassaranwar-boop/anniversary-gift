const { chromium } = require("playwright-core");
const fontroute = require("./_fontroute");
const OUT = "/tmp/claude-0/-home-user-anniversary-gift/6a722488-bd45-5266-a49d-0fc55c5f6428/scratchpad/";
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const [tag, w, h] of [["wide", 1600, 1040], ["phone", 956, 440]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5,
      isMobile: w < 1000, hasTouch: w < 1000 });
    /* the real faces, served from the mirror -- see _fontroute.js */
    const fonts = await fontroute.attach(ctx);
    if (!fonts) await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
    const p = await ctx.newPage();
    await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
    await p.waitForTimeout(700);
    await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
    await p.waitForTimeout(9000);
    const click = async (s) => { await p.evaluate((q) => { const t = [...document.querySelectorAll("button")]
      .find((x) => x.matches(q)); if (t) t.click(); }, s); await p.waitForTimeout(650); };
    await click('[data-go="single"]'); await click('[data-char="0"]'); await click('[data-next="chars"]');
    await click('[data-track="0"]'); await click('[data-next="tracks"]');
    await p.waitForFunction(() => { try { const d = window.__RACE_DEBUG(); return d && d.racers && d.racers.length; }
      catch (e) { return false; } }, { timeout: 60000, polling: 250 }).catch(() => {});
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
      let d = window.__RACE_DEBUG();
      for (let i = 0; i < 600 && window.__RACE_DEBUG().state !== "race"; i++) d.step(1 / 60);
      d = window.__RACE_DEBUG();
      const me = d.racers.find((x) => x.isPlayer);
      me.finishTime = 177.6; me.coins = 8; me.place = 4;
      d.finishRace();
    });
    await p.waitForTimeout(2500);
    const faces = await p.evaluate(async () => { await document.fonts.ready;
      return { n: document.fonts.size, msg: getComputedStyle(document.querySelector(".rc-msg")).fontFamily }; });
    console.log("  faces loaded:", faces.n, "| message set in:", faces.msg);
    await p.screenshot({ path: OUT + "res-" + tag + ".png" });
    console.log(tag, "shot");
    await ctx.close();
  }
  await b.close();
})();
