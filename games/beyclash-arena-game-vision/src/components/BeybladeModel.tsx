import { useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { PART_MAP } from '../data/parts';
import type { BeyConfig } from '../game/types';

export interface BeyHandle {
  root: THREE.Group | null;
  spin: THREE.Group | null;
  layer: THREE.Group | null;
  disc: THREE.Group | null;
  driver: THREE.Group | null;
}
export const makeHandle = (): BeyHandle => ({ root: null, spin: null, layer: null, disc: null, driver: null });

// ----- geometry (shared) -----
const bladeShape = (len: number, wid: number, sweep: number) => {
  const s = new THREE.Shape();
  s.moveTo(0.3, -0.06);
  s.lineTo(0.3 + len, -wid * 0.1 + sweep * 0.3);
  s.quadraticCurveTo(0.35 + len + 0.05, wid + sweep, 0.35, wid * 0.6);
  s.closePath();
  return s;
};
const mkBlade = (len: number, wid: number, sweep: number, depth: number) =>
  new THREE.ExtrudeGeometry(bladeShape(len, wid, sweep), { depth, bevelEnabled: false }).rotateX(-Math.PI / 2);

const GEO = {
  bladeA: mkBlade(0.5, 0.3, 0.12, 0.2),
  bladeB: mkBlade(0.42, 0.22, 0.1, 0.16),
  axe: mkBlade(0.6, 0.45, 0.0, 0.24),
  claw: mkBlade(0.55, 0.2, 0.35, 0.18),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 20),
  cone6: new THREE.ConeGeometry(1, 1, 5),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  dome: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.14, 8, 28).rotateX(Math.PI / 2),
  octa: new THREE.OctahedronGeometry(1),
  box: new THREE.BoxGeometry(1, 1, 1),
};

const cache = new Map<string, THREE.Material>();
function metal(hex: string) {
  const k = 'm' + hex;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: hex, metalness: 0.9, roughness: 0.25 }));
  return cache.get(k)!;
}
function plastic(hex: string) {
  const k = 'p' + hex;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: hex, metalness: 0.15, roughness: 0.4 }));
  return cache.get(k)!;
}
function glowMat(hex: string) {
  const k = 'g' + hex;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.3 }));
  return cache.get(k)!;
}

type V3 = [number, number, number];
const Mesh = ({ g, m, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }: { g: THREE.BufferGeometry; m: THREE.Material; p?: V3; r?: V3; s?: V3 }) => (
  <mesh geometry={g} material={m} position={p} rotation={r} scale={s} castShadow />
);

function Driver({ shape, color }: { shape: string; color: string }) {
  const m = metal(color);
  switch (shape) {
    case 'flat': return (<><Mesh g={GEO.cyl} m={m} p={[0, 0.12, 0]} s={[0.3, 0.14, 0.3]} /><Mesh g={GEO.cone} m={metal('#555')} p={[0, 0.03, 0]} r={[Math.PI, 0, 0]} s={[0.1, 0.1, 0.1]} /></>);
    case 'ball': return <Mesh g={GEO.sphere} m={m} p={[0, 0.2, 0]} s={[0.22, 0.22, 0.22]} />;
    case 'grip': return (<><Mesh g={GEO.cyl} m={m} p={[0, 0.18, 0]} s={[0.24, 0.2, 0.24]} /><Mesh g={GEO.cyl} m={plastic('#222')} p={[0, 0.05, 0]} s={[0.17, 0.1, 0.17]} /></>);
    case 'needle': return <Mesh g={GEO.cone} m={m} p={[0, 0.22, 0]} r={[Math.PI, 0, 0]} s={[0.1, 0.46, 0.1]} />;
    default: return (<><Mesh g={GEO.cone} m={m} p={[0, 0.17, 0]} r={[Math.PI, 0, 0]} s={[0.22, 0.34, 0.22]} /><Mesh g={GEO.sphere} m={metal('#eee')} p={[0, 0.02, 0]} s={[0.04, 0.04, 0.04]} /></>);
  }
}

function Disc({ shape, color }: { shape: string; color: string }) {
  const m = metal(color);
  const r = shape === 'heavy' ? 0.62 : shape === 'light' ? 0.5 : shape === 'ring' ? 0.6 : 0.56;
  return (
    <>
      <Mesh g={shape === 'prism' ? GEO.cyl6 : GEO.cyl} m={m} p={[0, 0.39, 0]} s={[r, shape === 'heavy' ? 0.24 : 0.16, r]} />
      {shape === 'ring' && <Mesh g={GEO.torus} m={metal('#3a4a4a')} p={[0, 0.4, 0]} s={[r, 1.2, r]} />}
      {shape === 'spike' && Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return <Mesh key={i} g={GEO.cone6} m={m} p={[Math.cos(a) * r, 0.39, Math.sin(a) * r]} r={[0, 0, -Math.PI / 2 + 0]} s={[0.05, 0.14, 0.05]} />; })}
      {shape === 'heavy' && <Mesh g={GEO.torus} m={metal('#222')} p={[0, 0.5, 0]} s={[r * 0.9, 1, r * 0.9]} />}
    </>
  );
}

function Layer({ shape, color, main }: { shape: string; color: string; main: string }) {
  const body = plastic(main);
  const trim = metal(color);
  const radial = (n: number, g: THREE.BufferGeometry, m: THREE.Material, y: number, scale = 1) =>
    Array.from({ length: n }, (_, i) => <Mesh key={i} g={g} m={m} p={[0, y, 0]} r={[0, (i / n) * Math.PI * 2, 0]} s={[scale, scale, scale]} />);
  return (
    <>
      <Mesh g={GEO.cyl} m={body} p={[0, 0.54, 0]} s={[0.66, 0.12, 0.66]} />
      <Mesh g={GEO.torus} m={trim} p={[0, 0.6, 0]} s={[0.66, 1.1, 0.66]} />
      {shape === 'blade3' && radial(3, GEO.bladeA, trim, 0.56, 1.1)}
      {shape === 'blade5' && radial(5, GEO.bladeB, trim, 0.56, 1.05)}
      {shape === 'twin' && radial(2, GEO.axe, trim, 0.56, 1.15)}
      {shape === 'claw' && radial(4, GEO.claw, trim, 0.56, 1.1)}
      {shape === 'round' && (<><Mesh g={GEO.dome} m={trim} p={[0, 0.6, 0]} s={[0.56, 0.3, 0.56]} />{radial(8, GEO.bladeB, body, 0.54, 0.6)}</>)}
      {shape === 'dome' && (<><Mesh g={GEO.dome} m={trim} p={[0, 0.6, 0]} s={[0.6, 0.38, 0.6]} />{radial(6, GEO.bladeB, body, 0.56, 0.55)}</>)}
      {shape === 'ring' && (<><Mesh g={GEO.torus} m={trim} p={[0, 0.66, 0]} s={[0.55, 2, 0.55]} />{radial(6, GEO.bladeB, body, 0.56, 0.7)}</>)}
      {shape === 'halo' && (<>{radial(6, GEO.bladeB, trim, 0.56, 0.85)}<Mesh g={GEO.torus} m={trim} p={[0, 0.74, 0]} s={[0.5, 1.4, 0.5]} /></>)}
      {shape === 'crown' && (<>{radial(8, GEO.cone6, trim, 0.66, 0)}{Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <Mesh key={i} g={GEO.cone6} m={trim} p={[Math.cos(a) * 0.5, 0.74, Math.sin(a) * 0.5]} s={[0.08, 0.3, 0.08]} />; })}<Mesh g={GEO.dome} m={body} p={[0, 0.6, 0]} s={[0.5, 0.2, 0.5]} /></>)}
      {shape === 'sovereign' && (<>{radial(6, GEO.bladeA, trim, 0.56, 1.1)}{Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return <Mesh key={i} g={GEO.cone6} m={trim} p={[Math.cos(a) * 0.4, 0.74, Math.sin(a) * 0.4]} s={[0.06, 0.22, 0.06]} />; })}</>)}
    </>
  );
}

function Accessory({ shape, color }: { shape: string; color: string }) {
  if (shape === 'none') return null;
  const m = metal(color);
  switch (shape) {
    case 'bolt': return (<><Mesh g={GEO.cyl6} m={m} p={[0, 0.7, 0]} s={[0.17, 0.16, 0.17]} /><Mesh g={GEO.cyl6} m={metal('#222')} p={[0, 0.79, 0]} s={[0.08, 0.04, 0.08]} /></>);
    case 'chip': return <Mesh g={GEO.octa} m={glowMat(color)} p={[0, 0.82, 0]} s={[0.14, 0.2, 0.14]} />;
    case 'ring': return <Mesh g={GEO.torus} m={m} p={[0, 0.78, 0]} s={[0.3, 1.6, 0.3]} />;
    default: return (<>{Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return <Mesh key={i} g={GEO.cone6} m={glowMat(color)} p={[Math.cos(a) * 0.2, 0.84, Math.sin(a) * 0.2]} s={[0.05, 0.22, 0.05]} />; })}</>);
  }
}

export function BeybladeModel({ config, handle, scale = 1 }: { config: BeyConfig; handle?: MutableRefObject<BeyHandle>; scale?: number }) {
  const layer = PART_MAP[config.layer], disc = PART_MAP[config.disc], driver = PART_MAP[config.driver], acc = PART_MAP[config.accessory];
  const own = useMemo(() => makeHandle(), []);
  const h = handle?.current ?? own;
  if (!layer || !disc || !driver) return null;
  return (
    <group scale={scale} ref={(g) => { h.root = g; }}>
      <group ref={(g) => { h.spin = g; }}>
        <group ref={(g) => { h.driver = g; }}><Driver shape={driver.shape} color={driver.color} /></group>
        <group ref={(g) => { h.disc = g; }}><Disc shape={disc.shape} color={disc.color} /></group>
        <group ref={(g) => { h.layer = g; }}>
          <Layer shape={layer.shape} color={layer.color} main={config.color} />
          {acc && <Accessory shape={acc.shape} color={acc.color} />}
        </group>
      </group>
    </group>
  );
}
