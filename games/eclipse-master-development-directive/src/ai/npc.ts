// Autonomous character agent: utility AI + state machine + emotion/memory/relationship model.
// Runs entirely locally every frame (no LLM calls on the hot path).
import type { AnimName, Emotion, Gesture, MemoryEntry, Relationship, Stance, Vec2 } from '../engine/types';
import type { CharDef } from '../story/characters';
import { findPath } from './nav';
import type { EnvData } from '../world/envData';

export type Axis = 'joy' | 'sorrow' | 'anger' | 'fear' | 'surprise' | 'resolve';
const AXES: Axis[] = ['joy', 'sorrow', 'anger', 'fear', 'surprise', 'resolve'];
export const EMO_VEC: Record<Emotion, Partial<Record<Axis, number>>> = {
  neutral: {}, joy: { joy: 0.85 }, sorrow: { sorrow: 0.85 }, anger: { anger: 0.85 }, fear: { fear: 0.85 },
  surprise: { surprise: 0.9 }, resolve: { resolve: 0.85 }, smirk: { joy: 0.35, anger: 0.2, resolve: 0.3 },
  worry: { fear: 0.35, sorrow: 0.4 }, tender: { joy: 0.45, sorrow: 0.25 },
};
export const ANIM_DUR: Record<AnimName, number> = {
  slash_h: 0.75, slash_v: 0.75, thrust: 0.7, cast: 1.2, blast: 0.95, block: 0.45, dodge: 0.55, hit: 0.6, bow: 1.8,
  flinch: 0.6, raise: 1.6, collapse: 1.5, draw: 0.8, kneel_down: 1.0, stand_up: 1.0, reach: 1.3,
};

export interface AgentCtx {
  agents: Map<string, NpcAgent>;
  env: EnvData;
  focusId?: string;
  speakerId?: string;
  rng: () => number;
}

const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function pickWeighted<T>(items: { v: T; w: number }[], rng: () => number): T {
  const total = items.reduce((s, i) => s + Math.max(0.001, i.w), 0);
  let r = rng() * total;
  for (const i of items) { r -= Math.max(0.001, i.w); if (r <= 0) return i.v; }
  return items[items.length - 1].v;
}

/** Utility selection of a speaking gesture from personality, emotion and the words themselves. */
export function chooseGesture(def: CharDef, emo: Record<Axis, number>, text: string, rng: () => number): Gesture {
  const p = def.personality;
  const t = text.toLowerCase();
  const has = (re: RegExp) => (re.test(t) ? 1 : 0);
  return pickWeighted<Gesture>([
    { v: 'none', w: 0.35 + (1 - p.expressiveness) * 1.2 },
    { v: 'open', w: 0.5 * p.expressiveness + has(/\?|because|if |when |the /) * 0.4 },
    { v: 'point', w: has(/\byou\b|your|!/) * (0.4 + p.aggression * 0.6) + emo.anger * 0.6 },
    { v: 'chest', w: has(/\bi\b|\bmy\b|\bme\b/) * (0.3 + p.warmth * 0.6) + emo.sorrow * 0.5 },
    { v: 'fist', w: (emo.resolve + emo.anger) * 0.7 * (0.4 + p.bravery * 0.6) },
    { v: 'shake', w: has(/\bno\b|\bnot\b|never|can't|won't|don't/) * 0.8 },
    { v: 'nod', w: has(/\byes\b|\bright\b|we will|together|promise/) * 0.8 },
    { v: 'shrug', w: (emo.fear * 0.3 + has(/maybe|perhaps|suppose|who knows/) * 0.9) * p.expressiveness },
  ], rng);
}

function visemeFor(ch: string): { open: number; wide: number } {
  switch (ch.toLowerCase()) {
    case 'a': return { open: 1, wide: 0.5 };
    case 'e': return { open: 0.6, wide: 0.9 };
    case 'i': return { open: 0.35, wide: 1 };
    case 'o': return { open: 0.85, wide: -0.8 };
    case 'u': case 'w': return { open: 0.45, wide: -1 };
    case 'b': case 'm': case 'p': return { open: 0, wide: 0 };
    case 'f': case 'v': return { open: 0.15, wide: 0.4 };
    case ' ': case ',': case '.': case '—': case '…': case '?': case '!': return { open: 0.02, wide: 0 };
    default: return { open: 0.28, wide: 0.3 };
  }
}

export class NpcAgent {
  def: CharDef;
  id: string;
  active = false;
  x = 0; z = 0; yaw = 0; speed = 0;
  stance: Stance = 'stand';
  weaponDrawn = false;
  hp = 1;
  injuries: string[] = [];
  outfit = 'travel';
  // behaviour
  state: 'idle' | 'walking' | 'speaking' | 'listening' | 'acting' | 'fighting' | 'down' = 'idle';
  goalText = 'Observe';
  path: Vec2[] = [];
  running = false;
  arrived = true;
  navFallbacks = 0;
  private stuckT = 0;
  private lastDist = Infinity;
  dashing: { fx: number; fz: number; tx: number; tz: number; t: number; dur: number } | null = null;
  faceTarget?: string | Vec2;
  combatTarget?: string;
  anim: { name: AnimName; t: number; dur: number } | null = null;
  gesture: { name: Gesture; t: number; dur: number } | null = null;
  idleBehavior: { name: 'sway' | 'glance' | 'scan' | 'breathe' | 'fidget'; until: number; dir: number } = { name: 'breathe', until: 0, dir: 1 };
  private clock = 0;
  // face / gaze
  emo: Record<Axis, number> = { joy: 0, sorrow: 0, anger: 0, fear: 0, surprise: 0, resolve: 0 };
  dominant: Emotion = 'neutral';
  headYaw = 0; headPitch = 0; eyeYaw = 0; eyePitch = 0;
  blink = 0; private nextBlink = 2;
  speech: { text: string; t: number; dur: number; idx: number } | null = null;
  mouthOpen = 0; mouthWide = 0;
  aura: { color: string; level: number } | null = null;
  markGlow = 0.2;
  // mind
  memory: MemoryEntry[] = [];
  knowledge = new Set<string>();
  relationships: Record<string, Relationship> = {};

  constructor(def: CharDef) { this.def = def; this.id = def.id; }

  reset(o: { x: number; z: number; yaw: number; stance: Stance; weapon: boolean; hp: number; injuries: string[]; outfit: string; emo: Emotion }) {
    Object.assign(this, { x: o.x, z: o.z, yaw: o.yaw, stance: o.stance, weaponDrawn: o.weapon, hp: o.hp, injuries: [...o.injuries], outfit: o.outfit });
    this.active = true; this.speed = 0; this.path = []; this.arrived = true; this.anim = null; this.gesture = null;
    this.speech = null; this.dashing = null; this.faceTarget = undefined; this.combatTarget = undefined; this.aura = null;
    this.state = this.stance === 'down' ? 'down' : 'idle';
    AXES.forEach((a) => (this.emo[a] = 0));
    this.feel(o.emo, 0.8);
    this.markGlow = this.def.bearer ? 0.25 : 0;
  }

  // ---- mind -----------------------------------------------------------
  feel(e: Emotion, amount: number) {
    const v = EMO_VEC[e];
    for (const a of AXES) if (v[a]) this.emo[a] = clamp(this.emo[a] + v[a]! * amount, 0, 1);
    if (e === 'neutral') for (const a of AXES) this.emo[a] *= 0.6;
  }
  remember(m: MemoryEntry) {
    this.memory.push(m);
    if (this.memory.length > 80) {
      let lo = 0;
      for (let i = 1; i < this.memory.length - 10; i++) if (this.memory[i].salience < this.memory[lo].salience) lo = i;
      this.memory.splice(lo, 1);
    }
  }
  rel(other: string): Relationship {
    return (this.relationships[other] ??= { trust: 0.4, affection: 0.3 });
  }
  hear(from: string, text: string, emo: Emotion, scene: string, t: number) {
    const sal = 0.3 + (emo === 'neutral' ? 0 : 0.35) + Math.min(0.3, text.length / 300);
    this.remember({ scene, t, kind: 'heard', text, from, salience: sal });
    // empathic reaction scaled by relationship
    const r = this.rel(from);
    const strength = 0.25 + r.affection * 0.35;
    if (emo === 'sorrow' || emo === 'tender' || emo === 'worry') this.feel(emo === 'tender' ? 'tender' : 'worry', strength);
    else if (emo === 'anger') this.feel(this.def.personality.bravery > 0.6 ? 'resolve' : 'fear', 0.3);
    else if (emo === 'joy') this.feel('joy', strength * 0.6);
    else if (emo === 'surprise' || emo === 'fear') this.feel('surprise', 0.3);
    if (emo === 'anger') r.trust = clamp(r.trust - 0.02, 0, 1);
    if (emo === 'tender' || emo === 'joy') r.affection = clamp(r.affection + 0.02, 0, 1);
  }
  say(text: string, dur: number, emo: Emotion, g: Gesture | undefined, ctx: AgentCtx, scene: string, t: number) {
    this.speech = { text, t: 0, dur, idx: 0 };
    this.feel(emo, 0.6);
    this.state = 'speaking';
    this.remember({ scene, t, kind: 'said', text, salience: 0.5 });
    const name = g ?? chooseGesture(this.def, this.emo, text, ctx.rng);
    this.gesture = name === 'none' ? null : { name, t: 0, dur: 1.4 + ctx.rng() };
    this.goalText = 'Speak';
  }
  react(kind: 'thunder' | 'blast' | 'quake' | 'flash' | 'death', at: Vec2 | undefined, rng: () => number) {
    if (this.stance === 'down' || this.anim) return;
    const p = this.def.personality;
    const choice = pickWeighted<'flinch' | 'look' | 'ignore'>([
      { v: 'flinch', w: (1 - p.bravery) * 0.9 + (kind === 'blast' ? 0.5 : 0.1) },
      { v: 'look', w: p.curiosity * 0.7 + 0.2 },
      { v: 'ignore', w: p.bravery * 0.5 },
    ], rng);
    if (kind === 'death') { this.feel('sorrow', 0.7); return; }
    this.feel('surprise', 0.35 + (1 - p.bravery) * 0.3);
    if (choice === 'flinch' && this.stance === 'stand') this.perform('flinch');
    if (at && choice !== 'ignore') this.faceTarget = at;
    this.remember({ scene: '', t: 0, kind: 'event', text: `Reacted to ${kind}`, salience: 0.3 });
  }

  // ---- body -----------------------------------------------------------
  perform(a: AnimName, dur?: number) {
    this.anim = { name: a, t: 0, dur: dur ?? ANIM_DUR[a] };
    if (this.state !== 'speaking') this.state = 'acting';
  }
  goTo(p: Vec2, env: EnvData, run = false): boolean {
    this.running = run;
    const path = findPath(env, [this.x, this.z], p);
    this.dashing = null;
    if (!path) {
      this.navFallbacks++;
      this.x = p[0]; this.z = p[1]; this.path = []; this.arrived = true;
      return false;
    }
    this.path = path; this.arrived = path.length === 0; this.stuckT = 0; this.lastDist = Infinity;
    if (!this.arrived) this.state = 'walking';
    return true;
  }
  dash(tx: number, tz: number, dur: number) {
    this.dashing = { fx: this.x, fz: this.z, tx, tz, t: 0, dur };
  }
  private posOf(t: string | Vec2 | undefined, ctx: AgentCtx): Vec2 | undefined {
    if (!t) return undefined;
    if (Array.isArray(t)) return t;
    const a = ctx.agents.get(t);
    if (a?.active) return [a.x, a.z];
    return ctx.env.marks[t];
  }

  faceParams() {
    const e = this.emo;
    return {
      browTilt: clamp(-e.anger * 1 + e.sorrow * 0.9 + e.fear * 0.7, -1, 1),
      browY: clamp(e.surprise + e.fear * 0.6 - e.anger * 0.4 + e.sorrow * 0.2, -1, 1),
      eyeOpen: clamp(1 + e.surprise * 0.35 - e.sorrow * 0.25 - e.anger * 0.22 - e.joy * 0.15 + (this.stance === 'down' ? -0.55 : 0), 0.05, 1.4),
      smile: clamp(e.joy - e.sorrow * 0.75 - e.anger * 0.5 + e.resolve * 0.1, -1, 1),
      mouthBase: clamp(e.surprise * 0.4 + e.fear * 0.2 + e.anger * 0.1, 0, 0.6),
      blush: clamp(e.joy * 0.5, 0, 1),
      tear: e.sorrow > 0.7 ? 1 : 0,
    };
  }

  update(dt: number, ctx: AgentCtx) {
    if (!this.active) return;
    this.clock += dt;
    // emotion decay
    for (const a of AXES) this.emo[a] = Math.max(0, this.emo[a] - dt * (a === 'resolve' ? 0.05 : a === 'sorrow' ? 0.04 : 0.1));
    let best: Emotion = 'neutral', bv = 0.22;
    (Object.keys(EMO_VEC) as Emotion[]).forEach((k) => {
      if (k === 'neutral' || k === 'smirk' || k === 'worry' || k === 'tender') return;
      const a = Object.keys(EMO_VEC[k])[0] as Axis;
      if (this.emo[a] > bv) { bv = this.emo[a]; best = k; }
    });
    this.dominant = best;

    if (this.anim) {
      this.anim.t += dt;
      if (this.anim.t >= this.anim.dur) { this.anim = null; if (this.state === 'acting') this.state = 'idle'; }
    }
    if (this.gesture) { this.gesture.t += dt; if (this.gesture.t > this.gesture.dur) this.gesture = null; }

    // speech / lip-sync (text-driven viseme track)
    let tMouth = this.faceParams().mouthBase, tWide = 0;
    if (this.speech) {
      const s = this.speech;
      s.t += dt;
      s.idx = Math.min(s.text.length - 1, Math.floor((s.t / s.dur) * s.text.length));
      const v = visemeFor(s.text[s.idx] ?? ' ');
      tMouth = Math.max(tMouth, v.open); tWide = v.wide;
      if (!this.gesture && s.t < s.dur - 0.8 && ctx.rng() < dt * 0.7) {
        const g = chooseGesture(this.def, this.emo, s.text, ctx.rng);
        if (g !== 'none') this.gesture = { name: g, t: 0, dur: 1.2 + ctx.rng() };
      }
      if (s.t >= s.dur) { this.speech = null; if (this.state === 'speaking') this.state = 'idle'; }
    }
    const k = Math.min(1, dt * 20);
    this.mouthOpen += (tMouth - this.mouthOpen) * k;
    this.mouthWide += (tWide - this.mouthWide) * k;

    // blinking
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blink = 0.001; this.nextBlink = 2 + ctx.rng() * 3.5; }
    if (this.blink > 0) { this.blink += dt / 0.16; if (this.blink >= 1) this.blink = 0; }

    // movement
    if (this.dashing) {
      const d = this.dashing; d.t += dt;
      const u = clamp(d.t / d.dur, 0, 1), e = 1 - Math.pow(1 - u, 3);
      const px = this.x, pz = this.z;
      this.x = d.fx + (d.tx - d.fx) * e; this.z = d.fz + (d.tz - d.fz) * e;
      this.speed = Math.hypot(this.x - px, this.z - pz) / Math.max(dt, 1e-4);
      if (u >= 1) this.dashing = null;
    } else if (this.path.length && this.stance !== 'down') {
      const [tx, tz] = this.path[0];
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
      if (d < 0.2) {
        this.path.shift();
        if (!this.path.length) { this.arrived = true; if (this.state === 'walking') this.state = 'idle'; }
      } else {
        const vmax = this.running ? 4.2 : 1.55;
        let sx = 0, sz = 0;
        ctx.agents.forEach((o) => {
          if (o === this || !o.active) return;
          const ox = this.x - o.x, oz = this.z - o.z, dd = Math.hypot(ox, oz);
          if (dd < 0.9 && dd > 0.001) { sx += (ox / dd) * (0.9 - dd); sz += (oz / dd) * (0.9 - dd); }
        });
        const wx = dx / d + sx * 1.4, wz = dz / d + sz * 1.4;
        const want = Math.atan2(wx, wz);
        const diff = wrap(want - this.yaw);
        this.yaw += clamp(diff, -7 * dt, 7 * dt);
        const target = vmax * (Math.abs(diff) > 1.2 ? 0.25 : 1) * (this.path.length === 1 ? clamp(d / 0.9, 0.45, 1) : 1);
        this.speed += clamp(target - this.speed, -10 * dt, 6 * dt);
        this.x += Math.sin(this.yaw) * this.speed * dt;
        this.z += Math.cos(this.yaw) * this.speed * dt;
        // stuck detection with graceful fallback
        const remaining = Math.hypot(this.path[this.path.length - 1][0] - this.x, this.path[this.path.length - 1][1] - this.z);
        if (remaining > this.lastDist - 0.05 * dt) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
        this.lastDist = Math.min(this.lastDist, remaining);
        if (this.stuckT > 3) {
          const end = this.path[this.path.length - 1];
          this.x = end[0]; this.z = end[1]; this.path = []; this.arrived = true; this.navFallbacks++; this.stuckT = 0;
          this.state = 'idle';
        }
      }
    } else {
      this.speed = Math.max(0, this.speed - 9 * dt);
    }

    // orientation and gaze
    const speaker = ctx.speakerId && ctx.speakerId !== this.id ? ctx.agents.get(ctx.speakerId) : undefined;
    let lookAt: Vec2 | undefined;
    if (this.combatTarget) lookAt = this.posOf(this.combatTarget, ctx);
    else if (this.speech) {
      lookAt = this.posOf(this.faceTarget, ctx);
      if (!lookAt) { const o = ctx.focusId ? ctx.agents.get(ctx.focusId) : undefined; if (o && o !== this && o.active) lookAt = [o.x, o.z]; }
    } else if (speaker?.active && speaker.speech) {
      lookAt = [speaker.x, speaker.z];
      if (this.state === 'idle') this.state = 'listening';
    } else {
      lookAt = this.posOf(this.faceTarget, ctx);
      if (this.state === 'listening') this.state = 'idle';
    }
    // utility-selected idle behaviour (small autonomous life)
    if (this.clock > this.idleBehavior.until && this.speed < 0.2 && !this.speech) {
      const p = this.def.personality;
      const name = pickWeighted<'sway' | 'glance' | 'scan' | 'breathe' | 'fidget'>([
        { v: 'sway', w: 0.4 + p.expressiveness * 0.3 },
        { v: 'glance', w: 0.3 + p.curiosity * 0.5 + this.emo.fear },
        { v: 'scan', w: 0.15 + this.emo.fear * 1.2 + (this.emo.anger + this.emo.resolve) * 0.3 },
        { v: 'breathe', w: 0.6 + this.emo.sorrow },
        { v: 'fidget', w: 0.2 + (1 - p.bravery) * 0.4 + this.emo.fear * 0.5 },
      ], ctx.rng);
      this.idleBehavior = { name, until: this.clock + 2 + ctx.rng() * 3, dir: ctx.rng() < 0.5 ? -1 : 1 };
    }
    let wantRel = 0, wantPitch = 0;
    if (lookAt) {
      const want = Math.atan2(lookAt[0] - this.x, lookAt[1] - this.z);
      wantRel = wrap(want - this.yaw);
      if (this.speed < 0.3 && this.stance !== 'down' && !this.dashing) {
        const lim = this.combatTarget ? 0.15 : 0.9;
        if (Math.abs(wantRel) > lim) {
          const turn = clamp(wantRel, -2.6 * dt, 2.6 * dt);
          this.yaw += turn; wantRel -= turn;
        }
      }
      wantPitch = this.stance === 'sit' ? 0.05 : 0;
    } else if (this.idleBehavior.name === 'glance') wantRel = 0.7 * this.idleBehavior.dir;
    else if (this.idleBehavior.name === 'scan') wantRel = Math.sin(this.clock * 1.3) * 0.8;
    const hy = clamp(wantRel, -1.0, 1.0);
    const kk = Math.min(1, dt * 6);
    this.headYaw += (hy - this.headYaw) * kk;
    this.headPitch += ((this.faceParams().eyeOpen < 0.7 ? 0.25 : wantPitch) - this.headPitch) * kk;
    this.eyeYaw += (clamp(wantRel - hy, -0.4, 0.4) - this.eyeYaw) * Math.min(1, dt * 12);
    this.eyePitch += (0 - this.eyePitch) * kk;
    if (this.faceTarget && !this.speech && this.speed < 0.3 && !Array.isArray(this.faceTarget) && typeof this.faceTarget === 'string' && !this.combatTarget) {
      // keep body oriented to explicit face target
      const p = this.posOf(this.faceTarget, ctx);
      if (p) this.yaw += clamp(wrap(Math.atan2(p[0] - this.x, p[1] - this.z) - this.yaw), -2.6 * dt, 2.6 * dt);
    }
    if (this.aura) this.aura.level = Math.max(0, this.aura.level - dt * 0.6);
    this.markGlow += ((this.def.bearer ? 0.25 + this.emo.resolve * 0.5 + this.emo.anger * 0.4 + (this.aura?.level ?? 0) : 0) - this.markGlow) * Math.min(1, dt * 2);
  }
}
