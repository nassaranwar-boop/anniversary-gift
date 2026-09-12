// How many times does the book ask for the 8MB clip, and why?
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1400,height:900}});
  let mp4 = 0, bytes = 0;
  ctx.on('request', r => { if (r.url().includes('our-video.mp4')) mp4++; });
  ctx.on('response', async r => { if (r.url().includes('our-video.mp4')) {
    try { bytes += (await r.body()).length; } catch(e){} } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage();
  await p.addInitScript(()=>{
    window.__vidLog = [];
    const proto = HTMLMediaElement.prototype;
    const load = proto.load;
    proto.load = function(){ window.__vidLog.push('load() '+(new Error().stack||'').split('\n').slice(2,5).join(' | ')); return load.apply(this,arguments); };
    const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src')
           || Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype,'src');
    if (d && d.set) Object.defineProperty(HTMLMediaElement.prototype,'src',{
      get:d.get, set:function(v){ window.__vidLog.push('src= '+v+' :: '+(new Error().stack||'').split('\n').slice(2,5).join(' | ')); return d.set.call(this,v); }});
    const setA = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(k,v){
      if (this.tagName==='VIDEO' && (k==='src'||k==='preload'))
        window.__vidLog.push('setAttribute '+k+'='+v+' :: '+(new Error().stack||'').split('\n').slice(2,5).join(' | '));
      return setA.apply(this,arguments); };
  });
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await p.waitForTimeout(1800);
  await p.evaluate(()=>Scrapbook.skipIntro());
  await p.waitForTimeout(6000);
  console.log('after the book is built      : mp4 requests', mp4);
  // Sitting still for as long as ten turns take, to tell a turn-driven
  // refetch apart from one the browser is doing on its own.
  await p.waitForTimeout(22000);
  console.log('after 22s sitting still      : mp4 requests', mp4);
  const idle = mp4;
  for (let i=0;i<10;i++){
    await p.evaluate(()=>Scrapbook.next());
    await p.waitForFunction(()=>!document.getElementById('screen-scrapbook').classList.contains('sb-turning'),
      {timeout:30000, polling:120}).catch(()=>{});
    await p.waitForTimeout(300);
  }
  console.log('after ten page turns         : mp4 requests', mp4, '(+' + (mp4-idle) + ' during the turns)');
  console.log('codec for this build         :', await p.evaluate(()=>document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')||'(none)'));
  console.log('the element error code       :', await p.evaluate(()=>{const v=document.querySelector('#screen-scrapbook video'); return v&&v.error?v.error.code:'none';}));
  const n = await p.evaluate(()=>({
    videos: document.querySelectorAll('#screen-scrapbook video').length,
    withSrc: [...document.querySelectorAll('#screen-scrapbook video')].filter(v=>v.currentSrc||v.src).length,
    inStrips: document.querySelectorAll('#sb-leaf-a video, #sb-leaf-b video').length,
    iframes: document.querySelectorAll('#screen-scrapbook iframe').length,
  }));
  console.log('video elements in the screen :', JSON.stringify(n));
  const log = await p.evaluate(()=>window.__vidLog||[]);
  console.log('media calls seen             :', log.length);
  log.slice(0,8).forEach(l=>console.log('   ', l.replace(/http:\/\/127\.0\.0\.1:8899\//g,'')));
  await b.close();
})();
