/* Composited screenshots of the panel — DOM and canvas together.
   Goes through CDP because page.screenshot() hangs while a canvas loop
   is painting. Halts the loop first so the frame is stable.
   node wickui.js <outdir> [w] [h] */
const { chromium } = require('playwright-core');
const fs = require('fs');
const [OUT = '/tmp/wkui', W = 1280, H = 860] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort();
  });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '.screen.anim-in{animation:none !important}';
    document.head.appendChild(st);
    try { localStorage.clear(); } catch (e) {}
    showScreen('wick'); WickAndCogs.start(); WickAndCogs.__wick.silence(true);
  });
  await p.waitForTimeout(1800);
  const cdp = await p.context().newCDPSession(p);
  const grab = async (name) => {
    await p.waitForTimeout(500);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT + '-' + name + '.png', Buffer.from(data, 'base64'));
    console.log('wrote', name);
  };
  await grab('title');
  await p.evaluate(() => WickAndCogs.__wick.route('howto'));   await grab('howto');
  await p.evaluate(() => WickAndCogs.__wick.route('title'));
  await p.evaluate(() => WickAndCogs.__wick.route('start'));   await grab('brief');
  await p.evaluate(() => WickAndCogs.__wick.route('go'));      await grab('play');
  await p.evaluate(() => { const w = WickAndCogs.__wick; w.press('left'); w.press('hatch'); });
  await grab('doors');
  await p.evaluate(() => { const w = WickAndCogs.__wick; w.press('monitor'); w.cam('stage'); });
  await grab('cams');
  await p.evaluate(() => { const w = WickAndCogs.__wick; w.state().lost.stage = 20; w.state().monitor = true; });
  await grab('lost');
  await p.evaluate(() => { const w = WickAndCogs.__wick; w.press('monitor'); w.only('jax'); w.pump(6); });
  await grab('over');
  await p.evaluate(() => { const w = WickAndCogs.__wick; w.route('restart'); w.state().hour = 5; w.state().hourT = 55.9; w.pump(0.3); });
  await grab('shift');
  await p.evaluate(() => { const w = WickAndCogs.__wick; w.route('night:3'); w.route('go'); w.state().hour = 5; w.state().hourT = 55.9; w.pump(0.3); });
  await grab('finale');
  await b.close();
})();
