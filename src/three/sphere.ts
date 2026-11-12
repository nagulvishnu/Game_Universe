/**
 * Pure spherical geometry for the holographic universe.
 *
 * Everything here is framework-free and deterministic so it can be unit tested
 * without a DOM or a WebGL context.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** The golden angle — the step that spreads points evenly over a sphere. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalize(v: Vec3): Vec3 {
  const l = length(v);
  if (l === 0) return { x: 0, y: 0, z: 1 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function rotateY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

export function rotateX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

export function rotateZ(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

/**
 * Fibonacci sphere — the mathematically balanced point distribution.
 *
 * Consecutive points are separated by ~`GOLDEN_ANGLE` radians of longitude and
 * the latitude steps shrink towards the poles, which keeps the minimum distance
 * between any two points as large as possible for a given count.
 */
export function fibonacciSphere(count: number): Vec3[] {
  const out: Vec3[] = [];
  if (count <= 0) return out;
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    out.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return out;
}

/**
 * Compress the vertical axis. A sphere read on a phone screen wastes most of
 * the viewport, so the arrangement becomes an oblate shell that still carries
 * genuine depth but fits a portrait display.
 */
export function flattenSphere(dirs: Vec3[], amount: number): Vec3[] {
  const k = Math.max(0, Math.min(1, amount));
  if (k === 0) return dirs.map((d) => ({ ...d }));
  return dirs.map((d) => normalize({ x: d.x, y: d.y * (1 - k), z: d.z }));
}

/**
 * Turn the unit sphere into a shell with a chosen vertical profile.
 *
 * Unlike {@link flattenSphere} the directions are deliberately *not*
 * renormalised, so `sy > 1` makes a tall (prolate) shell and `sy < 1` a wide
 * (oblate) one. That matters because the arrangement is projected to the
 * screen: the composition's aspect ratio has to match the space actually
 * available on this viewport, or the fit leaves large empty margins.
 *
 * The point set still comes from the Fibonacci sphere, so the spacing between
 * neighbouring worlds stays even — the shell is reshaped, never stacked.
 */
export function ellipsoid(dirs: Vec3[], sy: number): Vec3[] {
  const s = Number.isFinite(sy) && sy > 0 ? sy : 1;
  if (s === 1) return dirs.map((d) => ({ ...d }));
  return dirs.map((d) => ({ x: d.x, y: d.y * s, z: d.z }));
}

/**
 * Find the orbit angles that bring `dir` to the front of the sphere at a given
 * height. The group transform is `rotateX(pitch) ∘ rotateY(yaw)`.
 *
 * The height is measured on the *output* vector, so the result is correct for
 * a direction of any length. The branch that keeps the card in front of the
 * camera (positive z) is returned.
 */
export function solveLanding(dir: Vec3, targetY: number): { yaw: number; pitch: number } {
  const mag = length(dir);
  const d = normalize(dir);
  const r = Math.hypot(d.x, d.z);
  // yaw such that the rotated x becomes 0
  const yaw = Math.atan2(-d.x, d.z);
  const y1 = d.y;
  const z1 = r;
  const unit = Math.hypot(y1, z1) || 1;
  // `y' = y1*cos(p) - z1*sin(p)` peaks at `unit`, so the unit-sphere target is
  // scaled by the input length to land at `targetY` in output space.
  const cosP = Math.max(-1, Math.min(1, targetY / mag / unit));
  const phi = Math.atan2(-z1, y1);
  const base = phi + Math.acos(cosP);
  let best = base;
  let bestZ = -Infinity;
  for (const candidate of [base, phi - Math.acos(cosP)]) {
    const z2 = y1 * Math.sin(candidate) + z1 * Math.cos(candidate);
    if (z2 > bestZ) {
      bestZ = z2;
      best = candidate;
    }
  }
  return { yaw, pitch: best };
}

/** Smallest positive delta that brings `from` onto `to` (mod 2π). */
export function shortestPositiveDelta(from: number, to: number): number {
  const twoPi = Math.PI * 2;
  let d = (to - from) % twoPi;
  if (d < 0) d += twoPi;
  return d;
}

/** The smallest angular gap between two directions, in radians. */
export function angleBetween(a: Vec3, b: Vec3): number {
  const na = normalize(a);
  const nb = normalize(b);
  return Math.acos(Math.max(-1, Math.min(1, na.x * nb.x + na.y * nb.y + na.z * nb.z)));
}

/**
 * Find the orbit angle that brings a card as far toward the camera as possible.
 *
 * The orbit transform is `rotateX(rotateY(dir, angle), tilt)`, so the exact
 * optimum depends on the tilt. Rather than deriving a closed form that can
 * silently drift, the optimum is found by sampling — the cost is negligible
 * because it runs once per Random Pick.
 */
export function bestOrbitAngle(dirs: Vec3[], index: number, tilt: number, samples = 1440): number {
  const dir = dirs[index];
  if (!dir) return 0;
  let bestAngle = 0;
  let bestZ = -Infinity;
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const p = rotateX(rotateY(dir, a), tilt);
    if (p.z > bestZ) {
      bestZ = p.z;
      bestAngle = a;
    }
  }
  return bestAngle;
}
