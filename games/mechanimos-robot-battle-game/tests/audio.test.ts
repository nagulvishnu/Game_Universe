// Phase 9.6 — unit tests for the pure procedural-audio maths.
// No AudioContext is created: audio.ts deliberately keeps cue synthesis and
// tone mapping free of WebAudio so they can be verified in Node.
import assert from 'node:assert';

import {
  TO_CAR_CUE_SECONDS,
  TO_ROBOT_CUE_SECONDS,
  clampVolume,
  cueSpanSeconds,
  engineFrequency,
  engineGain,
  landingCues,
  transformCues,
} from '../src/three3d/core/audio';

const WAVES = new Set(['sine', 'square', 'sawtooth', 'triangle']);

// ================= 1. transform cues fit the transformation timeline ========
const toRobot = transformCues('toRobot');
const toCar = transformCues('toCar');
assert.ok(toRobot.length > 0, 'toRobot has cues');
assert.ok(toCar.length > 0, 'toCar has cues');
assert.ok(
  cueSpanSeconds(toRobot) <= TO_ROBOT_CUE_SECONDS + 1e-9,
  `toRobot cues end within the deploy duration (${cueSpanSeconds(toRobot)} <= ${TO_ROBOT_CUE_SECONDS})`,
);
assert.ok(
  cueSpanSeconds(toCar) <= TO_CAR_CUE_SECONDS + 1e-9,
  `toCar cues end within the fold duration (${cueSpanSeconds(toCar)} <= ${TO_CAR_CUE_SECONDS})`,
);

// ================= 2. every cue is well formed ==============================
for (const cue of [...toRobot, ...toCar, ...landingCues()]) {
  assert.ok(WAVES.has(cue.wave), `wave is one of the known shapes (${cue.wave})`);
  assert.ok(cue.freq > 0, 'frequency is positive');
  if (cue.freqTo !== undefined) assert.ok(cue.freqTo > 0, 'sweep target is positive');
  assert.ok(cue.dur > 0, 'duration is positive');
  assert.ok(cue.vol > 0 && cue.vol <= 1, `volume in (0,1] (${cue.vol})`);
  assert.ok(cue.at >= 0, 'start offset is non-negative');
}

// ================= 3. direction reads correctly =============================
assert.ok((toRobot[0].freqTo ?? 0) > toRobot[0].freq, 'deploy opens with a rising servo sweep');
assert.ok((toCar[0].freqTo ?? 999) < toCar[0].freq, 'fold opens with a falling servo sweep');

// ================= 4. determinism ===========================================
assert.deepStrictEqual(transformCues('toRobot'), toRobot, 'cues are deterministic for a given direction');
assert.deepStrictEqual(landingCues(), landingCues(), 'landing cues are deterministic');

// ================= 5. landing cue ===========================================
const landing = landingCues();
assert.ok(landing.some((c) => c.freq < 80), 'landing has a low thud');
assert.ok(cueSpanSeconds(landing) <= 0.5, 'landing is a short impact');
assert.strictEqual(cueSpanSeconds([]), 0, 'empty cue list spans zero seconds');

// ================= 6. engineFrequency =======================================
assert.strictEqual(engineFrequency(0), 55, 'idle rumble is 55 Hz');
assert.strictEqual(engineFrequency(18), 190, 'full-speed whine is 190 Hz');
assert.strictEqual(engineFrequency(1000), 190, 'pitch clamps above max speed');
assert.strictEqual(engineFrequency(-5), engineFrequency(5), 'reverse revs at the same pitch as forward');
assert.strictEqual(engineFrequency(Number.NaN), 55, 'non-finite speed is idle');
let freqMonotonic = true;
let prevFreq = -1;
for (let s = 0; s <= 25; s += 0.5) {
  const f = engineFrequency(s);
  if (f < prevFreq) freqMonotonic = false;
  prevFreq = f;
}
assert.ok(freqMonotonic, 'pitch never falls as speed rises');

// ================= 7. engineGain ============================================
assert.strictEqual(engineGain(18, 1, true), 0, 'muted engine is silent at full speed');
assert.strictEqual(engineGain(0, 1, false), 0, 'engine is silent at rest');
assert.strictEqual(engineGain(Number.NaN, 1, false), 0, 'non-finite speed is silent');
assert.ok(Math.abs(engineGain(18, 1, false) - 0.18) < 1e-9, 'full-speed gain is 0.18 at full volume');
assert.ok(Math.abs(engineGain(18, 0.5, false) - 0.09) < 1e-9, 'gain scales with volume');
assert.ok(engineGain(9, 1, false) < engineGain(18, 1, false), 'gain rises with speed');
assert.strictEqual(engineGain(18, 2, false), engineGain(18, 1, false), 'volume above 1 clamps');

// ================= 8. clampVolume ===========================================
assert.strictEqual(clampVolume(-1), 0, 'negative volume clamps to 0');
assert.strictEqual(clampVolume(2), 1, 'volume above 1 clamps to 1');
assert.strictEqual(clampVolume(0.25), 0.25, 'in-range volume passes through');
assert.strictEqual(clampVolume(Number.NaN), 0.6, 'non-finite volume falls back to the default');

console.log('PASS audio tests: 8/8 groups');
