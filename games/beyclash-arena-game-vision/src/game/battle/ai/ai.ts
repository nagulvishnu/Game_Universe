import { BATTLE_CFG, BattleSim, type Command, type TopState } from '../physics/sim';
import type { Difficulty, Strategy } from '../../types';

export interface AIProfile {
  strategy: Strategy;
  difficulty: Difficulty;
  seed?: number;
}

interface DiffParams {
  react: number; // seconds between decisions
  aim: number; // aim error (rad)
  edge: number; // margin from the wall where it starts steering inward
  dash: number; // probability of using a dash when conditions are right
  lead: number; // target prediction
  reflex: boolean; // per-tick emergency edge recovery
  adaptReact: boolean; // switches tactics when stamina is low
  launch: number; // launch timing skill 0..1
}

export const DIFF_PARAMS: Record<Difficulty, DiffParams> = {
  Beginner: { react: 0.8, aim: 0.55, edge: 0.8, dash: 0.04, lead: 0, reflex: false, adaptReact: false, launch: 0.55 },
  Easy: { react: 0.55, aim: 0.38, edge: 1.5, dash: 0.12, lead: 0, reflex: false, adaptReact: false, launch: 0.65 },
  Normal: { react: 0.38, aim: 0.24, edge: 2.2, dash: 0.3, lead: 0.2, reflex: false, adaptReact: true, launch: 0.75 },
  Hard: { react: 0.25, aim: 0.14, edge: 2.8, dash: 0.5, lead: 0.5, reflex: true, adaptReact: true, launch: 0.85 },
  Expert: { react: 0.16, aim: 0.07, edge: 3.2, dash: 0.7, lead: 0.8, reflex: true, adaptReact: true, launch: 0.92 },
  Champion: { react: 0.1, aim: 0.03, edge: 3.5, dash: 0.88, lead: 1, reflex: true, adaptReact: true, launch: 0.98 },
};

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export class AIController {
  readonly profile: AIProfile;
  readonly params: DiffParams;
  private rng: () => number;
  private t = 0;
  private next = 0;
  private out: Command = { mx: 0, mz: 0, dash: false };
  private hx = 0;
  private hz = 0;
  private dashNow = false;
  private orbit = 1;
  private lastHits = 0;
  private recoilUntil = 0;
  /** Strategy currently in use (adaptive AI changes this). */
  current: Strategy;

  constructor(profile: AIProfile) {
    this.profile = profile;
    this.params = DIFF_PARAMS[profile.difficulty];
    this.rng = mulberry32(profile.seed ?? 12345);
    this.current = profile.strategy === 'adaptive' ? 'defensive' : profile.strategy;
    this.orbit = this.rng() < 0.5 ? 1 : -1;
  }

  think(self: TopState, other: TopState, sim: BattleSim, dt: number): Command {
    this.t += dt;
    // after a collision, hit-and-run strategies back off briefly, then re-engage
    if (self.hits > this.lastHits) {
      this.lastHits = self.hits;
      if (this.current === 'aggressive' || this.current === 'opportunist' || this.current === 'evasive') {
        this.recoilUntil = this.t + (0.45 + this.rng() * 0.6) * (0.7 + this.params.react);
      }
    }
    if (this.t < this.recoilUntil) {
      const o = this.out;
      let ax = self.x - other.x, az = self.z - other.z;
      const l = Math.hypot(ax, az) || 1;
      ax /= l; az /= l;
      let mx = ax * 0.8 - az * 0.5 * this.orbit;
      let mz = az * 0.8 + ax * 0.5 * this.orbit;
      const r = Math.hypot(self.x, self.z);
      if (r > sim.stadium.radius - (this.params.edge + 1)) { mx = -self.x / r; mz = -self.z / r; }
      o.mx = mx; o.mz = mz; o.dash = false;
      this.next = this.recoilUntil;
      return o;
    }
    if (this.t >= this.next) {
      this.decide(self, other, sim);
      this.next = this.t + this.params.react * (0.8 + 0.4 * this.rng());
    }
    const R = sim.stadium.radius;
    const o = this.out;
    o.mx = this.hx;
    o.mz = this.hz;
    if (this.params.reflex) {
      const r = Math.hypot(self.x, self.z);
      if (r > R - 1.6 && sim.inPocket(self.x, self.z, 0.25)) {
        o.mx = -self.x / r;
        o.mz = -self.z / r;
      }
    }
    o.dash = this.dashNow;
    this.dashNow = false;
    return o;
  }

  private resolveStrategy(self: TopState, other: TopState, R: number): Strategy {
    const s = this.profile.strategy;
    if (s === 'adaptive') {
      const ro = Math.hypot(other.x, other.z);
      if (self.burst > 65) return 'evasive';
      if (ro > R - 3.5) return 'opportunist';
      if (self.stamina > other.stamina + 18) return 'stamina';
      if (self.stamina < other.stamina - 12) return 'aggressive';
      return 'defensive';
    }
    if (this.params.adaptReact && self.stamina < 22 && s === 'aggressive') return 'stamina';
    if (this.params.adaptReact && self.burst > 80 && (s === 'aggressive' || s === 'opportunist')) return 'evasive';
    return s;
  }

  private decide(self: TopState, other: TopState, sim: BattleSim) {
    const P = this.params;
    const R = sim.stadium.radius;
    const strat = this.resolveStrategy(self, other, R);
    this.current = strat;
    let dx = other.x - self.x;
    let dz = other.z - self.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const r = Math.hypot(self.x, self.z);
    const ro = Math.hypot(other.x, other.z);
    let tx = 0, tz = 0, k = 1;
    let wantDash = false;
    const lead = (P.lead * dist) / 12;
    const ox = other.x + other.vx * lead;
    const oz = other.z + other.vz * lead;

    switch (strat) {
      case 'aggressive':
        tx = ox; tz = oz; k = 1;
        wantDash = dist > 2.5 && dist < 7 && self.stamina > 35;
        break;
      case 'defensive':
        if (dist < 3.6) { tx = ox; tz = oz; k = 0.9; wantDash = other.stamina < 30 && self.stamina > 30; }
        else { tx = (other.x / (ro || 1)) * 1.8; tz = (other.z / (ro || 1)) * 1.8; k = r < 2.2 ? 0.15 : 0.55; }
        break;
      case 'stamina': {
        if (dist < 4) {
          // slip away sideways from the opponent
          tx = self.x - dz * this.orbit; tz = self.z + dx * this.orbit; k = 0.5;
          if (r > R - 3) { tx = 0; tz = 0; }
        } else { tx = self.x * 0.8; tz = self.z * 0.8; k = r < 1.5 ? 0.05 : 0.3; }
        break;
      }
      case 'evasive': {
        const want = 6;
        const radial = (dist - want) * 0.35;
        tx = self.x + (dx / dist) * radial + (-dz / dist) * this.orbit;
        tz = self.z + (dz / dist) * radial + (dx / dist) * this.orbit;
        k = 0.85;
        if (r > R - 3) this.orbit = -this.orbit;
        wantDash = other.stamina < 25 && dist < 6 && self.stamina > 30;
        break;
      }
      case 'opportunist': {
        const vulnerable = ro > R - 4 || other.stamina < 25 || sim.inPocket(other.x, other.z, 0.4) && ro > R - 5.5;
        if (vulnerable) {
          if (r < ro - 0.5) { tx = ox; tz = oz; k = 1; wantDash = dist < 7 && dist > 2 && self.stamina > 25; }
          else { const ux = other.x / (ro || 1), uz = other.z / (ro || 1); tx = ux * (ro - 2.8); tz = uz * (ro - 2.8); k = 1; }
        } else { tx = -other.x * 0.3; tz = -other.z * 0.3; k = r < 2 ? 0.1 : 0.4; }
        break;
      }
      default:
        tx = ox; tz = oz;
    }

    let hx = tx - self.x;
    let hz = tz - self.z;
    const hl = Math.hypot(hx, hz);
    if (hl > 1e-4) { hx = (hx / hl); hz = (hz / hl); } else { hx = 0; hz = 0; k = 0; }
    // aim error
    const err = (this.rng() - 0.5) * 2 * P.aim;
    const c = Math.cos(err), s = Math.sin(err);
    const rx = hx * c - hz * s;
    const rz = hx * s + hz * c;
    hx = rx * k; hz = rz * k;
    // keep away from the wall, especially near ring-out pockets
    const fx = self.x + self.vx * 0.45 + hx * 1.2;
    const fz = self.z + self.vz * 0.45 + hz * 1.2;
    const fr = Math.hypot(fx, fz);
    const margin = P.edge + (sim.inPocket(fx, fz, 0.35) ? 1.2 : 0);
    if (fr > R - margin && fr > 1e-4) {
      const w = Math.min(1, (fr - (R - margin)) / 1.5 + 0.4);
      hx = hx * (1 - w) - (fx / fr) * w * 1.1;
      hz = hz * (1 - w) - (fz / fr) * w * 1.1;
      wantDash = false;
    }
    this.hx = hx;
    this.hz = hz;
    if (wantDash && this.rng() < P.dash && self.dashCd <= 0) {
      this.dashNow = true;
      // dash direction follows the heading
    }
    void BATTLE_CFG;
  }
}

/** Run a complete battle without rendering (tournament AI-vs-AI matches, tests). */
export function runHeadless(sim: BattleSim, a: AIController, b: AIController) {
  sim.collectEvents = false;
  const dt = BATTLE_CFG.dt;
  const max = Math.ceil(BATTLE_CFG.maxTime / dt) + 5;
  for (let i = 0; i < max && !sim.result; i++) {
    const c0 = { ...a.think(sim.tops[0], sim.tops[1], sim, dt) };
    const c1 = { ...b.think(sim.tops[1], sim.tops[0], sim, dt) };
    sim.step([c0, c1]);
  }
  return sim.result;
}
