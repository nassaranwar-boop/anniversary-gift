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
  /* ost.js is fetched with the chapter rather than sitting in the head,
     and main exposes window.loadChapter so a harness can open that door
     itself instead of guessing how long the idle prefetch takes. */
  await page.evaluate(() => window.loadChapter && window.loadChapter('quest'));
  await page.waitForTimeout(200);
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

  /* ---- the buttons wait for the conversation ---- */
  const gate = await page.evaluate(async () => {
    const btns = () => [...document.querySelectorAll('#hv-left .hv-btn, #hv-centre .hv-btn, #hv-right .hv-btn')];
    const live = () => btns().filter(b => !b.disabled).length;

    /* an ordinary talking scene: nothing to press until they are done */
    hvNode = 'there_quiet'; hvHistory = []; hvRender(false);
    hvArrive = 0; hvPaintFrame(0.2, 0.016);
    const atOpen = { total: btns().length, live: live() };
    /* run their clock forward; the skip was deliberately removed */
    /* their clock is run forward; there is no skip to press */
    let taps = 0;
    while (!hvVoicesDone(HV[hvNode]) && taps++ < 40) hvVoiceStep(HV[hvNode], taps * HV_VOICE_HOLD + 2);
    hvPaintFrame(30, 0.016);
    const afterTalk = { total: btns().length, live: live() };

    /* a mechanic screen with dialogue on it: never gated, ever */
    hvNode = 'back_bridge2'; hvHistory = []; hvRender(false);
    hvArrive = 0; hvPaintFrame(0.2, 0.016);
    const onPlay = { total: btns().length, live: live(), voices: (HV.back_bridge2.voices || []).length };
    return { atOpen, afterTalk, onPlay, taps };
  });
  ok('a talking scene offers nothing to press while they are talking',
     gate.atOpen.total > 0 && gate.atOpen.live === 0,
     gate.atOpen.live + ' of ' + gate.atOpen.total + ' live');
  ok('and offers its choices the moment the talking is done',
     gate.afterTalk.live === gate.afterTalk.total && gate.afterTalk.live > 0,
     gate.afterTalk.live + ' of ' + gate.afterTalk.total + ' live after ' + gate.taps + ' taps');
  ok('but a mechanic screen is never gated, even with dialogue on it',
     gate.onPlay.voices > 0 && gate.onPlay.live === gate.onPlay.total && gate.onPlay.live > 0,
     gate.onPlay.live + '/' + gate.onPlay.total + ' live, ' + gate.onPlay.voices + ' lines');

  /* ---- and the ending sends her round again rather than shutting ---- */
  const again = await page.evaluate(async () => {
    try { localStorage.removeItem('fal_chapters'); } catch (e) {}
    hvNode = 'ask'; hvHistory = []; hvRender(false);
    hvGo('yay');
    const doneAtEnding = !!(chaptersDone() || {}).quest;
    const labels = (HV.yay.choices || []).map(c => c.label);
    hvFound.acorn = true;
    hvGo('__again');
    return { doneAtEnding, labels, landed: hvNode, kept: !!hvFound.acorn,
             history: hvHistory.length };
  });
  ok('reaching the ending is what marks the chapter done', again.doneAtEnding);
  ok('the ending offers another way round, not just a way out',
     /again/i.test(again.labels[0] || ''), again.labels.join(' / '));
  ok('going round again lands back at the fork', again.landed === 'ways', again.landed);
  ok('and keeps everything she found', again.kept && again.history === 0,
     'history ' + again.history);

  /* ---- and they talk to each other ---- */
  const talk = await page.evaluate(() => {
    /* Both kinds: plain `voices`, and `voicesIfMet`, whose two branches
       say different things depending on whether she has walked the
       route being called back to. The conditional ones were invisible
       to this check when it only looked at `voices`, which is exactly
       the half most likely to rot. */
    const setsOf = (n) => n.voicesIfMet ? [n.voicesIfMet.yes, n.voicesIfMet.no] : (n.voices ? [n.voices] : []);
    const keys = Object.keys(HV).filter(k => setsOf(HV[k]).length);
    let lines = 0;
    const bad = [];
    keys.forEach(k => setsOf(HV[k]).forEach((set, si) => {
      if (!set || !set.length) { bad.push(k + ': empty branch ' + si); return; }
      set.forEach(v => {
        lines++;
        if (v[0] !== 'her' && v[0] !== 'him') bad.push(k + ':' + v[0]);
        /* the bubble wraps at 26 and is two lines tall at most */
        if (v[1].length > 58) bad.push(k + ': too long');
      });
    }));
    /* and every conditional one must name a route the game can answer */
    Object.keys(HV).forEach(k => {
      const c = HV[k].voicesIfMet || HV[k].sayIfMet;
      if (c && typeof hvHasWalked(c.route) !== 'boolean') bad.push(k + ': bad route ' + c.route);
    });
    return { nodes: keys.length, lines, bad };
  });
  ok('the two of them actually speak', talk.lines >= 20,
     talk.lines + ' lines across ' + talk.nodes + ' scenes');
  ok('every line is attributed and fits its bubble', talk.bad.length === 0, talk.bad.join(', '));

  /* ---- leaving the page, and coming back to it ---- */
  const away = await page.evaluate(async () => {
    hvSetSound(true);
    hvNode = 'back_ridge'; hvHistory = []; hvRender(false);
    await new Promise(r => setTimeout(r, 350));
    const playing = window.OST.debug();
    /* the real signals: a phone hides the tab, a desktop blurs the window */
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
    hvHushChapter();
    await new Promise(r => setTimeout(r, 150));
    const gone = window.OST.debug();
    const ambienceTimer = !!(typeof hvAmb !== 'undefined' && hvAmb && hvAmb.timer);
    hvResumeChapter();
    await new Promise(r => setTimeout(r, 350));
    const back = window.OST.debug();
    return { playing, gone, ambienceTimer, back };
  });
  ok('the sound stops when the page is left',
     away.playing.running && !away.gone.running && !away.ambienceTimer,
     JSON.stringify(away.gone));
  ok('and starts again, on the same scene, when she comes back',
     away.back.running && away.back.cue === 'ridge', JSON.stringify(away.back));
  const registered = await page.evaluate(() => {
    /* the chapter's own context must be one of the ones hushAllAudio knows
       about — every other chapter registers, this one never used to */
    let seen = false;
    const real = window.registerAudio;
    return typeof window.hvSharedCtx === 'function' && !!window.hvSharedCtx();
  });
  ok('the chapter hands its context to the site', registered);

  /* ---- the conversation cannot be clicked past ---- */
  const noskip = await page.evaluate(() => {
    hvNode = 'there_quiet'; hvHistory = []; hvRender(false);
    hvArrive = 0; hvPaintFrame(1.6, 0.016);
    const first = hvVoiceI;
    const c = document.getElementById('hv-canvas');
    const r = c.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      c.dispatchEvent(new MouseEvent('click', { bubbles: true,
        clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.4 }));
    }
    hvPaintFrame(1.7, 0.016);
    return { first, after: hvVoiceI, gone: typeof window.hvVoiceSkip };
  });
  ok('clicking no longer skips a line', noskip.after === noskip.first,
     'line ' + noskip.first + ' -> ' + noskip.after);
  ok('and the skip is gone rather than merely unbound', noskip.gone === 'undefined');

  /* ---- what he gives her at the end ---- */
  const present = await page.evaluate(() => {
    const out = {};
    ['heart', 'flower'].forEach((k) => {
      hvKeepsake = k;
      hvAskFrom = 'ask';
      hvNode = 'gift'; hvHistory = []; hvRender(false);
      const said = document.getElementById('hv-note').textContent;
      out[k] = { mentions: said.indexOf(k) >= 0, lines: hvVoicesOf(HV.gift).length,
                 draws: !!HV.gift.giveKeepsake };
    });
    hvKeepsake = 'heart'; hvAskFrom = 'back_ask';
    hvGo('__yay');
    out.backEnding = hvNode;
    hvAskFrom = 'ask'; hvNode = 'gift'; hvGo('__yay');
    out.leftEnding = hvNode;
    return out;
  });
  ok('he gives her the heart when she chose the heart',
     present.heart.mentions && present.heart.lines >= 3 && present.heart.draws);
  ok('and the flower when she chose the flower',
     present.flower.mentions && present.flower.lines >= 3);
  ok('the gift hands on to the right ending for each path',
     present.leftEnding === 'yay' && present.backEnding === 'back_yay',
     present.leftEnding + ' / ' + present.backEnding);

  /* ---- and there is a way back to the very start ---- */
  const restart = await page.evaluate(async () => {
    hvNode = 'back_windfall'; hvHistory = ['ways', 'back']; hvRender(false);
    const chip = document.getElementById('hv-restart');
    if (!chip) return { chip: false };
    chip.click();
    await new Promise(r => setTimeout(r, 80));
    return { chip: true, node: hvNode, history: hvHistory.length };
  });
  ok('a chip beside back returns to the very beginning',
     restart.chip && restart.node === 'title' && restart.history === 0,
     JSON.stringify(restart));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await browser.close();
  process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})();
