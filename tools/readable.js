/* CAN SHE READ IT?

   Every layout suite in here measures boxes: is the control on the
   screen, is anything over it, is its hit area 44px. None of them has
   ever asked the other question a phone asks, which is whether the
   words inside those boxes are big enough to be words.

   It matters here because nearly all of this site is sized in cqh --
   a share of the stage's height -- and the stage on a phone lying down
   is 390 points tall against a laptop's 720. Every figure written as
   `1.75cqh` is 12.6px on the laptop it was designed on and 6.8px on
   the phone. The controls have a 44px floor under them; the words
   mostly do not.

   So: open every screen at a laptop size and at the two landscape
   phone sizes, walk everything with text in it, and report the
   computed size. Under 9px is unreadable and fails; 9 to 10.5px is
   small and is listed.

                       node tools/readable.js [minPx]   (default 9)
*/
const { chromium } = require('playwright-core');

const FLOOR = Number(process.argv[2] || 9);
const SMALL = FLOOR + 1.5;
const SIZES = [[1280, 800, 'laptop'], [844, 390, 'phone 844x390'], [740, 360, 'phone 740x360']];

/* where the words are, and how to get there */
const SCREENS = [
  ['gate',      (p) => p.evaluate(() => showScreen('gate'))],
  ['hub',       (p) => p.evaluate(() => { showScreen('hub'); if (window.startHub) startHub(); })],
  ['keepsake',  (p) => p.evaluate(() => { try { startKeepsake(); } catch (e) {} showScreen('keepsake'); })],
  ['quest',     (p) => p.evaluate(() => { showScreen('hub'); const c = document.getElementById('hub-card-quest'); if (c) c.click(); })],
  ['ouissy',    (p) => p.evaluate(() => { showScreen('hub'); const c = document.getElementById('hub-card-ouissy'); if (c) c.click(); })],
  ['race',      (p) => p.evaluate(() => { showScreen('hub'); const c = document.getElementById('hub-card-race'); if (c) c.click(); })],
  ['apoc',      (p) => p.evaluate(() => { showScreen('hub'); const c = document.getElementById('hub-card-apoc'); if (c) c.click(); })],
];

/* the racer's menus are three screens deep and every one of them is
   words; the same for the night shift's cards */
const DEEPER = {
  race: [['the courses', '[data-go="single"]'], ['the drivers', '[data-char="0"]'],
         ['the course list', '[data-next="chars"]']],
  nightshift: [['how it works', null], ['the record', null]],
};

let fail = 0, pass = 0;
const seen = {};

function measure() {
  const out = [];
  const root = document.querySelector('.screen.active');
  if (!root) return out;
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    let text = '';
    for (const n of el.childNodes) if (n.nodeType === 3) text += n.nodeValue;
    text = text.trim();
    const r = el.getBoundingClientRect();
    if (text && r.width > 1 && r.height > 1) {
      out.push({
        px: +parseFloat(cs.fontSize).toFixed(1),
        cls: ((el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : '') || el.tagName),
        text: text.replace(/\s+/g, ' ').slice(0, 26),
      });
    }
    for (const c of el.children) walk(c);
  };
  walk(root);
  return out;
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, label] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: h < 500, hasTouch: h < 500 });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:' + (process.argv[3] || '8899') + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(1200);
    console.log('\n=== ' + label);
    for (const [name, go] of SCREENS) {
      if (name === 'nightshift' &&
          !(await p.evaluate(() => !!document.getElementById('hub-card-nightshift')))) {
        console.log('   ' + name.padEnd(11) + 'not in this tree');
        continue;
      }
      await go(p);
      await p.waitForTimeout(name === 'gate' || name === 'hub' || name === 'keepsake' ? 1800 : 9000);
      const rows = await p.evaluate(measure);
      const tiny = rows.filter((r) => r.px < FLOOR);
      const small = rows.filter((r) => r.px >= FLOOR && r.px < SMALL);
      if (tiny.length) { fail++;
        console.log('  FAIL ' + label + ' ' + name + ': ' + tiny.length + ' pieces of writing under ' + FLOOR + 'px');
        tiny.slice(0, 8).forEach((t) => console.log('        ' + String(t.px).padStart(5) + 'px  ' + t.cls.padEnd(22) + ' "' + t.text + '"'));
        tiny.forEach((t) => { seen[t.cls] = Math.min(seen[t.cls] === undefined ? 99 : seen[t.cls], t.px); });
      } else { pass++; }
      console.log('   ' + name.padEnd(11) + rows.length + ' pieces of writing, smallest '
                  + (rows.length ? Math.min.apply(null, rows.map((r) => r.px)) : '-') + 'px'
                  + (small.length ? '   (' + small.length + ' between ' + FLOOR + ' and ' + SMALL + 'px)' : ''));
      /* and the screens behind the first one */
      for (const [what, sel] of (DEEPER[name] || [])) {
        if (!sel) continue;
        const hit = await p.evaluate((s) => { const e = document.querySelector('.screen.active ' + s); if (e) { e.click(); return true; } return false; }, sel);
        if (!hit) continue;
        await p.waitForTimeout(1200);
        const deep = await p.evaluate(measure);
        const dtiny = deep.filter((r) => r.px < FLOOR);
        if (dtiny.length) { fail++;
          console.log('  FAIL ' + label + ' ' + name + '/' + what + ': ' + dtiny.length + ' under ' + FLOOR + 'px');
          dtiny.slice(0, 8).forEach((t) => console.log('        ' + String(t.px).padStart(5) + 'px  ' + t.cls.padEnd(22) + ' "' + t.text + '"'));
          dtiny.forEach((t) => { seen[t.cls] = Math.min(seen[t.cls] === undefined ? 99 : seen[t.cls], t.px); });
        } else pass++;
        console.log('     ' + (name + '/' + what).padEnd(24) + deep.length + ' pieces, smallest '
                    + (deep.length ? Math.min.apply(null, deep.map((r) => r.px)) : '-') + 'px');
      }
    }
    await p.close();
  }
  const worst = Object.keys(seen).sort((a, c) => seen[a] - seen[c]);
  if (worst.length) {
    console.log('\nthe classes that go under ' + FLOOR + 'px, smallest first:');
    worst.forEach((k) => console.log('   ' + String(seen[k]).padStart(5) + 'px  ' + k));
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
