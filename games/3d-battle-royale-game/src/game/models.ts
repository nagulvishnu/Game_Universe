import * as THREE from 'three';
import type { WeaponId, VehicleType } from './data';

export const BOX = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map<number, THREE.MeshLambertMaterial>();
const basicCache = new Map<number, THREE.MeshBasicMaterial>();

export function mat(color: number): THREE.MeshLambertMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}
export function basic(color: number): THREE.MeshBasicMaterial {
  let m = basicCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    basicCache.set(color, m);
  }
  return m;
}

export function bx(w: number, h: number, l: number, color: number, x = 0, y = 0, z = 0, unlit = false): THREE.Mesh {
  const m = new THREE.Mesh(BOX, unlit ? basic(color) : mat(color));
  m.scale.set(w, h, l);
  m.position.set(x, y, z);
  return m;
}

/* ---------------- weapons ---------------- */
const weaponCache = new Map<WeaponId, THREE.Group>();

function buildWeapon(id: WeaponId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case 'knife':
      g.add(bx(0.04, 0.07, 0.38, 0xcfd8e3, 0, 0, -0.3), bx(0.055, 0.06, 0.14, 0x1f2937, 0, 0, -0.02));
      break;
    case 'axe':
      g.add(bx(0.05, 0.05, 0.85, 0x7c4a21, 0, 0, -0.3), bx(0.045, 0.24, 0.2, 0x9ca3af, 0, 0.05, -0.68), bx(0.05, 0.1, 0.08, 0xef4444, 0, 0.17, -0.6));
      break;
    case 'pistol':
      g.add(bx(0.06, 0.09, 0.3, 0x2b2f36, 0, 0, -0.14), bx(0.055, 0.13, 0.07, 0x111827, 0, -0.1, -0.02));
      break;
    case 'smg':
      g.add(bx(0.07, 0.1, 0.45, 0x2b2f36, 0, 0, -0.2), bx(0.04, 0.17, 0.06, 0x111827, 0, -0.13, -0.18), bx(0.03, 0.03, 0.14, 0x111827, 0, 0, -0.5), bx(0.04, 0.05, 0.1, 0xf59e0b, 0, 0.07, -0.1));
      break;
    case 'ar':
      g.add(bx(0.07, 0.11, 0.7, 0x374151, 0, 0, -0.3), bx(0.06, 0.12, 0.25, 0x7c4a21, 0, -0.01, 0.2), bx(0.05, 0.2, 0.08, 0x111827, 0, -0.15, -0.28), bx(0.03, 0.03, 0.28, 0x111827, 0, 0, -0.8), bx(0.04, 0.05, 0.12, 0x111827, 0, 0.08, -0.3));
      break;
    case 'shotgun':
      g.add(bx(0.07, 0.09, 0.55, 0x7c4a21, 0, 0, -0.1), bx(0.05, 0.05, 0.6, 0x1f2937, 0, 0.03, -0.62), bx(0.06, 0.07, 0.22, 0x5b3a1b, 0, -0.03, -0.45));
      break;
    case 'sniper':
      g.add(bx(0.06, 0.1, 0.9, 0x1f3a2a, 0, 0, -0.3), bx(0.055, 0.055, 0.34, 0x0b0f14, 0, 0.12, -0.3), bx(0.03, 0.03, 0.5, 0x111827, 0, 0.01, -1.0), bx(0.06, 0.14, 0.22, 0x1f3a2a, 0, -0.02, 0.3));
      break;
  }
  return g;
}
export function weaponModel(id: WeaponId): THREE.Group {
  let t = weaponCache.get(id);
  if (!t) {
    t = buildWeapon(id);
    weaponCache.set(id, t);
  }
  return t.clone();
}

/* ---------------- humanoid ---------------- */
const SKIN = 0xf1c27d;
const PANTS = 0x1f2937;
const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.24);
legGeo.translate(0, -0.375, 0);
const canopyGeo = new THREE.SphereGeometry(3.2, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
const canopyMat = new THREE.MeshLambertMaterial({ color: 0xf97316, side: THREE.DoubleSide });
const shadowGeo = new THREE.CircleGeometry(0.6, 14);
shadowGeo.rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

export interface Human {
  root: THREE.Group; // x,z
  body: THREE.Group; // y, yaw, pose
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  holder: THREE.Group;
  canopy: THREE.Group;
  shadow: THREE.Mesh;
  weapon: THREE.Group | null;
  weaponId: WeaponId | null;
}

export function makeHuman(shirt: number): Human {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.rotation.order = 'YXZ';
  root.add(body);
  body.add(bx(0.58, 0.72, 0.32, shirt, 0, 1.2, 0), bx(0.62, 0.12, 0.34, 0x111827, 0, 0.88, 0));
  body.add(bx(0.32, 0.32, 0.32, SKIN, 0, 1.78, 0), bx(0.36, 0.14, 0.36, 0x1f2937, 0, 1.95, 0));
  const legL = new THREE.Mesh(legGeo, mat(PANTS));
  const legR = new THREE.Mesh(legGeo, mat(PANTS));
  legL.position.set(-0.16, 0.85, 0);
  legR.position.set(0.16, 0.85, 0);
  body.add(legL, legR);
  const holder = new THREE.Group();
  holder.position.set(0.3, 1.35, -0.1);
  holder.add(bx(0.13, 0.13, 0.45, shirt, 0, -0.02, -0.12));
  body.add(holder);
  // off-hand arm
  body.add(bx(0.13, 0.55, 0.13, shirt, -0.36, 1.2, 0));
  const canopy = new THREE.Group();
  const dome = new THREE.Mesh(canopyGeo, canopyMat);
  dome.position.y = 3.6;
  canopy.add(dome, bx(0.03, 3.5, 0.03, 0xeeeeee, 0, 1.9, 0));
  canopy.visible = false;
  body.add(canopy);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.04;
  root.add(shadow);
  return { root, body, legL, legR, holder, canopy, shadow, weapon: null, weaponId: null };
}

export function setHumanWeapon(h: Human, id: WeaponId) {
  if (h.weaponId === id) return;
  if (h.weapon) h.holder.remove(h.weapon);
  h.weapon = weaponModel(id);
  h.holder.add(h.weapon);
  h.weaponId = id;
}

/* ---------------- plane ---------------- */
export function makePlane(): THREE.Group {
  const g = new THREE.Group();
  g.add(bx(5, 5, 24, 0xe5e7eb, 0, 0, 0), bx(4, 3, 6, 0x38bdf8, 0, 0.6, -10), bx(34, 0.7, 6, 0xf97316, 0, -0.5, -1), bx(12, 0.6, 3.5, 0xf97316, 0, 1.2, 11), bx(0.7, 6, 4, 0xf97316, 0, 3.4, 11));
  const prop = bx(0.4, 7, 0.4, 0x111827, 0, 0, -12.4);
  g.add(prop);
  g.userData.prop = prop;
  return g;
}

/* ---------------- vehicles ---------------- */
export interface VehicleModel {
  group: THREE.Group;
  tilt: THREE.Group;
  wheels: THREE.Group[]; // spin groups
  steer: THREE.Group[]; // front steering groups
  seatY: number;
}
const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
wheelGeo.rotateZ(Math.PI / 2);
const tireMat = new THREE.MeshLambertMaterial({ color: 0x111418 });

function wheel(parent: THREE.Group, r: number, w: number, x: number, y: number, z: number, front: boolean, out: VehicleModel) {
  const steer = new THREE.Group();
  steer.position.set(x, y, z);
  const spin = new THREE.Group();
  const m = new THREE.Mesh(wheelGeo, tireMat);
  m.scale.set(w, r, r);
  const hub = new THREE.Mesh(wheelGeo, mat(0xb8c0cc));
  hub.scale.set(w + 0.02, r * 0.5, r * 0.5);
  spin.add(m, hub, bx(w + 0.03, r * 0.15, r * 1.5, 0xb8c0cc));
  steer.add(spin);
  parent.add(steer);
  out.wheels.push(spin);
  if (front) out.steer.push(steer);
}

export function makeVehicle(type: VehicleType, color: number): VehicleModel {
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  group.add(tilt);
  const out: VehicleModel = { group, tilt, wheels: [], steer: [], seatY: 1 };
  const glow = 0xfff3b0;
  if (type === 'car') {
    tilt.add(bx(2.0, 0.7, 4.3, color, 0, 0.75, 0), bx(1.7, 0.6, 2.2, 0x16212e, 0, 1.4, 0.1), bx(1.74, 0.08, 2.3, color, 0, 1.74, 0.1));
    tilt.add(bx(0.5, 0.2, 0.1, glow, -0.65, 0.85, -2.17, true), bx(0.5, 0.2, 0.1, glow, 0.65, 0.85, -2.17, true));
    tilt.add(bx(0.5, 0.18, 0.1, 0xff2a2a, -0.65, 0.9, 2.17, true), bx(0.5, 0.18, 0.1, 0xff2a2a, 0.65, 0.9, 2.17, true));
    tilt.add(bx(0.3, 0.05, 4.2, 0xffffff, 0, 1.12, 0));
    wheel(tilt, 0.46, 0.34, -1.05, 0.46, -1.4, true, out);
    wheel(tilt, 0.46, 0.34, 1.05, 0.46, -1.4, true, out);
    wheel(tilt, 0.46, 0.34, -1.05, 0.46, 1.4, false, out);
    wheel(tilt, 0.46, 0.34, 1.05, 0.46, 1.4, false, out);
    out.seatY = 0.8;
  } else if (type === 'truck') {
    tilt.add(bx(2.7, 1.9, 2.3, color, 0, 2.0, -3.0), bx(2.5, 0.8, 0.12, 0x16212e, 0, 2.55, -4.17), bx(2.9, 0.35, 8.2, 0x2a2f38, 0, 1.2, 0.3));
    tilt.add(bx(2.9, 2.3, 5.2, 0xc7ced8, 0, 2.5, 1.7), bx(2.92, 0.15, 5.22, color, 0, 3.0, 1.7));
    tilt.add(bx(0.6, 0.25, 0.1, glow, -0.9, 1.5, -4.17, true), bx(0.6, 0.25, 0.1, glow, 0.9, 1.5, -4.17, true));
    wheel(tilt, 0.68, 0.45, -1.4, 0.68, -3.0, true, out);
    wheel(tilt, 0.68, 0.45, 1.4, 0.68, -3.0, true, out);
    for (const z of [0.6, 2.4]) {
      wheel(tilt, 0.68, 0.45, -1.4, 0.68, z, false, out);
      wheel(tilt, 0.68, 0.45, 1.4, 0.68, z, false, out);
    }
    out.seatY = 1.6;
  } else {
    tilt.add(bx(0.32, 0.5, 1.5, color, 0, 0.85, 0.1), bx(0.34, 0.28, 0.6, color, 0, 1.2, -0.3), bx(0.3, 0.14, 0.7, 0x111418, 0, 1.12, 0.55));
    tilt.add(bx(0.95, 0.08, 0.08, 0x1f2937, 0, 1.4, -0.65), bx(0.08, 0.85, 0.1, 0x9ca3af, 0, 0.9, -0.82));
    tilt.add(bx(0.2, 0.15, 0.1, glow, 0, 1.25, -0.9, true));
    wheel(tilt, 0.42, 0.16, 0, 0.42, -0.9, true, out);
    wheel(tilt, 0.42, 0.18, 0, 0.42, 0.95, false, out);
    out.seatY = 0.5;
  }
  return out;
}

export function makeLootBox(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(bx(1.6, 1.2, 1.6, 0x4b5563, 0, 0.6, 0), bx(1.7, 0.15, 1.7, color, 0, 1.25, 0), bx(0.3, 1.25, 1.7, color, 0, 0.6, 0));
  return g;
}
