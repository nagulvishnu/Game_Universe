import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm, mulberry32, smooth, clamp } from "./noise";
import { Terrain, SEG, TERRAIN_SIZE, ISLAND_R, SEA, SITES, BIOMES, biomeWeights } from "./terrain";
import { RARITY_COL } from "./data";

/* ---------- helpers ---------- */
const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, o: { emissive?: number; ei?: number; rough?: number; metal?: number; flat?: boolean; opacity?: number } = {}) {
  const key = [color, o.emissive, o.ei, o.rough, o.metal, o.flat, o.opacity].join("|");
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.9, metalness: o.metal ?? 0, flatShading: o.flat ?? true,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      transparent: o.opacity !== undefined, opacity: o.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}
let _glow: THREE.CanvasTexture | null = null;
export function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (_glow = new THREE.CanvasTexture(c));
}
export function glowSprite(color: number, size: number, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}
function box(w: number, h: number, d: number, m: THREE.Material) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function cyl(rt: number, rb: number, h: number, seg: number, m: THREE.Material) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); }
function colorize(geo: THREE.BufferGeometry, hex: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute("uv");
  return g;
}
function part(geo: THREE.BufferGeometry, hex: number, x: number, y: number, z: number, rx = 0, rz = 0) {
  geo.rotateX(rx); geo.rotateZ(rz); geo.translate(x, y, z);
  return colorize(geo, hex);
}
function noiseTexture(size: number, base: number, amp: number) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const rnd = mulberry32(5);
  for (let i = 0; i < size * size; i++) {
    const v = clamp(base + (rnd() - 0.5) * amp + (rnd() - 0.5) * amp * 0.5, 0, 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* ---------- types ---------- */
export interface Collider { x: number; z: number; r: number; on: boolean }
export interface Chest { id: number; pos: THREE.Vector3; tier: number; opened: boolean; revealed: boolean; group: THREE.Group; lid: THREE.Object3D; glow: THREE.Sprite; beam: THREE.Mesh; underwater: boolean; openT: number; name: string }
export interface Portal { id: string; name: string; pos: THREE.Vector3; active: boolean; found: boolean; group: THREE.Group; mat: THREE.ShaderMaterial; halo: THREE.Sprite }
export interface Tablet { id: number; pos: THREE.Vector3; read: boolean; mesh: THREE.Group; glow: THREE.Sprite }
export interface Poi { id: string; name: string; pos: THREE.Vector3; r: number; kind: string; discovered: boolean; hidden?: boolean }
export interface Npc { id: string; name: string; pos: THREE.Vector3; group: THREE.Group; lines: string[] }
export interface Pillar { x: number; z: number; g: THREE.Group; col: Collider; fall: number; dir: number; down: boolean }
export interface Stadium {
  center: THREE.Vector3; R: number; gateAngle: number; gateClosed: boolean; gate: THREE.Group; gateY: number;
  pillars: Pillar[]; pylonSlots: THREE.Vector3[]; floorMat: THREE.MeshStandardMaterial; throne: THREE.Vector3; fires: THREE.Sprite[];
}
export interface Updraft { x: number; z: number; r: number; base: number; top: number; mesh: THREE.Mesh }

export interface CampDef { id: string; x: number; z: number; r: number; spawns: [string, number][]; elite?: string; biome: number }
export const CAMPS: CampDef[] = [
  { id: "c_start", x: 22, z: -30, r: 6, spawns: [["skitter", 3]], biome: 0 },
  { id: "c1", x: 170, z: -40, r: 12, spawns: [["skitter", 3], ["kite", 1]], biome: 0 },
  { id: "c2", x: -150, z: -30, r: 12, spawns: [["horn", 2], ["skitter", 2]], biome: 0 },
  { id: "c3", x: 250, z: 140, r: 12, spawns: [["horn", 1], ["kite", 2]], biome: 2 },
  { id: "c4", x: -60, z: 250, r: 12, spawns: [["skitter", 4], ["horn", 1]], biome: 0 },
  { id: "c5", x: 70, z: -60, r: 10, spawns: [["skitter", 2], ["kite", 1]], biome: 0 },
  { id: "c6", x: -300, z: -140, r: 14, spawns: [["horn", 2], ["kite", 2]], biome: 1 },
  { id: "c7", x: 460, z: 250, r: 14, spawns: [["skitter", 4], ["kite", 2]], biome: 2 },
  { id: "c8", x: 20, z: -330, r: 14, spawns: [["skitter", 3], ["horn", 2]], biome: 3 },
  { id: "e_waste", x: 230, z: -190, r: 8, spawns: [["skitter", 2]], elite: "colossus", biome: 0 },
  { id: "e_forest", x: -400, z: -290, r: 8, spawns: [["horn", 2]], elite: "colossus", biome: 1 },
  { id: "e_desert", x: 520, z: 60, r: 8, spawns: [["kite", 2]], elite: "colossus", biome: 2 },
  { id: "e_frost", x: -40, z: -430, r: 8, spawns: [["skitter", 3]], elite: "colossus", biome: 3 },
];

/* ---------- World ---------- */
export class World {
  terrain = new Terrain();
  root = new THREE.Group();
  colliders: Collider[] = [];
  chests: Chest[] = [];
  portals: Portal[] = [];
  tablets: Tablet[] = [];
  pois: Poi[] = [];
  npcs: Npc[] = [];
  updrafts: Updraft[] = [];
  grazerSpots: { x: number; z: number }[] = [];
  stadium!: Stadium;
  water!: THREE.Mesh;
  waterTex!: THREE.Texture;
  statics: THREE.Object3D[] = [];
  flames: { s: THREE.Sprite; b: number; ph: number }[] = [];
  crystalsMat!: THREE.MeshBasicMaterial;
  mobile: boolean;
  rnd = mulberry32(2024);
  private chestSeq = 0;
  portalMats: THREE.ShaderMaterial[] = [];

  constructor(mobile: boolean) {
    this.mobile = mobile;
    this.buildTerrainMesh();
    this.buildWater();
    this.buildScenery();
    this.buildStructures();
    this.buildChests();
  }

  /* --- queries --- */
  ground(x: number, z: number) { return this.terrain.groundAt(x, z); }
  floor(x: number, z: number, y: number) { return this.terrain.floorAt(x, z, y); }

  collide(p: THREE.Vector3, rad: number, ignoreWalls = false) {
    for (const c of this.colliders) {
      if (!c.on) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const rr = c.r + rad;
      if (dx * dx + dz * dz < rr * rr) {
        const d = Math.sqrt(dx * dx + dz * dz) || 0.001;
        p.x = c.x + (dx / d) * rr; p.z = c.z + (dz / d) * rr;
      }
    }
    const s = this.stadium;
    if (s && !ignoreWalls) {
      const dx = p.x - s.center.x, dz = p.z - s.center.z;
      const d = Math.hypot(dx, dz);
      if (d > s.R - 3.5 && d < s.R + 5 && p.y < s.center.y + 14) {
        let a = Math.atan2(dz, dx) - s.gateAngle;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (s.gateClosed || Math.abs(a) > 0.2) {
          const mid = s.R + 0.75;
          const nd = d < mid ? s.R - 3.5 - rad : s.R + 5 + rad;
          p.x = s.center.x + (dx / d) * nd; p.z = s.center.z + (dz / d) * nd;
        }
      }
    }
  }

  /* --- terrain mesh --- */
  private buildTerrainMesh() {
    const T = this.terrain, N = T.N;
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < N * N; k++) pos.setY(k, T.H[k]);
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal as THREE.BufferAttribute;
    const colors = new Float32Array(N * N * 3);
    const base = [new THREE.Color(0x8d7a64), new THREE.Color(0x3f8040), new THREE.Color(0xd6af68), new THREE.Color(0x7f8c86)];
    const alt = [new THREE.Color(0x5f5146), new THREE.Color(0x2b6636), new THREE.Color(0xbd8e4f), new THREE.Color(0x5e6b68)];
    const sand = new THREE.Color(0xd9c9a2), wet = new THREE.Color(0x55627a), rock = new THREE.Color(0x6d665f), snow = new THREE.Color(0xf1f6fb);
    const c = new THREE.Color(), tmp = new THREE.Color();
    const w = [0, 0, 0, 0];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const x = pos.getX(k), z = pos.getZ(k), h = pos.getY(k);
        biomeWeights(x, z, w);
        const n = fbm(x * 0.03, z * 0.03, 3);
        c.setRGB(0, 0, 0);
        for (let b = 0; b < 4; b++) { tmp.copy(base[b]).lerp(alt[b], smooth(0.4, 0.62, n)); c.r += tmp.r * w[b]; c.g += tmp.g * w[b]; c.b += tmp.b * w[b]; }
        const ny = nrm.getY(k);
        if (h < 3.2) c.lerp(sand, smooth(3.2, 0.8, h) * 0.9);
        if (h < 0.5) c.lerp(wet, smooth(0.5, -8, h));
        c.lerp(rock, smooth(0.86, 0.62, ny) * 0.9);
        if (h > 62) c.lerp(snow, smooth(62, 105, h) * smooth(0.45, 0.7, ny));
        const v = 0.93 + n * 0.14;
        colors[k * 3] = c.r * v; colors[k * 3 + 1] = c.g * v; colors[k * 3 + 2] = c.b * v;
      }
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const tex = noiseTexture(128, 190, 70);
    tex.repeat.set(260, 260);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: tex }));
    m.receiveShadow = true;
    m.frustumCulled = false;
    this.root.add(m);
  }

  private buildWater() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff"; g.fillRect(0, 0, 128, 128);
    const rnd = mulberry32(9);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(150,200,230,${0.08 + rnd() * 0.18})`; g.lineWidth = 1 + rnd() * 2;
      const x = rnd() * 128, y = rnd() * 128, l = 6 + rnd() * 16;
      for (const o of [-128, 0, 128]) { g.beginPath(); g.moveTo(x + o, y); g.quadraticCurveTo(x + o + l / 2, y - 3, x + o + l, y); g.stroke(); }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(150, 150);
    this.waterTex = t;
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2a86ad, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.8, map: t }));
    wm.position.y = SEA; wm.frustumCulled = false;
    this.water = wm;
    this.root.add(wm);
  }

  private nearSite(x: number, z: number, k = 1.15) {
    for (const s of SITES) if (Math.hypot(x - s.x, z - s.z) < s.r * k) return true;
    return false;
  }

  /* --- scenery --- */
  private buildScenery() {
    const T = this.terrain, rnd = this.rnd;
    const pineG = mergeGeometries([
      part(new THREE.CylinderGeometry(0.22, 0.4, 3, 5, 1, true), 0x5a3d28, 0, 1.5, 0),
      part(new THREE.ConeGeometry(2.5, 3.4, 6, 1, true), 0x2f6b3a, 0, 4, 0),
      part(new THREE.ConeGeometry(1.9, 2.9, 6, 1, true), 0x3a7a42, 0, 5.9, 0),
      part(new THREE.ConeGeometry(1.3, 2.5, 6, 1, true), 0x468a4c, 0, 7.5, 0),
    ])!;
    const leafG = mergeGeometries([
      part(new THREE.CylinderGeometry(0.3, 0.5, 4, 5, 1, true), 0x6a4a30, 0, 2, 0),
      part(new THREE.IcosahedronGeometry(2.6, 0), 0x3f8f3f, 0, 5.2, 0),
      part(new THREE.IcosahedronGeometry(1.9, 0), 0x57a548, 1.4, 4.4, 0.5),
      part(new THREE.IcosahedronGeometry(1.7, 0), 0x34803b, -1.2, 6.4, -0.4),
    ])!;
    const deadG = mergeGeometries([
      part(new THREE.CylinderGeometry(0.15, 0.4, 5, 5, 1, true), 0x4e4137, 0, 2.5, 0),
      part(new THREE.CylinderGeometry(0.08, 0.18, 2.4, 4, 1, true), 0x4e4137, 0.8, 4.6, 0, 0, -0.9),
      part(new THREE.CylinderGeometry(0.07, 0.15, 2, 4, 1, true), 0x4e4137, -0.7, 3.8, 0, 0, 1.0),
      part(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 4, 1, true), 0x4e4137, 0, 5.2, 0.5, 0.8, 0),
    ])!;
    const cactG = mergeGeometries([
      part(new THREE.CylinderGeometry(0.4, 0.45, 4, 6), 0x4f8a4a, 0, 2, 0),
      part(new THREE.CylinderGeometry(0.25, 0.28, 1.4, 5), 0x4f8a4a, 0.9, 2.4, 0, 0, 0),
      part(new THREE.CylinderGeometry(0.25, 0.25, 1.1, 5), 0x4f8a4a, 0.5, 2.0, 0, 0, Math.PI / 2),
      part(new THREE.CylinderGeometry(0.25, 0.28, 1.2, 5), 0x4f8a4a, -0.9, 2.9, 0),
      part(new THREE.CylinderGeometry(0.25, 0.25, 1.0, 5), 0x4f8a4a, -0.5, 2.5, 0, 0, Math.PI / 2),
    ])!;
    const grassG = mergeGeometries([
      part(new THREE.ConeGeometry(0.12, 0.9, 3, 1, true), 0x6f9a48, 0, 0.45, 0),
      part(new THREE.ConeGeometry(0.1, 0.7, 3, 1, true), 0x6f9a48, 0.18, 0.35, 0.05, 0, -0.2),
      part(new THREE.ConeGeometry(0.1, 0.7, 3, 1, true), 0x6f9a48, -0.16, 0.35, -0.08, 0, 0.2),
    ])!;
    const vm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide });
    const rockG = new THREE.DodecahedronGeometry(1, 0);
    const rockM = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
    const crystalG = new THREE.OctahedronGeometry(1, 0); crystalG.scale(0.35, 1.5, 0.35); crystalG.translate(0, 1.2, 0);
    this.crystalsMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 });

    type Item = { m: THREE.Matrix4; c: THREE.Color };
    const lists: Record<string, Item[]> = { pine: [], leaf: [], dead: [], cact: [], rock: [], cryst: [], grass: [] };
    const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const add = (k: string, x: number, y: number, z: number, sc: number, col: THREE.Color, sy = 1, tilt = 0) => {
      e.set((rnd() - 0.5) * tilt, rnd() * 6.28, (rnd() - 0.5) * tilt); q.setFromEuler(e);
      p.set(x, y, z); s.set(sc, sc * sy, sc);
      lists[k].push({ m: new THREE.Matrix4().compose(p, q, s), c: col });
    };
    const w = [0, 0, 0, 0];
    const gray = (v: number) => new THREE.Color(v, v, v);
    const counts = this.mobile ? 0.6 : 1;
    const R = ISLAND_R + 30;
    const tryN = 26000;
    for (let a = 0; a < tryN; a++) {
      const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R;
      const h = T.groundAt(x, z);
      if (h < 2.2) continue;
      if (this.nearSite(x, z)) continue;
      biomeWeights(x, z, w);
      const slope = T.slopeAt(x, z);
      const r = rnd();
      const dom = w.indexOf(Math.max(...w));
      if (dom === 1 && slope < 0.7 && r < 0.12 * counts + (fbm(x * 0.02, z * 0.02, 2) > 0.5 ? 0.1 : 0)) {
        if (rnd() < 0.55) add("leaf", x, h - 0.2, z, 0.8 + rnd() * 0.7, gray(0.8 + rnd() * 0.35), 1, 0.1);
        else add("pine", x, h - 0.2, z, 0.8 + rnd() * 0.9, gray(0.8 + rnd() * 0.35), 1, 0.1);
      } else if (dom === 3 && h < 85 && slope < 0.8 && r < 0.05 * counts) add("pine", x, h - 0.2, z, 0.9 + rnd() * 0.9, gray(0.9 + rnd() * 0.3), 1, 0.1);
      else if (dom === 0 && slope < 0.6 && r < 0.012 * counts) add("dead", x, h - 0.2, z, 0.8 + rnd() * 0.8, gray(0.8 + rnd() * 0.3), 1, 0.3);
      else if (dom === 2 && slope < 0.5 && r < 0.02 * counts) add("cact", x, h - 0.2, z, 0.8 + rnd() * 0.9, gray(0.85 + rnd() * 0.3), 1, 0.05);
      // rocks
      if (rnd() < (slope > 0.7 ? 0.06 : 0.03) * counts) {
        const col = [new THREE.Color(0x8a7d6f), new THREE.Color(0x70766f), new THREE.Color(0xa68e68), new THREE.Color(0x8b9199)][dom].clone().multiplyScalar(0.8 + rnd() * 0.4);
        const sc = 0.6 + Math.pow(rnd(), 3) * 4.5;
        add("rock", x, h + sc * 0.1, z, sc, col, 0.6 + rnd() * 0.5, 1.2);
        if (sc > 2.8) this.colliders.push({ x, z, r: sc * 0.8, on: true });
      }
      if (rnd() < 0.05 * counts && (dom === 0 || dom === 1 || dom === 3) && slope < 0.7 && h < 90) {
        const col = [new THREE.Color(0x58e6ff), new THREE.Color(0xb88cff), new THREE.Color(0xffc060), new THREE.Color(0x9ff0ff)][Math.floor(rnd() * 4)];
        add("cryst", x, h - 0.2, z, 0.5 + rnd() * 1.1, col, 1, 0.3);
      }
      if (slope < 0.6 && rnd() < 0.18 * counts) {
        const col = [new THREE.Color(0.55, 0.5, 0.35), new THREE.Color(0.5, 0.95, 0.45), new THREE.Color(0.9, 0.8, 0.45), new THREE.Color(0.6, 0.75, 0.65)][dom];
        add("grass", x, h - 0.05, z, 0.8 + rnd() * 1.4, col.clone().multiplyScalar(0.8 + rnd() * 0.4));
      }
      if (dom !== 2 && dom !== 3 && h > 4 && slope < 0.3 && rnd() < 0.0008) this.grazerSpots.push({ x, z });
    }
    const geos: Record<string, [THREE.BufferGeometry, THREE.Material, boolean]> = {
      pine: [pineG, vm, true], leaf: [leafG, vm, true], dead: [deadG, vm, true], cact: [cactG, vm, true],
      rock: [rockG, rockM, true], cryst: [crystalG, this.crystalsMat, false], grass: [grassG, vm, false],
    };
    for (const k in lists) {
      const L = lists[k];
      if (!L.length) continue;
      const im = new THREE.InstancedMesh(geos[k][0], geos[k][1], L.length);
      L.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c); });
      im.castShadow = geos[k][2] && !this.mobile && k !== "rock";
      im.receiveShadow = k !== "cryst" && k !== "grass";
      im.frustumCulled = false;
      im.instanceMatrix.needsUpdate = true;
      this.root.add(im);
    }
    // tree colliders are skipped intentionally: forests stay fluid to run through
  }

  /* --- structures --- */
  private stone = mat(0x8e8a80, { rough: 1 });
  private mossy = mat(0x6f7e66, { rough: 1 });
  private rune = mat(0x56e8ff, { emissive: 0x2fd6ff, ei: 1.6 });

  private pillar(x: number, z: number, h: number, g: THREE.Group, broken = false, r = 0.9) {
    const gy = this.ground(x, z);
    const m = cyl(r * 0.9, r, h, 8, this.rnd() < 0.4 ? this.mossy : this.stone);
    m.position.set(x, gy + h / 2 - 0.3, z); m.castShadow = !this.mobile; m.updateMatrix();
    g.add(m);
    const cap = box(r * 2.5, 0.5, r * 2.5, this.stone); cap.position.set(x, gy + h - 0.3, z); cap.updateMatrix();
    if (!broken) g.add(cap);
    else {
      const b = box(r * 1.4, r * 0.9, r * 2.2, this.stone);
      b.position.set(x + (this.rnd() - 0.5) * 3, gy + 0.3, z + (this.rnd() - 0.5) * 3); b.rotation.set(this.rnd() * 0.4, this.rnd() * 3, this.rnd() * 0.4); b.updateMatrix(); g.add(b);
    }
    this.colliders.push({ x, z, r: r + 0.1, on: true });
  }

  private ruinCluster(cx: number, cz: number, n: number, rad: number) {
    const g = new THREE.Group(); const rnd = this.rnd;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.3, d = rad * (0.75 + rnd() * 0.4);
      this.pillar(cx + Math.cos(a) * d, cz + Math.sin(a) * d, 3 + rnd() * 6, g, rnd() < 0.45);
    }
    // arch
    const ax = cx + rad * 0.2, az = cz - rad * 0.3, gy = this.ground(ax, az);
    const l = box(1.2, 7, 1.2, this.stone), r = box(1.2, 5, 1.2, this.stone), top = box(7.2, 1.2, 1.4, this.stone);
    l.position.set(ax - 3, gy + 3.2, az); r.position.set(ax + 3, gy + 2.2, az); top.position.set(ax - 0.3, gy + 6.4, az); top.rotation.z = 0.05;
    [l, r, top].forEach((m) => { m.castShadow = !this.mobile; m.updateMatrix(); g.add(m); });
    for (let i = 0; i < 6; i++) {
      const bx = cx + (rnd() - 0.5) * rad * 1.6, bz = cz + (rnd() - 0.5) * rad * 1.6;
      const b = box(1 + rnd() * 1.5, 0.7 + rnd(), 1 + rnd() * 1.5, rnd() < 0.5 ? this.mossy : this.stone);
      b.position.set(bx, this.ground(bx, bz) + 0.3, bz); b.rotation.set(rnd() * 0.5, rnd() * 3, rnd() * 0.5); b.updateMatrix(); g.add(b);
    }
    this.root.add(g);
  }

  private makeTablet(id: number, x: number, z: number, y?: number) {
    const g = new THREE.Group();
    const slab = box(1.5, 2.3, 0.4, mat(0x2a2f3a, { rough: 0.6, metal: 0.3 }));
    slab.position.y = 1.5; slab.castShadow = true;
    const glyph = box(0.9, 1.4, 0.05, this.rune); glyph.position.set(0, 1.6, 0.22);
    const base = cyl(1.1, 1.3, 0.4, 8, this.stone); base.position.y = 0.2;
    const glow = glowSprite(0x56e8ff, 4.5, 0.55); glow.position.y = 1.8;
    g.add(slab, glyph, base, glow);
    const gy = y ?? this.ground(x, z);
    g.position.set(x, gy, z); g.rotation.y = this.rnd() * 6;
    this.root.add(g);
    this.tablets.push({ id, pos: new THREE.Vector3(x, gy + 1.2, z), read: false, mesh: g, glow });
    this.colliders.push({ x, z, r: 0.9, on: true });
  }

  private makePortal(id: string, name: string, x: number, z: number, y?: number, face = 0) {
    const g = new THREE.Group();
    const gy = y ?? this.ground(x, z);
    const stoneM = mat(0x5e6672, { rough: 0.7, metal: 0.2 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.45, 6, 20), stoneM);
    ring.position.y = 3.9; ring.castShadow = true;
    const b1 = box(1.4, 1.2, 1.4, stoneM), b2 = box(1.4, 1.2, 1.4, stoneM);
    b1.position.set(-3.4, 0.5, 0); b2.position.set(3.4, 0.5, 0);
    const base = cyl(5.2, 5.6, 0.5, 12, this.stone); base.position.y = 0.1;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uActive: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uActive;
        void main(){ vec2 p=vUv-0.5; float r=length(p)*2.0; float a=atan(p.y,p.x);
        float s=sin(a*4.0 + r*9.0 - uTime*3.0)*0.5+0.5;
        float edge=smoothstep(1.0,0.82,r);
        vec3 col=mix(vec3(0.12,0.14,0.18), mix(vec3(0.1,0.75,1.0), vec3(0.75,0.4,1.0), s), uActive);
        float al=edge*(0.18+0.65*uActive)*(0.45+0.55*s);
        gl_FragColor=vec4(col*(0.7+s*0.9), al);} `,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.3, 28), m); disc.position.y = 3.9;
    const halo = glowSprite(0x4fd8ff, 14, 0); halo.position.y = 3.9;
    g.add(ring, b1, b2, base, disc, halo);
    g.position.set(x, gy, z); g.rotation.y = face;
    this.root.add(g);
    this.portals.push({ id, name, pos: new THREE.Vector3(x, gy + 1, z), active: false, found: false, group: g, mat: m, halo });
    this.portalMats.push(m);
    this.colliders.push({ x: x - Math.cos(face) * 3.4, z: z + Math.sin(face) * 3.4, r: 0.9, on: true }, { x: x + Math.cos(face) * 3.4, z: z - Math.sin(face) * 3.4, r: 0.9, on: true });
    this.pois.push({ id, name: "Waystone: " + name, pos: new THREE.Vector3(x, gy, z), r: 22, kind: "portal", discovered: false });
  }

  private addPoi(id: string, name: string, x: number, z: number, r: number, kind: string, hidden = false, y?: number) {
    this.pois.push({ id, name, pos: new THREE.Vector3(x, y ?? this.ground(x, z), z), r, kind, discovered: false, hidden });
  }

  private person(robe: number, hood: number, h = 1.7) {
    const g = new THREE.Group();
    const body = cyl(0.3, 0.55, h * 0.7, 8, mat(robe, { flat: false })); body.position.y = h * 0.35;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(0xe0b896, { flat: false })); head.position.y = h * 0.82;
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(hood, { flat: false })); hd.position.y = h * 0.84;
    const mark = glowSprite(0xffe08a, 1.3, 0.9); mark.position.y = h + 0.9;
    g.add(body, head, hd, mark);
    return g;
  }

  private buildStructures() {
    const T = this.terrain, rnd = this.rnd;
    // --- start crater ---
    {
      const g = new THREE.Group();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, d = 13 + rnd() * 3;
        const s = box(1.5 + rnd() * 2, 0.8 + rnd() * 1.4, 1.5 + rnd() * 2, mat(0x4a3f38, { rough: 1 }));
        s.position.set(Math.cos(a) * d, this.ground(Math.cos(a) * d, Math.sin(a) * d) + 0.4, Math.sin(a) * d);
        s.rotation.set(rnd(), rnd() * 6, rnd()); s.updateMatrix(); g.add(s);
      }
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), mat(0xff9a3c, { emissive: 0xff6a1a, ei: 1.5 }));
      shard.scale.set(0.5, 1.4, 0.5); shard.position.set(2.2, this.ground(2.2, 3) + 0.8, 3); shard.rotation.z = 0.4;
      const gl = glowSprite(0xff8a30, 6, 0.6); gl.position.copy(shard.position);
      g.add(shard, gl);
      this.root.add(g);
      this.addPoi("start", "The Ashen Crater", 0, 0, 25, "ruin");
    }
    // --- waystation ruins ---
    this.ruinCluster(70, -95, 10, 14);
    this.makeTablet(1, 70, -95);
    this.addPoi("ruins", "Waystation Ruins", 70, -95, 34, "ruin");
    // random ruins
    const rr: [number, number, number][] = [[-160, -140, 6], [310, -60, 7], [-340, -80, 8], [200, 330, 6], [-20, -240, 7], [450, 190, 6], [-250, 60, 6], [150, 260, 5]];
    rr.forEach(([x, z, n]) => this.ruinCluster(x, z, n, 9 + n));

    // --- village ---
    {
      const cx = -120, cz = 90, g = new THREE.Group();
      const wall = mat(0xa88b66, { rough: 1 }), roof = mat(0x6b4a2f, { rough: 1 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3, d = 17 + (i % 2) * 3;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, gy = this.ground(x, z);
        const hut = new THREE.Group();
        const w = cyl(2.6, 2.8, 2.6, 8, wall); w.position.y = 1.3; w.castShadow = true;
        const r = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.4, 8), roof); r.position.y = 3.7; r.castShadow = true;
        const door = box(1, 1.7, 0.2, mat(0x2d2018)); door.position.set(0, 0.9, 2.65);
        hut.add(w, r, door); hut.position.set(x, gy, z); hut.rotation.y = -a + Math.PI / 2 + Math.PI; hut.updateMatrix(); g.add(hut);
        this.colliders.push({ x, z, r: 3.2, on: true });
      }
      const fire = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.3, 5, 10), this.stone); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
      const fl = glowSprite(0xff9a40, 4.5, 0.95); fl.position.y = 1.3;
      const fl2 = glowSprite(0xffd070, 2.2, 1); fl2.position.y = 1.0;
      fire.add(ring, fl, fl2); fire.position.set(cx, this.ground(cx, cz), cz); g.add(fire);
      this.flames.push({ s: fl, b: 4.5, ph: 0 }, { s: fl2, b: 2.2, ph: 1 });
      this.colliders.push({ x: cx, z: cz, r: 1.4, on: true });
      this.root.add(g);
      const mk = (id: string, name: string, x: number, z: number, robe: number, lines: string[]) => {
        const p = this.person(robe, robe - 0x202020);
        p.position.set(x, this.ground(x, z), z); this.root.add(p);
        this.npcs.push({ id, name, pos: new THREE.Vector3(x, this.ground(x, z), z), group: p, lines });
      };
      mk("maren", "Maren", cx + 2.5, cz + 1.5, 0x8a3a3a, [
        "You walked out of the Crater alone? No one walks out of the Crater. They... stop.",
        "That glow at your heel — a Beast, bonded? Then the old stories have a face at last.",
        "East of here is Warden Stadium. The Warden stands where the gate used to be. It tests everyone who comes near.",
        "Listen: grow stronger first. Wake a Waystone — there is one beside our well — and it will remember you wherever you roam.",
        "Beast Cores are rare things. When Vesper drinks one, the world remembers what it was. Do not waste them.",
      ]);
      mk("tove", "Old Tove", cx - 6, cz - 4, 0x4a5f7a, [
        "My grandmother said the Beasts used to sing before the Tidewall rose. Now they only growl.",
        "The ruins hum louder every year. Like something stretching in its sleep.",
      ]);
      mk("pip", "Pip", cx + 8, cz - 6, 0x6a8a4a, [
        "I saw a sparkly chest by the lake! But the water is too deep for me.",
        "If you ever find a way up the Frostspine — they say there's an island that floats up there. I want a postcard.",
      ]);
      this.addPoi("village", "Dustwell Village", cx, cz, 48, "village");
    }
    this.makePortal("p_village", "Dustwell Well", -86, 56, undefined, 0.6);
    this.makePortal("p_stadium", "Stadium Approach", -205, 185, undefined, -0.8);
    this.makePortal("p_desert", "Sunscar Oasis", 396, 236, undefined, 1.2);
    this.makePortal("p_forest", "Verdant Gate", -452, -222, undefined, 0.3);
    this.makePortal("p_frost", "Frostspine Pass", 66, -395, undefined, 2.2);
    this.makeTablet(3, -214, 205);

    // --- oasis ---
    {
      const cx = 372, cz = 214, g = new THREE.Group(), gy = this.ground(cx, cz);
      const pond = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.2, 20), new THREE.MeshStandardMaterial({ color: 0x3aa7c9, roughness: 0.1, transparent: true, opacity: 0.85 }));
      pond.position.set(cx, gy + 0.05, cz); g.add(pond);
      for (let i = 0; i < 6; i++) {
        const a = i + rnd(), d = 11 + rnd() * 4, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = this.ground(x, z);
        const palm = new THREE.Group();
        const tr = cyl(0.25, 0.4, 7, 5, mat(0x7a5a3a)); tr.position.y = 3.5; tr.rotation.z = 0.12; palm.add(tr);
        for (let k = 0; k < 6; k++) {
          const lf = box(0.25, 0.06, 3.6, mat(0x3f9a45)); lf.position.set(Math.cos(k) * 1.4, 7.2, Math.sin(k) * 1.4); lf.rotation.set(0.5, -k, 0); palm.add(lf);
        }
        palm.position.set(x, y, z); g.add(palm);
      }
      this.root.add(g);
      this.makeTablet(4, cx + 4, cz - 12);
      this.addPoi("oasis", "Sunscar Oasis", cx, cz, 40, "oasis");
    }
    // --- ribcage of an ancient Beast ---
    {
      const cx = -200, cz = -110, g = new THREE.Group();
      const bone = mat(0xd8d0bd, { rough: 0.8 });
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const rib = new THREE.Mesh(new THREE.TorusGeometry(9 - Math.abs(t - 0.45) * 12, 0.7, 5, 14, Math.PI * 1.15), bone);
        rib.rotation.set(0, Math.PI / 2, Math.PI * -0.075); rib.position.set(i * 4 - 16, 0, 0); rib.castShadow = true; g.add(rib);
      }
      const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(6, 0), bone); skull.scale.set(1.5, 0.9, 1); skull.position.set(-26, 3.5, 0); skull.castShadow = true;
      const horn1 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 9, 5), bone), horn2 = horn1.clone();
      horn1.position.set(-24, 8, 4); horn1.rotation.set(0.3, 0, 0.8); horn2.position.set(-24, 8, -4); horn2.rotation.set(-0.3, 0, 0.8);
      const eye = glowSprite(0x56e8ff, 5, 0.5); eye.position.set(-30, 4, 2.5);
      g.add(skull, horn1, horn2, eye);
      const gy = this.ground(cx, cz);
      g.position.set(cx, gy - 0.5, cz); g.rotation.y = 0.4; this.root.add(g);
      this.addPoi("ribs", "Bones of the Sleeping Choir", cx - 10, cz, 42, "ruin");
      this.makeTablet(2, cx + 14, cz + 12);
      this.makeTablet(5, -340, -92);
    }

    // --- Warden Stadium ---
    this.buildStadium(-270, 250);

    // --- grottos (caves) ---
    const caves: [number, number, string][] = [[-60, -300, "Hollowfang Grotto"], [-505, -40, "Mosswept Grotto"], [505, 310, "Glassvein Grotto"]];
    caves.forEach(([x, z, name], i) => {
      const g = new THREE.Group(), gy = this.ground(x, z) - 0.4, rk = mat(0x5d5852, { rough: 1 });
      const a = rnd() * 6;
      const pieces: [number, number, number, number, number, number][] = [[-5, 0, 0, 3.6, 3.2, 3.4], [5, 0, 0, 3.8, 3.6, 3.4], [0, 0, -6, 5.5, 3.8, 3], [-2.5, 4, 0, 3, 1.4, 3.2], [2.5, 4.2, 0, 3, 1.4, 3.2], [0, 5.5, -2, 4.2, 1.4, 4.2]];
      for (const [px, py, pz, sx, sy, sz] of pieces) {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rk); r.scale.set(sx, sy, sz); r.position.set(px, py + sy * 0.5, pz); r.rotation.y = rnd() * 3; r.castShadow = true; g.add(r);
      }
      const cl = glowSprite(i === 0 ? 0x58e6ff : i === 1 ? 0xb88cff : 0xffc060, 9, 0.5); cl.position.set(0, 2.2, -2); g.add(cl);
      g.position.set(x, gy, z); g.rotation.y = a; this.root.add(g);
      this.colliders.push({ x: x + Math.cos(-a) * -5, z: z + Math.sin(-a) * 0, r: 3, on: true });
      this.addPoi("cave" + i, name, x, z, 22, "cave");
      // chest placed in front of back wall
      this.pendingChests.push([x + Math.sin(a) * -2.5, z + Math.cos(a) * -2.5, 2, name + " Cache"]);
    });

    // --- mirrorpool + sea shelf ---
    this.addPoi("lake", "Mirrorpool", 150, 120, 42, "lake");
    this.makeTablet(7, 152, 118, this.ground(152, 118));
    this.addPoi("forestlake", "Hushed Mere", -395, -60, 36, "lake");

    // --- skyglass isle (secret) ---
    {
      const pk = T.peak, top = pk.h + 14;
      const g = new THREE.Group();
      const rockM = mat(0x6f7a88, { rough: 1 }), grass = mat(0x62b06b, { rough: 1 });
      const isle = (x: number, z: number, y: number, r: number) => {
        const top1 = cyl(r, r, 0.8, 14, grass); top1.position.set(x, y - 0.4, z); top1.castShadow = true;
        const under = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.4, 10).rotateX(Math.PI), rockM); under.position.set(x, y - 0.8 - r * 0.7, z);
        g.add(top1, under);
        T.platforms.push({ x, z, r, top: y });
      };
      isle(pk.x, pk.z, top, 15);
      for (let i = 0; i < 8; i++) {
        const a = i * 0.95 + 0.5;
        isle(pk.x + Math.cos(a) * 9, pk.z + Math.sin(a) * 9, pk.h + 1.6 * (i + 1) + 0.4, 2.4);
      }
      this.ruinCluster2(g, pk.x, pk.z, top);
      const gl = glowSprite(0x9ff0ff, 30, 0.35); gl.position.set(pk.x, top + 8, pk.z); g.add(gl);
      this.root.add(g);
      this.makeTablet(8, pk.x + 4, pk.z + 3, top);
      this.makePortal("p_sky", "Skyglass Isle", pk.x - 7, pk.z - 4, top, 0.5);
      this.addPoi("sky", "Skyglass Isle", pk.x, pk.z, 24, "secret", true, top);
      this.pendingChests.push([pk.x, pk.z - 6, 4, "Skyglass Reliquary"]);
      this.makeTablet(6, 70, -392);
    }

    // --- updrafts ---
    const ud: [number, number][] = [[30, -300], [-100, -420], [90, -440], [-210, 215], [300, 0]];
    ud.forEach(([x, z]) => {
      const gy = this.ground(x, z), top = gy + 75;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.5, 75, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(x, gy + 37, z); m.frustumCulled = false;
      this.root.add(m);
      this.updrafts.push({ x, z, r: 7.5, base: gy, top, mesh: m });
    });
    this.addPoi("ud", "Wind Currents", 30, -300, 12, "wind", true);
  }

  private ruinCluster2(g: THREE.Group, cx: number, cz: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const p = cyl(0.8, 0.9, 3 + (i % 3) * 1.5, 7, this.stone);
      p.position.set(cx + Math.cos(a) * 11, y + 1.5, cz + Math.sin(a) * 11); g.add(p);
      const gl = glowSprite(0x56e8ff, 3, 0.8); gl.position.set(p.position.x, y + 4.4, p.position.z); g.add(gl);
    }
  }

  pendingChests: [number, number, number, string][] = [];
  private buildStadium(cx: number, cz: number) {
    const T = this.terrain, gy = T.groundAt(cx, cz);
    const R = 46, g = new THREE.Group();
    const gateAngle = Math.atan2(90 - cz, -120 - cx);
    const wallM = mat(0x6e6a66, { rough: 1 }), trim = mat(0x3d3b3e, { rough: 0.8, metal: 0.2 });
    const NS = 44;
    for (let i = 0; i < NS; i++) {
      const a = (i / NS) * Math.PI * 2;
      let da = a - gateAngle; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.24) continue;
      const len = (2 * Math.PI * (R + 1)) / NS + 0.6;
      const w = box(len, 13, 4.5, wallM);
      w.position.set(Math.cos(a) * (R + 1), 6.2, Math.sin(a) * (R + 1)); w.rotation.y = -a + Math.PI / 2; w.castShadow = !this.mobile; w.receiveShadow = true; w.updateMatrix();
      const cr = box(len * 0.5, 1.4, 5, trim); cr.position.set(Math.cos(a) * (R + 1), 13.4, Math.sin(a) * (R + 1)); cr.rotation.y = w.rotation.y; cr.updateMatrix();
      g.add(w, cr);
    }
    // gate
    const gate = new THREE.Group();
    const gw = 2 * Math.sin(0.25) * (R + 1);
    const door = box(gw, 12, 2, mat(0x2a2a30, { rough: 0.5, metal: 0.5 }));
    door.position.y = 6;
    const rn = box(gw * 0.7, 0.4, 2.1, this.rune); rn.position.y = 8;
    const rn2 = box(0.4, 7, 2.1, this.rune); rn2.position.y = 5;
    gate.add(door, rn, rn2);
    gate.position.set(Math.cos(gateAngle) * (R + 1), -13, Math.sin(gateAngle) * (R + 1)); gate.rotation.y = -gateAngle + Math.PI / 2;
    g.add(gate);
    for (const s of [-1, 1]) {
      const a = gateAngle + s * 0.3;
      const tw = cyl(2.6, 3, 19, 8, trim); tw.position.set(Math.cos(a) * (R + 1), 9.5, Math.sin(a) * (R + 1)); tw.castShadow = true; g.add(tw);
      const fl = glowSprite(0xff9040, 7, 0.9); fl.position.set(tw.position.x, 20.5, tw.position.z); g.add(fl);
      this.flames.push({ s: fl, b: 7, ph: s });
    }
    // floor
    const fc = document.createElement("canvas"); fc.width = fc.height = 512;
    const f = fc.getContext("2d")!;
    f.fillStyle = "#2b2a30"; f.fillRect(0, 0, 512, 512);
    f.strokeStyle = "#ffffff"; f.lineWidth = 3;
    for (const rr of [250, 220, 150, 90, 30]) { f.beginPath(); f.arc(256, 256, rr, 0, 7); f.stroke(); }
    f.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; f.beginPath(); f.moveTo(256 + Math.cos(a) * 90, 256 + Math.sin(a) * 90); f.lineTo(256 + Math.cos(a) * 220, 256 + Math.sin(a) * 220); f.stroke(); }
    f.lineWidth = 4;
    for (let k = 0; k < 2; k++) { f.beginPath(); for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.283 + k * Math.PI / 3 + 0.5; f.lineTo(256 + Math.cos(a) * 150, 256 + Math.sin(a) * 150); } f.closePath(); f.stroke(); }
    const ft = new THREE.CanvasTexture(fc);
    const floorMat = new THREE.MeshStandardMaterial({ map: ft, emissiveMap: ft, emissive: new THREE.Color(0x2fb8ff), emissiveIntensity: 0.55, roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R - 2, 64).rotateX(-Math.PI / 2), floorMat);
    floor.position.set(0, 0.12, 0); floor.receiveShadow = true; g.add(floor);
    // pillars
    const pillars: Pillar[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.26;
      const x = cx + Math.cos(a) * 29, z = cz + Math.sin(a) * 29;
      const pg = new THREE.Group();
      const body = cyl(2.1, 2.4, 16, 10, wallM); body.position.y = 8; body.castShadow = !this.mobile;
      const cap = box(6, 1, 6, trim); cap.position.y = 16.4;
      const rg = box(4.6, 0.3, 4.6, this.rune); rg.position.y = 14;
      pg.add(body, cap, rg);
      pg.position.set(x, gy, z);
      this.root.add(pg);
      const col = { x, z, r: 2.6, on: true };
      this.colliders.push(col);
      pillars.push({ x, z, g: pg, col, fall: 0, dir: a, down: false });
    }
    // throne
    const th = new THREE.Group();
    const dais = cyl(6, 7, 1.4, 10, trim); dais.position.y = 0.7;
    const back = box(5, 10, 1.2, trim); back.position.set(0, 6, 2); const sp1 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4, 4), trim); sp1.position.set(-2, 12, 2); const sp2 = sp1.clone(); sp2.position.x = 2;
    th.add(dais, back, sp1, sp2);
    const ta = gateAngle + Math.PI;
    th.position.set(Math.cos(ta) * 36, 0, Math.sin(ta) * 36); th.rotation.y = -ta - Math.PI / 2;
    g.add(th);
    const fires: THREE.Sprite[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283 + 0.4, bx = Math.cos(a) * 41, bz = Math.sin(a) * 41;
      const br = cyl(0.8, 0.5, 2.2, 6, trim); br.position.set(bx, 1.1, bz); g.add(br);
      const fl = glowSprite(0xff9a40, 4.5, 0.9); fl.position.set(bx, 3, bz); g.add(fl); fires.push(fl);
      this.flames.push({ s: fl, b: 4.5, ph: i });
    }
    g.position.set(cx, gy, cz);
    this.root.add(g);
    const slots: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283 + 0.78; slots.push(new THREE.Vector3(cx + Math.cos(a) * 22, gy, cz + Math.sin(a) * 22)); }
    this.stadium = {
      center: new THREE.Vector3(cx, gy, cz), R, gateAngle, gateClosed: false, gate, gateY: -13, pillars, pylonSlots: slots, floorMat,
      throne: new THREE.Vector3(cx + Math.cos(ta) * 30, gy, cz + Math.sin(ta) * 30), fires,
    };
    this.addPoi("stadium", "Warden Stadium", cx, cz, 70, "stadium");
  }

  /* --- chests --- */
  private buildChests() {
    const T = this.terrain, rnd = this.rnd;
    const spec: [number, number, number, string][] = [
      [-112, 102, 0, "Dustwell Stores"], [78, -88, 1, "Waystation Cache"], [-258, 235, 1, "Stadium Armory"],
      [376, 224, 1, "Oasis Offering"], [-25, 18, 0, "Crater Rim Cache"], [140, 112, 1, "Lakebed Chest"],
      [-396, -70, 1, "Mere Chest"],
    ];
    this.pendingChests.push(...spec);
    // underwater sea-shelf chests
    let tries = 0, under = 0;
    while (under < 4 && tries++ < 4000) {
      const a = rnd() * 6.283, d = 520 + rnd() * 240;
      const x = Math.cos(a) * d, z = Math.sin(a) * d, h = T.groundAt(x, z);
      if (h < -4 && h > -14) { this.pendingChests.push([x, z, 2, "Sunken Chest"]); under++; }
    }
    // random land chests
    let n = 0; tries = 0;
    while (n < 20 && tries++ < 4000) {
      const x = (rnd() * 2 - 1) * ISLAND_R, z = (rnd() * 2 - 1) * ISLAND_R;
      const h = T.groundAt(x, z);
      if (h < 4 || T.slopeAt(x, z) > 0.8 || this.nearSite(x, z)) continue;
      const b = T.biomeAt(x, z);
      this.pendingChests.push([x, z, b === 3 || h > 90 ? 2 : b === 0 ? 0 : 1, "Hidden Cache"]);
      n++;
    }
    const goldM = mat(0xd4a64a, { rough: 0.35, metal: 0.7 }), woodM = mat(0x6a4326, { rough: 0.9 });
    for (const [x, z, tier, name] of this.pendingChests) {
      const g = new THREE.Group();
      const h = T.floorAt(x, z, 1000);
      const under = h < SEA - 0.5;
      const base = box(1.3, 0.7, 0.9, woodM); base.position.y = 0.35;
      const trim = box(1.35, 0.15, 0.95, goldM); trim.position.y = 0.55;
      const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.7, -0.45);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), woodM);
      lid.position.set(0, 0, 0.45); lid.rotation.y = 0; lidPivot.add(lid);
      const band = box(0.2, 0.55, 1.0, goldM); band.position.set(0, 0.2, 0.45); lidPivot.add(band);
      const lock = box(0.18, 0.2, 0.1, mat(tier >= 3 ? 0xffb347 : 0x7ad8ff, { emissive: tier >= 3 ? 0xffa030 : 0x40c0ff, ei: 1.5 })); lock.position.set(0, 0.62, 0.95);
      const col = new THREE.Color(RARITY_COL[Math.min(4, tier + 1)]);
      const glow = glowSprite(col.getHex(), 3.2, 0.7); glow.position.y = 0.9;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.7, 60, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.y = 30; beam.visible = false;
      g.add(base, trim, lidPivot, lock, glow, beam);
      g.position.set(x, h, z); g.rotation.y = rnd() * 6.28;
      this.root.add(g);
      this.chests.push({ id: this.chestSeq++, pos: new THREE.Vector3(x, h + 0.5, z), tier, opened: false, revealed: false, group: g, lid: lidPivot, glow, beam, underwater: under, openT: 0, name });
    }
    this.pendingChests = [];
  }

  /* --- per-frame --- */
  update(t: number, camPos: THREE.Vector3) {
    this.water.position.x = Math.round(camPos.x / 40) * 40; this.water.position.z = Math.round(camPos.z / 40) * 40;
    this.waterTex.offset.set(t * 0.004 + this.water.position.x / 5000 * 150, -t * 0.003 + this.water.position.z / 5000 * 150);
    for (const m of this.portalMats) m.uniforms.uTime.value = t;
    for (const p of this.portals) {
      const target = p.active ? 1 : 0;
      p.mat.uniforms.uActive.value += (target - p.mat.uniforms.uActive.value) * 0.05;
      p.halo.material.opacity = p.mat.uniforms.uActive.value * (0.45 + Math.sin(t * 2) * 0.1);
    }
    for (const f of this.flames) { f.s.scale.setScalar(f.b * (0.88 + Math.sin(t * 11 + f.ph * 3) * 0.08 + Math.sin(t * 17 + f.ph) * 0.05)); }
    for (const c of this.chests) {
      if (c.opened) {
        c.openT = Math.min(1, c.openT + 0.04);
        c.lid.rotation.x = -c.openT * 1.9;
        c.glow.material.opacity = Math.max(0, 0.7 - c.openT);
        c.beam.visible = false;
      } else {
        c.glow.scale.setScalar(3.2 + Math.sin(t * 3 + c.id) * 0.4);
        c.beam.visible = c.revealed || c.tier >= 3;
      }
    }
    for (const tb of this.tablets) tb.glow.material.opacity = tb.read ? 0.12 : 0.45 + Math.sin(t * 2 + tb.id) * 0.15;
    this.crystalsMat.color.setHSL((t * 0.02) % 1, 0.0, 1);
    for (const u of this.updrafts) u.mesh.rotation.y = t * 0.8;
    // stadium gate + falling pillars
    const s = this.stadium;
    const tgt = s.gateClosed ? 0 : -13;
    s.gateY += (tgt - s.gateY) * 0.06;
    s.gate.position.y = s.gateY;
    for (const p of s.pillars) {
      if (p.down && p.fall < 1) {
        p.fall = Math.min(1, p.fall + 0.025);
        const e = p.fall * p.fall;
        p.g.rotation.set(0, 0, 0);
        p.g.rotateOnAxis(new THREE.Vector3(Math.sin(p.dir + Math.PI), 0, -Math.cos(p.dir + Math.PI)).normalize(), e * 1.45);
      }
    }
  }

  regionName(x: number, z: number) {
    return BIOMES[this.terrain.biomeAt(x, z)].name;
  }
}
