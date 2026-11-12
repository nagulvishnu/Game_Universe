// Shot definitions, contact evaluation (timing/position quality), and trajectory planning.
import { Ball, Launch, solveByAngle, solveBySpeed, velocityFrom } from './physics';

export type ShotId =
  | 'highClear' | 'attackClear' | 'drop' | 'netShot' | 'drive' | 'flatPush'
  | 'smash' | 'jumpSmash' | 'lift' | 'cross' | 'backhand' | 'serve';
export type Grade = 'poor' | 'normal' | 'good' | 'perfect';
export type Special = 'perfectSmash' | 'superSmash' | 'lightning' | 'phantom' | 'precision' | 'perfectCross';
export type Anim = 'overhead' | 'under' | 'side' | 'back' | 'serve' | 'jump';

export interface ShotDef {
  id: ShotId;
  label: string;
  mode: 'speed' | 'angle';
  elev: number;
  speed: number;
  depth: number; // landing distance from net on the opponent's side
  drag: number;
  margin: number; // min net clearance
  vmax: number;
  scatter: number;
}

export const SHOTS: Record<ShotId, ShotDef> = {
  highClear: { id: 'highClear', label: 'High Clear', mode: 'speed', elev: 52, speed: 0, depth: 6.0, drag: 1, margin: 0.5, vmax: 62, scatter: 1 },
  attackClear: { id: 'attackClear', label: 'Attacking Clear', mode: 'speed', elev: 33, speed: 0, depth: 6.0, drag: 1, margin: 0.3, vmax: 64, scatter: 1.1 },
  drop: { id: 'drop', label: 'Drop Shot', mode: 'speed', elev: 22, speed: 0, depth: 2.3, drag: 1.7, margin: 0.15, vmax: 42, scatter: 0.9 },
  netShot: { id: 'netShot', label: 'Net Shot', mode: 'speed', elev: 32, speed: 0, depth: 1.0, drag: 2.3, margin: 0.1, vmax: 30, scatter: 0.7 },
  drive: { id: 'drive', label: 'Drive', mode: 'angle', elev: 0, speed: 33, depth: 4.6, drag: 1, margin: 0.06, vmax: 60, scatter: 1 },
  flatPush: { id: 'flatPush', label: 'Flat Push', mode: 'angle', elev: 0, speed: 25, depth: 4.4, drag: 1, margin: 0.08, vmax: 60, scatter: 0.9 },
  smash: { id: 'smash', label: 'Smash', mode: 'angle', elev: 0, speed: 31, depth: 3.9, drag: 1, margin: 0.12, vmax: 60, scatter: 1.2 },
  jumpSmash: { id: 'jumpSmash', label: 'Jump Smash', mode: 'angle', elev: 0, speed: 35, depth: 3.7, drag: 1, margin: 0.12, vmax: 60, scatter: 1.2 },
  lift: { id: 'lift', label: 'Defensive Lift', mode: 'speed', elev: 62, speed: 0, depth: 6.0, drag: 1, margin: 0.7, vmax: 62, scatter: 1.1 },
  cross: { id: 'cross', label: 'Cross-Court', mode: 'angle', elev: 0, speed: 29, depth: 3.2, drag: 1, margin: 0.1, vmax: 60, scatter: 1 },
  backhand: { id: 'backhand', label: 'Backhand', mode: 'speed', elev: 44, speed: 0, depth: 5.0, drag: 1, margin: 0.3, vmax: 60, scatter: 1.5 },
  serve: { id: 'serve', label: 'Serve', mode: 'speed', elev: 40, speed: 0, depth: 2.6, drag: 1.5, margin: 0.1, vmax: 50, scatter: 0.5 },
};

export const SPECIAL_LABEL: Record<Special, string> = {
  perfectSmash: 'PERFECT SMASH',
  superSmash: 'SUPER SMASH',
  lightning: 'LIGHTNING DRIVE',
  phantom: 'PHANTOM DROP',
  precision: 'PRECISION CLEAR',
  perfectCross: 'PERFECT CROSS-COURT',
};

export function animFor(shot: ShotId, y: number, airborne: boolean): Anim {
  if (shot === 'serve') return 'serve';
  if (airborne && y >= 2.1) return 'jump';
  if (shot === 'backhand') return 'back';
  if (y >= 1.9) return 'overhead';
  if (y >= 1.0) return 'side';
  return 'under';
}

// ---------- contact evaluation ----------
export interface PlayerBody {
  x: number; z: number; y: number; vx: number; vz: number; side: number; lunge: boolean;
}
export interface ContactEval {
  inReach: boolean;
  score: number;
  hd: number;
  dy: number;
  dist: number;
  backhand: boolean;
}
const cl = (v: number) => Math.max(0, Math.min(1, v));

export function evaluateContact(p: PlayerBody, s: Ball, arcade: boolean): ContactEval {
  const side = p.side;
  const sx = p.x + side * 0.2, sy = 1.4 + p.y, sz = p.z;
  const dist = Math.hypot(s.x - sx, s.y - sy, s.z - sz);
  const reach = (p.lunge ? 2.45 : 1.8) * (arcade ? 1.18 : 1);
  const lateral = (s.x - p.x) * side;
  const forward = -(s.z - p.z) * side;
  const backhand = lateral < -0.35;
  const y = s.y;
  const c = y >= 1.9 ? 2.35 + p.y * 0.85 : y >= 1.0 ? 1.3 : 0.7;
  const idealLat = backhand ? -0.35 : 0.25;
  const hd = Math.hypot(lateral - idealLat, forward - 0.45);
  const dy = Math.abs(y - c);
  const inSpeed = Math.hypot(s.vx, s.vy, s.vz);
  const mv = Math.hypot(p.vx, p.vz);
  const score =
    1 - 0.5 * cl(hd / 2.0) - 0.2 * cl(dy / 1.3) - 0.1 * cl(inSpeed / 50) - 0.08 * cl(mv / 6) - (backhand ? 0.06 : 0) - (p.lunge ? 0.1 : 0);
  const inReach = dist <= reach && y > 0.03 && forward > -1.0;
  return { inReach, score, hd, dy, dist, backhand };
}

export function gradeOf(score: number): Grade {
  if (score >= 0.82) return 'perfect';
  if (score >= 0.64) return 'good';
  if (score >= 0.42) return 'normal';
  return 'poor';
}

export interface ShotCtx {
  key: number; // 1-4 = shot keys, 5 = special/space
  y: number;
  airborne: boolean;
  backhand: boolean;
  sprinting: boolean;
  forwardSpeed: number;
  zFromNet: number;
  serving: boolean;
}

export function chooseShot(c: ShotCtx): ShotId {
  if (c.serving) return 'serve';
  if (c.airborne && c.y >= 2.1) return 'jumpSmash';
  if (c.key === 5) return c.y >= 2.0 ? 'smash' : 'drive';
  if (c.backhand) return 'backhand';
  switch (c.key) {
    case 1:
      if (c.y < 1.0) return 'lift';
      if ((c.sprinting || c.forwardSpeed > 2.5) && c.y >= 1.8) return 'attackClear';
      return 'highClear';
    case 2:
      return c.y < 1.4 && c.zFromNet < 3.8 ? 'netShot' : 'drop';
    default:
      if (c.y >= 1.9) return 'cross';
      if (c.y >= 1.0) return 'drive';
      return 'flatPush';
  }
}

export function specialFor(shot: ShotId, grade: Grade, superArmed: boolean): Special | null {
  if (superArmed && grade !== 'poor' && (shot === 'jumpSmash' || shot === 'smash')) return 'superSmash';
  if (grade !== 'perfect') return null;
  switch (shot) {
    case 'smash': case 'jumpSmash': return 'perfectSmash';
    case 'drive': case 'flatPush': return 'lightning';
    case 'drop': case 'netShot': return 'phantom';
    case 'highClear': case 'attackClear': case 'lift': return 'precision';
    case 'cross': return 'perfectCross';
    default: return null;
  }
}

// ---------- planning ----------
export interface PlanIn {
  shot: ShotId;
  grade: Grade;
  special: Special | null;
  key: number;
  aimX: number | null; // world x target (null = centre)
  side: number; // hitter side (+1/-1) -> target on -side
  start: { x: number; y: number; z: number };
  hw: number; // half width of legal rally court
  serveXSign: number;
  serveLong: number; // long service line depth
  rnd: () => number;
}
export interface PlanOut {
  launch: Launch;
  vx: number; vy: number; vz: number;
  tx: number; tz: number;
  drag: number;
}

const SCATTER: Record<Grade, number> = { perfect: 0.05, good: 0.35, normal: 0.8, poor: 1.8 };
const POWER: Record<Grade, number> = { poor: 0.9, normal: 1, good: 1.02, perfect: 1.05 };

function solveShot(start: { x: number; y: number; z: number }, tx: number, tz: number, d: ShotDef, side: number): Launch {
  let elev = d.elev;
  let dz = tz;
  for (let a = 0; a < 9; a++) {
    const L = d.mode === 'speed' ? solveBySpeed(start, tx, dz, elev, d.drag, d.vmax) : solveByAngle(start, tx, dz, d.speed, d.drag);
    if (L.netMargin >= d.margin) return L;
    if (d.mode === 'speed') elev += 4;
    else dz = Math.max(-6.5, Math.min(6.5, dz - side * 0.45));
  }
  let last: Launch | null = null;
  for (let e = 6; e <= 80; e += 3) {
    last = solveBySpeed(start, tx, tz, e, d.drag, d.vmax);
    if (last.netMargin >= d.margin) return last;
  }
  return last as Launch;
}

export function planShot(i: PlanIn): PlanOut {
  const d: ShotDef = { ...SHOTS[i.shot] };
  const key = i.key;
  let tx = i.aimX ?? 0;
  let depth = d.depth;
  let scatterMul = d.scatter;
  let grade = i.grade;
  const inner = i.hw - 0.4;

  if (i.shot === 'backhand') {
    if (key === 2) { d.elev = 28; d.depth = 2.0; d.drag = 1.7; d.margin = 0.12; depth = 2.0; }
    else if (key === 3 || key === 4) { d.elev = 36; d.depth = 4.2; depth = 4.2; }
    else { d.elev = 46; d.depth = 5.4; depth = 5.4; }
  }
  if (i.shot === 'serve') {
    grade = 'normal';
    const xs = i.serveXSign || 1;
    if (key === 1) { d.elev = 58; d.margin = 0.6; d.drag = 1; d.vmax = 62; depth = Math.min(i.serveLong - 0.35, 6.2); tx = xs * 1.4; }
    else if (key === 3) { d.elev = 26; depth = 3.2; tx = xs * (i.hw - 0.6); }
    else if (key === 4) { d.elev = 14; d.margin = 0.07; d.drag = 1.1; depth = 4.6; tx = xs * 0.9; }
    else { d.elev = 30; depth = 2.6; tx = xs * 1.4; }
    scatterMul = 0.45;
  }

  let sc = SCATTER[grade] * scatterMul;
  const sp = i.special;
  if (sp) {
    sc = 0;
    switch (sp) {
      case 'perfectSmash': d.speed = 38; break;
      case 'superSmash': d.speed = 41; sc = 0.1; break;
      case 'lightning': d.speed = 38; depth = 4.9; d.margin = 0.05; break;
      case 'phantom': d.elev = 40; d.drag = 2.8; depth = 0.9; d.margin = 0.08; d.vmax = 30; break;
      case 'precision': depth = 6.4; d.margin = 0.5; break;
      case 'perfectCross': d.speed = 31; depth = 2.6; tx = (tx >= 0 ? 1 : -1) * (i.hw - 0.2); break;
    }
  } else if (d.mode === 'angle') {
    d.speed *= POWER[grade];
  }

  tx += (i.rnd() - 0.5) * 2 * sc;
  depth += (i.rnd() - 0.5) * 2 * sc * 0.9;
  if (grade !== 'poor') {
    const lim = i.shot === 'serve' ? i.hw - 0.15 : i.hw - 0.2;
    tx = Math.max(-lim, Math.min(lim, tx));
    depth = Math.max(0.6, Math.min(i.shot === 'serve' ? i.serveLong - 0.2 : 6.5, depth));
  } else {
    tx = Math.max(-i.hw - 1.5, Math.min(i.hw + 1.5, tx));
    depth = Math.max(0.3, Math.min(7.6, depth));
  }
  if (!sp && i.shot !== 'serve') tx = Math.max(-inner - 0.5, Math.min(inner + 0.5, tx));

  const tz = -i.side * depth;
  const L = solveShot(i.start, tx, tz, d, i.side);
  let v = { vx: L.vx, vy: L.vy, vz: L.vz };
  if (grade === 'poor' && i.shot !== 'serve') {
    // weak contact: velocity error that can clip the net or sail out
    const elev = L.elev + (-4 + i.rnd() * 7);
    const speed = L.speed * (0.92 + i.rnd() * 0.14);
    v = velocityFrom(i.start, tx, tz, elev, speed);
  }
  return { launch: L, ...v, tx, tz, drag: d.drag };
}
