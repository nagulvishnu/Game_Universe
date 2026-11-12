import { useEffect, useRef } from 'react';
import { Game } from './game/engine';
import { useStore } from './game/store';
import { Hud, Banners, TouchControls } from './ui/Hud';
import { Panels } from './ui/Panels';
import { Title, Overlays, Pause, Loading, Results, GameOver } from './ui/Menus';

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null), fxl = useRef<HTMLDivElement>(null), flash = useRef<HTMLDivElement>(null), vig = useRef<HTMLDivElement>(null);
  const scene = useStore((s) => s.scene); const touch = useStore((s) => s.touch); const panel = useStore((s) => s.panel); const paused = useStore((s) => s.paused);
  const results = useStore((s) => s.results); const over = useStore((s) => s.gameover); const overlay = useStore((s) => s.overlay); const loading = useStore((s) => s.loading);
  useEffect(() => {
    const g = new Game(canvas.current!, fxl.current!, flash.current!, vig.current!);
    return () => g.dispose();
  }, []);
  const playing = scene !== 'title';
  const blocked = !!(panel || paused || results || over || overlay || loading);
  return (
    <>
      <canvas id="game" ref={canvas} tabIndex={0} />
      <div ref={flash} className="flash" /><div ref={vig} className="vig" /><div ref={fxl} className="layer" style={{ zIndex: 9 }} />
      {playing && <Hud />}
      <Banners />
      {playing && touch && !blocked && <TouchControls />}
      {scene === 'title' && <Title />}
      <Pause /><Results /><GameOver /><Panels /><Overlays /><Loading />
    </>
  );
}
