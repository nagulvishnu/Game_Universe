import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildRig, defaultAnim, resolveLook, setAura, setWeapon, updateRig } from '../game/rig';
import { ITEM_MAP, RCOL, type Item } from '../game/data';
import { useGame } from '../game/store';

function RigModel({ item, form, spin = true }: { item?: Item; form?: number; spin?: boolean }) {
  const s = useGame.getState(); const grp = useRef<THREE.Group>(null);
  const state = useMemo(() => {
    let outfit = s.outfit, armor = s.armor, accs = s.accs, weapon = s.weapon;
    if (item?.cat === 'Outfits') outfit = item.id; else if (item?.cat === 'Armor') armor = item.id; else if (item?.cat === 'Accessories') accs = [...new Set([...accs, item.id])]; else if (item?.cat === 'Weapons') weapon = item.id;
    return { look: s.look, outfit, armor, accs, weapon };
  }, [item?.id, s.look, s.outfit, s.armor, s.accs, s.weapon]);
  const f = form ?? 0;
  const rig = useMemo(() => {
    const r = buildRig(resolveLook(state, f), false); const w = ITEM_MAP[state.weapon]; if (w) setWeapon(r, w.wtype!, w.color, w.id === 'photon_cannon'); return r;
  }, [state, f]);
  const anim = useMemo(() => defaultAnim(), []);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05); const w = ITEM_MAP[state.weapon]; anim.wtype = w?.wtype ?? '';
    if (item?.cat === 'Weapons') { anim.mode = 'attack'; anim.atkP = ((performance.now() / 1000) % 1.4) / 1.4; anim.combo = Math.floor(performance.now() / 1400) % 3; } else { anim.mode = 'idle'; }
    updateRig(rig, anim, d, f > 0 ? 0.3 : 0); setAura(rig, f > 0 ? 0.55 : item?.rarity === 'Divine' || item?.rarity === 'Mythic' ? 0.3 : 0, f > 0 ? rig.look.aura : item ? RCOL[item.rarity] : undefined);
    if (grp.current && spin) grp.current.rotation.y += d * 0.7;
  });
  return <group ref={grp}><primitive object={rig.root} /></group>;
}

export function Preview3D({ item, form, height = 300 }: { item?: Item; form?: number; height?: number }) {
  return (
    <div style={{ height }} className="relative rounded-lg overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_50%_40%,#2b1d4a,#0a0814_70%)]">
      <Canvas camera={{ position: [0, 1.25, item ? 5.2 : 5.4], fov: 38 }} onCreated={({ camera }) => camera.lookAt(0, 1.05, 0)} gl={{ antialias: true, alpha: true }} dpr={1}>
        <ambientLight intensity={1.1} /><directionalLight position={[3, 4, 3]} intensity={2.4} /><directionalLight position={[-3, 2, -2]} intensity={1.4} color="#a855f7" /><pointLight position={[0, 1, 2]} intensity={6} color="#ff4d7a" />
        <group position={[0, -0.05, 0]} scale={item?.cat === 'Accessories' ? 1 : 1}><RigModel item={item} form={form} /></group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><circleGeometry args={[1.1, 40]} /><meshBasicMaterial color={item ? RCOL[item.rarity] : '#a855f7'} transparent opacity={0.25} /></mesh>
      </Canvas>
    </div>
  );
}
