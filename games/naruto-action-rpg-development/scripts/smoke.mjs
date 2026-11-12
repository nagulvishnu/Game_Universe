import { chromium } from 'playwright';
import path from 'path';
const url = 'file://' + path.resolve('dist/index.html');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 400)); });
await page.goto(url); await page.waitForTimeout(800);
await page.getByText('New Game').click(); await page.waitForTimeout(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);
const clear = () => ev(() => { const g = window.__game; g.useGame.getState().setOverlay(null); g.useGame.setState({ dialogue: null }); });
await clear();
await ev(() => window.__game.useGame.getState().updateSettings({ graphics: 'low' })); await page.waitForTimeout(1500);
console.log('fps', await ev(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) r(n / 2); else requestAnimationFrame(f); }; f(); })));
// Ch1 flow via NPC interaction
await ev(() => { const g = window.__game; g.rt.player.pos.x = -35; g.rt.player.pos.z = -5; g.bus.emit('interact', { kind: 'npc', id: 'iruka' }); });
await page.waitForTimeout(500);
console.log('dialogue', await ev(() => { const s = window.__game.useGame.getState(); return [s.overlay, s.dialogue && s.dialogue.lines.length]; }));
for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(700); }
await page.screenshot({ path: 'shot_choice.png' });
await page.getByText(/Accept:/).click(); await page.waitForTimeout(800);
console.log('mission', await ev(() => { const g = window.__game; return [g.rt.mission && g.rt.mission.id, g.rt.enemies.map((e) => e.def.id), g.useGame.getState().overlay]; }));
await clear();
// kill dummies
await ev(() => { const g = window.__game; g.rt.enemies.forEach((e) => g.combat.hitEnemy(e, { power: 99 })); });
await page.waitForTimeout(600);
console.log('stage after dummies', await ev(() => { const g = window.__game; return [g.rt.mission.stage, g.useGame.getState().overlay]; }));
await clear();
await ev(() => window.__game.bus.emit('mission', { t: 'ability', id: 'clone' })); await page.waitForTimeout(500); await clear();
await ev(() => { const g = window.__game; g.rt.player.pos.x = -40; g.rt.player.pos.z = -20; g.rt.player.pos.y = 7; g.bus.emit('mission', { t: 'pos', x: -40, y: 7, z: -20 }); }); await page.waitForTimeout(500); await clear();
console.log('stage roof', await ev(() => window.__game.rt.mission && window.__game.rt.mission.stage));
await ev(() => { const g = window.__game; g.rt.player.pos.x = -35; g.rt.player.pos.z = -6; g.rt.player.pos.y = 0; g.bus.emit('interact', { kind: 'npc', id: 'iruka' }); });
await page.waitForTimeout(400);
for (let i = 0; i < 5; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(500); }
await page.waitForTimeout(1500); for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(500); }
console.log('ch1 done', await ev(() => { const s = window.__game.useGame.getState(); return [s.profile.completed, s.profile.flags, s.profile.chars.naruto.level, s.profile.ryo, s.overlay]; }));
await clear();
// ch3 boss fight
await ev(() => { const g = window.__game; g.useGame.getState().patchProfile((p) => ({ completed: ['ch1_academy', 'ch2_team7'], chars: { ...p.chars, naruto: { ...p.chars.naruto, level: 8 } } })); g.bus.emit('statsChanged'); g.rt.player.pos.x = -222; g.rt.player.pos.z = 0; });
await ev(() => window.__game.missions.startMission('ch3_waves')); await clear();
await ev(() => { const g = window.__game; g.rt.mission.stage = 3; g.rt.mission.progress = [0]; g.bus.emit('mission', { t: 'pos', x: -222, y: 0, z: 0 }); }); await page.waitForTimeout(600); await clear();
await page.waitForTimeout(5000);
await ev(() => { const g = window.__game; g.rt.player.stats.maxHp = 99999; g.rt.player.hp = 99999; });
for (let i = 0; i < 40; i++) { await ev(() => { const g = window.__game; const b = g.rt.boss; if (b) { g.rt.player.pos.x = b.pos.x + 3; g.rt.player.pos.z = b.pos.z; } g.rt.player.hp = 99999; }); await page.mouse.click(320, 180); await page.waitForTimeout(300); }
console.log('boss status', await ev(() => { const g = window.__game; const b = g.rt.boss; return b && [b.state, Math.round(b.hp), b.phase, b.pattern && b.pattern.id, g.rt.telegraphs.length]; }));
await page.screenshot({ path: 'shot_boss.png' });
await ev(() => { const g = window.__game; g.combat.hitEnemy(g.rt.boss, { power: 99999, noUlt: true }); }); await page.waitForTimeout(6000);
for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(600); }
console.log('after boss', await ev(() => { const g = window.__game; const s = g.useGame.getState(); return [s.overlay, g.rt.mission && g.rt.mission.stage, s.profile.bossesDefeated]; }));
await ev(() => { const g = window.__game; g.rt.player.pos.x = -200; g.rt.player.pos.z = 0; }); await clear();
await ev(() => window.__game.bus.emit('interact', { kind: 'npc', id: 'tazuna' }));
// tazuna not an npc; emit talk directly
await ev(() => window.__game.bus.emit('mission', { t: 'talk', npc: 'tazuna' })); await page.waitForTimeout(1500);
for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(600); }
console.log('ch3', await ev(() => { const s = window.__game.useGame.getState(); return [s.profile.completed, s.profile.unlocked, s.overlay, window.__game.rt.mission]; }));
await clear();
console.log('save', await ev(() => window.__game.saveGame('slot1')));
await ev(() => window.__game.useGame.getState().setOverlay('map')); await page.waitForTimeout(600); await page.screenshot({ path: 'shot_map.png' });
await ev(() => window.__game.useGame.getState().setOverlay('skills')); await page.waitForTimeout(600); await page.screenshot({ path: 'shot_skills.png' });
await ev(() => window.__game.useGame.getState().setOverlay('inventory')); await page.waitForTimeout(600);
await ev(() => window.__game.useGame.getState().setOverlay('missions')); await page.waitForTimeout(600); await page.screenshot({ path: 'shot_missions.png' });
await ev(() => window.__game.useGame.getState().setOverlay('status')); await page.waitForTimeout(600);
await ev(() => window.__game.useGame.getState().setOverlay('characters')); await page.waitForTimeout(600);
await ev(() => window.__game.useGame.getState().openShop('Test', ['ramen'])); await page.waitForTimeout(600);
// reload & continue
await page.reload(); await page.waitForTimeout(1200);
await page.getByText(/Continue/).click(); await page.waitForTimeout(2500);
console.log('continued', await ev(() => { const s = window.__game.useGame.getState(); return [s.screen, s.profile.completed, s.profile.chars.naruto.level]; }));
console.log('errors', errors.length); console.log(errors.slice(0, 12).join('\n---\n'));
await browser.close();
