import { useEffect } from 'react';
import { useGame } from './stores/gameStore';
import { MainMenu } from './ui/MainMenu';
import { FightSelection, PvpMenu, TrainingMenu } from './ui/Selection';
import { CombatScreen } from './ui/Combat';
import { ResultsScreen } from './ui/Results';
import { SkillsScreen, WeaponsScreen, EquipmentScreen, LoadoutScreen } from './ui/Catalogues';
import { ProfileScreen, SettingsScreen } from './ui/ProfileSettings';
import { audio } from './game/audio/AudioManager';

export default function App() {
  const screen = useGame((s) => s.screen);
  const toast = useGame((s) => s.toast);
  const settings = useGame((s) => s.settings);
  const match = useGame((s) => s.match);
  const startMatch = useGame((s) => s.startMatch);

  // Deep link straight into a match (?screen=combat) needs a match config.
  useEffect(() => {
    if (screen === 'combat' && !match) {
      startMatch({
        mode: 'fight', opponentId: 'kage', difficulty: 'medium',
        arenaId: 'crimson_rift', rounds: 3, timeLimit: 99,
      });
    }
  }, [screen, match, startMatch]);

  useEffect(() => {
    const unlock = () => audio.init();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    audio.setVolumes({
      master: settings.masterVolume,
      music: settings.musicVolume,
      sfx: settings.sfxVolume,
    });
  }, [settings.masterVolume, settings.musicVolume, settings.sfxVolume]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {screen === 'menu' && <MainMenu />}
      {screen === 'fight-select' && <FightSelection />}
      {screen === 'pvp-select' && <PvpMenu />}
      {screen === 'training-select' && <TrainingMenu />}
      {screen === 'combat' && <CombatScreen />}
      {screen === 'results' && <ResultsScreen />}
      {screen === 'skills' && <SkillsScreen />}
      {screen === 'weapons' && <WeaponsScreen />}
      {screen === 'equipment' && <EquipmentScreen />}
      {screen === 'loadout' && <LoadoutScreen />}
      {screen === 'profile' && <ProfileScreen />}
      {screen === 'settings' && <SettingsScreen />}

      {toast && (
        <div className="ss-fade pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-violet-400/40 bg-black/90 px-5 py-2 text-sm text-violet-100 shadow-[0_0_24px_rgba(138,90,255,0.35)]">
          {toast}
        </div>
      )}
    </div>
  );
}
