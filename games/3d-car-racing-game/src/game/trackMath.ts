// Pure track geometry generation (no rendering dependencies).
import type { TrackDef } from "./data";

export interface TP {
  x: number;
  y: number;
  z: number;
  tx: number; // forward tangent
  tz: number;
  nx: number; // side vector (tz, -tx)
  nz: number;
  curv: number; // signed curvature (positive = turning towards +psi / left)
  slope: number; // dh/ds
  s: number; // distance along the track
  th: number; // generating polar angle
}

export interface TrackData {
  pts: TP[];
  n: number;
  length: number;
  spacing: number;
  width: number;
  halfWidth: number;
  barrier: number; // lateral offset of barrier wall
  maxExtent: number;
  grid: Map<string, number[]>;
  cell: number;
}

export const CURB = 1.3;
export const RUNOFF = 4.8;

function harm(h: [number, number, number][], th: number) {
  let v = 0;
  for (const [k, a, p] of h) v += a * Math.cos(k * th + p);
  return v;
}

export function buildTrackData(def: TrackDef): TrackData {
  const M = 6000;
  const X: number[] = [];
  const Z: number[] = [];
  const TH: number[] = [];
  for (let j = 0; j <= M; j++) {
    const th = (j / M) * Math.PI * 2;
    const r = def.radius * (1 + harm(def.harmonics, th));
    X.push(r * Math.cos(th) * def.stretch[0]);
    Z.push(r * Math.sin(th) * def.stretch[1]);
    TH.push(th);
  }
  const cum: number[] = [0];
  for (let j = 1; j <= M; j++) {
    cum.push(cum[j - 1] + Math.hypot(X[j] - X[j - 1], Z[j] - Z[j - 1]));
  }
  const L = cum[M];
  const n = Math.round(L / 4);
  const spacing = L / n;

  const raw: { x: number; z: number; th: number }[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = i * spacing;
    while (j < M - 1 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const f = (target - cum[j]) / seg;
    raw.push({
      x: X[j] + (X[j + 1] - X[j]) * f,
      z: Z[j] + (Z[j + 1] - Z[j]) * f,
      th: TH[j] + (TH[j + 1] - TH[j]) * f,
    });
  }

  // Elevation
  const hs0 = raw.map((p) => harm(def.elev, p.th));
  const minH = Math.min(...hs0);
  let heights = hs0.map((h) => h - minH + 0.5);

  // Choose the straightest stretch as the start/finish line.
  const rawCurv: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = raw[(i - 1 + n) % n];
    const b = raw[i];
    const c = raw[(i + 1) % n];
    const a1 = Math.atan2(b.z - a.z, b.x - a.x);
    const a2 = Math.atan2(c.z - b.z, c.x - b.x);
    let d = a2 - a1;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    rawCurv.push(Math.abs(d) / spacing);
  }
  const win = Math.round(180 / spacing);
  let bestShift = 0;
  let bestScore = Infinity;
  for (let i = 0; i < n; i++) {
    let score = 0;
    for (let k = -Math.round(50 / spacing); k <= win; k++) {
      const c = rawCurv[(i + k + n) % n];
      score += c * c;
    }
    if (score < bestScore) {
      bestScore = score;
      bestShift = i;
    }
  }
  const rotated = raw.map((_, i) => raw[(i + bestShift) % n]);
  heights = heights.map((_, i) => heights[(i + bestShift) % n]);
  raw.length = 0;
  raw.push(...rotated);

  const pts: TP[] = [];
  for (let i = 0; i < n; i++) {
    const a = raw[(i - 1 + n) % n];
    const b = raw[(i + 1) % n];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    pts.push({
      x: raw[i].x,
      y: heights[i],
      z: raw[i].z,
      tx,
      tz,
      nx: tz,
      nz: -tx,
      curv: 0,
      slope: 0,
      s: i * spacing,
      th: raw[i].th,
    });
  }
  // curvature + slope
  const c0: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n];
    const q = pts[(i + 1) % n];
    const cross = p.tx * q.tz - p.tz * q.tx;
    const dot = p.tx * q.tx + p.tz * q.tz;
    c0.push(Math.atan2(cross, dot) / (2 * spacing));
  }
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -2; k <= 2; k++) sum += c0[(i + k + n) % n];
    pts[i].curv = sum / 5;
    pts[i].slope = (pts[(i + 1) % n].y - pts[(i - 1 + n) % n].y) / (2 * spacing);
  }

  // spatial grid
  const cell = 40;
  const grid = new Map<string, number[]>();
  let maxExtent = 0;
  for (let i = 0; i < n; i++) {
    const key = `${Math.floor(pts[i].x / cell)},${Math.floor(pts[i].z / cell)}`;
    const arr = grid.get(key);
    if (arr) arr.push(i);
    else grid.set(key, [i]);
    maxExtent = Math.max(maxExtent, Math.hypot(pts[i].x, pts[i].z));
  }

  return {
    pts,
    n,
    length: L,
    spacing,
    width: def.width,
    halfWidth: def.width / 2,
    barrier: def.width / 2 + CURB + RUNOFF,
    maxExtent,
    grid,
    cell,
  };
}

/** nearest sample index + distance within a spatial neighbourhood */
export function nearestInfo(t: TrackData, x: number, z: number, reach = 2): { d: number; i: number } {
  const cx = Math.floor(x / t.cell);
  const cz = Math.floor(z / t.cell);
  let best = Infinity;
  let bi = -1;
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      const arr = t.grid.get(`${cx + dx},${cz + dz}`);
      if (!arr) continue;
      for (const i of arr) {
        const p = t.pts[i];
        const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
        if (d < best) {
          best = d;
          bi = i;
        }
      }
    }
  }
  return { d: Math.sqrt(best), i: bi };
}

export function nearestGlobal(t: TrackData, x: number, z: number): number {
  let best = Infinity;
  let bi = 0;
  for (let i = 0; i < t.n; i++) {
    const p = t.pts[i];
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  return bi;
}

export interface TrackSample {
  x: number;
  y: number;
  z: number;
  psi: number;
}

/** position + heading at (possibly negative / wrapped) distance s with lateral offset */
export function sampleAt(t: TrackData, s: number, lat = 0): TrackSample {
  const L = t.length;
  let ss = ((s % L) + L) % L;
  const f = ss / t.spacing;
  const i0 = Math.floor(f) % t.n;
  const i1 = (i0 + 1) % t.n;
  const u = f - Math.floor(f);
  const a = t.pts[i0];
  const b = t.pts[i1];
  const x = a.x + (b.x - a.x) * u;
  const z = a.z + (b.z - a.z) * u;
  const y = a.y + (b.y - a.y) * u;
  let tx = a.tx + (b.tx - a.tx) * u;
  let tz = a.tz + (b.tz - a.tz) * u;
  const l = Math.hypot(tx, tz) || 1;
  tx /= l;
  tz /= l;
  ss = 0;
  return { x: x + tz * lat, y, z: z - tx * lat, psi: Math.atan2(tx, tz) };
}

export function trackStats(t: TrackData) {
  let minRadius = Infinity;
  let maxSlope = 0;
  for (const p of t.pts) {
    if (Math.abs(p.curv) > 1e-6) minRadius = Math.min(minRadius, 1 / Math.abs(p.curv));
    maxSlope = Math.max(maxSlope, Math.abs(p.slope));
  }
  // minimum separation between non-adjacent samples
  let minSep = Infinity;
  const skip = Math.round(300 / t.spacing);
  for (let i = 0; i < t.n; i += 2) {
    for (let j = i + 1; j < t.n; j += 2) {
      const dj = Math.min(j - i, t.n - (j - i));
      if (dj < skip) continue;
      const d = Math.hypot(t.pts[i].x - t.pts[j].x, t.pts[i].z - t.pts[j].z);
      if (d < minSep) minSep = d;
    }
  }
  return { length: t.length, minRadius, maxSlope, minSep };
}
