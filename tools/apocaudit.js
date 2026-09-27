/* Walk every level with the game's own rules and report anything she could
   not actually get to. Run this after touching any map or dressing any
   room — a single tile of furniture in front of a door makes a level
   unfinishable, and nothing else in the suite has an opinion about it. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  /* THE CHAPTER IS FETCHED ON DEMAND.

     index.html no longer carries apocalypse.js, and the hooks arrive
     later still -- start() builds the scene behind a promise and only
     installs them when it resolves. A suite that calls start() and
     __apEnter in one synchronous block cannot work, which is what every
     file in this folder did, and why the chapter has had nothing
     checking it for a long time. */
  await p.evaluate(() => window.loadChapter && window.loadChapter('apoc'));
  await p.waitForFunction(() => !!window.Apocalypse, null, { timeout: 20000 });
  await p.evaluate(() => { showScreen('apoc'); if (!window.__apEnter) Apocalypse.start(); });
  await p.waitForFunction(() => typeof window.__apEnter === 'function', null, { timeout: 40000 });
  const report = await p.evaluate(() => { showScreen('apoc'); Apocalypse.start(); return window.__apAudit(); });
  let bad = 0, checks = 0;
  for (const r of report) {
    checks += r.checks;
    if (r.problems.length) {
      bad += r.problems.length;
      console.log(`FAIL  ${r.level}   (${r.reachable} tiles reachable)`);
      r.problems.forEach(x => console.log(`        - ${x}`));
    } else {
      console.log(`ok    ${r.level}   ${r.checks} checks, ${r.reachable} tiles reachable`);
    }
  }
  console.log(`\n${checks} checks across ${report.length} maps — ${bad ? bad + ' PROBLEM(S)' : 'no problems'}`);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
