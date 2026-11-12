"use client";

import { motion } from "framer-motion";
import type { GameRecord } from "@/games/types";
import { isPlayable } from "@/games/registry/registry";
import { getGameTheme } from "@/games/theme";
import { themeStyle } from "@/ui/themeStyle";
import { GameArt } from "@/components/games/GameArt";
import { StatusBadge } from "@/components/games/StatusBadge";

export interface SelectionRevealProps {
  game: GameRecord;
  onPlay: () => void;
  onPickAgain: () => void;
  onBackToUniverse: () => void;
  onDetails: () => void;
}

/**
 * The payoff of the RANDOM PICK sequence: the chosen world is revealed with
 * its artwork, category and description, and two clear ways forward.
 */
export function SelectionReveal({
  game,
  onPlay,
  onPickAgain,
  onBackToUniverse,
  onDetails,
}: SelectionRevealProps) {
  const playable = isPlayable(game);
  const theme = getGameTheme(game);

  return (
    <motion.div
      className="gu-reveal"
      style={themeStyle(game)}
      data-testid="selection-reveal"
      data-game-id={game.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.21, 1] }}
    >
      <motion.div
        className="gu-reveal__card gu-panel gu-clip"
        initial={{ y: 26, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
      >
        <div className="gu-reveal__art">
          <GameArt game={game} variant="banner" className="h-full w-full" />
          <div className="gu-reveal__scrim" aria-hidden />
          <div className="gu-reveal__badge">
            <StatusBadge game={game} />
          </div>
        </div>

        <div className="gu-reveal__body">
          <p className="gu-kicker" style={{ color: "var(--c1)" }}>
            Your destiny has been chosen!
          </p>
          <h2 className="gu-title gu-glow-text mt-2 text-2xl sm:text-4xl">{game.title}</h2>
          <p className="gu-reveal__meta">
            {game.category} | {game.genre}
            {game.version ? ` | V${game.version}` : ""}
          </p>
          <p className="gu-reveal__desc">{game.description}</p>

          <div className="gu-reveal__actions">
            <button
              type="button"
              className="gu-btn gu-btn--primary"
              disabled={!playable}
              onClick={onPlay}
              data-cursor={playable ? "play" : undefined}
              data-testid="reveal-play"
            >
              {playable ? "▶ Play now" : game.status === "development" ? "In development" : "Coming soon"}
            </button>
            <button type="button" className="gu-btn" onClick={onPickAgain} data-testid="reveal-pick-again">
              Pick again
            </button>
            <button type="button" className="gu-btn gu-btn--ghost" onClick={onDetails}>
              Details
            </button>
            <button type="button" className="gu-btn gu-btn--ghost" onClick={onBackToUniverse} data-testid="reveal-back-to-universe">
              Back to universe
            </button>
          </div>
        </div>

        <span className="gu-reveal__glow" aria-hidden style={{ background: theme.primary }} />
      </motion.div>
    </motion.div>
  );
}
