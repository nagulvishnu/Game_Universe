import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __game?: {
      zone?: { id: string; name: string };
      P: { pos: { x: number; z: number } };
      running: boolean;
    };
    __store?: {
      getState: () => {
        panel: string;
        screen: string;
        hasSave: boolean;
        persist: (slot?: string) => Promise<void>;
      };
    };
  }
}

test('boots, starts a new game, moves, opens panels and saves', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible();
  await page.getByRole('button', { name: 'New Game' }).click();

  await page.waitForFunction(() => !!window.__game?.zone);
  await expect(page.getByText('SUNG JIN-WOO').first()).toBeVisible();

  const start = await page.evaluate(() => ({ x: window.__game!.P.pos.x, z: window.__game!.P.pos.z }));
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  const moved = await page.evaluate((origin) => {
    const game = window.__game!;
    return Math.hypot(game.P.pos.x - origin.x, game.P.pos.z - origin.z);
  }, start);
  expect(typeof start.x).toBe('number');
  expect(moved).toBeGreaterThan(0.05);

  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__store?.getState().panel === 'status');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__store?.getState().panel === 'none');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__store?.getState().screen === 'paused');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__store?.getState().screen === 'playing');

  await page.evaluate(async () => {
    await window.__store!.getState().persist('manual');
  });
  expect(await page.evaluate(() => window.__store!.getState().hasSave)).toBe(true);

  expect(pageErrors).toEqual([]);
});
