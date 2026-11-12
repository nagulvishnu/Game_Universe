import { expect, test } from '@playwright/test';

async function boot(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.waitForFunction(() => !!(window as any).__game?.zone);
}

test('combat, quests, extraction and shadow commands work', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await boot(page);
  await page.waitForFunction(
    () =>
      ((window as any).__game.enemies as any[]).filter((enemy) => enemy.def.key === 'goblin' && !enemy.dead).length >=
      2,
    undefined,
    { timeout: 10_000 }
  );

  await page.evaluate(() => {
    const game = (window as any).__game;
    const goblin = game.enemies.find((enemy: any) => enemy.def.key === 'goblin' && !enemy.dead);
    game.P.pos.set(goblin.pos.x + 1.2, 0, goblin.pos.z);
    game.P.invuln = 10;
    game.P.hp = game.derived.maxHp;
    (window as any).__goblinId = goblin.id;
    (window as any).__hpBefore = goblin.hp;
  });

  for (let hit = 0; hit < 4; hit++) {
    await page.keyboard.press('k');
    await page.waitForTimeout(380);
  }
  const goblinState = await page.evaluate(() => {
    const game = (window as any).__game;
    const goblin = game.enemies.find((enemy: any) => enemy.id === (window as any).__goblinId);
    return { hp: goblin ? goblin.hp : 0, max: (window as any).__hpBefore as number, dead: goblin ? goblin.dead : true };
  });
  expect(goblinState.hp).toBeLessThan(goblinState.max);

  await page.keyboard.press('Control');
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => (window as any).__game.P.invuln)).toBeGreaterThan(0);

  await page.evaluate(() => {
    const game = (window as any).__game;
    const target = game.spawn('goblin', game.P.pos.x + 4, game.P.pos.z, { aggro: true });
    game.P.invuln = 10;
    (window as any).__lockTarget = target.id;
  });
  await page.mouse.click(640, 360, { button: 'right' });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !!((window as any).__game as any).lock)).toBe(true);

  const hpBefore = await page.evaluate(() => {
    const game = (window as any).__game;
    game.P.invuln = 0;
    game.P.hp = game.derived.maxHp;
    const enemy = game.spawn('goblin', game.P.pos.x + 1.4, game.P.pos.z, { aggro: true });
    enemy.state = 'chase';
    return game.P.hp;
  });
  await page.waitForTimeout(2400);
  expect(await page.evaluate(() => (window as any).__game.P.hp)).toBeLessThan(hpBefore);

  await page.evaluate(() => {
    const game = (window as any).__game;
    for (const enemy of game.enemies) {
      if (!enemy.dead) (window as any).__hit(game, enemy, 9999, {});
    }
  });
  await page.waitForTimeout(300);
  const quest = await page.evaluate(() => {
    const save = (window as any).__store.getState().save;
    return { state: save.quests.q_gate?.state, chapter: save.chapter };
  });
  expect(quest.state).toBe('done');
  expect(quest.chapter).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => {
    const game = (window as any).__game;
    const store = (window as any).__store.getState();
    store.setFlag('necro');
    store.addItem('mp_potion', 5);
    game.P.mp = game.derived.maxMp;
    game.derived.extractBonus = 5;
    const corpse = game.spawn('goblin', game.P.pos.x + 2, game.P.pos.z, {});
    (window as any).__hit(game, corpse, 9999, {});
    game.P.pos.set(corpse.pos.x + 1, 0, corpse.pos.z);
    (window as any).__origRandom = Math.random;
    Math.random = () => 0.01;
  });
  await page.keyboard.press('e');
  // Extraction runs in slow motion, so wait for the result rather than a fixed delay.
  await page.waitForFunction(() => (window as any).__store.getState().save.shadows.length > 0, undefined, {
    timeout: 15_000,
  });
  await page.evaluate(() => {
    Math.random = (window as any).__origRandom;
  });
  const army = await page.evaluate(() => {
    const game = (window as any).__game;
    const save = (window as any).__store.getState().save;
    return { shadows: save.shadows.length, allies: game.allies.length };
  });
  expect(army.shadows).toBeGreaterThan(0);
  expect(army.allies).toBeGreaterThan(0);

  await page.keyboard.press('2');
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => (window as any).__game.cmd)).toBe('attack');

  await page.evaluate(() => (window as any).__game.travel('double'));
  await page.waitForFunction(() => (window as any).__game.zone.id === 'double', undefined, { timeout: 8_000 });
  expect(pageErrors).toEqual([]);
});

test('boss phases trigger at health thresholds', async ({ page }) => {
  await boot(page);
  const phases = await page.evaluate(async () => {
    const game = (window as any).__game;
    const hit = (window as any).__hit;
    game.P.invuln = 999;
    game.P.hp = game.derived.maxHp;
    const boss = game.spawn('igris', game.P.pos.x + 20, game.P.pos.z, {});
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    hit(game, boss, 2000, {});
    await wait(1300);
    const second = boss.phase;
    hit(game, boss, 700, {});
    await wait(1300);
    const third = boss.phase;
    return { second, third, dead: boss.dead };
  });
  expect(phases.dead).toBe(false);
  expect(phases.second).toBe(2);
  expect(phases.third).toBe(3);
});

test('manual save survives a reload through Continue', async ({ page }) => {
  await boot(page);
  const savedGold = await page.evaluate(async () => {
    const store = (window as any).__store.getState();
    store.addGold(500);
    await store.persist('manual');
    return (window as any).__store.getState().save.gold;
  });
  await page.reload();
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await expect(continueButton).toBeEnabled({ timeout: 8_000 });
  await continueButton.click();
  await page.waitForFunction(() => !!(window as any).__game?.zone);
  expect(await page.evaluate(() => (window as any).__store.getState().save.gold)).toBe(savedGold);
  expect(await page.evaluate(() => (window as any).__store.getState().save.v)).toBe(2);
});

test('all story zones load through the travel system', async ({ page }) => {
  await boot(page);
  for (const zone of ['double', 'venom', 'job', 'raid', 'penalty', 'seoul']) {
    await page.waitForFunction(() => !(window as any).__game.trans, undefined, { timeout: 8_000 });
    await page.evaluate((target) => (window as any).__game.travel(target), zone);
    await page.waitForFunction((target) => (window as any).__game.zone.id === target, zone, { timeout: 10_000 });
    await page.evaluate(() => {
      const game = (window as any).__game;
      if (game.cine) game.skipCine();
    });
  }
  expect(await page.evaluate(() => (window as any).__game.zone.id)).toBe('seoul');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('renders touch controls and starts an attack', async ({ page }) => {
    await boot(page);
    const attack = page.locator('.tbtn', { hasText: 'ATK' });
    await expect(attack).toBeVisible();
    await expect(page.locator('.tbtn', { hasText: 'DODGE' })).toBeVisible();
    await attack.tap();
    await page.waitForFunction(() => !!(window as any).__game.P.atk, undefined, { timeout: 3_000 });
  });
});
