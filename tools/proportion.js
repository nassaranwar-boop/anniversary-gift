/* IS A PHONE HELD SIDEWAYS A SMALLER IPAD, OR A DIFFERENT DEVICE?

   Everything in these chapters lives inside a stage with container-type:size,
   so a size written in cqw or cqh shrinks with the stage and a size written
   in px does not. A px size is the same on a 440px-tall phone as on an
   834px-tall iPad -- which is how a television ended up taller than the
   screen it was on, and how a d-pad meant for a tablet ends up eating a
   third of a phone.

   This measures the same elements on both and reports the ratio. Anything at
   or near 1.00 is a control that did not come down with the screen.

     node tools/proportion.js
*/
const { chromium } = require('playwright-core');

const CHAPTERS = [
  ['apoc',   'hub-card-apoc',   ['.ap-stage','.ap-dpad','.ap-key','.ap-dpad-hub','.ap-stick','.ap-stick-knob',
                                 '.ap-act-use','.ap-act-sneak','.ap-hud',
                                 '.ap-map-btn','.ap-dlg','.ap-panel','.ap-tv','.ap-note','.ap-keypad']],
  ['ouissy', 'hub-card-ouissy', ['.so-stage','.so-key','.so-key-jump','.so-key-duck','.so-btn','.so-card',
                                 '.so-tag','.so-pause-btn','.so-hud']],
  ['race',   'hub-card-race',   ['.rc-stage','.rc-btn','.rc-btn-s','.rc-dbtn','.rc-key','.rc-key-steer',
                                 '.rc-key-big','.rc-key-sm','.rc-pad-cluster','.rc-tag']],
  ['quest',  'hub-card-quest',  ['.hv-stage','.hv-chip','.hv-btn','.hv-top','.hv-note']],
  ['night',  'hub-card-nightshift', ['.ns-stage','.ns-btn','.ns-btn-sm','.ns-key','.ns-hud','.ns-mon',
                                 '.ns-overlay','.ns-cozy']],
];

/* a probe for a control that is not on screen in this scene has to be built
   where the real one lives, or the lengths it is written in have nothing to
   resolve against: an .ap-key outside an .ap-dpad has no --pad */
const NEST = {
  '.ap-key':'.ap-dpad', '.ap-dpad-hub':'.ap-dpad', '.ap-stick-knob':'.ap-stick',
  '.ap-act-use':'.ap-touch .ap-actions', '.ap-act-sneak':'.ap-touch .ap-actions',
  '.rc-key-steer':'.rc-pad-cluster', '.rc-key-big':'.rc-pad-cluster', '.rc-key-sm':'.rc-pad-cluster',
};

const measure = async (p, sels) => p.evaluate(({list, nest}) => {
  const out = {};
  list.forEach(sel => {
    const e = document.querySelector(sel);
    if (!e) return;
    let b = e.getBoundingClientRect();
    if (b.width < 2 || b.height < 2) {
      /* not on screen in this scene -- size a hidden probe instead, which is
         what the stylesheet would give it if it were */
      const stage = document.querySelector('.ap-stage,.so-stage,.rc-stage,.hv-stage,.ns-stage');
      if (!stage) return;
      const probe = document.createElement('div');
      probe.className = sel.replace(/^\./, '');
      probe.style.cssText = 'visibility:hidden;position:absolute;';
      let root = probe, host = stage;
      (nest[sel] || '').split(' ').filter(Boolean).reverse().forEach(cls => {
        const wrap = document.createElement('div');
        wrap.className = cls.replace(/^\./, '');
        wrap.style.cssText = 'visibility:hidden;position:absolute;';
        wrap.appendChild(root); root = wrap;
      });
      host.appendChild(root);
      b = probe.getBoundingClientRect();
      root.remove();
      if (b.width < 2 && b.height < 2) return;
    }
    out[sel] = [Math.round(b.width), Math.round(b.height)];
  });
  return out;
}, {list:sels, nest:NEST});

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

  const run = async (w, h) => {
    const got = {};
    for (const [name, card, sels] of CHAPTERS) {
      const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:2,
        isMobile:true, hasTouch:true });
      await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
      const p = await ctx.newPage();
      await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
      await p.waitForTimeout(1700);
      await p.evaluate(()=>{ showScreen('hub'); if (window.startHub) startHub(); });
      await p.waitForTimeout(800);
      await p.evaluate(c => { const e = document.getElementById(c); if (e) e.click(); }, card);
      await p.waitForTimeout(7500);
      got[name] = await measure(p, sels);
      await ctx.close();
    }
    return got;
  };

  const phone = await run(956, 440);
  const ipad  = await run(1194, 834);
  await b.close();

  /* the stage itself sets the scale everything else should be measured
     against: 440 of height against 672 is 0.65 */
  let flagged = 0, checked = 0;
  for (const [name] of CHAPTERS) {
    const ph = phone[name] || {}, ip = ipad[name] || {};
    const stageSel = Object.keys(ip).find(k => k.endsWith('-stage'));
    const scale = stageSel && ph[stageSel] && ip[stageSel]
      ? ph[stageSel][1] / ip[stageSel][1] : null;
    console.log(`\n=== ${name} ===   stage ${ph[stageSel]||'-'} vs ${ip[stageSel]||'-'}   expected scale ${scale?scale.toFixed(2):'?'}`);
    Object.keys(ip).forEach(sel => {
      if (sel === stageSel || !ph[sel]) return;
      checked++;
      const r = ph[sel][1] / Math.max(1, ip[sel][1]);
      /* a control already at the size of a thumb has come down as far as it
         should: 48px on a 440px screen is the floor, not a fault */
      const floor = ph[sel][1] <= 48;
      const bad = !floor && r > (scale || 0.7) + 0.16;
      if (bad) flagged++;
      console.log(`   ${bad?'BIG ':(floor?'thumb':'     ')}${sel.padEnd(18)} phone ${String(ph[sel][0]+'x'+ph[sel][1]).padEnd(11)} ipad ${String(ip[sel][0]+'x'+ip[sel][1]).padEnd(11)} ratio ${r.toFixed(2)}`);
    });
  }
  console.log(`\n${checked} controls compared, ${flagged} not proportionally smaller`);
})();
