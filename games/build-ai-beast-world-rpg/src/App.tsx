import { useEffect, useRef, useState } from "react";
import { Game, type Hud } from "./game/game";
import { HudView } from "./ui/Hud";
import { StartScreen, PauseScreen, DeadScreen, VictoryScreen } from "./ui/Screens";
import { MenuView } from "./ui/Menu";
import { loadSettings } from "./game/store";
import { audio } from "./game/audio";
import { input } from "./game/input";

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let g: Game | null = null;
    try {
      const s = loadSettings();
      audio.muted = s.muted; audio.volume = s.vol; input.sens = s.sens;
      g = new Game(host.current!);
      g.onHud = setHud;
      (window as unknown as { __game: Game }).__game = g;
      setGame(g);
    } catch (e) { console.error(e); setErr(String(e)); }
    return () => { g?.dispose(); };
  }, []);

  const screen = hud?.screen ?? "start";
  return (
    <div className="fixed inset-0 overflow-hidden bg-black" style={{ touchAction: "none" }}>
      <div ref={host} className="absolute inset-0" />
      {err && <div className="absolute inset-0 flex items-center justify-center text-center p-8"><div className="panel p-6 max-w-md"><div className="font-title text-2xl mb-2">WebGL unavailable</div><div className="opacity-80 text-sm">AI BEAST WORLD needs WebGL to render its world. {err}</div></div></div>}
      {game && hud && screen !== "start" && <HudView hud={hud} game={game} />}
      {game && hud && screen === "start" && <StartScreen game={game} />}
      {game && hud && screen === "pause" && <PauseScreen game={game} hud={hud} />}
      {game && hud && screen === "menu" && <MenuView game={game} />}
      {game && hud && screen === "dead" && <DeadScreen game={game} hud={hud} />}
      {game && hud && screen === "victory" && <VictoryScreen game={game} hud={hud} />}
      {!game && !err && <div className="absolute inset-0 flex items-center justify-center font-title tracking-[.4em] text-xl animate-pulse" style={{ color: "#ffd98a" }}>FORGING THE WORLD…</div>}
    </div>
  );
}
