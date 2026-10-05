import type { GameRecord } from "@/games/types";

export function makeGame(partial: Partial<GameRecord> & { id: string }): GameRecord {
  return {
    title: partial.id.toUpperCase(),
    description: "A test game.",
    genre: "Arcade",
    category: "2D",
    entry: "index.html",
    tags: [],
    controls: [],
    featured: false,
    status: "playable",
    folder: partial.id,
    launchUrl: `/play/${partial.id}/index.html`,
    external: false,
    thumbnailUrl: null,
    bannerUrl: null,
    flagship: false,
    ...partial,
  };
}

export const SAMPLE_GAMES: GameRecord[] = [
  makeGame({
    id: "ai-beast-world",
    title: "AI Beast World",
    genre: "Adventure",
    category: "3D",
    tags: ["3D", "Adventure", "Action"],
    description: "A cinematic 3D adventure through a dangerous world.",
    featured: true,
    flagship: true,
  }),
  makeGame({
    id: "neon-velocity",
    title: "Neon Velocity",
    genre: "Racing",
    category: "3D",
    tags: ["3D", "Racing", "Speed"],
    description: "Drift through neon cities.",
  }),
  makeGame({
    id: "zombie-defense",
    title: "Zombie Defense",
    genre: "Strategy",
    category: "2D",
    tags: ["Horror", "Tower Defense"],
    description: "Hold the line.",
    status: "development",
  }),
];
