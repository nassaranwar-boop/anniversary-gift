const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 500 } });
  await ctx.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith("http://127.0.0.1") || u.includes("fonts.googleapis.com") || u.includes("fonts.gstatic.com"))
      return r.continue();
    return r.abort();
  });
  const p = await ctx.newPage();
  const seen = [];
  p.on("response", (r) => { if (/fonts\.(googleapis|gstatic)/.test(r.url())) seen.push(r.status() + " " + r.url().slice(0, 70)); });
  await p.goto("http://127.0.0.1:8899/index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(6000);
  const got = await p.evaluate(async () => {
    await document.fonts.ready;
    const out = [];
    for (const f of document.fonts) out.push(f.family + " " + f.status);
    return { n: document.fonts.size, list: [...new Set(out)].slice(0, 20),
             check: document.fonts.check("16px 'Press Start 2P'") };
  });
  console.log("requests:", seen.length ? seen.join("\n  ") : "NONE");
  console.log(JSON.stringify(got, null, 1));
  await ctx.close(); await b.close();
})();
