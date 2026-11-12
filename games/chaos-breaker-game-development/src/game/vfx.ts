import * as THREE from 'three';
import { Elem } from './types';
import { ELEM_COLORS } from './data/world';
import { glowTex, ringTex, discTex, slashTex, crackTex, runeTex } from './textures';

// =============================================================== particle system (GPU points, pooled)
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; s0: number; s1: number; r0: number; g0: number; b0: number; r1: number; g1: number; b1: number; grav: number; drag: number; a: number }
const _c0 = new THREE.Color(), _c1 = new THREE.Color();

class PointSys {
  mesh: THREE.Points; geo = new THREE.BufferGeometry(); pos: Float32Array; col: Float32Array; size: Float32Array; alpha: Float32Array;
  free: Particle[] = []; active: Particle[] = []; mat: THREE.ShaderMaterial;
  constructor(public max: number, additive: boolean) {
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute float size;attribute float alpha;attribute vec3 color;varying vec3 vC;varying float vA;uniform float uScale;void main(){vC=color;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(size*uScale/max(-mv.z,.1),360.);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.15,d);gl_FragColor=vec4(vC,a*a*vA);}',
    });
    this.mesh = new THREE.Points(this.geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    for (let i = 0; i < max; i++) this.free.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 1, s1: 1, r0: 1, g0: 1, b0: 1, r1: 1, g1: 1, b1: 1, grav: 0, drag: 0, a: 1 });
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, c0: number, c1: number, grav = 0, drag = 0, a = 1) {
    const p = this.free.pop(); if (!p) return;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life; p.s0 = s0; p.s1 = s1; p.grav = grav; p.drag = drag; p.a = a;
    _c0.setHex(c0); _c1.setHex(c1); p.r0 = _c0.r; p.g0 = _c0.g; p.b0 = _c0.b; p.r1 = _c1.r; p.g1 = _c1.g; p.b1 = _c1.b;
    this.active.push(p);
  }
  update(dt: number) {
    const A = this.active; let n = 0;
    for (let i = 0; i < A.length; i++) {
      const p = A[i]; p.life -= dt;
      if (p.life <= 0) { this.free.push(p); continue; }
      const k = 1 - p.life / p.max, d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy = p.vy * d - p.grav * dt; p.vz *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const j = n * 3; this.pos[j] = p.x; this.pos[j + 1] = p.y; this.pos[j + 2] = p.z;
      this.col[j] = p.r0 + (p.r1 - p.r0) * k; this.col[j + 1] = p.g0 + (p.g1 - p.g0) * k; this.col[j + 2] = p.b0 + (p.b1 - p.b0) * k;
      this.size[n] = p.s0 + (p.s1 - p.s0) * k; this.alpha[n] = p.a * (k < .1 ? k * 10 : 1 - (k - .1) / .9);
      A[n++] = p;
    }
    A.length = n; this.geo.setDrawRange(0, n);
    for (const k of ['position', 'color', 'size', 'alpha']) this.geo.getAttribute(k).needsUpdate = true;
  }
}

// =============================================================== instanced sparks + debris
interface Chunk { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; sz: number; rx: number; ry: number; rz: number; wx: number; wy: number; wz: number; grav: number; r: number; g: number; b: number }
class ChunkSys {
  mesh: THREE.InstancedMesh; active: Chunk[] = []; free: Chunk[] = []; tmp = new THREE.Object3D(); col = new THREE.Color(); up = new THREE.Vector3(0, 0, 1); v = new THREE.Vector3();
  constructor(public max: number, geo: THREE.BufferGeometry, mat: THREE.Material, public streak: boolean) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    for (let i = 0; i < max; i++) this.free.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, sz: 1, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, grav: 0, r: 1, g: 1, b: 1 });
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, sz: number, hex: number, grav: number) {
    const c = this.free.pop(); if (!c) return; this.col.setHex(hex);
    c.x = x; c.y = y; c.z = z; c.vx = vx; c.vy = vy; c.vz = vz; c.life = c.max = life; c.sz = sz; c.grav = grav; c.r = this.col.r; c.g = this.col.g; c.b = this.col.b;
    c.rx = Math.random() * 6; c.ry = Math.random() * 6; c.rz = Math.random() * 6; c.wx = (Math.random() - .5) * 14; c.wy = (Math.random() - .5) * 14; c.wz = (Math.random() - .5) * 14;
    this.active.push(c);
  }
  update(dt: number) {
    const A = this.active; let n = 0; const m = this.mesh, ic = m.instanceColor!;
    for (let i = 0; i < A.length; i++) {
      const c = A[i]; c.life -= dt; if (c.life <= 0) { this.free.push(c); continue; }
      c.vy -= c.grav * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      if (!this.streak && c.y < .05) { c.y = .05; c.vy *= -.35; c.vx *= .7; c.vz *= .7; c.wx *= .6; c.wy *= .6; c.wz *= .6; }
      const k = c.life / c.max, o = this.tmp;
      o.position.set(c.x, c.y, c.z);
      if (this.streak) {
        this.v.set(c.vx, c.vy, c.vz); const sp = this.v.length() || 1; this.v.divideScalar(sp); o.quaternion.setFromUnitVectors(this.up, this.v);
        const w = c.sz * Math.min(1, k * 2); o.scale.set(w, w, Math.min(1.6, .06 + sp * .035) * (.4 + .6 * k));
      } else { c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt; o.rotation.set(c.rx, c.ry, c.rz); const s = c.sz * Math.min(1, k * 3); o.scale.set(s, s * .7, s * 1.2); }
      o.updateMatrix(); m.setMatrixAt(n, o.matrix); ic.setXYZ(n, c.r, c.g, c.b); A[n++] = c;
    }
    A.length = n; m.count = n; m.instanceMatrix.needsUpdate = true; ic.needsUpdate = true;
  }
}

// =============================================================== pooled mesh effects
type Kind = 'ring' | 'arc' | 'disc' | 'dome' | 'orb' | 'beam' | 'crystal' | 'flare' | 'cone';
interface FxItem { g: THREE.Group; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial; active: boolean; t: number; dur: number; s0: THREE.Vector3; s1: THREE.Vector3; p0: THREE.Vector3; rise: number; op: number; pw: number; spin: number; ease: string; bb: boolean; roll: number; kind: Kind; flicker: boolean }
export interface FxOpts { pos: THREE.Vector3 | number[]; s0?: number | number[]; s1?: number | number[]; color?: number; op?: number; dur?: number; pw?: number; rot?: number[]; spin?: number; tex?: THREE.Texture; rise?: number; ease?: 'out' | 'lin' | 'in'; roll?: number; flicker?: boolean }

function crescent(len = 2.4, wd = .5, seg = 28) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, ph = (u - .5) * len, inner = 1 - wd * Math.pow(Math.sin(u * Math.PI), .8);
    pos.push(Math.sin(ph) * inner, 0, Math.cos(ph) * inner, Math.sin(ph), 0, Math.cos(ph)); uv.push(u, 0, u, 1);
    if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
function starTex() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.12, 'rgba(255,255,255,.8)'); r.addColorStop(.4, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const streak = (ang: number, len: number, wd: number) => { g.save(); g.translate(64, 64); g.rotate(ang); const l = g.createLinearGradient(-len, 0, len, 0); l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(.5, 'rgba(255,255,255,1)'); l.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = l; g.beginPath(); g.moveTo(-len, 0); g.lineTo(0, -wd); g.lineTo(len, 0); g.lineTo(0, wd); g.fill(); g.restore(); };
  streak(0, 64, 4); streak(Math.PI / 2, 64, 4); streak(Math.PI / 4, 36, 2); streak(-Math.PI / 4, 36, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function beamTex() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const c = document.createElement('canvas'); c.width = 16; c.height = 64; const g = c.getContext('2d')!;
  const l = g.createLinearGradient(0, 0, 0, 64); l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(.1, 'rgba(255,255,255,.9)'); l.addColorStop(.7, 'rgba(255,255,255,.5)'); l.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = l; g.fillRect(0, 0, 16, 64); const t = new THREE.CanvasTexture(c); return t;
}

// =============================================================== trails
export class WeaponTrail {
  mesh: THREE.Mesh; geo = new THREE.BufferGeometry(); N = 22; SUB = 3; pts: { b: THREE.Vector3; t: THREE.Vector3; age: number }[] = []; free: { b: THREE.Vector3; t: THREE.Vector3; age: number }[] = [];
  pos: Float32Array; col: Float32Array; life = .3; c0 = new THREE.Color(); c1 = new THREE.Color(); last = false;
  constructor(scene: THREE.Object3D, hex0: number, hex1: number) {
    const maxV = (this.N * this.SUB + 1) * 2;
    this.pos = new Float32Array(maxV * 3); this.col = new Float32Array(maxV * 4);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = []; for (let i = 0; i < maxV / 2 - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx); this.geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; scene.add(this.mesh); this.setColor(hex0, hex1);
    for (let i = 0; i < this.N + 2; i++) this.free.push({ b: new THREE.Vector3(), t: new THREE.Vector3(), age: 0 });
  }
  setColor(h0: number, h1: number) { this.c0.setHex(h0); this.c1.setHex(h1); }
  reset() { while (this.pts.length) this.free.push(this.pts.pop()!); this.geo.setDrawRange(0, 0); this.last = false; }
  update(dt: number, base: THREE.Vector3, tip: THREE.Vector3, on: boolean) {
    for (const p of this.pts) p.age += dt;
    while (this.pts.length && this.pts[0].age > this.life) this.free.push(this.pts.shift()!);
    if (on) {
      let p = this.free.pop(); if (!p) { p = this.pts.shift()!; }
      p.b.copy(base); p.t.copy(tip); p.age = 0; this.pts.push(p);
    } else if (this.last && this.pts.length) { /* just ended */ }
    this.last = on;
    const n = this.pts.length;
    if (n < 2) { this.geo.setDrawRange(0, 0); return; }
    let v = 0; const S = this.SUB, P = this.pts;
    const cr = (a: number, b: number, c: number, d: number, t: number) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      for (let s = 0; s < S + (i === n - 2 ? 1 : 0); s++) {
        const t = s / S, age = p1.age + (p2.age - p1.age) * t, f = Math.max(0, 1 - age / this.life), a = f * f;
        const ix = v * 3, ic = v * 4, mix = Math.min(1, age / this.life * 1.4);
        const cr3 = (k: 'x' | 'y' | 'z', q: 'b' | 't') => cr(p0[q][k], p1[q][k], p2[q][k], p3[q][k], t);
        this.pos[ix] = cr3('x', 'b'); this.pos[ix + 1] = cr3('y', 'b'); this.pos[ix + 2] = cr3('z', 'b');
        this.pos[ix + 3] = cr3('x', 't'); this.pos[ix + 4] = cr3('y', 't'); this.pos[ix + 5] = cr3('z', 't');
        const r = this.c0.r + (this.c1.r - this.c0.r) * mix, g = this.c0.g + (this.c1.g - this.c0.g) * mix, bl = this.c0.b + (this.c1.b - this.c0.b) * mix;
        this.col[ic] = r * .6; this.col[ic + 1] = g * .6; this.col[ic + 2] = bl * .6; this.col[ic + 3] = a * .25;
        this.col[ic + 4] = r; this.col[ic + 5] = g; this.col[ic + 6] = bl; this.col[ic + 7] = a * .95;
        v += 2;
      }
    }
    this.geo.setDrawRange(0, (v - 1) * 3); this.geo.getAttribute('position').needsUpdate = true; this.geo.getAttribute('color').needsUpdate = true;
  }
}

// =============================================================== engine facade
const V = new THREE.Vector3(), V2 = new THREE.Vector3();
const xyz = (p: THREE.Vector3 | number[]): number[] => Array.isArray(p) ? [p[0], p[1], p[2]] : [p.x, p.y, p.z];
class VfxEngine {
  scene!: THREE.Scene; camera!: THREE.Camera; renderer!: THREE.WebGLRenderer;
  add!: PointSys; norm!: PointSys; sparks!: ChunkSys; debrisS!: ChunkSys;
  pools: Record<string, FxItem[]> = {}; rr: Record<string, number> = {}; activeFx: FxItem[] = [];
  bolts: { mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial; t: number; dur: number; op: number; active: boolean }[] = []; boltRR = 0;
  later: { t: number; fn: () => void }[] = [];
  light!: THREE.PointLight; lightT = 0; lightDur = 1; lightI = 0;
  density = 1; ready = false; group = new THREE.Group();
  tex = {} as Record<string, THREE.Texture>;

  init(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer | null, dens: number) {
    if (this.ready) { this.dispose(); }
    this.scene = scene; this.camera = camera; this.renderer = renderer as THREE.WebGLRenderer; this.density = dens; this.group = new THREE.Group(); scene.add(this.group);
    this.tex = { glow: glowTex(), ring: ringTex(), disc: discTex(), slash: slashTex(), crack: crackTex(), rune: runeTex(), star: starTex(), beam: beamTex() };
    this.add = new PointSys(Math.round(2600 * Math.max(.5, dens)), true); this.norm = new PointSys(700, false);
    const sg = new THREE.BoxGeometry(1, 1, 1); const sm = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.sparks = new ChunkSys(420, sg, sm, true);
    this.debrisS = new ChunkSys(220, new THREE.TetrahedronGeometry(1), new THREE.MeshStandardMaterial({ roughness: .7, metalness: .3, flatShading: true }), false);
    this.group.add(this.add.mesh, this.norm.mesh, this.sparks.mesh, this.debrisS.mesh);
    this.light = new THREE.PointLight(0xffffff, 0, 28, 1.6); this.group.add(this.light);
    const geos: Record<Kind, THREE.BufferGeometry> = {
      ring: new THREE.RingGeometry(.0, 1, 64).rotateX(-Math.PI / 2), arc: crescent(), disc: new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
      dome: new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), orb: new THREE.SphereGeometry(1, 18, 12),
      beam: new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, .5, 0), crystal: new THREE.ConeGeometry(.5, 1, 6).translate(0, .5, 0),
      flare: new THREE.PlaneGeometry(1, 1), cone: new THREE.ConeGeometry(1, 1, 14, 1, true).translate(0, .5, 0),
    };
    const counts: Record<Kind, number> = { ring: 26, arc: 14, disc: 18, dome: 8, orb: 10, beam: 24, crystal: 44, flare: 22, cone: 16 };
    const texFor: Partial<Record<Kind, THREE.Texture>> = { ring: this.tex.ring, arc: this.tex.slash, disc: this.tex.disc, flare: this.tex.star, beam: this.tex.beam };
    (Object.keys(geos) as Kind[]).forEach(k => {
      this.pools[k] = []; this.rr[k] = 0;
      for (let i = 0; i < counts[k]; i++) {
        const mat = k === 'crystal' ? new THREE.MeshStandardMaterial({ color: 0xaaeeff, emissive: 0x44aacc, emissiveIntensity: .8, transparent: true, opacity: .9, roughness: .15, metalness: .2, flatShading: true })
          : new THREE.MeshBasicMaterial({ map: texFor[k] ?? null, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geos[k], mat); mesh.frustumCulled = false; mesh.renderOrder = 4; const g = new THREE.Group(); g.add(mesh); g.visible = false; this.group.add(g);
        this.pools[k].push({ g, mesh, mat, active: false, t: 0, dur: 1, s0: new THREE.Vector3(), s1: new THREE.Vector3(), p0: new THREE.Vector3(), rise: 0, op: 1, pw: 1, spin: 0, ease: 'out', bb: k === 'flare', roll: 0, kind: k, flicker: false });
      }
    });
    for (let i = 0; i < 14; i++) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 4 * 3), 3)); const idx: number[] = [];
      for (let s = 0; s < 15; s++) for (let q = 0; q < 2; q++) { const a = s * 4 + q * 2; idx.push(a, a + 1, a + 4, a + 1, a + 5, a + 4); }
      geo.setIndex(idx); const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 6; this.group.add(mesh); this.bolts.push({ mesh, geo, mat, t: 0, dur: 1, op: 1, active: false });
    }
    this.ready = true;
  }
  dispose() { if (this.group.parent) this.group.parent.remove(this.group); this.activeFx.length = 0; this.later.length = 0; this.ready = false; }
  cnt(n: number) { return Math.max(1, Math.round(n * this.density)); }
  delay(t: number, fn: () => void) { this.later.push({ t, fn }); }

  // ------------------------------------------------ primitive spawns
  P(add: boolean, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, c0: number, c1: number, grav = 0, drag = 0, a = 1) {
    (add ? this.add : this.norm).spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, grav, drag, a);
  }
  fx(kind: Kind, o: FxOpts) {
    const pool = this.pools[kind]; let it = pool.find(p => !p.active);
    if (!it) { it = pool[this.rr[kind]++ % pool.length]; }
    const [px, py, pz] = xyz(o.pos);
    const sv = (s: number | number[] | undefined, d: number, out: THREE.Vector3) => { if (Array.isArray(s)) out.set(s[0], s[1], s[2]); else out.setScalar(s ?? d); };
    it.p0.set(px, py, pz); sv(o.s0, 1, it.s0); sv(o.s1, 1, it.s1); it.g.position.copy(it.p0);
    const r = o.rot ?? [0, 0, 0]; it.g.rotation.set(r[0], r[1], r[2], 'YXZ'); it.g.scale.copy(it.s0);
    it.t = 0; it.dur = o.dur ?? .4; it.op = o.op ?? 1; it.pw = o.pw ?? 1.5; it.spin = o.spin ?? 0; it.rise = o.rise ?? 0; it.ease = o.ease ?? 'out'; it.roll = o.roll ?? 0; it.flicker = !!o.flicker;
    const m = it.mat as THREE.MeshBasicMaterial; if (kind !== 'crystal') { m.color.setHex(o.color ?? 0xffffff); if (o.tex) m.map = o.tex; else m.map = (kind === 'ring' ? this.tex.ring : kind === 'arc' ? this.tex.slash : kind === 'disc' ? this.tex.disc : kind === 'flare' ? this.tex.star : kind === 'beam' ? this.tex.beam : null); m.opacity = it.op; m.needsUpdate = false; }
    else { const s = it.mat as THREE.MeshStandardMaterial; s.color.setHex(o.color ?? 0xaaeeff); s.emissive.setHex(o.color ?? 0x44aacc); s.opacity = .92; }
    it.g.visible = true; if (!it.active) { it.active = true; this.activeFx.push(it); }
    return it;
  }
  spark(x: number, y: number, z: number, dx: number, dy: number, dz: number, n: number, speed: number, spread: number, hex: number, life = .5, sz = .035) {
    for (let i = 0; i < this.cnt(n); i++) {
      V.set(dx + (Math.random() - .5) * spread * 2, dy + (Math.random() - .5) * spread * 2, dz + (Math.random() - .5) * spread * 2).normalize().multiplyScalar(speed * (.45 + Math.random() * .8));
      this.sparks.spawn(x, y, z, V.x, V.y, V.z, life * (.5 + Math.random() * .7), sz * (.6 + Math.random()), hex, 9);
    }
  }
  chunks(x: number, y: number, z: number, n: number, speed: number, hex: number, size = .16, up = .9) {
    for (let i = 0; i < this.cnt(n); i++) { const a = Math.random() * 6.28, s = speed * (.3 + Math.random()); this.debrisS.spawn(x, y, z, Math.cos(a) * s, speed * up * (.5 + Math.random()), Math.sin(a) * s, 1.4 + Math.random() * 1.2, size * (.5 + Math.random()), hex, 22); }
  }
  light1(pos: THREE.Vector3 | number[], hex: number, intensity: number, dur: number) {
    const q = xyz(pos); this.light.position.set(q[0], q[1] + 1, q[2]);
    this.light.color.setHex(hex); this.lightI = Math.max(intensity, this.lightT > 0 ? this.lightI * this.lightT / this.lightDur : 0); this.lightDur = dur; this.lightT = dur;
  }
  bolt(a: THREE.Vector3, b: THREE.Vector3, hex: number, width = .12, dur = .25, jag = .5) {
    const it = this.bolts[this.boltRR++ % this.bolts.length]; const pos = (it.geo.getAttribute('position') as THREE.BufferAttribute);
    const len = a.distanceTo(b), N = Math.min(15, Math.max(5, Math.round(len * 1.6)));
    const d = V.copy(b).sub(a).normalize(); const p1 = V2.set(-d.z, 0, d.x); if (p1.lengthSq() < .01) p1.set(1, 0, 0); p1.normalize();
    const p2x = d.y * p1.z - d.z * p1.y, p2y = d.z * p1.x - d.x * p1.z, p2z = d.x * p1.y - d.y * p1.x;
    const arr = pos.array as Float32Array; let ox = 0, oy = 0, oz = 0;
    for (let s = 0; s <= N; s++) {
      const t = s / N, j = s === 0 || s === N ? 0 : jag * Math.sin(t * Math.PI) * (.4 + Math.random() * .8) * Math.min(1, len / 5 + .3);
      if (s !== 0 && s !== N) { const ang = Math.random() * 6.28; ox = (p1.x * Math.cos(ang) + p2x * Math.sin(ang)) * j; oy = (p1.y * Math.cos(ang) + p2y * Math.sin(ang)) * j; oz = (p1.z * Math.cos(ang) + p2z * Math.sin(ang)) * j; } else ox = oy = oz = 0;
      const x = a.x + (b.x - a.x) * t + ox, y = a.y + (b.y - a.y) * t + oy, z = a.z + (b.z - a.z) * t + oz, w = width * (1 - Math.abs(t - .5) * .8), i = s * 12;
      arr[i] = x - p1.x * w; arr[i + 1] = y - p1.y * w; arr[i + 2] = z - p1.z * w; arr[i + 3] = x + p1.x * w; arr[i + 4] = y + p1.y * w; arr[i + 5] = z + p1.z * w;
      arr[i + 6] = x - p2x * w; arr[i + 7] = y - p2y * w; arr[i + 8] = z - p2z * w; arr[i + 9] = x + p2x * w; arr[i + 10] = y + p2y * w; arr[i + 11] = z + p2z * w;
    }
    pos.needsUpdate = true; it.geo.setDrawRange(0, N * 12); it.mat.color.setHex(hex); it.t = 0; it.dur = dur; it.op = 1; it.active = true; it.mesh.visible = true;
  }

  // ------------------------------------------------ frame update
  update(dt: number, cam: THREE.Camera) {
    if (!this.ready) return;
    const sc = this.renderer ? this.renderer.domElement.height / (2 * Math.tan(((cam as THREE.PerspectiveCamera).fov * Math.PI / 180) / 2)) : 600;
    this.add.mat.uniforms.uScale.value = sc; this.norm.mat.uniforms.uScale.value = sc;
    this.add.update(dt); this.norm.update(dt); this.sparks.update(dt); this.debrisS.update(dt);
    for (let i = this.later.length - 1; i >= 0; i--) { const l = this.later[i]; l.t -= dt; if (l.t <= 0) { this.later.splice(i, 1); l.fn(); } }
    const A = this.activeFx; let n = 0;
    for (let i = 0; i < A.length; i++) {
      const it = A[i]; it.t += dt; const k = it.t / it.dur;
      if (k >= 1) { it.active = false; it.g.visible = false; continue; }
      const e = it.ease === 'out' ? 1 - Math.pow(1 - k, 3) : it.ease === 'in' ? k * k : k;
      it.g.scale.lerpVectors(it.s0, it.s1, e); it.g.position.set(it.p0.x, it.p0.y + it.rise * e, it.p0.z);
      if (it.spin) it.mesh.rotation.y += it.spin * dt;
      if (it.bb) { it.g.quaternion.copy(cam.quaternion); if (it.roll) it.g.rotateZ(it.roll); }
      const fo = it.kind === 'crystal' ? (k > .65 ? 1 - (k - .65) / .35 : 1) : Math.pow(1 - k, it.pw) * (k < .06 ? k / .06 : 1);
      (it.mat as THREE.Material).opacity = it.op * fo * (it.flicker ? .6 + Math.random() * .4 : 1);
      A[n++] = it;
    }
    A.length = n;
    for (const b of this.bolts) if (b.active) { b.t += dt; const k = b.t / b.dur; if (k >= 1) { b.active = false; b.mesh.visible = false; } else b.mat.opacity = Math.pow(1 - k, 1.2) * (.55 + Math.random() * .45); }
    if (this.lightT > 0) { this.lightT -= dt; this.light.intensity = Math.max(0, this.lightI * 9 * (this.lightT / this.lightDur)); } else this.light.intensity = 0;
  }

  // ================================================== recipes
  impact(e: Elem, pos: THREE.Vector3, dir: THREE.Vector3, power = 1) {
    const [c0, c1] = ELEM_COLORS[e], x = pos.x, y = pos.y, z = pos.z;
    this.fx('flare', { pos, s0: .5 * power, s1: 2.6 * power, color: c1, dur: .22, roll: Math.random() * 3 });
    this.fx('flare', { pos, s0: .3, s1: 1.4 * power, color: c0, dur: .14 });
    this.fx('ring', { pos, s0: .2, s1: 1.5 * power, color: c1, dur: .26, op: .8 });
    this.spark(x, y, z, dir.x, dir.y + .15, dir.z, 9 * power, 9, .55, c0, .45);
    this.light1(pos, c1, 4 * power, .14);
    const n = this.cnt(5 * power);
    for (let i = 0; i < n; i++) {
      const rx = (Math.random() - .5), rz = (Math.random() - .5);
      switch (e) {
        case 'fire': this.P(true, x, y, z, rx * 3 + dir.x * 2, 2 + Math.random() * 3, rz * 3 + dir.z * 2, .6 + Math.random() * .4, .5, .1, c0, c1, -3, 1); if (i % 2) this.P(false, x, y, z, rx * 2, 1.5, rz * 2, .9, .4, 1.1, 0x331108, 0x110805, -1, 1, .5); break;
        case 'lightning': this.P(true, x, y, z, rx * 8, Math.random() * 3, rz * 8, .25, .35, .05, 0xffffff, c1, 0, 2); break;
        case 'void': this.P(true, x + rx, y + (Math.random() - .5), z + rz, -rx * 4, 0, -rz * 4, .5, .5, .05, c0, c1, 0, 1); break;
        case 'ice': this.P(true, x, y, z, rx * 4, 1 + Math.random() * 2, rz * 4, .7, .25, .04, 0xffffff, c1, 3, 1); if (i === 0) this.chunks(x, y, z, 3, 4, 0xbff4ff, .12); break;
        case 'plasma': this.P(true, x, y, z, rx * 6, Math.random() * 3, rz * 6, .4, .3, .02, 0xffffff, c1, 0, 2); break;
        case 'earth': this.P(false, x, y, z, rx * 3, 1.5, rz * 3, .8, .4, 1.2, 0x8a7240, 0x3a2a10, -1, 1, .6); if (i === 0) this.chunks(x, y, z, 3, 4, 0x887755, .14); break;
        default: this.P(true, x, y, z, rx * 5, Math.random() * 3, rz * 5, .3, .3, .03, c0, c1, 0, 2);
      }
    }
    if (e === 'lightning') { for (let i = 0; i < 2; i++) { V.set(x + (Math.random() - .5) * 2, y + Math.random() * 1.5, z + (Math.random() - .5) * 2); this.bolt(pos, V.clone(), c1, .05, .12, .25); } }
  }
  clash(e: Elem, pos: THREE.Vector3, dir: THREE.Vector3, perfect: boolean, chain = 1, w = '') {
    const [c0, c1] = ELEM_COLORS[e], x = pos.x, y = pos.y, z = pos.z, ch = Math.min(chain, 8), L = perfect ? 1 : .45;
    this.fx('flare', { pos, s0: .6, s1: (3.8 + ch * .6) * L * 1.5, color: 0xffffff, dur: .3, roll: .4 });
    this.fx('flare', { pos, s0: .4, s1: (6 + ch * .8) * L, color: c1, dur: .4, roll: -.5 });
    this.fx('ring', { pos, s0: .3, s1: (4 + ch * .7) * L * 1.5, color: c0, dur: .38, op: .9 });
    this.spark(x, y, z, dir.x, dir.y * .3 + .2, dir.z, (perfect ? 34 + ch * 7 : 14), perfect ? 20 : 10, .85, 0xfff2c0, .6, .045);
    this.spark(x, y, z, 0, 1, 0, perfect ? 22 : 6, perfect ? 12 : 7, 1.6, c1, .5);
    this.chunks(x, y, z, perfect ? 10 : 4, 6, 0xc8c8d0, .1);
    this.light1(pos, c1, perfect ? 10 + ch : 4, perfect ? .3 : .15);
    if (!perfect) return;
    this.fx('ring', { pos, s0: .2, s1: 10 + ch * 1.4, color: c1, dur: .55, op: .8, rot: [0, 0, 0] });
    this.fx('ring', { pos, s0: .2, s1: 6 + ch, color: 0xffffff, dur: .35, op: .9, rot: [.9, Math.random() * 3, 0] });
    this.fx('dome', { pos: [x, 0, z], s0: .5, s1: 5 + ch * .6, color: c1, dur: .4, op: .35 });
    for (let i = 0; i < this.cnt(26); i++) { const a = Math.random() * 6.28, s = 5 + Math.random() * 9; this.P(true, x, y, z, Math.cos(a) * s, (Math.random() - .3) * s * .6, Math.sin(a) * s, .5 + Math.random() * .3, .5, .05, 0xffffff, c1, 0, 2.5); }
    switch (w) {
      case 'inferno': for (let i = 0; i < this.cnt(26); i++) this.P(true, x, y, z, (Math.random() - .5) * 8, 2 + Math.random() * 6, (Math.random() - .5) * 8, .9, .8, .1, c0, c1, -2, 1); break;
      case 'thunder': for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28, r = 2.5 + Math.random() * 2; V.set(x + Math.cos(a) * r, y + (Math.random() - .3) * 2, z + Math.sin(a) * r); this.bolt(pos, V.clone(), i % 2 ? c1 : 0xffffff, .09, .25, .6); } break;
      case 'void': for (let i = 0; i < this.cnt(30); i++) { const a = Math.random() * 6.28, r = 3 + Math.random() * 2; this.P(true, x + Math.cos(a) * r, y + (Math.random() - .5) * 2, z + Math.sin(a) * r, -Math.cos(a) * r * 3.5, 0, -Math.sin(a) * r * 3.5, .5, .5, .04, c0, c1); } this.fx('disc', { pos: [x, y, z], s0: 3, s1: .1, color: c1, dur: .35, tex: this.tex.rune, rot: [Math.PI / 2, 0, 0], op: .9 }); break;
      case 'glacier': this.chunks(x, y, z, 12, 7, 0xbff4ff, .13); for (let i = 0; i < this.cnt(16); i++) this.P(true, x, y, z, (Math.random() - .5) * 8, Math.random() * 4, (Math.random() - .5) * 8, 1, .3, .05, 0xffffff, c1, 2, 1); break;
      case 'plasma': this.fx('flare', { pos, s0: [.3, .05, 1], s1: [14, .3, 1], color: 0xffffff, dur: .35, roll: Math.atan2(dir.y, dir.x) }); this.fx('flare', { pos, s0: [.3, .05, 1], s1: [10, .25, 1], color: c1, dur: .45, roll: Math.atan2(dir.y, dir.x) + 1.57 }); break;
      case 'titan': this.fx('disc', { pos: [x, .05, z], s0: 1, s1: 6, color: c1, dur: 1.4, tex: this.tex.crack, op: .8, pw: 1 }); this.slamDust(x, z, 4, 0x998866); this.chunks(x, .5, z, 12, 7, 0x998866, .22); break;
    }
  }
  slamDust(x: number, z: number, r: number, hex: number) {
    for (let i = 0; i < this.cnt(22); i++) { const a = Math.random() * 6.28, s = r * (1.2 + Math.random() * 1.5); this.P(false, x + Math.cos(a) * r * .3, .3, z + Math.sin(a) * r * .3, Math.cos(a) * s, .6 + Math.random() * 1.2, Math.sin(a) * s, 1 + Math.random() * .8, .8, 2.6, hex, 0x221a14, -.3, 2.2, .55); }
  }
  slashArc(e: Elem, pos: THREE.Vector3, yaw: number, size: number, roll = 0, dur = .28) {
    const [c0, c1] = ELEM_COLORS[e];
    this.fx('arc', { pos, s0: size * .8, s1: size * 1.15, color: c1, dur, rot: [0, yaw, roll], op: .95, pw: 1.3 });
    this.fx('arc', { pos, s0: size * .8, s1: size * 1.1, color: c0, dur: dur * .7, rot: [0, yaw, roll], op: .9 });
  }
  burst(e: Elem, pos: THREE.Vector3, r: number, big = false) {
    const [c0, c1] = ELEM_COLORS[e], x = pos.x, z = pos.z, y = Math.max(.1, pos.y);
    this.fx('flare', { pos: [x, y + 1, z], s0: 1, s1: r * 1.1, color: c1, dur: .35 });
    this.fx('ring', { pos: [x, .1, z], s0: .5, s1: r * 1.25, color: c1, dur: .5, op: .95 });
    this.fx('ring', { pos: [x, .15, z], s0: .3, s1: r * .8, color: c0, dur: .35 });
    this.fx('dome', { pos: [x, 0, z], s0: .5, s1: r * .8, color: c1, dur: .45, op: .45 });
    this.fx('disc', { pos: [x, .04, z], s0: r * .3, s1: r * .9, color: c1, dur: 1.2, op: .35 });
    this.light1([x, y, z], c1, 8 + (big ? 6 : 0), .5);
    this.elemSpray(e, x, y, z, r, big ? 2 : 1);
  }
  elemSpray(e: Elem, x: number, y: number, z: number, r: number, m = 1) {
    const [c0, c1] = ELEM_COLORS[e]; const n = this.cnt(34 * m);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, d = Math.random() * r * .8, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      switch (e) {
        case 'fire': this.P(true, px, y, pz, Math.cos(a) * 2, 3 + Math.random() * 7, Math.sin(a) * 2, .9 + Math.random() * .6, 1.2, .2, c0, c1, -1, .6); if (i % 3 === 0) this.P(false, px, y + .5, pz, 0, 2, 0, 1.6, 1, 3, 0x2a1008, 0x0a0505, -.5, .5, .55); break;
        case 'lightning': this.P(true, px, y, pz, Math.cos(a) * 6, Math.random() * 6, Math.sin(a) * 6, .4, .5, .05, 0xffffff, c1, 0, 2); break;
        case 'void': this.P(true, px, y + Math.random() * 3, pz, -Math.cos(a) * 3, Math.random() * 2, -Math.sin(a) * 3, 1, .8, .05, c0, c1, 0, .8); break;
        case 'ice': this.P(true, px, y + Math.random() * 4, pz, Math.cos(a), -1, Math.sin(a), 1.4, .3, .08, 0xffffff, c1, 0, .3); break;
        case 'plasma': this.P(true, px, y + Math.random() * 2, pz, Math.cos(a) * 5, Math.random() * 5, Math.sin(a) * 5, .5, .4, .03, 0xffffff, c1, 0, 1.5); break;
        case 'earth': this.P(true, px, y, pz, 0, 3 + Math.random() * 4, 0, .8, .4, .05, c0, c1, 4, .2); break;
        default: this.P(true, px, y, pz, Math.cos(a) * 4, Math.random() * 4, Math.sin(a) * 4, .4, .4, .05, c0, c1, 0, 1);
      }
    }
    if (e === 'lightning') for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, d = r * (.4 + Math.random() * .6); V.set(x + Math.cos(a) * d, y + 6, z + Math.sin(a) * d); V2.set(x + Math.cos(a) * d, 0, z + Math.sin(a) * d); this.bolt(V.clone(), V2.clone(), i % 2 ? c1 : 0xffffff, .12, .3, 1); }
  }
  slam(e: Elem, pos: THREE.Vector3, r: number, big = false) {
    const [, c1] = ELEM_COLORS[e], x = pos.x, z = pos.z;
    this.fx('disc', { pos: [x, .04, z], s0: r * .4, s1: r * 1.1, color: e === 'earth' ? 0xffd070 : c1, dur: 2.4, tex: this.tex.crack, op: .9, pw: 1, ease: 'out' });
    this.fx('ring', { pos: [x, .1, z], s0: .5, s1: r * 1.4, color: 0xffffff, dur: .4, op: .8 });
    this.fx('ring', { pos: [x, .12, z], s0: .5, s1: r * 1.0, color: c1, dur: .55, op: .9 });
    this.slamDust(x, z, r * .6, e === 'ice' ? 0xaabbcc : 0x8a7860);
    this.chunks(x, .3, z, big ? 22 : 12, 5 + r * .7, e === 'ice' ? 0xbff4ff : e === 'fire' ? 0x3a2a28 : 0x7a7060, .22 + r * .02);
    this.burst(e, pos, r * .8, big);
  }
  pillar(e: Elem, pos: THREE.Vector3, r: number) {
    const [c0, c1] = ELEM_COLORS[e];
    this.fx('beam', { pos: [pos.x, 0, pos.z], s0: [r * .5, 14, r * .5], s1: [r * .3, 20, r * .3], color: c1, dur: .6, op: .8 });
    this.fx('beam', { pos: [pos.x, 0, pos.z], s0: [r * .25, 12, r * .25], s1: [r * .12, 22, r * .12], color: c0, dur: .45, op: .9 });
    this.fx('ring', { pos: [pos.x, .1, pos.z], s0: .5, s1: r, color: c1, dur: .4 }); this.light1(pos, c1, 8, .4);
    for (let i = 0; i < this.cnt(30); i++) { const a = Math.random() * 6.28, d = Math.random() * r * .35; this.P(true, pos.x + Math.cos(a) * d, .2, pos.z + Math.sin(a) * d, 0, 6 + Math.random() * 12, 0, 1, 1, .1, c0, c1, 0, .3); }
  }
  crystals(pos: THREE.Vector3, r: number, e: Elem = 'ice') {
    const c = ELEM_COLORS[e][1], n = this.cnt(Math.min(18, 6 + r * 1.6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + Math.random() * .3, d = r * (.35 + Math.random() * .65), h = 1.2 + Math.random() * 2.6;
      this.delay(Math.random() * .12, () => this.fx('crystal', { pos: [pos.x + Math.cos(a) * d, 0, pos.z + Math.sin(a) * d], s0: [.2, .1, .2], s1: [.55 + Math.random() * .4, h, .55 + Math.random() * .4], color: c, dur: 1.5 + Math.random() * .8, rot: [(Math.random() - .5) * .5, 0, (Math.random() - .5) * .5] }));
    }
    this.fx('ring', { pos: [pos.x, .1, pos.z], s0: .4, s1: r * 1.2, color: c, dur: .5 }); this.fx('disc', { pos: [pos.x, .03, pos.z], s0: r * .8, s1: r, color: c, dur: 2.2, tex: this.tex.rune, op: .6, spin: 0.5, pw: 1 });
    this.chunks(pos.x, .5, pos.z, 10, 5, 0xbff4ff, .12); this.light1(pos, c, 5, .4);
    for (let i = 0; i < this.cnt(24); i++) { const a = Math.random() * 6.28, d = Math.random() * r; this.P(true, pos.x + Math.cos(a) * d, .2, pos.z + Math.sin(a) * d, 0, 2 + Math.random() * 3, 0, 1.2, .35, .05, 0xffffff, c, 1, .5); }
  }
  rift(pos: THREE.Vector3, hex: number, size = 2, dur = .8) {
    this.fx('disc', { pos: [pos.x, 1.5 * size / 2 + .2, pos.z], s0: .2, s1: size, color: hex, dur, tex: this.tex.rune, rot: [Math.PI / 2, 0, 0], op: .95, spin: 3, pw: 1 });
    this.fx('flare', { pos: [pos.x, 1.4, pos.z], s0: .5, s1: size * 2.2, color: hex, dur: dur * .6 });
    this.fx('ring', { pos: [pos.x, .1, pos.z], s0: .3, s1: size * 1.5, color: hex, dur: .5 }); this.light1(pos, hex, 5, .5);
    for (let i = 0; i < this.cnt(24); i++) { const a = Math.random() * 6.28; this.P(true, pos.x + Math.cos(a) * size, 1.4 + Math.sin(a) * size, pos.z, -Math.cos(a) * 3, -Math.sin(a) * 3, 0, .6, .5, .05, 0xffffff, hex); }
  }
  lightning(pos: THREE.Vector3, e: Elem = 'lightning', r = 2) {
    const c1 = ELEM_COLORS[e][1]; const top = new THREE.Vector3(pos.x + (Math.random() - .5) * 3, 24, pos.z + (Math.random() - .5) * 3), bot = new THREE.Vector3(pos.x, 0, pos.z);
    this.bolt(top, bot, c1, .5, .35, 2.2); this.bolt(top, bot, 0xffffff, .16, .3, 1.6);
    this.fx('flare', { pos: [pos.x, .8, pos.z], s0: 1, s1: r * 2.5, color: c1, dur: .3 }); this.fx('ring', { pos: [pos.x, .1, pos.z], s0: .3, s1: r * 1.3, color: c1, dur: .4 });
    this.fx('disc', { pos: [pos.x, .03, pos.z], s0: r * .6, s1: r * .8, color: 0xffffff, dur: 1.6, tex: this.tex.crack, op: .5, pw: 1 });
    this.light1(pos, c1, 14, .25); this.elemSpray('lightning', pos.x, .3, pos.z, r, .6);
  }
  telegraph(pos: THREE.Vector3 | number[], r: number, dur: number, hex = 0xff2a2a) {
    const q = xyz(pos); const x = q[0], z = q[2];
    this.fx('disc', { pos: [x, .06, z], s0: r, s1: r, color: hex, dur, op: .35, pw: .3, ease: 'lin', flicker: true });
    this.fx('disc', { pos: [x, .07, z], s0: .2, s1: r, color: hex, dur, op: .55, pw: .2, ease: 'in' });
    this.fx('ring', { pos: [x, .08, z], s0: r, s1: r, color: hex, dur, op: .9, pw: .2, ease: 'lin' });
  }
  /** weapon-themed ambient emitters. active = swinging */
  ambient(e: Elem, base: THREE.Vector3, tip: THREE.Vector3, dt: number, awk: boolean, active: boolean, awake = 1) {
    const [c0, c1] = ELEM_COLORS[e]; const rate = (active ? 1.8 : 1) * (awk ? 1.8 : 1) * this.density * awake * dt * 60;
    let n = Math.floor(rate * .5 + Math.random()); if (n <= 0) return;
    n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const t = Math.random(); V.lerpVectors(base, tip, t);
      switch (e) {
        case 'fire': this.P(true, V.x, V.y, V.z, (Math.random() - .5) * .8, 1.2 + Math.random() * 1.8, (Math.random() - .5) * .8, .5 + Math.random() * .4, .32, .05, c0, c1, -1, .5); if (Math.random() < .12) this.P(false, V.x, V.y, V.z, 0, 1, 0, 1.1, .3, .9, 0x2a1008, 0x080404, -.5, .5, .5); break;
        case 'lightning': if (Math.random() < .18) { const a = V.clone(), b = V.clone(); b.x += (Math.random() - .5) * 1.2; b.y += (Math.random() - .5) * 1.2; b.z += (Math.random() - .5) * 1.2; this.bolt(a, b, c1, .025, .1, .2); } this.P(true, V.x, V.y, V.z, (Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2, .25, .15, .02, 0xffffff, c1); break;
        case 'void': { const a = Math.random() * 6.28; this.P(true, V.x + Math.cos(a) * .35, V.y, V.z + Math.sin(a) * .35, -Math.cos(a) * .6, .3, -Math.sin(a) * .6, .7, .22, .02, c0, c1); break; }
        case 'ice': this.P(true, V.x, V.y, V.z, (Math.random() - .5) * .6, -.4, (Math.random() - .5) * .6, .9, .14, .03, 0xffffff, c1, 0, .3); break;
        case 'plasma': this.P(true, V.x, V.y, V.z, (Math.random() - .5) * 1.4, (Math.random() - .5) * 1.4, (Math.random() - .5) * 1.4, .4, .14, .02, 0xffffff, c1); break;
        case 'earth': this.P(true, V.x, V.y, V.z, (Math.random() - .5) * .8, .8 + Math.random() * .8, (Math.random() - .5) * .8, .8, .16, .02, c0, c1, 0, .4); break;
      }
    }
  }
  ult(e: Elem, pos: THREE.Vector3, r: number) {
    const [c0, c1] = ELEM_COLORS[e], x = pos.x, z = pos.z;
    this.fx('ring', { pos: [x, .12, z], s0: 1, s1: r * 1.5, color: c1, dur: .9, op: 1 });
    this.fx('ring', { pos: [x, .2, z], s0: 1, s1: r * 1.1, color: 0xffffff, dur: .6, op: 1 });
    this.fx('dome', { pos: [x, 0, z], s0: 1, s1: r, color: c1, dur: .8, op: .5 });
    this.fx('flare', { pos: [x, 3, z], s0: 2, s1: r * 1.4, color: c1, dur: .6 });
    this.light1([x, 3, z], c1, 18, 1.1);
    this.slam(e, pos, r * .7, true);
    const n = e === 'fire' ? 14 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28, d = r * (.4 + .5 * ((i * 5) % 3) / 2), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      this.delay(.05 + i * .045, () => {
        if (e === 'lightning') this.lightning(V.set(px, 0, pz).clone(), e, 2.4);
        else if (e === 'ice') this.crystals(V.set(px, 0, pz).clone(), 3.2, e);
        else if (e === 'void') this.rift(V.set(px, 0, pz).clone(), c1, 1.6, .7);
        else if (e === 'plasma') { this.fx('flare', { pos: [px, 1.2, pz], s0: [.4, .05, 1], s1: [r * .9, .3, 1], color: 0xffffff, dur: .45, roll: a }); this.fx('ring', { pos: [px, .1, pz], s0: .3, s1: 3, color: c1, dur: .4 }); }
        else { this.pillar(e, V.set(px, 0, pz).clone(), e === 'earth' ? 3 : 2.6); if (e === 'earth') this.slam(e, V.clone(), 3.5); }
      });
    }
    for (let i = 0; i < this.cnt(70); i++) { const a = Math.random() * 6.28, d = Math.random() * r; this.P(true, x + Math.cos(a) * d, 8 + Math.random() * 6, z + Math.sin(a) * d, 0, e === 'fire' || e === 'earth' ? -1 : -3 - Math.random() * 3, 0, 1.6, .5, .1, c0, c1, e === 'ice' ? 0 : 2, .2); }
  }
}
export const vfx = new VfxEngine();
export { crescent };
export { glowTex };
