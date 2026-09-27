/* WHAT IS THE WHITE BLOCK ON THE BACK OF THE SHORTS?
   Prints the sprite's hip band as characters, one per pixel, for the
   facings that show it and the one that does not, with a legend of the
   colours involved -- because naming the colour names the code. */
const { chromium } = require('playwright-core');
const who = process.argv[2] || 'lumi';
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport:{width:900,height:600} });
  p.on('pageerror', e=>console.log('ERR '+e.message));
  await p.route('**/*', r=>r.request().url().startsWith('http://127.0.0.1')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(400);
  await p.addScriptTag({ url:'cup.config.js' });
  await p.addScriptTag({ url:'cup.sprites.js' });
  await p.waitForFunction(()=>!!window.CupSprites && !!window.CUP_CONFIG,{timeout:20000});
  await p.evaluate((f)=>{ window.__faces = f; }, (process.argv[3]||'s,e').split(','));
  console.log(await p.evaluate((id)=>{
    const look = window.CUP_CONFIG.ROSTER.filter(r=>r.id===id)[0];
    const team = window.CUP_CONFIG.TEAMS.filter(t=>(t.squad||[]).indexOf(id)>=0)[0];
    const kit = team ? (look.role==='gk'?team.gkKit:team.kit) : null;
    const at = window.CupSprites.bake(look, kit);
    const S = at.size, g = at.canvas.getContext('2d');
    let out = 'kit ' + JSON.stringify(kit) + '\n';
    const legend = new Map(); const keys = 'abcdefghijklmnopqrstuvwxyz';
    const show = (face) => {
      const uv = at.uv('idle', face, 0);
      const d = g.getImageData(uv.col*S, uv.row*S, S, S).data;
      let rows = [];
      for (let y = 0; y < S; y++) {
        let line = '', lit = 0;
        for (let x = 0; x < S; x++) {
          const i = (y*S+x)*4;
          if (d[i+3] < 8) { line += '.'; continue; }
          lit++;
          const hex = '#' + [d[i],d[i+1],d[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');
          if (!legend.has(hex)) legend.set(hex, keys[legend.size % 26]);
          line += legend.get(hex);
        }
        if (lit) rows.push(String(y).padStart(2) + ' ' + line);
      }
      out += '\n--- ' + face + '\n' + rows.join('\n') + '\n';
    };
    (window.__faces||['s','e']).forEach(show);
    out += '\nlegend: ' + [...legend].map(([h,k])=>k+'='+h).join(' ');
    return out;
  }, who));
  await b.close();
})();
