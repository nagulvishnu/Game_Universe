import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { DUNGEONS, ENEMIES, QUEST_BY_ID, genItem, genLegend, RARITY_HEX, Item, MATS, ELDER_LINES, ELEM_COLOR, RAR } from './data';
import { useGame } from './store';
import { useHud } from './hud';
import { audio } from './audio';
import { Particles, Effects, Telegraph } from './fx';
import { buildWorld, buildDungeon, Level, Inter, Room, makeChest } from './level';
import { Enemy } from './enemy';
import { Player } from './player';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const ang = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const now = () => performance.now() / 1000;

class Input {
  keys = new Set<string>(); press: Record<string, number> = {};
  down(c: string) { return this.keys.has(c); }
  consume(c: string, win = 0.15) { const t = this.press[c]; if (t !== undefined && now() - t <= win) { delete this.press[c]; return true; } return false; }
}
interface Proj { m: THREE.Mesh; x: number; y: number; z: number; vx: number; vz: number; speed: number; dmg: number; color: number; owner: string; r: number; status?: string; pierce?: boolean; aoe?: boolean; homing?: Enemy | null; life: number; hit: Set<Enemy> }
interface Wave { x: number; z: number; r: number; speed: number; max: number; dmg: number; hit: boolean; m: THREE.Mesh; src: Enemy }
interface Drop { m: THREE.Group; kind: string; data: any; x: number; z: number; y: number; vy: number; vx: number; vz: number; age: number; stat: boolean; spin: number }

export class Game {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; composer: EffectComposer | null = null; bloom: UnrealBloomPass | null = null;
  container: HTMLElement; input = new Input(); fx!: { p: Particles; pb: Particles; eff: Effects; tg: Telegraph };
  level!: Level; p!: Player; enemies: Enemy[] = []; projs: Proj[] = []; waves: Wave[] = []; drops: Drop[] = []; spawnRecs: { s: any; e: Enemy | null; deadAt: number }[] = [];
  time = 0; hemi!: THREE.HemisphereLight; sun!: THREE.DirectionalLight; amb!: THREE.AmbientLight; torchL: THREE.PointLight[] = [];
  cam = { yaw: 0.0, pitch: 0.38, zoom: 6.2, cur: 6.2, pivot: new THREE.Vector3(), mouseAct: 0, fov: 65, shake: 0, menuT: 0 };
  cine: null | { t: number; dur: number; fn: (f: number) => { pos: THREE.Vector3; look: THREE.Vector3; fov?: number } } = null;
  hitStopT = 0; slow = { scale: 1, t: 0 }; transitioning = false; pointerFail = false; expectUnlock = false; statsDirty = false; inputLocked = false; hudT = 0; flowT = 0; torchT = 0; musicT = 0; bossDown = false; dungeonStart = 0; dungeonKills = 0; hintT = 0;
  dmgLayer: HTMLDivElement; flashEl: HTMLDivElement; dmgPool: { el: HTMLDivElement; x: number; y: number; z: number; t: number; dur: number; vx: number; use: boolean }[] = [];
  last = 0; fpsAcc = 0; fpsN = 0; running = false; interNear: Inter | null = null; chestGlow = new Map<Inter, number>(); activeBoss: Enemy | null = null; bossArenaLocked = false;
  tmpV = new THREE.Vector3(); sphereGeo = new THREE.SphereGeometry(1, 10, 8); projMats = new Map<number, THREE.MeshBasicMaterial>(); glowSprites = new Map<number, THREE.SpriteMaterial>();

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement); this.renderer.domElement.style.outline = 'none'; this.renderer.domElement.tabIndex = 0;
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 700); this.scene.add(this.camera);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6a8a50, 1.0); this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.15); this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.6); this.sun.castShadow = true; this.sun.shadow.camera.left = -34; this.sun.shadow.camera.right = 34; this.sun.shadow.camera.top = 34; this.sun.shadow.camera.bottom = -34; this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 140; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa84a, 0, 20, 2); this.scene.add(l); this.torchL.push(l); }
    this.fx = { p: new Particles(this.scene, 2000, 0.38), pb: new Particles(this.scene, 700, 1.0), eff: new Effects(this.scene), tg: new Telegraph(this.scene) };
    this.dmgLayer = document.createElement('div'); this.dmgLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5';
    this.flashEl = document.createElement('div'); this.flashEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:6;transition:opacity .25s';
    container.appendChild(this.dmgLayer); container.appendChild(this.flashEl);
    for (let i = 0; i < 28; i++) { const el = document.createElement('div'); el.style.cssText = 'position:absolute;left:0;top:0;font:800 22px system-ui,sans-serif;text-shadow:0 2px 4px #000,0 0 8px #000;white-space:nowrap;display:none;will-change:transform'; this.dmgLayer.appendChild(el); this.dmgPool.push({ el, x: 0, y: 0, z: 0, t: 0, dur: 1, vx: 0, use: false }); }
    this.applyQuality(); this.resize(); new ResizeObserver(() => this.resize()).observe(container);
    this.bindInput();
    this.level = buildWorld(this.q); this.p = new Player(this); this.setLevel(this.level, true);
    this.p.teleport(this.level.spawn.x, this.level.spawn.z, Math.PI);
    useGame.subscribe((s, prev) => { if (s.equipment !== prev.equipment || s.player.level !== prev.player.level || s.player.attr !== prev.player.attr || s.player.skills !== prev.player.skills || s.player.tfStage !== prev.player.tfStage) this.statsDirty = true; });
    this.running = true; this.last = performance.now(); requestAnimationFrame((t) => this.frame(t));
  }
  get q() { const s = useGame.getState().settings.quality; return s === 'low' ? 0 : s === 'medium' ? 1 : 2; }
  applyQuality() {
    const q = this.q; const dpr = window.devicePixelRatio || 1; this.renderer.setPixelRatio(q === 0 ? 1 : Math.min(dpr, q === 1 ? 1.5 : 2));
    this.sun.castShadow = q > 0; this.sun.shadow.mapSize.set(q === 2 ? 2048 : 1024, q === 2 ? 2048 : 1024); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); (this.sun.shadow as any).map = null; }
    if (q === 2) { if (!this.composer) this.initComposer(); } else { this.composer?.dispose(); this.composer = null; this.bloom = null; }
    this.resize();
  }
  initComposer() {
    this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.container.clientWidth, this.container.clientHeight), 0.5, 0.6, 0.85); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
  }
  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h); this.composer?.setPixelRatio(this.renderer.getPixelRatio());
  }

  // ───────── input ─────────
  isBlocked() { const s = useGame.getState(); return s.screen !== 'play' || s.paused || !!s.panel || s.intro || s.ending || this.transitioning; }
  locked() { return document.pointerLockElement === this.renderer.domElement; }
  requestLock() { if (this.pointerFail) return; try { const r: any = this.renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => { this.pointerFail = true; useHud.getState().set({ pointer: 'failed' }); }); } catch { this.pointerFail = true; useHud.getState().set({ pointer: 'failed' }); } }
  releaseLock() { this.expectUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); }
  bindInput() {
    const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyE', 'KeyR', 'KeyV', 'KeyT', 'KeyQ', 'KeyG', 'Space', 'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Tab']);
    window.addEventListener('keydown', (e) => {
      const st = useGame.getState(); if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (st.screen === 'play') {
        if (e.code === 'Escape') { if (st.panel) { st.closePanel(); this.afterPanel(); } else if (st.paused) { st.setPaused(false); this.requestLock(); } else if (!st.intro && !st.ending) { st.setPaused(true); this.releaseLock(); } return; }
        if (!st.intro && !st.ending && !st.paused && !this.transitioning) {
          const map: Record<string, any> = { KeyI: 'inventory', KeyC: 'character', KeyK: 'skills', KeyJ: 'quests', KeyM: 'map' };
          if (map[e.code] && !e.repeat) { if (st.panel === map[e.code]) { st.closePanel(); this.afterPanel(); } else if (!st.panel) { st.openPanel(map[e.code]); this.releaseLock(); } return; }
        } else if (st.panel && ['KeyI', 'KeyC', 'KeyK', 'KeyJ', 'KeyM'].includes(e.code) && !e.repeat) { const map: Record<string, any> = { KeyI: 'inventory', KeyC: 'character', KeyK: 'skills', KeyJ: 'quests', KeyM: 'map' }; if (st.panel === map[e.code]) { st.closePanel(); this.afterPanel(); } else if (['inventory', 'character', 'skills', 'quests', 'map'].includes(st.panel)) st.openPanel(map[e.code]); return; }
      }
      if (this.isBlocked()) return;
      this.keyHeld(e.code);
      if (!e.repeat) { this.input.press[e.code] = now(); if (e.code === 'KeyG') this.interact(); }
    });
    window.addEventListener('keyup', (e) => { this.input.keys.delete(e.code); });
    window.addEventListener('blur', () => this.input.keys.clear());
    const cv = this.renderer.domElement;
    cv.addEventListener('mousedown', (e) => {
      audio.init(); if (this.isBlocked()) return;
      if (!this.locked() && !this.pointerFail) { this.requestLock(); return; }
      this.input.keys.add('Mouse' + e.button); this.input.press['Mouse' + e.button] = now(); if (e.button === 2) this.toggleLock();
    });
    window.addEventListener('mouseup', (e) => this.input.keys.delete('Mouse' + e.button));
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.isBlocked() || this.cine && this.cine.dur > 5) return; if (!this.locked() && !this.pointerFail) return;
      const s = useGame.getState().settings; const k = 0.0022 * s.sens; this.cam.yaw -= e.movementX * k; this.cam.pitch = clamp(this.cam.pitch + e.movementY * k * (s.invertY ? -1 : 1), -0.3, 1.25);
      this.cam.mouseAct = Math.min(1.5, this.cam.mouseAct + Math.abs(e.movementX) * 0.02);
    });
    cv.addEventListener('wheel', (e) => { if (this.isBlocked()) return; this.cam.zoom = clamp(this.cam.zoom + Math.sign(e.deltaY) * 0.7, 3, 11); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      const l = this.locked(); useHud.getState().set({ pointer: l ? 'locked' : this.pointerFail ? 'failed' : 'free' });
      if (!l) { this.input.keys.clear(); const st = useGame.getState(); if (!this.expectUnlock && st.screen === 'play' && !st.paused && !st.panel && !st.intro && !st.ending && !this.transitioning) st.setPaused(true); this.expectUnlock = false; }
    });
    document.addEventListener('pointerlockerror', () => { this.pointerFail = true; useHud.getState().set({ pointer: 'failed' }); });
  }
  keyHeld(code: string) { this.input.keys.add(code); }
  afterPanel() { if (useGame.getState().screen === 'play' && !useGame.getState().paused) this.requestLock(); }
  toggleLock() {
    const p = this.p; if (p.lock) { p.lock = null; return; } let best: Enemy | null = null, bs = 1e9; const f = new THREE.Vector3(-Math.sin(this.cam.yaw), 0, -Math.cos(this.cam.yaw));
    for (const e of this.enemies) { if (e.dead || e.state === 'dormant') continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; const d = Math.hypot(dx, dz); if (d > 32) continue; if (this.level.grid.ray(p.pos.x, p.pos.z, e.pos.x, e.pos.z, false) < 1) continue; const a = Math.acos(clamp((dx * f.x + dz * f.z) / d, -1, 1)); if (a > 1.1) continue; const s = d * 0.5 + a * 12; if (s < bs) { bs = s; best = e; } }
    p.lock = best; if (best) audio.play('ui');
  }

  // ───────── helpers used by player / enemies ─────────
  sfx(n: string, pos?: THREE.Vector3, vol = 1) { audio.play(n, pos, vol); }
  shake(a: number) { if (useGame.getState().settings.shake) this.cam.shake = Math.min(1.4, this.cam.shake + a); }
  hitStop(ms: number) { this.hitStopT = Math.max(this.hitStopT, ms / 1000); }
  slowmo(scale: number, dur: number) { this.slow = { scale, t: dur }; }
  flash(color: string, a = 0.4) { this.flashEl.style.transition = 'none'; this.flashEl.style.background = color; this.flashEl.style.opacity = String(a); requestAnimationFrame(() => { this.flashEl.style.transition = 'opacity .45s'; this.flashEl.style.opacity = '0'; }); }
  hud(text: string, color = 0xffffff, sub = '') { useHud.getState().set({ banner: { title: text, sub: sub || '#' + color.toString(16).padStart(6, '0'), t: Date.now() } }); }
  hint(text: string) { useHud.getState().set({ hint: text }); this.hintT = 2; }
  hudSet(p: any) { useHud.getState().set(p); }
  startCine(dur: number, fn: (f: number) => { pos: THREE.Vector3; look: THREE.Vector3; fov?: number }) { this.cine = { t: 0, dur, fn }; }
  dmgNum(x: number, y: number, z: number, text: string, color = '#fff', size = 1) {
    const d = this.dmgPool.find((p) => !p.use); if (!d) return; d.use = true; d.x = x; d.y = y; d.z = z; d.t = 0; d.dur = 0.9 + size * 0.2; d.vx = (Math.random() - 0.5) * 1.2; d.el.textContent = text; d.el.style.color = color; d.el.style.fontSize = `${Math.round(20 * size)}px`; d.el.style.display = 'block';
  }
  updateDmgNums(dt: number) {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    for (const d of this.dmgPool) { if (!d.use) continue; d.t += dt; if (d.t >= d.dur) { d.use = false; d.el.style.display = 'none'; continue; } const f = d.t / d.dur; this.tmpV.set(d.x + d.vx * f, d.y + f * 1.6, d.z).project(this.camera); if (this.tmpV.z > 1) { d.el.style.display = 'none'; continue; } d.el.style.display = 'block'; d.el.style.opacity = String(1 - f * f); const s = 1 + (1 - Math.min(1, f * 6)) * 0.5; d.el.style.transform = `translate(${(this.tmpV.x * 0.5 + 0.5) * w}px,${(-this.tmpV.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${s})`; }
  }
  hurtPlayer(dmg: number, from: THREE.Vector3, o: any) { return this.p.hurt(dmg, from, o); }
  notifyAttack(pos: THREE.Vector3, r: number) { for (const e of this.enemies) if (!e.dead && e.pos.distanceTo(pos) < r + 3) e.reactDodge(this); }
  spawnEnemy(id: string, x: number, z: number, lvl: number, room: number, aggro = false) {
    const e = new Enemy(ENEMIES[id], lvl, x, z, room, this); if (aggro) { e.aggro = true; e.state = 'chase'; } this.enemies.push(e); return e;
  }
  clearProjectiles() { for (const pr of this.projs) { this.scene.remove(pr.m); } this.projs = []; }
  shoot(o: { x: number; y: number; z: number; dx: number; dz: number; speed: number; dmg: number; color: number; owner: string; radius?: number; status?: string; pierce?: boolean; aoe?: boolean; homing?: Enemy | null; life?: number }) {
    let mat = this.projMats.get(o.color); if (!mat) { mat = new THREE.MeshBasicMaterial({ color: o.color }); this.projMats.set(o.color, mat); }
    const r = o.radius ?? 0.4; const m = new THREE.Mesh(this.sphereGeo, mat); m.scale.setScalar(r); m.position.set(o.x, o.y, o.z);
    let sm = this.glowSprites.get(o.color); if (!sm) { sm = new THREE.SpriteMaterial({ map: (this.fx.p.pts.material as THREE.PointsMaterial).map, color: o.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); this.glowSprites.set(o.color, sm); }
    const sp = new THREE.Sprite(sm); sp.scale.setScalar(3.2); m.add(sp); this.scene.add(m);
    this.projs.push({ m, x: o.x, y: o.y, z: o.z, vx: o.dx, vz: o.dz, speed: o.speed, dmg: o.dmg, color: o.color, owner: o.owner, r, status: o.status, pierce: o.pierce, aoe: o.aoe, homing: o.homing, life: o.life ?? 4, hit: new Set() });
  }
  addWave(o: { x: number; z: number; speed: number; max: number; dmg: number; color: number; src: Enemy }) {
    const mat = new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), mat); m.position.set(o.x, 0.25, o.z); this.scene.add(m);
    this.waves.push({ x: o.x, z: o.z, r: 0.5, speed: o.speed, max: o.max, dmg: o.dmg, hit: false, m, src: o.src });
  }
  usePotion(id: string) {
    const s = useGame.getState(); if ((s.mats[id] || 0) < 1) { this.hint(`No ${MATS[id].name}`); return; } const p = this.p;
    if (id === 'hp_potion') { if (p.hp >= p.maxHp) return; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45); this.fx.pb.emit(p.pos.x, 1, p.pos.z, 20, { color: 0xff5470, speed: 3, up: 3, life: 0.8 }); }
    if (id === 'en_potion') { p.en = Math.min(p.maxEn, p.en + p.maxEn * 0.6); this.fx.pb.emit(p.pos.x, 1, p.pos.z, 20, { color: 0x4aa8ff, speed: 3, up: 3, life: 0.8 }); }
    if (id === 'elixir') { if (p.tfActive) return; p.tf = 100; this.fx.pb.emit(p.pos.x, 1, p.pos.z, 30, { color: 0xd070ff, speed: 3, up: 3, life: 0.8 }); }
    s.useMat(id, 1); audio.play('pickup');
  }
  refreshLook() { this.p?.applyLook(); }
  onLevelUp() { const p = this.p; p.refreshStats(); p.hp = p.maxHp; p.en = p.maxEn; this.fx.eff.ring(p.pos.x, p.pos.z, 1, 7, 0xffe14a, 0.9); this.fx.eff.pillar(p.pos.x, p.pos.z, 1.6, 14, 0xffe14a, 1.2); this.fx.pb.emit(p.pos.x, 1, p.pos.z, 60, { color: 0xffe14a, speed: 6, up: 5, life: 1 }); audio.play('levelup'); }
  checkSecrets(pos: THREE.Vector3, r: number) {
    for (const s of this.level.secrets) { if (s.found) continue; const x = (s.i + 0.5) * 2, z = (s.j + 0.5) * 2; if (Math.hypot(pos.x - x, pos.z - z) < r + 1.2) { s.found = true; this.level.grid.set(s.i, s.j, 0); this.scene.remove(s.mesh); this.fx.pb.emit(x, 2, z, 60, { color: 0xc8c0b0, speed: 6, life: 0.8, grav: 8 }); this.fx.eff.burst(x, 2, z, 3, 0xffffff, 0.3); audio.play('explode'); this.shake(0.6); this.hud('SECRET PASSAGE REVEALED', 0xc084fc); const st = useGame.getState(); st.questEvent('discover', 'secret', 1); st.addXp(60 + this.level.def!.level * 12); } }
  }

  // ───────── level management ─────────
  disposeLevel() {
    for (const e of this.enemies) e.dispose(this); this.enemies = []; this.spawnRecs = [];
    for (const d of this.drops) { this.scene.remove(d.m); } this.drops = []; this.clearProjectiles();
    for (const w of this.waves) { this.scene.remove(w.m); w.m.geometry.dispose(); (w.m.material as THREE.Material).dispose(); } this.waves = [];
    this.fx.eff.clear(); this.fx.tg.pool.forEach((t) => t.hide()); this.p.lock = null; this.activeBoss = null; this.cine = null;
    if (this.level) { this.scene.remove(this.level.group); this.level.group.traverse((o: any) => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); if (o.material && !o.material.userData?.shared) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m: THREE.Material) => m.dispose()); } if (o.isInstancedMesh) o.dispose(); }); }
  }
  setLevel(level: Level, initial = false) {
    if (!initial) this.disposeLevel(); this.level = level; this.bossDown = false; this.bossArenaLocked = false;
    if (level.sky) level.group.add(level.sky); this.scene.add(level.group); this.scene.background = new THREE.Color(level.bg); this.scene.fog = new THREE.Fog(level.bg, level.fogNear, level.fogFar);
    const dg = level.kind === 'dungeon'; const th = level.theme;
    this.hemi.color.set(dg ? 0x8a90b0 : 0xbfd8ff); this.hemi.groundColor.set(dg ? 0x2a2024 : 0x6a8a50); this.hemi.intensity = dg ? 0.55 + level.ambient * 0.9 : 1.15;
    this.amb.intensity = dg ? 0.25 : 0.2; this.sun.intensity = dg ? 0.8 : 2.6; this.sun.color.setHex(dg ? (th?.torch ?? 0xffffff) : level.sunColor);
    this.torchL.forEach((l) => { l.color.setHex(th?.torch ?? 0xffa84a); l.intensity = 0; });
    audio.setAmbience(level.ambience === 'wind' ? 'wind' : 'cave'); audio.setMusic(level.music);
    // enemies
    for (const s of level.spawns) { const e = this.spawnEnemy(s.id, s.x, s.z, s.lvl, s.room); if (s.id === 'dummy') e.model.root.rotation.y = Math.PI; this.spawnRecs.push({ s, e, deadAt: 0 }); }
    // pickups
    for (const pk of level.pickups) this.spawnStatic(pk);
    // chests persisted
    const used = useGame.getState().progress.chests;
    for (const it of level.inters) if (it.kind === 'chest' && level.kind === 'world' && used.includes(it.id)) { it.used = true; const lid = it.obj?.getObjectByName('lid'); if (lid) lid.rotation.x = -1.9; }
    // gate lock for puzzle room
    for (const r of level.rooms) if (r.kind === 'puzzle' && r.gates.exit) this.lockGate(r, 'exit');
    this.dungeonStart = this.time; this.dungeonKills = 0;
    useHud.getState().set({ location: level.name, boss: null, target: null });
  }
  lockGate(r: Room, which: 'entry' | 'exit') { const g = r.gates[which]; if (!g) return; for (const [i, j] of g.cells) this.level.grid.set(i, j, 3); g.mesh.visible = true; audio.play('gate'); }
  unlockGate(r: Room, which: 'entry' | 'exit') { const g = r.gates[which]; if (!g) return; for (const [i, j] of g.cells) this.level.grid.set(i, j, 0); g.mesh.visible = false; }
  transition(fn: () => void) {
    if (this.transitioning) return; this.transitioning = true; this.input.keys.clear(); useHud.getState().set({ fade: 1 });
    setTimeout(() => { fn(); setTimeout(() => { useHud.getState().set({ fade: 0 }); this.transitioning = false; const st = useGame.getState(); if (st.screen === 'play' && !st.intro) this.requestLock(); }, 350); }, 500);
  }
  enterDungeon(id: string) {
    const def = DUNGEONS.find((d) => d.id === id)!; audio.play('portal');
    this.transition(() => { const lv = buildDungeon(def, this.q); this.setLevel(lv); this.p.teleport(lv.spawn.x, lv.spawn.z, 0); this.cam.yaw = 0; this.cam.pivot.set(lv.spawn.x, 1.6, lv.spawn.z); this.hud(def.name.toUpperCase(), def.color, `Recommended level ${def.level}`); useGame.getState().save(); });
  }
  returnToWorld(fromDungeon?: string, respawn = false) {
    this.transition(() => {
      const lv = buildWorld(this.q); this.setLevel(lv); let sp = lv.spawn.clone(); let yaw = Math.PI;
      if (fromDungeon && !respawn) { const it = lv.inters.find((i) => i.id === fromDungeon); if (it) { sp = it.pos.clone(); yaw = Math.atan2(sp.x - it.data.wx, sp.z - it.data.wz); } }
      this.p.teleport(sp.x, sp.z, yaw); this.cam.pivot.set(sp.x, 1.6, sp.z); this.cam.yaw = yaw + Math.PI; if (respawn) this.p.revive(); this.hudSet({ dead: false }); useGame.getState().save();
    });
  }
  fastTravel(id: string) {
    if (this.level.kind !== 'world') { this.hint('Fast travel only works in the overworld'); return; }
    const it = this.level.inters.find((i) => i.id === id); const sp = id === 'village' ? this.level.spawn : it?.pos; if (!sp) return;
    this.transition(() => { this.p.teleport(sp.x, sp.z, Math.PI); this.cam.pivot.set(sp.x, 1.6, sp.z); });
  }
  respawn() { const st = useGame.getState(); st.addGold(-Math.round(st.player.gold * 0.1)); useGame.setState((s) => ({ progress: { ...s.progress, deaths: s.progress.deaths + 1 } })); this.returnToWorld(undefined, true); }
  onPlayerDeath() { useHud.getState().set({ dead: true }); this.releaseLock(); }

  // begin / quit
  begin(fresh: boolean) {
    audio.init(); const st = useGame.getState(); const p = this.p;
    const go = () => { const lv = buildWorld(this.q); this.setLevel(lv); p.teleport(lv.spawn.x, lv.spawn.z, Math.PI); p.tf = 0; p.tfActive = false; p.cds = { e: 0, r: 0, v: 0, eMax: 1, rMax: 1, vMax: 1 }; p.state = 'free'; p.refreshStats(true); this.cam.yaw = 0; this.cam.pivot.set(lv.spawn.x, 1.6, lv.spawn.z); st.setScreen('play'); st.setPaused(false); st.closePanel(); useHud.getState().set({ dead: false, boss: null }); if (!fresh || !st.intro) this.requestLock(); };
    if (this.level.kind === 'world' && !fresh) { go(); return; }
    go(); this.level.kind === 'world' && st.shop.length === 0 && st.restock();
    if (st.shop.length === 0) st.restock();
  }
  quitToMenu() { useGame.getState().save(); this.releaseLock(); if (this.level.kind !== 'world') { const lv = buildWorld(this.q); this.setLevel(lv); this.p.teleport(lv.spawn.x, lv.spawn.z, Math.PI); } useGame.getState().setPaused(false); useGame.getState().closePanel(); useGame.getState().setScreen('menu'); useHud.getState().set({ dead: false, boss: null }); }

  // ───────── interactions ─────────
  nearestInter(): Inter | null {
    let best: Inter | null = null, bd = 1e9; for (const it of this.level.inters) { if (it.used && (it.kind === 'chest' || it.kind === 'rune' || it.kind === 'shrine')) continue; const d = Math.hypot(it.pos.x - this.p.pos.x, it.pos.z - this.p.pos.z); if (d < it.r && d < bd) { bd = d; best = it; } }
    return best;
  }
  interact() {
    const it = this.interNear; if (!it || this.p.state === 'dead' || this.inputLocked) return; const st = useGame.getState();
    switch (it.kind) {
      case 'portal': this.enterDungeon(it.id); break;
      case 'return': this.returnToWorld(this.level.def?.id); break;
      case 'exit': this.returnToWorld(this.level.def?.id); break;
      case 'board': this.releaseLock(); st.openPanel('board'); break;
      case 'shop': this.releaseLock(); if (!st.shop.length || st.shopLvl + 3 < st.player.level) st.restock(); st.openPanel('shop'); break;
      case 'smith': this.releaseLock(); st.openPanel('smith'); break;
      case 'dialogue': { st.talkNpc('elder'); const ch = Math.min(ELDER_LINES.length - 1, Math.max(0, st.progress.chapter - 1 + (st.quests.m1?.s === 'done' ? 0 : 0))); const m = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']; let idx = 0; for (let i = 0; i < m.length; i++) if (st.quests[m[i]]?.s === 'done') idx = i + 1; this.releaseLock(); st.openPanel('dialogue', { name: 'Elder Maren', text: ELDER_LINES[Math.min(idx, ELDER_LINES.length - 1)] }); void ch; break; }
      case 'trainer': this.releaseLock(); st.openPanel('dialogue', { name: 'Kael, Trainer', text: 'Keep your feet moving! W-A-S-D follows the camera, so circle your foe with the mouse. F chains combos, double-tap S for a low sweep, Q blocks (tap right before a hit to PARRY), Shift dodges in combat. Charge your Awakening meter by fighting, then press T. Smash those dummies!' }); break;
      case 'lore': this.releaseLock(); st.openPanel('dialogue', { name: 'Ancient Inscription', text: it.data }); st.unlockAch('lore', 'Lorekeeper'); break;
      case 'chest': this.openChest(it); break;
      case 'rune': this.activateRune(it); break;
      case 'shrine': it.used = true; this.p.hp = this.p.maxHp; this.p.en = this.p.maxEn; this.p.status = { burn: 0, slow: 0, poison: 0 }; this.fx.pb.emit(it.pos.x, 1.5, it.pos.z, 60, { color: 0x7affc0, speed: 4, up: 4, life: 1 }); audio.play('levelup'); this.hud('RESTORED', 0x7affc0); break;
    }
  }
  openChest(it: Inter) {
    if (it.used) return; it.used = true; const st = useGame.getState(); const lid = it.obj?.getObjectByName('lid'); const lvl = this.level.def ? this.level.def.level + 2 : Math.max(1, st.player.level);
    let t = 0; const anim = () => { t += 0.05; if (lid) lid.rotation.x = -1.9 * Math.min(1, t * 2.5); if (t < 0.6) requestAnimationFrame(anim); }; anim();
    if (this.level.kind === 'world') useGame.setState((s) => ({ progress: { ...s.progress, chests: [...s.progress.chests, it.id] } }));
    useGame.setState((s) => ({ progress: { ...s.progress, chestCount: s.progress.chestCount + 1 } }));
    const b = it.data?.boost ?? 1; const pos = it.pos;
    const gold = Math.round((30 + Math.random() * 80) * (1 + lvl * 0.15) * (1 + b * 0.3)); this.spawnDrop('gold', gold, pos.x, pos.z + 0.5);
    const n = 1 + (b >= 2 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0); for (let i = 0; i < n; i++) this.spawnDrop('item', genItem(lvl, { boost: b, minRarity: it.data?.boss ? 2 : 0 }), pos.x + (i - 0.5) * 0.8, pos.z + 1);
    const mats = [this.level.def?.mat ?? 'iron_ore', 'iron_ore', 'herb']; this.spawnDrop('mat', { id: mats[Math.floor(Math.random() * 3)], n: 1 + Math.floor(Math.random() * 3) }, pos.x - 0.8, pos.z + 1);
    this.fx.pb.emit(pos.x, 1, pos.z, 40, { color: 0xffd24a, speed: 5, up: 4, life: 0.9, grav: 4 }); this.fx.eff.pillar(pos.x, pos.z, 0.8, 8, 0xffd24a, 0.8); audio.play('chest'); st.questEvent('chest', 'chest', 1);
    if (st.progress.chestCount + 1 >= 10) st.unlockAch('chests', 'Treasure Hunter');
  }
  activateRune(it: Inter) {
    if (it.used) return; it.used = true; const r = this.level.rooms.find((x) => x.kind === 'puzzle')!; r.runes++; const orb = it.obj?.userData.orb as THREE.Mesh; if (orb) (orb.material as THREE.MeshBasicMaterial).color.setHex(this.level.def!.theme.accent);
    audio.play('portal'); this.fx.eff.pillar(it.pos.x, it.pos.z + 1.4, 1, 10, this.level.def!.theme.accent, 0.9); this.shake(0.4);
    if (r.runes >= 3) { this.unlockGate(r, 'exit'); this.hud('THE SEAL BREAKS', this.level.def!.theme.accent, 'The way forward is open'); audio.play('gate'); }
    const n = r.runes === 3 ? 2 : 3; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; const x = it.pos.x + Math.cos(a) * 7, z = it.pos.z + Math.sin(a) * 6 - 2; const sx = this.level.grid.blocked(x, z, 0.6) ? it.pos.x : x, sz = this.level.grid.blocked(x, z, 0.6) ? it.pos.z - 4 : z; this.spawnEnemy(this.level.def!.pool[i % this.level.def!.pool.length], sx, sz, this.level.def!.level + 2, r.i, true); this.fx.eff.pillar(sx, sz, 1, 6, this.level.def!.theme.accent, 0.6); }
  }

  // ───────── loot / drops ─────────
  spawnStatic(pk: { kind: string; id: string; n: number; x: number; z: number }) {
    const g = new THREE.Group(); const col = pk.kind === 'herb' ? 0x6aff8a : 0x9aa4b8;
    const m = new THREE.Mesh(pk.kind === 'herb' ? new THREE.ConeGeometry(0.2, 0.7, 5) : new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: col })); m.position.y = 0.4; g.add(m);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: (this.fx.p.pts.material as THREE.PointsMaterial).map, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 })); sp.scale.setScalar(1.8); sp.position.y = 0.5; g.add(sp); g.position.set(pk.x, 0, pk.z); this.scene.add(g);
    this.drops.push({ m: g, kind: 'mat', data: { id: pk.id, n: pk.n }, x: pk.x, z: pk.z, y: 0, vy: 0, vx: 0, vz: 0, age: 1, stat: true, spin: Math.random() * 6 });
  }
  spawnDrop(kind: string, data: any, x: number, z: number) {
    const g = new THREE.Group(); let col = 0xffd24a; let geo: THREE.BufferGeometry = new THREE.OctahedronGeometry(0.22);
    if (kind === 'item') { col = RARITY_HEX[(data as Item).rarity]; geo = new THREE.BoxGeometry(0.5, 0.5, 0.5); }
    else if (kind === 'mat') { col = parseInt(MATS[data.id].color.slice(1), 16); geo = new THREE.IcosahedronGeometry(0.22); }
    else if (kind === 'hp') { col = 0xff5470; geo = new THREE.SphereGeometry(0.25, 8, 6); }
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col })); m.position.y = 0.5; g.add(m);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: (this.fx.p.pts.material as THREE.PointsMaterial).map, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(kind === 'item' ? 3 : 1.6); sp.position.y = 0.5; g.add(sp);
    if (kind === 'item' && RAR.indexOf((data as Item).rarity) >= 2) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 14, 6, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); b.position.y = 7; g.add(b); }
    g.position.set(x, 0, z); this.scene.add(g); const a = Math.random() * 6.28;
    this.drops.push({ m: g, kind, data, x, z, y: 0.2, vy: 6 + Math.random() * 3, vx: Math.cos(a) * (1.5 + Math.random() * 2), vz: Math.sin(a) * (1.5 + Math.random() * 2), age: 0, stat: false, spin: 0 });
  }
  updateDrops(dt: number) {
    const p = this.p; const st = useGame.getState();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.age += dt; d.spin += dt * 2.5; const dist = Math.hypot(p.pos.x - d.x, p.pos.z - d.z);
      if (!d.stat) {
        if (d.y > 0 || d.vy > 0) { d.vy -= 22 * dt; d.y += d.vy * dt; if (d.y <= 0) { d.y = 0; d.vy *= -0.35; if (Math.abs(d.vy) < 1) d.vy = 0; d.vx *= 0.6; d.vz *= 0.6; } }
        const nx = d.x + d.vx * dt, nz = d.z + d.vz * dt; if (!this.level.grid.solidAt(nx, nz)) { d.x = nx; d.z = nz; } d.vx *= 1 - dt * 2; d.vz *= 1 - dt * 2;
        if (d.age > 0.7 && dist < 7 && p.state !== 'dead' && (d.kind === 'gold' || d.kind === 'mat' || d.kind === 'hp' || d.kind === 'item')) { const k = Math.min(1, dt * (4 + (7 - dist))) ; d.x += (p.pos.x - d.x) * k; d.z += (p.pos.z - d.z) * k; }
      }
      d.m.position.set(d.x, d.y, d.z); d.m.children[0].rotation.y = d.spin; d.m.children[0].position.y = 0.5 + Math.sin(d.spin * 1.4) * 0.08;
      const reach = d.stat ? 1.5 : 1.3;
      if (dist < reach && d.age > 0.45 && p.state !== 'dead') {
        let ok = true;
        switch (d.kind) {
          case 'gold': st.addGold(d.data); this.dmgNum(p.pos.x, 2.4, p.pos.z, `+${d.data} gold`, '#ffd24a', 0.8); break;
          case 'item': ok = st.giveItem(d.data); break;
          case 'mat': st.addMat(d.data.id, d.data.n); this.dmgNum(p.pos.x, 2.4, p.pos.z, `+${d.data.n} ${MATS[d.data.id].name}`, MATS[d.data.id].color, 0.8); break;
          case 'hp': p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.12); break;
        }
        if (ok) { audio.play('pickup', undefined, 0.7); this.scene.remove(d.m); this.drops.splice(i, 1); }
      }
    }
  }
  onKill(e: Enemy) {
    const st = useGame.getState(); const d = e.def; const lvlF = 1 + 0.15 * (e.lvl - 1); this.dungeonKills++;
    if (d.tier !== 'dummy') { st.recordKill(d.id); st.addXp(d.xp * lvlF); } else { st.recordKill('dummy'); st.addXp(d.xp); }
    const fortune = this.p.stats.passives.includes('fortune') ? 1.25 : 1;
    if (d.tier !== 'dummy') {
      const g = Math.round(d.gold * lvlF * fortune * (0.7 + Math.random() * 0.6)); const orbs = Math.min(4, 1 + Math.floor(g / 25)); for (let i = 0; i < orbs; i++) this.spawnDrop('gold', Math.max(1, Math.round(g / orbs)), e.pos.x, e.pos.z);
      const ic = d.tier === 'elite' ? 0.55 : d.tier === 'boss' ? 0 : 0.09 * fortune; if (Math.random() < ic) this.spawnDrop('item', genItem(e.lvl, { boost: d.tier === 'elite' ? 0.9 : 0.1 }), e.pos.x, e.pos.z);
      if (d.mat && Math.random() < d.mat[1] * fortune) this.spawnDrop('mat', { id: d.mat[0], n: d.tier === 'boss' ? 4 : 1 }, e.pos.x, e.pos.z); if (Math.random() < 0.08) this.spawnDrop('hp', 0, e.pos.x, e.pos.z);
    }
    const sw = useGame.getState().player.skills.secondwind; if (sw > 0) this.p.hp = Math.min(this.p.maxHp, this.p.hp + this.p.maxHp * 0.01 * sw);
    this.p.gainEn(8); this.p.addTf(d.tier === 'elite' ? 10 : 3);
    if (this.p.lock === e) { this.p.lock = null; let best: Enemy | null = null, bd = 12; for (const o of this.enemies) { if (o.dead || o === e || o.state === 'dormant') continue; const dd = o.pos.distanceTo(this.p.pos); if (dd < bd) { bd = dd; best = o; } } if (best && useGame.getState().settings) this.p.lock = best; }
    const rec = this.spawnRecs.find((r) => r.e === e); if (rec) rec.deadAt = this.time;
    if (d.tier === 'boss') this.onBossDown(e);
    if (d.tier === 'elite') this.shake(0.3);
  }
  onBossDown(e: Enemy) {
    this.bossDown = true; const st = useGame.getState(); const d = e.def; this.slowmo(0.22, 2.2); this.flash('#ffffff', 0.35);
    const bp = e.pos.clone(); this.startCine(3.2, (f) => { const a = f * 1.2 + 0.6; return { pos: new THREE.Vector3(bp.x + Math.sin(a) * (11 - f * 2), 3 + f * 1.5, bp.z + Math.cos(a) * (11 - f * 2)), look: new THREE.Vector3(bp.x, e.height * 0.5, bp.z), fov: 60 - f * 8 }; });
    this.hud('VICTORY', 0xffe14a, `${d.name} has fallen`); audio.play('victory');
    st.questEvent('boss', d.id, 1); st.unlockAch('boss_' + d.id, `Slayer of ${d.name}`); useGame.setState((s) => ({ progress: { ...s.progress, bossKills: { ...s.progress.bossKills, [d.id]: (s.progress.bossKills[d.id] || 0) + 1 } } }));
    for (let i = 0; i < 5; i++) setTimeout(() => { this.fx.eff.ring(bp.x, bp.z, 1, 9 + i * 2, ELEM_COLOR[d.el], 0.8); this.fx.pb.emit(bp.x, 2 + i, bp.z, 60, { color: ELEM_COLOR[d.el], speed: 10, life: 1.2, grav: 3 }); audio.play('explode', bp); this.shake(0.7); }, i * 350);
    setTimeout(() => {
      const first = !(st.progress.completed[this.level.def?.id || ''] > 0); const lvl = e.lvl;
      if (first || Math.random() < 0.35) this.spawnDrop('item', genLegend(d.id, lvl), bp.x, bp.z + 1.5);
      for (let i = 0; i < 2; i++) this.spawnDrop('item', genItem(lvl, { boost: 3, minRarity: 2 }), bp.x + (i - 0.5) * 2, bp.z + 2.5);
      if (d.mat) this.spawnDrop('mat', { id: d.mat[0], n: d.mat[1] }, bp.x - 2, bp.z + 2); this.spawnDrop('mat', { id: 'iron_ore', n: 6 }, bp.x + 2, bp.z + 2); this.spawnDrop('mat', { id: 'elixir', n: 1 }, bp.x, bp.z + 3);
      for (let i = 0; i < 5; i++) this.spawnDrop('gold', Math.round(d.gold / 5), bp.x, bp.z);
      st.addXp(d.xp * (1 + 0.15 * (lvl - 1))); const dun = this.level.def; if (dun) { st.completeDungeon(dun.id); st.addXp(100 * dun.level); }
      const r = this.level.bossRoom; if (r) { const ex: Inter = { id: 'exit', kind: 'exit', pos: new THREE.Vector3(r.center.x, 0, r.center.z + 6), r: 3.5, prompt: 'Enter the Exit Portal' }; const pm = new THREE.Mesh(new THREE.TorusGeometry(2, 0.2, 8, 24), new THREE.MeshBasicMaterial({ color: dun?.color ?? 0xffffff })); pm.position.set(ex.pos.x, 2.2, ex.pos.z); this.level.group.add(pm); const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), new THREE.MeshBasicMaterial({ color: dun?.color ?? 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); disc.position.copy(pm.position); this.level.group.add(disc); this.level.anim.push((t) => { pm.rotation.z = t; disc.rotation.z = -t; }); this.level.inters.push(ex); this.fx.eff.pillar(ex.pos.x, ex.pos.z, 2, 20, dun?.color ?? 0xffffff, 1.6); }
      this.p.victory(); audio.play('quest'); this.hud('DUNGEON CLEARED', 0xffe14a, 'An exit portal has appeared');
      if (d.id === 'abyssking') setTimeout(() => { st.setEnding(true); this.releaseLock(); }, 4500);
      st.save();
    }, 3000);
  }

  // ───────── main loop ─────────
  frame(t: number) {
    requestAnimationFrame((tt) => this.frame(tt)); let dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; if (dt <= 0) return;
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 0.5) { useHud.getState().set({ fps: Math.round(this.fpsN / this.fpsAcc) }); this.fpsAcc = 0; this.fpsN = 0; }
    const st = useGame.getState(); const blocked = this.isBlocked();
    if (st.screen === 'menu') { this.menuStep(dt); }
    else if (!blocked) {
      if (this.statsDirty) { this.statsDirty = false; this.p.refreshStats(); }
      let sim = dt;
      if (this.slow.t > 0) { this.slow.t -= dt; sim = dt * this.slow.scale; } if (this.hitStopT > 0) { this.hitStopT -= dt; sim = 0; }
      const steps = Math.max(1, Math.ceil(sim / (1 / 60))); if (sim > 0) for (let i = 0; i < steps; i++) this.step(sim / steps);
      st.addPlay(dt * 0); this.updateCamera(dt); this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.1; this.syncHud(); } if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) useHud.getState().set({ hint: '' }); }
    } else { this.updateCamera(dt * 0.0001); }
    this.updateDmgNums(dt); audio.setListener(this.camera);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
  menuStep(dt: number) {
    this.cam.menuT += dt * 0.08; const a = this.cam.menuT; const c = this.camera; const px = this.p.pos.x, pz = this.p.pos.z;
    c.position.set(px + Math.sin(a) * 9, 3.2 + Math.sin(a * 2) * 0.4, pz + Math.cos(a) * 9); c.lookAt(px, 1.4, pz); this.p.rig.root.position.copy(this.p.pos); this.p.rig.update(dt, { state: 'idle', speed: 0 }); this.time += dt;
    for (const a2 of this.level.anim) a2(this.time, dt); this.fx.p.update(dt); this.fx.pb.update(dt); this.sun.position.set(px + 30, 50, pz + 20); this.sun.target.position.set(px, 0, pz); this.sun.target.updateMatrixWorld();
    for (const e of this.enemies) e.update(dt, this);
  }
  step(dt: number) {
    this.time += dt; const p = this.p; const lv = this.level; const grid = lv.grid;
    this.inputLocked = !!this.cine && this.cine.dur < 4 && this.bossIntroActive() || this.transitioning;
    p.update(dt);
    this.flowT -= dt; if (this.flowT <= 0 && this.enemies.length) { this.flowT = 0.3; grid.computeFlow(p.pos.x, p.pos.z, 70); }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]; const far = lv.kind === 'world' && e.pos.distanceToSquared(p.pos) > 80 * 80;
      if (far && !e.dead) { e.model.root.visible = false; e.barG.visible = false; continue; } e.model.root.visible = true;
      e.update(dt, this); if (e.removed) { e.dispose(this); this.enemies.splice(i, 1); }
    }
    this.updateProjectiles(dt); this.updateWaves(dt); this.updateDrops(dt);
    for (const a of lv.anim) a(this.time, dt);
    this.fx.p.update(dt); this.fx.pb.update(dt); this.fx.eff.update(dt);
    if (lv.kind === 'dungeon') this.dungeonLogic(); else this.worldLogic();
    // interactions
    this.interNear = this.nearestInter(); const pr = this.interNear && !this.transitioning && p.state !== 'dead' ? `[G] ${this.interNear.prompt}` : ''; if (pr !== useHud.getState().prompt) useHud.getState().set({ prompt: pr });
    // torch lights
    if (lv.kind === 'dungeon') { this.torchT -= dt; if (this.torchT <= 0) { this.torchT = 0.35; const sorted = lv.torches.map((t) => ({ t, d: t.distanceToSquared(p.pos) })).sort((a, b) => a.d - b.d).slice(0, 4); sorted.forEach((s, i) => { this.torchL[i].position.copy(s.t); this.torchL[i].intensity = 55; }); } this.torchL.forEach((l, i) => { l.intensity = (l.intensity > 1 ? 55 : 0) * (0.9 + Math.sin(this.time * 14 + i * 3) * 0.08); }); }
    this.sun.position.set(p.pos.x + 28, 48, p.pos.z + 18); this.sun.target.position.copy(p.pos); this.sun.target.updateMatrixWorld();
    // cinematic update
    if (this.cine) { this.cine.t += dt; if (this.cine.t >= this.cine.dur) this.cine = null; }
    // music
    this.musicT -= dt; if (this.musicT <= 0) { this.musicT = 1; const boss = this.enemies.find((e) => e.isBoss && !e.dead && e.state !== 'dormant'); audio.setMusic(boss ? 'boss' : lv.music); }
    // fast respawn of world enemies
    if (lv.kind === 'world') for (const r of this.spawnRecs) if (r.e && r.e.dead && this.time - r.deadAt > 100 && r.e.pos.distanceTo(p.pos) > 45 && r.s.id !== 'dummy') { r.e.removed = true; r.e = this.spawnEnemy(r.s.id, r.s.x, r.s.z, r.s.lvl, -1); r.deadAt = 0; } else if (r.e && r.e.dead && r.s.id === 'dummy' && this.time - r.deadAt > 3) { r.e.removed = true; r.e = this.spawnEnemy('dummy', r.s.x, r.s.z, 1, -1); r.e.model.root.rotation.y = Math.PI; r.e.yaw = Math.PI; }
  }
  bossIntroActive() { return this.enemies.some((e) => e.isBoss && e.state === 'phase' && e.phase === 0 && !e.dead); }
  worldLogic() {
    const p = this.p; const st = useGame.getState();
    for (const d of this.level.discover) { if (st.progress.secrets.includes(d.id)) continue; if (Math.hypot(p.pos.x - d.x, p.pos.z - d.z) < d.r) { useGame.setState((s) => ({ progress: { ...s.progress, secrets: [...s.progress.secrets, d.id] } })); st.questEvent('discover', 'secret', 1); st.addXp(120); this.hud('DISCOVERED', 0x7ad8ff, d.name); audio.play('quest'); st.toast(`Discovered: ${d.name}`, '#7ad8ff', '🧭'); if (useGame.getState().progress.secrets.length >= 3) st.unlockAch('explorer', 'Explorer of Aurelith'); } }
    // ambient portal particles
    if (Math.random() < 0.25) for (const d of DUNGEONS) { if (Math.hypot(d.wx - p.pos.x, d.wz - p.pos.z) < 45) this.fx.p.emit(d.wx + (Math.random() - 0.5) * 4, 0.5, d.wz + (Math.random() - 0.5) * 4, 1, { color: d.color, speed: 0.5, up: 4, life: 1.4 }); }
  }
  dungeonLogic() {
    const p = this.p; const lv = this.level; const g = lv.grid; const ci = g.ci(p.pos.x), cj = g.cj(p.pos.z);
    for (const r of lv.rooms) {
      const inside = r.kind === 'boss' ? Math.hypot(ci - r.cx, cj - r.cz) < 9 : ci >= r.x0 + 2 && ci <= r.x1 - 2 && cj >= r.z0 + 2 && cj <= r.z1 - 2;
      const alive = this.enemies.filter((e) => e.room === r.i && !e.dead).length;
      if (r.state === 'idle' && inside && p.state !== 'dead') {
        if (r.kind === 'boss') { r.state = 'active'; this.startBossIntro(r); }
        else if (alive > 0 && r.kind !== 'start') { r.state = 'active'; this.lockGate(r, 'entry'); if (r.kind !== 'puzzle') this.lockGate(r, 'exit'); this.hud('AMBUSH', 0xff5a4a); for (const e of this.enemies) if (e.room === r.i && !e.dead) { e.aggro = true; if (e.state === 'idle') e.state = 'chase'; } }
        else r.state = r.kind === 'puzzle' ? 'active' : 'cleared';
      }
      if (r.state === 'active' && r.kind !== 'boss' && r.kind !== 'puzzle' && alive === 0) { r.state = 'cleared'; this.unlockGate(r, 'entry'); this.unlockGate(r, 'exit'); this.hud('ROOM CLEARED', 0x7affc0); audio.play('quest'); }
      if (r.kind === 'puzzle' && r.state === 'active' && inside) { /* entry gate locked only during ambush waves */ }
    }
    // boss tracking
    const boss = this.enemies.find((e) => e.isBoss);
    if (boss && boss.state !== 'dormant' && !boss.dead) this.activeBoss = boss;
    if (this.bossArenaLocked && boss?.dead) { const r = lv.bossRoom!; this.unlockGate(r, 'entry'); this.bossArenaLocked = false; }
    // keep boss arena
    void boss;
  }
  startBossIntro(r: Room) {
    const boss = this.enemies.find((e) => e.isBoss && e.room === r.i); if (!boss) return; this.lockGate(r, 'entry'); this.bossArenaLocked = true;
    boss.state = 'phase'; boss.t = 0; boss.aggro = true; boss.invuln = true; const bp = boss.pos.clone(); const h = boss.height;
    this.startCine(3.0, (f) => { const a = -0.8 + f * 1.4; const d = 8 + boss.scale * 3.2 - f * 2; return { pos: new THREE.Vector3(bp.x + Math.sin(a) * d, 2 + f * (h * 0.3), bp.z + Math.cos(a) * d), look: new THREE.Vector3(bp.x, h * (0.45 + f * 0.2), bp.z), fov: 58 + f * 8 }; });
    audio.play('roar', boss.pos, 1.4); this.shake(0.8);
    setTimeout(() => this.hud(boss.def.name.toUpperCase(), 0xff4a60, boss.def.title || ''), 600); this.p.lock = null;
  }
  updateProjectiles(dt: number) {
    const p = this.p; const grid = this.level.grid;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i]; pr.life -= dt; let dead = pr.life <= 0;
      if (pr.homing && !pr.homing.dead) { const tx = pr.homing.pos.x - pr.x, tz = pr.homing.pos.z - pr.z; const ta = Math.atan2(tx, tz); const ca = Math.atan2(pr.vx, pr.vz); const na = ca + clamp(ang(ca, ta), -5 * dt, 5 * dt); pr.vx = Math.sin(na); pr.vz = Math.cos(na); const ty = pr.homing.hover + pr.homing.y + pr.homing.height * 0.5; pr.y += (ty - pr.y) * Math.min(1, dt * 4); }
      pr.x += pr.vx * pr.speed * dt; pr.z += pr.vz * pr.speed * dt;
      const v = grid.get(grid.ci(pr.x), grid.cj(pr.z)); if (v === 1 || v === 3 || v === 4 || v === 5) dead = true;
      pr.m.position.set(pr.x, pr.y, pr.z); if (Math.random() < 0.9) this.fx.p.emit(pr.x, pr.y, pr.z, 1, { color: pr.color, speed: 0.6, life: 0.35 });
      if (!dead) {
        if (pr.owner === 'enemy') { if (Math.hypot(p.pos.x - pr.x, p.pos.z - pr.z) < pr.r + p.radius && Math.abs(p.pos.y + 1 - pr.y) < 1.9 && p.state !== 'dead') { this.p.hurt(pr.dmg, new THREE.Vector3(pr.x - pr.vx, 0, pr.z - pr.vz), { status: pr.status, poise: 12 }); dead = true; } }
        else for (const e of this.enemies) { if (e.dead || e.state === 'dormant' || pr.hit.has(e)) continue; const ey = e.hover + e.y; if (Math.hypot(e.pos.x - pr.x, e.pos.z - pr.z) < e.radius * 0.9 + pr.r && pr.y > ey - 0.3 && pr.y < ey + e.height + 0.6) { pr.hit.add(e); p.hitSet.delete(e); p.strike(e, { dmg: pr.dmg / Math.max(1, p.stats.atk * p.dmgMult), kb: 3, poise: 14 }, 1, 'skill'); this.shake(0.12); if (!pr.pierce) { dead = true; break; } } }
      }
      if (dead) {
        this.fx.pb.emit(pr.x, pr.y, pr.z, 12, { color: pr.color, speed: 5, life: 0.4 }); this.fx.eff.burst(pr.x, pr.y, pr.z, pr.aoe ? 3.2 : 1, pr.color, 0.25); audio.play('explode', new THREE.Vector3(pr.x, pr.y, pr.z), 0.3);
        if (pr.aoe && pr.owner === 'player') { this.fx.eff.ring(pr.x, pr.z, 0.5, 5, pr.color, 0.4); for (const e of this.enemies) { if (e.dead || pr.hit.has(e)) continue; if (Math.hypot(e.pos.x - pr.x, e.pos.z - pr.z) < 4.5 + e.radius) { p.hitSet.delete(e); p.strike(e, { dmg: (pr.dmg / Math.max(1, p.stats.atk * p.dmgMult)) * 0.6, kb: 6, poise: 20 }, 1, 'skill'); } } }
        this.scene.remove(pr.m); this.projs.splice(i, 1);
      }
    }
  }
  updateWaves(dt: number) {
    const p = this.p;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.r += w.speed * dt; w.m.scale.setScalar(w.r); (w.m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - w.r / w.max * 0.6);
      const d = Math.hypot(p.pos.x - w.x, p.pos.z - w.z);
      if (!w.hit && Math.abs(d - w.r) < 1.1 && p.pos.y < 0.8 && p.state !== 'dead') { w.hit = true; this.p.hurt(w.dmg, new THREE.Vector3(w.x, 0, w.z), { knock: true, kb: 7, poise: 25, src: w.src }); }
      if (w.r >= w.max) { this.scene.remove(w.m); w.m.geometry.dispose(); (w.m.material as THREE.Material).dispose(); this.waves.splice(i, 1); }
    }
  }

  // ───────── camera ─────────
  updateCamera(dt: number) {
    const c = this.cam; const p = this.p; const grid = this.level.grid; const cam = this.camera;
    if (dt <= 0.00001) return;
    // lock-on soft framing (never overrides player mouse input)
    const lt = p.lock && !p.lock.dead ? p.lock : null;
    if (p.lock && p.lock.dead) p.lock = null;
    if (lt) {
      const dx = lt.pos.x - p.pos.x, dz = lt.pos.z - p.pos.z; const d = Math.hypot(dx, dz); if (d > 38) p.lock = null;
      const want = Math.atan2(-dx, -dz); const k = (1 - Math.exp(-3.2 * dt)) * (1 - Math.min(1, c.mouseAct)); c.yaw += ang(c.yaw, want) * k;
      c.pitch += (clamp(0.26 + d * 0.012, 0.2, 0.5) - c.pitch) * (1 - Math.exp(-2 * dt)) * (1 - Math.min(1, c.mouseAct));
    }
    c.mouseAct = Math.max(0, c.mouseAct - dt * 1.6);
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    let shoulder = 0.8; const sh = grid.ray(p.pos.x, p.pos.z, p.pos.x + rx * 1.1, p.pos.z + rz * 1.1, true); shoulder *= sh;
    const target = this.tmpV.set(p.pos.x + rx * shoulder, p.pos.y * 0.5 + 1.55, p.pos.z + rz * shoulder);
    if (lt) { target.x += (lt.pos.x - p.pos.x) * 0.14; target.z += (lt.pos.z - p.pos.z) * 0.14; }
    if (c.pivot.distanceToSquared(target) > 400) c.pivot.copy(target); c.pivot.lerp(target, 1 - Math.exp(-17 * dt));
    const dist = c.zoom * (lt ? 1.12 : 1) * (p.sprint ? 1.06 : 1); const cp = Math.cos(c.pitch); const dirH = { x: Math.sin(c.yaw), z: Math.cos(c.yaw) };
    const hl = dist * cp + 0.5; const t = grid.ray(c.pivot.x, c.pivot.z, c.pivot.x + dirH.x * hl, c.pivot.z + dirH.z * hl, true);
    const allowed = Math.max(1.0, (t * hl - 0.55) / Math.max(0.2, cp));
    if (allowed < c.cur) c.cur += (allowed - c.cur) * (1 - Math.exp(-22 * dt)); else c.cur += (Math.min(dist, allowed) - c.cur) * (1 - Math.exp(-2.4 * dt));
    let px = c.pivot.x + dirH.x * cp * c.cur, py = c.pivot.y + Math.sin(c.pitch) * c.cur, pz = c.pivot.z + dirH.z * cp * c.cur;
    py = clamp(py, 0.35, this.level.ceiling - 0.5); const look = new THREE.Vector3(c.pivot.x, c.pivot.y + 0.15 - Math.max(0, c.pitch - 0.4) * 0.3, c.pivot.z);
    let fov = 65 + (p.sprint ? 5 : 0) + (p.tfActive ? 3 : 0);
    // cinematic override with smooth in/out
    if (this.cine) {
      const f = this.cine.t / this.cine.dur; const w = this.smooth(Math.min(1, this.cine.t / 0.5)) * this.smooth(Math.min(1, (this.cine.dur - this.cine.t) / 0.6)); const s = this.cine.fn(f);
      px += (s.pos.x - px) * w; py += (s.pos.y - py) * w; pz += (s.pos.z - pz) * w; look.lerp(s.look, w); fov += ((s.fov ?? fov) - fov) * w;
    }
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-6 * dt)); cam.updateProjectionMatrix();
    c.shake = Math.max(0, c.shake - dt * 2.4); const sk = c.shake * c.shake * 0.35;
    cam.position.set(px + (Math.random() - 0.5) * sk, py + (Math.random() - 0.5) * sk, pz + (Math.random() - 0.5) * sk); cam.lookAt(look);
  }
  smooth(x: number) { return x * x * (3 - 2 * x); }

  // ───────── HUD sync ─────────
  syncHud() {
    const p = this.p; const st = useGame.getState(); const h = useHud.getState(); const sk = st.player.skills;
    const boss = this.enemies.find((e) => e.isBoss && e.state !== 'dormant' && (!e.dead || e.deadT < 2));
    let target: any = null; if (p.lock && !p.lock.dead) target = { name: p.lock.def.name, hp: p.lock.hp, max: p.lock.maxHp, level: p.lock.lvl, el: p.lock.def.el };
    const ob = this.objective(); const sc = p.stats;
    const cost = (id: string, r: number) => { const s: any = (id === 'burst' ? { cost: Math.max(8, 18 - 1.5 * r) } : id === 'rift' ? { cost: Math.max(10, 24 - 1.5 * r - (r >= 4 ? 3 : 0)) } : { cost: 60 - 3 * r }); return Math.round(s.cost); };
    h.set({ hp: p.hp, maxHp: sc.hp, en: p.en, maxEn: sc.en, tf: p.tf, tfActive: p.tfActive, tfTime: p.tfTime, tfMax: p.tfMax, tfName: ['Abyssal Awakening', 'Crimson Sovereign', 'Void Ascendant'][p.tfStage - 1],
      cd: { e: p.cds.e, r: p.cds.r, v: p.cds.v, eMax: p.cds.eMax, rMax: p.cds.rMax, vMax: p.cds.vMax }, costs: { e: cost('burst', sk.burst), r: cost('rift', sk.rift), v: cost('judgment', sk.judgment) },
      boss: boss ? { name: boss.def.name, title: boss.def.title || '', hp: Math.max(0, boss.hp), max: boss.maxHp, phase: boss.phase, stagger: boss.poise / boss.maxPoise, staggered: boss.vulnerable > 0 } : null, target,
      objective: ob.text, objDist: ob.dist, locked: !!p.lock, combo: p.comboShowT > 0 ? p.comboCount : 0, status: { ...p.status }, potions: { hp: st.mats.hp_potion || 0, en: st.mats.en_potion || 0, elixir: st.mats.elixir || 0 } });
  }
  objective(): { text: string; dist: number } {
    const st = useGame.getState(); const q = QUEST_BY_ID[st.tracked]; const qs = q && st.quests[q.id]; if (!q || !qs || qs.s !== 'active') return { text: 'Explore Aurelith — hunt monsters, forge gear, find secrets', dist: 0 };
    let idx = q.obj.findIndex((o, i) => { const pr = o.k === 'collect' ? (st.mats[o.t] || 0) : o.k === 'level' ? st.player.level : qs.p[i] || 0; return pr < o.n; }); if (idx < 0) idx = 0; const o = q.obj[idx];
    const pr = o.k === 'collect' ? (st.mats[o.t] || 0) : o.k === 'level' ? st.player.level : qs.p[idx] || 0; let pos: THREE.Vector3 | null = null;
    if (this.level.kind === 'world') {
      if (o.k === 'talk') pos = this.level.inters.find((i) => i.id === o.t)?.pos ?? null; else if (o.t === 'dummy') pos = new THREE.Vector3(-34, 0, 14);
      else if (o.k === 'boss') { const d = DUNGEONS.find((d) => d.boss === o.t); if (d) pos = new THREE.Vector3(d.wx, 0, d.wz); } else if (o.k === 'clear' && o.t !== '*') { const d = DUNGEONS.find((d) => d.id === o.t); if (d) pos = new THREE.Vector3(d.wx, 0, d.wz); }
    }
    return { text: `${q.title}: ${o.text} (${Math.min(pr, o.n)}/${o.n})`, dist: pos ? Math.round(pos.distanceTo(this.p.pos)) : 0 };
  }
}

export let game: Game | null = null;
export function createGame(el: HTMLElement) { if (!game) game = new Game(el); else if (game.renderer.domElement.parentElement !== el) el.appendChild(game.renderer.domElement); (window as any).__game = game; (window as any).__store = useGame; return game; }
export { makeChest };
