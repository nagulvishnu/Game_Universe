import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type GameState, type Hud as HudData, type Result, type UI } from './game/game';
import { initAudio, isMuted, setMuted, sfx } from './game/audio';
import { addScore, getName, setName as saveName } from './game/storage';
import type { Difficulty } from './game/data';
import Hud, { type FeedItem, type PickItem, type ToastItem } from './ui/Hud';
import Touch from './ui/Touch';
import Menu from './ui/Menu';
import { Pause, GameOver } from './ui/Overlays';

const EMPTY: HudData = {
  alive: 0, total: 0, kills: 0, score: 0, hp: 100, armor: 0, phase: 'plane', weapon: 'M9 Pistol', wid: 'pistol', mag: 0, reserve: 0, isGun: true,
  slots: [], gren: 0, bomb: 0, medkits: 0, heal: 0, reload: 0, zoneLabel: '', zoneTime: 0, zoneKind: 'wait', inZone: true,
  prompt: null, speed: 0, vehicle: null, vehHp: 0, alt: 0, scoped: false, hint: null, touchAct: false,
};

const coarse = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [isTouch, setIsTouch] = useState(coarse);
  const [screen, setScreen] = useState<GameState>('menu');
  const [hud, setHud] = useState<HudData>(EMPTY);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [hit, setHit] = useState({ k: 0, kill: false, head: false });
  const [hurt, setHurt] = useState({ k: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [rank, setRank] = useState(-1);
  const [muted, setMutedState] = useState(isMuted());
  const [name, setNameState] = useState(getName());
  const [mode, setMode] = useState('classic');
  const [diff, setDiff] = useState<Difficulty>('normal');
  const nameRef = useRef(name);
  const idRef = useRef(1);
  const hurtT = useRef(0);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    const ui: UI = {
      onHud: setHud,
      onFeed: (text, kind) => {
        const id = idRef.current++;
        setFeed((f) => [...f.slice(-4), { id, text, kind }]);
        setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 5200);
      },
      onToast: (t, sub, kind) => {
        const id = idRef.current++;
        setToast({ id, t, sub, kind });
        setTimeout(() => setToast((c) => (c && c.id === id ? null : c)), 2300);
      },
      onState: (s) => setScreen(s),
      onOver: (r) => {
        const entry = { name: nameRef.current || 'YOU', score: r.score, kills: r.kills, place: r.place, total: r.total, mode: r.mode, time: r.time, date: Date.now() };
        setRank(addScore(entry));
        setResult(r);
      },
      onHit: (kill, head) => setHit((h) => ({ k: h.k + 1, kill, head })),
      onHurt: (zone) => {
        if (zone) return;
        const now = performance.now();
        if (now - hurtT.current < 120) return;
        hurtT.current = now;
        setHurt((h) => ({ k: h.k + 1 }));
      },
      onPick: (text, color) => {
        const id = idRef.current++;
        setPicks((p) => [...p.slice(-3), { id, text, color }]);
        setTimeout(() => setPicks((p) => p.filter((x) => x.id !== id)), 2700);
      },
    };
    const g = new Game(canvasRef.current!, miniRef.current!, overlayRef.current!, ui, coarse());
    (window as unknown as { __game?: Game }).__game = g;
    setGame(g);
    return () => {
      g.dispose();
      setGame(null);
    };
  }, []);

  useEffect(() => {
    const t = () => {
      setIsTouch(true);
      if (game) game.isTouch = true;
    };
    window.addEventListener('touchstart', t, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', t);
  }, [game]);

  const start = useCallback(() => {
    if (!game) return;
    initAudio();
    sfx('enter');
    setFeed([]);
    setPicks([]);
    setToast(null);
    setHit({ k: 0, kill: false, head: false });
    setHurt({ k: 0 });
    setResult(null);
    setHud(EMPTY);
    game.isTouch = isTouch;
    game.startMatch(mode, diff, name.trim() || 'YOU');
  }, [game, mode, diff, name, isTouch]);

  const restart = useCallback(() => {
    if (!game) return;
    initAudio();
    setFeed([]);
    setPicks([]);
    setToast(null);
    setResult(null);
    game.restart();
  }, [game]);

  const toggleMute = () => {
    initAudio();
    setMuted(!isMuted());
    setMutedState(isMuted());
  };

  const playing = screen === 'playing' || screen === 'paused';

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
      <canvas
        ref={miniRef}
        width={300}
        height={300}
        className="absolute pointer-events-none"
        style={{ right: 12, top: 60, width: 150, height: 150, display: playing ? 'block' : 'none', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}
      />
      {playing && (
        <Hud
          hud={hud}
          game={game}
          feed={feed}
          picks={picks}
          toast={toast}
          hit={hit}
          hurt={hurt}
          isTouch={isTouch}
          muted={muted}
          onMute={toggleMute}
          onPause={() => game?.pause()}
        />
      )}
      {screen === 'playing' && isTouch && game && <Touch game={game} hud={hud} onPause={() => game.pause()} />}
      {screen === 'menu' && (
        <Menu
          name={name}
          setName={(n) => { setNameState(n); saveName(n); }}
          mode={mode}
          setMode={(m) => { sfx('ui'); setMode(m); }}
          diff={diff}
          setDiff={setDiff}
          onPlay={start}
          isTouch={isTouch}
        />
      )}
      {screen === 'paused' && game && (
        <Pause onResume={() => game.resume()} onRestart={restart} onQuit={() => game.toMenu()} muted={muted} onMute={toggleMute} isTouch={isTouch} />
      )}
      {screen === 'over' && result && game && <GameOver r={result} rank={rank} onRestart={restart} onMenu={() => game.toMenu()} />}
    </div>
  );
}
