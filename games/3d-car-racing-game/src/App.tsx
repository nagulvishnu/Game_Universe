import { useEffect, useState } from "react";
import { CARS, TRACKS } from "./game/data";
import { CarSelect, Title, TrackSelect } from "./ui/Menus";
import RaceView, { type RaceConfig } from "./ui/RaceView";
import { loadPrefs, savePrefs, type Prefs } from "./ui/storage";

type Screen = "title" | "track" | "car" | "race";

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [prefs, setPrefsState] = useState<Prefs>(() => loadPrefs());
  const [raceKey, setRaceKey] = useState(0);

  const setPrefs = (p: Prefs) => {
    setPrefsState(p);
    savePrefs(p);
  };

  // prevent page scrolling with game keys
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (screen === "race" && [" ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [screen]);

  const config: RaceConfig = {
    track: TRACKS.find((t) => t.id === prefs.trackId) ?? TRACKS[0],
    car: CARS.find((c) => c.id === prefs.carId) ?? CARS[0],
    color: prefs.color,
    laps: prefs.laps,
    aiCount: prefs.aiCount,
    difficulty: prefs.difficulty,
  };

  if (screen === "title") return <Title onStart={() => setScreen("track")} />;
  if (screen === "track") return <TrackSelect prefs={prefs} setPrefs={setPrefs} onNext={() => setScreen("car")} onBack={() => setScreen("title")} />;
  if (screen === "car") return <CarSelect prefs={prefs} setPrefs={setPrefs} onStart={() => { setRaceKey((k) => k + 1); setScreen("race"); }} onBack={() => setScreen("track")} />;
  return <RaceView key={raceKey} config={config} onExit={() => setScreen("car")} onRestart={() => setRaceKey((k) => k + 1)} />;
}
