import type { GameMetadata } from "./types";

/** Visual representation of a game's world, derived from its metadata only. */
export type PortalKind =
  | "planet"
  | "racing"
  | "sky"
  | "fortress"
  | "corrupted"
  | "shooter"
  | "magic"
  | "arcade"
  | "cosmic";

export interface GameTheme {
  kind: PortalKind;
  primary: string;
  secondary: string;
  world: string;
}

const RULES: Array<[PortalKind, RegExp]> = [
  ["corrupted", /horror|zombie|undead|dark|survival|nightmare|corrupt/],
  ["racing", /racing|race|drift|speed|car\b|kart|motor/],
  ["sky", /flight|flying|sky|aerial|air\b|plane|jet|pilot/],
  ["fortress", /strategy|tower|fortress|rts|castle|kingdom|tactic/],
  ["shooter", /shoot|fps|military|war|gun|sniper|tank|combat/],
  ["magic", /fantasy|magic|rpg|wizard|mystic|spell/],
  ["planet", /adventure|explor|open.?world|beast|wasteland|planet|survival/],
  ["arcade", /arcade|puzzle|platform|retro|casual|2d|pixel|dodge/],
];

const PALETTES: Record<PortalKind, { primary: string; secondary: string; world: string }> = {
  planet: { primary: "#3fe0a0", secondary: "#38c8ff", world: "Planetary World" },
  racing: { primary: "#ff3df2", secondary: "#38e8ff", world: "Neon Speedway" },
  sky: { primary: "#6fb7ff", secondary: "#c9e6ff", world: "Sky Base" },
  fortress: { primary: "#ffb24d", secondary: "#ff6a3d", world: "Floating Fortress" },
  corrupted: { primary: "#ff2d55", secondary: "#8b1d6b", world: "Corrupted Zone" },
  shooter: { primary: "#ff7a2d", secondary: "#ffd24d", world: "Industrial Outpost" },
  magic: { primary: "#b07cff", secondary: "#ff8ae6", world: "Arcane Realm" },
  arcade: { primary: "#38e8ff", secondary: "#ffe14d", world: "Arcade Cube" },
  cosmic: { primary: "#8b9cff", secondary: "#38e8ff", world: "Cosmic Node" },
};

export function getPortalKind(game: Pick<GameMetadata, "genre" | "category" | "tags" | "title">): PortalKind {
  const text = [game.genre, game.category, ...game.tags, game.title].join(" ").toLowerCase();
  for (const [kind, re] of RULES) if (re.test(text)) return kind;
  return "cosmic";
}

export function getGameTheme(game: Pick<GameMetadata, "genre" | "category" | "tags" | "title">): GameTheme {
  const kind = getPortalKind(game);
  return { kind, ...PALETTES[kind] };
}

/** FNV-1a — deterministic string hash used for stable procedural placement/visuals. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function statusLabel(status: GameMetadata["status"]): string {
  switch (status) {
    case "playable":
      return "PLAYABLE";
    case "development":
      return "IN DEVELOPMENT";
    case "coming-soon":
      return "COMING SOON";
  }
}
