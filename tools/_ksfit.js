// The keepsake on a phone held sideways: does the last control fit?
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  for (const [name,w,h] of [['iphone-landscape',844,390],['iphone-max-landscape',932,430],['iphone-portrait',390,844],['desktop',1400,900]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, isMobile:h<500||w<500, hasTouch:true});
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(2000);
    await p.evaluate(()=>{ showScreen('keepsake'); if (window.startKeepsake) startKeepsake(); });
    await p.waitForTimeout(3500);
    const r = await p.evaluate(()=>{
      const wrap=document.querySelector('.ks-wrap');
      const acts=document.querySelector('.ks-actions');
      const board=document.querySelector('.ks-board');
      const bb=acts.getBoundingClientRect();
      return {
        wrapH: Math.round(wrap.getBoundingClientRect().height),
        wrapScroll: wrap.scrollHeight, wrapClient: wrap.clientHeight,
        boardH: Math.round(board.getBoundingClientRect().height),
        cards: board.children.length,
        actionsBottom: Math.round(bb.bottom), actionsTop: Math.round(bb.top),
        vh: innerHeight,
        offscreen: bb.bottom > innerHeight + 1 || bb.top < -1,
      };
    });
    const ok = !r.offscreen;
    console.log(`${name.padEnd(21)} ${w}x${h}  board ${String(r.boardH).padStart(3)}px/${r.cards} cards  wrap ${r.wrapScroll}/${r.wrapClient}  actions y${r.actionsTop}..${r.actionsBottom} of ${r.vh}  ${ok?'PASS':'FAIL  off the bottom'}`);
    if (name==='iphone-landscape') {
      const cdp = await ctx.newCDPSession(p);
      const s = await cdp.send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync('/tmp/shots/ks-land.png', Buffer.from(s.data,'base64'));
    }
    await ctx.close();
  }
  await b.close();
})();
