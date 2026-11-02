import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
await page.goto('file://' + process.cwd() + '/dist/index.html');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/00_start.png' });
await page.click('text=Play film');
await page.waitForTimeout(2500);
const jumps = JSON.parse(process.env.JUMPS || '[[1,14,"village"]]');
for (const [idx, sim, name] of jumps) {
  await page.evaluate(([i, s]) => { const f = window.__film; f.jump(i); for (let k = 0; k < s * 10; k++) f.update(0.1); }, [idx, sim]);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `shots/${name}.png` });
  const info = await page.evaluate(() => { const f = window.__film; return { scene: f.scene?.id, beat: f.beatIdx, shot: f.shot.k, caption: f.caption?.text?.slice(0, 40), status: f.status }; });
  console.log(name, JSON.stringify(info));
}
console.log('ERRORS', errors.length); errors.slice(0, 12).forEach((e) => console.log(e));
await browser.close();
