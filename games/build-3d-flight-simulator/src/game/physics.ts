import * as THREE from 'three';
import type { AircraftSpec } from './aircraft';
import { terrainHeight, surfaceAt, hitsObstacle, type Surface } from './worldData';
import { clamp, smoothstep } from './noise';

export const G = 9.81;
export const airDensity = (h: number) => 1.225 * Math.exp(-Math.max(h, 0) / 8500);
export const speedOfSound = (h: number) => 340.3 - Math.min(Math.max(h, 0), 11000) * 0.004;

export interface Controls {
  pitch: number; // + nose up
  roll: number; // + right bank
  yaw: number; // + nose right
  throttleAxis: number; // -1..1 (collective for helis)
  brake: boolean;
}

export interface Touchdown { sink: number; speed: number; x: number; z: number; t: number; gearDown: boolean; heading: number }

export interface FlightState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  w: THREE.Vector3; // body angular velocity (x pitch-up, y yaw-left, z roll-left)
  throttle: number;
  thrustOut: number;
  gearCmd: boolean;
  gear: number;
  flapsCmd: number;
  flaps: number;
  brake: boolean;
  airbrake: number;
  fuel: number;
  payload: number;
  integrity: number;
  // derived
  alpha: number;
  beta: number;
  ias: number;
  tas: number;
  mach: number;
  gLoad: number;
  stallAmt: number;
  onGround: boolean;
  airTime: number;
  groundTime: number;
  agl: number;
  afterburner: boolean;
  crashed: boolean;
  crashReason: string;
  wheelComp: number[];
  lastTouchdown: Touchdown | null;
  newTouchdown: boolean;
  propAngle: number;
  rotorAngle: number;
  rpm: number;
  steer: number;
  surface: Surface;
  onWater: boolean;
  warnings: Set<string>;
  scrape: number;
  time: number;
  lastTurbulence: number;
}

export interface Env {
  wind: THREE.Vector3;
  turbulence: number;
  assist: boolean;
  noThrust: boolean;
  frozen: boolean;
}

export function createState(spec: AircraftSpec): FlightState {
  return {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(), w: new THREE.Vector3(),
    throttle: 0, thrustOut: 0, gearCmd: true, gear: 1, flapsCmd: 0, flaps: 0, brake: false, airbrake: 0,
    fuel: spec.fuelCap, payload: 0, integrity: 100,
    alpha: 0, beta: 0, ias: 0, tas: 0, mach: 0, gLoad: 1, stallAmt: 0, onGround: false, airTime: 0, groundTime: 0, agl: 0,
    afterburner: false, crashed: false, crashReason: '', wheelComp: spec.wheels.map(() => 0), lastTouchdown: null,
    newTouchdown: false, propAngle: 0, rotorAngle: 0, rpm: 0, steer: 0, surface: 'pavement', onWater: false,
    warnings: new Set(), scrape: 0, time: 0, lastTurbulence: 0,
  };
}

export function placeOnGround(st: FlightState, spec: AircraftSpec, x: number, z: number, heading: number, groundY: number) {
  const lowest = Math.min(...spec.wheels.map((w) => w.y));
  st.pos.set(x, groundY - lowest - 0.12, z);
  st.quat.setFromAxisAngle(Y_AXIS, -heading);
  st.vel.set(0, 0, 0);
  st.w.set(0, 0, 0);
  st.onGround = true;
  st.thrustOut = 0;
  st.throttle = 0;
  if (spec.thrustKind === 'heli') st.rpm = 1;
}

export function placeInAir(st: FlightState, spec: AircraftSpec, x: number, y: number, z: number, heading: number, speed: number, gearDown: boolean) {
  st.pos.set(x, y, z);
  st.quat.setFromAxisAngle(Y_AXIS, -heading);
  st.vel.set(Math.sin(heading) * speed, 0, -Math.cos(heading) * speed);
  st.w.set(0, 0, 0);
  st.onGround = false;
  st.airTime = 5;
  st.gearCmd = gearDown || !!spec.fixedGear;
  st.gear = st.gearCmd ? 1 : 0;
  st.throttle = spec.thrustKind === 'heli' ? 0.55 : clamp(speed / spec.vCruise, 0.3, 0.8);
  st.thrustOut = st.throttle;
  st.rpm = 1;
  if (spec.thrustKind === 'heli') st.vel.set(0, 0, 0);
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _F = new THREE.Vector3();
const _T = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _r = new THREE.Vector3();
const _vp = new THREE.Vector3();
const _wW = new THREE.Vector3();
const _qInv = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _lift = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _lat = new THREE.Vector3();
const _gust = new THREE.Vector3();

function liftCoef(spec: AircraftSpec, a: number): number {
  const as = spec.alphaStall;
  const aa = Math.abs(a);
  const sgn = a < 0 ? -1 : 1;
  if (aa <= as) return spec.CLa * a + spec.CL0;
  const peak = spec.CLa * as;
  const t = clamp((aa - as) / 0.35, 0, 1);
  let cl = peak * (1 - 0.5 * t);
  if (aa > as + 0.35) cl = 0.5 * peak * Math.max(0, Math.cos((aa - as - 0.35) * 1.8));
  return sgn * cl + spec.CL0 * (1 - t);
}

function surfaceCoef(s: Surface) {
  switch (s) {
    case 'pavement': return { crr: 0.016, brake: 1, lat: 1.1 };
    case 'grass': return { crr: 0.07, brake: 0.55, lat: 0.8 };
    case 'sand': return { crr: 0.12, brake: 0.45, lat: 0.7 };
    case 'snow': return { crr: 0.09, brake: 0.4, lat: 0.6 };
    case 'rock': return { crr: 0.1, brake: 0.5, lat: 0.8 };
    default: return { crr: 0.2, brake: 0.2, lat: 0.4 };
  }
}

export interface StepResult {
  touchdown: boolean;
  crashed: boolean;
  damage: number;
  hardLanding: boolean;
}

function crash(st: FlightState, reason: string) {
  if (!st.crashed) {
    st.crashed = true;
    st.crashReason = reason;
  }
}

/** One physics step. Returns events produced. */
export function stepFlight(st: FlightState, spec: AircraftSpec, ctl: Controls, env: Env, dt: number): StepResult {
  const res: StepResult = { touchdown: false, crashed: false, damage: 0, hardLanding: false };
  if (st.crashed) return res;
  st.time += dt;
  st.newTouchdown = false;
  const isHeli = spec.thrustKind === 'heli';
  const m = spec.mass + st.fuel + st.payload;
  const alt = st.pos.y;
  const rho = airDensity(alt);
  const rr = rho / 1.225;
  const dmgFactor = st.integrity > 60 ? 1 : 0.4 + (st.integrity / 60) * 0.6;
  const ctlQ = 0.5 + 0.5 * (st.integrity / 100);

  _fwd.set(0, 0, -1).applyQuaternion(st.quat);
  _up.set(0, 1, 0).applyQuaternion(st.quat);
  _right.set(1, 0, 0).applyQuaternion(st.quat);
  _qInv.copy(st.quat).invert();

  // turbulence (smooth pseudo-random gusts)
  const T0 = st.time;
  const turb = env.turbulence * (1 + (alt < 400 ? 0.5 : 0));
  _gust.set(
    Math.sin(T0 * 1.3) + 0.7 * Math.sin(T0 * 2.9 + 1.7) + 0.4 * Math.sin(T0 * 6.1),
    0.8 * Math.sin(T0 * 1.9 + 0.4) + 0.6 * Math.sin(T0 * 4.3 + 2.2) + 0.3 * Math.sin(T0 * 7.7),
    Math.sin(T0 * 1.1 + 3) + 0.5 * Math.sin(T0 * 3.7),
  ).multiplyScalar(turb * 4.2);
  st.lastTurbulence = turb;

  // gear / flaps / brakes
  if (!spec.fixedGear) {
    const gs = dt / (spec.cls === 'fighter' ? 3 : 5);
    st.gear = clamp(st.gear + (st.gearCmd ? gs : -gs), 0, 1);
  } else st.gear = 1;
  const flapTarget = spec.flapLevels > 0 ? st.flapsCmd / spec.flapLevels : 0;
  st.flaps += clamp(flapTarget - st.flaps, -0.2 * dt, 0.2 * dt);
  st.brake = ctl.brake;
  st.airbrake += clamp((ctl.brake && !st.onGround ? 1 : 0) - st.airbrake, -2 * dt, 2 * dt);

  // engine
  const fuelOK = st.fuel > 0 && !env.noThrust && st.integrity > 8;
  const tgtThr = fuelOK ? st.throttle : 0;
  st.thrustOut += (tgtThr - st.thrustOut) * (1 - Math.exp(-dt / spec.spool));
  if (isHeli) st.rpm += ((fuelOK ? 1 : 0) - st.rpm) * (1 - Math.exp(-dt / 4));
  st.afterburner = spec.hasAB && fuelOK && st.throttle > 0.92 && st.thrustOut > 0.88;
  if (fuelOK || st.fuel > 0) {
    const burn = spec.burn * (0.1 + 0.9 * st.thrustOut) * (st.afterburner ? 3.2 : 1);
    st.fuel = Math.max(0, st.fuel - burn * dt);
  }

  _F.set(0, -m * G, 0);
  _T.set(0, 0, 0);

  // ---------- relative air ----------
  _rel.copy(st.vel).sub(env.wind).sub(_gust);
  const V = _rel.length();
  _vb.copy(_rel).applyQuaternion(_qInv);
  st.tas = V;
  st.ias = V * Math.sqrt(rr);
  st.mach = V / speedOfSound(alt);

  const Ix = m * Math.pow(spec.length * 0.28, 2);
  const Iy = m * Math.pow(spec.length * 0.3, 2);
  const Iz = m * Math.pow(Math.max(spec.span, 6) * 0.25, 2);

  let groundBlend = st.onGround ? 1 : 0;

  if (!isHeli) {
    st.alpha = V > 1 ? Math.atan2(-_vb.y, -_vb.z) : 0;
    st.beta = V > 1 ? Math.asin(clamp(_vb.x / V, -1, 1)) : 0;
    { const lowV = smoothstep(4, 18, V); st.alpha *= lowV; st.beta *= lowV; }
    const qd = 0.5 * rho * V * V;
    const flapCL = spec.flapCL * st.flaps;
    const CL = liftCoef(spec, st.alpha) + flapCL;
    st.stallAmt = V > 8 ? clamp((Math.abs(st.alpha) - 0.82 * spec.alphaStall) / (0.18 * spec.alphaStall), 0, 1) : 0;
    const M = st.mach;
    let CDw = 0;
    if (spec.hasAB) CDw = 0.045 * smoothstep(0.85, 1.05, M) * (1 - 0.5 * smoothstep(1.2, 2, M));
    else CDw = 0.09 * smoothstep(0.78, 0.92, M);
    const sa = Math.sin(st.alpha);
    const sb = Math.sin(st.beta);
    const CD = spec.CD0 + spec.k * CL * CL + spec.gearCD * st.gear * (spec.fixedGear ? 0.6 : 1) + spec.flapCD * st.flaps + spec.airbrakeCD * st.airbrake
      + CDw + 1.1 * sa * sa + 0.9 * sb * sb + (1 - st.integrity / 100) * 0.012;

    if (V > 0.5) {
      _dir.copy(_rel).multiplyScalar(1 / V);
      _lift.crossVectors(_right, _dir);
      const ll = _lift.length();
      if (ll > 0.15) _lift.multiplyScalar(1 / ll);
      else _lift.set(0, 0, 0);
      const Lmag = qd * spec.S * CL * Math.min(1, ll * 3);
      _tmp.copy(_lift).multiplyScalar(Lmag);
      _F.add(_tmp);
      _tmp.copy(_dir).multiplyScalar(-qd * spec.S * CD);
      _F.add(_tmp);
      _tmp.copy(_right).multiplyScalar(-qd * spec.S * spec.CYb * st.beta);
      _F.add(_tmp);
    }

    // thrust
    let thrust = 0;
    const fwdSpeed = Math.max(0, -_vb.z);
    if (spec.thrustKind === 'jet') {
      thrust = spec.thrust * (0.05 + 0.95 * st.thrustOut) * Math.pow(rr, 0.75) * dmgFactor * (st.afterburner ? 1.65 : 1);
      if (!spec.hasAB && st.onGround && ctl.brake && V > 18) thrust = -0.28 * spec.thrust * rr; // reverse thrust
    } else {
      thrust = spec.thrust * (0.03 + 0.97 * st.thrustOut) * Math.pow(rr, 0.9) * clamp(1 - fwdSpeed / spec.vPropMax, 0, 1) * dmgFactor;
    }
    if (st.fuel <= 0 || env.noThrust) thrust = Math.min(thrust, 0);
    _tmp.copy(_fwd).multiplyScalar(thrust);
    _F.add(_tmp);

    // ---- moments / control ----
    const vRefIAS = spec.vRef;
    const qRef = 0.5 * 1.225 * vRefIAS * vRefIAS;
    const eff = clamp(qd / qRef, 0.12, 1.6) * ctlQ;
    const airborne = clamp(1 - groundBlend, 0, 1);

    // pitch
    const gamma = V > 1 ? Math.asin(clamp(_rel.y / V, -1, 1)) : 0;
    const clTrim = qd > 50 ? (m * G * Math.cos(gamma)) / (qd * spec.S) : 3;
    let aTrim = qd > 50 ? (clTrim - spec.CL0 - flapCL) / spec.CLa : 0.3;
    aTrim = clamp(aTrim, -0.05, spec.alphaStall * 0.8);
    aTrim *= airborne;
    let pIn = ctl.pitch;
    if (env.assist && airborne > 0.5 && V > 25 && _up.y > 0.2) {
      pIn += clamp((1 / Math.max(_up.y, 0.35) - 1) * 0.3, 0, 0.55);
    }
    pIn = clamp(pIn, -1, 1);
    let aT = aTrim + (pIn >= 0 ? pIn * spec.pitchUp : pIn * spec.pitchDown);
    if (env.assist && pIn > 0) aT = Math.min(aT, (spec.gMax * 1.02 * clTrim - spec.CL0 - flapCL) / spec.CLa, spec.alphaStall * 0.93);
    const pitchRate = st.w.x;
    const aP = spec.pitchStab * eff * (aT - st.alpha) - spec.pitchDamp * pitchRate * (0.5 + 0.5 * Math.min(eff, 1));
    st.w.x += aP * dt;

    // roll
    const bank = Math.atan2(-_right.y, _up.y);
    let rollIn = ctl.roll;
    let tgt = rollIn * spec.rollRate * clamp(Math.sqrt(eff), 0.25, 1.2);
    if (env.assist && Math.abs(rollIn) < 0.05 && airborne > 0.5 && Math.abs(bank) < 2.4) {
      tgt = -clamp(bank * 1.4, -0.7, 0.7) * Math.min(1, spec.rollRate * 0.8 + 0.3);
    }
    if (env.assist && Math.abs(bank) > 1.25 && Math.sign(rollIn) === Math.sign(bank)) tgt = 0;
    if (st.stallAmt > 0.4) tgt += Math.sin(st.time * 3.1) * 0.6 * st.stallAmt;
    const rollRate = -st.w.z;
    let aR = spec.rollResp * (tgt - rollRate) * airborne * clamp(eff, 0.3, 1.3) - spec.dihedral * st.beta * eff * 1.2 * airborne;
    aR += (turb > 0 ? _gust.x * 0.05 * turb : 0) * airborne;
    st.w.z += -aR * dt;

    // yaw
    const steerIn = clamp(ctl.yaw + (st.onGround ? ctl.roll : 0), -1, 1);
    const yawRate = -st.w.y;
    let aY = spec.yawAuth * eff * ctl.yaw + spec.yawStab * eff * st.beta - spec.yawDamp * yawRate * (0.4 + 0.6 * Math.min(eff, 1));
    if (spec.thrustKind === 'prop') aY -= 0.12 * st.thrustOut * (1 - clamp(V / 45, 0, 1));
    if (st.onGround) {
      const vg = Math.hypot(st.vel.x, st.vel.z);
      aY += 2.2 * st.beta * Math.min(1, vg / 8) + steerIn * 0.9 * Math.min(1, vg / 6) / (1 + vg / 40);
    }
    aY += (turb > 0 ? _gust.z * 0.025 * turb : 0);
    st.w.y += -aY * dt;
    if (turb > 0) st.w.x += _gust.y * 0.03 * turb * dt * 4;
    st.steer = steerIn;
    groundBlend = st.onGround ? 1 : 0;
  } else {
    // ------------------ helicopter ------------------
    st.alpha = 0;
    st.beta = 0;
    st.stallAmt = 0;
    const gnd = Math.max(terrainHeight(st.pos.x, st.pos.z), 0);
    const agl = st.pos.y + spec.wheels[0].y - gnd; // height of skids above ground
    const ge = 1 + 0.18 * Math.exp(-Math.max(agl, 0) / 5);
    const tilt = _up.y;
    const vFwd = -_vb.z;
    const vRight = _vb.x;
    const vz = st.vel.y;

    let collective = st.throttle;
    if (env.assist) {
      const ch = (m * G) / (spec.thrust * Math.pow(rr, 0.85) * ge * dmgFactor);
      const vzT = ctl.throttleAxis * 6 - (agl < 3 && ctl.throttleAxis === 0 && st.onGround ? 2 : 0);
      collective = clamp(ch / Math.max(tilt, 0.55) + 0.1 * (vzT - vz), 0, 1);
      if (st.onGround && ctl.throttleAxis <= 0) collective = Math.min(collective, ch * 0.7);
      st.throttle = collective;
    }
    const thr = spec.thrust * collective * Math.pow(rr, 0.85) * ge * dmgFactor * st.rpm * st.rpm * (st.fuel > 0 ? 1 : 0);
    st.thrustOut = collective;
    _tmp.copy(_up).multiplyScalar(thr);
    _F.add(_tmp);

    // body drag
    const k = 0.5 * rho;
    _tmp.set(-k * 4.6 * Math.abs(_vb.x) * _vb.x, -k * 10 * Math.abs(_vb.y) * _vb.y, -k * 1.8 * Math.abs(_vb.z) * _vb.z).applyQuaternion(st.quat);
    _F.add(_tmp);
    _F.addScaledVector(_gust, 0); // gust applied via _rel

    // attitude control
    const pitch = Math.asin(clamp(_fwd.y, -1, 1));
    const roll = Math.asin(clamp(-_right.y, -1, 1));
    let thT = ctl.pitch * spec.heliTilt;
    let phT = ctl.roll * spec.heliTilt;
    if (env.assist) {
      const free = 1 - Math.min(1, Math.abs(ctl.pitch) * 1.5);
      const freeR = 1 - Math.min(1, Math.abs(ctl.roll) * 1.5);
      thT += clamp(vFwd * 0.04, -0.35, 0.35) * free;
      phT -= clamp(vRight * 0.04, -0.35, 0.35) * freeR;
    }
    const gscale = st.onGround ? 0.12 : 1;
    thT *= gscale;
    phT *= gscale;
    const sc = st.rpm * ctlQ;
    st.w.x += (9 * (thT - pitch) - 4.5 * st.w.x) * dt * sc;
    st.w.z += -(9 * (phT - roll) + 4.5 * st.w.z) * dt * sc;
    // yaw
    const yawRate = -st.w.y;
    const aY = 4 * (ctl.yaw * spec.yawAuth * sc - yawRate) - (collective - 0.5) * 0.15;
    st.w.y += -aY * dt;
    if (turb > 0) {
      st.w.x += _gust.y * 0.05 * turb * dt * 3;
      st.w.z += _gust.x * 0.05 * turb * dt * 3;
    }
    st.steer = 0;
    st.propAngle = 0;
  }

  /* ---------------- ground contact ---------------- */
  const wheelsActive = st.gear > 0.9;
  let anyContact = false;
  let wheelContact = false;
  const Nw = Math.max(1, spec.wheels.length);
  const mi = m / Nw;
  const kS = mi * (isHeli ? 70 : 45);
  const cS = 1.15 * 2 * Math.sqrt(kS * mi) * 0.6;
  _wW.copy(st.w).applyQuaternion(st.quat);
  let sinkSpeedMax = 0;
  let gearDownTD = true;

  const addForceAt = (r: THREE.Vector3, f: THREE.Vector3) => {
    _F.add(f);
    _tmp2.crossVectors(r, f);
    _T.add(_tmp2);
  };

  for (let i = 0; i < spec.wheels.length; i++) {
    const wd = spec.wheels[i];
    if (!wheelsActive && !isHeli) { st.wheelComp[i] = 0; continue; }
    _r.set(wd.x, wd.y, wd.z).applyQuaternion(st.quat);
    const px = st.pos.x + _r.x;
    const py = st.pos.y + _r.y;
    const pz = st.pos.z + _r.z;
    const th = terrainHeight(px, pz);
    const ground = Math.max(th, 0);
    const comp = ground - py;
    if (comp > 0) {
      const water = th <= 0.05;
      _vp.crossVectors(_wW, _r).add(st.vel);
      const first = st.wheelComp[i] <= 0;
      if (water) {
        if (!isHeli || -_vp.y > 4 || st.vel.length() > 25) crash(st, 'Ditched in the sea');
        else st.integrity -= 14 * dt;
        st.onWater = true;
      }
      const surf = surfaceAt(px, pz, th);
      st.surface = surf;
      const sc = surfaceCoef(surf);
      let Fn = kS * comp - cS * _vp.y;
      if (Fn < 0) Fn = 0;
      if (first && -_vp.y > 0.5) {
        const sink = -_vp.y;
        sinkSpeedMax = Math.max(sinkSpeedMax, sink);
        if (!st.onGround || st.airTime > 0.6) gearDownTD = true;
      }
      // normal force
      _tmp.set(0, Fn, 0);
      addForceAt(_r, _tmp);
      // horizontal friction
      const vhx = _vp.x;
      const vhz = _vp.z;
      if (wd.kind === 'skid') {
        const sp = Math.hypot(vhx, vhz);
        const mu = (ctl.brake ? 1.0 : 0.55) * sc.lat;
        const c = mi * 15;
        const fmax = mu * Fn;
        const fm = Math.min(sp * c, fmax);
        if (sp > 1e-4) { _tmp.set((-vhx / sp) * fm, 0, (-vhz / sp) * fm); addForceAt(_r, _tmp); }
      } else {
        _dir.set(_fwd.x, 0, _fwd.z);
        if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, -1);
        _dir.normalize();
        if (wd.kind === 'nose') {
          const steerAng = -st.steer * 0.62 / (1 + Math.hypot(st.vel.x, st.vel.z) / 14);
          const c = Math.cos(steerAng);
          const s = Math.sin(steerAng);
          const dx = _dir.x * c + _dir.z * s;
          const dz = -_dir.x * s + _dir.z * c;
          _dir.x = dx;
          _dir.z = dz;
        }
        _lat.set(-_dir.z, 0, _dir.x);
        const vLong = vhx * _dir.x + vhz * _dir.z;
        const vLat = vhx * _lat.x + vhz * _lat.z;
        const cL = mi * 18;
        const fLat = -clamp(vLat * cL, -sc.lat * Fn, sc.lat * Fn);
        const braking = ctl.brake && wd.kind === 'main';
        const lim = (braking ? spec.brake * sc.brake : sc.crr) * Fn;
        const fLong = -clamp(vLong * cL, -lim, lim);
        _tmp.set(_dir.x * fLong + _lat.x * fLat, 0, _dir.z * fLong + _lat.z * fLat);
        addForceAt(_r, _tmp);
      }
      wheelContact = true;
      anyContact = true;
      st.wheelComp[i] = comp;
    } else st.wheelComp[i] = 0;
  }

  // hard points (belly, wingtips, nose, tail)
  let scrape = 0;
  for (let i = 0; i < spec.hard.length; i++) {
    const hp = spec.hard[i];
    _r.set(hp.x, hp.y, hp.z).applyQuaternion(st.quat);
    const px = st.pos.x + _r.x;
    const py = st.pos.y + _r.y;
    const pz = st.pos.z + _r.z;
    const th = terrainHeight(px, pz);
    const ground = Math.max(th, 0);
    const comp = ground - py;
    if (comp > 0) {
      _vp.crossVectors(_wW, _r).add(st.vel);
      const water = th <= 0.05;
      if (water) {
        if (!(isHeli && st.vel.length() < 8)) crash(st, 'Crashed into the sea');
        else st.integrity -= 25 * dt;
        st.onWater = true;
      }
      const impact = -_vp.y;
      if (comp > 3 || impact > spec.crashSink * 0.9) {
        crash(st, th > 0.05 && Math.hypot(_vp.x, _vp.z) > 30 ? 'Crashed into terrain' : 'Structural impact');
      }
      const k2 = kS * 0.6;
      let Fn = k2 * comp - cS * 0.6 * _vp.y;
      if (Fn < 0) Fn = 0;
      _tmp.set(0, Fn, 0);
      addForceAt(_r, _tmp);
      const sp = Math.hypot(_vp.x, _vp.z);
      if (sp > 1e-3) {
        const fm = Math.min(sp * mi * 10, 0.7 * Fn);
        _tmp.set((-_vp.x / sp) * fm, 0, (-_vp.z / sp) * fm);
        addForceAt(_r, _tmp);
      }
      scrape = Math.max(scrape, sp);
      anyContact = true;
    }
  }
  st.scrape = scrape;
  if (scrape > 4 && !isHeli) {
    st.integrity -= 0.03 * scrape * dt * 3;
  }
  if (isHeli && anyContact && _up.y < 0.45) crash(st, 'Rolled over on landing');

  // touchdown evaluation
  if (wheelContact && st.airTime > 0.8 && sinkSpeedMax > 0) {
    const hv = Math.hypot(st.vel.x, st.vel.z);
    st.lastTouchdown = {
      sink: sinkSpeedMax, speed: hv, x: st.pos.x, z: st.pos.z, t: st.time, gearDown: gearDownTD,
      heading: Math.atan2(_fwd.x, -_fwd.z),
    };
    st.newTouchdown = true;
    res.touchdown = true;
    if (sinkSpeedMax > spec.crashSink) crash(st, 'Hard landing – structural failure');
    else if (sinkSpeedMax > spec.maxSink) {
      const dmg = (sinkSpeedMax - spec.maxSink) * 9;
      st.integrity -= dmg;
      res.damage += dmg;
      res.hardLanding = true;
    }
    if (hv > 0 && Math.abs(Math.atan2(_fwd.x, -_fwd.z) - Math.atan2(st.vel.x, -st.vel.z)) > 0.5 && hv > 25 && !isHeli) {
      st.integrity -= 8;
    }
  }
  if (anyContact) { st.airTime = 0; st.groundTime += dt; } else { st.airTime += dt; st.groundTime = 0; }
  st.onGround = anyContact;
  if (!anyContact) { st.surface = 'grass'; st.onWater = false; }

  /* ---------------- obstacles (buildings) ---------------- */
  const rad = Math.max(2.5, spec.length * 0.16);
  if (hitsObstacle(st.pos.x, st.pos.y, st.pos.z, rad) ||
    (!isHeli && (hitsObstacle(st.pos.x + _right.x * spec.span * 0.48, st.pos.y + _right.y * spec.span * 0.48, st.pos.z + _right.z * spec.span * 0.48, 1.5) ||
      hitsObstacle(st.pos.x - _right.x * spec.span * 0.48, st.pos.y - _right.y * spec.span * 0.48, st.pos.z - _right.z * spec.span * 0.48, 1.5)))) {
    crash(st, 'Collided with a building');
  }

  /* ---------------- damage ---------------- */
  st.gLoad += (((_F.dot(_up) + m * G * _up.y) / (m * G)) - st.gLoad) * Math.min(1, dt * 8);
  if (!st.onGround) {
    if (st.gLoad > spec.gMax * 1.1) st.integrity -= (st.gLoad - spec.gMax * 1.1) * 6 * dt;
    if (st.gLoad < -spec.gMax * 0.5) st.integrity -= (-spec.gMax * 0.5 - st.gLoad) * 6 * dt;
  }
  if (!isHeli && st.ias > spec.vne * 1.02) st.integrity -= (st.ias / spec.vne - 1) * 40 * dt + 0.2 * dt;
  if (isHeli && st.ias > spec.vne * 1.05) st.integrity -= (st.ias / spec.vne - 1) * 30 * dt;
  if (!isHeli && st.gear > 0.1 && st.gear < 0.95 && st.ias > spec.vApp * 2.6) st.integrity -= 3 * dt;
  if (st.integrity <= 0) { st.integrity = 0; crash(st, 'Aircraft broke apart'); }
  st.integrity = clamp(st.integrity, 0, 100);

  // warnings
  const w = st.warnings;
  w.clear();
  if (!isHeli && st.stallAmt > 0.5) w.add('STALL');
  if (!isHeli && !st.onGround && st.agl < 250 && st.agl > 2 && !st.gearCmd && st.vel.y < -2 && st.ias < spec.vApp * 1.6 && !spec.fixedGear) w.add('GEAR');
  if (st.agl < 150 && st.vel.y < -Math.max(7, st.agl * 0.12) && !st.onGround) w.add('PULL UP');
  if (st.fuel < spec.fuelCap * 0.1 && st.fuel > 0) w.add('LOW FUEL');
  if (st.fuel <= 0) w.add('FUEL EMPTY');
  if (st.integrity < 40) w.add('DAMAGE');
  if (!isHeli && st.ias > spec.vne * 0.95) w.add('OVERSPEED');
  if (st.gLoad > spec.gMax * 0.95) w.add('OVER-G');

  /* ---------------- integrate ---------------- */
  if (env.frozen) {
    st.vel.set(0, 0, 0);
    st.w.set(0, 0, 0);
    return res;
  }
  // torque -> angular acceleration (body frame)
  if (_T.lengthSq() > 0) {
    _tmp.copy(_T).applyQuaternion(_qInv);
    st.w.x += (_tmp.x / Ix) * dt;
    st.w.y += (_tmp.y / Iy) * dt;
    st.w.z += (_tmp.z / Iz) * dt;
  }
  st.vel.addScaledVector(_F, dt / m);
  st.pos.addScaledVector(st.vel, dt);
  // sanity damp ground rotation
  if (st.onGround) {
    st.w.multiplyScalar(1 - Math.min(0.5, dt * 1.2));
  }
  st.w.x = clamp(st.w.x, -6, 6);
  st.w.y = clamp(st.w.y, -6, 6);
  st.w.z = clamp(st.w.z, -8, 8);
  const ang = st.w.length() * dt;
  if (ang > 1e-9) {
    _tmp.copy(st.w).normalize();
    _dq.setFromAxisAngle(_tmp, ang);
    st.quat.multiply(_dq).normalize();
  }
  // AGL & animation
  st.agl = st.pos.y - Math.max(terrainHeight(st.pos.x, st.pos.z), 0) - (spec.wheels[0] ? -Math.min(...spec.wheels.map((q) => q.y)) : 0);
  if (isHeli) st.rotorAngle += dt * 38 * st.rpm;
  else if (spec.thrustKind === 'prop') st.propAngle += dt * (25 + st.thrustOut * 190);
  if (st.pos.y < -50) crash(st, 'Lost at sea');
  return res;
}

export function headingOf(q: THREE.Quaternion): number {
  _fwd.set(0, 0, -1).applyQuaternion(q);
  let h = Math.atan2(_fwd.x, -_fwd.z);
  if (h < 0) h += Math.PI * 2;
  return h;
}
export function pitchOf(q: THREE.Quaternion): number {
  _fwd.set(0, 0, -1).applyQuaternion(q);
  return Math.asin(clamp(_fwd.y, -1, 1));
}
export function bankOf(q: THREE.Quaternion): number {
  _right.set(1, 0, 0).applyQuaternion(q);
  _up.set(0, 1, 0).applyQuaternion(q);
  return Math.atan2(-_right.y, _up.y);
}
