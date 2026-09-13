const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const [tag, w, h] of [["844x390", 844, 390], ["956x440", 956, 440], ["844x340", 844, 340]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true });
    await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
    const p = await ctx.newPage();
    await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
    await p.waitForTimeout(700);
    await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
    await p.waitForTimeout(9000);
    const r = await p.evaluate(() => {
      const out = [];
      const panel = document.querySelector(".rc-panel, .rc-title");
      for (const el of panel.querySelectorAll("button")) {
        const b = el.getBoundingClientRect();
        out.push({ cls: el.className.split(/\s+/).slice(0,2).join("."),
                   t: (el.textContent||"").trim().slice(0,14),
                   w: Math.round(b.width), h: Math.round(b.height) });
      }
      const st = document.querySelector(".rc-stage").getBoundingClientRect();
      const pn = panel.getBoundingClientRect();
      return { stage: [Math.round(st.width), Math.round(st.height)],
               panel: Math.round(pn.height), btns: out };
    });
    console.log(tag, "stage", r.stage.join("x"), "panel", r.panel);
    for (const x of r.btns) console.log("   ", (x.h < 44 ? "SHORT " : "      "), x.h + "px", x.cls, "|", x.t);
    await ctx.close();
  }
  await b.close();
})();
