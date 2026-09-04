/* Composited screenshots of the panel — DOM and canvas together.
   Goes through CDP because page.screenshot() hangs while a canvas loop
   is painting. Halts the loop first so the frame is stable.
   node nightui.js <outdir> [w] [h] */
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
    showScreen('nightshift'); OuissysNightShift.start(); OuissysNightShift.__night.silence(true);
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
  await p.evaluate(() => OuissysNightShift.__night.route('howto'));   await grab('howto');
  await p.evaluate(() => OuissysNightShift.__night.route('title'));
  await p.evaluate(() => OuissysNightShift.__night.route('start'));   await grab('brief');
  await p.evaluate(() => OuissysNightShift.__night.route('go'));      await grab('play');
  await p.evaluate(() => { const w = OuissysNightShift.__night; w.press('left'); w.press('hatch'); });
  await grab('doors');
  await p.evaluate(() => { const w = OuissysNightShift.__night; w.press('monitor'); w.cam('stage'); });
  await grab('cams');
  await p.evaluate(() => { const w = OuissysNightShift.__night; w.state().lost.stage = 20; w.state().monitor = true; });
  await grab('lost');
  await p.evaluate(() => { const w = OuissysNightShift.__night; w.press('monitor'); w.only('jax'); w.pump(6); });
  await grab('over');
  await p.evaluate(() => { const w = OuissysNightShift.__night; w.route('restart'); w.state().hour = 5; w.state().hourT = 55.9; w.pump(0.3); });
  await grab('shift');
  /* the dawn the story ends on: night six, five o'clock, everything
     asleep so the last minute is the last minute and nothing else */
  await p.evaluate(() => {
    const w = OuissysNightShift.__night;
    w.route('night:6'); w.route('go');
    ['cogsworth', 'chime', 'marabelle', 'jax'].forEach((k) => { w.cast()[k].asleep = true; });
    w.state().hour = 5; w.state().hourT = 55.9; w.pump(0.3);
  });
  await grab('finale');
  /* and everything the story unlocks behind it */
  await p.evaluate(() => OuissysNightShift.__night.route('custom'));   await grab('custom');
  await p.evaluate(() => OuissysNightShift.__night.route('badges'));   await grab('badges');
  await p.evaluate(() => OuissysNightShift.__night.route('gallery'));
  await p.waitForTimeout(900);                                          await grab('gallery');
  /* the office in daylight, which is the only place the warm personal
     thing on the wall is ever visible */
  await p.evaluate(() => { OuissysNightShift.__night.state().cam = 'office'; });
  await p.waitForTimeout(900);                                          await grab('gallery-office');
  await p.evaluate(() => { const w = OuissysNightShift.__night; w.route('title'); w.route('night:2'); });
  await grab('beat');
  /* the system saying its piece, on the arcade camera, with the cabinet
     lit up where it lives */
  await p.evaluate(() => {
    const w = OuissysNightShift.__night;
    w.route('go');
    if (!w.state().monitor) w.press('monitor');
    w.cam('arcade');
  });
  await p.waitForTimeout(1600);                                         await grab('arcade-cam');
  await p.evaluate(() => { const el = document.getElementById('ns-egg'); el.click(); });
  await p.waitForTimeout(700);                                          await grab('keywind');
  await b.close();
})();
