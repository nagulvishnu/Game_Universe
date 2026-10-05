"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGames } from "./GamesProvider";
import { useSettings } from "./SettingsProvider";
import { HUB_KEYS, writeHub } from "@/utils/storage";
import { isPlayable } from "@/games/registry/registry";

export interface LaunchState {
  id: string;
  /** Viewport coordinates the portal expansion grows from (defaults to center). */
  origin: { x: number; y: number };
}

interface UIContextValue {
  detailsId: string | null;
  openDetails: (id: string) => void;
  closeDetails: () => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  launching: LaunchState | null;
  /** Start the cinematic launch → /game/:id. Non-playable games open their details instead. */
  launch: (id: string, origin?: { x: number; y: number }) => void;
  /** True once the user has navigated from the hub into a game during this session. */
  cameFromHub: boolean;
}

const noop = () => {};
const UIContext = createContext<UIContextValue>({
  detailsId: null,
  openDetails: noop,
  closeDetails: noop,
  settingsOpen: false,
  setSettingsOpen: noop,
  launching: null,
  launch: noop,
  cameFromHub: false,
});

export { UIContext };

export function UIProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { getGame } = useGames();
  const { reducedMotion, sfx } = useSettings();
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
const [launching, setLaunching] = useState<LaunchState | null>(null);
const [cameFromHub, setCameFromHub] = useState(false);
const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
const [lastPath, setLastPath] = useState(pathname);

if (lastPath !== pathname) {
  setLastPath(pathname);
  setDetailsId(null);
}

  const openDetails = useCallback(
    (id: string) => {
      sfx("open");
      setDetailsId(id);
    },
    [sfx],
  );
  const closeDetails = useCallback(() => setDetailsId(null), []);

  const launch = useCallback(
    (id: string, origin?: { x: number; y: number }) => {
      const game = getGame(id);
      if (!game) return;
      if (!isPlayable(game)) {
        setDetailsId(id);
        return;
      }
      if (timer.current) return; // already launching
      setDetailsId(null);
      sfx("launch");
      writeHub(HUB_KEYS.lastGame, game.id);
      setCameFromHub(true);
      setLaunching({
        id: game.id,
        origin: origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      });
      timer.current = setTimeout(
        () => {
          timer.current = null;
          router.push(`/game/${encodeURIComponent(game.id)}`);
        },
        reducedMotion ? 200 : 1100,
      );
    },
    [getGame, reducedMotion, router, sfx],
  );

  // Once the game route is mounted, fade the launch overlay out (launcher shows its own loader).
  useEffect(() => {
    if (!launching) return;
    if (pathname.startsWith("/game/")) {
      const t = setTimeout(() => setLaunching(null), 350);
      return () => clearTimeout(t);
    }
  }, [pathname, launching]);

  // Safety net: never leave the overlay stuck.
  useEffect(() => {
    if (!launching) return;
    const t = setTimeout(() => {
      setLaunching(null);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [launching]);

  const value = useMemo<UIContextValue>(
    () => ({
      detailsId,
      openDetails,
      closeDetails,
      settingsOpen,
      setSettingsOpen,
      launching,
      launch,
      cameFromHub,
    }),
    [detailsId, openDetails, closeDetails, settingsOpen, launching, launch, cameFromHub],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  return useContext(UIContext);
}

/** Read inside event handlers (value from the ref-backed context at call time). */
export function useCameFromHub() {
  const ui = useUI();
  return ui.cameFromHub;
}
