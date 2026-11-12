import { useEffect, useRef } from 'react';
import { Game } from './game/engine';
import { hud } from './game/store';
import { Hud } from './ui/Hud';
import { PowerWheel } from './ui/PowerWheel';
import { ControlPanel } from './ui/ControlPanel';

export default function App() {
  const mount = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !mount.current) return;
    started.current = true;
    const game = new Game(mount.current);
    game
      .init((msg, f) => hud.set({ loadMsg: msg, loading: f }))
      .catch((err) => {
        console.error(err);
        hud.set({ loadMsg: 'Failed to start: ' + (err?.message ?? err) });
      });
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={mount} className="absolute inset-0" />
      <Hud />
      <PowerWheel />
      <ControlPanel />
    </div>
  );
}
