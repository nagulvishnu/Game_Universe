import * as THREE from "three";
import { G, V3 } from "./core";

export const PITCH = 80;
export const MAPHALF = 300;
export const BOUND = 286;
export const ARENA = new V3(1000, 0, 0);
export const DIST_NAMES: Record<string, string> = {
  downtown: "Central Downtown",
  neon: "Neon Ward",
  res: "Sakura Heights",
  park: "Green Park",
  docks: "Iron Docks",
  abyss: "The Abyss",
  out: "Outskirts",
};

export function districtOf(x: number, z: number): string {
  if (x > 600) return "abyss";
  if (Math.abs(x) > 296 || Math.abs(z) > 296) return "out";
  const i = Math.round(x / PITCH),
    j = Math.round(z / PITCH);
  if (j >= 2 && Math.abs(i) <= 1) return "park";
  if (j <= -2 && Math.abs(i) <= 2) return "docks";
  if (i >= 2) return "neon";
  if (i <= -2) return "res";
  return "downtown";
}

/* ---------- colliders ---------- */
export interface Box {
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  dead?: boolean;
}
const CELL = 40;
const grid = new Map<number, Box[]>();
export const boxes: Box[] = [];
const gk = (cx: number, cz: number) => (cx + 200) * 1000 + (cz + 200);
export function addBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box {
  const b: Box = { x0, x1, y0, y1, z0, z1 };
  boxes.push(b);
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
    for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
      const k = gk(cx, cz);
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(b);
    }
  return b;
}
export const addCenter = (cx: number, cz: number, w: number, d: number, h: number, y = 0) =>
  addBox(cx - w / 2, y, cz - d / 2, cx + w / 2, y + h, cz + d / 2);

const tmpList: Box[] = [];
export function nearBoxes(x0: number, z0: number, x1: number, z1: number): Box[] {
  tmpList.length = 0;
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
    for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
      const a = grid.get(gk(cx, cz));
      if (a) for (const b of a) if (!b.dead && tmpList.indexOf(b) < 0) tmpList.push(b);
    }
  return tmpList;
}
export const mv = { landed: false, wall: false, ceil: false };
export function moveBody(pos: V3, r: number, h: number, mx: number, my: number, mz: number, noBox = false) {
  const prevY = pos.y;
  pos.x += mx; pos.y += my; pos.z += mz;
  mv.landed = false; mv.wall = false; mv.ceil = false;
  const lim = pos.x > 600 ? 9999 : BOUND;
  if (pos.x < 600) {
    if (pos.x > lim) { pos.x = lim; mv.wall = true; }
    if (pos.x < -lim) { pos.x = -lim; mv.wall = true; }
    if (pos.z > lim) { pos.z = lim; mv.wall = true; }
    if (pos.z < -lim) { pos.z = -lim; mv.wall = true; }
  }
  if (pos.y <= 0) { pos.y = 0; mv.landed = true; }
  if (noBox) return mv;
  for (let pass = 0; pass < 2; pass++) {
    const list = nearBoxes(pos.x - r, pos.z - r, pos.x + r, pos.z + r);
    for (let n = 0; n < list.length; n++) {
      const b = list[n];
      if (pos.y + h <= b.y0 || pos.y >= b.y1) continue;
      if (pos.x + r <= b.x0 || pos.x - r >= b.x1 || pos.z + r <= b.z0 || pos.z - r >= b.z1) continue;
      if (prevY >= b.y1 - 0.08 || b.y1 - pos.y < 0.4) { pos.y = b.y1; mv.landed = true; continue; }
      if (prevY + h <= b.y0 + 0.08) { pos.y = b.y0 - h; mv.ceil = true; continue; }
      const a1 = pos.x + r - b.x0, a2 = b.x1 - (pos.x - r), a3 = pos.z + r - b.z0, a4 = b.z1 - (pos.z - r);
      const m = Math.min(a1, a2, a3, a4);
      if (m === a1) pos.x -= a1; else if (m === a2) pos.x += a2; else if (m === a3) pos.z -= a3; else pos.z += a4;
      mv.wall = true;
    }
  }
  return mv;
}
export function pointInBox(x: number, y: number, z: number): boolean {
  const list = nearBoxes(x, z, x, z);
  for (const b of list) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) return true;
  return y < 0;
}
export function segBlocked(a: V3, b: V3, step = 1.5): boolean {
  const d = a.distanceTo(b), n = Math.ceil(d / step);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (pointInBox(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)) return true;
  }
  return false;
}
const _rh = new V3();
export function rayHit(o: V3, dir: V3, max: number, step = 1): { d: number; p: V3; hit: boolean } {
  for (let d = step; d <= max; d += step) {
    _rh.copy(o).addScaledVector(dir, d);
    if (pointInBox(_rh.x, _rh.y, _rh.z)) return { d: d - step * 0.5, p: _rh.clone().addScaledVector(dir, -step * 0.5), hit: true };
  }
  return { d: max, p: o.clone().addScaledVector(dir, max), hit: false };
}
export function freeSpot(x: number, z: number, spread: number, r = 1.5): V3 {
  for (let i = 0; i < 20; i++) {
    const px = x + (Math.random() - 0.5) * spread * (1 + i * 0.1), pz = z + (Math.random() - 0.5) * spread * (1 + i * 0.1);
    const list = nearBoxes(px - r, pz - r, px + r, pz + r);
    let ok = true;
    for (const b of list) if (b.y0 < 3 && px + r > b.x0 && px - r < b.x1 && pz + r > b.z0 && pz - r < b.z1) ok = false;
    if (ok) return new V3(px, 0, pz);
  }
  return new V3(x, 0, z);
}

/* ---------- rng ---------- */
function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- instancing helper ---------- */
class Inst {
  mesh: THREE.InstancedMesh;
  n = 0;
  m = new THREE.Matrix4();
  q = new THREE.Quaternion();
  c = new THREE.Color();
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, public max: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: any = 0xffffff, ry = 0) {
    if (this.n >= this.max) return;
    this.q.setFromAxisAngle(new V3(0, 1, 0), ry);
    this.m.compose(new V3(x, y, z), this.q, new V3(sx, sy, sz));
    this.mesh.setMatrixAt(this.n, this.m);
    this.mesh.setColorAt(this.n, this.c.set(color));
    this.n++;
  }
  done() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return this.mesh;
  }
}

export const winU = { uNight: { value: 0 } };
export const env = {
  lampMat: null as any,
  neonMat: null as any,
  hideLight: null as any,
  arenaLight: null as any,
  orbSpots: [] as V3[],
  lights: [] as THREE.Light[],
};
export let mapCanvas: HTMLCanvasElement;

function buildingMat() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = winU.uNight;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vON; varying float vSeed;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvec4 wp4 = modelMatrix * instanceMatrix * vec4(transformed,1.0); vWP = wp4.xyz; vON = normal; vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898,78.233)))*43758.5453);"
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight; varying vec3 vWP; varying vec3 vON; varying float vSeed;\nfloat h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float win=0.0; vec2 wid=vec2(0.0);
        if(abs(vON.y)<0.5){ float u = abs(vON.x)>0.5 ? vWP.z : vWP.x; vec2 wuv = vec2(u/3.4, vWP.y/3.8); vec2 f=fract(wuv); wid=floor(wuv);
          win = step(0.16,f.x)*step(f.x,0.84)*step(0.22,f.y)*step(f.y,0.78)*step(3.2,vWP.y); }
        float lit=step(0.5, h21(wid+vSeed*57.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16,0.28,0.4)+diffuseColor.rgb*0.15, win*0.8);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        vec3 wcol = mix(vec3(1.0,0.8,0.45), vec3(0.5,0.8,1.0), step(0.6, fract(vSeed*7.0+h21(wid))));
        totalEmissiveRadiance += wcol * win * lit * uNight * 1.5;`
      );
  };
  return mat;
}

const dprops = { rs: Math.random };
void dprops;

export function buildCity(root: THREE.Group) {
  const rng = mulberry(20240611);
  const rr = (a: number, b: number) => a + rng() * (b - a);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const bMat = buildingMat();
  const B = new Inst(box, bMat, 700);
  const plain = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.15 });
  const Roof = new Inst(box, plain, 1200);
  const neonMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.5 });
  const Neon = new Inst(box, neonMat, 600);
  Neon.mesh.castShadow = false;
  env.neonMat = neonMat;
  const Far = new Inst(box, new THREE.MeshStandardMaterial({ roughness: 1, color: 0xffffff }), 200);
  Far.mesh.castShadow = false;
  const Cont = new Inst(box, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.4 }), 400);
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1, 6);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const Trunk = new Inst(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5a3b28, roughness: 1 }), 900);
  const Leaf = new Inst(leafGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), 900);
  Trunk.mesh.castShadow = false;
  const pole = new Inst(new THREE.CylinderGeometry(0.12, 0.16, 1, 6), new THREE.MeshStandardMaterial({ color: 0x333845, metalness: 0.6, roughness: 0.4 }), 300);
  pole.mesh.castShadow = false;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0 });
  env.lampMat = lampMat;
  const lampHead = new Inst(new THREE.SphereGeometry(0.5, 8, 6), lampMat, 300);
  lampHead.mesh.castShadow = false;

  const pal: Record<string, number[]> = {
    downtown: [0x8c97ad, 0x6f7f9c, 0xa5b0c4, 0x56627a, 0x9aa6b8],
    neon: [0x4a3b78, 0x2f2f5e, 0x6a3f87, 0x3b4a8a, 0x7a3f6a],
    res: [0xf0e3d2, 0xe8c9b0, 0xd9e2e8, 0xf2d6d6, 0xc9dcc4],
    docks: [0x7a6a58, 0x5c6672, 0x8b5a45, 0x64707c],
    park: [0xdddddd],
  };
  const neonCols = [0xff2d95, 0x2ddcff, 0xffd22d, 0x8f5bff, 0x3dff9a, 0xff6a2d];
  const roofTops: { x: number; y: number; z: number }[] = [];

  const lot = (cx: number, cz: number, w: number, d: number, h: number, d1: string, opts: any = {}) => {
    const cols = pal[d1];
    const col = opts.color ?? cols[Math.floor(rng() * cols.length)];
    B.add(cx, h / 2, cz, w, h, d, col);
    Roof.add(cx, h + 0.4, cz, w + 0.8, 0.8, d + 0.8, new THREE.Color(col).multiplyScalar(0.55));
    addCenter(cx, cz, w, d, h + 0.8);
    roofTops.push({ x: cx, y: h + 0.8, z: cz });
    // rooftop clutter
    const n = h > 30 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const ax = cx + rr(-w / 3, w / 3), az = cz + rr(-d / 3, d / 3), ah = rr(1.2, 3);
      Roof.add(ax, h + 0.8 + ah / 2, az, rr(2, 4.5), ah, rr(2, 4.5), 0x70788a);
    }
    if (h > 55) {
      Roof.add(cx + rr(-w / 4, w / 4), h + 0.8 + 9, cz + rr(-d / 4, d / 4), 0.5, 18, 0.5, 0xc03030);
    }
    if (d1 === "neon" && rng() < 0.85) {
      const nc = neonCols[Math.floor(rng() * neonCols.length)];
      Neon.add(cx + rr(-3, 3), rr(5, Math.min(14, h - 2)), cz + d / 2 + 0.25, rr(5, 9), 1.8, 0.3, nc);
      if (rng() < 0.6) Neon.add(cx + w / 2 + 0.25, rr(7, Math.min(22, h - 2)), cz + rr(-4, 4), 0.3, rr(4, 8), 1.6, neonCols[Math.floor(rng() * 6)]);
      Neon.add(cx, h + 1.5, cz - d / 2 + 0.2, w * 0.8, 0.5, 0.4, nc);
    }
    if (d1 === "res" && h < 20) {
      Roof.add(cx, h + 1.8, cz, w * 0.7, 2.2, d * 0.7, 0xb5543f);
    }
  };

  const tree = (x: number, z: number, d1: string, s = 1) => {
    const th = rr(2.5, 4) * s;
    Trunk.add(x, th / 2, z, 1 * s, th, 1 * s);
    const lc = d1 === "res" ? [0xffa6c9, 0xff8fb8, 0xffc2d8][Math.floor(rng() * 3)] : [0x3f9b4a, 0x4fb35a, 0x2f8a46][Math.floor(rng() * 3)];
    const r = rr(2, 3.2) * s;
    Leaf.add(x, th + r * 0.6, z, r, r * 0.85, r, lc);
  };

  /* --- cells --- */
  for (let i = -3; i <= 3; i++)
    for (let j = -3; j <= 3; j++) {
      const cx = i * PITCH, cz = j * PITCH;
      const d1 = districtOf(cx, cz);
      if (i === 0 && j === 0) continue;
      if (d1 === "downtown") {
        if (rng() < 0.45) lot(cx + rr(-2, 2), cz + rr(-2, 2), rr(38, 50), rr(38, 50), rr(85, 175), d1);
        else if (rng() < 0.5) { lot(cx - 15, cz, 24, rr(40, 54), rr(55, 120), d1); lot(cx + 15, cz, 24, rr(40, 54), rr(55, 130), d1); }
        else { lot(cx, cz - 15, rr(40, 54), 24, rr(55, 130), d1); lot(cx, cz + 15, rr(40, 54), 24, rr(55, 120), d1); }
      } else if (d1 === "neon") {
        for (const [ox, oz] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) lot(cx + ox, cz + oz, rr(22, 26), rr(22, 26), rr(18, 60), d1);
      } else if (d1 === "res") {
        for (const [ox, oz] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
          if (rng() < 0.18) { tree(cx + ox, cz + oz, d1, 1.3); tree(cx + ox + 4, cz + oz - 3, d1); continue; }
          lot(cx + ox, cz + oz, rr(18, 24), rr(18, 24), rr(7, 20), d1);
        }
      } else if (d1 === "docks") {
        if (i === 0 && j === -3) continue; // hideout
        if (i === -1 && j === -3) {
          for (let k = 0; k < 6; k++) { const px = cx + (k % 2 ? 26 : -26), pz = cz + (k < 3 ? -18 : 18) + rr(-3, 3); Cont.add(px, 1.4, pz, 6, 2.8, 2.5, neonCols[k]); addCenter(px, pz, 6, 2.5, 2.8); }
          continue;
        }
        lot(cx - 12, cz + rr(-6, 6), rr(30, 40), rr(22, 30), rr(10, 18), d1);
        if (rng() < 0.7) {
          for (let k = 0; k < 4; k++) {
            const px = cx + 20 + (k % 2) * 3, pz = cz - 20 + Math.floor(k / 2) * 6, sh = 2.8 * (1 + Math.floor(rng() * 3));
            for (let s = 0; s < sh / 2.8; s++) Cont.add(px, 1.4 + s * 2.8, pz, 6.2, 2.8, 2.5, neonCols[Math.floor(rng() * 6)]);
            addCenter(px, pz, 6.2, 2.5, sh);
          }
        }
        if (rng() < 0.5) { // crane
          const px = cx + 22, pz = cz + 22;
          for (const [ox, oz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { Cont.add(px + ox, 17, pz + oz, 0.7, 34, 0.7, 0xe8b020); addCenter(px + ox, pz + oz, 0.7, 0.7, 34); }
          Cont.add(px - 8, 35, pz, 30, 1.5, 1.5, 0xe8b020);
        }
      } else if (d1 === "park") {
        const ax = i * PITCH, az = j * PITCH;
        const isArena = i === 0 && j === 3;
        for (let k = 0; k < (isArena ? 6 : 22); k++) {
          const tx = ax + rr(-27, 27), tz = az + rr(-27, 27);
          if (Math.hypot(tx - ax, tz - az) < (isArena ? 22 : 8) || (i === 1 && j === 3 && Math.hypot(tx - ax - 6, tz - az) < 20)) continue;
          tree(tx, tz, d1, rr(0.9, 1.5));
        }
        if (i === -1 && j === 2) { // pavilion
          for (const [ox, oz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { Cont.add(ax + ox, 3, az + oz, 0.8, 6, 0.8, 0xeeeeee); addCenter(ax + ox, az + oz, 0.8, 0.8, 6); }
          Cont.add(ax, 6.5, az, 13, 1, 13, 0xc0392b); addCenter(ax, az, 13, 13, 0.01, 6);
        }
      }
    }

  /* --- plaza & hero tower --- */
  B.add(0, 45, 0, 16, 90, 16, 0xdfe6f2);
  addCenter(0, 0, 16, 16, 90);
  Roof.add(0, 91, 0, 18, 2, 18, 0x333a50);
  Neon.add(0, 70, 8.2, 10, 3, 0.4, 0xffd23f);
  Neon.add(0, 70, -8.2, 10, 3, 0.4, 0x8f5bff);
  Neon.add(8.2, 70, 0, 0.4, 3, 10, 0xff6a1a);
  Neon.add(-8.2, 70, 0, 0.4, 3, 10, 0x3fd0ff);
  Roof.add(0, 100, 0, 1, 16, 1, 0xffffff);
  roofTops.push({ x: 0, y: 92, z: 0 });
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    tree(Math.cos(a) * 26, Math.sin(a) * 26, "res", 1.1);
  }
  // fountain
  Cont.add(-18, 0.5, -18, 8, 1, 8, 0x9aa7bd);
  addCenter(-18, -18, 8, 8, 1);
  // subway / abyss gate
  Cont.add(22, 2, 22, 8, 4, 6, 0x2a2f45);
  addCenter(22, 22, 8, 6, 4);
  Neon.add(22, 4.6, 24.2, 7, 1, 0.3, 0x8f5bff);

  /* --- skyway (bridge) --- */
  const deck = Cont;
  deck.add(0, 17.4, 40, 490, 1.2, 15, 0x59627a);
  addBox(-245, 16.8, 32.5, 245, 18, 47.5);
  deck.add(0, 19, 32.5, 490, 1.4, 0.4, 0x8895b5);
  deck.add(0, 19, 47.5, 490, 1.4, 0.4, 0x8895b5);
  Neon.add(0, 17.0, 32.4, 490, 0.3, 0.2, 0x3fd0ff);
  Neon.add(0, 17.0, 47.6, 490, 0.3, 0.2, 0x3fd0ff);
  for (let x = -240; x <= 240; x += 80) { deck.add(x, 8.4, 40, 3, 16.8, 3, 0x6b7590); addCenter(x, 40, 3, 3, 16.8); }

  /* --- hideout --- */
  const hx = 0, hz = -242;
  const wall = (x0: number, z0: number, x1: number, z1: number, h = 16) => {
    Cont.add((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, 0x3b2f3f);
    addBox(x0, 0, z0, x1, h, z1);
  };
  wall(hx - 27, hz - 21, hx + 27, hz - 19);
  wall(hx - 27, hz - 21, hx - 25, hz + 21);
  wall(hx + 25, hz - 21, hx + 27, hz + 21);
  wall(hx - 27, hz + 19, hx - 6, hz + 21);
  wall(hx + 6, hz + 19, hx + 27, hz + 21);
  Cont.add(hx, 16.8, hz, 56, 1.6, 44, 0x2a2230);
  addBox(hx - 28, 16, hz - 22, hx + 28, 17.6, hz + 22);
  roofTops.push({ x: hx, y: 18, z: hz });
  Neon.add(hx, 8, hz - 18.7, 14, 6, 0.3, 0xff2020);
  Neon.add(hx - 7, 6, hz + 21.3, 0.8, 8, 0.4, 0xff2020);
  Neon.add(hx + 7, 6, hz + 21.3, 0.8, 8, 0.4, 0xff2020);
  Neon.add(hx, 15.4, hz + 21.3, 14, 0.8, 0.4, 0xff2020);
  for (const [ox, oz] of [[-18, 8], [18, 8], [-12, -10], [14, -12]]) { Cont.add(hx + ox, 1.2, hz + oz, 3, 2.4, 3, 0x7a4a2a); addCenter(hx + ox, hz + oz, 3, 3, 2.4); }
  const hl = new THREE.PointLight(0xff3a3a, 0, 70, 1.5);
  hl.position.set(hx, 8, hz);
  root.add(hl);
  env.hideLight = hl;

  /* --- underground arena --- */
  const A = ARENA;
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x15161f, roughness: 0.35, metalness: 0.7 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(A.x, 0.02, A.z); floor.receiveShadow = true;
  root.add(floor);
  const gridTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "#7a4dff"; g.lineWidth = 3;
    for (let k = 0; k <= 512; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
    g.strokeStyle = "#ff4a6a"; g.lineWidth = 6; g.beginPath(); g.arc(256, 256, 200, 0, 7); g.stroke(); g.beginPath(); g.arc(256, 256, 120, 0, 7); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(A.x, 0.05, A.z);
  root.add(glow);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b1c28, roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide });
  const mk = (x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material = wallMat) => {
    const me = new THREE.Mesh(box, m); me.scale.set(w, h, d); me.position.set(x, y, z); root.add(me);
  };
  mk(A.x, 48, A.z, 150, 2, 150);
  mk(A.x, 24, A.z - 75, 150, 48, 2); mk(A.x, 24, A.z + 75, 150, 48, 2);
  mk(A.x - 75, 24, A.z, 2, 48, 150); mk(A.x + 75, 24, A.z, 2, 48, 150);
  addBox(A.x - 76, 0, A.z - 76, A.x + 76, 50, A.z - 74);
  addBox(A.x - 76, 0, A.z + 74, A.x + 76, 50, A.z + 76);
  addBox(A.x - 76, 0, A.z - 76, A.x - 74, 50, A.z + 76);
  addBox(A.x + 74, 0, A.z - 76, A.x + 76, 50, A.z + 76);
  addBox(A.x - 76, 46, A.z - 76, A.x + 76, 60, A.z + 76);
  const pilMat = new THREE.MeshStandardMaterial({ color: 0x2a2c3d, roughness: 0.5, metalness: 0.6 });
  const glowM = new THREE.MeshBasicMaterial({ color: 0x8f5bff });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.4, px = A.x + Math.cos(a) * 36, pz = A.z + Math.sin(a) * 36;
    mk(px, 23, pz, 5, 46, 5, pilMat); mk(px, 23, pz, 5.3, 1, 5.3, glowM); mk(px, 8, pz, 5.3, 0.6, 5.3, glowM);
    addBox(px - 2.5, 0, pz - 2.5, px + 2.5, 46, pz + 2.5);
  }
  const al = new THREE.PointLight(0x9a6bff, 0, 160, 1.2);
  al.position.set(A.x, 30, A.z);
  root.add(al);
  env.arenaLight = al;

  /* --- trees/lamps along roads --- */
  const lines = [-280, -200, -120, -40, 40, 120, 200, 280];
  for (const L of lines)
    for (let t = -270; t <= 270; t += 28) {
      for (const side of [-1, 1]) {
        for (const [px, pz] of [[L + side * 11.5, t], [t, L + side * 11.5]]) {
          if (pole.n >= pole.max - 2) continue;
          if (Math.abs(((px + 40) % 80) - 0) < 14 && Math.abs(((pz + 40) % 80) - 0) < 14) continue;
          pole.add(px, 4.5, pz, 1, 9, 1);
          lampHead.add(px, 9.2, pz, 1, 1, 1, 0xffffff);
        }
      }
    }
  for (let k = 0; k < lines.length - 1; k++)
    for (let m = 0; m < 30; m++) {
      const L = lines[k] + 40 + 0; void L;
    }
  // sidewalk trees (res & downtown)
  for (const L of lines)
    for (let t = -260; t <= 260; t += 16) {
      for (const [px, pz] of [[L + 13, t], [t, L - 13]]) {
        const d1 = districtOf(px, pz);
        if (d1 === "neon" || d1 === "docks" || rng() < 0.45) continue;
        const gx = ((px + 40) % 80 + 80) % 80, gz = ((pz + 40) % 80 + 80) % 80;
        if ((gx < 16 || gx > 64) && (gz < 16 || gz > 64)) continue;
        if (pointInBox(px, 2, pz)) continue;
        tree(px, pz, d1, 0.8);
      }
    }

  /* --- far skyline --- */
  for (let k = 0; k < 180; k++) {
    const a = rng() * Math.PI * 2, r = rr(380, 900), h = rr(40, 220);
    Far.add(Math.cos(a) * r, h / 2, Math.sin(a) * r, rr(20, 50), h, rr(20, 50), new THREE.Color().setHSL(0.62, 0.25, rr(0.18, 0.34)));
    if (Math.cos(a) * r > 560 && Math.abs(Math.sin(a) * r) < 130) { Far.n--; }
  }

  [B, Roof, Neon, Far, Cont, Trunk, Leaf, pole, lampHead].forEach((x) => root.add(x.done()));

  // orbs spots: tallest roofs
  roofTops.sort((a, b) => b.y - a.y);
  env.orbSpots = roofTops.slice(0, 34).map((r) => new V3(r.x + rr(-4, 4), r.y + 3.5, r.z + rr(-4, 4)));
  for (let x = -200; x <= 200; x += 100) env.orbSpots.push(new V3(x, 22.5, 40));

  /* --- ground canvas --- */
  const SZ = 2048;
  const c = document.createElement("canvas");
  c.width = c.height = SZ;
  mapCanvas = c;
  const g = c.getContext("2d")!;
  const S = SZ / (MAPHALF * 2);
  const P = (v: number) => (v + MAPHALF) * S;
  const dcol: Record<string, string> = { downtown: "#59607a", neon: "#3a3455", res: "#7d8f6b", park: "#4f9a4f", docks: "#675f58" };
  for (let i = -3; i <= 3; i++)
    for (let j = -3; j <= 3; j++) {
      g.fillStyle = dcol[districtOf(i * PITCH, j * PITCH)];
      g.fillRect(P(i * PITCH - 40), P(j * PITCH - 40), PITCH * S + 1, PITCH * S + 1);
    }
  g.fillStyle = "#4f9a4f"; g.fillRect(0, 0, 0, 0);
  // park paths/pond
  g.fillStyle = "#2f6fb0"; g.beginPath(); g.ellipse(P(86), P(240), 14 * S, 20 * S, 0, 0, 7); g.fill();
  g.fillStyle = "#8fbf6a"; g.beginPath(); g.arc(P(0), P(240), 24 * S, 0, 7); g.fill();
  g.fillStyle = "#b9a98a"; g.beginPath(); g.arc(P(0), P(0), 30 * S, 0, 7); g.fill();
  g.fillStyle = "#6a6258"; g.fillRect(P(-26), P(-262), 52 * S, 42 * S);
  for (const L of lines) {
    g.fillStyle = "#9aa0ad"; g.fillRect(P(L - 13), P(-MAPHALF), 26 * S, MAPHALF * 2 * S); g.fillRect(P(-MAPHALF), P(L - 13), MAPHALF * 2 * S, 26 * S);
  }
  for (const L of lines) {
    g.fillStyle = "#2a2d38"; g.fillRect(P(L - 10), P(-MAPHALF), 20 * S, MAPHALF * 2 * S); g.fillRect(P(-MAPHALF), P(L - 10), MAPHALF * 2 * S, 20 * S);
  }
  g.fillStyle = "#e6c84a";
  for (const L of lines)
    for (let t = -MAPHALF; t < MAPHALF; t += 8) {
      g.fillRect(P(L - 0.2), P(t), 0.5 * S, 4 * S); g.fillRect(P(t), P(L - 0.2), 4 * S, 0.5 * S);
    }
  g.fillStyle = "#dfe3ea";
  for (const a of lines)
    for (const b of lines)
      for (let k = -8; k <= 8; k += 2.4) {
        g.fillRect(P(a + k - 0.5), P(b - 12.5), 1.1 * S, 2.2 * S); g.fillRect(P(a + k - 0.5), P(b + 10.3), 1.1 * S, 2.2 * S);
        g.fillRect(P(a - 12.5), P(b + k - 0.5), 2.2 * S, 1.1 * S); g.fillRect(P(a + 10.3), P(b + k - 0.5), 2.2 * S, 1.1 * S);
      }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAPHALF * 2, MAPHALF * 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x2e3a3a, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.1;
  root.add(outer);
  // pond sheen
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: 0x3a8ad0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 }));
  pond.rotation.x = -Math.PI / 2; pond.scale.set(14, 20, 1); pond.position.set(86, 0.06, 240);
  root.add(pond);
  void G;
}
