// Procedural stylized models for mechs and monsters (shared low-poly geometry, per-model materials)
import * as THREE from 'three';
import type { MechDef, MonDef } from './data';
import type { Cust } from './store';

type V3 = [number, number, number];
const trapGeo = () => { const g = new THREE.CylinderGeometry(0.72, 1, 1, 4); g.rotateY(Math.PI / 4); return g; };
const trapInvGeo = () => { const g = new THREE.CylinderGeometry(1, 0.7, 1, 4); g.rotateY(Math.PI / 4); return g; };
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), hex: new THREE.CylinderGeometry(1, 1, 1, 6), sph: new THREE.SphereGeometry(1, 14, 10),
  low: new THREE.SphereGeometry(1, 8, 6), cone: new THREE.ConeGeometry(1, 1, 8), oct: new THREE.OctahedronGeometry(1), ico: new THREE.IcosahedronGeometry(1, 0),
  tor: new THREE.TorusGeometry(1, 0.08, 6, 28), trap: trapGeo(), trapInv: trapInvGeo(), dome: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
};
const wingGeo = (() => {
  const pts: V3[] = [[0, 0, 1.5], [4, 0.4, 2], [9, 0.2, 0.5], [14, -0.5, -2.5], [10, -0.3, -3], [6, -0.1, -3.5], [3, 0, -3], [0, 0, -2]];
  const v: number[] = []; for (let i = 0; i < pts.length - 1; i++) v.push(0, 0, 0, ...pts[i], ...pts[i + 1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
})();

function mk(g: THREE.BufferGeometry, m: THREE.Material, s: V3 | number, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], par?: THREE.Object3D) {
  const o = new THREE.Mesh(g, m); if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(...s);
  o.position.set(...p); o.rotation.set(...r); par?.add(o); return o;
}
function grp(p: V3, par?: THREE.Object3D, r: V3 = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...p); g.rotation.set(...r); par?.add(g); return g; }
const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, metalness: 0.4, roughness: 0.55, ...o });
const glowMat = (color: string, i = 1.8) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, flatShading: true, roughness: 0.4 });
const lerp = THREE.MathUtils.lerp; const clamp = THREE.MathUtils.clamp;
const ease = (x: number) => x * x * (3 - 2 * x);

// =========================================================== MECH
export interface MechPose { move: number; atk: number; atkType: string; combo: number; ranged: boolean; air: boolean; vy: number; dash: boolean; hit: number; guard: boolean; dead: number; fire: number; charge: number; fly: boolean }
export interface MechModel {
  group: THREE.Group; muzzle: THREE.Object3D; handR: THREE.Object3D; body: THREE.Group; torso: THREE.Group; head: THREE.Group; phase: number; stepped: number; footR: THREE.Object3D; footL: THREE.Object3D;
  update(t: number, dt: number, p: MechPose): void; setWeapon(id: string): void; setTransform(k: number): void; setCloak(a: number): void; flash(v: number): void;
  shatter(scene: THREE.Object3D): THREE.Object3D[]; dispose(): void; mats: THREE.Material[]; hipY: number;
}

function weaponMesh(id: string, mp: THREE.Material, ma: THREE.Material, md: THREE.Material, mf: THREE.Material, side = 1) {
  const g = new THREE.Group(); const tip = new THREE.Object3D(); g.add(tip); const T = (y: number) => tip.position.set(0, y, 0);
  switch (id) {
    case 'sword': mk(G.cyl, md, [0.2, 1.4, 0.2], [0, -0.4, 0], [0, 0, 0], g); mk(G.box, ma, [1.5, 0.22, 0.6], [0, -1.1, 0], [0, 0, 0], g); mk(G.trap, mp, [0.5, 6.6, 0.55], [0, -4.5, 0], [Math.PI, 0, 0], g); mk(G.box, mf, [0.12, 6.5, 0.9], [0, -4.5, 0], [0, 0, 0], g); mk(G.cone, mf, [0.45, 1.4, 0.45], [0, -8.1, 0], [Math.PI, 0, 0], g); T(-7.8); break;
    case 'dualblade': mk(G.cyl, md, [0.18, 1.2, 0.18], [0, -0.3, 0], [0, 0, 0], g); mk(G.box, ma, [1.0, 0.2, 0.4], [0, -0.95, 0], [0, 0, 0], g); mk(G.trap, mf, [0.3, 5, 0.3], [0, -3.4, 0], [Math.PI, 0, 0], g); mk(G.box, mp, [0.12, 4.8, 0.55], [0, -3.4, 0], [0, 0, 0], g); mk(G.cone, mf, [0.3, 1.2, 0.3], [0, -6.5, 0], [Math.PI, 0, 0], g); T(-6.2); break;
    case 'hammer': mk(G.cyl, md, [0.3, 5.5, 0.3], [0, -2.5, 0], [0, 0, 0], g); mk(G.box, mp, [2.4, 2.4, 3.4], [0, -5.8, 0], [0, 0, 0], g); mk(G.box, mf, [2.5, 1.2, 2.2], [0, -5.8, 0], [0, 0, 0], g); mk(G.cyl, ma, [0.9, 3.6, 0.9], [0, -5.8, 0], [0, 0, Math.PI / 2], g); T(-6); break;
    case 'axe': mk(G.cyl, md, [0.28, 5, 0.28], [0, -2.2, 0], [0, 0, 0], g); mk(G.trap, mp, [0.3, 3.2, 1.8], [0, -4.4, 1.4], [0, 0, 0], g); mk(G.box, mf, [0.16, 3.0, 0.3], [0, -4.4, 2.7], [0, 0, 0], g); mk(G.cone, ma, [0.3, 1.6, 0.3], [0, -6.2, 0], [Math.PI, 0, 0], g); T(-4.6); break;
    case 'spear': mk(G.cyl, md, [0.22, 9, 0.22], [0, -3.8, 0], [0, 0, 0], g); mk(G.cone, mf, [0.7, 3, 0.7], [0, -9.7, 0], [Math.PI, 0, 0], g); mk(G.tor, ma, 0.7, [0, -8, 0], [Math.PI / 2, 0, 0], g); T(-11); break;
    case 'plasmafist': mk(G.cyl, md, [0.6, 1.2, 0.6], [0, -0.2, 0], [0, 0, 0], g); mk(G.box, mp, [1.5, 1.4, 1.5], [0, -1.5, 0.2], [0, 0, 0], g); mk(G.sph, mf, 0.95, [0, -1.9, 0.5], [0, 0, 0], g); mk(G.tor, mf, 1.1, [0, -1.0, 0.1], [Math.PI / 2, 0, 0], g); T(-2.3); break;
    case 'chainblade': for (let i = 0; i < 9; i++) mk(i % 2 ? G.oct : G.box, i % 2 ? mf : mp, [0.34, 0.52, 0.6], [0, -0.8 - i * 0.8, 0], [0, 0, 0], g); mk(G.cyl, md, [0.22, 1, 0.22], [0, -0.1, 0], [0, 0, 0], g); mk(G.cone, mf, [0.4, 1.3, 0.5], [0, -8.7, 0], [Math.PI, 0, 0], g); T(-8.2); break;
    case 'machinegun': mk(G.box, md, [0.9, 2.4, 1.1], [0, -1.3, 0], [0, 0, 0], g); mk(G.cyl, mp, [0.2, 3, 0.2], [0.3, -3.8, 0], [0, 0, 0], g); mk(G.cyl, mp, [0.2, 3, 0.2], [-0.3, -3.8, 0], [0, 0, 0], g); mk(G.box, mf, [0.9, 0.2, 0.3], [0, -2.5, 0.55], [0, 0, 0], g); T(-5.4); break;
    case 'rocket': mk(G.cyl, mp, [0.75, 4.4, 0.75], [0, -2.3, 0.2], [0, 0, 0], g); mk(G.cyl, ma, [0.9, 0.5, 0.9], [0, -4.4, 0.2], [0, 0, 0], g); mk(G.cone, md, [0.7, 1.2, 0.7], [0, 0.4, 0.2], [0, 0, 0], g); mk(G.box, mf, [0.2, 1.4, 0.2], [0.75, -2, 0.2], [0, 0, 0], g); T(-4.8); break;
    case 'homing': mk(G.box, mp, [1.5, 2.6, 1.5], [0, -1.5, 0.2], [0, 0, 0], g); for (let i = 0; i < 4; i++) mk(G.cyl, md, [0.32, 1, 0.32], [(i % 2 - 0.5) * 0.7, -3.1, 0.2 + (Math.floor(i / 2) - 0.5) * 0.7], [0, 0, 0], g); mk(G.box, mf, [1.6, 0.18, 1.6], [0, -2.9, 0.2], [0, 0, 0], g); T(-3.4); break;
    case 'plasma': mk(G.cyl, mp, [0.6, 3.6, 0.6], [0, -2, 0.1], [0, 0, 0], g); for (let i = 0; i < 3; i++) mk(G.tor, mf, 0.75, [0, -1.2 - i * 1.0, 0.1], [Math.PI / 2, 0, 0], g); mk(G.sph, mf, 0.55, [0, -4, 0.1], [0, 0, 0], g); mk(G.box, md, [1, 1.4, 1.2], [0, -0.5, 0.1], [0, 0, 0], g); T(-4.4); break;
    case 'railgun': mk(G.box, md, [1.0, 2, 1.2], [0, -1, 0.1], [0, 0, 0], g); mk(G.box, mp, [0.22, 6.5, 0.3], [0.45, -4.8, 0.1], [0, 0, 0], g); mk(G.box, mp, [0.22, 6.5, 0.3], [-0.45, -4.8, 0.1], [0, 0, 0], g); mk(G.box, mf, [0.2, 6, 0.2], [0, -4.6, 0.1], [0, 0, 0], g); T(-8.2); break;
    case 'laser': mk(G.cyl, mp, [0.55, 3, 0.55], [0, -1.6, 0.1], [0, 0, 0], g); mk(G.cyl, md, [0.85, 0.8, 0.85], [0, -3.3, 0.1], [0, 0, 0], g); mk(G.sph, mf, 0.55, [0, -3.8, 0.1], [0, 0, 0], g); mk(G.tor, ma, 0.9, [0, -2.8, 0.1], [Math.PI / 2, 0, 0], g); T(-4.2); break;
    case 'artillery': mk(G.box, md, [1.3, 2.2, 1.4], [0, -1, 0.1], [0, 0, 0], g); mk(G.cyl, mp, [0.8, 5.4, 0.8], [0, -4.3, 0.1], [0, 0, 0], g); mk(G.cyl, ma, [1.05, 0.9, 1.05], [0, -7, 0.1], [0, 0, 0], g); mk(G.tor, mf, 1, [0, -3.5, 0.1], [Math.PI / 2, 0, 0], g); T(-7.7); break;
    case 'shotgun': mk(G.box, md, [1.2, 2, 1.2], [0, -1, 0.1], [0, 0, 0], g); mk(G.box, mp, [1.6, 3, 0.7], [0, -3.3, 0.1], [0, 0, 0], g); mk(G.box, mf, [1.2, 0.2, 0.3], [0, -4.9, 0.1], [0, 0, 0], g); T(-5.2); break;
    default: T(-2);
  }
  void side; return { g, tip };
}

export function buildMech(def: MechDef, cust: Cust): MechModel {
  const L = def.look;
  const mp = std(cust.primary, { metalness: 0.5, roughness: 0.4 }), ma = std(cust.accent, { metalness: 0.5, roughness: 0.45 }), md = std('#1f232c', { metalness: 0.7, roughness: 0.5 });
  const mg = glowMat(cust.glow, 1.8), mf = glowMat(cust.fx, 1.8); const mice = new THREE.MeshStandardMaterial({ color: cust.glow, emissive: cust.glow, emissiveIntensity: 0.5, transparent: true, opacity: 0.8, flatShading: true });
  const mats = [mp, ma, md, mg, mf, mice]; const glowC = new THREE.Color(cust.glow);
  const group = new THREE.Group(); group.scale.setScalar(def.scale); const body = grp([0, 0, 0], group);
  const hipY = 4.55; const hips = grp([0, hipY, 0], body);
  mk(G.trap, md, [1.7 * L.leg, 0.9, 1.3], [0, 0, 0], [0, 0, 0], hips); mk(G.box, ma, [1.2, 0.5, 0.2], [0, -0.1, 1.2], [0, 0, 0], hips);
  const torso = grp([0, 0.9, 0], hips);
  mk(G.cyl, md, [1.0, 1, 0.9], [0, 0.2, 0], [0, 0, 0], torso);
  mk(G.trapInv, mp, [2.2 * L.tw, 2.5 * L.th, 1.55], [0, 1.4, 0], [0, 0, 0], torso);
  mk(G.trap, ma, [1.5 * L.tw, 0.95, 0.35], [0, 1.0, 1.35], [0, 0, 0], torso); mk(G.box, md, [1.6 * L.tw, 0.14, 0.4], [0, 1.9, 1.3], [0, 0, 0], torso);
  const core = mk(G.sph, mg, 0.46, [0, 1.65, 1.5], [0, 0, 0], torso); mk(G.tor, mf, 0.7, [0, 1.65, 1.5], [0, 0, 0], torso);
  mk(G.trap, ma, [1.2, 1.4, 0.9], [0, 1.5, -1.5], [0, 0, 0], torso); // backpack
  mk(G.cyl, mf, [0.3, 0.2, 0.3], [0.6, 2.2, -1.9], [0, 0, 0], torso); mk(G.cyl, mf, [0.3, 0.2, 0.3], [-0.6, 2.2, -1.9], [0, 0, 0], torso);
  // head
  const head = grp([0, 3.1, 0.15], torso);
  const hm = L.head;
  if (hm === 'dome') { mk(G.sph, mp, [0.95, 0.85, 0.95], [0, 0, 0], [0, 0, 0], head); mk(G.box, mg, [0.95, 0.22, 0.4], [0, 0.05, 0.75], [0, 0, 0], head); }
  else if (hm === 'hood') { mk(G.cone, mp, [0.95, 1.5, 0.95], [0, 0.35, -0.1], [0.2, 0, 0], head); mk(G.box, mg, [0.7, 0.12, 0.3], [0, 0.1, 0.65], [0, 0, 0], head); }
  else { mk(G.trapInv, mp, [0.95, 0.95, 1.0], [0, 0, 0], [0, 0, 0], head); mk(G.box, mg, [hm === 'visor' ? 1.5 : 0.95, 0.2, 0.35], [0, 0.08, 0.85], [0, 0, 0], head); }
  if (hm === 'crest') { mk(G.cone, ma, [0.15, 1.4, 0.6], [0, 1.0, -0.1], [-0.3, 0, 0], head); mk(G.box, ma, [0.2, 0.9, 0.9], [0.95, 0.1, -0.1], [0, 0, 0.3], head); mk(G.box, ma, [0.2, 0.9, 0.9], [-0.95, 0.1, -0.1], [0, 0, -0.3], head); }
  if (hm === 'horn') { mk(G.cone, ma, [0.22, 1.8, 0.3], [0.6, 1, 0], [0, 0, -0.5], head); mk(G.cone, ma, [0.22, 1.8, 0.3], [-0.6, 1, 0], [0, 0, 0.5], head); }
  if (hm === 'visor') { mk(G.cyl, md, [0.05, 2, 0.05], [0.9, 1.0, -0.3], [0, 0, 0], head); mk(G.cyl, md, [0.05, 1.4, 0.05], [-0.9, 0.8, -0.3], [0, 0, 0], head); }
  if (hm === 'crown') for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; mk(G.cone, mf, [0.12, 0.9 + (i % 2) * 0.4, 0.12], [Math.sin(a) * 0.75, 0.9, Math.cos(a) * 0.75], [0, 0, 0], head); }
  const eyes: THREE.Object3D[] = [];
  // arms
  const arms = [1, -1].map(s => {
    const sh = grp([s * 2.45 * L.tw, 2.15 * L.th, 0], torso);
    const pauld = mk(G.oct, mp, [1.15 * L.sh, 0.95 * L.sh, 1.2 * L.sh], [s * 0.2, 0.25, 0], [0, 0, 0], sh); mk(G.box, ma, [0.3, 0.3, 1.5 * L.sh], [s * 0.7, 0.6 * L.sh, 0], [0, 0, 0], sh);
    mk(G.hex, md, [0.55, 1.9, 0.55], [0, -0.95, 0], [0, 0, 0], sh);
    const el = grp([0, -1.9, 0], sh); mk(G.sph, md, 0.6, [0, 0, 0], [0, 0, 0], el);
    mk(G.hex, mp, [0.68, 1.9, 0.7], [0, -1.0, 0.05], [0, 0, 0], el); mk(G.box, ma, [0.9, 0.6, 0.95], [0, -0.7, 0.05], [0, 0, 0], el);
    const hand = grp([0, -2.0, 0], el); mk(G.box, md, [0.6, 0.6, 0.6], [0, -0.1, 0], [0, 0, 0], hand);
    if (cust.armor >= 1) { mk(G.cone, ma, [0.25, 1.3, 0.25], [s * 0.4, 1.0 * L.sh, 0], [0, 0, -s * 0.3], sh); }
    if (cust.armor >= 2) { mk(G.box, ma, [0.4, 1.0, 1.7 * L.sh], [s * 0.9, 0.3, 0], [0, 0, s * 0.3], sh); }
    return { sh, el, hand, pauld };
  });
  const [aR, aL] = arms; const handR = aR.hand;
  // legs
  const legs = [1, -1].map(s => {
    const hp = grp([s * 1.15 * L.leg, -0.55, 0], hips);
    mk(G.hex, mp, [0.8 * L.leg, 2.1, 0.85 * L.leg], [0, -1.0, 0], [0, 0, 0], hp); mk(G.box, ma, [0.9 * L.leg, 0.7, 0.2], [0, -0.7, 0.8 * L.leg], [0, 0, 0], hp);
    const kn = grp([0, -2.0, 0], hp); mk(G.sph, md, 0.62 * L.leg, [0, 0, 0.1], [0, 0, 0], kn); mk(G.cone, ma, [0.3, 0.7, 0.3], [0, 0, 0.7 * L.leg], [Math.PI / 2, 0, 0], kn);
    mk(G.trap, mp, [0.72 * L.leg, 2.0, 0.8 * L.leg], [0, -1.05, -0.1], [Math.PI, 0, 0], kn);
    const ft = grp([0, -2.05, 0], kn); mk(G.box, md, [0.95 * L.leg, 0.4, 1.5 * L.leg], [0, -0.1, 0.45], [0, 0, 0], ft); mk(G.trap, ma, [0.8 * L.leg, 0.3, 0.9 * L.leg], [0, 0.15, 0.9], [0, 0, 0], ft);
    return { hp, kn, ft };
  });
  // extras
  const spinners: { o: THREE.Object3D; ax: 'x' | 'y' | 'z'; sp: number }[] = []; const sways: { o: THREE.Object3D; amp: number; sp: number; off: number }[] = [];
  let wings: THREE.Group[] = []; let cannon: THREE.Group | null = null; let halo: THREE.Object3D | null = null;
  const ex = L.extras;
  if (ex.includes('cannon')) {
    cannon = grp([-2.5 * L.tw * 0.9, 3.4 * L.th, -0.4], torso, [Math.PI / 2 - 0.2, 0, 0]);
    mk(G.box, md, [0.8, 1.2, 0.9], [0, 0, 0], [0, 0, 0], cannon); mk(G.cyl, mp, [0.42, 3.2, 0.42], [0, 2, 0], [0, 0, 0], cannon); mk(G.cyl, mf, [0.5, 0.3, 0.5], [0, 3.5, 0], [0, 0, 0], cannon); mk(G.tor, ma, 0.7, [0, 1.5, 0], [Math.PI / 2, 0, 0], cannon);
  }
  if (ex.includes('blades')) arms.forEach((a, i) => { const s = i ? -1 : 1; mk(G.cone, mf, [0.2, 2.6, 0.5], [s * 0.55, -1.1, -0.2], [2.7, 0, 0], a.el); mk(G.cone, mf, [0.2, 1.8, 0.4], [s * 0.4, -0.5, -0.4], [2.5, 0, 0], a.el); });
  if (ex.includes('pylons')) [1, -1].forEach(s => { const p = grp([s * 1.0, 2.6, -1.9], torso, [-0.25, 0, s * 0.25]); mk(G.cyl, md, [0.12, 3.4, 0.12], [0, 1.5, 0], [0, 0, 0], p); mk(G.sph, mf, 0.3, [0, 3.2, 0], [0, 0, 0], p); const r = mk(G.tor, mf, 0.6, [0, 2.4, 0], [Math.PI / 2, 0, 0], p); spinners.push({ o: r, ax: 'z', sp: 4 }); });
  if (ex.includes('cape')) { for (let i = 0; i < 3; i++) { const c = grp([(i - 1) * 0.9, 3.0, -1.7], torso); mk(G.box, ma, [0.7, 4.2 - Math.abs(i - 1) * 0.8, 0.07], [0, -2.0, 0], [0, 0, 0], c); sways.push({ o: c, amp: 0.2, sp: 2.2, off: i }); } }
  if (ex.includes('shield')) { const sg = grp([-0.4, -0.9, 1.0], aL.el, [0, 0, 0]); mk(G.hex, mp, [2.3, 0.35, 2.9], [0, 0, 0], [Math.PI / 2, 0, 0], sg); mk(G.hex, mf, [1.8, 0.4, 2.3], [0, 0, 0.05], [Math.PI / 2, 0, 0], sg); mk(G.hex, ma, [0.7, 0.5, 0.9], [0, 0, 0.1], [Math.PI / 2, 0, 0], sg); }
  if (ex.includes('tanks')) { [1, -1].forEach(s => { mk(G.cyl, ma, [0.75, 3.2, 0.75], [s * 1.15, 1.7, -2.1], [0, 0, 0], torso); mk(G.cyl, mf, [0.45, 0.5, 0.45], [s * 1.15, 3.4, -2.1], [0, 0, 0], torso); mk(G.cone, mf, [0.4, 1.3, 0.4], [s * 2.8 * L.tw, 3.6, 0], [0, 0, 0], torso); }); }
  if (ex.includes('spikes')) { [1, -1].forEach(s => { for (let i = 0; i < 3; i++) mk(G.cone, mice, [0.35, 1.6 + i * 0.5, 0.35], [s * (2.5 + i * 0.35) * L.tw, 3.1 + i * 0.4, -0.2 - i * 0.3], [0, 0, -s * (0.25 + i * 0.2)], torso); }); for (let i = 0; i < 4; i++) mk(G.cone, mice, [0.4, 2.2 + (i % 2), 0.4], [(i - 1.5) * 0.7, 3.4, -1.9], [-0.5, 0, (i - 1.5) * 0.2], torso); }
  if (ex.includes('wings')) { wings = [1, -1].map(s => { const w = grp([s * 0.9, 2.5, -1.9], torso); for (let i = 0; i < 5; i++) mk(G.trap, i % 2 ? ma : mp, [0.28, 5.8 - i * 0.6, 0.06 + 0.02 * i], [s * (2.6 - i * 0.2), 0.3 - i * 0.55, -0.1 * i], [0, 0, s * (1.5 - i * 0.14)], w).scale.y; mk(G.sph, mf, 0.3, [0, 0, 0], [0, 0, 0], w); return w; }); }
  if (ex.includes('halo')) { halo = grp([0, 3.4, -1.6], torso); const r = mk(G.tor, mf, 2.6, [0, 0, 0], [0, 0, 0], halo); r.scale.z = 1; mk(G.tor, mg, 3.2, [0, 0, 0], [0, 0, 0], halo); spinners.push({ o: r, ax: 'z', sp: 0.8 }); for (let i = 0; i < 5; i++) { const sg = grp([0, 3.4, 0], torso); const sh = mk(G.oct, mf, [0.3, 0.9, 0.3], [Math.cos(i * 1.256) * 3.6, Math.sin(i * 1.256) * 1.2, -1.6], [0, 0, 0], sg); void sh; spinners.push({ o: sg, ax: 'y', sp: 1.3 }); } }
  if (ex.includes('bulk')) { mk(G.trapInv, mp, [2.6 * L.tw, 1.2, 1.9], [0, 2.1, 0.2], [0, 0, 0], torso); [1, -1].forEach(s => { mk(G.cyl, md, [0.35, 1.8, 0.35], [s * 2.3 * L.tw, 3.7, -0.8], [0, 0, 0], torso); }); mk(G.box, ma, [3.2 * L.tw, 0.35, 1.5], [0, 0.7, 0.2], [0, 0, 0], torso); }
  if (cust.armor >= 2) mk(G.trap, ma, [1.7 * L.tw, 1.0, 0.5], [0, 2.2, 1.5], [0, 0, 0], torso);
  if (cust.armor >= 1) { mk(G.cone, ma, [0.2, 1.6, 0.2], [0.45, 3.3, 0.2], [0, 0, 0], torso); mk(G.cone, ma, [0.2, 1.6, 0.2], [-0.45, 3.3, 0.2], [0, 0, 0], torso); }
  // weapons
  let weapon: THREE.Group | null = null; let weaponL: THREE.Group | null = null; const muzzle = new THREE.Object3D(); let curW = ''; let isDual = false;
  function setWeapon(id: string) {
    if (curW === id) return; curW = id;
    [weapon, weaponL].forEach(w => { if (w) w.parent?.remove(w); }); weapon = null; weaponL = null;
    const w = weaponMesh(id, mp, ma, md, mf); weapon = w.g; handR.add(weapon); weapon.add(muzzle); muzzle.position.copy(w.tip.position);
    isDual = id === 'dualblade' || id === 'plasmafist';
    if (isDual) { const w2 = weaponMesh(id, mp, ma, md, mf); weaponL = w2.g; aL.hand.add(weaponL); }
    if (id === 'plasmafist') weapon.rotation.set(0, 0, 0);
  }
  setWeapon(cust.loadout[0]);
  group.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });

  const m: MechModel = {
    group, muzzle, handR, body, torso, head, phase: 0, stepped: 0, footR: legs[0].ft, footL: legs[1].ft, mats, hipY,
    setWeapon: id => { setWeapon(id); group.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; }); },
    setTransform(k: number) {
      mg.emissiveIntensity = 1.8 + 3 * k; mf.emissiveIntensity = 1.8 + 2.5 * k; const e = glowC.clone().multiplyScalar(0.28 * k);
      mp.emissive.copy(e); ma.emissive.copy(e);
      arms.forEach(a => a.pauld.scale.setScalar(1 + 0.22 * k)); wings.forEach((w, i) => { const s = i ? -1 : 1; w.rotation.z = s * lerp(0.15, -0.55, k); w.rotation.y = s * lerp(0.35, -0.1, k); w.scale.setScalar(lerp(0.7, 1.35, k)); });
      if (halo) halo.scale.setScalar(1 + 0.6 * k); if (def.id === 'omega') body.scale.setScalar(1 + 0.12 * k);
      (m as any).k = k;
    },
    setCloak(a: number) { [mp, ma, md].forEach(mm => { const tr = a > 0.01; if (mm.transparent !== tr) { mm.transparent = tr; mm.needsUpdate = true; } mm.opacity = 1 - 0.7 * a; }); },
    flash(v: number) { const k = (m as any).k || 0; const e = glowC.clone().multiplyScalar(0.28 * k).addScalar(v); mp.emissive.copy(e); ma.emissive.copy(e); md.emissive.copy(e); },
    update(t, dt, p) {
      const k = (m as any).k || 0; const sp = clamp(p.move, 0, 1.4); const A = Math.min(1, sp) * 0.8;
      if (sp > 0.04) this.phase += dt * (3 + 5.5 * sp); const ph = this.phase; const s = Math.sin(ph), c = Math.cos(ph);
      const fs = Math.floor(ph / Math.PI); if (fs !== (m as any).lastStep && sp > 0.1 && !p.air) this.stepped = (fs % 2) + 1; (m as any).lastStep = fs;
      const siege = def.transform.siege ? k : 0; const dead = p.dead; const idle = Math.sin(t * 1.7) * 0.02;
      // legs
      let ll = s * A, lr = -s * A, kl = Math.max(0, -c) * A * 1.3, kr = Math.max(0, c) * A * 1.3;
      if (p.air || p.fly) { ll = -0.45 + (p.fly ? 0.5 : 0); lr = 0.2; kl = 0.9; kr = 0.6; if (p.fly) { ll = 0.2; lr = 0.35; kl = 0.3; kr = 0.4; } }
      ll -= 0.3 * siege; lr -= 0.3 * siege; kl += 0.65 * siege; kr += 0.65 * siege;
      if (dead > 0) { ll = lerp(ll, -0.6, ease(dead)); lr = lerp(lr, 0.3, ease(dead)); kl = lerp(kl, 1.7, ease(dead)); kr = lerp(kr, 1.3, ease(dead)); }
      legs[0].hp.rotation.x = lerp(legs[0].hp.rotation.x, ll, Math.min(1, dt * 18)); legs[1].hp.rotation.x = lerp(legs[1].hp.rotation.x, lr, Math.min(1, dt * 18));
      legs[0].kn.rotation.x = lerp(legs[0].kn.rotation.x, kl, Math.min(1, dt * 18)); legs[1].kn.rotation.x = lerp(legs[1].kn.rotation.x, kr, Math.min(1, dt * 18));
      legs[0].ft.rotation.x = -(legs[0].hp.rotation.x - legs[0].kn.rotation.x * 0.5) * 0.7; legs[1].ft.rotation.x = -(legs[1].hp.rotation.x - legs[1].kn.rotation.x * 0.5) * 0.7;
      hips.position.y = hipY - 0.5 * Math.abs(s) * A - siege * 1.0 - (p.air ? 0 : 0) + idle * 3 - ease(dead) * 2.4;
      hips.rotation.y = s * 0.12 * A; torso.rotation.y = -s * 0.1 * A; body.rotation.x = lerp(body.rotation.x, (p.dash ? 0.45 : sp * 0.07) + (p.fly ? 0.5 : 0) - dead * 1.0, Math.min(1, dt * 10));
      torso.rotation.x = -p.hit * 0.4 + idle - p.atk * 0 + (p.charge ? -0.2 * p.charge : 0); torso.rotation.z = 0; body.position.z = -p.hit * 0.8;
      // arms
      let rx = -s * A * 0.6, rz = 0, ex = -0.15 - Math.max(0, c) * A * 0.3, lx = s * A * 0.6, lz = 0, lex = -0.15 - Math.max(0, -c) * A * 0.3;
      rz = -0.08; lz = 0.08;
      if (p.air) { rz = -0.6; lz = 0.6; rx = -0.4; lx = -0.4; }
      if (p.fly) { rx = 0.5; lx = 0.5; rz = -0.3; lz = 0.3; }
      let twist = 0; let lean = 0;
      if (p.guard) { rx = -1.3; lx = -1.3; rz = 0.9; lz = -0.9; ex = -1.6; lex = -1.6; }
      if (p.atk > 0 && !p.ranged) {
        const a = p.atk; const w = a < 0.35 ? ease(a / 0.35) : a < 0.6 ? 1 - ease((a - 0.35) / 0.25) * 1 : 0; const st = a < 0.35 ? 0 : a < 0.6 ? ease((a - 0.35) / 0.25) : 1 - ease((a - 0.6) / 0.4);
        const cb = p.combo % 3; const dual = isDual; const sgn = cb === 1 ? -1 : 1;
        if (cb === 2 || p.atkType === 'smash') { rx = lerp(rx, -3.5 * w + 0.1 * st + (a >= 0.35 ? -0.1 : 0) - (a >= 0.35 ? 0 : 0), 1); rx = a < 0.35 ? lerp(-s * A * 0.6, -3.5, ease(a / 0.35)) : lerp(-3.5, 0.0, st); lx = rx * 0.8; ex = -0.5 * w; lean = 0.5 * st - 0.3 * w; rz = 0; lz = 0; }
        else { rx = a < 0.35 ? lerp(-s * A * 0.6, -2.7, ease(a / 0.35)) : lerp(-2.7, -0.7, st); rz = (a < 0.35 ? lerp(-0.1, -0.9 * sgn, ease(a / 0.35)) : lerp(-0.9 * sgn, 0.6 * sgn, st)); twist = (a < 0.35 ? -0.7 * sgn * ease(a / 0.35) : lerp(-0.7 * sgn, 0.9 * sgn, st)); ex = -0.3; if (dual) { lx = a < 0.35 ? lerp(lx, -2.4, ease(a / 0.35)) : lerp(-2.4, -0.5, st); lz = -rz; } }
        if (p.atkType === 'punch') { rx = a < 0.3 ? lerp(-0.3, 0.6, a / 0.3) : -1.55; ex = a < 0.3 ? -2.2 : lerp(-2.2, -0.05, ease(Math.min(1, (a - 0.3) / 0.2))); rz = 0; twist = a < 0.3 ? 0.5 : -0.5; lx = -0.9; lex = -2; }
        if (p.atkType === 'thrust') { rx = a < 0.35 ? lerp(-0.4, -1.0, a / 0.35) : -1.57; rz = a < 0.35 ? -0.5 : 0; ex = a < 0.35 ? -1.8 : -0.05; twist = a < 0.35 ? -0.4 : 0.3; }
      } else if (p.ranged && (p.atk > 0 || p.fire > 0 || p.charge > 0)) {
        rx = -1.5 + p.fire * 0.28; rz = -0.05; ex = -0.1; lx = -1.0; lz = 0.4; lex = -0.7; twist = -0.12;
        if (def.transform.siege && k > 0.5) rx = -1.3;
      } else if (dead === 0) { rx += idle * 2; }
      if (dead > 0) { rx = lerp(rx, -0.4, ease(dead)); lx = lerp(lx, 0.6, ease(dead)); rz = lerp(rz, -1, dead); lz = lerp(lz, 1, dead); }
      const al = Math.min(1, dt * (p.atk > 0 ? 28 : 14));
      aR.sh.rotation.x = lerp(aR.sh.rotation.x, rx, al); aR.sh.rotation.z = lerp(aR.sh.rotation.z, rz, al); aR.el.rotation.x = lerp(aR.el.rotation.x, ex, al);
      aL.sh.rotation.x = lerp(aL.sh.rotation.x, lx, al); aL.sh.rotation.z = lerp(aL.sh.rotation.z, lz, al); aL.el.rotation.x = lerp(aL.el.rotation.x, lex, al);
      { const tw0 = (m as any).tw || 0; const want = (p.atk > 0 || p.ranged) ? twist : -s * 0.1 * A; const v = lerp(tw0, want, Math.min(1, dt * 20)); torso.rotation.y = v; (m as any).tw = v; }
      if (lean) torso.rotation.x += lean;
      head.rotation.y = -torso.rotation.y * 0.6; head.rotation.x = dead * 0.5;
      // extras
      const cn = cannon as THREE.Group | null; if (cn) cn.rotation.x = lerp(Math.PI / 2 - 0.2, 0.55, ease(def.transform.siege ? k : 0)) + (def.transform.siege ? 0 : Math.sin(t * 1.3) * 0.02);
      spinners.forEach(sn => (sn.o.rotation[sn.ax] += dt * sn.sp)); sways.forEach(sw => (sw.o.rotation.x = 0.25 + Math.sin(t * sw.sp + sw.off) * sw.amp + sp * 0.35));
      const ci = 1.6 + Math.sin(t * 4) * 0.4 + p.fire * 2; core.scale.setScalar(0.46 * (1 + 0.1 * Math.sin(t * 5))); if (!k) mg.emissiveIntensity = ci;
      if (halo) halo.rotation.z += dt * 0.5;
    },
    shatter(scene) {
      const out: THREE.Object3D[] = []; [aR.sh, aL.sh, head, ...wings].forEach(o => { if (o && o.parent) { scene.attach(o); out.push(o); } }); return out;
    },
    dispose() { mats.forEach(x => x.dispose()); },
  };
  (m as any).k = 0; m.setTransform(0); void eyes; return m;
}

// =========================================================== MONSTERS
export interface MonModel {
  group: THREE.Group; weak: THREE.Object3D; mouth: THREE.Object3D; mats: THREE.MeshStandardMaterial[]; heads: THREE.Object3D[];
  update(t: number, dt: number, mv: number, wind: number, strike: number): void; flash(v: number): void; shatter(scene: THREE.Object3D): THREE.Object3D[]; setPhase(p: number): void; dispose(): void; stomp: number; phaseCount: number;
}
interface Tag { legs: { o: THREE.Object3D; ph: number; amp: number; ax?: 'x' | 'z' }[]; sways: { o: THREE.Object3D; amp: number; sp: number; off: number; ax: 'x' | 'y' | 'z'; mvs?: number }[]; flaps: { o: THREE.Object3D; amp: number; side: number }[]; spins: { o: THREE.Object3D; ax: 'x' | 'y' | 'z'; sp: number }[]; arms: { o: THREE.Object3D; sign: number }[]; heads: THREE.Object3D[]; bob: number }

function chain(parent: THREE.Object3D, n: number, len: number, r0: number, r1: number, mat: THREE.Material, pos: V3, tg: Tag, amp = 0.25, sp = 2.5, axis: 'z' | 'y' = 'z', dir = -1, mat2?: THREE.Material, swayAx: 'x' | 'y' = 'y', spikes = false) {
  let par = parent; const out: THREE.Group[] = [];
  for (let i = 0; i < n; i++) {
    const p = grp(i === 0 ? pos : axis === 'z' ? [0, 0, dir * len] : [0, dir * len, 0], par); const r = lerp(r0, r1, i / Math.max(1, n - 1));
    if (axis === 'z') mk(G.sph, mat, [r, r * 0.9, len * 0.62], [0, 0, dir * len * 0.5], [0, 0, 0], p); else mk(G.sph, mat, [r * 0.9, len * 0.62, r], [0, dir * len * 0.5, 0], [0, 0, 0], p);
    if (spikes && mat2 && i < n - 1) mk(G.cone, mat2, [r * 0.3, r * 0.9, r * 0.3], [0, r * 0.8, dir * len * 0.5], [0, 0, 0], p);
    tg.sways.push({ o: p, amp, sp, off: i * 0.7, ax: swayAx, mvs: 0.5 }); out.push(p); par = p;
  }
  return out;
}
function headMesh(par: THREE.Object3D, m1: THREE.Material, m2: THREE.Material, mg: THREE.Material, md: THREE.Material, s: number, kind = 'beast') {
  const h = grp([0, 0, 0], par);
  if (kind === 'beast') { mk(G.sph, m1, [1 * s, 0.85 * s, 1.3 * s], [0, 0, 0.3 * s], [0, 0, 0], h); mk(G.trap, m1, [0.65 * s, 0.6 * s, 1.1 * s], [0, -0.15 * s, 1.5 * s], [Math.PI / 2, 0, 0], h); const jaw = grp([0, -0.35 * s, 0.8 * s], h); mk(G.trap, md, [0.6 * s, 0.25 * s, 1.1 * s], [0, 0, 0.6 * s], [Math.PI / 2, 0, 0], jaw);
    for (let i = 0; i < 4; i++) mk(G.cone, m2, [0.1 * s, 0.35 * s, 0.1 * s], [(i % 2 - 0.5) * 0.9 * s, 0.1 * s, (1.4 + Math.floor(i / 2) * 0.5) * s], [Math.PI, 0, 0], h);
    mk(G.sph, mg, 0.2 * s, [0.55 * s, 0.35 * s, 1.0 * s], [0, 0, 0], h); mk(G.sph, mg, 0.2 * s, [-0.55 * s, 0.35 * s, 1.0 * s], [0, 0, 0], h);
    mk(G.cone, m2, [0.2 * s, 1.1 * s, 0.2 * s], [0.5 * s, 0.9 * s, 0], [-0.5, 0, -0.4], h); mk(G.cone, m2, [0.2 * s, 1.1 * s, 0.2 * s], [-0.5 * s, 0.9 * s, 0], [-0.5, 0, 0.4], h); (h as any).jaw = jaw; }
  return h;
}
const plates = (par: THREE.Object3D, m: THREE.Material, n: number, z0: number, z1: number, y: number, w: number, sz: number) => { for (let i = 0; i < n; i++) { const z = lerp(z0, z1, i / Math.max(1, n - 1)); mk(G.cone, m, [w, sz * (1 - Math.abs(i / (n - 1) - 0.5) * 0.6), w * 0.6], [0, y + Math.sin((i / (n - 1)) * Math.PI) * 0.5, z], [0, 0, 0], par); } };
const leg = (par: THREE.Object3D, tg: Tag, x: number, y: number, z: number, len: number, th: number, m: THREE.Material, md: THREE.Material, ph: number, amp = 0.55) => {
  const p = grp([x, y, z], par); mk(G.hex, m, [th, len * 0.55, th], [0, -len * 0.27, 0], [0, 0, 0], p); const k = grp([0, -len * 0.5, 0], p); mk(G.sph, md, th * 0.8, [0, 0, 0], [0, 0, 0], k); mk(G.trap, m, [th * 0.8, len * 0.55, th * 0.8], [0, -len * 0.25, 0.1], [Math.PI, 0, 0], k);
  const f = grp([0, -len * 0.52, 0], k); mk(G.box, md, [th * 1.1, th * 0.4, th * 1.7], [0, 0, th * 0.5], [0, 0, 0], f); for (let i = -1; i <= 1; i++) mk(G.cone, md, [th * 0.18, th * 0.6, th * 0.18], [i * th * 0.4, 0, th * 1.5], [Math.PI / 2, 0, 0], f);
  tg.legs.push({ o: p, ph, amp }); return p;
};

export function buildMonster(d: MonDef): MonModel {
  const m1 = std(d.c1, { roughness: 0.75, metalness: 0.15 }), m2 = std(d.c2, { roughness: 0.6, metalness: 0.2 }), mg = glowMat(d.glow, 1.7), md = std('#16161d', { roughness: 0.7, metalness: 0.3 });
  const mats = [m1, m2, mg, md]; const tg: Tag = { legs: [], sways: [], flaps: [], spins: [], arms: [], heads: [], bob: 0 };
  const group = new THREE.Group(); const lean = grp([0, 0, 0], group); group.scale.setScalar(d.scale); const mouth = new THREE.Object3D(); const S = d.shape;
  const addHead = (h: THREE.Object3D) => { tg.heads.push(h); return h; };
  if (S === 'quad') {
    mk(G.sph, m1, [2.8, 2.4, 4.4], [0, 4.8, 0], [0, 0, 0], lean); mk(G.sph, m2, [2.2, 1.3, 3.6], [0, 6.4, -0.3], [0, 0, 0], lean); plates(lean, m2, 7, -3.6, 3, 7.0, 0.9, 1.9);
    [[-2.1, 2.9], [2.1, 2.9], [-2.1, -2.9], [2.1, -2.9]].forEach(([x, z], i) => leg(lean, tg, x, 4.2, z, 4.2, 0.95, m1, md, i % 3 === 0 ? 0 : Math.PI));
    const hd = grp([0, 5.4, 4.6], lean); addHead(hd); headMesh(hd, m2, m1, mg, md, 1.3); mouth.position.set(0, 0, 2.5); hd.add(mouth);
    chain(lean, 3, 2, 1.2, 0.5, m1, [0, 5, -4.2], tg, 0.2, 2, 'z', -1);
  } else if (S === 'raptor' || S === 'wolf') {
    const w = S === 'wolf'; const by = w ? 3.8 : 5.3;
    mk(G.sph, m1, w ? [1.5, 1.5, 3.4] : [1.5, 1.9, 3.1], [0, by, 0], [w ? 0 : -0.25, 0, 0], lean); mk(G.sph, m2, [1.1, 0.8, 2.6], [0, by - 0.9, 0.3], [0, 0, 0], lean); plates(lean, m2, 6, -2.5, 2.5, by + 1.5, 0.35, 1.3);
    if (w) { [[-1.2, 2.2], [1.2, 2.2], [-1.2, -2.2], [1.2, -2.2]].forEach(([x, z], i) => leg(lean, tg, x, 3.3, z, 3.4, 0.5, m1, md, i % 3 === 0 ? 0 : Math.PI, 0.9)); }
    else { [-1, 1].forEach((s, i) => leg(lean, tg, s * 1.5, 4.4, -0.2, 4.5, 0.85, m1, md, i ? Math.PI : 0, 0.8)); [-1, 1].forEach(s => { const a = grp([s * 1.3, by + 0.4, 2.3], lean); mk(G.hex, m1, [0.3, 1.6, 0.3], [0, -0.8, 0.3], [0.8, 0, 0], a); mk(G.cone, mg, [0.15, 0.8, 0.15], [0, -1.6, 1.0], [2.2, 0, 0], a); tg.arms.push({ o: a, sign: 1 }); }); }
    const hd = grp([0, by + (w ? 0.7 : 1.4), w ? 3.4 : 2.7], lean); addHead(hd); headMesh(hd, m1, m2, mg, md, w ? 0.95 : 1.0); mouth.position.set(0, 0, 2); hd.add(mouth);
    chain(lean, 4, 1.8, 0.9, 0.2, m1, [0, by - 0.2, -3], tg, 0.3, 3, 'z', -1);
  } else if (S === 'rex') {
    const big = d.boss; mk(G.sph, m1, [3.4, 3.6, 5.2], [0, 9.2, 0], [-0.3, 0, 0], lean); mk(G.sph, m2, [2.5, 2.2, 4.2], [0, 7.8, 1.2], [-0.3, 0, 0], lean); mk(G.sph, mg, 1.4, [0, 9.5, 3], [0, 0, 0], lean).scale.z = 0.5;
    [-1, 1].forEach((s, i) => leg(lean, tg, s * 2.6, 7, -0.5, 7, 1.7, m1, md, i ? Math.PI : 0, 0.5)); plates(lean, m2, big ? 10 : 7, -5.5, 3.5, 11.6, 1.0, big ? 3.2 : 2.3);
    [-1, 1].forEach(s => { const a = grp([s * 2.9, 9.0, 3.2], lean); mk(G.hex, m1, [0.6, 3, 0.6], [0, -1.4, 0.5], [0.5, 0, 0], a); for (let i = -1; i <= 1; i++) mk(G.cone, m2, [0.2, 1.1, 0.2], [i * 0.35, -3, 1.4], [2.2, 0, 0], a); tg.arms.push({ o: a, sign: 1 }); });
    const nk = grp([0, 11, 3.8], lean); mk(G.sph, m1, [1.8, 2, 2.2], [0, 0.6, 0.7], [0.5, 0, 0], nk); const hd = grp([0, 2.1, 2.2], nk); addHead(hd); headMesh(hd, m1, m2, mg, md, 2.0); mouth.position.set(0, 0, 4.2); hd.add(mouth);
    chain(lean, 6, 3.2, 2.5, 0.4, m1, [0, 7.6, -4.5], tg, 0.25, 2, 'z', -1, m2, 'y', true);
    if (d.id === 'abyssalrex') { [-1, 1].forEach(s => { mk(G.trap, m2, [0.2, 4.5, 2.6], [s * 3.2, 10.5, -1], [0, 0, s * 0.6], lean); mk(G.trap, mg, [0.1, 3.2, 1.8], [s * 3.3, 10.5, -1], [0, 0, s * 0.6], lean); }); }
  } else if (S === 'serpent') {
    const ch = chain(lean, 11, 2.7, 3.2 * (d.scale > 1.1 ? 1.1 : 1), 0.6, m1, [0, 2.8, 4], tg, 0.28, 2.6, 'z', -1, m2, 'y', true);
    for (let i = 0; i < 10; i++) mk(G.box, m2, [1.6 - i * 0.1, 0.2, 0.9], [0, 0, -1.4], [0, 0, 0], ch[i]);
    const nk = grp([0, 3, 4.3], lean); const nc = chain(nk, 3, 1.8, 1.6, 1.4, m1, [0, 0, 0], tg, 0.1, 2, 'y', 1); void nc; const hd = grp([0, 5.6, 0.4], nk); addHead(hd); headMesh(hd, m1, m2, mg, md, 1.8); mouth.position.set(0, 0, 3.4); hd.add(mouth);
    mk(G.sph, mg, 1.3, [0, 3.4, -2.4], [0, 0, 0], lean).scale.set(1, 0.6, 1);
  } else if (S === 'crab') {
    mk(G.sph, m1, [4.4, 2.5, 3.8], [0, 4.8, 0], [0, 0, 0], lean); mk(G.sph, m2, [3.6, 1.8, 3.1], [0, 6.0, -0.4], [0, 0, 0], lean); plates(lean, m2, 6, -2.5, 2.5, 7.6, 0.8, 1.5); mk(G.sph, mg, 1.2, [0, 6.5, -2], [0, 0, 0], lean);
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 3; i++) leg(lean, tg, s * 3.6, 4.2, (i - 1) * 2.0 - 0.3, 4.6, 0.55, m1, md, (i + (s > 0 ? 0 : 1)) % 2 ? Math.PI : 0, 0.5);
    [-1, 1].forEach(s => { const a = grp([s * 3.8, 5, 3.0], lean, [0, 0, 0]); mk(G.hex, m1, [0.7, 3.5, 0.7], [0, 0, 1.6], [Math.PI / 2 - 0.3, 0, 0], a); const cl = grp([0, 0.2, 3.4], a); mk(G.sph, m2, [1.7, 1.3, 2.0], [0, 0, 0.8], [0, 0, 0], cl); const jw = mk(G.cone, md, [1.0, 2.6, 0.5], [0.2, 0, 2.6], [Math.PI / 2, 0, 0], cl); void jw; mk(G.cone, md, [0.8, 2.2, 0.4], [-0.5, 0.2, 2.5], [Math.PI / 2, 0, 0], cl); tg.arms.push({ o: a, sign: 1 }); });
    [-1, 1].forEach(s => { mk(G.cyl, md, [0.1, 1.2, 0.1], [s * 0.8, 6, 3.6], [0.3, 0, 0], lean); mk(G.sph, mg, 0.3, [s * 0.8, 6.7, 3.8], [0, 0, 0], lean); }); mouth.position.set(0, 5, 4.5); lean.add(mouth);
  } else if (S === 'flyer') {
    const big = !!d.boss; mk(G.sph, m1, [1.8, 1.7, 4.4], [0, 0, 0], [0, 0, 0], lean); mk(G.sph, m2, [1.3, 1.0, 3.6], [0, -0.6, 0.4], [0, 0, 0], lean); mk(G.sph, mg, 0.9, [0, 0.4, 2.0], [0, 0, 0], lean).scale.z = 0.6; mk(G.sph, mg, 0.9, [0, -0.9, 2.5], [0, 0, 0], lean);
    const nk = grp([0, 0.5, 4], lean); mk(G.sph, m1, [0.9, 0.9, 1.7], [0, 0.4, 1], [-0.3, 0, 0], nk); const hd = grp([0, 1, 2.4], nk); addHead(hd); headMesh(hd, m1, m2, mg, md, 1.0); mouth.position.set(0, 0, 2.2); hd.add(mouth);
    [1, -1].forEach(s => { const w = grp([s * 1.6, 0.7, 0.4], lean); const mem = new THREE.Mesh(wingGeo, m2.clone()); (mem.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; mats.push(mem.material as THREE.MeshStandardMaterial); mem.scale.set(s * (big ? 1.5 : 1), 1, big ? 1.5 : 1); w.add(mem); mk(G.cyl, m1, [0.25, 14 * (big ? 1.5 : 1), 0.25], [s * 7 * (big ? 1.5 : 1), 0.1, 1.2], [0, 0, Math.PI / 2], w); tg.flaps.push({ o: w, amp: 0.55, side: s }); });
    chain(lean, 5, 1.7, 0.8, 0.15, m1, [0, 0, -4], tg, 0.35, 2.5, 'z', -1); [-1, 1].forEach(s => { mk(G.hex, md, [0.25, 1.8, 0.25], [s * 0.9, -1.8, 0.8], [0.3, 0, 0], lean); mk(G.cone, m2, [0.2, 0.9, 0.2], [s * 0.9, -2.8, 1.1], [Math.PI, 0, 0], lean); });
    tg.bob = 1;
  } else if (S === 'orb') {
    const sol = d.id === 'solarflare'; mk(G.ico, mg, 2.2, [0, 0, 0], [0, 0, 0], lean); mk(G.sph, m2, 3.0, [0, 0, 0], [0, 0, 0], lean).material = new THREE.MeshStandardMaterial({ color: d.c2, transparent: true, opacity: 0.28, emissive: d.glow, emissiveIntensity: 0.4 });
    for (let i = 0; i < 3; i++) { const r = mk(G.tor, i % 2 ? mg : m2, 4.2 + i * 0.9, [0, 0, 0], [i * 1.05, i * 0.7, 0], lean); r.scale.z = 1; tg.spins.push({ o: r, ax: i === 1 ? 'x' : 'z', sp: 0.8 + i * 0.6 }); }
    const n = sol ? 10 : 5; for (let i = 0; i < n; i++) { const a = grp([0, 0, 0], lean); mk(sol ? G.cone : G.oct, m2, sol ? [0.6, 2.4, 0.6] : [0.45, 1.1, 0.45], [Math.cos(i * 6.28 / n) * 4.4, Math.sin(i * 6.28 / n) * 1.4, Math.sin(i * 6.28 / n) * 4.4], [0, 0, sol ? Math.PI / 2 : 0], a); tg.spins.push({ o: a, ax: 'y', sp: 0.9 + (i % 3) * 0.3 }); }
    mouth.position.set(0, 0, 3); lean.add(mouth); tg.bob = 1.5;
  } else if (S === 'jelly') {
    const dm = mk(G.dome, m2, [4.4, 3.8, 4.4], [0, 1, 0], [0, 0, 0], lean); dm.material = new THREE.MeshStandardMaterial({ color: d.c2, transparent: true, opacity: 0.6, emissive: d.c1, emissiveIntensity: 0.5, flatShading: true, side: THREE.DoubleSide }); mats.push(dm.material as THREE.MeshStandardMaterial);
    mk(G.ico, mg, 1.7, [0, 2.2, 0], [0, 0, 0], lean); mk(G.tor, mg, 4.4, [0, 1, 0], [Math.PI / 2, 0, 0], lean);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; chain(lean, 4, 2.2, 0.5, 0.15, i % 2 ? m1 : mg, [Math.cos(a) * 3.2, 1, Math.sin(a) * 3.2], tg, 0.35, 2.2, 'y', -1, undefined, 'x'); }
    mouth.position.set(0, 1, 3); lean.add(mouth); tg.bob = 1.5;
  } else if (S === 'multi') {
    const n = d.heads || 3; const big = !!d.boss; mk(G.sph, m1, [3.3, 3.0, 4.8], [0, 6.2, 0], [0, 0, 0], lean); mk(G.sph, m2, [2.6, 1.6, 4], [0, 7.8, -0.3], [0, 0, 0], lean); plates(lean, m2, 8, -4, 3.2, 8.6, 0.9, 2.2); mk(G.sph, mg, 1.5, [0, 8, -2.5], [0, 0, 0], lean);
    [[-2.5, 3.1], [2.5, 3.1], [-2.5, -3.1], [2.5, -3.1]].forEach(([x, z], i) => leg(lean, tg, x, 5.2, z, 5.2, 1.1, m1, md, i % 3 === 0 ? 0 : Math.PI, 0.45));
    for (let i = 0; i < n; i++) { const f = n === 1 ? 0 : (i / (n - 1) - 0.5); const nk = grp([f * 4.2, 7.4, 3.6], lean, [0, f * 0.9, 0]); const segs = big ? 4 : 3; const ch = chain(nk, segs, 2.4, 0.95, 0.75, i % 2 ? m1 : m2, [0, 0, 0], tg, 0.18, 1.6 + i * 0.3, 'y', 1, undefined, 'x');
      const last = ch[ch.length - 1]; const hd = grp([0, 2.4, 0], last); headMesh(hd, m1, m2, mg, md, 1.2); hd.rotation.x = 1.0; addHead(hd); if (i === Math.floor(n / 2)) { mouth.position.set(0, 0, 2.6); hd.add(mouth); } }
    chain(lean, 4, 2.3, 1.4, 0.4, m1, [0, 6, -4.6], tg, 0.25, 2, 'z', -1);
  } else if (S === 'spider') {
    mk(G.sph, m1, [3.6, 3.0, 4.6], [0, 6.6, -2.6], [0, 0, 0], lean); mk(G.sph, m2, [2.6, 2.4, 2.8], [0, 6.2, 2.3], [0, 0, 0], lean); mk(G.sph, mg, 1.7, [0, 9.0, -2.6], [0, 0, 0], lean); mk(G.tor, mg, 2.0, [0, 8.8, -2.6], [Math.PI / 2, 0, 0], lean);
    plates(lean, m2, 6, -6, 1.5, 9.1, 0.7, 1.4); [-1, 1].forEach(s => { mk(G.cyl, md, [0.4, 4, 0.4], [s * 1.6, 8.6, 1.5], [1.35, 0, 0], lean); mk(G.cyl, mg, [0.5, 0.3, 0.5], [s * 1.6, 8.6, 3.4], [1.35, 0, 0], lean); });
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) { const p = grp([s * 2.2, 6.2, (i - 1.5) * 1.6 + 0.2], lean, [0, 0, s * 0.9]); mk(G.hex, m2, [0.4, 5, 0.4], [0, -2.2, 0], [0, 0, 0], p); const k = grp([0, -4.5, 0], p, [0, 0, -s * 1.4]); mk(G.hex, m1, [0.32, 6, 0.32], [0, -2.5, 0], [0, 0, 0], k); tg.legs.push({ o: p, ph: (i + (s > 0 ? 0 : 1)) % 2 ? Math.PI : 0, amp: 0.4, ax: 'x' }); }
    const hd = grp([0, 6.3, 4.1], lean); addHead(hd); mk(G.sph, m2, [1.5, 1.2, 1.4], [0, 0, 0], [0, 0, 0], hd); for (let i = 0; i < 5; i++) mk(G.sph, mg, 0.22, [(i - 2) * 0.5, 0.3, 1.2], [0, 0, 0], hd); mk(G.cone, md, [0.2, 1.2, 0.2], [0.5, -0.8, 1.1], [3, 0, 0.3], hd); mk(G.cone, md, [0.2, 1.2, 0.2], [-0.5, -0.8, 1.1], [3, 0, -0.3], hd); mouth.position.set(0, 1.5, 3); lean.add(mouth);
  } else if (S === 'mantis') {
    mk(G.sph, m1, [1.3, 3.4, 1.3], [0, 7.2, 0.6], [-0.3, 0, 0], lean); mk(G.sph, m1, [1.6, 1.7, 4.4], [0, 4.4, -2.6], [0.3, 0, 0], lean); mk(G.box, mg, [0.9, 0.4, 2.6], [0, 6.0, -3.6], [0.3, 0, 0], lean); plates(lean, m2, 5, -4.5, 0, 6.2, 0.4, 1.0);
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 2; i++) leg(lean, tg, s * 1.1, 4.4, -1.8 - i * 2.4, 4.6, 0.38, m2, md, (i + (s > 0 ? 0 : 1)) % 2 ? Math.PI : 0, 0.55);
    [-1, 1].forEach(s => { const a = grp([s * 1.2, 8.6, 1.2], lean); mk(G.hex, m2, [0.36, 3, 0.36], [0, -1.2, 0.8], [0.6, 0, 0], a); const e = grp([0, -2.5, 1.9], a); mk(G.hex, m1, [0.3, 3.4, 0.3], [0, -1.5, 0.8], [0.4, 0, 0], e); mk(G.trap, mg, [0.12, 4.0, 0.9], [0, -2.5, 1.5], [0.3, 0, 0], e); mk(G.cone, m2, [0.3, 1.6, 0.3], [0, -4.5, 2.3], [Math.PI + 0.3, 0, 0], e); tg.arms.push({ o: a, sign: 1 }); });
    const hd = grp([0, 9.7, 1.6], lean); addHead(hd); mk(G.trapInv, m1, [1.0, 1.0, 1.0], [0, 0, 0], [0, 0, 0], hd); mk(G.sph, mg, [0.55, 0.65, 0.4], [0.7, 0.2, 0.7], [0, 0, 0], hd); mk(G.sph, mg, [0.55, 0.65, 0.4], [-0.7, 0.2, 0.7], [0, 0, 0], hd); mk(G.cyl, md, [0.05, 2.4, 0.05], [0.4, 1.8, 0], [0, 0, 0.3], hd); mk(G.cyl, md, [0.05, 2.4, 0.05], [-0.4, 1.8, 0], [0, 0, -0.3], hd); mouth.position.set(0, 0, 1.5); hd.add(mouth);
  } else if (S === 'golem' || S === 'omega') {
    const vol = d.id === 'volcanus'; const om = S === 'omega'; const mr = vol ? mg : m2;
    mk(G.ico, m1, [3.8, 4.2, 3.2], [0, 11, 0], [0, 0.3, 0], lean); mk(G.oct, m1, [4.4, 3, 3.4], [0, 13.6, 0.2], [0, 0.6, 0], lean); mk(G.ico, mg, 1.8, [0, 11.8, 2.4], [0, 0, 0], lean); mk(G.ico, m2, [2.6, 2, 2.6], [0, 8.2, 0], [0, 0.2, 0], lean);
    [-1, 1].forEach((s, i) => { leg(lean, tg, s * 2.7, 7.4, 0, 7.6, 1.9, m1, md, i ? Math.PI : 0, 0.4); mk(G.ico, mr, [1.2, 1.4, 1.2], [s * 2.7, 6.0, 1.2], [0, 0, 0], lean); });
    [-1, 1].forEach(s => { const a = grp([s * 5.4, 13.6, 0], lean); mk(G.ico, m2, [2.2, 1.9, 2.2], [0, 0.5, 0], [0, 0, 0], a); mk(G.hex, m1, [1.35, 4.6, 1.35], [0, -3, 0.6], [0.2, 0, 0], a); mk(G.ico, mr, [2.0, 2.0, 2.0], [0, -6.2, 1.2], [0, 0.3, 0], a); if (vol) mk(G.cone, mg, [0.8, 2.6, 0.8], [0, 1.9, 0], [0, 0, 0], a); tg.arms.push({ o: a, sign: 1 }); });
    const hd = grp([0, 16.4, 1.2], lean); addHead(hd); mk(G.ico, m1, [1.7, 1.5, 1.6], [0, 0, 0], [0, 0.4, 0], hd); mk(G.box, mg, [1.6, 0.3, 0.4], [0, 0.1, 1.3], [0, 0, 0], hd); mk(G.cone, m2, [0.35, 1.6, 0.35], [0.9, 1.3, 0], [0, 0, -0.4], hd); mk(G.cone, m2, [0.35, 1.6, 0.35], [-0.9, 1.3, 0], [0, 0, 0.4], hd); mouth.position.set(0, 0, 2.2); hd.add(mouth);
    if (vol) { for (let i = 0; i < 7; i++) mk(G.cone, mg, [0.4, 1.6 + (i % 3), 0.4], [(i - 3) * 1.0, 15.4, -1.2 - Math.abs(i - 3) * 0.2], [-0.3, 0, (i - 3) * 0.15], lean); }
    else mk(G.tor, mg, 2.6, [0, 11.8, 2.5], [0, 0, 0], lean);
    if (om) {
      const ph1 = grp([0, 0, 0], lean), ph2 = grp([0, 0, 0], lean), ph3 = grp([0, 0, 0], lean); phases.push(ph1, ph2, ph3);
      for (let i = 0; i < 6; i++) mk(G.cone, mg, [0.7, 3.4, 0.7], [(i - 2.5) * 1.5, 15.5, -1.5], [-0.4, 0, (i - 2.5) * 0.18], ph1);
      [-1, 1].forEach(s => { const w = grp([s * 3, 14, -2], ph2); const mem = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({ color: d.c2, emissive: d.glow, emissiveIntensity: 0.5, side: THREE.DoubleSide, flatShading: true })); mats.push(mem.material as THREE.MeshStandardMaterial); mem.scale.set(s * 1.7, 1, 1.7); w.add(mem); tg.flaps.push({ o: w, amp: 0.3, side: s }); });
      mk(G.tor, mg, 7.5, [0, 15, -3], [0, 0, 0], ph3); mk(G.tor, m2, 9.5, [0, 15, -3.2], [0, 0, 0], ph3); tg.spins.push({ o: ph3, ax: 'z', sp: 0.7 });
      for (let i = 0; i < 6; i++) { const a = grp([0, 14, 0], ph3); mk(G.oct, mg, [0.8, 2.2, 0.8], [Math.cos(i * 1.047) * 11, Math.sin(i * 1.047) * 3, Math.sin(i * 1.047) * 11], [0, 0, 0], a); tg.spins.push({ o: a, ax: 'y', sp: 1 }); }
      ph1.visible = ph2.visible = ph3.visible = false;
    }
  } else if (S === 'kraken') {
    mk(G.sph, m1, [4.3, 6.2, 4.3], [0, 12, 0], [0, 0, 0], lean); mk(G.sph, m2, [3.4, 3, 3.4], [0, 8, 1], [0, 0, 0], lean); mk(G.sph, mg, 1.5, [0, 12.5, 3.3], [0, 0, 0], lean).scale.z = 0.5; mk(G.cone, m2, [1.2, 5, 1.2], [0, 18, -1], [0.4, 0, 0], lean);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; const t = grp([Math.cos(a) * 2.6, 7.5, Math.sin(a) * 2.6], lean, [Math.sin(a) * 0.6, -a, Math.cos(a) * -0.6]); const ch = chain(t, 5, 3.2, 1.0, 0.25, i % 2 ? m1 : m2, [0, 0, 0], tg, 0.25, 2 + i * 0.1, 'y', -1, undefined, 'x'); ch[0].rotation.x = 0.4; }
    const hd = grp([0, 8, 4], lean); addHead(hd); mouth.position.set(0, 0, 1); hd.add(mouth);
  } else if (S === 'hollow') {
    mk(G.cone, m1, [4.6, 12, 4.6], [0, 0, 0], [Math.PI, 0, 0], lean); mk(G.cone, m2, [3.4, 9, 3.4], [0, 1, 0], [Math.PI, 0, 0], lean); mk(G.sph, mg, 1.6, [0, 2.5, 3], [0, 0, 0], lean);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; chain(lean, 3, 2.2, 0.8, 0.3, i % 2 ? m1 : m2, [Math.cos(a) * 3.4, -3, Math.sin(a) * 3.4], tg, 0.3, 2, 'y', -1, undefined, 'x'); }
    const hd = grp([0, 7.2, 0.8], lean); addHead(hd); mk(G.sph, std('#d8d0e0', { roughness: 0.5 }), [1.8, 2.0, 1.8], [0, 0, 0], [0, 0, 0], hd); mk(G.sph, mg, [0.45, 0.65, 0.3], [0.7, 0.2, 1.5], [0, 0, 0], hd); mk(G.sph, mg, [0.45, 0.65, 0.3], [-0.7, 0.2, 1.5], [0, 0, 0], hd);
    for (let i = 0; i < 9; i++) { const a = (i / 9 - 0.5) * 2.6; mk(G.cone, mg, [0.3, 1.8 + (i % 2) * 1.0, 0.3], [Math.sin(a) * 2.0, 2 + Math.cos(a) * 0.4, 0], [0, 0, -a * 0.5], hd); } mouth.position.set(0, 0, 2); hd.add(mouth);
    [-1, 1].forEach(s => { const a = grp([s * 5.6, 3.6, 2.4], lean); mk(G.ico, m2, [1.3, 1.5, 1.3], [0, 0, 0], [0, 0, 0], a); for (let i = 0; i < 4; i++) mk(G.cone, md, [0.2, 1.8, 0.2], [(i - 1.5) * 0.4, -1.8, 0.5], [0.3, 0, 0], a); tg.arms.push({ o: a, sign: 1 }); tg.sways.push({ o: a, amp: 0.3, sp: 1.4, off: s, ax: 'z' }); });
    mk(G.tor, mg, 8.5, [0, 7, -3.5], [0, 0, 0], lean); for (let i = 0; i < 4; i++) { const a = grp([0, 3, 0], lean); mk(G.ico, mg, 0.9, [7 * Math.cos(i * 1.57), 0, 7 * Math.sin(i * 1.57)], [0, 0, 0], a); tg.spins.push({ o: a, ax: 'y', sp: 1.1 }); } tg.bob = 1;
  }
  // weak point node
  const wk = grp([d.weak[0] / d.scale, d.weak[1] / d.scale, d.weak[2] / d.scale], lean); const wr = d.weak[3] / d.scale;
  const wm = mk(G.ico, glowMat('#ff2a2a', 2.6), wr * 0.5, [0, 0, 0], [0, 0, 0], wk); mk(G.tor, glowMat('#ffd0a0', 1.5), wr * 0.8, [0, 0, 0], [0, 0, 0], wk); void wm; tg.spins.push({ o: wk, ax: 'y', sp: 2 });
  group.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  const flashMats = [m1, m2, md]; const ph = phases.splice(0); const phaseCount = d.phases?.length || 1;
  const mon: MonModel = {
    group, weak: wk, mouth, mats, heads: tg.heads, stomp: 0, phaseCount,
    flash(v) { flashMats.forEach(x => x.emissive.setRGB(v, v * 0.9, v * 0.8)); },
    setPhase(p) { ph.forEach((g, i) => (g.visible = p > i)); mg.emissiveIntensity = 1.7 + p * 0.5; if (d.shape === 'omega') { const cols = ['#ff4a3a', '#ff8a2a', '#ffd23a', '#fff0e0']; mg.color.set(cols[Math.min(3, p)]); mg.emissive.set(cols[Math.min(3, p)]); lean.scale.setScalar(1 + p * 0.08); } },
    update(t, dt, mv, wind, strike) {
      const f = 5 * (0.6 + mv * 0.8); const mvc = clamp(mv, 0, 1.3);
      for (const l of tg.legs) { const v = Math.sin(t * f + l.ph) * l.amp * mvc; if (l.ax === 'z') l.o.rotation.z = v; else l.o.rotation.x = v; }
      const st = Math.floor((t * f) / Math.PI); if (mvc > 0.3 && st !== (mon as any).ls) { mon.stomp = 1; } (mon as any).ls = st;
      for (const s of tg.sways) s.o.rotation[s.ax] = Math.sin(t * s.sp + s.off) * s.amp * (0.5 + mvc * (s.mvs ?? 0.5) + strike * 0.3);
      for (const fl of tg.flaps) fl.o.rotation.z = Math.sin(t * (6 + mvc * 3)) * fl.amp * fl.side * 1.3 + fl.side * 0.1;
      for (const s of tg.spins) s.o.rotation[s.ax] += dt * s.sp;
      for (const a of tg.arms) a.o.rotation.x = lerp(a.o.rotation.x, -2.1 * wind + 1.1 * strike + Math.sin(t * 1.5) * 0.05 + (mvc > 0.1 ? Math.sin(t * f) * 0.3 * mvc : 0), Math.min(1, dt * 14));
      for (const h of tg.heads) { h.rotation.x = lerp(h.rotation.x, -0.5 * wind + 0.6 * strike + Math.sin(t * 1.2 + h.id) * 0.06, Math.min(1, dt * 12)); const jw = (h as any).jaw; if (jw) jw.rotation.x = 0.1 + 0.7 * wind + Math.sin(t * 2 + h.id) * 0.04; }
      lean.rotation.x = lerp(lean.rotation.x, -0.16 * wind + 0.2 * strike, Math.min(1, dt * 10));
      lean.position.y = tg.bob ? Math.sin(t * 1.6) * tg.bob : Math.abs(Math.sin(t * f)) * 0.4 * mvc;
    },
    shatter(scene) { const out: THREE.Object3D[] = []; lean.children.slice(0, 40).forEach((o, i) => { if (i % 2 === 0 || d.death === 'explode') { scene.attach(o); out.push(o); } }); return out; },
    dispose() { mats.forEach(x => x.dispose()); },
  };
  mon.setPhase(0);
  return mon;
}
const phases: THREE.Group[] = [];
