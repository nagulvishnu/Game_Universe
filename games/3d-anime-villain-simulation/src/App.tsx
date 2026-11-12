import GameCanvas from './game/Game';
import { useGame } from './game/store';
import { Menu } from './ui/Menu';
import { HUD } from './ui/HUD';
import { Overlay } from './ui/Overlay';

export default function App() {
  const screen = useGame((s) => s.screen);
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <GameCanvas />
      {screen === 'menu' ? <Menu /> : <><HUD /><Overlay /></>}
    </div>
  );
}
