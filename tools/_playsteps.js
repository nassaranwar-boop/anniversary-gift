/* the steps of the playthrough, so the driver stays readable */
module.exports = async function (ctx) {
  const { p, shot, say, where } = ctx;
  const T = (ms) => p.waitForTimeout(ms);
  /* A REAL TAP. Half this site answers pointerdown rather than click --
     the passcode keys do, because a key should light the moment she
     touches it -- so el.click() presses nothing at all. Everything here
     goes through the mouse, at the place on screen the thing actually
     is, which is also the only way to find out whether it is reachable. */
  const tap = async (sel, what) => {
    const box = await p.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return { off: true };
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    }, sel);
    if (!box) { say(`  tap ${what || sel}: NOT FOUND`); return false; }
    if (box.off) { say(`  tap ${what || sel}: THERE BUT HAS NO SIZE`); return false; }
    await p.mouse.move(box.x, box.y);
    await p.mouse.down();
    await T(40);
    await p.mouse.up();
    say(`  tap ${what || sel}: ok`);
    return true;
  };

  /* ---- 1. the opening film ---- */
  say('\n=== the opening. It says "Tap anywhere to begin", so I tap.');
  await p.mouse.click(ctx.W ? ctx.W / 2 : 450, 320);
  await T(3000);
  await shot('after-first-tap');
  say('  at: ' + JSON.stringify(await where()));

  /* it is a film; give it a while and look again */
  for (let i = 0; i < 6; i++) {
    await T(5000);
    const w = await where();
    if (w.screen !== 'screen-videointro') { say('  moved on to ' + w.screen); break; }
  }
  await shot('intro-running');
  say('  at: ' + JSON.stringify(await where()));

  /* ---- 2. the gate ---- */
  const atGate = await p.evaluate(() => !!document.querySelector('#screen-gate.active'));
  if (!atGate) {
    say('  (not at the gate yet -- looking for a way past the film)');
    await p.mouse.click(450, 320);
    await T(4000);
  }
  say('\n=== the card with the keypad. The only clue is the shape of it.');
  await shot('gate');
  say('  at: ' + JSON.stringify(await where()));
  const keys = await p.evaluate(() =>
    [].slice.call(document.querySelectorAll('#gate-pad button'))
      .map((b) => b.getAttribute('data-gate-key')));
  say('  keypad: ' + JSON.stringify(keys));
  for (const d of ['2', '2', '0', '7']) {
    await tap(`#gate-pad [data-gate-key="${d}"]`, 'the ' + d + ' key');
    await T(260);
  }
  say('  dots showing: ' + await p.evaluate(() =>
    (document.getElementById('gate-code') || {}).className + ' | ' +
    [].slice.call(document.querySelectorAll('#gate-code *')).map((d) => d.className).join(',')));
  await shot('gate-typed');
  await tap('#gate-submit', 'the unlock key');
  await T(3500);
  say('  at: ' + JSON.stringify(await where()));
  await shot('after-unlock');

  /* ---- 3. the book ---- */
  say('\n=== the scrapbook');
  await T(2500);
  await shot('book-cover');
  await p.mouse.click(450, 320);
  await T(2500);
  await shot('book-open');
  /* IT SAYS "take the corner and pull it across", SO I PULL IT.
     Tapping does nothing, which is the whole point of the hint. */
  const pageText = () => p.evaluate(() =>
    ((document.getElementById('sb-spread') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160));
  let seen = [];
  for (let i = 0; i < 14; i++) {
    const before = await pageText();
    const box = await p.evaluate(() => {
      const el = document.getElementById('sb-book-outer') || document.getElementById('sb-spread');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x1: r.right - 24, y1: r.bottom - 40, x2: r.left + 30, y2: r.top + r.height * 0.55 };
    });
    if (!box) { say('  (no book on screen to turn)'); break; }
    await p.mouse.move(box.x1, box.y1);
    await p.mouse.down();
    for (let k = 1; k <= 8; k++)
      await p.mouse.move(box.x1 + (box.x2 - box.x1) * k / 8, box.y1 + (box.y2 - box.y1) * k / 8);
    await p.mouse.up();
    await T(1500);
    const after = await pageText();
    if (after && after !== before) seen.push(after.slice(0, 70));
    if (i === 1 || i === 5 || i === 9) await shot('book-page-' + i);
    const w = await where();
    if (w.screen !== 'screen-scrapbook') { say('  the book handed me to ' + w.screen + ' after ' + (i + 1) + ' turns'); break; }
  }
  say('  pages I got to: ' + seen.length);
  seen.forEach((t, i) => say(`    ${i + 1}. ${t}`));
  say('  at: ' + JSON.stringify(await where()));
  await shot('book-end');

  /* the drawer, because there is a flower button and I am curious */
  if (await p.evaluate(() => !!document.querySelector('#screen-scrapbook.active'))) {
    await tap('#sb-extras-btn', 'the flower button');
    await T(1600);
    await shot('book-drawer');
    await tap('#sb-extras-btn', 'the flower button again');
    await T(1000);
  }

  /* ---- 4. the hub ---- */
  say('\n=== getting to the hub');
  await p.evaluate(() => { if (window.showScreen) showScreen('hub'); });
  await T(2000);
  await shot('hub');
  const cards = await p.evaluate(() =>
    [].slice.call(document.querySelectorAll('.hub-card'))
      .map((c) => ({ id: c.id, text: (c.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
                     disabled: c.disabled || c.getAttribute('aria-disabled') === 'true' })));
  say('  the cards: ' + JSON.stringify(cards, null, 1));
  const sub = await p.evaluate(() => (document.getElementById('hub-sub') || {}).innerText);
  say('  the line under the title: ' + JSON.stringify(sub));

  /* ---- 5. each chapter, in the order they are laid out ---- */
  for (const c of ['quest', 'ouissy', 'apoc', 'nightshift', 'race']) {
    say(`\n=== opening "${c}"`);
    await p.evaluate(() => { if (window.showScreen) showScreen('hub'); });
    await T(800);
    const ok = await tap('#hub-card-' + c, 'the ' + c + ' card');
    if (!ok) continue;
    await T(6000);
    say('  at: ' + JSON.stringify(await where()));
    await shot(c + '-opened');
    await T(6000);
    await shot(c + '-after-6s');
  }

  /* ---- 6. the keepsake ---- */
  say('\n=== the keepsake');
  await p.evaluate(() => { if (window.showScreen) showScreen('hub'); });
  await T(1200);
  await tap('#hub-keepsake', 'open the keepsake');
  await T(3000);
  say('  at: ' + JSON.stringify(await where()));
  await shot('keepsake');
};
