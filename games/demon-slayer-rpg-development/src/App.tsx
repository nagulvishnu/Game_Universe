import { useEffect, useState } from 'react';
import './ui/game.css';
import { useStore } from './game/store';
import { MainMenu } from './ui/MainMenu';
import { GameCanvas } from './ui/GameCanvas';
import { HUD } from './ui/HUD';
import { DeathScreen, Dialogue, GameMenu, PauseMenu, ResultScreen } from './ui/Overlays';
import { input } from './game/runtime';

function ClickHint() {
  const [locked, setLocked] = useState(true); const overlay = useStore((s) => s.overlay);
  useEffect(() => { const id = setInterval(() => setLocked(input.locked || input.lockFailed), 300); return () => clearInterval(id); }, []);
  if (locked || overlay !== null) return null;
  return <div className="prompt" style={{ bottom: '30vh', zIndex: 4 }}>Click the game view to capture the mouse for camera control (arrow keys also rotate the camera)</div>;
}

export default function App() {
  const screen = useStore((s) => s.screen); const overlay = useStore((s) => s.overlay); const booted = useStore((s) => s.booted);
  useEffect(() => { useStore.getState().boot(); }, []);
  if (!booted) return <div className="app" style={{ display: 'grid', placeItems: 'center', fontFamily: 'var(--font)', letterSpacing: '.3em', color: '#e8c777' }}>LOADING…</div>;
  return (
    <div className="app">
      {screen === 'menu' ? <MainMenu /> : (
        <>
          <GameCanvas />
          <HUD />
          <ClickHint />
          {overlay === 'menu' && <GameMenu />}
          {overlay === 'pause' && <PauseMenu />}
          {overlay === 'dialogue' && <Dialogue />}
          {overlay === 'death' && <DeathScreen />}
          {overlay === 'result' && <ResultScreen />}
        </>
      )}
    </div>
  );
}
