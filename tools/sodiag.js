const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport:{width:1180,height:900} });
  page.on('pageerror', e=>console.log('PAGEERROR', e.message));
  await page.addInitScript(() => {
    window.__iv = [];
    const si = window.setInterval;
    window.setInterval = function(fn, ms){ window.__iv.push(ms); return si.apply(this, arguments); };
    window.__osc = 0;
    const patch = (C) => { if (!C) return; const f = C.prototype.createOscillator;
      C.prototype.createOscillator = function(){ window.__osc++; return f.apply(this, arguments); }; };
    patch(window.AudioContext); patch(window.webkitAudioContext);
  });
  await page.route('**/*', r => { const u=r.request().url();
    if (u.startsWith('http://127.0.0.1')||u.includes('fonts.g')) return r.continue(); return r.abort(); });
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('ouissy'); startSuperOuissy(); });
  await page.waitForSelector('.so-diff-card', { timeout:8000 });
  console.log('intervals after menu:', await page.evaluate(()=>window.__iv.slice()));
  await page.click('[data-so-diff="easy"]'); await page.click('#so-play');
  await page.waitForTimeout(500);
  const how = await page.$('#so-how-ok');
  console.log('how-to shown?', !!how);
  if (how) await how.click();
  for (let i=0;i<30;i++){ await page.waitForTimeout(200);
    if (await page.evaluate(()=>window.__soInfo && window.__soInfo().state==='play')) break; }
  console.log('intervals after play:', await page.evaluate(()=>window.__iv.slice()));
  console.log('saved pref:', await page.evaluate(()=>{try{return localStorage.getItem('so_bgm');}catch(e){return 'x';}}));
  const o1 = await page.evaluate(()=>window.__osc);
  await page.waitForTimeout(1500);
  const o2 = await page.evaluate(()=>window.__osc);
  console.log('oscillators over 1.5s idle:', o1, '->', o2);
  console.log('ctx state:', await page.evaluate(()=>window.__soAudio?window.__soAudio.state:'none'));
  // now give it a real gesture, the way a person would
  await page.mouse.click(590, 450);
  await page.waitForTimeout(1200);
  console.log('after a tap, ctx:', await page.evaluate(()=>window.__soAudio?window.__soAudio.state:'none'));
  const o3 = await page.evaluate(()=>window.__osc);
  await page.waitForTimeout(1500);
  const o4 = await page.evaluate(()=>window.__osc);
  console.log('oscillators over 1.5s after the tap:', o3, '->', o4);
  await browser.close();
})();
