/* THE MATCH ON A PHONE, WHICH IS WHERE IT WILL ACTUALLY BE PLAYED.
 *
 * Every other cup harness runs at 960x540 on a desktop mouse. The
 * person this is for will open it on a phone, in portrait and in
 * landscape, with a thumb — and the side-on camera changed what is
 * where on that screen.
 *
 *   node tools/cupphone.js
 */
const { chromium } = require('playwright-core');

/* PRESS A CANVAS WIDGET THE WAY A THUMB DOES — the menus are drawn
   rather than laid out, so there is no element to click. */
async function tapUi(p, id) {
  await p.waitForFunction(() => OuissyCup.__cup.ui().age > 1.1, null,
                          { timeout: 20000, polling: 80 });
  const r = await p.evaluate((wid) => {
    const w = OuissyCup.__cup.ui().widgets.find(v => v.id === wid);
    if (!w) return null;
    const c = document.getElementById('cup-ui');
    const b = c.getBoundingClientRect();
    const sx = b.width / c.width, sy = b.height / c.height;
    return { x: b.x + (w.x + w.w / 2) * sx, y: b.y + (w.y + w.h / 2) * sy };
  }, id);
  if (!r) throw new Error('no widget ' + id);
  await p.mouse.click(r.x, r.y);
}

const SIZES = [
  ['portrait', 390, 844],
  ['landscape', 844, 390],
  ['small', 360, 640],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });

  for (const [name, w, h] of SIZES) {
    const ctx = await b.newContext({
      viewport: { width: w, height: h }, deviceScaleFactor: 2,
      hasTouch: true, isMobile: true,
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(900);
    /* PAST "TURN YOUR PHONE" THE WAY A PLAYER WITH ROTATION LOCK ON
       WOULD. In portrait the prompt covers the page and swallows every
       tap, which is exactly its job — but the point of this harness is
       to see the match at phone sizes, so it takes the way out rather
       than pretending the prompt is not there. */
    await p.evaluate(() => {
      const b = document.getElementById('rotate-anyway');
      if (b && getComputedStyle(document.getElementById('rotate-me')).display !== 'none') b.click();
    });
    await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
    await p.waitForTimeout(250);
    await p.click('#hub-card-cup');
    await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
    await p.waitForTimeout(700);

    /* THROUGH THE REAL MENUS, not through the quick-match hook.

       The hook unhides the scoreboard and not the thumb pad, so every
       harness that uses it photographs a match with no controls on it
       — which reads as "the game has no touch controls on a phone" and
       is really just the hook being a hook. The only way to see what a
       player sees is to walk in the way a player does. */
    await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'help',
                            null, { timeout: 30000, polling: 100 });
    await tapUi(p, 'card_go');
    await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'title',
                            null, { timeout: 30000, polling: 100 });
    await tapUi(p, 'm_coupe');
    await p.waitForFunction(() => OuissyCup.__cup.ui().name === 'round',
                            null, { timeout: 30000, polling: 100 });
    await tapUi(p, 'card_go');
    await p.evaluate(() => {
      const H = OuissyCup.__cup;
      H.auto(true);
      for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      for (let i = 0; i < 700; i++) H.step(1, 0, 0, false);
      while (H.state().state !== 'play') H.step(1, 0, 0, false);
      H.camSnap();
    });
    await p.waitForTimeout(1000);
    await p.screenshot({ path: `/tmp/phone-${name}.png` });

    /* WHERE THE CONTROLS ARE, in the page's own coordinates, so a
       thumb-sized target can be checked rather than eyeballed. */
    const geo = await p.evaluate(() => {
      const out = { view: [innerWidth, innerHeight], els: {} };
      ['cup-pad', 'cup-stick', 'cup-btn', 'cup-heart', 'cup-canvas', 'cup-ui'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) { out.els[id] = null; return; }
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out.els[id] = {
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height),
          shown: cs.display !== 'none' && cs.visibility !== 'hidden' && !el.hidden,
          opacity: +cs.opacity,
        };
      });
      const c = document.getElementById('cup-canvas');
      if (c) out.canvas = { css: [c.clientWidth, c.clientHeight], px: [c.width, c.height] };
      return out;
    });
    console.log(name + ' ' + w + 'x' + h + ' -> /tmp/phone-' + name + '.png');
    console.log('  ' + JSON.stringify(geo));
    if (errs.length) console.log('  PAGE ERRORS: ' + JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  console.log('DONE');
  await b.close();
})();
