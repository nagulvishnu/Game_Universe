import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import { film } from '../film/runtime';
import { CHAR_MAP, type CharDef } from '../story/characters';
import { JOINTS, computePose, type Joint } from './poses';

const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toon = (c: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradient, ...o });
const UP = new THREE.Vector3(0, 1, 0);
const OUTLINE = '#150d1c';

function Spike({ at, dir, r, len, mat, seg = 6 }: { at: [number, number, number]; dir: [number, number, number]; r: number; len: number; mat: THREE.Material; seg?: number }) {
  const { q, p } = useMemo(() => {
    const d = new THREE.Vector3(...dir).normalize();
    return { q: new THREE.Quaternion().setFromUnitVectors(UP, d), p: [at[0] + (d.x * len) / 2, at[1] + (d.y * len) / 2, at[2] + (d.z * len) / 2] as [number, number, number] };
  }, [at, dir, len]);
  return <mesh position={p} quaternion={q} material={mat}><coneGeometry args={[r, len, seg]} /></mesh>;
}
const Cap = ({ r, l, p, rot, m, s, shadow }: { r: number; l: number; p: [number, number, number]; rot?: [number, number, number]; m: THREE.Material; s?: [number, number, number]; shadow?: boolean }) => (
  <mesh position={p} rotation={rot} scale={s} material={m} castShadow={shadow}><capsuleGeometry args={[r, l, 4, 10]} /></mesh>
);
const Ball = ({ r, p, m, s }: { r: number; p: [number, number, number]; m: THREE.Material; s?: [number, number, number] }) => (
  <mesh position={p} scale={s} material={m}><sphereGeometry args={[r, 14, 12]} /></mesh>
);

const BANGS: { at: [number, number, number]; dir: [number, number, number] }[] = [
  { at: [0, 0.1, 0.1], dir: [0, -0.5, 0.8] }, { at: [0.06, 0.1, 0.09], dir: [0.3, -0.7, 0.7] }, { at: [-0.06, 0.1, 0.09], dir: [-0.3, -0.7, 0.7] },
  { at: [0.105, 0.08, 0.05], dir: [0.7, -0.8, 0.3] }, { at: [-0.105, 0.08, 0.05], dir: [-0.7, -0.8, 0.3] },
];
const SPIKES: { at: [number, number, number]; dir: [number, number, number] }[] = [
  { at: [0, 0.12, -0.02], dir: [0, 1, -0.3] }, { at: [0.07, 0.11, -0.04], dir: [0.5, 0.9, -0.4] }, { at: [-0.07, 0.11, -0.04], dir: [-0.5, 0.9, -0.4] },
  { at: [0.11, 0.05, -0.06], dir: [1, 0.5, -0.6] }, { at: [-0.11, 0.05, -0.06], dir: [-1, 0.5, -0.6] }, { at: [0, 0, -0.12], dir: [0, 0.2, -1] },
  { at: [0.06, -0.04, -0.11], dir: [0.5, -0.2, -1] }, { at: [-0.06, -0.04, -0.11], dir: [-0.5, -0.2, -1] },
];

function Hair({ def, m }: { def: CharDef; m: Mats }) {
  const st = def.hair.style;
  return (
    <group>
      {st !== 'helm' && (
        <mesh position={[0, 0.032, -0.03]} scale={[1, 1, 1.03]} material={m.hair}><sphereGeometry args={[0.142, 18, 14]} /><Outlines thickness={0.006} color={OUTLINE} /></mesh>
      )}
      {st !== 'helm' && st !== 'elder' && BANGS.map((b, i) => <Spike key={i} {...b} r={0.034} len={st === 'long' ? 0.15 : 0.12} mat={m.hair} />)}
      {st === 'spiky' && SPIKES.map((b, i) => <Spike key={i} {...b} r={0.048} len={0.17} mat={m.hair} />)}
      {st === 'spiky' && <Spike at={[0.04, 0.1, 0.1]} dir={[0.4, -1, 0.5]} r={0.022} len={0.2} mat={m.hairAcc} />}
      {st === 'long' && (<>
        <Cap r={0.115} l={0.42} p={[0, -0.26, -0.1]} m={m.hair} />
        <Cap r={0.03} l={0.34} p={[0.128, -0.2, 0.02]} m={m.hair} /><Cap r={0.03} l={0.34} p={[-0.128, -0.2, 0.02]} m={m.hair} />
        <Ball r={0.03} p={[0.1, 0.1, -0.05]} m={m.hairAcc} />
      </>)}
      {st === 'elder' && (<>
        <Ball r={0.02} p={[0.13, 0.01, 0]} m={m.hair} s={[0.7, 2.2, 1.6]} />
        <Spike at={[0, -0.07, 0.1]} dir={[0, -1, 0.25]} r={0.1} len={0.42} mat={m.hair} seg={8} />
        <Cap r={0.012} l={0.07} p={[0.035, -0.055, 0.128]} rot={[0, 0, 1.4]} m={m.hair} /><Cap r={0.012} l={0.07} p={[-0.035, -0.055, 0.128]} rot={[0, 0, -1.4]} m={m.hair} />
      </>)}
      {st === 'bob' && (<>
        <Ball r={0.12} p={[0.1, -0.06, 0]} m={m.hair} s={[0.55, 1.2, 1]} /><Ball r={0.12} p={[-0.1, -0.06, 0]} m={m.hair} s={[0.55, 1.2, 1]} />
        <Ball r={0.14} p={[0, -0.08, -0.07]} m={m.hair} />
      </>)}
      {st === 'helm' && (<>
        <mesh position={[0, 0.02, 0]} material={m.metal}><sphereGeometry args={[0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} /><Outlines thickness={0.006} color={OUTLINE} /></mesh>
        <Cap r={0.02} l={0.1} p={[0.125, -0.05, 0.02]} m={m.metal} /><Cap r={0.02} l={0.1} p={[-0.125, -0.05, 0.02]} m={m.metal} />
        <Spike at={[0, 0.14, -0.02]} dir={[0, 1, -0.4]} r={0.025} len={0.16} mat={m.accent} />
      </>)}
      {st === 'crown' && (<>
        <Cap r={0.12} l={0.5} p={[0, -0.3, -0.1]} m={m.hair} />
        <Spike at={[0.09, 0.12, 0]} dir={[0.6, 1, -0.2]} r={0.035} len={0.3} mat={m.accent} /><Spike at={[-0.09, 0.12, 0]} dir={[-0.6, 1, -0.2]} r={0.035} len={0.3} mat={m.accent} />
        <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.glow}><torusGeometry args={[0.125, 0.012, 6, 20]} /></mesh>
      </>)}
    </group>
  );
}

interface Mats { skin: THREE.Material; hair: THREE.Material; hairAcc: THREE.Material; primary: THREE.MeshToonMaterial; secondary: THREE.MeshToonMaterial; accent: THREE.MeshToonMaterial; metal: THREE.Material; white: THREE.Material; iris: THREE.Material; dark: THREE.Material; glow: THREE.MeshBasicMaterial; blade: THREE.MeshToonMaterial; mark: THREE.MeshBasicMaterial; bandage: THREE.Material; blush: THREE.MeshBasicMaterial; aura: THREE.MeshBasicMaterial; mouth: THREE.Material; cape: THREE.Material }

function makeMats(def: CharDef): Mats {
  const o = def.outfit;
  return {
    skin: toon(def.skin), hair: toon(def.hair.color), hairAcc: toon(def.hair.accent ?? def.hair.color, { emissive: def.hair.accent ?? '#000', emissiveIntensity: 0.15 }),
    primary: toon(o.primary), secondary: toon(o.secondary), accent: toon(o.accent, { emissive: o.accent, emissiveIntensity: 0.35 }),
    metal: toon('#8e93a3'), white: toon('#ffffff'), iris: toon(def.eyes, { emissive: def.eyes, emissiveIntensity: 0.5 }), dark: toon('#1a1018'),
    glow: new THREE.MeshBasicMaterial({ color: o.accent }), blade: toon('#e8eefc', { emissive: o.accent, emissiveIntensity: 0.4 }),
    mark: new THREE.MeshBasicMaterial({ color: def.id === 'malachar' ? '#b04dff' : '#ffc94d', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    bandage: toon('#f4efe2'), blush: new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0, depthWrite: false }),
    aura: new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }),
    mouth: new THREE.MeshBasicMaterial({ color: '#5a1a28' }),
    cape: toon(def.id === 'kael' ? o.secondary : o.primary, { side: THREE.DoubleSide }),
  };
}

function Weapon({ def, m }: { def: CharDef; m: Mats }) {
  switch (def.weapon) {
    case 'sword': return (<group>
      <mesh position={[0, -0.5, 0]} material={m.blade}><boxGeometry args={[0.04, 0.8, 0.012]} /></mesh>
      <mesh position={[0, -0.08, 0]} material={m.accent}><boxGeometry args={[0.18, 0.025, 0.04]} /></mesh>
      <Cap r={0.017} l={0.1} p={[0, 0.0, 0]} m={m.dark} /></group>);
    case 'rapier': return (<group>
      <mesh position={[0, -0.6, 0]} material={m.blade}><boxGeometry args={[0.018, 0.95, 0.01]} /></mesh>
      <Ball r={0.06} p={[0, -0.07, 0]} m={m.accent} s={[1, 0.5, 1]} /><Cap r={0.015} l={0.08} p={[0, 0, 0]} m={m.dark} /></group>);
    case 'greatsword': return (<group>
      <mesh position={[0, -0.8, 0]} material={m.blade}><boxGeometry args={[0.11, 1.3, 0.02]} /></mesh>
      <mesh position={[0, -0.8, 0.012]} material={m.glow}><boxGeometry args={[0.025, 1.25, 0.004]} /></mesh>
      <mesh position={[0, -0.1, 0]} material={m.accent}><boxGeometry args={[0.32, 0.04, 0.06]} /></mesh><Cap r={0.022} l={0.16} p={[0, 0.04, 0]} m={m.dark} /></group>);
    case 'staff': return (<group position={[0, 0.0, 0]} rotation={[1.0, 0, 0]}>
      <Cap r={0.02} l={1.6} p={[0, 0.45, 0]} m={toon('#6b4a2a')} />
      <Ball r={0.07} p={[0, 1.34, 0]} m={m.glow} /><mesh position={[0, 1.34, 0]} material={m.accent}><torusGeometry args={[0.1, 0.012, 6, 14]} /></mesh></group>);
    case 'spear': return (<group rotation={[0.9, 0, 0]}>
      <Cap r={0.02} l={1.7} p={[0, 0.35, 0]} m={toon('#5a4030')} /><Spike at={[0, 1.25, 0]} dir={[0, 1, 0]} r={0.04} len={0.28} mat={m.blade} /></group>);
    default: return null;
  }
}

function Outfit({ def, m }: { def: CharDef; m: Mats }) {
  const s = def.outfit.style;
  return (
    <>
      {(s === 'coat' || s === 'dress' || s === 'dark' || s === 'robe') && (
        <mesh position={[0, s === 'robe' || s === 'dark' ? -0.42 : -0.2, 0]} material={m.primary} castShadow>
          <cylinderGeometry args={[0.17, s === 'robe' ? 0.3 : s === 'dark' ? 0.28 : s === 'dress' ? 0.3 : 0.25, s === 'robe' || s === 'dark' ? 0.9 : s === 'dress' ? 0.5 : 0.55, 14, 1, true]} />
          <Outlines thickness={0.005} color={OUTLINE} />
        </mesh>
      )}
      {s === 'coat' && <mesh position={[0, -0.2, 0]} material={m.secondary}><torusGeometry args={[0.205, 0.012, 6, 20]} /></mesh>}
      {s === 'armor' && (<>
        {[-0.12, 0, 0.12].map((x) => <mesh key={x} position={[x, -0.12, 0.1]} rotation={[0.15, 0, 0]} material={m.secondary}><boxGeometry args={[0.1, 0.26, 0.02]} /></mesh>)}
        {[-0.14, 0.14].map((x) => <mesh key={x} position={[x, -0.12, -0.08]} rotation={[-0.15, 0, 0]} material={m.secondary}><boxGeometry args={[0.12, 0.26, 0.02]} /></mesh>)}
      </>)}
    </>
  );
}

export function CharacterModel({ id }: { id: string }) {
  const def = CHAR_MAP[id];
  const m = useMemo(() => makeMats(def), [def]);
  const root = useRef<THREE.Group>(null!);
  const pivot = useRef<THREE.Group>(null!);
  const refs = useRef<Record<string, THREE.Group>>({});
  const cur = useRef<Record<string, [number, number, number]>>(Object.fromEntries(JOINTS.map((j) => [j, [0, 0, 0]])));
  const headRef = useRef<THREE.Group>(null!);
  const eyeL = useRef<THREE.Group>(null!); const eyeR = useRef<THREE.Group>(null!);
  const irisL = useRef<THREE.Group>(null!); const irisR = useRef<THREE.Group>(null!);
  const browL = useRef<THREE.Mesh>(null!); const browR = useRef<THREE.Mesh>(null!);
  const mouth = useRef<THREE.Mesh>(null!); const smile = useRef<THREE.Mesh>(null!);
  const tear = useRef<THREE.Mesh>(null!);
  const cape = useRef<THREE.Group>(null!);
  const auraMesh = useRef<THREE.Mesh>(null!); const auraLight = useRef<THREE.PointLight>(null!);
  const markMesh = useRef<THREE.Mesh>(null!);
  const swordHand = useRef<THREE.Group>(null!); const swordBack = useRef<THREE.Group>(null!);
  const bandage = useRef<THREE.Mesh>(null!); const keyGlow = useRef<THREE.Mesh>(null!);
  const body = useRef<THREE.Group>(null!);
  const set = (k: string) => (g: THREE.Group | null) => { if (g) refs.current[k] = g; };
  const sc = def.height / 1.88;
  const o = def.outfit;
  const hasCape = def.outfit.style === 'dark' || id === 'lyra' || def.outfit.style === 'robe' || id === 'kael';
  const handWeapon = def.weapon === 'staff' || def.weapon === 'spear';
  const dyn = useRef({ tint: 1 });

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const a = film.agents.get(id);
    if (!a || !a.active) { if (root.current) root.current.visible = false; return; }
    root.current.visible = true;
    const t = film.clock;
    const pose = computePose(a, t);
    const k = 1 - Math.exp(-(pose.fast ? 22 : 9) * dt);
    for (const jn of JOINTS) {
      const c = cur.current[jn], tg = pose.j[jn as Joint], g = refs.current[jn];
      c[0] += (tg[0] - c[0]) * k; c[1] += (tg[1] - c[1]) * k; c[2] += (tg[2] - c[2]) * k;
      if (g) g.rotation.set(c[0], c[1], c[2]);
    }
    const pv = pivot.current;
    pv.position.y += (pose.rootY - pv.position.y) * k; pv.rotation.x += (pose.rootPitch - pv.rotation.x) * k;
    pv.position.x += (pose.rootX - pv.position.x) * k;
    root.current.position.set(a.x, 0, a.z); root.current.rotation.y = a.yaw;
    // head & face
    const h = headRef.current;
    h.rotation.y += (a.headYaw + pose.headY - h.rotation.y) * k; h.rotation.x += (a.headPitch + pose.headX - h.rotation.x) * k; h.rotation.z += (pose.headZ - h.rotation.z) * k;
    const f = a.faceParams();
    const lid = a.blink > 0 ? 1 - Math.sin(Math.PI * Math.min(1, a.blink)) : 1;
    const eo = f.eyeOpen * lid;
    eyeL.current.scale.y += (eo - eyeL.current.scale.y) * 0.5; eyeR.current.scale.y = eyeL.current.scale.y;
    irisL.current.position.set(a.eyeYaw * 0.03, a.eyePitch * 0.02, 0.004); irisR.current.position.copy(irisL.current.position);
    const tilt = -f.browTilt;
    browL.current.rotation.z = tilt * 0.45; browR.current.rotation.z = -tilt * 0.45;
    browL.current.position.y = browR.current.position.y = 0.068 + f.browY * 0.018;
    const open = a.mouthOpen, wide = a.mouthWide;
    mouth.current.scale.set(0.02 + Math.max(0, wide) * 0.012 - Math.max(0, -wide) * 0.007 + open * 0.004, 0.003 + open * 0.034, 0.01);
    mouth.current.visible = open > 0.05;
    smile.current.visible = open < 0.25;
    smile.current.rotation.z = f.smile > 0 ? Math.PI : 0; smile.current.scale.set(1, Math.abs(f.smile) * 0.7 + 0.04, 1);
    smile.current.position.y = -0.062 + (f.smile > 0 ? 0.012 : -0.004);
    tear.current.visible = f.tear > 0;
    m.blush.opacity = f.blush * 0.6;
    // cloth tint by hp (battle wear)
    const tint = 0.72 + 0.28 * Math.min(1, a.hp + 0.2);
    if (Math.abs(tint - dyn.current.tint) > 0.01) { dyn.current.tint = tint; m.primary.color.set(o.primary).multiplyScalar(tint); }
    // cape & weapon visibility
    if (cape.current) cape.current.rotation.x = 0.12 + Math.min(0.9, a.speed * 0.16) + Math.sin(t * 2 + a.x) * 0.04;
    const drawn = a.weaponDrawn || handWeapon;
    if (swordHand.current) swordHand.current.visible = drawn;
    if (swordBack.current) swordBack.current.visible = !drawn && !handWeapon;
    // aura & mark
    const lv = a.aura?.level ?? 0;
    if (auraMesh.current) {
      m.aura.opacity = Math.min(0.42, lv * 0.28); if (a.aura) m.aura.color.set(a.aura.color);
      auraMesh.current.visible = lv > 0.02; auraMesh.current.scale.setScalar(1 + Math.sin(t * 10) * 0.04 + lv * 0.05);
      auraLight.current.intensity = lv * 3.2; if (a.aura) auraLight.current.color.set(a.aura.color);
    }
    if (markMesh.current) {
      const faded = film.world.facts.has('sun_restored') && id === 'kael';
      markMesh.current.visible = !faded; markMesh.current.scale.setScalar(0.6 + a.markGlow * 1.1);
    }
    if (bandage.current) bandage.current.visible = a.injuries.includes('arm');
    if (keyGlow.current) keyGlow.current.visible = film.world.possessions[id]?.includes('veil_key') ?? false;
    body.current.scale.set(1, 1, 1);
  });

  const tone = (c: string) => c;
  void tone;
  return (
    <group ref={root} scale={[sc * def.build, sc, sc * def.build]} visible={false}>
      <group ref={pivot}>
        <group ref={set('hips')} position={[0, 0.92, 0]}>
          <group ref={body}>
            <Ball r={0.15} p={[0, 0, 0]} m={m.secondary} s={[1.05, 0.7, 0.85]} />
            <Outfit def={def} m={m} />
            {id === 'lyra' && <mesh position={[0.2, -0.02, -0.05]} material={toon('#8a6a45')}><boxGeometry args={[0.1, 0.16, 0.2]} /></mesh>}
            {/* legs */}
            {([['L', 1], ['R', -1]] as const).map(([sd, sg]) => (
              <group key={sd} ref={set('th' + sd)} position={[0.09 * sg, -0.02, 0]}>
                <Cap r={0.068} l={0.32} p={[0, -0.22, 0]} m={def.outfit.style === 'armor' ? m.secondary : m.primary} shadow />
                <group ref={set('kn' + sd)} position={[0, -0.46, 0]}>
                  <Cap r={0.054} l={0.32} p={[0, -0.22, 0]} m={m.dark} shadow />
                  <mesh position={[0, -0.46, 0.04]} material={m.dark}><boxGeometry args={[0.09, 0.06, 0.2]} /></mesh>
                  {def.outfit.style === 'armor' && <Cap r={0.06} l={0.18} p={[0, -0.18, 0]} m={m.metal} />}
                </group>
              </group>
            ))}
            {/* spine / torso */}
            <group ref={set('spine')} position={[0, 0.04, 0]}>
              <mesh position={[0, 0.2, 0]} material={m.primary} scale={[1, 1, 0.82]} castShadow><capsuleGeometry args={[0.125, 0.26, 5, 12]} /><Outlines thickness={0.006} color={OUTLINE} /></mesh>
              <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.accent}><torusGeometry args={[0.13, 0.014, 6, 18]} /></mesh>
              <group ref={set('chest')} position={[0, 0.34, 0]}>
                {def.outfit.style === 'armor' && <mesh position={[0, 0.02, 0.02]} material={m.secondary} scale={[1, 1, 0.8]}><capsuleGeometry args={[0.14, 0.14, 4, 10]} /></mesh>}
                {def.outfit.style === 'dark' && [-1, 1].map((sg) => <Spike key={sg} at={[0.2 * sg, 0.22, 0]} dir={[sg * 0.8, 1, 0]} r={0.05} len={0.22} mat={m.accent} />)}
                {def.outfit.style === 'armor' && [-1, 1].map((sg) => <Ball key={sg} r={0.075} p={[0.2 * sg, 0.19, 0]} m={m.metal} s={[1.1, 0.8, 1.1]} />)}
                {id === 'kael' && <mesh position={[0, 0.2, 0.0]} rotation={[Math.PI / 2, 0, 0]} material={toon('#c9a24a')}><torusGeometry args={[0.105, 0.03, 6, 16]} /></mesh>}
                {id === 'lyra' && <mesh ref={keyGlow} position={[0, 0.06, 0.12]} material={m.glow}><octahedronGeometry args={[0.03]} /></mesh>}
                {/* cape (anchored at shoulders) */}
                {hasCape && (
                  <group ref={cape} position={[0, 0.2, -0.1]}>
                    <mesh position={[0, -0.34, -0.02]} material={m.cape}>
                      <planeGeometry args={[def.outfit.style === 'dark' ? 0.55 : 0.4, def.outfit.style === 'dark' ? 1.15 : id === 'lyra' ? 0.55 : 0.75]} />
                    </mesh>
                  </group>
                )}
                {/* arms */}
                {([['L', 1], ['R', -1]] as const).map(([sd, sg]) => (
                  <group key={sd} ref={set('sh' + sd)} position={[0.2 * sg, 0.18, 0]}>
                    <Ball r={0.05} p={[0, 0, 0]} m={m.primary} />
                    {def.outfit.style === 'robe' && <mesh position={[0, -0.16, 0]} material={m.primary}><cylinderGeometry args={[0.06, 0.11, 0.3, 10, 1, true]} /></mesh>}
                    <Cap r={0.042} l={0.2} p={[0, -0.16, 0]} m={m.primary} shadow />
                    <group ref={set('el' + sd)} position={[0, -0.31, 0]}>
                      <Cap r={0.036} l={0.2} p={[0, -0.14, 0]} m={def.outfit.style === 'armor' ? m.metal : m.skin} />
                      {sd === 'L' && <mesh ref={bandage} position={[0, -0.14, 0]} material={m.bandage} visible={false}><cylinderGeometry args={[0.045, 0.045, 0.16, 10]} /></mesh>}
                      <Ball r={0.044} p={[0, -0.3, 0]} m={m.skin} />
                      {sd === 'R' && (<>
                        {def.bearer && <mesh ref={markMesh} position={[0, -0.3, -0.04]} material={m.mark}><sphereGeometry args={[0.06, 10, 8]} /></mesh>}
                        <group ref={swordHand} position={[0, -0.3, 0]} rotation={[-1.1, 0, 0]} visible={false}><Weapon def={def} m={m} /></group>
                      </>)}
                    </group>
                  </group>
                ))}
                {/* sheathed weapon */}
                {!handWeapon && def.weapon !== 'none' && (
                  <group ref={swordBack} position={[0, 0.15, -0.17]} rotation={[0, 0, 0.9]}><group rotation={[Math.PI, 0, 0]} scale={0.85}><Weapon def={def} m={m} /></group></group>
                )}
                {/* neck + head */}
                <group position={[0, 0.34, 0]}>
                  <Cap r={0.04} l={0.06} p={[0, 0.04, 0]} m={m.skin} />
                  {id === 'kael' && <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.accent}><torusGeometry args={[0.07, 0.025, 6, 14]} /></mesh>}
                  <group ref={headRef} position={[0, 0.18, 0]}>
                    <mesh scale={[0.95, 1.04, 0.98]} material={m.skin} castShadow><sphereGeometry args={[0.135, 20, 16]} /><Outlines thickness={0.006} color={OUTLINE} /></mesh>
                    <Ball r={0.05} p={[0, -0.095, 0.05]} m={m.skin} s={[1.1, 0.8, 1]} />
                    <Ball r={0.02} p={[0.128, -0.005, 0]} m={m.skin} s={[0.6, 1.2, 1]} /><Ball r={0.02} p={[-0.128, -0.005, 0]} m={m.skin} s={[0.6, 1.2, 1]} />
                    {/* eyes */}
                    {([['L', 1], ['R', -1]] as const).map(([sd, sg]) => (
                      <group key={sd} position={[0.052 * sg, 0.002, 0.118]} ref={sd === 'L' ? eyeL : eyeR}>
                        <mesh material={m.white} scale={[1, 1.25, 0.35]}><sphereGeometry args={[0.04, 14, 12]} /></mesh>
                        <group ref={sd === 'L' ? irisL : irisR} position={[0, 0, 0.004]}>
                          <mesh position={[0, 0, 0.008]} material={m.iris} scale={[1, 1.3, 0.35]}><sphereGeometry args={[0.03, 12, 10]} /></mesh>
                          <mesh position={[0, 0, 0.016]} material={m.dark} scale={[1, 1.4, 0.3]}><sphereGeometry args={[0.014, 10, 8]} /></mesh>
                          <mesh position={[0.01 * sg, 0.017, 0.022]} material={m.white} scale={[1, 1, 0.4]}><sphereGeometry args={[0.008, 8, 6]} /></mesh>
                        </group>
                        <mesh position={[0, 0.045, 0.006]} material={m.dark} scale={[1.15, 0.12, 0.3]}><sphereGeometry args={[0.04, 10, 8]} /></mesh>
                      </group>
                    ))}
                    <mesh ref={browL} position={[0.055, 0.068, 0.12]} material={m.hair}><boxGeometry args={[0.052, 0.01, 0.01]} /></mesh>
                    <mesh ref={browR} position={[-0.055, 0.068, 0.12]} material={m.hair}><boxGeometry args={[0.052, 0.01, 0.01]} /></mesh>
                    <mesh position={[0.08, -0.04, 0.1]} material={m.blush} rotation={[0, 0.5, 0]}><circleGeometry args={[0.026, 10]} /></mesh>
                    <mesh position={[-0.08, -0.04, 0.1]} material={m.blush} rotation={[0, -0.5, 0]}><circleGeometry args={[0.026, 10]} /></mesh>
                    <mesh ref={tear} position={[0.06, -0.035, 0.122]} material={toon('#9fd8ff')} visible={false}><sphereGeometry args={[0.008, 8, 6]} /></mesh>
                    <mesh ref={mouth} position={[0, -0.066, 0.124]} material={m.mouth}><sphereGeometry args={[1, 10, 8]} /></mesh>
                    <mesh ref={smile} position={[0, -0.062, 0.125]} material={m.dark}><torusGeometry args={[0.028, 0.0035, 5, 12, Math.PI]} /></mesh>
                    <Hair def={def} m={m} />
                  </group>
                </group>
              </group>
            </group>
          </group>
          {/* aura */}
          <mesh ref={auraMesh} position={[0, 0.5, 0]} material={m.aura} visible={false}><sphereGeometry args={[0.85, 16, 12]} /></mesh>
          <pointLight ref={auraLight} position={[0, 0.5, 0.3]} distance={7} intensity={0} />
        </group>
      </group>
    </group>
  );
}
