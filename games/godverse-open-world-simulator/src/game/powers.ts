import * as THREE from 'three';
import type { Game } from './engine';
import type { Ent } from './entities';
import type { Deb } from './fx';
import { PAL } from './fx';
import { POWER_MAP, BUILDING_KINDS, STRUCTURE_KINDS, VEHICLE_KINDS, ANIMAL_KINDS } from './types';
import { SPEED_NAMES } from './player';
import { clamp, rand, pick } from './noise';
import { CITY_R } from './terrain';

const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3();
const col = (h: number) => new THREE.Color(h);
const SMOKE = col(0x9aa0a8);
const FROST_A = col(0xffffff), FROST_B = col(0x70d8ff);

interface Spike { mesh: THREE.Mesh; age: number; life: number; h: number; w: number }
interface Held { e?: Ent; d?: Deb; off: THREE.Vector3 }

export class Powers {
  current = 'divine_bolt';
  down = false; cd = 0; tick = 0; charge = 0; charging = false;
  spikes: Spike[] = [];
  beam: THREE.Group; beamCore: THREE.Mesh; beamGlow: THREE.Mesh; beamOn = false;
  orb: THREE.Group; orbCore: THREE.Mesh; orbGlow: THREE.Mesh;
  held: Held[] = []; holdDist = 40; lastTk = new THREE.Vector3(); tkVel = new THREE.Vector3();
  tfTarget = 0; tfStarted = false;
  spikeGeo = new THREE.ConeGeometry(0.5, 1, 5).translate(0, 0.5, 0);
  iceMat = new THREE.MeshStandardMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.2, emissive: 0x3aa8ff, emissiveIntensity: 0.5, flatShading: true });
  crystalMat = new THREE.MeshStandardMaterial({ color: 0xffd45a, roughness: 0.1, metalness: 0.9, emissive: 0xff9a00, emissiveIntensity: 0.6, flatShading: true });
  looping: string | null = null;

  constructor(public g: Game) {
    this.beam = new THREE.Group();
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    this.beamCore = new THREE.Mesh(cyl, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beamGlow = new THREE.Mesh(cyl, new THREE.MeshBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beamCore.frustumCulled = this.beamGlow.frustumCulled = false; this.beamCore.renderOrder = this.beamGlow.renderOrder = 7;
    this.beam.add(this.beamGlow, this.beamCore); this.beam.visible = false; g.scene.add(this.beam);
    this.orb = new THREE.Group();
    this.orbCore = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.orbGlow = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.orb.add(this.orbCore, this.orbGlow); this.orb.visible = false; g.scene.add(this.orb);
  }

  get def() { return POWER_MAP[this.current]; }
  select(id: string) {
    if (!POWER_MAP[id]) return;
    if (!this.g.hud.get().unlockedPowers.includes(id)) { this.g.toast('Defeat the god who owns this power to unlock it', '#c4b8ff'); return; }
    this.stop();
    this.current = id; this.g.hud.set({ power: id }); this.g.audio.play('select');
  }
  get pal() { return this.g.player.palette; }

  // ------------- input events -------------
  press() {
    const g = this.g; this.down = true; this.tick = 0;
    g.player.aiming = ['fire', 'ice', 'wind', 'beam', 'laser_eyes', 'divine_beam', 'nova', 'telekinesis', 'attract', 'lightning', 'blast', 'meteor', 'matter', 'terraform'].includes(this.current);
    if (g.godWars.active) {
      if (g.aim.hit === 'god') g.godWars.usePower(this.current);
      else g.toast('Aim at the rival god to attack', '#ffe27a');
      this.beamOn = ['beam', 'laser_eyes', 'divine_beam'].includes(this.current);
    } else this.run(this.current, true);
    g.hud.set({ holding: true });
  }
  release() {
    const id = this.current;
    if (id === 'nova' && this.charging) this.fireNova();
    if (id === 'telekinesis') this.throwHeld();
    this.stop();
    this.g.hud.set({ holding: false, charge: 0 });
  }
  stop() {
    this.down = false; this.g.player.aiming = false; this.beam.visible = false; this.beamOn = false; this.orb.visible = false; this.charging = false; this.charge = 0; this.tfStarted = false;
    if (this.looping) { this.g.audio.loop(this.looping, false); this.looping = null; }
    if (this.held.length) this.throwHeld(0);
  }
  loop(name: string) { if (this.looping !== name) { if (this.looping) this.g.audio.loop(this.looping, false); this.g.audio.loop(name, true); this.looping = name; } }

  /** Instant use of a power from the control panel / hotkeys at the current aim */
  burst: { id: string; t: number } | null = null;
  use(id: string) {
    const g = this.g, def = POWER_MAP[id];
    if (!def || !g.hud.get().unlockedPowers.includes(id)) { g.toast('Defeat the god who owns this power to unlock it', '#c4b8ff'); return; }
    if (this.down) this.release();
    const prev = this.current; this.current = id;
    if (g.godWars.active) {
      if (g.aim.hit === 'god') g.godWars.usePower(id);
      else g.toast('Aim at the rival god to attack', '#ffe27a');
      if (def.mode !== 'hold') this.current = prev;
      else {
        this.down = true; this.tick = 0.65;
        this.beamOn = ['beam', 'laser_eyes', 'divine_beam'].includes(id);
      }
      return;
    }
    if (id === 'nova') { this.charge = 2.2; this.fireNova(); }
    else if (def.mode === 'hold') {
      this.stop(); this.tfStarted = false; this.tick = 0;
      g.player.aiming = true;
      if (id === 'telekinesis') this.grab();
      this.burst = { id, t: id === 'telekinesis' ? 1.6 : id === 'terraform' ? 2.5 : 1.8 };
      return; // keep current selection for the burst duration
    } else this.run(id, true);
    this.current = prev;
  }

  // ------------- per frame -------------
  update(dt: number, rdt: number) {
    const g = this.g, id = this.current;
    this.cd -= rdt;
    // spikes anim
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const s = this.spikes[i]; s.age += rdt;
      const grow = Math.min(1, s.age / 0.35), shrink = s.age > s.life - 1.5 ? Math.max(0, (s.life - s.age) / 1.5) : 1;
      s.mesh.scale.set(s.w * grow * shrink, s.h * grow * shrink, s.w * grow * shrink);
      if (s.age > s.life) { g.scene.remove(s.mesh); this.spikes.splice(i, 1); }
    }
    if (this.down) {
      this.tick -= rdt;
      if (g.godWars.active) {
        if (this.def.mode === 'hold' && this.tick <= 0) {
          this.tick = 0.65;
          if (g.aim.hit === 'god') g.godWars.usePower(id);
        }
      } else this.hold(id, rdt);
    }
    if (this.burst) {
      const b = this.burst; b.t -= rdt; this.tick -= rdt;
      if (b.id !== 'telekinesis') this.hold(b.id, rdt);
      if (b.t <= 0) { this.burst = null; if (b.id === 'telekinesis') this.throwHeld(); this.stop(); this.current = this.g.hud.get().power; }
    }
    // beam visuals
    if (this.beamOn) this.updateBeam(rdt);
    // nova orb
    if (this.charging) {
      this.charge = Math.min(3.5, this.charge + rdt);
      const hand = g.player.hand(V3); hand.y += 0.3;
      const s = 0.4 + this.charge * 0.9;
      this.orb.visible = true; this.orb.position.copy(hand).addScaledVector(V4.set(-Math.sin(g.input.yaw), 0, -Math.cos(g.input.yaw)), 1 + s * 0.6);
      this.orbCore.scale.setScalar(s * (0.9 + Math.sin(g.clock * 30) * 0.08)); this.orbGlow.scale.setScalar(s * 1.3);
      (this.orbGlow.material as THREE.MeshBasicMaterial).color.copy(this.pal.b);
      for (let i = 0; i < 4; i++) { const d = V.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(4, 9) + s); g.fx.add.emit(this.orb.position.x + d.x, this.orb.position.y + d.y, this.orb.position.z + d.z, -d.x * 3, -d.y * 3, -d.z * 3, 0.45, 0.8, 0.1, this.pal.a, this.pal.b, 1, 0, 0); }
      g.hud.set({ charge: this.charge / 3.5 });
      g.fx.flash(this.orb.position, this.pal.b, 4 + this.charge * 4, 70);
    }
    // held telekinesis
    if (this.held.length) this.updateHeld(dt);
  }

  private hold(id: string, dt: number) {
    const g = this.g, A = g.aim, P = g.player, fx = g.fx;
    const origin = P.hand(V3), dir = g.input.forward(V4);
    const rate = (r: number, fn: () => void) => { if (this.tick <= 0) { this.tick = r; fn(); } };
    switch (id) {
      case 'fire': {
        this.loop('fire');
        const n = Math.ceil(dt * 160);
        for (let i = 0; i < n; i++) { V.copy(dir).multiplyScalar(rand(55, 90)); fx.flame(V2.copy(origin).addScaledVector(dir, 1), V, rand(1.4, 2.4), 0.5); }
        rate(0.1, () => {
          for (const t of [6, 18, 32, 48, 64]) {
            const p = V2.copy(origin).addScaledVector(dir, t), rad = 4 + t * 0.14;
            g.ents.forEach(p, rad + 3, (e) => { g.ents.ignite(e, 6); g.ents.damage(e, 6, origin); });
            g.scatter.damageSphere(p, rad, true);
            if (t > 20) g.city.damageSphere(p, 3, 2, true);
          }
          if (A.dist < 90) { fx.fire(A.point, 2.6, 14); g.terrain.paint(A.point.x, A.point.z, 6, col(0x0a0907), 0.5); }
        });
        break;
      }
      case 'ice': {
        this.loop('wind');
        const n = Math.ceil(dt * 150);
        for (let i = 0; i < n; i++) { V.copy(dir).multiplyScalar(rand(50, 85)); V.x += rand(-7, 7); V.y += rand(-7, 7); V.z += rand(-7, 7); fx.add.emit(origin.x, origin.y, origin.z, V.x, V.y, V.z, rand(0.6, 1.2), rand(1, 2.2), 0.4, FROST_A, FROST_B, 0.9, 0, 0.9); }
        for (let i = 0; i < n * 0.4; i++) { V.copy(dir).multiplyScalar(rand(30, 60)); fx.norm.emit(origin.x, origin.y, origin.z, V.x + rand(-6, 6), V.y + rand(-6, 6), V.z + rand(-6, 6), rand(1, 1.8), 2, 6, col(0xe8f8ff), col(0xb8e8ff), 0.5, 0, 1.2); }
        rate(0.1, () => {
          for (const t of [8, 22, 38, 56, 72]) {
            const p = V2.copy(origin).addScaledVector(dir, t), rad = 5 + t * 0.16;
            g.ents.forEach(p, rad + 3, (e) => g.ents.freeze(e, 16));
            g.city.tintSphere(p, rad + 4, col(0xcfefff), 0.35);
          }
          if (A.dist < 110) { g.terrain.paint(A.point.x, A.point.z, 14, col(0xeaf6ff), 0.7); if (Math.random() < 0.7) this.spike(A.point, this.iceMat); }
          const gp = V2.copy(origin).addScaledVector(dir, rand(15, 70)); gp.y = g.terrain.heightAt(gp.x, gp.z); if (Math.random() < 0.6) this.spike(gp, this.iceMat);
          g.audio.play('ice', -1, 0.3);
        });
        break;
      }
      case 'wind': {
        this.loop('wind');
        const n = Math.ceil(dt * 120);
        for (let i = 0; i < n; i++) { V.copy(dir).multiplyScalar(rand(70, 120)); const o = V2.set(rand(-3, 3), rand(-2, 2), rand(-3, 3)); fx.add.emit(origin.x + o.x, origin.y + o.y, origin.z + o.z, V.x, V.y, V.z, rand(0.5, 0.9), 0.9, 0.4, col(0xffffff), col(0xcfe8ff), 0.45, 0, 0.5); }
        for (let i = 0; i < n * 0.3; i++) fx.norm.emit(origin.x + dir.x * rand(5, 60), origin.y + rand(-4, 4), origin.z + dir.z * rand(5, 60), dir.x * 50, rand(0, 5), dir.z * 50, rand(1, 2), 3, 8, SMOKE, SMOKE, 0.3, 0, 0.6);
        g.ents.forCone(origin, dir, 130, (t) => 8 + t * 0.35, (e, t) => { V.copy(dir).multiplyScalar(95 * dt * (1 - t / 140) / Math.sqrt(e.mass)); V.y += 18 * dt / Math.sqrt(e.mass); g.ents.push(e, V); if (e.frozen > 0) g.ents.shatter(e); });
        g.debris.forNear(V2.copy(origin).addScaledVector(dir, 55), 70, (d) => { d.rest = false; d.vx += dir.x * 90 * dt; d.vy += 12 * dt; d.vz += dir.z * 90 * dt; });
        rate(0.18, () => {
          g.scatter.damageSphere(V2.copy(origin).addScaledVector(dir, rand(10, 80)), 12);
          g.city.damageSphere(V2.copy(origin).addScaledVector(dir, rand(30, 100)), 5, 8, true);
        });
        break;
      }
      case 'lightning': rate(0.2, () => this.lightning()); break;
      case 'meteor': rate(1.0, () => { const p = this.groundPt(); g.disasters.meteors(p, 5, 50, 2.2, 1.4); }); break;
      case 'blast': rate(0.33, () => { const p = this.groundPt(); g.explode(p, 24, { force: 60, crater: 1, pal: this.pal, sound: true }); }); break;
      case 'beam': case 'laser_eyes': case 'divine_beam': {
        this.beamOn = true; this.loop('beam');
        rate(id === 'beam' ? 0.07 : 0.12, () => {
          const end = A.point;
          if (id === 'beam') {
            g.explode(V.copy(end), 17, { force: 36, crater: 0.45, pal: this.pal, lite: true, silent: true });
          } else {
            const radius = id === 'divine_beam' ? 13 : 6;
            const damage = id === 'divine_beam' ? 25 : 17;
            g.city.damageSphere(end, radius, id === 'divine_beam' ? 22 : 12, true);
            g.ents.forEach(end, radius + 3, (e) => g.ents.damage(e, damage, end));
            g.scatter.damageSphere(end, radius, true);
            g.fx.explosion(end, radius * 0.35, this.pal, false);
          }
          const spread = id === 'divine_beam' ? 8 : 3;
          g.fx.add.emit(end.x, end.y, end.z, rand(-spread, spread), rand(5, spread * 2), rand(-spread, spread), 0.7, 3, 0.2, this.pal.a, this.pal.b, 1, 0, 0.4, 20);
        });
        break;
      }
      case 'telekinesis': break;
      case 'attract': {
        this.loop('wind');
        const c = P.center(V2);
        const R = 150;
        for (let i = 0; i < 4; i++) { const d = V.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(20, R * 0.7)); fx.add.emit(c.x + d.x, c.y + d.y, c.z + d.z, -d.x * 1.8, -d.y * 1.8, -d.z * 1.8, 0.6, 1.5, 0.1, this.pal.a, this.pal.b, 0.9, 0, 0); }
        g.ents.forEach(c, R, (e, dist) => {
          if (e.type === 'whale') return;
          V.copy(c).sub(e.obj.position); V.y += 1; const l = V.length(); V.divideScalar(l + 0.01);
          if (dist < 7) { e.vel.multiplyScalar(1 - 3 * dt); e.gravMul = 0; return; }
          g.ents.push(e, V.multiplyScalar(130 * dt / Math.sqrt(e.mass))); e.gravMul = 0.1;
        });
        g.debris.forNear(c, R, (d, dist) => { if (dist < 6) return; V.set(c.x - d.x, c.y - d.y, c.z - d.z).normalize(); d.rest = false; d.vx += V.x * 160 * dt; d.vy += V.y * 160 * dt; d.vz += V.z * 160 * dt; });
        rate(0.3, () => g.city.damageSphere(A.point, 6, 0, true));
        break;
      }
      case 'matter': {
        rate(0.12, () => {
          const p = A.point, R = 15;
          g.city.tintSphere(p, R, Math.random() < 0.5 ? col(0xffc23a) : col(0x7af0ff), 0.7);
          g.ents.forEach(p, R, (e) => { g.ents.statueify(e); });
          g.terrain.paint(p.x, p.z, R + 4, col(0xffe08a), 0.7);
          if (Math.random() < 0.6) { const q = V.set(p.x + rand(-R, R), 0, p.z + rand(-R, R)); q.y = g.terrain.heightAt(q.x, q.z); this.spike(q, this.crystalMat, 2); }
          for (let i = 0; i < 6; i++) fx.add.emit(p.x + rand(-R, R) * 0.6, p.y + rand(0, 4), p.z + rand(-R, R) * 0.6, 0, rand(2, 8), 0, 1, 1.2, 0.1, col(0xffffff), col(0xffb020), 1, 0, 0);
        });
        break;
      }
      case 'terraform': this.terraform(dt); break;
    }
  }

  // ------------- one-shot actions -------------
  private run(id: string, first: boolean) {
    const g = this.g, A = g.aim, P = g.player, hud = g.hud.get();
    if (!first) return;
    if (this.cd > 0 && !['fire', 'ice', 'wind', 'beam', 'telekinesis', 'attract', 'nova', 'matter', 'terraform'].includes(id)) return;
    this.cd = 0.18;
    const gp = () => this.groundPt();
    const fwdFlat = V4.copy(g.input.forward(V2)).setY(0).normalize().clone();
    switch (id) {
      case 'fire': case 'ice': case 'wind': case 'beam': case 'attract': case 'matter': case 'terraform': this.tick = 0; if (id === 'terraform') { this.tfStarted = false; } break;
      case 'lightning': this.tick = 0.2; this.lightning(); break;
      case 'meteor': this.tick = 1; g.disasters.meteors(gp(), 6, 50, 2.2, 1.4); break;
      case 'blast': this.tick = 0.33; g.explode(gp(), 24, { force: 60, crater: 1, pal: this.pal, sound: true }); break;
      case 'tsunami': { const o = V.copy(P.pos).addScaledVector(fwdFlat, 20); g.disasters.tsunami(o, fwdFlat); g.toast('Tidal wave unleashed', '#2fb8ff'); break; }
      case 'tornado': g.disasters.tornado(gp()); g.toast('Tornado spawned', '#c9c2b0'); break;
      case 'quake': g.disasters.quake(A.hit === 'sky' ? V.copy(P.pos) : gp(), 300, 11); g.toast('The earth splits', '#c28a4a'); break;
      case 'storm': { const on = g.sky.weather !== 'storm'; g.setWeather(on ? 'storm' : 'clear'); g.toast(on ? 'Thunderstorm summoned' : 'Skies calmed', '#8aa4ff'); break; }
      case 'blackhole': { const p = gp().clone(); p.y += 45; g.disasters.blackhole(p); g.toast('Singularity opened', '#b06bff'); break; }
      case 'gravity': { const p = gp().clone(); p.y += 28; g.disasters.zone(p, 'grav', 78, 20); break; }
      case 'nova': { if (!this.charging) { this.charging = true; this.charge = 0; g.audio.loop('energy', true); this.looping = 'energy'; } break; }
      case 'planet': {
        const ray = g.sky.rayPlanet(g.camera.position, g.input.forward(V2));
        if (ray) g.sky.destroyPlanet(ray.planet);
        else if (g.sky.space > 0.3) g.toast('Aim at a planet to destroy it', '#ff8a6a');
        else { g.disasters.rupture(P.pos.clone()); g.toast('WORLD RUPTURE — the land shatters', '#ff5a3a'); }
        break;
      }
      case 'freeze': g.setTimeMode(hud.timeMode === 'freeze' ? 'normal' : 'freeze'); break;
      case 'rewind': g.setTimeMode(hud.timeMode === 'reverse' ? 'normal' : 'reverse'); break;
      case 'accel': g.setTimeMode(hud.timeMode === 'fast' ? 'normal' : 'fast'); break;
      case 'teleport': g.teleportTo(A.hit === 'sky' ? V.copy(P.pos).addScaledVector(g.input.forward(V2), 400) : V.copy(A.point).addScaledVector(g.input.forward(V2), -3).add(V3.set(0, 2.5, 0))); break;
      case 'portal': { const p = gp(); const n = V.copy(g.camera.position).sub(p).setY(0); g.disasters.portal(p, n); break; }
      case 'distort': { const p = gp().clone(); p.y += 25; g.disasters.zone(p, 'distort', 88, 16); g.toast('Reality distorted', '#ff6bd8'); break; }
      case 'strength': {
        P.punchT = 0.4;
        const p = A.dist < 80 ? V.copy(A.point) : V.copy(P.pos).addScaledVector(fwdFlat, 16).setY(P.pos.y + 1);
        g.explode(p, 17, { force: 95, crater: 0.5, pal: this.pal, sound: true, hurt: false });
        g.ents.blast(p, 30, 120, 150); g.shake(0.5); g.audio.play('hit', -1, 1.5);
        break;
      }
      case 'speed': { P.setSpeedLevel((P.speedLevel + 1) % 4); g.hud.set({ speedLevel: P.speedLevel }); g.toast(`${SPEED_NAMES[P.speedLevel]}`, '#ffe24d'); g.audio.play('whoosh'); break; }
      case 'flight': P.setFlying(!P.flying); break;
      case 'telekinesis': this.grab(); break;
      case 'jump': {
        P.setFlying(false); P.vel.y = 85; P.vel.x += g.input.forward(V2).x * 30; P.vel.z += g.input.forward(V2).z * 30; P.onGround = false; P.slam = true; P.pos.y += 0.6;
        g.explode(V.copy(P.pos), 10, { force: 30, pal: this.pal, lite: true, hurt: false }); g.audio.play('whoosh');
        break;
      }
      case 'shield': { P.invulnerable = !P.invulnerable; g.hud.set({ invuln: P.invulnerable }); g.toast(P.invulnerable ? 'Invulnerable' : 'Mortal mode — your own power can hurt you', '#6bd0ff'); break; }
      case 'divine_bolt': {
        const p = gp().clone();
        g.strike(p, true);
        g.toast('Divine Bolt unleashed', '#fff1a8');
        break;
      }
      case 'divine_guard': {
        P.invulnerable = !P.invulnerable;
        g.hud.set({ invuln: P.invulnerable });
        g.fx.flash(P.center(V.clone()), P.invulnerable ? 0x78dcff : 0x718096, 12, 100);
        g.toast(P.invulnerable ? 'Divine Guard raised' : 'Divine Guard lowered', '#78dcff');
        break;
      }
      case 'divine_dash': {
        const direction = g.input.forward(V2).setY(0).normalize();
        P.pos.addScaledVector(direction, 22);
        P.pos.y = Math.max(P.pos.y, g.terrain.heightAt(P.pos.x, P.pos.z) + 3);
        P.vel.set(0, 0, 0);
        g.fx.flash(P.center(V.clone()), 0x9affd6, 8, 80);
        g.audio.play('whoosh');
        break;
      }
      case 'shadow_dragon': g.dragon.use(); break;
      case 'shadow_soldiers': this.summonShadowSoldiers(); break;
      case 'summon_beasts': this.summonShadowBeasts(); break;
      case 'repel': {
        const c = P.center(V.clone());
        g.ents.blast(c, 110, 95, 40); g.debris.blast(c, 110, 90); g.scatter.damageSphere(c, 30); g.city.damageSphere(c, 20, 55, true);
        g.fx.shockwave(c, 110, this.pal.a, 0.7, true, true); g.fx.explosion(c, 12, this.pal, false); g.audio.play('boom', -1, 0.6); g.shake(0.5);
        break;
      }
      case 'c_building': this.createBuilding(hud.bKind, false); break;
      case 'c_structure': this.createBuilding(hud.sKind, true); break;
      case 'c_vehicle': this.createVehicle(hud.vKind); break;
      case 'c_npc': this.createNPCs(hud.npcCount); break;
      case 'c_animal': this.createAnimal(hud.aKind); break;
      case 'c_weapon': this.createWeapon(hud.wKind); break;
      case 'c_settlement': this.createSettlement(); break;
      case 'd_vehicle': { const p = A.hit === 'sky' ? P.pos : A.point; const n = g.ents.destroyVehicles(p, 120); g.fx.shockwave(p, 120, 0xff8030, 0.7, true, false); g.toast(n ? `${n} vehicles detonating` : 'No vehicles in range', '#ff8a4d'); g.audio.play('smallboom'); break; }
      case 'd_building': {
        const p = A.point; const b = g.city.nearestBuilding(p.x, p.z, 60);
        if (b) { g.city.demolish(b, V.set(b.x, b.baseY + 3, b.z), 8); g.city.damageSphere(V2.set(p.x, p.y, p.z), 34, 8, true); g.fx.shockwave(V3.set(b.x, b.baseY, b.z), 80, 0xffa060, 0.8, true, false); g.audio.play('boom', -1, 0.6); g.shake(0.6); g.toast('Building demolished', '#ff5a4d'); }
        else g.toast('No building near the target', '#ff8a6a');
        break;
      }
      case 'd_env': {
        const p = A.point; const n = g.scatter.damageSphere(p, 75, false); g.debris.blast(p, 75, 30);
        g.fx.shockwave(p, 75, 0xff9a4d, 0.7, true, false); g.fx.puff(p, 16, undefined, 18); g.audio.play('crumble'); g.toast(n ? `${n} natural objects erased` : 'Nothing to erase here', '#ff9a4d'); break;
      }
      case 'shockwave': {
        const c = V.copy(P.pos); c.y = Math.max(g.terrain.heightAt(c.x, c.z), P.pos.y - 40);
        g.disasters.wave(c.clone(), 420, 270, 58, 24, false, this.pal); g.explode(c.clone().setY(c.y + 2), 18, { force: 0, pal: this.pal, hurt: false, silent: true }); g.audio.play('boom'); g.shake(0.7); break;
      }
      case 'disaster': g.runDisaster(hud.dKind); break;
    }
  }

  // ---- helpers ----
  groundPt(): THREE.Vector3 {
    const g = this.g, A = g.aim;
    if (A.hit !== 'sky') return A.point;
    const p = A.point; V.copy(p); V.y = Math.max(g.terrain.heightAt(p.x, p.z), g.ocean.level); return V;
  }
  spike(p: THREE.Vector3, mat: THREE.Material, scale = 1) {
    if (this.spikes.length > 90) { const s = this.spikes.shift()!; this.g.scene.remove(s.mesh); }
    const m = new THREE.Mesh(this.spikeGeo, mat); const h = rand(5, 16) * scale, w = rand(1.2, 3) * scale;
    m.position.set(p.x + rand(-2, 2), p.y - 0.5, p.z + rand(-2, 2)); m.rotation.set(rand(-0.35, 0.35), rand(0, 6), rand(-0.35, 0.35)); m.scale.set(0.01, 0.01, 0.01); m.castShadow = true;
    this.g.scene.add(m); this.spikes.push({ mesh: m, age: 0, life: 40, h, w });
  }
  lightning() {
    const g = this.g, A = g.aim;
    const p = A.hit === 'sky' ? V.copy(g.camera.position).addScaledVector(g.input.forward(V2), 180).setY(0) : V.copy(A.point);
    if (A.hit === 'sky') p.y = g.terrain.heightAt(p.x, p.z);
    g.strike(p.clone(), true);
    let n = 0;
    g.ents.forEach(p, 38, (e) => { if (n++ < 5 && e.alive) { V2.copy(e.obj.position).setY(e.obj.position.y + e.height * 0.5); g.fx.bolt(p, V2, 0xbfe0ff, 0.2, 0.22, 0); g.ents.damage(e, 200, p); if (e.kind !== 'vehicle') g.ents.ignite(e, 4); } });
  }

  // ---- beam ----
  updateBeam(dt: number) {
    const g = this.g, A = g.aim, origin = g.player.hand(V3);
    origin.y += 0.1;
    if (this.current === 'laser_eyes') origin.y += 0.35;
    const end = A.point; const len = Math.max(2, Math.min(origin.distanceTo(end), 2500));
    this.beam.position.copy(origin); this.beam.lookAt(end); this.beam.visible = true;
    const w = 1 + Math.sin(g.clock * 40) * 0.12;
    const width = this.current === 'laser_eyes' ? 0.48 : this.current === 'divine_beam' ? 2.8 : 1;
    const beamA = this.current === 'laser_eyes' ? col(0xff365f) : this.current === 'divine_beam' ? col(0xf4ffff) : this.pal.a;
    const beamB = this.current === 'laser_eyes' ? col(0xff9aba) : this.current === 'divine_beam' ? col(0x43bfff) : this.pal.b;
    this.beamCore.scale.set(width * w, width * w, len); this.beamGlow.scale.set(width * 3.4 * w, width * 3.4 * w, len);
    (this.beamCore.material as THREE.MeshBasicMaterial).color.copy(beamA); (this.beamGlow.material as THREE.MeshBasicMaterial).color.copy(beamB);
    g.fx.flash(end, this.pal.b, 6, 80);
    for (let i = 0; i < 2; i++) g.fx.add.emit(origin.x, origin.y, origin.z, rand(-3, 3), rand(-3, 3), rand(-3, 3), 0.3, 2.2, 0.2, beamA, beamB, 1, 0, 0);
    // carve along the beam
    this.tfTarget -= dt;
    if (this.tfTarget < 0) {
      this.tfTarget = 0.14;
      const dir = V2.copy(end).sub(origin).normalize();
      const impactRadius = this.current === 'divine_beam' ? 11 : this.current === 'laser_eyes' ? 4 : 5;
      const buildingForce = this.current === 'divine_beam' ? 20 : this.current === 'laser_eyes' ? 10 : 4;
      const entityDamage = this.current === 'divine_beam' ? 220 : this.current === 'laser_eyes' ? 160 : 120;
      for (let t = 25; t < len; t += 28) {
        const p = V4.copy(origin).addScaledVector(dir, t);
        g.city.damageSphere(p, impactRadius, buildingForce, true);
        g.ents.forEach(p, impactRadius + 2, (e) => g.ents.damage(e, entityDamage, p));
        if (t < 500) g.scatter.damageSphere(p, impactRadius, true);
      }
    }
  }

  private tintSummon(e: Ent) {
    e.d.summoned = true;
    e.d.summonAngle = rand(0, Math.PI * 2);
    e.d.summonAttackT = rand(0, 0.8);
    e.state = 'walk';
    e.mode = 'free';
    e.goal = null;
    e.obj.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const tinted = materials.map((material) => {
        const clone = material.clone();
        if (clone instanceof THREE.MeshStandardMaterial) {
          clone.color.multiply(col(0x8a78bb));
          clone.emissive.setHex(0x35105a);
          clone.emissiveIntensity = 0.7;
        }
        return clone;
      });
      object.material = Array.isArray(object.material) ? tinted : tinted[0];
    });
  }

  summonShadowSoldiers() {
    const g = this.g;
    const allies = g.ents.list.filter((e) => e.alive && e.d.summoned === 'soldier');
    const count = Math.min(4, 8 - allies.length);
    if (count <= 0) { g.toast('Your shadow soldier squad is already at full strength', '#b58aff'); return; }
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = g.player.pos.x + Math.cos(angle) * 8;
      const z = g.player.pos.z + Math.sin(angle) * 8;
      const e = g.ents.spawnNPC(x, z, false, g.terrain.heightAt(x, z));
      e.d.summoned = 'soldier';
      this.tintSummon(e);
    }
    g.audio.play('spawn');
    g.fx.shockwave(g.player.center(V.clone()), 16, 0xb58aff, 0.7, true, false);
    g.toast(`${count} shadow ${count === 1 ? 'soldier' : 'soldiers'} summoned`, '#b58aff');
  }

  summonShadowBeasts() {
    const g = this.g;
    const allies = g.ents.list.filter((e) => e.alive && e.d.summoned === 'beast');
    const count = Math.min(3, 6 - allies.length);
    if (count <= 0) { g.toast('Your shadow beast pack is already at full strength', '#d080ff'); return; }
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = g.player.pos.x + Math.cos(angle) * 10;
      const z = g.player.pos.z + Math.sin(angle) * 10;
      const [e] = g.ents.spawnAnimal('wolf', x, z);
      e.d.summoned = 'beast';
      this.tintSummon(e);
    }
    g.audio.play('spawn');
    g.fx.shockwave(g.player.center(V.clone()), 20, 0xd080ff, 0.8, true, false);
    g.toast(`${count} shadow ${count === 1 ? 'beast' : 'beasts'} summoned`, '#d080ff');
  }

  // ---- nova ----
  fireNova() {
    const g = this.g, c = this.charge;
    this.charging = false; this.orb.visible = false; g.audio.loop('energy', false); this.looping = null;
    const R = 30 + c * 55;
    const p = this.g.aim.hit === 'sky' ? V.copy(g.camera.position).addScaledVector(g.input.forward(V2), 220) : V.copy(this.g.aim.point);
    if (this.g.aim.hit === 'sky') p.y = Math.max(g.terrain.heightAt(p.x, p.z), 4);
    g.explode(p.clone(), R, { force: R * 1.1, crater: 1, pal: this.pal, sound: true, big: true });
    if (c > 1.5) g.disasters.wave(p.clone(), R * 3, 200, R * 0.6, R * 0.5, false, this.pal);
    g.shake(clamp(c * 0.4, 0.4, 1.4)); g.toast(`Supernova — ${Math.round(R)}m blast`, '#ffe27a');
  }

  // ---- telekinesis ----
  grab() {
    const g = this.g, A = g.aim, origin = g.camera.position, dir = g.input.forward(V2);
    this.held = [];
    const e = g.ents.pick(origin, dir, 350);
    if (e) {
      this.held.push({ e, off: new THREE.Vector3() }); this.holdDist = clamp(e.obj.position.distanceTo(origin), 12, 120);
    } else {
      let p = A.point.clone();
      if (A.hit === 'building') { g.city.damageSphere(p, 10, 0, false); }
      if (A.hit === 'sky') p = origin.clone().addScaledVector(dir, 60);
      this.holdDist = clamp(origin.distanceTo(p), 14, 120);
      let n = 0;
      g.debris.forNear(p, 24, (d) => { if (n++ < 60) this.held.push({ d, off: new THREE.Vector3(d.x - p.x, d.y - p.y, d.z - p.z).multiplyScalar(0.8) }); });
      g.ents.forEach(p, 20, (en) => { if (this.held.length < 70) this.held.push({ e: en, off: new THREE.Vector3(en.obj.position.x - p.x, en.obj.position.y - p.y, en.obj.position.z - p.z).multiplyScalar(0.7) }); });
    }
    for (const h of this.held) { if (h.e) { h.e.held = true; h.e.airborne = true; h.e.vel.set(0, 0, 0); h.e.state = h.e.alive && h.e.kind === 'npc' ? 'fall' : h.e.state; if (h.e.frozen > 0 && !h.e.statue) g.ents.unfreeze(h.e); } if (h.d) { h.d.held = true; h.d.rest = false; } }
    if (this.held.length) { g.audio.play('portal', -1, 0.5); this.lastTk.copy(origin).addScaledVector(dir, this.holdDist); this.tkVel.set(0, 0, 0); }
    else g.toast('Nothing to grab — aim at objects or buildings', '#d68bff');
  }
  updateHeld(dt: number) {
    const g = this.g, origin = g.camera.position, dir = g.input.forward(V2);
    this.holdDist = clamp(this.holdDist + g.input.wheelAccum * 0.05, 8, 200); g.input.wheelAccum = 0;
    const target = V3.copy(origin).addScaledVector(dir, this.holdDist);
    this.tkVel.copy(target).sub(this.lastTk).divideScalar(Math.max(dt, 0.001)); this.lastTk.copy(target);
    const k = 1 - Math.exp(-dt * 9);
    for (const h of this.held) {
      if (h.e) {
        const e = h.e; if (e.gone) continue;
        const p = e.obj.position; V.copy(target).add(h.off); p.lerp(V, k); e.vel.set(0, 0, 0); e.obj.rotation.y += dt * 1.2; e.obj.rotation.x *= 0.9; e.obj.rotation.z *= 0.9;
        if (Math.random() < 0.3) g.fx.add.emit(p.x + rand(-1, 1), p.y + e.height * 0.5, p.z + rand(-1, 1), 0, 0, 0, 0.5, 0.9, 0.1, col(0xe8c0ff), col(0x9a50ff), 0.9, 0, 0);
      } else if (h.d) {
        const d = h.d; if (!d.alive) continue;
        V.copy(target).add(h.off); d.vx = (V.x - d.x) * 7; d.vy = (V.y - d.y) * 7; d.vz = (V.z - d.z) * 7; d.rest = false;
      }
    }
  }
  throwHeld(mult = 1) {
    const g = this.g, dir = g.input.forward(V2);
    const v = V4.copy(dir).multiplyScalar(110 * mult).add(this.tkVel.clone().multiplyScalar(0.5 * mult));
    if (v.length() > 220) v.setLength(220);
    for (const h of this.held) {
      if (h.e) { h.e.held = false; if (mult > 0) { g.ents.launch(h.e, V.copy(v)); h.e.d.crashArm = true; } else h.e.airborne = true; }
      if (h.d) { h.d.held = false; if (mult > 0) { h.d.vx = v.x + rand(-4, 4); h.d.vy = v.y + rand(-4, 4); h.d.vz = v.z + rand(-4, 4); } }
    }
    if (this.held.length && mult > 0) { g.audio.play('whoosh'); g.shake(0.2); }
    this.held = [];
  }

  // ---- terraform ----
  terraform(dt: number) {
    const g = this.g, hud = g.hud.get(), p = g.aim.point, R = hud.brush;
    const T = g.terrain, mode = hud.tfMode;
    if (g.aim.hit === 'sky') return;
    if (!this.tfStarted) { this.tfStarted = true; this.tfTarget = T.heightAt(p.x, p.z); }
    this.tick -= 0; this.cd = 0;
    this.tfAcc = (this.tfAcc ?? 0) + dt;
    if (this.tfAcc < 0.05) return; const step = this.tfAcc; this.tfAcc = 0;
    if (mode === 'raise') { T.raise(p.x, p.z, R, 95 * step, 1.4, undefined, true); if (Math.random() < 0.3) g.city.damageSphere(V.set(p.x, T.heightAt(p.x, p.z), p.z), R * 0.8, 6, true); }
    else if (mode === 'lower') { T.raise(p.x, p.z, R, -95 * step, 1.4, undefined, true); g.city.damageSphere(V.set(p.x, T.heightAt(p.x, p.z) + 4, p.z), R * 0.7, 3, true); }
    else if (mode === 'flatten') T.flatten(p.x, p.z, R, this.tfTarget, 0.4);
    else if (mode === 'forest') { g.scatter.plantForest(p.x, p.z, R, 2); }
    for (let i = 0; i < 4; i++) g.fx.norm.emit(p.x + rand(-R, R) * 0.7, T.heightAt(p.x, p.z) + 1, p.z + rand(-R, R) * 0.7, rand(-2, 2), rand(3, 8), rand(-2, 2), rand(1, 2), 3, 8, col(0x7a6a50), col(0x9a8a70), 0.4, 0, 0.5);
    g.fx.add.emit(p.x + rand(-R, R) * 0.5, p.y + 1, p.z + rand(-R, R) * 0.5, 0, rand(5, 12), 0, 0.8, 1.5, 0.1, col(0xc0ffc0), col(0x40ff80), 1, 0, 0);
    if (!this.looping) this.loop('wind');
  }
  tfAcc = 0;

  // ---- creation ----
  private freeSpot(p: THREE.Vector3, r: number): THREE.Vector3 {
    const g = this.g, fwd = g.input.forward(V2).setY(0).normalize();
    const q = p.clone();
    for (let i = 0; i < 8; i++) {
      const clear = !g.city.pointInside(q.x, q.y + 2, q.z, r) && !g.city.pointInside(q.x, q.y + 12, q.z, r) && g.terrain.heightAt(q.x, q.z) > 0.3;
      if (clear) return q;
      q.addScaledVector(fwd, -r * 0.8);
    }
    return q;
  }
  createBuilding(kind: string, structure: boolean) {
    const g = this.g, A = g.aim;
    if (A.hit === 'sky') { g.toast('Aim at the ground to build', '#5dff9a'); return; }
    const p = this.freeSpot(A.point, kind === 'pyramid' ? 45 : kind === 'castle' ? 40 : 18);
    const along = Math.abs(g.input.forward(V2).x) > Math.abs(V2.z) ? 'x' : 'z';
    const b = g.city.addBuilding(kind, p.x, p.z, { flatten: true, along: structure && kind !== 'stairs' ? (along === 'x' ? 'z' : 'x') : along, baseY: undefined });
    const list = structure ? STRUCTURE_KINDS : BUILDING_KINDS;
    if (!b) { g.toast('World build capacity reached — regenerate the world to clear space', '#ff8a6a'); return; }
    g.audio.play('spawn'); g.fx.shockwave(V.set(p.x, b.baseY, p.z), 40, 0x7dffd0, 0.8, true, false);
    g.ents.alert(V.set(p.x, b.baseY, p.z), 160, 'cheer'); g.toast(`${list.find((x) => x.id === kind)?.name ?? kind} materializing`, '#5dff9a');
  }
  createVehicle(kind: string) {
    const g = this.g, A = g.aim;
    const p = A.hit === 'sky' ? V.copy(g.camera.position).addScaledVector(g.input.forward(V2), 60) : V.copy(A.point);
    const y = g.terrain.heightAt(p.x, p.z);
    const e = g.ents.spawnVehicle(kind, p.x, p.z, { y: A.hit === 'sky' ? Math.max(p.y, y + 20) : undefined, lane: true, heading: g.input.yaw + Math.PI });
    if (kind === 'boat' && y > -1) { e.mode = 'static'; e.obj.position.y = y; }
    g.audio.play('spawn'); g.fx.shockwave(e.obj.position, 12, 0x5dd4ff, 0.6, true, false);
    for (let i = 0; i < 30; i++) g.fx.add.emit(e.obj.position.x + rand(-3, 3), e.obj.position.y + rand(0, 3), e.obj.position.z + rand(-3, 3), 0, rand(2, 8), 0, 0.9, 1.2, 0.1, col(0xffffff), col(0x40c0ff), 1, 0, 0);
    g.ents.alert(e.obj.position, 100, 'cheer'); g.toast(`${VEHICLE_KINDS.find((x) => x.id === kind)?.name} created`, '#5dd4ff');
  }
  createNPCs(n: number) {
    const g = this.g, A = g.aim;
    if (A.hit === 'sky') { g.toast('Aim at the ground to create people', '#ffd0a0'); return; }
    const p = A.point, rad = Math.sqrt(n) * 3 + 2;
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * rad;
      const e = g.ents.spawnNPC(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, false);
      e.d.center = new THREE.Vector3(p.x, 0, p.z);
      e.state = 'cheer'; e.stateT = rand(3, 5); e.threat.copy(g.player.pos); g.ents.say(e, 'cheer', 3);
      g.fx.add.emit(e.obj.position.x, e.obj.position.y + 1, e.obj.position.z, 0, 4, 0, 0.8, 1.5, 0.1, col(0xffffff), col(0xffd0a0), 1, 0, 0);
    }
    g.audio.play('spawn'); g.toast(`${n} ${n === 1 ? 'person' : 'people'} created`, '#ffd0a0');
  }
  createAnimal(kind: string) {
    const g = this.g, A = g.aim;
    const p = A.hit === 'sky' ? V.copy(g.camera.position).addScaledVector(g.input.forward(V2), 60) : V.copy(A.point);
    const h = g.terrain.heightAt(p.x, p.z), water = h < g.ocean.level - 2;
    if ((kind === 'fish' || kind === 'whale') && !water) { g.toast('Fish and whales need deep water — aim at the sea', '#b0ff6b'); return; }
    if (water && kind !== 'fish' && kind !== 'whale' && kind !== 'bird' && kind !== 'dragon') { g.toast('That animal cannot live in deep water', '#b0ff6b'); return; }
    const list = g.ents.spawnAnimal(kind, p.x, p.z, kind === 'bird' || kind === 'dragon' ? Math.max(p.y, h) + (kind === 'dragon' ? 50 : 25) : kind === 'fish' || kind === 'whale' ? Math.max(h + 3, g.ocean.level - 6) : undefined);
    if (kind === 'dragon') g.audio.play('boom', -1, 0.4);
    g.audio.play('spawn'); for (const e of list.slice(0, 4)) g.fx.shockwave(e.obj.position, 6, 0xb0ff6b, 0.5, true, false);
    g.ents.alert(p, 80, 'awe'); g.toast(`${ANIMAL_KINDS.find((x) => x.id === kind)?.name} created`, '#b0ff6b');
  }
  createWeapon(kind: string) {
    const g = this.g, A = g.aim, pal = this.pal;
    const target = A.hit === 'sky' ? this.groundPt().clone() : A.point.clone();
    const hand = g.player.hand(new THREE.Vector3()); hand.y += 1;
    if (kind === 'swords') g.disasters.sword(target, pal);
    else if (kind === 'spears') g.disasters.spears(hand, target, pal);
    else if (kind === 'missiles') g.disasters.missiles(hand, target, PAL.fire);
    else g.disasters.hammer(target, pal);
    g.toast('Divine arsenal summoned', '#ffe8a0');
  }
  createSettlement() {
    const g = this.g, A = g.aim;
    if (A.hit === 'sky') { g.toast('Aim at the ground to found a settlement', '#9aff8a'); return; }
    const c = A.point.clone();
    if (g.terrain.heightAt(c.x, c.z) < 1) { g.toast('Settlements need dry land', '#9aff8a'); return; }
    const spots: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + rand(-0.2, 0.2), r = rand(32, 62); spots.push(new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r)); }
    let built = 0;
    spots.forEach((s, i) => { if (g.terrain.heightAt(s.x, s.z) > 0.8 && !g.city.pointInside(s.x, g.terrain.heightAt(s.x, s.z) + 2, s.z, 8)) { const b = g.city.addBuilding(i === 0 ? 'apartments' : 'house', s.x, s.z, { flatten: true }); if (b) built++; } });
    g.city.addBuilding('obelisk', c.x, c.z, { w: 5, h: 18, flatten: true, color: 0xd8d0c0 });
    g.scatter.plantForest(c.x, c.z, 90, 14);
    for (let i = 0; i < 12; i++) { const e = g.ents.spawnNPC(c.x + rand(-35, 35), c.z + rand(-35, 35), false); e.d.center = new THREE.Vector3(c.x, 0, c.z); }
    for (let i = 0; i < 4; i++) g.ents.spawnAnimal(pick(['cow', 'sheep', 'sheep', 'horse']), c.x + rand(-50, 50), c.z + rand(-50, 50));
    g.villagesAdded(c);
    g.audio.play('spawn'); g.fx.shockwave(c, 90, 0x9aff8a, 1.2, true, true); g.ents.alert(c, 250, 'cheer');
    g.toast(`Settlement founded — ${built} buildings, 12 settlers`, '#9aff8a');
  }
  clear() { for (const s of this.spikes) this.g.scene.remove(s.mesh); this.spikes = []; this.stop(); }
  cityR() { return CITY_R; }
}
