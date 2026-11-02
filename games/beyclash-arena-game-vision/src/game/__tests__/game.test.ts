import { describe, expect, it } from 'vitest';
import { AIController, runHeadless } from '../battle/ai/ai';
import { BattleSim } from '../battle/physics/sim';
import { computeStats } from '../customization/stats';
import { DEFAULT_TRANSFER, START_POINTS, transfer } from '../economy/economy';
import { applyEncounterWin } from '../rivals/encounter';
import { defaultSave, loadSave, sanitize, SAVE_KEY, SAVE_VERSION } from '../persistence/save';
import { settleRivalBattle, settleTournamentMatch, checkTournament } from '../progression/rewards';
import { RIVAL_MAP, RIVALS } from '../../data/rivals';
import { STADIUMS, STADIUM_MAP } from '../../data/stadiums';
import { TOURNAMENTS, TOURNAMENT_MAP } from '../../data/tournaments';
import { PARTS, STARTER_CONFIG } from '../../data/parts';
import { advanceAI, newTournamentRun } from '../tournaments/competitors';
import { champion, nextPlayerMatch, playerIndex } from '../tournaments/bracket';
import type { BattleResult, Strategy, Difficulty } from '../types';

const STRATS: Strategy[] = ['aggressive', 'defensive', 'stamina', 'evasive', 'opportunist', 'adaptive'];

function fight(sa: Strategy, sb: Strategy, seed: number, stadium = 'arena', da: Difficulty = 'Normal', db: Difficulty = 'Normal') {
  const stats = computeStats(STARTER_CONFIG);
  const sim = new BattleSim([stats, stats], STADIUM_MAP[stadium], [0.9, 0.9]);
  return runHeadless(sim, new AIController({ strategy: sa, difficulty: da, seed }), new AIController({ strategy: sb, difficulty: db, seed: seed + 99 }))!;
}

describe('encounter scoring', () => {
  it('awards 1/2/3 points and caps at five', () => {
    let e = { points: 0, defeated: false };
    let o = applyEncounterWin(e, 'SPIN'); expect(o.points).toBe(1); expect(o.defeated).toBe(false);
    e = o; o = applyEncounterWin(e, 'RING_OUT'); expect(o.points).toBe(3);
    e = o; o = applyEncounterWin(e, 'BURST');
    expect(o.points).toBe(5); expect(o.defeated).toBe(true); expect(o.excess).toBe(1); expect(o.counted).toBe(2);
  });
});

describe('economy', () => {
  it('starts at 5000 and transfers conserve currency', () => {
    expect(defaultSave().points).toBe(START_POINTS);
    const t = transfer(1000, 100, DEFAULT_TRANSFER);
    expect(t.amount).toBe(100);
    expect(t.winnerAfter + t.loserAfter).toBe(1100);
    expect(t.loserAfter).toBe(0);
    expect(transfer(0, 0).amount).toBe(0);
  });
});

describe('rival settlement', () => {
  const win = (finish: BattleResult['finish']): BattleResult => ({ winner: 0, loser: 1, finish, time: 30, stamina: [50, 0] });
  const lose: BattleResult = { winner: 1, loser: 0, finish: 'SPIN', time: 50, stamina: [0, 30] };
  it('awards points once per battle and never duplicates', () => {
    const s0 = defaultSave();
    const riku = RIVAL_MAP.riku;
    const a = settleRivalBattle(s0, riku, win('RING_OUT'), 'b1');
    expect(a.save.rivals.riku.points).toBe(2);
    expect(a.save.points).toBe(s0.points + 250 + a.summary!.prize);
    const dup = settleRivalBattle(a.save, riku, win('RING_OUT'), 'b1');
    expect(dup.summary).toBeNull();
    expect(dup.save.rivals.riku.points).toBe(2);
    expect(dup.save.points).toBe(a.save.points);
  });
  it('loss keeps encounter score and moves at most the owned balance', () => {
    let s = defaultSave();
    s.points = 100;
    s = settleRivalBattle(s, RIVAL_MAP.riku, win('SPIN'), 'w').save;
    const before = s.rivals.riku.points;
    s.points = 100;
    const r = settleRivalBattle(s, RIVAL_MAP.riku, lose, 'l');
    expect(r.save.rivals.riku.points).toBe(before);
    expect(r.save.points).toBe(0);
    expect(r.summary!.transfer!.amount).toBe(100);
  });
  it('5 points defeats the rival', () => {
    let s = defaultSave();
    s = settleRivalBattle(s, RIVAL_MAP.riku, win('BURST'), 'a').save;
    expect(s.rivals.riku.defeated).toBe(false);
    s = settleRivalBattle(s, RIVAL_MAP.riku, win('RING_OUT'), 'b').save;
    expect(s.rivals.riku.defeated).toBe(true);
    expect(s.rivals.riku.points).toBe(5);
  });
});

describe('battle simulation', () => {
  it('is deterministic', () => {
    const a = fight('aggressive', 'adaptive', 7);
    const b = fight('aggressive', 'adaptive', 7);
    expect(a).toEqual(b);
  });
  it('produces all three finishes with sensible durations (calibration)', () => {
    const counts = { SPIN: 0, RING_OUT: 0, BURST: 0 };
    let total = 0, n = 0;
    for (const sa of STRATS) for (const sb of STRATS) for (let k = 0; k < 4; k++) {
      const st = STADIUMS[(k + n) % STADIUMS.length].id;
      const r = fight(sa, sb, 1000 + n++, st, 'Hard', 'Hard');
      counts[r.finish]++;
      total += r.time;
    }
    console.log('FINISH DISTRIBUTION', counts, 'avg time', (total / n).toFixed(1));
    expect(counts.SPIN).toBeGreaterThan(0);
    expect(counts.RING_OUT).toBeGreaterThan(0);
    expect(counts.BURST).toBeGreaterThan(0);
  });
  it('never has the tops pass through each other', () => {
    const stats = computeStats(STARTER_CONFIG);
    const sim = new BattleSim([stats, stats], STADIUM_MAP.arena);
    const a = new AIController({ strategy: 'aggressive', difficulty: 'Hard', seed: 1 });
    const b = new AIController({ strategy: 'aggressive', difficulty: 'Hard', seed: 2 });
    let min = 99;
    for (let i = 0; i < 3000 && !sim.result; i++) {
      sim.step([{ ...a.think(sim.tops[0], sim.tops[1], sim, 1 / 60) }, { ...b.think(sim.tops[1], sim.tops[0], sim, 1 / 60) }]);
      min = Math.min(min, Math.hypot(sim.tops[0].x - sim.tops[1].x, sim.tops[0].z - sim.tops[1].z));
    }
    expect(min).toBeGreaterThan(1.3);
  });
});

describe('tournaments', () => {
  it('brackets generate and player must win to advance', () => {
    for (const t of TOURNAMENTS) {
      const b = newTournamentRun(t, 42);
      expect(b.entrants.length).toBe(t.size);
      expect(new Set(b.entrants).size).toBe(t.size);
      expect(champion(b)).toBeNull(); // player has not played
      expect(nextPlayerMatch(b)).not.toBeNull();
    }
  });
  it('player win advances, loss eliminates, results persist through sanitize', () => {
    const t = TOURNAMENT_MAP.local;
    let s = defaultSave();
    s.level = 5;
    s.tournaments.local.active = newTournamentRun(t, 5);
    const w: BattleResult = { winner: 0, loser: 1, finish: 'SPIN', time: 20, stamina: [40, 0] };
    const r1 = settleTournamentMatch(s, t, w, 'm1');
    expect(r1.save.tournaments.local.active!.status).toBe('active');
    const r2 = settleTournamentMatch(r1.save, t, w, 'm2');
    expect(r2.save.tournaments.local.active!.status).toBe('won');
    expect(r2.save.tournaments.local.wins).toBe(1);
    expect(r2.save.points).toBeGreaterThan(s.points + t.prize - 1);
    const round = sanitize(JSON.parse(JSON.stringify(r2.save)))!;
    expect(round.tournaments.local.active!.status).toBe('won');
    const lost = settleTournamentMatch(s, t, { winner: 1, loser: 0, finish: 'RING_OUT', time: 20, stamina: [0, 40] }, 'm3');
    expect(lost.save.tournaments.local.active!.status).toBe('eliminated');
    expect(champion(advanceAI(lost.save.tournaments.local.active!))).not.toBe(playerIndex(lost.save.tournaments.local.active!));
  });
  it('requires qualification', () => {
    const s = defaultSave();
    expect(checkTournament(TOURNAMENT_MAP.elite, s).length).toBeGreaterThan(0);
    expect(checkTournament(TOURNAMENT_MAP.elite, s).some((x) => x.includes('50,000'))).toBe(true);
  });
});

describe('data integrity', () => {
  it('has 20+ rivals with valid parts and requirements', () => {
    expect(RIVALS.length).toBeGreaterThanOrEqual(20);
    const ids = new Set(RIVALS.map((r) => r.id));
    for (const r of RIVALS) {
      for (const k of ['layer', 'disc', 'driver', 'accessory'] as const) expect(PARTS.find((p) => p.id === r.bey[k])).toBeTruthy();
      for (const d of r.req.defeated ?? []) expect(ids.has(d)).toBe(true);
    }
  });
});

describe('persistence', () => {
  const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; }, m }; };
  it('migrates legacy v0 saves and keeps progress', () => {
    const legacy = { level: 4, xp: 10, points: 1234, profile: { name: 'Old' } };
    const s = sanitize(legacy)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.level).toBe(4);
    expect(s.points).toBe(1234);
  });
  it('handles corrupted saves by keeping a backup', () => {
    const st = mem();
    st.setItem(SAVE_KEY, '{not json');
    const r = loadSave(st);
    expect(r.save).toBeNull();
    expect(r.error).toBeTruthy();
    expect(st.m[SAVE_KEY + '.backup']).toBe('{not json');
  });
  it('never accepts negative balances', () => {
    expect(sanitize({ version: 1, points: -500 })!.points).toBe(0);
  });
});
