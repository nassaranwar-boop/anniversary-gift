/* A PHONE HELD SIDEWAYS, AT EVERY SIZE SHE MIGHT BE HOLDING.

   landscape.js covers two widths and four screens. This covers the whole
   site at the sizes real devices actually report, because the faults that
   turn up sideways are not one fault -- a control below the fold on a short
   phone, a stage that gave up half the screen, a page that scrolls when the
   page is meant not to, text that shrank past reading, and content sitting
   under the notch, which in landscape is down the SIDE and not the top.

   Heights come in two flavours per device: the full viewport, and the
   shorter one Safari leaves once its bottom bar is up, because that is what
   she will actually be looking at most of the time.

     node tools/handheld.js            # everything
     node tools/handheld.js book       # one screen
*/
const { chromium } = require('playwright-core');

const DEVICES = [
  ['iPhone SE',          667, 375, 3],
  ['iPhone 13 mini',     812, 375, 3],
  ['iPhone 13 Pro',      844, 390, 3],
  ['iPhone 13 Pro·bar',  844, 340, 3],
  ['iPhone 16 Pro',      874, 402, 3],
  ['iPhone 15 Pro Max',  932, 430, 3],
  ['iPhone 16 Pro Max',  956, 440, 3],
  ['iPhone 16PM·bar',    956, 390, 3],
  ['iPad 10.9',         1180, 820, 2],
  ['iPad Pro 11',       1194, 834, 2],
];

let pass = 0, fail = 0;
/* stderr, not stdout: node buffers stdout when it is a pipe, so a run that
   takes ten minutes shows nothing at all until it exits and a kill loses the
   lot. */
const say = m => process.stderr.write(m + '\n');
const ok = (label, cond, note) => {
  if (cond) { pass++; } else { fail++; say('FAIL  ' + label + (note ? '   ' + note : '')); }
};

/* Every control that is on screen, big enough for a thumb, and not sitting
   under something else. Returns the ones that are not. */
const CONTROLS = () => {
  const bad = [];
  const all = [...document.querySelectorAll('button,[role="button"],.hub-card,a[href]')];
  all.forEach(c => {
    for (let n = c; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return;
    }
    let b = c.getBoundingClientRect();
    if (b.width < 4 || b.height < 4) return;
    const id = (c.id || c.className || c.tagName).toString().split(' ')[0];
    /* A control inside something that scrolls is reachable -- scrolled to,
       not unreachable. Overlays here are overflow-y:auto with a fade at the
       foot to say there is more, so bring it into view before judging it,
       the way a thumb would. */
    for (let n = c.parentElement; n && n !== document.body; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight + 2) {
        const nb = n.getBoundingClientRect();
        if (b.bottom > nb.bottom || b.top < nb.top) {
          n.scrollTop += (b.top - nb.top) - 8;
          b = c.getBoundingClientRect();
        }
        break;
      }
    }
    /* on the screen at all */
    if (b.bottom > innerHeight + 1 || b.top < -1 || b.right > innerWidth + 1 || b.left < -1) {
      bad.push(id + ' offscreen y' + Math.round(b.top) + '..' + Math.round(b.bottom) +
               ' x' + Math.round(b.left) + '..' + Math.round(b.right));
      return;
    }
    /* A THUMB CAN HIT IT -- AND THE THING IT HITS MAY BE BIGGER THAN THE
       THING IT SEES. Several controls here keep the size they look and carry
       an invisible 44px target on a ::after, which is the right way to do it:
       the chip stays a chip and the target is a thumb. Measuring the element
       box alone calls those broken and would have had me inflating buttons
       that were already correct. */
    let tw = b.width, th = b.height;
    for (const pseudo of ['::after', '::before']) {
      const ps = getComputedStyle(c, pseudo);
      if (!ps || ps.content === 'none' || ps.position !== 'absolute') continue;
      const pw = parseFloat(ps.width), ph = parseFloat(ps.height);
      if (pw > tw) tw = pw;
      if (ph > th) th = ph;
    }
    if (tw < 40 || th < 40) {
      bad.push(id + ' small ' + Math.round(tw) + 'x' + Math.round(th));
      return;
    }
    /* and nothing is lying over it */
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    if (!(hit && (hit === c || c.contains(hit) || hit.contains(c)))) {
      /* A game's own keys sitting under an open menu are not a fault -- they
         are under a menu, which is what a menu is for. Only report a control
         covered by something that is not a modal layer. */
      const overlay = hit && hit.closest &&
        hit.closest('.so-overlay.on, .ns-overlay, .ap-dlg[aria-hidden="false"], .sb-modal.on, .rc-overlay, [role="dialog"]');
      if (!overlay) bad.push(id + ' covered by ' + (hit ? (hit.className || hit.tagName) : 'nothing'));
    }
  });
  return bad;
};

const OVERFLOW = () => ({
  x: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  y: Math.max(0, document.documentElement.scrollHeight - innerHeight),
});

/* type that has shrunk past reading */
const TINY = () => {
  const out = [];
  document.querySelectorAll('p,h1,h2,h3,span,button,li,td').forEach(e => {
    if (!e.textContent || !e.textContent.trim()) return;
    const b = e.getBoundingClientRect();
    if (b.width < 8 || b.height < 6) return;
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.15) return;
    const px = parseFloat(s.fontSize);
    if (px && px < 9) out.push((e.className || e.tagName).toString().split(' ')[0] + ' ' + px.toFixed(1) + 'px');
  });
  return [...new Set(out)].slice(0, 6);
};

(async () => {
  const only = process.argv[2];
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

  for (const [name, w, h, dpr] of DEVICES) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:dpr,
      isMobile:true, hasTouch:true, reducedMotion:'no-preference' });
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForTimeout(2000);
    const tag = `${name} ${w}x${h}`;

    const check = async (screen) => {
      const bad = await p.evaluate(CONTROLS);
      const of  = await p.evaluate(OVERFLOW);
      const tiny = await p.evaluate(TINY);
      ok(`${tag} / ${screen}: every control usable`, bad.length === 0, bad.slice(0,3).join(' | '));
      ok(`${tag} / ${screen}: the page does not scroll`, of.x === 0 && of.y === 0, `x${of.x} y${of.y}`);
      ok(`${tag} / ${screen}: type stays readable`, tiny.length === 0, tiny.join(', '));
    };

    /* the gate */
    if (!only || only === 'gate') {
      await p.evaluate(()=>showScreen('gate'));
      /* The card animates in over .95s and is smaller and lower while it
         does. Measuring at 1500ms catches the tail of that on a slow frame
         and reports a control below the fold that is not. */
      await p.waitForTimeout(2800);
      await check('gate');
    }
    /* the hub */
    if (!only || only === 'hub') {
      await p.evaluate(()=>{ showScreen('hub'); if (window.startHub) startHub(); });
      await p.waitForTimeout(1800);
      await check('hub');
    }
    /* the book, open on a spread */
    if (!only || only === 'book') {
      await p.evaluate(()=>{ showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
      await p.waitForTimeout(1500);
      await p.evaluate(()=>Scrapbook.skipIntro());
      await p.waitForTimeout(4500);
      await p.evaluate(()=>Scrapbook.next());
      await p.waitForFunction(()=>!document.getElementById('screen-scrapbook').classList.contains('sb-turning'),
        {timeout:30000, polling:120}).catch(()=>{});
      await p.waitForTimeout(900);
      await check('book');
      const book = await p.evaluate(()=>{
        const o=document.getElementById('sb-book-outer'); if(!o) return null;
        const r=o.getBoundingClientRect();
        return { w:Math.round(r.width), h:Math.round(r.height),
                 use:Math.round(r.width*r.height/(innerWidth*innerHeight)*100),
                 pages:document.querySelectorAll('#sb-spread .sb-page.leftpage, #sb-spread .sb-page.rightpage, #sb-spread .sb-page.solo').length,
                 fits: r.top >= -1 && r.bottom <= innerHeight + 1 };
      });
      ok(`${tag} / book: the whole book is on the screen`, book && book.fits,
         book ? book.w+'x'+book.h : 'no book');
      ok(`${tag} / book: it uses the screen`, book && book.use >= 22, book ? book.use+'%' : '-');
      /* the drawer, which is the thing most likely to run off a short screen */
      /* Open it, and be sure it IS open: clicking a toggle blind measured a
         drawer that had slid back out, which reads as every control in it
         being off the left of the screen. */
      await p.evaluate(()=>{
        const s = document.getElementById('screen-scrapbook');
        if (!s.classList.contains('sb-drawer-on')) {
          const x = document.getElementById('sb-extras-btn'); if (x) x.click();
        }
      });
      await p.waitForFunction(
        ()=>document.getElementById('screen-scrapbook').classList.contains('sb-drawer-on'),
        {timeout:15000, polling:120}).catch(()=>{});
      /* The map pins pop in on a stagger -- the last one starts at 1.35s and
         runs half a second -- and a pin measured mid-pop is a scaled box, not
         a small button. Wait the animation out before judging their size. */
      await p.waitForTimeout(3600);
      const dr = await p.evaluate(()=>{
        const d=document.getElementById('sb-drawer'); if(!d) return null;
        return { over: d.scrollHeight - d.clientHeight };
      });
      /* A LANDSCAPE PHONE'S DRAWER SCROLLS ON PURPOSE.
         It is a narrow column down the left of the screen -- five keepsakes
         one under another -- because that is the shape he asked for and the
         shape it has on an iPad. Five of them do not fit in 375 points of
         height and nothing sensible makes them, so it scrolls, and check()
         below still has to reach every control inside it. What is worth
         guarding is that it never grows past a screenful of scroll, which is
         where a column stops feeling like a column. Everywhere else -- a tall
         phone, an iPad -- it still has to fit outright. */
      const slack = (h < 561 && w > h) ? h : 2;
      ok(`${tag} / drawer: it scrolls no more than a screen`,
         dr && dr.over <= slack, dr ? dr.over+'px over (allowed '+slack+')' : '-');
      await check('drawer');
      await p.evaluate(()=>{
        const s = document.getElementById('screen-scrapbook');
        if (s.classList.contains('sb-drawer-on')) {
          const x = document.getElementById('sb-extras-btn'); if (x) x.click();
        }
      });
      await p.waitForTimeout(900);
    }
    /* every chapter */
    if (!only || only === 'games') {
      for (const [card, id] of [['hub-card-quest','quest'],['hub-card-ouissy','ouissy'],
                                ['hub-card-apoc','apoc'],['hub-card-race','race'],
                                ['hub-card-nightshift','nightshift']]) {
        await p.evaluate(()=>{ showScreen('hub'); if (window.startHub) startHub(); });
        await p.waitForTimeout(900);
        await p.evaluate(c => { const e=document.getElementById(c); if (e) e.click(); }, card);
        await p.waitForTimeout(5200);
        await check(id);
        const stage = await p.evaluate(()=>{
          const c = document.querySelector('.screen.active canvas, .screen.active .so-stage, .screen.active .ns-stage');
          if (!c) return null; const r = c.getBoundingClientRect();
          return { w:Math.round(r.width), h:Math.round(r.height),
                   use: Math.round(r.width*r.height/(innerWidth*innerHeight)*100) };
        });
        if (stage) ok(`${tag} / ${id}: the stage uses the screen`, stage.use >= 45,
                      stage.w+'x'+stage.h+' = '+stage.use+'%');
      }
    }
    ok(`${tag}: no page errors`, errs.length === 0, errs.slice(0,2).join(' | '));
    await ctx.close();
  }
  await b.close();
  say(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
