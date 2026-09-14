/* HOW THE STICK FEELS, AS NUMBERS.

   "It doesn't feel good" is a real report and a hard one to act on, so this
   pins down the four things that were actually wrong with it.

     - a thumb resting still counts as centred. It was linear from zero, so
       every tremor on the glass went to the wheels and the kart hunted down
       a straight.
     - half the travel is not half the lock. Linear means a correction and a
       hairpin ask for the same kind of movement; a curve means the middle of
       the travel is for corrections and only the end of it is for hairpins.
     - full lock is reachable without regripping. It was 0.155 of the stage,
       which is 148 points on a 16 Pro Max.
     - and it eases. Touch events arrive in bursts at whatever rate the
       browser likes; the kart is stepped at a fixed sixtieth. Reading the
       raw thumb made the same stick feel sticky or twitchy depending on the
       event rate, and letting go snapped the wheels straight.

     node tools/stick.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  process.stderr.write(`${c ? "PASS" : "FAIL"}  ${n}${note ? "   " + note : ""}\n`); };

(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 956, height: 440 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route("**/*", (r) =>
    r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  const click = async (sel) => {
    await p.evaluate((s) => { const t = [...document.querySelectorAll("button")]
      .find((x) => x.matches(s)); if (t) t.click(); }, sel);
    await p.waitForTimeout(650);
  };
  await click('[data-go="single"]');
  await click('[data-char="0"]');
  await click('[data-next="chars"]');
  await click('[data-track="0"]');
  await click('[data-next="tracks"]');
  await p.waitForFunction(() => {
    try { const d = window.__RACE_DEBUG(); return d && d.racers && d.racers.length; }
    catch (e) { return false; }
  }, { timeout: 60000, polling: 250 }).catch(() => {});
  await p.waitForTimeout(1500);

  /* drive the stick through the same events a thumb sends, and read what
     the kart is told */
  const r = await p.evaluate(async () => {
    const d = window.__RACE_DEBUG();
    for (let i = 0; i < 60 * 10 && window.__RACE_DEBUG().state !== "race"; i++) d.step(1 / 60);
    const zone = document.getElementById("rc-steer");
    const stage = document.querySelector(".rc-stage");
    if (!zone || !stage) return null;
    const sb = stage.getBoundingClientRect();
    const cx = sb.left + sb.width / 2, cy = sb.top + sb.height * 0.75;
    const radius = Math.max(34, stage.clientWidth * 0.115);

    const touch = (type, x, y) => {
      const t = new Touch({ identifier: 7, target: zone, clientX: x, clientY: y });
      zone.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
        touches: type === "touchend" ? [] : [t], changedTouches: [t] }));
    };
    /* hold a given fraction of the travel and let the kart settle */
    const hold = (frac, frames) => {
      touch("touchstart", cx, cy);
      touch("touchmove", cx + radius * frac, cy);
      for (let i = 0; i < (frames || 40); i++) d.step(1 / 60);
      const v = window.__RACE_DEBUG().racers.find((k) => k.isPlayer);
      const axis = window.__RACE_DEBUG().input.axis;
      touch("touchend", cx + radius * frac, cy);
      for (let i = 0; i < 30; i++) d.step(1 / 60);
      return axis;
    };
    const rest   = hold(0.05);
    const half   = hold(0.50);
    const full   = hold(1.00);

    /* AND HOW LONG THE WHEELS TAKE TO CATCH UP WITH THE THUMB, which is
       the half of it that is felt as lag. A single chase rate of 0.32 a
       frame was eight frames -- about 130ms of the game being behind her
       every time she turned in. */
    touch("touchstart", cx, cy);
    touch("touchmove", cx + radius, cy);
    let reach = 0;
    while (reach < 60 && Math.abs(window.__RACE_DEBUG().input.axis || 0) < 0.9) {
      d.step(1 / 60); reach++;
    }
    touch("touchend", cx + radius, cy);
    for (let i = 0; i < 30; i++) d.step(1 / 60);

    /* and how long it takes to come back to centre after letting go */
    touch("touchstart", cx, cy);
    touch("touchmove", cx + radius, cy);
    for (let i = 0; i < 40; i++) d.step(1 / 60);
    touch("touchend", cx + radius, cy);
    let frames = 0;
    while (frames < 120 && Math.abs(window.__RACE_DEBUG().input.axis || 0) > 0.02) {
      d.step(1 / 60); frames++;
    }
    /* AND WHAT THE RING SHOWS.
       The pip used to be offset by a pixel figure worked out from the stage
       WIDTH, while the ring is sized min(26cqw, 34cqh) -- so on a landscape
       phone, where the height clamp wins, the pip was placed against a ring
       that was not that size. It is a fraction of the pip's own width now,
       so this measures where the pip actually lands against how much room
       it has inside the ring. */
    /* MEASURE WHERE THE PIP GOES, NOT WHERE IT IS A FRAME IN. The pip has
       a 40ms transition on its transform, and in this container the
       animation clock barely advances -- so a rect read straight after
       the touch is the rect at t=0 of that transition, which is dead
       centre, and the first version of this check duly reported that the
       stick's pip never moves. Turning transitions off makes the
       measurement the end state rather than the start of the ride. */
    const noAnim = document.createElement("style");
    noAnim.textContent = "*{transition:none !important; animation:none !important;}";
    document.head.appendChild(noAnim);
    touch("touchstart", cx, cy);
    touch("touchmove", cx + radius, cy);
    d.step(1 / 60);
    void document.body.offsetHeight;
    const ringEl = document.querySelector(".rc-steer-ring");
    const pip = ringEl && ringEl.querySelector("i");
    let sweep = null;
    if (pip) {
      const rr = ringEl.getBoundingClientRect(), pr = pip.getBoundingClientRect();
      /* how far the pip's centre is from the ring's, against the furthest
         it could go without crossing the ring's own edge */
      const off = Math.abs((pr.left + pr.width / 2) - (rr.left + rr.width / 2));
      sweep = { off: +off.toFixed(1), room: +(rr.width / 2 - pr.width / 2).toFixed(1),
               lock: ringEl.style.getPropertyValue('--rc-lock'),
               tf: getComputedStyle(pip).transform,
               on: ringEl.parentElement && ringEl.parentElement.dataset.on };
    }
    /* AND UP, WHICH IS THE WHOLE POINT OF THE REBUILD. Pushed diagonally
       the cap has to go diagonally. It used to read only the sideways
       distance and slide flatly left or right like a fader, which is why
       it never felt like a stick. Steering still only uses the sideways
       part -- there is nothing to do with up and down in this game -- but
       what is under the thumb must follow the thumb. */
    touch("touchend", cx + radius, cy);
    touch("touchstart", cx, cy);
    touch("touchmove", cx + radius * 0.6, cy - radius * 0.6);
    d.step(1 / 60);
    void document.body.offsetHeight;
    let diag = null;
    if (pip) {
      const rr = ringEl.getBoundingClientRect(), pr = pip.getBoundingClientRect();
      diag = { dx: +((pr.left + pr.width / 2) - (rr.left + rr.width / 2)).toFixed(1),
               dy: +((pr.top + pr.height / 2) - (rr.top + rr.height / 2)).toFixed(1) };
    }
    touch("touchend", cx + radius * 0.6, cy - radius * 0.6);
    for (let i = 0; i < 30; i++) d.step(1 / 60);

    /* AND THE TWO PARTS THAT MAKE IT A STICK RATHER THAN A COUNTER.

       A cap sliding about on its own is a draughts piece. The stem is
       what says the cap is on the end of something anchored in the middle
       of the dish, and the arc round the rim is the only part of the
       whole control that tells her something the kart does not: how much
       lock she is actually asking for. Both come off the same two
       properties the stick sets from the thumb, so both are measured the
       same way -- at rest, and at full lock. */
    const stemEl = ringEl && ringEl.querySelector(".rc-steer-stem");
    const arcEl  = ringEl && ringEl.querySelector(".rc-steer-arc");
    /* THE STEM'S WIDTH, NOT ITS BOUNDING BOX. The stem is rotated to point
       at the thumb, and a rotated box's rect is as wide as its own HEIGHT
       when it is standing on end -- so a zero-length stem last left at
       forty-five degrees measures fourteen pixels wide and the first
       version of this check duly compared fourteen with forty-six and
       called it a failure to grow. The used width is the length. */
    const readParts = () => ({
      stem: stemEl ? Math.round(parseFloat(getComputedStyle(stemEl).width)) : -1,
      arc:  arcEl ? +getComputedStyle(arcEl).opacity : -1,
      mag:  ringEl ? ringEl.style.getPropertyValue("--rc-mag") : "",
    });
    const partsRest = readParts();
    touch("touchstart", cx, cy);
    touch("touchmove", cx + radius, cy);
    d.step(1 / 60);
    void document.body.offsetHeight;
    const partsFull = readParts();
    touch("touchend", cx + radius, cy);
    for (let i = 0; i < 30; i++) d.step(1 / 60);
    noAnim.remove();

    return { rest, half, full, settle: frames, radius: Math.round(radius),
             stage: Math.round(stage.clientWidth), sweep, diag, reach,
             partsRest, partsFull };
  });

  ok("the stick exists and answers", !!r, r ? "" : "no steer zone");
  if (r) {
    ok("a thumb resting still is centred",
       Math.abs(r.rest) < 0.001, `five per cent of travel -> ${(+r.rest).toFixed(3)}`);
    ok("half the travel is a correction, not a hairpin",
       r.half > 0.25 && r.half < 0.55, `half travel -> ${(+r.half).toFixed(2)} lock`);
    ok("the end of the travel is full lock",
       r.full > 0.93, `full travel -> ${(+r.full).toFixed(2)} lock`);
    ok("half gives markedly less than half of full",
       r.half < r.full * 0.62, `${(+r.half).toFixed(2)} against ${(+r.full).toFixed(2)}`);
    ok("the wheels catch the thumb quickly on the way out",
       r.reach > 0 && r.reach <= 5, `${r.reach} frames to nine tenths of lock`);
    ok("letting go returns to centre, but not instantly",
       r.settle >= 3 && r.settle <= 30, `${r.settle} frames`);
    ok("full lock is inside a thumb's reach",
       r.radius <= r.stage * 0.13, `${r.radius}px of a ${r.stage}px stage`);
    ok("pushed diagonally, the cap goes diagonally",
       !!r.diag && r.diag.dx > 6 && r.diag.dy < -6,
       r.diag ? `thumb up and right -> cap moved ${r.diag.dx}, ${r.diag.dy}` : "no cap");
    ok("at full lock the pip is near the edge of its ring, not in the middle",
       !!r.sweep && r.sweep.off > r.sweep.room * 0.7 && r.sweep.off <= r.sweep.room,
       r.sweep ? `${r.sweep.off}px of ${r.sweep.room}px of room  [--rc-lock=${r.sweep.lock}  transform=${r.sweep.tf}  on=${r.sweep.on}]` : "no pip");
    ok("the stem grows out of the middle as the thumb goes out",
       !!r.partsFull && r.partsFull.stem > 20 && r.partsRest.stem < 2,
       r.partsFull ? `${r.partsRest.stem}px at rest -> ${r.partsFull.stem}px at full lock` : "no stem");
    ok("the lock arc lights up with the push",
       !!r.partsFull && r.partsFull.arc > 0.6 && r.partsRest.arc < 0.12,
       r.partsFull ? `${r.partsRest.arc} at rest -> ${r.partsFull.arc} at full lock` : "no arc");
    ok("and the whole thing is driven by one measured magnitude",
       !!r.partsFull && Math.abs(+r.partsFull.mag - 1) < 0.02 && +r.partsRest.mag < 0.02,
       r.partsFull ? `--rc-mag ${r.partsRest.mag || "0"} -> ${r.partsFull.mag}` : "");
  }
  ok("no page errors", errs.length === 0, errs[0] || "");
  await ctx.close();
  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
})();
