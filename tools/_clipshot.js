/* The clip player, on the page it lives on, at phone width and with the
   real faces loaded. */
const { chromium } = require("playwright-core");
const fontroute = require("./_fontroute");
const OUT = "/tmp/claude-0/-home-user-anniversary-gift/6a722488-bd45-5266-a49d-0fc55c5f6428/scratchpad/";
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 3,
    isMobile: false, hasTouch: true });
  const fonts = await fontroute.attach(ctx);
  if (!fonts) await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 120)));
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { showScreen("scrapbook"); if (window.Scrapbook && Scrapbook.skipIntro) Scrapbook.skipIntro(); });
  await p.waitForTimeout(3500);
  /* walk the spreads until the clip player is on screen */
  let found = false;
  for (let i = 0; i < 14; i++) {
    found = await p.evaluate(() => {
      const w = document.querySelector(".sb-w-ourvideo");
      if (!w) return false;
      const r = w.getBoundingClientRect();
      return r.width > 40 && r.bottom > 0 && r.top < innerHeight;
    });
    if (found) break;
    await p.evaluate(() => Scrapbook.next && Scrapbook.next());
    await p.waitForTimeout(1400);
  }
  await p.waitForTimeout(1500);
  const box = await p.evaluate(() => {
    const w = document.querySelector(".sb-w-ourvideo");
    if (!w) return null;
    const r = w.getBoundingClientRect();
    return { x: Math.max(0, r.left - 18), y: Math.max(0, r.top - 18),
             width: Math.min(innerWidth, r.width + 36), height: Math.min(innerHeight, r.height + 60) };
  });
  console.log("found:", found, "box:", JSON.stringify(box));
  const faces = await p.evaluate(async () => { await document.fonts.ready; return document.fonts.size; });
  console.log("faces:", faces);
  if (box && box.width > 20 && box.height > 20) await p.screenshot({ path: OUT + "clip.png", clip: box });
  else await p.screenshot({ path: OUT + "clip.png" });
  await ctx.close(); await b.close();
})();
