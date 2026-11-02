import type { DistrictId, Poi, PoiKind } from '../types';
import { clamp, mulberry32 } from '../util';

// ---------- City grid: 9 x 10 blocks, roads on every grid line ----------
export const P = 104; // block pitch (road centre to road centre)
export const RW = 14; // road width
export const NXB = 9;
export const NZB = 10;
export const NXN = NXB + 1; // intersection columns (0..9)
export const NZN = NZB + 1; // intersection rows (0..10)
export const WORLD_W = NXB * P;
export const WORLD_D = NZB * P;
export const FLYOVER = {
  z: 4 * P,
  startX: 2 * P - 80,
  rampUpEndX: 2 * P - 20,
  rampDownStartX: 2 * P + 80,
  endX: 2 * P + 140,
  height: 6.2,
  halfWidth: 7,
};

export function flyoverHeight(x: number, z: number): number {
  if (Math.abs(z - FLYOVER.z) > FLYOVER.halfWidth || x < FLYOVER.startX || x > FLYOVER.endX) return 0;
  if (x < FLYOVER.rampUpEndX) return FLYOVER.height * (x - FLYOVER.startX) / (FLYOVER.rampUpEndX - FLYOVER.startX);
  if (x > FLYOVER.rampDownStartX) return FLYOVER.height * (FLYOVER.endX - x) / (FLYOVER.endX - FLYOVER.rampDownStartX);
  return FLYOVER.height;
}

const MAP = [
  'AAAAAAMMS',
  'AAAAAAMMS',
  'RRRIIIMMS',
  'RRRIIIMMS',
  'RRRCCCMMS',
  'RRRCCCMMS',
  'RRNCCCMMS',
  'NNNRRRMMS',
  'NNNRRRRMS',
  'NNNRRRRMS',
];
const DMAP: Record<string, DistrictId> = { A: 'airport', R: 'residential', I: 'it', C: 'central', M: 'commercial', S: 'coastal', N: 'industrial' };
export const PARKS = new Set(['1,4', '4,5', '4,8']);

export const DISTRICTS: Record<DistrictId, { name: string; color: string; order: number }> = {
  central: { name: 'Central City', color: '#f59e0b', order: 0 },
  residential: { name: 'Residential District', color: '#10b981', order: 1 },
  it: { name: 'IT District', color: '#6366f1', order: 2 },
  commercial: { name: 'Commercial District', color: '#ec4899', order: 3 },
  coastal: { name: 'Coastal District', color: '#06b6d4', order: 4 },
  industrial: { name: 'Industrial District', color: '#a8a29e', order: 5 },
  airport: { name: 'Airport & Highway', color: '#38bdf8', order: 6 },
};
export const DISTRICT_ORDER: DistrictId[] = ['central', 'residential', 'it', 'commercial', 'coastal', 'industrial', 'airport'];

export function districtOfBlock(i: number, j: number): DistrictId {
  return DMAP[MAP[clamp(j, 0, NZB - 1)][clamp(i, 0, NXB - 1)]];
}
export function districtAt(x: number, z: number): DistrictId {
  return districtOfBlock(Math.floor(x / P), Math.floor(z / P));
}

// ---------- Lots (building footprints) ----------
export interface Lot {
  id: string; i: number; j: number; k: number; x0: number; z0: number; x1: number; z1: number; h: number;
  district: DistrictId; solid: boolean; open: boolean; color: number; special?: string;
}
const LOT = 37, GAP = 4, INSET = RW / 2 + 6;
export const lots: Lot[] = [];
export const lotsByBlock = new Map<string, Lot[]>();

const HEIGHTS: Record<DistrictId, [number, number]> = {
  central: [24, 78], residential: [9, 26], it: [34, 96], commercial: [14, 44], coastal: [16, 32], industrial: [8, 15], airport: [8, 14],
};
const PALETTES: Record<DistrictId, number[]> = {
  central: [0xd6cfc4, 0xc9b79c, 0xb8c4cf, 0xe8dcc8],
  residential: [0xf3d9a4, 0xe9a8a0, 0xa8d5c2, 0xf1e3b8, 0xc9b2d9, 0xf4b183],
  it: [0x9fc5e8, 0xb7d3e8, 0x8fb4d9, 0xc5d9e8],
  commercial: [0xe8b4c8, 0xf0c987, 0xc8d6e5, 0xe5989b],
  coastal: [0xfff1d6, 0xa8e0e8, 0xf8c9a0, 0xffffff],
  industrial: [0xb0a99f, 0x9ca3a6, 0xa89080, 0xc2b8a3],
  airport: [0xd9dee3, 0xc4ccd4],
};

(function buildLots() {
  const rnd = mulberry32(1337);
  for (let j = 0; j < NZB; j++) for (let i = 0; i < NXB; i++) {
    const d = districtOfBlock(i, j);
    const key = `${i},${j}`;
    const arr: Lot[] = [];
    lotsByBlock.set(key, arr);
    if (PARKS.has(key)) continue;
    const bx = i * P + INSET, bz = j * P + INSET;
    if (d === 'airport') {
      const mk = (k: number, w: number, dd: number, h: number, alignSouth = true) => {
        const x0 = i * P + RW / 2 + 6, x1 = x0 + w;
        const z1 = (j + 1) * P - RW / 2 - 8, z0 = alignSouth ? z1 - dd : bz;
        const l: Lot = { id: `L${i}_${j}_${k}`, i, j, k, x0, z0, x1, z1: z0 + dd, h, district: d, solid: true, open: false, color: PALETTES.airport[k % 2] };
        arr.push(l); lots.push(l);
      };
      if (i === 2 && j === 1) mk(2, 84, 30, 18);
      else if (i === 4 && j === 1) mk(2, 60, 26, 14);
      else if (i === 5 && j === 1) mk(2, 32, 26, 9);
      else if (i === 0 && j === 1) mk(2, 36, 24, 8);
      continue;
    }
    for (let k = 0; k < 4; k++) {
      const kx = k % 2, kz = k >> 1;
      let open = false;
      if (d === 'coastal' && kx === 1) open = true;
      const x0 = bx + kx * (LOT + GAP), z0 = bz + kz * (LOT + GAP);
      const [hmin, hmax] = HEIGHTS[d];
      let h = hmin + rnd() * (hmax - hmin);
      if (d === 'central' && Math.abs(i - 4) + Math.abs(j - 5) <= 1) h *= 1.2;
      const lot: Lot = {
        id: `L${i}_${j}_${k}`, i, j, k, x0: x0 + rnd() * 2, z0: z0 + rnd() * 2, x1: x0 + LOT - rnd() * 2, z1: z0 + LOT - rnd() * 2,
        h, district: d, solid: !open, open, color: PALETTES[d][Math.floor(rnd() * PALETTES[d].length)],
      };
      arr.push(lot); lots.push(lot);
    }
  }
})();

// ---------- POIs ----------
export const pois: Poi[] = [];
export const poiById = new Map<string, Poi>();
function addPoi(p: Poi) { pois.push(p); poiById.set(p.id, p); }

function doorOf(i: number, j: number, k: number): { x: number; z: number } | null {
  const l = lotsByBlock.get(`${i},${j}`)?.find((q) => q.k === k);
  if (!l) return null;
  const cx = (l.x0 + l.x1) / 2;
  const north = k < 2 && l.district !== 'airport';
  return { x: cx, z: north ? j * P + RW / 2 + 1.2 : (j + 1) * P - RW / 2 - 1.2 };
}

interface Spec { id: string; name: string; kind: PoiKind; i: number; j: number; k: number; enter?: boolean }
const ENTERABLE: PoiKind[] = [
  'home', 'hq', 'branch', 'garage', 'restaurant', 'shop', 'bank', 'regoffice', 'hospital',
  'dealership', 'police', 'hotel', 'petrol', 'railway', 'bus', 'airport', 'mall', 'itpark',
  'school', 'beach', 'factory', 'park', 'office', 'apartments', 'market',
];
const SPECS: Spec[] = [
  { id: 'home', name: 'Mariamman Lodge — Room 4', kind: 'home', i: 1, j: 5, k: 0 },
  { id: 'garage1', name: 'Murugan Motors Garage', kind: 'garage', i: 2, j: 4, k: 1 },
  { id: 'school1', name: "St. Anne's School", kind: 'school', i: 0, j: 3, k: 2 },
  { id: 'rest1', name: 'Amma Mess', kind: 'restaurant', i: 2, j: 5, k: 0 },
  { id: 'shop1', name: 'Kumar Stores', kind: 'shop', i: 1, j: 6, k: 1 },
  { id: 'apt1', name: 'Lotus Apartments', kind: 'apartments', i: 3, j: 7, k: 0 },
  { id: 'hosp1', name: 'Sri Care Hospital', kind: 'hospital', i: 0, j: 4, k: 0 },
  { id: 'petrol1', name: 'Indira Petrol Bunk', kind: 'petrol', i: 2, j: 2, k: 2 },
  { id: 'police1', name: 'Adyar Police Station', kind: 'police', i: 4, j: 7, k: 1 },
  { id: 'hq', name: 'Business Tower — HQ Floor', kind: 'hq', i: 3, j: 5, k: 1 },
  { id: 'regoffice', name: 'City Registrar & Business Centre', kind: 'regoffice', i: 5, j: 6, k: 0 },
  { id: 'bank', name: 'Bharat Union Bank', kind: 'bank', i: 3, j: 6, k: 0 },
  { id: 'railway', name: 'Central Railway Station', kind: 'railway', i: 4, j: 4, k: 0 },
  { id: 'bus', name: 'Metro Bus Terminal', kind: 'bus', i: 5, j: 4, k: 2 },
  { id: 'rest2', name: 'Café Madras', kind: 'restaurant', i: 3, j: 4, k: 0 },
  { id: 'shop2', name: 'City Mart', kind: 'shop', i: 5, j: 5, k: 1 },
  { id: 'petrol2', name: 'Bharat Fuel Station', kind: 'petrol', i: 3, j: 6, k: 2 },
  { id: 'it1', name: 'TechNova IT Park', kind: 'itpark', i: 3, j: 2, k: 0 },
  { id: 'it2', name: 'Quantum Towers', kind: 'itpark', i: 4, j: 2, k: 1 },
  { id: 'it3', name: 'Silicon Valley Park', kind: 'itpark', i: 5, j: 3, k: 0 },
  { id: 'rest3', name: 'Filter Coffee Café', kind: 'restaurant', i: 4, j: 3, k: 2 },
  { id: 'mall', name: 'Grand Galleria Mall', kind: 'mall', i: 6, j: 2, k: 0 },
  { id: 'market', name: 'Pazhaya Bazaar', kind: 'market', i: 7, j: 4, k: 0 },
  { id: 'hotel1', name: 'Grand Residency Hotel', kind: 'hotel', i: 6, j: 5, k: 1 },
  { id: 'dealer', name: 'RoyalWheels Motorcycles', kind: 'dealership', i: 6, j: 4, k: 0 },
  { id: 'rest4', name: 'Biryani Junction', kind: 'restaurant', i: 7, j: 2, k: 2 },
  { id: 'shop3', name: 'Ganesh Electronics', kind: 'shop', i: 6, j: 6, k: 0 },
  { id: 'hosp2', name: 'Apex Multispeciality Hospital', kind: 'hospital', i: 7, j: 6, k: 2 },
  { id: 'petrol3', name: 'Shell-Star Petrol', kind: 'petrol', i: 6, j: 3, k: 2 },
  { id: 'hotel2', name: 'Marina Bay Resort', kind: 'hotel', i: 8, j: 2, k: 0 },
  { id: 'rest5', name: 'Seashell Restaurant', kind: 'restaurant', i: 8, j: 4, k: 0 },
  { id: 'beach', name: 'Marina Beach Promenade', kind: 'beach', i: 8, j: 5, k: 0 },
  { id: 'fact1', name: 'Ashok Auto Components', kind: 'factory', i: 0, j: 8, k: 0 },
  { id: 'fact2', name: 'Southern Logistics Hub', kind: 'factory', i: 1, j: 7, k: 1 },
  { id: 'fact3', name: 'SteelWorks Pvt Ltd', kind: 'factory', i: 2, j: 9, k: 2 },
  { id: 'rest6', name: 'Workers Canteen', kind: 'restaurant', i: 1, j: 9, k: 0 },
  { id: 'petrol4', name: 'Industrial Fuel Point', kind: 'petrol', i: 0, j: 7, k: 2 },
  // branch offices (HQ is the central branch)
  { id: 'branch-residential', name: 'Residential Branch Office', kind: 'branch', i: 0, j: 6, k: 0 },
  { id: 'branch-it', name: 'IT District Branch Office', kind: 'branch', i: 3, j: 3, k: 1 },
  { id: 'branch-commercial', name: 'Commercial Branch Office', kind: 'branch', i: 7, j: 5, k: 0 },
  { id: 'branch-coastal', name: 'Coastal Branch Office', kind: 'branch', i: 8, j: 3, k: 0 },
  { id: 'branch-industrial', name: 'Industrial Branch Office', kind: 'branch', i: 0, j: 9, k: 1 },
  { id: 'branch-airport', name: 'Airport Branch Office', kind: 'branch', i: 5, j: 1, k: 2 },
  { id: 'airport', name: 'International Airport — Terminal 1', kind: 'airport', i: 2, j: 1, k: 2 },
  { id: 'airport2', name: 'Airport Cargo & Hotel', kind: 'hotel', i: 4, j: 1, k: 2 },
  { id: 'hwy', name: 'Highway Service Station', kind: 'petrol', i: 0, j: 1, k: 2 },
];
SPECS.forEach((s) => {
  const d = doorOf(s.i, s.j, s.k);
  if (!d) return;
  const lot = lotsByBlock.get(`${s.i},${s.j}`)!.find((q) => q.k === s.k)!;
  lot.special = s.id;
  addPoi({ id: s.id, name: s.name, kind: s.kind, district: districtOfBlock(s.i, s.j), x: d.x, z: d.z, enterable: s.enter ?? ENTERABLE.includes(s.kind) });
});

// generic destinations on remaining lots (ride endpoints)
(function genericPois() {
  const rnd = mulberry32(99);
  const names: Record<DistrictId, [PoiKind, string[]][]> = {
    central: [['office', ['Mount Road Towers', 'Lakshmi Chambers', 'Imperial Plaza', 'Crown Business Hub']], ['shop', ['Saravana Silks']]],
    residential: [['apartments', ['Sai Residency', 'Green Meadows', 'Krishna Nagar Homes', 'Vasanth Villas']], ['school', ['Vidya Mandir School', 'Little Flower Academy']]],
    it: [['itpark', ['Infosys-ish Campus', 'Bluewave Tech Park', 'Cognito Software Hub', 'Pixel Park']]],
    commercial: [['mall', ['Orchid Mall', 'Spencer Square']], ['market', ['Textile Market']], ['hotel', ['Hotel Annapoorna']]],
    coastal: [['hotel', ['Sea Breeze Hotel', 'Coral Inn']], ['beach', ['Fisherman Cove']]],
    industrial: [['factory', ['Tamil Textiles Mill', 'Precision Castings', 'Eastern Cold Storage']]],
    airport: [['airport', ['Airport Cargo Gate']]],
  };
  let n = 0;
  for (const l of lots) {
    if (l.special || l.open) continue;
    const d = doorOf(l.i, l.j, l.k);
    if (!d) continue;
    const opts = names[l.district];
    const [kind, list] = opts[Math.floor(rnd() * opts.length)];
    addPoi({ id: `g${n++}`, name: list[Math.floor(rnd() * list.length)] + ` #${n}`, kind, district: l.district, x: d.x, z: d.z, enterable: true });
  }
})();

export const RIDE_POIS = pois.filter((p) => !['hq', 'branch', 'regoffice', 'police'].includes(p.kind) || p.kind === 'police');
export function branchPoiId(d: DistrictId) { return d === 'central' ? 'hq' : `branch-${d}`; }

export function nearestPoi(x: number, z: number, maxD: number, filter?: (p: Poi) => boolean): Poi | null {
  let best: Poi | null = null, bd = maxD * maxD;
  for (const p of pois) {
    if (filter && !filter(p)) continue;
    const dd = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (dd < bd) { bd = dd; best = p; }
  }
  return best;
}

// ---------- Road network ----------
export const nodeId = (i: number, j: number) => j * NXN + i;
export const nodePos = (id: number): [number, number] => [(id % NXN) * P, Math.floor(id / NXN) * P];
const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export function neighbors(i: number, j: number): { i: number; j: number; dir: number }[] {
  const out: { i: number; j: number; dir: number }[] = [];
  DIRS.forEach(([dx, dz], dir) => {
    const ni = i + dx, nj = j + dz;
    if (ni >= 0 && ni < NXN && nj >= 0 && nj < NZN) out.push({ i: ni, j: nj, dir });
  });
  return out;
}

export interface RoadSnap { ax: number; az: number; bx: number; bz: number; a: number; b: number; px: number; pz: number; off: number }
export function snapToRoad(x: number, z: number): RoadSnap {
  const jn = clamp(Math.round(z / P), 0, NZN - 1), inn = clamp(Math.round(x / P), 0, NXN - 1);
  const dz = Math.abs(z - jn * P), dx = Math.abs(x - inn * P);
  if (dz <= dx) {
    const cx = clamp(x, 0, WORLD_W), i0 = clamp(Math.floor(cx / P), 0, NXN - 2);
    const a = nodeId(i0, jn), b = nodeId(i0 + 1, jn);
    return { ax: i0 * P, az: jn * P, bx: (i0 + 1) * P, bz: jn * P, a, b, px: cx, pz: jn * P, off: dz };
  }
  const cz = clamp(z, 0, WORLD_D), j0 = clamp(Math.floor(cz / P), 0, NZN - 2);
  const a = nodeId(inn, j0), b = nodeId(inn, j0 + 1);
  return { ax: inn * P, az: j0 * P, bx: inn * P, bz: (j0 + 1) * P, a, b, px: inn * P, pz: cz, off: dx };
}

function nodePath(from: number, to: number): number[] {
  if (from === to) return [from];
  // Dijkstra over (node, heading) with a small turn penalty => natural L-shaped routes
  const N = NXN * NZN;
  const dist = new Float64Array(N * 5).fill(Infinity);
  const prev = new Int32Array(N * 5).fill(-1);
  const open: [number, number][] = [[0, from * 5 + 4]];
  dist[from * 5 + 4] = 0;
  let end = -1;
  while (open.length) {
    let bi = 0;
    for (let q = 1; q < open.length; q++) if (open[q][0] < open[bi][0]) bi = q;
    const [d, s] = open.splice(bi, 1)[0];
    if (d > dist[s]) continue;
    const node = Math.floor(s / 5), dir = s % 5;
    if (node === to) { end = s; break; }
    for (const n of neighbors(node % NXN, Math.floor(node / NXN))) {
      const ns = nodeId(n.i, n.j) * 5 + n.dir;
      const nd = d + P + (dir !== 4 && dir !== n.dir ? 12 : 0);
      if (nd < dist[ns]) { dist[ns] = nd; prev[ns] = s; open.push([nd, ns]); }
    }
  }
  const out: number[] = [];
  for (let s = end; s !== -1; s = prev[s]) out.push(Math.floor(s / 5));
  return out.reverse();
}

export interface CityRoute { meters: number; pts: [number, number][] }
const routeCache = new Map<string, CityRoute>();
/** Road-network route between two world points (never straight-line). */
export function computeRoute(ax: number, az: number, bx: number, bz: number): CityRoute {
  const key = `${Math.round(ax)},${Math.round(az)},${Math.round(bx)},${Math.round(bz)}`;
  const c = routeCache.get(key);
  if (c) return c;
  const A = snapToRoad(ax, az), B = snapToRoad(bx, bz);
  const dd = (x1: number, z1: number, x2: number, z2: number) => Math.hypot(x1 - x2, z1 - z2);
  let best: CityRoute | null = null;
  const sameEdge = (A.a === B.a && A.b === B.b);
  if (sameEdge) {
    const m = dd(A.px, A.pz, B.px, B.pz) + A.off + B.off;
    best = { meters: m, pts: [[ax, az], [A.px, A.pz], [B.px, B.pz], [bx, bz]] };
  } else {
    const ea = [[A.a, A.ax, A.az], [A.b, A.bx, A.bz]], eb = [[B.a, B.ax, B.az], [B.b, B.bx, B.bz]];
    for (const [na, nax, naz] of ea) for (const [nb, nbx, nbz] of eb) {
      const path = nodePath(na, nb);
      const len = (path.length - 1) * P;
      const m = dd(A.px, A.pz, nax, naz) + len + dd(nbx, nbz, B.px, B.pz) + A.off + B.off;
      if (!best || m < best.meters) {
        best = { meters: m, pts: [[ax, az], [A.px, A.pz], ...path.map((n) => nodePos(n)), [B.px, B.pz], [bx, bz]] };
      }
    }
  }
  const r = best!;
  if (routeCache.size > 600) routeCache.clear();
  routeCache.set(key, r);
  return r;
}

export function pointOnPolyline(pts: [number, number][], dist: number): { x: number; z: number; heading: number } {
  let rem = Math.max(0, dist);
  for (let q = 0; q < pts.length - 1; q++) {
    const [x1, z1] = pts[q], [x2, z2] = pts[q + 1];
    const l = Math.hypot(x2 - x1, z2 - z1);
    if (rem <= l || q === pts.length - 2) {
      const t = l > 0 ? Math.min(1, rem / l) : 0;
      return { x: x1 + (x2 - x1) * t, z: z1 + (z2 - z1) * t, heading: Math.atan2(x2 - x1, z2 - z1) };
    }
    rem -= l;
  }
  const last = pts[pts.length - 1];
  return { x: last[0], z: last[1], heading: 0 };
}
export function polylineLength(pts: [number, number][]) {
  let s = 0;
  for (let q = 0; q < pts.length - 1; q++) s += Math.hypot(pts[q + 1][0] - pts[q][0], pts[q + 1][1] - pts[q][1]);
  return s;
}

// ---------- Traffic signals ----------
export type Signal = 'green' | 'yellow' | 'red';
export const SIGNAL_CYCLE = 30;
export function signalState(i: number, j: number, axis: 'x' | 'z', tSec: number): Signal {
  const ph = (tSec + ((i * 7 + j * 11) % SIGNAL_CYCLE)) % SIGNAL_CYCLE;
  if (axis === 'x') return ph < 12 ? 'green' : ph < 14 ? 'yellow' : 'red';
  return ph >= 15 && ph < 27 ? 'green' : ph >= 27 && ph < 29 ? 'yellow' : 'red';
}

// ---------- Collision ----------
export function isOnRoadNearIntersection(x: number, z: number): { i: number; j: number } | null {
  const i = Math.round(x / P), j = Math.round(z / P);
  if (i < 0 || i >= NXN || j < 0 || j >= NZN) return null;
  if (Math.abs(x - i * P) < RW / 2 && Math.abs(z - j * P) < RW / 2) return { i, j };
  return null;
}

/** Circle vs building footprints. Returns push-out vector or null. */
export function collideLots(x: number, z: number, r: number): { nx: number; nz: number; depth: number } | null {
  const bi = Math.floor(x / P), bj = Math.floor(z / P);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const arr = lotsByBlock.get(`${bi + di},${bj + dj}`);
    if (!arr) continue;
    for (const l of arr) {
      if (!l.solid) continue;
      const cx = clamp(x, l.x0, l.x1), cz = clamp(z, l.z0, l.z1);
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 === 0) {
          const ex = Math.min(x - l.x0, l.x1 - x), ez = Math.min(z - l.z0, l.z1 - z);
          if (ex < ez) return { nx: x - l.x0 < l.x1 - x ? -1 : 1, nz: 0, depth: ex + r };
          return { nx: 0, nz: z - l.z0 < l.z1 - z ? -1 : 1, depth: ez + r };
        }
        const d = Math.sqrt(d2);
        return { nx: dx / d, nz: dz / d, depth: r - d };
      }
    }
  }
  return null;
}

export function poiLabelKind(k: PoiKind): string {
  return ({ railway: 'Railway station', bus: 'Bus terminal', airport: 'Airport', mall: 'Shopping', market: 'Shopping', restaurant: 'Restaurant', hotel: 'Hotel', beach: 'Beach', itpark: 'IT park', school: 'School', factory: 'Factory', apartments: 'Residence', home: 'Home', hospital: 'Hospital' } as Record<string, string>)[k] ?? 'Place';
}
