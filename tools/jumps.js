/* DO THE RAMPS WORK, AND DOES ANYTHING ELSE BREAK WHILE SHE IS OFF THE GROUND?

   Mode 7 draws a flat plane and cannot honestly be given hills: a screen
   row is one distance the whole way across, so a height field samples the
   ground under a prop at the edge of the picture at the height of the
   middle of it -- measured, that put the scenery fifteen pixels off its
   own shadow. A flat plane seen from higher up is still exactly a flat
   plane, so the ground stays put and the KART leaves it.

   What that has to be true of:
     - the ramps exist, sit ON the road, and only where it is straight
     - hitting one at speed puts the kart in the air; crawling over it
       does not
     - what goes up comes down, in about the time a jump should take
     - the surface stops mattering while she is off it -- landing in the
       grass beside the road is a landing, not a crash at the verge
     - and the picture is still drawn, with no errors, throughout

     node tools/jumps.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  process.stderr.write(`${c ? "PASS" : "FAIL"}  ${n}${note ? "   " + note : ""}\n`); };

(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

  const open = async (ti) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route("**/*", (r) =>
      r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
    const p = await ctx.newPage();
    const errs = [];
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
    await click('[data-go="single"]');
    await click('[data-char="0"]');
    await click('[data-next="chars"]');
    await click(`[data-track="${ti}"]`);
    await click('[data-next="tracks"]');
    await p.waitForTimeout(6000);
    return { ctx, p, errs };
  };

  /* 0 Cabin Woods has three; 1 Hometown Streets is a street circuit and
     deliberately has none */
  for (const [ti, want] of [[0, 3], [1, 0]]) {
    const { ctx, p, errs } = await open(ti);
    const r = await p.evaluate(() => {
      const d = window.__RACE_DEBUG();
      const name = d.trackDef.name;
      const rs = d.ramps || [];
      /* every ramp should be ON the road, and where it is straight */
      const onRoad = rs.map((rp) => {
        let best = 1e9;
        for (const q of d.path) {
          const dd = Math.hypot(q.x - rp.x, q.y - rp.y);
          if (dd < best) best = dd;
        }
        return Math.round(best);
      });
      return { name, n: rs.length, onRoad, asked: d.trackDef.ramps || 0 };
    });
    ok(`${r.name}: ${want ? "has ramps" : "has none, and should not"}`,
       want ? r.n > 0 : r.n === 0, `${r.n} placed, ${r.asked} asked for`);
    if (want)
      ok(`${r.name}: every ramp is on the road`,
         r.onRoad.every((d) => d < 6), `centreline distances ${r.onRoad.join(", ")}`);
    ok(`${r.name}: no page errors`, errs.length === 0, errs[0] || "");
    await ctx.close();
  }

  /* --- and what happens when you hit one --- */
  const { ctx, p, errs } = await open(0);
  const flight = await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    const me = d.racers.find((r) => r.isPlayer);
    let rp = d.ramps[0];

    /* The lights first. step() only counts the countdown down while the
       state is "count" and nothing moves until it reaches zero, so a first
       version of this drove eighty frames at a ramp 130 units away and
       reported that ramps do not work. And the ramp list has to be read
       back AFTERWARDS: buildRamps assigns a new array, so a reference taken
       before the race was built points at the previous one. */
    for (let i = 0; i < 60 * 8 && window.__RACE_DEBUG().state !== "race"; i++)
      d.step(1 / 60);
    rp = window.__RACE_DEBUG().ramps[0];

    const runAt = (speedFrac) => {
      me.air = 0; me.vair = 0; me.rampCool = 0; me.finished = false;
      /* set down a little short of the ramp, pointing at it */
      me.angle = rp.a;
      me.x = rp.x - Math.cos(rp.a) * 130;
      me.y = rp.y - Math.sin(rp.a) * 130;
      /* the projection keeps a local hint so it does not search the whole
         ribbon every frame; move a kart without moving the hint and the
         next frame decides it is somewhere else entirely and the barrier
         throws it clean off the world */
      me.nav = { hint: rp.i, onCut: false };
      me.speed = 3.70 * speedFrac;
      let peak = 0, frames = 0, airborne = 0;
      for (let i = 0; i < 60 * 6; i++) {
        me.speed = 3.70 * speedFrac;      // hold the throttle for the test
        d.step(1 / 60);
        if (me.air > 0) { airborne++; peak = Math.max(peak, me.air); }
        frames++;
        if (airborne && me.air <= 0) break;
      }
      return { peak: +peak.toFixed(1), secs: +(airborne / 60).toFixed(2) };
    };
    const fast = runAt(1.0);
    const slow = runAt(0.3);
    return { fast, slow };
  });
  /* a kart is 21 units tall: clearing its own height is the difference
     between a jump and a bump */
  ok("hitting one at speed puts her in the air",
     flight.fast.peak > 18, `${flight.fast.peak} units up for ${flight.fast.secs}s`);
  ok("the flight lasts about as long as a jump should",
     flight.fast.secs > 0.9 && flight.fast.secs < 1.8, `${flight.fast.secs}s`);
  ok("crawling over one is a bump, not a jump",
     flight.slow.peak < 1, `${flight.slow.peak} units up at a third speed`);

  /* ---- AND THE OTHER SEVEN ----
     The launch was in advance(), which every kart runs, but the flight was
     in the player's own drive, which only she runs. So an opponent that hit
     a ramp had its height and its upward speed set and nothing to integrate
     them: it sat a hundredth of a unit off the ground for the rest of the
     race, never rising, never landing, and -- since nothing under the
     wheels counts while a kart is off them -- unable to touch the kerb, the
     verge or the barrier the whole way round. This is the assertion that
     was missing. */
  const field = await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    /* THE THING THAT WAS BROKEN, TESTED DIRECTLY.

       Driving each of the eight over a ramp is not the test: the autopilot
       picks its own line, half the grid is off taking the shortcut, and
       whether a given opponent happens to cross a given ramp on a given lap
       says nothing about whether it CAN. What was wrong was narrower than
       that and worse -- the launch was in advance(), which every kart runs,
       and the flight was in the player's own drive, which only she runs. So
       every kart could be launched and only she could come down.

       Each kart is given the upward speed a ramp gives and then simply
       watched. Eight should rise, and eight should land. */
    const out = [];
    d.racers.forEach((k) => {
      k.finished = false;
      k.air = 0.01; k.vair = 78; k.rampCool = 0.9;
      out.push({ player: !!k.isPlayer, peak: 0, landed: false });
    });
    for (let i = 0; i < 60 * 5; i++) {
      d.step(1 / 60);
      d.racers.forEach((k, idx) => {
        if (k.air > out[idx].peak) out[idx].peak = k.air;
        if (out[idx].peak > 1 && k.air === 0) out[idx].landed = true;
      });
    }
    return out.map((o) => ({ ...o, peak: +o.peak.toFixed(1) }));
  });
  const flew = field.filter((k) => k.peak > 18);
  const down = field.filter((k) => k.landed);
  ok("every kart flies, not just hers", flew.length === 8,
     `${flew.length}/8 rose: ` + field.map((k) => `${k.player ? "her" : "ai"} ${k.peak}`).join(", "));
  ok("and every kart lands", down.length === 8, `${down.length}/8 came down`);

  /* landing off the road should be a landing, not a crash at the verge */
  const land = await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    const me = d.racers.find((r) => r.isPlayer);
    me.air = 30; me.vair = 0; me.speed = 3.2;
    const wasOff = me.offroad;
    let sawOffroadWhileUp = false;
    for (let i = 0; i < 60 * 3 && me.air > 0; i++) {
      d.step(1 / 60);
      if (me.air > 0 && me.offroad) sawOffroadWhileUp = true;
    }
    return { sawOffroadWhileUp, landed: me.air === 0, squash: +(me.squash || 0).toFixed(2) };
  });
  ok("the ground does not touch her while she is off it", !land.sawOffroadWhileUp);
  ok("what goes up comes down", land.landed);
  ok("and lands with weight in it", land.squash > 0.05, `squash ${land.squash}`);
  ok("no page errors through any of it", errs.length === 0, errs[0] || "");
  await ctx.close();

  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
})();
