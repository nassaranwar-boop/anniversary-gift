const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const d of [
    { n:'iPhone 15 portrait', w:390, h:844 }, { n:'iPhone 15, URL bar showing', w:390, h:745 },
    { n:'iPhone SE', w:375, h:667 }, { n:'iPhone SE, URL bar showing', w:375, h:600 },
    { n:'iPhone landscape', w:844, h:390 }, { n:'iPad portrait', w:820, h:1180 },
    { n:'desktop', w:1440, h:900 },
  ]) {
    const page = await browser.newPage({ viewport:{width:d.w,height:d.h}, deviceScaleFactor:2, isMobile:d.w<500, hasTouch:d.w<500 });
    await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => {
      window.skipBookIntro && window.skipBookIntro();
      showScreen('hub'); startHub();
      await new Promise(r=>setTimeout(r,600));
      const scr = document.getElementById('screen-hub').getBoundingClientRect();
      // Reachable, not merely visible: scroll to each card the way she would
      // and check it is then fully on screen AND that a tap at its centre
      // actually lands on it.
      const wrapEl = document.querySelector('.hub-wrap');
      const cards = [];
      for (const c of document.querySelectorAll('.hub-card')) {
        c.scrollIntoView({ block:'nearest' });
        await new Promise(r=>setTimeout(r,60));
        const b = c.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width/2, b.top + b.height/2);
        cards.push({ id:c.id.replace('hub-card-',''), top:Math.round(b.top), bottom:Math.round(b.bottom),
                     fully: b.top >= scr.top - 0.5 && b.bottom <= scr.bottom + 0.5,
                     hit: !!(hit && (hit === c || c.contains(hit))) });
      }
      wrapEl.scrollTop = 0;
      const scrolls = wrapEl.scrollHeight > wrapEl.clientHeight + 1;
      const wrap = document.querySelector('.hub-wrap').getBoundingClientRect();
      const keep = document.getElementById('hub-keepsake');
      const kb = keep && keep.getBoundingClientRect();
      return { screen:[Math.round(scr.top),Math.round(scr.bottom)],
               wrap:[Math.round(wrap.top),Math.round(wrap.bottom)],
               scrolls,
        cards: cards.map(c=>c.id+':'+(c.fully?'ok':'CUT '+c.top+'-'+c.bottom)+(c.hit?'':'/UNTAPPABLE')),
               keepsakeVisible: kb ? (kb.top >= scr.top && kb.bottom <= scr.bottom) : 'n/a',
               keepsake: kb ? Math.round(kb.top)+'-'+Math.round(kb.bottom) : 'n/a' };
    });
    console.log(d.n.padEnd(30), 'screen', r.screen.join('..'), ' wrap', r.wrap.join('..'));
    console.log('   ', r.cards.join('  '), r.scrolls ? ' [the list scrolls]' : ' [fits without scrolling]');
    await page.close();
  }
  await browser.close();
})();
