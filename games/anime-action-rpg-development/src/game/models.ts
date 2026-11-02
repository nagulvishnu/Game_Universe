// Procedural anime-styled 3D models with a joint-based skeletal rig and pose blending.
import * as THREE from 'three';

let _grad: THREE.DataTexture | null = null;
function grad() {
  if (!_grad) {
    const d = new Uint8Array([85, 85, 95, 255, 160, 160, 170, 255, 220, 220, 225, 255, 255, 255, 255, 255]);
    _grad = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true;
  }
  return _grad;
}
export function toon(color: number, em = 0, emI = 1) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: grad() });
  if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = emI; }
  m.userData.baseEm = m.emissive.clone(); m.userData.baseI = m.emissiveIntensity; return m;
}
const OLM = new THREE.MeshBasicMaterial({ color: 0x0a0710, side: THREE.BackSide });
const GC = new Map<string, THREE.BufferGeometry>();
function G(k: string, f: () => THREE.BufferGeometry) { let g = GC.get(k); if (!g) { g = f(); g.userData.keep = true; GC.set(k, g); } return g; }
export const gCap = (r: number, l: number) => G(`c${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10));
export const gSph = (r: number) => G(`s${r}`, () => new THREE.SphereGeometry(r, 14, 12));
export const gBox = (x: number, y: number, z: number) => G(`b${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z));
export const gCyl = (a: number, b: number, h: number, s = 10) => G(`y${a}_${b}_${h}_${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
export const gCone = (r: number, h: number, s = 8) => G(`n${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));
const gTor = (r: number, t: number, arc = Math.PI * 2) => G(`t${r}_${t}_${arc}`, () => new THREE.TorusGeometry(r, t, 6, 18, arc));
const gPlane = (w: number, h: number) => G(`p${w}_${h}`, () => new THREE.PlaneGeometry(w, h));

export interface AnimIn { state: string; speed: number; style?: string; t?: number; sprint?: boolean; air?: number }
export interface Model { root: THREE.Group; update(dt: number, a: AnimIn): void; flash(v: number): void; mats: THREE.MeshToonMaterial[]; dispose(): void; cape?: boolean }

// ── Eye textures (anime eyes) ──
const eyeCache = new Map<string, THREE.CanvasTexture>();
export function eyeTex(iris: string, hi = '#ffffff') {
  const k = iris + hi; let t = eyeCache.get(k); if (t) return t;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d')!;
  g.fillStyle = '#fbf8ff'; g.beginPath(); g.ellipse(32, 34, 26, 27, 0, 0, 7); g.fill();
  const gr = g.createLinearGradient(0, 8, 0, 60); gr.addColorStop(0, '#0a0818'); gr.addColorStop(0.45, iris); gr.addColorStop(1, hi === '#ffffff' ? '#e8f4ff' : hi);
  g.fillStyle = gr; g.beginPath(); g.ellipse(32, 35, 19, 25, 0, 0, 7); g.fill();
  g.fillStyle = '#05030c'; g.beginPath(); g.ellipse(32, 33, 8, 13, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(24, 24, 6, 7, 0, 0, 7); g.fill(); g.beginPath(); g.arc(40, 46, 3, 0, 7); g.fill();
  g.strokeStyle = '#120a1a'; g.lineWidth = 6; g.beginPath(); g.ellipse(32, 34, 27, 28, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; eyeCache.set(k, t); return t;
}
export function labelSprite(text: string, color = '#fff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d')!;
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(text, 128, 44); g.fillStyle = color; g.fillText(text, 128, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(3.2, 0.8, 1); s.renderOrder = 10; return s;
}

// ── Pose system ──
export type Pose = Record<string, number>;
const KEYS = ['rootY', 'hipsX', 'hipsZ', 'spineX', 'spineY', 'spineZ', 'headX', 'headY', 'aRX', 'aRY', 'aRZ', 'fRX', 'aLX', 'aLY', 'aLZ', 'fLX', 'lRX', 'lRZ', 'sRX', 'lLX', 'lLZ', 'sLX'];
const IDLE: Pose = { rootY: 0, hipsX: 0.03, hipsZ: 0, spineX: 0, spineY: 0, spineZ: 0, headX: 0, headY: 0, aRX: 0, aRY: 0, aRZ: -0.1, fRX: -0.25, aLX: 0, aLY: 0, aLZ: 0.1, fLX: -0.25, lRX: 0, lRZ: 0, sRX: 0, lLX: 0, lLZ: 0, sLX: 0 };
const P = (o: Pose): Pose => ({ ...IDLE, ...o });
const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function mix(a: Pose, b: Pose, t: number): Pose { const o: Pose = {}; for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t; return o; }
const ST: Record<string, [Pose, Pose]> = {
  slashR: [P({ aRX: -2.0, aRZ: -1.0, fRX: -0.9, spineY: -0.8, aLX: -0.4, aLZ: 0.5, lRX: -0.4, lLX: 0.3, sRX: 0.5, hipsX: 0.1 }), P({ aRX: -1.5, aRZ: 0.5, fRX: -0.2, spineY: 0.9, hipsX: 0.28, lRX: -0.7, lLX: 0.5, sLX: 0.4, aLX: 0.4, aLZ: 0.9 })],
  slashL: [P({ aRX: -1.6, aRZ: 0.4, fRX: -0.9, spineY: 0.7, aLX: -0.5, lLX: -0.4, lRX: 0.3, hipsX: 0.1 }), P({ aRX: -1.5, aRZ: -1.3, fRX: -0.2, spineY: -0.95, hipsX: 0.28, lLX: -0.7, lRX: 0.5, sRX: 0.4, aLX: 0.3 })],
  overhead: [P({ aRX: -3.0, aRZ: -0.2, fRX: -0.5, aLX: -2.8, aLZ: 0.2, fLX: -0.5, hipsX: -0.22, lRX: 0.2, lLX: -0.2 }), P({ aRX: -0.9, fRX: -0.1, aLX: -0.9, fLX: -0.1, hipsX: 0.55, spineX: 0.2, lRX: -0.8, lLX: 0.5, sLX: 0.5, rootY: -0.12 })],
  thrust: [P({ aRX: -1.0, fRX: -1.9, spineY: -0.5, aLX: -0.8, fLX: -1.0, lRX: 0.3, lLX: -0.3 }), P({ aRX: -1.55, fRX: -0.05, spineY: 0.4, hipsX: 0.3, lRX: -0.9, lLX: 0.6, sLX: 0.3, aLX: -0.4, aLZ: 0.5 })],
  spin: [P({ aRX: -1.5, aRZ: -1.4, fRX: -0.2, spineY: -1.0, aLZ: 1.3, lRX: -0.3, lLX: 0.3, hipsX: 0.1 }), P({ aRX: -1.5, aRZ: -1.5, fRX: -0.1, spineY: 1.0, aLZ: 1.4, hipsX: 0.15, lRX: -0.2, lLX: 0.2 })],
  uppercut: [P({ aRX: 0.4, fRX: -1.0, hipsX: 0.25, rootY: -0.18, lRX: -0.5, lLX: 0.3, sRX: 0.8, sLX: 0.6, spineY: -0.4, aLX: -0.7, fLX: -1.3 }), P({ aRX: -2.8, fRX: -0.2, hipsX: -0.2, rootY: 0.06, spineY: 0.5, lRX: -0.4, lLX: 0.4, aLX: -0.3 })],
  sweep: [P({ rootY: -0.35, hipsX: 0.5, aRX: -1.0, aRZ: -1.2, fRX: -0.3, spineY: -1.0, lLX: -0.9, lRX: -0.2, sRX: 1.2, sLX: 0.2, aLZ: 0.8 }), P({ rootY: -0.4, hipsX: 0.45, aRX: -1.3, aRZ: 0.7, fRX: -0.2, spineY: 1.1, lLX: -1.0, sRX: 1.3, aLZ: 1.0 })],
  slam: [P({ aRX: -3.0, aLX: -3.0, aRZ: -0.15, aLZ: 0.15, fRX: -0.4, fLX: -0.4, hipsX: -0.3 }), P({ aRX: -0.7, aLX: -0.7, fRX: -0.1, fLX: -0.1, hipsX: 0.85, rootY: -0.2, spineX: 0.3, lRX: -0.7, lLX: -0.7, sRX: 0.9, sLX: 0.9 })],
  cast: [P({ aRX: -0.6, aLX: -0.6, aRZ: -1.2, aLZ: 1.2, fRX: -1.2, fLX: -1.2, hipsX: -0.12, headX: -0.2 }), P({ aRX: -1.5, aLX: -1.5, aRZ: -0.12, aLZ: 0.12, fRX: -0.1, fLX: -0.1, hipsX: 0.18, lRX: -0.5, lLX: 0.3 })],
  jabR: [P({ aRX: 0.4, fRX: -1.7, spineY: -0.6, aLX: -1.0, fLX: -1.3, lRX: 0.3, lLX: -0.3 }), P({ aRX: -1.55, fRX: -0.05, spineY: 0.5, hipsX: 0.2, lRX: -0.8, lLX: 0.5, aLX: -0.7, fLX: -1.3 })],
  jabL: [P({ aLX: 0.4, fLX: -1.7, spineY: 0.6, aRX: -1.0, fRX: -1.3, lLX: 0.3, lRX: -0.3 }), P({ aLX: -1.55, fLX: -0.05, spineY: -0.5, hipsX: 0.2, lLX: -0.8, lRX: 0.5, aRX: -0.7, fRX: -1.3 })],
  roar: [P({ aRX: -0.5, aLX: -0.5, aRZ: -0.8, aLZ: 0.8, hipsX: 0.3, headX: 0.2 }), P({ aRX: -2.6, aLX: -2.6, aRZ: -0.6, aLZ: 0.6, fRX: -0.4, fLX: -0.4, hipsX: -0.3, headX: -0.5, rootY: 0.05 })],
  lunge: [P({ hipsX: -0.1 }), P({ hipsX: 0.2 })],
};
function attackPose(style: string, t: number): Pose {
  const [W, S] = ST[style] || ST.slashR;
  if (t < 0.3) return mix(IDLE, W, ease(t / 0.3));
  if (t < 0.5) return mix(W, S, ease((t - 0.3) / 0.2));
  if (t < 0.7) return S;
  return mix(S, IDLE, ease((t - 0.7) / 0.3));
}
const POSES: Record<string, Pose> = {
  jump: P({ aRX: -0.7, aRZ: -0.7, aLX: -0.5, aLZ: 0.7, fRX: -0.8, fLX: -0.8, lRX: -0.7, sRX: 1.1, lLX: 0.2, sLX: 0.4, hipsX: 0.1 }),
  fall: P({ aRX: -0.4, aRZ: -1.4, aLX: -0.4, aLZ: 1.4, fRX: -0.3, fLX: -0.3, lRX: -0.2, sRX: 0.4, lLX: 0.1, sLX: 0.3, hipsX: 0.05, headX: -0.1 }),
  land: P({ rootY: -0.26, hipsX: 0.4, lRX: -0.9, lLX: -0.9, sRX: 1.5, sLX: 1.5, aRX: -0.5, aLX: -0.5, spineX: 0.2 }),
  hit: P({ hipsX: -0.35, headX: -0.4, spineX: -0.2, aRX: 0.3, aLX: 0.3, aRZ: -0.7, aLZ: 0.7, lRX: -0.3, lLX: 0.3, sLX: 0.3 }),
  block: P({ aRX: -1.5, aLX: -1.35, aRZ: 0.35, aLZ: -0.25, fRX: -1.6, fLX: -1.6, hipsX: 0.15, lRX: -0.4, lLX: 0.3, sRX: 0.4, sLX: 0.3, rootY: -0.06 }),
  stagger: P({ hipsX: 0.45, headX: 0.55, spineX: 0.2, aRX: 0.2, aLX: 0.2, lRX: -0.2, lLX: 0.2, sRX: 0.3, rootY: -0.05 }),
  dazed: P({ hipsX: 0.25, headX: 0.5, headY: 0.4, aRX: 0.1, aLX: 0.1, aRZ: -0.3, aLZ: 0.3 }),
  lying: P({ hipsX: -1.57, rootY: -0.72, aRX: -0.3, aLX: -0.3, aRZ: -0.6, aLZ: 0.6, lRX: 0.0, lLX: 0.0, headX: 0.2, fRX: -0.2, fLX: -0.2 }),
  victory: P({ aRX: -3.0, aRZ: -0.3, fRX: -0.3, aLX: 0.2, aLZ: 0.3, hipsX: -0.1, headX: -0.25 }),
  transform: P({ aRZ: -1.3, aLZ: 1.3, aRX: -0.2, aLX: -0.2, fRX: -0.1, fLX: -0.1, headX: -0.5, hipsX: -0.15, rootY: 0.18, lRX: 0.1, lLX: -0.1 }),
  tfCrouch: P({ rootY: -0.3, hipsX: 0.5, aRX: 0.3, aLX: 0.3, aRZ: -0.4, aLZ: 0.4, lRX: -0.9, lLX: -0.9, sRX: 1.6, sLX: 1.6, headX: 0.3 }),
  dummy: P({ aRZ: -1.5, aLZ: 1.5, fRX: 0, fLX: 0 }),
  dodge: P({ hipsX: 0.7, rootY: -0.3, aRX: -0.6, aLX: -0.6, aRZ: -0.3, aLZ: 0.3, fRX: -1.5, fLX: -1.5, lRX: -1.2, lLX: -1.2, sRX: 1.8, sLX: 1.8 }),
  ultCharge: P({ aRX: -2.9, aLX: -2.9, aRZ: -0.5, aLZ: 0.5, fRX: -0.3, fLX: -0.3, hipsX: -0.25, headX: -0.4, rootY: 0.05 }),
};

export class Rig implements Model {
  root = new THREE.Group(); pivot = new THREE.Group(); mats: THREE.MeshToonMaterial[] = [];
  hips!: THREE.Group; spine!: THREE.Group; head!: THREE.Group; aR!: THREE.Group; fR!: THREE.Group; aL!: THREE.Group; fL!: THREE.Group; lR!: THREE.Group; sR!: THREE.Group; lL!: THREE.Group; sL!: THREE.Group;
  mountR!: THREE.Group; mountL!: THREE.Group; capeJ: THREE.Group | null = null; cape = false;
  pose: Pose = { ...IDLE }; phase = 0; time = Math.random() * 10; scale = 1; cfg: any; flashV = 0; fistR?: THREE.Mesh; fistL?: THREE.Mesh;
  weaponR?: THREE.Group; weaponL?: THREE.Group; b = 1; ol = false;
  T = (col: number, em = 0, ei = 1) => { const m = toon(col, em, ei); this.mats.push(m); return m; };
  part(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m);
    if (this.ol) { const o = new THREE.Mesh(geo, OLM); o.scale.setScalar(1.07); m.add(o); }
    return m;
  }
  constructor(c: any) {
    this.cfg = c; const b = (this.b = c.bulk || 1); const sc = (this.scale = c.scale || 1); this.ol = !!c.outline; this.root.scale.setScalar(sc);
    const T = this.T; const part = this.part.bind(this);
    const J = (p: THREE.Object3D, x: number, y: number, z: number) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
    this.root.add(this.pivot);
    this.hips = J(this.pivot, 0, 0.98, 0); this.spine = J(this.hips, 0, 0.08, 0); this.head = J(this.spine, 0, 0.6, 0);
    this.aR = J(this.spine, -0.27 * b, 0.5, 0); this.fR = J(this.aR, 0, -0.32, 0); this.aL = J(this.spine, 0.27 * b, 0.5, 0); this.fL = J(this.aL, 0, -0.32, 0);
    this.lR = J(this.hips, -0.1 * b, -0.02, 0); this.sR = J(this.lR, 0, -0.47, 0); this.lL = J(this.hips, 0.1 * b, -0.02, 0); this.sL = J(this.lL, 0, -0.47, 0);
    const skin = T(c.skin); const cloth = T(c.cloth, c.glow ? 0 : 0); const cloth2 = T(c.cloth2 ?? c.cloth); const dark = T(0x1a1620);
    const metal = c.head === 'helm' || c.head === 'horned' || c.head === 'golem';
    part(gSph(0.17), cloth2, this.hips, 0, 0, 0, b, 0.7, 0.85 * b);
    part(gCyl(0.22 * b, 0.16 * b, 0.52), cloth, this.spine, 0, 0.26, 0, 1, 1, 0.72);
    part(gCyl(0.175 * b, 0.175 * b, 0.07), dark, this.spine, 0, 0.03, 0, 1, 1, 0.78);
    part(gCyl(0.06 * b, 0.07 * b, 0.1), skin, this.spine, 0, 0.56, 0);
    const sleeve = c.hero || metal ? cloth : skin;
    for (const [a, f, sgn] of [[this.aR, this.fR, -1], [this.aL, this.fL, 1]] as const) {
      part(gSph(0.08 * b), cloth, a, 0, 0, 0); part(gCap(0.06 * b, 0.2), sleeve, a, 0, -0.16, 0);
      part(gCap(0.052 * b, 0.18), skin, f, 0, -0.14, 0); part(gSph(0.065 * b), skin, f, 0, -0.29, 0);
      if (metal || c.cracks) part(gSph(0.14 * b), cloth2, a, sgn * 0.04, 0.04, 0, 1, 0.75, 1);
    }
    for (const [l, s] of [[this.lR, this.sR], [this.lL, this.sL]] as const) {
      part(gCap(0.085 * b, 0.28), c.hero ? cloth2 : metal ? cloth2 : skin, l, 0, -0.24, 0); part(gCap(0.07 * b, 0.28), cloth2, s, 0, -0.24, 0); part(gBox(0.11 * b, 0.08, 0.24), dark, s, 0, -0.49, 0.05);
    }
    const eyeCol = c.eye ?? 0xffffff;
    const glowM = () => T(eyeCol, eyeCol, 1.6);
    const hd = this.head;
    switch (c.head) {
      case 'goblin': { part(gSph(0.2), skin, hd, 0, 0.2, 0, 1.2, 1, 1.05); for (const s of [-1, 1]) { const e = part(gCone(0.06, 0.32), skin, hd, s * 0.27, 0.26, 0); e.rotation.z = -s * 1.3; part(gSph(0.035), glowM(), hd, s * 0.09, 0.25, 0.19); } const n = part(gCone(0.045, 0.14), skin, hd, 0, 0.18, 0.22); n.rotation.x = Math.PI / 2; break; }
      case 'skull': { part(gSph(0.19), skin, hd, 0, 0.21, 0, 1, 1.05, 1); part(gBox(0.2, 0.08, 0.17), skin, hd, 0, 0.05, 0.07); for (const s of [-1, 1]) { part(gSph(0.05), T(0x050508), hd, s * 0.07, 0.23, 0.14); part(gSph(0.022), glowM(), hd, s * 0.07, 0.23, 0.17); } break; }
      case 'hood': { part(gSph(0.18), T(0x05030a), hd, 0, 0.2, 0.02); const h = part(gCone(0.27, 0.5, 10), cloth, hd, 0, 0.3, -0.05, 1, 1, 1.05); h.rotation.x = -0.15; for (const s of [-1, 1]) part(gBox(0.07, 0.03, 0.03), glowM(), hd, s * 0.07, 0.21, 0.17); break; }
      case 'helm': case 'horned': { part(gCyl(0.2, 0.19, 0.4, 8), cloth, hd, 0, 0.2, 0); part(gBox(0.28, 0.04, 0.06), glowM(), hd, 0, 0.23, 0.19); part(gCone(0.05, 0.22), cloth2, hd, 0, 0.5, -0.02); if (c.head === 'horned') for (const s of [-1, 1]) { const h = part(gCone(0.05, 0.4), T(0xd8d0b0), hd, s * 0.19, 0.4, 0); h.rotation.z = -s * 0.7; } break; }
      case 'ogre': { part(gSph(0.22), skin, hd, 0, 0.2, 0, 1.1, 0.95, 1.1); part(gBox(0.32, 0.1, 0.22), skin, hd, 0, 0.04, 0.1); for (const s of [-1, 1]) { part(gCone(0.03, 0.12), T(0xe8e0c0), hd, s * 0.1, 0.1, 0.22); part(gSph(0.03), glowM(), hd, s * 0.09, 0.26, 0.2); } part(gBox(0.34, 0.05, 0.1), cloth2, hd, 0, 0.3, 0.17); break; }
      case 'golem': { part(gBox(0.4, 0.34, 0.34), skin, hd, 0, 0.18, 0.02); for (const s of [-1, 1]) part(gBox(0.08, 0.045, 0.03), glowM(), hd, s * 0.09, 0.21, 0.2); part(gBox(0.3, 0.1, 0.24), cloth2, hd, 0, 0.0, 0.04); break; }
      case 'dummy': { part(gSph(0.19), T(0xc9a56a), hd, 0, 0.2, 0); for (const s of [-1, 1]) part(gBox(0.07, 0.015, 0.01), dark, hd, s * 0.07, 0.23, 0.185); const pole = part(gCyl(0.06, 0.07, 1.6), T(0x6a4a2a), this.pivot, 0, 0.8, -0.2); void pole; break; }
      default: { part(gSph(0.2), skin, hd, 0, 0.2, 0); }
    }
    if (c.crown) for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(gCone(0.03, 0.16), T(0xffd24a, 0xffa000, 0.6), hd, Math.sin(a) * 0.17, 0.46, Math.cos(a) * 0.17); }
    this.mountR = J(this.fR, 0, -0.34, 0); this.mountR.rotation.x = 2.73; this.mountL = J(this.fL, 0, -0.34, 0); this.mountL.rotation.x = 2.73;
    if (c.weapon && c.weapon !== 'none' && !c.hero) this.setWeapon(c.weapon, c.wcol ?? 0xaab4c4, c.glow || 0);
    if (c.shield) { const s = part(gCyl(0.26, 0.26, 0.05, 12), cloth2, this.fL, 0, -0.18, 0.12); s.rotation.x = Math.PI / 2; part(gSph(0.07), T(c.glow || 0x888890, c.glow || 0, 1), this.fL, 0, -0.18, 0.16); }
    if (c.cape) { this.capeJ = J(this.spine, 0, 0.52, -0.2); part(gBox(0.5 * b, 1.0, 0.04), T(c.cloth2 ?? 0x400020, c.glow || 0, 0.4), this.capeJ, 0, -0.5, -0.02); this.cape = true; }
    if (c.glow && c.head !== 'dummy') { for (let i = 0; i < 3; i++) part(gBox(0.2 * b, 0.025, 0.02), T(c.glow, c.glow, 1.5), this.spine, 0, 0.12 + i * 0.12, 0.13 * b); }
    if (c.cracks) { const cm = T(c.cracks, c.cracks, 1.8); for (let i = 0; i < 7; i++) { const m = part(gBox(0.03, 0.2 + (i % 3) * 0.06, 0.02), cm, i < 4 ? this.spine : (i % 2 ? this.aR : this.aL), (i - 3) * 0.06 * b, i < 4 ? 0.25 : -0.12, i < 4 ? 0.14 * b : 0.07); m.rotation.z = (i % 3 - 1) * 0.5; } }
    if (c.ice) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const m = part(gCone(0.06, 0.3 + i * 0.1), T(0xbfeaff, 0x4ab8ff, 0.7), s < 0 ? this.aR : this.aL, s * 0.1 * i, 0.15, 0); m.rotation.z = s * (0.4 + i * 0.5); }
    if (c.head === 'dummy') this.pose = { ...POSES.dummy };
    this.mats.forEach((m) => m.userData.baseEm || (m.userData.baseEm = m.emissive.clone()));
  }
  setWeapon(type: string, color: number, glow = 0, rarityGlow = 0) {
    for (const m of [this.mountR, this.mountL]) { while (m.children.length) { const ch = m.children[0]; m.remove(ch); ch.traverse((o: any) => { if (o.material && !o.material.userData.shared) o.material.dispose?.(); }); } }
    this.fistR?.removeFromParent(); this.fistL?.removeFromParent();
    const mk = (t: string) => buildWeapon(t, color, glow, rarityGlow);
    if (type === 'gauntlets') {
      const fm = this.T(color, glow, 0.6); for (const [f, k] of [[this.fR, 'fistR'], [this.fL, 'fistL']] as const) { const m = this.part(gSph(0.1 * this.b), fm, f, 0, -0.3, 0.02, 1.2, 1.1, 1.2); (this as any)[k] = m; const g = this.part(gCyl(0.08 * this.b, 0.07 * this.b, 0.2), fm, f, 0, -0.1, 0); (m as any).add(g); g.position.set(0, 0.2, 0); }
      return;
    }
    if (type === 'dual') { this.mountR.add(mk('dagger')); this.mountL.add(mk('dagger')); return; }
    this.mountR.add(mk(type));
  }
  flash(v: number) { this.flashV = v; }
  applyFlash() {
    const v = this.flashV; for (const m of this.mats) { const b = m.userData.baseEm as THREE.Color; if (v > 0.01) { m.emissive.copy(b).lerp(WHITE, v); m.emissiveIntensity = 1; } else { m.emissive.copy(b); m.emissiveIntensity = m.userData.baseI ?? 1; } }
  }
  target(dt: number, a: AnimIn): Pose {
    const s = a.state; const t = a.t ?? 0; this.time += dt;
    if (s === 'attack') return attackPose(a.style || 'slashR', t);
    if (s === 'move') {
      const sp = a.speed; const run = Math.min(1.4, sp / 6); this.phase += sp * dt * (a.sprint ? 2.5 : 3.1);
      const ph = this.phase; const A = Math.min(1.1, 0.25 + run * 0.9);
      return P({ rootY: -Math.abs(Math.sin(ph)) * 0.05 * run - 0.02 * run, hipsX: 0.05 + 0.2 * run + (a.sprint ? 0.15 : 0), spineY: Math.sin(ph) * 0.12 * run, lRX: -Math.sin(ph) * A, lLX: Math.sin(ph) * A, sRX: Math.max(0, -Math.cos(ph)) * A * 1.3, sLX: Math.max(0, Math.cos(ph)) * A * 1.3, aRX: Math.sin(ph) * A * 0.8, aLX: -Math.sin(ph) * A * 0.8, fRX: -0.3 - run * 0.9, fLX: -0.3 - run * 0.9, aRZ: -0.1, aLZ: 0.1 });
    }
    if (s === 'idle') { const b = Math.sin(this.time * 2); return P({ rootY: b * 0.006, hipsX: 0.03 + b * 0.012, aRZ: -0.1 - b * 0.02, aLZ: 0.1 + b * 0.02, headX: -b * 0.015, aRX: -0.05, aLX: -0.05 }); }
    if (s === 'knock') return POSES.lying;
    if (s === 'dead') return POSES.lying;
    if (s === 'getup') return mix(POSES.lying, IDLE, ease(t));
    if (s === 'transform') { if (t < 0.35) return mix(IDLE, POSES.tfCrouch, ease(t / 0.35)); if (t < 0.55) return mix(POSES.tfCrouch, POSES.transform, ease((t - 0.35) / 0.2)); return { ...POSES.transform, rootY: 0.18 + Math.sin(this.time * 3) * 0.04 }; }
    if (s === 'ult') return mix(IDLE, POSES.ultCharge, ease(t / 0.4));
    if (s === 'dazed') return { ...POSES.dazed, headY: Math.sin(this.time * 5) * 0.4 };
    if (s === 'roar') return attackPose('roar', t);
    return POSES[s] || IDLE;
  }
  update(dt: number, a: AnimIn) {
    const tp = this.target(dt, a); const rate = a.state === 'attack' ? 32 : a.state === 'move' ? 18 : 13; const k = Math.min(1, rate * dt);
    for (const key of KEYS) this.pose[key] += (tp[key] - this.pose[key]) * k;
    const p = this.pose; const sc = 1;
    this.pivot.position.y = p.rootY * sc;
    this.hips.rotation.set(p.hipsX, 0, p.hipsZ); this.spine.rotation.set(p.spineX, p.spineY, p.spineZ); this.head.rotation.set(p.headX, p.headY, 0);
    this.aR.rotation.set(p.aRX, p.aRY, p.aRZ); this.fR.rotation.set(p.fRX, 0, 0); this.aL.rotation.set(p.aLX, p.aLY, p.aLZ); this.fL.rotation.set(p.fLX, 0, 0);
    this.lR.rotation.set(p.lRX, 0, p.lRZ); this.sR.rotation.set(p.sRX, 0, 0); this.lL.rotation.set(p.lLX, 0, p.lLZ); this.sL.rotation.set(p.sLX, 0, 0);
    // special direct-driven rotations
    let yaw = 0; const tt = a.t ?? 0;
    if (a.state === 'attack' && a.style === 'spin') yaw = ease((tt - 0.22) / 0.4) * Math.PI * 2;
    if (a.state === 'transform') yaw = 0;
    this.pivot.rotation.y = yaw;
    if (a.state === 'dodge') { this.hips.rotation.x += ease(tt) * Math.PI * 2; }
    if (this.capeJ) { this.capeJ.rotation.x = 0.12 + Math.min(1, a.speed / 8) * 0.55 + Math.sin(this.time * 3) * 0.04 + (a.state === 'jump' ? 0.3 : 0); }
    if (this.flashV > 0.01 || this.flashV !== -1) { this.applyFlash(); }
    this.flashV = Math.max(0, this.flashV - dt * 6);
  }
  dispose() { this.root.traverse((o: any) => { if (o.material && !o.material.userData.shared && o.material !== OLM) o.material.dispose?.(); }); }
}
const WHITE = new THREE.Color(1, 1, 1);

// ── Weapons ──
export function buildWeapon(type: string, color: number, glow = 0, rarityGlow = 0): THREE.Group {
  const g = new THREE.Group();
  const bm = new THREE.MeshToonMaterial({ color, gradientMap: grad(), emissive: glow || rarityGlow || 0x000000, emissiveIntensity: glow ? 0.8 : rarityGlow ? 0.25 : 0 });
  const hm = new THREE.MeshToonMaterial({ color: 0x4a3224, gradientMap: grad() }); const gm = new THREE.MeshToonMaterial({ color: 0xd8b04a, gradientMap: grad(), emissive: rarityGlow || 0x000000, emissiveIntensity: 0.3 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
  const blade = (len: number, w: number, hl = 0.18) => { add(gBox(w, len, 0.025), bm, 0, hl + len / 2, 0); const tip = add(gCone(w * 0.71, w * 1.3, 4), bm, 0, hl + len + w * 0.55, 0); tip.rotation.y = Math.PI / 4; tip.scale.z = 0.3; };
  switch (type) {
    case 'sword': add(gCyl(0.025, 0.025, 0.2), hm, 0, 0, 0); add(gBox(0.26, 0.04, 0.06), gm, 0, 0.12, 0); blade(0.95, 0.09, 0.14); break;
    case 'greatsword': add(gCyl(0.03, 0.03, 0.3), hm, 0, 0.0, 0); add(gBox(0.38, 0.06, 0.08), gm, 0, 0.17, 0); blade(1.45, 0.17, 0.2); break;
    case 'dagger': add(gCyl(0.02, 0.02, 0.14), hm, 0, 0, 0); add(gBox(0.15, 0.03, 0.05), gm, 0, 0.08, 0); blade(0.48, 0.07, 0.1); break;
    case 'spear': add(gCyl(0.025, 0.025, 2.0), hm, 0, 0.6, 0); add(gCone(0.07, 0.4, 4), bm, 0, 1.8, 0); add(gSph(0.05), gm, 0, 1.55, 0); break;
    case 'staff': add(gCyl(0.03, 0.03, 1.7), hm, 0, 0.5, 0); add(gSph(0.11), new THREE.MeshToonMaterial({ color, emissive: glow || rarityGlow || color, emissiveIntensity: 1.0, gradientMap: grad() }), 0, 1.45, 0); add(gTor(0.15, 0.02), gm, 0, 1.45, 0).rotation.x = Math.PI / 2; break;
    case 'club': add(gCyl(0.04, 0.05, 0.9), hm, 0, 0.3, 0); add(gCyl(0.13, 0.07, 0.5), hm, 0, 0.9, 0); add(gSph(0.12), hm, 0, 1.15, 0); break;
    case 'axe': add(gCyl(0.035, 0.035, 1.3), hm, 0, 0.4, 0); add(gBox(0.5, 0.45, 0.05), bm, 0.2, 1.0, 0); add(gBox(0.2, 0.15, 0.05), bm, -0.1, 1.0, 0); break;
    case 'scythe': add(gCyl(0.03, 0.03, 1.8), hm, 0, 0.5, 0); { const t = add(gTor(0.6, 0.05, Math.PI * 0.55), bm, 0.55, 1.35, 0); t.rotation.z = Math.PI * 0.45; } break;
    case 'bow': { const t = add(gTor(0.5, 0.025, Math.PI), hm, 0, 0.1, 0); t.rotation.z = Math.PI / 2; g.rotation.z = 0; break; }
    default: blade(0.8, 0.08, 0.1);
  }
  return g;
}

// ── Beasts, flyers & blobs ──
function wingMesh(span: number, h: number, mat: THREE.Material) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(span * 0.5, h); s.lineTo(span * 0.8, h * 0.2); s.lineTo(span, h * 0.55); s.lineTo(span * 0.85, -h * 0.45); s.lineTo(span * 0.5, -h * 0.2); s.lineTo(0, -h * 0.1);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat); m.castShadow = false; return m;
}
class Beast implements Model {
  root = new THREE.Group(); mats: THREE.MeshToonMaterial[] = []; body = new THREE.Group(); head = new THREE.Group(); jaw = new THREE.Group();
  legs: THREE.Group[] = []; tail: THREE.Group[] = []; wings: THREE.Group[] = []; time = Math.random() * 9; phase = 0; flashV = 0; cfg: any; scl = 1;
  T = (c: number, em = 0, ei = 1) => { const m = toon(c, em, ei); this.mats.push(m); return m; };
  add(geo: THREE.BufferGeometry, mat: THREE.Material, p: THREE.Object3D, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; p.add(m); return m; }
  constructor(c: any) {
    this.cfg = c; this.scl = c.scale || 1; this.root.scale.setScalar(this.scl); const T = this.T; const add = this.add.bind(this);
    const body = T(c.body), acc = T(c.accent), glow = T(c.glow || c.accent, c.glow || 0, 1.4), eye = T(c.eye || 0xffff00, c.eye || 0xffff00, 1.8);
    this.root.add(this.body); this.body.position.y = c.dragon ? 1.1 : 0.78;
    const bl = c.dragon ? 1.3 : 0.75; const br = c.dragon ? 0.5 : 0.3;
    const torso = add(gCap(br, bl), body, this.body, 0, 0, 0); torso.rotation.x = Math.PI / 2;
    add(gCap(br * 0.8, bl * 0.8), acc, this.body, 0, -br * 0.4, 0.05).rotation.x = Math.PI / 2;
    const neckL = c.neck ? 1.1 : 0.0;
    this.body.add(this.head); this.head.position.set(0, c.neck ? 0.9 : 0.25, bl * 0.5 + 0.45 + (c.neck ? 0.5 : 0));
    if (c.neck) { const n = add(gCap(0.22, neckL), body, this.body, 0, 0.55, bl * 0.5 + 0.35); n.rotation.x = 0.5; }
    const hr = c.dragon ? 0.34 : 0.24;
    add(gSph(hr), body, this.head, 0, 0, 0, 1, 0.9, 1.1); add(gCone(hr * 0.7, hr * 2.2, 6), body, this.head, 0, -0.03, hr * 1.0 + 0.1).rotation.x = Math.PI / 2;
    this.head.add(this.jaw); this.jaw.position.set(0, -hr * 0.4, hr * 0.3); add(gBox(hr * 0.9, hr * 0.25, hr * 2), acc, this.jaw, 0, -0.02, hr * 0.8);
    for (const s of [-1, 1]) { add(gSph(hr * 0.17), eye, this.head, s * hr * 0.55, hr * 0.35, hr * 0.7); add(gCone(hr * 0.3, hr * 0.7, 4), body, this.head, s * hr * 0.6, hr * 0.8, -hr * 0.3); if (c.horns) { const h = add(gCone(hr * 0.2, hr * 1.8, 5), T(0xe6dcc0), this.head, s * hr * 0.5, hr * 0.8, -hr * 0.5); h.rotation.x = -0.7; h.rotation.z = -s * 0.3; } }
    const lh = c.dragon ? 0.9 : 0.5; const lr = c.dragon ? 0.17 : 0.075;
    for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.set((i % 2 ? 1 : -1) * br * 0.75, -br * 0.3, (i < 2 ? 1 : -1) * bl * 0.45); this.body.add(g); add(gCap(lr, lh * 0.8), i < 2 ? acc : body, g, 0, -lh * 0.5, 0); add(gBox(lr * 2.2, lr, lr * 3.2), acc, g, 0, -lh - 0.02, lr * 0.8); this.legs.push(g); }
    let prev: THREE.Object3D = this.body; let py = 0, pz = -bl * 0.6;
    for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.set(0, py, pz); prev.add(g); const r = br * (0.55 - i * 0.1); add(gCap(Math.max(0.05, r), br * 0.9), i % 2 ? acc : body, g, 0, 0, -br * 0.5).rotation.x = Math.PI / 2; this.tail.push(g); prev = g; py = 0; pz = -br * 1.0; }
    if (c.mane) for (let i = 0; i < 5; i++) add(gCone(0.1, 0.4, 5), glow, this.body, 0, br + 0.05, bl * 0.4 - i * 0.18).rotation.x = -0.3;
    if (c.spikes) for (let i = 0; i < 6; i++) add(gCone(0.08 + (c.dragon ? 0.05 : 0), 0.4 + (c.dragon ? 0.3 : 0), 5), glow, this.body, 0, br * 0.95, bl * 0.5 - i * (c.dragon ? 0.4 : 0.22)).rotation.x = -0.25;
    if (c.dragon) for (let i = 0; i < 7; i++) add(gCone(0.1, 0.45, 5), T(0xe6dcc0), this.body, 0, br * 0.95, bl * 0.55 - i * 0.35).rotation.x = -0.2;
    if (c.glow) add(gSph(0.12), glow, this.body, 0, 0, bl * 0.3, 1, 1, 1);
    if (c.wings) for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * br * 0.6, br * 0.8, bl * 0.2); this.body.add(g);
      const wm = new THREE.MeshToonMaterial({ color: c.accent, gradientMap: grad(), side: THREE.DoubleSide, emissive: c.glow || 0, emissiveIntensity: 0.4 }); this.mats.push(wm); wm.userData.baseEm = wm.emissive.clone();
      const w = wingMesh(c.dragon ? 3.2 : 1.6, c.dragon ? 1.6 : 0.9, wm); w.rotation.x = Math.PI / 2; w.rotation.y = s < 0 ? Math.PI : 0; w.scale.x = 1; g.add(w); add(gCyl(0.03, 0.03, c.dragon ? 3 : 1.5), body, g, 0, 0, 0).rotation.z = Math.PI / 2; this.wings.push(g);
    }
  }
  flash(v: number) { this.flashV = v; }
  update(dt: number, a: AnimIn) {
    this.time += dt; const t = a.t ?? 0; const s = a.state; const bl = this.cfg.dragon ? 0.78 : 0.78;
    let bodyX = 0, bodyY = this.cfg.dragon ? 1.1 : bl, bodyZ = 0, rollZ = 0, headX = 0, jawO = 0.05, wingA = 0.25 + Math.sin(this.time * 2) * 0.1, tailS = 0.3, legAmp = 0, lunge = 0;
    const fly = this.wings.length > 0 && (this.cfg.fly);
    if (s === 'move') { this.phase += a.speed * dt * 1.9; legAmp = Math.min(0.9, a.speed / 6); bodyY += Math.abs(Math.sin(this.phase)) * 0.08 * legAmp; tailS = 0.5; wingA = 0.2; }
    if (s === 'attack') {
      const w = t < 0.4 ? ease(t / 0.4) : 1 - ease((t - 0.4) / 0.6) * 0.5;
      if (a.style === 'cast') { bodyX = -0.45 * w; headX = -0.7 * w; jawO = 0.7 * w; wingA = 0.9 * w; }
      else if (a.style === 'roar') { bodyX = -0.5 * w; headX = -0.6 * w; jawO = 0.8 * w; wingA = 1.1 * w; }
      else if (a.style === 'slam') { bodyX = t < 0.4 ? -0.5 * ease(t / 0.4) : 0.3 * ease((t - 0.4) / 0.2); jawO = 0.4; }
      else { const wind = t < 0.35 ? ease(t / 0.35) : 0; const strike = t >= 0.35 && t < 0.65 ? ease((t - 0.35) / 0.15) : t >= 0.65 ? 1 - ease((t - 0.65) / 0.35) : 0; bodyX = -0.28 * wind + 0.35 * strike; bodyZ = -0.3 * wind + 0.5 * strike; jawO = 0.15 + 0.7 * strike; headX = 0.25 * strike; lunge = strike; }
    }
    if (s === 'stagger' || s === 'dazed') { bodyX = -0.2; headX = 0.5 + Math.sin(this.time * 12) * 0.1; jawO = 0.4; }
    if (s === 'hit') { bodyX = -0.3; headX = -0.4; }
    if (s === 'knock' || s === 'dead') { rollZ = Math.PI / 2 * ease(s === 'dead' ? 1 : 1); bodyY = this.cfg.dragon ? 0.9 : 0.35; wingA = 0; legAmp = 0; }
    if (s === 'idle') { headX = Math.sin(this.time * 1.5) * 0.06; tailS = 0.35; }
    this.root.rotation.z += (rollZ - this.root.rotation.z) * Math.min(1, dt * 10);
    this.body.position.y += (bodyY - this.body.position.y) * Math.min(1, dt * 12);
    this.body.position.z += (bodyZ * 0.5 - this.body.position.z) * Math.min(1, dt * 14);
    this.body.rotation.x += (bodyX - this.body.rotation.x) * Math.min(1, dt * 12);
    this.head.rotation.x += (headX - this.head.rotation.x) * Math.min(1, dt * 12);
    this.jaw.rotation.x += (jawO - this.jaw.rotation.x) * Math.min(1, dt * 14);
    for (let i = 0; i < 4; i++) { const off = i === 0 || i === 3 ? 0 : Math.PI; const base = s === 'attack' ? -lunge * 0.6 * (i < 2 ? 1 : -0.3) : 0; this.legs[i].rotation.x += ((Math.sin(this.phase + off) * legAmp + base) - this.legs[i].rotation.x) * Math.min(1, dt * 16); }
    this.tail.forEach((g, i) => { g.rotation.y = Math.sin(this.time * 2.5 - i * 0.7) * tailS * 0.5; g.rotation.x = 0.1; });
    this.wings.forEach((g, i) => { const sg = i === 0 ? -1 : 1; const fl = fly ? Math.sin(this.time * 9) * 0.7 : Math.sin(this.time * 2) * 0.15; g.rotation.z = sg * (-(wingA + (fly ? fl : fl * 0.2))); });
    const v = this.flashV; for (const m of this.mats) { const b = m.userData.baseEm as THREE.Color; if (v > 0.01) { m.emissive.copy(b).lerp(WHITE, v); m.emissiveIntensity = 1; } else { m.emissive.copy(b); m.emissiveIntensity = m.userData.baseI ?? 1; } }
    this.flashV = Math.max(0, this.flashV - dt * 6);
  }
  dispose() { this.root.traverse((o: any) => { if (o.material && !o.material.userData.shared) o.material.dispose?.(); }); }
}

class Flyer implements Model {
  root = new THREE.Group(); mats: THREE.MeshToonMaterial[] = []; wings: THREE.Group[] = []; tent: THREE.Group[] = []; core = new THREE.Group(); time = Math.random() * 9; flashV = 0;
  T = (c: number, em = 0, ei = 1) => { const m = toon(c, em, ei); this.mats.push(m); return m; };
  constructor(c: any) {
    this.root.scale.setScalar(c.scale || 1); const T = this.T; const body = T(c.body), acc = T(c.accent, c.glow || 0, 0.8), eye = T(c.eye || 0xff0000, c.eye || 0xff0000, 2);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: THREE.Object3D, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; p.add(m); return m; };
    this.root.add(this.core); this.core.position.y = 0.6;
    add(gSph(0.35), body, this.core, 0, 0, 0, 1, c.eyes ? 1.1 : 0.9, 1); add(gSph(0.2), acc, this.core, 0, -0.1, 0.18, 1, 0.8, 1);
    if (c.eyes) { add(gSph(0.2), T(0xfff0f0, c.eye, 0.8), this.core, 0, 0.05, 0.28); add(gSph(0.1), eye, this.core, 0, 0.05, 0.42); } else for (const s of [-1, 1]) add(gSph(0.07), eye, this.core, s * 0.14, 0.08, 0.3);
    for (const s of [-1, 1]) add(gCone(0.08, 0.3, 4), body, this.core, s * 0.2, 0.35, -0.05);
    if (c.wings) for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.25, 0.1, 0); this.core.add(g); const wm = new THREE.MeshToonMaterial({ color: c.accent, gradientMap: grad(), side: THREE.DoubleSide, emissive: c.glow || 0, emissiveIntensity: 0.5 }); this.mats.push(wm); wm.userData.baseEm = wm.emissive.clone(); const w = wingMesh(1.3, 0.8, wm); w.rotation.x = Math.PI / 2; w.rotation.y = s < 0 ? Math.PI : 0; g.add(w); this.wings.push(g); }
    for (let i = 0; i < (c.tentacles || 0); i++) { const g = new THREE.Group(); const a = (i / c.tentacles) * Math.PI * 2; g.position.set(Math.sin(a) * 0.22, -0.25, Math.cos(a) * 0.22); this.core.add(g); let p: THREE.Object3D = g; for (let k = 0; k < 3; k++) { const s = new THREE.Group(); s.position.y = k === 0 ? 0 : -0.3; p.add(s); add(gCap(0.07 - k * 0.015, 0.25), k % 2 ? acc : body, s, 0, -0.15, 0); p = s; } this.tent.push(g); }
  }
  flash(v: number) { this.flashV = v; }
  update(dt: number, a: AnimIn) {
    this.time += dt; const s = a.state; const t = a.t ?? 0;
    let pitch = 0, bob = Math.sin(this.time * 3) * 0.12, spread = 0, roll = 0;
    if (s === 'attack') { const st = t < 0.4 ? -ease(t / 0.4) * 0.5 : 0.6 * (1 - ease((t - 0.4) / 0.4)); pitch = st; spread = 0.3; }
    if (s === 'stagger' || s === 'hit') { pitch = -0.5; roll = Math.sin(this.time * 20) * 0.3; }
    if (s === 'dead' || s === 'knock') { pitch = 1.2; roll = this.time * 3; bob = 0; }
    this.core.position.y = 0.6 + bob; this.core.rotation.x += (pitch - this.core.rotation.x) * Math.min(1, dt * 12); this.core.rotation.z += (roll - this.core.rotation.z) * Math.min(1, dt * 12);
    this.wings.forEach((g, i) => { const sg = i === 0 ? -1 : 1; g.rotation.z = sg * (-0.2 - Math.sin(this.time * 14) * (s === 'dead' ? 0 : 0.65) - spread); });
    this.tent.forEach((g, i) => { g.children.forEach((c, k) => { (c as THREE.Group).rotation.x = Math.sin(this.time * 3 + i + k) * 0.35; (c as THREE.Group).rotation.z = Math.cos(this.time * 2.4 + i * 2 + k) * 0.3; }); });
    const v = this.flashV; for (const m of this.mats) { const b = m.userData.baseEm as THREE.Color; if (v > 0.01) { m.emissive.copy(b).lerp(WHITE, v); m.emissiveIntensity = 1; } else { m.emissive.copy(b); m.emissiveIntensity = m.userData.baseI ?? 1; } }
    this.flashV = Math.max(0, this.flashV - dt * 6);
  }
  dispose() { this.root.traverse((o: any) => { if (o.material && !o.material.userData.shared) o.material.dispose?.(); }); }
}

class Blob implements Model {
  root = new THREE.Group(); mats: THREE.MeshToonMaterial[] = []; blob = new THREE.Group(); time = Math.random() * 9; flashV = 0;
  constructor(c: any) {
    this.root.scale.setScalar(c.scale || 1);
    const m = new THREE.MeshToonMaterial({ color: c.body, gradientMap: grad(), transparent: true, opacity: 0.85, emissive: c.core, emissiveIntensity: 0.25 }); m.userData.baseEm = m.emissive.clone(); m.userData.baseI = 0.25; this.mats.push(m);
    const core = toon(c.core, c.core, 1.2); this.mats.push(core); const eye = toon(0xffffff); this.mats.push(eye); const pup = toon(0x101010); this.mats.push(pup);
    this.root.add(this.blob);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); this.blob.add(o); return o; };
    add(gSph(0.6), m, 0, 0.5, 0, 1, 0.85, 1); add(gSph(0.22), core, 0, 0.45, -0.05);
    for (const s of [-1, 1]) { add(gSph(0.12), eye, s * 0.2, 0.7, 0.45); add(gSph(0.06), pup, s * 0.2, 0.7, 0.55); }
    for (let i = 0; i < 3; i++) add(gSph(0.1), m, Math.sin(i * 2.1) * 0.5, 0.15, Math.cos(i * 2.1) * 0.5);
  }
  flash(v: number) { this.flashV = v; }
  update(dt: number, a: AnimIn) {
    this.time += dt; const s = a.state; const t = a.t ?? 0; let sy = 1 + Math.sin(this.time * 3) * 0.06, sxz = 1 - Math.sin(this.time * 3) * 0.03, z = 0;
    if (s === 'move') { const p = Math.abs(Math.sin(this.time * 6)); sy = 0.85 + p * 0.3; sxz = 1.1 - p * 0.15; }
    if (s === 'attack') { const w = t < 0.4 ? ease(t / 0.4) : 0; const st = t >= 0.4 && t < 0.65 ? 1 : 0; sy = 1 - 0.4 * w + 0.4 * st; sxz = 1 + 0.3 * w - 0.2 * st; z = st * 0.5; }
    if (s === 'dead' || s === 'knock') { sy = 0.15; sxz = 1.6; }
    if (s === 'stagger' || s === 'hit') { sy = 0.7; sxz = 1.2; }
    this.blob.scale.y += (sy - this.blob.scale.y) * Math.min(1, dt * 14); this.blob.scale.x += (sxz - this.blob.scale.x) * Math.min(1, dt * 14); this.blob.scale.z = this.blob.scale.x; this.blob.position.z += (z - this.blob.position.z) * Math.min(1, dt * 14);
    const v = this.flashV; for (const m of this.mats) { const b = m.userData.baseEm as THREE.Color; if (v > 0.01) { m.emissive.copy(b).lerp(WHITE, v); m.emissiveIntensity = 1; } else { m.emissive.copy(b); m.emissiveIntensity = m.userData.baseI ?? 1; } }
    this.flashV = Math.max(0, this.flashV - dt * 6);
  }
  dispose() { this.root.traverse((o: any) => { if (o.material && !o.material.userData.shared) o.material.dispose?.(); }); }
}

export function buildEnemyModel(look: any): Model {
  switch (look.m) {
    case 'q': return new Beast(look);
    case 'f': return new Flyer(look);
    case 'b': return new Blob(look);
    default: return new Rig({ outline: look.scale >= 2.4, ...look });
  }
}

// ── Hero ──
export interface HeroLook { hairStyle: number; hairColor: string; outfit: string; accessory: string; items: Partial<Record<'helmet' | 'chest' | 'gloves' | 'boots' | 'accessory', { color: number; r: number }>>; wtype: string; wcolor: number; welem: number; wglow: number; tf: number; tfColor: number; tfHair: number }
export class HeroRig extends Rig {
  hairG: THREE.Group[] = []; hairMat!: THREE.MeshToonMaterial; helm!: THREE.Group; helmMat!: THREE.MeshToonMaterial; outfitMat!: THREE.MeshToonMaterial; armorMat!: THREE.MeshToonMaterial; paul: THREE.Mesh[] = []; plate!: THREE.Mesh; gloveM: THREE.Mesh[] = []; bootM: THREE.Mesh[] = []; amulet!: THREE.Mesh;
  eyeMats: THREE.MeshBasicMaterial[] = []; aura!: THREE.Group; auraMat!: THREE.MeshBasicMaterial; scarf!: THREE.Group; heroCape!: THREE.Group; accMat!: THREE.MeshToonMaterial; armorTrim!: THREE.MeshToonMaterial;
  curTf = -1; curWeapon = '';
  constructor() {
    super({ hero: true, outline: true, skin: 0xf3cfb0, cloth: 0x3a5a8a, cloth2: 0x20243a, head: 'human', weapon: 'none' });
    const T = this.T; const hd = this.head; const part = this.part.bind(this); const b = 1;
    this.outfitMat = this.mats[1]; // torso cloth
    this.hairMat = T(0x2a2438); this.helmMat = T(0xa0a8b8); this.armorMat = T(0x8a94a8); this.armorTrim = T(0xffd24a, 0xffa000, 0.2); this.accMat = T(0xffd24a, 0xffa000, 0.6);
    // face
    for (const s of [-1, 1]) {
      const em = new THREE.MeshBasicMaterial({ map: eyeTex('#4ab0ff'), transparent: true, side: THREE.DoubleSide, depthWrite: false }); this.eyeMats.push(em);
      const e = new THREE.Mesh(gPlane(0.085, 0.1), em); e.position.set(s * 0.078, 0.215, 0.188); e.scale.x = s; e.rotation.y = s * -0.28; hd.add(e);
    }
    part(gBox(0.04, 0.008, 0.01), T(0x7a3a3a), hd, 0, 0.115, 0.192);
    for (const s of [-1, 1]) part(gSph(0.03), T(0xf3cfb0), hd, s * 0.2, 0.2, 0);
    // hair styles
    const mkCap = () => { const m = part(G('hcap', () => new THREE.SphereGeometry(0.215, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.53)), this.hairMat, hd, 0, 0.2, -0.005); m.rotation.x = -0.45; return m; };
    const g0 = new THREE.Group(); hd.add(g0); this.hairG.push(g0); // spiky
    { const cap = mkCap(); hd.remove(cap); g0.add(cap); for (let i = 0; i < 5; i++) { const sp = part(gCone(0.05, 0.22, 5), this.hairMat, g0, (i - 2) * 0.07, 0.33, 0.14 - Math.abs(i - 2) * 0.01); sp.rotation.x = Math.PI - 0.15; sp.rotation.z = (i - 2) * 0.12; }
      for (let i = 0; i < 6; i++) { const sp = part(gCone(0.06, 0.3, 5), this.hairMat, g0, (i - 2.5) * 0.075, 0.38, -0.13); sp.rotation.x = -1.2; sp.rotation.z = (i - 2.5) * 0.2; } }
    const g1 = new THREE.Group(); hd.add(g1); this.hairG.push(g1); // long
    { const cap = mkCap(); hd.remove(cap); g1.add(cap); for (let i = 0; i < 5; i++) { const sp = part(gCone(0.055, 0.18, 5), this.hairMat, g1, (i - 2) * 0.07, 0.31, 0.14); sp.rotation.x = Math.PI - 0.1; }
      part(gCap(0.16, 0.45), this.hairMat, g1, 0, -0.05, -0.12, 1, 1, 0.55); for (const s of [-1, 1]) part(gCap(0.035, 0.25), this.hairMat, g1, s * 0.18, 0.08, 0.06); }
    const g2 = new THREE.Group(); hd.add(g2); this.hairG.push(g2); // ponytail
    { const cap = mkCap(); hd.remove(cap); g2.add(cap); for (let i = 0; i < 5; i++) { const sp = part(gCone(0.05, 0.2, 5), this.hairMat, g2, (i - 2) * 0.07, 0.3, 0.15); sp.rotation.x = Math.PI - 0.25; }
      const pt = part(gCap(0.07, 0.5), this.hairMat, g2, 0, 0.1, -0.3); pt.rotation.x = 0.5; part(gSph(0.05), T(0xff4a6a), g2, 0, 0.3, -0.2); }
    // helmet
    this.helm = new THREE.Group(); hd.add(this.helm);
    { const c = part(G('hh', () => new THREE.SphereGeometry(0.235, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), this.helmMat, this.helm, 0, 0.2, 0); c.rotation.x = -0.35; const cr = part(gCone(0.04, 0.26), this.armorTrim, this.helm, 0, 0.45, -0.06); cr.rotation.x = -0.5; for (const s of [-1, 1]) part(gBox(0.03, 0.14, 0.14), this.helmMat, this.helm, s * 0.215, 0.12, 0.02); }
    this.helm.visible = false;
    // armor
    this.plate = part(gCyl(0.235 * b, 0.18 * b, 0.4, 10), this.armorMat, this.spine, 0, 0.3, 0.015, 1, 1, 0.76); this.plate.visible = false;
    for (const [a, s] of [[this.aR, -1], [this.aL, 1]] as const) { const p = part(gSph(0.13), this.armorMat, a, s * 0.04, 0.06, 0, 1, 0.7, 1); p.visible = false; this.paul.push(p); const g = part(gCyl(0.07, 0.065, 0.2), this.armorMat, s < 0 ? this.fR : this.fL, 0, -0.13, 0); g.visible = false; this.gloveM.push(g); }
    for (const sh of [this.sR, this.sL]) { const bt = part(gCyl(0.082, 0.07, 0.24), this.armorMat, sh, 0, -0.34, 0); bt.visible = false; this.bootM.push(bt); }
    this.amulet = part(gSph(0.05), this.accMat, this.spine, 0, 0.42, 0.15); this.amulet.visible = false;
    // scarf & cape
    this.scarf = new THREE.Group(); this.spine.add(this.scarf); part(gTor(0.1, 0.045), this.T(0xd04a4a), this.scarf, 0, 0.55, 0.0).rotation.x = Math.PI / 2; part(gBox(0.1, 0.5, 0.025), this.T(0xd04a4a), this.scarf, 0.05, 0.35, -0.12);
    this.heroCape = new THREE.Group(); this.capeJ = this.heroCape; this.spine.add(this.heroCape); this.heroCape.position.set(0, 0.52, -0.2); part(gBox(0.5, 0.95, 0.03), this.T(0x7a2a3a), this.heroCape, 0, -0.5, 0); this.cape = true;
    // aura
    this.aura = new THREE.Group(); this.root.add(this.aura); this.aura.visible = false;
    this.auraMat = new THREE.MeshBasicMaterial({ color: 0x9b5cff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); this.auraMat.userData.shared = true;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 2.6, 20, 1, true), this.auraMat); cone.position.y = 1.2; this.aura.add(cone);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.8 + i * 0.1, 0.02, 6, 28), this.auraMat); r.rotation.x = Math.PI / 2; r.position.y = 0.4 + i * 0.8; r.name = 'ring'; this.aura.add(r); }
    // wing shards for transformed
    this.mats.push(this.hairMat, this.helmMat, this.armorMat, this.armorTrim, this.accMat);
  }
  look(l: HeroLook) {
    this.hairG.forEach((g, i) => (g.visible = i === l.hairStyle && !l.items.helmet));
    const tf = l.tf; const hc = tf ? l.tfHair : new THREE.Color(l.hairColor).getHex();
    this.hairMat.color.setHex(hc); this.hairMat.userData.baseEm.setHex(tf ? l.tfColor : 0); this.hairMat.userData.baseI = tf ? 0.45 : 1;
    this.mats[1].color.set(l.outfit); this.mats[0].color.setHex(0xf3cfb0);
    this.scarf.visible = l.accessory === 'scarf' && !tf; this.heroCape.visible = l.accessory === 'cape' || tf > 0;
    const it = l.items;
    this.helm.visible = !!it.helmet; if (it.helmet) { this.helmMat.color.setHex(it.helmet.color); this.helmMat.userData.baseEm.setHex(it.helmet.r >= 3 ? it.helmet.color : 0); this.helmMat.userData.baseI = 0.25; }
    this.plate.visible = !!it.chest; this.paul.forEach((p) => (p.visible = !!it.chest && it.chest.r >= 1));
    if (it.chest) { this.armorMat.color.setHex(it.chest.color); this.armorMat.userData.baseEm.setHex(it.chest.r >= 3 ? it.chest.color : 0); this.armorMat.userData.baseI = 0.18; }
    this.gloveM.forEach((g) => (g.visible = !!it.gloves)); this.bootM.forEach((g) => (g.visible = !!it.boots));
    this.amulet.visible = !!it.accessory; if (it.accessory) this.accMat.color.setHex(it.accessory.color);
    const key = `${l.wtype}${l.wcolor}${l.welem}${l.wglow}${tf}`;
    if (key !== this.curWeapon) { this.curWeapon = key; this.setWeapon(l.wtype, l.wcolor, tf ? l.tfColor : l.welem, l.wglow); }
    if (tf !== this.curTf) {
      this.curTf = tf; this.aura.visible = tf > 0; if (tf) this.auraMat.color.setHex(l.tfColor);
      const iris = tf === 0 ? '#4ab0ff' : tf === 1 ? '#c46aff' : tf === 2 ? '#ff4a60' : '#ffe27a'; const t = eyeTex(iris, tf ? '#ffffff' : '#ffffff'); this.eyeMats.forEach((m) => { m.map = t; m.needsUpdate = true; });
    }
  }
  update(dt: number, a: AnimIn) {
    super.update(dt, a);
    if (this.aura.visible) { this.aura.children.forEach((c, i) => { if (c.name === 'ring') { c.position.y = ((this.time * 0.8 + i * 0.5) % 2.4) + 0.1; c.rotation.z += dt * 2; } }); this.auraMat.opacity = 0.2 + Math.sin(this.time * 6) * 0.06; }
  }
}
export function buildNPC(cloth: number, hair: number, scale = 1): Rig {
  const r = new Rig({ outline: true, skin: 0xe8b890, cloth, cloth2: 0x2a2434, head: 'human', weapon: 'none', scale });
  const hm = r.T(hair); const g = r.part(gSph(0.215), hm, r.head, 0, 0.22, -0.02, 1, 0.9, 1.0); void g;
  for (const s of [-1, 1]) r.part(gBox(0.03, 0.03, 0.01), r.T(0x201820), r.head, s * 0.075, 0.2, 0.19);
  return r;
}
