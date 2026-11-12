import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp } from './noise';

// ---------- material / geometry helpers ----------
const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number | string, rough = 0.7, metal = 0.05, emissive?: number | string, ei = 1): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${metal}|${emissive}|${ei}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal });
    if (emissive !== undefined) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei; }
    matCache.set(key, m);
  }
  return m;
}
export const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.02 });
const gc = new Map<string, THREE.BufferGeometry>();
function cached(key: string, f: () => THREE.BufferGeometry) { let g = gc.get(key); if (!g) { g = f(); gc.set(key, g); } return g; }
const limbGeo = (rt: number, rb: number, len: number, seg = 8) => cached(`l${rt}${rb}${len}${seg}`, () => new THREE.CylinderGeometry(rt, rb, len, seg).translate(0, -len / 2, 0));
const sphereGeo = (r: number, ws = 12, hs = 9) => cached(`s${r}${ws}${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const boxGeo = (x: number, y: number, z: number) => cached(`b${x}${y}${z}`, () => new THREE.BoxGeometry(x, y, z));

interface Item { geo: THREE.BufferGeometry; key: string; p: [number, number, number]; s?: [number, number, number]; r?: [number, number, number] }
export function bakeItems(items: Item[], colors: Record<string, THREE.Color>): THREE.BufferGeometry {
  const list: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const it of items) {
    const g = it.geo.clone();
    e.set(...(it.r ?? [0, 0, 0]));
    m.compose(new THREE.Vector3(...it.p), q.setFromEuler(e), new THREE.Vector3(...(it.s ?? [1, 1, 1])));
    g.applyMatrix4(m);
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('uv');
    const c = colors[it.key] ?? new THREE.Color(1, 1, 1);
    const n = ng.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    list.push(ng);
  }
  return mergeGeometries(list, false)!;
}

// ---------- HUMANOID ----------
export interface HOpts { skin: number; shirt: number; pants: number; hair: number; shoes: number; detail?: boolean; scale?: number }
export const SKINS = [0xf1c9a5, 0xe0ac86, 0xc68a5e, 0x8d5a3b, 0x5c3a24, 0xffdcc0];
export const SHIRTS = [0xd94f4f, 0x3f6fd9, 0x3fb36b, 0xe8c545, 0xf0f0f0, 0x333844, 0xa45bd0, 0xf08a3d, 0x4ec7c7, 0xc9658f];
export const PANTS = [0x2c3550, 0x3a3a3a, 0x5a4a38, 0x1f2a44, 0x6b6b6b, 0x2e4a38];
export const HAIRS = [0x1c1410, 0x3a2414, 0x6b4a2a, 0xc9a050, 0x8a8a8a, 0x2a2a2a, 0x7a2a1a];

export class Humanoid {
  root = new THREE.Group();
  pelvis = new THREE.Group(); chest = new THREE.Group(); head = new THREE.Group();
  lArm = new THREE.Group(); rArm = new THREE.Group(); lElbow = new THREE.Group(); rElbow = new THREE.Group();
  lLeg = new THREE.Group(); rLeg = new THREE.Group(); lKnee = new THREE.Group(); rKnee = new THREE.Group();
  mats: Record<string, THREE.MeshStandardMaterial> = {};
  detail: boolean;
  phase = Math.random() * 10;
  T = new Float32Array(16);
  C = new Float32Array(16);
  meshes: THREE.Mesh[] = [];
  height = 1.8;

  constructor(o: HOpts) {
    this.detail = !!o.detail;
    const colors: Record<string, THREE.Color> = {
      skin: new THREE.Color(o.skin), shirt: new THREE.Color(o.shirt), pants: new THREE.Color(o.pants),
      hair: new THREE.Color(o.hair), shoes: new THREE.Color(o.shoes), trim: new THREE.Color(0xffffff), eye: new THREE.Color(0x111111),
    };
    if (this.detail) {
      for (const k of Object.keys(colors)) this.mats[k] = new THREE.MeshStandardMaterial({ color: colors[k], roughness: k === 'skin' ? 0.55 : 0.5, metalness: k === 'trim' ? 0.7 : 0.05 });
      this.mats.eye.emissive = new THREE.Color(0xffffff); this.mats.eye.emissiveIntensity = 1; this.mats.eye.color = new THREE.Color(0xffffff);
    }
    const bag = new Map<THREE.Group, Item[]>();
    const add = (g: THREE.Group, geo: THREE.BufferGeometry, key: string, p: [number, number, number], s?: [number, number, number], r?: [number, number, number]) => {
      if (this.detail) {
        const m = new THREE.Mesh(geo, this.mats[key]);
        m.position.set(...p); if (s) m.scale.set(...s); if (r) m.rotation.set(...r);
        m.castShadow = true; g.add(m); this.meshes.push(m);
      } else {
        if (!bag.has(g)) bag.set(g, []);
        bag.get(g)!.push({ geo, key, p, s, r });
      }
    };
    const R = this.root, pv = this.pelvis, ch = this.chest, hd = this.head;
    R.add(pv); pv.position.y = 0.93;
    pv.add(ch); ch.position.y = 0.08;
    ch.add(hd); hd.position.y = 0.62;
    add(pv, boxGeo(0.34, 0.2, 0.2), 'pants', [0, 0, 0]);
    add(ch, cached('torso', () => new THREE.CylinderGeometry(0.2, 0.165, 0.56, 12)), 'shirt', [0, 0.28, 0], [1, 1, 0.62]);
    add(ch, limbGeo(0.05, 0.055, 0.1), 'skin', [0, 0.64, 0]);
    add(hd, sphereGeo(0.115, 14, 10), 'skin', [0, 0.13, 0], [1, 1.15, 1.05]);
    add(hd, cached('hair', () => new THREE.SphereGeometry(0.123, 14, 8, 0, Math.PI * 2, 0, 1.95)), 'hair', [0, 0.15, -0.012], [1, 1.1, 1.08]);
    if (this.detail) {
      add(ch, boxGeo(0.4, 0.05, 0.2), 'trim', [0, 0.02, 0]);
      add(ch, sphereGeo(0.085, 10, 8), 'trim', [-0.25, 0.52, 0]); add(ch, sphereGeo(0.085, 10, 8), 'trim', [0.25, 0.52, 0]);
      add(ch, boxGeo(0.12, 0.12, 0.03), 'trim', [0, 0.38, 0.115]);
      add(hd, sphereGeo(0.019, 8, 6), 'eye', [-0.045, 0.15, 0.105]); add(hd, sphereGeo(0.019, 8, 6), 'eye', [0.045, 0.15, 0.105]);
      add(hd, boxGeo(0.02, 0.04, 0.03), 'skin', [0, 0.12, 0.125]);
    }
    for (const s of [-1, 1]) {
      const arm = s < 0 ? this.lArm : this.rArm, el = s < 0 ? this.lElbow : this.rElbow;
      ch.add(arm); arm.position.set(s * 0.265, 0.5, 0);
      arm.add(el); el.position.y = -0.3;
      if (this.detail) {
        add(arm, limbGeo(0.058, 0.046, 0.3), 'shirt', [0, 0, 0]);
        add(el, limbGeo(0.046, 0.04, 0.27), 'skin', [0, 0, 0]);
        add(el, sphereGeo(0.045, 8, 6), 'skin', [0, -0.29, 0]);
        add(el, limbGeo(0.052, 0.052, 0.07), 'trim', [0, -0.03, 0]);
      } else {
        add(arm, limbGeo(0.055, 0.045, 0.3), 'shirt', [0, 0, 0]);
        add(arm, limbGeo(0.045, 0.038, 0.28), 'skin', [0, -0.3, 0]);
        add(arm, sphereGeo(0.042, 8, 6), 'skin', [0, -0.59, 0]);
      }
      const leg = s < 0 ? this.lLeg : this.rLeg, kn = s < 0 ? this.lKnee : this.rKnee;
      pv.add(leg); leg.position.set(s * 0.1, -0.02, 0);
      leg.add(kn); kn.position.y = -0.46;
      add(leg, limbGeo(0.088, 0.066, 0.46), 'pants', [0, 0, 0]);
      add(kn, limbGeo(0.066, 0.05, 0.44), 'pants', [0, 0, 0]);
      add(kn, boxGeo(0.1, 0.07, 0.26), this.detail ? 'trim' : 'shoes', [0, -0.42, 0.05]);
    }
    if (!this.detail) {
      for (const [g, items] of bag) {
        const m = new THREE.Mesh(bakeItems(items, colors), vcMat);
        g.add(m); this.meshes.push(m);
      }
    }
    const sc = o.scale ?? 1;
    R.scale.setScalar(sc);
    this.height = 1.8 * sc;
  }

  /** drive joints. mode strings: idle walk run panic cheer kneel dead flail fly hover punch charge point */
  pose(mode: string, dt: number, speed: number, t: number, k = 12) {
    const T = this.T;
    T.fill(0);
    const freq = Math.min(14, 3 + speed * 0.6);
    this.phase += dt * freq * (mode === 'walk' || mode === 'run' || mode === 'panic' ? 1 : 0);
    const f = this.phase, s = Math.sin(f), amp = clamp(0.25 + speed * 0.07, 0.25, 1.0);
    // idx: 0 aLx 1 aLz 2 eL 3 aRx 4 aRz 5 eR 6 lLx 7 kL 8 lRx 9 kR 10 pelY 11 tilt 12 headX 13 rootX 14 rootY
    switch (mode) {
      case 'walk': case 'run':
        T[6] = s * amp; T[8] = -s * amp; T[7] = Math.max(0, -Math.cos(f)) * amp * 1.1; T[9] = Math.max(0, Math.cos(f)) * amp * 1.1;
        T[0] = -s * amp * 0.8; T[3] = s * amp * 0.8; T[2] = -0.3 - amp * 0.6; T[5] = -0.3 - amp * 0.6; T[1] = -0.06; T[4] = 0.06;
        T[10] = -Math.abs(Math.cos(f)) * 0.04 * amp; T[11] = mode === 'run' ? 0.18 : 0.04; break;
      case 'panic':
        T[6] = s * 0.95; T[8] = -s * 0.95; T[7] = Math.max(0, -Math.cos(f)) * 1.2; T[9] = Math.max(0, Math.cos(f)) * 1.2;
        T[0] = -2.5 + Math.sin(f * 1.3) * 0.4; T[3] = -2.5 - Math.sin(f * 1.3) * 0.4; T[1] = -0.45; T[4] = 0.45; T[2] = -0.5; T[5] = -0.5;
        T[10] = -Math.abs(Math.cos(f)) * 0.06; T[11] = 0.15; break;
      case 'cheer':
        T[0] = -2.9 + Math.sin(t * 9) * 0.25; T[3] = -2.9 + Math.sin(t * 9 + 1.6) * 0.25; T[1] = -0.35; T[4] = 0.35;
        T[10] = Math.abs(Math.sin(t * 6)) * 0.12; T[7] = 0.2; T[9] = 0.2; T[12] = -0.25; break;
      case 'kneel':
        T[10] = -0.4; T[7] = 1.6; T[9] = 1.6; T[0] = -2.5; T[3] = -2.5; T[1] = -0.3; T[4] = 0.3; T[2] = -0.4; T[5] = -0.4; T[11] = 0.1; T[12] = -0.4; break;
      case 'dead':
        T[13] = -1.5; T[14] = 0.15; T[1] = -0.5; T[4] = 0.5; T[0] = 0.2; T[3] = 0.2; T[6] = 0.1; T[8] = -0.1; break;
      case 'flail':
        T[0] = Math.sin(t * 15) * 1.8 - 1.5; T[3] = Math.cos(t * 13) * 1.8 - 1.5; T[6] = Math.sin(t * 11) * 1; T[8] = Math.cos(t * 12) * 1; T[7] = 0.6; T[9] = 0.6; T[1] = -0.6; T[4] = 0.6; break;
      case 'fly':
        T[0] = -3.05; T[3] = -3.05; T[1] = -0.08; T[4] = 0.08; T[2] = 0; T[5] = 0; T[6] = 0.22 + Math.sin(t * 7) * 0.04; T[8] = 0.12 - Math.sin(t * 7) * 0.04; T[7] = 0.12; T[9] = 0.08; T[12] = -0.55; break;
      case 'hover':
        T[0] = -0.25 + Math.sin(t * 1.7) * 0.05; T[3] = -0.25 + Math.sin(t * 1.7) * 0.05; T[1] = -0.55; T[4] = 0.55; T[2] = -0.25; T[5] = -0.25;
        T[6] = 0.12; T[8] = -0.1; T[7] = 0.35; T[9] = 0.22; T[10] = Math.sin(t * 1.7) * 0.03; T[11] = 0.03; break;
      case 'punch':
        T[3] = -1.57; T[5] = 0; T[4] = 0.05; T[0] = 0.5; T[2] = -1.3; T[1] = -0.2; T[11] = -0.25; T[6] = -0.5; T[8] = 0.5; T[7] = 0.25; T[9] = 0.4; break;
      case 'charge':
        T[0] = -1.35; T[3] = -1.35; T[2] = -0.25; T[5] = -0.25; T[1] = -0.12; T[4] = 0.12; T[6] = -0.25; T[8] = 0.25; T[7] = 0.2; T[9] = 0.35; T[10] = -0.05; break;
      case 'point':
        T[3] = -1.55; T[0] = 0; T[1] = -0.05; break;
      default: // idle
        T[0] = 0.04 + Math.sin(t * 1.5) * 0.03; T[3] = 0.04 - Math.sin(t * 1.5) * 0.03; T[1] = -0.08; T[4] = 0.08; T[2] = -0.12; T[5] = -0.12; T[11] = Math.sin(t * 1.5) * 0.015;
    }
    const a = 1 - Math.exp(-dt * k), C = this.C;
    for (let i = 0; i < 15; i++) C[i] += (T[i] - C[i]) * a;
    this.lArm.rotation.set(C[0], 0, C[1]); this.lElbow.rotation.x = C[2];
    this.rArm.rotation.set(C[3], 0, C[4]); this.rElbow.rotation.x = C[5];
    this.lLeg.rotation.x = C[6]; this.lKnee.rotation.x = C[7];
    this.rLeg.rotation.x = C[8]; this.rKnee.rotation.x = C[9];
    this.pelvis.position.y = 0.93 + C[10];
    this.chest.rotation.x = C[11]; this.head.rotation.x = C[12];
    this.root.rotation.x = C[13]; this.root.position.y = C[14];
  }
}

// ---------- VEHICLES ----------
export interface VehicleRig { group: THREE.Group; wheels: THREE.Object3D[]; rotor?: THREE.Object3D; rotor2?: THREE.Object3D; body?: THREE.MeshStandardMaterial; radius: number; lights: THREE.Mesh[]; spin?: THREE.Object3D }
const tireMat = mat(0x151515, 0.95, 0);
const rimMat = mat(0xcfd3d8, 0.25, 0.9);
const glassMat = mat(0x0c1822, 0.08, 0.85);
const darkMat = mat(0x1a1a1c, 0.8, 0.2);
const headMat = mat(0xfff5d0, 0.3, 0, 0xfff1b8, 0.9);
const tailMat = mat(0x990000, 0.3, 0, 0xff1010, 0.8);

function wheel(r: number, w: number): THREE.Group {
  const g = new THREE.Group();
  const t = new THREE.Mesh(cached(`tire${r}${w}`, () => new THREE.CylinderGeometry(r, r, w, 18).rotateZ(Math.PI / 2)), tireMat);
  const rim = new THREE.Mesh(cached(`rim${r}${w}`, () => new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 1.02, 10).rotateZ(Math.PI / 2)), rimMat);
  t.castShadow = true; g.add(t, rim);
  return g;
}
function extrudeProfile(pts: number[][], width: number, bevel = 0.07): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}
const CAR_SPECS: Record<string, any> = {
  sedan: { L: 4.5, W: 1.8, hood: 0.86, trunk: 0.92, cabF: 0.8, cabR: -1.35, roof: 1.45, rk1: 0.55, rk2: 0.7 },
  taxi: { L: 4.5, W: 1.8, hood: 0.86, trunk: 0.92, cabF: 0.8, cabR: -1.35, roof: 1.45, rk1: 0.55, rk2: 0.7 },
  sports: { L: 4.3, W: 1.9, hood: 0.66, trunk: 0.8, cabF: 0.45, cabR: -1.0, roof: 1.1, rk1: 0.65, rk2: 0.95, },
  suv: { L: 4.6, W: 1.95, hood: 1.0, trunk: 1.15, cabF: 0.9, cabR: -1.95, roof: 1.78, rk1: 0.25, rk2: 0.4 },
};
export const CAR_COLORS = [0xc0392b, 0x2c6fd6, 0xe8e8e8, 0x1b1b1f, 0xf1c40f, 0x7f8c8d, 0x27ae60, 0xd35400, 0x8e44ad, 0x16a085];

export function makeVehicle(type: string, color: number): VehicleRig {
  const g = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const lights: THREE.Mesh[] = [];
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.55 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, shadow = false) => {
    const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = shadow; g.add(me); return me;
  };
  const addWheels = (r: number, w: number, xs: number, zs: number[]) => {
    for (const z of zs) for (const s of [-1, 1]) {
      const wh = wheel(r, w); wh.position.set(s * xs, r, z); g.add(wh); wheels.push(wh);
    }
  };
  let radius = 2.4;
  if (type === 'sedan' || type === 'taxi' || type === 'sports' || type === 'suv') {
    const S = CAR_SPECS[type];
    const L = S.L, W = S.W;
    const hb = S.hood + 0.04;
    const lower = extrudeProfile([[-L / 2, 0.3], [L / 2, 0.3], [L / 2, 0.62], [L / 2 - 0.4, S.hood], [S.cabF, hb], [S.cabR, hb], [-L / 2 + 0.3, S.trunk], [-L / 2, S.trunk - 0.12]], W);
    add(lower, body, 0, 0, 0, true);
    const cabin = extrudeProfile([[S.cabR + 0.05, hb - 0.02], [S.cabR + S.rk2, S.roof], [S.cabF - S.rk1, S.roof], [S.cabF - 0.05, hb - 0.02]], W - 0.22, 0.04);
    add(cabin, glassMat);
    const roofLen = (S.cabF - S.rk1) - (S.cabR + S.rk2);
    add(boxGeo(W - 0.26, 0.06, roofLen), body, 0, S.roof + 0.02, (S.cabF - S.rk1 + S.cabR + S.rk2) / 2);
    add(boxGeo(W + 0.05, 0.16, 0.2), darkMat, 0, 0.42, L / 2 - 0.05); add(boxGeo(W + 0.05, 0.16, 0.2), darkMat, 0, 0.42, -L / 2 + 0.05);
    for (const s of [-1, 1]) {
      lights.push(add(boxGeo(0.34, 0.12, 0.06), headMat, s * (W / 2 - 0.3), 0.66, L / 2 + 0.03));
      lights.push(add(boxGeo(0.34, 0.1, 0.06), tailMat, s * (W / 2 - 0.3), 0.7, -L / 2 - 0.03));
    }
    if (type === 'taxi') add(boxGeo(0.6, 0.2, 0.25), mat(0xfff3a0, 0.4, 0, 0xffe070, 0.8), 0, S.roof + 0.15, 0);
    if (type === 'sports') add(boxGeo(W - 0.3, 0.05, 0.3), darkMat, 0, S.trunk + 0.18, -L / 2 + 0.2);
    addWheels(type === 'suv' ? 0.4 : 0.34, 0.26, W / 2 - 0.1, [L / 2 - 0.95, -L / 2 + 0.95]);
    radius = L / 2 + 0.5;
  } else if (type === 'truck') {
    const L = 2.7, W = 2.4, hb = 1.35;
    add(extrudeProfile([[-L / 2, 0.55], [L / 2, 0.55], [L / 2, 1.2], [L / 2 - 0.2, hb], [0.6, hb], [0.5, 2.5], [-L / 2, 2.5]], W), body, 0, 0, 5.1, true);
    add(extrudeProfile([[0.52, 1.5], [0.58, 2.35], [L / 2 - 0.5, 2.35], [L / 2 - 0.3, 1.5]], W - 0.12, 0.03), glassMat, 0, 0, 5.1);
    add(boxGeo(2.5, 2.6, 6.2), mat(0xe9edf0, 0.6, 0.05), 0, 1.95, 0.7, true);
    add(boxGeo(2.3, 0.35, 9.4), darkMat, 0, 0.55, 1.4);
    for (const s of [-1, 1]) { lights.push(add(boxGeo(0.4, 0.15, 0.06), headMat, s * 0.8, 0.85, 5.1 + L / 2 + 0.03)); lights.push(add(boxGeo(0.3, 0.2, 0.06), tailMat, s * 0.9, 0.7, -2.45)); }
    addWheels(0.5, 0.32, 1.1, [5.5, -0.4, -1.8]);
    radius = 5.8;
  } else if (type === 'bus') {
    add(boxGeo(2.55, 2.9, 10.6), body, 0, 2.0, 0, true);
    for (const s of [-1, 1]) add(boxGeo(0.04, 0.95, 9.2), glassMat, s * 1.28, 2.55, -0.2);
    add(boxGeo(2.3, 1.1, 0.04), glassMat, 0, 2.5, 5.33);
    add(boxGeo(2.6, 0.12, 10.65), mat(0xffffff, 0.5), 0, 3.47, 0);
    for (const s of [-1, 1]) { lights.push(add(boxGeo(0.4, 0.2, 0.06), headMat, s * 0.9, 0.95, 5.32)); lights.push(add(boxGeo(0.3, 0.3, 0.06), tailMat, s * 1.0, 1.1, -5.32)); }
    addWheels(0.5, 0.3, 1.15, [3.5, -3.4]);
    radius = 6;
  } else if (type === 'airliner' || type === 'plane') {
    const small = type === 'plane';
    const sc = small ? 0.28 : 1;
    const fus = new THREE.LatheGeometry([[0, -21], [1.1, -20], [2.0, -16], [2.35, -8], [2.4, 6], [2.15, 14], [1.4, 19], [0.5, 21.5], [0, 22]].map(p => new THREE.Vector2(p[1] < 0 ? p[0] : p[0], p[1])), 20);
    fus.rotateX(Math.PI / 2); // lathe axis Y -> Z
    const white = mat(small ? color : 0xf2f4f6, 0.35, 0.3);
    const body2 = new THREE.Mesh(fus, white); body2.castShadow = true; body2.scale.set(1, 1, -1); // nose +Z
    const grp = new THREE.Group(); g.add(grp); grp.scale.setScalar(sc);
    grp.add(body2);
    const wingShape = new THREE.Shape(); wingShape.moveTo(0, -3); wingShape.lineTo(21, 5); wingShape.lineTo(21, 7.5); wingShape.lineTo(0, 6.5); wingShape.closePath();
    const wg = new THREE.ExtrudeGeometry(wingShape, { depth: 0.5, bevelEnabled: false }); wg.rotateX(-Math.PI / 2);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wg, white); w.scale.x = s; w.position.set(0, -0.9, 1); w.castShadow = true; grp.add(w);
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 4.2, 14).rotateX(Math.PI / 2), mat(0xb8bcc2, 0.3, 0.8)); eng.position.set(s * 7.5, -2, 3); grp.add(eng);
      const st = new THREE.Shape(); st.moveTo(0, -1); st.lineTo(7, 3); st.lineTo(7, 4.5); st.lineTo(0, 4); st.closePath();
      const sg = new THREE.ExtrudeGeometry(st, { depth: 0.3, bevelEnabled: false }); sg.rotateX(-Math.PI / 2);
      const stab = new THREE.Mesh(sg, white); stab.scale.x = s; stab.position.set(0, 0.5, -17); grp.add(stab);
    }
    const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0, 7.5); fin.lineTo(-3.6, 7.5); fin.lineTo(-7, 0); fin.closePath();
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.4, bevelEnabled: false }); fg.translate(0, 0, -0.2); fg.rotateY(-Math.PI / 2);
    const finM = new THREE.Mesh(fg, mat(small ? 0xcc2222 : color, 0.4, 0.2)); finM.position.set(0, 1.8, -13); finM.castShadow = true; grp.add(finM);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.43, 2.43, 22, 20, 1, true).rotateX(Math.PI / 2), mat(small ? 0x2255aa : color, 0.4, 0.2)); stripe.position.z = 2; stripe.scale.set(1.0, 0.4, 1); stripe.position.y = -0.6; grp.add(stripe);
    const cockpit = new THREE.Mesh(boxGeo(2.4, 0.5, 1.2), glassMat); cockpit.position.set(0, 0.9, 17.4); grp.add(cockpit);
    const win = new THREE.Mesh(boxGeo(4.82, 0.4, 20), glassMat); win.position.set(0, 0.8, -1); win.scale.set(1, 1, 1); grp.add(win);
    if (small) { const prop = new THREE.Mesh(boxGeo(0.4, 9, 0.3), darkMat); prop.position.set(0, 0, 22.5); grp.add(prop); g.userData.prop = prop; }
    for (const z of [11, -2.5]) for (const s of [-1, 1]) { const wh = wheel(0.7, 0.4); wh.position.set(s * (z > 0 ? 0 : 3.2) * sc, 0.7 * sc, z * sc); wh.scale.setScalar(sc); if (z > 0 && s > 0) continue; g.add(wh); wheels.push(wh); }
    grp.position.y = 3.6 * sc;
    radius = 22 * sc;
  } else if (type === 'helicopter') {
    const hullM = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 });
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), hullM); hull.scale.set(1, 1, 1.7); hull.position.y = 1.9; hull.castShadow = true; g.add(hull);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10, 0, Math.PI * 2, 0, 1.2), glassMat); gl.scale.set(1, 1, 1.6); gl.position.set(0, 2.0, 0.4); g.add(gl);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.18, 6, 10).rotateX(Math.PI / 2), hullM); boom.position.set(0, 2.2, -4.8); g.add(boom);
    const tfin = new THREE.Mesh(boxGeo(0.1, 1.5, 1.0), hullM); tfin.position.set(0, 2.8, -7.4); g.add(tfin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7), darkMat); mast.position.y = 3.6; g.add(mast);
    const rotor = new THREE.Group(); rotor.position.y = 3.95;
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(boxGeo(9, 0.05, 0.35), darkMat); b.position.x = 0; b.rotation.y = (i * Math.PI) / 2; b.scale.x = 0.5; const bb = new THREE.Group(); bb.rotation.y = (i * Math.PI) / 2; b.rotation.y = 0; b.position.x = 2.2; bb.add(b); rotor.add(bb); }
    g.add(rotor);
    const rot2 = new THREE.Mesh(boxGeo(0.06, 2.2, 0.25), darkMat); rot2.position.set(0.2, 2.8, -7.5); const r2g = new THREE.Group(); r2g.position.set(0.25, 2.8, -7.5); r2g.add(new THREE.Mesh(boxGeo(0.04, 2.2, 0.2), darkMat)); g.add(r2g);
    for (const s of [-1, 1]) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6).rotateX(Math.PI / 2), darkMat); sk.position.set(s * 1.1, 0.3, 0.2); g.add(sk); const st = new THREE.Mesh(boxGeo(0.06, 1.1, 0.06), darkMat); st.position.set(s * 1.05, 0.8, 1); g.add(st); const st2 = st.clone(); st2.position.z = -0.8; g.add(st2); }
    lights.push(add(boxGeo(0.4, 0.2, 0.1), headMat, 0, 1.5, 2.5));
    radius = 6;
    return { group: g, wheels, rotor, rotor2: r2g, body: hullM, radius, lights };
  } else if (type === 'boat') {
    const hullM = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
    const sh = new THREE.Shape(); sh.moveTo(0, -5); sh.bezierCurveTo(2.2, -3, 2.0, 3.5, 1.5, 5); sh.lineTo(-1.5, 5); sh.bezierCurveTo(-2.0, 3.5, -2.2, -3, 0, -5);
    const hg = new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 }); hg.rotateX(-Math.PI / 2); hg.rotateY(Math.PI);
    const hm = new THREE.Mesh(hg, hullM); hm.position.y = -0.2; hm.castShadow = true; g.add(hm);
    add(boxGeo(2.6, 0.12, 8.2), mat(0xc9a36a, 0.7), 0, 1.02, -0.3);
    add(boxGeo(2.0, 1.2, 2.8), mat(0xf4f4f4, 0.4), 0, 1.7, -0.5, true);
    add(boxGeo(2.04, 0.5, 2.0), glassMat, 0, 1.9, -0.2);
    add(boxGeo(0.1, 1.3, 0.1), darkMat, 0, 2.9, -1);
    radius = 6;
    return { group: g, wheels, body: hullM, radius, lights };
  } else if (type === 'ufo') {
    const disc = new THREE.Mesh(new THREE.LatheGeometry([[0, -0.6], [2.2, -0.3], [5.4, 0.1], [6.0, 0.4], [5.0, 0.8], [2.4, 1.1], [0, 1.2]].map(p => new THREE.Vector2(p[0], p[1])), 28), mat(0x9aa4b0, 0.2, 0.95));
    disc.castShadow = true; g.add(disc);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.2, emissive: 0x22ffaa, emissiveIntensity: 0.6 }));
    dome.position.y = 1.1; g.add(dome);
    const ring = new THREE.Group();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const l = new THREE.Mesh(sphereGeo(0.3, 8, 6), mat(0xff66ff, 0.3, 0, 0xff55ff, 3)); l.position.set(Math.cos(a) * 5.5, 0.3, Math.sin(a) * 5.5); ring.add(l); }
    g.add(ring);
    radius = 6.5;
    return { group: g, wheels, body: undefined, radius, lights, spin: ring };
  }
  return { group: g, wheels, body, radius, lights };
}

// ---------- ANIMALS ----------
export interface AnimalRig { group: THREE.Group; legs: THREE.Group[]; head?: THREE.Object3D; tail?: THREE.Object3D; wings: THREE.Object3D[]; kind: string; segs?: THREE.Object3D[] }
interface QSpec { len: number; bh: number; bw: number; legH: number; legR: number; neckL: number; neckA: number; headR: number; snout: number; color: number; belly?: number; ear?: string; horns?: string; trunk?: boolean; hump?: number; tail?: string; scale: number; spots?: boolean }
const Q: Record<string, QSpec> = {
  deer: { len: 1.5, bh: 0.34, bw: 0.28, legH: 0.8, legR: 0.045, neckL: 0.55, neckA: 0.7, headR: 0.13, snout: 0.16, color: 0x9a6a3c, belly: 0xe8d5b0, ear: 'pointy', horns: 'antlers', tail: 'short', scale: 1.2 },
  cow: { len: 1.9, bh: 0.5, bw: 0.42, legH: 0.7, legR: 0.07, neckL: 0.4, neckA: 0.3, headR: 0.2, snout: 0.2, color: 0xf2f2f2, ear: 'pointy', horns: 'horns', tail: 'long', scale: 1.1, spots: true },
  wolf: { len: 1.1, bh: 0.23, bw: 0.19, legH: 0.5, legR: 0.04, neckL: 0.3, neckA: 0.5, headR: 0.11, snout: 0.2, color: 0x6e6e72, belly: 0xb8b8bb, ear: 'pointy', tail: 'bushy', scale: 1.1 },
  horse: { len: 1.9, bh: 0.4, bw: 0.3, legH: 1.0, legR: 0.055, neckL: 0.75, neckA: 0.75, headR: 0.15, snout: 0.3, color: 0x6a3d22, ear: 'pointy', tail: 'long', scale: 1.15 },
  elephant: { len: 3.4, bh: 1.1, bw: 0.95, legH: 1.3, legR: 0.28, neckL: 0.3, neckA: 0.3, headR: 0.62, snout: 0.2, color: 0x80868c, ear: 'big', trunk: true, tail: 'short', scale: 1.2 },
  camel: { len: 2.0, bh: 0.42, bw: 0.32, legH: 1.15, legR: 0.06, neckL: 0.9, neckA: 0.9, headR: 0.15, snout: 0.22, color: 0xc29a5e, ear: 'pointy', hump: 0.4, tail: 'short', scale: 1.15 },
  sheep: { len: 1.0, bh: 0.34, bw: 0.3, legH: 0.4, legR: 0.035, neckL: 0.2, neckA: 0.5, headR: 0.1, snout: 0.1, color: 0xf4f0e6, ear: 'pointy', tail: 'short', scale: 1 },
};
export function makeQuadruped(type: string): AnimalRig {
  const S = Q[type] ?? Q.deer;
  const g = new THREE.Group();
  const body = mat(S.color, 0.85, 0), belly = mat(S.belly ?? S.color, 0.85, 0), dark = mat(0x151515, 0.5, 0);
  const root = new THREE.Group(); g.add(root); root.scale.setScalar(S.scale);
  const by = S.legH + S.bh * 0.8;
  const mk = (geo: THREE.BufferGeometry, m: THREE.Material, p: number[], s?: number[], r?: number[], parent: THREE.Object3D = root) => {
    const me = new THREE.Mesh(geo, m); me.position.set(p[0], p[1], p[2]); if (s) me.scale.set(s[0], s[1], s[2]); if (r) me.rotation.set(r[0], r[1], r[2]); me.castShadow = true; parent.add(me); return me;
  };
  mk(sphereGeo(1, 14, 10), body, [0, by, 0], [S.bw, S.bh, S.len / 2]);
  mk(sphereGeo(1, 12, 8), body, [0, by + 0.02, S.len * 0.22], [S.bw * 1.05, S.bh * 1.05, S.len * 0.3]);
  mk(sphereGeo(1, 12, 8), belly, [0, by - S.bh * 0.35, 0], [S.bw * 0.92, S.bh * 0.7, S.len * 0.42]);
  if (S.hump) mk(sphereGeo(1, 10, 8), body, [0, by + S.bh + S.hump * 0.3, 0], [S.bw * 0.7, S.hump, S.bw * 0.9]);
  if (S.spots) for (let i = 0; i < 4; i++) mk(sphereGeo(1, 8, 6), dark, [(i % 2 ? 1 : -1) * S.bw * 0.82, by + (i % 3 - 1) * 0.1, (i - 1.5) * S.len * 0.2], [0.12, 0.17, 0.17]);
  const legs: THREE.Group[] = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const lg = new THREE.Group(); lg.position.set(sx * S.bw * 0.62, S.legH + S.bh * 0.35, sz * S.len * 0.3); root.add(lg);
    mk(limbGeo(S.legR * 1.35, S.legR * 0.8, S.legH + S.bh * 0.35, 7), body, [0, 0, 0], undefined, undefined, lg);
    mk(boxGeo(S.legR * 2, S.legR * 1.3, S.legR * 2.4), dark, [0, -(S.legH + S.bh * 0.35), S.legR * 0.3], undefined, undefined, lg);
    legs.push(lg);
  }
  const neck = new THREE.Group(); neck.position.set(0, by + S.bh * 0.35, S.len * 0.4); root.add(neck);
  neck.rotation.x = -S.neckA;
  mk(limbGeo(S.bw * 0.55, S.bw * 0.4, S.neckL, 8).clone().rotateX(Math.PI), body, [0, 0, 0], undefined, undefined, neck);
  const head = new THREE.Group(); head.position.set(0, S.neckL, 0); neck.add(head); head.rotation.x = S.neckA + 0.35;
  mk(sphereGeo(1, 12, 9), body, [0, 0, 0.02], [S.headR * 0.85, S.headR, S.headR * 1.1], undefined, head);
  if (S.snout > 0.1) mk(sphereGeo(1, 10, 8), body, [0, -S.headR * 0.25, S.headR * 1.1 + S.snout * 0.3], [S.headR * 0.55, S.headR * 0.55, S.snout], undefined, head);
  for (const s of [-1, 1]) {
    mk(sphereGeo(0.02 + S.headR * 0.1, 6, 5), dark, [s * S.headR * 0.7, S.headR * 0.2, S.headR * 0.7], undefined, undefined, head);
    if (S.ear === 'pointy') mk(cached('ear', () => new THREE.ConeGeometry(0.5, 1.4, 5)), body, [s * S.headR * 0.65, S.headR * 0.95, -S.headR * 0.2], [S.headR * 0.3, S.headR * 0.4, S.headR * 0.15], [0, 0, -s * 0.6], head);
    if (S.ear === 'big') mk(sphereGeo(1, 10, 8), body, [s * S.headR * 1.1, 0.1, -S.headR * 0.3], [0.05, S.headR * 0.9, S.headR * 0.8], undefined, head);
    if (S.horns === 'horns') mk(cached('horn', () => new THREE.ConeGeometry(0.5, 1.5, 6)), mat(0xe8e0c8, 0.5), [s * S.headR * 0.55, S.headR * 1.0, 0], [0.08, 0.1, 0.08], [0, 0, -s * 0.9], head);
    if (S.horns === 'antlers') for (let i = 0; i < 3; i++) mk(limbGeo(0.012, 0.008, 0.26, 4).clone().rotateX(Math.PI), mat(0xd8caa4, 0.6), [s * S.headR * 0.4 + s * i * 0.03, S.headR * 1.0, -0.02 - i * 0.05], undefined, [-0.3 + i * 0.25, 0, -s * (0.35 + i * 0.25)], head);
  }
  if (S.trunk) {
    let parent: THREE.Object3D = head; let len = 0.5;
    for (let i = 0; i < 4; i++) {
      const tg = new THREE.Group(); tg.position.set(0, i === 0 ? -S.headR * 0.3 : -len, i === 0 ? S.headR * 0.95 : 0); tg.rotation.x = i === 0 ? 0.3 : 0.28; parent.add(tg);
      mk(limbGeo(0.17 - i * 0.03, 0.14 - i * 0.03, len, 8), body, [0, 0, 0], undefined, undefined, tg); parent = tg; len = 0.45;
    }
    for (const s of [-1, 1]) mk(cached('tusk', () => new THREE.ConeGeometry(0.06, 0.9, 6)), mat(0xf0ecdc, 0.4), [s * 0.28, -S.headR * 0.4, S.headR * 0.95], undefined, [1.9, 0, 0], head);
  }
  const tail = new THREE.Group(); tail.position.set(0, by + S.bh * 0.3, -S.len * 0.48); root.add(tail);
  const tl = S.tail === 'long' ? 0.7 : S.tail === 'bushy' ? 0.5 : 0.18;
  mk(limbGeo(0.04, S.tail === 'bushy' ? 0.09 : 0.02, tl, 6), S.tail === 'long' ? dark : body, [0, 0, 0], undefined, [0.5, 0, 0], tail);
  return { group: g, legs, head, tail, wings: [], kind: 'quad' };
}

export function makeBird(color: number, span = 1): AnimalRig {
  const g = new THREE.Group();
  const m = mat(color, 0.7, 0), beak = mat(0xf0a020, 0.5, 0);
  const root = new THREE.Group(); root.scale.setScalar(span); g.add(root);
  const b = new THREE.Mesh(sphereGeo(1, 10, 8), m); b.scale.set(0.14, 0.13, 0.34); b.castShadow = true; root.add(b);
  const h = new THREE.Mesh(sphereGeo(0.1, 8, 6), m); h.position.set(0, 0.06, 0.34); root.add(h);
  const bk = new THREE.Mesh(cached('beak', () => new THREE.ConeGeometry(0.035, 0.14, 6).rotateX(Math.PI / 2)), beak); bk.position.set(0, 0.05, 0.47); root.add(bk);
  const tl = new THREE.Mesh(boxGeo(0.16, 0.02, 0.22), m); tl.position.set(0, 0, -0.42); root.add(tl);
  const wings: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.1, 0.05, 0.05); root.add(w);
    const wm = new THREE.Mesh(sphereGeo(1, 8, 4), m); wm.scale.set(0.5, 0.015, 0.2); wm.position.x = s * 0.5; w.add(wm);
    const tip = new THREE.Mesh(sphereGeo(1, 8, 4), mat(0x222222, 0.7, 0)); tip.scale.set(0.22, 0.012, 0.15); tip.position.x = s * 0.95; tip.position.z = -0.03; w.add(tip);
    wings.push(w);
  }
  return { group: g, legs: [], wings, kind: 'bird' };
}
export function makeFish(color: number, size = 1, whale = false): AnimalRig {
  const g = new THREE.Group();
  const m = mat(color, 0.4, 0.2), belly = mat(whale ? 0xdde4ea : 0xf4f0e0, 0.5, 0);
  const root = new THREE.Group(); root.scale.setScalar(size); g.add(root);
  const b = new THREE.Mesh(sphereGeo(1, 14, 10), m); b.scale.set(whale ? 1.5 : 0.18, whale ? 1.4 : 0.26, whale ? 4.5 : 0.7); b.castShadow = true; root.add(b);
  const bl = new THREE.Mesh(sphereGeo(1, 12, 8), belly); bl.scale.set(whale ? 1.4 : 0.15, whale ? 0.9 : 0.15, whale ? 4.2 : 0.62); bl.position.y = whale ? -0.5 : -0.1; root.add(bl);
  const tail = new THREE.Group(); tail.position.z = whale ? -4.2 : -0.62; root.add(tail);
  if (whale) {
    const fl = new THREE.Mesh(boxGeo(1, 0.1, 0.4), m); fl.scale.set(3.5, 1, 1); fl.position.z = -0.7; tail.add(fl);
    const nk = new THREE.Mesh(sphereGeo(1, 8, 6), m); nk.scale.set(0.7, 0.6, 1.5); nk.position.z = -0.3; tail.add(nk);
  } else {
    const fl = new THREE.Mesh(cached('tailfin', () => new THREE.ConeGeometry(0.28, 0.4, 3).rotateX(-Math.PI / 2).rotateZ(Math.PI / 2)), m); fl.position.z = -0.15; fl.scale.set(0.2, 1, 1); tail.add(fl);
    const df = new THREE.Mesh(cached('dorsal', () => new THREE.ConeGeometry(0.1, 0.3, 3)), m); df.position.set(0, 0.28, -0.05); df.rotation.x = -0.4; root.add(df);
  }
  for (const s of [-1, 1]) { const e = new THREE.Mesh(sphereGeo(whale ? 0.12 : 0.04, 6, 5), mat(0x111111)); e.position.set(s * (whale ? 1.2 : 0.14), whale ? 0.2 : 0.06, whale ? 3 : 0.4); root.add(e); }
  return { group: g, legs: [], tail, wings: [], kind: whale ? 'whale' : 'fish' };
}
export function makeDragon(color: number): AnimalRig {
  const g = new THREE.Group();
  const m = mat(color, 0.5, 0.25), horn = mat(0xe8dcc0, 0.4), glow = mat(0xffd040, 0.3, 0, 0xffa000, 2);
  const root = new THREE.Group(); root.scale.setScalar(4); g.add(root);
  const add = (geo: THREE.BufferGeometry, mm: THREE.Material, p: number[], s: number[], r?: number[], par: THREE.Object3D = root) => { const me = new THREE.Mesh(geo, mm); me.position.set(p[0], p[1], p[2]); me.scale.set(s[0], s[1], s[2]); if (r) me.rotation.set(r[0], r[1], r[2]); me.castShadow = true; par.add(me); return me; };
  add(sphereGeo(1, 14, 10), m, [0, 0, 0], [0.5, 0.45, 1.0]);
  add(sphereGeo(1, 12, 8), mat(0xe0c070, 0.6), [0, -0.2, 0.1], [0.4, 0.3, 0.85]);
  const neck = new THREE.Group(); neck.position.set(0, 0.15, 0.8); root.add(neck); neck.rotation.x = -0.6;
  add(limbGeo(0.28, 0.2, 0.9, 8).clone().rotateX(Math.PI), m, [0, 0, 0], [1, 1, 1], undefined, neck);
  const head = new THREE.Group(); head.position.y = 0.9; head.rotation.x = 1.0; neck.add(head);
  add(sphereGeo(1, 12, 9), m, [0, 0, 0.05], [0.22, 0.2, 0.34], undefined, head);
  add(sphereGeo(1, 10, 8), m, [0, -0.04, 0.38], [0.14, 0.11, 0.26], undefined, head);
  for (const s of [-1, 1]) {
    add(cached('dhorn', () => new THREE.ConeGeometry(0.05, 0.4, 6)), horn, [s * 0.12, 0.17, -0.1], [1, 1, 1], [-0.9, 0, -s * 0.3], head);
    add(sphereGeo(0.04, 6, 5), glow, [s * 0.15, 0.08, 0.15], [1, 1, 1], undefined, head);
  }
  const segs: THREE.Object3D[] = [];
  let par: THREE.Object3D = root, off = -0.9, rad = 0.3;
  for (let i = 0; i < 6; i++) {
    const tg = new THREE.Group(); tg.position.set(0, 0, off); par.add(tg);
    add(cached(`tseg${i}`, () => new THREE.ConeGeometry(rad, 0.6, 7).rotateX(-Math.PI / 2).translate(0, 0, -0.3)), m, [0, 0, 0], [1, 1, 1], undefined, tg);
    segs.push(tg); par = tg; off = -0.55; rad *= 0.78;
  }
  const wings: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.3, 0.3, 0.3); root.add(w);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.6, 0.9); sh.lineTo(2.9, 0.6); sh.lineTo(2.4, 0.1); sh.lineTo(2.5, -0.5); sh.lineTo(1.5, -0.2); sh.lineTo(1.1, -0.9); sh.lineTo(0.5, -0.4); sh.closePath();
    const wm = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.7, side: THREE.DoubleSide }));
    wm.scale.x = s; wm.castShadow = true; w.add(wm); wings.push(w);
  }
  const legs: THREE.Group[] = [];
  return { group: g, legs, head, tail: neck, wings, kind: 'dragon', segs };
}

// ---------- TREES / SCATTER GEOMETRIES ----------
export function mergeColored(parts: { geo: THREE.BufferGeometry; color: number; jitter?: number }[]): THREE.BufferGeometry {
  const list: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    const n = g.attributes.position.count;
    const c = new THREE.Color(p.color);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const j = 1 + ((i / 3) | 0) % 2 * 0 + (Math.sin(i * 12.9898) * 0.5) * (p.jitter ?? 0);
      arr[i * 3] = c.r * j; arr[i * 3 + 1] = c.g * j; arr[i * 3 + 2] = c.b * j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    list.push(g);
  }
  return mergeGeometries(list, false)!;
}
const T = (g: THREE.BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);
export const SCATTER_GEO: Record<string, () => THREE.BufferGeometry> = {
  pine: () => mergeColored([
    { geo: T(new THREE.CylinderGeometry(0.2, 0.32, 3.2, 6), 0, 1.6, 0), color: 0x5a3b22 },
    { geo: T(new THREE.ConeGeometry(2.4, 4, 8), 0, 4, 0), color: 0x1d4d2a, jitter: 0.25 },
    { geo: T(new THREE.ConeGeometry(1.9, 3.6, 8), 0, 6.2, 0), color: 0x23592f, jitter: 0.25 },
    { geo: T(new THREE.ConeGeometry(1.4, 3.2, 8), 0, 8.2, 0), color: 0x2a6636, jitter: 0.25 },
    { geo: T(new THREE.ConeGeometry(0.9, 2.6, 8), 0, 10, 0), color: 0x30733c, jitter: 0.2 },
  ]),
  oak: () => mergeColored([
    { geo: T(new THREE.CylinderGeometry(0.25, 0.42, 3.4, 6), 0, 1.7, 0), color: 0x5e4128 },
    { geo: T(new THREE.IcosahedronGeometry(2.4, 1), 0, 5.2, 0), color: 0x3f8a3a, jitter: 0.3 },
    { geo: T(new THREE.IcosahedronGeometry(1.7, 1), 1.5, 4.4, 0.6), color: 0x4a9a42, jitter: 0.3 },
    { geo: T(new THREE.IcosahedronGeometry(1.6, 1), -1.4, 4.6, -0.7), color: 0x377a34, jitter: 0.3 },
  ]),
  palm: () => {
    const parts: { geo: THREE.BufferGeometry; color: number; jitter?: number }[] = [];
    for (let i = 0; i < 5; i++) parts.push({ geo: T(new THREE.CylinderGeometry(0.2 - i * 0.015, 0.24 - i * 0.015, 1.5, 6), 0.12 * i * i * 0.35, 0.75 + i * 1.45, 0), color: 0x8a6a42 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const g = new THREE.ConeGeometry(0.5, 4.2, 4); g.scale(1, 1, 0.12); g.translate(0, 2.1, 0); g.rotateZ(-1.15); g.rotateY(a); g.translate(0.9, 7.2, 0);
      parts.push({ geo: g, color: 0x2e8b3a, jitter: 0.3 });
    }
    return mergeColored(parts);
  },
  cactus: () => mergeColored([
    { geo: T(new THREE.CylinderGeometry(0.4, 0.45, 4.2, 8), 0, 2.1, 0), color: 0x3e7d3a },
    { geo: T(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 8), 0.85, 2.6, 0), color: 0x468a40 },
    { geo: T(new THREE.CylinderGeometry(0.28, 0.28, 1.2, 8).rotateZ(Math.PI / 2), 0.55, 1.9, 0), color: 0x468a40 },
    { geo: T(new THREE.CylinderGeometry(0.26, 0.26, 1.3, 8), -0.8, 3.0, 0), color: 0x468a40 },
    { geo: T(new THREE.CylinderGeometry(0.26, 0.26, 1.1, 8).rotateZ(Math.PI / 2), -0.5, 2.4, 0), color: 0x468a40 },
  ]),
  rock: () => { const g = new THREE.IcosahedronGeometry(1.6, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.3) * 0.18 + Math.cos(p.getY(i) * 4.1) * 0.12; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); } g.translate(0, 0.6, 0); return mergeColored([{ geo: g, color: 0x7a7a78, jitter: 0.25 }]); },
  coral: () => mergeColored([
    { geo: T(new THREE.IcosahedronGeometry(0.9, 1), 0, 0.6, 0), color: 0xff7a9a, jitter: 0.3 },
    { geo: T(new THREE.ConeGeometry(0.35, 2.2, 6), 0.7, 1.1, 0.2), color: 0xffa04d, jitter: 0.2 },
    { geo: T(new THREE.ConeGeometry(0.3, 1.8, 6), -0.6, 0.9, -0.3), color: 0xc060ff, jitter: 0.2 },
  ]),
  kelp: () => mergeColored([
    { geo: T(new THREE.ConeGeometry(0.22, 6, 5), 0, 3, 0), color: 0x2f7a3a, jitter: 0.2 },
    { geo: T(new THREE.ConeGeometry(0.18, 5, 5), 0.5, 2.5, 0.2), color: 0x3a8a40, jitter: 0.2 },
    { geo: T(new THREE.ConeGeometry(0.18, 4.5, 5), -0.4, 2.2, -0.3), color: 0x28703a, jitter: 0.2 },
  ]),
  lamp: () => mergeColored([
    { geo: T(new THREE.CylinderGeometry(0.1, 0.14, 7.5, 6), 0, 3.75, 0), color: 0x3a3d42 },
    { geo: T(new THREE.BoxGeometry(2.0, 0.12, 0.12), 0.9, 7.5, 0), color: 0x3a3d42 },
    { geo: T(new THREE.BoxGeometry(0.7, 0.18, 0.35), 1.8, 7.42, 0), color: 0xdddddd },
  ]),
  asteroid: () => { const g = new THREE.IcosahedronGeometry(6, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 0.9 + p.getZ(i) * 0.7) * 0.25 + Math.cos(p.getY(i) * 1.3) * 0.2; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); } return mergeColored([{ geo: g, color: 0x6a625a, jitter: 0.35 }]); },
};
export const SCATTER_INFO: Record<string, { r: number; h: number; debris: number }> = {
  pine: { r: 1.8, h: 11, debris: 0x2a5a32 }, oak: { r: 2.2, h: 8, debris: 0x3f8a3a }, palm: { r: 1.5, h: 9, debris: 0x2e8b3a }, cactus: { r: 0.9, h: 4, debris: 0x3e7d3a },
  rock: { r: 1.8, h: 2.5, debris: 0x7a7a78 }, coral: { r: 1.2, h: 2, debris: 0xff7a9a }, kelp: { r: 0.8, h: 6, debris: 0x2f7a3a }, lamp: { r: 0.5, h: 7.5, debris: 0x3a3d42 }, asteroid: { r: 7, h: 10, debris: 0x6a625a },
};

// ---------- WEAPONS ----------
export function makeSword(color = 0xffe38a): THREE.Group {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 9, 4).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: 0xf0f6ff, emissive: color, emissiveIntensity: 1.2, metalness: 1, roughness: 0.15 }));
  blade.scale.set(1, 1, 0.22); blade.position.y = 4.5; g.add(blade);
  const guard = new THREE.Mesh(boxGeo(3, 0.35, 0.5), mat(color, 0.3, 0.9, color, 0.8)); guard.position.y = 9.1; g.add(guard);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 8), mat(0x553322)); hilt.position.y = 10.3; g.add(hilt);
  const pommel = new THREE.Mesh(sphereGeo(0.4, 8, 6), mat(color, 0.2, 0.9, color, 2)); pommel.position.set(0, 11.5, 0); g.add(pommel);
  return g;
}
export function makeSpear(color = 0x9fe8ff): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 8).rotateX(Math.PI / 2), mat(0x8a6a42)); g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 6).rotateX(Math.PI / 2), mat(0xffffff, 0.1, 1, color, 2)); tip.position.z = 5; g.add(tip);
  return g;
}
export function makeMissile(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.5, 10).rotateX(Math.PI / 2), mat(0xe8e8ea, 0.3, 0.6)));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 10).rotateX(Math.PI / 2), mat(0xcc2222, 0.3, 0.5)); nose.position.z = 2.3; g.add(nose);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(boxGeo(0.05, 0.9, 0.7), mat(0x333333)); f.position.z = -1.4; f.rotation.z = (i * Math.PI) / 2; f.position.x = Math.cos((i * Math.PI) / 2) * 0.4; f.position.y = Math.sin((i * Math.PI) / 2) * 0.4; g.add(f); }
  return g;
}
export function makeHammer(): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(boxGeo(22, 14, 14), mat(0x8a929c, 0.25, 0.95, 0x66aaff, 0.35)); head.position.y = 36; head.castShadow = true; g.add(head);
  for (const s of [-1, 1]) { const band = new THREE.Mesh(boxGeo(2, 15, 15), mat(0xffd24d, 0.3, 0.9, 0xffaa00, 0.6)); band.position.set(s * 8, 36, 0); g.add(band); }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 40, 10), mat(0x5a3a22, 0.7)); handle.position.y = 15; handle.castShadow = true; g.add(handle);
  return g;
}
export function makeRock(size: number, color = 0x5a4a40): THREE.Mesh {
  const g = new THREE.IcosahedronGeometry(size, 1); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 2.1 + p.getZ(i) * 3.7) * 0.2; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.9, emissive: 0xff5a10, emissiveIntensity: 1.2 }));
}
