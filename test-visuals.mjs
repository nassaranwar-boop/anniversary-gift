import { chromium } from 'playwright';

const OUT = '/home/user/anniversary-gift';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server'],
});
const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', err => { errors.push(err.message); console.log('PAGE ERROR:', err.message); });

await page.goto('http://localhost:3456/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3000);

// Start apocalypse
await page.evaluate(() => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-apoc').classList.add('active');
  window.Apocalypse.start();
});
await page.waitForTimeout(2000);

// Helper to take screenshot
async function shot(name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false, timeout: 15000 });
  console.log(`  -> ${name}.png`);
}

// 1. HOME level (level 0)
console.log('HOME:');
await page.evaluate(() => { window.__apEnter(0); window.__apPump(0.5); });
await page.waitForTimeout(1000);
await shot('vis-home');

// 2. STREETS (level 1) - shadows + rain + puddles
console.log('STREETS:');
await page.evaluate(() => { window.__apEnter(1); window.__apPump(0.5); });
await page.waitForTimeout(1500);
await shot('vis-streets-spawn');

// Walk to see torch beam and shadows
await page.evaluate(() => { window.__apTeleport(12, 8); window.__apPump(0.5); });
await page.waitForTimeout(800);
await shot('vis-streets-mid');

// Near buildings for AO and detail
await page.evaluate(() => { window.__apTeleport(8, 5); window.__apPump(0.3); });
await page.waitForTimeout(600);
await shot('vis-streets-buildings');

// 3. HOSPITAL (level 2) - indoor shadows + AO
console.log('HOSPITAL:');
await page.evaluate(() => { window.__apEnter(2); window.__apPump(0.5); });
await page.waitForTimeout(1500);
await shot('vis-hospital');

// 4. ROAD (level 3) - rain + outdoor lighting
console.log('ROAD:');
await page.evaluate(() => { window.__apEnter(3); window.__apPump(0.5); });
await page.waitForTimeout(1500);
await shot('vis-road');

// Road skyline
await page.evaluate(() => { window.__apTeleport(14, 2); window.__apPump(0.3); });
await page.waitForTimeout(600);
await shot('vis-road-sky');

// 5. CAMPSITE submap
console.log('CAMPSITE:');
await page.evaluate(() => { window.__apCampsite && window.__apCampsite(); });
await page.waitForTimeout(1500);
await shot('vis-campsite');

// 6. GATES (level 4)
console.log('GATES:');
await page.evaluate(() => { window.__apEnter(4); window.__apPump(0.5); });
await page.waitForTimeout(1500);
await shot('vis-gates');

console.log('\nErrors:', errors.length ? errors.join('; ') : 'None');
await browser.close();
