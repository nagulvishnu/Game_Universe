import type { EnvId, Vec2 } from '../engine/types';

export interface Obstacle { x: number; z: number; r: number }
export interface EnvData {
  id: EnvId; name: string; interior: boolean; bounds: number; cam: { r: number; h: number };
  marks: Record<string, Vec2>; obstacles: Obstacle[];
  /** props that may be destroyed by area attacks */
  destructibles: { id: string; x: number; z: number; r: number }[];
}

function marks(z: number, extra: Record<string, Vec2>, inn: Vec2, out: Vec2, spread = 1): Record<string, Vec2> {
  return {
    c: [0, z], l1: [-2.2 * spread, z], r1: [2.2 * spread, z], l2: [-4 * spread, z + 1.8], r2: [4 * spread, z + 1.8],
    f1: [0, z - 3.6], n1: [0, z + 3.6], fl: [-3 * spread, z - 3], fr: [3 * spread, z - 3],
    in: inn, out, ...extra,
  };
}

const ring = (n: number, rad: number, r: number, id: string, a0 = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    return { id: `${id}${i}`, x: Math.sin(a) * rad, z: Math.cos(a) * rad, r };
  });

const citadelPillars = [-10, -3, 4].flatMap((z, i) => [
  { id: `cp${i}l`, x: -9, z, r: 0.9 },
  { id: `cp${i}r`, x: 9, z, r: 0.9 },
]);
const templeStones = ring(8, 14, 1.0, 'ms', 0.4);

export const ENVS: Record<EnvId, EnvData> = {
  village: {
    id: 'village', name: "Hollow's End", interior: false, bounds: 27, cam: { r: 15, h: 7 },
    marks: marks(2, { well: [4.5, -1.2], door: [-10, -4.2], square: [0, 0], grave: [0, -3.4] }, [-22, 12], [22, 12]),
    obstacles: [
      { x: -10, z: -8, r: 3.4 }, { x: 9, z: -9, r: 3.4 }, { x: -13, z: 6, r: 3.4 }, { x: 13, z: 5, r: 3.4 },
      { x: 2, z: -17, r: 3.4 }, { x: -5, z: -17, r: 3.4 }, { x: 7, z: -3.2, r: 1.2 }, { x: -9, z: 6, r: 1.3 },
    ],
    destructibles: [],
  },
  observatory: {
    id: 'observatory', name: 'Hollow\'s End Observatory', interior: true, bounds: 11.5, cam: { r: 9, h: 5 },
    marks: marks(3.5, { scope: [0, -0.8], table: [-5, -0.5], door: [0, 9], square: [0, 3.5] }, [0, 10.4], [0, 10.4]),
    obstacles: [{ x: 0, z: -4.2, r: 1.8 }, { x: -7, z: -3.4, r: 1.9 }, { x: 7, z: -3.2, r: 1.5 }],
    destructibles: [],
  },
  caverns: {
    id: 'caverns', name: 'Crystal Caverns', interior: true, bounds: 16, cam: { r: 12, h: 5.5 },
    marks: marks(3, { altar: [0, -3.8], pool: [0, -9] }, [-8, 13], [8, 13]),
    obstacles: [{ x: -9, z: -3, r: 1.6 }, { x: 9, z: -6, r: 1.6 }, { x: 0, z: -10, r: 4 }, { x: 0, z: -6.4, r: 1.1 }],
    destructibles: [{ id: 'cv0', x: -9, z: -3, r: 1.6 }, { id: 'cv1', x: 9, z: -6, r: 1.6 }, { id: 'cv2', x: -10, z: 7, r: 1.4 }],
  },
  citadel: {
    id: 'citadel', name: 'Sky Citadel', interior: false, bounds: 23, cam: { r: 15, h: 8 },
    marks: marks(2, { throne: [0, -12], dais: [0, -9], gate: [0, 18] }, [0, 21], [0, 21], 1.2),
    obstacles: citadelPillars.map((p) => ({ x: p.x, z: p.z, r: p.r + 0.2 })).concat([{ x: 0, z: -14.6, r: 1.4 }]),
    destructibles: citadelPillars,
  },
  temple: {
    id: 'temple', name: 'Eclipse Temple', interior: false, bounds: 17, cam: { r: 13, h: 7 },
    marks: marks(3.5, { altar: [0, -5], stairs: [0, 11] }, [0, 15.4], [0, 15.4], 1.1),
    obstacles: templeStones.map((p) => ({ x: p.x, z: p.z, r: p.r + 0.2 })).concat([{ x: 0, z: -7.4, r: 1.6 }]),
    destructibles: templeStones,
  },
  road: {
    id: 'road', name: 'The Ash Road', interior: false, bounds: 27, cam: { r: 14, h: 6 },
    marks: marks(3, { fire: [0, 0], l1: [-1.9, 1.15], r1: [1.9, 1.15], f1: [0, -2.7] }, [-17, 5], [17, 5]),
    obstacles: [{ x: 0, z: 0, r: 0.9 }, { x: -9, z: -6, r: 1.6 }, { x: 11, z: -3, r: 2 }],
    destructibles: [],
  },
};

export function markPos(env: EnvData, name: string): Vec2 | undefined {
  return env.marks[name];
}
