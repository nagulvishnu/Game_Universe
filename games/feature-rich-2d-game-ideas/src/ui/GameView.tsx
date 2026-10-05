import { useEffect, useRef, useState } from 'react';
import { Game, type GameResult } from '../game/engine';
import { type CharId, type Save } from '../game/data';
import { isMuted, setMuted } from '../game/audio';

interface Props {
  charId: CharId;
  levelIdx: number;
  save: Save;
  onEnd: (r: GameResult) => void;
  onQuit: () => void;
  onRestart: () => void;
}

export default function GameView({ charId, levelIdx, save, onEnd, onQuit, onRestart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMut] = useState(isMuted());
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new Game(canvas, charId, levelIdx, save, {
      onEnd: r => endRef.current(r),
      onPause: () => {
        game.setPaused(true);
        setPaused(true);
      },
    });
    gameRef.current = game;
    game.start();
    return () => {
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resume = () => {
    gameRef.current?.setPaused(false);
    setPaused(false);
  };

  useEffect(() => {
    if (!paused) return;
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Escape') resume();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [paused]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" style={{ cursor: paused ? 'default' : 'none' }}>
      <canvas ref={canvasRef} className="block" />
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ cursor: 'default' }}>
          <div className="w-[min(92vw,640px)] rounded-2xl border border-cyan-400/40 bg-slate-900/95 p-6 shadow-2xl shadow-cyan-500/20">
            <h2 className="text-center text-3xl font-black tracking-widest text-cyan-300">PAUSED</h2>
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-300">
              {[
                ['WASD', 'Move / Drive'],
                ['Mouse', 'Aim'],
                ['Left Click', 'Fire weapon'],
                ['R', 'Reload'],
                ['Shift', 'Dash / Vehicle boost'],
                ['Q', 'Character skill'],
                ['Space', 'Ultimate (when charged)'],
                ['G', 'Throw grenade'],
                ['V', 'Melee (deflects bullets)'],
                ['E', 'Enter / exit vehicle'],
                ['1-9 / Wheel', 'Switch weapon'],
                ['Esc', 'Pause'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <kbd className="min-w-20 rounded bg-slate-700 px-2 py-0.5 text-center text-xs font-bold text-white">{k}</kbd>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button onClick={resume} className="rounded-lg bg-cyan-500 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-400">▶ Resume</button>
              <button onClick={onRestart} className="rounded-lg bg-amber-500 px-4 py-3 font-bold text-slate-950 hover:bg-amber-400">↻ Restart Mission</button>
              <button
                onClick={() => {
                  setMuted(!muted);
                  setMut(!muted);
                }}
                className="rounded-lg bg-slate-700 px-4 py-3 font-bold text-white hover:bg-slate-600"
              >
                {muted ? '🔇 Sound: OFF' : '🔊 Sound: ON'}
              </button>
              <button onClick={onQuit} className="rounded-lg bg-rose-600 px-4 py-3 font-bold text-white hover:bg-rose-500">✕ Abort to HQ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
