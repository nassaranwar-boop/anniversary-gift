/* THE BOOK, MEASURED RATHER THAN EYEBALLED.

   "Some pages don't look quite right" is true and hard to act on, so this
   turns each page into numbers you can compare down a column: how much of
   the page is actually used, where its weight sits, whether a quadrant is
   empty, how big the photographs are relative to each other, and how many
   stickers are crowding in.

   Foreground and background are counted separately on purpose. A paper
   patch covering half the page is texture, not content — counting it as
   ink makes an empty page look full.

   Usage:  node pageaudit.js
*/
const { chromium } = require('playwright-core');

const bar = (v, max, width) => {
  const n = Math.max(0, Math.min(width, Math.round((v / max) * width)));
  return '#'.repeat(n) + '.'.repeat(width - n);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 760 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1')
    ? r.continue() : r.abort());
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { showScreen('scrapbook'); if (window.startDioramas) startDioramas(); });
  await page.waitForTimeout(4000);

  /* Only the open spread has a real box; every other page measures zero,
     so stage each one at a known size before measuring it. Same trick as
     pageshots.js, and for the same reason. */
  await page.evaluate(() => {
    const s = document.getElementById('screen-scrapbook');
    s.classList.add('sb-open');
    const intro = document.getElementById('sb-intro');
    if (intro) intro.style.display = 'none';
    const stage = document.createElement('div');
    stage.id = '__stage';
    stage.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:640px;z-index:99999;overflow:hidden;';
    document.body.appendChild(stage);
    window.__pages = [...document.querySelectorAll('.sb-page')];
  });

  const pages = await page.evaluate(() => {
    const KIND = (cls) => {
      if (/sb-patch/.test(cls)) return 'patch';
      if (/sb-photo|sb-booth|sb-film|sb-instant|sb-idcard|sb-videocard/.test(cls)) return 'photo';
      if (/sb-sticker|sb-img|sb-burst|sb-bouquet/.test(cls)) return 'sticker';
      return 'type';
    };
    const out = [];
    const stage = document.getElementById('__stage');
    window.__pages.forEach((src, pi) => {
      if (src.classList.contains('sb-page-cover') || src.classList.contains('sb-page-back')) return;
      stage.innerHTML = '';
      const pg = src.cloneNode(true);
      pg.style.cssText += ';position:absolute;left:0;top:0;width:480px;height:640px;' +
        'transform:none;opacity:1;visibility:visible;display:flex;';
      stage.appendChild(pg);
      const pr = pg.getBoundingClientRect();
      if (pr.width < 5) return;
      const pieces = [...pg.children].map(c => {
        const r = c.getBoundingClientRect();
        return {
          kind: KIND(c.className),
          x: (r.x - pr.x) / pr.width * 100, y: (r.y - pr.y) / pr.height * 100,
          w: r.width / pr.width * 100, h: r.height / pr.height * 100,
        };
      }).filter(p => p.w > 0.4 && p.h > 0.4);

      /* raster the foreground onto a 48x64 grid: coverage, balance, and
         which quadrants are carrying nothing */
      const GX = 48, GY = 64;
      const grid = new Uint8Array(GX * GY);
      let sx = 0, sy = 0, sw = 0;
      pieces.filter(p => p.kind !== 'patch').forEach(p => {
        const a = p.w * p.h;
        sx += (p.x + p.w / 2) * a; sy += (p.y + p.h / 2) * a; sw += a;
        for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
          const cx = (gx + 0.5) / GX * 100, cy = (gy + 0.5) / GY * 100;
          if (cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h) grid[gy * GX + gx] = 1;
        }
      });
      const filled = grid.reduce((a, b) => a + b, 0);
      const quad = [0, 0, 0, 0];
      for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
        if (!grid[gy * GX + gx]) continue;
        quad[(gy < GY / 2 ? 0 : 2) + (gx < GX / 2 ? 0 : 1)]++;
      }
      const qmax = (GX / 2) * (GY / 2);
      const photos = pieces.filter(p => p.kind === 'photo').map(p => +p.w.toFixed(1)).sort((a, b) => a - b);
      const bleed = pieces.filter(p => p.kind !== 'patch' &&
        (p.x < -3 || p.y < -3 || p.x + p.w > 103 || p.y + p.h > 103)).length;

      out.push({
        page: pi,
        coverage: +(filled / (GX * GY) * 100).toFixed(1),
        cx: sw ? +(sx / sw).toFixed(1) : 50,
        cy: sw ? +(sy / sw).toFixed(1) : 50,
        quads: quad.map(q => +(q / qmax * 100).toFixed(0)),
        photos, bleed,
        n: { photo: pieces.filter(p => p.kind === 'photo').length,
             sticker: pieces.filter(p => p.kind === 'sticker').length,
             type: pieces.filter(p => p.kind === 'type').length,
             patch: pieces.filter(p => p.kind === 'patch').length },
      });
    });
    return out;
  });

  console.log('page  cover  balance      quadrants(TL TR BL BR)   ph st ty  photo widths');
  console.log('-'.repeat(96));
  pages.forEach((p, i) => {
    const off = Math.round(Math.hypot(p.cx - 50, p.cy - 50));
    console.log(
      String(i + 1).padStart(4) +
      String(p.coverage).padStart(6) + '%' +
      ('  ' + p.cx + ',' + p.cy).padEnd(11) +
      ('off' + off).padEnd(6) +
      p.quads.map(q => String(q).padStart(4)).join('') + '   ' +
      String(p.n.photo).padStart(2) + String(p.n.sticker).padStart(3) + String(p.n.type).padStart(3) + '  ' +
      (p.photos.length ? p.photos.join(' ') : '-') +
      (p.bleed ? '   bleed:' + p.bleed : ''));
  });

  const cov = pages.map(p => p.coverage);
  const allPh = pages.flatMap(p => p.photos);
  console.log('-'.repeat(96));
  console.log('coverage   min ' + Math.min(...cov) + '%  max ' + Math.max(...cov) +
              '%  spread ' + (Math.max(...cov) - Math.min(...cov)).toFixed(1) + ' points');
  console.log('photo size min ' + Math.min(...allPh) + '%  max ' + Math.max(...allPh) +
              '%  ratio ' + (Math.max(...allPh) / Math.min(...allPh)).toFixed(1) + 'x');
  console.log('\nempty quadrants (under 12% filled):');
  const names = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  pages.forEach((p, i) => p.quads.forEach((q, qi) => {
    if (q < 12) console.log('   page ' + (i + 1) + '  ' + names[qi] + '  ' + q + '%');
  }));
  await browser.close();
})();
