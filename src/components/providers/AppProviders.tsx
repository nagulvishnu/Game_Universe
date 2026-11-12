"use client";

import type { ReactNode } from "react";
import type { DiscoveryReport, GameRecord } from "@/games/types";
import { GamesProvider } from "./GamesProvider";
import { SettingsProvider } from "./SettingsProvider";
import { UIProvider } from "./UIProvider";
import { MainNavigation } from "@/components/nav/MainNavigation";
import { Cursor } from "@/components/ui/Cursor";
import { LaunchOverlay } from "@/components/ui/LaunchOverlay";
import { DetailsPanel } from "@/components/games/DetailsPanel";
import { SettingsDrawer } from "@/components/ui/SettingsDrawer";
import { DiscoveryPanel } from "@/components/ui/DiscoveryPanel";
import { ParticleEnvironment } from "@/components/fx/ParticleEnvironment";

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
          <ParticleEnvironment />
          <MainNavigation />
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
