import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine, type HudSnapshot, type FlightStats } from '@/game/engine';
import { getAircraft } from '@/game/aircraft';
import { CAREER, MISSIONS, getMission, type MissionDef, type MissionResult, type ModeId } from '@/game/missions';
import { defaultSave, loadSave, writeSave, type SaveData, type Settings } from '@/game/save';
import { listenHost, post } from '@/integration';
import { GAME_META } from '@/game/meta';
import { Hud, MiniMap } from '@/ui/Hud';
import {
  ControlsPanel, HangarScreen, HintBar, MainMenu, MissionSelect, Modal, PauseMenu, ResultsScreen, SettingsPanel, TitleScreen, Toasts, type FreeCfg,
} from '@/ui/Menus';

type Screen = 'title' | 'menu' | 'missions' | 'hangar' | 'play';

const ALL_CLASSES = ['airliner', 'fighter', 'cargo', 'business', 'helicopter', 'prop'] as const;

function freeMission(cfg: FreeCfg): MissionDef {
  return {
    id: 'free', mode: 'free', kind: 'free', title: 'Free Flight', brief: '', difficulty: 1, reward: 0, allowed: [...ALL_CLASSES], recommended: 'sparrow172',
    weather: cfg.weather, hour: cfg.hour, start: { airport: cfg.airport },
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  saveRef.current = save;
  const [screen, setScreen] = useState<Screen>('title');
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const [mode, setMode] = useState<ModeId>('free');
  const [mission, setMission] = useState<MissionDef | null>(null);
  const missionRef = useRef<MissionDef | null>(null);
  missionRef.current = mission;
  const [freeCfg, setFreeCfg] = useState<FreeCfg>({ airport: 'SKY', weather: 'clear', hour: 10, dynamic: false });
  const freeRef = useRef(freeCfg);
  freeRef.current = freeCfg;
  const [aircraftId, setAircraftId] = useState(save.lastAircraft);
  const [livery, setLivery] = useState(save.lastLivery);
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const [mapOpen, setMapOpen] = useState(false);
  const [result, setResult] = useState<{ r: MissionResult; stats: FlightStats; def: MissionDef } | null>(null);
  const resultRef = useRef(result);
  resultRef.current = result;
  const [modal, setModal] = useState<'settings' | 'controls' | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: string }[]>([]);
  const [hintOn, setHintOn] = useState(false);
  const toastId = useRef(0);
  const [loading, setLoading] = useState(true);

  const settings = save.settings;

  const updateSave = useCallback((fn: (s: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = fn(prev);
      writeSave(next);
      return next;
    });
  }, []);

  /* ---------------- engine lifecycle ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new GameEngine(canvas, {
      onSnapshot: (s) => setSnap(s),
      onToast: (text, tone) => {
        const id = ++toastId.current;
        setToasts((t) => [...t.slice(-3), { id, text, tone }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
      },
      onEnd: (r, stats, def) => {
        setResult({ r, stats, def });
        post('end', { mission: def.id, success: r.success, score: r.score, stars: r.stars });
        updateSave((s) => {
          const best = { ...s.best };
          if (r.bestKey && r.bestTime && (!best[r.bestKey] || r.bestTime < best[r.bestKey])) best[r.bestKey] = r.bestTime;
          const stars = { ...s.stars };
          if (def.id !== 'free' && r.success) stars[def.id] = Math.max(stars[def.id] ?? 0, r.stars);
          const careerDone = r.success && CAREER.includes(def.id) && !s.careerDone.includes(def.id) ? [...s.careerDone, def.id] : s.careerDone;
          const t = s.totals;
          return {
            ...s, credits: s.credits + r.credits, xp: s.xp + r.xp, best, stars, careerDone,
            totals: {
              flights: t.flights + 1, landings: t.landings + stats.landings, crashes: t.crashes + (stats.crashed ? 1 : 0), distanceKm: t.distanceKm + stats.distanceKm,
              hours: t.hours + stats.time / 3600, maxAlt: Math.max(t.maxAlt, stats.maxAlt), maxSpeed: Math.max(t.maxSpeed, stats.maxSpeed), kills: t.kills + stats.kills, rescues: t.rescues + stats.rescues,
            },
          };
        });
      },
      onPauseRequest: () => {
        if (screenRef.current !== 'play' || resultRef.current) return;
        const p = !pausedRef.current;
        engineRef.current?.setPaused(p);
        setPaused(p);
        if (!p) setModal(null);
      },
      onMapToggle: () => setMapOpen((m) => !m),
    }, saveRef.current.settings);
    engineRef.current = engine;
    engine.resize();
    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);
    const off = listenHost({
      pause: () => { if (screenRef.current === 'play' && !pausedRef.current) { engine.setPaused(true); setPaused(true); } },
      resume: () => { engine.setPaused(false); setPaused(false); },
      mute: (m) => updateSave((s) => ({ ...s, settings: { ...s.settings, muted: m } })),
    });
    const t = setTimeout(() => setLoading(false), 600);
    return () => {
      clearTimeout(t);
      off();
      window.removeEventListener('resize', onResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, [updateSave]);

  useEffect(() => { engineRef.current?.applySettings(settings); }, [settings]);

  const setSettings = (s: Settings) => updateSave((d) => ({ ...d, settings: s }));

  /* ---------------- navigation ---------------- */
  const goMenu = () => {
    engineRef.current?.showMenu();
    setScreen('menu');
    setPaused(false);
    setResult(null);
    setMapOpen(false);
    setModal(null);
    setSnap(null);
  };

  const openHangar = (m: MissionDef | null) => {
    const allowed = m ? m.allowed : [...ALL_CLASSES];
    let id = aircraftId;
    if (m && m.id !== 'free' && m.kind !== 'free') id = m.recommended;
    else if (!allowed.includes(getAircraft(id).cls)) id = m ? m.recommended : id;
    setAircraftId(id);
    engineRef.current?.showHangar(id, livery);
    setScreen('hangar');
  };

  const pickAircraft = (id: string) => {
    setAircraftId(id);
    engineRef.current?.showHangar(id, livery);
  };
  const pickLivery = (i: number) => {
    setLivery(i);
    engineRef.current?.showHangar(aircraftId, i);
  };

  const launch = (m?: MissionDef, acId?: string) => {
    const def = m ?? missionRef.current ?? freeMission(freeRef.current);
    const ac = acId ?? aircraftId;
    updateSave((s) => ({ ...s, lastAircraft: ac, lastLivery: livery }));
    setMission(def);
    setResult(null);
    setPaused(false);
    setMapOpen(false);
    setSnap(null);
    engineRef.current?.startGame({
      aircraftId: ac, liveryIdx: livery, mission: def, settings: saveRef.current.settings,
      airport: def.kind === 'free' ? freeRef.current.airport : undefined, dynamicWeather: def.kind === 'free' && freeRef.current.dynamic,
    });
    setScreen('play');
    setHintOn(true);
    post('start', { mission: def.id, aircraft: ac });
    setTimeout(() => setHintOn(false), 30000);
  };

  const nextMission = (): MissionDef | null => {
    if (!result) return null;
    const cur = result.def;
    if (cur.id === 'free') return null;
    const list = mode === 'career' ? CAREER.map(getMission) : MISSIONS.filter((m) => m.mode === cur.mode);
    const i = list.findIndex((m) => m.id === cur.id);
    return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  };
  const next = nextMission();

  const doNext = () => {
    if (!next) return;
    setMission(next);
    if (next.allowed.includes(getAircraft(aircraftId).cls)) launch(next);
    else { engineRef.current?.showMenu(); setResult(null); setMission(next); setAircraftId(next.recommended); engineRef.current?.showHangar(next.recommended, livery); setScreen('hangar'); }
  };

  const togglePause = (p: boolean) => { engineRef.current?.setPaused(p); setPaused(p); if (!p) setModal(null); };

  const allowed = (mission && screen === 'hangar' ? mission.allowed : [...ALL_CLASSES]) as (typeof ALL_CLASSES[number])[];
  const hangarFromMenu = screen === 'hangar' && !mission;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" tabIndex={0} />

      {screen === 'title' && <TitleScreen onStart={() => { engineRef.current?.audio.init(); setScreen('menu'); }} />}

      {screen === 'menu' && (
        <MainMenu
          save={save}
          onMode={(m) => { setMode(m); setMission(null); setScreen('missions'); }}
          onHangar={() => { setMission(null); openHangar(null); }}
          onSettings={() => setModal('settings')}
          onControls={() => setModal('controls')}
        />
      )}

      {screen === 'missions' && (
        <MissionSelect
          mode={mode} save={save} freeCfg={freeCfg} setFreeCfg={setFreeCfg}
          onBack={() => setScreen('menu')}
          onPick={(m) => { setMission(m); openHangar(m); }}
          onFreeNext={() => { setMission(freeMission(freeCfg)); openHangar(freeMission(freeCfg)); }}
        />
      )}

      {screen === 'hangar' && (
        <HangarScreen
          allowed={allowed} aircraftId={aircraftId} setAircraft={pickAircraft} livery={livery} setLivery={pickLivery}
          mission={mission && mission.id !== 'free' ? mission : null}
          onBack={() => { engineRef.current?.showMenu(); setScreen(hangarFromMenu ? 'menu' : 'missions'); }}
          onLaunch={hangarFromMenu ? undefined : () => launch(mission ?? undefined)}
        />
      )}

      {screen === 'play' && snap && !result && (
        <>
          <Hud s={snap} engine={engineRef.current!} settings={settings} />
          {hintOn && settings.hints && !paused && <HintBar heli={snap.heli} fighter={snap.fighter} />}
        </>
      )}
      {screen === 'play' && <Toasts items={toasts} />}
      {screen === 'play' && mapOpen && engineRef.current && <MiniMap engine={engineRef.current} big onClose={() => setMapOpen(false)} />}
      {screen === 'play' && paused && !result && (
        <PauseMenu
          freeFlight={mission?.kind === 'free'}
          onResume={() => togglePause(false)}
          onRestart={() => { togglePause(false); engineRef.current?.restart(); setResult(null); }}
          onSettings={() => setModal('settings')}
          onControls={() => setModal('controls')}
          onEnd={() => { togglePause(false); engineRef.current?.endFlight(); }}
          onExit={goMenu}
        />
      )}
      {screen === 'play' && result && (
        <ResultsScreen
          r={result.r} stats={result.stats} canNext={!!next && result.r.success}
          onNext={doNext}
          onRetry={() => { setResult(null); launch(result.def); }}
          onHangar={() => { const d = result.def; setResult(null); engineRef.current?.showMenu(); setMission(d.id === 'free' ? null : d); openHangar(d.id === 'free' ? null : d); }}
          onMenu={goMenu}
        />
      )}

      {modal === 'settings' && <Modal title="Settings" onClose={() => setModal(null)}><SettingsPanel s={settings} set={setSettings} /></Modal>}
      {modal === 'controls' && <Modal title="Controls & flight tips" onClose={() => setModal(null)} wide><ControlsPanel /></Modal>}

      {loading && (
        <div className="absolute inset-0 z-[60] bg-slate-950 flex flex-col items-center justify-center gap-4">
          <div className="text-4xl font-black tracking-tight">SKY<span className="text-sky-400">BOUND</span></div>
          <div className="w-48 h-1 bg-white/10 rounded overflow-hidden"><div className="h-full w-1/2 bg-sky-400 animate-pulse" /></div>
          <div className="text-xs tracking-[0.3em] text-slate-400 uppercase">Building the world…</div>
        </div>
      )}
      <div className="hidden" data-game={GAME_META.id} data-version={GAME_META.version} data-save={JSON.stringify(defaultSave().credits)} />
    </div>
  );
}
