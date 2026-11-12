"use client";

import Link from "next/link";
import { useGames } from "@/components/providers/GamesProvider";
import { groupByCategory } from "@/games/registry/registry";
import { Reveal } from "@/components/ui/Reveal";
import { GameArt } from "@/components/games/GameArt";
import { getGameTheme } from "@/games/theme";
import { EmptyUniverse } from "@/components/games/EmptyUniverse";

/**
 * Category overview. Groups are derived from the registry metadata itself,
 * so a newly registered game appears automatically.
 */
export function CategoriesView() {
  const { games } = useGames();
  const groups = groupByCategory(games);

  return (
    <section className="gu-page" aria-labelledby="categories-heading">
      <div className="mx-auto max-w-[1400px] px-[clamp(1rem,4vw,4rem)] pb-24 pt-32">
        <Reveal>
          <p className="gu-kicker">Atlas</p>
          <h1 id="categories-heading" className="gu-title mt-3 text-4xl sm:text-6xl">
            Browse by <span className="gu-gradient-text">category</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#aab2c6]">
            Every world is grouped by how it is built and what it feels like. Pick a category to jump
            straight into that part of the universe.
          </p>
        </Reveal>

        {groups.length === 0 ? (
          <EmptyUniverse />
        ) : (
          <div className="gu-cats mt-12">
            {groups.map((group, i) => (
              <Reveal key={group.key} delay={i * 70}>
                <article className="gu-cat" data-testid="category-group" data-category={group.key}>
                  <div className="gu-cat__head">
                    <div>
                      <h2 className="gu-title text-2xl">{group.label}</h2>
                      <p className="gu-cat__count">
                        {group.count} {group.count === 1 ? "world" : "worlds"}
                      </p>
                    </div>
                    <Link
                      href={`/explore?category=${encodeURIComponent(group.key)}`}
                      className="gu-btn gu-btn--sm"
                    >
                      View all
                    </Link>
                  </div>

                  <ul className="gu-cat__list">
                    {group.games.map((g) => {
                      const theme = getGameTheme(g);
                      return (
                        <li key={g.id}>
                          <Link href={`/game/${encodeURIComponent(g.id)}`} className="gu-cat__item">
                            <span className="gu-cat__thumb" style={{ ["--c1" as string]: theme.primary }}>
                              <GameArt game={g} className="h-full w-full" />
                            </span>
                            <span className="gu-cat__info">
                              <span className="gu-cat__title">{g.title}</span>
                              <span className="gu-cat__genre">{g.genre}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
