import { useCallback, useEffect, useRef, useState } from "react";
import { Mode, RaceSettings, TRACKS, carById, trackById } from "./game/data";
import { host } from "./game/host";
import { input } from "./game/input";
import { audio } from "./game/audio";
import { store, useSave } from "./game/store";
import { Race, RaceConfig, RaceResult, awardResults } from "./game/race";
import { ChampState, POINTS, Screen, getShowroom, hudStore, setupFor } from "./ui/shared";
import Menu, { MenuPick } from "./ui/Menu";
import Setup from "./ui/Setup";
import Garage from "./ui/Garage";
import Hud from "./ui/Hud";
import { ChampScreen, Results } from "./ui/Results";
import Settings, { Credits } from "./ui/Settings";
import { Btn } from "./ui/kit";

export default function App() {
  const mount = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("quick");
  const [settings, setSettings] = useState<RaceSettings>({ track: "tokyo", laps: 3, tod: "auto", weather: "auto" });
  const [garageP, setGarageP] = useState(0);
  const [garageBack, setGarageBack] = useState<Screen>("menu");
  const [result, setResult] = useState<RaceResult | null>(null);
  const [champ, setChamp] = useState<ChampState | null>(null);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const save = useSave();
  const raceRef = useRef<Race | null>(null);
  const screenRef = useRef<Screen>("menu");
  const pausedRef = useRef(false);
  const champRef = useRef<ChampState | null>(null);
  const modeRef = useRef<Mode>("quick");
  screenRef.current = screen;
  pausedRef.current = paused;
  champRef.current = champ;
  modeRef.current = mode;

  // boot renderer + input
  useEffect(() => {
    host.init(mount.current!);
    input.init();
    const s = store.get().settings;
    host.setResolution(s.gfx.res);
    audio.setVolumes(s.music, s.sfx);
    getShowroom();
    host.setScene(getShowroom());
  }, []);

  const go = useCallback((s: Screen) => {
    setScreen(s);
  }, []);

  const finishRace = useCallback((res: RaceResult) => {
    awardResults(res);
    if (modeRef.current === "championship" && champRef.current) {
      const c = champRef.current;
      const byIdx = [res.players.find((p) => p.idx === 0)!, res.players.find((p) => p.idx === 1)!];
      const pts: [number, number] = [POINTS[byIdx[0].position - 1] ?? 0, POINTS[byIdx[1].position - 1] ?? 0];
      const next: ChampState = {
        ...c,
        points: [c.points[0] + pts[0], c.points[1] + pts[1]],
        history: [...c.history, { track: res.track, pos: [byIdx[0].position, byIdx[1].position], pts }],
      };
      if (c.round + 1 >= c.total) {
        next.done = true;
        if (next.points[0] !== next.points[1]) {
          const w = next.points[0] > next.points[1] ? 0 : 1;
          store.update((d) => { d.profiles[w].money += 3000; });
        }
      }
      champRef.current = next;
      setChamp(next);
    }
    setResult(res);
    setScreen("results");
    setPaused(false);
  }, []);

  const startRace = useCallback((s: RaceSettings, m: Mode, round?: number, rounds?: number) => {
    setLoading(true);
    audio.unlock();
    audio.stopMusic();
    requestAnimationFrame(() => setTimeout(() => {
      try {
        host.setScene(null); // dispose the previous race before creating the next one
        raceRef.current = null;
        const gfx = store.get().settings.gfx;
        host.setResolution(gfx.res);
        hudStore.set(null);
        const cfg: RaceConfig = { mode: m, settings: s, players: [setupFor(0), setupFor(1)], gfx, round, rounds };
        const race = new Race(cfg, hudStore.set, finishRace);
        raceRef.current = race;
        host.setScene(race);
        setPaused(false);
        setScreen("race");
      } catch (e) {
        console.error(e);
        alert("Failed to start race: " + (e as Error).message);
        setScreen("menu");
      }
      setLoading(false);
    }, 30));
  }, [finishRace]);

  // pause handling
  useEffect(() => {
    input.onEscape = () => {
      if (screenRef.current !== "race" || !raceRef.current) return;
      const r = raceRef.current;
      if (r.phase === "finished") return;
      const np = !pausedRef.current;
      r.pause(np);
      setPaused(np);
    };
    return () => { input.onEscape = null; };
  }, []);

  const pick = (p: MenuPick) => {
    if (p === "garage") { setGarageBack("menu"); setGarageP(0); go("garage"); return; }
    if (p === "settings") { go("settings"); return; }
    if (p === "credits") { go("credits"); return; }
    setMode(p);
    modeRef.current = p;
    setSettings((s) => ({ ...s, laps: p === "championship" ? 2 : trackById(s.track).laps }));
    go("setup");
  };

  const beginFromSetup = () => {
    if (mode === "championship") {
      const first = TRACKS[0];
      const c: ChampState = { round: 0, total: TRACKS.length, points: [0, 0], history: [], settings: { ...settings }, done: false };
      champRef.current = c;
      setChamp(c);
      startRace({ ...settings, track: first.id }, "championship", 0, TRACKS.length);
    } else startRace(settings, mode);
  };

  const rematch = () => {
    const r = raceRef.current;
    if (r) startRace(settings, mode, r.cfg.round, r.cfg.rounds);
    else startRace(settings, mode);
  };
  const nextRound = () => {
    const c = champRef.current;
    if (!c) return;
    const nc = { ...c, round: c.round + 1 };
    champRef.current = nc;
    setChamp(nc);
    startRace({ ...c.settings, track: TRACKS[nc.round].id }, "championship", nc.round, nc.total);
  };
  const quitToMenu = () => {
    host.setScene(getShowroom());
    raceRef.current = null;
    hudStore.set(null);
    setPaused(false);
    setChamp(null);
    champRef.current = null;
    go("menu");
  };

  const splash = !started;
  const race = raceRef.current;
  const gfx = save.settings.gfx;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#04050c] text-white">
      <div ref={mount} className="absolute inset-0" />
      {splash && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center cursor-pointer" style={{ background: "radial-gradient(circle at 50% 40%, rgba(23,224,255,0.18), rgba(4,5,12,0.96) 60%)" }} onClick={() => { audio.unlock(); setStarted(true); }}>
          <div className="font-display font-black italic text-center logo-grad leading-[0.9]" style={{ fontSize: "clamp(48px,10vw,130px)", filter: "drop-shadow(0 0 30px rgba(23,224,255,0.6))" }}>TURBO<br />MASTERS</div>
          <div className="mt-5 font-display tracking-[0.4em] text-xs md:text-sm uppercase text-pink-300">Local 2-player anime racing</div>
          <div className="mt-12 font-display tracking-[0.3em] uppercase text-cyan-100 blink">Click or press any key to start</div>
          <KeyStart onStart={() => { audio.unlock(); setStarted(true); }} />
        </div>
      )}
      {started && screen === "menu" && <Menu onPick={pick} />}
      {started && screen === "setup" && <Setup mode={mode} settings={settings} setSettings={setSettings} onBack={() => go("menu")} onStart={beginFromSetup} onGarage={(p) => { setGarageP(p); setGarageBack("setup"); go("garage"); }} />}
      {started && screen === "garage" && <Garage player={garageP} setPlayer={setGarageP} onBack={() => go(garageBack)} />}
      {started && screen === "settings" && <Settings onBack={() => go("menu")} />}
      {started && screen === "credits" && <Credits onBack={() => go("menu")} />}
      {screen === "race" && race && (
        <>
          <Hud getMap={() => race.getMap()} getRects={() => race.getRects()} getCars={() => race.cars.map((c) => c.def.id)} gfx={gfx} />
          {paused && (
            <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(2,3,10,0.72)", backdropFilter: "blur(4px)" }}>
              <div className="glass chamfer p-8 min-w-[340px] flex flex-col gap-3 anim-up">
                <div className="font-display font-black italic text-4xl text-center text-white text-glow">PAUSED</div>
                <Btn variant="solid" onClick={() => { race.pause(false); setPaused(false); }}>Resume</Btn>
                <Btn onClick={() => { setPaused(false); startRace(race.cfg.settings, race.cfg.mode, race.cfg.round, race.cfg.rounds); }}>Restart race</Btn>
                <Btn variant="danger" onClick={quitToMenu}>Quit to menu</Btn>
                <div className="text-center text-[11px] text-slate-400 uppercase tracking-widest mt-1">Esc / P to resume</div>
              </div>
            </div>
          )}
        </>
      )}
      {started && screen === "results" && result && <Results result={result} champ={mode === "championship" ? champ : null} onRematch={rematch} onNext={() => go("champ")} onSetup={() => go("setup")} onMenu={quitToMenu} />}
      {started && screen === "champ" && champ && <ChampScreen champ={champ} onNext={nextRound} onMenu={quitToMenu} />}
      {loading && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center" style={{ background: "radial-gradient(circle, rgba(8,12,30,0.96), rgba(2,3,8,0.99))" }}>
          <div className="font-display font-black italic text-3xl text-cyan-200 text-glow">LOADING TRACK</div>
          <div className="mt-4 w-64 h-1.5 bg-white/10 overflow-hidden"><div className="h-full w-1/2 bg-cyan-300" style={{ animation: "shine 1s linear infinite", background: "linear-gradient(90deg,transparent,#17e0ff,transparent)", backgroundSize: "200% 100%" }} /></div>
          <div className="mt-3 text-xs uppercase tracking-widest text-slate-400">{trackById(settings.track).name} · {carById(store.get().profiles[0].selected).name} vs {carById(store.get().profiles[1].selected).name}</div>
        </div>
      )}
    </div>
  );
}

function KeyStart({ onStart }: { onStart: () => void }) {
  useEffect(() => {
    const h = () => onStart();
    window.addEventListener("keydown", h, { once: true });
    return () => window.removeEventListener("keydown", h);
  }, [onStart]);
  return null;
}
