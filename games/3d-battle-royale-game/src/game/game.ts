import * as THREE from 'three';
import {
  WEAPONS, MODES, DIFFS, BOT_NAMES, SHIRTS, RARITY_COLORS,
  type ModeDef, type Difficulty, type WeaponId, type WeaponDef, type VehicleType, type AmmoType,
} from './data';
import { Actor, Vehicle, type Loot, type Phase } from './actor';
import { World, rayCyl } from './world';
import { FX } from './fx';
import { makeHuman, setHumanWeapon, makePlane, makeVehicle, weaponModel, bx, basic, makeLootBox, mat } from './models';
import { sfx, setEngine } from './audio';
import { updateBot, initBot } from './bots';

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export interface Hud {
  alive: number; total: number; kills: number; score: number;
  hp: number; armor: number; phase: Phase;
  weapon: string; wid: WeaponId; mag: number; reserve: number; isGun: boolean;
  slots: { id: WeaponId | null; active: boolean }[];
  gren: number; bomb: number; medkits: number; heal: number; reload: number;
  zoneLabel: string; zoneTime: number; zoneKind: 'wait' | 'shrink' | 'final'; inZone: boolean;
  prompt: string | null; speed: number; vehicle: string | null; vehHp: number; alt: number;
  scoped: boolean; hint: string | null; touchAct: boolean;
}
export interface Result {
  win: boolean; place: number; total: number; kills: number; dmg: number; time: number; score: number; mode: string; hs: number;
}
export interface UI {
  onHud(h: Hud): void;
  onFeed(text: string, kind: string): void;
  onToast(t: string, sub: string, kind: string): void;
  onState(s: GameState): void;
  onOver(r: Result): void;
  onHit(kill: boolean, head: boolean): void;
  onHurt(zone: boolean): void;
  onPick(text: string, color: number): void;
}

interface Zone {
  cx: number; cz: number; r: number;
  fx: number; fz: number; fr: number;
  tx: number; tz: number; tr: number;
  phase: number; stage: 'wait' | 'shrink' | 'final'; t: number; dur: number; dps: number;
}
interface Plane { dx: number; dz: number; sx: number; sz: number; len: number; p: number; speed: number; alt: number; x: number; z: number; mesh: THREE.Group }
interface Proj { x: number; y: number; z: number; vx: number; vy: number; vz: number; fuse: number; owner: Actor; type: 'grenade' | 'bomb'; mesh: THREE.Mesh; trail: number }

const SPHERE = new THREE.SphereGeometry(1, 12, 9);
const RING = new THREE.RingGeometry(0.55, 0.8, 24).rotateX(-Math.PI / 2);
const BEAM = new THREE.CylinderGeometry(0.25, 0.25, 40, 8, 1, true).translate(0, 20, 0);
const AMMO_COL: Record<AmmoType, number> = { light: 0xfacc15, rifle: 0xfb923c, shell: 0xef4444 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Game {
  canvas: HTMLCanvasElement;
  minimap: HTMLCanvasElement;
  overlay: HTMLElement;
  ui: UI;
  isTouch: boolean;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  fx: FX;
  sky!: THREE.Mesh;
  worldGroup = new THREE.Group();
  actorGroup = new THREE.Group();
  world!: World;
  mode: ModeDef = MODES[0];
  diff: Difficulty = 'normal';
  botSkill = 0.8;
  playerName = 'YOU';
  state: GameState = 'menu';
  actors: Actor[] = [];
  vehicles: Vehicle[] = [];
  loot: Loot[] = [];
  projs: Proj[] = [];
  player!: Actor;
  plane: Plane | null = null;
  zone!: Zone;
  zoneMesh: THREE.Mesh | null = null;
  zoneTex: THREE.CanvasTexture | null = null;
  time = 0;
  endAt = 0;
  finished = false;
  airdropAt = 0;
  airdrops: { x: number; z: number }[] = [];
  lootId = 0;
  hs = 0;

  keys = new Set<string>();
  input = { fire: false, ads: false, jump: false, brake: false, sprint: false, mx: 0, my: 0, lookX: 0, lookY: 0 };
  prevFire = false;
  locked = false;
  noLock = false;
  lastLook = 0;

  camYaw = 0;
  camPitch = 0;
  camDist = 4;
  shake = 0;
  fov = 72;
  slow = 0;
  lastKillT = -10;
  streak = 0;
  hudT = 0;
  mapT = 0;
  cleanT = 0;
  raf = 0;
  lastT = 0;
  perfAcc = 0;
  perfN = 0;
  pr = 1;
  maxPr = 1;
  camTmp = new THREE.Vector3();
  camDir = new THREE.Vector3();
  playerJumpAt = 0.42;
  lastKillInfo = '';
  dmgTaken = 0;

  constructor(canvas: HTMLCanvasElement, minimap: HTMLCanvasElement, overlay: HTMLElement, ui: UI, isTouch: boolean) {
    this.canvas = canvas;
    this.minimap = minimap;
    this.overlay = overlay;
    this.ui = ui;
    this.isTouch = isTouch;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
    this.maxPr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
    this.pr = this.maxPr;
    this.renderer.setPixelRatio(this.pr);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.3, 800);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(0xb9d6f0, 110, 470);
    this.scene.background = new THREE.Color(0xb9d6f0);
    this.scene.add(new THREE.HemisphereLight(0xe3efff, 0x5b7a45, 1.0));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.5);
    sun.position.set(0.6, 1, 0.35);
    this.scene.add(sun);
    this.scene.add(this.worldGroup, this.actorGroup);
    this.buildSky();
    this.fx = new FX(this.scene);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    this.buildWorld(MODES[0], false);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onCtx);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    setEngine(false);
    this.renderer.dispose();
  }

  /* ------------------------------------------------ setup ------------------------------------------------ */
  buildSky() {
    const geo = new THREE.SphereGeometry(700, 20, 12);
    const cols: number[] = [];
    const top = new THREE.Color(0x3b82c4), mid = new THREE.Color(0xb9d6f0), bot = new THREE.Color(0xd9e8f2);
    const p = geo.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 700;
      if (y > 0) c.copy(mid).lerp(top, Math.pow(y, 0.6));
      else c.copy(mid).lerp(bot, Math.min(1, -y * 3));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    // clouds
    const n = 60;
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false }), n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const cx = rnd(-450, 450), cz = rnd(-450, 450), cy = rnd(240, 330);
      const s = rnd(25, 60);
      d.position.set(cx, cy, cz);
      d.scale.set(s, rnd(4, 8), s * rnd(0.5, 0.9));
      d.rotation.y = rnd(0, 3);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    }
    inst.frustumCulled = false;
    this.scene.add(inst);
  }

  resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  buildWorld(mode: ModeDef, populate: boolean) {
    this.mode = mode;
    this.scene.remove(this.worldGroup, this.actorGroup);
    this.worldGroup.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData.own) m.geometry.dispose();
    });
    this.worldGroup = new THREE.Group();
    this.actorGroup = new THREE.Group();
    this.scene.add(this.worldGroup, this.actorGroup);
    this.world = new World(mode.half, mode.towns, Math.floor(Math.random() * 1e9));
    this.worldGroup.add(this.world.group);
    this.fx.clear();
    this.actors = [];
    this.vehicles = [];
    this.loot = [];
    this.projs = [];
    this.plane = null;
    this.zoneMesh = null;
    this.airdrops = [];
    if (!populate) {
      this.spawnVehicles(mode, true);
      return;
    }
    this.spawnVehicles(mode, false);
    this.spawnLoot(mode);
    this.spawnZone(mode);
    this.spawnActors(mode);
  }

  spawnVehicles(mode: ModeDef, decor: boolean) {
    const types: VehicleType[] = ['car', 'bike', 'truck'];
    const colors = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xf97316, 0xa855f7, 0xe5e7eb];
    const w = this.world;
    for (const t of types) {
      const n = decor ? 1 : mode.vehicles[t];
      for (let i = 0; i < n; i++) {
        const model = makeVehicle(t, colors[Math.floor(Math.random() * colors.length)]);
        const v = new Vehicle(t, model);
        // prefer near roads/towns
        let tries = 0;
        do {
          if (Math.random() < 0.7 && w.towns.length) {
            const tw = w.towns[Math.floor(Math.random() * w.towns.length)];
            const a = Math.random() * 6.28;
            const r = tw.r + rnd(4, 22);
            v.x = tw.x + Math.cos(a) * r;
            v.z = tw.z + Math.sin(a) * r;
          } else {
            v.x = rnd(-mode.half + 25, mode.half - 25);
            v.z = rnd(-mode.half + 25, mode.half - 25);
          }
          tries++;
        } while (w.buildingAt(v.x, v.z, 5) >= 0 && tries < 20);
        const p = { x: v.x, z: v.z };
        w.resolve(p, v.def.r + 1);
        v.x = p.x;
        v.z = p.z;
        v.yaw = Math.random() * 6.28;
        model.group.position.set(v.x, 0, v.z);
        model.group.rotation.y = v.yaw;
        this.worldGroup.add(model.group);
        this.vehicles.push(v);
      }
    }
  }

  spawnZone(mode: ModeDef) {
    const geo = new THREE.CylinderGeometry(1, 1, 140, 72, 1, true);
    const cv = document.createElement('canvas');
    cv.width = 8;
    cv.height = 64;
    const c = cv.getContext('2d')!;
    const g = c.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(56,189,248,0.0)');
    g.addColorStop(0.5, 'rgba(56,189,248,0.55)');
    g.addColorStop(1, 'rgba(56,189,248,0.0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 8, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(60, 3);
    this.zoneTex = tex;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, color: 0x7dd3fc }));
    m.userData.own = true;
    m.frustumCulled = false;
    m.position.y = 70;
    this.worldGroup.add(m);
    this.zoneMesh = m;
    this.zone = { cx: rnd(-20, 20), cz: rnd(-20, 20), r: mode.startR, fx: 0, fz: 0, fr: 0, tx: 0, tz: 0, tr: 0, phase: 0, stage: 'wait', t: 0, dur: 0, dps: 0 };
    this.startPhase(0);
  }

  startPhase(i: number) {
    const z = this.zone;
    const ph = this.mode.phases[i];
    z.phase = i;
    z.fx = z.cx; z.fz = z.cz; z.fr = z.r;
    z.tr = ph.radius;
    const maxOff = Math.max(0, z.r - ph.radius) * 0.85;
    const a = Math.random() * 6.28;
    const dd = Math.sqrt(Math.random()) * maxOff;
    const lim = this.mode.half - ph.radius * 0.4;
    z.tx = clamp(z.cx + Math.cos(a) * dd, -lim, lim);
    z.tz = clamp(z.cz + Math.sin(a) * dd, -lim, lim);
    z.stage = 'wait';
    z.t = 0;
    z.dur = ph.wait;
    z.dps = ph.dps;
    if (i === 1) this.airdropAt = this.time + 6;
    if (i > 0) this.ui.onToast('SAFE ZONE SET', `Next shrink in ${ph.wait}s`, 'info');
  }

  addLoot(kind: Loot['kind'], x: number, z: number, opts: { wid?: WeaponId; ammo?: AmmoType; amount?: number; rarity?: number; b?: number } = {}) {
    let rarity = opts.rarity ?? 0;
    if (kind === 'weapon' && opts.wid) rarity = opts.rarity ?? WEAPONS[opts.wid].rarity;
    if (kind === 'bomb') rarity = 3;
    if (kind === 'shield') rarity = 2;
    const l: Loot = { id: this.lootId++, kind, wid: opts.wid, ammo: opts.ammo, amount: opts.amount ?? 1, x, z, rarity, b: opts.b ?? -1, mesh: new THREE.Group(), taken: false, phase: Math.random() * 6 };
    const col = RARITY_COLORS[rarity];
    const ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.position.y = 0.08;
    ring.scale.setScalar(1.3);
    l.mesh.add(ring);
    const item = new THREE.Group();
    item.position.y = 0.95;
    if (kind === 'weapon' && opts.wid) {
      const w = weaponModel(opts.wid);
      w.scale.setScalar(1.5);
      w.rotation.y = Math.PI / 2;
      item.add(w);
    } else if (kind === 'ammo') {
      item.add(bx(0.45, 0.3, 0.65, AMMO_COL[opts.ammo ?? 'light']), bx(0.47, 0.06, 0.2, 0x111827, 0, 0.1, 0));
    } else if (kind === 'medkit') {
      item.add(bx(0.65, 0.42, 0.5, 0xffffff), bx(0.4, 0.44, 0.12, 0xef4444), bx(0.12, 0.44, 0.4, 0xef4444));
    } else if (kind === 'shield') {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshLambertMaterial({ color: 0x38bdf8, emissive: 0x0b4a6f }));
      m.scale.y = 1.2;
      item.add(m);
    } else if (kind === 'grenade') {
      const m = new THREE.Mesh(SPHERE, mat(0x4d7c0f));
      m.scale.setScalar(0.24);
      item.add(m, bx(0.1, 0.12, 0.1, 0x9ca3af, 0, 0.26, 0));
    } else {
      const m = new THREE.Mesh(SPHERE, mat(0x111418));
      m.scale.setScalar(0.4);
      item.add(m, bx(0.1, 0.16, 0.1, 0xef4444, 0, 0.42, 0), bx(0.82, 0.08, 0.82, 0xef4444));
    }
    l.mesh.add(item);
    l.mesh.userData.item = item;
    if (rarity >= 3) {
      const beam = new THREE.Mesh(BEAM, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      l.mesh.add(beam);
    }
    l.mesh.position.set(x, 0, z);
    this.worldGroup.add(l.mesh);
    this.loot.push(l);
    return l;
  }

  spawnLoot(mode: ModeDef) {
    const spots = this.world.spots.slice().sort(() => Math.random() - 0.5);
    const table: { w: number; f: (x: number, z: number, b: number) => void }[] = [];
    const wp = (id: WeaponId, w: number) => {
      if (mode.meleeOnly && WEAPONS[id].kind === 'gun') return;
      table.push({ w, f: (x, z, b) => this.addLoot('weapon', x, z, { wid: id, b }) });
    };
    const am = (t: AmmoType, w: number) => {
      if (mode.meleeOnly) return;
      table.push({ w, f: (x, z, b) => this.addLoot('ammo', x, z, { ammo: t, amount: t === 'light' ? 30 : t === 'rifle' ? 24 : 8, b }) });
    };
    wp('pistol', 4); wp('smg', 6); wp('shotgun', 5); wp('ar', 5.5); wp('sniper', 1.8);
    wp('axe', mode.meleeOnly ? 14 : 3);
    wp('knife', 0);
    am('light', 8); am('rifle', 6); am('shell', 4);
    table.push({ w: 9, f: (x, z, b) => this.addLoot('medkit', x, z, { b }) });
    table.push({ w: 6, f: (x, z, b) => this.addLoot('shield', x, z, { b }) });
    table.push({ w: mode.meleeOnly ? 12 : 6, f: (x, z, b) => this.addLoot('grenade', x, z, { b }) });
    table.push({ w: mode.meleeOnly ? 6 : 1.5, f: (x, z, b) => this.addLoot('bomb', x, z, { b }) });
    const total = table.reduce((s, t) => s + t.w, 0);
    const n = Math.min(mode.loot, spots.length);
    for (let i = 0; i < n; i++) {
      const s = spots[i];
      let r = Math.random() * total;
      for (const t of table) {
        r -= t.w;
        if (r <= 0) { t.f(s.x, s.z, s.b); break; }
      }
    }
  }

  spawnActors(mode: ModeDef) {
    const diff = DIFFS[this.diff];
    this.botSkill = diff.acc;
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const total = mode.players;
    // plane
    const ang = Math.random() * 6.28;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const len = mode.half * 2 * 1.15;
    const off = rnd(-mode.half * 0.2, mode.half * 0.2);
    const mesh = makePlane();
    mesh.scale.setScalar(0.9);
    this.worldGroup.add(mesh);
    this.plane = { dx, dz, sx: -dx * len / 2 - dz * off, sz: -dz * len / 2 + dx * off, len, p: 0.06, speed: 62, alt: 165, x: 0, z: 0, mesh };
    mesh.rotation.y = Math.atan2(-dx, -dz);
    for (let i = 0; i < total; i++) {
      const isP = i === 0;
      const color = isP ? 0xf59e0b : SHIRTS[i % SHIRTS.length];
      const a = new Actor(i, isP ? this.playerName : names[i % names.length], isP, makeHuman(color), color);
      a.yaw = Math.atan2(-dx, -dz);
      a.y = this.plane.alt;
      if (isP) {
        a.guns[0] = { id: 'pistol', mag: 12 };
        a.ammo.light = 36;
        a.slot = 1;
        this.player = a;
        this.camYaw = a.yaw;
        this.camPitch = -0.15;
      } else {
        if (!mode.meleeOnly && Math.random() < 0.3) a.guns[0] = { id: 'pistol', mag: 12 };
        initBot(this, a, rnd(0.1, 0.92));
      }
      this.syncWeapon(a);
      this.actorGroup.add(a.human.root);
      this.actors.push(a);
    }
    this.updatePlane(0);
  }

  /* ------------------------------------------------ match flow ------------------------------------------------ */
  lastCfg: { mode: string; diff: Difficulty; name: string } = { mode: 'classic', diff: 'normal', name: 'YOU' };

  startMatch(modeId: string, diff: Difficulty, name: string) {
    const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];
    this.lastCfg = { mode: modeId, diff, name };
    this.diff = diff;
    this.playerName = name || 'YOU';
    this.time = 0;
    this.endAt = 0;
    this.finished = false;
    this.streak = 0;
    this.hs = 0;
    this.slow = 0;
    this.shake = 0;
    this.dmgTaken = 0;
    this.input.fire = false;
    this.input.ads = false;
    this.keys.clear();
    setEngine(false);
    this.buildWorld(mode, true);
    this.state = 'playing';
    this.ui.onState('playing');
    this.ui.onToast('DROP IN!', 'Press SPACE to jump from the plane', 'info');
    this.requestLock();
  }

  restart() {
    this.startMatch(this.lastCfg.mode, this.lastCfg.diff, this.lastCfg.name);
  }

  toMenu() {
    setEngine(false);
    this.exitLock();
    this.buildWorld(MODES[0], false);
    this.state = 'menu';
    this.ui.onState('menu');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.fire = false;
    this.input.ads = false;
    this.keys.clear();
    setEngine(false);
    this.exitLock();
    this.ui.onState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.lastT = performance.now();
    this.ui.onState('playing');
    this.requestLock();
  }

  requestLock() {
    if (this.isTouch || this.noLock) return;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => { /* handled by pointerlockerror */ });
    } catch {
      this.lockErrors++;
      if (this.lockErrors >= 2) this.noLock = true;
    }
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  finish(win: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.state = 'over';
    const p = this.player;
    this.input.fire = false;
    setEngine(false);
    this.exitLock();
    const place = win ? 1 : p.place || this.mode.players;
    let score = this.liveScore() + Math.max(0, this.mode.players - place + 1) * 20;
    if (win) score += 1000;
    const res: Result = { win, place, total: this.mode.players, kills: p.kills, dmg: Math.round(p.dmg), time: Math.round(this.time), score: Math.round(score), mode: this.mode.name, hs: this.hs };
    sfx(win ? 'win' : 'lose');
    this.ui.onState('over');
    this.ui.onOver(res);
  }

  liveScore() {
    const p = this.player;
    return p.kills * 150 + this.hs * 50 + Math.floor(p.dmg * 0.5);
  }

  aliveCount() {
    let n = 0;
    for (const a of this.actors) if (a.alive) n++;
    return n;
  }

  /* ------------------------------------------------ input ------------------------------------------------ */
  onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) {
      if (this.state === 'playing' && /^(Space|Arrow|Key[WASD])/.test(e.code)) e.preventDefault();
      return;
    }
    if (this.state === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) { this.resume(); return; }
    if (this.state === 'over' && (e.code === 'Enter' || e.code === 'KeyR')) { this.restart(); return; }
    if (this.state !== 'playing') return;
    if (/^(Space|Arrow)/.test(e.code)) e.preventDefault();
    this.keys.add(e.code);
    switch (e.code) {
      case 'KeyP': this.pause(); break;
      case 'Space': this.input.jump = true; break;
      case 'Digit1': this.selectSlot(0); break;
      case 'Digit2': this.selectSlot(1); break;
      case 'Digit3': this.selectSlot(2); break;
      case 'KeyQ': this.cycleWeapon(1); break;
      case 'KeyR': this.startReload(this.player); break;
      case 'KeyE': case 'KeyF': this.interact(); break;
      case 'KeyG': this.throwPlayer('grenade'); break;
      case 'KeyB': this.throwPlayer('bomb'); break;
      case 'KeyH': this.useMedkit(); break;
    }
  };
  onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  onMouseDown = (e: MouseEvent) => {
    if (this.state !== 'playing' || this.isTouch) return;
    if ((e.target as HTMLElement)?.closest('button, input, a')) return;
    if (!this.locked && !this.noLock) {
      this.requestLock();
      return;
    }
    if (e.button === 0) this.input.fire = true;
    if (e.button === 2) this.input.ads = true;
  };
  onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.input.fire = false;
    if (e.button === 2) this.input.ads = false;
  };
  onMouseMove = (e: MouseEvent) => {
    if (this.state !== 'playing' || this.isTouch) return;
    if (this.locked || this.noLock) {
      this.input.lookX += e.movementX;
      this.input.lookY += e.movementY;
    }
  };
  onWheel = (e: WheelEvent) => {
    if (this.state === 'playing') this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
  };
  onCtx = (e: Event) => {
    if (this.state === 'playing') e.preventDefault();
  };
  onBlur = () => {
    if (this.state === 'playing') this.pause();
  };
  lockErrors = 0;
  onLockChange = () => {
    const was = this.locked;
    this.locked = document.pointerLockElement === this.canvas;
    if (this.locked) this.lockErrors = 0;
    if (was && !this.locked && this.state === 'playing') this.pause();
  };
  onLockError = () => {
    this.lockErrors++;
    if (this.lockErrors >= 3) this.noLock = true;
  };

  moveInput() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    x += this.input.mx;
    y += this.input.my;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y, l: Math.min(1, l) };
  }

  /* ------------------------------------------------ player actions ------------------------------------------------ */
  selectSlot(i: number) {
    const p = this.player;
    if (!p.alive || p.phase === 'vehicle') return;
    if (i > 0 && !p.guns[i - 1]) return;
    if (p.slot === i) return;
    p.slot = i;
    p.reload = 0;
    p.cd = Math.max(p.cd, 0.2);
    this.syncWeapon(p);
    sfx('ui', 0.8);
  }
  cycleWeapon(dir: number) {
    const p = this.player;
    for (let k = 1; k <= 3; k++) {
      const n = (p.slot + dir * k + 6) % 3;
      if (n === 0 || p.guns[n - 1]) { this.selectSlot(n); return; }
    }
  }
  syncWeapon(a: Actor) {
    setHumanWeapon(a.human, a.weaponId);
  }
  startReload(a: Actor) {
    const g = a.gun;
    if (!g || a.reload > 0 || !a.alive) return;
    const def = WEAPONS[g.id];
    if (g.mag >= def.mag) return;
    if (a.isPlayer && a.ammo[def.ammo!] <= 0) return;
    a.reload = def.reload;
    if (a.isPlayer) sfx('reload');
  }
  finishReload(a: Actor) {
    const g = a.gun;
    if (!g) return;
    const def = WEAPONS[g.id];
    if (!a.isPlayer) { g.mag = def.mag; return; }
    const t = def.ammo!;
    const take = Math.min(def.mag - g.mag, a.ammo[t]);
    g.mag += take;
    a.ammo[t] -= take;
  }

  interact() {
    const p = this.player;
    if (!p.alive) return;
    if (p.vehicle) { this.exitVehicle(p); return; }
    if (p.phase !== 'ground') return;
    const v = this.nearVehicle(p);
    if (v) { this.enterVehicle(p, v); return; }
    const l = this.nearSwap(p);
    if (l && l.wid) this.swapWeapon(p, l);
  }
  nearVehicle(p: Actor): Vehicle | null {
    let best: Vehicle | null = null, bd = 1e9;
    for (const v of this.vehicles) {
      if (v.wreck || v.driver) continue;
      const d = Math.hypot(v.x - p.x, v.z - p.z) - v.def.r;
      if (d < 3.2 && d < bd) { bd = d; best = v; }
    }
    return best;
  }
  nearSwap(p: Actor): Loot | null {
    if (p.guns[0] && p.guns[1] === null) return null;
    let best: Loot | null = null, bd = 1e9;
    for (const l of this.loot) {
      if (l.taken || l.kind !== 'weapon' || !l.wid) continue;
      const def = WEAPONS[l.wid];
      if (def.kind === 'melee' && WEAPONS[p.melee].tier >= def.tier) continue;
      if (def.kind === 'gun' && (!p.guns[0] || !p.guns[1])) continue;
      const d = Math.hypot(l.x - p.x, l.z - p.z);
      if (d < 3 && d < bd) { bd = d; best = l; }
    }
    return best;
  }
  swapWeapon(p: Actor, l: Loot) {
    const def = WEAPONS[l.wid!];
    if (def.kind === 'melee') {
      this.addLoot('weapon', p.x + 0.6, p.z + 0.6, { wid: p.melee });
      p.melee = def.id;
    } else {
      const idx = p.slot > 0 ? p.slot - 1 : 0;
      const old = p.guns[idx]!;
      this.addLoot('weapon', p.x + 0.8, p.z + 0.4, { wid: old.id });
      p.guns[idx] = { id: def.id, mag: def.mag };
      p.ammo[def.ammo!] += def.mag;
      if (p.slot === 0) p.slot = idx + 1;
    }
    this.takeLoot(l, def.name, true);
    this.syncWeapon(p);
  }

  useMedkit() {
    const p = this.player;
    if (!p.alive || p.medkits <= 0 || p.healT > 0 || p.hp >= 100 || p.phase === 'vehicle') return;
    p.healT = 1.6;
    sfx('heal', 0.7);
  }

  throwPlayer(type: 'grenade' | 'bomb') {
    const p = this.player;
    if (!p.alive || p.phase !== 'ground') return;
    if ((type === 'grenade' ? p.gren : p.bomb) <= 0) return;
    const d = this.camDir;
    const dir = new THREE.Vector3(d.x, d.y + 0.3, d.z).normalize();
    this.throwThrowable(p, type, dir.x, dir.y, dir.z, type === 'bomb' ? 17 : 23);
  }

  throwThrowable(a: Actor, type: 'grenade' | 'bomb', dx: number, dy: number, dz: number, speed: number) {
    if (type === 'grenade') { if (a.gren <= 0) return; a.gren--; } else { if (a.bomb <= 0) return; a.bomb--; }
    const m = new THREE.Mesh(SPHERE, type === 'bomb' ? basic(0x15171b) : basic(0x5b8c1a));
    m.scale.setScalar(type === 'bomb' ? 0.36 : 0.22);
    this.worldGroup.add(m);
    a.swing = 1;
    this.projs.push({ x: a.x - Math.sin(a.yaw) * 0.5, y: a.y + 1.6, z: a.z - Math.cos(a.yaw) * 0.5, vx: dx * speed, vy: dy * speed, vz: dz * speed, fuse: type === 'bomb' ? 3.2 : 2.3, owner: a, type, mesh: m, trail: 0 });
    const d = Math.hypot(a.x - this.player.x, a.z - this.player.z);
    sfx('throw', clamp(1 - d / 80, 0, 1));
  }

  /* ------------------------------------------------ vehicles ------------------------------------------------ */
  enterVehicle(a: Actor, v: Vehicle) {
    a.vehicle = v;
    v.driver = a;
    a.phase = 'vehicle';
    a.vx = a.vz = 0;
    a.healT = 0;
    this.ui.onToast(v.def.name.toUpperCase(), 'W/S throttle · A/D steer · SPACE handbrake · E exit', 'info');
    sfx('enter');
  }
  exitVehicle(a: Actor) {
    const v = a.vehicle;
    if (!v) return;
    a.vehicle = null;
    v.driver = null;
    a.phase = 'ground';
    const lx = -Math.cos(v.yaw), lz = Math.sin(v.yaw);
    const p = { x: v.x + lx * (v.def.r + 1.2), z: v.z + lz * (v.def.r + 1.2) };
    this.world.resolve(p, 0.6);
    a.x = p.x; a.z = p.z; a.y = 0;
    a.vx = Math.sin(v.yaw) * -v.speed * 0.4;
    a.vz = Math.cos(v.yaw) * -v.speed * 0.4;
    if (a.isPlayer) setEngine(false);
  }
  hurtVehicle(v: Vehicle, dmg: number, src: Actor | null) {
    if (v.wreck) return;
    v.hp -= dmg;
    if (v.hp <= 0) this.explodeVehicle(v, src);
  }
  explodeVehicle(v: Vehicle, src: Actor | null) {
    v.wreck = true;
    const d = v.driver;
    if (d) {
      this.exitVehicle(d);
      this.damageActor(d, 70, src ?? d, false, 'Explosion');
    }
    this.explode(v.x, 1, v.z, 11, 85, src, true);
    v.model.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = mat(0x1a1c20);
    });
    v.speed = 0;
  }

  updateVehicles(dt: number) {
    const p = this.player;
    for (const v of this.vehicles) {
      const def = v.def;
      const drv = v.driver;
      let thr = 0, st = 0, brake = false;
      if (drv && drv.isPlayer && !v.wreck) {
        const m = this.moveInput();
        thr = m.y; st = m.x;
        brake = this.keys.has('Space') || this.input.brake;
      }
      if (v.wreck) {
        v.speed *= 1 - Math.min(1, 3 * dt);
        v.smoke -= dt;
        if (v.smoke <= 0) {
          v.smoke = 0.07;
          this.fx.emit(v.x + rnd(-1, 1), 1.5, v.z + rnd(-1, 1), rnd(-1, 1), rnd(4, 8), rnd(-1, 1), 1.1, rnd(0.5, 1.2), Math.random() < 0.5 ? 0xff7a1a : 0x2a2a2a, -2);
        }
      } else if (Math.abs(v.speed) > 0.05 || drv || thr !== 0) {
        const target = thr > 0 ? def.max * thr : thr < 0 ? def.max * 0.35 * thr : 0;
        if (thr !== 0) v.speed += clamp(target - v.speed, -def.acc * 1.8 * dt, def.acc * dt);
        else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (drv ? 6 : 14) * dt);
        if (brake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 40 * dt);
        v.steer += (st - v.steer) * Math.min(1, 9 * dt);
        const sp = v.speed;
        const grip = Math.min(1, Math.abs(sp) / 7);
        const yr = v.steer * def.turn * grip * (1 - 0.45 * Math.min(1, Math.abs(sp) / def.max)) * (sp >= 0 ? 1 : -1) * (brake ? 1.7 : 1);
        v.yaw -= yr * dt;
        v.skid = brake && Math.abs(sp) > 8 ? 1 : 0;
        v.x += -Math.sin(v.yaw) * sp * dt;
        v.z += -Math.cos(v.yaw) * sp * dt;
        const pp = { x: v.x, z: v.z };
        if (this.world.resolve(pp, def.r)) {
          const imp = Math.abs(sp);
          v.x = pp.x; v.z = pp.z;
          if (imp > 6) {
            this.hurtVehicle(v, (imp - 4) * (v.type === 'truck' ? 0.7 : 1.3), drv);
            v.speed = -sp * 0.25;
            this.fx.burst(v.x - Math.sin(v.yaw) * sp * 0.08, 1, v.z - Math.cos(v.yaw) * sp * 0.08, 10, 8, 0.5, 0.18, 0xffd27a, 18, 0.5);
            const dd = Math.hypot(v.x - p.x, v.z - p.z);
            sfx('crash', clamp(1 - dd / 70, 0, 1));
            if (drv === p) this.shake = Math.min(1, this.shake + imp / 45);
          } else v.speed *= 0.7;
        }
        // run over people
        if (Math.abs(v.speed) > 7 && drv) {
          for (const e of this.actors) {
            if (!e.alive || e === drv || e.phase === 'vehicle' || e.phase === 'plane' || e.ramCd > 0) continue;
            if (e.phase !== 'ground' && e.y > 2) continue;
            const d = Math.hypot(e.x - v.x, e.z - v.z);
            if (d < def.r + 0.6) {
              e.ramCd = 0.5;
              const dmg = Math.abs(v.speed) * 2.4 * def.ram;
              const nx = (e.x - v.x) / (d || 1), nz = (e.z - v.z) / (d || 1);
              e.x += nx * 1.5; e.z += nz * 1.5;
              this.fx.burst(e.x, 1, e.z, 14, 7, 0.6, 0.16, 0xb91c1c, 16, 0.6);
              this.damageActor(e, dmg, drv, false, def.name);
              if (drv === p) { this.shake = Math.min(1, this.shake + 0.4); sfx('crash', 0.8); }
              v.speed *= 0.88;
            }
          }
        }
        // fx
        if (Math.abs(sp) > 9 && Math.random() < 0.6 * dt * 30 * (Math.abs(sp) / def.max)) {
          const bz = v.type === 'truck' ? 2.5 : 1.6;
          const cx = v.x + Math.sin(v.yaw) * bz, cz = v.z + Math.cos(v.yaw) * bz;
          this.fx.emit(cx + rnd(-0.6, 0.6), 0.2, cz + rnd(-0.6, 0.6), rnd(-1, 1), rnd(1, 3), rnd(-1, 1), 0.6, rnd(0.3, 0.6), v.skid ? 0xdddddd : 0x9a8a6a, -1);
        }
        if (v.hp < def.hp * 0.35) {
          v.smoke -= dt;
          if (v.smoke <= 0) {
            v.smoke = 0.08;
            this.fx.emit(v.x - Math.sin(v.yaw) * -1.5, 1.4, v.z - Math.cos(v.yaw) * -1.5, rnd(-0.5, 0.5), rnd(2, 4), rnd(-0.5, 0.5), 1.0, rnd(0.4, 0.9), 0x333333, -1);
          }
        }
        if (drv && drv.isPlayer) setEngine(true, Math.min(1, Math.abs(v.speed) / def.max), v.type);
      }
      // visuals
      const m = v.model;
      m.group.position.set(v.x, 0, v.z);
      m.group.rotation.y = v.yaw;
      const grip = Math.min(1, Math.abs(v.speed) / 12);
      const leanTarget = v.type === 'bike' ? -v.steer * grip * 0.45 : -v.steer * grip * 0.05;
      v.lean += (leanTarget - v.lean) * Math.min(1, 8 * dt);
      m.tilt.rotation.z = v.lean;
      const wr = v.type === 'truck' ? 0.68 : v.type === 'bike' ? 0.42 : 0.46;
      for (const w of m.wheels) w.rotation.x -= (v.speed * dt) / wr;
      for (const s of m.steer) s.rotation.y = -v.steer * 0.45;
      if (drv) {
        drv.x = v.x; drv.z = v.z; drv.y = 0;
        drv.yaw = v.yaw;
      }
    }
    if (!(p.vehicle && p.alive)) setEngine(false);
  }

  /* ------------------------------------------------ combat ------------------------------------------------ */
  traceBullet(a: Actor, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number) {
    let best = range;
    let kind: 'none' | 'static' | 'ground' | 'actor' | 'veh' = 'none';
    let actor: Actor | null = null;
    let veh: Vehicle | null = null;
    let head = false;
    const ts = this.world.ray(ox, oy, oz, dx, dy, dz, range);
    if (ts < best) { best = ts; kind = 'static'; }
    if (dy < -1e-6) {
      const tg = -oy / dy;
      if (tg > 0 && tg < best) { best = tg; kind = 'ground'; }
    }
    for (const e of this.actors) {
      if (e === a || !e.alive || e.phase === 'plane' || e.phase === 'vehicle') continue;
      const t = rayCyl(ox, oy, oz, dx, dy, dz, e.x, e.z, 0.5, e.y, e.y + 1.95, best);
      if (t < best) { best = t; kind = 'actor'; actor = e; head = oy + dy * t > e.y + 1.55; }
    }
    for (const v of this.vehicles) {
      if (v.wreck) continue;
      const t = rayCyl(ox, oy, oz, dx, dy, dz, v.x, v.z, v.def.r * 0.9, 0, 2.4, best);
      if (t < best) { best = t; kind = 'veh'; veh = v; actor = null; }
    }
    return { t: best, kind, actor, veh, head };
  }

  fireGun(a: Actor, def: WeaponDef, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, mx: number, my: number, mz: number, spreadMul: number) {
    const p = this.player;
    const dist = Math.hypot(a.x - p.x, a.z - p.z);
    this.fx.flash(mx, my, mz, 0.1, 0.38, 0.055, 0xffd27a, 0.95);
    this.fx.burst(mx, my, mz, 3, 5, 0.2, 0.07, 0xffc857, 0, 0.2);
    sfx(def.id, clamp(1 - dist / 130, 0, 1) * (a.isPlayer ? 1 : 0.8));
    const dmgMul = a.isPlayer ? 1 : 0.72;
    const sp = def.spread * spreadMul;
    for (let i = 0; i < def.pellets; i++) {
      let sx = dx + (Math.random() - 0.5) * 2 * sp;
      let sy = dy + (Math.random() - 0.5) * 2 * sp;
      let sz = dz + (Math.random() - 0.5) * 2 * sp;
      const l = Math.hypot(sx, sy, sz);
      sx /= l; sy /= l; sz /= l;
      const h = this.traceBullet(a, ox, oy, oz, sx, sy, sz, def.range);
      const ex = ox + sx * h.t, ey = oy + sy * h.t, ez = oz + sz * h.t;
      if (h.kind !== 'none' || def.range < 200) this.fx.tracer(mx, my, mz, ex, ey, ez, def.tracer, def.id === 'sniper' ? 0.1 : 0.045);
      else this.fx.tracer(mx, my, mz, ox + sx * 150, oy + sy * 150, oz + sz * 150, def.tracer, 0.045);
      if (h.kind === 'static') {
        this.fx.burst(ex, ey, ez, 4, 5, 0.35, 0.09, 0xc9ced6, 14, 0.4);
        this.fx.burst(ex, ey, ez, 2, 3, 0.2, 0.06, 0xffd27a, 0, 0.3);
      } else if (h.kind === 'ground') {
        this.fx.burst(ex, ey, ez, 4, 4, 0.4, 0.12, 0x8b6b44, 14, 0.5);
      } else if (h.kind === 'actor' && h.actor) {
        const falloff = 1 - 0.4 * (h.t / def.range);
        const dmg = def.dmg * falloff * (h.head ? 1.8 : 1) * dmgMul;
        if (a.isPlayer && h.head) this.hs++;
        this.damageActor(h.actor, dmg, a, h.head, def.name, ex, ey, ez);
      } else if (h.kind === 'veh' && h.veh) {
        this.fx.burst(ex, ey, ez, 5, 6, 0.35, 0.09, 0xffd27a, 10, 0.4);
        this.hurtVehicle(h.veh, def.dmg * 0.55 * dmgMul, a);
        if (h.veh.driver && h.veh.driver !== a) this.damageActor(h.veh.driver, def.dmg * 0.3 * dmgMul, a, false, def.name);
        if (a.isPlayer) this.ui.onHit(false, false);
      }
    }
  }

  playerShoot() {
    const p = this.player;
    const g = p.gun!;
    const def = WEAPONS[g.id];
    g.mag--;
    p.cd = def.rate;
    const d = this.camDir;
    const cam = this.camera.position;
    const ox = cam.x + d.x * (this.camDist + 0.4), oy = cam.y + d.y * (this.camDist + 0.4), oz = cam.z + d.z * (this.camDist + 0.4);
    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const mx = p.x + rx * 0.35 + fx * (def.len + 0.3), my = p.y + 1.4 + d.y * def.len, mz = p.z + rz * 0.35 + fz * (def.len + 0.3);
    let sm = 1;
    const mv = Math.hypot(p.vx, p.vz);
    if (mv > 6) sm = 1.7; else if (mv > 1) sm = 1.2;
    if (!p.onGround) sm *= 1.8;
    if (this.input.ads) sm *= 0.45;
    this.fireGun(p, def, ox, oy, oz, d.x, d.y, d.z, mx, my, mz, sm);
    p.recoil = 1;
    this.camPitch += def.recoil * (this.input.ads ? 0.6 : 1) * rnd(0.7, 1.2);
    this.camYaw += (Math.random() - 0.5) * def.recoil * 0.7;
    this.shake = Math.min(1, this.shake + def.recoil * 3.2 + 0.03);
    this.fov += def.id === 'sniper' ? 0 : 1.2;
    if (g.mag <= 0) this.startReload(p);
  }

  botShoot(b: Actor, tx: number, ty: number, tz: number, skill: number) {
    const g = b.gun;
    if (!g || b.cd > 0 || b.reload > 0) return;
    const def = WEAPONS[g.id];
    if (g.mag <= 0) { b.reload = def.reload; return; }
    g.mag--;
    b.cd = def.rate * (1.5 + (1 - Math.min(1, skill)) * 0.9) * (def.auto ? 1 : 1.2);
    const ox = b.x, oy = b.y + 1.5, oz = b.z;
    let dx = tx - ox, dy = ty - oy, dz = tz - oz;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    const err = (0.03 * (1.4 - Math.min(1.2, skill)) + l * 0.0008) ;
    dx += (Math.random() - 0.5) * 2 * err;
    dy += (Math.random() - 0.5) * 2 * err;
    dz += (Math.random() - 0.5) * 2 * err;
    const l2 = Math.hypot(dx, dy, dz);
    dx /= l2; dy /= l2; dz /= l2;
    const mx = ox + dx * (def.len + 0.3), my = oy - 0.15 + dy * def.len, mz = oz + dz * (def.len + 0.3);
    b.recoil = 1;
    this.fireGun(b, def, ox, oy, oz, dx, dy, dz, mx, my, mz, 1);
  }

  meleeAttack(a: Actor) {
    const def = WEAPONS[a.weaponId];
    a.swing = 1;
    a.cd = def.rate * (a.isPlayer ? 1 : 1.25);
    const d0 = Math.hypot(a.x - this.player.x, a.z - this.player.z);
    sfx('swing', clamp(1 - d0 / 50, 0, 1));
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    let hit = false;
    const wide = def.id === 'axe';
    let bestE: Actor | null = null, bd = 1e9;
    for (const e of this.actors) {
      if (e === a || !e.alive || e.phase === 'plane' || e.phase === 'vehicle') continue;
      const dx = e.x - a.x, dz = e.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > def.range + 0.5) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < (wide ? -0.15 : 0.35)) continue;
      if (wide) {
        hit = true;
        this.meleeHit(a, e, def, fx, fz);
      } else if (d < bd) { bd = d; bestE = e; }
    }
    if (bestE) { hit = true; this.meleeHit(a, bestE, def, fx, fz); }
    if (hit) {
      sfx('stab', clamp(1 - d0 / 50, 0, 1));
      if (a.isPlayer) this.shake = Math.min(1, this.shake + 0.3);
    }
  }
  meleeHit(a: Actor, e: Actor, def: WeaponDef, fx: number, fz: number) {
    e.x += fx * 0.5;
    e.z += fz * 0.5;
    this.fx.burst(e.x, e.y + 1.2, e.z, 8, 5, 0.5, 0.12, 0xc4162a, 16, 0.5);
    this.damageActor(e, def.dmg * (a.isPlayer ? 1 : 0.8), a, false, def.name, e.x, e.y + 1.2, e.z);
  }

  damageActor(t: Actor, dmg: number, src: Actor | null, head = false, wp = '', px = t.x, py = t.y + 1.2, pz = t.z) {
    if (!t.alive || t.phase === 'plane') return;
    let d = dmg;
    if (t.armor > 0) {
      const ab = Math.min(t.armor, d * 0.55);
      t.armor -= ab;
      d -= ab;
    }
    t.hp -= d;
    t.squash = 1;
    this.fx.burst(px, py, pz, head ? 8 : 4, 4, 0.5, 0.11, 0xc4162a, 16, 0.4);
    if (src && src.isPlayer && t !== src) {
      src.dmg += Math.min(dmg, Math.max(0, t.hp + d));
      this.showDmg(px, py + 0.3, pz, Math.round(dmg), head, t.hp <= 0);
      if (t.hp > 0) {
        this.ui.onHit(false, head);
        sfx(head ? 'head' : 'hit');
      }
    }
    if (t.isPlayer) {
      t.healT = 0;
      this.shake = Math.min(1, this.shake + 0.25 + dmg / 120);
      this.dmgTaken += d;
      this.ui.onHurt(false);
      sfx('hurt');
    } else if (t.ai && src && src !== t) {
      const ai = t.ai;
      if (!ai.target || !ai.target.alive || Math.random() < 0.5) {
        ai.target = src;
        ai.react = 0.25 + Math.random() * 0.3;
      }
      t.healT = 0;
    }
    if (t.hp <= 0) this.killActor(t, src, wp, head);
  }

  killActor(t: Actor, src: Actor | null, wp: string, head: boolean) {
    if (!t.alive) return;
    t.place = this.aliveCount();
    t.alive = false;
    t.hp = 0;
    if (t.vehicle) this.exitVehicle(t);
    const p = this.player;
    if (src && src !== t) src.kills++;
    this.fx.burst(t.x, t.y + 1, t.z, 20, 7, 0.8, 0.15, 0xc4162a, 16, 0.6);
    // drop loot
    const gx = t.x, gz = t.z;
    t.guns.forEach((g, i) => {
      if (g) this.addLoot('weapon', gx + rnd(-1.4, 1.4), gz + rnd(-1.4, 1.4), { wid: g.id });
      t.guns[i] = null;
    });
    if (t.melee !== 'knife') this.addLoot('weapon', gx + rnd(-1, 1), gz + rnd(-1, 1), { wid: t.melee });
    if (!this.mode.meleeOnly && (t.ammo.light > 0 || !t.isPlayer)) this.addLoot('ammo', gx + rnd(-1, 1), gz + rnd(-1, 1), { ammo: (['light', 'rifle', 'shell'] as AmmoType[])[Math.floor(Math.random() * 3)], amount: 24 });
    if (t.medkits > 0 || Math.random() < 0.35) this.addLoot('medkit', gx + rnd(-1, 1), gz + rnd(-1, 1));
    for (let i = 0; i < Math.min(2, t.gren); i++) this.addLoot('grenade', gx + rnd(-1, 1), gz + rnd(-1, 1));
    if (t.armor > 20) this.addLoot('shield', gx + rnd(-1, 1), gz + rnd(-1, 1));
    // feed
    const who = src && src !== t ? src.name : 'The Storm';
    const kind = src === p ? 'mine' : t === p ? 'dead' : 'norm';
    this.ui.onFeed(`${who}|${src && src !== t ? wp || 'Weapon' : 'Zone'}|${t.name}`, kind);
    if (src === p && t !== p) {
      this.slow = 0.14;
      this.shake = Math.min(1, this.shake + 0.3);
      sfx('kill');
      this.ui.onHit(true, head);
      this.streak = this.time - this.lastKillT < 7 ? this.streak + 1 : 1;
      this.lastKillT = this.time;
      const names = ['', 'ELIMINATED', 'DOUBLE KILL!', 'TRIPLE KILL!!', 'QUAD KILL!!!', 'RAMPAGE!!!!'];
      this.ui.onToast(names[Math.min(5, this.streak)], `${t.name} · +${head ? 200 : 150}`, 'kill');
    }
    if (t === p) {
      this.endAt = this.time + 2.2;
      this.shake = 1;
      setEngine(false);
      this.ui.onToast('YOU DIED', src && src !== t ? `Eliminated by ${src.name}` : 'The storm got you', 'dead');
      this.input.fire = false;
    }
    const left = this.aliveCount();
    if (left <= 1 && !this.endAt) {
      if (p.alive) { this.endAt = this.time + 2; this.ui.onToast('WINNER WINNER!', 'Last one standing', 'win'); }
    }
  }

  showDmg(x: number, y: number, z: number, dmg: number, head: boolean, kill: boolean) {
    const v = this.camTmp.set(x, y, z).project(this.camera);
    if (v.z > 1 || v.z < -1) return;
    const el = document.createElement('div');
    el.className = 'dmgnum' + (head ? ' head' : '') + (kill ? ' kill' : '');
    el.textContent = String(dmg);
    el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth + rnd(-14, 14)}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    this.overlay.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  explode(x: number, y: number, z: number, radius: number, dmg: number, owner: Actor | null, big: boolean) {
    const p = this.player;
    const fx = this.fx;
    fx.flash(x, y + 0.5, z, 0.5, radius * 0.75, 0.28, 0xffb347, 0.95);
    fx.flash(x, y + 0.5, z, 0.3, radius * 1.05, 0.45, 0xffffff, 0.35);
    fx.burst(x, y + 0.5, z, 26 + radius * 2, radius * 1.8, 0.8, 0.45, 0xff7a1a, 6, 0.7);
    fx.burst(x, y + 0.5, z, 16 + radius, radius * 1.2, 0.6, 0.55, 0xffd166, 3, 0.9);
    fx.burst(x, y + 0.5, z, 18, radius * 1.1, 1.6, 0.9, 0x2d2d33, -2, 1.1);
    fx.burst(x, y + 0.3, z, 14, radius * 1.6, 1.0, 0.18, 0x6b5a3a, 18, 0.5);
    const dp = Math.hypot(x - p.x, z - p.z);
    this.shake = Math.min(1, this.shake + clamp(1 - dp / (big ? 70 : 50), 0, 1) * (big ? 1.2 : 0.9));
    sfx('boom', clamp(1.1 - dp / 150, 0.05, 1));
    for (const e of this.actors) {
      if (!e.alive || e.phase === 'plane') continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d > radius) continue;
      const k = 1 - d / radius;
      const nx = (e.x - x) / (d || 1), nz = (e.z - z) / (d || 1);
      e.x += nx * k * 2.5;
      e.z += nz * k * 2.5;
      this.damageActor(e, dmg * (0.2 + 0.8 * k), owner ?? e, false, big ? 'Bomb' : 'Grenade', e.x, e.y + 1.2, e.z);
    }
    for (const v of this.vehicles) {
      if (v.wreck) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d > radius + v.def.r) continue;
      v.speed += (Math.random() - 0.5) * 6;
      this.hurtVehicle(v, dmg * (1 - d / (radius + v.def.r)) * 1.1, owner);
    }
  }

  /* ------------------------------------------------ loot ------------------------------------------------ */
  takeLoot(l: Loot, text: string, quiet = false) {
    l.taken = true;
    l.mesh.visible = false;
    const col = RARITY_COLORS[l.rarity];
    this.fx.burst(l.x, 1, l.z, 10, 4, 0.5, 0.1, col, 6, 1);
    if (!quiet) sfx('pickup', 0.9);
    else sfx('pickup', 0.9);
    this.ui.onPick(text, col);
  }

  pickupPlayer() {
    const p = this.player;
    for (const l of this.loot) {
      if (l.taken) continue;
      const dx = l.x - p.x, dz = l.z - p.z;
      if (dx * dx + dz * dz > 5.2) continue;
      switch (l.kind) {
        case 'weapon': {
          const def = WEAPONS[l.wid!];
          if (def.kind === 'melee') {
            if (def.tier > WEAPONS[p.melee].tier) {
              this.addLoot('weapon', p.x + 1, p.z + 1, { wid: p.melee });
              p.melee = def.id;
              this.syncWeapon(p);
              this.takeLoot(l, def.name);
            }
          } else {
            const same = p.guns.findIndex((g) => g && g.id === def.id);
            if (same >= 0) {
              p.ammo[def.ammo!] += def.mag;
              this.takeLoot(l, `${def.name} ammo`);
            } else {
              const empty = p.guns.findIndex((g) => !g);
              if (empty >= 0) {
                p.guns[empty] = { id: def.id, mag: def.mag };
                p.ammo[def.ammo!] += def.mag;
                if (p.slot === 0 || (p.slot === 1 && def.tier > WEAPONS[p.guns[0]!.id].tier && empty === 1)) {
                  p.slot = empty + 1;
                  this.syncWeapon(p);
                }
                this.takeLoot(l, def.name);
              }
            }
          }
          break;
        }
        case 'ammo': p.ammo[l.ammo!] += l.amount; this.takeLoot(l, `+${l.amount} ${l.ammo} ammo`); break;
        case 'medkit': if (p.medkits < 5) { p.medkits++; this.takeLoot(l, 'Medkit'); } break;
        case 'shield': if (p.armor < 100) { p.armor = Math.min(100, p.armor + 50); this.takeLoot(l, 'Armor Vest'); } break;
        case 'grenade': if (p.gren < 6) { p.gren++; this.takeLoot(l, 'Grenade'); } break;
        case 'bomb': if (p.bomb < 3) { p.bomb++; this.takeLoot(l, 'Mega Bomb'); } break;
      }
    }
  }

  pickupBot(b: Actor, l: Loot) {
    if (l.taken) return;
    switch (l.kind) {
      case 'weapon': {
        const def = WEAPONS[l.wid!];
        if (def.kind === 'melee') { if (def.tier > WEAPONS[b.melee].tier) b.melee = def.id; l.taken = true; }
        else {
          const empty = b.guns.findIndex((g) => !g);
          if (empty >= 0) { b.guns[empty] = { id: def.id, mag: def.mag }; l.taken = true; }
          else {
            const lo = WEAPONS[b.guns[0]!.id].tier <= WEAPONS[b.guns[1]!.id].tier ? 0 : 1;
            if (def.tier > WEAPONS[b.guns[lo]!.id].tier) { b.guns[lo] = { id: def.id, mag: def.mag }; l.taken = true; }
          }
        }
        break;
      }
      case 'medkit': b.medkits++; l.taken = true; break;
      case 'shield': b.armor = Math.min(100, b.armor + 50); l.taken = true; break;
      case 'grenade': b.gren++; l.taken = true; break;
      case 'bomb': b.bomb++; l.taken = true; break;
      default: l.taken = true;
    }
    if (l.taken) {
      l.mesh.visible = false;
      this.botEquip(b);
    }
  }

  botEquip(b: Actor) {
    let best = 0, bt = -1;
    b.guns.forEach((g, i) => {
      if (g && WEAPONS[g.id].tier > bt) { bt = WEAPONS[g.id].tier; best = i + 1; }
    });
    b.slot = bt >= 0 ? best : 0;
    this.syncWeapon(b);
  }

  botJump(b: Actor) {
    const ai = b.ai!;
    b.phase = 'fall';
    b.y = this.plane!.alt;
    // pick landing spot: nearest of a few random loot spots to jump point
    let best = this.world.spots[0], bd = 1e9;
    for (let i = 0; i < 6; i++) {
      const s = this.world.spots[Math.floor(Math.random() * this.world.spots.length)];
      const d = Math.hypot(s.x - b.x, s.z - b.z);
      if (d < bd) { bd = d; best = s; }
    }
    ai.landX = best.x + rnd(-3, 3);
    ai.landZ = best.z + rnd(-3, 3);
  }

  airdrop() {
    const z = this.zone;
    const a = Math.random() * 6.28;
    const r = Math.sqrt(Math.random()) * z.tr * 0.8;
    const x = clamp(z.tx + Math.cos(a) * r, -this.mode.half + 15, this.mode.half - 15);
    const zz = clamp(z.tz + Math.sin(a) * r, -this.mode.half + 15, this.mode.half - 15);
    const crate = makeLootBox(0xef4444);
    crate.position.set(x, 0, zz);
    this.worldGroup.add(crate);
    const smoke = new THREE.Mesh(BEAM, new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    smoke.scale.set(2, 3, 2);
    smoke.position.set(x, 0, zz);
    this.worldGroup.add(smoke);
    const prot = { x, z: zz };
    this.world.resolve(prot, 1);
    this.world.addBox(x - 0.8, zz - 0.8, x + 0.8, zz + 0.8, 1.2);
    const pool: WeaponId[] = this.mode.meleeOnly ? ['axe', 'axe'] : ['sniper', 'ar', 'shotgun', 'smg'];
    for (let i = 0; i < 3; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      this.addLoot('weapon', x + Math.cos(i * 2.1) * 2.6, zz + Math.sin(i * 2.1) * 2.6, { wid: id, rarity: 4 });
    }
    this.addLoot('shield', x + 1, zz - 3, { rarity: 4 });
    this.addLoot('bomb', x - 3, zz + 1);
    this.airdrops.push({ x, z: zz });
    this.ui.onToast('AIRDROP LANDED', 'Legendary loot · red smoke on the map', 'info');
    sfx('zone');
  }

  /* ------------------------------------------------ update ------------------------------------------------ */
  updatePlane(dt: number) {
    const pl = this.plane;
    if (!pl) return;
    pl.p += (pl.speed / pl.len) * dt;
    pl.x = pl.sx + pl.dx * pl.len * pl.p;
    pl.z = pl.sz + pl.dz * pl.len * pl.p;
    pl.mesh.position.set(pl.x, pl.alt, pl.z);
    pl.mesh.visible = pl.p < 1.1;
    const prop = pl.mesh.userData.prop as THREE.Object3D;
    if (prop) prop.rotation.z += dt * 40;
    for (const a of this.actors) {
      if (a.phase !== 'plane') continue;
      a.x = pl.x; a.z = pl.z; a.y = pl.alt;
      if (a.isPlayer) {
        if (pl.p >= this.playerJumpAt || pl.p > 0.95) this.jumpOut(a);
      } else if (a.alive && pl.p >= a.ai!.jumpAt) this.botJump(a);
    }
  }

  jumpOut(a: Actor) {
    const pl = this.plane!;
    a.phase = 'fall';
    a.vx = pl.dx * 22;
    a.vz = pl.dz * 22;
    a.vy = -6;
    sfx('jump');
    this.shake = 0.5;
    this.ui.onToast('SKYDIVE!', 'Look down to dive · SPACE opens parachute', 'info');
  }

  updatePlayer(dt: number) {
    const p = this.player;
    const inp = this.input;
    if (!p.alive) { inp.lookX = inp.lookY = 0; inp.jump = false; return; }
    // look
    const sens = 0.0022 * (inp.ads ? 0.55 : 1);
    if (inp.lookX || inp.lookY) this.lastLook = this.time;
    this.camYaw -= inp.lookX * sens;
    this.camPitch -= inp.lookY * sens;
    inp.lookX = inp.lookY = 0;
    this.camPitch = clamp(this.camPitch, -1.45, 1.3);
    // vehicle auto-follow
    if (p.vehicle && this.time - this.lastLook > 1.2) {
      const v = p.vehicle;
      let diff = v.yaw - this.camYaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.camYaw += diff * Math.min(1, 2.5 * dt) * Math.min(1, Math.abs(v.speed) / 8);
      this.camPitch += (-0.2 - this.camPitch) * Math.min(1, 1.5 * dt);
    }
    p.yaw = this.camYaw;
    p.pitch = this.camPitch;
    const jumpPressed = inp.jump;
    inp.jump = false;
    const m = this.moveInput();
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    p.cd -= dt;
    p.ramCd -= dt;
    p.swing = Math.max(0, p.swing - dt * 4);
    p.recoil = Math.max(0, p.recoil - dt * 10);
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) this.finishReload(p); }

    if (p.phase === 'plane') return;
    if (p.phase === 'fall' || p.phase === 'chute') {
      if (p.phase === 'fall') {
        if (jumpPressed && p.y < 140) this.openChute(p);
        const ld = clamp((-p.pitch + 0.15) / 0.9, 0, 1);
        const hs = 32 - 26 * ld;
        const tvy = -(30 + 30 * ld);
        const fw = Math.max(m.y, 0);
        const wx = fx * fw * hs + rx * m.x * 12, wz = fz * fw * hs + rz * m.x * 12;
        p.vx += (wx - p.vx) * Math.min(1, 2.5 * dt);
        p.vz += (wz - p.vz) * Math.min(1, 2.5 * dt);
        p.vy += (tvy - p.vy) * Math.min(1, 3 * dt);
        if (p.y < 52) this.openChute(p);
      } else {
        const wx = fx * m.y * 14 + rx * m.x * 10, wz = fz * m.y * 14 + rz * m.x * 10;
        p.vx += (wx - p.vx) * Math.min(1, 2.2 * dt);
        p.vz += (wz - p.vz) * Math.min(1, 2.2 * dt);
        p.vy += (-11 - p.vy) * Math.min(1, 4 * dt);
      }
      p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
      const pp = { x: p.x, z: p.z };
      this.world.resolve(pp, 0.5);
      p.x = pp.x; p.z = pp.z;
      if (p.y <= 0) this.land(p);
      return;
    }
    if (p.phase === 'vehicle') {
      return;
    }

    // ground movement
    const sprinting = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || inp.sprint || (this.isTouch && m.l > 0.92)) && m.y > 0.1 && !inp.ads;
    let speed = sprinting ? 8.6 : 5.6;
    if (p.healT > 0) speed *= 0.55;
    if (inp.ads) speed *= 0.7;
    const wx = (fx * m.y + rx * m.x) * speed;
    const wz = (fz * m.y + rz * m.x) * speed;
    const acc = p.onGround ? 14 : 3;
    p.vx += (wx - p.vx) * Math.min(1, acc * dt);
    p.vz += (wz - p.vz) * Math.min(1, acc * dt);
    if (jumpPressed && p.onGround) { p.vy = 7.2; p.onGround = false; }
    p.vy -= 24 * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const pp = { x: p.x, z: p.z };
    this.world.resolve(pp, 0.5);
    p.x = pp.x; p.z = pp.z;
    p.speed = Math.hypot(p.vx, p.vz);
    p.walkT += p.speed * dt * 1.1;
    // healing
    if (p.healT > 0) {
      p.healT -= dt;
      if (p.healT <= 0) {
        p.hp = Math.min(100, p.hp + 55);
        p.medkits--;
        this.fx.burst(p.x, 1.2, p.z, 14, 3, 0.8, 0.12, 0x4ade80, -2, 1);
        sfx('heal');
      }
    }
    // aim assist (touch)
    const wantFire = inp.fire && p.healT <= 0;
    if (this.isTouch && wantFire) this.aimAssist(dt);
    // firing
    const def = WEAPONS[p.weaponId];
    const edge = inp.fire && !this.prevFire;
    this.prevFire = inp.fire;
    if (wantFire && p.cd <= 0 && p.reload <= 0) {
      if (def.kind === 'melee') {
        if (def.auto || edge) this.meleeAttack(p);
      } else if (def.auto || edge) {
        const g = p.gun!;
        if (g.mag > 0) this.playerShoot();
        else if (p.ammo[def.ammo!] > 0) this.startReload(p);
        else if (edge) { p.cd = 0.25; sfx('hit', 0.3); }
      }
    }
    this.pickupPlayer();
  }

  aimAssist(dt: number) {
    const p = this.player;
    const d = this.camDir;
    let best: Actor | null = null, ba = 0.12;
    for (const e of this.actors) {
      if (e === p || !e.alive || e.phase === 'plane' || e.phase === 'vehicle') continue;
      const dx = e.x - this.camera.position.x, dy = e.y + 1.3 - this.camera.position.y, dz = e.z - this.camera.position.z;
      const l = Math.hypot(dx, dy, dz);
      if (l > 70) continue;
      const dot = (dx * d.x + dy * d.y + dz * d.z) / l;
      const ang = Math.acos(clamp(dot, -1, 1));
      if (ang < ba) { ba = ang; best = e; }
    }
    if (!best) return;
    const dx = best.x - this.camera.position.x, dy = best.y + 1.3 - this.camera.position.y, dz = best.z - this.camera.position.z;
    const ty = Math.atan2(-dx, -dz);
    const tp = Math.atan2(dy, Math.hypot(dx, dz));
    let dyaw = ty - this.camYaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.camYaw += dyaw * Math.min(1, 6 * dt);
    this.camPitch += (tp - this.camPitch) * Math.min(1, 6 * dt);
  }

  openChute(p: Actor) {
    if (p.phase !== 'fall') return;
    p.phase = 'chute';
    sfx('chute');
    this.shake = Math.max(this.shake, 0.35);
    this.fov -= 6;
  }

  land(a: Actor) {
    a.y = 0;
    a.vy = 0;
    a.phase = 'ground';
    a.onGround = true;
    this.fx.burst(a.x, 0.2, a.z, 18, 7, 0.7, 0.3, 0xa89572, 6, 0.1);
    if (a.isPlayer) {
      this.shake = Math.max(this.shake, 0.55);
      sfx('land');
      this.ui.onToast('LANDED!', 'Grab loot · glowing items are weapons', 'info');
    } else {
      const d = Math.hypot(a.x - this.player.x, a.z - this.player.z);
      sfx('land', clamp(1 - d / 60, 0, 1) * 0.5);
    }
  }

  updateProjectiles(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      pr.vy -= 24 * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      if (pr.y < 0.25) {
        pr.y = 0.25;
        pr.vy = -pr.vy * 0.4;
        pr.vx *= 0.7; pr.vz *= 0.7;
        if (Math.abs(pr.vy) < 1.5) pr.vy = 0;
      }
      const pp = { x: pr.x, z: pr.z };
      if (this.world.resolve(pp, 0.25)) {
        pr.x = pp.x; pr.z = pp.z;
        pr.vx *= -0.35; pr.vz *= -0.35;
      }
      pr.fuse -= dt;
      pr.mesh.position.set(pr.x, pr.y, pr.z);
      const blink = Math.floor(pr.fuse * (pr.fuse < 1 ? 12 : 5)) % 2 === 0;
      (pr.mesh.material as THREE.MeshBasicMaterial).color.set(blink ? 0xff3030 : pr.type === 'bomb' ? 0x15171b : 0x5b8c1a);
      pr.trail -= dt;
      if (pr.trail <= 0) { pr.trail = 0.04; this.fx.emit(pr.x, pr.y, pr.z, rnd(-0.3, 0.3), rnd(0, 0.6), rnd(-0.3, 0.3), 0.4, 0.12, 0x999999, 0); }
      if (pr.fuse <= 0) {
        this.worldGroup.remove(pr.mesh);
        this.projs.splice(i, 1);
        if (pr.type === 'bomb') this.explode(pr.x, pr.y, pr.z, 15, 190, pr.owner, true);
        else this.explode(pr.x, pr.y, pr.z, 8.5, 100, pr.owner, false);
      }
    }
  }

  updateZone(dt: number) {
    const z = this.zone;
    if (!z) return;
    z.t += dt;
    if (z.stage === 'wait') {
      if (z.t >= z.dur) {
        z.stage = 'shrink';
        z.t = 0;
        z.dur = this.mode.phases[z.phase].shrink;
        this.ui.onToast('ZONE SHRINKING!', 'Run to the white circle', 'zone');
        sfx('zone');
      }
    } else if (z.stage === 'shrink') {
      const k = Math.min(1, z.t / z.dur);
      z.cx = z.fx + (z.tx - z.fx) * k;
      z.cz = z.fz + (z.tz - z.fz) * k;
      z.r = z.fr + (z.tr - z.fr) * k;
      if (z.t >= z.dur) {
        z.cx = z.tx; z.cz = z.tz; z.r = z.tr;
        if (z.phase + 1 < this.mode.phases.length) this.startPhase(z.phase + 1);
        else { z.stage = 'final'; z.dps = 18; }
      }
    }
    if (this.zoneMesh) {
      this.zoneMesh.scale.set(z.r, 1, z.r);
      this.zoneMesh.position.x = z.cx;
      this.zoneMesh.position.z = z.cz;
      if (this.zoneTex) this.zoneTex.offset.y -= dt * 0.25;
    }
    for (const a of this.actors) {
      if (!a.alive || a.phase === 'plane') continue;
      const d = Math.hypot(a.x - z.cx, a.z - z.cz);
      if (d > z.r) {
        const dmg = z.dps * dt;
        a.hp -= dmg;
        if (a.isPlayer) {
          this.ui.onHurt(true);
          if (Math.random() < dt * 2) sfx('hurt', 0.4);
          this.shake = Math.max(this.shake, 0.08);
        }
        a.squash = Math.max(a.squash, 0.2);
        if (a.hp <= 0) this.killActor(a, null, 'Zone', false);
      }
    }
    if (this.airdropAt > 0 && this.time >= this.airdropAt) {
      this.airdropAt = 0;
      this.airdrop();
    }
  }

  updateLoot(dt: number) {
    const cam = this.camera.position;
    for (const l of this.loot) {
      if (l.taken) continue;
      const dx = l.x - cam.x, dz = l.z - cam.z;
      const vis = dx * dx + dz * dz < 120 * 120;
      l.mesh.visible = vis;
      if (!vis) continue;
      l.phase += dt * 2;
      const item = l.mesh.userData.item as THREE.Object3D;
      item.rotation.y += dt * 1.6;
      item.position.y = 0.95 + Math.sin(l.phase) * 0.12;
    }
    this.cleanT -= dt;
    if (this.cleanT <= 0) {
      this.cleanT = 4;
      this.loot = this.loot.filter((l) => {
        if (l.taken) this.worldGroup.remove(l.mesh);
        return !l.taken;
      });
    }
  }

  animateActors(dt: number) {
    const cam = this.camera.position;
    for (const a of this.actors) {
      const h = a.human;
      a.squash = Math.max(0, a.squash - dt * 6);
      if (a.phase === 'plane') { h.root.visible = false; continue; }
      const dx = a.x - cam.x, dz = a.z - cam.z;
      if (dx * dx + dz * dz > 160 * 160 && a.phase !== 'fall') { h.root.visible = false; continue; }
      const inCar = a.phase === 'vehicle' && a.vehicle && a.vehicle.type !== 'bike';
      h.root.visible = !inCar;
      if (inCar) continue;
      const hidden = false;
      void hidden;
      h.root.position.set(a.x, 0, a.z);
      h.shadow.visible = a.alive && a.phase !== 'vehicle';
      const sc = 1 + a.squash * 0.12;
      h.body.scale.set(sc, 1 - a.squash * 0.06, sc);
      h.body.rotation.y = a.yaw;
      // pose
      const targetPose = !a.alive ? -1 : a.phase === 'fall' ? 1 : 0;
      a.pose += (targetPose - a.pose) * Math.min(1, (a.alive ? 6 : 9) * dt);
      h.body.rotation.x = a.pose > 0 ? -a.pose * 1.35 : -a.pose * 1.5;
      let by = a.y + Math.abs(a.pose) * (a.pose > 0 ? 0.9 : 0.15);
      h.canopy.visible = a.phase === 'chute';
      if (a.phase === 'vehicle') by = 0.25;
      h.body.position.y = by;
      // legs
      let sw = 0;
      if (a.alive && a.phase === 'ground') {
        const sp = a.isPlayer ? a.speed : (a.ai?.speed ?? 0);
        sw = Math.sin(a.walkT) * Math.min(1, sp / 6) * 0.9;
        if (!a.isPlayer) a.walkT += sp * dt * 1.1;
      } else if (a.phase === 'fall') sw = Math.sin(this.time * 18 + a.id) * 0.4;
      h.legL.rotation.x = sw;
      h.legR.rotation.x = -sw;
      if (a.phase === 'chute') { h.legL.rotation.x = 0.3; h.legR.rotation.x = 0.3; }
      // weapon holder
      const def = WEAPONS[a.weaponId];
      let hx = a.alive ? Math.max(-0.7, Math.min(0.9, a.pitch)) : 0;
      if (a.swing > 0 && def.kind === 'melee') {
        const s = a.swing;
        hx += Math.sin(s * Math.PI) * -1.5 + (s > 0.5 ? 0.9 * (s - 0.5) : 0);
        h.holder.position.z = -0.1 - Math.sin(s * Math.PI) * 0.35;
      } else {
        h.holder.position.z = -0.1 + a.recoil * 0.12;
        hx += a.recoil * 0.08;
      }
      if (a.phase === 'fall') hx = 1.1;
      if (a.reload > 0) hx -= 0.4;
      h.holder.rotation.x = hx;
      if (!a.isPlayer) {
        a.swing = Math.max(0, a.swing - dt * 4);
        a.recoil = Math.max(0, a.recoil - dt * 10);
      }
    }
  }

  update(dt: number) {
    this.time += dt;
    this.updatePlane(dt);
    this.updatePlayer(dt);
    for (const a of this.actors) {
      if (a.isPlayer || !a.alive) continue;
      a.cd -= dt;
      a.ramCd -= dt;
      if (a.reload > 0) { a.reload -= dt; if (a.reload <= 0) this.finishReload(a); }
      updateBot(this, a, dt);
    }
    this.updateVehicles(dt);
    this.updateProjectiles(dt);
    this.updateZone(dt);
    this.updateLoot(dt);
    this.fx.update(dt);
    if (this.endAt && this.time >= this.endAt && !this.finished) {
      this.finish(this.player.alive);
    }
  }

  /* ------------------------------------------------ camera ------------------------------------------------ */
  updateCamera(dt: number, real: number) {
    const p = this.player;
    const cam = this.camera;
    let yaw = this.camYaw, pitch = this.camPitch;
    let tx = p.x, ty = p.y + 1.65, tz = p.z;
    let dist = 4.1, shoulder = 0.75;
    const ads = this.input.ads && p.phase === 'ground' && p.alive;
    if (ads) { dist = 2.4; shoulder = 0.55; }
    let baseFov = this.mode ? 72 : 72;
    if (window.innerWidth < window.innerHeight) baseFov = 82;
    let tfov = baseFov;
    if (p.phase === 'plane') {
      dist = 26; shoulder = 0; ty = p.y + 5;
    } else if (p.phase === 'fall') {
      dist = 7.5; shoulder = 0; ty = p.y + 1.2; tfov += 10;
    } else if (p.phase === 'chute') {
      dist = 8; shoulder = 0.5; ty = p.y + 2.2;
    } else if (p.phase === 'vehicle' && p.vehicle) {
      dist = p.vehicle.def.cam; shoulder = 0; ty = (p.vehicle.type === 'truck' ? 3.2 : 2.2);
      tfov += (Math.abs(p.vehicle.speed) / p.vehicle.def.max) * 12;
    } else if (ads) {
      tfov = WEAPONS[p.weaponId].zoom;
    } else if (this.keys.has('ShiftLeft') && p.speed > 6) tfov += 4;
    if (!p.alive || this.state === 'over') {
      // orbit
      const focus = p.alive ? p : this.actors.find((a) => a.alive) ?? p;
      const t = this.time * 0.35;
      tx = focus.x; tz = focus.z; ty = focus.y + 1.5;
      yaw = t; pitch = -0.35; dist = 7; shoulder = 0;
      this.camYaw = yaw;
    }
    this.fov += (tfov - this.fov) * Math.min(1, 9 * dt);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    const cp = Math.cos(pitch);
    const dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
    this.camDir.set(dx, dy, dz);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let cx = tx - dx * dist + rx * shoulder;
    let cy = ty - dy * dist;
    let cz = tz - dz * dist + rz * shoulder;
    // camera collision
    if (p.phase === 'ground' || p.phase === 'vehicle' || !p.alive) {
      const vx = cx - tx, vy = cy - ty, vz = cz - tz;
      const len = Math.hypot(vx, vy, vz);
      const t = this.world.ray(tx, ty, tz, vx / len, vy / len, vz / len, len);
      if (t < len) {
        const k = Math.max(0.6, t - 0.3);
        cx = tx + (vx / len) * k; cy = ty + (vy / len) * k; cz = tz + (vz / len) * k;
      }
    }
    if (cy < 0.4) cy = 0.4;
    this.camDist = Math.hypot(cx - tx, cy - ty, cz - tz);
    // shake
    this.shake = Math.max(0, this.shake - real * 1.7);
    const s = this.shake * this.shake;
    const t = performance.now() * 0.05;
    cam.position.set(cx + Math.sin(t * 1.3) * s * 0.35, cy + Math.cos(t * 1.7) * s * 0.35, cz + Math.sin(t * 1.1 + 2) * s * 0.35);
    cam.rotation.set(pitch + Math.sin(t * 1.9) * s * 0.03, yaw + Math.cos(t * 1.4) * s * 0.03, Math.sin(t * 1.6) * s * 0.05);
    this.sky.position.copy(cam.position);
  }

  /* ------------------------------------------------ hud ------------------------------------------------ */
  pushHud() {
    const p = this.player;
    if (!p) return;
    const z = this.zone;
    const def = WEAPONS[p.weaponId];
    const g = p.gun;
    const near = p.alive && p.phase === 'ground' ? this.nearVehicle(p) : null;
    const swap = p.alive && p.phase === 'ground' && !near ? this.nearSwap(p) : null;
    let prompt: string | null = null;
    if (p.vehicle) prompt = 'E · EXIT';
    else if (near) prompt = `E · DRIVE ${near.def.name.toUpperCase()}`;
    else if (swap) prompt = `E · SWAP FOR ${WEAPONS[swap.wid!].name.toUpperCase()}`;
    let hint: string | null = null;
    if (p.phase === 'plane') hint = this.isTouch ? 'TAP JUMP TO DROP' : 'PRESS SPACE TO JUMP';
    else if (p.phase === 'fall') hint = this.isTouch ? 'PUSH STICK FORWARD · LOOK DOWN TO DIVE' : 'W + LOOK DOWN TO DIVE · SPACE = PARACHUTE';
    const d = z ? Math.hypot(p.x - z.cx, p.z - z.cz) : 0;
    this.ui.onHud({
      alive: this.aliveCount(), total: this.mode.players, kills: p.kills, score: Math.round(this.liveScore()),
      hp: Math.max(0, Math.ceil(p.hp)), armor: Math.ceil(p.armor), phase: p.phase,
      weapon: def.name, wid: def.id, mag: g ? g.mag : 0, reserve: g ? p.ammo[WEAPONS[g.id].ammo!] : 0, isGun: def.kind === 'gun',
      slots: [{ id: p.melee, active: p.slot === 0 }, { id: p.guns[0]?.id ?? null, active: p.slot === 1 }, { id: p.guns[1]?.id ?? null, active: p.slot === 2 }],
      gren: p.gren, bomb: p.bomb, medkits: p.medkits,
      heal: p.healT > 0 ? 1 - p.healT / 1.6 : 0,
      reload: p.reload > 0 && g ? 1 - p.reload / WEAPONS[g.id].reload : 0,
      zoneLabel: z ? (z.stage === 'wait' ? 'ZONE CLOSES IN' : z.stage === 'shrink' ? 'ZONE SHRINKING' : 'FINAL ZONE') : '',
      zoneTime: z ? Math.max(0, z.dur - z.t) : 0,
      zoneKind: z ? z.stage : 'wait',
      inZone: z ? d <= z.r : true,
      prompt, speed: p.vehicle ? Math.round(Math.abs(p.vehicle.speed) * 3.6) : 0,
      vehicle: p.vehicle ? p.vehicle.def.name : null,
      vehHp: p.vehicle ? Math.max(0, p.vehicle.hp / p.vehicle.def.hp) : 0,
      alt: Math.max(0, Math.round(p.y)),
      scoped: !!(this.input.ads && p.weaponId === 'sniper' && p.phase === 'ground' && p.alive),
      hint,
      touchAct: !!prompt,
    });
  }

  drawMinimap() {
    const c = this.minimap;
    const ctx = c.getContext('2d');
    if (!ctx || !this.player || !this.zone) return;
    const W = c.width, H = c.height;
    const p = this.player;
    const win = 130;
    const s = W / (win * 2);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#2d4f2a';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(this.camYaw);
    ctx.scale(s, s);
    ctx.translate(-p.x, -p.z);
    // map bounds
    const hf = this.mode.half + 15;
    ctx.fillStyle = '#1b2430';
    ctx.fillRect(p.x - 400, p.z - 400, 800, 800);
    ctx.fillStyle = '#3d6b38';
    ctx.fillRect(-hf, -hf, hf * 2, hf * 2);
    // buildings
    ctx.fillStyle = '#c9b99a';
    for (const b of this.world.buildings) {
      if (Math.abs(b.x0 - p.x) > win * 1.5 || Math.abs(b.z0 - p.z) > win * 1.5) continue;
      ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    }
    // zone
    const z = this.zone;
    ctx.fillStyle = 'rgba(56,189,248,0.35)';
    ctx.beginPath();
    ctx.rect(p.x - 600, p.z - 600, 1200, 1200);
    ctx.arc(z.cx, z.cz, Math.max(0.1, z.r), 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2 / s;
    ctx.beginPath();
    ctx.arc(z.cx, z.cz, Math.max(0.1, z.r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / s;
    ctx.beginPath();
    ctx.arc(z.tx, z.tz, Math.max(0.1, z.tr), 0, Math.PI * 2);
    ctx.stroke();
    // vehicles
    for (const v of this.vehicles) {
      if (v.wreck) continue;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(v.x - 3, v.z - 3, 6, 6);
    }
    for (const a of this.airdrops) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(a.x, a.z, 6, 0, 6.3);
      ctx.fill();
    }
    // enemies nearby
    ctx.fillStyle = '#ef4444';
    for (const a of this.actors) {
      if (a === p || !a.alive || a.phase === 'plane') continue;
      const d = Math.hypot(a.x - p.x, a.z - p.z);
      if (d < 45 || a.phase === 'chute' || a.phase === 'fall') {
        ctx.beginPath();
        ctx.arc(a.x, a.z, 3.2, 0, 6.3);
        ctx.fill();
      }
    }
    const pl = this.plane;
    if (pl && pl.p < 1.1) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pl.x, pl.z, 7, 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
    // player arrow
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* ------------------------------------------------ loop ------------------------------------------------ */
  loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let real = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (real <= 0) return;
    // adaptive resolution
    this.perfAcc += real;
    this.perfN++;
    if (this.perfAcc > 1.5) {
      const avg = this.perfAcc / this.perfN;
      if (avg > 0.021 && this.pr > 0.7) { this.pr = Math.max(0.7, this.pr - 0.2); this.renderer.setPixelRatio(this.pr); this.resize(); }
      else if (avg < 0.0135 && this.pr < this.maxPr) { this.pr = Math.min(this.maxPr, this.pr + 0.15); this.renderer.setPixelRatio(this.pr); this.resize(); }
      this.perfAcc = 0;
      this.perfN = 0;
    }
    if (this.state === 'menu') {
      const t = now * 0.00006;
      const R = this.mode.half * 0.55;
      this.camera.position.set(Math.cos(t) * R, 55 + Math.sin(t * 2) * 8, Math.sin(t) * R);
      this.camera.lookAt(0, 8, 0);
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
      this.sky.position.copy(this.camera.position);
    } else if (this.state === 'playing' || this.state === 'over') {
      let dt = real;
      if (this.slow > 0) { dt *= 0.3; this.slow -= real; }
      this.update(dt);
      this.animateActors(dt);
      this.updateCamera(dt, real);
      this.hudT -= real;
      if (this.hudT <= 0) { this.hudT = 0.09; this.pushHud(); }
      this.mapT++;
      if (this.mapT % 3 === 0) this.drawMinimap();
    } else if (this.state === 'paused') {
      real = 0;
    }
    this.renderer.render(this.scene, this.camera);
  };
}
