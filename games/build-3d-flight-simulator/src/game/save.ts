// Local persistence (isolated key so it never collides with a host "Game Universe" site).
export interface Settings {
  volume: number;
  muted: boolean;
  assist: boolean;
  invertPitch: boolean;
  quality: 'low' | 'medium' | 'high';
  units: 'aviation' | 'metric';
  timeScale: number; // day/night cycle speed (1 = 1 game minute per second)
  hints: boolean;
  fov: number;
}

export interface SaveData {
  credits: number;
  xp: number;
  stars: Record<string, number>;
  best: Record<string, number>;
  careerDone: string[];
  totals: { flights: number; landings: number; crashes: number; distanceKm: number; hours: number; maxAlt: number; maxSpeed: number; kills: number; rescues: number };
  settings: Settings;
  lastAircraft: string;
  lastLivery: number;
}

const KEY = 'skybound.flightsim.save.v1';

export const defaultSave = (): SaveData => ({
  credits: 500,
  xp: 0,
  stars: {},
  best: {},
  careerDone: [],
  totals: { flights: 0, landings: 0, crashes: 0, distanceKm: 0, hours: 0, maxAlt: 0, maxSpeed: 0, kills: 0, rescues: 0 },
  settings: { volume: 0.7, muted: false, assist: true, invertPitch: false, quality: 'medium', units: 'aviation', timeScale: 1, hints: true, fov: 70 },
  lastAircraft: 'sparrow172',
  lastLivery: 0,
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();
    return { ...base, ...d, totals: { ...base.totals, ...(d.totals ?? {}) }, settings: { ...base.settings, ...(d.settings ?? {}) } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(s: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export const RANKS = [
  { xp: 0, name: 'Student Pilot' },
  { xp: 300, name: 'Private Pilot' },
  { xp: 800, name: 'Commercial Pilot' },
  { xp: 1600, name: 'First Officer' },
  { xp: 3000, name: 'Captain' },
  { xp: 5000, name: 'Senior Captain' },
  { xp: 8000, name: 'Ace Aviator' },
];
export function rankOf(xp: number) {
  let r = RANKS[0];
  let next = RANKS[1];
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) { r = RANKS[i]; next = RANKS[i + 1] ?? RANKS[i]; }
  return { name: r.name, next, progress: next.xp === r.xp ? 1 : (xp - r.xp) / (next.xp - r.xp) };
}
