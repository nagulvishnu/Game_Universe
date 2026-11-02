import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { Look } from '../game/types';

export interface AnimState {
  speed: number; // 0..1 normalised planar speed
  mode: 0 | 1 | 2 | 3; // idle / walk / run / sprint
  air: boolean;
  vy: number;
  land: number; // seconds remaining of landing squash
  wave: number; // seconds remaining of interaction gesture
  talk: boolean;
}
export const makeAnim = (): AnimState => ({ speed: 0, mode: 0, air: false, vy: 0, land: 0, wave: 0, talk: false });

// ---- shared geometry & toon materials (anime cel-shading) ----
const G = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  circle: new THREE.CircleGeometry(1, 14),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 18),
  cap: new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.47),
  dome: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
};
let gradient: THREE.DataTexture | null = null;
function gradientMap() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}
const mats = new Map<string, THREE.Material>();
const mat = (hex: string) => {
  let m = mats.get(hex);
  if (!m) { m = new THREE.MeshToonMaterial({ color: hex, gradientMap: gradientMap() }); mats.set(hex, m); }
  return m;
};
const OUT = new THREE.MeshBasicMaterial({ color: '#14101f', side: THREE.BackSide });
const FLAT = (hex: string) => {
  const k = 'flat' + hex;
  let m = mats.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: hex }); mats.set(k, m); }
  return m;
};

type V3 = [number, number, number];
function M({ g, c, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], o = false, flat = false }: { g: THREE.BufferGeometry; c: string; p?: V3; r?: V3; s?: V3; o?: boolean; flat?: boolean }) {
  return (
    <group position={p} rotation={r} scale={s}>
      <mesh geometry={g} material={flat ? FLAT(c) : mat(c)} castShadow />
      {o && <mesh geometry={g} material={OUT} scale={1.06} />}
    </group>
  );
}

function Hair({ look }: { look: Look }) {
  const c = look.hair;
  const dark = useMemo(() => new THREE.Color(c).multiplyScalar(0.8).getStyle(), [c]);
  const st = look.hairStyle;
  const cap = st === 'short' ? 0.265 : 0.285;
  const bangs = (
    <>
      {[-0.14, -0.05, 0.05, 0.14].map((x, i) => (
        <M key={i} g={G.cone} c={i % 2 ? c : dark} p={[x, 0.17 - Math.abs(x) * 0.25, 0.22]} r={[Math.PI * 0.92, 0, x * 1.2]} s={[0.075, 0.2, 0.06]} o />
      ))}
    </>
  );
  return (
    <group>
      <M g={G.cap} c={c} p={[0, 0.04, -0.03]} s={[cap, cap + 0.01, cap]} o />
      {st !== 'mohawk' && bangs}
      {st === 'spiky' && Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <M key={i} g={G.cone} c={i % 2 ? c : dark} p={[Math.cos(a) * 0.15, 0.27, Math.sin(a) * 0.15 - 0.02]} r={[Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]} s={[0.1, 0.3, 0.1]} o />;
      })}
      {st === 'mohawk' && Array.from({ length: 6 }, (_, i) => <M key={i} g={G.cone} c={i % 2 ? c : dark} p={[0, 0.25, 0.15 - i * 0.075]} r={[(i - 2.5) * 0.12, 0, 0]} s={[0.07, 0.34, 0.09]} o />)}
      {st === 'bob' && (<><M g={G.box} c={c} p={[-0.24, -0.05, 0]} s={[0.1, 0.34, 0.4]} o /><M g={G.box} c={c} p={[0.24, -0.05, 0]} s={[0.1, 0.34, 0.4]} o /><M g={G.box} c={c} p={[0, -0.03, -0.2]} s={[0.46, 0.36, 0.1]} o /></>)}
      {st === 'long' && (<><M g={G.box} c={c} p={[0, -0.45, -0.2]} s={[0.5, 1.0, 0.12]} o /><M g={G.box} c={c} p={[-0.25, -0.2, 0]} s={[0.08, 0.7, 0.3]} /><M g={G.box} c={c} p={[0.25, -0.2, 0]} s={[0.08, 0.7, 0.3]} /></>)}
      {st === 'ponytail' && (<><M g={G.sphere} c={dark} p={[0, 0.12, -0.27]} s={[0.07, 0.07, 0.07]} /><M g={G.cone} c={c} p={[0, -0.12, -0.34]} r={[0.2, 0, 0]} s={[0.1, 0.55, 0.1]} o /></>)}
      {st === 'bun' && <M g={G.sphere} c={c} p={[0, 0.34, -0.05]} s={[0.12, 0.12, 0.12]} o />}
      {st === 'twin' && [-1, 1].map((sx) => (<group key={sx}><M g={G.sphere} c={dark} p={[sx * 0.26, 0.14, -0.05]} s={[0.05, 0.05, 0.05]} /><M g={G.cone} c={c} p={[sx * 0.3, -0.25, -0.06]} r={[0, 0, sx * 0.1]} s={[0.1, 0.7, 0.1]} o /></group>))}
      {st === 'swept' && <M g={G.cone} c={c} p={[0.1, 0.2, 0.2]} r={[Math.PI * 0.85, 0, 1.0]} s={[0.12, 0.34, 0.1]} o />}
    </group>
  );
}

function Face({ look }: { look: Look }) {
  const eye = look.eyes;
  return (
    <group>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.092, -0.01, 0.222]} rotation={[0, sx * 0.4, 0]}>
          <M g={G.circle} c="#ffffff" s={[0.068, 0.088, 1]} flat />
          <M g={G.circle} c={eye} p={[0, -0.005, 0.003]} s={[0.054, 0.078, 1]} flat />
          <M g={G.circle} c="#15121f" p={[0, -0.005, 0.005]} s={[0.03, 0.05, 1]} flat />
          <M g={G.circle} c="#ffffff" p={[0.018, 0.028, 0.007]} s={[0.014, 0.018, 1]} flat />
          <M g={G.box} c={look.hair} p={[0, 0.1, 0.002]} r={[0, 0, sx * -0.15]} s={[0.1, 0.014, 0.01]} flat />
        </group>
      ))}
      <M g={G.box} c="#a8504a" p={[0, -0.1, 0.232]} s={[0.05, 0.012, 0.01]} flat />
      <M g={G.sphere} c="#ff9a9a" p={[-0.14, -0.06, 0.19]} s={[0.04, 0.02, 0.01]} flat />
      <M g={G.sphere} c="#ff9a9a" p={[0.14, -0.06, 0.19]} s={[0.04, 0.02, 0.01]} flat />
    </group>
  );
}

function Accessory({ look }: { look: Look }) {
  const c = look.accColor;
  switch (look.acc) {
    case 'headband': return (<><M g={G.torus} c={c} p={[0, 0.12, 0]} r={[Math.PI / 2, 0, 0]} s={[0.27, 0.27, 0.6]} /><M g={G.box} c={c} p={[0.1, 0.1, -0.3]} r={[0.3, 0, 0.5]} s={[0.06, 0.3, 0.02]} /></>);
    case 'goggles': return (<><M g={G.torus} c="#444" p={[0, 0.2, 0]} r={[Math.PI / 2.2, 0, 0]} s={[0.27, 0.27, 0.5]} />{[-1, 1].map((x) => <M key={x} g={G.cyl} c={c} p={[x * 0.1, 0.24, 0.21]} r={[Math.PI / 2.4, 0, 0]} s={[0.07, 0.04, 0.07]} />)}</>);
    case 'glasses': return (<>{[-1, 1].map((x) => <M key={x} g={G.torus} c={c} p={[x * 0.095, -0.01, 0.25]} s={[0.085, 0.1, 0.5]} flat />)}<M g={G.box} c={c} p={[0, 0, 0.25]} s={[0.05, 0.012, 0.01]} flat /></>);
    case 'cap': return (<><M g={G.dome} c={c} p={[0, 0.07, 0]} s={[0.29, 0.26, 0.29]} o /><M g={G.box} c={c} p={[0, 0.1, 0.27]} r={[-0.15, 0, 0]} s={[0.3, 0.025, 0.2]} /></>);
    case 'mask': return <M g={G.box} c={c} p={[0, -0.09, 0.2]} s={[0.3, 0.12, 0.06]} />;
    default: return null;
  }
}

export function Character({ look, anim, scale = 1 }: { look: Look; anim: MutableRefObject<AnimState>; scale?: number }) {
  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const elbL = useRef<THREE.Group>(null);
  const elbR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * 6);
  const t = useRef(0);
  const b = look.build;
  const sc = look.height * 0.92 * scale;

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    t.current += dt;
    const a = anim.current;
    const k = 1 - Math.exp(-dt * 14);
    const tt = t.current;
    const moving = a.speed > 0.05;
    phase.current += dt * (a.mode === 3 ? 15 : a.mode === 2 ? 12 : a.mode === 1 ? 7.5 : 0) * (moving ? 1 : 0);
    const sw = Math.sin(phase.current);
    const amp = a.mode === 3 ? 1.1 : a.mode === 2 ? 0.95 : a.mode === 1 ? 0.55 : 0;
    const set = (r: THREE.Group | null, x: number, y = 0, z = 0) => {
      if (!r) return;
      r.rotation.x += (x - r.rotation.x) * k;
      r.rotation.y += (y - r.rotation.y) * k;
      r.rotation.z += (z - r.rotation.z) * k;
    };
    let lx = sw * amp, rx = -sw * amp, kl = Math.max(0, -sw) * amp * 1.1, kr = Math.max(0, sw) * amp * 1.1;
    let al = -sw * amp * 0.9, ar = sw * amp * 0.9, el = a.mode >= 2 ? -1.1 : -0.15, er = el;
    let lean = a.mode === 3 ? 0.32 : a.mode === 2 ? 0.18 : a.mode === 1 ? 0.05 : 0;
    let bob = moving ? Math.abs(Math.sin(phase.current)) * (a.mode >= 2 ? 0.07 : 0.035) : Math.sin(tt * 2) * 0.008;
    let armZ = 0.08;
    if (a.air) {
      lx = a.vy > 0 ? -0.9 : -0.4; rx = a.vy > 0 ? 0.3 : 0.2; kl = 1.2; kr = 0.7;
      al = -2.5; ar = -2.5; el = -0.3; er = -0.3; armZ = 0.3; lean = 0.05; bob = 0;
    } else if (a.land > 0) {
      lx = -0.6; rx = -0.6; kl = 1.2; kr = 1.2; bob = -0.18 * Math.min(1, a.land / 0.15); lean = 0.25; al = -0.4; ar = -0.4;
    } else if (!moving) {
      al = Math.sin(tt * 1.6) * 0.04; ar = -Math.sin(tt * 1.6) * 0.04; armZ = 0.1 + Math.sin(tt * 1.6) * 0.02;
    }
    if (a.wave > 0) { ar = -2.3 + Math.sin(tt * 12) * 0.25; er = -0.5; }
    if (a.talk) { ar = -0.9 + Math.sin(tt * 4) * 0.25; er = -1.2; al = 0.1; }
    set(legL.current, lx); set(legR.current, rx);
    set(kneeL.current, kl); set(kneeR.current, kr);
    set(armL.current, al, 0, armZ); set(armR.current, ar, 0, -armZ);
    set(elbL.current, el); set(elbR.current, er);
    if (hips.current) { hips.current.position.y += (0.92 + bob - hips.current.position.y) * k; }
    set(torso.current, lean, Math.sin(phase.current) * amp * 0.12);
    if (head.current) {
      head.current.rotation.x += ((a.talk ? Math.sin(tt * 5) * 0.06 : 0) - lean * 0.8 + (a.air ? -0.1 : 0) - head.current.rotation.x) * k;
    }
    if (root.current) { void root.current; }
  });

  const skin = look.skin;
  const topC = look.top, top2 = look.top2;
  return (
    <group ref={root} scale={sc}>
      <group ref={hips} position={[0, 0.92, 0]}>
        {/* legs */}
        {([-1, 1] as const).map((sx) => (
          <group key={sx} ref={sx < 0 ? legL : legR} position={[sx * 0.11 * b, 0, 0]}>
            <M g={G.cyl} c={look.pants} p={[0, -0.22, 0]} s={[0.085 * b, 0.46, 0.085 * b]} o />
            <group ref={sx < 0 ? kneeL : kneeR} position={[0, -0.44, 0]}>
              <M g={G.cyl} c={look.skirt ? skin : look.pants} p={[0, -0.22, 0]} s={[0.07 * b, 0.46, 0.07 * b]} o />
              <M g={G.box} c={look.shoes} p={[0, -0.47, 0.04]} s={[0.12, 0.08, 0.26]} o />
              <M g={G.box} c={top2} p={[0, -0.43, 0.04]} s={[0.125, 0.025, 0.27]} />
            </group>
          </group>
        ))}
        {/* torso */}
        <group ref={torso}>
          <M g={G.cyl} c={look.pants} p={[0, 0.03, 0]} s={[0.2 * b, 0.12, 0.14 * b]} />
          <M g={G.cyl} c={topC} p={[0, 0.3, 0]} s={[0.215 * b, 0.46, 0.14 * b]} o />
          <M g={G.cyl} c={top2} p={[0, 0.1, 0]} s={[0.22 * b, 0.05, 0.145 * b]} />
          <M g={G.box} c={top2} p={[0, 0.5, 0.02]} s={[0.1 * b, 0.05, 0.16 * b]} />
          {look.coat && <M g={G.cone} c={top2} p={[0, -0.12, 0]} r={[Math.PI, 0, 0]} s={[0.3 * b, 0.55, 0.2 * b]} o />}
          {look.skirt && <M g={G.cone} c={look.pants} p={[0, -0.12, 0]} r={[Math.PI, 0, 0]} s={[0.27 * b, 0.3, 0.2 * b]} o />}
          {look.acc === 'scarf' && (<><M g={G.torus} c={look.accColor} p={[0, 0.54, 0]} r={[Math.PI / 2, 0, 0]} s={[0.15, 0.15, 1.3]} /><M g={G.box} c={look.accColor} p={[0.1, 0.35, -0.16]} r={[0.2, 0, 0.1]} s={[0.1, 0.4, 0.03]} /></>)}
          {look.acc === 'cape' && <M g={G.box} c={look.accColor} p={[0, 0.05, -0.17]} r={[0.12, 0, 0]} s={[0.4 * b, 0.95, 0.03]} />}
          {/* arms */}
          {([-1, 1] as const).map((sx) => (
            <group key={sx} ref={sx < 0 ? armL : armR} position={[sx * 0.265 * b, 0.47, 0]}>
              <M g={G.sphere} c={topC} s={[0.07, 0.07, 0.07]} />
              <M g={G.cyl} c={topC} p={[0, -0.16, 0]} s={[0.055, 0.32, 0.055]} o />
              <group ref={sx < 0 ? elbL : elbR} position={[0, -0.31, 0]}>
                <M g={G.cyl} c={look.coat ? top2 : skin} p={[0, -0.14, 0]} s={[0.05, 0.28, 0.05]} o />
                <M g={G.sphere} c={skin} p={[0, -0.3, 0]} s={[0.055, 0.055, 0.055]} />
              </group>
            </group>
          ))}
          {/* head */}
          <group ref={head} position={[0, 0.78, 0]}>
            <M g={G.cyl} c={skin} p={[0, -0.22, 0]} s={[0.055, 0.1, 0.055]} />
            <M g={G.sphere} c={skin} s={[0.235, 0.25, 0.235]} o />
            <M g={G.sphere} c={skin} p={[-0.235, -0.02, 0]} s={[0.035, 0.05, 0.03]} />
            <M g={G.sphere} c={skin} p={[0.235, -0.02, 0]} s={[0.035, 0.05, 0.03]} />
            <Face look={look} />
            <Hair look={look} />
            <Accessory look={look} />
          </group>
        </group>
      </group>
      {/* blob shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.45, 14]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}
