/* WHO PAYS WHEN TWO KARTS TOUCH.

   The complaint was specific and it was right: "when the other racers get
   so close to you, you are the one getting slowed down and left behind."
   The code said so too. Contact took seven per cent off BOTH karts, with
   no regard for who had run into whom, and it did it EVERY FRAME the two
   of them overlapped -- twenty frames of rubbing down a straight is
   0.93^20, which is a quarter of your speed, for being driven into.

   Four things are checked here, and all four of them failed before:

     - a kart rear-ended from behind does not lose speed for it
     - the kart that arrived too fast does
     - being leaned on for a solid second does not compound
     - and two AI karts settle it between themselves the same way

     node tools/fair.js
*/
/* A KART ON SCREEN NO LONGER MEANS A RACE IS RUNNING. The menus have a
   backdrop behind them now -- a road with karts on it -- so `racers` is
   never empty between races. What says a race has started is a kart that
   is HERS, which is what every wait below asks for. */
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  process.stderr.write(`${c ? "PASS" : "FAIL"}  ${n}${note ? "   " + note : ""}\n`); };

(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--no-proxy-server", "--disable-gpu"] });
  const p = await b.newPage({ viewport: { width: 1180, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  await p.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  const click = async (sel) => {
    await p.evaluate((s) => { const t = [...document.querySelectorAll("button")].find((x) => x.matches(s));
      if (t) t.click(); }, sel);
    await p.waitForTimeout(650);
  };
  await click('[data-go="single"]');
  await click('[data-char="0"]');
  await click('[data-next="chars"]');
  await click('[data-track="0"]');
  await click('[data-next="tracks"]');
  await p.waitForFunction(() => { try { return window.__RACE_DEBUG().racers.some((r) => r.isPlayer); } catch (e) { return false; } },
                          { timeout: 60000, polling: 250 }).catch(() => {});

  const r = await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    for (let i = 0; i < 60 * 10 && window.__RACE_DEBUG().state !== "race"; i++) d.step(1 / 60);

    const R = () => window.__RACE_DEBUG().racers;
    const me = () => R().find((x) => x.isPlayer);
    const out = {};

    /* THE CONTROL HAS TO BE THE SAME CORNER.

       The first honest version of this test spun her up, measured her
       coasting somewhere on the lap, spun her up again and measured the
       shunt somewhere else -- and the two numbers disagreed by more than
       the thing being measured, because one of them was taken with her
       shoulder against a wall. A kart's speed depends on where it is.

       So both runs start from the SAME saved state: drive her up to
       speed, write down everything that moves, run the shunt, put her
       back exactly as she was, and run the identical frames again with
       nobody near her. The difference between the two is the contact and
       nothing else. */
    const FIELDS = ["x", "y", "speed", "angle", "steer", "yaw", "roll", "dip",
                    "air", "boost", "offroad", "knock", "along", "lap", "progress",
                    "vx", "vy", "hop", "squash", "drifting", "driftCharge", "autoDrift"];
    const snap = (r) => { const o = {}; for (const f of FIELDS) o[f] = r[f]; return o; };
    const put  = (r, o) => { for (const f of FIELDS) if (o[f] !== undefined) r[f] = o[f]; };

    const spinUp = () => {
      for (let i = 0; i < 240; i++) { d.input.up = true; d.step(1 / 60); }
      d.input.up = false;
    };
    const park = (r) => { r.x += 6000; r.y += 6000; };
    const shunt = (front, rear) => {
      rear.angle = front.angle;
      rear.x = front.x - Math.cos(front.angle) * 26;
      rear.y = front.y - Math.sin(front.angle) * 26;
      rear.progress = front.progress - 0.001;
      rear.speed = front.speed + 4;
      rear.knock = 0;
    };
    const runFor = (n) => { for (let i = 0; i < n; i++) d.step(1 / 60); };

    /* --- she is in front, and gets hit --- */
    spinUp();
    {
      const her = me();
      const rear = R().find((x) => !x.isPlayer);
      const before = snap(her), rearBefore = snap(rear);

      shunt(her, rear);
      const r0 = rear.speed;
      runFor(6);
      const hitLoss = before.speed - her.speed;
      const rearEnd = rear.speed;

      /* and the identical six frames from the identical place, alone */
      put(her, before); put(rear, rearBefore); park(rear);
      runFor(6);
      const soloLoss = before.speed - her.speed;

      out.hit = { hitLoss: +hitLoss.toFixed(4), soloLoss: +soloLoss.toFixed(4),
                  from: +before.speed.toFixed(3),
                  r0: +r0.toFixed(3), r1: +rearEnd.toFixed(3) };
    }

    /* --- and leaned on for a solid second --- */
    spinUp();
    {
      const her = me();
      const rear = R().find((x) => !x.isPlayer);
      const before = snap(her), rearBefore = snap(rear);

      for (let i = 0; i < 60; i++) { shunt(her, rear); d.step(1 / 60); }
      const leanLoss = before.speed - her.speed;

      put(her, before); put(rear, rearBefore); park(rear);
      runFor(60);
      const soloLoss = before.speed - her.speed;

      out.lean = { leanLoss: +leanLoss.toFixed(4), soloLoss: +soloLoss.toFixed(4) };
    }

    /* --- and the same rule between two AI karts. They regulate their own
       speed towards a target every frame, so neither holds a shunt for
       long; what has to be true is that the one who arrived too fast
       loses far more of it than the one who was hit. --- */
    {
      const ai = R().filter((x) => !x.isPlayer);
      const front = ai[0], rear = ai[1];
      shunt(front, rear);
      const f0 = front.speed, r0 = rear.speed;
      runFor(6);
      out.ai = { fLost: +(f0 - front.speed).toFixed(3), rLost: +(r0 - rear.speed).toFixed(3) };
    }
    return out;
  });

  ok("the harness got her up to speed and shunted her",
     !!r && !!r.hit && r.hit.from > 1,
     r && r.hit ? `she was running at ${r.hit.from}` : "");
  if (r && r.hit) {
    /* Not "nothing at all" -- a bump costs the person bumped a little
       everywhere, and it should. The bar is that it costs her less than
       one per cent of her speed. The code this replaced took SEVEN per
       cent off her, per frame, for as long as the two of them were
       touching. */
    ok("being rear-ended costs her under one per cent of her speed",
       (r.hit.hitLoss - r.hit.soloLoss) <= r.hit.from * 0.01,
       `the contact cost her ${(r.hit.hitLoss - r.hit.soloLoss).toFixed(4)} of ${r.hit.from}` +
       ` — ${(((r.hit.hitLoss - r.hit.soloLoss) / r.hit.from) * 100).toFixed(2)}%`);
    ok("and the kart that drove into her is the one that pays",
       r.hit.r1 < r.hit.r0 - 0.05,
       `he arrived on ${r.hit.r0} and left on ${r.hit.r1}`);
    ok("a second of being leaned on does not bleed her dry",
       r.lean.leanLoss <= r.lean.soloLoss + 0.04,
       `${r.lean.leanLoss} lost over sixty frames of contact, against ${r.lean.soloLoss} alone`);
    ok("two AI karts settle it the same way round",
       r.ai.rLost > r.ai.fLost * 2,
       `the one who ran in lost ${r.ai.rLost}, the one who was hit lost ${r.ai.fLost}`);
  }
  ok("and none of it threw", errs.length === 0, errs[0] || "");
  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
