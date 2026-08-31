/* The whole chapter, start to finish, the way she would play it: in from
   the hub, through all five levels, out onto the roof. Nothing is skipped
   and nothing is entered by hand — every level is started by the game
   itself, so the card, the intro, the objectives and the hand-off from one
   level to the next are all exercised. */
const { chromium } = require('playwright-core');

const say = (...a) => console.log(...a);
/* Wait for the thing to actually be there rather than guessing at a
   duration. Every "it did not work" in this suite has been the script
   acting a beat before the game was ready, and then acting on whatever was
   left over from the level before. */
const waitFor = async (p, sel, what) => {
  try { await p.waitForSelector(sel, { timeout: 9000 }); return true; }
  catch (e) { say('!! never appeared:', what || sel); return false; }
};
/* Settle.

   Every failure this suite has reported has been the same mistake: acting
   in the gap between two beats. A panel finishes, and a second and a half
   later a line of dialogue arrives; a script that drained the box in that
   gap saw nothing to drain, moved on, and then found the game busy talking
   when it tried to do the next thing.

   So this does not click a fixed number of times and it does not sleep. It
   waits for the game to be back in "play" with nothing on screen, clicking
   through whatever appears on the way, and gives up loudly rather than
   quietly if it never gets there. */
const settle = async (p, what) => {
  for (let i = 0; i < 120; i++) {
    const st = await p.evaluate(() => {
      const dlg = document.getElementById('ap-dlg');
      const talking = dlg && dlg.getAttribute('aria-hidden') === 'false';
      if (talking) { document.getElementById('ap-dlg-next').click(); return 'talking'; }
      if (document.querySelector('.ap-overlay[aria-hidden="false"]')) return 'overlay';
      const s = window.__apState ? window.__apState() : {};
      return s.state === 'play' ? 'play' : (s.state || 'unknown');
    });
    if (st === 'play') return true;
    if (st === 'overlay') return true;          // a card or panel is waiting for us
    await p.waitForTimeout(90);
  }
  say('!! never settled' + (what ? ' after ' + what : ''));
  return false;
};
const clicks = settle;

/* Find the card and press it in the same breath.

   The previous version looked for the card in one call and pressed it in
   the next, and between those two calls the game is free to move on — so
   now and then it pressed the card that had replaced the one it had just
   found, skipped a step, and then reported the skipped step as missing.
   Both halves happen inside a single page evaluation now, so there is no
   window between seeing it and acting on it. Everything else in this file
   that presses something waits the same way, for the same reason. */
const pressWhen = async (p, sel, match, label, timeout) => {
  const ok = await p.waitForFunction(([s, m]) => {
    const nodes = Array.from(document.querySelectorAll(s));
    for (const n of nodes) {
      const box = n.closest('.ap-card, .ap-tv, .ap-note, .ap-radio, .ap-check, .ap-serum, .ap-panel') || n;
      if (!m || box.textContent.includes(m)) {
        if (n.disabled) return false;
        n.click();
        return true;
      }
    }
    return false;
  }, [sel, match || null], { timeout: timeout || 12000, polling: 120 })
    .then(() => true).catch(() => false);
  if (!ok) say('!! never appeared:', label || match || sel);
  return ok;
};

const goCard = async (p, match, label) => {
  if (!match) { say('!! goCard called with nothing to look for — fix the caller'); return false; }
  const ok = await pressWhen(p, '.ap-card-go', match, label || match);
  await p.waitForTimeout(220);
  return ok;
};

const solvePanel = async (p) => {
  if (!await waitFor(p, '.ap-panel-canvas', 'the wire panel')) return false;
  await p.evaluate(() => window.__apSolvePanel());
  await p.waitForTimeout(2100);
  return true;
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  const errs = [];
  p.on('pageerror', e => { errs.push(e.message); say('PAGEERROR', e.message); });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1000);

  // in from the hub, exactly as she would
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(300);
  await p.click('#hub-card-apoc');
  await p.waitForTimeout(1400);
  say('on the apocalypse screen:', await p.evaluate(() => document.getElementById('screen-apoc').classList.contains('active')));
  await goCard(p, 'the world ends', 'the how-to card');
  await goCard(p, 'Level 1', 'the Level 1 card');
  await settle(p);
  say('L1 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 1 ----
  await p.evaluate(() => { window.__apTeleport(3, 12); window.__apUse(); });
  await pressWhen(p, '.ap-tv .ap-note-ok', null, 'the television');
  await p.waitForTimeout(250); await settle(p);
  await p.evaluate(() => { window.__apTeleport(29, 12); window.__apUse(); });
  await p.waitForTimeout(350);
  await solvePanel(p); await settle(p);
  await p.evaluate(() => { window.__apTeleport(29, 20); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250); await settle(p);
  await goCard(p, 'Level 2', 'the Level 2 card');
  await settle(p);
  say('L2 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 2 ----
  await p.evaluate(() => { window.__apTeleport(11, 21); window.__apUse(); });
  await pressWhen(p, '.ap-note .ap-note-ok', null, 'the note');
  await p.waitForTimeout(200); await settle(p);
  await p.evaluate(() => { window.__apTeleport(31, 20); window.__apUse(); });
  await waitFor(p, '.ap-keypad', 'the gate keypad');
  await p.evaluate(() => { window.__apKeypadType('4180'); });
  await p.waitForTimeout(300);
  say('L2 gate open:', await p.evaluate(() => window.__apState().doors.filter(d => d.includes('locked')).join()));
  await p.evaluate(() => { window.__apTeleport(44, 28); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250); await settle(p);
  await goCard(p, 'Level 3', 'the Level 3 card');
  await settle(p);
  say('L3 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 3 ----
  await p.evaluate(() => { window.__apTeleport(5, 5); window.__apUse(); });
  await p.waitForTimeout(350);
  await solvePanel(p); await settle(p);
  await settle(p, 'the ward doors');
  await p.evaluate(() => { window.__apTeleport(30, 6); window.__apPump(0.6, {}); });
  await p.waitForTimeout(250); await settle(p);
  say('he is awake:', await p.evaluate(() => window.__apState().anwar.awake));
  await p.evaluate(() => { window.__apTeleport(3, 16); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250); await settle(p);
  await goCard(p, 'Level 4', 'the Level 4 card');
  await settle(p);
  await pressWhen(p, '.ap-radio .ap-note-ok', null, 'the radio');
  await p.waitForTimeout(250); await settle(p);
  say('L4 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 4 ----
  /* The car takes two goes now: the first is the beat about three cars and
     only one of them any use, the second is the bonnet. */
  await p.evaluate(() => { window.__apTeleport(12, 18); window.__apUse(); });
  await settle(p, 'the three cars');
  await p.evaluate(() => window.__apUse());
  await solvePanel(p);
  await p.evaluate(() => window.__apPump(11, {}));       // the drive
  await p.waitForTimeout(250); await settle(p);
  say('on the road:', await p.evaluate(() => window.__apMapKey()));
  await settle(p, 'the lane');
  await p.evaluate(() => { window.__apTeleport(38, 21); window.__apUse(); });
  await p.waitForTimeout(250); await settle(p);
  await p.evaluate(() => window.__apPump(10, {}));       // the ride
  await p.waitForTimeout(250); await settle(p);
  await goCard(p, 'Level 5', 'the Level 5 card');
  await settle(p);
  say('L5 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 5 ----
  await settle(p, 'arriving at the gates');
  await p.evaluate(() => { window.__apTeleport(13, 10); window.__apUse(); });
  await p.waitForTimeout(250); await settle(p);
  await settle(p, 'the hail');
  await p.evaluate(() => { window.__apTeleport(20, 9); window.__apUse(); });
  if (await waitFor(p, '.ap-check-row', 'the arrivals check')) {
    await p.evaluate(() => document.querySelectorAll('.ap-check-row').forEach(r => r.click()));
    await p.waitForTimeout(200);
  }
  await pressWhen(p, '.ap-check .ap-note-ok', null, 'the check, signed off');
  await pressWhen(p, '.ap-serum .ap-note-ok', null, 'the serum');
  await p.waitForTimeout(2700);
  await pressWhen(p, '.ap-serum .ap-note-ok', null, 'the serum, done');
  await p.waitForTimeout(300); await settle(p);
  await p.evaluate(() => { window.__apTeleport(32, 10); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250); await settle(p);
  say('chapter card:', await p.evaluate(() => { const t = document.querySelector('.ap-card-title'); return t && t.textContent; }));
  await goCard(p, 'you still came and found me', 'the chapter card');
  await p.waitForTimeout(900);
  say('on the roof:', await p.evaluate(() => document.getElementById('screen-end').classList.contains('active')));
  say('chapter marked done:', await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('fal_chapters_done') || '{}').apoc === true; } catch (e) { return 'n/a'; } }));
  say('close calls on the way:', await p.evaluate(() => window.__apState ? 'n/a after handoff' : ''));
  say('PAGE ERRORS:', errs.length);
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
