// Pure simulation: arcade car physics, AI drivers, collisions and lap logic.
import type { CarDef } from "./data";
import { CURB, nearestGlobal, sampleAt, type TrackData } from "./trackMath";

export interface Env {
  roadGrip: number;
  offroadGrip: number;
}

export interface CarDims {
  len: number;
  wid: number;
}

export interface SimCar {
  id: number;
  name: string;
  isPlayer: boolean;
  def: CarDef;
  color: number;
  len: number;
  wid: number;

  x: number;
  y: number;
  z: number;
  psi: number;
  vx: number;
  vz: number;

  steerIn: number;
  steer: number;
  throttle: number;
  brake: number;
  hand: boolean;
  nitroWant: boolean;
  nitro: number;
  nitroOn: boolean;

  speed: number; // forward velocity
  vs: number; // sideways velocity
  yaw: number;
  longAcc: number;
  gear: number;
  rpm: number;
  onRoad: boolean;
  sliding: boolean;

  idx: number;
  sAbs: number;
  along: number;
  lat: number;
  relPsi: number;
  total: number;
  lapsDone: number;
  lapStart: number;
  lapTimes: number[];
  bestLap: number;
  finished: boolean;
  finishTime: number;
  place: number;

  auto: boolean;
  aiLane: number;
  aiBaseLane: number;
  skill: number;
  stuck: number;
  nitroCool: number;

  hit: number; // wall impact this frame
  carHit: number; // car impact this frame
}

export const wrapPi = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function createSimCar(
  id: number,
  name: string,
  def: CarDef,
  color: number,
  dims: CarDims,
  isPlayer: boolean,
): SimCar {
  return {
    id,
    name,
    isPlayer,
    def,
    color,
    len: dims.len,
    wid: dims.wid,
    x: 0,
    y: 0,
    z: 0,
    psi: 0,
    vx: 0,
    vz: 0,
    steerIn: 0,
    steer: 0,
    throttle: 0,
    brake: 0,
    hand: false,
    nitroWant: false,
    nitro: 60,
    nitroOn: false,
    speed: 0,
    vs: 0,
    yaw: 0,
    longAcc: 0,
    gear: 1,
    rpm: 0.2,
    onRoad: true,
    sliding: false,
    idx: 0,
    sAbs: 0,
    along: 0,
    lat: 0,
    relPsi: 0,
    total: 0,
    lapsDone: 0,
    lapStart: 0,
    lapTimes: [],
    bestLap: Infinity,
    finished: false,
    finishTime: 0,
    place: 0,
    auto: !isPlayer,
    aiLane: 0,
    aiBaseLane: 0,
    skill: 0.9,
    stuck: 0,
    nitroCool: 0,
    hit: 0,
    carHit: 0,
  };
}

/** Put the car on the grid / at a given track distance. */
export function placeCar(t: TrackData, car: SimCar, s: number, lat: number, resetTotal = true) {
  const p = sampleAt(t, s, lat);
  car.x = p.x;
  car.z = p.z;
  car.y = p.y;
  car.psi = p.psi;
  car.vx = 0;
  car.vz = 0;
  car.speed = 0;
  car.vs = 0;
  car.steer = 0;
  car.yaw = 0;
  car.idx = nearestGlobal(t, car.x, car.z);
  locate(t, car, false);
  if (resetTotal) car.total = s;
}

/** Update nearest-sample bookkeeping. */
export function locate(t: TrackData, car: SimCar, track = true) {
  const n = t.n;
  let best = Infinity;
  let bi = car.idx;
  for (let k = -10; k <= 14; k++) {
    const i = (car.idx + k + n) % n;
    const p = t.pts[i];
    const d = (p.x - car.x) * (p.x - car.x) + (p.z - car.z) * (p.z - car.z);
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  // If we drifted far from the window (teleport) do a global search
  if (best > 60 * 60) bi = nearestGlobal(t, car.x, car.z);
  car.idx = bi;
  const p = t.pts[bi];
  const dx = car.x - p.x;
  const dz = car.z - p.z;
  car.along = dx * p.tx + dz * p.tz;
  car.lat = dx * p.nx + dz * p.nz;
  const sAbs = p.s + car.along;
  if (track) {
    let delta = sAbs - car.sAbs;
    if (delta < -t.length / 2) delta += t.length;
    else if (delta > t.length / 2) delta -= t.length;
    car.total += delta;
  }
  car.sAbs = sAbs;
  car.y = p.y + p.slope * car.along;
  car.relPsi = wrapPi(car.psi - Math.atan2(p.tx, p.tz));
}

const GEARS = [0.2, 0.36, 0.52, 0.68, 0.84, 1.02];

export function stepCar(t: TrackData, car: SimCar, dt: number, env: Env) {
  const def = car.def;
  const sp = Math.abs(car.speed);

  // --- steering smoothing
  const rate = (car.steerIn === 0 ? 8 : 5.2) / (1 + sp / 55);
  const target = car.steerIn;
  const diff = target - car.steer;
  car.steer += clamp(diff, -rate * dt * 1.4, rate * dt * 1.4);
  car.steer = clamp(car.steer, -1, 1);

  // --- surface
  car.onRoad = Math.abs(car.lat) <= t.halfWidth + CURB;
  const gripMul = car.onRoad ? env.roadGrip : env.offroadGrip + (1 - env.offroadGrip) * def.offroad * 0.75;

  // --- nitro
  const wantNitro = car.nitroWant && car.nitro > 1 && car.throttle > 0.1;
  car.nitroOn = wantNitro;
  if (car.nitroOn) car.nitro = Math.max(0, car.nitro - 26 * dt);
  else car.nitro = Math.min(100, car.nitro + (car.sliding ? 9 : 2.5) * dt);

  const vmax = def.maxSpeed * (car.nitroOn ? 1.18 : 1) * (car.onRoad ? 1 : 0.88 + 0.12 * def.offroad);

  // --- yaw
  const dir = car.speed >= 0 ? 1 : -1;
  let yawMax = (def.handling * Math.min(1, sp / 6)) / (1 + sp / 45);
  yawMax *= (0.86 + 0.14 * gripMul) * (car.onRoad ? 1 : 0.85);
  if (car.hand) yawMax *= 1.3;
  car.yaw = car.steer * yawMax * dir;
  car.psi += car.yaw * dt;
  if (car.psi > Math.PI) car.psi -= Math.PI * 2;
  else if (car.psi < -Math.PI) car.psi += Math.PI * 2;

  // --- decompose into body frame
  const fx = Math.sin(car.psi);
  const fz = Math.cos(car.psi);
  const sx = fz;
  const sz = -fx;
  let vf = car.vx * fx + car.vz * fz;
  let vs = car.vx * sx + car.vz * sz;
  const prevVf = vf;

  // --- longitudinal
  if (car.throttle > 0) {
    if (vf < -0.5) {
      vf += def.brake * 0.8 * dt;
    } else {
      const boost = car.nitroOn ? 1.65 * def.nitro : 1;
      let a = def.accel * boost * car.throttle * Math.max(0, 1 - (vf / vmax) * (vf / vmax));
      a *= 0.55 + 0.45 * gripMul;
      if (vf > vmax) a = -(vf - vmax) * 1.2;
      vf += a * dt;
    }
  }
  if (car.brake > 0) {
    if (vf > 0.6) {
      vf = Math.max(0, vf - def.brake * car.brake * (0.6 + 0.4 * gripMul) * dt);
    } else {
      vf = Math.max(-def.maxSpeed * 0.28, vf - def.accel * 0.5 * car.brake * dt);
    }
  }
  if (car.throttle === 0 && car.brake === 0) {
    const d = (1.2 + 0.012 * Math.abs(vf)) * dt;
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), d);
  }
  if (!car.onRoad) {
    const d = (3 + 0.12 * Math.abs(vf)) * (1 - def.offroad * 0.65) * dt;
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), d);
  }
  if (car.hand) {
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
  }

  // --- lateral grip
  let gripEff = def.grip * gripMul;
  if (car.hand) gripEff = 1.5 * gripMul;
  vs *= Math.exp(-gripEff * dt);

  car.vx = fx * vf + sx * vs;
  car.vz = fz * vf + sz * vs;
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.speed = vf;
  car.vs = vs;
  car.sliding = Math.abs(vs) > 2.6 && Math.abs(vf) > 8;
  const la = (vf - prevVf) / Math.max(dt, 1e-4);
  car.longAcc += (la - car.longAcc) * Math.min(1, dt * 6);

  // --- gearbox / rpm
  const spd = Math.abs(vf);
  let g = 0;
  while (g < GEARS.length - 1 && spd > GEARS[g] * def.maxSpeed) g++;
  const top = GEARS[g] * def.maxSpeed;
  const bottom = g === 0 ? 0 : GEARS[g - 1] * def.maxSpeed * 0.78;
  let rpmT = g === 0 ? 0.18 + 0.82 * (spd / top) : 0.36 + 0.64 * clamp((spd - bottom) / (top - bottom), 0, 1);
  rpmT = clamp(rpmT + (car.throttle > 0 ? 0.04 : -0.03), 0.15, 1);
  car.gear = g + 1;
  car.rpm += (rpmT - car.rpm) * Math.min(1, dt * 14);

  locate(t, car);
}

export function resolveBarrier(t: TrackData, car: SimCar, dt: number) {
  const dpsi = car.relPsi;
  const ext = Math.abs(Math.sin(dpsi)) * car.len * 0.5 + Math.abs(Math.cos(dpsi)) * car.wid * 0.5;
  const limit = t.barrier - 0.3;
  const over = Math.abs(car.lat) + ext - limit;
  if (over <= 0) return;
  const p = t.pts[car.idx];
  const sgn = car.lat >= 0 ? 1 : -1;
  const nx = -sgn * p.nx;
  const nz = -sgn * p.nz;
  car.x += nx * over;
  car.z += nz * over;
  const vn = car.vx * nx + car.vz * nz;
  const m = Math.sqrt(car.def.mass);
  if (vn < 0) {
    car.vx -= (1 + 0.22) * vn * nx;
    car.vz -= (1 + 0.22) * vn * nz;
    const loss = 1 - clamp((0.1 + Math.abs(vn) * 0.012) / m, 0, 0.45);
    car.vx *= loss;
    car.vz *= loss;
    car.hit = Math.max(car.hit, -vn);
  }
  // scrape friction + steer along the wall
  const scrape = 1 - clamp((0.9 * dt) / m, 0, 0.1);
  car.vx *= scrape;
  car.vz *= scrape;
  const tp = Math.atan2(p.tx, p.tz);
  const rel = wrapPi(tp - car.psi);
  const forward = Math.abs(rel) < Math.PI / 2;
  const align = forward ? rel : wrapPi(rel + Math.PI);
  car.psi += align * Math.min(1, 2.2 * dt);
  locate(t, car);
}

export function resolveCars(cars: SimCar[]) {
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const A = cars[a];
      const B = cars[b];
      const dx0 = A.x - B.x;
      const dz0 = A.z - B.z;
      if (dx0 * dx0 + dz0 * dz0 > 36) continue;
      const afx = Math.sin(A.psi);
      const afz = Math.cos(A.psi);
      const bfx = Math.sin(B.psi);
      const bfz = Math.cos(B.psi);
      const ao = A.len * 0.28;
      const bo = B.len * 0.28;
      const ra = A.wid * 0.5;
      const rb = B.wid * 0.5;
      const mA = A.def.mass;
      const mB = B.def.mass;
      for (const sa of [-1, 1]) {
        for (const sb of [-1, 1]) {
          const ax = A.x + afx * ao * sa;
          const az = A.z + afz * ao * sa;
          const bx = B.x + bfx * bo * sb;
          const bz = B.z + bfz * bo * sb;
          let dx = ax - bx;
          let dz = az - bz;
          const d = Math.hypot(dx, dz);
          const minD = ra + rb;
          if (d >= minD || d < 1e-5) continue;
          dx /= d;
          dz /= d;
          const pen = minD - d;
          const wa = mB / (mA + mB);
          const wb = mA / (mA + mB);
          A.x += dx * pen * wa;
          A.z += dz * pen * wa;
          B.x -= dx * pen * wb;
          B.z -= dz * pen * wb;
          const vrel = (A.vx - B.vx) * dx + (A.vz - B.vz) * dz;
          if (vrel < 0) {
            const j = (-(1 + 0.3) * vrel) / (1 / mA + 1 / mB);
            A.vx += (j / mA) * dx;
            A.vz += (j / mA) * dz;
            B.vx -= (j / mB) * dx;
            B.vz -= (j / mB) * dz;
            const imp = -vrel;
            A.carHit = Math.max(A.carHit, imp);
            B.carHit = Math.max(B.carHit, imp);
            // slight yaw kick from off-centre hits
            const kick = clamp(imp * 0.012, 0, 0.12);
            const crossA = afx * dz - afz * dx;
            const crossB = bfx * -dz - bfz * -dx;
            A.psi += crossA * kick * sa * (mB / (mA + mB));
            B.psi += crossB * kick * sb * (mA / (mA + mB));
          }
        }
      }
    }
  }
}

export interface AIParams {
  skill: number;
  band: number; // rubber band multiplier on top speed
}

export function aiDrive(t: TrackData, car: SimCar, all: SimCar[], dt: number, env: Env, band: number) {
  const def = car.def;
  const sp = Math.max(car.speed, 0);
  const n = t.n;
  const half = t.halfWidth - 2.4;

  // lane choice / overtaking
  let laneT = car.aiBaseLane;
  for (const o of all) {
    if (o === car) continue;
    let dS = o.sAbs - car.sAbs;
    if (dS < -t.length / 2) dS += t.length;
    else if (dS > t.length / 2) dS -= t.length;
    if (dS > 0 && dS < 14 + sp * 0.5 && Math.abs(o.lat - car.aiLane) < 3.4) {
      const dir = car.aiLane - o.lat >= 0 ? 1 : -1;
      let cand = o.lat + dir * 3.8;
      if (Math.abs(cand) > half) cand = o.lat - dir * 3.8;
      laneT = clamp(cand, -half, half);
      break;
    }
  }
  laneT = clamp(laneT, -half, half);
  car.aiLane += (laneT - car.aiLane) * Math.min(1, dt * 2.0);

  // steering towards look-ahead point
  const look = clamp(9 + sp * 0.5, 12, 55);
  const ti = (car.idx + Math.round(look / t.spacing)) % n;
  const P = t.pts[ti];
  const lane = car.onRoad ? car.aiLane : 0;
  const tx = P.x + P.nx * lane;
  const tz = P.z + P.nz * lane;
  const desired = Math.atan2(tx - car.x, tz - car.z);
  const err = wrapPi(desired - car.psi);
  car.steerIn = clamp(err * 2.3, -1, 1);

  // speed planning
  const corner = 0.62 + 0.24 * clamp((car.skill - 0.8) / 0.18, 0, 1);
  const gripF = clamp(def.grip / 8.5, 0.72, 1.05) * clamp(1 - (def.maxSpeed - 60) / 120, 0.85, 1);
  const hEff = def.handling * corner * gripF * (0.86 + 0.14 * env.roadGrip);
  const cap = def.maxSpeed * car.skill * band;
  const decel = def.brake * 0.5 * (0.6 + 0.4 * env.roadGrip);
  const K = Math.min(70, Math.ceil((sp * sp) / (2 * decel * t.spacing) + 14));
  let vT = cap;
  for (let k = 0; k <= K; k++) {
    const p = t.pts[(car.idx + k) % n];
    const kappa = Math.max(Math.abs(p.curv), 1e-4);
    let vc = (-45 + Math.sqrt(2025 + (180 * hEff) / kappa)) / 2;
    vc = Math.min(vc, cap);
    const allowed = Math.sqrt(vc * vc + 2 * decel * k * t.spacing);
    if (allowed < vT) vT = allowed;
  }
  if (!car.onRoad) vT = Math.min(vT, 24);

  if (sp < vT - 1.5) {
    car.throttle = 1;
    car.brake = 0;
  } else if (sp < vT + 0.8) {
    car.throttle = 0.45;
    car.brake = 0;
  } else {
    car.throttle = 0;
    car.brake = sp > vT + 2.5 ? clamp((sp - vT - 2.5) / 7, 0.25, 1) : 0;
  }
  car.hand = false;

  // nitro on long straights
  car.nitroCool -= dt;
  const straight = Math.abs(P.curv) < 0.0015 && vT >= cap * 0.97;
  car.nitroWant = car.skill > 0.84 && straight && car.nitro > 45 && car.nitroCool <= 0 && Math.abs(err) < 0.1;
  if (car.nitro < 5) car.nitroCool = 6 + Math.random() * 6;

  // stuck handling (e.g. wedged against a wall)
  if (sp < 2.5 && car.total > 5) car.stuck += dt;
  else car.stuck = 0;
  if (car.stuck > 3.2) {
    car.stuck = 0;
    const s = car.sAbs;
    placeCar(t, car, s + 4, 0, false);
  }
}

/** Returns true when a new lap has just been completed. */
export function updateLaps(t: TrackData, car: SimCar, now: number, totalLaps: number): boolean {
  const laps = Math.max(0, Math.floor(car.total / t.length));
  if (laps > car.lapsDone) {
    const lt = now - car.lapStart;
    car.lapStart = now;
    car.lapsDone = laps;
    car.lapTimes.push(lt);
    if (lt < car.bestLap) car.bestLap = lt;
    if (laps >= totalLaps && !car.finished) {
      car.finished = true;
      car.finishTime = now;
    }
    return true;
  }
  return false;
}

export function rankCars(cars: SimCar[]): SimCar[] {
  return [...cars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.total - a.total;
  });
}
