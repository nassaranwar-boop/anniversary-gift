/* DOES THE GROUND ACTUALLY REACT?
 *
 * A layered chant is a claim about a mixer, and a mixer is the kind of
 * thing that sounds fine in a description and does nothing in code. You
 * cannot listen to it from here, but you can read the faders: at each
 * energy the five layers should be at particular places, and the order
 * they arrive in is the whole design — ambience always, then the clap,
 * then the hum, then the full voice, and the full voice should ARRIVE
 * rather than creep.
 *
 * It also checks the one trick that matters: the super's wind-up has to
 * duck everything to almost nothing, and the strike has to let it back.
 * A held breath that does not actually go quiet is just a noise.
 *
 *   node tools/cupchant.js
 */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
const ok = (msg, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} showScreen('hub'); startHub(); });
  await p.waitForTimeout(250);
  await p.click('#hub-card-cup');
  await p.waitForFunction(() => window.OuissyCup && OuissyCup.__cup.state() !== null, { timeout: 60000 });
  await p.waitForTimeout(600);

  ok('the chant engine loaded', await p.evaluate(() => !!window.CupChant));

  /* the audio context needs a gesture, and a harness has to make one */
  await p.mouse.click(480, 400);
  await p.evaluate(() => {
    const H = OuissyCup.__cup;
    H.quick(0); H.auto(true);
    for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
  });
  await p.waitForTimeout(500);

  /* HOLD the ground at each energy: the match writes the value sixty
     times a second and would simply overwrite anything set here. */
  const at = (e) => p.evaluate((ee) => {
    OuissyCup.__cup.energy(ee);
    return new Promise(r => setTimeout(() => r(window.CupChant.debug()), 1100));
  }, e);

  const d0 = await at(0.0);
  ok('the engine is running with an anthem', !!(d0 && d0.anthem), d0);
  if (d0 && d0.anthem) {
    console.log('   anthem: key ' + d0.anthem.key + 'Hz  ' + d0.anthem.tempo
                + 'bpm  ' + d0.anthem.mood);
  }

  const lo = await at(0.05);
  const mid = await at(0.45);
  const hi = await at(0.75);
  const max = await at(1.0);
  const row = (n, d) => '   ' + n.padEnd(6) + '  amb ' + d.layers.ambience.toFixed(3)
    + '  pulse ' + d.layers.pulse.toFixed(3) + '  hum ' + d.layers.hum.toFixed(3)
    + '  chant ' + d.layers.chant.toFixed(3);
  console.log(row('quiet', lo)); console.log(row('mid', mid));
  console.log(row('high', hi)); console.log(row('full', max));
  console.log('');

  ok('ambience is on even at nothing', lo.layers.ambience > 0.005, lo.layers);
  ok('the clap is not, at nothing', lo.layers.pulse < 0.01, lo.layers);
  ok('the full chant is not, at nothing', lo.layers.chant < 0.01, lo.layers);
  ok('the clap comes in before the chant does',
     mid.layers.pulse > 0.05 && mid.layers.chant < 0.01, mid.layers);
  ok('the hum comes in before the chant does',
     mid.layers.hum > 0.02 && mid.layers.chant < 0.01, mid.layers);
  ok('the full chant arrives high up', hi.layers.chant > 0.05, hi.layers);
  /* AMBIENCE IS A TEXTURE, NOT AN INSTRUMENT, and this used to demand
     it be louder than 0.03 — which was the level at which a bed of
     filtered noise was the loudest continuous thing in the graph. With
     the whole mix forty decibels too quiet and the renderer
     normalising it back up, that noise was most of what anybody heard.
     It belongs well under the drums, and this now says so. */
  ok('and everything is up at full', max.layers.chant > 0.2
     && max.layers.pulse > 0.15 && max.layers.ambience > 0.008, max.layers);
  ok('the drums are the loudest thing in the mix, as they are in the street',
     max.layers.drums > max.layers.ambience * 8, max.layers);
  ok('every layer only ever goes up with energy',
     max.layers.pulse >= hi.layers.pulse && hi.layers.pulse >= mid.layers.pulse
     && max.layers.chant >= hi.layers.chant, [mid.layers, hi.layers, max.layers]);

  /* THE HELD BREATH, which is the point of the whole thing */
  const held = await p.evaluate(() => {
    OuissyCup.__cup.energy(0.9);
    window.CupChant.event('superWind');
    return new Promise(r => setTimeout(() => r(window.CupChant.debug()), 700));
  });
  console.log(row('breath', held) + '   duck ' + held.duck);
  ok('the wind-up ducks the ground to a breath',
     held.duck === 1 && held.layers.chant < 0.02 && held.layers.pulse < 0.02, held.layers);

  const after = await p.evaluate(() => {
    window.CupChant.event('superHit');
    return new Promise(r => setTimeout(() => r(window.CupChant.debug()), 900));
  });
  console.log(row('release', after) + '   duck ' + after.duck);
  ok('and the strike lets it back', after.duck === 0 && after.layers.chant > 0.1, after.layers);

  /* two grounds, two songs */
  const songs = await p.evaluate(() => {
    const H = OuissyCup.__cup;
    const out = [];
    H.teams().forEach(t => { if (t.anthem) out.push([t.short, t.anthem.key, t.anthem.tempo, t.anthem.mood]); });
    return out;
  });
  songs.forEach(s2 => console.log('   ' + s2[0].padEnd(6) + ' ' + s2[1] + 'Hz  '
    + s2[2] + 'bpm  ' + s2[3]));
  ok('every team has its own song', songs.length === 6, songs.length);
  ok('and no two share a key and tempo',
     new Set(songs.map(s2 => s2[1] + '/' + s2[2])).size === songs.length, songs);

  /* =======================================================================
     THREE ROUNDS, THREE DIFFERENT SONGS

     Six tracks are worth writing only if more than one of them is ever
     heard. The chant used to take its anthem from G.ids[0], which is
     always HER side — so the same piece played at every ground for a
     whole cup run and the other five existed only in the config.
     ======================================================================= */
  const heard = [];
  for (let round = 0; round < 3; round++) {
    const d = await p.evaluate((r) => {
      const H = OuissyCup.__cup;
      H.quick(r); H.auto(true);
      for (let i = 0; i < 400 && H.state().state !== 'play'; i++) H.step(1, 0, 0, false);
      return new Promise(res => setTimeout(() => res(H.chant()), 500));
    }, round);
    heard.push(d && d.anthem ? d.anthem : null);
    console.log('   round ' + (round + 1) + ': '
      + (d && d.anthem ? d.anthem.key + 'Hz  ' + d.anthem.tempo + 'bpm  ' + d.anthem.mood
         : 'nothing'));
  }
  ok('every round has a song', heard.every(Boolean), heard);
  ok('and no two rounds are the same song',
     new Set(heard.map(h => h && (h.key + '/' + h.tempo))).size === heard.length, heard);

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
