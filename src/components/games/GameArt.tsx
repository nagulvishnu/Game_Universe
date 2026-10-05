"use client";

import { useState } from "react";
import type { GameRecord } from "@/games/types";
import { getGameTheme } from "@/games/theme";
import { themeStyle } from "@/ui/themeStyle";

function initials(title: string): string {
  const words = title.split(/[\s_-]+/).filter(Boolean);
  const s = words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join("") : title.slice(0, 3);
  return s.toUpperCase();
}

/**
 * Thumbnail/banner with an intentional generated fallback (title + genre + world theme)
 * used when the image is missing or fails to load.
 */
export function GameArt({
  game,
  variant = "thumb",
  className = "",
}: {
  game: GameRecord;
  variant?: "thumb" | "banner";
  className?: string;
}) {
  const url = variant === "banner" ? (game.bannerUrl ?? game.thumbnailUrl) : (game.thumbnailUrl ?? game.bannerUrl);
  const [failed, setFailed] = useState<string | null>(null);
  const theme = getGameTheme(game);
  const showImage = !!url && failed !== url;

  return (
    <div className={`gu-art ${className}`} style={themeStyle(game)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(url)} />
      ) : (
        <div className="gu-art-fallback" data-testid="art-fallback">
          <span className="gu-art-glyph">{initials(game.title)}</span>
          <span className="gu-art-world">
            {game.genre} · {theme.world}
          </span>
        </div>
      )}
    </div>
  );
}
