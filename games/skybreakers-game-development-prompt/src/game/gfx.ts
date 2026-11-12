import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export interface MatOpt { em?: string | number; ei?: number; rough?: number; metal?: number; opacity?: number; flat?: boolean; side?: THREE.Side; add?: boolean }
export function mat(color: string | number, o: MatOpt = {}) {
  const key = `${color}|${o.em ?? ''}|${o.ei ?? ''}|${o.rough ?? ''}|${o.metal ?? ''}|${o.opacity ?? ''}|${o.flat ?? ''}|${o.side ?? ''}|${o.add ?? ''}`;
  let m = matCache.get(key); if (m) return m;
  m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0.05, flatShading: o.flat ?? true, emissive: o.em ?? 0x000000, emissiveIntensity: o.ei ?? (o.em ? 1 : 0), transparent: o.opacity !== undefined || !!o.add, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
  if (o.add) { m.blending = THREE.AdditiveBlending; m.depthWrite = false; }
  matCache.set(key, m); return m;
}
const geoCache = new Map<string, THREE.BufferGeometry>();
const G_ = <T extends THREE.BufferGeometry>(k: string, f: () => T): T => { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g as T; };
type V3 = [number, number, number];
const place = (m: THREE.Object3D, p?: V3, r?: V3, s?: V3 | number) => { if (p) m.position.set(...p); if (r) m.rotation.set(...r); if (s !== undefined) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s); } return m; };
export const box = (w: number, h: number, d: number, color: string | number, p?: V3, o?: MatOpt, r?: V3) => place(new THREE.Mesh(G_(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat(color, o)), p, r);
export const cyl = (rt: number, rb: number, h: number, color: string | number, p?: V3, o?: MatOpt, seg = 8, r?: V3) => place(new THREE.Mesh(G_(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat(color, o)), p, r);
export const cone = (r: number, h: number, color: string | number, p?: V3, o?: MatOpt, seg = 8, rot?: V3) => place(new THREE.Mesh(G_(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), mat(color, o)), p, rot);
export const sph = (r: number, color: string | number, p?: V3, o?: MatOpt, seg = 10, s?: V3 | number) => place(new THREE.Mesh(G_(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2))), mat(color, o)), p, undefined, s);
export const ico = (r: number, color: string | number, p?: V3, o?: MatOpt, detail = 0, s?: V3 | number) => place(new THREE.Mesh(G_(`i${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail)), mat(color, o)), p, undefined, s);
export const torus = (r: number, t: number, color: string | number, p?: V3, o?: MatOpt, rot?: V3, arc = Math.PI * 2) => place(new THREE.Mesh(G_(`t${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 6, 20, arc)), mat(color, o)), p, rot);
export const grp = (...c: (THREE.Object3D | null | undefined)[]) => { const g = new THREE.Group(); for (const x of c) if (x) g.add(x); return g; };
export const at = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0, rx?: number, ry?: number, rz?: number): T => { o.position.set(x, y, z); if (rx !== undefined || ry !== undefined || rz !== undefined) o.rotation.set(rx ?? 0, ry ?? 0, rz ?? 0); return o; };
/** limb pivot: group at pivot position with mesh hanging down by h */
export const limb = (w: number, h: number, d: number, color: string | number, px: number, py: number, pz: number, o?: MatOpt) => { const g = new THREE.Group(); g.position.set(px, py, pz); g.add(box(w, h, d, color, [0, -h / 2, 0], o)); return g; };

let glowT: THREE.Texture | null = null;
export function glowTex() {
  if (glowT) return glowT; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowT = new THREE.CanvasTexture(c); return glowT;
}
const spriteMats = new Map<string, THREE.SpriteMaterial>();
export function glow(color: string | number, size: number, p?: V3, opacity = 1) {
  const k = `${color}|${opacity}`; let m = spriteMats.get(k); if (!m) { m = new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false }); spriteMats.set(k, m); }
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); if (p) s.position.set(...p); return s;
}
let cloudT: THREE.Texture | null = null;
export function cloudTex() {
  if (cloudT) return cloudT; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) { const px = 64 + (Math.random() - 0.5) * 50, py = 64 + (Math.random() - 0.5) * 24, r = 20 + Math.random() * 20; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  cloudT = new THREE.CanvasTexture(c); return cloudT;
}

// ── merged vertex-colored geometry for instancing ──
export interface GPart { g: THREE.BufferGeometry; c: string; p?: V3; r?: V3; s?: V3 }
export function mergeParts(parts: GPart[]) {
  const geos = parts.map(({ g, c, p, r, s }) => {
    const x = g.index ? g.toNonIndexed() : g.clone(); const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(...(p || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r || [0, 0, 0]))), new THREE.Vector3(...(s || [1, 1, 1]))); x.applyMatrix4(m);
    const col = new THREE.Color(c); const n = x.attributes.position.count; const arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; } x.setAttribute('color', new THREE.BufferAttribute(arr, 3)); x.deleteAttribute('uv'); return x;
  });
  const out = mergeGeometries(geos)!; out.computeVertexNormals(); return out;
}
export const gBox = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const gCyl = (rt: number, rb: number, h: number, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
export const gCone = (r: number, h: number, s = 7) => new THREE.ConeGeometry(r, h, s);
export const gIco = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const gSph = (r: number, s = 8) => new THREE.SphereGeometry(r, s, s - 2);

export function shadowify<T extends THREE.Object3D>(o: T, on = true): T { o.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = on; } }); return o; }
export function tintAll(o: THREE.Object3D, fn: (m: THREE.MeshStandardMaterial) => void) { o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) { m.material = (m.material as THREE.MeshStandardMaterial).clone(); fn(m.material as THREE.MeshStandardMaterial); } }); }
