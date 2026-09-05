const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = '/tmp/claude-0/-home-user-anniversary-gift/85bd4ff5-90c7-5866-8597-7159ac2fad5f/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s]`, ...a);
const PLAN = JSON.parse(fs.readFileSync(process.env.PLAN, 'utf8'));
const Q = Number(process.env.Q || 1);

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']
  });
  const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(q => { window.__apLoop(false); window.__apQuality(q); }, Q);
  log('booted q=' + Q);

  for (const step of PLAN) {
    try {
      await p.evaluate(c => { (0,eval)(c); }, step.cmd);
      if (step.tp) await p.evaluate(t => window.__apTeleport(t[0], t[1]), step.tp);
      await p.evaluate(n => { for (let i=0;i<n;i++) window.__apPump(1/60); }, step.pump || 30);
      await p.evaluate(() => window.__apPaint());
      await p.locator('#ap-stage').screenshot({ path: `${OUT}/${step.name}.png` });
      log('shot', step.name, JSON.stringify(await p.evaluate(() => window.__apState())));
    } catch (e) { log('FAILED', step.name, e.message); }
  }
  log('--- errors ---');
  console.log(errs.length ? errs.slice(0,15).join('\n') : 'none');
  await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
