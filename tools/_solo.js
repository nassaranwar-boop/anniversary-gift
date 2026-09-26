const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--no-proxy-server','--disable-gpu'] });
  const p = await b.newPage();
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(500);
  await p.evaluate(() => new Promise(res => { const s=document.createElement('script'); s.src='cup.config.js'; s.onload=res; document.head.appendChild(s); }));
  console.log(await p.evaluate(async () => {
    const out = [];
    const names = ['ALL','ambience','pulse','hum','chant','band','drums','lead','pad','peaks'];
    for (const solo of names) {
      const rate = 22050, secs = 4;
      const off = new OfflineAudioContext(2, rate*secs, rate);
      await new Promise((res, rej) => { const s=document.createElement('script');
        s.src='cup.chant.js?s='+Math.random(); s.onload=res; s.onerror=rej; document.head.appendChild(s); });
      window.__CHANT_BYPASS = 1;
      window.CupChant.init(off, off.destination, { volume: 1 });
      window.CupChant.setTeam(window.CUP_CONFIG.TEAMS.filter(t=>t.id==='fmpm')[0].anthem);
      window.CupChant.__render(secs, 0.92);
      if (solo !== 'ALL') {
        const L = window.CupChant.__layers ? window.CupChant.__layers() : null;
        if (L) Object.keys(L).forEach(k => { if (k !== solo) { L[k].gain.cancelScheduledValues(0); L[k].gain.setValueAtTime(0, 0); } });
      }
      const buf = await off.startRendering();
      const d = buf.getChannelData(0);
      let s2 = 0, pk = 0;
      for (let i = 0; i < d.length; i++) { s2 += d[i]*d[i]; if (Math.abs(d[i]) > pk) pk = Math.abs(d[i]); }
      out.push(solo.padEnd(10) + ' rms ' + (1000*Math.sqrt(s2/d.length)).toFixed(0).padStart(5) + '   peak ' + pk.toFixed(3));
    }
    return out.join('\n');
  }));
  await b.close(); process.exit(0);
})();
