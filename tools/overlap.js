/* WHAT IS COVERING THE WRITING.

   The results panel showed a sentence with its middle missing: "Every lap"
   on the left, "d over the" on the right, and a photograph sitting across
   everything between. Nothing was wrong with the sentence. The postcard is
   640x400, its box was given a width of 42cqw and no height bound at all,
   and the .rc-split it lives in has a max-height of 40cqh and no overflow
   rule -- so on a wide stage the card was simply taller than its own box,
   hung out of the bottom of it, and painted over the line beneath.

   That is a class of fault, not one fault: any capped box with an
   unbounded replaced element in it does the same thing. So this does not
   look for that box. It reads every panel the game shows, and for every
   piece of writing on it asks the browser what is actually on top at that
   point. If the answer is not that piece of writing, something is covering
   it, whatever the cause.

   It also names the boxes whose content escapes them -- a max-height with
   visible overflow -- because that is where the covering comes from.

     node tools/overlap.js
*/
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const ok = (n, c, note) => { c ? pass++ : fail++;
  process.stderr.write(`${c ? "PASS" : "FAIL"}  ${n}${note ? "   " + note : ""}\n`); };

const SCREENS = [
  ["iPhone 16PM sideways",  956, 440],
  ["iPhone 13 Pro sideways", 844, 390],
  ["iPad",                  1194, 834],
  ["laptop",                1280, 800],
  ["desktop",               1680, 1050],
];

/* the probe, run inside the page */
const PROBE = () => {
  const panel = document.querySelector(".rc-panel, .rc-title");
  if (!panel) return null;
  const covered = [], escaping = [];

  /* what is on top at a point, allowing for the rail and anything the
     element itself draws */
  const onTop = (el, x, y) => {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return null;
    if (hit === el || el.contains(hit) || hit.contains(el)) return null;
    return hit;
  };

  /* every element that carries writing of its own */
  const texts = [...panel.querySelectorAll("*")].filter((el) => {
    if (!el.firstChild) return false;
    let own = "";
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    if (!own.trim()) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  });

  /* A LINE THAT IS SCROLLED OUT OF ITS OWN BOX IS NOT COVERED, IT IS
     CLIPPED. getBoundingClientRect gives an element's layout rectangle,
     which for a row half-scrolled out of a scrolling list sits partly
     outside the list -- and asking what is painted out there names
     whatever is below the list, which is not a fault, it is the list
     working. So every rect is first cut down to the part of it that is
     actually inside all of its scrolling ancestors. */
  const visible = (el) => {
    let r = el.getBoundingClientRect();
    let top = r.top, bottom = r.bottom, left = r.left, right = r.right;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (!/auto|scroll|hidden/.test(cs.overflowY + cs.overflowX)) continue;
      const b = a.getBoundingClientRect();
      top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom);
      left = Math.max(left, b.left); right = Math.min(right, b.right);
    }
    return { top, bottom, left, right, width: right - left, height: bottom - top };
  };

  for (const el of texts) {
    const r = visible(el);
    if (r.width < 8 || r.height < 6) continue;
    /* sample along the line rather than at one point: a photograph across
       the middle of a sentence leaves both ends of it perfectly visible,
       which is exactly how this went unnoticed */
    const ys = [r.top + r.height * 0.5];
    if (r.height > 24) ys.push(r.top + r.height * 0.25, r.bottom - r.height * 0.25);
    /* and the same for the boxes: only the visible part counts */
    const bad = new Set();
    for (const y of ys)
      for (let i = 1; i <= 9; i++) {
        const hit = onTop(el, r.left + (r.width * i) / 10, y);
        if (hit) bad.add(hit.tagName.toLowerCase() + (hit.className && typeof hit.className === "string"
          ? "." + hit.className.trim().split(/\s+/)[0] : ""));
      }
    if (bad.size)
      covered.push({ what: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 42),
                     by: [...bad].join(", ") });
  }

  /* and the boxes that let their content out */
  for (const el of panel.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.overflowY !== "visible") continue;
    if (cs.maxHeight === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.height < 4) continue;
    let out = 0;
    for (const kid of el.children) {
      const k = kid.getBoundingClientRect();
      out = Math.max(out, k.bottom - r.bottom, r.top - k.top);
    }
    if (out > 2)
      escaping.push({ sel: el.tagName.toLowerCase() + (typeof el.className === "string" && el.className
        ? "." + el.className.trim().split(/\s+/)[0] : ""), out: Math.round(out) });
  }
  return { covered, escaping };
};

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
    const look = async (label) => {
      const r = await p.evaluate(PROBE);
      ok(`${tag} / ${label}: nothing is covering the writing`,
         !!r && r.covered.length === 0,
         r ? (r.covered.length
              ? r.covered.map((c) => `"${c.what}" under ${c.by}`).join(" | ")
              : `${r.escaping.length ? "boxes overflowing: " + r.escaping.map((e) => `${e.sel} +${e.out}`).join(", ") : "clear"}`)
           : "no panel");
      if (r && r.escaping.length)
        ok(`${tag} / ${label}: no capped box lets its content out`,
           r.escaping.length === 0,
           r.escaping.map((e) => `${e.sel} +${e.out}px`).join(", "));
    };

    await look("the title");
    await click('[data-badges="1"]');  await look("the badges");
    await click('[data-back="title"]');
    await click('[data-keeps="1"]');   await look("the glovebox");
    await click('[data-back="title"]');
    await click('[data-go="gp"]');     await look("choosing a racer");
    await click('[data-char="0"]');
    await click('[data-next="chars"]');
    await p.waitForFunction(() => {
      try { const d = window.__RACE_DEBUG(); return d && d.racers && d.racers.length > 0; }
      catch (e) { return false; }
    }, { timeout: 60000, polling: 250 }).catch(() => {});
    await p.waitForTimeout(1200);

    const started = await p.evaluate(() => {
      let d = window.__RACE_DEBUG();
      for (let i = 0; i < 60 * 10 && window.__RACE_DEBUG().state !== "race"; i++) d.step(1 / 60);
      d = window.__RACE_DEBUG();
      const me = d.racers && d.racers.find((x) => x.isPlayer);
      if (!me) return false;
      /* off the podium, with hearts, which is the longest the message gets
         and the case in the photograph she sent */
      me.finishTime = 177.6; me.coins = 8; me.place = 4;
      d.finishRace();
      return true;
    });
    ok(`${tag}: a race can be finished`, started);
    await p.waitForTimeout(2200);
    await look("the results");

    await p.evaluate(() => { const t = [...document.querySelectorAll("button")]
      .find((x) => /MENU/.test(x.textContent)); if (t) t.click(); });
    await p.waitForTimeout(900);
    await click('[data-go="single"]');
    await click('[data-char="0"]');
    await click('[data-next="chars"]');
    await look("choosing a track");

    ok(`${tag}: no page errors`, errs.length === 0, errs[0] || "");
    await ctx.close();
  }
  await b.close();
  process.stderr.write(`\n${pass} passed, ${fail} failed\n`);
})();
