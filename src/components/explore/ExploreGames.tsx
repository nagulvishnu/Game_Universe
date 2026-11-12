"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useGames } from "@/components/providers/GamesProvider";
import { filterGames, sortByMode } from "@/games/registry/registry";
import type { GameSortMode } from "@/games/registry/registry";
import { Reveal } from "@/components/ui/Reveal";
import { GameCard } from "@/components/games/GameCard";
import { EmptyUniverse } from "@/components/games/EmptyUniverse";

const SORTS: Array<{ id: GameSortMode; label: string }> = [
  { id: "title", label: "A–Z" },
  { id: "recent", label: "Recently added" },
  { id: "category", label: "Category" },
];

/**
 * The Explore page: every registered world, with live search, category
 * filters and sorting. All data comes from the registry.
 */
export function ExploreGames({ initialCategory }: { initialCategory?: string }) {
  const { games, facets } = useGames();
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<string>(() => {
    if (!initialCategory) return "ALL";
    return facets.find((item) => item.key.toLowerCase() === initialCategory.toLowerCase())?.key ?? "ALL";
  });
  const [sort, setSort] = useState<GameSortMode>("title");

  const results = useMemo(
    () => sortByMode(filterGames(games, { query, facet }), sort),
    [games, query, facet, sort],
  );

  const filtering = query.trim() !== "" || facet !== "ALL";

  return (
    <section className="gu-page" aria-labelledby="explore-heading">
      <div className="mx-auto max-w-[1400px] px-[clamp(1rem,4vw,4rem)] pb-24 pt-32">
        <Reveal>
          <p className="gu-kicker">Discovery</p>
          <h1 id="explore-heading" className="gu-title mt-3 text-4xl sm:text-6xl">
            Explore <span className="gu-gradient-text">every world</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#aab2c6]">
            {games.length} {games.length === 1 ? "game is" : "games are"} registered in the universe.
            Filter by name, genre or tag to find your next adventure.
          </p>
        </Reveal>

        {games.length === 0 ? (
          <EmptyUniverse />
        ) : (
          <>
            {/* Controls */}
            <Reveal className="gu-explore__controls" delay={70}>
              <div className="gu-explore__row">
                <div className="gu-explore__search" role="search">
                  <label htmlFor="explore-search" className="sr-only">
                    Search games
                  </label>
                  <svg
                    className="gu-explore__search-icon"
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
                    id="explore-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search games, genres, tags…"
                    autoComplete="off"
                    className="gu-input gu-explore__input"
                  />
                </div>

                <div className="gu-explore__sort">
                  <label htmlFor="explore-sort" className="sr-only">
                    Sort games
                  </label>
                  <select
                    id="explore-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as GameSortMode)}
                    className="gu-select"
                    data-testid="explore-sort"
                  >
                    {SORTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="gu-explore__filters" role="group" aria-label="Filter by category">
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

              <p
                className="gu-explore__count font-display text-[0.65rem] tracking-[0.24em] text-dim"
                aria-live="polite"
                role="status"
              >
                {results.length} {results.length === 1 ? "WORLD" : "WORLDS"}
                {filtering ? " MATCH" : " DISCOVERED"}
              </p>
            </Reveal>

            {/* Grid */}
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
              <ul className="gu-explore__grid mt-8">
                {results.map((g, i) => (
                  <li key={g.id}>
                    <Reveal delay={Math.min(i, 8) * 55}>
                      <GameCard game={g} />
                    </Reveal>
                  </li>
                ))}
              </ul>
            )}

            <Reveal className="mt-16" delay={120}>
              <div className="gu-panel gu-clip flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="gu-title text-2xl">Prefer a shortcut?</h2>
                  <p className="mt-2 text-[#aab2c6]">
                    Let the universe pick a world for you and take you straight in.
                  </p>
                </div>
                <Link href="/" className="gu-btn gu-btn--primary">
                  Use random pick
                </Link>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}
