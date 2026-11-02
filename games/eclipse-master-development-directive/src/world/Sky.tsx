import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { film } from '../film/runtime';
import { atm, updateAtmosphere } from './atmosphere';

/** Computes atmosphere once per frame and drives scene lights/fog/background. */
export function LightRig() {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const amb = useRef<THREE.AmbientLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const { scene } = useThree();
  useEffect(() => { scene.fog = new THREE.FogExp2('#888', 0.01); scene.background = new THREE.Color('#000'); }, [scene]);
  useFrame(() => {
    const e = film.env;
    updateAtmosphere(e, film.scene?.env ?? 'village', Math.max(e.flash, e.lightning * (Math.random() > 0.4 ? 1 : 0.3)) * 0.8);
    (scene.fog as THREE.FogExp2).color.copy(atm.fog); (scene.fog as THREE.FogExp2).density = atm.fogDensity;
    (scene.background as THREE.Color).copy(atm.skyHor);
    sun.current.color.copy(atm.lightColor); sun.current.intensity = atm.lightIntensity; sun.current.position.copy(atm.lightDir).multiplyScalar(30);
    amb.current.color.copy(atm.ambColor); amb.current.intensity = atm.ambIntensity * 0.95;
    hemi.current.color.copy(atm.skyTop).lerp(atm.ambColor, 0.5); hemi.current.intensity = atm.ambIntensity * 0.8;
  });
  return (<>
    <ambientLight ref={amb} />
    <hemisphereLight ref={hemi} groundColor="#2a2430" />
    <directionalLight ref={sun} castShadow shadow-mapSize={[1536, 1536]} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-camera-near={1} shadow-camera-far={90} shadow-bias={-0.0004} />
  </>);
}

const skyMat = () => new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.1,0.0,1.0); gl_FragColor = vec4(mix(hor, top, pow(h,0.7)),1.0); }',
});

function radialTexture(inner: string, outer: string) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!; const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function Sky() {
  const mat = useMemo(skyMat, []);
  const stars = useRef<THREE.Points>(null!);
  const celestial = useRef<THREE.Group>(null!);
  const moon = useRef<THREE.Group>(null!);
  const sunDisc = useRef<THREE.Mesh>(null!);
  const black = useRef<THREE.Mesh>(null!);
  const corona = useRef<THREE.Mesh>(null!);
  const starGeo = useMemo(() => {
    const n = 1400; const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.95 + 0.02; const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      p[i * 3] = Math.sin(ph) * Math.cos(th) * 300; p[i * 3 + 1] = Math.cos(ph) * 300; p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 300;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g;
  }, []);
  const coronaTex = useMemo(() => radialTexture('rgba(255,230,160,1)', 'rgba(176,77,255,0.55)'), []);
  const { camera } = useThree();
  useFrame(() => {
    const e = film.env.eclipse;
    mat.uniforms.top.value.copy(atm.skyTop); mat.uniforms.hor.value.copy(atm.skyHor);
    (stars.current.material as THREE.PointsMaterial).opacity = atm.stars;
    stars.current.visible = atm.stars > 0.02;
    const d = atm.sunDir; const R = 240;
    celestial.current.position.set(d.x * R + camera.position.x, d.y * R + 10, d.z * R + camera.position.z);
    celestial.current.lookAt(camera.position);
    const vis = !atm.cave;
    celestial.current.visible = vis;
    sunDisc.current.visible = atm.day > 0.12 && e < 0.98;
    (sunDisc.current.material as THREE.MeshBasicMaterial).color.set(atm.day > 0.5 ? '#fff4d0' : '#ff9a55');
    black.current.visible = e > 0.04; (black.current.material as THREE.MeshBasicMaterial).opacity = Math.min(1, e * 1.4);
    corona.current.visible = e > 0.04; (corona.current.material as THREE.MeshBasicMaterial).opacity = Math.min(1, e * 1.3);
    corona.current.scale.setScalar(1 + Math.sin(film.clock * 0.7) * 0.03 + e * 0.2);
    moon.current.position.set(0.55 * R + camera.position.x, 0.5 * R, -0.65 * R + camera.position.z); moon.current.lookAt(camera.position);
    moon.current.visible = vis && atm.night > 0.3 && e < 0.5;
  });
  return (<>
    <mesh scale={[1, 1, 1]} frustumCulled={false} renderOrder={-10}><sphereGeometry args={[400, 24, 16]} /><primitive object={mat} attach="material" /></mesh>
    <points ref={stars} geometry={starGeo} frustumCulled={false}><pointsMaterial size={1.8} sizeAttenuation={false} transparent color="#ffffff" fog={false} depthWrite={false} /></points>
    <group ref={celestial}>
      <mesh ref={sunDisc}><circleGeometry args={[11, 32]} /><meshBasicMaterial toneMapped={false} fog={false} /></mesh>
      <mesh ref={corona} position={[0, 0, 0.5]}><circleGeometry args={[46, 40]} /><meshBasicMaterial map={coronaTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} /></mesh>
      <mesh ref={black} position={[0, 0, 1]}><circleGeometry args={[11.6, 32]} /><meshBasicMaterial color="#000" transparent fog={false} depthWrite={false} /></mesh>
    </group>
    <group ref={moon}><mesh><circleGeometry args={[8, 28]} /><meshBasicMaterial color="#dfe8ff" toneMapped={false} fog={false} /></mesh></group>
  </>);
}

export function Weather() {
  const rain = useRef<THREE.LineSegments>(null!);
  const ash = useRef<THREE.Points>(null!);
  const { camera } = useThree();
  const N = 1800, M = 900;
  const rainData = useMemo(() => {
    const p = new Float32Array(N * 6); const base = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { base[i * 3] = (Math.random() - 0.5) * 50; base[i * 3 + 1] = Math.random() * 22; base[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return { g, base };
  }, []);
  const ashData = useMemo(() => {
    const p = new Float32Array(M * 3); const base = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) { base[i * 3] = (Math.random() - 0.5) * 44; base[i * 3 + 1] = Math.random() * 16; base[i * 3 + 2] = (Math.random() - 0.5) * 44; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return { g, base };
  }, []);
  useFrame((_, dt) => {
    const w = film.env.weather; const t = film.clock;
    const interior = film.scene?.env === 'caverns';
    const wantRain = !interior && (w === 'rain' || w === 'storm');
    const wantAsh = !interior && w === 'ash';
    rain.current.visible = wantRain; ash.current.visible = wantAsh;
    if (wantRain) {
      const pos = rainData.g.attributes.position as THREE.BufferAttribute; const b = rainData.base; const sp = w === 'storm' ? 26 : 18;
      for (let i = 0; i < N; i++) {
        b[i * 3 + 1] -= sp * dt; if (b[i * 3 + 1] < 0) b[i * 3 + 1] += 22;
        const x = b[i * 3] + camera.position.x, y = b[i * 3 + 1], z = b[i * 3 + 2] + camera.position.z;
        pos.setXYZ(i * 2, x, y, z); pos.setXYZ(i * 2 + 1, x - 0.06, y + 0.55, z);
      }
      pos.needsUpdate = true;
    }
    if (wantAsh) {
      const pos = ashData.g.attributes.position as THREE.BufferAttribute; const b = ashData.base;
      for (let i = 0; i < M; i++) {
        b[i * 3 + 1] -= (0.9 + (i % 5) * 0.12) * dt; if (b[i * 3 + 1] < 0) b[i * 3 + 1] += 16;
        pos.setXYZ(i, b[i * 3] + camera.position.x + Math.sin(t * 0.6 + i) * 0.6, b[i * 3 + 1], b[i * 3 + 2] + camera.position.z + Math.cos(t * 0.5 + i * 1.7) * 0.5);
      }
      pos.needsUpdate = true;
    }
  });
  return (<>
    <lineSegments ref={rain} geometry={rainData.g} frustumCulled={false}><lineBasicMaterial color="#b8cfe6" transparent opacity={0.45} depthWrite={false} /></lineSegments>
    <points ref={ash} geometry={ashData.g} frustumCulled={false}><pointsMaterial color="#d8c8b8" size={0.1} transparent opacity={0.75} depthWrite={false} /></points>
  </>);
}
