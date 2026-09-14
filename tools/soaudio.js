/* THE MUSIC CAME BACK QUIET AND THE EFFECTS DID NOT.

   Two switches wrote the same gain -- a duck for an overlay at 0.014 and
   a hush for a cutscene at nought -- and neither knew about the other, so
   whoever wrote last won and nothing recomputed it. A duck that was never
   lifted left the score at a fortieth of its volume for the rest of the
   session while every sound effect stayed exactly as loud as it should
   be. The two ways out of the pause card that do not resume -- RESTART
   WORLD and changing difficulty -- both did that.

     node tools/soaudio.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${note ? "   " + note : ""}`); };

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
           "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
  await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(1200);
  /* the same way in that every other suite here uses: a real click on the
     card and a real click on PLAY. Evaluating the handlers by hand left
     the game sitting on its title screen while the assertions ran. */
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen("ouissy"); startSuperOuissy(); });
  await p.waitForSelector(".so-diff-card", { timeout: 20000 });

  const click = async (id) => { await p.evaluate((i) => { const e = document.getElementById(i);
    if (e) e.click(); }, id); await p.waitForTimeout(700); };
  const level = () => p.evaluate(() => window.__soBgmLevel());
  const state = () => p.evaluate(() => (window.__soState ? window.__soState() : null));

  /* GET INTO A LEVEL. The difficulty card only selects -- PLAY is what
     starts it -- and the first version of this file pressed the card and
     carried on measuring a title screen. */
  await p.click('[data-so-diff="hard"]');
  await p.click("#so-play");
  await p.waitForFunction(() => window.__soState && window.__soState().state === "play",
                          null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(900);
  ok("she is actually playing", (await state()).state === "play", (await state()).state);
  const playing = await level();
  ok("the music plays at full while she plays", playing > 0.05,
     `gain ${playing}`);

  /* PAUSE PROPERLY OR MEASURE NOTHING. The first version called the pause
     hook and carried straight on; the card had not opened, so every
     assertion after it was about a screen that was not there -- including
     one that passed. Wait for the card, and say so if it never comes. */
  const pause = async () => {
    await p.evaluate(() => { if (window.__soPause) window.__soPause(true); });
    try {
      await p.waitForFunction(() => !!document.getElementById("so-quit"),
                              null, { timeout: 4000 });
      return true;
    } catch (e) { return false; }
  };
  ok("the pause card opens", await pause());
  const ducked = await level();
  ok("pausing ducks it", ducked !== null && ducked < 0.05, `gain ${ducked}`);

  await click("so-restart");
  await p.waitForTimeout(1500);
  const after = await level();
  ok("RESTART WORLD brings the music back up", after > 0.05,
     `gain ${after} (was ${ducked} while paused)`);

  /* and the other one: changing difficulty from the pause card */
  await pause();
  await p.evaluate(() => { const b = document.querySelector('[data-so-setdiff="easy"]'); if (b) b.click(); });
  await p.waitForTimeout(1500);
  const after2 = await level();
  ok("changing difficulty brings the music back up", after2 > 0.05, `gain ${after2}`);

  /* and the pause card's way out goes to the game's own menu, not out */
  ok("the pause card opens again", await pause());
  const label = await p.evaluate(() => { const e = document.getElementById("so-quit");
    return e ? e.textContent.trim() : null; });
  ok("the pause card offers the menu, not the hub", label === "BACK TO MENU", String(label));
  await click("so-quit");
  const st = await state();
  const onMenu = await p.evaluate(() => !!document.querySelector('[data-so-diff]'));
  ok("and it lands on the game's own menu", onMenu, st ? "state " + st.state : "");

  ok("no page errors", errs.length === 0, errs[0] || "");
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
