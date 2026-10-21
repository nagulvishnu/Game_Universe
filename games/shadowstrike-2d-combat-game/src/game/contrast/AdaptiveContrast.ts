/**
 * SHADOWSTRIKE — Adaptive Character Contrast System.
 *
 * Dynamically evaluates local arena background luminance and provides
 * optimal high-contrast visual treatments so fighters remain instantly
 * readable and visually striking against any backdrop:
 * - Dark backgrounds: Light silver/steel shadow warrior with crisp dark outlines
 * - Bright backgrounds: Deep charcoal/obsidian warrior with luminous rim highlights
 * - Mixed/mid-tone backgrounds: Hybrid treatment with dual-tone edge accents
 * - Smooth exponential filtering (hysteresis) to prevent flicker.
 */

import type { ArenaDef } from '../../data/arenas';

export type ContrastMode = 'dark_bg' | 'bright_bg' | 'hybrid';

export interface ContrastStyle {
  mode: ContrastMode;
  /** Primary body / suit material */
  bodyColor: number;
  /** Secondary tunic / wrap color */
  clothColor: number;
  /** Armor plate / pauldron / vambrace color */
  armorPlateColor: number;
  /** Belt, straps, and boots trim */
  leatherColor: number;
  /** Outer boundary stroke */
  outlineColor: number;
  /** Rim light / edge reflection color */
  rimColor: number;
  rimAlpha: number;
  /** Accent / energy hue */
  accentColor: number;
  /** Eye glow hue */
  eyeColor: number;
  /** Relative background luminance 0..1 */
  luminance: number;
}

export function hexToRgb(color: number): { r: number; g: number; b: number } {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff,
  };
}

export function rgbToHex(r: number, g: number, b: number): number {
  const cr = Math.min(255, Math.max(0, Math.round(r)));
  const cg = Math.min(255, Math.max(0, Math.round(g)));
  const cb = Math.min(255, Math.max(0, Math.round(b)));
  return (cr << 16) | (cg << 8) | cb;
}

export function calcLuminance(color: number): number {
  const { r, g, b } = hexToRgb(color);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function lerpColor(c1: number, c2: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return rgbToHex(
    a.r + (b.r - a.r) * k,
    a.g + (b.g - a.g) * k,
    a.b + (b.b - a.b) * k
  );
}

export class ContrastTracker {
  private smoothedLuminance = 0.12;

  /**
   * Evaluates the background luminance at the character's position and returns
   * a calibrated contrast style.
   */
  evaluate(
    arena: ArenaDef | null,
    x: number,
    y: number,
    baseBodyColor: number,
    baseEyeColor: number,
    baseAuraColor: number,
    dt = 16
  ): ContrastStyle {
    let localLum = 0.12;

    if (arena) {
      // 1. Calculate base sky/floor color at character's vertical center
      const floorY = arena.floorY || 600;
      const charCenterY = y - 56;
      let bgSampleColor = arena.skyBottom;

      if (charCenterY > floorY) {
        // Below floor line
        bgSampleColor = arena.floorColor;
      } else {
        // Above floor line in sky gradient
        const t = Math.min(1, Math.max(0, charCenterY / floorY));
        bgSampleColor = lerpColor(arena.skyTop, arena.skyBottom, t);
      }

      let lum = calcLuminance(bgSampleColor);

      // 2. Factor in arena accent / particles / bright layers
      const accentLum = calcLuminance(arena.accent);
      lum = lum * 0.75 + accentLum * 0.25;

      localLum = lum;
    }

    // Exponential smoothing / hysteresis to prevent flickering
    const smoothRate = Math.min(1, (dt / 1000) * 8);
    this.smoothedLuminance += (localLum - this.smoothedLuminance) * smoothRate;
    const lum = this.smoothedLuminance;

    // Determine contrast treatment based on thresholds
    if (lum < 0.24) {
      // DARK BACKGROUND: Light shadow warrior treatment
      // Use silver/light-ash body, dark definition outlines, and vibrant eye glow
      return {
        mode: 'dark_bg',
        bodyColor: 0xdde3ed,          // Silver steel body
        clothColor: 0x485064,         // Dark slate ninja gi
        armorPlateColor: 0x9aa4ba,    // Polished steel plates
        leatherColor: 0x232733,       // Deep charcoal belts & straps
        outlineColor: 0x0c0e14,       // Dark silhouette definition outline
        rimColor: 0xffffff,           // Clean edge glint
        rimAlpha: 0.9,
        accentColor: baseAuraColor,
        eyeColor: baseEyeColor,
        luminance: lum,
      };
    } else if (lum > 0.62) {
      // BRIGHT BACKGROUND: Deep shadow / obsidian warrior treatment
      // Use deep obsidian body, stark light rim light, luminous eyes
      return {
        mode: 'bright_bg',
        bodyColor: 0x08090d,          // Deep obsidian black
        clothColor: 0x161820,         // Dark charcoal wrap
        armorPlateColor: 0x222630,    // Midnight metal armor
        leatherColor: 0x0f1016,       // Pitch leather
        outlineColor: 0xffffff,       // Contrasting white/light rim outline
        rimColor: 0x7fd4ff,           // Radiant edge rim
        rimAlpha: 0.95,
        accentColor: baseAuraColor,
        eyeColor: baseEyeColor,
        luminance: lum,
      };
    } else {
      // HYBRID / MID-TONE BACKGROUND: Dual-tone stealth treatment
      // Deep shadowy base with metallic highlights and high-contrast accents
      const t = (lum - 0.24) / (0.62 - 0.24);
      return {
        mode: 'hybrid',
        bodyColor: lerpColor(0x353b4c, 0x12141c, t),
        clothColor: lerpColor(0x282e3d, 0x1b1f29, t),
        armorPlateColor: lerpColor(0x5c657a, 0x363d4e, t),
        leatherColor: 0x151820,
        outlineColor: lerpColor(0x8ea2c4, 0x3a4254, t),
        rimColor: baseAuraColor,
        rimAlpha: 0.75,
        accentColor: baseAuraColor,
        eyeColor: baseEyeColor,
        luminance: lum,
      };
    }
  }
}
