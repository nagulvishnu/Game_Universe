// AI controllers: trajectory prediction, intercept planning, shot selection, doubles coordination.
import { COURT, G, type Personality } from './constants';
import { clamp, type Sample } from './physics';
import type { Player, Sim } from './sim';
import { dirZ, sideZ, sxOf } from './sim';

export interface AIMemory {
  errMul: number;
  seenHit: number;
  react: number;
  err: { x: number; z: number };
  jit: number;
  key: number;
  special: boolean;
  keyChosen: boolean;
  ignore: boolean;
  target: { x: number; z: number } | null;
  replan: number;
  serveWait: number;
  serveKey: number;
  netTimer: number;
  role: 'net' | 'back';
}

interface Params {
  react: number;
  speed: number;
  predErr: number;
  jitter: number;
  err: number;
  sprint: boolean;
  lapse: number;
}
const LEVELS: Params[] = [
  { react: 0.55, speed: 0.66, predErr: 1.5, jitter: 0.1, err: 1.9, sprint: false, lapse: 0.3 },
  { react: 0.42, speed: 0.76, predErr: 1.05, jitter: 0.075, err: 1.5, sprint: true, lapse: 0.2 },
  { react: 0.3, speed: 0.86, predErr: 0.7, jitter: 0.055, err: 1.1, sprint: true, lapse: 0.12 },
  { react: 0.2, speed: 0.94, predErr: 0.4, jitter: 0.04, err: 0.75, sprint: true, lapse: 0.075 },
  { react: 0.13, speed: 1.0, predErr: 0.2, jitter: 0.026, err: 0.5, sprint: true, lapse: 0.05 },
  { react: 0.085, speed: 1.07, predErr: 0.08, jitter: 0.014, err: 0.32, sprint: true, lapse: 0.03 },
];
const BASE_Z: Record<Personality, number> = { aggressive: 10.2, defensive: 12.4, balanced: 11.2, tactical: 10.8 };
const WEIGHTS: Record<Personality, number[]> = {
  aggressive: [3, 0.7, 1.7, 1.7],
  defensive: [4.5, 0.6, 0.6, 0.6],
  balanced: [3, 1, 1, 1],
  tactical: [2, 1.2, 1.5, 1.5],
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const g1 = () => (Math.random() + Math.random() - 1) * 1.2;

function init(p: Player): AIMemory {
  const prm = LEVELS[clamp(p.spec.level, 1, 6) - 1];
  p.speedMul = prm.speed;
  return { errMul: prm.err, seenHit: -1, react: 0, err: { x: 0, z: 0 }, jit: 0, key: 1, special: false, keyChosen: false, ignore: false, target: null, replan: 0, serveWait: 0, serveKey: 1, netTimer: 0, role: 'back' };
}

function moveToward(p: Player, tx: number, tz: number, prm: Params, hurry: boolean, stopR = 0.18) {
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  const inp = p.input;
  if (d < stopR) {
    inp.mx = 0;
    inp.mz = 0;
    inp.sprint = false;
    return;
  }
  const sx = sxOf(p.team);
  const fz = dirZ(p.team);
  const mag = d < 0.6 && !hurry ? 0.35 : 1;
  inp.mx = (dx / d) * sx * mag;
  inp.mz = (dz / d) * fz * mag;
  inp.sprint = prm.sprint && hurry && d > 2.2 && p.stamina > 0.12;
}

function chooseKey(sim: Sim, p: Player, level: number, pers: Personality): number {
  const opp = sim.teamPlayers(1 - p.team);
  const w = WEIGHTS[pers].slice();
  const skill = (level - 1) / 5;
  if (opp.length) {
    const oppNet = opp.some((o) => Math.abs(o.z) < 5.5);
    const oppBack = opp.every((o) => Math.abs(o.z) > 9);
    const ox = opp.reduce((a, o) => a + o.x, 0) / opp.length;
    if (oppNet) w[1] *= 1 + skill * 4;
    else if (oppBack) w[1] *= 1 + skill * 2.5;
    if (Math.abs(ox) > 1.6) {
      const targetWorld = -Math.sign(ox);
      const k = targetWorld * sxOf(p.team) > 0 ? 2 : 3;
      w[k] *= 1 + skill * 3;
      w[0] *= 1 + skill * 0.6;
    }
    if (p.speed > 7.5 && level >= 3) {
      w[0] *= 3;
      w[2] *= 0.3;
      w[3] *= 0.3;
    }
  }
  if (level <= 2) for (let i = 0; i < 4; i++) w[i] = w[i] * 0.5 + 1.2;
  const total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < 4; i++) {
    r -= w[i];
    if (r <= 0) return i + 1;
  }
  return 1;
}

function interceptSample(sim: Sim, p: Player): Sample | null {
  const b = sim.ball;
  const sz = sideZ(p.team);
  let first: Sample | null = null;
  for (const s of sim.pred) {
    if (s.z * sz < 0.5 || s.netHit) continue;
    if (b.bounces + s.bounces >= 2) break;
    if (s.y > 0.4 && s.y < 1.5 && (b.bounces + s.bounces >= 1 || (b.isServe && !b.serveBounced && false))) {
      first = s;
      break;
    }
  }
  return first;
}

export function updateAI(sim: Sim, p: Player, dt: number) {
  const mem = (p.mem ??= init(p));
  const prm = LEVELS[clamp(p.spec.level, 1, 6) - 1];
  const pers = p.spec.personality;
  const inp = p.input;
  const b = sim.ball;
  const sz = sideZ(p.team);
  const sx = sxOf(p.team);
  const fz = dirZ(p.team);
  inp.sprint = false;
  if (p.goto) return;
  if (sim.phase === 'over' || sim.phase === 'point') {
    inp.mx = inp.mz = 0;
    return;
  }
  const W = sim.W;

  // ------------- serving
  if (sim.phase === 'serve' || sim.phase === 'toss') {
    if (p === sim.server) {
      inp.mx = inp.mz = 0;
      if (sim.phase === 'serve') {
        mem.serveWait += dt;
        if (mem.serveWait > 0.9 + (p.slot + sim.serveNum) * 0.1 + Math.random() * 0.02 + 0.4) {
          mem.serveWait = 0;
          const second = sim.serveNum === 2;
          const r = Math.random();
          mem.serveKey = second ? (r < 0.65 ? 2 : r < 0.83 ? 3 : 4) : r < 0.4 ? 1 : r < 0.7 ? 3 : 4;
          if (pers === 'defensive' && !second) mem.serveKey = r < 0.5 ? 2 : 3;
          mem.jit = g1() * prm.jitter;
          inp.shot = mem.serveKey;
        }
      } else if (!p.swing) {
        const tApex = b.vy / G;
        if (tApex <= 0.115 + mem.jit) inp.shot = mem.serveKey;
      }
      return;
    }
    // receiver / partner stay put with tiny adjustments toward the home spot
    if (sim.phase === 'serve') {
      inp.mx = inp.mz = 0;
      return;
    }
  }
  if (sim.phase === 'toss') {
    // waiting at the receiving position, split slightly to read the serve
    inp.mx = inp.mz = 0;
    return;
  }

  // ------------- rally
  const heading = b.vz * sz > 0 || b.z * sz > 0;
  const incoming = b.lastTeam !== p.team && !b.held && b.bounces < 2 && heading;
  const mates = sim.teamPlayers(p.team);
  const mate = mates.find((m) => m !== p);

  if (incoming) {
    if (b.hitCount !== mem.seenHit) {
      mem.seenHit = b.hitCount;
      mem.react = prm.react * rnd(0.8, 1.25);
      mem.err = { x: g1() * prm.predErr, z: g1() * prm.predErr };
      mem.jit = g1() * prm.jitter;
      if (Math.random() < prm.lapse + sim.rallyHits * 0.004) mem.react += 0.25 + Math.random() * 0.25;
      mem.keyChosen = false;
      mem.ignore = false;
      mem.target = null;
      mem.replan = 0;
    }
    mem.react -= dt;
    // Doubles coordination: only the teammate with the better line to the ball takes it.
    let taker = true;
    if (mate) {
      const s = interceptSample(sim, p) ?? sim.pred.filter((q) => q.z * sz > 0.5).slice(-1)[0];
      if (s) {
        const myCost = Math.hypot(s.x - p.x, s.z - p.z) / (p.speedMul * 6.8);
        const mc = Math.hypot(s.x - mate.x, s.z - mate.z) / (mate.human ? 7.4 : (mate.speedMul || 1) * 6.8);
        taker = mate.human ? myCost < mc * 0.72 : myCost <= mc;
        // never both go for it: partner on the far side of the ball yields
        if (mate.human && Math.abs(s.x - mate.x) < 1.3 && Math.abs(s.z - mate.z) < 2) taker = false;
      }
    }
    if (mem.react > 0 || !taker) {
      recover(sim, p, mem, prm, pers, mate);
      return;
    }
    if (mem.replan <= 0) {
      mem.replan = 0.08;
      // let clearly-out or net-bound balls go
      if (b.bounces === 0) {
        const fb = sim.pred.find((q) => q.bounces >= 1);
        const netHit = sim.pred.some((q) => q.netHit);
        if (netHit) mem.ignore = true;
        else if (fb) {
          const out = Math.abs(fb.x) > W + 0.2 || Math.abs(fb.z) > COURT.halfLen + 0.25 || fb.z * sz < 0;
          mem.ignore = out && !(b.z * sz > 0 && b.y < 1.9 && false);
        }
      }
      const s = interceptSample(sim, p);
      if (s) {
        const lateral = (s.x - p.x) * sx;
        const off = lateral >= 0 ? 0.85 : -0.75;
        mem.target = { x: s.x - sx * off + mem.err.x, z: s.z - fz * 0.3 + mem.err.z };
        // volley / smash opportunity for aggressive players near net
        const net = Math.abs(p.z) < 6.5;
        if (net || pers === 'aggressive') {
          const v = sim.pred.find((q) => q.z * sz > 0.8 && q.bounces === 0 && q.y > 0.7 && q.y < 1.6 && Math.abs(q.z) < (net ? 7 : 4.5) && b.bounces === 0);
          const air = sim.pred.find((q) => q.z * sz > 0.8 && q.bounces === 0 && q.y > 2.05 && q.y < 2.9 && q.vy < 0 && Math.abs(q.z) < 9.5);
          const pick = air && Math.random() < 0.97 ? air : v;
          if (pick) {
            const t = Math.hypot(pick.x - p.x, pick.z - p.z) / (6.2 * p.speedMul);
            if (t <= pick.t + 0.05) {
              const l2 = (pick.x - p.x) * sx;
              const o2 = pick === air ? 0.35 * (l2 >= 0 ? 1 : -1) : l2 >= 0 ? 0.85 : -0.75;
              mem.target = { x: pick.x - sx * o2 + mem.err.x, z: pick.z - fz * 0.3 + mem.err.z };
            }
          }
        }
      } else {
        const lastS = sim.pred.filter((q) => q.z * sz > 0.5).slice(-1)[0];
        if (lastS) mem.target = { x: lastS.x - sx * 0.85, z: lastS.z };
      }
    }
    mem.replan -= dt;
    if (mem.ignore || !mem.target) {
      recover(sim, p, mem, prm, pers, mate);
      return;
    }
    const tgt = mem.target;
    const tNeeded = Math.hypot(tgt.x - p.x, tgt.z - p.z) / (6.5 * p.speedMul);
    moveToward(p, tgt.x, tgt.z, prm, tNeeded > 0.25, 0.12);
    // swing timing
    if (!p.swing && p.cool <= 0 && sim.canHit(p)) {
      let bestD = 9;
      let bestT = 9;
      for (const q of sim.pred) {
        if (q.t > 0.35) break;
        if (q.z * sz < 0.2) continue;
        const bn = b.bounces + q.bounces;
        if (bn >= 2) break;
        const c = sim.contact(p, q.x, q.y, q.z, bn);
        if (c.d < bestD) {
          bestD = c.d;
          bestT = q.t;
        }
      }
      const now = sim.contact(p, b.x, b.y, b.z, b.bounces);
      if (now.d < bestD) {
        bestD = now.d;
        bestT = 0;
      }
      if (bestD < 2.1 && bestT <= 0.11 + mem.jit + 0.017) {
        if (!mem.keyChosen) {
          mem.keyChosen = true;
          mem.key = chooseKey(sim, p, p.spec.level, pers);
          mem.special = sim.meter[p.team] >= 1 && p.spec.level >= 3 ? Math.random() < 0.75 : p.spec.level >= 4 && Math.random() < 0.15;
        }
        inp.shot = mem.key;
        inp.special = mem.special;
        if (mem.key !== 1 && (pers === 'aggressive' || pers === 'tactical') && p.spec.level >= 3 && !sim.isDrill) mem.netTimer = 2.4;
      }
    }
    return;
  }
  mem.target = null;
  recover(sim, p, mem, prm, pers, mate);
}

function recover(sim: Sim, p: Player, mem: AIMemory, prm: Params, pers: Personality, mate: Player | undefined) {
  const b = sim.ball;
  const sz = sideZ(p.team);
  const W = sim.W;
  const opp = sim.teamPlayers(1 - p.team);
  const hitter = b.lastHitter;
  const aimX = hitter && hitter.team !== p.team ? hitter.x : b.lastTeam === p.team && opp.length ? opp[0].x * 0 : 0;
  mem.netTimer = Math.max(0, mem.netTimer - 1 / 60);
  let tx: number;
  let tz: number;
  if (!mate) {
    tz = sz * (mem.netTimer > 0 ? 4.4 : BASE_Z[pers]);
    tx = clamp(-aimX * 0.0 + aimX * 0.42, -W * 0.7, W * 0.7);
    if (b.lastTeam === p.team && !b.held) {
      // after our own shot: cover the likely return line
      const ox = opp.length ? opp[0].x : 0;
      tx = clamp(-(ox * 0.5) + b.x * 0.15, -W * 0.7, W * 0.7);
    }
  } else {
    // doubles formations
    let role: 'net' | 'back' = mem.role;
    if (mate.human) role = Math.abs(mate.z) > 7.2 ? 'net' : 'back';
    else role = p.slot === 1 ? 'net' : 'back';
    if (pers === 'defensive' && !mate.human) {
      // side-by-side
      const side = p.slot === 0 ? -1 : 1;
      tz = sz * 8.6;
      tx = clamp(side * 2.3 + b.x * 0.3, -W + 0.8, W - 0.8);
    } else if (role === 'net') {
      tz = sz * 3.6;
      tx = clamp(b.x * 0.55, -W + 1.3, W - 1.3);
      if (Math.abs(tx - mate.x) < 2.6) tx = clamp(mate.x > 0 ? mate.x - 2.8 : mate.x + 2.8, -W + 0.8, W - 0.8);
    } else {
      tz = sz * (BASE_Z[pers] - 0.4);
      tx = clamp(-(mate.x) * 0.6 + b.x * 0.15, -W + 1, W - 1);
      if (Math.abs(tx - mate.x) < 2.2) tx = clamp(mate.x > 0 ? -2.2 : 2.2, -W + 0.8, W - 0.8);
    }
    mem.role = role;
  }
  moveToward(p, tx, tz, prm, false, 0.35);
  p.input.sprint = false;
}
