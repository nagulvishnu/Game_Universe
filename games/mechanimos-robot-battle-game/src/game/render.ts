import type { SpeciesDef } from './types';
import { TAU, clamp, lerp, outBack } from './fx';

// ---------- color utils ----------
export function hexMix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// ============================================================
//  TRANSFORMER  (car ⇄ robot, morph 0..1)
// ============================================================

type PartCol = 'body' | 'dark' | 'accent' | 'glass' | 'metal';
interface PartCfg {
  cx: number; cy: number; ca?: number; cw: number; ch: number;
  bx: number; by: number; ba?: number; bw: number; bh: number;
  col: PartCol; kind: 'rect' | 'wheel' | 'wedge';
  z: number; d: number; far?: boolean;
}

const P = (p: PartCfg) => p;

// car: origin at wheel-ground centre, facing +x, car ~2.6u long, ~1.2u tall
// robot: origin at feet centre, facing +x, ~3.4u tall
const PARTS: PartCfg[] = [
  P({ cx: -0.35, cy: 0.34, cw: 1.3, ch: 0.2, bx: -0.52, by: 0.62, bw: 0.5, bh: 0.95, col: 'dark', kind: 'rect', z: 1, d: 0.1, far: true }),
  P({ cx: 0.95, cy: 0.4, cw: 0.3, ch: 0.24, bx: -1.04, by: 2.04, bw: 0.42, bh: 0.58, col: 'dark', kind: 'rect', z: 1, d: 0.4, far: true }),
  P({ cx: 0.82, cy: 0.3, cw: 0.56, ch: 0.56, bx: -1.06, by: 1.64, bw: 0.66, bh: 0.66, col: 'metal', kind: 'wheel', z: 1, d: 0.47, far: true }),
  P({ cx: -0.82, cy: 0.3, cw: 0.52, ch: 0.52, bx: -0.54, by: 0.18, bw: 0.6, bh: 0.34, col: 'metal', kind: 'wheel', z: 0, d: 0.44, far: true }),
  P({ cx: 0.55, cy: 0.86, cw: 0.95, ch: 0.15, bx: -1.02, by: 2.56, ba: 0.18, bw: 0.75, bh: 0.58, col: 'body', kind: 'rect', z: 1, d: 0.34, far: true }),
  P({ cx: -1.24, cy: 1.02, cw: 0.75, ch: 0.16, bx: -0.62, by: 2.58, ba: -0.55, bw: 0.5, bh: 1.05, col: 'accent', kind: 'wedge', z: 1, d: 0.3 }),
  P({ cx: -1.02, cy: 0.6, cw: 0.55, ch: 0.4, bx: 0, by: 1.5, bw: 1.05, bh: 0.55, col: 'dark', kind: 'rect', z: 2, d: 0.05 }),
  P({ cx: 0.15, cy: 0.34, cw: 1.3, ch: 0.2, bx: 0.5, by: 0.66, bw: 0.52, bh: 1.0, col: 'dark', kind: 'rect', z: 2, d: 0.1 }),
  P({ cx: -0.15, cy: 0.44, cw: 0.5, ch: 0.3, bx: -0.5, by: 1.32, bw: 0.52, bh: 0.58, col: 'dark', kind: 'rect', z: 1, d: 0.18, far: true }),
  P({ cx: 0.45, cy: 0.44, cw: 0.5, ch: 0.3, bx: 0.5, by: 1.35, bw: 0.55, bh: 0.6, col: 'dark', kind: 'rect', z: 2, d: 0.18 }),
  P({ cx: 0, cy: 0.62, cw: 2.5, ch: 0.52, bx: 0, by: 2.1, bw: 1.55, bh: 1.2, col: 'body', kind: 'rect', z: 3, d: 0 }),
  P({ cx: -0.18, cy: 1.04, cw: 1.15, ch: 0.48, bx: 0.08, by: 3.12, bw: 0.64, bh: 0.58, col: 'glass', kind: 'rect', z: 8, d: 0.15 }),
  P({ cx: 1.3, cy: 0.52, cw: 0.5, ch: 0.42, bx: 0.3, by: 2.32, bw: 0.55, bh: 0.5, col: 'accent', kind: 'wedge', z: 9, d: 0.2 }),
  P({ cx: 0.82, cy: 0.3, cw: 0.6, ch: 0.6, bx: 1.1, by: 1.62, bw: 0.72, bh: 0.72, col: 'metal', kind: 'wheel', z: 8, d: 0.45 }),
  P({ cx: -0.82, cy: 0.3, cw: 0.56, ch: 0.56, bx: 0.52, by: 0.18, bw: 0.64, bh: 0.36, col: 'metal', kind: 'wheel', z: 2, d: 0.42 }),
  P({ cx: 1.05, cy: 0.42, cw: 0.35, ch: 0.26, bx: 1.06, by: 2.1, bw: 0.45, bh: 0.62, col: 'dark', kind: 'rect', z: 6, d: 0.38 }),
  P({ cx: 0.75, cy: 0.86, cw: 0.95, ch: 0.15, bx: 1.02, by: 2.66, ba: -0.14, bw: 0.8, bh: 0.62, col: 'body', kind: 'rect', z: 7, d: 0.3 }),
].sort((a, b) => a.z - b.z);

export interface MechPose {
  morph: number;   // 0 car -> 1 robot
  bob?: number;    // extra y offset (px, applied pre-scale in units)
  lean?: number;   // radians
  flash?: number;  // 0..1 white hit flash
  dim?: number;    // 0..1 powerdown grey
}

function partColor(sp: SpeciesDef, c: PartCol, far: boolean | undefined, flash: number, dim: number): string {
  let base =
    c === 'body' ? sp.body :
    c === 'dark' ? sp.dark :
    c === 'accent' ? sp.accent :
    c === 'glass' ? sp.glass : '#c9ccdd';
  if (c === 'metal') base = '#b9bdd2';
  if (far) base = hexMix(base, '#0a0820', 0.5);
  if (dim > 0) base = hexMix(base.startsWith('#') ? base : '#8888aa', '#161226', dim);
  if (flash > 0) base = hexMix(base.startsWith('#') ? base : '#8888aa', '#ffffff', flash);
  return base;
}

export function drawMech(
  ctx: CanvasRenderingContext2D,
  sp: SpeciesDef,
  x: number, gy: number,
  u: number,
  flip: number,
  pose: MechPose,
  time: number,
) {
  const m = clamp(pose.morph, 0, 1);
  const flash = pose.flash ?? 0;
  const dim = pose.dim ?? 0;

  // ground shadow
  const sw = lerp(1.5, 1.35, m) * u;
  ctx.save();
  ctx.globalAlpha = 0.32 * (1 - dim * 0.6);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, gy + 4, sw, sw * 0.18, 0, 0, TAU);
  ctx.fill();
  // neon underglow
  ctx.globalAlpha = 0.16 + 0.08 * Math.sin(time * 3) * m;
  ctx.fillStyle = sp.accent;
  ctx.beginPath();
  ctx.ellipse(x, gy + 3, sw * 0.85, sw * 0.14, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, gy - (pose.bob ?? 0));
  ctx.scale(u * flip, u);
  ctx.rotate((pose.lean ?? 0) * flip);

  for (const p of PARTS) {
    const local = clamp((m - p.d * 0.55) / 0.62, 0, 1);
    const e = m <= 0 ? 0 : m >= 1 ? 1 : outBack(local);
    const es = clamp(local, 0, 1);
    const px = lerp(p.cx, p.bx, e);
    const py = lerp(p.cy, p.by, e);
    const pa = lerp(p.ca ?? 0, p.ba ?? 0, es);
    const pw = lerp(p.cw, p.bw, es);
    const ph = lerp(p.ch, p.bh, es);
    const col = partColor(sp, p.col, p.far, flash, dim);

    ctx.save();
    ctx.translate(px, -py);
    ctx.rotate(pa);
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(4,2,14,0.55)';
    ctx.lineWidth = 0.045;

    if (p.kind === 'wheel') {
      const r = pw / 2;
      const ry = ph / 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, ry, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // hub / knuckles
      ctx.fillStyle = partColor(sp, 'accent', p.far, flash, dim);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, TAU);
      ctx.fill();
      if (m > 0.75 && p.by > 1) {
        // fist knuckle lines
        ctx.strokeStyle = 'rgba(4,2,14,0.5)';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.18); ctx.lineTo(r * 0.6, -r * 0.18);
        ctx.moveTo(-r * 0.6, r * 0.18); ctx.lineTo(r * 0.6, r * 0.18);
        ctx.stroke();
      }
    } else if (p.kind === 'wedge') {
      ctx.beginPath();
      ctx.moveTo(-pw / 2, -ph / 2);
      ctx.lineTo(pw / 2, -ph * 0.1);
      ctx.lineTo(pw / 2, ph / 2);
      ctx.lineTo(-pw / 2, ph / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      rr(ctx, -pw / 2, -ph / 2, pw, ph, Math.min(0.14, ph * 0.3));
      ctx.fill();
      ctx.stroke();
      if (p.kind === 'rect' && p.col === 'glass') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        rr(ctx, -pw / 2 + 0.06, -ph / 2 + 0.05, pw * 0.4, ph * 0.28, 0.05);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // robot-mode glow details
  const rk = clamp((m - 0.7) / 0.3, 0, 1);
  if (rk > 0) {
    ctx.save();
    ctx.globalAlpha = rk * (1 - dim * 0.8);
    // visor
    const pulse = 0.75 + 0.25 * Math.sin(time * 4);
    ctx.globalAlpha = rk * pulse * (1 - flash);
    ctx.fillStyle = sp.accent;
    rr(ctx, 0.08 - 0.16, -(3.12) - 0.09, 0.42, 0.16, 0.08);
    ctx.fill();
    // chest core
    ctx.beginPath();
    ctx.arc(0.3, -2.32, 0.13 + 0.02 * Math.sin(time * 5), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = rk * 0.35 * pulse;
    ctx.beginPath();
    ctx.arc(0.3, -2.32, 0.24 + 0.03 * Math.sin(time * 5), 0, TAU);
    ctx.fill();
    // crest
    ctx.globalAlpha = rk * (1 - dim * 0.8);
    ctx.fillStyle = partColor(sp, 'accent', false, flash, dim);
    drawCrest(ctx, sp, time);
    ctx.restore();
  }

  ctx.restore();
}

function drawCrest(ctx: CanvasRenderingContext2D, sp: SpeciesDef, time: number) {
  const hx = 0.08, hy = -3.12; // head centre
  ctx.save();
  ctx.translate(hx, hy);
  ctx.strokeStyle = ctx.fillStyle as string;
  switch (sp.crest) {
    case 'fin':
      ctx.beginPath();
      ctx.moveTo(-0.1, -0.26); ctx.lineTo(-0.42, -0.72); ctx.lineTo(-0.05, -0.3); ctx.lineTo(0.12, -0.28);
      ctx.closePath(); ctx.fill();
      break;
    case 'horns':
      ctx.beginPath();
      ctx.moveTo(-0.2, -0.24); ctx.lineTo(-0.34, -0.62); ctx.lineTo(-0.06, -0.28);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.2, -0.24); ctx.lineTo(0.34, -0.62); ctx.lineTo(0.08, -0.28);
      ctx.closePath(); ctx.fill();
      break;
    case 'disc':
      ctx.beginPath();
      ctx.arc(-0.05, -0.18, 0.34, Math.PI * 0.9, Math.PI * 1.9);
      ctx.lineWidth = 0.07; ctx.stroke();
      break;
    case 'spike':
      ctx.beginPath();
      ctx.moveTo(-0.18, -0.26); ctx.lineTo(-0.06, -0.62); ctx.lineTo(0.04, -0.3);
      ctx.lineTo(0.14, -0.66); ctx.lineTo(0.24, -0.26);
      ctx.closePath(); ctx.fill();
      break;
    case 'blade':
      ctx.beginPath();
      ctx.moveTo(0, -0.24); ctx.quadraticCurveTo(0.5, -0.5, 0.62, -0.95);
      ctx.quadraticCurveTo(0.28, -0.62, -0.08, -0.3);
      ctx.closePath(); ctx.fill();
      break;
    case 'rings':
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(0, -0.42 + Math.sin(time * 2) * 0.02, 0.16, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -0.66 + Math.sin(time * 2 + 1) * 0.02, 0.09, 0, TAU); ctx.stroke();
      break;
  }
  ctx.restore();
}

// ============================================================
//  TOP-DOWN tiny car (overworld)
// ============================================================

export function drawCarTop(
  ctx: CanvasRenderingContext2D,
  sp: SpeciesDef,
  x: number, y: number, angle: number,
  s: number, time: number, alert = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 4 * s, 26 * s, 13 * s, angle, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.rotate(angle);
  // underglow
  ctx.globalAlpha = 0.28 + 0.1 * Math.sin(time * 4 + x);
  ctx.fillStyle = sp.accent;
  rr(ctx, -24 * s, -11 * s, 48 * s, 22 * s, 9 * s);
  ctx.fill();
  ctx.globalAlpha = 1;
  // wheels
  ctx.fillStyle = '#14121f';
  const w = 9 * s, h = 5.5 * s;
  rr(ctx, -17 * s, -13 * s, w, h, 2 * s); ctx.fill();
  rr(ctx, -17 * s, 7.5 * s, w, h, 2 * s); ctx.fill();
  rr(ctx, 8 * s, -13 * s, w, h, 2 * s); ctx.fill();
  rr(ctx, 8 * s, 7.5 * s, w, h, 2 * s); ctx.fill();
  // body
  ctx.fillStyle = sp.body;
  ctx.strokeStyle = 'rgba(4,2,14,0.6)';
  ctx.lineWidth = 1.5;
  rr(ctx, -22 * s, -10 * s, 44 * s, 20 * s, 7 * s);
  ctx.fill(); ctx.stroke();
  // nose stripe
  ctx.fillStyle = sp.accent;
  rr(ctx, 14 * s, -4 * s, 7 * s, 8 * s, 3 * s);
  ctx.fill();
  // cabin
  ctx.fillStyle = sp.glass;
  rr(ctx, -8 * s, -6.5 * s, 14 * s, 13 * s, 4 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  rr(ctx, -6 * s, -5 * s, 5 * s, 11 * s, 3 * s);
  ctx.fill();
  // spoiler
  ctx.fillStyle = sp.dark;
  rr(ctx, -24 * s, -8 * s, 5 * s, 16 * s, 2 * s);
  ctx.fill();
  // headlights
  ctx.fillStyle = '#fff9c4';
  ctx.beginPath();
  ctx.arc(21 * s, -6 * s, 2.2 * s, 0, TAU);
  ctx.arc(21 * s, 6 * s, 2.2 * s, 0, TAU);
  ctx.fill();
  if (alert > 0) {
    ctx.globalAlpha = alert;
    ctx.strokeStyle = sp.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30 * s + Math.sin(time * 6) * 4, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ============================================================
//  HERO (top-down runner)
// ============================================================

export function drawHero(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angle: number,
  moving: boolean, time: number,
) {
  const bob = moving ? Math.sin(time * 14) * 1.6 : Math.sin(time * 2.4) * 0.8;
  ctx.save();
  ctx.translate(x, y + bob * 0.4);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 8, 13, 6, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.rotate(angle);
  // legs
  const step = moving ? Math.sin(time * 14) * 4 : 0;
  ctx.fillStyle = '#1a1633';
  rr(ctx, -4 + step * 0.4, 4, 8, 7, 3); ctx.fill();
  rr(ctx, -4 - step * 0.4, -11, 8, 7, 3); ctx.fill();
  // body suit
  ctx.fillStyle = '#2b2350';
  ctx.strokeStyle = 'rgba(4,2,14,0.6)';
  ctx.lineWidth = 1.5;
  rr(ctx, -8, -9, 16, 18, 6);
  ctx.fill(); ctx.stroke();
  // scarf / accent stripe
  ctx.fillStyle = '#22d3ee';
  rr(ctx, -8, -2, 16, 4, 2);
  ctx.fill();
  // helmet
  ctx.fillStyle = '#eef2ff';
  ctx.beginPath();
  ctx.arc(2, 0, 9, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // visor
  ctx.fillStyle = '#0ea5b7';
  ctx.beginPath();
  ctx.arc(5.5, 0, 5, -Math.PI / 2.4, Math.PI / 2.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ============================================================
//  TRAINER NPC
// ============================================================

export function drawTrainerNPC(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, time: number, color: string,
) {
  const bob = Math.sin(time * 2.2 + x) * 1.2;
  ctx.save();
  ctx.translate(x, y + bob * 0.4);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 6, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#231c48';
  ctx.strokeStyle = 'rgba(4,2,14,0.6)';
  ctx.lineWidth = 1.5;
  rr(ctx, -9, -10, 18, 20, 6);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8ecff';
  ctx.beginPath();
  ctx.arc(0, -4, 9.5, 0, TAU);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#101024';
  ctx.beginPath();
  ctx.arc(0, -4, 5.4, 0, TAU);
  ctx.fill();
  // flag pole
  ctx.strokeStyle = '#9aa3c7';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-11, 8);
  ctx.lineTo(-11, -34);
  ctx.stroke();
  // pennant
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-11, -34);
  ctx.lineTo(11, -28 + Math.sin(time * 5) * 2);
  ctx.lineTo(-11, -22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ============================================================
//  PICKUPS & DECOR
// ============================================================

export function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number) {
  const bob = Math.sin(time * 2 + seed * 9) * 4;
  const rot = time * 1.4 + seed;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.arc(0, 0, 18 + Math.sin(time * 3 + seed) * 3, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.rotate(rot);
  ctx.fillStyle = '#67e8f9';
  ctx.strokeStyle = '#cffafe';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(8, 0); ctx.lineTo(0, 12); ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(4, 0); ctx.lineTo(0, 4); ctx.lineTo(-4, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawTamePickup(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number) {
  const bob = Math.sin(time * 2.2 + seed * 7) * 4;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(Math.sin(time * 1.6 + seed) * 0.15);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#e879f9';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2a0a3d';
  ctx.strokeStyle = '#e879f9';
  ctx.lineWidth = 2;
  rr(ctx, -11, -15, 22, 30, 4);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(0, 0, 2.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawDecorRock(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#171230';
  ctx.strokeStyle = 'rgba(103,232,249,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const r = 26 + ((seed * 37 + i * 53) % 17);
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 0.75;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawPylon(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#120d2b';
  ctx.strokeStyle = 'rgba(232,121,249,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, 14);
  ctx.lineTo(0, -46);
  ctx.lineTo(14, 14);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  const pulse = 0.6 + 0.4 * Math.sin(time * 2.6 + seed * 5);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#e879f9';
  ctx.beginPath();
  ctx.arc(0, -50, 6, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = pulse * 0.3;
  ctx.beginPath();
  ctx.arc(0, -50, 13, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ============================================================
//  WORLD GROUND + VIGNETTE
// ============================================================

export function drawGround(
  ctx: CanvasRenderingContext2D,
  camX: number, camY: number,
  w: number, h: number, zoom: number,
) {
  const step = 150;
  const x0 = Math.floor((camX - w / 2 / zoom) / step) * step;
  const x1 = camX + w / 2 / zoom + step;
  const y0 = Math.floor((camY - h / 2 / zoom) / step) * step;
  const y1 = camY + h / 2 / zoom + step;

  ctx.strokeStyle = 'rgba(56,189,248,0.07)';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += step) {
    ctx.moveTo(x, y0); ctx.lineTo(x, y1);
  }
  for (let y = y0; y <= y1; y += step) {
    ctx.moveTo(x0, y); ctx.lineTo(x1, y);
  }
  ctx.stroke();

  // deterministic speckles
  const cell = 96;
  const cx0 = Math.floor((camX - w / 2 / zoom) / cell);
  const cx1 = Math.floor((camX + w / 2 / zoom) / cell);
  const cy0 = Math.floor((camY - h / 2 / zoom) / cell);
  const cy1 = Math.floor((camY + h / 2 / zoom) / cell);
  ctx.fillStyle = 'rgba(148,163,255,0.10)';
  for (let gx = cx0; gx <= cx1; gx++) {
    for (let gy = cy0; gy <= cy1; gy++) {
      const hsh = (gx * 73856093) ^ (gy * 19349663);
      if ((hsh & 7) < 3) {
        const px = gx * cell + (hsh % cell);
        const py = gy * cell + ((hsh >> 8) % cell);
        ctx.fillRect(px, py, 3, 3);
      }
    }
  }
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.6) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(4,1,14,0)');
  g.addColorStop(1, `rgba(4,1,14,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ============================================================
//  BATTLE ARENA BACKGROUND
// ============================================================

export function drawArenaBG(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const horizon = h * 0.62;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#0a0420');
  sky.addColorStop(0.55, '#2a0a4a');
  sky.addColorStop(1, '#6e1c5e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 1);

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 733) % 997) / 997 * w;
    const sy = ((i * 397) % 641) / 641 * horizon * 0.7;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
    ctx.globalAlpha = 0.25 * tw;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  // sun with scan slices
  const sunR = Math.min(w, h) * 0.3;
  const sunX = w * 0.5, sunY = horizon - sunR * 0.25;
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, '#ffd166');
  sun.addColorStop(0.6, '#ff7a3d');
  sun.addColorStop(1, '#ff2d78');
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, TAU);
  ctx.clip();
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = '#2a0a4a';
  for (let i = 0; i < 6; i++) {
    const yy = sunY + (i / 6) * sunR + Math.sin(t * 0.6 + i) * 1.5;
    ctx.fillRect(sunX - sunR, yy, sunR * 2, 3 + i * 1.6);
  }
  ctx.restore();

  // far mountains
  ctx.fillStyle = '#1a0836';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= w; x += 40) {
    const y = horizon - 24 - Math.abs(Math.sin(x * 0.011 + 2)) * 66;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#230a46';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= w; x += 30) {
    const y = horizon - 8 - Math.abs(Math.sin(x * 0.017 + 5)) * 40;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fill();

  // floor
  const floor = ctx.createLinearGradient(0, horizon, 0, h);
  floor.addColorStop(0, '#160a30');
  floor.addColorStop(1, '#05020f');
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, w, h - horizon);

  // perspective grid — verticals
  const vpx = w / 2;
  ctx.strokeStyle = 'rgba(34,211,238,0.20)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -12; i <= 12; i++) {
    const spread = (i / 12) * w * 1.4;
    ctx.moveTo(vpx + spread * 0.08, horizon);
    ctx.lineTo(vpx + spread, h);
  }
  ctx.stroke();
  // horizontals scrolling
  ctx.strokeStyle = 'rgba(232,121,249,0.22)';
  ctx.beginPath();
  const scroll = (t * 0.35) % 1;
  for (let i = 0; i < 12; i++) {
    const k = (i + scroll) / 12;
    const y = horizon + (h - horizon) * k * k;
    ctx.globalAlpha = 0.25 * k + 0.05;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // horizon glow
  const hg = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 30);
  hg.addColorStop(0, 'rgba(255,45,120,0)');
  hg.addColorStop(0.5, 'rgba(255,45,120,0.28)');
  hg.addColorStop(1, 'rgba(255,45,120,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, horizon - 30, w, 60);
}

// ============================================================
//  HP PLATE (battle HUD, canvas-drawn)
// ============================================================

export function drawHPPlate(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, wd: number,
  flip: boolean,
  label: string, level: number,
  hpRatio: number, ghostRatio: number,
  color: string,
  statuses: { burn: number; stun: boolean; shield: number },
) {
  const ht = 58;
  const skew = 14 * (flip ? -1 : 1);
  ctx.save();
  ctx.translate(x, y);
  // plate
  ctx.fillStyle = 'rgba(8,4,24,0.82)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(skew, 0);
  ctx.lineTo(wd, 0);
  ctx.lineTo(wd - skew, ht);
  ctx.lineTo(0, ht);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const padL = flip ? 10 : 18;
  // name
  ctx.font = '700 15px Orbitron, sans-serif';
  ctx.textAlign = flip ? 'right' : 'left';
  ctx.fillStyle = '#eef2ff';
  ctx.fillText(label, flip ? wd - padL : padL, 20);
  // level
  ctx.font = '600 11px Rajdhani, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(`LV ${level}`, flip ? wd - padL : padL, 36);

  // bar
  const bx = flip ? 12 : wd * 0.34;
  const bw = wd * 0.64 - 24;
  const by = 26;
  const bh = 12;
  ctx.fillStyle = '#0d0a1f';
  rr(ctx, bx, by, bw, bh, 6);
  ctx.fill();
  // ghost
  ctx.fillStyle = 'rgba(255,120,120,0.55)';
  rr(ctx, bx, by, bw * clamp(ghostRatio, 0, 1), bh, 6);
  ctx.fill();
  // fill
  const ratio = clamp(hpRatio, 0, 1);
  const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  const hc = ratio > 0.55 ? '#4ade80' : ratio > 0.28 ? '#fbbf24' : '#f87171';
  fg.addColorStop(0, hc);
  fg.addColorStop(1, color);
  ctx.fillStyle = fg;
  rr(ctx, bx, by, Math.max(bw * ratio, ratio > 0 ? 6 : 0), bh, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  rr(ctx, bx, by, bw, bh, 6);
  ctx.stroke();

  // hp text
  ctx.font = '700 10px Orbitron, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(ratio * 100)}%`, bx + bw / 2, by + 10);

  // statuses
  let sx = flip ? wd - 20 : 20;
  const sy = ht - 12;
  ctx.font = '700 9px Orbitron, sans-serif';
  const chip = (txt: string, c: string) => {
    const wdc = 34;
    sx += flip ? -wdc : 0;
    ctx.fillStyle = c;
    rr(ctx, sx - (flip ? 0 : 0), sy - 9, wdc, 13, 3);
    ctx.fill();
    ctx.fillStyle = '#0a0618';
    ctx.fillText(txt, sx + wdc / 2, sy + 1);
    sx += flip ? -6 : wdc + 6;
  };
  if (statuses.burn > 0) chip('BRN', '#fb923c');
  if (statuses.stun) chip('STN', '#22d3ee');
  if (statuses.shield > 0) chip('SHD', '#60a5fa');
  ctx.restore();
}

// big centre banner (GOTCHA! / ESCAPED! etc.)
export function drawBanner(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  text: string, sub: string,
  color: string, k: number,
) {
  const e = outBack(clamp(k / 0.35, 0, 1));
  const alpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(w / 2, h * 0.34);
  ctx.scale(e, e);
  ctx.font = `900 ${Math.min(64, w * 0.09)}px Orbitron, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(5,2,16,0.9)';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  if (sub) {
    ctx.font = `600 ${Math.min(20, w * 0.032)}px Rajdhani, sans-serif`;
    ctx.fillStyle = '#e8ecff';
    ctx.fillText(sub, 0, 34);
  }
  ctx.restore();
}

// flying tame card (battle taming sequence)
export function drawMiniCard(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#e879f9';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2a0a3d';
  ctx.strokeStyle = '#e879f9';
  ctx.lineWidth = 3;
  rr(ctx, -16, -22, 32, 44, 6);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}
