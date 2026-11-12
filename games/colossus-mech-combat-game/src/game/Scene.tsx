import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { Game } from './engine';
import { useStore, type LaunchCfg } from './store';
import { buildMech, buildMonster, type MechPose } from './models';
import { MECH_BY_ID, MONSTERS } from './data';
import type { Cust } from './store';

function Runner({ cfg }: { cfg: LaunchCfg }) {
  const { scene, camera, gl } = useThree(); const ref = useRef<Game | null>(null);
  useEffect(() => { const g = new Game(scene, camera as THREE.PerspectiveCamera, gl, cfg); ref.current = g; return () => { g.dispose(); ref.current = null; }; }, [scene, camera, gl, cfg]);
  useFrame((_, dt) => { ref.current?.update(dt); });
  return null;
}
export function GameCanvas() {
  const cfg = useStore(s => s.cfg)!; const s = useStore(s => s.settings); const key = useStore(s => s.runKey); const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2) * s.res);
  const fx = s.quality === 'high' || s.quality === 'ultra';
  return <Canvas key={key} dpr={dpr} shadows={s.shadows > 0} gl={{ antialias: s.quality !== 'low' && !fx, powerPreference: 'high-performance', stencil: false }} camera={{ fov: s.fov, near: 0.5, far: 3500, position: [0, 12, -80] }} style={{ position: 'absolute', inset: 0 }}>
    <Runner cfg={cfg} />
    {fx && <EffectComposer multisampling={0}><Bloom intensity={s.quality === 'ultra' ? 0.9 : 0.65} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur /><Vignette eskil={false} offset={0.3} darkness={0.55} /><ToneMapping mode={ToneMappingMode.ACES_FILMIC} /></EffectComposer>}
  </Canvas>;
}

const IDLE: MechPose = { move: 0, atk: 0, atkType: 'slash', combo: 0, ranged: false, air: false, vy: 0, dash: false, hit: 0, guard: false, dead: 0, fire: 0, charge: 0, fly: false };

function MenuWorld() {
  const profile = useStore(s => s.profile); const id = profile.selected; const { camera } = useThree();
  const mech = useMemo(() => buildMech(MECH_BY_ID[id], profile.mechs[id].cust), [id]);
  const mon = useMemo(() => buildMonster(MONSTERS.drakoth), []); const mon2 = useMemo(() => buildMonster(MONSTERS.galewyvern), []);
  const sky = useMemo(() => {
    const g = new THREE.SphereGeometry(900, 24, 16); const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 p; void main(){ p=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec3 p; void main(){ float h=clamp(p.y,0.0,1.0); vec3 c=mix(vec3(0.95,0.45,0.3),vec3(0.03,0.05,0.16),pow(h,0.5)); if(p.y<0.0) c=vec3(0.2,0.1,0.15); gl_FragColor=vec4(c,1.0);}' });
    return new THREE.Mesh(g, m);
  }, []);
  const city = useMemo(() => {
    const n = 140; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#1a2038', emissive: '#4fb8ff', emissiveIntensity: 0.25, roughness: 0.9 }), n); const d = new THREE.Object3D(); const c = new THREE.Color();
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 1.1 - 0.15 * Math.PI; const r = 160 + Math.random() * 120; const h = 20 + Math.random() * 90; const w = 8 + Math.random() * 18; d.position.set(Math.cos(a + 0.4) * r - 40, h / 2, -Math.abs(Math.sin(a + 0.4)) * r - 30); d.scale.set(w, h, w); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.setHSL(0.6 + Math.random() * 0.08, 0.4, 0.15 + Math.random() * 0.2)); }
    im.frustumCulled = false; return im;
  }, []);
  const t0 = useRef(0);
  useEffect(() => () => { mech.dispose(); mon.dispose(); mon2.dispose(); }, [mech, mon, mon2]);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime; t0.current = t; mech.update(t, dt, IDLE); mech.group.position.set(0, 0, 0); mech.group.rotation.y = -0.5 + Math.sin(t * 0.2) * 0.1;
    mon.group.position.set(70, 0, -190 + Math.sin(t * 0.1) * 6); mon.group.rotation.y = Math.PI * 0.85; mon.group.scale.setScalar(MONSTERS.drakoth.scale * 3.2); mon.update(t, dt, 0.5, 0, 0);
    mon2.group.position.set(-120 + Math.sin(t * 0.15) * 60, 90 + Math.sin(t * 0.7) * 6, -260); mon2.group.rotation.y = Math.cos(t * 0.15) * 0.8 + 3.14; mon2.group.scale.setScalar(2.6); mon2.update(t, dt, 1, 0, 0);
    const a = -0.55 + Math.sin(t * 0.15) * 0.3; camera.position.set(Math.sin(a) * 36, 7 + Math.sin(t * 0.2) * 1.2, Math.cos(a) * 36); camera.lookAt(0, 8.5, -8);
  });
  return <>
    <fog attach="fog" args={['#3a2a4a', 0.0045]} /><primitive object={sky} /><primitive object={city} />
    <hemisphereLight args={['#ffb090', '#101428', 1.0]} /><directionalLight position={[-60, 40, -50]} intensity={2.6} color="#ffb48a" /><directionalLight position={[50, 20, 60]} intensity={0.9} color="#6aa0ff" />
    <mesh rotation-x={-Math.PI / 2} position-y={-0.05}><planeGeometry args={[1200, 1200]} /><meshStandardMaterial color="#141826" roughness={0.9} /></mesh>
    <gridHelper args={[600, 60, '#2a6a9a', '#18304a']} position-y={0.02} />
    <primitive object={mech.group} /><primitive object={mon.group} /><primitive object={mon2.group} />
    <mesh position={[-300, 120, -520]}><sphereGeometry args={[70, 24, 16]} /><meshBasicMaterial color="#ffd0a0" fog={false} /></mesh>
    <Sparkles count={120} scale={[120, 50, 120]} size={5} speed={0.5} color="#ffb070" position={[0, 20, 0]} />
  </>;
}
export function MenuScene() {
  const s = useStore(st => st.settings); const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2) * Math.min(1, s.res));
  return <Canvas dpr={dpr} gl={{ antialias: s.quality !== 'low', powerPreference: 'high-performance' }} camera={{ fov: 48, near: 0.5, far: 2000, position: [0, 8, 36] }} style={{ position: 'absolute', inset: 0 }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }}><MenuWorld />
    {(s.quality === 'high' || s.quality === 'ultra') && <EffectComposer multisampling={0}><Bloom intensity={0.7} luminanceThreshold={0.8} mipmapBlur /><ToneMapping mode={ToneMappingMode.ACES_FILMIC} /></EffectComposer>}
  </Canvas>;
}

// ---------------------------------------------------------------- turntable viewer
function ViewerModel({ kind, id, cust, k, silhouette }: { kind: 'mech' | 'monster'; id: string; cust?: Cust; k: number; silhouette?: boolean }) {
  const key = kind + id + (cust ? JSON.stringify(cust) : '') + (silhouette ? 's' : '');
  const model = useMemo(() => {
    if (kind === 'mech') return buildMech(MECH_BY_ID[id], cust!);
    const m = buildMonster(MONSTERS[id]); if (silhouette) m.mats.forEach(x => { x.color.set('#04060a'); x.emissive.set('#0a1830'); x.emissiveIntensity = 1; }); return m;
  }, [key]); // eslint-disable-line
  useEffect(() => () => model.dispose(), [model]);
  const grp = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    if (kind === 'mech') { const m = model as ReturnType<typeof buildMech>; m.update(t, dt, IDLE); const cur = (m as any).k || 0; m.setTransform(cur + (k - cur) * Math.min(1, dt * 3)); } else (model as ReturnType<typeof buildMonster>).update(t, dt, 0.35, 0, 0);
    if (grp.current) grp.current.rotation.y += dt * 0.0;
  });
  const def = kind === 'mech' ? MECH_BY_ID[id] : MONSTERS[id]; const sc = kind === 'mech' ? 1 : 1; void def; void sc;
  return <group ref={grp}><primitive object={model.group} /></group>;
}
export function ModelViewer({ kind, id, cust, k = 0, silhouette = false, size }: { kind: 'mech' | 'monster'; id: string; cust?: Cust; k?: number; silhouette?: boolean; size?: number }) {
  const h = size ?? (kind === 'mech' ? 10 * MECH_BY_ID[id].scale : MONSTERS[id].radius * 2.4 * MONSTERS[id].scale / Math.max(1, MONSTERS[id].scale * 0.6));
  const mdef = kind === 'monster' ? MONSTERS[id] : null; const cy = kind === 'mech' ? 5.5 * MECH_BY_ID[id].scale : (mdef!.ai === 'fly' || mdef!.ai === 'float' ? 0 : mdef!.radius * 0.9);
  const dist = kind === 'mech' ? 30 * MECH_BY_ID[id].scale : mdef!.radius * 3.4 + 18; void h;
  return <Canvas key={kind + id} dpr={[1, 1.5]} camera={{ fov: 38, near: 0.5, far: 800, position: [dist * 0.7, cy + dist * 0.25, dist * 0.9] }} gl={{ antialias: true }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }}>
    <color attach="background" args={['#06101e']} /><fog attach="fog" args={['#06101e', 80, 400]} />
    <hemisphereLight args={['#bfe6ff', '#101828', 1.2]} /><directionalLight position={[30, 50, 30]} intensity={2.4} color="#fff2e0" /><directionalLight position={[-40, 20, -30]} intensity={1.2} color="#4a9cff" /><pointLight position={[0, 6, 14]} intensity={150} color="#4fd8ff" />
    <mesh rotation-x={-Math.PI / 2} position-y={-0.1}><circleGeometry args={[kind === 'mech' ? 22 * MECH_BY_ID[id].scale : mdef!.radius * 2.2, 48]} /><meshStandardMaterial color="#0e1a2c" metalness={0.8} roughness={0.35} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position-y={0.0}><ringGeometry args={[kind === 'mech' ? 20 * MECH_BY_ID[id].scale : mdef!.radius * 2, kind === 'mech' ? 21 * MECH_BY_ID[id].scale : mdef!.radius * 2.1, 64]} /><meshBasicMaterial color="#4fd8ff" /></mesh>
    <ViewerModel kind={kind} id={id} cust={cust} k={k} silhouette={silhouette} />
    <OrbitControls target={[0, cy, 0]} enablePan={false} autoRotate autoRotateSpeed={1.2} minDistance={dist * 0.5} maxDistance={dist * 1.8} maxPolarAngle={Math.PI / 2.05} />
    <Sparkles count={40} scale={[40, 20, 40]} size={3} speed={0.3} color="#4fd8ff" position={[0, 8, 0]} />
  </Canvas>;
}
