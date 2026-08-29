// Measure the layout at real device sizes. No screenshots — element boxes
// only, because page screenshots hang in this container.
const { chromium } = require('playwright-core');
const SIZES = [
  ['iPhone SE portrait', 375, 667],
  ['iPhone 14 portrait', 390, 844],
  ['iPhone 14 landscape', 844, 390],
  ['iPad portrait', 820, 1180],
  ['desktop', 1440, 900],
];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  for (const [name, w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h },
      isMobile: w < 900, hasTouch: w < 900, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(350);
    await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
    await page.waitForTimeout(300);
    const menu = await page.evaluate(() => {
      const r = document.querySelector('.so-diff-row');
      const b = document.getElementById('so-play');
      return { row: r && r.getBoundingClientRect().height,
               playTop: b && Math.round(b.getBoundingClientRect().bottom),
               ovScroll: (()=>{const o=document.getElementById('so-overlay');return o.scrollHeight>o.clientHeight+2;})() };
    });
    await page.click('[data-so-diff="easy"]'); await page.click('#so-play'); await page.waitForTimeout(250);
    const how = await page.$('#so-how-ok'); if (how) await how.click();
    await page.waitForTimeout(2300);
    const box = await page.evaluate(() => {
      const st = document.getElementById('so-stage').getBoundingClientRect();
      const pad = document.getElementById('so-pad');
      const ps = pad ? getComputedStyle(pad).display : 'none';
      const pr = pad && ps !== 'none' ? pad.getBoundingClientRect() : null;
      const jump = document.querySelector('.so-key-jump');
      const jr = jump && ps !== 'none' ? jump.getBoundingClientRect() : null;
      const hud = document.querySelector('.so-hud-item i');
      return {
        stage: [Math.round(st.width), Math.round(st.height), Math.round(st.top), Math.round(st.bottom)],
        padShown: ps !== 'none',
        padBottom: pr ? Math.round(pr.bottom) : null,
        jumpSize: jr ? Math.round(jr.width) : null,
        hudFont: hud ? getComputedStyle(hud).fontSize : null,
        vh: window.innerHeight, vw: window.innerWidth,
        hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    const fits = box.stage[3] <= box.vh + 1 && (!box.padShown || box.padBottom <= box.vh + 1);
    console.log(
      name.padEnd(21), `${w}x${h}`.padEnd(10),
      'stage', String(box.stage[0]+'x'+box.stage[1]).padEnd(10), 'top', String(box.stage[2]).padEnd(5),
      'pad', box.padShown ? 'yes(' + box.jumpSize + 'px)' : 'no ',
      'hud', String(box.hudFont).padEnd(8),
      'hscroll', box.hScroll,
      fits ? 'FITS' : 'OVERFLOW bottom=' + Math.max(box.stage[3], box.padBottom||0) + ' vh=' + box.vh,
      menu.ovScroll ? '| menu scrolls' : '',
      errors.length ? '| ERR ' + errors[0] : '');
    await page.close();
  }
  await browser.close();
})();
