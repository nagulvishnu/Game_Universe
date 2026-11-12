import * as THREE from 'three';
import type { Game } from './engine';
import { uniforms } from './shared';
import { P, CITY_R, AIRPORT, ISLANDS, zoneAt } from './terrain';
import { SCATTER_GEO, SCATTER_INFO } from './models';
import { clamp, rand, randInt, pick, smoothstep, fbm } from './noise';

const M4 = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), V3 = new THREE.Vector3(), V3b = new THREE.Vector3();
const SC = new THREE.Vector3();
const COL = new THREE.Color();

// ---------- Instanced pool ----------
export class Pool {
  mesh: THREE.InstancedMesh;
  n = 0;
  dirty = false; dirtyC = false;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, public cap: number, shadow = true) {
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.count = 0; this.mesh.castShadow = shadow; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < cap; i++) this.mesh.setColorAt(i, c);
    parent.add(this.mesh);
  }
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.Color): number {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    this.mesh.count = this.n;
    this.set(i, x, y, z, sx, sy, sz);
    this.mesh.setColorAt(i, color); this.dirtyC = true;
    return i;
  }
  set(i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    M4.compose(V3.set(x, y, z), Q0, SC.set(sx, sy, sz));
    this.mesh.setMatrixAt(i, M4); this.dirty = true;
  }
  hide(i: number) { this.set(i, 0, 0, 0, 0, 0, 0); }
  truncate(n: number) { for (let i = n; i < this.n; i++) this.hide(i); this.n = n; this.mesh.count = n; this.dirty = true; }
  flush() {
    if (this.dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.dirty = false; }
    if (this.dirtyC && this.mesh.instanceColor) { this.mesh.instanceColor.needsUpdate = true; this.dirtyC = false; }
  }
}

// ---------- types ----------
export interface Seg { cx: number; cy: number; cz: number; sx: number; sy: number; sz: number; idx: number; pool: Pool; alive: boolean; shown: boolean; support: number[]; children: number[]; color: THREE.Color; solid: boolean }
export interface Extra { pool: Pool; idx: number; seg: number; x: number; y: number; z: number; sx: number; sy: number; sz: number }
export interface Building {
  id: number; kind: string; x: number; z: number; baseY: number; seg: Seg[]; extras: Extra[];
  minX: number; maxX: number; minZ: number; maxZ: number; topY: number; dead: boolean; destroyedAt: number; created: boolean;
  growT: number; revealed: number; growing: boolean; fixedExtras: boolean;
}
interface Def { cx: number; cy: number; cz: number; sx: number; sy: number; sz: number; support: number[]; solid: boolean; color?: number }
interface XDef { type: 'roof' | 'box' | 'spire'; x: number; y: number; z: number; sx: number; sy: number; sz: number; seg: number; color: number }

const FACADES = [0xb9c4cf, 0x8fa3b5, 0xd8d2c4, 0x6f7f90, 0xc6b8a0, 0xa8b4a8, 0x59687a, 0xe2e2e6];
const HOUSE_COLORS = [0xf2e6d0, 0xd9c7a0, 0xc9d6e2, 0xe8c9c0, 0xbcd4bc, 0xf5f0e8, 0xd8b8a0];
const ROOF_COLORS = [0x8a3a2a, 0x5a4a44, 0x3a3f4a, 0x7a4a2a];
const STONE = 0xa8a49a;

function patchWindows(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uNight = uniforms.night;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 iwp = vec4(transformed,1.0);
#ifdef USE_INSTANCING
iwp = instanceMatrix * iwp;
#endif
vWP = (modelMatrix*iwp).xyz; vWN = normalize(objectNormal);`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN; uniform float uNight;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 an = abs(vWN);
float uu = an.x > an.z ? vWP.z : vWP.x;
vec2 wc = vec2(uu/3.4, vWP.y/3.8);
vec2 wf = fract(wc); vec2 wid = floor(wc);
float wmask = step(0.2,wf.x)*step(wf.x,0.8)*step(0.22,wf.y)*step(wf.y,0.8)*(1.0-step(0.6,an.y));
float wr = h21(wid + floor(vWP.xz*0.17));
float lit = step(0.5, wr) * uNight;
vec3 glass = mix(vec3(0.05,0.09,0.13), vec3(0.3,0.44,0.58), wr*0.6);
diffuseColor.rgb = mix(diffuseColor.rgb, glass, wmask);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, wmask);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.7, wmask);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0,0.8,0.48)*wmask*lit*1.7;');
  };
}
function patchSolid(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 iwp = vec4(transformed,1.0);
#ifdef USE_INSTANCING
iwp = instanceMatrix * iwp;
#endif
vWP = (modelMatrix*iwp).xyz;`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float bn = vn(vec2(vWP.x+vWP.z, vWP.y)*1.3)*0.6 + vn(vec2(vWP.x+vWP.z, vWP.y)*5.0)*0.4;
float brick = step(0.04, fract(vWP.y*0.8)) * step(0.03, fract((vWP.x+vWP.z)*0.5 + floor(vWP.y*0.8)*0.5));
diffuseColor.rgb *= (0.75+0.4*bn) * (0.88+0.12*brick);`);
  };
}

// ---------- roads textures ----------
function roadTexture(kind: 'street' | 'highway' | 'runway'): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = kind === 'runway' ? '#2c2e32' : '#303236'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 2500; i++) { const v = 40 + Math.random() * 30; g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
  g.fillStyle = '#e8e8e8';
  g.fillRect(4, 0, 3, 256); g.fillRect(121, 0, 3, 256);
  if (kind === 'street') { for (let y = 0; y < 256; y += 64) g.fillRect(62, y, 4, 36); }
  else if (kind === 'highway') {
    g.fillStyle = '#f0c030'; g.fillRect(60, 0, 3, 256); g.fillRect(65, 0, 3, 256);
    g.fillStyle = '#e8e8e8'; for (let y = 0; y < 256; y += 64) { g.fillRect(31, y, 3, 36); g.fillRect(94, y, 3, 36); }
  } else { g.fillStyle = '#f2f2f2'; for (let y = 0; y < 256; y += 128) g.fillRect(60, y + 10, 8, 80); for (let y = 0; y < 256; y += 16) { g.fillRect(14, y, 6, 10); g.fillRect(108, y, 6, 10); } }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Scatter (trees, rocks, etc.) ----------
interface SItem { kind: string; x: number; y: number; z: number; s: number; rot: number; alive: boolean; ch: SChunk; idx: number; glow: number; tint: THREE.Color }
interface SChunk { mesh: THREE.InstancedMesh; n: number; cap: number; dirty: boolean; dirtyC: boolean }
const CH = 600;

export class Scatter {
  chunks = new Map<string, SChunk>();
  items: SItem[] = [];
  grid = new Map<number, SItem[]>();
  geos: Record<string, THREE.BufferGeometry> = {};
  mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 });
  pending: [string, number, number, number, number, number][] = [];
  glowAttr!: THREE.BufferAttribute; glowN = 0; glow!: THREE.Points; glowMat!: THREE.ShaderMaterial;
  removed = 0;
  constructor(public game: Game, public root: THREE.Group) {
    const cap = 2200;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(cap), 1));
    this.glowAttr = g.attributes.size as THREE.BufferAttribute;
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: { uNight: uniforms.night, uScale: { value: 800 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float size; uniform float uScale; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=min(size*uScale/max(0.1,-mv.z),120.0); }',
      fragmentShader: 'uniform float uNight; void main(){ float d=length(gl_PointCoord-0.5)*2.0; if(d>1.0||uNight<0.02) discard; float a=pow(1.0-d,2.0)*uNight; gl_FragColor=vec4(1.0,0.78,0.45,a); }',
    });
    this.glow = new THREE.Points(g, this.glowMat); this.glow.frustumCulled = false; this.glow.renderOrder = 5; root.add(this.glow);
  }
  geo(kind: string) { return this.geos[kind] ?? (this.geos[kind] = SCATTER_GEO[kind]()); }
  key(x: number, y: number, z: number) { return `${Math.floor(x / CH)}|${Math.floor(z / CH)}|${Math.floor(y / 800)}`; }
  cellKey(x: number, z: number) { return Math.floor(x / 60) * 4096 + Math.floor(z / 60); }
  makeChunk(kind: string, x: number, y: number, z: number, cap: number): SChunk {
    const mesh = new THREE.InstancedMesh(this.geo(kind), this.mat, cap);
    mesh.count = 0; mesh.frustumCulled = true; mesh.castShadow = kind === 'lamp' || kind === 'rock'; mesh.receiveShadow = true;
    const c = new THREE.Color(1, 1, 1); for (let i = 0; i < cap; i++) mesh.setColorAt(i, c);
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3((Math.floor(x / CH) + 0.5) * CH, Math.floor(y / 800) * 800 + 400, (Math.floor(z / CH) + 0.5) * CH), 700);
    this.root.add(mesh);
    const ch: SChunk = { mesh, n: 0, cap, dirty: false, dirtyC: false };
    this.chunks.set(kind + '|' + this.key(x, y, z), ch);
    return ch;
  }
  queue(kind: string, x: number, y: number, z: number, s: number, rot: number) { this.pending.push([kind, x, y, z, s, rot]); }
  flushPending() {
    const counts = new Map<string, number>();
    for (const [k, x, y, z] of this.pending) { const key = k + '|' + this.key(x, y, z); counts.set(key, (counts.get(key) ?? 0) + 1); }
    for (const [k, x, y, z, s, r] of this.pending) {
      const key = k + '|' + this.key(x, y, z);
      if (!this.chunks.has(key)) this.makeChunk(k, x, y, z, Math.ceil(counts.get(key)! * 1.4) + 24);
      this.add(k, x, y, z, s, r);
    }
    this.pending.length = 0;
  }
  add(kind: string, x: number, y: number, z: number, s: number, rot: number, tint?: THREE.Color): SItem | null {
    const key = kind + '|' + this.key(x, y, z);
    let ch = this.chunks.get(key);
    if (!ch) ch = this.makeChunk(kind, x, y, z, 80);
    if (ch.n >= ch.cap) return null;
    const it: SItem = { kind, x, y, z, s, rot, alive: true, ch, idx: ch.n++, glow: -1, tint: tint ?? new THREE.Color().setHSL(0, 0, 0.85 + Math.random() * 0.3) };
    ch.mesh.count = ch.n;
    this.write(it); ch.mesh.setColorAt(it.idx, it.tint); ch.dirtyC = true;
    this.items.push(it);
    const ck = this.cellKey(x, z); let a = this.grid.get(ck); if (!a) this.grid.set(ck, (a = [])); a.push(it);
    if (kind === 'lamp' && this.glowN < 2200) {
      const lp = this.glow.geometry.attributes.position as THREE.BufferAttribute;
      const dx = Math.cos(rot) * 1.8, dz = -Math.sin(rot) * 1.8;
      lp.setXYZ(this.glowN, x + dx, y + 7.2, z + dz); this.glowAttr.setX(this.glowN, 6); it.glow = this.glowN++;
      lp.needsUpdate = true; this.glowAttr.needsUpdate = true;
    }
    return it;
  }
  write(it: SItem, scale = it.s) {
    M4.compose(V3.set(it.x, it.y, it.z), Q0.setFromAxisAngle(V3b.set(0, 1, 0), it.rot), SC.set(scale, scale, scale));
    it.ch.mesh.setMatrixAt(it.idx, M4); it.ch.dirty = true;
  }
  kill(it: SItem, fx: boolean, burn = false) {
    if (!it.alive) return;
    it.alive = false; this.write(it, 0);
    if (it.glow >= 0) { this.glowAttr.setX(it.glow, 0); this.glowAttr.needsUpdate = true; }
    this.removed++;
    const info = SCATTER_INFO[it.kind];
    if (fx) {
      const g = this.game;
      for (let i = 0; i < 3; i++) g.debris.spawn(it.x + rand(-1, 1), it.y + rand(0.5, info.h * it.s * 0.8), it.z + rand(-1, 1), rand(0.4, 1.2), rand(0.4, 1.4), rand(0.4, 1.2), info.debris, rand(-4, 4), rand(2, 9), rand(-4, 4));
      if (burn) g.fx.fire(V3.set(it.x, it.y, it.z), 1.4 + info.h * it.s * 0.08, 8 + Math.random() * 6);
    }
    this.game.logUndo(() => this.restore(it));
  }
  restore(it: SItem) {
    if (it.alive) return;
    it.alive = true; this.write(it);
    if (it.glow >= 0) { this.glowAttr.setX(it.glow, 6); this.glowAttr.needsUpdate = true; }
    this.removed--;
  }
  damageSphere(p: THREE.Vector3, r: number, burn = false, kinds?: string[]): number {
    let n = 0;
    const x0 = Math.floor((p.x - r - 6) / 60), x1 = Math.floor((p.x + r + 6) / 60), z0 = Math.floor((p.z - r - 6) / 60), z1 = Math.floor((p.z + r + 6) / 60);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const a = this.grid.get(cx * 4096 + cz); if (!a) continue;
      for (const it of a) {
        if (!it.alive || (kinds && !kinds.includes(it.kind))) continue;
        const info = SCATTER_INFO[it.kind];
        const cy = clamp(p.y, it.y, it.y + info.h * it.s);
        const d = Math.hypot(it.x - p.x, it.z - p.z, p.y - cy) - info.r * it.s * 0.5;
        if (d < r) { this.kill(it, true, burn); n++; }
      }
    }
    return n;
  }
  damageBand(cx: number, cz: number, rIn: number, rOut: number): number {
    let n = 0;
    for (const it of this.items) {
      if (!it.alive || it.y > 1500) continue;
      const d = Math.hypot(it.x - cx, it.z - cz);
      if (d >= rIn && d < rOut) { this.kill(it, Math.random() < 0.3); n++; }
    }
    return n;
  }
  reseat(x: number, z: number, r: number) {
    const T = this.game.terrain;
    for (let cx = Math.floor((x - r) / 60); cx <= Math.floor((x + r) / 60); cx++) for (let cz = Math.floor((z - r) / 60); cz <= Math.floor((z + r) / 60); cz++) {
      const a = this.grid.get(cx * 4096 + cz); if (!a) continue;
      for (const it of a) {
        if (it.y > 1500 || Math.hypot(it.x - x, it.z - z) > r) continue;
        const h = T.heightAt(it.x, it.z);
        if (Math.abs(h - it.y) > 0.2) {
          if (it.kind !== 'coral' && it.kind !== 'kelp' && it.alive && Math.abs(h - it.y) > 6) { this.kill(it, true); }
          it.y = h; if (it.alive) this.write(it);
        }
      }
    }
  }
  restoreAll() { for (const it of this.items) { if (!it.alive) this.restore(it); } }
  flush() { for (const c of this.chunks.values()) { if (c.dirty) { c.mesh.instanceMatrix.needsUpdate = true; c.dirty = false; } if (c.dirtyC && c.mesh.instanceColor) { c.mesh.instanceColor.needsUpdate = true; c.dirtyC = false; } } }
  nearest(x: number, z: number, r: number): SItem | null {
    let best: SItem | null = null, bd = r;
    for (const it of this.items) { if (!it.alive) continue; const d = Math.hypot(it.x - x, it.z - z); if (d < bd) { bd = d; best = it; } }
    return best;
  }
  plantForest(x: number, z: number, r: number, n: number) {
    const T = this.game.terrain;
    let c = 0;
    for (let i = 0; i < n * 2 && c < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, h = T.heightAt(px, pz);
      if (h < 1 || this.game.city.pointInside(px, h + 2, pz, 3)) continue;
      const k = h > 60 ? 'pine' : pick(['pine', 'oak', 'oak']);
      if (this.add(k, px, h, pz, rand(0.8, 1.5), rand(0, 6.28))) c++;
    }
  }
}

// ---------- City ----------
export class City {
  root = new THREE.Group();
  glass: Pool; solid: Pool; roofs: Pool; boxes: Pool; spires: Pool; slabs: Pool;
  buildings: Building[] = [];
  grid = new Map<number, Building[]>();
  growing: Building[] = [];
  scatter: Scatter;
  spots = { home: [] as THREE.Vector3[], work: [] as THREE.Vector3[], park: [] as THREE.Vector3[] };
  villages: { x: number; z: number }[] = [];
  baseCounts = { glass: 0, solid: 0, roofs: 0, boxes: 0, spires: 0 };
  baseBuildings = 0;
  nextId = 1;
  repairT = 0;
  destroyedCount = 0;

  constructor(public game: Game) {
    game.scene.add(this.root);
    const gm = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.06 }); patchWindows(gm);
    const sm = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 }); patchSolid(sm);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const boxUp = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.glass = new Pool(this.root, box, gm, 7000);
    this.solid = new Pool(this.root, box, sm, 3000);
    this.roofs = new Pool(this.root, new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 900);
    this.boxes = new Pool(this.root, boxUp, new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2, color: 0x8a8d92 }), 1500);
    this.spires = new Pool(this.root, new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.7, color: 0xcfd3d8 }), 700);
    this.slabs = new Pool(this.root, boxUp, new THREE.MeshStandardMaterial({ roughness: 0.95 }), 400, false);
    this.scatter = new Scatter(game, this.root);
  }

  // ---- grid helpers ----
  private cells(minX: number, maxX: number, minZ: number, maxZ: number, fn: (k: number) => void) {
    for (let cx = Math.floor(minX / 40); cx <= Math.floor(maxX / 40); cx++) for (let cz = Math.floor(minZ / 40); cz <= Math.floor(maxZ / 40); cz++) fn(cx * 4096 + cz);
  }
  private register(b: Building) { this.cells(b.minX - 2, b.maxX + 2, b.minZ - 2, b.maxZ + 2, (k) => { let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(b); }); }
  private unregister(b: Building) { this.cells(b.minX - 2, b.maxX + 2, b.minZ - 2, b.maxZ + 2, (k) => { const a = this.grid.get(k); if (a) { const i = a.indexOf(b); if (i >= 0) a.splice(i, 1); } }); }

  // ---- definitions ----
  private defs(kind: string, w: number, d: number, h: number, color: number, along: 'x' | 'z'): { defs: Def[]; xs: XDef[] } {
    const defs: Def[] = [], xs: XDef[] = [];
    const stack = (sw: number, sd: number, segH: number, n: number, y0: number, first: number[], solid = false, col?: number, taper?: (f: number) => number) => {
      let prev = first, y = y0;
      for (let i = 0; i < n; i++) {
        const k = taper ? taper(i / n) : 1;
        defs.push({ cx: 0, cy: y + segH / 2, cz: 0, sx: sw * k, sy: segH, sz: sd * k, support: prev, solid, color: col });
        prev = [defs.length - 1]; y += segH;
      }
      return y;
    };
    switch (kind) {
      case 'house': {
        defs.push({ cx: 0, cy: h / 2, cz: 0, sx: w, sy: h, sz: d, support: [-1], solid: false });
        xs.push({ type: 'roof', x: 0, y: h, z: 0, sx: w * 1.14, sy: rand(2.6, 3.6), sz: d * 1.14, seg: 0, color: pick(ROOF_COLORS) });
        break;
      }
      case 'apartments': { const n = randInt(3, 5); const top = stack(w, d, 6.4, n, 0, [-1]); xs.push({ type: 'box', x: 0, y: top, z: 0, sx: w * 0.3, sy: 2.4, sz: d * 0.3, seg: n - 1, color: 0x888b90 }); break; }
      case 'office': {
        const n = Math.max(2, Math.ceil(h / 7)); const top = stack(w, d, 7, n, 0, [-1]);
        xs.push({ type: 'box', x: 0, y: top, z: 0, sx: w * 0.35, sy: 3, sz: d * 0.35, seg: n - 1, color: 0x888b90 });
        if (Math.random() < 0.4) xs.push({ type: 'spire', x: 0, y: top + 3, z: 0, sx: 0.5, sy: rand(8, 18), sz: 0.5, seg: n - 1, color: 0xcccccc });
        break;
      }
      case 'skyscraper': {
        defs.push({ cx: 0, cy: 4.5, cz: 0, sx: w * 1.25, sy: 9, sz: d * 1.25, support: [-1], solid: false });
        const n = Math.max(6, Math.ceil(h / 8));
        const top = stack(w, d, 8, n, 9, [0], false, undefined, (f) => (f < 0.62 ? 1 : f < 0.85 ? 0.8 : 0.58));
        xs.push({ type: 'box', x: 0, y: top, z: 0, sx: w * 0.3, sy: 4, sz: d * 0.3, seg: n, color: 0x777a80 });
        xs.push({ type: 'spire', x: 0, y: top + 4, z: 0, sx: 0.7, sy: rand(14, 34), sz: 0.7, seg: n, color: 0xdddddd });
        break;
      }
      case 'tower': {
        const top = stack(8, 8, 10, 4, 0, [-1], false);
        defs.push({ cx: 0, cy: top + 3, cz: 0, sx: 15, sy: 6, sz: 15, support: [3], solid: false });
        xs.push({ type: 'spire', x: 0, y: top + 6, z: 0, sx: 0.5, sy: 10, sz: 0.5, seg: 4, color: 0xdd3333 });
        break;
      }
      case 'pyramid': {
        const n = 16; let prev = [-1];
        for (let i = 0; i < n; i++) { const s = w * (1 - i / (n + 1)); defs.push({ cx: 0, cy: i * 4.4 + 2.2, cz: 0, sx: s, sy: 4.4, sz: s, support: prev, solid: true, color: 0xd9bd82 }); prev = [i]; }
        break;
      }
      case 'castle': {
        const col = STONE;
        stack(22, 22, 8, 3, 0, [-1], true, col);
        const tIdx: number[] = [];
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          let prev = [-1]; const first = defs.length;
          for (let i = 0; i < 4; i++) { defs.push({ cx: sx * 24, cy: i * 7 + 3.5, cz: sz * 24, sx: 9, sy: 7, sz: 9, support: prev, solid: true, color: col }); prev = [defs.length - 1]; }
          tIdx.push(first + 3);
          xs.push({ type: 'roof', x: sx * 24, y: 28, z: sz * 24, sx: 11, sy: 9, sz: 11, seg: first + 3, color: 0x3a5a9a });
        }
        defs.push({ cx: 0, cy: 4.5, cz: -24, sx: 39, sy: 9, sz: 3, support: [-1], solid: true, color: col });
        defs.push({ cx: 0, cy: 4.5, cz: 24, sx: 39, sy: 9, sz: 3, support: [-1], solid: true, color: col });
        defs.push({ cx: -24, cy: 4.5, cz: 0, sx: 3, sy: 9, sz: 39, support: [-1], solid: true, color: col });
        defs.push({ cx: 24, cy: 4.5, cz: 0, sx: 3, sy: 9, sz: 39, support: [-1], solid: true, color: col });
        xs.push({ type: 'roof', x: 0, y: 24, z: 0, sx: 24, sy: 10, sz: 24, seg: 2, color: 0x8a2a2a });
        break;
      }
      case 'obelisk': {
        const n = 12, sh = h / n; let prev = [-1];
        for (let i = 0; i < n; i++) { const s = w * (1 - 0.45 * (i / n)); defs.push({ cx: 0, cy: i * sh + sh / 2, cz: 0, sx: s, sy: sh, sz: s, support: prev, solid: true, color }); prev = [i]; }
        xs.push({ type: 'roof', x: 0, y: h, z: 0, sx: w * 0.55, sy: w * 0.9, sz: w * 0.55, seg: n - 1, color: 0xe8c040 });
        break;
      }
      case 'wall': {
        for (let i = 0; i < 9; i++) defs.push({ cx: (i - 4) * 8, cy: 5, cz: 0, sx: 8, sy: 10, sz: 3.2, support: [-1], solid: true, color: 0xb8aa90 });
        break;
      }
      case 'arch': {
        defs.push({ cx: -13, cy: 11, cz: 0, sx: 4.5, sy: 22, sz: 6, support: [-1], solid: true, color: 0xe8e2d0 });
        defs.push({ cx: 13, cy: 11, cz: 0, sx: 4.5, sy: 22, sz: 6, support: [-1], solid: true, color: 0xe8e2d0 });
        defs.push({ cx: 0, cy: 24.5, cz: 0, sx: 31, sy: 5, sz: 7, support: [0, 1], solid: true, color: 0xe8e2d0 });
        break;
      }
      case 'temple': {
        defs.push({ cx: 0, cy: 0.7, cz: 0, sx: 44, sy: 1.4, sz: 30, support: [-1], solid: true, color: 0xf0ece0 });
        defs.push({ cx: 0, cy: 2.1, cz: 0, sx: 40, sy: 1.4, sz: 26, support: [0], solid: true, color: 0xf0ece0 });
        const cols: number[] = [];
        for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { defs.push({ cx: -15 + i * 10, cy: 2.8 + 6.5, cz: s * 10, sx: 2.4, sy: 13, sz: 2.4, support: [1], solid: true, color: 0xf4f0e6 }); cols.push(defs.length - 1); }
        defs.push({ cx: 0, cy: 15.8 + 1.1, cz: 0, sx: 42, sy: 2.2, sz: 28, support: cols, solid: true, color: 0xf0ece0 });
        xs.push({ type: 'roof', x: 0, y: 19.1, z: 0, sx: 42, sy: 6, sz: 28, seg: defs.length - 1, color: 0xc0583a });
        break;
      }
      case 'stairs': {
        for (let i = 0; i < 34; i++) defs.push({ cx: i * 3, cy: i * 1.8 + 0.5, cz: 0, sx: 3.2, sy: 1.0, sz: 10, support: [i - 1 < 0 ? -1 : i - 1], solid: true, color: i % 2 ? 0xfff4d0 : 0xf4f8ff });
        break;
      }
      default: defs.push({ cx: 0, cy: h / 2, cz: 0, sx: w, sy: h, sz: d, support: [-1], solid: false });
    }
    if (along === 'z') {
      for (const q of defs) { [q.cx, q.cz] = [q.cz, q.cx]; [q.sx, q.sz] = [q.sz, q.sx]; }
      for (const q of xs) { [q.x, q.z] = [q.z, q.x]; [q.sx, q.sz] = [q.sz, q.sx]; }
    }
    void color;
    return { defs, xs };
  }

  addBuilding(kind: string, x: number, z: number, o: { w?: number; d?: number; h?: number; color?: number; instant?: boolean; along?: 'x' | 'z'; flatten?: boolean; baseY?: number } = {}): Building | null {
    const g = this.game;
    const w = o.w ?? (kind === 'house' ? rand(11, 15) : kind === 'apartments' ? rand(20, 26) : kind === 'office' ? rand(26, 40) : kind === 'skyscraper' ? rand(28, 38) : kind === 'pyramid' ? 72 : kind === 'obelisk' ? 9 : 20);
    const d = o.d ?? (kind === 'house' ? rand(9, 13) : kind === 'apartments' ? rand(16, 20) : kind === 'office' ? rand(26, 40) : kind === 'skyscraper' ? w : w);
    const h = o.h ?? (kind === 'house' ? rand(5, 6.5) : kind === 'office' ? rand(25, 60) : kind === 'skyscraper' ? rand(90, 220) : kind === 'obelisk' ? 70 : 10);
    const color = o.color ?? (kind === 'house' ? pick(HOUSE_COLORS) : pick(FACADES));
    const { defs, xs } = this.defs(kind, w, d, h, color, o.along ?? 'x');
    const need = { g: 0, s: 0, r: 0, b: 0, p: 0 };
    for (const q of defs) q.solid ? need.s++ : need.g++;
    for (const q of xs) q.type === 'roof' ? need.r++ : q.type === 'box' ? need.b++ : need.p++;
    if (this.glass.n + need.g > this.glass.cap || this.solid.n + need.s > this.solid.cap || this.roofs.n + need.r > this.roofs.cap || this.boxes.n + need.b > this.boxes.cap || this.spires.n + need.p > this.spires.cap) return null;
    let baseY = o.baseY ?? g.terrain.heightAt(x, z);
    if (o.flatten) {
      const ex = Math.max(w, d, kind === 'castle' ? 60 : 0, kind === 'temple' ? 46 : 0);
      baseY = (g.terrain.heightAt(x, z) + g.terrain.heightAt(x + ex / 2, z) + g.terrain.heightAt(x - ex / 2, z) + g.terrain.heightAt(x, z + ex / 2) + g.terrain.heightAt(x, z - ex / 2)) / 5;
      baseY = Math.max(baseY, 1.2);
      g.terrain.flatten(x, z, ex * 0.8 + 10, baseY, 1);
    }
    const b: Building = { id: this.nextId++, kind, x, z, baseY, seg: [], extras: [], minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, topY: baseY, dead: false, destroyedAt: 0, created: !!o.flatten || !o.instant, growT: 0, revealed: 0, growing: false, fixedExtras: false };
    const grow = !o.instant;
    for (const q of defs) {
      const col = new THREE.Color(q.color ?? color);
      if (!q.solid) col.multiplyScalar(0.92 + Math.random() * 0.16);
      const pool = q.solid ? this.solid : this.glass;
      const wx = x + q.cx, wy = baseY + q.cy, wz = z + q.cz;
      const idx = pool.add(wx, wy, wz, grow ? 0 : q.sx, grow ? 0 : q.sy, grow ? 0 : q.sz, col);
      const seg: Seg & { orig: THREE.Color } = { cx: wx, cy: wy, cz: wz, sx: q.sx, sy: q.sy, sz: q.sz, idx, pool, alive: true, shown: !grow, support: q.support, children: [], color: col, solid: q.solid, orig: col.clone() };
      b.seg.push(seg);
      b.minX = Math.min(b.minX, wx - q.sx / 2); b.maxX = Math.max(b.maxX, wx + q.sx / 2); b.minZ = Math.min(b.minZ, wz - q.sz / 2); b.maxZ = Math.max(b.maxZ, wz + q.sz / 2);
      b.topY = Math.max(b.topY, wy + q.sy / 2);
    }
    b.seg.forEach((s, i) => s.support.forEach((p) => { if (p >= 0) b.seg[p].children.push(i); }));
    for (const q of xs) {
      const pool = q.type === 'roof' ? this.roofs : q.type === 'box' ? this.boxes : this.spires;
      const idx = pool.add(x + q.x, baseY + q.y, z + q.z, grow ? 0 : q.sx, grow ? 0 : q.sy, grow ? 0 : q.sz, new THREE.Color(q.color));
      b.extras.push({ pool, idx, seg: q.seg, x: x + q.x, y: baseY + q.y, z: z + q.z, sx: q.sx, sy: q.sy, sz: q.sz });
      b.topY = Math.max(b.topY, baseY + q.y + (q.type === 'spire' ? q.sy : 0));
    }
    b.fixedExtras = true;
    this.buildings.push(b); this.register(b);
    if (grow) { b.growing = true; this.growing.push(b); }
    return b;
  }

  private showSeg(s: Seg) { s.pool.set(s.idx, s.cx, s.cy, s.cz, s.sx, s.sy, s.sz); }
  private recalcTop(b: Building) {
    let t = b.baseY; for (const s of b.seg) if (s.alive && s.shown) t = Math.max(t, s.cy + s.sy / 2);
    for (const e of b.extras) if (b.seg[e.seg]?.alive) t = Math.max(t, e.y + e.sy);
    b.topY = t;
  }

  // ---- destruction ----
  destroySeg(b: Building, s0: Seg, center: THREE.Vector3, force: number, bulk = false): number {
    const g = this.game;
    let n = 0;
    const stack: Seg[] = [s0];
    const killed: Seg[] = [];
    while (stack.length) {
      const s = stack.pop()!;
      if (!s.alive) continue;
      s.alive = false; s.pool.hide(s.idx); n++; killed.push(s);
      const i = b.seg.indexOf(s);
      for (const c of s.children) stack.push(b.seg[c]);
      for (const e of b.extras) if (e.seg === i) e.pool.hide(e.idx);
    }
    const many = killed.length > 6;
    for (const s of killed) {
      const vol = s.sx * s.sy * s.sz;
      const k = many || bulk ? (vol > 4000 ? 2 : 1) : clamp(Math.round(vol / 90), 2, 6);
      for (let i = 0; i < k; i++) {
        const px = s.cx + rand(-0.4, 0.4) * s.sx, py = s.cy + rand(-0.4, 0.4) * s.sy, pz = s.cz + rand(-0.4, 0.4) * s.sz;
        const sz = clamp(Math.min(s.sx, s.sz) * rand(0.12, 0.3), 0.7, 4.5);
        V3.set(px - center.x, py - center.y, pz - center.z);
        const dist = V3.length() + 1; V3.divideScalar(dist);
        const sp = force * rand(0.4, 1) / (1 + dist * 0.04);
        g.debris.spawn(px, py, pz, sz * rand(0.7, 1.5), sz * rand(0.5, 1.2), sz * rand(0.7, 1.5), s.color, V3.x * sp + rand(-3, 3), V3.y * sp + rand(0, 6), V3.z * sp + rand(-3, 3));
      }
    }
    for (let i = 0; i < killed.length; i += many ? 4 : 1) { const s = killed[i]; g.fx.puff(V3.set(s.cx, s.cy, s.cz), Math.min(s.sx, s.sz) * 0.4, undefined, many ? 3 : 2); }
    this.recalcTop(b);
    b.destroyedAt = g.clock;
    g.logUndo(() => { for (const s of killed) { s.alive = true; if (s.shown) this.showSeg(s); } for (const e of b.extras) if (b.seg[e.seg].alive) e.pool.set(e.idx, e.x, e.y, e.z, e.sx, e.sy, e.sz); b.dead = false; this.recalcTop(b); });
    if (!b.dead && !b.seg.some((s) => s.alive)) {
      b.dead = true; this.destroyedCount++;
      const dd = g.camera.position.distanceTo(V3.set(b.x, b.baseY, b.z));
      g.audio.play('crumble', dd);
      g.shake(clamp(4 * (b.topY - b.baseY) / (dd + 50), 0, 1.2));
      g.fx.puff(V3.set(b.x, b.baseY + 3, b.z), Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.35, undefined, 14);
      if (force > 0 || Math.random() < 0.5) g.fx.fire(V3.set(b.x, b.baseY + 1, b.z), 2.5, 14 + Math.random() * 10);
      g.ents.alert(V3.set(b.x, b.baseY, b.z), 140, 'panic');
    }
    return n;
  }
  damageSphere(p: THREE.Vector3, r: number, force = 0, bulk = false): number {
    let n = 0;
    const seen = new Set<Building>();
    this.cells(p.x - r, p.x + r, p.z - r, p.z + r, (k) => {
      const a = this.grid.get(k); if (!a) return;
      for (const b of a) {
        if (seen.has(b) || b.dead) continue; seen.add(b);
        if (p.y > b.topY + r || p.y < b.baseY - r) continue;
        const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX), dz = Math.max(b.minZ - p.z, 0, p.z - b.maxZ);
        if (dx * dx + dz * dz > r * r) continue;
        const hit: Seg[] = [];
        for (const s of b.seg) {
          if (!s.alive || !s.shown) continue;
          const ddx = Math.max(Math.abs(p.x - s.cx) - s.sx / 2, 0), ddy = Math.max(Math.abs(p.y - s.cy) - s.sy / 2, 0), ddz = Math.max(Math.abs(p.z - s.cz) - s.sz / 2, 0);
          if (ddx * ddx + ddy * ddy + ddz * ddz < r * r) hit.push(s);
        }
        for (const s of hit) n += this.destroySeg(b, s, p, force, bulk);
      }
    });
    return n;
  }
  damageBand(cx: number, cz: number, rIn: number, rOut: number, maxY: number, force: number) {
    const c = V3b.set(cx, 0, cz);
    for (const b of this.buildings) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - cx, b.z - cz);
      if (d < rIn || d >= rOut) continue;
      for (const s of b.seg) if (s.alive && s.shown && s.cy - s.sy / 2 - b.baseY < maxY) this.destroySeg(b, s, c.set(cx, b.baseY, cz), force, true);
    }
  }
  nearestBuilding(x: number, z: number, r: number): Building | null {
    let best: Building | null = null, bd = r;
    for (const b of this.buildings) {
      if (b.dead) continue;
      const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ), d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  demolish(b: Building, center: THREE.Vector3, force = 6) {
    for (const s of b.seg) if (s.alive && s.shown) this.destroySeg(b, s, center, force);
  }
  aliveCount() { let n = 0; for (const b of this.buildings) if (!b.dead) n++; return n; }
  tintSphere(p: THREE.Vector3, r: number, color: THREE.Color, k: number) {
    const seen = new Set<Building>();
    this.cells(p.x - r, p.x + r, p.z - r, p.z + r, (c) => {
      const a = this.grid.get(c); if (!a) return;
      for (const b of a) {
        if (seen.has(b) || b.dead) continue; seen.add(b);
        for (const s of b.seg) {
          if (!s.alive || !s.shown) continue;
          const dx = Math.max(Math.abs(p.x - s.cx) - s.sx / 2, 0), dy = Math.max(Math.abs(p.y - s.cy) - s.sy / 2, 0), dz = Math.max(Math.abs(p.z - s.cz) - s.sz / 2, 0);
          if (dx * dx + dy * dy + dz * dz < r * r) { s.color.lerp(color, k); s.pool.mesh.setColorAt(s.idx, s.color); s.pool.dirtyC = true; }
        }
      }
    });
  }

  // ---- queries ----
  pointInside(x: number, y: number, z: number, pad = 0): boolean {
    const a = this.grid.get(Math.floor(x / 40) * 4096 + Math.floor(z / 40)); if (!a) return false;
    for (const b of a) {
      if (b.dead || y > b.topY + pad || y < b.baseY - pad || x < b.minX - pad || x > b.maxX + pad || z < b.minZ - pad || z > b.maxZ + pad) continue;
      for (const s of b.seg) if (s.alive && s.shown && Math.abs(x - s.cx) < s.sx / 2 + pad && Math.abs(y - s.cy) < s.sy / 2 + pad && Math.abs(z - s.cz) < s.sz / 2 + pad) return true;
    }
    return false;
  }
  /** top of structure under (x,z) that is at or below y+1.5 */
  heightAt(x: number, z: number, y: number): number {
    if (y > 700) return -1e9;
    const a = this.grid.get(Math.floor(x / 40) * 4096 + Math.floor(z / 40)); if (!a) return -1e9;
    let best = -1e9;
    for (const b of a) {
      if (b.dead || x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      for (const s of b.seg) {
        if (!s.alive || !s.shown || Math.abs(x - s.cx) > s.sx / 2 || Math.abs(z - s.cz) > s.sz / 2) continue;
        const top = s.cy + s.sy / 2;
        if (top <= y + 1.5 && top > best) best = top;
      }
    }
    return best;
  }

  // ---- update ----
  update(dt: number) {
    for (let gi = this.growing.length - 1; gi >= 0; gi--) {
      const b = this.growing[gi];
      b.growT += dt;
      const target = Math.floor(b.growT / 0.1) + 1;
      while (b.revealed < Math.min(target, b.seg.length)) {
        const s = b.seg[b.revealed++];
        if (s.alive) {
          s.shown = true; this.showSeg(s);
          for (let i = 0; i < 6; i++) this.game.fx.add.emit(s.cx + rand(-0.5, 0.5) * s.sx, s.cy + s.sy / 2, s.cz + rand(-0.5, 0.5) * s.sz, rand(-2, 2), rand(3, 9), rand(-2, 2), rand(0.6, 1.2), 1.3, 0.2, COL.set(0x7dffd0), COL.set(0x3d9aff), 1, 0, 0.5);
          b.topY = Math.max(b.topY, s.cy + s.sy / 2);
        }
      }
      if (b.revealed >= b.seg.length) {
        b.growing = false; this.growing.splice(gi, 1);
        for (const e of b.extras) if (b.seg[e.seg].alive) e.pool.set(e.idx, e.x, e.y, e.z, e.sx, e.sy, e.sz);
        this.recalcTop(b);
        this.game.fx.flash(V3.set(b.x, b.topY, b.z), 0x7dffd0, 6, 80);
      }
    }
    this.repairT -= dt;
    if (this.repairT <= 0) { this.repairT = 3.5; if (this.game.hud.get().recovery) this.repairStep(); }
    for (const p of [this.glass, this.solid, this.roofs, this.boxes, this.spires, this.slabs]) p.flush();
    this.scatter.flush();
    this.scatter.glowMat.uniforms.uScale.value = this.game.fx.add.mat.uniforms.uScale.value;
  }
  repairStep() {
    const g = this.game;
    if (g.reversing || g.timeScale === 0) return;
    for (const b of this.buildings) {
      if (b.growing || g.clock - b.destroyedAt < 40 || b.destroyedAt === 0) continue;
      if (!b.seg.some((s) => !s.alive)) { b.destroyedAt = 0; continue; }
      for (const s of b.seg) if (!s.alive) { s.alive = true; s.shown = false; s.pool.hide(s.idx); }
      for (const e of b.extras) e.pool.hide(e.idx);
      b.dead = false; b.revealed = 0; b.growT = 0; b.growing = true; b.destroyedAt = 0;
      // keep already-visible segments revealed state: reveal from first non-shown
      b.revealed = b.seg.findIndex((s) => !s.shown); if (b.revealed < 0) b.revealed = b.seg.length;
      this.growing.push(b);
      return;
    }
    // trees regrow
    const sc = this.scatter;
    for (let i = 0; i < 6 && sc.removed > 0; i++) {
      const it = sc.items[Math.floor(Math.random() * sc.items.length)];
      if (!it.alive && g.camera.position.distanceTo(V3.set(it.x, it.y, it.z)) > 160) sc.restore(it);
    }
  }
  regenerate() {
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i];
      if (b.created) { this.unregister(b); this.buildings.splice(i, 1); }
    }
    this.glass.truncate(this.baseCounts.glass); this.solid.truncate(this.baseCounts.solid); this.roofs.truncate(this.baseCounts.roofs);
    this.boxes.truncate(this.baseCounts.boxes); this.spires.truncate(this.baseCounts.spires);
    this.growing.length = 0;
    for (const b of this.buildings) {
      for (const s of b.seg) { s.alive = true; s.shown = true; this.showSeg(s); const o = (s as any).orig as THREE.Color | undefined; if (o) { s.color.copy(o); s.pool.mesh.setColorAt(s.idx, s.color); s.pool.dirtyC = true; } }
      for (const e of b.extras) e.pool.set(e.idx, e.x, e.y, e.z, e.sx, e.sy, e.sz);
      b.dead = false; b.destroyedAt = 0; b.growing = false; this.recalcTop(b);
    }
    this.scatter.restoreAll();
    this.destroyedCount = 0;
  }

  // ---- generation ----
  generate() {
    const g = this.game, T = g.terrain;
    // roads
    const streetTex = roadTexture('street'), hwTex = roadTexture('highway'), rwTex = roadTexture('runway');
    const mkRoads = (list: { x0: number; z0: number; x1: number; z1: number; w: number; y: number }[], tex: THREE.Texture) => {
      const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      for (const r of list) {
        const horiz = Math.abs(r.x1 - r.x0) > Math.abs(r.z1 - r.z0);
        const len = horiz ? Math.abs(r.x1 - r.x0) : Math.abs(r.z1 - r.z0);
        const hw = r.w / 2, base = pos.length / 3;
        if (horiz) pos.push(r.x0, r.y, r.z0 - hw, r.x0, r.y, r.z0 + hw, r.x1, r.y, r.z0 + hw, r.x1, r.y, r.z0 - hw);
        else pos.push(r.x0 - hw, r.y, r.z0, r.x0 + hw, r.y, r.z0, r.x1 + hw, r.y, r.z1, r.x1 - hw, r.y, r.z1);
        const v = len / 32;
        if (horiz) uv.push(0, 0, 1, 0, 1, v, 0, v); else uv.push(0, 0, 1, 0, 1, v, 0, v);
        if (horiz) idx.push(base, base + 1, base + 2, base, base + 2, base + 3); else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 }));
      m.receiveShadow = true; m.frustumCulled = false; this.root.add(m);
    };
    const streetsNS: any[] = [], streetsEW: any[] = [], hwNS: any[] = [], hwEW: any[] = [];
    for (let k = -5; k <= 5; k++) {
      if (k === 0) continue;
      streetsNS.push({ x0: k * P, z0: -CITY_R - 30, x1: k * P, z1: CITY_R + 30, w: 16, y: 4.06 });
      streetsEW.push({ x0: -CITY_R - 30, z0: k * P, x1: CITY_R + 30, z1: k * P, w: 16, y: 4.09 });
    }
    hwNS.push({ x0: 0, z0: -420, x1: 0, z1: 820, w: 20, y: 4.07 });
    hwEW.push({ x0: -460, z0: 0, x1: 470, z1: 0, w: 20, y: 4.1 });
    mkRoads(streetsNS, streetTex); mkRoads(streetsEW, streetTex.clone());
    mkRoads(hwNS, hwTex); mkRoads(hwEW, hwTex.clone());
    // airport
    mkRoads([{ x0: 520, z0: 95, x1: 890, z1: 95, w: 38, y: 4.1 }], rwTex);
    mkRoads([{ x0: 480, z0: 58, x1: 900, z1: 58, w: 12, y: 4.09 }, { x0: 500, z0: 0, x1: 500, z1: 58, w: 12, y: 4.09 }], streetTex.clone());
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(230, 70).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.9 }));
    apron.position.set(650, 4.08, 5); apron.receiveShadow = true; this.root.add(apron);
    this.root.updateMatrixWorld();

    // blocks
    const slabCol = new THREE.Color();
    for (let i = -6; i <= 5; i++) for (let j = -6; j <= 5; j++) {
      const cx = (i + 0.5) * P, cz = (j + 0.5) * P, d = Math.hypot(cx, cz);
      if (d > CITY_R) continue;
      if (cx > 380 && Math.abs(cz) < 160) continue; // airport access
      const downtown = d < 170, commercial = d < 300;
      const park = !downtown && Math.random() < 0.08;
      slabCol.set(park ? 0x4f9a42 : downtown ? 0x8f9296 : commercial ? 0x85888c : 0x6fa05a);
      this.slabs.add(cx, 4.0, cz, 64, 0.26, 64, slabCol);
      const corner = new THREE.Vector3((i + 1) * P, 4.2, (j + 1) * P);
      if (park) {
        for (let t = 0; t < 9; t++) this.scatter.queue('oak', cx + rand(-27, 27), 4.2, cz + rand(-27, 27), rand(0.9, 1.4), rand(0, 6));
        this.spots.park.push(corner.clone()); continue;
      }
      if (downtown) {
        if (Math.random() < 0.55) this.addBuilding('skyscraper', cx + rand(-3, 3), cz + rand(-3, 3), { w: rand(26, 36), h: rand(100, 245) * (1.15 - d / 450), instant: true, baseY: 4.2 });
        else for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.addBuilding('office', cx + sx * 16, cz + sz * 16, { w: rand(20, 26), d: rand(20, 26), h: rand(35, 95), instant: true, baseY: 4.2 });
        this.spots.work.push(corner);
      } else if (commercial) {
        if (Math.random() < 0.45) this.addBuilding('office', cx + rand(-2, 2), cz + rand(-2, 2), { w: rand(36, 50), d: rand(36, 50), h: rand(20, 55), instant: true, baseY: 4.2 });
        else for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.addBuilding(Math.random() < 0.5 ? 'apartments' : 'office', cx + sx * 16, cz + sz * 16, { w: rand(22, 27), d: rand(20, 25), h: rand(15, 30), instant: true, baseY: 4.2 });
        this.spots.work.push(corner);
      } else {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const lx = cx + sx * 16, lz = cz + sz * 16;
          if (Math.random() < 0.12) this.addBuilding('apartments', lx, lz, { w: rand(20, 25), d: rand(16, 20), instant: true, baseY: 4.2 });
          else this.addBuilding('house', lx + rand(-2, 2), lz + rand(-2, 2), { instant: true, baseY: 4.2 });
          if (Math.random() < 0.35) this.scatter.queue('oak', lx + sx * 10, 4.2, lz + sz * 10, rand(0.6, 0.9), rand(0, 6));
        }
        this.spots.home.push(corner);
      }
    }
    // streetlamps
    for (let k = -5; k <= 5; k++) {
      if (k === 0) continue;
      for (let t = -400; t <= 400; t += 40) {
        if (Math.abs(((t % P) + P) % P) < 14 || Math.abs(((t % P) + P) % P - P) < 14) continue;
        const side = Math.floor((t + 400) / 40) % 2 ? 1 : -1;
        this.scatter.queue('lamp', k * P + side * 9, 4.26, t, 1, side > 0 ? Math.PI : 0);
        this.scatter.queue('lamp', t, 4.26, k * P + side * 9, 1, side > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
    // airport buildings
    this.addBuilding('office', 570, -48, { w: 110, d: 28, h: 14, instant: true, baseY: 4.1, color: 0xcfd6dd });
    for (const x of [700, 750, 800]) this.addBuilding('office', x, -100, { w: 36, d: 42, h: 14, instant: true, baseY: 4.1, color: 0xb8bcc0 });
    this.addBuilding('tower', 640, -20, { instant: true, baseY: 4.1 });
    // islands: lighthouse + houses
    const isl = ISLANDS[0];
    this.addBuilding('obelisk', isl.x, isl.z, { w: 9, h: 36, instant: true, color: 0xf4f4f4, flatten: true });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.28 + 0.5, x = isl.x + Math.cos(a) * 55, z = isl.z + Math.sin(a) * 55;
      if (T.heightAt(x, z) > 1.5) this.addBuilding('house', x, z, { instant: true, flatten: true });
    }
    this.villages.push({ x: isl.x, z: isl.z });
    // villages: forest cabins + desert village
    const village = (vx: number, vz: number, n: number, rad: number, cols?: number[]) => {
      for (let i = 0; i < n; i++) {
        const a = rand(0, 6.28), r = rand(15, rad), x = vx + Math.cos(a) * r, z = vz + Math.sin(a) * r;
        if (T.heightAt(x, z) < 1.5) continue;
        this.addBuilding('house', x, z, { instant: true, flatten: true, color: cols ? pick(cols) : undefined });
      }
      this.villages.push({ x: vx, z: vz });
    };
    village(-820, -120, 6, 70); village(-760, 420, 5, 60);
    village(-100, 760, 7, 70, [0xd9bd82, 0xe0c898, 0xc8aa70]);
    for (const b of this.buildings) b.created = false;
    this.spots.work.push(new THREE.Vector3(0, 4.2, 0));

    // scatter: forests, mountains, desert
    const tries = 16000;
    for (let n = 0; n < tries; n++) {
      const x = rand(-1900, 1900), z = rand(-1900, 1900), d = Math.hypot(x, z);
      if (d < CITY_R + 50 || d > 1300) continue;
      const h = T.heightAt(x, z);
      if (Math.abs(x) < 30 && z > -430 && z < 830) continue;
      if (Math.abs(z) < 30 && x > -470 && x < 900) continue;
      if (Math.abs(x - AIRPORT.cx) < AIRPORT.hx + 30 && Math.abs(z - AIRPORT.cz) < AIRPORT.hz + 30) continue;
      if (h < 0.4) continue;
      const cl = fbm(x * 0.006, z * 0.006, 3);
      const r = Math.random(), rot = rand(0, 6.28), s = rand(0.8, 1.5);
      if (h < 3 && d > 800) { if (r < 0.5) this.scatter.queue('palm', x, h, z, s, rot); continue; }
      if (z < -330) { if (h < 120 && r < 0.6) this.scatter.queue('pine', x, h, z, s, rot); else if (h < 260 && r > 0.93) this.scatter.queue('rock', x, h, z, rand(1, 4), rot); continue; }
      if (z > 480 && d < 1000) { if (r < 0.05) this.scatter.queue('cactus', x, h, z, rand(0.8, 1.6), rot); else if (r > 0.97) this.scatter.queue('rock', x, h, z, rand(0.8, 2.4), rot); continue; }
      const fo = smoothstep(-250, -420, x);
      const prob = 0.22 + fo * 0.6 + (cl > 0.55 ? 0.35 : 0) - (cl < 0.35 ? 0.2 : 0);
      if (r < prob) this.scatter.queue(Math.random() < 0.5 + fo * 0.1 ? 'pine' : 'oak', x, h, z, s, rot);
      else if (r > 0.985) this.scatter.queue('rock', x, h, z, rand(0.6, 2), rot);
    }
    for (const i of ISLANDS) for (let n = 0; n < 90; n++) {
      const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * i.r * 0.8, x = i.x + Math.cos(a) * rr, z = i.z + Math.sin(a) * rr, h = T.heightAt(x, z);
      if (h > 0.6 && !this.pointInside(x, h + 3, z, 4)) this.scatter.queue('palm', x, h, z, rand(0.8, 1.4), rand(0, 6));
    }
    // underwater
    for (let n = 0; n < 4500; n++) {
      const x = rand(-1800, 1800), z = rand(-1800, 1800), h = T.heightAt(x, z);
      if (h > -2.5 || h < -34) continue;
      const r = Math.random();
      this.scatter.queue(r < 0.45 ? 'coral' : r < 0.85 ? 'kelp' : 'rock', x, h, z, rand(0.8, 1.8), rand(0, 6));
    }
    // asteroid field
    for (let n = 0; n < 160; n++) { const a = rand(0, 6.28), rr = rand(900, 1500); this.scatter.queue('asteroid', Math.cos(a) * rr + 400, 3200 + rand(-120, 120), Math.sin(a) * rr - 3200, rand(0.5, 3), rand(0, 6)); }
    this.scatter.flushPending();
    T.onDeform = (x, z, r) => this.scatter.reseat(x, z, r);
    this.baseCounts = { glass: this.glass.n, solid: this.solid.n, roofs: this.roofs.n, boxes: this.boxes.n, spires: this.spires.n };
    this.baseBuildings = this.buildings.length;
    for (const p of [this.glass, this.solid, this.roofs, this.boxes, this.spires, this.slabs]) p.flush();
    this.scatter.flush();
    void zoneAt;
  }
}
