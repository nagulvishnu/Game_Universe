// Shared constants & types for Badminton Masters
export const COURT = {
  halfLen: 6.7,
  halfWidthD: 3.05,
  halfWidthS: 2.59,
  shortService: 1.98,
  longServiceD: 5.94,
  netH: 1.524,
  netPostH: 1.55,
};

export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' | 'legendary';
export const DIFF_LIST: Difficulty[] = ['beginner', 'easy', 'medium', 'hard', 'expert', 'legendary'];

export interface DiffParams {
  label: string;
  react: number; // seconds before AI reacts to a new hit
  speed: number; // movement speed multiplier
  predErr: number; // landing prediction error (m)
  judge: number; // chance to correctly judge out balls
  jump: number; // chance to jump for high shuttles
  aggr: number; // attacking tendency
  thr: number; // min contact quality before swinging
  jit: number; // swing timing jitter (s)
  bias: number; // hand skill added to contact score
  special: number; // chance to use special meter
}

export const DIFF: Record<Difficulty, DiffParams> = {
  beginner: { label: 'Beginner', react: 0.55, speed: 0.72, predErr: 1.6, judge: 0.35, jump: 0.05, aggr: 0.1, thr: 0.3, jit: 0.07, bias: -0.2, special: 0 },
  easy: { label: 'Easy', react: 0.4, speed: 0.82, predErr: 1.0, judge: 0.6, jump: 0.2, aggr: 0.25, thr: 0.4, jit: 0.05, bias: -0.11, special: 0.1 },
  medium: { label: 'Medium', react: 0.26, speed: 0.92, predErr: 0.5, judge: 0.8, jump: 0.4, aggr: 0.4, thr: 0.5, jit: 0.032, bias: -0.04, special: 0.3 },
  hard: { label: 'Hard', react: 0.16, speed: 1.0, predErr: 0.25, judge: 0.92, jump: 0.65, aggr: 0.55, thr: 0.58, jit: 0.02, bias: 0.03, special: 0.6 },
  expert: { label: 'Expert', react: 0.1, speed: 1.06, predErr: 0.1, judge: 0.98, jump: 0.85, aggr: 0.7, thr: 0.64, jit: 0.012, bias: 0.08, special: 0.85 },
  legendary: { label: 'Legendary', react: 0.06, speed: 1.12, predErr: 0.04, judge: 1, jump: 1, aggr: 0.85, thr: 0.7, jit: 0.006, bias: 0.13, special: 1 },
};

export type ArenaId = 'neon' | 'royal' | 'tropical' | 'cyber' | 'mountain' | 'grand';
export const ARENA_LIST: { id: ArenaId; name: string; blurb: string }[] = [
  { id: 'neon', name: 'Neon Sports Arena', blurb: 'Electric night-court with pulsing light tubes.' },
  { id: 'royal', name: 'Royal Championship Stadium', blurb: 'Crimson, gold and polished hardwood.' },
  { id: 'tropical', name: 'Tropical Indoor Arena', blurb: 'Open-air pavilion with palms and sea breeze.' },
  { id: 'cyber', name: 'Cyber Future Arena', blurb: 'Holographic grid, floating rings and neon rails.' },
  { id: 'mountain', name: 'Mountain Sports Pavilion', blurb: 'Timber hall below snowy alpine peaks.' },
  { id: 'grand', name: 'Grand International Arena', blurb: 'The world final: tiered stands and banners.' },
];

export interface RuleCfg {
  pointsToWin: number;
  cap: number;
  gamesToWin: number;
  doubles: boolean;
  arcade: boolean;
}

export const FIXED_DT = 1 / 120;
export const CONTACT_DELAY = 0.13;
