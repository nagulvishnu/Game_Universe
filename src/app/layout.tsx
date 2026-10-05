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
  title: { default: "Nagul's Game Universe", template: "%s · Game Universe" },
  description:
    "A personal 3D game universe — explore worlds, launch independent browser games, and browse the full library.",
};

export const viewport: Viewport = {
  themeColor: "#04040b",
  colorScheme: "dark",
};

// Static, controlled snippet: lets returning visitors skip the intro without a flash.
const INTRO_SNIPPET = `try{if(localStorage.getItem("gu-intro-seen")==="true")document.documentElement.dataset.intro="seen"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  // The discovery panel is a development tool — never shipped to normal production users.
  const showDiscovery = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_GU_DEBUG === "1";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_SNIPPET }} />
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important;filter:none!important}.gu-intro{display:none!important}`}</style>
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
