import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { AudioEngine } from './audio';
import { Terrain, Ocean, zoneAt } from './terrain';
import { City } from './city';
import { Fx, Debris, PAL } from './fx';
import type { Pal } from './fx';
import { Entities } from './entities';
import { Sky } from './sky';
import { Player } from './player';
import { Powers } from './powers';
import { Disasters } from './disasters';
import { GodWars } from './godwars';
import { ShadowDragon } from './dragon';
import { hud, ref } from './store';
import { POWERS, FORMS, FORM_MAP, WEATHERS, TELEPORT_DESTS } from './types';
import { readGameSave, writeGameSave } from './save';
import type { GameSave } from './save';
import { clamp, rand, lerp } from './noise';

const V = new THREE.Vector3(), V2 = new THREE.Vector3();

export class Input {
  keys = new Set<string>(); edge = new Set<string>();
  yaw = 0; pitch = -0.22; zoom = 0; camDist = 8; wheelAccum = 0; locked = false; sens = 1; rdown = false;
  down(c: string) { return this.keys.has(c); }
  pressed(c: string) { return this.edge.has(c); }
  forward(out: THREE.Vector3) { const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
}

export interface ExplodeOpts { force?: number; crater?: number; pal?: Pal; fire?: boolean; sound?: boolean; silent?: boolean; hurt?: boolean; lite?: boolean; big?: boolean }

export class Game {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  composer!: EffectComposer; bloom!: UnrealBloomPass;
  audio = new AudioEngine();
  terrain!: Terrain; ocean!: Ocean; city!: City; fx!: Fx; debris!: Debris; ents!: Entities; sky!: Sky; player!: Player; powers!: Powers; disasters!: Disasters; godWars!: GodWars; dragon!: ShadowDragon;
  hud = hud;
  input = new Input();
  aim = { point: new THREE.Vector3(), dist: 9999, hit: 'sky' as 'sky' | 'terrain' | 'building' | 'planet' | 'god' };
  clock = 0; timeScale = 1; reversing = false; shakeAmt = 0; portalCd = -10;
  undoLog: { t: number; fn: () => void }[] = [];
  minimap: HTMLCanvasElement | null = null;
  seaTarget = 0; seaHold = 0;
  last = 0; hudT = 0; fpsAcc = 0; fpsN = 0; fps = 60; perfT = 0; pixelRatio = 1; maxPR = 1.5;
  running = false; ready = false;
  get scatter() { return this.city.scatter; }

  constructor(public container: HTMLElement) {
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    this.maxPR = Math.min(window.devicePixelRatio || 1, 1.5); this.pixelRatio = this.maxPR;
    r.setPixelRatio(this.pixelRatio);
    r.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(r.domElement);
    r.domElement.style.display = 'block'; r.domElement.style.outline = 'none';
    this.renderer = r;
    this.camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.4, 70000);
    this.scene.add(this.camera);
  }

  // ---------------- init ----------------
  async init(progress: (msg: string, f: number) => void) {
    const yieldUI = () => new Promise<void>((res) => setTimeout(res, 20));
    ref.game = this;
    (window as any).godverse = this;
    progress('Sculpting the world…', 0.05); await yieldUI();
    this.ocean = new Ocean(this.scene, this.renderer);
    this.terrain = new Terrain(this.scene);
    this.minimap = this.terrain.minimap(256);
    progress('Painting the sky…', 0.2); await yieldUI();
    this.fx = new Fx(this); this.debris = new Debris(this);
    this.sky = new Sky(this);
    this.city = new City(this);
    progress('Raising cities and forests…', 0.35); await yieldUI();
    this.city.generate();
    progress('Populating civilization…', 0.65); await yieldUI();
    this.ents = new Entities(this);
    this.player = new Player(this);
    this.dragon = new ShadowDragon(this);
    this.godWars = new GodWars(this);
    this.powers = new Powers(this);
    this.disasters = new Disasters(this);
    this.ents.populate();
    progress('Awakening the gods…', 0.85); await yieldUI();
    // post
    const size = new THREE.Vector2(); this.renderer.getSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x * this.pixelRatio, size.y * this.pixelRatio, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.7, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.bindEvents();
    this.resize();
    // warm-up
    this.player.updateCamera(0.016);
    this.fx.setScale(this.renderer.domElement.height, this.camera.fov);
    this.renderer.compile(this.scene, this.camera);
    progress('Ready', 1);
    this.ready = true;
    hud.set({ ready: true });
    this.running = true; this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  // ---------------- events ----------------
  bindEvents() {
    const el = this.renderer.domElement;
    window.addEventListener('resize', () => this.resize());
    const lockChange = () => {
      this.input.locked = document.pointerLockElement === el;
      hud.set({ locked: this.input.locked });
      if (!this.input.locked && this.powers.down) this.powers.release();
    };
    document.addEventListener('pointerlockchange', lockChange);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('mousedown', (e) => {
      const s = hud.get(); if (!s.started || s.panelOpen) return;
      this.audio.init();
      if (s.wheelOpen) return;
      if (e.button === 2) { this.input.rdown = true; return; }
      if (!this.input.locked) this.lock();
      if (e.button === 0) this.powers.press();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 2) this.input.rdown = false; if (e.button === 0 && this.powers?.down) this.powers.release(); });
    window.addEventListener('mousemove', (e) => {
      const s = hud.get(); if (!s.started || s.panelOpen || s.wheelOpen) return;
      if (this.input.locked || this.input.rdown) {
        const k = 0.0022 * this.input.sens * (hud.get().sens);
        this.input.yaw -= e.movementX * k; this.input.pitch = clamp(this.input.pitch - e.movementY * k, -1.5, 1.5);
      }
    });
    window.addEventListener('wheel', (e) => {
      const s = hud.get(); if (!s.started || s.panelOpen || s.wheelOpen) return;
      if (this.powers.held.length) { this.input.wheelAccum += -e.deltaY; return; }
      if (e.ctrlKey || e.altKey) { this.input.zoom = clamp(this.input.zoom + e.deltaY * 0.01, -2, 12); return; }
      const available = POWERS.filter((p) => hud.get().unlockedPowers.includes(p.id));
      const i = available.findIndex((p) => p.id === this.powers.current);
      const n = (i + (e.deltaY > 0 ? 1 : -1) + available.length) % available.length;
      if (available[n]) this.powers.select(available[n].id);
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
      const s = hud.get(); if (!s.started) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ControlLeft'].includes(e.code) && !s.panelOpen) e.preventDefault();
      if (e.repeat) return;
      if (s.panelOpen && e.code !== 'Escape' && e.code !== 'KeyP') {
        const tag = (e.target as HTMLElement)?.tagName; if (tag) { /* let the UI handle keys inside the panel */ }
        return;
      }
      this.keyDown(e.code, e);
    });
    window.addEventListener('keyup', (e) => {
      this.input.keys.delete(e.code);
      if (e.code === 'KeyX' && hud.get().timeMode === 'reverse') this.setTimeMode('normal');
    });
    window.addEventListener('blur', () => this.input.keys.clear());
  }
  keyDown(code: string, e?: KeyboardEvent) {
    const s = hud.get();
    if (e && (e.ctrlKey || e.metaKey) && code !== 'ControlLeft') return;
    this.input.keys.add(code); this.input.edge.add(code);
    if (code === 'Tab' && !s.panelOpen) { this.setPanel(true); return; }
    if (code === 'KeyP') { this.setPanel(!s.panelOpen); return; }
    if (code === 'Escape') { if (s.panelOpen) this.setPanel(false); else if (s.wheelOpen) this.setWheel(false); return; }
    if (s.panelOpen) return;
    if (code === 'KeyQ') { this.setWheel(!s.wheelOpen); return; }
    if (s.wheelOpen) return;
    if (code.startsWith('Digit')) { const n = parseInt(code.slice(5)) - 1; if (n >= 0 && n < FORMS.length) this.setForm(FORMS[n].id); return; }
    switch (code) {
      case 'KeyF': this.player.setFlying(!this.player.flying); break;
      case 'KeyZ': this.setTimeMode(s.timeMode === 'freeze' ? 'normal' : 'freeze'); break;
      case 'KeyX': this.setTimeMode('reverse'); break;
      case 'KeyT': this.powers.use('teleport'); break;
      case 'KeyH': hud.set({ helpOpen: !s.helpOpen }); break;
      case 'KeyR': this.player.speedLevel = (this.player.speedLevel + 1) % 4; hud.set({ speedLevel: this.player.speedLevel }); this.toast(['Normal speed', 'Super speed', 'Light speed', 'Cosmic speed'][this.player.speedLevel], '#ffe24d'); break;
      case 'KeyG': this.dragon?.dismiss(); break;
    }
  }
  lock() { try { const p: any = this.renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => { /* ignore */ }); } catch { /* unsupported */ } }
  unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ignore */ } }
  setPanel(open: boolean) {
    hud.set({ panelOpen: open, wheelOpen: false });
    if (open) { this.unlock(); if (this.powers.down) this.powers.release(); } else if (hud.get().started) this.lock();
    this.audio.play('tick');
  }
  setWheel(open: boolean) {
    hud.set({ wheelOpen: open });
    if (open) { this.unlock(); if (this.powers.down) this.powers.release(); this.audio.play('whoosh', -1, 0.3); } else this.lock();
  }
  start() {
    this.audio.init(); hud.set({ started: true }); this.lock();
    this.toast('Your divine war begins. Challenge a rival god to claim their region and powers.', '#ffd24d');
  }
  saveState() {
    const state = hud.get();
    const save: GameSave = {
      version: 1,
      savedAt: new Date().toISOString(),
      player: {
        position: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
        yaw: this.input.yaw,
        pitch: this.input.pitch,
        form: this.player.form.id,
        flying: this.player.flying,
        speedLevel: this.player.speedLevel,
        hp: this.player.hp,
        invulnerable: this.player.invulnerable,
      },
      powers: [...state.unlockedPowers],
      selectedPower: this.powers.current,
      ownedRegions: [...state.ownedRegions],
      selectedGod: state.selectedGod,
      warStatus: state.warStatus,
      warChoice: state.warChoice,
      warGodHp: state.warGodHp,
      warGodMaxHp: state.warGodMaxHp,
      previousInvulnerable: this.godWars.savedPreviousInvulnerability,
      hour: this.sky.hour,
      weather: this.sky.weather,
      seaLevel: this.ocean.level,
    };
    writeGameSave(save);
    this.toast('Game saved. Your powers, regions, and location are ready to continue.', '#85ffc0');
  }
  continueFromSave() {
    const save = readGameSave();
    if (!save) throw new Error('No saved game was found.');

    hud.set({
      unlockedPowers: save.powers,
      ownedRegions: save.ownedRegions,
      selectedGod: save.selectedGod,
      warActive: false,
      warStatus: save.warStatus,
      warChoice: save.warChoice,
      warGodHp: save.warGodHp,
      warGodMaxHp: save.warGodMaxHp,
    });
    this.player.pos.set(...save.player.position);
    this.player.vel.set(0, 0, 0);
    this.player.hp = save.player.hp;
    this.player.invulnerable = save.player.invulnerable;
    this.player.flying = save.player.flying;
    this.player.speedLevel = save.player.speedLevel;
    this.player.applyForm(save.player.form, true);
    this.input.yaw = save.player.yaw;
    this.input.pitch = save.player.pitch;
    this.sky.setHour(save.hour);
    this.setWeather(save.weather);
    this.ocean.setLevel(save.seaLevel);
    this.powers.select(save.selectedPower);

    if (save.warStatus === 'active' || save.warStatus === 'victory') {
      this.godWars.restoreChallenge(
        save.selectedGod,
        save.warGodHp,
        save.warStatus,
        save.previousInvulnerable,
      );
    }
    hud.set({ form: save.player.form, speedLevel: save.player.speedLevel, started: true });
    this.audio.init();
    this.unlock();
    this.toast('Your saved reign has been restored.', '#85ffc0');
  }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.pixelRatio); this.composer.setSize(w, h); this.bloom.resolution.set(w / 2, h / 2); }
    if (this.fx) this.fx.setScale(h * this.pixelRatio, this.camera.fov);
  }

  // ---------------- helpers used by systems ----------------
  gravity(y: number) { return y > 1800 ? 0 : y > 1000 ? 30 * (1 - (y - 1000) / 800) : 30; }
  shake(a: number) { this.shakeAmt = Math.max(this.shakeAmt, Math.min(2, a)); }
  toast(text: string, color = '#ffffff') {
    const id = Math.random();
    hud.set({ toasts: [...hud.get().toasts.slice(-3), { id, text, color }] });
    setTimeout(() => hud.set({ toasts: hud.get().toasts.filter((t) => t.id !== id) }), 3400);
  }
  logUndo(fn: () => void) {
    if (this.reversing) return;
    this.undoLog.push({ t: this.clock, fn });
    if (this.undoLog.length > 6000) this.undoLog.splice(0, 1000);
  }
  villagesAdded(c: THREE.Vector3) { this.city.villages.push({ x: c.x, z: c.z }); }
  setWeather(w: string) {
    this.sky.setWeather(w); hud.set({ weather: w });
    if (w === 'clear') this.sky.intensity = Math.min(this.sky.intensity, 1.2);
  }
  setForm(id: string) {
    if (!FORM_MAP[id] || this.player.form.id === id) return;
    this.player.applyForm(id);
    const f = FORM_MAP[id];
    hud.set({ form: id, flash: hud.get().flash + 1 });
    const c = this.player.center(V.clone());
    this.fx.shockwave(c, 30, this.player.palette.a, 1.0, true, true); this.fx.shockwave(c, 55, this.player.palette.b, 1.4, true, false);
    this.fx.flash(c, this.player.palette.b, 25, 120); this.audio.play('transform'); this.shake(0.35);
    this.toast(`Transformed: ${f.name}`, f.color);
  }
  setTimeMode(mode: 'normal' | 'freeze' | 'reverse' | 'fast') {
    const prev = hud.get().timeMode; if (prev === mode) return;
    this.reversing = mode === 'reverse';
    this.timeScale = mode === 'freeze' ? 0 : mode === 'fast' ? 6 : 1;
    hud.set({ timeMode: mode, timeScale: this.timeScale });
    if (mode === 'freeze') { this.audio.play('freeze'); this.toast('TIME FROZEN', '#7de8ff'); }
    else if (mode === 'reverse') { this.audio.play('rewind'); this.toast('TIME REVERSED', '#ffb86b'); this.ents.rewindAcc = 0; }
    else if (mode === 'fast') { this.audio.play('whoosh'); this.toast('Time accelerated ×6', '#ffd86b'); }
    else if (prev === 'freeze') this.toast('Time resumes', '#7de8ff');
  }
  setTimeScale(v: number) {
    if (hud.get().timeMode === 'freeze' || this.reversing) this.setTimeMode('normal');
    this.timeScale = v; hud.set({ timeScale: v, timeMode: v > 1.5 ? 'fast' : 'normal' });
  }
  teleportTo(p: THREE.Vector3) {
    const old = this.player.center(V2.clone());
    this.fx.shockwave(old, 14, this.player.palette.a, 0.5, true, true);
    for (let i = 0; i < 30; i++) this.fx.add.emit(old.x, old.y + rand(-1, 1), old.z, rand(-6, 6), rand(-2, 8), rand(-6, 6), 0.7, 1, 0.1, this.player.palette.a, this.player.palette.b, 1, 0, 1);
    this.player.pos.copy(p); this.player.vel.set(0, 0, 0);
    const h = this.terrain.heightAt(p.x, p.z);
    if (p.y < 1500 && this.player.pos.y < h + 1) this.player.pos.y = h + 2;
    const nw = this.player.center(V.clone());
    this.fx.shockwave(nw, 14, this.player.palette.b, 0.5, true, true);
    this.fx.flash(nw, this.player.palette.b, 10, 60); this.audio.play('teleport'); this.shake(0.15);
  }
  teleportDest(id: string) {
    const d = TELEPORT_DESTS.find((x) => x.id === id); if (!d) return;
    this.teleportTo(V.set(d.x, d.y, d.z));
    if (d.y > 1500) this.player.flying = true;
    this.toast(`Arrived: ${d.name}`, '#6bffd8');
  }

  explode(p: THREE.Vector3, R: number, o: ExplodeOpts = {}) {
    const pl = this.player, force = o.force ?? R * 2, pal = o.pal ?? PAL.fire;
    const dist = this.camera.position.distanceTo(p);
    if (o.lite) { const old = this.fx.shocks.length; this.fx.explosion(p, R * 0.8, pal, false); while (this.fx.shocks.length > old) { const s = this.fx.shocks.pop()!; this.scene.remove(s.mesh); s.mat.dispose(); } }
    else this.fx.explosion(p, R, pal);
    this.city.damageSphere(p, R * 0.85, force * 0.6, R > 60);
    this.scatter.damageSphere(p, R * 1.05, !!o.fire);
    this.ents.blast(p, R, force, R * 4);
    this.debris.blast(p, R * 1.2, force * 0.5);
    const gh = this.terrain.heightAt(p.x, p.z);
    const crater = o.crater ?? 0;
    if (crater > 0 && p.y - gh < R * 0.9 && p.y < 1500) this.terrain.crater(p.x, p.z, Math.max(3, R * 0.7 * crater), R * 0.3 * crater, true);
    if (o.fire && p.y - gh < R) this.fx.fire(V2.set(p.x, gh + 0.5, p.z), Math.max(1.4, R * 0.12), 10 + R * 0.3);
    if (R > 8) this.ents.alert(p, R * 6, 'panic');
    if (!o.silent) this.audio.play(R > 28 ? 'boom' : 'smallboom', dist, o.big ? 1.2 : 1);
    if (o.hurt !== false && !pl.invulnerable) { const d = pl.pos.distanceTo(p); if (d < R * 1.3) pl.hurt((1 - d / (R * 1.3)) * 70); }
    this.shake(clamp((R / (dist + 30)) * 0.8, 0, 1.4));
  }
  strike(p: THREE.Vector3, big: boolean) {
    const from = V.set(p.x + rand(-25, 25), p.y + 280, p.z + rand(-25, 25)).clone();
    this.fx.bolt(from, p, 0xbfe0ff, big ? 0.55 : 0.4, 0.32, 3);
    this.fx.flash(V2.set(p.x, p.y + 15, p.z), 0xcfe0ff, 50, 600);
    this.sky.flash(big ? 0.55 : 0.85);
    const R = big ? 11 : 7;
    this.explode(p.clone(), R, { force: 55, crater: 0.35, pal: PAL.lightning, fire: true, lite: true, silent: true, hurt: false });
    this.ents.forEach(p, 14, (e) => { this.ents.damage(e, 250, p); if (e.kind !== 'vehicle') this.ents.ignite(e, 4); });
    const d = this.camera.position.distanceTo(p);
    this.audio.play('zap', d, 1);
    setTimeout(() => this.audio.play('thunder', d, 1), Math.min(2500, d * 2.5));
    this.shake(clamp(120 / (d + 50), 0, 0.6));
  }
  runDisaster(kind: string) {
    const A = this.aim, P = this.player, D = this.disasters;
    const pt = (A.hit === 'sky' ? V.copy(P.pos).addScaledVector(this.input.forward(V2).setY(0).normalize(), 120).setY(this.terrain.heightAt(P.pos.x, P.pos.z)) : V.copy(A.point)).clone();
    const fwd = this.input.forward(V2).setY(0).normalize().clone();
    switch (kind) {
      case 'apocalypse': D.apocalypse(pt); break;
      case 'earthquake': D.quake(pt, 520, 14); break;
      case 'tornadoes': for (let i = 0; i < 5; i++) D.tornado(V.set(pt.x + rand(-200, 200), 0, pt.z + rand(-200, 200)), 32, 55); break;
      case 'meteors': D.meteors(pt, 45, 420, 3, 10); break;
      case 'tsunami': D.tsunami(V.copy(P.pos).addScaledVector(fwd, 800), fwd.clone().negate(), 1000, 75); break;
      case 'volcano': D.volcano(pt); break;
      case 'blackholes': { const p = pt.clone(); p.y += 70; D.blackhole(p); break; }
      case 'rupture': D.rupture(P.pos.clone()); break;
      case 'flood': this.flood(); break;
    }
    this.toast(`Disaster unleashed: ${kind}`, '#ff3d6a');
  }
  flood() { this.seaTarget = hud.get().seaLevel + 42; this.seaHold = 40; this.audio.play('rumble'); this.audio.play('splash'); }

  regenerate() {
    this.powers.clear(); this.disasters.clear(); this.fx.clear(); this.debris.clear();
    this.terrain.regenerate(); this.city.regenerate(); this.sky.restorePlanets();
    this.ents.clearAll(); this.ents.populate();
    this.undoLog.length = 0; this.sky.apocalypse = 0; this.sky.intensity = 1; this.seaTarget = 0; this.seaHold = 0; this.ocean.setLevel(0);
    hud.set({ seaLevel: 0, weatherIntensity: 1 });
    this.setTimeMode('normal'); this.setWeather('clear');
    this.toast('The world has been regenerated', '#7dffd0'); this.audio.play('chime');
    this.fx.shockwave(this.player.center(V.clone()), 120, 0x7dffd0, 1.5, true, true);
  }
  killAllDisasters() { this.disasters.clear(); this.fx.clear(); this.toast('Disasters dispelled', '#7dffd0'); }

  // ---------------- aim ----------------
  computeAim() {
    const o = this.camera.position, d = this.input.forward(V.clone());
    const A = this.aim;
    const planet = this.sky.space > 0.05 || o.y > 600 ? this.sky.rayPlanet(o, d) : null;
    let t = 3, prev = 3, found = false, hit: 'terrain' | 'building' = 'terrain';
    const T = this.terrain, city = this.city, lvl = this.ocean.level;
    const skip = d.y > 0.02 && o.y > 360;
    const maxT = planet ? Math.min(planet.dist, 3500) : 3500;
    const p = V2;
    if (!skip) {
      while (t < maxT) {
        p.copy(o).addScaledVector(d, t);
        if (p.y > 360 && d.y > 0) break;
        if (p.y < 3000) {
          const h = Math.max(T.heightAt(p.x, p.z), lvl);
          if (p.y < h) { found = true; hit = 'terrain'; break; }
          if (p.y < 700 && city.pointInside(p.x, p.y, p.z, 0)) { found = true; hit = 'building'; break; }
        }
        prev = t; t += Math.max(1.5, t * 0.02);
      }
    }
    if (found) {
      let lo = prev, hi = t;
      for (let i = 0; i < 6; i++) {
        const m = (lo + hi) / 2; p.copy(o).addScaledVector(d, m);
        const inside = p.y < Math.max(T.heightAt(p.x, p.z), lvl) || (p.y < 700 && city.pointInside(p.x, p.y, p.z, 0));
        if (inside) hi = m; else lo = m;
      }
      A.dist = lo; A.point.copy(o).addScaledVector(d, lo); A.hit = hit;
    } else if (planet) { A.dist = planet.dist; A.point.copy(o).addScaledVector(d, planet.dist); A.hit = 'planet'; }
    else { A.dist = 9999; A.point.copy(o).addScaledVector(d, 300); A.hit = 'sky'; }
    const rivalDist = this.godWars.rayHit(o, d);
    if (rivalDist !== null && rivalDist < A.dist) {
      A.dist = rivalDist;
      A.point.copy(o).addScaledVector(d, rivalDist);
      A.hit = 'god';
    }
  }

  // ---------------- main loop ----------------
  loop = (now: number) => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const rdt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (rdt <= 0) return;
    this.fpsAcc += rdt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; this.adaptPerf(); }
    const s = hud.get();
    const slow = s.wheelOpen ? 0.12 : 1;
    const scale = (this.reversing ? 1 : this.timeScale) * slow;
    const sdt = rdt * scale;
    // player + camera (real time)
    const inputEnabled = s.started;
    if (!s.started) this.input.yaw += rdt * 0.06;
    if (inputEnabled) this.player.update(rdt);
    if (this.dragon) this.dragon.update(rdt);
    this.player.updateCamera(rdt);
    this.camera.updateMatrixWorld();
    this.godWars.update(rdt);
    this.computeAim();
    this.powers.update(rdt, rdt);
    this.shakeAmt = Math.max(0, this.shakeAmt - rdt * 1.6);
    // sea level
    if (this.seaHold > 0) { this.seaHold -= rdt; if (this.seaHold <= 0) this.seaTarget = s.seaLevel; }
    else this.seaTarget = s.seaLevel;
    const lv = this.ocean.level + clamp(this.seaTarget - this.ocean.level, -4 * rdt, 5 * rdt);
    this.ocean.setLevel(lv);
    // world
    if (this.reversing) {
      this.ents.update(0, rdt);
      const ft = this.ents.history.length ? this.ents.history[this.ents.history.length - 1].t : this.clock;
      while (this.undoLog.length && this.undoLog[this.undoLog.length - 1].t > ft) this.undoLog.pop()!.fn();
      this.clock = Math.min(this.clock, ft);
      this.debris.update(rdt, true);
      this.terrain.update(rdt * 6, 1.5);
      this.sky.hour = (this.sky.hour - rdt * this.sky.daySpeed * 3 + 24) % 24;
      this.fx.update(rdt * 0.3, rdt);
      this.sky.update(0, rdt, this.camera.position, this.player.pos);
      this.disasters.update(0, rdt);
      this.city.update(0);
    } else {
      const n = Math.min(8, Math.max(1, Math.ceil(sdt / 0.033)));
      for (let i = 0; i < n; i++) {
        const dt = sdt / n; this.clock += dt;
        this.ents.update(dt, rdt);
        this.disasters.update(dt, rdt);
        this.debris.update(dt, false);
      }
      if (sdt === 0) { this.disasters.update(0, rdt); }
      this.sky.update(sdt, rdt, this.camera.position, this.player.pos);
      this.city.update(sdt);
      this.terrain.update(sdt, s.recovery ? 0.006 : 0);
      this.fx.update(sdt, rdt);
    }
    this.ocean.update(this.clock);
    // underwater / audio
    const under = this.camera.position.y < this.ocean.level;
    this.sky.underwater = under;
    this.audio.setWind(clamp(this.player.speed / 400, 0, 1) * (this.sky.space > 0.5 ? 0.2 : 1), under);
    // mortal regen
    if (!this.player.invulnerable && this.player.hp < 100) this.player.hp = Math.min(100, this.player.hp + rdt * 3);
    // render
    this.fx.setScale(this.renderer.domElement.height, this.camera.fov);
    const space = this.sky.space;
    this.ocean.mesh.visible = space < 0.85; this.ocean.floor.visible = space < 0.85;
    this.bloom.strength = (0.45 + this.sky.flashI * 0.5 + (1 - this.sky.dayF) * 0.2) * (s.bloom ? 1 : 0);
    this.renderer.shadowMap.enabled = s.shadows; this.sky.sun.castShadow = s.shadows;
    if (s.bloom) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.input.edge.clear();
    // hud sync
    this.hudT -= rdt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.syncHud(under); }
  };

  adaptPerf() {
    this.perfT += 0.5;
    if (this.perfT < 3) return;
    this.perfT = 0;
    let pr = this.pixelRatio;
    if (this.fps < 38 && pr > 0.6) pr -= 0.1; else if (this.fps > 58 && pr < this.maxPR) pr += 0.05;
    if (Math.abs(pr - this.pixelRatio) > 0.01) { this.pixelRatio = pr; this.resize(); }
  }

  syncHud(under: boolean) {
    const P = this.player, s = hud.get();
    const sp = P.speed;
    hud.set({
      flying: P.flying, speed: Math.round(sp), alt: Math.round(P.pos.y - Math.max(0, this.terrain.heightAt(P.pos.x, P.pos.z))),
      x: Math.round(P.pos.x), y: Math.round(P.pos.y), z: Math.round(P.pos.z), hour: this.sky.hour, zone: P.pos.y > 1500 ? 'Outer Space' : zoneAt(P.pos.x, P.pos.z),
      fps: Math.round(this.fps), invuln: P.invulnerable, hp: Math.round(P.hp), underwater: under, space: Math.round(this.sky.space * 100) / 100,
      npc: this.ents.stats.npc, veh: this.ents.stats.veh, animals: this.ents.stats.animals, buildings: this.city.aliveCount(), speedLevel: P.speedLevel,
      weather: this.sky.weather, power: this.powers.current, form: P.form.id, locked: this.input.locked,
    });
    void s; void WEATHERS; void lerp;
  }
}
