import { describe, it, expect } from 'vitest';
import { applyDamage, shieldRegen, homeVelocity, bossPhase, missionRating, levelFromXp, upgradeCost, validateSave, defaultSave, sanitizeSettings, DEFAULT_SETTINGS, chargeCap, chargeShot, resolveObjective, type HealthState, type ObjectiveState } from '../game/engine';
import { SHIPS, WEAPONS, MISSIONS, UPGRADES } from '../data/gameData';

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

describe('save validation against live content', () => {
  it('drops ships and weapons that no longer exist', () => {
    const v = validateSave({ ownedShips: ['viper', 'ghost-ship'], ownedWeapons: ['pulse', 'laser-of-doom'] });
    expect(v.ownedShips).toEqual(['viper']);
    expect(v.ownedWeapons).toEqual(['pulse']);
  });
  it('falls back to a known ship when the selected ship is unknown', () => {
    const v = validateSave({ selectedShip: 'deleted-ship' });
    expect(SHIPS.some(s => s.id === v.selectedShip)).toBe(true);
    expect(v.selectedShip).toBe(defaultSave().selectedShip);
  });
  it('never equips a weapon the pilot does not own', () => {
    const v = validateSave({ ownedWeapons: ['pulse'], primaryId: 'railgun' });
    expect(v.primaryId).toBe('pulse');
    expect(v.ownedWeapons).toContain(v.primaryId);
  });
  it('never equips a weapon from the wrong slot', () => {
    const v = validateSave({ ownedWeapons: ['pulse', 'seeker'], primaryId: 'seeker' });
    const primary = WEAPONS.find(w => w.id === v.primaryId)!;
    expect(primary.slot).toBe('primary');
  });
  it('clamps upgrade levels to their maximum and ignores unknown upgrades', () => {
    const maxLevel = UPGRADES[0].max;
    const v = validateSave({ upgrades: { [UPGRADES[0].id]: 9999, 'not-an-upgrade': 5 } });
    expect(v.upgrades[UPGRADES[0].id]).toBe(maxLevel);
    expect(v.upgrades['not-an-upgrade']).toBeUndefined();
  });
  it('drops unknown mission ids and unknown achievements', () => {
    const v = validateSave({ completedMissions: [1, 999], missionRatings: { 1: 'S', 999: 'S' }, achievements: ['kills100', 'made-up'] });
    expect(v.completedMissions).toEqual([1]);
    expect(v.missionRatings[999]).toBeUndefined();
    expect(v.achievements).toEqual(['kills100']);
    expect(MISSIONS.some(m => m.id === 1)).toBe(true);
  });
  it('keeps stats numeric and rejects unknown stat keys', () => {
    const v = validateSave({ stats: { totalKills: 42, bogus: 9, playTime: 'lots' } });
    expect(v.stats.totalKills).toBe(42);
    expect(v.stats.bogus).toBeUndefined();
    expect(v.stats.playTime).toBe(defaultSave().stats.playTime);
  });
});

describe('mission objectives', () => {
  const st = (over: Partial<ObjectiveState> = {}): ObjectiveState => ({
    t: 0, kills: 0, asteroidsDestroyed: 0, wave: 0,
    waveState: 'pending', alive: 0, bossAlive: false, bossQueueLeft: 0, inCombat: true,
    ...over,
  });

  it('spawns the first wave of a destroy mission', () => {
    const cfg = { kind: 'quick', type: 'destroy', killTarget: 0, timeLimit: 0, waves: 3 };
    expect(resolveObjective(cfg, st())).toBe('next-wave');
  });

  it('wins a fixed-wave mission once the last wave is cleared', () => {
    const cfg = { kind: 'quick', type: 'destroy', killTarget: 0, timeLimit: 0, waves: 3 };
    expect(resolveObjective(cfg, st({ wave: 3, waveState: 'active', alive: 0 }))).toBe('win');
  });

  it('brings in the boss after the escort waves are cleared', () => {
    const cfg = { kind: 'campaign', type: 'boss', killTarget: 8, timeLimit: 0, waves: 2, bossId: 'devourer' };
    expect(resolveObjective(cfg, st({ wave: 2, waveState: 'active', alive: 0 }))).toBe('spawn-boss');
  });

  it('never starts a new wave while a boss is alive', () => {
    const cfg = { kind: 'campaign', type: 'boss', killTarget: 8, timeLimit: 0, waves: 2, bossId: 'devourer' };
    expect(resolveObjective(cfg, st({ wave: 1, waveState: 'active', alive: 0, bossAlive: true }))).toBe('continue');
  });

  it('keeps sending waves in endless modes', () => {
    const cfg = { kind: 'survival', type: 'destroy', killTarget: 0, timeLimit: 0, waves: 999 };
    expect(resolveObjective(cfg, st({ wave: 40, waveState: 'active', alive: 0 }))).toBe('next-wave');
  });

  it('wins the boss rush when the queue is empty', () => {
    const cfg = { kind: 'bossrush', type: 'boss', killTarget: 0, timeLimit: 0, waves: 0 };
    expect(resolveObjective(cfg, st({ waveState: 'pending', bossQueueLeft: 0 }))).toBe('win');
    expect(resolveObjective(cfg, st({ waveState: 'pending', bossQueueLeft: 3 }))).toBe('spawn-boss');
  });

  // ── the soft-lock regression ──
  it('resolves a timed survival mission when the clock expires', () => {
    const cfg = { kind: 'campaign', type: 'survival-time', killTarget: 16, timeLimit: 150, waves: 4 };
    // clock expired, target met → win
    expect(resolveObjective(cfg, st({ t: 150, kills: 16, wave: 5, waveState: 'active', alive: 0 }))).toBe('win');
    // clock expired, target NOT met → must fail, never hang
    expect(resolveObjective(cfg, st({ t: 151, kills: 9, wave: 5, waveState: 'active', alive: 0 }))).toBe('lose-timeout');
  });

  it('resolves a timed survival mission even while enemies are still alive', () => {
    const cfg = { kind: 'campaign', type: 'survival-time', killTarget: 16, timeLimit: 150, waves: 4 };
    expect(resolveObjective(cfg, st({ t: 160, kills: 4, wave: 5, waveState: 'active', alive: 7 }))).toBe('lose-timeout');
    expect(resolveObjective(cfg, st({ t: 160, kills: 20, wave: 5, waveState: 'active', alive: 7 }))).toBe('win');
  });

  it('keeps spawning waves in a timed survival mission until the clock runs out', () => {
    const cfg = { kind: 'campaign', type: 'survival-time', killTarget: 16, timeLimit: 150, waves: 4 };
    expect(resolveObjective(cfg, st({ t: 20, wave: 5, waveState: 'active', alive: 0 }))).toBe('next-wave');
  });

  it('fails a time attack that runs out of time', () => {
    const cfg = { kind: 'timeattack', type: 'destroy', killTarget: 30, timeLimit: 180, waves: 999 };
    expect(resolveObjective(cfg, st({ t: 181, kills: 12 }))).toBe('lose-timeout');
    expect(resolveObjective(cfg, st({ t: 100, kills: 30 }))).toBe('win');
  });

  it('gives every shipped mission a path to a terminal state', () => {
    // No mission kind may be able to sit in 'continue' forever with nothing left to do.
    for (const m of MISSIONS) {
      const cfg = { kind: 'campaign', type: m.type, killTarget: m.killTarget, timeLimit: m.timeLimit, waves: m.waves, bossId: m.bossId };
      const outcomes = new Set<string>();
      for (let t = 0; t <= 400; t += 5) {
        for (const wave of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
          outcomes.add(resolveObjective(cfg, st({ t, wave, waveState: 'active', alive: 0 })));
          outcomes.add(resolveObjective(cfg, st({ t, wave, waveState: 'active', alive: 5 })));
        }
        outcomes.add(resolveObjective(cfg, st({ t, wave: 0, waveState: 'pending' })));
      }
      const terminal = ['win', 'lose-timeout', 'spawn-boss'];
      expect(terminal.some(o => outcomes.has(o))).toBe(true);
    }
  });
});

describe('charge weapons', () => {
  const railgun = { damage: 150, energyCost: 30 };

  it('caps the charge by the energy the pilot can actually pay for', () => {
    expect(chargeCap(4, 30)).toBeCloseTo(4 / 30, 6);
    expect(chargeCap(1000, 30)).toBe(1);
    expect(chargeCap(0, 30)).toBe(0);
  });

  it('never lets a full-power shot be released for a fraction of its cost', () => {
    // 4 energy can only ever buy 4/30 of a shot — and only that much damage.
    const cap = chargeCap(4, 30);
    const shot = chargeShot(railgun, cap);
    expect(shot.energyCost).toBeLessThanOrEqual(4 + 1e-9);
    expect(shot.damage).toBeLessThan(railgun.damage * 0.2);
  });

  it('scales damage and cost linearly with the charge', () => {
    const half = chargeShot(railgun, 0.5);
    const full = chargeShot(railgun, 1);
    expect(half.damage).toBeCloseTo(full.damage / 2, 6);
    expect(half.energyCost).toBeCloseTo(full.energyCost / 2, 6);
  });

  it('keeps damage-per-energy constant across charge levels (no cheap-shot exploit)', () => {
    const ratio = (c: number) => {
      const s = chargeShot(railgun, c);
      return s.damage / s.energyCost;
    };
    expect(ratio(0.15)).toBeCloseTo(ratio(1), 6);
    expect(ratio(0.5)).toBeCloseTo(ratio(1), 6);
  });

  it('clamps out-of-range charges', () => {
    expect(chargeShot(railgun, -3).damage).toBe(0);
    expect(chargeShot(railgun, 9).damage).toBeCloseTo(chargeShot(railgun, 1).damage, 6);
  });
});

describe('settings validation', () => {
  it('falls back to defaults for garbage input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });
  it('clamps volumes into 0..1', () => {
    const s = sanitizeSettings({ masterVol: 5, musicVol: -2, sfxVol: 0.5 });
    expect(s.masterVol).toBe(1);
    expect(s.musicVol).toBe(0);
    expect(s.sfxVol).toBe(0.5);
  });
  it('rejects non-numeric volumes so the audio graph never sees NaN', () => {
    const s = sanitizeSettings({ masterVol: 'loud', uiVol: NaN });
    expect(Number.isFinite(s.masterVol)).toBe(true);
    expect(Number.isFinite(s.uiVol)).toBe(true);
    expect(s.masterVol).toBe(DEFAULT_SETTINGS.masterVol);
  });
  it('rejects an unknown quality preset', () => {
    expect(sanitizeSettings({ quality: 'ultra' }).quality).toBe(DEFAULT_SETTINGS.quality);
    expect(sanitizeSettings({ quality: 'low' }).quality).toBe('low');
  });
  it('keeps booleans as booleans', () => {
    expect(sanitizeSettings({ invertY: 'yes' }).invertY).toBe(DEFAULT_SETTINGS.invertY);
    expect(sanitizeSettings({ invertY: true }).invertY).toBe(true);
  });
});
