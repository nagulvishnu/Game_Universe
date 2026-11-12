import { describe, expect, it } from 'vitest';
import {
  SAVE_VERSION,
  defaultSettings,
  freshSave,
  normalizeSave,
  normalizeScores,
  normalizeSettings,
  parseSaveFile,
  serializeSave,
} from './save';

describe('save normalization', () => {
  it('accepts a fresh save without recovery warnings', () => {
    const result = normalizeSave(freshSave());
    expect(result.save.v).toBe(SAVE_VERSION);
    expect(result.recovered).toBe(false);
    expect(result.migratedFrom).toBeNull();
  });

  it('migrates a version-1 save and preserves its progress', () => {
    const legacy = {
      ...freshSave(),
      v: 1,
      chapter: 3,
      level: 11,
      gold: 900,
      titles: ['Weakest Hunter', 'Player'],
      title: 'Player',
    };
    const result = normalizeSave(legacy);
    expect(result.save.v).toBe(SAVE_VERSION);
    expect(result.save.chapter).toBe(3);
    expect(result.save.level).toBe(11);
    expect(result.save.gold).toBe(900);
    expect(result.migratedFrom).toBe(1);
    expect(result.warnings.some((warning) => warning.includes('version 1'))).toBe(true);
  });

  it('recovers corrupted nested data without throwing', () => {
    const result = normalizeSave({
      level: 'not a number',
      gold: -50,
      stats: { str: 999999, agi: 'x' },
      inv: { hp_potion: -2, not_an_item: 4, rusty_dagger: 1 },
      equip: { weapon: 'not_an_item', armor: 'hunter_sword' },
      shadows: [
        { key: 'igris', rank: 99, level: 999, evo: 99, favorite: 'yes' },
        { key: 'unknown_shadow', level: 2 },
        null,
      ],
      quests: { not_a_quest: { state: 'active', prog: [] }, q_gate: { state: 'active', prog: [99] } },
      flags: { awakened: true, broken: 'true' },
      titles: [],
      title: 'Custom Title',
      dailyLeft: -10,
    });
    expect(result.save.level).toBe(1);
    expect(result.save.gold).toBe(0);
    expect(result.save.dailyLeft).toBe(0);
    expect(result.save.stats.str).toBe(9999);
    expect(result.save.stats.agi).toBe(10);
    expect(result.save.inv.not_an_item).toBeUndefined();
    expect(result.save.inv.hp_potion).toBeUndefined();
    expect(result.save.equip.weapon).toBeUndefined();
    expect(result.save.equip.armor).toBeUndefined();
    expect(result.save.shadows).toHaveLength(1);
    expect(result.save.shadows[0].rank).toBe(7);
    expect(result.save.shadows[0].level).toBe(50);
    expect(result.save.shadows[0].evo).toBe(2);
    expect(result.save.quests.not_a_quest).toBeUndefined();
    expect(result.save.quests.q_gate.prog).toEqual([99]);
    expect(result.save.flags.awakened).toBe(true);
    expect(result.save.flags.broken).toBeUndefined();
    expect(result.save.titles).toContain('Custom Title');
    expect(result.recovered).toBe(true);
  });

  it('restores an equipped item that is missing from the inventory', () => {
    const base = freshSave();
    const result = normalizeSave({ ...base, inv: { hp_potion: 1 } });
    expect(result.save.equip.weapon).toBe('rusty_dagger');
    expect(result.save.inv.rusty_dagger).toBe(1);
    expect(result.warnings.some((warning) => warning.includes('Restored missing equipped item'))).toBe(true);
  });

  it('does not mutate the input object', () => {
    const base = freshSave();
    const snapshot = JSON.stringify(base);
    normalizeSave(base);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('round-trips through the export format', () => {
    const base = freshSave();
    base.level = 18;
    base.shadows = [
      {
        id: 'sh_test',
        key: 'igris',
        name: 'Igris',
        rank: 4,
        level: 12,
        xp: 30,
        favorite: true,
        squad: 1,
        evo: 0,
        state: 'stored',
        kills: 8,
      },
    ];
    const exported = serializeSave(base);
    const parsed = parseSaveFile(exported);
    expect(parsed.recovered).toBe(false);
    expect(parsed.save.level).toBe(18);
    expect(parsed.save.shadows).toHaveLength(1);
    expect(parsed.save.shadows[0].key).toBe('igris');
  });

  it('rejects invalid JSON imports', () => {
    expect(() => parseSaveFile('{not json')).toThrow(/valid JSON/i);
  });
});

describe('settings and scores normalization', () => {
  it('clamps settings into supported ranges', () => {
    const result = normalizeSettings({
      master: 4,
      music: -2,
      quality: 'ultra',
      resScale: 9,
      shadowQ: 12,
      draw: 5,
      particles: 7,
      npcDensity: 500,
      army: 999,
      post: false,
      sens: 9,
      uiScale: 0.1,
      reducedMotion: true,
      keys: { forward: 'KeyI', broken: 4 },
    });
    expect(result.master).toBe(1);
    expect(result.music).toBe(0);
    expect(result.quality).toBe('ultra');
    expect(result.resScale).toBe(1.5);
    expect(result.shadowQ).toBe(3);
    expect(result.draw).toBe(60);
    expect(result.particles).toBe(1.5);
    expect(result.npcDensity).toBe(40);
    expect(result.army).toBe(100);
    expect(result.post).toBe(false);
    expect(result.sens).toBe(3);
    expect(result.uiScale).toBe(0.7);
    expect(result.reducedMotion).toBe(true);
    expect(result.keys.forward).toBe('KeyI');
    expect(result.keys.broken).toBeUndefined();
  });

  it('returns safe defaults for invalid settings input', () => {
    const result = normalizeSettings(null);
    expect(result).toEqual(defaultSettings());
  });

  it('filters, sorts and caps high scores', () => {
    const scores = normalizeScores([
      { name: 'A', score: 50, level: 2, note: 'x', date: 'today' },
      { name: 'B', score: 150, level: 4, note: 'y', date: 'today' },
      { name: 'bad', score: -5 },
      null,
    ]);
    expect(scores).toHaveLength(2);
    expect(scores[0].score).toBe(150);
    expect(scores[1].score).toBe(50);
  });
});
