import { Component, useEffect, type ReactNode } from 'react';
import { useGame } from './game/store';
import GameCanvas from './scene/GameCanvas';
import { HUD } from './ui/HUD';
import { MainMenu } from './ui/MainMenu';
import { Phone } from './ui/Phone';
import { PanelHost } from './ui/Panels';
import { setVolume } from './game/audio';

class Boundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: Error) { return { err: e.message }; }
  render() {
    if (this.state.err) return <div className="flex h-full items-center justify-center bg-slate-950 p-8 text-center text-white"><div><h2 className="text-xl font-bold text-rose-300">Something went wrong</h2><p className="my-2 text-sm text-slate-300">{this.state.err}</p><button onClick={() => location.reload()} className="rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-900">Reload (progress is autosaved)</button></div></div>;
    return this.props.children;
  }
}

function Game() {
  const phone = useGame((s) => s.ui.phone);
  const hasGame = useGame((s) => !!s.g);
  const volume = useGame((s) => s.g?.settings.volume);
  const save = useGame((s) => s.save);
  useEffect(() => { if (volume !== undefined) setVolume(volume); }, [volume]);
  useEffect(() => { const id = setInterval(() => save('autosave'), 25000); return () => clearInterval(id); }, [save]);
  if (!hasGame) return null;
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <GameCanvas />
      <HUD />
      {phone && <Phone />}
      <PanelHost />
    </div>
  );
}

export default function App() {
  const screen = useGame((s) => s.ui.screen);
  return (
    <div className="fixed inset-0 overflow-hidden bg-black font-sans">
      <Boundary>{screen === 'menu' ? <MainMenu /> : <Game />}</Boundary>
    </div>
  );
}
