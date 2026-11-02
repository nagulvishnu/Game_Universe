import * as THREE from 'three';

let grad: THREE.DataTexture | null = null;
export function gradientMap() {
  if (!grad) {
    const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
    grad = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
  }
  return grad;
}

const mats = new Map<string, THREE.Material>();
const geos = new Map<string, THREE.BufferGeometry>();

export function toon(color: string | number, opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; side?: THREE.Side } = {}) {
  const key = `t${color}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? ''}|${opts.opacity ?? ''}|${opts.side ?? ''}`;
  let m = mats.get(key);
  if (!m) {
    const params: THREE.MeshToonMaterialParameters = { color: new THREE.Color(color), gradientMap: gradientMap() };
    if (opts.emissive) { params.emissive = new THREE.Color(opts.emissive); params.emissiveIntensity = opts.emissiveIntensity ?? 1; }
    if (opts.transparent || opts.opacity !== undefined) { params.transparent = true; params.opacity = opts.opacity ?? 1; }
    if (opts.side !== undefined) params.side = opts.side;
    m = new THREE.MeshToonMaterial(params);
    mats.set(key, m);
  }
  return m as THREE.MeshToonMaterial;
}
export function basic(color: string | number, opts: { transparent?: boolean; opacity?: number; additive?: boolean; side?: THREE.Side; depthWrite?: boolean } = {}) {
  const key = `b${color}|${opts.opacity ?? ''}|${opts.additive ?? ''}|${opts.side ?? ''}|${opts.depthWrite ?? ''}`;
  let m = mats.get(key);
  if (!m) {
    const params: THREE.MeshBasicMaterialParameters = { color: new THREE.Color(color), toneMapped: false, depthWrite: opts.depthWrite ?? true };
    if (opts.transparent || opts.opacity !== undefined) { params.transparent = true; params.opacity = opts.opacity ?? 1; }
    if (opts.additive) params.blending = THREE.AdditiveBlending;
    if (opts.side !== undefined) params.side = opts.side;
    m = new THREE.MeshBasicMaterial(params);
    mats.set(key, m);
  }
  return m as THREE.MeshBasicMaterial;
}
export const outlineMat = () => {
  let m = mats.get('outline');
  if (!m) { m = new THREE.MeshBasicMaterial({ color: 0x0b0b14, side: THREE.BackSide }); mats.set('outline', m); }
  return m;
};

export function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g;
}

export function disposeCaches() {
  mats.forEach((m) => m.dispose()); mats.clear();
  geos.forEach((g) => g.dispose()); geos.clear();
  grad?.dispose(); grad = null;
}
