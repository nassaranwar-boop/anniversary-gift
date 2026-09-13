/* CAN THE COURSES ACTUALLY BE DRIVEN, AND HOW LONG DOES A LAP TAKE?

   trackcheck.js judges a course as geometry -- length, corner radius, where
   the shortcut lands. None of that proves a kart can get round it. This
   drives one: it opens each course, then steps the game's own simulation by
   hand at a fixed sixtieth of a second, which runs a whole race in a few
   hundred milliseconds of real time. (It has to be by hand. Under a
   headless browser the clock barely advances -- the starting countdown sat
   at three for fourteen real seconds -- so nothing can be measured by
   waiting for it.)

   What it asserts, per course:
     - every one of the eight karts completes a lap
     - nobody is left crawling, which is what a corner too tight to hold
       or a shortcut that snaps you across the infield looks like from here
     - the lap times land in a band a person would enjoy
     - the leader's laps are consistent, so no one corner is a wall
     - the field does not finish strung out, and does not finish as one
       lump either

     node tools/racelap.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  process.stderr.write(`${c ? "PASS" : "FAIL"}  ${n}${note ? "   " + note : ""}\n`); };

(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

  const errs = [];
  const openTrack = async (ti) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route("**/*", (r) =>
      r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
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
      await p.waitForTimeout(600);
    };
    /* the order matters: data-next="chars" is the GO on the CHARACTER
       screen and data-next="tracks" is the START on the TRACK screen, so
       clicking them in the order they are named starts the race before a
       track has been chosen -- which is how four runs of this all came back
       saying Cabin Woods */
    await click('[data-go="single"]');
    await click('[data-char="0"]');
    await click('[data-next="chars"]');
    await click(`[data-track="${ti}"]`);
    await click('[data-next="tracks"]');
    await p.waitForTimeout(6000);
    return { ctx, p };
  };

  for (let ti = 0; ti < 4; ti++) {
    const { ctx, p } = await openTrack(ti);

    const r = await p.evaluate(() => {
      const d = window.__RACE_DEBUG();
      const name = d.trackDef.name, laps = d.trackDef.laps;
      /* Nobody is holding the throttle in here, so her kart would sit on the
         line for the whole race and report the course as impassable. The
         autopilot drives all eight instead: what is being asked is whether
         the racing line can be driven at all, from the grid, by something
         that is not cheating -- and the AI is held to the same physics. */
      d.racers.forEach((x) => { x.isPlayer = false; });
      const DT = 1 / 60;
      const lapLog = d.racers.map(() => []);
      let prevLap = d.racers.map((x) => x.lap);
      let t = 0, lastT = d.racers.map(() => 0);
      for (let i = 0; i < 60 * 400 && window.__RACE_DEBUG().state !== "results"; i++) {
        d.step(DT);
        t += DT;
        const rs = window.__RACE_DEBUG().racers;
        rs.forEach((x, k) => {
          if (x.lap > prevLap[k]) {
            if (x.lap >= 1) lapLog[k].push(+(t - lastT[k]).toFixed(2));
            lastT[k] = t; prevLap[k] = x.lap;
          }
        });
      }
      const rs = window.__RACE_DEBUG().racers;
      const done = lapLog.map((l) => l.length);
      /* whoever never got round, and what they were doing instead */
      const stuck = rs.map((x, k) => ({ k, name: x.def && x.def.name, laps: done[k],
            along: +x.along.toFixed(3), speed: +x.speed.toFixed(2),
            off: !!x.offroad }))
        .filter((x) => x.laps === 0);
      return {
        name, laps, t: +t.toFixed(1),
        state: window.__RACE_DEBUG().state,
        home: rs.filter((x) => x.finished).length,
        anyLap: done.filter((n) => n > 0).length,
        lead: lapLog.reduce((a, l) => (l.length > a.length ? l : a), []),
        slowest: Math.max(...lapLog.filter((l) => l.length).map((l) => Math.max(...l))),
        fastest: Math.min(...lapLog.filter((l) => l.length).map((l) => Math.min(...l))),
        stuck,
        perKart: rs.map((x, k) => ({ n: x.def && x.def.name, laps: lapLog[k],
              home: !!x.finished, cut: !!x.takesCut })),
        finishSpread: (() => {
          const f = rs.filter((x) => x.finished).map((x) => x.finishTime).sort((a, b) => a - b);
          return f.length > 1 ? +(f[f.length - 1] - f[0]).toFixed(1) : null;
        })(),
      };
    });

    const tag = r.name;
    ok(`${tag}: every kart gets round`, r.anyLap === 8,
       r.anyLap === 8 ? "8/8" : `${r.anyLap}/8 — stuck: ` + JSON.stringify(r.stuck));
    /* not state === "results": that is reached through onPlayerFinished, and
       there is no player in this field -- the autopilot is driving all eight */
    ok(`${tag}: every kart gets home`, r.home === 8,
       `${r.home}/8 home after ${r.t}s of racing`);
    ok(`${tag}: a lap is worth driving`, r.fastest > 20 && r.slowest < 95,
       `${r.fastest}s - ${r.slowest}s over ${r.laps} laps`);
    /* one corner tight enough to stop a kart shows up as one lap far longer
       than the rest, on the kart that keeps finding it */
    ok(`${tag}: no corner is a wall`,
       r.lead.length > 1 && Math.max(...r.lead) / Math.min(...r.lead) < 1.7,
       `leader's laps ${r.lead.join(", ")}`);
    ok(`${tag}: the field stays a race`,
       r.finishSpread != null && r.finishSpread > 0.5 && r.finishSpread < 70,
       `${r.finishSpread}s from first to last`);

    /* IS THE SHORTCUT WORTH TAKING? REPORTED, NOT ASSERTED -- YET.

       About half the grid knows about each one, which makes the field its
       own control group: mean lap of the half that takes it against the
       half that does not. Under 1.00 means it pays.

       Measured on the four courses as they shipped, through this same
       harness: 1.05, 1.08, 1.04, 1.07. Not one of the four was ever worth
       taking. A cut is narrower than the road it leaves (CUT_HALF 30
       against ROAD_HALF 46) and is entered at an angle, so the distance it
       saves has to beat the speed it costs, and none of them did.

       It is a report rather than a failure because it is not a regression
       and the number moves a few points run to run -- the autopilot picks
       its lines with some randomness. Tightening it into an assertion means
       first making a cut that reliably pays, which is the next piece of
       work on this game, not this one. */
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
    const lapsOf = (f) => r.perKart.filter(f).flatMap((x) => x.laps);
    const withCut = mean(lapsOf((x) => x.cut)), without = mean(lapsOf((x) => !x.cut));
    process.stderr.write(`      ${tag}: the shortcut ` +
      `${withCut < without ? "pays" : "costs"} \u2014 ${withCut.toFixed(0)}s with it ` +
      `vs ${without.toFixed(0)}s without (${(withCut / without).toFixed(2)}; ` +
      `shipped 1.04-1.08)\n`);

    await ctx.close();
  }
  ok("no page errors on any of them", errs.length === 0, errs[0] || "");
  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
})();
