import fs from "node:fs";
import path from "node:path";
import { dedupeGames } from "../registry/registry";
import type { DiscoveryDiagnostic, DiscoveryReport, GameRecord } from "../types";
import { isRemoteUrl, validateGameMetadata } from "./validate";

export interface DiscoverOptions {
  /** Absolute path to the /games directory */
  gamesDir: string;
  /** URL prefix games are served from. Default: /play */
  baseUrl?: string;
}

const IMAGE_EXTS = ["webp", "png", "jpg", "jpeg", "avif", "svg", "gif"];
const FLAGSHIP_IDS = new Set(["ai-beast-world"]);

function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

function fileExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Resolve an image declared in game.json, or auto-detect `<name>.<ext>`. */
function resolveImage(
  dir: string,
  declared: string | undefined,
  autoName: string,
  label: string,
  warnings: string[],
): string | null {
  if (declared) {
    if (isRemoteUrl(declared)) return declared;
    const clean = declared.replace(/\\/g, "/").replace(/^\.\//, "");
    const abs = path.resolve(dir, clean);
    if (!abs.startsWith(path.resolve(dir) + path.sep) || !fileExists(abs)) {
      warnings.push(`Missing ${label} "${declared}" — using generated fallback art`);
    } else {
      return clean;
    }
  }
  for (const ext of IMAGE_EXTS) {
    if (fileExists(path.join(dir, `${autoName}.${ext}`))) return `${autoName}.${ext}`;
  }
  if (!declared && label === "thumbnail") warnings.push('No thumbnail declared or found — using generated fallback art');
  return null;
}

/**
 * Scan /games, validate every folder, and build a report.
 * Never throws for a bad game — invalid games are skipped with a diagnostic.
 */
export function discoverGames(opts: DiscoverOptions): DiscoveryReport {
  const baseUrl = (opts.baseUrl ?? "/play").replace(/\/$/, "");
  const diagnostics: DiscoveryDiagnostic[] = [];
  const records: GameRecord[] = [];

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(opts.gamesDir, { withFileTypes: true });
  } catch {
    return { games: [], diagnostics: [] };
  }

  const folders = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_") && e.name !== "node_modules")
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  for (const folder of folders) {
    const dir = path.join(opts.gamesDir, folder);
    const manifest = path.join(dir, "game.json");

    if (!fileExists(manifest)) {
      diagnostics.push({ folder, level: "error", messages: ["Missing game.json — folder skipped"] });
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(manifest, "utf8"));
    } catch (err) {
      diagnostics.push({
        folder,
        level: "error",
        messages: [`game.json is not valid JSON (${err instanceof Error ? err.message : "parse error"})`],
      });
      continue;
    }

    const result = validateGameMetadata(raw);
    if (!result.ok || !result.metadata) {
      const r = raw as { id?: unknown; title?: unknown } | null;
      diagnostics.push({
        folder,
        id: typeof r?.id === "string" ? r.id : undefined,
        title: typeof r?.title === "string" ? r.title : undefined,
        level: "error",
        messages: [...result.errors, "Game skipped"],
      });
      continue;
    }

    const meta = result.metadata;
    const messages = [...result.warnings];
    const external = isRemoteUrl(meta.entry);

    if (!external && !fileExists(path.resolve(dir, meta.entry))) {
      diagnostics.push({
        folder,
        id: meta.id,
        title: meta.title,
        level: "error",
        messages: [`Entry file "${meta.entry}" not found — game skipped`],
      });
      continue;
    }

    const thumb = resolveImage(dir, meta.thumbnail, "thumbnail", "thumbnail", messages);
    const banner = resolveImage(dir, meta.banner, "banner", "banner", []);
    const toUrl = (rel: string | null) =>
      rel === null ? null : isRemoteUrl(rel) ? rel : `${baseUrl}/${encodeURIComponent(folder)}/${encodePath(rel)}`;

    records.push({
      ...meta,
      thumbnail: thumb ?? undefined,
      banner: banner ?? undefined,
      folder,
      external,
      launchUrl: external ? meta.entry : `${baseUrl}/${encodeURIComponent(folder)}/${encodePath(meta.entry)}`,
      thumbnailUrl: toUrl(thumb),
      bannerUrl: toUrl(banner),
      flagship: meta.flagship ?? FLAGSHIP_IDS.has(meta.id.toLowerCase()),
    });
    diagnostics.push({
      folder,
      id: meta.id,
      title: meta.title,
      level: messages.length > 0 ? "warning" : "ok",
      messages,
    });
  }

  const { games, duplicates } = dedupeGames(records);
  for (const d of duplicates) {
    const diag = diagnostics.find((x) => x.folder === d.folder);
    if (diag) {
      diag.level = "error";
      diag.messages = [`Duplicate id "${d.id}" — game skipped (first folder wins)`];
    }
  }

  return { games, diagnostics };
}

/** Copy every discovered local game to <publicDir>/<folder> so it is served statically. */
export function syncGameAssets(report: DiscoveryReport, gamesDir: string, publicPlayDir: string): void {
  // Defensive: if source games are missing (prod `next start` without /games),
  // never delete the already-built public/play output.
  try {
    if (!fs.statSync(gamesDir).isDirectory()) return;
  } catch {
    return;
  }
  // Write to a temp dir then swap — avoids half-wiped output if two processes run at once.
  const tmpDir = `${publicPlayDir}.tmp-${process.pid}`;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  for (const g of report.games) {
    if (g.external) continue;
    // Skip folders that vanished between discovery and sync.
    const srcDir = path.join(gamesDir, g.folder);
    try {
      if (!fs.statSync(srcDir).isDirectory()) continue;
    } catch {
      continue;
    }
    fs.cpSync(srcDir, path.join(tmpDir, g.folder), {
      recursive: true,
      filter: (src) => {
        const base = path.basename(src);
        return base !== "node_modules" && base !== ".git" && base !== ".DS_Store";
      },
    });
  }
  fs.rmSync(publicPlayDir, { recursive: true, force: true });
  fs.renameSync(tmpDir, publicPlayDir);
}

export function formatReport(report: DiscoveryReport): string {
  const lines: string[] = ["", "Game Discovery", ""];
  if (report.diagnostics.length === 0) {
    lines.push("  (no game folders found in /games)");
  }
  for (const d of report.diagnostics) {
    const name = d.title ?? d.folder;
    const icon = d.level === "ok" ? "✓" : d.level === "warning" ? "⚠" : "✗";
    lines.push(`${icon} ${name}${d.title && d.folder !== d.title ? `  (${d.folder})` : ""}`);
    for (const m of d.messages) lines.push(`    ${m}`);
  }
  lines.push("", `${report.games.length} game(s) registered`, "");
  return lines.join("\n");
}
