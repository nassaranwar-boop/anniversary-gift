/* Dragging the scrubber must scrub, not turn the page. The book turns on a
   horizontal drag anywhere over it, so this is the collision that matters.
   Also checks the transport is reachable and legible at phone size. */
const { chromium } = require('playwright-core'); const fs=require('fs');
let pass=0, fail=0;
const ok=(n,c,d)=>{ (c?pass++:fail++); console.log((c?'PASS  ':'FAIL  ')+n+(d?'   '+d:'')); };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const dev of [
      {n:'desktop', vp:{width:1100,height:820}, dsf:2, mobile:false},
      {n:'iphone',  vp:{width:430,height:932},  dsf:3, mobile:true}]) {
    const p = await b.newPage({ viewport:dev.vp, deviceScaleFactor:dev.dsf,
      isMobile:dev.mobile, hasTouch:dev.mobile });
    p.on('pageerror',e=>ok(dev.n+': no page error',false,e.message));
    await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(1500);
    await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
      await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
      await new Promise(r=>setTimeout(r,2400)); });
    /* walk until the video card is on screen */
    let found=false;
    for(let k=0;k<12 && !found;k++){
      found = await p.evaluate(()=>{ const n=document.querySelector('.sb-videoslot');
        return !!(n && n.offsetParent !== null && n.getBoundingClientRect().width>0); });
      if(!found){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1300); }
    }
    ok(dev.n+': the video card is reachable', found);
    if(!found){ await p.close(); continue; }

    /* put it into the state a started clip is in, without a decoder */
    await p.evaluate(()=>{ const c=document.querySelector('.sb-videoslot .sb-w-ourvideo');
      c.classList.add('ready','started','showing'); });
    await p.waitForTimeout(200);

    const geo = await p.evaluate(()=>{
      const t=document.querySelector('.sb-videoslot .sb-ov-track').getBoundingClientRect();
      const pp=document.querySelector('.sb-videoslot .sb-ov-pp').getBoundingClientRect();
      const mu=document.querySelector('.sb-videoslot .sb-ov-mute').getBoundingClientRect();
      const tm=document.querySelector('.sb-videoslot .sb-ov-time').getBoundingClientRect();
      const bar=document.querySelector('.sb-videoslot .sb-ov-bar').getBoundingClientRect();
      return {track:[t.x,t.y,t.width,t.height], pp:[pp.width,pp.height], mute:[mu.width,mu.height],
              time:[tm.width,tm.height], bar:[bar.width,bar.height],
              view:(document.querySelector('.sb-page.on')||{}).dataset };
    });
    ok(dev.n+': the play stud is big enough to hit', Math.min(...geo.pp) >= 22,
       geo.pp.map(v=>v.toFixed(0)).join('x')+' px');
    ok(dev.n+': the mute control is big enough to hit', Math.min(...geo.mute) >= 18,
       geo.mute.map(v=>v.toFixed(0)).join('x')+' px');
    ok(dev.n+': the scrubber has room to drag', geo.track[2] >= 60,
       geo.track[2].toFixed(0)+' px wide');
    ok(dev.n+': the controls fit the frame on one line',
       geo.pp[0]+geo.track[2]+geo.time[0]+geo.mute[0] <= geo.bar[0]+1,
       'controls '+(geo.pp[0]+geo.track[2]+geo.time[0]+geo.mute[0]).toFixed(0)+
       ' of '+geo.bar[0].toFixed(0)+' px');

    /* now drag across the scrubber and see whether the book turned */
    const before = await p.evaluate(()=>[...document.querySelectorAll('.sb-page.on')].map(n=>n.dataset.index||n.className.slice(0,18)).join(','));
    const [tx,ty,tw,th] = geo.track;
    await p.mouse.move(tx+tw*0.2, ty+th/2);
    await p.mouse.down();
    for (let i=1;i<=8;i++) await p.mouse.move(tx+tw*(0.2+0.075*i), ty+th/2);
    await p.mouse.up();
    await p.waitForTimeout(900);
    const after = await p.evaluate(()=>[...document.querySelectorAll('.sb-page.on')].map(n=>n.dataset.index||n.className.slice(0,18)).join(','));
    ok(dev.n+': dragging the scrubber does not turn the page', before === after,
       'page '+before+' before, '+after+' after');

    /* and a drag on the picture above the bar still turns it */
    const fr = await p.evaluate(()=>{ const f=document.querySelector('.sb-videoslot .sb-vid-frame').getBoundingClientRect();
      return [f.x,f.y,f.width,f.height]; });
    const b2 = await p.evaluate(()=>[...document.querySelectorAll('.sb-page.on')].map(n=>n.dataset.index||n.className.slice(0,18)).join(','));
    await p.mouse.move(fr[0]+fr[2]*0.7, fr[1]+fr[3]*0.3);
    await p.mouse.down();
    for (let i=1;i<=10;i++) await p.mouse.move(fr[0]+fr[2]*0.7-i*22, fr[1]+fr[3]*0.3);
    await p.mouse.up();
    await p.waitForTimeout(1400);
    const a2 = await p.evaluate(()=>[...document.querySelectorAll('.sb-page.on')].map(n=>n.dataset.index||n.className.slice(0,18)).join(','));
    ok(dev.n+': dragging across the picture still turns the page', b2 !== a2,
       'page '+b2+' before, '+a2+' after');
    await p.close();
  }
  console.log('\n'+pass+' pass, '+fail+' fail');
  await b.close();
  process.exit(fail?1:0);
})();
