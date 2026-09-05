// What is still running when nothing should be? Timers and forced layouts
// on a screen that is not asking for them are the cost you cannot see.
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  page.on('pageerror', e=>console.log('PAGEERROR', e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.addInitScript(() => {
    window.__fires = 0; window.__layouts = 0;
    const si = window.setInterval;
    window.setInterval = function (fn, ms, ...a) {
      return si(function () { window.__fires++; return fn.apply(this, arguments); }, ms, ...a);
    };
    // count forced layout reads
    ['offsetParent','offsetWidth','offsetHeight','clientWidth','clientHeight'].forEach(prop => {
      const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop) ||
                Object.getOwnPropertyDescriptor(Element.prototype, prop);
      if (!d || !d.get) return;
      const target = HTMLElement.prototype.hasOwnProperty(prop) ? HTMLElement.prototype : Element.prototype;
      Object.defineProperty(target, prop, { ...d, get() { window.__layouts++; return d.get.call(this); } });
    });
    window.__reset = () => { window.__fires = 0; window.__layouts = 0; };
  });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(2500);
  const sample = async (label) => {
    await page.evaluate(() => window.__reset());
    await page.waitForTimeout(5000);
    const r = await page.evaluate(() => ({ fires: window.__fires, layouts: window.__layouts }));
    console.log(label.padEnd(46) + 'interval fires: ' + String(r.fires).padStart(4) +
                '   forced layout reads: ' + String(r.layouts).padStart(5) + '   (over 5s)');
  };
  await sample('sitting on the 3D intro');
  await page.evaluate(() => { window.skipBookIntro && window.skipBookIntro();
    showScreen('gate'); });
  await sample('sitting on the passcode gate');
  await page.evaluate(() => { showScreen('hub'); startHub(); });
  await sample('sitting on the hub');
  await browser.close();
})();
