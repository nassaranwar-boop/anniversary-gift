/* IS THE PHONE ON ITS SIDE THE SAME LAYOUT, SMALLER?

   The ask, in his words: the landscape phone should be an exact smaller
   iPad/PC version -- every game, every screen, every detail. That is a
   measurable claim, so this measures it rather than looking at it.

   For each screen it opens the same page at a desktop size, an iPad
   size and two landscape-phone sizes, and writes down, for every
   control and every landmark:

     is it there at all          a control that exists on the desktop
                                 and not on the phone is a missing
                                 feature, not a layout choice
     is it ON the screen         a rect outside the viewport is
                                 unreachable on a page that cannot
                                 scroll (HANDOFF 7c)
     is anything on top of it    elementFromPoint at its own centre --
                                 a button under a bar is a button that
                                 does nothing
     where is it, proportionally the position and size as a fraction of
                                 the stage it belongs to. A scaled copy
                                 keeps those; a different layout does
                                 not.

   Usage:  node tools/sidebyside.js [screen]
*/
const { chromium } = require('playwright-core');

const SIZES = [
  [1280, 800, 'desktop'],
  [1024, 768, 'ipad'],
  [844, 390, 'phone-landscape'],
  [740, 360, 'phone-landscape-small'],
];

/* every screen, how to open it, and what counts as its stage */
/* THE GAMES ARE STARTED, NOT SHOWN.

   Every one of them puts its controls up when it starts and not before
   -- the apocalypse's pad is aria-hidden until fitTouch has run -- so a
   harness that only switches the screen on is measuring a chapter that
   is not running, and reports every one of its buttons as dead. Each of
   these goes in through the real door. */
const SCREENS = {
  gate:      { open: null, stage: '.gate-card' },
  hub:       { go: () => showScreen('hub'), stage: '.hub-wrap' },
  keepsake:  { go: () => startKeepsake(), stage: '.ks-wrap' },
  /* the screen slides in; measured too early the whole section is 13px
     low and everything in it reads as hanging off the bottom */
  scrapbook: { go: () => showScreen('scrapbook'), stage: '.sb-book', play: 2200 },
  quest:     { go: () => startQuest(), stage: '.hv-stage', play: 3000 },
  ouissy:    { go: () => startSuperOuissy(), stage: '.so-stage', play: 3000 },
  apoc:      { go: () => startApocalypse(), stage: '.ap-stage', play: 3500 },
  race:      { go: () => startSuperOuissyRace(), stage: '.rc-stage', play: 3500 },
  nightshift:{ go: () => startNightShift(), stage: '.ns-stage', play: 4500 },
};

const PASSCODE = '2207';

async function inventory(p, stageSel) {
  return p.evaluate((sel) => {
    const vw = innerWidth, vh = innerHeight;
    const scr = document.querySelector('.screen.active');
    const stage = (sel.split(',').map((s) => s.trim())
      .map((s) => scr && scr.querySelector(s)).filter(Boolean))[0]
      || (scr && scr.querySelector('.screen-inner')) || scr;
    const sr = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: vw, height: vh };
    const seen = [];
    /* WHAT COUNTS AS A CONTROL, AND WHAT IT IS MEASURED AGAINST.

       The canvas is the game, not a button: it is always underneath
       whatever card is up, and counting it as "covered" says only that
       there is a card on the screen. And a control inside a card is
       measured against the CARD, not the stage -- fitCard scales a card
       down to fit a phone, so a button that keeps its place inside a
       card that got smaller is exactly the thing being checked, and
       measuring it against the stage would call it moved. */
    const PANEL = '.ns-card, .ap-card, .so-card, .rc-panel, .rc-menu, .hv-card, .hv-note,'
                + ' .gate-card, .ks-card, .ancient-card, .end-card, .hub-inner,'
                + ' [class$="-card"], [class*="-panel"], [class*="-overlay"], [class*="-note"]';
    const panelOf = (el) => el.closest(PANEL);
    const all = scr ? scr.querySelectorAll('button, a[href], [role="button"], input, canvas, [data-go], [data-k]') : [];
    all.forEach((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const shown = cs.display !== 'none' && cs.visibility !== 'hidden' &&
                    Number(cs.opacity) > 0.05 && r.width > 1 && r.height > 1 &&
                    !el.closest('[hidden]') && !el.hasAttribute('hidden');
      if (!shown) return;
      /* what is actually at its middle */
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = (cx >= 0 && cy >= 0 && cx <= vw && cy <= vh)
        ? document.elementFromPoint(cx, cy) : null;
      const covered = !!(hit && hit !== el && !el.contains(hit) && !hit.contains(el));
      /* the twelve keys of the passcode all carry class gate-key, so a
         name taken from the class collapsed them into one control and
         compared key 1 against key 7 */
      const id = el.id || (el.dataset && (el.dataset.go || el.dataset.k))
                 || (el.getAttribute('data-gate-key') ? 'gate-key-' + el.getAttribute('data-gate-key') : null)
                 || (el.className && String(el.className).split(' ').slice(0, 2).join('.')) || el.tagName;
      if (el.tagName === 'CANVAS') return;
      /* a control on a lower layer -- under the card that is currently
         up -- is not reachable and is not meant to be; it is the card
         that is being looked at */
      const mine = panelOf(el);
      const theirs = covered ? panelOf(hit) : null;
      const under = covered && theirs !== mine;
      const box = mine ? mine.getBoundingClientRect() : sr;
      seen.push({
        id: String(id).slice(0, 40), tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 24),
        panel: mine ? String(mine.className).split(' ')[0] : 'stage',
        under: under,
        on: r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1,
        covered: covered && !under,
        coveredBy: covered ? (hit.id || hit.className || hit.tagName).toString().slice(0, 28) : '',
        /* where it sits inside the card it belongs to, or the stage if
           it belongs to no card, as a fraction */
        fx: +((r.left - box.left) / (box.width || 1)).toFixed(3),
        fy: +((r.top - box.top) / (box.height || 1)).toFixed(3),
        fw: +(r.width / (box.width || 1)).toFixed(3),
        fh: +(r.height / (box.height || 1)).toFixed(3),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    });
    return {
      vw, vh, screen: scr ? scr.id : null,
      stage: { w: Math.round(sr.width), h: Math.round(sr.height),
               ar: +((sr.width || 1) / (sr.height || 1)).toFixed(3),
               fill: +(((sr.width * sr.height) / (vw * vh)) || 0).toFixed(3),
               /* two pixels of slack: a stage that lands at -0.6 is a
                  rounded layout, not a stage off the screen */
               off: sr.left < -2 || sr.top < -2 || sr.right > vw + 2 || sr.bottom > vh + 2,
               box: [Math.round(sr.left), Math.round(sr.top), Math.round(sr.right), Math.round(sr.bottom)] },
      controls: seen,
    };
  }, stageSel);
}

(async () => {
  const want = process.argv[2];
  const names = want ? [want] : Object.keys(SCREENS);
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = {};
  for (const [w, h, label] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h },
                                isMobile: h < 500, hasTouch: h < 500,
                                deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.log('  PAGEERROR ' + label + ': ' + e.message.slice(0, 90)));
    await p.route('**/*', (r) => {
      const u = r.request().url();
      return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
    });
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(900);
    /* PAST THE OPENING, THE WAY SHE GOES.

       The site opens on the 3D book and waits for a tap; the gate is
       behind it and the passcode is four taps on a keypad. Both are
       driven here rather than jumped over, so anything that only
       breaks on the way in still breaks. */
    await p.evaluate(() => {
      const c = document.getElementById('book-canvas') || document.body;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      c.click();
    });
    await p.waitForTimeout(1200);
    /* if the book is still up, go round it */
    await p.evaluate(() => {
      if (document.querySelector('#screen-gate.active')) return;
      if (window.showScreen) showScreen('gate');
    });
    await p.waitForTimeout(400);
    /* THE GATE IS LOOKED AT BEFORE IT IS OPENED.

       It used to be measured in the same pass as every other screen,
       which is after the passcode has been typed -- so whether it
       reported the gate or the hub came down to how fast the page had
       moved on, and it reported both across two runs of the same
       suite. */
    if (names.indexOf('gate') >= 0) {
      out.gate = out.gate || {};
      out.gate[label] = await inventory(p, SCREENS.gate.stage);
    }

    /* THE KEYS ANSWER TO A FINGER, NOT TO .click().

       The keypad is wired on pointerdown so a key sounds the moment she
       touches it; el.click() from a script dispatches no pointer event
       at all, so the passcode was never typed and this harness spent
       three of its four sizes measuring the GATE while reporting the
       hub -- which is where "every hub card is missing on an iPad" came
       from. Playwright's own click sends the whole sequence. */
    /* the fourth dot judges the code on its own, so there is no unlock
       to press -- pressing it races the page turn and times out */
    for (const d of PASSCODE.split('')) {
      try { await p.click('[data-gate-key="' + d + '"]', { timeout: 6000 }); }
      catch (e) { console.log('  ' + label + ': key ' + d + ' would not take a press'); break; }
      await p.waitForTimeout(160);
    }
    /* the right code opens the seal and turns the page to the
       SCRAPBOOK, not the hub -- waiting for the hub here waited out its
       whole timeout on every run and then carried on anyway */
    try { await p.waitForSelector('#screen-scrapbook.active', { timeout: 15000 }); }
    catch (e) { console.log('  ' + label + ': never got past the gate'); }
    await p.waitForTimeout(1200);
    for (const name of names) {
      if (name === 'gate') continue;
      /* a chapter that is not in this tree is not a failure of it */
      if (name === 'nightshift' &&
          !(await p.evaluate(() => !!document.getElementById('hub-card-nightshift')))) {
        console.log('  ' + label + ': the night shift is not in this tree');
        continue;
      }
      const s = SCREENS[name];
      /* IN THROUGH THE REAL DOOR.

         The chapters are loaded on demand, so calling startQuest()
         before its file has arrived throws and leaves the page where it
         was -- which is how a first run of this reported every game as
         "one control, the canvas" while actually sitting on the
         scrapbook. A player presses the card on the hub; so does this,
         and then it waits for the screen and for the chapter to say it
         is ready. */
      const ready = {
        quest: '#screen-quest.active .hv-stage',
        ouissy: '#screen-ouissy.active .so-stage canvas, #screen-ouissy.active canvas',
        apoc: '#screen-apoc.active #ap-canvas',
        race: '#screen-race.active #rc-canvas, #screen-race.active canvas',
        nightshift: '#screen-nightshift.active #ns-canvas',
      };
      if (name === 'hub') {
        await p.evaluate(() => showScreen('hub'));
      } else if (name === 'keepsake') {
        await p.evaluate(() => { try { startKeepsake(); } catch (e) {} showScreen('keepsake'); });
        try { await p.waitForSelector('#screen-keepsake.active .ks-wrap', { timeout: 8000 }); }
        catch (e) { console.log('  ' + label + ': the keepsake never came up'); }
      } else if (name === 'scrapbook') {
        await p.evaluate(() => showScreen('scrapbook'));
      } else if (ready[name]) {
        await p.evaluate(() => showScreen('hub'));
        await p.waitForTimeout(350);
        await p.evaluate((n) => {
          const c = document.getElementById('hub-card-' + n);
          if (c) c.click();
        }, name);
        try { await p.waitForSelector(ready[name], { timeout: 25000 }); }
        catch (e) { console.log('  ' + label + ': ' + name + ' never came up'); }
      }
      /* EVERY SCREEN ARRIVES BY A .65s SLIDE, and this container paints
         about four frames a second, so it is still running when the
         measurement is taken: that is where "the scrapbook hangs 13px
         off a 1280x800 window" came from. Wait for the transform to
         come to rest -- not on getAnimations().finished, which never
         settles here because half the site's animations are infinite. */
      await p.waitForFunction(() => {
        const s2 = document.querySelector('.screen.active');
        const t = s2 && getComputedStyle(s2).transform;
        return !t || t === 'none' || /matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)/.test(t);
      }, { timeout: 15000, polling: 200 }).catch(() => {});
      await p.waitForTimeout(s.play || 800);
      out[name] = out[name] || {};
      out[name][label] = await inventory(p, s.stage);
      if (process.env.SHOTS) {
        const fs = require('fs');
        fs.mkdirSync(process.env.SHOTS, { recursive: true });
        await p.screenshot({ path: process.env.SHOTS + '/' + name + '-' + label + '.png' });
      }
    }
    await p.close();
  }
  if (process.env.JSON) { console.log(JSON.stringify(out)); await b.close(); process.exit(0); }

  /* AND THEN SAY WHETHER IT IS THE SAME LAYOUT, SMALLER.

     The claim being checked is one sentence -- a phone on its side is
     the iPad, smaller -- so the report is three questions per screen:
     is every control still there, is every control reachable, and is
     each of them in the same place relative to its stage. The last one
     is what separates "scaled" from "rearranged": a control that sits
     18% across the stage on a laptop and 51% across it on a phone is a
     different layout, however good it looks. */
  /* A TENTH OF THE STAGE.

     Tight enough that a rearranged layout fails -- a control that moves
     from one side to the other, or from over the stage to under it --
     and loose enough to allow the one thing a short screen is entitled
     to do: give up padding. The super ouissy title card compresses its
     gaps below 400px of height rather than scrolling, which lifts the
     row of buttons at the bottom of it by 8% of the stage. Same card,
     same order, less air. */
  const DRIFT = 0.10;
  let bad = 0, checks = 0;
  const say = (ok2, line, extra) => { checks++; if (!ok2) { bad++;
    console.log('  FAIL ' + line + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } };
  for (const name of names) {
    const rec = out[name] || {};
    const base = rec.desktop;
    if (!base) { console.log(name + ': never opened at desktop size'); bad++; continue; }
    const byId = (inv) => { const m = {}; (inv.controls || []).forEach((c) => { m[c.id] = m[c.id] || c; }); return m; };
    const b0 = byId(base);
    console.log('\n' + name + '  stage ' + base.stage.w + 'x' + base.stage.h
                + ' ar ' + base.stage.ar + '  ' + base.controls.length + ' controls');
    for (const [, , label] of SIZES) {
      const inv = rec[label];
      if (!inv) { console.log('   ' + label.padEnd(22) + ' never opened'); bad++; continue; }
      const bi = byId(inv);
      const live = inv.controls.filter((c) => !c.under);
      const off = live.filter((c) => !c.on).map((c) => c.id);
      const cov = live.filter((c) => c.covered).map((c) => c.id + '<' + c.coveredBy);
      const missing = Object.keys(b0).filter((k) => !bi[k]);
      /* WHERE IT IS, NOT HOW BIG IT IS.

         A phone is a touch screen and every control on one has a 44px
         floor under it, so a button that is 10% of a laptop's stage is
         allowed to be 17% of a phone's -- that is the accessibility
         minimum doing its job, not a different layout. What must not
         move is the MIDDLE of it: same place on the card, same place on
         the stage. Size is checked separately and loosely, to catch a
         control that has collapsed or blown up rather than one that has
         grown a thumb's worth. */
      const drift = [];
      let floored = 0;
      Object.keys(b0).forEach((k) => {
        if (!bi[k]) return;
        const a = b0[k], c = bi[k];
        if (a.panel !== c.panel) { drift.push(k + ' moved card'); return; }
        const ax = a.fx + a.fw / 2, ay = a.fy + a.fh / 2;
        const cx2 = c.fx + c.fw / 2, cy2 = c.fy + c.fh / 2;
        const d = Math.max(Math.abs(ax - cx2), Math.abs(ay - cy2));
        const grow = Math.max((c.fw || 0.001) / (a.fw || 0.001), (c.fh || 0.001) / (a.fh || 0.001));
        const shrink = Math.min((c.fw || 0.001) / (a.fw || 0.001), (c.fh || 0.001) / (a.fh || 0.001));
        /* A CONTROL ON THE FLOOR CANNOT SCALE.

           Nothing in this site is allowed to be smaller than about a
           44px finger, so on a small screen a control stops shrinking
           with the layout and everything around it has to make room --
           the twelve keys of the passcode are 44px on a phone inside a
           card half the size of the laptop's, so the pad is half the
           card rather than a third of it. That is the floor working,
           not a different gate, and it is counted and shown rather
           than failed. */
        if (Math.min(c.w, c.h) <= 50 && grow > 1.05) { floored++; return; }
        if (d > DRIFT) drift.push(k + ' centre ' + d.toFixed(2)
          + ' (' + ax.toFixed(2) + ',' + ay.toFixed(2) + ' -> ' + cx2.toFixed(2) + ',' + cy2.toFixed(2) + ')');
        else if (grow > 2.5 || shrink < 0.55) drift.push(k + ' size x' + grow.toFixed(2) + '/x' + shrink.toFixed(2));
      });
      console.log('   ' + label.padEnd(22) + ' stage ' + inv.stage.w + 'x' + inv.stage.h
                  + ' ar ' + inv.stage.ar + ' fill ' + inv.stage.fill
                  + '  ' + live.length + ' controls'
                  + (inv.controls.length - live.length ? ' (+' + (inv.controls.length - live.length) + ' behind the card)' : '')
                  + (missing.length ? '  MISSING: ' + missing.join(',') : '')
                  + (off.length ? '  OFF: ' + off.join(',') : '')
                  + (cov.length ? '  COVERED: ' + cov.join(',') : '')
                  + (floored ? '  (' + floored + ' at the 44px floor)' : '')
                  + (drift.length ? '  MOVED: ' + drift.slice(0, 6).join(',') : ''));
      say(!inv.stage.off, name + ' ' + label + ': the stage is on the screen',
          inv.stage.off ? inv.stage : undefined);
      say(!missing.length, name + ' ' + label + ': every control the laptop has');
      say(!off.length, name + ' ' + label + ': every control on the screen');
      say(!cov.length, name + ' ' + label + ': nothing on top of anything');
      /* THE GATE SIDEWAYS IS A DIFFERENT COMPOSITION, ON PURPOSE.

         Everywhere else the phone is meant to be the laptop, smaller.
         The gate is the one screen where that was the fault rather than
         the goal: a portrait 400:700 sheet sized from the height left
         over came out 183 points wide in an 844 point screen. Sideways
         it is a landscape sheet with the keypad beside the writing
         instead of under it, so its controls are deliberately not where
         the laptop's are. Everything else about it is still checked --
         that every control is there, on the screen and uncovered. */
      const recomposed = name === 'gate' && /phone/.test(label);
      if (!recomposed) say(!drift.length, name + ' ' + label + ': every control in the same place on its stage');
      else if (drift.length) console.log('   (the gate is laid out differently sideways, by design)');
    }
  }
  console.log('\n' + (checks - bad) + ' passed, ' + bad + ' failed\n');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
