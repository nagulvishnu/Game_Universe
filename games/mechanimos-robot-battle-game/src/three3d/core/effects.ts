// Phase 9.6 — deterministic, testable effect scheduling for the 3D shell.
//
// Pure logic only: no Three.js, no DOM, no timers. App3D turns the values here
// into particles and glow. This split mirrors the rest of `core/` (vehicle.ts,
// camera.ts, transform.ts) so the interesting rules are unit tested in Node
// while the renderer stays a thin consumer.
//
// The effect layer is strictly ADDITIVE and read-only with respect to gameplay:
// it never changes transformation duration, stage progression, or driving rules.

/** Progress boundaries at which a transformation stage begins (matches stageFor). */
export const STAGE_THRESHOLDS = [0.12, 0.35, 0.55, 0.68, 0.78, 0.88] as const;

/** The landing/foot-plant window, expressed in normalised progress. */
export const LANDING_START = 0.9;
export const LANDING_END = 1.0;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Index (0..STAGE_THRESHOLDS.length) of the transformation stage at `t`.
 * 0 means "before the first internal stage" and the last index means "past the
 * final internal stage". Monotonic in `t`, so stage crossings are well defined.
 */
export function stageIndexAt(t: number): number {
  const v = clamp01(t);
  let i = 0;
  while (i < STAGE_THRESHOLDS.length && v >= STAGE_THRESHOLDS[i]) i++;
  return i;
}

/**
 * Stage indices crossed moving from progress `prev` to `next`, in the order the
 * timeline passed through them. Empty when the stage index did not change.
 * The result is what the renderer converts into one-shot bursts, so a single
 * frame that spans several stages still reports each crossing exactly once.
 */
export function crossedStageIndices(prev: number, next: number): number[] {
  const a = stageIndexAt(prev);
  const b = stageIndexAt(next);
  const out: number[] = [];
  if (b > a) {
    for (let i = a + 1; i <= b; i++) out.push(i);
  } else if (b < a) {
    for (let i = a; i > b; i--) out.push(i);
  }
  return out;
}

export interface EffectFrame {
  /** True while any transformation effect should be visible. */
  active: boolean;
  /** 0..1 ramp across the foot-plant window; 0 outside it. */
  landing: number;
  /** 0..1 continuous spark intensity (only non-zero mid-transformation). */
  sparks: number;
  /** 0..1 continuous dust intensity (only non-zero while driving). */
  dust: number;
}

/**
 * Fill `out` in place for `progress`. Reusing a caller-owned object keeps the
 * per-frame path allocation free; changes to the same values are what the tests
 * assert against `effectFrame` below.
 */
export function writeEffectFrame(
  out: EffectFrame,
  progress: number,
  transforming: boolean,
  speed = 0,
): EffectFrame {
  const t = clamp01(progress);
  out.active = transforming || (t > 0.001 && t < 0.999);

  // Sparks peak in the middle of the transformation and fall to zero at both
  // settled ends, so a parked car or standing robot emits none.
  out.sparks = transforming ? Math.sin(Math.PI * t) : 0;

  // Landing ramp replicates the existing ring window: strictly inside
  // (LANDING_START, LANDING_END), linear, 0 at both ends.
  const landU = (t - LANDING_START) / (LANDING_END - LANDING_START);
  out.landing = landU > 0 && landU < 1 ? landU : 0;

  // Rolling dust only while grounded and driving (never mid-transformation).
  const sp = Number.isFinite(speed) ? Math.abs(speed) : 0;
  out.dust = transforming ? 0 : clamp01((sp - 3) / 15);

  return out;
}

/** Convenience wrapper for tests and one-off callers (allocates one object). */
export function effectFrame(progress: number, transforming: boolean, speed = 0): EffectFrame {
  return writeEffectFrame({ active: false, landing: 0, sparks: 0, dust: 0 }, progress, transforming, speed);
}

/** Particles per second from a 0..1 spark intensity. */
export function sparkRate(sparks: number): number {
  return clamp01(sparks) * 120;
}

/** Particles per second from a 0..1 dust intensity. */
export function dustRate(dust: number): number {
  return clamp01(dust) * 45;
}

/**
 * mulberry32: tiny, fast, deterministic PRNG. Used to seed particle scatter so
 * a given seed always produces the same burst (keeps effects reproducible and
 * removes Math.random from the testable path).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
