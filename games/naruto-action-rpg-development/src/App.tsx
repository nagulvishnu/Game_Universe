import { useEffect } from 'react';
import { useGame } from './game/store';
import { input } from './game/input';
import { audio } from './game/audio';
import { rt } from './game/runtime';
import { bus } from './game/bus';
import { GameCanvas } from './game/render/Scene';
import { MainMenu } from './game/ui/MainMenu';
import { HUD } from './game/ui/HUD';
import { Overlays } from './game/ui/Overlays';
import { autosave, saveGame, respawn } from './game/session';
import * as missions from './game/systems/missions';
import * as combat from './game/systems/combat';

(window as unknown as { __game: unknown }).__game = { rt, useGame, bus, missions, combat, saveGame, respawn };

export default function App() {
  const screen = useGame((s) => s.screen);
  const session = useGame((s) => s.session);
  const settings = useGame((s) => s.settings);

  useEffect(() => input.attach(), []);
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  useEffect(() => { audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx, ambience: settings.ambience }); }, [settings.master, settings.music, settings.sfx, settings.ambience]);
  useEffect(() => { if (screen === 'menu') audio.setMusic('menu'); }, [screen]);
  // periodic autosave while exploring
  useEffect(() => {
    const id = window.setInterval(() => {
      const g = useGame.getState();
      if (g.screen !== 'playing' || g.overlay !== null || !rt.playing) return;
      const busy = rt.enemies.some((e) => e.aggro && e.state !== 'dead' && e.def.tier !== 'dummy');
      if (!busy) bus.emit('autosave');
    }, 90000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const onHide = () => { if (document.hidden && useGame.getState().screen === 'playing') void autosave(); };
    document.addEventListener('visibilitychange', onHide); return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {screen === 'menu' ? <MainMenu /> : (
        <>
          <GameCanvas key={session} />
          <HUD />
          <Overlays />
        </>
      )}
    </div>
  );
}
