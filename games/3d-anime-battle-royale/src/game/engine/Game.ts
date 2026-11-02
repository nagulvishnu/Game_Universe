import { Vector3 } from 'three';
import { MATCH_SEED_DEFAULT, MODES, PLANE_ALT, PLANE_SPEED, ZONE_PHASES, ZONE_START_RADIUS } from '../data/config';
import { CHARACTERS, botLook, botName, lookFor } from '../data/characters';
import { ARMOR_TIERS, HELMET_TIERS, ITEMS, PACK_TIERS, rollItem } from '../data/items';
import { WEAPONS, WeaponInst, newWeapon, weaponStats, ATTACHMENTS } from '../data/weapons';
import { World, groundAt } from '../world/colliders';
import { getIslandWorld, getTrainingWorld } from '../world/island';
import { clamp, lerp, mulberry32, Rng, rand } from '../util';
import { Bullet, Fighter, FeedItem, FxEvent, Grenade, Loot, Smoke, SoundEvent, Vehicle } from './types';
import { botAct, botAir, botHear, botThink, createBot, planDrop } from './bots';
import { damage, eliminate, newBullet, updateBullets, updateGrenades, updateShooting, updateThrow } from './combat';
import { attach, detach, dropItem, dropSlot, equipSlot, giveAll, pickup, startHeal, startReload, updateTimers, capacity, load } from './inventory';
import { stepAir, stepGround } from './movement';
import { CamPose, Input, cameraPose, computeAimDir, playerControl } from './player';
import { damageVehicle, enterVehicle, exitVehicle, spawnVehicle, updateVehicle, VEH } from './vehicles';

export interface GameOptions { mode: 'classic' | 'blitz' | 'training'; seed: number; charId: string; skin: number; sens: number; autoPickup: boolean; name: string }

export interface Zone {
  phase: number; state: 'wait' | 'shrink'; timer: number; total: number; cx: number; cz: number; r: number;
  fromX: number; fromZ: number; fromR: number; toCx: number; toCz: number; toR: number; nextCx: number; nextCz: number; nextR: number; dmg: number; final: boolean; tick: number;
}
export interface Plane { pos: Vector3; dir: Vector3; start: Vector3; end: Vector3; t: number; active: boolean; len: number }

export interface MatchResult {
  won: boolean; placement: number; kills: number; damage: number; headshots: number; survival: number; distance: number; killedBy: string; total: number;
  weaponShots: Record<string, number>; winner: string; charId: string; mode: string;
}

export class Game {
  world: World;
  mode: 'match' | 'training';
  rng: Rng;
  seed: number;
  time = 0;
  ended = false;
  paused = false;
  fighters: Fighter[] = [];
  player!: Fighter;
  loot: Loot[] = [];
  lootById = new Map<number, Loot>();
  lootCells = new Map<number, Loot[]>();
  nextLoot = 1;
  pendingLoot: { t: number; item: string; qty: number; x: number; z: number; inst?: WeaponInst }[] = [];
  bullets: Bullet[] = Array.from({ length: 300 }, newBullet);
  grenades: Grenade[] = [];
  smokes: Smoke[] = [];
  vehicles: Vehicle[] = [];
  zone: Zone = null as unknown as Zone;
  plane: Plane = { pos: new Vector3(), dir: new Vector3(), start: new Vector3(), end: new Vector3(), t: 0, active: true, len: 1500 };
  feed: FeedItem[] = [];
  fxQ: FxEvent[] = [];
  sndQ: SoundEvent[] = [];
  aliveCount = 0;
  totalFighters = 0;
  hitmark = { t: -9, head: false, kill: false };
  dmgInd: { ang: number; t: number }[] = [];
  hurtFlash = 0;
  flashWhite = 0;
  prompt: { text: string; color: string } | null = null;
  toasts: { t: number; text: string }[] = [];
  landingMarker: [number, number] | null = null;
  navMarker: [number, number] | null = null;
  spectating: Fighter | null = null;
  specYaw = 0; specPitch = 0; specClick = 0;
  cam = { dist: 3, off: 0.6, fov: 72 };
  selThrow = 'frag';
  pCrouch = false; pProne = false;
  landings: [number, number][] = [];
  dropHint = 0;
  result: MatchResult | null = null;
  winner: Fighter | null = null;
  deathTime = -1;
  onResult: ((r: MatchResult) => void) | null = null;
  resultSent = false;
  pose: CamPose | null = null;
  aimTmp = new Vector3();
  lastHit = { t: -9, amt: 0, head: false };
  zoneTimeScale = 1;
  stepAcc = 0;
  playerJumped = false;
  landedPlayerT = 0;
  vehicleHum = 0;
  pings: { x: number; z: number; t: number }[] = [];

  constructor(public opts: GameOptions) {
    this.mode = opts.mode === 'training' ? 'training' : 'match';
    this.seed = opts.seed || MATCH_SEED_DEFAULT || (Math.floor(Math.random() * 1e9) + 1);
    this.rng = mulberry32(this.seed);
    this.world = this.mode === 'training' ? getTrainingWorld() : getIslandWorld();
    if (this.mode === 'training') this.setupTraining(); else this.setupMatch();
  }

  /* ---------------- setup ---------------- */
  private makePlayer() {
    const p = new Fighter(0, this.opts.name || 'YOU', true, this.opts.charId, lookFor(this.opts.charId, this.opts.skin));
    this.player = p;
    this.fighters.push(p);
    return p;
  }

  private setupMatch() {
    const w = this.world;
    const mode = MODES[this.opts.mode as 'classic'];
    this.zoneTimeScale = mode.zoneTime;
    const r = this.rng;
    // plane route
    const ang = r() * Math.PI;
    const dir = new Vector3(Math.cos(ang), 0, Math.sin(ang));
    const off = new Vector3((r() - 0.5) * 300, 0, (r() - 0.5) * 300);
    const len = 1560;
    this.plane.dir.copy(dir); this.plane.len = len;
    this.plane.start.set(off.x - dir.x * len / 2, PLANE_ALT, off.z - dir.z * len / 2);
    this.plane.end.set(off.x + dir.x * len / 2, PLANE_ALT, off.z + dir.z * len / 2);
    this.plane.pos.copy(this.plane.start);
    const p = this.makePlayer();
    p.yaw = Math.atan2(dir.x, dir.z); p.pitch = -0.25; p.bodyYaw = p.yaw;
    const used = new Set<string>([p.name]);
    for (let i = 1; i <= mode.bots; i++) {
      const f = new Fighter(i, botName(r, used), false, 'bot', botLook(r));
      f.bot = createBot(r);
      f.yaw = p.yaw; f.bodyYaw = f.yaw;
      this.fighters.push(f);
    }
    this.fighters.forEach((f) => f.pos.copy(this.plane.start));
    this.aliveCount = this.totalFighters = this.fighters.length;
    for (const f of this.fighters) if (f.bot) planDrop(this, f);
    // loot
    for (const s of w.lootSpots) {
      const n = (r() < 0.93 ? 1 : 0) + (r() < (s.q > 1.2 ? 0.55 : 0.3) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const it = rollItem(r, s.q * (s.outdoor ? 1.05 : 1));
        const jx = (r() - 0.5) * 0.9, jz = (r() - 0.5) * 0.9;
        const inst = ITEMS[it.id].kind === 'weapon' ? this.randomInst(ITEMS[it.id].ref!) : undefined;
        this.addLoot(s.x + jx + k * 0.6, s.y, s.z + jz, it.id, it.qty, inst);
        if (inst && r() < 0.65) {
          const a = WEAPONS[inst.id].ammo;
          this.addLoot(s.x + jx + 0.7, s.y, s.z + jz + 0.5, 'ammo_' + a, a === 'sniper' ? 8 : a === 'shell' ? 8 : 30);
        }
      }
    }
    // vehicles
    const types: Vehicle['type'][] = ['jeep', 'jeep', 'sports', 'sports', 'bike', 'bike', 'jeep'];
    w.vehicleSpots.forEach((s, i) => spawnVehicle(this, types[i % types.length], s.x, s.z, s.yaw));
    // zone
    const z0 = { x: (r() - 0.5) * 80, z: (r() - 0.5) * 80 };
    this.zone = { phase: 0, state: 'wait', timer: ZONE_PHASES[0].wait * this.zoneTimeScale, total: 1, cx: z0.x, cz: z0.z, r: ZONE_START_RADIUS, fromX: z0.x, fromZ: z0.z, fromR: ZONE_START_RADIUS, toCx: z0.x, toCz: z0.z, toR: ZONE_START_RADIUS, nextCx: 0, nextCz: 0, nextR: 1, dmg: ZONE_PHASES[0].dmg, final: false, tick: 0 };
    this.pickNextZone();
    this.toast('Fly over Vantara Island — press SPACE to jump');
  }

  private setupTraining() {
    const p = this.makePlayer();
    p.state = 'ground'; p.pos.set(0, this.world.heightAt(0, 70), 70); p.yaw = Math.PI; p.bodyYaw = Math.PI;
    giveAll(p);
    this.aliveCount = 1; this.totalFighters = 1;
    const mk = (x: number, z: number, moving: number) => {
      const f = new Fighter(this.fighters.length, 'Target ' + this.fighters.length, false, 'dummy', botLook(this.rng));
      f.dummy = true; f.state = 'ground'; f.pos.set(x, this.world.heightAt(x, z), z); f.dummyHome.copy(f.pos); f.dummyMove = moving; f.yaw = 0; f.bodyYaw = 0;
      f.dummyT = this.rng() * 6;
      this.fighters.push(f);
    };
    for (const x of [-28, -14, 0, 14, 28]) mk(x, -60, 0);
    for (const x of [-20, 0, 20]) mk(x, -35, 1);
    mk(-10, -90, 2); mk(10, -100, 2); mk(0, -108, 2);
    // weapon racks (infinite)
    const ids = Object.keys(WEAPONS);
    ids.forEach((id, i) => this.addLoot(-36 + i * 8, this.world.heightAt(-36 + i * 8, 85), 85, 'w_' + id, 1, newWeapon(id), undefined, true));
    (['light', 'rifle', 'sniper', 'shell'] as const).forEach((a, i) => this.addLoot(-12 + i * 8, this.world.heightAt(-12 + i * 8, 95), 95, 'ammo_' + a, 90, undefined, undefined, true));
    Object.keys(ATTACHMENTS).forEach((a, i) => this.addLoot(-40 + i * 6, this.world.heightAt(-40 + i * 6, 100), 100, 'att_' + a, 1, undefined, undefined, true));
    ['armor_1', 'armor_2', 'armor_3', 'helmet_2', 'helmet_3', 'pack_3', 'medkit', 'bandage', 'frag', 'smoke', 'flash'].forEach((a, i) => this.addLoot(-35 + i * 7, this.world.heightAt(-35 + i * 7, 108), 108, a, ITEMS[a].qty ? 3 : 1, undefined, undefined, true));
    const vt: Vehicle['type'][] = ['jeep', 'sports', 'bike'];
    vt.forEach((t, i) => spawnVehicle(this, t, 40 + i * 12, 60, 0));
    this.zone = { phase: 0, state: 'wait', timer: 1e9, total: 1, cx: 0, cz: 0, r: 9999, fromX: 0, fromZ: 0, fromR: 9999, toCx: 0, toCz: 0, toR: 9999, nextCx: 0, nextCz: 0, nextR: 9999, dmg: 0, final: false, tick: 0 };
    this.toast('Training Ground — test every weapon. Pick up gear from the racks (F).');
  }

  private randomInst(id: string): WeaponInst {
    const inst = newWeapon(id);
    inst.mag = Math.max(1, Math.round(WEAPONS[id].mag * (0.4 + this.rng() * 0.6)));
    return inst;
  }

  pickNextZone() {
    const z = this.zone;
    const ph = ZONE_PHASES[Math.min(z.phase, ZONE_PHASES.length - 1)];
    const maxOff = Math.max(0, z.r - ph.radius) * 0.85;
    let nx = z.cx, nz = z.cz;
    for (let i = 0; i < 25; i++) {
      const a = this.rng() * 6.283, d = Math.sqrt(this.rng()) * maxOff;
      nx = z.cx + Math.cos(a) * d; nz = z.cz + Math.sin(a) * d;
      if (this.world.heightAt(nx, nz) > 2) break;
    }
    z.nextCx = nx; z.nextCz = nz; z.nextR = ph.radius;
  }

  /* ---------------- helpers used by subsystems ---------------- */
  sound(e: SoundEvent) { if (this.sndQ.length < 80) this.sndQ.push(e); }
  fx(e: FxEvent) { if (this.fxQ.length < 200) this.fxQ.push(e); }
  toast(text: string) { this.toasts.push({ t: this.time, text }); if (this.toasts.length > 4) this.toasts.shift(); }
  freeBullet() {
    for (const b of this.bullets) if (!b.active) return b;
    return this.bullets[Math.floor(Math.random() * this.bullets.length)];
  }
  damageVehicle(v: Vehicle, amt: number, by: Fighter | null) { damageVehicle(this, v, amt, by); }

  stepSound(f: Fighter) {
    if (f.isPlayer || Math.hypot(f.pos.x - this.player.pos.x, f.pos.z - this.player.pos.z) < 38)
      this.sound({ k: 'step', x: f.pos.x, y: f.pos.y, z: f.pos.z, run: f.sprinting || f.stance === 'stand' });
    if (f.stance === 'stand') this.alertShot(f, f.sprinting ? 26 : 14, true);
  }

  alertShot(src: Fighter | null, radius: number, quiet = false) {
    if (!src || this.mode === 'training') return;
    for (const f of this.fighters) {
      if (!f.bot || f === src || !f.alive || f.state !== 'ground') continue;
      const d = Math.hypot(f.pos.x - src.pos.x, f.pos.z - src.pos.z);
      if (d < radius) botHear(f, src.pos.x, src.pos.z, this.time);
    }
    const pp = this.player;
    if (src !== pp && !quiet && Math.hypot(src.pos.x - pp.pos.x, src.pos.z - pp.pos.z) < Math.min(radius, 260)) { this.pings.push({ x: src.pos.x, z: src.pos.z, t: this.time }); if (this.pings.length > 12) this.pings.shift(); }
  }

  landingCount(x: number, z: number, r: number) { let n = 0; for (const l of this.landings) if (Math.hypot(l[0] - x, l[1] - z) < r) n++; return n; }
  noteLanding(x: number, z: number) { this.landings.push([x, z]); }

  buildingAt(x: number, z: number) {
    for (const b of this.world.buildings) if (Math.abs(x - b.x) < b.w / 2 + 1.5 && Math.abs(z - b.z) < b.d / 2 + 1.5) return b;
    return null;
  }

  private lc(x: number, z: number) { return Math.floor((x + 800) / 24) * 100 + Math.floor((z + 800) / 24); }
  addLoot(x: number, y: number, z: number, item: string, qty: number, inst?: WeaponInst, cond?: number, respawn = false) {
    const l: Loot = { id: this.nextLoot++, x, y, z, item, qty, inst, cond, respawn, t: this.time };
    this.loot.push(l); this.lootById.set(l.id, l);
    const k = this.lc(x, z);
    let c = this.lootCells.get(k);
    if (!c) { c = []; this.lootCells.set(k, c); }
    c.push(l);
    return l;
  }
  spawnLoot(x: number, z: number, item: string, qty: number, inst?: WeaponInst, cond?: number) {
    const y = groundAt(this.world, x, z, this.dropHint + 0.5, 0.6, 0.3);
    return this.addLoot(x, y, z, item, qty, inst, cond);
  }
  removeLoot(l: Loot) {
    if (!this.lootById.delete(l.id)) return;
    const i = this.loot.indexOf(l);
    if (i >= 0) { this.loot[i] = this.loot[this.loot.length - 1]; this.loot.pop(); }
    const c = this.lootCells.get(this.lc(l.x, l.z));
    if (c) { const j = c.indexOf(l); if (j >= 0) c.splice(j, 1); }
    if (l.respawn) this.pendingLoot.push({ t: this.time + 4, item: l.item, qty: l.qty, x: l.x, z: l.z, inst: l.inst ? { ...l.inst, att: {} } : undefined });
  }
  lootNear(x: number, z: number, r: number): Loot[] {
    const out: Loot[] = [];
    const c0x = Math.floor((x - r + 800) / 24), c1x = Math.floor((x + r + 800) / 24), c0z = Math.floor((z - r + 800) / 24), c1z = Math.floor((z + r + 800) / 24);
    for (let i = c0x; i <= c1x; i++) for (let j = c0z; j <= c1z; j++) {
      const c = this.lootCells.get(i * 100 + j);
      if (!c) continue;
      for (const l of c) if (Math.hypot(l.x - x, l.z - z) <= r) out.push(l);
    }
    return out;
  }
  botPickup(f: Fighter, l: Loot) { this.dropHint = f.pos.y; pickup(this, f, l); }

  nearestInteract(f: Fighter): { loot?: Loot; veh?: Vehicle; d: number } | null {
    let best: { loot?: Loot; veh?: Vehicle; d: number } | null = null;
    for (const l of this.lootNear(f.pos.x, f.pos.z, 3)) {
      const d = Math.hypot(l.x - f.pos.x, l.z - f.pos.z) + Math.abs(l.y - f.pos.y) * 0.8;
      if (d < 2.8 && (!best || d < best.d)) best = { loot: l, d };
    }
    for (const v of this.vehicles) {
      if (v.dead || v.driver) continue;
      const d = Math.hypot(v.pos.x - f.pos.x, v.pos.z - f.pos.z);
      if (d < 3.6 && (!best || d - 1 < best.d)) best = { veh: v, d: d - 1 };
    }
    return best;
  }

  /* ---------------- player actions (UI + input) ---------------- */
  playerJump() {
    const p = this.player;
    if (p.state !== 'plane') return;
    p.state = 'freefall'; p.pos.copy(this.plane.pos); p.pos.y -= 3;
    p.vel.set(this.plane.dir.x * 18, -4, this.plane.dir.z * 18);
    p.freefallT = 0; this.playerJumped = true;
    p.pitch = -0.35;
    p.yaw = Math.atan2(this.plane.dir.x, this.plane.dir.z);
    this.toast('Hold W to dive · SPACE opens parachute · steer with WASD');
  }
  cycleSpectate() {
    const alive = this.fighters.filter((f) => f.alive && f !== this.player && f.state !== 'plane');
    if (!alive.length) { this.spectating = null; return; }
    const i = this.spectating ? alive.indexOf(this.spectating) : -1;
    this.spectating = alive[(i + 1) % alive.length];
  }
  cycleThrow() {
    const order = ['frag', 'smoke', 'flash'];
    const p = this.player;
    for (let i = 1; i <= 3; i++) { const n = order[(order.indexOf(this.selThrow) + i) % 3]; if (p.throws[n] > 0) { this.selThrow = n; return; } }
  }
  useConsumable() {
    const p = this.player;
    if (p.hp <= 50 && p.heal.medkit > 0) startHeal(this, p, 'medkit');
    else if (p.hp < 75 && p.heal.bandage > 0) startHeal(this, p, 'bandage');
    else if (p.hp < 100 && p.heal.medkit > 0) startHeal(this, p, 'medkit');
    else this.toast(p.hp >= 100 ? 'Health is full' : 'No healing items');
  }
  ui = {
    equip: (s: number) => equipSlot(this, this.player, s),
    dropSlot: (s: number) => { this.dropHint = this.player.pos.y; dropSlot(this, this.player, s); },
    dropItem: (k: string, id: string) => { this.dropHint = this.player.pos.y; dropItem(this, this.player, k, id); },
    heal: (id: string) => startHeal(this, this.player, id),
    attach: (slot: number, id: string) => attach(this.player, slot, id),
    detach: (slot: number, s: 'sight' | 'mag' | 'muzzle' | 'grip') => detach(this.player, slot, s),
    reload: () => startReload(this, this.player),
    throwSel: (t: string) => { if (this.player.throws[t] > 0) this.selThrow = t; },
  };
  setMarker(x: number, z: number, landing: boolean) {
    if (landing) this.landingMarker = [x, z]; else this.navMarker = [x, z];
  }

  /* ---------------- update ---------------- */
  update(dt: number, inp: Input) {
    if (this.paused) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const p = this.player;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.4);
    this.flashWhite = Math.max(0, this.flashWhite - dt * 0.35);
    if (this.dmgInd.length && this.time - this.dmgInd[0].t > 2.2) this.dmgInd.shift();
    // player input -> cmd
    playerControl(this, p, inp, dt);
    // camera pose + aim ray (needs to follow input)
    this.pose = cameraPose(this, dt);
    if (p.alive && p.state === 'ground') p.cmd.aimDir = computeAimDir(this, p, this.pose, this.aimTmp);
    this.updatePlane(dt);
    this.updateZone(dt);
    for (const v of this.vehicles) updateVehicle(this, v, dt);
    const px = p.pos.x, pz = p.pos.z;
    for (const f of this.fighters) this.updateFighter(f, dt, px, pz);
    updateBullets(this, dt);
    updateGrenades(this, dt);
    for (let i = this.smokes.length - 1; i >= 0; i--) { this.smokes[i].t += dt; if (this.smokes[i].t > 22) this.smokes.splice(i, 1); }
    // loot respawn (training)
    for (let i = this.pendingLoot.length - 1; i >= 0; i--) {
      const pl = this.pendingLoot[i];
      if (this.time >= pl.t) { this.addLoot(pl.x, this.world.heightAt(pl.x, pl.z), pl.z, pl.item, pl.qty, pl.inst, undefined, true); this.pendingLoot.splice(i, 1); }
    }
    this.updatePrompt(dt);
    this.feed = this.feed.filter((f) => this.time - f.t < 7);
    this.toasts = this.toasts.filter((t) => this.time - t.t < 4.5);
    // spectator upkeep
    if (!p.alive) {
      if (!this.spectating || !this.spectating.alive) { const k = this.fighters[p.killerId]; this.spectating = k && k.alive ? k : null; if (!this.spectating) this.cycleSpectate(); }
    }
  }

  private updatePlane(dt: number) {
    if (this.mode !== 'match') return;
    const pl = this.plane;
    if (!pl.active) return;
    pl.t += dt;
    const d = pl.t * PLANE_SPEED;
    pl.pos.set(pl.start.x + pl.dir.x * d, PLANE_ALT, pl.start.z + pl.dir.z * d);
    if (d >= pl.len) {
      pl.active = false;
      if (this.player.state === 'plane') this.playerJump();
      for (const f of this.fighters) if (f.state === 'plane') this.botJump(f);
    }
  }

  private botJump(f: Fighter) {
    f.state = 'freefall'; f.pos.copy(this.plane.pos); f.pos.y -= 3; f.freefallT = 0;
    f.vel.set(this.plane.dir.x * 18, -4, this.plane.dir.z * 18);
    f.bot!.mode = 'drop';
  }

  private updateZone(dt: number) {
    if (this.mode !== 'match') return;
    const z = this.zone;
    const ph = ZONE_PHASES[Math.min(z.phase, ZONE_PHASES.length - 1)];
    z.dmg = ph.dmg;
    if (z.final) { /* hold */ }
    else if (z.state === 'wait') {
      z.timer -= dt;
      if (z.timer <= 0) {
        z.state = 'shrink'; z.total = ph.shrink * this.zoneTimeScale; z.timer = z.total;
        z.fromX = z.cx; z.fromZ = z.cz; z.fromR = z.r; z.toCx = z.nextCx; z.toCz = z.nextCz; z.toR = z.nextR;
        this.toast('⚠ THE ZONE IS SHRINKING — MOVE TO THE SAFE ZONE'); this.sound({ k: 'zone' });
      }
    } else {
      z.timer -= dt;
      const t = clamp(1 - z.timer / z.total, 0, 1);
      z.cx = lerp(z.fromX, z.toCx, t); z.cz = lerp(z.fromZ, z.toCz, t); z.r = lerp(z.fromR, z.toR, t);
      if (z.timer <= 0) {
        z.phase++;
        z.cx = z.toCx; z.cz = z.toCz; z.r = z.toR;
        if (z.phase >= ZONE_PHASES.length) { z.final = true; z.state = 'wait'; z.timer = 0; }
        else {
          z.state = 'wait'; z.timer = ZONE_PHASES[z.phase].wait * this.zoneTimeScale;
          this.pickNextZone();
          this.toast(`SAFE ZONE ${z.phase + 1} ANNOUNCED — shrinks in ${Math.round(z.timer)}s`); this.sound({ k: 'zone' });
        }
      }
    }
    z.tick += dt;
    if (z.tick >= 1) {
      z.tick -= 1;
      for (const f of this.fighters) {
        if (!f.alive || f.state === 'plane') continue;
        if (Math.hypot(f.pos.x - z.cx, f.pos.z - z.cz) > z.r) damage(this, f, z.dmg, 'body', null, 'zone', 'zone');
      }
    }
  }

  private updateFighter(f: Fighter, dt: number, px: number, pz: number) {
    if (!f.alive) {
      f.deadT += dt;
      if (f.dummy && this.time - f.diedAt > 3) { f.alive = true; f.hp = 100; f.state = 'ground'; f.deadT = 0; f.pos.copy(f.dummyHome); }
      return;
    }
    if (f.dummy) { this.updateDummy(f, dt); return; }
    const bot = f.bot;
    switch (f.state) {
      case 'plane': {
        f.pos.copy(this.plane.pos);
        if (bot && this.plane.t >= bot.jumpPlan.t) this.botJump(f);
        return;
      }
      case 'freefall': case 'chute': {
        if (bot) botAir(this, f, dt);
        stepAir(this, f, dt, bot ? bot.jumpPlan.chuteAlt : 90, true);
        if ((f.state as string) === 'ground' && bot) { bot.mode = 'roam'; bot.thinkT = 0; bot.landed = true; }
        if ((f.state as string) === 'ground' && f.isPlayer) this.landedPlayerT = this.time;
        return;
      }
      case 'vehicle': {
        updateTimers(this, f, dt);
        if (f.vehicle) f.pos.copy(f.vehicle.pos);
        return;
      }
    }
    // ground
    if (bot) {
      const dp = Math.hypot(f.pos.x - px, f.pos.z - pz);
      bot.thinkT -= dt;
      const engaged = bot.mode === 'fight' || bot.mode === 'cover';
      if (bot.thinkT <= 0) { botThink(this, f); bot.thinkT = engaged ? 0.12 : dp < 80 ? 0.15 : dp < 200 ? 0.35 : 0.8; }
      let sdt = dt;
      if (dp > 170 && !engaged && bot.mode !== 'fight') {
        bot.zoneT += dt;
        if (bot.zoneT < 0.1) return;
        sdt = bot.zoneT; bot.zoneT = 0;
      }
      botAct(this, f, sdt);
      f.aiming = f.cmd.aim;
      updateTimers(this, f, sdt);
      stepGround(this, f, sdt);
      updateShooting(this, f);
      updateThrow(this, f, sdt);
      f.bodyYaw += ((((f.yaw - f.bodyYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI)) * Math.min(1, sdt * 10);
      return;
    }
    // player on ground
    updateTimers(this, f, dt);
    stepGround(this, f, dt);
    updateShooting(this, f);
    updateThrow(this, f, dt);
    if (f.landT > 0) f.cmd.sprint = false;
  }

  private updateDummy(f: Fighter, dt: number) {
    f.dummyT += dt;
    f.hitT -= dt;
    const prev = f.pos.x;
    if (f.dummyMove === 1) f.pos.x = f.dummyHome.x + Math.sin(f.dummyT * 0.7) * 18;
    else if (f.dummyMove === 2) { f.pos.x = f.dummyHome.x + Math.sin(f.dummyT * 0.5) * 30; }
    f.pos.y = this.world.heightAt(f.pos.x, f.pos.z);
    f.speedSm = Math.abs(f.pos.x - prev) / Math.max(dt, 1e-4);
    f.vel.x = (f.pos.x - prev) / Math.max(dt, 1e-4);
    f.stride += Math.abs(f.pos.x - prev);
    f.yaw = f.speedSm > 0.2 ? Math.sign(f.vel.x) * Math.PI / 2 : 0; f.bodyYaw = f.yaw;
    f.moving = f.speedSm > 0.2;
  }

  private updatePrompt(dt: number) {
    const p = this.player;
    this.prompt = null;
    if (!p.alive) return;
    if (p.state === 'plane') { this.prompt = { text: 'SPACE  Jump from aircraft', color: '#38bdf8' }; return; }
    if (p.state === 'freefall') { this.prompt = { text: 'SPACE  Open parachute', color: '#38bdf8' }; return; }
    if (p.state === 'vehicle') { this.prompt = { text: 'F  Exit vehicle', color: '#38bdf8' }; return; }
    if (p.state !== 'ground') return;
    const t = this.nearestInteract(p);
    if (t?.loot) {
      const def = ITEMS[t.loot.item];
      const col = { common: '#cbd5e0', uncommon: '#4ade80', rare: '#38bdf8', epic: '#c084fc', legendary: '#fbbf24' }[def.rarity];
      this.prompt = { text: `F  ${def.name}${t.loot.qty > 1 ? ' x' + t.loot.qty : ''}  [${def.rarity.toUpperCase()}]`, color: col };
      if (this.opts.autoPickup && (def.kind === 'ammo' || def.kind === 'heal' || def.kind === 'throw') && t.d < 1.5) {
        let ok = true;
        if (def.kind === 'ammo') ok = p.slots.some((s) => s && WEAPONS[s.id].ammo === def.ref);
        if (ok) { const n = pickup(this, p, t.loot); if (n) { this.toast(`Picked up ${n}`); this.sound({ k: 'pickup' }); } }
      }
    } else if (t?.veh) this.prompt = { text: `F  Enter ${VEH[t.veh.type].name}`, color: '#38bdf8' };
    void dt;
  }

  /* ---------------- match outcome ---------------- */
  onDeath(v: Fighter, killer: Fighter | null) {
    if (v.dummy) { return; }
    if (this.mode === 'training') {
      if (v.isPlayer) setTimeout(() => this.respawnTrainingPlayer(), 1500);
      return;
    }
    if (v.isPlayer) {
      this.deathTime = this.time;
      this.spectating = killer && killer.alive ? killer : null;
      this.finish(false);
    }
    this.checkEnd();
  }

  private respawnTrainingPlayer() {
    const p = this.player;
    p.alive = true; p.hp = 100; p.state = 'ground'; p.pos.set(0, this.world.heightAt(0, 70), 70); p.vel.set(0, 0, 0); p.deadT = 0;
    this.aliveCount = 1;
  }

  checkEnd() {
    if (this.mode !== 'match' || this.ended) return;
    const alive = this.fighters.filter((f) => f.alive);
    if (alive.length <= 1) {
      this.ended = true;
      let w = alive[0] ?? null;
      if (!w) w = this.fighters.reduce((a, b) => (a.placement < b.placement && b.placement > 0 ? a : b));
      this.winner = w;
      if (w.alive) { w.victory = true; w.placement = 1; }
      if (w === this.player) this.finish(true);
      else if (!this.resultSent) this.finish(false);
    }
  }

  finish(won: boolean) {
    if (this.resultSent) { if (won && this.result) { this.result.won = true; this.result.placement = 1; } return; }
    this.resultSent = true;
    const p = this.player;
    const r: MatchResult = {
      won, placement: won ? 1 : p.placement || 1, kills: p.kills, damage: Math.round(p.damageDealt), headshots: p.headshots,
      survival: this.time - (this.playerJumped ? 0 : 0), distance: p.distance, killedBy: p.killedBy, total: this.totalFighters,
      weaponShots: { ...p.weaponShots }, winner: this.winner?.name ?? '', charId: p.charId, mode: this.opts.mode,
    };
    this.result = r;
    this.onResult?.(r);
  }

  /** compact UI snapshot */
  snapshot() {
    const p = this.player;
    const w = p.weapon;
    const st = w ? weaponStats(w) : null;
    const z = this.zone;
    return {
      hp: Math.ceil(p.hp), armor: p.armor, armorHp: Math.ceil(p.armorHp), armorMax: ARMOR_TIERS[p.armor].hp, helmet: p.helmet, helmetHp: Math.ceil(p.helmetHp), helmetMax: HELMET_TIERS[p.helmet].hp,
      pack: p.pack, packName: PACK_TIERS[p.pack].name, load: Math.round(load(p) * 10) / 10, cap: capacity(p),
      state: p.state, alive: p.alive,
      weapon: w && st ? { id: w.id, name: st.def.name, cat: st.def.cat, mag: w.mag, magSize: st.magSize, reserve: p.ammo[st.def.ammo], mode: st.def.mode, zoom: st.zoom } : null,
      slots: p.slots.map((s) => (s ? { id: s.id, name: WEAPONS[s.id].name, mag: s.mag, magSize: weaponStats(s).magSize, att: { ...s.att }, ammo: WEAPONS[s.id].ammo, cat: WEAPONS[s.id].cat } : null)),
      cur: p.cur, ammo: { ...p.ammo }, heal: { ...p.heal }, throws: { ...p.throws }, selThrow: this.selThrow, atts: { ...p.atts },
      kills: p.kills, alivecount: this.aliveCount, total: this.totalFighters, time: this.time,
      zone: { state: z.state, timer: Math.max(0, z.timer), phase: z.phase + 1, dmg: z.dmg, final: z.final, outside: Math.hypot(p.pos.x - z.cx, p.pos.z - z.cz) > z.r },
      prompt: this.prompt, reload: p.reloadT > 0 ? 1 - p.reloadT / Math.max(0.01, p.reloadTotal) : -1, healing: p.healT > 0 ? p.healItem : '', healTotal: p.healItem === 'bandage' ? 2.2 : 4.2, healT: p.healT,
      feed: this.feed.map((f) => ({ ...f })), toasts: this.toasts.map((t) => t.text),
      vehicle: p.vehicle ? { name: VEH[p.vehicle.type].name, hp: Math.round(p.vehicle.hp / p.vehicle.maxHp * 100), speed: Math.round(Math.abs(p.vehicle.speed) * 3.6) } : null,
      scoped: !!(this.pose?.fpv && p.aiming), aiming: p.aiming, stance: p.stance,
      planeT: this.plane.t, planeAlive: this.plane.active, jumped: this.playerJumped,
      ended: this.ended, winner: this.winner?.name ?? '', spectating: this.spectating?.name ?? '',
      flash: Math.min(1, this.flashWhite), hurt: this.hurtFlash,
      hitT: this.hitmark.t, hitHead: this.hitmark.head, hitKill: this.hitmark.kill,
      result: this.result, mode: this.mode, deathAt: this.deathTime,
      sprinting: p.sprinting, throwSel: this.selThrow,
      yaw: p.yaw, px: p.pos.x, pz: p.pos.z, landing: this.landingMarker, nav: this.navMarker,
      dmgInd: this.dmgInd.map((d) => ({ ang: d.ang - p.yaw, age: this.time - d.t })), lastHit: this.lastHit,
    };
  }

  dispose() {
    this.fighters.length = 0; this.loot.length = 0; this.lootById.clear(); this.lootCells.clear(); this.bullets.length = 0; this.vehicles.length = 0;
    this.fxQ.length = 0; this.sndQ.length = 0;
  }
}

export { eliminate, enterVehicle, exitVehicle, rand, CHARACTERS };
export type HudSnap = ReturnType<Game['snapshot']>;
