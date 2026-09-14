/* the stick, held over, on a phone -- and the pad with no DRIFT key on it */
const { chromium } = require("playwright-core");
const fonts = require("./_fontroute");
(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
  const ctx = await b.newContext({ viewport: { width: 874, height: 402 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
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
  const click = async (sel) => { await p.evaluate((s) => { const t = [...document.querySelectorAll("button")]
      .find((x) => x.matches(s)); if (t) t.click(); }, sel); await p.waitForTimeout(650); };
  await click('[data-go="single"]'); await click('[data-char="0"]'); await click('[data-next="chars"]');
  await click('[data-track="0"]'); await click('[data-next="tracks"]');
  await p.waitForFunction(() => { try { return window.__RACE_DEBUG().racers.length; } catch (e) { return false; } },
                          { timeout: 60000, polling: 250 }).catch(() => {});
  await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    for (let i = 0; i < 60 * 8; i++) { d.input.up = true; d.step(1 / 60); }
    /* and put a thumb on the stick, held over to the right */
    const zone = document.getElementById("rc-steer");
    const stage = document.querySelector(".rc-stage");
    const sb = stage.getBoundingClientRect();
    const cx = sb.left + sb.width * 0.30, cy = sb.top + sb.height * 0.62;
    const radius = Math.max(34, stage.clientWidth * 0.115);
    const touch = (type, x, y) => {
      const t = new Touch({ identifier: 7, target: zone, clientX: x, clientY: y });
      zone.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
        touches: type === "touchend" ? [] : [t], changedTouches: [t] }));
    };
    touch("touchstart", cx, cy);
    touch("touchmove", cx + radius * 0.92, cy - radius * 0.30);
    for (let i = 0; i < 40; i++) { d.input.up = true; d.step(1 / 60); }
    d.draw();
  });
  await p.waitForTimeout(400);
  const stage = await p.$(".rc-stage");
  const box = await stage.boundingBox();
  await p.screenshot({ path: "/tmp/claude-0/stick.png", clip: box, animations: "disabled" });
  console.log("shot");
  await b.close();
})();
