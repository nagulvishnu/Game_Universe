import { useEffect } from "react";
import { useApp } from "./game/store";
import { input } from "./game/input";
import { audio } from "./game/audio";
import GameView from "./ui/GameView";
import { Boot, MainMenu, ModeSelect, Gallery, Settings, Credits } from "./ui/Screens";
import Select from "./ui/Select";
import { Versus, HUD, Results, Champion } from "./ui/Match";

export default function App() {
  const screen = useApp((s) => s.screen);
  const mode = useApp((s) => s.mode);
  const matches = useApp((s) => s.tourney.match);
  const settings = useApp((s) => s.settings);

  useEffect(() => {
    input.attach();
    audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx });
    const unlock = () => audio.init();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen !== "boot" && screen !== "versus" && screen !== "game") audio.music("menu");
    if (screen !== "game" && screen !== "versus") audio.stopAmbience();
  }, [screen]);

  // debug hook for automated verification
  useEffect(() => { (window as unknown as { __app: typeof useApp }).__app = useApp; }, []);

  const inMatch = screen === "versus" || screen === "game";
  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {inMatch && <GameView begin={screen === "game"} />}
      {screen === "game" && <HUD />}
      {screen === "versus" && <div className="absolute inset-0 z-20"><Versus /></div>}
      {screen === "boot" && <Boot />}
      {screen === "menu" && <MainMenu />}
      {screen === "modes" && <ModeSelect />}
      {screen === "select" && <Select key={`${mode}-${matches}`} />}
      {screen === "gallery" && <Gallery />}
      {screen === "settings" && <Settings />}
      {screen === "credits" && <Credits />}
      {screen === "results" && <Results />}
      {screen === "champion" && <Champion />}
    </div>
  );
}
