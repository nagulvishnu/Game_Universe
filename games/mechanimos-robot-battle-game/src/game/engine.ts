import { Floaters, Particles, clamp } from './fx';
import { audio } from './audio';
import { SPECIES } from './data';
import './roster'; // validates the canonical 30-roster at app load
import type {
  BattleCardsSnap, CardId, DraftRequest, HudSnap, RunStats,
  SpeciesDef, TeamEntry,
} from './types';
import { TAME_SCORE, TRAINER_SCORE, WIN_SCORE } from './types';
import { WorldScene, type EngageTarget } from './world';
import { BattleScene, type BattleResult } from './battle';
import { drawVignette } from './render';

export interface GameEvents {
  onHud(s: HudSnap): void;
  onDraft(req: DraftRequest): void;
  onBattleCards(s: BattleCardsSnap): void;
  onTamePrompt(show: boolean, species?: SpeciesDef): void;
  onToast(msg: string, color?: string): void;
  onGameOver(stats: RunStats, isNewBest: boolean): void;
  onPauseChange(paused: boolean): void;
  onSceneChange(scene: 'explore' | 'battle'): void;
}

let uidCounter = 100;

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  viewW = 0;
  viewH = 0;
  dpr = 1;

  // run state
  running = false;
  paused = false;
  scene: 'explore' | 'battle' = 'explore';
  world: WorldScene;
  battle: BattleScene | null = null;

  // meta state
  score = 0;
  lives = 3;
  wins = 0;
  losses = 0;
  tames = 0;
  tameCards = 3;
  team: TeamEntry[] = [];
  activeUidIndex = 0;
  runStart = 0;
  hint = 'Find a wild Mechanimo!';
  engageTarget: EngageTarget | null = null;
  muted = false;
  uiLocked = false;

  // fx
  particles = new Particles();
  floaters = new Floaters();
  trauma = 0;
  freeze = 0;

  // input
  keys = new Set<string>();
  joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };

  private cam = { x: 0, y: 0 };
  private zoom = 1;
  private raf = 0;
  private last = 0;
  private hudT = 0;
  private ev: GameEvents;
  private pendingDraft: EngageTarget | null = null;
  private gameOverTimer: number | null = null;

  constructor(canvas: HTMLCanvasElement, ev: GameEvents) {
    this.canvas = canvas;
    this.ev = ev;
    this.ctx = canvas.getContext('2d')!;
    this.world = new WorldScene(this);
    this.resize();
    this.bindInput();
  }

  // ================= lifecycle =================
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const rawDt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.tick(rawDt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    this.clearGameOverTimer();
    window.removeEventListener('resize', this.resize);
  }

  private clearGameOverTimer() {
    if (this.gameOverTimer !== null) {
      clearTimeout(this.gameOverTimer);
      this.gameOverTimer = null;
    }
  }

  // ================= run management =================
  newRun() {
    this.clearGameOverTimer(); // a stale defeat must never end a fresh run
    this.score = 0;
    this.lives = 3;
    this.wins = 0;
    this.losses = 0;
    this.tames = 0;
    this.tameCards = 3;
    this.team = [{ uid: uidCounter++, species: 'blaze', level: 1 }];
    this.activeUidIndex = 0;
    this.runStart = performance.now();
    this.hint = 'Find a wild Mechanimo!';
    this.scene = 'explore';
    this.paused = false;
    this.battle = null;
    this.particles.clear();
    this.floaters.clear();
    this.trauma = 0;
    this.world.reset();
    this.cam.x = 0; this.cam.y = 0;
    this.ev.onSceneChange('explore');
    this.emitHud();
  }

  quitToMenu() {
    this.clearGameOverTimer(); // a stale defeat must never pop over the menu
    this.newSilence();
    this.ev.onSceneChange('explore');
  }

  private newSilence() {
    this.paused = false;
    this.battle?.dispose();
    this.battle = null;
    this.scene = 'explore';
  }

  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    if (p) {
      // Drop held inputs so resume never inherits a stuck key/joystick.
      this.keys.clear();
      this.joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
      audio.click();
    }
    this.ev.onPauseChange(p);
  }

  setMuted(m: boolean) {
    this.muted = m;
    audio.setMuted(m);
  }

  // ================= input =================
  private keyHandler = (e: KeyboardEvent) => {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (e.type === 'keydown') {
      this.keys.add(k);
      if (k === 'e' || k === 'enter') this.tryEngage();
      if (k === 'p' || k === 'escape') this.setPaused(!this.paused);
      if (k === 'm') { this.setMuted(!this.muted); this.ev.onToast(this.muted ? 'SOUND OFF' : 'SOUND ON'); }
      if ((k === '1' || k === '2' || k === '3') && this.battle) {
        this.battle.playCard(Number(k) - 1);
      }
    } else {
      this.keys.delete(k);
    }
  };

  private blurHandler = () => {
    // Focus lost (alt-tab, devtools): drop held keys + joystick so the
    // hero never keeps moving with no key pressed ("stuck input").
    this.keys.clear();
    this.joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  };

  private ptrDown = (e: PointerEvent) => {
    audio.init();
    if (this.paused || this.scene !== 'explore') return;
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // left 55% = joystick zone
    if (x < rect.width * 0.55 && !this.joy.active) {
      this.joy = { active: true, id: e.pointerId, ox: x, oy: y, dx: 0, dy: 0 };
      c.setPointerCapture(e.pointerId);
    }
  };

  private ptrMove = (e: PointerEvent) => {
    if (this.joy.active && e.pointerId === this.joy.id) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const max = 60;
      this.joy.dx = clamp(x - this.joy.ox, -max, max);
      this.joy.dy = clamp(y - this.joy.oy, -max, max);
    }
  };

  private ptrUp = (e: PointerEvent) => {
    if (this.joy.active && e.pointerId === this.joy.id) {
      this.joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
    }
  };

  private bindInput() {
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('keyup', this.keyHandler);
    window.addEventListener('resize', this.resize);
    window.addEventListener('blur', this.blurHandler);

    const c = this.canvas;
    c.addEventListener('pointerdown', this.ptrDown);
    c.addEventListener('pointermove', this.ptrMove);
    c.addEventListener('pointerup', this.ptrUp);
    c.addEventListener('pointercancel', this.ptrUp);
  }

  unbindInput() {
    window.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('keyup', this.keyHandler);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('blur', this.blurHandler);

    const c = this.canvas;
    c.removeEventListener('pointerdown', this.ptrDown);
    c.removeEventListener('pointermove', this.ptrMove);
    c.removeEventListener('pointerup', this.ptrUp);
    c.removeEventListener('pointercancel', this.ptrUp);
  }

  private resize = () => {
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  };

  // ================= fx helpers =================
  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  hitFreeze(t: number) {
    this.freeze = Math.max(this.freeze, t);
  }

  addScore(n: number, x?: number, y?: number) {
    this.score += n;
    if (x !== undefined && y !== undefined) {
      this.floaters.add(x, y, `+${n}`, '#ffd166', 22);
    }
    this.emitHud();
  }

  setEngageTarget(t: EngageTarget | null) {
    const prev = this.engageTarget;
    const changed = (prev?.id ?? 0) !== (t?.id ?? 0) || (prev === null) !== (t === null);
    this.engageTarget = t;
    if (changed) {
      if (t) audio.hover();
      this.emitHud();
    }
  }

  // ================= battle flow (UI-facing) =================
  tryEngage() {
    if (this.uiLocked) return;
    if (this.scene !== 'explore' || this.paused || !this.engageTarget || this.battle) return;
    if (this.team.length === 0) return;
    audio.engage();
    this.pendingDraft = this.engageTarget;
    const t = this.engageTarget;
    const sp = SPECIES[t.species];
    const level = this.enemyLevel(sp, t.kind === 'trainer');
    const active = this.team[this.activeUidIndex];
    this.ev.onDraft({
      enemySpecies: sp,
      enemyLevel: level,
      isTrainer: t.kind === 'trainer',
      trainerName: t.kind === 'trainer' ? t.name.replace('RIDER ', '') : undefined,
      team: this.team.map((e) => ({ ...e })),
    });
    void active;
  }

  confirmDraft(cards: CardId[], teamIndex: number) {
    if (!this.pendingDraft) return;
    const t = this.pendingDraft;
    this.activeUidIndex = clamp(teamIndex, 0, this.team.length - 1);
    const mine = this.team[this.activeUidIndex];
    const sp = SPECIES[t.species];
    const foeLevel = this.enemyLevel(sp, t.kind === 'trainer');
    // level up the player's active mech alongside progress
    mine.level = 1 + Math.floor(this.wins / 3);
    this.battle = new BattleScene(this, {
      mySpecies: SPECIES[mine.species],
      myLevel: mine.level,
      foeSpecies: sp,
      foeLevel,
      isTrainer: t.kind === 'trainer',
      trainerName: t.kind === 'trainer' ? t.name.replace('RIDER ', '') : undefined,
      cards,
    });
    this.scene = 'battle';
    this.floaters.clear();
    this.particles.clear();
    this.ev.onSceneChange('battle');
    this.emitHud();
  }

  cancelDraft() {
    this.pendingDraft = null;
  }

  private enemyLevel(sp: SpeciesDef, trainer: boolean) {
    return 1 + Math.floor(this.wins / 2) + (sp.rarity - 1) + (trainer ? 1 : 0);
  }

  playCard(idx: number) {
    this.battle?.playCard(idx);
  }

  // ---- callbacks from BattleScene ----
  onBattleWon(isTrainer: boolean) {
    this.wins++;
    const pts = isTrainer ? TRAINER_SCORE : WIN_SCORE;
    this.score += pts;
    const perfect = this.battle ? this.battle.mine.hp === this.battle.mine.maxHp : false;
    if (perfect) {
      this.score += 150;
      this.ev.onToast('FLAWLESS VICTORY +150', '#ffd166');
    }
    this.hint = isTrainer ? 'Rival beaten! Their Mechanimo is yours!' : 'Wild Mechanimo weakened — tame it!';
    this.emitHud();
  }

  onBattleLost(isTrainer: boolean) {
    this.losses++;
    this.lives = Math.max(0, this.lives - 1);
    if (isTrainer && this.team.length > 1) {
      // rider steals your most recently tamed mechanimo
      const idx = this.team.length - 1;
      const stolen = this.team.splice(idx, 1)[0];
      if (this.activeUidIndex >= this.team.length) this.activeUidIndex = 0;
      this.ev.onToast(`${SPECIES[stolen.species].name} WAS TAKEN!`, '#ff5470');
    }
    this.hint = this.lives > 0 ? 'Patch up and get back out there!' : '';
    this.emitHud();
  }

  onTamePrompt(show: boolean, species?: SpeciesDef) {
    this.ev.onTamePrompt(show, species);
  }

  throwTame() {
    if (!this.battle) return;
    this.tameCards = Math.max(0, this.tameCards - 1);
    void this.battle.throwTame();
    this.emitHud();
  }

  releaseTame() {
    this.battle && void this.battle.releaseTame();
  }

  claimSpecies(sp: SpeciesDef, level: number) {
    if (this.team.length < 8) {
      this.team.push({ uid: uidCounter++, species: sp.id, level });
      this.tames++;
      const bonus = TAME_SCORE * sp.rarity;
      this.score += bonus;
    } else {
      this.score += TAME_SCORE * sp.rarity; // convert to points when crew is full
      this.tames++;
    }
    this.emitHud();
  }

  endBattle(result: BattleResult) {
    const t = this.pendingDraft;
    if (t) {
      if (result === 'lost') {
        // a victorious wild mechanimo escapes; a victorious rider struts off
        if (t.kind === 'wild') this.world.removeWild(t.id);
      } else {
        if (t.kind === 'wild') this.world.removeWild(t.id);
        else this.world.removeTrainer(t.id);
      }
    }
    this.pendingDraft = null;
    this.battle?.dispose();
    this.battle = null;
    this.scene = 'explore';
    this.ev.onSceneChange('explore');
    this.ev.onBattleCards({ cards: [], cooldowns: [], yourTurn: false, locked: true });
    this.emitHud();
    if (result === 'lost' && this.lives <= 0) {
      const stats: RunStats = {
        score: this.score, tames: this.tames, wins: this.wins,
        losses: this.losses, timeMs: performance.now() - this.runStart,
        bestCombo: 0,
      };
      const best = this.loadBest();
      const isNewBest = stats.score > best;
      if (isNewBest) this.saveBest(stats.score);
      this.gameOverTimer = window.setTimeout(() => {
        this.gameOverTimer = null;
        this.ev.onGameOver(stats, isNewBest);
      }, 350);
    } else {
      this.ev.onToast(
        result === 'tamed' ? 'Mechanimo added to your crew!'
        : result === 'claimed' ? 'Rival\'s Mechanimo claimed!'
        : result === 'lost' ? (this.lives > 0 ? `${this.lives} repair wrench${this.lives > 1 ? 'es' : ''} left` : '')
        : 'The wild Mechanimo fled',
        result === 'lost' ? '#ff5470' : '#4ade80',
      );
    }
  }

  loadBest(): number {
    try { return Number(localStorage.getItem('mech_best') ?? 0) || 0; } catch { return 0; }
  }
  saveBest(v: number) {
    try { localStorage.setItem('mech_best', String(v)); } catch { /* noop */ }
  }

  emitHud() {
    this.ev.onHud({
      score: this.score,
      lives: this.lives,
      teamCount: this.team.length,
      tameCards: this.tameCards,
      wins: this.wins,
      hint: this.hint,
      engageName: this.engageTarget ? this.engageTarget.name : '',
      engageKind: this.engageTarget ? (this.engageTarget.kind as 'wild' | 'trainer') : '',
    });
  }

  emitBattleCards(s: BattleCardsSnap) {
    this.ev.onBattleCards(s);
  }

  // ================= frame =================
  private tick(rawDt: number) {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    if (w === 0 || h === 0) return;

    // hit-freeze (juice)
    let dt = rawDt;
    if (this.freeze > 0) {
      this.freeze -= rawDt;
      dt = rawDt * 0.08;
    }
    if (this.paused) dt = 0;

    // movement vector
    let mx = 0, my = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    if (this.joy.active) {
      mx += this.joy.dx / 40;
      my += this.joy.dy / 40;
    }
    const n = Math.hypot(mx, my);
    if (n > 1) { mx /= n; my /= n; }
    if (this.uiLocked && this.scene === 'explore') { mx = 0; my = 0; }

    // zoom by viewport (smaller screens zoom out a bit for visibility)
    this.zoom = clamp(Math.min(w, h) / 620, 0.68, 1.1);

    // update
    if (dt > 0) {
      if (this.scene === 'explore') {
        this.world.update(dt, mx, my);
        this.cam.x += (this.world.hero.x - this.cam.x) * Math.min(1, dt * 6);
        this.cam.y += (this.world.hero.y - this.cam.y) * Math.min(1, dt * 6);
      } else if (this.battle) {
        this.battle.update(dt);
      }
      this.particles.update(dt);
      this.floaters.update(dt);
      this.trauma = Math.max(0, this.trauma - rawDt * 1.6);
    }

    // hud refresh ~8Hz (cheap)
    this.hudT += rawDt;
    if (this.hudT > 0.12) {
      this.hudT = 0;
      this.emitHud();
    }

    // ================= render =================
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#08041a';
    ctx.fillRect(0, 0, w, h);

    // screen shake offset
    const sh = this.trauma * this.trauma;
    const shX = sh * 14 * (Math.random() * 2 - 1);
    const shY = sh * 14 * (Math.random() * 2 - 1);

    if (this.scene === 'explore') {
      ctx.save();
      ctx.translate(w / 2 + shX, h / 2 + shY);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.cam.x, -this.cam.y);
      this.world.draw(ctx, this.cam.x, this.cam.y, w, h, this.zoom);
      this.particles.draw(ctx, this.cam.x, this.cam.y);
      this.floaters.draw(ctx, this.cam.x, this.cam.y);
      ctx.restore();
      this.world.drawEdgePointers(ctx, this.cam.x, this.cam.y, w, h, this.zoom);
      drawVignette(ctx, w, h, 0.62);
      this.drawJoystick(ctx);
    } else if (this.battle) {
      ctx.save();
      ctx.translate(shX, shY);
      this.battle.draw(ctx);
      ctx.restore();
      drawVignette(ctx, w, h, 0.5);
    }
  }

  private drawJoystick(ctx: CanvasRenderingContext2D) {
    if (!this.joy.active) return;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.joy.ox, this.joy.oy, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(this.joy.ox + this.joy.dx, this.joy.oy + this.joy.dy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export type { EngageTarget };
