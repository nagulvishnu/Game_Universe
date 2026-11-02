import { useMemo } from 'react';
import * as THREE from 'three';
import { useGame } from '../game/store';
import { poiById } from '../game/world/city';
import { interiorFor } from './interiorDefs';
import { makeSignTexture } from './City';

/** Lazy-loaded interior: only the building the player is inside is ever built. */
export function Interior() {
  const id = useGame((s) => s.g?.player.interior ?? null);
  const tier = useGame((s) => s.g?.player.homeTier ?? 0);
  const company = useGame((s) => s.g?.company);
  const poi = id ? poiById.get(id) : null;
  const def = useMemo(() => (poi ? interiorFor(poi.kind, tier) : null), [poi, tier]);
  const labels = useMemo(() => (def ? def.hotspots.map((h) => makeSignTexture(h.label.split(' — ')[0], '#0f172a', '#fde68a', 384, 80)) : []), [def]);
  const brandTex = useMemo(() => (company && poi && (poi.kind === 'hq' || poi.kind === 'branch') ? makeSignTexture(company.branding.name, company.branding.primary, '#fff', 512, 128) : null), [company, poi]);
  const exitTex = useMemo(() => makeSignTexture('EXIT', '#0369a1', '#fff', 256, 64), []);
  if (!poi || !def) return null;
  const { hw, hd } = def;
  return (
    <group>
      <ambientLight intensity={1.2} />
      <pointLight position={[0, 4, 0]} intensity={90} distance={30} color="#fff4de" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[hw * 2, hd * 2]} /><meshStandardMaterial color={def.floor} roughness={0.8} /></mesh>
      {/* walls (front wall left open for dollhouse camera) */}
      <mesh position={[0, 1.8, -hd]}><boxGeometry args={[hw * 2, 3.6, 0.2]} /><meshStandardMaterial color={def.wall} /></mesh>
      <mesh position={[-hw, 1.8, 0]}><boxGeometry args={[0.2, 3.6, hd * 2]} /><meshStandardMaterial color={def.wall} /></mesh>
      <mesh position={[hw, 1.8, 0]}><boxGeometry args={[0.2, 3.6, hd * 2]} /><meshStandardMaterial color={def.wall} /></mesh>
      <mesh position={[0, 0.9, hd]}><boxGeometry args={[hw * 2, 1.8, 0.1]} /><meshStandardMaterial color={def.wall} transparent opacity={0.35} /></mesh>
      <mesh position={[0, 1.2, hd - 0.05]}><boxGeometry args={[1.8, 2.4, 0.12]} /><meshStandardMaterial color="#7c4a2d" emissive="#7c4a2d" emissiveIntensity={0.2} /></mesh>
      {def.props.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} castShadow receiveShadow>
          <boxGeometry args={[p.w, p.h, p.d]} />
          <meshStandardMaterial color={p.color} emissive={p.emissive ?? '#000'} emissiveIntensity={p.emissive ? 0.8 : 0} roughness={0.7} />
        </mesh>
      ))}
      {def.hotspots.map((h, i) => (
        <group key={h.id} position={[h.x, 0, h.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><ringGeometry args={[0.7, 0.95, 24]} /><meshBasicMaterial color="#fbbf24" transparent opacity={0.85} side={THREE.DoubleSide} /></mesh>
          <sprite position={[0, 2.5, 0]} scale={[3.2, 0.67, 1]}><spriteMaterial map={labels[i]} depthTest={false} /></sprite>
        </group>
      ))}
      {brandTex && <mesh position={[0, 2.6, -hd + 0.15]}><planeGeometry args={[6, 1.5]} /><meshBasicMaterial map={brandTex} /></mesh>}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, hd - 0.7]}><ringGeometry args={[0.6, 0.85, 24]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.8} side={THREE.DoubleSide} /></mesh>
      <sprite position={[0, 2.8, hd - 0.7]} scale={[2.4, 0.5, 1]}><spriteMaterial map={exitTex} depthTest={false} /></sprite>
    </group>
  );
}
