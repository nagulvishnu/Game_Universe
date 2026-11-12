import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, REGIONS, xpFor } from './data';
import {
  applyXpGain,
  computeTick,
  deriveStats,
  findReadyMission,
  freshCore,
  ownedTerr,
  rankOf,
  unlockedSkill,
  type Core,
  type Member,
  type Terr,
} from './logic';

const core = (): Core => freshCore('Test Subject', DEFAULT_LOOK);

const mkMember = (over: Partial<Member> = {}): Member => ({
  id: 'm' + (over.seed ?? 1), name: 'Test Member', role: 'Henchman', lvl: 1, str: 5,
  loyalty: 80, skills: [], gear: 'Baton', assign: 'Follow Me', seed: 1, terr: '', xp: 0,
  ...over,
});

const ownedAll: Record<string, Terr> = Object.fromEntries(
  REGIONS.map((r) => [r.id, { state: 'Villain-Controlled' as const, commander: '', defense: 20 }]),
);

describe('deriveStats', () => {
  it('derives base stats for a fresh character', () => {
    const d = deriveStats(core(), 0);
    expect(d.maxHp).toBe(114); // 100 + 1*14
    expect(d.maxEn).toBe(105); // 100 + 1*5
    expect(d.weaponDmg).toBeCloseTo(9); // Street Knife
    expect(d.memberCap).toBe(4);
    expect(d.speedMult).toBe(1);
  });

  it('adds facility bonuses', () => {
    const s: Core = { ...core(), fac: { training: 2, energy: 1, armory: 5, throne: 1 } };
    const d = deriveStats(s, 0);
    expect(d.maxHp).toBe(134); // +20
    expect(d.maxEn).toBe(120); // +15
    expect(d.weaponDmg).toBeCloseTo(9 * 1.2); // armory 5 → +20%
    expect(d.memberCap).toBe(7); // 4 + throne 1*3
  });

  it('scales damage with the transformation form', () => {
    const s = core();
    expect(deriveStats(s, 0).dmgMult).toBeCloseTo(1);
    expect(deriveStats(s, 2).dmgMult).toBeCloseTo(1.7); // Crimson Overdrive
    expect(deriveStats(s, 4).dmgMult).toBeCloseTo(3.2); // Ascended Demon God
  });

  it('applies artifact and Void Sovereign Plate multipliers', () => {
    const base = core();
    const s: Core = { ...base, inv: { ...base.inv, eye: 1, crown: 1 }, armor: 'voidplate' };
    const d = deriveStats(s, 0);
    expect(d.dmgMult).toBeCloseTo(1 * (1 + 0.1 + 0.15 + 0.2));
  });

  it('caps command slots at zero without Commander Quarters', () => {
    expect(deriveStats(core(), 0).cmdCap).toBe(0);
    expect(deriveStats({ ...core(), fac: { quarters: 3 } }, 0).cmdCap).toBe(3);
  });
});

describe('rankOf', () => {
  it('is 1 for a fresh character', () => {
    expect(rankOf(core())).toBe(1);
  });

  it('climbs through the reputation gates in order', () => {
    expect(rankOf({ ...core(), rep: 50 })).toBe(2);
    expect(rankOf({ ...core(), rep: 200, level: 3 })).toBe(3);
    const four = { ...core(), rep: 400, level: 3, members: [mkMember(), mkMember({ seed: 2 }), mkMember({ seed: 3 })] };
    expect(rankOf(four)).toBe(4);
  });

  it('stops at the first unmet gate', () => {
    // rep high enough for rank 5, but territory gate for rank 6 is unmet
    expect(rankOf({ ...core(), rep: 5000, level: 40, members: [mkMember(), mkMember({ seed: 2 }), mkMember({ seed: 3 })], fac: { throne: 5 } })).toBe(5);
  });

  it('reaches rank 10 with full conquest and Solaris defeated', () => {
    const s: Core = {
      ...core(), rep: 8000, level: 40, terr: ownedAll,
      members: [mkMember(), mkMember({ seed: 2 }), mkMember({ seed: 3 })],
      fac: { throne: 5 }, bosses: { solaris: true },
    };
    expect(ownedTerr(s)).toBe(9);
    expect(rankOf(s)).toBe(10);
  });
});

describe('applyXpGain', () => {
  it('does not level below the threshold', () => {
    expect(applyXpGain(1, 0, xpFor(1) - 1)).toEqual({ level: 1, xp: xpFor(1) - 1, levels: 0 });
  });

  it('levels up exactly at the threshold', () => {
    const r = applyXpGain(1, 0, xpFor(1));
    expect(r.level).toBe(2);
    expect(r.xp).toBe(0);
    expect(r.levels).toBe(1);
  });

  it('cascades through multiple levels at once', () => {
    const r = applyXpGain(1, 0, 1e9);
    expect(r.level).toBeGreaterThan(5);
  });

  it('caps at level 60', () => {
    const r = applyXpGain(59, 0, 1e12);
    expect(r.level).toBe(60);
  });
});

describe('unlockedSkill', () => {
  it('unlocks level-appropriate skills', () => {
    const s = core();
    expect(unlockedSkill(s, 'shadow_bolt')).toBe(true); // lvl 1
    expect(unlockedSkill(s, 'shadow_blade')).toBe(false); // lvl 2
  });

  it('gates Unique skills behind their boss', () => {
    const base = core();
    expect(unlockedSkill({ ...base, level: 30 }, 'dominion')).toBe(false);
    expect(unlockedSkill({ ...base, level: 30, bosses: { zerath: true } }, 'dominion')).toBe(true);
  });
});

describe('findReadyMission', () => {
  it('returns null when nothing is complete', () => {
    expect(findReadyMission(core())).toBeNull();
  });

  it('returns m1 once 2 vehicles have been stolen', () => {
    expect(findReadyMission({ ...core(), counters: { steal: 2 } })?.id).toBe('m1');
  });

  it('respects the after-mission prerequisite', () => {
    const s: Core = { ...core(), counters: { rob: 1 } };
    expect(findReadyMission(s)).toBeNull(); // m3 requires m2 done
    expect(findReadyMission({ ...s, done: { m1: true, m2: true } })?.id).toBe('m3');
  });

  it('never returns an already-completed mission', () => {
    const s: Core = { ...core(), counters: { steal: 2 }, done: { m1: true }, tracked: '' };
    expect(findReadyMission(s)?.id).not.toBe('m1');
  });

  it('counts contract progress from the accepted baseline only', () => {
    const contract = { id: 'c_test', title: 'Contract: Test', desc: 'd', ev: 'rob', need: 5, money: 100, rep: 5, xp: 10, rank: 1 };
    const s: Core = { ...core(), contracts: [contract], counters: { rob: 8, base_c_test: 6 } };
    expect(findReadyMission(s)).toBeNull(); // 8 - 6 = 2, not enough
    const s2: Core = { ...s, counters: { rob: 12, base_c_test: 6 } };
    expect(findReadyMission(s2)?.id).toBe('c_test'); // 12 - 6 = 6 >= 5
  });

  it('matches the main mission order (m1 before s1)', () => {
    const s: Core = { ...core(), counters: { steal: 2, kill_gang: 8 } };
    expect(findReadyMission(s)?.id).toBe('m1');
  });

  it('recognizes the next mission in the chain after m1 completes', () => {
    const s: Core = { ...core(), counters: { steal: 2, burgle: 4 }, done: { m1: true } };
    expect(findReadyMission(s)?.id).toBe('m2');
  });
});

describe('computeTick', () => {
  it('gathers income and scrap from assigned members', () => {
    const gatherer = mkMember({ assign: 'Gather Resources', lvl: 10 });
    const scientist = mkMember({ id: 's2', seed: 2, role: 'Scientist', assign: 'Research', lvl: 10 });
    const r = computeTick({ ...core(), members: [gatherer, scientist] }, () => 0.99);
    expect(r.scrap).toBe(2); // 1 + floor(10/8)
    expect(r.money).toBeCloseTo(60); // 10 * 6
    expect(r.researchPoints).toBe(2); // 1 + floor(10/10), no lab levels
    expect(r.members).toHaveLength(2);
    expect(r.lost).toBe('');
    expect(r.celebrate).toBe(false);
  });

  it('leaves neutral regions untouched', () => {
    const r = computeTick(core(), () => 0);
    expect(r.lost).toBe('');
    expect(r.terr.metro.state).toBe('Contested');
    expect(r.events.repelled).toEqual([]);
  });

  it('repels an attack when defense holds', () => {
    const s: Core = {
      ...core(),
      terr: { ...core().terr, metro: { state: 'Villain-Controlled', commander: '', defense: 999 } },
    };
    const r = computeTick(s, () => 0); // attack triggers, atk = 48 < 999
    expect(r.events.repelled.map((e) => e.region)).toContain('Metro City');
    expect(r.lost).toBe('');
    expect(r.terr.metro.state).toBe('Villain-Controlled');
  });

  it('flips an indefensible territory back to heroes and demotes its commander', () => {
    const commander = mkMember({ id: 'cmd1', assign: 'Territory', terr: 'metro', loyalty: 50 });
    const s: Core = {
      ...core(),
      members: [commander],
      terr: { ...core().terr, metro: { state: 'Villain-Controlled', commander: 'cmd1', defense: 0 } },
    };
    const r = computeTick(s, () => 0);
    expect(r.terr.metro.state).toBe('Hero-Controlled');
    expect(r.terr.metro.commander).toBe('');
    expect(r.lost).toBe('Metro City');
    const cmd = r.members.find((m) => m.id === 'cmd1');
    expect(cmd?.assign).toBe('Follow Me');
    expect(cmd?.loyalty).toBeLessThanOrEqual(40); // 50 - 10 for losing the territory
  });

  it('breeds a betrayal from a disloyal member and robs the vault', () => {
    const rat = mkMember({ id: 'rat', loyalty: 10, assign: 'Gather Resources', lvl: 1 });
    const s: Core = { ...core(), money: 1000, members: [rat] };
    const r = computeTick(s, () => 0);
    expect(r.events.betrayed?.id).toBe('rat');
    expect(r.members).toHaveLength(0);
    expect(r.money).toBe(6 - 50); // gather income minus 5% of the vault
  });

  it('awards research from the lab facility', () => {
    const s: Core = { ...core(), fac: { lab: 3 } };
    const r = computeTick(s, () => 0.99);
    expect(r.researchPoints).toBe(3);
  });

  it('Fully Conquered regions earn more and resist better', () => {
    const s: Core = {
      ...core(),
      terr: { ...core().terr, metro: { state: 'Fully Conquered', commander: '', defense: 999 } },
    };
    const contested = computeTick({ ...s, terr: { ...s.terr, metro: { state: 'Villain-Controlled', commander: '', defense: 999 } } }, () => 0.99);
    const conquered = computeTick(s, () => 0.99);
    // metro income 800, 5% share at 40% efficiency, 1.5x for Fully Conquered
    expect(conquered.money - contested.money).toBeCloseTo(800 * 0.05 * 0.4 * 0.5);
  });
});
