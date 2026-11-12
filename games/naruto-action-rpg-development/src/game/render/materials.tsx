import { useLayoutEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';

const gradData = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
export const toonGrad = (() => { const t = new THREE.DataTexture(gradData, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const sharedToon = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGrad });
const cache = new Map<string, THREE.MeshToonMaterial>();
export const toonMat = (c: string, emissive?: string) => {
  const k = c + (emissive ?? ''); let m = cache.get(k);
  if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad }); if (emissive) m.emissive = new THREE.Color(emissive); cache.set(k, m); }
  return m;
};

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 10, 8),
  ico: new THREE.IcosahedronGeometry(1, 1),
  dome: new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  plane: new THREE.PlaneGeometry(1, 1),
  circle: new THREE.CircleGeometry(1, 32),
  ring: new THREE.RingGeometry(0.92, 1, 40),
};

export interface Item { p: [number, number, number]; s: [number, number, number]; c: string; ry?: number; rx?: number; rz?: number }

/** Static InstancedMesh with per-instance colour; built once. */
export function Inst({ geo, items, mat = sharedToon, cast = true, receive = true }: { geo: THREE.BufferGeometry; items: Item[]; mat?: THREE.Material; cast?: boolean; receive?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return; const d = new THREE.Object3D(); const col = new THREE.Color();
    items.forEach((it, i) => {
      d.position.set(...it.p); d.scale.set(...it.s); d.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, col.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={cast} receiveShadow={receive} frustumCulled={false} />;
}

export function useItems<T>(fn: () => T, deps: unknown[] = []): T { return useMemo(fn, deps); } // eslint-disable-line react-hooks/exhaustive-deps

// ---- stylised water shader (fog aware)
export function makeWaterMaterial(a: string, b: string) {
  return new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } }]),
    vertexShader: `uniform float uTime; varying vec3 vPos;
      #include <fog_pars_vertex>
      void main(){ vec3 p = position; p.z += sin(p.x*0.22+uTime)*0.07 + cos(p.y*0.27+uTime*1.3)*0.07; vPos = p;
        vec4 mvPosition = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
 }`,
    fragmentShader: `uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying vec3 vPos;
      #include <fog_pars_fragment>
      void main(){ float w = sin(vPos.x*0.5+uTime*1.1)*0.5 + sin(vPos.y*0.7-uTime*0.9)*0.5;
        float foam = smoothstep(0.88, 1.0, sin(vPos.x*1.2+vPos.y*0.9+uTime*1.4)*0.5 + 0.5*w + 0.3);
        vec3 c = mix(uA, uB, 0.5+0.5*w) + foam*0.22; gl_FragColor = vec4(c, 0.9);
        #include <fog_fragment>
 }`,
  });
}
