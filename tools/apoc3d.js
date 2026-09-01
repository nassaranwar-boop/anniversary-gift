const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-anniversary-gift/85bd4ff5-90c7-5866-8597-7159ac2fad5f/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s]`, ...a);

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']
  });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);

  await p.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(Number(process_q)); });
  log('booted, loop frozen, quality 2');

  async function pump(n) { await p.evaluate(n => { for (let i=0;i<n;i++) window.__apPump(1/60); }, n); }
  async function shot(name) {
    await p.evaluate(() => window.__apPaint());
    await p.locator('#ap-stage').screenshot({ path: `${OUT}/${name}.png` });
    log('shot', name);
  }

  const targets = process.env.ONLY ? process.env.ONLY.split(',') : ['home','streets','hospital','escape','gates'];
  const idx = { home:0, streets:1, hospital:2, escape:3, gates:4 };
  for (const name of targets) {
    if (!(name in idx)) continue;
    const ta = Date.now();
    await p.evaluate(i => window.__apEnter(i), idx[name]);
    log(name, 'built in', ((Date.now()-ta)/1000).toFixed(1)+'s');
    await pump(60);
    await shot(`0${idx[name]+1}-${name}`);
    log(name, JSON.stringify(await p.evaluate(() => window.__apState())));
  }

  if (!process.env.ONLY || process.env.ONLY.includes('sub')) {
    await p.evaluate(() => window.__apRoadside()); await pump(60); await shot('06-roadside');
    await p.evaluate(() => { window.__apCampsite(); window.__apSkipDialogue(); }); await pump(60); await shot('07-campsite');
  }

  log('--- errors ---');
  console.log(errs.length ? errs.slice(0,20).join('\n') : 'none');
  await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
