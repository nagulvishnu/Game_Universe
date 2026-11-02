// Phase 9.5 — pure car<->robot transformation state machine.
//
// Extracted from App3D so the transformation timing and state transitions can
// be unit tested in Node without a WebGL context. This mirrors the existing
// architecture: vehicle.ts, collision.ts and camera.ts hold the pure logic
// while App3D owns the renderer and drives them from the animation loop.
//
// The rig posing itself (mechRig.poseRig) is unchanged; this module only owns
// the deterministic timeline that decides WHERE in the transformation we are.

/** Slow, deliberate car -> robot deploy. */
export const TO_ROBOT_MS = 2400;
/** Slightly faster robot -> car fold. */
export const TO_CAR_MS = 1900;

export const STAGES = [
  '1/7 BRAKE & SETTLE',
  '2/7 WHEELS REPOSITION',
  '3/7 CHASSIS LIFTS',
  '4/7 PANELS -> ARMS',
  '5/7 SECTIONS SEPARATE',
  '6/7 LEGS EXTEND & LOCK',
  '7/7 HEAD RISE / LAND',
];

export interface TransformState {
  /** 0 = car, 1 = robot. */
  t: number;
  stage: string;
  mode: 'car' | 'robot' | 'transforming';
}

/** Human-readable stage label for a normalised transformation progress. */
export function stageFor(t: number): string {
  if (t <= 0.001) return 'CAR MODE';
  if (t >= 0.999) return 'ROBOT MODE';
  if (t < 0.12) return STAGES[0];
  if (t < 0.35) return STAGES[1];
  if (t < 0.55) return STAGES[2];
  if (t < 0.68) return STAGES[3];
  if (t < 0.78) return STAGES[4];
  if (t < 0.88) return STAGES[5];
  return STAGES[6];
}

/**
 * Deterministic transformation timeline.
 *
 * State is intentionally tiny and total: `progress` is always in [0, 1] and a
 * transformation is either idle or running in exactly one direction. There is
 * no invalid intermediate state, and repeated or out-of-order `toggle()` calls
 * during an in-flight transformation are ignored rather than queued or allowed
 * to reverse mid-animation.
 */
export class TransformStateMachine {
  private t = 0;
  private dir: 0 | 1 | -1 = 0;
  private startTime = 0;

  /** Normalised progress: 0 = car, 1 = robot. */
  get progress(): number {
    return this.t;
  }

  /** True while a transformation is in flight. */
  get transforming(): boolean {
    return this.dir !== 0;
  }

  /** True while the rig may be driven (fully settled in car form). */
  get drivable(): boolean {
    return this.dir === 0 && this.t <= 0.001;
  }

  /**
   * Request a transformation from a fresh `now` timestamp (ms). Ignored while a
   * transformation is already running, so spamming the transform control cannot
   * restart, stack or reverse an in-flight animation.
   * Returns true if a new transformation actually started.
   */
  toggle(now: number): boolean {
    if (this.dir !== 0) return false;
    this.dir = this.t >= 0.999 ? -1 : 1;
    this.startTime = now;
    return true;
  }

  /**
   * Advance the timeline to `now` (ms). Returns true only on the step that
   * completes a transformation, so the caller can fire a one-shot notification
   * exactly once rather than on every subsequent frame.
   */
  step(now: number): boolean {
    if (this.dir === 0) return false;
    const dur = this.dir === 1 ? TO_ROBOT_MS : TO_CAR_MS;
    const u = Math.min(1, (now - this.startTime) / dur);
    this.t = this.dir === 1 ? u : 1 - u;
    if (u >= 1) {
      this.dir = 0;
      return true;
    }
    return false;
  }

  /** Current state for the HUD and for browser/CDP verification. */
  getState(): TransformState {
    const mode = this.t >= 0.999 ? 'robot' : this.t <= 0.001 ? 'car' : 'transforming';
    return { t: this.t, stage: stageFor(this.t), mode };
  }
}
