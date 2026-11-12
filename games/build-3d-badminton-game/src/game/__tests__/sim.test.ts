import { describe, expect, it } from 'vitest';
import { LaunchConfig, Sim, noInput } from '../sim';
import { Difficulty } from '../constants';

function cfg(opts: { doubles?: boolean; d0?: Difficulty; d1?: Difficulty; humans0?: number[]; pts?: number; seed?: number; arcade?: boolean }): LaunchConfig {
  const n = opts.doubles ? 2 : 1;
  const team = (names: string[], humans: number[], diff: Difficulty) => ({ names, humans, diff, looks: names.map(() => null) });
  return {
    kind: 'match', label: 't', arena: 'neon', humans: 0, shortSide: 'screen', seed: opts.seed ?? 1,
    rules: { pointsToWin: opts.pts ?? 11, cap: (opts.pts ?? 11) + 4, gamesToWin: 1, doubles: !!opts.doubles, arcade: !!opts.arcade },
    teams: [
      team(n === 2 ? ['A1', 'A2'] : ['A'], opts.humans0 ?? Array(n).fill(-1), opts.d0 ?? 'medium'),
      team(n === 2 ? ['B1', 'B2'] : ['B'], Array(n).fill(-1), opts.d1 ?? 'medium'),
    ],
  };
}

function runMatch(sim: Sim, maxSec = 900) {
  const inputs = [noInput(), noInput()];
  let maxJump = 0;
  let last = { x: sim.shuttle.x, y: sim.shuttle.y, z: sim.shuttle.z };
  const grades: Record<string, number> = { poor: 0, normal: 0, good: 0, perfect: 0 };
  const shots: Record<string, number> = {};
  let specials = 0, hits = 0, maxPlayerStep = 0;
  const pp = sim.players.map((p) => ({ x: p.x, z: p.z }));
  for (let t = 0; t < maxSec * 60 && sim.phase !== 'over'; t++) {
    sim.update(1 / 60, inputs);
    const sh = sim.shuttle;
    if (sh.active) maxJump = Math.max(maxJump, Math.hypot(sh.x - last.x, sh.y - last.y, sh.z - last.z));
    last = { x: sh.x, y: sh.y, z: sh.z };
    sim.players.forEach((p, i) => {
      expect(Number.isFinite(p.x + p.z + p.y)).toBe(true);
      if (sim.phase === 'rally') maxPlayerStep = Math.max(maxPlayerStep, Math.hypot(p.x - pp[i].x, p.z - pp[i].z));
      pp[i] = { x: p.x, z: p.z };
    });
    for (const e of sim.drainEvents()) {
      if (e.t === 'hit' && !e.serve) { grades[e.grade]++; hits++; shots[e.shot] = (shots[e.shot] ?? 0) + 1; if (e.special) specials++; }
    }
    expect(Number.isFinite(sh.x + sh.y + sh.z)).toBe(true);
  }
  return { maxJump, grades, shots, specials, hits, maxPlayerStep };
}

describe('AI matches (headless)', () => {
  it('singles medium vs medium completes with real rallies, no teleporting', () => {
    const sim = new Sim(cfg({ seed: 3 }));
    const r = runMatch(sim);
    expect(sim.phase).toBe('over');
    expect(sim.stats.rallies).toBeGreaterThanOrEqual(11);
    expect(sim.stats.longest).toBeGreaterThan(3);
    // shuttle moves < 2.5 m per 1/60 s (max launch speed ~62 m/s => 1.03 m)
    expect(r.maxJump).toBeLessThan(1.6);
    // players never exceed sprint speed*1.12 *dt (~0.14)
    expect(r.maxPlayerStep).toBeLessThan(0.2);
    console.log('singles med/med', JSON.stringify({ rallies: sim.stats.rallies, longest: sim.stats.longest, grades: r.grades, shots: r.shots, specials: r.specials, score: [sim.rules.teams[0].score, sim.rules.teams[1].score], dur: Math.round(sim.time) }));
  });

  it('doubles AI completes and both partners hit', () => {
    const sim = new Sim(cfg({ doubles: true, d0: 'hard', d1: 'hard', seed: 5 }));
    runMatch(sim);
    expect(sim.phase).toBe('over');
    const hitters = sim.players.map((p) => p.stats.hits);
    console.log('doubles hits per player', hitters, 'longest', sim.stats.longest, 'rallies', sim.stats.rallies);
    for (const h of hitters) expect(h).toBeGreaterThan(2);
  });

  it('difficulty ordering: expert beats beginner, legendary beats medium mostly', () => {
    let expertWins = 0, legWins = 0;
    for (let s = 1; s <= 4; s++) {
      const a = new Sim(cfg({ d0: 'expert', d1: 'beginner', seed: s * 11 }));
      runMatch(a);
      if (a.winner === 0) expertWins++;
      const b = new Sim(cfg({ d0: 'legendary', d1: 'medium', seed: s * 13 }));
      runMatch(b);
      if (b.winner === 0) legWins++;
    }
    console.log({ expertWins, legWins });
    expect(expertWins).toBeGreaterThanOrEqual(3);
    expect(legWins).toBeGreaterThanOrEqual(3);
  });

  it('a human-controlled player (scripted) can serve and the serve is physical', () => {
    const sim = new Sim(cfg({ humans0: [0], d1: 'easy', seed: 9 }));
    const inputs = [noInput(), noInput()];
    for (let i = 0; i < 60 * 3 && sim.phase !== 'serve'; i++) sim.update(1 / 60, inputs);
    expect(sim.phase).toBe('serve');
    inputs[0] = { ...noInput(), shot: 2 };
    sim.update(1 / 60, inputs);
    inputs[0] = noInput();
    let served = false, maxStep = 0, prev = { ...sim.shuttle };
    for (let i = 0; i < 120 && !served; i++) {
      sim.update(1 / 60, inputs);
      maxStep = Math.max(maxStep, Math.hypot(sim.shuttle.x - prev.x, sim.shuttle.z - prev.z));
      prev = { ...sim.shuttle };
      for (const e of sim.drainEvents()) if (e.t === 'hit' && e.serve) served = true;
    }
    expect(served).toBe(true);
    expect(sim.phase).toBe('rally');
    expect(maxStep).toBeLessThan(1.2);
  });

  it('practice drills run: feeder feeds, scoring works', () => {
    const c = cfg({ humans0: [0] });
    c.kind = 'drill';
    c.teams[1] = { names: [], humans: [], diff: 'medium', looks: [] };
    c.drill = { kind: 'free', timeLimit: 0, goal: 0, label: 'free' };
    const sim = new Sim(c);
    const inputs = [noInput(), noInput()];
    let feeds = 0;
    for (let i = 0; i < 60 * 12; i++) {
      sim.update(1 / 60, inputs);
      for (const e of sim.drainEvents()) if (e.t === 'feed') feeds++;
    }
    expect(feeds).toBeGreaterThanOrEqual(3);
    expect(sim.drill!.misses).toBeGreaterThanOrEqual(2);
  });
});
