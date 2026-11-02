import type { BeyStats } from '../../customization/stats';
import type { StadiumDef } from '../../../data/stadiums';
import type { BattleResult, Finish } from '../../types';

/** Tunable gameplay parameters. Kept separate from rendering code. */
export const BATTLE_CFG = {
  dt: 1 / 60,
  topRadius: 0.7,
  maxTime: 90,
  baseDecay: 1.15,
  moveCost: 0.03,
  hitCost: 0.4,
  dashCost: 4,
  dashCooldown: 2.2,
  dashImpulse: 10,
  dashMinStamina: 12,
  restitution: 0.9,
  wallRestitution: 0.55,
  wallCost: 0.25,
  burstMinImpact: 3.5,
  burstScale: 2.8,
  burstThreshold: 100,
  lowStamina: 25,
  wobble: 8,
  maxSpeed: 15,
  omegaMin: 6,
  omegaMax: 48,
  hitCooldown: 0.12,
  startZ: 6,
};

export interface Command {
  mx: number;
  mz: number;
  dash: boolean;
}

export interface Derived {
  mass: number;
  accel: number;
  drag: number;
  decayMul: number;
  atkPow: number;
  defPow: number;
  stability: number;
  burstRes: number;
}

export interface TopState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  angle: number;
  omega: number;
  stamina: number;
  burst: number;
  dashCd: number;
  out: boolean;
  burstTime: number;
  spinDir: 1 | -1;
  hits: number;
  dashes: number;
  maxImpact: number;
  lastHit: number;
  travelled: number;
  p: Derived;
}

export type BattleEventType = 'collision' | 'wall' | 'dash' | 'burst' | 'ringout' | 'spinout' | 'launch';
export interface BattleEvent {
  type: BattleEventType;
  x: number;
  z: number;
  strength: number;
  top: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function derive(s: BeyStats): Derived {
  return {
    mass: 0.6 + s.weight / 70,
    accel: 8 + s.speed * 0.2,
    drag: 1.6 - s.speed * 0.006,
    decayMul: 1.55 - s.stamina * 0.008,
    atkPow: 0.5 + s.attack / 100,
    defPow: 0.5 + s.defense / 100,
    stability: s.balance / 100,
    burstRes: s.burstResist / 100,
  };
}

export function pocketCenters(st: StadiumDef): number[] {
  const n = st.pockets;
  const off = n === 4 ? Math.PI / 4 : 0;
  return Array.from({ length: n }, (_, k) => off + (k * Math.PI * 2) / n);
}

export class BattleSim {
  tops: [TopState, TopState];
  time = 0;
  postTime = 0;
  result: BattleResult | null = null;
  events: BattleEvent[] = [];
  collectEvents = true;
  readonly stadium: StadiumDef;
  readonly pockets: number[];

  constructor(stats: [BeyStats, BeyStats], stadium: StadiumDef, launch: [number, number] = [1, 1]) {
    this.stadium = stadium;
    this.pockets = pocketCenters(stadium);
    const mk = (i: 0 | 1): TopState => {
      const sgn = i === 0 ? 1 : -1;
      const z = BATTLE_CFG.startZ * sgn;
      return {
        x: 0, z,
        vx: sgn * -2.2, // tangential drift so tops swirl instead of head-on mirroring
        vz: -sgn * 5,
        angle: 0, omega: BATTLE_CFG.omegaMax,
        stamina: 88 + 12 * clamp(launch[i], 0, 1),
        burst: 0, dashCd: 0.6, out: false, burstTime: -1,
        spinDir: i === 0 ? 1 : -1,
        hits: 0, dashes: 0, maxImpact: 0, lastHit: -9, travelled: 0,
        p: derive(stats[i]),
      };
    };
    this.tops = [mk(0), mk(1)];
  }

  private emit(type: BattleEventType, x: number, z: number, strength: number, top: number) {
    if (this.collectEvents) this.events.push({ type, x, z, strength, top });
  }

  inPocket(x: number, z: number, extra = 0): boolean {
    const a = Math.atan2(z, x);
    const hw = this.stadium.pocketHalfAngle + extra;
    for (const c of this.pockets) {
      let d = a - c;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < hw) return true;
    }
    return false;
  }

  step(cmds: [Command, Command]) {
    const C = BATTLE_CFG;
    if (this.result) {
      this.postStep();
      return;
    }
    this.time += C.dt;
    for (let i = 0; i < 2; i++) this.moveTop(i as 0 | 1, cmds[i]);
    this.collide();
    for (let i = 0; i < 2; i++) this.wall(i as 0 | 1);
    this.checkFinish();
  }

  private moveTop(i: 0 | 1, cmd: Command) {
    const C = BATTLE_CFG;
    const dt = C.dt;
    const t = this.tops[i];
    const o = this.tops[1 - i];
    const p = t.p;
    const R = this.stadium.radius;
    let mx = cmd.mx;
    let mz = cmd.mz;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) { mx /= mag; mz /= mag; }
    const health = clamp(t.stamina / C.lowStamina, 0, 1);
    const ctl = 0.45 + 0.55 * health;
    let ax = mx * p.accel * ctl;
    let az = mz * p.accel * ctl;
    const r = Math.hypot(t.x, t.z);
    if (r > 1e-4) {
      const pull = this.stadium.pull * Math.pow(r / R, 1.4);
      ax -= (pull * t.x) / r;
      az -= (pull * t.z) / r;
    }
    if (health < 1) {
      const w = (1 - health) * C.wobble * (1 - 0.6 * p.stability);
      ax += Math.cos(this.time * 5.3 + i * 2) * w;
      az += Math.sin(this.time * 4.1 + i) * w;
    }
    t.dashCd = Math.max(0, t.dashCd - dt);
    if (cmd.dash && t.dashCd <= 0 && t.stamina > C.dashMinStamina) {
      let dx = mx, dz = mz;
      if (Math.hypot(dx, dz) < 0.2) {
        dx = o.x - t.x; dz = o.z - t.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
      } else {
        const l = Math.hypot(dx, dz);
        dx /= l; dz /= l;
      }
      const k = C.dashImpulse * (0.85 + 0.3 * (p.mass / 2));
      t.vx += dx * k;
      t.vz += dz * k;
      t.stamina -= C.dashCost;
      t.dashCd = C.dashCooldown;
      t.dashes++;
      this.emit('dash', t.x, t.z, 1, i);
    }
    t.vx += ax * dt;
    t.vz += az * dt;
    const f = Math.exp(-p.drag * dt);
    t.vx *= f;
    t.vz *= f;
    const sp = Math.hypot(t.vx, t.vz);
    const cap = C.maxSpeed + 5;
    if (sp > cap) { t.vx *= cap / sp; t.vz *= cap / sp; }
    t.x += t.vx * dt;
    t.z += t.vz * dt;
    t.travelled += sp * dt;
    t.stamina -= (C.baseDecay * p.decayMul + C.moveCost * sp * (1 - 0.25 * p.stability)) * dt;
    t.stamina = Math.max(0, t.stamina);
    this.updateSpin(t);
  }

  private updateSpin(t: TopState) {
    const C = BATTLE_CFG;
    t.omega = C.omegaMin + (C.omegaMax - C.omegaMin) * Math.pow(clamp(t.stamina / 100, 0, 1), 0.7);
    if (t.burstTime < 0) t.angle += t.spinDir * t.omega * C.dt;
  }

  private collide() {
    const C = BATTLE_CFG;
    const [a, b] = this.tops;
    if (a.out || b.out) return;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const minD = C.topRadius * 2;
    if (dist >= minD) return;
    const nx = dist > 1e-6 ? dx / dist : 1;
    const nz = dist > 1e-6 ? dz / dist : 0;
    const ma = a.p.mass, mb = b.p.mass;
    const overlap = minD - dist;
    a.x -= nx * overlap * (mb / (ma + mb));
    a.z -= nz * overlap * (mb / (ma + mb));
    b.x += nx * overlap * (ma / (ma + mb));
    b.z += nz * overlap * (ma / (ma + mb));
    const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (vn <= 0.3) {
      // resting contact: gently push apart so tops never hug each other
      const k = 0.9 - vn;
      a.vx -= nx * k * 0.5; a.vz -= nz * k * 0.5; b.vx += nx * k * 0.5; b.vz += nz * k * 0.5;
      return;
    }
    const j = ((1 + C.restitution) * vn) / (1 / ma + 1 / mb);
    const ka = clamp(Math.pow(b.p.atkPow / a.p.defPow, 0.7), 0.6, 1.7);
    const kb = clamp(Math.pow(a.p.atkPow / b.p.defPow, 0.7), 0.6, 1.7);
    a.vx -= ((nx * j) / ma) * ka;
    a.vz -= ((nz * j) / ma) * ka;
    b.vx += ((nx * j) / mb) * kb;
    b.vz += ((nz * j) / mb) * kb;
    if (vn > 1.2 && this.time - Math.max(a.lastHit, b.lastHit) > C.hitCooldown) {
      this.damage(a, b, vn, 0);
      this.damage(b, a, vn, 1);
      this.emit('collision', (a.x + b.x) / 2, (a.z + b.z) / 2, vn, -1);
    }
  }

  private damage(victim: TopState, attacker: TopState, impact: number, vi: number) {
    const C = BATTLE_CFG;
    const ratio = attacker.p.atkPow / victim.p.defPow;
    victim.stamina = Math.max(0, victim.stamina - C.hitCost * impact * ratio * (1 - 0.35 * victim.p.stability));
    victim.burst += Math.max(0, impact - C.burstMinImpact) * C.burstScale * attacker.p.atkPow / victim.p.burstRes;
    victim.hits++;
    victim.lastHit = this.time;
    victim.maxImpact = Math.max(victim.maxImpact, impact);
    void vi;
  }

  private wall(i: 0 | 1) {
    const C = BATTLE_CFG;
    const t = this.tops[i];
    if (t.out) return;
    const R = this.stadium.radius - 0.35;
    const r = Math.hypot(t.x, t.z);
    if (r <= R) return;
    if (this.inPocket(t.x, t.z)) {
      t.out = true;
      return;
    }
    const nx = t.x / r, nz = t.z / r;
    t.x = nx * R;
    t.z = nz * R;
    const vn = t.vx * nx + t.vz * nz;
    if (vn > 0) {
      t.vx -= (1 + C.wallRestitution) * vn * nx;
      t.vz -= (1 + C.wallRestitution) * vn * nz;
      t.stamina = Math.max(0, t.stamina - C.wallCost * vn);
      if (vn > 2) this.emit('wall', t.x, t.z, vn, i);
    }
  }

  private checkFinish() {
    const C = BATTLE_CFG;
    const cand: (Finish | null)[] = [null, null];
    for (let i = 0; i < 2; i++) {
      const t = this.tops[i];
      if (t.out) cand[i] = 'RING_OUT';
      else if (t.burst >= C.burstThreshold) cand[i] = 'BURST';
      else if (t.stamina <= 0) cand[i] = 'SPIN';
    }
    let loser: 0 | 1 | null = null;
    let finish: Finish = 'SPIN';
    if (cand[0] && cand[1]) {
      const s0 = this.tops[0].stamina - this.tops[0].burst * 0.01;
      const s1 = this.tops[1].stamina - this.tops[1].burst * 0.01;
      loser = s0 < s1 ? 0 : 1;
      finish = cand[loser]!;
    } else if (cand[0] || cand[1]) {
      loser = cand[0] ? 0 : 1;
      finish = cand[loser]!;
    } else if (this.time >= C.maxTime) {
      loser = this.tops[0].stamina < this.tops[1].stamina ? 0 : 1;
      finish = 'SPIN';
    }
    if (loser === null) return;
    const lt = this.tops[loser];
    if (finish === 'BURST') {
      lt.burstTime = this.time;
      this.emit('burst', lt.x, lt.z, 1, loser);
    } else if (finish === 'RING_OUT') {
      const r = Math.hypot(lt.x, lt.z) || 1;
      lt.vx += (lt.x / r) * 3;
      lt.vz += (lt.z / r) * 3;
      this.emit('ringout', lt.x, lt.z, 1, loser);
    } else {
      this.emit('spinout', lt.x, lt.z, 1, loser);
    }
    this.result = {
      winner: (1 - loser) as 0 | 1,
      loser,
      finish,
      time: this.time,
      stamina: [Math.max(0, this.tops[0].stamina), Math.max(0, this.tops[1].stamina)],
    };
  }

  /** Cosmetic continuation after the result is decided (no more gameplay). */
  private postStep() {
    const C = BATTLE_CFG;
    this.postTime += C.dt;
    const res = this.result!;
    for (let i = 0; i < 2; i++) {
      const t = this.tops[i];
      const isLoser = i === res.loser;
      if (isLoser && res.finish === 'BURST') {
        t.vx *= 0.9; t.vz *= 0.9;
      } else if (isLoser && res.finish === 'RING_OUT') {
        t.vx *= 0.995; t.vz *= 0.995;
      } else {
        const f = Math.exp(-2 * C.dt);
        t.vx *= f; t.vz *= f;
        if (isLoser) t.stamina = Math.max(0, t.stamina - 4 * C.dt);
      }
      t.x += t.vx * C.dt;
      t.z += t.vz * C.dt;
      if (!t.out && !(isLoser && res.finish === 'BURST')) this.wall(i as 0 | 1);
      if (!(isLoser && res.finish === 'BURST')) this.updateSpin(t);
    }
  }

  drainEvents(): BattleEvent[] {
    if (this.events.length === 0) return this.events;
    const e = this.events;
    this.events = [];
    return e;
  }
}
