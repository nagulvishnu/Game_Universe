import { useEffect } from 'react';
import { GameCanvas } from './game/render/GameCanvas';
import { current, useStore } from './game/state/store';
import { CharacterSelect, Lobby, Loading, MainMenu, SettingsScreen, StatsScreen } from './ui/Screens';
import { EndScreens, Hud, Inventory, PauseMenu, WorldMap } from './ui/Hud';
import { audio } from './game/audio/audio';

function Playing() {
  const overlay = useStore((s) => s.overlay);
  const setOverlay = useStore((s) => s.setOverlay);
  const game = current.game;
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const g = current.game;
      if (!g || st.screen !== 'playing') return;
      if (e.code === 'Tab') { e.preventDefault(); if (e.repeat) return; if (st.overlay === 'inventory') { setOverlay('none'); current.input?.lock(); } else if (st.overlay === 'none') setOverlay('inventory'); }
      else if (e.code === 'KeyM') { if (e.repeat) return; if (st.overlay === 'map') { setOverlay('none'); current.input?.lock(); } else if (st.overlay === 'none') setOverlay('map'); }
      else if (e.code === 'Escape') { if (st.overlay === 'inventory' || st.overlay === 'map') { setOverlay('none'); current.input?.lock(); } else if (st.overlay === 'pause') { setOverlay('none'); current.input?.lock(); } }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [setOverlay]);
  useEffect(() => { audio.setVolumes(useStore.getState().settings.music, useStore.getState().settings.sfx); }, []);
  if (!game) return null;
  const hud = useStore.getState().hud;
  return (
    <div className="absolute inset-0">
      <GameCanvas game={game} />
      <Hud />
      <EndScreens />
      {overlay === 'inventory' && <Inventory />}
      {overlay === 'map' && <WorldMap />}
      {overlay === 'pause' && <PauseMenu />}
      {!hud && <div className="absolute inset-0 pointer-events-none" />}
      {overlay === 'none' && (
        <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-3"><div className="text-[10px] tracking-widest text-white/35">Click to capture mouse · ESC pause</div></div>
      )}
    </div>
  );
}

export default function App() {
  const screen = useStore((s) => s.screen);
  const epoch = useStore((s) => s.epoch);
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#05060f]">
      {screen === 'menu' && <MainMenu />}
      {screen === 'select' && <CharacterSelect />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'stats' && <StatsScreen />}
      {screen === 'loading' && <Loading />}
      {screen === 'playing' && <Playing key={epoch} />}
    </div>
  );
}
