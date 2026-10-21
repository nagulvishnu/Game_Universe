/**
 * SHADOWSTRIKE — Weapon Showcase & Visual Stats Component.
 *
 * Provides:
 * 1. StandaloneWeaponPreview — Animated canvas showcase displaying the detailed weapon model
 *    with dynamic ambient glow, tilt, and edge glints.
 * 2. WeaponStatGauges — Stylized neon meter gauges for Damage, Speed, Range, and Guard Break.
 * 3. WeaponRarityBadge — Glowing rarity badge with elemental accenting.
 */

import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { WeaponDef, Rarity } from '../data/weapons';
import { drawWeaponArt } from '../game/rig/WeaponRenderer';
import { CanvasGraphics } from './FighterPreview';
import { RARITY_COLOR, hexStr } from './shared';

interface PreviewProps {
  weapon: WeaponDef;
  width?: number;
  height?: number;
  interactive?: boolean;
}

export function StandaloneWeaponPreview({ weapon, width = 340, height = 130 }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const adapter = new CanvasGraphics(ctx) as unknown as Phaser.GameObjects.Graphics;
    let raf = 0;
    const startTime = performance.now();

    const render = (now: number) => {
      const t = (now - startTime) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // 1. Ambient elemental background glow
      const glowRgb = hexStr(weapon.glow);
      const radGrad = ctx.createRadialGradient(
        width * 0.55, height * 0.45, 10,
        width * 0.55, height * 0.45, Math.max(width, height) * 0.65
      );
      radGrad.addColorStop(0, `${glowRgb}28`);
      radGrad.addColorStop(0.5, `${glowRgb}0a`);
      radGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle weapon floating bob
      const floatY = Math.sin(t * 1.8) * 3;
      const tiltAng = Math.cos(t * 1.4) * 0.02;

      ctx.save();
      // Position weapon diagonally across card
      const originX = width * 0.24;
      const originY = height * 0.72 + floatY;
      ctx.translate(originX, originY);
      ctx.rotate(tiltAng);

      // Dynamic scale based on weapon length so all weapons fill the showcase nicely
      const baseLen = weapon.length || 24;
      const targetScale = Math.min(1.4, Math.max(0.75, 110 / Math.max(30, baseLen)));

      // Ground / shadow under weapon
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(30, 16, 50, 10, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Render the high-detail weapon art
      const displayAngle = -Math.PI / 4.2; // approx -43 degrees upward-right
      drawWeaponArt(
        adapter,
        { x: 0, y: 0 },
        displayAngle,
        weapon,
        targetScale,
        1,
        t
      );

      // Micro edge glint effect travelling along blade
      const glintPhase = (t * 0.6) % 2.5;
      if (glintPhase < 1 && baseLen > 25) {
        const glintDist = (baseLen * targetScale) * (0.2 + glintPhase * 0.75);
        const gx = Math.cos(displayAngle) * glintDist;
        const gy = Math.sin(displayAngle) * glintDist;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(gx, gy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [weapon, width, height]);

  return (
    <div className="relative overflow-hidden rounded-md border border-white/10 bg-gradient-to-b from-[#131320] via-[#0d0d16] to-[#07070e] shadow-inner">
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        className="block"
      />
      {/* Decorative corner grid marks */}
      <div className="pointer-events-none absolute left-2 top-2 text-[9px] font-mono tracking-widest text-white/30 uppercase">
        {weapon.shape} · {weapon.grip}-hand
      </div>
      <div className="pointer-events-none absolute right-2 bottom-1.5 text-[9px] font-mono text-cyan-400/50">
        LEN {weapon.length}px
      </div>
    </div>
  );
}

interface StatGaugeProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  color: string;
  icon?: string;
}

export function StatGauge({ label, value, max, unit = '', color, icon }: StatGaugeProps) {
  const pct = Math.min(100, Math.max(6, Math.round((value / max) * 100)));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-slate-300">
          {icon && <span className="opacity-70">{icon}</span>}
          {label}
        </span>
        <span className="font-mono font-semibold" style={{ color }}>
          {value}{unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 p-[1px]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 8px ${color}88`,
          }}
        />
      </div>
    </div>
  );
}

export function WeaponStatGauges({ weapon }: { weapon: WeaponDef }) {
  const comboDamage = weapon.combo.reduce((acc, hit) => acc + hit.damage, 0);
  const startup = weapon.combo[0].startup;
  const reach = weapon.combo[0].reach;
  const guard = Math.round(weapon.combo[2].guardDamage);

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded border border-white/5 bg-black/25 p-3">
      <StatGauge
        label="Combo DMG"
        value={comboDamage}
        max={65}
        color="#ff8a3a"
        icon="⚔"
      />
      <StatGauge
        label="Charged DMG"
        value={weapon.charged.damage}
        max={65}
        color="#ffd34a"
        icon="💥"
      />
      <StatGauge
        label="Reach"
        value={reach}
        max={130}
        unit="px"
        color="#7fd4ff"
        icon="📏"
      />
      <StatGauge
        label="Speed"
        value={Math.round(1000 / startup)}
        max={18}
        unit=" cps"
        color="#a080ff"
        icon="⚡"
      />
      <StatGauge
        label="Guard Break"
        value={guard}
        max={35}
        color="#ff4a70"
        icon="🛡"
      />
      <StatGauge
        label="Mobility"
        value={Math.round(weapon.moveSpeedMul * 100)}
        max={130}
        unit="%"
        color="#6cf0c0"
        icon="👟"
      />
    </div>
  );
}

export function WeaponRarityBadge({ rarity }: { rarity: Rarity }) {
  const color = RARITY_COLOR[rarity] || '#ffffff';

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        borderColor: `${color}66`,
        color,
        background: `${color}14`,
        boxShadow: `0 0 10px ${color}20`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: color }} />
      {rarity}
    </span>
  );
}
