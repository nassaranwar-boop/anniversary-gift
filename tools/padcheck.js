/* TWO THUMBS.

   She holds RIGHT and taps JUMP, and the running stopped dead. The pad had
   a window-level safety net — `window.addEventListener("pointerup",
   releaseAll)` — written to stop a button ever getting stuck down, and it
   worked, but releaseAll clears EVERY key. So the jump thumb lifting
   released the direction the other thumb was still holding.

   This plays that exact gesture with two pointer ids and checks the
   direction survives. It is the only test here that uses more than one
   finger, which is why nothing caught it.

   Usage:  node padcheck.js
*/
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS  ' + n + (x ? '   ' + x : '')); }
                          else { fail++; console.log('FAIL  ' + n + (x ? '   ' + x : '')); } };

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  for (const [w, h, label] of [[844, 390, 'landscape'], [390, 844, 'portrait']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h },
                                           isMobile: true, hasTouch: true });
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
      ? r.continue() : r.abort());
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2200);
    await page.evaluate(() => { showScreen('ouissy'); if (window.startSuperOuissy) startSuperOuissy(); });
    await page.waitForTimeout(1800);

    const r = await page.evaluate(() => {
      const keys = window.__soKeys;
      if (!keys) return { missing: true };
      const at = (k) => document.querySelector('[data-so-key="' + k + '"]');
      const fire = (el, type, id) => {
        const b = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
          clientX: b.left + b.width / 2, clientY: b.top + b.height / 2,
        }));
        /* the real safety net lives on the window, so the event has to
           reach it the way a browser would */
        if (type === 'pointerup' || type === 'pointercancel') {
          window.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch' }));
        }
      };
      const right = at('right'), jump = at('jump');
      if (!right || !jump) return { missing: true };

      window.__soReleaseAll();
      fire(right, 'pointerdown', 1);              // thumb one holds right
      const heldBefore = !!keys().right;
      fire(jump, 'pointerdown', 2);               // thumb two taps jump
      const jumpTook = !!keys().jump;
      fire(jump, 'pointerup', 2);                 // and lifts
      const stillRunning = !!keys().right;
      fire(right, 'pointerup', 1);                // thumb one finally lifts
      const releasedAfter = !keys().right;
      return { heldBefore, jumpTook, stillRunning, releasedAfter };
    });

    if (r.missing) { ok(label + ': the pad is there to test', false, 'no __soKeys or no pad'); continue; }
    ok(label + ': holding right registers', r.heldBefore);
    ok(label + ': tapping jump registers', r.jumpTook);
    ok(label + ': SHE KEEPS RUNNING while she jumps', r.stillRunning,
       r.stillRunning ? '' : 'jump cancelled the direction — the bug is back');
    ok(label + ': and stops when that thumb lifts', r.releasedAfter);
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
