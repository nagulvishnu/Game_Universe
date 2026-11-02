export interface HiScoreEntry {
  name: string;
  score: number;
  tames: number;
  wins: number;
  date: number;
}

const KEY = 'mechanimos_hiscores_v1';
const MAX = 5;

export function loadScores(): HiScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HiScoreEntry[];
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function qualifies(score: number): boolean {
  if (score <= 0) return false;
  const s = loadScores();
  return s.length < MAX || score > s[s.length - 1].score;
}

export function addScore(entry: HiScoreEntry): HiScoreEntry[] {
  const s = loadScores();
  s.push(entry);
  s.sort((a, b) => b.score - a.score);
  const trimmed = s.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* noop */
  }
  return trimmed;
}
