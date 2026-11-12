import * as THREE from 'three';
import { GB, GC, GK, GS, M, glowM, mk } from './models';
import { addBox, addCircle, regionAt, terrainHeight, type Collider } from './terrain';
import { REGIONS, TERRITORIES, type RegionId } from './data';

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export interface Interactable { id: string; kind: string; x: number; y: number; z: number; r: number; label: string; data?: string }
export interface Destr { x: number; y: number; z: number; r: number; kind: string; alive: boolean; refs: [Batch, number][]; col?: Collider; color: string }

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export class Batch {
  mesh: THREE.InstancedMesh; n = 0;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, public max: number, parent: THREE.Object3D, shadow = false) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.count = 0; this.mesh.castShadow = shadow; this.mesh.receiveShadow = true; this.mesh.frustumCulled = true; parent.add(this.mesh);
  }
  add(x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, color?: string, rx = 0, rz = 0) {
    if (this.n >= this.max) return -1; _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); this.mesh.setMatrixAt(this.n, _m);
    if (color) this.mesh.setColorAt(this.n, _c.set(color)); this.mesh.count = ++this.n; return this.n - 1;
  }
  kill(i: number) { this.mesh.setMatrixAt(i, ZERO); this.mesh.instanceMatrix.needsUpdate = true; }
  finish() { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; this.mesh.computeBoundingSphere(); this.mesh.computeBoundingBox(); }
}

export const W = {
  root: new THREE.Group(), interactables: [] as Interactable[], destr: [] as Destr[], banners: {} as Record<string, { mat: THREE.MeshStandardMaterial; flag: THREE.Mesh }>, anim: [] as ((t: number, dt: number, cam: THREE.Vector3) => void)[],
  hq: {} as Record<string, { x: number; z: number; yaw: number }>, council: [] as { x: number; z: number; yaw: number }[], cmdPos: { x: 0, z: 0 }, throne: new THREE.Vector3(0, 4.2, -41), commanderHQ: [] as { x: number; z: number }[],
  dungeonLights: [] as THREE.PointLight[], batches: [] as Batch[], pois: [] as { id: string; x: number; z: number; r: number }[], dummies: [] as THREE.Group[], lamps: [] as THREE.Mesh[],
};
export const addInteract = (i: Interactable) => W.interactables.push(i);

/** static box with optional collider */
export function sbox(p: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: string, o: { col?: boolean; rot?: number; em?: string; ei?: number; metal?: number; rough?: number; base?: number; cast?: boolean } = {}) {
  const m = mk(p, GB(w, h, d), M(color, { em: o.em, ei: o.ei, metal: o.metal ?? 0.2, rough: o.rough ?? 0.8 }), x, y + h / 2, z); m.rotation.y = o.rot ?? 0; m.castShadow = o.cast !== false; m.receiveShadow = true;
  if (o.col) { const g = p.position; const rot = (p.rotation.y || 0); const c = Math.cos(rot), s = Math.sin(rot); const wx = g.x + x * c + z * s, wz = g.z - x * s + z * c; return addBox(wx, wz, w / 2, d / 2, (o.rot ?? 0) + rot, g.y + y + h, g.y + y - 0.5); }
  return undefined;
}
export function scyl(p: THREE.Object3D, rt: number, rb: number, h: number, x: number, y: number, z: number, color: string, o: { col?: boolean; seg?: number; em?: string; ei?: number; metal?: number } = {}) {
  const m = mk(p, GC(rt, rb, h, o.seg ?? 10), M(color, { em: o.em, ei: o.ei, metal: o.metal ?? 0.2, rough: 0.8 }), x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
  if (o.col) { const g = p.position; return addCircle(g.x + x, g.z + z, Math.max(rt, rb), g.y + y + h, g.y + y - 0.5); }
  return undefined;
}
export function scone(p: THREE.Object3D, r: number, h: number, x: number, y: number, z: number, color: string, seg = 8, o: { em?: string; ei?: number } = {}) {
  const m = mk(p, GK(r, h, seg), M(color, { em: o.em, ei: o.ei, metal: 0.2, rough: 0.7 }), x, y + h / 2, z); m.castShadow = true; return m;
}
export function sdome(p: THREE.Object3D, r: number, x: number, y: number, z: number, color: string, em?: string, sy = 1) {
  const g = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); const m = new THREE.Mesh(g, M(color, { metal: 0.6, rough: 0.3, em, ei: em ? 0.6 : 0 })); m.position.set(x, y, z); m.scale.y = sy; m.castShadow = true; p.add(m); return m;
}
export function label(text: string, color = '#ffd0d0', scale = 1) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d')!; c.font = 'bold 44px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = '#000'; c.shadowBlur = 10; c.fillStyle = color; c.fillText(text, 256, 48); c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2; c.strokeText(text, 256, 48);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false })); s.scale.set(26 * scale, 4.9 * scale, 1); return s;
}
export const FIRE_M = () => glowM('#ff8a2a', 2.4);

/** flickering brazier */
export function brazier(p: THREE.Object3D, x: number, y: number, z: number, color = '#ff7a2a', s = 1) {
  scyl(p, 0.5 * s, 0.9 * s, 1.6 * s, x, y, z, '#1a1216'); const f = new THREE.Group(); f.position.set(x, y + 1.7 * s, z); p.add(f);
  const m1 = mk(f, GK(0.6 * s, 1.6 * s, 6), glowM(color, 2.2), 0, 0.8 * s, 0), m2 = mk(f, GK(0.35 * s, 1.1 * s, 5), glowM('#fff0a0', 2.4), 0, 0.55 * s, 0);
  const ph = Math.random() * 10; W.anim.push((t) => { const k = 1 + Math.sin(t * 11 + ph) * 0.12 + Math.sin(t * 17 + ph) * 0.08; m1.scale.set(k, 1 + (k - 1) * 2, k); m2.scale.set(k * 0.9, 1 + (k - 1) * 2.5, k * 0.9); });
}
export function banner(p: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, color: string, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; p.add(g); mk(g, GB(0.15, 0.15, 0.15), M('#c8a040', { metal: 0.9 }), 0, 0, 0); mk(g, GB(w + 0.4, 0.2, 0.2), M('#c8a040', { metal: 0.9 }), 0, 0, 0);
  const cl = mk(g, GB(w, h, 0.06), M(color, { rough: 0.9, metal: 0, em: color, ei: 0.15 }), 0, -h / 2 - 0.1, 0); mk(g, GS(Math.min(w, h) * 0.18, 8, 6), glowM('#ffd24a', 1.2), 0, -h * 0.4, 0.06); return cl;
}

export function onSurface(x: number, z: number) { return terrainHeight(x, z); }
export function scatter(reg: RegionId, n: number, fn: (x: number, y: number, z: number, r: () => number) => void, seed = 1, o: { rmin?: number; rmax?: number; avoid?: number; filter?: (x: number, y: number, z: number) => boolean } = {}) {
  const r = rng(seed * 7919 + reg.length * 131); const R = REGIONS.find((q) => q.id === reg)!; let placed = 0, tries = 0;
  while (placed < n && tries < n * 14) {
    tries++; const a = R.angle + (r() - 0.5) * 0.8 * Math.PI / 2 * 2 * 0.98; const rad = (o.rmin ?? 215) + Math.sqrt(r()) * ((o.rmax ?? 675) - (o.rmin ?? 215));
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad; if (regionAt(x, z) !== reg) continue;
    const y = terrainHeight(x, z); if (reg !== 'ocean' && y < 0.3) continue; if (reg === 'ocean' && y > -2) continue;
    let bad = false; for (const t of TERRITORIES) { if (Math.hypot(t.x - x, t.z - z) < t.flatR * (o.avoid ?? 1.6)) { bad = true; break; } } if (bad) continue;
    if (o.filter && !o.filter(x, y, z)) continue; fn(x, y, z, r); placed++;
  }
}
export function regDestr(kind: string, x: number, y: number, z: number, r: number, refs: [Batch, number][], col?: Collider, color = '#888') { W.destr.push({ x, y, z, r, kind, alive: true, refs, col, color }); }
