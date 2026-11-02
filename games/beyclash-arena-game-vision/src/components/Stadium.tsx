import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { StadiumDef } from '../data/stadiums';
import { pocketCenters } from '../game/battle/physics/sim';

export const dishY = (r: number, R: number) => 0.45 * Math.pow(Math.min(r, R + 1) / R, 2);

function floorTexture(def: StadiumDef) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  const base = new THREE.Color(def.floor);
  grad.addColorStop(0, base.clone().multiplyScalar(1.5).getStyle());
  grad.addColorStop(1, base.clone().multiplyScalar(0.8).getStyle());
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = def.accent; g.lineWidth = 5;
  for (const v of [0.3, 0.62, 0.97]) { g.globalAlpha = 0.9; g.beginPath(); g.moveTo(0, v * 512); g.lineTo(512, v * 512); g.stroke(); }
  g.globalAlpha = 0.35; g.lineWidth = 2;
  for (let i = 0; i < 12; i++) { const x = (i / 12) * 512; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  g.globalAlpha = 0.18; g.fillStyle = '#fff';
  for (let i = 0; i < 12; i += 2) g.fillRect((i / 12) * 512, 0, 512 / 12, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function Stadium({ def, crowd = true }: { def: StadiumDef; crowd?: boolean }) {
  const R = def.radius;
  const parts = useMemo(() => {
    const tex = floorTexture(def);
    const pts: THREE.Vector2[] = [];
    for (let i = 28; i >= 0; i--) { const r = (i / 28) * (R + 0.3); pts.push(new THREE.Vector2(Math.max(0.001, r), dishY(r, R))); }
    const dish = new THREE.LatheGeometry(pts, 64);
    const hw = def.pocketHalfAngle;
    const cs = pocketCenters(def).sort((a, b) => a - b);
    const arcs: [number, number][] = [];
    for (let k = 0; k < cs.length; k++) {
      const a0 = cs[k] + hw;
      let a1 = (cs[(k + 1) % cs.length] - hw);
      if (a1 <= a0) a1 += Math.PI * 2;
      arcs.push([a0, a1]);
    }
    const wallGeos = arcs.map(([a0, a1]) => {
      const len = a1 - a0;
      const seg = Math.max(4, Math.round(len * 8));
      return {
        a0, len,
        wall: new THREE.CylinderGeometry(R + 0.9, R + 0.9, 1.3, seg, 1, true, Math.PI / 2 - a1, len),
        wallIn: new THREE.CylinderGeometry(R + 0.15, R + 0.15, 1.3, seg, 1, true, Math.PI / 2 - a1, len),
        cap: new THREE.RingGeometry(R + 0.15, R + 0.9, seg, 1, a0, len),
        rail: new THREE.TorusGeometry(R + 0.15, 0.09, 6, seg, len),
      };
    });
    const pockets = cs.map((c) => new THREE.RingGeometry(R - 1.1, R + 0.1, 12, 1, c - hw, hw * 2));
    const crowdN = def.crowd;
    const tiers = new THREE.LatheGeometry([[14.5, -0.8], [14.5, 0.9], [16.6, 0.9], [16.6, 1.8], [18.6, 1.8], [18.6, 2.6], [24, 2.6], [24, -0.8]].map(([r, y]) => new THREE.Vector2(r, y)), 56);
    return { tex, dish, wallGeos, pockets, crowdN, tiers };
  }, [def, R]);

  useEffect(() => () => {
    parts.tex.dispose(); parts.dish.dispose(); parts.tiers.dispose();
    parts.wallGeos.forEach((w) => { w.wall.dispose(); w.wallIn.dispose(); w.cap.dispose(); w.rail.dispose(); });
    parts.pockets.forEach((p) => p.dispose());
  }, [parts]);

  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: def.wall, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide }), [def]);
  const railMat = useMemo(() => new THREE.MeshStandardMaterial({ color: def.accent, emissive: def.accent, emissiveIntensity: 1.8 }), [def]);
  const pocketMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff4a3a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), []);

  return (
    <group>
      <mesh geometry={parts.dish} receiveShadow castShadow>
        <meshStandardMaterial map={parts.tex} metalness={0.2} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      {/* base + deck + tiers */}
      <mesh position={[0, -0.7, 0]} receiveShadow><cylinderGeometry args={[R + 1.6, R + 2.2, 1.4, 48]} /><meshStandardMaterial color="#2a2d3a" metalness={0.5} roughness={0.5} /></mesh>
      <mesh position={[0, -0.4, 0]} receiveShadow><cylinderGeometry args={[R + 4.5, R + 4.5, 0.8, 48]} /><meshStandardMaterial color={def.wall} roughness={0.8} /></mesh>
      <mesh geometry={parts.tiers} receiveShadow><meshStandardMaterial color="#363c55" roughness={0.9} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[80, 32]} /><meshStandardMaterial color="#14161f" roughness={1} /></mesh>
      {parts.wallGeos.map((w, i) => (
        <group key={i}>
          <mesh geometry={w.wall} material={wallMat} position={[0, 0.95, 0]} castShadow />
          <mesh geometry={w.wallIn} material={wallMat} position={[0, 0.95, 0]} />
          <mesh geometry={w.cap} material={wallMat} position={[0, 1.6, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <group position={[0, 1.4, 0]} rotation={[0, -w.a0, 0]}><mesh geometry={w.rail} material={railMat} rotation={[Math.PI / 2, 0, 0]} /></group>
        </group>
      ))}
      {parts.pockets.map((p, i) => <mesh key={i} geometry={p} material={pocketMat} position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} />)}
      {crowd && <Crowd count={parts.crowdN} accent={def.accent} />}
      {/* light towers */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        return (
          <group key={i} position={[Math.cos(a) * 25, 0, Math.sin(a) * 25]}>
            <mesh position={[0, 5, 0]}><cylinderGeometry args={[0.25, 0.4, 10, 6]} /><meshStandardMaterial color="#444a5e" /></mesh>
            <mesh position={[0, 10.3, 0]}><boxGeometry args={[2.4, 0.7, 0.5]} /><meshBasicMaterial color="#fff6d0" /></mesh>
          </group>
        );
      })}
      {/* banner ring */}
      <mesh position={[0, 5.4, 0]}><cylinderGeometry args={[27, 27, 1.6, 48, 1, true]} /><meshBasicMaterial color={def.accent} side={THREE.BackSide} transparent opacity={0.28} /></mesh>
    </group>
  );
}

function Crowd({ count, accent }: { count: number; accent: string }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const arr: { x: number; y: number; z: number; ph: number }[] = [];
    let s = 99;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < count; i++) {
      const tier = i % 3;
      const r = [15.4, 17.4, 20.5][tier] + rnd() * 1.0;
      const a = (i / count) * Math.PI * 2 * 3 % (Math.PI * 2) + rnd() * 0.2;
      arr.push({ x: Math.cos(a) * r, y: [0.9, 1.8, 2.6][tier], z: Math.sin(a) * r, ph: rnd() * 6 });
    }
    return arr;
  }, [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => { const c = new THREE.Color(); return data.map((_, i) => c.clone().setHSL((i * 0.137) % 1, 0.65, 0.55)); }, [data]);
  useEffect(() => {
    const b = bodies.current!, h = heads.current!;
    data.forEach((_, i) => { b.setColorAt(i, colors[i]); h.setColorAt(i, new THREE.Color(i % 3 === 0 ? '#f6c9a8' : i % 3 === 1 ? '#e0a97c' : '#ffe0cc')); });
    b.instanceColor!.needsUpdate = true; h.instanceColor!.needsUpdate = true;
  }, [data, colors]);
  const acc = useRef(0);
  useFrame((st, dt) => {
    acc.current += dt;
    if (acc.current < 0.04) return;
    acc.current = 0;
    const b = bodies.current!, h = heads.current!;
    const t = st.clock.elapsedTime;
    data.forEach((d, i) => {
      const jump = Math.max(0, Math.sin(t * 5 + d.ph)) * 0.18;
      dummy.position.set(d.x, d.y + 0.45 + jump, d.z); dummy.rotation.set(0, Math.atan2(-d.x, -d.z), 0); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix(); b.setMatrixAt(i, dummy.matrix);
      dummy.position.set(d.x, d.y + 1.0 + jump, d.z); dummy.updateMatrix(); h.setMatrixAt(i, dummy.matrix);
    });
    b.instanceMatrix.needsUpdate = true; h.instanceMatrix.needsUpdate = true;
  });
  void accent;
  return (
    <>
      <instancedMesh ref={bodies} args={[undefined, undefined, count]} frustumCulled={false}><capsuleGeometry args={[0.24, 0.5, 3, 8]} /><meshLambertMaterial /></instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, count]} frustumCulled={false}><sphereGeometry args={[0.2, 8, 6]} /><meshLambertMaterial /></instancedMesh>
    </>
  );
}
