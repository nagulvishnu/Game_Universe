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
    case 'lmg':
      g.add(bx(0.08, 0.12, 0.9, 0x3f4a3a, 0, 0, -0.32), bx(0.06, 0.13, 0.28, 0x7c4a21, 0, -0.01, 0.22), bx(0.05, 0.2, 0.08, 0x111827, 0, -0.15, -0.3), bx(0.035, 0.035, 0.42, 0x1f2937, 0, 0.01, -1.05), bx(0.16, 0.1, 0.16, 0x9ca3af, 0, -0.11, -0.42), bx(0.05, 0.05, 0.16, 0x111827, 0, 0.09, -0.34));
      break;
    case 'burst':
      g.add(bx(0.065, 0.1, 0.75, 0x4b5563, 0, 0, -0.3), bx(0.05, 0.09, 0.24, 0x1f2937, 0, 0.06, 0.16), bx(0.05, 0.19, 0.08, 0x111827, 0, -0.15, -0.3), bx(0.03, 0.03, 0.3, 0x111827, 0, 0.0, -0.86), bx(0.04, 0.04, 0.1, 0x38bdf8, 0, 0.08, -0.3));
      break;
    case 'revolver':
      g.add(bx(0.05, 0.1, 0.34, 0x374151, 0, 0, -0.16), bx(0.07, 0.09, 0.12, 0x6b7280, 0, 0, -0.06), bx(0.05, 0.14, 0.08, 0x5b3a1b, 0, -0.11, 0.06), bx(0.03, 0.03, 0.2, 0x111827, 0, 0.01, -0.5));
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
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0xa06840, 0x8d5524];
const PANTS = [0x1f2937, 0x374151, 0x3a4536, 0x2b2f36];
const VESTS = [0x2a3340, 0x37424e, 0x3a4a36, 0x4a3f33, 0x303a48];
const GLOVE = 0x2b2f36;
const BOOT = 0x1a1f26;
const canopyGeo = new THREE.SphereGeometry(3.2, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
const canopyMat = new THREE.MeshLambertMaterial({ color: 0xf97316, side: THREE.DoubleSide });
const shadowGeo = new THREE.CircleGeometry(0.6, 14);
shadowGeo.rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

export interface Human {
  root: THREE.Group; // x,z
  body: THREE.Group; // y, yaw, pose
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Group;
  head: THREE.Group;
  holder: THREE.Group;
  canopy: THREE.Group;
  shadow: THREE.Mesh;
  weapon: THREE.Group | null;
  weaponId: WeaponId | null;
}

/** one arm hanging from a shoulder pivot (pad + upper + forearm + glove) */
function buildArm(shirt: number): THREE.Group {
  const g = new THREE.Group();
  g.add(
    bx(0.17, 0.12, 0.19, shirt, 0, -0.02, 0),          // shoulder pad / sleeve top
    bx(0.12, 0.26, 0.12, shirt, 0, -0.2, 0),           // upper arm
    bx(0.11, 0.24, 0.11, shirt, 0, -0.44, -0.02),      // forearm (sleeve)
    bx(0.12, 0.11, 0.13, GLOVE, 0, -0.6, -0.03),       // gloved hand
  );
  return g;
}

/** leg hanging from a hip pivot (thigh + knee pad + shin + boot) */
function buildLeg(pants: number): THREE.Group {
  const g = new THREE.Group();
  g.add(
    bx(0.2, 0.36, 0.23, pants, 0, -0.2, 0),            // thigh
    bx(0.21, 0.11, 0.24, 0x3d4653, 0, -0.42, 0),       // knee pad
    bx(0.17, 0.24, 0.19, pants, 0, -0.58, 0),          // shin
    bx(0.19, 0.13, 0.3, BOOT, 0, -0.76, -0.04),        // boot
  );
  return g;
}

/** head + face + per-variant headgear. variant -1 = player (amber cap + headset) */
function buildHead(skin: number, shirt: number, variant: number): THREE.Group {
  const g = new THREE.Group();
  g.add(
    bx(0.3, 0.33, 0.28, skin, 0, 0.17, 0),             // head
    bx(0.05, 0.05, 0.02, 0x1a2230, -0.07, 0.2, -0.145), // eye L
    bx(0.05, 0.05, 0.02, 0x1a2230, 0.07, 0.2, -0.145),  // eye R
  );
  const v = variant < 0 ? 99 : variant % 5;
  if (v === 99) {
    // player: cap + headset
    g.add(
      bx(0.32, 0.1, 0.3, 0xf59e0b, 0, 0.38, 0),
      bx(0.3, 0.04, 0.14, 0xd97706, 0, 0.34, -0.2),
      bx(0.06, 0.1, 0.06, 0x111827, -0.17, 0.22, 0),
      bx(0.06, 0.1, 0.06, 0x111827, 0.17, 0.22, 0),
    );
  } else if (v === 0) {
    // tactical cap
    g.add(
      bx(0.32, 0.1, 0.3, shirt, 0, 0.38, 0),
      bx(0.3, 0.04, 0.14, 0x1f2937, 0, 0.34, -0.2),
    );
  } else if (v === 1) {
    // helmet + mount
    g.add(
      bx(0.34, 0.18, 0.32, 0x8b939e, 0, 0.36, 0),
      bx(0.1, 0.06, 0.05, 0x374151, 0, 0.36, -0.17),
    );
  } else if (v === 2) {
    // hair
    g.add(
      bx(0.32, 0.11, 0.3, 0x2b2320, 0, 0.37, 0.01),
      bx(0.32, 0.16, 0.1, 0x2b2320, 0, 0.28, 0.13),
    );
  } else if (v === 3) {
    // beanie
    g.add(
      bx(0.32, 0.15, 0.3, 0xdc2626, 0, 0.37, 0),
      bx(0.34, 0.06, 0.32, 0xb91c1c, 0, 0.31, 0),
    );
  } else {
    // bandana + shades
    g.add(
      bx(0.32, 0.07, 0.3, 0xdc2626, 0, 0.34, 0),
      bx(0.32, 0.05, 0.06, 0xdc2626, 0, 0.31, 0.14),
      bx(0.24, 0.05, 0.02, 0x0b1220, 0, 0.2, -0.148),
    );
  }
  return g;
}

export function makeHuman(shirt: number, variant = 0): Human {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.rotation.order = 'YXZ';
  root.add(body);
  const skin = SKINS[Math.abs(variant + 3) % SKINS.length];
  const pants = PANTS[Math.abs(variant) % PANTS.length];
  const vest = VESTS[Math.abs(variant + 1) % VESTS.length];

  // torso: hips → chest → shoulders + plate carrier
  body.add(
    bx(0.5, 0.14, 0.28, pants, 0, 0.92, 0),            // hips
    bx(0.5, 0.08, 0.29, 0x111827, 0, 0.86, 0),         // belt
    bx(0.08, 0.06, 0.03, 0xfbbf24, 0, 0.86, -0.15),    // buckle
    bx(0.5, 0.44, 0.28, shirt, 0, 1.22, 0),            // chest
    bx(0.58, 0.14, 0.3, shirt, 0, 1.44, 0),            // shoulders
    bx(0.46, 0.32, 0.32, vest, 0, 1.24, -0.01),        // plate carrier
    bx(0.08, 0.3, 0.04, 0x111827, -0.14, 1.24, -0.16), // strap L
    bx(0.08, 0.3, 0.04, 0x111827, 0.14, 1.24, -0.16),  // strap R
    bx(0.34, 0.34, 0.14, vest, 0, 1.22, 0.22),         // backpack
    bx(0.36, 0.09, 0.16, 0x6b5a45, 0, 1.42, 0.22),     // bedroll
    bx(0.14, 0.08, 0.14, skin, 0, 1.54, 0),            // neck
  );

  // legs (hip pivots)
  const legL = buildLeg(pants);
  const legR = buildLeg(pants);
  legL.position.set(-0.15, 0.86, 0);
  legR.position.set(0.15, 0.86, 0);
  body.add(legL, legR);

  // arms — right holds the weapon (same pivot/behavior as before)
  const holder = buildArm(shirt);
  holder.position.set(0.34, 1.4, -0.02);
  body.add(holder);
  const armL = buildArm(shirt);
  armL.position.set(-0.34, 1.4, -0.02);
  armL.rotation.z = -0.06;
  body.add(armL);

  // head
  const head = buildHead(skin, shirt, variant);
  head.position.set(0, 1.58, 0);
  body.add(head);

  const canopy = new THREE.Group();
  const dome = new THREE.Mesh(canopyGeo, canopyMat);
  dome.position.y = 3.6;
  canopy.add(dome, bx(0.03, 3.5, 0.03, 0xeeeeee, 0, 1.9, 0));
  canopy.visible = false;
  body.add(canopy);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.04;
  root.add(shadow);
  return { root, body, legL, legR, armL, head, holder, canopy, shadow, weapon: null, weaponId: null };
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
