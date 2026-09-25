const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);
  console.log(JSON.stringify(await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    const s = H.scout(), st = H.state();
    const teams = H.teams();
    return {
      ids: st.ids || null,
      mine: teams.find(t => t.home) && teams.find(t => t.home).id,
      derbyHers: (teams.find(t => t.derby === 'hers') || {}).id,
      team0: s.players.filter(q => q.t === 0).map(q => q.name),
      team1: s.players.filter(q => q.t === 1).map(q => q.name),
      controlled: st.controlled,
    };
  }), null, 1));
  await b.close();
})();
