import { buildCity } from './city';
import type { Collider } from './builder';

const CELL = 10;
const key = (ix: number, iz: number) => (ix + 100) * 1000 + (iz + 100);
let grid: Map<number, Collider[]> | null = null;

function ensureGrid() {
  if (grid) return grid;
  grid = new Map();
  for (const c of buildCity().colliders) {
    const rad = c.round ? c.r : Math.hypot(c.hw, c.hd);
    const x0 = Math.floor((c.x - rad) / CELL), x1 = Math.floor((c.x + rad) / CELL);
    const z0 = Math.floor((c.z - rad) / CELL), z1 = Math.floor((c.z + rad) / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = key(ix, iz);
      let a = grid.get(k);
      if (!a) { a = []; grid.set(k, a); }
      a.push(c);
    }
  }
  return grid;
}

const out = { x: 0, z: 0 };

/** Push a circle (player) out of nearby colliders. Returns a shared result object. */
export function resolveMove(px: number, pz: number, radius: number) {
  const g = ensureGrid();
  out.x = px; out.z = pz;
  for (let iter = 0; iter < 2; iter++) {
    const ix = Math.floor(out.x / CELL), iz = Math.floor(out.z / CELL);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const list = g.get(key(ix + dx, iz + dz));
      if (!list) continue;
      for (const c of list) {
        if (c.camOnly) continue;
        if (c.round) {
          const ddx = out.x - c.x, ddz = out.z - c.z;
          const d = Math.hypot(ddx, ddz), min = c.r + radius;
          if (d < min) {
            const nx = d > 1e-5 ? ddx / d : 1, nz = d > 1e-5 ? ddz / d : 0;
            out.x = c.x + nx * min; out.z = c.z + nz * min;
          }
        } else {
          const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
          const rx = out.x - c.x, rz = out.z - c.z;
          const lx = rx * cs - rz * sn, lz = rx * sn + rz * cs;
          const cx = Math.max(-c.hw, Math.min(c.hw, lx)), cz = Math.max(-c.hd, Math.min(c.hd, lz));
          let nx: number, nz: number, push: number;
          if (cx === lx && cz === lz) {
            const px2 = c.hw - Math.abs(lx), pz2 = c.hd - Math.abs(lz);
            if (px2 < pz2) { nx = Math.sign(lx) || 1; nz = 0; push = px2 + radius; }
            else { nx = 0; nz = Math.sign(lz) || 1; push = pz2 + radius; }
          } else {
            const ddx = lx - cx, ddz = lz - cz;
            const d = Math.hypot(ddx, ddz);
            if (d >= radius) continue;
            nx = ddx / d; nz = ddz / d; push = radius - d;
          }
          out.x += (nx * cs + nz * sn) * push;
          out.z += (-nx * sn + nz * cs) * push;
        }
      }
    }
  }
  return out;
}

function inside(c: Collider, x: number, z: number, pad: number) {
  if (c.round) return Math.hypot(x - c.x, z - c.z) < c.r + pad;
  const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
  const rx = x - c.x, rz = z - c.z;
  const lx = rx * cs - rz * sn, lz = rx * sn + rz * cs;
  return Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad;
}

/** Distance along a 2D ray (x0,z0)->(x1,z1) before it enters a tall collider. Returns length in [0, total]. */
export function rayFreeDistance(x0: number, z0: number, x1: number, z1: number): number {
  const g = ensureGrid();
  const len = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.ceil(len / 0.4);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const list = g.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) continue;
    for (const c of list) if (c.tall && inside(c, x, z, 0.35)) return Math.max(0, (i - 1) / steps * len);
  }
  return len;
}
