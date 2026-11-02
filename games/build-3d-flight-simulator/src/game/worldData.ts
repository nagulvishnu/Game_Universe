// Pure world description: terrain function, airports, cities, obstacles.
// Units: metres. +X east, -Z north, +Y up. Heading 0 = north (-Z), 90 = east (+X).
import { clamp, fbm, hash2, lerp, smoothstep } from './noise';

export const WORLD_HALF = 20000;

/* ------------------------------------------------------------------ */
/* Land / sea layout                                                   */
/* ------------------------------------------------------------------ */
interface Blob { x: number; z: number; r: number; hill: number }
const BLOBS: Blob[] = [
  { x: 7000, z: 0, r: 14000, hill: 1 },
  { x: 9000, z: 10000, r: 9000, hill: 1 },
  { x: -13000, z: -6000, r: 2700, hill: 0.12 },
  { x: -14000, z: 7000, r: 3200, hill: 0.12 },
  { x: -8000, z: 14000, r: 2400, hill: 0.2 },
  { x: -3000, z: -15000, r: 2200, hill: 0.1 },
  { x: -17500, z: -15500, r: 1700, hill: 0.3 },
  { x: -18000, z: 17000, r: 1500, hill: 0.3 },
];

interface Mountain { x: number; z: number; r: number; h: number; cone?: boolean }
const MOUNTAINS: Mountain[] = [
  { x: 6000, z: -10500, r: 6500, h: 2300 },
  { x: 14500, z: -12500, r: 4500, h: 1500 },
  { x: -1500, z: -6500, r: 2800, h: 650 },
  { x: -8000, z: 14000, r: 2300, h: 1150, cone: true },
];

const DESERT = { x: 11500, z: 9500, r: 7000 };

let lastHill = 1;
function landField(x: number, z: number): number {
  let f = -9;
  for (let i = 0; i < BLOBS.length; i++) {
    const b = BLOBS[i];
    const v = 1 - Math.hypot(x - b.x, z - b.z) / b.r;
    if (v > f) { f = v; lastHill = b.hill; }
  }
  if (f < -0.6) return f;
  const n = (fbm(x * 0.00028 + 11.3, z * 0.00028 - 4.7, 4, 3) - 0.5) * 0.42 + (fbm(x * 0.0014, z * 0.0014, 2, 5) - 0.5) * 0.07;
  return f + n;
}

export function desertAmount(x: number, z: number): number {
  const d = Math.hypot(x - DESERT.x, z - DESERT.z) / DESERT.r;
  const n = (fbm(x * 0.0006, z * 0.0006, 3, 9) - 0.5) * 0.5;
  return smoothstep(1.0, 0.65, d + n);
}

function mountainHeight(x: number, z: number): number {
  let best = 0;
  for (let i = 0; i < MOUNTAINS.length; i++) {
    const m = MOUNTAINS[i];
    const d = Math.hypot(x - m.x, z - m.z) / m.r;
    if (d >= 1) continue;
    if (m.cone) {
      let c = Math.pow(1 - d, 1.5) * m.h;
      if (d < 0.1) c -= (0.1 - d) * m.h * 1.4; // crater
      c += (fbm(x * 0.004, z * 0.004, 3, 21) - 0.5) * 90 * (1 - d);
      best = Math.max(best, c);
    } else {
      const mask = smoothstep(1, 0.2, d);
      const rid = 1 - Math.abs(2 * fbm(x * 0.00055 + 5, z * 0.00055 - 3, 4, 31) - 1);
      const rid2 = 1 - Math.abs(2 * fbm(x * 0.0021, z * 0.0021, 3, 37) - 1);
      const s = 0.18 + 0.7 * Math.pow(rid, 1.6) + 0.12 * rid2;
      best = Math.max(best, mask * s * m.h);
    }
  }
  return best;
}

/** Natural terrain height before airports/cities flatten it. */
export function baseHeight(x: number, z: number): number {
  const f = landField(x, z);
  if (f <= 0) return Math.max(-420, -2.5 + f * 700);
  const t = smoothstep(0, 0.1, f);
  const hillK = lastHill;
  const des = desertAmount(x, z);
  let hills = fbm(x * 0.0005, z * 0.0005, 3, 41) * 70 + fbm(x * 0.0032, z * 0.0032, 2, 43) * 14;
  if (des > 0.01) {
    const dune = (1 - Math.abs(2 * fbm(x * 0.0022 + 3, z * 0.0022, 3, 47) - 1)) * 38;
    hills = lerp(hills, 40 + dune, des);
  }
  let h = t * (4 + hills * hillK);
  h += mountainHeight(x, z) * t;
  return h;
}

/* ------------------------------------------------------------------ */
/* Airports & cities                                                   */
/* ------------------------------------------------------------------ */
export type AirportKind = 'international' | 'regional' | 'mountain' | 'desert' | 'island';

export interface Airport {
  id: string;
  name: string;
  icao: string;
  x: number;
  z: number;
  headingDeg: number;
  heading: number; // radians
  length: number;
  width: number;
  kind: AirportKind;
  elev: number;
  fwd: { x: number; z: number };
  right: { x: number; z: number };
  cityId?: string;
}

interface AirportDef {
  id: string; name: string; icao: string; x: number; z: number; heading: number; length: number; kind: AirportKind;
  minElev?: number; elev?: number; city?: { r: number; offset: number; tall: boolean; name: string };
}

const AIRPORT_DEFS: AirportDef[] = [
  { id: 'SKY', name: 'Skyharbor International', icao: 'SKYH', x: -2500, z: 1500, heading: 90, length: 3200, kind: 'international', minElev: 14, city: { r: 1500, offset: 2100, tall: true, name: 'Skyharbor City' } },
  { id: 'MRD', name: 'Meridian International', icao: 'MRDN', x: 12000, z: -3000, heading: 0, length: 3000, kind: 'international', minElev: 40, city: { r: 1700, offset: 2150, tall: true, name: 'Meridian' } },
  { id: 'HBR', name: 'Harborview Airport', icao: 'HBRV', x: 4000, z: 9000, heading: 90, length: 2600, kind: 'international', minElev: 25, city: { r: 1500, offset: 2100, tall: true, name: 'Harborview' } },
  { id: 'ALP', name: 'Alpine Peak Airfield', icao: 'ALPK', x: 6500, z: -6500, heading: 30, length: 1700, kind: 'mountain', minElev: 200, city: { r: 380, offset: 1000, tall: false, name: 'Alpenrose' } },
  { id: 'DUN', name: 'Dune Field Strip', icao: 'DUNE', x: 11000, z: 9000, heading: 45, length: 1900, kind: 'desert', minElev: 60, city: { r: 520, offset: 1100, tall: false, name: 'Dunesburg' } },
  { id: 'PLM', name: 'Palm Island Airport', icao: 'PLMI', x: -13000, z: -6000, heading: 20, length: 1800, kind: 'island', minElev: 6, city: { r: 480, offset: 1000, tall: false, name: 'Palm Town' } },
  { id: 'CRL', name: 'Coral Isle Regional', icao: 'CRLI', x: -14000, z: 7000, heading: 120, length: 2200, kind: 'island', minElev: 7, city: { r: 560, offset: 1050, tall: false, name: 'Coral Bay' } },
  { id: 'VLC', name: 'Volcano Strip', icao: 'VLCS', x: -7000, z: 14900, heading: 100, length: 1150, kind: 'island', elev: 70 },
  { id: 'NTH', name: 'Northport', icao: 'NTHP', x: -3000, z: -15000, heading: 90, length: 1600, kind: 'island', minElev: 6 },
];

export interface City { id: string; name: string; x: number; z: number; r: number; elev: number; tall: boolean; airportId: string }

export const AIRPORTS: Airport[] = [];
export const CITIES: City[] = [];

for (const d of AIRPORT_DEFS) {
  const hd = (d.heading * Math.PI) / 180;
  const ap: Airport = {
    id: d.id, name: d.name, icao: d.icao, x: d.x, z: d.z, headingDeg: d.heading, heading: hd, length: d.length,
    width: d.length > 2400 ? 60 : d.length > 1500 ? 45 : 32, kind: d.kind, elev: 0,
    fwd: { x: Math.sin(hd), z: -Math.cos(hd) }, right: { x: Math.cos(hd), z: Math.sin(hd) },
  };
  ap.elev = d.elev ?? Math.max(d.minElev ?? 5, Math.round(baseHeight(d.x, d.z)));
  if (d.city) {
    ap.cityId = d.id + '_CITY';
    CITIES.push({
      id: ap.cityId, name: d.city.name, x: d.x + ap.right.x * d.city.offset, z: d.z + ap.right.z * d.city.offset,
      r: d.city.r, elev: ap.elev, tall: d.city.tall, airportId: d.id,
    });
  }
  AIRPORTS.push(ap);
}

export interface Helipad { id: string; name: string; x: number; z: number; elev: number }
export const HELIPADS: Helipad[] = CITIES.filter((c) => ['SKY', 'MRD', 'HBR', 'ALP'].includes(c.airportId)).map((c) => ({
  id: 'H_' + c.airportId,
  name: c.name + ' General Hospital',
  x: c.x + 170,
  z: c.z + 120,
  elev: c.elev,
}));

export const getAirport = (id: string) => AIRPORTS.find((a) => a.id === id)!;
export const getCity = (id: string) => CITIES.find((c) => c.id === id)!;
export const getHelipad = (id: string) => HELIPADS.find((h) => h.id === id)!;

/** Runway-local coordinates: u along runway heading (from centre), v to the right. */
export function airportLocal(ap: Airport, x: number, z: number) {
  const dx = x - ap.x;
  const dz = z - ap.z;
  return { u: dx * ap.fwd.x + dz * ap.fwd.z, v: dx * ap.right.x + dz * ap.right.z };
}
export function airportToWorld(ap: Airport, u: number, v: number) {
  return { x: ap.x + ap.fwd.x * u + ap.right.x * v, z: ap.z + ap.fwd.z * u + ap.right.z * v };
}
const HV = 450;
export function airportSdf(ap: Airport, x: number, z: number): number {
  const { u, v } = airportLocal(ap, x, z);
  const qx = Math.max(Math.abs(u) - (ap.length / 2 + 300), 0);
  const qy = Math.max(Math.abs(v) - HV, 0);
  return Math.hypot(qx, qy);
}
export function nearestAirport(x: number, z: number): { ap: Airport; dist: number } {
  let best = AIRPORTS[0];
  let bd = Infinity;
  for (const a of AIRPORTS) {
    const d = Math.hypot(a.x - x, a.z - z);
    if (d < bd) { bd = d; best = a; }
  }
  return { ap: best, dist: bd };
}
export function airportAt(x: number, z: number, margin = 0): Airport | null {
  for (const a of AIRPORTS) {
    if (Math.abs(a.x - x) > 3500 || Math.abs(a.z - z) > 3500) continue;
    if (airportSdf(a, x, z) <= margin) return a;
  }
  return null;
}
export function onRunway(ap: Airport, x: number, z: number, pad = 0): boolean {
  const { u, v } = airportLocal(ap, x, z);
  return Math.abs(u) <= ap.length / 2 + pad && Math.abs(v) <= ap.width / 2 + pad;
}

const AP_BLEND = 1500;
const CITY_BLEND = 1100;
const AP_REACH = 3200 + AP_BLEND;

/** Final terrain height (airports and cities flatten the natural terrain). */
export function terrainHeight(x: number, z: number): number {
  let h = baseHeight(x, z);
  for (let i = 0; i < CITIES.length; i++) {
    const c = CITIES[i];
    const dx = x - c.x;
    const dz = z - c.z;
    if (Math.abs(dx) > c.r + CITY_BLEND || Math.abs(dz) > c.r + CITY_BLEND) continue;
    const sdf = Math.hypot(dx, dz) - c.r;
    if (sdf < CITY_BLEND) h = lerp(c.elev, h, smoothstep(0, CITY_BLEND, sdf));
  }
  for (let i = 0; i < AIRPORTS.length; i++) {
    const a = AIRPORTS[i];
    if (Math.abs(x - a.x) > AP_REACH || Math.abs(z - a.z) > AP_REACH) continue;
    const sdf = airportSdf(a, x, z);
    if (sdf < AP_BLEND) h = lerp(a.elev, h, smoothstep(0, AP_BLEND, sdf));
  }
  return h;
}

/** Distance to the nearest flattened site (used to keep trees away). */
export function siteDistance(x: number, z: number): number {
  let d = Infinity;
  for (const a of AIRPORTS) {
    if (Math.abs(x - a.x) > 4000 || Math.abs(z - a.z) > 4000) continue;
    d = Math.min(d, airportSdf(a, x, z));
  }
  for (const c of CITIES) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
  return d;
}

export function forestDensity(x: number, z: number, h: number): number {
  if (h < 4 || h > 1300) return 0;
  const des = desertAmount(x, z);
  if (des > 0.25) return 0;
  const n = fbm(x * 0.0011 + 70, z * 0.0011, 3, 57);
  const tree = smoothstep(0.42, 0.58, n) * (1 - smoothstep(900, 1300, h)) * (1 - des * 4);
  return tree;
}

export type Surface = 'pavement' | 'grass' | 'sand' | 'snow' | 'rock' | 'water';
export function surfaceAt(x: number, z: number, h: number): Surface {
  if (h <= 0.05) return 'water';
  const ap = airportAt(x, z, 0);
  if (ap) {
    const { u, v } = airportLocal(ap, x, z);
    if (Math.abs(u) <= ap.length / 2 + 120 && (Math.abs(v) <= ap.width / 2 + 6 || (v > 90 && v < 385))) return 'pavement';
    if (Math.abs(v - 110) < 14) return 'pavement';
  }
  for (const c of CITIES) {
    if (Math.abs(x - c.x) < 200 && Math.abs(z - c.z) < 200) {
      const hp = HELIPADS.find((p) => p.x === c.x + 170 && p.z === c.z + 120);
      if (hp && Math.hypot(x - hp.x, z - hp.z) < 22) return 'pavement';
    }
  }
  if (desertAmount(x, z) > 0.5 || h < 3) return 'sand';
  if (h > 2000) return 'snow';
  return 'grass';
}

/* ------------------------------------------------------------------ */
/* Structures / obstacles                                              */
/* ------------------------------------------------------------------ */
export interface AirportStructure { type: 'terminal' | 'hangar' | 'tower' | 'tank' | 'concourse'; v: number; u: number; w: number; d: number; h: number }

const structCache = new Map<string, AirportStructure[]>();
export function airportStructures(ap: Airport): AirportStructure[] {
  const hit = structCache.get(ap.id);
  if (hit) return hit;
  const s: AirportStructure[] = [];
  const big = ap.kind === 'international';
  if (big) {
    s.push({ type: 'terminal', v: 330, u: 0, w: 46, d: 260, h: 22 });
    s.push({ type: 'concourse', v: 280, u: -40, w: 18, d: 120, h: 12 });
    s.push({ type: 'tower', v: 240, u: -330, w: 9, d: 9, h: 52 });
    s.push({ type: 'hangar', v: 345, u: 520, w: 70, d: 80, h: 20 });
    s.push({ type: 'hangar', v: 345, u: 640, w: 70, d: 80, h: 20 });
    s.push({ type: 'tank', v: 395, u: -520, w: 22, d: 22, h: 14 });
    s.push({ type: 'tank', v: 395, u: -560, w: 22, d: 22, h: 14 });
  } else {
    s.push({ type: 'terminal', v: 200, u: 0, w: 20, d: 70, h: 9 });
    s.push({ type: 'tower', v: 190, u: -60, w: 5, d: 5, h: 22 });
    s.push({ type: 'hangar', v: 210, u: 140, w: 34, d: 40, h: 11 });
  }
  structCache.set(ap.id, s);
  return s;
}

export interface Building { x: number; z: number; w: number; d: number; h: number; shade: number }
const CELL = 70;
const cityCache = new Map<string, (Building | null)[]>();

function cityBuildingRaw(c: City, i: number, j: number): Building | null {
  const bx = i * CELL;
  const bz = j * CELL;
  const dist = Math.hypot(bx, bz);
  if (dist > c.r - 45) return null;
  const hx = c.x + 170 - (c.x + bx);
  const hz = c.z + 120 - (c.z + bz);
  if (HELIPADS.some((p) => p.x === c.x + 170 && p.z === c.z + 120) && Math.hypot(hx, hz) < 95) return null;
  const seed = c.x * 0.37 + c.z * 0.11;
  const r1 = hash2(i, j, seed | 0);
  const r2 = hash2(i + 91, j - 13, seed | 0);
  const r3 = hash2(i - 7, j + 55, seed | 0);
  if (r1 < (c.tall ? 0.08 : 0.2)) return null;
  const t = 1 - dist / c.r;
  let h: number;
  let w: number;
  let d: number;
  if (c.tall) {
    h = 10 + Math.pow(t, 1.7) * 190 * (0.25 + r2) + r3 * 14;
    w = 30 + r3 * 24;
    d = 30 + r2 * 24;
  } else {
    h = 5 + r2 * 9;
    w = 14 + r3 * 12;
    d = 14 + r1 * 12;
  }
  return { x: c.x + bx + (r3 - 0.5) * 6, z: c.z + bz + (r2 - 0.5) * 6, w, d, h, shade: r1 };
}

export function cityBuilding(c: City, i: number, j: number): Building | null {
  let arr = cityCache.get(c.id);
  const n = Math.ceil(c.r / CELL) + 1;
  if (!arr) {
    arr = new Array((2 * n + 1) * (2 * n + 1)).fill(undefined);
    cityCache.set(c.id, arr);
  }
  if (Math.abs(i) > n || Math.abs(j) > n) return null;
  const idx = (i + n) * (2 * n + 1) + (j + n);
  let b = arr[idx];
  if (b === undefined) {
    b = cityBuildingRaw(c, i, j);
    arr[idx] = b;
  }
  return b;
}

export function cityGridRange(c: City) {
  return Math.ceil(c.r / CELL);
}
export const CITY_CELL = CELL;

/** True when a sphere at (x,y,z) with radius r intersects a building / airport structure. */
export function hitsObstacle(x: number, y: number, z: number, r: number): boolean {
  for (const c of CITIES) {
    if (Math.abs(x - c.x) > c.r + 60 || Math.abs(z - c.z) > c.r + 60) continue;
    if (y > c.elev + 260) continue;
    const ci = Math.round((x - c.x) / CELL);
    const cj = Math.round((z - c.z) / CELL);
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        const b = cityBuilding(c, i, j);
        if (!b) continue;
        if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r && y < c.elev + b.h + r * 0.5 && y > c.elev - 2) return true;
      }
    }
  }
  for (const a of AIRPORTS) {
    if (Math.abs(x - a.x) > 1900 || Math.abs(z - a.z) > 1900) continue;
    if (y > a.elev + 70) continue;
    const { u, v } = airportLocal(a, x, z);
    for (const s of airportStructures(a)) {
      if (Math.abs(v - s.v) < s.w / 2 + r && Math.abs(u - s.u) < s.d / 2 + r && y < a.elev + s.h + r * 0.5 && y > a.elev - 2) return true;
    }
  }
  return false;
}

export function windowsClamp(v: number) { return clamp(v, 0, 1); }
