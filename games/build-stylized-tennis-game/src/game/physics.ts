import { BALL_R, COURT, G, type Surface } from './constants';

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number; // + topspin, - backspin (relative to travel direction)
}
export const MAG = 0.12;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function integrate(b: BallState, dt: number) {
  const vh = Math.hypot(b.vx, b.vz);
  b.vy -= (G + MAG * b.spin * vh) * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.spin *= 1 - 0.05 * dt;
}

/** Applies a floor bounce; returns impact speed. */
export function bounceFloor(b: BallState, s: Surface): number {
  b.y = BALL_R;
  const impact = -b.vy;
  const e = s.rest * (1 + 0.045 * clamp(b.spin, -2.5, 3));
  b.vy = impact * e;
  const k = clamp(s.fric * (1 + 0.06 * b.spin), 0.4, 1.12);
  b.vx *= k;
  b.vz *= k;
  b.spin *= 0.55;
  if (b.vy < 0.9) b.vy = 0;
  return impact;
}

export const netTopAt = (x: number) => COURT.netH + (Math.min(Math.abs(x), COURT.netHalf) / COURT.netHalf) * 0.15;

export interface Landing {
  lx: number;
  lz: number;
  t: number;
  netY: number | null;
}
export function simulateLanding(x: number, y: number, z: number, vx: number, vy: number, vz: number, spin: number): Landing {
  const b: BallState = { x, y, z, vx, vy, vz, spin };
  const dt = 1 / 120;
  let netY: number | null = null;
  let t = 0;
  for (let i = 0; i < 700; i++) {
    const pz = b.z;
    const py = b.y;
    integrate(b, dt);
    t += dt;
    if (netY === null && pz * b.z <= 0 && pz !== b.z) {
      const f = pz / (pz - b.z);
      netY = py + (b.y - py) * f;
    }
    if (b.y <= BALL_R && b.vy < 0) break;
  }
  return { lx: b.x, lz: b.z, t, netY };
}

export interface Plan {
  vx: number;
  vy: number;
  vz: number;
  T: number;
}
/** Solve launch velocity so the ball lands at (tx,tz) after roughly T seconds, clearing the net. */
export function planShot(x0: number, y0: number, z0: number, tx: number, tz: number, T0: number, spin: number, minNet: number): Plan {
  let T = T0;
  let vx = 0,
    vy = 0,
    vz = 0;
  for (let attempt = 0; attempt < 18; attempt++) {
    vx = (tx - x0) / T;
    vz = (tz - z0) / T;
    vy = (BALL_R - y0 + 0.5 * G * T * T) / T;
    let r = simulateLanding(x0, y0, z0, vx, vy, vz, spin);
    for (let k = 0; k < 2; k++) {
      const tl = Math.max(0.2, r.t);
      vx += (tx - r.lx) / tl;
      vz += (tz - r.lz) / tl;
      r = simulateLanding(x0, y0, z0, vx, vy, vz, spin);
    }
    if (r.netY === null || r.netY >= minNet) break;
    T += 0.07;
    if (T > 3.2) break;
  }
  return { vx, vy, vz, T };
}

export interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  vy: number;
  bounces: number; // bounces counted from the start of prediction
  netHit: boolean;
}
/** Predict ball path forward (used by AI, timing ring and camera assist). */
export function predict(b0: BallState, surf: Surface, tMax = 1.8, dt = 1 / 30): Sample[] {
  const b: BallState = { ...b0 };
  const out: Sample[] = [];
  let bounces = 0;
  let t = 0;
  let netHit = false;
  const sub = 3;
  const h = dt / sub;
  while (t < tMax) {
    for (let i = 0; i < sub; i++) {
      const pz = b.z;
      const py = b.y;
      integrate(b, h);
      if (!netHit && pz * b.z <= 0 && pz !== b.z) {
        const f = pz / (pz - b.z);
        const yc = py + (b.y - py) * f;
        if (yc - BALL_R < netTopAt(b.x)) {
          netHit = true;
          b.vz *= -0.15;
          b.vx *= 0.4;
        }
      }
      if (b.y <= BALL_R && b.vy < 0) {
        bounceFloor(b, surf);
        bounces++;
      }
    }
    t += dt;
    out.push({ t, x: b.x, y: b.y, z: b.z, vy: b.vy, bounces, netHit });
  }
  return out;
}
