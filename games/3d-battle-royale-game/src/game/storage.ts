export interface ScoreEntry {
  name: string;
  score: number;
  kills: number;
  place: number;
  total: number;
  mode: string;
  map?: string;
  time: number;
  date: number;
}

const KEY = 'dropzone50.scores.v1';
const NAME = 'dropzone50.name';
const STATS = 'dropzone50.stats.v1';
const MAPKEY = 'dropzone50.map';

export function getMapSel(fallback = 'valley'): string {
  try {
    return localStorage.getItem(MAPKEY) || fallback;
  } catch {
    return fallback;
  }
}
export function setMapSel(id: string) {
  try {
    localStorage.setItem(MAPKEY, id);
  } catch {
    /* ignore */
  }
}

export interface LifetimeStats { games: number; kills: number; wins: number; }

export function getLifetime(): LifetimeStats {
  try {
    const raw = localStorage.getItem(STATS);
    if (raw) {
      const s = JSON.parse(raw) as LifetimeStats;
      if (s && typeof s.games === 'number') return s;
    }
  } catch { /* ignore */ }
  // derive from the score table as a fallback
  const scores = getScores();
  return {
    games: scores.length,
    kills: scores.reduce((a, s) => a + s.kills, 0),
    wins: scores.filter((s) => s.place === 1).length,
  };
}

function bumpLifetime(kills: number, win: boolean) {
  try {
    const s = getLifetime();
    s.games += 1;
    s.kills += kills;
    if (win) s.wins += 1;
    localStorage.setItem(STATS, JSON.stringify(s));
  } catch { /* ignore */ }
}

export function getScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Adds the entry and returns the 0-based rank (or -1 if it didn't make the table). */
export function addScore(e: ScoreEntry): number {
  const list = getScores();
  list.push(e);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  const rank = top.indexOf(e);
  try {
    localStorage.setItem(KEY, JSON.stringify(top));
  } catch {
    /* ignore */
  }
  bumpLifetime(e.kills, e.place === 1);
  return rank;
}

export function getName(): string {
  try {
    return localStorage.getItem(NAME) || 'YOU';
  } catch {
    return 'YOU';
  }
}
export function setName(n: string) {
  try {
    localStorage.setItem(NAME, n);
  } catch {
    /* ignore */
  }
}

export interface Settings {
  sens: number;   // 0.3 – 3.0, default 1.0
  vol: number;    // 0 – 1, default 0.5
  fov: number;    // 60 – 100, default 72
}

const SETTINGS_KEY = 'dropzone50.settings.v1';

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Settings>;
      return {
        sens: typeof s.sens === 'number' ? Math.max(0.3, Math.min(3, s.sens)) : 1,
        vol: typeof s.vol === 'number' ? Math.max(0, Math.min(1, s.vol)) : 0.5,
        fov: typeof s.fov === 'number' ? Math.max(60, Math.min(100, s.fov)) : 72,
      };
    }
  } catch { /* ignore */ }
  return { sens: 1, vol: 0.5, fov: 72 };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}
