import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../game/store';
import { Atmosphere } from './Atmosphere';
import { City } from './City';
import { CrowdClusters, EmployeeRiders, Markers, ParkedBikes, Pedestrians, StreetProps, Traffic } from './Actors';
import { Rider } from './Rider';
import { Interior } from './Interior';

function World() {
  const interior = useGame((s) => s.g?.player.interior ?? null);
  return (
    <>
      <Atmosphere />
      <group visible={!interior}>
        <City />
        <StreetProps />
        <Traffic />
        <Pedestrians />
        <CrowdClusters />
        <ParkedBikes />
        <EmployeeRiders />
        <Markers />
      </group>
      <Rider />
      {interior && <Interior />}
    </>
  );
}

export default function GameCanvas() {
  const quality = useGame((s) => s.g?.settings.quality ?? 'medium');
  const shadows = useGame((s) => s.g?.settings.shadows ?? true);
  return (
    <Canvas
      shadows={shadows ? { type: THREE.PCFShadowMap } : false}
      dpr={quality === 'low' ? 0.75 : quality === 'medium' ? [1, 1.5] : [1, 2]}
      camera={{ fov: 62, near: 0.2, far: 2500, position: [0, 6, -8] }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <World />
    </Canvas>
  );
}
