import type { GameRecord } from "../types";

/** Keep the first game per id; report later duplicates. */
export function dedupeGames(games: GameRecord[]): { games: GameRecord[]; duplicates: GameRecord[] } {
  const seen = new Set<string>();
  const out: GameRecord[] = [];
  const duplicates: GameRecord[] = [];
  for (const g of games) {
    const key = g.id.toLowerCase();
    if (seen.has(key)) duplicates.push(g);
    else {
      seen.add(key);
      out.push(g);
    }
  }
  return { games: out, duplicates };
}

export function normalizeFacet(value: string): string {
  return value.trim().toUpperCase();
}

export interface Facet {
  key: string;
  count: number;
}

/** Dynamic filter facets derived from genre + category (+ frequent tags). */
export function deriveFacets(games: GameRecord[], limit = 14): Facet[] {
  const counts = new Map<string, number>();
  const bump = (v: string, n: Set<string>) => {
    const k = normalizeFacet(v);
    if (!k || n.has(k)) return;
    n.add(k);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const g of games) {
    const seen = new Set<string>();
    bump(g.genre, seen);
    bump(g.category, seen);
  }
  const tagCounts = new Map<string, number>();
  for (const g of games) {
    for (const t of new Set(g.tags.map(normalizeFacet))) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  // Tags only become facets when they group more than one game (keeps chips meaningful).
  for (const [t, c] of tagCounts) if (c > 1 && !counts.has(t)) counts.set(t, c);

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export function gameMatchesFacet(game: GameRecord, facet: string): boolean {
  const f = normalizeFacet(facet);
  return (
    normalizeFacet(game.genre) === f ||
    normalizeFacet(game.category) === f ||
    game.tags.some((t) => normalizeFacet(t) === f)
  );
}

function haystack(game: GameRecord): string {
  return [game.title, game.description, game.genre, game.category, game.developer ?? "", ...game.tags]
    .join(" ")
    .toLowerCase();
}

export function searchGames(games: GameRecord[], query: string): GameRecord[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return games;
  return games.filter((g) => {
    const h = haystack(g);
    return tokens.every((t) => h.includes(t));
  });
}

export function filterGames(games: GameRecord[], opts: { query?: string; facet?: string | null }): GameRecord[] {
  let out = games;
  if (opts.facet && opts.facet !== "ALL") out = out.filter((g) => gameMatchesFacet(g, opts.facet as string));
  if (opts.query) out = searchGames(out, opts.query);
  return out;
}

export function findGame(games: GameRecord[], id: string): GameRecord | undefined {
  const key = id.toLowerCase();
  return games.find((g) => g.id.toLowerCase() === key);
}

export function isPlayable(game: GameRecord): boolean {
  return game.status === "playable";
}

/** Flagship first, then featured; playable before in-development. */
export function pickFeatured(games: GameRecord[]): GameRecord[] {
  const rank = (g: GameRecord) => (g.flagship ? 0 : 1) + (isPlayable(g) ? 0 : 2);
  return games
    .filter((g) => g.flagship || g.featured)
    .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}

export function sortGames(games: GameRecord[]): GameRecord[] {
  return [...games].sort(
    (a, b) => Number(b.flagship) - Number(a.flagship) || a.title.localeCompare(b.title),
  );
}

/* ------------------------------------------------------------------ *
 * Categories — derived from real metadata only (never a hardcoded list)
 * ------------------------------------------------------------------ */

export interface CategoryGroup {
  key: string;
  label: string;
  count: number;
  games: GameRecord[];
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Group every registered game by its declared `category` field.
 * Returns only categories that actually contain games.
 */
export function groupByCategory(games: GameRecord[]): CategoryGroup[] {
  const map = new Map<string, GameRecord[]>();
  for (const g of games) {
    const key = g.category.trim();
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(g);
    else map.set(key, [g]);
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      label: titleCase(key),
      count: list.length,
      games: [...list].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/* ------------------------------------------------------------------ *
 * Sorting — only ordering options the metadata can actually support
 * ------------------------------------------------------------------ */

export type GameSortMode = "title" | "recent" | "category";

export const GAME_SORT_MODES: readonly GameSortMode[] = ["title", "recent", "category"] as const;

/**
 * Sort registered games.
 * - `title`    → alphabetical
 * - `recent`   → newest release date first (games without a date sort last)
 * - `category` → category, then title
 */
export function sortByMode(games: GameRecord[], mode: GameSortMode): GameRecord[] {
  const out = [...games];
  switch (mode) {
    case "recent": {
      const stamp = (g: GameRecord) => {
        const t = g.releaseDate ? Date.parse(g.releaseDate) : NaN;
        return Number.isNaN(t) ? -Infinity : t;
      };
      return out.sort(
        (a, b) => stamp(b) - stamp(a) || a.title.localeCompare(b.title),
      );
    }
    case "category":
      return out.sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
      );
    case "title":
    default:
      return out.sort((a, b) => a.title.localeCompare(b.title));
  }
}

/* ------------------------------------------------------------------ *
 * Random pick — genuine randomness over the registry, never a fixed list
 * ------------------------------------------------------------------ */

/**
 * Games that can actually be entered right now.
 * Anything that is not playable cannot be launched, so it is never a candidate.
 */
export function eligibleForRandom(games: GameRecord[]): GameRecord[] {
  return games.filter(isPlayable);
}

/**
 * Pick one random eligible game.
 * `rng` is injectable so the behaviour can be tested deterministically.
 */
export function pickRandomGame(
  games: GameRecord[],
  rng: () => number = Math.random,
): GameRecord | null {
  const eligible = eligibleForRandom(games);
  if (eligible.length === 0) return null;
  const index = Math.floor(rng() * eligible.length);
  const safeIndex = Number.isFinite(index)
    ? Math.min(eligible.length - 1, Math.max(0, index))
    : 0;
  return eligible[safeIndex];
}
