import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { bindInput, fpsTick, frame, initEngine } from './game/engine';
import { audio } from './game/audio';
import { useGame } from './game/store';
import { Hud } from './ui/Hud';
import { Loading, MainMenu, Menus } from './ui/Menus';

function Loop() {
  const { scene, camera, gl } = useThree(); const booted = useRef(false);
  useEffect(() => {
    const unbind = bindInput(gl.domElement) as () => void;
    if (!booted.current) {
      booted.current = true;
      (async () => {
        try {
          const cam = camera as THREE.PerspectiveCamera; cam.far = 3000; cam.near = 0.15; cam.updateProjectionMatrix();
          await initEngine(scene, cam, (p, m) => useGame.setState({ loadPct: p, loadMsg: m }));
          const s = useGame.getState(); audio.init(); audio.setVol(s.settings.music, s.settings.sfx);
          useGame.setState({ screen: 'playing', loadPct: 1 });
        } catch (e) { console.error(e); useGame.setState({ loadMsg: 'Error while building the world: ' + (e as Error).message }); }
      })();
    }
    return () => { unbind?.(); };
  }, [gl, scene, camera]);
  useFrame((_, dt) => { frame(dt); fpsTick(dt); });
  return null;
}

export default function App() {
  const screen = useGame((s) => s.screen);
  const quality = useGame((s) => s.settings.quality);
  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      {screen !== 'menu' && (
        <Canvas
          shadows={{ type: THREE.PCFShadowMap }}
          dpr={quality === 'low' ? 1 : [1, 1.5]}
          camera={{ fov: 65, near: 0.15, far: 3000, position: [0, 4, -34] }}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <Loop />
        </Canvas>
      )}
      {screen === 'playing' && <><Hud /><Menus /></>}
      {screen === 'loading' && <Loading />}
      {screen === 'menu' && <MainMenu />}
    </div>
  );
}
