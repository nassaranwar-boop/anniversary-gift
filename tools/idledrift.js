const { chromium } = require('playwright-core'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox','--no-proxy-server','--disable-gpu','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport:{width:1366,height:892}, deviceScaleFactor:1 });
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const cdp = await p.context().newCDPSession(p);
  await p.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  for (const t of [2500,4000,6000,9000,13000,18000]) {
    await p.waitForTimeout(t === 2500 ? 2500 : 0);
    if (t !== 2500) await p.waitForTimeout(0);
    const cam = await p.evaluate(()=>({ fov: window.__BOOKCAM ? window.__BOOKCAM.fov : null }));
    const { data } = await cdp.send('Page.captureScreenshot', { format:'png' });
    fs.writeFileSync('/tmp/drift.png', Buffer.from(data,'base64'));
    const { execSync } = require('child_process');
    const out = execSync(`python3 -c "
import numpy as np
from PIL import Image
im=Image.open('/tmp/drift.png').convert('RGB'); w,h=im.size
a=np.asarray(im,dtype=np.int16); col=a[:,w//2,:]
g=col[:,1]-(col[:,0].astype(int)+col[:,2])//2
gi=np.where(g>22)[0]
R,G,B=a[:,:,0],a[:,:,1],a[:,:,2]
bk=(R-B>38)&(R>90)&(R-G>12)
ys,xs=np.where(bk)
print('%.2f %.1f %.1f' % (gi.min()/h*100, (xs.max()-xs.min())/w*100, (ys.max()-ys.min())/h*100))
"`).toString().trim();
    console.log('t~'+t+'ms  horizon% bookW% bookH% =', out, ' fov', cam.fov);
    if (t !== 18000) await p.waitForTimeout(t===2500?1500:3000);
  }
  await b.close();
})();
