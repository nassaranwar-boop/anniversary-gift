/* DOES THE SITE ASK TWICE?

   The tracker in index.html reads a GPS fix. It used to ask for it on
   every open and every reopen -- getGPS() calls watchPosition(), and
   watchPosition() on a browser in the "prompt" state IS the permission
   dialog -- so a refresh was a fresh interrogation, and somebody who
   had already said no was shown the "Location is off" pill, with its
   instructions unfolded, every single visit.

   This plays three visitors, each in a browser of their own, each
   loading the page three times, and counts every call the page makes
   into the geolocation API and every appearance of the pill.

     she allows it   asked once, never again, no pill, ever
     she blocks it   never asked at all after that, and the pop-up is
                     gone for good
     she ignores it  asked once. The pill may be offered once. Neither
                     happens a second time.

   A real Deny cannot be clicked from a test -- it is a browser dialog,
   not part of the page -- so it is set through the same switch the
   browser's own settings use. clearPermissions() is NOT that: it
   leaves the state at "prompt", which is the third visitor, not the
   second. */
const { chromium } = require('playwright-core');
const ORIGIN = 'http://127.0.0.1:8899';
let pass = 0, fail = 0;
const t = (n, c, note) => { c ? pass++ : fail++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${note !== undefined ? '   ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

  /* one browser context per visitor, so localStorage survives the
     reloads the way it does for a real person */
  const run = async (label, how) => {
    /* The blocked visitor needs the browser's own switch thrown, and
       Browser.setPermission is a browser-level command: sent down a
       page session belonging to a fresh context it lands nowhere, which
       is how the first version of this check "blocked" somebody who was
       in fact only unasked. So she gets the default context and a
       browser-level session, with her storage wiped first so nothing
       carries over from the visitor before her. */
    const ctx = how === 'block' ? b.contexts()[0] || await b.newContext()
                                : await b.newContext({ viewport: { width: 420, height: 800 } });
    await ctx.setGeolocation({ latitude: 31.63, longitude: -7.99 });
    if (how === 'allow') await ctx.grantPermissions(['geolocation'], { origin: ORIGIN });
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 420, height: 800 });
    if (how === 'block') {
      await p.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
      const s = await b.newBrowserCDPSession();
      await s.send('Browser.setPermission', {
        permission: { name: 'geolocation' }, setting: 'denied', origin: ORIGIN });
    }
    await p.route('**/*', (r) => {
      const u = r.request().url();
      /* the worker and the beacon are never really posted to */
      if (u.indexOf('workers.dev') >= 0 || u.indexOf('cloudflareinsights') >= 0)
        return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return u.startsWith(ORIGIN) ? r.continue() : r.abort(); });

    /* count what the page asks the browser for, before any of it runs */
    await p.addInitScript(() => {
      window.__geoCalls = 0;
      window.__pillEver = false;
      const g = navigator.geolocation;
      if (g) ['getCurrentPosition', 'watchPosition'].forEach((m) => {
        const orig = g[m].bind(g);
        g[m] = function (...a) { window.__geoCalls++; return orig(...a); };
      });
      /* the pill can come and go between samples, so watch for it */
      addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => {
          if (document.getElementById('visit-loc-help')) window.__pillEver = true;
        }).observe(document.body, { childList: true, subtree: true });
      });
    });

    const loads = [];
    for (let i = 0; i < 3; i++) {
      await p.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      /* getGPS refines for ten seconds before it resolves, so the answer
         is not written down until after that. Wait for it to settle
         rather than guessing a number; a visitor who is never asked
         never writes anything new, so the wait is allowed to lapse. */
      await p.waitForFunction(() => {
        try { const v = localStorage.getItem('visit_geo_choice');
              return v === 'granted' || v === 'denied'; } catch (e) { return false; }
      }, { timeout: 15000, polling: 250 }).catch(() => {});
      await p.waitForTimeout(1500);
      loads.push(await p.evaluate(async () => ({
        calls: window.__geoCalls,
        pill: window.__pillEver,
        stored: (() => { try { return localStorage.getItem('visit_geo_choice'); } catch (e) { return '?'; } })(),
        /* what the BROWSER says, not what the test hoped it set. The
           first version of this check never read it back and so could
           not tell a real block from a visitor who simply never
           answered -- which is why it reported a pass it had not
           earned, and then a failure that was its own. */
        state: await (async () => {
          try { return (await navigator.permissions.query({ name: 'geolocation' })).state; }
          catch (e) { return 'unsupported'; }
        })()
      })));
    }
    if (how !== 'block') await ctx.close(); else await p.close();
    console.log(`\n--- ${label}: ` + JSON.stringify(loads));
    return loads;
  };

  const a = await run('she allows it', 'allow');
  t('allowed: the browser is asked on the first load and not again',
    a[0].calls >= 1 && a[1].calls === 0 && a[2].calls === 0,
    'calls per load: ' + a.map((l) => l.calls).join(', '));
  t('allowed: and the pill is never shown', !a.some((l) => l.pill), 'never');
  t('allowed: and her yes is written down', a[2].stored === 'granted', a[2].stored);

  const d = await run('she blocks it', 'block');
  t('blocked: the browser really is reporting a block',
    d.every((l) => l.state === 'denied'), 'states: ' + d.map((l) => l.state).join(', '));
  t('blocked: geolocation is never called at all',
    d.every((l) => l.calls === 0), 'calls per load: ' + d.map((l) => l.calls).join(', '));
  t('blocked: and the "Location is off" pop-up never appears',
    !d.some((l) => l.pill), 'never');
  t('blocked: and her no is written down', d[2].stored === 'denied', d[2].stored);

  const i = await run('she ignores it', 'ignore');
  t('ignored: asked once, and then left alone',
    i[0].calls >= 1 && i[1].calls === 0 && i[2].calls === 0,
    'calls per load: ' + i.map((l) => l.calls).join(', '));
  t('ignored: and the pill is offered once, not on every visit',
    !i[1].pill && !i[2].pill, 'first load only');
  t('ignored: and being asked is itself written down',
    !!i[2].stored, i[2].stored);

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
