import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rt } from '../runtime';
import { P, MAX_P, rings, MAX_RINGS, hexRgb, burst, trail } from '../systems/fx';
import { GEO, toonMat } from './materials';

const additive = (o = 1) => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });

export function Particles() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const mat = useMemo(() => additive(0.95), []);
  useLayoutEffect(() => {
    const m = ref.current!; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_P * 3), 3); m.count = 0; m.frustumCulled = false;
  }, []);
  useFrame(() => {
    const m = ref.current; if (!m || !m.instanceColor) return;
    const n = P.count; const arr = m.instanceMatrix.array as Float32Array; const col = m.instanceColor.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const f = Math.max(0, P.life[i] / P.maxLife[i]); const s = P.size[i] * (0.35 + 0.65 * Math.sqrt(f)); const o = i * 16;
      arr[o] = s; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0; arr[o + 4] = 0; arr[o + 5] = s; arr[o + 6] = 0; arr[o + 7] = 0; arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = s; arr[o + 11] = 0;
      arr[o + 12] = P.x[i]; arr[o + 13] = P.y[i]; arr[o + 14] = P.z[i]; arr[o + 15] = 1;
      col[i * 3] = P.r[i] * f; col[i * 3 + 1] = P.g[i] * f; col[i * 3 + 2] = P.b[i] * f;
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  });
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <instancedMesh ref={ref} args={[geo, mat, MAX_P]} frustumCulled={false} />;
}

export function Rings() {
  const refs = useRef<THREE.Mesh[]>([]);
  const mats = useMemo(() => Array.from({ length: MAX_RINGS }, () => additive(1)), []);
  const geo = useMemo(() => { const g = new THREE.RingGeometry(0.82, 1, 40); g.rotateX(-Math.PI / 2); return g; }, []);
  useFrame(() => {
    for (let i = 0; i < MAX_RINGS; i++) {
      const r = rings[i]; const m = refs.current[i]; if (!m) continue;
      if (!r.active) { m.visible = false; continue; }
      const f = r.t / r.life; const e = 1 - (1 - f) * (1 - f); const s = r.r0 + (r.r1 - r.r0) * e; const a = 1 - f;
      m.visible = true; m.position.set(r.x, r.y, r.z); m.scale.set(s, 1, s); mats[i].color.setRGB(r.r * a, r.g * a, r.b * a);
      m.rotation.set(r.vertical ? Math.PI / 2 : 0, r.yaw, 0);
    }
  });
  return <>{mats.map((mt, i) => <mesh key={i} ref={(o) => { if (o) refs.current[i] = o; }} geometry={geo} material={mt} visible={false} frustumCulled={false} />)}</>;
}

const POOL = 28;
export function Projectiles() {
  const groups = useRef<THREE.Group[]>([]); const cores = useRef<THREE.Mesh[]>([]); const glows = useRef<THREE.Mesh[]>([]); const blades = useRef<THREE.Group[]>([]);
  const coreMats = useMemo(() => Array.from({ length: POOL }, () => new THREE.MeshBasicMaterial({ color: '#fff' })), []);
  const glowMats = useMemo(() => Array.from({ length: POOL }, () => additive(0.4)), []);
  const kunaiMat = useMemo(() => toonMat('#c8d4e0'), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((st) => {
    const list = rt.projectiles; const t = st.clock.elapsedTime;
    for (let i = 0; i < POOL; i++) {
      const g = groups.current[i]; if (!g) continue; const p = list[i];
      if (!p) { g.visible = false; continue; }
      g.visible = true; g.position.set(p.x, p.y, p.z); g.rotation.y = Math.atan2(p.vx, p.vz);
      const rgb = hexRgb(p.color); const big = p.big || p.size >= 1.2;
      const isK = p.kind === 'kunai'; const isB = p.kind === 'blade';
      coreMats[i].color.setRGB(Math.min(1, rgb[0] + 0.5), Math.min(1, rgb[1] + 0.5), Math.min(1, rgb[2] + 0.5)); glowMats[i].color.setRGB(rgb[0], rgb[1], rgb[2]);
      cores.current[i].scale.set(isK ? 0.05 : isB ? p.size * 1.5 : p.size * 0.5, isK ? 0.05 : isB ? 0.07 : p.size * 0.5, isK ? 0.4 : isB ? 0.25 : p.size * 0.5);
      glows.current[i].visible = !isK; glows.current[i].scale.setScalar(p.size * (isB ? 0.9 : 1.0) * (1 + Math.sin(t * 20 + i) * 0.08));
      blades.current[i].visible = p.kind === 'shuriken'; if (p.kind === 'shuriken') { blades.current[i].rotation.y = p.spin; blades.current[i].scale.setScalar(p.size * 1.8); }
      if (p.kind === 'bomb') coreMats[i].color.set('#2a0a2a');
      if (isK) { g.rotation.x = 0; }
      if (!rt.paused && Math.random() < 0.9) trail(p.x - p.vx * 0.02, p.y, p.z - p.vz * 0.02, p.color, Math.max(0.15, p.size * 0.35), big ? 0.5 : 0.28);
      if (p.hostile && p.kind === 'orb') tmp.set('#ff3030');
    }
  });
  return (<>
    {Array.from({ length: POOL }, (_, i) => (
      <group key={i} ref={(o) => { if (o) groups.current[i] = o; }} visible={false}>
        <mesh ref={(o) => { if (o) cores.current[i] = o; }} geometry={GEO.sphere} material={i < 0 ? kunaiMat : coreMats[i]} />
        <mesh ref={(o) => { if (o) glows.current[i] = o; }} geometry={GEO.sphere} material={glowMats[i]} />
        <group ref={(o) => { if (o) blades.current[i] = o; }} visible={false}>{[0, 1, 2, 3].map((k) => <mesh key={k} geometry={GEO.box} material={glowMats[i]} scale={[1.6, 0.05, 0.22]} rotation={[0, (k * Math.PI) / 4, 0]} />)}</group>
      </group>
    ))}
  </>);
}

function sectorGeo(angle: number) {
  const n = 24; const pos: number[] = []; const idx: number[] = [];
  pos.push(0, 0, 0);
  for (let i = 0; i <= n; i++) { const a = -angle / 2 + (i / n) * angle; pos.push(Math.sin(a), 0, Math.cos(a)); }
  for (let i = 1; i <= n; i++) idx.push(0, i + 1, i);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
export function Telegraphs() {
  const N = 10; const refs = useRef<{ g: THREE.Group; base: THREE.Mesh; fill: THREE.Mesh }[]>([]);
  const geos = useMemo(() => {
    const circle = new THREE.CircleGeometry(1, 40); circle.rotateX(-Math.PI / 2);
    const line = new THREE.PlaneGeometry(1, 1); line.rotateX(-Math.PI / 2); line.translate(0, 0, 0.5);
    return { circle, cone: sectorGeo(2.2), line };
  }, []);
  const mk = (o: number) => new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
  const baseMats = useMemo(() => Array.from({ length: N }, () => mk(0.16)), []); const fillMats = useMemo(() => Array.from({ length: N }, () => mk(0.36)), []);
  useFrame(() => {
    for (let i = 0; i < N; i++) {
      const r = refs.current[i]; if (!r) continue; const t = rt.telegraphs[i];
      if (!t) { r.g.visible = false; continue; }
      r.g.visible = true; r.g.position.set(t.x, 0.12 + i * 0.002, t.z); r.g.rotation.y = t.yaw;
      const geo = geos[t.shape]; r.base.geometry = geo; r.fill.geometry = geo;
      const f = Math.min(1, t.t / t.dur);
      if (t.shape === 'line') { r.base.scale.set(t.angle, 1, t.r); r.fill.scale.set(t.angle, 1, t.r * f); }
      else { r.base.scale.set(t.r, 1, t.r); r.fill.scale.set(t.r * f, 1, t.r * f); }
      baseMats[i].color.set(t.color); fillMats[i].color.set(t.color); fillMats[i].opacity = 0.28 + f * 0.3 + (f > 0.8 ? Math.sin(t.t * 40) * 0.1 : 0);
    }
  });
  return (<>{Array.from({ length: N }, (_, i) => (
    <group key={i} visible={false} ref={(o) => { if (o) { const b = o.children[0] as THREE.Mesh; const f = o.children[1] as THREE.Mesh; refs.current[i] = { g: o as THREE.Group, base: b, fill: f }; } }}>
      <mesh geometry={geos.circle} material={baseMats[i]} /><mesh geometry={geos.circle} material={fillMats[i]} position={[0, 0.01, 0]} />
    </group>))}</>);
}

/** Giant toad visual for Summoning Jutsu. */
export function SummonView() {
  const g = useRef<THREE.Group>(null); const body = useMemo(() => toonMat('#4ca04c'), []); const belly = useMemo(() => toonMat('#d8e8a0'), []); const dark = useMemo(() => toonMat('#2a3a2a'), []);
  useFrame(() => {
    const s = rt.summon; if (!g.current) return; g.current.visible = !!s; if (!s) return;
    const drop = Math.min(1, s.t / 0.7); const y = (1 - drop * drop) * 28; const out = s.t > s.dur - 0.5 ? (s.t - (s.dur - 0.5)) / 0.5 : 0;
    g.current.position.set(s.x, y - out * 8, s.z); g.current.rotation.y = rt.player.yaw + Math.PI; g.current.scale.setScalar(1.15 - out * 0.3);
    body.color.set(s.color);
  });
  return (
    <group ref={g} visible={false}>
      <mesh geometry={GEO.sphere} material={body} scale={[3.8, 2.8, 4.6]} position={[0, 3, 0]} castShadow /><mesh geometry={GEO.sphere} material={belly} scale={[3, 1.6, 3.6]} position={[0, 2.2, 0.6]} />
      <mesh geometry={GEO.sphere} material={body} scale={[2.6, 1.8, 2.4]} position={[0, 4.8, 3.8]} />
      {[-1, 1].map((sd) => (<group key={sd}><mesh geometry={GEO.sphere} material={belly} scale={[0.85, 0.85, 0.85]} position={[sd * 1.6, 6.3, 4.2]} /><mesh geometry={GEO.sphere} material={dark} scale={[0.4, 0.5, 0.4]} position={[sd * 1.6, 6.3, 4.9]} />
        <mesh geometry={GEO.cyl} material={body} scale={[0.7, 2.6, 0.7]} position={[sd * 3.1, 1.3, 2.5]} /><mesh geometry={GEO.box} material={body} scale={[1.6, 0.4, 1.6]} position={[sd * 3.1, 0.2, 3.1]} />
        <mesh geometry={GEO.sphere} material={body} scale={[1.4, 1.4, 2.6]} position={[sd * 3, 1.4, -2.5]} /></group>))}
      <mesh geometry={GEO.box} material={dark} scale={[3.8, 0.25, 0.3]} position={[0, 4.3, 5.9]} />
      <mesh geometry={GEO.box} material={toonMat('#b02a2a')} scale={[3.6, 1.4, 1.2]} position={[0, 4.7, 0.5]} rotation={[0.2, 0, 0]} />
    </group>
  );
}

export function Logs() {
  const refs = useRef<THREE.Mesh[]>([]);
  useFrame(() => { for (let i = 0; i < 4; i++) { const m = refs.current[i]; if (!m) continue; const l = rt.logs[rt.logs.length - 1 - i]; if (!l || l.t > 0.6) { m.visible = false; continue; } m.visible = true; m.position.set(l.x, l.y + 0.35, l.z); m.scale.setScalar(1 - l.t / 0.8); } });
  return <>{[0, 1, 2, 3].map((i) => <mesh key={i} ref={(o) => { if (o) refs.current[i] = o; }} geometry={GEO.cyl} scale={[0.4, 1.4, 0.4]} rotation={[0, 0, Math.PI / 2]} material={toonMat('#8a6a3a')} visible={false} />)}</>;
}

/** Environment particles (petals, fireflies, sand, spray...). */
export function AmbientFx() {
  const acc = useRef(0);
  useFrame((_, dtRaw) => {
    if (rt.paused) return; const dt = Math.min(dtRaw, 0.05); acc.current += dt; if (acc.current < 0.12) return; acc.current = 0;
    const p = rt.player.pos; const z = rt.zone.id; const a = Math.random() * 6.28, r = 6 + Math.random() * 22; const x = p.x + Math.cos(a) * r, zz = p.z + Math.sin(a) * r;
    const night = Math.sin((rt.timeOfDay - 0.25) * Math.PI * 2) < 0.05;
    if (z === 'konoha' || z === 'wilds') burst(x, 6 + Math.random() * 5, zz, { n: 1, color: '#ffb7d0', speed: 0.8, life: 5, size: 0.11, grav: 0.35, spread: 0.1, drag: 0.1 });
    else if (z === 'forest') burst(x, 1 + Math.random() * 4, zz, { n: 1, color: night ? '#d8ff6a' : '#9aff9a', speed: 0.5, life: 4, size: 0.09, grav: -0.05, spread: 0.6, drag: 0.4 });
    else if (z === 'sand') burst(p.x + Math.cos(a) * r, 0.5 + Math.random() * 2, zz, { n: 2, color: '#e8cf94', speed: 5, life: 1.5, size: 0.14, grav: 0, spread: 0.1, drag: 0.2 });
    else if (z === 'waves') burst(x, 0.3 + Math.random() * 2, zz, { n: 1, color: '#dfeaf2', speed: 0.6, life: 4, size: 0.5, grav: 0, spread: 0.1, drag: 0.4 });
    else if (z === 'myoboku') burst(x, 1 + Math.random() * 5, zz, { n: 1, color: '#b8ffb8', speed: 0.5, life: 5, size: 0.1, grav: -0.1, spread: 0.7, drag: 0.3 });
    else if (z === 'valley') burst(x, 0.3 + Math.random() * 1.5, zz, { n: 1, color: '#dff4ff', speed: 0.8, life: 3, size: 0.18, grav: -0.1, spread: 0.5, drag: 0.4 });
    // Kurama / Sage embers
    if (rt.player.form !== 'base') burst(p.x + (Math.random() - 0.5) * 1.5, p.y + 0.2, p.z + (Math.random() - 0.5) * 1.5, { n: 1, color: rt.player.form === 'sage' ? '#ff9a3a' : '#ffc02e', speed: 1.2, up: 2, life: 0.9, size: 0.14, spread: 0.3 });
  });
  return null;
}
