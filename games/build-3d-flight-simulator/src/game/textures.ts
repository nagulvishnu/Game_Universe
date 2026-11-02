import * as THREE from 'three';
import type { Airport } from './worldData';
import { mulberry32 } from './noise';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function tex(c: HTMLCanvasElement, repeat = false, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let _glow: THREE.CanvasTexture | null = null;
export function glowTexture() {
  if (_glow) return _glow;
  const { c, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _glow = tex(c);
  return _glow;
}

let _noise: THREE.CanvasTexture | null = null;
/** Neutral grain used to add detail to terrain vertex colours. */
export function detailTexture() {
  if (_noise) return _noise;
  const { c, ctx } = canvas(256, 256);
  const rnd = mulberry32(7);
  const img = ctx.createImageData(256, 256);
  const base = new Float32Array(256 * 256);
  for (let k = 0; k < 4; k++) {
    const sz = 8 << k;
    const grid = new Float32Array((sz + 1) * (sz + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const fx = (x / 256) * sz;
        const fy = (y / 256) * sz;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fx - x0;
        const ty = fy - y0;
        const x1 = (x0 + 1) % sz;
        const y1 = (y0 + 1) % sz;
        const a = grid[y0 * (sz + 1) + x0];
        const b = grid[y0 * (sz + 1) + x1];
        const cc = grid[y1 * (sz + 1) + x0];
        const d = grid[y1 * (sz + 1) + x1];
        base[y * 256 + x] += (a + (b - a) * tx + (cc - a) * ty + (a - b - cc + d) * tx * ty) / (1 << k) * 0.5;
      }
    }
  }
  for (let i = 0; i < 256 * 256; i++) {
    const v = 236 + (base[i] - 0.5) * 44;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  _noise = tex(c, true, false);
  return _noise;
}

let _win: { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } | null = null;
/** Tiling window facade: 8x8 windows, random lit pattern for the emissive map. */
export function windowTextures() {
  if (_win) return _win;
  const S = 256;
  const a = canvas(S, S);
  const b = canvas(S, S);
  const rnd = mulberry32(99);
  a.ctx.fillStyle = '#b9bec6';
  a.ctx.fillRect(0, 0, S, S);
  b.ctx.fillStyle = '#000';
  b.ctx.fillRect(0, 0, S, S);
  const n = 8;
  const cell = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const lit = rnd() < 0.42;
      a.ctx.fillStyle = lit ? '#6b7f95' : '#38485c';
      a.ctx.fillRect(x * cell + 5, y * cell + 7, cell - 10, cell - 14);
      if (lit) {
        b.ctx.fillStyle = rnd() < 0.7 ? '#ffd48a' : '#bfe0ff';
        b.ctx.fillRect(x * cell + 5, y * cell + 7, cell - 10, cell - 14);
      }
    }
  }
  _win = { map: tex(a.c, true), emissive: tex(b.c, true) };
  return _win;
}

/** City ground with roads, aligned so road centres sit at 35 + 70k metres from the city centre. */
export function roadTexture() {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = '#6d7a62';
  ctx.fillRect(0, 0, S, S);
  const rnd = mulberry32(5);
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = `rgba(${90 + rnd() * 40},${100 + rnd() * 40},${80 + rnd() * 30},0.35)`;
    ctx.fillRect(rnd() * S, rnd() * S, 6, 6);
  }
  const tile = 280;
  const px = S / tile; // px per metre
  ctx.fillStyle = '#2f3237';
  for (let k = 0; k < 4; k++) {
    const p = (35 + 70 * k) * px;
    ctx.fillRect(p - 6.5 * px, 0, 13 * px, S);
    ctx.fillRect(0, p - 6.5 * px, S, 13 * px);
  }
  ctx.fillStyle = '#d9d9a0';
  for (let k = 0; k < 4; k++) {
    const p = (35 + 70 * k) * px;
    for (let d = 0; d < S; d += 16) {
      ctx.fillRect(p - 0.4, d, 0.8 * 1.2, 8);
      ctx.fillRect(d, p - 0.4, 8, 0.8 * 1.2);
    }
  }
  return tex(c, true);
}

export function taxiTexture() {
  const { c, ctx } = canvas(64, 256);
  ctx.fillStyle = '#4a4d52';
  ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = '#e6c229';
  ctx.fillRect(30, 0, 4, 256);
  return tex(c, true);
}

export function runwayTexture(ap: Airport) {
  const W = ap.width;
  const L = ap.length;
  const cw = 128;
  const ch = Math.min(4096, Math.round(L * 1.25));
  const { c, ctx } = canvas(cw, ch);
  ctx.scale(cw / W, ch / L);
  ctx.fillStyle = '#3a3c40';
  ctx.fillRect(0, 0, W, L);
  const rnd = mulberry32(ap.id.charCodeAt(0) * 31 + ap.id.charCodeAt(1));
  for (let i = 0; i < 2600; i++) {
    const v = 50 + rnd() * 30;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
    ctx.fillRect(rnd() * W, rnd() * L, 0.5 + rnd() * 1.2, 1 + rnd() * 6);
  }
  // rubber marks near both thresholds
  ctx.fillStyle = 'rgba(15,15,15,0.35)';
  for (const y of [L - 330, 330]) ctx.fillRect(W * 0.3, y - 120, W * 0.4, 240);
  ctx.fillStyle = '#e9e9e4';
  // edge lines
  ctx.fillRect(0.9, 0, 0.45, L);
  ctx.fillRect(W - 1.35, 0, 0.45, L);
  // center dashes
  for (let y = 60; y < L - 90; y += 50) ctx.fillRect(W / 2 - 0.3, y, 0.6, 30);
  // threshold bars both ends
  const bars = W > 40 ? 12 : 8;
  const bw = (W - 6) / (bars * 2 - 1);
  for (let i = 0; i < bars; i++) {
    const x = 3 + i * bw * 2;
    if (Math.abs(x + bw / 2 - W / 2) < 1.0) continue;
    ctx.fillRect(x, L - 42, bw, 30);
    ctx.fillRect(x, 12, bw, 30);
  }
  // touchdown zone marks + aiming point
  const marks = [150, 300, 450, 600, 750];
  for (const m of marks) {
    for (const base of [L, 0]) {
      const y = base === L ? L - m : m;
      const len = m === 300 ? 0 : 22;
      if (!len) continue;
      ctx.fillRect(W / 2 - 7.5, y - len / 2, 1.8, len);
      ctx.fillRect(W / 2 + 5.7, y - len / 2, 1.8, len);
      ctx.fillRect(W / 2 - 11.5, y - len / 2, 1.4, len);
      ctx.fillRect(W / 2 + 10.1, y - len / 2, 1.4, len);
    }
  }
  for (const base of [L, 0]) {
    const y = base === L ? L - 300 : 300;
    ctx.fillRect(W / 2 - 9, y - 22, 3.2, 44);
    ctx.fillRect(W / 2 + 5.8, y - 22, 3.2, 44);
  }
  // numbers
  const h1 = Math.round(ap.headingDeg / 10) % 36 || 36;
  const h2 = ((h1 + 18 - 1) % 36) + 1;
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  ctx.font = `bold ${W * 0.42}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(W / 2, L - 75);
  ctx.scale(1, 1.8);
  ctx.fillText(pad(h1), 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(W / 2, 75);
  ctx.rotate(Math.PI);
  ctx.scale(1, 1.8);
  ctx.fillText(pad(h2), 0, 0);
  ctx.restore();
  const t = tex(c);
  return t;
}

export function helipadTexture() {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = '#4b4f55';
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f0f0f0';
  ctx.font = 'bold 150px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', 128, 134);
  return tex(c);
}

export function cloudPuffTexture() {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  const rnd = mulberry32(21);
  ctx.clearRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 28;
    const x = S / 2 + Math.cos(a) * r;
    const y = S / 2 + Math.sin(a) * r * 0.75;
    const rad = 18 + rnd() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  return tex(c);
}
