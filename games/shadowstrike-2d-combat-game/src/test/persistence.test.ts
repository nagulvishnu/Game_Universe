import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultSave, sanitize, migrate, loadSave, writeSave, clearSave, levelFromXp, xpForLevel, SAVE_KEY,
} from '../save/save';
import { ACHIEVEMENTS } from '../data/achievements';

describe('save system', () => {
  beforeEach(() => { localStorage.clear(); });

  it('creates a valid default profile', () => {
    const s = defaultSave();
    expect(s.profile.level).toBe(1);
    expect(s.profile.unlockedWeapons.length).toBeGreaterThan(0);
    expect(s.profile.loadout.skills).toHaveLength(3);
    expect(s.settings.bindingsP1.attack).toBe('KeyF');
    expect(s.settings.bindingsP2.attack).toBe('KeyJ');
  });

  it('recovers from malformed save data', () => {
    localStorage.setItem(SAVE_KEY, '{ not json');
    const s = loadSave();
    expect(s.profile.level).toBe(1);
    expect(s.profile.unlockedSkills.length).toBeGreaterThan(0);
  });

  it('drops unknown ids and keeps valid progress', () => {
    const data = sanitize({
      version: 3,
      profile: {
        name: 'TESTER', level: 7, xp: 4200, shards: 999,
        unlockedWeapons: ['inferno_greatsword', 'not_a_weapon'],
        unlockedSkills: ['volt_bolt', 'bogus_skill'],
        skillLevels: { volt_bolt: 4, bogus_skill: 5 },
        unlockedEquipment: ['aura_void', 'nope'],
        loadout: { weapon: 'inferno_greatsword', skills: ['volt_bolt', 'ghost', 'laser_beam'], equipment: { head: 'head_crown' } },
      },
      settings: { masterVolume: 5, quality: 'ultra' },
    });
    expect(data.profile.name).toBe('TESTER');
    expect(data.profile.unlockedWeapons).toContain('inferno_greatsword');
    expect(data.profile.unlockedWeapons).not.toContain('not_a_weapon');
    expect(data.profile.unlockedSkills).not.toContain('bogus_skill');
    expect(data.profile.skillLevels.volt_bolt).toBe(4);
    expect(data.profile.loadout.skills).toHaveLength(3);
    expect(data.settings.masterVolume).toBeLessThanOrEqual(1);
    expect(data.settings.quality).toBe('high');
  });

  it('never equips items that are not owned', () => {
    const data = sanitize({
      version: 3,
      profile: {
        unlockedEquipment: [],
        loadout: { weapon: 'shadow_katana', skills: [], equipment: { aura: 'aura_celestial' } },
      },
    });
    expect(data.profile.loadout.equipment.aura).not.toBe('aura_celestial');
  });

  it('migrates legacy saves without pvp loadouts', () => {
    const legacy = { version: 1, profile: { loadout: { weapon: 'storm_spear', skills: ['fire_bolt'], equipment: {} } } };
    const migrated = migrate(legacy) as { version: number; profile: { pvp?: unknown; savedLoadouts?: unknown[]; look?: unknown } };
    expect(migrated.version).toBe(4);
    expect(migrated.profile.pvp).toBeTruthy();
    expect(Array.isArray(migrated.profile.savedLoadouts)).toBe(true);
    expect(migrated.profile.look).toBeTruthy();
    const clean = sanitize(migrated);
    expect(clean.profile.pvp.p1.weapon).toBeTruthy();
    expect(clean.profile.pvp.p2.weapon).toBeTruthy();
    expect(clean.profile.look.variant).toBe('dark');
  });

  it('persists and reloads unlocks, upgrades and settings', async () => {
    const s = defaultSave();
    s.profile.unlockedWeapons.push('void_scythe');
    s.profile.unlockedSkills.push('volt_bolt');
    s.profile.skillLevels.volt_bolt = 3;
    s.profile.shards = 4321;
    s.settings.screenShake = false;
    s.settings.bindingsP1.attack = 'KeyG';
    writeSave(s);
    await new Promise((r) => setTimeout(r, 300));
    const back = loadSave();
    expect(back.profile.unlockedWeapons).toContain('void_scythe');
    expect(back.profile.skillLevels.volt_bolt).toBe(3);
    expect(back.profile.shards).toBe(4321);
    expect(back.settings.screenShake).toBe(false);
    expect(back.settings.bindingsP1.attack).toBe('KeyG');
  });

  it('clears the save only when asked', async () => {
    writeSave(defaultSave());
    await new Promise((r) => setTimeout(r, 300));
    expect(localStorage.getItem(SAVE_KEY)).toBeTruthy();
    clearSave();
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
  });
});

describe('progression', () => {
  it('uses an increasing xp curve', () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(10)).toBeGreaterThan(xpForLevel(5));
  });

  it('derives level from accumulated xp', () => {
    expect(levelFromXp(0).level).toBe(1);
    const need = xpForLevel(1);
    expect(levelFromXp(need).level).toBe(2);
    expect(levelFromXp(need - 1).level).toBe(1);
    const far = levelFromXp(500000);
    expect(far.level).toBeGreaterThan(10);
  });

  it('evaluates achievement predicates against real stats', () => {
    const base = {
      wins: 0, losses: 0, matches: 0, totalDamage: 0, highestCombo: 0, hardWins: 0, bossWins: 0,
      weaponsUnlocked: 2, skillsUnlocked: 3, skillUpgrades: 0, equipmentUnlocked: 10, level: 1,
      perfectWins: 0, skillsUsed: 0,
    };
    const first = ACHIEVEMENTS.find((a) => a.id === 'first_blood')!;
    expect(first.check(base)).toBe(false);
    expect(first.check({ ...base, wins: 1 })).toBe(true);
    const combo = ACHIEVEMENTS.find((a) => a.id === 'combo_10')!;
    expect(combo.progress({ ...base, highestCombo: 6 })).toEqual({ value: 6, target: 10 });
  });
});
