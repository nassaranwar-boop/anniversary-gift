/* DOES THE MODEL ACTUALLY WEAR WHAT SHE PICKS?
 *
 * The squad builder now stands a player in the panel so that changing
 * the kit, the trim, the shorts or the badge is something she SEES
 * rather than something she imagines. That claim is exactly the kind
 * that can be true in a comment and false on the screen: the model is
 * baked from a cache keyed on the colours, and a key that forgets one
 * of them gives you a model that never changes for that control and
 * looks perfectly fine for the other two.
 *
 * So this reads the pixels. It photographs the model's own rectangle
 * on the menu canvas, presses one swatch, and photographs it again.
 * Same pixels means the control does nothing.
 *
 *   node tools/cupmodel.js
 */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n + (x !== undefined ? '  ' + x : '')); }
                          else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); } };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport:{width:1280,height:800}, deviceScaleFactor:1 });
  const errs = []; p.on('pageerror', e=>errs.push(e.message));
  await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(800);
  await p.evaluate(()=>window.loadChapter&&window.loadChapter('cup'));
  await p.waitForFunction(()=>!!window.OuissyCup,{timeout:30000});
  await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('cup');
                        OuissyCup.__cup.soundOff(); OuissyCup.start();});
  const settle = async (n)=>{ await p.waitForFunction((x)=>OuissyCup.__cup.ui().name===x,n,{timeout:60000});
                              await p.waitForFunction(()=>OuissyCup.__cup.ui().age>1.4,null,{timeout:120000,polling:200}); };
  await settle('help');
  await p.evaluate(()=>OuissyCup.__cup.press('card_go'));
  await settle('title');
  await p.evaluate(()=>OuissyCup.__cup.press('m_teams'));
  await settle('teams');
  await p.evaluate(()=>OuissyCup.__cup.press('build'));
  await settle('builder');

  /* HOW THIS IS MEASURED, after the first attempt measured the wrong
     thing. A checksum over the model's rectangle changes when the
     colour changes -- and also every time he breathes, by more than
     some of the colour changes do, so it cannot tell them apart.

     What is asked instead is the question a person would ask: after
     she picks the blue one, IS THERE BLUE ON HIM. The swatch's own
     colour is read off the canvas, and the pixels near it inside his
     box are counted before and after. An idle animation does not
     invent a colour. */
  const r = await p.evaluate(async () => {
    const H = OuissyCup.__cup;
    const cv = document.getElementById('cup-ui');
    const g = cv.getContext('2d', { willReadFrequently: true });
    const u = H.ui();
    const kit0 = u.widgets.find(w => w.id === 'KIT_0');
    if (!kit0) return { err: 'no KIT row' };
    const box = { x: 214, y: kit0.y - 12, w: 56, h: 70 };
    /* HIM, AND NOT THE GRASS HE IS STANDING ON. The strip at the
       bottom of his box is a mown pitch, and a green swatch would
       have matched it whether or not he was wearing one. */
    const sprite = { x: 216, y: kit0.y - 10, w: 52, h: 48 };
    const badge = { x: 214, y: kit0.y - 14, w: 56, h: 20 };

    const waitFrames = () => new Promise(res => {
      let n = 0;
      const tick = () => (++n > 3 ? res() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
    const colourAt = (w) => {
      const d = g.getImageData(Math.round(w.x + w.w / 2), Math.round(w.y + w.h / 2), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    /* BY HUE, NOT BY VALUE.

       The first version of this counted pixels equal to the swatch's
       own rgb and found none of any colour, ever. It is not that the
       kit does not change: a sprite is baked from a RAMP, so the
       shirt on the model is a shaded version of what she picked and
       never the flat swatch. Measured, a #c1272d shirt paints as
       rgb(199,56,71). Hue survives that and lightness does not, so
       hue is what is counted. */
    const hueOf = (r2, g2, b2) => {
      const mx = Math.max(r2, g2, b2), mn = Math.min(r2, g2, b2), d2 = mx - mn;
      if (!d2) return -1;
      let h;
      if (mx === r2) h = ((g2 - b2) / d2) % 6;
      else if (mx === g2) h = (b2 - r2) / d2 + 2;
      else h = (r2 - g2) / d2 + 4;
      h *= 60; if (h < 0) h += 360;
      return { h: h, s: mx ? d2 / mx : 0, v: mx / 255 };
    };
    const countHue = (bx, c, tol) => {
      const want = hueOf(c[0], c[1], c[2]);
      if (want === -1) return -1;                 // a grey swatch has no hue
      const d = g.getImageData(bx.x, bx.y, bx.w, bx.h).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const p2 = hueOf(d[i], d[i+1], d[i+2]);
        /* THE PANEL BEHIND HIM IS A BLUE-GREY, and at a value of 0.16 it
           passed a saturation test and matched the blue swatch sixteen
           hundred times over. Only lit pixels count: a shirt is bright,
           a background is not. */
        if (p2 === -1 || p2.s < 0.25 || p2.v < 0.35) continue;
        let dh = Math.abs(p2.h - want.h);
        if (dh > 180) dh = 360 - dh;
        if (dh <= tol) n++;
      }
      return n;
    };
    const sig = (bx) => {
      const d = g.getImageData(bx.x, bx.y, bx.w, bx.h).data;
      let s2 = 0;
      for (let i = 0; i < d.length; i += 4) s2 += d[i] * 7 + d[i+1] * 13 + d[i+2] * 29;
      return s2;
    };
    const press = (id) => { const w = H.ui().widgets.find(x => x.id === id); if (w) H.press(id); return !!w; };
    /* THE PANEL HAS TO BE STILL BEFORE IT IS READ. It used to re-run
       its whole entrance on every tap -- that is fixed -- but the
       redraw still takes a frame or two to land, and reading during
       one is how the first version of this test decided a working
       control did nothing. */
    const settled = async () => {
      for (let i = 0; i < 40; i++) { await waitFrames(); if (H.ui().age > 1.4) return; }
    };

    const out = { box: box, rows: {} };
    for (const row of [['KIT', 'KIT_4'], ['SHORTS', 'SHORTS_3'], ['TRIM', 'TRIM_1']]) {
      await waitFrames();
      const w = H.ui().widgets.find(x => x.id === row[1]);
      if (!w) { out.rows[row[0]] = { err: 'no widget' }; continue; }
      const col = colourAt(w);
      const before = countHue(sprite, col, 22);
      out.rows[row[0]] = { colour: col, before: before, pressed: press(row[1]) };
      await settled(); await waitFrames();
      out.rows[row[0]].after = countHue(sprite, col, 22);
    }
    /* THE BADGE IS A SHAPE, NOT A COLOUR, so it is the one thing here
       that a checksum answers properly -- and it sits in the top strip
       of the box, where nothing is animating. */
    await waitFrames();
    out.badgeBefore = sig(badge);
    out.pressedCrest = press('crest_moon');
    await settled(); await waitFrames();
    out.badgeAfter = sig(badge);
    return out;
  });

  if (r.err) { console.log(r.err); process.exit(1); }
  Object.keys(r.rows).forEach(function (k) {
    const row = r.rows[k];
    if (row.err) { ok('the ' + k + ' row is reachable', false, row.err); return; }
    console.log('   ' + k.padEnd(7) + ' rgb(' + row.colour.join(',') + ')   ' +
                row.before + ' pixels of that hue on him before, ' + row.after + ' after');
    ok('picking a ' + k.toLowerCase() + ' colour puts it on the model',
       row.after > row.before + 10, row.before + ' -> ' + row.after);
  });
  ok('picking a badge changes the badge above him',
     Math.abs(r.badgeAfter - r.badgeBefore) > 4000,
     'delta ' + Math.abs(r.badgeAfter - r.badgeBefore));
  ok('no page errors', errs.length === 0, errs.slice(0,2).join(' | '));
  console.log('');
  console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'all ' + pass + ' checks passed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
