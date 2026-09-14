/* THE SIX POSTERS, SIDE BY SIDE.

   One per course, drawn on the real canvas by the real code, with the
   results panel hidden -- because the point of looking at them together
   is to see whether they are six of one set or six unrelated pictures.

     node tools/posters.js        -> /tmp/claude-0/poster-<id>.png
*/
const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
  const p = await b.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
  p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
  await p.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(11000);
  const stage = await p.$(".rc-stage");
  const box = await stage.boundingBox();
  const ids = await p.evaluate(() => window.__RACE_DEBUG().TRACKS.map((t) => t.id));
  for (const id of ids) {
    await p.evaluate((i) => {
      const ov = document.getElementById("rc-overlay");
      if (ov) ov.style.visibility = "hidden";
      /* the loop repaints the globe every frame, so the poster has to be
         pinned rather than drawn once */
      window.__rcForcePoster = i;
      for (let k = 0; k < 90; k++) window.__rcPoster(i, 1 / 30);
    }, id);
    await p.waitForTimeout(400);
    await p.screenshot({ path: "/tmp/claude-0/poster-" + id + ".png", clip: box, timeout: 60000 });
    console.log("shot", id);
  }
  await b.close();
})();
