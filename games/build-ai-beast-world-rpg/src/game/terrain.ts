import { fbm, ridged, smooth, lerp, clamp } from "./noise";

export const SEA = 0;
export const ISLAND_R = 700;
export const TERRAIN_SIZE = 1800;
export const SEG = 300;
export const HALF = TERRAIN_SIZE / 2;
export const CELL = TERRAIN_SIZE / SEG;

export type BiomeId = 0 | 1 | 2 | 3;
export const BIOMES = [
  { id: 0, key: "waste", name: "Cinder Flats", cx: 0, cz: 0, rad: 540 },
  { id: 1, key: "forest", name: "Verdant Reach", cx: -430, cz: -170, rad: 400 },
  { id: 2, key: "desert", name: "Sunscar Dunes", cx: 430, cz: 160, rad: 420 },
  { id: 3, key: "frost", name: "Frostspine Rise", cx: 40, cz: -480, rad: 340 },
];

export interface Site { id: string; x: number; z: number; r: number; minH: number; h: number }
const S = (id: string, x: number, z: number, r: number, minH = 3): Site => ({ id, x, z, r, minH, h: 0 });
export const SITES: Site[] = [
  S("start", 0, 0, 26, 5),
  S("ruins", 70, -95, 24),
  S("village", -120, 90, 36),
  S("stadium", -270, 250, 72, 5),
  S("p_village", -86, 56, 9),
  S("p_stadium", -205, 185, 9),
  S("p_desert", 396, 236, 12),
  S("p_forest", -452, -222, 12),
  S("p_frost", 66, -395, 12),
  S("oasis", 372, 214, 30),
  S("elite_waste", 230, -190, 22),
  S("elite_forest", -400, -290, 22),
  S("elite_desert", 520, 60, 22),
  S("elite_frost", -40, -430, 22),
  S("camp1", 170, -40, 16),
  S("camp2", -150, -30, 16),
  S("camp3", 250, 140, 16),
  S("camp4", -60, 250, 16),
];

const _w = [0, 0, 0, 0];
export function biomeWeights(x: number, z: number, out = _w) {
  const wx = x + (fbm(x * 0.004 + 11, z * 0.004) - 0.5) * 160;
  const wz = z + (fbm(x * 0.004, z * 0.004 + 37) - 0.5) * 160;
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const b = BIOMES[i];
    const d = Math.hypot(wx - b.cx, wz - b.cz);
    const t = Math.max(0, 1 - d / b.rad);
    out[i] = t * t + 1e-4;
    sum += out[i];
  }
  for (let i = 0; i < 4; i++) out[i] /= sum;
  return out;
}

function rawHeight(x: number, z: number) {
  const w = biomeWeights(x, z, [0, 0, 0, 0]);
  let h = 0;
  const n1 = fbm(x * 0.008, z * 0.008, 5);
  if (w[0] > 0.005) {
    const m = fbm(x * 0.006 + 50, z * 0.006 + 20, 3);
    const mesa = smooth(0.56, 0.62, m) * 20;
    const crack = Math.abs(fbm(x * 0.03, z * 0.03, 2) - 0.5) < 0.03 ? -2 : 0;
    h += w[0] * (6 + n1 * 14 + mesa + crack);
  }
  if (w[1] > 0.005) h += w[1] * (10 + fbm(x * 0.006 - 20, z * 0.006, 5) * 38 - 6);
  if (w[2] > 0.005) {
    const dune = Math.abs(Math.sin(x * 0.022 + z * 0.013 + fbm(x * 0.01, z * 0.01, 3) * 4));
    h += w[2] * (6 + dune * 15 + n1 * 8);
  }
  if (w[3] > 0.005) {
    const r = ridged(x * 0.0055 + 3, z * 0.0055, 5);
    h += w[3] * (26 + r * r * r * 200);
  }
  const d = Math.hypot(x, z);
  const rr = ISLAND_R * (1 + (fbm(x * 0.003 + 90, z * 0.003 + 40) - 0.5) * 0.4);
  const m = smooth(rr + 40, rr - 110, d);
  h = h * m + (1 - m) * -32;
  // lakes
  h -= 17 * Math.exp(-(((x - 150) ** 2 + (z - 120) ** 2) / (2 * 30 * 30)));
  h -= 14 * Math.exp(-(((x + 395) ** 2 + (z + 60) ** 2) / (2 * 26 * 26)));
  return h;
}

export class Terrain {
  N = SEG + 1;
  H = new Float32Array((SEG + 1) * (SEG + 1));
  platforms: { x: number; z: number; r: number; top: number }[] = [];
  peak = { x: 0, z: 0, h: 0 };
  constructor() {
    for (const s of SITES) s.h = Math.max(s.minH, rawHeight(s.x, s.z));
    const N = this.N;
    let pk = -1e9;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -HALF + i * CELL, z = -HALF + j * CELL;
        let h = rawHeight(x, z);
        for (const s of SITES) {
          const d = Math.hypot(x - s.x, z - s.z);
          if (d < s.r * 1.5) h = lerp(h, s.h, smooth(s.r * 1.5, s.r, d));
        }
        this.H[j * N + i] = h;
        if (x < 120 && x > -160 && z < -480 && z > -640 && h > pk) { pk = h; this.peak = { x, z, h }; }
      }
    }
  }
  groundAt(x: number, z: number) {
    const N = this.N;
    const fx = clamp((x + HALF) / CELL, 0, SEG - 0.001), fz = clamp((z + HALF) / CELL, 0, SEG - 0.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const H = this.H;
    const a = H[j * N + i], b = H[j * N + i + 1], c = H[(j + 1) * N + i], d = H[(j + 1) * N + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  /** ground including floating platforms below y */
  floorAt(x: number, z: number, y: number) {
    let g = this.groundAt(x, z);
    for (const p of this.platforms) {
      if (y >= p.top - 2.2 && (x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r && p.top > g) g = Math.max(g, p.top);
    }
    return g;
  }
  slopeAt(x: number, z: number) {
    const e = 2;
    const dx = this.groundAt(x + e, z) - this.groundAt(x - e, z);
    const dz = this.groundAt(x, z + e) - this.groundAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }
  biomeAt(x: number, z: number): BiomeId {
    const w = biomeWeights(x, z, [0, 0, 0, 0]);
    let b = 0;
    for (let i = 1; i < 4; i++) if (w[i] > w[b]) b = i;
    return b as BiomeId;
  }
}
