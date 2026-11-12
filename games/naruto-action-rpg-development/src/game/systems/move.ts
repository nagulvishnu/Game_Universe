import type { Vec3 } from '../types';
import { rt } from '../runtime';
import { resolveHorizontal, groundHeight } from '../logic/collision';
import { WORLD } from '../config';

const tmp = { x: 0, z: 0, hit: false };
/** Move an entity horizontally with wall/obstacle collision and world bounds. Returns true when blocked. */
export function moveXZ(pos: Vec3, dx: number, dz: number, radius = 0.45): boolean {
  resolveHorizontal(rt.colliders, pos.x + dx, pos.z + dz, radius, pos.y, tmp);
  pos.x = Math.min(WORLD.maxX, Math.max(WORLD.minX, tmp.x));
  pos.z = Math.min(WORLD.maxZ, Math.max(WORLD.minZ, tmp.z));
  return tmp.hit;
}
/** Keep a walking entity on the surface beneath it. */
export function snapGround(pos: Vec3, radius = 0.3) { pos.y = groundHeight(rt.colliders, pos.x, pos.z, pos.y + 0.3, radius); }
