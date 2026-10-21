import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { buildSkeleton, drawFighter, locomotionPose } from '../game/rig/StickRig';
import { getWeapon } from '../data/weapons';
import { EQUIPMENT_BY_ID, type EquipmentDef } from '../data/equipment';

/**
 * Canvas2D adapter implementing the subset of the Phaser Graphics API used by
 * the stickman rig, so menus reuse the exact same drawing code as gameplay.
 */
export class CanvasGraphics {
  private ctx: CanvasRenderingContext2D;
  private pathOpen = false;
  constructor(ctx: CanvasRenderingContext2D) { this.ctx = ctx; }

  private rgba(color: number, alpha: number) {
    return `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${alpha})`;
  }
  clear() { /* handled by the host */ }
  lineStyle(w: number, color: number, alpha = 1) { this.ctx.lineWidth = w; this.ctx.strokeStyle = this.rgba(color, alpha); this.ctx.lineCap = 'round'; }
  fillStyle(color: number, alpha = 1) { this.ctx.fillStyle = this.rgba(color, alpha); }
  beginPath() { this.ctx.beginPath(); this.pathOpen = true; }
  closePath() { this.ctx.closePath(); }
  moveTo(x: number, y: number) { if (!this.pathOpen) this.beginPath(); this.ctx.moveTo(x, y); }
  lineTo(x: number, y: number) { this.ctx.lineTo(x, y); }
  arc(x: number, y: number, r: number, s: number, e: number, ccw = false) { this.ctx.arc(x, y, r, s, e, ccw); }
  strokePath() { this.ctx.stroke(); this.pathOpen = false; }
  fillPath() { this.ctx.fill(); this.pathOpen = false; }
  lineBetween(x1: number, y1: number, x2: number, y2: number) { this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke(); }
  fillCircle(x: number, y: number, r: number) { this.ctx.beginPath(); this.ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); this.ctx.fill(); }
  strokeCircle(x: number, y: number, r: number) { this.ctx.beginPath(); this.ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); this.ctx.stroke(); }
  fillEllipse(x: number, y: number, w: number, h: number) { this.ctx.beginPath(); this.ctx.ellipse(x, y, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2); this.ctx.fill(); }
  strokeEllipse(x: number, y: number, w: number, h: number) { this.ctx.beginPath(); this.ctx.ellipse(x, y, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2); this.ctx.stroke(); }
  fillRect(x: number, y: number, w: number, h: number) { this.ctx.fillRect(x, y, w, h); }
  strokeRect(x: number, y: number, w: number, h: number) { this.ctx.strokeRect(x, y, w, h); }
  fillRoundedRect(x: number, y: number, w: number, h: number, r = 4) { this.roundRect(x, y, w, h, r); this.ctx.fill(); }
  strokeRoundedRect(x: number, y: number, w: number, h: number, r = 4) { this.roundRect(x, y, w, h, r); this.ctx.stroke(); }
  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + rr, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, rr);
    this.ctx.arcTo(x + w, y + h, x, y + h, rr);
    this.ctx.arcTo(x, y + h, x, y, rr);
    this.ctx.arcTo(x, y, x + w, y, rr);
    this.ctx.closePath();
  }
  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.lineTo(x3, y3); this.ctx.closePath(); this.ctx.fill();
  }
  strokeTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.lineTo(x3, y3); this.ctx.closePath(); this.ctx.stroke();
  }
}

interface Props {
  weaponId: string;
  bodyColor: number;
  eyeColor: number;
  equipment: string[];
  fighterId?: string;
  width?: number;
  height?: number;
  animate?: boolean;
  /** No panel chrome — the figure floats on the page background. */
  transparent?: boolean;
  /** Scale the figure to fill the canvas height instead of fitting inside it. */
  fill?: boolean;
  /** Extra zoom-out multiplier applied on top of the base fit (e.g. 0.8 shows oversized weapons fully). */
  zoom?: number;
}

/** Rig height in skeleton units (head top to feet). */
const RIG_HEIGHT = 118;

export function FighterPreview({
  weaponId, bodyColor, eyeColor, equipment, fighterId,
  width = 220, height = 230, animate = true, transparent = false, fill = false, zoom = 1,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const weapon = getWeapon(weaponId);
    const eq: Record<string, EquipmentDef> = {};
    for (const id of equipment) {
      const item = EQUIPMENT_BY_ID[id];
      if (item) eq[item.slot] = item;
    }
    const adapter = new CanvasGraphics(ctx) as unknown as Phaser.GameObjects.Graphics;
    let raf = 0;
    const start = performance.now();

    const render = (now: number) => {
      const t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      // ground shadow
      ctx.save();
      ctx.translate(width / 2, height - 12);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 44, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      const scale = (fill
        ? (height - 18) / RIG_HEIGHT
        : Math.min(width / 170, (height - 40) / RIG_HEIGHT)) * zoom;
      ctx.scale(scale, scale);
      const pose = locomotionPose('idle', animate ? t : 0.4);
      const sk = buildSkeleton(pose, 1);
      drawFighter(adapter, sk, {
        body: bodyColor,
        eye: eyeColor,
        outline: 0x8a5aff,
        equipment: eq,
        scale: 1,
        alpha: 1,
        fighterId,
        time: t,
      }, weapon, 0);
      ctx.restore();
      if (animate) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [weaponId, bodyColor, eyeColor, equipment.join(','), fighterId, width, height, animate, fill, zoom]);

  return (
    <canvas
      ref={ref}
      style={{ width, height }}
      className={transparent
        ? 'shrink-0'
        : 'shrink-0 rounded-sm border border-white/10 bg-gradient-to-b from-[#10101c] to-[#07070e]'}
    />
  );
}
