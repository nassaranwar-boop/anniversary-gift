const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(1400);
  for (const node of ['back_bear','there_stones','ways','back_bear_seen','there_fog']) {
    const r = await page.evaluate((n) => {
      showScreen('quest'); startQuest(); hvNode = n; hvRender(false);
      const st = document.querySelector('.hv-stage').getBoundingClientRect();
      const to = (el) => { if(!el) return null; const b = el.getBoundingClientRect();
        return [ Math.round((b.left-st.left)/st.width*320), Math.round((b.top-st.top)/st.height*180),
                 Math.round((b.right-st.left)/st.width*320), Math.round((b.bottom-st.top)/st.height*180) ]; };
      const btns = [...document.querySelectorAll('#hv-left .hv-btn,#hv-centre .hv-btn,#hv-right .hv-btn')].map(to);
      return { note: to(document.querySelector('.hv-note:not(.hidden)')), btns,
               top: to(document.querySelector('.hv-top')) };
    }, node);
    console.log(node.padEnd(16), 'note', JSON.stringify(r.note), 'top', JSON.stringify(r.top));
    r.btns.forEach(b => console.log('   btn', JSON.stringify(b)));
  }
  await browser.close();
})();
