/**
 * SHADOWSTRIKE — procedural weapon glyphs.
 *
 * A crisp vector silhouette for every weapon shape, tinted with the weapon's
 * own body colour and glow. Used in the opponent roster, the "weapons & skills"
 * panel and the weapon skin carousel.
 */

import type { WeaponShape } from '../data/weapons';

interface Props {
  shape: WeaponShape;
  size?: number;
  color?: string;
  glow?: string;
  className?: string;
  /** draw as an outline only (locked items) */
  flat?: boolean;
}

export function WeaponGlyph({ shape, size = 44, color, glow, className = '', flat = false }: Props) {
  const body = color ?? '#e8e8f2';
  const aura = glow ?? '#a855f7';
  const fill = flat ? 'none' : body;
  const opacity = flat ? 0.65 : 1;

  const common = {
    fill,
    stroke: aura,
    strokeWidth: 1.2,
    strokeLinejoin: 'round' as const,
    opacity,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      style={flat ? undefined : { filter: `drop-shadow(0 0 6px ${aura}88)` }}
    >
      <g {...common}>
        {shape === 'katana' && (
          <>
            <path d="M14 54 47 17c2-2.4 4.6-3.6 6.6-3.8-1 5-3 9-6.4 11.8L24 48Z" />
            <path d="M14 54l-3.4 3.4M16 50l-4 4" stroke={aura} strokeWidth={2.4} fill="none" />
            <path d="M22 44l4 4" stroke={aura} strokeWidth={2.2} fill="none" />
          </>
        )}
        {shape === 'sabre' && (
          <>
            <path d="M14 54c0-14 8-28 26-38 4 12-2 30-16 38Z" />
            <path d="M14 54l-3.4 3.4" stroke={aura} strokeWidth={2.4} fill="none" />
            <path d="M20 46c6-2 12-7 16-13" stroke={aura} strokeWidth={1.4} fill="none" opacity={0.75} />
          </>
        )}
        {shape === 'greatsword' && (
          <>
            <path d="M12 52 44 10c2.6-3.4 5-5.4 7-6-0.6 4.6-1.6 8-4 11.4L24 50Z" />
            <path d="M12 52l-3 3" stroke={aura} strokeWidth={2.6} fill="none" />
            <path d="M18 44l6 5" stroke={aura} strokeWidth={3} fill="none" />
            <path d="M28 34l6 5" stroke={aura} strokeWidth={1.2} fill="none" opacity={0.7} />
          </>
        )}
        {shape === 'dagger' && (
          <>
            <path d="M14 54 44 22c1.6-1.8 2.6-3.2 3-4.4-2.4.2-4.6 1-6.6 3L16 44Z" />
            <path d="M14 54l-3 3" stroke={aura} strokeWidth={2.2} fill="none" />
            <path d="M20 46l4 4" stroke={aura} strokeWidth={2} fill="none" />
          </>
        )}
        {shape === 'spear' && (
          <>
            <path d="M36 8c4 4 5 8 4 12l-8-2c0-4 1.6-7.4 4-10Z" />
            <path d="M32 18h8" stroke={aura} strokeWidth={1.6} fill="none" />
            <path d="M36 18 12 54" stroke={body} strokeWidth={3} />
            <path d="M36 18 12 54" stroke={aura} strokeWidth={1} fill="none" opacity={0.6} />
          </>
        )}
        {shape === 'glaive' && (
          <>
            <path d="M40 6c6 4 9 10 8 16-3-1-5-3-6.5-5.5C40 13 38 9.6 34 8Z" />
            <path d="M38 20 14 54" stroke={body} strokeWidth={3} />
            <path d="M38 20 14 54" stroke={aura} strokeWidth={1} fill="none" opacity={0.6} />
            <path d="M30 30l6-4" stroke={aura} strokeWidth={2} fill="none" />
          </>
        )}
        {shape === 'scythe' && (
          <>
            <path d="M46 6C30 10 16 22 12 38c6-2 12-2 18 2 2-12 8-24 16-34Z" />
            <path d="M42 8 16 54" stroke={body} strokeWidth={3} />
            <path d="M42 8 16 54" stroke={aura} strokeWidth={1} fill="none" opacity={0.6} />
          </>
        )}
        {shape === 'axe' && (
          <>
            <path d="M30 8c10 0 18 7 20 18-6 4-14 4-20 0Z" />
            <path d="M30 8c-2 6-2 12 0 18" stroke={aura} strokeWidth={1.4} fill="none" />
            <path d="M30 10 20 54" stroke={body} strokeWidth={3} />
            <path d="M30 10 20 54" stroke={aura} strokeWidth={1} fill="none" opacity={0.6} />
          </>
        )}
        {shape === 'hammer' && (
          <>
            <path d="M18 14h26v16H18Z" />
            <path d="M18 14l6-6h14l6 6" />
            <path d="M30 30v24" stroke={body} strokeWidth={4} />
            <path d="M30 30v24" stroke={aura} strokeWidth={1} fill="none" opacity={0.6} />
          </>
        )}
        {shape === 'chain' && (
          <>
            <circle cx="22" cy="16" r="5" />
            <circle cx="32" cy="26" r="4.4" />
            <circle cx="40" cy="38" r="4" />
            <circle cx="47" cy="50" r="7" />
            <path d="M18 54l6-6" stroke={body} strokeWidth={4} />
          </>
        )}
        {shape === 'energy' && (
          <>
            <path d="M34 6 46 26l-6 22-12-14 4-20Z" />
            <path d="M34 6 40 30l-6 18" stroke={aura} strokeWidth={1.6} fill="none" opacity={0.85} />
            <path d="M30 34 12 54" stroke={body} strokeWidth={3} />
          </>
        )}
        {shape === 'claws' && (
          <>
            <path d="M18 50c2-14 8-26 16-36 2 10 0 20-6 28Z" />
            <path d="M28 52c2-12 8-22 16-30 1 9-1 18-7 24Z" />
            <path d="M38 52c2-9 7-16 13-21 0 7-2 13-7 18Z" />
          </>
        )}
        {shape === 'gauntlet' && (
          <>
            <path d="M18 28c0-4 3-6 6-6h10c6 0 10 5 10 11v9c0 5-4 9-9 9H26c-5 0-8-4-8-9Z" />
            <path d="M26 22v-6M32 21v-7M38 23v-5" stroke={aura} strokeWidth={2.4} fill="none" />
          </>
        )}
        {(shape === 'none' || shape === 'claws' || shape === 'gauntlet') && shape === 'none' && (
          <>
            <path d="M20 30c0-4 3-7 7-7h8c6 0 10 5 10 11v7c0 6-4 10-10 10h-6c-5 0-9-4-9-9Z" />
            <path d="M26 24v-6M33 23v-8M40 25v-5" stroke={aura} strokeWidth={2.6} fill="none" />
          </>
        )}
      </g>
    </svg>
  );
}

export function glyphColors(shape: WeaponShape): { color: string; glow: string } {
  switch (shape) {
    case 'energy': return { color: '#66e0ff', glow: '#33ccff' };
    case 'scythe': return { color: '#241d2e', glow: '#6cf0c0' };
    case 'hammer': return { color: '#4a4a52', glow: '#ffb34a' };
    case 'chain': return { color: '#9aa4b8', glow: '#7fffd0' };
    case 'claws': return { color: '#30203a', glow: '#c46bff' };
    case 'gauntlet': return { color: '#8899aa', glow: '#ffe066' };
    case 'axe': return { color: '#5a4030', glow: '#ff7a2a' };
    default: return { color: '#e8e8f2', glow: '#a855f7' };
  }
}
