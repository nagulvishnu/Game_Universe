// Phase 9.6 — unit tests for the pure effect-scheduling logic.
// Plain node:assert, bundled by esbuild, matching the existing tests/ convention.
// No Three.js or DOM is required: effects.ts is deliberately pure.
import assert from 'node:assert';

import {
  LANDING_END,
  LANDING_START,
  STAGE_THRESHOLDS,
  crossedStageIndices,
  dustRate,
  effectFrame,
  mulberry32,
  sparkRate,
  stageIndexAt,
  writeEffectFrame,
  type EffectFrame,
} from '../src/three3d/core/effects';

// ================= 1. stageIndexAt: boundaries =================
assert.strictEqual(stageIndexAt(0), 0, 't=0 is before the first stage');
assert.strictEqual(stageIndexAt(0.11), 0, 't just below 0.12 is stage 0');
assert.strictEqual(stageIndexAt(0.12), 1, 't=0.12 enters stage 1');
assert.strictEqual(stageIndexAt(0.34), 1, 't just below 0.35 is stage 1');
assert.strictEqual(stageIndexAt(0.35), 2, 't=0.35 enters stage 2');
assert.strictEqual(stageIndexAt(0.55), 3, 't=0.55 enters stage 3');
assert.strictEqual(stageIndexAt(0.68), 4, 't=0.68 enters stage 4');
assert.strictEqual(stageIndexAt(0.78), 5, 't=0.78 enters stage 5');
assert.strictEqual(stageIndexAt(0.88), 6, 't=0.88 enters stage 6');
assert.strictEqual(stageIndexAt(1), 6, 't=1 stays in stage 6');

// ================= 2. stageIndexAt: clamps and monotonicity =================
assert.strictEqual(stageIndexAt(-5), 0, 'negative progress clamps to stage 0');
assert.strictEqual(stageIndexAt(5), STAGE_THRESHOLDS.length, 'progress > 1 clamps to last index');
let monotonic = true;
let prevIdx = -1;
for (let t = 0; t <= 1.0001; t += 0.001) {
  const idx = stageIndexAt(t);
  if (idx < prevIdx) monotonic = false;
  prevIdx = idx;
}
assert.ok(monotonic, 'stage index never decreases as progress increases');

// ================= 3. crossedStageIndices: forward =================
assert.deepStrictEqual(crossedStageIndices(0, 1), [1, 2, 3, 4, 5, 6], 'full deploy crosses every stage in order');
assert.deepStrictEqual(crossedStageIndices(0, 0.5), [1, 2], 'partial hop crosses only the stages entered');
assert.deepStrictEqual(crossedStageIndices(0.11, 0.13), [1], 'a single boundary crossing fires once');
assert.deepStrictEqual(crossedStageIndices(0.2, 0.3), [], 'moving inside one stage fires nothing');

// ================= 4. crossedStageIndices: reverse =================
assert.deepStrictEqual(crossedStageIndices(1, 0), [6, 5, 4, 3, 2, 1], 'full fold crosses every stage in reverse order');
assert.deepStrictEqual(crossedStageIndices(0.9, 0.4), [6, 5, 4, 3], 'partial fold reports stages in reverse order');
assert.deepStrictEqual(crossedStageIndices(0.5, 0.5), [], 'no movement fires nothing');

// ================= 5. effectFrame: settled ends emit nothing =================
const car = effectFrame(0, false, 0);
assert.strictEqual(car.active, false, 'parked car is not active');
assert.strictEqual(car.sparks, 0, 'parked car emits no sparks');
assert.strictEqual(car.dust, 0, 'parked car emits no dust');
assert.strictEqual(car.landing, 0, 'parked car has no landing');

const robot = effectFrame(1, false, 0);
assert.strictEqual(robot.active, false, 'idle robot is not active');
assert.strictEqual(robot.sparks, 0, 'idle robot emits no sparks');
assert.strictEqual(robot.landing, 0, 'landing ramp is zero at t=1');

// ================= 6. effectFrame: mid-transformation =================
const mid = effectFrame(0.5, true, 0);
assert.strictEqual(mid.active, true, 'mid-transformation is active');
assert.ok(Math.abs(mid.sparks - 1) < 1e-9, `sparks peak at the midpoint (got ${mid.sparks})`);
assert.strictEqual(mid.dust, 0, 'no rolling dust while transforming');
assert.strictEqual(mid.landing, 0, 'no landing before the window');

// ================= 7. effectFrame: landing window =================
const landing = effectFrame(0.95, true, 0);
assert.ok(Math.abs(landing.landing - 0.5) < 1e-9, `landing ramp is midway at t=0.95 (got ${landing.landing})`);
assert.strictEqual(effectFrame(LANDING_START, true, 0).landing, 0, 'landing is 0 at the window start');
assert.strictEqual(effectFrame(LANDING_END, true, 0).landing, 0, 'landing is 0 at the window end');

// ================= 8. effectFrame: driving dust from speed =================
assert.strictEqual(effectFrame(0, false, 0).dust, 0, 'stationary car makes no dust');
assert.strictEqual(effectFrame(0, false, 3).dust, 0, 'dust starts above a speed threshold');
const fast = effectFrame(0, false, 40);
assert.strictEqual(fast.dust, 1, 'fast driving saturates dust');
const cruise = effectFrame(0, false, 10.5);
assert.ok(cruise.dust > 0 && cruise.dust < 1, `cruising produces partial dust (got ${cruise.dust})`);
assert.strictEqual(effectFrame(0, false, Number.NaN).dust, 0, 'non-finite speed yields no dust');

// ================= 9. writeEffectFrame: reuses the caller object ============
const scratch: EffectFrame = { active: false, landing: 0, sparks: 0, dust: 0 };
const returned = writeEffectFrame(scratch, 0.5, true, 0);
assert.strictEqual(returned, scratch, 'writeEffectFrame returns the same object (no allocation)');
assert.deepStrictEqual(scratch, effectFrame(0.5, true, 0), 'writeEffectFrame matches the convenience wrapper');

// ================= 10. sparkRate / dustRate =================
assert.strictEqual(sparkRate(0), 0, 'zero spark intensity => zero rate');
assert.strictEqual(sparkRate(1), 120, 'full spark intensity => 120/s');
assert.ok(sparkRate(0.5) > 0 && sparkRate(0.5) < sparkRate(1), 'spark rate is monotonic');
assert.strictEqual(sparkRate(-1), 0, 'negative intensity clamps to 0');
assert.strictEqual(sparkRate(2), 120, 'intensity above 1 clamps to 1');
assert.strictEqual(dustRate(0), 0, 'zero dust intensity => zero rate');
assert.strictEqual(dustRate(1), 45, 'full dust intensity => 45/s');
assert.strictEqual(dustRate(2), 45, 'dust intensity above 1 clamps');

// ================= 11. mulberry32: deterministic and in range ==============
const a1 = mulberry32(12345);
const a2 = mulberry32(12345);
let sameSequence = true;
for (let i = 0; i < 1000; i++) {
  const x = a1();
  const y = a2();
  if (x !== y) sameSequence = false;
  assert.ok(x >= 0 && x < 1, `mulberry32 output in [0,1) (got ${x})`);
}
assert.ok(sameSequence, 'same seed produces the same sequence');

const b1 = mulberry32(1);
const b2 = mulberry32(2);
assert.notStrictEqual(b1(), b2(), 'different seeds diverge immediately');

console.log('PASS effects tests: 11/11 groups');
