// Renderer + game loop: split-screen cameras, characters, shuttle, effects, event feedback, HUD publishing.
import * as THREE from 'three';
import { ArenaId, DIFF_LIST } from './constants';
import { buildArena, ArenaBuild } from './arenas';
import { Character } from './character';
import { Particles, Trail, Flashes } from './effects';
import { audio } from './audio';
import { input } from './input';
import { LaunchConfig, Sim, InputState, SimEvent, noInput } from './sim';
import { SPECIAL_LABEL, Special } from './shots';
import { MatchResult, useUI, HudState } from './store';
import { attractConfig } from './modes';
import { COLORS, DEFAULT_LOOKS, TRAILS } from './storage';

interface Rig { cam: THREE.PerspectiveCamera; pos: THREE.Vector3; look: THREE.Vector3; mode: number; human: number; init: boolean; punch: number }

const GRADE_COL = { perfect: '#ffd23f', good: '#7dffb0', normal: '#ffffff', poor: '#ff7a7a' } as const;
const SPECIAL_STYLE: Record<Special, { color: string; w: number; len: number; rainbow?: boolean }> = {
  perfectSmash: { color: '#ffcf4a', w: 1.5, len: 26 },
  superSmash: { color: '#ff2b6e', w: 1.9, len: 28, rainbow: true },
  lightning: { color: '#7df9ff', w: 1.1, len: 24 },
  phantom: { color: '#e0b3ff', w: 0.9, len: 18 },
  precision: { color: '#8cff9e', w: 1, len: 22 },
  perfectCross: { color: '#ff9d3c', w: 1.2, len: 22 },
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class GameView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  arena: ArenaBuild | null = null;
  arenaId: ArenaId | null = null;
  sim: Sim | null = null;
  cfg: LaunchConfig | null = null;
  mode: 'idle' | 'attract' | 'play' = 'idle';
  chars: Character[] = [];
  shadows: THREE.Mesh[] = [];
  shuttle = new THREE.Group();
  shuttleShadow: THREE.Mesh;
  landMark: THREE.Mesh;
  trail = new Trail(32);
  particles = new Particles(900, 0.2);
  flashes = new Flashes();
  rigs: Rig[] = [];
  targetMeshes: THREE.Mesh[] = [];
  coneMesh: THREE.Mesh;
  feeder = new THREE.Group();
  paused = false;
  private raf = 0;
  private last = performance.now();
  private time = 0;
  private slowT = 0;
  private timeScale = 1;
  private shake = 0;
  private excite = 0;
  private hudT = 0;
  private endTimer = -1;
  private finished = false;
  private confetti = 0;
  private frameN = 0;
  private fpsAcc = 0; private fpsN = 0;
  private pr: number;
  private lastLand = { x: 0, z: 0, show: false };
  private attractT = 0;
  private lastMeterFull = [false, false];
  private tmpV = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private UP = new THREE.Vector3(0, 1, 0);
  private dtReal = 1 / 60;
  private camLook = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private shakeV = new THREE.Vector3();
  private shuttleV = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    this.pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(this.particles.points, this.trail.mesh, this.flashes.group);
    // shuttle model
    const cork = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshLambertMaterial({ color: '#ffb3c7', emissive: '#552233' }));
    cork.position.y = 0.06;
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.16, 12, 1, true), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#6a7080', side: THREE.DoubleSide }));
    skirt.position.y = -0.03;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 4, 14), new THREE.MeshBasicMaterial({ color: '#dfe6ff' }));
    rim.rotation.x = Math.PI / 2; rim.position.y = -0.11;
    this.shuttle.add(cork, skirt, rim);
    this.shuttle.scale.setScalar(1.9);
    this.scene.add(this.shuttle);
    this.shuttleShadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.4, depthWrite: false }));
    this.shuttleShadow.rotation.x = -Math.PI / 2; this.shuttleShadow.position.y = 0.012;
    this.scene.add(this.shuttleShadow);
    this.landMark = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 28), new THREE.MeshBasicMaterial({ color: '#7df9ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.landMark.rotation.x = -Math.PI / 2; this.landMark.position.y = 0.03; this.landMark.visible = false;
    this.scene.add(this.landMark);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.visible = false;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 0.97, 32), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.z = 0.001; m.add(ring);
      this.scene.add(m); this.targetMeshes.push(m);
    }
    this.coneMesh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 14), new THREE.MeshBasicMaterial({ color: '#ff8a1f' }));
    this.coneMesh.visible = false; this.scene.add(this.coneMesh);
    const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 12), new THREE.MeshLambertMaterial({ color: '#2d3340' }));
    fb.position.y = 0.55;
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.8, 10), new THREE.MeshLambertMaterial({ color: '#ff4d6d' }));
    noz.position.set(0, 1.4, 0.2); noz.rotation.x = -0.6;
    this.feeder.add(fb, noz); this.feeder.position.set(0, 0, -8.4); this.feeder.visible = false;
    this.scene.add(this.feeder);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }

  resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
  };

  private setArena(id: ArenaId) {
    if (this.arenaId === id && this.arena) return;
    if (this.arena) this.scene.remove(this.arena.group);
    const low = useUI.getState().settings.quality === 'low';
    this.arena = buildArena(id, low);
    this.arenaId = id;
    this.scene.add(this.arena.group);
    this.scene.background = this.arena.bg;
    this.scene.fog = this.arena.fog;
  }

  private buildScene(cfg: LaunchConfig, attract: boolean) {
    this.cfg = cfg;
    this.setArena(cfg.arena);
    for (const c of this.chars) this.scene.remove(c.root);
    for (const s of this.shadows) this.scene.remove(s);
    this.chars = []; this.shadows = [];
    this.sim = new Sim(cfg);
    this.sim.players.forEach((p) => {
      const ch = new Character();
      const fallback = DEFAULT_LOOKS[p.team];
      ch.setLook(p.look ?? { ...fallback, color: (p.id * 2 + 1) % COLORS.length }, p.id);
      this.scene.add(ch.root);
      this.chars.push(ch);
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.38, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.position.y = 0.014;
      this.scene.add(sh); this.shadows.push(sh);
    });
    this.rigs = [];
    const n = attract ? 1 : Math.max(1, cfg.humans);
    for (let i = 0; i < n; i++) {
      this.rigs.push({ cam: new THREE.PerspectiveCamera(56, 1.6, 0.1, 160), pos: new THREE.Vector3(), look: new THREE.Vector3(), mode: 0, human: attract ? -1 : i, init: false, punch: 0 });
    }
    this.feeder.visible = cfg.kind === 'drill' && cfg.drill?.kind !== 'serve' && cfg.drill?.kind !== 'movement';
    this.endTimer = -1; this.finished = false; this.slowT = 0; this.timeScale = 1; this.shake = 0; this.confetti = 0;
    this.trail.reset(0, -50, 0);
    this.lastMeterFull = [false, false];
  }

  start(cfg: LaunchConfig) {
    audio.init();
    audio.apply(useUI.getState().settings);
    this.mode = 'play';
    this.paused = false;
    input.humans = cfg.humans;
    input.gameActive = true;
    input.clearKeys();
    this.buildScene(cfg, false);
    audio.startMusic({ neon: 220, royal: 196, tropical: 247, cyber: 208, mountain: 185, grand: 233 }[cfg.arena]);
  }

  attract() {
    const unlocked = useUI.getState().progress.unlocked;
    const id = unlocked[(Math.random() * unlocked.length) | 0] ?? 'neon';
    this.mode = 'attract';
    this.paused = false;
    input.gameActive = false;
    this.attractT = 0;
    this.buildScene(attractConfig(id), true);
  }
  stop() { this.mode = 'idle'; input.gameActive = false; }

  setPaused(b: boolean) { this.paused = b; if (b) audio.whoosh(0, false); }

  // ---------------- main loop ----------------
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const real = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += real;
    this.dtReal = real;
    this.adapt(real);
    input.pollPads();
    if (this.sim) {
      if (this.mode === 'play') this.updatePlay(real);
      else if (this.mode === 'attract') this.updateAttract(real);
    }
    this.render();
    input.endFrame();
  };

  private adapt(real: number) {
    const q = useUI.getState().settings.quality;
    if (q === 'high') return;
    this.fpsAcc += real; this.fpsN++;
    if (this.fpsN >= 90) {
      const avg = this.fpsAcc / this.fpsN;
      if (avg > 0.0225 && this.pr > 0.75) { this.pr = Math.max(0.75, this.pr - 0.2); this.resize(); }
      else if (q === 'low' && this.pr > 1) { this.pr = 1; this.resize(); }
      this.fpsAcc = 0; this.fpsN = 0;
    }
  }

  private updateAttract(real: number) {
    const sim = this.sim!;
    this.attractT += real;
    sim.update(real, []);
    this.handleEvents(sim.drainEvents());
    if (sim.phase === 'over' || this.attractT > 70) this.attract();
    this.updateVisuals(real, real);
  }

  private updatePlay(real: number) {
    const sim = this.sim!;
    const ui = useUI.getState();
    if (input.takePause() && this.endTimer < 0 && ui.screen === 'game') ui.setPaused(!ui.paused);
    if (input.takeRestart() && (ui.paused || this.endTimer >= 0 || sim.phase === 'over')) { ui.engine?.restart(); return; }
    this.paused = ui.paused;
    for (const r of this.rigs) if (r.human >= 0 && input.takeCam(r.human)) { r.mode = (r.mode + 1) % 3; }
    if (this.paused) { this.updateVisuals(0, 0); return; }
    const inputs: InputState[] = [];
    for (let h = 0; h < sim.cfg.humans; h++) inputs.push(this.endTimer >= 0 ? noInput() : input.pollHuman(h));
    // slow-motion moment
    if (this.slowT > 0) { this.slowT -= real; this.timeScale += (0.28 - this.timeScale) * Math.min(1, real * 14); }
    else this.timeScale += (1 - this.timeScale) * Math.min(1, real * 6);
    const dt = real * this.timeScale;
    sim.update(dt, inputs);
    this.handleEvents(sim.drainEvents());
    this.updateVisuals(dt, real);
    if (this.endTimer >= 0) {
      this.endTimer -= real;
      if (this.endTimer < 0 && !this.finished) this.finish();
    }
    this.hudT -= real;
    if (this.hudT <= 0) { this.hudT = 0.09; this.publishHud(); }
  }

  // ---------------- events → feedback ----------------
  private feedTo(vp: number, text: string, kind: string) { useUI.getState().pushFeed(vp, text, kind); }
  private feedAll(text: string, kind: string) {
    const n = Math.max(1, this.sim?.cfg.humans ?? 1);
    for (let i = 0; i < n; i++) this.feedTo(i, text, kind);
  }
  private doShake(a: number) { if (useUI.getState().settings.shake) this.shake = Math.min(1, Math.max(this.shake, a)); }

  private handleEvents(evs: SimEvent[]) {
    const sim = this.sim!;
    for (const e of evs) {
      switch (e.t) {
        case 'swing': audio.swing(); break;
        case 'jump': audio.jump(); if (sim.players[e.p].human >= 0) this.particles.emit(sim.players[e.p].x, 0.05, sim.players[e.p].z, 8, { speed: 1.5, color: '#ffffff', life: 0.4, gravity: 1 }); break;
        case 'step': if (sim.players[e.p].human >= 0) audio.step(e.v); break;
        case 'whiff': if (sim.players[e.p].human >= 0 && sim.players[e.p].human < 2) this.feedTo(sim.players[e.p].human, 'MISS', 'bad'); break;
        case 'hit': this.onHit(e); break;
        case 'net':
          audio.net(); this.particles.emit(e.x, e.y, 0, 12, { speed: 2, color: '#ffffff', life: 0.5, gravity: 4 });
          this.doShake(0.1); this.feedAll('NET!', 'bad');
          break;
        case 'landing': {
          const good = e.inBounds;
          this.flashes.ring(e.x, e.z, good ? '#7df9ff' : '#ff4d6d', 0.9, 0.6);
          this.particles.emit(e.x, 0.05, e.z, good ? 12 : 8, { speed: 2.2, color: good ? '#bff6ff' : '#ff9aa8', life: 0.5, gravity: 5, up: 1 });
          audio.land(good);
          break;
        }
        case 'point': this.onPoint(e); break;
        case 'let': this.feedAll('LET', 'info'); break;
        case 'gameEnd':
          this.feedAll('GAME!', 'big'); audio.fanfare(e.winner === 0); this.excite = 1;
          break;
        case 'changeEnds': this.feedAll('CHANGE ENDS', 'info'); break;
        case 'serveReady': {
          const tc = sim.cfg.teams[e.team];
          const name = tc.names[e.slot];
          const isHuman = tc.humans[e.slot] >= 0;
          if (isHuman) this.feedTo(tc.humans[e.slot], 'YOUR SERVE', 'info');
          this.hudT = 0;
          void name;
          break;
        }
        case 'matchEnd': this.onMatchEnd(e.winner); break;
        case 'drillEnd': this.endTimer = 1.4; audio.fanfare(e.success); break;
        case 'feed': this.particles.emit(e.x, e.y, e.z, 6, { speed: 1.5, color: '#ff9aa8', life: 0.35, gravity: 0 }); audio.swing(); break;
        case 'zone': this.flashes.ring(e.x, e.z, '#ffd23f', 1.6, 0.8); this.particles.emit(e.x, 0.3, e.z, 30, { speed: 4, color: '#ffd23f', up: 3, life: 0.9 }); audio.chime(); this.feedTo(0, 'TARGET!', 'perfect'); break;
        case 'cone': this.flashes.ring(e.x, e.z, '#ff8a1f', 1.2, 0.6); this.particles.emit(e.x, 0.3, e.z, 18, { speed: 3, color: '#ffb36b', up: 2 }); audio.ui(); break;
        case 'drillMiss': this.feedTo(0, e.msg, 'bad'); break;
        default:
      }
    }
  }

  private onHit(e: SimEvent) {
    const sim = this.sim!;
    const p = sim.players[e.p];
    const grade = e.grade as keyof typeof GRADE_COL;
    const special = e.special as Special | null;
    const col = special ? SPECIAL_STYLE[special].color : GRADE_COL[grade];
    const power = Math.min(1, e.speed / 45);
    this.flashes.flash(e.x, e.y, e.z, col, special ? 1.1 : grade === 'perfect' ? 0.8 : 0.45);
    const count = special ? 70 : grade === 'perfect' ? 34 : grade === 'good' ? 18 : grade === 'normal' ? 10 : 5;
    this.particles.emit(e.x, e.y, e.z, count, { speed: 2.5 + power * 5, color: col, life: special ? 0.9 : 0.55, gravity: special ? 2 : 6 });
    if (special) this.flashes.ring(e.x, e.z, col, 1.2, 0.7, 0.04);
    // trail
    const look = p.look ?? DEFAULT_LOOKS[p.team];
    const tr = TRAILS[look.trail % TRAILS.length];
    if (special) { const s = SPECIAL_STYLE[special]; this.trail.style(s.color, !!s.rainbow, s.w, s.len); }
    else this.trail.style(tr.color, tr.rainbow, 0.5 + power * 0.5, 10 + Math.round(power * 10));
    this.trail.reset(e.x, e.y, e.z);
    audio.hit(grade, special, e.speed);
    this.excite = Math.max(this.excite, special ? 0.8 : grade === 'perfect' ? 0.5 : 0.15);
    if (!e.serve) audio.crowd(special ? 0.7 : 0.1);
    this.doShake(special ? 0.55 : grade === 'perfect' ? 0.25 : power > 0.7 ? 0.14 : 0.05);
    if (special === 'perfectSmash' || special === 'superSmash') {
      this.slowT = 0.55;
      for (const r of this.rigs) r.punch = -10;
    } else if (special) {
      for (const r of this.rigs) r.punch = -4;
    }
    // feedback texts in the hitter's viewport
    if (p.human >= 0 && p.human < this.rigs.length && !e.serve) {
      const txt = grade === 'perfect' ? 'PERFECT!' : grade === 'good' ? 'GOOD' : grade === 'normal' ? 'NICE' : 'WEAK';
      this.feedTo(p.human, txt, grade);
      if (special) this.feedTo(p.human, SPECIAL_LABEL[special], 'special');
      if (p.meter >= 100 && !this.lastMeterFull[p.human]) { this.lastMeterFull[p.human] = true; this.feedTo(p.human, 'SUPER READY — SPACE', 'special'); }
      if (special === 'superSmash') this.lastMeterFull[p.human] = false;
    }
    if (special && p.human < 0) this.feedAll(SPECIAL_LABEL[special], 'bad');
  }

  private onPoint(e: SimEvent) {
    const sim = this.sim!;
    this.excite = Math.max(this.excite, e.smash ? 1 : 0.7);
    const humanWon = sim.cfg.teams[e.winner].humans.some((h) => h >= 0);
    audio.point(humanWon);
    if (humanWon) audio.cheer(e.rallyLen > 8 || e.smash); else audio.groan();
    this.feedAll(e.label, e.smash ? 'special' : e.reason === 'in' ? 'big' : 'bad');
    if (e.rallyLen >= 10) this.feedAll(`${e.rallyLen}-SHOT RALLY`, 'info');
    this.doShake(e.smash ? 0.35 : 0.12);
    const st = sim.rules.teams[sim.rules.serverTeam];
    const other = sim.rules.teams[1 - sim.rules.serverTeam];
    if (e.result === 'point') audio.speak(`${st.score} ${other.score}`);
    else if (e.result === 'game') audio.speak('Game');
    this.hudT = 0;
  }

  private onMatchEnd(winner: number) {
    const sim = this.sim!;
    this.confetti = 3.5;
    this.endTimer = 3.2;
    const humanWon = sim.cfg.teams[winner].humans.some((h) => h >= 0) || sim.cfg.humans === 0;
    audio.fanfare(humanWon);
    audio.speak(`${sim.cfg.teams[winner].names.join(' and ')} wins`);
    this.excite = 1;
    this.publishHud();
  }

  private finish() {
    const sim = this.sim!;
    this.finished = true;
    const cfg = sim.cfg;
    const ui = useUI.getState();
    if (cfg.kind === 'drill') {
      const D = sim.drill!;
      const r: MatchResult = {
        kind: 'drill', label: cfg.label, winner: -1, humanWon: D.success, names: [cfg.teams[0].names[0], ''], games: [], final: [D.score, 0],
        duration: sim.time, rallies: 0, longest: D.best, smashPoints: [D.smashPoints, 0], perfect: [D.perfects, 0],
        accuracy: [D.returns + D.misses > 0 ? Math.round((D.returns / (D.returns + D.misses)) * 100) : 0, 0],
        score: D.score, newHigh: false, rank: 0, success: D.cfg.timeLimit > 0 ? D.success : undefined,
        drill: { score: D.score, returns: D.returns, best: D.best, zoneHits: D.zoneHits, misses: D.misses, goal: D.cfg.goal, kind: D.cfg.kind },
        humans: 1,
      };
      ui.finishMatch(r);
      return;
    }
    const rs = sim.rules;
    const winner = sim.winner === -1 ? 0 : sim.winner;
    const humanTeam0 = cfg.teams[0].humans.some((h) => h >= 0);
    const totalPts = rs.gameScores.reduce((a, g) => a + g[0], 0);
    const st = sim.stats;
    const diffMult = cfg.humans === 1 ? 1 + DIFF_LIST.indexOf(cfg.teams[1].diff) * 0.25 : 1;
    const humanWon = winner === 0 && humanTeam0;
    const score = Math.round((totalPts * 100 + st.perfect[0] * 40 + st.smashPoints[0] * 60 + st.longest * 10 + (humanWon ? 500 : 0)) * diffMult);
    const pct = (t: number) => (st.shots[t] ? Math.round((st.shotsIn[t] / st.shots[t]) * 100) : 0);
    const last = rs.gameScores[rs.gameScores.length - 1] ?? [rs.teams[0].score, rs.teams[1].score];
    const r: MatchResult = {
      kind: 'match', label: cfg.label, winner, humanWon, names: [cfg.teams[0].names.join(' & '), cfg.teams[1].names.join(' & ')],
      games: rs.gameScores.slice(), final: [last[0], last[1]], duration: sim.time, rallies: st.rallies, longest: st.longest,
      smashPoints: [st.smashPoints[0], st.smashPoints[1]], perfect: [st.perfect[0], st.perfect[1]], accuracy: [pct(0), pct(1)],
      score: cfg.humans > 0 ? score : 0, newHigh: false, rank: 0, context: cfg.context, humans: cfg.humans,
    };
    ui.finishMatch(r);
  }

  forfeitStats() { /* no-op: quitting a match mid-way records nothing */ }

  // ---------------- HUD ----------------
  private publishHud() {
    const sim = this.sim;
    if (!sim) return;
    const rs = sim.rules;
    const cfg = sim.cfg;
    const drill = sim.drill;
    const humans = cfg.humans;
    const meters: number[] = [], stamina: number[] = [], timings: HudState['timings'] = [];
    for (let h = 0; h < humans; h++) {
      const p = sim.players.find((q) => q.human === h);
      meters.push(p ? p.meter : 0); stamina.push(p ? p.stamina : 0);
      timings.push(p ? { show: p.timing.show && sim.phase === 'rally' || (p.timing.show && sim.phase === 'drill'), prox: p.timing.prox, grade: p.timing.grade, inReach: p.timing.inReach, score: p.timing.score } : { show: false, prox: 0, grade: 'normal', inReach: false, score: 0 });
    }
    let msg = '', sub = '';
    const srvName = cfg.teams[rs.serverTeam].names[sim.serve.serverSlot] ?? '';
    if (sim.phase === 'intro') { msg = 'GET READY'; sub = cfg.label; }
    else if (sim.phase === 'serve') {
      const server = sim.players.find((p) => sim.isServer(p));
      sub = server && server.human >= 0 ? 'Serve: 1 high · 2 short · 3 wide · 4 flat' : `${srvName} serves`;
    } else if (sim.phase === 'point' || sim.phase === 'gameBreak') {
      msg = sim.pointInfo?.label ?? '';
      if (sim.phase === 'gameBreak') sub = 'Changing ends…';
    } else if (sim.phase === 'over' && !drill) {
      msg = `${cfg.teams[sim.winner === -1 ? 0 : sim.winner].names.join(' & ')} WIN`;
    }
    const t0 = rs.teams[0], t1 = rs.teams[1];
    const lead = t0.score > t1.score ? t0 : t1;
    const other = lead === t0 ? t1 : t0;
    const matchPoint = !drill && lead.score >= rs.cfg.pointsToWin - 1 && lead.score > other.score && lead.games + 1 >= rs.cfg.gamesToWin;
    const hud: HudState = {
      phase: sim.phase,
      teams: [
        { names: cfg.teams[0].names, score: t0.score, games: t0.games },
        { names: cfg.teams[1].names, score: t1.score, games: t1.games },
      ],
      serverTeam: rs.serverTeam, serverSlot: sim.serve.serverSlot, gameNo: rs.gameNo, gamesToWin: rs.cfg.gamesToWin, pointsToWin: rs.cfg.pointsToWin,
      time: sim.time, meters, stamina, timings, doubles: rs.cfg.doubles, humans, msg, sub,
      drill: drill ? { label: drill.cfg.label, score: drill.score, streak: drill.streak, best: drill.best, returns: drill.returns, misses: drill.misses, timeLeft: drill.timeLeft, timeLimit: drill.cfg.timeLimit, zoneHits: drill.zoneHits, goal: drill.cfg.goal, kind: drill.cfg.kind, msg: drill.msg, cones: drill.cones, perfectSmashes: drill.smashPerfects } : null,
      camModes: this.rigs.map((r) => r.mode), arcade: rs.cfg.arcade, label: cfg.label, matchPoint,
    };
    useUI.setState({ hud });
  }

  // ---------------- visuals ----------------
  private updateVisuals(dt: number, real: number) {
    const sim = this.sim!;
    const sh = sim.shuttle;
    this.frameN++;
    sim.players.forEach((p, i) => {
      this.chars[i].update(p, sh, dt, this.time);
      this.shadows[i].position.x = p.x; this.shadows[i].position.z = p.z;
      const s = 1 - Math.min(0.6, p.y * 0.4);
      this.shadows[i].scale.setScalar(s);
    });
    // shuttle
    const vis = sh.visible && (sh.active || sh.held || sh.landedT < 1.4);
    this.shuttle.visible = vis; this.shuttleShadow.visible = vis;
    if (vis) {
      this.shuttle.position.set(sh.x, sh.y, sh.z);
      if (sh.active) {
        const sp = Math.hypot(sh.vx, sh.vy, sh.vz) || 1;
        this.tmpV.set(sh.vx / sp, sh.vy / sp, sh.vz / sp);
        this.tmpQ.setFromUnitVectors(this.UP, this.tmpV);
        this.shuttle.quaternion.slerp(this.tmpQ, Math.min(1, real * 30 + 0.2));
      } else if (sh.held) {
        this.shuttle.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.2);
      } else {
        this.shuttle.position.y = 0.05;
        this.shuttle.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 - 0.2);
      }
      this.shuttleShadow.position.set(sh.x, 0.012, sh.z);
      this.shuttleShadow.scale.setScalar(clamp(1.1 - sh.y * 0.1, 0.4, 1.1));
    }
    this.trail.push(sh.x, sh.y, sh.z, sh.active && !sh.netTouched, real);
    audio.whoosh(sh.speed, sh.active);
    // predicted landing marker for human receivers
    if (this.mode === 'play' && this.frameN % 3 === 0) {
      const heading = sh.active && sim.players.some((p) => p.human >= 0 && sim.heading(p));
      if (heading) {
        const l = sim.predictedLanding();
        if (l) this.lastLand = { x: l.x, z: l.z, show: true };
      } else this.lastLand.show = false;
    }
    this.landMark.visible = this.lastLand.show && sh.active;
    if (this.landMark.visible) {
      this.landMark.position.set(this.lastLand.x, 0.03, this.lastLand.z);
      const out = Math.abs(this.lastLand.x) > sim.hw + 0.05 || Math.abs(this.lastLand.z) > 6.75;
      (this.landMark.material as THREE.MeshBasicMaterial).color.set(out ? '#ff6b81' : '#7df9ff');
      this.landMark.scale.setScalar(1 + Math.sin(this.time * 12) * 0.08);
    }
    // drill visuals
    const D = sim.drill;
    this.targetMeshes.forEach((m, i) => {
      const t = D?.targets[i];
      m.visible = !!t;
      if (t) { m.position.set(t.x, 0.025, t.z); m.scale.setScalar(t.r / 0.95 * (1 + Math.sin(this.time * 4 + i) * 0.04)); }
    });
    this.coneMesh.visible = !!D?.cone;
    if (D?.cone) { this.coneMesh.position.set(D.cone.x, 0.3, D.cone.z); this.coneMesh.rotation.y += dt * 2; }
    // confetti
    if (this.confetti > 0) {
      this.confetti -= real;
      const cols = ['#ffd23f', '#ff4d6d', '#2ec4ff', '#5dff8a', '#b46bff'];
      this.particles.emit((Math.random() - 0.5) * 8, 7, (Math.random() - 0.5) * 12, 5, { speed: 1.2, color: cols[(Math.random() * cols.length) | 0], life: 2.2, gravity: 3, spread: 0.6, up: -1 });
    }
    this.excite = Math.max(0, this.excite - real * 0.45);
    this.shake = Math.max(0, this.shake - real * 2.2);
    this.particles.update(dt);
    this.flashes.update(real);
    this.arena?.update(this.time, real, this.excite);
  }

  private updateRig(r: Rig, real: number, aspect: number) {
    const sim = this.sim!;
    const sh = sim.shuttle;
    const cam = r.cam;
    const pos = this.camPos;
    const look = this.camLook.set(0, 0, 0);
    if (r.human < 0) {
      const a = this.time * 0.1;
      pos.set(Math.sin(a) * 15, 5.5 + Math.sin(this.time * 0.2) * 1.2, Math.cos(a) * 17);
      look.set(0, 1.1, 0);
    } else {
      const p = sim.players.find((q) => q.human === r.human)!;
      const side = p.side;
      const tracking = sim.phase === 'point' ? 0.55 : sh.active ? 0.3 : 0;
      if (r.mode === 0) {
        pos.set(p.x * 0.72, 3.5 + p.y * 0.35, side * clamp(Math.abs(p.z) + 5.4, 6.8, 12.8));
        look.set(p.x * 0.3, 0.9, -side * 3.2);
      } else if (r.mode === 1) {
        pos.set(p.x * 0.4, 6.8, side * clamp(Math.abs(p.z) + 7.5, 9, 13.5));
        look.set(0, 0.4, -side * 2);
      } else {
        pos.set(0, 9.5, side * 14.5);
        look.set(0, 0, -side * 1.5);
      }
      if (tracking > 0 && sh.visible) look.lerp(this.shuttleV.set(sh.x, sh.y * 0.7, sh.z), tracking);
    }
    if (!r.init) { r.pos.copy(pos); r.look.copy(look); r.init = true; }
    r.pos.lerp(pos, 1 - Math.exp(-4.5 * real));
    r.look.lerp(look, 1 - Math.exp(-6.5 * real));
    cam.position.copy(r.pos);
    const s = this.shake;
    if (s > 0) cam.position.add(this.shakeV.set((Math.random() - 0.5) * s * 0.5, (Math.random() - 0.5) * s * 0.4, (Math.random() - 0.5) * s * 0.3));
    cam.lookAt(r.look);
    if (s > 0) cam.rotation.z += (Math.random() - 0.5) * s * 0.03;
    r.punch += (0 - r.punch) * Math.min(1, real * 4.5);
    cam.aspect = aspect;
    const base = 54 + clamp(1.5 - aspect, 0, 1) * 34;
    cam.fov = base + r.punch;
    cam.updateProjectionMatrix();
  }

  private render() {
    const r = this.renderer;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!this.sim || this.rigs.length === 0) { r.setScissorTest(false); r.setViewport(0, 0, w, h); r.clear(); return; }
    const real = this.dtReal;
    const n = this.rigs.length;
    r.setScissorTest(n > 1);
    this.rigs.forEach((rig, i) => {
      let x = 0, y = 0, vw = w, vh = h;
      if (n > 1) {
        if (w >= h) { vw = Math.floor(w / 2) - 1; x = i === 0 ? 0 : Math.ceil(w / 2) + 1; }
        else { vh = Math.floor(h / 2) - 1; y = i === 0 ? Math.ceil(h / 2) + 1 : 0; }
      }
      this.updateRig(rig, real, vw / Math.max(1, vh));
      r.setViewport(x, y, vw, vh);
      r.setScissor(x, y, vw, vh);
      r.render(this.scene, rig.cam);
    });
  }
}
