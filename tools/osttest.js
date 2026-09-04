/* Does the score actually play? A silent bug in a Web Audio graph throws
   nothing and makes no sound, so this counts the nodes it builds. */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); }
                          else { fail++; console.log('  FAIL ' + n + (x ? '  ' + JSON.stringify(x) : '')); } };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
           '--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**', r => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(300);
  /* count every oscillator the page ever starts */
  await p.evaluate(() => {
    window.__osc = 0;
    const S = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function () { window.__osc++; return S.apply(this, arguments); };
  });
  await p.evaluate(() => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-apoc').classList.add('active');
    window.Apocalypse.start();
  });
  await p.waitForFunction(() => !!window.__apEnter, { timeout: 40000 });
  await p.evaluate(() => { window.__apLoop(false); window.__apQuality(2); window.__apAudio && window.__apAudio(); });

  const started = await p.evaluate(() => {
    window.Apocalypse.game && 0;
    window.__apEnter(1);                       /* the streets */
    return true;
  });
  await p.waitForTimeout(2600);
  const n1 = await p.evaluate(() => window.__osc);
  ok('the score builds voices', n1 > 4, { n1 });

  await p.evaluate(() => window.__apEnter(2));  /* the hospital: another piece */
  await p.waitForTimeout(2600);
  const n2 = await p.evaluate(() => window.__osc);
  ok('changing place changes what is playing', n2 > n1, { n1, n2 });

  const named = await p.evaluate(() => window.__apScore && window.__apScore());
  ok('and it knows what it is playing', !!named, { named });

  /* muted really is silent */
  await p.evaluate(() => window.__apMusic(false));
  await p.waitForTimeout(1400);
  const before = await p.evaluate(() => window.__osc);
  await p.waitForTimeout(2200);
  const after = await p.evaluate(() => window.__osc);
  ok('turning the music off stops it building notes', after === before, { before, after });

  await p.evaluate(() => window.__apMusic(true));
  await p.waitForTimeout(2400);
  const back = await p.evaluate(() => window.__osc);
  ok('and turning it back on starts it again', back > after, { after, back });

  /* ---- THE CUE FOLLOWS THE SCENE ----
     The music is chosen every frame from what is happening to her, so
     this drives what is happening to her and reads back what the music
     decided. None of it is about sound: it is about whether the piece
     playing is the piece the moment deserves. */
  const drive = await p.evaluate(async () => {
    window.__apLoop(false);
    window.__apEnter(1);                       /* the streets */
    window.__apSkipDialogue();
    for (let i = 0; i < 30; i++) window.__apPump(1 / 60);
    const calm = window.__apScoreWant();

    /* something sees her */
    window.__apChase(true);
    for (let i = 0; i < 20; i++) window.__apPump(1 / 60);
    const chased = window.__apScoreWant();

    /* it loses her — and the music does not drop the moment it does */
    window.__apChase(false);
    for (let i = 0; i < 40; i++) window.__apPump(1 / 60);   /* two thirds of a second */
    const justAfter = window.__apScoreWant();
    for (let i = 0; i < 420; i++) window.__apPump(1 / 60);  /* seven seconds */
    const settled = window.__apScoreWant();

    /* in a wardrobe with something in the room is its own feeling */
    window.__apLook(true, true);
    for (let i = 0; i < 20; i++) window.__apPump(1 / 60);
    const hiding = window.__apScoreWant();
    window.__apLook(false, false);
    for (let i = 0; i < 420; i++) window.__apPump(1 / 60);

    /* and a scene with a feeling of its own outranks the level */
    window.__apMood('grief', 8);
    for (let i = 0; i < 20; i++) window.__apPump(1 / 60);
    const mood = window.__apScoreWant();
    for (let i = 0; i < 620; i++) window.__apPump(1 / 60);
    const afterMood = window.__apScoreWant();
    return { calm, chased, justAfter, settled, hiding, mood, afterMood };
  });
  ok('a street with nothing on it plays the street', drive.calm === 'dread', drive);
  ok('being seen changes the music', drive.chased === 'hunt', drive);
  ok('and it does not stop the instant they lose her',
     drive.justAfter === 'hunt', drive);
  ok('but it does let go afterwards', drive.settled === 'dread', drive);
  ok('hiding while something looks is its own cue', drive.hiding === 'held', drive);
  ok('a scene with its own feeling gets it', drive.mood === 'grief', drive);
  ok('and gives it back when it is over', drive.afterMood === 'dread', drive);

  /* the change itself: it lands on a bar line and the count carries */
  const joinInfo = await p.evaluate(async () => {
    window.__apEnter(0);
    window.__apSkipDialogue();
    for (let i = 0; i < 30; i++) window.__apPump(1 / 60);
    const a = window.__apScoreBeat();
    window.__apChase(true);
    for (let i = 0; i < 30; i++) window.__apPump(1 / 60);
    await new Promise(r => setTimeout(r, 1600));
    const b = window.__apScoreBeat();
    window.__apChase(false);
    return { a, b };
  });
  ok('the bar count carries across a change rather than restarting',
     joinInfo.b.beat > joinInfo.a.beat, joinInfo);
  ok('and the cue really did change', joinInfo.b.name !== joinInfo.a.name, joinInfo);

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
