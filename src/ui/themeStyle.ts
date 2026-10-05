import type { CSSProperties } from "react";
import type { GameMetadata } from "@/games/types";
import { getGameTheme } from "@/games/theme";

type ThemeInput = Pick<GameMetadata, "genre" | "category" | "tags" | "title">;

/** CSS custom properties (--c1/--c2) derived from game metadata. */
export function themeStyle(game: ThemeInput): CSSProperties {
  const t = getGameTheme(game);
  return { "--c1": t.primary, "--c2": t.secondary } as CSSProperties;
}

export function originFromElement(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
