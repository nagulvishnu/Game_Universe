export type DetectedQuality = "high" | "medium" | "low";

export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Pick a sensible default graphics quality from coarse device signals. */
export function detectQuality(): DetectedQuality {
  if (typeof window === "undefined") return "medium";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const small = window.innerWidth < 900;
  const coarse = isCoarsePointer();
  if (coarse || small || mem <= 2 || cores <= 2) return "low";
  if (mem >= 8 && cores >= 8 && (window.devicePixelRatio || 1) <= 2) return "high";
  return "medium";
}
