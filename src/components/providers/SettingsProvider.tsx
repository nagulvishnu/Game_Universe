"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { detectQuality } from "@/utils/device";
import type { DetectedQuality } from "@/utils/device";
import { HUB_KEYS, removeHub, writeHub } from "@/utils/storage";
import { useBrowserValue, useHubJSON, useMediaQuery } from "@/utils/hooks";
import { hubAudio } from "@/utils/audio";
import type { SfxKind } from "@/utils/audio";

export interface Settings {
  audio: boolean;
  motion: "auto" | "full" | "reduced";
  quality: "auto" | "high" | "medium" | "low";
  particles: boolean;
}

export const DEFAULT_SETTINGS: Settings = { audio: false, motion: "auto", quality: "auto", particles: true };

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  setAudio: (on: boolean) => void;
  detectedQuality: DetectedQuality;
  /** Effective values after resolving "auto". */
  reducedMotion: boolean;
  quality: DetectedQuality;
  sfx: (kind: SfxKind) => void;
}

const noop = () => {};
const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: noop,
  reset: noop,
  setAudio: noop,
  detectedQuality: "medium",
  reducedMotion: false,
  quality: "medium",
  sfx: noop,
});

function sanitize(raw: unknown): Settings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : d;
  return {
    audio: typeof r.audio === "boolean" ? r.audio : DEFAULT_SETTINGS.audio,
    motion: pick(r.motion, ["auto", "full", "reduced"] as const, "auto"),
    quality: pick(r.quality, ["auto", "high", "medium", "low"] as const, "auto"),
    particles: typeof r.particles === "boolean" ? r.particles : DEFAULT_SETTINGS.particles,
  };
}

function parseSettings(raw: string | null): Settings {
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // `useSyncExternalStore` yields the server snapshot during hydration and the stored value right
  // after, so the first client render matches SSR and no setState-in-effect pass is needed.
  const persisted = useHubJSON(HUB_KEYS.settings, parseSettings, DEFAULT_SETTINGS);
  const [override, setOverride] = useState<Settings | null>(null);
  const settings = override ?? persisted;

  const detectedQuality = useBrowserValue<DetectedQuality>(detectQuality, "medium");
  const osReduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  const reducedMotion = settings.motion === "reduced" || (settings.motion === "auto" && osReduced);
  const quality: DetectedQuality = settings.quality === "auto" ? detectedQuality : settings.quality;

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [reducedMotion]);

  // Audio only starts after a user gesture; a persisted "on" preference waits for the first one.
  useEffect(() => {
    if (!settings.audio) {
      hubAudio.stop();
      return;
    }
    const start = () => hubAudio.start();
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, [settings.audio]);

  useEffect(() => {
    hubAudio.setSuspended(pathname.startsWith("/game/"));
  }, [pathname]);

  const update = useCallback((patch: Partial<Settings>) => {
    setOverride((prev) => {
      const next = { ...(prev ?? persisted), ...patch };
      writeHub(HUB_KEYS.settings, next);
      return next;
    });
  }, [persisted]);

  const setAudio = useCallback(
    (on: boolean) => {
      // Called from a click handler → valid user gesture for AudioContext.
      if (on) hubAudio.start();
      else hubAudio.stop();
      update({ audio: on });
    },
    [update],
  );

  const reset = useCallback(() => {
    removeHub(HUB_KEYS.settings);
    hubAudio.stop();
    setOverride(DEFAULT_SETTINGS);
  }, []);

  const sfx = useCallback((kind: SfxKind) => hubAudio.sfx(kind), []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, update, reset, setAudio, detectedQuality, reducedMotion, quality, sfx }),
    [settings, update, reset, setAudio, detectedQuality, reducedMotion, quality, sfx],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
