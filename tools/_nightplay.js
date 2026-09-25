/* OUISSY'S NIGHT SHIFT, PLAYED COLD, FROM THE MENU TO THE FILM.

   Not a test. This opens the shop with nothing remembered -- no nights
   unlocked, no first-times spent, no record -- and plays it the way
   somebody who has never seen it would: read the card that says how it
   works, press the big button, watch what happens, shut a door when
   something is at one, sweep the cameras, and press whatever the game
   puts in front of it.

   Everything is photographed and everything written on the screen is
   written down, so the whole run can be read back afterwards as an
   experience rather than as a pass or a fail. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const DIR = process.env.DIR || '/tmp/claude-0/night';
const W = Number(process.env.W || 1000), H = Number(process.env.H || 640);
const NIGHTS = Number(process.env.NIGHTS || 6);
const SPEED = Number(process.env.SPEED || 1);   /* >1 shortens the hour */

fs.mkdirSync(DIR, { recursive: true });
let n = 0;
const lines = [];
/* written through as it happens, so a long run can be read while it is
   still going rather than only after it ends */
const say = (s) => { console.log(s); lines.push(s);
  try { fs.appendFileSync(DIR + '/live.txt', s + '\n'); } catch (e) {} };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader',
           '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  p.on('pageerror', (e) => { errs.push(e.message); say('  !! PAGE ERROR: ' + e.message); });
  await p.route('**/*', (r) => {
    const u = r.request().url();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  const cdp = await p.context().newCDPSession(p);
  const shot = async (name) => {
    n++;
    const f = `${DIR}/${String(n).padStart(3, '0')}-${name}.png`;
    try {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      say(`  [${f}]`);
    } catch (e) { say(`  [shot failed ${name}: ${e.message}]`); }
  };
  const T = (ms) => p.waitForTimeout(ms);

  /* a real tap, because half of this answers pointerdown */
  const tap = async (sel, what) => {
    const box = await p.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return { off: true };
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, sel);
    if (!box || box.off) { say(`  tap ${what || sel}: ${box ? 'NO SIZE' : 'NOT THERE'}`); return false; }
    await p.mouse.move(box.x, box.y);
    await p.mouse.down(); await T(50); await p.mouse.up();
    say(`  tap ${what || sel}`);
    return true;
  };

  /* what is on the screen, as a person would read it */
  const card = () => p.evaluate(() => {
    const ov = document.getElementById('ns-overlay');
    const up = ov && !ov.hidden && ov.getAttribute('aria-hidden') !== 'true' && ov.innerText.trim();
    return {
      phase: (window.OuissysNightShift && OuissysNightShift.__night
              && OuissysNightShift.__night.state().phase) || '?',
      card: up ? ov.innerText.replace(/\n{2,}/g, '\n').trim() : null,
      buttons: [].slice.call(document.querySelectorAll('#ns-overlay [data-go]'))
                 .map((x) => x.innerText.trim() + ' {' + x.getAttribute('data-go') + '}'),
      hud: ((document.getElementById('ns-hud') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
      tape: ((document.getElementById('ns-tape') || {}).innerText || '').trim(),
      says: ((document.getElementById('ns-say') || {}).innerText || '').trim(),
      tutor: ((document.getElementById('ns-tutor') || {}).innerText || '').trim(),
      cine: (() => { const e = document.getElementById('ns-cine');
                     return e && !e.hidden ? e.innerText.replace(/\s+/g, ' ').trim() : ''; })(),
    };
  });

  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  /* NOTHING REMEMBERED AT ALL -- unless the opening has already been
     read cold once and what is wanted this time is the six nights. The
     statement and the terms are still played and still left by their
     own SKIP buttons; only orientation is marked seen, which is what
     the chapter itself does to a player after one pass through it. */
  const SEEN = process.env.SEEN === '1';
  await p.evaluate((seen) => {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('ns_seenintro', '');
    if (seen) localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); }, SEEN);
  await p.waitForFunction(() => { try { return !!OuissysNightShift.__night.state(); } catch (e) { return false; } },
                          { timeout: 40000, polling: 200 });
  await T(2500);

  say('\n########## THE MENU');
  say(JSON.stringify(await card(), null, 1));
  await shot('menu');

  say('\n########## "HOW IT WORKS" -- the only place to learn the rules');
  await tap('[data-go="howto"]', 'HOW IT WORKS');
  await T(1500);
  const how = await card();
  say(how.card || '(nothing)');
  say('  buttons: ' + JSON.stringify(how.buttons));
  await shot('howto');
  /* page through it if it has pages */
  for (let i = 0; i < 6; i++) {
    const more = await p.evaluate(() => {
      const b = [].slice.call(document.querySelectorAll('#ns-overlay [data-go]'))
        .filter((x) => /next|more|›/i.test(x.innerText))[0];
      if (!b) return false; b.click(); return true; });
    if (!more) break;
    await T(900);
    await shot('howto-' + (i + 2));
    say((await card()).card || '');
  }
  await tap('#ns-overlay [data-go="title"]', 'GOT IT');
  await T(1600);

  say('\n########## PRESSING THE BIG BUTTON');
  await tap('[data-go="start"]', 'BEGIN THE SHIFT');
  await T(4000);
  say('  phase: ' + (await card()).phase);
  await shot('after-begin');

  if (SEEN) {
    say('\n########## HIS STATEMENT -- left by its own SKIP, read cold in an earlier run');
    await T(3400);                                   /* its SKIP fades in at 2.2s */
    await tap('#ns-cine-skip', 'SKIP (the film)');
    await T(2200);
    await tap('#ns-terms-skip', 'SKIP (the terms)');
    await T(2600);
    say('  phase: ' + (await card()).phase);
  }

  /* HIS STATEMENT. It is the opening of the story and it has a SKIP on
     it, so a first-timer watches the whole thing. Every line of it is
     written down and it is photographed as it goes. */
  say('\n########## HIS STATEMENT');
  let lastCine = '', beats = 0;
  for (let i = 0; i < 260; i++) {
    const c = await card();
    if (c.phase !== 'intro') { say(`  (the statement ended, phase is now ${c.phase})`); break; }
    if (c.cine && c.cine !== lastCine) {
      lastCine = c.cine;
      say('   | ' + c.cine.slice(0, 160));
      if (beats % 3 === 0) await shot('statement-' + beats);
      beats++;
    }
    await T(1000);
  }
  say('  after the statement: ' + JSON.stringify(await card(), null, 1));
  await shot('after-statement');

  /* whatever card is up, press its go button, until a night starts */
  for (let i = 0; i < 40; i++) {
    const c = await card();
    if (c.phase === 'play') break;
    if (c.card) { say(`\n--- card [${c.phase}]\n${c.card}`); await shot('card-' + c.phase + '-' + i); }
    const pressed = await p.evaluate(() => {
      const bs = [].slice.call(document.querySelectorAll('#ns-overlay [data-go]'));
      const go = bs.filter((x) => x.classList.contains('ns-btn-go'))[0] || bs[0];
      if (!go) return null;
      const t = go.innerText.trim(); go.click(); return t; });
    say('  pressed: ' + pressed);
    await T(2200);
  }

  await require(process.env.PLAY || '/home/user/anniversary-gift/tools/_nightplay2.js')(
    { p, T, tap, card, shot, say, lines, errs, NIGHTS, SPEED, DIR });

  fs.writeFileSync(DIR + '/log.txt', lines.join('\n'));
  say(`\n########## ${errs.length} page errors`);
  errs.slice(0, 10).forEach((e) => say('  ' + e));
  await b.close();
})();
