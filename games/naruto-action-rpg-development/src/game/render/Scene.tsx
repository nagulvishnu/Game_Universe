import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rt, angleDiff } from '../runtime';
import { useGame } from '../store';
import { GRAPHICS, ZONES, WILDS } from '../config';
import { gameTick } from '../systems/loop';
import { setParticleCap } from '../systems/fx';
import { input } from '../input';
import { World } from './World';
import { PlayerView, EnemyViews, AllyViews, NpcViews, CollectibleViews, ObjectiveBeam, LockMarker } from './Entities';
import { Particles, Rings, Projectiles, Telegraphs, SummonView, Logs, AmbientFx } from './Effects';
import { initGame, consumeIntro } from '../session';
import { groundHeight } from '../logic/collision';

function Loop() {
  useFrame((_, dt) => gameTick(dt), -2);
  return null;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Sky dome, sun/moon, fog and lights — all driven by the in-game clock and the current zone. */
function Atmosphere() {
  const { scene, gl } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null); const hemi = useRef<THREE.HemisphereLight>(null); const dome = useRef<THREE.Mesh>(null); const stars = useRef<THREE.Points>(null);
  const sunDisc = useRef<THREE.Mesh>(null); const moonDisc = useRef<THREE.Mesh>(null);
  const shadow = GRAPHICS[useGame.getState().settings.graphics].shadow;
  const domeMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#4a90d8') }, bottom: { value: new THREE.Color('#bfe3f5') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)), 1.0); }',
  }), []);
  const starGeo = useMemo(() => { const n = 500; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 6.28, v = Math.random() * 0.95 + 0.05; const r = 420; a[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r; a[i * 3 + 1] = v * r; a[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return g; }, []);
  const c = useMemo(() => ({ fog: new THREE.Color(), night: new THREE.Color('#0a1230'), dusk: new THREE.Color('#ff9a62'), tmp: new THREE.Color(), top: new THREE.Color(), zoneFog: new THREE.Color('#cfe9f5'), dens: 0.004 }), []);
  useEffect(() => { scene.fog = new THREE.FogExp2('#cfe9f5', 0.004); return () => { scene.fog = null; }; }, [scene]);
  useEffect(() => { gl.setClearColor('#cfe9f5'); }, [gl]);
  useFrame((st, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1); const t = rt.timeOfDay; const sunH = Math.sin((t - 0.25) * Math.PI * 2); const day = smooth(-0.15, 0.3, sunH);
    const zone = rt.zone ?? WILDS; const zdef = ZONES.find((z) => z.id === zone.id) ?? WILDS;
    c.zoneFog.lerp(c.tmp.set(zdef.fog), 1 - Math.exp(-dt * 1.5)); c.dens += (zdef.fogDensity - c.dens) * (1 - Math.exp(-dt * 1.5));
    const dusk = 1 - smooth(0.0, 0.35, Math.abs(sunH));
    c.fog.copy(c.zoneFog).lerp(c.night, 1 - day).lerp(c.tmp.copy(c.dusk), dusk * 0.4 * (zone.id === 'forest' ? 0.3 : 1));
    const mist = Math.min(1, rt.mistT / 2);
    if (mist > 0) c.fog.lerp(c.tmp.set('#dbe6ea'), mist * 0.7);
    const fog = scene.fog as THREE.FogExp2; fog.color.copy(c.fog); fog.density = c.dens * (zone.id === 'forest' ? 1 : 1) + mist * 0.03 + (1 - day) * 0.0015;
    c.top.set('#3f86d6').lerp(c.tmp.set('#0a1030'), 1 - day).lerp(c.tmp.set('#d8785a'), dusk * 0.35);
    domeMat.uniforms.top.value.copy(c.top); domeMat.uniforms.bottom.value.copy(c.fog);
    const cam = st.camera; if (dome.current) dome.current.position.copy(cam.position);
    gl.setClearColor(c.fog);
    const p = rt.player.pos; const ang = (t - 0.25) * Math.PI * 2;
    const sx = Math.cos(ang) * 0.7, sy = Math.sin(ang), sz = 0.45;
    const l = sun.current;
    if (l) {
      const useSun = sunH > -0.05; const dirY = useSun ? Math.max(0.12, sy) : Math.max(0.2, -sy); const sgn = useSun ? 1 : -1;
      l.position.set(p.x + sx * sgn * 60, dirY * 80, p.z + sz * sgn * 60); l.target.position.set(p.x, 0, p.z); l.target.updateMatrixWorld();
      l.intensity = useSun ? 2.4 * smooth(-0.05, 0.3, sunH) + 0.2 : 0.55; l.color.set(useSun ? (dusk > 0.5 ? '#ffb27a' : '#fff4dc') : '#8fa8ff');
    }
    if (hemi.current) { hemi.current.intensity = 0.45 + 0.55 * day; hemi.current.color.set(day > 0.5 ? '#bfe0ff' : '#4a5a9a'); hemi.current.groundColor.set(zone.id === 'forest' ? '#1a2a1a' : '#6a6a50'); }
    if (stars.current) { stars.current.position.copy(cam.position); (stars.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - day * 1.6); }
    if (sunDisc.current) { sunDisc.current.position.set(cam.position.x + sx * 380, cam.position.y + sy * 380, cam.position.z + sz * 380); sunDisc.current.visible = sunH > -0.1; }
    if (moonDisc.current) { moonDisc.current.position.set(cam.position.x - sx * 380, cam.position.y - sy * 380, cam.position.z - sz * 380); moonDisc.current.visible = sunH < 0.1; }
  });
  return (<>
    <mesh ref={dome} material={domeMat} renderOrder={-10}><sphereGeometry args={[520, 24, 16]} /></mesh>
    <points ref={stars} geometry={starGeo} renderOrder={-9}><pointsMaterial color="#ffffff" size={2.2} sizeAttenuation={false} transparent depthWrite={false} fog={false} /></points>
    <mesh ref={sunDisc}><sphereGeometry args={[18, 12, 8]} /><meshBasicMaterial color="#fff2c0" fog={false} /></mesh>
    <mesh ref={moonDisc}><sphereGeometry args={[11, 12, 8]} /><meshBasicMaterial color="#dfe8ff" fog={false} /></mesh>
    <hemisphereLight ref={hemi} intensity={0.8} />
    <directionalLight ref={sun} castShadow={shadow > 0} intensity={2.4} shadow-mapSize={[shadow || 512, shadow || 512]} shadow-camera-left={-48} shadow-camera-right={48} shadow-camera-top={48} shadow-camera-bottom={-48} shadow-camera-near={1} shadow-camera-far={220} shadow-bias={-0.0004} shadow-normalBias={0.06} />
  </>);
}

const tmpV = new THREE.Vector3(); const tmpT = new THREE.Vector3();
function CameraRig() {
  const { camera, size } = useThree();
  const fov = useRef(60);
  useFrame((_, dtRaw) => {
    const cam = camera as THREE.PerspectiveCamera; const dt = Math.min(dtRaw, 0.05); rt.camera = cam; rt.size = { w: size.width, h: size.height };
    const p = rt.player; const k = 1 - Math.exp(-dt * 14);
    const head = tmpT.set(p.pos.x, p.pos.y + 1.55, p.pos.z);
    if (rt.cine) {
      const c = rt.cine; const ang = c.startYaw + c.t * c.speed;
      const boss = c.kind === 'boss'; const tx = boss && rt.boss ? rt.boss.pos.x : c.tx, tz = boss && rt.boss ? rt.boss.pos.z : c.tz;
      tmpV.set(tx + Math.sin(ang) * c.radius, c.height + (boss ? 0 : p.pos.y), tz + Math.cos(ang) * c.radius);
      cam.position.lerp(tmpV, 1 - Math.exp(-dt * 6)); cam.lookAt(tx, c.ty + (boss ? 0.6 : p.pos.y), tz);
      fov.current += ((c.kind === 'ult' ? 48 : 52) - fov.current) * 0.08;
    } else {
      const pitch = rt.camPitch; const sprint = input.down('sprint') && Math.hypot(p.vel.x, p.vel.z) > 6;
      let dist = rt.camDist + (sprint ? 0.9 : 0) + (rt.lock ? 1.2 : 0);
      const fx = Math.sin(rt.camYaw), fz = Math.cos(rt.camYaw);
      const rx = -Math.cos(rt.camYaw), rz = Math.sin(rt.camYaw);
      head.x += rx * 0.5; head.z += rz * 0.5;
      // simple collision pull-in
      const cp = Math.cos(pitch); const dx = -fx * cp, dy = Math.sin(pitch), dz = -fz * cp;
      for (let s = 1; s <= 8; s++) {
        const d = (s / 8) * dist; const x = head.x + dx * d, y = head.y + dy * d, z = head.z + dz * d;
        const hit = rt.colliders.near(x, z, 1).some((c) => c.top > y && (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r : x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ));
        if (hit) { dist = Math.max(1.6, d - 0.8); break; }
      }
      tmpV.set(head.x + dx * dist, Math.max(groundHeight(rt.colliders, head.x + dx * dist, head.z + dz * dist, 99, 0.2) + 0.5, head.y + dy * dist), head.z + dz * dist);
      cam.position.lerp(tmpV, k);
      let lx = p.pos.x, ly = p.pos.y + 1.3, lz = p.pos.z;
      if (rt.lock) { lx += (rt.lock.pos.x - lx) * 0.3; lz += (rt.lock.pos.z - lz) * 0.3; }
      cam.lookAt(lx, ly + (pitch - 0.35) * -0.3, lz);
      fov.current += ((60 + (sprint ? 6 : 0) + (p.form === 'kurama' ? 6 : 0) + (p.dash ? 10 : 0)) - fov.current) * 0.08;
    }
    if (rt.shake > 0) { const s = rt.shake * useGame.getState().settings.shake * 0.25; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s; }
    if (p.confuseT > 0) cam.rotateZ(Math.sin(performance.now() / 300) * 0.12);
    if (Math.abs(cam.fov - fov.current) > 0.01) { cam.fov = fov.current; cam.updateProjectionMatrix(); }
  }, -1);
  return null;
}

export function GameCanvas() {
  const gfx = useGame((s) => s.settings.graphics); const preset = GRAPHICS[gfx];
  useMemo(() => { setParticleCap(preset.particles); }, [preset.particles]);
  useState_init();
  return (
    <Canvas key={gfx} shadows={preset.shadow > 0} dpr={[0.7, preset.dpr]} flat gl={{ antialias: preset.aa, powerPreference: 'high-performance' }} camera={{ fov: 60, near: 0.15, far: 1000, position: [0, 4, 20] }}
      onCreated={({ gl }) => { input.canvas = gl.domElement; gl.domElement.style.touchAction = 'none'; }} style={{ position: 'absolute', inset: 0 }}>
      <Loop /><Atmosphere /><CameraRig />
      <World /><PlayerView /><EnemyViews /><AllyViews /><NpcViews /><CollectibleViews /><ObjectiveBeam /><LockMarker />
      <Particles /><Rings /><Projectiles /><Telegraphs /><SummonView /><Logs /><AmbientFx />
    </Canvas>
  );
}

let initialised = -1;
function useState_init() {
  const session = useGame((s) => s.session);
  if (initialised !== session) { initialised = session; initGame(consumeIntro()); }
}
void angleDiff;
