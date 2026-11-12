import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BLOCK, FACILITIES, REGIONS, REGION_SIZE, ROAD_W, WORLD_OFF, regionCenter, type Region } from './data';
import { G, V3, clamp, seeded, type Enterable, type Interactable, type Vec } from './runtime';
import { VTYPES } from './vehicles';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ collision â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; tag?: string; s?: number }
const CELL = 40; const grid = new Map<number, Box[]>(); const allBoxes: Box[] = [];
const ck = (cx: number, cz: number) => cx * 100003 + cz;
export function addBox(b: Box) {
  allBoxes.push(b);
  for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++) for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) { const k = ck(cx, cz); let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(b); }
}
export function clearBoxes() { grid.clear(); allBoxes.length = 0; }
export function removeBoxes(tag: string) {
  for (const a of grid.values()) for (let i = a.length - 1; i >= 0; i--) if (a[i].tag === tag) a.splice(i, 1);
  for (let i = allBoxes.length - 1; i >= 0; i--) if (allBoxes[i].tag === tag) allBoxes.splice(i, 1);
}
let stamp = 0; const qOut: Box[] = [];
export function query(x: number, z: number, r: number): Box[] {
  stamp++; qOut.length = 0;
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
    const a = grid.get(ck(cx, cz)); if (!a) continue; for (const b of a) if (b.s !== stamp) { b.s = stamp; qOut.push(b); }
  }
  return qOut;
}
export const lastN = { x: 0, z: 0 };
export function collide(p: Vec, vel: Vec | null, r: number, h: number, base: number) {
  let ground = base, hit = false, ceil = false;
  for (const b of query(p.x, p.z, r + 1)) {
    if (p.x < b.x0 - r || p.x > b.x1 + r || p.z < b.z0 - r || p.z > b.z1 + r) continue;
    const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1); const dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
    const inside = p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
    if (!inside && d2 >= r * r) continue;
    if (p.y >= b.y1 - 0.55) { if (b.y1 > ground) ground = b.y1; continue; }
    if (p.y + h <= b.y0 + 0.02) continue;
    if (vel && vel.y > 0 && p.y + h > b.y0 && p.y + h < b.y0 + 0.45 && p.y < b.y0) { p.y = b.y0 - h; vel.y = 0; ceil = true; continue; }
    let nx = 0, nz = 0;
    if (inside) {
      const pl = p.x - b.x0, pr = b.x1 - p.x, pb = p.z - b.z0, pf = b.z1 - p.z; const m = Math.min(pl, pr, pb, pf);
      if (m === pl) { p.x = b.x0 - r; nx = -1; } else if (m === pr) { p.x = b.x1 + r; nx = 1; } else if (m === pb) { p.z = b.z0 - r; nz = -1; } else { p.z = b.z1 + r; nz = 1; }
    } else { const d = Math.sqrt(d2) || 0.0001; nx = dx / d; nz = dz / d; p.x = cx + nx * (r + 0.001); p.z = cz + nz * (r + 0.001); }
    if (vel) { const vn = vel.x * nx + vel.z * nz; if (vn < 0) { vel.x -= nx * vn; vel.z -= nz * vn; } }
    lastN.x = nx; lastN.z = nz; hit = true;
  }
  return { ground, hit, ceil };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ textures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TILE = 16;
let winTex: { map: THREE.CanvasTexture; emi: THREE.CanvasTexture } | null = null;
export function windowTextures() {
  if (winTex) return winTex;
  const mk = (lit: boolean) => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
    g.fillStyle = lit ? '#000' : '#ffffff'; g.fillRect(0, 0, 256, 256); const rng = seeded(7);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 64 + 14, y = j * 64 + 12;
      if (lit) { const r = rng(); if (r < 0.62) { g.fillStyle = r < 0.18 ? '#ff7ad9' : r < 0.36 ? '#75eaff' : r < 0.49 ? '#ffd9a0' : r < 0.56 ? '#bfe3ff' : '#ffb27a'; g.fillRect(x + 2, y + 2, 32, 38); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x + 3, y + 3, 3, 36); } }
      else { const gr = g.createLinearGradient(x, y, x + 36, y + 44); gr.addColorStop(0, '#223046'); gr.addColorStop(0.5, '#3f5576'); gr.addColorStop(1, '#16202e'); g.fillStyle = '#6b7384'; g.fillRect(x - 3, y - 3, 42, 50); g.fillStyle = gr; g.fillRect(x, y, 36, 44); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, 10, 44); }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = lit ? THREE.SRGBColorSpace : THREE.SRGBColorSpace; return t;
  };
  winTex = { map: mk(false), emi: mk(true) }; return winTex;
}
const SIGNS = ['RAMEN', 'HERO MART', 'NOVA BANK', 'CLUB 9', 'PHARMA+', 'ARCADE', 'PIZZA', 'HOTEL', 'NEON BAR', 'CYBER CAFE', 'BOOKS', 'SUSHI', 'CINEMA', 'GYM', 'TECH', 'NOODLE', 'KARAOKE', 'BAKERY', 'SPORTS', 'TOKYO', 'DRAGON', 'LUCKY', 'GOLD', 'DINER', 'MOTEL', 'TATTOO', 'VIDEO', 'STEAK', 'ZEN', 'MEGA', 'ROXY', 'OMEGA'];
const SCOL = ['#ff2e57', '#00e5ff', '#ffd23f', '#ff7ad9', '#7dff4d', '#a855f7', '#ff8a3c', '#4aa3ff'];
let signTex: THREE.CanvasTexture | null = null;
export function getSignTex() {
  if (signTex) return signTex; const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d')!; g.fillStyle = '#05050a'; g.fillRect(0, 0, 1024, 512);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  SIGNS.forEach((s, i) => { const x = (i % 4) * 256, y = Math.floor(i / 4) * 64; const col = SCOL[i % SCOL.length]; g.fillStyle = 'rgba(4,6,14,0.82)'; g.fillRect(x + 4, y + 4, 248, 56); g.shadowColor = col; g.shadowBlur = 14; g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(x + 5, y + 5, 246, 54); g.fillStyle = col; g.font = 'bold 34px Impact, Arial Black, sans-serif'; g.fillText(s, x + 128, y + 34); g.shadowBlur = 0; });
  signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace; return signTex;
}
const labelCache = new Map<string, THREE.CanvasTexture>();
export function labelTex(text: string, color = '#ffffff', bg = 'rgba(0,0,0,0.55)') {
  const k = text + color; let t = labelCache.get(k); if (t) return t;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d')!; g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, 504, 120, 20); g.fill(); g.strokeStyle = color; g.lineWidth = 4; g.stroke();
  g.fillStyle = color; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68, 480); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; labelCache.set(k, t); return t;
}
export function regionTexture(r: Region, size: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d')!; const k = size / REGION_SIZE; const rng = seeded(r.gx * 31 + r.gy * 7 + 3);
  const road = r.road; g.fillStyle = road; g.fillRect(0, 0, size, size);
  const nb = REGION_SIZE / BLOCK; const park = isPark;
  for (let bx = 0; bx < nb; bx++) for (let bz = 0; bz < nb; bz++) {
    const x0 = (bx * BLOCK + ROAD_W / 2) * k, z0 = (bz * BLOCK + ROAD_W / 2) * k, w = (BLOCK - ROAD_W) * k;
    g.fillStyle = '#7d818c'; g.fillRect(x0, z0, w, w);
    const inset = 3 * k; g.fillStyle = park(r, bx, bz) ? '#2f6b3a' : r.ground; g.fillRect(x0 + inset, z0 + inset, w - inset * 2, w - inset * 2);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${rng() > 0.5 ? 255 : 0},${rng() > 0.5 ? 255 : 0},${rng() > 0.5 ? 255 : 0},0.025)`; g.fillRect(x0 + rng() * w, z0 + rng() * w, rng() * 30 * k, rng() * 30 * k); }
  }
  // Subtle district-colored curb glow gives the street grid a readable neon edge at night.
  g.fillStyle = r.accent; g.globalAlpha = 0.18;
  for (let i = 0; i <= nb; i++) {
    const p = i * BLOCK;
    g.fillRect((p - ROAD_W / 2 - 0.8) * k, 0, 1.1 * k, size);
    g.fillRect(0, (p - ROAD_W / 2 - 0.8) * k, size, 1.1 * k);
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i <= nb; i++) for (let s = 0; s < REGION_SIZE; s += 10) {
    const p = i * BLOCK; const ins = ((s % BLOCK) < ROAD_W / 2 + 2 || (s % BLOCK) > BLOCK - ROAD_W / 2 - 2);
    if (ins) { // crosswalk stripes at intersections
      continue;
    }
    g.fillRect((p - 0.25) * k, s * k, 0.5 * k, 5 * k); g.fillRect(s * k, (p - 0.25) * k, 5 * k, 0.5 * k);
  }
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i <= nb; i++) for (let j = 0; j <= nb; j++) for (let q = -1; q <= 1; q += 2) {
    const cx = i * BLOCK, cz = j * BLOCK; for (let s = -6; s <= 6; s += 2) { g.fillRect((cx + s) * k, (cz + q * 9.5) * k, 1 * k, 2.6 * k); g.fillRect((cx + q * 9.5) * k, (cz + s) * k, 2.6 * k, 1 * k); }
  }
  if (r.theme === 'island') { // carve circular land, alpha 0 water outside
    const img = g.getImageData(0, 0, size, size); const d = img.data; const c0 = size / 2; const R = 150 * k; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const dd = Math.hypot(x - c0, y - c0); const i = (y * size + x) * 4; if (dd > R) d[i + 3] = 0; else if (dd > R - 12 * k) { d[i] = 220; d[i + 1] = 200; d[i + 2] = 140; } }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function isPark(r: Region, bx: number, bz: number) { return (r.theme === 'metro' && ((bx === 3 && bz === 1) || (bx === 1 && bz === 3) || (bx === 3 && bz === 3))) || (r.theme === 'capital' && bx === 1 && bz === 3) || (r.theme === 'martial' && (bx === 1 && bz === 1 || bx === 3 && bz === 3)) || (r.theme === 'island' && (bx + bz) % 2 === 0) || (r.theme === 'mountain' && (bx + bz) % 2 === 0) || (r.theme === 'research' && bx === 3 && bz === 3); }

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ themes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Theme { h: [number, number]; colors: string[]; sign: number; wide?: boolean; pagoda?: boolean; dome?: boolean; stacks?: boolean; sparse?: number }
const THEMES: Record<string, Theme> = {
  metro: { h: [14, 80], colors: ['#4a5568', '#5b6477', '#3f4658', '#6b7280', '#2f3b52', '#59627a'], sign: 0.6 },
  industrial: { h: [9, 18], colors: ['#6b6258', '#7a6e60', '#554f48', '#8a7b65'], sign: 0.1, wide: true, stacks: true },
  capital: { h: [30, 130], colors: ['#d9dee6', '#c9d1dc', '#e8ecf2', '#bfc9d9'], sign: 0.3 },
  shadow: { h: [10, 46], colors: ['#2a1f3d', '#1d1530', '#33264a', '#241a38'], sign: 0.9 },
  martial: { h: [7, 14], colors: ['#7a3b2e', '#5c3a2a', '#8a5a3a', '#6b2f2f'], sign: 0.2, pagoda: true },
  research: { h: [14, 50], colors: ['#cfe6ef', '#aac8d6', '#e6f1f6', '#9ab7c9'], sign: 0.1, dome: true },
  mountain: { h: [6, 12], colors: ['#6b5a4a', '#5a4a3a', '#7a6a5a'], sign: 0, sparse: 0.55 },
  intl: { h: [18, 90], colors: ['#55607a', '#6a5a7a', '#4a5a6a', '#7a5a6a'], sign: 0.8 },
  island: { h: [5, 12], colors: ['#f1e3c6', '#e9c9a0', '#f4d7d7', '#d5ecee'], sign: 0.3, sparse: 0.5 },
};

export interface RegionGeo { id: string; bld: THREE.BufferGeometry; sign: THREE.BufferGeometry | null; lamps: number[]; trees: number[]; cars: { x: number; z: number; yaw: number; type: string }[]; ents: Enterable[] }
function setColor(g: THREE.BufferGeometry, c: THREE.Color) { const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
function wallBox(w: number, h: number, d: number, x: number, y: number, z: number, c: THREE.Color, tile = true) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); const uv = g.attributes.uv;
  for (let i = 0; i < 24; i++) { const f = Math.floor(i / 4), u = uv.getX(i), v = uv.getY(i); if (!tile || f === 2 || f === 3) uv.setXY(i, 0.01, 0.01); else if (f < 2) uv.setXY(i, (u * d) / TILE, (v * h) / TILE); else uv.setXY(i, (u * w) / TILE, (v * h) / TILE); }
  setColor(g, c); return g;
}
function plainGeo(g: THREE.BufferGeometry, c: THREE.Color) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.01, 0.01); setColor(g, c); return g; }

// Interior instances (HQ, black-market bunker) are built far east of the main
// map in their own pocket of world space. `G.p.interior` is the source of truth
// for the player; actors/interactables carry an `interior` tag — never test raw x.
export const interiorPos = { hq: new V3(2000, 0, 0), bunker: new V3(2000, 0, 500) };
const OFF = ROAD_W / 2;

export function generateWorld(): RegionGeo[] {
  const out: RegionGeo[] = []; const nb = REGION_SIZE / BLOCK;
  for (const r of REGIONS) {
    const th = THEMES[r.theme]; const rng = seeded(r.gx * 977 + r.gy * 131 + 11); const ox = WORLD_OFF + r.gx * REGION_SIZE, oz = WORLD_OFF + r.gy * REGION_SIZE; const cen = regionCenter(r);
    const geos: THREE.BufferGeometry[] = []; const signs: THREE.BufferGeometry[] = []; const lamps: number[] = []; const trees: number[] = []; const cars: RegionGeo['cars'] = []; const ents: Enterable[] = [];
    const col = (hex: string, v = 0.12) => new THREE.Color(hex).multiplyScalar(1 - v + rng() * v * 2);
    let entBudget = r.theme === 'metro' ? 9 : r.theme === 'industrial' ? 3 : r.theme === 'research' ? 1 : 3;
    const mkEnt = (kind: string, x: number, z: number, w: number, d: number, h: number) => {
      const e: Enterable = { id: `${r.id}_${ents.length}`, kind, x, z, w, d, h, region: r.id, roof: null, group: null, guard: kind === 'warehouse' ? 3 : kind === 'lab' ? 4 : 0, alarm: kind !== 'hospital' && rng() < 0.45, spawned: false, looted: 0, resident: kind === 'house' && rng() < 0.7 };
      ents.push(e); return e;
    };
    const addBld = (x: number, z: number, w: number, d: number, h: number) => {
      const c = col(th.colors[Math.floor(rng() * th.colors.length)]);
      geos.push(wallBox(w, h, d, x, 0, z, c)); addBox({ x0: x - w / 2, x1: x + w / 2, y0: 0, y1: h, z0: z - d / 2, z1: z + d / 2 });
      let top = h;
      if (h > 42 && !th.pagoda) { const w2 = w * 0.62, d2 = d * 0.62, h2 = h * 0.22; geos.push(wallBox(w2, h2, d2, x, h, z, c)); addBox({ x0: x - w2 / 2, x1: x + w2 / 2, y0: 0, y1: h + h2, z0: z - d2 / 2, z1: z + d2 / 2 }); top = h + h2; geos.push(plainGeo(new THREE.CylinderGeometry(0.25, 0.4, 14, 5).translate(x, top + 7, z), new THREE.Color('#9aa'))); }
      else if (th.pagoda) { // stacked pagoda roofs
        let yy = h, ww = w + 3, dd = d + 3; for (let i = 0; i < 3; i++) { geos.push(plainGeo(new THREE.BoxGeometry(ww, 0.8, dd).translate(x, yy + 0.4, z), new THREE.Color('#2a1c1a'))); geos.push(plainGeo(new THREE.BoxGeometry(ww - 3, 0.5, dd - 3).translate(x, yy + 1.0, z), new THREE.Color('#b32424'))); if (i < 2) geos.push(wallBox(ww - 7, 4.5, dd - 7, x, yy + 0.8, z, c)); yy += 5.3; ww -= 7; dd -= 7; if (ww < 4 || dd < 4) break; }
        top = yy;
      } else if (th.dome && rng() < 0.5) { geos.push(plainGeo(new THREE.SphereGeometry(Math.min(w, d) * 0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h, z), new THREE.Color('#9be7ff'))); }
      else if (th.stacks && rng() < 0.6) { geos.push(plainGeo(new THREE.CylinderGeometry(1.6, 2.2, 26, 8).translate(x + w * 0.3, h + 13, z), new THREE.Color('#5a524b'))); geos.push(plainGeo(new THREE.CylinderGeometry(1.7, 1.7, 1, 8).translate(x + w * 0.3, h + 26.4, z), new THREE.Color('#ff6a2a'))); }
      else { geos.push(plainGeo(new THREE.BoxGeometry(w * 0.2, 1.6, d * 0.2).translate(x + w * 0.2, h + 0.8, z - d * 0.15), new THREE.Color('#666b75'))); }
      if (rng() < th.sign && h < 70) { // neon sign on a face
        const si = Math.floor(rng() * SIGNS.length); const sw = Math.min(8, w * 0.7), sh = sw / 4; const face = Math.floor(rng() * 4); const y = 3 + rng() * 4;
        const pg = new THREE.PlaneGeometry(sw, sh); const uv = pg.attributes.uv; const cx = si % 4, cy = Math.floor(si / 4);
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / 4, 1 - (cy + 1 - uv.getY(i)) / 8);
        const off = 0.15; if (face === 0) pg.translate(x, y, z + d / 2 + off); else if (face === 1) { pg.rotateY(Math.PI); pg.translate(x, y, z - d / 2 - off); } else if (face === 2) { pg.rotateY(Math.PI / 2); pg.translate(x + w / 2 + off, y, z); } else { pg.rotateY(-Math.PI / 2); pg.translate(x - w / 2 - off, y, z); }
        signs.push(pg);
      }
      return top;
    };
    const addTree = (x: number, z: number) => { trees.push(x, z, 0.8 + rng() * 0.8); };
    for (let bx = 0; bx < nb; bx++) for (let bz = 0; bz < nb; bz++) {
      const bx0 = ox + bx * BLOCK + OFF + 3, bz0 = oz + bz * BLOCK + OFF + 3, S = BLOCK - ROAD_W - 6; const mx = bx0 + S / 2, mz = bz0 + S / 2;
      const center = bx === 2 && bz === 2;
      if (center) { // command tower plaza handled in view; add collider
        addBox({ x0: mx - 3.5, x1: mx + 3.5, y0: 0, y1: 40, z0: mz - 3.5, z1: mz + 3.5 }); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; addTree(mx + Math.cos(a) * 24, mz + Math.sin(a) * 24); } continue;
      }
      if (r.id === 'metro' && bx === 1 && bz === 2) continue; // HQ lot (built separately)
      if (isPark(r, bx, bz)) { for (let i = 0; i < 14; i++) addTree(bx0 + 4 + rng() * (S - 8), bz0 + 4 + rng() * (S - 8)); if (r.theme === 'metro' || r.theme === 'capital') geos.push(plainGeo(new THREE.CylinderGeometry(9, 9, 0.1, 18).translate(mx, 0.06, mz), new THREE.Color('#2a6aa8'))); continue; }
      if (th.sparse && rng() < th.sparse) { for (let i = 0; i < 7; i++) addTree(bx0 + 4 + rng() * (S - 8), bz0 + 4 + rng() * (S - 8)); if (r.theme === 'mountain') { /* cabin */ addBld(mx, mz, 16, 14, 6 + rng() * 4); } continue; }
      if (r.theme === 'island' && Math.hypot(mx - cen.x, mz - cen.z) > 140) continue;
      const big = th.wide || rng() < 0.3;
      if (big) {
        const w = S - 4 - rng() * 8, d = S - 4 - rng() * 8; const h = th.h[0] + rng() * (th.h[1] - th.h[0]) * (th.wide ? 1 : 0.8);
        if (th.wide && entBudget > 0 && r.theme === 'industrial' && (bx + bz) % 2 === 0) { entBudget--; mkEnt('warehouse', mx, mz, 30, 22, 9); }
        else if (r.theme === 'research' && entBudget > 0 && bx === 1 && bz === 1) { entBudget--; mkEnt('lab', mx, mz, 30, 24, 9); }
        else addBld(mx, mz, w, d, h);
      } else {
        const q = S / 2 - 1.5;
        for (let qx = 0; qx < 2; qx++) for (let qz = 0; qz < 2; qz++) {
          const cx = bx0 + qx * (S / 2) + S / 4, cz = bz0 + qz * (S / 2) + S / 4; const rr = rng();
          if (entBudget > 0 && rr < 0.28 && r.theme !== 'industrial' && r.theme !== 'research' && r.theme !== 'capital') {
            entBudget--; const kinds = r.theme === 'metro' ? ['house', 'house', 'shop', 'shop', 'hospital', 'restaurant', 'house'] : ['house', 'shop', 'house'];
            let kind = kinds[Math.floor(rng() * kinds.length)]; if (r.theme === 'metro' && ents.length === 0) kind = 'house'; if (r.theme === 'metro' && ents.length === 1) kind = 'shop';
            const w = kind === 'hospital' ? 24 : 18, d = kind === 'hospital' ? 20 : 15; mkEnt(kind, cx, cz, w, d, kind === 'hospital' ? 10 : kind === 'shop' || kind === 'restaurant' ? 7 : 6);
          } else if (rr < 0.82) { const w = q * (1.2 + rng() * 0.7), d = q * (1.2 + rng() * 0.7); const h = th.h[0] + Math.pow(rng(), 1.7) * (th.h[1] - th.h[0]); addBld(cx, cz, Math.min(w, q * 1.8), Math.min(d, q * 1.8), h); }
          else { for (let i = 0; i < 2; i++) addTree(cx - 6 + rng() * 12, cz - 6 + rng() * 12); }
        }
      }
    }
    // lamps at intersections
    for (let i = 0; i <= nb; i++) for (let j = 0; j <= nb; j++) { const cx = ox + i * BLOCK, cz = oz + j * BLOCK; for (const sx of [-1, 1]) for (const sz of [-1, 1]) if ((i + j + (sx + sz > 0 ? 1 : 0)) % 2 === 0 && i < nb && j < nb) lamps.push(cx + sx * 9, cz + sz * 9); }
    // parked cars along roads
    const nc = r.theme === 'metro' ? 34 : 9;
    for (let i = 0; i < nc; i++) {
      const alongX = rng() < 0.5; const line = Math.floor(rng() * (nb + 1)); const s = 14 + rng() * (REGION_SIZE - 28); const side = rng() < 0.5 ? -1 : 1;
      const inter = (s % BLOCK) < OFF + 4 || (s % BLOCK) > BLOCK - OFF - 4; if (inter) continue;
      let type = VTYPES[Math.floor(rng() * VTYPES.length)]; if (r.theme === 'metro' && i === 0) type = 'sedan'; if (r.theme === 'metro' && i === 1) type = 'sports';
      if (alongX) cars.push({ x: ox + s, z: oz + line * BLOCK + side * 5.2, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, type }); else cars.push({ x: ox + line * BLOCK + side * 5.2, z: oz + s, yaw: side > 0 ? 0 : Math.PI, type });
    }
    // mountains
    if (r.theme === 'mountain') {
      for (let i = 0; i < 16; i++) {
        let x: number, z: number; do { x = cen.x + (rng() - 0.5) * REGION_SIZE * 0.95; z = cen.z + (rng() - 0.5) * REGION_SIZE * 0.95; } while (Math.hypot(x - cen.x, z - cen.z) < 70);
        const rad = 28 + rng() * 38, h = 70 + rng() * 110; const c = new THREE.Color().setHSL(0.08 + rng() * 0.04, 0.12, 0.28 + rng() * 0.08);
        const cg = plainGeo(new THREE.ConeGeometry(rad, h, 7, 1).translate(x, h / 2, z), c); geos.push(cg);
        geos.push(plainGeo(new THREE.ConeGeometry(rad * 0.34, h * 0.34, 7, 1).translate(x, h * 0.83, z), new THREE.Color('#f4f8ff')));
        addBox({ x0: x - rad * 0.55, x1: x + rad * 0.55, y0: 0, y1: h * 0.32, z0: z - rad * 0.55, z1: z + rad * 0.55 }); addBox({ x0: x - rad * 0.32, x1: x + rad * 0.32, y0: 0, y1: h * 0.6, z0: z - rad * 0.32, z1: z + rad * 0.32 }); addBox({ x0: x - rad * 0.12, x1: x + rad * 0.12, y0: 0, y1: h * 0.9, z0: z - rad * 0.12, z1: z + rad * 0.12 });
      }
    }
    if (r.theme === 'island') { geos.push(plainGeo(new THREE.ConeGeometry(34, 62, 9).translate(cen.x + 70, 31, cen.z - 60), new THREE.Color('#4a3a34'))); geos.push(plainGeo(new THREE.ConeGeometry(12, 8, 9).translate(cen.x + 70, 60, cen.z - 60), new THREE.Color('#ff5a1a'))); addBox({ x0: cen.x + 52, x1: cen.x + 88, y0: 0, y1: 28, z0: cen.z - 78, z1: cen.z - 42 }); }
    if (r.theme === 'capital') { // World Hero Alliance tower on special: tall central spire next to command tower
      geos.push(wallBox(26, 150, 26, cen.x + 40, 0, cen.z + 40, new THREE.Color('#f4f6fa'))); addBox({ x0: cen.x + 27, x1: cen.x + 53, y0: 0, y1: 150, z0: cen.z + 27, z1: cen.z + 53 }); geos.push(plainGeo(new THREE.ConeGeometry(8, 40, 6).translate(cen.x + 40, 170, cen.z + 40), new THREE.Color('#ffe9a0')));
    }
    if (r.theme === 'intl') { geos.push(plainGeo(new THREE.CylinderGeometry(2, 10, 120, 4).translate(cen.x - 55, 60, cen.z - 55), new THREE.Color('#d2457e'))); addBox({ x0: cen.x - 62, x1: cen.x - 48, y0: 0, y1: 100, z0: cen.z - 62, z1: cen.z - 48 }); }
    const cleaned = geos.filter((g) => g.attributes.position);
    const bld = mergeGeometries(cleaned.map((g) => (g.index ? g : g)), false)!;
    const sign = signs.length ? mergeGeometries(signs, false) : null;
    out.push({ id: r.id, bld, sign, lamps, trees, cars, ents });
  }
  return out;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ enterable interiors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const stdCache = new Map<string, THREE.MeshStandardMaterial>();
const sm = (c: string, e = '', ei = 0, rough = 0.8, metal = 0.05) => { const k = c + e + ei + rough; let m = stdCache.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, emissive: e || '#000', emissiveIntensity: ei }); stdCache.set(k, m); } return m; };
const bgeo = new Map<string, THREE.BoxGeometry>();
const bx = (w: number, h: number, d: number) => { const k = `${w}|${h}|${d}`; let g = bgeo.get(k); if (!g) { g = new THREE.BoxGeometry(w, h, d); bgeo.set(k, g); } return g; };
export function lootRoll(kind: string, rng: () => number): { money: number; items: string[] } {
  const items: string[] = []; let money = Math.round(30 + rng() * 140);
  const r = rng();
  if (kind === 'safe') { money = Math.round(300 + rng() * 900); items.push(r < 0.3 ? 'ring' : r < 0.55 ? 'watch' : r < 0.75 ? 'jewelbox' : r < 0.92 ? 'vase' : 'painting'); }
  else if (kind === 'case') { money = 0; items.push(r < 0.4 ? 'watch' : r < 0.75 ? 'ring' : r < 0.95 ? 'jewelbox' : 'arcreactor'); }
  else if (kind === 'crate') { money = Math.round(rng() * 120); items.push(r < 0.5 ? 'scrap' : r < 0.8 ? 'circuit' : r < 0.93 ? 'laptop' : 'darkcrystal'); if (rng() < 0.4) items.push('scrap'); }
  else if (kind === 'med') { money = 0; items.push(r < 0.7 ? 'medkit' : 'stim'); }
  else if (kind === 'lab') { money = 500; items.push('researchdata', rng() < 0.4 ? 'plasmacore' : 'circuit'); }
  else { if (r < 0.2) items.push('watch'); else if (r < 0.3) items.push('jewelbox'); else if (r < 0.4) items.push('laptop'); else if (r < 0.46) items.push('ring'); else if (r < 0.58) items.push('medkit'); else if (r < 0.64) items.push('energycell'); else if (r < 0.67) items.push('painting'); }
  return { money, items };
}

export function buildEnterable(e: Enterable): THREE.Group {
  const rng = seeded(Math.floor(e.x * 13 + e.z * 7)); const grp = new THREE.Group(); const t = 0.5; const tag = 'ent:' + e.id;
  const pal: Record<string, [string, string, string]> = { house: ['#c9b79c', '#7a5c3e', '#8c3a30'], shop: ['#d8d2e0', '#3a4152', '#2a6a9a'], restaurant: ['#e0c2a0', '#6b3a2a', '#a82a2a'], hospital: ['#eef2f6', '#c8d4de', '#d4243a'], warehouse: ['#7a7f87', '#4a4f57', '#555'], lab: ['#e6eef4', '#9fb4c4', '#22d3ee'] };
  const [wallC, floorC, roofC] = pal[e.kind] ?? pal.house;
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = grp, cast = true) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = true; p.add(me); return me; };
  const door = (['n', 's', 'e', 'w'] as const)[Math.floor(rng() * 4)]; const { x, z, w, d, h } = e;
  add(bx(w, 0.12, d), sm(floorC, '', 0, 0.6), x, 0.04, z, grp, false);
  const wm = sm(wallC); const DW = 3, DH = 3.3;
  const wall = (cx: number, cz: number, ww: number, dd: number, y0 = 0, hh = h) => { add(bx(ww, hh - y0, dd), wm, cx, y0 + (hh - y0) / 2, cz); addBox({ x0: cx - ww / 2, x1: cx + ww / 2, y0, y1: hh, z0: cz - dd / 2, z1: cz + dd / 2, tag }); };
  const wx = (side: 'n' | 's') => { const zz = side === 'n' ? z - d / 2 : z + d / 2; if (door === side) { const sw = (w - DW) / 2; wall(x - w / 2 + sw / 2, zz, sw, t); wall(x + w / 2 - sw / 2, zz, sw, t); wall(x, zz, DW, t, DH, h); } else wall(x, zz, w, t); };
  const wz = (side: 'e' | 'w') => { const xx = side === 'w' ? x - w / 2 : x + w / 2; if (door === side) { const sd = (d - DW) / 2; wall(xx, z - d / 2 + sd / 2, t, sd); wall(xx, z + d / 2 - sd / 2, t, sd); wall(xx, z, t, DW, DH, h); } else wall(xx, z, t, d); };
  wx('n'); wx('s'); wz('e'); wz('w');
  // windows (exterior glow panes)
  const pane = sm('#bfe3ff', '#ffe2a0', 0.7);
  for (let i = -1; i <= 1; i += 2) { if (door !== 'n') add(bx(2.2, 1.4, 0.06), pane, x + i * w * 0.25, 3.0, z - d / 2 - 0.27, grp, false); if (door !== 's') add(bx(2.2, 1.4, 0.06), pane, x + i * w * 0.25, 3.0, z + d / 2 + 0.27, grp, false); }
  // roof
  const roofG = new THREE.Group(); grp.add(roofG); add(bx(w + 0.8, 0.5, d + 0.8), sm(roofC, '', 0, 0.9), x, h + 0.2, z, roofG);
  addBox({ x0: x - w / 2 - 0.4, x1: x + w / 2 + 0.4, y0: h - 0.1, y1: h + 0.45, z0: z - d / 2 - 0.4, z1: z + d / 2 + 0.4, tag });
  e.roof = roofG;
  // door sign
  const label = e.kind === 'hospital' ? 'HOSPITAL' : e.kind === 'shop' ? ['MINI MART', 'JEWELRY', 'ELECTRONICS', 'BOUTIQUE'][Math.floor(rng() * 4)] : e.kind === 'restaurant' ? 'DINER' : e.kind === 'warehouse' ? 'WAREHOUSE 7' : e.kind === 'lab' ? 'GENESIS LAB' : '';
  const dpos = door === 'n' ? [x, z - d / 2 - 0.4] : door === 's' ? [x, z + d / 2 + 0.4] : door === 'e' ? [x + w / 2 + 0.4, z] : [x - w / 2 - 0.4, z];
  if (label) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: labelTex(label, '#ffd23f'), toneMapped: false })); sp.position.set(dpos[0], DH + 1.0, dpos[1]); sp.rotation.y = door === 'n' ? Math.PI : door === 's' ? 0 : door === 'e' ? Math.PI / 2 : -Math.PI / 2; grp.add(sp); }
  // interactables
  const mkLoot = (kind: string, lx: number, lz: number, color: string, size: [number, number, number], label2: string) => {
    const mesh = new THREE.Group(); mesh.position.set(lx, 0, lz); grp.add(mesh);
    add(bx(size[0], size[1], size[2]), sm(color, '', 0, 0.6, kind === 'safe' ? 0.7 : 0.1), 0, size[1] / 2 + 0.06, 0, mesh);
    if (kind === 'case') add(bx(size[0] * 0.9, 0.2, size[2] * 0.9), sm('#aee8ff', '#6bd0ff', 0.7), 0, size[1] + 0.16, 0, mesh, false);
    if (kind === 'safe') add(bx(0.3, 0.3, 0.05), sm('#ffcc33', '#ffaa00', 0.8), 0, size[1] * 0.6, size[2] / 2 + 0.03, mesh, false);
    if (kind !== 'safe' && kind !== 'case') add(bx(size[0] * 0.5, 0.06, 0.05), sm('#d4af37', '', 0, 0.3, 0.8), 0, size[1] * 0.7, size[2] / 2 + 0.03, mesh, false);
    addBox({ x0: lx - size[0] / 2, x1: lx + size[0] / 2, y0: 0, y1: size[1], z0: lz - size[2] / 2, z1: lz + size[2] / 2, tag });
    const it: Interactable = { id: `${e.id}_${G.interactables.length}`, kind: 'loot', pos: new V3(lx, 1, lz), label: label2, taken: false, data: { ent: e.id, loot: kind }, mesh }; G.interactables.push(it); return it;
  };
  const rnd = (a: number, b: number) => a + rng() * (b - a);
  const furn = (ww: number, hh: number, dd: number, c: string, px: number, pz: number) => { add(bx(ww, hh, dd), sm(c), px, hh / 2 + 0.06, pz); addBox({ x0: px - ww / 2, x1: px + ww / 2, y0: 0, y1: hh, z0: pz - dd / 2, z1: pz + dd / 2, tag }); };
  const ix = (f: number) => x - w / 2 + 2 + f * (w - 4), iz = (f: number) => z - d / 2 + 2 + f * (d - 4);
  if (e.kind === 'house') {
    furn(2.2, 0.6, 3.2, '#6a4a8a', ix(0.15), iz(0.2)); add(bx(1.6, 0.2, 0.8), sm('#f2f2f2'), ix(0.15), 0.75, iz(0.2) - 1.0, grp, false); furn(3.2, 0.8, 1.2, '#4a5a6a', ix(0.7), iz(0.15)); furn(1.6, 0.8, 1.6, '#7a5c3e', ix(0.55), iz(0.65));
    add(bx(2.0, 1.1, 0.12), sm('#000', '#4aa3ff', 0.6), ix(0.7), 1.8, iz(0.0) - 0.5, grp, false);
    mkLoot('drawer', ix(0.05), iz(0.9), '#8a5a32', [1.4, 0.9, 0.6], 'Search drawer'); mkLoot('cabinet', ix(0.9), iz(0.85), '#7a4a2a', [1.2, 1.8, 0.6], 'Search cupboard'); mkLoot('drawer', ix(0.35), iz(0.95), '#9a6a3a', [1.2, 0.9, 0.6], 'Search drawer');
    if (rng() < 0.55) mkLoot('safe', ix(0.95), iz(0.2), '#3a3f48', [0.9, 1.0, 0.8], 'Crack safe');
  } else if (e.kind === 'shop' || e.kind === 'restaurant') {
    furn(w - 8, 1.1, 1.2, e.kind === 'shop' ? '#9a6a3a' : '#6b3a2a', ix(0.5), iz(0.25));
    const reg = new THREE.Group(); reg.position.set(ix(0.75), 1.2, iz(0.25)); grp.add(reg); add(bx(0.6, 0.35, 0.5), sm('#2a2f38'), 0, 0.17, 0, reg); add(bx(0.4, 0.3, 0.06), sm('#001', '#3dff9a', 0.9), 0, 0.5, -0.1, reg, false);
    G.interactables.push({ id: `${e.id}_reg`, kind: 'register', pos: new V3(ix(0.75), 1.2, iz(0.25)), label: 'Rob cash register', taken: false, data: { ent: e.id }, mesh: reg });
    for (let i = 0; i < 3; i++) furn(0.7, 2.0, 5, '#cfd4de', ix(0.15 + i * 0.28), iz(0.75));
    mkLoot('case', ix(0.1), iz(0.3), '#556', [1.6, 1.0, 0.8], 'Smash display case');
    if (e.kind === 'restaurant') for (let i = 0; i < 3; i++) furn(1.4, 0.8, 1.4, '#c8a06a', ix(0.2 + i * 0.3), iz(0.55));
  } else if (e.kind === 'hospital') {
    for (let i = 0; i < 4; i++) { furn(1.2, 0.7, 2.4, '#e8eef2', ix(0.12 + i * 0.25), iz(0.2)); }
    mkLoot('med', ix(0.15), iz(0.9), '#e5e7eb', [1.6, 1.8, 0.6], 'Raid medicine cabinet'); mkLoot('med', ix(0.5), iz(0.9), '#e5e7eb', [1.6, 1.8, 0.6], 'Raid medicine cabinet'); mkLoot('med', ix(0.85), iz(0.9), '#e5e7eb', [1.6, 1.8, 0.6], 'Raid medicine cabinet');
  } else if (e.kind === 'warehouse') {
    for (let i = 0; i < 6; i++) mkLoot('crate', ix(0.1 + (i % 3) * 0.4), iz(0.2 + Math.floor(i / 3) * 0.55), i % 2 ? '#8a6a3a' : '#6a7a8a', [rnd(1.8, 2.6), rnd(1.6, 2.4), 2], 'Open crate');
    furn(3, 2.4, 3, '#3a4252', ix(0.88), iz(0.1));
  } else if (e.kind === 'lab') {
    for (let i = 0; i < 3; i++) { furn(5, 1, 1.4, '#cfd8e0', ix(0.2 + i * 0.3), iz(0.25)); add(bx(0.8, 0.6, 0.8), sm('#bff', '#22d3ee', 0.9), ix(0.2 + i * 0.3), 1.5, iz(0.25), grp, false); }
    const mesh = new THREE.Group(); mesh.position.set(ix(0.5), 0, iz(0.8)); grp.add(mesh); add(bx(1.2, 2.2, 1.2), sm('#223', '#22d3ee', 0.4), 0, 1.1, 0, mesh); add(bx(0.6, 0.6, 0.6), sm('#9ff', '#22d3ee', 1.4), 0, 2.5, 0, mesh, false);
    addBox({ x0: ix(0.5) - 0.6, x1: ix(0.5) + 0.6, y0: 0, y1: 2.2, z0: iz(0.8) - 0.6, z1: iz(0.8) + 0.6, tag }); G.interactables.push({ id: `${e.id}_core`, kind: 'core', pos: new V3(ix(0.5), 1.2, iz(0.8)), label: 'Steal data core', taken: false, data: { ent: e.id }, mesh });
    mkLoot('lab', ix(0.9), iz(0.9), '#445', [1.2, 1.6, 0.8], 'Raid research locker');
  }
  return grp;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ HQ interior / exterior, bunker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const sizeOfTier = [[22, 16], [32, 22], [42, 28], [54, 34], [66, 42]];
export function buildHQInterior(tier: number, fac: Record<string, number>, decor: string, decorColor: string): THREE.Group {
  removeBoxes('hqi'); G.interactables = G.interactables.filter((i) => !i.id.startsWith('hqi_')); const grp = new THREE.Group(); const [w, d] = sizeOfTier[tier - 1]; const h = 9 + tier * 2; const o = interiorPos.hq; const tag = 'hqi';
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = grp) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; p.add(me); return me; };
  const floorM = sm(tier > 3 ? '#15101e' : '#2a2a32', '', 0, 0.35, 0.4); add(bx(w + 4, 0.4, d + 4), floorM, o.x, -0.2, o.z);
  const wallM = sm(tier > 2 ? '#1a1426' : '#33353d'); const wl = (cx: number, cz: number, ww: number, dd: number) => { add(bx(ww, h, dd), wallM, o.x + cx, h / 2, o.z + cz); addBox({ x0: o.x + cx - ww / 2, x1: o.x + cx + ww / 2, y0: 0, y1: h, z0: o.z + cz - dd / 2, z1: o.z + cz + dd / 2, tag }); };
  wl(0, -d / 2, w, 1); wl(0, d / 2, w, 1); wl(-w / 2, 0, 1, d); wl(w / 2, 0, 1, d);
  add(bx(w, 0.5, d), sm('#0c0c12'), o.x, h + 0.25, o.z); addBox({ x0: o.x - w / 2, x1: o.x + w / 2, y0: h, y1: h + 0.5, z0: o.z - d / 2, z1: o.z + d / 2, tag });
  for (let i = 0; i < 4 + tier * 2; i++) { const px = o.x - w / 2 + (i + 0.5) * (w / (4 + tier * 2)); add(bx(0.8, h, 0.8), sm('#222', decorColor, 0.2), px, h / 2, o.z - d / 2 + 2); addBox({ x0: px - 0.4, x1: px + 0.4, y0: 0, y1: h, z0: o.z - d / 2 + 1.6, z1: o.z - d / 2 + 2.4, tag }); add(bx(0.4, 5, 0.06), sm(decorColor, decorColor, decor === 'none' ? 0.05 : 0.9), px, h - 3.5, o.z - d / 2 + 2.45); }
  if (decor !== 'none') for (let i = 0; i < 6; i++) { const m = add(bx(0.6, 1.4 + (i % 3), 0.6), sm(decorColor, decorColor, 0.9, 0.2), o.x - w / 2 + 3 + (i % 2) * (w - 6), (1.4 + (i % 3)) / 2, o.z + d / 2 - 3 - Math.floor(i / 2) * 3); m.rotation.y = i; }
  // throne
  const tz = o.z - d / 2 + 4; add(bx(5, 0.6, 4), sm('#222'), o.x, 0.3, tz); add(bx(1.6, 0.5, 1.4), sm('#3a1020', decorColor, 0.2), o.x, 1.0, tz); add(bx(1.7, 2.8, 0.3), sm('#3a1020', decorColor, 0.35), o.x, 2.0, tz - 0.6); add(bx(0.4, 1.4, 0.3), sm(decorColor, decorColor, 1), o.x - 0.8, 3.4, tz - 0.6); add(bx(0.4, 1.4, 0.3), sm(decorColor, decorColor, 1), o.x + 0.8, 3.4, tz - 0.6);
  addBox({ x0: o.x - 2.5, x1: o.x + 2.5, y0: 0, y1: 0.6, z0: tz - 2, z1: tz + 2, tag });
  // facility stations
  FACILITIES.forEach((f, i) => {
    const cols = 6; const row = Math.floor(i / cols), col = i % cols; const sx = o.x - w / 2 + 5 + col * ((w - 10) / (cols - 1)); const sz = o.z - d / 2 + 11 + row * 7 + (tier > 2 ? 1 : 0);
    if (sx > o.x + w / 2 - 3 || sz > o.z + d / 2 - 3) return; const lv = fac[f.id] ?? 0; const g = new THREE.Group(); g.position.set(sx, 0, sz); grp.add(g);
    add(bx(2.4, 0.5, 2.4), sm('#1c1c24'), 0, 0.25, 0, g); add(bx(1.8, 1.0, 1.0), sm(lv ? '#2c2c3a' : '#18181e', lv ? decorColor : '#333', lv ? 0.25 : 0), 0, 1.0, 0, g); add(bx(1.4, 0.5, 0.06), sm('#000', lv ? '#3dff9a' : '#ff4444', 0.9), 0, 1.7, 0.45, g);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: labelTex(`${f.name}${lv ? ' Lv' + lv : ' (unbuilt)'}`, lv ? '#ffe28a' : '#8a8a96'), transparent: true, toneMapped: false })); sp.position.set(0, 3.0, 0); g.add(sp); sp.userData.bill = true;
    addBox({ x0: sx - 1.2, x1: sx + 1.2, y0: 0, y1: 1.5, z0: sz - 1.2, z1: sz + 1.2, tag });
    G.interactables.push({ interior: 'hq', id: 'hqi_' + f.id, kind: 'station', pos: new V3(sx, 1.2, sz + 1.4), label: `${f.name}`, taken: false, data: { fac: f.id }, mesh: g });
  });
  // bed (rest) and exit door
  add(bx(2, 0.5, 3), sm('#5a1a2a'), o.x + w / 2 - 4, 0.3, o.z + d / 2 - 4); add(bx(1.6, 0.2, 0.7), sm('#eee'), o.x + w / 2 - 4, 0.65, o.z + d / 2 - 5);
  G.interactables.push({ interior: 'hq', id: 'hqi_rest', kind: 'station', pos: new V3(o.x + w / 2 - 6, 1, o.z + d / 2 - 4), label: 'Rest & Save', taken: false, data: { fac: 'rest' } });
  add(bx(3.4, 4, 0.4), sm('#111', '#ff2e57', 0.8), o.x, 2.0, o.z + d / 2 - 0.4);
  G.interactables.push({ interior: 'hq', id: 'hqi_exit', kind: 'exit', pos: new V3(o.x, 1, o.z + d / 2 - 2), label: 'Leave headquarters', taken: false, data: { from: 'hq' } });
  (grp.userData as { spawn: THREE.Vector3 }).spawn = new V3(o.x, 0, o.z + d / 2 - 4);
  return grp;
}

export function buildBunker(): THREE.Group {
  const grp = new THREE.Group(); const o = interiorPos.bunker; const w = 56, d = 36, h = 9; const tag = 'bunker';
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = grp) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; p.add(me); return me; };
  add(bx(w + 4, 0.4, d + 4), sm('#1a1d22', '', 0, 0.5), o.x, -0.2, o.z); const wm = sm('#2b2f36');
  const wl = (cx: number, cz: number, ww: number, dd: number) => { add(bx(ww, h, dd), wm, o.x + cx, h / 2, o.z + cz); addBox({ x0: o.x + cx - ww / 2, x1: o.x + cx + ww / 2, y0: 0, y1: h, z0: o.z + cz - dd / 2, z1: o.z + cz + dd / 2, tag }); };
  wl(0, -d / 2, w, 1); wl(0, d / 2, w, 1); wl(-w / 2, 0, 1, d); wl(w / 2, 0, 1, d); add(bx(w, 0.5, d), sm('#101216'), o.x, h + 0.25, o.z); addBox({ x0: o.x - w / 2, x1: o.x + w / 2, y0: h, y1: h + 0.5, z0: o.z - d / 2, z1: o.z + d / 2, tag });
  for (let i = 0; i < 8; i++) { add(bx(0.5, h, 0.5), sm('#444'), o.x - w / 2 + 4 + i * 6.8, h / 2, o.z - 2); addBox({ x0: o.x - w / 2 + 3.75 + i * 6.8, x1: o.x - w / 2 + 4.25 + i * 6.8, y0: 0, y1: h, z0: o.z - 2.25, z1: o.z - 1.75, tag }); add(bx(2.4, 0.15, 0.15), sm('#f0f', '#ff2bd6', 1), o.x - w / 2 + 4 + i * 6.8, h - 1, o.z - 1.6); }
  // black market stall
  add(bx(8, 1.2, 2), sm('#3a1a4a', '#a855f7', 0.25), o.x - 14, 0.6, o.z + 8); addBox({ x0: o.x - 18, x1: o.x - 10, y0: 0, y1: 1.2, z0: o.z + 7, z1: o.z + 9, tag });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: labelTex('BLACK MARKET', '#ff2bd6'), transparent: true, toneMapped: false })); sp.position.set(o.x - 14, 3.2, o.z + 8); grp.add(sp);
  G.interactables.push({ interior: 'bunker', id: 'bk_vendor', kind: 'vendor', pos: new V3(o.x - 14, 1, o.z + 10), label: 'Black Market', taken: false, data: {} });
  // vault with artifact chest
  const vz = o.z - d / 2 + 5; const vm = new THREE.Group(); vm.position.set(o.x + 20, 0, vz); grp.add(vm); add(bx(2, 1.4, 1.4), sm('#2a1a00', '#ffcc33', 0.5, 0.3, 0.8), 0, 0.7, 0, vm); add(bx(1.4, 0.4, 1), sm('#ffd23f', '#ffaa00', 1), 0, 1.6, 0, vm);
  addBox({ x0: o.x + 19, x1: o.x + 21, y0: 0, y1: 1.4, z0: vz - 0.7, z1: vz + 0.7, tag });
  G.interactables.push({ interior: 'bunker', id: 'bk_vault', kind: 'loot', pos: new V3(o.x + 20, 1, vz), label: 'Open the vault', taken: false, data: { ent: 'bunker', loot: 'vault' }, mesh: vm });
  for (let i = 0; i < 5; i++) { const cx = o.x - 20 + i * 5, cz = o.z - 8; const m = new THREE.Group(); m.position.set(cx, 0, cz); grp.add(m); add(bx(2, 1.6, 2), sm('#5a4a3a'), 0, 0.8, 0, m); addBox({ x0: cx - 1, x1: cx + 1, y0: 0, y1: 1.6, z0: cz - 1, z1: cz + 1, tag }); G.interactables.push({ interior: 'bunker', id: 'bk_crate' + i, kind: 'loot', pos: new V3(cx, 1, cz), label: 'Open crate', taken: false, data: { ent: 'bunker', loot: 'crate' }, mesh: m }); }
  add(bx(3.4, 4, 0.4), sm('#111', '#a855f7', 0.8), o.x, 2.0, o.z + d / 2 - 0.4);
  G.interactables.push({ interior: 'bunker', id: 'bk_exit', kind: 'exit', pos: new V3(o.x, 1, o.z + d / 2 - 2), label: 'Climb back to the surface', taken: false, data: { from: 'bunker' } });
  (grp.userData as { spawn: THREE.Vector3 }).spawn = new V3(o.x, 0, o.z + d / 2 - 4);
  return grp;
}

export function buildHQExterior(tier: number, decorColor: string): THREE.Group {
  removeBoxes('hqx'); const grp = new THREE.Group(); const cx = -80, cz = 0; const tag = 'hqx';
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; grp.add(me); return me; };
  const solid = (w: number, hh: number, dd: number, x: number, z: number, m: THREE.Material, y0 = 0) => { add(bx(w, hh, dd), m, x, y0 + hh / 2, z); addBox({ x0: x - w / 2, x1: x + w / 2, y0, y1: y0 + hh, z0: z - dd / 2, z1: z + dd / 2, tag }); };
  const dark = sm(tier >= 4 ? '#150f22' : '#4a4540', '', 0, 0.7, 0.2); const glowM = sm(decorColor, decorColor, 1.2);
  const sizes = [[14, 5, 12], [24, 8, 18], [30, 14, 24], [22, 46, 22], [34, 22, 34]][tier - 1]; const [w, hh, d] = sizes;
  // building shell with door gap on +x side
  const t = 1; const dw = 4;
  solid(w, hh, t, cx, cz - d / 2, dark); solid(w, hh, t, cx, cz + d / 2, dark); solid(t, hh, d, cx - w / 2, cz, dark);
  solid(t, hh, (d - dw) / 2, cx + w / 2, cz - d / 2 + (d - dw) / 4, dark); solid(t, hh, (d - dw) / 2, cx + w / 2, cz + d / 2 - (d - dw) / 4, dark); solid(t, hh - 4, dw, cx + w / 2, cz, dark, 4);
  solid(w + 1, 1, d + 1, cx, cz, dark, hh);
  add(bx(0.3, 4, dw), glowM, cx + w / 2 + 0.2, 2, cz);
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: labelTex(tier >= 5 ? 'DARK FORTRESS' : tier >= 4 ? 'DARK TOWER' : 'THE HIDEOUT', decorColor), transparent: true, toneMapped: false })); sp.position.set(cx + w / 2 + 0.6, 6.2 + (tier > 3 ? 2 : 0), cz); sp.rotation.y = Math.PI / 2; grp.add(sp);
  if (tier >= 2) { for (const s of [-1, 1]) { add(bx(0.4, 3, 0.4), glowM, cx + w / 2 + 0.5, 1.5, cz + s * 4); } }
  if (tier >= 3) { // compound walls & corner towers
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { solid(5, 22, 5, cx + sx * (w / 2 + 6), cz + sz * (d / 2 + 6), dark); add(new THREE.ConeGeometry(4, 6, 4), sm('#7a1a2a', decorColor, 0.4), cx + sx * (w / 2 + 6), 25, cz + sz * (d / 2 + 6)); }
  }
  if (tier >= 4) { add(new THREE.CylinderGeometry(0.6, 1.2, 40, 6), glowM, cx, hh + 20, cz); const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 300, 12, 1, true), new THREE.MeshBasicMaterial({ color: decorColor, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); beam.position.set(cx, hh + 190, cz); grp.add(beam); }
  if (tier >= 5) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) { solid(6, 48, 6, cx + sx * (w / 2 + 6), cz + sz * (d / 2 + 6), dark); add(new THREE.ConeGeometry(5, 14, 6), glowM, cx + sx * (w / 2 + 6), 55, cz + sz * (d / 2 + 6)); } }
  G.interactables = G.interactables.filter((i) => i.id !== 'hq_door');
  G.interactables.push({ id: 'hq_door', kind: 'door', pos: new V3(cx + w / 2 + 1.5, 1, cz), label: 'Enter headquarters', taken: false, data: { to: 'hq' } });
  return grp;
}

export function buildHighway(): { group: THREE.Group } {
  const group = new THREE.Group(); const road = sm('#1b1d23', '', 0, 0.9); const rail = sm('#9aa0ad', '', 0, 0.4, 0.7); const y = 16;
  const z = WORLD_OFF + REGION_SIZE; // road line between rows 0 and 1
  const mk = (g: THREE.BufferGeometry, m: THREE.Material, x: number, yy: number, zz: number) => { const me = new THREE.Mesh(g, m); me.position.set(x, yy, zz); me.castShadow = true; me.receiveShadow = true; group.add(me); return me; };
  mk(new THREE.BoxGeometry(1200, 1, 18), road, 0, y, z); addBox({ x0: -600, x1: 600, y0: y - 0.9, y1: y + 0.1, z0: z - 9, z1: z + 9, tag: 'hw' });
  mk(new THREE.BoxGeometry(1200, 1.1, 0.4), rail, 0, y + 0.8, z - 8.8); mk(new THREE.BoxGeometry(1200, 1.1, 0.4), rail, 0, y + 0.8, z + 8.8);
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(1200, 0.3), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); dash.rotation.x = -Math.PI / 2; dash.position.set(0, y + 0.55, z); group.add(dash);
  for (let x = -580; x <= 580; x += 60) { mk(new THREE.BoxGeometry(2, y, 2), sm('#555a64'), x, y / 2, z); addBox({ x0: x - 1, x1: x + 1, y0: 0, y1: y, z0: z - 1, z1: z + 1, tag: 'hw' }); }
  // bridge to island
  const bz = WORLD_OFF + 2 * REGION_SIZE + 160; mk(new THREE.BoxGeometry(70, 0.6, 12), road, 225, 0.3, bz); for (let i = 0; i < 5; i++) { mk(new THREE.BoxGeometry(0.6, 9, 0.6), rail, 200 + i * 14, 4.5, bz - 6); mk(new THREE.BoxGeometry(0.6, 9, 0.6), rail, 200 + i * 14, 4.5, bz + 6); }
  mk(new THREE.BoxGeometry(70, 0.15, 0.15), sm('#ff7ad9', '#ff7ad9', 1), 225, 8.8, bz - 6); mk(new THREE.BoxGeometry(70, 0.15, 0.15), sm('#ff7ad9', '#ff7ad9', 1), 225, 8.8, bz + 6);
  return { group };
}
export function mkFacilityKeys() { return FACILITIES.map((f) => f.id); }
