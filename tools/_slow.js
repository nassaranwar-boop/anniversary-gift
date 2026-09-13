const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--use-gl=swiftshader","--enable-unsafe-swiftshader"] });
  const ti = +(process.argv[2] || 1);
  const ctx = await b.newContext({ viewport:{width:1280,height:800} });
  await ctx.route("**/*", r => r.request().url().startsWith("http://127.0.0.1")?r.continue():r.abort());
  const p = await ctx.newPage();
  p.on("pageerror", e => console.log("ERR", String(e).slice(0,140)));
  await p.goto("http://127.0.0.1:8899/index.html",{waitUntil:"domcontentloaded",timeout:60000});
  await p.waitForTimeout(1500);
  await p.evaluate(()=>{ showScreen("hub"); if(window.startHub) startHub(); });
  await p.waitForTimeout(700);
  await p.evaluate(()=>{ const e=document.getElementById("hub-card-race"); if(e) e.click(); });
  await p.waitForTimeout(9000);
  const click = async (s) => { await p.evaluate((q)=>{ const t=[...document.querySelectorAll("button")].find(x=>x.matches(q)); if(t) t.click(); }, s); await p.waitForTimeout(600); };
  await click('[data-go="single"]'); await click('[data-char="0"]'); await click('[data-next="chars"]');
  await click(`[data-track="${ti}"]`); await click('[data-next="tracks"]');
  await p.waitForTimeout(7000);
  const out = await p.evaluate(()=>{
    const d = window.__RACE_DEBUG();
    d.racers.forEach(x => { x.isPlayer = false; });
    const log = [];
    for (let s=0; s<120; s++){
      for (let i=0;i<60;i++) d.step(1/60);
      const rs = window.__RACE_DEBUG().racers;
      log.push(rs.map(x => `${x.takesCut?"C":"."}${x.offroad?"O":"."}${(x.lap+x.along).toFixed(2)}@${x.speed.toFixed(1)}`).join(" "));
    }
    return { name:d.trackDef.name, log };
  });
  console.log(out.name);
  out.log.forEach((l,i)=>{ if(i%12===0) console.log(String(i).padStart(3), l); });
  await b.close();
})();
