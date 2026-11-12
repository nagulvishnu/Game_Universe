import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  REGIONS, RARITY, RARITIES, TYPE_INFO, WEAPONS, getFloorSpec, bossSpec, endlessSpec, trainingSpec, challengeSpec, masterySpec, secretSpec, rollItem, bossDrop, rankFor,
  type FloorSpec, type Item, type EnemyDef, type WeaponFamily,
} from './data';
import {
  useStore, useHud, banner, toast, persist, setFloor, gainXp, addItem, addGold, addEssence, bumpStat, addMastery, recordFloor, recordBoss, addScore as addHiScore, checkAchievements, ensureQuests,
  xpNeed, isTouchDevice, type ResultData,
} from './store';
import { FX, Ambient } from './fx';
import { Input } from './input';
import { Player } from './player';
import { Enemy, type HitOpts } from './enemy';
import { buildFloor, buildHub, type World, type Hub } from './world';
import { sfx, setMusic, setVolumes, initAudio } from './audio';
import { clamp, damp, dampAngle, TAU, wrap } from './util';
import { G, M, grp, mat, glowMat, addMat } from './models';

export interface ProjSpec { x: number; y: number; z: number; vx: number; vz: number; vy?: number; dmg: number; r: number; life: number; owner: 'p' | 'e'; color: number; shape: 'orb' | 'slash' | 'lance'; pierce?: boolean; aoe?: number; slow?: number; deflect?: boolean; src?: Enemy; size?: number; knock?: number; crit?: boolean; launch?: boolean; yaw?: number; trail?: number; unblock?: boolean }
interface Proj extends ProjSpec { active: boolean; mesh: THREE.Mesh; hit: Set<Enemy>; t: number; passed: boolean }
interface Pickup { type: 'gold' | 'hp' | 'mp' | 'item'; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; val: number; item?: Item; mesh: THREE.Object3D; active: boolean }
interface Chest { x: number; z: number; opened: boolean; tier: number; grp: THREE.Group; lid: THREE.Group; t: number; looted: boolean }
interface Pad { x: number; z: number; idx: number; lit: boolean; grp: THREE.Group; col: number }
export type AoeOpts = Partial<HitOpts> & { cone?: [number, number]; ringOnly?: number; kind?: string };
const PAD_COL = [0xff4040, 0x4080ff, 0xffd040, 0x40e060, 0xc060ff], PAD_EMO = ['🔴', '🔵', '🟡', '🟢', '🟣'];
export let game: Game | null = null;
export const getGame = () => game;

export class Game {
  canvas: HTMLCanvasElement; renderer: THREE.WebGLRenderer; composer: EffectComposer | null = null; bloom: UnrealBloomPass | null = null; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  fx: FX; amb: Ambient; input = new Input(); player!: Player; world: World | null = null; hub: Hub | null = null; spec: FloorSpec | null = null; scene3: 'title' | 'hub' | 'floor' = 'title';
  enemies: Enemy[] = []; projs: Proj[] = []; pickups: Pickup[] = []; chests: Chest[] = []; pads: Pad[] = []; timers: { t: number; fn: () => void; real: boolean }[] = [];
  time = 0; floorTime = 0; ts = 1; hitstopT = 0; slowT = 0; slowScale = 1; camYaw = Math.PI; camPitch = 0.38; camPos = new THREE.Vector3(); fovKick = 0; fovCur = 62;
  active = false; cleared = false; bossIntro = false; attackers = 0; lastTarget: Enemy | null = null; noSkills = false; touch = false; finished = false;
  score = 0; kills = 0; totalEnemies = 0; goldGot = 0; xpGot = 0; floorLoot: Item[] = []; hurtFlash = 0; flashEl: HTMLElement | null = null; vigEl: HTMLElement | null = null;
  cine: { kind: string; t: number; dur: number; target: Enemy } | null = null; obj = { text: '', p: 0, g: 0 };
  waveIdx = 0; waveTotal = 1; nextWaveT = 0; timeLeft = 0; seq: number[] = []; seqIdx = 0; padFail = false; ambushed = false; endlessWave = 0; rushList: number[] = []; rushIdx = 0; masteryBase = 0; stuckT = 0;
  callouts: { id: number; text: string; color: string } | null = null; cid = 1; restart: (() => void) | null = null; runStart = 0; hubT = 0; firstClear = false; resultData: ResultData | null = null; trainS = { perfect: 0, dmg: 0, combo: 0 };
  private last = 0; private hudT = 0; private musicT = 0; private fpsAcc = 0; private fpsN = 0; private fps = 60; private dynScale = 1; private slowFrames = 0; private fastFrames = 0; private raf = 0; private projGeo = new THREE.SphereGeometry(1, 10, 8); private projMats = new Map<number, THREE.MeshBasicMaterial>();
  private tmpV = new THREE.Vector3(); private disposed = false; private shopRefreshed = false; private orbit = 0;

  constructor(canvas: HTMLCanvasElement, fxLayer: HTMLElement, flash: HTMLElement, vig: HTMLElement) {
    game = this; (window as unknown as { __toi: Game }).__toi = this; this.canvas = canvas; this.flashEl = flash; this.vigEl = vig;
    const s = useStore.getState().settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.shadowMap.enabled = s.shadows > 0; this.renderer.shadowMap.type = THREE.PCFShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
    this.fx = new FX(this.scene); this.fx.layer = fxLayer; this.amb = new Ambient(this.scene);
    this.player = new Player(this); this.player.group.visible = false;
    for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(this.projGeo, this.projMat(0xffffff)); m.visible = false; this.scene.add(m); this.projs.push({ active: false, mesh: m, hit: new Set(), t: 0, passed: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, dmg: 0, r: 0, life: 0, owner: 'p', color: 0, shape: 'orb' }); }
    this.applySettings(); this.attach(); this.resize(); this.showTitleScene();
    this.last = performance.now(); this.raf = requestAnimationFrame(this.loop);
  }
  get ui() { return useStore.getState(); }
  projMat(c: number) { let m = this.projMats.get(c); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }); this.projMats.set(c, m); } return m; }
  get maxAttackers() { return 2 + (this.spec && this.spec.n >= 40 ? 1 : 0) + (this.enemies.length > 9 ? 1 : 0); }
  dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.detach?.(); this.renderer.dispose(); game = null; }

  // ---------- settings / resize ----------
  applySettings() {
    const s = this.ui.settings; this.touch = s.touch === 'on' || (s.touch === 'auto' && isTouchDevice()); useStore.setState({ touch: this.touch });
    this.renderer.shadowMap.enabled = s.shadows > 0; this.fx.dens = s.particles; this.fx.shakeMul = s.shake; setVolumes(s.master, s.music, s.sfx);
    this.amb.n = 180; const useBloom = s.effects > 0 && !isTouchDevice();
    if (useBloom && !this.composer) { this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera)); this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.6, 0.85); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass()); }
    if (!useBloom) { this.composer = null; this.bloom = null; }
    if (this.bloom) this.bloom.strength = s.effects >= 2 ? 0.55 : 0.32;
    this.resize();
  }
  resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight, s = this.ui.settings;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * s.res * this.dynScale; this.renderer.setPixelRatio(Math.max(0.4, pr)); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.fx.setScale(h * Math.max(0.4, pr), this.camera.fov);
    if (this.composer) { this.composer.setPixelRatio(Math.max(0.4, pr)); this.composer.setSize(w, h); }
  };
  detach: (() => void) | null = null;
  private attach() {
    const inp = this.input, c = this.canvas;
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const ui = this.ui, playing = this.scene3 !== 'title' && !ui.loading;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) { if (playing) e.preventDefault(); }
      if (e.repeat) return;
      if (ui.gameover) { if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.retry(); } if (e.code === 'Escape') this.quitToHub(); return; }
      if (ui.results) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.nextFloor(); } return; }
      if (!playing) return;
      initAudio();
      if (e.code === 'Escape' || e.code === 'KeyP') { if (ui.panel) { useStore.setState({ panel: null }); this.lockPointer(); } else this.togglePause(); return; }
      if (e.code === 'KeyI' || e.code === 'KeyM' || e.code === 'Tab') { if (ui.paused || ui.overlay) return; const tab = e.code === 'KeyI' ? 'inventory' : e.code === 'KeyM' ? 'map' : 'character'; if (ui.panel === 'menu' && ui.tab === tab) { useStore.setState({ panel: null }); this.lockPointer(); } else if (!ui.panel || ui.panel === 'menu') { this.openPanel('menu', tab); } return; }
      if (this.blocked()) return;
      inp.keyDown(e.code);
    };
    const ku = (e: KeyboardEvent) => inp.keyUp(e.code);
    const md = (e: MouseEvent) => { initAudio(); if (this.touch || this.blocked() || this.scene3 === 'title') return; if (document.pointerLockElement !== c) this.lockPointer(); inp.mouseDown(e.button); };
    const mu = (e: MouseEvent) => inp.mouseUp(e.button);
    const mm = (e: MouseEvent) => { if (document.pointerLockElement === c) inp.look(e.movementX, e.movementY); };
    const pl = () => { inp.locked = document.pointerLockElement === c; if (!inp.locked) { inp.releaseAll(); if (this.scene3 === 'floor' && !this.blocked() && !this.touch && !this.cine) { /* ESC pressed while locked → pause */ if (performance.now() - this.lockT > 400) this.togglePause(true); } } };
    const cm = (e: Event) => e.preventDefault();
    const blur = () => { inp.releaseAll(); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); c.addEventListener('mousedown', md); window.addEventListener('mouseup', mu); window.addEventListener('mousemove', mm);
    document.addEventListener('pointerlockchange', pl); c.addEventListener('contextmenu', cm); window.addEventListener('blur', blur); window.addEventListener('resize', this.resize);
    this.detach = () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); c.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu); window.removeEventListener('mousemove', mm); document.removeEventListener('pointerlockchange', pl); c.removeEventListener('contextmenu', cm); window.removeEventListener('blur', blur); window.removeEventListener('resize', this.resize); };
  }
  lockT = 0;
  lockPointer() { if (this.touch) return; try { this.lockT = performance.now(); const r = this.canvas.requestPointerLock() as unknown; if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => { /* ignore */ }); } catch { /* unsupported */ } }
  blocked() { const u = this.ui; return u.paused || !!u.panel || !!u.results || !!u.gameover || !!u.overlay || u.loading || this.scene3 === 'title'; }
  togglePause(on?: boolean) {
    const u = this.ui; if (this.scene3 === 'title' || u.results || u.gameover) return; const v = on ?? !u.paused;
    useStore.setState({ paused: v, panel: v ? null : u.panel }); if (v) { document.exitPointerLock?.(); this.input.releaseAll(); } else this.lockPointer();
  }
  openPanel(p: 'portal' | 'blacksmith' | 'merchant' | 'vault' | 'trainer' | 'quests' | 'achievements' | 'trophies' | 'menu', tab?: 'inventory' | 'character' | 'skills' | 'map') {
    useStore.setState({ panel: p, ...(tab ? { tab } : {}) }); document.exitPointerLock?.(); this.input.releaseAll(); sfx('click');
  }
  closePanel() { useStore.setState({ panel: null, paused: false }); this.lockPointer(); }

  // ---------- helpers used by player/enemy ----------
  hitstop(s: number) { this.hitstopT = Math.max(this.hitstopT, s); }
  slowmo(scale: number, s: number) { this.slowScale = scale; this.slowT = Math.max(this.slowT, s); }
  shake(a: number) { this.fx.shake(a); }
  flash(color: string, a: number) { if (this.flashEl) { this.flashEl.style.background = color; this.flashEl.style.opacity = String(Math.min(0.9, a)); } this.hurtFlash = a; }
  fov(k: number) { this.fovKick = Math.max(this.fovKick, k); }
  callout(text: string, color = '#fff') { this.callouts = { id: this.cid++, text, color }; }
  banner(t: string, s?: string, c?: string) { banner(t, s, c, true); }
  later(t: number, fn: () => void) { this.timers.push({ t, fn, real: false }); }
  laterReal(t: number, fn: () => void) { this.timers.push({ t, fn, real: true }); }
  collide(x: number, z: number, r: number): [number, number] { if (this.world) return this.world.collide(x, z, r); if (this.hub) return this.hub.collide(x, z, r); return [x, z]; }
  trainStat(k: 'perfect' | 'dmg' | 'combo', v = 1) { if (this.spec?.mode !== 'training') return; if (k === 'perfect') this.trainS.perfect += v; else if (k === 'dmg') this.trainS.dmg += v; }
  addScore(pts: number, label = '') { const mult = 1 + Math.min(2, this.player.combo * 0.03); this.score += Math.round(pts * mult); void label; }
  nearestEnemy(x: number, z: number, maxD: number, ref: number, cone = 6.3): Enemy | null {
    let best: Enemy | null = null, bs = 1e9;
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0) continue; const d = Math.hypot(e.x - x, e.z - z); if (d > maxD) continue; const a = Math.abs(wrap(Math.atan2(e.x - x, e.z - z) - ref)); if (a > cone / 2) continue; const sc = d + a * 3; if (sc < bs) { bs = sc; best = e; } }
    return best;
  }
  threat(x: number, z: number): Enemy | null { let best: Enemy | null = null, bt = 9; for (const e of this.enemies) { if (e.dead || e.state !== 'windup' || !e.mv) continue; const d = Math.hypot(e.x - x, e.z - z); if (d > 16) continue; const left = e.mv.wind - e.mt + d * 0.01; if (left < bt) { bt = left; best = e; } } return best; }
  alertNear(src: Enemy) { for (const e of this.enemies) if (!e.dead && e !== src && !e.alerted && Math.hypot(e.x - src.x, e.z - src.z) < 14) e.alerted = true; }
  aoe(x: number, z: number, r: number, dmg: number, o: AoeOpts): number {
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue; const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz); if (d > r + e.radius) continue; if (o.ringOnly && d < o.ringOnly - e.radius) continue;
      if (o.cone) { const diff = Math.abs(wrap(Math.atan2(dx, dz) - o.cone[0])); if (diff > o.cone[1] / 2 + 0.2) continue; }
      const k = e.hit(this, dmg, { ...o, dx: dx / (d || 1), dz: dz / (d || 1), heavy: o.heavy ?? true }); n++; this.player.onHitFeedback(e, !!o.crit, !!o.heavy, k);
    }
    return n;
  }
  lineHit(x: number, z: number, yaw: number, len: number, w: number, dmg: number, o: AoeOpts) {
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0) continue; const dx = e.x - x, dz = e.z - z, u = dx * sy + dz * cy, v = Math.abs(dx * cy - dz * sy); if (u < -0.5 || u > len || v > w + e.radius) continue; const k = e.hit(this, dmg, { ...o, dx: sy, dz: cy }); this.player.onHitFeedback(e, !!o.crit, false, k); }
  }
  spawnProj(s: ProjSpec) {
    const p = this.projs.find((q) => !q.active) || this.projs[0]; Object.assign(p, s); p.active = true; p.hit.clear(); p.t = 0; p.passed = false;
    p.mesh.material = this.projMat(s.color); p.mesh.visible = s.shape !== 'slash'; p.mesh.position.set(s.x, s.y, s.z); const sz = s.size ?? 0.4; p.mesh.scale.set(sz, sz, s.shape === 'lance' ? sz * 4 : sz); p.mesh.rotation.y = Math.atan2(s.vx, s.vz);
  }
  spawnEnemy(def: EnemyDef | null, x: number, z: number, o: { floor: number; elite?: boolean; boss?: number; mini?: boolean; mult?: number; train?: 'bot' | 'dummy' }): Enemy {
    const e = new Enemy(this, def, { ...o, x, z }); this.enemies.push(e); this.totalEnemies++;
    this.fx.ring(x, 0.1, z, e.def.glow, 2.5, 0.5); this.fx.burst(x, 0.3, z, e.def.glow, 10, 4, 0.5, 0.2); return e;
  }
  alive() { return this.enemies.filter((e) => !e.dead && !e.train).length; }

  // ---------- scene management ----------
  private clearWorld() {
    for (const e of this.enemies) e.dispose(this); this.enemies = []; this.attackers = 0; for (const p of this.projs) { p.active = false; p.mesh.visible = false; }
    for (const p of this.pickups) this.scene.remove(p.mesh); this.pickups = []; for (const c of this.chests) this.scene.remove(c.grp); this.chests = []; for (const p of this.pads) this.scene.remove(p.grp); this.pads = [];
    this.world?.dispose(); this.world = null; this.hub?.dispose(); this.hub = null; this.fx.clear(); this.timers = []; this.cine = null; this.input.frozen = false; this.lastTarget = null;
    this.player.trail.reset(); for (const c of this.player.clones) this.scene.remove(c.rig.root); this.player.clones = [];
  }
  private showTitleScene() {
    this.clearWorld(); const q = this.quality(); this.hub = buildHub(this.scene, this.fx, q); this.scene3 = 'title'; this.player.group.visible = true; this.player.resetForFloor(0, 9, Math.PI); this.player.state = 'free';
    this.amb.set('feather', 0xffd0a0, 0.6); setMusic('title'); useStore.setState({ scene: 'title' });
  }
  showTitle() { this.showTitleScene(); useStore.setState({ scene: 'title', paused: false, panel: null, results: null, gameover: null, overlay: null }); document.exitPointerLock?.(); }
  quality() { const s = this.ui.settings; return { shadow: s.shadows, view: s.view, mobile: isTouchDevice() }; }
  async enterHub() {
    useStore.setState({ loading: true, paused: false, panel: null, results: null, gameover: null, overlay: null }); await new Promise((r) => setTimeout(r, 40));
    this.finishRun(); this.clearWorld(); this.hub = buildHub(this.scene, this.fx, this.quality()); this.spec = null; this.scene3 = 'hub'; this.active = false; this.cleared = false; this.finished = false;
    this.player.group.visible = true; this.player.resetForFloor(this.hub.start.x, this.hub.start.z, Math.PI); this.camYaw = Math.PI; this.camPitch = 0.3; this.camPos.set(0, 6, 18);
    this.amb.set('feather', 0xffd0a0, 0.7); setMusic('hub'); ensureQuests(); if (!this.shopRefreshed) { this.shopRefreshed = true; } persist();
    useStore.setState({ scene: 'hub', loading: false, training: false }); useHud.setState({ boss: null, target: null, wave: '', training: null }); banner('ADVENTURER’S HUB', 'Prepare, then climb the Tower of Infinity', '#ffd860'); this.lockPointer();
  }
  private finishRun() { if (this.score > 0 && this.spec && this.spec.mode !== 'training' && !this.gameoverShown) { const sp = this.spec; addHiScore(this.score, sp.mode === 'endless' ? this.endlessWave : sp.n, sp.mode); } this.score = 0; this.gameoverShown = false; }
  gameoverShown = false; carry = false;
  startTower(n: number) { const f = Math.max(1, Math.min(100, n)); this.restart = () => this.startTower(f); this.score = 0; setFloor(f); this.loadFloor(getFloorSpec(f)); }
  startEndless() { this.restart = () => this.startEndless(); this.score = 0; this.endlessWave = 0; const seed = Math.floor(Math.random() * 10); this.loadFloor(endlessSpec(seed)); }
  startBossRush() {
    const bs = this.ui.save.bosses; const list = Object.keys(bs).map(Number).sort((a, b) => a - b); if (!list.includes(0)) list.unshift(0); this.rushList = list; this.rushIdx = 0; this.restart = () => this.startBossRush(); this.score = 0; this.loadFloor(bossSpec(list[0], 'bossrush'));
  }
  startChallenge(id: string) { this.restart = () => this.startChallenge(id); this.score = 0; this.loadFloor(challengeSpec(id)); }
  startMastery(f: WeaponFamily) { this.restart = () => this.startMastery(f); this.score = 0; this.loadFloor(masterySpec(f, this.ui.save.highest)); }
  startTraining() { this.restart = () => this.startTraining(); this.score = 0; this.loadFloor(trainingSpec()); }
  retry() { useStore.setState({ gameover: null, results: null }); this.gameoverShown = false; this.score = 0; if (this.restart) this.restart(); else this.enterHub(); }
  quitToHub() { this.enterHub(); }
  nextFloor() {
    const r = this.ui.results, sp = this.spec; useStore.setState({ results: null });
    if (!sp) { this.enterHub(); return; } void r;
    if (sp.mode === 'tower') { const n = sp.type === 'secret' ? (sp.returnTo ?? sp.n) + 1 : sp.n + 1; if (n > 100) { this.enterHub(); return; } this.restart = () => this.startTower(n); setFloor(n); this.carry = true; this.loadFloor(getFloorSpec(n)); } else this.enterHub();
  }
  replayFloor() { useStore.setState({ results: null }); if (this.restart) this.restart(); }

  async loadFloor(spec: FloorSpec) {
    useStore.setState({ loading: true, paused: false, panel: null, results: null, gameover: null, overlay: null, scene: 'floor' }); await new Promise((r) => setTimeout(r, 45));
    this.gameoverShown = false; const keepScore = this.carry || (spec.mode === 'bossrush' && this.rushIdx > 0) || (spec.mode === 'tower' && spec.type === 'secret') ? this.score : 0; this.carry = false; this.clearWorld(); this.score = keepScore;
    this.spec = spec; this.scene3 = 'floor'; this.hub = null; this.world = buildFloor(spec, this.scene, this.fx, this.quality()); const w = this.world; const R = REGIONS[spec.region];
    this.active = false; this.cleared = false; this.finished = false; this.bossIntro = false; this.kills = 0; this.totalEnemies = 0; this.goldGot = 0; this.xpGot = 0; this.floorLoot = []; this.floorTime = 0; this.waveIdx = 0; this.ambushed = false; this.padFail = false; this.timeLeft = 0; this.noSkills = spec.mod === 'nomagic';
    this.player.group.visible = true; this.player.resetForFloor(w.entrance.x, w.entrance.z, Math.PI); this.camYaw = Math.PI; this.camPitch = 0.35; this.camPos.set(w.entrance.x, 5, w.entrance.z + 8);
    this.amb.set(R.ambient, R.glow, 1); this.amb.range = 28; this.trainS = { perfect: 0, dmg: 0, combo: 0 }; this.masteryBase = 0;
    setMusic(spec.type === 'boss' || spec.mode === 'bossrush' ? 'boss' : 'region', spec.region, 0.3);
    this.setupFloor(); useStore.setState({ loading: false, scene: 'floor', training: spec.mode === 'training' });
    const title = spec.mode === 'endless' ? 'ENDLESS DUNGEON' : spec.mode === 'training' ? 'TRAINING ARENA' : spec.mode === 'bossrush' ? `BOSS RUSH ${this.rushIdx + 1}/${this.rushList.length}` : spec.mode === 'challenge' ? 'CHALLENGE FLOOR' : spec.mode === 'mastery' ? 'WEAPON MASTERY' : `FLOOR ${spec.n}`;
    if (spec.type !== 'boss' && spec.mode !== 'bossrush') banner(title, `${spec.name} • ${R.name}${spec.mode === 'tower' ? ` • ${TYPE_INFO[spec.type].name}` : ''}`, '#' + R.accent.toString(16).padStart(6, '0'));
    this.lockPointer(); if (this.touch) this.input.releaseAll();
  }

  private pickDef(n: number, region: number, arch?: string): EnemyDef {
    const defs = REGIONS[region].enemies; if (arch) { const f = defs.filter((d) => d.arch === arch); if (f.length) return f[Math.floor(Math.random() * f.length)]; }
    if (n <= 2) return defs.find((d) => d.arch === 'grunt')!; const r = (n - 1) % 10;
    const wt = defs.map((d) => (d.arch === 'grunt' ? 3 : d.arch === 'mage' ? 1 + r * 0.15 : d.arch === 'heavy' ? 0.3 + r * 0.2 : 0.5 + r * 0.18)); let t = wt.reduce((a, b) => a + b, 0) * Math.random(), i = 0; for (; i < wt.length - 1; i++) { t -= wt[i]; if (t <= 0) break; } return defs[i];
  }
  private eqFloor() { const s = this.spec!; return s.mode === 'endless' ? Math.min(100, Math.round(1 + this.endlessWave * 1.7)) : s.mode === 'training' ? 5 : s.n; }
  private spawnGroup(count: number, elites = 0, arch?: string) {
    const s = this.spec!, w = this.world!, f = this.eqFloor(), p = this.player;
    for (let i = 0; i < count + elites; i++) {
      const [x, z] = w.point(Math.random, 4, [[w.entrance.x, w.entrance.z, 12], [p.pos.x, p.pos.z, 10], ...this.enemies.filter((e) => !e.dead).map((e) => [e.x, e.z, 2.5] as [number, number, number])]);
      this.spawnEnemy(this.pickDef(f, s.region, arch), x, z, { floor: f, elite: i >= count, mult: s.mod === 'horde' ? 0.8 : 1 });
    }
  }
  private setObj(text: string, p: number, g: number) { this.obj = { text, p, g }; }
  private setupFloor() {
    const s = this.spec!, w = this.world!, f = s.n, inReg = (f - 1) % 10, zs = w.bounds.shape === 'circle' ? w.bounds.r : w.bounds.hd;
    this.active = true; w.setPortal(false); this.waveTotal = s.waves;
    if (s.mode === 'training') { this.active = true; const mk = (x: number, z: number, t: 'dummy' | 'bot', d: EnemyDef) => { const e = this.spawnEnemy(d, x, z, { floor: 5, train: t }); e.train = t; }; const D = REGIONS[0].enemies; mk(-6, -6, 'dummy', D[0]); mk(6, -6, 'dummy', D[3]); mk(0, -10, 'bot', REGIONS[2].enemies[2]); this.setObj('Practice attacks, skills, parries and dodges', 0, 0); w.setPortal(false); return; }
    if (s.mode === 'endless') { this.nextWaveT = 1.2; this.setObj('Survive endless waves', 0, 0); return; }
    if (s.type === 'boss' || s.mode === 'bossrush') {
      const bi = s.mode === 'bossrush' ? this.rushList[this.rushIdx] : s.region; const e = this.spawnEnemy(null, 0, -zs * 0.42, { floor: (bi + 1) * 10, boss: bi }); this.bossIntro = true; this.active = false; e.state = 'spawn'; e.spawnT = 1.4;
      this.cine = { kind: 'intro', t: 0, dur: 4.6, target: e }; this.input.frozen = true; this.player.iframes = 6; this.setObj(`Defeat ${REGIONS[bi].boss.name}`, 0, 1);
      this.laterReal(1.4, () => { sfx('boss'); useStore.setState({ banners: [] }); banner(REGIONS[bi].boss.name, REGIONS[bi].boss.title + ' — “' + REGIONS[bi].boss.intro + '”', '#ff6a5a', true, 3600); this.shake(0.8); });
      this.laterReal(4.6, () => { this.cine = null; this.input.frozen = false; this.bossIntro = false; this.active = true; this.player.iframes = 0.8; e.state = 'chase'; this.lockPointer(); }); return;
    }
    switch (s.type) {
      case 'combat': this.spawnGroup(s.enemies, 0); this.setObj('Defeat all enemies', 0, this.totalEnemies); break;
      case 'elite': { const el = 1 + Math.floor(inReg / 4); this.spawnGroup(3, el); this.setObj('Defeat the elite enemies', 0, this.totalEnemies); break; }
      case 'survival': { this.waveIdx = 1; this.spawnGroup(Math.ceil(s.enemies * 0.7), 0); this.setObj(`Survive ${s.waves} waves`, 0, s.waves); break; }
      case 'timetrial': this.spawnGroup(s.enemies, 0); this.timeLeft = s.time; this.setObj('Defeat everything before time runs out', 0, this.totalEnemies); break;
      case 'miniboss': this.spawnEnemy(null, 0, -zs * 0.4, { floor: f, mini: true, boss: s.region }); this.setObj('Defeat the champion', 0, 1); this.later(0.1, () => banner('CHAMPION', this.enemies[0]?.name, '#ff9a5a')); break;
      case 'treasure': { const n = clamp(4 + Math.floor(inReg / 3), 4, 7); this.placeChests(n, [0, 0, 0, 1, 1, 1, 2], 2); this.spawnGroup(2, 0); this.setObj('Find every chest', 0, n); break; }
      case 'secret': { this.placeChests(5, [1, 1, 2, 2, 2], 2); this.setObj('Plunder the vault', 0, 5); break; }
      case 'puzzle': this.setupPuzzle(); break;
      case 'trap': { const mid = 0; for (let i = 0; i < 3; i++) this.spawnEnemy(this.pickDef(f, s.region, i === 1 ? 'mage' : 'grunt'), (i - 1) * 3, mid - 4 - i * 6, { floor: f }); w.setPortal(true); this.setObj('Reach the exit', 0, 100); break; }
    }
  }
  private placeChests(n: number, tiers: number[], hidden: number) {
    const w = this.world!, f = this.spec!.n; const obs = w.obstacles.filter((o) => o.r > 0.6 && !o.box);
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0;
      if (i < hidden && obs.length) { const o = obs[Math.floor(Math.random() * obs.length)]; const a = Math.atan2(o.x, o.z) + (Math.random() - 0.5); x = o.x + Math.sin(a) * (o.r + 1.7); z = o.z + Math.cos(a) * (o.r + 1.7); if (w.blocked(x, z, 0.8)) [x, z] = w.point(Math.random, 3, [[w.entrance.x, w.entrance.z, 10]]); }
      else [x, z] = w.point(Math.random, 3, [[w.entrance.x, w.entrance.z, 10], ...this.chests.map((c) => [c.x, c.z, 6] as [number, number, number])]);
      this.makeChest(x, z, tiers[i % tiers.length]);
    }
    void f;
  }
  private makeChest(x: number, z: number, tier: number) {
    const g = grp(this.scene, [x, 0, z]), col = [0xb87333, 0xc8d0e0, 0xffd860, 0xff66ff][tier]; g.rotation.y = Math.random() * TAU;
    M(g, G.box(1.3, 0.7, 0.85), mat(0x5a3a22, { rough: 0.8 }), [0, 0.35, 0]); M(g, G.box(1.34, 0.12, 0.9), mat(col, { metal: 0.8, rough: 0.3, em: col, ei: 0.2 }), [0, 0.72, 0]); M(g, G.box(0.16, 0.5, 0.9), mat(col, { metal: 0.8, rough: 0.3 }), [0, 0.38, 0.0]);
    const lid = grp(g, [0, 0.72, -0.42]); M(lid, G.box(1.3, 0.3, 0.85), mat(0x6a4a2a, { rough: 0.7 }), [0, 0.15, 0.42]); M(lid, G.box(0.16, 0.34, 0.9), mat(col, { metal: 0.8 }), [0, 0.15, 0.42]); M(lid, G.sph(0.1, 8, 6), glowMat(col, 2.5), [0, 0.1, 0.9], undefined, 1, false);
    M(g, G.cyl(0.5, 0.8, 7, 10, ), addMat(col, 0.1), [0, 3.5, 0], undefined, 1, false);
    this.chests.push({ x, z, opened: false, tier, grp: g, lid, t: 0, looted: false });
  }
  private setupPuzzle() {
    const w = this.world!, n = 4; const cols = [0, 1, 2, 3]; this.seq = cols.sort(() => Math.random() - 0.5); this.seqIdx = 0;
    const R = w.bounds.shape === 'circle' ? Math.min(12, w.bounds.r - 6) : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.7; let x = Math.sin(a) * R, z = Math.cos(a) * R; if (w.blocked(x, z, 1.4)) [x, z] = w.point(Math.random, 4, [[w.entrance.x, w.entrance.z, 8], ...this.pads.map((p) => [p.x, p.z, 8] as [number, number, number])]);
      const g = grp(this.scene, [x, 0, z]), c = PAD_COL[i];
      M(g, G.cyl(1.5, 1.7, 0.3, 16), mat(0x2a2a34, { metal: 0.5 }), [0, 0.15, 0]); M(g, G.tor(1.3, 0.1, 6, 24), glowMat(c, 1.6), [0, 0.34, 0], [Math.PI / 2, 0, 0], 1, false); M(g, G.cyl(0.9, 0.9, 0.06, 16), glowMat(c, 0.8, 0.9), [0, 0.32, 0], undefined, 1, false); M(g, G.oct(0.35, 0), glowMat(c, 2.2), [0, 1.6, 0], undefined, 1, false); M(g, G.cyl(0.12, 0.12, 6, 6), addMat(c, 0.25), [0, 3, 0], undefined, 1, false);
      this.pads.push({ x, z, idx: i, lit: false, grp: g, col: c });
    }
    this.setObj(`Step on the runes in order: ${this.seq.map((i) => PAD_EMO[i]).join(' ')}`, 0, n);
  }

  // ---------- main loop ----------
  loop = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop);
    const real = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.fpsAcc += real; this.fpsN++; if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.dynRes(this.fpsAcc / this.fpsN); this.fpsAcc = 0; this.fpsN = 0; }
    // time scale
    if (this.hitstopT > 0) { this.hitstopT -= real; this.ts = 0.03; } else if (this.slowT > 0) { this.slowT -= real; this.ts = damp(this.ts, this.slowScale, 30, real); } else this.ts = damp(this.ts, 1, 10, real);
    const dt = real * this.ts;
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= t.real ? real : dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    if (this.hurtFlash > 0) { this.hurtFlash = Math.max(0, this.hurtFlash - real * 2.4); if (this.flashEl) this.flashEl.style.opacity = String(this.hurtFlash); }
    const blocked = this.blocked();
    if (this.scene3 === 'title') this.titleUpdate(real);
    else if (!blocked) this.simulate(dt, real);
    else { this.camUpdate(0); this.hub?.update(0, this.time, this.player.pos.x, this.player.pos.z); }
    this.time += blocked ? 0 : 0;
    this.input.endFrame();
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.hudT -= real; if (this.hudT <= 0) { this.hudT = 0.066; this.syncHud(); }
  };
  private dynRes(avg: number) {
    if (avg > 0.022) { this.slowFrames++; this.fastFrames = 0; } else if (avg < 0.0135) { this.fastFrames++; this.slowFrames = 0; } else { this.slowFrames = 0; this.fastFrames = 0; }
    if (this.slowFrames >= 3 && this.dynScale > 0.55) { this.dynScale = Math.max(0.55, this.dynScale - 0.1); this.slowFrames = 0; this.resize(); }
    else if (this.fastFrames >= 12 && this.dynScale < 1) { this.dynScale = Math.min(1, this.dynScale + 0.05); this.fastFrames = 0; this.resize(); }
  }
  private titleUpdate(dt: number) {
    this.orbit += dt * 0.12; const t = this.time += dt; const p = this.player; p.update(dt, t); this.hub?.update(dt, t, 0, 99);
    const a = this.orbit; this.camera.position.set(Math.sin(a) * 16, 3.2 + Math.sin(a * 0.7) * 0.6, 9 + Math.cos(a) * 16); this.camera.lookAt(0, 2.2, 6); this.camera.fov = 52; this.camera.updateProjectionMatrix();
    this.fx.update(dt, this.camera, this.canvas.clientWidth, this.canvas.clientHeight); this.amb.update(t, this.tmpV.set(0, 0, 0)); this.hub?.sun.position.set(-30, 30, 25); this.hub?.sun.target.position.set(0, 0, 0);
  }
  private simulate(dt: number, real: number) {
    const p = this.player; this.time += dt; if (this.active && !this.cleared) this.floorTime += dt;
    const frozen = !!this.cine; if (frozen) { this.input.frozen = true; }
    if (this.touch === false) this.input.arrowLook(real);
    p.update(dt, this.time);
    // hub
    if (this.scene3 === 'hub' && this.hub) { this.hub.update(dt, this.time, p.pos.x, p.pos.z); this.hubLogic(); this.hub.sun.target.position.set(p.pos.x, 0, p.pos.z); this.hub.sun.position.set(p.pos.x - 30, 30, p.pos.z + 25); }
    // enemies
    for (const e of this.enemies) e.update(this, dt, this.time);
    for (let i = this.enemies.length - 1; i >= 0; i--) { const e = this.enemies[i]; if (e.dead && e.deadT > (e.isBoss ? 5 : 1.4)) { if (!e.isBoss || this.cleared) { e.dispose(this); this.enemies.splice(i, 1); } } }
    this.updateProjs(dt); this.updatePickups(dt);
    if (this.world) {
      this.world.update(dt, this.time, p.pos.x, p.pos.z, p.pos.y, { hurt: (f) => p.envHurt(f), slip: () => { p.slipping = true; }, push: (dx, dz) => { p.pushX += dx; p.pushZ += dz; } });
      this.world.sun.position.set(p.pos.x + 22, 40, p.pos.z + 16); this.world.sun.target.position.set(p.pos.x, 0, p.pos.z); this.world.sun.target.updateMatrixWorld();
      this.floorLogic(dt);
    }
    this.camUpdate(dt); this.fx.update(dt, this.camera, this.canvas.clientWidth, this.canvas.clientHeight); this.amb.update(this.time, p.pos);
    this.musicT -= real; if (this.musicT <= 0 && this.scene3 === 'floor' && this.spec) { this.musicT = 0.6; const alive = this.enemies.some((e) => !e.dead && e.state !== 'idle' && !e.train); const boss = this.spec.type === 'boss' || this.spec.mode === 'bossrush'; setMusic(boss ? 'boss' : 'region', this.spec.region, boss ? 0.9 : alive ? 0.65 : 0.2); }
    if (this.vigEl) { const low = 1 - p.hp / p.maxHp; this.vigEl.style.opacity = String(low > 0.65 ? (low - 0.65) * 2.4 + Math.sin(this.time * 6) * 0.1 : 0); }
  }

  // ---------- camera ----------
  private camUpdate(dt: number) {
    const p = this.player, cam = this.camera, st = this.ui.settings;
    let fovT = 62 + (p.state === 'free' && Math.hypot(p.vx, p.vz) > 9 ? 6 : 0) + (p.state === 'ult' ? 10 : 0);
    this.fovKick = Math.max(0, this.fovKick - dt * 40); if (this.cine) fovT = 55;
    this.fovCur = damp(this.fovCur, fovT + this.fovKick, 12, Math.max(dt, 0.001));
    if (Math.abs(cam.fov - this.fovCur) > 0.05) { cam.fov = this.fovCur; cam.updateProjectionMatrix(); }
    if (this.cine) {
      const c = this.cine, e = c.target; c.t += dt; const k = c.t / c.dur;
      if (c.kind === 'intro') { const a = Math.PI * 0.15 + k * 1.1, R = e.radius * 2.6 + 9 - k * 2, h = e.rig.height * (0.35 + k * 0.25) + 1.5; cam.position.set(e.x + Math.sin(a) * R, h, e.z + Math.cos(a) * R); cam.lookAt(e.x, e.rig.height * (0.55 + 0.05 * k), e.z); }
      else { const a = k * 2.2 + 1, R = e.radius * 2.4 + 10; cam.position.set(e.x + Math.sin(a) * R, e.rig.height * 0.5 + 2, e.z + Math.cos(a) * R); cam.lookAt(e.x, e.rig.height * 0.5, e.z); }
      return;
    }
    const inp = this.input; this.input.arrowLook(0); const sens = st.sens * (this.touch ? 1.15 : 1);
    if (this.touch) this.camYaw -= inp.mx * 0.006 * sens; else this.camYaw -= inp.mx * 0.0022 * sens;
    this.camPitch = clamp(this.camPitch + inp.my * (this.touch ? 0.005 : 0.002) * sens, -0.15, 1.2);
    if (p.lock && !p.dead && this.scene3 === 'floor' && Math.abs(inp.mx) < 2) { this.camYaw = dampAngle(this.camYaw, Math.atan2(p.lock.x - p.pos.x, p.lock.z - p.pos.z), 5, Math.max(dt, 0.001)); this.camPitch = damp(this.camPitch, 0.42, 3, Math.max(dt, 0.001)); }
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw), pivot = this.tmpV.set(p.pos.x - fz * 0.55, p.pos.y + 1.55, p.pos.z + fx * 0.55);
    // note: right vector = (-cos, sin) → shoulder offset to the right is -(-cos)... we shift slightly right
    const dist = (this.scene3 === 'hub' ? 8.5 : 7.2) + (p.state === 'ult' ? 1.5 : 0), cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    let d = dist;
    if (this.world) { const ex = pivot.x - fx * cp * dist, ez = pivot.z - fz * cp * dist; const t = this.world.seg(pivot.x, pivot.z, ex, ez, 0.35); d = dist * Math.max(0.22, t); }
    const tx = pivot.x - fx * cp * d, ty = Math.max(0.45, pivot.y + sp * d), tz = pivot.z - fz * cp * d;
    this.camPos.x = damp(this.camPos.x, tx, 22, Math.max(dt, 0.001)); this.camPos.y = damp(this.camPos.y, ty, 22, Math.max(dt, 0.001)); this.camPos.z = damp(this.camPos.z, tz, 22, Math.max(dt, 0.001));
    if (dt === 0) this.camPos.set(tx, ty, tz);
    const sh = this.fx.shakeAmt * 0.32; cam.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z + (Math.random() - 0.5) * sh);
    cam.lookAt(pivot.x + fx * 2, pivot.y + 0.1 - this.camPitch * 0.6, pivot.z + fz * 2); cam.rotation.z += (Math.random() - 0.5) * sh * 0.05;
  }

  // ---------- projectiles ----------
  private updateProjs(dt: number) {
    const p = this.player;
    for (const q of this.projs) {
      if (!q.active) continue; q.t += dt; q.life -= dt; q.x += q.vx * dt; q.z += q.vz * dt; q.y += (q.vy ?? 0) * dt;
      if (q.life <= 0) { this.killProj(q, false); continue; }
      q.mesh.position.set(q.x, q.y, q.z); const sp = Math.atan2(q.vx, q.vz); q.mesh.rotation.y = sp;
      if (q.shape === 'slash') { this.fx.slash(q.x, q.y, q.z, q.yaw ?? sp, 0, 1.7 * (q.size ?? 1), 1.4, q.color, 0.14, 0.7); if (Math.random() < 0.5) this.fx.emit(q.x, q.y, q.z, 0, 0.3, 0, q.color, 0.3, 0.25); }
      else { this.fx.emit(q.x, q.y, q.z, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, q.trail ?? q.color, 0.35, (q.size ?? 0.4) * 0.8); }
      if (this.world && this.world.blocked(q.x, q.z, 0.15) && q.owner === 'e') { this.killProj(q, true); continue; }
      if (this.world && q.owner === 'p' && this.world.blocked(q.x, q.z, 0.15) && !q.pierce) { this.killProj(q, true); continue; }
      if (q.owner === 'e') {
        if (q.passed) { if (Math.hypot(q.x - p.pos.x, q.z - p.pos.z) > q.r + 1.2) q.passed = false; continue; }
        if (Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < q.r + 0.45 && Math.abs(q.y - (p.pos.y + 1.1)) < 1.5) {
          const res = p.take(q.dmg, { x: q.x - q.vx * 0.05, z: q.z - q.vz * 0.05, unblock: q.unblock, kind: 'proj', proj: true, e: q.src });
          if (res === 'perfect') { // reflect
            const tgt = q.src && !q.src.dead ? q.src : this.nearestEnemy(p.pos.x, p.pos.z, 30, 0, 6.3); const a = tgt ? Math.atan2(tgt.x - q.x, tgt.z - q.z) : Math.atan2(-q.vx, -q.vz); const sp2 = Math.hypot(q.vx, q.vz) * 1.6;
            q.owner = 'p'; q.vx = Math.sin(a) * sp2; q.vz = Math.cos(a) * sp2; q.dmg = p.roll(3.5, true).d; q.aoe = 2.4; q.life = 3; q.color = 0xffe27a; q.mesh.material = this.projMat(0xffe27a); q.hit.clear(); q.r = 1.0; q.size = (q.size ?? 0.4) * 1.3; q.mesh.scale.setScalar(q.size); q.knock = 6; this.callout('REFLECTED!', '#ffe27a');
          } else if (res === 'dodged' || res === 'iframe') q.passed = true; else this.killProj(q, true);
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || q.hit.has(e)) continue; const dx = e.x - q.x, dz = e.z - q.z; if (Math.hypot(dx, dz) > q.r + e.radius || q.y > e.rig.height + e.y + 0.8) continue;
          q.hit.add(e); const d = Math.hypot(dx, dz) || 1; const k = e.hit(this, q.dmg, { dx: q.vx / (Math.hypot(q.vx, q.vz) || 1), dz: q.vz / (Math.hypot(q.vx, q.vz) || 1), knock: q.knock ?? 2, crit: q.crit, stagger: q.pierce ? 0 : 1, heavy: !!q.aoe }); void d;
          if (q.slow) e.slowT = q.slow; p.onHitFeedback(e, !!q.crit, !!q.aoe, k);
          if (q.src === e) { /* reflected into source */ if (e.kit) e.posture += 25; }
          if (!q.pierce) { this.killProj(q, true); break; }
        }
      }
    }
  }
  private killProj(q: Proj, explode: boolean) {
    q.active = false; q.mesh.visible = false;
    if (explode) { this.fx.burst(q.x, q.y, q.z, q.color, 14, 7, 0.4, 0.22); if (q.aoe) { this.fx.blast(q.x, q.y, q.z, q.color, q.aoe, 0.35, 0.8); this.fx.ring(q.x, 0.2, q.z, q.color, q.aoe * 1.2, 0.35); this.shake(0.3); sfx('explode', 0.5); if (q.owner === 'p') this.aoe(q.x, q.z, q.aoe, Math.round(q.dmg * 0.7), { kind: 'skill', knock: q.knock ?? 4, stagger: 1, crit: false, heavy: true, launch: q.launch }); } }
  }

  // ---------- pickups ----------
  spawnGold(x: number, z: number, total: number, n = 3) {
    for (let i = 0; i < n; i++) { const m = M(this.scene, G.oct(0.14, 0), glowMat(0xffd040, 2.5), [x, 0.8, z], undefined, 1, false); const a = Math.random() * TAU, s = 3 + Math.random() * 3; this.pickups.push({ type: 'gold', x, y: 0.8, z, vx: Math.sin(a) * s, vy: 5 + Math.random() * 3, vz: Math.cos(a) * s, t: 0, val: Math.max(1, Math.round(total / n)), mesh: m, active: true }); }
  }
  spawnOrb(x: number, z: number, type: 'hp' | 'mp') { const c = type === 'hp' ? 0x44ff77 : 0x44aaff; const m = M(this.scene, G.sph(0.2, 8, 6), glowMat(c, 3), [x, 0.8, z], undefined, 1, false); this.pickups.push({ type, x, y: 0.8, z, vx: (Math.random() - 0.5) * 4, vy: 5, vz: (Math.random() - 0.5) * 4, t: 0, val: 0.1, mesh: m, active: true }); }
  spawnItem(x: number, z: number, item: Item) {
    const c = RARITY[item.rarity].hex, g = grp(this.scene, [x, 1, z]); M(g, G.oct(0.35, 0), glowMat(c, 2.2), [0, 0.2, 0], undefined, [0.8, 1.2, 0.8], false); const ri = RARITIES.indexOf(item.rarity);
    M(g, G.cyl(0.35 + ri * 0.05, 0.5 + ri * 0.05, 9 + ri * 2, 8, ), addMat(c, 0.16 + ri * 0.03), [0, 4.5, 0], undefined, 1, false);
    const a = Math.random() * TAU; this.pickups.push({ type: 'item', x, y: 1, z, vx: Math.sin(a) * 2.5, vy: 6, vz: Math.cos(a) * 2.5, t: 0, val: 0, item, mesh: g, active: true });
    this.fx.burst(x, 1, z, c, 14 + ri * 6, 6, 0.8, 0.25); if (ri >= 3) { this.fx.ring(x, 0.2, z, c, 5, 0.6); sfx(ri >= 4 ? 'legend' : 'item', 0.5); }
  }
  private updatePickups(dt: number) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i]; k.t += dt;
      if (k.y > 0.45 || k.vy > 0) { k.vy -= 18 * dt; k.y += k.vy * dt; if (k.y < 0.45) { k.y = 0.45; k.vy *= -0.3; if (Math.abs(k.vy) < 1) k.vy = 0; } k.vx *= 0.97; k.vz *= 0.97; }
      const dx = p.pos.x - k.x, dz = p.pos.z - k.z, d = Math.hypot(dx, dz);
      const mag = k.type === 'item' ? 0 : k.t > 0.5 ? 12 : 0;
      if (mag && d < (k.type === 'gold' ? 11 : 9) && !p.dead) { const s = (mag + 10 / (d + 0.3)) * dt * 1.2; k.x += (dx / d) * s; k.z += (dz / d) * s; k.y += (p.pos.y + 1 - k.y) * Math.min(1, dt * 6); } else { k.x += k.vx * dt; k.z += k.vz * dt; }
      k.mesh.position.set(k.x, k.y + (k.type === 'item' ? Math.sin(this.time * 3 + i) * 0.1 : 0), k.z); k.mesh.rotation.y += dt * 3;
      if (k.t > 0.4 && d < (k.type === 'item' ? 1.8 : 1.1) && !p.dead && Math.abs(p.pos.y - k.y) < 3) {
        if (k.type === 'gold') { addGold(k.val); this.goldGot += k.val; sfx('gold', 0.5, 1 + Math.random() * 0.4); this.fx.burst(k.x, k.y, k.z, 0xffd040, 4, 3, 0.3, 0.15); }
        else if (k.type === 'hp') { p.heal(p.maxHp * 0.12); sfx('pickup', 0.6); this.fx.burst(k.x, k.y, k.z, 0x44ff77, 10, 4, 0.4, 0.2); this.fx.num(new THREE.Vector3(p.pos.x, 2.4, p.pos.z), '+HP', '#6f8', 1); }
        else if (k.type === 'mp') { p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.25); sfx('pickup', 0.6, 1.3); this.fx.burst(k.x, k.y, k.z, 0x44aaff, 10, 4, 0.4, 0.2); }
        else if (k.item) { this.collectItem(k.item); }
        this.scene.remove(k.mesh); this.pickups.splice(i, 1);
      }
    }
  }
  private collectItem(it: Item) {
    const ok = addItem(it); const c = RARITY[it.rarity];
    if (ok) { this.floorLoot.push(it); toast(`${c.name}: ${it.name}`, c.color); sfx(RARITIES.indexOf(it.rarity) >= 4 ? 'legend' : 'item', 0.8); if (RARITIES.indexOf(it.rarity) >= 4) { banner(it.name, `${c.name} ${it.slot} acquired!`, c.color); this.shake(0.3); } bumpStat('legendary', 0); checkAchievements(); }
    else { addGold(Math.round(40 + it.tier * 6)); toast('Inventory full — converted to gold', '#fc6'); }
  }

  // ---------- floor logic ----------
  private floorLogic(dt: number) {
    const s = this.spec!, w = this.world!, p = this.player;
    // chests
    for (const c of this.chests) {
      if (!c.opened && Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < 2.0 && !p.dead) { c.opened = true; c.t = 0; sfx('chest'); this.fx.burst(c.x, 1, c.z, 0xffd860, 20, 6, 0.7, 0.25); bumpStat('chests'); this.onChest(c); }
      if (c.opened) { c.t += dt; c.lid.rotation.x = -Math.min(1.7, c.t * 4); if (!c.looted && c.t > 0.3) { c.looted = true; this.lootChest(c); } }
      else c.grp.children[c.grp.children.length - 1].visible = true;
    }
    // puzzle pads
    for (const pd of this.pads) {
      const near = Math.hypot(pd.x - p.pos.x, pd.z - p.pos.z) < 1.7 && p.pos.y < 0.6;
      if (near && !pd.lit && !this.cleared) {
        if (pd.idx === this.seq[this.seqIdx]) { pd.lit = true; this.seqIdx++; sfx('rune', 1, 1 + this.seqIdx * 0.15); this.fx.burst(pd.x, 1, pd.z, pd.col, 24, 6, 0.8, 0.3); this.fx.pillar(pd.x, 0, pd.z, pd.col, 1.2, 14, 0.8, 0.5); (pd.grp.children[3] as THREE.Mesh).scale.setScalar(2); if (this.seqIdx >= this.seq.length) this.clearFloor(); }
        else if (!this.padFail || true) { this.seqIdx = 0; for (const o of this.pads) { o.lit = false; (o.grp.children[3] as THREE.Mesh).scale.setScalar(1); } sfx('wrong'); this.fx.ring(pd.x, 0.2, pd.z, 0xff2222, 6, 0.5); this.fx.burst(pd.x, 1, pd.z, 0xff2222, 20, 7, 0.5); this.shake(0.4); p.envHurt(0.07); this.callout('WRONG RUNE — sequence reset', '#f66'); if (!this.padFail) { this.padFail = true; for (let i = 0; i < 2; i++) this.spawnGroup(1, 0, i ? 'mage' : 'grunt'); } }
      }
    }
    if (this.pads.length) this.setObj(`Runes in order: ${this.seq.map((i, k) => (k < this.seqIdx ? '✅' : PAD_EMO[i])).join(' ')}`, this.seqIdx, this.seq.length);
    // secret sigil
    if (w.secret && w.secretMesh && Math.hypot(w.secret.x - p.pos.x, w.secret.z - p.pos.z) < 2.0 && this.cleared && !this.finished) { this.finished = true; useStore.getState().save.secrets[s.n] = true; bumpStat('secrets'); banner('SECRET PASSAGE', 'A hidden vault opens…', '#c07aff'); sfx('portal'); this.restart = () => this.startTower(s.n); this.laterReal(0.9, () => this.loadFloor(secretSpec(s.n))); }
    // wave logic
    const alive = this.alive();
    if (s.mode === 'endless') {
      if (this.active && alive === 0 && !this.cleared) { this.nextWaveT -= dt; if (this.nextWaveT <= 0) this.spawnEndless(); }
      this.setObj(`Wave ${this.endlessWave}`, this.endlessWave, 0);
    } else if (s.mode === 'training') { /* free */ } else if (this.active && !this.cleared) {
      switch (s.type) {
        case 'combat': case 'elite': case 'timetrial': { this.setObj(this.obj.text, this.totalEnemies - alive, this.totalEnemies); if (alive === 0 && this.totalEnemies > 0) this.clearFloor(); if (s.type === 'timetrial') { this.timeLeft -= dt; if (this.timeLeft <= 0) { this.callout('TIME UP', '#f66'); p.die(); } } break; }
        case 'survival': {
          this.setObj(`Wave ${this.waveIdx}/${s.waves}`, this.waveIdx - 1, s.waves);
          if (alive <= 1 && this.waveIdx < s.waves) { this.nextWaveT -= dt; if (this.nextWaveT <= 0) { this.waveIdx++; this.nextWaveT = 1.8; banner(`WAVE ${this.waveIdx}`, `of ${s.waves}`, '#ffd860'); sfx('roar', 0.4); this.spawnGroup(Math.ceil(s.enemies * (0.7 + 0.3 * this.waveIdx)), s.mode === 'mastery' ? 0 : this.waveIdx === s.waves ? 1 : 0); } } else if (alive > 1) this.nextWaveT = 1.8;
          if (alive === 0 && this.waveIdx >= s.waves && !this.pendingMastery()) this.clearFloor();
          if (s.mode === 'mastery') this.setObj(`Wave ${this.waveIdx}/${s.waves} • Perfect deflections ${Math.min(3, p.perfects - this.masteryBase)}/3`, this.waveIdx - 1, s.waves);
          break;
        }
        case 'miniboss': if (alive === 0 && this.totalEnemies > 0) this.clearFloor(); break;
        case 'treasure': { const open = this.chests.filter((c) => c.opened).length; this.setObj('Find every chest', open, this.chests.length); if (open === this.chests.length && open > 0) this.clearFloor(); break; }
        case 'secret': { const open = this.chests.filter((c) => c.opened).length; this.setObj('Plunder the vault', open, this.chests.length); if (open === this.chests.length && alive === 0) this.clearFloor(); break; }
        case 'trap': { const d = Math.hypot(w.exit.x - p.pos.x, w.exit.z - p.pos.z), total = Math.abs(w.entrance.z - w.exit.z); this.setObj('Reach the exit', Math.round(clamp(1 - d / total, 0, 1) * 100), 100); if (d < 3) this.clearFloor(); break; }
      }
    }
    if (s.mode === 'bossrush' && this.cleared === false && false) { /* handled in onBossDeath */ }
    // portal
    if (this.cleared && !this.finished && s.mode !== 'bossrush' && s.mode !== 'endless' && s.mode !== 'training') {
      if (Math.hypot(w.exit.x - p.pos.x, w.exit.z - p.pos.z) < 2.2 && !p.dead) this.enterPortal();
    }
    if (this.cleared && w.secret && !this.finished) this.setObj('Floor cleared — enter the portal. Something stirs on this floor…', 1, 1);
    else if (this.cleared && !this.finished) this.setObj('Floor cleared — enter the portal', 1, 1);
  }
  private pendingMastery() { const s = this.spec!; return s.mode === 'mastery' && this.player.perfects - this.masteryBase < 3; }
  private onChest(c: Chest) { const s = this.spec!; if (s.type === 'treasure' && !this.ambushed && this.chests.filter((x) => x.opened).length >= Math.ceil(this.chests.length / 2)) { this.ambushed = true; banner('AMBUSH!', 'The vault guardians awaken', '#ff6a5a'); sfx('roar', 0.5); this.spawnGroup(3, 0); } if (s.type === 'secret' && !this.ambushed && this.chests.filter((x) => x.opened).length >= 2) { this.ambushed = true; banner('VAULT GUARDIANS', 'Defend the treasure!', '#ff6a5a'); this.spawnGroup(2, 2); } void c; }
  private lootChest(c: Chest) {
    const s = this.spec!, f = s.n; const gold = Math.round((30 + f * 14) * (1 + c.tier * 0.8)); this.spawnGold(c.x, c.z, gold, 5 + c.tier * 2);
    const n = c.tier >= 2 ? 2 : 1; const mins = ['common', 'uncommon', 'rare', 'epic'] as const;
    for (let i = 0; i < n; i++) if (Math.random() < 0.55 + c.tier * 0.2 || i === 0 && c.tier >= 1) this.spawnItem(c.x + (i - 0.5) * 0.8, c.z, rollItem(f, { luck: 0.1 + c.tier * 0.15, min: mins[Math.min(3, c.tier)] }));
    if (Math.random() < 0.5) this.spawnOrb(c.x, c.z, 'hp'); if (Math.random() < 0.3) this.spawnOrb(c.x, c.z, 'mp');
  }
  private spawnEndless() {
    const s = this.spec!; this.endlessWave++; const wv = this.endlessWave; this.nextWaveT = 2.5; bumpStat('endless', wv, true);
    const heal = this.player.maxHp * 0.12; this.player.heal(heal); banner(`WAVE ${wv}`, wv % 10 === 0 ? 'GUARDIAN WAVE' : wv % 5 === 0 ? 'Elite incoming' : '', wv % 5 === 0 ? '#ff9a5a' : '#ffd860'); sfx('roar', 0.4);
    if (wv % 10 === 0) { const bi = (wv / 10 - 1) % 10, f = this.eqFloor(); const [x, z] = [0, -10]; this.spawnEnemy(null, x, z, { floor: f, boss: bi }); this.spawnGroup(2, 0); }
    else this.spawnGroup(Math.min(12, 3 + Math.floor(wv * 0.7)), wv % 5 === 0 ? 1 + Math.floor(wv / 10) : 0);
    this.player.addUlt(10); void s; checkAchievements();
  }
  private hubLogic() {
    const hub = this.hub!, p = this.player; let near: (typeof hub.stations)[number] | null = null, bd = 99;
    for (const st of hub.stations) { const d = Math.hypot(st.x - p.pos.x, st.z - p.pos.z); if (d < st.r && d < bd) { bd = d; near = st; } }
    useHud.setState({ prompt: near ? `${this.touch ? 'Tap Interact' : 'Press E'} — ${near.label}` : '' });
    if (near && (this.input.pressed.interact || this.input.pressed.skillA)) {
      const id = near.id; if (id === 'training') { this.startTraining(); return; }
      this.openPanel(id as 'portal');
    }
  }

  // ---------- clear / rewards ----------
  clearFloor() {
    if (this.cleared) return; const s = this.spec!, p = this.player, w = this.world!; this.cleared = true; this.active = s.mode === 'tower' ? true : this.active;
    sfx('clear'); const f = s.n; this.camFlash(); const time = this.floorTime;
    const par = s.type === 'boss' ? 150 : s.type === 'trap' ? 60 : 35 + this.totalEnemies * 9;
    const noHit = p.damageTaken === 0;
    const rs = clamp(1 - (time - par) / (par * 1.2), 0, 1) * 30 + Math.min(20, p.maxCombo * 0.7) + Math.min(20, p.perfects * 4) + (noHit ? 30 : Math.max(0, 30 - (p.damageTaken / p.maxHp) * 60));
    const rank = rankFor(rs + (s.type === 'treasure' || s.type === 'puzzle' || s.type === 'trap' ? 25 : 0));
    const bonus = ({ S: 3000, A: 2000, B: 1200, C: 600, D: 200 } as Record<string, number>)[rank] * (1 + f * 0.05); this.score += Math.round(500 + bonus + (noHit ? 1500 : 0));
    const first = !this.ui.save.cleared[f] && s.mode === 'tower' && s.type !== 'secret'; this.firstClear = first;
    const xp = Math.round((30 + 12 * f) * (s.mode === 'tower' ? 1 : 0.6)), gold = Math.round((60 + f * 25) * (first ? 2 : 1) * (s.mod === 'ironskin' ? 2 : 1)); this.xpGot += xp; this.awardXp(xp);
    this.spawnGold(w.exit.x, w.exit.z + 2.5, gold, 8); addEssence(1 + Math.floor(f / 5) + (first ? 2 : 0)); this.goldGot += 0;
    const guaranteed = s.type === 'elite' || s.type === 'miniboss' || s.type === 'secret' ? 'rare' : first ? 'uncommon' : 'common';
    if (first || s.type === 'elite' || s.type === 'miniboss' || Math.random() < 0.5) this.spawnItem(w.exit.x + 1.5, w.exit.z + 3, rollItem(f, { min: guaranteed as 'rare', luck: first ? 0.15 : 0.05 }));
    if (s.type === 'miniboss') this.spawnItem(w.exit.x - 1.5, w.exit.z + 3, rollItem(f + 2, { min: 'epic', luck: 0.2 }));
    if (s.mode === 'tower' && s.type !== 'secret') { recordFloor(f, { time, rank, score: this.score, noHit }); }
    if (s.mode === 'mastery' && s.weapon) { addMastery(s.weapon, 60); toast(`${WEAPONS[s.weapon].name} mastery +60`, '#ffd860'); addGold(300); }
    if (s.mode === 'challenge' && s.mod) { const st = useStore.getState().save; const firstCh = !st.challenges[s.mod]; st.challenges[s.mod] = true; addGold(600 + s.n * 30); addEssence(firstCh ? 8 : 2); if (firstCh) this.spawnItem(w.exit.x, w.exit.z + 4, rollItem(s.n + 5, { min: 'epic', luck: 0.3 })); }
    if (s.mode === 'tower' && s.type !== 'secret') w.setPortal(true); else w.setPortal(true);
    banner('FLOOR CLEARED', `Rank ${rank} • ${Math.floor(time)}s`, '#ffd860'); this.callout(`RANK ${rank}`, '#ffd860');
    checkAchievements(); persist(); ensureQuests();
    this.resultData = { spec: s, time, score: this.score, rank, kills: this.kills, perfect: p.perfects, damage: p.damageTaken, maxCombo: p.maxCombo, noHit, first, loot: this.floorLoot, gold: 0, xp: this.xpGot, mode: s.mode };
  }
  private camFlash() { this.flash('#ffe9a0', 0.3); }
  private enterPortal() {
    if (this.finished || !this.resultData) return; this.finished = true; const r = this.resultData; r.loot = [...this.floorLoot]; r.gold = this.goldGot; r.xp = this.xpGot; r.score = this.score; sfx('portal');
    persist(); document.exitPointerLock?.(); this.input.releaseAll(); useStore.setState({ results: { ...r } });
  }
  private awardXp(n: number) { const lv = gainXp(n); if (lv > 0) { sfx('levelup'); banner('LEVEL UP!', `Level ${useStore.getState().save.level} — +${lv} skill point${lv > 1 ? 's' : ''}`, '#7dff9a'); this.player.refresh(false); this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.5); this.fx.ring(this.player.pos.x, 0.2, this.player.pos.z, 0x7dff9a, 8, 0.8); this.fx.pillar(this.player.pos.x, 0, this.player.pos.z, 0x7dff9a, 1.5, 12, 0.8, 0.5); checkAchievements(); } }
  onEnemyDeath(e: Enemy) {
    const s = this.spec, p = this.player; if (!s) return; this.kills++; bumpStat('kills'); this.lastTarget = null;
    const f = this.eqFloor(), xp = Math.round((6 + 1.1 * f) * e.xpMul * (s.mode === 'endless' ? 0.7 : 1)); this.xpGot += xp; this.awardXp(xp);
    this.addScore((50 + f * 5) * e.xpMul, '');
    this.spawnGold(e.x, e.z, Math.round((3 + f * 1.4) * e.xpMul), e.elite ? 5 : 2 + (Math.random() < 0.4 ? 1 : 0));
    if (Math.random() < 0.1 + (e.elite ? 0.9 : 0) + (e.arch === 'heavy' ? 0.08 : 0)) this.spawnItem(e.x, e.z, rollItem(f, { luck: e.elite ? 0.2 : 0 , min: e.elite ? 'uncommon' : 'common' }));
    if (Math.random() < 0.13) this.spawnOrb(e.x, e.z, 'hp'); if (Math.random() < 0.1) this.spawnOrb(e.x, e.z, 'mp');
    p.heal(p.maxHp * 0.012); p.addUlt(4); addMastery(p.stats.family, 1); if (p.lock === e) p.lock = null;
    p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.03); if (e.elite) { this.callout('ELITE DEFEATED', '#ffd860'); this.hitstop(0.1); }
    checkAchievements();
  }
  onBossDeath(e: Enemy) {
    const s = this.spec!, p = this.player, bi = e.bossIdx; this.cine = { kind: 'death', t: 0, dur: 3.6, target: e }; this.input.frozen = true; p.iframes = 99; this.slowmo(0.22, 2.6); this.flash('#fff', 0.8); sfx('roar', 1, 0.6); sfx('explode', 1); this.shake(1.4);
    for (const o of this.enemies) if (o !== e && !o.dead && !o.isBoss) { o.hp = 0; o.die(this); }
    this.fx.ring(e.x, 0.2, e.z, e.bossDef.glow, 30, 1.4); this.callout(`${e.name.toUpperCase()} DEFEATED`, '#ffd860');
    for (let i = 0; i < 6; i++) this.laterReal(0.4 + i * 0.35, () => { this.fx.blast(e.x + (Math.random() - 0.5) * e.radius * 2, Math.random() * e.rig.height, e.z + (Math.random() - 0.5) * e.radius * 2, e.bossDef.glow, 3 + Math.random() * 3, 0.5, 0.8); sfx('explode', 0.6, 0.7 + Math.random() * 0.5); this.shake(0.6); });
    this.laterReal(2.8, () => {
      this.cine = null; this.input.frozen = false; p.iframes = 1; this.flash('#fff', 0.9); this.fx.pillar(e.x, 0, e.z, e.bossDef.glow, 4, 40, 1.2, 0.7); this.fx.burst(e.x, e.rig.height * 0.5, e.z, e.bossDef.glow, 120, 16, 1.5, 0.5, 4);
      const f = (bi + 1) * 10, first = !this.ui.save.bosses[bi]; this.kills++; bumpStat('kills'); const xp = Math.round((300 + 60 * f) * (first ? 1.5 : 1)); this.xpGot += xp; this.awardXp(xp);
      this.score += (5000 + bi * 1500) * (p.damageTaken === 0 ? 2 : 1); recordBoss(bi, this.floorTime, p.damageTaken === 0);
      if (p.damageTaken === 0) { banner('NO-HIT VICTORY', 'Flawless', '#7ffcff'); }
      this.spawnGold(e.x, e.z, 400 + f * 60, 16); addEssence(5 + bi * 2);
      this.spawnItem(e.x - 2, e.z + 1, bossDrop(bi, f)); this.spawnItem(e.x + 2, e.z + 1, rollItem(f + 3, { min: 'epic', luck: 0.3 })); if (first || Math.random() < 0.4) this.spawnItem(e.x, e.z + 3, bossDrop(bi, f));
      this.spawnOrb(e.x, e.z + 2, 'hp'); this.spawnOrb(e.x + 1, e.z + 2, 'hp'); checkAchievements();
      if (s.mode === 'bossrush') { this.finishRush(); } else if (s.mode === 'endless') { /* continue */ } else { this.clearFloor(); }
    });
  }
  private finishRush() {
    const p = this.player; this.cleared = true; p.heal(p.maxHp * 0.4); this.rushIdx++;
    if (this.rushIdx >= this.rushList.length) { bumpStat('rush', 1); checkAchievements(); this.score += 10000; this.gameoverShown = true; const place = addHiScore(this.score, this.rushList.length, 'bossrush'); persist(); document.exitPointerLock?.(); useStore.setState({ gameover: { score: this.score, floor: this.rushList.length, mode: 'bossrush', place, spec: this.spec!, won: true } }); return; }
    banner('NEXT GUARDIAN', REGIONS[this.rushList[this.rushIdx]].boss.name, '#ff6a5a'); this.laterReal(3.5, () => this.loadFloor(bossSpec(this.rushList[this.rushIdx], 'bossrush')));
  }
  onPlayerDeath() {
    const s = this.spec; bumpStat('deaths'); document.exitPointerLock?.();
    this.laterReal(1.7, () => {
      if (!s) return; this.gameoverShown = true; const wave = s.mode === 'endless' ? this.endlessWave : undefined; const place = s.mode === 'training' ? -1 : addHiScore(this.score, wave ?? s.n, s.mode); persist();
      useStore.setState({ gameover: { score: this.score, floor: s.n, mode: s.mode, wave, place, spec: s } });
    });
  }

  // ---------- HUD ----------
  private syncHud() {
    const p = this.player, st = this.ui.save, sl = st.slots; const boss = this.enemies.find((e) => e.isBoss && !e.dead && !this.bossIntro), mb = boss || this.enemies.find((e) => e.mini && !e.dead);
    const tg = p.lock && !p.lock.dead ? p.lock : this.lastTarget && !this.lastTarget.dead && this.lastTarget.lastHit < 4 ? this.lastTarget : null;
    const sp = this.spec; const R = sp ? REGIONS[sp.region] : null;
    useHud.setState({
      hp: p.hp, maxHp: p.maxHp, sta: p.sta, maxSta: p.maxSta, mp: p.mp, maxMp: p.maxMp, xp: st.xp, xpNeed: xpNeed(st.level), level: st.level, ult: p.ult, awk: p.awk, awakened: p.awakened,
      floor: sp ? (sp.mode === 'endless' ? this.endlessWave : sp.n) : 0, region: R ? R.name : 'Adventurer’s Hub', floorName: sp ? sp.name : 'Central Hub', type: sp ? (sp.mode !== 'tower' ? sp.mode.toUpperCase() : TYPE_INFO[sp.type].name) : '',
      obj: this.obj.text, objP: this.obj.p, objG: this.obj.g, time: this.floorTime, timeLeft: this.timeLeft, boss: mb && !mb.dead ? { name: mb.name, hp: mb.hp, max: mb.maxHp, phase: mb.phase, posture: mb.posture, stunned: mb.state === 'stun', atk: mb.atkName } : null,
      target: tg && tg !== mb ? { name: tg.name, hp: tg.hp, max: tg.maxHp, elite: tg.elite } : null, combo: p.combo, comboT: p.comboT, score: this.score, mult: 1 + Math.min(2, p.combo * 0.03),
      cds: sl.map((id) => { if (!id) return 0; const d = id && p.cds[id] > 0 ? p.cds[id] : 0; return d; }), sel: p.selected, lock: !!p.lock, gold: st.gold, fps: this.fps, barrier: p.barrier, wave: sp?.mode === 'endless' ? `WAVE ${this.endlessWave}` : '', counterReady: p.counterT > 0, family: p.stats.family,
      callout: this.callouts, cine: !!this.cine, training: sp?.mode === 'training' ? { perfect: this.trainS.perfect, dmg: this.trainS.dmg, combo: p.maxCombo } : null,
    });
  }
}
