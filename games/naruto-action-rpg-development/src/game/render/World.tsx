import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rt } from '../runtime';
import { ZONES, WILDS } from '../config';
import { useGame } from '../store';
import { GRAPHICS } from '../config';
import {
  HOUSES, TOWER, ACADEMY, CRATES, BOARD_POS, RAMEN_POS, SHOP_POS, TRAINING, TRAINING_POSTS, FOREST_TREES, SAKURA_TREES, SAND_BUILDINGS, KAZEKAGE,
  PILLARS, SAGE_ROCKS, VALLEY_STATUES, MYOBOKU_MUSHROOMS, WATER_RECTS, BRIDGE, rng,
} from '../data/world';
import { GEO, Inst, makeWaterMaterial, toonMat, type Item } from './materials';

function Gate({ c, r, children }: { c: [number, number]; r: number; children: ReactNode }) {
  const [on, setOn] = useState(() => Math.hypot(rt.player.pos.x - c[0], rt.player.pos.z - c[1]) < r);
  const n = useRef(0);
  useFrame(() => {
    if (++n.current % 20) return;
    const d = Math.hypot(rt.player.pos.x - c[0], rt.player.pos.z - c[1]);
    if (!on && d < r) setOn(true); else if (on && d > r + 70) setOn(false);
  });
  return on ? <>{children}</> : null;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function Ground() {
  const geo = useMemo(() => {
    const size = 740, seg = 148; const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position; const cols = new Float32Array(pos.count * 3); const base = new THREE.Color(WILDS.ground); const c = new THREE.Color(); const zc = new THREE.Color(); const water = new THREE.Color('#2a5f78');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); c.copy(base);
      for (const zn of ZONES) { const d = Math.hypot(x - zn.center[0], z - zn.center[1]); const w = 1 - smooth(zn.radius - 10, zn.radius + 35, d); if (w > 0) c.lerp(zc.set(zn.ground), w); }
      for (const r of WATER_RECTS) if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) c.lerp(water, 0.9);
      const n = (Math.sin(x * 0.31) * Math.cos(z * 0.27) + Math.sin(x * 0.083 + z * 0.11)) * 0.035; c.r += n; c.g += n; c.b += n * 0.6;
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); return g;
  }, []);
  return <mesh geometry={geo} receiveShadow position={[0, -0.02, 0]}><meshToonMaterial vertexColors gradientMap={toonMat('#fff').gradientMap} /></mesh>;
}

// -------------------------------------------------------------------------------- Konoha
function Konoha() {
  const items = useMemo(() => {
    const walls: Item[] = [], roofs: Item[] = [], ridges: Item[] = [], doors: Item[] = [], paths: Item[] = [], stone: Item[] = [], trunks: Item[] = [], blossoms: Item[] = [], posts: Item[] = [];
    for (const h of HOUSES) {
      walls.push({ p: [h.x, h.h / 2, h.z], s: [h.w, h.h, h.d], c: h.wall });
      roofs.push({ p: [h.x, h.h + 0.22, h.z], s: [h.w + 1.4, 0.45, h.d + 1.4], c: h.roof });
      ridges.push({ p: [h.x, h.h + 0.7, h.z], s: [h.w * 0.55, 0.5, h.d * 0.55], c: h.roof });
      doors.push({ p: [h.x, 1, h.z + h.d / 2 + 0.02], s: [1.3, 2, 0.08], c: '#6a4a30' });
      doors.push({ p: [h.x + h.w * 0.28, 1.6, h.z + h.d / 2 + 0.02], s: [1.1, 0.9, 0.08], c: '#8ac4d8' });
    }
    // streets
    paths.push({ p: [0, 0.01, 0], s: [9, 0.04, 154], c: '#d9c9a2' }, { p: [0, 0.01, 0], s: [154, 0.04, 9], c: '#d9c9a2' });
    paths.push({ p: [0, 0.01, 100], s: [7, 0.04, 50], c: '#cdbd96' }, { p: [-130, 0.01, 0], s: [106, 0.04, 7], c: '#cdbd96' }, { p: [130, 0.01, 0], s: [106, 0.04, 7], c: '#cdbd96' }, { p: [0, 0.01, 150], s: [7, 0.04, 50], c: '#cdbd96' });
    paths.push({ p: [-30, 0.01, -22], s: [34, 0.04, 8], c: '#d9c9a2' }, { p: [0, 0.015, -34], s: [12, 0.04, 18], c: '#e0d2ae' });
    // wall
    const R = 77, T = 3, H = 7;
    const seg = (x: number, z: number, w: number, d: number) => { stone.push({ p: [x, H / 2, z], s: [w, H, d], c: '#b9a98a' }, { p: [x, H + 0.3, z], s: [w + 0.6, 0.6, d + 0.6], c: '#8a7a5e' }); };
    seg(0, -R, R * 2, T); seg(-R, -R / 2 - 4, T, R - 8); seg(-R, R / 2 + 4, T, R - 8); seg(R, -R / 2 - 4, T, R - 8); seg(R, R / 2 + 4, T, R - 8); seg(-R / 2 - 4, R, R - 8, T); seg(R / 2 + 4, R, R - 8, T);
    for (const [x, z] of [[-8, R], [8, R], [-R, -8], [-R, 8], [R, -8], [R, 8]]) posts.push({ p: [x, 4.5, z], s: [1.4, 9, 1.4], c: '#b53a2a' });
    for (const [x, z, w, d] of [[0, R, 17, 1.4], [-R, 0, 1.4, 17], [R, 0, 1.4, 17]]) posts.push({ p: [x, 9, z], s: [w, 1.2, d], c: '#b53a2a' }, { p: [x, 10, z], s: [w + 3, 0.5, d + 1.5], c: '#2f6f5a' });
    // trees
    for (const [x, z] of SAKURA_TREES) { trunks.push({ p: [x, 1.6, z], s: [0.45, 3.2, 0.45], c: '#6a4a3a' }); for (let i = 0; i < 3; i++) blossoms.push({ p: [x + Math.sin(i * 2.1) * 1.2, 4.2 + i * 0.3, z + Math.cos(i * 2.1) * 1.2], s: [2.4 - i * 0.2, 1.9, 2.4 - i * 0.2], c: i % 2 ? '#ffb3cf' : '#ff9fc0' }); }
    return { walls, roofs, ridges, doors, paths, stone, trunks, blossoms, posts };
  }, []);
  const lanterns = useMemo(() => { const a: [number, number][] = []; for (let z = -60; z <= 70; z += 14) { a.push([-6, z], [6, z]); } for (let x = -64; x <= 70; x += 14) { if (Math.abs(x) > 8) a.push([x, -6], [x, 6]); } return a; }, []);
  const lanternMat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
    x.fillStyle = '#b53a2a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); for (let a = 0; a < 15; a += 0.2) { const r = 4 + a * 3.6; const px = 64 + Math.cos(a) * r, py = 70 + Math.sin(a) * r; if (a === 0) x.moveTo(px, py); else x.lineTo(px, py); } x.stroke();
    x.beginPath(); x.moveTo(64, 14); x.lineTo(104, 82); x.lineTo(24, 82); x.closePath(); x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  useFrame(() => { if (lanternMat.current) { const sun = Math.sin((rt.timeOfDay - 0.25) * Math.PI * 2); lanternMat.current.color.set(sun < 0.05 ? '#ffd27a' : '#8a6c44'); } });
  const T = TOWER; const A = ACADEMY;
  return (
    <group>
      <Inst geo={GEO.box} items={items.walls} /><Inst geo={GEO.box} items={items.roofs} /><Inst geo={GEO.box} items={items.ridges} /><Inst geo={GEO.box} items={items.doors} cast={false} />
      <Inst geo={GEO.box} items={items.paths} cast={false} /><Inst geo={GEO.box} items={items.stone} /><Inst geo={GEO.box} items={items.posts} />
      <Inst geo={GEO.cyl6} items={items.trunks} /><Inst geo={GEO.ico} items={items.blossoms} />
      {/* lanterns */}
      {lanterns.map(([x, z], i) => (<group key={i} position={[x, 0, z]}><mesh position={[0, 1.4, 0]} geometry={GEO.cyl6} scale={[0.07, 2.8, 0.07]} material={toonMat('#4a3828')} /><mesh position={[0, 3, 0]} geometry={GEO.box} scale={[0.5, 0.65, 0.5]}>{i === 0 ? <meshBasicMaterial ref={lanternMat} color="#8a6c44" /> : <meshBasicMaterial color="#ffd27a" />}</mesh></group>))}
      {/* Hokage tower */}
      <group position={[T.x, 0, T.z]}>
        <mesh geometry={GEO.cyl} scale={[T.r, 20, T.r]} position={[0, 10, 0]} castShadow receiveShadow material={toonMat('#c0392b')} />
        <mesh geometry={GEO.cyl} scale={[T.r + 0.8, 0.8, T.r + 0.8]} position={[0, 12, 0]} material={toonMat('#e8dcc0')} />
        <mesh geometry={GEO.cyl} scale={[T.r + 2.2, 0.7, T.r + 2.2]} position={[0, 20.2, 0]} material={toonMat('#2f7d5a')} castShadow />
        <mesh geometry={GEO.cyl} scale={[6.4, 6, 6.4]} position={[0, 23.2, 0]} castShadow material={toonMat('#c0392b')} />
        <mesh geometry={GEO.cone} scale={[10, 6, 10]} position={[0, 29, 0]} castShadow material={toonMat('#2f7d5a')} />
        <mesh geometry={GEO.cone} scale={[0.5, 3, 0.5]} position={[0, 33, 0]} material={toonMat('#e8c24a')} />
        <mesh position={[0, 8, T.r + 0.05]} geometry={GEO.plane} scale={[7, 7, 1]}><meshBasicMaterial map={tex} /></mesh>
        <mesh position={[0, 1.6, T.r + 0.04]} geometry={GEO.box} scale={[3, 3.2, 0.2]} material={toonMat('#4a2f20')} />
      </group>
      {/* Academy */}
      <group position={[A.x, 0, A.z]}>
        <mesh geometry={GEO.box} scale={[A.w, A.h, A.d]} position={[0, A.h / 2, 0]} castShadow receiveShadow material={toonMat('#efe3c8')} />
        <mesh geometry={GEO.box} scale={[A.w + 1.8, 0.5, A.d + 1.8]} position={[0, A.h + 0.25, 0]} castShadow material={toonMat('#c0562e')} />
        <mesh geometry={GEO.box} scale={[A.w * 0.5, 1.2, A.d * 0.5]} position={[0, A.h + 1.0, 0]} castShadow material={toonMat('#a8451f')} />
        <mesh geometry={GEO.box} scale={[3, 3.4, 0.2]} position={[0, 1.7, A.d / 2 + 0.05]} material={toonMat('#6a4a30')} />
        <mesh geometry={GEO.cyl6} scale={[0.1, 4, 0.1]} position={[A.w / 2 - 1, A.h + 2.8, 0]} material={toonMat('#ddd')} />
        <mesh geometry={GEO.box} scale={[1.8, 1.1, 0.05]} position={[A.w / 2 - 0.1, A.h + 4.4, 0]} material={toonMat('#c0392b')} />
      </group>
      {CRATES.map((c, i) => (<mesh key={i} position={[c.x, c.h / 2, c.z]} scale={[c.w, c.h, c.d]} geometry={GEO.box} castShadow receiveShadow material={toonMat(i % 2 ? '#b98a54' : '#a77a46')} />))}
      {/* Ichiraku & tool shop */}
      {[[RAMEN_POS, '#d33a2a', '#fff'], [SHOP_POS, '#2f5aa8', '#e8c24a']].map(([p, c, t], i) => { const pp = p as [number, number]; return (
        <group key={i} position={[pp[0], 0, pp[1]]}>
          <mesh geometry={GEO.box} scale={[5, 1.1, 2.2]} position={[0, 0.55, -0.2]} castShadow material={toonMat('#8a5a30')} />
          <mesh geometry={GEO.box} scale={[5.6, 0.3, 3.2]} position={[0, 3, -0.4]} castShadow material={toonMat(c as string)} />
          <mesh geometry={GEO.box} scale={[0.15, 3, 0.15]} position={[-2.5, 1.5, 0.9]} material={toonMat('#6a4a30')} /><mesh geometry={GEO.box} scale={[0.15, 3, 0.15]} position={[2.5, 1.5, 0.9]} material={toonMat('#6a4a30')} />
          <mesh geometry={GEO.box} scale={[4.6, 0.8, 0.05]} position={[0, 2.5, 1.1]} material={toonMat(t as string)} />
        </group>); })}
      {/* Mission board */}
      <group position={[BOARD_POS[0], 0, BOARD_POS[1]]}>
        <mesh geometry={GEO.box} scale={[0.2, 2.8, 0.2]} position={[-1.4, 1.4, 0]} material={toonMat('#6a4a30')} /><mesh geometry={GEO.box} scale={[0.2, 2.8, 0.2]} position={[1.4, 1.4, 0]} material={toonMat('#6a4a30')} />
        <mesh geometry={GEO.box} scale={[3.2, 1.9, 0.18]} position={[0, 1.9, 0]} castShadow material={toonMat('#a77a46')} />
        <mesh geometry={GEO.box} scale={[3.5, 0.3, 0.5]} position={[0, 3, 0]} material={toonMat('#c0392b')} />
        {[[-0.9, 2.2], [0.1, 2.4], [1, 1.9], [-0.3, 1.6]].map(([x, y], i) => <mesh key={i} geometry={GEO.box} scale={[0.6, 0.8, 0.02]} position={[x, y, 0.11]} rotation={[0, 0, (i - 1.5) * 0.08]} material={toonMat('#f5f0e0')} />)}
      </group>
      {/* training grounds */}
      <mesh geometry={GEO.circle} rotation={[-Math.PI / 2, 0, 0]} position={[TRAINING.x, 0.03, TRAINING.z]} scale={[17, 17, 1]} material={toonMat('#c9b27c')} receiveShadow />
      {TRAINING_POSTS.map(([x, z], i) => (<group key={i} position={[x, 0, z]}><mesh geometry={GEO.cyl} scale={[0.5, 3.5, 0.5]} position={[0, 1.75, 0]} castShadow material={toonMat('#8a5a2a')} /><mesh geometry={GEO.cyl} scale={[0.55, 0.3, 0.55]} position={[0, 3.2, 0]} material={toonMat('#c0392b')} /></group>))}
      {/* Hokage Monument cliff */}
      <Monument />
    </group>
  );
}

function StoneHead({ x, kind }: { x: number; kind: number }) {
  const stone = toonMat('#cbbd9c'); const dark = toonMat('#8a7c60');
  return (
    <group position={[x, 33, -88]}>
      <mesh geometry={GEO.sphere} scale={[6.2, 7.6, 4.4]} material={stone} castShadow />
      <mesh geometry={GEO.box} scale={[1.6, 2.6, 1.8]} position={[0, -0.6, 3.9]} material={stone} />
      <mesh geometry={GEO.box} scale={[7, 0.7, 1.3]} position={[0, 1.7, 3.7]} material={dark} />
      <mesh geometry={GEO.box} scale={[1.4, 0.3, 0.3]} position={[-2.2, 0.9, 4.2]} material={dark} /><mesh geometry={GEO.box} scale={[1.4, 0.3, 0.3]} position={[2.2, 0.9, 4.2]} material={dark} />
      <mesh geometry={GEO.box} scale={[3, 0.4, 0.4]} position={[0, -3, 3.6]} material={dark} />
      {kind === 0 && <mesh geometry={GEO.box} scale={[9, 9, 2.5]} position={[0, -3, -2.5]} material={stone} />}
      {kind === 1 && [0, 1, 2, 3, 4].map((i) => <mesh key={i} geometry={GEO.cone} scale={[1.5, 4, 1.5]} position={[(i - 2) * 2.2, 7, 0]} rotation={[0, 0, (i - 2) * -0.25]} material={stone} />)}
      {kind === 2 && <mesh geometry={GEO.cyl} scale={[5.6, 2.4, 4.2]} position={[0, 7.4, 0]} material={dark} />}
      {kind === 3 && <><mesh geometry={GEO.sphere} scale={[2, 2, 2]} position={[-6, 4, 0]} material={stone} /><mesh geometry={GEO.sphere} scale={[2, 2, 2]} position={[6, 4, 0]} material={stone} /><mesh geometry={GEO.box} scale={[1.2, 1.2, 0.4]} position={[0, 4.3, 4.4]} material={dark} /></>}
    </group>
  );
}
function Monument() {
  const rocks = useMemo(() => { const r = rng(5); const a: Item[] = []; for (let i = 0; i < 34; i++) a.push({ p: [(r() - 0.5) * 150, 6 + r() * 30, -98 - r() * 22], s: [10 + r() * 18, 12 + r() * 20, 10 + r() * 12], c: r() < 0.5 ? '#9a8c70' : '#8a7e64', ry: r() * 3 }); return a; }, []);
  return (<group>
    <mesh geometry={GEO.box} scale={[140, 40, 40]} position={[0, 20, -110]} castShadow receiveShadow material={toonMat('#a89a7c')} />
    <Inst geo={GEO.ico} items={rocks} />
    {[-27, -9, 9, 27].map((x, i) => <StoneHead key={i} x={x} kind={i} />)}
  </group>);
}

// -------------------------------------------------------------------------------- Forest of Death
function Forest() {
  const preset = GRAPHICS[useGame.getState().settings.graphics];
  const d = useMemo(() => {
    const trunk: Item[] = [], canopy: Item[] = [], under: Item[] = [], mush: Item[] = [], r = rng(31);
    const trees = FOREST_TREES.filter((_, i) => i / FOREST_TREES.length < preset.foliage + 0.05);
    for (const t of trees) {
      trunk.push({ p: [t.x, t.h / 2, t.z], s: [t.r, t.h, t.r], c: t.hue < 0.5 ? '#4d3a2a' : '#5a4430' });
      trunk.push({ p: [t.x, 0.8, t.z], s: [t.r * 1.5, 1.6, t.r * 1.5], c: '#40301f' });
      for (let i = 0; i < 4; i++) canopy.push({ p: [t.x + (r() - 0.5) * t.r * 3, t.h - 3 + r() * 6, t.z + (r() - 0.5) * t.r * 3], s: [t.r * 3.3, t.r * 2.2, t.r * 3.3], c: ['#1f4a2c', '#255535', '#1a4026'][i % 3] });
    }
    for (let i = 0; i < 90 * preset.foliage; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 95; const x = Math.cos(a) * rr, z = 215 + Math.sin(a) * rr; if (Math.abs(x) < 4 && z < 175) continue; under.push({ p: [x, 0.5, z], s: [0.9 + r(), 0.6 + r() * 0.6, 0.9 + r()], c: '#2c6a3a' }); }
    for (let i = 0; i < 30; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 90; const x = Math.cos(a) * rr, z = 215 + Math.sin(a) * rr; mush.push({ p: [x, 0.5, z], s: [0.5 + r() * 0.5, 0.5, 0.5 + r() * 0.5], c: r() < 0.5 ? '#c04a6a' : '#6a4ac0' }); }
    return { trunk, canopy, under, mush };
  }, [preset.foliage]);
  return (<group>
    <Inst geo={GEO.cyl} items={d.trunk} /><Inst geo={GEO.ico} items={d.canopy} cast={false} /><Inst geo={GEO.dome} items={d.under} cast={false} /><Inst geo={GEO.dome} items={d.mush} cast={false} />
    {/* entrance gate and fence */}
    {[-6, 6].map((x) => <mesh key={x} geometry={GEO.box} scale={[1, 7, 1]} position={[x, 3.5, 128]} castShadow material={toonMat('#6a4a30')} />)}
    <mesh geometry={GEO.box} scale={[14, 0.8, 1.2]} position={[0, 7, 128]} material={toonMat('#8a3a2a')} />
    {Array.from({ length: 14 }, (_, i) => <mesh key={i} geometry={GEO.box} scale={[0.25, 3, 0.25]} position={[-40 + i * 5.5 + (i > 7 ? 14 : 0), 1.5, 128]} material={toonMat('#7a5a40')} />)}
    {/* secret cave */}
    <group position={[-70, 0, 252]}><mesh geometry={GEO.ico} scale={[4, 5, 4]} position={[0, 2, -2]} material={toonMat('#59545c')} castShadow /><mesh geometry={GEO.sphere} scale={[1.6, 2.2, 0.3]} position={[0, 1.4, 1.8]} material={toonMat('#c898ff', '#7a3ac0')} /></group>
  </group>);
}

// -------------------------------------------------------------------------------- Waves
function WaterPlane({ rect, a, b }: { rect: [number, number, number, number]; a: string; b: string }) {
  const mat = useMemo(() => makeWaterMaterial(a, b), [a, b]);
  useFrame((s) => { mat.uniforms.uTime.value = s.clock.elapsedTime; });
  const w = rect[1] - rect[0], d = rect[3] - rect[2];
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(rect[0] + rect[1]) / 2, 0.04, (rect[2] + rect[3]) / 2]} material={mat}><planeGeometry args={[w, d, 24, 24]} /></mesh>;
}
function Waves() {
  const d = useMemo(() => {
    const deck: Item[] = [], posts: Item[] = [], pillars: Item[] = [], huts: Item[] = [], roofs: Item[] = [];
    const cx = (BRIDGE.minX + BRIDGE.maxX) / 2, L = BRIDGE.maxX - BRIDGE.minX;
    deck.push({ p: [cx, 0.15, 0], s: [L, 0.6, BRIDGE.w], c: '#9a7448' });
    for (let i = 0; i < L / 3; i++) deck.push({ p: [BRIDGE.minX + 1.5 + i * 3, 0.47, 0], s: [0.12, 0.04, BRIDGE.w], c: '#7a5832' });
    for (const sd of [-1, 1]) { deck.push({ p: [cx, 1.4, sd * (BRIDGE.w / 2 + 0.2)], s: [L, 0.25, 0.3], c: '#6a4a30' }); for (let x = BRIDGE.minX + 3; x < BRIDGE.maxX; x += 6) posts.push({ p: [x, 1.2, sd * (BRIDGE.w / 2 + 0.2)], s: [0.4, 2.4, 0.4], c: '#5a3c26' }); }
    for (let x = BRIDGE.minX + 10; x < BRIDGE.maxX; x += 20) for (const sd of [-1, 1]) pillars.push({ p: [x, -2, sd * 8], s: [1.2, 5, 1.2], c: '#8a8a90' });
    for (const [x, z] of [[-325, -30], [-335, 5], [-322, 22], [-345, -15]]) { huts.push({ p: [x, 1.75, z], s: [8, 3.5, 7], c: '#d8c7a0' }); roofs.push({ p: [x, 4.3, z], s: [6.2, 2, 5.5], c: '#a8884a' }); }
    return { deck, posts, pillars, huts, roofs };
  }, []);
  return (<group>
    <WaterPlane rect={WATER_RECTS[0]} a="#2f7aa6" b="#5ab0d0" />
    <Inst geo={GEO.box} items={d.deck} /><Inst geo={GEO.box} items={d.posts} /><Inst geo={GEO.cyl} items={d.pillars} />
    <Inst geo={GEO.box} items={d.huts} /><Inst geo={GEO.cone} items={d.roofs} />
    {[-325, -335, -322, -345].map((x, i) => <mesh key={i} geometry={GEO.cone} scale={[5.2, 2.2, 4.4]} position={[x, 4.4, [-30, 5, 22, -15][i]]} rotation={[0, Math.PI / 4, 0]} material={toonMat('#b89a58')} />)}
    <mesh geometry={GEO.box} scale={[10, 1.2, 3]} position={[-210, 0.4, 62]} rotation={[0, 0.4, 0]} material={toonMat('#6a4a30')} />
  </group>);
}

// -------------------------------------------------------------------------------- Sand
function Sand() {
  const d = useMemo(() => {
    const dunes: Item[] = [], domes: Item[] = [], tubes: Item[] = [], cactus: Item[] = [], r = rng(77);
    for (let i = 0; i < 46; i++) { const a = r() * 6.28, rr = 40 + r() * 70; dunes.push({ p: [240 + Math.cos(a) * rr * 1.1, -2, Math.sin(a) * rr], s: [14 + r() * 22, 5 + r() * 6, 14 + r() * 22], c: r() < 0.5 ? '#e5c887' : '#dcb878' }); }
    for (const b of SAND_BUILDINGS) { tubes.push({ p: [b.x, b.h / 2, b.z], s: [b.r, b.h, b.r], c: '#d8b878' }); domes.push({ p: [b.x, b.h, b.z], s: [b.r * 1.05, b.r * 0.8, b.r * 1.05], c: '#c8985a' }); }
    for (let i = 0; i < 20; i++) { const a = r() * 6.28, rr = 50 + r() * 60; cactus.push({ p: [240 + Math.cos(a) * rr, 1.2, Math.sin(a) * rr], s: [0.4, 2.4, 0.4], c: '#5a8a4a' }); }
    return { dunes, domes, tubes, cactus };
  }, []);
  const K = KAZEKAGE;
  return (<group>
    <Inst geo={GEO.sphere} items={d.dunes} cast={false} /><Inst geo={GEO.cyl} items={d.tubes} /><Inst geo={GEO.dome} items={d.domes} /><Inst geo={GEO.cyl6} items={d.cactus} />
    <group position={[K.x, 0, K.z]}>
      <mesh geometry={GEO.cyl} scale={[K.r, K.h, K.r]} position={[0, K.h / 2, 0]} castShadow material={toonMat('#d9a066')} />
      <mesh geometry={GEO.cyl} scale={[K.r - 3, 5, K.r - 3]} position={[0, K.h + 2.5, 0]} material={toonMat('#c8885a')} />
      <mesh geometry={GEO.dome} scale={[K.r - 3, 6, K.r - 3]} position={[0, K.h + 5, 0]} material={toonMat('#b8402a')} />
      <mesh geometry={GEO.box} scale={[5, 6, 0.3]} position={[0, 9, K.r + 0.1]} material={toonMat('#b8402a')} />
    </group>
    <mesh geometry={GEO.ring} rotation={[-Math.PI / 2, 0, 0]} position={[262, 0.06, 44]} scale={[38, 38, 1]}><meshBasicMaterial color="#b8803a" transparent opacity={0.55} side={THREE.DoubleSide} /></mesh>
  </group>);
}

// -------------------------------------------------------------------------------- Myoboku
function Myoboku() {
  const d = useMemo(() => {
    const mount: Item[] = [], stems: Item[] = [], caps: Item[] = [], pillar: Item[] = [], spots: Item[] = [], r = rng(13);
    for (const [x, z, rad] of SAGE_ROCKS) mount.push({ p: [x, rad * 1.2, z], s: [rad, rad * 2.6, rad], c: r() < 0.5 ? '#58805a' : '#6a9068' });
    for (const [x, z, rad] of MYOBOKU_MUSHROOMS) { stems.push({ p: [x, rad * 1.5, z], s: [rad * 0.4, rad * 3, rad * 0.4], c: '#f0e6d0' }); caps.push({ p: [x, rad * 3, z], s: [rad * 1.6, rad * 1.1, rad * 1.6], c: '#c8403a' }); for (let i = 0; i < 4; i++) spots.push({ p: [x + Math.cos(i * 1.6) * rad * 1.0, rad * 3.6 + (i % 2) * 0.2, z + Math.sin(i * 1.6) * rad * 1.0], s: [rad * 0.3, rad * 0.12, rad * 0.3], c: '#ffffff' }); }
    for (const p of PILLARS) pillar.push({ p: [p.x, p.h / 2, p.z], s: [p.w, p.h, p.w], c: '#8a9a88' });
    return { mount, stems, caps, pillar, spots };
  }, []);
  return (<group>
    <Inst geo={GEO.cone} items={d.mount} /><Inst geo={GEO.cyl} items={d.stems} /><Inst geo={GEO.dome} items={d.caps} /><Inst geo={GEO.sphere} items={d.spots} cast={false} /><Inst geo={GEO.box} items={d.pillar} />
    {[[-205, -205], [-175, -245]].map(([x, z], i) => (<group key={i} position={[x, 0, z]}><mesh geometry={GEO.sphere} scale={[2.4, 1.8, 3]} position={[0, 1.8, 0]} material={toonMat('#6a8a5a')} castShadow /><mesh geometry={GEO.sphere} scale={[1.2, 1.2, 1.2]} position={[0, 3.5, 1.8]} material={toonMat('#6a8a5a')} /><mesh geometry={GEO.sphere} scale={[0.4, 0.4, 0.4]} position={[-0.6, 4.2, 2.6]} material={toonMat('#ffe14a')} /><mesh geometry={GEO.sphere} scale={[0.4, 0.4, 0.4]} position={[0.6, 4.2, 2.6]} material={toonMat('#ffe14a')} /></group>))}
  </group>);
}

// -------------------------------------------------------------------------------- Valley of the End
function Valley() {
  const stone = toonMat('#8a9288'); const dark = toonMat('#6a726a');
  const fallMat = useMemo(() => makeWaterMaterial('#cfe8f5', '#ffffff'), []);
  useFrame((s) => { fallMat.uniforms.uTime.value = s.clock.elapsedTime * 2; });
  const rocks = useMemo(() => { const r = rng(21); const a: Item[] = []; for (let i = 0; i < 26; i++) { const sd = i % 2 ? 1 : -1; a.push({ p: [210 + sd * (45 + r() * 40), 5 + r() * 14, -235 + (r() - 0.5) * 110], s: [8 + r() * 12, 10 + r() * 22, 8 + r() * 12], c: r() < 0.5 ? '#7a847a' : '#6a746a', ry: r() * 3 }); } return a; }, []);
  return (<group>
    <WaterPlane rect={WATER_RECTS[1]} a="#3a86a8" b="#7ac0d8" />
    <Inst geo={GEO.ico} items={rocks} />
    {VALLEY_STATUES.map((s, i) => (
      <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <mesh geometry={GEO.box} scale={[12, 6, 10]} position={[0, 3, 0]} material={dark} castShadow /><mesh geometry={GEO.box} scale={[9, 15, 6]} position={[0, 13, 0]} material={stone} castShadow />
        <mesh geometry={GEO.sphere} scale={[4.2, 5, 4]} position={[0, 24, 0]} material={stone} castShadow /><mesh geometry={GEO.box} scale={[1.2, 2, 1.4]} position={[0, 23, 3.8]} material={stone} />
        <mesh geometry={GEO.box} scale={[2.2, 8, 2.2]} position={[-5.2, 14, 3]} rotation={[0.9, 0, 0.1]} material={stone} /><mesh geometry={GEO.box} scale={[2.2, 8, 2.2]} position={[5.2, 14, 3]} rotation={[0.9, 0, -0.1]} material={stone} />
        {i === 0 ? <mesh geometry={GEO.cyl} scale={[4.4, 1.4, 4.2]} position={[0, 27.5, 0]} material={dark} /> : [0, 1, 2, 3].map((k) => <mesh key={k} geometry={GEO.cone} scale={[1.2, 3.5, 1.2]} position={[(k - 1.5) * 2, 28, 0]} rotation={[0, 0, (k - 1.5) * -0.2]} material={stone} />)}
      </group>
    ))}
    <mesh geometry={GEO.box} scale={[60, 40, 2]} position={[210, 20, -300]} material={fallMat} />
    <mesh geometry={GEO.box} scale={[60, 40, 8]} position={[210, 20, -306]} material={dark} />
  </group>);
}

export function World() {
  return (<group>
    <Ground />
    <Gate c={[0, 0]} r={215}><Konoha /></Gate>
    <Gate c={[0, 215]} r={250}><Forest /></Gate>
    <Gate c={[-240, 0]} r={220}><Waves /></Gate>
    <Gate c={[240, 0]} r={230}><Sand /></Gate>
    <Gate c={[-210, -235]} r={220}><Myoboku /></Gate>
    <Gate c={[210, -235]} r={230}><Valley /></Gate>
  </group>);
}
export function useWorldReady() { const [r] = useState(true); useEffect(() => undefined, []); return r; }
