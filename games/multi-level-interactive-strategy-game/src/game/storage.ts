export interface Progress {
  stars: Record<number, number>;
  crown: Record<number, number>; // highest difficulty index beaten (+1)
}

const KEY = 'bastion-defense-progress-v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { stars: p.stars ?? {}, crown: p.crown ?? {} };
    }
  } catch {
    /* ignore */
  }
  return { stars: {}, crown: {} };
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function recordWin(p: Progress, levelId: number, stars: number, diff: number): Progress {
  const next: Progress = {
    stars: { ...p.stars, [levelId]: Math.max(p.stars[levelId] ?? 0, stars) },
    crown: { ...p.crown, [levelId]: Math.max(p.crown[levelId] ?? 0, diff + 1) },
  };
  saveProgress(next);
  return next;
}

export function isUnlocked(p: Progress, levelId: number): boolean {
  return levelId === 1 || (p.stars[levelId - 1] ?? 0) > 0;
}

export function totalStars(p: Progress): number {
  return Object.values(p.stars).reduce((a, b) => a + b, 0);
}
