/* Draw where the picture changes between the resting spread and the first
   instant of a turn, so the cause can be seen instead of guessed at. */
const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1100,height:820}, deviceScaleFactor:1 });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  const skip=Number(process.argv[2]||1);
  for(let i=0;i<skip;i++){ await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1500); }
  const clip = await p.evaluate(()=>{ const s=document.querySelector('.sb-spread').getBoundingClientRect();
    return {x:Math.round(s.x),y:Math.round(s.y),width:Math.round(s.width),height:Math.round(s.height)}; });
  const rest=(await p.screenshot({clip})).toString('base64');
  await p.evaluate(()=>Scrapbook.__holdTurn(1,0.0015)); await p.waitForTimeout(200);
  const flat=(await p.screenshot({clip})).toString('base64');
  const png = await p.evaluate(async([a,c])=>{
    const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s;});
    const [ia,ic]=await Promise.all([load(a),load(c)]);
    const cv=document.createElement('canvas'); cv.width=ia.width; cv.height=ia.height;
    const g=cv.getContext('2d',{willReadFrequently:true});
    g.drawImage(ia,0,0); const A=g.getImageData(0,0,cv.width,cv.height);
    g.clearRect(0,0,cv.width,cv.height); g.drawImage(ic,0,0);
    const C=g.getImageData(0,0,cv.width,cv.height);
    const O=g.createImageData(cv.width,cv.height);
    for(let i=0;i<A.data.length;i+=4){
      const d=Math.abs(A.data[i]-C.data[i])+Math.abs(A.data[i+1]-C.data[i+1])+Math.abs(A.data[i+2]-C.data[i+2]);
      const v=Math.min(255,d*3);
      O.data[i]=v; O.data[i+1]=d>24?0:v; O.data[i+2]=d>24?0:v; O.data[i+3]=255;
    }
    g.putImageData(O,0,0); return cv.toDataURL('image/png').split(',')[1];
  },[rest,flat]);
  fs.mkdirSync('/tmp/spill',{recursive:true});
  fs.writeFileSync('/tmp/spill/rest.png',Buffer.from(rest,'base64'));
  fs.writeFileSync('/tmp/spill/flat.png',Buffer.from(flat,'base64'));
  fs.writeFileSync('/tmp/spill/diff.png',Buffer.from(png,'base64'));
  console.log('wrote /tmp/spill/{rest,flat,diff}.png');
  await b.close();
})();
