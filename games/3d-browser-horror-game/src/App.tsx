import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type HudState, type Phase, type PhaseInfo, type Settings } from './game/game';
import { Hud, type Msg } from './components/Hud';
import { Menu } from './components/Menu';
import { CaughtOverlay, DayCard, GameOver, PausedOverlay, WinScreen } from './components/Overlays';

const DEFAULTS: Settings = { volume: 0.8, brightness: 1.0, sensitivity: 1.0, quality: 'high' };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('grannys-house-settings');
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const msgId = useRef(0);
  const autoStart = useRef(false);

  const [session, setSession] = useState(0);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const settingsRef = useRef(settings);
  const [phase, setPhase] = useState<Phase>('ready');
  const [info, setInfo] = useState<PhaseInfo>({});
  const [hud, setHud] = useState<HudState | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [note, setNote] = useState<{ title: string; text: string } | null>(null);
  const [dayCard, setDayCard] = useState<{ day: number; key: number } | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [error, setError] = useState<string | null>(null);

  settingsRef.current = settings;

  useEffect(() => {
    try {
      localStorage.setItem('grannys-house-settings', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    gameRef.current?.setSettings(settings);
  }, [settings]);

  // (re)create the game whenever the session or graphics quality changes
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    setPhase('ready');
    setHud(null);
    setMsgs([]);
    setNote(null);
    setDayCard(null);
    setInfo({});
    setError(null);
    let game: Game | null = null;
    let controlsTimer: number | undefined;
    try {
      game = new Game(
        el,
        {
          onHud: (h) => setHud(h),
          onMessage: (text, tone) => {
            const id = ++msgId.current;
            setMsgs((m) => [...m.slice(-2), { id, text, tone }]);
            window.setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 5000);
          },
          onNote: (n) => setNote(n),
          onPhase: (p, i) => {
            setPhase(p);
            if (i) setInfo((prev) => ({ ...prev, ...i }));
            if (p === 'playing' && i?.dayChange) setDayCard({ day: i.day ?? 1, key: Date.now() });
            if (p === 'gameover' || p === 'win') setNote(null);
          },
        },
        settingsRef.current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    gameRef.current = game;
    if (location.search.includes('debug')) (window as unknown as { __game: Game }).__game = game;
    if (autoStart.current) {
      autoStart.current = false;
      game.start();
      setShowControls(true);
      controlsTimer = window.setTimeout(() => setShowControls(false), 24000);
    }
    return () => {
      if (controlsTimer) window.clearTimeout(controlsTimer);
      game?.dispose();
      gameRef.current = null;
    };
  }, [session, settings.quality]);

  const play = useCallback(() => {
    gameRef.current?.start();
    setShowControls(true);
    window.setTimeout(() => setShowControls(false), 24000);
  }, []);

  const retry = useCallback(() => {
    autoStart.current = true;
    setSession((s) => s + 1);
  }, []);

  const resume = useCallback(() => gameRef.current?.resume(), []);

  const inGame = phase === 'playing' || phase === 'paused' || phase === 'caught';

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={mountRef} className="absolute inset-0" />

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-8 text-center">
          <div className="font-horror blood-text text-5xl">The house won&apos;t open</div>
          <p className="mt-4 max-w-md text-sm text-stone-400">
            This game needs WebGL to render its 3D world, but your browser could not start it. Try enabling hardware acceleration or using a recent
            version of Chrome, Edge or Firefox.
          </p>
          <p className="mt-3 text-xs text-stone-600">{error}</p>
        </div>
      )}

      {hud && inGame && <Hud hud={hud} messages={msgs} note={note} showControls={showControls} />}
      {hud && hud.whiteout > 0 && phase !== 'win' && <div className="pointer-events-none absolute inset-0 bg-white" style={{ opacity: hud.whiteout }} />}

      {phase === 'ready' && !error && <Menu settings={settings} onChange={setSettings} onPlay={play} />}
      {phase === 'paused' && <PausedOverlay onResume={resume} />}
      {phase === 'caught' && <CaughtOverlay info={info} />}
      {dayCard && phase === 'playing' && <DayCard key={dayCard.key} day={dayCard.day} maxDays={info.maxDays ?? 5} />}
      {phase === 'gameover' && <GameOver info={info} onRetry={retry} />}
      {phase === 'win' && <WinScreen info={info} onRetry={retry} />}

      {/* soft global vignette */}
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 160px 40px rgba(0,0,0,0.55)' }} />
    </div>
  );
}
