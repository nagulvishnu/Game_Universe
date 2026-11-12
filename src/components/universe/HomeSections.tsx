"use client";

import Link from "next/link";
import { useGames } from "@/components/providers/GamesProvider";
import { useUI } from "@/components/providers/UIProvider";
import { isPlayable } from "@/games/registry/registry";
import { Reveal } from "@/components/ui/Reveal";
import { GameArt } from "@/components/games/GameArt";
import { StatusBadge } from "@/components/games/StatusBadge";
import { getGameTheme } from "@/games/theme";
import { themeStyle } from "@/ui/themeStyle";

function Spotlight({ game, big }: { game: import("@/games/types").GameRecord; big: boolean }) {
  const { launch, openDetails } = useUI();
  const playable = isPlayable(game);

  return (
    <div
      className={`gu-clip gu-spotlight ${big ? "gu-spotlight--big" : ""}`}
      style={themeStyle(game)}
      data-testid="featured-game"
    >
      <div className="gu-spotlight__art">
        <GameArt game={game} variant="banner" className="h-full w-full" />
      </div>
      <div className="gu-spotlight__veil" aria-hidden />
      <div className="gu-scanlines" aria-hidden />
      <div className="gu-spotlight__body min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge game={game} />
          <span className="gu-kicker" style={{ color: "var(--c1)", letterSpacing: "0.22em" }}>
            {game.flagship ? "Flagship" : "Featured"} · {game.category} · {game.genre}
          </span>
        </div>
        <h3 className={`gu-title gu-glow-text ${big ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"}`}>
          {game.title}
        </h3>
        <p className="line-clamp-3 text-lg text-[#c8cde0]">{game.description}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            className="gu-btn gu-btn--primary"
            disabled={!playable}
            onClick={() => launch(game.id)}
            data-cursor={playable ? "play" : undefined}
          >
            {playable ? "▶ Play now" : game.status === "development" ? "In development" : "Coming soon"}
          </button>
          <button type="button" className="gu-btn" onClick={() => openDetails(game.id)}>
            Details
          </button>
        </div>
      </div>
    </div>
  );
}

/** Supporting homepage sections below the holographic stage. */
export function HomeSections() {
  const { games, featured } = useGames();
  if (games.length === 0) return null;

  const [first, ...rest] = featured.length > 0 ? featured : games.slice(0, 3);
  const categories = [...new Set(games.map((g) => g.category))];

  return (
    <>
      <section id="featured" aria-labelledby="featured-heading" className="gu-page">
        <div className="mx-auto max-w-[1400px] px-[clamp(1rem,4vw,4rem)] py-24">
          <Reveal>
            <p className="gu-kicker">Featured worlds</p>
            <h2 id="featured-heading" className="gu-title mt-3 text-3xl sm:text-5xl">
              Enter the <span className="gu-gradient-text">spotlight</span>
            </h2>
          </Reveal>

          {first && (
            <Reveal className="mt-10" delay={80}>
              <Spotlight game={first} big />
            </Reveal>
          )}

          {rest.length > 0 && (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {rest.slice(0, 4).map((g, i) => (
                <Reveal key={g.id} delay={i * 80}>
                  <Spotlight game={g} big={false} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="universe-map" aria-labelledby="map-heading" className="gu-page gu-page--alt">
        <div className="mx-auto max-w-[1400px] px-[clamp(1rem,4vw,4rem)] py-24">
          <Reveal>
            <p className="gu-kicker">Universe map</p>
            <h2 id="map-heading" className="gu-title mt-3 text-3xl sm:text-5xl">
              Choose a <span className="gu-gradient-text">sector</span>
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-[#aab2c6]">
              Every world sits in a sector of the collection. Pick one to filter the catalogue.
            </p>
          </Reveal>

          <div className="gu-sectors mt-10">
            {categories.map((c, i) => {
              const inCategory = games.filter((g) => g.category === c);
              const accent = getGameTheme(inCategory[0]).primary;
              return (
                <Reveal key={c} delay={i * 60}>
                  <Link
                    href={`/explore?category=${encodeURIComponent(c)}`}
                    className="gu-sector"
                    style={{ ["--c1" as string]: accent }}
                    data-testid="sector-link"
                  >
                    <span className="gu-sector__name">{c}</span>
                    <span className="gu-sector__count">
                      {inCategory.length} {inCategory.length === 1 ? "world" : "worlds"}
                    </span>
                    <span className="gu-sector__arrow" aria-hidden>
                      →
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--gu-line)] px-[clamp(1rem,4vw,4rem)] py-8">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 text-sm text-dim">
        <p className="font-display text-[0.65rem] tracking-[0.3em] uppercase">Game Universe</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <Link href="/" className="hover:text-neon">
            Home
          </Link>
          <Link href="/explore" className="hover:text-neon">
            Explore Games
          </Link>
          <Link href="/categories" className="hover:text-neon">
            Categories
          </Link>
          <Link href="/about" className="hover:text-neon">
            About
          </Link>
        </nav>
        <p>Every world is an independent game.</p>
      </div>
    </footer>
  );
}
