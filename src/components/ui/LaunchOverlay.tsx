"use client";

import { usePathname } from "next/navigation";
import { useGames } from "@/components/providers/GamesProvider";
import { useUI } from "@/components/providers/UIProvider";
import { themeStyle } from "@/ui/themeStyle";

/** Portal expansion that covers the screen between the hub and the game launcher. */
export function LaunchOverlay() {
  const { launching } = useUI();
  const { getGame } = useGames();
  const pathname = usePathname();
  if (!launching) return null;
  const game = getGame(launching.id);
  if (!game) return null;
  const leaving = pathname.startsWith("/game/");

  return (
    <div
      className="gu-launch"
      data-leaving={leaving}
      role="status"
      aria-live="polite"
      style={{ ...themeStyle(game), "--ox": `${launching.origin.x}px`, "--oy": `${launching.origin.y}px` } as React.CSSProperties}
    >
      <div className="text-center">
        <p className="gu-kicker" style={{ color: "#fff" }}>
          Entering
        </p>
        <p className="gu-title gu-glow-text mt-3 text-3xl sm:text-5xl">{game.title}</p>
      </div>
    </div>
  );
}
