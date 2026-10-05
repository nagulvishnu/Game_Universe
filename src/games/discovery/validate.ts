import { GAME_STATUSES } from "../types";
import type { GameMetadata, GameStatus, ValidationResult } from "../types";

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;

export function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function strList(v: unknown, field: string, warnings: string[]): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    warnings.push(`"${field}" should be an array of strings — ignored`);
    return [];
  }
  const out: string[] = [];
  for (const item of v) {
    const s = str(item);
    if (s) out.push(s);
  }
  return out;
}

/**
 * Validate untrusted game.json content.
 * Required: id, title, entry. Everything else degrades gracefully with a warning.
 */
export function validateGameMetadata(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ["game.json must contain a JSON object"], warnings };
  }
  const r = raw as Record<string, unknown>;

  const id = str(r.id);
  if (!id) errors.push('Missing required field "id"');
  else if (!ID_RE.test(id)) errors.push(`Invalid id "${id}" — use letters, numbers, "-" and "_" only`);

  const title = str(r.title);
  if (!title) errors.push('Missing required field "title"');

  let entry = str(r.entry);
  if (!entry) errors.push('Missing required field "entry"');
  else if (isRemoteUrl(entry)) {
    try {
      new URL(entry);
    } catch {
      errors.push(`Invalid entry URL "${entry}"`);
    }
  } else {
    entry = entry.replace(/\\/g, "/").replace(/^\.\//, "");
    if (entry.startsWith("/") || entry.split("/").includes("..")) {
      errors.push(`Invalid entry "${entry}" — must be a relative path inside the game folder`);
    }
  }

  if (errors.length > 0 || !id || !title || !entry) {
    return { ok: false, errors, warnings };
  }

  let description = str(r.description);
  if (!description) {
    warnings.push('Missing "description"');
    description = "No description provided.";
  }

  let genre = str(r.genre);
  let category = str(r.category);
  if (!genre && !category) {
    warnings.push('Missing "genre"/"category" — using "Arcade"');
    genre = "Arcade";
    category = "Arcade";
  }
  genre = genre ?? category ?? "Arcade";
  category = category ?? genre;

  let status: GameStatus = "playable";
  if (r.status !== undefined) {
    const s = str(r.status)?.toLowerCase();
    if (s && (GAME_STATUSES as readonly string[]).includes(s)) status = s as GameStatus;
    else warnings.push(`Unknown status "${String(r.status)}" — using "playable"`);
  }

  let featured = false;
  if (r.featured !== undefined) {
    if (typeof r.featured === "boolean") featured = r.featured;
    else warnings.push('"featured" must be true or false — ignored');
  }

  const optionalBool = (key: "flagship" | "demo"): boolean | undefined => {
    const v = r[key];
    if (v === undefined) return undefined;
    if (typeof v === "boolean") return v;
    warnings.push(`"${key}" must be true or false — ignored`);
    return undefined;
  };

  const metadata: GameMetadata = {
    id,
    title,
    description,
    genre,
    category,
    entry,
    thumbnail: str(r.thumbnail),
    banner: str(r.banner),
    version: str(r.version),
    tags: strList(r.tags, "tags", warnings),
    controls: strList(r.controls, "controls", warnings),
    featured,
    status,
    developer: str(r.developer),
    releaseDate: str(r.releaseDate),
    flagship: optionalBool("flagship"),
    demo: optionalBool("demo"),
  };

  return { ok: true, metadata, errors, warnings };
}
