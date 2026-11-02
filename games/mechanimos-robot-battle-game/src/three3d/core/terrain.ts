// Phase 9.4 — deterministic procedural terrain height.
//
// Pure maths, no Three.js, no DOM. The same height function drives both the
// displaced ground mesh (App3D.buildGround) and the vehicle's Y placement
// (App3D.applyVehicleToRig), so visual ground and vehicle grounding never
// diverge. Heights are bounded and symmetric around Y=0.

export const TERRAIN_HEIGHT_SCALE = 0.35;

/**
 * Sample the deterministic terrain height at world X/Z.
 * Pure function of (x, z) — same inputs always give the same output.
 */
export function terrainHeight(x: number, z: number): number {
  const h =
    Math.sin(x * 0.05) * 0.6 +
    Math.cos(z * 0.07) * 0.5 +
    Math.sin((x + z) * 0.03) * 0.4;
  return h * TERRAIN_HEIGHT_SCALE;
}

/** Theoretical maximum terrain height (positive). */
export function terrainMaxHeight(): number {
  return (0.6 + 0.5 + 0.4) * TERRAIN_HEIGHT_SCALE; // 0.525
}

/** Theoretical minimum terrain height (negative). */
export function terrainMinHeight(): number {
  return -(0.6 + 0.5 + 0.4) * TERRAIN_HEIGHT_SCALE; // -0.525
}
