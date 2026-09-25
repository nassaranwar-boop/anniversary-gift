/* EVERY CARD IN THE CHAPTER, PHOTOGRAPHED.

   The night shift talks to the player almost entirely through cards:
   the shift card, the brief, the find, the page she decides about, the
   save, the pause, the morning, the record, the drawer, the mixer, the
   custom night, the terms, the ending. A playthrough reaches some of
   them and, on a good run, never reaches the rest -- being caught, or
   running the meter to nothing, or a save.

   This puts each one up through the chapter's own route() and takes a
   picture, so the whole surface can be looked at rather than argued
   about: what it says, whether it fits, and whether every button on it
   is reachable. It asserts one thing per card -- that it fits inside
   the stage -- and leaves the taste to a person with the pictures. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const DIR = process.env.DIR || '/tmp/claude-0/cards';
const W = Number(process.env.W || 1000), H = Number(process.env.H || 640);
fs.mkdirSync(DIR, { recursive: true });
let pass = 0, fail = 0;
const t = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note !== undefined ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({
    executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{ width:W, height:H } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.route('**/*', r => { const u=r.request().url();
    if (u.indexOf('workers.dev')>=0||u.indexOf('cloudflareinsights')>=0) return r.fulfill({status:200,body:'{}'});
    return u.startsWith('http://127.0.0.1') ? r.continue() : r.abort(); });
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(()=>{ try{localStorage.clear();}catch(e){}
    localStorage.setItem('ns_notutor','1');
    showScreen('nightshift');
    return loadChapter('nightshift').then(()=>OuissysNightShift.start()); });
  await p.waitForFunction(()=>{try{return !!OuissysNightShift.__night.cast().jax;}catch(e){return false;}},
    {timeout:180000,polling:500});
  const cdp = await p.context().newCDPSession(p);
  const T = (ms)=>p.waitForTimeout(ms);

  /* the cards reachable off the title, by their own buttons. CUSTOM
     NIGHT is deliberately not here: it is not on the board until the
     week is done, and the first version of this tool clicked a button
     that was not there, stayed on the title and reported it as the
     custom card -- a pass for a picture of something else. Every card
     below is checked to have actually CHANGED the screen. */
  const cards = [
    ['title',    () => 'title'],
    ['howto',    () => 'howto'],
    ['record',   () => 'badges'],
    ['drawer',   () => 'drawer'],
    ['sound',    () => 'sound'],
  ];

  const shoot = async (name) => {
    await T(900);
    const r = await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(r.data,'base64'));
    const info = await p.evaluate(() => {
      const ov = document.getElementById('ns-overlay');
      const card = ov && ov.querySelector('.ns-card');
      const stage = document.getElementById('ns-stage');
      if (!card || !stage) return null;
      /* THE SCREEN, NOT THE STAGE.
         This measured a card against the 16:9 stage, which was a fair
         proxy while every card lived inside it. Held upright the cards
         are allowed past the top and bottom of the stage now -- there
         is nothing to watch while one is up, and squeezing them into a
         219px band is what made the menu's buttons 23 pixels -- so the
         stage is the wrong ruler. What matters is whether she can see
         it and reach it, which is the window. */
      const c = card.getBoundingClientRect();
      const s = { top: 0, bottom: innerHeight, left: 0, right: innerWidth, height: innerHeight };
      const btns = [].slice.call(ov.querySelectorAll('[data-go]')).map(x=>{
        const q = x.getBoundingClientRect();
        return { label: x.innerText.replace(/\s+/g,' ').trim().slice(0,28),
                 go: x.getAttribute('data-go'),
                 h: Math.round(q.height), w: Math.round(q.width),
                 inside: q.top >= s.top-1 && q.bottom <= s.bottom+1 &&
                         q.left >= s.left-1 && q.right <= s.right+1 };
      });
      return { over: +(c.height - s.height).toFixed(0),
               fits: c.top >= s.top-1 && c.bottom <= s.bottom+1,
               text: (card.innerText||'').replace(/\n{2,}/g,'\n').trim().slice(0,300),
               btns };
    });
    return info;
  };

  for (const [name, cmd] of cards) {
    await p.evaluate((c)=>{ const el=document.querySelector(`[data-go="${c}"]`);
      if (el) el.click(); }, cmd());
    const info = await shoot(name);
    if (!info) { t(`${name}: the card is up`, false, 'no card'); continue; }
    t(`${name}: fits on the screen`, info.fits,
      info.fits ? 'on screen' : `${info.over}px taller than the window`);
    const off = info.btns.filter(x=>!x.inside);
    const small = info.btns.filter(x=>x.h < 30 && x.h > 0);
    t(`${name}: every button is on screen`, off.length===0,
      off.length ? off.map(x=>x.label).join(', ') : `${info.btns.length} buttons`);
    if (small.length) console.log(`      note  ${name}: ${small.length} button(s) under 30px tall: ` +
      small.map(x=>`${x.label} ${x.h}px`).join(', '));
    console.log(`      [${DIR}/${name}.png]`);
    /* back to the title for the next one */
    await p.evaluate(()=>{ const el=document.querySelector('[data-go="title"]'); if (el) el.click(); });
    await T(600);
  }

  /* ---- and the cards a playthrough only reaches by living them ----

     The brief, the page she decides about, the save, being caught, the
     morning and the pause are the chapter talking to her at its loudest
     moments, and a careful player never sees half of them. Each is put
     up through the chapter's own door. */
  const inNight = [
    /* the night card comes up by picking a night off the board, which
       is how she reaches it: the begin hook drops straight into play */
    /* the night card comes up by picking a night off the board. Night
       two is DISABLED for somebody who has not finished night one --
       which is right, and which is why clicking it changed nothing and
       the first run of this reported a card that never came. */
    ['brief',  async () => { await p.evaluate(()=>{ const el=document.querySelector('[data-go="night:1"]');
                              if (el) el.click(); }); }],
    ['pause',  async () => { await p.evaluate(()=>{ const N=OuissysNightShift.__night;
                              N.begin(2); N.pauseNow && N.pauseNow(); }); }],
    ['find',   async () => { await p.evaluate(()=>{ const N=OuissysNightShift.__night;
                              N.begin(1); N.takeFind && N.takeFind(); }); }],
    ['reveal', async () => { await p.evaluate(()=>{ const N=OuissysNightShift.__night;
                              N.begin(1); N.reveal && N.reveal(1); }); }],
    ['held',   async () => { await p.evaluate(()=>{ const N=OuissysNightShift.__night;
                              N.begin(3); N.heldCard && N.heldCard(); }); }],
    ['caught', async () => { await p.evaluate(()=>{ const N=OuissysNightShift.__night;
                              N.begin(2);
                              N.catchNow && N.catchNow('cogsworth'); });
                            /* THE SCARE PLAYS BEFORE THE CARD, and it is
                               not pumpable: pumpFrame only steps the play
                               phase, and a kill leaves the chapter in
                               "over". So this one waits on the page's own
                               clock, like the player does -- and it waits
                               a long time, because the frame loop clamps
                               dt to 0.1s so a backgrounded tab cannot skip
                               a night, and this container paints about one
                               frame a second with a card up. deadT rises
                               at a tenth of real time HERE; on a phone
                               that sustains 10fps the card lands in the
                               1.15 seconds it was written for. */
                            await p.waitForTimeout(20000); }],
  ];
  for (const [name, run] of inNight) {
    let before = await p.evaluate(()=>{ const o=document.getElementById('ns-overlay');
      return o ? (o.innerText||'').slice(0,60) : ''; });
    try { await run(); } catch (e) { t(`${name}: the card comes up`, false, e.message.slice(0,60)); continue; }
    await T(name === 'reveal' ? 8000 : name === 'caught' ? 2500 : 1800);
    const now = await p.evaluate(()=>{ const o=document.getElementById('ns-overlay');
      return o ? (o.innerText||'').slice(0,60) : ''; });
    if (!now || now === before) { t(`${name}: the card comes up`, false, 'nothing changed on screen'); continue; }
    const info = await shoot(name);
    if (!info) { t(`${name}: the card comes up`, false, 'no .ns-card'); continue; }
    t(`${name}: fits on the screen`, info.fits,
      info.fits ? 'on screen' : `${info.over}px taller than the window`);
    const off = info.btns.filter(x=>!x.inside);
    t(`${name}: every button is on screen`, off.length===0,
      off.length ? off.map(x=>x.label).join(', ') : `${info.btns.length} buttons`);
    console.log(`      [${DIR}/${name}.png]  ${info.text.split('\n')[0].slice(0,60)}`);
    await p.evaluate(()=>{ const el=document.querySelector('[data-go="title"]'); if (el) el.click(); });
    await T(600);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
