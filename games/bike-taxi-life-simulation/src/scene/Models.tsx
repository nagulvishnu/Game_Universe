import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { rt } from '../game/runtime';

const M = {
  dark: new THREE.MeshStandardMaterial({ color: '#1f2227', roughness: 0.6, metalness: 0.4 }),
  tyre: new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.95 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.25, metalness: 0.85 }),
  seat: new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: '#8fb8d8', roughness: 0.1, metalness: 0.6 }),
  head: new THREE.MeshStandardMaterial({ color: '#fff6c9', emissive: new THREE.Color('#fff2b0'), emissiveIntensity: 0.4 }),
  tail: new THREE.MeshStandardMaterial({ color: '#7f1010', emissive: new THREE.Color('#ff1010'), emissiveIntensity: 0.4 }),
  amber: new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: new THREE.Color('#f59e0b'), emissiveIntensity: 0 }),
};
export function updateLightMaterials() {
  M.head.emissiveIntensity = 0.5 + rt.night * 3.5;
  M.tail.emissiveIntensity = 0.5 + rt.night * 1.5;
}
const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
const box = new THREE.BoxGeometry(1, 1, 1);
const sph = new THREE.SphereGeometry(1, 12, 10);

export function Person({ shirt, skin = '#c68642', pose = 'stand', pants = '#2b3445', helmet = false, phase = 0 }: { shirt: string; skin?: string; pose?: 'stand' | 'sit' | 'walk'; pants?: string; helmet?: boolean; phase?: number }) {
  const l = useRef<THREE.Group>(null), r = useRef<THREE.Group>(null), al = useRef<THREE.Group>(null), ar = useRef<THREE.Group>(null);
  const shirtMat = useMemo(() => new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 }), [shirt]);
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }), [skin]);
  const pantMat = useMemo(() => new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 }), [pants]);
  useFrame(() => {
    if (pose !== 'walk') return;
    const s = Math.sin(rt.walk.stride + phase) * Math.min(1, rt.walk.speed / 2) * 0.9;
    if (l.current) l.current.rotation.x = s; if (r.current) r.current.rotation.x = -s;
    if (al.current) al.current.rotation.x = -s * 0.8; if (ar.current) ar.current.rotation.x = s * 0.8;
  });
  const sit = pose === 'sit';
  return (
    <group>
      <group position={[0, sit ? 0.95 : 1.12, 0]} rotation={[sit ? 0.45 : 0, 0, 0]}>
        <mesh geometry={box} material={shirtMat} scale={[0.46, 0.62, 0.26]} castShadow />
        <mesh geometry={sph} material={skinMat} scale={0.13} position={[0, 0.46, 0.0]} castShadow />
        {helmet && <mesh geometry={sph} material={M.dark} scale={[0.17, 0.15, 0.18]} position={[0, 0.5, 0]} />}
        <group ref={al} position={[-0.3, 0.25, 0]} rotation={[sit ? -1.1 : 0, 0, 0]}><mesh geometry={box} material={shirtMat} scale={[0.12, 0.55, 0.12]} position={[0, -0.25, 0]} /></group>
        <group ref={ar} position={[0.3, 0.25, 0]} rotation={[sit ? -1.1 : 0, 0, 0]}><mesh geometry={box} material={shirtMat} scale={[0.12, 0.55, 0.12]} position={[0, -0.25, 0]} /></group>
      </group>
      <group ref={l} position={[-0.12, sit ? 0.72 : 0.8, 0]} rotation={[sit ? -1.2 : 0, 0, 0]}><mesh geometry={box} material={pantMat} scale={[0.17, 0.78, 0.18]} position={[0, -0.36, 0]} castShadow /></group>
      <group ref={r} position={[0.12, sit ? 0.72 : 0.8, 0]} rotation={[sit ? -1.2 : 0, 0, 0]}><mesh geometry={box} material={pantMat} scale={[0.17, 0.78, 0.18]} position={[0, -0.36, 0]} castShadow /></group>
    </group>
  );
}

export interface BikeVis { lean: number; steer: number; speed: number; pitch: number; indicator?: number; fallen?: number }
export function Bike({ color, decal = 0, getVis, headlight = false, rider, passenger, hideRider = false, brakeLight = false }: {
  color: string; decal?: number; getVis?: () => BikeVis; headlight?: boolean;
  rider?: { shirt: string; skin?: string } | null; passenger?: { shirt: string; skin?: string } | null; hideRider?: boolean; brakeLight?: boolean;
}) {
  const tgt = useRef<THREE.Object3D>(null);
  const root = useRef<THREE.Group>(null), fork = useRef<THREE.Group>(null), fw = useRef<THREE.Mesh>(null), rw = useRef<THREE.Mesh>(null), ind = useRef<THREE.Mesh>(null), spot = useRef<THREE.SpotLight>(null);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 }), [color]);
  const stripe = useMemo(() => new THREE.MeshStandardMaterial({ color: ['#fff', '#facc15', '#111', '#fff', '#22d3ee'][decal % 5] }), [decal]);
  useEffect(() => { if (spot.current && tgt.current) spot.current.target = tgt.current; });
  useFrame((_, dt) => {
    const v = getVis ? getVis() : null;
    if (!v) return;
    if (root.current) {
      root.current.rotation.z = v.lean + (v.fallen ? v.fallen * 1.45 : 0);
      root.current.rotation.x = v.pitch;
      root.current.position.y = v.fallen ? 0.25 * v.fallen : 0;
    }
    if (fork.current) fork.current.rotation.y = -v.steer * 0.35;
    const spin = (v.speed / 0.33) * dt;
    if (fw.current) fw.current.rotation.x += spin; if (rw.current) rw.current.rotation.x += spin;
    if (ind.current) { const on = v.indicator && Math.floor(performance.now() / 350) % 2 === 0; (ind.current.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 3 : 0; ind.current.position.x = v.indicator === 1 ? -0.3 : 0.3; ind.current.visible = !!v.indicator; }
    if (spot.current) { spot.current.visible = headlight && rt.headlights && rt.night > 0.2; }
  });
  return (
    <group ref={root}>
      <mesh ref={rw} geometry={cyl} material={M.tyre} scale={[0.33, 0.14, 0.33]} rotation={[0, 0, Math.PI / 2]} position={[0, 0.33, -0.68]} castShadow />
      <group ref={fork} position={[0, 0.9, 0.62]}>
        <mesh ref={fw} geometry={cyl} material={M.tyre} scale={[0.33, 0.12, 0.33]} rotation={[0, 0, Math.PI / 2]} position={[0, -0.57, 0.05]} castShadow />
        <mesh geometry={cyl} material={M.chrome} scale={[0.03, 0.62, 0.03]} position={[0, -0.28, 0.02]} rotation={[0.2, 0, 0]} />
        <mesh geometry={box} material={M.dark} scale={[0.72, 0.045, 0.045]} position={[0, 0.12, -0.05]} />
        <mesh geometry={box} material={M.dark} scale={[0.22, 0.2, 0.06]} position={[0, 0.05, 0.12]} />
        <mesh geometry={sph} material={M.head} scale={[0.12, 0.12, 0.09]} position={[0, -0.03, 0.2]} />
        <mesh ref={ind} geometry={sph} material={M.amber} scale={0.05} position={[0.3, 0.02, 0.12]} visible={false} />
        {headlight && <spotLight ref={spot} position={[0, 0, 0.3]} angle={0.5} penumbra={0.6} intensity={60} distance={55} color="#fff3c4" visible={false} />}
        {headlight && <object3D ref={tgt} position={[0, -0.4, 10]} />}
      </group>
      <mesh geometry={box} material={M.dark} scale={[0.3, 0.32, 0.5]} position={[0, 0.5, 0.05]} castShadow />
      <mesh geometry={box} material={body} scale={[0.32, 0.26, 0.55]} position={[0, 0.82, 0.18]} castShadow />
      <mesh geometry={box} material={stripe} scale={[0.34, 0.03, 0.4]} position={[0, 0.96, 0.18]} />
      <mesh geometry={box} material={M.seat} scale={[0.3, 0.1, 0.8]} position={[0, 0.78, -0.4]} castShadow />
      <mesh geometry={box} material={body} scale={[0.28, 0.06, 0.55]} position={[0, 0.58, -0.82]} />
      <mesh geometry={cyl} material={M.chrome} scale={[0.05, 0.5, 0.05]} position={[0.2, 0.4, -0.4]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={box} material={brakeLight ? M.tail : M.tail} scale={[0.14, 0.06, 0.06]} position={[0, 0.72, -1.12]} />
      {rider && !hideRider && <group position={[0, 0, -0.38]}><Person shirt={rider.shirt} skin={rider.skin} pose="sit" helmet /></group>}
      {passenger && <group position={[0, 0.02, -0.78]}><Person shirt={passenger.shirt} skin={passenger.skin} pose="sit" helmet pants="#3b4252" /></group>}
    </group>
  );
}

export function VehicleMesh({ kind, color, len, police }: { kind: string; color: string; len: number; police?: boolean }) {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35 }), [color]);
  const bar = useRef<THREE.Mesh>(null);
  useFrame(() => { if (police && bar.current) { const m = bar.current.material as THREE.MeshStandardMaterial; const f = Math.floor(performance.now() / 220) % 2; m.color.set(f ? '#ef4444' : '#3b82f6'); m.emissive.set(f ? '#ef4444' : '#3b82f6'); } });
  const wheels = (w: number, l: number, r = 0.36) => [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], i) => (
    <mesh key={i} geometry={cyl} material={M.tyre} scale={[r, 0.14, r]} rotation={[0, 0, Math.PI / 2]} position={[sx * w, r, sz * l]} />
  ));
  if (kind === 'bike') return <group scale={0.95}><Bike color={color} rider={{ shirt: '#64748b' }} getVis={() => ({ lean: 0, steer: 0, speed: 6, pitch: 0 })} headlight={false} /></group>;
  if (kind === 'bus') return (
    <group>
      <mesh geometry={box} material={body} scale={[2.5, 2.7, len]} position={[0, 1.8, 0]} castShadow />
      <mesh geometry={box} material={M.glass} scale={[2.55, 0.9, len - 1]} position={[0, 2.35, 0]} />
      <mesh geometry={box} material={M.chrome} scale={[2.52, 0.12, len]} position={[0, 0.7, 0]} />
      {wheels(1.2, len / 2 - 1.8, 0.5)}
      <mesh geometry={box} material={M.head} scale={[1.8, 0.2, 0.1]} position={[0, 0.9, len / 2]} />
      <mesh geometry={box} material={M.tail} scale={[1.8, 0.2, 0.1]} position={[0, 0.9, -len / 2]} />
    </group>
  );
  if (kind === 'truck') return (
    <group>
      <mesh geometry={box} material={body} scale={[2.2, 2.2, 2.2]} position={[0, 1.5, len / 2 - 1.2]} castShadow />
      <mesh geometry={box} material={M.glass} scale={[2.0, 0.8, 0.1]} position={[0, 2.0, len / 2 - 0.1]} />
      <mesh geometry={box} material={new THREE.MeshStandardMaterial({ color: '#d1d5db' })} scale={[2.4, 2.6, len - 3]} position={[0, 1.7, -1.4]} castShadow />
      {wheels(1.1, len / 2 - 1.2, 0.5)}
      <mesh geometry={box} material={M.head} scale={[1.5, 0.2, 0.1]} position={[0, 0.9, len / 2 + 0.05]} />
    </group>
  );
  if (kind === 'auto') return (
    <group>
      <mesh geometry={box} material={body} scale={[1.3, 0.7, 2.4]} position={[0, 0.65, 0]} castShadow />
      <mesh geometry={box} material={new THREE.MeshStandardMaterial({ color: '#facc15' })} scale={[1.3, 0.1, 1.9]} position={[0, 1.65, -0.2]} castShadow />
      <mesh geometry={box} material={M.glass} scale={[1.2, 0.7, 0.05]} position={[0, 1.2, 0.8]} />
      {[[-0.6, -0.8], [0.6, -0.8], [0, 1]].map(([x, z], i) => <mesh key={i} geometry={cyl} material={M.tyre} scale={[0.28, 0.1, 0.28]} rotation={[0, 0, Math.PI / 2]} position={[x, 0.28, z]} />)}
      <mesh geometry={sph} material={M.head} scale={0.1} position={[0, 0.7, 1.25]} />
    </group>
  );
  return (
    <group>
      <mesh geometry={box} material={body} scale={[1.8, 0.65, 4.2]} position={[0, 0.65, 0]} castShadow />
      <mesh geometry={box} material={M.glass} scale={[1.6, 0.55, 2.2]} position={[0, 1.22, -0.2]} castShadow />
      <mesh geometry={box} material={body} scale={[1.62, 0.08, 2.1]} position={[0, 1.52, -0.2]} />
      {wheels(0.9, 1.3)}
      <mesh geometry={box} material={M.head} scale={[0.4, 0.15, 0.08]} position={[-0.6, 0.72, 2.1]} /><mesh geometry={box} material={M.head} scale={[0.4, 0.15, 0.08]} position={[0.6, 0.72, 2.1]} />
      <mesh geometry={box} material={M.tail} scale={[0.4, 0.15, 0.08]} position={[-0.6, 0.72, -2.1]} /><mesh geometry={box} material={M.tail} scale={[0.4, 0.15, 0.08]} position={[0.6, 0.72, -2.1]} />
      {kind === 'taxi' && <mesh geometry={box} material={new THREE.MeshStandardMaterial({ color: '#111' })} scale={[1.4, 0.06, 1.2]} position={[0, 1.58, -0.2]} />}
      {police && <><mesh geometry={box} material={new THREE.MeshStandardMaterial({ color: '#1d4ed8' })} scale={[1.82, 0.2, 4.0]} position={[0, 0.72, 0]} /><mesh ref={bar} geometry={box} material={new THREE.MeshStandardMaterial({ color: '#3b82f6', emissive: new THREE.Color('#3b82f6'), emissiveIntensity: 2 })} scale={[1.0, 0.14, 0.35]} position={[0, 1.65, -0.2]} /></>}
    </group>
  );
}
