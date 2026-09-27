/* A PLAYTHROUGH, AS SOMEBODY WHO HAS NEVER SEEN IT.

   Not a test. It opens the site cold -- nothing in localStorage, no
   flags set -- and does what a person would do: taps the thing that
   says tap, types the code on the card, turns the pages, opens each
   chapter off the hub. Every step is photographed and every page error
   is written down. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const DIR = '/tmp/claude-0/play';
const W = Number(process.env.W || 900), H = Number(process.env.H || 640);

let n = 0;
const log = [];
const say = (s) => { console.log(s); log.push(s); };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader',
           '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => { errs.push(e.message); say('  !! PAGE ERROR: ' + e.message); });
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.route('**/*', (r) => {
    const u = r.request().url();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });

  /* THE PICTURE HAS TO BE OF THE WHOLE SCREEN, NOT OF ONE CANVAS.

     Reading a canvas back with toDataURL returns a blank sheet for
     every WebGL surface in here, because none of them keeps its
     drawing buffer; and page.screenshot() waits for the page to go
     still, which three of these chapters never do. So it goes through
     the debugger's own capture, which photographs what is on the glass
     at that instant and asks nobody's permission. */
  const cdp = await p.context().newCDPSession(p);
  const shot = async (name) => {
    n++;
    const f = `${DIR}/${String(n).padStart(2, '0')}-${name}.png`;
    try {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      say(`  [shot ${f}]`);
    } catch (e) { say(`  [shot FAILED ${name}: ${e.message}]`); }
  };

  const where = () => p.evaluate(() => {
    const s = document.querySelector('.screen.active');
    return { screen: s ? s.id : '(none)',
             visibleText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300) };
  });

  say('=== opening the site cold');
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.waitForTimeout(4000);
  say('  at: ' + JSON.stringify(await where()));
  await shot('cold-open');

  module.exports = { p, b, shot, say, where, errs, log };
  global.__ctx = { p, b, shot, say, where, errs, log };
  await require('/home/user/anniversary-gift/tools/_playsteps.js')(global.__ctx);

  fs.writeFileSync(DIR + '/log.txt', log.join('\n'));
  say(`\n=== ${errs.length} page errors in the whole run`);
  errs.slice(0, 20).forEach((e) => say('   ' + e));
  await b.close();
})();
