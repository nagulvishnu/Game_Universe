// Phase 9.1 — unit tests for the pure quality + telemetry logic behind the 3D shell.
// No framework: plain asserts, esbuild-bundled then run by Node, matching the
// existing tests/ convention.
import assert from 'node:assert';

import {
  QUALITY_LEVELS,
  QUALITY_PRESETS,
  getPreset,
  isQualityLevel,
  nextQuality,
  qualityLabel,
  resolvePixelRatio,
} from '../src/three3d/core/quality';
import {
  DEFAULT_CAPACITY,
  FrameTimeMonitor,
  buildSnapshot,
  percentile,
} from '../src/three3d/core/telemetry';

// ---- 1. preset shape / both levels exist ----
assert.deepStrictEqual([...QUALITY_LEVELS], ['high', 'low'], 'exactly two quality levels');
for (const level of QUALITY_LEVELS) {
  const p = QUALITY_PRESETS[level];
  assert.strictEqual(p.level, level, `${level} preset reports its own level`);
  assert.ok(p.maxPixelRatio >= 1, `${level} pixel ratio cap must be >= 1`);
  assert.ok(Number.isInteger(p.shadowMapSize) && p.shadowMapSize > 0, `${level} shadow map size valid`);
  assert.ok(p.environmentIntensity >= 0, `${level} environment intensity non-negative`);
}

// ---- 2. LOW is genuinely cheaper than HIGH ----
const high = QUALITY_PRESETS.high;
const low = QUALITY_PRESETS.low;
assert.ok(low.maxPixelRatio <= high.maxPixelRatio, 'LOW must not raise the pixel ratio cap');
assert.ok(!low.shadows && high.shadows, 'LOW disables shadows, HIGH enables them');
assert.ok(!low.antialias && high.antialias, 'LOW disables antialiasing, HIGH enables it');

// ---- 3. type guard + fallback on unknown input ----
assert.ok(isQualityLevel('high') && isQualityLevel('low'), 'valid levels accepted');
assert.ok(!isQualityLevel('ultra'), 'unknown level rejected');
assert.ok(!isQualityLevel(null) && !isQualityLevel(undefined) && !isQualityLevel(3), 'non-levels rejected');
assert.strictEqual(getPreset('low').level, 'low', 'known level resolves');
assert.strictEqual(getPreset('ultra' as never).level, 'high', 'unknown level falls back to HIGH, never throws');

// ---- 4. pixel ratio is always clamped to a usable range ----
assert.strictEqual(resolvePixelRatio('high', 3), 1.75, 'DPR capped at HIGH cap');
assert.strictEqual(resolvePixelRatio('low', 3), 1, 'DPR capped at LOW cap');
assert.strictEqual(resolvePixelRatio('high', 1), 1, 'DPR 1 passes through');
assert.strictEqual(resolvePixelRatio('high', 0.5), 1, 'DPR never drops below 1');
assert.strictEqual(resolvePixelRatio('high', undefined), 1, 'missing DPR falls back to 1');
assert.strictEqual(resolvePixelRatio('high', Number.NaN), 1, 'NaN DPR falls back to 1');
// Non-finite DPR is treated as *unknown*, not as "huge": the conservative
// fallback is 1, which is cheaper than the cap. Over-rendering on garbage
// input is the failure mode we are avoiding.
assert.strictEqual(resolvePixelRatio('high', Number.POSITIVE_INFINITY), 1, 'infinite DPR falls back to 1, not the cap');
for (const bad of [0, -2, Number.NaN, Infinity]) {
  const r = resolvePixelRatio('low', bad);
  assert.ok(r >= 1 && r <= QUALITY_PRESETS.low.maxPixelRatio, `invalid DPR ${bad} yields a safe ratio`);
}

// ---- 5. quality toggling ----
assert.strictEqual(nextQuality('high'), 'low', 'HIGH toggles to LOW');
assert.strictEqual(nextQuality('low'), 'high', 'LOW toggles to HIGH');
assert.strictEqual(qualityLabel('high'), 'HIGH', 'label uppercases');
assert.strictEqual(qualityLabel('low'), 'LOW', 'label uppercases');

// ---- 6. percentile maths ----
assert.strictEqual(percentile([], 0.95), 0, 'empty input -> 0');
assert.strictEqual(percentile([42], 0.95), 42, 'single sample');
assert.strictEqual(percentile([1, 2, 3, 4], 0), 1, 'p0 is the minimum');
assert.strictEqual(percentile([1, 2, 3, 4], 1), 4, 'p100 is the maximum');
assert.strictEqual(percentile([1, 2, 3, 4], 0.5), 2.5, 'p50 interpolates the middle');
assert.strictEqual(percentile([10, 20], 0.5), 15, 'two samples interpolate');
assert.strictEqual(percentile([1, 2, 3], -5), 1, 'p below range clamps to 0');
assert.strictEqual(percentile([1, 2, 3], 5), 3, 'p above range clamps to 1');

// ---- 7. monitor: empty state ----
const m0 = new FrameTimeMonitor();
assert.strictEqual(m0.sampleCount, 0, 'fresh monitor is empty');
assert.strictEqual(m0.averageMs, 0, 'fresh monitor average is 0');
assert.strictEqual(m0.p95Ms, 0, 'fresh monitor p95 is 0');
assert.strictEqual(m0.maxMs, 0, 'fresh monitor max is 0');
assert.strictEqual(m0.fps, 0, 'fresh monitor fps is 0 (no division by zero)');

// ---- 8. monitor: averages, fps and sample filtering ----
const m1 = new FrameTimeMonitor();
for (let i = 0; i < 10; i++) m1.push(20);
assert.strictEqual(m1.sampleCount, 10, '10 samples recorded');
assert.strictEqual(m1.averageMs, 20, 'average of identical samples');
assert.strictEqual(m1.fps, 50, '1000 / 20ms = 50 fps');
assert.strictEqual(m1.maxMs, 20, 'max equals the only value');

const m2 = new FrameTimeMonitor();
m2.push(10);
m2.push(30);
assert.strictEqual(m2.averageMs, 20, 'mixed samples average correctly');
assert.strictEqual(m2.fps, 50, 'fps derived from average');

const m3 = new FrameTimeMonitor();
m3.push(0);
m3.push(Number.NaN);
m3.push(Number.POSITIVE_INFINITY);
m3.push(-5);
assert.strictEqual(m3.sampleCount, 0, 'non-finite and non-positive samples are rejected');
m3.push(16);
assert.strictEqual(m3.sampleCount, 1, 'a valid sample still lands');
m3.push(5000);
assert.strictEqual(m3.maxMs, 1000, 'absurd frame time is clamped to the 1s ceiling');

// ---- 9. monitor: ring buffer wraps and keeps a bounded window ----
const m4 = new FrameTimeMonitor(8);
for (let i = 0; i < 30; i++) m4.push(16.7);
assert.strictEqual(m4.sampleCount, 8, 'sample count is capped at capacity');
assert.ok(Math.abs(m4.averageMs - 16.7) < 0.001, 'wrapped window still averages the recent samples');
assert.ok(Math.abs(m4.p95Ms - 16.7) < 0.001, 'p95 tracks the wrapped window');

// ---- 10. reset clears state ----
const m5 = new FrameTimeMonitor();
m5.push(20);
m5.reset();
assert.strictEqual(m5.sampleCount, 0, 'reset empties the monitor');
assert.strictEqual(m5.averageMs, 0, 'reset clears the average');

// ---- 11. capacity is validated ----
assert.ok(new FrameTimeMonitor(0).capacity >= 8, 'tiny capacity is clamped up');
assert.ok(new FrameTimeMonitor(Number.NaN).capacity === DEFAULT_CAPACITY, 'NaN capacity falls back to default');
assert.strictEqual(new FrameTimeMonitor(16).capacity, 16, 'explicit capacity honoured');

// ---- 12. p95 is a real upper-tail measure, not the mean ----
// 90 fast + 10 slow frames out of 100: p95 (position 94.05) lands in the tail.
const m6 = new FrameTimeMonitor(100);
for (let i = 0; i < 90; i++) m6.push(16);
for (let i = 0; i < 10; i++) m6.push(80);
assert.ok(m6.averageMs < 25, `average stays low despite spikes (got ${m6.averageMs})`);
assert.ok(m6.p95Ms > 30, `p95 must reflect the slow tail (got ${m6.p95Ms})`);
assert.strictEqual(m6.maxMs, 80, 'max reports the worst frame');

// ---- 12b. p95 definition is pinned: with exactly 5% slow frames, position
// 94.05 falls BETWEEN the last fast and first slow sample, so it interpolates.
// This guards against a future "fix" that silently changes nearest-rank to
// interpolated semantics (or vice versa).
const m6b = new FrameTimeMonitor(100);
for (let i = 0; i < 95; i++) m6b.push(16);
for (let i = 0; i < 5; i++) m6b.push(80);
assert.ok(
  Math.abs(m6b.p95Ms - 19.2) < 0.001,
  `p95 boundary interpolation is 19.2ms (got ${m6b.p95Ms})`,
);

// ---- 13. snapshot assembly carries render counters through ----
const m7 = new FrameTimeMonitor();
m7.push(16);
const snap = buildSnapshot(m7, { drawCalls: 12, triangles: 3456 }, {
  quality: 'HIGH', shadows: true, pixelRatio: 1.5, canvasWidth: 1280, canvasHeight: 720,
});
assert.strictEqual(snap.quality, 'HIGH', 'snapshot carries quality label');
assert.strictEqual(snap.shadows, true, 'snapshot carries shadow state');
assert.strictEqual(snap.drawCalls, 12, 'snapshot carries draw calls');
assert.strictEqual(snap.triangles, 3456, 'snapshot carries triangles');
assert.strictEqual(snap.canvasWidth, 1280, 'snapshot carries canvas width');
assert.ok(snap.fps > 0 && snap.samples === 1, 'snapshot carries monitor stats');

console.log('PASS quality/telemetry tests: 13/13 groups');