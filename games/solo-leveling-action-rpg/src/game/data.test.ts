import { describe, expect, it } from 'vitest';
import { ENEMIES, GATE_INFO, ITEMS, MISSIONS, QUESTS, RANKS, SHADOWS, STAT_KEYS, hunterRank, xpNeeded } from './data';

describe('static game data integrity', () => {
  it('keeps all item references valid', () => {
    for (const quest of [...Object.values(QUESTS), ...MISSIONS]) {
      for (const item of quest.reward.items ?? []) expect(ITEMS[item], `${quest.id} reward ${item}`).toBeDefined();
    }
    for (const enemy of Object.values(ENEMIES)) {
      for (const [item] of enemy.drops) expect(ITEMS[item], `${enemy.key} drop ${item}`).toBeDefined();
    }
  });

  it('keeps extractable shadows tied to real enemies', () => {
    for (const shadow of Object.values(SHADOWS)) {
      const source = ENEMIES[shadow.key];
      expect(source, `shadow source for ${shadow.key}`).toBeDefined();
      expect(source.extract).toBeGreaterThan(0);
      expect(shadow.startRank).toBeGreaterThanOrEqual(0);
      expect(shadow.startRank).toBeLessThan(RANKS.length);
      expect(shadow.evo.length).toBeGreaterThan(0);
      for (const evolution of shadow.evo) {
        expect(evolution.level).toBeGreaterThan(0);
        expect(evolution.cost).toBeGreaterThan(0);
      }
    }
  });

  it('defines every gate referenced by the story registry', () => {
    for (const key of ['leak', 'double', 'venom', 'job', 'raid', 'penalty']) {
      expect(GATE_INFO[key], key).toBeDefined();
    }
  });

  it('has valid stat keys on every item stat', () => {
    for (const item of Object.values(ITEMS)) {
      for (const key of STAT_KEYS) expect(item[key] === undefined || typeof item[key] === 'number').toBe(true);
      if (item.slot) expect(ITEMS[item.id].slot).toBe(item.slot);
    }
  });

  it('keeps quest objectives and rewards well formed', () => {
    for (const quest of [...Object.values(QUESTS), ...MISSIONS]) {
      expect(quest.objs.length).toBeGreaterThan(0);
      expect(quest.reward.xp).toBeGreaterThanOrEqual(0);
      expect(quest.reward.gold).toBeGreaterThanOrEqual(0);
      for (const objective of quest.objs) {
        expect(objective.type.length).toBeGreaterThan(0);
        expect(objective.need).toBeGreaterThan(0);
      }
    }
  });
});

describe('progression formulas', () => {
  it('requires more XP for each successive level', () => {
    for (let level = 1; level < 60; level++) {
      expect(xpNeeded(level + 1)).toBeGreaterThan(xpNeeded(level));
    }
  });

  it('maps hunter levels to ranks in order', () => {
    expect(hunterRank(1)).toBe('E');
    expect(hunterRank(8)).toBe('D');
    expect(hunterRank(15)).toBe('C');
    expect(hunterRank(25)).toBe('B');
    expect(hunterRank(35)).toBe('A');
    expect(hunterRank(50)).toBe('S');
  });
});
