import type { GameRecord } from "@/games/types";
import { statusLabel } from "@/games/theme";

export function StatusBadge({ game }: { game: GameRecord }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <span className={`gu-badge gu-badge--${game.status}`}>{statusLabel(game.status)}</span>
      {game.demo && <span className="gu-badge gu-badge--demo">Demo</span>}
    </span>
  );
}
