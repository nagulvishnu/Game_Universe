// World generation: islands, terrain height, bridges, rivers, colliders, decor, structures, nodes and spawn lists.
import type { Biome } from './data';

export interface Flat { x: number; z: number; r: number; h?: number }
export interface River { kind: 'water' | 'lava'; w: number; pts: [number, number][] }
export interface Fall { ang: number; w: number; color: string }
export interface IslandDef { id: string; name: string; biome: Biome; x: number; y: number; z: number; r: number; minLevel: number; amp: number; seed: number; flats: Flat[]; pond?: Flat; rivers: River[]; falls: Fall[]; blurb: string; buildable?: boolean; minor?: boolean }

const mk = (o: Partial<IslandDef> & Pick<IslandDef, 'id' | 'name' | 'biome' | 'x' | 'y' | 'z' | 'r' | 'seed'>): IslandDef => ({ minLevel: 1, amp: 3, flats: [], rivers: [], falls: [], blurb: '', ...o });
export const ISLANDS: IslandDef[] = [
  mk({ id: 'verdant', name: 'Verdant Landing', biome: 'emerald', x: 0, y: 0, z: 0, r: 95, seed: 3, amp: 4, blurb: 'Emerald Islands — forests, lakes and the village of Dewmere.',
    flats: [{ x: 0, z: 22, r: 28 }, { x: 64, z: 18, r: 16 }, { x: 28, z: -45, r: 18 }, { x: 30, z: 55, r: 13 }, { x: -45, z: -30, r: 16, h: -3.4 }], pond: { x: -45, z: -30, r: 16, h: -1.1 } }),
  mk({ id: 'haven', name: 'Haven Isle', biome: 'emerald', x: 205, y: 10, z: -60, r: 62, seed: 11, amp: 1.2, buildable: true, blurb: 'A calm, flat island — the perfect seat for your kingdom.', flats: [{ x: 0, z: 0, r: 40 }, { x: -10, z: 30, r: 10 }] }),
  mk({ id: 'whisper', name: 'Whisper Isle', biome: 'emerald', x: -150, y: 14, z: 55, r: 36, seed: 21, amp: 2, minor: true, blurb: 'Home of the Temple of Awakening.', flats: [{ x: 0, z: 0, r: 20 }] }),
  mk({ id: 'spire', name: 'Mistral Spire', biome: 'emerald', x: 285, y: 24, z: 30, r: 24, seed: 31, amp: 2, minor: true, blurb: 'An ancient tower overlooks the clouds.', flats: [{ x: 0, z: 0, r: 8 }] }),
  mk({ id: 'frost', name: 'Frostfall Kingdom', biome: 'frost', x: -330, y: 70, z: -150, r: 105, seed: 41, amp: 7, minLevel: 2, blurb: 'Snow-covered peaks, frozen castles and ice caves.', flats: [{ x: -30, z: -30, r: 26 }, { x: 40, z: 55, r: 14 }], falls: [{ ang: 0.6, w: 6, color: '#dff4ff' }] }),
  mk({ id: 'ruins', name: 'Skyruins', biome: 'ruins', x: -110, y: 140, z: 330, r: 95, seed: 51, amp: 5, minLevel: 4, blurb: 'Floating ruins and ancient machinery of Aetheria.', flats: [{ x: 0, z: 0, r: 44 }, { x: 50, z: -20, r: 12 }, { x: -40, z: 30, r: 10 }], falls: [{ ang: 3.4, w: 5, color: '#cfe8ff' }] }),
  mk({ id: 'ember', name: 'Emberlands', biome: 'ember', x: 190, y: -20, z: 380, r: 100, seed: 61, amp: 6, minLevel: 6, blurb: 'Volcanic islands with rivers of lava.', flats: [{ x: 38, z: 8, r: 30 }, { x: -55, z: 25, r: 13 }],
    rivers: [{ kind: 'lava', w: 4, pts: [[0, -6], [-14, -30], [-10, -52], [6, -72], [8, -92]] }] }),
  mk({ id: 'shadow', name: 'Shadow Isles', biome: 'shadow', x: -420, y: -20, z: 240, r: 95, seed: 71, amp: 6, minLevel: 8, blurb: 'Haunted ruins and creatures of darkness.', flats: [{ x: 0, z: 0, r: 34 }, { x: 45, z: 30, r: 12 }, { x: -30, z: -20, r: 10 }] }),
  mk({ id: 'celestial', name: 'Celestial Kingdom', biome: 'celestial', x: 420, y: 200, z: 300, r: 115, seed: 81, amp: 2.5, minLevel: 10, blurb: 'Magnificent floating castles of light.', flats: [{ x: 0, z: 0, r: 40 }, { x: -40, z: 70, r: 12 }, { x: 0, z: -60, r: 22 }],
    falls: [{ ang: 1.2, w: 7, color: '#e8d8ff' }, { ang: 4.0, w: 6, color: '#d8f4ff' }] }),
  mk({ id: 'aurora', name: 'Aurora Isle', biome: 'celestial', x: 570, y: 215, z: 420, r: 28, seed: 91, amp: 1.5, minor: true, minLevel: 10, blurb: 'A glowing sanctum.', flats: [{ x: 0, z: 0, r: 12 }] }),
  mk({ id: 'dawn', name: 'Dawn Isle', biome: 'celestial', x: 330, y: 195, z: 430, r: 26, seed: 93, amp: 1.5, minor: true, minLevel: 10, blurb: 'A quiet shrine.', flats: [{ x: 0, z: 0, r: 10 }] }),
];
export const ISLAND_MAP: Record<string, IslandDef> = Object.fromEntries(ISLANDS.map(i => [i.id, i]));

// ── noise ──
const hash = (x: number, y: number, s: number) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
export function vnoise(x: number, y: number, s: number) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x: number, y: number, s: number, o = 4) { let a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { t += a * vnoise(x * f, y * f, s + i * 7); f *= 2; a *= 0.5; } return t / 0.9375; }
export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const radiusAt = (i: IslandDef, ang: number) => i.r * (1 + 0.1 * Math.sin(3 * ang + i.seed) + 0.07 * Math.sin(5 * ang + i.seed * 2.1) + 0.04 * Math.sin(9 * ang + i.seed * 0.7));
function distSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) { const dx = bx - ax, dz = bz - az; const l = dx * dx + dz * dz || 1; let t = ((px - ax) * dx + (pz - az) * dz) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
export function riverDist(rv: River, lx: number, lz: number) { let m = 1e9; for (let i = 0; i < rv.pts.length - 1; i++) m = Math.min(m, distSeg(lx, lz, rv.pts[i][0], rv.pts[i][1], rv.pts[i + 1][0], rv.pts[i + 1][1])); return m; }

/** absolute terrain height at world x,z for island, or NaN when outside */
export function terrainH(i: IslandDef, x: number, z: number): number {
  const lx = x - i.x, lz = z - i.z; const d = Math.hypot(lx, lz); if (d > i.r * 1.25) return NaN;
  const ang = Math.atan2(lz, lx); const R = radiusAt(i, ang); const u = d / R; if (u > 1) return NaN;
  const n = fbm(x * 0.035 + i.seed, z * 0.035 + i.seed * 1.3, i.seed);
  let h = (n - 0.5) * 2 * i.amp * (0.4 + 0.6 * smooth(0.08, 0.5, u));
  switch (i.biome) {
    case 'ember': h += 34 * Math.exp(-Math.pow(d / 30, 2)) - 12 * Math.exp(-Math.pow(d / 8, 2)) + (fbm(x * 0.08, z * 0.08, 5) - 0.5) * 5; break;
    case 'frost': h += Math.abs(fbm(x * 0.02 + 9, z * 0.02, 7) - 0.5) * 34 * smooth(0.25, 0.7, u) * (1 - smooth(0.9, 1, u)); break;
    case 'ruins': h = h + (Math.round(h / 2.5) * 2.5 - h) * 0.65; break;
    case 'shadow': h += Math.pow(fbm(x * 0.05, z * 0.05, 9), 3) * 24 * smooth(0.3, 0.7, u); break;
    case 'celestial': h += 5 * smooth(0.75, 0.3, u); break;
  }
  h -= 2.8 * Math.pow(smooth(0.8, 1, u), 1.3);
  for (const f of i.flats) { const dd = Math.hypot(lx - f.x, lz - f.z); const w = 1 - smooth(f.r * 0.7, f.r * 1.5, dd); if (w > 0) h += ((f.h ?? 0) - h) * w; }
  for (const rv of i.rivers) { const dd = riverDist(rv, lx, lz); if (dd < rv.w * 2) h -= (1 - smooth(rv.w * 0.5, rv.w * 2, dd)) * 2.6; }
  return i.y + h;
}

// ── bridges ──
export interface Bridge { a: [number, number, number]; b: [number, number, number]; w: number; magic: boolean; len: number }
function autoBridge(aId: string, bId: string, magic = false): Bridge {
  const A = ISLAND_MAP[aId], B = ISLAND_MAP[bId]; const d = Math.atan2(B.z - A.z, B.x - A.x);
  const ra = radiusAt(A, d) * 0.92, rb = radiusAt(B, d + Math.PI) * 0.92;
  const ax = A.x + Math.cos(d) * ra, az = A.z + Math.sin(d) * ra, bx = B.x - Math.cos(d) * rb, bz = B.z - Math.sin(d) * rb;
  const ay = terrainH(A, ax, az) + 0.4, by = terrainH(B, bx, bz) + 0.4;
  return { a: [ax, ay, az], b: [bx, by, bz], w: magic ? 6 : 4.2, magic, len: Math.hypot(bx - ax, bz - az) };
}
export const BRIDGES: Bridge[] = [autoBridge('verdant', 'whisper'), autoBridge('haven', 'spire'), autoBridge('celestial', 'aurora', true), autoBridge('celestial', 'dawn', true)];
export const bridgeSag = (t: number, len: number) => -Math.sin(t * Math.PI) * Math.min(2.5, len * 0.05);
function bridgeH(br: Bridge, x: number, z: number): number {
  const dx = br.b[0] - br.a[0], dz = br.b[2] - br.a[2]; const l2 = dx * dx + dz * dz; const t = ((x - br.a[0]) * dx + (z - br.a[2]) * dz) / l2;
  if (t < -0.03 || t > 1.03) return NaN; const cx = br.a[0] + dx * t, cz = br.a[2] + dz * t; if (Math.hypot(x - cx, z - cz) > br.w / 2) return NaN;
  const tt = Math.min(1, Math.max(0, t)); return br.a[1] + (br.b[1] - br.a[1]) * tt + bridgeSag(tt, br.len);
}

export function islandAt(x: number, z: number): IslandDef | null {
  let best: IslandDef | null = null; let bu = 2;
  for (const i of ISLANDS) { const d = Math.hypot(x - i.x, z - i.z); if (d > i.r * 1.25) continue; const u = d / radiusAt(i, Math.atan2(z - i.z, x - i.x)); if (u < 1.05 && u < bu) { bu = u; best = i; } }
  return best;
}
export function groundAt(x: number, z: number, yRef = 1e9): number {
  let best = -Infinity;
  for (const i of ISLANDS) { const h = terrainH(i, x, z); if (h === h && h <= yRef && h > best) best = h; }
  for (const b of BRIDGES) { const h = bridgeH(b, x, z); if (h === h && h <= yRef && h > best) best = h; }
  for (const p of PLATFORMS) { if (Math.abs(x - p.x) < p.r && Math.abs(z - p.z) < p.r && Math.hypot(x - p.x, z - p.z) < p.r && p.y <= yRef && p.y > best) best = p.y; }
  return best;
}
export const inLava = (x: number, z: number) => { for (const i of ISLANDS) for (const rv of i.rivers) if (rv.kind === 'lava') { if (riverDist(rv, x - i.x, z - i.z) < rv.w * 0.85) return true; } return false; };
export const pondAt = (x: number, z: number): { y: number } | null => { for (const i of ISLANDS) if (i.pond) { if (Math.hypot(x - i.x - i.pond.x, z - i.z - i.pond.z) < i.pond.r) return { y: i.y + (i.pond.h ?? -1) }; } return null; };

// ── colliders ──
interface Col { x: number; z: number; r: number; top?: number }
export const PLATFORMS: { x: number; z: number; r: number; y: number }[] = [];
const CELL = 24; const grid = new Map<number, Col[]>(); const ck = (cx: number, cz: number) => cx * 73856 + cz;
export function addCollider(x: number, z: number, r: number, top?: number) { const k = ck(Math.floor(x / CELL), Math.floor(z / CELL)); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push({ x, z, r, top }); }
export function collide(x: number, z: number, r: number, out: { x: number; z: number }, y = -1e9) {
  out.x = x; out.z = z; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = grid.get(ck(cx + i, cz + j)); if (!a) continue;
    for (const c of a) { if (c.top !== undefined && y > c.top) continue; const dx = out.x - c.x, dz = out.z - c.z; const dd = dx * dx + dz * dz; const m = c.r + r; if (dd < m * m && dd > 1e-6) { const d = Math.sqrt(dd); out.x = c.x + (dx / d) * m; out.z = c.z + (dz / d) * m; } } }
}

// ── features ──
export interface Decor { k: string; x: number; y: number; z: number; s: number; rot: number }
export interface Struct { type: string; isl: string; x: number; y: number; z: number; rot: number; s: number }
export interface NodeSpec { id: string; type: string; x: number; y: number; z: number; isl: string }
export interface SpawnSpec { type: string; isl: string; x: number; y: number; z: number; flying?: boolean }
export interface Poi { id: string; x: number; y: number; z: number; r: number; name: string }
export interface Waterfall { x: number; y: number; z: number; ang: number; w: number; color: string; isl: string }
export const WORLD = { decor: [] as Decor[], structs: [] as Struct[], nodes: [] as NodeSpec[], spawns: [] as SpawnSpec[], pois: [] as Poi[], falls: [] as Waterfall[], bossSpawns: {} as Record<string, [number, number, number]>, pondWater: [] as { x: number; y: number; z: number; r: number }[] };

const STRUCT_R: Record<string, number> = { house: 4.5, smithy: 5, stall: 2.2, dock: 0, shipyard: 6, temple: 2.5, tent: 2.8, camp: 0, castle: 12, tower: 4, gear: 5, hauntedTower: 5, forge: 5, shrine: 4, graveyard: 0, ruinArch: 2, cave: 5, bigCastle: 16, pedestal: 1.2, bannerPole: 0.6 };
const gp = (id: string, lx: number, lz: number): [number, number, number] => { const i = ISLAND_MAP[id]; const x = i.x + lx, z = i.z + lz; return [x, terrainH(i, x, z), z]; };
export const placeOn = gp;

function generate() {
  const D = WORLD.decor, S = WORLD.structs;
  const struct = (type: string, isl: string, lx: number, lz: number, rot = 0, s = 1) => { const [x, y, z] = gp(isl, lx, lz); S.push({ type, isl, x, y, z, rot, s }); const r = (STRUCT_R[type] ?? 0) * s; if (r) addCollider(x, z, r, type === 'tower' ? y + 20 * s : undefined); if (type === 'tower') PLATFORMS.push({ x, z, r: 3.7 * s, y: y + 20 * s + 0.7 }); if (type === 'temple') { PLATFORMS.push({ x, z, r: 7 * s, y: y + 0.8 }, { x, z, r: 5.5 * s, y: y + 1.6 }, { x, z, r: 4 * s, y: y + 2.2 }); } return [x, y, z] as [number, number, number]; };
  const poi = (id: string, name: string, isl: string, lx: number, lz: number, r = 8) => { const [x, y, z] = gp(isl, lx, lz); WORLD.pois.push({ id, name, x, y, z, r }); return [x, y, z] as [number, number, number]; };

  // ── hand-placed content ──
  // Verdant Landing
  [[-14, 14, 0.5], [14, 16, -0.4], [-24, 32, 0.2], [20, 34, -0.2], [-34, 18, 1.2], [26, 8, -1], [10, 42, 0]].forEach(([x, z, r]) => struct('house', 'verdant', x, z, r));
  struct('smithy', 'verdant', -20, 22, 0.3); struct('stall', 'verdant', 4, 24, 0); struct('stall', 'verdant', 9, 26, 0.2); struct('stall', 'verdant', -2, 26, -0.2);
  struct('dock', 'verdant', 64, 18, 0, 1); struct('shipyard', 'verdant', 56, 8, 0.3);
  struct('temple', 'verdant', 28, -45, 0.4, 0.8); struct('camp', 'verdant', 30, 55, 0); struct('tent', 'verdant', 26, 52, 0.5); struct('tent', 'verdant', 34, 58, -0.4); struct('tent', 'verdant', 36, 50, 1.2);
  struct('tower', 'verdant', -62, 14, 0.3, 0.9);
  struct('bannerPole', 'verdant', 0, 16);
  poi('oldDock', 'Old Dock', 'verdant', 64, 18, 10); poi('verdantTemple', 'Ruined Temple', 'verdant', 28, -45, 16);
  // waterfall river
  { const isl = ISLAND_MAP.verdant; const ang = -2.55; const R = radiusAt(isl, ang) * 0.96; const sx = -45, sz = -30; const ex = Math.cos(ang) * R, ez = Math.sin(ang) * R; const pts: [number, number][] = [];
    for (let k = 0; k <= 7; k++) { const t = k / 7; const wob = Math.sin(t * 6) * 5 * Math.sin(t * Math.PI); const nx = -(ez - sz), nz = ex - sx; const nl = Math.hypot(nx, nz) || 1; pts.push([sx + (ex - sx) * t + (nx / nl) * wob, sz + (ez - sz) * t + (nz / nl) * wob]); }
    isl.rivers.push({ kind: 'water', w: 3, pts }); isl.falls.push({ ang, w: 6, color: '#dff4ff' });
    // hidden cave near the fall
    const cl = [ex * 0.72 + 14, ez * 0.72 - 6]; poi('hiddenCave', 'Hidden Cave', 'verdant', cl[0], cl[1], 7); struct('cave', 'verdant', cl[0], cl[1], Math.atan2(ez, ex) + Math.PI / 2, 1); WORLD.nodes.push({ id: 'chest_cave', type: 'chest', ...(() => { const [x, y, z] = gp('verdant', cl[0], cl[1] - 1); return { x, y, z }; })(), isl: 'verdant' }); }
  // Whisper
  struct('temple', 'whisper', 0, 0, 0, 1.15); poi('whisperAltar', 'Temple Altar', 'whisper', 0, 0, 8);
  // Haven
  struct('tent', 'haven', -10, 30, 0.3); struct('ruinArch', 'haven', 45, 20, 0.5, 1.5);
  // Spire
  struct('tower', 'spire', 0, 0, 0, 1.3); poi('spireTop', 'Mistral Tower', 'spire', 0, 0, 8);
  // Frostfall
  struct('bigCastle', 'frost', -30, -30, 0.4, 1); poi('frostcastle', 'Frozen Castle', 'frost', -30, -30, 28); struct('pedestal', 'frost', -30, -14, 0);
  struct('camp', 'frost', 40, 55, 0); struct('tent', 'frost', 36, 52, 0.4); struct('tent', 'frost', 44, 58, -0.3);
  struct('cave', 'frost', 60, -20, 2.2, 1.3); struct('cave', 'frost', -70, 30, -0.5, 1.2);
  // Skyruins
  struct('gear', 'ruins', -40, 30, 0, 1.6); struct('tower', 'ruins', 70, 20, 0, 1.2); struct('tower', 'ruins', -60, -30, 0, 1.1); struct('camp', 'ruins', 50, -20, 0); struct('tent', 'ruins', 46, -24, 0.3);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; struct('ruinArch', 'ruins', Math.cos(a) * 36, Math.sin(a) * 36, a + Math.PI / 2, 1.6); }
  // Ember
  struct('forge', 'ember', -55, 25, 0.5); struct('camp', 'ember', -55, 25, 0);
  // Shadow
  struct('hauntedTower', 'shadow', -30, -20, 0.2, 1.2); struct('graveyard', 'shadow', 30, -40, 0); struct('camp', 'shadow', 45, 30, 0); struct('tent', 'shadow', 41, 27, 0.4);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; struct('ruinArch', 'shadow', Math.cos(a) * 30, Math.sin(a) * 30, a + Math.PI / 2, 1.5); }
  // Celestial
  struct('bigCastle', 'celestial', 0, -60, 0, 1.4); struct('shrine', 'celestial', -40, 70, 0.2, 1.3); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; struct('ruinArch', 'celestial', Math.cos(a) * 34, Math.sin(a) * 34, a + Math.PI / 2, 1.8); }
  struct('shrine', 'aurora', 0, 0, 0, 1.2); struct('shrine', 'dawn', 0, 0, 0, 1);
  WORLD.nodes.push({ id: 'chest_spire', type: 'chest', ...(() => { const [x, y, z] = gp('spire', 0, 0); return { x, y: y + 20 * 1.3, z }; })(), isl: 'spire' });
  // boss spawns
  WORLD.bossSpawns = { titan: gp('ruins', 0, 0), inferno: gp('ember', 38, 8), void: gp('shadow', 0, 0), wyrm: gp('celestial', 0, 0) };
  // waterfalls
  for (const i of ISLANDS) for (const f of i.falls) { const R = radiusAt(i, f.ang) * 0.97; const x = i.x + Math.cos(f.ang) * R, z = i.z + Math.sin(f.ang) * R; WORLD.falls.push({ x, y: terrainH(i, x, z), z, ang: f.ang, w: f.w, color: f.color, isl: i.id }); }
  for (const i of ISLANDS) if (i.pond) { const [x, , z] = gp(i.id, i.pond.x, i.pond.z); WORLD.pondWater.push({ x, y: i.y + (i.pond.h ?? -1), z, r: i.pond.r * 1.08 }); }
  // NPC colliders handled elsewhere

  // ── procedural scatter ──
  const blocked = (i: IslandDef, lx: number, lz: number, m: number) => {
    for (const f of i.flats) if (Math.hypot(lx - f.x, lz - f.z) < f.r * 1.15 + m) return true;
    for (const rv of i.rivers) if (riverDist(rv, lx, lz) < rv.w * 2 + m) return true;
    for (const s of S) if (s.isl === i.id && Math.hypot(s.x - i.x - lx, s.z - i.z - lz) < 6 + m) return true;
    for (const b of BRIDGES) { const bx = b.a[0], bz = b.a[2]; if (Math.hypot(i.x + lx - bx, i.z + lz - bz) < 9 || Math.hypot(i.x + lx - b.b[0], i.z + lz - b.b[2]) < 9) return true; }
    return false;
  };
  for (const i of ISLANDS) {
    const rnd = mulberry(i.seed * 1013 + 7); const R = i.r;
    const pick = (u0: number, u1: number, m = 2): [number, number] | null => { for (let t = 0; t < 12; t++) { const a = rnd() * Math.PI * 2; const u = Math.sqrt(u0 * u0 + (u1 * u1 - u0 * u0) * rnd()); const rr = radiusAt(i, a); const lx = Math.cos(a) * u * rr, lz = Math.sin(a) * u * rr; if (!blocked(i, lx, lz, m)) return [lx, lz]; } return null; };
    const dec = (k: string, n: number, u0 = 0.05, u1 = 0.93, s0 = 0.8, s1 = 1.4, col = 0) => { for (let q = 0; q < n; q++) { const p = pick(u0, u1, 1.5); if (!p) continue; const x = i.x + p[0], z = i.z + p[1]; const y = terrainH(i, x, z); if (y !== y) continue; D.push({ k, x, y, z, s: s0 + rnd() * (s1 - s0), rot: rnd() * 6.28 }); if (col) addCollider(x, z, col * 0.6); } };
    const sc = (R / 95) * (R / 95) * 95; // area-scaled
    switch (i.biome) {
      case 'emerald': dec('oak', Math.floor(sc * 1.05), 0.05, 0.92, 0.9, 1.5, 1); dec('pine', Math.floor(sc * 0.3), 0.3, 0.9, 1, 1.5, 1); dec('rock', Math.floor(sc * 0.3), 0.05, 0.95, 0.7, 1.6, 1.2); dec('flower', Math.floor(sc * 1.4), 0.03, 0.95, 0.8, 1.2); dec('bush', Math.floor(sc * 0.5), 0.03, 0.95, 0.8, 1.3); break;
      case 'frost': dec('snowpine', Math.floor(sc * 0.9), 0.05, 0.92, 1, 1.8, 1); dec('icerock', Math.floor(sc * 0.35), 0.05, 0.95, 0.8, 1.8, 1.2); dec('icespike', Math.floor(sc * 0.3), 0.1, 0.95, 0.8, 2.2); break;
      case 'ember': dec('lavarock', Math.floor(sc * 0.7), 0.05, 0.95, 0.8, 2, 1.3); dec('dead', Math.floor(sc * 0.18), 0.1, 0.9, 1, 1.4, 0.8); dec('emberspike', Math.floor(sc * 0.25), 0.1, 0.95, 0.8, 2); break;
      case 'ruins': dec('pillar', Math.floor(sc * 0.28), 0.05, 0.9, 0.8, 1.4, 1.1); dec('ruinwall', Math.floor(sc * 0.1), 0.1, 0.9, 0.9, 1.4, 2); dec('oak', Math.floor(sc * 0.2), 0.1, 0.9, 0.9, 1.3, 1); dec('rock', Math.floor(sc * 0.25), 0.05, 0.95, 0.7, 1.4, 1.2); dec('bush', Math.floor(sc * 0.4), 0.05, 0.95, 0.8, 1.2); break;
      case 'celestial': dec('crystaltree', Math.floor(sc * 0.4), 0.05, 0.92, 1, 1.6, 1); dec('glowpillar', Math.floor(sc * 0.12), 0.1, 0.9, 1, 1.6, 1); dec('crystal', Math.floor(sc * 0.22), 0.05, 0.95, 0.8, 1.6); dec('flower', Math.floor(sc * 0.8), 0.03, 0.95, 0.8, 1.2); break;
      case 'shadow': dec('dead', Math.floor(sc * 0.9), 0.05, 0.92, 1, 1.7, 0.8); dec('mushroom', Math.floor(sc * 0.7), 0.05, 0.95, 0.8, 2); dec('rock', Math.floor(sc * 0.3), 0.05, 0.95, 0.8, 1.6, 1.2); dec('darkcrystal', Math.floor(sc * 0.2), 0.1, 0.95, 0.8, 1.8); break;
    }
    // nodes
    const nodeN = Math.max(6, Math.floor(R / 6));
    const wts: Record<Biome, [string, number][]> = {
      emerald: [['wood', 5], ['stone', 3], ['iron', 2], ['crystal', 0.6], ['essence', 0.6]], frost: [['iron', 3], ['crystal', 3], ['stone', 2], ['essence', 1]], ember: [['iron', 3], ['stone', 3], ['crystal', 2], ['essence', 1]],
      ruins: [['fragment', 3], ['iron', 3], ['stone', 2], ['crystal', 1], ['wood', 1]], celestial: [['crystal', 4], ['essence', 4], ['fragment', 2]], shadow: [['essence', 4], ['crystal', 3], ['iron', 2], ['fragment', 1]],
    };
    const tot = wts[i.biome].reduce((a, b) => a + b[1], 0);
    for (let q = 0; q < nodeN; q++) {
      const p = pick(0.12, 0.88, 3); if (!p) continue; let r = rnd() * tot; let type = 'wood'; for (const [t, w] of wts[i.biome]) { r -= w; if (r <= 0) { type = t; break; } }
      const x = i.x + p[0], z = i.z + p[1]; WORLD.nodes.push({ id: `n_${i.id}_${q}`, type, x, y: terrainH(i, x, z), z, isl: i.id }); addCollider(x, z, 1);
    }
    if (!i.minor || i.id === 'whisper') for (let q = 0; q < (i.minor ? 1 : 3); q++) { const p = pick(0.3, 0.85, 3); if (!p) continue; const x = i.x + p[0], z = i.z + p[1]; WORLD.nodes.push({ id: `chest_${i.id}_${q}`, type: 'chest', x, y: terrainH(i, x, z), z, isl: i.id }); }
    // enemy spawns
    const sp = (type: string, n: number, u0 = 0.25, u1 = 0.88, flying = false, near?: [number, number, number]) => { for (let q = 0; q < n; q++) { let x: number, z: number; if (near) { const a = rnd() * 6.28, d = 3 + rnd() * near[2]; x = i.x + near[0] + Math.cos(a) * d; z = i.z + near[1] + Math.sin(a) * d; } else { const p = pick(u0, u1, 6); if (!p) continue; x = i.x + p[0]; z = i.z + p[1]; } const y = terrainH(i, x, z); if (y !== y) continue; WORLD.spawns.push({ type, isl: i.id, x, y, z, flying }); } };
    switch (i.id) {
      case 'verdant': sp('wolf', 5, 0.4, 0.88); sp('goblin', 6, 0, 0, false, [30, 55, 9]); sp('harpy', 3, 0.3, 0.8, true); sp('deer', 4, 0.2, 0.7); break;
      case 'haven': sp('deer', 3, 0.5, 0.85); break;
      case 'whisper': sp('harpy', 1, 0.3, 0.7, true); break;
      case 'spire': sp('harpy', 2, 0.2, 0.6, true); break;
      case 'frost': sp('wolf', 3, 0.3, 0.85); sp('yeti', 6, 0.2, 0.85); sp('harpy', 2, 0.3, 0.8, true); break;
      case 'ruins': sp('golem', 4, 0.5, 0.88); sp('mech', 6, 0.3, 0.9); sp('goblin', 3, 0.5, 0.9); break;
      case 'ember': sp('fire', 8, 0.25, 0.9); sp('goblin', 4, 0.4, 0.9); break;
      case 'shadow': sp('shadow', 9, 0.3, 0.9); sp('harpy', 2, 0.3, 0.8, true); break;
      case 'celestial': sp('mech', 5, 0.55, 0.9); sp('harpy', 4, 0.3, 0.8, true); sp('golem', 2, 0.6, 0.9); break;
    }
  }
  // frost sigil pedestal node
  WORLD.nodes.push({ id: 'sigil', type: 'sigil', ...(() => { const [x, y, z] = gp('frost', -30, -14); return { x, y, z }; })(), isl: 'frost' });
}
generate();

export const worldRadius = 950;
export const biomeAt = (x: number, z: number): Biome | null => islandAt(x, z)?.biome ?? null;
export const nearestIsland = (x: number, z: number) => { let b = ISLANDS[0], bd = 1e9; for (const i of ISLANDS) { const d = Math.hypot(x - i.x, z - i.z) - i.r; if (d < bd) { bd = d; b = i; } } return b; };

export const PALETTE: Record<Biome, { top: [string, string]; rock: string; under: string; sky: [string, string] }> = {
  emerald: { top: ['#4fb840', '#8fd65a'], rock: '#7a6a55', under: '#6b5645', sky: ['#4a90e0', '#bfe6ff'] },
  frost: { top: ['#e9f4ff', '#b5d4f0'], rock: '#7d93ad', under: '#5a6e88', sky: ['#7fa8d8', '#e0f0ff'] },
  ember: { top: ['#3b2a28', '#6a3a2c'], rock: '#2a1c1a', under: '#3a2420', sky: ['#5a2a20', '#d86a3a'] },
  ruins: { top: ['#a6b068', '#c9be84'], rock: '#8a8268', under: '#6a5f4c', sky: ['#5a96d8', '#f0e4c0'] },
  celestial: { top: ['#f4efe8', '#bdeee4'], rock: '#cfd6ee', under: '#9aa4d8', sky: ['#9a80e0', '#ffe6f8'] },
  shadow: { top: ['#44345f', '#2b2347'], rock: '#241d38', under: '#1a1428', sky: ['#1a1030', '#4a2a6a'] },
};
