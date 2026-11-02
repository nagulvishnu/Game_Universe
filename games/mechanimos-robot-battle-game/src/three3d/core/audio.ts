// Phase 9.6 — optional, procedural WebAudio for the 3D shell.
//
// Split the same way as the rest of `core/`:
//   - the cue/tone maths below are PURE (no WebAudio, no DOM) and unit tested;
//   - MechAudioEngine is the thin browser layer that turns cues into nodes.
//
// Design guarantees:
// - The AudioContext is created/resumed ONLY from a user gesture (App3D calls
//   ensureStarted() from a real pointerdown/keydown). Nothing autoplays.
// - Unsupported audio or a blocked/suspended context degrades to silence and
//   never throws into the game loop.
// - Every oscillator is short lived and disconnects itself on `ended`; the
//   persistent engine oscillator is stopped on dispose. No node leaks.
// - No audio assets and no dependencies: everything is synthesised.

import { TO_CAR_MS, TO_ROBOT_MS } from './transform';

export type CueWave = 'sine' | 'square' | 'sawtooth' | 'triangle';

/** One scheduled tone. `at` is seconds from the cue's own start. */
export interface AudioCue {
  wave: CueWave;
  freq: number;
  freqTo?: number;
  /** Seconds. */
  dur: number;
  /** Peak linear volume, 0..1. */
  vol: number;
  /** Seconds from the start of the cue. */
  at: number;
}

/** Transformation durations, reused so audio length always matches the timeline. */
export const TO_ROBOT_CUE_SECONDS = TO_ROBOT_MS / 1000;
export const TO_CAR_CUE_SECONDS = TO_CAR_MS / 1000;

export type TransformDirection = 'toRobot' | 'toCar';

/**
 * Mechanical transformation cue: a servo sweep plus a few staged clunks, sized
 * to the transformation timeline. Deterministic, so it can be asserted.
 */
export function transformCues(direction: TransformDirection): AudioCue[] {
  if (direction === 'toRobot') {
    return [
      { wave: 'sawtooth', freq: 90, freqTo: 540, dur: 0.9, vol: 0.18, at: 0 },
      { wave: 'square', freq: 320, dur: 0.12, vol: 0.13, at: 0.55 },
      { wave: 'square', freq: 430, dur: 0.12, vol: 0.13, at: 1.1 },
      { wave: 'square', freq: 560, dur: 0.14, vol: 0.14, at: 1.6 },
      { wave: 'sawtooth', freq: 700, freqTo: 900, dur: 0.3, vol: 0.12, at: 1.9 },
      { wave: 'sine', freq: 64, freqTo: 40, dur: 0.4, vol: 0.3, at: 1.95 },
    ];
  }
  return [
    { wave: 'sawtooth', freq: 540, freqTo: 90, dur: 0.8, vol: 0.16, at: 0 },
    { wave: 'square', freq: 520, dur: 0.12, vol: 0.12, at: 0.45 },
    { wave: 'square', freq: 380, dur: 0.12, vol: 0.12, at: 0.85 },
    { wave: 'sine', freq: 70, freqTo: 44, dur: 0.3, vol: 0.28, at: 1.5 },
  ];
}

/** Foot-plant impact: low thud plus a short debris tick. */
export function landingCues(): AudioCue[] {
  return [
    { wave: 'sine', freq: 70, freqTo: 38, dur: 0.4, vol: 0.4, at: 0 },
    { wave: 'square', freq: 900, dur: 0.16, vol: 0.14, at: 0.02 },
    { wave: 'triangle', freq: 520, dur: 0.12, vol: 0.1, at: 0.09 },
  ];
}

/** Longest cue end time, useful for assertions and scheduling sanity. */
export function cueSpanSeconds(cues: AudioCue[]): number {
  let max = 0;
  for (const c of cues) max = Math.max(max, c.at + c.dur);
  return max;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Engine pitch tracks speed: idle rumble to a higher whine at full speed. */
export function engineFrequency(speed: number): number {
  const s = Number.isFinite(speed) ? clamp01(Math.abs(speed) / 18) : 0;
  return 55 + s * 135;
}

/** Engine gain: silent at rest, ramps with speed, scaled by volume, zero when muted. */
export function engineGain(speed: number, volume: number, muted: boolean): number {
  if (muted) return 0;
  const s = Number.isFinite(speed) ? clamp01(Math.abs(speed) / 18) : 0;
  if (s < 0.02) return 0;
  return (0.04 + 0.14 * s) * clampVolume(volume);
}

/** Volume clamped to a sane [0,1] range; non-finite becomes the default. */
export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0.6;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export type AudioStatus = 'idle' | 'running' | 'unsupported';

export interface AudioStateView {
  supported: boolean;
  status: AudioStatus;
  muted: boolean;
  volume: number;
  /** Scheduled short-lived voices currently sounding. */
  activeNodes: number;
}

interface AudioCtor {
  new (): AudioContext;
}

/**
 * Browser playback layer. Safe to construct anywhere; it does nothing until
 * ensureStarted() is called from a user gesture.
 */
export class MechAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  private status: AudioStatus = 'idle';
  private muted = false;
  private volume = 0.6;
  private activeNodes = 0;
  private disposed = false;

  get supported(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    return typeof (w.AudioContext ?? w.webkitAudioContext) === 'function';
  }

  /**
   * Create or resume the AudioContext. MUST be called from within a user
   * gesture handler the first time. Returns true when audio is running.
   */
  ensureStarted(): boolean {
    if (this.disposed) return false;
    if (!this.supported) {
      this.status = 'unsupported';
      return false;
    }
    try {
      if (!this.ctx) {
        const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
        const Ctor = (w.AudioContext ?? w.webkitAudioContext) as AudioCtor;
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : this.volume;
        master.connect(ctx.destination);

        const engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = engineFrequency(0);
        const engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();

        this.ctx = ctx;
        this.master = master;
        this.engineOsc = engineOsc;
        this.engineGain = engineGain;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* stays suspended */ });
      this.status = 'running';
      return true;
    } catch {
      this.status = 'unsupported';
      return false;
    }
  }

  playTransform(direction: TransformDirection): void {
    this.playCues(transformCues(direction));
  }

  playLanding(): void {
    this.playCues(landingCues());
  }

  playCues(cues: AudioCue[]): void {
    if (this.muted) return;
    if (this.status !== 'running' || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const master = this.master;
    for (const cue of cues) {
      try {
        const t0 = ctx.currentTime + cue.at;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = cue.wave;
        osc.frequency.setValueAtTime(Math.max(20, cue.freq), t0);
        if (cue.freqTo !== undefined) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, cue.freqTo), t0 + cue.dur);
        }
        const peak = Math.max(0.0001, clamp01(cue.vol));
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + cue.dur);
        osc.connect(gain);
        gain.connect(master);
        this.activeNodes++;
        osc.onended = () => {
          this.activeNodes = Math.max(0, this.activeNodes - 1);
          try { osc.disconnect(); gain.disconnect(); } catch { /* already gone */ }
        };
        osc.start(t0);
        osc.stop(t0 + cue.dur + 0.05);
      } catch {
        // A single bad cue must never break the frame.
      }
    }
  }

  /** Continuous engine voice. Cheap to call every frame. */
  setEngine(speed: number): void {
    if (this.status !== 'running' || !this.ctx || !this.engineOsc || !this.engineGain) return;
    try {
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(engineFrequency(speed), t, 0.08);
      this.engineGain.gain.setTargetAtTime(engineGain(speed, this.volume, this.muted), t, 0.12);
    } catch {
      // ignore; engine simply keeps its previous value
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMaster();
    if (this.engineGain && this.ctx) {
      try { this.engineGain.gain.setTargetAtTime(this.muted ? 0 : engineGain(0, this.volume, false), this.ctx.currentTime, 0.05); } catch { /* ignore */ }
    }
  }

  setVolume(volume: number): void {
    this.volume = clampVolume(volume);
    this.applyMaster();
  }

  getState(): AudioStateView {
    return {
      supported: this.supported,
      status: this.status,
      muted: this.muted,
      volume: this.volume,
      activeNodes: this.activeNodes,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try { if (this.engineOsc) { this.engineOsc.onended = null; this.engineOsc.stop(); this.engineOsc.disconnect(); } } catch { /* ignore */ }
    try { this.engineGain?.disconnect(); } catch { /* ignore */ }
    try { this.master?.disconnect(); } catch { /* ignore */ }
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.activeNodes = 0;
    this.status = 'idle';
  }

  private applyMaster(): void {
    if (!this.master || !this.ctx) return;
    try { this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05); } catch { /* ignore */ }
  }
}
