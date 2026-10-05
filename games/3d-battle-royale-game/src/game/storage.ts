export interface ScoreEntry {
  name: string;
  score: number;
  kills: number;
  place: number;
  total: number;
  mode: string;
  time: number;
  date: number;
}

const KEY = 'dropzone50.scores.v1';
const NAME = 'dropzone50.name';

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
