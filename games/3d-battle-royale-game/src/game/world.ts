import * as THREE from 'three';
import { BOX } from './models';
import type { Biome } from './data';

export interface Box { x0: number; z0: number; x1: number; z1: number; h: number }
export interface Circ { x: number; z: number; r: number; h: number }
export interface Building {
  x0: number; z0: number; x1: number; z1: number;
  inX: number; inZ: number; outX: number; outZ: number;
}
export interface LootSpot { x: number; z: number; b: number }

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rayCyl(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cz: number, r: number, y0: number, y1: number, maxT: number): number {
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return Infinity;
  const fx = ox - cx, fz = oz - cz;
  const b = fx * dx + fz * dz;
  const c = fx * fx + fz * fz - r * r;
  let t: number;
  if (c <= 0) {
    // origin inside the cylinder footprint
    t = 0;
  } else {
    const disc = b * b - a * c;
    if (disc < 0) return Infinity;
    t = (-b - Math.sqrt(disc)) / a;
    if (t < 0) return Infinity;
  }
  if (t > maxT) return Infinity;
  const y = oy + dy * t;
  if (y < y0 || y > y1) return Infinity;
  return t;
}

function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b: Box): number {
  let tmin = 0;
  let tmax = 1e9;
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  const lo = [b.x0, 0, b.z0];
  const hi = [b.x1, b.h, b.z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return Infinity;
    } else {
      let t1 = (lo[i] - o[i]) / d[i];
      let t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

interface Inst { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; c: number }

function instanced(geo: THREE.BufferGeometry, material: THREE.Material, list: Inst[]): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  m.userData.own = true;
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  list.forEach((it, i) => {
    d.position.set(it.x, it.y, it.z);
    d.scale.set(it.sx, it.sy, it.sz);
    d.rotation.set(0, it.ry, 0);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
    m.setColorAt(i, col.set(it.c));
  });
  m.count = list.length;
  m.frustumCulled = false;
  return m;
}

export class World {
  half: number;
  biome: Biome;
  group = new THREE.Group();
  boxes: Box[] = [];
  circs: Circ[] = [];
  buildings: Building[] = [];
  spots: LootSpot[] = [];
  towns: { x: number; z: number; r: number }[] = [];
  private cell = 16;
  private grid = new Map<number, { b: number[]; c: number[] }>();
  private rnd: () => number;

  constructor(half: number, townCount: number, seed: number, biome: Biome = 'green') {
    this.half = half;
    this.biome = biome;
    this.rnd = mulberry(seed);
    this.buildGround();
    this.buildTowns(townCount);
    this.buildNature();
    this.buildMountains();
    this.buildRoads();
    this.buildSpots();
  }

  private R(a: number, b: number) {
    return a + (b - a) * this.rnd();
  }

  private key(ix: number, iz: number) {
    return ix * 512 + iz;
  }
  private cellOf(v: number) {
    return Math.max(0, Math.floor((v + this.half + 30) / this.cell));
  }
  private reg(x0: number, z0: number, x1: number, z1: number, kind: 'b' | 'c', idx: number) {
    for (let ix = this.cellOf(x0); ix <= this.cellOf(x1); ix++) {
      for (let iz = this.cellOf(z0); iz <= this.cellOf(z1); iz++) {
        const k = this.key(ix, iz);
        let e = this.grid.get(k);
        if (!e) { e = { b: [], c: [] }; this.grid.set(k, e); }
        e[kind].push(idx);
      }
    }
  }
  addBox(x0: number, z0: number, x1: number, z1: number, h: number) {
    this.boxes.push({ x0, z0, x1, z1, h });
    this.reg(x0, z0, x1, z1, 'b', this.boxes.length - 1);
  }
  addCirc(x: number, z: number, r: number, h: number) {
    this.circs.push({ x, z, r, h });
    this.reg(x - r, z - r, x + r, z + r, 'c', this.circs.length - 1);
  }

  private buildGround() {
    const size = this.half * 2 + 900;
    const GROUND: Record<Biome, { base: string; lo: number[]; hi: number[] }> = {
      green: { base: '#4f8a3b', lo: [40, 110, 30], hi: [80, 170, 60] },
      desert: { base: '#cfae74', lo: [170, 140, 90], hi: [225, 195, 135] },
      snow: { base: '#dde6ee', lo: [205, 218, 232], hi: [240, 246, 252] },
      tropical: { base: '#54a049', lo: [45, 130, 55], hi: [95, 185, 80] },
      volcanic: { base: '#3c352f', lo: [45, 38, 34], hi: [95, 78, 66] },
    };
    const gcol = GROUND[this.biome];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d')!;
    c.fillStyle = gcol.base;
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const t = Math.random();
      const r = Math.floor(gcol.lo[0] + (gcol.hi[0] - gcol.lo[0]) * t);
      const gg = Math.floor(gcol.lo[1] + (gcol.hi[1] - gcol.lo[1]) * t);
      const b = Math.floor(gcol.lo[2] + (gcol.hi[2] - gcol.lo[2]) * t);
      c.fillStyle = `rgba(${r},${gg},${b},0.35)`;
      c.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    if (this.biome === 'snow') {
      for (let i = 0; i < 120; i++) {
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.beginPath();
        c.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 0, 7);
        c.fill();
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(size / 28, size / 28);
    tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
    g.userData.own = true;
    this.group.add(g);
  }

  private buildTowns(count: number) {
    const h = this.half;
    const minD = h * 0.62;
    for (let tries = 0; tries < 400 && this.towns.length < count; tries++) {
      const x = this.R(-h + 70, h - 70);
      const z = this.R(-h + 70, h - 70);
      const r = this.R(28, 38) * Math.min(1, h / 250 + 0.25);
      let ok = true;
      for (const t of this.towns) if (Math.hypot(t.x - x, t.z - z) < minD) ok = false;
      if (ok) this.towns.push({ x, z, r });
    }
    const walls: Inst[] = [];
    const crates: Inst[] = [];
    const PALETTES: Record<Biome, number[]> = {
      green: [0xd6c7a1, 0xc9b79c, 0xb9c4cf, 0xe0d4c0, 0xcaa98a, 0xa7b8a0, 0xd8b4a0],
      desert: [0xd8b98a, 0xc9a06a, 0xe2c9a0, 0xba8f5f, 0xd9c29a, 0xc4a37a],
      snow: [0xe8eef5, 0xd8dfe8, 0xc4ccd8, 0xb8c4d2, 0xdde4ee, 0xafbccc],
      tropical: [0xe0d4c0, 0xa7c4a0, 0xd8b4a0, 0xf0e0c0, 0xc9d8b0, 0xdeb89a],
      volcanic: [0x4a4440, 0x57504a, 0x6b625c, 0x3f3a36, 0x5c524a, 0x6e615a],
    };
    const palette = PALETTES[this.biome];
    const t = 0.45;
    const WH = 3.4;
    const wall = (x0: number, z0: number, x1: number, z1: number, c: number) => {
      if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
      this.addBox(x0, z0, x1, z1, WH);
      walls.push({ x: (x0 + x1) / 2, y: WH / 2, z: (z0 + z1) / 2, sx: x1 - x0, sy: WH, sz: z1 - z0, ry: 0, c });
    };
    for (const town of this.towns) {
      const n = Math.floor(this.R(5, 8.99) * Math.min(1, h / 250 + 0.4));
      const placed: Building[] = [];
      for (let k = 0; k < n; k++) {
        for (let tries = 0; tries < 40; tries++) {
          const w = this.R(8, 14);
          const d = this.R(8, 13);
          const a = this.rnd() * Math.PI * 2;
          const rr = Math.sqrt(this.rnd()) * town.r;
          const cx = town.x + Math.cos(a) * rr;
          const cz = town.z + Math.sin(a) * rr;
          const b: Building = { x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, inX: 0, inZ: 0, outX: 0, outZ: 0 };
          let ok = Math.abs(cx) < h - 25 && Math.abs(cz) < h - 25;
          for (const o of placed) {
            if (b.x0 - 5 < o.x1 && b.x1 + 5 > o.x0 && b.z0 - 5 < o.z1 && b.z1 + 5 > o.z0) ok = false;
          }
          if (!ok) continue;
          // door
          const side = Math.floor(this.rnd() * 4);
          const col = palette[Math.floor(this.rnd() * palette.length)];
          const dw = 1.7;
          const along = (a0: number, a1: number) => this.R(a0 + 2.5, a1 - 2.5);
          let dc = 0;
          if (side < 2) dc = along(b.x0, b.x1); else dc = along(b.z0, b.z1);
          // north (z0) & south (z1) walls
          for (let s = 0; s < 2; s++) {
            const zz0 = s === 0 ? b.z0 : b.z1 - t;
            if (side === s) {
              wall(b.x0, zz0, dc - dw, zz0 + t, col);
              wall(dc + dw, zz0, b.x1, zz0 + t, col);
            } else wall(b.x0, zz0, b.x1, zz0 + t, col);
          }
          // west (x0) & east (x1) walls
          for (let s = 0; s < 2; s++) {
            const xx0 = s === 0 ? b.x0 : b.x1 - t;
            if (side === s + 2) {
              wall(xx0, b.z0 + t, xx0 + t, dc - dw, col);
              wall(xx0, dc + dw, xx0 + t, b.z1 - t, col);
            } else wall(xx0, b.z0 + t, xx0 + t, b.z1 - t, col);
          }
          if (side === 0) { b.outX = dc; b.outZ = b.z0 - 2.2; b.inX = dc; b.inZ = b.z0 + 1.8; }
          else if (side === 1) { b.outX = dc; b.outZ = b.z1 + 2.2; b.inX = dc; b.inZ = b.z1 - 1.8; }
          else if (side === 2) { b.outX = b.x0 - 2.2; b.outZ = dc; b.inX = b.x0 + 1.8; b.inZ = dc; }
          else { b.outX = b.x1 + 2.2; b.outZ = dc; b.inX = b.x1 - 1.8; b.inZ = dc; }
          // floor
          walls.push({ x: cx, y: 0.04, z: cz, sx: w, sy: 0.1, sz: d, ry: 0, c: 0x8d7b68 });
          // roof corner accents
          for (const [px, pz] of [[b.x0, b.z0], [b.x1 - 0.6, b.z0], [b.x0, b.z1 - 0.6], [b.x1 - 0.6, b.z1 - 0.6]]) {
            walls.push({ x: px + 0.3, y: WH + 0.2, z: pz + 0.3, sx: 0.7, sy: 0.5, sz: 0.7, ry: 0, c: 0x6b7280 });
          }
          // crates inside
          const nc = 1 + Math.floor(this.rnd() * 2);
          for (let q = 0; q < nc; q++) {
            const cs = this.R(1.0, 1.5);
            const kx = this.rnd() < 0.5 ? b.x0 + 1.2 + cs / 2 : b.x1 - 1.2 - cs / 2;
            const kz = this.rnd() < 0.5 ? b.z0 + 1.2 + cs / 2 : b.z1 - 1.2 - cs / 2;
            this.addBox(kx - cs / 2, kz - cs / 2, kx + cs / 2, kz + cs / 2, cs);
            crates.push({ x: kx, y: cs / 2, z: kz, sx: cs, sy: cs, sz: cs, ry: 0, c: 0x9a6b3a });
          }
          this.buildings.push(b);
          placed.push(b);
          break;
        }
      }
    }
    // scattered crates outside
    for (let i = 0; i < Math.floor(h / 5); i++) {
      const x = this.R(-h + 15, h - 15), z = this.R(-h + 15, h - 15);
      if (this.buildingAt(x, z, 4) >= 0) continue;
      const cs = this.R(1.0, 1.8);
      this.addBox(x - cs / 2, z - cs / 2, x + cs / 2, z + cs / 2, cs);
      crates.push({ x, y: cs / 2, z, sx: cs, sy: cs, sz: cs, ry: 0, c: this.rnd() < 0.5 ? 0x9a6b3a : 0x4b6f44 });
    }
    this.group.add(instanced(BOX, new THREE.MeshLambertMaterial({ color: 0xffffff }), walls));
    this.group.add(instanced(BOX, new THREE.MeshLambertMaterial({ color: 0xffffff }), crates));
  }

  private buildNature() {
    const h = this.half;
    const trunks: Inst[] = [];
    const crA: Inst[] = [];
    const crB: Inst[] = [];
    const greens = [0x2f7d32, 0x3a8f3e, 0x2a6f3a, 0x4a9a3c, 0x23623a];
    const treeMul = this.biome === 'desert' ? 0.35 : this.biome === 'volcanic' ? 0.6 : 1;
    const nTrees = Math.floor(h * h * 0.0042 * treeMul);
    const bi = this.biome;
    for (let i = 0; i < nTrees; i++) {
      const x = this.R(-h + 4, h - 4), z = this.R(-h + 4, h - 4);
      let near = false;
      for (const t of this.towns) if (Math.hypot(t.x - x, t.z - z) < t.r + 12) near = true;
      if (near) continue;
      const s = this.R(0.8, 1.5);
      const c = greens[Math.floor(this.rnd() * greens.length)];
      if (bi === 'desert') {
        // cacti
        const ch = this.R(1.6, 3.4);
        trunks.push({ x, y: 0, z, sx: 0.9 * s, sy: ch, sz: 0.9 * s, ry: this.rnd() * 3, c: 0x4f7a45 });
        if (this.rnd() < 0.6) {
          const ax = this.rnd() < 0.5 ? 0.7 : -0.7;
          trunks.push({ x: x + ax * s, y: ch * 0.45, z, sx: 0.7 * s, sy: 0.55 * s, sz: 0.55 * s, ry: 0, c: 0x4f7a45 });
          trunks.push({ x: x + ax * 1.15 * s, y: ch * 0.45 + 0.5 * s, z, sx: 0.5 * s, sy: 1.0 * s, sz: 0.5 * s, ry: 0, c: 0x4f7a45 });
        }
        this.addCirc(x, z, 0.6 * s, 5);
      } else if (bi === 'volcanic') {
        // dead trees
        trunks.push({ x, y: 0, z, sx: 0.5 * s, sy: this.R(2.4, 3.8) * s, sz: 0.5 * s, ry: this.rnd() * 3, c: 0x35302c });
        crA.push({ x, y: 2.1 * s, z, sx: 0.22 * s, sy: 0.22 * s, sz: 1.7 * s, ry: this.rnd() * 3, c: 0x35302c });
        if (this.rnd() < 0.5) crB.push({ x, y: 2.7 * s, z, sx: 0.2 * s, sy: 0.2 * s, sz: 1.3 * s, ry: this.rnd() * 3, c: 0x3d3833 });
        this.addCirc(x, z, 0.5 * s, 7);
      } else if (bi === 'tropical') {
        // palms
        const th = this.R(3.2, 5.2) * s;
        trunks.push({ x, y: 0, z, sx: 0.5 * s, sy: th, sz: 0.5 * s, ry: this.rnd() * 3, c: 0x8a6a42 });
        crA.push({ x, y: th, z, sx: 3.0 * s, sy: 0.9 * s, sz: 3.0 * s, ry: this.rnd() * 3, c: 0x2f8f45 });
        crB.push({ x, y: th + 0.7 * s, z, sx: 1.9 * s, sy: 0.7 * s, sz: 1.9 * s, ry: this.rnd() * 3, c: 0x3fae58 });
        this.addCirc(x, z, 0.5 * s, 9);
      } else if (bi === 'snow') {
        // snow-dusted pines
        trunks.push({ x, y: 0, z, sx: 0.55 * s, sy: 3 * s, sz: 0.55 * s, ry: 0, c: 0x5c4530 });
        crA.push({ x, y: 2.2 * s, z, sx: 2.3 * s, sy: 3.6 * s, sz: 2.3 * s, ry: this.rnd() * 3, c: 0x2b5f42 });
        crB.push({ x, y: 4.6 * s, z, sx: 1.7 * s, sy: 3 * s, sz: 1.7 * s, ry: this.rnd() * 3, c: 0x25523a });
        crB.push({ x, y: 5.6 * s, z, sx: 1.1 * s, sy: 1.1 * s, sz: 1.1 * s, ry: this.rnd() * 3, c: 0xf2f7fb });
        this.addCirc(x, z, 0.55 * s, 9);
      } else {
        trunks.push({ x, y: 0, z, sx: 0.55 * s, sy: 3 * s, sz: 0.55 * s, ry: 0, c: 0x6b4423 });
        crA.push({ x, y: 2.2 * s, z, sx: 2.3 * s, sy: 3.6 * s, sz: 2.3 * s, ry: this.rnd() * 3, c });
        crB.push({ x, y: 4.6 * s, z, sx: 1.7 * s, sy: 3 * s, sz: 1.7 * s, ry: this.rnd() * 3, c: greens[(Math.floor(this.rnd() * 5) + 1) % 5] });
        this.addCirc(x, z, 0.55 * s, 9);
      }
    }
    const tg = new THREE.CylinderGeometry(0.5, 0.65, 1, 6).translate(0, 0.5, 0);
    const cg = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
    const lm = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.group.add(instanced(tg, lm, trunks), instanced(cg, lm, crA), instanced(cg, lm, crB));

    const ROCKS: Record<Biome, number[]> = {
      green: [0x7b8794, 0x6b7280, 0x8a8f98],
      desert: [0xb08d57, 0xc49a6c, 0x9a7b4f],
      snow: [0xc9d4e0, 0xb4c2d2, 0xd8e2ee],
      tropical: [0x7d8a72, 0x8f9a80, 0x6e7a66],
      volcanic: [0x4a4442, 0x57504c, 0x3b3634],
    };
    const rockMul = this.biome === 'desert' ? 1.8 : this.biome === 'volcanic' ? 1.5 : 1;
    const rocks: Inst[] = [];
    const nRocks = Math.floor((h / 4) * rockMul);
    for (let i = 0; i < nRocks; i++) {
      const x = this.R(-h + 6, h - 6), z = this.R(-h + 6, h - 6);
      if (this.buildingAt(x, z, 8) >= 0) continue;
      const s = this.R(0.9, 2.6);
      const pal = ROCKS[bi];
      rocks.push({ x, y: s * 0.35, z, sx: s, sy: s * 0.75, sz: s * this.R(0.8, 1.2), ry: this.rnd() * 3, c: pal[Math.floor(this.rnd() * pal.length)] });
      this.addCirc(x, z, s * 0.85, s * 1.2);
    }
    this.group.add(instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), rocks));
  }

  private buildMountains() {
    const list: Inst[] = [];
    const MTS: Record<Biome, number[]> = {
      green: [0x5f6b7a, 0x6b7787, 0x586274, 0x7a8696],
      desert: [0xb08d57, 0xc49a6c, 0x9a7b4f, 0xd0a878],
      snow: [0xdde6f0, 0xcbd7e6, 0xeef4fb, 0xc0cddd],
      tropical: [0x6b7d5a, 0x7a8c66, 0x5d6e4e, 0x86977a],
      volcanic: [0x4a4442, 0x57504c, 0x3b3634, 0x6b5a50],
    };
    const caps: Inst[] = [];
    const pal = MTS[this.biome];
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.R(-0.05, 0.05);
      const dist = this.half * 1.22 + this.R(10, 70);
      const hh = this.R(50, 120);
      const sx = this.R(55, 95);
      list.push({ x: Math.cos(a) * dist, y: 0, z: Math.sin(a) * dist, sx, sy: hh, sz: this.R(55, 95), ry: this.rnd() * 3, c: pal[Math.floor(this.rnd() * pal.length)] });
      if (this.biome === 'snow') {
        caps.push({ x: Math.cos(a) * dist, y: hh * 0.72, z: Math.sin(a) * dist, sx: sx * 0.45, sy: hh * 0.3, sz: sx * 0.45, ry: 0, c: 0xffffff });
      } else if (this.biome === 'volcanic' && this.rnd() < 0.5) {
        caps.push({ x: Math.cos(a) * dist, y: hh * 0.9, z: Math.sin(a) * dist, sx: sx * 0.3, sy: hh * 0.14, sz: sx * 0.3, ry: 0, c: 0xff5a1f });
      }
    }
    const g = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
    this.group.add(instanced(g, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), list));
    if (caps.length) this.group.add(instanced(g, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), caps));
  }

  private buildRoads() {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const ROAD: Record<Biome, number> = { green: 0x40454e, desert: 0x8f7a58, snow: 0x6f7885, tropical: 0x4a4f52, volcanic: 0x2b2724 };
    const m = new THREE.MeshLambertMaterial({ color: ROAD[this.biome] });
    const nodes = [...this.towns.map((t) => ({ x: t.x, z: t.z })), { x: 0, z: 0 }];
    const link = (a: { x: number; z: number }, b: { x: number; z: number }) => {
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const mesh = new THREE.Mesh(geo, m);
      mesh.scale.set(len, 1, 6);
      mesh.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2);
      mesh.rotation.y = -Math.atan2(dz, dx);
      mesh.userData.own = true;
      this.group.add(mesh);
    };
    for (let i = 0; i < nodes.length; i++) {
      // connect to nearest 1-2 others
      const sorted = nodes.map((n, j) => ({ j, d: Math.hypot(n.x - nodes[i].x, n.z - nodes[i].z) })).filter((e) => e.j > i).sort((a, b) => a.d - b.d);
      if (sorted[0]) link(nodes[i], nodes[sorted[0].j]);
    }
  }

  private buildSpots() {
    this.buildings.forEach((b, bi) => {
      const n = 3 + Math.floor(this.rnd() * 2);
      for (let i = 0; i < n; i++) {
        this.spots.push({ x: this.R(b.x0 + 1.6, b.x1 - 1.6), z: this.R(b.z0 + 1.6, b.z1 - 1.6), b: bi });
      }
    });
    const extra = Math.floor(this.half * 0.5);
    for (let i = 0; i < extra; i++) {
      const x = this.R(-this.half + 10, this.half - 10), z = this.R(-this.half + 10, this.half - 10);
      if (this.buildingAt(x, z, 1.5) >= 0) continue;
      this.spots.push({ x, z, b: -1 });
    }
  }

  buildingAt(x: number, z: number, margin = 0): number {
    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin) return i;
    }
    return -1;
  }

  /** push circle (x,z,r) out of static colliders. Returns true if moved. */
  resolve(p: { x: number; z: number }, r: number): boolean {
    let moved = false;
    for (let ix = this.cellOf(p.x - r); ix <= this.cellOf(p.x + r); ix++) {
      for (let iz = this.cellOf(p.z - r); iz <= this.cellOf(p.z + r); iz++) {
        const e = this.grid.get(this.key(ix, iz));
        if (!e) continue;
        for (const bi of e.b) {
          const b = this.boxes[bi];
          const cx = Math.max(b.x0, Math.min(p.x, b.x1));
          const cz = Math.max(b.z0, Math.min(p.z, b.z1));
          let dx = p.x - cx, dz = p.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          moved = true;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = r - d;
            p.x += (dx / d) * push;
            p.z += (dz / d) * push;
          } else {
            const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z;
            const m = Math.min(l, rr, t, bt);
            if (m === l) p.x = b.x0 - r;
            else if (m === rr) p.x = b.x1 + r;
            else if (m === t) p.z = b.z0 - r;
            else p.z = b.z1 + r;
          }
        }
        for (const ci of e.c) {
          const c = this.circs[ci];
          const dx = p.x - c.x, dz = p.z - c.z;
          const rr = r + c.r;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) continue;
          moved = true;
          const d = Math.sqrt(d2) || 0.001;
          const push = rr - d;
          p.x += (dx / d) * push;
          p.z += (dz / d) * push;
        }
      }
    }
    const lim = this.half + 15;
    if (p.x > lim) { p.x = lim; moved = true; }
    if (p.x < -lim) { p.x = -lim; moved = true; }
    if (p.z > lim) { p.z = lim; moved = true; }
    if (p.z < -lim) { p.z = -lim; moved = true; }
    return moved;
  }

  /** nearest static hit distance along the ray (unit dir). Infinity if none within maxT. */
  ray(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): number {
    let best = Infinity;
    for (const b of this.boxes) {
      // cheap reject
      const mx = (b.x0 + b.x1) / 2 - ox, mz = (b.z0 + b.z1) / 2 - oz;
      const rad = Math.hypot(b.x1 - b.x0, b.z1 - b.z0) / 2 + maxT;
      if (mx * mx + mz * mz > rad * rad) continue;
      const t = rayBox(ox, oy, oz, dx, dy, dz, b);
      if (t < best && t <= maxT) best = t;
    }
    for (const c of this.circs) {
      const mx = c.x - ox, mz = c.z - oz;
      const rad = c.r + maxT;
      if (mx * mx + mz * mz > rad * rad) continue;
      const t = rayCyl(ox, oy, oz, dx, dy, dz, c.x, c.z, c.r, 0, c.h, Math.min(best, maxT));
      if (t < best) best = t;
    }
    return best;
  }
}
