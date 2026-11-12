import * as THREE from 'three';
import { fbm, smoothstep, lerp, clamp, hash2 } from './noise';

export const WORLD = 4200;
export const SEG = 280;
export const CELL = WORLD / SEG;
export const HALF = WORLD / 2;
export const CITY_R = 430;
export const P = 80; // street pitch
export const ISLANDS = [
  { x: 1500, z: 650, r: 190 }, { x: -1450, z: -800, r: 160 }, { x: 1250, z: -1350, r: 210 },
  { x: -900, z: 1500, r: 150 }, { x: 300, z: -1700, r: 120 },
];
export const AIRPORT = { cx: 680, cz: 0, hx: 210, hz: 150 };
export const riverX = (z: number) => -650 + 70 * Math.sin(z * 0.006) + 30 * Math.sin(z * 0.017);

export function baseHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);
  let h = 7 - smoothstep(820, 1250, d) * 58;
  const cityMask = 1 - smoothstep(450, 620, d);
  const n = fbm(x * 0.0032 + 11.3, z * 0.0032 + 4.7, 5);
  h += (n - 0.5) * 18 * (1 - cityMask) * (1 - smoothstep(850, 1200, d) * 0.9);
  const mt = smoothstep(-330, -760, z) * (1 - smoothstep(1000, 1300, d));
  if (mt > 0) {
    const r = 1 - Math.abs(2 * fbm(x * 0.0042 + 3, z * 0.0042 + 9, 5) - 1);
    h += mt * (35 + Math.pow(r, 1.6) * 300);
  }
  const ds = smoothstep(480, 700, z) * (1 - smoothstep(1000, 1300, d));
  if (ds > 0) h += ds * (Math.sin(x * 0.012 + fbm(x * 0.004, z * 0.004) * 6) * 6 + (fbm(x * 0.01, z * 0.01, 3) - 0.5) * 10 + 2);
  for (const i of ISLANDS) {
    const dd = ((x - i.x) ** 2 + (z - i.z) ** 2) / (i.r * i.r);
    if (dd < 9) h += Math.exp(-dd * 0.9) * (66 + (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 14);
  }
  const rm = smoothstep(-500, -380, z) * (1 - smoothstep(700, 900, z));
  const dr = Math.abs(x - riverX(z));
  h = lerp(h, -5, (1 - smoothstep(12, 45, dr)) * rm);
  h = lerp(h, 4, cityMask);
  const ew = (1 - smoothstep(16, 55, Math.abs(z))) * smoothstep(-500, -440, x) * (1 - smoothstep(860, 920, x));
  const ns = (1 - smoothstep(16, 55, Math.abs(x))) * smoothstep(-460, -400, z) * (1 - smoothstep(820, 880, z));
  h = lerp(h, 4, Math.max(ew, ns));
  const adx = Math.max(Math.abs(x - AIRPORT.cx) - AIRPORT.hx, 0), adz = Math.max(Math.abs(z - AIRPORT.cz) - AIRPORT.hz, 0);
  h = lerp(h, 4, 1 - smoothstep(0, 70, Math.hypot(adx, adz)));
  return h;
}

export function zoneAt(x: number, z: number): string {
  const d = Math.hypot(x, z);
  for (const i of ISLANDS) if (Math.hypot(x - i.x, z - i.z) < i.r * 1.1) return 'Remote Island';
  if (Math.abs(x - AIRPORT.cx) < AIRPORT.hx && Math.abs(z - AIRPORT.cz) < AIRPORT.hz) return 'International Airport';
  if (d < 170) return 'Downtown';
  if (d < 300) return 'Commercial District';
  if (d < CITY_R + 20) return 'Residential District';
  if (d > 1250) return 'Open Ocean';
  if (z < -330) return 'Snow Mountains';
  if (z > 480 && d < 1000) return 'Sahara Desert';
  if (Math.abs(x - riverX(z)) < 40) return 'River';
  if (x < -300) return 'Great Forest';
  if (d > 950) return 'Coast';
  return 'Countryside';
}

const COL = new THREE.Color();
export class Terrain {
  heights = new Float32Array((SEG + 1) * (SEG + 1));
  orig = new Float32Array((SEG + 1) * (SEG + 1));
  base!: Float32Array;
  colors: Float32Array;
  origColors: Float32Array;
  geo: THREE.BufferGeometry;
  mesh: THREE.Mesh;
  pos: Float32Array;
  dirty = false; normalsDirty = false; colorDirty = false;
  healT = 0;
  onDeform: ((x: number, z: number, r: number) => void) | null = null;

  constructor(scene: THREE.Scene) {
    const N = SEG + 1;
    const pos = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const x = -HALF + i * CELL, z = -HALF + j * CELL;
      const h = baseHeight(x, z);
      this.orig[k] = h; this.heights[k] = h;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    }
    this.pos = pos;
    this.base = this.orig.slice();
    const idx = new Uint32Array(SEG * SEG * 6);
    let c = 0;
    for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) {
      const a = j * N + i, b = a + 1, d = a + N, e = d + 1;
      idx[c++] = a; idx[c++] = d; idx[c++] = b; idx[c++] = b; idx[c++] = d; idx[c++] = e;
    }
    this.colors = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) this.paintVertex(i, j);
    this.origColors = this.colors.slice();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    this.geo = geo;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    mat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix*vec4(transformed,1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
float nn = vn(vWP.xz*0.35)*0.5+vn(vWP.xz*1.9)*0.3+vn(vWP.xz*7.0)*0.2;
diffuseColor.rgb *= 0.74+0.5*nn;`);
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  paintVertex(i: number, j: number) {
    const N = SEG + 1;
    const k = j * N + i;
    const x = -HALF + i * CELL, z = -HALF + j * CELL;
    const h = this.heights[k];
    const hx = this.heights[j * N + Math.min(N - 1, i + 1)] - this.heights[j * N + Math.max(0, i - 1)];
    const hz = this.heights[Math.min(N - 1, j + 1) * N + i] - this.heights[Math.max(0, j - 1) * N + i];
    const slope = Math.hypot(hx, hz) / (2 * CELL);
    const d = Math.hypot(x, z);
    const n = fbm(x * 0.01, z * 0.01, 3);
    const c = COL;
    c.setRGB(0.22 + n * 0.1, 0.4 + n * 0.12, 0.14);
    const forest = smoothstep(-250, -420, x);
    if (forest > 0) c.lerp(COL.clone().setRGB(0.1, 0.27, 0.1), forest * 0.8);
    const ds = smoothstep(480, 640, z) * (1 - smoothstep(950, 1100, d));
    if (ds > 0) c.lerp(COL.clone().setRGB(0.82, 0.64, 0.38 + n * 0.1), ds);
    const cityMask = 1 - smoothstep(300, 450, d);
    if (cityMask > 0) c.lerp(COL.clone().setRGB(0.42, 0.43, 0.43), cityMask);
    if (h > 25 && z < -300 || slope > 0.55) c.lerp(COL.clone().setRGB(0.38 + n * 0.1, 0.35 + n * 0.08, 0.33), clamp(slope * 1.1, 0.3, 1));
    if (h > 150) c.lerp(COL.clone().setRGB(0.96, 0.97, 1), smoothstep(150, 190, h + n * 30) * (1 - clamp(slope - 0.7, 0, 0.6)));
    if (h < 1.8) c.lerp(COL.clone().setRGB(0.78, 0.7, 0.5), smoothstep(1.8, 0.2, h) * 0.9);
    if (h < -4) c.lerp(COL.clone().setRGB(0.32, 0.36, 0.34), smoothstep(-4, -14, h));
    if (h < -20) c.lerp(COL.clone().setRGB(0.1, 0.17, 0.22), smoothstep(-20, -45, h));
    const adx = Math.max(Math.abs(x - AIRPORT.cx) - AIRPORT.hx, 0), adz = Math.max(Math.abs(z - AIRPORT.cz) - AIRPORT.hz, 0);
    if (Math.hypot(adx, adz) < 20) c.lerp(COL.clone().setRGB(0.5, 0.5, 0.5), 0.8);
    const v = 0.9 + hash2(i, j) * 0.2;
    c.convertSRGBToLinear();
    this.colors[k * 3] = c.r * v; this.colors[k * 3 + 1] = c.g * v; this.colors[k * 3 + 2] = c.b * v;
  }

  heightAt(x: number, z: number): number {
    const gx = clamp((x + HALF) / CELL, 0, SEG - 0.001), gz = clamp((z + HALF) / CELL, 0, SEG - 0.001);
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, N = SEG + 1;
    const h = this.heights, k = j * N + i;
    return lerp(lerp(h[k], h[k + 1], fx), lerp(h[k + N], h[k + N + 1], fx), fz);
  }
  slopeAt(x: number, z: number) {
    return Math.hypot(this.heightAt(x + 4, z) - this.heightAt(x - 4, z), this.heightAt(x, z + 4) - this.heightAt(x, z - 4)) / 8;
  }

  private region(x: number, z: number, r: number, fn: (k: number, d: number, vx: number, vz: number) => void) {
    const N = SEG + 1;
    const i0 = Math.max(0, Math.floor((x - r + HALF) / CELL)), i1 = Math.min(SEG, Math.ceil((x + r + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((z - r + HALF) / CELL)), j1 = Math.min(SEG, Math.ceil((z + r + HALF) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const vx = -HALF + i * CELL, vz = -HALF + j * CELL;
      const d = Math.hypot(vx - x, vz - z);
      if (d < r) fn(j * N + i, d, vx, vz);
    }
    this.dirty = true; this.normalsDirty = true; this.colorDirty = true;
  }

  crater(x: number, z: number, r: number, depth: number, scorch = true) {
    const rr = r * 1.4;
    this.region(x, z, rr, (k, d) => {
      const t = d / r;
      let dh = 0;
      if (t < 1) dh = -depth * (1 - t * t);
      else dh = depth * 0.15 * Math.sin(((t - 1) / 0.4) * Math.PI);
      this.heights[k] = Math.max(-46, this.heights[k] + dh);
      this.pos[k * 3 + 1] = this.heights[k];
      if (scorch && t < 1.2) {
        const w = (1 - t / 1.2) * 0.85;
        for (let q = 0; q < 3; q++) this.colors[k * 3 + q] = lerp(this.colors[k * 3 + q], q === 0 ? 0.012 : 0.009, w);
      }
    });
    this.onDeform?.(x, z, rr);
  }
  raise(x: number, z: number, r: number, amount: number, power = 1.5, tint?: THREE.Color, permanent = false) {
    this.region(x, z, r, (k, d) => {
      const w = Math.pow(1 - d / r, power);
      this.heights[k] = clamp(this.heights[k] + amount * w, -46, 600);
      if (permanent) this.orig[k] = clamp(this.orig[k] + amount * w, -46, 600);
      this.pos[k * 3 + 1] = this.heights[k];
      if (tint) for (let q = 0; q < 3; q++) this.colors[k * 3 + q] = lerp(this.colors[k * 3 + q], q === 0 ? tint.r : q === 1 ? tint.g : tint.b, w * 0.8);
    });
    this.onDeform?.(x, z, r);
  }
  flatten(x: number, z: number, r: number, target: number, strength = 1, permanent = true) {
    this.region(x, z, r, (k, d) => {
      const w = clamp((1 - d / r) * 2.2, 0, 1) * strength;
      this.heights[k] = lerp(this.heights[k], target, w);
      if (permanent) this.orig[k] = lerp(this.orig[k], target, w);
      this.pos[k * 3 + 1] = this.heights[k];
    });
  }
  paint(x: number, z: number, r: number, c: THREE.Color, strength = 0.8) {
    this.region(x, z, r, (k, d) => {
      const w = (1 - d / r) * strength;
      this.colors[k * 3] = lerp(this.colors[k * 3], c.r, w); this.colors[k * 3 + 1] = lerp(this.colors[k * 3 + 1], c.g, w); this.colors[k * 3 + 2] = lerp(this.colors[k * 3 + 2], c.b, w);
    });
  }

  regenerate() {
    this.orig.set(this.base);
    this.heights.set(this.base);
    this.colors.set(this.origColors);
    for (let k = 0; k < this.heights.length; k++) this.pos[k * 3 + 1] = this.heights[k];
    this.flushAll();
  }
  flushAll() {
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.dirty = false; this.normalsDirty = false; this.colorDirty = false;
  }

  /** rate: fraction per second of healing; 0 = none */
  update(dt: number, rate: number) {
    this.healT += dt;
    if (this.healT > 0.25) {
      const step = this.healT; this.healT = 0;
      if (rate > 0 && this.dirty) {
        const f = clamp(rate * step, 0, 1);
        let any = false;
        for (let k = 0; k < this.heights.length; k++) {
          const d = this.orig[k] - this.heights[k];
          if (Math.abs(d) > 0.01) { this.heights[k] += d * f; this.pos[k * 3 + 1] = this.heights[k]; any = true; } else if (d !== 0) { this.heights[k] = this.orig[k]; this.pos[k * 3 + 1] = this.orig[k]; }
          for (let q = 0; q < 3; q++) {
            const kc = k * 3 + q, dc = this.origColors[kc] - this.colors[kc];
            if (Math.abs(dc) > 0.004) { this.colors[kc] += dc * f * 0.7; any = true; }
          }
        }
        this.normalsDirty = any || this.normalsDirty;
        this.colorDirty = true;
        if (!any) this.dirty = false;
      }
      if (this.normalsDirty || this.colorDirty) {
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.color.needsUpdate = true;
        if (this.normalsDirty) this.geo.computeVertexNormals();
        this.normalsDirty = false; this.colorDirty = false;
      }
    }
  }

  minimap(size = 256): HTMLCanvasElement {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(size, size);
    const N = SEG + 1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = Math.floor((x / size) * SEG), j = Math.floor((y / size) * SEG), k = j * N + i;
      const o = (y * size + x) * 4;
      const h = this.orig[k];
      let r = this.origColors[k * 3], gg = this.origColors[k * 3 + 1], b = this.origColors[k * 3 + 2];
      if (h < 0) { const t = clamp(-h / 25, 0, 1); r = lerp(0.1, 0.02, t); gg = lerp(0.45, 0.2, t); b = lerp(0.65, 0.4, t); }
      img.data[o] = r * 255; img.data[o + 1] = gg * 255; img.data[o + 2] = b * 255; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
}

export class Ocean {
  mesh: THREE.Mesh;
  floor: THREE.Mesh;
  tex: THREE.CanvasTexture;
  level = 0;
  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    const S = 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(S, S);
    const hgt = (x: number, y: number) => {
      const u = (x / S) * Math.PI * 2, v = (y / S) * Math.PI * 2;
      return Math.sin(u * 3 + Math.sin(v * 2) * 1.5) * 0.5 + Math.sin(v * 4 + Math.cos(u * 3)) * 0.35 + Math.sin((u + v) * 6) * 0.15 + Math.sin(u * 9 - v * 7) * 0.08;
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
      const nx = -dx * 1.4, ny = -dy * 1.4, nz = 1, l = Math.hypot(nx, ny, nz);
      const o = (y * S + x) * 4;
      img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.tex = new THREE.CanvasTexture(cv);
    this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping;
    this.tex.repeat.set(WORLD * 10 / 50, WORLD * 10 / 50);
    this.tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a6a96, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.82,
      normalMap: this.tex, normalScale: new THREE.Vector2(0.55, 0.55), side: THREE.DoubleSide, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 10, WORLD * 10).rotateX(-Math.PI / 2), mat);
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 10, WORLD * 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b3340, roughness: 1 }));
    this.floor.position.y = -54;
    scene.add(this.floor);
  }
  update(t: number) {
    this.tex.offset.set(t * 0.004, t * 0.0027);
  }
  setLevel(l: number) { this.level = l; this.mesh.position.y = l; }
}
