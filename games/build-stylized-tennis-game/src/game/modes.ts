import {
  COURTS,
  RULE_PRESETS,
  PERSONALITIES,
  defaultLook,
  type CourtId,
  type DrillType,
  type MatchConfig,
  type ModeId,
  type Personality,
  type PlayerSpec,
  type Rules,
} from './constants';
import type { AppData } from './store';

export interface Setup {
  mode: ModeId;
  doubles: boolean;
  courtId: CourtId;
  rulePreset: string;
  rules: Rules;
  level: number; // 1..6
  personality: Personality | 'random';
  drill: DrillType;
  coopTournament: boolean;
}
export const defaultSetup = (mode: ModeId): Setup => ({
  mode,
  doubles: mode === 'coop',
  courtId: 'neon',
  rulePreset: 'blitz',
  rules: { ...RULE_PRESETS[0].rules },
  level: mode === 'coop' ? 4 : 3,
  personality: 'random',
  drill: mode === 'challenge' ? 'free' : 'free',
  coopTournament: false,
});

const AI_NAMES = ['Aiko Tanaka', 'Marco Ricci', 'Zara Khan', 'Leo Santos', 'Mina Park', 'Ivan Volkov', 'Nia Okoye', 'Theo Laurent', 'Sofia Reyes', 'Kai Nakamura', 'Luca Bianchi', 'Priya Rao', 'Hugo Weber', 'Amara Diallo', 'Noah Fischer', 'Yuki Mori'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shuffle = <T,>(a: T[]) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

let aiLookIdx = 2;
const aiSpec = (name: string, level: number, pers: Personality | 'random'): PlayerSpec => ({
  name,
  human: -1,
  level: Math.max(1, Math.min(6, Math.round(level))),
  personality: pers === 'random' ? pick(PERSONALITIES) : pers,
  look: { ...defaultLook(aiLookIdx++), racketFx: 0 },
});
const humanSpec = (data: AppData, i: 0 | 1): PlayerSpec => {
  const pr = i === 0 ? data.p1 : data.p2;
  return { name: pr.name || `Player ${i + 1}`, human: i, level: 1, personality: 'balanced', look: pr.look };
};

export const multiplierFor = (level: number) => 1 + (level - 1) * 0.25;

export function buildMatch(s: Setup, data: AppData, override?: Partial<MatchConfig>): MatchConfig {
  const names = shuffle(AI_NAMES);
  const lvl = s.level;
  const pers = s.personality;
  const ai = (i: number, l = lvl) => aiSpec(names[i], l, pers);
  let teams: [PlayerSpec[], PlayerSpec[]];
  let doubles = s.doubles;
  let label = '';
  switch (s.mode) {
    case 'versus':
      teams = doubles ? [[humanSpec(data, 0), ai(0)], [humanSpec(data, 1), ai(1)]] : [[humanSpec(data, 0)], [humanSpec(data, 1)]];
      label = 'Local Versus';
      break;
    case 'coop':
      doubles = true;
      teams = [[humanSpec(data, 0), humanSpec(data, 1)], [ai(0), ai(1)]];
      label = 'Doubles Co-op';
      break;
    case 'practice':
    case 'challenge':
      doubles = false;
      teams = [[humanSpec(data, 0)], []];
      label = s.mode === 'practice' ? 'Practice' : 'Time Challenge';
      break;
    default:
      teams = doubles ? [[humanSpec(data, 0), ai(0, Math.max(1, lvl - 0))], [ai(1), ai(2)]] : [[humanSpec(data, 0)], [ai(0)]];
      label = s.mode === 'quick' ? 'Quick Match' : 'Solo vs AI';
  }
  const cfg: MatchConfig = {
    mode: s.mode,
    doubles,
    courtId: s.courtId,
    rules: { ...s.rules },
    teams,
    drill: s.mode === 'practice' || s.mode === 'challenge' ? s.drill : undefined,
    challengeSecs: 60,
    label,
    multiplier: multiplierFor(lvl),
    ...override,
  };
  return cfg;
}

export const DRILLS: { id: DrillType; name: string; desc: string; challenge: string }[] = [
  { id: 'free', name: 'Free Practice', desc: 'Ball machine feeds balls. Rally freely.', challenge: 'Score Attack: return as many balls as you can in 60 s.' },
  { id: 'serve', name: 'Serve Practice', desc: 'Serve into the box. Hit the target for bonus.', challenge: '—' },
  { id: 'target', name: 'Target Practice', desc: 'Land returns on the glowing targets.', challenge: 'Target Blitz: smash as many targets as you can in 60 s.' },
  { id: 'perfect', name: 'Perfect-Hit Training', desc: 'Master the timing ring. Build perfect streaks.', challenge: 'Special Hits: land the most perfect hits in 60 s.' },
  { id: 'movement', name: 'Movement Training', desc: 'Sprint to the cones. Learn footwork.', challenge: '—' },
  { id: 'accuracy', name: 'Shot Accuracy', desc: '20 balls — land close to the bullseye.', challenge: 'Accuracy Test: 15 balls, closest to the bullseye wins.' },
];
export const CHALLENGE_DRILLS: DrillType[] = ['free', 'target', 'accuracy', 'perfect'];

// ------------------------------------------------------------------ championship
export interface Stage {
  name: string;
  opponent: string;
  level: number;
  personality: Personality;
  courtId: CourtId;
  rules: Rules;
  blurb: string;
}
const R3: Rules = { setsToWin: 1, games: 3, tiebreak: true, noAd: true, pace: 1 };
export const STAGES: Stage[] = [
  { name: 'Rookie Cup', opponent: 'Pip Hollis', level: 1, personality: 'balanced', courtId: 'neon', rules: R3, blurb: 'Warm up under the neon lights.' },
  { name: 'City Open', opponent: 'Marco Ricci', level: 2, personality: 'defensive', courtId: 'tropical', rules: R3, blurb: 'Clay slows the ball. Be patient.' },
  { name: 'Grand Qualifier', opponent: 'Zara Khan', level: 3, personality: 'aggressive', courtId: 'stadium', rules: { ...R3, games: 4, noAd: false }, blurb: 'The crowd is watching on grass.' },
  { name: 'Sunset Classic', opponent: 'Leo Santos', level: 4, personality: 'tactical', courtId: 'sunset', rules: { ...R3, games: 4, noAd: false }, blurb: 'Heavy sand, clever opponent.' },
  { name: 'Alpine Masters', opponent: 'Ivan Volkov', level: 5, personality: 'aggressive', courtId: 'mountain', rules: { setsToWin: 2, games: 3, tiebreak: true, noAd: true, pace: 1 }, blurb: 'Best of three in thin air.' },
  { name: 'Cyber Finals', opponent: 'NEXUS-9', level: 6, personality: 'tactical', courtId: 'cyber', rules: { setsToWin: 2, games: 3, tiebreak: true, noAd: true, pace: 1 }, blurb: 'Beat the machine for the Master Trophy.' },
];
export function stageMatch(i: number, data: AppData): MatchConfig {
  const st = STAGES[i];
  return {
    mode: 'champ',
    doubles: false,
    courtId: st.courtId,
    rules: st.rules,
    teams: [[humanSpec(data, 0)], [aiSpec(st.opponent, st.level, st.personality)]],
    label: `Championship · ${st.name}`,
    multiplier: multiplierFor(st.level),
    meta: { stage: i },
  };
}
export const courtUnlocked = (id: CourtId, champStage: number) => (COURTS.find((c) => c.id === id)?.unlock ?? 0) <= champStage;

// ------------------------------------------------------------------ tournament
export interface TEntry {
  id: number;
  name: string;
  members: string[];
  level: number;
  human: boolean;
}
export interface Tournament {
  doubles: boolean;
  coop: boolean;
  courtId: CourtId;
  rules: Rules;
  entries: TEntry[];
  rounds: number[][]; // entry ids per round position (-1 = undecided)
  round: number;
  played: { a: number; b: number; w: number; text: string }[][];
  eliminated: boolean;
  champion: number;
  baseLevel: number;
}
export const ROUND_NAMES = ['Quarterfinal', 'Semifinal', 'Final'];

export function newTournament(s: Setup, data: AppData): Tournament {
  const names = shuffle(AI_NAMES);
  const entries: TEntry[] = [];
  const base = s.level;
  const p1 = data.p1.name || 'Player 1';
  const p2 = data.p2.name || 'Player 2';
  const doubles = s.doubles;
  const coop = doubles && s.coopTournament;
  entries.push({ id: 0, name: doubles ? `${p1} / ${coop ? p2 : 'CPU Partner'}` : p1, members: doubles ? [p1, coop ? p2 : 'CPU Partner'] : [p1], level: base, human: true });
  for (let i = 1; i < 8; i++) {
    const lv = Math.max(1, Math.min(6, base - 1 + Math.floor(Math.random() * 3)));
    entries.push({ id: i, name: doubles ? `${names[i * 2]} / ${names[i * 2 + 1]}` : names[i], members: doubles ? [names[i * 2], names[i * 2 + 1]] : [names[i]], level: lv, human: false });
  }
  const order = shuffle(entries.map((e) => e.id));
  return { doubles, coop, courtId: s.courtId, rules: { ...s.rules }, entries, rounds: [order, [-1, -1, -1, -1], [-1, -1], [-1]], round: 0, played: [[], [], []], eliminated: false, champion: -1, baseLevel: base };
}
/** index of the match (pair) containing the human entry in the current round, or -1 */
export function humanMatch(t: Tournament): number {
  const r = t.rounds[t.round];
  for (let m = 0; m < r.length / 2; m++) if (r[m * 2] === 0 || r[m * 2 + 1] === 0) return m;
  return -1;
}
export function tournamentMatchConfig(t: Tournament, data: AppData): MatchConfig {
  const m = humanMatch(t);
  const r = t.rounds[t.round];
  const opp = t.entries[r[m * 2] === 0 ? r[m * 2 + 1] : r[m * 2]];
  const lvl = Math.min(6, opp.level + (t.round === 2 ? 1 : 0));
  const mk = (e: TEntry, i: number) => aiSpec(e.members[i] ?? e.name, lvl, 'random');
  const humanTeam: PlayerSpec[] = t.doubles ? [humanSpec(data, 0), t.coop ? humanSpec(data, 1) : aiSpec('CPU Partner', Math.max(2, t.baseLevel), 'balanced')] : [humanSpec(data, 0)];
  const oppTeam = t.doubles ? [mk(opp, 0), mk(opp, 1)] : [mk(opp, 0)];
  return {
    mode: 'tournament',
    doubles: t.doubles,
    courtId: t.courtId,
    rules: t.rules,
    teams: [humanTeam, oppTeam],
    label: `${ROUND_NAMES[t.round]} vs ${opp.name}`,
    multiplier: multiplierFor(lvl),
    meta: { tournament: true },
  };
}
const strength = (e: TEntry) => e.level + Math.random() * 2.2;
function simMatch(t: Tournament, m: number, forceWinner?: number) {
  const r = t.rounds[t.round];
  const a = r[m * 2];
  const b = r[m * 2 + 1];
  let w = forceWinner ?? (strength(t.entries[a]) >= strength(t.entries[b]) ? a : b);
  const loserGames = Math.floor(Math.random() * 3);
  const text = w === a || forceWinner !== undefined ? `${t.rules.games}-${loserGames}` : `${t.rules.games}-${loserGames}`;
  t.played[t.round].push({ a, b, w, text });
  t.rounds[t.round + 1][m] = w;
  w = 0;
}
/** Record the human match result and simulate the rest of the round. */
export function finishRound(t: Tournament, humanWon: boolean, scoreText: string): Tournament {
  const n: Tournament = JSON.parse(JSON.stringify(t));
  const hm = humanMatch(n);
  const r = n.rounds[n.round];
  if (hm >= 0) {
    const a = r[hm * 2];
    const b = r[hm * 2 + 1];
    const w = humanWon ? 0 : a === 0 ? b : a;
    n.played[n.round].push({ a, b, w, text: scoreText });
    n.rounds[n.round + 1][hm] = w;
    if (!humanWon) n.eliminated = true;
  }
  for (let m = 0; m < r.length / 2; m++) if (m !== hm) simMatch(n, m);
  n.round++;
  if (n.round >= 3) {
    n.champion = n.rounds[3][0];
  }
  return n;
}
/** If the human is out, play the remaining rounds out automatically. */
export function simulateRest(t: Tournament): Tournament {
  const n: Tournament = JSON.parse(JSON.stringify(t));
  while (n.round < 3) {
    const r = n.rounds[n.round];
    for (let m = 0; m < r.length / 2; m++) simMatch(n, m);
    n.round++;
  }
  n.champion = n.rounds[3][0];
  return n;
}

// ------------------------------------------------------------------ scoring
export interface ResultStats {
  points: number;
  aces: number;
  winners: number;
  ue: number;
  df: number;
  perfects: number;
  hits: number;
}
export function arcadeScore(st: ResultStats, won: boolean, maxRally: number, mult: number) {
  const raw = st.points * 100 + st.perfects * 50 + st.winners * 75 + st.aces * 150 + maxRally * 20 - st.ue * 25 + (won ? 1500 : 0);
  return Math.max(0, Math.round(raw * mult));
}
