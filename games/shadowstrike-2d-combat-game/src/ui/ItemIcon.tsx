/**
 * SHADOWSTRIKE — procedural equipment item icons.
 *
 * Draws a recognisable thumbnail for every equipment style using the item's own
 * colour and glow. Drawn once and cached offscreen keyed by (slot, style, colour).
 */

import { useEffect, useRef } from 'react';
import type { EquipmentDef } from '../data/equipment';

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

function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.arcTo(x + w, y, x + w, y + rr, rr);
  g.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  g.arcTo(x, y + h, x, y + h - rr, rr);
  g.arcTo(x, y, x + rr, y, rr);
  g.closePath();
}

function fillRoundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundRectPath(g, x, y, w, h, r);
  g.fill();
}

function strokeRoundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundRectPath(g, x, y, w, h, r);
  g.stroke();
}

/* ----- head ----- */
function drawHood(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (rgba(color, 0.95));
  g.beginPath(); g.arc(CX, CY + 2, 16, Math.PI * 1.05, Math.PI * 2.05, false);
  g.lineTo(CX - 14, CY + 16); g.closePath(); g.fill();
  g.strokeStyle = (col(glow)); g.lineWidth = 2; g.stroke();
}
function drawHorns(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.beginPath(); g.moveTo(CX - 8, CY - 2); g.lineTo(CX - 16, CY - 24); g.lineTo(CX - 2, CY - 8); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(CX + 8, CY - 2); g.lineTo(CX + 16, CY - 24); g.lineTo(CX + 2, CY - 8); g.closePath(); g.fill();
  g.strokeStyle = (col(glow)); g.lineWidth = 2;
  g.beginPath(); g.moveTo(CX + 8, CY - 2); g.lineTo(CX + 16, CY - 24); g.lineTo(CX + 2, CY - 8); g.stroke();
}
function drawCrown(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.fillRect(CX - 12, CY - 12, 24, 5);
  for (let i = -1; i <= 1; i++) {
    g.beginPath(); g.moveTo(CX + i * 8 - 3, CY - 12); g.lineTo(CX + i * 8, CY - 20); g.lineTo(CX + i * 8 + 3, CY - 12); g.closePath(); g.fill();
  }
  g.strokeStyle = (col(glow)); g.lineWidth = 2; g.strokeRect(CX - 12, CY - 12, 24, 5);
}
function drawHalo(g: CanvasRenderingContext2D, _color: number, glow: number) {
  void _color;
  g.strokeStyle = (col(glow)); g.lineWidth = 3;
  g.beginPath(); g.ellipse(CX, CY - 14, 20, 7, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = ('#ffffff'); g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(CX, CY - 14, 16, 5, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = ('#ffffff'); g.beginPath(); g.arc(CX + 10, CY - 15, 2, 0, Math.PI * 2); g.fill();
}
function drawTopknot(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.beginPath(); g.arc(CX - 2, CY - 12, 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(CX + 1, CY - 15, 8, 4, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = (col(glow)); g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(CX - 5, CY - 11); g.lineTo(CX + 2, CY - 11); g.stroke();
}

/* ----- mask ----- */
function drawOni(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.beginPath(); g.ellipse(CX + 2, CY + 2, 14, 12, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = (col(glow)); g.lineWidth = 2; g.beginPath(); g.ellipse(CX + 2, CY + 2, 14, 12, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = ('#ffffff');
  g.beginPath(); g.moveTo(CX + 4, CY + 4); g.lineTo(CX + 7, CY + 7); g.lineTo(CX + 2, CY + 5); g.closePath(); g.fill();
}
function drawVisor(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (col(color));
  fillRoundRect(g, CX - 12, CY - 4, 24, 9, 2);
  g.fillStyle = (col(glow));
  g.fillRect(CX - 6, CY - 2.5, 12, 4);
  g.strokeStyle = (col(glow)); g.lineWidth = 1.5; strokeRoundRect(g, CX - 12, CY - 4, 24, 9, 2);
}
function drawKitsune(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.beginPath(); g.ellipse(CX + 3, CY + 1, 14, 11, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = (col(glow));
  g.beginPath(); g.moveTo(CX + 9, CY - 2); g.lineTo(CX + 14, CY - 1); g.lineTo(CX + 9, CY + 2); g.closePath(); g.fill();
}
function drawWrap(g: CanvasRenderingContext2D, color: number, _glow: number) {
  void _glow;
  g.fillStyle = (col(color));
  fillRoundRect(g, CX - 10, CY + 1, 20, 7, 2);
}

/* ----- outfit (tunic silhouette) ----- */
function drawOutfit(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.beginPath(); g.moveTo(CX, CY - 10); g.lineTo(CX - 12, CY + 8); g.lineTo(CX + 12, CY + 8); g.closePath(); g.fill();
  g.fillStyle = ('#14141e');
  g.beginPath(); g.moveTo(CX - 2, CY + 2); g.lineTo(CX - 8, CY + 10); g.lineTo(CX + 8, CY + 10); g.lineTo(CX + 2, CY + 2); g.closePath(); g.fill();
  g.strokeStyle = (col(glow)); g.lineWidth = 2;
  g.beginPath(); g.moveTo(CX - 2, CY + 2); g.lineTo(CX, CY - 10); g.lineTo(CX + 2, CY + 2); g.stroke();
}

/* ----- armor (chestplate) ----- */
function drawArmor(g: CanvasRenderingContext2D, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.beginPath(); g.moveTo(CX, CY - 8); g.lineTo(CX - 10, CY + 2); g.lineTo(CX + 10, CY + 2); g.closePath(); g.fill();
  g.fillStyle = ('#121218');
  g.beginPath(); g.moveTo(CX - 2, CY); g.lineTo(CX - 7, CY + 6); g.lineTo(CX + 7, CY + 6); g.lineTo(CX + 2, CY); g.closePath(); g.fill();
  g.strokeStyle = (col(glow)); g.lineWidth = 2;
  g.beginPath(); g.moveTo(CX - 2, CY); g.lineTo(CX, CY - 8); g.lineTo(CX + 2, CY); g.stroke();
  g.fillStyle = (col(glow));
  g.beginPath(); g.arc(CX, CY - 4, 2, 0, Math.PI * 2); g.fill();
}

/* ----- gloves ----- */
function drawGloves(g: CanvasRenderingContext2D, style: string, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.beginPath(); g.arc(CX, CY + 2, 8, 0, Math.PI * 2); g.fill();
  if (style === 'storm') {
    g.fillStyle = (col(glow));
    g.beginPath(); g.arc(CX, CY + 2, 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = (col(glow)); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(CX - 3, CY - 2); g.lineTo(CX + 3, CY + 6); g.stroke();
  } else if (style === 'talons') {
    g.fillStyle = (col(color));
    g.beginPath(); g.moveTo(CX + 2, CY - 2); g.lineTo(CX + 7, CY - 1); g.lineTo(CX + 2, CY + 2); g.closePath(); g.fill();
  } else {
    g.strokeStyle = (col(glow)); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(CX - 3, CY - 2); g.lineTo(CX + 3, CY + 6); g.stroke();
  }
}

/* ----- boots ----- */
function drawBoots(g: CanvasRenderingContext2D, style: string, color: number, glow: number) {
  g.fillStyle = (col(color));
  fillRoundRect(g, CX - 9, CY - 3, 18, 9, 3);
  g.strokeStyle = (col(glow)); g.lineWidth = 1.5; strokeRoundRect(g, CX - 9, CY - 3, 18, 9, 3);
  if (style === 'jet') {
    g.fillStyle = (col(glow));
    const pulse = 3 + Math.sin(Date.now() / 100) * 2;
    g.beginPath(); g.moveTo(CX - 9, CY); g.lineTo(CX - 9 - pulse, CY + 2); g.lineTo(CX - 9, CY + 4); g.closePath(); g.fill();
  } else if (style === 'titan') {
    g.fillStyle = (col(glow));
    g.fillRect(CX + 3, CY - 2, 5, 6);
    g.strokeStyle = ('#ffffff'); g.lineWidth = 1; g.strokeRect(CX + 3, CY - 2, 5, 6);
  } else if (style === 'tabi') {
    g.strokeStyle = ('#090a10'); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(CX + 4, CY - 2); g.lineTo(CX + 7, CY - 2); g.stroke();
  }
}

/* ----- back ----- */
function drawBack(g: CanvasRenderingContext2D, style: string, color: number, glow: number) {
  if (style === 'cape') {
    g.fillStyle = (rgba(color, 0.92));
    g.beginPath(); g.moveTo(CX, CY - 6); g.lineTo(CX - 20, CY + 12); g.lineTo(CX - 10, CY + 24); g.lineTo(CX + 2, CY + 10); g.closePath(); g.fill();
  } else if (style === 'wings') {
    g.fillStyle = (col(color));
    g.beginPath(); g.moveTo(CX, CY + 2); g.lineTo(CX - 24, CY - 4); g.lineTo(CX - 8, CY + 10); g.closePath(); g.fill();
    g.strokeStyle = (col(glow)); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(CX, CY + 2); g.lineTo(CX - 36, CY - 14); g.lineTo(CX - 16, CY + 16); g.stroke();
  } else if (style === 'scarf') {
    g.fillStyle = (col(color));
    g.fillRect(CX - 5, CY - 1, 10, 6);
    g.beginPath(); g.moveTo(CX - 2, CY); g.lineTo(CX - 22, CY - 6); g.lineTo(CX - 20, CY - 2); g.closePath(); g.fill();
  } else {
    g.strokeStyle = (col(color)); g.lineWidth = 5;
    g.beginPath(); g.moveTo(CX - 4, CY + 2); g.lineTo(CX - 16, CY + 16); g.stroke();
  }
}

/* ----- aura ----- */
function drawAura(g: CanvasRenderingContext2D, style: string, color: number, glow: number) {
  const c = col(glow);
  if (style === 'ember') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const rr = 10 + i * 4;
      g.fillStyle = (rgba(glow, 0.8));
      g.beginPath(); g.arc(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr * 0.7, 2, 0, Math.PI * 2); g.fill();
    }
  } else if (style === 'frost') {
    g.strokeStyle = (c); g.lineWidth = 2;
    g.beginPath(); g.ellipse(CX, CY, 14, 10, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = (c);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath(); g.arc(CX + Math.cos(a) * 11, CY + Math.sin(a) * 8, 1.8, 0, Math.PI * 2); g.fill();
    }
  } else if (style === 'volt') {
    g.strokeStyle = (c); g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.beginPath(); g.moveTo(CX + Math.cos(a) * 14, CY + Math.sin(a) * 14); g.lineTo(CX + Math.cos(a + 0.7) * 8, CY + Math.sin(a + 0.7) * 8); g.stroke();
    }
  } else if (style === 'void') {
    g.strokeStyle = (c); g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(CX, CY, 18, 24, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = (col(color));
    g.beginPath(); g.arc(CX - 10, CY - 14, 2.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(CX + 10, CY - 14, 2.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(CX - 10, CY + 14, 2.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(CX + 10, CY + 14, 2.5, 0, Math.PI * 2); g.fill();
  } else {
    void color;
    g.strokeStyle = (c); g.lineWidth = 2;
    g.beginPath(); g.arc(CX, CY, 14, 0, Math.PI * 2); g.stroke();
  }
}

/* ----- trail ----- */
function drawTrail(g: CanvasRenderingContext2D, style: string, color: number, glow: number) {
  g.strokeStyle = (col(color)); g.lineWidth = 5;
  g.beginPath(); g.moveTo(CX - 14, CY); g.lineTo(CX + 14, CY); g.stroke();
  g.fillStyle = (col(glow));
  g.beginPath(); g.arc(CX + 14, CY, 3, 0, Math.PI * 2); g.fill();
  if (style === 'ribbon') {
    g.strokeStyle = (col(glow)); g.lineWidth = 2;
    g.beginPath(); g.moveTo(CX + 14, CY - 4); g.lineTo(CX + 22, CY - 2); g.lineTo(CX + 22, CY + 4); g.stroke();
  } else if (style === 'flame') {
    g.fillStyle = (col(glow));
    g.beginPath(); g.moveTo(CX + 14, CY); g.quadraticCurveTo(CX + 20, CY - 6, CX + 16, CY - 10); g.lineTo(CX + 12, CY - 6); g.closePath(); g.fill();
  } else if (style === 'prism') {
    g.strokeStyle = ('#ffffff'); g.lineWidth = 2;
    g.beginPath(); g.moveTo(CX + 14, CY - 4); g.lineTo(CX + 18, CY); g.lineTo(CX + 14, CY + 4); g.stroke();
  }
}

/* ----- emote ----- */
function drawEmote(g: CanvasRenderingContext2D, style: string, color: number, glow: number) {
  g.fillStyle = (col(color));
  g.beginPath(); g.arc(CX, CY - 2, 10, Math.PI, Math.PI * 2, false); g.fill();
  g.fillRect(CX - 9, CY - 2, 18, 8);
  if (style === 'roar') {
    g.fillStyle = ('#ffffff');
    g.beginPath(); g.moveTo(CX - 4, CY - 6); g.lineTo(CX, CY - 10); g.lineTo(CX + 4, CY - 6); g.closePath(); g.fill();
  } else if (style === 'vanish') {
    g.strokeStyle = (col(glow)); g.lineWidth = 2;
    g.beginPath(); g.arc(CX, CY - 2, 14, 0, Math.PI * 2); g.stroke();
  } else if (style === 'ascend') {
    g.strokeStyle = ('#ffffff'); g.lineWidth = 2;
    g.beginPath(); g.moveTo(CX, CY + 6); g.lineTo(CX, CY - 14); g.stroke();
  } else {
    void glow;
  }
}

const HEAD: Record<string, (g: CanvasRenderingContext2D, color: number, glow: number) => void> = {
  hood: drawHood, horns: drawHorns, crown: drawCrown, halo: drawHalo, topknot: drawTopknot,
};
const MASK: Record<string, (g: CanvasRenderingContext2D, color: number, glow: number) => void> = {
  oni: drawOni, visor: drawVisor, kitsune: drawKitsune, wrap: drawWrap,
};
const ARMOR: Record<string, (g: CanvasRenderingContext2D, color: number, glow: number) => void> = {
  light: drawArmor, heavy: drawArmor, spirit: drawArmor, dragon: drawArmor,
};

function drawItem(g: CanvasRenderingContext2D, item: EquipmentDef) {
  const { slot, style, color, glow } = item;
  if (slot === 'head') { (HEAD[style] ?? drawDefault)(g, color, glow); return; }
  if (slot === 'mask') { (MASK[style] ?? drawDefault)(g, color, glow); return; }
  if (slot === 'outfit') { drawOutfit(g, color, glow); return; }
  if (slot === 'armor') { (ARMOR[style] ?? drawArmor)(g, color, glow); return; }
  if (slot === 'gloves') { drawGloves(g, style, color, glow); return; }
  if (slot === 'boots') { drawBoots(g, style, color, glow); return; }
  if (slot === 'back') { drawBack(g, style, color, glow); return; }
  if (slot === 'aura') { drawAura(g, style, color, glow); return; }
  if (slot === 'trail') { drawTrail(g, style, color, glow); return; }
  if (slot === 'emote') { drawEmote(g, style, color, glow); return; }
  drawDefault(g, color, glow);
}

function drawDefault(g: CanvasRenderingContext2D, color: number, _glow: number) {
  void _glow;
  g.fillStyle = (rgba(color, 0.25));
  g.beginPath(); g.arc(CX, CY, 10, 0, Math.PI * 2); g.fill();
  g.strokeStyle = (col(color)); g.lineWidth = 2; g.stroke();
}

function drawItemIcon(item: EquipmentDef): HTMLCanvasElement {
  const key = `${item.slot}:${item.style}:${item.color * 1000003 + item.glow}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cvs = document.createElement('canvas');
  cvs.width = ICON;
  cvs.height = ICON;
  const g = cvs.getContext('2d')!;
  drawItem(g, item);
  cache.set(key, cvs);
  return cvs;
}

interface ItemIconProps {
  item: EquipmentDef;
  size?: number;
  grade?: 'locked' | 'owned' | 'equipped';
}

export function ItemIcon({ item, size = 56, grade = 'owned' }: ItemIconProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const src = drawItemIcon(item);
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
  }, [item.id, item.style, item.color, item.glow, item.slot, size, grade]);

  return (
    <canvas
      ref={ref}
      className="shrink-0 rounded border border-white/10"
      style={{ width: size, height: size, background: '#0b0b14' }}
    />
  );
}
