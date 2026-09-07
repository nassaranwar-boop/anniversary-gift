/* The video card on its page: at rest, and with the clip running.
     node tools/playershot.js */
const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader',
          '--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const M = process.argv[2] === 'phone';
  const p = await b.newPage(M
    ? { viewport:{width:430,height:932}, deviceScaleFactor:3, isMobile:true, hasTouch:true }
    : { viewport:{width:1100,height:820}, deviceScaleFactor:2 });
  p.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  for(let i=0;i<14;i++){
    const on = await p.evaluate(()=>{ const n=document.querySelector('.sb-videoslot');
      return !!(n && n.getBoundingClientRect().width>0); });
    if(on) break;
    await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1300);
  }
  const out='/tmp/player'+(M?'-phone':''); fs.mkdirSync(out,{recursive:true});
  const box = await p.evaluate(()=>{ const n=document.querySelector('.sb-videoslot');
    if(!n) return null; const r=n.getBoundingClientRect();
    return {x:Math.round(r.x-14),y:Math.round(r.y-14),width:Math.round(r.width+28),height:Math.round(r.height+28)}; });
  if(!box){ console.log('no video card on this spread'); await b.close(); return; }
  await p.waitForTimeout(600);
  await p.screenshot({path:out+'/rest.png', clip:box});
  const state = await p.evaluate(async()=>{
    const c=document.querySelector('.sb-videoslot .sb-w-ourvideo');
    const v=c.querySelector('video');
    v.muted=true;
    let note='';
    try { await v.play(); await new Promise(r=>setTimeout(r,1200)); }
    catch(e){
      /* This build of Chromium has no H.264 decoder, so the clip cannot
         actually run here. The transport is still worth looking at, so it
         is put into the state it would be in. */
      note=' (no decoder here; state set by hand)';
      c.classList.add('ready','playing','started');
      c.querySelector('.sb-ov-fill').style.width='38%';
      c.querySelector('.sb-ov-buf').style.width='64%';
      c.querySelector('.sb-ov-knob').style.left='38%';
      c.querySelector('.sb-ov-time b').textContent='0:21';
      c.querySelector('.sb-ov-time s').textContent='0:55';
    }
    c.classList.add('showing','started');
    return 'cls='+c.className+note;
  });
  console.log(state);
  await p.waitForTimeout(400);
  await p.screenshot({path:out+'/playing.png', clip:box});
  await p.evaluate(()=>{ const c=document.querySelector('.sb-videoslot .sb-w-ourvideo');
    const v=c.querySelector('video'); v.pause();
    c.classList.remove('playing'); c.classList.add('showing','started','muted'); });
  await p.waitForTimeout(400);
  await p.screenshot({path:out+'/paused.png', clip:box});
  console.log('wrote', out);
  await b.close();
})();
