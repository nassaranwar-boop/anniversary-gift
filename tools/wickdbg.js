const { chromium } = require('playwright-core');
const T0 = Date.now();
const log = (m) => console.log(((Date.now()-T0)/1000).toFixed(1)+'s ' + m);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', e => log('PAGEERROR ' + e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  log('loaded');
  await p.addStyleTag({ content: '.screen.anim-in{animation:none !important}' });
  log('styled');
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); if (window.startHub) startHub(); });
  log('hub');
  await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('hub-card-wick').click());
  log('tapped');
  await p.waitForTimeout(2600);
  log('waited');
  const n = await p.evaluate(() => document.querySelectorAll('#screen-wick.active').length);
  log('active=' + n);
  const ph = await p.evaluate(() => window.WickAndCogs && WickAndCogs.__wick ? WickAndCogs.__wick.state().phase : 'no-api');
  log('phase=' + ph);
  await b.close();
})().catch(e => { log('THROW ' + e.message.split('\n')[0]); process.exit(1); });
