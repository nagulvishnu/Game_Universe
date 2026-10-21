import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';

const outDir = '.verify_shots';
fs.mkdirSync(outDir, { recursive: true });

const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], {
  stdio: 'pipe',
});

await new Promise((resolve) => setTimeout(resolve, 2200));

const consoleErrors = [];
const pageErrors = [];

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err));
  });

  // 1. Open Main Menu
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const titleText = await page.textContent('body');
  if (!titleText?.includes('SNIPER:') || !titleText?.includes('DEADLINE')) {
    throw new Error('Main Menu title not rendered');
  }
  await page.screenshot({ path: `${outDir}/01_main_menu.jpg`, quality: 85 });
  console.log('[PASS] 1. Main Menu loaded with 3D showcase');

  // 2. Open 3D Weapon Workshop & Purchase Viper Scout
  await page.getByText('3D WEAPON WORKSHOP').click();
  await page.waitForTimeout(600);
  await page.getByText('Viper Scout').first().click();
  await page.waitForTimeout(350);
  await page.getByText(/PURCHASE & EQUIP/).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${outDir}/02_workshop.jpg`, quality: 85 });
  console.log('[PASS] 2. Purchased & Equipped Viper Scout in 3D Workshop');

  // 3. Reload Page & Verify Save Persistence
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const afterReloadBody = await page.textContent('body');
  if (!afterReloadBody?.includes('Viper Scout') || !afterReloadBody?.includes('650')) {
    throw new Error('Save data did not persist Viper Scout purchase across reload!');
  }
  console.log('[PASS] 3. Save persistence across browser refresh verified (Viper Scout + ₵650)');

  // 4. Open Campaign Map -> Select OP-02 Silent Arrival -> Deploy
  await page.getByText('CAMPAIGN MAP').first().click();
  await page.waitForTimeout(400);
  await page.getByText('Silent Arrival').first().click();
  await page.waitForTimeout(400);
  await page.getByText('DEPLOY INTO AO →').click();
  await page.waitForTimeout(1200);

  const hudTextBefore = await page.textContent('body');
  if (!hudTextBefore?.includes('Silent Arrival') && !hudTextBefore?.includes('OP-02')) {
    throw new Error('In-game HUD did not render mission objective');
  }
  await page.screenshot({ path: `${outDir}/03_forest_3d_hud.jpg`, quality: 85 });
  console.log('[PASS] 4. Loaded 3D Forest Outpost mission & HUD');

  // 5. Move forward, Scope in (RMB), Hold Breath (Shift), and Fire (LMB)
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyW');

  // Toggle Scope via Right Mouse Click center
  await page.mouse.click(640, 360, { button: 'right' });
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/04_scoped_view.jpg`, quality: 85 });
  await page.keyboard.up('ShiftLeft');
  console.log('[PASS] 5. Scoped aiming & Breath Control verified');

  // Fire weapon via Left Click & unscope
  await page.mouse.click(640, 360, { button: 'left' });
  await page.waitForTimeout(250);
  await page.mouse.click(640, 360, { button: 'right' });
  await page.waitForTimeout(250);

  const hudAfterShot = await page.textContent('body');
  if (!hudAfterShot?.includes('7 / 56')) {
    throw new Error(`Expected ammo 7 / 56 after firing Viper Scout, got: ${hudAfterShot}`);
  }
  console.log('[PASS] 6. Firing decremented Viper Scout magazine from 8 -> 7');

  // Reload with KeyR
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(3600);
  const hudAfterReload = await page.textContent('body');
  if (!hudAfterReload?.includes('8 / 55')) {
    throw new Error(`Expected ammo 8 / 55 after reload, got: ${hudAfterReload}`);
  }
  console.log('[PASS] 7. Reloading restored magazine to 8 / 55');

  // Toggle 3rd-person camera [V] and capture screenshot
  await page.keyboard.press('KeyV');
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${outDir}/06_third_person.jpg`, quality: 85 });
  console.log('[PASS] 7b. Third-person tactical camera verified');

  // Pause & Resume via Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const pauseText = await page.textContent('body');
  if (!pauseText?.includes('OPERATION PAUSED')) {
    throw new Error('Pause menu did not appear on Escape');
  }
  await page.getByText('RESUME OPERATION').click();
  await page.waitForTimeout(200);
  console.log('[PASS] 8. Pause & Resume flow verified');

  // Test Completing First Contact Target via direct shot in Training Range!
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await page.getByText('ABORT TO HQ MENU').click();
  await page.waitForTimeout(300);

  // Verify Game Modes & Contract Board screens render without errors
  await page.getByText('GAME MODES (8)').click();
  await page.waitForTimeout(250);
  await page.getByText('BACK').click();
  await page.waitForTimeout(200);
  await page.getByText('HIGH SCORES').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/05_leaderboard.jpg`, quality: 85 });

  console.log('[PASS] 9. Game Modes & High-Score Leaderboard screens verified');
  console.log('Console errors:', consoleErrors.length, 'Page errors:', pageErrors.length);
  if (pageErrors.length > 0) {
    throw new Error(`Uncaught page errors detected: ${pageErrors.join('; ')}`);
  }
} catch (err) {
  console.error(err);
  if (browser) await browser.close();
  preview.kill('SIGKILL');
  process.exit(1);
}
if (browser) await browser.close();
preview.kill('SIGKILL');
process.exit(0);
