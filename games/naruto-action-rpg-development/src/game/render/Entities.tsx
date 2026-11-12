import { memo, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rt, subscribeRt, rtSnapshot, type EnemyRT, type AllyRT, type NpcRT, type CollectibleRT } from '../runtime';
import { NinjaRig } from './NinjaRig';
import { GEO, toonMat } from './materials';
import { CHARACTERS } from '../data/characters';
import { useGame } from '../store';
import { MISSIONS } from '../data/missions';
import { missionAvailable } from '../logic/missionLogic';
import { rankOf, objectiveMarker } from '../systems/missions';

const WHITE = new THREE.Color('#ffffff');
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false });
const addMat = (c: string, o = 0.3) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const BlobShadow = ({ r = 0.7 }: { r?: number }) => <mesh geometry={GEO.circle} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={[r, r, 1]} />;

export function PlayerView() {
  const g = useRef<THREE.Group>(null); const orb = useRef<THREE.Group>(null); const aura = useRef<THREE.Mesh>(null); const light = useRef<THREE.PointLight>(null);
  const rings = useRef<THREE.Group>(null); const blades = useRef<THREE.Group>(null);
  const char = useGame((s) => s.profile.charId); const look = CHARACTERS[char].look;
  const orbCore = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7fd8ff' }), []); const orbGlow = useMemo(() => addMat('#7fd8ff', 0.35), []);
  const auraMat = useMemo(() => addMat('#5ce0ff', 0.22), []);
  useFrame((st) => {
    const p = rt.player; if (!g.current) return;
    g.current.position.set(p.pos.x, p.pos.y, p.pos.z); g.current.rotation.y = p.yaw;
    const t = st.clock.elapsedTime;
    if (orb.current) {
      const o = p.orb;
      orb.current.visible = !!o;
      if (o) {
        orb.current.position.set(0.28, 1.25, 0.85 + o.size * 0.3); orb.current.scale.setScalar(o.size * (1 + Math.sin(t * 30) * 0.05));
        orbCore.color.set(o.color).lerp(WHITE, 0.6); orbGlow.color.set(o.color);
        if (rings.current) { rings.current.rotation.x = t * 9; rings.current.rotation.z = t * 6; }
        if (blades.current) { blades.current.visible = o.blades; blades.current.rotation.y = t * 22; }
      }
    }
    if (aura.current) {
      const on = p.charging || p.form !== 'base'; aura.current.visible = on;
      if (on) { auraMat.color.set(p.charging ? '#5ce0ff' : p.form === 'sage' ? '#ff9a3a' : '#ffc02e'); auraMat.opacity = (p.charging ? 0.2 : 0.14) + Math.sin(t * 10) * 0.04; aura.current.scale.set(1.1 + Math.sin(t * 8) * 0.06, 1.9, 1.1); }
    }
    if (light.current) {
      const night = Math.sin((rt.timeOfDay - 0.25) * Math.PI * 2) < 0.1;
      light.current.intensity = (p.orb ? 8 : 0) + (p.charging ? 3 : 0) + (p.form === 'kurama' ? 4 : p.form === 'sage' ? 2 : 0) + rt.flash * 40 + (night ? 2.2 : 0);
      light.current.color.set(p.orb ? p.orb.color : rt.flash > 0.1 ? rt.flashColor : night ? '#ffd9a0' : p.form === 'kurama' ? '#ffb02e' : '#ffffff');
    }
  });
  return (
    <group ref={g}>
      <NinjaRig key={char} look={look} pose={rt.player.pose} forms={char === 'naruto'} />
      <BlobShadow />
      <mesh ref={aura} geometry={GEO.sphere} material={auraMat} position={[0, 1, 0]} visible={false} />
      <group ref={orb} visible={false}>
        <mesh geometry={GEO.sphere} material={orbCore} scale={0.55} /><mesh geometry={GEO.sphere} material={orbGlow} scale={1} />
        <group ref={rings}>{[0, 1].map((i) => <mesh key={i} geometry={GEO.ring} material={orbGlow} scale={[1.1, 1.1, 1]} rotation={[i * 1.4, i, 0]} />)}</group>
        <group ref={blades}>{[0, 1, 2, 3].map((i) => <mesh key={i} geometry={GEO.box} material={orbGlow} scale={[2.2, 0.06, 0.28]} rotation={[0, (i * Math.PI) / 4, 0]} />)}</group>
      </group>
      <pointLight ref={light} position={[0, 1.6, 0.5]} distance={18} intensity={0} decay={1.6} />
    </group>
  );
}

const EnemyView = memo(function EnemyView({ e }: { e: EnemyRT }) {
  const g = useRef<THREE.Group>(null); const shield = useRef<THREE.Mesh>(null); const ring = useRef<THREE.Mesh>(null);
  const shieldMat = useMemo(() => addMat('#e6c887', 0.3), []); const ringMat = useMemo(() => addMat(e.def.color, 0.5), [e.def.color]);
  useFrame((st) => {
    if (!g.current) return; g.current.position.set(e.pos.x, e.pos.y, e.pos.z); g.current.rotation.y = e.yaw;
    if (shield.current) { shield.current.visible = e.shield > 0; shield.current.scale.setScalar(1.8 + Math.sin(st.clock.elapsedTime * 6) * 0.05); }
    if (ring.current) { const locked = rt.lock === e; ring.current.visible = locked || e.def.tier === 'boss' || e.def.tier === 'elite'; ringMat.color.set(locked ? '#ff3a3a' : e.def.color); ring.current.rotation.z = st.clock.elapsedTime * (locked ? 2.5 : 0.8); const s = (e.radius + 0.5) * (locked ? 1.3 : 1.1); ring.current.scale.set(s, s, 1); ring.current.position.y = 0.08 + e.pos.y * 0; }
  });
  return (
    <group ref={g}>
      <NinjaRig look={e.def.look} pose={e.pose} />
      <BlobShadow r={0.7 * (e.def.look.scale ?? 1)} />
      <mesh ref={ring} geometry={GEO.ring} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
      <mesh ref={shield} geometry={GEO.sphere} material={shieldMat} position={[0, 1.2, 0]} visible={false} />
    </group>
  );
});
export function EnemyViews() {
  useSyncExternalStore(subscribeRt, rtSnapshot('enemies'));
  return <>{rt.enemies.map((e) => <EnemyView key={e.id} e={e} />)}</>;
}

const AllyView = memo(function AllyView({ a }: { a: AllyRT }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => { if (!g.current) return; g.current.position.set(a.pos.x, a.pos.y, a.pos.z); g.current.rotation.y = a.yaw; });
  return (<group ref={g}><NinjaRig look={a.look} pose={a.pose} scaleMul={a.scale === 1 ? 1 : 1} /><BlobShadow /></group>);
});
export function AllyViews() {
  useSyncExternalStore(subscribeRt, rtSnapshot('allies'));
  return <>{rt.allies.map((a) => <AllyView key={a.id} a={a} />)}</>;
}

const markerMat = new THREE.MeshBasicMaterial({ color: '#ffd24a' });
const NpcView = memo(function NpcView({ n }: { n: NpcRT }) {
  const g = useRef<THREE.Group>(null); const mk = useRef<THREE.Group>(null); const cnt = useRef(0);
  useFrame((st) => {
    if (!g.current) return; g.current.visible = !rt.allies.some((a) => a.charId === n.def.id);
    g.current.position.set(n.pos.x, n.pos.y, n.pos.z); g.current.rotation.y = n.yaw;
    if (mk.current) {
      if (cnt.current++ % 30 === 0) {
        const p = useGame.getState().profile; const lv = p.chars[p.charId].level; const rank = rankOf();
        mk.current.visible = !rt.mission && MISSIONS.some((m) => m.giver === n.def.id && m.status === 'playable' && !p.completed.includes(m.id) && missionAvailable(m, rank, lv, p.completed).ok)
          || (!!rt.mission && MISSIONS.find((m) => m.id === rt.mission!.id)?.stages[rt.mission!.stage].objectives.some((o) => o.type === 'talk' && o.npc === n.def.id) === true);
      }
      mk.current.position.y = 2.6 + Math.sin(st.clock.elapsedTime * 3) * 0.12; mk.current.rotation.y = st.clock.elapsedTime * 2;
    }
  });
  return (
    <group ref={g}>
      <NinjaRig look={n.def.look} pose={n.pose} />
      <BlobShadow />
      <group ref={mk} visible={false}><mesh geometry={GEO.cone} material={markerMat} scale={[0.18, 0.4, 0.18]} rotation={[Math.PI, 0, 0]} position={[0, -0.1, 0]} /><mesh geometry={GEO.box} material={markerMat} scale={[0.14, 0.34, 0.14]} position={[0, 0.3, 0]} /></group>
    </group>
  );
});
export function NpcViews() {
  useSyncExternalStore(subscribeRt, rtSnapshot('npcs'));
  return <>{rt.npcs.map((n) => <NpcView key={n.def.id} n={n} />)}</>;
}

const CollectibleView = memo(function CollectibleView({ c }: { c: CollectibleRT }) {
  const g = useRef<THREE.Group>(null); const [x, y, z] = c.def.pos;
  const glow = useMemo(() => addMat(c.def.kind === 'orb' ? '#6aff8a' : c.def.kind === 'secret' ? '#c070ff' : '#ffe14a', 0.3), [c.def.kind]);
  useFrame((st) => {
    if (!g.current) return; const vis = !c.taken && (!c.def.mission || rt.mission?.id === c.def.mission);
    g.current.visible = vis; if (!vis) return; const t = st.clock.elapsedTime; g.current.position.y = y + (c.def.kind === 'chest' ? 0 : 0.3 + Math.sin(t * 2 + x) * 0.15); g.current.rotation.y = c.def.kind === 'chest' ? 0 : t * 1.5;
  });
  const k = c.def.kind;
  return (
    <group ref={g} position={[x, y, z]}>
      {k === 'chest' && (<group><mesh geometry={GEO.box} scale={[1.1, 0.6, 0.7]} position={[0, 0.3, 0]} material={toonMat('#8a5a30')} castShadow /><mesh geometry={GEO.box} scale={[1.14, 0.2, 0.74]} position={[0, 0.7, 0]} material={toonMat('#a77a46')} /><mesh geometry={GEO.box} scale={[0.2, 0.3, 0.1]} position={[0, 0.55, 0.38]} material={toonMat('#ffd24a', '#a07a10')} /></group>)}
      {k === 'scroll' && (<group rotation={[0, 0, Math.PI / 2]}><mesh geometry={GEO.cyl6} scale={[0.14, 0.9, 0.14]} material={toonMat('#f2e6c4')} /><mesh geometry={GEO.cyl6} scale={[0.16, 0.08, 0.16]} position={[0, 0.2, 0]} material={toonMat('#c0392b')} /></group>)}
      {k === 'secret' && (<group rotation={[0, 0, Math.PI / 2]}><mesh geometry={GEO.cyl6} scale={[0.18, 1.1, 0.18]} material={toonMat('#e8d8ff', '#6a30b0')} /></group>)}
      {k === 'orb' && <mesh geometry={GEO.sphere} scale={0.4} material={toonMat('#aaffbb', '#3aff6a')} />}
      {k === 'cat' && (<group><mesh geometry={GEO.sphere} scale={[0.4, 0.3, 0.55]} position={[0, 0.3, 0]} material={toonMat('#e8872a')} /><mesh geometry={GEO.sphere} scale={0.25} position={[0, 0.5, 0.45]} material={toonMat('#e8872a')} /><mesh geometry={GEO.cone} scale={[0.07, 0.15, 0.07]} position={[-0.12, 0.76, 0.45]} material={toonMat('#e8872a')} /><mesh geometry={GEO.cone} scale={[0.07, 0.15, 0.07]} position={[0.12, 0.76, 0.45]} material={toonMat('#e8872a')} /><mesh geometry={GEO.cyl6} scale={[0.05, 0.5, 0.05]} position={[0, 0.5, -0.5]} rotation={[0.9, 0, 0]} material={toonMat('#e8872a')} /></group>)}
      <mesh geometry={GEO.sphere} material={glow} scale={k === 'chest' ? 1.1 : 0.75} position={[0, 0.3, 0]} />
      <mesh geometry={GEO.cyl6} material={glow} scale={[0.08, 8, 0.08]} position={[0, 4, 0]} />
    </group>
  );
});
export function CollectibleViews() {
  useSyncExternalStore(subscribeRt, rtSnapshot('collectibles'));
  return <>{rt.collectibles.map((c) => <CollectibleView key={c.def.id} c={c} />)}</>;
}

/** Cyan beam marking the current objective. */
export function ObjectiveBeam() {
  const g = useRef<THREE.Group>(null); const cnt = useRef(0); const mat = useMemo(() => addMat('#5ce0ff', 0.28), []);
  useFrame((st) => {
    if (!g.current) return; if (cnt.current++ % 10 === 0) { const m = objectiveMarker(); if (m) { g.current.position.set(m.x, 0, m.z); g.current.visible = true; } else g.current.visible = false; }
    g.current.rotation.y = st.clock.elapsedTime; mat.opacity = 0.2 + Math.sin(st.clock.elapsedTime * 3) * 0.06;
  });
  return (<group ref={g} visible={false}><mesh geometry={GEO.cyl} material={mat} scale={[0.7, 60, 0.7]} position={[0, 30, 0]} /><mesh geometry={GEO.ring} material={mat} rotation={[-Math.PI / 2, 0, 0]} scale={[2.2, 2.2, 1]} position={[0, 0.1, 0]} /></group>);
}

/** Lock-on chevron hovering above the locked enemy. */
export function LockMarker() {
  const g = useRef<THREE.Group>(null); const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff3a3a' }), []);
  useFrame((st) => {
    if (!g.current) return; const e = rt.lock; g.current.visible = !!e && e.state !== 'dead';
    if (e) { g.current.position.set(e.pos.x, e.pos.y + 2.9 * (e.def.look.scale ?? 1) + Math.sin(st.clock.elapsedTime * 5) * 0.1, e.pos.z); g.current.rotation.y = st.clock.elapsedTime * 3; }
  });
  return (<group ref={g} visible={false}><mesh geometry={GEO.cone} material={mat} scale={[0.22, 0.45, 0.22]} rotation={[Math.PI, 0, 0]} /></group>);
}
