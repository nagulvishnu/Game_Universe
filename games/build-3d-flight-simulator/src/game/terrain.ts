import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  CITIES, CITY_CELL, cityBuilding, cityGridRange, desertAmount, forestDensity, siteDistance, terrainHeight, type City,
} from './worldData';
import { clamp, hash2, smoothstep, valueNoise } from './noise';
import { detailTexture, roadTexture, windowTextures } from './textures';

const C = {
  deep: new THREE.Color(0x0a2842), shallow: new THREE.Color(0x3bb3aa), sand: new THREE.Color(0xe0cd96), grass: new THREE.Color(0x66963f),
  grass2: new THREE.Color(0x4a7a30), forest: new THREE.Color(0x2c5a2b), desert: new THREE.Color(0xe0bb7a), desert2: new THREE.Color(0xc99b58),
  rock: new THREE.Color(0x7d776d), snow: new THREE.Color(0xf4f7fa), dirt: new THREE.Color(0x8d7d5c),
};
const tmpC = new THREE.Color();

function colorAt(wx: number, wz: number, h: number, ny: number, out: THREE.Color) {
  const n = valueNoise(wx * 0.012, wz * 0.012, 3);
  if (h < 0) {
    const t = clamp(-h / 45, 0, 1);
    out.copy(C.shallow).lerp(C.deep, Math.sqrt(t));
    return;
  }
  const slope = 1 - ny;
  const des = desertAmount(wx, wz);
  out.copy(C.grass).lerp(C.grass2, n);
  if (des > 0.02) {
    tmpC.copy(C.desert).lerp(C.desert2, n);
    out.lerp(tmpC, clamp(des * 1.4, 0, 1));
  }
  if (h < 700 && des < 0.4) {
    const f = forestDensity(wx, wz, h);
    if (f > 0.01) out.lerp(C.forest, clamp(f * 1.3, 0, 0.9));
  }
  if (h < 4) out.lerp(C.sand, 1 - smoothstep(1, 4, h));
  const rock = Math.max(smoothstep(0.16, 0.34, slope), smoothstep(900, 1500, h) * 0.8);
  if (rock > 0) out.lerp(C.rock, clamp(rock, 0, 1));
  if (h > 1500) out.lerp(C.snow, smoothstep(1500 + n * 250, 2100 + n * 250, h) * (1 - smoothstep(0.3, 0.6, slope) * 0.5));
  const v = 0.92 + valueNoise(wx * 0.07, wz * 0.07, 8) * 0.16;
  out.multiplyScalar(v);
}

interface Level {
  sp: number; N: number; snap: number; hole: number; yOff: number;
  mesh: THREE.Mesh; geo: THREE.BufferGeometry;
  gi0: number; gj0: number; inited: boolean; hArr: Float32Array; cArr: Float32Array;
}

export class TerrainSystem {
  group = new THREE.Group();
  levels: Level[] = [];
  private mat: THREE.MeshStandardMaterial;
  private cursor = 0;

  constructor() {
    const detail = detailTexture();
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, map: detail });
    const cfg = [
      { sp: 40, N: 80, snap: 160, hole: 0, yOff: 0 },
      { sp: 160, N: 96, snap: 640, hole: 880, yOff: -7 },
      { sp: 640, N: 96, snap: 2560, hole: 4800, yOff: -36 },
    ];
    for (const c of cfg) this.levels.push(this.makeLevel(c));
  }

  private makeLevel(c: { sp: number; N: number; snap: number; hole: number; yOff: number }): Level {
    const n = c.N + 1;
    const P = c.N + 3;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * n * 2), 2));
    const idx = new Uint32Array(c.N * c.N * 6);
    let k = 0;
    for (let j = 0; j < c.N; j++) {
      for (let i = 0; i < c.N; i++) {
        const a = j * n + i;
        idx[k++] = a; idx[k++] = a + n; idx[k++] = a + 1;
        idx[k++] = a + 1; idx[k++] = a + n; idx[k++] = a + n + 1;
      }
    }
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return {
      ...c, mesh, geo, gi0: 0, gj0: 0, inited: false, hArr: new Float32Array(P * P), cArr: new Float32Array(P * P * 3),
    };
  }

  /** Rebuild all levels immediately. */
  init(x: number, z: number) {
    for (const l of this.levels) this.rebuild(l, x, z);
  }

  /** Update at most one level per frame (cheap strip-based rebuild). */
  update(x: number, z: number) {
    for (let t = 0; t < this.levels.length; t++) {
      const l = this.levels[this.cursor];
      this.cursor = (this.cursor + 1) % this.levels.length;
      const gi0 = Math.round((Math.round(x / l.snap) * l.snap) / l.sp) - l.N / 2;
      const gj0 = Math.round((Math.round(z / l.snap) * l.snap) / l.sp) - l.N / 2;
      if (!l.inited || gi0 !== l.gi0 || gj0 !== l.gj0) {
        this.rebuild(l, x, z);
        return;
      }
    }
  }

  private rebuild(l: Level, x: number, z: number) {
    const { sp, N } = l;
    const n = N + 1;
    const P = N + 3;
    const gi0 = Math.round((Math.round(x / l.snap) * l.snap) / sp) - N / 2;
    const gj0 = Math.round((Math.round(z / l.snap) * l.snap) / sp) - N / 2;
    const di = gi0 - l.gi0;
    const dj = gj0 - l.gj0;
    const h2 = new Float32Array(P * P);
    const c2 = new Float32Array(P * P * 3);
    const isNew = new Uint8Array(P * P);
    for (let pj = 0; pj < P; pj++) {
      for (let pi = 0; pi < P; pi++) {
        const o = pj * P + pi;
        const oi = pi + di;
        const oj = pj + dj;
        if (l.inited && oi >= 0 && oi < P && oj >= 0 && oj < P) {
          const oo = oj * P + oi;
          h2[o] = l.hArr[oo];
          c2[o * 3] = l.cArr[oo * 3]; c2[o * 3 + 1] = l.cArr[oo * 3 + 1]; c2[o * 3 + 2] = l.cArr[oo * 3 + 2];
        } else {
          h2[o] = terrainHeight((gi0 + pi - 1) * sp, (gj0 + pj - 1) * sp);
          isNew[o] = 1;
        }
      }
    }
    for (let pj = 0; pj < P; pj++) {
      for (let pi = 0; pi < P; pi++) {
        const o = pj * P + pi;
        if (!isNew[o]) continue;
        const il = pi > 0 ? o - 1 : o;
        const ir = pi < P - 1 ? o + 1 : o;
        const iu = pj > 0 ? o - P : o;
        const id = pj < P - 1 ? o + P : o;
        const dx = (h2[il] - h2[ir]) / (2 * sp);
        const dz = (h2[iu] - h2[id]) / (2 * sp);
        const ny = 1 / Math.sqrt(dx * dx + 1 + dz * dz);
        colorAt((gi0 + pi - 1) * sp, (gj0 + pj - 1) * sp, h2[o], ny, tmpC);
        c2[o * 3] = tmpC.r; c2[o * 3 + 1] = tmpC.g; c2[o * 3 + 2] = tmpC.b;
      }
    }
    l.hArr = h2;
    l.cArr = c2;
    l.gi0 = gi0;
    l.gj0 = gj0;
    l.inited = true;

    const cx = (gi0 + N / 2) * sp;
    const cz = (gj0 + N / 2) * sp;
    const pos = l.geo.getAttribute('position') as THREE.BufferAttribute;
    const nor = l.geo.getAttribute('normal') as THREE.BufferAttribute;
    const col = l.geo.getAttribute('color') as THREE.BufferAttribute;
    const uv = l.geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const o = (j + 1) * P + (i + 1);
        const v = j * n + i;
        const lx = (i - N / 2) * sp;
        const lz = (j - N / 2) * sp;
        let h = h2[o];
        if (l.hole && Math.abs(lx) < l.hole && Math.abs(lz) < l.hole) h = -3000;
        else if (l.yOff) h += l.yOff * smoothstep(5, 60, h);
        pos.setXYZ(v, lx, h, lz);
        const dx = (h2[o - 1] - h2[o + 1]) / (2 * sp);
        const dz = (h2[o - P] - h2[o + P]) / (2 * sp);
        const il = 1 / Math.sqrt(dx * dx + 1 + dz * dz);
        nor.setXYZ(v, dx * il, il, dz * il);
        col.setXYZ(v, c2[o * 3], c2[o * 3 + 1], c2[o * 3 + 2]);
        uv.setXY(v, (gi0 + i) * sp * 0.02, (gj0 + j) * sp * 0.02);
      }
    }
    pos.needsUpdate = nor.needsUpdate = col.needsUpdate = uv.needsUpdate = true;
    l.mesh.position.set(cx, 0, cz);
  }
}

/* ------------------------------------------------------------------ */
/* Trees                                                               */
/* ------------------------------------------------------------------ */
export class TreeSystem {
  mesh: THREE.InstancedMesh;
  private cap = 7600;
  private cx = 1e9;
  private cz = 1e9;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  constructor() {
    const trunk = new THREE.CylinderGeometry(0.3, 0.5, 3, 5);
    trunk.translate(0, 1.5, 0);
    const c1 = new THREE.ConeGeometry(2.7, 6, 6);
    c1.translate(0, 5.2, 0);
    const c2 = new THREE.ConeGeometry(2.0, 5, 6);
    c2.translate(0, 8.3, 0);
    const paint = (g: THREE.BufferGeometry, c: number) => {
      const col = new THREE.Color(c);
      const arr = new Float32Array(g.getAttribute('position').count * 3);
      for (let i = 0; i < arr.length; i += 3) { arr[i] = col.r; arr[i + 1] = col.g; arr[i + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      g.deleteAttribute('uv');
    };
    paint(trunk, 0x5a3f27);
    paint(c1, 0x3f7a3a);
    paint(c2, 0x4e8f43);
    const geo = mergeGeometries([trunk, c1, c2])!;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
  }

  update(px: number, pz: number, alt: number) {
    if (alt > 1500) { this.mesh.count = 0; return; }
    const cs = 400;
    const cx = Math.floor(px / cs);
    const cz = Math.floor(pz / cs);
    if (cx === this.cx && cz === this.cz) return;
    this.cx = cx;
    this.cz = cz;
    this.rebuild(cx, cz, cs);
  }

  private rebuild(cx: number, cz: number, cs: number) {
    const R = 6;
    let k = 0;
    const d = this.dummy;
    const per = 26;
    for (let j = cz - R; j <= cz + R && k < this.cap; j++) {
      for (let i = cx - R; i <= cx + R && k < this.cap; i++) {
        // quick density probe at cell centre
        const mx = (i + 0.5) * cs;
        const mz = (j + 0.5) * cs;
        const probe = forestDensity(mx, mz, Math.max(terrainHeight(mx, mz), 0));
        if (probe < 0.02 && hash2(i, j, 5) > 0.15) continue;
        for (let t = 0; t < per && k < this.cap; t++) {
          const x = (i + hash2(i * 31 + t, j, 11)) * cs;
          const z = (j + hash2(i, j * 17 + t, 12)) * cs;
          const h = terrainHeight(x, z);
          const dens = forestDensity(x, z, h);
          if (dens * 1.15 < hash2(t * 7 + i, j * 3 + t, 13)) continue;
          if (siteDistance(x, z) < 120) continue;
          const s = 0.8 + hash2(i + t, j - t, 14) * 0.9;
          d.position.set(x, h - 0.3, z);
          d.rotation.set(0, hash2(t, i + j, 15) * 6.28, 0);
          d.scale.set(s, s * (0.9 + hash2(t, j, 16) * 0.5), s);
          d.updateMatrix();
          this.mesh.setMatrixAt(k, d.matrix);
          this.color.setHSL(0.27 + hash2(i, t, 17) * 0.08, 0.35 + hash2(j, t, 18) * 0.2, 0.55 + hash2(t, t, 19) * 0.35);
          this.mesh.setColorAt(k, this.color);
          k++;
        }
      }
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* Cities                                                              */
/* ------------------------------------------------------------------ */
const HOUSE_COLORS = [0xe8d8c0, 0xd9b99b, 0xc9d2d8, 0xe6c8c0, 0xcfd9c0];

function pushBox(
  pos: number[], nor: number[], uv: number[], col: number[], idx: number[],
  cx: number, cy: number, cz: number, w: number, h: number, d: number, color: THREE.Color,
) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y0 = cy, y1 = cy + h;
  const uw = 28, vh = 30;
  const faces: { v: number[][]; n: number[]; u: number; vv: number }[] = [
    { v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], n: [0, 0, 1], u: w / uw, vv: h / vh },
    { v: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], n: [0, 0, -1], u: w / uw, vv: h / vh },
    { v: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], n: [1, 0, 0], u: d / uw, vv: h / vh },
    { v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], n: [-1, 0, 0], u: d / uw, vv: h / vh },
    { v: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], n: [0, 1, 0], u: 0.01, vv: 0.01 },
  ];
  for (const f of faces) {
    const base = pos.length / 3;
    const uvs = [[0, 0], [f.u, 0], [f.u, f.vv], [0, f.vv]];
    for (let i = 0; i < 4; i++) {
      pos.push(f.v[i][0], f.v[i][1], f.v[i][2]);
      nor.push(f.n[0], f.n[1], f.n[2]);
      uv.push(uvs[i][0] + 0.003, uvs[i][1] + 0.003);
      const roof = f.n[1] === 1 ? 0.75 : 1;
      col.push(color.r * roof, color.g * roof, color.b * roof);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

export interface CityMesh { group: THREE.Group; windows: THREE.MeshStandardMaterial }

export function buildCity(c: City): CityMesh {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const n = cityGridRange(c);
  const color = new THREE.Color();
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const b = cityBuilding(c, i, j);
      if (!b) continue;
      if (c.tall) color.setHSL(0.58 + b.shade * 0.08, 0.08 + b.shade * 0.1, 0.45 + b.shade * 0.3);
      else color.set(HOUSE_COLORS[Math.floor(b.shade * 5) % 5]);
      pushBox(pos, nor, uv, col, idx, b.x, c.elev, b.z, b.w, b.h, b.d, color);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const w = windowTextures();
  const mat = new THREE.MeshStandardMaterial({
    map: w.map, emissiveMap: w.emissive, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0, vertexColors: true, roughness: 0.75, metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  // ground with roads
  const rt = roadTexture().clone();
  rt.needsUpdate = true;
  rt.repeat.set((2 * c.r) / 280, (2 * c.r) / 280);
  const off = 0.125 - (35 + c.r) / 280;
  rt.offset.set(off, off);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(c.r + 40, 56).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: rt, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  // fix UV scale for circle radius +40
  const ruv = ground.geometry.getAttribute('uv') as THREE.BufferAttribute;
  const k = (c.r + 40) / c.r;
  for (let i = 0; i < ruv.count; i++) ruv.setXY(i, 0.5 + (ruv.getX(i) - 0.5) * k, 0.5 + (ruv.getY(i) - 0.5) * k);
  ground.position.set(c.x, c.elev + 0.25, c.z);
  ground.receiveShadow = true;
  group.add(ground);
  void CITY_CELL;
  void CITIES;
  return { group, windows: mat };
}
