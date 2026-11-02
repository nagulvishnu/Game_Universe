import { Canvas } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BattleScene } from './components/BattleScene';
import { CityScene } from './components/CityScene';
import { ShowcaseScene } from './components/ShowcaseScene';
import { audio } from './game/audio/audio';
import { runtime } from './game/runtime';
import { useGame } from './game/store';
import { BattleHud, ResultScreen } from './ui/BattleHud';
import { Dialogue } from './ui/Dialogue';
import { CityHud, MapOverlay, PauseMenu, ToastLayer } from './ui/Hud';
import { MainMenu } from './ui/MainMenu';
import { Board, BattleSetup, Profile, SettingsPanel } from './ui/Panels';
import { TournamentUI } from './ui/Tournament';
import { Workshop } from './ui/Workshop';

function InputManager() {
  useEffect(() => {
    let dragging = false;
    const typing = (e: Event) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
    const kd = (e: KeyboardEvent) => {
      if (typing(e)) return;
      audio.unlock();
      const st = useGame.getState();
      if (st.scene !== 'menu' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      runtime.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Escape') {
        if (st.curtain.state !== 'none' || st.overlay === 'result') return;
        if (st.scene === 'menu') { if (st.overlay) st.closeOverlay(); return; }
        if (st.overlay) st.closeOverlay();
        else if (st.scene === 'city' || st.battle?.phase === 'fight' || st.battle?.phase === 'countdown' || st.battle?.phase === 'intro') st.openOverlay('pause');
      } else if (e.code === 'KeyE' && st.scene === 'city' && !st.overlay) runtime.interactReq = true;
      else if (e.code === 'KeyM' && st.scene === 'city') { if (st.overlay === 'map') st.closeOverlay(); else if (!st.overlay) st.openOverlay('map'); }
    };
    const ku = (e: KeyboardEvent) => runtime.keys.delete(e.code);
    const blur = () => runtime.keys.clear();
    const mm = (e: MouseEvent) => {
      const st = useGame.getState();
      if (st.scene !== 'city' || st.overlay) return;
      if (!runtime.locked && !dragging) return;
      const k = 0.0028 * runtime.mouseSens * runtime.camSens;
      runtime.camYaw -= e.movementX * k;
      runtime.pitch = Math.max(-0.12, Math.min(1.3, runtime.pitch + e.movementY * k * (runtime.invertY ? -1 : 1) * 0.9));
    };
    const pd = (e: PointerEvent) => {
      audio.unlock();
      const st = useGame.getState();
      if (st.scene === 'city' && !st.overlay && (e.target as HTMLElement).tagName === 'CANVAS') {
        dragging = true;
        try { const p = (e.target as HTMLCanvasElement).requestPointerLock?.() as unknown; if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => undefined); } catch { /* ignore */ }
      }
    };
    const pu = () => { dragging = false; };
    const wheel = (e: WheelEvent) => {
      const st = useGame.getState();
      if (st.scene === 'city' && !st.overlay) runtime.zoom = Math.max(3, Math.min(14, runtime.zoom + e.deltaY * 0.004));
    };
    const plc = () => {
      runtime.locked = !!document.pointerLockElement;
      const st = useGame.getState();
      if (!runtime.locked && st.scene === 'city' && !st.overlay && st.curtain.state === 'none') st.openOverlay('pause');
    };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    window.addEventListener('mousemove', mm); window.addEventListener('pointerdown', pd); window.addEventListener('pointerup', pu);
    window.addEventListener('wheel', wheel, { passive: true }); document.addEventListener('pointerlockchange', plc);
    return () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      window.removeEventListener('mousemove', mm); window.removeEventListener('pointerdown', pd); window.removeEventListener('pointerup', pu);
      window.removeEventListener('wheel', wheel); document.removeEventListener('pointerlockchange', plc);
    };
  }, []);
  return null;
}

function Curtain() {
  const c = useGame((s) => s.curtain);
  if (c.state === 'none') return null;
  return (
    <div className={`absolute inset-0 z-50 flex items-center justify-center ${c.state === 'in' ? 'curtain-in' : 'curtain-out'}`} style={{ background: 'linear-gradient(120deg,#0b0a24 0%,#2a1060 45%,#ff3d9a 55%,#0b0a24 100%)' }}>
      <div className="title-font pop text-7xl text-white drop-shadow-[0_6px_0_#35d0ff]">{c.text}</div>
    </div>
  );
}

export default function App() {
  const scene = useGame((s) => s.scene);
  const overlay = useGame((s) => s.overlay);
  const settings = useGame((s) => s.settings);
  const init = useGame((s) => s.init);
  const booted = useRef(false);
  useEffect(() => { if (!booted.current) { booted.current = true; init(); } }, [init]);
  useEffect(() => { audio.setVolumes(settings.sfx, settings.music); }, [settings.sfx, settings.music]);
  // periodic autosave of position / clock while exploring
  useEffect(() => {
    const id = setInterval(() => { const s = useGame.getState(); if (s.scene === 'city' && s.hasSave) s.persist(); }, 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => { const s = useGame.getState(); if (s.scene === 'city') s.save.stats.playSeconds += 5; }, 5000);
    return () => clearInterval(id);
  }, []);

  const workshop = overlay === 'customize' || overlay === 'shop';
  const showcase = scene === 'menu' || workshop;
  const dpr = Math.min(2, window.devicePixelRatio || 1) * settings.resolution;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <Canvas
        flat
        shadows={settings.quality !== 'low'}
        dpr={dpr}
        camera={{ fov: 55, near: 0.1, far: 700, position: [0, 3, 8] }}
        gl={{ antialias: settings.quality !== 'low', powerPreference: 'high-performance' }}
        frameloop={overlay === 'pause' ? 'demand' : 'always'}
        onCreated={({ gl, scene: sc }) => {
          const pm = new THREE.PMREMGenerator(gl);
          sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
          sc.environmentIntensity = 0.5;
          pm.dispose();
        }}
      >
        {scene === 'battle' ? <BattleScene /> : showcase ? <ShowcaseScene /> : <CityScene />}
      </Canvas>
      <InputManager />
      {scene === 'menu' && <MainMenu />}
      {scene === 'city' && !workshop && <CityHud />}
      {scene === 'battle' && <BattleHud />}
      {overlay === 'dialogue' && <Dialogue />}
      {workshop && <Workshop />}
      {overlay === 'profile' && <Profile />}
      {overlay === 'settings' && <SettingsPanel />}
      {overlay === 'quick' && <BattleSetup training={false} />}
      {overlay === 'training' && <BattleSetup training />}
      {overlay === 'tournament' && <TournamentUI />}
      {overlay === 'board' && <Board />}
      {overlay === 'map' && <MapOverlay />}
      {overlay === 'pause' && <PauseMenu />}
      {overlay === 'result' && <ResultScreen />}
      <ToastLayer />
      <Curtain />
    </div>
  );
}
