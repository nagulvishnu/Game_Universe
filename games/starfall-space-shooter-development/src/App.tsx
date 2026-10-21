import { useEffect, useState } from 'react';
import { useStore } from './game/store';
import GameCanvas from './game/GameCanvas';
import HUD from './components/HUD';
import { MenuBackground, MainMenu, Hangar, Arsenal, Campaign, Briefing, Modes, PauseMenu, Results, Settings, Achievements, Codex } from './components/Menus';
import { audio } from './game/audio';
import { MousePointerClick, MonitorSmartphone } from 'lucide-react';

export default function App() {
  const screen = useStore(s => s.screen);
  const gameKey = useStore(s => s.gameKey);
  const toast = useStore(s => s.toast);
  const settings = useStore(s => s.settings);
  const settingsFromPause = useStore(s => s.settingsFromPause);
  const [needsGesture, setNeedsGesture] = useState(true);
  const inGame = screen === 'playing' || screen === 'paused' || screen === 'complete' || screen === 'failed' || (screen === 'settings' && settingsFromPause);
  const inMenu = !inGame;

  useEffect(() => {
    audio.setVolumes({ master: settings.masterVol, music: settings.musicVol, sfx: settings.sfxVol, ui: settings.uiVol });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (inMenu) audio.setMusic('menu');
  }, [inMenu, screen]);

  const engage = () => {
    audio.init();
    audio.setMusic('menu');
    setNeedsGesture(false);
    audio.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-100 font-mono overflow-hidden select-none">
      {/* menu 3D backdrop */}
      {inMenu && <MenuBackground />}

      {/* menu screens */}
      {screen === 'menu' && <MainMenu />}
      {screen === 'hangar' && <Hangar />}
      {screen === 'arsenal' && <Arsenal />}
      {screen === 'campaign' && <Campaign />}
      {screen === 'briefing' && <Briefing />}
      {screen === 'modes' && <Modes />}
      {screen === 'achievements' && <Achievements />}
      {screen === 'codex' && <Codex />}
      {screen === 'settings' && !settingsFromPause && <Settings />}

      {/* gameplay */}
      {inGame && (
        <div className="absolute inset-0" key={gameKey}>
          <GameCanvas />
          {(screen === 'playing' || screen === 'paused') && <HUD />}
          {screen === 'playing' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-cyan-200/60 tracking-[0.25em] pointer-events-none flex items-center gap-1.5 animate-pulse">
              <MousePointerClick className="w-3.5 h-3.5" /> CLICK TO CAPTURE MOUSE · ESC = PAUSE
            </div>
          )}
          {screen === 'paused' && <PauseMenu />}
          {screen === 'settings' && settingsFromPause && <div className="absolute inset-0 z-20"><Settings /></div>}
          {screen === 'complete' && <Results success />}
          {screen === 'failed' && <Results success={false} />}
        </div>
      )}

      {/* first-gesture audio gate */}
      {needsGesture && screen === 'menu' && (
        <button onClick={engage} className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-cyan-400 text-slate-950 font-bold text-xs tracking-widest px-4 py-2 [clip-path:polygon(8px_0,100%_0,calc(100%-8px)_100%,0_100%)] hover:bg-cyan-300 animate-pulse">
          🔊 ENABLE AUDIO
        </button>
      )}

      {/* touch warning */}
      <div className="absolute bottom-3 right-4 z-30 hidden [@media(pointer:coarse)]:flex items-center gap-2 bg-amber-950/80 border border-amber-500/50 text-amber-200 text-[11px] px-3 py-2 max-w-xs">
        <MonitorSmartphone className="w-4 h-4 shrink-0" /> STARFALL is designed for keyboard + mouse. Touch controls are not supported.
      </div>

      {/* toast */}
      {toast && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 border border-cyan-400/50 text-cyan-200 text-xs font-bold tracking-widest px-4 py-2 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
          {toast}
        </div>
      )}

      {/* scanline overlay for menus */}
      {inMenu && <div className="pointer-events-none absolute inset-0 z-[5] opacity-[0.05] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(103,232,249,0.6)_3px)]" />}
    </div>
  );
}
