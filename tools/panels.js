/* EVERY PANEL THE RACE PUTS IN FRONT OF HER, MEASURED AGAINST THE STAGE.

   landscape.js, buttons.js and handheld.js walk the gate, the hub, the book
   and the games. None of them has ever been to a results screen, and that
   is where this found the race's worst fault: the panel at the end of a
   round came to 512 points of a 440-point stage, and what was under the
   fold was MENU, KEEP THE PHOTO and NEXT TRACK. She could finish a Grand
   Prix round and have no way to start the next one.

   The track grid is the other one worth watching: six courses wrap to two
   rows where four were one, which is how START ended up 50 points below
   the glass.

   For each panel, on each shape of screen: does it fit, and is every button
   on it somewhere a thumb can reach?

     node tools/panels.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  process.stderr.write(`${c ? "PASS" : "FAIL"}  ${n}${note ? "   " + note : ""}\n`); };

/* A TALL SCREEN IS NOT A SAFE SCREEN. Every size here was 720 or 834
   points of stage or less, and the results panel fitted all of them. On a
   1512x982 laptop -- a MacBook, which is what it was actually opened on --
   the stage is 851 and the panel wants 953, so the three buttons at the
   bottom of it were under the fold and nothing in this file had ever
   stood on a screen tall enough to see that. */
const SCREENS = [
  ["iPhone 16PM sideways",  956, 440],
  ["iPhone 13 Pro sideways", 844, 390],
  ["iPhone 13 Pro, bar up",  844, 340],
  ["iPad",                  1194, 834],
  ["laptop",                1280, 800],
  ["MacBook",               1512, 982],
];

(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

  for (const [tag, w, h] of SCREENS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h },
      deviceScaleFactor: 2, isMobile: w < 1000, hasTouch: w < 1000 });
    await ctx.route("**/*", (r) =>
      r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
    await p.goto(`http://127.0.0.1:${process.argv[2] || 8899}/index.html`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
    await p.waitForTimeout(700);
    await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
    await p.waitForTimeout(9000);

    const click = async (sel) => {
      await p.evaluate((s) => {
        const t = [...document.querySelectorAll("button")].find((x) => x.matches(s));
        if (t) t.click();
      }, sel);
      await p.waitForTimeout(650);
    };
    /* the panel, and whether anything on it is somewhere she cannot get to */
    const measure = () => p.evaluate(() => {
      const panel = document.querySelector(".rc-panel, .rc-title");
      const stage = document.querySelector(".rc-stage");
      if (!panel || !stage) return null;
      const pb = panel.getBoundingClientRect(), sb = stage.getBoundingClientRect();
      const lost = [...panel.querySelectorAll("button")].filter((x) => {
        const r = x.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        return r.top < sb.top - 1 || r.bottom > sb.bottom + 1
            || r.left < sb.left - 1 || r.right > sb.right + 1;
      }).map((x) => (x.textContent || "").trim().slice(0, 16));
      return { h: Math.round(pb.height), stage: Math.round(sb.height),
               over: Math.round(Math.max(0, pb.bottom - sb.bottom)), lost };
    });
    const check = async (label) => {
      const r = await measure();
      ok(`${tag} / ${label}: it fits, and every button is reachable`,
         !!r && r.lost.length === 0 && r.over <= 2,
         r ? `${r.h} of ${r.stage}${r.over ? `, ${r.over} over` : ""}` +
             (r.lost.length ? `  OFF SCREEN: ${r.lost.join(", ")}` : "")
           : "no panel");
    };

    await check("the title");
    await click('[data-badges="1"]');  await check("the badges");
    await click('[data-back="title"]');
    await click('[data-keeps="1"]');   await check("the glovebox");
    await click('[data-back="title"]');
    await click('[data-go="gp"]');     await check("choosing a racer");
    await click('[data-char="0"]');
    await click('[data-next="chars"]');
    /* A BIGGER PICTURE TAKES LONGER TO BAKE. A flat wait that was enough
       for a 440-point phone left the iPad and the laptop still building
       their world, with no racers to finish a race with -- which reads as
       the results panel not existing rather than as not having waited. */
    await p.waitForFunction(() => {
      try {
        const d = window.__RACE_DEBUG();
        return d && d.racers && d.racers.some((r) => r.isPlayer);
      } catch (e) { return false; }
    }, { timeout: 60000, polling: 250 }).catch(() => {});
    await p.waitForTimeout(1200);

    /* and the one nothing had ever looked at */
    const started = await p.evaluate(() => {
      let d = window.__RACE_DEBUG();
      for (let i = 0; i < 60 * 10 && window.__RACE_DEBUG().state !== "race"; i++) d.step(1 / 60);
      d = window.__RACE_DEBUG();
      const me = d.racers && d.racers.find((x) => x.isPlayer);
      if (!me) return false;
      me.finishTime = 71.4;
      me.coins = 6;                 // so the strip under the result has something in it
      d.finishRace();
      return true;
    });
    ok(`${tag} / a race can be finished`, started);
    await p.waitForTimeout(1800);
    await check("the results");

    /* single race, which offers a different set of buttons */
    await p.evaluate(() => { const t = [...document.querySelectorAll("button")]
      .find((x) => /MENU/.test(x.textContent)); if (t) t.click(); });
    await p.waitForTimeout(900);
    await click('[data-go="single"]');
    await click('[data-char="0"]');
    await click('[data-next="chars"]');
    await check("choosing a track");

    ok(`${tag}: no page errors`, errs.length === 0, errs[0] || "");
    await ctx.close();
  }
  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
})();
