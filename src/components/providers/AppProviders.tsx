"use client";

import type { ReactNode } from "react";
import type { DiscoveryReport, GameRecord } from "@/games/types";
import { GamesProvider } from "./GamesProvider";
import { SettingsProvider } from "./SettingsProvider";
import { UIProvider } from "./UIProvider";
import { Nav } from "@/components/ui/Nav";
import { Cursor } from "@/components/ui/Cursor";
import { LaunchOverlay } from "@/components/ui/LaunchOverlay";
import { DetailsPanel } from "@/components/games/DetailsPanel";
import { SettingsDrawer } from "@/components/ui/SettingsDrawer";
import { DiscoveryPanel } from "@/components/ui/DiscoveryPanel";

export function AppProviders({
  games,
  report,
  children,
}: {
  games: GameRecord[];
  report: DiscoveryReport | null;
  children: ReactNode;
}) {
  return (
    <GamesProvider games={games} report={report}>
      <SettingsProvider>
        <UIProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <div className="gu-atmo" aria-hidden />
          <Nav />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <DetailsPanel />
          <SettingsDrawer />
          <LaunchOverlay />
          <DiscoveryPanel />
          <Cursor />
        </UIProvider>
      </SettingsProvider>
    </GamesProvider>
  );
}
