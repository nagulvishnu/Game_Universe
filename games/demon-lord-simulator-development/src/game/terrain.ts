import * as THREE from 'three';
import { REGIONS, TERRITORIES, type RegionId } from './data';

export const MESH_SIZE = 1500;
export const MAX_R = 690;
const SECT = REGIONS.filter((r) => r.id !== 'capital');
const SECT_IDS = SECT.map((s) => s.id);

const hash = (ix: number, iz: number) => {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
};
export const vnoise = (x: number, z: number) => {
  const ix = Math.floor(x), iz = Math.floor(z); let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
};
export const fbm = (x: number, z: number, oct = 4) => {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x, z) * a; n += a; a *= 0.5; x *= 2.03; z *= 2.03; }
  return s / n;
};
const ridge = (x: number, z: number, oct = 4) => {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += (1 - Math.abs(vnoise(x, z) * 2 - 1)) * a; n += a; a *= 0.5; x *= 2.1; z *= 2.1; }
  return s / n;
};
export const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const W = new Float32Array(9);
export function regionWeights(x: number, z: number, out: Float32Array = W) {
  const a = Math.atan2(z, x), r = Math.hypot(x, z);
  let sum = 0;
  for (let i = 0; i < 8; i++) { const w = Math.exp(10 * (Math.cos(a - SECT[i].angle) - 1)); out[i] = w; sum += w; }
  const cap = 1 - sstep(140, 235, r);
  for (let i = 0; i < 8; i++) out[i] = (out[i] / sum) * (1 - cap);
  out[8] = cap;
  return out;
}

const SEC_H: Record<string, (x: number, z: number, r: number) => number> = {
  bloodfire: (x, z) => { let h = 8 + fbm(x * 0.01, z * 0.01, 4) * 16 + ridge(x * 0.02, z * 0.02, 3) * 8; const c = Math.abs(fbm(x * 0.008 + 50, z * 0.008 + 50, 3) - 0.5); h = lerp(h, -7, sstep(0.032, 0.012, c)); return h; },
  human: (x, z) => 4 + fbm(x * 0.006, z * 0.006, 4) * 10,
  shadow: (x, z) => 4 + fbm(x * 0.008, z * 0.008, 4) * 11,
  ruins: (x, z) => 5 + fbm(x * 0.007, z * 0.007, 4) * 12 + (vnoise(x * 0.02, z * 0.02) > 0.72 ? 6 : 0),
  ocean: (x, z) => -44 + fbm(x * 0.01, z * 0.01, 4) * 12,
  dragon: (x, z) => 28 + ridge(x * 0.006, z * 0.006, 5) * 160 + fbm(x * 0.02, z * 0.02, 3) * 10,
  frozen: (x, z) => 14 + ridge(x * 0.008, z * 0.008, 4) * 60 + fbm(x * 0.03, z * 0.03, 3) * 6,
  celestial: (x, z, r) => { const k = sstep(300, 380, r); return 8 + k * 100 + fbm(x * 0.01, z * 0.01, 3) * 5 * (0.3 + k); },
};

const flats: { x: number; z: number; r: number; h: number }[] = [];
let flatsReady = false;
function rawHeight(x: number, z: number) {
  const w = regionWeights(x, z); const r = Math.hypot(x, z); let h = 0;
  for (let i = 0; i < 8; i++) if (w[i] > 0.01) h += w[i] * SEC_H[SECT_IDS[i]](x, z, r);
  h /= Math.max(0.0001, 1 - w[8] * 0 - w[8] + w[8] * 0 || 1) || 1;
  return h;
}
export function terrainHeight(x: number, z: number): number {
  if (!flatsReady) initFlats();
  const w = regionWeights(x, z); const r = Math.hypot(x, z);
  let h = 0, ws = 0;
  for (let i = 0; i < 8; i++) if (w[i] > 0.01) { h += w[i] * SEC_H[SECT_IDS[i]](x, z, r); ws += w[i]; }
  h = ws > 0 ? h / ws : 0;
  h = h * (1 - w[8]);
  for (let i = 0; i < flats.length; i++) {
    const f = flats[i]; const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 2.1) h = lerp(h, f.h, 1 - sstep(f.r, f.r * 2.1, d));
  }
  if (r > MAX_R) h += (r - MAX_R) * 4;
  return h;
}
function initFlats() {
  flatsReady = true;
  for (const t of TERRITORIES) {
    if (t.id === 'capital') continue;
    const r = Math.hypot(t.x, t.z); const w = regionWeights(t.x, t.z); let h = 0, ws = 0;
    for (let i = 0; i < 8; i++) if (w[i] > 0.01) { h += w[i] * SEC_H[SECT_IDS[i]](t.x, t.z, r); ws += w[i]; }
    h /= ws || 1;
    flats.push({ x: t.x, z: t.z, r: t.flatR, h: t.region === 'ocean' ? h : Math.max(3, h) });
  }
  void rawHeight;
}
export const flatOf = (x: number, z: number) => terrainHeight(x, z);

export function regionAt(x: number, z: number): RegionId {
  const w = regionWeights(x, z); let bi = 8, bw = w[8];
  for (let i = 0; i < 8; i++) if (w[i] > bw) { bw = w[i]; bi = i; }
  return bi === 8 ? 'capital' : SECT_IDS[bi];
}
export const inWater = (x: number, y: number, z: number) => y < 0 && x < -100 && terrainHeight(x, z) < -0.4;
export const WATER_Y = 0;

// ---- dungeon (below capital) ----
export const DUNGEON = { y: -90, hx: 62, hz: 62, x: 0, z: 0 };
export function groundAt(x: number, y: number, z: number) { return y < -40 ? DUNGEON.y : terrainHeight(x, z); }

// ---- colliders ----
export interface Collider { x: number; z: number; r: number; hx: number; hz: number; c: number; s: number; box: boolean; y0: number; y1: number; dead?: boolean }
const CELL = 48; const grid = new Map<number, Collider[]>();
const key = (cx: number, cz: number) => (cx + 100) * 512 + (cz + 100);
function reg(c: Collider, br: number) {
  const x0 = Math.floor((c.x - br) / CELL), x1 = Math.floor((c.x + br) / CELL), z0 = Math.floor((c.z - br) / CELL), z1 = Math.floor((c.z + br) / CELL);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(c); }
}
export function addCircle(x: number, z: number, r: number, y1: number, y0 = -1e5) { const c: Collider = { x, z, r, hx: 0, hz: 0, c: 1, s: 0, box: false, y0, y1 }; reg(c, r); return c; }
export function addBox(x: number, z: number, hx: number, hz: number, rot: number, y1: number, y0 = -1e5) { const c: Collider = { x, z, r: 0, hx, hz, c: Math.cos(rot), s: -Math.sin(rot), box: true, y0, y1 }; reg(c, Math.hypot(hx, hz)); return c; }
export function resetColliders() { grid.clear(); }

export function resolve(p: THREE.Vector3, radius: number, height = 1.9): boolean {
  let hit = false; const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
  for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
    const a = grid.get(key(i, j)); if (!a) continue;
    for (let n = 0; n < a.length; n++) {
      const c = a[n]; if (c.dead || p.y + height < c.y0 || p.y > c.y1 - 0.4) continue;
      if (!c.box) {
        const dx = p.x - c.x, dz = p.z - c.z, m = c.r + radius, d2 = dx * dx + dz * dz;
        if (d2 < m * m) { const d = Math.sqrt(d2) || 0.001; p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; hit = true; }
      } else {
        const dx = p.x - c.x, dz = p.z - c.z; const lx = dx * c.c + dz * c.s, lz = -dx * c.s + dz * c.c;
        const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
        let nx = lx - qx, nz = lz - qz; const d2 = nx * nx + nz * nz;
        if (d2 < radius * radius) {
          let px: number, pz: number;
          if (d2 > 1e-6) { const d = Math.sqrt(d2); px = qx + (nx / d) * radius; pz = qz + (nz / d) * radius; }
          else { const ox = c.hx - Math.abs(lx), oz = c.hz - Math.abs(lz); if (ox < oz) { px = Math.sign(lx || 1) * (c.hx + radius); pz = lz; } else { px = lx; pz = Math.sign(lz || 1) * (c.hz + radius); } }
          nx = px; nz = pz; p.x = c.x + nx * c.c - nz * c.s; p.z = c.z + nx * c.s + nz * c.c; hit = true;
        }
      }
    }
  }
  return hit;
}
export function pointBlocked(x: number, y: number, z: number, pad = 0.3): boolean {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); const a = grid.get(key(cx, cz)); if (!a) return false;
  for (let n = 0; n < a.length; n++) {
    const c = a[n]; if (c.dead || y < c.y0 - pad || y > c.y1 + pad) continue;
    if (!c.box) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + pad) * (c.r + pad)) return true; }
    else { const dx = x - c.x, dz = z - c.z; const lx = dx * c.c + dz * c.s, lz = -dx * c.s + dz * c.c; if (Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad) return true; }
  }
  return false;
}
/** returns fraction [0,1] of segment a->b that is free (camera collision) */
export function rayFree(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const N = 14;
  for (let i = 1; i <= N; i++) {
    const t = i / N, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
    if (pointBlocked(x, y, z, 0.5) || (y < DUNGEON.y + 0.3 && ay < -40) || (ay > -40 && y < terrainHeight(x, z) + 0.4)) return Math.max(0, (i - 1) / N);
  }
  return 1;
}

// ---- mesh ----
type RGB = [number, number, number];
const hex = (h: string): RGB => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const PAL: Record<string, [RGB, RGB]> = {
  capital: [hex('#2a2430'), hex('#3a3040')], bloodfire: [hex('#3a1e16'), hex('#6a2c18')], human: [hex('#4a7a38'), hex('#6a9a48')], shadow: [hex('#1c2a28'), hex('#2a1a3a')],
  ruins: [hex('#9a8460'), hex('#7a6a4a')], ocean: [hex('#3a5a62'), hex('#2a4558')], dragon: [hex('#5a544c'), hex('#4a5c38')], frozen: [hex('#dfeaf5'), hex('#a8d0ee')], celestial: [hex('#e8e4d8'), hex('#f0e0b0')],
};
const ROCK = hex('#5a5550'), SNOW = hex('#f0f6ff'), SAND = hex('#b8a878'), LAVA = hex('#ff5a10'), DARKC = hex('#140806');

export function buildTerrain(): THREE.Mesh {
  const seg = 300; const g = new THREE.PlaneGeometry(MESH_SIZE, MESH_SIZE, seg, seg); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute; const n = pos.count; const col = new Float32Array(n * 3);
  const hs = new Float32Array(n);
  for (let i = 0; i < n; i++) { hs[i] = terrainHeight(pos.getX(i), pos.getZ(i)); pos.setY(i, hs[i]); }
  const row = seg + 1; const cell = MESH_SIZE / seg; const w = new Float32Array(9);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = hs[i]; const ix = i % row, iz = Math.floor(i / row);
    const hx = hs[Math.min(row - 1, ix + 1) + iz * row] - hs[Math.max(0, ix - 1) + iz * row]; const hz = hs[ix + Math.min(row - 1, iz + 1) * row] - hs[ix + Math.max(0, iz - 1) * row];
    const slope = Math.hypot(hx, hz) / (2 * cell);
    regionWeights(x, z, w); let r = 0, gg = 0, b = 0;
    const nz = fbm(x * 0.05, z * 0.05, 3);
    for (let k = 0; k < 9; k++) {
      if (w[k] < 0.01) continue; const id = k === 8 ? 'capital' : SECT_IDS[k]; const [c1, c2] = PAL[id]; const t = nz;
      let cr = lerp(c1[0], c2[0], t), cg = lerp(c1[1], c2[1], t), cb = lerp(c1[2], c2[2], t);
      const rk = sstep(0.55, 1.0, slope); cr = lerp(cr, ROCK[0], rk * (id === 'frozen' ? 0.6 : 0.85)); cg = lerp(cg, ROCK[1], rk * (id === 'frozen' ? 0.6 : 0.85)); cb = lerp(cb, ROCK[2], rk * (id === 'frozen' ? 0.6 : 0.85));
      if (id === 'dragon' || id === 'frozen') { const sn = sstep(70, 110, h + nz * 14) * (1 - sstep(0.8, 1.4, slope)); cr = lerp(cr, SNOW[0], sn); cg = lerp(cg, SNOW[1], sn); cb = lerp(cb, SNOW[2], sn); }
      if (id === 'bloodfire' && h < -0.5) { const l = sstep(-6, -1, h) * 0.9; cr = lerp(LAVA[0], DARKC[0], l); cg = lerp(LAVA[1], DARKC[1], l); cb = lerp(LAVA[2], DARKC[2], l); }
      if (id === 'celestial' && h < 60) { cr = lerp(cr, 0.55, 0.6); cg = lerp(cg, 0.55, 0.6); cb = lerp(cb, 0.58, 0.6); }
      if (h < 2.5 && h > -12) { const sd = 1 - sstep(-1, 3, h); cr = lerp(cr, SAND[0], sd * 0.8); cg = lerp(cg, SAND[1], sd * 0.8); cb = lerp(cb, SAND[2], sd * 0.8); }
      if (id === 'capital') { const cob = (Math.floor(x / 3) + Math.floor(z / 3)) & 1 ? 0.88 : 1; cr *= cob; cg *= cob; cb *= cob; }
      r += cr * w[k]; gg += cg * w[k]; b += cb * w[k];
    }
    const shade = 0.85 + nz * 0.3;
    col[i * 3] = r * shade; col[i * 3 + 1] = gg * shade; col[i * 3 + 2] = b * shade;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d')!; const id = cx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const v = 190 + Math.random() * 65; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  cx.putImageData(id, 0, 0); const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(260, 260); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.95, metalness: 0 }));
  m.receiveShadow = true; return m;
}
