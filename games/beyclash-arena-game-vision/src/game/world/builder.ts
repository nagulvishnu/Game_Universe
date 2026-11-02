import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../battle/ai/ai';

export interface Collider {
  x: number; z: number; hw: number; hd: number; rot: number; r: number; round: boolean; tall: boolean; camOnly?: boolean;
}

export type Target = 'color' | 'win' | 'glow';
export interface Batch { color: THREE.BufferGeometry[]; win: THREE.BufferGeometry[]; glow: THREE.BufferGeometry[] }
export interface BuiltChunk { name: string; color?: THREE.BufferGeometry; win?: THREE.BufferGeometry; glow?: THREE.BufferGeometry }

const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
const unitBox = ni(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
const cyls = new Map<string, THREE.BufferGeometry>();
const unitCyl = (seg: number, top = 1) => {
  const k = `${seg}-${top}`;
  if (!cyls.has(k)) cyls.set(k, ni(new THREE.CylinderGeometry(top, 1, 1, seg).translate(0, 0.5, 0)));
  return cyls.get(k)!;
};
const unitIco = ni(new THREE.IcosahedronGeometry(1, 1));
const unitSphere = ni(new THREE.SphereGeometry(1, 12, 8));
const unitDome = ni(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2));
const unitTorus = ni(new THREE.TorusGeometry(1, 0.07, 6, 28).rotateX(Math.PI / 2));
const prismShape = new THREE.Shape();
prismShape.moveTo(-0.5, 0); prismShape.lineTo(0.5, 0); prismShape.lineTo(0, 1); prismShape.closePath();
const unitPrism = ni(new THREE.ExtrudeGeometry(prismShape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5));

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Builder {
  chunks = new Map<string, Batch>();
  cur!: Batch;
  curName = '';
  colliders: Collider[] = [];
  rng: () => number;
  jitterOn = true;
  rings: { x: number; y: number; z: number; r: number; color: string; speed: number; tilt: number }[] = [];
  jets: { x: number; z: number; y: number }[] = [];
  flags: { x: number; y: number; z: number; color: string }[] = [];
  floaters: { x: number; y: number; z: number; color: string; r: number }[] = [];

  constructor(seed = 7) { this.rng = mulberry32(seed); }

  use(name: string) {
    this.curName = name;
    if (!this.chunks.has(name)) this.chunks.set(name, { color: [], win: [], glow: [] });
    this.cur = this.chunks.get(name)!;
  }

  put(geo: THREE.BufferGeometry, hex: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0, target: Target = 'color', jitter = true) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    const g = geo.clone().applyMatrix4(_m);
    _c.set(hex);
    const j = jitter && this.jitterOn ? 0.94 + this.rng() * 0.12 : 1;
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r * j; arr[i * 3 + 1] = _c.g * j; arr[i * 3 + 2] = _c.b * j; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.cur[target].push(g);
  }

  box(x: number, y0: number, z: number, w: number, h: number, d: number, color: string, ry = 0, target: Target = 'color') {
    this.put(unitBox, color, x, y0, z, w, h, d, ry, 0, 0, target);
  }
  glow(x: number, y0: number, z: number, w: number, h: number, d: number, color: string, ry = 0) { this.box(x, y0, z, w, h, d, color, ry, 'glow'); }

  /** Box whose walls get the shared window texture. */
  wbox(x: number, y0: number, z: number, w: number, h: number, d: number, color: string, ry = 0) {
    const g = unitBox.clone();
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const rows = Math.max(1, Math.round(h / 3.4)) / 4;
    const cw = Math.max(1, Math.round(w / 3.2)) / 4;
    const cd = Math.max(1, Math.round(d / 3.2)) / 4;
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 6);
      if (face < 2) uv.setXY(i, uv.getX(i) * cd, uv.getY(i) * rows);
      else if (face < 4) uv.setXY(i, 0.01, 0.01);
      else uv.setXY(i, uv.getX(i) * cw, uv.getY(i) * rows);
    }
    this.put(g, color, x, y0, z, w, h, d, ry, 0, 0, 'win');
  }

  cyl(x: number, y0: number, z: number, rBot: number, h: number, color: string, seg = 12, rTop = 1, target: Target = 'color') {
    this.put(unitCyl(seg, rTop), color, x, y0, z, rBot, h, rBot, 0, 0, 0, target);
  }
  cone(x: number, y0: number, z: number, r: number, h: number, color: string, seg = 8) { this.put(unitCyl(seg, 0), color, x, y0, z, r, h, r); }
  ico(x: number, y: number, z: number, r: number, color: string, sy = 1) { this.put(unitIco, color, x, y, z, r, r * sy, r); }
  sphere(x: number, y: number, z: number, r: number, color: string, target: Target = 'color') { this.put(unitSphere, color, x, y, z, r, r, r, 0, 0, 0, target); }
  dome(x: number, y0: number, z: number, r: number, color: string, sy = 1) { this.put(unitDome, color, x, y0, z, r, r * sy, r); }
  torus(x: number, y: number, z: number, r: number, color: string, target: Target = 'color', tube = 1) { this.put(unitTorus, color, x, y, z, r, r * tube, r, 0, 0, 0, target); }
  gable(x: number, y0: number, z: number, w: number, h: number, d: number, color: string, ry = 0) { this.put(unitPrism, color, x, y0, z, w, h, d, ry); }
  /** cylinder lying on its side along local X rotated by ry */
  beam(x: number, y: number, z: number, r: number, len: number, color: string, ry = 0) {
    this.put(unitCyl(8), color, x, y, z, r, len, r, ry, 0, Math.PI / 2);
  }

  cBox(x: number, z: number, w: number, d: number, rot = 0, tall = true) {
    this.colliders.push({ x, z, hw: w / 2, hd: d / 2, rot, r: 0, round: false, tall });
  }
  cCircle(x: number, z: number, r: number, tall = true) {
    this.colliders.push({ x, z, hw: r, hd: r, rot: 0, r, round: true, tall });
  }

  finish(): BuiltChunk[] {
    const out: BuiltChunk[] = [];
    for (const [name, b] of this.chunks) {
      out.push({
        name,
        color: b.color.length ? mergeGeometries(b.color, false) ?? undefined : undefined,
        win: b.win.length ? mergeGeometries(b.win, false) ?? undefined : undefined,
        glow: b.glow.length ? mergeGeometries(b.glow, false) ?? undefined : undefined,
      });
      b.color.length = 0; b.win.length = 0; b.glow.length = 0;
    }
    return out;
  }
}

/** Local-space helper: place things relative to a rotated building origin. */
export class Local {
  c: number; s: number;
  constructor(public b: Builder, public cx: number, public cz: number, public rot: number) { this.c = Math.cos(rot); this.s = Math.sin(rot); }
  wx(lx: number, lz: number) { return this.cx + lx * this.c + lz * this.s; }
  wz(lx: number, lz: number) { return this.cz - lx * this.s + lz * this.c; }
  box(lx: number, y0: number, lz: number, w: number, h: number, d: number, color: string) { this.b.box(this.wx(lx, lz), y0, this.wz(lx, lz), w, h, d, color, this.rot); }
  wbox(lx: number, y0: number, lz: number, w: number, h: number, d: number, color: string) { this.b.wbox(this.wx(lx, lz), y0, this.wz(lx, lz), w, h, d, color, this.rot); }
  glow(lx: number, y0: number, lz: number, w: number, h: number, d: number, color: string) { this.b.glow(this.wx(lx, lz), y0, this.wz(lx, lz), w, h, d, color, this.rot); }
  gable(lx: number, y0: number, lz: number, w: number, h: number, d: number, color: string) { this.b.gable(this.wx(lx, lz), y0, this.wz(lx, lz), w, h, d, color, this.rot); }
  cyl(lx: number, y0: number, lz: number, r: number, h: number, color: string, seg = 10, top = 1) { this.b.cyl(this.wx(lx, lz), y0, this.wz(lx, lz), r, h, color, seg, top); }
  cone(lx: number, y0: number, lz: number, r: number, h: number, color: string, seg = 8) { this.b.cone(this.wx(lx, lz), y0, this.wz(lx, lz), r, h, color, seg); }
  dome(lx: number, y0: number, lz: number, r: number, color: string, sy = 1) { this.b.dome(this.wx(lx, lz), y0, this.wz(lx, lz), r, color, sy); }
}

let winTex: { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } | null = null;
export function windowTextures() {
  if (winTex) return winTex;
  const mk = (emissive: boolean) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = emissive ? '#000' : '#fff';
    g.fillRect(0, 0, 256, 256);
    let seed = 1234;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
      const lit = rnd() < 0.32;
      const x = cx * 64 + 12, y = cy * 64 + 10;
      if (emissive) {
        if (lit) { g.fillStyle = '#ffd98a'; g.fillRect(x, y, 40, 40); }
      } else {
        const grad = g.createLinearGradient(0, y, 0, y + 40);
        grad.addColorStop(0, lit ? '#fff0b8' : '#5b7aa8'); grad.addColorStop(1, lit ? '#ffd98a' : '#1d2c48');
        g.fillStyle = grad; g.fillRect(x, y, 40, 40);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, 40, 4);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 19, y, 2, 40);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  winTex = { map: mk(false), emissive: mk(true) };
  return winTex;
}
