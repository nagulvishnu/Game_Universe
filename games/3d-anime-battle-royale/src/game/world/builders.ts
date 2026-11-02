import { BuildingInfo, ColliderGrid, LootSpot, RenderData } from './colliders';
import { DISTRICTS, ROADS, roadDist, riverDist } from './terrain';
import { Rng, clamp, pick, rand } from '../util';

export interface Stamp { x0: number; z0: number; x1: number; z1: number; y: number; margin: number }
export interface Decal { x: number; z: number; w: number; d: number; color: string; round?: boolean }

export class Builder {
  fps: number[][] = [];
  stamps: Stamp[] = [];
  lootSpots: LootSpot[] = [];
  buildings: BuildingInfo[] = [];
  decals: Decal[] = [];
  district = '';
  constructor(public grid: ColliderGrid, public render: RenderData, public rng: Rng, public h: (x: number, z: number) => number) {}

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, collide = true) {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    this.render.boxes.push((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color);
    if (collide) this.grid.add(x0, y0, z0, x1, y1, z1);
  }
  win(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: number) {
    this.render.emis.push(cx, cy, cz, sx, sy, sz, color);
  }
  cyl(cx: number, y0: number, cz: number, r: number, h: number, color: number, collide = true) {
    this.render.cyl.push(cx, y0 + h / 2, cz, r, h, r, color);
    if (collide) { const q = r * 0.8; this.grid.add(cx - q, y0, cz - q, cx + q, y0 + h, cz + q); }
  }
  cone(cx: number, y0: number, cz: number, hw: number, hd: number, h: number, color: number) {
    this.render.cones.push(cx, y0 + h / 2, cz, hw, h, hd, color);
  }
  reserve(x0: number, z0: number, x1: number, z1: number) { this.fps.push([x0, z0, x1, z1]); }
  ok(x: number, z: number, w: number, d: number, margin = 4, roadOk = false) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const hc = this.h(x, z);
    if (hc < 1.4 || hc > 70) return false;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      const hh = this.h(px, pz);
      if (hh < 1.0 || Math.abs(hh - hc) > 3.6) return false;
      if (!roadOk && roadDist(px, pz) < 6.5) return false;
    }
    if (!roadOk && roadDist(x, z) < 6.5) return false;
    const rv = riverDist(x, z);
    if (rv.d < rv.hw + 8 + Math.max(w, d) / 2) return false;
    for (const f of this.fps) if (x0 - margin < f[2] && x1 + margin > f[0] && z0 - margin < f[3] && z1 + margin > f[1]) return false;
    return true;
  }
  stairs(x0: number, z0: number, x1: number, z1: number, dir: '+x' | '-x' | '+z' | '-z', y0: number, y1: number, color: number, bottom: number) {
    const n = Math.max(2, Math.ceil((y1 - y0) / 0.43));
    const rise = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const top = y0 + (i + 1) * rise;
      const f0 = i / n, f1 = (i + 1) / n;
      if (dir === '+z') this.box(x0, bottom, z0 + (z1 - z0) * f0, x1, top, z0 + (z1 - z0) * f1, color);
      else if (dir === '-z') this.box(x0, bottom, z1 - (z1 - z0) * f1, x1, top, z1 - (z1 - z0) * f0, color);
      else if (dir === '+x') this.box(x0 + (x1 - x0) * f0, bottom, z0, x0 + (x1 - x0) * f1, top, z1, color);
      else this.box(x1 - (x1 - x0) * f1, bottom, z0, x1 - (x1 - x0) * f0, top, z1, color);
    }
  }
  wallX(xa: number, xb: number, z: number, y0: number, y1: number, t: number, color: number, doors: number[] = [], doorW = 2.6, doorH = 2.7) {
    const ds = [...doors].sort((a, b) => a - b);
    let cur = xa;
    for (const dc of ds) {
      this.box(cur, y0, z - t / 2, dc - doorW / 2, y1, z + t / 2, color);
      this.box(dc - doorW / 2, y0 + doorH, z - t / 2, dc + doorW / 2, y1, z + t / 2, color);
      cur = dc + doorW / 2;
    }
    this.box(cur, y0, z - t / 2, xb, y1, z + t / 2, color);
  }
  wallZ(x: number, za: number, zb: number, y0: number, y1: number, t: number, color: number, doors: number[] = [], doorW = 2.6, doorH = 2.7) {
    const ds = [...doors].sort((a, b) => a - b);
    let cur = za;
    for (const dc of ds) {
      this.box(x - t / 2, y0, cur, x + t / 2, y1, dc - doorW / 2, color);
      this.box(x - t / 2, y0 + doorH, dc - doorW / 2, x + t / 2, y1, dc + doorW / 2, color);
      cur = dc + doorW / 2;
    }
    this.box(x - t / 2, y0, cur, x + t / 2, y1, zb, color);
  }
  loot(x: number, y: number, z: number, q: number, building = -1, outdoor = false, level = 0) {
    this.lootSpots.push({ x, y, z, q, district: this.district, building, outdoor, level } as LootSpot);
  }
  container(x: number, z: number, alongX: boolean, color: number, gy: number, stack = 1) {
    const L = 12, W = 2.5, H = 2.6;
    for (let s = 0; s < stack; s++) {
      if (alongX) this.box(x - L / 2, gy + s * H, z - W / 2, x + L / 2, gy + (s + 1) * H, z + W / 2, color);
      else this.box(x - W / 2, gy + s * H, z - L / 2, x + W / 2, gy + (s + 1) * H, z + L / 2, color);
    }
    this.reserve(alongX ? x - L / 2 : x - W / 2, alongX ? z - W / 2 : z - L / 2, alongX ? x + L / 2 : x + W / 2, alongX ? z + W / 2 : z + L / 2);
  }
  car(x: number, z: number, gy: number, color: number) {
    const ax = this.rng() < 0.5;
    const L = 4.3, W = 1.9;
    const lx = ax ? L : W, lz = ax ? W : L;
    this.box(x - lx / 2, gy + 0.25, z - lz / 2, x + lx / 2, gy + 1.0, z + lz / 2, color);
    this.box(x - lx * (ax ? 0.25 : 0.4), gy + 1.0, z - lz * (ax ? 0.4 : 0.25), x + lx * (ax ? 0.25 : 0.4), gy + 1.55, z + lz * (ax ? 0.4 : 0.25), 0x232b3a, false);
    this.reserve(x - lx / 2 - 0.5, z - lz / 2 - 0.5, x + lx / 2 + 0.5, z + lz / 2 + 0.5);
  }
}

export interface BOpts {
  x: number; z: number; w: number; d: number; floors: number; fh?: number; wall: number; trim?: number; roof?: 'flat' | 'pitch' | 'none';
  roofColor?: number; doors?: string; win?: number; winColor?: number; loot?: number; roofAccess?: boolean; gy?: number; sealed?: number;
  furn?: boolean; doorW?: number; ruin?: boolean; sealedColor?: number; awning?: number; roofLoot?: boolean; q?: number; glass?: boolean; noStamp?: boolean;
}

/** Full enterable building: foundation, walls with doors, floors with stairwell, roof access, windows, furniture, loot. */
export function building(b: Builder, o: BOpts) {
  const fh = o.fh ?? 3.4, t = 0.4;
  const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, z0 = o.z - o.d / 2, z1 = o.z + o.d / 2;
  const gy = o.gy ?? b.h(o.x, o.z);
  const y0 = gy + 0.25;
  const q = o.q ?? 1;
  const doors = o.doors ?? 'ns';
  const doorW = o.doorW ?? 2.6;
  const stairs = o.floors > 1 || o.roofAccess;
  const canStairs = stairs && o.w >= 8 && o.d >= 10;
  b.reserve(x0, z0, x1, z1);
  if (!o.noStamp) b.stamps.push({ x0: x0 - 1.5, z0: z0 - 1.5, x1: x1 + 1.5, z1: z1 + 1.5, y: gy, margin: 5 });
  b.box(x0 - 0.3, gy - 5, z0 - 0.3, x1 + 0.3, y0, z1 + 0.3, o.trim ?? 0x8a8f99);
  const id = b.buildings.length;
  const hx0 = x0 + t + 0.1, hx1 = hx0 + 2.0, hz0 = z0 + t + 0.1;
  const steps = Math.ceil(fh / 0.43);
  const hz1 = hz0 + steps * 0.6;
  const flights = o.roofAccess ? o.floors : o.floors - 1;
  for (let f = 0; f < o.floors; f++) {
    const sy = y0 + f * fh, ty = sy + fh;
    const dN = f === 0 && doors.includes('n') ? [o.x] : [];
    const dS = f === 0 && doors.includes('s') ? [o.x] : [];
    const dW = f === 0 && doors.includes('w') ? [o.z] : [];
    const dE = f === 0 && doors.includes('e') ? [o.z] : [];
    if (o.ruin && f === 0) {
      const skip = (i: number) => b.rng() < 0.3 && i !== 0;
      const seg = (cond: boolean, fn: () => void) => { if (cond) fn(); };
      const len = o.w / 3;
      for (let i = 0; i < 3; i++) {
        seg(!skip(i), () => b.wallX(x0 + i * len, x0 + (i + 1) * len, z0, sy, ty - (b.rng() < 0.4 ? 1.2 : 0), t, o.wall, i === 1 ? dN : []));
        seg(!skip(i), () => b.wallX(x0 + i * len, x0 + (i + 1) * len, z1, sy, ty - (b.rng() < 0.4 ? 1.2 : 0), t, o.wall, i === 1 ? dS : []));
      }
      b.wallZ(x0, z0, z1, sy, ty - (b.rng() < 0.5 ? 1.5 : 0), t, o.wall, dW);
      if (b.rng() < 0.7) b.wallZ(x1, z0, z1, sy, ty, t, o.wall, dE);
    } else {
      b.wallX(x0, x1, z0, sy, ty, t, o.wall, dN, doorW);
      b.wallX(x0, x1, z1, sy, ty, t, o.wall, dS, doorW);
      b.wallZ(x0, z0, z1, sy, ty, t, o.wall, dW, doorW);
      b.wallZ(x1, z0, z1, sy, ty, t, o.wall, dE, doorW);
    }
    // slab (ceiling / roof) with stairwell hole where needed
    const hole = canStairs && f < flights;
    const sl0 = ty - 0.3;
    if (!hole) {
      if (!(o.ruin && f === 0 && o.floors === 1)) b.box(x0, sl0, z0, x1, ty, z1, o.trim ?? 0x8a8f99);
    } else {
      b.box(x0, sl0, z0, hx0, ty, z1, o.trim ?? 0x8a8f99);
      b.box(hx1, sl0, z0, x1, ty, z1, o.trim ?? 0x8a8f99);
      b.box(hx0, sl0, hz1, hx1, ty, z1, o.trim ?? 0x8a8f99);
      b.box(hx0, sl0, z0, hx1, ty, hz0, o.trim ?? 0x8a8f99);
    }
    if (canStairs && f < flights) b.stairs(hx0, hz0, hx1, hz1, '+z', sy, ty, 0x9a8f80, sy);
    // windows
    if (o.win) {
      const sp = o.win;
      const wc = o.winColor ?? 0xffe0a0;
      const nz = Math.max(1, Math.floor((o.w - 2) / sp)), nx = Math.max(1, Math.floor((o.d - 2) / sp));
      for (let i = 0; i < nz; i++) {
        const wx = x0 + 1 + (i + 0.5) * ((o.w - 2) / nz);
        if (f === 0 && (doors.includes('n') || doors.includes('s')) && Math.abs(wx - o.x) < 2.3) continue;
        const col = b.rng() < 0.65 ? wc : 0x2c3b52;
        b.win(wx, sy + 1.9, z0 - t / 2 - 0.03, 1.5, 1.3, 0.08, col);
        b.win(wx, sy + 1.9, z1 + t / 2 + 0.03, 1.5, 1.3, 0.08, b.rng() < 0.65 ? wc : 0x2c3b52);
      }
      for (let i = 0; i < nx; i++) {
        const wz = z0 + 1 + (i + 0.5) * ((o.d - 2) / nx);
        if (f === 0 && (doors.includes('e') || doors.includes('w')) && Math.abs(wz - o.z) < 2.3) continue;
        b.win(x0 - t / 2 - 0.03, sy + 1.9, wz, 0.08, 1.3, 1.5, b.rng() < 0.65 ? wc : 0x2c3b52);
        b.win(x1 + t / 2 + 0.03, sy + 1.9, wz, 0.08, 1.3, 1.5, b.rng() < 0.65 ? wc : 0x2c3b52);
      }
    }
    // furniture + loot
    if (o.furn !== false && o.w > 7 && o.d > 7) {
      const fx = x1 - t - 1.3, fz = z1 - t - 1.3;
      b.box(fx - 0.7, sy, fz - 0.45, fx + 0.7, sy + 0.85, fz + 0.45, 0x7a5a3a);
      if (o.d > 11) b.box(x1 - t - 0.6, sy, z0 + t + 1, x1 - t, sy + 2, z0 + t + 3.2, 0x5b4630);
    }
    const nl = f === 0 ? (o.loot ?? 3) : Math.max(0, Math.round((o.loot ?? 3) / 2.5));
    const cands: [number, number][] = [[o.x + o.w * 0.2, o.z + o.d * 0.2], [o.x - o.w * 0.12, o.z + o.d * 0.28], [o.x + o.w * 0.22, o.z - o.d * 0.2], [o.x, o.z], [o.x + o.w * 0.05, o.z + o.d * 0.3]];
    for (let i = 0; i < Math.min(nl, cands.length); i++) {
      const c = cands[i];
      if (canStairs && c[0] < hx1 + 0.8 && c[1] < hz1 + 0.8 && c[0] > x0) continue;
      b.loot(c[0], sy, c[1], q * (1 + f * 0.1), id, false, f);
    }
  }
  const roofY = y0 + o.floors * fh;
  // roof
  const roofType = o.roof ?? 'flat';
  if (roofType === 'flat') {
    const pc = o.trim ?? 0x8a8f99;
    if (o.roofAccess || o.sealed === undefined) {
      b.box(x0, roofY, z0, x1, roofY + 1.1, z0 + 0.3, pc);
      b.box(x0, roofY, z1 - 0.3, x1, roofY + 1.1, z1, pc);
      b.box(x0, roofY, z0 + 0.3, x0 + 0.3, roofY + 1.1, z1 - 0.3, pc);
      b.box(x1 - 0.3, roofY, z0 + 0.3, x1, roofY + 1.1, z1 - 0.3, pc);
    }
    if (o.roofAccess) {
      b.box(x1 - 3.5, roofY, z1 - 3.5, x1 - 1.5, roofY + 1.2, z1 - 1.5, 0x6b7280);
      if (o.roofLoot !== false) { b.loot(o.x, roofY, o.z - o.d * 0.1, q * 1.3, id, false, o.floors); }
    }
    if (o.sealed) {
      const si = 1.5;
      b.box(x0 + si, roofY, z0 + si, x1 - si, roofY + o.sealed, z1 - si, o.sealedColor ?? o.wall);
      const sh = o.sealed;
      for (let y = roofY + 3; y < roofY + sh - 1; y += 4) {
        b.win(o.x, y, z0 + si - 0.05, o.w - si * 2 - 1.5, 1.1, 0.08, b.rng() < 0.5 ? 0x8fd6ff : 0xffd0ff);
        b.win(o.x, y, z1 - si + 0.05, o.w - si * 2 - 1.5, 1.1, 0.08, b.rng() < 0.5 ? 0x8fd6ff : 0xffd0ff);
        b.win(x0 + si - 0.05, y, o.z, 0.08, 1.1, o.d - si * 2 - 1.5, b.rng() < 0.5 ? 0x8fd6ff : 0xffd0ff);
        b.win(x1 - si + 0.05, y, o.z, 0.08, 1.1, o.d - si * 2 - 1.5, b.rng() < 0.5 ? 0x8fd6ff : 0xffd0ff);
      }
      b.cone(o.x, roofY + sh, o.z, 0.25, 0.25, 6, 0xdddddd);
    }
  } else if (roofType === 'pitch') {
    b.cone(o.x, roofY, o.z, o.w / 2 + 0.8, o.d / 2 + 0.8, Math.min(o.w, o.d) * 0.4, o.roofColor ?? 0x8b3a2e);
  }
  if (o.awning) b.box(o.x - o.w * 0.35, y0 + 2.8, z1 + 0.1, o.x + o.w * 0.35, y0 + 3.0, z1 + 1.8, o.awning, false);
  const info: BuildingInfo = {
    id, x: o.x, z: o.z, w: o.w, d: o.d, district: b.district, floor: 0,
    door: [
      ...(doors.includes('n') ? [{ ox: o.x, oz: z0 - 3, ix: o.x, iz: z0 + 2.2 }] : []),
      ...(doors.includes('s') ? [{ ox: o.x, oz: z1 + 3, ix: o.x, iz: z1 - 2.2 }] : []),
      ...(doors.includes('w') ? [{ ox: x0 - 3, oz: o.z, ix: x0 + 2.2, iz: o.z }] : []),
      ...(doors.includes('e') ? [{ ox: x1 + 3, oz: o.z, ix: x1 - 2.2, iz: o.z }] : []),
    ],
  };
  b.buildings.push(info);
  return info;
}

export function watchtower(b: Builder, x: number, z: number, hgt: number, color: number, roof: number, gyOverride?: number) {
  const gy = gyOverride ?? b.h(x, z);
  const s = 2.6;
  b.reserve(x - s - 2, z - s - 2, x + s + 2, z + s + 14);
  b.stamps.push({ x0: x - s - 1, z0: z - s - 1, x1: x + s + 1, z1: z + s + 14, y: gy, margin: 4 });
  for (const [px, pz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) b.box(x + px - 0.35, gy - 3, z + pz - 0.35, x + px + 0.35, gy + hgt, z + pz + 0.35, color);
  b.box(x - s - 0.4, gy + hgt - 0.4, z - s - 0.4, x + s + 0.4, gy + hgt, z + s + 0.4, color);
  const ry = gy + hgt;
  b.box(x - s - 0.4, ry, z - s - 0.4, x + s + 0.4, ry + 1.1, z - s - 0.2, color);
  b.box(x - s - 0.4, ry, z - s - 0.4, x - s - 0.2, ry + 1.1, z + s + 0.4, color);
  b.box(x + s + 0.2, ry, z - s - 0.4, x + s + 0.4, ry + 1.1, z + s + 0.4, color);
  b.box(x - s - 0.4, ry, z + s + 0.2, x - 1.2, ry + 1.1, z + s + 0.4, color);
  b.box(x + 1.2, ry, z + s + 0.2, x + s + 0.4, ry + 1.1, z + s + 0.4, color);
  for (const [px, pz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) b.box(x + px - 0.2, ry + 1.1, z + pz - 0.2, x + px + 0.2, ry + 3.5, z + pz + 0.2, color, false);
  b.cone(x, ry + 3.5, z, s + 1.2, s + 1.2, 1.8, roof);
  b.stairs(x - 1.2, z + s + 0.4, x + 1.2, z + s + 0.4 + (hgt / 0.43) * 0.6, '-z', gy, ry, color, gy - 3);
  b.loot(x, ry, z, 1.5, -1, true, 1);
}

export function deckStructure(b: Builder, x0: number, z0: number, x1: number, z1: number, y: number, color: number, gy: number, stairSide: '+x' | '-x' | '+z' | '-z' = '+z') {
  b.reserve(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
  b.box(x0, y - 0.4, z0, x1, y, z1, color);
  for (let px = x0 + 1; px <= x1 - 1; px += Math.max(6, (x1 - x0) / 3)) for (let pz = z0 + 1; pz <= z1 - 1; pz += Math.max(6, (z1 - z0) / 3)) b.box(px - 0.4, gy - 3, pz - 0.4, px + 0.4, y - 0.4, pz + 0.4, color);
  b.box(x0, y, z0, x1, y + 0.9, z0 + 0.25, color);
  b.box(x0, y, z0, x0 + 0.25, y + 0.9, z1, color);
  b.box(x1 - 0.25, y, z0, x1, y + 0.9, z1, color);
  const len = (y - gy) / 0.43 * 0.6;
  const w = 2.2;
  if (stairSide === '+z') {
    const mx = (x0 + x1) / 2;
    b.box(x0, y, z1 - 0.25, mx - w / 2, y + 0.9, z1, color); b.box(mx + w / 2, y, z1 - 0.25, x1, y + 0.9, z1, color);
    b.stairs(mx - w / 2, z1, mx + w / 2, z1 + len, '-z', gy, y, color, gy - 3);
  } else {
    b.box(x0, y, z1 - 0.25, x1, y + 0.9, z1, color);
    b.stairs(x1, (z0 + z1) / 2 - w / 2, x1 + len, (z0 + z1) / 2 + w / 2, '-x', gy, y, color, gy - 3);
  }
}

const W = (r: Rng) => pick(r, [0xe8dfd0, 0xd9cdb8, 0xc9d3dc, 0xe3d2d2, 0xd5e0cf]);
const RC = (r: Rng) => pick(r, [0x8b3a2e, 0x4a5a7a, 0x6b4a2f, 0x3f6a50, 0x7a3b52]);

/* ---------------- DISTRICT GENERATORS ---------------- */

export function genNeon(b: Builder) {
  const d = DISTRICTS.find((x) => x.id === 'neon')!;
  b.district = 'neon';
  const r = b.rng;
  const S = 50;
  const pal = [0x7d8bb0, 0x9aa7c7, 0x6c7aa6, 0xb0b8d0, 0x8f7fbf, 0x5f8fbf];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    const cx = d.x + i * S, cz = d.z + j * S;
    const dist = Math.hypot(cx - d.x, cz - d.z);
    if (dist > d.r * 1.05) continue;
    const w = rand(r, 22, 30), dd = rand(r, 22, 30);
    const kind = r();
    if (i === 0 && j === 1) {
      // parking structure
      const gy = b.h(cx, cz);
      if (b.ok(cx, cz, 38, 28, 3, true)) {
        b.stamps.push({ x0: cx - 22, z0: cz - 16, x1: cx + 22, z1: cz + 16, y: gy, margin: 5 });
        b.box(cx - 19, gy - 3, cz - 14, cx + 19, gy + 0.2, cz + 14, 0x6b7280);
        deckStructure(b, cx - 19, cz - 14, cx + 19, cz + 14, gy + 3.6, 0x80879a, gy, '+z');
        deckStructure(b, cx - 19, cz - 14, cx + 19, cz + 14, gy + 7.2, 0x80879a, gy, '+x');
        for (let k = 0; k < 6; k++) { b.car(cx - 15 + k * 6, cz - 9, gy + 0.2, pick(r, [0xc53030, 0x2b6cb0, 0xe2e8f0, 0x2d3748])); }
        b.loot(cx, gy + 3.6, cz, 1.4, -1, true, 1); b.loot(cx + 8, gy + 7.2, cz, 1.6, -1, true, 2);
      }
      continue;
    }
    if (!b.ok(cx, cz, w, dd, 3.5, true)) continue;
    if (kind < 0.25) {
      building(b, { x: cx, z: cz, w, d: dd, floors: 3, wall: pick(r, pal), trim: 0x59607a, win: 3.5, winColor: 0x8fe0ff, roofAccess: true, loot: 3, q: 1.2, doors: 'nsew', sealed: rand(r, 30, 85), sealedColor: pick(r, [0x4a5a8a, 0x3b4a7a, 0x5a4a8a, 0x2f4f6f]) });
    } else if (kind < 0.7) {
      building(b, { x: cx, z: cz, w, d: dd, floors: 4 + Math.floor(r() * 2), wall: pick(r, pal), trim: 0x59607a, win: 3.4, winColor: pick(r, [0xffe0a0, 0xffb3f0, 0x9fe8ff]), roofAccess: true, loot: 3, q: 1.1, doors: 'ns' });
    } else {
      // shops
      building(b, { x: cx, z: cz, w: w + 4, d: dd - 4, floors: 2, wall: pick(r, [0xf0a8d8, 0x9ad8f0, 0xf7d58a, 0xb8f0c8]), trim: 0x59607a, win: 3.6, roofAccess: true, loot: 4, q: 1, doors: 'nsew', awning: pick(r, [0xff4fa0, 0x38bdf8, 0xfacc15]) });
    }
  }
  b.decals.push({ x: d.x, z: d.z, w: d.r * 2.0, d: d.r * 2.0, color: '#6f7690', round: true });
  // street grid decals
  for (let i = -3; i <= 3; i++) {
    b.decals.push({ x: d.x + i * S + S / 2, z: d.z, w: 8, d: d.r * 2.0, color: '#3b3f4f' });
    b.decals.push({ x: d.x, z: d.z + i * S + S / 2, w: d.r * 2.0, d: 8, color: '#3b3f4f' });
  }
  // parked cars along streets
  for (let k = 0; k < 14; k++) {
    const sx = d.x + Math.floor(rand(r, -3, 3)) * S + S / 2 + (r() < 0.5 ? -2.5 : 2.5), sz = d.z + rand(r, -d.r * 0.8, d.r * 0.8);
    if (Math.hypot(sx - d.x, sz - d.z) < d.r && b.ok(sx, sz, 4, 4, 1, true)) b.car(sx, sz, b.h(sx, sz), pick(r, [0xc53030, 0x2b6cb0, 0xe2e8f0, 0x2d3748, 0xd69e2e]));
  }
  // crates / supply
  for (let k = 0; k < 6; k++) { const sx = d.x + rand(r, -90, 90), sz = d.z + rand(r, -90, 90); if (b.ok(sx, sz, 3, 3, 1, true)) { b.box(sx - 1, b.h(sx, sz), sz - 1, sx + 1, b.h(sx, sz) + 1.3, sz + 1, 0x3b5b7a); b.loot(sx, b.h(sx, sz) + 1.3, sz, 1.5, -1, true); } }
}

export function genIron(b: Builder) {
  const d = DISTRICTS.find((x) => x.id === 'iron')!;
  b.district = 'iron';
  const r = b.rng;
  const gy = b.h(d.x, d.z);
  const hw = 105, hd = 85;
  const wc = 0x7a806e;
  b.stamps.push({ x0: d.x - hw - 6, z0: d.z - hd - 6, x1: d.x + hw + 6, z1: d.z + hd + 6, y: gy, margin: 25 });
  b.decals.push({ x: d.x, z: d.z, w: hw * 2 + 30, d: hd * 2 + 30, color: '#808575' });
  const H = 4.6;
  // perimeter wall with 4 gates
  const gate = 8;
  b.wallX(d.x - hw, d.x + hw, d.z - hd, gy, gy + H, 1.2, wc, [d.x], gate, 4.2);
  b.wallX(d.x - hw, d.x + hw, d.z + hd, gy, gy + H, 1.2, wc, [d.x - 40], gate, 4.2);
  b.wallZ(d.x - hw, d.z - hd, d.z + hd, gy, gy + H, 1.2, wc, [d.z], gate, 4.2);
  b.wallZ(d.x + hw, d.z - hd, d.z + hd, gy, gy + H, 1.2, wc, [d.z + 20], gate, 4.2);
  b.reserve(d.x - hw - 2, d.z - hd - 2, d.x + hw + 2, d.z - hd + 2); b.reserve(d.x - hw - 2, d.z + hd - 2, d.x + hw + 2, d.z + hd + 2);
  b.reserve(d.x - hw - 2, d.z - hd - 2, d.x - hw + 2, d.z + hd + 2); b.reserve(d.x + hw - 2, d.z - hd - 2, d.x + hw + 2, d.z + hd + 2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) watchtower(b, d.x + sx * (hw + 6), d.z + sz * (hd + 6) - (sz > 0 ? 14 : 0), 9.5, 0x6b7168, 0x474c42, gy);
  const mk = (x: number, z: number, w: number, dd: number, fl: number, loot: number, doors: string, extra: Partial<BOpts> = {}) =>
    building(b, { x, z, w, d: dd, floors: fl, wall: 0x8a9078, trim: 0x5d6256, loot, q: 1.9, doors, roof: 'flat', gy, noStamp: true, furn: true, ...extra });
  // hangars (big halls)
  for (const sz of [-1, 1]) {
    const hx = d.x - 55, hz = d.z + sz * 40;
    building(b, { x: hx, z: hz, w: 44, d: 30, floors: 1, fh: 10, wall: 0x6f7a8a, trim: 0x4b5563, loot: 6, q: 2.3, doors: 'ew', doorW: 12, roof: 'flat', gy, noStamp: true, furn: false, roofAccess: false });
    // parked aircraft inside
    b.box(hx - 8, gy + 0.25, hz - 1, hx + 8, gy + 2.6, hz + 1, 0x9aa0a8); b.box(hx - 1, gy + 0.25, hz - 8, hx + 1, gy + 2.2, hz + 8, 0x8a9098); b.box(hx - 8, gy + 0.25 + 1.8, hz - 0.4, hx - 6, gy + 5, hz + 0.4, 0x8a9098);
  }
  // barracks
  for (let i = 0; i < 3; i++) mk(d.x + 15 + i * 24, d.z - 55, 14, 26, 1, 4, 'ns');
  mk(d.x + 15, d.z + 55, 16, 28, 2, 4, 'ns', { roofAccess: true });
  mk(d.x + 45, d.z + 55, 16, 28, 2, 4, 'ns', { roofAccess: true });
  // command building
  mk(d.x + 70, d.z - 10, 22, 22, 3, 5, 'nsew', { roofAccess: true, win: 4, winColor: 0xa0ffd0 });
  // bunkers + storage
  for (let i = 0; i < 4; i++) mk(d.x - 90 + i * 12, d.z - 5 + (i % 2) * 14, 9, 11, 1, 3, i % 2 ? 'n' : 's');
  // fuel tanks + helipad + crates
  b.cyl(d.x + 90, gy, d.z + 45, 6, 8, 0x9a9f88); b.cyl(d.x + 90, gy, d.z + 62, 6, 8, 0x9a9f88);
  b.decals.push({ x: d.x + 5, z: d.z + 5, w: 22, d: 22, color: '#5d6256', round: true });
  b.decals.push({ x: d.x + 5, z: d.z + 5, w: 14, d: 14, color: '#d8d8c0', round: true });
  b.decals.push({ x: d.x - 10, z: d.z + 82, w: 220, d: 22, color: '#3a3d3a' });
  for (let k = 0; k < 24; k++) {
    const cx = d.x + rand(r, -hw + 8, hw - 8), cz = d.z + rand(r, -hd + 8, hd - 8);
    if (b.ok(cx, cz, 4, 4, 0.5, true)) { b.box(cx - 1.2, gy, cz - 1.2, cx + 1.2, gy + 1.5, cz + 1.2, 0x5a6b4a); b.loot(cx, gy + 1.5, cz, 2.2, -1, true); }
  }
  for (let k = 0; k < 6; k++) { const cx = d.x + rand(r, -hw + 20, hw - 20), cz = d.z + rand(r, -hd + 20, hd - 20); if (b.ok(cx, cz, 5, 5, 0.5, true)) { b.box(cx - 2.2, gy, cz - 2.2, cx + 2.2, gy + 1.0, cz + 2.2, 0x9a9f88); } }
  // sandbag cover walls
  for (let k = 0; k < 18; k++) { const cx = d.x + rand(r, -hw + 8, hw - 8), cz = d.z + rand(r, -hd + 8, hd - 8); if (b.ok(cx, cz, 4, 2, 0.5, true)) { const ax = r() < 0.5; b.box(cx - (ax ? 2 : 0.5), gy, cz - (ax ? 0.5 : 2), cx + (ax ? 2 : 0.5), gy + 1.2, cz + (ax ? 0.5 : 2), 0xb5a47a); } }
}

export function genGreen(b: Builder) {
  const d = DISTRICTS.find((x) => x.id === 'green')!;
  b.district = 'green';
  const r = b.rng;
  let n = 0;
  for (let tries = 0; tries < 400 && n < 15; tries++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * d.r * 1.6;
    const x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
    const big = n % 6 === 0;
    const w = big ? 14 : rand(r, 8, 11), dd = big ? 22 : rand(r, 10, 13);
    if (!b.ok(x, z, w, dd, 6)) continue;
    building(b, { x, z, w, d: dd, floors: 1, wall: pick(r, [0x8b5e3c, 0x9a6b45, 0x7a5233]), trim: 0x5b3d26, roof: 'pitch', roofColor: pick(r, [0x4a6a3a, 0x6b3b2a, 0x3a5a4a]), loot: big ? 4 : 3, q: 0.75, doors: 'ns', win: 4, winColor: 0xffe0a0 });
    n++;
  }
  // lookout towers on hills
  let tw = 0;
  for (let tries = 0; tries < 200 && tw < 3; tries++) {
    const a = r() * Math.PI * 2, rr = r() * d.r * 1.7;
    const x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
    if (b.ok(x, z, 8, 8, 14)) { watchtower(b, x, z, 10, 0x8b5e3c, 0x4a6a3a); tw++; }
  }
}

export function genDust(b: Builder) {
  const d = DISTRICTS.find((x) => x.id === 'dust')!;
  b.district = 'dust';
  const r = b.rng;
  const sand = [0xd9b88a, 0xcfa878, 0xe0c299, 0xc79d6d];
  let n = 0;
  for (let tries = 0; tries < 500 && n < 24; tries++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * d.r * 1.15;
    const x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
    const w = rand(r, 9, 15), dd = rand(r, 10, 15);
    if (!b.ok(x, z, w, dd, 5)) continue;
    const ruin = r() < 0.3;
    building(b, { x, z, w, d: dd, floors: r() < 0.4 ? 2 : 1, wall: pick(r, sand), trim: 0xa8855a, loot: 3, q: 0.95, doors: r() < 0.5 ? 'ns' : 'ew', roofAccess: !ruin, ruin, win: ruin ? 0 : 4.5, winColor: 0x3a3a44 });
    n++;
  }
  // factory complex
  const fx = d.x + 70, fz = d.z - 60;
  if (b.ok(fx, fz, 34, 24, 4)) building(b, { x: fx, z: fz, w: 34, d: 24, floors: 2, fh: 5, wall: 0x9a8a74, trim: 0x6b5a48, loot: 5, q: 1.1, doors: 'nsew', roofAccess: true });
  b.cyl(fx + 26, b.h(fx, fz) - 2, fz - 4, 3, 40, 0x7a6a58);
  // water tower
  const wx = d.x - 55, wz = d.z + 40;
  if (b.ok(wx, wz, 10, 10, 3, true)) {
    const gy = b.h(wx, wz);
    b.reserve(wx - 6, wz - 6, wx + 6, wz + 6);
    for (const [px, pz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.box(wx + px - 0.4, gy - 2, wz + pz - 0.4, wx + px + 0.4, gy + 12, wz + pz + 0.4, 0x6b5a48);
    b.cyl(wx, gy + 12, wz, 4.2, 5, 0x8a7a68, false); b.cone(wx, gy + 17, wz, 4.4, 4.4, 2.2, 0x6b5a48);
  }
  // wrecks and rock cover
  for (let k = 0; k < 22; k++) {
    const x = d.x + rand(r, -d.r * 1.4, d.r * 1.4), z = d.z + rand(r, -d.r * 1.4, d.r * 1.4);
    if (b.ok(x, z, 5, 5, 1)) b.car(x, z, b.h(x, z), pick(r, [0x7a5a3a, 0x9a8a6a, 0x5a4a3a]));
  }
  for (let k = 0; k < 14; k++) {
    const x = d.x + rand(r, -d.r * 1.5, d.r * 1.5), z = d.z + rand(r, -d.r * 1.5, d.r * 1.5);
    if (b.ok(x, z, 4, 4, 1)) { const y = b.h(x, z); b.box(x - 2, y - 1, z - 1.5, x + 2, y + 2.4, z + 1.5, 0xb59468); b.loot(x, y + 2.4, z, 1, -1, true); }
  }
}

export function genHarbor(b: Builder) {
  const d = DISTRICTS.find((x) => x.id === 'harbor')!;
  b.district = 'harbor';
  const r = b.rng;
  const gy = 2.55;
  // concrete quay + piers (sea to the east)
  const qx = d.x - 40;
  b.stamps.push({ x0: qx - 50, z0: d.z - 95, x1: qx + 60, z1: d.z + 95, y: 2.5, margin: 22 });
  b.decals.push({ x: d.x, z: d.z, w: 190, d: 200, color: '#868a92' });
  const piers = [-62, -8, 46];
  for (const pz of piers) {
    b.box(qx + 20, gy - 3.4, pz + d.z - 7, qx + 140, gy + 0.2, pz + d.z + 7, 0x8b8f98);
    b.reserve(qx + 20, pz + d.z - 7, qx + 140, pz + d.z + 7);
    b.decals.push({ x: qx + 80, z: pz + d.z, w: 120, d: 14, color: '#8b8f98' });
  }
  // ships docked between piers
  const shipCols = [0xb23a3a, 0x2b5f8a, 0x3a7a5a];
  [-35, 19].forEach((oz, si) => {
    const sx = qx + 85, sz = d.z + oz;
    const L = 64, Wd = 15;
    b.box(sx - L / 2, -6, sz - Wd / 2, sx + L / 2, 4.2, sz + Wd / 2, shipCols[si]);
    b.box(sx - L / 2 - 6, -6, sz - Wd / 4, sx - L / 2, 4.2, sz + Wd / 4, shipCols[si], true);
    b.box(sx - L / 2, 3.2, sz - Wd / 2, sx + L / 2, 4.6, sz + Wd / 2, 0x5a5f69);
    // cabin tower
    b.box(sx + L / 2 - 14, 4.6, sz - 5, sx + L / 2 - 4, 13, sz + 5, 0xe8edf2);
    b.box(sx + L / 2 - 12, 13, sz - 5.5, sx + L / 2 - 6, 15.5, sz + 5.5, 0x2d3748);
    b.win(sx + L / 2 - 14.05, 9, sz, 0.1, 1.4, 7, 0x9fe8ff);
    b.loot(sx + L / 2 - 9, 4.6, sz, 2, -1, true);
    // containers on deck
    for (let k = 0; k < 4; k++) b.container(sx - L / 2 + 10 + k * 13, sz - 3.6, true, pick(r, [0xc0392b, 0x2980b9, 0xf39c12, 0x27ae60]), 4.6, 1 + (k % 2));
    for (let k = 0; k < 3; k++) b.container(sx - L / 2 + 10 + k * 13, sz + 3.6, true, pick(r, [0xc0392b, 0x2980b9, 0xf39c12, 0x27ae60]), 4.6, 1);
    // gangway
    b.stairs(sx - 8, oz < 0 ? sz + Wd / 2 : sz - Wd / 2 - 0, sx - 5, oz < 0 ? sz + Wd / 2 : sz - Wd / 2, '+z', gy + 0.2, 4.6, 0x666b75, gy - 3);
  });
  // warehouses
  const wh: [number, number, number, number][] = [[-75, -62, 40, 22], [-75, -28, 40, 22], [-75, 18, 40, 22], [-75, 52, 40, 22]];
  for (const [ox, oz, w, dd] of wh) building(b, { x: d.x + ox + 10, z: d.z + oz, w, d: dd, floors: 1, fh: 6.5, wall: pick(r, [0x7a8aa0, 0x8a9a8a, 0x9a8a7a]), trim: 0x59606c, loot: 5, q: 1.3, doors: 'ew', doorW: 6, gy, noStamp: true, furn: false, roofAccess: false });
  // container yard
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
    const cx = d.x - 20 + col * 15, cz = d.z - 85 + row * 5.5;
    if (r() < 0.8) b.container(cx, cz, true, pick(r, [0xc0392b, 0x2980b9, 0xf39c12, 0x27ae60, 0x8e44ad, 0xecf0f1]), gy + 0.1, r() < 0.35 ? 2 : 1);
  }
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    const cx = d.x - 14 + col * 5.5, cz = d.z + 82 + row * 15;
    if (r() < 0.85 && cz < d.z + 100) b.container(cx, cz, false, pick(r, [0xc0392b, 0x2980b9, 0xf39c12, 0x27ae60, 0x8e44ad]), gy + 0.1, r() < 0.3 ? 2 : 1);
  }
  // office + cranes
  building(b, { x: d.x + 10, z: d.z - 62, w: 18, d: 14, floors: 2, wall: 0xcfd6dd, trim: 0x59606c, loot: 3, q: 1.3, doors: 'ns', roofAccess: true, gy, noStamp: true, win: 4, winColor: 0x9fe8ff });
  for (const cz of [-45, 8, 62]) {
    const cx = qx + 28;
    for (const [px, pz] of [[0, -6], [0, 6]]) b.box(cx + px - 0.9, gy, d.z + cz + pz - 0.9, cx + px + 0.9, gy + 30, d.z + cz + pz + 0.9, 0xe0a030);
    b.box(cx - 3, gy + 30, d.z + cz - 7, cx + 50, gy + 32, d.z + cz + 7, 0xe0a030, false);
    b.box(cx + 36, gy + 27, d.z + cz - 0.3, cx + 36.6, gy + 30, d.z + cz + 0.3, 0x333333, false);
  }
  for (let k = 0; k < 20; k++) {
    const x = d.x + rand(r, -90, 40), z = d.z + rand(r, -90, 90);
    if (b.ok(x, z, 4, 4, 0.5, true)) { b.box(x - 1.1, gy, z - 1.1, x + 1.1, gy + 1.4, z + 1.1, 0x8b6a3a); b.loot(x, gy + 1.4, z, 1.3, -1, true); }
  }
}

export function genPower(b: Builder) {
  const d = DISTRICTS.find((x) => x.id === 'power')!;
  b.district = 'power';
  const r = b.rng;
  const gy = b.h(d.x, d.z);
  b.stamps.push({ x0: d.x - 115, z0: d.z - 95, x1: d.x + 115, z1: d.z + 95, y: gy, margin: 25 });
  b.decals.push({ x: d.x, z: d.z, w: 250, d: 210, color: '#848a84' });
  // cooling towers
  for (let i = 0; i < 3; i++) {
    const cx = d.x - 70 + i * 48, cz = d.z - 62;
    b.cyl(cx, gy - 1, cz, 17, 52, 0xb9bdb8); b.cyl(cx, gy + 51, cz, 14, 3, 0x8c908c, false);
    b.reserve(cx - 19, cz - 19, cx + 19, cz + 19);
    for (let k = 0; k < 3; k++) b.cone(cx + k * 2, gy + 54 + k * 6, cz, 7 - k, 7 - k, 7, 0xffffff);
    b.loot(cx, gy, cz + 20, 1.6, -1, true);
  }
  // turbine hall - two levels
  building(b, { x: d.x - 20, z: d.z + 10, w: 60, d: 32, floors: 2, fh: 6, wall: 0x7b8896, trim: 0x4b5563, loot: 7, q: 1.7, doors: 'nsew', doorW: 4, gy, noStamp: true, roofAccess: true, win: 5, winColor: 0xffe08a });
  building(b, { x: d.x + 45, z: d.z + 12, w: 22, d: 26, floors: 3, wall: 0xaab4bd, trim: 0x59606c, loot: 5, q: 1.5, doors: 'nsew', gy, noStamp: true, roofAccess: true, win: 4, winColor: 0xa0ffd0 });
  for (const [ox, oz] of [[-80, 55], [-45, 60], [60, -50]]) building(b, { x: d.x + ox, z: d.z + oz, w: 28, d: 22, floors: 1, fh: 7, wall: 0x8a9a8f, trim: 0x59606c, loot: 5, q: 1.5, doors: 'ns', gy, noStamp: true, furn: false, roofAccess: false });
  // smokestacks
  for (const [ox, oz] of [[60, -10], [75, 28]]) { b.cyl(d.x + ox, gy - 1, d.z + oz, 3.2, 72, 0x9a6a5a); b.cyl(d.x + ox, gy + 60, d.z + oz, 3.3, 3, 0xdddddd, false); }
  // storage tanks
  for (let i = 0; i < 3; i++) { const tx = d.x + 40 + i * 22, tz = d.z + 68; b.cyl(tx, gy, tz, 8, 11, 0xd4d8d0); b.reserve(tx - 9, tz - 9, tx + 9, tz + 9); }
  // elevated catwalk + pipes
  deckStructure(b, d.x - 90, d.z - 20, d.x - 52, d.z - 8, gy + 6.5, 0x7a8590, gy, '+z');
  b.box(d.x - 100, gy + 3, d.z + 85, d.x + 100, gy + 4.4, d.z + 86.4, 0x9a7a4a, false);
  for (let x = -96; x <= 96; x += 24) b.box(d.x + x - 0.4, gy, d.z + 85, d.x + x + 0.4, gy + 3, d.z + 85.8, 0x59606c);
  // transformer yard
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
    const tx = d.x + 70 + i * 8 - 40, tz = d.z - 90 + j * 9 + 120;
    if (tz < d.z + 95 && b.ok(tx, tz, 4, 4, 0.5, true)) { b.box(tx - 1.2, gy, tz - 1.2, tx + 1.2, gy + 3, tz + 1.2, 0x6f7a6a); b.win(tx, gy + 2.2, tz + 1.25, 1.4, 0.3, 0.05, 0xffee66); }
  }
  // pylons
  for (let i = 0; i < 5; i++) { const px = d.x - 100 + i * 50, pz = d.z + 105; b.box(px - 0.5, gy - 2, pz - 0.5, px + 0.5, gy + 28, pz + 0.5, 0x777777); b.box(px - 6, gy + 24, pz - 0.3, px + 6, gy + 25, pz + 0.3, 0x777777, false); b.reserve(px - 2, pz - 2, px + 2, pz + 2); }
  for (let k = 0; k < 14; k++) { const x = d.x + rand(r, -100, 100), z = d.z + rand(r, -80, 85); if (b.ok(x, z, 4, 3, 0.5, true)) { b.box(x - 1.5, gy, z - 1, x + 1.5, gy + 1.5, z + 1, 0x8a6a3a); b.loot(x, gy + 1.5, z, 1.5, -1, true); } }
}

export function genFrost(b: Builder) {
  const d = DISTRICTS.find((x) => x.id === 'frost')!;
  b.district = 'frost';
  const r = b.rng;
  let n = 0;
  for (let tries = 0; tries < 400 && n < 11; tries++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 85;
    const x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
    const w = rand(r, 9, 13), dd = rand(r, 10, 14);
    if (!b.ok(x, z, w, dd, 5)) continue;
    building(b, { x, z, w, d: dd, floors: r() < 0.3 ? 2 : 1, wall: pick(r, [0x9a8a7a, 0x8a7a6a, 0xb0a090]), trim: 0x6a5a4a, roof: 'pitch', roofColor: 0xf2f6fa, loot: 3, q: 1.15, doors: 'ns', win: 4.5, winColor: 0xffd890 });
    n++;
  }
  // observation towers on the highest ground near the village
  const peaks: [number, number, number][] = [];
  for (let x = d.x - 190; x <= d.x + 260; x += 12) for (let z = d.z - 120; z <= d.z + 90; z += 12) {
    const h = b.h(x, z);
    if (h > 55 && b.ok(x, z, 8, 8, 10)) peaks.push([x, z, h]);
  }
  peaks.sort((p, q) => q[2] - p[2]);
  const chosen: [number, number, number][] = [];
  for (const p of peaks) { if (chosen.every((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) > 70)) chosen.push(p); if (chosen.length >= 3) break; }
  for (const p of chosen) if (b.ok(p[0], p[1], 8, 8, 10)) watchtower(b, p[0], p[1], 8, 0x8a9098, 0xf2f6fa);
  // mountain tunnel (road shelter) west of village
  const tx = d.x + 5, tz = d.z + 150;
  const gy = b.h(tx, tz);
  b.reserve(tx - 8, tz - 28, tx + 8, tz + 28);
  b.stamps.push({ x0: tx - 7, z0: tz - 26, x1: tx + 7, z1: tz + 26, y: gy, margin: 8 });
  b.box(tx - 7, gy - 3, tz - 25, tx + 7, gy + 0.2, tz + 25, 0x5a5f69);
  b.box(tx - 7, gy, tz - 25, tx - 5.8, gy + 6, tz + 25, 0x9aa0a8);
  b.box(tx + 5.8, gy, tz - 25, tx + 7, gy + 6, tz + 25, 0x9aa0a8);
  b.box(tx - 7, gy + 5.2, tz - 25, tx + 7, gy + 6.6, tz + 25, 0x9aa0a8);
  b.box(tx - 8, gy + 6.6, tz - 26, tx + 8, gy + 8.2, tz + 26, 0xf2f6fa, false);
  for (let z = -20; z <= 20; z += 10) b.win(tx, gy + 4.8, tz + z, 1, 0.2, 1, 0xffe9a8);
  b.loot(tx, gy + 0.2, tz - 8, 1.3, -1, true); b.loot(tx, gy + 0.2, tz + 8, 1.3, -1, true);
  b.decals.push({ x: tx, z: tz, w: 14, d: 54, color: '#4a4f5a' });
}

export function genResort(b: Builder) {
  const d = DISTRICTS.find((x) => x.id === 'resort')!;
  b.district = 'resort';
  const r = b.rng;
  const gy = 2.7;
  b.decals.push({ x: d.x, z: d.z, w: 200, d: 200, color: '#efe2bd', round: true });
  // hotels
  const hot: [number, number, number, number, number][] = [[-35, -30, 32, 24, 6], [40, -20, 28, 22, 5]];
  for (const [ox, oz, w, dd, fl] of hot) {
    const x = d.x + ox, z = d.z + oz;
    if (b.ok(x, z, w, dd, 6, true)) building(b, { x, z, w, d: dd, floors: fl, wall: 0xfbe8d0, trim: 0xe0a070, loot: 4, q: 1, doors: 'nsew', roofAccess: true, win: 3.4, winColor: 0xffd18a, awning: 0xff7a59 });
  }
  // swimming pool
  const px = d.x, pz = d.z + 40;
  b.stamps.push({ x0: px - 14, z0: pz - 6, x1: px + 14, z1: pz + 6, y: gy - 1.3, margin: 0.6 });
  b.reserve(px - 17, pz - 9, px + 17, pz + 9);
  b.decals.push({ x: px, z: pz, w: 36, d: 20, color: '#f7f1dc' });
  b.decals.push({ x: px, z: pz, w: 28, d: 12, color: '#31c6e6' });
  b.box(px - 14, gy - 1.2, pz - 6, px + 14, gy - 0.9, pz + 6, 0x5ad8f0, false);
  // beach houses
  let n = 0;
  for (let tries = 0; tries < 300 && n < 9; tries++) {
    const a = r() * Math.PI * 2, rr = 40 + r() * 100;
    const x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
    if (!b.ok(x, z, 10, 11, 6)) continue;
    building(b, { x, z, w: 10, d: 11, floors: 1, wall: pick(r, [0xf7b7c4, 0xa8e0f0, 0xfce8a0, 0xb8f0c8]), trim: 0xe8d8b0, roof: 'pitch', roofColor: pick(r, [0xe8604c, 0x3b9ac4, 0xf0a030]), loot: 3, q: 0.95, doors: 'ns', win: 4, winColor: 0xffe0a0 });
    n++;
  }
  // umbrellas + lifeguard towers
  for (let k = 0; k < 18; k++) {
    const a = r() * Math.PI * 2, rr = 60 + r() * 100;
    const x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
    const h = b.h(x, z);
    if (h > 1.3 && h < 3.5 && b.ok(x, z, 3, 3, 1, true)) { b.cyl(x, h, z, 0.1, 2.4, 0xeeeeee, false); b.cone(x, h + 2.2, z, 1.8, 1.8, 0.6, pick(r, [0xff5a7a, 0x38bdf8, 0xfacc15, 0xffffff])); }
  }
  let lg = 0;
  for (let tries = 0; tries < 80 && lg < 2; tries++) {
    const a = r() * Math.PI * 2, rr = 100 + r() * 50;
    const x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
    const h = b.h(x, z);
    if (h > 1.5 && h < 3 && b.ok(x, z, 6, 12, 4, true)) { b.reserve(x - 4, z - 4, x + 4, z + 10); watchtower(b, x, z, 5, 0xf0f0f0, 0xff5a5a, h); lg++; }
  }
  // volleyball net + boardwalk deck
  const bx = d.x + 15, bz = d.z + 95;
  if (b.h(bx, bz) > 1.4) { b.box(bx - 5, b.h(bx, bz), bz - 0.1, bx + 5, b.h(bx, bz) + 2.2, bz + 0.1, 0xffffff, false); b.decals.push({ x: bx, z: bz, w: 20, d: 12, color: '#f6e6a8' }); }
  for (let k = 0; k < 12; k++) {
    const x = d.x + rand(r, -90, 90), z = d.z + rand(r, -90, 90);
    if (b.ok(x, z, 4, 3, 0.5, true)) { const h = b.h(x, z); b.box(x - 1.2, h, z - 0.8, x + 1.2, h + 1.1, z + 0.8, 0xb98a5a); b.loot(x, h + 1.1, z, 1, -1, true); }
  }
}

export function genVehicles(b: Builder) {
  const r = b.rng;
  const pts: { x: number; z: number; yaw: number }[] = [];
  for (const road of ROADS) for (let i = 0; i < road.pts.length - 1; i++) {
    const [ax, az] = road.pts[i], [bx, bz] = road.pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 20) continue;
    const t = rand(r, 0.2, 0.8);
    const x = ax + (bx - ax) * t + (az - bz) / L * 2, z = az + (bz - az) * t + (bx - ax) / L * 2;
    if (b.h(x, z) > 1.5) pts.push({ x, z, yaw: Math.atan2(bx - ax, bz - az) });
  }
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  b.district = '';
  return pts.slice(0, 26);
}

export { clamp };
