import { useEffect, useRef } from "react";
import { Game, type GameApi, type GameCallbacks } from "../game/Game";

export default function GameCanvas({
  onHud,
  onToast,
  onEvent,
  onReady,
}: GameCallbacks & { onReady: (api: GameApi) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let game: Game | null = null;
    try {
      game = new Game(host, { onHud, onToast, onEvent });
      readyRef.current(game.getApi());
    } catch (err) {
      console.error("Havoc City failed to start", err);
      onToast({
        title: "WebGL unavailable",
        body: "This browser could not start the 3D engine. Try enabling hardware acceleration.",
        tone: "danger",
      });
    }
    return () => {
      game?.getApi().dispose();
      game = null;
    };
    // The engine is created exactly once for the lifetime of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="absolute inset-0 h-full w-full overflow-hidden bg-[#07090b]" />;
}
