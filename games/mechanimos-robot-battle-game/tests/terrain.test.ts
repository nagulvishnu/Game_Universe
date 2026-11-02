// Phase 9.4 — unit tests for the pure terrain height function.
// No framework: plain asserts, esbuild-bundled then run by Node, matching the
// existing tests/ convention. No DOM required.
import assert from 'node:assert';

import { terrainHeight, terrainMaxHeight, terrainMinHeight } from '../src/three3d/core/terrain';

// ================= 1. Determinism: same inputs always give same output =================
assert.strictEqual(terrainHeight(0, 0), terrainHeight(0, 0), 'origin is deterministic');
assert.strictEqual(terrainHeight(12, 4), terrainHeight(12, 4), 'landmark 1 is deterministic');
assert.strictEqual(terrainHeight(-22, 16), terrainHeight(-22, 16), 'landmark 4 is deterministic');
assert.strictEqual(terrainHeight(100, -100), terrainHeight(100, -100), 'far point is deterministic');

// ================= 2. Exact values at known points =================
// terrainHeight(0, 0) = sin(0)*0.6 + cos(0)*0.5 + sin(0)*0.4 = 0 + 0.5 + 0 = 0.5 * 0.35 = 0.175
assert.strictEqual(terrainHeight(0, 0), 0.175, 'origin height is 0.175');

// ================= 3. Height bounds =================
const maxH = terrainMaxHeight();
const minH = terrainMinHeight();
assert.ok(Math.abs(maxH - 0.525) < 1e-9, `max height is ~0.525 (got ${maxH})`);
assert.ok(Math.abs(minH + 0.525) < 1e-9, `min height is ~-0.525 (got ${minH})`);
assert.ok(minH < 0 && maxH > 0, 'terrain straddles Y=0');

// ================= 4. All sampled points within theoretical bounds =================
// Sample across the full driveable range (+/-140 world limit).
for (let x = -140; x <= 140; x += 11) {
  for (let z = -140; z <= 140; z += 11) {
    const h = terrainHeight(x, z);
    assert.ok(h >= minH && h <= maxH, `height ${h} at (${x},${z}) out of bounds [${minH},${maxH}]`);
  }
}

// ================= 5. Height varies across the terrain (not flat) =================
let minSampled = Infinity;
let maxSampled = -Infinity;
for (let x = -140; x <= 140; x += 13) {
  for (let z = -140; z <= 140; z += 13) {
    const h = terrainHeight(x, z);
    if (h < minSampled) minSampled = h;
    if (h > maxSampled) maxSampled = h;
  }
}
assert.ok(maxSampled > minSampled, `terrain has variation (min ${minSampled}, max ${maxSampled})`);

// ================= 6. Landmark positions have valid terrain heights =================
const landmarks = [
  { x: 12, z: 4 },
  { x: -14, z: -6 },
  { x: 20, z: -18 },
  { x: -22, z: 16 },
];
for (const lm of landmarks) {
  const h = terrainHeight(lm.x, lm.z);
  assert.ok(h >= minH && h <= maxH, `landmark at (${lm.x},${lm.z}) height ${h} within bounds`);
}

console.log('PASS terrain tests: 6/6 groups');
