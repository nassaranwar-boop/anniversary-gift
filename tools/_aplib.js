/* THE PART EVERY APOCALYPSE SUITE GOT WRONG, IN ONE PLACE.

   Three mistakes were copied from file to file until the whole folder
   was dead: the chapter is fetched on demand, so `Apocalypse` does not
   exist at load; the hooks are installed behind a promise inside
   start(), so `__apEnter` does not exist a line later; and Playwright's
   own click and pointer hang on this page, waiting for a navigation the
   request filter has aborted. Everything here is the fix for one of
   those, or a way of finding a thing on the map instead of remembering
   where it used to be. */
const { chromium } = require('playwright-core');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

async function boot(opts) {
  opts = opts || {};
  const browser = await chromium.launch({ executablePath: CHROME,
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: opts.viewport || { width: 1180, height: 820 } });
  const errs = [];
  page.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
    ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.loadChapter && window.loadChapter('apoc'));
  await page.waitForFunction(() => !!window.Apocalypse, null, { timeout: 20000 });
  await page.evaluate(() => { showScreen('apoc'); if (!window.__apEnter) Apocalypse.start(); });
  await page.waitForFunction(() => typeof window.__apEnter === 'function', null, { timeout: 40000 });
  return { browser, page, errs };
}

function reporter() {
  const R = { pass: 0, fail: 0 };
  R.ok = (n, c, x) => {
    if (c) { R.pass++; console.log('  ok   ' + n + (x ? '  ' + x : '')); }
    else { R.fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); }
    return !!c;
  };
  R.done = async (browser, errs) => {
    R.ok('and none of it threw', !errs || errs.length === 0, (errs || []).slice(0, 2).join(' | '));
    console.log('');
    console.log(R.fail ? R.pass + ' passed, ' + R.fail + ' FAILED'
                       : 'all ' + R.pass + ' checks passed');
    await browser.close();
    process.exit(R.fail ? 1 : 0);
  };
  return R;
}

/* everything a suite does to the running game */
function driver(page) {
  const p = page;
  const D = {};
  D.state = () => p.evaluate(() => window.__apState());
  D.step = async () => (await D.state()).step;
  /* __apEnter RETURNS G, AND G IS THE WHOLE GAME.
     `evaluate(() => window.__apEnter(i))` hands that return value to
     Playwright, which serialises it -- every scene, every mesh, every
     material, every typed array -- back across CDP. That walk is seconds
     on the two biggest levels on its own, and it leaves the page slow
     afterwards as well, which is how this harness came to report a
     twelve-second first frame on streets and gates that the game does not
     actually have. Nothing here ever wanted the object; swallowing it is
     the whole fix. */
  D.enter = async (i) => { await p.evaluate(i => { window.__apEnter(i); }, i); await p.waitForTimeout(250); };
  D.clear = () => p.evaluate(() => window.__apClear());
  /* stand beside a thing the map actually has, rather than at a tile
     somebody wrote down before the map was last redrawn */
  D.goto = (ch, dy) => p.evaluate(([c, d]) => {
    const f = window.__apFind(c);
    if (!f.length) return null;
    window.__apClear();
    window.__apTeleport(f[0].x, f[0].y + d);
    window.__apPump(1 / 60, 4);
    return f[0];
  }, [ch, dy === undefined ? 1 : dy]);
  D.use = async () => { await p.evaluate(() => window.__apUse()); await p.waitForTimeout(320); };
  D.at = async (ch, dy) => { const f = await D.goto(ch, dy); if (f) await D.use(); return f; };
  /* clear whatever is being said, however many lines it turns out to be */
  D.talk = async (rounds) => {
    for (let i = 0; i < (rounds || 3); i++) {
      await p.evaluate(() => window.__apSkipDialogue && window.__apSkipDialogue());
      await p.waitForTimeout(120);
    }
  };
  D.line = () => p.evaluate(() => { const t = document.getElementById('ap-dlg-text');
                                    return t ? t.textContent : ''; });
  D.has = (sel) => p.evaluate(s => !!document.querySelector(s), sel);
  D.text = (sel) => p.evaluate(s => { const n = document.querySelector(s);
                                      return n ? n.textContent : null; }, sel);
  /* Playwright's click waits for navigations this page never finishes.
     Clicking in the page is the same DOM event and returns. */
  D.click = async (sel, match) => {
    const hit = await p.evaluate(([s, m]) => {
      for (const n of document.querySelectorAll(s)) {
        if (n.disabled) continue;
        if (m && !n.textContent.includes(m)) continue;
        n.click(); return true;
      }
      return false;
    }, [sel, match || null]);
    await p.waitForTimeout(250);
    return hit;
  };
  D.clickAll = async (sel) => {
    const n = await p.evaluate(s => { const l = document.querySelectorAll(s);
                                      l.forEach(x => x.click()); return l.length; }, sel);
    await p.waitForTimeout(200);
    return n;
  };
  /* wait for a condition rather than sleeping at it */
  D.until = async (fn, ms, arg) => {
    const end = Date.now() + (ms || 8000);
    while (Date.now() < end) {
      if (await p.evaluate(fn, arg)) return true;
      await p.waitForTimeout(120);
    }
    return false;
  };
  D.hold = (keys, secs) => p.evaluate(([k, s]) => {
    k.forEach(x => window.__apKey(x, 1));
    window.__apPump(1 / 60, Math.max(1, Math.round(s * 60)));
    k.forEach(x => window.__apKey(x, 0));
    return window.__apState();
  }, [keys, secs]);
  /* run whatever cut is playing to its end, then settle the fade that
     follows it, and say what we landed on */
  D.skipCut = async () => {
    for (let i = 0; i < 6; i++) {
      const was = await page.evaluate(() => window.__apSkipCine && window.__apSkipCine());
      await page.evaluate(() => window.__apPump(1 / 60, 90));
      await page.waitForTimeout(200);
      if (!was) break;
    }
    await page.evaluate(() => window.__apPump(1 / 60, 120));
    await page.waitForTimeout(200);
    return page.evaluate(() => window.__apState());
  };
  D.pump = (secs) => p.evaluate(s => window.__apPump(1 / 60, Math.max(1, Math.round(s * 60))), secs);
  return D;
}

module.exports = { boot, reporter, driver };
