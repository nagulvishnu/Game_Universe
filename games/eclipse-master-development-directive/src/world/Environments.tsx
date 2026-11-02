import { useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { film } from '../film/runtime';
import { ENVS } from './envData';
import { atm } from './atmosphere';
import { Breakable, Crystal, Fire, Forest, House, Rocks, Scatter, Terrain, geos, rng, toon } from './props';

const boxG = new THREE.BoxGeometry(1, 1, 1);
const M = (c: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) => toon(c, o);
const emissive = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });
const Box = ({ p, s, m, r, shadow = true }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material; r?: [number, number, number]; shadow?: boolean }) => (
  <mesh position={p} scale={s} rotation={r} material={m} castShadow={shadow} receiveShadow><boxGeometry args={[1, 1, 1]} /></mesh>
);

// ---------------------------------------------------------------- VILLAGE
function Grave() {
  const g = useRef<THREE.Group>(null!); const orb = useRef<THREE.Mesh>(null!);
  useFrame(() => { g.current.visible = film.world.dead.has('orrin') || film.world.facts.has('orrin_dead'); orb.current.scale.setScalar(1 + Math.sin(film.clock * 2) * 0.15); });
  return (
    <group ref={g} position={[0, 0, -4.1]} visible={false}>
      <mesh position={[0, 0.15, 0]} scale={[1.1, 0.3, 2]} material={M('#4a3a2c')}><sphereGeometry args={[0.8, 12, 8]} /></mesh>
      <mesh position={[0, 1.0, -0.8]} rotation={[0.1, 0, 0]} material={M('#6b4a2a')}><cylinderGeometry args={[0.04, 0.05, 2, 8]} /></mesh>
      <mesh ref={orb} position={[0, 2.05, -0.78]} material={new THREE.MeshBasicMaterial({ color: '#8fd0ff', toneMapped: false })}><sphereGeometry args={[0.12, 12, 10]} /></mesh>
      <pointLight position={[0, 2, -0.5]} color="#8fd0ff" intensity={1.4} distance={8} />
    </group>
  );
}
function VillageEnv() {
  const houses: [number, number, number, string, string][] = [[-10, -8, 0.15, '#d8c4a0', '#9a4a3a'], [9, -9, -0.2, '#cfd8b8', '#4a6a8a'], [-13, 6, 1.1, '#e0c8a8', '#8a5a3a'], [13, 5, -1.1, '#d8c0a0', '#7a4a4a'], [2, -17, 0, '#d0c8b0', '#5a6a4a'], [-5, -17, 0.1, '#e0d0b0', '#9a5a3a']];
  const fence = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ p: [-22 + i * 1.4, 0.45, 12] as [number, number, number], s: [0.12, 0.9, 0.12] as [number, number, number] })), []);
  const stoneM = useMemo(() => M('#8a8a90'), []);
  return (<>
    <Terrain bounds={27} base="#6f8f4a" far="#4a6a3a" hill={1.3} seed={3} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 4]} material={M('#a88e66')}><planeGeometry args={[60, 5.5]} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -6]} material={M('#a88e66')}><circleGeometry args={[7, 28]} /></mesh>
    {houses.map(([x, z, r, w, rf], i) => <House key={i} x={x} z={z} ry={r} wall={w} roof={rf} />)}
    <group position={[7, 0, -3.2]}>
      <mesh position={[0, 0.5, 0]} material={stoneM} castShadow><cylinderGeometry args={[1.1, 1.2, 1, 14, 1, true]} /></mesh>
      <mesh position={[0, 0.35, 0]} material={M('#2a5a8a')}><circleGeometry args={[1.0, 14]} /></mesh>
      <Box p={[-1, 1.5, 0]} s={[0.12, 2, 0.12]} m={M('#5a3a22')} /><Box p={[1, 1.5, 0]} s={[0.12, 2, 0.12]} m={M('#5a3a22')} />
      <mesh position={[0, 2.6, 0]} rotation={[0, Math.PI / 2, 0]} material={M('#8a4a3a')}><coneGeometry args={[1.8, 0.8, 4]} /></mesh>
    </group>
    <group position={[-9, 0, 6]}>
      <Box p={[0, 1, 0]} s={[2.4, 0.15, 1.6]} m={M('#7a5a3a')} />
      {[[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]].map(([x, z], i) => <Box key={i} p={[x, 0.5, z]} s={[0.1, 1, 0.1]} m={M('#5a3a22')} />)}
      <mesh position={[0, 2, 0]} rotation={[0.25, 0, 0]} material={M('#c25a5a', { side: THREE.DoubleSide })}><planeGeometry args={[2.8, 1.9]} /></mesh>
      {[[-0.6, 1.2], [0.5, 1.2]].map(([x, y], i) => <mesh key={i} position={[x, y + 0.2, 0]} material={M(i ? '#e0a040' : '#8aa040')}><sphereGeometry args={[0.2, 8, 8]} /></mesh>)}
    </group>
    <Scatter geo={geos.cyl} mat={M('#6a4a2a')} items={fence} shadow />
    <Forest count={70} inner={30} outer={85} seed={11} />
    <Rocks count={20} inner={28} outer={60} seed={5} />
    <group position={[-40, 5, -48]}>
      <mesh position={[0, 4, 0]} material={M('#b8b0a8')}><cylinderGeometry args={[3, 4, 12, 14]} /></mesh>
      <mesh position={[0, 10.5, 0]} material={M('#4a5a8a')}><sphereGeometry args={[3.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <mesh position={[0, 8, 3]} material={new THREE.MeshBasicMaterial({ color: '#ffd080' })}><boxGeometry args={[0.6, 1.2, 0.2]} /></mesh>
    </group>
    <Grave />
  </>);
}

// ---------------------------------------------------------------- OBSERVATORY
function chartTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')!;
  g.fillStyle = '#0d1b3d'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#d8c488'; g.lineWidth = 2;
  [60, 130, 200, 240].forEach((r) => { g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke(); });
  const r = rng(7); g.fillStyle = '#fff';
  for (let i = 0; i < 90; i++) { g.beginPath(); g.arc(r() * 512, r() * 512, 1 + r() * 2.4, 0, 7); g.fill(); }
  g.strokeStyle = '#8fd0ff'; g.lineWidth = 1.5; g.beginPath(); let px = 100, py = 300; g.moveTo(px, py);
  for (let i = 0; i < 9; i++) { px += 30 + r() * 30; py += (r() - 0.5) * 80; g.lineTo(px, py); } g.stroke();
  return new THREE.CanvasTexture(c);
}
function ObservatoryEnv() {
  const runeM = useMemo(() => emissive('#f5b73b', 1.4), []);
  const chart = useMemo(chartTexture, []);
  const arm = useRef<THREE.Group>(null!);
  useFrame(() => { runeM.emissiveIntensity = 0.9 + Math.sin(film.clock * 1.5) * 0.3 + film.env.eclipse * 1.2; arm.current.rotation.y = film.clock * 0.4; arm.current.rotation.x = film.clock * 0.25; });
  const books = useMemo(() => { const r = rng(4); return Array.from({ length: 70 }, (_, i) => ({ p: [(i % 14) * 0.17 - 1.2, 0.35 + Math.floor(i / 14) * 0.62, 0] as [number, number, number], s: [0.12, 0.42 + r() * 0.12, 0.3] as [number, number, number] })); }, []);
  const bookM = useMemo(() => M('#9a5a4a'), []);
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={M('#6a5a4a')}><circleGeometry args={[12.5, 48]} /></mesh>
    {[2.5, 5.5, 8.5].map((r) => <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={runeM}><ringGeometry args={[r, r + 0.08, 64]} /></mesh>)}
    <mesh position={[0, 5, 0]} material={M('#8a8090', { side: THREE.BackSide })} receiveShadow><cylinderGeometry args={[12.5, 12.5, 10, 40, 1, true]} /></mesh>
    <mesh position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} material={M('#3a3a4a')}><torusGeometry args={[12.5, 0.35, 8, 40]} /></mesh>
    {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + 0.2; return (
      <group key={i} rotation={[0, a, 0]}><mesh position={[0, 10, 0]} rotation={[0, 0, Math.PI / 2]} material={M('#3a3a4a')}><torusGeometry args={[12, 0.18, 6, 24, Math.PI / 2]} /></mesh></group>); })}
    {Array.from({ length: 7 }, (_, i) => { const a = -0.9 + i * 0.3 + Math.PI * 0.0; return (
      <mesh key={i} position={[Math.sin(a + 3.3) * 12.2, 4.5, Math.cos(a + 3.3) * 12.2]} rotation={[0, a + 3.3 + Math.PI, 0]} material={new THREE.MeshBasicMaterial({ color: '#2a3a6a' })}><planeGeometry args={[0.9, 2.6]} /></mesh>); })}
    {[-0.9, 0, 0.9].map((a) => (
      <group key={a} position={[Math.sin(a + Math.PI) * 11.6, 0, Math.cos(a + Math.PI) * 11.6]} rotation={[0, a, 0]}>
        <Box p={[0, 1.8, 0]} s={[3, 3.6, 0.6]} m={M('#5a3a22')} />
        <Scatter geo={geos.cyl} mat={bookM} items={books.map((b) => ({ ...b, p: [b.p[0] + 0.1, b.p[1] + 0.1, 0.35] as [number, number, number], s: [b.s[0] * 0.8, b.s[1] * 0.8, 0.3] as [number, number, number] }))} />
      </group>))}
    <group position={[0, 0, -4.2]}>
      <mesh position={[0, 0.6, 0]} material={M('#5a4a3a')} castShadow><cylinderGeometry args={[1.2, 1.5, 1.2, 14]} /></mesh>
      <mesh position={[0, 2.6, 0.3]} rotation={[-0.9, 0, 0]} material={M('#b89a4a')} castShadow><cylinderGeometry args={[0.45, 0.6, 4.5, 14]} /></mesh>
      <mesh position={[0, 4.6, -1.3]} rotation={[-0.9, 0, 0]} material={M('#e8d8a0')}><torusGeometry args={[0.46, 0.06, 8, 16]} /></mesh>
    </group>
    <group position={[-7, 0, -3.4]}>
      <Box p={[0, 0.9, 0]} s={[3, 0.15, 2]} m={M('#7a5a3a')} />
      <mesh position={[0, 0.99, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.6, 1.7]} /><meshBasicMaterial map={chart} /></mesh>
      {[[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]].map(([x, z], i) => <Box key={i} p={[x, 0.45, z]} s={[0.12, 0.9, 0.12]} m={M('#5a3a22')} />)}
      <pointLight position={[0, 2, 0]} color="#ffd89a" intensity={2.2} distance={9} />
    </group>
    <group position={[7, 0, -3.2]}>
      <mesh position={[0, 0.6, 0]} material={M('#6a5a4a')}><cylinderGeometry args={[0.4, 0.6, 1.2, 10]} /></mesh>
      <group ref={arm} position={[0, 1.8, 0]}>{[0.6, 0.85, 1.1].map((r, i) => <mesh key={r} rotation={[i * 1.0, i * 0.7, 0]} material={emissive('#e8c870', 0.6)}><torusGeometry args={[r, 0.03, 6, 28]} /></mesh>)}</group>
    </group>
    {[[-5, 8], [5, 8], [-9, 0.5], [9, 3]].map(([x, z], i) => <Fire key={i} pos={[x, 0.9, z]} size={0.7} light={i < 2 ? 1.4 : 0} color="#ffbb66" />)}
    {[[-5, 8], [5, 8], [-9, 0.5], [9, 3]].map(([x, z], i) => <mesh key={i} position={[x, 0.45, z]} material={M('#3a3a42')}><cylinderGeometry args={[0.35, 0.25, 0.9, 8]} /></mesh>)}
    <Rocks count={15} inner={30} outer={50} seed={9} color="#4a4a58" size={2} />
  </>);
}

// ---------------------------------------------------------------- CAVERNS
function CavernEnv() {
  const stal = useMemo(() => { const r = rng(21); return Array.from({ length: 50 }, () => { const a = r() * 6.28, d = r() * 18; const l = 1.5 + r() * 3.5; return { p: [Math.sin(a) * d, 13 - l / 2, Math.cos(a) * d] as [number, number, number], s: [0.4 + r() * 0.5, l, 0.4 + r() * 0.5] as [number, number, number] }; }); }, []);
  const ring = useMemo(() => { const r = rng(5); return Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * 6.28; const d = 18 + r() * 3; const s = 4 + r() * 4; return { p: [Math.sin(a) * d, s * 0.5, Math.cos(a) * d] as [number, number, number], s: [s, s * (0.9 + r() * 1.3), s] as [number, number, number], ry: r() * 6 }; }); }, []);
  const crystals = useMemo(() => { const r = rng(8); const cols = ['#5a9bff', '#8a6bff', '#46e0d0', '#b04dff']; return Array.from({ length: 22 }, (_, i) => { const a = r() * 6.28, d = 12 + r() * 4; return { p: [Math.sin(a) * d, 0, Math.cos(a) * d] as [number, number, number], h: 1.2 + r() * 2.4, c: cols[i % 4], rot: r() * 6 }; }); }, []);
  const shard = useRef<THREE.Group>(null!);
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0a2a4a', emissive: '#14407a', emissiveIntensity: 0.4, roughness: 0.08, metalness: 0.8 }), []);
  useFrame(() => { shard.current.position.y = 2.3 + Math.sin(film.clock * 1.4) * 0.15; shard.current.rotation.y = film.clock * 0.8; shard.current.visible = !film.world.possessions.kael?.includes('moonshard') || film.scene?.id === 'a2_caverns' && !film.world.possessions.kael?.includes('moonshard'); water.emissiveIntensity = 0.35 + Math.sin(film.clock * 0.8) * 0.1; });
  return (<>
    <Terrain bounds={14} base="#3a3f52" far="#22263a" hill={0.2} seed={6} rocky />
    <mesh rotation={[0, 0, 0]} position={[0, -2, 0]} material={M('#1c2030', { side: THREE.BackSide })}><sphereGeometry args={[34, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} /></mesh>
    <mesh scale={[1, 0.55, 1]} position={[0, 14, 0]} material={M('#1c2030', { side: THREE.BackSide })}><sphereGeometry args={[34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
    <Scatter geo={geos.ico} mat={M('#2a2e42')} items={ring} shadow />
    <Scatter geo={geos.cone} mat={M('#3a3e54')} items={stal.map((s) => ({ ...s, ry: 0 }))} />
    <mesh position={[0, 0.06, -10]} rotation={[-Math.PI / 2, 0, 0]} material={water}><circleGeometry args={[4.3, 28]} /></mesh>
    {crystals.map((c, i) => <Crystal key={i} p={c.p} h={c.h} color={c.c} rot={c.rot} />)}
    {[[-9, -3], [9, -6], [-10, 7]].map(([x, z], i) => (
      <Breakable key={i} id={`cv${i}`} x={x} z={z} rubbleColor="#5a6a9a"><Crystal p={[0, 0, 0]} h={4.2} color={i % 2 ? '#8a6bff' : '#5a9bff'} rot={i} /></Breakable>))}
    <group position={[0, 0, -6.4]}>
      <mesh position={[0, 0.5, 0]} material={M('#5a5e78')} castShadow><cylinderGeometry args={[0.9, 1.1, 1, 10]} /></mesh>
      <mesh position={[0, 1.1, 0]} material={M('#7a7ea0')}><cylinderGeometry args={[0.6, 0.8, 0.3, 10]} /></mesh>
      <group ref={shard}><mesh scale={[0.3, 0.65, 0.3]} material={emissive('#cfe4ff', 2.2)}><octahedronGeometry args={[1]} /></mesh><pointLight color="#9fc8ff" intensity={3} distance={14} /></group>
    </group>
    <pointLight position={[-8, 3, 5]} color="#5a8aff" intensity={2.2} distance={20} />
    <pointLight position={[8, 3, 0]} color="#9a5aff" intensity={2.2} distance={20} />
    <pointLight position={[0, 4, 10]} color="#46e0d0" intensity={1.4} distance={22} />
  </>);
}

// ---------------------------------------------------------------- CITADEL
function floorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')!;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#8e8a9a' : '#b4b0c0'; g.fillRect(x * 64, y * 64, 64, 64); }
  g.strokeStyle = '#5a566a'; g.lineWidth = 3; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
}
function VeilGate() {
  const disc = useRef<THREE.Mesh>(null!); const light = useRef<THREE.PointLight>(null!); const ring = useRef<THREE.Mesh>(null!);
  const dm = useMemo(() => new THREE.MeshBasicMaterial({ color: '#b36bff', transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const rm = useMemo(() => emissive('#6a3aa0', 0.3), []);
  useFrame(() => {
    const open = film.world.facts.has('veil_open'); const t = film.clock;
    dm.opacity += ((open ? 0.75 + Math.sin(t * 3) * 0.1 : 0) - dm.opacity) * 0.05; disc.current.rotation.z = t * 0.5; ring.current.rotation.z = -t * 0.2;
    rm.emissiveIntensity = open ? 2 : 0.3; light.current.intensity = dm.opacity * 8;
  });
  return (
    <group position={[0, 5.2, -20]}>
      <mesh ref={ring} material={rm}><torusGeometry args={[4.6, 0.35, 10, 40]} /></mesh>
      <mesh ref={disc} material={dm}><circleGeometry args={[4.3, 36]} /></mesh>
      <pointLight ref={light} color="#b36bff" distance={30} position={[0, 0, 3]} />
    </group>
  );
}
function CitadelEnv() {
  const tex = useMemo(floorTexture, []);
  const stone = useMemo(() => M('#b4b0c0'), []);
  const dark = useMemo(() => M('#2a2433'), []);
  const wall = useMemo(() => Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * 6.28; return { p: [Math.sin(a) * 28, 4, Math.cos(a) * 28] as [number, number, number], s: [7.4, 8, 2.2] as [number, number, number], ry: a }; }), []);
  const merl = useMemo(() => Array.from({ length: 56 }, (_, i) => { const a = (i / 56) * 6.28; return { p: [Math.sin(a) * 28, 8.6, Math.cos(a) * 28] as [number, number, number], s: [1.4, 1.2, 2.2] as [number, number, number], ry: a }; }), []);
  const clouds = useRef<THREE.Group>(null!);
  useFrame(() => { clouds.current.rotation.y = film.clock * 0.01; });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow><planeGeometry args={[60, 60]} /><meshToonMaterial map={tex} gradientMap={undefined} /></mesh>
    <Terrain bounds={80} base="#2a2433" far="#1a1620" hill={0.4} seed={2} />
    <Scatter geo={boxG} mat={stone} items={wall} shadow />
    <Scatter geo={boxG} mat={stone} items={merl} shadow />
    {[-9, 9].map((x) => [-10, -3, 4].map((z, i) => (
      <Breakable key={`${x}${z}`} id={`cp${i}${x < 0 ? 'l' : 'r'}`} x={x} z={z} sign={x < 0 ? 1 : -1}>
        <mesh position={[0, 3.5, 0]} material={stone} castShadow><cylinderGeometry args={[0.8, 0.95, 7, 14]} /></mesh>
        <Box p={[0, 7.15, 0]} s={[2.2, 0.35, 2.2]} m={dark} /><Box p={[0, 0.2, 0]} s={[2.2, 0.4, 2.2]} m={dark} />
        <mesh position={[x < 0 ? 1.6 : -1.6, 4.6, 0]} material={M('#6a2a8a', { side: THREE.DoubleSide })}><planeGeometry args={[0.1, 3]} /></mesh>
        <mesh position={[0, 3.2, x < 0 ? 0.95 : 0.95]} material={M('#6a2a8a', { side: THREE.DoubleSide })}><planeGeometry args={[0.9, 3.4]} /></mesh>
      </Breakable>)))}
    {/* gatehouse */}
    {[-7, 7].map((x) => <mesh key={x} position={[x, 7, 26]} material={stone} castShadow><cylinderGeometry args={[3, 3.3, 14, 14]} /></mesh>)}
    {[-7, 7].map((x) => <mesh key={x} position={[x, 15, 26]} material={dark}><coneGeometry args={[3.6, 4.5, 14]} /></mesh>)}
    <Box p={[0, 11, 26]} s={[12, 2.5, 3]} m={stone} />
    {/* throne dais */}
    {[0, 1, 2].map((i) => <Box key={i} p={[0, 0.2 + i * 0.4, -10 - i * 1.4]} s={[10 - i * 1.6, 0.4, 2.8]} m={i % 2 ? dark : stone} />)}
    <group position={[0, 1.2, -14.6]}>
      <Box p={[0, 1.2, 0]} s={[2, 0.5, 1.8]} m={dark} /><Box p={[0, 3, -0.7]} s={[2, 4.2, 0.4]} m={dark} />
      {[-0.8, 0.8].map((x) => <mesh key={x} position={[x, 5.6, -0.7]} material={M('#b04dff', { emissive: '#b04dff', emissiveIntensity: 0.6 })}><coneGeometry args={[0.18, 1.5, 6]} /></mesh>)}
    </group>
    <VeilGate />
    {[[-5.5, -6], [5.5, -6], [-6, 12], [6, 12]].map(([x, z], i) => (<group key={i}>
      <mesh position={[x, 0.7, z]} material={dark}><cylinderGeometry args={[0.5, 0.35, 1.4, 8]} /></mesh><Fire pos={[x, 1.4, z]} size={1.2} light={i < 2 ? 1.6 : 0} color="#c47aff" />
    </group>))}
    <group ref={clouds}>
      {Array.from({ length: 14 }, (_, i) => <mesh key={i} position={[Math.sin(i * 0.9) * 90, 55 + (i % 3) * 8, Math.cos(i * 0.9) * 90]} scale={[40, 9, 30]} material={new THREE.MeshBasicMaterial({ color: '#2a2a38', fog: false })}><sphereGeometry args={[1, 8, 6]} /></mesh>)}
    </group>
  </>);
}

// ---------------------------------------------------------------- TEMPLE
function TempleEnv() {
  const runeM = useMemo(() => emissive('#b04dff', 1.2), []);
  const goldM = useMemo(() => emissive('#f5b73b', 1), []);
  const beam = useRef<THREE.Mesh>(null!); const floaters = useRef<THREE.Group>(null!);
  const stone = useMemo(() => M('#6a6478'), []); const dark = useMemo(() => M('#2a2433'), []);
  const rocks = useMemo(() => { const r = rng(31); return Array.from({ length: 26 }, () => { const a = r() * 6.28, d = 24 + r() * 30; return { p: [Math.sin(a) * d, -14 + r() * 28, Math.cos(a) * d] as [number, number, number], s: 1 + r() * 4 }; }); }, []);
  const bm = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  useFrame(() => {
    const t = film.clock; runeM.emissiveIntensity = 0.8 + film.env.eclipse * 1.4 + Math.sin(t * 2) * 0.2;
    const lit = film.world.facts.has('sun_restored') || (film.scene?.id === 'a4_awakening' && film.env.targetEclipse < 0.5);
    bm.opacity += ((lit ? 0.55 : 0) - bm.opacity) * 0.03; beam.current.visible = bm.opacity > 0.01;
    floaters.current.children.forEach((c, i) => { c.position.y += Math.sin(t * 0.3 + i) * 0.004; c.rotation.y += 0.002; });
  });
  return (<>
    <mesh position={[0, -2, 0]} material={stone} receiveShadow castShadow><cylinderGeometry args={[18, 13, 4, 40]} /></mesh>
    <mesh position={[0, -8, 0]} material={dark}><coneGeometry args={[13, 12, 24]} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={runeM}><ringGeometry args={[11.6, 11.8, 64]} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={goldM}><ringGeometry args={[7.2, 7.32, 64]} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={runeM}><ringGeometry args={[3.2, 3.3, 48]} /></mesh>
    {Array.from({ length: 8 }, (_, i) => { const a = 0.4 + (i / 8) * 6.28; return (
      <Breakable key={i} id={`ms${i}`} x={Math.sin(a) * 14} z={Math.cos(a) * 14} sign={i % 2 ? 1 : -1}>
        <Box p={[0, 3, 0]} s={[1.6, 6, 1.2]} m={stone} r={[0, a, 0]} />
        <mesh position={[0, 3.3, 0]} rotation={[0, a, 0]} material={runeM}><boxGeometry args={[0.3, 3.5, 1.24]} /></mesh>
        <Box p={[0, 6.2, 0]} s={[1.9, 0.4, 1.5]} m={dark} r={[0, a, 0]} />
      </Breakable>); })}
    <group position={[0, 0, -7.4]}>
      {[0, 1, 2].map((i) => <mesh key={i} position={[0, 0.25 + i * 0.5, 0]} material={i % 2 ? dark : stone} castShadow><cylinderGeometry args={[2.4 - i * 0.5, 2.6 - i * 0.5, 0.5, 8]} /></mesh>)}
      <Box p={[0, 3, 0]} s={[0.9, 3.4, 0.9]} m={dark} />
      <mesh position={[0, 3.2, 0.46]} material={goldM}><octahedronGeometry args={[0.28]} /></mesh>
      <pointLight position={[0, 3.4, 1]} color="#d58bff" intensity={2.5} distance={16} />
      <mesh ref={beam} position={[0, 40, 0]} material={bm}><cylinderGeometry args={[1.2, 2.4, 80, 20, 1, true]} /></mesh>
    </group>
    {[0, 1, 2, 3, 4].map((i) => <Box key={i} p={[0, -0.1 - i * 0.35, 11 + i * 1.1]} s={[10 - i * 0.5, 0.4, 1.2]} m={i % 2 ? dark : stone} />)}
    <group ref={floaters}>
      {rocks.map((r, i) => <mesh key={i} position={r.p} scale={[r.s, r.s * 0.7, r.s]} material={dark} rotation={[i, i * 2, 0]}><dodecahedronGeometry args={[1]} /></mesh>)}
    </group>
  </>);
}

// ---------------------------------------------------------------- ROAD
function RoadEnv() {
  const avoid = useMemo<[number, number, number][]>(() => [[0, 0, 14]], []);
  const logs = [0, 1.05, 2.1];
  const night = useRef(0);
  const flame = useRef<THREE.Group>(null!);
  useFrame(() => { night.current = atm.night; flame.current.visible = true; });
  return (<>
    <Terrain bounds={27} base="#6a7a4a" far="#3f4a3a" hill={1.8} seed={9} />
    <mesh rotation={[-Math.PI / 2, 0, 0.1]} position={[0, 0.03, 3]} material={M('#9a8260')}><planeGeometry args={[70, 5]} /></mesh>
    <Forest count={110} inner={16} outer={90} seed={17} leaf="#2a4a35" avoid={avoid} />
    <Forest count={25} inner={26} outer={70} seed={33} dead trunk="#3a2e28" />
    <Rocks count={26} inner={14} outer={70} seed={13} color="#6a6470" size={1.2} />
    <mesh position={[-9, 0.9, -6]} scale={[1.8, 1.2, 1.6]} material={M('#5a5a66')} castShadow><icosahedronGeometry args={[1, 0]} /></mesh>
    <mesh position={[11, 1.2, -3]} scale={[2.3, 1.6, 2]} material={M('#605a66')} castShadow><icosahedronGeometry args={[1, 0]} /></mesh>
    <group position={[0, 0, 0]}>
      {logs.map((a) => <mesh key={a} position={[0, 0.18, 0]} rotation={[Math.PI / 2 - 0.3, a, 0]} material={M('#4a3022')}><cylinderGeometry args={[0.1, 0.1, 1.3, 7]} /></mesh>)}
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[Math.sin(i * 0.785) * 0.8, 0.1, Math.cos(i * 0.785) * 0.8]} material={M('#7a7a80')}><sphereGeometry args={[0.16, 7, 6]} /></mesh>)}
      <group ref={flame}><Fire pos={[0, 0.1, 0]} size={1.5} light={2.4} /></group>
    </group>
    <group position={[6, 0, 6]}><Box p={[0, 1, 0]} s={[0.15, 2, 0.15]} m={M('#5a3a22')} /><Box p={[0.3, 1.7, 0]} s={[1, 0.35, 0.08]} m={M('#8a6a42')} /></group>
    {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[Math.sin(i * 0.8) * 110, 14, Math.cos(i * 0.8 + 3) * -110 - 20]} scale={[26, 30, 26]} material={new THREE.MeshBasicMaterial({ color: '#2c3550', fog: true })}><coneGeometry args={[1, 1, 6]} /></mesh>)}
  </>);
}

export function Environment() {
  const env = useSyncExternalStore(film.subscribe, () => film.scene?.env ?? 'village');
  void ENVS;
  switch (env) {
    case 'village': return <VillageEnv />;
    case 'observatory': return <ObservatoryEnv />;
    case 'caverns': return <CavernEnv />;
    case 'citadel': return <CitadelEnv />;
    case 'temple': return <TempleEnv />;
    case 'road': return <RoadEnv />;
  }
}
