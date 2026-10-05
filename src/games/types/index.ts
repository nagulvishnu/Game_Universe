/**
 * Game contract types.
 *
 * `GameMetadata` is what a game declares in its `game.json`.
 * `GameRecord` is what the hub works with after discovery (metadata + resolved URLs).
 */

export const GAME_STATUSES = ["playable", "development", "coming-soon"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export interface GameMetadata {
  id: string;
  title: string;
  description: string;
  genre: string;
  category: string;
  entry: string;
  thumbnail?: string;
  banner?: string;
  version?: string;
  tags: string[];
  controls: string[];
  featured: boolean;
  status: GameStatus;
  developer?: string;
  releaseDate?: string;
  /** Premium flagship game (AI Beast World is flagged automatically). */
  flagship?: boolean;
  /** Marks a development/demo game so the hub labels it honestly. */
  demo?: boolean;
}

export interface GameRecord extends GameMetadata {
  /** Folder name inside /games */
  folder: string;
  /** URL the launcher loads (same-origin /play/... or a remote URL) */
  launchUrl: string;
  /** True when launchUrl points to another origin */
  external: boolean;
  thumbnailUrl: string | null;
  bannerUrl: string | null;
  flagship: boolean;
}

export type DiagnosticLevel = "ok" | "warning" | "error";

export interface DiscoveryDiagnostic {
  folder: string;
  id?: string;
  title?: string;
  level: DiagnosticLevel;
  messages: string[];
}

export interface DiscoveryReport {
  games: GameRecord[];
  diagnostics: DiscoveryDiagnostic[];
}

export interface ValidationResult {
  ok: boolean;
  metadata?: GameMetadata;
  errors: string[];
  warnings: string[];
}
