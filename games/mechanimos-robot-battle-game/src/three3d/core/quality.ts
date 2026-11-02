// Phase 9.1 — graphics quality presets for the reusable 3D application shell.
//
// Pure data + pure functions: no Three.js, no DOM. Everything here is unit
// testable in plain Node and is the single place where "expensive rendering
// setting" decisions are recorded.
//
// Design notes:
// - Pixel ratio is always capped. A 4 GB laptop GPU (RTX 3050) pays for every
//   extra fragment, and an uncapped DPR is the cheapest way to halve FPS.
// - LOW mode changes more than DPR: shadows off AND antialias off at renderer
//   construction, plus a smaller shadow map if shadows are ever re-enabled.

export type QualityLevel = 'high' | 'low';

export const QUALITY_LEVELS: readonly QualityLevel[] = ['high', 'low'];

export interface QualityPreset {
  level: QualityLevel;
  /** Hard ceiling applied to window.devicePixelRatio. */
  maxPixelRatio: number;
  shadows: boolean;
  antialias: boolean;
  /** Used only when shadows are enabled; ignored in LOW. */
  shadowMapSize: number;
  environmentIntensity: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  high: {
    level: 'high',
    maxPixelRatio: 1.75,
    shadows: true,
    antialias: true,
    shadowMapSize: 1024,
    environmentIntensity: 0.55,
  },
  low: {
    level: 'low',
    maxPixelRatio: 1,
    shadows: false,
    antialias: false,
    shadowMapSize: 512,
    environmentIntensity: 0.35,
  },
};

export function isQualityLevel(value: unknown): value is QualityLevel {
  return value === 'high' || value === 'low';
}

/** Unknown levels fall back to HIGH rather than throwing, so a bad value in a
 *  URL or a stale saved preference can never produce a blank screen. */
export function getPreset(level: unknown): QualityPreset {
  return isQualityLevel(level) ? QUALITY_PRESETS[level] : QUALITY_PRESETS.high;
}

/**
 * Resolve the renderer pixel ratio for a quality level.
 * Clamped to [1, maxPixelRatio]; never returns 0, NaN or a negative value,
 * because all three are invalid for THREE.WebGLRenderer.setPixelRatio.
 */
export function resolvePixelRatio(level: unknown, devicePixelRatio: unknown): number {
  const preset = getPreset(level);
  const raw = typeof devicePixelRatio === 'number' && Number.isFinite(devicePixelRatio)
    ? devicePixelRatio
    : 1;
  return Math.max(1, Math.min(preset.maxPixelRatio, raw));
}

/** HIGH <-> LOW toggle. */
export function nextQuality(level: QualityLevel): QualityLevel {
  return level === 'high' ? 'low' : 'high';
}

export function qualityLabel(level: QualityLevel): string {
  return level.toUpperCase();
}