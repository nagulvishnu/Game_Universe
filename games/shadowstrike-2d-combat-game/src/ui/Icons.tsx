/**
 * SHADOWSTRIKE — line-art icon set.
 *
 * Every icon is a 24x24 stroke glyph drawn with currentColor so it can be
 * tinted per context (nav rail, tile headers, HUD buttons).
 */

import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Svg({ size = 20, className = '', strokeWidth = 1.6, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconSword(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 4 11 13" />
      <path d="M20 4c0 5-2.5 8-6.5 9.5L11 13l-1.5 2.5" />
      <path d="M4 20l4-4" />
      <path d="M4 20l2.5-.6L13 13" />
      <path d="M9 15l-2 2" />
    </Svg>
  );
}

export function IconCrossedSwords(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3h4l11 11" />
      <path d="M21 3h-4L6 14" />
      <path d="M4 20l4-4" />
      <path d="M20 20l-4-4" />
      <path d="M8 16l-1 1 3 3 1-1" />
      <path d="M16 16l1 1-3 3-1-1" />
    </Svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      <path d="M5 15l.6 1.6L7.2 17l-1.6.6L5 19.2l-.6-1.6L2.8 17l1.6-.4L5 15Z" />
    </Svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 3v5.5c0 4.2-2.8 7.6-7 9.5-4.2-1.9-7-5.3-7-9.5V6l7-3Z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </Svg>
  );
}

export function IconWings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="M12 8c-2.5-2.2-5.5-2.6-8.5-1.6C3 10 4.5 14 8 16" />
      <path d="M12 8c2.5-2.2 5.5-2.6 8.5-1.6C21 10 19.5 14 16 16" />
      <path d="M8 16c1.5 1 3 1.6 4 3 1-1.4 2.5-2 4-3" />
    </Svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function IconPerson(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
    </Svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4.5 19 12 7 19.5V4.5Z" fill="currentColor" strokeWidth={1.2} />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.4" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      <path d="M12 14v3" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconGem(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3h12l3 6-9 12L3 9l3-6Z" />
      <path d="M3 9h18" />
      <path d="M9 3 7 9l5 12 5-12-2-6" />
    </Svg>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </Svg>
  );
}

export function IconFlame(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3c4 4 6 6 6 9.5A6 6 0 0 1 6 12.5C6 9 8 7 12 3Z" />
      <path d="M12 20a3 3 0 0 0 3-3c0-2-3-4-3-4s-3 2-3 4a3 3 0 0 0 3 3Z" />
    </Svg>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2 5 13h6l-1 9 8-11h-6l1-9Z" />
    </Svg>
  );
}

export function IconHeart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
    </Svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5v1.5A3.5 3.5 0 0 0 8.5 10" />
      <path d="M16 5h3v1.5A3.5 3.5 0 0 1 15.5 10" />
      <path d="M12 13v4" />
      <path d="M8.5 20h7l-1-3h-5l-1 3Z" />
    </Svg>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 13l9 5 9-5" />
    </Svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconDumbbell(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 9v6M6 7v10M18 7v10M21 9v6" />
      <path d="M6 12h12" />
    </Svg>
  );
}

export function IconFootprints(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4c2 0 3 1.6 3 4s-1 4.5-3 4.5-3-2-3-4.5S5 4 7 4Z" />
      <path d="M5 15c2 0 3 1.4 3 3.5S6 21 4.5 21 3 19.8 3 18s.5-3 2-3Z" />
      <path d="M17 5c2 0 3 1.6 3 4s-1 4.5-3 4.5-3-2-3-4.5 1-4 3-4Z" />
      <path d="M19 16c2 0 3 1.4 3 3.5S20 22 18.5 22 17 20.8 17 19s.5-3 2-3Z" />
    </Svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="5" width="3.6" height="14" rx="1" fill="currentColor" strokeWidth={1} />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1" fill="currentColor" strokeWidth={1} />
    </Svg>
  );
}

/**
 * Stylised fighter silhouette — a shadow warrior with a blade and a trailing
 * scarf. Used as artwork inside menu tiles.
 */
export function SilhouetteFigure({
  size = 120,
  color = '#0a0714',
  accent = '#c026d3',
  className = '',
}: {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 10px ${accent}55)` }}
    >
      <g fill={color}>
        {/* scarf */}
        <path d="M44 30c-6 2-13 6-19 3 4 5 11 6 18 3l3-6Z" opacity={0.9} />
        <path d="M40 33c-8 4-16 4-22 1 5 6 14 8 23 4l2-5Z" opacity={0.7} />
        {/* head */}
        <circle cx="52" cy="22" r="8.5" />
        <path d="M45 17c3-3 8-3 11 0-3-1-7-1-11 0Z" opacity={0.6} />
        {/* torso */}
        <path d="M46 29h12l3 14-4 15H45l-3-15 4-14Z" />
        {/* arms */}
        <path d="M44 32c-4 3-7 9-8 15l4 2c2-6 4-11 7-14l-3-3Z" />
        <path d="M58 31c4 2 8 7 11 13l-4 2c-2-5-5-9-8-12l1-3Z" />
        {/* legs */}
        <path d="M46 57h4l-2 18-3 18h-4l3-19 2-17Z" />
        <path d="M54 57h4l1 17 3 19h-4l-5-18-1-18Z" />
      </g>
      {/* blade */}
      <g stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M68 46 88 12" />
        <path d="M64 48 69 40" strokeWidth="3" />
        <path d="M62 50 66 44" />
      </g>
      <circle cx="53" cy="21" r="1.8" fill={accent} />
    </svg>
  );
}
