import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { film } from '../film/runtime';
import { atm } from './atmosphere';

export const grad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
export const toon = (c: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...o });
export function rng(seed: number) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function Terrain({ bounds, base, far, hill = 1, seed = 1, rocky = false }: { bounds: number; base: string; far: string; hill?: number; seed?: number; rocky?: boolean }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(240, 240, 100, 100); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position; const col = new Float32Array(p.count * 3); const a = new THREE.Color(base), b = new THREE.Color(far), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      const n = Math.sin(x * 0.13 + seed) * Math.cos(z * 0.11 + seed) + Math.sin(x * 0.31 + z * 0.17) * 0.5;
      const k = Math.max(0, Math.min(1, (r - bounds) / 30)); const s = k * k * (3 - 2 * k);
      p.setY(i, s * hill * (4 + n * 3) + (rocky ? n * 0.08 * (1 - s) : 0));
      c.copy(a).lerp(b, Math.min(1, s * 1.2 + (n + 1.5) * 0.06)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  }, [bounds, base, far, hill, seed, rocky]);
  const mat = useMemo(() => toon('#ffffff', { vertexColors: true }), []);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

export interface Inst { p: [number, number, number]; s: [number, number, number]; ry?: number }
export function Scatter({ geo, mat, items, shadow }: { geo: THREE.BufferGeometry; mat: THREE.Material; items: Inst[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    items.forEach((it, i) => { e.set(0, it.ry ?? 0, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s)); ref.current.setMatrixAt(i, m); });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={shadow} receiveShadow frustumCulled={false} />;
}

const coneG = new THREE.ConeGeometry(1, 1, 7), cylG = new THREE.CylinderGeometry(1, 1, 1, 7), icoG = new THREE.IcosahedronGeometry(1, 0), octG = new THREE.OctahedronGeometry(1, 0);
export const geos = { cone: coneG, cyl: cylG, ico: icoG, oct: octG };

export function Forest({ count, inner, outer, seed, leaf = '#2f5f3a', trunk = '#4a3322', dead = false, avoid = [] }: { count: number; inner: number; outer: number; seed: number; leaf?: string; trunk?: string; dead?: boolean; avoid?: [number, number, number][] }) {
  const items = useMemo(() => {
    const r = rng(seed); const out: { x: number; z: number; s: number }[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 20) {
      const a = r() * Math.PI * 2, d = inner + r() * (outer - inner); const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (avoid.some(([ax, az, ar]) => Math.hypot(ax - x, az - z) < ar)) continue;
      out.push({ x, z, s: 0.8 + r() * 1.1 });
    }
    return out;
  }, [count, inner, outer, seed, avoid]);
  const tr = useMemo(() => items.map((t) => ({ p: [t.x, 0.9 * t.s, t.z] as [number, number, number], s: [0.18 * t.s, 1.8 * t.s, 0.18 * t.s] as [number, number, number] })), [items]);
  const c1 = useMemo(() => items.map((t) => ({ p: [t.x, 2.4 * t.s, t.z] as [number, number, number], s: [1.5 * t.s, 2.6 * t.s, 1.5 * t.s] as [number, number, number] })), [items]);
  const c2 = useMemo(() => items.map((t) => ({ p: [t.x, 3.6 * t.s, t.z] as [number, number, number], s: [1.1 * t.s, 2.2 * t.s, 1.1 * t.s] as [number, number, number] })), [items]);
  const lm = useMemo(() => toon(leaf), [leaf]), tm = useMemo(() => toon(trunk), [trunk]);
  return (<>
    <Scatter geo={cylG} mat={tm} items={tr} shadow />
    {!dead && <Scatter geo={coneG} mat={lm} items={c1} shadow />}
    {!dead && <Scatter geo={coneG} mat={lm} items={c2} shadow />}
  </>);
}

export function Rocks({ count, inner, outer, seed, color = '#6b6670', size = 1 }: { count: number; inner: number; outer: number; seed: number; color?: string; size?: number }) {
  const items = useMemo(() => {
    const r = rng(seed); return Array.from({ length: count }, () => {
      const a = r() * Math.PI * 2, d = inner + r() * (outer - inner), s = (0.4 + r() * 1.6) * size;
      return { p: [Math.sin(a) * d, s * 0.3, Math.cos(a) * d] as [number, number, number], s: [s, s * 0.7, s] as [number, number, number], ry: r() * 6 };
    });
  }, [count, inner, outer, seed, size]);
  const m = useMemo(() => toon(color), [color]);
  return <Scatter geo={icoG} mat={m} items={items} shadow />;
}

export function Fire({ pos, size = 1, light = 1, color = '#ff9a3c' }: { pos: [number, number, number]; size?: number; light?: number; color?: string }) {
  const g = useRef<THREE.Group>(null!); const l = useRef<THREE.PointLight>(null!);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false }), [color]);
  const mat2 = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.95, toneMapped: false }), []);
  useFrame(() => {
    const t = film.clock * 9 + pos[0] * 3;
    g.current.children.forEach((c, i) => { c.scale.set(1, 0.85 + Math.sin(t * (1 + i * 0.3) + i) * 0.22, 1); });
    if (l.current) l.current.intensity = light * (0.8 + Math.sin(t) * 0.15 + Math.sin(t * 2.3) * 0.1) * (0.8 + atm.night * 1.2);
  });
  return (
    <group position={pos} scale={size}>
      <group ref={g}>
        <mesh position={[0, 0.35, 0]} material={mat}><coneGeometry args={[0.28, 0.8, 7]} /></mesh>
        <mesh position={[0.1, 0.28, 0.05]} material={mat}><coneGeometry args={[0.18, 0.55, 6]} /></mesh>
        <mesh position={[0, 0.22, 0]} material={mat2}><coneGeometry args={[0.15, 0.45, 6]} /></mesh>
      </group>
      {light > 0 && <pointLight ref={l} position={[0, 0.8, 0]} color={color} distance={13} decay={1.6} />}
    </group>
  );
}

export function Breakable({ id, x, z, children, rubbleColor = '#7a7580', sign = 1 }: { id: string; x: number; z: number; children: ReactNode; rubbleColor?: string; sign?: number }) {
  const g = useRef<THREE.Group>(null!); const rub = useRef<THREE.Group>(null!);
  const rm = useMemo(() => toon(rubbleColor), [rubbleColor]);
  useFrame(() => {
    const t0 = film.destroyed.get(id);
    const p = t0 === undefined ? 0 : Math.min(1, (film.clock - t0) / 1.1);
    g.current.rotation.z = p * 0.55 * sign; g.current.rotation.x = p * 0.15; g.current.position.y = -p * 0.25; g.current.scale.y = 1 - p * 0.6;
    rub.current.visible = p > 0.4;
  });
  return (
    <group position={[x, 0, z]}>
      <group ref={g}>{children}</group>
      <group ref={rub} visible={false}>
        {[[0.9, 0.2, 0.4], [-0.8, 0.15, 0.7], [0.3, 0.12, -0.9], [-0.5, 0.1, -0.5]].map((p, i) => (
          <mesh key={i} position={[p[0], p[1], p[2]]} rotation={[i, i * 2, 0]} scale={0.35 + i * 0.08} material={rm}><dodecahedronGeometry args={[0.5]} /></mesh>
        ))}
      </group>
    </group>
  );
}

const roofShape = (() => { const s = new THREE.Shape(); s.moveTo(-2.9, 0); s.lineTo(2.9, 0); s.lineTo(0, 1.8); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 5.6, bevelEnabled: false }); })();

export function House({ x, z, ry = 0, wall = '#d8c4a0', roof = '#9a4a3a' }: { x: number; z: number; ry?: number; wall?: string; roof?: string }) {
  const wm = useMemo(() => toon(wall), [wall]); const rm = useMemo(() => toon(roof), [roof]);
  const winM = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffcf80', toneMapped: false }), []);
  const roofG = useRef<THREE.Mesh>(null!); const fire = useRef<THREE.Group>(null!);
  useFrame(() => {
    const burned = film.world.facts.has('village_burned');
    wm.color.set(burned ? '#2a2420' : wall); rm.color.set(burned ? '#1a1412' : roof);
    roofG.current.rotation.z = burned ? 0.08 : 0; roofG.current.scale.y = burned ? 0.6 : 1;
    fire.current.visible = burned; winM.color.set(burned ? '#ff6a1a' : atm.night > 0.4 ? '#ffcf80' : '#7a8aa0');
  });
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 1.2, 0]} material={wm} castShadow receiveShadow><boxGeometry args={[5.2, 2.4, 4.2]} /></mesh>
      <mesh ref={roofG} position={[-2.8, 2.4, 2.8]} rotation={[0, Math.PI / 2, 0]} material={rm} castShadow><primitive object={roofShape} attach="geometry" /></mesh>
      <mesh position={[1.2, 1.1, 2.12]} material={winM}><planeGeometry args={[0.8, 0.9]} /></mesh>
      <mesh position={[-1.4, 1.1, 2.12]} material={winM}><planeGeometry args={[0.8, 0.9]} /></mesh>
      <mesh position={[0, 0.9, 2.12]} material={toon('#4a3322')}><planeGeometry args={[0.9, 1.8]} /></mesh>
      <mesh position={[1.9, 3.1, -0.8]} material={toon('#6a6a72')}><boxGeometry args={[0.6, 1.4, 0.6]} /></mesh>
      <group ref={fire} visible={false}><Fire pos={[0.5, 1.8, 0]} size={2.4} light={0} /><Fire pos={[-1.2, 1.2, 1.5]} size={1.4} light={0} /></group>
    </group>
  );
}

export function Crystal({ p, h = 1.5, color = '#6fa8ff', rot = 0 }: { p: [number, number, number]; h?: number; color?: string; rot?: number }) {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9, flatShading: true }), [color]);
  return (<group position={p} rotation={[0.1 * rot, rot, 0.2 * Math.sin(rot * 3)]}>
    <mesh position={[0, h / 2, 0]} scale={[h * 0.18, h * 0.5, h * 0.18]} material={m}><octahedronGeometry args={[1]} /></mesh>
    <mesh position={[0.25 * h, h * 0.25, 0.1 * h]} rotation={[0, 0, -0.5]} scale={[h * 0.1, h * 0.28, h * 0.1]} material={m}><octahedronGeometry args={[1]} /></mesh>
    <mesh position={[-0.2 * h, h * 0.2, -0.1 * h]} rotation={[0, 0, 0.55]} scale={[h * 0.09, h * 0.24, h * 0.09]} material={m}><octahedronGeometry args={[1]} /></mesh>
  </group>);
}
