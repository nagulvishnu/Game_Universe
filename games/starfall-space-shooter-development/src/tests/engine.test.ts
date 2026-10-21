import { describe, it, expect } from 'vitest';
import { applyDamage, shieldRegen, homeVelocity, bossPhase, missionRating, levelFromXp, upgradeCost, validateSave, defaultSave, type HealthState } from '../game/engine';

const hp = (hull: number, shield: number, armor = 0): HealthState => ({ hull, maxHull: 100, shield, maxShield: 50, armor });

describe('damage & shield calculations', () => {
  it('shields absorb damage first', () => {
    const r = applyDamage(hp(100, 50), 30);
    expect(r.next.shield).toBe(20);
    expect(r.next.hull).toBe(100);
    expect(r.killed).toBe(false);
  });
  it('overflow damage passes to hull', () => {
    const r = applyDamage(hp(100, 10), 40);
    expect(r.next.shield).toBe(0);
    expect(r.next.hull).toBe(70);
  });
  it('shield multiplier makes anti-shield weapons stronger vs shields', () => {
    const r = applyDamage(hp(100, 50), 20, 3, 0.4);
    expect(r.next.shield).toBe(0); // 20 * 3 = 60 shield damage
    expect(r.next.hull).toBeLessThan(100);
  });
  it('armor reduces hull damage with chip floor of 1', () => {
    const r = applyDamage(hp(100, 0, 25), 10);
    expect(r.next.hull).toBe(99);
  });
  it('lethal damage sets killed and clamps hull at 0', () => {
    const r = applyDamage(hp(20, 0), 500);
    expect(r.next.hull).toBe(0);
    expect(r.killed).toBe(true);
  });
  it('zero damage changes nothing', () => {
    const r = applyDamage(hp(100, 50), 0);
    expect(r.next.hull).toBe(100);
    expect(r.next.shield).toBe(50);
  });
  it('shield regen respects cap and delay flag', () => {
    expect(shieldRegen(hp(50, 40), 1, 20, true).shield).toBe(50);
    expect(shieldRegen(hp(50, 40), 1, 20, false).shield).toBe(40);
    expect(shieldRegen(hp(0, 0), 1, 20, true).shield).toBe(0);
  });
});

describe('missile homing', () => {
  it('steers velocity toward the target', () => {
    const v = homeVelocity([0, 0, 0], [100, 0, 0], [0, 0, -100], 100, 3, 0.1);
    expect(v[2]).toBeLessThan(0); // turning toward -Z target
    expect(Math.hypot(...v)).toBeCloseTo(100, 5); // speed preserved
  });
  it('converges on target direction over multiple steps', () => {
    let pos: [number, number, number] = [0, 0, 0];
    let vel: [number, number, number] = [0, 0, 150];
    const target: [number, number, number] = [60, 20, -200];
    let minD = Infinity;
    for (let i = 0; i < 360; i++) {
      vel = homeVelocity(pos, vel, target, 150, 3.2, 1 / 60);
      pos = [pos[0] + vel[0] / 60, pos[1] + vel[1] / 60, pos[2] + vel[2] / 60];
      minD = Math.min(minD, Math.hypot(target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]));
    }
    expect(minD).toBeLessThan(12); // missile starting facing AWAY still turns and reaches target
  });
});

describe('boss phases', () => {
  it('maps hull fraction to phases with correct thresholds', () => {
    expect(bossPhase(1)).toBe(1);
    expect(bossPhase(0.67)).toBe(1);
    expect(bossPhase(0.66)).toBe(2);
    expect(bossPhase(0.5)).toBe(2);
    expect(bossPhase(0.33)).toBe(3);
    expect(bossPhase(0.05)).toBe(3);
  });
});

describe('mission rating', () => {
  it('rewards hull-preservation, kills and accuracy', () => {
    const good = missionRating(1, 120, 20, 0.8);
    const bad = missionRating(0.1, 600, 4, 0.2);
    expect(good.points).toBeGreaterThan(bad.points);
    expect(['S', 'A', 'B']).toContain(good.grade);
  });
  it('never returns negative points', () => {
    expect(missionRating(0, 99999, 0, 0).points).toBeGreaterThanOrEqual(0);
  });
});

describe('progression math', () => {
  it('level curve increases monotonically', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(5000).level).toBeGreaterThan(5);
  });
  it('upgrade costs scale up per level', () => {
    expect(upgradeCost(350, 0)).toBe(350);
    expect(upgradeCost(350, 2)).toBeGreaterThan(upgradeCost(350, 1));
  });
});

describe('save validation & corruption recovery', () => {
  it('round-trips a valid save', () => {
    const s = { ...defaultSave(), credits: 7777, selectedShip: 'aegis' };
    const v = validateSave(JSON.parse(JSON.stringify(s)));
    expect(v.credits).toBe(7777);
    expect(v.selectedShip).toBe('aegis');
  });
  it('falls back to defaults for garbage input', () => {
    const d = defaultSave();
    expect(validateSave(null)).toEqual(d);
    expect(validateSave('not an object')).toEqual(d);
    expect(validateSave({ credits: 'lots' }).credits).toBe(d.credits);
    expect(validateSave({ credits: -5 }).credits).toBe(d.credits);
  });
  it('sanitizes arrays and preserves valid fields', () => {
    const v = validateSave({ ownedShips: ['viper', 42, 'nova'], credits: 100 });
    expect(v.ownedShips).toEqual(['viper', 'nova']);
    expect(v.credits).toBe(100);
  });
  it('always stamps the current schema version', () => {
    expect(validateSave({ version: 999 }).version).toBe(defaultSave().version);
  });
});
