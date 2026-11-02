import { PARTS } from '../../data/parts';
import { RIVAL_MAP, look } from '../../data/rivals';
import { STADIUM_MAP } from '../../data/stadiums';
import { TOURNAMENT_MAP, type TournamentDef } from '../../data/tournaments';
import { AIController, hashString, mulberry32, runHeadless } from '../battle/ai/ai';
import { BattleSim } from '../battle/physics/sim';
import { computeStats } from '../customization/stats';
import { DIFFICULTIES, type BeyConfig, type Difficulty, type Finish, type Look, type Strategy, type HairStyle, type AccKind } from '../types';
import { createBracket, matchPair, recordWinner, type ActiveTournament } from './bracket';

export interface Competitor {
  id: string;
  name: string;
  title: string;
  look: Look;
  bey: BeyConfig;
  strategy: Strategy;
  difficulty: Difficulty;
}

const FIRST = ['Ren', 'Kai', 'Ayaka', 'Haru', 'Mio', 'Sota', 'Nina', 'Leo', 'Yuki', 'Tara', 'Dante', 'Ivy', 'Rex', 'Suzu', 'Orin', 'Vera', 'Milo', 'Zane', 'Lila', 'Noa', 'Hugo', 'Emi', 'Jax', 'Tess', 'Ryo', 'Cleo', 'Dai', 'Fumi'];
const LAST = ['Okabe', 'Frost', 'Marin', 'Voss', 'Tanaka', 'Reyes', 'Blackwood', 'Ito', 'Kovacs', 'Sato', 'Moreau', 'Hale', 'Navarro', 'Ono', 'Quill', 'Sterling', 'Mori', 'Dray', 'Kimura', 'Vance'];
const HAIRS = ['#2a1a12', '#ff9d3a', '#35d0ff', '#ff3d9a', '#7a4bff', '#e8e8f0', '#2fd6a4', '#c0182e', '#ffd24a', '#111118'];
const STYLES: HairStyle[] = ['spiky', 'bob', 'ponytail', 'long', 'mohawk', 'bun', 'short', 'twin', 'swept'];
const ACCS: AccKind[] = ['none', 'headband', 'goggles', 'glasses', 'cap', 'scarf', 'mask'];
const SKINS = ['#ffe0cc', '#f6c9a8', '#e0a97c', '#b97d55', '#8a5a3c'];
const OUTFIT = ['#2a6af0', '#ff3b3b', '#2fd6a4', '#ffd24a', '#b57cff', '#ff7a3a', '#35d0ff', '#ff6fa8'];
const STRATS: Strategy[] = ['aggressive', 'defensive', 'stamina', 'evasive', 'opportunist', 'adaptive'];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function genCompetitor(id: string): Competitor {
  const [, tid] = id.split(':');
  const t = TOURNAMENT_MAP[tid];
  const rng = mulberry32(hashString(id));
  const partLevel = t?.partLevel ?? 5;
  const choose = (slot: string) => {
    const pool = PARTS.filter((p) => p.slot === slot && !p.reward && p.unlockLevel <= partLevel);
    return pick(rng, pool);
  };
  const layer = choose('layer');
  const bey: BeyConfig = {
    name: `${pick(rng, ['Shadow', 'Blaze', 'Frost', 'Thunder', 'Silent', 'Rogue', 'Cosmic', 'Iron', 'Neon', 'Crimson'])} ${pick(rng, ['Wyvern', 'Talon', 'Pulse', 'Orbit', 'Fang', 'Comet', 'Bastion', 'Specter', 'Drake'])}`,
    color: layer.color,
    layer: layer.id,
    disc: choose('disc').id,
    driver: choose('driver').id,
    accessory: choose('accessory').id,
  };
  const baseIdx = DIFFICULTIES.indexOf(t?.difficulty ?? 'Normal');
  const di = Math.max(0, Math.min(5, baseIdx + (rng() < 0.3 ? -1 : 0)));
  const hair = pick(rng, HAIRS);
  return {
    id,
    name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
    title: t ? `${t.name} Contender` : 'Challenger',
    look: look({
      skin: pick(rng, SKINS), hair, hairStyle: pick(rng, STYLES), eyes: pick(rng, HAIRS),
      top: pick(rng, OUTFIT), top2: pick(rng, OUTFIT), pants: '#2a3050', acc: pick(rng, ACCS), accColor: pick(rng, OUTFIT),
      height: 0.92 + rng() * 0.2, build: 0.88 + rng() * 0.4, skirt: rng() < 0.25, coat: rng() < 0.3,
    }),
    bey,
    strategy: pick(rng, STRATS),
    difficulty: DIFFICULTIES[di],
  };
}

const cache = new Map<string, Competitor>();
export function getCompetitor(id: string): Competitor {
  const hit = cache.get(id);
  if (hit) return hit;
  let c: Competitor;
  if (id.startsWith('rival:')) {
    const r = RIVAL_MAP[id.slice(6)];
    c = { id, name: r.name, title: r.title, look: r.look, bey: r.bey, strategy: r.strategy, difficulty: r.difficulty };
  } else c = genCompetitor(id);
  cache.set(id, c);
  return c;
}

export function buildEntrants(t: TournamentDef, seed: number): string[] {
  const rng = mulberry32(seed);
  const ids: string[] = ['player'];
  for (const r of t.rivalIds) if (ids.length < t.size) ids.push(`rival:${r}`);
  let n = 0;
  while (ids.length < t.size) ids.push(`gen:${t.id}:${n++}`);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function newTournamentRun(t: TournamentDef, seed: number): ActiveTournament {
  return advanceAI(createBracket(t.id, seed, buildEntrants(t, seed)));
}

/** Deterministic AI-vs-AI match using the real battle simulation. */
export function simulateAiMatch(b: ActiveTournament, round: number, match: number, ai: [number, number]): { winner: number; finish: Finish } {
  const t = TOURNAMENT_MAP[b.id];
  const ca = getCompetitor(b.entrants[ai[0]]);
  const cb = getCompetitor(b.entrants[ai[1]]);
  const seed = hashString(`${b.seed}:${round}:${match}`);
  const sim = new BattleSim([computeStats(ca.bey), computeStats(cb.bey)], STADIUM_MAP[t.stadium], [0.9, 0.9]);
  const res = runHeadless(sim, new AIController({ strategy: ca.strategy, difficulty: ca.difficulty, seed }), new AIController({ strategy: cb.strategy, difficulty: cb.difficulty, seed: seed + 1 }))!;
  return { winner: res.winner === 0 ? ai[0] : ai[1], finish: res.finish };
}

/** Simulate every decided-participant match that does not involve the player. */
export function advanceAI(b: ActiveTournament): ActiveTournament {
  const p = b.entrants.indexOf('player');
  let cur = b;
  for (let r = 0; r < cur.winners.length; r++) {
    for (let m = 0; m < cur.winners[r].length; m++) {
      if (cur.winners[r][m] !== null) continue;
      const [x, y] = matchPair(cur, r, m);
      if (x === null || y === null || x === p || y === p) continue;
      const res = simulateAiMatch(cur, r, m, [x, y]);
      cur = recordWinner(cur, r, m, res.winner, res.finish);
    }
  }
  return cur;
}



