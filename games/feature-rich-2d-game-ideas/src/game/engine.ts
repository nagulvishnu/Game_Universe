import {
  WEAPONS, WEAPON_ORDER, CHARS, ENEMIES, LEVELS, VEHICLES,
  type WeaponId, type CharDef, type LevelDef, type EnemyId, type EnemyDef, type VehicleId, type VehicleDef,
  type BossDef, type BossPattern, type Save,
} from './data';
import { sfx } from './audio';

// ---------------- helpers ----------------
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function distPointSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
function pick<T>(list: [T, number][]): T {
  let tot = 0;
  for (const [, w] of list) tot += w;
  let r = Math.random() * tot;
  for (const [v, w] of list) {
    r -= w;
    if (r <= 0) return v;
  }
  return list[0][0];
}

// ---------------- types ----------------
export interface GameResult {
  win: boolean; score: number; kills: number; credits: number; time: number; levelIdx: number; damage: number; bestCombo: number;
}
export interface GameCallbacks {
  onEnd: (r: GameResult) => void;
  onPause: () => void;
}

interface Obstacle { x: number; y: number; w: number; h: number; kind: 'wall' | 'crate' | 'barrel'; hp: number; maxHp: number; alive: boolean; flash: number }
interface Bullet {
  x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; maxLife: number; friendly: boolean; color: string;
  pierce: number; explode: number; kind: string; homing: number; burn: number; slow: number; shock: number; crit: boolean; hit: Set<number>; grow: number;
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; drag: number; glow: boolean; grow: number }
interface FText { x: number; y: number; s: string; color: string; size: number; t: number }
interface Beam { pts: { x: number; y: number }[]; t: number; max: number; color: string; w: number }
interface Boom { x: number; y: number; r: number; t: number; max: number; color: string }
interface Pickup { x: number; y: number; type: 'coin' | 'hp' | 'ammo' | 'weapon' | 'ult'; val: number; wid?: WeaponId; t: number; life: number }
interface Hazard { x: number; y: number; r: number; dps: number; type: 'toxic' | 'lava' | 'energy'; phase: number }
interface Grenade { x: number; y: number; vx: number; vy: number; t: number; z: number }
interface Turret { x: number; y: number; life: number; cd: number; ang: number }
interface Delayed { t: number; x: number; y: number; r: number; color: string; fn: () => void }

interface BossRt {
  def: BossDef; act: BossPattern | null; actT: number; actDur: number; pcd: number; fired: number; sweepA: number; lockA: number; lastTick: number; sweepDir: number;
}
interface Enemy {
  id: number; type: EnemyId | 'boss'; def: EnemyDef; x: number; y: number; vx: number; vy: number; r: number; hp: number; maxHp: number; speed: number;
  color: string; flying: boolean; dmgMult: number; cd: number; hitCd: number; state: number; st: number; ang: number; lx: number; ly: number;
  flash: number; burn: number; slow: number; stun: number; freeze: number; kbx: number; kby: number; side: number; sideT: number; rammed: number;
  bladeCd: number; shots: number; elite: boolean; dead: boolean; boss?: BossRt; strafe: number; t: number; burnTick: number;
}
interface Vehicle {
  def: VehicleDef; x: number; y: number; vx: number; vy: number; angle: number; aim: number; hp: number; maxHp: number; r: number;
  fireCd: number; boost: number; boostCd: number; occupied: boolean; dead: boolean; flash: number; shots: number; t: number;
}
interface WSlot { id: WeaponId; mag: number; reserve: number }
interface Player {
  x: number; y: number; vx: number; vy: number; r: number; hp: number; maxHp: number; angle: number;
  dashT: number; dashCd: number; dashDx: number; dashDy: number; inv: number; dashInv: number;
  weapons: WSlot[]; cur: number; reloadT: number; fireCd: number; skillCd: number; ult: number; grenades: number; grenT: number; meleeCd: number; meleeT: number;
  buffs: { adren: number; rage: number; shield: number; chrono: number; blades: number; drones: number; haz: number };
  hitFlash: number; vehicle: Vehicle | null; dead: boolean; footT: number;
}

// ---------------- the game ----------------
export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cb: GameCallbacks;
  char: CharDef;
  lvl: LevelDef;
  lvlIdx: number;
  save: Save;
  sw = 0; sh = 0; dpr = 1; zoom = 1;
  W = 0; H = 0;
  keys = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: 0, y: 0, down: false, clickBuf: 0 };
  paused = false;
  raf = 0;
  lastT = 0;
  time = 0;
  running = false;
  endTimer = -1;
  ended = false;
  nextId = 1;

  p!: Player;
  obs: Obstacle[] = [];
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  parts: Particle[] = [];
  texts: FText[] = [];
  beams: Beam[] = [];
  booms: Boom[] = [];
  pickups: Pickup[] = [];
  hazards: Hazard[] = [];
  grenades: Grenade[] = [];
  turrets: Turret[] = [];
  vehicles: Vehicle[] = [];
  delayed: Delayed[] = [];
  ground!: HTMLCanvasElement;
  vignette: CanvasGradient | null = null;

  cam = { x: 0, y: 0 };
  shake = 0;
  mouseW = { x: 0, y: 0 };

  kills = 0;
  score = 0;
  creditsGot = 0;
  dmgDealt = 0;
  combo = 0;
  comboT = 0;
  bestCombo = 0;
  spawnT = 1.5;
  bossSpawned = false;
  boss: Enemy | null = null;
  bossDead = false;
  vehicleDropT = 0;
  banner = { text: '', sub: '', t: 0, color: '#fff' };
  hint = 9;
  flashScreen = { t: 0, color: '#fff' };
  freezeFx = 0;

  private onKeyDown = (e: KeyboardEvent) => this.keyDown(e);
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onMouseMove = (e: MouseEvent) => this.mouseMove(e);
  private onMouseDown = (e: MouseEvent) => { if (e.button === 0) { this.mouse.down = true; this.mouse.clickBuf = 0.15; } };
  private onMouseUp = (e: MouseEvent) => { if (e.button === 0) this.mouse.down = false; };
  private onWheel = (e: WheelEvent) => this.wheel(e);
  private onResize = () => this.resize();
  private onCtx = (e: Event) => e.preventDefault();
  private onBlur = () => { this.keys.clear(); this.mouse.down = false; };

  constructor(canvas: HTMLCanvasElement, charId: CharDef['id'], levelIdx: number, save: Save, cb: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    this.char = CHARS[charId];
    this.lvlIdx = levelIdx;
    this.lvl = LEVELS[levelIdx];
    this.save = save;
    this.resize();
    this.buildLevel();
    this.initPlayer();
    this.setBanner(`MISSION ${levelIdx + 1}`, this.lvl.name + ' — ' + this.lvl.subtitle, 3.2, this.lvl.theme.accent);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('contextmenu', this.onCtx);
  }

  start() {
    this.running = true;
    this.lastT = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.033, (now - this.lastT) / 1000);
      this.lastT = now;
      if (!this.paused) this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('contextmenu', this.onCtx);
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) { this.keys.clear(); this.pressed.clear(); this.mouse.down = false; }
    else this.lastT = performance.now();
  }

  // ---------------- input ----------------
  keyDown(e: KeyboardEvent) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape') {
      if (!e.repeat && !this.ended) { this.cb.onPause(); }
      return;
    }
    if (!e.repeat) this.pressed.add(e.code);
    this.keys.add(e.code);
  }
  mouseMove(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
  }
  wheel(e: WheelEvent) {
    e.preventDefault();
    if (this.paused || this.p.vehicle) return;
    const n = this.p.weapons.length;
    this.selectWeapon((this.p.cur + (e.deltaY > 0 ? 1 : -1) + n) % n);
  }
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.sw = window.innerWidth;
    this.sh = window.innerHeight;
    this.canvas.width = Math.floor(this.sw * this.dpr);
    this.canvas.height = Math.floor(this.sh * this.dpr);
    this.canvas.style.width = this.sw + 'px';
    this.canvas.style.height = this.sh + 'px';
    this.zoom = clamp(Math.min(this.sw / 1350, this.sh / 760), 0.6, 1.25);
    const g = this.ctx.createRadialGradient(this.sw / 2, this.sh / 2, Math.min(this.sw, this.sh) * 0.35, this.sw / 2, this.sh / 2, Math.max(this.sw, this.sh) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    this.vignette = g;
  }

  // ---------------- level building ----------------
  buildLevel() {
    const lvl = this.lvl;
    [this.W, this.H] = lvl.size;
    const rng = mulberry32(this.lvlIdx * 7919 + 101);
    const R = (a: number, b: number) => a + rng() * (b - a);
    const cx = this.W / 2, cy = this.H / 2;
    const overlaps = (x: number, y: number, w: number, h: number, m: number) => {
      for (const o of this.obs) if (x < o.x + o.w + m && x + w > o.x - m && y < o.y + o.h + m && y + h > o.y - m) return true;
      return false;
    };
    const nearSpawn = (x: number, y: number, w: number, h: number) => x + w > cx - 300 && x < cx + 300 && y + h > cy - 300 && y < cy + 300;
    const wallCount = 40 + this.lvlIdx * 6;
    let tries = 0;
    while (this.obs.length < wallCount && tries++ < 800) {
      let w = R(60, 230), h = R(44, 120);
      if (rng() < 0.5) [w, h] = [h, w];
      const x = R(80, this.W - w - 80), y = R(80, this.H - h - 80);
      if (nearSpawn(x, y, w, h) || overlaps(x, y, w, h, 70)) continue;
      this.obs.push({ x, y, w, h, kind: 'wall', hp: 1e9, maxHp: 1e9, alive: true, flash: 0 });
    }
    // crates & barrels
    const addSmall = (kind: 'crate' | 'barrel', n: number, size: number, hp: number) => {
      let t = 0, c = 0;
      while (c < n && t++ < 600) {
        const x = R(100, this.W - 100), y = R(100, this.H - 100);
        if (nearSpawn(x, y, size, size) || overlaps(x, y, size, size, 30)) continue;
        this.obs.push({ x, y, w: size, h: size, kind, hp, maxHp: hp, alive: true, flash: 0 });
        c++;
      }
    };
    addSmall('crate', 26, 44, 60);
    addSmall('barrel', 16, 30, 16);

    // hazards
    if (lvl.hazard) {
      const h = lvl.hazard;
      for (let i = 0; i < h.count; i++) {
        const r = R(70, 130);
        const x = R(r + 100, this.W - r - 100), y = R(r + 100, this.H - r - 100);
        if (Math.hypot(x - cx, y - cy) < 420) continue;
        this.hazards.push({ x, y, r, dps: h.type === 'lava' ? 22 : h.type === 'toxic' ? 9 : 14, type: h.type, phase: R(0, 6) });
      }
    }

    // turrets (enemy)
    for (let i = 0; i < lvl.turrets; i++) {
      for (let k = 0; k < 40; k++) {
        const x = R(200, this.W - 200), y = R(200, this.H - 200);
        if (Math.hypot(x - cx, y - cy) < 600) continue;
        const t = { x: x - 20, y: y - 20, w: 40, h: 40 };
        if (overlaps(t.x, t.y, t.w, t.h, 0)) continue;
        this.spawnEnemy('turret', x, y);
        break;
      }
    }

    // vehicles
    lvl.vehicles.forEach((v, i) => {
      for (let k = 0; k < 60; k++) {
        const a = R(0, Math.PI * 2);
        const d = 350 + i * 120 + R(0, 200);
        const x = clamp(cx + Math.cos(a) * d, 100, this.W - 100), y = clamp(cy + Math.sin(a) * d, 100, this.H - 100);
        if (overlaps(x - 50, y - 50, 100, 100, 0)) continue;
        this.spawnVehicle(v, x, y);
        break;
      }
    });

    // initial pickups
    for (let i = 0; i < 12; i++) {
      const x = R(120, this.W - 120), y = R(120, this.H - 120);
      if (overlaps(x - 15, y - 15, 30, 30, 0)) continue;
      const t = i % 4;
      this.pickups.push({ x, y, type: t === 0 ? 'hp' : t === 1 ? 'ammo' : t === 2 ? 'coin' : 'weapon', val: t === 0 ? 30 : t === 2 ? 20 : 1, wid: this.randWeapon(), t: 0, life: 1e9 });
    }
    this.buildGround(rng);
  }

  randWeapon(): WeaponId {
    return WEAPON_ORDER[1 + Math.floor(Math.random() * (WEAPON_ORDER.length - 1))];
  }

  buildGround(rng: () => number) {
    const th = this.lvl.theme;
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    const g = c.getContext('2d')!;
    const R = (a: number, b: number) => a + rng() * (b - a);
    g.fillStyle = th.bg; g.fillRect(0, 0, this.W, this.H);
    // checker tiles
    g.fillStyle = th.bg2;
    for (let x = 0; x < this.W; x += 160) for (let y = 0; y < this.H; y += 160) if (((x + y) / 160) % 2 === 0) g.fillRect(x, y, 160, 160);
    g.strokeStyle = th.grid; g.lineWidth = 1;
    for (let x = 0; x <= this.W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, this.H); g.stroke(); }
    for (let y = 0; y <= this.H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(this.W, y); g.stroke(); }
    const N = Math.floor((this.W * this.H) / 30000);
    const accent = th.accent;
    switch (th.decor) {
      case 'desert':
        for (let i = 0; i < N; i++) { g.fillStyle = `rgba(255,215,140,${R(0.03, 0.08)})`; g.beginPath(); g.ellipse(R(0, this.W), R(0, this.H), R(40, 140), R(15, 50), R(-0.3, 0.3), 0, 7); g.fill(); }
        for (let i = 0; i < N * 3; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(R(0, this.W), R(0, this.H), R(2, 6), R(2, 5)); }
        break;
      case 'swamp':
        for (let i = 0; i < N; i++) { g.fillStyle = 'rgba(0,20,0,0.35)'; g.beginPath(); g.ellipse(R(0, this.W), R(0, this.H), R(30, 110), R(20, 70), R(0, 3), 0, 7); g.fill(); }
        for (let i = 0; i < N * 5; i++) { g.fillStyle = `rgba(120,255,100,${R(0.1, 0.3)})`; g.fillRect(R(0, this.W), R(0, this.H), 2, R(4, 10)); }
        break;
      case 'ice':
        for (let i = 0; i < N; i++) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.ellipse(R(0, this.W), R(0, this.H), R(40, 120), R(25, 70), R(0, 3), 0, 7); g.fill(); }
        g.strokeStyle = 'rgba(200,240,255,0.15)';
        for (let i = 0; i < N * 1.5; i++) { let x = R(0, this.W), y = R(0, this.H); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += R(-40, 40); y += R(-40, 40); g.lineTo(x, y); } g.stroke(); }
        break;
      case 'city':
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (let y = 320; y < this.H; y += 640) g.fillRect(0, y, this.W, 120);
        for (let x = 400; x < this.W; x += 800) g.fillRect(x, 0, 120, this.H);
        g.strokeStyle = accent; g.globalAlpha = 0.25; g.setLineDash([30, 24]); g.lineWidth = 3;
        for (let y = 320; y < this.H; y += 640) { g.beginPath(); g.moveTo(0, y + 60); g.lineTo(this.W, y + 60); g.stroke(); }
        for (let x = 400; x < this.W; x += 800) { g.beginPath(); g.moveTo(x + 60, 0); g.lineTo(x + 60, this.H); g.stroke(); }
        g.setLineDash([]); g.globalAlpha = 1;
        for (let i = 0; i < N; i++) { g.fillStyle = `rgba(80,220,255,${R(0.05, 0.12)})`; g.fillRect(R(0, this.W), R(0, this.H), R(10, 60), 3); }
        break;
      case 'lava':
        g.strokeStyle = 'rgba(255,110,30,0.35)'; g.lineWidth = 2;
        for (let i = 0; i < N * 1.5; i++) { let x = R(0, this.W), y = R(0, this.H); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += R(-50, 50); y += R(-50, 50); g.lineTo(x, y); } g.stroke(); }
        for (let i = 0; i < N; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(R(0, this.W), R(0, this.H), R(10, 60), 0, 7); g.fill(); }
        break;
      case 'space':
        g.strokeStyle = 'rgba(120,200,255,0.12)'; g.lineWidth = 2;
        for (let x = 0; x < this.W; x += 320) for (let y = 0; y < this.H; y += 320) g.strokeRect(x + 6, y + 6, 308, 308);
        g.fillStyle = 'rgba(150,220,255,0.25)';
        for (let x = 0; x < this.W; x += 320) for (let y = 0; y < this.H; y += 320) { g.fillRect(x + 12, y + 12, 4, 4); g.fillRect(x + 300, y + 12, 4, 4); g.fillRect(x + 12, y + 300, 4, 4); g.fillRect(x + 300, y + 300, 4, 4); }
        g.fillStyle = 'rgba(255,200,0,0.06)';
        for (let i = 0; i < N / 2; i++) g.fillRect(R(0, this.W), R(0, this.H), 120, 24);
        break;
      case 'ruins':
        for (let i = 0; i < N * 5; i++) { g.fillStyle = `rgba(${R(60, 140) | 0},${R(60, 130) | 0},${R(60, 120) | 0},0.35)`; g.fillRect(R(0, this.W), R(0, this.H), R(2, 8), R(2, 8)); }
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2;
        for (let i = 0; i < N; i++) { let x = R(0, this.W), y = R(0, this.H); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += R(-35, 35); y += R(-35, 35); g.lineTo(x, y); } g.stroke(); }
        g.fillStyle = 'rgba(255,210,70,0.08)';
        for (let y = 400; y < this.H; y += 700) for (let x = 0; x < this.W; x += 120) g.fillRect(x, y, 60, 6);
        break;
      case 'core':
        g.strokeStyle = 'rgba(255,40,90,0.3)'; g.lineWidth = 2;
        for (let i = 0; i < N * 1.2; i++) { let x = R(0, this.W), y = R(0, this.H); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { if (k % 2) x += R(-120, 120); else y += R(-120, 120); g.lineTo(x, y); } g.stroke(); g.fillStyle = 'rgba(255,60,100,0.5)'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
        break;
    }
    // world border
    g.strokeStyle = th.accent; g.globalAlpha = 0.5; g.lineWidth = 8; g.strokeRect(4, 4, this.W - 8, this.H - 8); g.globalAlpha = 1;
    this.ground = c;
  }

  // ---------------- init ----------------
  mult() { return this.save.upgrades; }
  cap(id: WeaponId) { return Math.round(WEAPONS[id].reserve * (1 + 0.2 * this.save.upgrades.ammo)); }
  cdMult() { return 1 - 0.08 * this.save.upgrades.cooldown; }

  initPlayer() {
    const up = this.save.upgrades;
    const hp = Math.round(this.char.hp * (1 + 0.15 * up.health));
    const owned = WEAPON_ORDER.filter(w => this.save.weapons.includes(w) || w === 'pistol');
    this.p = {
      x: this.W / 2, y: this.H / 2, vx: 0, vy: 0, r: 16, hp, maxHp: hp, angle: 0,
      dashT: 0, dashCd: 0, dashDx: 0, dashDy: 0, inv: 0, dashInv: 1.2,
      weapons: owned.map(id => ({ id, mag: WEAPONS[id].mag, reserve: id === 'pistol' ? 9999 : Math.round(this.cap(id) * 0.5) })),
      cur: 0, reloadT: 0, fireCd: 0, skillCd: 0, ult: 25, grenades: 3, grenT: 0, meleeCd: 0, meleeT: 0,
      buffs: { adren: 0, rage: 0, shield: 0, chrono: 0, blades: 0, drones: 0, haz: 0 },
      hitFlash: 0, vehicle: null, dead: false, footT: 0,
    };
    this.cam.x = this.p.x; this.cam.y = this.p.y;
  }

  setBanner(text: string, sub: string, t: number, color = '#fff') {
    this.banner = { text, sub, t, color };
  }

  // ---------------- spawning ----------------
  spawnEnemy(type: EnemyId, x: number, y: number, elite = false): Enemy {
    const def = ENEMIES[type];
    const scale = 1 + 0.22 * this.lvlIdx;
    const hp = def.hp * scale * (elite ? 2.4 : 1);
    const e: Enemy = {
      id: this.nextId++, type, def, x, y, vx: 0, vy: 0, r: def.r * (elite ? 1.2 : 1), hp, maxHp: hp, speed: def.speed * (elite ? 1.05 : 1),
      color: def.color, flying: !!def.flying, dmgMult: 1 + 0.1 * this.lvlIdx + (elite ? 0.3 : 0), cd: rand(0.5, 2), hitCd: 0, state: 0, st: 0, ang: 0, lx: 0, ly: 0,
      flash: 0, burn: 0, slow: 0, stun: 0, freeze: 0, kbx: 0, kby: 0, side: Math.random() < 0.5 ? -1 : 1, sideT: 0, rammed: 0, bladeCd: 0, shots: 0,
      elite, dead: false, strafe: Math.random() < 0.5 ? -1 : 1, t: rand(0, 6), burnTick: 0,
    };
    this.enemies.push(e);
    return e;
  }

  spawnBoss() {
    const d = this.lvl.boss;
    const p = this.p;
    let x = this.W / 2, y = this.H / 2;
    for (let k = 0; k < 30; k++) {
      const a = rand(0, Math.PI * 2);
      x = clamp(p.x + Math.cos(a) * 650, 100, this.W - 100);
      y = clamp(p.y + Math.sin(a) * 650, 100, this.H - 100);
      if (Math.hypot(x - p.x, y - p.y) > 450) break;
    }
    const scale = 1;
    const def: EnemyDef = { id: 'grunt', name: d.name, hp: d.hp, speed: d.speed, r: d.r, color: d.color, score: 1000, credits: 0, dmg: 20 };
    const e: Enemy = {
      id: this.nextId++, type: 'boss', def, x, y, vx: 0, vy: 0, r: d.r, hp: d.hp * scale, maxHp: d.hp * scale, speed: d.speed, color: d.color, flying: true,
      dmgMult: 1 + 0.09 * this.lvlIdx, cd: 1, hitCd: 0, state: 0, st: 0, ang: 0, lx: 0, ly: 0, flash: 0, burn: 0, slow: 0, stun: 0, freeze: 0, kbx: 0, kby: 0,
      side: 1, sideT: 0, rammed: 0, bladeCd: 0, shots: 0, elite: false, dead: false, strafe: 1, t: 0, burnTick: 0,
      boss: { def: d, act: null, actT: 0, actDur: 0, pcd: 2.2, fired: 0, sweepA: 0, lockA: 0, lastTick: 0, sweepDir: 1 },
    };
    this.enemies.push(e);
    this.boss = e;
    this.bossSpawned = true;
    this.setBanner('⚠ WARNING ⚠', `${d.name} — ${d.title}`, 3.5, '#ff4a4a');
    sfx('boss');
    this.shake = 14;
    this.flashScreen = { t: 0.5, color: '#ff0000' };
  }

  spawnVehicle(id: VehicleId, x: number, y: number) {
    const def = VEHICLES[id];
    this.vehicles.push({ def, x, y, vx: 0, vy: 0, angle: -Math.PI / 2, aim: -Math.PI / 2, hp: def.hp, maxHp: def.hp, r: def.r, fireCd: 0, boost: 0, boostCd: 0, occupied: false, dead: false, flash: 0, shots: 0, t: rand(0, 5) });
  }

  freePoint(minD: number, maxD: number, r: number): { x: number; y: number } | null {
    const p = this.p;
    for (let k = 0; k < 20; k++) {
      const a = rand(0, Math.PI * 2), d = rand(minD, maxD);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (x < 60 || y < 60 || x > this.W - 60 || y > this.H - 60) continue;
      let ok = true;
      for (const o of this.obs) if (o.alive && x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h) { ok = false; break; }
      if (ok) return { x, y };
    }
    return null;
  }

  // ---------------- damage ----------------
  pdmg(base: number, wid?: WeaponId) {
    const b = this.p.buffs;
    let d = base * (1 + 0.1 * this.save.upgrades.damage) * (b.rage > 0 ? 2 : 1);
    if (wid && this.char.mods.dmg && this.char.mods.dmg[wid]) d *= this.char.mods.dmg[wid]!;
    const crit = Math.random() < this.char.crit;
    if (crit) d *= 2;
    return { d, crit };
  }

  hurtEnemy(e: Enemy, dmg: number, o: { crit?: boolean; burn?: number; slow?: number; shock?: number; kx?: number; ky?: number; silent?: boolean } = {}) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.08;
    this.dmgDealt += dmg;
    if (!o.silent) this.text(e.x + rand(-8, 8), e.y - e.r - 6, String(Math.round(dmg)), o.crit ? '#ffe14a' : '#ffffff', o.crit ? 20 : 14);
    if (o.burn) e.burn = Math.max(e.burn, o.burn);
    if (o.slow) e.slow = Math.max(e.slow, o.slow);
    if (o.shock && e.type !== 'boss') e.stun = Math.max(e.stun, o.shock);
    if (o.kx !== undefined && e.type !== 'boss' && e.type !== 'turret') {
      const m = 14 / e.r;
      e.kbx += o.kx * m; e.kby += (o.ky || 0) * m;
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy, quiet = false) {
    if (e.dead) return;
    e.dead = true;
    const isBoss = e.type === 'boss';
    this.burst(e.x, e.y, isBoss ? 60 : 14, isBoss ? 400 : 180, 0.6, isBoss ? 7 : 4, e.color);
    if (!quiet) {
      this.kills += isBoss ? 0 : 1;
      this.combo++;
      this.comboT = 3;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const m = 1 + Math.min(3, Math.floor(this.combo / 5) * 0.5);
      this.score += Math.round(e.def.score * m * (e.elite ? 3 : 1));
      this.addUlt(isBoss ? 40 : e.elite ? 12 : 5);
      if (e.type !== 'boss') {
        const cr = Math.round(e.def.credits * (1 + this.lvlIdx * 0.12) * (e.elite ? 3 : 1));
        this.pickups.push({ x: e.x, y: e.y, type: 'coin', val: cr, t: 0, life: 18 });
        const r = Math.random();
        if (r < 0.1) this.pickups.push({ x: e.x + 10, y: e.y, type: 'hp', val: 25, t: 0, life: 18 });
        else if (r < 0.26) this.pickups.push({ x: e.x - 10, y: e.y, type: 'ammo', val: 1, t: 0, life: 18 });
        else if (r < 0.3) this.pickups.push({ x: e.x, y: e.y + 10, type: 'weapon', val: 1, wid: this.randWeapon(), t: 0, life: 22 });
        else if (r < 0.34) this.pickups.push({ x: e.x, y: e.y - 10, type: 'ult', val: 15, t: 0, life: 18 });
        if (e.elite) { this.pickups.push({ x: e.x + 14, y: e.y, type: 'hp', val: 30, t: 0, life: 20 }); this.pickups.push({ x: e.x - 14, y: e.y, type: 'ammo', val: 1, t: 0, life: 20 }); }
      }
      sfx('hit');
    }
    if (isBoss) {
      this.bossDead = true;
      this.score += 1000 + this.lvlIdx * 250;
      for (let i = 0; i < 14; i++) this.pickups.push({ x: e.x + rand(-60, 60), y: e.y + rand(-60, 60), type: 'coin', val: 40 + this.lvlIdx * 10, t: 0, life: 40 });
      for (let i = 0; i < 6; i++) {
        const k = i;
        this.delayed.push({ t: 0.15 * k, x: e.x + rand(-50, 50), y: e.y + rand(-50, 50), r: 0, color: '#fff', fn: () => { this.explode(e.x + rand(-60, 60), e.y + rand(-60, 60), 140, 0, 'player'); } });
      }
      sfx('bigExplosion');
      this.shake = 24;
      this.flashScreen = { t: 0.6, color: '#ffffff' };
      // wipe remaining enemies
      for (const o of this.enemies) if (o !== e && !o.dead) { o.hp = 0; o.dead = true; this.burst(o.x, o.y, 10, 160, 0.5, 4, o.color); }
      this.endTimer = 3.2;
      this.setBanner('MISSION COMPLETE', `${e.boss!.def.name} DESTROYED`, 4, '#7cff7c');
      sfx('win');
    }
  }

  hurtPlayer(d: number, o: { cont?: boolean } = {}) {
    const p = this.p;
    if (p.dead || p.dashInv > 0 || this.endTimer > 0 && this.bossDead) return;
    if (!o.cont && p.inv > 0) return;
    if (p.buffs.shield > 0) { p.hitFlash = 0.05; return; }
    if (p.vehicle) {
      const v = p.vehicle;
      v.hp -= d; v.flash = 0.1;
      if (!o.cont) { p.inv = 0.08; this.shake = Math.max(this.shake, 4); sfx('hit'); }
      if (v.hp <= 0) this.destroyVehicle(v);
      return;
    }
    p.hp -= d;
    p.hitFlash = 0.15;
    if (!o.cont) {
      p.inv = 0.1;
      this.shake = Math.max(this.shake, 5);
      sfx('hurt');
      this.text(p.x, p.y - 26, '-' + Math.round(d), '#ff5a5a', 16);
    }
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true;
      this.burst(p.x, p.y, 40, 300, 0.8, 5, this.char.color);
      this.explode(p.x, p.y, 120, 0, 'player');
      this.endTimer = 1.8;
      this.setBanner('MISSION FAILED', 'You were eliminated', 4, '#ff4a4a');
      sfx('lose');
    }
  }

  destroyVehicle(v: Vehicle) {
    if (v.dead) return;
    v.dead = true;
    this.explode(v.x, v.y, 150, 70 * (1 + 0.1 * this.save.upgrades.damage), 'player');
    this.burst(v.x, v.y, 30, 300, 0.8, 5, '#ffa040');
    if (v.occupied) {
      const p = this.p;
      p.vehicle = null; v.occupied = false;
      p.dashInv = 1.5;
      this.setBanner('VEHICLE DESTROYED', '', 1.2, '#ffa040');
    }
  }

  damageObstacle(o: Obstacle, dmg: number) {
    if (!o.alive || o.kind === 'wall') return;
    o.hp -= dmg; o.flash = 0.1;
    if (o.hp <= 0) {
      o.alive = false;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      if (o.kind === 'barrel') {
        this.explode(cx, cy, 130, 55, 'neutral');
      } else {
        this.burst(cx, cy, 12, 160, 0.5, 4, this.lvl.theme.crate);
        if (Math.random() < 0.55) {
          const r = Math.random();
          this.pickups.push({ x: cx, y: cy, type: r < 0.3 ? 'hp' : r < 0.65 ? 'ammo' : r < 0.9 ? 'coin' : 'weapon', val: r < 0.3 ? 25 : r < 0.9 ? 15 : 1, wid: this.randWeapon(), t: 0, life: 25 });
        }
      }
    }
  }

  explode(x: number, y: number, r: number, dmg: number, mode: 'player' | 'enemy' | 'neutral') {
    const em = mode === 'player' ? (this.char.mods.expl || 1) : 1;
    r *= em; dmg *= em;
    this.booms.push({ x, y, r, t: 0, max: 0.45, color: mode === 'enemy' ? '#ff4a6a' : '#ffa040' });
    this.burst(x, y, 22, r * 2.2, 0.6, 5, '#ffb050');
    this.burst(x, y, 10, r * 1.2, 0.8, 8, '#555555');
    sfx(r > 130 ? 'bigExplosion' : 'explosion');
    const dp = Math.hypot(x - this.p.x, y - this.p.y);
    this.shake = Math.max(this.shake, clamp(18 - dp / 40, 0, 14) * (r / 120));
    if (dmg > 0) {
      if (mode !== 'enemy') {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - x, e.y - y);
          if (d < r + e.r) {
            const f = 1 - 0.5 * clamp(d / (r + e.r), 0, 1);
            const nx = (e.x - x) / (d || 1), ny = (e.y - y) / (d || 1);
            this.hurtEnemy(e, dmg * f, { kx: nx * 500, ky: ny * 500, burn: 2 });
          }
        }
      }
      if (mode !== 'player') {
        const pr = this.p.vehicle ? this.p.vehicle.r : this.p.r;
        if (dp < r + pr) this.hurtPlayer(dmg * (1 - 0.5 * clamp(dp / (r + pr), 0, 1)));
      }
      for (const o of this.obs) {
        if (!o.alive || o.kind === 'wall') continue;
        const d = Math.hypot(o.x + o.w / 2 - x, o.y + o.h / 2 - y);
        if (d < r) this.damageObstacle(o, dmg);
      }
      if (mode === 'neutral') for (const v of this.vehicles) if (!v.dead && Math.hypot(v.x - x, v.y - y) < r + v.r) { v.hp -= dmg * 0.6; if (v.hp <= 0) this.destroyVehicle(v); }
    }
  }

  // ---------------- fx helpers ----------------
  part(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, drag = 2, glow = true, grow = 0) {
    if (this.parts.length > 1100) return;
    this.parts.push({ x, y, vx, vy, life, max: life, size, color, drag, glow, grow });
  }
  burst(x: number, y: number, n: number, speed: number, life: number, size: number, color: string) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.2, 1) * speed;
      this.part(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 1) * life, rand(0.5, 1) * size, color);
    }
  }
  text(x: number, y: number, s: string, color: string, size: number) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, s, color, size, t: 0.8 });
  }
  addUlt(n: number) {
    this.p.ult = Math.min(100, this.p.ult + n * (1 + 0.12 * this.save.upgrades.cooldown));
  }

  // ---------------- geometry ----------------
  moveCircle(e: { x: number; y: number; r: number }, dx: number, dy: number, ram = false): boolean {
    e.x += dx; e.y += dy;
    let hit = false;
    for (const o of this.obs) {
      if (!o.alive) continue;
      if (e.x + e.r < o.x || e.x - e.r > o.x + o.w || e.y + e.r < o.y || e.y - e.r > o.y + o.h) continue;
      const cx = clamp(e.x, o.x, o.x + o.w), cy = clamp(e.y, o.y, o.y + o.h);
      const ddx = e.x - cx, ddy = e.y - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 >= e.r * e.r) continue;
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        e.x += (ddx / d) * (e.r - d); e.y += (ddy / d) * (e.r - d);
      } else {
        const l = e.x - o.x, rr = o.x + o.w - e.x, t = e.y - o.y, b = o.y + o.h - e.y;
        const m = Math.min(l, rr, t, b);
        if (m === l) e.x = o.x - e.r; else if (m === rr) e.x = o.x + o.w + e.r; else if (m === t) e.y = o.y - e.r; else e.y = o.y + o.h + e.r;
      }
      if (ram && o.kind !== 'wall') this.damageObstacle(o, 60);
    }
    e.x = clamp(e.x, e.r, this.W - e.r);
    e.y = clamp(e.y, e.r, this.H - e.r);
    return hit;
  }

  segRect(x1: number, y1: number, x2: number, y2: number, o: Obstacle): number | null {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const ps = [-dx, dx, -dy, dy];
    const qs = [x1 - o.x, o.x + o.w - x1, y1 - o.y, o.y + o.h - y1];
    for (let i = 0; i < 4; i++) {
      if (ps[i] === 0) { if (qs[i] < 0) return null; }
      else {
        const t = qs[i] / ps[i];
        if (ps[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
        else { if (t < t0) return null; if (t < t1) t1 = t; }
      }
    }
    return t0;
  }

  hasLOS(x1: number, y1: number, x2: number, y2: number) {
    for (const o of this.obs) if (o.alive && this.segRect(x1, y1, x2, y2, o) !== null) return false;
    return true;
  }

  nearestEnemy(x: number, y: number, maxD: number, skip?: Set<number>): Enemy | null {
    let best: Enemy | null = null, bd = maxD;
    for (const e of this.enemies) {
      if (e.dead || (skip && skip.has(e.id))) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------------- bullets ----------------
  mkBullet(o: Partial<Bullet> & { x: number; y: number; vx: number; vy: number; friendly: boolean }) {
    const b: Bullet = {
      r: 3, dmg: 10, life: 1, maxLife: o.life ?? 1, color: '#fff', pierce: 1, explode: 0, kind: 'bullet', homing: 0, burn: 0, slow: 0, shock: 0, crit: false, hit: new Set<number>(), grow: 0,
      ...o,
    } as Bullet;
    b.maxLife = b.life;
    this.bullets.push(b);
    return b;
  }

  ebullet(x: number, y: number, ang: number, speed: number, dmg: number, r = 5, color = '#ff5a5a', homing = 0, life = 4, explode = 0) {
    this.mkBullet({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, friendly: false, dmg, r, color, homing, life, explode, kind: 'enemy' });
  }

  // ---------------- player weapons ----------------
  selectWeapon(i: number) {
    const p = this.p;
    if (i < 0 || i >= p.weapons.length || i === p.cur) return;
    p.cur = i; p.reloadT = 0; p.fireCd = 0.15;
    sfx('click');
  }

  startReload() {
    const p = this.p, s = p.weapons[p.cur], w = WEAPONS[s.id];
    if (p.reloadT > 0 || s.mag >= w.mag || s.reserve <= 0) return;
    p.reloadT = w.reload * (p.buffs.rage > 0 ? 0.3 : 1);
    sfx('reload');
  }

  giveWeapon(id: WeaponId) {
    const p = this.p;
    const ex = p.weapons.find(w => w.id === id);
    if (ex) { ex.reserve = Math.min(this.cap(id), ex.reserve + Math.round(this.cap(id) * 0.5)); return; }
    const curId = p.weapons[p.cur].id;
    p.weapons.push({ id, mag: WEAPONS[id].mag, reserve: Math.round(this.cap(id) * 0.6) });
    p.weapons.sort((a, b) => WEAPON_ORDER.indexOf(a.id) - WEAPON_ORDER.indexOf(b.id));
    p.cur = p.weapons.findIndex(w => w.id === curId);
  }

  firePlayerWeapon() {
    const p = this.p;
    const slot = p.weapons[p.cur], w = WEAPONS[slot.id];
    if (p.reloadT > 0 || p.fireCd > 0) return;
    if (slot.mag <= 0) { this.startReload(); return; }
    const rm = (p.buffs.adren > 0 ? 1.5 : 1) * (p.buffs.chrono > 0 && this.char.id === 'vex' ? 1.25 : 1);
    p.fireCd = 1 / (w.rate * rm);
    if (p.buffs.rage <= 0) slot.mag--;
    const a = p.angle;
    const ox = p.x + Math.cos(a) * (p.r + 14), oy = p.y + Math.sin(a) * (p.r + 14);
    this.fireWeapon(slot.id, ox, oy, a);
    sfx(w.id);
    this.shake = Math.max(this.shake, w.shake);
    if (w.id !== 'flame') this.part(ox, oy, Math.cos(a) * 120, Math.sin(a) * 120, 0.12, 8, w.color, 4);
  }

  fireWeapon(id: WeaponId, ox: number, oy: number, a: number) {
    const w = WEAPONS[id];
    switch (w.kind) {
      case 'rail': this.fireRail(ox, oy, a); return;
      case 'arc': this.fireArc(ox, oy, a); return;
    }
    for (let i = 0; i < w.pellets; i++) {
      const ang = a + (Math.random() - 0.5) * 2 * w.spread;
      const sp = w.speed * (w.kind === 'flame' ? rand(0.75, 1.15) : w.kind === 'shell' ? rand(0.9, 1.1) : 1);
      const { d, crit } = this.pdmg(w.dmg, id);
      const b = this.mkBullet({
        x: ox, y: oy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, friendly: true, dmg: d, crit, life: w.life * (w.kind === 'shell' ? rand(0.8, 1.1) : 1),
        color: w.color, r: w.size, pierce: w.pierce, explode: w.explode, kind: w.kind,
        burn: w.kind === 'flame' ? 3 : 0, slow: w.kind === 'plasma' ? 1.6 : 0, grow: w.kind === 'flame' ? 22 : 0,
      });
      if (w.kind === 'rocket') b.homing = 0;
    }
  }

  fireRail(ox: number, oy: number, a: number, dmgBase = WEAPONS.rail.dmg) {
    const len = 1600;
    const ex = ox + Math.cos(a) * len, ey = oy + Math.sin(a) * len;
    let wallT = 1;
    for (const o of this.obs) if (o.alive && o.kind === 'wall') { const t = this.segRect(ox, oy, ex, ey, o); if (t !== null && t < wallT) wallT = t; }
    const fx = ox + (ex - ox) * wallT, fy = oy + (ey - oy) * wallT;
    for (const o of this.obs) if (o.alive && o.kind !== 'wall') { const t = this.segRect(ox, oy, ex, ey, o); if (t !== null && t <= wallT) this.damageObstacle(o, 100); }
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (distPointSeg(e.x, e.y, ox, oy, fx, fy) < e.r + 6) {
        const { d, crit } = this.pdmg(dmgBase, 'rail');
        this.hurtEnemy(e, d, { crit, kx: Math.cos(a) * 300, ky: Math.sin(a) * 300 });
      }
    }
    this.beams.push({ pts: [{ x: ox, y: oy }, { x: fx, y: fy }], t: 0.3, max: 0.3, color: '#bfefff', w: 7 });
    this.burst(fx, fy, 10, 200, 0.4, 4, '#bfefff');
  }

  fireArc(ox: number, oy: number, a: number) {
    const skip = new Set<number>();
    let first: Enemy | null = null, bd = 520;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - ox, e.y - oy);
      if (d < bd && (Math.abs(angDiff(Math.atan2(e.y - oy, e.x - ox), a)) < 0.55 || d < 90)) { bd = d; first = e; }
    }
    const pts: { x: number; y: number }[] = [{ x: ox, y: oy }];
    let cur = first, cx = ox, cy = oy;
    const jag = (x1: number, y1: number, x2: number, y2: number) => {
      const n = 4;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        pts.push({ x: lerp(x1, x2, t) + rand(-12, 12), y: lerp(y1, y2, t) + rand(-12, 12) });
      }
      pts.push({ x: x2, y: y2 });
    };
    let count = 0;
    while (cur && count < 5) {
      skip.add(cur.id);
      jag(cx, cy, cur.x, cur.y);
      const { d, crit } = this.pdmg(WEAPONS.arc.dmg * (1 - count * 0.08), 'arc');
      this.hurtEnemy(cur, d, { crit, shock: 0.35 });
      cx = cur.x; cy = cur.y;
      cur = this.nearestEnemy(cx, cy, 230, skip);
      count++;
    }
    if (count === 0) jag(ox, oy, ox + Math.cos(a) * 200, oy + Math.sin(a) * 200);
    this.beams.push({ pts, t: 0.14, max: 0.14, color: '#d4b8ff', w: 3 });
  }

  // ---------------- vehicles ----------------
  fireVehicle(v: Vehicle) {
    const d = v.def;
    const a = v.aim;
    const ox = v.x + Math.cos(a) * (v.r + 6), oy = v.y + Math.sin(a) * (v.r + 6);
    v.fireCd = 1 / d.fireRate;
    switch (d.id) {
      case 'jeep': {
        const { d: dm, crit } = this.pdmg(d.dmg);
        const ang = a + rand(-0.06, 0.06);
        this.mkBullet({ x: ox, y: oy, vx: Math.cos(ang) * 1000, vy: Math.sin(ang) * 1000, friendly: true, dmg: dm, crit, life: 0.75, color: '#ffe9a8', r: 3.5 });
        sfx('smg'); this.shake = Math.max(this.shake, 1.5);
        break;
      }
      case 'tank': {
        const { d: dm, crit } = this.pdmg(d.dmg);
        this.mkBullet({ x: ox, y: oy, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, friendly: true, dmg: dm, crit, life: 1.4, color: '#ffb050', r: 8, explode: 115, kind: 'rocket' });
        sfx('rocket'); this.shake = Math.max(this.shake, 9);
        break;
      }
      case 'hover': {
        for (const s of [-1, 1]) {
          const { d: dm, crit } = this.pdmg(d.dmg);
          const px = -Math.sin(a) * 11 * s, py = Math.cos(a) * 11 * s;
          const ang = a + rand(-0.03, 0.03);
          this.mkBullet({ x: ox + px, y: oy + py, vx: Math.cos(ang) * 850, vy: Math.sin(ang) * 850, friendly: true, dmg: dm, crit, life: 0.9, color: '#4fd2ff', r: 5, pierce: 2, kind: 'plasma', slow: 1 });
        }
        sfx('plasma');
        break;
      }
      case 'heli': {
        const { d: dm, crit } = this.pdmg(d.dmg);
        const ang = a + rand(-0.08, 0.08);
        this.mkBullet({ x: ox, y: oy, vx: Math.cos(ang) * 1000, vy: Math.sin(ang) * 1000, friendly: true, dmg: dm, crit, life: 0.8, color: '#fff3a0', r: 3.5 });
        v.shots++;
        sfx('smg');
        if (v.shots % 14 === 0) {
          for (const s of [-1, 1]) {
            const { d: dm2 } = this.pdmg(48);
            const ang2 = a + s * 0.35;
            this.mkBullet({ x: v.x, y: v.y, vx: Math.cos(ang2) * 520, vy: Math.sin(ang2) * 520, friendly: true, dmg: dm2, life: 2.2, color: '#ff8a5a', r: 5, explode: 80, kind: 'rocket', homing: 4 });
          }
          sfx('rocket');
        }
        break;
      }
    }
  }

  enterVehicle(v: Vehicle) {
    const p = this.p;
    p.vehicle = v; v.occupied = true;
    p.x = v.x; p.y = v.y; p.vx = p.vy = 0; p.reloadT = 0;
    sfx('enter');
    this.setBanner(v.def.name.toUpperCase(), 'WASD drive • Mouse aim • Click fire • Shift boost • E exit', 2.2, '#4fd2ff');
  }
  exitVehicle() {
    const p = this.p, v = p.vehicle;
    if (!v) return;
    p.vehicle = null; v.occupied = false;
    const a = v.angle + Math.PI / 2;
    p.x = v.x + Math.cos(a) * (v.r + p.r + 6);
    p.y = v.y + Math.sin(a) * (v.r + p.r + 6);
    this.moveCircle(p, 0, 0);
    p.dashInv = 0.5;
    sfx('enter');
  }

  // ---------------- abilities ----------------
  doDash(ix: number, iy: number) {
    const p = this.p;
    if (p.dashCd > 0 || p.dashT > 0) return;
    let dx = ix, dy = iy;
    if (!dx && !dy) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
    const l = Math.hypot(dx, dy) || 1;
    p.dashDx = dx / l; p.dashDy = dy / l;
    p.dashT = 0.18; p.dashInv = 0.28; p.dashCd = 1.1 * this.cdMult();
    sfx('dash');
  }

  useSkill() {
    const p = this.p;
    if (p.skillCd > 0 || p.vehicle || p.dead) return;
    const cd = this.char.skill.cd * this.cdMult();
    switch (this.char.id) {
      case 'ryker':
        p.buffs.adren = 5;
        this.burst(p.x, p.y, 20, 200, 0.5, 4, '#4fb3ff');
        break;
      case 'nova': {
        const dx = this.mouseW.x - p.x, dy = this.mouseW.y - p.y;
        const dist = Math.min(380, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
        const sx = p.x, sy = p.y;
        let travelled = 0;
        while (travelled < dist) {
          const step = Math.min(20, dist - travelled);
          const nx = p.x + Math.cos(a) * step, ny = p.y + Math.sin(a) * step;
          const probe = { x: nx, y: ny, r: p.r };
          if (this.moveCircle(probe, 0, 0)) break;
          p.x = nx; p.y = ny; travelled += step;
        }
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (distPointSeg(e.x, e.y, sx, sy, p.x, p.y) < e.r + 40) this.hurtEnemy(e, this.pdmg(70).d, { kx: Math.cos(a) * 400, ky: Math.sin(a) * 400 });
        }
        this.beams.push({ pts: [{ x: sx, y: sy }, { x: p.x, y: p.y }], t: 0.3, max: 0.3, color: '#ff3df2', w: 10 });
        this.burst(sx, sy, 20, 250, 0.5, 4, '#ff3df2');
        this.burst(p.x, p.y, 20, 250, 0.5, 4, '#ff3df2');
        p.dashInv = 0.35;
        break;
      }
      case 'brick':
        p.buffs.shield = 4;
        break;
      case 'echo': {
        if (this.turrets.length >= 2) this.turrets.shift();
        this.turrets.push({ x: p.x + Math.cos(p.angle) * 40, y: p.y + Math.sin(p.angle) * 40, life: 18, cd: 0.3, ang: p.angle });
        this.burst(p.x, p.y, 14, 150, 0.5, 4, '#3dffb0');
        break;
      }
      case 'vex':
        p.buffs.chrono = 4;
        this.flashScreen = { t: 0.25, color: '#9be8ff' };
        break;
      case 'inferno': {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < 280) this.hurtEnemy(e, this.pdmg(65).d, { burn: 4, kx: ((e.x - p.x) / (d || 1)) * 700, ky: ((e.y - p.y) / (d || 1)) * 700 });
        }
        this.booms.push({ x: p.x, y: p.y, r: 280, t: 0, max: 0.5, color: '#ff7a2a' });
        this.burst(p.x, p.y, 50, 500, 0.7, 7, '#ff7a2a');
        break;
      }
    }
    p.skillCd = cd;
    sfx('skill');
  }

  useUlt() {
    const p = this.p;
    if (p.ult < 100 || p.dead) return;
    p.ult = 0;
    sfx('ult');
    this.flashScreen = { t: 0.3, color: this.char.color };
    this.setBanner(this.char.ult.name.toUpperCase(), '', 1.6, this.char.color);
    switch (this.char.id) {
      case 'ryker': {
        const tx = this.mouseW.x, ty = this.mouseW.y;
        for (let i = 0; i < 12; i++) {
          const a = rand(0, Math.PI * 2), d = rand(0, 230);
          const x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d;
          const dm = this.pdmg(130).d;
          this.delayed.push({ t: 0.5 + i * 0.17, x, y, r: 70, color: '#ff4a4a', fn: () => this.explode(x, y, 100, dm, 'player') });
        }
        break;
      }
      case 'nova': p.buffs.blades = 8; break;
      case 'brick': p.buffs.rage = 8; for (const s of p.weapons) s.mag = WEAPONS[s.id].mag; break;
      case 'echo': p.buffs.drones = 14; break;
      case 'vex':
        this.freezeFx = 1;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < 900) {
            e.freeze = e.type === 'boss' ? 1.5 : 4;
            this.hurtEnemy(e, this.pdmg(e.type === 'boss' ? 150 : 90).d);
          }
        }
        this.bullets = this.bullets.filter(b => b.friendly);
        break;
      case 'inferno': {
        const x = p.x, y = p.y;
        for (let k = 0; k < 9; k++) {
          const inner = k * 60, outer = (k + 1) * 60 + 30;
          this.delayed.push({
            t: k * 0.09, x, y, r: 0, color: '#ff7a2a', fn: () => {
              this.booms.push({ x, y, r: outer, t: 0, max: 0.3, color: '#ff6a1a' });
              for (let i = 0; i < 24; i++) { const a = rand(0, 7); this.part(x + Math.cos(a) * outer, y + Math.sin(a) * outer, Math.cos(a) * 80, Math.sin(a) * 80, 0.6, 9, '#ff8a2a'); }
              for (const e of this.enemies) {
                if (e.dead) continue;
                const d = Math.hypot(e.x - x, e.y - y);
                if (d > inner - e.r && d < outer + e.r) this.hurtEnemy(e, this.pdmg(80).d, { burn: 5, kx: ((e.x - x) / (d || 1)) * 500, ky: ((e.y - y) / (d || 1)) * 500 });
              }
              this.shake = Math.max(this.shake, 8);
            },
          });
        }
        break;
      }
    }
  }

  throwGrenade() {
    const p = this.p;
    if (p.grenades <= 0 || p.dead) return;
    p.grenades--;
    const dx = this.mouseW.x - p.x, dy = this.mouseW.y - p.y;
    const d = Math.min(520, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const T = 0.8;
    this.grenades.push({ x: p.x, y: p.y, vx: (Math.cos(a) * d) / T, vy: (Math.sin(a) * d) / T, t: T, z: 0 });
    sfx('click');
  }

  melee() {
    const p = this.p;
    if (p.meleeCd > 0 || p.vehicle || p.dead) return;
    p.meleeCd = 0.5; p.meleeT = 0.18;
    sfx('melee');
    const a = p.angle, range = 78;
    const dmg = this.pdmg(55).d * (this.char.mods.melee || 1);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < range + e.r && Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), a)) < 1.1) {
        this.hurtEnemy(e, dmg, { kx: Math.cos(a) * 600, ky: Math.sin(a) * 600, shock: 0.4 });
        this.shake = Math.max(this.shake, 4);
      }
    }
    for (const b of this.bullets) {
      if (b.friendly) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < range + 20 && Math.abs(angDiff(Math.atan2(b.y - p.y, b.x - p.x), a)) < 1.3) {
        b.friendly = true; b.vx *= -1.2; b.vy *= -1.2; b.dmg *= 2; b.color = '#7cff7c'; b.life = 1.5; b.hit = new Set();
      }
    }
    for (const o of this.obs) if (o.alive && o.kind !== 'wall') {
      const d = Math.hypot(o.x + o.w / 2 - p.x, o.y + o.h / 2 - p.y);
      if (d < range + 20) this.damageObstacle(o, 40);
    }
    for (let i = 0; i < 8; i++) { const aa = a + (i - 3.5) * 0.25; this.part(p.x + Math.cos(aa) * 50, p.y + Math.sin(aa) * 50, Math.cos(aa) * 160, Math.sin(aa) * 160, 0.2, 5, '#ffffff'); }
  }

  // ---------------- main update ----------------
  update(dt: number) {
    this.time += dt;
    const p = this.p;
    this.hint = Math.max(0, this.hint - dt);

    // mouse world pos
    this.mouseW.x = (this.mouse.x - this.sw / 2) / this.zoom + this.cam.x;
    this.mouseW.y = (this.mouse.y - this.sh / 2) / this.zoom + this.cam.y;
    this.mouse.clickBuf = Math.max(0, this.mouse.clickBuf - dt);

    // timers
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.skillCd = Math.max(0, p.skillCd - dt);
    p.inv = Math.max(0, p.inv - dt);
    p.dashInv = Math.max(0, p.dashInv - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.meleeCd = Math.max(0, p.meleeCd - dt);
    p.meleeT = Math.max(0, p.meleeT - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    for (const k of Object.keys(p.buffs) as (keyof Player['buffs'])[]) p.buffs[k] = Math.max(0, p.buffs[k] - dt);
    if (p.grenades < 3) { p.grenT += dt; if (p.grenT > 14) { p.grenT = 0; p.grenades++; } }
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flashScreen.t = Math.max(0, this.flashScreen.t - dt);
    this.freezeFx = Math.max(0, this.freezeFx - dt * 1.5);
    this.banner.t = Math.max(0, this.banner.t - dt);
    if (!p.dead) this.addUlt(dt * 0.6);

    const edt = dt * (p.buffs.chrono > 0 ? 0.3 : 1);

    if (!p.dead && !this.bossDead) this.handleInput(dt);
    else if (p.vehicle === null) { p.vx *= 0.9; p.vy *= 0.9; }

    // reload
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        const s = p.weapons[p.cur], w = WEAPONS[s.id];
        const need = w.mag - s.mag, take = Math.min(need, s.reserve);
        s.mag += take;
        if (s.id !== 'pistol') s.reserve -= take;
      }
    }

    // delayed
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i];
      d.t -= dt;
      if (d.t <= 0) { this.delayed.splice(i, 1); d.fn(); }
    }

    this.updateSpawns(dt);
    this.updateVehicles(dt);
    this.updateEnemies(dt, edt);
    this.updateBullets(dt, edt);
    this.updateAllies(dt);
    this.updatePickups(dt);
    this.updateHazards(dt);

    // grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.t -= dt;
      g.x += g.vx * dt; g.y += g.vy * dt;
      let blocked = false;
      for (const o of this.obs) if (o.alive && g.x > o.x - 4 && g.x < o.x + o.w + 4 && g.y > o.y - 4 && g.y < o.y + o.h + 4) { blocked = true; break; }
      if (blocked) { g.x -= g.vx * dt * 1.5; g.y -= g.vy * dt * 1.5; g.vx *= -0.3; g.vy *= -0.3; }
      g.z = Math.sin((1 - g.t / 0.8) * Math.PI) * 40;
      if (g.t <= 0) { this.grenades.splice(i, 1); this.explode(g.x, g.y, 125, this.pdmg(110).d, 'player'); }
    }

    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      const f = Math.exp(-q.drag * dt);
      q.vx *= f; q.vy *= f;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.size += q.grow * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t -= dt; t.y -= 40 * dt;
      if (t.t <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) { this.beams[i].t -= dt; if (this.beams[i].t <= 0) this.beams.splice(i, 1); }
    for (let i = this.booms.length - 1; i >= 0; i--) { this.booms[i].t += dt; if (this.booms[i].t >= this.booms[i].max) this.booms.splice(i, 1); }
    for (const o of this.obs) o.flash = Math.max(0, o.flash - dt);

    // camera
    const lead = p.vehicle ? 0.12 : 0.2;
    const tx = p.x + (this.mouseW.x - p.x) * lead, ty = p.y + (this.mouseW.y - p.y) * lead;
    this.cam.x += (tx - this.cam.x) * Math.min(1, 7 * dt);
    this.cam.y += (ty - this.cam.y) * Math.min(1, 7 * dt);
    const hw = this.sw / this.zoom / 2, hh = this.sh / this.zoom / 2;
    this.cam.x = this.W < hw * 2 ? this.W / 2 : clamp(this.cam.x, hw, this.W - hw);
    this.cam.y = this.H < hh * 2 ? this.H / 2 : clamp(this.cam.y, hh, this.H - hh);

    // end handling
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this.ended) {
        this.ended = true;
        this.cb.onEnd({ win: this.bossDead, score: this.score, kills: this.kills, credits: this.creditsGot, time: this.time, levelIdx: this.lvlIdx, damage: this.dmgDealt, bestCombo: this.bestCombo });
      }
    }
    this.pressed.clear();
  }

  handleInput(dt: number) {
    const p = this.p, k = this.keys;
    let ix = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let iy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    const il = Math.hypot(ix, iy);
    if (il > 0) { ix /= il; iy /= il; }
    const pr = this.pressed;
    const v = p.vehicle;

    // aim
    const ox = v ? v.x : p.x, oy = v ? v.y : p.y;
    p.angle = Math.atan2(this.mouseW.y - oy, this.mouseW.x - ox);

    if (pr.has('Space')) this.useUlt();
    if (pr.has('KeyG')) this.throwGrenade();

    // enter / exit vehicle
    if (pr.has('KeyE')) {
      if (v) this.exitVehicle();
      else {
        const nv = this.nearVehicle();
        if (nv) this.enterVehicle(nv);
      }
    }

    if (v && !v.dead) {
      this.driveVehicle(v, ix, iy, dt);
      p.x = v.x; p.y = v.y;
      return;
    }

    // on foot
    if (pr.has('KeyQ')) this.useSkill();
    if (pr.has('KeyV')) this.melee();
    if (pr.has('KeyR')) this.startReload();
    if (pr.has('ShiftLeft') || pr.has('ShiftRight')) this.doDash(ix, iy);
    for (let i = 1; i <= 9; i++) if (pr.has('Digit' + i)) this.selectWeapon(i - 1);

    const up = this.save.upgrades;
    let sp = this.char.speed * (1 + 0.05 * up.speed) * (p.buffs.adren > 0 ? 1.35 : 1) * (p.buffs.rage > 0 ? 1.2 : 1) * (p.buffs.haz > 0 ? 0.6 : 1);
    if (p.reloadT > 0) sp *= 0.92;
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDx * 900; p.vy = p.dashDy * 900;
      this.part(p.x, p.y, 0, 0, 0.3, 14, this.char.color, 1, true, -30);
    } else {
      const f = Math.min(1, 14 * dt);
      p.vx += (ix * sp - p.vx) * f; p.vy += (iy * sp - p.vy) * f;
    }
    this.moveCircle(p, p.vx * dt, p.vy * dt);
    if (Math.hypot(p.vx, p.vy) > 60) { p.footT += dt * 10; }

    // shooting
    const w = WEAPONS[p.weapons[p.cur].id];
    const wantFire = this.mouse.down && (w.auto || this.mouse.clickBuf > 0);
    if (wantFire && p.dashT <= 0) {
      this.firePlayerWeapon();
      if (!w.auto) this.mouse.clickBuf = 0;
    }
    if (p.weapons[p.cur].mag <= 0 && p.reloadT <= 0) this.startReload();
  }

  nearVehicle(): Vehicle | null {
    const p = this.p;
    let best: Vehicle | null = null, bd = 1e9;
    for (const v of this.vehicles) {
      if (v.dead || v.occupied) continue;
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < v.r + p.r + 36 && d < bd) { bd = d; best = v; }
    }
    return best;
  }

  driveVehicle(v: Vehicle, ix: number, iy: number, dt: number) {
    const d = v.def;
    v.boost = Math.max(0, v.boost - dt);
    v.boostCd = Math.max(0, v.boostCd - dt);
    v.fireCd = Math.max(0, v.fireCd - dt);
    v.flash = Math.max(0, v.flash - dt);
    v.t += dt;
    const pr = this.pressed;
    if ((pr.has('ShiftLeft') || pr.has('ShiftRight')) && v.boostCd <= 0) { v.boost = d.boostDur; v.boostCd = d.boostCd + d.boostDur; sfx('dash'); }
    const sp = d.speed * (v.boost > 0 ? d.boostMult : 1);
    const f = Math.min(1, d.accel * dt);
    v.vx += (ix * sp - v.vx) * f; v.vy += (iy * sp - v.vy) * f;
    const speed = Math.hypot(v.vx, v.vy);
    if (speed > 30) {
      const ta = Math.atan2(v.vy, v.vx);
      v.angle += angDiff(ta, v.angle) * Math.min(1, (d.id === 'heli' ? 4 : 8) * dt);
    }
    if (d.flying) { v.x = clamp(v.x + v.vx * dt, v.r, this.W - v.r); v.y = clamp(v.y + v.vy * dt, v.r, this.H - v.r); }
    else {
      const hit = this.moveCircle(v, v.vx * dt, v.vy * dt, speed > 150);
      if (hit) { v.vx *= 0.85; v.vy *= 0.85; }
    }
    v.aim = this.p.angle;
    if (v.boost > 0 || speed > 120) {
      const bx = v.x - (v.vx / (speed || 1)) * v.r, by = v.y - (v.vy / (speed || 1)) * v.r;
      this.part(bx, by, rand(-20, 20), rand(-20, 20), 0.35, d.id === 'hover' ? 7 : 5, d.id === 'hover' ? '#4fd2ff' : d.id === 'heli' ? '#bbbbbb' : '#aaa', 2, d.id === 'hover', -8);
    }
    // ram
    if (d.ram > 0 && speed > 110) {
      for (const e of this.enemies) {
        if (e.dead || e.rammed > 0 || e.type === 'boss' && e.rammed > 0) continue;
        if (Math.hypot(e.x - v.x, e.y - v.y) < e.r + v.r) {
          const dm = d.ram * (1 + 0.1 * this.save.upgrades.damage) * clamp(speed / d.speed, 0.4, 1.6);
          this.hurtEnemy(e, dm, { kx: (v.vx / speed) * 900, ky: (v.vy / speed) * 900, shock: 0.3 });
          e.rammed = 0.4;
          this.shake = Math.max(this.shake, 5);
          sfx('hit');
        }
      }
    }
    if (this.mouse.down && v.fireCd <= 0) this.fireVehicle(v);
  }

  // ---------------- spawns / director ----------------
  updateSpawns(dt: number) {
    const p = this.p;
    if (p.dead || this.bossDead) return;
    const alive = this.enemies.filter(e => !e.dead && e.type !== 'turret').length;
    if (!this.bossSpawned && this.kills >= this.lvl.goal && this.time > 2) {
      this.spawnBoss();
    }
    const cap = this.bossSpawned ? 8 + this.lvlIdx : 12 + this.lvlIdx * 2.5;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && alive < cap && this.time > 1.5) {
      const prog = this.kills / this.lvl.goal;
      const pack = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 3) : 1;
      for (let i = 0; i < pack; i++) {
        const pt = this.freePoint(650, 950, 24);
        if (pt) {
          const type = pick(this.lvl.enemies);
          const elite = prog > 0.4 && Math.random() < 0.07 && type !== 'drone';
          this.spawnEnemy(type, pt.x + rand(-30, 30), pt.y + rand(-30, 30), elite);
        }
      }
      this.spawnT = (this.bossSpawned ? 3.5 : rand(0.9, 1.7)) * (1 - 0.3 * Math.min(1, prog));
    }
    // vehicle supply drop
    if (!this.vehicles.some(v => !v.dead)) {
      this.vehicleDropT += dt;
      if (this.vehicleDropT > 40) {
        const pt = this.freePoint(250, 420, 50);
        if (pt) {
          const id = this.lvl.vehicles[Math.floor(Math.random() * this.lvl.vehicles.length)];
          this.spawnVehicle(id, pt.x, pt.y);
          this.vehicleDropT = 0;
          this.setBanner('SUPPLY DROP', `${VEHICLES[id].name} deployed nearby`, 2.5, '#4fd2ff');
          this.burst(pt.x, pt.y, 30, 300, 0.8, 5, '#4fd2ff');
        }
      }
    } else this.vehicleDropT = 0;
  }

  updateVehicles(dt: number) {
    for (const v of this.vehicles) {
      if (v.dead || v.occupied) {
        continue;
      }
      v.vx *= Math.exp(-3 * dt); v.vy *= Math.exp(-3 * dt);
      v.t += dt; v.flash = Math.max(0, v.flash - dt);
    }
    this.vehicles = this.vehicles.filter(v => !v.dead);
  }

  // ---------------- enemies ----------------
  steer(e: Enemy, mx: number, my: number, mult: number, dt: number) {
    let ax = mx, ay = my;
    if (e.sideT > 0 && !e.flying) {
      e.sideT -= dt;
      const c = Math.cos(1.2 * e.side), s = Math.sin(1.2 * e.side);
      ax = mx * c - my * s; ay = mx * s + my * c;
    }
    const sp = e.speed * mult * (e.slow > 0 ? 0.5 : 1);
    const f = Math.min(1, 8 * dt);
    e.vx += (ax * sp - e.vx) * f; e.vy += (ay * sp - e.vy) * f;
    const mx2 = (e.vx + e.kbx) * dt, my2 = (e.vy + e.kby) * dt;
    if (e.flying) { e.x = clamp(e.x + mx2, e.r, this.W - e.r); e.y = clamp(e.y + my2, e.r, this.H - e.r); }
    else {
      const hit = this.moveCircle(e, mx2, my2);
      if (hit && e.sideT <= 0) { e.sideT = 0.7; e.side = Math.random() < 0.5 ? -1 : 1; }
    }
  }

  updateEnemies(dt: number, edt: number) {
    const p = this.p;
    const pr = p.vehicle ? p.vehicle.r : p.r;
    for (const e of this.enemies) {
      if (e.dead) continue;
      // statuses (real time)
      e.flash = Math.max(0, e.flash - dt);
      e.rammed = Math.max(0, e.rammed - dt);
      e.bladeCd = Math.max(0, e.bladeCd - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.stun = Math.max(0, e.stun - dt);
      if (e.burn > 0) {
        e.burn -= dt;
        e.burnTick -= dt;
        const dps = 9 + this.lvlIdx * 1.5;
        this.hurtEnemy(e, dps * dt * (e.type === 'boss' ? 0.5 : 1), { silent: true });
        if (e.burnTick <= 0) { e.burnTick = 0.12; this.part(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), 0, -40, 0.4, 5, '#ff8a2a'); }
        if (e.dead) continue;
      }
      if (e.freeze > 0) { e.freeze -= dt; e.vx = e.vy = 0; continue; }
      if (e.stun > 0) { e.kbx *= Math.exp(-7 * dt); e.kby *= Math.exp(-7 * dt); this.moveCircle(e, e.kbx * dt, e.kby * dt); continue; }
      e.t += edt;
      e.hitCd = Math.max(0, e.hitCd - edt);
      e.cd -= edt;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      if (e.state === 0) e.ang = Math.atan2(dy, dx);

      switch (e.type) {
        case 'grunt':
          this.steer(e, nx, ny, 1, edt);
          if (d < e.r + pr + 3 && e.hitCd <= 0) { e.hitCd = 0.8; this.hurtPlayer(e.def.dmg * e.dmgMult); }
          break;
        case 'gunner': {
          let mx = 0, my = 0;
          if (d > 380) { mx = nx; my = ny; } else if (d < 230) { mx = -nx; my = -ny; } else { mx = -ny * e.strafe; my = nx * e.strafe; }
          this.steer(e, mx, my, 1, edt);
          if (d < 560 && e.cd <= 0 && this.hasLOS(e.x, e.y, p.x, p.y)) {
            e.cd = rand(1, 1.6);
            this.ebullet(e.x + nx * 18, e.y + ny * 18, e.ang + rand(-0.08, 0.08), 400, e.def.dmg * e.dmgMult, 5, '#ff9a3d');
            sfx('enemyShot');
          }
          if (Math.random() < 0.004) e.strafe *= -1;
          break;
        }
        case 'runner':
          this.steer(e, nx, ny, 1, edt);
          if (d < e.r + pr + 6) {
            this.explode(e.x, e.y, 85, e.def.dmg * e.dmgMult, 'enemy');
            this.killEnemy(e, true);
          }
          break;
        case 'brute': {
          if (e.state === 0) {
            this.steer(e, nx, ny, 1, edt);
            if (d < 420 && d > 120 && e.cd <= 0) { e.state = 1; e.st = 0.6; e.lx = nx; e.ly = ny; }
          } else if (e.state === 1) {
            e.st -= edt; e.vx *= 0.8; e.vy *= 0.8;
            e.lx = nx; e.ly = ny;
            if (e.st <= 0) { e.state = 2; e.st = 0.75; }
          } else {
            e.st -= edt;
            e.vx = e.lx * 470; e.vy = e.ly * 470;
            const hit = this.moveCircle(e, e.vx * dt, e.vy * dt);
            if (hit || e.st <= 0) { e.state = 0; e.cd = rand(2.5, 4); if (hit) { this.shake = Math.max(this.shake, 5); this.burst(e.x, e.y, 10, 200, 0.4, 4, '#aaa'); } }
          }
          if (d < e.r + pr + 3 && e.hitCd <= 0) { e.hitCd = 0.9; this.hurtPlayer(e.def.dmg * e.dmgMult * (e.state === 2 ? 1.5 : 1)); }
          break;
        }
        case 'sniper': {
          if (e.state === 0) {
            let mx = 0, my = 0;
            if (d > 700) { mx = nx; my = ny; } else if (d < 430) { mx = -nx; my = -ny; } else { mx = -ny * e.strafe; my = nx * e.strafe * 0.5; }
            this.steer(e, mx, my, 1, edt);
            if (d < 780 && e.cd <= 0 && this.hasLOS(e.x, e.y, p.x, p.y)) { e.state = 1; e.st = 1.1; sfx('click'); }
          } else {
            e.st -= edt; e.vx *= 0.8; e.vy *= 0.8;
            e.ang = Math.atan2(dy, dx);
            if (e.st <= 0) {
              e.state = 0; e.cd = rand(2.5, 3.8);
              this.ebullet(e.x + nx * 20, e.y + ny * 20, e.ang, 1500, e.def.dmg * e.dmgMult, 4, '#d9a8ff', 0, 1.2);
              sfx('rail');
            }
          }
          break;
        }
        case 'drone': {
          const a = e.t * 0.9 + e.id;
          const tx = p.x + Math.cos(a) * 230, ty = p.y + Math.sin(a) * 230;
          const l = Math.hypot(tx - e.x, ty - e.y) || 1;
          this.steer(e, (tx - e.x) / l, (ty - e.y) / l, Math.min(1.4, l / 120), edt);
          if (d < 600 && e.cd <= 0) {
            e.cd = rand(1.1, 1.8);
            this.ebullet(e.x, e.y, e.ang, 380, e.def.dmg * e.dmgMult, 4, '#4fe0ff');
            sfx('enemyShot');
          }
          break;
        }
        case 'turret':
          e.vx = e.vy = 0;
          if (d < 640 && this.hasLOS(e.x, e.y, p.x, p.y)) {
            if (e.shots > 0) {
              if (e.cd <= 0) { e.shots--; e.cd = e.shots > 0 ? 0.13 : rand(1.8, 2.6); this.ebullet(e.x + Math.cos(e.ang) * 24, e.y + Math.sin(e.ang) * 24, e.ang + rand(-0.04, 0.04), 470, e.def.dmg * e.dmgMult, 5, '#ff6a6a'); sfx('enemyShot'); }
            } else if (e.cd <= 0) { e.shots = 4; e.cd = 0.1; }
          }
          this.moveCircle(e, e.kbx * 0, 0);
          break;
        case 'boss':
          this.updateBoss(e, edt, nx, ny, d);
          break;
      }
      e.kbx *= Math.exp(-7 * dt); e.kby *= Math.exp(-7 * dt);
      if (e.type === 'turret' || e.type === 'boss') { e.kbx = 0; e.kby = 0; }
    }

    // separation
    const list = this.enemies.filter(e => !e.dead && e.type !== 'turret' && e.type !== 'boss' && !e.flying);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y, md = a.r + b.r;
        if (Math.abs(dx) > md || Math.abs(dy) > md) continue;
        const d = Math.hypot(dx, dy);
        if (d < md && d > 0.01) {
          const push = (md - d) * 0.5;
          const px = (dx / d) * push, py = (dy / d) * push;
          this.moveCircle(a, -px, -py); this.moveCircle(b, px, py);
        }
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);
  }

  updateBoss(e: Enemy, dt: number, nx: number, ny: number, d: number) {
    const b = e.boss!;
    const p = this.p;
    const phase = e.hp / e.maxHp < 0.33 ? 2 : e.hp / e.maxHp < 0.66 ? 1 : 0;
    e.ang = Math.atan2(ny, nx);
    const dm = e.def.dmg * e.dmgMult;
    const move = (mx: number, my: number, mult: number) => {
      const sp = b.def.speed * mult * (1 + phase * 0.2) * (e.slow > 0 ? 0.6 : 1);
      e.vx += (mx * sp - e.vx) * Math.min(1, 4 * dt); e.vy += (my * sp - e.vy) * Math.min(1, 4 * dt);
      e.x = clamp(e.x + e.vx * dt, e.r, this.W - e.r); e.y = clamp(e.y + e.vy * dt, e.r, this.H - e.r);
    };
    // contact damage
    if (d < e.r + (p.vehicle ? p.vehicle.r : p.r) && e.hitCd <= 0) { e.hitCd = 0.7; this.hurtPlayer(dm * 1.2); }

    if (!b.act) {
      let mx = nx, my = ny;
      if (d < 300) { mx = -nx * 0.5; my = -ny * 0.5; } else if (d < 480) { mx = -ny * e.strafe; my = nx * e.strafe; }
      move(mx, my, 1);
      b.pcd -= dt;
      if (b.pcd <= 0) {
        const pat = b.def.patterns[Math.floor(Math.random() * b.def.patterns.length)];
        b.act = pat; b.actT = 0; b.fired = 0;
        b.actDur = { spread: 0.9, ring: 1.4, burst: 1.3, summon: 1.2, charge: 1.7, rockets: 1.2, sweep: 3.0, teleport: 1.2 }[pat];
        b.pcd = b.def.cd * (1 - 0.15 * phase) + 0.4;
        if (pat === 'sweep') { b.sweepA = e.ang - 1.0 * e.strafe; b.sweepDir = e.strafe; b.lastTick = 0; }
        if (Math.random() < 0.3) e.strafe *= -1;
        this.text(e.x, e.y - e.r - 20, pat.toUpperCase() + '!', '#ff9a9a', 15);
      }
      return;
    }
    b.actT += dt;
    e.vx *= 0.9; e.vy *= 0.9;
    const t = b.actT;
    const col = b.def.color;
    switch (b.act) {
      case 'spread':
        if (t > 0.35 && b.fired === 0) {
          b.fired = 1;
          const n = 5 + phase * 2;
          for (let i = 0; i < n; i++) this.ebullet(e.x, e.y, e.ang + (i - (n - 1) / 2) * 0.16, 430, dm * 0.7, 6, col);
          sfx('enemyShot'); this.shake = Math.max(this.shake, 3);
        }
        if (t > 0.6 && b.fired === 1 && phase > 0) {
          b.fired = 2;
          const n = 4 + phase * 2;
          for (let i = 0; i < n; i++) this.ebullet(e.x, e.y, e.ang + (i - (n - 1) / 2) * 0.2 + 0.08, 380, dm * 0.7, 6, col);
        }
        break;
      case 'ring':
        if (t > 0.35 && b.fired === 0) {
          b.fired = 1;
          const n = 16 + phase * 6;
          for (let i = 0; i < n; i++) this.ebullet(e.x, e.y, (i / n) * Math.PI * 2, 270, dm * 0.65, 6, col);
          sfx('enemyShot'); this.shake = Math.max(this.shake, 3);
        }
        if (t > 0.8 && b.fired === 1) {
          b.fired = 2;
          const n = 16 + phase * 6;
          for (let i = 0; i < n; i++) this.ebullet(e.x, e.y, ((i + 0.5) / n) * Math.PI * 2, 230, dm * 0.65, 6, col);
        }
        break;
      case 'burst': {
        const n = 4 + phase * 2;
        const idx = Math.floor((t - 0.3) / 0.14);
        if (t > 0.3 && idx >= b.fired && b.fired < n) {
          b.fired++;
          this.ebullet(e.x, e.y, e.ang + rand(-0.05, 0.05), 560, dm * 0.8, 5, '#ffe14a');
          sfx('enemyShot');
        }
        break;
      }
      case 'summon':
        if (t > 0.5 && b.fired === 0) {
          b.fired = 1;
          const n = 3 + phase;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + rand(0, 1);
            const type = pick(this.lvl.enemies.filter(([k]) => k !== 'turret' && k !== 'sniper') as [EnemyId, number][]);
            this.spawnEnemy(type, e.x + Math.cos(a) * (e.r + 40), e.y + Math.sin(a) * (e.r + 40));
          }
          this.burst(e.x, e.y, 30, 300, 0.6, 5, col);
          sfx('skill');
        }
        break;
      case 'charge':
        if (t < 0.75) { b.lockA = Math.atan2(p.y - e.y, p.x - e.x); }
        else if (t < 1.5) {
          e.vx = Math.cos(b.lockA) * 640; e.vy = Math.sin(b.lockA) * 640;
          e.x = clamp(e.x + e.vx * dt, e.r, this.W - e.r); e.y = clamp(e.y + e.vy * dt, e.r, this.H - e.r);
          this.part(e.x, e.y, rand(-30, 30), rand(-30, 30), 0.4, e.r * 0.6, col, 2, true, -30);
          for (const o of this.obs) if (o.alive && o.kind !== 'wall' && e.x > o.x - e.r && e.x < o.x + o.w + e.r && e.y > o.y - e.r && e.y < o.y + o.h + e.r) this.damageObstacle(o, 100);
        }
        break;
      case 'rockets':
        if (t > 0.3 && b.fired === 0) {
          b.fired = 1;
          const n = 3 + phase;
          for (let i = 0; i < n; i++) this.ebullet(e.x, e.y, e.ang + (i - (n - 1) / 2) * 0.45, 260, dm, 8, '#ff8a3a', 2.2, 4, 70);
          sfx('rocket');
        }
        break;
      case 'sweep':
        if (t > 0.6) {
          b.sweepA += b.sweepDir * dt * (0.7 + phase * 0.15);
          const L = 1100;
          const ex = e.x + Math.cos(b.sweepA) * L, ey = e.y + Math.sin(b.sweepA) * L;
          if (distPointSeg(p.x, p.y, e.x, e.y, ex, ey) < (p.vehicle ? p.vehicle.r : p.r) + 10) {
            if (t - b.lastTick > 0.12) { b.lastTick = t; this.hurtPlayer(dm * 0.35, { cont: true }); this.shake = Math.max(this.shake, 3); }
          }
          this.part(e.x + Math.cos(b.sweepA) * rand(60, L), e.y + Math.sin(b.sweepA) * rand(60, L), 0, 0, 0.25, 6, col);
        }
        break;
      case 'teleport':
        if (t > 0.4 && b.fired === 0) {
          b.fired = 1;
          this.burst(e.x, e.y, 25, 300, 0.5, 6, col);
          for (let k = 0; k < 12; k++) {
            const a = rand(0, Math.PI * 2);
            const x = clamp(p.x + Math.cos(a) * 280, 80, this.W - 80), y = clamp(p.y + Math.sin(a) * 280, 80, this.H - 80);
            e.x = x; e.y = y;
            break;
          }
          this.burst(e.x, e.y, 25, 300, 0.5, 6, col);
        }
        if (t > 0.7 && b.fired === 1) {
          b.fired = 2;
          const n = 8 + phase * 4;
          for (let i = 0; i < n; i++) this.ebullet(e.x, e.y, (i / n) * Math.PI * 2, 340, dm * 0.65, 5, col);
          const a2 = Math.atan2(p.y - e.y, p.x - e.x);
          for (let i = -1; i <= 1; i++) this.ebullet(e.x, e.y, a2 + i * 0.12, 600, dm * 0.8, 5, '#ffe14a');
        }
        break;
    }
    if (b.actT >= b.actDur) { b.act = null; }
  }

  // ---------------- bullets ----------------
  updateBullets(dt: number, edt: number) {
    const p = this.p;
    const pr = p.vehicle ? p.vehicle.r : p.r;
    const bladePos: { x: number; y: number }[] = [];
    if (p.buffs.blades > 0) for (let i = 0; i < 6; i++) { const a = this.time * 6 + (i * Math.PI) / 3; bladePos.push({ x: p.x + Math.cos(a) * 105, y: p.y + Math.sin(a) * 105 }); }

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const step = b.friendly ? dt : edt;
      b.life -= step;
      if (b.grow) b.r += b.grow * step;
      // homing
      if (b.homing > 0) {
        let tx = p.x, ty = p.y, ok = !b.friendly;
        if (b.friendly) { const t = this.nearestEnemy(b.x, b.y, 600); if (t) { tx = t.x; ty = t.y; ok = true; } }
        if (ok && b.life > 0.2) {
          const sp = Math.hypot(b.vx, b.vy);
          const ca = Math.atan2(b.vy, b.vx);
          const ta = Math.atan2(ty - b.y, tx - b.x);
          const na = ca + clamp(angDiff(ta, ca), -b.homing * step, b.homing * step);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      const sp = Math.hypot(b.vx, b.vy);
      const n = Math.max(1, Math.ceil((sp * step) / 14));
      let dead = false;
      for (let s = 0; s < n && !dead; s++) {
        b.x += (b.vx * step) / n; b.y += (b.vy * step) / n;
        if (b.x < 0 || b.y < 0 || b.x > this.W || b.y > this.H) { dead = true; break; }
        // obstacles
        for (const o of this.obs) {
          if (!o.alive) continue;
          if (b.x > o.x - b.r && b.x < o.x + o.w + b.r && b.y > o.y - b.r && b.y < o.y + o.h + b.r) {
            if (o.kind === 'wall') {
              if (b.kind === 'flame' && Math.random() < 0.5) { /* flames lick over walls */ } else { dead = true; this.burst(b.x, b.y, 3, 100, 0.2, 2, b.color); }
            } else {
              if (b.friendly) this.damageObstacle(o, b.dmg);
              else if (b.explode) this.damageObstacle(o, 30);
              dead = true;
            }
            break;
          }
        }
        if (dead) break;
        if (b.friendly) {
          for (const e of this.enemies) {
            if (e.dead || b.hit.has(e.id)) continue;
            const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + b.r;
            if (dx * dx + dy * dy < rr * rr) {
              b.hit.add(e.id);
              const l = Math.hypot(b.vx, b.vy) || 1;
              this.hurtEnemy(e, b.dmg, { crit: b.crit, burn: b.burn, slow: b.slow, shock: b.shock, kx: (b.vx / l) * 160, ky: (b.vy / l) * 160, silent: b.kind === 'flame' && Math.random() < 0.7 });
              if (b.kind !== 'flame') this.part(b.x, b.y, rand(-80, 80), rand(-80, 80), 0.25, 3, b.color);
              sfx('hit');
              b.pierce--;
              if (b.pierce <= 0 || b.explode) { dead = true; break; }
            }
          }
        } else {
          // blades block
          let blocked = false;
          for (const bp of bladePos) if (Math.hypot(bp.x - b.x, bp.y - b.y) < 28) { blocked = true; break; }
          if (blocked) { dead = true; this.burst(b.x, b.y, 4, 120, 0.25, 3, '#ff3df2'); break; }
          const dx = p.x - b.x, dy = p.y - b.y, rr = pr + b.r;
          if (dx * dx + dy * dy < rr * rr) {
            if (p.buffs.shield > 0) {
              b.friendly = true; b.vx *= -1; b.vy *= -1; b.color = '#7cff7c'; b.dmg *= 1.5; b.hit = new Set(); b.life = 1.5; this.burst(b.x, b.y, 5, 160, 0.3, 3, '#ffd24a');
              sfx('click');
            } else if (p.dashInv <= 0) {
              this.hurtPlayer(b.dmg);
              dead = true;
            }
            break;
          }
        }
      }
      if (b.life <= 0) dead = true;
      if (dead) {
        if (b.explode) this.explode(b.x, b.y, b.explode, b.dmg, b.friendly ? 'player' : 'enemy');
        this.bullets.splice(i, 1);
        continue;
      }
      // trails
      if (b.kind === 'rocket' && Math.random() < 0.8) this.part(b.x, b.y, rand(-20, 20), rand(-20, 20), 0.4, 5, b.friendly ? '#ffb050' : '#ff6a4a', 3);
      if (b.kind === 'flame' && Math.random() < 0.3) this.part(b.x, b.y, rand(-30, 30), rand(-60, -10), 0.4, 6, '#ff5a1a', 3);
    }

    // blades damage
    if (bladePos.length) {
      for (const e of this.enemies) {
        if (e.dead || e.bladeCd > 0) continue;
        for (const bp of bladePos) {
          if (Math.hypot(bp.x - e.x, bp.y - e.y) < e.r + 22) {
            e.bladeCd = 0.2;
            this.hurtEnemy(e, this.pdmg(32).d, { kx: (e.x - p.x) * 3, ky: (e.y - p.y) * 3 });
            this.burst(e.x, e.y, 4, 160, 0.3, 3, '#ff3df2');
            break;
          }
        }
      }
    }
  }

  // ---------------- allies: turrets, drones ----------------
  updateAllies(dt: number) {
    const p = this.p;
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      t.life -= dt; t.cd -= dt;
      if (t.life <= 0) { this.turrets.splice(i, 1); this.burst(t.x, t.y, 12, 150, 0.4, 4, '#3dffb0'); continue; }
      const tgt = this.nearestEnemy(t.x, t.y, 480);
      if (tgt) {
        t.ang = Math.atan2(tgt.y - t.y, tgt.x - t.x);
        if (t.cd <= 0) {
          t.cd = 1 / 7;
          const { d, crit } = this.pdmg(13);
          const a = t.ang + rand(-0.05, 0.05);
          this.mkBullet({ x: t.x + Math.cos(a) * 18, y: t.y + Math.sin(a) * 18, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, friendly: true, dmg: d, crit, life: 0.6, color: '#3dffb0', r: 3 });
          sfx('smg');
        }
      }
    }
    if (p.buffs.drones > 0 && !p.dead) {
      for (let i = 0; i < 4; i++) {
        const a = this.time * 2.2 + (i * Math.PI) / 2;
        const dx = p.x + Math.cos(a) * 70, dy = p.y + Math.sin(a) * 70;
        const key = 'd' + i;
        const dd = (this as any)[key] ?? 0;
        (this as any)[key] = dd - dt;
        if ((this as any)[key] <= 0) {
          const tgt = this.nearestEnemy(dx, dy, 550);
          if (tgt) {
            (this as any)[key] = 0.45;
            const ang = Math.atan2(tgt.y - dy, tgt.x - dx);
            const { d, crit } = this.pdmg(15);
            this.mkBullet({ x: dx, y: dy, vx: Math.cos(ang) * 850, vy: Math.sin(ang) * 850, friendly: true, dmg: d, crit, life: 0.7, color: '#3dffb0', r: 3.5 });
            sfx('enemyShot');
          }
        }
      }
    }
    // melee-range shield aura nothing
  }

  updatePickups(dt: number) {
    const p = this.p;
    const mag = 130 * (this.char.mods.magnet || 1);
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt; k.life -= dt;
      if (k.life <= 0) { this.pickups.splice(i, 1); continue; }
      if (p.dead) continue;
      const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy);
      if (d < mag + (k.type === 'coin' ? 40 : 0) && k.t > 0.2) {
        const s = 380 * (1 - d / (mag + 60)) + 160;
        k.x += (dx / d) * s * dt; k.y += (dy / d) * s * dt;
      }
      if (d < p.r + 14 + (p.vehicle ? p.vehicle.r : 0)) {
        let take = true;
        switch (k.type) {
          case 'coin': {
            const v = Math.round(k.val * (1 + 0.1 * this.save.upgrades.credits) * (this.char.mods.credit || 1));
            this.creditsGot += v;
            this.score += v;
            sfx('coin');
            this.text(k.x, k.y - 10, '+' + v, '#ffd24a', 12);
            break;
          }
          case 'hp':
            if (p.vehicle) { if (p.vehicle.hp >= p.vehicle.maxHp) take = false; else p.vehicle.hp = Math.min(p.vehicle.maxHp, p.vehicle.hp + k.val * 3); }
            else if (p.hp >= p.maxHp) take = false;
            else p.hp = Math.min(p.maxHp, p.hp + k.val * (p.maxHp / 100));
            if (take) { sfx('pickup'); this.text(p.x, p.y - 28, '+HP', '#7cff7c', 14); }
            break;
          case 'ammo':
            for (const s of p.weapons) if (s.id !== 'pistol') s.reserve = Math.min(this.cap(s.id), s.reserve + Math.ceil(this.cap(s.id) * 0.3));
            p.grenades = Math.min(5, p.grenades + 1);
            sfx('pickup'); this.text(p.x, p.y - 28, '+AMMO', '#ffd24a', 14);
            break;
          case 'weapon':
            this.giveWeapon(k.wid || 'smg');
            sfx('pickup'); this.text(p.x, p.y - 34, WEAPONS[k.wid || 'smg'].name.toUpperCase(), WEAPONS[k.wid || 'smg'].color, 15);
            break;
          case 'ult':
            this.addUlt(k.val);
            sfx('pickup'); this.text(p.x, p.y - 28, '+ENERGY', '#d98cff', 14);
            break;
        }
        if (take) this.pickups.splice(i, 1);
      }
    }
  }

  updateHazards(dt: number) {
    const p = this.p;
    for (const h of this.hazards) {
      const active = h.type !== 'energy' || Math.sin(this.time * 1.6 + h.phase) > 0.1;
      if (!active) continue;
      const hd = Math.hypot(p.x - h.x, p.y - h.y);
      const flying = p.vehicle?.def.flying;
      if (!p.dead && !flying && hd < h.r + (p.vehicle ? p.vehicle.r * 0.5 : p.r * 0.5) && p.dashInv <= 0) {
        const immune = h.type === 'lava' && this.char.mods.burnImmune;
        if (!immune) this.hurtPlayer(h.dps * dt, { cont: true });
        if (h.type === 'toxic') p.buffs.haz = 0.3;
      }
      for (const e of this.enemies) {
        if (e.dead || e.flying) continue;
        if (Math.hypot(e.x - h.x, e.y - h.y) < h.r) {
          this.hurtEnemy(e, h.dps * 0.6 * dt, { silent: true, slow: h.type === 'toxic' ? 0.5 : 0 });
        }
      }
      if (Math.random() < 0.3) {
        const a = rand(0, 7), d = rand(0, h.r);
        const col = h.type === 'lava' ? '#ff8a2a' : h.type === 'toxic' ? '#8aff4a' : '#ff4a8a';
        this.part(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 0, -30, 0.7, 4, col);
      }
    }
  }

  // =====================================================================
  // RENDERING
  // =====================================================================
  render() {
    const g = this.ctx;
    const { sw, sh, zoom } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, sw, sh);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    g.save();
    g.translate(sw / 2 + sx, sh / 2 + sy);
    g.scale(zoom, zoom);
    g.translate(-this.cam.x, -this.cam.y);
    const vx0 = this.cam.x - sw / zoom / 2 - 60, vy0 = this.cam.y - sh / zoom / 2 - 60, vx1 = this.cam.x + sw / zoom / 2 + 60, vy1 = this.cam.y + sh / zoom / 2 + 60;
    const vis = (x: number, y: number, r = 40) => x > vx0 - r && x < vx1 + r && y > vy0 - r && y < vy1 + r;

    // ground
    const gx = Math.max(0, vx0), gy = Math.max(0, vy0);
    const gw = Math.min(this.W, vx1) - gx, gh = Math.min(this.H, vy1) - gy;
    if (gw > 0 && gh > 0) g.drawImage(this.ground, gx, gy, gw, gh, gx, gy, gw, gh);

    this.drawHazards(g, vis);

    // pickups
    for (const k of this.pickups) if (vis(k.x, k.y)) this.drawPickup(g, k);

    // grenades shadow & ground fx
    for (const gr of this.grenades) {
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(gr.x, gr.y, 7, 4, 0, 0, 7); g.fill();
    }

    // delayed markers
    for (const d of this.delayed) {
      if (d.r > 0 && vis(d.x, d.y, d.r)) {
        g.strokeStyle = d.color; g.globalAlpha = 0.5 + 0.4 * Math.sin(this.time * 20); g.lineWidth = 2;
        g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.stroke();
        g.beginPath(); g.arc(d.x, d.y, d.r * 0.4, 0, 7); g.stroke();
        g.globalAlpha = 1;
      }
    }

    // turrets (ally)
    for (const t of this.turrets) this.drawAllyTurret(g, t);

    // vehicles (ground)
    for (const v of this.vehicles) if (vis(v.x, v.y, 60) && !v.def.flying) this.drawVehicle(g, v);

    // obstacles
    for (const o of this.obs) if (o.alive && vis(o.x + o.w / 2, o.y + o.h / 2, Math.max(o.w, o.h))) this.drawObstacle(g, o);

    // enemies
    for (const e of this.enemies) if (vis(e.x, e.y, e.r + 80)) this.drawEnemy(g, e);
    // boss telegraphs
    if (this.boss && !this.boss.dead && this.boss.boss) this.drawBossTelegraph(g, this.boss);

    // player (on foot)
    if (!this.p.vehicle) this.drawPlayer(g);

    // flying vehicles
    for (const v of this.vehicles) if (vis(v.x, v.y, 60) && v.def.flying) this.drawVehicle(g, v);

    // drones
    this.drawDrones(g);
    this.drawBlades(g);

    // beams
    for (const b of this.beams) {
      const a = b.t / b.max;
      g.globalAlpha = a; g.strokeStyle = b.color; g.lineWidth = b.w * a + 1; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); b.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, b.w * a * 0.4);
      g.beginPath(); b.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke();
      g.globalAlpha = 1;
    }

    // grenades
    for (const gr of this.grenades) {
      g.fillStyle = '#4a4a4a'; g.beginPath(); g.arc(gr.x, gr.y - gr.z, 6, 0, 7); g.fill();
      g.fillStyle = Math.sin(this.time * 30) > 0 ? '#ff4a4a' : '#ffd24a'; g.beginPath(); g.arc(gr.x, gr.y - gr.z - 2, 2.5, 0, 7); g.fill();
    }

    // bullets
    this.drawBullets(g, vis);

    // particles (additive for glow)
    for (const q of this.parts) {
      if (!vis(q.x, q.y)) continue;
      const a = clamp(q.life / q.max, 0, 1);
      g.globalAlpha = a;
      g.fillStyle = q.color;
      if (q.glow) g.globalCompositeOperation = 'lighter';
      g.beginPath(); g.arc(q.x, q.y, Math.max(0.5, q.size * (q.grow < 0 ? 1 : 0.4 + 0.6 * a)), 0, 7); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;

    // booms
    for (const b of this.booms) {
      const t = b.t / b.max;
      g.globalCompositeOperation = 'lighter';
      const grad = g.createRadialGradient(b.x, b.y, b.r * t * 0.2, b.x, b.y, b.r * (0.4 + 0.6 * t));
      grad.addColorStop(0, `rgba(255,255,220,${0.8 * (1 - t)})`);
      grad.addColorStop(0.5, b.color.replace('#', '#') + '');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = (1 - t) * 0.8;
      g.fillStyle = grad;
      g.beginPath(); g.arc(b.x, b.y, b.r * (0.4 + 0.6 * t), 0, 7); g.fill();
      g.globalAlpha = (1 - t);
      g.strokeStyle = b.color; g.lineWidth = 4 * (1 - t) + 1;
      g.beginPath(); g.arc(b.x, b.y, b.r * t, 0, 7); g.stroke();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }

    // floating text
    g.textAlign = 'center';
    for (const t of this.texts) {
      g.globalAlpha = clamp(t.t / 0.4, 0, 1);
      g.font = `bold ${t.size}px system-ui, sans-serif`;
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(t.s, t.x, t.y);
      g.fillStyle = t.color; g.fillText(t.s, t.x, t.y);
    }
    g.globalAlpha = 1;

    // vehicle prompt
    if (!this.p.vehicle && !this.p.dead) {
      const nv = this.nearVehicle();
      if (nv) {
        g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'center';
        g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(`[E] Enter ${nv.def.name}`, nv.x, nv.y - nv.r - 18);
        g.fillStyle = '#4fd2ff'; g.fillText(`[E] Enter ${nv.def.name}`, nv.x, nv.y - nv.r - 18);
      }
    }
    g.restore();

    // screen-space overlays
    if (this.lvl.theme.fog) { g.fillStyle = this.lvl.theme.fog; g.fillRect(0, 0, sw, sh); }
    if (this.p.buffs.chrono > 0) { g.fillStyle = 'rgba(100,200,255,0.12)'; g.fillRect(0, 0, sw, sh); }
    if (this.freezeFx > 0) { g.fillStyle = `rgba(200,240,255,${this.freezeFx * 0.4})`; g.fillRect(0, 0, sw, sh); }
    if (this.p.buffs.rage > 0) { g.fillStyle = 'rgba(255,60,30,0.08)'; g.fillRect(0, 0, sw, sh); }
    if (this.vignette) { g.fillStyle = this.vignette; g.fillRect(0, 0, sw, sh); }
    if (this.p.hp / this.p.maxHp < 0.3 && !this.p.dead && !this.p.vehicle) {
      const a = 0.2 + 0.15 * Math.sin(this.time * 6);
      const gr = g.createRadialGradient(sw / 2, sh / 2, Math.min(sw, sh) * 0.3, sw / 2, sh / 2, Math.max(sw, sh) * 0.7);
      gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(255,0,0,${a})`);
      g.fillStyle = gr; g.fillRect(0, 0, sw, sh);
    }
    if (this.p.hitFlash > 0) { g.fillStyle = `rgba(255,0,0,${this.p.hitFlash * 1.2})`; g.fillRect(0, 0, sw, sh); }
    if (this.flashScreen.t > 0) { g.globalAlpha = this.flashScreen.t * 1.2; g.fillStyle = this.flashScreen.color; g.fillRect(0, 0, sw, sh); g.globalAlpha = 1; }

    this.drawHUD(g);
  }

  drawHazards(g: CanvasRenderingContext2D, vis: (x: number, y: number, r?: number) => boolean) {
    for (const h of this.hazards) {
      if (!vis(h.x, h.y, h.r)) continue;
      const active = h.type !== 'energy' || Math.sin(this.time * 1.6 + h.phase) > 0.1;
      const col = h.type === 'lava' ? [255, 110, 20] : h.type === 'toxic' ? [110, 255, 60] : [255, 50, 110];
      const pulse = 0.6 + 0.2 * Math.sin(this.time * 3 + h.phase);
      const gr = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
      const a = active ? pulse : 0.15;
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
      gr.addColorStop(0.75, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.6})`);
      gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(h.x, h.y, h.r, 0, 7); g.fill();
      if (h.type === 'energy' && active) { g.strokeStyle = `rgba(255,120,160,${pulse})`; g.lineWidth = 2; g.setLineDash([8, 8]); g.beginPath(); g.arc(h.x, h.y, h.r * 0.9, 0, 7); g.stroke(); g.setLineDash([]); }
    }
  }

  drawPickup(g: CanvasRenderingContext2D, k: Pickup) {
    const bob = Math.sin(k.t * 4 + k.x) * 3;
    if (k.life < 4 && Math.floor(k.life * 6) % 2 === 0) return;
    g.save(); g.translate(k.x, k.y + bob);
    let color = '#ffd24a', icon = '●';
    switch (k.type) {
      case 'coin': color = '#ffd24a'; break;
      case 'hp': color = '#4aff7a'; icon = '✚'; break;
      case 'ammo': color = '#ffb347'; icon = '▮'; break;
      case 'weapon': color = WEAPONS[k.wid || 'smg'].color; icon = WEAPONS[k.wid || 'smg'].icon; break;
      case 'ult': color = '#d98cff'; icon = '★'; break;
    }
    if (k.type === 'coin') {
      g.fillStyle = 'rgba(255,210,70,0.25)'; g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill();
      g.fillStyle = color; g.beginPath(); g.ellipse(0, 0, 6 * Math.abs(Math.cos(k.t * 4)) + 1.5, 6, 0, 0, 7); g.fill();
      g.strokeStyle = '#a07a10'; g.lineWidth = 1.5; g.stroke();
    } else {
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill();
      g.strokeStyle = color; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.stroke();
      g.globalAlpha = 0.25 + 0.15 * Math.sin(k.t * 5); g.fillStyle = color; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.globalAlpha = 1;
      g.fillStyle = color; g.font = k.type === 'weapon' ? '16px system-ui' : 'bold 16px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(icon, 0, 1); g.textBaseline = 'alphabetic';
    }
    g.restore();
  }

  drawObstacle(g: CanvasRenderingContext2D, o: Obstacle) {
    const th = this.lvl.theme;
    if (o.kind === 'wall') {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(o.x + 7, o.y + 9, o.w, o.h);
      g.fillStyle = th.wall; g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = th.wallTop; g.fillRect(o.x, o.y, o.w, 8);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(o.x, o.y + 8, o.w, o.h * 0.25);
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
      g.strokeStyle = th.accent; g.globalAlpha = 0.35; g.lineWidth = 1.5; g.strokeRect(o.x + 5, o.y + 11, o.w - 10, o.h - 16); g.globalAlpha = 1;
    } else if (o.kind === 'crate') {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(o.x + 4, o.y + 5, o.w, o.h);
      g.fillStyle = o.flash > 0 ? '#fff' : th.crate; g.fillRect(o.x, o.y, o.w, o.h);
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
      g.beginPath(); g.moveTo(o.x + 4, o.y + 4); g.lineTo(o.x + o.w - 4, o.y + o.h - 4); g.moveTo(o.x + o.w - 4, o.y + 4); g.lineTo(o.x + 4, o.y + o.h - 4); g.stroke();
    } else {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx + 3, cy + 4, 15, 12, 0, 0, 7); g.fill();
      g.fillStyle = o.flash > 0 ? '#fff' : '#c4342d'; g.beginPath(); g.arc(cx, cy, 15, 0, 7); g.fill();
      g.strokeStyle = '#2a0a08'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#ffd24a'; g.fillRect(cx - 15, cy - 3, 30, 6);
      g.fillStyle = '#000'; g.font = 'bold 9px system-ui'; g.textAlign = 'center'; g.fillText('☢', cx, cy + 3);
    }
  }

  drawPlayer(g: CanvasRenderingContext2D) {
    const p = this.p, c = this.char;
    if (p.dead) return;
    g.save(); g.translate(p.x, p.y);
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(3, 5, 17, 13, 0, 0, 7); g.fill();
    // auras
    if (p.buffs.shield > 0) {
      g.strokeStyle = `rgba(255,210,80,${0.5 + 0.3 * Math.sin(this.time * 12)})`; g.lineWidth = 4; g.fillStyle = 'rgba(255,210,80,0.15)';
      g.beginPath(); g.arc(0, 0, 32, 0, 7); g.fill(); g.stroke();
    }
    if (p.buffs.adren > 0) { g.fillStyle = 'rgba(79,179,255,0.25)'; g.beginPath(); g.arc(0, 0, 26 + Math.sin(this.time * 14) * 3, 0, 7); g.fill(); }
    if (p.buffs.rage > 0) { g.fillStyle = 'rgba(255,70,30,0.3)'; g.beginPath(); g.arc(0, 0, 28 + Math.sin(this.time * 18) * 3, 0, 7); g.fill(); }
    if (p.dashInv > 0.05) g.globalAlpha = 0.55;
    g.rotate(p.angle);
    // melee swing
    if (p.meleeT > 0) {
      const t = 1 - p.meleeT / 0.18;
      g.strokeStyle = `rgba(255,255,255,${1 - t})`; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, 58, -1.1 + t * 0.5, 1.1 - (1 - t) * 0.5); g.stroke();
    }
    // weapon
    const w = WEAPONS[p.weapons[p.cur].id];
    const len = w.id === 'rail' ? 34 : w.id === 'rocket' ? 30 : w.id === 'pistol' ? 18 : 26;
    const recoil = p.fireCd > 0 ? Math.min(4, p.fireCd * 20) : 0;
    g.fillStyle = '#222'; g.fillRect(8 - recoil, -3.5, len, 7);
    g.fillStyle = w.color; g.fillRect(8 - recoil + len - 6, -2.5, 6, 5);
    // body
    g.fillStyle = c.color2; g.beginPath(); g.ellipse(0, 0, 11, 17, 0, 0, 7); g.fill();
    g.strokeStyle = c.color; g.lineWidth = 2.5; g.stroke();
    // hands
    g.fillStyle = c.color; g.beginPath(); g.arc(14 - recoil, -5, 4, 0, 7); g.arc(20 - recoil, 4, 4, 0, 7); g.fill();
    // head
    g.fillStyle = p.hitFlash > 0 ? '#fff' : c.color; g.beginPath(); g.arc(0, 0, 9.5, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.ellipse(4, 0, 4, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillRect(5, -1.5, 3, 3);
    g.restore();
    g.globalAlpha = 1;
    // reload bar
    if (p.reloadT > 0) {
      const w2 = WEAPONS[p.weapons[p.cur].id].reload * (p.buffs.rage > 0 ? 0.3 : 1);
      const f = 1 - p.reloadT / w2;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(p.x - 20, p.y + 26, 40, 5);
      g.fillStyle = '#ffd24a'; g.fillRect(p.x - 20, p.y + 26, 40 * f, 5);
    }
  }

  drawBlades(g: CanvasRenderingContext2D) {
    const p = this.p;
    if (p.buffs.blades <= 0) return;
    for (let i = 0; i < 6; i++) {
      const a = this.time * 6 + (i * Math.PI) / 3;
      const x = p.x + Math.cos(a) * 105, y = p.y + Math.sin(a) * 105;
      g.save(); g.translate(x, y); g.rotate(a * 3);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,61,242,0.35)'; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#ffd0fb'; g.strokeStyle = '#ff3df2'; g.lineWidth = 2;
      g.beginPath(); for (let k = 0; k < 4; k++) { const aa = (k * Math.PI) / 2; g.lineTo(Math.cos(aa) * 20, Math.sin(aa) * 20); g.lineTo(Math.cos(aa + 0.785) * 6, Math.sin(aa + 0.785) * 6); }
      g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }

  drawDrones(g: CanvasRenderingContext2D) {
    const p = this.p;
    if (p.buffs.drones <= 0) return;
    for (let i = 0; i < 4; i++) {
      const a = this.time * 2.2 + (i * Math.PI) / 2;
      const x = p.x + Math.cos(a) * 70, y = p.y + Math.sin(a) * 70;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x + 4, y + 12, 8, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#0a6a45'; g.strokeStyle = '#3dffb0'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#a0ffd8'; g.lineWidth = 1.5;
      const r = this.time * 30 + i;
      g.beginPath(); g.moveTo(x + Math.cos(r) * 12, y + Math.sin(r) * 12); g.lineTo(x - Math.cos(r) * 12, y - Math.sin(r) * 12); g.stroke();
    }
  }

  drawAllyTurret(g: CanvasRenderingContext2D, t: Turret) {
    g.save(); g.translate(t.x, t.y);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(3, 4, 18, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#0a6a45'; g.strokeStyle = '#3dffb0'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill(); g.stroke();
    g.rotate(t.ang); g.fillStyle = '#222'; g.fillRect(4, -4, 22, 8); g.fillStyle = '#3dffb0'; g.fillRect(22, -3, 5, 6);
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(t.x - 14, t.y + 20, 28, 3);
    g.fillStyle = '#3dffb0'; g.fillRect(t.x - 14, t.y + 20, 28 * (t.life / 18), 3);
  }

  drawVehicle(g: CanvasRenderingContext2D, v: Vehicle) {
    const d = v.def;
    g.save(); g.translate(v.x, v.y);
    const flash = v.flash > 0;
    // shadow
    const so = d.flying ? 28 : 5;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(so, so, v.r * 1.1, v.r * 0.8, v.angle, 0, 7); g.fill();
    if (!v.occupied && !d.flying) { g.strokeStyle = 'rgba(79,210,255,' + (0.4 + 0.3 * Math.sin(v.t * 4)) + ')'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.arc(0, 0, v.r + 12, 0, 7); g.stroke(); g.setLineDash([]); }
    if (!v.occupied && d.flying) { g.strokeStyle = 'rgba(79,210,255,' + (0.4 + 0.3 * Math.sin(v.t * 4)) + ')'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.arc(0, 0, v.r + 12, 0, 7); g.stroke(); g.setLineDash([]); }
    g.rotate(v.angle);
    const c1 = flash ? '#fff' : d.color, c2 = d.color2;
    switch (d.id) {
      case 'jeep':
        g.fillStyle = '#111'; for (const [wx, wy] of [[-14, -17], [14, -17], [-14, 17], [14, 17]]) g.fillRect(wx - 7, wy - 4, 14, 8);
        g.fillStyle = c2; g.beginPath(); g.roundRect(-26, -15, 52, 30, 7); g.fill();
        g.fillStyle = c1; g.beginPath(); g.roundRect(-23, -12, 46, 24, 6); g.fill();
        g.fillStyle = '#223'; g.fillRect(2, -9, 9, 18);
        g.fillStyle = '#ffe9a8'; g.fillRect(21, -10, 3, 5); g.fillRect(21, 5, 3, 5);
        break;
      case 'tank':
        g.fillStyle = '#222'; g.fillRect(-32, -30, 64, 12); g.fillRect(-32, 18, 64, 12);
        g.fillStyle = '#333'; for (let i = -28; i < 30; i += 8) { g.fillRect(i, -30, 3, 12); g.fillRect(i, 18, 3, 12); }
        g.fillStyle = c2; g.beginPath(); g.roundRect(-30, -20, 60, 40, 8); g.fill();
        g.fillStyle = c1; g.beginPath(); g.roundRect(-27, -17, 54, 34, 7); g.fill();
        break;
      case 'hover':
        g.fillStyle = 'rgba(79,210,255,0.3)'; g.beginPath(); g.ellipse(0, 0, 32, 20, 0, 0, 7); g.fill();
        g.fillStyle = c2; g.beginPath(); g.moveTo(26, 0); g.lineTo(-18, -17); g.lineTo(-24, 0); g.lineTo(-18, 17); g.closePath(); g.fill();
        g.fillStyle = c1; g.beginPath(); g.moveTo(22, 0); g.lineTo(-14, -12); g.lineTo(-18, 0); g.lineTo(-14, 12); g.closePath(); g.fill();
        g.fillStyle = '#123'; g.beginPath(); g.ellipse(4, 0, 7, 5, 0, 0, 7); g.fill();
        g.fillStyle = '#4fd2ff'; g.fillRect(-26, -14, 6, 4); g.fillRect(-26, 10, 6, 4);
        break;
      case 'heli':
        g.fillStyle = c2; g.fillRect(-40, -3, 26, 6);
        g.fillStyle = c2; g.beginPath(); g.ellipse(0, 0, 26, 14, 0, 0, 7); g.fill();
        g.fillStyle = c1; g.beginPath(); g.ellipse(2, 0, 22, 11, 0, 0, 7); g.fill();
        g.fillStyle = '#26364a'; g.beginPath(); g.ellipse(12, 0, 9, 7, 0, 0, 7); g.fill();
        g.fillStyle = c2; g.fillRect(-42, -8, 4, 16);
        g.fillStyle = '#333'; g.fillRect(8, -20, 14, 4); g.fillRect(8, 16, 14, 4);
        break;
    }
    g.rotate(-v.angle);
    // turret
    g.rotate(v.aim);
    if (d.id === 'tank') {
      g.fillStyle = '#222'; g.fillRect(8, -5, 38, 10);
      g.fillStyle = c2; g.fillRect(40, -6, 8, 12);
      g.fillStyle = c1; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill(); g.strokeStyle = c2; g.lineWidth = 3; g.stroke();
    } else if (d.id === 'jeep') {
      g.fillStyle = '#222'; g.fillRect(4, -3, 26, 6); g.fillStyle = c2; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
    } else if (d.id === 'hover') {
      g.fillStyle = '#222'; g.fillRect(8, -11, 18, 4); g.fillRect(8, 7, 18, 4);
    } else if (d.id === 'heli') {
      g.fillStyle = '#222'; g.fillRect(10, -3, 24, 6);
    }
    g.rotate(-v.aim);
    if (d.id === 'heli') {
      // rotor
      g.rotate(v.t * 25);
      g.fillStyle = 'rgba(200,200,220,0.25)'; g.beginPath(); g.arc(0, 0, 52, 0, 7); g.fill();
      g.strokeStyle = '#444'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-52, 0); g.lineTo(52, 0); g.moveTo(0, -52); g.lineTo(0, 52); g.stroke();
      g.fillStyle = '#222'; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill();
    }
    g.restore();
    // hp bar when damaged / occupied
    if (!v.occupied && v.hp < v.maxHp) {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(v.x - 24, v.y - v.r - 10, 48, 4);
      g.fillStyle = '#7cff7c'; g.fillRect(v.x - 24, v.y - v.r - 10, 48 * (v.hp / v.maxHp), 4);
    }
  }

  drawEnemy(g: CanvasRenderingContext2D, e: Enemy) {
    g.save(); g.translate(e.x, e.y);
    const fl = e.flash > 0;
    const col = fl ? '#ffffff' : e.color;
    const dark = 'rgba(0,0,0,0.5)';
    const so = e.flying ? 18 : 4;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(so, so, e.r * 1.0, e.r * 0.75, 0, 0, 7); g.fill();
    if (e.elite) { g.strokeStyle = '#ffd24a'; g.lineWidth = 3; g.globalAlpha = 0.6 + 0.3 * Math.sin(this.time * 8); g.beginPath(); g.arc(0, 0, e.r + 7, 0, 7); g.stroke(); g.globalAlpha = 1; }
    g.rotate(e.ang);
    switch (e.type) {
      case 'grunt':
        g.fillStyle = col; g.beginPath(); g.arc(0, 0, e.r, 0, 7); g.fill();
        g.fillStyle = dark; g.beginPath(); g.arc(-3, 0, e.r * 0.65, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.fillRect(e.r * 0.4, -5, 4, 3); g.fillRect(e.r * 0.4, 2, 4, 3);
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(8, -e.r + 2); g.lineTo(e.r + 6, -e.r + 4); g.moveTo(8, e.r - 2); g.lineTo(e.r + 6, e.r - 4); g.stroke();
        break;
      case 'gunner':
        g.fillStyle = '#222'; g.fillRect(6, -3, 22, 6);
        g.fillStyle = col; g.beginPath(); g.arc(0, 0, e.r, 0, 7); g.fill();
        g.fillStyle = dark; g.beginPath(); g.arc(-2, 0, e.r * 0.6, 0, 7); g.fill();
        g.fillStyle = '#ffe9a8'; g.fillRect(e.r * 0.3, -4, 5, 8);
        break;
      case 'runner':
        g.fillStyle = col; g.beginPath(); g.moveTo(e.r + 4, 0); g.lineTo(-e.r, -e.r); g.lineTo(-e.r * 0.5, 0); g.lineTo(-e.r, e.r); g.closePath(); g.fill();
        g.fillStyle = '#c33'; g.beginPath(); g.arc(-2, 0, 4 + Math.sin(this.time * 20) * 1.5, 0, 7); g.fill();
        break;
      case 'brute':
        g.fillStyle = col; g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r); } g.closePath(); g.fill();
        g.fillStyle = dark; g.beginPath(); g.arc(0, 0, e.r * 0.65, 0, 7); g.fill();
        g.fillStyle = e.state === 1 ? '#ffff55' : '#ff5a5a'; g.fillRect(e.r * 0.3, -6, 6, 4); g.fillRect(e.r * 0.3, 2, 6, 4);
        g.strokeStyle = fl ? '#fff' : '#d05a6a'; g.lineWidth = 4; g.beginPath(); g.moveTo(e.r * 0.6, -e.r); g.lineTo(e.r + 10, -e.r * 0.7); g.moveTo(e.r * 0.6, e.r); g.lineTo(e.r + 10, e.r * 0.7); g.stroke();
        break;
      case 'sniper':
        g.fillStyle = '#222'; g.fillRect(4, -2.5, 38, 5);
        g.fillStyle = col; g.beginPath(); g.arc(0, 0, e.r, 0, 7); g.fill();
        g.fillStyle = dark; g.beginPath(); g.arc(-2, 0, e.r * 0.6, 0, 7); g.fill();
        g.fillStyle = '#ff4aff'; g.fillRect(e.r * 0.3, -2, 5, 4);
        break;
      case 'drone':
        g.fillStyle = col; g.beginPath(); g.arc(0, 0, e.r, 0, 7); g.fill();
        g.fillStyle = dark; g.beginPath(); g.arc(0, 0, e.r * 0.55, 0, 7); g.fill();
        g.fillStyle = '#ff5a5a'; g.beginPath(); g.arc(e.r * 0.3, 0, 3, 0, 7); g.fill();
        g.rotate(-e.ang + this.time * 28);
        g.strokeStyle = 'rgba(220,250,255,0.8)'; g.lineWidth = 2.5;
        for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + 0.785; g.beginPath(); g.moveTo(Math.cos(a) * e.r * 0.4, Math.sin(a) * e.r * 0.4); g.lineTo(Math.cos(a) * (e.r + 5), Math.sin(a) * (e.r + 5)); g.stroke(); }
        break;
      case 'turret':
        g.rotate(-e.ang);
        g.fillStyle = '#444'; g.fillRect(-e.r, -e.r, e.r * 2, e.r * 2);
        g.fillStyle = col; g.fillRect(-e.r + 4, -e.r + 4, e.r * 2 - 8, e.r * 2 - 8);
        g.rotate(e.ang);
        g.fillStyle = '#222'; g.fillRect(2, -4, 26, 8);
        g.fillStyle = '#ff5a5a'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
        break;
      case 'boss':
        this.drawBossBody(g, e, col);
        break;
    }
    g.restore();
    // status fx
    if (e.freeze > 0) { g.fillStyle = 'rgba(180,230,255,0.55)'; g.beginPath(); g.arc(e.x, e.y, e.r + 4, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    else if (e.slow > 0) { g.strokeStyle = 'rgba(79,210,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y, e.r + 3, 0, 7); g.stroke(); }
    if (e.stun > 0) { g.fillStyle = '#ffe14a'; g.font = 'bold 14px system-ui'; g.textAlign = 'center'; g.fillText('⚡', e.x, e.y - e.r - 6); }
    // sniper aim line
    if (e.type === 'sniper' && e.state === 1) {
      g.strokeStyle = `rgba(255,60,255,${0.3 + 0.5 * (1 - e.st / 1.1)})`; g.lineWidth = 1 + 2 * (1 - e.st / 1.1);
      g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + Math.cos(e.ang) * 900, e.y + Math.sin(e.ang) * 900); g.stroke();
    }
    if (e.type === 'brute' && e.state === 1) {
      g.strokeStyle = 'rgba(255,60,60,0.5)'; g.lineWidth = e.r * 1.4;
      g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + e.lx * 360, e.y + e.ly * 360); g.stroke();
    }
    // hp bar
    if (e.type !== 'boss' && e.hp < e.maxHp) {
      const w = e.r * 2 + 4;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
      g.fillStyle = e.elite ? '#ffd24a' : '#ff5a5a'; g.fillRect(e.x - w / 2, e.y - e.r - 12, w * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
  }

  drawBossBody(g: CanvasRenderingContext2D, e: Enemy, col: string) {
    const b = e.boss!;
    const d = b.def;
    const r = e.r;
    const t = this.time;
    // outer ring
    g.strokeStyle = d.color2; g.lineWidth = 8;
    g.beginPath(); g.arc(0, 0, r + 4, 0, 7); g.stroke();
    // spikes / armor plates
    g.fillStyle = col;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.4;
      g.save(); g.rotate(a); g.translate(r, 0);
      g.beginPath(); g.moveTo(-8, -12); g.lineTo(16, 0); g.lineTo(-8, 12); g.closePath(); g.fill();
      g.restore();
    }
    g.fillStyle = d.color2; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(0, 0, r * 0.82, 0, 7); g.fill();
    g.fillStyle = d.color2; g.beginPath(); g.arc(0, 0, r * 0.55, 0, 7); g.fill();
    // cannons
    g.fillStyle = '#222';
    g.fillRect(r * 0.5, -r * 0.45, r * 0.7, 8); g.fillRect(r * 0.5, r * 0.45 - 8, r * 0.7, 8);
    // eye
    const pulse = 0.7 + 0.3 * Math.sin(t * 6);
    g.fillStyle = b.act === 'charge' && b.actT < 0.75 ? '#ffff55' : '#ff2a2a';
    g.globalAlpha = pulse;
    g.beginPath(); g.arc(r * 0.15, 0, r * 0.28, 0, 7); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(r * 0.22, 0, r * 0.1, 0, 7); g.fill();
  }

  drawBossTelegraph(g: CanvasRenderingContext2D, e: Enemy) {
    const b = e.boss!;
    if (!b.act) return;
    const p = this.p;
    if (b.act === 'charge') {
      if (b.actT < 0.75) {
        g.save();
        g.strokeStyle = `rgba(255,60,60,${0.3 + 0.4 * Math.sin(b.actT * 30) ** 2})`; g.lineWidth = e.r * 1.5;
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + Math.cos(b.lockA) * 700, e.y + Math.sin(b.lockA) * 700); g.stroke();
        g.restore();
      }
    }
    if (b.act === 'sweep') {
      const L = 1100;
      const ex = e.x + Math.cos(b.sweepA) * L, ey = e.y + Math.sin(b.sweepA) * L;
      if (b.actT < 0.6) {
        g.strokeStyle = 'rgba(255,80,80,0.5)'; g.lineWidth = 2; g.setLineDash([10, 10]);
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
      } else {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = b.def.color; g.lineWidth = 22; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(ex, ey); g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 7; g.globalAlpha = 1; g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(ex, ey); g.stroke();
        g.globalCompositeOperation = 'source-over';
      }
    }
    if (b.act === 'teleport' && b.actT < 0.4) {
      g.strokeStyle = b.def.color; g.lineWidth = 3; g.globalAlpha = 0.6; g.beginPath(); g.arc(e.x, e.y, e.r + 10 + b.actT * 60, 0, 7); g.stroke(); g.globalAlpha = 1;
    }
    void p;
  }

  drawBullets(g: CanvasRenderingContext2D, vis: (x: number, y: number, r?: number) => boolean) {
    g.lineCap = 'round';
    for (const b of this.bullets) {
      if (!vis(b.x, b.y)) continue;
      if (b.kind === 'flame') {
        const t = 1 - b.life / b.maxLife;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = (1 - t) * 0.55;
        g.fillStyle = t < 0.4 ? '#ffd060' : t < 0.7 ? '#ff7a2a' : '#c0301a';
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        continue;
      }
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const tl = b.kind === 'rocket' ? 0.025 : b.kind === 'plasma' ? 0.03 : 0.018;
      const tx = b.x - b.vx * tl, ty = b.y - b.vy * tl;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = b.color; g.globalAlpha = 0.5; g.lineWidth = b.r * 2.6;
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(b.x, b.y); g.stroke();
      g.globalAlpha = 1; g.lineWidth = b.r * 1.3;
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(b.x, b.y); g.stroke();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, b.r * 0.7, 0, 7); g.fill();
      if (!b.friendly) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(b.x, b.y, b.r + 1, 0, 7); g.stroke(); }
      void sp;
    }
  }

  // ---------------- HUD ----------------
  rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    g.beginPath(); g.roundRect(x, y, w, h, r);
  }
  txt(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'left', bold = true) {
    g.font = `${bold ? 'bold ' : ''}${size}px system-ui, -apple-system, sans-serif`;
    g.textAlign = align;
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.strokeText(s, x, y);
    g.fillStyle = color; g.fillText(s, x, y);
  }
  bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pct: number, color: string, bg = 'rgba(0,0,0,0.55)') {
    this.rr(g, x, y, w, h, h / 2); g.fillStyle = bg; g.fill();
    if (pct > 0) { this.rr(g, x, y, Math.max(h, w * clamp(pct, 0, 1)), h, h / 2); g.fillStyle = color; g.fill(); }
    this.rr(g, x, y, w, h, h / 2); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5; g.stroke();
  }

  drawHUD(g: CanvasRenderingContext2D) {
    const { sw, sh } = this;
    const p = this.p, c = this.char;
    const accent = this.lvl.theme.accent;
    g.textBaseline = 'alphabetic';

    // --- top-left: portrait + health ---
    g.fillStyle = 'rgba(8,10,20,0.7)'; this.rr(g, 12, 12, 290, 78, 12); g.fill();
    g.strokeStyle = c.color; g.lineWidth = 2; this.rr(g, 12, 12, 290, 78, 12); g.stroke();
    g.fillStyle = c.color2; g.beginPath(); g.arc(50, 51, 28, 0, 7); g.fill(); g.strokeStyle = c.color; g.lineWidth = 3; g.stroke();
    g.font = '28px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(c.icon, 50, 53); g.textBaseline = 'alphabetic';
    this.txt(g, c.name, 90, 34, 15, c.color);
    const hpPct = p.hp / p.maxHp;
    this.bar(g, 90, 41, 200, 16, hpPct, hpPct > 0.3 ? '#4aff7a' : '#ff4a4a');
    this.txt(g, `${Math.ceil(p.hp)} / ${p.maxHp}`, 190, 54, 11, '#fff', 'center');
    // ult
    this.bar(g, 90, 63, 200, 10, p.ult / 100, p.ult >= 100 ? `hsl(${(this.time * 200) % 360},90%,60%)` : '#b06aff');
    this.txt(g, p.ult >= 100 ? `ULTIMATE READY [SPACE]: ${c.ult.name}` : `ULT ${Math.floor(p.ult)}%`, 190, 82, 10, '#e6d0ff', 'center');

    // vehicle bar
    let ty = 100;
    if (p.vehicle) {
      const v = p.vehicle;
      g.fillStyle = 'rgba(8,10,20,0.7)'; this.rr(g, 12, ty, 290, 40, 10); g.fill();
      this.txt(g, `${v.def.icon} ${v.def.name}`, 22, ty + 17, 13, '#4fd2ff');
      this.bar(g, 22, ty + 22, 270, 11, v.hp / v.maxHp, '#4fd2ff');
      ty += 48;
    }
    // buffs
    const buffs: [string, number, string][] = [];
    if (p.buffs.adren > 0) buffs.push(['ADRENALINE', p.buffs.adren, '#4fb3ff']);
    if (p.buffs.shield > 0) buffs.push(['BULWARK', p.buffs.shield, '#ffd24a']);
    if (p.buffs.rage > 0) buffs.push(['OVERDRIVE', p.buffs.rage, '#ff5a3a']);
    if (p.buffs.chrono > 0) buffs.push(['CHRONO FIELD', p.buffs.chrono, '#9be8ff']);
    if (p.buffs.blades > 0) buffs.push(['BLADE STORM', p.buffs.blades, '#ff3df2']);
    if (p.buffs.drones > 0) buffs.push(['DRONE SWARM', p.buffs.drones, '#3dffb0']);
    for (const [n, t, col] of buffs) { this.txt(g, `${n} ${t.toFixed(1)}s`, 16, ty + 12, 12, col); ty += 16; }

    // score / combo
    this.txt(g, `SCORE ${this.score.toLocaleString()}`, 16, ty + 18, 14, '#fff');
    if (this.combo >= 3) {
      const m = 1 + Math.min(3, Math.floor(this.combo / 5) * 0.5);
      this.txt(g, `${this.combo} COMBO  x${m.toFixed(1)}`, 16, ty + 38, 15, '#ffd24a');
      this.bar(g, 16, ty + 44, 120, 5, this.comboT / 3, '#ffd24a');
    }

    // --- top-center: objective / boss ---
    if (this.bossSpawned && this.boss && !this.boss.dead) {
      const b = this.boss;
      const w = Math.min(560, sw * 0.4), x = sw / 2 - w / 2;
      this.txt(g, `${b.boss!.def.name} — ${b.boss!.def.title}`, sw / 2, 28, 15, '#ff7a7a', 'center');
      this.bar(g, x, 36, w, 16, b.hp / b.maxHp, '#ff3a3a');
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1;
      for (const f of [0.33, 0.66]) { g.beginPath(); g.moveTo(x + w * f, 36); g.lineTo(x + w * f, 52); g.stroke(); }
    } else if (!this.bossSpawned) {
      const w = Math.min(380, sw * 0.3), x = sw / 2 - w / 2;
      this.txt(g, `ELIMINATE HOSTILES  ${Math.min(this.kills, this.lvl.goal)} / ${this.lvl.goal}`, sw / 2, 28, 14, '#fff', 'center');
      this.bar(g, x, 36, w, 12, this.kills / this.lvl.goal, accent);
    } else {
      this.txt(g, 'MISSION COMPLETE', sw / 2, 28, 16, '#7cff7c', 'center');
    }

    // --- top-right: minimap ---
    const mw = 190, mh = Math.round((190 * this.H) / this.W), mx = sw - mw - 14, my = 14;
    g.fillStyle = 'rgba(6,8,16,0.75)'; this.rr(g, mx - 4, my - 4, mw + 8, mh + 8, 8); g.fill();
    g.strokeStyle = accent; g.lineWidth = 1.5; this.rr(g, mx - 4, my - 4, mw + 8, mh + 8, 8); g.stroke();
    const k = mw / this.W;
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (const o of this.obs) if (o.alive && o.kind === 'wall') g.fillRect(mx + o.x * k, my + o.y * k, Math.max(1.5, o.w * k), Math.max(1.5, o.h * k));
    for (const h of this.hazards) { g.fillStyle = h.type === 'lava' ? 'rgba(255,110,20,0.45)' : h.type === 'toxic' ? 'rgba(110,255,60,0.4)' : 'rgba(255,50,110,0.4)'; g.beginPath(); g.arc(mx + h.x * k, my + h.y * k, Math.max(2, h.r * k), 0, 7); g.fill(); }
    for (const v of this.vehicles) { g.fillStyle = '#4fd2ff'; g.fillRect(mx + v.x * k - 3, my + v.y * k - 3, 6, 6); }
    for (const pk of this.pickups) if (pk.type === 'weapon') { g.fillStyle = '#ffd24a'; g.fillRect(mx + pk.x * k - 1, my + pk.y * k - 1, 3, 3); }
    for (const e of this.enemies) {
      if (e.type === 'boss') { g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(mx + e.x * k, my + e.y * k, 5, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); }
      else { g.fillStyle = e.elite ? '#ffd24a' : '#ff5a5a'; g.fillRect(mx + e.x * k - 1.5, my + e.y * k - 1.5, 3, 3); }
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(mx + p.x * k, my + p.y * k, 3.5, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
    g.strokeRect(mx + (this.cam.x - sw / this.zoom / 2) * k, my + (this.cam.y - sh / this.zoom / 2) * k, (sw / this.zoom) * k, (sh / this.zoom) * k);
    this.txt(g, `💰 ${this.creditsGot}`, sw - 14, my + mh + 28, 15, '#ffd24a', 'right');
    this.txt(g, `Kills ${this.kills}`, sw - 14, my + mh + 46, 12, '#ddd', 'right');
    const mins = Math.floor(this.time / 60), secs = Math.floor(this.time % 60);
    this.txt(g, `${mins}:${secs.toString().padStart(2, '0')}`, sw - 14, my + mh + 62, 12, '#aaa', 'right');

    // --- bottom-left: abilities ---
    const bx = 14, by = sh - 74, sz = 56;
    const slots: { key: string; label: string; icon: string; cd: number; max: number; color: string; extra?: string }[] = [
      { key: 'SHIFT', label: p.vehicle ? 'Boost' : 'Dash', icon: p.vehicle ? '🔥' : '💨', cd: p.vehicle ? p.vehicle.boostCd : p.dashCd, max: p.vehicle ? p.vehicle.def.boostCd : 1.1 * this.cdMult(), color: '#9be8ff' },
      { key: 'Q', label: c.skill.name, icon: c.icon, cd: p.vehicle ? 99 : p.skillCd, max: c.skill.cd * this.cdMult(), color: c.color },
      { key: 'SPACE', label: 'ULT', icon: '⭐', cd: p.ult >= 100 ? 0 : (100 - p.ult) / 100 * 10, max: 10, color: '#d98cff' },
      { key: 'G', label: 'Grenade', icon: '💣', cd: p.grenades > 0 ? 0 : 1, max: 1, color: '#ffb347', extra: 'x' + p.grenades },
      { key: 'V', label: 'Melee', icon: '🗡️', cd: p.vehicle ? 99 : p.meleeCd, max: 0.5, color: '#fff' },
    ];
    slots.forEach((s, i) => {
      const x = bx + i * (sz + 8);
      g.fillStyle = 'rgba(8,10,20,0.75)'; this.rr(g, x, by, sz, sz, 10); g.fill();
      const ready = s.cd <= 0;
      g.strokeStyle = ready ? s.color : 'rgba(255,255,255,0.2)'; g.lineWidth = ready ? 2.5 : 1.5; this.rr(g, x, by, sz, sz, 10); g.stroke();
      g.font = '24px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = ready ? 1 : 0.45; g.fillStyle = '#fff'; g.fillText(s.icon, x + sz / 2, by + sz / 2 - 3); g.globalAlpha = 1; g.textBaseline = 'alphabetic';
      if (!ready && s.cd < 90) {
        g.fillStyle = 'rgba(0,0,0,0.6)'; const f = clamp(s.cd / s.max, 0, 1);
        this.rr(g, x, by, sz, sz * f, 10); g.fill();
        if (s.key !== 'SPACE') this.txt(g, s.cd.toFixed(1), x + sz / 2, by + sz / 2 + 6, 13, '#fff', 'center');
      }
      if (s.key === 'SPACE') { g.fillStyle = 'rgba(176,106,255,0.5)'; this.rr(g, x, by + sz * (1 - p.ult / 100), sz, sz * (p.ult / 100), 10); g.fill(); g.fillStyle = '#fff'; g.font = '24px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.icon, x + sz / 2, by + sz / 2 - 3); g.textBaseline = 'alphabetic'; }
      this.txt(g, s.key, x + sz / 2, by + sz + 12, 10, '#aab', 'center');
      if (s.extra) this.txt(g, s.extra, x + sz - 6, by + 14, 12, '#ffd24a', 'right');
    });

    // --- bottom-center: weapons ---
    if (!p.vehicle) {
      const n = p.weapons.length, ws = 54, gap = 6;
      const totalW = n * ws + (n - 1) * gap;
      let wx = sw / 2 - totalW / 2 + 70;
      if (wx < bx + 5 * (sz + 8) + 6) wx = bx + 5 * (sz + 8) + 6;
      const wy = sh - 70;
      p.weapons.forEach((s, i) => {
        const w = WEAPONS[s.id];
        const x = wx + i * (ws + gap);
        const sel = i === p.cur;
        g.fillStyle = sel ? 'rgba(30,40,70,0.9)' : 'rgba(8,10,20,0.7)'; this.rr(g, x, wy - (sel ? 6 : 0), ws, ws, 8); g.fill();
        g.strokeStyle = sel ? w.color : 'rgba(255,255,255,0.18)'; g.lineWidth = sel ? 2.5 : 1.2; this.rr(g, x, wy - (sel ? 6 : 0), ws, ws, 8); g.stroke();
        g.font = '22px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(w.icon, x + ws / 2, wy + 20 - (sel ? 6 : 0)); g.textBaseline = 'alphabetic';
        this.txt(g, String(i + 1), x + 8, wy + 12 - (sel ? 6 : 0), 10, '#aab', 'center');
        const ammoTxt = s.id === 'pistol' ? `${s.mag}/∞` : `${s.mag}/${s.reserve}`;
        this.txt(g, ammoTxt, x + ws / 2, wy + ws - 6 - (sel ? 6 : 0), 10, s.mag === 0 ? '#ff6a6a' : '#ddd', 'center');
      });
      // current weapon big
      const cw = p.weapons[p.cur], w = WEAPONS[cw.id];
      this.txt(g, w.name.toUpperCase(), sw - 16, sh - 52, 14, w.color, 'right');
      this.txt(g, p.buffs.rage > 0 ? '∞' : `${cw.mag}`, sw - 16, sh - 18, 32, cw.mag === 0 ? '#ff6a6a' : '#fff', 'right');
      this.txt(g, cw.id === 'pistol' ? '/ ∞' : `/ ${cw.reserve}`, sw - 16 - (String(cw.mag).length * 18 + 8), sh - 18, 16, '#aab', 'right');
      if (p.reloadT > 0) this.txt(g, 'RELOADING...', sw - 16, sh - 78, 12, '#ffd24a', 'right');
    } else {
      const v = p.vehicle;
      this.txt(g, v.def.name.toUpperCase(), sw - 16, sh - 52, 14, '#4fd2ff', 'right');
      this.txt(g, '[E] EXIT VEHICLE', sw - 16, sh - 24, 13, '#fff', 'right');
    }

    // banner
    if (this.banner.t > 0) {
      const a = clamp(this.banner.t / 0.5, 0, 1) * clamp((3 - (3.5 - this.banner.t)) / 3, 0, 1);
      g.globalAlpha = clamp(this.banner.t / 0.6, 0, 1);
      void a;
      g.font = 'bold 44px system-ui, sans-serif'; g.textAlign = 'center';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.strokeText(this.banner.text, sw / 2, sh * 0.26); g.fillStyle = this.banner.color; g.fillText(this.banner.text, sw / 2, sh * 0.26);
      if (this.banner.sub) { g.font = 'bold 18px system-ui, sans-serif'; g.lineWidth = 4; g.strokeText(this.banner.sub, sw / 2, sh * 0.26 + 32); g.fillStyle = '#fff'; g.fillText(this.banner.sub, sw / 2, sh * 0.26 + 32); }
      g.globalAlpha = 1;
    }
    if (this.hint > 0 && this.time > 3) {
      g.globalAlpha = clamp(this.hint, 0, 1);
      this.txt(g, 'WASD move • Mouse aim & shoot • R reload • SHIFT dash • Q skill • SPACE ultimate • G grenade • V melee • E vehicle • 1-9 / wheel weapons', sw / 2, sh - 100, 13, '#fff', 'center');
      g.globalAlpha = 1;
    }

    // crosshair
    const mxp = this.mouse.x, myp = this.mouse.y;
    const w = p.vehicle ? null : WEAPONS[p.weapons[p.cur].id];
    const col = w ? w.color : '#4fd2ff';
    g.strokeStyle = col; g.lineWidth = 2;
    const cr = 11 + (p.fireCd > 0 ? 5 : 0);
    g.beginPath(); g.arc(mxp, myp, cr, 0, 7); g.stroke();
    g.beginPath();
    g.moveTo(mxp - cr - 6, myp); g.lineTo(mxp - cr + 4, myp); g.moveTo(mxp + cr + 6, myp); g.lineTo(mxp + cr - 4, myp);
    g.moveTo(mxp, myp - cr - 6); g.lineTo(mxp, myp - cr + 4); g.moveTo(mxp, myp + cr + 6); g.lineTo(mxp, myp + cr - 4);
    g.stroke();
    g.fillStyle = col; g.beginPath(); g.arc(mxp, myp, 1.8, 0, 7); g.fill();
    if (!p.vehicle && p.reloadT > 0) {
      const f = 1 - p.reloadT / (WEAPONS[p.weapons[p.cur].id].reload * (p.buffs.rage > 0 ? 0.3 : 1));
      g.strokeStyle = '#ffd24a'; g.lineWidth = 3; g.beginPath(); g.arc(mxp, myp, cr + 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.stroke();
    }
  }
}

export const ALL_ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];
