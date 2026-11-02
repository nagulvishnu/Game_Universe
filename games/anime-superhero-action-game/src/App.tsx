import { useEffect } from "react";
import Game from "./Game";
import Hud from "./ui/Hud";
import { MainMenu, CharacterSelect, Settings, Info, Pause, Upgrades, MissionLog, Dead } from "./ui/Menus";
import { useGame } from "./store";
import { initAudio } from "./game/audio";

export default function App() {
  const screen = useGame((s) => s.screen);
  useEffect(() => {
    const h = () => initAudio();
    window.addEventListener("pointerdown", h);
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("pointerdown", h); window.removeEventListener("keydown", h); };
  }, []);
  const playing = screen === "playing" || screen === "dead";
  return (
    <div className={`fixed inset-0 overflow-hidden bg-black text-white ${screen === "playing" ? "cursor-none" : ""}`}>
      <Game />
      {(playing || screen === "paused") && <Hud />}
      {screen === "menu" && <MainMenu />}
      {screen === "select" && <CharacterSelect />}
      {screen === "settings" && <Settings />}
      {screen === "info" && <Info />}
      {screen === "paused" && <Pause />}
      {screen === "upgrades" && <Upgrades />}
      {screen === "missions" && <MissionLog />}
      {screen === "dead" && <Dead />}
    </div>
  );
}
