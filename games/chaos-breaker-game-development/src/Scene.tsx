import { useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { applyQuality, engineUpdate, initEngine, setArena } from './game/engine';
import { useGame } from './game/store';

function Engine() {
  const { scene, camera, gl } = useThree();
  useEffect(() => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; initEngine(scene, camera as THREE.PerspectiveCamera, gl); }, [scene, camera, gl]);
  useFrame((_, dt) => engineUpdate(dt));
  return null;
}
function QualityWatcher() {
  const q = useGame(s => s.settings.quality), fx = useGame(s => s.settings.fx), sh = useGame(s => s.settings.shadows), arena = useGame(s => s.arena);
  useEffect(() => { applyQuality(); }, [q, fx, sh]);
  useEffect(() => { try { setArena(arena); } catch { /* engine not ready */ } }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function Scene() {
  const q = useGame(s => s.settings.quality), shadows = useGame(s => s.settings.shadows);
  return (
    <Canvas shadows={shadows && q !== 'low'} dpr={q === 'low' ? [1, 1.25] : q === 'medium' ? [1, 1.5] : [1, 2]}
      gl={{ antialias: q !== 'low', powerPreference: 'high-performance', alpha: false, stencil: false }} camera={{ fov: 62, near: .1, far: 600, position: [0, 3, 10] }}>
      <Engine /><QualityWatcher />
      {q !== 'low' && <EffectComposer multisampling={q === 'high' ? 4 : 0} enableNormalPass={false}>
        <Bloom intensity={q === 'high' ? 1.0 : .7} luminanceThreshold={.72} luminanceSmoothing={.25} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>}
    </Canvas>
  );
}
