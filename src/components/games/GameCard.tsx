"use client";

import { useCallback, useRef } from "react";
import type { GameRecord } from "@/games/types";
import { isPlayable } from "@/games/registry/registry";
import { useUI } from "@/components/providers/UIProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { originFromElement, themeStyle } from "@/ui/themeStyle";
import { GameArt } from "./GameArt";
import { StatusBadge } from "./StatusBadge";

const MAX_TILT = 9;

/**
 * A premium game card for the explore grid: artwork, metadata, tags and a
 * play action, with a pointer-driven 3D tilt.
 */
export function GameCard({ game }: { game: GameRecord }) {
  const { openDetails, launch } = useUI();
  const { sfx, reducedMotion } = useSettings();
  const playable = isPlayable(game);
  const cardRef = useRef<HTMLElement>(null);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const el = cardRef.current;
      if (!el || reducedMotion) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tilt-x", `${(-py * MAX_TILT).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(px * MAX_TILT).toFixed(2)}deg`);
      el.style.setProperty("--glare-x", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--glare-y", `${((py + 0.5) * 100).toFixed(1)}%`);
    },
    [reducedMotion],
  );

  const onPointerLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }, []);

  return (
    <article
      ref={cardRef}
      className="gu-card"
      style={themeStyle(game)}
      data-testid="game-card"
      data-game-id={game.id}
      onPointerEnter={() => sfx("hover")}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="gu-card__tilt">
        <div className="relative">
          <GameArt game={game} className="aspect-[16/10] w-full" />
          <div className="gu-card__scrim" aria-hidden />
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
          <p className="gu-kicker" style={{ color: "var(--c1)", letterSpacing: "0.22em" }}>
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
          <p className="line-clamp-2 text-[1rem] text-[#aab2c6]">{game.description}</p>
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
          <span className="font-display text-[0.6rem] tracking-[0.18em] text-[#6d7488]">
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
      </div>
      <span className="gu-card__glare" aria-hidden />
    </article>
  );
}
