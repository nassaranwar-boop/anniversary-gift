/* watch the first minute of a night: what the building does, and when */
const { chromium } = require('playwright-core');
const N = Number(process.argv[2] || 2);
const OUT = process.argv[3] || '';
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 520, height: 340 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.indexOf('book-scene.js') >= 0) return r.abort();
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate(() => { localStorage.setItem('ns_seenintro', '1'); localStorage.setItem('ns_notutor', '1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(() => OuissysNightShift.start()); });
  await p.waitForFunction(() => window.OuissysNightShift && OuissysNightShift.__night, { timeout: 20000, polling: 200 });
  await p.evaluate((n) => OuissysNightShift.__night.begin(n), N);
  let last = '';
  for (let k = 0; k < 120; k++) {
    await new Promise((r) => setTimeout(r, 100));
    const st = await p.evaluate(() => {
      const N2 = OuissysNightShift.__night, G = N2.state();
      return { mid: N2.midState ? N2.midState() : null, hour: G.hour, power: +G.power.toFixed(1),
               mon: !!G.monitor, cam: G.cam, cap: G.caption, dark: !!G.hallDark,
               lamp: +(G.lampOut || 0).toFixed(1), monOut: +(G.monOut || 0).toFixed(1) };
    });
    const line = [st.mid && st.mid.t, st.hour, st.power, st.mon ? 'MON:' + st.cam : 'mon down',
                  st.dark ? 'HALLDARK' : '', st.lamp ? 'lamp' + st.lamp : '',
                  st.monOut ? 'monOut' + st.monOut : '', st.cap].join(' | ');
    if (line !== last) { console.log(line); last = line; }
  }
  if (OUT) await p.screenshot({ path: OUT });
  await b.close();
})();
