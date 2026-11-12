// Pure collision helpers: boxes and cylinders with a spatial hash. No Three.js dependency.
export interface BoxCollider { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number; top: number }
export interface CircleCollider { kind: 'circle'; x: number; z: number; r: number; top: number }
export type Collider = BoxCollider | CircleCollider;

const CELL = 16;
export class ColliderWorld {
  private grid = new Map<number, Collider[]>();
  all: Collider[] = [];
  private key(cx: number, cz: number) { return (cx + 512) * 1024 + (cz + 512); }
  add(c: Collider) {
    this.all.push(c);
    const [x0, x1, z0, z1] = c.kind === 'box' ? [c.minX, c.maxX, c.minZ, c.maxZ] : [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r];
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const k = this.key(cx, cz); const l = this.grid.get(k);
        if (l) l.push(c); else this.grid.set(k, [c]);
      }
  }
  box(x: number, z: number, w: number, d: number, top: number) {
    this.add({ kind: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top });
  }
  circle(x: number, z: number, r: number, top: number) { this.add({ kind: 'circle', x, z, r, top }); }
  near(x: number, z: number, r: number): Collider[] {
    const out: Collider[] = [];
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const l = this.grid.get(this.key(cx, cz));
        if (l) for (const c of l) if (!out.includes(c)) out.push(c);
      }
    return out;
  }
}

export const STEP_HEIGHT = 0.6;

/** Push a circle (x,z,radius) out of colliders that rise above footY + step. Returns corrected x/z. */
export function resolveHorizontal(world: ColliderWorld, x: number, z: number, radius: number, footY: number, out: { x: number; z: number; hit: boolean }) {
  out.x = x; out.z = z; out.hit = false;
  const list = world.near(x, z, radius + 1);
  for (let iter = 0; iter < 2; iter++) {
    for (const c of list) {
      if (c.top <= footY + STEP_HEIGHT) continue;
      if (c.kind === 'circle') {
        const dx = out.x - c.x, dz = out.z - c.z; const min = c.r + radius; const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.0001; out.x = c.x + (dx / d) * min; out.z = c.z + (dz / d) * min; out.hit = true;
        }
      } else {
        const cx = Math.max(c.minX, Math.min(out.x, c.maxX)); const cz = Math.max(c.minZ, Math.min(out.z, c.maxZ));
        const dx = out.x - cx, dz = out.z - cz; const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          out.hit = true;
          if (d2 > 1e-8) { const d = Math.sqrt(d2); out.x = cx + (dx / d) * radius; out.z = cz + (dz / d) * radius; }
          else {
            // centre is inside the box: push out through the nearest face
            const l = out.x - c.minX, r = c.maxX - out.x, t = out.z - c.minZ, b = c.maxZ - out.z;
            const m = Math.min(l, r, t, b);
            if (m === l) out.x = c.minX - radius; else if (m === r) out.x = c.maxX + radius;
            else if (m === t) out.z = c.minZ - radius; else out.z = c.maxZ + radius;
          }
        }
      }
    }
  }
}

/** Highest walkable surface under (x,z) that is not above footY + step. Terrain is flat at y=0. */
export function groundHeight(world: ColliderWorld, x: number, z: number, footY: number, radius = 0.35): number {
  let h = 0;
  for (const c of world.near(x, z, radius + 0.5)) {
    if (c.top > footY + STEP_HEIGHT) continue;
    if (c.top <= h) continue;
    if (c.kind === 'circle') { if (Math.hypot(x - c.x, z - c.z) <= c.r + radius * 0.6) h = c.top; }
    else if (x >= c.minX - radius * 0.6 && x <= c.maxX + radius * 0.6 && z >= c.minZ - radius * 0.6 && z <= c.maxZ + radius * 0.6) h = c.top;
  }
  return h;
}

export function segmentHitsWall(world: ColliderWorld, x0: number, z0: number, x1: number, z1: number, y: number): boolean {
  const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.5);
  for (let i = 1; i < steps; i++) {
    const t = i / steps; const x = x0 + (x1 - x0) * t; const z = z0 + (z1 - z0) * t;
    for (const c of world.near(x, z, 0.5)) {
      if (c.top <= y) continue;
      if (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r : x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    }
  }
  return false;
}
