import * as THREE from 'three';
import type { Game } from './engine';
import { Humanoid, makeVehicle, makeQuadruped, makeBird, makeFish, makeDragon, SKINS, SHIRTS, PANTS, HAIRS, CAR_COLORS, mat } from './models';
import type { VehicleRig, AnimalRig } from './models';
import { P, CITY_R, zoneAt } from './terrain';
import { rand, pick, clamp, angleLerp, randInt } from './noise';

const V = new THREE.Vector3(), V2 = new THREE.Vector3();
const AIR = new Set(['airliner', 'plane', 'helicopter', 'ufo']);

export class Ent {
  id = 0; kind: 'npc' | 'animal' | 'vehicle' = 'npc'; type = '';
  obj = new THREE.Group();
  vel = new THREE.Vector3(); ang = new THREE.Vector3();
  radius = 0.5; height = 1.8; mass = 1; hp = 40;
  alive = true; gone = false; goneT = 0; wrecked = false; deadT = 0;
  state = 'walk'; stateT = 0; heading = 0; speed = 0;
  airborne = false; gravMul = 1; burn = 0; frozen = 0; statue = false; shell: THREE.Mesh | null = null;
  held = false; portalCd = 0; mode = 'free';
  hum?: Humanoid; veh?: VehicleRig; ani?: AnimalRig;
  axis: 'x' | 'z' = 'x'; dir = 1; side = 1; goal: THREE.Vector3 | null = null; thinkT = 0; react = 0;
  bubble: THREE.Sprite | null = null; bubbleT = 0; phase = Math.random() * 100; hidden = false;
  threat = new THREE.Vector3(); sinkT = 0; drown = 0; lastPos = new THREE.Vector3(); scaleMul = 1;
  d: Record<string, any> = {};
}
interface Frame { t: number; items: { e: Ent; x: number; y: number; z: number; rx: number; ry: number; rz: number; alive: boolean; gone: boolean; state: string; hp: number; wrecked: boolean }[] }

export class Entities {
  list: Ent[] = [];
  nextId = 1;
  bubbleMats: Record<string, THREE.SpriteMaterial> = {};
  history: Frame[] = [];
  histT = 0; rewindAcc = 0;
  popT = 0;
  delayed: { t: number; p: THREE.Vector3; r: number }[] = [];
  iceMat: THREE.MeshStandardMaterial;
  goldMat: THREE.MeshStandardMaterial;
  stats = { npc: 0, veh: 0, animals: 0, killed: 0 };

  constructor(public game: Game) {
    this.iceMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, emissive: 0x2288cc, emissiveIntensity: 0.4, flatShading: true });
    this.goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, roughness: 0.2, metalness: 1, emissive: 0xaa7a00, emissiveIntensity: 0.4 });
    const mk = (k: string, text: string, color: string) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const g = cv.getContext('2d')!;
      g.fillStyle = 'rgba(10,12,24,0.78)'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
      g.strokeStyle = color; g.lineWidth = 6; g.stroke();
      g.font = '72px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
      g.fillText(text, 64, 70);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      this.bubbleMats[k] = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true });
    };
    mk('panic', '😱', '#ff6060'); mk('gawk', '😮', '#ffe060'); mk('pray', '🙏', '#ffd24d'); mk('cheer', '🎉', '#60ff90'); mk('fire', '🔥', '#ff8030'); mk('ice', '❄️', '#80e0ff'); mk('talk', '💬', '#a0c0ff');
  }

  // ---------- spawn ----------
  private add(e: Ent, x: number, y: number, z: number) {
    e.id = this.nextId++; e.obj.position.set(x, y, z); e.obj.userData.e = e;
    this.game.scene.add(e.obj); this.list.push(e);
    e.lastPos.set(x, y, z);
    return e;
  }
  spawnNPC(x: number, z: number, grid = false, y?: number): Ent {
    const e = new Ent(); e.kind = 'npc'; e.type = 'human'; e.radius = 0.45; e.height = 1.8; e.hp = 30; e.mass = 1;
    e.hum = new Humanoid({ skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), hair: pick(HAIRS), shoes: 0x222222, scale: rand(0.92, 1.08) });
    e.obj.add(e.hum.root);
    e.heading = rand(0, 6.28);
    e.d.home = new THREE.Vector3(x, 0, z);
    e.mode = grid ? 'grid' : 'free';
    e.d.speed = rand(1.7, 2.5);
    this.add(e, x, y ?? this.game.terrain.heightAt(x, z), z);
    if (grid) this.snapToGrid(e);
    e.state = 'walk';
    e.thinkT = rand(0, 3);
    return e;
  }
  spawnAnimal(type: string, x: number, z: number, y?: number): Ent[] {
    const T = this.game.terrain, out: Ent[] = [];
    const n = type === 'bird' ? 10 : type === 'fish' ? 14 : 1;
    for (let i = 0; i < n; i++) {
      const e = new Ent(); e.kind = 'animal'; e.type = type; e.mode = 'free';
      const ox = n > 1 ? rand(-12, 12) : 0, oz = n > 1 ? rand(-12, 12) : 0;
      let py = y ?? T.heightAt(x + ox, z + oz);
      if (type === 'bird') {
        const r = makeBird(pick([0xe8e8e8, 0x303030, 0x7a5a3a, 0xc04040, 0x4a7ac0]), rand(0.9, 1.6)); e.ani = r; e.mode = 'fly'; e.radius = 0.5; e.height = 0.4; e.hp = 5; py = (y ?? this.game.player.pos.y + 4) + rand(10, 30);
        if (y === undefined) py = Math.max(T.heightAt(x, z), 0) + rand(25, 70);
        e.d.center = new THREE.Vector3(x, py, z);
      } else if (type === 'fish') {
        const r = makeFish(pick([0xff8a30, 0x40a0e0, 0xe0c040, 0x60c0a0, 0xd05080]), rand(0.8, 1.6)); e.ani = r; e.mode = 'swim'; e.radius = 0.4; e.height = 0.4; e.hp = 5;
        py = (y ?? Math.min(-2, this.game.ocean.level - 2)) - rand(0, 10);
      } else if (type === 'whale') {
        e.ani = makeFish(0x3a4a5a, 2.2, true); e.mode = 'swim'; e.radius = 7; e.height = 4; e.hp = 400; e.mass = 40; py = this.game.ocean.level - 8;
      } else if (type === 'dragon') {
        e.ani = makeDragon(pick([0x2a8a3a, 0x9a2a2a, 0x2a4a9a, 0x6a2a8a])); e.mode = 'fly'; e.radius = 8; e.height = 6; e.hp = 600; e.mass = 50; py = (y ?? T.heightAt(x, z)) + 60;
        e.d.center = new THREE.Vector3(x, py, z); e.d.breath = rand(4, 9);
      } else {
        e.ani = makeQuadruped(type); const big = type === 'elephant';
        e.radius = big ? 2 : 0.8; e.height = big ? 3.5 : 1.5; e.hp = big ? 300 : 60; e.mass = big ? 30 : 4;
      }
      e.obj.add(e.ani.group);
      e.heading = rand(0, 6.28); e.d.speed = type === 'wolf' || type === 'horse' ? 3 : type === 'elephant' ? 1.5 : 1.8; e.state = 'walk'; e.d.idle = rand(1, 6);
      this.add(e, x + ox, py, z + oz);
      out.push(e);
    }
    return out;
  }
  spawnVehicle(type: string, x: number, z: number, o: { lane?: boolean; y?: number; orbit?: boolean; parked?: boolean; heading?: number; color?: number } = {}): Ent {
    const e = new Ent(); e.kind = 'vehicle'; e.type = type;
    const rig = makeVehicle(type, o.color ?? pick(CAR_COLORS)); e.veh = rig; e.obj.add(rig.group);
    e.radius = rig.radius; e.height = type === 'bus' ? 3.5 : type === 'truck' ? 3.2 : AIR.has(type) ? 6 : 1.6;
    e.mass = type === 'bus' || type === 'truck' ? 8 : type === 'airliner' ? 40 : AIR.has(type) ? 10 : type === 'boat' ? 8 : 3;
    e.hp = 100; e.heading = o.heading ?? rand(0, 6.28);
    const T = this.game.terrain;
    let y = o.y ?? T.heightAt(x, z);
    if (o.parked) { e.mode = 'static'; }
    else if (AIR.has(type)) {
      e.mode = 'orbit'; y = o.y ?? Math.max(y, 0) + (type === 'helicopter' ? 60 : type === 'ufo' ? 70 : 140);
      e.d.c = new THREE.Vector3(x, 0, z); e.d.R = type === 'helicopter' ? 70 : type === 'ufo' ? 90 : type === 'plane' ? 320 : 700; e.d.a = rand(0, 6.28); e.d.sgn = Math.random() < 0.5 ? 1 : -1;
      e.d.v = type === 'helicopter' ? 22 : type === 'ufo' ? 18 : type === 'plane' ? 55 : 90; e.d.y = y;
    } else if (type === 'boat') { e.mode = 'boat'; e.d.speed = rand(5, 9); y = this.game.ocean.level; }
    else if (o.lane) { e.mode = 'lane'; this.snapVehicle(e, x, z); }
    else e.mode = 'free';
    e.d.speed = e.d.speed ?? rand(7, 12);
    this.add(e, x, y, z);
    if (e.mode === 'free' && !o.parked && !AIR.has(type) && type !== 'boat') this.snapVehicle(e, x, z);
    return e;
  }
  streetPoint() {
    const k = (randInt(0, 9) < 5 ? randInt(-5, -1) : randInt(1, 5)) * P, t = rand(-385, 385);
    return Math.random() < 0.5 ? { x: k, z: t } : { x: t, z: k };
  }
  snapVehicle(e: Ent, x: number, z: number) {
    const kx = Math.round(x / P), kz = Math.round(z / P), dx = Math.abs(x - kx * P), dz = Math.abs(z - kz * P);
    if (Math.max(Math.abs(x), Math.abs(z)) < CITY_R && Math.min(dx, dz) < 9 && !(Math.abs(kx) > 5 && dx < dz) && !(Math.abs(kz) > 5 && dz < dx)) {
      e.mode = 'lane';
      if (dx < dz) { e.axis = 'z'; e.d.k = kx; } else { e.axis = 'x'; e.d.k = kz; }
      e.dir = Math.random() < 0.5 ? 1 : -1;
      e.d.off = e.d.k === 0 ? (Math.random() < 0.5 ? 3 : 7) : 4;
      e.d.vmax = e.d.k === 0 ? rand(20, 30) : rand(10, 15);
      const lat = e.axis === 'x' ? z : x;
      void lat;
      this.placeLane(e, true);
    } else if (Math.abs(z) < 14 && x > -460 && x < 470) { e.mode = 'lane'; e.axis = 'x'; e.d.k = 0; e.dir = Math.random() < 0.5 ? 1 : -1; e.d.off = 3; e.d.vmax = rand(20, 30); this.placeLane(e, true); }
    else if (Math.abs(x) < 14 && z > -420 && z < 820) { e.mode = 'lane'; e.axis = 'z'; e.d.k = 0; e.dir = Math.random() < 0.5 ? 1 : -1; e.d.off = 3; e.d.vmax = rand(20, 30); this.placeLane(e, true); }
    else { e.mode = 'free'; e.d.speed = rand(6, 10); }
  }
  private laneLat(e: Ent) { return e.d.k * P + (e.axis === 'x' ? 1 : -1) * e.dir * e.d.off; }
  private placeLane(e: Ent, snap: boolean) {
    const p = e.obj.position;
    if (e.axis === 'x') { if (snap) p.z = this.laneLat(e); p.y = 4.15; e.heading = e.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { if (snap) p.x = this.laneLat(e); p.y = 4.15; e.heading = e.dir > 0 ? 0 : Math.PI; }
    e.obj.rotation.y = e.heading;
  }
  snapToGrid(e: Ent) {
    const p = e.obj.position;
    const kx = Math.round(p.x / P), kz = Math.round(p.z / P);
    const dx = Math.abs(p.x - kx * P), dz = Math.abs(p.z - kz * P);
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) > CITY_R - 20) { e.mode = 'free'; return; }
    e.mode = 'grid'; e.side = Math.random() < 0.5 ? 1 : -1;
    if (dx < dz) { e.axis = 'z'; } else { e.axis = 'x'; }
    e.dir = Math.random() < 0.5 ? 1 : -1;
  }

  // ---------- reactions & damage ----------
  say(e: Ent, k: string, dur = 3) {
    if (!e.bubble) { e.bubble = new THREE.Sprite(this.bubbleMats[k]); e.bubble.scale.set(1.1, 1.1, 1); e.bubble.position.y = e.height + 0.8; e.bubble.renderOrder = 20; e.obj.add(e.bubble); }
    e.bubble.material = this.bubbleMats[k]; e.bubble.visible = true; e.bubbleT = dur;
  }
  alert(p: THREE.Vector3, r: number, type: 'panic' | 'awe' | 'cheer' = 'panic') {
    for (const e of this.list) {
      if (e.gone || !e.alive || e.held) continue;
      const d = e.obj.position.distanceTo(p);
      if (d > r) continue;
      if (e.kind === 'npc') {
        if (['fall', 'dead', 'burn', 'recover'].includes(e.state)) continue;
        if (type === 'panic') { e.state = 'flee'; e.stateT = rand(5, 11); e.threat.copy(p); e.speed = 6.5; if (Math.random() < 0.6) this.say(e, 'panic', 3); }
        else if (type === 'awe' && e.state !== 'flee') { e.state = 'gawk'; e.stateT = rand(3, 6); e.threat.copy(p); this.say(e, 'gawk', 3); }
        else if (type === 'cheer' && e.state !== 'flee') { e.state = 'cheer'; e.stateT = rand(3, 6); e.threat.copy(p); this.say(e, 'cheer', 3); }
        e.mode = e.mode === 'grid' ? 'grid' : e.mode;
      } else if (e.kind === 'animal' && type === 'panic') { e.state = 'flee'; e.stateT = rand(4, 9); e.threat.copy(p); }
      else if (e.kind === 'vehicle' && type === 'panic' && e.mode === 'lane') { e.d.panic = rand(4, 8); }
    }
  }
  launch(e: Ent, v: THREE.Vector3) {
    if (e.gone || e.mode === 'static' && e.wrecked) { /* still allow */ }
    e.airborne = true; e.vel.add(v);
    if (e.kind === 'npc' && e.alive) { e.state = 'fall'; e.stateT = 99; }
    if (e.kind === 'vehicle') { if (e.mode === 'static') e.mode = 'free'; if (!e.wrecked && v.length() > 8 && !AIR.has(e.type)) e.d.crashArm = true; }
    e.ang.set(rand(-4, 4), rand(-3, 3), rand(-4, 4));
    if (e.kind === 'npc' && this.game.player.invulnerable === false) { /* nothing */ }
  }
  push(e: Ent, dv: THREE.Vector3) {
    if (e.gone || e.held) return;
    if (!e.airborne) this.launch(e, dv); else e.vel.add(dv);
  }
  damage(e: Ent, amount: number, from?: THREE.Vector3) {
    if (!e.alive || e.gone) return;
    if (e.frozen > 0 && amount > 12) { this.shatter(e); return; }
    e.hp -= amount;
    if (e.hp <= 0) this.kill(e, 'damage', from);
  }
  kill(e: Ent, cause = '', from?: THREE.Vector3) {
    if (!e.alive || e.gone) return;
    e.alive = false; this.stats.killed++;
    const g = this.game;
    if (e.frozen > 0) { this.shatter(e); return; }
    if (e.kind === 'vehicle') { this.explodeVehicle(e, from); return; }
    e.state = 'dead'; e.deadT = 0; e.burn = 0; e.speed = 0;
    if (e.bubble) e.bubble.visible = false;
    if (cause === 'burn') g.fx.puff(e.obj.position, 1, undefined, 3);
    if (e.kind === 'npc') this.alert(e.obj.position, 25, 'panic');
  }
  shatter(e: Ent) {
    const g = this.game, p = e.obj.position;
    this.unfreeze(e);
    for (let i = 0; i < 14; i++) g.fx.add.emit(p.x + rand(-1, 1), p.y + e.height * rand(0, 1), p.z + rand(-1, 1), rand(-6, 6), rand(2, 9), rand(-6, 6), rand(0.8, 1.6), 0.5, 0.1, new THREE.Color(0xe0fbff), new THREE.Color(0x60c0ff), 1, 0, 0.5, 14);
    for (let i = 0; i < 6; i++) g.debris.spawn(p.x, p.y + e.height * 0.5, p.z, 0.4, 0.4, 0.4, 0xb8f0ff, rand(-6, 6), rand(2, 8), rand(-6, 6));
    g.audio.play('ice', g.camera.position.distanceTo(p));
    e.alive = false; e.gone = true; e.obj.visible = false;
    g.logUndo(() => { e.gone = false; e.alive = true; e.obj.visible = true; });
  }
  freeze(e: Ent, dur = 12) {
    if (e.gone || e.frozen > 0 || !e.alive) return;
    e.frozen = dur;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), this.iceMat);
    m.scale.set(e.radius * 1.2, e.height * 0.62, e.radius * 1.2); m.position.y = e.height * 0.5;
    e.obj.add(m); e.shell = m; e.vel.set(0, 0, 0); e.speed = 0;
    this.say(e, 'ice', 4);
  }
  statueify(e: Ent) {
    if (e.gone || e.statue || !e.alive) return;
    e.statue = true; e.frozen = 1e9;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), this.goldMat);
    m.scale.set(e.radius * 1.15, e.height * 0.58, e.radius * 1.15); m.position.y = e.height * 0.5;
    e.obj.add(m); e.shell = m;
    e.obj.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== m) o.visible = false; });
    e.shell.visible = true;
  }
  unfreeze(e: Ent) {
    e.frozen = 0;
    if (e.shell) { e.obj.remove(e.shell); e.shell = null; }
  }
  ignite(e: Ent, dur = 5) {
    if (!e.alive || e.gone || e.frozen > 0) { if (e.frozen > 0 && e.alive && !e.statue) this.unfreeze(e); return; }
    if (e.burn > 0) return;
    e.burn = dur; if (e.kind === 'npc') { e.state = 'burn'; e.stateT = dur; this.say(e, 'fire', dur); }
    if (e.kind === 'vehicle') e.d.burnT = dur;
  }
  explodeVehicle(e: Ent, from?: THREE.Vector3) {
    const g = this.game, p = e.obj.position;
    if (e.wrecked) return;
    e.wrecked = true; e.alive = false; e.mode = 'static'; e.state = 'dead';
    const big = AIR.has(e.type) ? 14 : e.type === 'bus' || e.type === 'truck' ? 9 : 6;
    g.fx.explosion(V.copy(p).setY(p.y + 1), big);
    g.audio.play('smallboom', g.camera.position.distanceTo(p));
    const col = e.veh?.body?.color ?? new THREE.Color(0x888888);
    for (let i = 0; i < 6; i++) g.debris.spawn(p.x + rand(-1, 1), p.y + 1, p.z + rand(-1, 1), rand(0.4, 1.2), rand(0.2, 0.5), rand(0.6, 1.6), i < 3 ? col : 0x222222, rand(-9, 9), rand(5, 14), rand(-9, 9));
    if (e.veh?.body) { e.veh.body.color.setHex(0x161412); e.veh.body.metalness = 0.2; e.veh.body.roughness = 0.9; }
    e.veh?.lights.forEach(l => (l.visible = false));
    this.launch(e, V.set(rand(-3, 3), rand(6, 11), rand(-3, 3)).add(from ? V2.copy(p).sub(from).setY(0).normalize().multiplyScalar(5) : V2.set(0, 0, 0)));
    e.d.crashArm = false;
    g.fx.fire(p, 2.2, 30);
    for (const o of this.list) if (o !== e && o.alive && !o.gone && o.obj.position.distanceTo(p) < big * 1.6) this.damage(o, 60 - o.obj.position.distanceTo(p) * 3, p);
  }
  /** area blast: force in m/s of launch, dmg in hp */
  blast(p: THREE.Vector3, r: number, force: number, dmg: number) {
    const R = r * 1.25;
    for (const e of this.list) {
      if (e.gone || e.held) continue;
      const d = e.obj.position.distanceTo(p);
      if (d > R + e.radius) continue;
      const f = clamp(1 - d / R, 0, 1);
      if (f <= 0) continue;
      V.copy(e.obj.position).sub(p); V.y += R * 0.15; if (V.lengthSq() < 0.01) V.set(0, 1, 0); V.normalize();
      if (e.frozen > 0 && f > 0.15) { this.shatter(e); continue; }
      if (e.wrecked && e.kind === 'vehicle') { if (!e.airborne || true) this.launch(e, V.clone().multiplyScalar(force * f / Math.sqrt(e.mass)).setY(force * f * 0.4)); continue; }
      const dv = V.clone().multiplyScalar(force * f / Math.sqrt(e.mass)); dv.y += force * f * 0.45 / Math.sqrt(e.mass);
      this.launch(e, dv);
      this.damage(e, dmg * f * (e.kind === 'vehicle' ? 0.6 : 1) / (e.mass > 5 ? 2 : 1), p);
      if (e.kind === 'vehicle' && f > 0.35 && e.alive) this.delayed.push({ t: rand(0.1, 0.9), p: e.obj.position.clone(), r: 0 });
    }
  }
  destroyVehicles(p: THREE.Vector3, r: number): number {
    let n = 0, i = 0;
    for (const e of this.list) {
      if (e.kind !== 'vehicle' || e.gone || e.wrecked || e.obj.position.distanceTo(p) > r) continue;
      n++;
      const idx = i++;
      this.delayed.push({ t: idx * 0.12 + rand(0, 0.1), p: e.obj.position.clone(), r: e.id });
    }
    return n;
  }

  // ---------- queries ----------
  forEach(p: THREE.Vector3, r: number, cb: (e: Ent, dist: number) => void) {
    for (const e of this.list) {
      if (e.gone) continue;
      const d = e.obj.position.distanceTo(p) - e.radius;
      if (d < r) cb(e, Math.max(0, d));
    }
  }
  forCone(origin: THREE.Vector3, dir: THREE.Vector3, range: number, radiusFn: (t: number) => number, cb: (e: Ent, t: number) => void) {
    for (const e of this.list) {
      if (e.gone) continue;
      V.copy(e.obj.position).sub(origin); const t = V.dot(dir);
      if (t < 0 || t > range) continue;
      const perp = V2.copy(dir).multiplyScalar(t).sub(V).length();
      if (perp < radiusFn(t) + e.radius) cb(e, t);
    }
  }
  nearestTo(p: THREE.Vector3, r: number, filter?: (e: Ent) => boolean): Ent | null {
    let best: Ent | null = null, bd = r;
    for (const e of this.list) {
      if (e.gone || (filter && !filter(e))) continue;
      const d = e.obj.position.distanceTo(p) - e.radius;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  /** entity closest to a ray */
  pick(origin: THREE.Vector3, dir: THREE.Vector3, maxD: number): Ent | null {
    let best: Ent | null = null, bd = 1e9;
    for (const e of this.list) {
      if (e.gone) continue;
      V.copy(e.obj.position).setY(e.obj.position.y + e.height * 0.5).sub(origin);
      const t = V.dot(dir);
      if (t < 2 || t > maxD) continue;
      const perp = V2.copy(dir).multiplyScalar(t).sub(V).length();
      const tol = Math.max(e.radius * 1.3, 1.2 + t * 0.03);
      if (perp < tol && t < bd) { bd = t; best = e; }
    }
    return best;
  }

  // ---------- population ----------
  populate() {
    const g = this.game, city = g.city, T = g.terrain;
    const spots = city.spots;
    for (let i = 0; i < 150; i++) {
      const s = pick(spots.home.length ? spots.home : spots.work);
      const e = this.spawnNPC(s.x + rand(-60, 60), s.z + rand(-60, 60), true);
      e.d.home = pick(spots.home.length ? spots.home : spots.work).clone(); e.d.work = pick(spots.work).clone(); e.d.park = (spots.park.length ? pick(spots.park) : pick(spots.work)).clone();
    }
    // villagers
    for (const v of city.villages) for (let i = 0; i < 5; i++) { const e = this.spawnNPC(v.x + rand(-40, 40), v.z + rand(-40, 40), false); e.d.center = new THREE.Vector3(v.x, 0, v.z); }
    for (let i = 0; i < 80; i++) { const s = this.streetPoint(); this.spawnVehicle(pick(['sedan', 'sedan', 'sports', 'suv', 'taxi', 'truck', 'bus']), s.x, s.z, { lane: true }); }
    // wild animals
    const wild = (types: string[], n: number, test: (x: number, z: number, h: number) => boolean) => {
      let c = 0;
      for (let t = 0; t < 400 && c < n; t++) { const x = rand(-1500, 1500), z = rand(-1500, 1500), h = T.heightAt(x, z); if (h > 1.5 && test(x, z, h)) { this.spawnAnimal(pick(types), x, z); c++; } }
    };
    wild(['deer', 'wolf', 'deer'], 14, (x) => x < -350);
    wild(['cow', 'sheep', 'horse'], 12, (x, z) => Math.hypot(x, z) > 480 && z > -250 && z < 450 && x > -250);
    wild(['camel'], 5, (_x, z) => z > 520);
    wild(['elephant'], 2, (x) => x < -300);
    for (let i = 0; i < 3; i++) this.spawnAnimal('bird', rand(-500, 500), rand(-500, 500));
    for (let i = 0; i < 4; i++) { const a = rand(0, 6.28), r = rand(1000, 1300); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (T.heightAt(x, z) < -6) this.spawnAnimal('fish', x, z); }
    for (let i = 0; i < 40; i++) { const x = rand(-1700, 1700), z = rand(-1700, 1700); if (T.heightAt(x, z) < -8) { this.spawnAnimal('fish', x, z); if (i > 8) break; } }
    for (let i = 0; i < 40 && this.list.filter(e => e.type === 'whale').length < 3; i++) { const x = rand(-1800, 1800), z = rand(-1800, 1800); if (T.heightAt(x, z) < -25) this.spawnAnimal('whale', x, z); }
    for (let i = 0; i < 60 && this.list.filter(e => e.type === 'boat').length < 6; i++) { const x = rand(-1600, 1600), z = rand(-1600, 1600); if (T.heightAt(x, z) < -6) this.spawnVehicle('boat', x, z); }
    // airport
    this.spawnVehicle('airliner', 570, 12, { parked: true, heading: 1.57 });
    this.spawnVehicle('airliner', 650, 18, { parked: true, heading: 1.57, color: 0x2255aa });
    this.spawnVehicle('airliner', 735, 14, { parked: true, heading: 1.57, color: 0xaa2233 });
    this.spawnVehicle('plane', 700, -60, { parked: true, heading: 1.2, color: 0xe8c040 });
    this.spawnVehicle('plane', 745, -62, { parked: true, heading: 0.9, color: 0x3a8ae0 });
    this.spawnVehicle('helicopter', 520, -20, { parked: true, heading: 0 });
    for (let i = 0; i < 2; i++) this.spawnVehicle('airliner', 0, 0, { y: 380 + i * 60 });
    this.spawnVehicle('helicopter', 0, 0, {}); this.spawnVehicle('plane', 300, 300, {});
    for (const e of this.list) if (e.mode === 'orbit' && e.type === 'helicopter') { e.d.R = 160; }
  }

  // ---------- update ----------
  update(dt: number, rdt: number) {
    const g = this.game;
    if (g.reversing) { this.rewind(rdt); return; }
    if (dt <= 0) return;
    const hour = g.sky.hour;
    const camP = g.camera.position, pl = g.player;
    // delayed explosions
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i]; d.t -= dt;
      if (d.t > 0) continue;
      this.delayed.splice(i, 1);
      if (d.r > 0) { const e = this.list.find(q => q.id === d.r); if (e && !e.wrecked) this.explodeVehicle(e); }
      else { g.fx.explosion(d.p, 5); g.audio.play('smallboom', camP.distanceTo(d.p)); }
    }
    this.histT += dt;
    if (this.histT >= 0.1) { this.histT = 0; this.record(); }
    this.popT -= dt;
    if (this.popT <= 0) { this.popT = 2.5; this.maintain(); }
    let nN = 0, nV = 0, nA = 0;
    const t = g.clock;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.gone) { e.goneT += dt; if (e.goneT > 40) { g.scene.remove(e.obj); this.list.splice(i, 1); } continue; }
      if (e.alive) { if (e.kind === 'npc') nN++; else if (e.kind === 'vehicle') nV++; else nA++; }
      if (e.held) { this.visual(e, dt, t, camP, 'flail'); continue; }
      e.portalCd -= dt;
      if (e.bubbleT > 0) { e.bubbleT -= dt; if (e.bubbleT <= 0 && e.bubble) e.bubble.visible = false; }
      if (e.frozen > 0) { e.frozen -= dt; if (e.frozen <= 0) this.unfreeze(e); if (e.airborne) this.physics(e, dt); continue; }
      if (e.burn > 0) {
        e.burn -= dt; const p = e.obj.position;
        g.fx.flame(V.set(p.x, p.y + e.height * 0.5, p.z), V2.set(0, 2, 0), 0.6 + e.radius * 0.3);
        if (e.kind !== 'vehicle') this.damage(e, 9 * dt, undefined); else if (e.burn < 1 && e.alive) { this.explodeVehicle(e); }
        if (e.burn <= 0 && e.kind === 'npc' && e.alive) e.state = 'walk';
      }
      // fire contact
      if ((e.kind === 'npc' || e.kind === 'animal') && e.alive && e.burn <= 0 && (i + Math.floor(t * 4)) % 5 === 0) for (const f of g.fx.fires) { if (Math.abs(f.x - e.obj.position.x) < 3 && Math.abs(f.z - e.obj.position.z) < 3 && Math.abs(f.y - e.obj.position.y) < 4) { this.ignite(e, 5); break; } }
      if (e.airborne) this.physics(e, dt); else if (e.kind === 'npc') this.npc(e, dt, hour, pl); else if (e.kind === 'animal') this.animal(e, dt, t, pl); else this.vehicle(e, dt);
      if (e.kind === 'vehicle' && !e.airborne && e.wrecked) this.slide(e, dt);
      if (e.kind === 'npc' && !e.alive && !e.airborne) { e.deadT += dt; if (e.deadT > 22) { e.sinkT += dt; e.obj.position.y -= dt * 0.3; if (e.sinkT > 3) { e.gone = true; e.obj.visible = false; } } }
      this.visual(e, dt, t, camP);
      // vehicle-NPC collisions
      if (e.kind === 'vehicle' && e.alive && !e.wrecked && Math.abs(e.speed) > 3 && e.mode === 'lane') {
        for (const o of this.list) {
          if (o.kind !== 'npc' || !o.alive || o.gone || o.airborne) continue;
          const dx = o.obj.position.x - e.obj.position.x, dz = o.obj.position.z - e.obj.position.z;
          if (dx * dx + dz * dz < 5 && Math.abs(o.obj.position.y - e.obj.position.y) < 3) {
            V.set(Math.sin(e.heading), 0.5, Math.cos(e.heading)).multiplyScalar(Math.abs(e.speed) * 0.9); V.y = 5;
            this.launch(o, V); this.damage(o, 40, e.obj.position); g.audio.play('hit', camP.distanceTo(o.obj.position));
          }
        }
      }
    }
    this.stats.npc = nN; this.stats.veh = nV; this.stats.animals = nA;
  }

  slide(e: Ent, dt: number) {
    const p = e.obj.position;
    if (Math.abs(e.vel.x) + Math.abs(e.vel.z) > 0.05) {
      p.x += e.vel.x * dt; p.z += e.vel.z * dt; const k = Math.max(0, 1 - 2.5 * dt); e.vel.x *= k; e.vel.z *= k;
      p.y = this.game.terrain.heightAt(p.x, p.z) + (e.mode === 'static' ? 0.1 : 0);
    }
  }

  physics(e: Ent, dt: number) {
    const g = this.game, p = e.obj.position, T = g.terrain;
    e.lastPos.copy(p);
    e.vel.y -= g.gravity(p.y) * e.gravMul * dt;
    const sp = e.vel.length();
    if (sp > 400) e.vel.multiplyScalar(400 / sp);
    p.x += e.vel.x * dt; p.y += e.vel.y * dt; p.z += e.vel.z * dt;
    e.obj.rotation.x += e.ang.x * dt * 0.5; e.obj.rotation.y += e.ang.y * dt * 0.5; e.obj.rotation.z += e.ang.z * dt * 0.5;
    const level = g.ocean.level;
    if (p.y < level && p.y > -80 && T.heightAt(p.x, p.z) < level - 0.5) {
      e.vel.multiplyScalar(Math.max(0, 1 - 2.2 * dt)); e.vel.y += (e.alive ? 6 : 12) * dt; e.ang.multiplyScalar(0.96);
      if (!e.d.splash) { e.d.splash = true; g.fx.puff(V.set(p.x, level, p.z), 2, new THREE.Color(0.8, 0.9, 1), 6); g.audio.play('splash', g.camera.position.distanceTo(p), 0.5); }
    } else e.d.splash = false;
    // buildings
    if (g.city.pointInside(p.x, p.y + e.height * 0.5, p.z, e.radius * 0.5)) {
      const v = e.vel.length();
      if (v > 12) { g.city.damageSphere(V.set(p.x, p.y + e.height * 0.5, p.z), 2 + Math.min(v, 70) * 0.07 * Math.sqrt(e.mass), v * 0.25, true); this.damage(e, v * 0.8); g.audio.play('hit', g.camera.position.distanceTo(p)); }
      p.copy(e.lastPos); e.vel.x *= -0.3; e.vel.z *= -0.3; e.vel.y *= 0.5;
    }
    const gh = Math.max(T.heightAt(p.x, p.z), g.city.heightAt(p.x, p.z, p.y + 0.5));
    const flat = AIR.has(e.type) ? 3 : 0;
    if (p.y <= gh + flat * 0 && p.y < gh + 0.05 && e.vel.y < 0 || p.y < gh - 0.5) {
      const impact = -e.vel.y, hs = Math.hypot(e.vel.x, e.vel.z);
      p.y = gh;
      if (e.kind === 'vehicle' && e.d.crashArm && (impact > 4 || hs > 8) && !e.wrecked) { this.explodeVehicle(e); e.d.crashArm = false; }
      if (e.frozen > 0 && impact > 9) { this.shatter(e); return; }
      if (impact > 14 && e.alive) { this.damage(e, (impact - 12) * 4); g.audio.play('hit', g.camera.position.distanceTo(p), 0.5); g.fx.puff(p, 1.5, undefined, 3); }
      if (e.vel.y < -3 && impact > 5) { e.vel.y = impact * 0.25; e.vel.x *= 0.65; e.vel.z *= 0.65; e.ang.multiplyScalar(0.5); } else {
        e.vel.y = 0; e.vel.x *= 0.5; e.vel.z *= 0.5;
        if (hs < 2.5 && !e.held) {
          e.airborne = false; e.ang.set(0, 0, 0); e.obj.rotation.x = 0; e.obj.rotation.z = 0;
          if (e.kind === 'npc' && e.alive) { e.state = 'recover'; e.stateT = rand(1.2, 2.5); }
          if (e.kind === 'animal' && e.alive) { e.state = 'walk'; }
          if (e.kind === 'vehicle') { if (e.wrecked) { e.obj.rotation.z = rand(-0.2, 0.2); e.mode = 'static'; } else if (e.mode === 'lane') { e.mode = 'free'; this.snapVehicle(e, p.x, p.z); } }
          if (e.kind === 'npc' && !e.alive) { e.obj.rotation.x = 0; }
        }
      }
    }
    if (e.kind === 'npc' && e.alive && p.y < level - 0.5 && T.heightAt(p.x, p.z) < level - 0.5) { e.airborne = false; e.state = 'walk'; }
    if (AIR.has(e.type) && e.alive && e.airborne && !e.held) { e.d.crashArm = true; }
  }

  // ---------- NPC ----------
  private updateSummoned(e: Ent, dt: number): boolean {
    if (!e.d.summoned || !e.alive) return false;
    const g = this.game, p = e.obj.position;
    const rival = g.godWars?.active ? g.godWars.actor : null;
    const target = rival?.humanoid.root.position ?? g.player.pos;
    const dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz);
    const attackRange = e.kind === 'animal' ? 10 : 8;
    if (rival && distance < attackRange) {
      e.speed = 0;
      e.heading = angleLerp(e.heading, Math.atan2(dx, dz), 1 - Math.exp(-dt * 5));
      e.d.summonAttackT = (e.d.summonAttackT ?? 0) - dt;
      if (e.d.summonAttackT <= 0) {
        e.d.summonAttackT = e.kind === 'animal' ? 1.3 : 1.05;
        g.godWars.damageRival(e.kind === 'animal' ? 9 : 6);
        g.fx.flash(rival.humanoid.root.position.clone().add(new THREE.Vector3(0, 5, 0)), 0xb58aff, 4, 70);
      }
    } else {
      const offsetAngle = e.d.summonAngle as number;
      const followDist = rival ? attackRange - 1 : 7;
      const tx = target.x + Math.cos(offsetAngle) * followDist;
      const tz = target.z + Math.sin(offsetAngle) * followDist;
      const txd = tx - p.x, tzd = tz - p.z, followDistance = Math.hypot(txd, tzd);
      if (followDistance > 2.2) {
        e.heading = angleLerp(e.heading, Math.atan2(txd, tzd), 1 - Math.exp(-dt * 4));
        e.d.speed = e.kind === 'animal' ? 8 : 6.5;
        this.stepFree(e, dt, e.d.speed);
        e.speed = e.d.speed;
      } else e.speed = 0;
    }
    p.y = this.game.terrain.heightAt(p.x, p.z);
    e.obj.rotation.y = e.heading;
    return true;
  }

  npc(e: Ent, dt: number, hour: number, pl: Game['player']) {
    const g = this.game, p = e.obj.position, T = g.terrain;
    if (this.updateSummoned(e, dt)) return;
    e.stateT -= dt;
    const level = g.ocean.level;
    const gh = T.heightAt(p.x, p.z);
    // water
    if (gh < level - 0.7 && e.alive) {
      e.drown += dt; p.y = level - 0.5; if (e.state !== 'dead') e.state = 'drown';
      if (e.drown > 6) this.kill(e, 'drown');
      e.heading += dt * 0.5; const sp = 1.2; p.x += Math.sin(e.heading) * sp * dt; p.z += Math.cos(e.heading) * sp * dt; return;
    } else if (e.state === 'drown') { e.state = 'walk'; e.drown = 0; }
    if (!e.alive) { if (gh < level - 0.5) p.y = level - 0.2; else p.y = gh; return; }
    e.drown = 0;
    switch (e.state) {
      case 'recover': if (e.stateT <= 0) { e.state = 'walk'; if (e.mode === 'grid' || Math.hypot(p.x, p.z) < CITY_R - 30) this.snapToGrid(e); } p.y = gh; return;
      case 'fall': return;
      case 'burn': { e.heading += rand(-4, 4) * dt; this.stepFree(e, dt, 5); return; }
      case 'flee': {
        V.copy(p).sub(e.threat); V.y = 0; const away = Math.atan2(V.x, V.z);
        e.heading = angleLerp(e.heading, away + Math.sin(g.clock * 3 + e.id) * 0.4, 1 - Math.exp(-dt * 4));
        this.stepFree(e, dt, 6.5); if (e.stateT <= 0) { e.state = 'walk'; this.snapToGrid(e); } return;
      }
      case 'gawk': case 'cheer': {
        V.copy(e.threat).sub(p); e.heading = angleLerp(e.heading, Math.atan2(V.x, V.z), 1 - Math.exp(-dt * 5));
        if (e.stateT <= 0) e.state = 'walk'; p.y = gh; return;
      }
      case 'worship': {
        V.copy(pl.pos).sub(p); e.heading = angleLerp(e.heading, Math.atan2(V.x, V.z), 1 - Math.exp(-dt * 4));
        if (e.stateT <= 0) e.state = 'walk'; p.y = gh; return;
      }
      case 'inside': {
        if (hour > 5.8 && hour < 21.5) { e.state = 'walk'; e.hidden = false; e.obj.visible = true; }
        return;
      }
      case 'idle': { if (e.stateT <= 0) { e.state = 'walk'; e.goal = null; e.thinkT = 0; } p.y = gh; this.idleLook(e, dt); }
    }
    // player reaction
    e.react -= dt;
    if (e.react <= 0 && (e.state === 'walk' || e.state === 'idle')) {
      e.react = rand(1.5, 3.5);
      const d = p.distanceTo(pl.pos);
      if (d < 55 && !g.hud.get().panelOpen) {
        const f = pl.form.id, r = Math.random();
        if (f === 'supreme' || f === 'infinite') { if (r < 0.45) { e.state = 'worship'; e.stateT = rand(6, 14); this.say(e, 'pray', 6); } else if (r < 0.7) { e.state = 'gawk'; e.stateT = 4; e.threat.copy(pl.pos); this.say(e, 'gawk', 3); } }
        else if (f === 'shadow' || f === 'destruction') { if (r < 0.6) { e.state = 'flee'; e.stateT = rand(5, 9); e.threat.copy(pl.pos); e.speed = 6.5; this.say(e, 'panic', 3); } else if (r < 0.8) { e.state = 'gawk'; e.stateT = 3; e.threat.copy(pl.pos); this.say(e, 'gawk', 3); } }
        else if (r < 0.55) { if (r < 0.15) { e.state = 'cheer'; this.say(e, 'cheer', 3); } else { e.state = 'gawk'; this.say(e, 'gawk', 3); } e.stateT = rand(3, 6); e.threat.copy(pl.pos); }
      }
    }
    // schedule
    e.thinkT -= dt;
    const home = e.d.home as THREE.Vector3, work = e.d.work as THREE.Vector3 | undefined, park = e.d.park as THREE.Vector3 | undefined;
    if (e.thinkT <= 0) {
      e.thinkT = rand(4, 9);
      let dest: THREE.Vector3 | undefined = home;
      const night = hour >= 22 || hour < 5.5;
      if (work) {
        if (night) dest = home;
        else if (hour < 8.5) dest = work; else if (hour < 12) dest = work; else if (hour < 13.5) dest = park; else if (hour < 17) dest = work;
        else if (hour < 19.5) dest = park; else dest = home;
      } else if (e.d.center) dest = e.d.center;
      if (e.state === 'idle') return;
      if (!e.goal || e.goal.distanceTo(dest ?? home) > 5) e.goal = (dest ?? home).clone();
      if (e.mode === 'free' && !e.d.center && e.d.work) this.snapToGrid(e);
      if (night && dest === home && Math.hypot(p.x - home.x, p.z - home.z) < 40 && e.d.work) { e.state = 'inside'; e.hidden = true; e.obj.visible = false; return; }
    }
    // movement
    const spd = e.d.speed;
    if (e.mode === 'grid') {
      if (e.goal && Math.hypot(p.x - e.goal.x, p.z - e.goal.z) < 24) { e.state = 'idle'; e.stateT = rand(8, 30); e.goal = null; this.say(e, 'talk', 2.5); return; }
      this.gridStep(e, dt, spd); p.y = gh + 0.22;
    } else {
      if (e.goal && Math.hypot(p.x - e.goal.x, p.z - e.goal.z) < 12) { e.state = 'idle'; e.stateT = rand(6, 20); e.goal = null; return; }
      if (e.goal) { V.copy(e.goal).sub(p); e.heading = angleLerp(e.heading, Math.atan2(V.x, V.z), 1 - Math.exp(-dt * 2)); }
      else { e.d.turnT = (e.d.turnT ?? 0) - dt; if (e.d.turnT < 0) { e.d.wish = e.heading + rand(-1.4, 1.4); e.d.turnT = rand(1, 4); } e.heading = angleLerp(e.heading, e.d.wish ?? e.heading, 1 - Math.exp(-dt * 1.5)); }
      this.stepFree(e, dt, spd);
      if (!e.goal && Math.random() < dt * 0.03) { e.state = 'idle'; e.stateT = rand(3, 10); }
    }
  }
  private idleLook(e: Ent, dt: number) { e.heading += Math.sin(this.game.clock * 0.4 + e.id) * dt * 0.2; }

  stepFree(e: Ent, dt: number, spd: number, water = false) {
    const g = this.game, p = e.obj.position, T = g.terrain;
    const px = p.x + Math.sin(e.heading) * (e.radius + 2.5), pz = p.z + Math.cos(e.heading) * (e.radius + 2.5);
    const h = T.heightAt(px, pz), level = g.ocean.level;
    let blocked = g.city.pointInside(px, p.y + 1, pz, 1) || (water ? h > level - 1.2 : h < level - 0.4 || T.slopeAt(px, pz) > 1.1);
    if (blocked) { e.d.td = e.d.td || (Math.random() < 0.5 ? 1 : -1); e.heading += e.d.td * 2.6 * dt; spd *= 0.25; } else e.d.td = 0;
    p.x += Math.sin(e.heading) * spd * dt; p.z += Math.cos(e.heading) * spd * dt;
    e.speed = spd;
    if (!water) p.y = Math.max(T.heightAt(p.x, p.z), g.city.heightAt(p.x, p.z, p.y) > -1e8 && p.y > T.heightAt(p.x, p.z) + 1 ? g.city.heightAt(p.x, p.z, p.y) : -1e9);
    if (!water && p.y < T.heightAt(p.x, p.z)) p.y = T.heightAt(p.x, p.z);
  }

  gridStep(e: Ent, dt: number, spd: number) {
    const p = e.obj.position, ax = e.axis;
    const along = ax === 'x' ? p.x : p.z; let lat = ax === 'x' ? p.z : p.x;
    const sc = Math.round(lat / P) * P;
    const latT = sc + e.side * 9.8;
    lat += clamp(latT - lat, -4 * dt, 4 * dt);
    const na = along + e.dir * spd * dt;
    const k0 = Math.floor(along / P), k1 = Math.floor(na / P);
    if (k0 !== k1) {
      const ic = Math.max(k0, k1) * P;
      this.chooseTurn(e, ic, lat);
      if (e.axis !== ax) {
        if (ax === 'x') { p.x = ic; p.z = lat; } else { p.z = ic; p.x = lat; }
        e.heading = e.axis === 'x' ? (e.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (e.dir > 0 ? 0 : Math.PI); return;
      }
    }
    const nx = ax === 'x' ? na : lat, nz = ax === 'x' ? lat : na;
    V.set(nx - p.x, 0, nz - p.z);
    if (V.lengthSq() > 1e-8) e.heading = angleLerp(e.heading, Math.atan2(V.x, V.z), 1 - Math.exp(-dt * 8));
    p.x = nx; p.z = nz; e.speed = spd;
  }
  chooseTurn(e: Ent, ic: number, lat: number) {
    const ax = e.axis, cs = Math.round(lat / P) * P, other = ax === 'x' ? 'z' : 'x';
    const opts: { axis: 'x' | 'z'; dir: number; x: number; z: number }[] = [];
    const add = (axis: 'x' | 'z', dir: number) => {
      let x: number, z: number;
      if (axis === ax) { x = ax === 'x' ? ic + dir * P : cs; z = ax === 'x' ? cs : ic + dir * P; } else { x = ax === 'x' ? ic : cs + dir * P; z = ax === 'x' ? cs + dir * P : ic; }
      if (Math.abs(x) <= 400 && Math.abs(z) <= 400) opts.push({ axis, dir, x, z });
    };
    add(ax, e.dir);
    if (ic !== 0) { add(other, 1); add(other, -1); }
    if (!opts.length) { e.dir = -e.dir; return; }
    let pickd = opts[Math.floor(Math.random() * opts.length)];
    if (e.goal && Math.random() < 0.7) {
      let bd = 1e9;
      for (const o of opts) { const d = Math.hypot(o.x - e.goal.x, o.z - e.goal.z); if (d < bd) { bd = d; pickd = o; } }
    }
    e.axis = pickd.axis; e.dir = pickd.dir;
  }

  // ---------- animals ----------
  animal(e: Ent, dt: number, t: number, pl: Game['player']) {
    const g = this.game, p = e.obj.position, T = g.terrain;
    if (this.updateSummoned(e, dt)) return;
    e.stateT -= dt;
    if (!e.alive) { if (e.mode !== 'fly' && e.mode !== 'swim') p.y = T.heightAt(p.x, p.z); else if (e.mode === 'fly') { p.y -= 12 * dt; if (p.y < T.heightAt(p.x, p.z)) { p.y = T.heightAt(p.x, p.z); } } else p.y += (g.ocean.level - p.y) * dt; return; }
    if (e.mode === 'fly') {
      const c = e.d.center as THREE.Vector3;
      V.copy(c).sub(p); V.y = 0;
      const far = V.length() > (e.type === 'dragon' ? 260 : 120);
      const want = far ? Math.atan2(V.x, V.z) : e.heading + Math.sin(t * 0.3 + e.id) * 0.8;
      const prev = e.heading; e.heading = angleLerp(e.heading, want, 1 - Math.exp(-dt * (far ? 1.5 : 0.6)));
      const spd = e.type === 'dragon' ? 26 : 14;
      p.x += Math.sin(e.heading) * spd * dt; p.z += Math.cos(e.heading) * spd * dt;
      const ty = c.y + Math.sin(t * 0.4 + e.id) * 8; p.y += (ty - p.y) * dt * 0.5;
      p.y = Math.max(p.y, T.heightAt(p.x, p.z) + 6);
      e.d.bank = (e.heading - prev) * 20; e.speed = spd;
      if (e.state === 'flee') { p.y += 10 * dt; }
      if (e.type === 'dragon') {
        e.d.breath -= dt;
        if (e.d.breath < 0) {
          const dur = 2.2; e.d.breathT = dur; e.d.breath = rand(9, 16);
        }
        if ((e.d.breathT ?? 0) > 0) {
          e.d.breathT -= dt;
          const dir = V.set(Math.sin(e.heading), -0.55, Math.cos(e.heading)).normalize();
          const hp2 = V2.copy(p).addScaledVector(dir, 12); hp2.y += 4;
          for (let i = 0; i < 4; i++) g.fx.flame(hp2, V.clone().multiplyScalar(40), 2.2, 0.35);
          const gp = V2.copy(p).addScaledVector(dir, 70); gp.y = T.heightAt(gp.x, gp.z);
          if (Math.random() < dt * 5) { g.fx.fire(gp, 3, 10); g.city.damageSphere(V.set(gp.x, gp.y + 3, gp.z), 7, 4, true); g.scatter.damageSphere(gp, 14, true); this.blast(gp, 12, 6, 30); this.alert(gp, 120, 'panic'); }
        }
      }
      return;
    }
    if (e.mode === 'swim') {
      const px = p.x + Math.sin(e.heading) * (e.radius + 6), pz = p.z + Math.cos(e.heading) * (e.radius + 6);
      const floor = T.heightAt(p.x, p.z), ahead = T.heightAt(px, pz), level = g.ocean.level;
      if (ahead > p.y - 1 || ahead > level - 3) e.heading += 2.2 * dt; else { e.d.turnT = (e.d.turnT ?? 0) - dt; if (e.d.turnT < 0) { e.d.wish = e.heading + rand(-1, 1); e.d.turnT = rand(2, 6); } e.heading = angleLerp(e.heading, e.d.wish ?? e.heading, 1 - Math.exp(-dt)); }
      const spd = e.type === 'whale' ? 5 : e.state === 'flee' ? 9 : 3.5;
      p.x += Math.sin(e.heading) * spd * dt; p.z += Math.cos(e.heading) * spd * dt; e.speed = spd;
      const ty = e.type === 'whale' ? level - 3 + Math.sin(t * 0.2 + e.id) * 5 : clamp(p.y + Math.sin(t + e.id) * 0.5, floor + 1.5, level - 1);
      p.y += (ty - p.y) * dt * 0.7; p.y = Math.max(p.y, floor + 1);
      if (e.state === 'flee' && e.stateT < 0) e.state = 'walk';
      return;
    }
    // land quadruped
    if (e.state === 'flee') {
      V.copy(p).sub(e.threat); V.y = 0; e.heading = angleLerp(e.heading, Math.atan2(V.x, V.z), 1 - Math.exp(-dt * 4));
      this.stepFree(e, dt, e.d.speed * 3.2); if (e.stateT <= 0) e.state = 'walk'; return;
    }
    if (p.distanceTo(pl.pos) < 14 && pl.pos.y < p.y + 8 && e.type !== 'elephant' && Math.random() < dt * 2) { e.state = 'flee'; e.stateT = 3; e.threat.copy(pl.pos); return; }
    e.d.idle -= dt;
    if (e.d.idle < 0) { e.d.paused = !e.d.paused; e.d.idle = e.d.paused ? rand(2, 7) : rand(5, 14); e.d.wish = e.heading + rand(-1.5, 1.5); }
    if (e.d.paused) { e.speed = 0; p.y = T.heightAt(p.x, p.z); return; }
    e.heading = angleLerp(e.heading, e.d.wish ?? e.heading, 1 - Math.exp(-dt));
    this.stepFree(e, dt, e.d.speed);
  }

  // ---------- vehicles ----------
  vehicle(e: Ent, dt: number) {
    const g = this.game, p = e.obj.position, T = g.terrain;
    if (e.wrecked || !e.alive) return;
    if (e.d.panic > 0) e.d.panic -= dt;
    if (e.mode === 'static') return;
    if (e.mode === 'orbit') {
      const d = e.d; d.a += d.sgn * d.v / d.R * dt;
      const nx = d.c.x + Math.cos(d.a) * d.R, nz = d.c.z + Math.sin(d.a) * d.R;
      V.set(nx - p.x, 0, nz - p.z);
      if (V.lengthSq() > 1e-6) e.heading = angleLerp(e.heading, Math.atan2(V.x, V.z), 1 - Math.exp(-dt * 5));
      p.x = nx; p.z = nz; p.y = d.y + Math.sin(g.clock * 0.5 + e.id) * 3;
      e.obj.rotation.z = -d.sgn * (e.type === 'ufo' ? 0.1 : 0.25) * (e.type === 'helicopter' ? 0.5 : 1);
      e.speed = d.v; return;
    }
    if (e.mode === 'boat') {
      e.d.turnT = (e.d.turnT ?? 0) - dt; if (e.d.turnT < 0) { e.d.wish = e.heading + rand(-0.8, 0.8); e.d.turnT = rand(4, 10); }
      e.heading = angleLerp(e.heading, e.d.wish, 1 - Math.exp(-dt * 0.6));
      this.stepFree(e, dt, e.d.speed * (e.d.panic > 0 ? 2 : 1), true);
      p.y = g.ocean.level + Math.sin(g.clock * 1.2 + e.id) * 0.15; e.obj.rotation.z = Math.sin(g.clock * 0.9 + e.id) * 0.04; return;
    }
    if (e.mode === 'free') {
      e.d.turnT = (e.d.turnT ?? 0) - dt; if (e.d.turnT < 0) { e.d.wish = e.heading + rand(-0.7, 0.7); e.d.turnT = rand(3, 7); }
      e.heading = angleLerp(e.heading, e.d.wish, 1 - Math.exp(-dt));
      this.stepFree(e, dt, e.d.speed); return;
    }
    // lane
    const ax = e.axis, k = e.d.k as number;
    const vmax = (e.d.vmax as number) * (e.d.panic > 0 ? 1.6 : 1);
    let tgt = vmax;
    const along = ax === 'x' ? p.x : p.z;
    for (const o of this.list) {
      if (o === e || o.kind !== 'vehicle' || o.mode !== 'lane' || o.axis !== ax || o.d.k !== k || o.dir !== e.dir || o.wrecked) continue;
      const oa = ax === 'x' ? o.obj.position.x : o.obj.position.z, gap = (oa - along) * e.dir;
      if (gap > 0 && gap < 14 + e.speed * 0.8 && Math.abs(o.d.off - e.d.off) < 2) tgt = Math.min(tgt, Math.max(0, (gap - 7) * 1.2));
    }
    e.speed += clamp(tgt - e.speed, -22 * dt, 6 * dt);
    const lat = this.laneLat(e);
    const curLat = ax === 'x' ? p.z : p.x;
    const nl = curLat + clamp(lat - curLat, -6 * dt, 6 * dt);
    const na = along + e.dir * e.speed * dt;
    const lo = k === 0 ? (ax === 'x' ? -455 : -415) : -CITY_R - 20, hi = k === 0 ? (ax === 'x' ? 465 : 815) : CITY_R + 20;
    const k0 = Math.floor(along / P), k1 = Math.floor(na / P);
    if (na < lo || na > hi) { e.dir = -e.dir; e.d.off = k === 0 ? (Math.random() < 0.5 ? 3 : 7) : 4; return; }
    if (k0 !== k1 && Math.abs(na) < 395) {
      const ic = Math.max(k0, k1) * P;
      if (Math.abs(ic / P) <= 5 && ic !== 0 && Math.random() < (k === 0 ? 0.12 : 0.28)) {
        const nd = Math.random() < 0.5 ? 1 : -1;
        e.axis = ax === 'x' ? 'z' : 'x'; e.dir = nd; e.d.k = ic / P; e.d.off = 4; e.d.vmax = rand(10, 15);
        if (ax === 'x') { p.x = ic; } else { p.z = ic; }
        return;
      }
    }
    V.set(ax === 'x' ? na - p.x : nl - p.x, 0, ax === 'x' ? nl - p.z : na - p.z);
    if (V.lengthSq() > 1e-8) e.heading = angleLerp(e.heading, Math.atan2(V.x, V.z), 1 - Math.exp(-dt * 7));
    if (ax === 'x') { p.x = na; p.z = nl; } else { p.z = na; p.x = nl; }
    p.y = T.heightAt(p.x, p.z) + 0.12;
  }

  // ---------- visuals ----------
  visual(e: Ent, dt: number, t: number, cam: THREE.Vector3, forceMode?: string) {
    const p = e.obj.position;
    const dx = p.x - cam.x, dz = p.z - cam.z, dy = p.y - cam.y;
    const d2 = dx * dx + dz * dz + dy * dy;
    const far = e.kind === 'npc' ? 340 : e.kind === 'animal' ? 450 : 900;
    if (e.hidden) return;
    const vis = d2 < far * far || e.radius > 5 && d2 < 2500 * 2500;
    if (e.obj.visible !== vis) e.obj.visible = vis;
    if (!vis || e.frozen > 0) return;
    if (!e.airborne) e.obj.rotation.y = e.heading;
    if (e.kind === 'npc' && e.hum) {
      let mode = forceMode ?? 'idle';
      if (!forceMode) switch (e.state) {
        case 'walk': mode = e.speed > 4 ? 'run' : e.speed > 0.2 ? 'walk' : 'idle'; break;
        case 'flee': case 'burn': mode = 'panic'; break;
        case 'cheer': mode = 'cheer'; break;
        case 'worship': mode = 'kneel'; break;
        case 'recover': mode = 'kneel'; break;
        case 'fall': mode = 'flail'; break;
        case 'dead': mode = 'dead'; break;
        case 'drown': mode = 'flail'; break;
        default: mode = 'idle';
      }
      if (!e.alive) mode = 'dead';
      e.hum.pose(mode, dt, e.state === 'walk' ? e.d.speed : e.state === 'flee' || e.state === 'burn' ? 7 : 0, t + e.phase);
    } else if (e.kind === 'animal' && e.ani) {
      const A = e.ani;
      const sw = e.alive && e.speed > 0.1 ? Math.sin(t * (4 + e.speed * 1.4) + e.phase) * clamp(e.speed * 0.2, 0.2, 0.9) : 0;
      if (A.kind === 'quad') { A.legs[0].rotation.x = sw; A.legs[3].rotation.x = sw; A.legs[1].rotation.x = -sw; A.legs[2].rotation.x = -sw; if (A.tail) A.tail.rotation.z = Math.sin(t * 2 + e.phase) * 0.2; }
      else if (A.kind === 'bird') { const f = Math.sin(t * 9 + e.phase) * 0.7; if (e.alive) { A.wings[0].rotation.z = -f; A.wings[1].rotation.z = f; } e.obj.rotation.z = (e.d.bank ?? 0) * -0.1; }
      else if (A.kind === 'fish' || A.kind === 'whale') { if (A.tail) { if (A.kind === 'whale') A.tail.rotation.x = Math.sin(t * 1.2 + e.phase) * 0.25; else A.tail.rotation.y = Math.sin(t * 9 + e.phase) * 0.5; } }
      else if (A.kind === 'dragon') {
        const f = Math.sin(t * 3 + e.phase) * 0.6; A.wings[0].rotation.z = f; A.wings[1].rotation.z = -f;
        A.segs?.forEach((s, i) => (s.rotation.y = Math.sin(t * 2 - i * 0.6 + e.phase) * 0.25));
        e.obj.rotation.z = (e.d.bank ?? 0) * -0.05;
      }
    } else if (e.kind === 'vehicle' && e.veh) {
      const v = e.veh;
      if (e.speed !== 0 && e.alive) for (const w of v.wheels) w.rotation.x += e.speed * dt / 0.4;
      if (v.rotor && e.alive) { v.rotor.rotation.y += dt * 30; if (v.rotor2) v.rotor2.rotation.x += dt * 40; }
      if (v.spin) v.spin.rotation.y += dt * 2;
      const prop = v.group.userData.prop as THREE.Object3D | undefined; if (prop && e.alive) prop.rotation.z += dt * 40;
    }
  }

  // ---------- population upkeep ----------
  maintain() {
    const g = this.game, camP = g.camera.position, pop = g.hud.get().popTarget;
    const spots = g.city.spots;
    const away = (x: number, z: number) => Math.hypot(x - camP.x, z - camP.z) > 90;
    if (this.stats.npc < pop && spots.home.length) {
      const s = pick(spots.home);
      const x = s.x + rand(-40, 40), z = s.z + rand(-40, 40);
      if (away(x, z)) { const e = this.spawnNPC(x, z, true); e.d.home = s.clone(); e.d.work = pick(spots.work).clone(); e.d.park = (spots.park.length ? pick(spots.park) : pick(spots.work)).clone(); }
    }
    if (this.stats.veh < pop * 0.55) { const s = this.streetPoint(), x = s.x, z = s.z; if (away(x, z)) this.spawnVehicle(pick(['sedan', 'sedan', 'sports', 'suv', 'taxi', 'truck', 'bus']), x, z, { lane: true }); }
    if (this.stats.animals < 30) { const x = rand(-1200, -400), z = rand(-600, 600); if (g.terrain.heightAt(x, z) > 1.5 && away(x, z)) this.spawnAnimal(pick(['deer', 'wolf', 'deer', 'cow']), x, z); }
    if (this.list.length > 900) { for (let i = 0; i < this.list.length; i++) { const e = this.list[i]; if (e.gone || !e.alive) { g.scene.remove(e.obj); this.list.splice(i, 1); break; } } }
  }

  // ---------- rewind ----------
  record() {
    const f: Frame = { t: this.game.clock, items: [] };
    for (const e of this.list) { const o = e.obj; f.items.push({ e, x: o.position.x, y: o.position.y, z: o.position.z, rx: o.rotation.x, ry: o.rotation.y, rz: o.rotation.z, alive: e.alive, gone: e.gone, state: e.state, hp: e.hp, wrecked: e.wrecked }); }
    this.history.push(f);
    if (this.history.length > 160) this.history.shift();
  }
  rewind(rdt: number) {
    const g = this.game;
    this.rewindAcc += rdt * 2;
    while (this.rewindAcc >= 0.1 && this.history.length > 1) { this.history.pop(); this.rewindAcc -= 0.1; }
    const f = this.history[this.history.length - 1];
    if (!f) { g.setTimeMode('normal'); return; }
    const k = 1 - Math.exp(-rdt * 22);
    for (const it of f.items) {
      const e = it.e, o = e.obj;
      o.position.x += (it.x - o.position.x) * k; o.position.y += (it.y - o.position.y) * k; o.position.z += (it.z - o.position.z) * k;
      o.rotation.x = it.rx; o.rotation.y = it.ry; o.rotation.z = it.rz;
      e.alive = it.alive; e.state = it.state; e.hp = it.hp; e.wrecked = it.wrecked; e.vel.set(0, 0, 0); e.airborne = false;
      if (e.gone !== it.gone) { e.gone = it.gone; e.obj.visible = !it.gone; }
      e.heading = it.ry;
    }
    if (this.history.length <= 1) g.setTimeMode('normal');
  }
  clearAll() {
    for (const e of this.list) this.game.scene.remove(e.obj);
    this.list.length = 0; this.history.length = 0; this.delayed.length = 0;
  }
  zone(x: number, z: number) { return zoneAt(x, z); }
  randIntSafe() { return randInt(0, 1); }
  mat() { return mat; }
}
