import { useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { NPCS, RIVALS } from '../data/rivals';
import { audio } from '../game/audio/audio';
import { runtime } from '../game/runtime';
import { rivalStatus, useGame } from '../game/store';
import { windowTextures } from '../game/world/builder';
import { buildCity } from '../game/world/city';
import { INTERACTABLES, districtAt } from '../game/world/layout';
import type { Look } from '../game/types';
import { Character, makeAnim } from './Character';
import { Player } from './Player';

// ---------- shared city materials (updated by the day/night cycle) ----------
let cityMats: { color: THREE.MeshStandardMaterial; win: THREE.MeshStandardMaterial; glow: THREE.MeshBasicMaterial } | null = null;
function getMats() {
  if (!cityMats) {
    const t = windowTextures();
    cityMats = {
      color: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
      win: new THREE.MeshStandardMaterial({ vertexColors: true, map: t.map, emissiveMap: t.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 0.55, metalness: 0.1 }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
  }
  return cityMats;
}

const _c = new THREE.Color();
const NIGHT_SKY = new THREE.Color('#0a0e2a'), DAY_SKY = new THREE.Color('#8ccbff'), DUSK = new THREE.Color('#ff9a6a');
const SUN_WARM = new THREE.Color('#fff4e0'), SUN_COOL = new THREE.Color('#8fa8ff'), DUSK_L = new THREE.Color('#ff9f6a');
const HEMI_DAY = new THREE.Color('#a8c8ff'), HEMI_NIGHT = new THREE.Color('#2a3070');

function SkyAndLights() {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const stars = useRef<THREE.Points>(null);
  const clouds = useRef<THREE.Group>(null);
  const quality = useGame((s) => s.settings.quality);
  const lastNight = useRef(false);
  const starGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.3 + 0.1, r = 300;
      p[i * 3] = Math.cos(a) * Math.cos(e) * r; p[i * 3 + 1] = Math.sin(e) * r; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const cloudData = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: -200 + i * 30 + Math.random() * 20, y: 60 + Math.random() * 25, z: -150 + Math.random() * 300, s: 12 + Math.random() * 14 })), []);

  useEffect(() => () => starGeo.dispose(), [starGeo]);

  useFrame((_, dt) => {
    runtime.clock = (runtime.clock + dt / 480) % 1; // 8 minute day
    const ang = (runtime.clock - 0.25) * Math.PI * 2;
    const h = Math.sin(ang);
    const day = THREE.MathUtils.smoothstep(h, -0.15, 0.35);
    const dusk = Math.max(0, 1 - Math.abs(h) * 3.2);
    runtime.night = 1 - day;
    const sky = _c.copy(NIGHT_SKY).lerp(DAY_SKY, day).lerp(DUSK, dusk * 0.55);
    scene.environmentIntensity = 0.12 + day * 0.38;
    scene.background = sky;
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(sky);
    const m = getMats();
    m.win.emissiveIntensity = (1 - day) * 1.5;
    const gl = 0.5 + (1 - day) * 0.9;
    m.glow.color.setScalar(gl);
    const p = runtime.pos;
    if (sun.current) {
      const L = sun.current;
      const dirx = Math.cos(ang), diry = Math.max(0.12, Math.abs(h)) , dirz = 0.35;
      const sgn = h >= 0 ? 1 : -1;
      L.position.set(p.x + dirx * 50 * sgn, 15 + diry * 55, p.z + dirz * 50);
      L.target.position.set(p.x, 0, p.z);
      L.target.updateMatrixWorld();
      L.intensity = day * 2.6 + (1 - day) * 0.45;
      L.color.copy(day > 0.5 ? SUN_WARM : SUN_COOL).lerp(DUSK_L, dusk * 0.6);
    }
    if (hemi.current) { hemi.current.intensity = 0.3 + day * 0.85; hemi.current.color.copy(HEMI_DAY).lerp(HEMI_NIGHT, 1 - day); }
    if (stars.current) { (stars.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - day * 1.6); stars.current.position.set(p.x, 0, p.z); }
    if (clouds.current) {
      clouds.current.position.set(p.x * 0.9, 0, p.z * 0.9);
      clouds.current.children.forEach((c, i) => { c.position.x += dt * (1 + i * 0.05); if (c.position.x > 220) c.position.x = -220; });
      clouds.current.visible = day > 0.15;
    }
    const night = day < 0.3;
    if (night !== lastNight.current) { lastNight.current = night; audio.setNight(night); }
  });

  return (
    <>
      <fog attach="fog" args={['#8ccbff', quality === 'low' ? 60 : 90, quality === 'low' ? 170 : 260]} />
      <hemisphereLight ref={hemi} args={['#a8c8ff', '#4a5a3a', 1]} />
      <directionalLight
        ref={sun} castShadow={quality !== 'low'}
        shadow-mapSize={[quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024]}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-near={1} shadow-camera-far={200} shadow-bias={-0.0006}
      />
      <points ref={stars} geometry={starGeo} frustumCulled={false}><pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} transparent opacity={0} depthWrite={false} fog={false} /></points>
      <group ref={clouds}>
        {cloudData.map((c, i) => (
          <mesh key={i} position={[c.x, c.y, c.z]} scale={[c.s, c.s * 0.35, c.s * 0.7]}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.8} fog={false} /></mesh>
        ))}
      </group>
    </>
  );
}

function SpinRing({ x, y, z, r, color, speed, tilt }: { x: number; y: number; z: number; r: number; color: string; speed: number; tilt: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * speed; });
  return (
    <group position={[x, y, z]} rotation={[tilt, 0, 0]}>
      <group ref={g}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r, 0.16, 8, 40]} /><meshBasicMaterial color={color} /></mesh>
        <mesh position={[r, 0, 0]}><octahedronGeometry args={[0.45]} /><meshBasicMaterial color="#ffffff" /></mesh>
        <mesh position={[-r, 0, 0]}><octahedronGeometry args={[0.45]} /><meshBasicMaterial color="#ffffff" /></mesh>
      </group>
    </group>
  );
}

function Fountain({ x, z, y }: { x: number; z: number; y: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((st) => {
    g.current?.children.forEach((c, i) => {
      const t = st.clock.elapsedTime * 3 + i * 0.8;
      c.scale.y = 0.6 + Math.abs(Math.sin(t)) * 1.1;
    });
  });
  return (
    <group ref={g} position={[x, y, z]}>
      {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <mesh key={i} position={[Math.cos(a) * 1.8, 0.6, Math.sin(a) * 1.8]}><cylinderGeometry args={[0.05, 0.12, 1.4, 5]} /><meshBasicMaterial color="#bfe9ff" transparent opacity={0.7} /></mesh>; })}
    </group>
  );
}

function Flag({ x, y, z, color }: { x: number; y: number; z: number; color: string }) {
  const m = useRef<THREE.Mesh>(null);
  useFrame((st) => { if (m.current) { m.current.rotation.y = Math.sin(st.clock.elapsedTime * 3 + x) * 0.35; m.current.scale.x = 1 + Math.sin(st.clock.elapsedTime * 5 + z) * 0.08; } });
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 3.6, 5]} /><meshBasicMaterial color="#cccccc" /></mesh>
      <mesh ref={m} position={[0.7, 1.3, 0]}><planeGeometry args={[1.4, 0.9]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

function Petals({ x, y, z, color, r }: { x: number; y: number; z: number; color: string; r: number }) {
  const pts = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const a = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) { a[i * 3] = (Math.random() - 0.5) * r * 2; a[i * 3 + 1] = Math.random() * 11; a[i * 3 + 2] = (Math.random() - 0.5) * r * 2; }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }, [r]);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((st, dt) => {
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let yy = p.getY(i) - dt * (0.8 + (i % 5) * 0.12);
      if (yy < 0) yy = 11;
      p.setY(i, yy);
      p.setX(i, p.getX(i) + Math.sin(st.clock.elapsedTime + i) * dt * 0.6);
    }
    p.needsUpdate = true;
  });
  return <points ref={pts} geometry={geo} position={[x, y, z]}><pointsMaterial color={color} size={0.22} transparent opacity={0.9} depthWrite={false} /></points>;
}

function City() {
  const city = useMemo(() => buildCity(), []);
  const mats = getMats();
  const quality = useGame((s) => s.settings.quality);
  const shadows = quality !== 'low';
  return (
    <group>
      {city.chunks.map((c) => (
        <group key={c.name}>
          {c.color && <mesh geometry={c.color} material={mats.color} castShadow={shadows && c.name !== 'ground' && c.name !== 'edge'} receiveShadow={shadows} />}
          {c.win && <mesh geometry={c.win} material={mats.win} castShadow={shadows && c.name !== 'edge'} receiveShadow={shadows} />}
          {c.glow && <mesh geometry={c.glow} material={mats.glow} />}
        </group>
      ))}
      {city.rings.map((r, i) => <SpinRing key={i} {...r} />)}
      {city.jets.map((j, i) => <Fountain key={i} {...j} />)}
      {city.flags.map((f, i) => <Flag key={i} {...f} />)}
      {city.floaters.map((f, i) => <Petals key={i} {...f} />)}
    </group>
  );
}

// ---------- NPCs ----------
function makeLabel(name: string, sub: string) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 72;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(12,10,32,0.78)';
  g.beginPath(); g.roundRect(4, 4, 248, 64, 14); g.fill();
  g.strokeStyle = '#35d0ff'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center';
  g.fillText(name, 128, 34);
  g.fillStyle = '#ffd24a'; g.font = '18px sans-serif';
  g.fillText(sub, 128, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const NpcActor = memo(function NpcActor({ id, name, sub, look, x, z, facing, marker }: { id: string; name: string; sub: string; look: Look; x: number; z: number; facing: number; marker: 'available' | 'locked' | 'none' }) {
  const g = useRef<THREE.Group>(null);
  const label = useRef<THREE.Sprite>(null);
  const mk = useRef<THREE.Mesh>(null);
  const anim = useRef(makeAnim());
  const yaw = useRef(facing);
  const tex = useMemo(() => makeLabel(name, sub), [name, sub]);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((st, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const gg = g.current;
    if (!gg) return;
    const dx = runtime.pos.x - x, dz = runtime.pos.z - z;
    const d = Math.hypot(dx, dz);
    const vis = d < 85;
    if (gg.visible !== vis) gg.visible = vis;
    if (!vis) return;
    const target = d < 10 ? Math.atan2(dx, dz) : facing;
    let diff = target - yaw.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    yaw.current += diff * (1 - Math.exp(-dt * 6));
    gg.rotation.y = yaw.current;
    const s = useGame.getState();
    anim.current.talk = s.overlay === 'dialogue' && s.overlayData?.id === id;
    if (label.current) label.current.visible = d < 22;
    if (mk.current) { mk.current.visible = marker !== 'none'; mk.current.position.y = 3.35 + Math.sin(st.clock.elapsedTime * 3) * 0.12; mk.current.rotation.y += dt * 2; }
  });
  return (
    <group ref={g} position={[x, 0, z]}>
      <Character look={look} anim={anim} />
      <sprite ref={label} position={[0, 2.85, 0]} scale={[3, 0.84, 1]}><spriteMaterial map={tex} transparent depthWrite={false} /></sprite>
      <mesh ref={mk} position={[0, 3.35, 0]}><octahedronGeometry args={[0.2]} /><meshBasicMaterial color={marker === 'available' ? '#ffd24a' : '#8a8fa8'} /></mesh>
    </group>
  );
});

function NpcLayer() {
  const save = useGame((s) => s.save);
  return (
    <>
      {RIVALS.map((r) => {
        const st = rivalStatus(save, r.id);
        return <NpcActor key={r.id} id={r.id} name={r.name} sub={r.title} look={r.look} x={r.home.x} z={r.home.z} facing={r.facing} marker={st.defeated ? 'none' : st.available ? 'available' : 'locked'} />;
      })}
      {NPCS.map((n) => <NpcActor key={n.id} id={n.id} name={n.name} sub={n.role} look={n.look} x={n.home.x} z={n.home.z} facing={n.facing} marker="none" />)}
    </>
  );
}

// ---------- Interactions ----------
type Target = { kind: 'rival' | 'npc' | 'feature'; id: string; x: number; z: number; range: number; label: string };
const TARGETS: Target[] = [
  ...RIVALS.map((r) => ({ kind: 'rival' as const, id: r.id, x: r.home.x, z: r.home.z, range: 3.2, label: `Talk to ${r.name}` })),
  ...NPCS.map((n) => ({ kind: 'npc' as const, id: n.id, x: n.home.x, z: n.home.z, range: 3.2, label: `Talk to ${n.name}` })),
  ...INTERACTABLES.map((i) => ({ kind: 'feature' as const, id: i.id, x: i.x, z: i.z, range: i.type === 'bench' ? 3.4 : 5.2, label: i.label })),
];
const ambushed = new Set<string>();

function Interactions({ anim }: { anim: { current: ReturnType<typeof makeAnim> } }) {
  const lastPrompt = useRef<string | null>(null);
  useFrame(() => {
    const st = useGame.getState();
    if (st.overlay || st.scene !== 'city') { if (lastPrompt.current) { lastPrompt.current = null; st.setPrompt(null); } runtime.interactReq = false; return; }
    const p = runtime.pos;
    let best: Target | null = null, bd = Infinity;
    for (const t of TARGETS) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < t.range && d < bd) { best = t; bd = d; }
    }
    // surprise challenges
    for (const r of RIVALS) {
      if (!r.ambush || ambushed.has(r.id)) continue;
      const stt = rivalStatus(st.save, r.id);
      if (stt.available && !st.save.rivals[r.id].met && Math.hypot(r.home.x - p.x, r.home.z - p.z) < 8) {
        ambushed.add(r.id);
        audio.announce();
        st.openOverlay('dialogue', { kind: 'rival', id: r.id, surprise: true });
        return;
      }
    }
    const text = best ? best.label : null;
    if (text !== lastPrompt.current) { lastPrompt.current = text; st.setPrompt(text); }
    if (runtime.interactReq) {
      runtime.interactReq = false;
      if (!best) return;
      anim.current.wave = 0.8;
      audio.interact();
      const t = best;
      if (t.kind === 'rival' || t.kind === 'npc') st.openOverlay('dialogue', { kind: t.kind, id: t.id });
      else {
        const it = INTERACTABLES.find((i) => i.id === t.id)!;
        switch (it.type) {
          case 'shop': st.openOverlay('shop', { tab: it.tab, name: it.label }); break;
          case 'training': st.openOverlay('training'); break;
          case 'tournament': st.openOverlay('tournament', { venue: it.district === 'championship' ? 'Championship District Desk' : 'Competition District Desk' }); break;
          case 'board': st.openOverlay('board', { id: it.id, district: it.district, name: it.label }); break;
          case 'publicbattle': st.openOverlay('quick', { district: it.district }); break;
          case 'bench':
            st.withCurtain('TIME PASSES...', () => { st.skipTime(0.18); st.persist(); });
            st.notify('You rest on the bench and watch the sky change.', 'info');
            break;
        }
      }
    }
  });
  return null;
}

export function CityScene() {
  const anim = useRef(makeAnim());
  const lastD = useRef('');
  useFrame(() => {
    const d = districtAt(runtime.pos.x, runtime.pos.z).id;
    if (d !== lastD.current) { lastD.current = d; runtime.district = d; }
  });
  useEffect(() => { audio.ambient(true); audio.music('city'); return () => audio.ambient(false); }, []);
  return (
    <>
      <SkyAndLights />
      <City />
      <NpcLayer />
      <Player anim={anim} />
      <Interactions anim={anim} />
    </>
  );
}
