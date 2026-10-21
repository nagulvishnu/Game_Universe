import { describe, it, expect } from 'vitest';
import { SKILLS, SKILL_BY_ID, SKILL_CATEGORIES, type SkillCategory } from '../data/skills';
import { WEAPONS, WEAPON_BY_ID } from '../data/weapons';
import { EQUIPMENT, EQUIP_SLOTS } from '../data/equipment';
import { ARENAS } from '../data/arenas';
import { OPPONENTS, DIFFICULTIES } from '../data/fighters';

const MIN_PER_CATEGORY: Record<SkillCategory, number> = {
  fire: 10, lightning: 10, ice: 10, shadow: 12, energy: 10, gravity: 10,
  wind: 8, earth: 8, defense: 10, mobility: 8, summon: 7, ultimate: 7,
};

const VALID_KINDS = new Set([
  'projectile', 'homing', 'beam', 'aoe', 'zone', 'wave', 'rain', 'melee',
  'dash', 'clone', 'summon', 'buff', 'counter', 'pull', 'trap',
]);

describe('skill catalogue', () => {
  it('contains at least 120 unique skills', () => {
    expect(SKILLS.length).toBeGreaterThanOrEqual(120);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
  });

  it('defines at least 600 skill-level configurations with exactly 5 levels each', () => {
    let total = 0;
    for (const s of SKILLS) {
      expect(s.levels).toHaveLength(5);
      s.levels.forEach((l, i) => {
        expect(l.level).toBe(i + 1);
        expect(l.title.length).toBeGreaterThan(0);
        expect(l.description.length).toBeGreaterThan(0);
        expect(l.cooldown).toBeGreaterThan(0);
      });
      total += s.levels.length;
    }
    expect(total).toBeGreaterThanOrEqual(600);
  });

  it('meets the required per-category distribution', () => {
    for (const cat of Object.keys(MIN_PER_CATEGORY) as SkillCategory[]) {
      const n = SKILLS.filter((s) => s.category === cat).length;
      expect(n, `${cat} has ${n}`).toBeGreaterThanOrEqual(MIN_PER_CATEGORY[cat]);
    }
    expect(SKILL_CATEGORIES).toHaveLength(12);
  });

  it('only references execution kinds that the executor implements', () => {
    for (const s of SKILLS) expect(VALID_KINDS.has(s.kind), `${s.id}:${s.kind}`).toBe(true);
  });

  it('scales damage and cooldown monotonically with level', () => {
    for (const s of SKILLS) {
      for (let i = 1; i < 5; i++) {
        expect(s.levels[i].damage).toBeGreaterThanOrEqual(s.levels[i - 1].damage);
        expect(s.levels[i].cooldown).toBeLessThanOrEqual(s.levels[i - 1].cooldown);
      }
      expect(s.levels[4].perks.length).toBeGreaterThanOrEqual(3);
      expect(s.levels[0].perks.length).toBe(0);
    }
  });

  it('has a lookup entry for every skill', () => {
    for (const s of SKILLS) expect(SKILL_BY_ID[s.id]).toBe(s);
  });
});

describe('weapon catalogue', () => {
  it('has at least 20 unique weapons', () => {
    expect(WEAPONS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length);
  });

  it('gives every weapon a 3-hit combo plus a charged attack with valid frame data', () => {
    for (const w of WEAPONS) {
      expect(w.combo).toHaveLength(3);
      expect(w.charged.heavy).toBe(true);
      for (const a of [...w.combo, w.charged]) {
        expect(a.startup).toBeGreaterThan(0);
        expect(a.active).toBeGreaterThan(0);
        expect(a.recovery).toBeGreaterThan(0);
        expect(a.damage).toBeGreaterThan(0);
        expect(a.reach).toBeGreaterThan(0);
        expect(a.hitW).toBeGreaterThan(0);
      }
      expect(w.charged.damage).toBeGreaterThan(w.combo[2].damage);
      expect(w.chargeTime).toBeGreaterThan(0);
      expect(w.fullChargeTime).toBeGreaterThan(w.chargeTime);
      expect(WEAPON_BY_ID[w.id]).toBe(w);
    }
  });

  it('covers every required weapon category', () => {
    for (const c of ['unarmed', 'sword', 'greatsword', 'daggers', 'polearm', 'energy'])
      expect(WEAPONS.some((w) => w.category === c), c).toBe(true);
  });

  it('differentiates weapons by timing and reach, not only damage', () => {
    const startups = new Set(WEAPONS.map((w) => w.combo[0].startup));
    const reaches = new Set(WEAPONS.map((w) => w.combo[0].reach));
    expect(startups.size).toBeGreaterThan(8);
    expect(reaches.size).toBeGreaterThan(8);
  });
});

describe('equipment catalogue', () => {
  it('has at least 40 unique items across valid slots', () => {
    expect(EQUIPMENT.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EQUIPMENT.map((e) => e.id)).size).toBe(EQUIPMENT.length);
    const slots = new Set(EQUIP_SLOTS.map((s) => s.id));
    for (const e of EQUIPMENT) expect(slots.has(e.slot), e.id).toBe(true);
  });

  it('keeps stat modifiers small and bounded', () => {
    for (const e of EQUIPMENT) {
      if (!e.mods) continue;
      expect(Math.abs(e.mods.maxHealth ?? 0)).toBeLessThanOrEqual(15);
      expect(Math.abs(e.mods.moveSpeed ?? 0)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(e.mods.cooldown ?? 0)).toBeLessThanOrEqual(0.1);
    }
  });
});

describe('arenas and opponents', () => {
  it('provides at least three usable arenas', () => {
    expect(ARENAS.length).toBeGreaterThanOrEqual(3);
    for (const a of ARENAS) {
      expect(a.rightBound).toBeGreaterThan(a.leftBound);
      expect(a.floorY).toBeGreaterThan(100);
      expect(a.layers.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('provides distinct opponent profiles and three real difficulties', () => {
    expect(OPPONENTS.length).toBeGreaterThanOrEqual(6);
    const styles = new Set(OPPONENTS.map((o) => o.style));
    expect(styles.size).toBeGreaterThanOrEqual(5);
    for (const o of OPPONENTS) {
      expect(WEAPON_BY_ID[o.weapon], o.id).toBeTruthy();
      for (const s of o.skills) expect(SKILL_BY_ID[s], `${o.id}:${s}`).toBeTruthy();
    }
    expect(DIFFICULTIES.easy.reactionMs).toBeGreaterThan(DIFFICULTIES.medium.reactionMs);
    expect(DIFFICULTIES.medium.reactionMs).toBeGreaterThan(DIFFICULTIES.hard.reactionMs);
    expect(DIFFICULTIES.hard.damageMul).toBeLessThan(1.3);
  });
});
