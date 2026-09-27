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

  /* A LINE IS NOT A BLOCK, AND ONLY ONE OF THEM IS THE FAULT.

     This counted every pixel that changed, and then allowed 1.2% of the
     spread as slack for the ones that were never the point. Mapped, the
     changes are the outline of every photograph, every letter of MEMORIES
     and every line of the note -- one or two pixels wide, all of them
     along an edge that already existed. That is the page resampling as it
     shifts by a fraction of a pixel, which is what the slack was for, and
     on a dense spread it comes to 2.34% all on its own. Four spreads
     failed for being busy.

     What the file is actually looking for is a sticker that pops back to
     its full size the moment the page lifts, and that is a BLOCK: a solid
     region several pixels across. So the mask is eroded before it is
     counted -- a pixel survives only if all four of its neighbours
     changed too. A one-pixel edge has unchanged neighbours across its
     width and disappears; a popped sticker is thick in both directions
     and survives whole. The measurement now matches the thing it is
     named after, and the slack can come down to a tenth of what it was. */
  const diff = (a, c, thr, erode) => p.evaluate(async ([a,c,thr,erode]) => {
    const load = s => new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src='data:image/png;base64,'+s; });
    const [ia,ic] = await Promise.all([load(a),load(c)]);
    const cv=document.createElement('canvas'); cv.width=ia.width; cv.height=ia.height;
    const g=cv.getContext('2d',{willReadFrequently:true});
    g.drawImage(ia,0,0); const A=g.getImageData(0,0,cv.width,cv.height).data;
    g.clearRect(0,0,cv.width,cv.height); g.drawImage(ic,0,0);
    const C=g.getImageData(0,0,cv.width,cv.height).data;
    const W=cv.width, H=cv.height;
    const hit=new Uint8Array(W*H);
    let n=0;
    for (let i=0;i<A.length;i+=4)
      if (Math.abs(A[i]-C[i])+Math.abs(A[i+1]-C[i+1])+Math.abs(A[i+2]-C[i+2]) > thr) { hit[i/4]=1; n++; }
    if (!erode) return n;
    /* AND THE CORNER THE BOOK ITSELF TURNS UP. Starting a turn raises a
       curl at the outer bottom corner of the lifting sheet -- about 45
       points square, the same on every spread and the same at any
       progress, because it is the affordance that says a turn has begun
       rather than anything to do with the page's contents. It is the one
       thing here that is a block AND is supposed to change, so it is cut
       out rather than paid for with slack; everywhere else the bar can
       then be as tight as it ought to be. */
    const cx0=Math.floor(W*0.90), cy0=Math.floor(H*0.86);
    let m=0;
    for (let y=1;y<H-1;y++)
      for (let x=1;x<W-1;x++){
        if (x>=cx0 && y>=cy0) continue;
        const i=y*W+x;
        if (hit[i] && hit[i-1] && hit[i+1] && hit[i-W] && hit[i+W]) m++;
      }
    return m;
  }, [a,c,thr,!!erode]);

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

    /* THE VERY FIRST INSTANT MEANS THE VERY FIRST INSTANT. At 0.0015 the
       outer edge of the sheet has already begun to lift, so the rightmost
       inch of the page legitimately differs from rest and the file was
       reading the turn it asked for as a fault. Held at a hundredth of
       that, the sheet is still flat and the only thing that changes is
       the corner curl the book raises to say a turn has started. */
    await p.evaluate(()=>Scrapbook.__holdTurn(1, 0.00002));
    await p.waitForTimeout(180);
    const flat  = (await p.screenshot({clip})).toString('base64');
    const shapeAfter = await shape();
    const moved = await diff(rest, flat, 24);
    const bands = [];
    for (const t of [24,60,120,200]) bands.push(t+':'+(await diff(rest, flat, t)));
    const strong = await diff(rest, flat, 200, true);
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
         strong <= Math.max(floor, area*0.0004),
         'strong '+strong+' px of '+area+' ('+(strong/area*100).toFixed(2)+'%)  [all thresholds '+bands.join(' ')+']');
    }
    await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1400);
  }
  console.log('\n'+pass+' pass, '+fail+' fail');
  await b.close();
  process.exit(fail?1:0);
})();
