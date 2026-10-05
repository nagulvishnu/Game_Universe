import generated from "./games.generated.json";
import type { DiscoveryReport } from "../types";
import { deriveFacets, findGame, pickFeatured, sortGames } from "./registry";

/**
 * Build-time registry. `games.generated.json` is written by the discovery pipeline
 * (runs automatically on `next dev` / `next build`, or manually via `npm run discover-games`).
 */
const report = generated as unknown as DiscoveryReport;

export const discoveryReport: DiscoveryReport = report;
export const games = sortGames(report.games ?? []);
export const facets = deriveFacets(games);
export const featured = pickFeatured(games);
export const getGame = (id: string) => findGame(games, id);

export * from "./registry";
