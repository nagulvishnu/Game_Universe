import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const N = 260;
const NR = 8;

interface FxState {
  pos: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; size: Float32Array; grav: Float32Array;
  col: Float32Array; dirty: boolean; cursor: number;
  rings: { x: number; y: number; z: number; t: number; max: number; color: string; size: number }[];
}
const S: FxState = {
  pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), size: new Float32Array(N),
  grav: new Float32Array(N), col: new Float32Array(N * 3), dirty: false, cursor: 0, rings: [],
};
const c = new THREE.Color();

/** Pooled particle emitter (object pool, no per-frame allocations). */
export const fx = {
  burst(x: number, y: number, z: number, color: string, count: number, speed: number, size = 0.14, life = 0.6, grav = 6) {
    c.set(color);
    for (let n = 0; n < count; n++) {
      const i = S.cursor; S.cursor = (S.cursor + 1) % N;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.1, sp = speed * (0.4 + Math.random() * 0.8);
      S.pos[i * 3] = x; S.pos[i * 3 + 1] = y; S.pos[i * 3 + 2] = z;
      S.vel[i * 3] = Math.cos(a) * sp; S.vel[i * 3 + 1] = e * sp * 0.8; S.vel[i * 3 + 2] = Math.sin(a) * sp;
      S.life[i] = S.max[i] = life * (0.6 + Math.random() * 0.6); S.size[i] = size * (0.6 + Math.random() * 0.8); S.grav[i] = grav;
      S.col[i * 3] = c.r; S.col[i * 3 + 1] = c.g; S.col[i * 3 + 2] = c.b;
    }
    S.dirty = true;
  },
  trail(x: number, y: number, z: number, color: string) {
    c.set(color);
    const i = S.cursor; S.cursor = (S.cursor + 1) % N;
    S.pos[i * 3] = x; S.pos[i * 3 + 1] = y; S.pos[i * 3 + 2] = z;
    S.vel[i * 3] = 0; S.vel[i * 3 + 1] = 0.2; S.vel[i * 3 + 2] = 0;
    S.life[i] = S.max[i] = 0.35; S.size[i] = 0.16; S.grav[i] = 0;
    S.col[i * 3] = c.r; S.col[i * 3 + 1] = c.g; S.col[i * 3 + 2] = c.b;
    S.dirty = true;
  },
  ring(x: number, y: number, z: number, color: string, size = 5, max = 0.6) {
    if (S.rings.length >= NR) S.rings.shift();
    S.rings.push({ x, y, z, t: 0, max, color, size });
  },
  clear() { S.life.fill(0); S.rings.length = 0; },
};

export function FxLayer() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const ringGroup = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), []);
  const ringMats = useMemo(() => Array.from({ length: NR }, () => new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), []);

  useEffect(() => {
    const m = mesh.current!;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    return () => { geo.dispose(); mat.dispose(); ringGeo.dispose(); ringMats.forEach((r) => r.dispose()); };
  }, [geo, mat, ringGeo, ringMats]);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < N; i++) {
      if (S.life[i] > 0) {
        S.life[i] -= dt;
        S.vel[i * 3 + 1] -= S.grav[i] * dt;
        S.pos[i * 3] += S.vel[i * 3] * dt; S.pos[i * 3 + 1] += S.vel[i * 3 + 1] * dt; S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
        const k = Math.max(0, S.life[i] / S.max[i]);
        dummy.position.set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]);
        dummy.scale.setScalar(S.size[i] * k);
      } else dummy.scale.setScalar(0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (S.dirty && m.instanceColor) { (m.instanceColor.array as Float32Array).set(S.col); m.instanceColor.needsUpdate = true; S.dirty = false; }
    const g = ringGroup.current;
    if (g) {
      for (let i = 0; i < NR; i++) {
        const mesh2 = g.children[i] as THREE.Mesh;
        const r = S.rings[i];
        if (!r) { mesh2.visible = false; continue; }
        r.t += dt;
        const k = r.t / r.max;
        if (k >= 1) { S.rings.splice(i, 1); mesh2.visible = false; continue; }
        mesh2.visible = true;
        mesh2.position.set(r.x, r.y, r.z);
        mesh2.scale.setScalar(0.2 + k * r.size);
        const mm = ringMats[i];
        mm.color.set(r.color);
        mm.opacity = (1 - k) * 0.9;
      }
    }
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
      <group ref={ringGroup}>
        {ringMats.map((rm, i) => <mesh key={i} geometry={ringGeo} material={rm} visible={false} frustumCulled={false} />)}
      </group>
    </>
  );
}
