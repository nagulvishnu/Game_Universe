import {
  ITEMS, REGIONS, SPECIES, STARTERS, STONE_PRICE, TOURNAMENT, TYPE_COLOR, TYPE_ICON, calcStats, formAt, getMove, isPhysical,
  maxHp, movesOf, rootOf, stoneName, typeMult, xpNeed, type Mon, type Move, type Stats, type TypeId,
} from './data';
import { drawMonster, drawOrb, drawPerson, drawStar, mix, type PersonColors } from './art';
import { DX, DY, T, TILE, genRegion, isSolid, renderMap, type RegionMap, type Trainer } from './world';
import { sfx } from './audio';

export const W = 720;
export const H = 480;

export type Screen = 'title' | 'starter' | 'world' | 'battle' | 'gameover' | 'victory';
export type MenuId = null | 'party' | 'bag' | 'shop' | 'pause' | 'scores' | 'help';

export interface Player {
  name: string; party: Mon[]; box: Mon[]; money: number; items: Record<string, number>; stones: string[];
  badges: boolean[]; region: number; x: number; y: number; dir: number; score: number; starter: string;
  dex: string[]; defeated: Record<string, boolean>; picked: Record<string, boolean>; runId: string;
  steps: number; caught: number; wins: number; tournament: number; won: boolean; seenFirst: boolean;
}
export interface ScoreEntry { id: string; name: string; score: number; badges: number; starter: string; date: number; won: boolean; lvl: number }

interface Vis { x: number; y: number; sc: number; alpha: number; flash: number; hp: number; xp: number; squash: number }
export type BattleKind = 'wild' | 'trainer' | 'gym' | 'tournament';
export interface Battle {
  kind: BattleKind; enemies: Mon[]; ei: number; pi: number;
  trainer?: { name: string; cls: string; prize: number; id?: string; region?: number };
  msg: string; phase: 'intro' | 'menu' | 'anim' | 'forceSwitch' | 'over';
  mega: { uid: string | null; turns: number; used: boolean };
  vp: Vis; ve: Vis;
  orb: { k: number; rot: number; sc: number; open: number; color: string; glow: number; y: number; x: number; fromX: number; fromY: number } | null;
  evo: { sp: string; flash: number } | null; part: Set<string>; tutorial: boolean; turn: number;
}
export type BattleAction =
  | { t: 'move'; i: number } | { t: 'orb'; id: string } | { t: 'item'; id: string } | { t: 'switch'; idx: number } | { t: 'run' };

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string;
  shape: 'circle' | 'square' | 'star' | 'spark' | 'ring' | 'leaf'; rot: number; vr: number; g: number; drag: number; grow: number;
}
interface Floater { x: number; y: number; text: string; color: string; size: number; t: number; max: number; vy: number }

type EaseName = 'lin' | 'out' | 'inout' | 'bounce' | 'back';
const EASE: Record<EaseName, (x: number) => number> = {
  lin: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inout: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  bounce: (x) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  },
  back: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
};

const EP = { x: 520, y: 252 };
const PP = { x: 190, y: 414 };
const EC = { x: 520, y: 170 };
const PC = { x: 190, y: 300 };

const FX: Record<TypeId, { colors: string[]; shape: Particle['shape']; g: number; speed: number }> = {
  fire: { colors: ['#ff5a1f', '#ff9a2f', '#ffe066'], shape: 'circle', g: -120, speed: 150 },
  water: { colors: ['#3d9bff', '#8ad0ff', '#ffffff'], shape: 'circle', g: 260, speed: 190 },
  electric: { colors: ['#ffe23a', '#fff6a8', '#ffffff'], shape: 'spark', g: 0, speed: 380 },
  grass: { colors: ['#5fcf4e', '#3aa84a', '#b8f58a'], shape: 'leaf', g: 60, speed: 200 },
  ice: { colors: ['#8fe3ff', '#ffffff', '#c8f4ff'], shape: 'square', g: 140, speed: 200 },
  fighting: { colors: ['#ff4a3a', '#ffffff', '#ffb347'], shape: 'star', g: 0, speed: 250 },
  poison: { colors: ['#b05ad6', '#7a2a9a', '#e6b3ff'], shape: 'circle', g: -40, speed: 130 },
  ground: { colors: ['#d4a64f', '#8a6a30', '#e8d090'], shape: 'square', g: 520, speed: 230 },
  flying: { colors: ['#ffffff', '#cfe0ff', '#9fb4ff'], shape: 'spark', g: 0, speed: 320 },
  psychic: { colors: ['#ff6fb5', '#ffb0dd', '#ffffff'], shape: 'ring', g: 0, speed: 120 },
  rock: { colors: ['#a89868', '#6a5a3a', '#d6c8a0'], shape: 'square', g: 620, speed: 220 },
  steel: { colors: ['#c9d4e0', '#ffffff', '#8a9aab'], shape: 'spark', g: 0, speed: 340 },
  dragon: { colors: ['#6a5cff', '#a89cff', '#ffe28a'], shape: 'star', g: 0, speed: 260 },
  normal: { colors: ['#ffffff', '#dddddd', '#ffe9a8'], shape: 'star', g: 0, speed: 220 },
};

const SAVE_KEY = 'mq_save_v1';
const SCORE_KEY = 'mq_scores_v1';
export function loadScores(): ScoreEntry[] {
  try { return JSON.parse(localStorage.getItem(SCORE_KEY) || '[]'); } catch { return []; }
}
let uidN = 1;
const uid = () => `m${Date.now().toString(36)}${(uidN++).toString(36)}`;
export function mkMon(sp: string, level: number): Mon {
  const m: Mon = { uid: uid(), sp, level, xp: 0, hp: 1 };
  m.hp = maxHp(m);
  return m;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const PLAYER_COL: PersonColors = { skin: '#f2c9a0', shirt: '#3c7ae8', pants: '#2b2f4a', hat: '#e8453c', hair: '#3a2a20' };

export class Game {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; dpr = 1;
  t = 0; last = 0; raf = 0; running = false;
  listeners = new Set<() => void>(); ver = 0;
  screen: Screen = 'title'; menu: MenuId = null; paused = false;
  p: Player | null = null; name = 'Hero';
  regionIdx = 0; map!: RegionMap; mapCv: HTMLCanvasElement | null = null;
  mv = { active: false, fx: 0, fy: 0, tx: 0, ty: 0, t: 0, dur: 0.17 };
  fol = { x: 0, y: 0, tx: 0, ty: 0, face: 1 };
  walkPhase = 0; keys: number[] = []; touchDir = -1; run = false; busy = false; stepsSince = 0; stepFlip = 0;
  parts: Particle[] = []; floaters: Floater[] = [];
  timers: { t: number; res: () => void }[] = [];
  tweens: { o: Record<string, number>; k: string; from: number; to: number; t: number; dur: number; ease: EaseName; res: () => void }[] = [];
  shake = 0; flashA = 0; flashC = '#ffffff'; hitstop = 0;
  trans: { t: number; dur: number; dir: 'in' | 'out' } | null = null;
  b: Battle | null = null;
  toasts: { id: number; text: string; t: number; kind: string }[] = []; toastId = 1;
  banner: { text: string; sub: string; t: number; color: string } | null = null;
  lastGateToast = 0; shopDoor = false; tournamentActive = false;
  bgMons: { sp: string; x: number; y: number; v: number; s: number; ph: number }[] = [];
  vignette: HTMLCanvasElement | null = null;
  lastScoreId = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    const ids = Object.keys(SPECIES);
    for (let i = 0; i < 7; i++) this.bgMons.push({ sp: ids[Math.floor(Math.random() * ids.length)], x: Math.random() * W, y: 300 + Math.random() * 150, v: rnd(10, 30) * (Math.random() < 0.5 ? -1 : 1), s: rnd(70, 130), ph: Math.random() * 9 });
  }

  // ---------- plumbing ----------
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  emit() { this.ver++; this.listeners.forEach((f) => f()); }
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.dpr); this.canvas.height = Math.round(H * this.dpr);
  }
  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  wait(sec: number) { return new Promise<void>((res) => { this.timers.push({ t: sec, res }); }); }
  tween(o: object, k: string, to: number, dur: number, ease: EaseName = 'out') {
    return new Promise<void>((res) => {
      const ob = o as Record<string, number>;
      this.tweens.push({ o: ob, k, from: ob[k], to, t: 0, dur, ease, res });
    });
  }
  cancelFlows() { this.timers = []; this.tweens = []; this.busy = false; this.trans = null; }

  toast(text: string, kind = 'info') {
    this.toasts.push({ id: this.toastId++, text, t: 2.6, kind });
    if (this.toasts.length > 4) this.toasts.shift();
    this.emit();
  }
  addScore(n: number) { if (this.p) { this.p.score += Math.round(n); this.emit(); } }

  // ---------- persistence ----------
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  save() { if (this.p && !this.p.won) try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.p)); } catch { /* ignore */ } }
  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
  recordScore() {
    const p = this.p; if (!p || p.score <= 0) return;
    const list = loadScores();
    const e: ScoreEntry = { id: p.runId, name: p.name, score: p.score, badges: p.badges.filter(Boolean).length, starter: p.starter, date: Date.now(), won: p.won, lvl: Math.max(...[...p.party, ...p.box].map((m) => m.level)) };
    const i = list.findIndex((x) => x.id === e.id);
    if (i >= 0) list[i] = e; else list.push(e);
    list.sort((a, b) => b.score - a.score);
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(list.slice(0, 10))); } catch { /* ignore */ }
    this.lastScoreId = e.id;
  }

  // ---------- game flow ----------
  newGame(name?: string) {
    this.cancelFlows();
    if (this.p) this.recordScore();
    if (name !== undefined) this.name = name.trim() || 'Hero';
    this.p = {
      name: this.name, party: [], box: [], money: 500, items: { orb: 5, potion: 3 }, stones: [], badges: Array(8).fill(false),
      region: 0, x: 6, y: 8, dir: 0, score: 0, starter: '', dex: [], defeated: {}, picked: {}, runId: uid(),
      steps: 0, caught: 0, wins: 0, tournament: 0, won: false, seenFirst: false,
    };
    this.b = null; this.menu = null; this.paused = false; this.parts = []; this.floaters = [];
    this.screen = 'starter'; sfx.select(); this.emit();
  }
  restart() { this.newGame(); }
  toTitle() { this.cancelFlows(); this.recordScore(); this.p = null; this.b = null; this.menu = null; this.paused = false; this.screen = 'title'; this.emit(); }
  continueGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;
      this.cancelFlows();
      this.p = JSON.parse(raw) as Player;
      this.name = this.p.name;
      this.b = null; this.menu = null; this.paused = false; this.screen = 'world';
      this.loadRegion(this.p.region, { x: this.p.x, y: this.p.y });
      sfx.select(); this.emit();
    } catch { this.clearSave(); }
  }
  pickStarter(id: string) {
    const p = this.p; if (!p || this.screen !== 'starter') return;
    const m = mkMon(id, 5);
    p.party = [m]; p.starter = id; p.dex = [id];
    this.screen = 'world'; this.paused = false; this.menu = null;
    this.loadRegion(0);
    sfx.levelUp();
    this.burst(p.x * TILE + 24, p.y * TILE + 20, { n: 30, colors: ['#ffe066', '#fff', '#ff9a9a'], shape: 'star', speed: 200, life: 0.8, size: 7 });
    this.toast(`${SPECIES[id].name} joins you! Walk into the tall grass!`, 'good');
    this.emit();
  }
  loadRegion(i: number, at?: { x: number; y: number }) {
    const p = this.p!;
    this.regionIdx = i; p.region = i;
    this.map = genRegion(i);
    this.mapCv = renderMap(this.map, i, i < 8 && p.badges[i]);
    const s = at ?? this.map.spawn;
    p.x = s.x; p.y = s.y; p.dir = 2;
    this.mv.active = false; this.keys = []; this.stepsSince = 0;
    this.fol = { x: s.x - 1, y: s.y, tx: s.x - 1, ty: s.y, face: 1 };
    for (const tr of this.map.trainers) { tr.fx = tr.x; tr.fy = tr.y; tr.alert = 0; }
    this.parts = [];
    this.banner = { text: REGIONS[i].name.toUpperCase(), sub: i < 8 ? `Gym ${i + 1} · ${REGIONS[i].gymType.toUpperCase()} type` : 'The Championship awaits', t: 3, color: REGIONS[i].pal.accent };
    this.save(); this.emit();
  }
  leadIdx() { const p = this.p!; const i = p.party.findIndex((m) => m.hp > 0); return i < 0 ? 0 : i; }
  tileAt(x: number, y: number) { return x < 0 || y < 0 || x >= this.map.w || y >= this.map.h ? T.TREE : this.map.tiles[y * this.map.w + x]; }

  // ---------- input ----------
  dirOf(code: string) {
    switch (code) {
      case 'ArrowDown': case 'KeyS': return 0;
      case 'ArrowLeft': case 'KeyA': return 1;
      case 'ArrowRight': case 'KeyD': return 2;
      case 'ArrowUp': case 'KeyW': return 3;
    }
    return -1;
  }
  keyDown(e: KeyboardEvent): boolean {
    sfx.unlock();
    const d = this.dirOf(e.code);
    if (d >= 0) { if (!this.keys.includes(d)) this.keys.push(d); return this.screen === 'world'; }
    switch (e.code) {
      case 'ShiftLeft': case 'ShiftRight': this.run = true; return true;
      case 'Escape': case 'KeyP':
        if (e.repeat) return true;
        if (this.screen === 'world' || this.screen === 'battle') {
          if (this.menu && this.menu !== 'pause') this.closeMenu(); else this.togglePause();
        }
        return true;
      case 'KeyI': if (this.screen === 'world' && !this.busy && !this.paused) { this.openMenu(this.menu === 'bag' ? null : 'bag'); } return true;
      case 'KeyO': case 'Tab': if (this.screen === 'world' && !this.busy && !this.paused) { this.openMenu(this.menu === 'party' ? null : 'party'); } return true;
      case 'KeyR': if (this.screen === 'gameover' || (this.paused && this.menu === 'pause')) { this.restart(); return true; } return false;
    }
    return false;
  }
  keyUp(e: KeyboardEvent) {
    const d = this.dirOf(e.code);
    if (d >= 0) this.keys = this.keys.filter((k) => k !== d);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.run = false;
  }
  setTouchDir(d: number) { this.touchDir = d; sfx.unlock(); }
  inputDir() { return this.touchDir >= 0 ? this.touchDir : this.keys.length ? this.keys[this.keys.length - 1] : -1; }
  togglePause() {
    if (this.screen !== 'world' && this.screen !== 'battle') return;
    this.paused = !this.paused; this.menu = this.paused ? 'pause' : null; this.keys = []; sfx.select(); this.emit();
  }
  openMenu(m: MenuId) {
    if (this.busy && m !== 'pause') return;
    this.menu = m; this.keys = []; this.touchDir = -1; sfx.select(); this.emit();
  }
  closeMenu() {
    const was = this.menu;
    this.menu = null; this.paused = false; sfx.back();
    if (was === 'shop' && this.shopDoor) this.exitDoor();
    this.emit();
  }

  // ---------- main loop ----------
  frame(dt: number) {
    if (!this.paused) {
      let d = dt;
      if (this.hitstop > 0) { this.hitstop -= dt; d = dt * 0.05; }
      this.update(d);
    }
    this.render();
  }

  update(dt: number) {
    this.t += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i]; tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.res(); }
    }
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]; tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.o[tw.k] = tw.from + (tw.to - tw.from) * EASE[tw.ease](k);
      if (k >= 1) { this.tweens.splice(i, 1); tw.res(); }
    }
    if (this.trans) { this.trans.t += dt; }
    this.shake *= Math.exp(-dt * 9); if (this.shake < 0.2) this.shake = 0;
    this.flashA = Math.max(0, this.flashA - dt * 3);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.life -= dt;
      if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      q.vy += q.g * dt; const dr = Math.exp(-q.drag * dt); q.vx *= dr; q.vy *= dr;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.size += q.grow * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]; f.t += dt; f.y += f.vy * dt;
      if (f.t >= f.max) this.floaters.splice(i, 1);
    }
    let tc = false;
    for (let i = this.toasts.length - 1; i >= 0; i--) { this.toasts[i].t -= dt; if (this.toasts[i].t <= 0) { this.toasts.splice(i, 1); tc = true; } }
    if (tc) this.emit();
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    if (this.screen === 'world') this.updateWorld(dt);
    for (const m of this.bgMons) { m.x += m.v * dt; if (m.x > W + 100) m.x = -100; if (m.x < -100) m.x = W + 100; }
  }

  // ---------- particles ----------
  burst(x: number, y: number, o: { n?: number; colors?: string[]; shape?: Particle['shape']; speed?: number; life?: number; size?: number; g?: number; angle?: number; spread?: number; drag?: number; grow?: number }) {
    const n = o.n ?? 12, cols = o.colors ?? ['#fff'];
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2) + (o.spread === undefined ? Math.random() * 0 : 0);
      const sp = (o.speed ?? 150) * rnd(0.3, 1);
      const life = (o.life ?? 0.6) * rnd(0.6, 1.2);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: (o.size ?? 5) * rnd(0.6, 1.2),
        color: cols[Math.floor(Math.random() * cols.length)], shape: o.shape ?? 'circle', rot: Math.random() * 6, vr: rnd(-8, 8),
        g: o.g ?? 0, drag: o.drag ?? 1.5, grow: o.grow ?? 0,
      });
    }
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }
  floater(x: number, y: number, text: string, color = '#fff', size = 26, vy = -50, max = 1.1) {
    this.floaters.push({ x, y, text, color, size, t: 0, max, vy });
  }
  doShake(a: number) { this.shake = Math.max(this.shake, a); }
  doFlash(c = '#ffffff', a = 1) { this.flashA = a; this.flashC = c; }

  // ---------- world ----------
  updateWorld(dt: number) {
    for (const tr of this.map.trainers) if (tr.alert > 0 && !this.busy) tr.alert = 0;
    if (this.busy || this.menu || this.trans) return;
    const p = this.p!; const m = this.mv;
    if (!m.active) {
      this.walkPhase = 0;
      const d = this.inputDir();
      if (d >= 0) this.tryMove(d);
    } else {
      m.t += dt;
      this.walkPhase = (this.walkPhase + dt / (m.dur * 2)) % 1;
      if (m.t >= m.dur) {
        const over = m.t - m.dur;
        m.active = false; p.x = m.tx; p.y = m.ty; this.fol.x = this.fol.tx; this.fol.y = this.fol.ty;
        this.onArrive();
        if (!this.busy && !this.menu && this.screen === 'world') {
          const d = this.inputDir();
          if (d >= 0 && this.tryMove(d)) m.t = Math.min(over, m.dur * 0.9);
        }
      }
    }
  }
  trainerAt(x: number, y: number) { return this.map.trainers.find((t) => Math.round(t.fx) === x && Math.round(t.fy) === y); }
  tryMove(d: number): boolean {
    const p = this.p!; p.dir = d;
    const nx = p.x + DX[d], ny = p.y + DY[d];
    const tile = this.tileAt(nx, ny);
    let blocked = isSolid(tile) || !!this.trainerAt(nx, ny);
    if (tile === T.GATE && this.regionIdx < 8 && p.badges[this.regionIdx]) blocked = false;
    if (blocked) {
      if (tile === T.GATE && this.t - this.lastGateToast > 2.5) { this.lastGateToast = this.t; this.toast('The gate is locked. Beat the Gym Leader first!', 'warn'); sfx.error(); }
      else if (Math.random() < 0.3) sfx.bump();
      return false;
    }
    const m = this.mv;
    m.active = true; m.fx = p.x; m.fy = p.y; m.tx = nx; m.ty = ny; m.t = 0; m.dur = this.run ? 0.1 : 0.17;
    this.fol.tx = p.x; this.fol.ty = p.y;
    if (nx !== p.x) this.fol.face = nx > p.x ? 1 : -1;
    return true;
  }
  onArrive() {
    const p = this.p!;
    p.steps++;
    const tile = this.tileAt(p.x, p.y);
    const px = p.x * TILE + 24, py = p.y * TILE + 40;
    if (tile === T.DOOR_C) { void this.healAtCenter(); return; }
    if (tile === T.DOOR_M) { this.shopDoor = true; this.openMenu('shop'); return; }
    if (tile === T.DOOR_G) { void this.enterGym(); return; }
    if (tile === T.GATE) { this.nextRegion(); return; }
    if (tile === T.TALL) {
      sfx.grass();
      this.burst(px, py, { n: 7, colors: ['#5fcf4e', '#3aa84a', '#b8f58a'], shape: 'leaf', speed: 90, life: 0.5, size: 5, g: 60, angle: -Math.PI / 2, spread: 2.4 });
    } else {
      if ((this.stepFlip++ & 1) === 0) sfx.step();
      if (this.run) this.burst(px, py + 2, { n: 3, colors: ['#ffffff55'], speed: 30, life: 0.35, size: 6, grow: 10, drag: 3 });
    }
    const pk = this.map.pickups.find((q) => q.x === p.x && q.y === p.y && !p.picked[q.id]);
    if (pk) {
      p.picked[pk.id] = true; sfx.coin();
      if (pk.money) { p.money += pk.money; this.toast(`Found $${pk.money}!`, 'good'); }
      else if (pk.item) { p.items[pk.item] = (p.items[pk.item] || 0) + 1; this.toast(`Found ${ITEMS[pk.item].icon} ${ITEMS[pk.item].name}!`, 'good'); }
      this.burst(px, py - 10, { n: 18, colors: ['#ffe066', '#fff', '#ffb347'], shape: 'star', speed: 170, life: 0.7, size: 6 });
      this.addScore(60);
    }
    // trainers
    for (const tr of this.map.trainers) {
      if (p.defeated[tr.id]) continue;
      if (this.sees(tr)) { void this.trainerEncounter(tr); return; }
    }
    // wild
    if (tile === T.TALL && this.regionIdx < 8) {
      this.stepsSince++;
      const force = this.regionIdx === 0 && !p.seenFirst;
      if (force || (this.stepsSince >= 3 && Math.random() < 0.15)) { void this.startWild(force); }
    }
  }
  sees(tr: Trainer): boolean {
    const p = this.p!;
    const dx = p.x - tr.x, dy = p.y - tr.y;
    let f = 0, l = 0;
    switch (tr.dir) { case 0: f = dy; l = dx; break; case 1: f = -dx; l = dy; break; case 2: f = dx; l = dy; break; default: f = -dy; l = dx; }
    if (f < 1 || f > 5 || Math.abs(l) > 1) return false;
    for (let k = 1; k < f; k++) if (isSolid(this.tileAt(tr.x + DX[tr.dir] * k, tr.y + DY[tr.dir] * k))) return false;
    return true;
  }
  nextRegion() {
    const p = this.p!;
    this.busy = true;
    sfx.badge();
    void (async () => {
      await this.transition('in');
      this.loadRegion(this.regionIdx + 1);
      this.busy = false;
      await this.transition('out');
    })();
    void p;
  }
  exitDoor() {
    const p = this.p!;
    this.shopDoor = false;
    p.y += 1; p.dir = 0; this.mv.active = false;
    this.fol.x = p.x; this.fol.y = p.y - 1; this.fol.tx = this.fol.x; this.fol.ty = this.fol.y;
  }
  async healAtCenter() {
    const p = this.p!;
    this.busy = true; this.keys = [];
    sfx.heal();
    for (const m of [...p.party, ...p.box]) m.hp = maxHp(m);
    this.doFlash('#aaffcc', 0.6);
    for (let i = 0; i < 4; i++) {
      this.burst(p.x * TILE + 24, p.y * TILE + 30, { n: 10, colors: ['#ff7aa8', '#ffb0cc', '#fff'], shape: 'circle', speed: 110, life: 1, size: 6, g: -90, angle: -Math.PI / 2, spread: 2.2 });
      await this.wait(0.18);
    }
    this.toast('Your monsters are fully healed! 💖', 'good');
    this.save();
    this.exitDoor(); this.busy = false;
  }
  async enterGym() {
    const p = this.p!; const i = this.regionIdx;
    this.busy = true; this.keys = [];
    if (i === 8) {
      if (p.badges.filter(Boolean).length < 8) { this.toast('The Arena only opens to trainers with 8 badges.', 'warn'); this.exitDoor(); this.busy = false; return; }
      await this.startTournamentRound();
      return;
    }
    if (p.badges[i]) { this.toast('You already hold this badge. Head east!', 'info'); this.exitDoor(); this.busy = false; return; }
    const R = REGIONS[i];
    const base = 3 + i * 5;
    const team = R.gym.map((sp, k) => ({ sp, level: base + 3 + k + (k === R.gym.length - 1 ? 1 : 0) }));
    sfx.alert();
    this.toast(`${R.title} ${R.leader}: "${R.line}"`, 'warn');
    await this.wait(1.2);
    await this.startBattle({ kind: 'gym', enemies: team, trainer: { name: R.leader, cls: R.title, prize: 1500 + i * 500, region: i } });
  }
  async startTournamentRound() {
    const p = this.p!; const r = clamp(p.tournament, 0, 2); const R = TOURNAMENT[r];
    this.tournamentActive = true;
    const team = R.team.map((sp, k) => ({ sp, level: R.lvl + (k >= R.team.length - 1 ? 3 : 0) }));
    this.toast(`Round ${r + 1}/3 — ${R.name}: "${R.line}"`, 'warn');
    sfx.alert();
    await this.wait(1.3);
    await this.startBattle({ kind: 'tournament', enemies: team, trainer: { name: R.name, cls: R.cls, prize: 4000 + r * 2000, region: 8 } });
  }
  async trainerEncounter(tr: Trainer) {
    this.busy = true; this.keys = []; this.touchDir = -1;
    const p = this.p!;
    tr.alert = 1; sfx.alert();
    this.burst(tr.x * TILE + 24, tr.y * TILE - 10, { n: 8, colors: ['#ff4a3a', '#fff'], shape: 'star', speed: 100, life: 0.5, size: 5 });
    await this.wait(0.7);
    tr.alert = 1;
    let f = 0;
    switch (tr.dir) { case 0: f = p.y - tr.y; break; case 1: f = tr.x - p.x; break; case 2: f = p.x - tr.x; break; default: f = tr.y - p.y; }
    for (let k = 0; k < f - 1; k++) {
      const nx = tr.x + DX[tr.dir], ny = tr.y + DY[tr.dir];
      if (isSolid(this.tileAt(nx, ny))) break;
      this.tween(tr, 'fx', nx, 0.16, 'lin'); await this.tween(tr, 'fy', ny, 0.16, 'lin');
      tr.x = nx; tr.y = ny; sfx.step();
    }
    // face player
    const dx = p.x - tr.x, dy = p.y - tr.y;
    tr.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : dy > 0 ? 0 : 3;
    p.dir = tr.dir === 0 ? 3 : tr.dir === 3 ? 0 : tr.dir === 1 ? 2 : 1;
    this.toast(`${tr.name}: "${tr.line}"`, 'warn');
    await this.wait(0.9);
    tr.alert = 0;
    await this.startBattle({ kind: 'trainer', enemies: tr.team, trainer: { name: tr.name, cls: tr.cls, prize: tr.prize, id: tr.id } });
  }
  async startWild(first = false) {
    const p = this.p!; const R = REGIONS[this.regionIdx];
    this.busy = true; this.stepsSince = 0; this.keys = [];
    const base = 3 + this.regionIdx * 5;
    let sp: string, level: number;
    if (first) { sp = 'pidgel'; level = 3; p.seenFirst = true; }
    else {
      const pool = R.rare.length && Math.random() < 0.12 ? R.rare : R.pool;
      const root = pool[Math.floor(Math.random() * pool.length)];
      level = base + Math.floor(Math.random() * 4);
      sp = formAt(root, level);
    }
    await this.startBattle({ kind: 'wild', enemies: [{ sp, level }], tutorial: first });
  }

  // ---------- transitions ----------
  async transition(dir: 'in' | 'out', dur = 0.55) {
    this.trans = { t: 0, dur, dir };
    await this.wait(dur);
    if (dir === 'out') this.trans = null;
  }

  // ---------- battle setup ----------
  pm() { return this.p!.party[this.b!.pi]; }
  em() { return this.b!.enemies[this.b!.ei]; }
  isMega() { const b = this.b; return !!b && !!b.mega.uid && this.pm().uid === b.mega.uid; }
  mkVis(): Vis { return { x: 0, y: 0, sc: 1, alpha: 1, flash: 0, hp: 0, xp: 0, squash: 1 }; }
  nameOf(side: 'p' | 'e') {
    const b = this.b!;
    const m = side === 'p' ? this.pm() : this.em();
    const n = SPECIES[m.sp].name;
    return side === 'e' && b.kind === 'wild' ? `Wild ${n}` : n;
  }
  async say(text: string, ms = 750) {
    const b = this.b; if (!b) return;
    b.msg = text; this.emit();
    await this.wait(ms / 1000);
  }

  async startBattle(spec: { kind: BattleKind; enemies: { sp: string; level: number }[]; trainer?: Battle['trainer']; tutorial?: boolean }) {
    const p = this.p!;
    if (p.party.every((m) => m.hp <= 0)) { this.busy = false; return; }
    this.busy = true; this.menu = null;
    sfx.encounter(); this.doFlash('#ffffff', 0.7);
    await this.transition('in', 0.6);
    const enemies = spec.enemies.map((e) => mkMon(e.sp, e.level));
    const pi = this.leadIdx();
    this.b = {
      kind: spec.kind, enemies, ei: 0, pi, trainer: spec.trainer, msg: '', phase: 'intro',
      mega: { uid: null, turns: 0, used: false }, vp: this.mkVis(), ve: this.mkVis(), orb: null, evo: null,
      part: new Set(), tutorial: !!spec.tutorial, turn: 0,
    };
    const b = this.b;
    b.vp.sc = 0.01; b.ve.x = 380; b.ve.hp = enemies[0].hp;
    this.screen = 'battle'; this.parts = []; this.floaters = [];
    await this.transition('out', 0.4);
    const e = this.em();
    if (spec.kind === 'wild') {
      sfx.swoosh();
      this.tween(b.ve, 'x', 0, 0.45, 'out');
      await this.say(`A wild ${SPECIES[e.sp].name} appeared!`, 650);
    } else {
      this.tween(b.ve, 'x', 0, 0.45, 'out');
      await this.say(`${b.trainer!.cls} ${b.trainer!.name} wants to battle!`, 900);
      await this.say(`${b.trainer!.name} sent out ${SPECIES[e.sp].name}!`, 600);
    }
    await this.say(`Go, ${SPECIES[this.pm().sp].name}!`, 200);
    await this.sendOutPlayer();
    b.phase = 'menu'; b.msg = `What will ${SPECIES[this.pm().sp].name} do?`;
    this.busy = false; this.emit();
  }
  async sendOutPlayer() {
    const b = this.b!; const m = this.pm();
    Object.assign(b.vp, { x: 0, y: 0, sc: 0.01, alpha: 1, flash: 1, hp: m.hp, xp: m.xp / xpNeed(m.level), squash: 1 });
    b.part.add(m.uid);
    sfx.swoosh();
    this.burst(PC.x, PC.y + 50, { n: 28, colors: ['#ffffff', '#ffe066', '#ff9a9a'], shape: 'star', speed: 280, life: 0.6, size: 7 });
    this.tween(b.vp, 'flash', 0, 0.45);
    await this.tween(b.vp, 'sc', 1, 0.42, 'back');
  }
  async sendOutEnemy() {
    const b = this.b!; const e = this.em();
    Object.assign(b.ve, { x: 0, y: 0, sc: 0.01, alpha: 1, flash: 1, hp: e.hp, squash: 1 });
    sfx.swoosh();
    this.burst(EC.x, EC.y + 50, { n: 24, colors: ['#ffffff', '#ffe066', '#9ad7ff'], shape: 'star', speed: 240, life: 0.6, size: 6 });
    this.tween(b.ve, 'flash', 0, 0.45);
    await this.tween(b.ve, 'sc', 1, 0.42, 'back');
  }

  // ---------- battle mechanics ----------
  effStats(side: 'p' | 'e'): Stats {
    const b = this.b!;
    const m = side === 'p' ? this.pm() : this.em();
    const s = { ...calcStats(m) };
    if (side === 'p' && b.mega.uid === m.uid) {
      s.atk = Math.floor(s.atk * 1.4); s.spa = Math.floor(s.spa * 1.4); s.def = Math.floor(s.def * 1.25);
      s.spd = Math.floor(s.spd * 1.25); s.spe = Math.floor(s.spe * 1.2);
    }
    return s;
  }
  calcDamage(side: 'p' | 'e', mv: Move) {
    const att = side === 'p' ? this.pm() : this.em();
    const def = side === 'p' ? this.em() : this.pm();
    const A = this.effStats(side), D = this.effStats(side === 'p' ? 'e' : 'p');
    const phys = isPhysical(mv.type);
    const a = phys ? A.atk : A.spa, d = phys ? D.def : D.spd;
    let dmg = ((2 * att.level) / 5 + 2) * mv.power * a / d / 50 + 2;
    const stab = SPECIES[att.sp].types.includes(mv.type) ? 1.5 : 1;
    const eff = typeMult(mv.type, SPECIES[def.sp].types);
    const crit = Math.random() < 0.0625;
    dmg *= stab * eff * (crit ? 1.5 : 1) * rnd(0.85, 1) * 0.85;
    if (att.item === 'lifecrystal') dmg *= 1.15;
    if (side === 'p' && this.isMega()) dmg *= 1.1;
    return { dmg: eff === 0 ? 0 : Math.max(1, Math.floor(dmg)), eff, crit };
  }
  aiMove(): Move {
    const b = this.b!; const e = this.em(); const moves = movesOf(e);
    const smart = b.kind === 'wild' ? 0.55 : 0.85;
    if (Math.random() > smart) return moves[Math.floor(Math.random() * moves.length)];
    const defT = SPECIES[this.pm().sp].types;
    let best = moves[0], bs = -1;
    for (const m of moves) {
      const s = m.power * (m.acc / 100) * typeMult(m.type, defT) * (SPECIES[e.sp].types.includes(m.type) ? 1.5 : 1) + Math.random() * 8;
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }
  async projectile(type: TypeId, side: 'p' | 'e') {
    const from = side === 'p' ? PC : EC, to = side === 'p' ? EC : PC;
    const fx = FX[type];
    sfx.swoosh();
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const k = i / (steps - 1);
      const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 30;
      if (type === 'ground' || type === 'rock') {
        this.burst(to.x + rnd(-50, 50), to.y - 150, { n: 4, colors: fx.colors, shape: fx.shape, speed: 40, g: fx.g, life: 0.6, size: 9, angle: Math.PI / 2, spread: 0.5 });
      } else if (type === 'psychic') {
        this.burst(x, y, { n: 2, colors: fx.colors, shape: 'ring', speed: 20, life: 0.5, size: 8, grow: 60 });
      } else {
        this.burst(x, y, { n: 6, colors: fx.colors, shape: fx.shape, speed: fx.speed * 0.5, g: fx.g, life: 0.4, size: type === 'electric' ? 14 : 7 });
      }
      await this.wait(0.03);
    }
  }
  impact(type: TypeId, x: number, y: number, power: number) {
    const fx = FX[type];
    this.burst(x, y, { n: 18 + power * 14, colors: fx.colors, shape: fx.shape, speed: fx.speed * 1.3, g: fx.g, life: 0.7, size: type === 'electric' ? 16 : 8 });
    this.burst(x, y, { n: 10, colors: ['#ffffff'], shape: 'star', speed: 240, life: 0.4, size: 7 });
    this.burst(x, y, { n: 1, colors: [fx.colors[0]], shape: 'ring', speed: 0, life: 0.35, size: 10, grow: 260 });
  }
  setHp(vis: Vis, hp: number) { return this.tween(vis, 'hp', hp, 0.5, 'out'); }

  async useMove(side: 'p' | 'e', mv: Move) {
    const b = this.b!;
    const def = side === 'p' ? this.em() : this.pm();
    const aV = side === 'p' ? b.vp : b.ve, dV = side === 'p' ? b.ve : b.vp;
    const dc = side === 'p' ? EC : PC;
    await this.say(`${this.nameOf(side)} used ${mv.name}!`, 380);
    const lx = side === 'p' ? 70 : -70, ly = side === 'p' ? -30 : 30;
    this.tween(aV, 'x', lx, 0.1, 'out'); await this.tween(aV, 'y', ly, 0.1, 'out');
    this.tween(aV, 'x', 0, 0.18, 'out'); this.tween(aV, 'y', 0, 0.18, 'out');
    if (Math.random() * 100 > mv.acc) {
      sfx.miss(); this.floater(dc.x, dc.y - 40, 'MISS', '#cfd6ff', 28);
      await this.tween(dV, 'x', side === 'p' ? 40 : -40, 0.12); this.tween(dV, 'x', 0, 0.2);
      await this.say(`${this.nameOf(side)}'s attack missed!`, 600);
      return;
    }
    const r = this.calcDamage(side, mv);
    if (r.eff === 0) { await this.say(`It doesn't affect ${this.nameOf(side === 'p' ? 'e' : 'p')}...`, 800); return; }
    await this.projectile(mv.type, side);
    const power = r.eff > 1 ? 1.4 : r.eff < 1 ? 0.5 : 1;
    def.hp = Math.max(0, def.hp - r.dmg);
    this.impact(mv.type, dc.x, dc.y, power);
    const frac = r.dmg / maxHp(def);
    this.doShake((6 + frac * 40) * (r.crit ? 1.5 : 1) * (r.eff > 1 ? 1.3 : 1));
    if (r.crit || r.eff > 1) { this.hitstop = 0.09; this.doFlash(TYPE_COLOR[mv.type], 0.35); }
    sfx.hit(power); if (r.crit) sfx.crit();
    if (r.eff > 1) sfx.super(); else if (r.eff < 1) sfx.weak();
    dV.flash = 1; this.tween(dV, 'flash', 0, 0.3);
    dV.squash = 0.78; this.tween(dV, 'squash', 1, 0.35, 'back');
    this.tween(dV, 'x', side === 'p' ? 22 : -22, 0.05).then(() => this.tween(dV, 'x', 0, 0.25, 'back'));
    this.floater(dc.x + rnd(-20, 20), dc.y - 20, `-${r.dmg}`, r.eff > 1 ? '#ffd23f' : r.eff < 1 ? '#a8b0c8' : '#ffffff', r.crit ? 40 : 30, -70, 1.2);
    if (r.eff > 1) this.floater(dc.x, dc.y - 70, 'SUPER EFFECTIVE!', '#ffd23f', 20, -30, 1.2);
    if (r.crit) this.floater(dc.x, dc.y - 95, 'CRITICAL!', '#ff5a5a', 22, -30, 1.2);
    await this.setHp(dV, def.hp);
    if (side === 'p') this.addScore(r.dmg * (r.eff > 1 ? 2 : 1));
    if (r.crit) await this.say('A critical hit!', 550);
    if (r.eff > 1) await this.say("It's super effective!", 650);
    else if (r.eff < 1) await this.say("It's not very effective...", 650);
    if (def.hp <= 0) await this.faintAnim(side === 'p' ? 'e' : 'p');
  }
  async faintAnim(side: 'p' | 'e') {
    const b = this.b!; const v = side === 'p' ? b.vp : b.ve; const c = side === 'p' ? PC : EC;
    sfx.faint();
    this.burst(c.x, c.y + 40, { n: 26, colors: ['#ffffff', '#cfd6ff', '#8a90b0'], shape: 'circle', speed: 160, life: 0.8, size: 8, g: 100 });
    this.tween(v, 'alpha', 0, 0.55, 'lin'); await this.tween(v, 'y', 90, 0.55, 'inout');
    await this.say(`${this.nameOf(side)} fainted!`, 800);
  }

  async afterAttack(): Promise<'ok' | 'stop'> {
    const b = this.b!;
    if (this.em().hp <= 0) { await this.onEnemyDown(); return 'stop'; }
    if (this.pm().hp <= 0) { await this.onPlayerDown(); return 'stop'; }
    void b;
    return 'ok';
  }
  async endTurn() {
    const b = this.b; if (!b) return;
    b.turn++;
    if (b.mega.uid && b.mega.turns > 0) {
      b.mega.turns--;
      if (b.mega.turns <= 0) await this.revertMega();
    }
    b.phase = 'menu'; b.msg = `What will ${SPECIES[this.pm().sp].name} do?`; this.emit();
  }
  async revertMega() {
    const b = this.b!;
    const m = this.p!.party.find((x) => x.uid === b.mega.uid);
    b.mega.uid = null; b.mega.turns = 0;
    this.doFlash('#ffffff', 0.5); sfx.weak();
    this.burst(PC.x, PC.y, { n: 20, colors: ['#ffffff', '#cfd6ff'], shape: 'circle', speed: 200, life: 0.6, size: 7 });
    if (m) await this.say(`${SPECIES[m.sp].name}'s mega power faded.`, 800);
  }

  async enemyTurn(): Promise<'ok' | 'stop'> {
    await this.useMove('e', this.aiMove());
    return this.afterAttack();
  }

  async act(a: BattleAction) {
    const b = this.b; if (!b || b.phase !== 'menu' || this.paused) return;
    const p = this.p!;
    b.phase = 'anim'; b.tutorial = false; this.emit();
    sfx.select();
    if (a.t === 'move') {
      const mv = movesOf(this.pm())[a.i]; if (!mv) { b.phase = 'menu'; return; }
      const em = this.aiMove();
      const ps = this.effStats('p').spe, es = this.effStats('e').spe;
      const pp = mv.prio || 0, ep = em.prio || 0;
      const pFirst = pp !== ep ? pp > ep : ps !== es ? ps > es : Math.random() < 0.5;
      const order: ['p' | 'e', Move][] = pFirst ? [['p', mv], ['e', em]] : [['e', em], ['p', mv]];
      for (const [s, m] of order) {
        await this.useMove(s, m);
        if ((await this.afterAttack()) === 'stop') return;
      }
      await this.endTurn();
    } else if (a.t === 'item') {
      const it = ITEMS[a.id]; const m = this.pm();
      if (!it || it.kind !== 'heal' || (p.items[a.id] || 0) <= 0 || m.hp >= maxHp(m)) { sfx.error(); b.phase = 'menu'; this.emit(); return; }
      p.items[a.id]--;
      const before = m.hp; m.hp = Math.min(maxHp(m), m.hp + it.amount!);
      sfx.heal();
      this.burst(PC.x, PC.y, { n: 20, colors: ['#7aff9a', '#ffffff'], shape: 'circle', speed: 120, life: 0.8, size: 6, g: -100 });
      this.floater(PC.x, PC.y - 60, `+${m.hp - before}`, '#7aff9a', 32);
      this.tween(b.vp, 'hp', m.hp, 0.5);
      await this.say(`You used a ${it.name}. ${SPECIES[m.sp].name} recovered HP!`, 900);
      if ((await this.enemyTurn()) === 'stop') return;
      await this.endTurn();
    } else if (a.t === 'orb') {
      await this.throwOrb(a.id);
    } else if (a.t === 'switch') {
      const target = p.party[a.idx];
      if (!target || target.hp <= 0 || a.idx === b.pi) { sfx.error(); b.phase = 'menu'; this.emit(); return; }
      await this.say(`Come back, ${SPECIES[this.pm().sp].name}!`, 300);
      if (b.mega.uid) { b.mega.uid = null; b.mega.turns = 0; }
      await this.tween(b.vp, 'sc', 0.01, 0.2, 'inout');
      b.pi = a.idx;
      await this.say(`Go, ${SPECIES[this.pm().sp].name}!`, 200);
      await this.sendOutPlayer();
      if ((await this.enemyTurn()) === 'stop') return;
      await this.endTurn();
    } else if (a.t === 'run') {
      if (b.kind !== 'wild') { await this.say("You can't run from a trainer battle!", 900); b.phase = 'menu'; this.emit(); return; }
      if (Math.random() < 0.8) {
        sfx.swoosh(); await this.say('Got away safely!', 800);
        await this.endBattle();
      } else {
        await this.say("Couldn't get away!", 700);
        if ((await this.enemyTurn()) === 'stop') return;
        await this.endTurn();
      }
    }
  }

  catchChance(id: string) {
    const b = this.b; const it = ITEMS[id];
    if (!b || !it || b.kind !== 'wild') return 0;
    const e = this.em();
    return clamp((1 - 0.7 * (e.hp / maxHp(e))) * (SPECIES[e.sp].cr / 255) * (it.mult || 1) * 1.15, 0.02, 1);
  }
  canMega() {
    const b = this.b, p = this.p;
    if (!b || !p || b.phase !== 'menu' || b.mega.used) return false;
    return p.stones.includes(rootOf(this.pm().sp));
  }
  async doMega() {
    const b = this.b; if (!b || !this.canMega()) { sfx.error(); return; }
    b.phase = 'anim'; this.emit();
    const m = this.pm();
    sfx.mega(); this.doFlash('#fff6c0', 1); this.doShake(20);
    await this.say(`${SPECIES[m.sp].name}'s ${stoneName(rootOf(m.sp))} is reacting!`, 700);
    this.burst(PC.x, PC.y, { n: 60, colors: [TYPE_COLOR[SPECIES[m.sp].types[0]], '#ffffff', '#ffe066'], shape: 'star', speed: 360, life: 1, size: 9 });
    this.burst(PC.x, PC.y, { n: 3, colors: ['#ffffff'], shape: 'ring', speed: 0, life: 0.6, size: 10, grow: 500 });
    b.mega = { uid: m.uid, turns: 3, used: true };
    b.vp.flash = 1; this.tween(b.vp, 'flash', 0, 0.6);
    b.vp.sc = 0.7; await this.tween(b.vp, 'sc', 1, 0.5, 'back');
    this.addScore(500);
    await this.say(`${SPECIES[m.sp].name} Mega Evolved! (3 turns)`, 900);
    b.phase = 'menu'; b.msg = `What will ${SPECIES[m.sp].name} do?`; this.emit();
  }

  async throwOrb(id: string) {
    const b = this.b!; const p = this.p!; const it = ITEMS[id];
    if (!it || it.kind !== 'orb' || (p.items[id] || 0) <= 0) { sfx.error(); b.phase = 'menu'; this.emit(); return; }
    p.items[id]--; this.emit();
    await this.say(`You threw a ${it.name}!`, 250);
    if (b.kind !== 'wild') {
      await this.say("The trainer deflected the orb! Don't steal their monsters!", 1200);
      if ((await this.enemyTurn()) === 'stop') return;
      await this.endTurn(); return;
    }
    const e = this.em(); const sp = SPECIES[e.sp];
    const color = id === 'orb' ? '#e8453c' : id === 'great' ? '#3c7ae8' : '#f0b830';
    const orb = { k: 0, rot: 0, sc: 1, open: 0, color, glow: 0, y: 0, x: 0, fromX: PC.x + 40, fromY: PC.y - 20 };
    b.orb = orb;
    sfx.swoosh();
    this.tween(orb, 'rot', Math.PI * 6, 0.6, 'lin');
    await this.tween(orb, 'k', 1, 0.6, 'out');
    // absorb
    orb.open = 1; sfx.hit(0.5); this.doFlash('#ffffff', 0.5);
    b.ve.flash = 1; this.burst(EC.x, EC.y, { n: 20, colors: ['#ff6a6a', '#ffffff'], shape: 'circle', speed: 200, life: 0.5, size: 7 });
    this.tween(b.ve, 'sc', 0.01, 0.3, 'inout');
    await this.wait(0.2); orb.open = 0;
    const gx = EC.x, gy = EP.y + 6;
    orb.x = gx; orb.y = EC.y;
    orb.k = 2; // grounded mode: use x/y directly
    await this.tween(orb, 'y', gy, 0.45, 'bounce');
    sfx.hit(0.4); this.doShake(5);
    const chance = this.catchChance(id);
    const success = Math.random() < chance;
    const shakes = success ? 3 : Math.floor(Math.random() * 4);
    await this.wait(0.4);
    for (let i = 0; i < shakes; i++) {
      sfx.wobble();
      await this.tween(orb, 'rot', -0.4, 0.14, 'out');
      await this.tween(orb, 'rot', 0.4, 0.2, 'inout');
      await this.tween(orb, 'rot', 0, 0.12, 'out');
      this.floater(orb.x + 30, orb.y - 40, '...', '#ffffff', 26, -20, 0.6);
      await this.wait(0.45);
    }
    if (success) {
      sfx.caught(); this.doFlash('#fff6c0', 0.5);
      this.burst(orb.x, orb.y - 20, { n: 40, colors: ['#ffe066', '#ffffff', color], shape: 'star', speed: 320, life: 1, size: 9 });
      orb.glow = 1; this.tween(orb, 'glow', 0, 0.8);
      await this.say(`Gotcha! ${sp.name} was caught!`, 1100);
      const mon: Mon = { ...e, uid: uid() };
      const toBox = p.party.length >= 6;
      if (toBox) p.box.push(mon); else p.party.push(mon);
      p.caught++;
      const firstTime = !p.dex.includes(e.sp); if (firstTime) p.dex.push(e.sp);
      this.addScore(200 + e.level * 10 + (255 - sp.cr) + (firstTime ? 300 : 0));
      this.toast(toBox ? `${sp.name} was sent to the Box.` : `${sp.name} joined your party!`, 'good');
      b.orb = null;
      await this.checkEvolutions();
      await this.endBattle();
    } else {
      sfx.miss();
      orb.open = 1; this.burst(orb.x, orb.y - 10, { n: 16, colors: ['#ffffff', '#ff9a9a'], shape: 'circle', speed: 200, life: 0.5, size: 6 });
      b.ve.sc = 0.01; b.ve.flash = 1; this.tween(b.ve, 'flash', 0, 0.4);
      this.tween(b.ve, 'sc', 1, 0.35, 'back'); b.orb = null;
      await this.say(shakes === 0 ? 'Oh no! It broke free instantly!' : shakes < 3 ? 'Aww! It appeared to be caught!' : 'Argh! So close!', 1000);
      if ((await this.enemyTurn()) === 'stop') return;
      await this.endTurn();
    }
  }

  levelUp(m: Mon, activeVis?: Vis) {
    const oldMax = maxHp(m);
    m.level++;
    m.hp += maxHp(m) - oldMax;
    this.addScore(100);
    if (activeVis) { sfx.levelUp(); this.burst(PC.x, PC.y, { n: 36, colors: ['#ffe066', '#ffffff', '#7aff9a'], shape: 'star', speed: 260, life: 0.9, size: 8, g: -60 }); this.floater(PC.x, PC.y - 110, 'LEVEL UP!', '#7aff9a', 30, -40, 1.4); }
  }
  async awardXp() {
    const b = this.b!; const p = this.p!; const e = this.em();
    const sp = SPECIES[e.sp];
    const base = (e.level * (sp.bst / 6) * 1.4) / 4 * (b.kind === 'wild' ? 1 : 1.5);
    this.addScore((b.kind === 'wild' ? 40 : 90) * e.level);
    let lead = true;
    for (const m of p.party) {
      if (m.hp <= 0 || m.level >= 100) continue;
      const share = b.part.has(m.uid) ? 1 : 0.5;
      const gain = Math.max(1, Math.floor(base * share * (m.item === 'luckyegg' ? 1.5 : 1)));
      const isActive = m.uid === this.pm().uid;
      if (lead) { await this.say(`${SPECIES[m.sp].name} gained ${gain} EXP!${m.item === 'luckyegg' ? ' 🥚' : ''}`, 700); lead = false; }
      m.xp += gain;
      while (m.xp >= xpNeed(m.level) && m.level < 100) {
        m.xp -= xpNeed(m.level);
        this.levelUp(m, isActive ? b.vp : undefined);
        if (isActive) { b.vp.hp = m.hp; await this.say(`${SPECIES[m.sp].name} grew to Lv. ${m.level}!`, 900); }
      }
      if (isActive) this.tween(b.vp, 'xp', m.xp / xpNeed(m.level), 0.5);
    }
    this.emit();
  }
  async onEnemyDown() {
    const b = this.b!;
    await this.awardXp();
    if (b.ei + 1 < b.enemies.length) {
      b.ei++;
      await this.say(`${b.trainer!.name} sends out ${SPECIES[this.em().sp].name}!`, 700);
      await this.sendOutEnemy();
      b.phase = 'menu'; b.msg = `What will ${SPECIES[this.pm().sp].name} do?`; this.emit();
      return;
    }
    await this.winBattle();
  }
  async winBattle() {
    const b = this.b!; const p = this.p!; const tr = b.trainer;
    p.wins++;
    sfx.win();
    if (tr) {
      await this.say(`You defeated ${tr.cls} ${tr.name}!`, 1000);
      p.money += tr.prize;
      await this.say(`You earned $${tr.prize}!`, 900);
      this.addScore(400 + tr.prize / 4);
      if (tr.id) p.defeated[tr.id] = true;
    }
    if (b.kind === 'gym' && tr?.region !== undefined) {
      p.badges[tr.region] = true;
      sfx.badge(); this.doFlash('#fff6c0', 1);
      this.burst(PC.x + 200, PC.y - 100, { n: 80, colors: ['#ffd23f', '#ff6fb5', '#3d9bff', '#5fcf4e', '#ffffff'], shape: 'star', speed: 420, life: 1.6, size: 10, g: 200 });
      this.addScore(5000);
      await this.say(`You received the ${REGIONS[tr.region].badge}! 🏅`, 1500);
      this.mapCv = renderMap(this.map, this.regionIdx, true);
      this.toast(`${REGIONS[tr.region].badge} earned — the east gate is open!`, 'good');
      this.recordScore();
    }
    await this.checkEvolutions();
    if (b.kind === 'tournament') {
      if (p.tournament >= 2) { await this.endBattle(false, true); return; }
      p.tournament++;
      for (const m of p.party) m.hp = maxHp(m);
      this.toast('Round cleared! Your team is fully refreshed.', 'good');
      await this.endBattle(false, false, true);
      return;
    }
    await this.endBattle();
  }
  async checkEvolutions() {
    const b = this.b; const p = this.p!;
    for (const m of p.party) {
      const sp = SPECIES[m.sp];
      if (!sp.evo || m.level < sp.evo.lvl) continue;
      const to = SPECIES[sp.evo.to];
      if (b) {
        b.evo = { sp: m.sp, flash: 0 }; this.emit();
        await this.say(`What? ${sp.name} is evolving!`, 900);
        sfx.mega();
        for (let i = 0; i < 12; i++) {
          b.evo.sp = i % 2 ? sp.id : to.id; b.evo.flash = 1; this.tween(b.evo, 'flash', 0.2, 0.16, 'lin');
          this.burst(360, 300, { n: 6, colors: ['#ffffff', '#ffe066'], shape: 'star', speed: 200, life: 0.6, size: 6 });
          await this.wait(0.17);
        }
        b.evo.sp = to.id; b.evo.flash = 0;
      }
      const oldMax = maxHp(m);
      m.sp = to.id; m.hp += maxHp(m) - oldMax;
      if (!p.dex.includes(to.id)) p.dex.push(to.id);
      this.addScore(300);
      if (b) {
        sfx.levelUp(); this.doFlash('#ffffff', 0.9);
        this.burst(360, 300, { n: 50, colors: ['#ffffff', '#ffe066', TYPE_COLOR[to.types[0]]], shape: 'star', speed: 340, life: 1, size: 9 });
        await this.say(`${sp.name} evolved into ${to.name}!`, 1400);
        b.evo = null;
      } else this.toast(`${sp.name} evolved into ${to.name}!`, 'good');
    }
  }
  async onPlayerDown() {
    const b = this.b!; const p = this.p!;
    if (p.party.some((m) => m.hp > 0)) {
      b.phase = 'forceSwitch'; b.msg = 'Choose your next monster!'; this.emit();
      return;
    }
    await this.say('You have no monsters left to fight!', 1000);
    await this.gameOver();
  }
  async chooseSwitch(idx: number) {
    const b = this.b; const p = this.p;
    if (!b || !p || b.phase !== 'forceSwitch') return;
    const t = p.party[idx]; if (!t || t.hp <= 0) { sfx.error(); return; }
    b.phase = 'anim'; this.emit();
    b.pi = idx; if (b.mega.uid && b.mega.uid !== t.uid) { b.mega.uid = null; b.mega.turns = 0; }
    await this.say(`Go, ${SPECIES[t.sp].name}!`, 250);
    await this.sendOutPlayer();
    b.phase = 'menu'; b.msg = `What will ${SPECIES[t.sp].name} do?`; this.emit();
  }
  async endBattle(_won = true, victory = false, nextRound = false) {
    const b = this.b!; const p = this.p!;
    this.busy = true;
    await this.transition('in', 0.5);
    const kind = b.kind;
    this.b = null; this.screen = 'world'; this.parts = []; this.floaters = [];
    if (kind === 'gym' || kind === 'tournament') this.exitDoor();
    this.save(); this.emit();
    if (victory) { await this.victory(); return; }
    await this.transition('out', 0.4);
    this.busy = false;
    if (nextRound) { await this.wait(0.3); this.busy = true; await this.startTournamentRound(); return; }
    this.emit();
    void p;
  }
  async gameOver() {
    const p = this.p!;
    sfx.gameover();
    await this.transition('in', 0.6);
    this.b = null; this.screen = 'gameover'; this.trans = null; this.busy = false;
    this.recordScore();
    this.emit();
    void p;
  }
  continueAfterGameOver() {
    const p = this.p!;
    p.money = Math.floor(p.money / 2);
    for (const m of [...p.party, ...p.box]) m.hp = maxHp(m);
    this.screen = 'world'; this.busy = false;
    this.loadRegion(this.regionIdx);
    this.toast('You woke up at the Center. You lost half your money.', 'warn');
    this.emit();
  }
  async victory() {
    const p = this.p!;
    p.won = true; this.addScore(25000);
    this.recordScore(); this.clearSave();
    sfx.win();
    this.trans = null; this.screen = 'victory'; this.busy = false;
    this.emit();
  }

  // ---------- items / party / shop ----------
  useItem(id: string, uidm: string): boolean {
    const p = this.p!; const it = ITEMS[id]; const m = [...p.party, ...p.box].find((x) => x.uid === uidm);
    if (!it || !m || (p.items[id] || 0) <= 0) return false;
    if (it.kind === 'heal') {
      if (m.hp <= 0 || m.hp >= maxHp(m)) { sfx.error(); return false; }
      m.hp = Math.min(maxHp(m), m.hp + it.amount!);
    } else if (it.kind === 'revive') {
      if (m.hp > 0) { sfx.error(); return false; }
      m.hp = Math.max(1, Math.floor(maxHp(m) / 2));
    } else if (it.kind === 'candy') {
      if (m.level >= 100) return false;
      this.levelUp(m); m.xp = 0;
      void this.checkEvolutions();
    } else return false;
    p.items[id]--; sfx.heal(); this.emit(); return true;
  }
  equip(id: string, uidm: string) {
    const p = this.p!; const m = [...p.party, ...p.box].find((x) => x.uid === uidm);
    if (!m || (p.items[id] || 0) <= 0 || ITEMS[id]?.kind !== 'held') return;
    if (m.item) p.items[m.item] = (p.items[m.item] || 0) + 1;
    p.items[id]--; m.item = id; m.hp = Math.min(m.hp, maxHp(m));
    sfx.select(); this.emit();
  }
  unequip(uidm: string) {
    const p = this.p!; const m = [...p.party, ...p.box].find((x) => x.uid === uidm);
    if (!m?.item) return;
    p.items[m.item] = (p.items[m.item] || 0) + 1; m.item = undefined; m.hp = Math.min(m.hp, maxHp(m));
    sfx.back(); this.emit();
  }
  buy(id: string, qty = 1): boolean {
    const p = this.p!; const it = ITEMS[id]; if (!it) return false;
    const cost = it.price * qty;
    if (p.money < cost) { sfx.error(); this.toast('Not enough money!', 'warn'); return false; }
    p.money -= cost; p.items[id] = (p.items[id] || 0) + qty; sfx.buy(); this.emit(); return true;
  }
  buyStone(root: string): boolean {
    const p = this.p!;
    if (p.stones.includes(root)) return false;
    if (p.money < STONE_PRICE) { sfx.error(); this.toast('Not enough money!', 'warn'); return false; }
    p.money -= STONE_PRICE; p.stones.push(root); sfx.buy(); sfx.mega();
    this.toast(`${stoneName(root)} acquired! Use MEGA in battle.`, 'good'); this.emit(); return true;
  }
  setLead(uidm: string) {
    const p = this.p!; const i = p.party.findIndex((m) => m.uid === uidm);
    if (i <= 0) return;
    const [m] = p.party.splice(i, 1); p.party.unshift(m); sfx.select(); this.emit();
  }
  deposit(uidm: string) {
    const p = this.p!; const i = p.party.findIndex((m) => m.uid === uidm);
    if (i < 0 || p.party.length <= 1) { sfx.error(); return; }
    p.box.push(...p.party.splice(i, 1)); sfx.back(); this.emit();
  }
  withdraw(uidm: string) {
    const p = this.p!; const i = p.box.findIndex((m) => m.uid === uidm);
    if (i < 0 || p.party.length >= 6) { sfx.error(); return; }
    p.party.push(...p.box.splice(i, 1)); sfx.select(); this.emit();
  }

  // ======================= RENDERING =======================
  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 2, (Math.random() - 0.5) * this.shake * 2);
    switch (this.screen) {
      case 'world': this.drawWorld(); break;
      case 'battle': this.drawBattle(); break;
      default: this.drawBackdrop(); break;
    }
    ctx.restore();
    if (this.flashA > 0) { ctx.globalAlpha = Math.min(1, this.flashA); ctx.fillStyle = this.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (this.trans) this.drawTransition();
  }

  drawTransition() {
    const ctx = this.ctx; const tr = this.trans!;
    let k = clamp(tr.t / tr.dur, 0, 1);
    if (tr.dir === 'out') k = 1 - k;
    const n = 10, bh = H / n;
    ctx.fillStyle = '#0d0b1f';
    for (let i = 0; i < n; i++) {
      const kk = clamp(k * 1.6 - (i / n) * 0.6, 0, 1);
      const w = W * kk;
      if (i % 2) ctx.fillRect(W - w, i * bh, w, bh + 1); else ctx.fillRect(0, i * bh, w, bh + 1);
    }
  }

  drawBackdrop() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#171a44'); g.addColorStop(0.55, '#4a2b7c'); g.addColorStop(1, '#ff7a59');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97.3) % W, y = (i * 53.7) % 260, tw = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 1.5 + i));
      ctx.fillStyle = `rgba(255,255,255,${tw * 0.8})`; ctx.fillRect(x, y, 2, 2);
    }
    // hills
    ctx.fillStyle = '#2a1850';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 340 + Math.sin(x * 0.012) * 30 + Math.sin(x * 0.03) * 10);
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = '#1a0f38';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 400 + Math.sin(x * 0.02 + 2) * 20);
    ctx.lineTo(W, H); ctx.fill();
    for (const m of this.bgMons) drawMonster(ctx, m.sp, m.x, m.y + Math.sin(this.t * 2 + m.ph) * 4, m.s, { t: this.t + m.ph, facing: m.v > 0 ? 1 : -1, alpha: 0.9 });
    for (const q of this.parts) this.drawParticle(q);
  }

  drawParticle(q: Particle) {
    const ctx = this.ctx; const a = clamp(q.life / q.max, 0, 1);
    ctx.globalAlpha = Math.min(1, a * 1.6);
    ctx.fillStyle = q.color; ctx.strokeStyle = q.color;
    switch (q.shape) {
      case 'circle': ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.5, q.size * (0.4 + a * 0.6)), 0, 7); ctx.fill(); break;
      case 'square': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.size / 2, -q.size / 2, q.size, q.size); ctx.restore(); break;
      case 'star': drawStar(ctx, q.x, q.y, q.size * (0.5 + a * 0.5), q.rot); ctx.fill(); break;
      case 'spark': ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.06, q.y - q.vy * 0.06); ctx.stroke(); break;
      case 'ring': ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, q.size), 0, 7); ctx.stroke(); break;
      case 'leaf': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.beginPath(); ctx.ellipse(0, 0, q.size, q.size * 0.45, 0, 0, 7); ctx.fill(); ctx.restore(); break;
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters() {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of this.floaters) {
      const k = f.t / f.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.3);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `900 ${Math.round(f.size * pop)}px system-ui, sans-serif`;
      ctx.lineWidth = 6; ctx.strokeStyle = '#1d1a33'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- world drawing ----------
  drawWorld() {
    const ctx = this.ctx; const p = this.p!; const map = this.map; const m = this.mv;
    const k = m.active ? Math.min(1, m.t / m.dur) : 0;
    const gx = m.active ? m.fx + (m.tx - m.fx) * k : p.x, gy = m.active ? m.fy + (m.ty - m.fy) * k : p.y;
    const camX = clamp(Math.round(gx * TILE + 24 - W / 2), 0, map.w * TILE - W);
    const camY = clamp(Math.round(gy * TILE + 24 - H / 2), 0, map.h * TILE - H);
    if (this.mapCv) ctx.drawImage(this.mapCv, camX, camY, W, H, 0, 0, W, H);
    ctx.save(); ctx.translate(-camX, -camY);
    // water shimmer
    const x0 = Math.floor(camX / TILE), x1 = Math.ceil((camX + W) / TILE), y0 = Math.floor(camY / TILE), y1 = Math.ceil((camY + H) / TILE);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (this.tileAt(x, y) !== T.WATER) continue;
      const ph = this.t * 1.5 + x * 0.7 + y * 1.3;
      ctx.fillRect(x * TILE + 8 + Math.sin(ph) * 8 + 8, y * TILE + 20 + Math.cos(ph * 0.8) * 6, 12, 3);
    }
    // gate hint
    if (this.regionIdx < 8 && p.badges[this.regionIdx]) {
      const gxp = (map.w - 1) * TILE, pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
      ctx.fillStyle = `rgba(255,226,102,${0.25 + pulse * 0.35})`; ctx.fillRect(gxp, 7 * TILE, TILE, 3 * TILE);
      ctx.fillStyle = '#fff'; ctx.font = '900 34px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('➜', gxp + 24 + pulse * 6, 8 * TILE + 24);
    }
    // entities
    type Ent = { y: number; draw: () => void };
    const ents: Ent[] = [];
    for (const q of map.pickups) {
      if (p.picked[q.id]) continue;
      ents.push({ y: q.y * TILE, draw: () => {
        const bob = Math.sin(this.t * 3 + q.x) * 3, cx = q.x * TILE + 24, cy = q.y * TILE + 30 + bob;
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx, q.y * TILE + 42, 10, 4, 0, 0, 7); ctx.fill();
        const gl = 0.5 + 0.5 * Math.sin(this.t * 4 + q.y);
        ctx.fillStyle = `rgba(255,240,150,${0.25 + gl * 0.25})`; ctx.beginPath(); ctx.arc(cx, cy, 17 + gl * 3, 0, 7); ctx.fill();
        if (q.money) {
          ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1d1a33'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#b8860b'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', cx, cy + 1);
        } else drawOrb(ctx, cx, cy, 10, Math.sin(this.t * 2) * 0.3, '#3c7ae8');
      } });
    }
    for (const tr of map.trainers) {
      ents.push({ y: tr.fy * TILE, draw: () => {
        drawPerson(ctx, tr.fx * TILE + 24, tr.fy * TILE + 44, tr.dir, 0, tr.colors, 1);
        if (tr.alert > 0) {
          const by = tr.fy * TILE - 22 + Math.sin(this.t * 14) * 2;
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1d1a33'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.roundRect(tr.fx * TILE + 12, by - 18, 24, 30, 6); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e8453c'; ctx.font = '900 24px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', tr.fx * TILE + 24, by - 2);
        }
      } });
    }
    const lead = p.party[this.leadIdx()];
    if (lead) {
      const fx = m.active ? this.fol.x + (this.fol.tx - this.fol.x) * k : this.fol.x;
      const fy = m.active ? this.fol.y + (this.fol.ty - this.fol.y) * k : this.fol.y;
      if (Math.abs(fx - gx) + Math.abs(fy - gy) > 0.4) {
        ents.push({ y: fy * TILE, draw: () => {
          const hop = m.active ? Math.abs(Math.sin(this.walkPhase * Math.PI * 2)) * 4 : 0;
          drawMonster(ctx, lead.sp, fx * TILE + 24, fy * TILE + 44 - hop, 42, { t: this.t, facing: this.fol.face as 1 | -1 });
        } });
      }
    }
    ents.push({ y: gy * TILE + 1, draw: () => {
      drawPerson(ctx, gx * TILE + 24, gy * TILE + 44, p.dir, m.active ? this.walkPhase : 0, PLAYER_COL, 1);
      if (this.tileAt(p.x, p.y) === T.TALL && !m.active || (m.active && this.tileAt(m.tx, m.ty) === T.TALL && k > 0.5)) {
        const pal = REGIONS[this.regionIdx].pal;
        ctx.strokeStyle = pal.tall2; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const bx = gx * TILE + 8 + i * 5.5, by = gy * TILE + 46;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.sin(this.t * 8 + i) * 2 - 2, by - 14); ctx.stroke();
        }
      }
    } });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();
    for (const q of this.parts) this.drawParticle(q);
    ctx.restore();
    this.drawFloaters();
    if (!this.vignette) {
      const v = document.createElement('canvas'); v.width = W; v.height = H;
      const c = v.getContext('2d')!; const g = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,8,30,0.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      this.vignette = v;
    }
    ctx.drawImage(this.vignette, 0, 0);
    if (this.banner) {
      const b = this.banner; const a = Math.min(1, b.t * 2, (3 - b.t) * 3);
      ctx.globalAlpha = clamp(a, 0, 1);
      const y = 84 - (1 - clamp(a, 0, 1)) * 20;
      ctx.fillStyle = 'rgba(15,12,40,0.78)'; ctx.beginPath(); ctx.roundRect(W / 2 - 230, y - 36, 460, 78, 16); ctx.fill();
      ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = '22px "Press Start 2P", ui-monospace, monospace';
      ctx.fillText(b.text, W / 2, y - 8);
      ctx.fillStyle = b.color; ctx.font = '800 15px system-ui, sans-serif'; ctx.fillText(b.sub, W / 2, y + 22);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- battle drawing ----------
  drawBattle() {
    const ctx = this.ctx; const b = this.b; if (!b) { this.drawBackdrop(); return; }
    const pal = REGIONS[this.regionIdx].pal;
    const sky = ctx.createLinearGradient(0, 0, 0, 230);
    sky.addColorStop(0, pal.skyTop); sky.addColorStop(1, pal.skyBot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 240);
    // sun + clouds
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) { const cx = ((i * 230 + this.t * 8) % (W + 200)) - 100, cy = 40 + (i % 2) * 40; ctx.beginPath(); ctx.ellipse(cx, cy, 60, 16, 0, 0, 7); ctx.ellipse(cx + 28, cy - 10, 36, 14, 0, 0, 7); ctx.fill(); }
    // far hills
    ctx.fillStyle = mix(pal.tree, pal.skyBot, 0.5);
    ctx.beginPath(); ctx.moveTo(0, 240); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 190 + Math.sin(x * 0.015 + 1) * 24 + Math.sin(x * 0.04) * 8); ctx.lineTo(W, 240); ctx.fill();
    ctx.fillStyle = mix(pal.tree, '#000000', 0.15);
    ctx.beginPath(); ctx.moveTo(0, 240); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 214 + Math.sin(x * 0.02 + 4) * 14); ctx.lineTo(W, 240); ctx.fill();
    // ground
    const gr = ctx.createLinearGradient(0, 220, 0, H);
    gr.addColorStop(0, pal.ground); gr.addColorStop(1, mix(pal.ground2, '#000000', 0.25));
    ctx.fillStyle = gr; ctx.fillRect(0, 220, W, H - 220);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const y = 240 + i * i * 6 + i * 8; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // platforms
    const plat = (x: number, y: number, rx: number, ry: number) => {
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 8, rx, ry, 0, 0, 7); ctx.fill();
      ctx.fillStyle = mix(pal.ground, '#ffffff', 0.18); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; ctx.stroke();
    };
    plat(EP.x, EP.y, 135, 28); plat(PP.x, PP.y, 165, 36);

    const em = b.enemies[b.ei]; const pm = this.p!.party[b.pi];
    if (b.evo) {
      ctx.fillStyle = 'rgba(10,8,30,0.7)'; ctx.fillRect(0, 0, W, H);
      drawMonster(ctx, b.evo.sp, 360, 400, 260, { t: this.t, flash: b.evo.flash, tint: '#ffffff' });
    } else {
      if (em && b.ve.alpha > 0.01) drawMonster(ctx, em.sp, EP.x + b.ve.x, EP.y + b.ve.y, 175 * b.ve.sc, { t: this.t, facing: -1, flash: b.ve.flash, alpha: b.ve.alpha, squash: b.ve.squash, shadow: false });
      if (pm && b.vp.alpha > 0.01) drawMonster(ctx, pm.sp, PP.x + b.vp.x, PP.y + b.vp.y, 215 * b.vp.sc, { t: this.t, facing: 1, flash: b.vp.flash, alpha: b.vp.alpha, squash: b.vp.squash, shadow: false, mega: this.isMega() });
    }
    // orb
    if (b.orb) {
      const o = b.orb;
      let x: number, y: number;
      if (o.k <= 1) { x = o.fromX + (EC.x - o.fromX) * o.k; y = o.fromY + (EC.y - o.fromY) * o.k - Math.sin(o.k * Math.PI) * 140; }
      else { x = o.x; y = o.y; }
      if (o.glow > 0) { ctx.fillStyle = `rgba(255,240,150,${o.glow * 0.6})`; ctx.beginPath(); ctx.arc(x, y, 44 * (2 - o.glow), 0, 7); ctx.fill(); }
      drawOrb(ctx, x, y, 22 * o.sc, o.rot, o.color, o.open);
    }
    for (const q of this.parts) this.drawParticle(q);
    this.drawFloaters();
    if (!b.evo) {
      if (em) this.drawBox(22, 20, 310, 82, em, b.ve.hp, 0, false);
      if (pm && b.vp.sc > 0.5) this.drawBox(392, 346, 306, 104, pm, b.vp.hp, b.vp.xp, true);
      // trainer pips
      if (b.trainer) {
        for (let i = 0; i < b.enemies.length; i++) {
          ctx.fillStyle = i < b.ei ? 'rgba(0,0,0,0.5)' : i === b.ei ? '#ffd23f' : '#e8453c'; ctx.strokeStyle = '#1d1a33'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(40 + i * 24, 118, 8, 0, 7); ctx.fill(); ctx.stroke();
        }
      }
    }
  }

  drawBox(x: number, y: number, w: number, h: number, m: Mon, hpShown: number, xp: number, player: boolean) {
    const ctx = this.ctx; const sp = SPECIES[m.sp]; const mx = maxHp(m);
    ctx.save();
    ctx.fillStyle = 'rgba(18,16,44,0.88)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = TYPE_COLOR[sp.types[0]]; ctx.lineWidth = 3; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const mega = player && this.isMega();
    ctx.fillStyle = mega ? '#ffe066' : '#fff'; ctx.font = '900 20px system-ui, sans-serif';
    const nm = (mega ? 'Mega ' : '') + sp.name;
    ctx.fillText(nm, x + 14, y + 22);
    ctx.textAlign = 'right'; ctx.fillStyle = '#cfd6ff'; ctx.font = '800 16px system-ui, sans-serif'; ctx.fillText(`Lv.${m.level}`, x + w - 14, y + 22);
    // types
    ctx.textAlign = 'left'; ctx.font = '15px system-ui';
    sp.types.forEach((t, i) => {
      ctx.fillStyle = TYPE_COLOR[t]; ctx.beginPath(); ctx.roundRect(x + 14 + i * 92, y + 38, 86, 18, 9); ctx.fill();
      ctx.fillStyle = '#1d1a33'; ctx.font = '800 11px system-ui'; ctx.fillText(`${TYPE_ICON[t]} ${t.toUpperCase()}`, x + 20 + i * 92, y + 48);
    });
    // hp bar
    const bx = x + 14, by = y + (player ? 62 : 62), bw = w - 28;
    const ratio = clamp(hpShown / mx, 0, 1);
    ctx.fillStyle = '#0b0a1e'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 12, 6); ctx.fill();
    ctx.fillStyle = ratio > 0.5 ? '#5fe070' : ratio > 0.2 ? '#ffd23f' : '#ff4a4a';
    if (ratio > 0) { ctx.beginPath(); ctx.roundRect(bx + 1.5, by + 1.5, Math.max(8, (bw - 3) * ratio), 9, 4.5); ctx.fill(); }
    if (player) {
      ctx.fillStyle = '#fff'; ctx.font = '800 13px system-ui'; ctx.textAlign = 'right'; ctx.fillText(`${Math.max(0, Math.round(hpShown))} / ${mx}`, x + w - 14, y + 48);
      ctx.fillStyle = '#0b0a1e'; ctx.beginPath(); ctx.roundRect(bx, by + 18, bw, 7, 3.5); ctx.fill();
      ctx.fillStyle = '#4fc3ff'; ctx.beginPath(); ctx.roundRect(bx + 1, by + 19, Math.max(4, (bw - 2) * clamp(xp, 0, 1)), 5, 2.5); ctx.fill();
      if (mega && this.b) { ctx.fillStyle = '#ffe066'; ctx.textAlign = 'right'; ctx.font = '900 12px system-ui'; ctx.fillText(`⚡ MEGA ${this.b.mega.turns} turns`, x + w - 14, y + h - 10); }
      if (m.item) { ctx.textAlign = 'left'; ctx.font = '14px system-ui'; ctx.fillText(ITEMS[m.item].icon, x + 14, y + h - 12); }
    } else if (this.b?.kind === 'wild' && this.p!.dex.includes(m.sp)) {
      ctx.fillStyle = '#ffd23f'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'right'; ctx.fillText('★ owned', x + w - 14, y + 48);
    }
    ctx.restore();
  }
}

export const STARTER_LIST = STARTERS;
export { getMove };
