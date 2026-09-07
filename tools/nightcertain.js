/* Does every performer she is told about actually turn up before six?
   Plays each night as an attentive guard — a door shut only while
   something is at it — so the night runs its full six hours and every
   performer has the chance the design says it has. */
const { chromium } = require('playwright-core');
const RUNS = 10;
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1000,height:700} });
  p.on('pageerror', e=>console.log('PAGEERROR',e.message));
  await p.route('**/*', r=>{const u=r.request().url();
    if (u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1')?r.continue():r.abort();});
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(600);
  await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('nightshift'); return loadChapter('nightshift').then(() => OuissysNightShift.start());});
  await p.waitForFunction(()=>Object.keys(OuissysNightShift.__night.cast()).length>=4,{timeout:20000,polling:200});
  await p.evaluate(()=>OuissysNightShift.__night.silence(true));
  let bad = 0;
  for (let night=1; night<=6; night++) {
    const res = await p.evaluate(({night,RUNS}) => {
      const w = OuissysNightShift.__night;
      const tally = {}, out = [];
      let active = [];
      for (let r=0;r<RUNS;r++) {
        w.route('night:'+night); w.route('go');
        const s = w.state();
        active = Object.keys(s.cfg.active);
        let t = 0;
        while (s.phase === 'play' && t < 460) {
          const cs = w.cast();
          ['left','right','hatch'].forEach(d=>{
            let want=false;
            for (const k in cs) if (cs[k].awake && cs[k].atDoor && cs[k].def.door===d) want=true;
            if (want !== s.doors[d]) w.press(d);
          });
          s.monitor = (t % 20) < 4;
          if (t % 40 === 0) ['cogsworth','chime','marabelle','jax'].forEach(k=>{
            if (cs[k] && (cs[k].wound||0) < 2.5) { cs[k].wound = 9; s.power -= 1.0; }
          });
          w.pump(0.5, 0.25); t += 0.5;
        }
        const cs = w.cast();
        active.forEach(k=>{ tally[k]=(tally[k]||0)+(((cs[k]&&cs[k].arrivals)||0)>0?1:0); });
        out.push({hour:s.hour, dead:s.dead||null});
        w.route('title');
      }
      return { tally, active, runs: out };
    }, {night,RUNS});
    const line = res.active.map(k=>`${k} ${res.tally[k]||0}/${RUNS}`).join('  ');
    const miss = res.active.filter(k=>(res.tally[k]||0) < RUNS);
    const died = res.runs.filter(r=>r.dead).length;
    if (miss.length) { bad++; console.log(`  FAIL night ${night}: ${line}  (died in ${died}/${RUNS})   <- ${miss.join(', ')}`); }
    else console.log(`  ok   night ${night}: everyone turned up every time — ${line}  (died in ${died}/${RUNS})`);
  }
  console.log(bad? `\n${bad} night(s) still leave a performer out` : '\nevery performer she is told about turns up on every night, every time');
  await b.close();
  process.exit(bad?1:0);
})();
