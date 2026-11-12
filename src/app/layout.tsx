import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/orbitron";
import "@fontsource/rajdhani/400.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { discoveryReport, games } from "@/games/registry";

export const metadata: Metadata = {
  title: { default: "Game Universe", template: "%s | Game Universe" },
  description:
    "A portal to different gaming worlds — explore an ever-growing collection of independent browser games in an interactive holographic universe.",
};

export const viewport: Viewport = {
  themeColor: "#04060f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // The discovery panel is a development tool — never shipped to normal production users.
  const showDiscovery = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_GU_DEBUG === "1";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important;filter:none!important}`}</style>
        </noscript>
      </head>
      <body>
        <AppProviders games={games} report={showDiscovery ? discoveryReport : null}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
