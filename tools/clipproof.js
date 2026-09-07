/* Does a leaf carry the same crop while it turns as it has at rest?

   Held at the very first instant of a turn the sheet is still flat against
   the page, so the strip mosaic that draws it has to reproduce the resting
   spread exactly. A sticker that pops back to its full size the moment the
   page lifts shows up here as a block of changed pixels; a sticker the book
   trims stays trimmed and the two frames match.

   The frames are compared as pixels, and the page is alive around the book
   (grain, petals), so the noise floor is measured first and the turn has to
   stay inside it. */
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

  const diff = (a, c, thr) => p.evaluate(async ([a,c,thr]) => {
    const load = s => new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src='data:image/png;base64,'+s; });
    const [ia,ic] = await Promise.all([load(a),load(c)]);
    const cv=document.createElement('canvas'); cv.width=ia.width; cv.height=ia.height;
    const g=cv.getContext('2d',{willReadFrequently:true});
    g.drawImage(ia,0,0); const A=g.getImageData(0,0,cv.width,cv.height).data;
    g.clearRect(0,0,cv.width,cv.height); g.drawImage(ic,0,0);
    const C=g.getImageData(0,0,cv.width,cv.height).data;
    let n=0;
    for (let i=0;i<A.length;i+=4)
      if (Math.abs(A[i]-C[i])+Math.abs(A[i+1]-C[i+1])+Math.abs(A[i+2]-C[i+2]) > thr) n++;
    return n;
  }, [a,c,thr]);

  /* open the cover: that turn is also the single-page to spread change */
  await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1600);

  const spreads = Number(process.argv[2]||6);
  for (let k=0;k<spreads;k++){
    const clip = await p.evaluate(()=>{ const s=document.querySelector('.sb-spread').getBoundingClientRect();
      return {x:Math.round(s.x),y:Math.round(s.y),width:Math.round(s.width),height:Math.round(s.height)}; });
    const shape = () => p.evaluate(()=>{ const o=document.querySelector('.sb-book-outer');
      return o.className.replace(/\s*(flipping|flip-back)\s*/g,' ').trim() + '|' + o.style.width; });
    const shapeBefore = await shape();
    const rest  = (await p.screenshot({clip})).toString('base64');
    await p.waitForTimeout(450);
    const rest2 = (await p.screenshot({clip})).toString('base64');
    const floor = await diff(rest, rest2, 24);

    await p.evaluate(()=>Scrapbook.__holdTurn(1, 0.0015));
    await p.waitForTimeout(180);
    const flat  = (await p.screenshot({clip})).toString('base64');
    const shapeAfter = await shape();
    const moved = await diff(rest, flat, 24);
    const bands = [];
    for (const t of [24,60,120,200]) bands.push(t+':'+(await diff(rest, flat, t)));
    const strong = await diff(rest, flat, 200);
    await p.evaluate(()=>Scrapbook.__releaseTurn());
    await p.waitForTimeout(900);

    const area = clip.width*clip.height;
    if (shapeBefore !== shapeAfter) {
      /* Opening or closing the covers changes the book from one page wide
         to two. The whole book legitimately moves, so there is nothing to
         compare -- that turn is a layout change, not a crop. */
      console.log('----  spread '+(k+1)+': skipped, the book changes shape on this turn');
    } else {
      /* Photographs resample when a box shifts by a fraction of a pixel,
         and the gutter darkens as the sheet enters it, so the bar is a
         strong, visible difference rather than any difference at all. */
      ok('spread '+(k+1)+': the lifting sheet is cropped exactly as it rests',
         strong <= Math.max(floor, area*0.012),
         'strong '+strong+' px of '+area+' ('+(strong/area*100).toFixed(2)+'%)  [all thresholds '+bands.join(' ')+']');
    }
    await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400);
  }
  console.log('\n'+pass+' pass, '+fail+' fail');
  await b.close();
  process.exit(fail?1:0);
})();
