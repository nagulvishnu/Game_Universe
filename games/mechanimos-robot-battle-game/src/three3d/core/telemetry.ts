// Phase 9.1 — frame-time telemetry for the 3D application shell.
//
// Deliberately free of Three.js and DOM references so the measurement logic can
// be unit tested in plain Node. THREE.WebGLRenderer.info is only *read* at the
// boundary (in App3D) and handed in as plain numbers.
//
// Measurement policy:
// - Fixed-capacity ring buffer, zero allocation per frame (matching the existing
//   proto3d approach).
// - p95 is computed on demand, not per frame, because it needs a sorted copy.
//   Callers poll it at UI rate (~150 ms), not at 60 Hz.

export const DEFAULT_CAPACITY = 240;

/**
 * Linear-interpolated percentile over an ascending-sorted array.
 * p is clamped to [0, 1]. Returns 0 for an empty input.
 */
export function percentile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const clamped = Math.max(0, Math.min(1, p));
  if (n === 1) return sorted[0];
  const pos = clamped * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export class FrameTimeMonitor {
  readonly capacity: number;
  private buffer: Float32Array;
  private index = 0;
  private count = 0;
  private sum = 0;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    const n = Number.isFinite(capacity) ? Math.floor(capacity) : DEFAULT_CAPACITY;
    this.capacity = Math.max(8, n);
    this.buffer = new Float32Array(this.capacity);
  }

  /** Record one frame duration in milliseconds. Non-finite or non-positive
   *  samples are ignored so a bad timestamp cannot poison the average. */
  push(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    const v = Math.min(frameMs, 1000); // a 1 s clamp keeps one stall from skewing everything
    if (this.count === this.capacity) {
      this.sum -= this.buffer[this.index];
    } else {
      this.count++;
    }
    this.buffer[this.index] = v;
    this.sum += v;
    this.index = (this.index + 1) % this.capacity;
  }

  get sampleCount(): number {
    return this.count;
  }

  /** Mean frame time over the current window, in ms. */
  get averageMs(): number {
    return this.count === 0 ? 0 : this.sum / this.count;
  }

  get fps(): number {
    const avg = this.averageMs;
    return avg > 0 ? 1000 / avg : 0;
  }

  get p95Ms(): number {
    if (this.count === 0) return 0;
    const sorted = this.sortedWindow();
    return percentile(sorted, 0.95);
  }

  get maxMs(): number {
    if (this.count === 0) return 0;
    const sorted = this.sortedWindow();
    return sorted[sorted.length - 1];
  }

  reset(): void {
    this.buffer = new Float32Array(this.capacity);
    this.index = 0;
    this.count = 0;
    this.sum = 0;
  }

  private sortedWindow(): number[] {
    const out: number[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) out[i] = this.buffer[i];
    out.sort((a, b) => a - b);
    return out;
  }
}

/** Renderer counters copied out of THREE.WebGLRenderer.info at poll time. */
export interface RenderCounters {
  drawCalls: number;
  triangles: number;
}

export interface TelemetrySnapshot {
  fps: number;
  frameMs: number;
  p95Ms: number;
  maxMs: number;
  samples: number;
  drawCalls: number;
  triangles: number;
  quality: string;
  shadows: boolean;
  pixelRatio: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function buildSnapshot(
  monitor: FrameTimeMonitor,
  counters: RenderCounters,
  extras: {
    quality: string;
    shadows: boolean;
    pixelRatio: number;
    canvasWidth: number;
    canvasHeight: number;
  },
): TelemetrySnapshot {
  return {
    fps: monitor.fps,
    frameMs: monitor.averageMs,
    p95Ms: monitor.p95Ms,
    maxMs: monitor.maxMs,
    samples: monitor.sampleCount,
    drawCalls: counters.drawCalls,
    triangles: counters.triangles,
    quality: extras.quality,
    shadows: extras.shadows,
    pixelRatio: extras.pixelRatio,
    canvasWidth: extras.canvasWidth,
    canvasHeight: extras.canvasHeight,
  };
}