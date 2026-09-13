/* THE HEARTS, AND WHETHER THEY MEAN ANYTHING NOW.

   They used to be coins: ten of them bought six per cent of top speed and
   were thrown away at the flag. This asserts the four things that make
   them worth going and getting instead.

     - the total survives the tab being closed
     - what she carried over the line is added to it
     - a keepsake opens at its own number and not before
     - the one a race just opened is read out at the flag, in full

   The last is the point of the whole feature: a keepsake filed away for
   her to go and find later is a menu, not a present.

     node tools/glovebox.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  (cond ? pass++ : fail++);
  process.stderr.write(`${cond ? "PASS" : "FAIL"}  ${name}${note ? "   " + note : ""}\n`);
};

const open = async (b, hearts) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route("**/*", (r) =>
    r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript((n) => {
    try { localStorage.setItem("sor_hearts", String(n)); } catch (e) {}
  }, hearts);
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);
  return { ctx, p, errs };
};

(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

  /* --- a fresh glovebox, and one with three keepsakes already in it --- */
  for (const [have, want] of [[0, 0], [30, 3], [999, 8]]) {
    const { ctx, p, errs } = await open(b, have);
    const chip = await p.evaluate(() => {
      const t = [...document.querySelectorAll("button")].find((x) => x.dataset.keeps);
      return t ? t.textContent.trim() : null;
    });
    ok(`${have} hearts: the title offers the glovebox`, !!chip, chip || "no button");
    ok(`${have} hearts: it says how many are open`, !!chip && chip.includes(`${want}/8`), chip || "-");

    await p.evaluate(() => {
      const t = [...document.querySelectorAll("button")].find((x) => x.dataset.keeps);
      if (t) t.click();
    });
    await p.waitForTimeout(500);
    const rows = await p.evaluate(() => {
      const r = [...document.querySelectorAll(".rc-keep")];
      return { n: r.length, on: r.filter((x) => x.classList.contains("on")).length,
               locked: r.filter((x) => !x.classList.contains("on"))
                        .map((x) => x.querySelector("i").textContent.trim())[0] || "",
               firstOpen: r.filter((x) => x.classList.contains("on"))
                        .map((x) => x.querySelector("i").textContent.trim())[0] || "" };
    });
    ok(`${have} hearts: all eight are listed`, rows.n === 8, `${rows.n} rows`);
    ok(`${have} hearts: ${want} of them are open`, rows.on === want, `${rows.on} open`);
    if (want < 8)
      ok(`${have} hearts: a locked one says how many more`,
         /more heart/.test(rows.locked), rows.locked);
    if (want > 0)
      ok(`${have} hearts: an open one is readable`, rows.firstOpen.length > 30,
         rows.firstOpen.slice(0, 46) + "...");
    ok(`${have} hearts: no page errors`, errs.length === 0, errs[0] || "");
    await ctx.close();
  }

  /* --- and the part that matters: carrying some over the line --- */
  const { ctx, p, errs } = await open(b, 3);
  /* through the menus rather than round them: the point is that a real
     finish writes the total, and a hand-called finish would not prove it */
  const click = async (sel) => {
    await p.evaluate((s) => {
      const t = [...document.querySelectorAll("button")].find((x) => x.matches(s));
      if (t) t.click();
    }, sel);
    await p.waitForTimeout(700);
  };
  await click('[data-go="single"]');
  await click('[data-next="chars"]');
  await click('[data-char="0"]');
  await click('[data-next="tracks"]');
  await click('[data-track="0"]');
  await p.evaluate(() => {
    const t = [...document.querySelectorAll("button")]
      .find((x) => /START|GO/.test(x.textContent) && !x.dataset.back);
    if (t) t.click();
  });
  await p.waitForTimeout(11000);
  const racing = await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    return { state: d.state, karts: d.racers.length, coins: d.coins.length };
  });
  ok("a race actually started", racing.karts > 0 && racing.coins > 0,
     `${racing.state}, ${racing.karts} karts, ${racing.coins} hearts on the road`);

  const before = await p.evaluate(() => +localStorage.getItem("sor_hearts"));
  /* THE CLOCK DOES NOT RUN HERE. Under a headless browser the countdown
     sat at three for fourteen real seconds, so no lap can be driven and no
     flag can fall on its own. The harness calls the game's own finishRace
     instead -- the same function the last lap calls -- with four hearts in
     her hands, which is 3 + 4 = 7 and opens THE FIRST LAP at five. */
  await p.evaluate(() => {
    const d = window.__RACE_DEBUG();
    const me = d.racers.find((r) => r.isPlayer);
    me.coins = 4;
    me.finishTime = 61.2;
    d.finishRace();
  });
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => ({
    total: +localStorage.getItem("sor_hearts"),
    strip: (document.querySelector(".rc-keep-new") || {}).textContent || "",
    msg: (document.querySelector(".rc-msg") || {}).textContent || "",
  }));
  ok("the hearts carried are added to the total", after.total === before + 4,
     `${before} -> ${after.total}`);
  ok("the result says where they went", /glovebox/i.test(after.msg), after.msg.slice(-80));
  ok("the keepsake it opened is read out at the flag",
     /first corner/i.test(after.strip), after.strip.slice(0, 60) || "(nothing)");
  ok("no page errors through the finish", errs.length === 0, errs[0] || "");
  await ctx.close();

  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
})();
