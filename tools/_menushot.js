const { chromium } = require("playwright-core");
const fs = require("fs");
const fonts = require("./_fontroute");
(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
  if (!(await fonts.attach(ctx)))
    await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  const WAIT = +(process.env.WAIT || 0); if (WAIT) await p.waitForTimeout(WAIT);
  const stage = await p.$(".rc-stage");
  const box = await stage.boundingBox();
  await p.screenshot({ path: process.env.SHOT || "/tmp/claude-0/menu.png", clip: box, timeout: 90000 });
  console.log("menu:", await p.evaluate(() => document.querySelector(".rc-stage").dataset.menu));
  await b.close();
})();
