const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true });
  await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto(`http://127.0.0.1:${process.argv[2] || 8902}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { showScreen('hub'); if (window.startHub) startHub(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('hub-card-race').click());
  await p.waitForSelector('#screen-race.active #race-canvas', { timeout: 40000 });
  await p.waitForTimeout(3000);
  const click = async (s) => { await p.evaluate((q) => { const e = document.querySelector('#screen-race ' + q); if (e) e.click(); }, s); await p.waitForTimeout(800); };
  await click('[data-go="single"]'); await click('[data-char="0"]'); await click('[data-next="chars"]');
  await p.waitForTimeout(1200);
  console.log(await p.evaluate(() => {
    const panel = document.querySelector('#rc-overlay .rc-panel');
    if (!panel) return 'no panel';
    const out = ['panel ' + Math.round(panel.getBoundingClientRect().height) + ' tall, scrollHeight ' + panel.scrollHeight
                 + ', stage ' + Math.round(document.querySelector('.rc-stage').getBoundingClientRect().height)];
    [].forEach.call(panel.children, (e) => { const r = e.getBoundingClientRect();
      out.push('  ' + (e.className || e.tagName).slice(0, 28).padEnd(30) + Math.round(r.height) + 'px'); });
    const card = panel.querySelector('.rc-card');
    if (card) { out.push('  one course card: ' + Math.round(card.getBoundingClientRect().height) + 'px');
      [].forEach.call(card.children, (e) => out.push('     ' + (e.className||e.tagName).slice(0,24).padEnd(26) + Math.round(e.getBoundingClientRect().height) + 'px')); }
    return out.join('\n');
  }));
  await b.close();
})();
