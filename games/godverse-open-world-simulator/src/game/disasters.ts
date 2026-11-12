import * as THREE from 'three';
import type { Game } from './engine';
import { PAL, pal } from './fx';
import { makeRock, makeSword, makeSpear, makeMissile, makeHammer } from './models';
import { clamp, rand, smoothstep } from './noise';

const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
const col = (h: number) => new THREE.Color(h);
const DUST_A = col(0x6a5a48), DUST_B = col(0x8a8070), WHITE = col(0xffffff), FOAM = col(0xe8f4ff);

const LATHE = new THREE.LatheGeometry(Array.from({ length: 24 }, (_, i) => { const t = i / 23; return new THREE.Vector2(0.06 + 0.94 * Math.pow(t, 1.4), t); }), 40);
const tornadoMat = (dir: number) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uOp: { value: 0 }, uD: { value: dir } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform float uT,uOp,uD; varying vec2 vUv;
void main(){ float s=sin(vUv.x*60.0+vUv.y*14.0-uT*7.0*uD)*0.5+0.5; float s2=sin(vUv.x*23.0-vUv.y*9.0+uT*4.0*uD)*0.5+0.5;
float a=(0.1+0.42*s*s2)*(1.0-vUv.y*0.5)*smoothstep(0.0,0.06,vUv.y)*uOp; vec3 c=mix(vec3(0.22,0.19,0.17),vec3(0.7,0.66,0.6),s2*vUv.y+0.1); gl_FragColor=vec4(c,a); }`,
});
const holeDiskMat = (ri: number, ro: number) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, ri: { value: ri }, ro: { value: ro }, uOp: { value: 1 } },
  vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform float uT,ri,ro,uOp; varying vec2 vP;
void main(){ float r=length(vP); float rn=(r-ri)/(ro-ri); float ang=atan(vP.y,vP.x); float s=sin(ang*7.0+rn*24.0-uT*5.0)*0.5+0.5;
vec3 c=mix(vec3(1.0,0.97,0.85),vec3(1.0,0.3,0.05),pow(rn,0.6)); float a=(1.0-rn)*(0.3+0.7*s)*smoothstep(0.0,0.08,rn)*uOp; gl_FragColor=vec4(c*1.6,a); }`,
});
const fresnelMat = (c: number, k = 0.5, rainbow = false) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { c: { value: col(c) }, t: { value: 0 }, op: { value: 1 } },
  vertexShader: 'varying vec3 n; varying vec3 v; varying vec3 wp; void main(){ n=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); v=normalize(-mv.xyz); wp=position; gl_Position=projectionMatrix*mv; }',
  fragmentShader: `uniform vec3 c; uniform float t,op; varying vec3 n; varying vec3 v; varying vec3 wp;
void main(){ float f=pow(1.0-abs(dot(n,v)),2.0); vec3 col=${rainbow ? '0.5+0.5*cos(6.28*(wp.y*0.02+wp.x*0.015+t*0.3+vec3(0.0,0.33,0.67)))' : 'c'}; float w=0.7+0.3*sin(wp.y*0.3+t*3.0); gl_FragColor=vec4(col, (f*${k.toFixed(2)}+0.06)*op*w); }`,
});

interface Tornado { pos: THREE.Vector3; dir: number; life: number; age: number; max: number; R: number; H: number; g: THREE.Group; m1: THREE.ShaderMaterial; m2: THREE.ShaderMaterial; hitT: number; alertT: number; treeT: number }
interface Hole { pos: THREE.Vector3; life: number; age: number; g: THREE.Group; core: THREE.Mesh; disk: THREE.ShaderMaterial; hitT: number; craterT: number; eaten: number }
interface Tsunami { o: THREE.Vector3; dir: THREE.Vector3; perp: THREE.Vector3; dist: number; speed: number; W: number; Hh: number; mesh: THREE.Mesh; maxD: number; hitT: number; fade: number }
interface Quake { pos: THREE.Vector3; R: number; life: number; age: number; hitT: number; jolt: number; fiss: number[]; fissT: number; snd: number }
interface Rock { mesh: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; grav: number; size: number; R: number; trail: 'meteor' | 'lava'; pal: ReturnType<typeof pal>; force: number; crater: number }
interface Volcano { pos: THREE.Vector3; life: number; age: number; top: number; bombT: number; flashT: number }
interface Portal { pos: THREE.Vector3; normal: THREE.Vector3; g: THREE.Group; disk: THREE.ShaderMaterial; partner: Portal | null; life: number; color: number }
interface Zone { pos: THREE.Vector3; R: number; life: number; age: number; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; kind: 'grav' | 'distort'; hitT: number }
interface Wave { c: THREE.Vector3; r: number; speed: number; maxR: number; force: number; destroyH: number; rupture: boolean; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; fxT: number; pal: ReturnType<typeof pal> }
interface Proj { kind: 'sword' | 'spear' | 'missile' | 'hammer'; obj: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; target: THREE.Vector3; life: number; delay: number; stuck: number; pal: ReturnType<typeof pal>; age: number; R: number }
interface Pending { t: number; fn: () => void }

const PROFILE: number[][] = [[-1, 0], [-0.75, 0.1], [-0.5, 0.3], [-0.3, 0.55], [-0.15, 0.82], [-0.05, 1], [0.03, 0.95], [0.08, 0.7], [0.11, 0.4], [0.13, 0.12], [0.14, 0]];
const NL = 56, NP = PROFILE.length;
const RING = new THREE.RingGeometry(0.97, 1, 128).rotateX(-Math.PI / 2);

export class Disasters {
  tornadoes: Tornado[] = []; holes: Hole[] = []; tsunamis: Tsunami[] = []; quakes: Quake[] = []; rocks: Rock[] = [];
  volcanoes: Volcano[] = []; portals: Portal[] = []; zones: Zone[] = []; waves: Wave[] = []; projs: Proj[] = []; pending: Pending[] = [];
  pendingPortal: Portal | null = null;
  frame = 1;
  sphere = new THREE.SphereGeometry(1, 36, 22);
  constructor(public g: Game) {}

  get count() { return this.tornadoes.length + this.holes.length + this.tsunamis.length + this.quakes.length + this.volcanoes.length + this.zones.length + this.waves.length; }

  ground(x: number, z: number) { return Math.max(this.g.terrain.heightAt(x, z), this.g.ocean.level); }

  // ---------------- spawns ----------------
  tornado(p: THREE.Vector3, life = 28, R = 55) {
    const g = this.g;
    if (this.tornadoes.length >= 7) this.remove(this.tornadoes.shift()!.g);
    const grp = new THREE.Group(); const H = 260;
    const m1 = tornadoMat(1), m2 = tornadoMat(-1);
    const a = new THREE.Mesh(LATHE, m1), b = new THREE.Mesh(LATHE, m2);
    a.scale.set(R, H, R); b.scale.set(R * 0.7, H * 0.95, R * 0.7); a.frustumCulled = b.frustumCulled = false; a.renderOrder = b.renderOrder = 5;
    grp.add(a, b); const h = this.ground(p.x, p.z); grp.position.set(p.x, h, p.z); g.scene.add(grp);
    this.tornadoes.push({ pos: new THREE.Vector3(p.x, h, p.z), dir: rand(0, 6.28), life, age: 0, max: life, R, H, g: grp, m1, m2, hitT: 0, alertT: 0, treeT: 0 });
    g.audio.play('whoosh', g.camera.position.distanceTo(p), 1.5);
  }
  blackhole(p: THREE.Vector3, life = 22) {
    const g = this.g;
    if (this.holes.length >= 4) this.remove(this.holes.shift()!.g);
    const grp = new THREE.Group(); grp.position.copy(p);
    const core = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: 0x000000 })); core.scale.setScalar(8); grp.add(core);
    const disk = holeDiskMat(12, 44);
    const d1 = new THREE.Mesh(new THREE.RingGeometry(12, 44, 64, 1), disk); d1.rotation.x = -Math.PI / 2 + 0.25; d1.renderOrder = 6;
    const d2 = new THREE.Mesh(new THREE.RingGeometry(12, 44, 64, 1), disk); d2.rotation.x = -0.6; d2.rotation.y = 0.8; d2.renderOrder = 6;
    const halo = new THREE.Mesh(this.sphere, fresnelMat(0xb070ff, 1.2)); halo.scale.setScalar(16); halo.renderOrder = 6;
    grp.add(d1, d2, halo); g.scene.add(grp);
    this.holes.push({ pos: p.clone(), life, age: 0, g: grp, core, disk, hitT: 0, craterT: 0, eaten: 0 });
    g.audio.play('blackhole', 0, 1.2); g.fx.flash(p, 0xb070ff, 15, 400);
  }
  tsunami(o: THREE.Vector3, dir: THREE.Vector3, W = 520, Hh = 60) {
    const g = this.g;
    if (this.tsunamis.length >= 3) { const t = this.tsunamis.shift()!; g.scene.remove(t.mesh); t.mesh.geometry.dispose(); }
    const d = dir.clone().setY(0).normalize(); if (d.lengthSq() < 0.1) d.set(0, 0, -1);
    const perp = new THREE.Vector3(-d.z, 0, d.x);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NL + 1) * NP * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < NL; i++) for (let j = 0; j < NP - 1; j++) { const a = i * NP + j, b = a + NP; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0f86b8, transparent: true, opacity: 0.88, roughness: 0.12, metalness: 0.2, emissive: 0x06405c, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    mesh.frustumCulled = false; mesh.renderOrder = 3; g.scene.add(mesh);
    this.tsunamis.push({ o: o.clone(), dir: d, perp, dist: 30, speed: 85, W, Hh, mesh, maxD: 1900, hitT: 0, fade: 1 });
    g.audio.play('rumble', 0, 1); g.audio.play('splash', 0, 1);
  }
  quake(p: THREE.Vector3, R = 280, life = 10) {
    const g = this.g;
    this.quakes.push({ pos: p.clone(), R, life, age: 0, hitT: 0, jolt: 0, fiss: [rand(0, 6.28), rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)], fissT: 0, snd: 0 });
    g.audio.play('rumble', 0, 1.3); g.ents.alert(p, R * 2.2, 'panic');
  }
  meteors(center: THREE.Vector3, count: number, radius: number, size = 2.2, delaySpread = 4) {
    for (let i = 0; i < count; i++) {
      const target = new THREE.Vector3(center.x + rand(-1, 1) * radius, 0, center.z + rand(-1, 1) * radius);
      target.y = this.ground(target.x, target.z);
      const s = size * rand(0.6, 1.5);
      this.pending.push({ t: rand(0, delaySpread), fn: () => this.rock(target, s) });
    }
    this.g.audio.play('meteor', 0, 1);
  }
  private rock(target: THREE.Vector3, size: number) {
    const g = this.g;
    const dir = V.set(rand(-0.5, 0.5), 1.7, rand(-0.5, 0.5)).normalize();
    const start = target.clone().addScaledVector(dir, 900);
    const mesh = makeRock(size); mesh.position.copy(start); mesh.castShadow = true; g.scene.add(mesh);
    this.rocks.push({ mesh, pos: start, vel: dir.clone().multiplyScalar(-290), grav: 0, size, R: 12 + size * 8, trail: 'meteor', pal: PAL.fire, force: 40 + size * 12, crater: 0.9 });
  }
  volcano(p: THREE.Vector3) {
    const g = this.g;
    const base = this.ground(p.x, p.z);
    g.city.damageSphere(V.set(p.x, base + 10, p.z), 130, 25, true);
    g.scatter.damageSphere(V.set(p.x, base, p.z), 150, true);
    g.terrain.raise(p.x, p.z, 170, 120, 1.25, col(0x2a221e), true);
    g.terrain.crater(p.x, p.z, 17, 36, true);
    g.terrain.paint(p.x, p.z, 26, col(0xff4a10), 0.9);
    const top = g.terrain.heightAt(p.x, p.z);
    g.ents.blast(V.set(p.x, base, p.z), 150, 40, 60); g.ents.alert(p, 900, 'panic');
    this.volcanoes.push({ pos: new THREE.Vector3(p.x, top, p.z), life: 55, age: 0, top, bombT: 0, flashT: 0 });
    g.shake(1.2); g.audio.play('boom', 0, 1); g.audio.play('rumble', 0, 1);
    g.fx.shockwave(V.set(p.x, base + 2, p.z), 200, 0xff8030, 1.4, true, false);
  }
  portal(p: THREE.Vector3, normal: THREE.Vector3): boolean {
    const g = this.g;
    const color = this.pendingPortal ? 0xff8a2a : 0x2ab0ff;
    const grp = new THREE.Group(); grp.position.copy(p);
    const disk = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, c: { value: col(color) } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uT; uniform vec3 c; varying vec2 vP; void main(){ float r=length(vP)/5.0; float a=atan(vP.y,vP.x); float s=sin(a*5.0+r*14.0-uT*6.0)*0.5+0.5; float s2=sin(a*3.0-r*9.0+uT*4.0)*0.5+0.5; gl_FragColor=vec4(mix(c,vec3(1.0),s*s2*0.6)*(0.5+0.8*s), (0.45+0.5*s)*(1.0-smoothstep(0.75,1.0,r))); }',
    });
    const dm = new THREE.Mesh(new THREE.CircleGeometry(5, 48), disk); dm.renderOrder = 6;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 12, 56), new THREE.MeshBasicMaterial({ color })); ring.renderOrder = 6;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.08, 8, 56), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }));
    grp.add(dm, ring, ring2);
    const n = normal.clone().setY(0).normalize(); if (n.lengthSq() < 0.1) n.set(0, 0, 1);
    grp.lookAt(p.clone().add(n)); grp.position.y += 5.2; g.scene.add(grp);
    const por: Portal = { pos: grp.position.clone(), normal: n, g: grp, disk, partner: null, life: 180, color };
    if (this.pendingPortal) { por.partner = this.pendingPortal; this.pendingPortal.partner = por; this.pendingPortal = null; g.toast('Portal pair linked — step through!', '#ff8a3d'); }
    else {
      while (this.portals.length >= 2) this.remove(this.portals.shift()!.g);
      this.pendingPortal = por; g.toast('Portal A placed — place the second gateway', '#2ab0ff');
    }
    this.portals.push(por);
    g.audio.play('portal', 0);
    g.fx.shockwave(por.pos, 14, color, 0.6, true, false);
    return !!por.partner;
  }
  zone(p: THREE.Vector3, kind: 'grav' | 'distort', R: number, life: number) {
    const g = this.g;
    const mat = kind === 'grav' ? fresnelMat(0x6a8aff, 0.9) : fresnelMat(0xffffff, 1.0, true);
    const mesh = new THREE.Mesh(this.sphere, mat); mesh.position.copy(p); mesh.scale.setScalar(R); mesh.renderOrder = 6; g.scene.add(mesh);
    this.zones.push({ pos: p.clone(), R, life, age: 0, mesh, mat, kind, hitT: 0 });
    g.audio.play(kind === 'grav' ? 'portal' : 'blackhole', 0, 0.8);
    g.fx.shockwave(p, R * 1.2, kind === 'grav' ? 0x8aa0ff : 0xff80e0, 0.8, true, true);
  }
  wave(c: THREE.Vector3, maxR: number, speed: number, force: number, destroyH: number, rupture = false, p = PAL.fire) {
    const g = this.g;
    const mat = new THREE.MeshBasicMaterial({ color: p.a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(RING, mat); mesh.position.set(c.x, Math.max(this.ground(c.x, c.z), 0) + 1.5, c.z); mesh.scale.setScalar(1); mesh.frustumCulled = false; mesh.renderOrder = 6; g.scene.add(mesh);
    this.waves.push({ c: c.clone(), r: 0, speed, maxR, force, destroyH, rupture, mesh, mat, fxT: 0, pal: p });
  }
  sword(target: THREE.Vector3, p = PAL.gold) {
    for (let i = 0; i < 18; i++) {
      const t = new THREE.Vector3(target.x + rand(-1, 1) * 38, 0, target.z + rand(-1, 1) * 38); t.y = this.ground(t.x, t.z);
      const o = makeSword(); o.position.set(t.x, t.y + 160 + rand(0, 120), t.z); o.scale.setScalar(1.6); this.g.scene.add(o);
      this.projs.push({ kind: 'sword', obj: o, pos: o.position, vel: new THREE.Vector3(rand(-3, 3), -190, rand(-3, 3)), target: t, life: 12, delay: i * 0.09 + rand(0, 0.15), stuck: 0, pal: p, age: 0, R: 11 });
      o.visible = false;
    }
    this.g.audio.play('whoosh', 0, 1);
  }
  spears(from: THREE.Vector3, target: THREE.Vector3, p = PAL.cyan) {
    for (let i = 0; i < 9; i++) {
      const o = makeSpear(); o.position.copy(from).add(V.set(rand(-3, 3), rand(0, 3), rand(-3, 3))); o.scale.setScalar(1.4); this.g.scene.add(o);
      const t = target.clone().add(V2.set(rand(-9, 9), 0, rand(-9, 9)));
      const v = t.clone().sub(o.position).normalize().multiplyScalar(210);
      this.projs.push({ kind: 'spear', obj: o, pos: o.position, vel: v, target: t, life: 8, delay: i * 0.07, stuck: 0, pal: p, age: 0, R: 9 }); o.visible = false;
    }
    this.g.audio.play('whoosh', 0, 1);
  }
  missiles(from: THREE.Vector3, target: THREE.Vector3, p = PAL.fire) {
    for (let i = 0; i < 10; i++) {
      const o = makeMissile(); o.position.copy(from).add(V.set(rand(-1.5, 1.5), 0.5, rand(-1.5, 1.5))); o.scale.setScalar(1.3); this.g.scene.add(o);
      const t = target.clone().add(V2.set(rand(-10, 10), 0, rand(-10, 10)));
      this.projs.push({ kind: 'missile', obj: o, pos: o.position, vel: new THREE.Vector3(rand(-18, 18), rand(35, 55), rand(-18, 18)), target: t, life: 10, delay: i * 0.1, stuck: 0, pal: p, age: 0, R: 17 }); o.visible = false;
    }
    this.g.audio.play('whoosh', 0, 1);
  }
  hammer(target: THREE.Vector3, p = PAL.white) {
    const o = makeHammer(); o.rotation.x = Math.PI; o.position.set(target.x, target.y + 360, target.z); o.scale.setScalar(1.4); this.g.scene.add(o);
    this.projs.push({ kind: 'hammer', obj: o, pos: o.position, vel: new THREE.Vector3(0, -230, 0), target: target.clone(), life: 10, delay: 0, stuck: 0, pal: p, age: 0, R: 62 });
    this.g.audio.play('whoosh', 0, 1.3);
  }
  rupture(c: THREE.Vector3) {
    const g = this.g;
    this.wave(c, 2600, 420, 90, 400, true, PAL.lava);
    g.shake(2); g.sky.flash(1); g.audio.play('boom', 0, 1.3); g.audio.play('rumble', 0, 1.2);
    g.fx.explosion(c.clone(), 90, PAL.lava);
    g.ents.alert(c, 3000, 'panic'); g.sky.apocalypse = 1;
  }
  apocalypse(c: THREE.Vector3) {
    const g = this.g;
    g.sky.setWeather('storm'); g.sky.intensity = 1.5; g.hud.set({ weather: 'storm' });
    this.meteors(c, 26, 520, 3, 14);
    this.quake(c, 450, 14);
    for (let i = 0; i < 4; i++) this.pending.push({ t: i * 2.5, fn: () => this.tornado(V3.set(c.x + rand(-300, 300), 0, c.z + rand(-300, 300)), 30, 55) });
    const d = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
    this.pending.push({ t: 5, fn: () => this.tsunami(V3.copy(c).addScaledVector(d, 700), d.clone().negate(), 900, 70) });
    g.sky.apocalypse = 0.8;
  }

  remove(grp: THREE.Object3D) { this.g.scene.remove(grp); grp.traverse((o: any) => { if (o.isMesh && o.material?.dispose && !(o.material as any).isShared) { /* shared geometry kept */ } }); }

  // ---------------- update ----------------
  update(dt: number, rdt: number) {
    const g = this.g, ents = g.ents, deb = g.debris, city = g.city, T = g.terrain;
    const camP = g.camera.position, t = g.clock;
    this.frame++;
    // portals work in real time for player
    for (const p of this.portals) {
      p.disk.uniforms.uT.value += rdt; p.life -= rdt;
      p.g.children[1].rotation.z += rdt * 0.8;
      if (Math.random() < 0.7) { const a = rand(0, 6.28), r = 5.2; V.set(Math.cos(a) * r, Math.sin(a) * r, 0).applyQuaternion(p.g.quaternion); g.fx.add.emit(p.pos.x + V.x, p.pos.y + V.y, p.pos.z + V.z, -V.x * 0.4, -V.y * 0.4, -V.z * 0.4, 0.8, 0.5, 0.05, col(p.color), WHITE, 1, 0, 0); }
      if (p.partner) this.portalTraffic(p, rdt, dt);
      if (p.life <= 0) { this.remove(p.g); p.partner && (p.partner.partner = null); this.portals.splice(this.portals.indexOf(p), 1); if (this.pendingPortal === p) this.pendingPortal = null; }
    }
    // pending spawns
    for (let i = this.pending.length - 1; i >= 0; i--) { const q = this.pending[i]; q.t -= dt; if (q.t <= 0) { this.pending.splice(i, 1); q.fn(); } }
    if (dt <= 0) return;
    // reset per-frame forces
    for (const e of ents.list) { if (e.gravMul !== 1 && !e.held) e.gravMul = 1; }
    for (const d of deb.list) if (d.alive && d.gm !== 1) d.gm = 1;

    // ---- tornadoes ----
    for (let i = this.tornadoes.length - 1; i >= 0; i--) {
      const tn = this.tornadoes[i]; tn.age += dt; tn.life -= dt;
      const op = Math.min(1, tn.age / 2.5, tn.life / 3);
      tn.m1.uniforms.uT.value = t; tn.m2.uniforms.uT.value = t; tn.m1.uniforms.uOp.value = op; tn.m2.uniforms.uOp.value = op;
      if (tn.life <= 0) { this.remove(tn.g); this.tornadoes.splice(i, 1); continue; }
      tn.dir += rand(-1, 1) * dt * 0.9;
      tn.pos.x += Math.sin(tn.dir) * 15 * dt; tn.pos.z += Math.cos(tn.dir) * 15 * dt;
      tn.pos.y = this.ground(tn.pos.x, tn.pos.z); tn.g.position.copy(tn.pos);
      for (let k = 0; k < 5; k++) { const a = rand(0, 6.28), r = rand(4, tn.R * 0.55); g.fx.norm.emit(tn.pos.x + Math.cos(a) * r, tn.pos.y + 1, tn.pos.z + Math.sin(a) * r, -Math.sin(a) * rand(14, 26), rand(10, 26), Math.cos(a) * rand(14, 26), rand(1.5, 3), 5, 15, DUST_A, DUST_B, 0.6, 0, 0.3); }
      const INF = 95;
      for (const e of ents.list) {
        if (e.gone || e.held) continue;
        const dx = tn.pos.x - e.obj.position.x, dz = tn.pos.z - e.obj.position.z, dist = Math.hypot(dx, dz);
        if (dist > INF || e.obj.position.y > tn.pos.y + tn.H) continue;
        const pull = 1 - dist / INF, m = 1 / Math.sqrt(e.mass);
        const nx = dx / (dist + 0.01), nz = dz / (dist + 0.01);
        V.set((nx * 30 + -nz * 45) * pull * m * dt, 42 * pull * m * dt, (nz * 30 + nx * 45) * pull * m * dt);
        ents.push(e, V); e.vel.multiplyScalar(1 - 0.25 * dt);
        if (e.alive && e.kind !== 'vehicle') ents.damage(e, 5 * pull * dt);
      }
      for (const d of deb.list) {
        if (!d.alive) continue;
        const dx = tn.pos.x - d.x, dz = tn.pos.z - d.z, dist = Math.hypot(dx, dz);
        if (dist > INF) continue; const pull = 1 - dist / INF; d.rest = false;
        d.vx += ((dx / (dist + 0.01)) * 30 - (dz / (dist + 0.01)) * 50) * pull * dt; d.vz += ((dz / (dist + 0.01)) * 30 + (dx / (dist + 0.01)) * 50) * pull * dt; d.vy += 45 * pull * dt;
      }
      tn.hitT -= dt; tn.treeT -= dt; tn.alertT -= dt;
      if (tn.hitT < 0) { tn.hitT = 0.28; city.damageSphere(V.set(tn.pos.x + rand(-1, 1) * 18, tn.pos.y + rand(2, 50), tn.pos.z + rand(-1, 1) * 18), 15, 8, true); }
      if (tn.treeT < 0) { tn.treeT = 0.25; g.scatter.damageSphere(V.set(tn.pos.x, tn.pos.y + 2, tn.pos.z), 36); }
      if (tn.alertT < 0) { tn.alertT = 1; ents.alert(tn.pos, 280, 'panic'); const dd = camP.distanceTo(tn.pos); if (dd < 300) g.shake(0.18 * (1 - dd / 300)); }
    }

    // ---- black holes ----
    for (let i = this.holes.length - 1; i >= 0; i--) {
      const h = this.holes[i]; h.age += dt; h.life -= dt;
      h.disk.uniforms.uT.value = t; h.g.rotation.y += dt * 0.5;
      const rh = 8 + h.age * 0.12; h.core.scale.setScalar(rh);
      const op = Math.min(1, h.life / 2); h.disk.uniforms.uOp.value = op;
      if (h.life <= 0) { this.collapseHole(h); this.holes.splice(i, 1); continue; }
      const INF = 230;
      for (const e of ents.list) {
        if (e.gone || e.held) continue;
        V.copy(h.pos).sub(e.obj.position); const d = V.length();
        if (d > INF) continue;
        if (d < rh * 1.3) { if (e.alive || e.kind === 'vehicle') { e.alive = false; } e.gone = true; e.obj.visible = false; h.eaten++; g.logUndo(() => { e.gone = false; e.alive = true; e.obj.visible = true; e.airborne = false; }); g.fx.add.emit(h.pos.x, h.pos.y, h.pos.z, rand(-6, 6), rand(-6, 6), rand(-6, 6), 0.6, 3, 0.2, WHITE, col(0xb060ff), 1, 0, 0); continue; }
        const f = Math.pow(1 - d / INF, 1.2) * 110 + (d < 70 ? 160 : 0); V.normalize();
        V2.set(-V.z, 0, V.x).multiplyScalar(f * 0.45);
        ents.push(e, V3.copy(V).multiplyScalar(f * dt / Math.sqrt(e.mass)).add(V2.multiplyScalar(dt)));
        e.gravMul = 0.1;
      }
      for (const d of deb.list) {
        if (!d.alive) continue;
        V.set(h.pos.x - d.x, h.pos.y - d.y, h.pos.z - d.z); const dist = V.length();
        if (dist > INF) continue;
        if (dist < rh * 1.3) { deb.kill(d); continue; }
        d.rest = false; d.gm = 0.1; const f = (Math.pow(1 - dist / INF, 1.2) * 120 + (dist < 70 ? 160 : 0)) * dt; V.normalize();
        d.vx += V.x * f - V.z * f * 0.4; d.vy += V.y * f; d.vz += V.z * f + V.x * f * 0.4;
      }
      h.hitT -= dt; h.craterT -= dt;
      if (h.hitT < 0) { h.hitT = 0.12; city.damageSphere(h.pos, Math.min(26 + h.age * 2.8, 80), 0, true); g.scatter.damageSphere(h.pos, 40 + h.age * 4); }
      if (h.craterT < 0) { h.craterT = 0.8; if (h.pos.y - T.heightAt(h.pos.x, h.pos.z) < 90) T.crater(h.pos.x, h.pos.z, 30 + h.age, 2.5, true); ents.alert(h.pos, 320, 'panic'); }
      const dd = camP.distanceTo(h.pos); if (dd < 500) g.shake(0.35 * (1 - dd / 500));
      for (let k = 0; k < 4; k++) { const a = rand(0, 6.28), r = rand(30, 55); g.fx.add.emit(h.pos.x + Math.cos(a) * r, h.pos.y + rand(-3, 3), h.pos.z + Math.sin(a) * r, -Math.sin(a) * 30 - Math.cos(a) * 10, rand(-2, 2), Math.cos(a) * 30 - Math.sin(a) * 10, rand(0.8, 1.4), 1.8, 0.2, col(0xfff0d0), col(0xff5010), 1, 0, 0); }
    }

    // ---- tsunamis ----
    for (let i = this.tsunamis.length - 1; i >= 0; i--) {
      const w = this.tsunamis[i];
      w.dist += w.speed * dt;
      const fadeIn = Math.min(1, w.dist / 150), remaining = (w.maxD - w.dist) / 200;
      if (remaining < 1) w.fade = Math.max(0, remaining);
      if (w.dist > w.maxD) { g.scene.remove(w.mesh); w.mesh.geometry.dispose(); this.tsunamis.splice(i, 1); continue; }
      const pos = w.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const front = V.copy(w.o).addScaledVector(w.dir, w.dist);
      const FS = 110;
      for (let a = 0; a <= NL; a++) {
        const lat = (a / NL - 0.5) * w.W, edge = Math.sin((a / NL) * Math.PI);
        const hv = w.Hh * fadeIn * w.fade * (0.65 + 0.35 * Math.sin(lat * 0.035 + t * 0.7)) * Math.pow(edge, 0.4);
        for (let j = 0; j < NP; j++) {
          const f = PROFILE[j][0] * FS, x = front.x + w.perp.x * lat + w.dir.x * f, z = front.z + w.perp.z * lat + w.dir.z * f;
          const base = this.ground(x, z);
          pos.setXYZ(a * NP + j, x, base - 0.5 + PROFILE[j][1] * hv + (PROFILE[j][1] > 0 ? Math.sin(t * 5 + lat * 0.2 + j) * 0.7 : 0), z);
        }
      }
      pos.needsUpdate = true; w.mesh.geometry.computeVertexNormals();
      (w.mesh.material as THREE.MeshStandardMaterial).opacity = 0.88 * Math.min(1, w.fade * 1.5 + 0.1);
      for (let k = 0; k < 14; k++) { const lat = rand(-0.5, 0.5) * w.W; const x = front.x + w.perp.x * lat, z = front.z + w.perp.z * lat; g.fx.norm.emit(x, this.ground(x, z) + w.Hh * w.fade * rand(0.5, 1), z, w.dir.x * rand(20, 50), rand(4, 18), w.dir.z * rand(20, 50), rand(0.8, 1.8), 4, 10, FOAM, FOAM, 0.55, 0, 0.5, 6); }
      const dirv = w.dir;
      for (const e of ents.list) {
        if (e.gone || e.held) continue;
        V2.copy(e.obj.position).sub(front); const fw = V2.dot(dirv), lat = V2.dot(w.perp);
        if (Math.abs(lat) > w.W / 2 || fw < -100 || fw > 22) continue;
        const base = this.ground(e.obj.position.x, e.obj.position.z);
        if (e.obj.position.y > base + w.Hh * w.fade * 0.95 + 2) continue;
        ents.push(e, V3.set(0, 0.2, 0));
        const k = Math.min(1, dt * 3); e.vel.x += (dirv.x * w.speed * 0.95 - e.vel.x) * k; e.vel.z += (dirv.z * w.speed * 0.95 - e.vel.z) * k; e.vel.y += 24 * dt;
        if (e.alive && e.kind !== 'vehicle' && e.type !== 'whale') ents.damage(e, 28 * dt);
      }
      for (const d of deb.list) {
        if (!d.alive) continue; V2.set(d.x - front.x, 0, d.z - front.z); const fw = V2.dot(dirv), lat = V2.dot(w.perp);
        if (Math.abs(lat) > w.W / 2 || fw < -100 || fw > 22) continue; d.rest = false; d.vx += (dirv.x * w.speed - d.vx) * dt * 3; d.vz += (dirv.z * w.speed - d.vz) * dt * 3; d.vy += 10 * dt;
      }
      w.hitT -= dt;
      if (w.hitT < 0) {
        w.hitT = 0.14;
        for (let s = -w.W / 2; s <= w.W / 2; s += 30) {
          const x = front.x + w.perp.x * s + dirv.x * rand(-35, 4), z = front.z + w.perp.z * s + dirv.z * rand(-35, 4);
          const base = this.ground(x, z), hh = w.Hh * w.fade * 0.7;
          if (base > 0.3 || true) { city.damageSphere(V3.set(x, base + rand(3, hh), z), 15, 22, true); }
        }
        g.scatter.damageSphere(V3.set(front.x, this.ground(front.x, front.z) + 5, front.z), w.W * 0.6, false);
      }
      ents.alert(front, 400, 'panic');
      const dd = camP.distanceTo(front); if (dd < 400) g.shake(0.3 * (1 - dd / 400));
    }

    // ---- quakes ----
    for (let i = this.quakes.length - 1; i >= 0; i--) {
      const q = this.quakes[i]; q.age += dt; q.life -= dt;
      if (q.life <= 0) { this.quakes.splice(i, 1); continue; }
      const dd = camP.distanceTo(q.pos), amt = 0.9 * (1 - clamp(dd / (q.R * 2.2), 0, 1)) * Math.min(1, q.life / 2);
      if (amt > 0) g.shake(amt);
      q.snd -= dt; if (q.snd < 0) { q.snd = 3; g.audio.play('rumble', dd, 0.8); }
      q.fissT -= dt;
      if (q.age < 4 && q.fissT < 0) {
        q.fissT = 0.12; const prog = q.age / 4;
        for (const a of q.fiss) { for (let k = 0; k < 2; k++) { const r = prog * q.R * 0.95 - k * 6; if (r <= 0) continue; const x = q.pos.x + Math.cos(a) * r + rand(-3, 3), z = q.pos.z + Math.sin(a) * r + rand(-3, 3); if (T.heightAt(x, z) > 0.5) { T.crater(x, z, 6, 7, true); g.fx.puff(V.set(x, T.heightAt(x, z) + 1, z), 4, undefined, 3); } } }
      }
      q.hitT -= dt;
      if (q.hitT < 0) {
        q.hitT = 0.09;
        for (let k = 0; k < 2; k++) { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * q.R, x = q.pos.x + Math.cos(a) * r, z = q.pos.z + Math.sin(a) * r; city.damageSphere(V.set(x, T.heightAt(x, z) + rand(0, 5), z), rand(5, 10), 3, true); if (Math.random() < 0.3) g.scatter.damageSphere(V.set(x, T.heightAt(x, z), z), 14); }
        if (Math.random() < 0.6) { const a = rand(0, 6.28), r = rand(0, q.R); g.fx.puff(V.set(q.pos.x + Math.cos(a) * r, T.heightAt(q.pos.x + Math.cos(a) * r, q.pos.z + Math.sin(a) * r) + 1, q.pos.z + Math.sin(a) * r), 6, undefined, 2); }
      }
      q.jolt -= dt;
      if (q.jolt < 0) {
        q.jolt = 0.45;
        for (const e of ents.list) {
          if (e.gone || e.airborne || e.held || e.mode === 'orbit' || e.type === 'whale' || e.mode === 'swim') continue;
          if (Math.hypot(e.obj.position.x - q.pos.x, e.obj.position.z - q.pos.z) < q.R * 1.2 && Math.random() < 0.6) ents.launch(e, V.set(rand(-2, 2), rand(3, 9), rand(-2, 2)));
        }
      }
      ents.alert(q.pos, q.R * 2.2, 'panic');
    }

    // ---- rocks (meteors / lava bombs) ----
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.vel.y -= r.grav * dt; r.pos.addScaledVector(r.vel, dt); r.mesh.position.copy(r.pos); r.mesh.rotation.x += dt * 2; r.mesh.rotation.z += dt * 1.3;
      const sp = r.vel.length();
      for (let k = 0; k < 3; k++) g.fx.add.emit(r.pos.x - r.vel.x * dt * rand(0, 1.2), r.pos.y - r.vel.y * dt * rand(0, 1.2), r.pos.z - r.vel.z * dt * rand(0, 1.2), rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(0.5, 1), r.size * (r.trail === 'meteor' ? 2.4 : 1.6), 0.2, col(0xffe8a0), col(0xff4000), 1, 0, 0.2);
      if (Math.random() < 0.6) g.fx.norm.emit(r.pos.x, r.pos.y, r.pos.z, 0, 0, 0, rand(1.5, 3), r.size * 1.5, r.size * 4, col(0x4a4038), col(0x2a2622), 0.5, 0, 0.1);
      const gh = Math.max(T.heightAt(r.pos.x, r.pos.z), g.ocean.level);
      if (r.pos.y <= gh + 0.5 || (r.pos.y < 400 && city.pointInside(r.pos.x, r.pos.y, r.pos.z))) {
        g.scene.remove(r.mesh); this.rocks.splice(i, 1);
        g.explode(V.copy(r.pos), r.R, { force: r.force, crater: r.crater, pal: r.pal, fire: true, sound: true });
        continue;
      }
      void sp;
    }

    // ---- volcanoes ----
    for (let i = this.volcanoes.length - 1; i >= 0; i--) {
      const v = this.volcanoes[i]; v.age += dt; v.life -= dt;
      if (v.life <= 0) { this.volcanoes.splice(i, 1); continue; }
      const k = Math.min(1, v.life / 8);
      for (let n = 0; n < 7 * k; n++) g.fx.add.emit(v.pos.x + rand(-5, 5), v.top + 2, v.pos.z + rand(-5, 5), rand(-18, 18), rand(55, 110), rand(-18, 18), rand(1.5, 2.8), rand(5, 9), 1, col(0xfff0a0), col(0xff2a00), 1, 0, 0.1, 32);
      for (let n = 0; n < 3 * k; n++) g.fx.norm.emit(v.pos.x + rand(-6, 6), v.top + 8, v.pos.z + rand(-6, 6), rand(-6, 6), rand(25, 60), rand(-6, 6), rand(4, 8), 14, 55, col(0x1e1a18), col(0x504a46), 0.85, 0, 0.3, -3);
      v.flashT -= dt; if (v.flashT < 0) { v.flashT = 0.35; g.fx.flash(V.set(v.pos.x, v.top + 20, v.pos.z), 0xff6a20, 25 * k, 500); }
      v.bombT -= dt;
      if (v.bombT < 0 && k > 0.2) {
        v.bombT = rand(0.5, 1.1); const a = rand(0, 6.28), d = rand(120, 480);
        const tx = v.pos.x + Math.cos(a) * d, tz = v.pos.z + Math.sin(a) * d;
        const flight = rand(4.5, 7), gr = 34;
        const vx = (tx - v.pos.x) / flight, vz = (tz - v.pos.z) / flight, vy = (this.ground(tx, tz) - v.top - 0.5 * -gr * flight * flight) / flight;
        const mesh = makeRock(rand(1.4, 2.6), 0x3a2a22); mesh.position.set(v.pos.x, v.top + 5, v.pos.z); g.scene.add(mesh);
        this.rocks.push({ mesh, pos: mesh.position.clone(), vel: new THREE.Vector3(vx, vy, vz), grav: gr, size: 1.8, R: 16, trail: 'lava', pal: PAL.lava, force: 30, crater: 0.5 });
      }
      ents.alert(v.pos, 700, 'panic');
      const dd = camP.distanceTo(v.pos); if (dd < 800) g.shake(0.25 * (1 - dd / 800));
    }

    // ---- zones ----
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]; z.age += dt; z.life -= dt;
      z.mat.uniforms.t.value = t; z.mat.uniforms.op.value = Math.min(1, z.age * 2, z.life);
      if (z.life <= 0) { g.scene.remove(z.mesh); this.zones.splice(i, 1); continue; }
      const grav = z.kind === 'grav';
      for (const e of ents.list) {
        if (e.gone || e.held) continue;
        const d = e.obj.position.distanceTo(z.pos); if (d > z.R) continue;
        ents.push(e, V.set(0, 0.5, 0));
        e.gravMul = grav ? -0.12 : -0.3; e.vel.multiplyScalar(1 - 0.7 * dt);
        if (!grav) { e.d.dz = this.frame; const s = 1 + 0.95 * Math.sin(t * 2.5 + e.id); e.obj.scale.setScalar(clamp(s, 0.35, 2.4)); e.ang.set(1.5, 2, 1.5); }
        else e.ang.multiplyScalar(0.99);
      }
      for (const d of deb.list) {
        if (!d.alive) continue; V.set(d.x - z.pos.x, d.y - z.pos.y, d.z - z.pos.z); if (V.length() > z.R) continue;
        d.rest = false; d.gm = grav ? -0.1 : -0.35; d.vx *= 1 - 0.5 * dt; d.vz *= 1 - 0.5 * dt; d.vy *= 1 - 0.3 * dt; d.vy += (grav ? 1.5 : 0) * dt; if (!grav) { d.ax += rand(-1, 1); d.ay += rand(-1, 1); }
      }
      z.hitT -= dt;
      if (z.hitT < 0) {
        z.hitT = grav ? 0.4 : 0.55;
        const a = rand(0, 6.28), r = rand(0, z.R * 0.9); const x = z.pos.x + Math.cos(a) * r, zz = z.pos.z + Math.sin(a) * r;
        const y = Math.max(T.heightAt(x, zz), z.pos.y - z.R * 0.5) + rand(0, z.R * 0.5);
        city.damageSphere(V.set(x, y, zz), grav ? 6 : 5, 0, true);
        if (grav) g.scatter.damageSphere(V.set(x, T.heightAt(x, zz), zz), 8);
      }
      for (let k = 0; k < 3; k++) { const a = rand(0, 6.28), r = rand(0, z.R); g.fx.add.emit(z.pos.x + Math.cos(a) * r, z.pos.y + rand(-1, 1) * z.R * 0.7, z.pos.z + Math.sin(a) * r, 0, grav ? 2 : 0, 0, rand(1, 2), 1.2, 0.1, grav ? col(0xaac0ff) : new THREE.Color().setHSL(Math.random(), 1, 0.7), grav ? col(0x4a60ff) : col(0xffffff), 1, 0, 0); }
    }
    for (const e of ents.list) if (e.d.dz && e.d.dz !== this.frame) { e.obj.scale.setScalar(1); e.d.dz = 0; }

    // ---- waves ----
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i], r0 = w.r; w.r += w.speed * dt;
      w.mesh.scale.setScalar(Math.max(1, w.r)); w.mat.opacity = 0.85 * (1 - w.r / w.maxR * 0.8);
      w.mesh.position.y = Math.max(this.ground(w.c.x + w.r, w.c.z), 0) + 1.5;
      if (w.r >= w.maxR) { g.scene.remove(w.mesh); w.mat.dispose(); this.waves.splice(i, 1); continue; }
      city.damageBand(w.c.x, w.c.z, r0 - 6, w.r + 2, w.destroyH, w.force * 0.4);
      g.scatter.damageBand(w.c.x, w.c.z, r0 - 4, w.r + 2);
      for (const e of ents.list) {
        if (e.gone || e.held) continue;
        const d = Math.hypot(e.obj.position.x - w.c.x, e.obj.position.z - w.c.z);
        if (d < r0 - 8 || d > w.r + 8) continue;
        V.set(e.obj.position.x - w.c.x, 0, e.obj.position.z - w.c.z).normalize().multiplyScalar(w.force / Math.sqrt(e.mass)); V.y = w.force * 0.35 / Math.sqrt(e.mass);
        ents.launch(e, V); ents.damage(e, w.force * 0.7 / Math.sqrt(e.mass), w.c);
      }
      for (const d of deb.list) { if (!d.alive) continue; const dist = Math.hypot(d.x - w.c.x, d.z - w.c.z); if (dist < r0 - 8 || dist > w.r + 8) continue; d.rest = false; V.set(d.x - w.c.x, 0, d.z - w.c.z).normalize(); d.vx += V.x * w.force * 0.6; d.vz += V.z * w.force * 0.6; d.vy += w.force * 0.4; }
      if (w.rupture) {
        for (let k = 0; k < 3; k++) { const a = rand(0, 6.28), x = w.c.x + Math.cos(a) * w.r, z = w.c.z + Math.sin(a) * w.r; if (T.heightAt(x, z) > -3) T.crater(x, z, rand(8, 16), rand(6, 12), true); }
        w.fxT -= dt;
        for (let k = 0; k < 6; k++) { const a = rand(0, 6.28), x = w.c.x + Math.cos(a) * w.r, z = w.c.z + Math.sin(a) * w.r, y = this.ground(x, z); g.fx.add.emit(x, y + 2, z, Math.cos(a) * 20, rand(20, 60), Math.sin(a) * 20, rand(1, 2), rand(14, 26), 2, col(0xffe090), col(0xff3000), 1, 0, 0.3, 10); g.fx.norm.emit(x, y + 4, z, 0, rand(20, 40), 0, rand(3, 6), 20, 70, col(0x201c1a), col(0x504a46), 0.8, 0, 0.2); }
        if (w.fxT < 0) { w.fxT = 0.25; const a = rand(0, 6.28); g.explode(V.set(w.c.x + Math.cos(a) * w.r, this.ground(w.c.x + Math.cos(a) * w.r, w.c.z + Math.sin(a) * w.r) + 5, w.c.z + Math.sin(a) * w.r), 30, { force: 0, crater: 0, pal: PAL.lava, silent: true }); }
        g.shake(0.6);
      } else for (let k = 0; k < 10; k++) { const a = rand(0, 6.28), x = w.c.x + Math.cos(a) * w.r, z = w.c.z + Math.sin(a) * w.r; g.fx.norm.emit(x, this.ground(x, z) + 1, z, Math.cos(a) * 12, rand(2, 8), Math.sin(a) * 12, rand(1, 2), 4, 12, DUST_A, DUST_B, 0.5, 0, 0.4); }
    }
    if (g.sky.apocalypse > 0 && this.waves.every(w => !w.rupture) && this.quakes.length === 0 && this.volcanoes.length === 0) g.sky.apocalypse = Math.max(0, g.sky.apocalypse - dt * 0.008);

    // ---- projectiles ----
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      if (p.stuck > 0) { p.stuck -= dt; if (p.stuck <= 0) { g.scene.remove(p.obj); this.projs.splice(i, 1); } else if (p.stuck < 1) p.obj.scale.multiplyScalar(0.96); continue; }
      if (p.delay > 0) { p.delay -= dt; if (p.delay <= 0) p.obj.visible = true; else continue; }
      p.age += dt; p.life -= dt;
      if (p.kind === 'missile') {
        if (p.age > 0.55) { V.copy(p.target).sub(p.pos).normalize().multiplyScalar(135); p.vel.lerp(V, 1 - Math.exp(-dt * 4)); } else p.vel.multiplyScalar(1 - dt * 0.5);
        g.fx.add.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.4, 2.4, 0.2, col(0xffe090), col(0xff4000), 1, 0, 0); g.fx.norm.emit(p.pos.x, p.pos.y, p.pos.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(1, 2), 1.6, 5, col(0x888888), col(0x444444), 0.5, 0, 0.1);
      }
      if (p.kind === 'sword' || p.kind === 'hammer') g.fx.add.emit(p.pos.x, p.pos.y + (p.kind === 'sword' ? 6 : 20), p.pos.z, 0, 0, 0, 0.5, p.kind === 'sword' ? 2.5 : 9, 0.2, p.pal.a, p.pal.b, 0.8, 0, 0);
      if (p.kind === 'spear') g.fx.add.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.4, 1.8, 0.1, p.pal.a, p.pal.b, 0.9, 0, 0);
      p.pos.addScaledVector(p.vel, dt); p.obj.position.copy(p.pos);
      if (p.kind === 'spear' || p.kind === 'missile') { V.copy(p.pos).add(p.vel); p.obj.lookAt(V); }
      const gh = Math.max(T.heightAt(p.pos.x, p.pos.z), g.ocean.level);
      const bottom = p.kind === 'sword' ? p.pos.y - 14 : p.kind === 'hammer' ? p.pos.y - 40 : p.pos.y;
      if (bottom <= gh || (p.pos.y < 500 && p.kind !== 'sword' && p.kind !== 'hammer' && city.pointInside(p.pos.x, p.pos.y, p.pos.z, 0.5)) || (p.kind === 'sword' && city.pointInside(p.pos.x, p.pos.y - 10, p.pos.z, 0.5)) || p.life <= 0) {
        const at = V3.copy(p.pos); if (p.kind === 'sword') at.y = Math.max(gh, p.pos.y - 12); if (p.kind === 'hammer') at.y = gh + 2;
        g.explode(at, p.R, { force: p.kind === 'hammer' ? 80 : 40, crater: p.kind === 'hammer' ? 1 : 0.4, pal: p.pal, fire: p.kind === 'missile', sound: true });
        if (p.kind === 'sword' || p.kind === 'hammer') { p.stuck = p.kind === 'hammer' ? 6 : 8; p.vel.set(0, 0, 0); p.obj.position.y = gh - (p.kind === 'sword' ? 3 : 8); if (p.kind === 'hammer') g.shake(1); }
        else { g.scene.remove(p.obj); this.projs.splice(i, 1); }
      }
    }
  }

  private portalTraffic(p: Portal, _rdt: number, dt: number) {
    const g = this.g, o = p.partner!;
    const exitPos = (out: THREE.Vector3) => out.copy(o.pos).addScaledVector(o.normal, 7);
    const pl = g.player;
    const dpl = pl.pos.clone().setY(pl.pos.y + 1).distanceTo(p.pos);
    if (dpl < 5.2 && g.clock - g.portalCd > 1.5) {
      g.portalCd = g.clock; exitPos(pl.pos); pl.pos.y -= 3; pl.vel.copy(o.normal).multiplyScalar(Math.max(20, pl.vel.length() * 0.6));
      g.audio.play('teleport', 0); g.fx.shockwave(pl.pos, 14, o.color, 0.5, true, false); g.toast('Dimensional crossing', '#ff8a3d');
    }
    if (dt <= 0) return;
    for (const e of g.ents.list) {
      if (e.gone || e.held || e.portalCd > 0) continue;
      if (e.obj.position.distanceTo(p.pos) < 5.4) {
        exitPos(e.obj.position); e.obj.position.y -= 4; e.portalCd = 2.5; o.disk && 0;
        const sp = Math.max(8, e.vel.length()); g.ents.launch(e, V.copy(o.normal).multiplyScalar(sp)); e.vel.copy(o.normal).multiplyScalar(sp);
        g.fx.shockwave(e.obj.position, 6, o.color, 0.4, true, false);
      }
    }
  }
  private collapseHole(h: Hole) {
    const g = this.g;
    this.remove(h.g);
    g.explode(h.pos.clone(), 110, { force: 70, crater: 0.5, pal: PAL.purple, sound: true });
    g.fx.shockwave(h.pos, 320, 0xc090ff, 1.2, true, true);
    g.fx.flash(h.pos, 0xe0c0ff, 30, 700); g.shake(1);
  }
  clear() {
    for (const t of this.tornadoes) this.remove(t.g); for (const h of this.holes) this.remove(h.g);
    for (const w of this.tsunamis) { this.g.scene.remove(w.mesh); w.mesh.geometry.dispose(); }
    for (const r of this.rocks) this.g.scene.remove(r.mesh); for (const p of this.portals) this.remove(p.g);
    for (const z of this.zones) this.g.scene.remove(z.mesh); for (const w of this.waves) this.g.scene.remove(w.mesh); for (const p of this.projs) this.g.scene.remove(p.obj);
    this.tornadoes = []; this.holes = []; this.tsunamis = []; this.quakes = []; this.rocks = []; this.volcanoes = []; this.portals = []; this.zones = []; this.waves = []; this.projs = []; this.pending = []; this.pendingPortal = null;
  }
  smooth() { return smoothstep; }
}
