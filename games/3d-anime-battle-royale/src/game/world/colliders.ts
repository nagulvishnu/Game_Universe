import { MOVE } from '../data/config';
import { clamp } from '../util';

export interface DistrictInfo {
  id: string; name: string; x: number; z: number; r: number; color: string; loot: number; danger: number; kind: string;
}
export interface RoadInfo { pts: [number, number][]; width: number }

export interface LootSpot { x: number; y: number; z: number; q: number; district: string; building: number; outdoor?: boolean; level?: number }
export interface BuildingInfo { id: number; x: number; z: number; w: number; d: number; door: { ox: number; oz: number; ix: number; iz: number }[]; district: string; floor: number }

export interface RenderData {
  boxes: number[]; // cx,cy,cz,sx,sy,sz,color
  emis: number[]; // emissive boxes
  cyl: number[]; // cx,cy,cz,rx,h,rz,color
  cones: number[];
  trees: number[]; // x,y,z,scale,type
  props: number[]; // x,y,z (spare)
}

export interface World {
  kind: 'island' | 'training';
  size: number;
  half: number;
  res: number; // height grid resolution
  n: number;
  heights: Float32Array;
  grid: ColliderGrid;
  render: RenderData;
  districts: DistrictInfo[];
  roads: RoadInfo[];
  lootSpots: LootSpot[];
  buildings: BuildingInfo[];
  vehicleSpots: { x: number; z: number; yaw: number }[];
  mapCanvas: HTMLCanvasElement | null;
  nav: Uint8Array | null; // coarse nav blocked grid
  navCell: number;
  navN: number;
  heightAt(x: number, z: number): number;
  landAt(x: number, z: number): boolean;
}

export class ColliderGrid {
  cell = 16;
  n: number;
  half: number;
  boxes: number[] = [];
  cells: number[][];
  stamp: Uint32Array = new Uint32Array(0);
  stampN = 0;
  constructor(half: number) {
    this.half = half;
    this.n = Math.ceil((half * 2) / this.cell) + 1;
    this.cells = Array.from({ length: this.n * this.n }, () => []);
  }
  add(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const id = this.boxes.length / 6;
    this.boxes.push(x0, y0, z0, x1, y1, z1);
    const m = 1.6;
    const cx0 = this.ci(x0 - m), cx1 = this.ci(x1 + m), cz0 = this.ci(z0 - m), cz1 = this.ci(z1 + m);
    for (let i = cx0; i <= cx1; i++) for (let j = cz0; j <= cz1; j++) this.cells[j * this.n + i].push(id);
    return id;
  }
  ci(v: number) { return clamp(Math.floor((v + this.half) / this.cell), 0, this.n - 1); }
  at(x: number, z: number) { return this.cells[this.ci(z) * this.n + this.ci(x)]; }
  finalize() { this.stamp = new Uint32Array(this.boxes.length / 6 + 1); }
}

const EMPTY: number[] = [];

export function groundAt(w: World, x: number, z: number, feet: number, stepUp: number, r: number) {
  let g = w.heightAt(x, z);
  const b = w.grid.boxes;
  const list = w.grid.at(x, z) || EMPTY;
  const rr = r * 0.55;
  for (let k = 0; k < list.length; k++) {
    const i = list[k] * 6;
    const top = b[i + 4];
    if (top > g && top <= feet + stepUp + 0.01 && x > b[i] - rr && x < b[i + 3] + rr && z > b[i + 2] - rr && z < b[i + 5] + rr) g = top;
  }
  return g;
}

function blocked(w: World, nx: number, nz: number, ox: number, oz: number, feet: number, r: number, h: number, stepUp: number, mv: number) {
  const th = w.heightAt(nx, nz);
  if (th - feet > stepUp + mv * 1.15) return true;
  if (th < -3.4 && th < w.heightAt(ox, oz)) return true;
  const b = w.grid.boxes;
  const list = w.grid.at(nx, nz) || EMPTY;
  const top = feet + h;
  const low = feet + stepUp;
  for (let k = 0; k < list.length; k++) {
    const i = list[k] * 6;
    if (b[i + 4] > low && b[i + 1] < top && nx + r > b[i] && nx - r < b[i + 3] && nz + r > b[i + 2] && nz - r < b[i + 5]) return true;
  }
  return false;
}

export const moveRes = { grounded: false, hit: false, impact: 0, wall: 0 };

/** Moves a vertical cylinder body through the world. p = feet position. */
export function moveBody(w: World, p: { x: number; y: number; z: number }, v: { x: number; y: number; z: number }, r: number, h: number, stepUp: number, dt: number, wasGrounded: boolean, gravity = MOVE.gravity) {
  moveRes.hit = false; moveRes.impact = 0; moveRes.wall = 0;
  const nx = p.x + v.x * dt;
  if (!blocked(w, nx, p.z, p.x, p.z, p.y, r, h, stepUp, Math.abs(v.x * dt))) p.x = nx;
  else { moveRes.hit = true; moveRes.wall = Math.max(moveRes.wall, Math.abs(v.x)); v.x = 0; }
  const nz = p.z + v.z * dt;
  if (!blocked(w, p.x, nz, p.x, p.z, p.y, r, h, stepUp, Math.abs(v.z * dt))) p.z = nz;
  else { moveRes.hit = true; moveRes.wall = Math.max(moveRes.wall, Math.abs(v.z)); v.z = 0; }
  v.y -= gravity * dt;
  let ny = p.y + v.y * dt;
  const g = groundAt(w, p.x, p.z, p.y, stepUp, r);
  if (v.y > 0) {
    const b = w.grid.boxes;
    const list = w.grid.at(p.x, p.z) || EMPTY;
    for (let k = 0; k < list.length; k++) {
      const i = list[k] * 6;
      if (b[i + 1] >= p.y + h - 0.25 && b[i + 1] < ny + h && p.x + r * 0.7 > b[i] && p.x - r * 0.7 < b[i + 3] && p.z + r * 0.7 > b[i + 2] && p.z - r * 0.7 < b[i + 5]) {
        ny = b[i + 1] - h; v.y = 0;
      }
    }
  }
  moveRes.grounded = false;
  if (ny <= g + 1e-4 && v.y <= 0) {
    moveRes.impact = Math.max(0, -v.y);
    ny = g; v.y = 0; moveRes.grounded = true;
  } else if (wasGrounded && v.y <= 0 && ny - g < 0.5) {
    ny = g; v.y = 0; moveRes.grounded = true;
  }
  p.y = ny;
  return moveRes;
}

export const rayRes = { t: Infinity, nx: 0, ny: 1, nz: 0, kind: 0 as 0 | 1 | 2 };

/** Raycast against boxes + terrain. kind: 1 = terrain, 2 = box. Returns true on hit (rayRes populated). */
export function raycastWorld(w: World, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number) {
  rayRes.t = maxT; rayRes.kind = 0; rayRes.ny = 1; rayRes.nx = 0; rayRes.nz = 0;
  const g = w.grid;
  const b = g.boxes;
  g.stampN++;
  const step = 7;
  const nsteps = Math.ceil(maxT / step) + 1;
  for (let s = 0; s <= nsteps; s++) {
    const t = Math.min(s * step, maxT);
    const list = g.at(ox + dx * t, oz + dz * t) || EMPTY;
    for (let k = 0; k < list.length; k++) {
      const id = list[k];
      if (g.stamp[id] === g.stampN) continue;
      g.stamp[id] = g.stampN;
      const i = id * 6;
      let t0 = 0, t1 = rayRes.t;
      let ax = 0;
      let axis = -1, sign = 0;
      for (let a = 0; a < 3; a++) {
        const o = a === 0 ? ox : a === 1 ? oy : oz;
        const d = a === 0 ? dx : a === 1 ? dy : dz;
        const lo = b[i + a], hi = b[i + 3 + a];
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = 1e9; break; } continue; }
        let ta = (lo - o) / d, tb = (hi - o) / d, sg = -1;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; sg = 1; }
        if (ta > t0) { t0 = ta; axis = a; sign = sg; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) break;
      }
      ax = axis;
      if (t0 <= t1 && t0 >= 0 && t0 < rayRes.t) {
        rayRes.t = t0; rayRes.kind = 2;
        rayRes.nx = ax === 0 ? sign : 0; rayRes.ny = ax === 1 ? sign : 0; rayRes.nz = ax === 2 ? sign : 0;
      }
    }
  }
  // terrain march
  const tmax = rayRes.t;
  let prevT = 0;
  const ts = 2.5;
  let prevAbove = oy - w.heightAt(ox, oz);
  if (prevAbove < 0) prevAbove = 0.0001;
  for (let t = ts; ; t += ts) {
    const tt = Math.min(t, tmax);
    const hx = ox + dx * tt, hz = oz + dz * tt;
    const above = oy + dy * tt - w.heightAt(hx, hz);
    if (above < 0) {
      let lo = prevT, hi = tt;
      for (let it = 0; it < 6; it++) {
        const m = (lo + hi) / 2;
        if (oy + dy * m - w.heightAt(ox + dx * m, oz + dz * m) < 0) hi = m; else lo = m;
      }
      rayRes.t = hi; rayRes.kind = 1;
      const px = ox + dx * hi, pz = oz + dz * hi;
      const gx = w.heightAt(px + 1, pz) - w.heightAt(px - 1, pz);
      const gz = w.heightAt(px, pz + 1) - w.heightAt(px, pz - 1);
      const l = Math.hypot(gx, 2, gz);
      rayRes.nx = -gx / l; rayRes.ny = 2 / l; rayRes.nz = -gz / l;
      return true;
    }
    prevT = tt;
    if (tt >= tmax) break;
  }
  return rayRes.kind !== 0;
}

export function hasLOS(w: World, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const l = Math.hypot(dx, dy, dz);
  if (l < 0.01) return true;
  return !raycastWorld(w, ax, ay, az, dx / l, dy / l, dz / l, l - 0.3);
}
