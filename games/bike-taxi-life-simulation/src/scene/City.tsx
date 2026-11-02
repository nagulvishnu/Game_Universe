import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DISTRICTS, FLYOVER, flyoverHeight, lots, lotsByBlock, neighbors, NXB, NXN, NZB, NZN, P, PARKS, pois, RW, WORLD_D, WORLD_W, districtOfBlock, type Lot } from '../game/world/city';
import type { PoiKind } from '../game/types';
import { mulberry32 } from '../game/util';
import { rt } from '../game/runtime';
import { useGame } from '../game/store';

const TILE_W = 14.4, TILE_H = 13.6;

function makeWindowTextures() {
  const mk = (lit: boolean) => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = lit ? '#000' : '#f4f1ea'; g.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(5);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
      const x = q * 64 + 12, y = r * 64 + 14, w = 40, h = 34;
      if (r === 0 && q === 0) { /* keep plain pixel region top-left for roofs */ }
      if (lit) { if (rnd() < 0.5) { g.fillStyle = rnd() < 0.7 ? '#ffd98a' : '#bfe3ff'; g.fillRect(x, y, w, h); } }
      else { g.fillStyle = '#334155'; g.fillRect(x, y, w, h); g.fillStyle = '#64748b'; g.fillRect(x, y, w, 6); g.fillStyle = '#8a8f98'; g.fillRect(q * 64, r * 64 + 52, 64, 5); }
    }
    if (!lit) { g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 10, 10); } else { g.fillStyle = '#000'; g.fillRect(0, 0, 10, 10); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  return { map: mk(false), emissive: mk(true) };
}

function boxGeo(x0: number, z0: number, x1: number, z1: number, h: number, color: THREE.Color, y0 = 0): THREE.BufferGeometry {
  const w = x1 - x0, d = z1 - z0;
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2), col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const nx = nor.getX(i), ny = nor.getY(i);
    let u: number, v: number, k = 1;
    if (Math.abs(ny) > 0.5) { u = 0.012; v = 0.988; k = ny > 0 ? 0.78 : 0.5; }
    else if (Math.abs(nx) > 0.5) { u = pos.getZ(i) / TILE_W; v = pos.getY(i) / TILE_H; k = 0.92; }
    else { u = pos.getX(i) / TILE_W; v = pos.getY(i) / TILE_H; }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
    col[i * 3] = color.r * k; col[i * 3 + 1] = color.g * k; col[i * 3 + 2] = color.b * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function solidGeo(g: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const n = g.attributes.position.count;
  const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { uv[i * 2] = 0.012; uv[i * 2 + 1] = 0.988; col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.index) return g;
  const converted = g.toNonIndexed();
  g.dispose();
  return converted;
}

function lotGeometries(l: Lot, rnd: () => number): THREE.BufferGeometry[] {
  const col = new THREE.Color(l.color);
  const out: THREE.BufferGeometry[] = [];
  const nonIdx = (g: THREE.BufferGeometry) => {
    if (!g.index) return g;
    const converted = g.toNonIndexed();
    g.dispose();
    return converted;
  };
  if (l.open) return out;
  const stepped = l.h > 40 && l.district !== 'airport';
  if (stepped) {
    const inset = 3;
    out.push(nonIdx(boxGeo(l.x0, l.z0, l.x1, l.z1, l.h * 0.7, col)));
    out.push(nonIdx(boxGeo(l.x0 + inset, l.z0 + inset, l.x1 - inset, l.z1 - inset, l.h * 0.3, col.clone().multiplyScalar(0.95), l.h * 0.7)));
  } else out.push(nonIdx(boxGeo(l.x0, l.z0, l.x1, l.z1, l.h, col)));
  const top = l.h;
  // rooftop details
  const rx = l.x0 + 4 + rnd() * (l.x1 - l.x0 - 12), rz = l.z0 + 4 + rnd() * (l.z1 - l.z0 - 12);
  out.push(nonIdx(boxGeo(rx, rz, rx + 4, rz + 3, 2.4, new THREE.Color(0x9aa0a6), top)));
  if (l.district === 'industrial') {
    const g = new THREE.CylinderGeometry(1.4, 1.9, 22, 10); g.translate(l.x1 - 4, top + 11 - 2, l.z0 + 5);
    out.push(solidGeo(g, new THREE.Color(0x8d6e63)));
    const g2 = new THREE.CylinderGeometry(1.3, 1.7, 18, 10); g2.translate(l.x1 - 9, top + 9 - 2, l.z0 + 5);
    out.push(solidGeo(g2, new THREE.Color(0xa1887f)));
  }
  if (l.district === 'central' || l.district === 'it') {
    if (l.h > 50) { const g = new THREE.CylinderGeometry(0.15, 0.25, 12, 6); g.translate((l.x0 + l.x1) / 2, top + 6, (l.z0 + l.z1) / 2); out.push(solidGeo(g, new THREE.Color(0xdddddd))); }
  }
  // ground-floor awning band (shops) facing the street
  const north = l.k < 2 && l.district !== 'airport';
  const az0 = north ? l.z0 - 1.6 : l.z1, az1 = north ? l.z0 : l.z1 + 1.6;
  if (l.district !== 'industrial' && l.district !== 'airport') out.push(nonIdx(boxGeo(l.x0 + 3, az0, l.x1 - 3, az1, 0.5, new THREE.Color([0xd9534f, 0x2e86de, 0xf39c12, 0x27ae60][Math.floor(rnd() * 4)]), 3.3)));
  if (l.district === 'residential' && l.h > 14) {
    const front = north ? l.z0 - 1.25 : l.z1 + 0.25;
    const back = north ? l.z0 - 0.25 : l.z1 + 1.25;
    const balcony = new THREE.Color(0xe5ded2);
    for (let y = 5; y < Math.min(l.h - 2, 24); y += 6) {
      out.push(nonIdx(boxGeo(l.x0 + 5, front, l.x1 - 5, back, 0.18, balcony, y)));
      const railZ0 = north ? front : back - 0.12;
      const railZ1 = north ? railZ0 + 0.12 : back;
      out.push(nonIdx(boxGeo(l.x0 + 5, railZ0, l.x1 - 5, railZ1, 0.72, balcony.clone().multiplyScalar(0.9), y + 0.18)));
      out.push(nonIdx(boxGeo(l.x0 + 5, front, l.x0 + 5.12, back, 0.75, balcony, y + 0.18)));
      out.push(nonIdx(boxGeo(l.x1 - 5.12, front, l.x1 - 5, back, 0.75, balcony, y + 0.18)));
    }
    if (l.h > 20) {
      const tank = new THREE.CylinderGeometry(1.1, 1.1, 2.4, 10);
      tank.translate(l.x1 - 6, l.h + 1.2, l.z1 - 6);
      out.push(solidGeo(tank, new THREE.Color(0x64748b)));
    }
  }
  return out;
}

export function makeSignTexture(text: string, bg: string, fg = '#fff', w = 512, h = 128, sub?: string) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${sub ? 52 : 60}px system-ui, sans-serif`;
  let t = text; while (g.measureText(t).width > w - 40 && t.length > 4) t = t.slice(0, -2);
  g.fillText(t, w / 2, sub ? h * 0.36 : h / 2);
  if (sub) { g.font = '600 30px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(sub, w / 2, h * 0.76); }
  const t2 = new THREE.CanvasTexture(c); t2.colorSpace = THREE.SRGBColorSpace;
  return t2;
}

function asphaltTexture(dashes: boolean) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(dashes ? 8061 : 4187);
  g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 600; i++) {
    const shade = Math.floor(45 + rnd() * 45);
    g.fillStyle = `rgba(${shade},${shade},${shade},${0.04 + rnd() * 0.05})`;
    g.fillRect(rnd() * 128, rnd() * 64, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  g.fillStyle = 'rgba(20,22,25,.22)';
  g.fillRect(0, 10, 128, 1); g.fillRect(0, 53, 128, 1);
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 2, 128, 2); g.fillRect(0, 60, 128, 2);
  if (dashes) { g.fillStyle = '#e8bd49'; g.fillRect(8, 30, 38, 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function City() {
  const { map, emissive } = useMemo(makeWindowTextures, []);
  const bMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, map, emissiveMap: emissive, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0, roughness: 0.85, metalness: 0.05 }), [map, emissive]);
  const roadTex = useMemo(() => asphaltTexture(true), []);
  const roadMat = useMemo(() => new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92, metalness: 0.0 }), [roadTex]);
  const plainRoad = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.92 }), []);
  const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: new THREE.Color('#ffe9a0'), emissiveIntensity: 0 }), []);
  const poolMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), []);

  // merged building geometry per block
  const blockMeshes = useMemo(() => {
    const rnd = mulberry32(77);
    const arr: { key: string; geo: THREE.BufferGeometry }[] = [];
    for (const [key, ls] of lotsByBlock) {
      const gs: THREE.BufferGeometry[] = [];
      ls.forEach((l) => gs.push(...lotGeometries(l, rnd)));
      if (gs.length) { const m = mergeGeometries(gs, false); if (m) { m.computeBoundingSphere(); arr.push({ key, geo: m }); } gs.forEach((g) => g.dispose()); }
    }
    return arr;
  }, []);

  useEffect(() => () => {
    blockMeshes.forEach(({ geo }) => geo.dispose());
    map.dispose(); emissive.dispose(); roadTex.dispose();
    bMat.dispose(); roadMat.dispose(); plainRoad.dispose(); lampMat.dispose(); poolMat.dispose();
  }, [blockMeshes, map, emissive, roadTex, bMat, roadMat, plainRoad, lampMat, poolMat]);

  // slabs
  const slabRef = useRef<THREE.InstancedMesh>(null);
  const sidewalkRef = useRef<THREE.InstancedMesh>(null);
  const roadsH = useMemo(() => Array.from({ length: NZN }, (_, j) => j), []);
  const roadsV = useMemo(() => Array.from({ length: NXN }, (_, i) => i), []);
  const sidewalks = useMemo(() => {
    const out: { x: number; z: number; horizontal: boolean; district: string }[] = [];
    for (let j = 0; j < NZB; j++) for (let i = 0; i < NXB; i++) {
      const district = districtOfBlock(i, j);
      const cx = i * P + P / 2, cz = j * P + P / 2;
      out.push(
        { x: cx, z: j * P + RW / 2 + 1.7, horizontal: true, district },
        { x: cx, z: (j + 1) * P - RW / 2 - 1.7, horizontal: true, district },
        { x: i * P + RW / 2 + 1.7, z: cz, horizontal: false, district },
        { x: (i + 1) * P - RW / 2 - 1.7, z: cz, horizontal: false, district },
      );
    }
    return out;
  }, []);
  const interRef = useRef<THREE.InstancedMesh>(null);
  const zebraRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const lampRef = useRef<THREE.InstancedMesh>(null);
  const poolRef = useRef<THREE.InstancedMesh>(null);
  const puddleRef = useRef<THREE.InstancedMesh>(null);

  const props = useMemo(() => {
    const rnd = mulberry32(31);
    const trees: { x: number; z: number; s: number; palm: boolean; c: number }[] = [];
    const lamps: { x: number; z: number; r: number }[] = [];
    for (let j = 0; j < NZB; j++) for (let i = 0; i < NXB; i++) {
      const d = districtOfBlock(i, j);
      const park = PARKS.has(`${i},${j}`);
      const x0 = i * P + RW / 2 + 2.2, x1 = (i + 1) * P - RW / 2 - 2.2, z0 = j * P + RW / 2 + 2.2, z1 = (j + 1) * P - RW / 2 - 2.2;
      const step = park ? 9 : 15;
      if (d !== 'airport' && d !== 'industrial' || park) {
        for (let t = 10; t < x1 - x0 - 8; t += step) {
          if (rnd() < 0.8) { trees.push({ x: x0 + t, z: z0, s: 0.8 + rnd() * 0.6, palm: d === 'coastal', c: rnd() }); }
          if (rnd() < 0.8) { trees.push({ x: x0 + t, z: z1, s: 0.8 + rnd() * 0.6, palm: d === 'coastal', c: rnd() }); }
        }
        for (let t = 10; t < z1 - z0 - 8; t += step) {
          if (rnd() < 0.8) trees.push({ x: x0, z: z0 + t, s: 0.8 + rnd() * 0.6, palm: d === 'coastal', c: rnd() });
          if (rnd() < 0.8) trees.push({ x: x1, z: z0 + t, s: 0.8 + rnd() * 0.6, palm: d === 'coastal', c: rnd() });
        }
      }
      if (park) for (let q = 0; q < 40; q++) trees.push({ x: x0 + 8 + rnd() * (x1 - x0 - 16), z: z0 + 8 + rnd() * (z1 - z0 - 16), s: 1 + rnd() * 0.8, palm: false, c: rnd() });
      for (let t = 18; t < x1 - x0 - 8; t += 34) { lamps.push({ x: x0 + t, z: z0 - 0.7, r: 0 }); lamps.push({ x: x0 + t + 14, z: z1 + 0.7, r: Math.PI }); }
      for (let t = 18; t < z1 - z0 - 8; t += 34) { lamps.push({ x: x0 - 0.7, z: z0 + t + 8, r: 1 }); lamps.push({ x: x1 + 0.7, z: z0 + t, r: 2 }); }
    }
    // coastal palms along the beach
    for (let z = 20; z < WORLD_D - 10; z += 16) trees.push({ x: WORLD_W + 16 + rnd() * 20, z, s: 1.2 + rnd() * 0.5, palm: true, c: rnd() });
    return { trees, lamps };
  }, []);
  const puddles = useMemo(() => {
    const rnd = mulberry32(9182);
    return Array.from({ length: 240 }, () => {
      const horizontal = rnd() < 0.5;
      const road = horizontal ? Math.floor(rnd() * NZN) : Math.floor(rnd() * NXN);
      return {
        x: horizontal ? rnd() * WORLD_W : road * P + (rnd() - 0.5) * 5,
        z: horizontal ? road * P + (rnd() - 0.5) * 5 : rnd() * WORLD_D,
        sx: 0.8 + rnd() * 2.2,
        sz: 0.35 + rnd() * 0.8,
        horizontal,
      };
    });
  }, []);

  const [zebra] = useState(() => {
    const out: { x: number; z: number; rot: number }[] = [];
    for (let j = 0; j < NZN; j++) for (let i = 0; i < NXN; i++) {
      const nb = neighbors(i, j);
      for (const n of nb) {
        const dx = n.i - i, dz = n.j - j;
        const cx = i * P + dx * (RW / 2 + 2.2), cz = j * P + dz * (RW / 2 + 2.2);
        for (let s = -3; s <= 3; s++) out.push({ x: cx + (dz !== 0 ? s * 1.1 : 0), z: cz + (dx !== 0 ? s * 1.1 : 0), rot: dx !== 0 ? 0 : Math.PI / 2 });
      }
    }
    return out;
  });

  useEffect(() => {
    const m = new THREE.Object3D();
    const col = new THREE.Color();
    // slabs
    const sl = slabRef.current!;
    let n = 0;
    for (let j = 0; j < NZB; j++) for (let i = 0; i < NXB; i++) {
      const d = districtOfBlock(i, j);
      const park = PARKS.has(`${i},${j}`);
      m.position.set(i * P + P / 2, 0.12, j * P + P / 2); m.scale.set(P - RW, 0.24, P - RW); m.rotation.set(0, 0, 0); m.updateMatrix();
      sl.setMatrixAt(n, m.matrix);
      col.set(park ? '#4f9d3a' : d === 'airport' ? '#6e747c' : d === 'coastal' ? '#cdbb8e' : d === 'industrial' ? '#8d8a82' : '#a8a49b');
      sl.setColorAt(n, col); n++;
    }
    sl.instanceMatrix.needsUpdate = true; if (sl.instanceColor) sl.instanceColor.needsUpdate = true;
    const sw = sidewalkRef.current!;
    sidewalks.forEach((s, i) => {
      m.position.set(s.x, 0.31, s.z);
      m.scale.set(s.horizontal ? P - RW : 3.2, 0.14, s.horizontal ? 3.2 : P - RW);
      m.rotation.set(0, 0, 0); m.updateMatrix(); sw.setMatrixAt(i, m.matrix);
      col.set(s.district === 'coastal' ? '#d9c9a6' : s.district === 'industrial' ? '#aaa69e' : '#c5c0b5');
      sw.setColorAt(i, col);
    });
    sw.instanceMatrix.needsUpdate = true; if (sw.instanceColor) sw.instanceColor.needsUpdate = true;
    const ir = interRef.current!; n = 0;
    for (let j = 0; j < NZN; j++) for (let i = 0; i < NXN; i++) { m.position.set(i * P, 0.035, j * P); m.scale.set(RW, 1, RW); m.rotation.set(-Math.PI / 2, 0, 0); m.updateMatrix(); ir.setMatrixAt(n++, m.matrix); }
    ir.instanceMatrix.needsUpdate = true;
    const z = zebraRef.current!;
    zebra.forEach((q, k) => { m.position.set(q.x, 0.045, q.z); m.scale.set(0.6, 1, 4.4); m.rotation.set(-Math.PI / 2, 0, q.rot); m.updateMatrix(); z.setMatrixAt(k, m.matrix); });
    z.instanceMatrix.needsUpdate = true;
    const tr = trunkRef.current!, cr = crownRef.current!;
    props.trees.forEach((t, k) => {
      const h = t.palm ? 5.5 * t.s : 2.2 * t.s;
      m.position.set(t.x, h / 2, t.z); m.scale.set(t.palm ? 0.7 : 1, h / 2, t.palm ? 0.7 : 1); m.rotation.set(0, 0, 0); m.updateMatrix(); tr.setMatrixAt(k, m.matrix);
      m.position.set(t.x, h + (t.palm ? 0.4 : 1.1 * t.s), t.z); m.scale.set(t.palm ? 2.2 : 1.6 * t.s, t.palm ? 0.6 : 1.4 * t.s, t.palm ? 2.2 : 1.6 * t.s); m.updateMatrix(); cr.setMatrixAt(k, m.matrix);
      col.setHSL(0.27 + t.c * 0.07, 0.5, 0.26 + t.c * 0.12); cr.setColorAt(k, col);
    });
    tr.instanceMatrix.needsUpdate = true; cr.instanceMatrix.needsUpdate = true; if (cr.instanceColor) cr.instanceColor.needsUpdate = true;
    const po = poleRef.current!, la = lampRef.current!, pl = poolRef.current!;
    props.lamps.forEach((l, k) => {
      m.position.set(l.x, 3.5, l.z); m.scale.set(1, 1, 1); m.rotation.set(0, 0, 0); m.updateMatrix(); po.setMatrixAt(k, m.matrix);
      m.position.set(l.x, 7.05, l.z); m.scale.set(1, 1, 1); m.updateMatrix(); la.setMatrixAt(k, m.matrix);
      m.position.set(l.x, 0.3, l.z); m.scale.set(1, 1, 1); m.rotation.set(-Math.PI / 2, 0, 0); m.updateMatrix(); pl.setMatrixAt(k, m.matrix);
    });
    po.instanceMatrix.needsUpdate = true; la.instanceMatrix.needsUpdate = true; pl.instanceMatrix.needsUpdate = true;
    const puddleMesh = puddleRef.current!;
    puddles.forEach((puddle, i) => {
      m.position.set(puddle.x, 0.052, puddle.z);
      m.scale.set(puddle.horizontal ? puddle.sx : puddle.sz, 1, puddle.horizontal ? puddle.sz : puddle.sx);
      m.rotation.set(-Math.PI / 2, 0, 0); m.updateMatrix();
      puddleMesh.setMatrixAt(i, m.matrix);
    });
    puddleMesh.instanceMatrix.needsUpdate = true;

  }, [props, zebra, sidewalks, puddles]);

  useFrame(() => {
    const night = rt.night;
    bMat.emissiveIntensity = night * 0.95;
    lampMat.emissiveIntensity = night * 2.2;
    poolMat.opacity = night * (0.1 + rt.wet * 0.12);
    if (puddleRef.current) (puddleRef.current.material as THREE.MeshStandardMaterial).opacity = rt.wet * 0.3;
    roadMat.roughness = 0.92 - rt.wet * 0.6; roadMat.metalness = rt.wet * 0.25;
    roadMat.color.setScalar(1 - rt.wet * 0.35); plainRoad.roughness = roadMat.roughness; plainRoad.metalness = roadMat.metalness;
    plainRoad.color.set('#3a3d42').multiplyScalar(1 - rt.wet * 0.35);
  });

  const hqLot = lots.find((l) => l.special === 'hq');
  return (
    <group>
      {/* ground + sea + beach */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WORLD_W / 2, -0.02, WORLD_D / 2]} receiveShadow><planeGeometry args={[4000, 4000]} /><meshStandardMaterial color="#7a8f5a" roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WORLD_W + 40, 0.01, WORLD_D / 2]}><planeGeometry args={[70, WORLD_D + 200]} /><meshStandardMaterial color="#e4d3a1" roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WORLD_W + 1100, 0.02, WORLD_D / 2]}><planeGeometry args={[2000, 4000]} /><meshStandardMaterial color="#1d7fa6" roughness={0.25} metalness={0.3} /></mesh>
      {/* roads */}
      {roadsH.map((j) => (
        <mesh key={'h' + j} rotation={[-Math.PI / 2, 0, 0]} position={[WORLD_W / 2, 0.03, j * P]} receiveShadow onUpdate={() => { }}>
          <planeGeometry args={[WORLD_W + RW, RW]} /><primitive object={roadMat} attach="material" />
        </mesh>
      ))}
      {roadsV.map((i) => (
        <mesh key={'v' + i} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[i * P, 0.031, WORLD_D / 2]} receiveShadow>
          <planeGeometry args={[WORLD_D + RW, RW]} /><primitive object={roadMat} attach="material" />
        </mesh>
      ))}
      <RoadTexRepeat tex={roadTex} />
      <instancedMesh ref={interRef} args={[undefined, undefined, NXN * NZN]} receiveShadow><planeGeometry args={[1, 1]} /><primitive object={plainRoad} attach="material" /></instancedMesh>
      <instancedMesh ref={sidewalkRef} args={[undefined, undefined, sidewalks.length]} receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.96} /></instancedMesh>
      <instancedMesh ref={zebraRef} args={[undefined, undefined, zebra.length]}><planeGeometry args={[1, 1]} /><meshBasicMaterial color="#f1f1f1" /></instancedMesh>
      <instancedMesh ref={slabRef} args={[undefined, undefined, NXB * NZB]} receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.95} /></instancedMesh>
      {/* buildings */}
      {blockMeshes.map(({ key, geo }) => (<mesh key={key} geometry={geo} material={bMat} castShadow receiveShadow />))}
      {/* props */}
      <instancedMesh ref={trunkRef} args={[undefined, undefined, props.trees.length]} castShadow><cylinderGeometry args={[0.16, 0.22, 2, 6]} /><meshStandardMaterial color="#6b4a2b" /></instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, props.trees.length]} castShadow><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={0.9} flatShading /></instancedMesh>
      <instancedMesh ref={poleRef} args={[undefined, undefined, props.lamps.length]}><cylinderGeometry args={[0.07, 0.1, 7, 6]} /><meshStandardMaterial color="#4b5563" /></instancedMesh>
      <instancedMesh ref={lampRef} args={[undefined, undefined, props.lamps.length]}><boxGeometry args={[0.9, 0.15, 0.4]} /><primitive object={lampMat} attach="material" /></instancedMesh>
      <instancedMesh ref={poolRef} args={[undefined, undefined, props.lamps.length]}><circleGeometry args={[7, 12]} /><primitive object={poolMat} attach="material" /></instancedMesh>
      <instancedMesh ref={puddleRef} args={[undefined, undefined, puddles.length]} frustumCulled={false}>
        <circleGeometry args={[0.5, 10]} />
        <meshStandardMaterial color="#506577" roughness={0.13} metalness={0.28} transparent opacity={0} depthWrite={false} />
      </instancedMesh>

      <Decor />
      <Flyover />
      <Doorways />
      {hqLot && <CompanySign lot={hqLot} />}
      <BranchSigns />
      <PoiSigns />
    </group>
  );
}

function Flyover() {
  const sign = useMemo(() => makeSignTexture('ANNA SALAI FLYOVER', '#172554', '#fff', 512, 112, 'ELEVATED ROAD  •  KEEP LEFT'), []);
  const road = useMemo(() => {
    const stations = [
      [FLYOVER.startX, 0],
      [FLYOVER.rampUpEndX, FLYOVER.height],
      [FLYOVER.rampDownStartX, FLYOVER.height],
      [FLYOVER.endX, 0],
    ] as const;
    const positions: number[] = [];
    const indices: number[] = [];
    stations.forEach(([x, y]) => {
      positions.push(x, y + 0.12, FLYOVER.z - FLYOVER.halfWidth);
      positions.push(x, y + 0.12, FLYOVER.z + FLYOVER.halfWidth);
    });
    for (let i = 0; i < stations.length - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => { road.dispose(); sign.dispose(); }, [road, sign]);

  const barrierSegments = [
    [FLYOVER.startX, FLYOVER.rampUpEndX],
    [FLYOVER.rampUpEndX, FLYOVER.rampDownStartX],
    [FLYOVER.rampDownStartX, FLYOVER.endX],
  ];
  return (
    <group>
      <mesh position={[FLYOVER.startX - 8, 3.2, FLYOVER.z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[6.5, 1.6]} />
        <meshBasicMaterial map={sign} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[FLYOVER.endX + 8, 3.2, FLYOVER.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[6.5, 1.6]} />
        <meshBasicMaterial map={sign} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={road} receiveShadow>
        <meshStandardMaterial color="#34383d" roughness={0.88} side={THREE.DoubleSide} />
      </mesh>
      {barrierSegments.flatMap(([start, end]) => {
        const startY = flyoverHeight(start, FLYOVER.z);
        const endY = flyoverHeight(end, FLYOVER.z);
        const length = end - start;
        const angle = Math.atan2(endY - startY, length);
        return [-1, 1].map((side) => (
          <mesh
            key={`${start}-${side}`}
            position={[(start + end) / 2, (startY + endY) / 2 + 0.68, FLYOVER.z + side * (FLYOVER.halfWidth - 0.18)]}
            rotation={[0, 0, angle]}
            castShadow
          >
            <boxGeometry args={[length, 1.15, 0.36]} />
            <meshStandardMaterial color="#c7cbd0" roughness={0.65} />
          </mesh>
        ));
      })}
      {Array.from({ length: 18 }, (_, i) => {
        const x = FLYOVER.startX + 8 + i * 12;
        const y = flyoverHeight(x, FLYOVER.z);
        return (
          <mesh
            key={i}
            position={[x, y + 0.15, FLYOVER.z]}
            rotation={[0, 0, Math.atan2(flyoverHeight(x + 1, FLYOVER.z) - flyoverHeight(x - 1, FLYOVER.z), 2)]}
          >
            <boxGeometry args={[4, 0.04, 0.16]} />
            <meshBasicMaterial color="#f4d35e" />
          </mesh>
        );
      })}
      {[FLYOVER.rampUpEndX + 18, (FLYOVER.rampUpEndX + FLYOVER.rampDownStartX) / 2, FLYOVER.rampDownStartX - 18].map((x) => (
        <mesh key={x} position={[x, FLYOVER.height / 2, FLYOVER.z]} castShadow receiveShadow>
          <boxGeometry args={[1.8, FLYOVER.height, 1.8]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

const DOOR_COLORS: Partial<Record<PoiKind, string>> = {
  home: '#7c4a2d', hq: '#1e3a8a', branch: '#1e3a8a', garage: '#374151', restaurant: '#92400e',
  shop: '#047857', bank: '#1e3a8a', regoffice: '#6d28d9', hospital: '#0e7490', dealership: '#4338ca',
  police: '#1e40af', hotel: '#78350f', petrol: '#c2410c', railway: '#1d4ed8', bus: '#0369a1',
  airport: '#0e7490', mall: '#be185d', itpark: '#1e40af', school: '#0f766e', beach: '#0284c7',
  factory: '#475569', park: '#166534', office: '#334155', apartments: '#78350f', market: '#b45309',
};

function Doorways() {
  const enterable = useMemo(() => pois.filter((p) => p.enterable), []);
  return <>
    {enterable.map((p) => {
      const col = DOOR_COLORS[p.kind as PoiKind] ?? '#334155';
      // push arch back to building wall (door POI is 4.8 units in front of wall)
      const northFacing = p.z % P < P / 2;
      const wallZ = p.z + (northFacing ? 4.8 : -4.8);
      return (
        <group key={p.id} position={[p.x, 0, wallZ]}>
          {/* left post */}
          <mesh position={[-0.85, 1.3, 0]} castShadow>
            <boxGeometry args={[0.28, 2.6, 0.28]} />
            <meshStandardMaterial color={col} roughness={0.6} />
          </mesh>
          {/* right post */}
          <mesh position={[0.85, 1.3, 0]} castShadow>
            <boxGeometry args={[0.28, 2.6, 0.28]} />
            <meshStandardMaterial color={col} roughness={0.6} />
          </mesh>
          {/* lintel */}
          <mesh position={[0, 2.75, 0]} castShadow>
            <boxGeometry args={[2.0, 0.3, 0.28]} />
            <meshStandardMaterial color={col} roughness={0.6} />
          </mesh>
          {/* door panel */}
          <mesh position={[0, 1.2, 0.01]}>
            <boxGeometry args={[1.5, 2.4, 0.08]} />
            <meshStandardMaterial color="#c8a97a" roughness={0.7} />
          </mesh>
        </group>
      );
    })}
  </>;
}

function RoadTexRepeat({ tex }: { tex: THREE.Texture }) {
  useEffect(() => { tex.repeat.set((WORLD_W + RW) / 14, 1); tex.needsUpdate = true; }, [tex]);
  return null;
}

/** Parks (ponds), metro viaduct, airport planes, beach details, flyover. */
function Decor() {
  const items = useMemo(() => {
    const out: React.ReactNode[] = [];
    // park ponds
    PARKS.forEach((k) => {
      const [i, j] = k.split(',').map(Number);
      out.push(<mesh key={'pond' + k} rotation={[-Math.PI / 2, 0, 0]} position={[i * P + P / 2, 0.27, j * P + P / 2]}><circleGeometry args={[11, 20]} /><meshStandardMaterial color="#3b9dd6" roughness={0.2} metalness={0.3} /></mesh>);
    });
    // metro viaduct along the vertical road x = 4P (z: 2P..8P)
    const x = 4 * P;
    out.push(<mesh key="deck" position={[x, 9, 5 * P]} castShadow><boxGeometry args={[7, 1.2, 6 * P]} /><meshStandardMaterial color="#9ca3af" /></mesh>);
    for (let z = 2 * P; z <= 8 * P; z += 26) out.push(<mesh key={'pil' + z} position={[x, 4.5, z]} castShadow><boxGeometry args={[1.4, 9, 1.4]} /><meshStandardMaterial color="#b6bcc4" /></mesh>);
    out.push(<mesh key="train" position={[x, 10.4, 4.2 * P]}><boxGeometry args={[3, 2, 30]} /><meshStandardMaterial color="#2563eb" emissive="#1d4ed8" emissiveIntensity={0.15} /></mesh>);
    // airport planes & runway
    const rw = 1 * P + P / 2;
    out.push(<mesh key="runway" rotation={[-Math.PI / 2, 0, 0]} position={[3 * P, 0.3, rw - 14]}><planeGeometry args={[5 * P, 14]} /><meshStandardMaterial color="#2f3338" /></mesh>);
    out.push(<mesh key="runlines" rotation={[-Math.PI / 2, 0, 0]} position={[3 * P, 0.31, rw - 14]}><planeGeometry args={[5 * P - 10, 0.6]} /><meshBasicMaterial color="#e5e7eb" /></mesh>);
    [[0.7, -26], [1.5, -26], [3.2, -28]].forEach(([fx, dz], q) => out.push(
      <group key={'plane' + q} position={[fx * P + 30, 1.6, rw + dz]}>
        <mesh castShadow><cylinderGeometry args={[1.5, 1.5, 22, 10]} /><meshStandardMaterial color="#f1f5f9" /></mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} castShadow><boxGeometry args={[0.4, 28, 3.2]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
        <mesh position={[0, 3, 9.5]} castShadow><boxGeometry args={[0.3, 5, 3]} /><meshStandardMaterial color="#2563eb" /></mesh>
      </group>));
    // sea rocks / pier
    out.push(<mesh key="pier" position={[WORLD_W + 70, 0.6, 5.3 * P]} castShadow><boxGeometry args={[60, 0.5, 5]} /><meshStandardMaterial color="#8b6b4a" /></mesh>);
    // district gate arches (visual identity)
    return out;
  }, []);
  return <>{items}</>;
}

function CompanySign({ lot }: { lot: Lot }) {
  const company = useGame((s) => s.g?.company);
  const tex = useMemo(() => (company ? makeSignTexture(company.branding.name, company.branding.primary, '#fff', 512, 128, 'HEADQUARTERS') : null), [company?.branding.name, company?.branding.primary]);
  useEffect(() => () => { tex?.dispose(); }, [tex]);
  if (!company || !tex) return null;
  const cx = (lot.x0 + lot.x1) / 2;
  return (
    <group>
      <mesh position={[cx, 7.5, lot.z0 - 0.4]}><planeGeometry args={[16, 4]} /><meshBasicMaterial map={tex} side={THREE.DoubleSide} /></mesh>
      <mesh position={[cx, lot.h * 0.5, lot.z0 - 0.2]}><boxGeometry args={[1, lot.h, 0.6]} /><meshStandardMaterial color={company.branding.primary} /></mesh>
    </group>
  );
}
function BranchSigns() {
  const company = useGame((s) => s.g?.company);
  const list = company?.branches.filter((b) => b.id !== 'hq') ?? [];
  return <>{list.map((b) => {
    const p = pois.find((x) => x.id === b.poiId);
    if (!p || !company) return null;
    return <BranchSign key={b.id} x={p.x} z={p.z} name={company.branding.name} color={company.branding.primary} />;
  })}</>;
}
function BranchSign({ x, z, name, color }: { x: number; z: number; name: string; color: string }) {
  const tex = useMemo(() => makeSignTexture(name, color, '#fff', 512, 128, 'BRANCH OFFICE'), [name, color]);
  useEffect(() => () => { tex.dispose(); }, [tex]);
  const north = true;
  void north;
  return <mesh position={[x, 6.5, z + 1.8]}><planeGeometry args={[12, 3]} /><meshBasicMaterial map={tex} side={THREE.DoubleSide} /></mesh>;
}

function PoiSigns() {
  const signCache = useMemo(() => new Map<string, THREE.Texture>(), []);
  useEffect(() => () => { signCache.forEach((texture) => texture.dispose()); signCache.clear(); }, [signCache]);
  const [near, setNear] = useState<{ id: string; name: string; x: number; z: number; kind: PoiKind }[]>([]);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.8) return;
    acc.current = 0;
    const px = rt.mode === 'walk' ? rt.walk.x : rt.bike.x, pz = rt.mode === 'walk' ? rt.walk.z : rt.bike.z;
    const list = pois.filter((p) => ['home', 'hq', 'bank', 'regoffice', 'garage', 'restaurant', 'shop', 'hospital', 'dealership', 'petrol', 'police', 'railway', 'bus', 'airport', 'mall', 'hotel', 'branch', 'market', 'beach', 'itpark', 'school'].includes(p.kind) && Math.hypot(p.x - px, p.z - pz) < 85).slice(0, 12);
    setNear((prev) => (prev.length === list.length && prev.every((p, i) => p.id === list[i].id) ? prev : list.map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z, kind: p.kind }))));
  });
  const COL: Record<string, string> = { bank: '#1e3a8a', restaurant: '#b45309', shop: '#047857', hospital: '#b91c1c', dealership: '#4338ca', petrol: '#be123c', police: '#1e40af', garage: '#374151', home: '#0f766e', regoffice: '#6d28d9', hq: '#0f172a', branch: '#0f172a', railway: '#7c2d12', airport: '#0369a1', bus: '#0f766e', mall: '#be185d', hotel: '#92400e', market: '#a16207', beach: '#0e7490', itpark: '#4f46e5', school: '#15803d' };
  const SUB: Partial<Record<PoiKind, string>> = {
    restaurant: 'IDLI  •  DOSA  •  FILTER COFFEE',
    shop: 'KADAI  •  DAILY ESSENTIALS',
    bus: 'MTC CITY BUS',
    railway: 'SUBURBAN RAIL',
    garage: 'TWO-WHEELER SERVICE',
    petrol: 'FUEL  •  AIR  •  OIL',
    market: 'FRESH MARKET',
    beach: 'MARINA COAST',
    hotel: 'ROOMS  •  RESTAURANT',
  };
  return <>{near.map((p) => {
    let t = signCache.get(p.id);
    if (!t) { t = makeSignTexture(p.name, COL[p.kind] ?? '#334155', '#fff', 512, SUB[p.kind] ? 144 : 112, SUB[p.kind]); signCache.set(p.id, t); }
    const north = true; void north;
    return <sprite key={p.id} position={[p.x, 5.6, p.z + (p.z % P < P / 2 ? 2.6 : -2.6)]} scale={[10, 2.2, 1]}><spriteMaterial map={t} depthWrite={false} /></sprite>;
  })}</>;
}

export { DISTRICTS };
