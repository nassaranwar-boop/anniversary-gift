const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);
  console.log(await p.evaluate(() => {
    const H = OuissyCup.__cup;
    const g = H.geometry().pitch;
    const jobs = {}, roleX = {}, roleN = {}, wid = [];
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
    for (let t = 0; t < 3000; t++) {
      H.step(1, 0, 0, false);
      if (t % 10) continue;
      const st = H.state();
      if (st.state !== 'play') continue;
      jobs.n = (jobs.n || 0) + 1;
      if (st.owner) jobs.held = (jobs.held || 0) + 1;
      const ps = H.players().filter(q => !q.gk);
      ps.forEach(q => {
        roleX[q.role] = (roleX[q.role] || 0) + (q.x - g.cx);
        roleN[q.role] = (roleN[q.role] || 0) + 1;
      });
      for (let team = 0; team < 2; team++) {
        const o = ps.filter(q => q.team === team);
        if (o.length < 3) continue;
        const xs = o.map(q => q.x);
        wid.push((Math.max.apply(null, xs) - Math.min.apply(null, xs)) / g.w);
      }
    }
    wid.sort((a, c) => a - c);
    const q = (f) => (100 * wid[Math.floor(wid.length * f)]).toFixed(0) + '%';
    const out = ['ball held ' + (100 * (jobs.held || 0) / jobs.n).toFixed(0) + '% of play samples',
      'width  p10 ' + q(0.1) + '  median ' + q(0.5) + '  p90 ' + q(0.9)];
    Object.keys(roleX).forEach(k => out.push('  ' + k.padEnd(4)
      + ' mean x offset from centre: ' + (roleX[k] / roleN[k]).toFixed(0)
      + '  (slot wants ' + Math.round(((H.slots ? 0 : 0)) ) + ')'));
    return out.join('\n');
  }));
  await b.close(); process.exit(0);
})();
