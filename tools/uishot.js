/* The menus, as a player meets them. */
const { chromium } = require('playwright-core');
const OUT = '/tmp/claude-0/-home-user-anniversary-gift/85bd4ff5-90c7-5866-8597-7159ac2fad5f/scratchpad/shots';
/* Google Fonts are blocked in here, so Playwright's screenshot can sit
   waiting on document.fonts forever. Take it, and if it stalls, take it
   again without waiting. */
async function snap(p, path) {
  /* 'disabled' makes Playwright wait for every animation to settle, and
     under software rendering it never does. 'allow' just grabs the frame. */
  try { await p.screenshot({ path, timeout: 12000, animations: 'allow' }); }
  catch (e) { console.log('  (missed ' + path.split('/').pop() + ')'); }
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForSelector('.ap-card-go', { timeout: 40000 });
  await p.waitForTimeout(500);
  await snap(p, OUT + '/UI-intro.png'); console.log('intro');
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(500);
  await snap(p, OUT + '/UI-controls.png'); console.log('controls card');
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(4000);            /* the level builds behind this */
  /* SwiftShader cannot hold a steady frame while the loop is running, and
     a screenshot waits for one; take the loop off its hands first */
  await p.evaluate(() => { try { window.__apLoop(false); } catch (e) {} });
  await p.waitForTimeout(300);
  await snap(p, OUT + '/UI-level.png'); console.log('level card');
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(1500);
  await p.evaluate(() => { try { window.__apLoop(false); } catch (e) {} window.__apQuality(1); window.__apSkipDialogue(); for (let i=0;i<40;i++) window.__apPump(1/60); window.__apPaint(); });
  await snap(p, OUT + '/UI-play.png'); console.log('in play');
  await p.evaluate(() => document.getElementById('ap-pause-btn').click());
  await p.waitForTimeout(400);
  await snap(p, OUT + '/UI-pause.png'); console.log('pause');
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('.ap-card-quit')]
      .find(x => /CONTROLS/.test(x.textContent));
    if (b) b.click();
  });
  await p.waitForTimeout(500);
  await snap(p, OUT + '/UI-settings.png'); console.log('settings');
  await b.close();
})();
