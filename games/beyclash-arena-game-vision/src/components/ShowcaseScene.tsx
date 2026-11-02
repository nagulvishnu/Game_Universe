import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PLAYER_LOOKS } from '../data/player';
import { audio } from '../game/audio/audio';
import { useGame } from '../game/store';
import { BeybladeModel, makeHandle } from './BeybladeModel';
import { Character, makeAnim } from './Character';
import { fx, FxLayer } from './Fx';

/** Menu / customization stage: spinning player Beyblade (live preview of the draft configuration). */
export function ShowcaseScene() {
  const draft = useGame((s) => s.draftConfig);
  const saved = useGame((s) => s.save.config);
  const outfit = useGame((s) => s.save.profile.outfit);
  const overlay = useGame((s) => s.overlay);
  const scene3 = useGame((s) => s.scene);
  const workshop = overlay === 'customize' || overlay === 'shop';
  const config = draft ?? saved;
  const { scene, camera } = useThree();
  const handle = useRef(makeHandle());
  const anim = useRef(makeAnim());
  const t = useRef(0);

  useEffect(() => {
    const prevBg = scene.background, prevFog = scene.fog;
    scene.background = new THREE.Color('#0b0a24');
    scene.fog = null;
    scene.environmentIntensity = 0.9;
    fx.clear();
    if (scene3 === 'menu') { audio.music('menu'); audio.ambient(false); }
    return () => { scene.background = prevBg; scene.fog = prevFog; };
  }, [scene, scene3]);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    t.current += dt;
    const h = handle.current;
    if (h.spin) h.spin.rotation.y += dt * 14;
    if (h.root) { h.root.position.y = 1.15 + Math.sin(t.current * 1.6) * 0.08; h.root.rotation.z = Math.sin(t.current * 2) * 0.06; h.root.rotation.x = 0.15; }
    const a = Math.sin(t.current * 0.35) * 0.25;
    const cx = workshop ? 1.2 : 0.8;
    camera.position.set(cx + Math.sin(a) * 6, 2.2, 7 + Math.cos(a) * 0.5);
    camera.lookAt(cx - (workshop ? 0 : 0.4), 1.2, 0);
    if (Math.random() < 0.5 && h.root) fx.trail(h.root.position.x + (Math.random() - 0.5) * 0.9, 1.1, (Math.random() - 0.5) * 0.9, config.color);
  });

  const look = PLAYER_LOOKS[outfit % PLAYER_LOOKS.length].look;
  const bx = workshop ? 1.4 : 0.8;
  return (
    <>
      <hemisphereLight args={['#9fb4ff', '#2a1a4a', 0.6]} />
      <directionalLight position={[4, 8, 6]} intensity={1.3} />
      <pointLight position={[-4, 3, 3]} intensity={18} color="#ff3d9a" />
      <pointLight position={[5, 3, 3]} intensity={18} color="#35d0ff" />
      <group position={[bx, 0, 0]} scale={workshop ? 2.3 : 1.9}>
        <group position={[0, 0, 0]}><BeybladeModel config={config} handle={handle} /></group>
      </group>
      <mesh position={[bx, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[3.2, 48]} /><meshStandardMaterial color="#1a1850" metalness={0.6} roughness={0.35} /></mesh>
      <mesh position={[bx, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[3, 3.2, 64]} /><meshBasicMaterial color="#35d0ff" /></mesh>
      <mesh position={[bx, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.2, 2.28, 64]} /><meshBasicMaterial color="#ff3d9a" /></mesh>
      {!workshop && (
        <group position={[4.2, 0, 0.5]} rotation={[0, -0.5, 0]} scale={1.25}>
          <Character look={look} anim={anim} />
        </group>
      )}
      <FxLayer />
    </>
  );
}
