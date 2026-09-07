/* Is a page's paper opaque? A turning leaf has nothing behind it, so a
   texture with any transparency in it makes the sheet see-through the
   moment it lifts. Reads the alpha out of each page's own texture. */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1100,height:820} });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{ window.skipBookIntro&&window.skipBookIntro(); showScreen('scrapbook'); Scrapbook.start();
    await new Promise(r=>setTimeout(r,1200)); const i=document.querySelector('.sb-intro'); if(i) i.click();
    await new Promise(r=>setTimeout(r,2400)); });
  await p.evaluate(()=>Scrapbook.next()); await p.waitForTimeout(1500);
  const out = await p.evaluate(async () => {
    const rows=[];
    const pages=[...document.querySelectorAll('.sb-spread .sb-page.on')];
    for (const pg of pages) {
      const url=getComputedStyle(pg).backgroundImage.replace(/^url\("|"\)$/g,'');
      if(!url.startsWith('data:')) { rows.push({cls:pg.className.slice(0,30), url:url.slice(0,40)}); continue; }
      const img=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=url;});
      const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
      const g=cv.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
      const d=g.getImageData(0,0,cv.width,cv.height).data;
      let min=255,sum=0,n=0;
      for(let i=3;i<d.length;i+=4){ if(d[i]<min)min=d[i]; sum+=d[i]; n++; }
      rows.push({cls:pg.className.slice(0,30), w:img.width, h:img.height, minAlpha:min, avgAlpha:+(sum/n).toFixed(1)});
    }
    /* and the page's own children: the collage sits on layers too */
    const pg = pages[pages.length-1];
    const kids=[...pg.children].slice(0,6).map(k=>({c:k.className.toString().slice(0,34),
      bg:getComputedStyle(k).backgroundColor, op:getComputedStyle(k).opacity}));
    return {rows, kids, endpaper:(()=>{const e=document.getElementById('sb-endpaper');
      return e? {bg:getComputedStyle(e).backgroundColor, bgi:getComputedStyle(e).backgroundImage.slice(0,30), op:getComputedStyle(e).opacity}:null;})()};
  });
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
