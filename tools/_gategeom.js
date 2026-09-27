/* the gate's geometry at every shape that matters, as numbers, so a
   stylesheet cleanup can be proved to change nothing */
const { chromium } = require('playwright-core');
const SIZES = [[1280,800],[1024,768],[932,430],[844,390],[740,360],[667,375],[390,844],[820,1180]];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const out = [];
  for (const [w,h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: h < 500 || w < 500, hasTouch: h < 500 || w < 500 });
    await p.route('**/*', (r) => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(700);
    await p.evaluate(() => showScreen('gate'));
    /* WAIT FOR THE ENTRANCE TO ACTUALLY BE OVER.

       The card arrives by gateCardIn: .95s from scale(.97) rotate(-.5deg)
       after a .1s delay. In a browser that paints 60 frames a second
       that is finished before anyone could measure it; in here, at four
       frames a second, it was still on its FIRST keyframe two and a
       half seconds in -- which is how the same window reported 349x610
       on one run and 343x595 on the next with an identical stylesheet
       and an identical layout box (off=349x610 both times).

       Waiting on getAnimations().finished does not work: half the
       site's animations are infinite (the blink, the shooting star) and
       a promise for the end of one of those never settles. So this
       waits for the two transforms to come to rest. */
    await p.waitForFunction(() => {
      const id = (t) => !t || t === 'none' || /matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)/.test(t);
      const c = document.getElementById('gate-card');
      const s2 = document.getElementById('screen-gate');
      return c && id(getComputedStyle(c).transform) && id(getComputedStyle(s2).transform);
    }, { timeout: 20000, polling: 200 }).catch(() => {});
    await p.waitForTimeout(250);
    out.push(w + 'x' + h + ' ' + await p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return s + ':none';
        const q = e.getBoundingClientRect();
        return s + ':' + Math.round(q.left) + ',' + Math.round(q.top) + ',' + Math.round(q.width) + 'x' + Math.round(q.height); };
      return [ '.gate', '.gate-title img', '#gate-card', '#gate-pad', '[data-gate-key="5"]', '#gate-submit', '.gate-heading' ]
        .map(r).join(' | ');
    }));
    await p.close();
  }
  console.log(out.join('\n'));
  await b.close();
})();
