import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lookFor } from '../data/characters';
import { Fighter } from '../engine/types';
import { animateRig, createRig, setRigGear, setRigWeapon } from './characterRig';
import { newWeapon } from '../data/weapons';
import { gradientMap } from './materials';

function Model({ charId, skin, pose, spin }: { charId: string; skin: number; pose: 'idle' | 'victory' | 'aim'; spin: boolean }) {
  const holder = useRef<THREE.Group>(null);
  const look = useMemo(() => lookFor(charId, skin), [charId, skin]);
  const rig = useMemo(() => createRig(look), [look]);
  const f = useMemo(() => {
    const x = new Fighter(-1, 'preview', false, charId, look);
    x.state = 'ground'; x.slots[0] = newWeapon('ar01'); x.cur = 0; x.armor = 2; x.helmet = 2; x.pack = 1;
    return x;
  }, [charId, look]);
  useEffect(() => { holder.current?.add(rig.root); return () => { rig.root.removeFromParent(); }; }, [rig]);
  useFrame((s, dt) => {
    f.victory = pose === 'victory'; f.aiming = pose === 'aim';
    f.yaw = 0; f.pitch = 0; f.bodyYaw = spin ? Math.sin(s.clock.elapsedTime * 0.5) * 0.7 + 0.4 : 0.3;
    setRigGear(rig, f); setRigWeapon(rig, f.weapon);
    animateRig(rig, f, dt, s.clock.elapsedTime);
  });
  return <group ref={holder} />;
}

export function CharacterPreview({ charId, skin = 0, pose = 'idle', spin = true, className = '' }: { charId: string; skin?: number; pose?: 'idle' | 'victory' | 'aim'; spin?: boolean; className?: string }) {
  const grad = useMemo(() => gradientMap(), []);
  void grad;
  return (
    <div className={className}>
      <Canvas dpr={[1, 1.5]} camera={{ fov: 32, position: [0, 1.25, 4.3] }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 4]} intensity={2.4} color="#fff0e0" />
        <directionalLight position={[-4, 2, -3]} intensity={1.4} color="#7fb0ff" />
        <Model charId={charId} skin={skin} pose={pose} spin={spin} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.5, 0.9, 40]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.55} />
        </mesh>
      </Canvas>
    </div>
  );
}
