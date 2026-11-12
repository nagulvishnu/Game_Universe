"use client";

import type { GameRecord } from "@/games/types";
import { isPlayable } from "@/games/registry/registry";
import { getGameTheme } from "@/games/theme";
import { themeStyle } from "@/ui/themeStyle";

function initials(title: string): string {
  const words = title.split(/[\s_:-]+/).filter(Boolean);
  const s = words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join("") : title.slice(0, 3);
  return s.toUpperCase();
}

export interface OrbitalCardProps {
  game: GameRecord;
  /** Register the DOM node so the engine can position it every frame. */
  registerRef: (el: HTMLElement | null) => void;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onSelect: (id: string) => void;
  active: boolean;
  revealed: boolean;
}

/**
 * A game card orbiting the holographic core.
 *
 * The card is a real button in the DOM (crisp text, native focus, native
 * semantics); the 3D engine only writes its screen transform each frame.
 */
export function OrbitalCard({
  game,
  registerRef,
  onEnter,
  onLeave,
  onSelect,
  active,
  revealed,
}: OrbitalCardProps) {
  const playable = isPlayable(game);
  const theme = getGameTheme(game);

  return (
    <button
      type="button"
      ref={registerRef}
      className="gu-orbital"
      style={themeStyle(game)}
      data-testid="orbital-card"
      data-game-id={game.id}
      data-active={active ? "true" : "false"}
      data-revealed={revealed ? "true" : "false"}
      onPointerEnter={() => onEnter(game.id)}
      onPointerLeave={onLeave}
      onFocus={() => onEnter(game.id)}
      onBlur={onLeave}
      onClick={() => onSelect(game.id)}
      aria-label={`${game.title} — ${playable ? "play" : game.status}`}
      data-cursor={playable ? "play" : undefined}
    >
      <span className="gu-orbital__frame" aria-hidden>
        <span className="gu-orbital__art">
          {game.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.thumbnailUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="gu-orbital__glyph">{initials(game.title)}</span>
          )}
        </span>
        <span className="gu-orbital__body">
          <span className="gu-orbital__title">{game.title}</span>
          <span className="gu-orbital__meta">{game.category}</span>
        </span>
        <span
          className={`gu-orbital__status gu-orbital__status--${game.status}`}
          title={playable ? "Playable" : game.status === "development" ? "In development" : "Coming soon"}
        />
      </span>
      <span className="gu-orbital__sheen" aria-hidden style={{ ["--c2" as string]: theme.secondary }} />
    </button>
  );
}
