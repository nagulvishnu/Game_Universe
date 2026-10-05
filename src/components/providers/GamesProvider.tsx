"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { DiscoveryReport, GameRecord } from "@/games/types";
import { deriveFacets, findGame, pickFeatured } from "@/games/registry/registry";
import type { Facet } from "@/games/registry/registry";

interface GamesContextValue {
  games: GameRecord[];
  facets: Facet[];
  featured: GameRecord[];
  report: DiscoveryReport | null;
  getGame: (id: string) => GameRecord | undefined;
}

const GamesContext = createContext<GamesContextValue>({
  games: [],
  facets: [],
  featured: [],
  report: null,
  getGame: () => undefined,
});

export function GamesProvider({
  games,
  report = null,
  children,
}: {
  games: GameRecord[];
  report?: DiscoveryReport | null;
  children: ReactNode;
}) {
  const value = useMemo<GamesContextValue>(
    () => ({
      games,
      facets: deriveFacets(games),
      featured: pickFeatured(games),
      report,
      getGame: (id: string) => findGame(games, id),
    }),
    [games, report],
  );
  return <GamesContext.Provider value={value}>{children}</GamesContext.Provider>;
}

export function useGames() {
  return useContext(GamesContext);
}
