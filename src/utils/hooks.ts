"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const subscribeNone = () => () => {};

/**
 * Read a stable browser-only snapshot without a post-mount setState (SSR-safe, no hydration flash).
 * `get` must return a primitive so the snapshot stays referentially stable across calls.
 */
export function useBrowserValue<T>(get: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeNone, get, () => serverValue);
}

export function useBrowserFlag(get: () => boolean, serverValue = false): boolean {
  return useBrowserValue(get, serverValue);
}

/**
 * JSON value from hub localStorage. `parse` must be a stable module-level function. Subscribes to
 * nothing on purpose: this is the *initial* preference; later writes are pushed through React state
 * by whichever provider owns the value.
 */
export function useHubJSON<T>(key: string, parse: (raw: string | null) => T, serverValue: T): T {
  const raw = useSyncExternalStore(
    subscribeNone,
    () => window.localStorage.getItem(key),
    () => null,
  );
  return useMemo(() => parse(raw), [raw, parse]);
}

/** Reactive `matchMedia`. Server render uses `serverValue`, so SSR output stays deterministic. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  const get = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, get, () => serverValue);
}

/** Fullscreen availability + active element, kept in sync by the `fullscreenchange` event. */
export function useFullscreen() {
  const subscribe = useCallback((onChange: () => void) => {
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const supported = useSyncExternalStore(subscribe, () => !!document.fullscreenEnabled, () => true);
  const active = useSyncExternalStore(subscribe, () => !!document.fullscreenElement, () => false);
  return { supported, active };
}