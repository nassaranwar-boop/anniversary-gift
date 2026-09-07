/* Does anything on the book blink out at the start of a turn?

   The page a sheet uncovers, and the sheet itself, have to be complete in
   the first frame of the turn -- not a beat later. This holds a turn at the
   very start, photographs the book immediately, waits, photographs it
   again, and fails if the second one has anything in it the first did not. */
const { chromium } = require('playwright-core');
let pass=0, fail=0;
const ok=(n,c,d)=>{ (c?pass++:fail++); console.log((c?'PASS  ':'FAIL  ')+n+(d?'   '+d:'')); };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1100,height:820}, deviceScaleFactor:1 });
  p.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });

  const diff = (a,c,thr) => p.evaluate(async([a,c,thr])=>{
    const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s;});
    const [ia,ic]=await Promise.all([load(a),load(c)]);
    const cv=document.createElement('canvas'); cv.width=ia.width; cv.height=ia.height;
    const g=cv.getContext('2d',{willReadFrequently:true});
    g.drawImage(ia,0,0); const A=g.getImageData(0,0,cv.width,cv.height).data;
    g.clearRect(0,0,cv.width,cv.height); g.drawImage(ic,0,0);
    const C=g.getImageData(0,0,cv.width,cv.height).data;
    let n=0;
    for(let i=0;i<A.length;i+=4)
      if(Math.abs(A[i]-C[i])+Math.abs(A[i+1]-C[i+1])+Math.abs(A[i+2]-C[i+2])>thr) n++;
    return n;
  },[a,c,thr]);

  const spreads = Number(process.argv[2]||6);
  for (let k=0;k<spreads;k++){
    const clip = await p.evaluate(()=>{ const s=document.querySelector('.sb-book-outer').getBoundingClientRect();
      return {x:Math.round(s.x),y:Math.round(s.y),width:Math.round(s.width),height:Math.round(s.height)}; });
    const shape = () => p.evaluate(()=>{ const o=document.querySelector('.sb-book-outer');
      return o.className.replace(/\s*(flipping|flip-back)\s*/g,' ').trim()+'|'+o.style.width; });
    const shapeBefore = await shape();
    await p.evaluate(()=>Scrapbook.__holdTurn(1, 0.30));
    const shapeDuring = await shape();
    const early = (await p.screenshot({clip})).toString('base64');
    await p.waitForTimeout(1200);
    const late  = (await p.screenshot({clip})).toString('base64');
    const late2 = (await p.screenshot({clip})).toString('base64');
    const floor = await diff(late, late2, 24);
    const moved = await diff(early, late, 24);
    await p.evaluate(()=>Scrapbook.__releaseTurn());
    await p.waitForTimeout(900);
    const area = clip.width*clip.height;
    if (shapeBefore !== shapeDuring) {
      /* opening or closing the covers resizes the book itself, so the
         picture is meant to change -- there is nothing to compare */
      console.log('----  spread '+(k+1)+': skipped, the book changes shape on this turn');
      await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400);
      continue;
    }
    ok('spread '+(k+1)+': the turn is complete in its first frame',
       moved <= Math.max(floor*3, area*0.004),
       moved+' px filled in late of '+area+' ('+(moved/area*100).toFixed(2)+'%), settled noise '+floor);
    await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400);
  }
  console.log('\n'+pass+' pass, '+fail+' fail');
  await b.close();
  process.exit(fail?1:0);
})();
