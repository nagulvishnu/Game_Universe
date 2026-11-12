import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { PieceDefs } from "./chess/pieces";
import { useStore } from "./chess/store";
import { themeById } from "./chess/themes";
import { configureAudio, setMusic, sfx } from "./chess/audio";
import type { GameConfig } from "./chess/useGame";
import { Menu } from "./screens/Menu";
import { Setup } from "./screens/Setup";
import { GameScreen } from "./screens/GameScreen";
import { Puzzles } from "./screens/Puzzles";
import { Training } from "./screens/Training";
import { Openings } from "./screens/Openings";
import { Stats } from "./screens/Stats";
import { Settings } from "./screens/Settings";
import "./chess/board.css";
import "./ui.css";

export type Route =
  | { name: "menu" }
  | { name: "setup"; kind: "local" | "ai" | "time"; blindfold?: boolean }
  | { name: "game"; cfg: GameConfig; n: number }
  | { name: "puzzles"; mode: "library" | "daily" | "rush" | "survival" }
  | { name: "training" } | { name: "openings" } | { name: "stats" } | { name: "settings" };

export default function App() {
  const settings = useStore((s) => s.settings);
  const [route, setRoute] = useState<Route>({ name: "menu" });
  const theme = themeById(settings.boardTheme);
  const go = (r: Route) => { window.scrollTo(0, 0); setRoute(r); };
  const menu = () => go({ name: "menu" });

  useEffect(() => { configureAudio(settings.sound, settings.volume); }, [settings.sound, settings.volume]);
  useEffect(() => { setMusic(settings.music); }, [settings.music]);
  useEffect(() => { // browsers block audio until a gesture
    const start = () => { if (useStore.getState().settings.music) setMusic(true); };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, []);

  const style = { "--accent": theme.accent, "--accent2": theme.accent2, "--page": theme.page } as CSSProperties;

  const newGame = (cfg: GameConfig) => go({ name: "game", cfg, n: Date.now() });
  const rematch = (cfg: GameConfig) => {
    if (cfg.opponent === "ai" && !cfg.imported) {
      const hc = cfg.humanColor === "w" ? "b" : "w";
      newGame({ ...cfg, humanColor: hc, names: { w: cfg.names.b, b: cfg.names.w } });
    } else newGame({ ...cfg, pgn: undefined, imported: false });
  };

  return (
    <div className="ci-app" data-mode={settings.uiMode} style={style} onClickCapture={(e) => { if ((e.target as HTMLElement).closest("button.ci-btn, button.ci-opt, button.ci-card")) sfx.click(); }}>
      <PieceDefs />
      {route.name === "menu" && <Menu go={go} />}
      {route.name === "setup" && <Setup kind={route.kind} blindfold={route.blindfold} back={menu} start={newGame} />}
      {route.name === "game" && (
        <GameScreen key={route.n} cfg={route.cfg} onExit={menu} onRematch={() => rematch(route.cfg)} onNewGame={() => go({ name: "setup", kind: route.cfg.kind })} onStart={newGame} />
      )}
      {route.name === "puzzles" && <Puzzles key={route.mode} mode={route.mode} back={menu} />}
      {route.name === "training" && <Training back={menu} />}
      {route.name === "openings" && <Openings back={menu} />}
      {route.name === "stats" && <Stats back={menu} />}
      {route.name === "settings" && <Settings back={menu} />}
    </div>
  );
}
