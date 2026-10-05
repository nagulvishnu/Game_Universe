import type { Metadata } from "next";
import { GameLauncher } from "@/components/launcher/GameLauncher";
import { games, getGame } from "@/games/registry";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return games.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(decodeURIComponent(id));
  return { title: game ? `Playing ${game.title}` : "Game unavailable" };
}

// Dynamic route: any registered game resolves from the registry — no per-game routes.
export default async function GamePage({ params }: Props) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const game = getGame(decoded) ?? null;
  return <GameLauncher game={game} requestedId={decoded} />;
}
