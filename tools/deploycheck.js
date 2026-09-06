/* Load the site the way a deployment serves it — a clean checkout on a
 * plain static server, nothing built, no local edits — and report every
 * request it makes, every one that 404s, and every page error.
 *
 * The bug this exists for: a file that works locally because it is
 * sitting in the working tree but was never committed, or was committed
 * but is excluded from the deploy by .vercelignore. Locally everything
 * is green; on the preview URL the page is blank and the console says
 * nothing useful.
 *
 *   node deploycheck.js [origin]      default http://127.0.0.1:8901
 */
const { chromium } = require('playwright-core');
const ORIGIN = process.argv[2] || 'http://127.0.0.1:8901';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });

  const errors = [], failed = [], asked = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', r => asked.push(r.url()));
  page.on('requestfailed', r => failed.push(r.url() + '  ' + (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + '  ' + r.url()); });

  /* only block the outside world, exactly as the other suites do —
     Google Fonts is unreachable from in here and is not the site */
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    return r.abort();
  });

  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  /* walk far enough in to pull the adventure and its score off the wire */
  const reached = await page.evaluate(async () => {
    const got = {};
    got.gate = typeof showScreen === 'function';
    if (got.gate) { showScreen('quest'); startQuest(); }
    await new Promise(r => setTimeout(r, 600));
    got.quest = typeof hvNode !== 'undefined' ? hvNode : null;
    got.ost = !!window.OST;
    got.cues = window.OST ? Object.keys(window.OST.cues).length : 0;
    got.pair = typeof hvDrawPair === 'function';
    const c = document.getElementById('hv-canvas');
    if (c) {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 400) if (d[i + 3] > 8) lit++;
      got.painted = lit;
    }
    return got;
  });

  const html = await page.content();
  console.log('origin        ', ORIGIN);
  console.log('requests      ', asked.length);
  console.log('failed        ', failed.length);
  failed.forEach(f => console.log('   ' + f));
  console.log('page errors   ', errors.length);
  errors.slice(0, 8).forEach(e => console.log('   ' + e));
  console.log('reached       ', JSON.stringify(reached));
  console.log('html bytes    ', html.length);

  const bad = failed.length || errors.length || !reached.ost || !reached.painted;
  console.log(bad ? '\nFAIL — this is what a deployment would serve' : '\nPASS — a clean checkout serves and runs');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
