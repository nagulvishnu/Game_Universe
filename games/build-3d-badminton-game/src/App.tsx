import { useEffect, useRef } from 'react';
import { GameView } from './game/view';
import { audio } from './game/audio';
import { input } from './game/input';
import { useUI } from './game/store';
import { Hud, ResultsScreen } from './ui/Hud';
import {
  BracketScreen, ChampionshipScreen, CustomizeScreen, HowToScreen, MainMenu, PracticeScreen, ScoresScreen, SettingsScreen,
  SetupScreen, StartScreen, StatsScreen, TrophyScreen,
} from './ui/Screens';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screen = useUI((s) => s.screen);
  const toasts = useUI((s) => s.toasts);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const view = new GameView(canvas);
    input.attach();
    const ui = useUI.getState();
    input.padMap = ui.settings.padMap;
    audio.apply(ui.settings);
    ui.setEngine({
      start: (c) => view.start(c),
      restart: () => { const c = useUI.getState().launch; if (c) useUI.getState().startGame(c); },
      attract: () => view.attract(),
      stop: () => view.stop(),
    });
    view.attract();
    const unsub = useUI.subscribe((s, p) => {
      if (s.paused !== p.paused) view.setPaused(s.paused);
      if (s.settings !== p.settings) { audio.apply(s.settings); input.padMap = s.settings.padMap; }
    });
    const firstTouch = () => { audio.init(); audio.apply(useUI.getState().settings); };
    window.addEventListener('pointerdown', firstTouch, { once: true });
    const onVis = () => { if (document.hidden && useUI.getState().screen === 'game') useUI.getState().setPaused(true); };
    document.addEventListener('visibilitychange', onVis);
    (window as unknown as { __bm: unknown }).__bm = { view, store: useUI };
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerdown', firstTouch);
      input.detach();
      view.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {screen === 'start' && <StartScreen />}
      {screen === 'menu' && <MainMenu />}
      {screen === 'setup' && <SetupScreen />}
      {screen === 'practice' && <PracticeScreen />}
      {screen === 'bracket' && <BracketScreen />}
      {screen === 'championship' && <ChampionshipScreen />}
      {screen === 'trophy' && <TrophyScreen />}
      {screen === 'customize' && <CustomizeScreen />}
      {screen === 'stats' && <StatsScreen />}
      {screen === 'scores' && <ScoresScreen />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'howto' && <HowToScreen />}
      {screen === 'game' && <Hud />}
      {screen === 'results' && <ResultsScreen />}
      <div className="pointer-events-none absolute left-1/2 top-4 z-[80] flex -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => <div key={t.id} className="anim-pop glass rounded-xl px-4 py-2 font-display text-sm font-bold uppercase text-yellow-200">{t.text}</div>)}
      </div>
    </div>
  );
}
