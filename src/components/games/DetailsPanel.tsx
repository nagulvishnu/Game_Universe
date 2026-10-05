"use client";

import { useEffect, useRef } from "react";
import { useGames } from "@/components/providers/GamesProvider";
import { useUI } from "@/components/providers/UIProvider";
import { isPlayable } from "@/games/registry/registry";
import { getGameTheme } from "@/games/theme";
import { originFromElement, themeStyle } from "@/ui/themeStyle";
import { GameArt } from "./GameArt";
import { StatusBadge } from "./StatusBadge";

const FOCUSABLE = 'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])';

/** Cinematic "game information screen". */
export function DetailsPanel() {
  const { detailsId, closeDetails, launch } = useUI();
  const { getGame } = useGames();
  const game = detailsId ? getGame(detailsId) : undefined;
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!game) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDetails();
      } else if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [game, closeDetails]);

  if (!game) return null;
  const theme = getGameTheme(game);
  const playable = isPlayable(game);

  const rows: Array<[string, string | undefined]> = [
    ["Genre", game.genre],
    ["Category", game.category],
    ["Version", game.version],
    ["Developer", game.developer],
    ["Release", game.releaseDate],
    ["World", theme.world],
  ];

  return (
    <>
      <div className="gu-backdrop" onClick={closeDetails} aria-hidden />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-title"
        className="gu-details"
        style={themeStyle(game)}
        data-testid="details-panel"
      >
        <div className="gu-corners relative">
          <GameArt game={game} variant="banner" className="aspect-[16/9] w-full" />
          <div className="gu-scanlines" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#070920] to-transparent" />
          <div className="absolute bottom-3 left-5">
            <StatusBadge game={game} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 px-7 pb-8 pt-5">
          <div>
            <p className="gu-kicker" style={{ color: "var(--c1)" }}>
              {`${game.category} // ${game.genre}`}
            </p>
            <h2 id="details-title" className="gu-title gu-glow-text mt-2 text-3xl sm:text-4xl">
              {game.title}
            </h2>
            <p className="mt-4 text-lg text-[#c2cbf2]">{game.description}</p>
          </div>

          <dl>
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="gu-details-row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            <div className="gu-details-row">
              <dt>Status</dt>
              <dd>{game.status === "playable" ? "Playable" : game.status === "development" ? "In development" : "Coming soon"}</dd>
            </div>
          </dl>

          {game.tags.length > 0 && (
            <div>
              <h3 className="gu-kicker mb-3" style={{ color: "#7f8cc4" }}>
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {game.tags.map((t) => (
                  <span key={t} className="gu-tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {game.controls.length > 0 && (
            <div>
              <h3 className="gu-kicker mb-3" style={{ color: "#7f8cc4" }}>
                Controls
              </h3>
              <div className="flex flex-wrap gap-2">
                {game.controls.map((c) => (
                  <kbd key={c} className="gu-key">
                    {c}
                  </kbd>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto flex flex-wrap gap-3 pt-4">
            <button
              type="button"
              className="gu-btn gu-btn--primary"
              disabled={!playable}
              onClick={(e) => launch(game.id, originFromElement(e.currentTarget))}
              data-cursor="play"
            >
              {playable ? "▶ Play game" : game.status === "development" ? "In development" : "Coming soon"}
            </button>
            <button ref={closeRef} type="button" className="gu-btn" onClick={closeDetails}>
              Close
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
