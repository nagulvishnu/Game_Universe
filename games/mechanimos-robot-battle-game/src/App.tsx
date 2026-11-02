import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/engine';
import { audio } from './game/audio';
import type { BattleCardsSnap, DraftRequest, HudSnap, RunStats, SpeciesDef } from './game/types';
import {
  BattleCardBar, DraftOverlay, GameOverOverlay, Hud, PauseOverlay,
  StartScreen, TamePrompt, Toasts, type ToastMsg,
} from './ui/screens';
import { addScore, loadScores, qualifies, type HiScoreEntry } from './ui/scores';

let toastId = 1;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Game | null>(null);

  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [scene, setScene] = useState<'explore' | 'battle'>('explore');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<HudSnap>({
    score: 0, lives: 3, teamCount: 1, tameCards: 3, wins: 0,
    hint: 'Find a wild Mechanimo!', engageName: '', engageKind: '',
  });
  const [bc, setBc] = useState<BattleCardsSnap>({ cards: [], cooldowns: [], yourTurn: false, locked: true });
  const [draftReq, setDraftReq] = useState<DraftRequest | null>(null);
  const [tame, setTame] = useState<{ show: boolean; species: SpeciesDef | null }>({ show: false, species: null });
  const [gameOver, setGameOver] = useState<{ stats: RunStats; isNewBest: boolean; submitted: boolean } | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [scores, setScores] = useState<HiScoreEntry[]>([]);
  const [best, setBest] = useState(0);

  const pushToast = useCallback((msg: string, color = '#22d3ee') => {
    if (!msg) return;
    const id = toastId++;
    setToasts((t) => [...t.slice(-2), { id, msg, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2300);
  }, []);

  // ---------- engine lifecycle ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Game(canvas, {
      onHud: (s) => setHud(s),
      onDraft: (req) => { audio.init(); setDraftReq(req); },
      onBattleCards: (s) => setBc(s),
      onTamePrompt: (show, species) => setTame({ show, species: species ?? null }),
      onToast: (msg, color) => pushToast(msg, color),
      onGameOver: (stats, isNewBest) => {
        setGameOver({ stats, isNewBest, submitted: false });
        setScores(loadScores());
      },
      onPauseChange: (p) => setPaused(p),
      onSceneChange: (s) => setScene(s),
    });
    engineRef.current = engine;
    engine.newRun();
    engine.start();
    setScores(loadScores());
    try {
      setBest(Number(localStorage.getItem('mech_best') ?? 0) || 0);
    } catch { /* noop */ }
    return () => {
      engine.destroy();
      engine.unbindInput();
      engineRef.current = null;
    };
  }, [pushToast]);

  // ---------- ui lock ----------
  const overlayOpen = paused || draftReq !== null || tame.show || gameOver !== null;
  useEffect(() => {
    if (engineRef.current) engineRef.current.uiLocked = overlayOpen;
  }, [overlayOpen]);

  // ---------- auto-pause on tab hide ----------
  useEffect(() => {
    const fn = () => {
      if (document.hidden && engineRef.current && screen === 'game' && !gameOver) {
        engineRef.current.setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', fn);
    return () => document.removeEventListener('visibilitychange', fn);
  }, [screen, gameOver]);

  // ---------- actions ----------
  const startGame = useCallback(() => {
    audio.init();
    audio.click();
    setDraftReq(null);
    setTame({ show: false, species: null });
    setGameOver(null);
    setPaused(false);
    engineRef.current?.setMuted(muted);
    engineRef.current?.setPaused(false);
    engineRef.current?.newRun();
    setScreen('game');
  }, [muted]);

  const restart = startGame;

  const toMenu = useCallback(() => {
    audio.click();
    engineRef.current?.setPaused(false);
    engineRef.current?.quitToMenu();
    setDraftReq(null);
    setTame({ show: false, species: null });
    setGameOver(null);
    setScores(loadScores());
    try {
      setBest(Number(localStorage.getItem('mech_best') ?? 0) || 0);
    } catch { /* noop */ }
    setScreen('menu');
  }, []);

  // R = instant restart on game over
  useEffect(() => {
    if (!gameOver) return;
    const fn = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      if (e.key.toLowerCase() === 'r') restart();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [gameOver, restart]);

  const submitScore = useCallback((name: string) => {
    if (!gameOver) return;
    const updated = addScore({
      name, score: gameOver.stats.score, tames: gameOver.stats.tames,
      wins: gameOver.stats.wins, date: Date.now(),
    });
    setScores(updated);
    setGameOver((g) => (g ? { ...g, submitted: true } : g));
    audio.fanfare();
  }, [gameOver]);

  const canSubmit = gameOver ? qualifies(gameOver.stats.score) && !gameOver.submitted : false;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070313]">
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {screen === 'game' && (
        <Hud
          snap={hud}
          muted={muted}
          paused={paused}
          inBattle={scene === 'battle'}
          onPause={() => engineRef.current?.setPaused(!paused)}
          onMute={() => { const m = !muted; setMuted(m); engineRef.current?.setMuted(m); }}
          onEngage={() => engineRef.current?.tryEngage()}
        />
      )}

      {screen === 'game' && scene === 'battle' && !tame.show && !gameOver && (
        <BattleCardBar snap={bc} onPlay={(i) => engineRef.current?.playCard(i)} />
      )}

      {draftReq && (
        <DraftOverlay
          req={draftReq}
          onConfirm={(cards, idx) => { audio.click(); setDraftReq(null); engineRef.current?.confirmDraft(cards, idx); }}
          onCancel={() => { audio.click(); setDraftReq(null); engineRef.current?.cancelDraft(); }}
        />
      )}

      {tame.show && tame.species && (
        <TamePrompt
          species={tame.species}
          tameCards={hud.tameCards}
          onTame={() => { audio.click(); engineRef.current?.throwTame(); }}
          onRelease={() => { audio.click(); engineRef.current?.releaseTame(); }}
        />
      )}

      {screen === 'game' && paused && !gameOver && (
        <PauseOverlay
          muted={muted}
          onResume={() => engineRef.current?.setPaused(false)}
          onRestart={restart}
          onMenu={toMenu}
          onMute={() => { const m = !muted; setMuted(m); engineRef.current?.setMuted(m); }}
        />
      )}

      {gameOver && (
        <GameOverOverlay
          stats={gameOver.stats}
          isNewBest={gameOver.isNewBest}
          canSubmit={canSubmit}
          scores={scores}
          submitted={gameOver.submitted}
          onSubmit={submitScore}
          onRestart={restart}
          onMenu={toMenu}
        />
      )}

      <Toasts list={toasts} />

      {screen === 'menu' && <StartScreen scores={scores} best={best} onStart={startGame} />}
    </div>
  );
}
