import { useEffect } from 'react';
import Scene from './Scene';
import Hud from './ui/Hud';
import Hub from './ui/Hub';
import Touch from './ui/Touch';
import { ArenaMenu, CombatMenu, GameOver, PauseMenu, resume } from './ui/Overlays';
import { installInput, input } from './game/input';
import { useGame } from './game/store';
import { restartRun } from './game/modes';
import { initAudio, sfx } from './game/audio';

export default function App() {
  const screen = useGame(s => s.screen), touchPref = useGame(s => s.settings.touch);
  useEffect(() => {
    installInput(); let last = 0;
    const st = () => useGame.getState();
    input.onPause = () => {
      const now = performance.now(); if (now - last < 180) return; last = now; const s = st().screen;
      if (s === 'playing') { st().set({ screen: 'paused' }); input.clear(); document.exitPointerLock?.(); sfx.ui(); }
      else if (s === 'paused' || s === 'combat' || s === 'arena') resume();
    };
    input.onAction = (a, down) => {
      if (!down) return; const s = st().screen;
      if (a === 'menu') { if (s === 'playing') { st().set({ screen: 'combat' }); input.clear(); document.exitPointerLock?.(); } else if (s === 'combat') resume(); }
      if (a === 'arena') { if (s === 'playing') { st().set({ screen: 'arena' }); input.clear(); document.exitPointerLock?.(); } else if (s === 'arena') resume(); }
    };
    const key = (e: KeyboardEvent) => {
      if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !(e.target instanceof HTMLInputElement)) {
        const s = st().screen; if (s === 'gameover') { initAudio(); restartRun(); } else if (s === 'paused') resume();
      }
    };
    window.addEventListener('keydown', key);
    const vis = () => { if (document.hidden && st().screen === 'playing') input.onPause(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', vis); };
  }, []);
  useEffect(() => { if (screen !== 'playing') input.clear(); }, [screen]);
  const touch = touchPref === 'on' || (touchPref === 'auto' && input.isTouch);
  return (
    <div id="game-root" data-game="1" className="fixed inset-0 bg-black overflow-hidden select-none">
      <div id="canvas-wrap" data-game="1" className="absolute inset-0" style={{ transformOrigin: 'center' }}><Scene /></div>
      <Hud />
      {screen === 'hub' && <Hub />}
      {screen === 'playing' && touch && <Touch />}
      {screen === 'paused' && <PauseMenu />}
      {screen === 'combat' && <CombatMenu />}
      {screen === 'arena' && <ArenaMenu />}
      {screen === 'gameover' && <GameOver />}
    </div>
  );
}
