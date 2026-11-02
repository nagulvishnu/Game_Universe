import { useEffect, useRef } from 'react';
import { createGame } from './game/engine';
import { useGame } from './game/store';
import Hud from './ui/Hud';
import PanelHost from './ui/Panels';
import { MainMenu, PauseMenu, Intro, Ending } from './ui/Menus';

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  const screen = useGame((s) => s.screen);
  useEffect(() => { if (ref.current) createGame(ref.current); }, []);
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={ref} className="absolute inset-0" />
      {screen === 'play' && <Hud />}
      {screen === 'menu' && <MainMenu />}
      {screen === 'play' && <PauseMenu />}
      <PanelHost />
      <Intro />
      <Ending />
    </div>
  );
}
