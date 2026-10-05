import { hashString, mulberry32 } from "@/games/theme";

export type Vec3 = [number, number, number];

/**
 * Deterministic, collision-free portal placement.
 * The same set of ids always yields the same layout; each id's position comes from its own hash,
 * so adding a game rarely disturbs the others.
 */
export function placePortals(ids: string[], minDist = 8.5): Map<string, Vec3> {
  const sorted = [...ids].sort();
  const out = new Map<string, Vec3>();
  const n = sorted.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(sorted[0], [0, 0, 0]);
    return out;
  }

  const baseSpread = 7 + 3.4 * Math.sqrt(n);
  const placed: Vec3[] = [];

  for (const id of sorted) {
    const seed = hashString(id);
    let best: Vec3 | null = null;
    let bestScore = -1;
    let accepted: Vec3 | null = null;

    for (let k = 0; k < 240 && !accepted; k++) {
      const rng = mulberry32(seed + k * 7919);
      const spread = baseSpread * (1 + Math.floor(k / 40) * 0.15);
      const a = rng() * Math.PI * 2;
      const rad = Math.sqrt(rng());
      const cand: Vec3 = [
        Math.cos(a) * rad * spread * 1.5,
        (rng() - 0.5) * spread * 0.5,
        -Math.sqrt(rng()) * spread * 0.8,
      ];
      let d = Infinity;
      for (const p of placed) d = Math.min(d, Math.hypot(p[0] - cand[0], p[1] - cand[1], p[2] - cand[2]));
      if (d >= minDist) accepted = cand;
      else if (d > bestScore) {
        bestScore = d;
        best = cand;
      }
    }
    const pos = accepted ?? best ?? [0, 0, 0];
    placed.push(pos);
    out.set(id, pos);
  }
  return out;
}
