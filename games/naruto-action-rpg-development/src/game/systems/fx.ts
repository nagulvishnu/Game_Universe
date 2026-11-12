// Allocation-free particle + ring buffers. Rendered with InstancedMesh in render/Effects.tsx.
const cache = new Map<string, [number, number, number]>();
export function hexRgb(hex: string): [number, number, number] {
  let c = cache.get(hex);
  if (!c) {
    const h = hex.replace('#', ''); const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const n = parseInt(f, 16); c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; cache.set(hex, c);
  }
  return c;
}

export const MAX_P = 2400;
export const P = {
  cap: 1100, count: 0,
  x: new Float32Array(MAX_P), y: new Float32Array(MAX_P), z: new Float32Array(MAX_P),
  vx: new Float32Array(MAX_P), vy: new Float32Array(MAX_P), vz: new Float32Array(MAX_P),
  life: new Float32Array(MAX_P), maxLife: new Float32Array(MAX_P), size: new Float32Array(MAX_P),
  r: new Float32Array(MAX_P), g: new Float32Array(MAX_P), b: new Float32Array(MAX_P),
  grav: new Float32Array(MAX_P), drag: new Float32Array(MAX_P),
};
export const MAX_RINGS = 28;
export interface Ring { x: number; y: number; z: number; r0: number; r1: number; t: number; life: number; r: number; g: number; b: number; active: boolean; vertical: boolean; yaw: number }
export const rings: Ring[] = Array.from({ length: MAX_RINGS }, () => ({ x: 0, y: 0, z: 0, r0: 0, r1: 1, t: 0, life: 1, r: 1, g: 1, b: 1, active: false, vertical: false, yaw: 0 }));
let ringIdx = 0;

export interface BurstOpts { n?: number; color?: string; color2?: string; speed?: number; life?: number; size?: number; grav?: number; up?: number; spread?: number; drag?: number; ring?: boolean }

export function setParticleCap(n: number) { P.cap = Math.min(MAX_P, n); }

function emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, rgb: [number, number, number], grav: number, drag: number) {
  let i: number;
  if (P.count < P.cap) i = P.count++;
  else i = Math.floor(Math.random() * P.cap); // overwrite a random live particle when saturated
  P.x[i] = x; P.y[i] = y; P.z[i] = z; P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz;
  P.life[i] = life; P.maxLife[i] = life; P.size[i] = size; P.r[i] = rgb[0]; P.g[i] = rgb[1]; P.b[i] = rgb[2]; P.grav[i] = grav; P.drag[i] = drag;
}

export function burst(x: number, y: number, z: number, o: BurstOpts = {}) {
  const n = o.n ?? 12; const sp = o.speed ?? 5; const c1 = hexRgb(o.color ?? '#ffffff'); const c2 = o.color2 ? hexRgb(o.color2) : c1;
  const spread = o.spread ?? 1;
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2; const e = (Math.random() - 0.3) * spread; const s = sp * (0.35 + Math.random() * 0.65);
    const rgb = Math.random() < 0.5 ? c1 : c2;
    emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + (o.up ?? 0), Math.sin(a) * Math.cos(e) * s, (o.life ?? 0.6) * (0.6 + Math.random() * 0.6), (o.size ?? 0.22) * (0.6 + Math.random() * 0.8), rgb, o.grav ?? 0, o.drag ?? 1.5);
  }
}
/** Particles spiralling toward/around a point (chakra swirl). */
export function swirl(x: number, y: number, z: number, radius: number, color: string, n = 2, t = 0) {
  const c = hexRgb(color);
  for (let k = 0; k < n; k++) {
    const a = t * 9 + (k / n) * Math.PI * 2 + Math.random();
    emit(x + Math.cos(a) * radius, y + (Math.random() - 0.5) * radius, z + Math.sin(a) * radius, -Math.cos(a) * radius * 2, 0.2, -Math.sin(a) * radius * 2, 0.35, 0.12, c, 0, 1);
  }
}
export function trail(x: number, y: number, z: number, color: string, size = 0.25, life = 0.35) {
  emit(x + (Math.random() - 0.5) * 0.2, y + (Math.random() - 0.5) * 0.2, z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, life, size, hexRgb(color), 0, 2);
}
export function dust(x: number, y: number, z: number, n = 4, color = '#cbb98a') {
  const c = hexRgb(color);
  for (let k = 0; k < n; k++) { const a = Math.random() * 6.28; emit(x, y + 0.1, z, Math.cos(a) * 1.5, 0.8 + Math.random(), Math.sin(a) * 1.5, 0.5 + Math.random() * 0.3, 0.3 + Math.random() * 0.2, c, -1, 2.5); }
}
export function ring(x: number, y: number, z: number, o: { color: string; r0?: number; r1: number; life?: number; vertical?: boolean; yaw?: number }) {
  const r = rings[ringIdx++ % MAX_RINGS]; const c = hexRgb(o.color);
  r.x = x; r.y = y; r.z = z; r.r0 = o.r0 ?? 0.2; r.r1 = o.r1; r.t = 0; r.life = o.life ?? 0.45; r.r = c[0]; r.g = c[1]; r.b = c[2]; r.active = true;
  r.vertical = !!o.vertical; r.yaw = o.yaw ?? 0;
}
export function lineBurst(x0: number, z0: number, x1: number, z1: number, y: number, color: string, n = 12) {
  for (let i = 0; i < n; i++) { const t = i / n; trail(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, color, 0.3, 0.4); }
}

export function updateFx(dt: number) {
  for (let i = 0; i < P.count; i++) {
    P.life[i] -= dt;
    if (P.life[i] <= 0) {
      const l = --P.count; // swap-remove
      if (i !== l) {
        P.x[i] = P.x[l]; P.y[i] = P.y[l]; P.z[i] = P.z[l]; P.vx[i] = P.vx[l]; P.vy[i] = P.vy[l]; P.vz[i] = P.vz[l];
        P.life[i] = P.life[l]; P.maxLife[i] = P.maxLife[l]; P.size[i] = P.size[l]; P.r[i] = P.r[l]; P.g[i] = P.g[l]; P.b[i] = P.b[l]; P.grav[i] = P.grav[l]; P.drag[i] = P.drag[l];
      }
      i--; continue;
    }
    const d = Math.max(0, 1 - P.drag[i] * dt);
    P.vx[i] *= d; P.vz[i] *= d; P.vy[i] = P.vy[i] * d - P.grav[i] * dt;
    P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
    if (P.y[i] < 0.02) { P.y[i] = 0.02; P.vy[i] = 0; }
  }
  for (const r of rings) if (r.active) { r.t += dt; if (r.t >= r.life) r.active = false; }
}
export function clearFx() { P.count = 0; rings.forEach((r) => (r.active = false)); }
