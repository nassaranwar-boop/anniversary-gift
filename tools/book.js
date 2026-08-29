/* The book: the song swap, the empty-frame notes, the cover, the gate. */
const { chromium } = require('playwright-core');
const R=[]; const ok=(n,c,x)=>R.push((c?'PASS  ':'FAIL  ')+n+(x?'   '+x:''));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try{localStorage.clear();}catch(e){} showScreen('scrapbook'); if(window.Scrapbook) Scrapbook.start(); });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const s = document.getElementById('screen-scrapbook');
    s.classList.add('sb-intro-out','sb-open');
    const i = document.getElementById('sb-intro'); if (i) i.style.display='none';
  });
  await page.waitForTimeout(1200);

  // ---- item 4: the song ----
  await page.evaluate(() => { const b=document.getElementById('sb-extras-btn'); if (b) b.click(); });
  await page.waitForTimeout(1400);
  const vid = await page.evaluate(() => {
    const c = document.querySelector('.sb-w-video');
    if (!c) return null;
    return { title: c.querySelector('.sb-vid-title').textContent.trim(),
             artist: c.querySelector('.sb-vid-artist').textContent.trim(),
             kicker: c.querySelector('.sb-vid-kicker').textContent.trim(),
             thumb: c.querySelector('.sb-vid-thumb').getAttribute('src') };
  });
  ok('the drawer plays Raindance by Dave and Tems',
     vid && vid.title === 'Raindance' && /Dave/.test(vid.artist) && /Tems/.test(vid.artist),
     vid ? vid.title + ' — ' + vid.artist : 'card missing');
  ok('and it points at the right video', vid && /SOJpE1KMUbo/.test(vid.thumb), vid && vid.thumb);
  ok('the card keeps its original layout', vid && vid.kicker === 'MUSIC VIDEO', vid && vid.kicker);
  await page.evaluate(() => { const b=document.getElementById('sb-extras-btn'); if (b) b.click(); });
  await page.waitForTimeout(900);

  // ---- item 5: the empty-frame notes ----
  const seen = [];
  for (let i = 0; i < 6; i++) {
    /* Any frame: the images are lazy, so an off-screen one has not
       errored yet and carries no .sb-photo-empty to filter on. The
       lightbox is the path she actually takes regardless. */
    const clicked = await page.evaluate((idx) => {
      const ps = Array.from(document.querySelectorAll('.sb-photo'));
      if (!ps[idx]) return false;
      ps[idx].click(); return true;
    }, i);
    if (!clicked) break;
    await page.waitForTimeout(450);
    const t = await page.evaluate(() => {
      const b = document.getElementById('sb-lightbox');
      return b && b.classList.contains('on') ? b.querySelector('.sb-lb-text').textContent.trim() : null;
    });
    if (t) seen.push(t);
    await page.evaluate(() => { if (window.Scrapbook) Scrapbook.closeLightbox(); });
    await page.waitForTimeout(350);
  }
  ok('opening an empty frame gives her a note', seen.length >= 3, 'read ' + seen.length + ' frames');
  ok('and never the file-naming instructions',
     !seen.some(t => /assets\/photo|\.jpg|Save this one/i.test(t)),
     seen[0] ? '"' + seen[0] + '"' : '');
  ok('the notes vary between frames', new Set(seen).size === seen.length,
     seen.length + ' frames, ' + new Set(seen).size + ' distinct');

  console.log(R.join('\n'));
  seen.slice(0,4).forEach(t => console.log('     · ' + t));
  console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'no page errors');
  await browser.close();
  process.exit(R.some(r=>r.startsWith('FAIL')) ? 1 : 0);
})();
