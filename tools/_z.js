const { boot, driver } = require('./_aplib');
(async () => {
  const { browser, page } = await boot();
  const D = driver(page);
  await D.enter(3); await D.talk(3);
  await D.at('C'); await D.talk(6); await D.pump(2);
  console.log(JSON.stringify(await page.evaluate(() => {
    const b = document.getElementById('ap-pause-btn');
    const r = b.getBoundingClientRect();
    const stack = document.elementsFromPoint(r.left + r.width/2, r.top + r.height/2)
      .slice(0, 6).map(e => (e.id || e.className || e.tagName) + ' z=' + getComputedStyle(e).zIndex
        + ' pe=' + getComputedStyle(e).pointerEvents);
    return { btn: { z: getComputedStyle(b).zIndex, rect: [Math.round(r.left), Math.round(r.top)] }, stack };
  }), null, 1));
  await browser.close(); process.exit(0);
})();
