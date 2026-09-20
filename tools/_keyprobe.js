/* WHY A KEY WOULD NOT TAKE A PRESS.

   sidebyside kept reporting "key 2 would not take a press" on a phone
   landscape, on a different key each run. This asks the page what is
   actually over each key's centre, whether anything is animating it,
   and how long a real press takes. Answer: every key is clean and on
   screen -- the presses that timed out were the 3D book's render loop
   still running behind the gate, in a container that paints about
   four frames a second. Nothing wrong with the gate. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h,tag] of [[844,390,'844x390'],[740,360,'740x360']]) {
    const p = await b.newPage({ viewport:{width:w,height:h}, isMobile:true, hasTouch:true, deviceScaleFactor:1 });
    await p.route('**/*', (r)=> r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
    await p.waitForTimeout(900);
    await p.evaluate(()=>{ const c=document.getElementById('book-canvas')||document.body;
      c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
      c.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})); c.click(); });
    await p.waitForTimeout(1500);
    await p.evaluate(()=>{ if(!document.querySelector('#screen-gate.active') && window.showScreen) showScreen('gate'); });
    await p.waitForTimeout(2500);
    console.log(tag, await p.evaluate(()=>{
      const out=[];
      for (const d of '0123456789'.split('')) {
        const k=document.querySelector('[data-gate-key="'+d+'"]'); if(!k){out.push(d+':none');continue;}
        const r=k.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
        const top=document.elementFromPoint(x,y);
        const covered = !(top===k || k.contains(top));
        const anims=k.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.animationName||'?');
        const onScreen = r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;
        if (covered||anims.length||!onScreen) out.push(d+':'+(covered?('covered-by-'+(top&&top.className||top&&top.tagName)):'')+(anims.length?(' anim:'+anims.join('/')):'')+(onScreen?'':' offscreen'));
      }
      const card=document.getElementById('gate-card');
      const ca=card.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.animationName||'?');
      return (out.length?out.join(' | '):'all keys clean') + ' || card running anims: ' + (ca.join(',')||'none');
    }));
    // now time ten presses
    const t0=Date.now(); let bad='';
    for (const d of ['2','7','0','5']) {
      const s=Date.now();
      try { await p.click('[data-gate-key="'+d+'"]', {timeout:6000}); } catch(e){ bad += ' key'+d+' TIMEOUT'; }
      bad += ' '+d+':'+(Date.now()-s)+'ms';
    }
    console.log('   presses'+bad+'  total '+(Date.now()-t0)+'ms  screen='+await p.evaluate(()=>{const a=document.querySelector('.screen.active');return a&&a.id;}));
    await p.close();
  }
  await b.close();
})();
