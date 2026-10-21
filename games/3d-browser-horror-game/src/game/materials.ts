import * as THREE from 'three';
import { getTexture } from './textures';

interface MatDef {
  tex?: string;
  color?: number;
  rough?: number;
  metal?: number;
  tile?: number; // world meters per texture repeat
  emissive?: number;
  emissiveIntensity?: number;
}

const D: Record<string, MatDef> = {
  // structure
  wood_dark: { tex: 'wood_dark', rough: 0.72, tile: 2 },
  wood_light: { tex: 'wood_light', rough: 0.7, tile: 2 },
  wood_old: { tex: 'wood_old', rough: 0.85, tile: 2 },
  carpet_red: { tex: 'carpet_red', rough: 1, tile: 2 },
  carpet_green: { tex: 'carpet_green', rough: 1, tile: 2 },
  carpet_cream: { tex: 'carpet_cream', rough: 1, tile: 2 },
  tile_bath: { tex: 'tile_bath', rough: 0.35, tile: 2 },
  tile_kitchen: { tex: 'tile_kitchen', rough: 0.4, tile: 2 },
  tile_checker: { tex: 'tile_checker', rough: 0.3, tile: 2 },
  concrete: { tex: 'concrete', rough: 0.95, tile: 2 },
  wp_green: { tex: 'wp_green', rough: 0.95, tile: 2 },
  wp_red: { tex: 'wp_red', rough: 0.95, tile: 2 },
  wp_beige: { tex: 'wp_beige', rough: 0.95, tile: 2 },
  wp_blue: { tex: 'wp_blue', rough: 0.95, tile: 2 },
  wp_pink: { tex: 'wp_pink', rough: 0.95, tile: 2 },
  wp_purple: { tex: 'wp_purple', rough: 0.95, tile: 2 },
  wp_hall: { tex: 'wp_hall', rough: 0.95, tile: 2 },
  plaster: { tex: 'plaster', rough: 1, tile: 2 },
  tile_wall: { tex: 'tile_wall', rough: 0.3, tile: 2 },
  wood_panel: { tex: 'wood_panel', rough: 0.6, tile: 2 },
  ceiling: { tex: 'ceiling', rough: 1, tile: 2 },
  // furniture
  wood: { tex: 'furn_wood', rough: 0.7, tile: 1 },
  woodL: { tex: 'furn_wood_light', rough: 0.7, tile: 1 },
  woodB: { tex: 'furn_wood_black', rough: 0.5, tile: 1 },
  fabR: { tex: 'fabric_red', rough: 1, tile: 1 },
  fabG: { tex: 'fabric_green', rough: 1, tile: 1 },
  fabB: { tex: 'fabric_blue', rough: 1, tile: 1 },
  fabC: { tex: 'fabric_cream', rough: 1, tile: 1 },
  fabBr: { tex: 'fabric_brown', rough: 0.85, tile: 1 },
  rugA: { tex: 'carpet_red', rough: 1, tile: 1.6, color: 0xffffff },
  rugB: { tex: 'carpet_green', rough: 1, tile: 1.6 },
  rugC: { tex: 'carpet_cream', rough: 1, tile: 1.6, color: 0xb9a090 },
  stone: { tex: 'plaster', rough: 0.95, tile: 1, color: 0xaaaaaa },
  metal: { color: 0x3a3d40, rough: 0.45, metal: 0.8 },
  iron: { color: 0x1d1d1f, rough: 0.5, metal: 0.7 },
  steel: { color: 0x8a8f94, rough: 0.35, metal: 0.85 },
  brass: { color: 0xb08d3a, rough: 0.35, metal: 0.9 },
  white: { color: 0xc8c6bb, rough: 0.28 },
  cream: { color: 0xbdb393, rough: 0.4 },
  paper: { color: 0xd8d0b4, rough: 0.9 },
  black: { color: 0x101012, rough: 0.55 },
  blood: { color: 0x4a0707, rough: 0.25 },
  water: { color: 0x3b0606, rough: 0.08, metal: 0.25 },
  mirror: { color: 0x2c343c, rough: 0.05, metal: 0.9 },
  book1: { color: 0x5a1c1c, rough: 0.8 },
  book2: { color: 0x1c3a5a, rough: 0.8 },
  book3: { color: 0x2c4a2a, rough: 0.8 },
  book4: { color: 0x6a5a30, rough: 0.8 },
  book5: { color: 0x2a2a2e, rough: 0.8 },
  ember: { color: 0x331100, emissive: 0xff5a1a, emissiveIntensity: 1.8, rough: 1 },
  curtain: { tex: 'fabric_red', rough: 1, tile: 1, color: 0x9a7070 },
  door: { tex: 'door', rough: 0.7, tile: 1 },
  jar: { color: 0x6a7a5a, rough: 0.2, metal: 0.1 },
  paint0: { tex: 'paint0', rough: 0.8, tile: 1 },
  paint1: { tex: 'paint1', rough: 0.8, tile: 1 },
  paint2: { tex: 'paint2', rough: 0.8, tile: 1 },
  rust: { color: 0x5a3b26, rough: 0.6, metal: 0.7 },
  food: { color: 0x7a5a3a, rough: 0.8 },
};

const cache = new Map<string, THREE.Material>();
export const TILE: Record<string, number> = {};
for (const k of Object.keys(D)) TILE[k] = D[k].tile ?? 1;

let glass: THREE.MeshBasicMaterial | null = null;
export function getGlass(): THREE.MeshBasicMaterial {
  if (!glass) {
    glass = new THREE.MeshBasicMaterial({
      color: 0x070b14,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
  }
  return glass;
}

export function getMat(key: string): THREE.Material {
  if (key === 'glass') return getGlass();
  let m = cache.get(key);
  if (!m) {
    const d = D[key];
    if (!d) throw new Error('unknown material ' + key);
    m = new THREE.MeshStandardMaterial({
      map: d.tex ? getTexture(d.tex) : null,
      color: d.color ?? 0xffffff,
      roughness: d.rough ?? 0.8,
      metalness: d.metal ?? 0,
      emissive: d.emissive ?? 0x000000,
      emissiveIntensity: d.emissiveIntensity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

export function cloneMat(key: string): THREE.MeshStandardMaterial {
  return (getMat(key) as THREE.MeshStandardMaterial).clone();
}

export function disposeMaterials() {
  cache.forEach((m) => m.dispose());
  cache.clear();
  glass?.dispose();
  glass = null;
}

// ---------------------------------------------------------------- geometry helpers with world-scaled UVs
export function boxGeo(w: number, h: number, d: number, tile = 1): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // face order: +x, -x, +y, -y, +z, -z ; each 4 vertices
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  }
  uv.needsUpdate = true;
  return g;
}

export function planeGeo(w: number, h: number, tile = 1): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  uv.needsUpdate = true;
  return g;
}

export function cylGeo(rt: number, rb: number, h: number, seg = 12, tile = 1): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const circ = Math.PI * 2 * Math.max(rt, rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / tile, (uv.getY(i) * h) / tile);
  uv.needsUpdate = true;
  return g;
}
