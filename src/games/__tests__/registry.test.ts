import { describe, expect, it } from "vitest";
import { makeGame, SAMPLE_GAMES } from "@/test/fixtures";
import { dedupeGames, deriveFacets, filterGames, findGame, pickFeatured, searchGames } from "../registry/registry";
import { getGameTheme } from "../theme";
import { placePortals } from "@/three/placement";

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

describe("theme + placement", () => {
  it("derives world themes from metadata", () => {
    expect(getGameTheme(SAMPLE_GAMES[1]).kind).toBe("racing");
    expect(getGameTheme(SAMPLE_GAMES[2]).kind).toBe("corrupted");
    expect(getGameTheme(SAMPLE_GAMES[0]).kind).toBe("planet");
  });

  it("places portals deterministically without overlap", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `game-${i}`);
    const a = placePortals(ids);
    const b = placePortals([...ids].reverse());
    expect([...a.entries()]).toEqual([...b.entries()]);
    const pts = [...a.values()];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2])).toBeGreaterThan(7);
  });
});
