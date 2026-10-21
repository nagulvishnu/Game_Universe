/** SHADOWSTRIKE — 2D arenas. Pure side-view, parallax layered backgrounds. */

export interface ArenaLayer {
  /** parallax factor, 0 = static sky, 1 = locked to camera */
  parallax: number;
  kind: 'sky' | 'mountains' | 'pillars' | 'cracks' | 'arches' | 'embers' | 'motes' | 'runes' | 'fog' | 'floor';
  color: number;
  alt: number;
  alpha: number;
}

export interface ArenaDef {
  id: string;
  name: string;
  description: string;
  /** vertical floor position inside the 1280x720 2D scene */
  floorY: number;
  leftBound: number;
  rightBound: number;
  skyTop: number;
  skyBottom: number;
  accent: number;
  floorColor: number;
  particle: { color: number; count: number; speed: number; kind: 'ember' | 'mote' | 'snow' };
  layers: ArenaLayer[];
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'void_dojo',
    name: 'Void Dojo',
    description: 'A silent training hall suspended in nothing. Maximum combat readability.',
    floorY: 600, leftBound: 60, rightBound: 1220,
    skyTop: 0x0a0a12, skyBottom: 0x161622, accent: 0x6a7aff, floorColor: 0x1b1b26,
    particle: { color: 0x7a8aff, count: 34, speed: 14, kind: 'mote' },
    layers: [
      { parallax: 0.05, kind: 'sky', color: 0x12121c, alt: 0x0a0a12, alpha: 1 },
      { parallax: 0.18, kind: 'pillars', color: 0x191926, alt: 0x22223a, alpha: 0.9 },
      { parallax: 0.42, kind: 'arches', color: 0x1f1f30, alt: 0x2a2a44, alpha: 0.85 },
      { parallax: 0.7, kind: 'fog', color: 0x0d0d16, alt: 0x1a1a2a, alpha: 0.5 },
    ],
  },
  {
    id: 'crimson_rift',
    name: 'Crimson Rift',
    description: 'A fractured hellscape of glowing cracks and drifting embers.',
    floorY: 600, leftBound: 60, rightBound: 1220,
    skyTop: 0x1a0406, skyBottom: 0x3a0a10, accent: 0xff3a2a, floorColor: 0x240c0e,
    particle: { color: 0xff6a3a, count: 60, speed: 26, kind: 'ember' },
    layers: [
      { parallax: 0.05, kind: 'sky', color: 0x2a0608, alt: 0x120204, alpha: 1 },
      { parallax: 0.16, kind: 'mountains', color: 0x1b0406, alt: 0x300a0c, alpha: 0.95 },
      { parallax: 0.38, kind: 'cracks', color: 0xff4420, alt: 0xff8a40, alpha: 0.8 },
      { parallax: 0.62, kind: 'embers', color: 0xff7a40, alt: 0xffb070, alpha: 0.55 },
    ],
  },
  {
    id: 'astral_temple',
    name: 'Astral Temple',
    description: 'Floating sanctum of blue and violet light, ringed by drifting glyphs.',
    floorY: 600, leftBound: 60, rightBound: 1220,
    skyTop: 0x080a22, skyBottom: 0x141a44, accent: 0x7fb0ff, floorColor: 0x161c38,
    particle: { color: 0xa0c8ff, count: 48, speed: 18, kind: 'mote' },
    layers: [
      { parallax: 0.05, kind: 'sky', color: 0x0b0f2a, alt: 0x060818, alpha: 1 },
      { parallax: 0.2, kind: 'arches', color: 0x1a2250, alt: 0x2a3470, alpha: 0.9 },
      { parallax: 0.44, kind: 'runes', color: 0x7f9fff, alt: 0xb08aff, alpha: 0.6 },
      { parallax: 0.68, kind: 'motes', color: 0xa0c0ff, alt: 0xd0d8ff, alpha: 0.5 },
    ],
  },
  {
    id: 'frozen_summit',
    name: 'Frozen Summit',
    description: 'A windswept peak of black ice above a sea of clouds.',
    floorY: 600, leftBound: 60, rightBound: 1220,
    skyTop: 0x071320, skyBottom: 0x12324a, accent: 0x9fe8ff, floorColor: 0x152a3a,
    particle: { color: 0xd8f4ff, count: 70, speed: 30, kind: 'snow' },
    layers: [
      { parallax: 0.05, kind: 'sky', color: 0x0a1c2e, alt: 0x05101c, alpha: 1 },
      { parallax: 0.18, kind: 'mountains', color: 0x0e2234, alt: 0x1a3c56, alpha: 0.95 },
      { parallax: 0.4, kind: 'pillars', color: 0x16304a, alt: 0x24506e, alpha: 0.8 },
      { parallax: 0.66, kind: 'fog', color: 0x1a3a52, alt: 0x2a5a7a, alpha: 0.45 },
    ],
  },
];

export const ARENA_BY_ID: Record<string, ArenaDef> = Object.fromEntries(ARENAS.map((a) => [a.id, a]));
export function getArena(id: string): ArenaDef {
  return ARENA_BY_ID[id] ?? ARENAS[0];
}
