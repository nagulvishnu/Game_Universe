import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FLOOR_Y, type FurnitureDef } from './layout';
import { TILE, boxGeo, cylGeo, getMat } from './materials';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Collects geometry per material and merges it into a few big meshes (huge draw-call saver). */
export class Batch {
  private map = new Map<string, THREE.BufferGeometry[]>();
  add(key: string, geo: THREE.BufferGeometry) {
    let l = this.map.get(key);
    if (!l) {
      l = [];
      this.map.set(key, l);
    }
    l.push(geo);
  }
  build(parent: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [key, geos] of this.map) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, getMat(key));
      const isGlass = key === 'glass';
      mesh.castShadow = !isGlass;
      mesh.receiveShadow = !isGlass;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      out.push(mesh);
    }
    this.map.clear();
    return out;
  }
}

/** Helper for building furniture from primitives in a local frame (origin = footprint centre on the floor, front = +z). */
export class Parts {
  private base = new THREE.Matrix4();
  constructor(
    private batch: Batch,
    x: number,
    y: number,
    z: number,
    rot: number,
    private group?: THREE.Group,
  ) {
    this.base.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rot), new THREE.Vector3(1, 1, 1));
  }

  private place(geo: THREE.BufferGeometry, key: string, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    if (this.group) {
      const mesh = new THREE.Mesh(geo, getMat(key));
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    }
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1),
    );
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.base, local));
    this.batch.add(key, geo);
    return null;
  }

  /** y = bottom of box */
  box(w: number, h: number, d: number, x: number, y: number, z: number, key: string, ry = 0, rx = 0, rz = 0) {
    return this.place(boxGeo(w, h, d, TILE[key] ?? 1), key, x, y + h / 2, z, ry, rx, rz);
  }
  /** y = bottom of cylinder */
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, key: string, seg = 12) {
    return this.place(cylGeo(rt, rb, h, seg, TILE[key] ?? 1), key, x, y + h / 2, z);
  }
  /** y = centre of cylinder, with rotation */
  cylC(rt: number, rb: number, h: number, x: number, yc: number, z: number, key: string, seg = 12, rx = 0, rz = 0) {
    return this.place(cylGeo(rt, rb, h, seg, TILE[key] ?? 1), key, x, yc, z, 0, rx, rz);
  }
  /** y = centre of sphere */
  sph(r: number, x: number, y: number, z: number, key: string, sx = 1, sy = 1, sz = 1) {
    const g = new THREE.SphereGeometry(r, 14, 10);
    g.scale(sx, sy, sz);
    return this.place(g, key, x, y, z);
  }
}

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function legs(p: Parts, w: number, d: number, h: number, t: number, key: string, inset = 0.05) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(t, h, t, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), key);
}

function seat(p: Parts, w: number, d: number, h: number, key: string) {
  p.box(w, 0.3, d, 0, 0.1, 0, key);
  p.box(w - 0.46, 0.16, d * 0.72, 0, 0.4, d * 0.12, key);
  p.box(w, h - 0.3, 0.24, 0, 0.3, -d / 2 + 0.12, key);
  p.box(0.23, 0.5, d, -(w / 2 - 0.115), 0.1, 0, key);
  p.box(0.23, 0.5, d, w / 2 - 0.115, 0.1, 0, key);
  legs(p, w, d, 0.1, 0.07, 'woodB', 0.08);
}

function bookshelf(p: Parts, w: number, d: number, h: number, seed: number) {
  const r = rng(seed);
  p.box(w, h, 0.02, 0, 0, -d / 2 + 0.01, 'woodB');
  p.box(0.03, h, d, -(w / 2 - 0.015), 0, 0, 'wood');
  p.box(0.03, h, d, w / 2 - 0.015, 0, 0, 'wood');
  p.box(w, 0.04, d, 0, h - 0.04, 0, 'wood');
  const books = ['book1', 'book2', 'book3', 'book4', 'book5'];
  for (let k = 0; k < 6; k++) {
    const y = 0.04 + k * 0.4;
    p.box(w - 0.06, 0.03, d, 0, y, 0, 'wood');
    if (k === 5) continue;
    let x = -w / 2 + 0.08;
    while (x < w / 2 - 0.12) {
      if (r() < 0.12) {
        x += 0.1 + r() * 0.2;
        continue;
      }
      const bw = 0.025 + r() * 0.035;
      const bh = 0.22 + r() * 0.12;
      p.box(bw, bh, d * 0.7, x + bw / 2, y + 0.03, 0.02, books[Math.floor(r() * 5)], (r() - 0.5) * 0.06);
      x += bw + 0.004;
    }
  }
}

function shelfUnit(p: Parts, w: number, d: number, h: number, seed: number) {
  const r = rng(seed);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(0.05, h, 0.05, sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03), 'woodB');
  for (let k = 0; k < 5; k++) {
    const y = 0.04 + k * 0.44;
    p.box(w, 0.03, d, 0, y, 0, 'wood');
    if (k === 4) continue;
    let x = -w / 2 + 0.15;
    while (x < w / 2 - 0.2) {
      const t = r();
      if (t < 0.35) {
        x += 0.15 + r() * 0.25;
        continue;
      }
      if (t < 0.65) {
        p.cyl(0.05, 0.05, 0.16 + r() * 0.08, x, y + 0.03, (r() - 0.5) * 0.1, 'jar', 8);
        x += 0.14;
      } else {
        p.box(0.14, 0.1 + r() * 0.1, 0.16, x, y + 0.03, (r() - 0.5) * 0.08, 'food', r() * 0.4);
        x += 0.2;
      }
    }
  }
}

function bed(p: Parts, w: number, d: number, blanket: string) {
  const hw = w / 2 - 0.025;
  for (const sx of [-1, 1]) {
    p.box(0.05, 1.05, 0.05, sx * hw, 0, -d / 2 + 0.03, 'iron');
    p.box(0.05, 0.6, 0.05, sx * hw, 0, d / 2 - 0.03, 'iron');
    p.box(0.04, 0.07, d, sx * hw, 0.26, 0, 'iron');
  }
  p.box(w, 0.04, 0.04, 0, 0.98, -d / 2 + 0.03, 'iron');
  p.box(w, 0.04, 0.04, 0, 0.5, -d / 2 + 0.03, 'iron');
  for (let x = -w / 2 + 0.1; x < w / 2 - 0.05; x += 0.1) p.box(0.015, 0.5, 0.015, x, 0.5, -d / 2 + 0.03, 'iron');
  p.box(w, 0.04, 0.04, 0, 0.52, d / 2 - 0.03, 'iron');
  p.box(w - 0.06, 0.04, d - 0.06, 0, 0.28, 0, 'iron');
  p.box(w - 0.08, 0.18, d - 0.08, 0, 0.3, 0, 'fabC');
  p.box(w - 0.04, 0.05, d * 0.62, 0, 0.47, d * 0.17, blanket);
  p.box(w * 0.62, 0.1, 0.34, 0, 0.48, -d / 2 + 0.3, 'fabC');
}

function crate(p: Parts, w: number, h: number, d: number) {
  p.box(w, h, d, 0, 0, 0, 'woodL');
  p.box(w + 0.02, 0.05, d + 0.02, 0, 0, 0, 'wood');
  p.box(w + 0.02, 0.05, d + 0.02, 0, h - 0.05, 0, 'wood');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(0.05, h, 0.05, sx * (w / 2), 0, sz * (d / 2), 'wood');
  p.box(w * 0.9, 0.04, d + 0.02, 0, h * 0.5, 0, 'wood', 0, 0, 0);
}

/** Build one non-interactive piece of furniture into the batch. */
export function buildFurniture(f: FurnitureDef, batch: Batch, seed: number) {
  const fy = FLOOR_Y[f.floor];
  const p = new Parts(batch, f.x, fy, f.z, f.rot);
  const { w, d, h } = f;
  switch (f.kind) {
    case 'sofa':
      seat(p, w, d, h, 'fabR');
      break;
    case 'armchair':
      seat(p, w, d, h, f.floor === 0 && f.x > 13 ? 'fabBr' : 'fabG');
      break;
    case 'coffee_table':
      p.box(w, 0.05, d, 0, h - 0.05, 0, 'woodB');
      legs(p, w, d, h - 0.05, 0.05, 'wood');
      p.box(w - 0.1, 0.03, d - 0.1, 0, 0.12, 0, 'wood');
      break;
    case 'fireplace':
      p.box(w, h, d, 0, 0, 0, 'stone');
      p.box(w * 0.5, 0.62, 0.1, 0, 0.1, d / 2 - 0.02, 'black');
      p.box(w * 0.38, 0.1, 0.18, 0, 0.1, d / 2 - 0.16, 'ember');
      p.box(w + 0.2, 0.07, d + 0.14, 0, h, 0.02, 'woodB');
      p.box(w * 0.9, 0.8, 0.12, 0, h + 0.07, -d / 2 + 0.06, 'stone');
      p.box(w + 0.1, 0.1, d + 0.06, 0, 0, 0.02, 'woodB');
      break;
    case 'bookshelf':
      bookshelf(p, w, d, h, seed);
      break;
    case 'piano':
      p.box(w, h - 0.3, d, 0, 0.3, 0, 'woodB');
      p.box(w - 0.1, 0.25, d + 0.1, 0, 0.62, 0.05, 'woodB');
      p.box(w - 0.16, 0.035, 0.18, 0, 0.82, d / 2 + 0.12, 'paper');
      for (let i = 0; i < 17; i++) p.box(0.006, 0.04, 0.17, -0.6 + i * 0.075, 0.82, d / 2 + 0.12, 'black');
      for (const sx of [-1, 1]) p.box(0.08, 0.3, 0.08, sx * (w / 2 - 0.08), 0, 0.0, 'woodB');
      p.box(0.5, 0.05, 0.3, 0, 0.42, d / 2 + 0.6, 'fabR');
      p.box(0.04, 0.42, 0.04, -0.2, 0, d / 2 + 0.6, 'woodB');
      p.box(0.04, 0.42, 0.04, 0.2, 0, d / 2 + 0.6, 'woodB');
      break;
    case 'clock':
      p.box(w, h, d, 0, 0, 0, 'woodB');
      p.box(w + 0.1, 0.12, d + 0.08, 0, h - 0.12, 0, 'wood');
      p.box(w + 0.08, 0.14, d + 0.06, 0, 0, 0, 'wood');
      p.cylC(0.14, 0.14, 0.02, 0, 1.56, d / 2 + 0.005, 'paper', 20, Math.PI / 2);
      p.box(w * 0.55, 0.7, 0.02, 0, 0.35, d / 2 + 0.005, 'black');
      p.cylC(0.07, 0.07, 0.015, 0, 0.5, d / 2 + 0.012, 'brass', 14, Math.PI / 2);
      break;
    case 'counter':
      p.box(w, h - 0.04, d, 0, 0, 0, 'wood');
      p.box(w + 0.02, 0.04, d + 0.03, 0, h - 0.04, 0.005, 'stone');
      for (let x = -w / 2 + 0.5; x < w / 2; x += 0.5) p.box(0.012, h - 0.25, 0.01, x, 0.12, d / 2 + 0.005, 'black');
      for (let x = -w / 2 + 0.25; x < w / 2; x += 0.5) p.box(0.1, 0.02, 0.03, x, h - 0.2, d / 2 + 0.02, 'brass');
      if (f.id === 'sink') {
        p.box(0.7, 0.03, 0.4, 0, h, 0, 'steel');
        p.cyl(0.015, 0.015, 0.22, 0, h, -0.2, 'steel', 8);
        p.box(0.03, 0.03, 0.14, 0, h + 0.2, -0.13, 'steel');
      }
      break;
    case 'stove':
      p.box(w, h, d, 0, 0, 0, 'cream');
      p.box(w - 0.1, 0.45, 0.02, 0, 0.18, d / 2 + 0.005, 'black');
      p.box(w - 0.14, 0.03, 0.03, 0, 0.7, d / 2 + 0.03, 'steel');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(0.11, 0.11, 0.015, sx * 0.19, h, sz * 0.15, 'black', 14);
      p.box(w, 0.35, 0.06, 0, h, -d / 2 + 0.03, 'cream');
      break;
    case 'fridge':
      p.box(w, h, d, 0, 0, 0, 'white');
      p.box(w - 0.04, 0.012, 0.01, 0, h * 0.68, d / 2 + 0.004, 'black');
      p.box(0.03, 0.5, 0.04, w / 2 - 0.1, h * 0.72, d / 2 + 0.03, 'steel');
      p.box(0.03, 0.35, 0.04, w / 2 - 0.1, h * 0.25, d / 2 + 0.03, 'steel');
      break;
    case 'table':
      p.box(w, 0.05, d, 0, h - 0.05, 0, 'woodL');
      legs(p, w, d, h - 0.05, 0.07, 'woodL', 0.08);
      break;
    case 'dining_table':
      p.box(w, 0.06, d, 0, h - 0.06, 0, 'wood');
      p.box(w - 0.3, 0.1, d - 0.3, 0, h - 0.16, 0, 'wood');
      legs(p, w, d, h - 0.06, 0.1, 'woodB', 0.12);
      p.box(w * 0.5, 0.004, d * 0.9, 0, h, 0, 'fabC');
      for (const sx of [-0.4, 0.4]) {
        p.cyl(0.025, 0.03, 0.22, sx, h, 0, 'brass', 8);
        p.cyl(0.008, 0.008, 0.06, sx, h + 0.22, 0, 'paper', 6);
      }
      break;
    case 'chair':
      p.box(0.45, 0.04, 0.45, 0, 0.44, 0, 'wood');
      p.box(0.45, 0.46, 0.04, 0, 0.44, -0.205, 'wood');
      legs(p, 0.45, 0.45, 0.44, 0.04, 'woodB', 0.03);
      break;
    case 'shelf':
      shelfUnit(p, w, d, h, seed);
      break;
    case 'crate':
      crate(p, w, h, d);
      break;
    case 'barrel':
      p.cyl(0.27, 0.3, h, 0, 0, 0, 'wood', 14);
      for (const y of [0.15, 0.7]) p.cyl(0.305, 0.305, 0.03, 0, y, 0, 'metal', 14);
      break;
    case 'chest':
      p.box(w, h - 0.08, d, 0, 0, 0, 'white');
      p.box(w + 0.03, 0.08, d + 0.03, 0, h - 0.08, 0, 'steel');
      p.box(0.2, 0.03, 0.04, 0, h - 0.04, d / 2 + 0.03, 'black');
      break;
    case 'side_table':
      p.box(w, 0.04, d, 0, h - 0.04, 0, 'woodB');
      legs(p, w, d, h - 0.04, 0.04, 'wood', 0.03);
      break;
    case 'console':
      p.box(w, 0.04, d, 0, h - 0.04, 0, 'woodB');
      p.box(w - 0.06, 0.14, d - 0.04, 0, h - 0.18, 0, 'wood');
      p.box(0.1, 0.02, 0.03, 0, h - 0.12, d / 2 + 0.01, 'brass');
      legs(p, w, d, h - 0.18, 0.05, 'wood', 0.04);
      break;
    case 'coat_rack':
      p.cyl(0.18, 0.2, 0.04, 0, 0, 0, 'woodB', 12);
      p.cyl(0.025, 0.025, h, 0, 0, 0, 'woodB', 8);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        p.box(0.03, 0.03, 0.14, Math.cos(a) * 0.07, h - 0.1, Math.sin(a) * 0.07, 'woodB', -a + Math.PI / 2);
      }
      p.box(0.34, 0.55, 0.14, 0.05, 1.1, 0.12, 'black', 0.4);
      p.cyl(0.14, 0.14, 0.04, -0.06, h - 0.02, -0.1, 'black', 12);
      break;
    case 'bed':
      bed(p, w, d, f.floor === 1 && f.x > 15 ? 'fabB' : 'fabG');
      break;
    case 'bed_double':
      bed(p, w, d, 'fabR');
      break;
    case 'nightstand':
      p.box(w, h - 0.04, d, 0, 0, 0, 'wood');
      p.box(w + 0.02, 0.04, d + 0.02, 0, h - 0.04, 0, 'woodB');
      p.box(w - 0.1, 0.16, 0.015, 0, h - 0.3, d / 2 + 0.005, 'woodB');
      p.box(0.06, 0.02, 0.03, 0, h - 0.24, d / 2 + 0.02, 'brass');
      break;
    case 'dresser':
      p.box(w, h - 0.04, d, 0, 0, 0, 'wood');
      p.box(w + 0.04, 0.04, d + 0.02, 0, h - 0.04, 0, 'woodB');
      for (let i = 0; i < 3; i++) {
        p.box(w - 0.1, 0.005, 0.015, 0, 0.2 + i * 0.25, d / 2 + 0.004, 'black');
        p.box(0.1, 0.025, 0.03, -w * 0.25, 0.1 + i * 0.25 + 0.1, d / 2 + 0.02, 'brass');
        p.box(0.1, 0.025, 0.03, w * 0.25, 0.1 + i * 0.25 + 0.1, d / 2 + 0.02, 'brass');
      }
      p.box(w * 0.7 + 0.06, 0.86, 0.04, 0, h + 0.12, -d / 2 + 0.02, 'woodB');
      p.box(w * 0.7, 0.8, 0.02, 0, h + 0.15, -d / 2 + 0.045, 'mirror');
      break;
    case 'rocking_chair':
      p.box(0.5, 0.04, 0.5, 0, 0.42, 0, 'woodL');
      p.box(0.5, 0.55, 0.04, 0, 0.42, -0.23, 'woodL', 0, -0.2);
      for (const sx of [-1, 1]) {
        p.box(0.04, 0.04, 0.8, sx * 0.25, 0.06, 0, 'woodB');
        p.box(0.04, 0.4, 0.04, sx * 0.25, 0.06, 0.2, 'woodB');
        p.box(0.04, 0.4, 0.04, sx * 0.25, 0.06, -0.2, 'woodB');
        p.box(0.04, 0.04, 0.4, sx * 0.25, 0.68, 0.0, 'woodB');
      }
      break;
    case 'bathtub':
      p.box(w, h - 0.08, d, 0, 0.08, 0, 'white');
      p.box(w - 0.18, 0.06, d - 0.16, 0, h - 0.1, 0, 'water');
      p.box(w + 0.02, 0.04, d + 0.02, 0, h - 0.04, 0, 'white');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(0.04, 0.03, 0.08, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.1), 'brass', 8);
      p.cyl(0.015, 0.015, 0.2, w / 2 - 0.25, h, -d / 2 + 0.08, 'steel', 8);
      break;
    case 'toilet':
      p.cyl(0.17, 0.12, 0.38, 0, 0, 0.1, 'white', 14);
      p.box(0.4, 0.38, 0.18, 0, 0.3, -d / 2 + 0.12, 'white');
      p.cyl(0.19, 0.19, 0.03, 0, 0.4, 0.1, 'woodB', 14);
      break;
    case 'basin':
      p.cyl(0.07, 0.08, 0.7, 0, 0, 0, 'white', 10);
      p.box(w, 0.12, d, 0, 0.7, 0, 'white');
      p.cyl(0.015, 0.015, 0.1, 0, 0.82, -d / 2 + 0.06, 'steel', 6);
      p.box(0.5, 0.7, 0.03, 0, 1.2, -d / 2 + 0.015, 'mirror');
      break;
    case 'crib': {
      p.box(w, 0.05, d, 0, 0.28, 0, 'woodL');
      p.box(w - 0.06, 0.12, d - 0.06, 0, 0.33, 0, 'fabC');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(0.06, h, 0.06, sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03), 'woodL');
      for (const sx of [-1, 1]) {
        p.box(0.03, 0.04, d, sx * (w / 2 - 0.03), h - 0.04, 0, 'woodL');
        for (let z = -d / 2 + 0.1; z < d / 2 - 0.05; z += 0.09) p.box(0.015, 0.55, 0.015, sx * (w / 2 - 0.03), 0.45, z, 'woodL');
      }
      for (const sz of [-1, 1]) {
        p.box(w, 0.04, 0.03, 0, h - 0.04, sz * (d / 2 - 0.03), 'woodL');
        for (let x = -w / 2 + 0.1; x < w / 2 - 0.05; x += 0.09) p.box(0.015, 0.55, 0.015, x, 0.45, sz * (d / 2 - 0.03), 'woodL');
      }
      break;
    }
    case 'toy_chest':
      p.box(w, h - 0.1, d, 0, 0, 0, 'woodL');
      p.box(w + 0.03, 0.1, d + 0.03, 0, h - 0.1, 0, 'fabR');
      p.box(0.08, 0.05, 0.03, 0, h - 0.14, d / 2 + 0.01, 'brass');
      break;
    case 'rocking_horse':
      p.sph(0.2, 0, 0.5, 0, 'woodL', 0.8, 0.8, 1.6);
      p.sph(0.13, 0, 0.78, 0.33, 'woodL', 0.8, 1.2, 1.0);
      p.box(0.08, 0.08, 0.14, 0, 0.7, 0.5, 'woodL', 0, 0.3);
      p.box(0.05, 0.18, 0.04, 0, 0.8, 0.22, 'black');
      for (const sx of [-1, 1]) {
        p.box(0.03, 0.04, 0.9, sx * 0.14, 0.02, 0, 'woodB');
        p.box(0.03, 0.4, 0.04, sx * 0.12, 0.05, 0.2, 'woodL', 0, 0.2);
        p.box(0.03, 0.4, 0.04, sx * 0.12, 0.05, -0.2, 'woodL', 0, -0.2);
      }
      break;
    case 'desk':
      p.box(w, 0.05, d, 0, h - 0.05, 0, 'woodB');
      for (const sx of [-1, 1]) {
        p.box(0.5, h - 0.05, d - 0.06, sx * (w / 2 - 0.27), 0, 0, 'wood');
        for (let i = 0; i < 3; i++) p.box(0.1, 0.02, 0.03, sx * (w / 2 - 0.27), 0.12 + i * 0.2, d / 2 - 0.01, 'brass');
      }
      p.box(0.34, 0.004, 0.45, -0.1, h, 0.05, 'paper', 0.2);
      p.box(0.2, 0.004, 0.3, 0.2, h, 0.1, 'paper', -0.3);
      p.cyl(0.07, 0.08, 0.025, -0.45, h, -0.2, 'brass', 10);
      p.cyl(0.012, 0.012, 0.3, -0.45, h, -0.2, 'brass', 6);
      break;
    case 'office_chair':
      p.box(0.5, 0.07, 0.5, 0, 0.45, 0, 'fabBr');
      p.box(0.5, 0.55, 0.07, 0, 0.5, -0.24, 'fabBr', 0, -0.12);
      p.cyl(0.03, 0.03, 0.4, 0, 0.05, 0, 'metal', 6);
      for (let i = 0; i < 4; i++) p.box(0.04, 0.03, 0.3, 0, 0.03, 0, 'metal', (i * Math.PI) / 4);
      break;
    case 'filing':
      p.box(w, h, d, 0, 0, 0, 'metal');
      for (let i = 0; i < 4; i++) {
        p.box(w - 0.06, 0.01, 0.01, 0, 0.1 + i * 0.3, d / 2 + 0.004, 'black');
        p.box(0.14, 0.03, 0.03, 0, 0.2 + i * 0.3, d / 2 + 0.015, 'steel');
      }
      break;
    case 'sewing_table':
      p.box(w, 0.04, d, 0, h - 0.04, 0, 'woodL');
      legs(p, w, d, h - 0.04, 0.05, 'woodB', 0.05);
      p.box(0.34, 0.2, 0.14, -0.2, h, 0, 'black');
      p.box(0.2, 0.04, 0.1, -0.1, h + 0.2, 0, 'black');
      p.cyl(0.02, 0.02, 0.1, -0.3, h + 0.2, 0, 'brass', 6);
      p.cyl(0.08, 0.08, 0.03, 0.2, h, 0.1, 'fabR', 10);
      p.box(0.4, 0.002, 0.3, 0.3, h, -0.12, 'fabB', 0.3);
      break;
    case 'mannequin':
      p.cyl(0.25, 0.28, 0.04, 0, 0, 0, 'woodB', 12);
      p.cyl(0.025, 0.025, 0.95, 0, 0.04, 0, 'woodB', 6);
      p.cyl(0.12, 0.17, 0.5, 0, 0.95, 0, 'fabC', 12);
      p.cyl(0.17, 0.12, 0.2, 0, 1.4, 0, 'fabC', 12);
      p.cyl(0.04, 0.05, 0.1, 0, 1.55, 0, 'fabC', 8);
      p.sph(0.1, 0, 1.68, 0, 'fabC', 0.85, 1.1, 0.95);
      break;
    case 'rug': {
      const k = Math.floor(f.x * 3 + f.z * 7) % 3;
      const key = k === 0 ? 'rugA' : k === 1 ? 'rugB' : 'rugC';
      const g = new THREE.PlaneGeometry(w, d);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 1.6, (uv.getY(i) * d) / 1.6);
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0.012, 0);
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(f.x, fy, f.z), new THREE.Quaternion().setFromAxisAngle(Y_AXIS, f.rot), new THREE.Vector3(1, 1, 1)));
      batch.add(key, g);
      break;
    }
  }
}

export interface WardrobeRT {
  group: THREE.Group;
  doorL: THREE.Object3D;
  doorR: THREE.Object3D;
}

/** Interactive wardrobe (separate meshes so the doors can swing). */
export function buildWardrobe(f: FurnitureDef, batch: Batch): WardrobeRT {
  const group = new THREE.Group();
  group.position.set(f.x, FLOOR_Y[f.floor], f.z);
  group.rotation.y = f.rot;
  const p = new Parts(batch, 0, 0, 0, 0, group);
  const { w, d, h } = f;
  p.box(w, h, 0.03, 0, 0, -d / 2 + 0.015, 'woodB');
  p.box(0.04, h, d, -(w / 2 - 0.02), 0, 0, 'wood');
  p.box(0.04, h, d, w / 2 - 0.02, 0, 0, 'wood');
  p.box(w, 0.06, d, 0, h - 0.06, 0, 'wood');
  p.box(w - 0.08, 0.04, d - 0.04, 0, 0.12, 0, 'woodB');
  p.box(w, 0.1, d - 0.03, 0, 0, 0, 'woodB');
  p.box(w + 0.06, 0.05, d + 0.04, 0, h, 0, 'woodB');
  p.cylC(0.015, 0.015, w - 0.1, 0, 1.8, 0, 'steel', 6, 0, Math.PI / 2);
  // clothes hanging inside
  for (let i = 0; i < 7; i++) {
    const x = -w / 2 + 0.12 + i * ((w - 0.24) / 6);
    p.box(0.05, 0.9 + (i % 3) * 0.08, 0.3, x, 0.82, -0.02, i % 2 ? 'black' : 'fabBr', (i - 3) * 0.05);
  }
  const mkDoor = (side: 1 | -1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (w / 2 - 0.01), 0, d / 2 - 0.015);
    const mat = getMat('wood');
    const pw = w / 2 - 0.02;
    const panel = new THREE.Mesh(boxGeo(pw, h - 0.14, 0.035, 1), mat);
    panel.position.set(-side * (pw / 2), 0.1 + (h - 0.14) / 2, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    pivot.add(panel);
    const inset = new THREE.Mesh(boxGeo(pw - 0.16, h - 0.5, 0.01, 1), getMat('woodB'));
    inset.position.set(-side * (pw / 2), 0.1 + (h - 0.14) / 2, 0.02);
    pivot.add(inset);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), getMat('brass'));
    knob.position.set(-side * (pw - 0.06), 1.0, 0.05);
    pivot.add(knob);
    group.add(pivot);
    return pivot;
  };
  const doorL = mkDoor(-1);
  const doorR = mkDoor(1);
  return { group, doorL, doorR };
}
