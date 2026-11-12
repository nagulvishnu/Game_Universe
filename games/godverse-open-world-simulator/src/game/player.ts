import * as THREE from 'three';
import type { Game } from './engine';
import { Humanoid } from './models';
import { FORM_MAP, FORMS } from './types';
import type { FormDef } from './types';
import { clamp, lerp, rand, angleLerp } from './noise';
import { PAL, pal } from './fx';
import type { Pal } from './fx';

const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), TARGET = new THREE.Vector3();
export const FLY = [55, 230, 1500, 7500];
export const GROUND = [1, 3, 14, 60];
export const SPEED_NAMES = ['Normal', 'Super Speed', 'Light Speed', 'Cosmic Speed'];

interface FormLook { skin: number; skinE: number; suit: number; suitE: number; pants: number; trim: number; trimE: number; eye: number; cape: number; capeE: number; light: number; pal: Pal; scale: number }
const LOOK: Record<string, FormLook> = {
  supreme: { skin: 0xf3d3b0, skinE: 0x553300, suit: 0xfff2cc, suitE: 0xffc850, pants: 0xe9c25a, trim: 0xffc830, trimE: 0xffa800, eye: 0xfff0a0, cape: 0xfff8e0, capeE: 0xffc040, light: 0xffd070, pal: PAL.gold, scale: 1.12 },
  cosmic: { skin: 0x6a4aff, skinE: 0x4a20ff, suit: 0x1d1260, suitE: 0x8a40ff, pants: 0x140a48, trim: 0xa070ff, trimE: 0x7a40ff, eye: 0xff9aff, cape: 0x2a1470, capeE: 0x6a30ff, light: 0x9a60ff, pal: PAL.purple, scale: 1.15 },
  shadow: { skin: 0x14121c, skinE: 0x2a0040, suit: 0x0a0810, suitE: 0x300050, pants: 0x0a0810, trim: 0x5a1a9a, trimE: 0x7a20ff, eye: 0xff2040, cape: 0x08060c, capeE: 0x200030, light: 0x8a30ff, pal: PAL.dark, scale: 1.12 },
  destruction: { skin: 0x8a2a1a, skinE: 0xff3010, suit: 0x2a1010, suitE: 0xff4010, pants: 0x1a0a0a, trim: 0xff5a1a, trimE: 0xff3000, eye: 0xffe000, cape: 0x3a0a0a, capeE: 0xff2000, light: 0xff5020, pal: PAL.lava, scale: 1.2 },
  elemental: { skin: 0xd8b090, skinE: 0x103020, suit: 0x2a8a6a, suitE: 0x20ffaa, pants: 0x205040, trim: 0xffd24d, trimE: 0xffa000, eye: 0x88ffee, cape: 0x1a6a4a, capeE: 0x30ff90, light: 0x40ffb0, pal: PAL.green, scale: 1.12 },
  infinite: { skin: 0xe8ffff, skinE: 0x60f0ff, suit: 0xffffff, suitE: 0x80f8ff, pants: 0xc0f8ff, trim: 0xffffff, trimE: 0xffffff, eye: 0xffffff, cape: 0xe0ffff, capeE: 0x60f0ff, light: 0x80f4ff, pal: PAL.cyan, scale: 1.14 },
};
const RAINBOW = pal(0xff40a0, 0x40ffff);

export class Player {
  pos = new THREE.Vector3(0, 90, 120);
  vel = new THREE.Vector3();
  flying = true; speedLevel = 0; onGround = false; facing = Math.PI; lean = 0;
  form: FormDef = FORMS[0]; look: FormLook = LOOK.supreme;
  invulnerable = true; hp = 100;
  root = new THREE.Group(); pivot = new THREE.Group();
  hum: Humanoid;
  cape!: THREE.Mesh; capeBase!: Float32Array;
  halo = new THREE.Group(); horns = new THREE.Group(); wings = new THREE.Group(); darkWings = new THREE.Group(); orbs = new THREE.Group(); rings = new THREE.Group(); spikes = new THREE.Group();
  capeMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  shield: THREE.Mesh;
  punchT = 0; aiming = false; transformT = 0; slam = false; lastSpace = -1; speed = 0; accum = 0;
  fallSpeed = 0; hover = 0; trailAcc = 0;
  look2 = 0;

  constructor(public g: Game) {
    this.hum = new Humanoid({ skin: 0xf3d3b0, shirt: 0xffffff, pants: 0xffffff, hair: 0x222222, shoes: 0x222222, detail: true, scale: 1.12 });
    const H = 1.0 * 1.12;
    this.root.add(this.pivot); this.pivot.position.y = H; this.pivot.rotation.order = 'YXZ';
    this.hum.root.position.y = -H; this.pivot.add(this.hum.root);
    const hm = this.hum.mats;
    hm.hair.color.set(0x111111);
    this.capeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6, emissive: 0xffc040, emissiveIntensity: 0.3 });
    const cg = new THREE.PlaneGeometry(0.64, 1.25, 5, 12); cg.translate(0, -0.62, 0);
    this.cape = new THREE.Mesh(cg, this.capeMat); this.cape.position.set(0, 0.54, -0.15); this.cape.castShadow = true;
    this.capeBase = (cg.attributes.position.array as Float32Array).slice();
    this.hum.chest.add(this.cape);
    this.build();
    this.light = new THREE.PointLight(0xffd070, 2.5, 40, 1.6); this.root.add(this.light); this.light.position.y = 1.5;
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(2.6, 32, 20), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      uniforms: { c: { value: new THREE.Color(0x80d0ff) }, t: { value: 0 } },
      vertexShader: 'varying vec3 n; varying vec3 v; void main(){ n=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); v=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 c; uniform float t; varying vec3 n; varying vec3 v; void main(){ float f=pow(1.0-abs(dot(n,v)),3.0); gl_FragColor=vec4(c, f*0.22*(0.8+0.2*sin(t*3.0))); }',
    }));
    this.shield.position.y = 1.1; this.root.add(this.shield);
    g.scene.add(this.root);
    this.applyForm('supreme', true);
  }

  private build() {
    const hum = this.hum, gold = new THREE.MeshStandardMaterial({ color: 0xffd24d, metalness: 1, roughness: 0.25, emissive: 0xffa000, emissiveIntensity: 0.9 });
    const glowMat = (c: number, o = 0.8) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    // halo
    const h1 = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.025, 12, 48), gold); h1.position.set(0, 0.4, -0.12); h1.rotation.x = -0.25;
    const h2 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.012, 8, 48), glowMat(0xfff0a0, 0.8)); h2.position.copy(h1.position); h2.rotation.copy(h1.rotation);
    const rays = new THREE.Mesh(new THREE.RingGeometry(0.4, 1.3, 32, 1), glowMat(0xffe080, 0.18)); rays.position.set(0, 0.4, -0.16);
    this.halo.add(h1, h2, rays); hum.head.add(this.halo);
    // horns & spikes
    const hornM = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, emissive: 0xff3000, emissiveIntensity: 0.7, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const hn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 8), hornM); hn.position.set(s * 0.09, 0.3, 0.0); hn.rotation.set(-0.35, 0, -s * 0.55); this.horns.add(hn);
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 6), hornM); sp.position.set(s * 0.32, 0.62, 0); sp.rotation.z = -s * 0.8; this.spikes.add(sp);
      const sp2 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), hornM); sp2.position.set(s * 0.12, 0.7, -0.1); sp2.rotation.x = -0.6; this.spikes.add(sp2);
    }
    hum.head.add(this.horns); hum.chest.add(this.spikes);
    // light wings (infinite)
    const featherShape = () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.5, 0.2, 1.7, 0.05); s.quadraticCurveTo(1.0, -0.12, 0, -0.1); return s; };
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * 0.1, 0.45, -0.18);
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.ShapeGeometry(featherShape()), glowMat(i % 2 ? 0x80ffff : 0xffffff, 0.55));
        m.scale.set(s * (1 - i * 0.07), 1, 1); m.rotation.z = 0.5 - i * 0.2; m.rotation.y = s * 0.45; w.add(m);
      }
      this.wings.add(w);
    }
    hum.chest.add(this.wings);
    // shadow bat wings
    const batShape = () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.8, 1.2); sh.lineTo(1.3, 0.9); sh.lineTo(1.5, 1.0); sh.lineTo(1.6, 0.2); sh.lineTo(1.2, 0.35); sh.lineTo(1.1, -0.35); sh.lineTo(0.7, -0.1); sh.lineTo(0.4, -0.6); sh.lineTo(0.2, -0.2); sh.closePath(); return sh; };
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * 0.1, 0.4, -0.2);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(batShape()), new THREE.MeshStandardMaterial({ color: 0x07050c, emissive: 0x3a0070, emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.7 }));
      m.scale.set(s * 1.1, 1.1, 1.1); m.rotation.y = s * 0.5; w.add(m); this.darkWings.add(w);
    }
    hum.chest.add(this.darkWings);
    // elemental orbs
    const orbDefs = [[0xff5a10, 0xff3000], [0x2a8aff, 0x1060ff], [0xe8f8ff, 0xaaccff], [0x6a4a2a, 0x40ff60]];
    orbDefs.forEach(([c, e], i) => {
      const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 2), new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 1.6, roughness: 0.3 }));
      o.userData.a = (i / 4) * Math.PI * 2; this.orbs.add(o);
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), glowMat(e, 0.3)); o.add(gl);
    });
    // cosmic rings with tiny planets
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1.3 + i * 0.4, 0.012, 8, 64), glowMat(i ? 0x6a90ff : 0xc080ff, 0.55)); r.rotation.set(1.2 - i * 0.9, i * 0.8, 0);
      const pl = new THREE.Mesh(new THREE.SphereGeometry(0.1 + i * 0.04, 12, 8), new THREE.MeshStandardMaterial({ color: i ? 0x40a0ff : 0xff9a60, emissive: i ? 0x2060ff : 0xff6020, emissiveIntensity: 0.9 }));
      pl.userData.r = 1.3 + i * 0.4; pl.userData.s = 1.2 - i * 0.5; r.add(pl); this.rings.add(r);
    }
    this.pivot.add(this.rings); this.rings.position.y = 0;
    this.pivot.add(this.orbs);
  }

  applyForm(id: string, instant = false) {
    const f = FORM_MAP[id]; if (!f) return;
    this.form = f; const L = LOOK[id]; this.look = L;
    const m = this.hum.mats;
    const set = (k: string, c: number, e: number, ei: number) => { m[k].color.set(c); m[k].emissive.set(e); m[k].emissiveIntensity = ei; };
    set('skin', L.skin, L.skinE, id === 'cosmic' || id === 'infinite' ? 0.8 : id === 'shadow' ? 0.4 : 0.25);
    set('shirt', L.suit, L.suitE, id === 'supreme' ? 0.18 : 0.55); set('pants', L.pants, L.suitE, 0.35);
    set('trim', L.trim, L.trimE, 0.9); set('hair', id === 'supreme' ? 0xfff0b0 : id === 'infinite' ? 0xffffff : id === 'shadow' ? 0x050308 : id === 'cosmic' ? 0xb090ff : id === 'destruction' ? 0x300808 : 0x2a1a0a, id === 'infinite' ? 0xaaffff : 0x000000, id === 'infinite' ? 0.6 : 0);
    set('shoes', L.trim, L.trimE, 0.6);
    m.eye.color.set(L.eye); m.eye.emissive.set(L.eye); m.eye.emissiveIntensity = 3;
    this.capeMat.color.set(L.cape); this.capeMat.emissive.set(L.capeE); this.capeMat.emissiveIntensity = id === 'supreme' ? 0.25 : 0.45;
    this.capeMat.transparent = id === 'shadow' || id === 'infinite'; this.capeMat.opacity = id === 'shadow' ? 0.92 : id === 'infinite' ? 0.7 : 1; this.capeMat.needsUpdate = true;
    this.halo.visible = id === 'supreme'; this.horns.visible = id === 'destruction'; this.spikes.visible = id === 'destruction';
    this.wings.visible = id === 'infinite'; this.darkWings.visible = id === 'shadow'; this.orbs.visible = id === 'elemental'; this.rings.visible = id === 'cosmic' || id === 'infinite';
    this.light.color.set(L.light);
    if (!instant) this.transformT = 1.2;
    this.hum.root.scale.setScalar(L.scale);
    this.hum.root.position.y = -1.0 * L.scale;
    this.pivot.position.y = 1.0 * L.scale;
  }

  get palette(): Pal { return this.form.id === 'infinite' ? (Math.random() < 0.5 ? PAL.cyan : RAINBOW) : this.look.pal; }
  get height() { return this.look.scale * 1.8; }
  center(out = V3) { return out.copy(this.pos).setY(this.pos.y + this.height * 0.55); }
  hand(out = new THREE.Vector3()) {
    const i = this.g.input; V1.set(-Math.sin(i.yaw), 0, -Math.cos(i.yaw));
    return out.copy(this.pos).setY(this.pos.y + this.height * 0.62).addScaledVector(V1, 0.7);
  }
  hurt(n: number) {
    if (this.invulnerable) return;
    this.hp -= n; this.g.hud.set({ hit: this.g.hud.get().hit + 1 });
    if (this.hp <= 0) {
      if (this.g.godWars.active) { this.g.godWars.playerDefeated(); return; }
      this.hp = 100; this.vel.set(0, 0, 0); this.pos.y += 4; this.g.toast('Your mortal shell reforms…', '#ffd24d'); this.g.fx.shockwave(this.pos, 40, 0xffffff, 0.8);
    }
  }
  setSpeedLevel(l: number) { this.speedLevel = l; }

  update(dt: number) {
    const g = this.g, inp = g.input, T = g.terrain, city = g.city, active = !g.hud.get().panelOpen && !g.hud.get().wheelOpen;
    const k = (c: string) => active && inp.down(c);
    const yaw = inp.yaw, cp = inp.pitch;
    const fwd = V1.set(-Math.sin(yaw) * Math.cos(cp), Math.sin(cp), -Math.cos(yaw) * Math.cos(cp));
    const right = V2.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const f = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), r = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
    const boost = k('ShiftLeft') || k('ShiftRight');
    const upIn = (k('Space') ? 1 : 0) - (k('KeyC') || k('ControlLeft') ? 1 : 0);
    // flight toggle by double-tap space
    if (active && inp.pressed('Space')) {
      const now = performance.now();
      if (now - this.lastSpace < 300) { this.setFlying(!this.flying); this.lastSpace = -1; }
      else { this.lastSpace = now; if (!this.flying && this.onGround) { this.vel.y = 14; this.onGround = false; } }
    }
    if (this.pos.y > 1800 && !this.flying) this.flying = true;
    const level = this.speedLevel;
    let wantDown = false;
    const px = this.pos.x, pz = this.pos.z;
    // ---- velocity ----
    if (this.flying) {
      const base = FLY[level] * (boost ? 2.2 : 1);
      TARGET.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, r); TARGET.y += upIn * 0.85;
      if (TARGET.lengthSq() > 1) TARGET.normalize();
      wantDown = TARGET.y < -0.3 && f > 0 || upIn < 0;
      TARGET.multiplyScalar(base);
      this.vel.lerp(TARGET, 1 - Math.exp(-dt * (boost ? 3.4 : 2.8)));
      if (TARGET.lengthSq() < 1) this.vel.multiplyScalar(Math.exp(-dt * 2.5));
    } else {
      const sp = (boost ? 22 : 9) * GROUND[level];
      V3.set(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(f).addScaledVector(right, r);
      if (V3.lengthSq() > 1) V3.normalize(); V3.multiplyScalar(sp);
      const a = 1 - Math.exp(-dt * (this.onGround ? 10 : 2.5));
      this.vel.x += (V3.x - this.vel.x) * a; this.vel.z += (V3.z - this.vel.z) * a;
      this.vel.y -= g.gravity(this.pos.y) * 1.15 * dt; if (this.vel.y < -160) this.vel.y = -160;
      if (active && this.onGround && k('Space') && inp.pressed('Space') === false && false) this.vel.y = 14;
    }
    // ---- integrate with sub-steps (building collision / smashing) ----
    const spd = this.vel.length(); this.speed = spd;
    const steps = clamp(Math.ceil((spd * dt) / 6), 1, 60), sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      const nx = this.pos.x + this.vel.x * sdt, ny = this.pos.y + this.vel.y * sdt, nz = this.pos.z + this.vel.z * sdt;
      const h0 = ny + 0.3, h1 = ny + this.height * 0.5, h2 = ny + this.height - 0.1;
      if (this.pos.y < 700 && (city.pointInside(nx, h0, nz, 0.4) || city.pointInside(nx, h1, nz, 0.4) || city.pointInside(nx, h2, nz, 0.4))) {
        if (spd > 70) { city.damageSphere(V3.set(nx, ny + 1.5, nz), 6 + Math.min(spd, 4000) * 0.01, spd * 0.12, true); g.shake(0.15); this.pos.set(nx, ny, nz); }
        else if (!city.pointInside(nx, h1, this.pos.z, 0.4) && !city.pointInside(nx, h0, this.pos.z, 0.4)) { this.pos.x = nx; this.pos.y = ny; this.vel.z = 0; }
        else if (!city.pointInside(this.pos.x, h1, nz, 0.4) && !city.pointInside(this.pos.x, h0, nz, 0.4)) { this.pos.z = nz; this.pos.y = ny; this.vel.x = 0; }
        else { this.vel.x = 0; this.vel.z = 0; this.pos.y = ny; }
      } else this.pos.set(nx, ny, nz);
    }
    // ---- ground ----
    const terr = T.heightAt(this.pos.x, this.pos.z);
    let gh = Math.max(terr, city.heightAt(this.pos.x, this.pos.z, this.pos.y));
    if (!this.flying) gh = Math.max(gh, g.ocean.level);
    this.onGround = false;
    if (this.pos.y < 3000) {
      if (this.flying) {
        const floor = Math.max(terr, city.heightAt(this.pos.x, this.pos.z, this.pos.y)) + 0.25;
        if (this.pos.y < floor) { this.pos.y = floor; if (this.vel.y < 0) this.vel.y = 0; if (wantDown && this.pos.y - gh < 0.8) { this.flying = false; this.onGround = true; } }
      } else if (this.pos.y <= gh) {
        const impact = -this.vel.y;
        this.pos.y = gh; this.vel.y = 0; this.onGround = true;
        if (impact > 40) this.landSlam(impact);
        this.slam = false;
        if (gh === g.ocean.level && impact > 10) g.fx.puff(V3.set(this.pos.x, gh, this.pos.z), 3, new THREE.Color(0.8, 0.9, 1), 6);
      }
    }
    // planets (solid)
    if (this.pos.y > 1500) for (const p of g.sky.planets) {
      if (!p.alive) continue;
      V3.copy(this.pos).sub(p.pos); const d = V3.length(), rr = p.radius + 3;
      if (d < rr) { if (d < 0.001) V3.set(0, 1, 0); else V3.normalize(); this.pos.copy(p.pos).addScaledVector(V3, rr); const inward = this.vel.dot(V3); if (inward < 0) this.vel.addScaledVector(V3, -inward); }
    }
    this.pos.x = clamp(this.pos.x, -15000, 15000); this.pos.z = clamp(this.pos.z, -15000, 15000);
    void px; void pz;
    // ---- sonic wake: affects the world at high speed ----
    if (this.speed > 250 && this.pos.y < 400) {
      const h = this.pos.y - terr;
      if (h < 60) { this.accum += dt; if (this.accum > 0.06) { this.accum = 0; g.ents.blast(V3.copy(this.pos), 14 + this.speed * 0.01, Math.min(this.speed * 0.08, 60), 25); g.scatter.damageSphere(this.pos, 10 + this.speed * 0.004); if (this.speed > 800) city.damageSphere(this.pos, 10 + this.speed * 0.004, this.speed * 0.05, true); if (this.speed > 400 && h < 8) g.fx.puff(V3.set(this.pos.x, terr + 1, this.pos.z), 4, undefined, 2); } }
    }
    // ---- orientation / animation ----
    const speedF = clamp(this.speed / 35, 0, 1);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const fireHeld = this.aiming || this.punchT > 0;
    const camHead = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
    let targetFace = this.facing;
    if (fireHeld || (this.flying && (hs < this.speed * 0.5 || this.speed < 6))) targetFace = camHead;
    else if (hs > 1.5) targetFace = Math.atan2(this.vel.x, this.vel.z);
    else if (this.flying) targetFace = camHead;
    this.facing = angleLerp(this.facing, targetFace, 1 - Math.exp(-dt * (fireHeld ? 14 : 7)));
    let targetLean = 0;
    if (this.flying && !fireHeld && this.speed > 8) { const beta = Math.asin(clamp(this.vel.y / Math.max(this.speed, 0.001), -1, 1)); targetLean = speedF * (Math.PI / 2 - beta * 0.95); }
    else if (!this.flying && this.onGround && hs > 12) targetLean = 0.25;
    this.lean = lerp(this.lean, targetLean, 1 - Math.exp(-dt * 6));
    this.pivot.rotation.y = this.facing; this.pivot.rotation.x = this.lean;
    this.root.position.copy(this.pos);
    this.punchT = Math.max(0, this.punchT - dt);
    let mode = 'idle';
    if (this.punchT > 0) mode = 'punch';
    else if (this.aiming) mode = 'charge';
    else if (this.flying) mode = this.speed > 14 ? 'fly' : 'hover';
    else if (!this.onGround) mode = 'hover';
    else if (hs > 14) mode = 'run';
    else if (hs > 0.6) mode = 'walk';
    this.hum.pose(mode, dt, hs, g.clock * 1, mode === 'punch' ? 30 : 10);
    if (mode === 'run' || mode === 'walk') this.pivot.position.y = this.look.scale + 0;
    this.updateVisuals(dt, speedF);
    if (this.transformT > 0) this.transformT = Math.max(0, this.transformT - dt);
    this.shield.visible = this.invulnerable; (this.shield.material as THREE.ShaderMaterial).uniforms.t.value = g.clock;
    if (this.invulnerable) this.repelNearby(dt);
  }

  private repelNearby(dt: number) {
    const g = this.g, c = this.center(V3);
    for (const e of g.ents.list) {
      if (e.gone || e.held) continue;
      const d = e.obj.position.distanceTo(c);
      if (d < 3.2 + e.radius && d > 0.01) { V2.copy(e.obj.position).sub(c).setY(0).normalize().multiplyScalar(6 * dt * 10); e.obj.position.add(V2.multiplyScalar(0.1)); }
    }
  }

  setFlying(on: boolean) {
    if (on === this.flying) return;
    this.flying = on;
    if (on) { this.vel.y = Math.max(this.vel.y, 6); this.pos.y += 0.5; this.g.toast('Flight engaged', '#8ae0ff'); }
    else this.g.toast('Flight disengaged', '#8ae0ff');
  }

  landSlam(impact: number) {
    const g = this.g;
    const r = clamp(impact * 0.35, 12, 90);
    const p = V3.set(this.pos.x, this.pos.y + 0.5, this.pos.z);
    g.explode(p, r, { force: impact * 0.5, crater: this.slam ? 1 : 0.5, pal: this.palette, hurt: false, sound: true });
    g.shake(clamp(impact / 120, 0.2, 1.2));
  }

  updateVisuals(dt: number, speedF: number) {
    const g = this.g, t = g.clock, id = this.form.id;
    // cape billow
    const pos = this.cape.geometry.attributes.position as THREE.BufferAttribute, base = this.capeBase;
    const fly = this.flying ? speedF : clamp(Math.hypot(this.vel.x, this.vel.z) / 30, 0, 0.6);
    for (let i = 0; i < pos.count; i++) {
      const y = -base[i * 3 + 1] / 1.25, x = base[i * 3];
      const w = Math.sin(t * (6 + fly * 14) + y * 6 + x * 3) * (0.02 + fly * 0.14) * y;
      pos.setXYZ(i, x * (1 + y * fly * 0.5), base[i * 3 + 1], -y * (0.08 + fly * 0.9) * (this.lean > 0.8 ? 0.2 : 1) + w - (this.lean > 0.8 ? y * 0.0 : 0));
    }
    pos.needsUpdate = true; this.cape.geometry.computeVertexNormals();
    // accessories animation
    this.halo.rotation.z += dt * 0.6;
    if (this.wings.visible) this.wings.children.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (Math.sin(t * 3) * 0.12 + 0.1 + speedF * 0.4)));
    if (this.darkWings.visible) this.darkWings.children.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (Math.sin(t * 2.4) * 0.15 + 0.1)));
    if (this.orbs.visible) this.orbs.children.forEach((o, i) => { const a = (o.userData.a as number) + t * 1.6; o.position.set(Math.cos(a) * 1.5, 0.3 + Math.sin(t * 2 + i) * 0.2, Math.sin(a) * 1.5); o.rotation.y += dt * 3; });
    if (this.rings.visible) this.rings.children.forEach((r) => { r.children.forEach((p) => { const a = t * (p.userData.s as number) + (p.userData.r as number); p.position.set(Math.cos(a) * (p.userData.r as number), Math.sin(a) * (p.userData.r as number), 0); }); r.rotation.z += dt * 0.3; });
    // transformation pulse
    const tp = this.transformT / 1.2;
    const sc = this.look.scale * (1 + (tp > 0 ? Math.sin(tp * Math.PI) * 0.22 : 0));
    this.hum.root.scale.setScalar(sc); this.hum.root.position.y = -1.0 * sc;
    this.light.intensity = 2.2 + Math.sin(t * 5) * 0.4 + tp * 14;
    // aura
    const ctr = this.center(V3), fx = g.fx, R = 0.7;
    const rate = (this.transformT > 0 ? 160 : 55) * dt + this.trailAcc; const n = Math.floor(rate); this.trailAcc = rate - n;
    const col = (h: number) => new THREE.Color(h);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, rr = R * (0.4 + Math.random()), y = ctr.y + rand(-0.9, 0.9), x = ctr.x + Math.cos(a) * rr, z = ctr.z + Math.sin(a) * rr;
      switch (id) {
        case 'supreme': fx.add.emit(x, y, z, rand(-0.3, 0.3), rand(0.8, 2.5), rand(-0.3, 0.3), rand(0.8, 1.6), 0.28, 0.02, col(0xffffff), col(0xffb820), 1, 0, 0.5); break;
        case 'cosmic': fx.add.emit(x, y, z, -Math.sin(a) * 1.4, rand(-0.2, 0.8), Math.cos(a) * 1.4, rand(1, 2), 0.22, 0.02, col(Math.random() < 0.5 ? 0xe0b0ff : 0x80b0ff), col(0x6020ff), 1, 0, 0.2); break;
        case 'shadow': fx.norm.emit(x, y - 0.3, z, rand(-0.4, 0.4), rand(0.6, 1.6), rand(-0.4, 0.4), rand(1, 2), 0.6, 1.4, col(0x08040e), col(0x2a0a50), 0.85, 0, 0.4); if (Math.random() < 0.25) fx.add.emit(x, y, z, 0, rand(1, 2.5), 0, rand(0.6, 1.2), 0.18, 0.02, col(0xff3050), col(0x600020), 1, 0, 0.3); break;
        case 'destruction': fx.flame(V2.set(x, y - 0.3, z), V1.set(0, 2.5, 0), 0.7, 0.3); if (Math.random() < 0.25) fx.add.emit(x, y, z, rand(-1, 1), rand(1, 4), rand(-1, 1), rand(0.6, 1.4), 0.12, 0.02, col(0xffe080), col(0xff3000), 1, 0, 0.2, 2); break;
        case 'elemental': { const c = [0xff7a20, 0x40a0ff, 0xe8f8ff, 0x50e060][i % 4]; fx.add.emit(x, y, z, -Math.sin(a) * 0.8, rand(0.5, 2), Math.cos(a) * 0.8, rand(0.8, 1.5), 0.26, 0.02, col(c), col(c), 1, 0, 0.3); break; }
        case 'infinite': { const c = new THREE.Color().setHSL((t * 0.4 + Math.random() * 0.3) % 1, 1, 0.65); fx.add.emit(x, y, z, rand(-0.5, 0.5), rand(1, 3.5), rand(-0.5, 0.5), rand(0.7, 1.5), 0.3, 0.02, new THREE.Color(0xffffff), c, 1, 0, 0.4); break; }
      }
    }
    if (this.transformT > 0.6) { for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), s = rand(8, 18); fx.add.emit(ctr.x, ctr.y, ctr.z, Math.cos(a) * s, rand(-2, 6), Math.sin(a) * s, 0.7, 0.5, 0.05, col(0xffffff), this.look.pal.b, 1, 0, 2); } }
    // speed trail
    if (this.speed > 40) {
      const mult = clamp(this.speed / 120, 0.5, 6);
      for (let i = 0; i < Math.min(8, 2 + mult); i++) {
        const o = V2.set(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6));
        fx.add.emit(ctr.x + o.x - this.vel.x * dt * rand(0, 1), ctr.y + o.y - this.vel.y * dt * rand(0, 1), ctr.z + o.z - this.vel.z * dt * rand(0, 1), 0, 0, 0, 0.5 + mult * 0.08, 0.4 + mult * 0.15, 0.05, col(0xffffff), this.palette.b, 0.9, 0, 0);
      }
    }
  }

  // ---- camera ----
  updateCamera(dt: number) {
    const g = this.g, cam = g.camera, inp = g.input, city = g.city, T = g.terrain;
    const yaw = inp.yaw, pitch = inp.pitch;
    const speedF = clamp(this.speed / 60, 0, 1);
    const tgtDist = (inp.zoom + 6.0 + speedF * 5.5 + (this.speedLevel >= 2 ? this.speed * 0.0012 : 0)) * this.look.scale;
    inp.camDist += (tgtDist - inp.camDist) * (1 - Math.exp(-dt * 5));
    const tgt = V1.copy(this.pos).setY(this.pos.y + 1.75 * this.look.scale);
    const fwd = V2.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const right = V3.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const dist = inp.camDist;
    let d = dist;
    const want = new THREE.Vector3().copy(tgt).addScaledVector(right, 0.8 * this.look.scale);
    for (let s = 6; s >= 1; s--) {
      const t = (s / 6) * dist; const px = want.x - fwd.x * t, py = want.y - fwd.y * t, pz = want.z - fwd.z * t;
      if (!(this.pos.y < 700 && city.pointInside(px, py, pz, 0.6))) { d = t; break; } else d = (s - 1) / 6 * dist;
    }
    const cp = want.addScaledVector(fwd, -Math.max(d, 1.2));
    if (cp.y < 3000) { const h = Math.max(T.heightAt(cp.x, cp.z), city.heightAt(cp.x, cp.z, cp.y)); if (cp.y < h + 0.8) cp.y = h + 0.8; }
    const sh = g.shakeAmt;
    if (sh > 0.001) cp.add(V1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(sh * 1.2));
    cam.position.copy(cp);
    cam.rotation.set(pitch, yaw, 0, 'YXZ');
    const fov = g.hud.get().fov + speedF * 16 + (this.speedLevel >= 2 ? clamp(this.speed / 600, 0, 1) * 20 : 0) + (this.transformT > 0 ? Math.sin((this.transformT / 1.2) * Math.PI) * 10 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 6)); cam.updateProjectionMatrix(); }
  }

  teleport(p: THREE.Vector3) {
    this.pos.copy(p); this.vel.set(0, 0, 0);
    const T = this.g.terrain, h = Math.max(T.heightAt(p.x, p.z), this.g.ocean.level * 0);
    if (p.y < 3000 && this.pos.y < h + 1) this.pos.y = h + 2;
  }
}
