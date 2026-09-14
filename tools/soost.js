/* ARE THE THREE SCORES THREE PIECES OF MUSIC, OR ONE AT THREE SPEEDS?

   The report was that easy is the best of them, two of medium feel thin
   and all of hard feels rushed -- "you just feel it speed up". That is a
   claim about the notes, and the notes are right here, so it can be
   checked rather than argued about.

     - a harmony line that holds one note for a bar is a drone, not a
       harmony, and it is the single thing that makes a tune feel empty
       however fast it goes;
     - a lead that is another difficulty's lead with the same shape is the
       same tune, whatever the tempo says;
     - and a bass that only ever plays the root and the fifth is not a
       progression.

     node tools/soost.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${note ? "   " + note : ""}`); };

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
  await ctx.route("**/*", (r) => r.request().url().startsWith("http://127.0.0.1") ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.loadChapter && window.loadChapter("ouissy"));
  await p.waitForFunction(() => !!window.__soScores, null, { timeout: 30000 }).catch(() => {});
  const S = await p.evaluate(() => (window.__soScores ? window.__soScores() : null));
  if (!S) { ok("the scores could be read", false, "no __soScores hook"); process.exit(1); }

  const TUNES = ["w1", "w2", "w3", "boss", "win"];
  const DIFFS = ["easy", "medium", "hard"];

  /* the longest run of one repeated pitch in a line, ignoring rests */
  const longestHold = (line) => {
    let best = 0, run = 0, last = null;
    for (const v of line) {
      if (v === null) continue;
      if (v === last) run++; else { run = 1; last = v; }
      if (run > best) best = run;
    }
    return best;
  };
  const notes = (line) => line.filter((v) => v !== null);
  const distinct = (line) => new Set(notes(line)).size;

  /* EASY IS SPARE ON PURPOSE, and sparse is not the same fault as empty.
     Easy is the set that works -- it was the one difficulty nobody
     complained about -- and it works BECAUSE it leaves room: three notes
     in a harmony line over a slow tempo is air, not a drone. A test that
     demanded the same density everywhere would have me busy up the only
     music that is already right. The bar is for the difficulties the
     complaint was about. */
  for (const d of DIFFS) {
    if (d === "easy") continue;
    for (const t of TUNES) {
      const tune = S[d] && S[d][t];
      if (!tune) { ok(`${d}/${t}: exists`, false); continue; }
      /* a harmony that never moves is the fault behind "no amusement" */
      ok(`${d}/${t}: the harmony moves`, distinct(tune.harm) >= 4,
         `${distinct(tune.harm)} different notes, longest hold ${longestHold(tune.harm)}`);
      /* and a bass that walks somewhere */
      ok(`${d}/${t}: the bass is a progression, not a pump`, distinct(tune.bass) >= 5,
         `${distinct(tune.bass)} different notes`);
    }
  }

  /* ---- A WORLD IS THE SAME PLACE ON ANY DIFFICULTY ----
     The thing that carries a place is the rhythm, not the tune, so the
     drums belong to the world: all three difficulties play world one on
     the same pattern with their own melodies over it. And the three
     worlds are nothing like each other, because they are not alike. */
  for (const t of ["w1", "w2", "w3"]) {
    const beat = (d) => S[d][t].drum.join(" ");
    const e = beat("easy"), m = beat("medium"), h = beat("hard");
    ok(`${t}: the same rhythm on every difficulty`, e === m && m === h,
       e === m && m === h ? "shared" : "easy/medium/hard differ");
  }
  {
    const beat = (t) => S.medium[t].drum.join(" ");
    const a = beat("w1"), b2 = beat("w2"), c = beat("w3");
    ok("the three worlds do not share a rhythm",
       a !== b2 && b2 !== c && a !== c,
       `${new Set([a, b2, c]).size} distinct of 3`);
  }

  /* ---- AND A WORLD MOVES AT ONE PACE ----
     Difficulty was being expressed as tempo: world one ran 0.105 on easy,
     0.088 on medium and 0.076 on hard, which is thirty-eight per cent
     quicker through the same place, and that is what "it just feels sped
     up" is. If the world is the same place it goes by at the same rate;
     what changes is what is played over it. */
  for (const t of TUNES) {
    const tempos = DIFFS.map((d) => S[d][t].tempo);
    ok(`${t}: the same pace on every difficulty`,
       new Set(tempos).size === 1, tempos.join(" / "));
  }

  /* ---- AND ROOM TO BREATHE, WHICH IS WHY EASY WAS THE GOOD ONE ----
     Easy's leads put a note every third step with two rests between: an
     arc you can hum. Medium and hard were crowded as well as quick, and a
     crowded line is not a harder line, it is a worse one. No world's lead
     should be denser than easy's was. */
  for (const t of ["w1", "w2", "w3"]) {
    const density = (d) => notes(S[d][t].lead).length;
    const e = density("easy");
    for (const d of ["medium", "hard"]) {
      ok(`${d}/${t}: as much room as easy has`, density(d) <= e + 2,
         `${density(d)} notes against easy's ${e}`);
    }
  }

  /* and the three difficulties are three tunes, not one at three speeds */
  for (const t of TUNES) {
    const shape = (d) => notes(S[d][t].lead).join(",");
    const e = shape("easy"), m = shape("medium"), h = shape("hard");
    ok(`${t}: hard is not medium at a different tempo`, h !== m, h === m ? "identical lead" : "different lead");
    ok(`${t}: easy is not medium at a different tempo`, e !== m, e === m ? "identical lead" : "different lead");
  }
  ok("no page errors", errs.length === 0, errs[0] || "");
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
