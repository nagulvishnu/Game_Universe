// FilmRuntime: authoritative playback state machine. Simulation only — rendering reads from here.
import type { Beat, Emotion, FxItem, SceneDef, ShotHint, Vec2, Weather, WorldState } from '../engine/types';
import { NpcAgent, ANIM_DUR, type AgentCtx } from '../ai/npc';
import { CombatSim, type CombatEvent, type CombatPlan } from '../ai/combat';
import { bark } from '../ai/llm';
import { audio } from '../audio/audio';
import { planShot, combatShot } from '../camera/director';
import { CHARACTERS, CHAR_MAP } from '../story/characters';
import { SCENES, applyEffects, estimateScene, fastForward, missingPrereqs, newWorld } from '../story/orchestrator';
import { ENVS, type EnvData } from '../world/envData';
import { saveProgress } from './persistence';

export type Status = 'idle' | 'playing' | 'paused' | 'ended';
export interface Caption { who: string; name: string; text: string; emo: Emotion; off: boolean; quip?: boolean }
export interface EnvState { hour: number; targetHour: number; eclipse: number; targetEclipse: number; weather: Weather; flash: number; lightning: number; shake: number }
export interface SceneReport { id: string; title: string; act: number; estimated: number; actual: number; warnings: number; navFallbacks: number; completed: boolean; combatLog: number }
export interface Spark { x: number; y: number; z: number; color: string; n: number; speed: number }

function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

class FilmRuntime {
  scenes = SCENES;
  world: WorldState = newWorld();
  agents = new Map<string, NpcAgent>();
  status: Status = 'idle';
  sceneIdx = -1;
  beatIdx = 0;
  beatT = 0;
  sceneT = 0;
  totalT = 0;
  clock = 0;
  phase: 'intro' | 'run' | 'outro' = 'intro';
  phaseT = 0;
  fade = 1;
  caption: Caption | null = null;
  title: { text: string; sub?: string; t: number; dur: number } | null = null;
  shot: ShotHint = { k: 'establish' };
  shotT = 0;
  shotCuts = 0;
  env: EnvState = { hour: 12, targetHour: 12, eclipse: 0, targetEclipse: 0, weather: 'clear', flash: 0, lightning: 0, shake: 0 };
  fx: FxItem[] = [];
  sparks: Spark[] = [];
  destroyed = new Map<string, number>();
  combat: CombatSim | null = null;
  combatCount = 0;
  timeScale = 1;
  log: string[] = [];
  report: Record<string, SceneReport> = {};
  version = 0;
  restoredFrom: number | null = null;
  private listeners = new Set<() => void>();
  private beatEntered = false;
  private bs: Record<string, any> = {};
  private lineCount = 0;
  private slowT = 0;
  private quipT = 0;
  private lastBark = -10;
  private stormT = 6;
  private verT = 0;
  private timers: { at: number; fn: () => void }[] = [];
  rng: () => number = Math.random;
  ctx: AgentCtx;

  constructor() {
    CHARACTERS.forEach((c) => this.agents.set(c.id, new NpcAgent(c)));
    this.ctx = { agents: this.agents, env: ENVS.village, rng: () => this.rng() };
  }

  // ---- subscription -----------------------------------------------------
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  bump() { this.version++; this.listeners.forEach((l) => l()); }
  note(msg: string) { this.log.push(`[${this.scenes[this.sceneIdx]?.id ?? 'boot'} ${this.sceneT.toFixed(1)}s] ${msg}`); if (this.log.length > 400) this.log.shift(); }
  warn(msg: string) { const r = this.report[this.scenes[this.sceneIdx]?.id]; if (r) r.warnings++; this.note(`WARN ${msg}`); }

  get scene(): SceneDef | undefined { return this.scenes[this.sceneIdx]; }
  get envData(): EnvData { return ENVS[this.scene?.env ?? 'village']; }

  // ---- transport ----------------------------------------------------------
  start(idx = 0) {
    audio.init();
    audio.resume();
    this.totalT = idx === 0 ? 0 : this.totalT;
    if (idx === 0) this.report = {};
    this.jump(idx, true);
  }
  jump(idx: number, fresh = false) {
    idx = Math.max(0, Math.min(this.scenes.length - 1, idx));
    audio.stopVoice();
    if (!fresh && this.status === 'idle') audio.init();
    this.world = fastForward(this.scenes, idx);
    this.destroyed.clear(); this.fx = []; this.combat = null; this.timers = [];
    this.agents.forEach((a) => (a.active = false));
    this.status = 'playing';
    this.startScene(idx);
  }
  next() { if (this.sceneIdx < this.scenes.length - 1) this.jump(this.sceneIdx + 1); }
  prev() { this.jump(Math.max(0, this.sceneIdx - (this.sceneT > 4 ? 0 : 1))); }
  pause() { if (this.status === 'playing') { this.status = 'paused'; audio.pause(); this.bump(); } }
  resume() { if (this.status === 'paused') { this.status = 'playing'; audio.resume(); this.bump(); } }
  toggle() { this.status === 'playing' ? this.pause() : this.status === 'paused' ? this.resume() : this.start(0); }

  // ---- scene lifecycle ----------------------------------------------------
  private startScene(i: number) {
    const sc = this.scenes[i];
    this.sceneIdx = i; this.beatIdx = 0; this.beatT = 0; this.sceneT = 0; this.beatEntered = false; this.lineCount = 0;
    this.phase = 'intro'; this.phaseT = 0; this.fade = 1; this.caption = null; this.title = null; this.combat = null;
    this.rng = mulberry32(i * 977 + 13);
    this.ctx.env = ENVS[sc.env]; this.ctx.speakerId = undefined; this.ctx.focusId = undefined;
    this.report[sc.id] = { id: sc.id, title: sc.title, act: sc.act, estimated: estimateScene(sc), actual: 0, warnings: 0, navFallbacks: 0, completed: false, combatLog: 0 };
    this.note(`Scene start: ${sc.title}`);
    const missing = missingPrereqs(this.world, sc);
    if (missing.length) {
      this.warn(`Missing prerequisites ${missing.join(', ')} — rebuilding state from earlier scenes`);
      this.world = fastForward(this.scenes, i);
      const still = missingPrereqs(this.world, sc);
      if (still.length) this.warn(`Unsatisfiable prerequisites: ${still.join(', ')}`);
    }
    // environment
    this.env = { hour: sc.hour, targetHour: sc.hour, eclipse: sc.eclipse ?? 0, targetEclipse: sc.eclipse ?? 0, weather: sc.weather, flash: 0, lightning: 0, shake: 0 };
    this.setAmbience();
    audio.setMusic(sc.music);
    // cast
    this.agents.forEach((a) => { a.active = false; a.navFallbacks = 0; });
    const env = this.envData;
    sc.cast.forEach((c) => {
      if (this.world.dead.has(c.id)) { this.warn(`${c.id} is dead in world state but listed in cast — skipped`); return; }
      const a = this.agents.get(c.id);
      const m = env.marks[c.at];
      if (!a || !m) { this.warn(`cannot place ${c.id} at ${c.at}`); return; }
      const hp = this.world.hp[c.id] ?? 1;
      a.reset({
        x: m[0], z: m[1], yaw: 0, stance: c.stance ?? (hp < 0.4 ? 'wounded' : 'stand'), weapon: !!c.weapon, hp,
        injuries: this.world.injuries[c.id] ?? [], outfit: this.world.outfit[c.id] ?? 'travel', emo: c.emo ?? 'neutral',
      });
      a.relationships = JSON.parse(JSON.stringify(this.world.rel[c.id] ?? {}));
      a.knowledge = new Set(this.world.knowledge[c.id] ?? []);
      a.navFallbacks = 0;
    });
    sc.cast.forEach((c) => {
      const a = this.agents.get(c.id);
      if (!a?.active || !c.face) return;
      const p = this.posOf(c.face);
      if (p) { a.yaw = Math.atan2(p[0] - a.x, p[1] - a.z); a.faceTarget = c.face; }
    });
    saveProgress({ sceneIdx: i, totalT: this.totalT, report: this.report, savedAt: Date.now() }).catch(() => undefined);
    this.bump();
  }

  private setAmbience() {
    const sc = this.scene!; const w = this.env.weather;
    audio.setAmbience({
      wind: w === 'storm' ? 1 : w === 'ash' ? 0.6 : w === 'mist' ? 0.5 : sc.env === 'caverns' ? 0.1 : 0.3,
      rain: w === 'storm' ? 1 : w === 'rain' ? 0.8 : 0,
      drone: sc.env === 'caverns' || sc.env === 'temple' ? 0.7 : 0.15,
    });
  }

  private endScene() {
    const sc = this.scene!;
    const r = this.report[sc.id]; r.completed = true;
    // sync agent minds back into authoritative world state
    sc.cast.forEach((c) => {
      const a = this.agents.get(c.id); if (!a) return;
      this.world.rel[c.id] = JSON.parse(JSON.stringify(a.relationships));
      this.world.knowledge[c.id] = new Set([...(this.world.knowledge[c.id] ?? []), ...a.knowledge]);
    });
    // verify outcomes the story depends on instead of assuming success
    sc.effects.dead?.forEach((d) => {
      const a = this.agents.get(d);
      if (a?.active && a.stance !== 'down') { this.warn(`${d} was expected dead but is ${a.stance}; enforcing story outcome`); }
    });
    sc.requires.forEach((f) => { if (!this.world.facts.has(f)) this.warn(`prerequisite ${f} absent at scene end`); });
    applyEffects(this.world, sc);
    r.navFallbacks = [...this.agents.values()].reduce((s, a) => s + a.navFallbacks, 0);
    this.note(`Scene complete in ${r.actual.toFixed(1)}s (estimated ${r.estimated.toFixed(1)}s), warnings ${r.warnings}`);
  }

  // ---- helpers ------------------------------------------------------------
  posOf(t: string): Vec2 | undefined {
    const a = this.agents.get(t);
    if (a?.active) return [a.x, a.z];
    return this.envData.marks[t];
  }
  headOf = (id: string): [number, number, number] | undefined => {
    const a = this.agents.get(id);
    if (a?.active) {
      const s = a.def.height / 1.72;
      const h = a.stance === 'sit' ? 1.1 : a.stance === 'kneel' ? 1.02 : a.stance === 'down' ? 0.3 : a.stance === 'wounded' ? 1.42 : 1.56;
      return [a.x, h * s, a.z];
    }
    const m = this.envData.marks[id]; return m ? [m[0], 1.3, m[1]] : undefined;
  };
  facingOf = (id: string) => this.agents.get(id)?.yaw;
  allHeads = (): [number, number, number][] => [...this.agents.values()].filter((a) => a.active).map((a) => this.headOf(a.id)!);
  present() { return [...this.agents.values()].filter((a) => a.active).map((a) => a.id); }

  private setShot(s: ShotHint) { this.shot = s; this.shotT = 0; this.shotCuts++; }
  private later(delay: number, fn: () => void) { this.timers.push({ at: this.clock + delay, fn }); }

  // ---- fx -------------------------------------------------------------------
  private addFx(f: Partial<FxItem> & Pick<FxItem, 'kind' | 'x' | 'z' | 'color'>) {
    this.fx.push({ y: 1.1, yaw: 0, t: 0, dur: 0.8, size: 1, ...f });
    if (this.fx.length > 40) this.fx.shift();
  }
  private spark(x: number, y: number, z: number, color: string, n = 40, speed = 5) { this.sparks.push({ x, y, z, color, n, speed }); }
  private destroyAt(p: Vec2, radius: number) {
    let n = 0;
    this.envData.destructibles.forEach((d) => {
      if (this.destroyed.has(d.id)) return;
      if (Math.hypot(d.x - p[0], d.z - p[1]) < radius) { this.destroyed.set(d.id, this.clock); n++; this.spark(d.x, 1.5, d.z, '#b0a090', 60, 4); }
    });
    if (n) { audio.sfx('rumble', 0.7); this.env.shake = Math.max(this.env.shake, 0.8); this.agents.forEach((a) => a.active && a.react('quake', p, this.rng)); this.note(`Environmental destruction: ${n} props`); }
  }

  // ---- beat execution ----------------------------------------------------------
  private enterBeat(b: Beat) {
    this.bs = {}; this.beatT = 0;
    const sc = this.scene!; const env = this.envData;
    const dirCtx = () => ({ beat: b, scene: sc, beatIdx: this.beatIdx, present: this.present(), lineCount: this.lineCount, pos: (id: string) => this.posOf(id) });
    switch (b.t) {
      case 'line': {
        const def = CHAR_MAP[b.who];
        const a = this.agents.get(b.who);
        const onScreen = !!a?.active && !b.off;
        if (!b.off && !a?.active) this.warn(`${b.who} speaks but is not on stage`);
        const dur = this.estimate(b.text);
        this.bs.dur = dur;
        if (onScreen && a) {
          this.ctx.speakerId = b.who; this.ctx.focusId = b.to ?? undefined;
          a.faceTarget = b.to && this.agents.get(b.to)?.active ? b.to : undefined;
          a.say(b.text, dur * 0.92, b.emo ?? 'neutral', b.g, this.ctx, sc.id, this.sceneT);
          this.agents.forEach((o) => {
            if (o === a || !o.active) return;
            o.hear(b.who, b.text, b.emo ?? 'neutral', sc.id, this.sceneT);
            if (!b.to || b.to === o.id) o.faceTarget = b.who;
          });
          this.lineCount++;
        } else this.ctx.speakerId = undefined;
        if (b.reveals) b.reveals.forEach((f) => {
          this.world.facts.add(f);
          this.agents.forEach((o) => { if (o.active) { o.knowledge.add(f); (this.world.knowledge[o.id] ??= new Set()).add(f); } });
        });
        this.world.history.push({ scene: sc.id, who: b.who, text: b.text, emo: b.emo });
        this.caption = { who: b.who, name: def?.name ?? b.who, text: b.text, emo: b.emo ?? 'neutral', off: !onScreen };
        this.quipT = 0;
        audio.onBoundary = (idx) => {
          const s = a?.speech; if (s) s.t = Math.max(s.t, Math.min(s.dur, (idx / Math.max(1, s.text.length)) * s.dur));
        };
        this.bs.tts = def ? audio.speak(b.who, b.text, def.voice) : false;
        this.setShot(planShot(dirCtx()));
        break;
      }
      case 'move': {
        const moved: string[] = [];
        Object.entries(b.to).forEach(([id, mark]) => {
          const a = this.agents.get(id); const p = env.marks[mark];
          if (!a?.active || !p) { this.warn(`move: ${id}→${mark} impossible`); return; }
          a.goTo(p, env, !!b.run); a.goalText = `Go to ${mark}`; a.faceTarget = undefined; moved.push(id);
        });
        this.bs.moved = moved;
        this.setShot(planShot(dirCtx()));
        break;
      }
      case 'enter': {
        const a = this.agents.get(b.who); const p0 = env.marks[b.from]; const p1 = env.marks[b.to];
        if (!a || !p0 || !p1) { this.warn(`enter ${b.who} failed`); break; }
        if (this.world.dead.has(b.who)) { this.warn(`${b.who} is dead and cannot enter`); break; }
        if (!a.active) {
          const hp = this.world.hp[b.who] ?? 1;
          a.reset({ x: p0[0], z: p0[1], yaw: Math.atan2(p1[0] - p0[0], p1[1] - p0[1]), stance: 'stand', weapon: false, hp, injuries: this.world.injuries[b.who] ?? [], outfit: this.world.outfit[b.who] ?? 'travel', emo: 'neutral' });
          a.relationships = JSON.parse(JSON.stringify(this.world.rel[b.who] ?? {}));
        }
        a.goTo(p1, env, !!b.run); a.goalText = `Enter to ${b.to}`; this.bs.moved = [b.who];
        this.setShot(planShot(dirCtx()));
        break;
      }
      case 'exit': {
        const a = this.agents.get(b.who); const p = env.marks[b.via];
        if (!a?.active || !p) { this.warn(`exit ${b.who} failed`); this.bs.moved = []; break; }
        a.goTo(p, env, !!b.run); a.goalText = 'Leave'; this.bs.moved = [b.who];
        this.setShot(planShot(dirCtx()));
        break;
      }
      case 'act': {
        const a = this.agents.get(b.who);
        if (!a?.active) { this.warn(`act ${b.anim}: ${b.who} not on stage`); this.bs.dur = 0; break; }
        const dur = b.dur ?? ANIM_DUR[b.anim];
        this.bs.dur = dur;
        if (b.at) a.faceTarget = b.at;
        if (b.emo) a.feel(b.emo, 0.7);
        if (b.anim === 'stand_up') {
          if (a.stance !== 'kneel' && a.stance !== 'down' && a.stance !== 'wounded') this.warn(`${a.id} stand_up while ${a.stance}`);
          a.stance = 'stand'; if (a.def.bearer) a.hp = Math.max(a.hp, 0.75);
        } else if (b.anim === 'kneel_down') a.stance = 'kneel';
        else if (b.anim === 'collapse') { a.perform('hit', 0.5); a.stance = 'down'; a.state = 'down'; }
        else if (b.anim === 'draw') a.weaponDrawn = true;
        if (b.anim !== 'collapse') a.perform(b.anim, dur);
        a.goalText = `Perform ${b.anim}`;
        if (b.anim === 'cast' || b.anim === 'raise' || b.anim === 'blast') a.aura = { color: a.def.outfit.accent, level: 1.2 };
        this.setShot(planShot(dirCtx()));
        break;
      }
      case 'stance': {
        const a = this.agents.get(b.who); if (!a?.active) { this.warn(`stance ${b.who} not on stage`); break; }
        a.stance = b.stance; if (b.weapon !== undefined) a.weaponDrawn = b.weapon;
        else if (b.stance === 'stand') a.weaponDrawn = a.weaponDrawn && false;
        if (b.stance === 'down') a.state = 'down';
        if (b.emo) a.feel(b.emo, 0.6);
        break;
      }
      case 'face': {
        const a = this.agents.get(b.who); if (a?.active) a.faceTarget = b.at; break;
      }
      case 'shot': this.setShot(b.shot); break;
      case 'fx': this.doFx(b); break;
      case 'title': this.title = { text: b.text, sub: b.sub, t: 0, dur: b.dur }; this.setShot({ k: 'establish', move: 'crane' }); break;
      case 'wait': this.setShot(planShot(dirCtx())); break;
      case 'combat': this.enterCombat(b); break;
    }
    this.bump();
  }

  private estimate(text: string) { return 0.8 + text.trim().split(/\s+/).length * 0.36; }

  private doFx(b: Extract<Beat, { t: 'fx' }>) {
    const p = b.at ? this.posOf(b.at) : b.who ? this.posOf(b.who) : undefined;
    switch (b.k) {
      case 'lightning': this.env.lightning = 1; this.later(0.35, () => { audio.sfx('thunder'); this.agents.forEach((a) => a.active && this.rng() < 0.6 && a.react('thunder', undefined, this.rng)); }); break;
      case 'flash': this.env.flash = 1; break;
      case 'shake': this.env.shake = Math.max(this.env.shake, b.amount ?? 0.5); break;
      case 'eclipse': this.env.targetEclipse = typeof b.to === 'number' ? b.to : 0; break;
      case 'weather': this.env.weather = (b.name as Weather) ?? 'clear'; this.setAmbience(); break;
      case 'music': audio.setMusic((b.name as any) ?? 'silence'); break;
      case 'sfx': audio.sfx(b.name ?? 'whoosh'); break;
      case 'time': this.env.targetHour = typeof b.to === 'number' ? b.to : 12; break;
      case 'burn': this.world.facts.add(b.name ?? 'village_burned'); this.note(`World state: ${b.name ?? 'village_burned'}`); break;
      case 'burst':
        if (p) { this.addFx({ kind: 'burst', x: p[0], z: p[1], color: b.color ?? '#fff', dur: 1.1, size: 2.2 }); this.addFx({ kind: 'ring', x: p[0], z: p[1], y: 0.15, color: b.color ?? '#fff', dur: 1.2, size: 4 }); this.spark(p[0], 1.2, p[1], b.color ?? '#fff', 90, 6); this.env.flash = Math.max(this.env.flash, 0.35); }
        break;
      case 'aura': {
        const a = this.agents.get(b.who ?? ''); if (a?.active) { a.aura = { color: b.color ?? '#ffd27a', level: 1.6 }; a.markGlow = 1.2; this.addFx({ kind: 'pillar', x: a.x, z: a.z, y: 0, color: b.color ?? '#ffd27a', dur: 1.8, size: 1.3 }); }
        break;
      }
      case 'destroy': if (p) { this.destroyAt(p, b.amount ?? 6); this.spark(p[0], 0.5, p[1], '#a09080', 100, 6); } break;
      case 'vanish': {
        const a = this.agents.get(b.who ?? ''); if (a?.active) {
          this.addFx({ kind: 'pillar', x: a.x, z: a.z, y: 0, color: '#b04dff', dur: 1.5, size: 1.6 }); this.spark(a.x, 1.2, a.z, '#b04dff', 100, 4); audio.sfx('magic'); a.active = false;
        }
        break;
      }
    }
  }

  // ---- combat ----------------------------------------------------------------
  private enterCombat(b: Extract<Beat, { t: 'combat' }>) {
    const env = this.envData; const center = env.marks[b.arena ?? 'c'] ?? env.marks.c;
    const plan: CombatPlan = { sides: b.sides, winner: b.winner, dur: b.dur, end: b.end, center };
    const homes = CombatSim.homePositions(plan);
    this.bs.plan = plan; this.bs.phase = 'setup'; this.bs.homes = homes;
    const all = [...b.sides[0], ...b.sides[1]];
    all.forEach((id) => {
      const a = this.agents.get(id);
      if (!a?.active) { this.warn(`combat: ${id} not on stage`); return; }
      if (a.stance !== 'down' && a.stance !== 'kneel') { a.stance = 'combat'; }
      a.weaponDrawn = true; a.goTo(homes[id], env, true); a.goalText = 'Take combat position';
    });
    this.agents.forEach((o) => { if (o.active && !all.includes(o.id)) { o.faceTarget = all[0]; o.goalText = 'Watch the fight'; } });
    this.setShot({ k: 'wide', on: [], move: 'orbit' });
    this.note(`Combat ${b.id} start (winner: ${b.winner})`);
    this.combatCount = 0;
  }

  private onCombat = (e: CombatEvent) => {
    const rep = this.report[this.scene!.id]; if (rep) rep.combatLog++;
    const plan = this.bs.plan as CombatPlan;
    const fc = plan.sides[0].length + plan.sides[1].length;
    const cs = combatShot(e, this.combatCount, fc);
    if (e.k === 'windup') {
      this.combatCount++;
      this.ctx.focusId = e.who;
      this.agents.forEach((o) => { if (o.active && o.id !== e.who && !plan.sides.flat().includes(o.id)) o.faceTarget = e.who; });
      if (e.ability.kind !== 'melee') audio.sfx('magic', 0.6); else audio.sfx('whoosh', 0.6);
    }
    if (cs) this.setShot(cs);
    const A = this.agents.get('who' in e ? e.who : '');
    if (e.k === 'impact') {
      const x = e.x, z = e.z;
      if (e.result === 'hit') {
        this.addFx({ kind: 'burst', x, z, y: 1.2, color: e.ability.color, dur: 0.5, size: 1 + e.ability.dmg * 4 });
        this.addFx({ kind: 'arc', x: e.ax, z: e.az, y: 1.1, yaw: Math.atan2(x - e.ax, z - e.az), color: e.ability.color, dur: 0.4, size: 1.2 + e.ability.dmg * 4, x2: x, z2: z });
        this.spark(x, 1.2, z, e.ability.color, 40, 5);
        audio.sfx(e.ability.sfx, 0.7); audio.sfx('hit', 0.8);
        this.env.shake = Math.max(this.env.shake, e.ability.ult ? 1.0 : 0.35);
      } else if (e.result === 'parry') {
        this.addFx({ kind: 'ring', x, z, y: 1.2, color: '#ffffff', dur: 0.4, size: 1.6 }); this.spark(x, 1.2, z, '#ffe9a8', 50, 6); audio.sfx('clash'); this.env.shake = Math.max(this.env.shake, 0.2);
      } else { audio.sfx('whoosh', 0.8); this.addFx({ kind: 'arc', x: e.ax, z: e.az, y: 1.1, yaw: Math.atan2(x - e.ax, z - e.az), color: e.ability.color, dur: 0.35, size: 1.2, x2: x, z2: z }); }
      if (e.ability.kind === 'ranged') this.addFx({ kind: 'beam', x: e.ax, z: e.az, x2: x, z2: z, y: 1.3, color: e.ability.color, dur: 0.35, size: 0.18 });
      if (e.ability.kind === 'aoe' && e.result === 'hit') {
        this.addFx({ kind: 'ring', x, z, y: 0.1, color: e.ability.color, dur: 1.1, size: 6 }); this.spark(x, 0.6, z, e.ability.color, 120, 7);
        this.destroyAt([x, z], 4.5);
      }
      this.maybeBark(e);
    }
    if (e.k === 'finish') {
      this.slowT = 0.9; this.env.shake = 1.2; this.env.flash = Math.max(this.env.flash, 0.5);
      this.addFx({ kind: 'ring', x: e.x, z: e.z, y: 0.1, color: e.ability.color, dur: 1.4, size: 8 }); this.addFx({ kind: 'burst', x: e.x, z: e.z, y: 1.2, color: e.ability.color, dur: 0.9, size: 3 });
      this.spark(e.x, 1.2, e.z, e.ability.color, 160, 8); audio.sfx('impact_low'); audio.sfx(e.ability.sfx);
      this.destroyAt([e.x, e.z], 3.5);
    }
    if (e.k === 'clash') {
      this.addFx({ kind: 'ring', x: e.x, z: e.z, y: 1.1, color: '#ffffff', dur: 1.0, size: 7 }); this.spark(e.x, 1.1, e.z, '#fff2b0', 150, 8); audio.sfx('clash'); audio.sfx('burst', 0.6);
      this.env.shake = 1.4; this.slowT = 0.6; this.destroyAt([e.x, e.z], 5);
    }
    void A;
  };

  private maybeBark(e: Extract<CombatEvent, { k: 'impact' }>) {
    if (this.clock - this.lastBark < 3.8 || this.rng() > 0.4) return;
    const who = this.agents.get(e.result === 'hit' ? e.target : e.who); if (!who) return;
    const kind = e.result === 'hit' ? (e.ability.ult ? 'ult' : who.id === e.target ? 'hurt' : 'hit') : e.result;
    const speaker = e.result === 'hit' && kind === 'hurt' ? who : this.agents.get(e.who)!;
    this.lastBark = this.clock;
    bark(speaker.def, kind as any, `${e.who} used ${e.ability.name} on ${e.target}: ${e.result}`, this.rng).then((t) => {
      if (!t || this.status === 'ended' || !this.bs.plan) return;
      this.caption = { who: speaker.id, name: speaker.def.name, text: t, emo: 'anger', off: false, quip: true };
      this.quipT = 2.2; speaker.say(t, 1.2, 'anger', 'fist', this.ctx, this.scene!.id, this.sceneT);
      this.bump();
    });
  }

  private tickCombat(b: Extract<Beat, { t: 'combat' }>, dt: number): boolean {
    const bs = this.bs;
    if (bs.phase === 'setup') {
      const ids = [...b.sides[0], ...b.sides[1]].filter((id) => this.agents.get(id)?.active);
      const ready = ids.every((id) => this.agents.get(id)!.arrived) || this.beatT > 5;
      if (!ready) return false;
      ids.forEach((id) => {
        const a = this.agents.get(id)!; if (!a.arrived) { a.x = bs.homes[id][0]; a.z = bs.homes[id][1]; a.arrived = true; a.path = []; this.warn(`combat setup teleport ${id}`); }
        const enemy = (b.sides[0].includes(id) ? b.sides[1] : b.sides[0]).find((e) => this.agents.get(e)?.active);
        a.combatTarget = enemy; a.state = 'fighting';
        if (a.stance === 'kneel' || a.stance === 'down') { a.stance = 'combat'; }
      });
      bs.sim = new CombatSim(bs.plan, this.ctx, this.onCombat); bs.phase = 'fight';
      this.combat = bs.sim;
      return false;
    }
    if (bs.phase === 'fight') {
      (bs.sim as CombatSim).update(dt);
      if ((bs.sim as CombatSim).done) { bs.phase = 'after'; bs.after = 0; }
      return false;
    }
    bs.after += dt;
    return bs.after > 1.0;
  }

  private finishCombat(b: Extract<Beat, { t: 'combat' }>) {
    const sim = this.bs.sim as CombatSim | undefined; this.combat = null;
    const winners = b.winner === 'draw' ? [] : b.sides[b.winner];
    [...b.sides[0], ...b.sides[1]].forEach((id) => {
      const a = this.agents.get(id); if (!a?.active) return;
      a.combatTarget = undefined; a.dashing = null; a.aura = null;
      const isWinner = winners.includes(id);
      if (isWinner) { a.stance = 'stand'; a.state = 'idle'; a.hp = Math.max(a.hp, 0.3); }
      else if (b.end === 'down' && a.stance !== 'down') { a.stance = 'down'; a.hp = 0.05; }
      else if (b.end === 'kneel') { a.stance = 'kneel'; a.hp = Math.max(a.hp, 0.1); }
      else if (b.end === 'draw') { a.stance = 'wounded'; }
      if (b.end !== 'down' || isWinner) a.state = 'idle';
      this.world.hp[id] = a.hp;
      a.faceTarget = undefined;
    });
    this.agents.forEach((o) => { if (o.active) o.faceTarget = undefined; });
    this.note(`Combat ${b.id} resolved: ${sim?.log.length ?? 0} exchanges`);
    this.ctx.focusId = undefined;
  }

  // ---- beat completion -----------------------------------------------------------
  private beatDone(b: Beat, dt: number): boolean {
    switch (b.t) {
      case 'line': {
        const dur = this.bs.dur as number;
        if (this.bs.tts) {
          if (this.bs.endAt === undefined && !audio.isSpeaking() && this.beatT > 0.8) this.bs.endAt = this.beatT + 0.4;
          if (this.bs.endAt !== undefined && this.beatT >= this.bs.endAt) return true;
          return this.beatT > dur * 2.4 + 3;
        }
        return this.beatT >= dur + 0.3;
      }
      case 'move': case 'enter': case 'exit': {
        const moved: string[] = this.bs.moved ?? [];
        const cap = b.t === 'move' ? b.cap ?? 12 : b.t === 'exit' ? 6 : 12;
        const arrived = moved.every((id) => this.agents.get(id)?.arrived);
        return arrived || this.beatT > cap;
      }
      case 'act': return this.beatT >= (this.bs.dur ?? 0);
      case 'combat': return this.tickCombat(b, dt);
      case 'title': return this.beatT >= b.dur;
      case 'wait': return this.beatT >= b.dur;
      default: return true;
    }
  }

  private finishBeat(b: Beat) {
    switch (b.t) {
      case 'line': {
        const a = this.agents.get(b.who); if (a) { a.speech = null; if (a.state === 'speaking') a.state = 'idle'; }
        if (audio.isSpeaking()) audio.stopVoice();
        this.caption = null; this.ctx.speakerId = undefined; break;
      }
      case 'move': case 'enter': case 'exit': {
        (this.bs.moved as string[] | undefined)?.forEach((id) => {
          const a = this.agents.get(id); if (!a?.active) return;
          if (!a.arrived) {
            if (b.t === 'move' && b.cap !== undefined) { /* intentional off-screen walk — allowed to continue */ }
            else { const p = a.path[a.path.length - 1]; if (p) { a.x = p[0]; a.z = p[1]; } a.path = []; a.arrived = true; a.navFallbacks++; this.warn(`${id} did not reach destination in time — snapped to goal`); }
          }
          if (b.t === 'exit') { a.active = false; }
        });
        break;
      }
      case 'title': this.title = null; break;
      case 'combat': this.finishCombat(b); break;
      default: break;
    }
  }

  // ---- main loop ------------------------------------------------------------------
  update(raw: number) {
    if (this.status !== 'playing') return;
    const rawDt = Math.min(raw, 0.1);
    if (this.slowT > 0) this.slowT -= rawDt;
    this.timeScale = this.slowT > 0 ? 0.35 : 1;
    const dt = rawDt * this.timeScale;
    this.clock += dt; this.totalT += rawDt; this.sceneT += rawDt;
    const rep = this.report[this.scene!.id]; if (rep) rep.actual += rawDt;
    const e = this.env;
    e.hour += Math.max(-0.5 * dt, Math.min(0.5 * dt, e.targetHour - e.hour));
    e.eclipse += Math.max(-0.12 * dt, Math.min(0.12 * dt, e.targetEclipse - e.eclipse));
    e.flash = Math.max(0, e.flash - dt * 2.2); e.lightning = Math.max(0, e.lightning - dt * 3.5); e.shake = Math.max(0, e.shake - dt * 1.6);
    if (e.weather === 'storm') { this.stormT -= dt; if (this.stormT < 0) { this.stormT = 6 + this.rng() * 8; e.lightning = 1; this.later(0.4, () => audio.sfx('thunder', 0.8)); } }
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.timers[i].at <= this.clock) this.timers.splice(i, 1)[0].fn();
    for (let i = this.fx.length - 1; i >= 0; i--) { this.fx[i].t += dt; if (this.fx[i].t > this.fx[i].dur) this.fx.splice(i, 1); }
    this.agents.forEach((a) => a.update(dt, this.ctx));
    this.shotT += dt;
    if (this.title) this.title.t += dt;
    if (this.quipT > 0) { this.quipT -= dt; if (this.quipT <= 0 && this.caption?.quip) { this.caption = null; this.bump(); } }

    if (this.phase === 'intro') {
      this.phaseT += rawDt; this.fade = Math.max(0, 1 - this.phaseT / 1.1);
      if (this.phaseT >= 0.9) this.phase = 'run';
    } else if (this.phase === 'run') {
      let guard = 0;
      let d = dt;
      while (guard++ < 30) {
        const b = this.scene!.beats[this.beatIdx];
        if (!b) { this.phase = 'outro'; this.phaseT = 0; this.endScene(); break; }
        if (!this.beatEntered) { this.enterBeat(b); this.beatEntered = true; }
        this.beatT += d; d = 0;
        if (this.beatDone(b, dt)) { this.finishBeat(b); this.beatIdx++; this.beatEntered = false; this.bump(); } else break;
      }
    } else {
      this.phaseT += rawDt; this.fade = Math.min(1, this.phaseT / 1.1);
      if (this.phaseT >= 1.2) {
        if (this.sceneIdx >= this.scenes.length - 1) { this.status = 'ended'; audio.setMusic('silence'); audio.stopVoice(); this.note('Film ended'); this.bump(); }
        else this.startScene(this.sceneIdx + 1);
      }
    }
    this.verT += rawDt;
    if (this.verT > 0.5) { this.verT = 0; this.bump(); }
  }

  // ---- reporting --------------------------------------------------------------------
  runtimeReport() {
    const rows = this.scenes.map((s) => this.report[s.id] ?? { id: s.id, title: s.title, act: s.act, estimated: estimateScene(s), actual: 0, warnings: 0, navFallbacks: 0, completed: false, combatLog: 0 });
    const est = rows.reduce((t, r) => t + r.estimated, 0);
    const act = rows.reduce((t, r) => t + r.actual, 0);
    return { rows, estimated: est, actual: act, completed: rows.filter((r) => r.completed).length };
  }
}

export const film = new FilmRuntime();
export type { FilmRuntime };
