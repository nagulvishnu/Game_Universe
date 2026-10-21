import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Procedural player starfighter — silhouette varies by ship config. Forward = -Z */
export function PlayerShipModel({ color, accent, scale = 1, wingSpan = 2.6, thrust = 0 }: { color: string; accent: string; scale?: number; wingSpan?: number; thrust?: number }) {
  const flame = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  useFrame((s) => {
    if (flame.current) {
      const f = 0.7 + thrust * 1.6 + Math.sin(s.clock.elapsedTime * 31) * 0.12;
      flame.current.scale.set(1, 1, f);
    }
    if (glow.current) glow.current.intensity = 6 + thrust * 22;
  });
  return (
    <group scale={scale}>
      {/* fuselage — nose toward -Z (flight direction) */}
      <mesh position={[0, 0, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.42, 3.4, 6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, -0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 1.6, 6]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* cockpit */}
      <mesh position={[0, 0.28, 0.15]} scale={[0.32, 0.22, 0.8]}>
        <sphereGeometry args={[0.5, 12, 10]} />
        <meshStandardMaterial color={accent} metalness={0.4} roughness={0.05} emissive={accent} emissiveIntensity={0.7} />
      </mesh>
      {/* main wings swept */}
      {[-1, 1].map(side => (
        <group key={side}>
          <mesh position={[side * wingSpan * 0.32, -0.02, 0.75]} rotation={[0, side * 0.5, side * 0.06]}>
            <boxGeometry args={[wingSpan * 0.72, 0.09, 1.1]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[side * wingSpan * 0.52, 0, 1.05]} rotation={[0, side * 0.5, 0]}>
            <boxGeometry args={[wingSpan * 0.6, 0.05, 0.18]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
          {/* wing cannon */}
          <mesh position={[side * wingSpan * 0.44, 0.02, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 1.1, 6]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* engine nacelle */}
          <mesh position={[side * 0.55, 0, 1.5]}>
            <boxGeometry args={[0.36, 0.36, 1.2]} />
            <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[side * 0.55, 0, 2.15]}>
            <circleGeometry args={[0.15, 10]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* vertical fin */}
      <mesh position={[0, 0.42, 1.25]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.07, 0.7, 0.8]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* engine flame — tip trailing toward +Z (rear) */}
      <mesh ref={flame} position={[0, 0, 2.5]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 1.8, 10]} />
        <meshBasicMaterial color={accent} transparent opacity={0.75} toneMapped={false} />
      </mesh>
      <pointLight ref={glow} position={[0, 0, 2.6]} color={accent} distance={16} />
    </group>
  );
}

/** Enemy craft — geometry varies by faction/behavior */
export function EnemyShipModel({ color, scale = 1, behavior }: { color: string; scale?: number; behavior: string }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (spin.current) spin.current.rotation.z += dt * (behavior === 'carrier' ? 0.5 : 1.4); });
  if (behavior === 'kamikaze') {
    return (
      <group scale={scale}>
        <mesh><octahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color="#450a0a" metalness={0.6} roughness={0.4} emissive={color} emissiveIntensity={0.8} /></mesh>
        <mesh><sphereGeometry args={[0.35, 10, 10]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
        <pointLight color={color} intensity={8} distance={10} />
      </group>
    );
  }
  if (behavior === 'heavy' || behavior === 'carrier' || behavior === 'sniper') {
    return (
      <group scale={scale}>
        <mesh><boxGeometry args={[2.2, 1.1, 4.4]} /><meshStandardMaterial color="#292524" metalness={0.8} roughness={0.35} /></mesh>
        <mesh position={[0, 0.3, -1.6]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.9, 1.8, 4]} /><meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={0.25} /></mesh>
        {[-1, 1].map(s => (
          <group key={s}>
            <mesh position={[s * 1.7, 0, 0.6]}><boxGeometry args={[1.4, 0.5, 2.6]} /><meshStandardMaterial color="#44403c" metalness={0.8} roughness={0.3} /></mesh>
            <mesh position={[s * 1.7, 0.4, -0.4]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.14, 0.14, 2, 6]} /><meshStandardMaterial color="#111" metalness={0.9} roughness={0.2} /></mesh>
            <mesh position={[s * 2.05, 0, 1.6]}><boxGeometry args={[0.1, 0.3, 0.8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
          </group>
        ))}
        <group ref={spin} position={[0, 0.85, 0.4]}>
          <mesh><torusGeometry args={[0.7, 0.12, 8, 18]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} metalness={0.6} roughness={0.3} /></mesh>
        </group>
        <mesh position={[0, 0, 2.3]}><circleGeometry args={[0.55, 10]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
        <pointLight color={color} intensity={10} distance={18} />
      </group>
    );
  }
  // fast fighters / swarm / teleporter — dart shape, nose toward -Z
  return (
    <group scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.5, 2.8, 4]} /><meshStandardMaterial color="#1c1917" metalness={0.75} roughness={0.3} emissive={color} emissiveIntensity={0.2} /></mesh>
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * 0.95, 0, 0.7]} rotation={[0, s * -0.7, s * 0.35]}>
          <boxGeometry args={[1.5, 0.07, 0.7]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.15, -0.3]}><sphereGeometry args={[0.22, 10, 10]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh position={[0, 0, 1.55]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.22, 0.9, 8]} /><meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} /></mesh>
    </group>
  );
}

/** Boss capital ship — large multi-part dreadnought */
export function BossModel({ color, scale = 8, bossId }: { color: string; scale?: number; bossId: string }) {
  const ring = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  useFrame((s, dt) => {
    if (ring.current) { ring.current.rotation.z += dt * 0.4; ring.current.rotation.x += dt * 0.15; }
    if (core.current) { const p = 1 + Math.sin(s.clock.elapsedTime * 2.4) * 0.12; core.current.scale.setScalar(p); }
  });
  const organic = bossId === 'devourer';
  return (
    <group scale={scale * 0.32}>
      <mesh><boxGeometry args={[4.6, 2.2, 11]} /><meshStandardMaterial color={organic ? '#3b0764' : '#1f2937'} metalness={0.8} roughness={0.35} emissive={color} emissiveIntensity={0.12} /></mesh>
      <mesh position={[0, 0.4, -6.4]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[2, 3.4, organic ? 8 : 4]} /><meshStandardMaterial color={organic ? '#581c87' : '#374151'} metalness={0.75} roughness={0.3} emissive={color} emissiveIntensity={0.3} /></mesh>
      {/* glowing core (weak point visual) */}
      <mesh ref={core} position={[0, 0, -3.4]}><sphereGeometry args={[0.95, 16, 16]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <pointLight position={[0, 0, -3]} color={color} intensity={60} distance={40} />
      {/* wing arrays */}
      {[-1, 1].map(s => (
        <group key={s}>
          <mesh position={[s * 4.6, 0, -0.5]} rotation={[0, 0, s * 0.12]}><boxGeometry args={[5, 0.5, 3.4]} /><meshStandardMaterial color="#111827" metalness={0.85} roughness={0.3} /></mesh>
          <mesh position={[s * 4.6, 0, 2.4]}><boxGeometry args={[4.2, 0.4, 2.2]} /><meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={0.45} /></mesh>
          {[-2.2, 0, 2.2].map((z, i) => (
            <mesh key={i} position={[s * 3.4, 1.4, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.22, 0.3, 2.6, 6]} /><meshStandardMaterial color="#030712" metalness={0.9} roughness={0.2} />
            </mesh>
          ))}
          <mesh position={[s * 6.8, 0, -1]}><boxGeometry args={[0.25, 1.4, 3]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
        </group>
      ))}
      {/* rotating command ring */}
      <group ref={ring} position={[0, 0, 3.6]}>
        <mesh><torusGeometry args={[3.2, 0.35, 8, 24]} /><meshStandardMaterial color={color} metalness={0.7} roughness={0.25} emissive={color} emissiveIntensity={0.8} /></mesh>
      </group>
      {/* spires */}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[(i - 1) * 1.4, 1.9, 1 + i * 1.2]}><coneGeometry args={[0.35, 2.4, 4]} /><meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} emissive={color} emissiveIntensity={0.5} /></mesh>
      ))}
      {/* engines */}
      {[-1.4, 0, 1.4].map((x, i) => (
        <mesh key={i} position={[x, 0, 5.6]}><circleGeometry args={[0.7, 12]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      ))}
    </group>
  );
}

export function StationModel({ damaged = 0 }: { damaged?: number }) {
  const ring = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ring.current) ring.current.rotation.y += dt * 0.08; });
  return (
    <group>
      <mesh><cylinderGeometry args={[3, 4, 14, 8]} /><meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} /></mesh>
      <group ref={ring}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[10, 1.4, 8, 28]} /><meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} emissive="#38bdf8" emissiveIntensity={0.15} /></mesh>
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 10, 0, Math.sin(i * Math.PI / 2) * 10]}>
            <boxGeometry args={[2.4, 2, 2.4]} /><meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} emissive={damaged > 0.5 ? '#ef4444' : '#38bdf8'} emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 9, 0]}><sphereGeometry args={[2, 12, 12]} /><meshStandardMaterial color="#0ea5e9" emissive="#38bdf8" emissiveIntensity={0.8} metalness={0.4} roughness={0.2} /></mesh>
      <pointLight color="#38bdf8" intensity={50} distance={70} />
    </group>
  );
}

export function TransportModel() {
  return (
    <group scale={1.6}>
      <mesh><boxGeometry args={[2.4, 1.8, 7]} /><meshStandardMaterial color="#365314" metalness={0.7} roughness={0.4} /></mesh>
      <mesh position={[0, 0.4, -4]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[1.1, 2, 6]} /><meshStandardMaterial color="#4d7c0f" metalness={0.7} roughness={0.35} /></mesh>
      {[-1.6, 1.6].map(x => (
        <mesh key={x} position={[x, 0, 0.5]}><boxGeometry args={[0.9, 1.2, 4.5]} /><meshStandardMaterial color="#3f6212" metalness={0.7} roughness={0.4} emissive="#a3e635" emissiveIntensity={0.12} /></mesh>
      ))}
      {[-1.6, 1.6].map(x => (
        <mesh key={x} position={[x, 0, 3.8]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.35, 1.4, 8]} /><meshBasicMaterial color="#bef264" transparent opacity={0.8} toneMapped={false} /></mesh>
      ))}
      <pointLight color="#a3e635" intensity={12} distance={22} />
    </group>
  );
}

export function DroneModel({ color = '#38bdf8' }: { color?: string }) {
  return (
    <group scale={0.55}>
      <mesh><octahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} emissive={color} emissiveIntensity={0.7} /></mesh>
      <mesh><sphereGeometry args={[0.25, 8, 8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  );
}
