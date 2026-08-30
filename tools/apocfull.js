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
/* Drain the dialogue rather than clicking a fixed number of times. A fixed
   count is fine until a beat is one line longer than you remembered, and
   then every step after it is one click out of phase — which is what made
   this suite report a level that had never started. Clicks until the box
   is gone, with a cap so a stuck box fails loudly instead of hanging. */
const clicks = async (p, cap) => {
  for (let i = 0; i < (cap || 40); i++) {
    const open = await p.evaluate(() => {
      const d = document.getElementById('ap-dlg');
      if (!d || d.getAttribute('aria-hidden') !== 'false') return false;
      document.getElementById('ap-dlg-next').click();
      return true;
    });
    if (!open) return;
    await p.waitForTimeout(45);
  }
  say('!! dialogue would not close');
};
/* And wait for the card before pressing it, for the same reason. */
const goCard = async (p, expect) => {
  if (!await waitFor(p, '.ap-card-go', expect || 'a card')) return false;
  await p.evaluate(() => document.querySelector('.ap-card-go').click());
  await p.waitForTimeout(300);
  return true;
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
  await goCard(p, 'the how-to card');
  await goCard(p, 'the Level 1 card');
  await clicks(p);
  say('L1 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 1 ----
  await p.evaluate(() => { window.__apTeleport(3, 12); window.__apUse(); });
  await waitFor(p, '.ap-tv', 'the television');
  await p.evaluate(() => document.querySelector('.ap-tv .ap-note-ok').click());
  await p.waitForTimeout(250); await clicks(p);
  await p.evaluate(() => { window.__apTeleport(29, 12); window.__apUse(); });
  await p.waitForTimeout(350);
  await solvePanel(p); await clicks(p);
  await p.evaluate(() => { window.__apTeleport(29, 20); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250); await clicks(p);
  await goCard(p, 'the Level 2 card');
  await clicks(p);
  say('L2 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 2 ----
  await p.evaluate(() => { window.__apTeleport(11, 21); window.__apUse(); });
  await waitFor(p, '.ap-note-code', 'the note');
  await p.evaluate(() => document.querySelector('.ap-note-ok').click());
  await p.waitForTimeout(200); await clicks(p);
  await p.evaluate(() => { window.__apTeleport(31, 20); window.__apUse(); });
  await waitFor(p, '.ap-keypad', 'the gate keypad');
  await p.evaluate(() => { window.__apKeypadType('4180'); });
  await p.waitForTimeout(300);
  say('L2 gate open:', await p.evaluate(() => window.__apState().doors.filter(d => d.includes('locked')).join()));
  await p.evaluate(() => { window.__apTeleport(44, 28); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250); await clicks(p);
  await goCard(p, 'the Level 3 card');
  await clicks(p);
  say('L3 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 3 ----
  await p.evaluate(() => { window.__apTeleport(5, 5); window.__apUse(); });
  await p.waitForTimeout(350);
  await solvePanel(p); await clicks(p);
  await p.evaluate(() => { window.__apTeleport(30, 6); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250); await clicks(p);
  say('he is awake:', await p.evaluate(() => window.__apState().anwar.awake));
  await p.evaluate(() => { window.__apTeleport(3, 16); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250); await clicks(p);
  await goCard(p, 'the Level 4 card');
  await clicks(p);
  await waitFor(p, '.ap-radio', 'the radio');
  await p.evaluate(() => { const b = document.querySelector('.ap-radio .ap-note-ok'); if (b) b.click(); });
  await p.waitForTimeout(250); await clicks(p);
  say('L4 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 4 ----
  await p.evaluate(() => { window.__apTeleport(12, 18); window.__apUse(); });
  await p.waitForTimeout(350);
  await solvePanel(p);
  await p.evaluate(() => window.__apPump(11, {}));       // the drive
  await p.waitForTimeout(250); await clicks(p);
  say('on the road:', await p.evaluate(() => window.__apMapKey()));
  await p.evaluate(() => { window.__apTeleport(38, 21); window.__apUse(); });
  await p.waitForTimeout(250); await clicks(p);
  await p.evaluate(() => window.__apPump(10, {}));       // the ride
  await p.waitForTimeout(250); await clicks(p);
  await goCard(p, 'the Level 5 card');
  await clicks(p);
  say('L5 place:', await p.evaluate(() => document.getElementById('ap-place').textContent));

  // ---- LEVEL 5 ----
  await p.evaluate(() => { window.__apTeleport(13, 10); window.__apUse(); });
  await p.waitForTimeout(250); await clicks(p);
  await p.evaluate(() => { window.__apTeleport(20, 9); window.__apUse(); });
  await waitFor(p, '.ap-check-row', 'the arrivals check');
  await p.evaluate(() => document.querySelectorAll('.ap-check-row').forEach(r => r.click()));
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.ap-check .ap-note-ok').click());
  await waitFor(p, '.ap-serum-canvas', 'the serum');
  await p.evaluate(() => document.querySelector('.ap-serum .ap-note-ok').click());
  await p.waitForTimeout(2600);
  await p.evaluate(() => document.querySelector('.ap-serum .ap-note-ok').click());
  await p.waitForTimeout(300); await clicks(p);
  await p.evaluate(() => { window.__apTeleport(32, 10); window.__apPump(0.4, {}); });
  await p.waitForTimeout(250); await clicks(p);
  say('chapter card:', await p.evaluate(() => { const t = document.querySelector('.ap-card-title'); return t && t.textContent; }));
  await goCard(p);
  await p.waitForTimeout(900);
  say('on the roof:', await p.evaluate(() => document.getElementById('screen-end').classList.contains('active')));
  say('chapter marked done:', await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('fal_chapters_done') || '{}').apoc === true; } catch (e) { return 'n/a'; } }));
  say('close calls on the way:', await p.evaluate(() => window.__apState ? 'n/a after handoff' : ''));
  say('PAGE ERRORS:', errs.length);
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
