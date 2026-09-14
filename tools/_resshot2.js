/* THE RESULTS SCREEN, AS SHE WILL SEE IT.

   Two things make this awkward to photograph. Nothing is driving her kart
   in a headless browser -- no thumb on the stick, no key down -- so a race
   stepped by hand never ends; and the flag itself is not in step(), it is
   in the rAF frame, which runs at about three a second in here. So the
   throttle is held for her while the field runs, and then the same
   finishRace the last lap calls is called directly. */
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
  p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 160)));
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
  await p.waitForTimeout(1400);
  console.log("state:", await p.evaluate(() => window.__RACE_DEBUG().state),
              " menu:", await p.evaluate(() => document.querySelector(".rc-stage").dataset.menu));
  const stage = await p.$(".rc-stage");
  const box = await stage.boundingBox();
  await p.screenshot({ path: "/tmp/claude-0/results.png", clip: box, timeout: 90000 });
  await b.close();
})();
