// Badminton AI: trajectory prediction, physical movement, shot choice, doubles coordination.
import { DIFF, CONTACT_DELAY, COURT } from './constants';
import { Ball, NET_H, NET_HALF, stepBall } from './physics';
import { evaluateContact } from './shots';
import type { Sim, SimPlayer, InputState } from './sim';

export interface Pred {
  sx: number; sz: number; // stand position for the interception
  iy: number; it: number; // intercept height / time
  lx: number; lz: number; landOut: boolean; netHit: boolean;
}
export interface AIState {
  reactT: number; seenHit: number; pred: Pred | null; predT: number;
  wantJump: boolean; judgeOk: boolean; errX: number; errZ: number;
  serveT: number; swung: boolean; owner: boolean; ownerT: number; jumped: boolean;
}
export const newAI = (): AIState => ({
  reactT: 0, seenHit: -1, pred: null, predT: 0, wantJump: false, judgeOk: true, errX: 0, errZ: 0,
  serveT: 1, swung: false, owner: true, ownerT: 0, jumped: false,
});

const blank = (): InputState => ({ mx: 0, my: 0, sprint: false, shot: 0, jump: false });
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function steer(out: InputState, p: SimPlayer, tx: number, tz: number, sprintDist = 1.8) {
  const dx = tx - p.x, dz = tz - p.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.07) return dist;
  const nx = dx / dist, nz = dz / dist;
  const scale = Math.min(1, dist / 0.45);
  out.mx = nx * p.side * scale;
  out.my = -nz * p.side * scale;
  out.sprint = dist > sprintDist && p.stamina > 0.15;
  return dist;
}

function speedOf(p: SimPlayer) {
  return (p.diff ? DIFF[p.diff].speed : 1) * 6.3;
}

export function predict(sim: Sim, p: SimPlayer): Pred {
  const ai = p.ai!;
  const sh = sim.shuttle;
  const b: Ball = { x: sh.x, y: sh.y, z: sh.z, vx: sh.vx, vy: sh.vy, vz: sh.vz };
  const side = p.side;
  const hpref = ai.wantJump ? 3.25 : 2.5;
  const vmax = speedOf(p);
  let t = 0;
  let cand: Pred | null = null;
  let landed: Pred | null = null;
  let netHit = false;
  const dt = 1 / 60;
  let lastY = b.y;
  while (t < 5) {
    const pz = b.z;
    stepBall(b, dt, sh.drag);
    t += dt;
    if (((pz < 0 && b.z >= 0) || (pz > 0 && b.z <= 0)) && Math.abs(b.x) < NET_HALF && b.y < NET_H) { netHit = true; break; }
    if (b.y <= 0) {
      const hw = sim.hw;
      const out = Math.abs(b.x) > hw + 0.1 || Math.abs(b.z) > COURT.halfLen + 0.1;
      landed = { sx: b.x - side * 0.25, sz: b.z + side * 0.45, iy: 0.3, it: t, lx: b.x, lz: b.z, landOut: out, netHit: false };
      break;
    }
    if (!cand && side * b.z > 0.35 && b.y <= hpref && b.y >= 0.35) {
      const sx = b.x - side * 0.25 + ai.errX;
      const sz = b.z + side * 0.45 + ai.errZ;
      const dist = Math.hypot(sx - p.x, sz - p.z);
      const need = Math.max(0, dist - 0.15) / vmax + 0.1 + (b.y > 2.7 ? 0.35 : 0);
      if (need <= t) cand = { sx, sz, iy: b.y, it: t, lx: 0, lz: 0, landOut: false, netHit: false };
    }
    lastY = b.y;
  }
  void lastY;
  if (netHit) return { sx: p.x, sz: p.z, iy: 0, it: 0, lx: 0, lz: 0, landOut: false, netHit: true };
  const land = landed ?? { sx: b.x - side * 0.25, sz: b.z + side * 0.45, iy: 0.3, it: t, lx: b.x, lz: b.z, landOut: true, netHit: false };
  const res = cand ?? { ...land, sx: land.sx + ai.errX, sz: land.sz + ai.errZ };
  res.lx = land.lx; res.lz = land.lz; res.landOut = land.landOut;
  return res;
}

function mates(sim: Sim, p: SimPlayer) {
  return sim.players.filter((q) => q.team === p.team && q.id !== p.id);
}
function foes(sim: Sim, p: SimPlayer) {
  return sim.players.filter((q) => q.team !== p.team);
}

export function homeSpot(sim: Sim, p: SimPlayer): { x: number; z: number } {
  const side = p.side;
  const sh = sim.shuttle;
  const drift = clamp(sh.landTx * 0.12, -0.5, 0.5);
  if (!sim.rules.cfg.doubles) return { x: drift, z: side * 3.9 };
  const m = mates(sim, p)[0];
  if (!m) return { x: drift, z: side * 3.9 };
  const mode = sim.teamMode[p.team];
  if (mode === 'defend') {
    const left = p.x < m.x || (p.x === m.x && p.slot < m.slot);
    return { x: (left ? -1.5 : 1.5) + drift * 0.5, z: side * 3.9 };
  }
  let front: boolean;
  if (sim.shuttle.lastHitPlayer === p.id) front = false;
  else if (sim.shuttle.lastHitPlayer === m.id) front = true;
  else front = Math.abs(p.z) < Math.abs(m.z);
  return front ? { x: drift * 0.6, z: side * 2.5 } : { x: 0.3 + drift * 0.3, z: side * 4.9 };
}

function chooseKey(sim: Sim, p: SimPlayer, pre: Ball, airborne: boolean): { key: number; aimX: number } {
  const d = DIFF[p.diff!];
  const opp = foes(sim, p);
  const inner = sim.hw - 0.45;
  // open space: opposite of nearest opponent
  let ox = 0, best = 1e9;
  for (const o of opp) {
    const dd = Math.hypot(o.x - pre.x, o.z - pre.z);
    if (dd < best) { best = dd; ox = o.x; }
  }
  let aimX: number;
  if (opp.length > 1) {
    const xs = opp.map((o) => o.x).sort((a, b) => a - b);
    const gap = xs[1] - xs[0];
    aimX = gap > 2.4 ? (xs[0] + xs[1]) / 2 : (xs[0] + xs[1]) / 2 > 0 ? -inner * 0.8 : inner * 0.8;
  } else {
    aimX = Math.abs(ox) < 0.5 ? (sim.rnd() < 0.5 ? -1 : 1) * inner * 0.8 : -Math.sign(ox) * inner * (0.55 + sim.rnd() * 0.4);
  }
  const attack = sim.rnd() < d.aggr;
  const y = pre.y;
  const zNet = Math.abs(p.z);
  let key: number;
  if (airborne) key = 3;
  else if (y >= 1.9) {
    if (zNet > 5.2 && sim.rnd() < 0.6) key = 1;
    else if (attack) key = y >= 2.0 && sim.rnd() < 0.6 ? 5 : p.side * aimX > 0 ? 3 : 4;
    else key = sim.rnd() < 0.55 ? 1 : 2;
  } else if (y >= 1.0) {
    key = attack ? (p.side * aimX > 0 ? 3 : 4) : sim.rnd() < 0.7 ? 1 : 2;
  } else {
    if (zNet < 3.8) key = sim.rnd() < 0.6 ? 2 : 1;
    else key = sim.rnd() < 0.15 * d.aggr * 2 ? (p.side * aimX > 0 ? 3 : 4) : 1;
  }
  if (key === 1 || key === 2) aimX *= key === 1 ? 0.75 : 0.5;
  return { key, aimX };
}

export function aiControl(sim: Sim, p: SimPlayer, dt: number): InputState {
  const ai = p.ai!;
  const d = DIFF[p.diff!];
  const out = blank();
  const sh = sim.shuttle;
  const side = p.side;

  if (sim.phase === 'serve') {
    if (sim.isServer(p)) {
      ai.serveT -= dt;
      if (ai.serveT <= 0 && !p.swing) {
        const r = sim.rnd();
        out.shot = r < 0.35 ? 1 : r < 0.8 ? 2 : r < 0.9 ? 3 : 4;
      }
    } else {
      const sp = sim.spotFor(p);
      steer(out, p, sp.x, sp.z);
    }
    return out;
  }
  if (sim.phase !== 'rally' && sim.phase !== 'drill') return out;

  const heading = sh.active && sh.lastHitTeam >= 0 && sh.lastHitTeam !== p.team && sh.vz * side > 0;
  if (!heading) {
    ai.pred = null;
    ai.jumped = false;
    const h = homeSpot(sim, p);
    steer(out, p, h.x, h.z, 2.5);
    return out;
  }

  if (ai.seenHit !== sh.hits) {
    ai.seenHit = sh.hits;
    ai.reactT = d.react * (0.8 + sim.rnd() * 0.4);
    ai.pred = null;
    ai.wantJump = sim.rnd() < d.jump;
    ai.judgeOk = sim.rnd() < d.judge;
    const ang = sim.rnd() * Math.PI * 2;
    const mag = d.predErr * sim.rnd();
    ai.errX = Math.cos(ang) * mag;
    ai.errZ = Math.sin(ang) * mag;
    ai.swung = false;
    ai.jumped = false;
  }
  ai.reactT -= dt;
  if (ai.reactT > 0) {
    const h = homeSpot(sim, p);
    steer(out, p, h.x, h.z, 2.5);
    return out;
  }
  ai.predT -= dt;
  if (!ai.pred || ai.predT <= 0) {
    ai.pred = predict(sim, p);
    ai.predT = 0.12;
  }
  const pr = ai.pred;
  if (pr.netHit) {
    const h = homeSpot(sim, p);
    steer(out, p, h.x, h.z);
    return out;
  }

  // ---- doubles ownership / teammate awareness ----
  const vm = speedOf(p);
  const myT = Math.hypot(pr.sx - p.x, pr.sz - p.z) / vm;
  let owner = true;
  for (const m of mates(sim, p)) {
    const mv = (m.diff ? DIFF[m.diff].speed : 1) * 6.0;
    const mT = Math.hypot(pr.sx - m.x, pr.sz - m.z) / mv;
    const bias = m.human >= 0 ? 1.15 : 0.92; // yield more to humans
    if (mT * bias < myT - 0.04 || (Math.abs(mT - myT) < 0.04 && m.id < p.id && m.human >= 0)) owner = false;
  }
  if (ai.ownerT > 0 && ai.owner !== owner) {
    ai.ownerT -= dt;
    owner = ai.owner; // hysteresis
  } else if (ai.owner !== owner) {
    ai.owner = owner;
    ai.ownerT = 0.2;
  }
  if (!owner) {
    const h = homeSpot(sim, p);
    steer(out, p, h.x, h.z);
    return out;
  }
  if (pr.landOut && ai.judgeOk) {
    const h = homeSpot(sim, p);
    steer(out, p, h.x, h.z);
    return out;
  }

  // ---- chase ----
  const dist = steer(out, p, pr.sx, pr.sz, 1.4);
  const timeLeft = pr.it - 0.0;

  // jump timing for high shuttles
  if (ai.wantJump && p.grounded && !ai.jumped && pr.iy > 2.6 && dist < 1.4 && timeLeft < 0.55 && !p.swing) {
    ai.jumped = true;
    out.jump = true;
    const ck = chooseKey(sim, p, { ...sh, y: pr.iy } as Ball, true);
    out.aimX = ck.aimX;
    out.special = p.meter >= 100 && sim.rnd() < d.special;
    p.autoAim = ck.aimX;
    return out;
  }
  if (p.swing || p.recover > 0 || ai.swung) return out;
  if (!p.grounded) return out;

  const jit = (sim.rnd() - 0.5) * 2 * d.jit * 3;
  const pre: Ball = { ...sh };
  stepBall(pre, Math.max(0.02, CONTACT_DELAY + jit), sh.drag);
  const body = { x: p.x + p.vx * 0.06, z: p.z + p.vz * 0.06, y: p.y, vx: p.vx, vz: p.vz, side, lunge: false };
  const ev = evaluateContact(body, pre, sim.rules.cfg.arcade);
  const later: Ball = { ...pre };
  stepBall(later, 0.07, sh.drag);
  const evL = evaluateContact(body, later, sim.rules.cfg.arcade);
  const wantJumpHit = ai.wantJump && pr.iy > 2.6;
  if (wantJumpHit) return out;
  const scoreOk = ev.score + d.bias >= d.thr;
  const passing = ev.inReach && evL.score < ev.score - 0.004;
  let go = ev.inReach && (scoreOk || passing);
  if (!go && !ev.inReach) {
    const evLunge = evaluateContact({ ...body, lunge: true }, pre, sim.rules.cfg.arcade);
    if (evLunge.inReach && pre.y < 1.2 && (sh.vy < 0 || p.sprinting)) go = true;
  }
  if (go) {
    ai.swung = true;
    const ck = chooseKey(sim, p, pre, false);
    out.shot = ck.key === 5 ? 5 : ck.key;
    out.aimX = ck.aimX;
    if (ck.key === 5) { out.shot = 0; out.jump = true; }
  }
  return out;
}
