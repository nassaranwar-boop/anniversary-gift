/* The Long Way Round, checked as a graph rather than by eye.
 *
 * The bug this exists for: two nodes reached from ordinary choices had no
 * way onward — hvRender returned early on them and drew an overlay with a
 * Restart button instead. Nothing in the old suites looked at the story
 * graph at all, so both sat on the live site through several passes.
 *
 * Asserts: every node is reachable from the title, every node offers a way
 * out, all four routes are walkable end to end, the four routes are
 * distinct in the scenes they use, and the two endings are different.
 */
const { chromium } = require('playwright-core');
const out = [];
const ok = (n, c, x) => out.push((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '   ' + x : ''));

const ROUTES = {
  'left-blue':  ['BEGIN','#card0','THE WAY THERE','BLUE','KEEP UP','TRY THE OTHER WAY','HOLD VERY STILL','ON UP','GO ON','OVER THE GATE','already?','Mhm!','open it','lean in','YES!'],
  'left-red':   ['BEGIN','#card1','THE WAY THERE','RED','ALONG THE BANK','ONE AT A TIME','DOWNSTREAM','WHERE IT COMES OUT','GO ON','OVER THE GATE','already?','Mhm!','open it','lean in','YES!'],
  'right-blue': ['BEGIN','#card0','THE WAY BACK','GO ON','BLUE','KEEP CLIMBING','OVER THE TOP','FIRST SECTION, SLOWLY','STEADY. KEEP GOING','DOWN THE FAR SIDE','HOME','KEEP GOING','inside?','open it','lean in','YES!'],
  'right-red':  ['BEGIN','#card1','THE WAY BACK','GO ON','RED','DOWN THE ROW','WAIT FOR IT TO MOVE','ON THROUGH','ON TO THE PATH','HOME','KEEP GOING','inside?','open it','lean in','YES!'],
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { showScreen('quest'); startQuest(); });
  await page.waitForTimeout(400);

  /* ---- the graph, walked without touching the DOM ---- */
  const g = await page.evaluate(() => {
    const exits = n => (n.choices || []).concat(n.cards || []).map(c => c.to);
    const seen = new Set(), stack = ['title'], dead = [], scenes = {};
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id) || id === '__exit') continue;
      seen.add(id);
      const n = HV[id];
      if (!n) { dead.push(id + ' (no such node)'); continue; }
      scenes[id] = n.scene;
      const e = exits(n);
      if (!e.length) dead.push(id + ' (no way out)');
      e.forEach(t => stack.push(t));
    }
    return {
      reachable: [...seen],
      all: Object.keys(HV),
      dead,
      scenes,
      overlay: !!document.getElementById('hv-fail'),
      flagged: Object.keys(HV).filter(k => HV[k].isFail),
      ends: Object.keys(HV).filter(k => HV[k].isEnd),
      questions: [QUEST_FINAL.question, QUEST_FINAL.questionBack],
    };
  });

  ok('every node is reachable from the title',
     g.all.every(k => g.reachable.includes(k)),
     g.all.filter(k => !g.reachable.includes(k)).join(',') || '');
  ok('no node is a dead end', g.dead.length === 0, g.dead.join('; '));
  ok('no node is still flagged isFail', g.flagged.length === 0, g.flagged.join(','));
  ok('the full-screen fail overlay is gone', !g.overlay);
  ok('there are exactly two endings', g.ends.length === 2, g.ends.join(','));
  ok('neither closing question is a placeholder',
     g.questions.every(q => q && !/^\[|\]$/.test(q.trim())), g.questions.join(' / '));

  /* ---- the four routes, clicked the way a person would ---- */
  const walked = {};
  for (const [label, steps] of Object.entries(ROUTES)) {
    await page.evaluate(() => { startQuest(); });
    await page.waitForTimeout(250);
    const seen = [];
    let broke = null;
    for (const want of steps) {
      seen.push(await page.evaluate(() => hvNode));
      const hit = await page.evaluate(w => {
        if (w.startsWith('#card')) {
          const el = document.querySelectorAll('#hv-cards .hv-card')[+w.slice(5)];
          if (!el) return 'no cards on screen'; el.click(); return true;
        }
        const b = [...document.querySelectorAll('.hv-btn')].find(x => x.textContent.trim() === w);
        if (!b) return 'no button "' + w + '" (saw: ' + [...document.querySelectorAll('.hv-btn')].map(x => x.textContent.trim()).join(' | ') + ')';
        b.click(); return true;
      }, want);
      if (hit !== true) { broke = 'at ' + seen[seen.length - 1] + ': ' + hit; break; }
      await page.waitForTimeout(120);
    }
    seen.push(await page.evaluate(() => hvNode));
    walked[label] = seen;
    ok(label + ' walks from the title to an ending', !broke && seen[seen.length - 1].endsWith('yay'), broke || seen[seen.length - 1]);
  }

  /* ---- and are actually four different journeys ----
     A route's own nodes are the ones strictly between the butterfly choice
     and the join. The butterfly node and the join are shared on purpose —
     that is what "two routes, one ending per path" means — so counting
     them as route nodes would report the design as a bug. */
  const mid = l => {
    const w = walked[l];
    const from = w.findIndex(n => n === 'there' || n === 'back');
    const to = w.findIndex(n => n.endsWith('_join'));
    return w.slice(from + 1, to);
  };
  const pairs = [['left-blue','left-red'],['right-blue','right-red'],['left-blue','right-blue'],['left-red','right-red']];
  pairs.forEach(([a, b]) => {
    const shared = mid(a).filter(n => mid(b).includes(n));
    ok(a + ' and ' + b + ' share no route nodes', shared.length === 0, shared.join(','));
  });
  const sceneOf = l => [...new Set(mid(l).map(n => g.scenes[n]))].sort().join('+');
  ok('all four routes use different scenery',
     new Set(['left-blue','left-red','right-blue','right-red'].map(sceneOf)).size === 4,
     ['left-blue','left-red','right-blue','right-red'].map(l => l + '=' + sceneOf(l)).join('  '));

  const endLeft = walked['left-blue'].at(-1), endRight = walked['right-blue'].at(-1);
  ok('the two paths reach different endings', endLeft !== endRight, endLeft + ' vs ' + endRight);
  ok('both routes on a path reach that path\'s ending',
     walked['left-blue'].at(-1) === walked['left-red'].at(-1) &&
     walked['right-blue'].at(-1) === walked['right-red'].at(-1));
  ok('no page errors through all four routes', errors.length === 0, errors[0] || '');

  console.log(out.join('\n'));
  console.log('\n' + Object.entries(walked).map(([k, v]) => k + ': ' + v.join(' -> ')).join('\n'));
  await browser.close();
  process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
})();
