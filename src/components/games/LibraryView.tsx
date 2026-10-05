"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGames } from "@/components/providers/GamesProvider";
import { filterGames } from "@/games/registry/registry";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyUniverse } from "./EmptyUniverse";
import { GameCard } from "./GameCard";

export function LibraryView({ embedded = false }: { embedded?: boolean }) {
  const { games, facets } = useGames();
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<string>("ALL");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!embedded && window.location.hash === "#search") inputRef.current?.focus();
  }, [embedded]);

  const results = useMemo(() => filterGames(games, { query, facet }), [games, query, facet]);
  const filtering = query.trim() !== "" || facet !== "ALL";

  return (
    <section
      id="library"
      aria-labelledby="library-heading"
      className={`relative px-[clamp(1rem,4vw,4rem)] ${embedded ? "py-24" : "pb-24 pt-28"}`}
    >
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <p className="gu-kicker">Game library</p>
          <h2 id="library-heading" className="gu-title mt-3 text-3xl sm:text-5xl">
            The <span className="gu-gradient-text">Library</span>
          </h2>
        </Reveal>

        {games.length === 0 ? (
          <EmptyUniverse />
        ) : (
          <>
            <Reveal className="mt-8 flex flex-col gap-5" delay={80}>
              <div className="relative max-w-2xl" role="search">
                <label htmlFor="game-search" className="sr-only">
                  Search games
                </label>
                <svg
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  id="game-search"
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search games, genres, tags…"
                  autoComplete="off"
                  className="gu-input"
                />
              </div>

              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                {["ALL", ...facets.map((f) => f.key)].map((key) => {
                  const count = key === "ALL" ? games.length : facets.find((f) => f.key === key)?.count;
                  return (
                    <button
                      key={key}
                      type="button"
                      className="gu-chip"
                      aria-pressed={facet === key}
                      onClick={() => setFacet(key)}
                    >
                      {key}
                      <small>{count}</small>
                    </button>
                  );
                })}
              </div>

              <p className="font-display text-[0.65rem] tracking-[0.24em] text-dim" aria-live="polite" role="status">
                {results.length} {results.length === 1 ? "WORLD" : "WORLDS"}
                {filtering ? " MATCH" : " DISCOVERED"}
              </p>
            </Reveal>

            {results.length === 0 ? (
              <div className="gu-panel gu-clip mt-10 px-8 py-14 text-center" data-testid="no-results">
                <p className="gu-title text-2xl">No worlds match</p>
                <p className="mt-3 text-dim">Try another search or clear the filters.</p>
                <button
                  type="button"
                  className="gu-btn mt-6"
                  onClick={() => {
                    setQuery("");
                    setFacet("ALL");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(100%,310px),1fr))] gap-6">
                {results.map((g, i) => (
                  <li key={g.id} className="reveal-li">
                    <Reveal delay={Math.min(i, 8) * 60}>
                      <GameCard game={g} />
                    </Reveal>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
