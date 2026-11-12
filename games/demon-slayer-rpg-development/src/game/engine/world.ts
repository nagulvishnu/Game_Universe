import * as THREE from 'three';
import type { PropKind, PropSpec, RegionDef } from '../data/regions';
import { toonGrad } from './rig';

export interface Quality { shadows: 'off' | 'low' | 'high'; density: number; seg: number; weather: number }
export interface WorldHandle {
  group: THREE.Group; update(dt: number, time: number, cam: THREE.Vector3, player: THREE.Vector3): void; dispose(): void;
  hAt(x: number, z: number): number; colliders: { x: number; z: number; r: number }[]; gates: { pos: THREE.Vector3; to: string }[];
  night: number; sun: THREE.DirectionalLight; poi: THREE.Vector3; setShadow(q: Quality['shadows']): void; rain: boolean;
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- merged recipe builder ----
class Rec {
  parts: { g: THREE.BufferGeometry; c: THREE.Color; m: THREE.Matrix4 }[] = [];
  private mx = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler();
  add(g: THREE.BufferGeometry, col: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    this.e.set(rx, ry, rz); this.q.setFromEuler(this.e); this.mx.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx, sy, sz));
    this.parts.push({ g, c: new THREE.Color(col), m: this.mx.clone() }); return this;
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, col: number, ry = 0, rx = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, h, d), col, x, y, z, 1, 1, 1, rx, ry, rz); }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, col: number, seg = 8, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y, z, 1, 1, 1, rx, ry, rz); }
  cone(r: number, h: number, x: number, y: number, z: number, col: number, seg = 8) { return this.add(new THREE.ConeGeometry(r, h, seg), col, x, y + h / 2, z); }
  sph(r: number, x: number, y: number, z: number, col: number, sx = 1, sy = 1, sz = 1) { return this.add(new THREE.SphereGeometry(r, 9, 7), col, x, y, z, sx, sy, sz); }
  build() {
    let total = 0; const gs = this.parts.map((p) => { const g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); g.applyMatrix4(p.m); total += g.attributes.position.count; return g; });
    const pos = new Float32Array(total * 3); const nor = new Float32Array(total * 3); const col = new Float32Array(total * 3); let o = 0;
    gs.forEach((g, i) => {
      pos.set(g.attributes.position.array as Float32Array, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3);
      const c = this.parts[i].c; for (let k = 0; k < g.attributes.position.count; k++) { col[(o + k) * 3] = c.r; col[(o + k) * 3 + 1] = c.g; col[(o + k) * 3 + 2] = c.b; }
      o += g.attributes.position.count; g.dispose(); this.parts[i].g.dispose();
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere(); return geo;
  }
}

interface Recipe { solid: THREE.BufferGeometry; glow?: THREE.BufferGeometry; sway?: boolean; r: number; scale: [number, number]; lift?: number }

function recipe(kind: PropKind, reg: RegionDef): Recipe | null {
  const s = new Rec(); const g = new Rec(); const snow = reg.kind === 'snow';
  const fol = reg.id === 'natagumo' ? 0x1e3a2a : reg.id === 'selection' ? 0x2a3a30 : snow ? 0x2e5a4a : 0x2f6a3a;
  switch (kind) {
    case 'pine': case 'cedar': {
      const h = kind === 'cedar' ? 1.5 : 1; s.cyl(0.2, 0.32, 2.4 * h, 0, 1.2 * h, 0, 0x5a3a24, 6);
      const n = kind === 'cedar' ? 4 : 3; for (let i = 0; i < n; i++) { const r = (kind === 'cedar' ? 1.4 : 1.7) * (1 - i * 0.22); s.cone(r, 2.3 * h, 0, (1.6 + i * 1.5) * h, 0, fol + i * 0x040804, 8); if (snow) s.cone(r * 0.7, 0.9, 0, (1.6 + i * 1.5) * h + 1.5 * h, 0, 0xf0f6ff, 8); }
      return { solid: s.build(), sway: true, r: 0.7, scale: [0.8, 1.4] };
    }
    case 'sakura': case 'maple': {
      const c = kind === 'sakura' ? [0xffb0cc, 0xff94b8, 0xffcadb] : [0xd8442a, 0xe8742a, 0xb82a20]; s.cyl(0.22, 0.34, 2.8, 0, 1.4, 0, 0x4a3024, 6); s.cyl(0.12, 0.18, 1.5, 0.7, 3, 0, 0x4a3024, 5, 0, 0, -0.8);
      s.sph(1.7, 0, 3.9, 0, c[0], 1, 0.8, 1); s.sph(1.2, 1.3, 3.5, 0.4, c[1]); s.sph(1.1, -1.1, 3.4, -0.5, c[2]); return { solid: s.build(), sway: true, r: 0.8, scale: [0.8, 1.3] };
    }
    case 'wisteria': {
      s.cyl(0.2, 0.3, 2.6, 0, 1.3, 0, 0x4a3a2a, 6); s.sph(1.9, 0, 3.4, 0, 0x8a6ac8, 1, 0.65, 1); s.sph(1.3, 1.3, 3.0, 0.3, 0xa088dc); s.sph(1.2, -1.2, 2.9, -0.4, 0x7a5ab8);
      for (let i = 0; i < 9; i++) { const a = i * 0.7; g.cyl(0.05, 0.02, 1.3 + (i % 3) * 0.4, Math.cos(a) * (0.8 + (i % 4) * 0.35), 2.2, Math.sin(a) * (0.8 + (i % 3) * 0.4), 0xc0a0ff, 4); }
      return { solid: s.build(), glow: g.build(), sway: true, r: 0.8, scale: [0.8, 1.3] };
    }
    case 'bamboo': for (let i = 0; i < 4; i++) { const x = Math.cos(i * 1.7) * 0.5; const z = Math.sin(i * 1.7) * 0.5; s.cyl(0.07, 0.09, 8 + i, x, 4 + i / 2, z, 0x5aa04a, 5); for (let k = 1; k < 5; k++) s.cyl(0.1, 0.1, 0.06, x, k * 2, z, 0x3a7a3a, 5); s.sph(0.7, x, 8.2 + i, z, 0x4a9a44, 1, 0.5, 1); } return { solid: s.build(), sway: true, r: 0.3, scale: [0.8, 1.2] };
    case 'dead': s.cyl(0.14, 0.3, 4, 0, 2, 0, 0x2a2420, 5); s.cyl(0.05, 0.1, 2, 0.8, 3.4, 0, 0x2a2420, 4, 0, 0, -0.9); s.cyl(0.05, 0.1, 1.6, -0.7, 2.9, 0.2, 0x2a2420, 4, 0, 0, 0.9); s.cyl(0.04, 0.08, 1.4, 0.1, 3.8, 0.6, 0x2a2420, 4, 0.9, 0, 0); return { solid: s.build(), r: 0.5, scale: [0.8, 1.4] };
    case 'rock': s.add(new THREE.IcosahedronGeometry(1, 0), 0x74767e, 0, 0.5, 0, 1.2, 0.8, 1); s.add(new THREE.IcosahedronGeometry(1, 0), 0x666870, 0.7, 0.3, 0.4, 0.6, 0.5, 0.6); if (snow) s.add(new THREE.IcosahedronGeometry(1, 0), 0xf0f4fa, 0, 1.0, 0, 0.8, 0.28, 0.7); return { solid: s.build(), r: 1.2, scale: [0.7, 2.2] };
    case 'house': {
      const wall = reg.id === 'district' ? 0x6a3a40 : 0xd8c8a8; s.box(7, 3.2, 5.6, 0, 1.6, 0, wall); s.box(7.2, 0.3, 5.8, 0, 3.3, 0, 0x3a2a24);
      s.box(8.2, 0.26, 3.4, 0, 4.2, 1.55, 0x3a3e4e, 0, -0.5, 0); s.box(8.2, 0.26, 3.4, 0, 4.2, -1.55, 0x3a3e4e, 0, 0.5, 0); s.box(8.4, 0.3, 0.3, 0, 4.95, 0, 0x2a2e3a);
      s.box(1.3, 2.3, 0.1, 0, 1.15, 2.85, 0x5a3a24); s.box(7.1, 0.25, 5.7, 0, 0.1, 0, 0x4a3a30);
      g.box(1.2, 1.0, 0.08, 2.2, 1.9, 2.82, 0xffd88a); g.box(1.2, 1.0, 0.08, -2.2, 1.9, 2.82, 0xffd88a); return { solid: s.build(), glow: g.build(), r: 4.2, scale: [1, 1] };
    }
    case 'shop': {
      const aw = reg.id === 'district' ? 0xd02a4a : 0x2a5a9a; s.box(6, 3, 5, 0, 1.5, 0, 0xc8b490); s.box(6.4, 0.3, 5.4, 0, 3.1, 0, 0x3a2a24); s.box(6.6, 0.25, 3, 0, 3.9, 1.3, 0x3a3e4e, 0, -0.45, 0); s.box(6.6, 0.25, 3, 0, 3.9, -1.3, 0x3a3e4e, 0, 0.45, 0);
      s.box(5.6, 0.12, 1.4, 0, 2.6, 3.1, aw, 0, 0.35, 0); s.box(5, 1, 0.8, 0, 0.5, 2.6, 0x6a4a2a); for (let i = -1; i <= 1; i++) s.box(1.3, 1.1, 0.05, i * 1.8, 2.0, 2.52, i % 2 ? 0xf0e8d8 : 0x2a2a3a);
      g.sph(0.35, -2.7, 2.2, 3.0, 0xff6a3a, 1, 1.2, 1); g.sph(0.35, 2.7, 2.2, 3.0, 0xff6a3a, 1, 1.2, 1); g.box(3.6, 0.8, 0.06, 0, 1.8, 2.5, 0xffd88a); return { solid: s.build(), glow: g.build(), r: 3.6, scale: [1, 1] };
    }
    case 'lantern': s.cyl(0.14, 0.2, 0.9, 0, 0.45, 0, 0x8a8a90, 6); s.box(0.5, 0.12, 0.5, 0, 1.0, 0, 0x7a7a80); s.box(0.8, 0.14, 0.8, 0, 1.75, 0, 0x6a6a70); g.box(0.46, 0.55, 0.46, 0, 1.38, 0, 0xffc860); return { solid: s.build(), glow: g.build(), r: 0.3, scale: [1, 1], lift: 0 };
    case 'redlantern': s.cyl(0.06, 0.08, 4, 0, 2, 0, 0x4a2a1a, 5); s.box(1.2, 0.08, 0.08, 0.5, 3.8, 0, 0x4a2a1a); g.sph(0.42, 1.0, 3.3, 0, 0xff3a2a, 1, 1.25, 1); g.sph(0.2, 1.0, 3.3, 0, 0xffc060, 1, 1.5, 1); return { solid: s.build(), glow: g.build(), r: 0.2, scale: [1, 1] };
    case 'torii': s.cyl(0.35, 0.4, 7, -3, 3.5, 0, 0xc82a20, 8); s.cyl(0.35, 0.4, 7, 3, 3.5, 0, 0xc82a20, 8); s.box(9.4, 0.5, 0.7, 0, 7.1, 0, 0x14141a); s.box(8, 0.35, 0.5, 0, 6.1, 0, 0xc82a20); s.box(0.5, 1, 0.5, 0, 6.6, 0, 0xc82a20); return { solid: s.build(), r: 0, scale: [1, 1] };
    case 'webtree': {
      s.cyl(0.2, 0.34, 3, 0, 1.5, 0, 0x2a2018, 6); s.cone(1.6, 2.4, 0, 2.6, 0, fol, 7); s.cone(1.2, 2, 0, 4, 0, fol + 0x020402, 7);
      g.box(2.6, 0.02, 2.0, 0.4, 3.2, 0, 0xd8e8e0, 0, 0.3, 0.4); g.box(0.02, 3.2, 1.6, -1.0, 2.2, 0.5, 0xc8d8d0, 0, 0.1, 0.1); g.box(2.2, 0.02, 0.02, 0, 1.6, 0.6, 0xe8f0e8, 0.6); return { solid: s.build(), glow: g.build(), sway: false, r: 0.8, scale: [0.9, 1.5] };
    }
    case 'cocoon': s.cyl(0.02, 0.02, 3.5, 0, 4.2, 0, 0xd8d8d8, 3); s.sph(0.7, 0, 2.2, 0, 0xd8e0d8, 1, 1.7, 1); g.sph(0.45, 0, 2.2, 0, 0x7aff9a, 1, 1.5, 1); return { solid: s.build(), glow: g.build(), r: 0.5, scale: [0.9, 1.2] };
    case 'pillar': s.box(1.3, 6, 1.3, 0, 3, 0, 0x8a8678); s.box(1.6, 0.4, 1.6, 0, 6.1, 0, 0x7a766a); s.box(1.6, 0.3, 1.6, 0, 0.15, 0, 0x7a766a); return { solid: s.build(), r: 0.85, scale: [0.5, 1.4] };
    case 'forge': s.box(4, 2.6, 4, 0, 1.3, 0, 0x5a5a62); s.cyl(0.6, 0.8, 4, 1, 4.2, 1, 0x4a4a52, 7); s.box(4.6, 0.3, 4.6, 0, 2.8, 0, 0x3a2a24); s.box(5, 0.25, 3, 0, 3.6, 1.1, 0x3a3e4e, 0, -0.5, 0); s.box(5, 0.25, 3, 0, 3.6, -1.1, 0x3a3e4e, 0, 0.5, 0); g.box(1.4, 1, 0.1, 0, 1.0, 2.02, 0xff8a2a); g.sph(0.4, 1, 6.4, 1, 0xff8a2a); return { solid: s.build(), glow: g.build(), r: 2.8, scale: [1, 1] };
    case 'wall': s.box(4, 3.4, 0.3, 0, 1.7, 0, 0x3a2a20); g.box(3.5, 2.6, 0.18, 0, 1.6, 0, 0xf4e8c8); s.box(0.15, 2.8, 0.34, 0, 1.6, 0, 0x4a3224); s.box(3.6, 0.1, 0.34, 0, 1.6, 0, 0x4a3224); return { solid: s.build(), glow: g.build(), r: 1.3, scale: [1, 1] };
    case 'seat': s.box(1.8, 0.4, 0.9, 0, 0.5, 0, 0x7a2a22); s.box(1.8, 0.9, 0.2, 0, 1.0, -0.4, 0x7a2a22); s.box(1.9, 0.1, 1.0, 0, 0.25, 0, 0x4a3224); return { solid: s.build(), r: 0.9, scale: [1, 1] };
    case 'tendril': for (let i = 0; i < 6; i++) { s.cyl(0.18 - i * 0.015, 0.2 - i * 0.015, 1, Math.sin(i * 0.9) * 0.3, 0.5 + i * 0.95, Math.cos(i * 0.9) * 0.3, 0xa01830, 6, Math.sin(i) * 0.2, 0, Math.cos(i) * 0.2); } g.sph(0.35, 0, 5.8, 0, 0xff3a5a); g.sph(0.2, 0.3, 3, 0.2, 0xff6a7a); return { solid: s.build(), glow: g.build(), r: 0.5, scale: [0.8, 1.3] };
    case 'drum': s.cyl(1.2, 1.2, 0.9, 0, 1.0, 0, 0x6a3a24, 12); g.cyl(1.05, 1.05, 0.04, 0, 1.47, 0, 0xe8d8b0, 12); s.cyl(1.25, 1.25, 0.12, 0, 1.45, 0, 0xd8a038, 12); s.cyl(0.1, 0.1, 0.6, 0.7, 0.3, 0.7, 0x3a2a20, 5); s.cyl(0.1, 0.1, 0.6, -0.7, 0.3, -0.7, 0x3a2a20, 5); return { solid: s.build(), glow: g.build(), r: 1.4, scale: [0.8, 1.4] };
    case 'platform': s.box(10, 0.6, 10, 0, 0, 0, 0x8a6a40); s.box(10.4, 0.2, 10.4, 0, -0.4, 0, 0x3a2a1e); s.box(0.6, 3.2, 0.6, 4.6, 1.8, 4.6, 0x4a2a1a); s.box(0.6, 3.2, 0.6, -4.6, 1.8, -4.6, 0x4a2a1a); s.box(10, 0.4, 0.4, 0, 3.4, 4.6, 0x4a2a1a); return { solid: s.build(), r: 0, scale: [0.8, 2] };
    case 'door': s.box(0.4, 5, 0.4, -1.6, 2.5, 0, 0x4a2a1a); s.box(0.4, 5, 0.4, 1.6, 2.5, 0, 0x4a2a1a); s.box(3.6, 0.4, 0.4, 0, 5, 0, 0x4a2a1a); g.box(2.8, 4.6, 0.1, 0, 2.5, 0, 0xe8dcc0); return { solid: s.build(), glow: g.build(), r: 0.5, scale: [0.8, 1.6] };
    case 'tomb': s.box(0.8, 1.6, 0.4, 0, 0.8, 0, 0x8a8a92); s.box(1.1, 0.3, 0.7, 0, 0.15, 0, 0x7a7a82); return { solid: s.build(), r: 0.6, scale: [0.9, 1.4] };
    case 'log': s.cyl(0.4, 0.4, 3.4, 0, 1.7, 0, 0x6a4a2a, 7); s.cyl(0.42, 0.42, 0.1, 0, 3.4, 0, 0xc8a070, 7); return { solid: s.build(), r: 0.5, scale: [0.8, 1.5] };
    case 'pagoda': for (let i = 0; i < 4; i++) { s.box(5 - i * 0.8, 2.2, 5 - i * 0.8, 0, 1.1 + i * 3.4, 0, i % 2 ? 0xc8b88a : 0xb8a070); s.box(6.8 - i * 1.0, 0.3, 6.8 - i * 1.0, 0, 2.5 + i * 3.4, 0, 0x2a2e3a); s.box(0.3, 0.2, 7, 0, 2.7 + i * 3.4, 0, 0x2a2e3a); } s.cyl(0.08, 0.1, 3.2, 0, 15.6, 0, 0xd8b848, 5); g.box(1.6, 1.0, 0.06, 0, 1.6, 2.5, 0xffd88a); return { solid: s.build(), glow: g.build(), r: 3.6, scale: [1, 1.15] };
    case 'shrine': s.box(3, 2, 3, 0, 1, 0, 0x7a4a2a); s.box(4, 0.3, 4, 0, 2.3, 0, 0x3a3e4e); return { solid: s.build(), r: 2, scale: [1, 1] };
    case 'cliff': s.box(6, 20, 5, 0, 10, 0, 0x5a5a62); s.box(4, 14, 4, 2.5, 7, 1, 0x666670, 0.4); s.box(3, 10, 3, -2.8, 5, -1, 0x4a4a52, -0.3); return { solid: s.build(), r: 3, scale: [1.2, 2.2] };
    case 'rail': case 'lotus': case 'mansion': return null;
  }
  return null;
}

const gradTex = (kind: string) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
  const r = rng(hash(kind));
  if (kind === 'grass' || kind === 'snow' || kind === 'dirt') { for (let i = 0; i < 700; i++) { const v = 200 + Math.floor(r() * 55); g.fillStyle = `rgba(${v - (kind === 'dirt' ? 20 : 0)},${v},${v},${0.25 + r() * 0.3})`; const s = 1 + r() * 2.5; g.fillRect(r() * 128, r() * 128, s, s * (kind === 'grass' ? 3 : 1)); } if (kind === 'grass') { g.strokeStyle = 'rgba(120,170,110,0.4)'; for (let i = 0; i < 60; i++) { const x = r() * 128; const y = r() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 5); g.stroke(); } } }
  else if (kind === 'stone') { g.strokeStyle = 'rgba(60,60,70,0.55)'; g.lineWidth = 2; for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * 128, r() * 128, 8, 8); } }
  else if (kind === 'tatami') { g.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 128; i += 3) g.fillRect(0, i, 128, 1); g.strokeStyle = 'rgba(40,30,10,0.7)'; g.lineWidth = 3; g.strokeRect(1, 1, 126, 62); g.strokeRect(1, 65, 126, 62); }
  else if (kind === 'wood') { g.strokeStyle = 'rgba(30,15,5,0.55)'; g.lineWidth = 2; for (let i = 0; i <= 128; i += 21) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,30,10,${r() * 0.12})`; g.fillRect(r() * 128, r() * 128, 30, 1.5); } }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};
const glowTex = (inner = 'rgba(255,255,255,1)') => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d')!; const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
};

export function buildWorld(reg: RegionDef, q: Quality, scene: THREE.Scene, spawnAvoid: [number, number][]): WorldHandle {
  const group = new THREE.Group(); const R = rng(hash(reg.id)); const disposables: { dispose(): void }[] = [];
  const colliders: { x: number; z: number; r: number }[] = []; const gates: { pos: THREE.Vector3; to: string }[] = [];
  const hx = reg.hx; const hz = reg.hz;
  const pond = reg.pond;
  const noise = (x: number, z: number) => Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06) + 0.5 * Math.sin(x * 0.13 + z * 0.11) + 0.25 * Math.sin(x * 0.29 - z * 0.23);
  const hAt = (x: number, z: number) => {
    let h = 0; if (reg.hill > 0) h = noise(x, z) * reg.hill * sstep(16, 46, Math.hypot(x, z)) + reg.hill * 0.2 * sstep(30, 70, Math.hypot(x, z));
    if (pond) { const d = Math.hypot(x - pond.x, z - pond.z); h -= 1.4 * (1 - sstep(pond.r * 0.55, pond.r * 1.15, d)); }
    return h;
  };
  // ---- terrain
  const tw = hx * 2 + 40; const td = hz * 2 + 40; const sx = Math.min(130, Math.round(q.seg * (tw / 120))); const sz = Math.min(130, Math.round(q.seg * (td / 120)));
  const tg = new THREE.PlaneGeometry(tw, td, sx, sz); tg.rotateX(-Math.PI / 2);
  const pa = tg.attributes.position as THREE.BufferAttribute; const colA = new Float32Array(pa.count * 3);
  const c1 = new THREE.Color(reg.ground[0]); const c2 = new THREE.Color(reg.ground[1]); const cc = new THREE.Color();
  const street = ['village', 'asakusa', 'district'].includes(reg.id); const road = new THREE.Color(reg.id === 'village' ? 0x9a8a68 : 0x5a5662);
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i); const z = pa.getZ(i); const y = hAt(x, z); pa.setY(i, y); const n = 0.5 + 0.5 * noise(x * 1.7, z * 1.7);
    cc.copy(c1).lerp(c2, n); if (street) cc.lerp(road, 1 - sstep(7, 11, Math.abs(x))); if (pond) { const d = Math.hypot(x - pond.x, z - pond.z); if (d < pond.r * 1.25) cc.lerp(new THREE.Color(0x4a4a3a), 0.6); }
    colA.set([cc.r, cc.g, cc.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(colA, 3)); tg.computeVertexNormals();
  const gt = gradTex(reg.kind); gt.repeat.set(tw / 8, td / 8); disposables.push(gt);
  const tmat = new THREE.MeshToonMaterial({ vertexColors: true, map: gt, gradientMap: toonGrad }); const terrain = new THREE.Mesh(tg, tmat); terrain.receiveShadow = true; group.add(terrain); disposables.push(tg, tmat);

  // ---- props
  const timeU = { value: 0 };
  const mkMat = (glow: boolean, sway: boolean) => {
    const m = glow ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGrad });
    if (sway) m.onBeforeCompile = (sh) => { sh.uniforms.uTime = timeU; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float sw = sin(uTime*1.6 + instanceMatrix[3].x*0.35 + instanceMatrix[3].z*0.25) * 0.045 * max(0.0, position.y - 1.0);\n transformed.x += sw; transformed.z += sw*0.6;'); };
    disposables.push(m); return m;
  };
  const place = (kind: PropKind, x: number, z: number, ry: number, sc: number, rc: Recipe, lists: { m: THREE.Matrix4[] }) => {
    const y = hAt(x, z) + (rc.lift ?? 0); const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sc, kind === 'rock' ? sc * (0.7 + R() * 0.7) : sc, sc));
    lists.m.push(m);
    if (rc.r > 0) { if (kind === 'wall') { const cx = Math.cos(ry); const sn = Math.sin(ry); for (let k = -1; k <= 1; k += 1) colliders.push({ x: x + cx * k * 1.5, z: z - sn * k * 1.5, r: 1.1 }); } else colliders.push({ x, z, r: rc.r * (kind === 'rock' ? sc : 1) }); }
  };
  const lists: Partial<Record<PropKind, { m: THREE.Matrix4[] }>> = {}; const recs: Partial<Record<PropKind, Recipe>> = {};
  const get = (k: PropKind) => { if (!(k in recs)) { const r = recipe(k, reg); if (r) { recs[k] = r; lists[k] = { m: [] }; } } return recs[k] ? { rc: recs[k]!, l: lists[k]! } : null; };
  const avoid = (x: number, z: number, rad: number) => spawnAvoid.some(([ax, az]) => Math.hypot(x - ax, z - az) < rad) || (pond ? Math.hypot(x - pond.x, z - pond.z) < pond.r + 1.5 : false);
  const dens = q.density;
  reg.props.forEach((spec: PropSpec) => {
    const kind = spec[0]; let n = spec[1];
    if (kind === 'wall') {
      const e = get('wall')!; if (!e) return; const perim: [number, number, number][] = [];
      for (let x = -hx + 2; x <= hx - 1; x += 4) { perim.push([x, -hz, 0]); perim.push([x, hz, 0]); } for (let z = -hz + 2; z <= hz - 1; z += 4) { perim.push([-hx, z, Math.PI / 2]); perim.push([hx, z, Math.PI / 2]); }
      perim.forEach(([x, z, ry]) => place('wall', x, z, ry, 1, e.rc, e.l)); return;
    }
    if (kind === 'mansion') {
      if (reg.id === 'tsuzumi') { const e = get('wall')!; for (let i = 0; i < 12; i++) { const px = Math.round((R() * 2 - 1) * (hx - 8) / 4) * 4; const pz = Math.round((R() * 2 - 1) * (hz - 8) / 4) * 4; if (Math.hypot(px - 0, pz - 20) < 12 || Math.hypot(px, pz) < 8) continue; const ry = R() < 0.5 ? 0 : Math.PI / 2; place('wall', px, pz, ry, 1, e.rc, e.l); place('wall', px + (ry ? 0 : 4), pz + (ry ? 4 : 0), ry, 1, e.rc, e.l); } }
      else { const e = get('house')!; place('house', spec[2] as number, spec[3] as number, 0, 1.9, e.rc, e.l); colliders.push({ x: spec[2] as number, z: spec[3] as number, r: 8 }); }
      return;
    }
    if (kind === 'rail') {
      const wl = new Rec(); const gl = new Rec();
      for (let z = -hz; z < hz; z += 8) {
        for (const s of [-1, 1]) { wl.box(0.4, 1.2, 8, s * (hx + 0.2), 0.6, z + 4, 0x4a2e1c); wl.box(0.4, 1.3, 8, s * (hx + 0.2), 3.35, z + 4, 0x4a2e1c); wl.box(0.4, 0.5, 2, s * (hx + 0.2), 1.45, z + 1, 0x3a2418); gl.box(0.1, 1.5, 3, s * (hx + 0.1), 2.15, z + 4, 0x3a60b0); wl.box(0.4, 3.6, 0.6, s * (hx + 0.2), 1.8, z, 0x3a2418); }
        wl.box(hx * 2, 0.3, 0.5, 0, 3.9, z, 0x3a2418); gl.sph(0.3, 0, 3.5, z + 3, 0xffd890);
      }
      const geo = wl.build(); const m = new THREE.Mesh(geo, mkMat(false, false)); group.add(m); disposables.push(geo);
      const gg = gl.build(); const gm = new THREE.Mesh(gg, mkMat(true, false)); group.add(gm); disposables.push(gg);
      for (let z = -hz + 3; z < hz; z += 6) { colliders.push({ x: hx + 0.6, z, r: 1.2 }); colliders.push({ x: -hx - 0.6, z, r: 1.2 }); }
      return;
    }
    const e = get(kind); if (!e) return;
    if (spec.length === 6) { // line
      const [, , x0, z0, x1, z1] = spec; const cnt = Math.max(1, Math.round(n * Math.min(1, dens + 0.3)));
      for (let i = 0; i < cnt; i++) { const t = cnt === 1 ? 0 : i / (cnt - 1); let x = x0 + (x1 - x0) * t; const z = z0 + (z1 - z0) * t; x += (R() - 0.5) * (kind === 'house' || kind === 'shop' ? 1 : 2); if (avoid(x, z, 5)) continue; const side = x < 0 ? Math.PI / 2 : -Math.PI / 2; place(kind, x, z, kind === 'house' || kind === 'shop' ? (Math.abs(x) < 3 ? 0 : side) : R() * 6.28, 1, e.rc, e.l); }
    } else {
      const [, , rmin, rmax] = spec; n = Math.round(n * (['lantern', 'torii', 'cliff', 'pillar', 'house'].includes(kind) ? 1 : dens));
      for (let i = 0; i < n; i++) {
        let tries = 0, x = 0, z = 0;
        do { const a = R() * 6.28; const r = rmin + R() * (rmax - rmin); x = Math.cos(a) * r * (hx / 60); z = Math.sin(a) * r * (hz / 60); tries++; } while ((avoid(x, z, 6) || Math.abs(x) > hx - 1 || Math.abs(z) > hz - 1) && tries < 8);
        if (tries >= 8 && avoid(x, z, 6)) continue;
        const sc = e.rc.scale[0] + R() * (e.rc.scale[1] - e.rc.scale[0]);
        if (kind === 'platform') { const a = R() * 6.28; const r = rmin + R() * (rmax - rmin); const pos = new THREE.Vector3(Math.cos(a) * r, 6 + R() * 22, Math.sin(a) * r); const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.5, R() * 6, (R() - 0.5) * 0.5)), new THREE.Vector3(sc, 1, sc)); e.l.m.push(m); continue; }
        if (kind === 'pagoda') { const a = R() * 6.28; const r = rmin + R() * (rmax - rmin); const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, -10 + R() * 30, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.7, R() * 6, (R() - 0.5) * 0.7)), new THREE.Vector3(sc * 1.3, sc * 1.3, sc * 1.3)); e.l.m.push(m); continue; }
        place(kind, x, z, R() * 6.28, sc, e.rc, e.l);
      }
    }
  });
  (Object.keys(recs) as PropKind[]).forEach((k) => {
    const rc = recs[k]!; const l = lists[k]!; if (!l.m.length) return;
    const mk = (geo: THREE.BufferGeometry, glow: boolean) => {
      const im = new THREE.InstancedMesh(geo, mkMat(glow, !!rc.sway), l.m.length); l.m.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere(); im.castShadow = !glow && q.shadows !== 'off' && ['house', 'shop', 'pillar', 'forge', 'pagoda', 'cliff', 'wall'].includes(k); im.receiveShadow = !glow; group.add(im); disposables.push(geo);
    };
    mk(rc.solid, false); if (rc.glow) mk(rc.glow, true);
  });
  // ---- water
  const waterMats: THREE.MeshBasicMaterial[] = []; const wcv = document.createElement('canvas'); wcv.width = wcv.height = 128; const wg = wcv.getContext('2d')!;
  wg.fillStyle = '#4aa0d0'; wg.fillRect(0, 0, 128, 128); wg.strokeStyle = 'rgba(255,255,255,0.35)'; wg.lineWidth = 2;
  for (let i = 0; i < 12; i++) { const y = i * 11 + 3; wg.beginPath(); wg.moveTo(0, y); for (let x = 0; x <= 128; x += 8) wg.lineTo(x, y + Math.sin(x * 0.2 + i) * 3); wg.stroke(); }
  const wtex = new THREE.CanvasTexture(wcv); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.colorSpace = THREE.SRGBColorSpace; disposables.push(wtex);
  if (pond) {
    const wm = new THREE.MeshBasicMaterial({ map: wtex, transparent: true, opacity: 0.78, color: 0xaadcf0 }); const pm = new THREE.Mesh(new THREE.CircleGeometry(pond.r * 1.1, 32).rotateX(-Math.PI / 2), wm); pm.position.set(pond.x, -0.45, pond.z); wtex.repeat.set(4, 4); group.add(pm); waterMats.push(wm); disposables.push(wm, pm.geometry);
  }
  let wfTex: THREE.CanvasTexture | null = null;
  if (reg.waterfall) {
    const [wx, wz, wh] = reg.waterfall; const rk = new THREE.Mesh(new THREE.BoxGeometry(16, wh + 6, 6), new THREE.MeshToonMaterial({ color: 0x5a5a62, gradientMap: toonGrad })); rk.position.set(wx, (wh + 6) / 2 - 1, wz - 1); group.add(rk); disposables.push(rk.geometry, rk.material as THREE.Material);
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g2 = cv.getContext('2d')!; g2.fillStyle = '#9ad8f4'; g2.fillRect(0, 0, 64, 128); g2.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 26; i++) g2.fillRect(R() * 64, R() * 128, 2 + R() * 3, 18 + R() * 40);
    wfTex = new THREE.CanvasTexture(cv); wfTex.wrapS = wfTex.wrapT = THREE.RepeatWrapping; wfTex.colorSpace = THREE.SRGBColorSpace; wfTex.repeat.set(1, 2); disposables.push(wfTex);
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(6, wh + 4), new THREE.MeshBasicMaterial({ map: wfTex, transparent: true, opacity: 0.85 })); fm.position.set(wx, (wh + 4) / 2 - 1, wz + 2.1); group.add(fm); disposables.push(fm.geometry, fm.material as THREE.Material);
    const pl = new THREE.Mesh(new THREE.CircleGeometry(7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb0e4f8, transparent: true, opacity: 0.5 })); pl.position.set(wx, 0.05, wz + 6); group.add(pl); disposables.push(pl.geometry, pl.material as THREE.Material);
    colliders.push({ x: wx - 5, z: wz, r: 4 }, { x: wx, z: wz, r: 4 }, { x: wx + 5, z: wz, r: 4 });
  }
  // ---- gates
  reg.gates.forEach((to, i) => {
    const a = Math.PI * 0.15 + (i / reg.gates.length) * Math.PI * 1.7 + (hash(reg.id) % 100) / 100; const px = Math.cos(a) * (hx - 7); const pz = Math.sin(a) * (hz - 7) ; const y = hAt(px, pz);
    const gg = new THREE.Group(); gg.position.set(px, y, pz); gg.rotation.y = -a + Math.PI / 2;
    const red = new THREE.MeshToonMaterial({ color: 0xc82a20, gradientMap: toonGrad }); const blk = new THREE.MeshToonMaterial({ color: 0x14141a, gradientMap: toonGrad }); disposables.push(red, blk);
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 6, 8), red); p1.position.set(-2.4, 3, 0); const p2 = p1.clone(); p2.position.x = 2.4;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.4, 0.6), blk); b1.position.y = 6.1; const b2 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 0.4), red); b2.position.y = 5.2;
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.8), new THREE.MeshBasicMaterial({ color: 0x9a8aff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); pm.position.y = 2.6; pm.name = 'portal';
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const cg = cv.getContext('2d')!; cg.font = '700 30px Georgia'; cg.textAlign = 'center'; cg.fillStyle = '#fff'; cg.strokeStyle = '#000'; cg.lineWidth = 5; cg.strokeText(to.toUpperCase(), 128, 40); cg.fillText(to.toUpperCase(), 128, 40);
    const lt = new THREE.CanvasTexture(cv); const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false })); lab.scale.set(5, 1.25, 1); lab.position.y = 7.4;
    gg.add(p1, p2, b1, b2, pm, lab); group.add(gg); disposables.push(p1.geometry, b1.geometry, b2.geometry, pm.geometry, pm.material as THREE.Material, lt, lab.material); gates.push({ pos: new THREE.Vector3(px, y, pz), to });
    colliders.push({ x: px + Math.cos(-a) * 2.4, z: pz - Math.sin(-a) * 2.4, r: 0.5 });
  });
  // ---- POI beacon
  const poiPos = new THREE.Vector3(reg.poi.at[0], hAt(reg.poi.at[0], reg.poi.at[1]), reg.poi.at[1]);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beacon.position.copy(poiPos).setY(poiPos.y + 7); group.add(beacon); disposables.push(beacon.geometry, beacon.material as THREE.Material);

  // ---- sky, stars, sun/moon, lights
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = normalize(vP).y; float t = pow(clamp(h*1.4+0.05,0.0,1.0),0.7); gl_FragColor = vec4(mix(hor, top, t),1.0);\n#include <colorspace_fragment>\n }' });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 14), skyMat); sky.renderOrder = -10; group.add(sky); disposables.push(sky.geometry, skyMat);
  const sg = new Float32Array(500 * 3); for (let i = 0; i < 500; i++) { const a = R() * 6.28; const e = Math.acos(R() * 0.95 + 0.05) ; sg.set([Math.sin(e) * Math.cos(a) * 360, Math.cos(e) * 360, Math.sin(e) * Math.sin(a) * 360], i * 3); }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sg, 3)); const smat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false });
  const stars = new THREE.Points(sgeo, smat); group.add(stars); disposables.push(sgeo, smat);
  const gtx = glowTex(); disposables.push(gtx);
  const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtx, color: 0xfff0b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sunSp.scale.set(120, 120, 1);
  const moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtx, color: 0xcfe0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); moonSp.scale.set(70, 70, 1);
  const moonCore = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf4f0e0, fog: false })); group.add(sunSp, moonSp, moonCore); disposables.push(sunSp.material, moonSp.material, moonCore.geometry, moonCore.material as THREE.Material);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 1); const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = q.shadows !== 'off';
  const ss = q.shadows === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(ss, ss); const sc = sun.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 160; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  group.add(hemi, sun, sun.target);
  const fog = new THREE.FogExp2(0x888888, reg.fog); scene.fog = fog;

  // ---- weather
  const wcount = Math.floor(450 * q.weather); let weather: THREE.Object3D | null = null; const wpos = new Float32Array(wcount * 3); const wvel = new Float32Array(wcount);
  const wBox = 34;
  if (reg.weather !== 'none' && wcount > 0) {
    for (let i = 0; i < wcount; i++) { wpos.set([(R() - 0.5) * wBox * 2, R() * 22, (R() - 0.5) * wBox * 2], i * 3); wvel[i] = 0.6 + R() * 0.8; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
    const col = reg.weather === 'snow' ? 0xffffff : reg.weather === 'petals' ? 0xffb8d0 : reg.weather === 'embers' ? 0xff9a40 : reg.weather === 'mist' ? 0xcfe0e0 : 0xaac8ff;
    const m = new THREE.PointsMaterial({ color: col, size: reg.weather === 'mist' ? 7 : reg.weather === 'snow' ? 0.22 : 0.3, transparent: true, opacity: reg.weather === 'mist' ? 0.12 : 0.85, map: gtx, depthWrite: false, blending: reg.weather === 'embers' ? THREE.AdditiveBlending : THREE.NormalBlending });
    weather = new THREE.Points(g, m); weather.frustumCulled = false; group.add(weather); disposables.push(g, m);
  }

  const dayTop = new THREE.Color(reg.sky.day[0]); const dayHor = new THREE.Color(reg.sky.day[1]); const nTop = new THREE.Color(reg.sky.night[0]); const nHor = new THREE.Color(reg.sky.night[1]);
  const tmpA = new THREE.Color(); const tmpB = new THREE.Color(); const warm = new THREE.Color(0xff9060);
  const handle: WorldHandle = {
    group, colliders, gates, hAt, night: 1, sun, poi: poiPos, rain: reg.weather === 'rain',
    setShadow(s) { sun.castShadow = s !== 'off'; },
    update(dt, time, cam, player) {
      timeU.value += dt; if (wfTex) wfTex.offset.y -= dt * 1.2; waterMats.forEach((m) => { if (m.map) { m.map.offset.x += dt * 0.03; m.map.offset.y += dt * 0.02; } });
      const t = reg.fixedTime ?? time; const sunE = Math.sin((t - 0.25) * Math.PI * 2); const day = sstep(-0.12, 0.3, sunE); handle.night = 1 - day;
      tmpA.copy(nTop).lerp(dayTop, day); tmpB.copy(nHor).lerp(dayHor, day);
      if (reg.fixedTime === undefined) tmpB.lerp(warm, Math.max(0, 1 - Math.abs(sunE) / 0.22) * 0.55);
      skyMat.uniforms.top.value.copy(tmpA); skyMat.uniforms.hor.value.copy(tmpB); fog.color.copy(tmpB).multiplyScalar(0.85); fog.density = reg.fog * (1 + (1 - day) * 0.25);
      sky.position.copy(cam); stars.position.copy(cam); (stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - day * 1.4);
      const az = 0.7; const sd = new THREE.Vector3(Math.cos(az) * Math.cos(sunE * 1.2), Math.max(sunE, -0.2) * 0.9 + 0.1, Math.sin(az) * Math.cos(sunE * 1.2)).normalize();
      const md = new THREE.Vector3(-0.4, 0.75, -0.55).normalize(); const L = day > 0.35 ? sd : md;
      sun.position.copy(player).addScaledVector(L, 60); sun.target.position.copy(player); sun.target.updateMatrixWorld();
      sun.color.copy(day > 0.35 ? new THREE.Color(0xfff0d8).lerp(warm, Math.max(0, 1 - sunE * 2.5) * 0.6) : new THREE.Color(0x9ab4ff)); sun.intensity = day > 0.35 ? 1.4 + day * 1.6 : 1.1 + (reg.id === 'natagumo' ? -0.3 : 0);
      hemi.color.copy(tmpA).lerp(new THREE.Color(0xffffff), 0.5); hemi.groundColor.copy(tmpB).multiplyScalar(0.5); hemi.intensity = 0.8 + day * 0.7;
      sunSp.position.copy(cam).addScaledVector(sd, 330); sunSp.visible = sunE > -0.1 && !reg.fixedTime || reg.id === 'final'; moonSp.position.copy(cam).addScaledVector(md.clone().multiplyScalar(1), 330).setY(cam.y + 190); moonCore.position.copy(moonSp.position);
      const nv = day < 0.5 && reg.id !== 'infinity' && reg.id !== 'final'; moonSp.visible = nv; moonCore.visible = nv; (sunSp.material as THREE.SpriteMaterial).opacity = reg.id === 'final' ? 1 : 0.9;
      if (reg.id === 'final') sunSp.position.set(cam.x + 200, cam.y + 30, cam.z - 320);
      beacon.rotation.y += dt * 0.5; (beacon.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(time * 40) * 0.04;
      if (weather) {
        const pa2 = (weather as THREE.Points).geometry.attributes.position as THREE.BufferAttribute; const w = reg.weather;
        for (let i = 0; i < wcount; i++) {
          let x = wpos[i * 3]; let y = wpos[i * 3 + 1]; let z = wpos[i * 3 + 2];
          const sp = w === 'rain' ? 22 : w === 'snow' ? 1.8 : w === 'petals' ? 0.9 : w === 'embers' ? -1.5 : 0.1;
          y -= sp * wvel[i] * dt; if (w === 'snow' || w === 'petals') { x += Math.sin(timeU.value + i) * dt * 0.8; z += Math.cos(timeU.value * 0.7 + i) * dt * 0.5; } if (w === 'embers') x += Math.sin(timeU.value + i) * dt;
          if (w === 'mist') { x += dt * 0.6 * wvel[i]; }
          if (y < -1) y += 22; if (y > 22) y -= 22; wpos[i * 3] = x; wpos[i * 3 + 1] = y; wpos[i * 3 + 2] = z;
          let wx = x + cam.x; let wz = z + cam.z; wx = ((wx - cam.x + wBox * 3) % (wBox * 2)) - wBox + cam.x; wz = ((wz - cam.z + wBox * 3) % (wBox * 2)) - wBox + cam.z;
          pa2.setXYZ(i, wx, y + Math.max(-1, hAt(cam.x, cam.z)), wz);
        }
        pa2.needsUpdate = true;
      }
      group.children.forEach((c) => { if (c.type === 'Group' && c.children.some((k) => k.name === 'portal')) { const p = c.children.find((k) => k.name === 'portal') as THREE.Mesh; (p.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(time * 3) * 0.12; } });
    },
    dispose() {
      group.removeFromParent(); disposables.forEach((d) => d.dispose()); group.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); });
      scene.fog = null;
    },
  };
  return handle;
}
