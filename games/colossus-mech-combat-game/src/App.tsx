import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './game/store';
import { input } from './game/input';
import { audio } from './game/audio';
import { MenuScene, GameCanvas } from './game/Scene';
import { MainMenu, SettingsScreen, ControlsScreen, AchievementsScreen } from './ui/Menu';
import { CampaignScreen, LaunchScreen, DatabaseScreen, ResultsScreen } from './ui/Missions';
import { HangarScreen } from './ui/Hangar';
import { Hud, PauseMenu, TouchControls, ToastLayer } from './ui/Hud';

export default function App() {
  const screen = useStore(s => s.screen); const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  useEffect(() => {
    input.attach(); const unlock = () => { audio.init(); const s = useStore.getState(); audio.setVolumes(s.settings.master, s.settings.music, s.settings.sfx); if (s.screen !== 'game') audio.music('menu'); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock); return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  useEffect(() => { if (screen === 'game') { input.active = true; } else { input.active = false; audio.music(screen === 'results' ? null : 'menu'); } }, [screen]);
  const inGame = screen === 'game'; const bgMenu = !inGame && screen !== 'hangar' && screen !== 'database';
  return <div className="absolute inset-0 overflow-hidden bg-black">
    {bgMenu && <MenuScene />}
    {inGame && <><GameCanvas /><Hud /><PauseMenu />{touch && <TouchControls />}</>}
    <AnimatePresence mode="wait">
      {screen === 'menu' && <MainMenu key="menu" />}
      {screen === 'campaign' && <CampaignScreen key="campaign" />}
      {(screen === 'arena' || screen === 'survival' || screen === 'city' || screen === 'boss') && <LaunchScreen key={screen} mode={screen} />}
      {screen === 'hangar' && <HangarScreen key="hangar" />}
      {screen === 'database' && <DatabaseScreen key="database" />}
      {screen === 'settings' && <SettingsScreen key="settings" />}
      {screen === 'controls' && <ControlsScreen key="controls" />}
      {screen === 'achievements' && <AchievementsScreen key="ach" />}
      {screen === 'results' && <ResultsScreen key="results" />}
    </AnimatePresence>
    <ToastLayer />
    {!inGame && <div className="absolute inset-0 pointer-events-none scanlines z-[5]" />}
  </div>;
}
