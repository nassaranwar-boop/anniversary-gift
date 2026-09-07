const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const out=process.argv[2];
  // exactly his frame: 2732x1784 css px at dpr 1 keeps the aspect identical
  const p = await b.newPage({ viewport:{width:1366,height:892}, deviceScaleFactor:2 });
  p.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const cdp = await p.context().newCDPSession(p);
  const shot = async (f) => {
    // page.screenshot() hangs while the canvas loop is painting -- CDP does not
    const { data } = await cdp.send('Page.captureScreenshot', { format:'png' });
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
  };
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(4000);
  await shot(out+'/mine-book.png');
  await p.evaluate(()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('gate'); });
  await p.waitForTimeout(900); await shot(out+'/mine-gate.png');
  await p.evaluate(()=>{ showScreen('scrapbook'); Scrapbook.start(); });
  await p.waitForTimeout(3000); await shot(out+'/mine-candle.png');
  console.log('rendered at', 1366*2, 'x', 892*2, 'aspect', (1366/892).toFixed(4));
  await b.close();
})();
