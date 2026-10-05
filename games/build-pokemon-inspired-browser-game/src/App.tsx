import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Game, W, H } from './game/engine';
import { REGIONS } from './game/data';
import { isMuted, setMuted } from './game/audio';
import { GameCtx } from './ui/common';
import { GameOver, Pause, Starter, Title, Victory } from './ui/screens';
import { Shop, TeamMenu } from './ui/menus';
import { BattlePanel, TouchControls } from './ui/battle';

function Hud({ g }: { g: Game }) {
  const p = g.p; const [mute, setMute] = useState(isMuted());
  if (!p || (g.screen !== 'world' && g.screen !== 'battle')) return null;
  const inWorld = g.screen === 'world';
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-1 p-1.5 sm:p-2 ${inWorld ? 'justify-between' : 'justify-end'}`}>
      <div className={`flex flex-col gap-1 ${inWorld ? '' : 'order-2'}`}>
        <div className="panel !rounded-lg px-2 py-1 !shadow-none">
          <div className="pixel text-[8px] text-[#9aa0d8] sm:text-[9px]">SCORE</div>
          <div className="pixel text-[10px] text-[#ffd23f] sm:text-xs">{p.score.toLocaleString()}</div>
        </div>
        <div className="panel !rounded-lg px-2 py-0.5 text-[11px] font-extrabold !shadow-none sm:text-sm">💰 ${p.money.toLocaleString()}</div>
      </div>
      <div className="pointer-events-auto flex flex-col items-end gap-1">
        <div className="panel flex items-center gap-0.5 !rounded-lg px-1.5 py-1 !shadow-none" title="Badges">
          {p.badges.map((b, i) => (
            <span key={i} className={`h-3 w-3 rounded-full border-2 border-[#0b0a1e] sm:h-4 sm:w-4 ${b ? 'shadow-[0_0_8px_currentColor]' : 'opacity-40'}`} style={{ background: b ? REGIONS[i].pal.accent : '#3a3770', color: REGIONS[i].pal.accent }} />
          ))}
        </div>
        <div className="flex gap-1">
          {inWorld && <button className="btn !rounded-lg !px-2 !py-0.5 text-xs sm:text-sm" onClick={() => g.openMenu('party')} title="Team & Bag (O / I)">🐾</button>}
          <button className="btn !rounded-lg !px-2 !py-0.5 text-xs sm:text-sm" onClick={() => { setMuted(!mute); setMute(!mute); }}>{mute ? '🔇' : '🔊'}</button>
          <button className="btn !rounded-lg !px-2 !py-0.5 text-xs sm:text-sm" onClick={() => g.togglePause()} title="Pause (Esc)">⏸</button>
        </div>
      </div>
    </div>
  );
}

function Toasts({ g }: { g: Game }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex flex-col items-center gap-1 px-2 sm:top-16">
      {g.toasts.map((t) => (
        <div key={t.id} className={`anim-slide max-w-md rounded-xl border-[3px] border-[#0b0a1e] px-3 py-1.5 text-center text-xs font-extrabold shadow-lg sm:text-sm ${t.kind === 'good' ? 'bg-[#2a8a4a]' : t.kind === 'warn' ? 'bg-[#b8561c]' : 'bg-[#2c2870]'}`}>{t.text}</div>
      ))}
    </div>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [size, setSize] = useState({ w: 720, h: 480 });
  const touch = useMemo(() => (typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)), []);

  useEffect(() => {
    const cv = canvasRef.current!;
    let g = gameRef.current;
    if (!g) { g = new Game(cv); gameRef.current = g; (window as unknown as { __game: Game }).__game = g; setGame(g); }
    g.start();
    return () => g!.stop();
  }, []);

  // fit canvas into the stage preserving 3:2
  useEffect(() => {
    const el = stageRef.current!;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(100, Math.min(r.width, r.height * (W / H)));
      setSize({ w: Math.floor(w), h: Math.floor(w * (H / W)) });
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [game, touch]);

  // input
  useEffect(() => {
    if (!game) return;
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    const kd = (e: KeyboardEvent) => { if (isField(e.target)) return; if (game.keyDown(e)) e.preventDefault(); };
    const ku = (e: KeyboardEvent) => { game.keyUp(e); };
    const auto = () => {
      game.keys = []; game.run = false; game.touchDir = -1;
      if ((game.screen === 'world' || game.screen === 'battle') && !game.paused) game.togglePause();
    };
    const vis = () => { if (document.hidden) auto(); };
    const unlock = () => { import('./game/audio').then((m) => m.sfx.unlock()); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    window.addEventListener('blur', auto); document.addEventListener('visibilitychange', vis);
    window.addEventListener('pointerdown', unlock, { once: true });
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', auto); document.removeEventListener('visibilitychange', vis);
      document.removeEventListener('contextmenu', prevent);
    };
  }, [game]);

  const subscribe = useCallback((f: () => void) => (game ? game.subscribe(f) : () => {}), [game]);
  useSyncExternalStore(subscribe, () => (game ? game.ver : 0));

  const showBattle = !!game && game.screen === 'battle' && !!game.b;
  const showTouch = !!game && touch && game.screen === 'world';

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#0d0b1f] text-white">
      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative overflow-hidden rounded-xl border-4 border-[#0b0a1e] shadow-[0_0_0_3px_#4a43b0,0_12px_40px_rgba(0,0,0,0.6)]" style={{ width: size.w, height: size.h }}>
          <canvas ref={canvasRef} className="block h-full w-full" />
          {game && <Hud g={game} />}
          {game && <Toasts g={game} />}
        </div>
        {game && (
          <GameCtx.Provider value={game}>
            {game.screen === 'title' && <Title />}
            {game.screen === 'starter' && <Starter />}
            {(game.screen === 'world' || game.screen === 'battle') && game.menu === 'party' && <TeamMenu />}
            {(game.screen === 'world' || game.screen === 'battle') && game.menu === 'bag' && <TeamMenu />}
            {game.screen === 'world' && game.menu === 'shop' && <Shop />}
            {(game.screen === 'world' || game.screen === 'battle') && game.menu === 'pause' && <Pause />}
            {game.screen === 'gameover' && <GameOver />}
            {game.screen === 'victory' && <Victory />}
          </GameCtx.Provider>
        )}
      </div>
      {game && (
        <GameCtx.Provider value={game}>
          {showBattle && <BattlePanel />}
          {showTouch && <TouchControls />}
        </GameCtx.Provider>
      )}
    </div>
  );
}
