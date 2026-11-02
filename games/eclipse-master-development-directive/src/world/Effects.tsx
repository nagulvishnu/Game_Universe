// Pooled visual effects (rings, bursts, slash arcs, beams, light pillars) and a GPU-friendly spark system.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { film } from '../film/runtime';

const mk = () => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
function useMats(n: number) { return useMemo(() => Array.from({ length: n }, mk), [n]); }

export function Effects() {
  const { camera } = useThree();
  const rings = useRef<THREE.Mesh[]>([]), bursts = useRef<THREE.Mesh[]>([]), arcs = useRef<THREE.Mesh[]>([]), beams = useRef<THREE.Mesh[]>([]), pillars = useRef<THREE.Mesh[]>([]);
  const rm = useMats(20), bm = useMats(20), am = useMats(14), em = useMats(10), pm = useMats(8);
  const ringG = useMemo(() => new THREE.RingGeometry(0.82, 1, 40), []);
  const arcG = useMemo(() => new THREE.RingGeometry(0.6, 1, 28, 1, 0, Math.PI * 0.85), []);
  const beamG = useMemo(() => { const g = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); g.rotateX(Math.PI / 2); return g; }, []);
  const pilG = useMemo(() => new THREE.CylinderGeometry(1, 1, 7, 16, 1, true), []);
  // sparks
  const N = 900;
  const sp = useMemo(() => {
    const pos = new Float32Array(N * 3).fill(-999), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { g, pos, col, vel, life, head: 0 };
  }, []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05) * film.timeScale;
    const used = { ring: 0, burst: 0, arc: 0, beam: 0, pillar: 0 };
    for (const f of film.fx) {
      const u = Math.min(1, f.t / f.dur); const fade = 1 - u;
      if (f.kind === 'ring') {
        const i = used.ring++; const m = rings.current[i]; if (!m) continue; m.visible = true; m.position.set(f.x, f.y, f.z);
        if (f.y < 0.5) m.rotation.set(-Math.PI / 2, 0, 0); else m.lookAt(camera.position);
        m.scale.setScalar(f.size * (0.1 + u * 0.9)); rm[i].color.set(f.color); rm[i].opacity = fade * 0.9;
      } else if (f.kind === 'burst') {
        const i = used.burst++; const m = bursts.current[i]; if (!m) continue; m.visible = true; m.position.set(f.x, f.y, f.z); m.scale.setScalar(f.size * (0.25 + u * 0.75)); bm[i].color.set(f.color); bm[i].opacity = fade * 0.8;
      } else if (f.kind === 'arc') {
        const i = used.arc++; const m = arcs.current[i]; if (!m) continue; m.visible = true;
        m.position.set(f.x2 ?? f.x, f.y + 0.1, f.z2 ?? f.z); m.rotation.set(0, f.yaw, 0.7 + (i % 3) * 0.9); m.rotateZ(-0.5 + u * 1.4);
        m.scale.setScalar(f.size * (0.6 + u * 0.7)); am[i].color.set(f.color); am[i].opacity = fade;
      } else if (f.kind === 'beam') {
        const i = used.beam++; const m = beams.current[i]; if (!m || f.x2 === undefined || f.z2 === undefined) continue; m.visible = true;
        const len = Math.hypot(f.x2 - f.x, f.z2 - f.z); m.position.set((f.x + f.x2) / 2, f.y, (f.z + f.z2) / 2); m.lookAt(f.x2, f.y, f.z2);
        m.scale.set(f.size * fade, f.size * fade, len); em[i].color.set(f.color); em[i].opacity = fade * 0.9;
      } else if (f.kind === 'pillar') {
        const i = used.pillar++; const m = pillars.current[i]; if (!m) continue; m.visible = true; m.position.set(f.x, f.y + 3.5, f.z); m.scale.set(f.size * (1 - u * 0.5), 1 + u, f.size * (1 - u * 0.5)); pm[i].color.set(f.color); pm[i].opacity = fade * 0.55;
      }
    }
    rings.current.forEach((m, i) => { if (i >= used.ring && m) m.visible = false; });
    bursts.current.forEach((m, i) => { if (i >= used.burst && m) m.visible = false; });
    arcs.current.forEach((m, i) => { if (i >= used.arc && m) m.visible = false; });
    beams.current.forEach((m, i) => { if (i >= used.beam && m) m.visible = false; });
    pillars.current.forEach((m, i) => { if (i >= used.pillar && m) m.visible = false; });
    // sparks
    while (film.sparks.length) {
      const s = film.sparks.shift()!; tmp.set(s.color);
      for (let k = 0; k < s.n; k++) {
        const i = sp.head; sp.head = (sp.head + 1) % N;
        const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), v = s.speed * (0.3 + Math.random());
        sp.pos[i * 3] = s.x; sp.pos[i * 3 + 1] = s.y; sp.pos[i * 3 + 2] = s.z;
        sp.vel[i * 3] = Math.sin(ph) * Math.cos(th) * v; sp.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * v * 0.8 + 1; sp.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * v;
        sp.col[i * 3] = tmp.r; sp.col[i * 3 + 1] = tmp.g; sp.col[i * 3 + 2] = tmp.b; sp.life[i] = 0.5 + Math.random() * 0.9;
      }
    }
    for (let i = 0; i < N; i++) {
      if (sp.life[i] <= 0) continue;
      sp.life[i] -= dt; if (sp.life[i] <= 0) { sp.pos[i * 3 + 1] = -999; continue; }
      sp.vel[i * 3 + 1] -= 9 * dt;
      sp.pos[i * 3] += sp.vel[i * 3] * dt; sp.pos[i * 3 + 1] += sp.vel[i * 3 + 1] * dt; sp.pos[i * 3 + 2] += sp.vel[i * 3 + 2] * dt;
      if (sp.pos[i * 3 + 1] < 0.02) { sp.pos[i * 3 + 1] = 0.02; sp.vel[i * 3 + 1] *= -0.3; }
    }
    (sp.g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (sp.g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  });

  return (<>
    {rm.map((m, i) => <mesh key={`r${i}`} ref={(r) => { if (r) rings.current[i] = r; }} geometry={ringG} material={m} visible={false} frustumCulled={false} />)}
    {bm.map((m, i) => <mesh key={`b${i}`} ref={(r) => { if (r) bursts.current[i] = r; }} material={m} visible={false} frustumCulled={false}><sphereGeometry args={[1, 14, 10]} /></mesh>)}
    {am.map((m, i) => <mesh key={`a${i}`} ref={(r) => { if (r) arcs.current[i] = r; }} geometry={arcG} material={m} visible={false} frustumCulled={false} />)}
    {em.map((m, i) => <mesh key={`e${i}`} ref={(r) => { if (r) beams.current[i] = r; }} geometry={beamG} material={m} visible={false} frustumCulled={false} />)}
    {pm.map((m, i) => <mesh key={`p${i}`} ref={(r) => { if (r) pillars.current[i] = r; }} geometry={pilG} material={m} visible={false} frustumCulled={false} />)}
    <points geometry={sp.g} frustumCulled={false}><pointsMaterial size={0.16} vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></points>
  </>);
}
