/* THE QUEEN'S REVIVE.

   On Hard, dying to the last boss used to send her back to the castle
   gate — the whole level again to reach a fight she was in the middle of.
   Now, with more than two lives, Anwar can stand her back up where she
   fell and the Queen keeps every hit she has taken. It costs two lives
   and she is asked first.

   This checks the rule as stated: offered above two lives, never at two,
   two spent, the fight resumed rather than restarted, and the last life
   still reaching the death scene.

   Usage:  node queenrevive.js
*/
const { chromium } = require('playwright-core');
let pass=0, fail=0;
const ok=(n,c,x)=>{ if(c){pass++;console.log('  PASS  '+n+(x?'   '+x:''));}
                    else {fail++;console.log('  FAIL  '+n+(x?'   '+x:''));} };

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const p=await b.newPage({viewport:{width:1000,height:700}});
  p.on('pageerror',e=>{console.log('  PAGEERROR',e.message);fail++;});
  await p.route('**/*', r=>{const u=r.request().url();
    if(u.indexOf('book-scene.js')>=0) return r.abort();
    return u.startsWith('http://127.0.0.1')?r.continue():r.abort();});
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForTimeout(500);

  await p.evaluate(async ()=>{
    window.__soTestDrive = true;
    try{localStorage.clear(); localStorage.setItem('so_diff','hard'); localStorage.setItem('so_howto','1');}catch(e){}
    showScreen('ouissy');
    await loadChapter('ouissy');
    SuperOuissy.start();
  });
  /* start() opens on the menu, where there is no level and __soInfo has
     nothing to read — go straight to the last world first */
  await p.waitForFunction(()=>!!window.__soGoLevel, null, {timeout:60000});
  /* Hard, properly: G.diff only leaves "medium" through the title screen */
  await p.evaluate(()=>{ window.G_setDiff('hard'); window.__soGoLevel(2); });
  await p.waitForFunction(()=>window.__soInfo && window.__soInfo(), null, {timeout:60000});
  await p.waitForFunction(()=>window.__soInfo().state === 'play', null, {timeout:15000});

  /* stand her in front of the Queen on the last world, awake and angry */
  const toTheQueen = async (lives) => {
    await p.evaluate(()=>{ window.G_setDiff('hard'); window.__soGoLevel(2); });
    /* the world card clears on a real 1.7s timer, and nothing steps until
       it does — pumping through it does nothing at all */
    await p.waitForFunction(()=>window.__soInfo().state === 'play', null, {timeout:15000});
    await p.evaluate((lives)=>{
      window.__soTele(Math.round(window.G_bossTile()) - 3);
      window.G_setLives(lives);
      window.G_setHurtBy('boss');
      for (let i=0;i<120;i++) window.__soPump(1/60);       // let her wake
    }, lives);
  };
  const die = async () => {
    /* not down a pit: Easy catches her there, so the same test would have
       been silently measuring nothing on one of the three difficulties */
    await p.evaluate(()=>{ window.__soKill(); });
    for (let i=0;i<120;i++){
      const s = await p.evaluate(()=>{ window.__soPump(1/60); return window.__soInfo().state; });
      if (s !== 'play') return s;
    }
    return await p.evaluate(()=>window.__soInfo().state);
  };

  console.log('\n— she has three, so she is asked —');
  await toTheQueen(3);
  const bossBefore = await p.evaluate(()=>window.__soInfo().bossHp);
  let st = await die();
  ok('dying to the Queen stops and asks', st === 'revive', 'state ' + st);
  ok('the card is on screen', await p.locator('.so-card-revive').count() === 1);
  ok('and it says what it costs',
     /LIVES/.test(await p.locator('.so-revive-cost').textContent().catch(()=>'')) );
  const shown = await p.evaluate(()=>{
    const b=[...document.querySelectorAll('.so-revive-cost b')].map(e=>e.textContent.trim());
    return b.join('->');
  });
  ok('two lives, counted out for her', shown === '2->1', shown);
  ok('the game is not running behind it',
     await p.evaluate(()=>{ const a=window.__soInfo().timeLeft; window.__soPump(0.5);
                            return Math.abs(window.__soInfo().timeLeft - a) < 1e-6; }));

  console.log('\n— she takes his hand —');
  await p.evaluate(()=>document.getElementById('so-revive-yes').click());
  const afterClick = await p.evaluate(()=>window.__soInfo());
  ok('it spends the second life', afterClick.lives === 1, 'lives ' + afterClick.lives);
  for (let i=0;i<900;i++){
    const s = await p.evaluate(()=>{ window.__soPump(1/60); return window.__soInfo().state; });
    if (s === 'play') break;
  }
  const back = await p.evaluate(()=>window.__soInfo());
  ok('and hands the game back', back.state === 'play', 'state ' + back.state);
  ok('the Queen is exactly as hurt as she was left',
     back.bossHp === bossBefore, back.bossHp + ' vs ' + bossBefore);
  const near = await p.evaluate(()=>{
    const s=window.__soState(); return Math.abs(s.x - Math.round(window.G_bossTile()));
  });
  ok('and she is standing in the fight, not at the gate', near <= 8, near + ' tiles from the Queen');
  ok('she cannot be hit the instant she is stood up',
     await p.evaluate(()=>window.__soPlayer().invuln > 1));

  console.log('\n— she has two, so there is nothing to sell —');
  await toTheQueen(2);
  st = await die();
  ok('two lives is never offered the deal', st !== 'revive', 'state ' + st);
  ok('no card', await p.locator('.so-card-revive').count() === 0);

  console.log('\n— and the last life still reaches the scene —');
  await toTheQueen(1);
  st = await die();
  ok('the last one plays the death scene, not the offer',
     st === 'cutscene', 'state ' + st);

  console.log('\n— she says no —');
  await toTheQueen(3);
  st = await die();
  ok('she is still asked', st === 'revive', 'state ' + st);
  await p.evaluate(()=>document.getElementById('so-revive-no').click());
  const declined = await p.evaluate(()=>window.__soInfo());
  ok('saying no costs only the death itself', declined.lives === 2, 'lives ' + declined.lives);
  for (let i=0;i<900;i++){
    const t = await p.evaluate(()=>{ window.__soPump(1/60); return window.__soInfo().state; });
    if (t === 'play') break;
  }
  const gate = await p.evaluate(()=>{
    const sx = window.__soState().x, bx = Math.round(window.G_bossTile());
    return { away: Math.abs(sx - bx), state: window.__soInfo().state };
  });
  ok('and puts her back at the gate, the old way', gate.away > 10, gate.away + ' tiles from the Queen');

  console.log('\n— she can keep buying it until there is nothing left —');
  await toTheQueen(5);
  st = await die();
  ok('five: asked', st === 'revive', 'state ' + st);
  await p.evaluate(()=>document.getElementById('so-revive-yes').click());
  for (let i=0;i<900;i++){ const t=await p.evaluate(()=>{window.__soPump(1/60);return window.__soInfo().state;}); if(t==='play')break; }
  let now = await p.evaluate(()=>window.__soInfo());
  ok('five becomes three', now.lives === 3, 'lives ' + now.lives);
  st = await die();
  ok('three: asked again', st === 'revive', 'state ' + st);
  await p.evaluate(()=>document.getElementById('so-revive-yes').click());
  for (let i=0;i<900;i++){ const t=await p.evaluate(()=>{window.__soPump(1/60);return window.__soInfo().state;}); if(t==='play')break; }
  now = await p.evaluate(()=>window.__soInfo());
  ok('three becomes one', now.lives === 1, 'lives ' + now.lives);
  st = await die();
  ok('and one is the end of it — the scene, not the offer', st === 'cutscene', 'state ' + st);

  console.log('\n— nothing else changed —');
  /* an ordinary death, away from the Queen, on the same difficulty */
  await p.evaluate(()=>{ window.G_setDiff('hard'); window.__soGoLevel(0); });
  await p.waitForFunction(()=>window.__soInfo().state === 'play', null, {timeout:15000});
  await p.evaluate(()=>window.G_setLives(4));
  st = await die();
  ok('a death with no Queen in it is never offered a revive', st !== 'revive', 'state ' + st);
  ok('and costs the one life it always did',
     (await p.evaluate(()=>window.__soInfo().lives)) === 3);

  console.log('\n— and it is the same rule on every difficulty —');
  for (const [diff, start] of [['easy', 5], ['medium', 3]]) {
    await p.evaluate((d)=>{ window.G_setDiff(d); window.__soGoLevel(2); }, diff);
    await p.waitForFunction(()=>window.__soInfo().state === 'play', null, {timeout:15000});
    await p.evaluate(()=>{ window.__soTele(Math.round(window.G_bossTile()) - 3);
                           for (let i=0;i<120;i++) window.__soPump(1/60); });
    /* the difficulty's own starting lives, untouched */
    const lives0 = await p.evaluate(()=>window.__soInfo().lives);
    ok(diff + ' starts with ' + start, lives0 === start, 'lives ' + lives0);
    st = await die();
    if (start > 2) {
      ok(diff + ': she is asked too', st === 'revive', 'state ' + st);
      await p.evaluate(()=>document.getElementById('so-revive-yes').click());
      for (let i=0;i<900;i++){ const t=await p.evaluate(()=>{window.__soPump(1/60);return window.__soInfo().state;}); if(t==='play')break; }
      const after = await p.evaluate(()=>window.__soInfo());
      ok(diff + ': two lives, same as everywhere else', after.lives === start - 2,
         start + ' -> ' + after.lives);
      const d2 = await p.evaluate(()=>{
        const sx=window.__soState().x, bx=Math.round(window.G_bossTile());
        return Math.abs(sx-bx); });
      ok(diff + ': and back in the fight', d2 <= 8, d2 + ' tiles from the Queen');
    }
  }

  /* two is still two, whatever difficulty it is */
  await p.evaluate(()=>{ window.G_setDiff('medium'); window.__soGoLevel(2); });
  await p.waitForFunction(()=>window.__soInfo().state === 'play', null, {timeout:15000});
  await p.evaluate(()=>{ window.__soTele(Math.round(window.G_bossTile()) - 3);
                         window.G_setLives(2);
                         for (let i=0;i<120;i++) window.__soPump(1/60); });
  st = await die();
  ok('Medium at two lives is not offered it either', st !== 'revive', 'state ' + st);

  await b.close();
  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
