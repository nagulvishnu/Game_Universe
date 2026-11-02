// Phase 9.3 — pure collision / world-boundary helpers (no Three.js, no DOM).
//
// Vehicle footprint is modelled as a circle in the XZ plane. Static obstacles
// are circles too. Resolution pushes the vehicle out along the contact normal
// and clamps to an explicit square boundary, preferring stable stopping over
// bouncing.

export interface Vec2 { x: number; z: number; }

export interface Obstacle {
  /** World-space centre X. */
  x: number;
  /** World-space centre Z. */
  z: number;
  /** Obstacle radius in world units. */
  radius: number;
}

export interface Bounds {
  /** Half-extent of the playable square on each axis. */
  halfExtent: number;
}

export const DEFAULT_VEHICLE_RADIUS = 1.2;

/** Distance between two XZ points. */
export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

/**
 * Push a circle (vehicle) out of a single circular obstacle. Mutates `pos`.
 * Returns true if a correction was applied.
 */
export function resolveCircle(pos: Vec2, obstacle: Obstacle, vehicleRadius: number): boolean {
  const dx = pos.x - obstacle.x;
  const dz = pos.z - obstacle.z;
  const dist = Math.hypot(dx, dz);
  const minDist = vehicleRadius + obstacle.radius;
  if (dist >= minDist) return false;
  if (dist < 1e-9) {
    // Centred on the obstacle: push along +X deterministically.
    pos.x = obstacle.x + minDist;
    return true;
  }
  const scale = minDist / dist;
  pos.x = obstacle.x + dx * scale;
  pos.z = obstacle.z + dz * scale;
  return true;
}

/** Resolve against every obstacle in order; repeat a few passes for overlaps. */
export function resolveObstacles(
  pos: Vec2,
  obstacles: readonly Obstacle[],
  vehicleRadius: number,
  passes = 4,
): boolean {
  let hit = false;
  for (let p = 0; p < passes; p++) {
    let any = false;
    for (const o of obstacles) {
      if (resolveCircle(pos, o, vehicleRadius)) { any = true; hit = true; }
    }
    if (!any) break;
  }
  return hit;
}

/** Clamp a position into the square bounds. Returns true if clamped. */
export function clampToBounds(pos: Vec2, bounds: Bounds): boolean {
  const h = bounds.halfExtent;
  let clamped = false;
  if (pos.x > h) { pos.x = h; clamped = true; }
  if (pos.x < -h) { pos.x = -h; clamped = true; }
  if (pos.z > h) { pos.z = h; clamped = true; }
  if (pos.z < -h) { pos.z = -h; clamped = true; }
  return clamped;
}

/**
 * Move from `from` toward `to` in substeps so small obstacles cannot be
 * tunnelled through. Resolves collisions + bounds at each substep. Returns
 * the resolved position and whether it was blocked.
 */
export function substeppedMove(
  from: Vec2,
  to: Vec2,
  obstacles: readonly Obstacle[],
  bounds: Bounds,
  vehicleRadius: number,
): { pos: Vec2; blocked: boolean } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  // Substep size: never larger than half the smallest obstacle radius (or 0.5).
  let minRadius = Infinity;
  for (const o of obstacles) minRadius = Math.min(minRadius, o.radius);
  if (!isFinite(minRadius)) minRadius = 1;
  const maxStep = Math.max(0.05, Math.min(0.5, (minRadius + vehicleRadius) * 0.25));
  const steps = Math.max(1, Math.ceil(dist / maxStep));
  const pos: Vec2 = { x: from.x, z: from.z };
  let blocked = false;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    pos.x = from.x + dx * t;
    pos.z = from.z + dz * t;
    const beforeX = pos.x, beforeZ = pos.z;
    const hitObs = resolveObstacles(pos, obstacles, vehicleRadius);
    const hitBounds = clampToBounds(pos, bounds);
    if (hitObs || hitBounds) {
      // If corrected, mark blocked; keep corrected position (sliding).
      if (pos.x !== beforeX || pos.z !== beforeZ) blocked = true;
    }
  }
  // Final resolution pass on accumulated position.
  resolveObstacles(pos, obstacles, vehicleRadius);
  clampToBounds(pos, bounds);
  return { pos, blocked };
}
