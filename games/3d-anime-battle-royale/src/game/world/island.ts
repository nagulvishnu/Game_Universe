import { ColliderGrid, RenderData, World } from './colliders';
import { Builder, Decal, building, genDust, genFrost, genGreen, genHarbor, genIron, genNeon, genPower, genResort, genVehicles } from './builders';
import { DISTRICTS, MAP_PX, buildHeightField, buildNav, drawMapTexture, roadDist, riverDist, sampleHF } from './terrain';
import { WORLD_SIZE } from '../data/config';
import { fbm, mulberry32, smoothstep, lerp } from '../util';

let cached: World | null = null;

function emptyRender(): RenderData { return { boxes: [], emis: [], cyl: [], cones: [], trees: [], props: [] }; }

export function getIslandWorld(): World {
  if (cached) return cached;
  const size = WORLD_SIZE, half = size / 2, res = 2;
  const { hf, n, bridges } = buildHeightField(size, res);
  const h1 = (x: number, z: number) => sampleHF(hf, n, half, res, x, z);
  const grid = new ColliderGrid(half);
  const render = emptyRender();
  const rng = mulberry32(4242);
  const b = new Builder(grid, render, rng, h1);

  // bridges
  const decks: { x: number; z: number }[] = [];
  for (const s of bridges) {
    if (!s.deck) continue;
    b.box(s.x - 3.3, s.y - 0.6, s.z - 3.3, s.x + 3.3, s.y + 0.12, s.z + 3.3, 0x8d939e);
    b.box(s.x - 3.5, s.y + 0.12, s.z - 3.5, s.x + 3.5, s.y + 0.9, s.z - 3.2, 0x6b7280, false);
    decks.push({ x: s.x, z: s.z });
    b.reserve(s.x - 4, s.z - 4, s.x + 4, s.z + 4);
  }

  genIron(b); genPower(b); genHarbor(b); genNeon(b); genResort(b); genFrost(b); genDust(b); genGreen(b);
  const vehicleSpots = genVehicles(b);

  // apply terrain stamps
  for (const s of b.stamps) {
    const i0 = Math.max(0, Math.floor((s.x0 - s.margin + half) / res)), i1 = Math.min(n - 1, Math.ceil((s.x1 + s.margin + half) / res));
    const j0 = Math.max(0, Math.floor((s.z0 - s.margin + half) / res)), j1 = Math.min(n - 1, Math.ceil((s.z1 + s.margin + half) / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * res - half, z = j * res - half;
      const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1);
      const d = Math.hypot(dx, dz);
      const w = 1 - smoothstep(0, s.margin, d);
      if (w > 0) hf[j * n + i] = lerp(hf[j * n + i], s.y, w);
    }
  }

  const heightAt = (x: number, z: number) => sampleHF(hf, n, half, res, x, z);
  const world: World = {
    kind: 'island', size, half, res, n, heights: hf, grid, render, districts: DISTRICTS, roads: [], lootSpots: b.lootSpots, buildings: b.buildings,
    vehicleSpots, mapCanvas: null, nav: null, navCell: 10, navN: 0, heightAt, landAt: (x, z) => heightAt(x, z) > 0.05,
  };

  // vegetation
  const tr = mulberry32(777);
  const frost = DISTRICTS.find((d) => d.id === 'frost')!;
  const green = DISTRICTS.find((d) => d.id === 'green')!;
  const resort = DISTRICTS.find((d) => d.id === 'resort')!;
  const urban = DISTRICTS.filter((d) => !['green', 'frost', 'dust', 'resort'].includes(d.id));
  let count = 0;
  for (let x = -half + 6; x < half - 6; x += 5.5) for (let z = -half + 6; z < half - 6; z += 5.5) {
    if (count > 7500) break;
    const px = x + (tr() - 0.5) * 5, pz = z + (tr() - 0.5) * 5;
    const h = heightAt(px, pz);
    if (h < 1.9 || h > 66) continue;
    let dens = 0.05 + (fbm(px * 0.012, pz * 0.012, 2, 31) > 0.55 ? 0.22 : 0);
    const dg = Math.hypot(px - green.x, pz - green.z);
    dens += 0.62 * (1 - smoothstep(green.r * 0.9, green.r * 2.2, dg));
    const df = Math.hypot(px - frost.x, pz - frost.z);
    if (h < 56) dens += 0.2 * (1 - smoothstep(60, 240, df));
    const dr = Math.hypot(px - resort.x, pz - resort.z);
    const palm = dr < resort.r * 1.5 && h < 4.5;
    if (palm) dens = 0.14;
    for (const u of urban) if (Math.hypot(px - u.x, pz - u.z) < u.r * 0.95) dens = 0;
    if (tr() > dens) continue;
    if (roadDist(px, pz) < 6) continue;
    const rv = riverDist(px, pz);
    if (rv.d < rv.hw + 2.5) continue;
    let inFp = false;
    for (const f of b.fps) if (px > f[0] - 2.5 && px < f[2] + 2.5 && pz > f[1] - 2.5 && pz < f[3] + 2.5) { inFp = true; break; }
    if (inFp) continue;
    const pine = !palm && (h > 24 || df < 220 || (dg < 260 && tr() < 0.3));
    const type = palm ? 2 : pine ? 1 : 0;
    const sc = 0.8 + tr() * 0.7;
    render.trees.push(px, h, pz, sc, type);
    grid.add(px - 0.4, h - 1, pz - 0.4, px + 0.4, h + 6, pz + 0.4);
    count++;
  }
  // rocks on mountains
  for (let k = 0; k < 400; k++) {
    const x = frost.x + (tr() - 0.5) * 520, z = frost.z + (tr() - 0.3) * 360;
    const h = heightAt(x, z);
    if (h < 28) continue;
    const s = 1.2 + tr() * 3.2;
    render.cones.push(x, h + s * 0.3, z, s, s * 0.9, s, 0x8b8579 + Math.floor(tr() * 20) * 0x010101);
    if (s > 2.4) grid.add(x - s * 0.5, h - 1, z - s * 0.5, x + s * 0.5, h + s * 0.7, z + s * 0.5);
  }
  grid.finalize();

  world.mapCanvas = drawMapTexture(world);
  drawDecals(world.mapCanvas, b.decals, world);
  const nav = buildNav(world, decks);
  world.nav = nav.nav; world.navN = nav.n; world.navCell = nav.cell;
  cached = world;
  return world;
}

function drawDecals(cv: HTMLCanvasElement, decals: Decal[], w: World) {
  const ctx = cv.getContext('2d')!;
  const s = MAP_PX / w.size;
  for (const d of decals) {
    ctx.fillStyle = d.color;
    const X = (d.x + w.half) * s, Y = (d.z + w.half) * s;
    if (d.round) { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(X, Y, (d.w / 2) * s, (d.d / 2) * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    else ctx.fillRect(X - (d.w / 2) * s, Y - (d.d / 2) * s, d.w * s, d.d * s);
  }
}

/* ---------- Training ground ---------- */
let trainCached: World | null = null;
export function getTrainingWorld(): World {
  if (trainCached) return trainCached;
  const size = 240, half = 120, res = 2;
  const n = Math.round(size / res) + 1;
  const hf = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * res - half, z = j * res - half;
    hf[j * n + i] = 2 + (Math.hypot(x - 70, z + 60) < 25 ? Math.cos(Math.hypot(x - 70, z + 60) / 25 * Math.PI / 2) * 4 : 0);
  }
  const grid = new ColliderGrid(half);
  const render = emptyRender();
  const b = new Builder(grid, render, mulberry32(5), (x, z) => sampleHF(hf, n, half, res, x, z));
  const gy = 2;
  b.district = 'training';
  const wc = 0x5b6b8a;
  b.box(-half + 2, gy, -half + 2, half - 2, gy + 4, -half + 3.5, wc); b.box(-half + 2, gy, half - 3.5, half - 2, gy + 4, half - 2, wc);
  b.box(-half + 2, gy, -half + 2, -half + 3.5, gy + 4, half - 2, wc); b.box(half - 3.5, gy, -half + 2, half - 2, gy + 4, half - 2, wc);
  // firing lanes with dividers
  for (let i = -2; i <= 2; i++) b.box(i * 14 - 0.3, gy, -85, i * 14 + 0.3, gy + 1.3, -50, 0x7a86a0);
  // cover blocks + a small two-story structure for movement practice
  for (const [x, z] of [[-60, 10], [-45, 30], [-80, 40], [60, 30], [75, 55], [40, 70]]) b.box(x - 2.5, gy, z - 1, x + 2.5, gy + 1.4, z + 1, 0x8a94ac);
  building(b, { x: -60, z: 70, w: 16, d: 16, floors: 2, wall: 0xcfd6e6, trim: 0x59607a, loot: 0, doors: 'ns', roofAccess: true, gy, noStamp: true, win: 4 });
  for (let i = 0; i < 6; i++) b.box(-100 + i * 3, gy, 90 - i * 3, -98 + i * 3, gy + 0.5 * (i + 1), 100, 0x7a86a0);
  b.container(90, 90, true, 0xc0392b, gy);
  grid.finalize();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7fa07a'; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 512 / 24) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke(); }
  ctx.fillStyle = '#4b5563'; ctx.fillRect(512 * (35 / 240), 512 * (130 / 240) - 0, 512 * (170 / 240), 512 * (60 / 240) * 0.0);
  ctx.fillStyle = '#5c6677'; ctx.fillRect((half - 75) / size * 512, (half - 95) / size * 512, 150 / size * 512, 50 / size * 512);
  const world: World = {
    kind: 'training', size, half, res, n, heights: hf, grid, render,
    districts: [{ id: 'train', name: 'TRAINING GROUND', x: 0, z: 0, r: 60, color: '#38bdf8', loot: 1, danger: 0, kind: 'training' }],
    roads: [], lootSpots: [], buildings: b.buildings, vehicleSpots: [{ x: 20, z: 20, yaw: 0 }], mapCanvas: canvas, nav: null, navCell: 10, navN: 0,
    heightAt: (x, z) => sampleHF(hf, n, half, res, x, z), landAt: () => true,
  };
  trainCached = world;
  return world;
}
