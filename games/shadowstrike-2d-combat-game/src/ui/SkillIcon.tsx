/**
 * SHADOWSTRIKE — procedural skill icons.
 *
 * Draws a distinctive, category-coloured thumbnail for every skill kind using
 * the same 2D canvas primitives as the rest of the UI. Icons are drawn once to
 * an offscreen canvas and cached keyed by (category, kind, colour) so the hot
 * catalogue grid never re-renders per frame.
 */

import { useEffect, useRef } from 'react';
import type { SkillDef } from '../data/skills';

const ICON = 64;
const CX = ICON / 2;
const CY = ICON / 2;

const cache = new Map<string, HTMLCanvasElement>();

function col(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

function rgba(c: number, a: number): string {
  return `rgba(${(c >> 16) & 0xff}, ${(c >> 8) & 0xff}, ${c & 0xff}, ${a})`;
}

/* ---------------------------------------------------------------- shapes */

function drawProjectile(g: CanvasRenderingContext2D, color: number, glow: number) {
  const ang = -Math.PI / 5;
  const r = 10;
  g.fillStyle = (rgba(color, 0.25));
  g.beginPath(); g.arc(CX, CY, r * 1.9, 0, Math.PI * 2); g.fill();
  g.fillStyle = (col(color));
  g.beginPath(); g.arc(CX, CY, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = ('#ffffff');
  g.beginPath(); g.arc(CX + Math.cos(ang) * r * 0.35, CY + Math.sin(ang) * r * 0.35, r * 0.45, 0, Math.PI * 2); g.fill();
  const tx = CX - Math.cos(ang) * r * 1.7;
  const ty = CY - Math.sin(ang) * r * 1.7;
  g.fillStyle = (rgba(glow, 0.75));
  g.beginPath();
  g.moveTo(CX + Math.sin(ang) * r * 0.8, CY - Math.cos(ang) * r * 0.8);
  g.lineTo(tx, ty);
  g.lineTo(CX - Math.sin(ang) * r * 0.8, CY + Math.cos(ang) * r * 0.8);
  g.closePath(); g.fill();
  g.strokeStyle = (col(color)); g.lineWidth = 2; g.stroke();
}

function drawHoming(g: CanvasRenderingContext2D, color: number, _glow: number) {
  void _glow;
  const r = 9;
  g.strokeStyle = (rgba(color, 0.5)); g.lineWidth = 2;
  g.beginPath(); g.arc(CX, CY, r * 1.5, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(CX, CY, r * 2.3, 0, Math.PI * 2); g.stroke();
  g.fillStyle = (col(color));
  g.beginPath(); g.arc(CX, CY, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = ('#ffffff'); g.beginPath(); g.arc(CX + 2, CY - 2, r * 0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = (col(color));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.beginPath(); g.arc(CX + Math.cos(a) * r * 1.6, CY + Math.sin(a) * r * 1.6, 2, 0, Math.PI * 2); g.fill();
  }
}

function drawBeam(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.strokeStyle = (col(color)); g.lineWidth = 6;
  g.beginPath(); g.moveTo(14, CY); g.lineTo(ICON - 14, CY); g.stroke();
  g.strokeStyle = ('#ffffff'); g.lineWidth = 2;
  g.beginPath(); g.moveTo(14, CY); g.lineTo(ICON - 14, CY); g.stroke();
  g.fillStyle = (col(color));
  g.beginPath(); g.arc(ICON - 14, CY, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = (rgba(glow, 0.35));
  g.beginPath(); g.arc(CX, CY, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = (col(color));
  g.fillRect(CX - 2, CY - 10, 4, 20);
}

function drawAoe(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.strokeStyle = (col(color)); g.lineWidth = 5;
  g.beginPath(); g.arc(CX, CY, 17, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(CX, CY, 11, 0, Math.PI * 2); g.stroke();
  g.fillStyle = (rgba(glow, 0.35));
  g.beginPath(); g.arc(CX, CY, 20, 0, Math.PI * 2); g.fill();
  g.fillStyle = ('#ffffff'); g.beginPath(); g.arc(CX, CY, 3, 0, Math.PI * 2); g.fill();
}

function drawZone(g: CanvasRenderingContext2D, color: number, _glow: number) {
  void _glow;
  g.fillStyle = (rgba(color, 0.15));
  g.beginPath(); g.ellipse(CX, CY, 20, 12, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = (col(color)); g.lineWidth = 3;
  g.beginPath(); g.ellipse(CX, CY, 20, 12, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = ('#ffffff'); g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(CX, CY, 20, 12, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = (col(color));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.beginPath(); g.arc(CX + Math.cos(a) * 14, CY + Math.sin(a) * 10, 2.5, 0, Math.PI * 2); g.fill();
  }
}

function drawWave(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.strokeStyle = (col(color)); g.lineWidth = 5;
  g.beginPath();
  g.arc(CX, CY + 8, 18, 0, Math.PI, false);
  g.arc(CX, CY + 8, 18, Math.PI, Math.PI * 2, false);
  g.stroke();
  g.strokeStyle = ('#ffffff'); g.lineWidth = 2;
  g.beginPath();
  g.arc(CX, CY + 8, 14, 0, Math.PI, false);
  g.stroke();
  g.fillStyle = (rgba(glow, 0.4));
  g.beginPath(); g.ellipse(CX, CY + 8, 16, 10, 0, 0, Math.PI * 2); g.fill();
}

function drawRain(g: CanvasRenderingContext2D, color: number, glow: number) {
  for (let i = 0; i < 5; i++) {
    const x = 14 + i * 12;
    g.strokeStyle = (col(color)); g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 2, 22); g.stroke();
    g.fillStyle = (col(color));
    g.beginPath(); g.arc(x + 1, 24, 2.5, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = (rgba(glow, 0.5)); g.lineWidth = 2;
  g.beginPath(); g.arc(CX, 30, 22, 0, Math.PI); g.stroke();
}

function drawMelee(g: CanvasRenderingContext2D, color: number, _glow: number) {
  void _glow;
  g.strokeStyle = (col(color)); g.lineWidth = 6;
  g.beginPath();
  g.arc(CX + 4, CY - 4, 16, -0.9, 0.2, false);
  g.stroke();
  g.strokeStyle = ('#ffffff'); g.lineWidth = 2.5;
  g.beginPath();
  g.arc(CX + 4, CY - 4, 12, -0.9, 0.2, false);
  g.stroke();
  g.fillStyle = (col(color));
  g.fillRect(CX - 3, CY - 10, 6, 18);
}

function drawDash(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.strokeStyle = (col(color)); g.lineWidth = 5;
  g.beginPath(); g.moveTo(CX - 14, CY); g.lineTo(CX + 14, CY); g.stroke();
  g.fillStyle = ('#ffffff'); g.beginPath(); g.arc(CX, CY, 4, 0, Math.PI * 2); g.fill();
  for (let i = 1; i <= 3; i++) {
    g.strokeStyle = (rgba(glow, 0.5 - i * 0.12)); g.lineWidth = 3;
    g.beginPath(); g.moveTo(CX - 14 - i * 7, CY); g.lineTo(CX - 14 - i * 7 - 4, CY); g.stroke();
  }
  g.fillStyle = (col(color));
  const h = Math.tan(Math.PI / 6) * 6;
  g.beginPath();
  g.moveTo(CX + 14, CY - 6); g.lineTo(CX + 14, CY + 6); g.lineTo(CX + 14 + h, CY); g.closePath(); g.fill();
}

function drawClone(g: CanvasRenderingContext2D, color: number, glow: number) {
  const r = 8;
  g.strokeStyle = (col(color)); g.lineWidth = 3;
  g.beginPath(); g.arc(CX - 8, CY, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(CX + 8, CY, r, 0, Math.PI * 2); g.stroke();
  g.fillStyle = (rgba(color, 0.25));
  g.beginPath(); g.arc(CX - 8, CY, r, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(CX + 8, CY, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = ('#ffffff');
  g.beginPath(); g.arc(CX - 8 + 2, CY - 2, r * 0.35, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(CX + 8 + 2, CY - 2, r * 0.35, 0, Math.PI * 2); g.fill();
  g.strokeStyle = (rgba(glow, 0.5)); g.lineWidth = 2;
  g.beginPath(); g.arc(CX, CY, 14, 0, Math.PI * 2); g.stroke();
}

function drawSummon(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.beginPath(); g.ellipse(CX, CY + 2, 10, 16, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(CX - 7, CY - 6, 5, Math.PI, Math.PI * 2, false); g.fill();
  g.beginPath(); g.arc(CX + 7, CY - 6, 5, Math.PI, Math.PI * 2, false); g.fill();
  g.fillStyle = ('#ffffff'); g.beginPath(); g.arc(CX + 2, CY - 4, 2.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = (rgba(glow, 0.45)); g.lineWidth = 2;
  g.beginPath(); g.arc(CX, CY, 15, 0, Math.PI * 2); g.stroke();
}

function drawBuff(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.strokeStyle = (col(color)); g.lineWidth = 3;
  g.beginPath(); g.arc(CX, CY, 13, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(CX, CY, 8, 0, Math.PI * 2); g.stroke();
  g.fillStyle = (rgba(glow, 0.35));
  g.beginPath(); g.arc(CX, CY, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = ('#ffffff'); g.beginPath(); g.arc(CX, CY, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = (col(color));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.beginPath(); g.arc(CX + Math.cos(a) * 10, CY + Math.sin(a) * 10, 2.5, 0, Math.PI * 2); g.fill();
  }
}

function drawCounter(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = ('#14141e');
  g.beginPath();
  g.moveTo(CX - 14, CY - 14); g.lineTo(CX + 14, CY - 14); g.lineTo(CX + 14, CY + 14); g.lineTo(CX - 14, CY + 14); g.closePath(); g.fill();
  g.strokeStyle = (col(color)); g.lineWidth = 3;
  g.beginPath();
  g.moveTo(CX - 14, CY - 14); g.lineTo(CX + 14, CY - 14); g.lineTo(CX + 14, CY + 14); g.lineTo(CX - 14, CY + 14); g.closePath(); g.stroke();
  g.strokeStyle = ('#ffffff'); g.lineWidth = 2;
  g.beginPath(); g.moveTo(CX - 6, CY - 4); g.lineTo(CX - 2, CY); g.lineTo(CX + 7, CY - 7); g.stroke();
  g.fillStyle = (rgba(glow, 0.3));
  g.beginPath(); g.arc(CX, CY, 18, 0, Math.PI * 2); g.fill();
}

function drawPull(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.strokeStyle = (col(color)); g.lineWidth = 4;
  for (let turn = 0; turn < 1.6; turn += 0.25) {
    g.beginPath();
    for (let t = 0; t <= turn * Math.PI; t += 0.1) {
      const rad = 2 + t * 2.2;
      g.lineTo(CX + Math.cos(t) * rad, CY + Math.sin(t) * rad * 0.6);
    }
    g.stroke();
  }
  g.fillStyle = (col(color)); g.beginPath(); g.arc(CX, CY, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = (rgba(glow, 0.3));
  g.beginPath(); g.arc(CX, CY, 14, 0, Math.PI * 2); g.fill();
}

function drawTrap(g: CanvasRenderingContext2D, color: number, _glow: number) {
  void _glow;
  g.fillStyle = (rgba(color, 0.2));
  g.beginPath(); g.moveTo(CX - 13, CY - 7); g.lineTo(CX + 13, CY - 7); g.lineTo(CX + 13, CY + 7); g.lineTo(CX - 13, CY + 7); g.closePath(); g.fill();
  g.strokeStyle = (col(color)); g.lineWidth = 3;
  g.beginPath(); g.moveTo(CX - 13, CY - 7); g.lineTo(CX + 13, CY - 7); g.lineTo(CX + 13, CY + 7); g.lineTo(CX - 13, CY + 7); g.closePath(); g.stroke();
  g.fillStyle = (col(color));
  g.fillRect(CX - 2, CY - 9, 4, 18);
  g.fillRect(CX - 2, CY - 1, 4, 10);
  g.fillStyle = ('#ffffff');
  g.fillRect(CX - 1, CY - 6, 2, 4);
  g.fillRect(CX - 1, CY + 2, 2, 4);
}

type Drawer = (g: CanvasRenderingContext2D, color: number, glow: number) => void;

const DRAWERS: Record<string, Drawer> = {
  projectile: drawProjectile,
  homing: drawHoming,
  beam: drawBeam,
  aoe: drawAoe,
  zone: drawZone,
  wave: drawWave,
  rain: drawRain,
  melee: drawMelee,
  dash: drawDash,
  clone: drawClone,
  summon: drawSummon,
  buff: drawBuff,
  counter: drawCounter,
  pull: drawPull,
  trap: drawTrap,
};

function drawIcon(kind: string, color: number, glow: number): HTMLCanvasElement {
  const key = `${kind}:${color.toString(16)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cvs = document.createElement('canvas');
  cvs.width = ICON;
  cvs.height = ICON;
  const g = cvs.getContext('2d')!;
  (DRAWERS[kind] ?? DRAWERS.projectile)(g, color, glow);
  cache.set(key, cvs);
  return cvs;
}

/* ---------------------------------------------------------------- component */

interface SkillIconProps {
  skill: SkillDef;
  size?: number;
  grade?: 'locked' | 'owned' | 'equipped' | 'maxed';
}

export function SkillIcon({ skill, size = 56, grade = 'owned' }: SkillIconProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const src = drawIcon(skill.kind, skill.color, skill.color);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(src, 0, 0, ICON, ICON, 0, 0, size, size);
    if (grade === 'locked') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', size / 2, size / 2 + 1);
    }
  }, [skill.id, skill.kind, skill.color, size, grade]);

  return (
    <canvas
      ref={ref}
      className="shrink-0 rounded border border-white/10"
      style={{ width: size, height: size, background: '#0b0b14' }}
    />
  );
}
