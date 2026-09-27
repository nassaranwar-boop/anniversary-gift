const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (let i = 0; i < 6; i++) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(700);
    await p.evaluate(() => showScreen('gate'));
    await p.waitForTimeout(1600);
    console.log(i, await p.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const c = document.getElementById('gate-card');
      const r = c.getBoundingClientRect();
      const img = document.querySelector('.gate-title img').getBoundingClientRect();
      return 'appH=' + cs.getPropertyValue('--app-h').trim()
        + ' appTop=' + cs.getPropertyValue('--app-top').trim()
        + ' card=' + Math.round(r.width) + 'x' + Math.round(r.height)
        + ' off=' + c.offsetWidth + 'x' + c.offsetHeight
        + ' tr=' + (c.style.transform || '-')
        + ' titleimg=' + Math.round(img.width)
        + ' innerH=' + innerHeight
        + ' | chain: ' + (function () {
            const out = []; let e = c;
            while (e && e !== document.documentElement) {
              const t = getComputedStyle(e).transform;
              if (t && t !== 'none') out.push((e.id || e.className || e.tagName).toString().slice(0, 18) + ' ' + t);
              e = e.parentElement;
            }
            const rt = getComputedStyle(document.documentElement);
            if (rt.transform !== 'none') out.push('html ' + rt.transform);
            if (rt.zoom && rt.zoom !== '1') out.push('html zoom ' + rt.zoom);
            const bz = getComputedStyle(document.body).zoom;
            if (bz && bz !== '1') out.push('body zoom ' + bz);
            out.push('vv=' + (window.visualViewport ? visualViewport.scale + '/' + Math.round(visualViewport.width) : 'none'));
            return out.join(' ; ');
          })();
    }));
    await p.close();
  }
  await b.close();
})();
