/* A COURSE WITH NO THEME, WHICH SOUNDS EXACTLY LIKE A MUTED GAME.

   playSong is handed the track's id and returns quietly when there is no
   entry under it. Two courses were added and their music was not, so
   Harbour Lights and The Long Way Home raced in complete silence -- and
   nothing caught it, because the one thing silence is indistinguishable
   from is somebody having turned the sound off.

   So: every course has a theme, every theme parses, and no two are the
   same piece of music. That last one matters more than it looks. Copying
   a neighbour's song into the gap would pass the first two checks and
   leave two courses sounding identical, which is the version of this bug
   that survives being noticed.

     node tools/themes.js
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
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { showScreen("hub"); if (window.startHub) startHub(); });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const e = document.getElementById("hub-card-race"); if (e) e.click(); });
  await p.waitForTimeout(9000);

  /* AND IT REPORTS WHY IT FAILED. The first version swallowed the
     exception and carried on with an empty list, at which point "every
     course has a theme" passed because there were no courses -- a test
     that is loudest when it has nothing to say. An empty list is now
     itself the failure, and everything after it is skipped. */
  const r = await p.evaluate(() => {
    try {
      const d = window.__RACE_DEBUG();
      const ids = (d.TRACKS || []).map((t) => t.id);
      const names = d.songNames();
      const got = {};
      for (const id of ids) got[id] = d.song(id);
      return { ids, names, got };
    } catch (e) { return { err: String(e).slice(0, 160) }; }
  });

  ok("the course list and the songs could be read", !!r && !r.err && !!r.ids,
     r && r.err ? r.err : "");
  if (!r || r.err || !r.ids) {
    process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
    await ctx.close(); await b.close();
    process.exit(1);
  }

  const ids = r.ids;
  ok("every course is listed", ids.length >= 6, `${ids.length} courses: ${ids.join(", ")}`);

  const silent = ids.filter((id) => !r.got[id]);
  ok("every course has a theme of its own", silent.length === 0,
     silent.length ? `SILENT: ${silent.join(", ")}` : ids.join(", "));

  /* does each one parse -- a typo in a note name is a rest, silently */
  const NOTE = /^([A-G]#?)(-?\d)$/;
  const bad = [];
  for (const id of ids) {
    const s = r.got[id];
    if (!s) continue;
    for (const part of ["lead", "bass"])
      for (const tok of String(s[part]).trim().split(/\s+/))
        if (tok !== "-" && tok !== "." && !NOTE.test(tok)) bad.push(`${id}.${part}: ${tok}`);
    for (const tok of String(s.drums).trim().split(/\s+/))
      if (!"ksh.".includes(tok)) bad.push(`${id}.drums: ${tok}`);
  }
  ok("every note in every theme is a note", bad.length === 0,
     bad.length ? bad.slice(0, 5).join(" | ") : "all parse");

  /* and no two courses play the same piece */
  const seen = new Map(), dupes = [];
  for (const id of ids) {
    const s = r.got[id];
    if (!s) continue;
    const key = s.lead + "|" + s.bass;
    if (seen.has(key)) dupes.push(`${id} = ${seen.get(key)}`);
    else seen.set(key, id);
  }
  ok("no two courses play the same theme", dupes.length === 0,
     dupes.length ? dupes.join(", ") : `${seen.size} distinct`);

  /* they should not all be the same tempo either: a theme that matches
     its course is a different speed as well as different notes */
  const bpms = ids.filter((id) => r.got[id]).map((id) => r.got[id].bpm);
  ok("the six are not all at one tempo", new Set(bpms).size >= 5,
     `${bpms.sort((a, c) => a - c).join(", ")} bpm`);

  /* and the menu still has its own, which is not any course's */
  ok("the menu keeps a theme that is not a course's",
     r.names.includes("menu") && !ids.includes("menu"), r.names.join(", "));

  ok("no page errors", errs.length === 0, errs[0] || "");
  await ctx.close();
  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
})();
