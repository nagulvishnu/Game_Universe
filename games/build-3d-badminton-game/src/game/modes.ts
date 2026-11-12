// Game mode definitions: match configs, tournament bracket, championship stages, drills.
import { ArenaId, DIFF_LIST, Difficulty, RuleCfg } from './constants';
import { RULE_PRESETS } from './rules';
import { DrillCfg, DrillKind, LaunchConfig, TeamCfg } from './sim';
import { Look, Settings } from './storage';

export type ModeId = 'quick' | 'versus' | 'solo' | 'coop' | 'tournament' | 'practice' | 'challenge' | 'championship';

export interface Setup {
  mode: ModeId;
  doubles: boolean;
  arena: ArenaId;
  preset: 'quick' | 'standard' | 'full';
  arcade: boolean;
  diff: Difficulty;
  drill: DrillKind;
}
export const DEFAULT_SETUP: Setup = { mode: 'quick', doubles: false, arena: 'neon', preset: 'quick', arcade: false, diff: 'medium', drill: 'free' };

export const MODE_INFO: Record<ModeId, { title: string; blurb: string; diffs: Difficulty[]; canDouble: boolean; fixedDouble?: boolean }> = {
  quick: { title: 'Quick Match', blurb: 'Pick singles or doubles, arena and scoring, then play.', diffs: DIFF_LIST, canDouble: true },
  versus: { title: 'Local 2-Player Versus', blurb: 'Two humans, split-screen, independent cameras.', diffs: DIFF_LIST, canDouble: true },
  solo: { title: 'Solo vs AI', blurb: 'Beat an AI that predicts and physically chases the shuttle.', diffs: DIFF_LIST.slice(0, 5), canDouble: false },
  coop: { title: 'Doubles Co-op Challenge', blurb: 'Two friends team up against two coordinated AI bots.', diffs: ['medium', 'hard', 'expert', 'legendary'], canDouble: false, fixedDouble: true },
  tournament: { title: 'AI Tournament', blurb: '8-entrant knockout: quarterfinals, semifinals, final.', diffs: DIFF_LIST, canDouble: true },
  practice: { title: 'Practice', blurb: 'Drills: serving, smashes, net shots, timing, movement, targets.', diffs: DIFF_LIST, canDouble: false },
  challenge: { title: 'Time Challenge', blurb: 'Beat the clock with targets, streaks, perfect smashes.', diffs: DIFF_LIST, canDouble: false },
  championship: { title: 'Championship', blurb: 'Six stages, unlockable arenas, final trophy.', diffs: DIFF_LIST, canDouble: false },
};

export const DRILLS: { kind: DrillKind; title: string; blurb: string; timeLimit: number; goal: number; challenge: boolean }[] = [
  { kind: 'free', title: 'Free Practice', blurb: 'Endless mixed feeds. Hit anything, build your streak.', timeLimit: 0, goal: 0, challenge: false },
  { kind: 'serve', title: 'Serving Practice', blurb: 'Serve into the diagonal court; hit the glowing zone.', timeLimit: 0, goal: 0, challenge: false },
  { kind: 'smash', title: 'Smash Practice', blurb: 'High lobs: jump (Space) and smash them down.', timeLimit: 0, goal: 0, challenge: false },
  { kind: 'net', title: 'Net Shot Practice', blurb: 'Soft drops over the net: reply with tight net shots (2).', timeLimit: 0, goal: 0, challenge: false },
  { kind: 'perfect', title: 'Perfect-Hit Training', blurb: 'Slow feeds. Watch the timing ring, hit on PERFECT.', timeLimit: 0, goal: 0, challenge: false },
  { kind: 'movement', title: 'Movement Training', blurb: 'Run to each cone. Sprint with Shift. 45 seconds.', timeLimit: 45, goal: 0, challenge: false },
  { kind: 'target', title: 'Target Practice', blurb: 'Land shots inside the glowing target zones.', timeLimit: 0, goal: 0, challenge: false },
  { kind: 'blitz', title: 'Target Blitz', blurb: '60 seconds: hit target zones for 500+ points.', timeLimit: 60, goal: 500, challenge: true },
  { kind: 'streak', title: 'Return Streak', blurb: 'Return 12 shots in a row. One miss ends the run.', timeLimit: 120, goal: 12, challenge: true },
  { kind: 'perfectSmash', title: 'Perfect-Smash Challenge', blurb: 'Land 5 perfect smashes before the clock hits 0.', timeLimit: 75, goal: 5, challenge: true },
  { kind: 'accuracy', title: 'Accuracy Challenge', blurb: '60 seconds: hit 60% of your returns into the targets.', timeLimit: 60, goal: 60, challenge: true },
];

const AI_NAMES = ['Kai Tanaka', 'Mira Voss', 'Rex Okafor', 'Yuki Mori', 'Zane Ortiz', 'Luna Reyes', 'Orion Pike', 'Sora Lind', 'Dax Moreau', 'Nova Chen'];
const aiLook = (i: number): Look => ({ name: AI_NAMES[i % AI_NAMES.length], color: (i * 3 + 1) % 8, outfit: i % 4, racket: (i * 2 + 3) % 6, trail: (i + 1) % 6 });

export function rulesFor(setup: Setup): RuleCfg {
  const p = RULE_PRESETS[setup.preset];
  return { pointsToWin: p.pointsToWin, cap: p.cap, gamesToWin: p.gamesToWin, doubles: setup.doubles, arcade: setup.arcade };
}

export function buildLaunch(setup: Setup, looks: [Look, Look], settings: Settings, overrides: Partial<LaunchConfig> = {}): LaunchConfig {
  const mode = setup.mode;
  const info = MODE_INFO[mode];
  const doubles = info.fixedDouble ? true : setup.doubles;
  const rules = { ...rulesFor({ ...setup, doubles }) };
  const L0 = looks[0], L1 = looks[1];
  const mk = (names: string[], humans: number[], diff: Difficulty, ls: Look[]): TeamCfg => ({ names, humans, diff, looks: ls });
  let teams: [TeamCfg, TeamCfg];
  let humans = 1;
  const diff = setup.diff;
  if (mode === 'versus') {
    humans = 2;
    teams = doubles
      ? [mk([L0.name, 'Partner A'], [0, -1], diff, [L0, aiLook(0)]), mk([L1.name, 'Partner B'], [1, -1], diff, [L1, aiLook(1)])]
      : [mk([L0.name], [0], diff, [L0]), mk([L1.name], [1], diff, [L1])];
  } else if (mode === 'coop') {
    humans = 2;
    teams = [mk([L0.name, L1.name], [0, 1], diff, [L0, L1]), mk([AI_NAMES[2], AI_NAMES[3]], [-1, -1], diff, [aiLook(2), aiLook(3)])];
  } else {
    humans = 1;
    teams = doubles
      ? [mk([L0.name, 'Partner'], [0, -1], diff, [L0, aiLook(5)]), mk([AI_NAMES[0], AI_NAMES[1]], [-1, -1], diff, [aiLook(0), aiLook(1)])]
      : [mk([L0.name], [0], diff, [L0]), mk([AI_NAMES[0]], [-1], diff, [aiLook(0)])];
  }
  return {
    kind: 'match', label: info.title, arena: setup.arena, rules, teams, humans, shortSide: settings.shortSide, ...overrides,
  };
}

export function buildDrill(setup: Setup, looks: [Look, Look], settings: Settings): LaunchConfig {
  const d = DRILLS.find((x) => x.kind === setup.drill)!;
  const drill: DrillCfg = { kind: d.kind, timeLimit: d.timeLimit, goal: d.goal, label: d.title };
  return {
    kind: 'drill', label: d.title, arena: setup.arena, drill, humans: 1, shortSide: settings.shortSide,
    rules: { pointsToWin: 99, cap: 99, gamesToWin: 1, doubles: false, arcade: false },
    teams: [
      { names: [looks[0].name], humans: [0], diff: 'medium', looks: [looks[0]] },
      { names: [], humans: [], diff: 'medium', looks: [] },
    ],
  };
}

export function attractConfig(arena: ArenaId): LaunchConfig {
  const t = (n: string, i: number): TeamCfg => ({ names: [n], humans: [-1], diff: 'expert', looks: [aiLook(i)] });
  return {
    kind: 'match', label: 'attract', arena, humans: 0, shortSide: 'screen',
    rules: { pointsToWin: 21, cap: 30, gamesToWin: 2, doubles: false, arcade: false },
    teams: [t('Kai', 0), t('Mira', 1)],
  };
}

// ---------------- Tournament ----------------
export interface Entrant { name: string; rating: number; human: boolean; look: Look; partner?: Look }
export interface TMatch { a: number; b: number; winner: number; score?: string }
export interface Tournament {
  doubles: boolean; arena: ArenaId; entrants: Entrant[]; rounds: TMatch[][]; round: number;
  champion: number; eliminated: boolean; humanIdx: number; diffBase: Difficulty;
}
export const ROUND_NAMES = ['Quarterfinal', 'Semifinal', 'Final'];

export function ratingToDiff(r: number): Difficulty {
  return r <= 1 ? 'easy' : r <= 3 ? 'medium' : r <= 5 ? 'hard' : r <= 6 ? 'expert' : 'legendary';
}

export function createTournament(doubles: boolean, arena: ArenaId, look: Look, base: Difficulty): Tournament {
  const baseIdx = Math.max(0, DIFF_LIST.indexOf(base));
  const ents: Entrant[] = [{ name: look.name, rating: 3, human: true, look }];
  for (let i = 0; i < 7; i++) {
    const r = Math.max(1, Math.min(7, baseIdx + 1 + Math.round((i - 3) / 2)));
    ents.push({ name: AI_NAMES[i], rating: r, human: false, look: aiLook(i), partner: aiLook(i + 4) });
  }
  // random seeding
  for (let i = ents.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [ents[i], ents[j]] = [ents[j], ents[i]]; }
  const humanIdx = ents.findIndex((e) => e.human);
  const first: TMatch[] = [];
  for (let i = 0; i < 8; i += 2) first.push({ a: i, b: i + 1, winner: -1 });
  const t: Tournament = { doubles, arena, entrants: ents, rounds: [first], round: 0, champion: -1, eliminated: false, humanIdx, diffBase: base };
  simulateAI(t);
  return t;
}

function simulateAI(t: Tournament) {
  const r = t.rounds[t.round];
  for (const m of r) {
    if (m.winner !== -1) continue;
    if (m.a === t.humanIdx || m.b === t.humanIdx) continue;
    const ra = t.entrants[m.a].rating, rb = t.entrants[m.b].rating;
    const pa = 1 / (1 + Math.exp(-(ra - rb) * 0.7));
    const aWins = Math.random() < pa;
    m.winner = aWins ? m.a : m.b;
    const lose = 6 + ((Math.random() * 5) | 0);
    m.score = aWins ? `11-${lose}` : `${lose}-11`;
  }
}

export function humanMatch(t: Tournament): TMatch | null {
  if (t.eliminated || t.champion !== -1) return null;
  return t.rounds[t.round].find((m) => m.a === t.humanIdx || m.b === t.humanIdx) ?? null;
}

export function reportTournament(t: Tournament, humanWon: boolean, score: string) {
  const m = humanMatch(t);
  if (!m) return;
  m.winner = humanWon ? t.humanIdx : m.a === t.humanIdx ? m.b : m.a;
  m.score = score;
  if (!humanWon) {
    t.eliminated = true;
    // finish out remaining rounds by simulation so the bracket is complete
    while (t.rounds.length < 3 || t.rounds[t.rounds.length - 1].some((x) => x.winner === -1)) {
      simulateAI(t);
      const r = t.rounds[t.round];
      for (const x of r) if (x.winner === -1) { x.winner = Math.random() < 0.5 ? x.a : x.b; x.score = '11-8'; }
      if (r.length === 1) { t.champion = r[0].winner; break; }
      advance(t);
    }
    return;
  }
  const r = t.rounds[t.round];
  if (r.length === 1) { t.champion = t.humanIdx; return; }
  simulateAI(t);
  advance(t);
}

function advance(t: Tournament) {
  const r = t.rounds[t.round];
  if (r.some((m) => m.winner === -1)) return;
  const next: TMatch[] = [];
  for (let i = 0; i < r.length; i += 2) next.push({ a: r[i].winner, b: r[i + 1].winner, winner: -1 });
  t.rounds.push(next);
  t.round++;
  simulateAI(t);
}

export function tournamentLaunch(t: Tournament, settings: Settings): LaunchConfig {
  const m = humanMatch(t)!;
  const me = t.entrants[t.humanIdx];
  const opp = t.entrants[m.a === t.humanIdx ? m.b : m.a];
  const final = t.round === 2;
  const rules: RuleCfg = { pointsToWin: 11, cap: 15, gamesToWin: final ? 2 : 1, doubles: t.doubles, arcade: false };
  const diff = ratingToDiff(opp.rating);
  const teams: [TeamCfg, TeamCfg] = t.doubles
    ? [
      { names: [me.name, 'Partner'], humans: [0, -1], diff, looks: [me.look, aiLook(6)] },
      { names: [opp.name, opp.partner!.name], humans: [-1, -1], diff, looks: [opp.look, opp.partner!] },
    ]
    : [
      { names: [me.name], humans: [0], diff, looks: [me.look] },
      { names: [opp.name], humans: [-1], diff, looks: [opp.look] },
    ];
  return {
    kind: 'match', label: `Tournament · ${ROUND_NAMES[t.round]}`, arena: t.arena, rules, teams, humans: 1,
    shortSide: settings.shortSide, context: { type: 'tournament' },
  };
}

// ---------------- Championship ----------------
export interface Stage { name: string; arena: ArenaId; diff: Difficulty; doubles: boolean; pts: number; games: number; unlocks: ArenaId | null; rival: number; blurb: string }
export const STAGES: Stage[] = [
  { name: 'City Open', arena: 'neon', diff: 'easy', doubles: false, pts: 11, games: 1, unlocks: 'tropical', rival: 0, blurb: 'Warm up under the neon lights.' },
  { name: 'Royal Cup', arena: 'royal', diff: 'medium', doubles: false, pts: 11, games: 1, unlocks: 'cyber', rival: 1, blurb: 'Impress the royal court.' },
  { name: 'Tropical Doubles', arena: 'tropical', diff: 'hard', doubles: true, pts: 11, games: 1, unlocks: 'mountain', rival: 2, blurb: 'Team up with an AI partner.' },
  { name: 'Cyber League', arena: 'cyber', diff: 'hard', doubles: false, pts: 15, games: 1, unlocks: 'grand', rival: 3, blurb: 'Fast, futuristic and ruthless.' },
  { name: 'Mountain Masters', arena: 'mountain', diff: 'expert', doubles: false, pts: 15, games: 1, unlocks: null, rival: 4, blurb: 'Thin air, thinner margins.' },
  { name: 'Grand International Final', arena: 'grand', diff: 'legendary', doubles: false, pts: 11, games: 2, unlocks: null, rival: 5, blurb: 'Best of three for the world title.' },
];

export function stageLaunch(i: number, look: Look, settings: Settings): LaunchConfig {
  const s = STAGES[i];
  const rules: RuleCfg = { pointsToWin: s.pts, cap: s.pts + 4, gamesToWin: s.games, doubles: s.doubles, arcade: false };
  const rv = aiLook(s.rival);
  const teams: [TeamCfg, TeamCfg] = s.doubles
    ? [
      { names: [look.name, 'Partner'], humans: [0, -1], diff: s.diff, looks: [look, aiLook(7)] },
      { names: [rv.name, aiLook(s.rival + 3).name], humans: [-1, -1], diff: s.diff, looks: [rv, aiLook(s.rival + 3)] },
    ]
    : [
      { names: [look.name], humans: [0], diff: s.diff, looks: [look] },
      { names: [rv.name], humans: [-1], diff: s.diff, looks: [rv] },
    ];
  return {
    kind: 'match', label: `Championship · ${s.name}`, arena: s.arena, rules, teams, humans: 1,
    shortSide: settings.shortSide, context: { type: 'championship', stage: i },
  };
}
