import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { rt } from '../game/runtime';
import { useGame } from '../game/store';
import { setRain, thunder } from '../game/audio';

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const OVERCAST: Record<string, number> = { sunny: 0, cloudy: 0.5, lightRain: 0.65, heavyRain: 0.85, thunderstorm: 0.93, fog: 0.7 };
const RAIN: Record<string, number> = { sunny: 0, cloudy: 0, lightRain: 0.5, heavyRain: 1, thunderstorm: 1, fog: 0 };
const FOGFAR: Record<string, number> = { sunny: 800, cloudy: 650, lightRain: 420, heavyRain: 230, thunderstorm: 200, fog: 85 };

export function Atmosphere() {
  const { scene, camera } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sunDisc = useRef<THREE.Mesh>(null), moonDisc = useRef<THREE.Mesh>(null), stars = useRef<THREE.Points>(null);
  const rain = useRef<THREE.LineSegments>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const bg = useMemo(() => new THREE.Color(), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const lightning = useRef({ next: 8, thunderAt: -1 });
  const DROPS = 1500;
  const drops = useMemo(() => { const a = new Float32Array(DROPS * 6); for (let i = 0; i < DROPS; i++) { a[i * 6] = (Math.random() - 0.5) * 70; a[i * 6 + 1] = Math.random() * 30; a[i * 6 + 2] = (Math.random() - 0.5) * 70; } return a; }, []);
  const starGeo = useMemo(() => {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95); p[i * 3] = 1500 * Math.sin(ph) * Math.cos(th); p[i * 3 + 1] = 1500 * Math.cos(ph); p[i * 3 + 2] = 1500 * Math.sin(ph) * Math.sin(th); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g;
  }, []);
  useEffect(() => { if (sun.current) sun.current.target = target; scene.fog = new THREE.Fog('#86c5f0', 50, 800); return () => { scene.fog = null; }; }, [scene, target]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const st = useGame.getState();
    const g = st.g;
    if (!g) return;
    const mins = (g.time + rt.clockPartial) % 1440;
    const hour = mins / 60;
    const ang = ((hour - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    const night = 1 - smooth(-0.1, 0.2, elev);
    rt.night = night;
    const w = g.weather;
    const oc = OVERCAST[w];
    // weather state
    const rtarget = RAIN[w];
    rt.rainLevel += (rtarget - rt.rainLevel) * Math.min(1, dt * 0.25);
    rt.wet += (rt.rainLevel > rt.wet ? 0.25 : -0.012) * dt * (rt.rainLevel > rt.wet ? 1 : 1);
    rt.wet = Math.min(1, Math.max(rt.rainLevel > 0.1 ? 0 : 0, rt.wet));
    if (rt.rainLevel < 0.05 && rt.wet < 0) rt.wet = 0;
    // sky colour
    bg.set('#05081a').lerp(tmp.set('#86c5f0'), smooth(-0.08, 0.35, elev));
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.22);
    bg.lerp(tmp.set('#f59a6a'), dusk * 0.65);
    const grey = tmp.set('#9aa3ad').multiplyScalar(0.25 + 0.75 * smooth(-0.1, 0.4, elev));
    bg.lerp(grey, oc * 0.8);
    rt.lightning = Math.max(0, rt.lightning - dt * 3.5);
    if (w === 'thunderstorm') {
      const L = lightning.current; L.next -= dt;
      if (L.next <= 0) { rt.lightning = 1; L.next = 5 + Math.random() * 10; L.thunderAt = 0.4 + Math.random() * 1.6; }
      if (L.thunderAt > 0) { L.thunderAt -= dt; if (L.thunderAt <= 0) thunder(); }
    }
    bg.lerp(tmp.set('#e8efff'), rt.lightning * 0.6);
    scene.background = bg;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) { fog.color.copy(bg); fog.near = 20; fog.far = FOGFAR[w] * (1 - 0.0 * night); }
    setRain(rt.rainLevel * (g.player.interior ? 0.3 : 1));
    // lights
    const px = rt.mode === 'walk' ? rt.walk.x : rt.bike.x, pz = rt.mode === 'walk' ? rt.walk.z : rt.bike.z;
    const dirX = Math.cos(ang) * 0.9, dirY = Math.max(0.12, Math.abs(elev)), dirZ = 0.45;
    if (sun.current) {
      const isSun = elev > 0;
      sun.current.position.set(px + dirX * 150 * (isSun ? 1 : -1), dirY * 150, pz + dirZ * 150);
      target.position.set(px, 0, pz); target.updateMatrixWorld();
      sun.current.intensity = isSun ? (1 - oc * 0.65) * smooth(0, 0.3, elev) * 3.4 : 0.35 * night + 0.0;
      sun.current.color.set(isSun ? (dusk > 0.3 ? '#ffb27a' : '#fff4e0') : '#8fa8ff');
      sun.current.castShadow = st.g!.settings.shadows;
    }
    if (hemi.current) {
      hemi.current.intensity = (0.28 + 0.95 * smooth(-0.1, 0.4, elev)) * (1 - oc * 0.25) + rt.lightning * 1.6;
      hemi.current.color.set(night > 0.5 ? '#6f86c4' : '#cfe6ff'); hemi.current.groundColor.set(night > 0.5 ? '#1c2230' : '#7c6f5a');
    }
    const cp = camera.position;
    if (sunDisc.current) { sunDisc.current.position.set(cp.x + Math.cos(ang) * 900, Math.sin(ang) * 900, cp.z + 300); sunDisc.current.visible = elev > -0.05 && oc < 0.8; }
    if (moonDisc.current) { moonDisc.current.position.set(cp.x - Math.cos(ang) * 900, -Math.sin(ang) * 900, cp.z - 300); moonDisc.current.visible = elev < 0.05 && oc < 0.9; }
    if (stars.current) { stars.current.position.copy(cp); (stars.current.material as THREE.PointsMaterial).opacity = night * (1 - oc); stars.current.visible = night * (1 - oc) > 0.05; }
    // rain streaks around the camera
    if (rain.current) {
      const r = rt.rainLevel;
      rain.current.visible = r > 0.05 && !g.player.interior;
      if (rain.current.visible) {
        rain.current.position.set(cp.x, cp.y - 8, cp.z);
        const pos = rain.current.geometry.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        const n = Math.floor(DROPS * Math.min(1, r));
        for (let i = 0; i < DROPS; i++) {
          let y = drops[i * 6 + 1] - 30 * dt;
          if (y < 0) { y += 30; drops[i * 6] = (Math.random() - 0.5) * 70; drops[i * 6 + 2] = (Math.random() - 0.5) * 70; }
          drops[i * 6 + 1] = y;
          const vis = i < n;
          arr[i * 6] = drops[i * 6]; arr[i * 6 + 1] = vis ? y : -999; arr[i * 6 + 2] = drops[i * 6 + 2];
          arr[i * 6 + 3] = drops[i * 6] - 0.08; arr[i * 6 + 4] = vis ? y + 0.9 : -999; arr[i * 6 + 5] = drops[i * 6 + 2] - 0.05;
        }
        pos.needsUpdate = true;
        (rain.current.material as THREE.LineBasicMaterial).opacity = 0.35 * r;
      }
    }
  });
  return (
    <>
      <hemisphereLight ref={hemi} intensity={1} />
      <directionalLight ref={sun} intensity={3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={80} shadow-camera-bottom={-80} shadow-camera-near={10} shadow-camera-far={400} shadow-bias={-0.0004} />
      <primitive object={target} />
      <mesh ref={sunDisc}><sphereGeometry args={[34, 16, 12]} /><meshBasicMaterial color="#fff2c4" fog={false} /></mesh>
      <mesh ref={moonDisc}><sphereGeometry args={[22, 16, 12]} /><meshBasicMaterial color="#dfe6f5" fog={false} /></mesh>
      <points ref={stars} geometry={starGeo} frustumCulled={false}><pointsMaterial color="#fff" size={3} sizeAttenuation={false} transparent opacity={0} fog={false} /></points>
      <lineSegments ref={rain} frustumCulled={false}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(DROPS * 6), 3]} /></bufferGeometry>
        <lineBasicMaterial color="#cfe4ff" transparent opacity={0.3} fog={false} />
      </lineSegments>
    </>
  );
}
