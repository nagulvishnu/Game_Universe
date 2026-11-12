import { describe, expect, it } from "vitest";
import { makeGame, SAMPLE_GAMES } from "@/test/fixtures";
import {
  dedupeGames,
  deriveFacets,
  eligibleForRandom,
  filterGames,
  findGame,
  groupByCategory,
  pickFeatured,
  pickRandomGame,
  searchGames,
  sortByMode,
} from "../registry/registry";
import { getGameTheme } from "../theme";

describe("registry", () => {
  it("handles duplicate ids (first wins)", () => {
    const { games, duplicates } = dedupeGames([makeGame({ id: "x", title: "First" }), makeGame({ id: "X", title: "Second" })]);
    expect(games).toHaveLength(1);
    expect(games[0].title).toBe("First");
    expect(duplicates).toHaveLength(1);
  });

  it("derives categories dynamically from metadata", () => {
    const keys = deriveFacets(SAMPLE_GAMES).map((f) => f.key);
    expect(keys).toContain("ADVENTURE");
    expect(keys).toContain("RACING");
    expect(keys).toContain("STRATEGY");
    expect(keys).toContain("3D");
    expect(keys).toContain("2D");
    expect(deriveFacets(SAMPLE_GAMES)[0].count).toBeGreaterThanOrEqual(2);
  });

  it("searches title, description, genre and tags", () => {
    expect(searchGames(SAMPLE_GAMES, "racing").map((g) => g.id)).toEqual(["neon-velocity"]);
    expect(searchGames(SAMPLE_GAMES, "hold the line").map((g) => g.id)).toEqual(["zombie-defense"]);
    expect(searchGames(SAMPLE_GAMES, "horror").map((g) => g.id)).toEqual(["zombie-defense"]);
    expect(searchGames(SAMPLE_GAMES, "beast")).toHaveLength(1);
    expect(searchGames(SAMPLE_GAMES, "")).toHaveLength(3);
  });

  it("filters by facet and combines with search", () => {
    expect(filterGames(SAMPLE_GAMES, { facet: "3D" })).toHaveLength(2);
    expect(filterGames(SAMPLE_GAMES, { facet: "3D", query: "drift" }).map((g) => g.id)).toEqual(["neon-velocity"]);
    expect(filterGames(SAMPLE_GAMES, { facet: "ALL" })).toHaveLength(3);
  });

  it("finds games by id case-insensitively and picks featured/flagship", () => {
    expect(findGame(SAMPLE_GAMES, "NEON-VELOCITY")?.title).toBe("Neon Velocity");
    expect(findGame(SAMPLE_GAMES, "missing")).toBeUndefined();
    expect(pickFeatured(SAMPLE_GAMES).map((g) => g.id)).toEqual(["ai-beast-world"]);
  });
});

describe("category grouping", () => {
  it("groups games by their declared category", () => {
    const groups = groupByCategory(SAMPLE_GAMES);
    expect(groups.map((g) => g.key).sort()).toEqual(["2D", "3D"]);
    const threeD = groups.find((g) => g.key === "3D")!;
    expect(threeD.count).toBe(2);
    expect(threeD.games.map((g) => g.id).sort()).toEqual(["ai-beast-world", "neon-velocity"]);
  });

  it("never invents categories — every group comes from a real game", () => {
    const groups = groupByCategory(SAMPLE_GAMES);
    const known = new Set(SAMPLE_GAMES.map((g) => g.category));
    for (const group of groups) expect(known.has(group.key)).toBe(true);
    expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(SAMPLE_GAMES.length);
  });

  it("returns an empty list when there are no games", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe("sorting", () => {
  it("sorts alphabetically by title", () => {
    expect(sortByMode(SAMPLE_GAMES, "title").map((g) => g.title)).toEqual([
      "AI Beast World",
      "Neon Velocity",
      "Zombie Defense",
    ]);
  });

  it("sorts by category then title", () => {
    expect(sortByMode(SAMPLE_GAMES, "category").map((g) => g.category)).toEqual(["2D", "3D", "3D"]);
  });

  it("sorts by release date, newest first, and keeps undated games last", () => {
    const dated = [
      makeGame({ id: "old", title: "Old", releaseDate: "2020-01-01" }),
      makeGame({ id: "new", title: "New", releaseDate: "2026-05-05" }),
      makeGame({ id: "undated", title: "Undated" }),
    ];
    expect(sortByMode(dated, "recent").map((g) => g.id)).toEqual(["new", "old", "undated"]);
  });

  it("does not mutate the input array", () => {
    const original = SAMPLE_GAMES.map((g) => g.id);
    sortByMode(SAMPLE_GAMES, "title");
    expect(SAMPLE_GAMES.map((g) => g.id)).toEqual(original);
  });
});

describe("random pick", () => {
  it("only ever selects playable games", () => {
    expect(eligibleForRandom(SAMPLE_GAMES).map((g) => g.id)).toEqual(["ai-beast-world", "neon-velocity"]);
  });

  it("selects from the registry, not a hardcoded list", () => {
    const chosen = pickRandomGame(SAMPLE_GAMES, () => 0);
    expect(chosen?.id).toBe("ai-beast-world");
    expect(pickRandomGame(SAMPLE_GAMES, () => 0.99)?.id).toBe("neon-velocity");
  });

  it("never picks a game that is not playable", () => {
    for (let i = 0; i < 50; i++) {
      const chosen = pickRandomGame(SAMPLE_GAMES);
      expect(chosen).not.toBeNull();
      expect(chosen?.status).toBe("playable");
    }
  });

  it("returns null when there is nothing eligible", () => {
    const allDevelopment = SAMPLE_GAMES.map((g) => ({ ...g, status: "development" as const }));
    expect(eligibleForRandom(allDevelopment)).toHaveLength(0);
    expect(pickRandomGame(allDevelopment)).toBeNull();
    expect(pickRandomGame([])).toBeNull();
  });

  it("handles a non-playable registry without throwing", () => {
    const chosen = pickRandomGame(
      SAMPLE_GAMES.map((g) => ({ ...g, status: "coming-soon" as const })),
      () => 0.5,
    );
    expect(chosen).toBeNull();
  });
});

describe("theme", () => {
  it("derives world themes from metadata", () => {
    expect(getGameTheme(SAMPLE_GAMES[1]).kind).toBe("racing");
    expect(getGameTheme(SAMPLE_GAMES[2]).kind).toBe("corrupted");
    expect(getGameTheme(SAMPLE_GAMES[0]).kind).toBe("planet");
  });
});
