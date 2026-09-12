/* What the adventure costs per frame.
 *
 * Wall-clock frame rate means nothing in this container — requestAnimationFrame
 * runs at about 3fps here, which measures the container and not the site. So
 * this measures the thing that is actually portable: how long one call to
 * hvPaintFrame takes, on the heaviest scenes in the chapter, averaged over
 * hundreds of calls with the real loop stopped.
 *
 * A 60fps budget is 16.7ms for EVERYTHING — the browser's own compositing
 * included — so the paint itself wants to be a small fraction of that. The
 * scenes measured are chosen to be the worst cases: the rain, a full
 * conversation, a mechanic mid-play, and the ending with the big cat and the
 * hearts on it.
 *
 *   node hvperf.js
 */
const { chromium } = require('playwright-core');
const out = [];
const ok = (n, c, x) => out.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '   ' + x : ''));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  const rows = await page.evaluate(() => {
    showScreen('quest'); startQuest();
    hvStopLoop();                       // measure the paint, not the scheduler

    const scenes = [
      ['title',        'title'],
      ['sakura',       'pick'],
      ['the rain',     'there_shower'],
      ['a conversation', 'there_quiet'],
      ['the stones',   'there_stones'],
      ['the orchard',  'back_bear'],
      ['the bridge',   'back_bridge2'],
      ['the fog',      'there_fog'],
      ['the ending',   'yay'],
    ];
    const res = [];
    for (const [label, node] of scenes) {
      hvNode = node; hvHistory = []; hvRender(false);
      hvStopLoop();
      /* warm the caches the way a few seconds of play would */
      for (let i = 0; i < 30; i++) { hvArrive = 0; hvPaintFrame(i * 0.05, 0.016); }
      const N = 300;
      const t0 = performance.now();
      for (let i = 0; i < N; i++) { hvArrive = 0; hvPaintFrame(2 + i * 0.016, 0.016); }
      const ms = (performance.now() - t0) / N;
      res.push({ label, node, ms: +ms.toFixed(3) });
    }

    /* and how much the background repaint costs, which happens once per
       scene change rather than per frame */
    hvNode = 'there_shower'; hvRender(false); hvStopLoop();
    const b0 = performance.now();
    for (let i = 0; i < 20; i++) hvPaintBase(HV[hvNode]);
    const baseMs = (performance.now() - b0) / 20;

    return { res, baseMs: +baseMs.toFixed(2) };
  });

  console.log('per-frame cost of hvPaintFrame (60fps budget is 16.7ms for everything)\n');
  rows.res.forEach(r => {
    const bar = '#'.repeat(Math.max(1, Math.round(r.ms * 8)));
    console.log('  ' + r.label.padEnd(17) + String(r.ms).padStart(7) + ' ms  ' + bar);
  });
  console.log('\n  scene repaint     ' + String(rows.baseMs).padStart(5) + ' ms   (once per scene change, not per frame)');

  const worst = rows.res.reduce((a, b) => (b.ms > a.ms ? b : a));
  console.log('\n  worst: ' + worst.label + ' at ' + worst.ms + ' ms — ' +
              (worst.ms / 16.7 * 100).toFixed(1) + '% of a 60fps frame');

  ok('every scene paints in well under a 60fps frame', worst.ms < 8,
     'worst ' + worst.label + ' ' + worst.ms + 'ms');
  ok('a scene change is not a stall', rows.baseMs < 60, rows.baseMs + 'ms');
  ok('no page errors while painting', errors.length === 0, errors.join(' | '));

  console.log('\n' + out.join('\n'));
  await browser.close();
  process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})();
