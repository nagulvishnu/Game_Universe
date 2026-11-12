// Dedicated shuttlecock physics: gravity + quadratic air drag (strong deceleration), net & landing.
import { COURT, FIXED_DT } from './constants';

export const G = 11; // arcade gravity (m/s^2)
export const K = 0.13; // quadratic drag coefficient: a = -K * drag * |v| * v
export const NET_H = COURT.netH;
export const NET_HALF = 3.1;

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export function stepBall(b: Ball, dt: number, drag: number) {
  const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
  const k = K * drag * sp;
  b.vx -= b.vx * k * dt;
  b.vy -= (b.vy * k + G) * dt;
  b.vz -= b.vz * k * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
}

export interface FlightInfo {
  landX: number;
  landZ: number;
  landT: number;
  crossed: boolean;
  netY: number;
  netX: number;
  apex: number;
}

export function flight(b0: Ball, drag: number, maxT = 7): FlightInfo {
  const b = { ...b0 };
  let t = 0;
  const info: FlightInfo = { landX: b.x, landZ: b.z, landT: 0, crossed: false, netY: Infinity, netX: 0, apex: b.y };
  while (t < maxT) {
    const px = b.x, py = b.y, pz = b.z;
    stepBall(b, FIXED_DT, drag);
    t += FIXED_DT;
    if (!info.crossed && ((pz < 0 && b.z >= 0) || (pz > 0 && b.z <= 0))) {
      const f = (0 - pz) / (b.z - pz);
      info.crossed = true;
      info.netY = py + (b.y - py) * f;
      info.netX = px + (b.x - px) * f;
    }
    if (b.y > info.apex) info.apex = b.y;
    if (b.y <= 0) {
      const f = py / (py - b.y || 1);
      info.landX = px + (b.x - px) * f;
      info.landZ = pz + (b.z - pz) * f;
      info.landT = t;
      return info;
    }
  }
  info.landX = b.x;
  info.landZ = b.z;
  info.landT = t;
  return info;
}

export interface Launch {
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  elev: number;
  landX: number;
  landZ: number;
  flightT: number;
  netMargin: number; // clearance over net tape (Infinity if never crossing)
  apex: number;
}

const D2R = Math.PI / 180;

function evalLaunch(start: { x: number; y: number; z: number }, dx: number, dz: number, elev: number, speed: number, drag: number): { l: Launch; range: number } {
  const e = elev * D2R;
  const ce = Math.cos(e);
  const b: Ball = { x: start.x, y: start.y, z: start.z, vx: dx * ce * speed, vy: Math.sin(e) * speed, vz: dz * ce * speed };
  const f = flight(b, drag);
  const range = (f.landX - start.x) * dx + (f.landZ - start.z) * dz;
  return {
    range,
    l: {
      vx: b.vx, vy: b.vy, vz: b.vz, speed, elev,
      landX: f.landX, landZ: f.landZ, flightT: f.landT,
      netMargin: f.crossed ? f.netY - NET_H : Infinity,
      apex: f.apex,
    },
  };
}

function dirTo(start: { x: number; z: number }, tx: number, tz: number) {
  const dx = tx - start.x, dz = tz - start.z;
  const dist = Math.hypot(dx, dz) || 1e-6;
  return { dx: dx / dist, dz: dz / dist, dist };
}

/** Fixed launch elevation, solve speed so the shuttle lands on the target. */
export function solveBySpeed(start: { x: number; y: number; z: number }, tx: number, tz: number, elev: number, drag: number, vmax: number, vmin = 3): Launch {
  const { dx, dz, dist } = dirTo(start, tx, tz);
  let lo = vmin, hi = vmax;
  const top = evalLaunch(start, dx, dz, elev, hi, drag);
  if (top.range < dist) return top.l;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (evalLaunch(start, dx, dz, elev, mid, drag).range < dist) lo = mid;
    else hi = mid;
  }
  return evalLaunch(start, dx, dz, elev, hi, drag).l;
}

/** Fixed launch speed, solve elevation (for flat / downward attacking shots). */
export function solveByAngle(start: { x: number; y: number; z: number }, tx: number, tz: number, speed: number, drag: number, lo = -75, hi = 40): Launch {
  const { dx, dz, dist } = dirTo(start, tx, tz);
  const top = evalLaunch(start, dx, dz, hi, speed, drag);
  if (top.range < dist) return top.l;
  const bot = evalLaunch(start, dx, dz, lo, speed, drag);
  if (bot.range > dist) return bot.l;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (evalLaunch(start, dx, dz, mid, speed, drag).range < dist) lo = mid;
    else hi = mid;
  }
  return evalLaunch(start, dx, dz, hi, speed, drag).l;
}

export function velocityFrom(start: { x: number; z: number }, tx: number, tz: number, elev: number, speed: number) {
  const { dx, dz } = dirTo(start, tx, tz);
  const e = elev * D2R;
  return { vx: dx * Math.cos(e) * speed, vy: Math.sin(e) * speed, vz: dz * Math.cos(e) * speed };
}
