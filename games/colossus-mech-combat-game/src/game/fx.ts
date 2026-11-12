// Pooled visual effects: instanced particles, debris, rings, beams, slashes, telegraphs, decals, flash lights
import * as THREE from 'three';

const _c = new THREE.Color(); const _v = new THREE.Vector3(); const _q = new THREE.Quaternion(); const UP = new THREE.Vector3(0, 1, 0);
export const col = (c: string | number | THREE.Color) => _c.set(c as any);

class PPool {
  n = 0; cap: number; mesh: THREE.InstancedMesh; px: Float32Array; py: Float32Array; pz: Float32Array; vx: Float32Array; vy: Float32Array; vz: Float32Array;
  life: Float32Array; max: Float32Array; size: Float32Array; grow: Float32Array; grav: Float32Array; drag: Float32Array; cr: Float32Array; cg: Float32Array; cb: Float32Array;
  constructor(scene: THREE.Scene, cap: number, public additive: boolean) {
    this.cap = cap; const a = () => new Float32Array(cap);
    this.px = a(); this.py = a(); this.pz = a(); this.vx = a(); this.vy = a(); this.vz = a(); this.life = a(); this.max = a(); this.size = a(); this.grow = a(); this.grav = a(); this.drag = a(); this.cr = a(); this.cg = a(); this.cb = a();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive, fog: true });
    this.mesh = new THREE.InstancedMesh(additive ? new THREE.IcosahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 1), mat, cap);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh);
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, c: THREE.Color, size: number, life: number, grav = 0, drag = 0, grow = 0) {
    if (this.n >= this.cap) return; const i = this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz; this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag; this.cr[i] = c.r; this.cg[i] = c.g; this.cb[i] = c.b;
  }
  update(dt: number) {
    const m = this.mesh.instanceMatrix.array as Float32Array; const ca = this.mesh.instanceColor!.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { const l = --this.n; if (i !== l) { for (const k of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'life', 'max', 'size', 'grow', 'grav', 'drag', 'cr', 'cg', 'cb'] as const) this[k][i] = this[k][l]; } i--; continue; }
      const d = 1 - Math.min(1, this.drag[i] * dt); this.vx[i] *= d; this.vz[i] *= d; this.vy[i] = this.vy[i] * d - this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.1 && this.grav[i] > 0) { this.py[i] = 0.1; this.vy[i] *= -0.3; this.vx[i] *= 0.7; this.vz[i] *= 0.7; }
      const t = this.life[i] / this.max[i]; const age = 1 - t;
      const s = this.additive ? this.size[i] * (1 + this.grow[i] * age) * (0.3 + 0.7 * t) : this.size[i] * (1 + this.grow[i] * age) * Math.min(1, t * 3);
      const o = i * 16; m[o] = s; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0; m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0; m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = s; m[o + 11] = 0; m[o + 12] = this.px[i]; m[o + 13] = this.py[i]; m[o + 14] = this.pz[i]; m[o + 15] = 1;
      const f = this.additive ? t : 1; ca[i * 3] = this.cr[i] * f; ca[i * 3 + 1] = this.cg[i] * f; ca[i * 3 + 2] = this.cb[i] * f;
    }
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true;
  }
}

interface Timed { mesh: THREE.Mesh; t: number; max: number; a: number; s0: number; s1: number; on: boolean }
export interface Tele { kill(): void; mesh: THREE.Object3D }

function crackTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!; g.translate(128, 128); g.lineCap = 'round';
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    if (depth > 4 || len < 6) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.strokeStyle = 'rgba(8,6,6,0.95)'; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = 'rgba(255,120,40,0.55)'; g.lineWidth = w * 0.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    branch(x2, y2, a + (Math.random() - 0.5) * 0.9, len * 0.78, w * 0.75, depth + 1); if (Math.random() < 0.6) branch(x2, y2, a + (Math.random() - 0.5) * 2, len * 0.6, w * 0.6, depth + 1);
  };
  for (let i = 0; i < 9; i++) branch(0, 0, (i / 9) * 6.28 + Math.random() * 0.4, 34 + Math.random() * 22, 6, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class FX {
  add: PPool; solid: PPool; scene: THREE.Scene; lights: { l: THREE.PointLight; t: number; i: number }[] = []; rings: Timed[] = []; slashes: Timed[] = []; beams: Timed[] = []; cracks: Timed[] = [];
  teles: { m: THREE.Mesh; ttl: number; max: number; on: boolean; kind: string }[] = []; geoms: THREE.BufferGeometry[] = []; mats: THREE.Material[] = []; tex: THREE.Texture[] = [];
  debris: THREE.InstancedMesh; dn = 0; dcap: number; d = { p: [] as number[], v: [] as number[], r: [] as number[], w: [] as number[], s: [] as number[], l: [] as number[] }; dummy = new THREE.Object3D();
  cols: Record<string, THREE.Color> = {};

  constructor(scene: THREE.Scene, public particleCap: number, debrisCap: number) {
    this.scene = scene; this.add = new PPool(scene, Math.floor(particleCap * 0.6), true); this.solid = new PPool(scene, Math.floor(particleCap * 0.4), false);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 90, 1.6); scene.add(l); this.lights.push({ l, t: 0, i: 0 }); }
    const mkPool = (n: number, geo: THREE.BufferGeometry, arr: Timed[], blend = true, double = false) => {
      this.geoms.push(geo); for (let i = 0; i < n; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, side: double ? THREE.DoubleSide : THREE.FrontSide, fog: false }); this.mats.push(mat);
        const mesh = new THREE.Mesh(geo, mat); mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh); arr.push({ mesh, t: 0, max: 1, a: 1, s0: 1, s1: 1, on: false });
      }
    };
    const ring = new THREE.RingGeometry(0.88, 1, 48); ring.rotateX(-Math.PI / 2); mkPool(20, ring, this.rings);
    mkPool(10, new THREE.RingGeometry(0.5, 1, 28, 1, -1.3, 2.6), this.slashes, true, true);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); mkPool(48, cyl, this.beams);
    const tex = crackTex(); this.tex.push(tex); const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2); this.geoms.push(pg);
    for (let i = 0; i < 14; i++) { const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); this.mats.push(mat); const mesh = new THREE.Mesh(pg, mat); mesh.visible = false; mesh.position.y = 0.08; scene.add(mesh); this.cracks.push({ mesh, t: 0, max: 40, a: 1, s0: 1, s1: 1, on: false }); }
    // telegraphs
    const disc = new THREE.CircleGeometry(1, 40); disc.rotateX(-Math.PI / 2); const cone = new THREE.CircleGeometry(1, 20, -0.7, 1.4); cone.rotateX(-Math.PI / 2); cone.rotateY(Math.PI / 2);
    const line = new THREE.PlaneGeometry(1, 1); line.rotateX(-Math.PI / 2); line.translate(0, 0, 0.5); this.geoms.push(disc, cone, line);
    const ringT = new THREE.RingGeometry(0.93, 1, 48); ringT.rotateX(-Math.PI / 2); this.geoms.push(ringT);
    const mkT = (kind: string, g: THREE.BufferGeometry, n: number) => { for (let i = 0; i < n; i++) { const mat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -3 }); this.mats.push(mat); const m = new THREE.Mesh(g, mat); m.visible = false; m.frustumCulled = false; if (kind === 'disc') { const r = new THREE.Mesh(ringT, new THREE.MeshBasicMaterial({ color: 0xff8060, transparent: true, opacity: 0.9, depthWrite: false, fog: false })); this.mats.push(r.material as THREE.Material); m.add(r); } scene.add(m); this.teles.push({ m, ttl: 0, max: 1, on: false, kind }); } };
    mkT('disc', disc, 16); mkT('cone', cone, 6); mkT('line', line, 6);
    // debris
    this.dcap = debrisCap; const dm = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.85 }); this.mats.push(dm);
    this.debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), dm, debrisCap); this.debris.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(debrisCap * 3), 3); this.debris.count = 0; this.debris.frustumCulled = false; this.debris.castShadow = true; scene.add(this.debris);
  }
  c(hex: string) { return this.cols[hex] || (this.cols[hex] = new THREE.Color(hex)); }
  // ----- particles
  burst(p: THREE.Vector3, n: number, color: string | THREE.Color, speed: number, size: number, life: number, grav = 0, additive = true, drag = 1, grow = 0, up = 0) {
    const c = typeof color === 'string' ? this.c(color) : color; const pool = additive ? this.add : this.solid;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), s = speed * (0.3 + Math.random() * 0.7); pool.emit(p.x, p.y, p.z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s * 0.9 + up, Math.sin(b) * Math.sin(a) * s, c, size * (0.5 + Math.random()), life * (0.6 + Math.random() * 0.6), grav, drag, grow); }
  }
  emit(p: THREE.Vector3, v: THREE.Vector3, color: string, size: number, life: number, additive = true, grav = 0, drag = 0, grow = 0) { (additive ? this.add : this.solid).emit(p.x, p.y, p.z, v.x, v.y, v.z, this.c(color), size, life, grav, drag, grow); }
  sparks(p: THREE.Vector3, dir: THREE.Vector3, n: number, color = '#ffd070', speed = 40) {
    const c = this.c(color); for (let i = 0; i < n; i++) this.add.emit(p.x, p.y, p.z, dir.x * speed * (0.3 + Math.random()) + (Math.random() - 0.5) * speed * 0.8, dir.y * speed * 0.5 + Math.random() * speed * 0.6, dir.z * speed * (0.3 + Math.random()) + (Math.random() - 0.5) * speed * 0.8, c, 0.22 + Math.random() * 0.25, 0.3 + Math.random() * 0.4, 40, 0.5);
  }
  smoke(p: THREE.Vector3, n: number, scale = 1, color = '#4a4642') { const c = this.c(color); for (let i = 0; i < n; i++) this.solid.emit(p.x + (Math.random() - 0.5) * 3 * scale, p.y + Math.random() * 2, p.z + (Math.random() - 0.5) * 3 * scale, (Math.random() - 0.5) * 6 * scale, 4 + Math.random() * 8 * scale, (Math.random() - 0.5) * 6 * scale, c, (1.4 + Math.random() * 1.6) * scale, 1.5 + Math.random() * 2, -1, 0.8, 1.4); }
  dust(p: THREE.Vector3, r: number, n = 24, color = '#8a8070') { const c = this.c(color); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283; const s = r * (0.6 + Math.random() * 0.8); this.solid.emit(p.x + Math.cos(a) * r * 0.2, 0.6, p.z + Math.sin(a) * r * 0.2, Math.cos(a) * s, 1.5 + Math.random() * 3, Math.sin(a) * s, c, 1.3 + Math.random() * 1.5, 1.0 + Math.random() * 0.9, 0, 1.6, 1.2); } }
  explosion(p: THREE.Vector3, scale = 1, color = '#ff9a3a', light = true) {
    this.burst(p, Math.round(14 * scale), color, 22 * scale, 1.6 * scale, 0.7, 0, true, 2, 1.6); this.burst(p, Math.round(8 * scale), '#fff2c0', 14 * scale, 1.2 * scale, 0.35, 0, true, 3, 1);
    this.smoke(p, Math.round(8 * scale), scale); this.burst(p, Math.round(8 * scale), '#ffcf70', 38 * scale, 0.35, 0.6, 30, true, 0.3); if (light) this.flash(p, color, 5 * scale, 70 * Math.min(2, scale));
    this.ring(p, 9 * scale, color, 0.45, true);
  }
  // ----- lights
  flash(p: THREE.Vector3, color: string, intensity = 4, dist = 70, ttl = 0.35) {
    let b = this.lights[0]; for (const l of this.lights) if (l.t <= 0) { b = l; break; } else if (l.t < b.t) b = l;
    b.l.position.copy(p); b.l.color.set(color); b.l.distance = dist; b.i = intensity * 40; b.t = ttl; (b as any).max = ttl;
  }
  // ----- timed meshes
  private take(arr: Timed[]) { return arr.find(x => !x.on) || arr.reduce((a, b) => (a.t / a.max < b.t / b.max ? a : b)); }
  ring(p: THREE.Vector3, r: number, color: string, dur = 0.6, ground = true, lin = false) {
    const o = this.take(this.rings); (o as any).lin = lin; o.on = true; o.t = o.max = dur; o.s0 = r * (lin ? 0.05 : 0.15); o.s1 = r; o.mesh.visible = true; o.mesh.position.set(p.x, ground ? 0.25 : p.y, p.z); o.mesh.rotation.set(0, 0, 0); (o.mesh.material as THREE.MeshBasicMaterial).color.set(color); o.mesh.scale.setScalar(o.s0); return o;
  }
  vring(p: THREE.Vector3, r: number, color: string, yaw: number, dur = 0.5) { const o = this.ring(p, r, color, dur, false); o.mesh.rotation.set(Math.PI / 2, yaw, 0); }
  slash(p: THREE.Vector3, yaw: number, roll: number, r: number, color: string) {
    const o = this.take(this.slashes); o.on = true; o.t = o.max = 0.28; o.s0 = r * 0.7; o.s1 = r * 1.15; o.mesh.visible = true; o.mesh.position.copy(p);
    o.mesh.rotation.order = 'YXZ'; o.mesh.rotation.set(0, yaw, roll); (o.mesh.material as THREE.MeshBasicMaterial).color.set(color); o.mesh.scale.setScalar(o.s0);
  }
  beam(a: THREE.Vector3, b: THREE.Vector3, color: string, w = 0.6, ttl = 0.18) {
    const o = this.take(this.beams); const len = _v.copy(b).sub(a).length(); if (len < 0.01) return; o.on = true; o.t = o.max = ttl; o.mesh.visible = true;
    o.mesh.position.copy(a).add(b).multiplyScalar(0.5); _q.setFromUnitVectors(UP, _v.normalize()); o.mesh.quaternion.copy(_q); o.mesh.scale.set(w, len, w); o.s0 = w; o.s1 = w * 0.2; (o.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }
  bolt(a: THREE.Vector3, b: THREE.Vector3, color = '#bfe6ff', w = 0.45, ttl = 0.22, seg = 7) {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); let prev = a.clone(); const jit = Math.min(8, len * 0.08);
    for (let i = 1; i <= seg; i++) { const p = a.clone().addScaledVector(d, i / seg); if (i < seg) p.add(new THREE.Vector3((Math.random() - 0.5) * jit, (Math.random() - 0.5) * jit, (Math.random() - 0.5) * jit)); this.beam(prev, p, color, w, ttl); prev = p; }
    this.beam(a, b, '#ffffff', w * 0.3, ttl * 0.7);
  }
  crack(x: number, z: number, r: number) { const o = this.take(this.cracks); o.on = true; o.t = o.max = 40; o.mesh.visible = true; o.mesh.position.set(x, 0.08, z); o.mesh.rotation.y = Math.random() * 6.28; o.mesh.scale.setScalar(r * 2.2); (o.mesh.material as THREE.MeshBasicMaterial).opacity = 1; }
  // ----- telegraphs
  tele(kind: 'disc' | 'cone' | 'line', x: number, z: number, ttl: number, a: number, b = 1, color = 0xff2a1a): Tele {
    const t = this.teles.find(k => k.kind === kind && !k.on) || this.teles.find(k => k.kind === kind)!; t.on = true; t.ttl = t.max = ttl; t.m.visible = true; t.m.position.set(x, 0.3, z);
    (t.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    if (kind === 'disc') { t.m.scale.setScalar(a); } else if (kind === 'cone') { t.m.rotation.y = b; t.m.scale.setScalar(a); } else { t.m.rotation.y = b; t.m.scale.set(1, 1, a); }
    return { mesh: t.m, kill: () => { t.on = false; t.m.visible = false; } };
  }
  lineW(t: Tele, w: number) { t.mesh.scale.x = w; }
  // ----- debris
  chunk(p: THREE.Vector3, n: number, color: string, speed: number, size: number) {
    const c = this.c(color); for (let i = 0; i < n; i++) {
      if (this.dn >= this.dcap) return; const k = this.dn++; const a = Math.random() * 6.28, up = 0.4 + Math.random() * 1.0, s = speed * (0.4 + Math.random() * 0.8);
      this.d.p[k * 3] = p.x + (Math.random() - 0.5) * size * 2; this.d.p[k * 3 + 1] = p.y; this.d.p[k * 3 + 2] = p.z + (Math.random() - 0.5) * size * 2;
      this.d.v[k * 3] = Math.cos(a) * s; this.d.v[k * 3 + 1] = s * up; this.d.v[k * 3 + 2] = Math.sin(a) * s;
      this.d.r[k * 3] = Math.random() * 6; this.d.r[k * 3 + 1] = Math.random() * 6; this.d.r[k * 3 + 2] = Math.random() * 6; this.d.w[k * 3] = (Math.random() - 0.5) * 10; this.d.w[k * 3 + 1] = (Math.random() - 0.5) * 10; this.d.w[k * 3 + 2] = (Math.random() - 0.5) * 10;
      this.d.s[k] = size * (0.4 + Math.random() * 0.9); this.d.l[k] = 5 + Math.random() * 4; this.debris.setColorAt(k, c);
    }
  }
  private moveDebris(dst: number, src: number) { for (let j = 0; j < 3; j++) { this.d.p[dst * 3 + j] = this.d.p[src * 3 + j]; this.d.v[dst * 3 + j] = this.d.v[src * 3 + j]; this.d.r[dst * 3 + j] = this.d.r[src * 3 + j]; this.d.w[dst * 3 + j] = this.d.w[src * 3 + j]; } this.d.s[dst] = this.d.s[src]; this.d.l[dst] = this.d.l[src]; const ca = this.debris.instanceColor!.array as Float32Array; for (let j = 0; j < 3; j++) ca[dst * 3 + j] = ca[src * 3 + j]; }
  update(dt: number) {
    this.add.update(dt); this.solid.update(dt);
    for (const l of this.lights) { if (l.t > 0) { l.t -= dt; l.l.intensity = Math.max(0, l.i * (l.t / ((l as any).max || 0.35))); } else l.l.intensity = 0; }
    const upd = (arr: Timed[], f: (o: Timed, k: number) => void) => { for (const o of arr) if (o.on) { o.t -= dt; if (o.t <= 0) { o.on = false; o.mesh.visible = false; continue; } f(o, 1 - o.t / o.max); } };
    upd(this.rings, (o, k) => { o.mesh.scale.setScalar(lerp(o.s0, o.s1, (o as any).lin ? k : 1 - (1 - k) * (1 - k))); (o.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9; });
    upd(this.slashes, (o, k) => { o.mesh.scale.setScalar(lerp(o.s0, o.s1, k)); (o.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.95; });
    upd(this.beams, (o, k) => { o.mesh.scale.x = o.mesh.scale.z = lerp(o.s0, o.s1, k); (o.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - k; });
    upd(this.cracks, (o, k) => { (o.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, (1 - k) * 4); });
    for (const t of this.teles) if (t.on) { t.ttl -= dt; if (t.ttl <= 0) { t.on = false; t.m.visible = false; continue; } const k = 1 - t.ttl / t.max; (t.m.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.32 * k * (0.7 + 0.3 * Math.sin(k * 30)); }
    // debris
    const m = this.dummy; for (let i = 0; i < this.dn; i++) {
      this.d.l[i] -= dt; if (this.d.l[i] <= 0) { this.dn--; if (i !== this.dn) this.moveDebris(i, this.dn); i--; continue; }
      const k3 = i * 3; this.d.v[k3 + 1] -= 40 * dt; this.d.p[k3] += this.d.v[k3] * dt; this.d.p[k3 + 1] += this.d.v[k3 + 1] * dt; this.d.p[k3 + 2] += this.d.v[k3 + 2] * dt;
      if (this.d.p[k3 + 1] < this.d.s[i] * 0.5) { this.d.p[k3 + 1] = this.d.s[i] * 0.5; this.d.v[k3 + 1] *= -0.35; this.d.v[k3] *= 0.7; this.d.v[k3 + 2] *= 0.7; this.d.w[k3] *= 0.6; this.d.w[k3 + 1] *= 0.6; this.d.w[k3 + 2] *= 0.6; }
      this.d.r[k3] += this.d.w[k3] * dt; this.d.r[k3 + 1] += this.d.w[k3 + 1] * dt; this.d.r[k3 + 2] += this.d.w[k3 + 2] * dt;
      m.position.set(this.d.p[k3], this.d.p[k3 + 1], this.d.p[k3 + 2]); m.rotation.set(this.d.r[k3], this.d.r[k3 + 1], this.d.r[k3 + 2]); m.scale.setScalar(this.d.s[i] * Math.min(1, this.d.l[i])); m.updateMatrix(); this.debris.setMatrixAt(i, m.matrix);
    }
    this.debris.count = this.dn; this.debris.instanceMatrix.needsUpdate = true; if (this.debris.instanceColor) this.debris.instanceColor.needsUpdate = true;
  }
  dispose() {
    [this.add.mesh, this.solid.mesh, this.debris].forEach(m => { this.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); });
    this.lights.forEach(l => this.scene.remove(l.l));
    [...this.rings, ...this.slashes, ...this.beams, ...this.cracks].forEach(o => this.scene.remove(o.mesh)); this.teles.forEach(t => this.scene.remove(t.m));
    this.geoms.forEach(g => g.dispose()); this.mats.forEach(m => m.dispose()); this.tex.forEach(t => t.dispose());
  }
}
const lerp = THREE.MathUtils.lerp;
