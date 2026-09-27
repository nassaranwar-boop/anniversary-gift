/* THE ONE ITEM THAT IS NOT A WEAPON.

   Every other thing in the box is thrown, dropped or burnt, so there was
   nothing at all to DO while winning except wait to be hit from behind.
   His jacket takes one hit. The `shield` field it sets has been in the
   kart since the beginning and nothing ever wrote to it.

   What has to be true:
     - it can be rolled at all, and it favours the FRONT of the field,
       which is the opposite of how the ring and the bouquet are weighted
     - using it puts a shield up
     - the shield eats exactly one hit and is then gone
     - it runs out on its own if it is never needed
     - and it does not look like the bouquet, because three hearts going
       round a kart already means something else

     node tools/jacket.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  process.stderr.write(`${c ? "PASS" : "FAIL"}  ${n}${note ? "   " + note : ""}\n`); };

(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
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
  await click('[data-track="0"]');
  await click('[data-next="tracks"]');
  await p.waitForTimeout(6000);

  const r = await p.evaluate(() => {
    let d = window.__RACE_DEBUG();
    for (let i = 0; i < 60 * 8 && window.__RACE_DEBUG().state !== "race"; i++) d.step(1 / 60);
    d = window.__RACE_DEBUG();
    const me = d.racers.find((x) => x.isPlayer);

    /* is it in the box at all, and which end of the field does it favour?
       rollItem is not exported, so this samples the real thing through the
       only door there is: give a kart the place and ask for an item many
       times over. */
    const sample = (place) => {
      const got = {};
      for (let i = 0; i < 4000; i++) {
        const k = d.rollItem(place, 8);
        got[k] = (got[k] || 0) + 1;
      }
      return got;
    };
    const front = sample(1), back = sample(8);

    /* using it */
    me.item = "jacket"; me.shield = 0;
    me.fire();
    const up = me.shield;

    /* one hit, and it is gone -- through the game's own hit path */
    me.invuln = 0; me.spin = 0; me.iframe = 0;
    d.hit(me);
    const afterOne = me.shield;
    const spun = me.spin;

    /* and it runs down on its own. Stepped until it is gone rather than
       for a fixed count: a kart that has finished stops being updated, and
       a flat 180 steps once measured 0.65s of decay and called it a bug. */
    me.shield = 1.2;
    for (let i = 0; i < 60 * 30 && me.shield > 0; i++) d.step(1 / 60);
    const expired = +me.shield.toFixed(3);

    return { front, back, up, afterOne, spun, expired };
  });

  const fj = (r.front.jacket || 0) / 4000, bj = (r.back.jacket || 0) / 4000;
  ok("his jacket is in the box", fj + bj > 0,
     `${(fj * 100).toFixed(1)}% at the front, ${(bj * 100).toFixed(1)}% at the back`);
  ok("and it favours the front, unlike everything else", fj > bj * 1.4,
     `${(fj * 100).toFixed(1)}% vs ${(bj * 100).toFixed(1)}%`);
  ok("the ring still favours the back", (r.back.ring || 0) > (r.front.ring || 0),
     `ring ${(((r.back.ring || 0) / 4000) * 100).toFixed(1)}% at the back`);
  ok("using it puts a shield up", r.up > 0, `${r.up}s`);
  ok("one hit takes it and she keeps going", r.afterOne === 0 && r.spun === 0,
     `shield ${r.afterOne}, spin ${r.spun}`);
  ok("and it runs out on its own if never needed", r.expired === 0, `${r.expired}`);
  ok("no page errors", errs.length === 0, errs[0] || "");

  await ctx.close();
  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
})();
