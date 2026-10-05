import fs from "node:fs";
import path from "node:path";
import { discoverGames, formatReport, syncGameAssets } from "./discover";
import type { DiscoveryReport } from "../types";

export const GENERATED_FILE = path.join("src", "games", "registry", "games.generated.json");

/**
 * Full discovery pipeline:
 *   /games/*  →  validate  →  src/games/registry/games.generated.json
 *                          →  public/play/<folder> (static serving copy)
 */
export function runDiscovery(root: string, opts: { quiet?: boolean } = {}): DiscoveryReport {
  const gamesDir = path.join(root, "games");
  const gamesExist = fs.existsSync(gamesDir);
  const report = discoverGames({ gamesDir });

  const out = path.join(root, GENERATED_FILE);
  const next = JSON.stringify(report, null, 2) + "\n";
  let prev = "";
  try {
    prev = fs.readFileSync(out, "utf8");
  } catch {
    /* first run */
  }
  if (prev !== next) {
    try {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, next);
    } catch (err) {
      // Registry write must never crash boot — log and continue with in-memory report.
      console.error("[GameUniverse] could not write games.generated.json:", err);
    }
  }

  // Never wipe public/play when /games is absent (e.g. `next start` on a host
  // without game sources, or concurrent config loads). Built assets stay intact.
  if (!gamesExist) {
    if (!opts.quiet) console.log(formatReport(report));
    return report;
  }

  syncGameAssets(report, gamesDir, path.join(root, "public", "play"));

  if (!opts.quiet) console.log(formatReport(report));
  return report;
}
