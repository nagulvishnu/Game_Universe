"use client";

import type { GameRecord } from "@/games/types";
import { isPlayable } from "@/games/registry/registry";
import { useUI } from "@/components/providers/UIProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { originFromElement, themeStyle } from "@/ui/themeStyle";
import { GameArt } from "./GameArt";
import { StatusBadge } from "./StatusBadge";

export function GameCard({ game }: { game: GameRecord }) {
  const { openDetails, launch } = useUI();
  const { sfx } = useSettings();
  const playable = isPlayable(game);

  return (
    <article
      className="gu-card"
      style={themeStyle(game)}
      data-testid="game-card"
      data-game-id={game.id}
      onPointerEnter={() => sfx("hover")}
    >
      <div className="relative">
        <GameArt game={game} className="aspect-[16/10] w-full" />
        <div className="absolute left-3 top-3 z-[4]">
          <StatusBadge game={game} />
        </div>
        {game.flagship && (
          <span className="gu-badge absolute right-3 top-3 z-[4]" style={{ color: "#ffd24d" }}>
            Flagship
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5 pb-3">
        <p className="gu-kicker" style={{ color: "var(--c1)", letterSpacing: "0.26em" }}>
          {game.category} · {game.genre}
        </p>
        <h3 className="gu-title text-xl">
          <button
            type="button"
            onClick={() => openDetails(game.id)}
            aria-label={`${game.title} — view details`}
            className="text-left uppercase after:absolute after:inset-0 after:z-[5] after:content-['']"
            data-cursor={playable ? "play" : undefined}
          >
            {game.title}
          </button>
        </h3>
        <p className="line-clamp-2 text-[1.02rem] text-[#aab4e6]">{game.description}</p>
        <div className="gu-card-reveal">
          <div className="flex flex-wrap gap-1.5 pt-1">
            {game.tags.slice(0, 5).map((t) => (
              <span key={t} className="gu-tag">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 px-5 pb-5">
        <span className="font-display text-[0.62rem] tracking-[0.2em] text-[#7f8cc4]">
          {game.version ? `V${game.version}` : ""}
        </span>
        <button
          type="button"
          className={`gu-btn gu-btn--sm ${playable ? "gu-btn--primary" : ""}`}
          disabled={!playable}
          onClick={(e) => launch(game.id, originFromElement(e.currentTarget))}
          aria-label={playable ? `Play ${game.title}` : `${game.title} is not playable yet`}
        >
          {playable ? "▶ Play" : game.status === "development" ? "In development" : "Coming soon"}
        </button>
      </div>
    </article>
  );
}
