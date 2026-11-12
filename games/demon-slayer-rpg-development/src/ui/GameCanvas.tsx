import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type * as THREE from 'three';
import { disposeGame, initGame, qualityFor, updateGame } from '../game/engine/game';
import { useStore } from '../game/store';

function Runner() {
  const { scene, camera, gl } = useThree();
  useEffect(() => {
    initGame(scene, camera as THREE.PerspectiveCamera, gl, useStore.getState().launch);
    return () => disposeGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    updateGame(delta, gl.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360)));
  });
  return null;
}

export function GameCanvas() {
  const gfx = useStore((s) => s.profile.settings.gfx); const rs = useStore((s) => s.profile.settings.renderScale);
  const q = qualityFor({ ...useStore.getState().profile.settings, gfx, renderScale: rs });
  const dpr = Math.min(window.devicePixelRatio, 2) * Math.min(1.5, q.pr);
  return (
    <Canvas flat shadows dpr={dpr} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 62, near: 0.1, far: 800, position: [0, 6, 12] }} style={{ position: 'absolute', inset: 0 }}>
      <Runner />
    </Canvas>
  );
}
