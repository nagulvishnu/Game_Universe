import * as THREE from "three";
import { CarDef, Custom, Derived, derive } from "./data";
import { CarModel, buildCar } from "./carBuilder";
import { Track, Proj, newProj } from "./track";
import { clamp, damp, wrapAngle } from "./util";

export interface PlayerInput {
  throttle: number;
  brake: number;
  steer: number; // + = left
  nitro: boolean;
  drift: boolean;
  item: boolean;
  reset: boolean;
  cam: boolean;
}
export const emptyInput = (): PlayerInput => ({ throttle: 0, brake: 0, steer: 0, nitro: false, drift: false, item: false, reset: false, cam: false });

export interface Env {
  wet: number;
  dark: boolean;
  shoulderGrip: number;
  shoulderTop: number;
}
export interface Hooks {
  onWall(c: Car, strength: number, x: number, y: number, z: number): void;
  onLand(c: Car, impact: number): void;
  onNitro(c: Car): void;
  onShift(c: Car): void;
  onDriftBank(c: Car, score: number, boost: number): void;
  onCarHit(a: Car, b: Car, strength: number, x: number, y: number, z: number): void;
}

const G = 30;

export class Car {
  idx: number;
  def: CarDef;
  cfg: Custom;
  up: number[];
  d: Derived;
  model: CarModel;
  input: PlayerInput = emptyInput();
  // physics
  x = 0; y = 0; z = 0; yaw = 0; yawRate = 0; vx = 0; vz = 0; vy = 0;
  grounded = true; airT = 0;
  steerS = 0; gm = 1; drifting = false; slip = 0;
  vF = 0; vL = 0; speed = 0; aF = 0;
  pitch = 0; roll = 0; comp = 0; compV = 0;
  proj: Proj = newProj();
  hint = -1;
  onShoulder = false;
  // nitro
  nitro = 50; nitroOn = false; nitroLock = false; boostT = 0; itemBoostT = 0; nitroUsed = 0;
  // effects
  shield = 0; stun = 0; snare = 0; spin = 0; spinDir = 1; flare = 0; invuln = 0; slipstream = 0;
  item: string | null = null; itemCd = 0;
  // drift scoring
  driftT = 0; driftCur = 0; driftGrace = 0; driftTotal = 0; driftBest = 0;
  // gears
  gear = 0; rpm = 0.2; shiftT = 0; popT = 0;
  // race
  progress = 0; best = 0; lap = 0; cp = 0; finished = false; finishTime = 0;
  lapStart = 0; lapTimes: number[] = []; bestLap = Infinity;
  rank = 1; maxSpeed = 0; overtakes = 0; damage = 0; wrongWay = 0; stuckT = 0;
  camMode = 0; shake = 0;
  wheelSpin = 0; spinAngle = 0;
  braking = false;
  lastDamageApplied = 0;
  skidL = 0; skidR = 0;
  name = "";

  constructor(idx: number, def: CarDef, cfg: Custom, up: number[], ghost?: string) {
    this.idx = idx;
    this.def = def;
    this.cfg = cfg;
    this.up = up;
    this.d = derive(def, up);
    this.model = buildCar(def, cfg, ghost ? { ghost } : {});
    this.nitro = this.d.nitroCap * 0.35;
  }

  get fx() { return Math.sin(this.yaw); }
  get fz() { return Math.cos(this.yaw); }
  get kmh() { return Math.abs(this.vF) * 3.6; }

  place(track: Track, i: number, d: number) {
    const p = track.at(i, d);
    this.x = p.x; this.z = p.z; this.y = p.y;
    this.yaw = track.heading(i);
    this.vx = this.vz = this.vy = 0;
    this.yawRate = 0;
    this.hint = Math.floor(i);
    this.grounded = true;
    track.project(this.x, this.z, this.hint, this.proj);
    this.y = this.proj.y;
  }

  respawn(track: Track) {
    track.project(this.x, this.z, this.hint, this.proj, 40);
    const i = this.proj.i;
    this.place(track, i, 0);
    this.y += 0.4;
    this.grounded = false;
    this.invuln = 2.2;
    this.stun = 0; this.spin = 0; this.snare = 0;
    this.drifting = false;
    this.driftCur = 0;
    this.steerS = 0;
    this.slip = 0;
  }

  addDamage(v: number) {
    this.damage = clamp(this.damage + v, 0, 1);
  }

  step(dt: number, track: Track, env: Env, canDrive: boolean, hooks: Hooks, opp: Car | null, time: number) {
    const inp = this.input;
    const d = this.d;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const lx = Math.cos(this.yaw), lz = -Math.sin(this.yaw);
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * lx + this.vz * lz;
    const speed = Math.hypot(this.vx, this.vz);
    this.invuln = Math.max(0, this.invuln - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.snare = Math.max(0, this.snare - dt);
    this.spin = Math.max(0, this.spin - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.flare = Math.max(0, this.flare - dt);
    this.itemCd = Math.max(0, this.itemCd - dt);
    this.boostT = Math.max(0, this.boostT - dt);
    this.itemBoostT = Math.max(0, this.itemBoostT - dt);
    this.shiftT = Math.max(0, this.shiftT - dt);
    this.popT = Math.max(0, this.popT - dt);

    let thr = canDrive ? inp.throttle : 0;
    let brk = canDrive ? inp.brake : 0;
    const steerIn = canDrive ? inp.steer : 0;
    if (this.stun > 0) { thr = 0; }
    if (this.spin > 0) thr *= 0.4;

    // steering smoothing
    const up = 5.5 / (1 + speed / 70), down = 9;
    const tgt = steerIn;
    const rate = Math.abs(tgt) > Math.abs(this.steerS) && Math.sign(tgt) === Math.sign(this.steerS || tgt) ? up : down;
    this.steerS += clamp(tgt - this.steerS, -rate * dt, rate * dt);

    // surface & ground
    track.project(this.x, this.z, this.hint, this.proj);
    this.hint = Math.floor(this.proj.i);
    this.onShoulder = Math.abs(this.proj.d) > track.halfW + 0.2;
    const surf = this.onShoulder ? env.shoulderGrip : 1;
    const wetG = 1 - 0.24 * env.wet * (1 - this.up[2] * 0.04);

    // drift state
    const wantDrift = canDrive && inp.drift && speed > 12 && this.grounded && this.stun <= 0;
    if (wantDrift && !this.drifting) {
      this.yawRate += this.steerS * 0.7;
    }
    this.drifting = wantDrift;
    const gmTarget = this.spin > 0 ? 0.18 : this.drifting ? d.driftMul : 1;
    this.gm = damp(this.gm, gmTarget, this.drifting || this.spin > 0 ? 14 : 2.6, dt);

    // nitro
    const wantNitro = canDrive && inp.nitro && this.nitro > 1 && !this.nitroLock && this.stun <= 0;
    if (wantNitro) {
      if (!this.nitroOn) hooks.onNitro(this);
      this.nitroOn = true;
      this.nitro -= 24 * dt;
      this.nitroUsed += dt;
      if (this.nitro <= 0) { this.nitro = 0; this.nitroOn = false; this.nitroLock = true; }
    } else {
      this.nitroOn = false;
    }
    if (!inp.nitro && this.nitroLock && this.nitro > 12) this.nitroLock = false;
    if (!this.nitroOn) {
      const rg = d.nitroRegen + (this.drifting && this.slip !== 0 ? 6 : 0) + this.slipstream * 5;
      this.nitro = Math.min(d.nitroCap, this.nitro + rg * dt);
    }

    // speed caps and accel
    const dmgK = 1 - this.damage * 0.06;
    const top = d.topSpeed * dmgK * (this.nitroOn ? 1.28 : 1) * (this.boostT > 0 ? 1.1 : 1) * (this.itemBoostT > 0 ? 1.22 : 1) * (this.onShoulder ? env.shoulderTop : 1) * (this.snare > 0 ? 0.62 : 1);
    let accelNow = d.accel * dmgK * (this.nitroOn ? d.nitroPower * 1.3 : 1) * (this.boostT > 0 ? 1.45 : 1) * (this.itemBoostT > 0 ? 1.8 : 1) * (this.snare > 0 ? 0.7 : 1) * (1 + this.slipstream * 0.12);
    if (this.nitroOn && thr < 0.3) thr = 1; // nitro always pushes forward
    let a = 0;
    if (brk > 0.01 && vF > 1.5) {
      a = -d.brake * brk * (1 - 0.2 * env.wet) * (this.onShoulder ? 0.8 : 1);
    } else if (brk > 0.01 && thr < 0.05) {
      if (vF > -top * 0.28) a = -accelNow * 0.55 * brk;
      else a = 0;
    } else if (thr > 0.01) {
      if (vF > -1) {
        const f = clamp(1 - Math.max(0, vF) / top, 0, 1);
        a = accelNow * thr * Math.pow(f, 0.55);
      } else a = d.brake * 0.8;
    } else {
      a = -Math.sign(vF) * Math.min(Math.abs(vF) / dt, 1.2 + (this.onShoulder ? 5 : 0));
    }
    // drag
    a -= Math.sign(vF) * (0.0011 * vF * vF + 0.35);
    if (vF > top) a -= (vF - top) * 1.1;
    if (!this.grounded) a *= 0.2;
    this.aF = a;
    vF += a * dt;

    // lateral grip (tire force saturation)
    if (this.grounded) {
      const dfK = 1 + d.downforce * (speed / 70);
      let gripRate = d.grip * this.gm * surf * wetG;
      let maxLat = d.latLimit * (this.drifting ? 0.42 + 0.9 * this.gm : this.gm) * surf * wetG * dfK;
      if (this.spin > 0) { gripRate *= 0.5; maxLat *= 0.6; }
      const want = vL * gripRate;
      const f = clamp(want, -maxLat, maxLat) * dt;
      const delta = Math.abs(f) > Math.abs(vL) ? vL : f;
      const nvL = vL - delta;
      // tire force redirects velocity: keep (most of) the kinetic energy instead of creating or destroying it
      const gain = (vL * vL - nvL * nvL) * (this.drifting ? 0.5 : 0.85);
      vF = Math.sign(vF || 1) * Math.sqrt(vF * vF + Math.max(0, gain));
      vL = nvL;
    }
    this.slip = Math.atan2(vL * (vF < 0 ? -1 : 1), Math.max(Math.abs(vF), 1));

    // yaw control
    const steerDir = vF >= -0.5 ? 1 : -1;
    let yawTarget = 0;
    if (!this.drifting) {
      const sp = Math.max(Math.abs(vF), 3);
      const wmax = Math.min(d.steerLow, (d.latLimit * 0.88 * surf * wetG * (1 + d.downforce * speed / 70)) / sp);
      const low = clamp(Math.abs(vF) / 5, 0, 1);
      yawTarget = this.steerS * wmax * low * steerDir * (this.grounded ? 1 : 0.2);
    } else {
      const slipT = -this.steerS * d.driftSlip;
      yawTarget = clamp(3.2 * (this.slip - slipT), -1.6, 1.6);
    }
    if (this.spin > 0) yawTarget += this.spinDir * 9;
    this.yawRate += (yawTarget - this.yawRate) * Math.min(1, (this.drifting ? 9 : d.response) * dt);
    this.yaw += this.yawRate * dt;
    // cornering / slip drag
    vF -= Math.sign(vF) * Math.abs(this.yawRate) * Math.abs(vF) * (this.drifting ? 0.05 : 0.035) * dt;

    // recompose world velocity using the pre-rotation frame (velocity must not rotate with the heading)
    this.vx = fx * vF + lx * vL;
    this.vz = fz * vF + lz * vL;

    // integrate
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // ---- walls
    track.project(this.x, this.z, this.hint, this.proj);
    {
      const p = this.proj;
      const dYaw = wrapAngle(this.yaw - Math.atan2(p.tx, p.tz));
      const hl = this.model.dims.L / 2 - 0.2, hw = this.model.dims.W / 2;
      const ext = hl * Math.abs(Math.sin(dYaw)) + hw * Math.abs(Math.cos(dYaw));
      const over = Math.abs(p.d) + ext - track.wallHalf;
      if (over > 0) {
        const s = p.d > 0 ? -1 : 1; // inward normal sign
        const nx = p.nx * s, nz = p.nz * s;
        this.x += nx * over;
        this.z += nz * over;
        const vn = this.vx * nx + this.vz * nz;
        if (vn < 0) {
          const e = 0.22;
          this.vx -= (1 + e) * vn * nx;
          this.vz -= (1 + e) * vn * nz;
          const loss = clamp(0.03 + Math.abs(vn) * 0.011, 0, 0.35);
          this.vx *= 1 - loss;
          this.vz *= 1 - loss;
          const dir = this.vx * p.tx + this.vz * p.tz >= 0 ? 0 : Math.PI;
          const target = Math.atan2(p.tx, p.tz) + dir;
          this.yaw += wrapAngle(target - this.yaw) * clamp(Math.abs(vn) * 0.04, 0, 0.45);
          if (Math.abs(vn) > 2.5) {
            this.shake = Math.max(this.shake, clamp(Math.abs(vn) / 18, 0.15, 1));
            this.addDamage(Math.abs(vn) * 0.0035);
            this.compV -= Math.abs(vn) * 0.4;
            this.driftCur *= 0.3;
          }
          hooks.onWall(this, Math.abs(vn), this.x - nx * ext, this.y + 0.5, this.z - nz * ext);
        }
        const scrape = 0.5 * dt;
        this.vx *= 1 - scrape;
        this.vz *= 1 - scrape;
        this.yaw += wrapAngle(Math.atan2(p.tx, p.tz) + (this.vx * p.tx + this.vz * p.tz >= 0 ? 0 : Math.PI) - this.yaw) * 2.5 * dt;
        this.yawRate *= 0.9;
      }
    }

    // ---- vertical
    track.project(this.x, this.z, this.hint, this.proj);
    const gy = this.proj.y;
    if (this.grounded) {
      const nvy = (gy - this.y) / dt;
      const ag = vF * vF * this.proj.kappa; // ground's vertical acceleration along our path
      if (speed > 24 && ag < -G * 1.1) {
        this.grounded = false;
        this.airT = 0;
        this.vy = clamp(vF * this.proj.slope, -30, 30);
        this.y += this.vy * dt;
      } else {
        this.y = gy;
        this.vy = damp(this.vy, nvy, 40, dt);
      }
    } else {
      this.vy -= G * dt;
      this.y += this.vy * dt;
      this.airT += dt;
      if (this.y <= gy) {
        const impact = -(this.vy - 0);
        this.y = gy;
        if (this.airT > 0.12) {
          hooks.onLand(this, impact);
          this.compV -= impact * 0.9;
          if (impact > 6) this.shake = Math.max(this.shake, clamp(impact / 25, 0.2, 0.9));
          if (impact > 14) this.addDamage((impact - 14) * 0.004);
        }
        this.grounded = true;
        this.vy = 0;
      }
    }

    // ---- progress / checkpoints
    {
      const N = track.N;
      let i = this.proj.i;
      const prevI = ((this.progress % N) + N) % N;
      let delta = i - prevI;
      if (delta > N / 2) delta -= N;
      if (delta < -N / 2) delta += N;
      if (Math.abs(delta) < 40) {
        this.progress += delta;
        if (this.progress > this.best) this.best = this.progress;
      }
      i = 0;
    }

    // ---- stats
    this.vF = vF;
    this.vL = vL;
    this.speed = speed;
    this.maxSpeed = Math.max(this.maxSpeed, Math.abs(vF) * 3.6);

    // drift scoring
    const sa = Math.abs(this.slip);
    if (this.grounded && speed > 16 && vF > 5 && sa > 0.2 && this.stun <= 0) {
      this.driftT += dt;
      this.driftGrace = 0;
      this.driftCur += speed * sa * dt * 3.2 * (1 + Math.min(this.driftT, 6) * 0.25);
    } else if (this.driftCur > 0 || this.driftT > 0) {
      this.driftGrace += dt;
      if (this.driftGrace > 0.7) {
        if (this.driftT > 0.6 && this.driftCur > 20) {
          const sc = Math.round(this.driftCur);
          this.driftTotal += sc;
          this.driftBest = Math.max(this.driftBest, sc);
          let boost = 0;
          if (this.driftT > 1.0) {
            boost = Math.min(2.2, this.driftT * 0.5);
            this.boostT = Math.max(this.boostT, boost);
          }
          this.nitro = Math.min(d.nitroCap, this.nitro + Math.min(30, sc / 35));
          hooks.onDriftBank(this, sc, boost);
        }
        this.driftT = 0;
        this.driftCur = 0;
        this.driftGrace = 0;
      }
    }

    // gears
    const band = (d.topSpeed * 1.08) / 6;
    const spAbs = Math.abs(vF);
    let g = vF < -1 ? -1 : spAbs < 0.8 && thr < 0.05 ? 0 : Math.min(6, Math.floor(spAbs / band) + 1);
    if (g !== this.gear) {
      if (g > this.gear && this.gear > 0) {
        this.shiftT = 0.16;
        if (thr > 0.5) { this.popT = 0.12; hooks.onShift(this); }
      }
      this.gear = g;
    }
    let rpmT: number;
    if (g <= 0) rpmT = 0.18 + thr * 0.55 + (g < 0 ? 0.1 : 0);
    else {
      const inGear = clamp((spAbs - (g - 1) * band) / band, 0, 1.1);
      rpmT = 0.3 + inGear * 0.62 + thr * 0.06;
      if (g === 1) rpmT = 0.22 + clamp(spAbs / band, 0, 1) * 0.7 + thr * 0.08;
    }
    if (this.shiftT > 0) rpmT -= 0.18;
    if (this.nitroOn) rpmT += 0.05;
    this.rpm = damp(this.rpm, clamp(rpmT, 0.14, 1.05), 14, dt);

    // brake flag
    this.braking = brk > 0.1 && (vF > 1 || thr < 0.05);

    // stuck detection
    if (canDrive && spAbs < 2 && thr > 0.5) this.stuckT += dt;
    else this.stuckT = 0;

    // visual dynamics
    const latAcc = vF * this.yawRate;
    let pT = this.grounded ? -Math.atan(this.proj.slope) : -Math.atan2(this.vy, Math.max(speed, 6)) * 0.9;
    pT += clamp(-a * 0.0035, -0.07, 0.07) * -1 * -1;
    this.pitch = damp(this.pitch, pT - a * 0.002, 9, dt);
    this.roll = damp(this.roll, clamp(latAcc * 0.0034, -0.2, 0.2) + (this.drifting ? clamp(-this.slip * 0.1, -0.1, 0.1) : 0), 8, dt);
    this.compV += (-140 * this.comp - 15 * this.compV) * dt;
    this.comp += this.compV * dt;
    this.comp = clamp(this.comp, -0.6, 0.5);
    this.shake = Math.max(0, this.shake - dt * 2.2);

    // slipstream (draft behind opponent)
    this.slipstream = 0;
    if (opp && !opp.finished && speed > 30) {
      const ox = opp.x - this.x, oz = opp.z - this.z;
      const ahead = ox * fx + oz * fz;
      const side = Math.abs(ox * lx + oz * lz);
      if (ahead > 3 && ahead < 32 && side < 3.2 && opp.speed > 25) this.slipstream = 1 - ahead / 32;
    }
    void time;
  }

  /** visuals */
  updateVisual(dt: number, time: number, env: Env, tuned = true) {
    const m = this.model;
    const g = m.group;
    g.position.set(this.x, this.y - this.comp * 0.0, this.z);
    g.rotation.order = "YXZ";
    g.rotation.y = this.yaw;
    g.rotation.x = this.pitch;
    g.rotation.z = this.roll;
    m.body.position.y = this.comp * 0.12;
    const steerAng = clamp(this.steerS * 0.42 + (this.drifting || Math.abs(this.slip) > 0.25 ? -this.slip * 0.8 : 0), -0.6, 0.6);
    this.spinAngle += (this.vF / 0.34) * dt;
    for (const w of m.wheels) {
      w.spin.rotation.x = this.spinAngle;
      if (w.front) w.steer.rotation.y = steerAng;
      const droop = this.grounded ? 0 : -0.08;
      const bump = Math.sin(time * 40 + w.x * 7 + w.z) * Math.min(this.speed, 70) * 0.0003;
      w.root.position.y = w.baseY + droop + this.comp * 0.06 * (w.front ? 1 : 0.7) + (this.grounded ? bump : 0);
    }
    // brake lights
    const b = this.braking ? 1 : 0;
    m.tailMat.emissiveIntensity = 1.0 + b * 4.5;
    m.tailGlow.forEach((s) => ((s.material as THREE.SpriteMaterial).opacity = 0.25 + b * 0.75));
    // flames
    const fl = this.nitroOn ? 1 : this.boostT > 0 ? 0.45 : this.popT > 0 ? 0.35 : 0;
    m.flames.forEach((f, i) => {
      f.visible = fl > 0;
      if (fl > 0) {
        const fk = fl * (0.8 + Math.random() * 0.45) * (this.nitroOn ? 1 + this.d.nitroPower * 0.12 : 1);
        f.scale.set(1 + Math.random() * 0.2, 1 + Math.random() * 0.2, fk);
        f.rotation.z = (i - 1) * 0.02;
      }
    });
    m.beams.visible = env.dark && tuned;
    const inv = this.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    g.visible = !inv;
    if (Math.abs(this.damage - this.lastDamageApplied) > 0.04) {
      this.lastDamageApplied = this.damage;
      m.setDamage(this.damage);
    }
  }

  /** world position of exhaust i */
  exhaustWorld(i: number, out: THREE.Vector3) {
    const l = this.model.exhaustLocal[i % this.model.exhaustLocal.length];
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    out.set(this.x + l.x * c + l.z * s, this.y + l.y, this.z - l.x * s + l.z * c);
    return out;
  }
  wheelWorld(i: number, out: THREE.Vector3) {
    const w = this.model.wheels[i];
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    out.set(this.x + w.x * c + w.z * s, this.y + 0.05, this.z - w.x * s + w.z * c);
    return out;
  }
}

/** Car-vs-car collision using 3 circles per car. Returns impact strength. */
export function collideCars(a: Car, b: Car, hooks: Hooks): number {
  const offs = [-0.3, 0, 0.3];
  const ra = a.model.dims.W * 0.5 + 0.12, rb = b.model.dims.W * 0.5 + 0.12;
  const ma = a.d.mass, mb = b.d.mass;
  let maxImpact = 0;
  if (Math.abs(a.y - b.y) > 2.5) return 0;
  if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 > 36) return 0;
  for (const oa of offs) {
    for (const ob of offs) {
      const ax = a.x + Math.sin(a.yaw) * oa * a.model.dims.L, az = a.z + Math.cos(a.yaw) * oa * a.model.dims.L;
      const bx = b.x + Math.sin(b.yaw) * ob * b.model.dims.L, bz = b.z + Math.cos(b.yaw) * ob * b.model.dims.L;
      let dx = bx - ax, dz = bz - az;
      const dist = Math.hypot(dx, dz) || 0.001;
      const pen = ra + rb - dist;
      if (pen <= 0) continue;
      dx /= dist; dz /= dist;
      const tm = ma + mb;
      a.x -= dx * pen * (mb / tm) * 0.8; a.z -= dz * pen * (mb / tm) * 0.8;
      b.x += dx * pen * (ma / tm) * 0.8; b.z += dz * pen * (ma / tm) * 0.8;
      const rv = (b.vx - a.vx) * dx + (b.vz - a.vz) * dz;
      if (rv < 0) {
        const j = (-(1 + 0.35) * rv) / (1 / ma + 1 / mb);
        a.vx -= (j / ma) * dx; a.vz -= (j / ma) * dz;
        b.vx += (j / mb) * dx; b.vz += (j / mb) * dz;
        const cx = (ax + bx) / 2, cz = (az + bz) / 2;
        const tqa = (cz - a.z) * (-j * dx) - (cx - a.x) * (-j * dz);
        const tqb = (cz - b.z) * (j * dx) - (cx - b.x) * (j * dz);
        a.yawRate = clamp(a.yawRate + tqa / (ma * 1.8), -4, 4);
        b.yawRate = clamp(b.yawRate + tqb / (mb * 1.8), -4, 4);
        const st = -rv;
        maxImpact = Math.max(maxImpact, st);
        if (st > 2) {
          a.addDamage(st * 0.003 * (mb / tm) * 2); b.addDamage(st * 0.003 * (ma / tm) * 2);
          a.shake = Math.max(a.shake, clamp(st / 16, 0.15, 0.8)); b.shake = Math.max(b.shake, clamp(st / 16, 0.15, 0.8));
          a.compV -= st * 0.5; b.compV -= st * 0.5;
          a.driftCur *= 0.5; b.driftCur *= 0.5;
          hooks.onCarHit(a, b, st, cx, a.y + 0.5, cz);
        }
      }
    }
  }
  return maxImpact;
}
