import { useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AnimatePresence } from 'framer-motion';
import { frame, initGame } from './game/control';
import { G, initInput, input } from './game/runtime';
import { useStore, type Tab } from './game/store';
import { audio } from './game/audio';
import { HUD } from './ui/HUD';
import { MenuPanel } from './ui/Panels';
import { Workshop } from './ui/Workshop';
import { Dialogue, Ending, Pause, SettingsPanel, Trade } from './ui/Overlays';
import { IntroOverlay, Loading, MainMenu } from './ui/Screens';
import { MobileControls } from './ui/Mobile';

function Engine() {
  const { scene, camera, gl } = useThree();
  useEffect(() => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; gl.outputColorSpace = THREE.SRGBColorSpace; initGame(scene, camera as THREE.PerspectiveCamera, gl); }, []);
  useFrame((_, d) => frame(d));
  return null;
}

const TAB_KEYS: Record<string, Tab> = { KeyI: 'inventory', KeyU: 'craft', KeyJ: 'journal', KeyP: 'skills', KeyK: 'kingdom' };
function Hotkeys() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = useStore.getState(); if (s.screen !== 'play' || e.repeat) return;
      if (e.code === 'Escape') { if (s.placing) { s.set_({ placing: null }); return; } if (s.panel) { if (s.panel === 'ending') return; s.closePanel(); } else s.openPanel('pause'); return; }
      const tab = TAB_KEYS[e.code];
      if (tab && !G.player.dead) { if (s.panel === 'menu') { if (s.tab === tab) s.closePanel(); else useStore.setState({ tab }); } else if (!s.panel) s.openPanel('menu', tab); }
    };
    const lock = () => { const s = useStore.getState(); input.locked = !!document.pointerLockElement; if (!document.pointerLockElement && s.screen === 'play' && !s.panel && !input.touch && !G.cam.cine) { s.openPanel('pause'); } };
    window.addEventListener('keydown', down); document.addEventListener('pointerlockchange', lock);
    const unsub = useStore.subscribe((s, p) => { if (s.panel && !p.panel) document.exitPointerLock?.(); if (s.screen !== 'play' && p.screen === 'play') document.exitPointerLock?.(); });
    const vis = () => { if (document.hidden) { const s = useStore.getState(); if (s.screen === 'play' && !s.panel) s.openPanel('pause'); } }; document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('keydown', down); document.removeEventListener('pointerlockchange', lock); document.removeEventListener('visibilitychange', vis); unsub(); };
  }, []);
  // touch Escape/I buttons route through input.pressed; poll
  useEffect(() => { const i = setInterval(() => { const s = useStore.getState(); if (s.screen !== 'play') return; if (input.pressed.has('Escape') && input.touch) { if (s.panel) s.closePanel(); else s.openPanel('pause'); } if (input.pressed.has('KeyI') && input.touch && !s.panel) s.openPanel('menu', 'inventory'); }, 50); return () => clearInterval(i); }, []);
  return null;
}

export default function App() {
  const s = useStore(); const [booted, setBooted] = useState(false); const [prog, setProg] = useState(0);
  useEffect(() => { initInput(() => { const st = useStore.getState(); return st.screen !== 'play' || st.panel !== null; }); audio.setVolumes(s.settings.master, s.settings.music, s.settings.sfx); const unlock = () => audio.init(); window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock); return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); }; }, []);
  useEffect(() => { let p = 0; const i = setInterval(() => { p = Math.min(1, p + 0.07 + Math.random() * 0.05); setProg(p); if (p >= 1) { clearInterval(i); setTimeout(() => { G.cam.introT = 0; setBooted(true); }, 350); } }, 140); return () => clearInterval(i); }, []);
  useEffect(() => { if (!booted) G.cam.introT = -2; }, [booted]);
  const q = s.settings.quality; const play = s.screen === 'play';
  return (
    <div id="game-root" className="fixed inset-0 bg-black overflow-hidden">
      <Canvas frameloop={s.panel === 'workshop' ? 'never' : 'always'} dpr={q === 'low' ? [0.6, 0.8] : q === 'medium' ? [1, 1.25] : [1, 2]} shadows={q !== 'low'} gl={{ antialias: q !== 'low', powerPreference: 'high-performance', alpha: false }} camera={{ fov: 62, near: 0.2, far: 4500, position: [0, 20, 40] }}>
        <Engine />
      </Canvas>
      <Hotkeys />
      {play && <HUD />}
      {play && input.touch && !s.panel && <MobileControls />}
      <AnimatePresence>
        {play && s.panel === 'menu' && <MenuPanel key="menu" />}
        {play && s.panel === 'workshop' && <Workshop key="ws" />}
        {play && s.panel === 'dialogue' && <Dialogue key="dlg" />}
        {play && s.panel === 'trade' && <Trade key="trade" />}
        {play && s.panel === 'pause' && <Pause key="pause" />}
        {play && s.panel === 'settings' && <SettingsPanel key="set" onClose={() => s.closePanel()} />}
        {play && s.panel === 'ending' && <Ending key="end" />}
      </AnimatePresence>
      {s.screen === 'intro' && booted && <IntroOverlay />}
      {s.screen === 'menu' && <MainMenu />}
      {!booted && <Loading progress={prog} />}
    </div>
  );
}
