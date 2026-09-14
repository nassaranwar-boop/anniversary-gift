/* THE MENU'S SKY.

   Three things about it are easy to get wrong and impossible to check in
   a still picture, because everything up there is moving:

     - both of them have to be there. They used to orbit, and whichever
       one was round the back of the planet simply was not in the picture.
     - they have to stay exactly half a lap apart. They are the only two
       things in orbit now -- the moon is gone -- and the whole balance of
       the picture is that the line between them runs through the middle
       of the world at every moment of the turn.
     - and neither may leave the glass, which is how the first version
       hid Anwar behind the left edge for half of every lap.

   So the clock is run for two full minutes of scene time and every frame
   is checked.

     node tools/space.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++;
  process.stderr.write(`${c ? "PASS" : "FAIL"}  ${n}${x ? "   " + x : ""}\n`); };
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
  const p = await b.newPage({ viewport: { width: 1200, height: 760 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await p.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(11000);

  const r = await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    if (!d.space) return null;
    /* step the sky by hand for two minutes of its own time */
    const out = { frames: 0, missing: 0, offGlass: [], seen: {}, mid: [], sameSide: 0 };
    for (let i = 0; i < 60 * 120; i += 4) {
      window.__rcStepSpace(4 / 60);
      const s = window.__RACE_DEBUG().space;
      if (!s) break;
      out.frames++;
      const who = Object.keys(s.seen);
      if (who.length < 2) { out.missing++; continue; }
      for (const k of who) {
        const f = s.seen[k];
        out.seen[k] = (out.seen[k] || 0) + 1;
        if (f.x - f.w / 2 < 0 || f.x + f.w / 2 > s.w ||
            f.y - f.h / 2 < 0 || f.y + f.h / 2 > s.h) out.offGlass.push(k);
      }
      /* opposite ends of the same diameter: their midpoint is the centre
         of the orbit, every frame */
      const o = s.seen.ouissy, n2 = s.seen.anwar;
      if (o && n2) {
        out.mid.push([(o.x + n2.x) / 2, (o.y + n2.y) / 2]);
        if (o.near === n2.near) out.sameSide++;
      }
    }
    return out;
  });

  ok("the sky answers", !!r && r.frames > 100, r ? r.frames + " frames stepped" : "no hook");
  if (r) {
    ok("both of them are in the picture, every frame",
       r.missing === 0 && (r.seen.ouissy || 0) === r.frames && (r.seen.anwar || 0) === r.frames,
       `ouissy ${r.seen.ouissy || 0}, anwar ${r.seen.anwar || 0} of ${r.frames}`);
    ok("neither of them leaves the glass",
       r.offGlass.length === 0,
       r.offGlass.length ? r.offGlass.length + " frames off the edge (" + r.offGlass[0] + ")" : "");
    /* the midpoint of two things on opposite ends of a diameter never
       moves; if it wanders, they are not half a lap apart */
    const mx = r.mid.map((m) => m[0]), my = r.mid.map((m) => m[1]);
    const spread = Math.max(Math.max(...mx) - Math.min(...mx),
                            Math.max(...my) - Math.min(...my));
    ok("they stay exactly half a lap apart",
       spread < 1.5 && r.sameSide === 0,
       `their midpoint wanders ${spread.toFixed(2)}px over the whole turn` +
       (r.sameSide ? `, and they were on the same side for ${r.sameSide} frames` : ""));
  }
  ok("and none of it threw", errs.length === 0, errs[0] || "");
  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
