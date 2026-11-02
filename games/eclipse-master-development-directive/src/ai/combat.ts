// Choreographed combat: AI makes tactical decisions (who attacks, with what, how the defender responds)
// while a pacing controller guarantees the narrative outcome required by the screenplay.
import type { AnimName } from '../engine/types';
import { NpcAgent, pickWeighted, type AgentCtx } from './npc';

export interface Ability {
  id: string; name: string; kind: 'melee' | 'ranged' | 'aoe'; anim: AnimName; dmg: number; cd: number;
  color: string; sfx: string; ult?: boolean;
}
export const ABILITIES: Record<string, Ability> = {
  eclipse_slash: { id: 'eclipse_slash', name: 'Eclipse Slash', kind: 'melee', anim: 'slash_h', dmg: 0.14, cd: 2.5, color: '#ffcf5a', sfx: 'slash' },
  umbral_dash: { id: 'umbral_dash', name: 'Umbral Dash', kind: 'melee', anim: 'thrust', dmg: 0.1, cd: 3, color: '#8a6bff', sfx: 'whoosh' },
  solar_burst: { id: 'solar_burst', name: 'Solar Burst', kind: 'aoe', anim: 'blast', dmg: 0.22, cd: 12, color: '#ffe08a', sfx: 'burst', ult: true },
  crimson_flurry: { id: 'crimson_flurry', name: 'Crimson Flurry', kind: 'melee', anim: 'slash_v', dmg: 0.1, cd: 2, color: '#ff3b5c', sfx: 'slash' },
  blade_dance: { id: 'blade_dance', name: 'Blade Dance', kind: 'melee', anim: 'slash_h', dmg: 0.13, cd: 4, color: '#ff8aa0', sfx: 'slash' },
  star_bolt: { id: 'star_bolt', name: 'Star Bolt', kind: 'ranged', anim: 'cast', dmg: 0.11, cd: 2.5, color: '#8fd0ff', sfx: 'magic' },
  meteor_fall: { id: 'meteor_fall', name: 'Meteor Fall', kind: 'aoe', anim: 'raise', dmg: 0.2, cd: 12, color: '#9fd8ff', sfx: 'burst', ult: true },
  void_spear: { id: 'void_spear', name: 'Void Spear', kind: 'ranged', anim: 'thrust', dmg: 0.14, cd: 3, color: '#b04dff', sfx: 'magic' },
  shadow_wave: { id: 'shadow_wave', name: 'Shadow Wave', kind: 'ranged', anim: 'blast', dmg: 0.12, cd: 3.5, color: '#6a2bd0', sfx: 'whoosh' },
  gravity_crush: { id: 'gravity_crush', name: 'Gravity Crush', kind: 'aoe', anim: 'cast', dmg: 0.22, cd: 12, color: '#8a2be2', sfx: 'rumble', ult: true },
  spear_thrust: { id: 'spear_thrust', name: 'Spear Thrust', kind: 'melee', anim: 'thrust', dmg: 0.08, cd: 2, color: '#dddddd', sfx: 'slash' },
  soldier_slash: { id: 'soldier_slash', name: 'Slash', kind: 'melee', anim: 'slash_h', dmg: 0.08, cd: 2, color: '#dddddd', sfx: 'slash' },
};

export type CombatEvent =
  | { k: 'windup'; who: string; target: string; ability: Ability }
  | { k: 'impact'; who: string; target: string; ability: Ability; result: 'hit' | 'parry' | 'dodge'; dmg: number; x: number; z: number; ax: number; az: number }
  | { k: 'finish'; who: string; target: string; ability: Ability; x: number; z: number }
  | { k: 'clash'; x: number; z: number }
  | { k: 'end' };

export interface CombatPlan { sides: [string[], string[]]; winner: 0 | 1 | 'draw'; dur: number; end: 'down' | 'kneel' | 'draw'; center: [number, number] }

interface Fighter { a: NpcAgent; side: 0 | 1; fhp: number; start: number; cd: Record<string, number>; home: [number, number]; lastAct: number; busy: number }

export class CombatSim {
  t = 0;
  done = false;
  phase: 'fight' | 'finale' | 'aftermath' = 'fight';
  fighters: Fighter[] = [];
  lastAttacker?: string;
  log: string[] = [];
  private pending: { at: number; fn: () => void }[] = [];
  private nextEx = 0.6;
  private endAt = 0;

  constructor(private plan: CombatPlan, private ctx: AgentCtx, private emit: (e: CombatEvent) => void) {
    plan.sides.forEach((ids, side) => ids.forEach((id, i) => {
      const a = ctx.agents.get(id);
      if (!a || !a.active) return;
      const n = ids.length;
      const home: [number, number] = [plan.center[0] + (side ? 1 : -1) * 2.4, plan.center[1] + (i - (n - 1) / 2) * 2.2];
      this.fighters.push({ a, side: side as 0 | 1, fhp: 1, start: a.hp, cd: {}, home, lastAct: -2, busy: 0 });
      a.combatTarget = undefined;
    }));
  }

  static homePositions(plan: CombatPlan): Record<string, [number, number]> {
    const out: Record<string, [number, number]> = {};
    plan.sides.forEach((ids, side) => ids.forEach((id, i) => {
      out[id] = [plan.center[0] + (side ? 1 : -1) * 2.4, plan.center[1] + (i - (ids.length - 1) / 2) * 2.2];
    }));
    return out;
  }

  private alive(side?: 0 | 1) { return this.fighters.filter((f) => f.fhp > 0 && (side === undefined || f.side === side)); }
  private curve(f: Fighter, frac: number): number {
    const w = this.plan.winner;
    if (w === 'draw') return 1 - 0.55 * frac;
    return f.side === w ? 1 - 0.4 * frac : 1 - 0.95 * Math.pow(frac, 1.15);
  }

  update(dt: number) {
    if (this.done) return;
    this.t += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].at <= this.t) { const p = this.pending.splice(i, 1)[0]; p.fn(); }
    }
    this.fighters.forEach((f) => { f.a.hp = f.start * Math.max(0, f.fhp); });
    if (this.phase === 'fight') {
      if (this.t >= this.plan.dur) { this.phase = 'finale'; this.finale(); }
      else if (this.t >= this.nextEx) this.startExchange();
    } else if (this.phase === 'finale' && this.t >= this.endAt) {
      this.phase = 'aftermath';
      this.fighters.forEach((f) => { f.a.combatTarget = undefined; });
      this.done = true;
      this.emit({ k: 'end' });
    }
  }

  private after(delay: number, fn: () => void) { this.pending.push({ at: this.t + delay, fn }); }

  private startExchange() {
    const { ctx } = this;
    const frac = Math.min(1, this.t / this.plan.dur);
    const alive = this.alive();
    if (alive.length < 2) { this.nextEx = this.t + 0.5; return; }
    const w = this.plan.winner;
    const attackers = alive.filter((f) => this.t >= f.busy);
    if (!attackers.length) { this.nextEx = this.t + 0.3; return; }
    const A = pickWeighted(attackers.map((f) => ({
      v: f,
      w: 0.25 + f.a.def.personality.aggression * 0.6 + (this.t - f.lastAct) * 0.18 + (w !== 'draw' && f.side === w ? 0.25 * frac : 0) - (f.a.id === this.lastAttacker ? 0.35 : 0),
    })), ctx.rng);
    const enemies = this.alive(A.side === 0 ? 1 : 0);
    if (!enemies.length) { this.nextEx = this.t + 0.5; return; }
    const T = pickWeighted(enemies.map((f) => ({ v: f, w: 1 / (1 + Math.hypot(f.a.x - A.a.x, f.a.z - A.a.z)) + (1 - f.fhp) * 0.5 })), ctx.rng);
    const dist = Math.hypot(T.a.x - A.a.x, T.a.z - A.a.z);
    const abilities = A.a.def.abilities.map((id) => ABILITIES[id]).filter(Boolean);
    const usable = abilities.filter((ab) => this.t >= (A.cd[ab.id] ?? 0));
    if (!usable.length) { this.nextEx = this.t + 0.4; return; }
    const ab = pickWeighted(usable.map((x) => ({
      v: x,
      w: x.dmg * 5 + (x.ult ? ((A.fhp < 0.6 || frac > 0.45) && this.t > 4 ? 1.6 : 0.001) : 0) + (dist > 4 && x.kind !== 'melee' ? 0.6 : 0) + ctx.rng() * 0.3,
    })), ctx.rng);
    A.cd[ab.id] = this.t + ab.cd;
    A.lastAct = this.t;
    this.lastAttacker = A.a.id;
    const multi = this.fighters.length > 3;
    A.busy = this.t + 1.3;
    this.nextEx = this.t + (multi ? 0.85 : 1.55) + ctx.rng() * 0.6;
    this.attack(A, T, ab, frac);
  }

  private attack(A: Fighter, T: Fighter, ab: Ability, frac: number) {
    const { ctx } = this;
    A.a.combatTarget = T.a.id; A.a.state = 'fighting';
    T.a.combatTarget = A.a.id; T.a.state = 'fighting';
    this.emit({ k: 'windup', who: A.a.id, target: T.a.id, ability: ab });
    if (ab.kind === 'melee') {
      const dx = T.a.x - A.a.x, dz = T.a.z - A.a.z, d = Math.hypot(dx, dz) || 1;
      this.after(0.12, () => A.a.dash(T.a.x - (dx / d) * 1.35, T.a.z - (dz / d) * 1.35, 0.3));
    }
    A.a.perform(ab.anim, ab.anim === 'cast' || ab.anim === 'raise' ? 1.1 : 0.75);
    if (ab.kind !== 'melee') A.a.aura = { color: ab.color, level: 1 };
    const impactAt = ab.kind === 'melee' ? 0.42 : ab.ult ? 0.9 : 0.6;
    this.after(impactAt, () => {
      if (T.fhp <= 0 || A.fhp <= 0) return;
      // defender decision (utility): parry / dodge / take it, biased by pacing curve
      const target = this.curve(T, frac);
      const wantHit = T.fhp > target + 0.02 ? 0.78 : T.fhp < target - 0.1 ? 0.1 : 0.4;
      const hit = ab.kind === 'aoe' || ctx.rng() < wantHit;
      let result: 'hit' | 'parry' | 'dodge' = 'hit';
      if (!hit) result = pickWeighted<'parry' | 'dodge'>([{ v: 'parry', w: 0.5 + T.a.def.personality.aggression * 0.4 }, { v: 'dodge', w: 0.55 }], ctx.rng);
      const floor = this.plan.winner === 'draw' ? 0.3 : T.side === this.plan.winner ? 0.3 : 0.1;
      let dmg = 0;
      if (result === 'hit') {
        dmg = ab.dmg * (0.8 + ctx.rng() * 0.4);
        const prev = T.fhp;
        T.fhp = Math.max(floor, T.fhp - dmg);
        dmg = prev - T.fhp;
        T.a.perform('hit');
        const dx = T.a.x - A.a.x, dz = T.a.z - A.a.z, d = Math.hypot(dx, dz) || 1;
        T.a.dash(T.a.x + (dx / d) * 0.9, T.a.z + (dz / d) * 0.9, 0.3);
        T.a.feel('surprise', 0.4);
      } else if (result === 'parry') {
        T.a.perform('block');
      } else {
        T.a.perform('dodge');
        const dx = T.a.x - A.a.x, dz = T.a.z - A.a.z, d = Math.hypot(dx, dz) || 1;
        T.a.dash(T.a.x - dz / d * 1.4, T.a.z + dx / d * 1.4, 0.35);
      }
      A.a.feel('resolve', 0.2);
      this.emit({ k: 'impact', who: A.a.id, target: T.a.id, ability: ab, result, dmg, x: T.a.x, z: T.a.z, ax: A.a.x, az: A.a.z });
      this.log.push(`${A.a.id} ${ab.name} → ${T.a.id}: ${result}`);
      // retreat to ring
      this.after(0.55, () => { if (A.fhp > 0) A.a.dash(A.home[0], A.home[1], 0.45); });
      this.after(0.7, () => { if (T.fhp > 0) T.a.dash(T.home[0], T.home[1], 0.5); });
    });
  }

  private finale() {
    const { plan } = this;
    this.pending.length = 0;
    const [c0, c1] = plan.center;
    if (plan.winner === 'draw') {
      const [A, B] = [this.fighters.find((f) => f.side === 0)!, this.fighters.find((f) => f.side === 1)!];
      if (!A || !B) { this.endAt = this.t + 0.5; return; }
      A.a.dash(c0 - 0.7, c1, 0.35); B.a.dash(c0 + 0.7, c1, 0.35);
      A.a.perform('slash_h'); B.a.perform('slash_h');
      this.emit({ k: 'windup', who: A.a.id, target: B.a.id, ability: ABILITIES.eclipse_slash });
      this.after(0.4, () => {
        this.emit({ k: 'clash', x: c0, z: c1 });
        [A, B].forEach((f) => {
          f.fhp = Math.min(f.fhp, 0.4);
          f.a.perform('hit', 0.9);
          const s = f.side ? 1 : -1;
          f.a.dash(f.a.x + s * 2.2, f.a.z, 0.5);
        });
      });
      this.after(1.1, () => [A, B].forEach((f) => { f.a.stance = 'wounded'; f.a.combatTarget = undefined; f.a.state = 'idle'; }));
      this.endAt = this.t + 2.0;
      return;
    }
    const winners = this.alive(plan.winner);
    const losers = this.fighters.filter((f) => f.side !== plan.winner);
    const hero = winners.sort((a, b) => b.a.def.abilities.length - a.a.def.abilities.length)[0];
    losers.forEach((L, i) => {
      const ult = (hero.a.def.abilities.map((id) => ABILITIES[id]).filter((x) => x?.ult)[0]) ?? ABILITIES[hero.a.def.abilities[0]] ?? ABILITIES.soldier_slash;
      const ab = i === 0 ? ult : ABILITIES[hero.a.def.abilities[0]] ?? ABILITIES.soldier_slash;
      this.after(i * 0.55, () => {
        hero.a.combatTarget = L.a.id; hero.a.state = 'fighting';
        this.emit({ k: 'windup', who: hero.a.id, target: L.a.id, ability: ab });
        hero.a.perform(ab.anim, 1.0);
        if (ab.kind === 'melee') {
          const dx = L.a.x - hero.a.x, dz = L.a.z - hero.a.z, d = Math.hypot(dx, dz) || 1;
          hero.a.dash(L.a.x - (dx / d) * 1.3, L.a.z - (dz / d) * 1.3, 0.3);
        } else hero.a.aura = { color: ab.color, level: 1 };
        this.after(ab.ult ? 0.9 : 0.45, () => {
          L.fhp = 0;
          this.emit({ k: 'finish', who: hero.a.id, target: L.a.id, ability: ab, x: L.a.x, z: L.a.z });
          L.a.combatTarget = undefined;
          if (plan.end === 'kneel') { L.a.perform('hit', 0.7); this.after(0.6, () => { L.a.stance = 'kneel'; L.a.state = 'idle'; }); }
          else { L.a.perform('collapse'); this.after(1.2, () => { L.a.stance = 'down'; L.a.state = 'down'; }); }
        });
      });
    });
    this.endAt = this.t + losers.length * 0.55 + 2.8;
  }
}
