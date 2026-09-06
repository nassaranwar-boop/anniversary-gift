/* EVERY BEAT THE STORY PROMISES, CHECKED ONE NIGHT AT A TIME.

   Not "does the code run" — does each thing the six nights are made of
   actually reach her. Plays each night as an attentive guard, five
   times over, and reports the beats that fired. Anything less than
   every-time is a story step she can miss. */
const { chromium } = require('playwright-core');
const RUNS = 5;
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1000,height:700} });
  p.on('pageerror', e=>console.log('PAGEERROR', e.message));
  await p.route('**/*', r=>{const u=r.request().url();
    if (u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1')?r.continue():r.abort();});
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(600);
  await p.evaluate(()=>{try{localStorage.clear();}catch(e){} showScreen('nightshift'); OuissysNightShift.start();});
  await p.waitForFunction(()=>Object.keys(OuissysNightShift.__night.cast()).length>=4,{timeout:20000,polling:200});
  await p.evaluate(()=>OuissysNightShift.__night.silence(true));
  let bad = 0;
  for (let night=1; night<=6; night++) {
    const r = await p.evaluate(({night,RUNS})=>{
      const w = OuissysNightShift.__night;
      const hit = {}, bump = (k)=>{ hit[k]=(hit[k]||0)+1; };
      let active = [], expectHidden = null, rule = null;
      for (let run=0; run<RUNS; run++) {
        /* A find she has already collected is deliberately never placed
           again — it is hers now. So each run starts from a shop she has
           not been round yet, or runs two to five of every night would
           report a missing object that the game is right to withhold. */
        try { localStorage.removeItem('ns_found'); } catch (e) {}
        /* the card she arrives on */
        w.route('night:'+night);
        const brief = document.querySelector('.ns-brief, #ns-overlay .ns-card');
        const briefTxt = brief ? brief.textContent : '';
        if (night === 1 || /\S/.test(briefTxt)) bump('arrival card');
        w.route('go');
        const s = w.state();
        active = Object.keys(s.cfg.active);
        rule = (s.cfg.hazards||[]).join(', ') || '(none)';
        expectHidden = null;
        let t=0, told=false, deskOn=false, blind=false, seenRule=false;
        const said = {};
        while (s.phase!=='play' ? false : t<470) {
          const cs = w.cast();
          ['left','right','hatch'].forEach(d=>{
            let want=false; for(const k in cs) if(cs[k].awake&&cs[k].atDoor&&cs[k].def.door===d) want=true;
            if (want!==s.doors[d]) w.press(d);
          });
          s.monitor = (t%20)<6;
          if (t%40===0) ['cogsworth','chime','marabelle','jax'].forEach(k=>{
            if (cs[k]&&(cs[k].wound||0)<2.5){cs[k].wound=9;s.power-=1.0;}});
          w.pump(0.5,0.25); t+=0.5;
          const txt = w.sayText()||'';
          if (/CAMERA ZERO/.test(txt)) told = true;
          if (w.desk().on || w.desk().seen) deskOn = true;
          if (!s.monitor && s.hour>=5 && night===6) blind = true;
          /* stepReveal is deliberately not in pump — a headless clock
             must not answer a keep-or-burn that writes saved state — so
             the beat is driven here, the way the frame loop drives it */
          w.revealStep(0.25);
          if (s.phase==='reveal') { bump('the three o\'clock revelation'); w.route('keep'); }
          if (s.phase!=='play') break;
        }
        const tp = w.tape();
        if ((tp.said || 0) >= 6) bump('his voice through the night');
        const fs = w.finds();
        if (fs.armed) bump('a hidden thing is placed');
        if (active.every(k=>((w.cast()[k]||{}).arrivals||0)>0)) bump('all four turn up');
        if (night>=3 && (told || deskOn)) bump('camera zero offered');
        if (night<3) bump('camera zero offered');
        if (night!==6 || blind) bump('the blind last hour');
        if (s.hour>=6) bump('she reaches six');
        w.route('title');
      }
      return { hit, active, rule, RUNS };
    }, {night,RUNS});
    /* Story beats only. Reaching six is not one — it is earned, and a
       night six she cannot lose would not be a night six. It is reported
       below as information, not as a failure. */
    const beats = ['arrival card','his voice through the night','all four turn up',
                   'the three o\'clock revelation','camera zero offered','a hidden thing is placed',
                   'the blind last hour'];
    const miss = beats.filter(k=>(r.hit[k]||0) < RUNS);
    console.log(`\nNIGHT ${night}   rule: ${r.rule}`);
    beats.forEach(k=>{
      const n = r.hit[k]||0;
      console.log(`   ${n===RUNS?'ok  ':'MISS'} ${k.padEnd(30)} ${n}/${RUNS}`);
    });
    console.log(`   ---- she got to six in ${r.hit['she reaches six']||0}/${RUNS} (earned, not promised)`);
    if (miss.length) bad += miss.length;
  }
  console.log(bad? `\n${bad} beat(s) can be missed` : '\nevery beat the story promises reaches her, every time');
  await b.close(); process.exit(bad?1:0);
})();
