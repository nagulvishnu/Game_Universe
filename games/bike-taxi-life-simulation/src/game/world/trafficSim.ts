import { rt, type TrafficVehicle } from '../runtime';
import { neighbors, nodeId, nodePos, NXN, NZN, P, RW, signalState } from './city';
import { clamp, mulberry32 } from '../util';

const rnd = mulberry32(4242);
const CAR_COLORS = ['#e5e7eb', '#9ca3af', '#1f2937', '#b91c1c', '#1d4ed8', '#f8fafc', '#a16207', '#0f766e'];
const SHIRTS = ['#2563eb', '#f1f5f9', '#16a34a', '#f59e0b', '#db2777', '#7c3aed', '#0ea5e9', '#ef4444'];

const KINDS: { kind: TrafficVehicle['kind']; w: number; len: number; wid: number; v: number }[] = [
  { kind: 'car', w: 38, len: 4.2, wid: 1.8, v: 13 },
  { kind: 'bike', w: 20, len: 2, wid: 0.8, v: 12 },
  { kind: 'auto', w: 12, len: 2.6, wid: 1.4, v: 8.5 },
  { kind: 'bus', w: 7, len: 10, wid: 2.5, v: 9 },
  { kind: 'truck', w: 7, len: 7, wid: 2.4, v: 9 },
  { kind: 'taxi', w: 12, len: 4.2, wid: 1.8, v: 12 },
];

function edgeDir(a: number, b: number): [number, number] {
  const [ax, az] = nodePos(a), [bx, bz] = nodePos(b);
  return [Math.sign(bx - ax), Math.sign(bz - az)];
}

export function initTraffic(count = 56) {
  rt.traffic = [];
  const total = KINDS.reduce((a, k) => a + k.w, 0);
  for (let n = 0; n < count; n++) {
    const police = n < 4;
    let kd = KINDS[0];
    if (!police) { let r = rnd() * total; for (const k of KINDS) { r -= k.w; if (r <= 0) { kd = k; break; } } }
    const i = Math.floor(rnd() * NXN), j = Math.floor(rnd() * NZN);
    const nb = neighbors(i, j);
    const nxt = nb[Math.floor(rnd() * nb.length)];
    const a = nodeId(i, j), b = nodeId(nxt.i, nxt.j);
    rt.traffic.push({
      id: n, kind: police ? 'police' : kd.kind, x: 0, z: 0, heading: 0, speed: 0, a, b, s: rnd() * (P - 30) + 10, len: police ? 4.2 : kd.len, wid: police ? 1.8 : kd.wid,
      color: police ? '#f8fafc' : kd.kind === 'taxi' ? '#facc15' : kd.kind === 'auto' ? '#16a34a' : kd.kind === 'bus' ? '#2563eb' : CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)],
      maxV: (police ? 12 : kd.v) * (0.85 + rnd() * 0.25), lane: kd.kind === 'bike' ? 4.6 : 3.4, hit: 0, blockedT: 0, overtake: 0,
    });
  }
}

export function initPeds(count = 90) {
  rt.peds = [];
  const kinds = ['office', 'student', 'shopkeeper', 'tourist', 'resident', 'mechanic', 'police'];
  for (let n = 0; n < count; n++) {
    const i = Math.floor(rnd() * NXN), j = Math.floor(rnd() * NZN);
    const nb = neighbors(i, j);
    const nxt = nb[Math.floor(rnd() * nb.length)];
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    rt.peds.push({
      id: n, a: nodeId(i, j), b: nodeId(nxt.i, nxt.j), s: rnd() * P, side: rnd() < 0.5 ? 1 : -1, sideNow: 1, speed: 1.1 + rnd() * 0.7, x: 0, z: 0, heading: 0, hidden: 0,
      kind, shirt: kind === 'police' ? '#1e3a8a' : kind === 'student' ? '#f8fafc' : kind === 'mechanic' ? '#ea580c' : SHIRTS[Math.floor(rnd() * SHIRTS.length)], phase: rnd() * 6, alive: 1,
    });
  }
}

const speedFactor = (w: string) => (w === 'heavyRain' || w === 'thunderstorm' ? 0.72 : w === 'lightRain' || w === 'fog' ? 0.85 : 1);

export function updateTraffic(dt: number, weather: string, hour: number, px: number, pz: number, pHeading: number, pOnRoad: boolean) {
  const t = rt.simTimeSec;
  const vs = rt.traffic;
  const night = hour >= 23 || hour < 5;
  const sf = speedFactor(weather) * (night ? 1.05 : 1);
  for (const v of vs) {
    const [ax, az] = nodePos(v.a), [bx, bz] = nodePos(v.b);
    const [dx, dz] = edgeDir(v.a, v.b);
    const len = Math.hypot(bx - ax, bz - az);
    if (v.hit > 0) v.hit -= dt;
    // desired speed
    let target = v.maxV * sf;
    // traffic signal ahead
    const ahead = len - v.s;
    const bi = v.b % NXN, bj = Math.floor(v.b / NXN);
    const axis: 'x' | 'z' = dx !== 0 ? 'x' : 'z';
    const sig = signalState(bi, bj, axis, t);
    const stopLine = RW / 2 + 2.5 + v.len / 2;
    if (sig !== 'green' && ahead > stopLine - 0.5) {
      const gap = ahead - stopLine;
      if (sig === 'red' || gap > v.speed * 1.6) target = Math.min(target, Math.max(0, gap) * 1.3);
    }
    // following + overtaking
    let blocker: TrafficVehicle | null = null, bgap = 1e9;
    for (const o of vs) {
      if (o === v) continue;
      if (o.a === v.a && o.b === v.b && o.s > v.s) {
        const g = o.s - v.s - (o.len + v.len) / 2;
        if (g < bgap && (v.overtake <= 0 || Math.abs(o.lane - v.lane) < 1)) { bgap = g; blocker = o; }
      } else if (o.a === v.b && o.b !== v.a) {
        const [ox, oz] = edgeDir(o.a, o.b);
        if (ox === dx && oz === dz) { const g = ahead + o.s - (o.len + v.len) / 2; if (g < bgap && g > -1) { bgap = g; blocker = o; } }
      }
    }
    // player as obstacle
    const lx = (v.x - px), lz = (v.z - pz);
    const pd = Math.hypot(lx, lz);
    if (pd < 16 && pOnRoad) {
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const along = lx * -fx + lz * -fz; // player ahead of vehicle => positive
      const lat = Math.abs(lx * fz - lz * fx);
      if (along > 0 && lat < 2.6 && Math.abs(Math.sin(v.heading - pHeading)) < 0.6) bgap = Math.min(bgap, along - 3);
    }
    if (bgap < 40) {
      target = Math.min(target, Math.max(0, (bgap - 3.5) * 1.1));
      if (blocker && blocker.maxV < v.maxV * 0.8 && bgap < 12 && v.overtake <= 0) { v.blockedT += dt; if (v.blockedT > 2.5 && (v.kind === 'bike' || v.kind === 'car')) { v.overtake = 4; v.blockedT = 0; } }
    } else v.blockedT = 0;
    if (v.overtake > 0) { v.overtake -= dt; target = Math.max(target, v.maxV * 0.8 * sf); }
    if (v.hit > 0) target = 0;
    // accelerate / brake
    const acc = target > v.speed ? 3.2 : -9;
    v.speed = clamp(v.speed + clamp((target - v.speed) * 1.6, -9, 3.2) * dt, 0, 30);
    void acc;
    v.s += v.speed * dt;
    if (v.s >= len) {
      v.s -= len;
      const na = v.b;
      const opts = neighbors(v.b % NXN, Math.floor(v.b / NXN)).filter((n) => nodeId(n.i, n.j) !== v.a);
      let pickN = opts[Math.floor(Math.random() * opts.length)];
      const straight = opts.find((n) => edgeDir(na, nodeId(n.i, n.j))[0] === dx && edgeDir(na, nodeId(n.i, n.j))[1] === dz);
      if (straight && Math.random() < 0.55) pickN = straight;
      v.a = na; v.b = nodeId(pickN.i, pickN.j);
    }
    const [ndx, ndz] = edgeDir(v.a, v.b);
    const [sx, sz] = nodePos(v.a);
    const lat = v.overtake > 0 ? 0.4 : v.lane;
    const tx = sx + ndx * v.s + ndz * lat, tz = sz + ndz * v.s - ndx * lat;
    v.heading = Math.atan2(ndx, ndz);
    v.x = tx; v.z = tz;
  }
  // pedestrians
  const act = pedActivity(hour);
  const nAct = Math.floor(rt.peds.length * act);
  for (const p of rt.peds) {
    if (p.id >= nAct || p.hidden > 0) { if (p.hidden > 0) p.hidden -= dt; p.alive = p.id < nAct ? 1 : 0; if (p.id >= nAct) continue; }
    p.alive = 1;
    const [ax, az] = nodePos(p.a), [bx, bz] = nodePos(p.b);
    const dx = Math.sign(bx - ax);
    const len = Math.hypot(bx - ax, bz - az);
    // wait at red signals before crossing
    const near = len - p.s;
    let go = true;
    if (near < 9 && near > 6) {
      const bi = p.b % NXN, bj = Math.floor(p.b / NXN);
      const axis: 'x' | 'z' = dx !== 0 ? 'z' : 'x'; // crossing traffic axis
      if (signalState(bi, bj, axis, rt.simTimeSec) === 'green') go = false;
    }
    if (go) p.s += p.speed * dt * (weather === 'heavyRain' || weather === 'thunderstorm' ? 1.35 : 1);
    if (p.s >= len) {
      p.s -= len;
      const na = p.b;
      const opts = neighbors(p.b % NXN, Math.floor(p.b / NXN)).filter((n) => nodeId(n.i, n.j) !== p.a);
      const pickN = opts[Math.floor(Math.random() * opts.length)];
      p.a = na; p.b = nodeId(pickN.i, pickN.j);
      if (Math.random() < 0.4) p.side = -p.side;
    }
    p.sideNow += (p.side - p.sideNow) * Math.min(1, dt * 0.35);
    const [ndx, ndz] = (() => { const [a1, a2] = nodePos(p.a), [b1, b2] = nodePos(p.b); return [Math.sign(b1 - a1), Math.sign(b2 - a2)]; })();
    const [sx, sz] = nodePos(p.a);
    const off = (RW / 2 + 1.8) * p.sideNow;
    p.x = sx + ndx * p.s + ndz * off; p.z = sz + ndz * p.s - ndx * off;
    p.heading = Math.atan2(ndx, ndz);
    p.phase += dt * 6;
  }
}

export function pedActivity(hour: number) {
  if (hour >= 8 && hour < 11) return 1;
  if (hour >= 17 && hour < 21) return 1;
  if (hour >= 11 && hour < 17) return 0.8;
  if (hour >= 6 && hour < 8) return 0.6;
  if (hour >= 21 && hour < 24) return 0.45;
  return 0.12;
}
export function trafficDensity(hour: number) {
  if ((hour >= 8 && hour < 11) || (hour >= 17 && hour < 20)) return 1;
  if (hour >= 11 && hour < 17) return 0.8;
  if (hour >= 5 && hour < 8) return 0.6;
  if (hour >= 20 && hour < 24) return 0.5;
  return 0.22;
}
