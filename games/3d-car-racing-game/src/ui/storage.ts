import type { Difficulty } from "../game/data";

const P = "turbo-horizon.";

export function loadBest(trackId: string): number {
  try {
    const v = localStorage.getItem(P + "best." + trackId);
    return v ? parseFloat(v) : Infinity;
  } catch {
    return Infinity;
  }
}

export function saveBest(trackId: string, t: number) {
  try {
    localStorage.setItem(P + "best." + trackId, String(t));
  } catch {
    /* ignore */
  }
}

export interface Prefs {
  trackId: string;
  carId: string;
  color: number;
  laps: number;
  aiCount: number;
  difficulty: Difficulty;
}

export const DEFAULT_PREFS: Prefs = {
  trackId: "coast",
  carId: "apex",
  color: 0xe11d2e,
  laps: 3,
  aiCount: 5,
  difficulty: "medium",
};

export function loadPrefs(): Prefs {
  try {
    const v = localStorage.getItem(P + "prefs");
    if (v) return { ...DEFAULT_PREFS, ...JSON.parse(v) };
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS;
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(P + "prefs", JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
