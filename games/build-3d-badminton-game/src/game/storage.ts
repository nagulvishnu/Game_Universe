// Local persistence: settings, customization, high scores, stats and progression.
import { ArenaId } from './constants';

export interface Settings {
  master: number; music: number; sfx: number; crowd: number; voice: number;
  shortSide: 'screen' | 'opponent';
  quality: 'auto' | 'high' | 'low';
  shake: boolean;
  padMap: Record<string, number>;
}
export const DEFAULT_PADMAP: Record<string, number> = { jump: 0, clear: 2, drop: 3, right: 1, left: 4, sprint: 7, camera: 8 };
export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, music: 0.45, sfx: 0.9, crowd: 0.6, voice: 0.7,
  shortSide: 'screen', quality: 'auto', shake: true, padMap: { ...DEFAULT_PADMAP },
};

export interface Look { name: string; color: number; outfit: number; racket: number; trail: number; }

export const COLORS = ['#ff4d6d', '#2ec4ff', '#ffd23f', '#5dff8a', '#b46bff', '#ff8a3d', '#ffffff', '#22d3b6'];
export const OUTFITS = ['Classic', 'Stripe', 'Sleeveless', 'Pro Contrast'];
export const RACKETS = [
  { name: 'Carbon', frame: '#2b2d3a', string: '#e8f0ff' },
  { name: 'Crimson', frame: '#e11d48', string: '#ffe4ea' },
  { name: 'Aqua', frame: '#06b6d4', string: '#e0fbff' },
  { name: 'Gold', frame: '#f5b301', string: '#fff7d6' },
  { name: 'Neon', frame: '#7cff3a', string: '#eaffd8' },
  { name: 'Royal', frame: '#6d28d9', string: '#efe4ff' },
];
export const TRAILS = [
  { name: 'Comet', color: '#8be9ff', rainbow: false },
  { name: 'Ember', color: '#ff9a3c', rainbow: false },
  { name: 'Plasma', color: '#ff5ce1', rainbow: false },
  { name: 'Rainbow', color: '#ffffff', rainbow: true },
  { name: 'Gold Dust', color: '#ffd84a', rainbow: false },
  { name: 'Ghost', color: '#e8eefc', rainbow: false },
];

export const DEFAULT_LOOKS: [Look, Look] = [
  { name: 'Player 1', color: 0, outfit: 1, racket: 1, trail: 0 },
  { name: 'Player 2', color: 1, outfit: 0, racket: 2, trail: 1 },
];

export interface HighScore { name: string; score: number; mode: string; date: number; detail: string; }
export interface Stats {
  matches: number; wins: number; losses: number; points: number; pointsLost: number;
  perfect: number; smashes: number; longestRally: number; playSeconds: number;
  tournamentTitles: number; championships: number; hits: number; drills: number;
}
export const DEFAULT_STATS: Stats = {
  matches: 0, wins: 0, losses: 0, points: 0, pointsLost: 0, perfect: 0, smashes: 0,
  longestRally: 0, playSeconds: 0, tournamentTitles: 0, championships: 0, hits: 0, drills: 0,
};
export interface Progress { unlocked: ArenaId[]; stageCleared: number; }
export const DEFAULT_PROGRESS: Progress = { unlocked: ['neon', 'royal'], stageCleared: 0 };

function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem('bm:' + key);
    if (!raw) return structuredClone(def);
    const v = JSON.parse(raw);
    if (Array.isArray(def)) return (Array.isArray(v) ? v : def) as T;
    return typeof def === 'object' && def ? ({ ...structuredClone(def), ...v } as T) : (v as T);
  } catch {
    return structuredClone(def);
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem('bm:' + key, JSON.stringify(v)); } catch { /* ignore quota / private mode */ }
}

export const store = {
  settings: () => load<Settings>('settings', DEFAULT_SETTINGS),
  saveSettings: (s: Settings) => save('settings', s),
  looks: () => load<[Look, Look]>('looks', DEFAULT_LOOKS),
  saveLooks: (l: [Look, Look]) => save('looks', l),
  scores: () => load<HighScore[]>('scores', []),
  addScore: (h: HighScore): HighScore[] => {
    const all = [...load<HighScore[]>('scores', []), h].sort((a, b) => b.score - a.score).slice(0, 50);
    save('scores', all);
    return all;
  },
  clearScores: () => save('scores', []),
  stats: () => load<Stats>('stats', DEFAULT_STATS),
  saveStats: (s: Stats) => save('stats', s),
  progress: () => load<Progress>('progress', DEFAULT_PROGRESS),
  saveProgress: (p: Progress) => save('progress', p),
};
