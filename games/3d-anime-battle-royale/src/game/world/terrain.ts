import { DistrictInfo, RoadInfo, World } from './colliders';
import { clamp, fbm, lerp, segDist, smoothstep, vnoise } from '../util';

export function coastR(ang: number) {
  return 585 + 40 * Math.sin(ang * 3 + 1) + 28 * Math.sin(ang * 5 + 2.3) + 18 * Math.sin(ang * 9 + 0.7);
}
const pol = (ang: number, inset: number): [number, number] => {
  const r = coastR(ang) - inset;
  return [Math.cos(ang) * r, Math.sin(ang) * r];
};

const harbor = pol(-0.38, 62);
const resort = pol(2.12, 66);

export const DISTRICTS: DistrictInfo[] = [
  { id: 'neon', name: 'NEON CITY', x: 70, z: -40, r: 135, color: '#ff4fd8', loot: 1.45, danger: 0.9, kind: 'city' },
  { id: 'iron', name: 'IRON FORTRESS', x: -385, z: -190, r: 120, color: '#9aa5b1', loot: 1.95, danger: 1.0, kind: 'military' },
  { id: 'green', name: 'GREEN VALLEY', x: -300, z: 175, r: 120, color: '#4ade80', loot: 0.75, danger: 0.3, kind: 'forest' },
  { id: 'dust', name: 'DUST TOWN', x: 330, z: 215, r: 110, color: '#f6ad55', loot: 0.95, danger: 0.4, kind: 'desert' },
  { id: 'harbor', name: 'STORM HARBOR', x: harbor[0], z: harbor[1], r: 115, color: '#38bdf8', loot: 1.25, danger: 0.65, kind: 'harbor' },
  { id: 'power', name: 'POWER PLANT', x: 30, z: 270, r: 120, color: '#facc15', loot: 1.5, danger: 0.75, kind: 'industrial' },
  { id: 'frost', name: 'FROST RIDGE', x: -70, z: -410, r: 110, color: '#bfe3ff', loot: 1.15, danger: 0.4, kind: 'mountain' },
  { id: 'resort', name: 'SUNSET RESORT', x: resort[0], z: resort[1], r: 120, color: '#fb923c', loot: 0.95, danger: 0.5, kind: 'resort' },
];
const ELEV: Record<string, number> = { neon: 7, iron: 16, dust: 9, harbor: 2.5, power: 8, frost: 38, resort: 2.7 };

export const RIVER: [number, number][] = [
  [-105, -330], [-150, -250], [-205, -160], [-240, -70], [-285, 15], [-370, 70], [-450, 110], [-530, 170], [-640, 210],
];
const riverHW = (i: number) => 6 + i * 0.7;

export function riverDist(x: number, z: number) {
  let d = 1e9, hw = 7;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const s = segDist(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]);
    if (s < d) { d = s; hw = riverHW(i); }
  }
  return { d, hw };
}

const D = (id: string) => DISTRICTS.find((d) => d.id === id)!;
function mkRoad(a: [number, number], b: [number, number], seed: number, via: [number, number][] = []): RoadInfo {
  const pts: [number, number][] = [a, ...via, b];
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    const segs = Math.max(2, Math.round(len / 45));
    for (let k = 0; k < segs; k++) {
      const t = k / segs;
      const off = (vnoise(i * 7 + t * 5, seed, 9) - 0.5) * 50 * Math.sin(t * Math.PI);
      out.push([lerp(ax, bx, t) + nx * off, lerp(az, bz, t) + nz * off]);
    }
  }
  out.push(pts[pts.length - 1]);
  return { pts: out, width: 7 };
}
const c = (id: string): [number, number] => [D(id).x, D(id).z];
export const ROADS: RoadInfo[] = [
  mkRoad(c('neon'), c('iron'), 1, [[-150, -120]]),
  mkRoad(c('neon'), c('power'), 2),
  mkRoad(c('neon'), c('dust'), 3, [[200, 80]]),
  mkRoad(c('neon'), c('harbor'), 4, [[280, -110]]),
  mkRoad(c('neon'), c('frost'), 5),
  mkRoad(c('iron'), c('green'), 6, [[-360, 0]]),
  mkRoad(c('green'), c('resort'), 7, [[-290, 320]]),
  mkRoad(c('resort'), c('power'), 8, [[-120, 400]]),
  mkRoad(c('power'), c('dust'), 9, [[190, 250]]),
  mkRoad(c('frost'), c('iron'), 10, [[-220, -330]]),
  mkRoad(c('harbor'), c('dust'), 11, [[450, 40]]),
];

export function roadDist(x: number, z: number) {
  let best = 1e9;
  for (const r of ROADS) for (let i = 0; i < r.pts.length - 1; i++) {
    const d = segDist(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]);
    if (d < best) best = d;
  }
  return best;
}

export interface BridgeSite { x: number; z: number; y: number; approach: boolean; deck: boolean }

export function findBridges(heightNoRiver: (x: number, z: number) => number) {
  const sites: BridgeSite[] = [];
  for (const r of ROADS) {
    const samples: { x: number; z: number; wet: boolean }[] = [];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(L / 3);
      for (let k = 0; k < n; k++) {
        const x = lerp(ax, bx, k / n), z = lerp(az, bz, k / n);
        const rd = riverDist(x, z);
        samples.push({ x, z, wet: rd.d < rd.hw + 5.5 });
      }
    }
    for (let i = 0; i < samples.length; i++) {
      if (!samples[i].wet || (i > 0 && samples[i - 1].wet)) continue;
      let j = i;
      while (j + 1 < samples.length && samples[j + 1].wet) j++;
      const a = samples[Math.max(0, i - 3)], b = samples[Math.min(samples.length - 1, j + 3)];
      const y = (heightNoRiver(a.x, a.z) + heightNoRiver(b.x, b.z)) / 2;
      for (let k = i - 3; k <= j + 3; k++) {
        if (k < 0 || k >= samples.length) continue;
        const wet = k >= i && k <= j;
        sites.push({ x: samples[k].x, z: samples[k].z, y, approach: !wet, deck: wet });
      }
      i = j;
    }
  }
  return sites;
}

export function baseHeight(x: number, z: number) {
  const r = Math.hypot(x, z), ang = Math.atan2(z, x);
  const t = (coastR(ang) - r) / 150;
  let h = lerp(-7, 2.3, smoothstep(-0.3, 0.22, t));
  if (t < -0.3) h += (t + 0.3) * 30;
  const inl = smoothstep(0.05, 0.4, t);
  const hills = fbm(x * 0.0035, z * 0.0035, 4, 3);
  h += ((hills - 0.45) * 40 + fbm(x * 0.015, z * 0.015, 3, 5) * 5) * inl;
  // Frost Ridge mountain range
  const f = D('frost');
  const d1 = Math.hypot(x - f.x, (z - f.z) * 0.8), d2 = Math.hypot(x - (f.x + 170), z - (f.z - 20));
  const rid = 0.65 + 0.7 * fbm(x * 0.012, z * 0.012, 3, 11);
  h += (105 * Math.exp(-(d1 * d1) / (2 * 150 * 150)) + 55 * Math.exp(-(d2 * d2) / (2 * 80 * 80))) * rid * inl;
  // Green valley sits lower with rolling hills
  const g = D('green');
  const dg = Math.hypot(x - g.x, z - g.z);
  h -= 3 * Math.exp(-(dg * dg) / (2 * 110 * 110)) * inl;
  // keep inland terrain above sea level (soft floor) so only rivers form water inland
  {
    const fl = lerp(-50, 1.9, smoothstep(0.2, 0.45, t));
    const k = 3;
    h = 0.5 * (h + fl + Math.sqrt((h - fl) * (h - fl) + k * k));
  }
  // district plateaus
  for (const d of DISTRICTS) {
    const e = ELEV[d.id];
    if (e === undefined) continue;
    const dd = Math.hypot(x - d.x, z - d.z);
    let w = 1 - smoothstep(d.r * 0.8, d.r * 1.4, dd);
    if (d.id === 'frost') w = 1 - smoothstep(d.r * 0.55, d.r * 1.0, dd);
    if (d.id === 'harbor' || d.id === 'resort') w *= smoothstep(-4, 0, h);
    h = lerp(h, e, w);
  }
  return h;
}

export function buildHeightField(size: number, res: number) {
  const half = size / 2;
  const n = Math.round(size / res) + 1;
  const hf = new Float32Array(n * n);
  const noRiver = (x: number, z: number) => baseHeight(x, z);
  const bridges = findBridges(noRiver);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * res - half, z = j * res - half;
    let h = baseHeight(x, z);
    const rd = riverDist(x, z);
    if (rd.d < rd.hw + 12) {
      const cc = 1 - smoothstep(rd.hw * 0.7, rd.hw + 10, rd.d);
      h = lerp(h, Math.min(h, -1.15), cc);
    }
    hf[j * n + i] = h;
  }
  // bridge approaches override
  for (const b of bridges) {
    if (!b.approach) continue;
    const ci = Math.round((b.x + half) / res), cj = Math.round((b.z + half) / res);
    const rr = Math.ceil(9 / res);
    for (let j = cj - rr; j <= cj + rr; j++) for (let i = ci - rr; i <= ci + rr; i++) {
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const d = Math.hypot(i * res - half - b.x, j * res - half - b.z);
      const w = 1 - smoothstep(5, 9, d);
      if (w > 0) hf[j * n + i] = lerp(hf[j * n + i], b.y, w);
    }
  }
  return { hf, n, bridges };
}

export function sampleHF(hf: Float32Array, n: number, half: number, res: number, x: number, z: number) {
  const fx = clamp((x + half) / res, 0, n - 1.001), fz = clamp((z + half) / res, 0, n - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz);
  const tx = fx - i, tz = fz - j;
  const a = hf[j * n + i], b = hf[j * n + i + 1], cc = hf[(j + 1) * n + i], d = hf[(j + 1) * n + i + 1];
  return (a + (b - a) * tx) * (1 - tz) + (cc + (d - cc) * tx) * tz;
}

export const MAP_PX = 1536;

export function drawMapTexture(w: World): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = MAP_PX;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(MAP_PX, MAP_PX);
  const px = w.size / MAP_PX;
  const frost = D('frost');
  const col = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const GRASS = col('#7cc15f'), GRASS2 = col('#5fa84c'), SAND = col('#eadba5'), ROCK = col('#8b8578'), SNOW = col('#f4f8fc'), DESERT = col('#dcb877'), LUSH = col('#3f9150');
  const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const pave: Record<string, [number, number, number]> = {
    neon: col('#8e94a3'), iron: col('#7d836f'), power: col('#8b908a'), harbor: col('#8a8e95'), resort: col('#efe2bd'),
  };
  for (let j = 0; j < MAP_PX; j++) for (let i = 0; i < MAP_PX; i++) {
    const x = i * px - w.half, z = j * px - w.half;
    const h = w.heightAt(x, z);
    let c: number[];
    if (h < 0) {
      const dp = clamp(-h / 6, 0, 1);
      c = mix(col('#52d0dc'), col('#1b5c92'), Math.pow(dp, 0.6));
      if (h > -0.35) c = mix([255, 255, 255], c, smoothstep(0, -0.35, h) * 0.9 + 0.1);
    } else {
      const nz = fbm(x * 0.03, z * 0.03, 3, 21);
      c = mix(GRASS, GRASS2, nz);
      const slope = Math.abs(w.heightAt(x + 3, z) - h) + Math.abs(w.heightAt(x, z + 3) - h);
      if (h < 1.7) c = mix(SAND, c, smoothstep(0.2, 1.7, h) * 0.9);
      for (const d of DISTRICTS) {
        const dd = Math.hypot(x - d.x, z - d.z);
        if (d.id === 'dust') c = mix(c, DESERT, 1 - smoothstep(d.r * 1.0, d.r * 2.1, dd));
        else if (d.id === 'green') c = mix(c, LUSH, (1 - smoothstep(d.r * 0.6, d.r * 1.8, dd)) * 0.85);
        else if (pave[d.id]) c = mix(c, mix(pave[d.id], c, nz * 0.2), 1 - smoothstep(d.r * 0.55, d.r * 0.9, dd));
      }
      if (h > 22) c = mix(c, ROCK, smoothstep(22, 45, h) * 0.9);
      if (h > 32 + nz * 10) c = mix(c, SNOW, smoothstep(32, 48, h));
      const df = Math.hypot(x - frost.x, z - frost.z);
      if (df < 90) c = mix(c, SNOW, 1 - smoothstep(40, 90, df));
      if (slope > 5.5) c = mix(c, ROCK, clamp((slope - 5.5) / 6, 0, 0.85));
    }
    const sh = 1 + (w.heightAt(x - 6, z - 6) - w.heightAt(x + 6, z + 6)) * 0.012;
    const k = (j * MAP_PX + i) * 4;
    img.data[k] = clamp(c[0] * sh, 0, 255); img.data[k + 1] = clamp(c[1] * sh, 0, 255); img.data[k + 2] = clamp(c[2] * sh, 0, 255); img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const s = MAP_PX / w.size;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([x, z], i) => { const X = (x + w.half) * s, Y = (z + w.half) * s; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
  };
  for (const r of ROADS) {
    ctx.strokeStyle = '#555a66'; ctx.lineWidth = (r.width + 2) * s; path(r.pts); ctx.stroke();
    ctx.strokeStyle = '#3b3f4a'; ctx.lineWidth = r.width * s; path(r.pts); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,120,0.55)'; ctx.lineWidth = 0.35 * s; ctx.setLineDash([3 * s, 4 * s]); path(r.pts); ctx.stroke(); ctx.setLineDash([]);
  }
  return cv;
}

export function buildNav(w: World, bridgeDecks: { x: number; z: number }[]) {
  const cell = 10;
  const n = Math.ceil(w.size / cell);
  const nav = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * cell - w.half, z = (j + 0.5) * cell - w.half;
    const h = w.heightAt(x, z);
    let bad = h < -0.25;
    if (!bad) {
      const s = Math.max(Math.abs(w.heightAt(x + 5, z) - h), Math.abs(w.heightAt(x, z + 5) - h), Math.abs(w.heightAt(x - 5, z) - h), Math.abs(w.heightAt(x, z - 5) - h));
      if (s > 4.4) bad = true;
    }
    nav[j * n + i] = bad ? 1 : 0;
  }
  for (const b of bridgeDecks) {
    const i = Math.floor((b.x + w.half) / cell), j = Math.floor((b.z + w.half) / cell);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < n && jj < n && Math.hypot(ii * cell + cell / 2 - w.half - b.x, jj * cell + cell / 2 - w.half - b.z) < 9) nav[jj * n + ii] = 0;
    }
  }
  return { nav, n, cell };
}
