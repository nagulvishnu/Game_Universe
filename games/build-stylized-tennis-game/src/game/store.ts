import { useSyncExternalStore } from 'react';
import { defaultLook, type Look } from './constants';

export interface PadMap {
  long: number;
  short: number;
  right: number;
  left: number;
  special: number;
  sprint: number;
  camera: number;
  pause: number;
}
export const DEFAULT_PAD: PadMap = { long: 0, short: 1, right: 2, left: 3, special: 5, sprint: 4, camera: 8, pause: 9 };

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  crowd: number;
  musicOn: boolean;
  sfxOn: boolean;
  speech: boolean;
  camSens: number;
  shake: boolean;
  slowmo: boolean;
  quality: 'auto' | 'low' | 'medium' | 'high';
  touch: 'auto' | 'on' | 'off';
  padFor: 1 | 2;
  pad: PadMap;
  hints: boolean;
}
export interface Profile {
  name: string;
  look: Look;
}
export interface Stats {
  matches: number;
  wins: number;
  points: number;
  aces: number;
  winners: number;
  perfects: number;
  maxRally: number;
  seconds: number;
  trophies: number;
  champWins: number;
}
export interface ScoreEntry {
  name: string;
  score: number;
  mode: string;
  detail: string;
  date: number;
}
export interface Champ {
  stage: number; // next stage to play (0..6)
  stars: number[];
}
export interface AppData {
  settings: Settings;
  p1: Profile;
  p2: Profile;
  stats: Stats;
  scores: ScoreEntry[];
  champ: Champ;
}

const KEY = 'tennis-masters-v1';
const initial = (): AppData => ({
  settings: { master: 0.8, music: 0.5, sfx: 0.9, crowd: 0.6, musicOn: true, sfxOn: true, speech: true, camSens: 1, shake: true, slowmo: true, quality: 'auto', touch: 'auto', padFor: 1, pad: { ...DEFAULT_PAD }, hints: true },
  p1: { name: 'Player 1', look: defaultLook(0) },
  p2: { name: 'Player 2', look: defaultLook(1) },
  stats: { matches: 0, wins: 0, points: 0, aces: 0, winners: 0, perfects: 0, maxRally: 0, seconds: 0, trophies: 0, champWins: 0 },
  scores: [],
  champ: { stage: 0, stars: [] },
});

function load(): AppData {
  const d = initial();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<AppData>;
      return {
        settings: { ...d.settings, ...j.settings, pad: { ...d.settings.pad, ...(j.settings?.pad ?? {}) } },
        p1: { ...d.p1, ...j.p1, look: { ...d.p1.look, ...(j.p1?.look ?? {}) } },
        p2: { ...d.p2, ...j.p2, look: { ...d.p2.look, ...(j.p2?.look ?? {}) } },
        stats: { ...d.stats, ...j.stats },
        scores: Array.isArray(j.scores) ? j.scores : [],
        champ: { ...d.champ, ...j.champ },
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return d;
}

let data: AppData = load();
const subs = new Set<() => void>();
export const getData = () => data;
export function update(fn: (d: AppData) => void) {
  const next: AppData = JSON.parse(JSON.stringify(data));
  fn(next);
  data = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
  subs.forEach((s) => s());
}
export function useData(): AppData {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => data,
  );
}

export function addScore(e: Omit<ScoreEntry, 'date'>): number {
  let rank = -1;
  update((d) => {
    d.scores.push({ ...e, date: Date.now() });
    d.scores.sort((a, b) => b.score - a.score);
    rank = d.scores.findIndex((s) => s.score === e.score && s.name === e.name && s.mode === e.mode);
    d.scores = d.scores.slice(0, 20);
  });
  return rank;
}
export function resetAll() {
  data = initial();
  localStorage.removeItem(KEY);
  subs.forEach((s) => s());
}
export const unlockedStage = () => data.champ.stage;
