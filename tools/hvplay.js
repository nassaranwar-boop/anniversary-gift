/* The three things you can now do in The Long Way Round, played.
 *
 * The graph suites (quest.js, hvaudit.js) walk the story by clicking
 * buttons, so they are blind to every one of these: a mechanic that
 * never completed, or completed into the wrong node, would leave both
 * of them green.
 *
 * Asserts, for each of the stones, the bridge and the orchard:
 *   - the mechanic actually arms when she arrives at the node
 *   - playing it well and playing it badly land in the two different
 *     places the writing already describes
 *   - the node's own buttons are still on the screen the whole time,
 *     because the rule is that none of this can ever be stuck
 * and then that the keyboard can play the whole thing.
 */
const { chromium } = require('playwright-core');
const out = [];
const ok = (n, c, x) => out.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '   ' + x : ''));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('quest'); startQuest(); });
  await page.waitForTimeout(300);

  /* The three mechanics are timed against hvSway, and requestAnimationFrame
     in this container runs at about three frames a second — far too coarse
     to hit a timing window through the real loop. So they are driven on a
     synthetic clock instead: the same hvPlayPress and hvPlayStep the real
     input calls, at times chosen to be steady or not. */
  const drive = (node, script) => page.evaluate(({ node, script }) => {
    hvNode = node; hvHistory = []; hvRender(false);
    const armed = !!hvPlay && hvPlay.kind === (HV[node].play);
    const buttonsAtStart = document.querySelectorAll('#hv-left .hv-btn, #hv-centre .hv-btn, #hv-right .hv-btn').length;

    /* find a time at which the meter is steady (or deliberately is not) */
    const timeFor = (seed, steady) => {
      for (let t = 0; t < 40; t += 0.017) {
        const v = Math.abs(Math.sin(t * 3.1 + seed * 1.7));
        if (steady ? v < 0.30 : v > 0.90) return t;
      }
      return 0;
    };

    let t = 0, guard = 0, st = 0;
    let minButtons = buttonsAtStart;
    /* stop at the end of THIS mechanic: finishing one bridge section
       arms the next one, and a loop that only watches hvPlay walks the
       whole span and then reports the far post for every section */
    const startedAt = hvNode;
    while (hvPlay && hvNode === startedAt && guard++ < 900) {
      const p = hvPlay;
      if (p.kind === 'orchard') {
        /* the bear's own rhythm decides. Carefully: creep only while
           its head is down. Recklessly: never stop walking. */
        st += 0.05;
        hvHold = script.recklessly ? true : hvBearLook(st) < 0.02;
        hvPlayStep(t, st, 0.05);
        t += 0.05;
      } else {
        const seed = p.kind === 'stones' ? p.i + 1 : p.steps;
        t = timeFor(seed, script.well) + guard * 1e-6;
        hvPlayPress(t);
        for (let k = 0; k < 40 && hvPlay && hvPlay.hop < 1; k++) hvPlayStep(t, t, 0.05);
        hvPlayStep(t + 1.2, t + 1.2, 0.05);
      }
      const now = document.querySelectorAll('#hv-left .hv-btn, #hv-centre .hv-btn, #hv-right .hv-btn').length;
      if (hvPlay) minButtons = Math.min(minButtons, now);
    }
    hvHold = false;
    return { armed, landed: hvNode, buttonsAtStart, minButtons };
  }, { node, script });

  /* ---- the seven stones ---- */
  let r = await drive('there_stones', { well: true });
  ok('the stones arm when she gets to the water', r.armed);
  ok('crossing them cleanly gets across dry', r.landed === 'there_dry', r.landed);
  ok('the two buttons are on screen the whole crossing',
     r.buttonsAtStart === 2 && r.minButtons === 2, r.buttonsAtStart + '/' + r.minButtons);

  r = await drive('there_stones', { well: false });
  ok('catching one rocking puts you in the stream', r.landed === 'there_wet', r.landed);

  /* ---- the bridge, all three sections ---- */
  r = await drive('back_bridge1', { well: true });
  ok('the bridge arms on the near post', r.armed);
  ok('the first section hands on to the second', r.landed === 'back_bridge2', r.landed);
  ok('its button is on screen the whole span',
     r.buttonsAtStart === 1 && r.minButtons === 1, r.buttonsAtStart + '/' + r.minButtons);
  r = await drive('back_bridge2', { well: true });
  ok('the middle hands on to the last few planks', r.landed === 'back_bridge3', r.landed);
  r = await drive('back_bridge3', { well: true });
  ok('the far post comes out where the path rejoins', r.landed === 'back_join', r.landed);

  /* ---- the orchard ---- */
  r = await drive('back_bear', { recklessly: false });
  ok('the orchard arms in the row', r.armed);
  ok('creeping while its head is down gets you past', r.landed === 'back_bear_quiet', r.landed);
  ok('all three buttons stay on screen while creeping',
     r.buttonsAtStart === 3 && r.minButtons === 3, r.buttonsAtStart + '/' + r.minButtons);

  r = await drive('back_bear', { recklessly: true });
  ok('walking on while it looks up is the three trees back',
     r.landed === 'back_bear_seen', r.landed);

  const soft = await page.evaluate(() => !!(HV.back_bear_seen && !HV.back_bear_seen.isFail &&
    (HV.back_bear_seen.choices || []).length > 0 && !document.getElementById('hv-fail')));
  ok('and being seen is still not a fail state', soft);

  /* ---- the keyboard ---- */
  const keys = await page.evaluate(async () => {
    hvNode = 'ways'; hvHistory = []; hvRender(false);
    const press = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    press('ArrowRight');
    const focused = document.activeElement && document.activeElement.classList.contains('hv-btn');
    const label = document.activeElement ? document.activeElement.textContent : '';
    document.activeElement.click();
    await new Promise(r => setTimeout(r, 60));
    const moved = hvNode;
    press('Backspace');
    await new Promise(r => setTimeout(r, 60));
    return { focused, label, moved, back: hvNode };
  });
  ok('an arrow key takes a choice', keys.focused, keys.label);
  ok('enter/click on it moves the story on', keys.moved !== 'ways', keys.moved);
  ok('backspace is the back chip', keys.back === 'ways', keys.back);

  /* ---- what it remembers ---- */
  const kept = await page.evaluate(() => {
    hvFound = {}; hvRoutes = {}; hvEndings = {};
    hvNode = 'back_ridge'; hvRender(false);
    hvFound.ribbon = true; hvSaveProgress();
    const raw = localStorage.getItem('hv_walk');
    hvFound = {}; hvRoutes = {}; hvEndings = {};
    hvLoadProgress();
    return { raw: !!raw, ribbon: !!hvFound.ribbon, route: !!hvRoutes['back-blue'] };
  });
  ok('what she found survives a reload', kept.raw && kept.ribbon);
  ok('and so does which way she went', kept.route);

  /* ---- the score, in the live game rather than offline ---- */
  const music = await page.evaluate(async () => {
    hvSetSound(true);
    hvNode = 'back_ridge'; hvHistory = []; hvRender(false);
    await new Promise(r => setTimeout(r, 400));
    const onRidge = window.OST.debug();
    hvNode = 'back_home'; hvRender(false);
    await new Promise(r => setTimeout(r, 400));
    const moved = window.OST.debug();
    hvSetSound(false);
    await new Promise(r => setTimeout(r, 200));
    const off = window.OST.debug();
    return { onRidge, moved, off };
  });
  ok('the score starts when she walks into a place',
     music.onRidge.cue === 'ridge' && music.onRidge.running, JSON.stringify(music.onRidge));
  ok('and follows her to the next one',
     music.moved.cue === 'home', music.moved.cue);
  ok('the sound switch stops the music too',
     !music.off.running && !music.off.cue, JSON.stringify(music.off));

  /* ---- and they talk to each other ---- */
  const talk = await page.evaluate(() => {
    const withVoices = Object.keys(HV).filter(k => (HV[k].voices || []).length);
    const lines = withVoices.reduce((n, k) => n + HV[k].voices.length, 0);
    const bad = [];
    withVoices.forEach(k => HV[k].voices.forEach(v => {
      if (v[0] !== 'her' && v[0] !== 'him') bad.push(k + ':' + v[0]);
      /* the bubble wraps at 26 and is two lines tall at most */
      if (v[1].length > 58) bad.push(k + ': too long');
    }));
    return { nodes: withVoices.length, lines, bad };
  });
  ok('the two of them actually speak', talk.lines >= 20,
     talk.lines + ' lines across ' + talk.nodes + ' scenes');
  ok('every line is attributed and fits its bubble', talk.bad.length === 0, talk.bad.join(', '));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await browser.close();
  process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})();
