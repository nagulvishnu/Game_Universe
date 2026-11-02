import { NPCS, RIVALS, DISTRICT_CENTERS } from '../../data/rivals';
import type { DistrictId } from '../types';
import { Builder, Local, type BuiltChunk, type Collider } from './builder';
import { DISTRICT_MAP, INTERACTABLES, type Interactable } from './layout';

export interface CityData {
  chunks: BuiltChunk[];
  colliders: Collider[];
  rings: Builder['rings'];
  jets: Builder['jets'];
  flags: Builder['flags'];
  floaters: Builder['floaters'];
}

const EW = [{ z: -40, w: 8 }, { z: 0, w: 16 }, { z: 40, w: 8 }];
const NS = [{ x: -76, w: 8 }, { x: -38, w: 10 }, { x: 0, w: 8 }, { x: 38, w: 10 }, { x: 76, w: 8 }];
const PADS: Record<DistrictId, [number, number, number, number]> = {
  residential: [-110, -45, -72, -11], shopping: [-31, 31, -72, -11], training: [45, 110, -72, -11],
  competition: [45, 110, 11, 72], elite: [-31, 31, 11, 72], championship: [-110, -45, 11, 72],
};
const CHUNK: Record<DistrictId, string> = { residential: 'res', shopping: 'shop', training: 'train', competition: 'comp', elite: 'elite', championship: 'champ' };

const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length) % a.length];
const WALLS = ['#f6e9d7', '#ffd9b0', '#d9ecff', '#ffe3ea', '#e1f2d6', '#f2e0ff'];
const ROOFS = ['#c0504d', '#4d6fc0', '#5b8f5b', '#7a5a8a', '#c08a4d', '#3f7f8f'];
const NEONS = ['#ff3d9a', '#35d0ff', '#ffd24a', '#7aff9a', '#b57cff', '#ff7a3a'];

function tree(b: Builder, x: number, z: number, kind: string) {
  const r = b.rng;
  const s = 0.85 + r() * 0.5;
  if (kind === 'sakura') {
    b.cyl(x, 0, z, 0.22 * s, 2.6 * s, '#6b4a3a', 6, 0.7);
    for (let i = 0; i < 4; i++) b.ico(x + (r() - 0.5) * 1.6 * s, (2.6 + r() * 1.2) * s, z + (r() - 0.5) * 1.6 * s, (1.1 + r() * 0.5) * s, pick(r, ['#ffb3d1', '#ff9ec7', '#ffc9de']), 0.8);
  } else if (kind === 'pine') {
    b.cyl(x, 0, z, 0.2 * s, 1.4 * s, '#5a4030', 6);
    for (let i = 0; i < 3; i++) b.cone(x, (1 + i * 1.1) * s, z, (1.5 - i * 0.35) * s, 1.8 * s, i % 2 ? '#2f7a4a' : '#3a8f55');
  } else if (kind === 'cypress') {
    b.cyl(x, 0, z, 0.15, 1, '#4a3a2a', 5);
    b.cone(x, 0.8, z, 0.9 * s, 4.2 * s, '#2d5a4a');
  } else if (kind === 'gold') {
    b.cyl(x, 0, z, 0.2 * s, 2.2 * s, '#7a5a3a', 6);
    b.ico(x, 3 * s, z, 1.5 * s, '#e8c24a', 0.9);
  } else {
    b.cyl(x, 0, z, 0.2 * s, 2 * s, '#6b4a3a', 6, 0.7);
    b.ico(x, 3 * s, z, 1.5 * s, pick(r, ['#58b36a', '#6cc47a', '#4aa05e']), 0.9);
  }
  b.cCircle(x, z, 0.45, true);
  if (kind !== 'cypress') b.colliders.push({ x, z, hw: 1.5 * s, hd: 1.5 * s, rot: 0, r: 1.5 * s, round: true, tall: true, camOnly: true });
}

function lamp(b: Builder, x: number, z: number, faceX: number, faceZ: number) {
  b.cyl(x, 0, z, 0.1, 4.8, '#3a3d48', 6);
  const ang = Math.atan2(faceX, faceZ);
  b.box(x + Math.sin(ang) * 0.5, 4.7, z + Math.cos(ang) * 0.5, 0.15, 0.12, 1.1, '#3a3d48', ang);
  b.glow(x + Math.sin(ang) * 1.0, 4.58, z + Math.cos(ang) * 1.0, 0.5, 0.14, 0.5, '#fff0b0', ang);
  b.cCircle(x, z, 0.28, false);
}

function car(b: Builder, x: number, z: number, rot: number, color: string) {
  const L = new Local(b, x, z, rot);
  L.box(0, 0.35, 0, 1.9, 0.7, 4.2, color);
  L.box(0, 1.0, -0.2, 1.7, 0.7, 2.2, '#26324a');
  L.box(0, 0.62, 0, 1.92, 0.12, 4.22, '#1a1a20');
  for (const sx of [-0.95, 0.95]) for (const sz of [-1.35, 1.35]) b.put(unitWheel, '#111', L.wx(sx, sz), 0.38, L.wz(sx, sz), 0.38, 0.25, 0.38, rot, 0, Math.PI / 2);
  L.glow(-0.6, 0.5, 2.11, 0.4, 0.2, 0.05, '#fff5c0');
  L.glow(0.6, 0.5, 2.11, 0.4, 0.2, 0.05, '#fff5c0');
  b.cBox(x, z, 1.9, 4.2, rot, false);
}
import * as THREE from 'three';
const unitWheel = new THREE.CylinderGeometry(1, 1, 1, 8).toNonIndexed();

// ---------- Plaza features ----------
function feature(b: Builder, it: Interactable) {
  const c = DISTRICT_CENTERS[it.district];
  const col = DISTRICT_MAP[it.district].color;
  const rot = Math.atan2(c.x - it.x, c.z - it.z);
  const L = new Local(b, it.x, it.z, rot);
  switch (it.type) {
    case 'bench':
      L.box(0, 0.45, 0, 2.4, 0.15, 0.7, '#8a5a3a');
      L.box(0, 0.9, -0.3, 2.4, 0.5, 0.12, '#8a5a3a');
      L.box(-1, 0, 0, 0.12, 0.45, 0.6, '#333'); L.box(1, 0, 0, 0.12, 0.45, 0.6, '#333');
      b.cBox(it.x, it.z, 2.6, 0.9, rot, false);
      break;
    case 'board':
      L.box(-1.3, 0, 0, 0.18, 2.6, 0.18, '#3a3d48'); L.box(1.3, 0, 0, 0.18, 2.6, 0.18, '#3a3d48');
      L.box(0, 1.1, 0.05, 3, 1.5, 0.15, '#f4f1e8');
      L.glow(0, 2.6, 0.05, 3.2, 0.25, 0.2, col);
      L.box(0, 2.75, 0, 3.4, 0.15, 0.7, '#3a3d48');
      for (let i = 0; i < 6; i++) L.box(-1.2 + (i % 3) * 0.95, 1.3 + Math.floor(i / 3) * 0.6, 0.15, 0.7, 0.4, 0.04, pick(b.rng, NEONS));
      b.cBox(it.x, it.z, 3.2, 0.8, rot, true);
      break;
    case 'shop':
      L.box(0, 0, 0, 5.4, 3, 3, '#3a3f58');
      L.box(0, 0.9, 1.55, 5, 0.18, 0.9, '#f4f1e8');
      L.glow(0, 2.4, 1.52, 4.4, 0.6, 0.1, col);
      L.box(0, 3, 0.2, 6, 0.25, 3.8, col);
      L.box(-2.6, 0, 1.8, 0.14, 3, 0.14, '#ddd'); L.box(2.6, 0, 1.8, 0.14, 3, 0.14, '#ddd');
      for (let i = 0; i < 5; i++) { L.cone(-1.8 + i * 0.9, 1.08, 1.55, 0.3, 0.5, NEONS[i % 6], 6); }
      L.glow(0, 3.4, 0.2, 3.4, 0.9, 0.15, '#ffffff');
      b.cBox(it.x, it.z, 5.6, 3.2, rot, true);
      break;
    case 'tournament':
      L.box(0, 0, 0, 5, 1.1, 1.6, '#f4efe4');
      L.box(0, 1.1, 0, 5.2, 0.15, 1.8, '#3a3d48');
      L.box(-2.8, 0, -0.5, 0.35, 5.2, 0.35, '#e8dfc8'); L.box(2.8, 0, -0.5, 0.35, 5.2, 0.35, '#e8dfc8');
      L.glow(0, 4.6, -0.5, 6, 0.9, 0.3, col);
      L.box(0, 5.5, -0.5, 6.4, 0.25, 0.5, '#3a3d48');
      b.flags.push({ x: L.wx(-3.4, -0.5), y: 5, z: L.wz(-3.4, -0.5), color: col }, { x: L.wx(3.4, -0.5), y: 5, z: L.wz(3.4, -0.5), color: col });
      b.cBox(it.x, it.z, 5.2, 1.8, rot, true);
      break;
    case 'training':
    case 'publicbattle': {
      const r = it.type === 'training' ? 3.2 : 2.8;
      b.cyl(it.x, 0, it.z, r + 0.6, 0.35, '#4a4f60', 20);
      b.cyl(it.x, 0.3, it.z, r, 0.12, it.type === 'training' ? '#4a3a2a' : '#2c3e63', 20);
      b.torus(it.x, 0.5, it.z, r - 0.2, col, 'glow', 0.5);
      b.torus(it.x, 0.75, it.z, r + 0.45, '#cfd6e0', 'color', 3);
      b.cyl(it.x, 0.3, it.z, 0.45, 0.2, col, 8);
      b.cCircle(it.x, it.z, r + 0.8, false);
      break;
    }
  }
}

// ---------- Building generators (local frame: front is +z) ----------
type Gen = (L: Local, w: number, d: number, b: Builder) => void;

const house: Gen = (L, w, d, b) => {
  const r = b.rng;
  const bw = Math.min(w - 3, 7 + r() * 1.5), bd = Math.min(d - 3.5, 5.6 + r());
  const h = 3.6 + r() * 1.2;
  const wall = pick(r, WALLS), roof = pick(r, ROOFS);
  L.wbox(0, 0, -0.6, bw, h, bd, wall);
  L.gable(0, h, -0.6, bw + 0.8, 2.2 + r(), bd + 0.8, roof);
  L.box(0, 0, -0.6 + bd / 2 + 0.03, 1.1, 2.1, 0.1, '#8a5a3a');
  L.box(0, 2.1, -0.6 + bd / 2 + 0.1, 1.6, 0.14, 0.7, roof);
  L.box(bw / 3, h + 0.5, -1.4, 0.7, 1.8, 0.7, '#8a6a5a');
  for (const sx of [-1, 1]) L.box(sx * bw / 2.6, 1.0, -0.6 + bd / 2 + 0.06, 1.1, 0.12, 0.3, '#ff9ec7');
  L.box(0, 0, d / 2 - 0.3, w - 1.5, 0.8, 0.1, '#ffffff');
  L.box(-(w - 1.5) / 2, 0, d / 2 - 1.8, 0.1, 0.8, 3, '#ffffff'); L.box((w - 1.5) / 2, 0, d / 2 - 1.8, 0.1, 0.8, 3, '#ffffff');
  const c = Math.hypot(bw + 0.8, bd + 0.8);
  void c;
  b.cBox(L.wx(0, -0.6), L.wz(0, -0.6), L.rot === 0 || Math.abs(Math.abs(L.rot) - Math.PI) < 0.01 ? bw + 0.8 : bd + 0.8, L.rot === 0 || Math.abs(Math.abs(L.rot) - Math.PI) < 0.01 ? bd + 0.8 : bw + 0.8, 0, true);
  tree(b, L.wx(-w / 2 + 1, d / 2 - 1.5), L.wz(-w / 2 + 1, d / 2 - 1.5), 'sakura');
};

const park: Gen = (L, w, d, b) => {
  b.cyl(L.cx, 0.02, L.cz, Math.min(w, d) / 2 - 0.5, 0.06, '#7fc06a', 16);
  b.cyl(L.wx(0, -0.5), 0.03, L.wz(0, -0.5), 3.2, 0.2, '#58b8e0', 18);
  b.cyl(L.wx(0, -0.5), 0.0, L.wz(0, -0.5), 3.6, 0.22, '#9aa7b8', 18);
  b.cyl(L.wx(0, -0.5), 0.05, L.wz(0, -0.5), 3.1, 0.22, '#58b8e0', 18);
  b.cCircle(L.wx(0, -0.5), L.wz(0, -0.5), 3.6, false);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.4; tree(b, L.wx(Math.cos(a) * (w / 2 - 1.2), Math.sin(a) * (d / 2 - 1.2) - 0.5), L.wz(Math.cos(a) * (w / 2 - 1.2), Math.sin(a) * (d / 2 - 1.2) - 0.5), 'sakura'); }
  L.box(w / 2 - 2.2, 0, d / 2 - 2, 0.2, 2.6, 0.2, '#e8dfc8'); L.box(w / 2 - 4.2, 0, d / 2 - 2, 0.2, 2.6, 0.2, '#e8dfc8');
  L.box(w / 2 - 3.2, 2.6, d / 2 - 2, 2.8, 0.15, 1.6, '#c0504d');
  b.cCircle(L.wx(w / 2 - 3.2, d / 2 - 2), L.wz(w / 2 - 3.2, d / 2 - 2), 1.4, false);
};

const shopB: Gen = (L, w, d, b) => {
  const r = b.rng;
  const mall = r() < 0.3;
  const h = mall ? 12 + r() * 3 : 7 + r() * 5;
  const wall = pick(r, ['#ff9ec7', '#7fe0ff', '#ffd24a', '#a98bff', '#7affc6', '#ff9d6a']);
  const neon = pick(r, NEONS);
  L.wbox(0, 0, 0, w - 1, h, d - 1, wall);
  L.box(0, h, 0, w - 0.5, 0.4, d - 0.5, '#3a3d48');
  L.glow(0, h + 0.4, (d - 1) / 2 - 0.1, w - 3, 2.4, 0.2, neon);
  L.box(-(w - 3) / 2, h + 0.4, (d - 1) / 2 - 0.2, 0.2, 2.4, 0.2, '#222'); L.box((w - 3) / 2, h + 0.4, (d - 1) / 2 - 0.2, 0.2, 2.4, 0.2, '#222');
  const fz = (d - 1) / 2;
  L.box(0, 0.3, fz + 0.02, w - 2.5, 2.7, 0.1, '#9fd6ff');
  for (let i = 0; i < 3; i++) L.box(-(w - 3) / 3 + i * (w - 3) / 3, 3.2, fz + 0.9, (w - 3) / 3 - 0.1, 0.22, 1.8, i % 2 ? '#ffffff' : pick(r, ['#ff3d9a', '#35d0ff', '#ffd24a']));
  L.glow(0, 3.6, fz + 0.15, Math.min(5, w - 4), 0.7, 0.12, neon);
  if (mall) L.glow(0, 6, fz + 0.1, w - 4, 4, 0.1, pick(r, ['#6a4bff', '#ff4d9a', '#2ac0ff']));
  b.cBox(L.cx, L.cz, Math.abs(L.c) > 0.5 ? w - 1 : d - 1, Math.abs(L.c) > 0.5 ? d - 1 : w - 1, 0, true);
};

const dojo: Gen = (L, w, d, b) => {
  const r = b.rng;
  const gym = r() < 0.4;
  if (gym) {
    L.wbox(0, 0, 0, w - 1.5, 7, d - 1.5, '#d8e4f0');
    L.glow(0, 4.4, (d - 1.5) / 2 + 0.02, w - 3, 1.2, 0.08, '#ffb13a');
    L.box(0, 7, 0, w - 1, 0.5, d - 1, '#2a6af0');
  } else {
    L.wbox(0, 0, 0, w - 2, 4, d - 2, '#e8dcc0');
    L.gable(0, 4, 0, w, 2.4, d, '#3d5a5a');
    L.gable(0, 5.6, 0, w - 3, 1.8, d - 3, '#2f4848');
    for (let i = -2; i <= 2; i++) L.cyl(i * (w - 3) / 4, 0, (d - 2) / 2 + 0.5, 0.18, 3.6, '#8a4a2a', 6);
    L.glow(0, 3.3, (d - 2) / 2 + 0.55, 3, 0.5, 0.1, '#ff4d4d');
  }
  b.cBox(L.cx, L.cz, Math.abs(L.c) > 0.5 ? w - 1.5 : d - 1.5, Math.abs(L.c) > 0.5 ? d - 1.5 : w - 1.5, 0, true);
};

const compB: Gen = (L, w, d, b) => {
  const r = b.rng;
  if (r() < 0.5) {
    L.wbox(0, 0, -0.5, w - 1, 9 + r() * 3, d - 2, pick(r, ['#e8e0d8', '#d8dce8']));
    for (let i = -2; i <= 2; i++) L.cyl(i * (w - 3) / 4, 0, (d - 2) / 2 + 0.2, 0.35, 5, '#ffffff', 8);
    L.box(0, 5, (d - 2) / 2 + 0.2, w - 1, 0.4, 1.4, '#cfd0d8');
    L.glow(-1.5, 6, (d - 2) / 2 + 0.3, 1.2, 3.4, 0.1, '#ff4d6d'); L.glow(1.5, 6, (d - 2) / 2 + 0.3, 1.2, 3.4, 0.1, '#ffffff');
  } else {
    for (let i = 0; i < 4; i++) L.box(0, 0, -d / 2 + 1 + i * 0.9, w - 1, 0.8 + i * 0.8, d - 2 - i * 1.8, i % 2 ? '#c0182e' : '#e8e0d8');
    L.glow(0, 4.5, d / 2 - 0.5, w - 3, 0.6, 0.2, '#ff4d6d');
  }
  b.cBox(L.cx, L.cz, Math.abs(L.c) > 0.5 ? w - 1 : d - 1, Math.abs(L.c) > 0.5 ? d - 1 : w - 1, 0, true);
};

const skyscraper: Gen = (L, w, d, b) => {
  const r = b.rng;
  const col = pick(r, ['#4a4f7a', '#3a3f66', '#59508a', '#2f6a8a']);
  const neon = pick(r, ['#b57cff', '#35d0ff', '#ff4dd8']);
  const h1 = 8 + r() * 4, h2 = 8 + r() * 12, h3 = 5 + r() * 8;
  L.wbox(0, 0, 0, w - 1, h1, d - 1, col);
  L.glow(0, h1, 0, w - 0.8, 0.25, d - 0.8, neon);
  L.wbox(0, h1 + 0.25, 0, w - 3, h2, d - 3, col);
  L.glow(0, h1 + h2 + 0.25, 0, w - 2.8, 0.25, d - 2.8, neon);
  L.wbox(0, h1 + h2 + 0.5, 0, w - 6, h3, d - 6, col);
  L.cyl(0, h1 + h2 + h3 + 0.5, 0, 0.12, 4, '#888', 5);
  const ax = L.wx(0, 0), az = L.wz(0, 0);
  b.cyl(ax, h1 + h2 + h3 + 4.4, az, 0.25, 0.3, '#ff3b3b', 6, 1);
  b.glow(ax - 0.2, h1 + h2 + h3 + 4.4, az - 0.2, 0.4, 0.4, 0.4, '#ff3b3b');
  b.cBox(L.cx, L.cz, Math.abs(L.c) > 0.5 ? w - 1 : d - 1, Math.abs(L.c) > 0.5 ? d - 1 : w - 1, 0, true);
};

const palace: Gen = (L, w, d, b) => {
  const r = b.rng;
  const h = 8 + r() * 3;
  L.wbox(0, 0, -0.6, w - 1.5, h, d - 3, '#f4efe4');
  L.box(0, h, -0.6, w - 0.5, 0.5, d - 2, '#ffd24a');
  L.dome(0, h + 0.5, -0.6, Math.min(w, d) / 3, '#ffd24a', 0.9);
  for (let i = -2; i <= 2; i++) L.cyl(i * (w - 4) / 4, 0, (d - 3) / 2 - 0.3, 0.4, h - 1, '#ffffff', 8);
  L.box(0, h - 1, (d - 3) / 2 - 0.3, w - 2, 0.5, 1.4, '#e8dfc8');
  L.glow(0, 1.2, (d - 3) / 2 + 0.6, 2.2, 0.3, 0.1, '#ffd24a');
  b.cBox(L.cx, L.cz, Math.abs(L.c) > 0.5 ? w - 1.5 : d - 3, Math.abs(L.c) > 0.5 ? d - 3 : w - 1.5, 0, true);
};

// ---------- Landmarks ----------
function landmark(b: Builder, id: DistrictId) {
  const { x, z } = DISTRICT_CENTERS[id];
  const accent = DISTRICT_MAP[id].color;
  b.cyl(x, 0, z, 7.5, 0.13, '#d6d0c4', 28);
  b.cyl(x, 0, z, 6.4, 0.135, '#bdb6a6', 28);
  switch (id) {
    case 'residential': {
      b.cyl(x, 0, z, 1.3, 7.5, '#6b4a3a', 10, 0.55);
      for (let i = 0; i < 9; i++) { const a = i * 2.4; b.ico(x + Math.cos(a) * 2.4, 8 + (i % 3) * 1.2, z + Math.sin(a) * 2.4, 2.6 + (i % 2), pick(b.rng, ['#ffb3d1', '#ff9ec7', '#ffc9de']), 0.8); }
      b.torus(x, 0.3, z, 3.6, '#e8dfc8', 'color', 5);
      b.cCircle(x, z, 2.2, true);
      b.floaters.push({ x, y: 8, z, color: '#ffc9de', r: 9 });
      break;
    }
    case 'shopping': {
      b.cyl(x, 0, z, 4.6, 0.5, '#9aa7b8', 24);
      b.cyl(x, 0.2, z, 4.2, 0.5, '#58b8e0', 24);
      b.cyl(x, 0.2, z, 0.9, 1.6, '#cfd6e0', 12);
      b.jets.push({ x, z, y: 1.8 });
      b.box(x, 0, z + 0.0, 2, 11, 2, '#e8e0d8');
      b.box(x, 11, z, 2.6, 0.4, 2.6, '#c0182e');
      b.cone(x, 11.4, z, 1.9, 2.4, '#c0182e', 4);
      for (const [dx, dz, ry] of [[0, 1.02, 0], [0, -1.02, 0], [1.02, 0, 1], [-1.02, 0, 1]]) b.glow(x + dx, 8.2, z + dz, ry ? 0.1 : 1.5, 1.5, ry ? 1.5 : 0.1, '#fff6c0');
      b.cCircle(x, z, 4.8, true);
      break;
    }
    case 'training': {
      b.cyl(x, 0, z, 3.5, 2, '#4a4f60', 16);
      b.cyl(x, 2, z, 2.7, 4, '#6b7488', 16);
      b.cyl(x, 6, z, 2, 5, '#4a4f60', 16);
      b.cyl(x, 11, z, 1.2, 3, '#ffb13a', 12);
      b.cone(x, 14, z, 1.5, 2.5, '#c0182e', 12);
      b.torus(x, 3, z, 3.2, '#ffb13a', 'glow', 1.2);
      b.rings.push({ x, y: 8.5, z, r: 3.3, color: '#ffcf5a', speed: 1.4, tilt: 0 });
      b.cCircle(x, z, 3.6, true);
      b.flags.push({ x: x + 1.2, y: 15, z, color: '#ff4d4d' });
      break;
    }
    case 'competition': {
      b.cyl(x, 0, z, 5.6, 7, '#e8dfd0', 28);
      b.cyl(x, 7, z, 6, 0.8, '#c0182e', 28);
      b.cyl(x, 0, z, 5.65, 0.12, '#8a8272', 28);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; b.box(x + Math.cos(a) * 5.62, 0, z + Math.sin(a) * 5.62, 1.2, 3.2, 0.6, '#3a3027', -a + Math.PI / 2); b.box(x + Math.cos(a) * 5.65, 3.9, z + Math.sin(a) * 5.65, 1.2, 2.4, 0.6, '#3a3027', -a + Math.PI / 2); }
      b.torus(x, 7.6, z, 5.8, '#ff4d6d', 'glow', 1.5);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.glow(x + Math.cos(a) * 5.4, 8, z + Math.sin(a) * 5.4, 0.4, 1.6, 0.4, '#ffb13a'); }
      b.cCircle(x, z, 5.8, true);
      break;
    }
    case 'elite': {
      b.box(x, 0, z, 6, 6, 6, '#3a3f66');
      b.wbox(x, 6, z, 4.4, 14, 4.4, '#59508a');
      b.wbox(x, 20, z, 3, 9, 3, '#4a4f7a');
      b.cone(x, 29, z, 1.5, 9, '#b57cff', 4);
      b.torus(x, 12, z, 4, '#b57cff', 'glow', 1.2);
      b.torus(x, 24, z, 3, '#35d0ff', 'glow', 1.2);
      b.rings.push({ x, y: 17, z, r: 4.6, color: '#c06bff', speed: -1.1, tilt: 0.25 });
      b.cBox(x, z, 6.2, 6.2, 0, true);
      break;
    }
    case 'championship': {
      b.cyl(x, 0, z, 5.8, 1.2, '#f4efe4', 28);
      b.cyl(x, 1.2, z, 5, 5, '#f4efe4', 28);
      b.dome(x, 6.2, z, 5.2, '#ffd24a', 0.9);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; b.cyl(x + Math.cos(a) * 5.4, 0, z + Math.sin(a) * 5.4, 0.35, 6, '#ffffff', 8); }
      b.torus(x, 6.3, z, 5.4, '#ffd24a', 'glow', 1.4);
      b.cyl(x, 10.8, z, 0.5, 2, '#ffd24a', 8);
      b.rings.push({ x, y: 13.5, z, r: 2.2, color: '#fff2b0', speed: 2.2, tilt: 0 }, { x, y: 13.5, z, r: 3.2, color: '#ffd24a', speed: -1.2, tilt: 0.5 });
      b.cCircle(x, z, 5.8, true);
      b.flags.push({ x: x + 3, y: 8, z: z + 3, color: '#ffd24a' }, { x: x - 3, y: 8, z: z - 3, color: '#ffd24a' });
      break;
    }
  }
  void accent;
}

const STYLE: Record<DistrictId, { gens: Gen[]; tree: string; fill: number }> = {
  residential: { gens: [house], tree: 'sakura', fill: 10 },
  shopping: { gens: [shopB], tree: 'round', fill: 4 },
  training: { gens: [dojo], tree: 'pine', fill: 9 },
  competition: { gens: [compB], tree: 'round', fill: 6 },
  elite: { gens: [skyscraper], tree: 'cypress', fill: 5 },
  championship: { gens: [palace], tree: 'gold', fill: 7 },
};

let cached: CityData | null = null;

export function buildCity(): CityData {
  if (cached) return cached;
  const b = new Builder(11);
  const busy: { x: number; z: number; r: number }[] = [
    ...RIVALS.map((r) => ({ ...r.home, r: 2.6 })), ...NPCS.map((n) => ({ ...n.home, r: 2.6 })),
    ...INTERACTABLES.map((i) => ({ x: i.x, z: i.z, r: 4.6 })),
  ];

  // --- ground, pads, roads (no colour jitter => no z-fighting flicker) ---
  b.use('ground');
  b.jitterOn = false;
  b.box(0, -0.2, 0, 300, 0.2, 230, '#6f9a5e');
  for (const id of Object.keys(PADS) as DistrictId[]) {
    const [x1, x2, z1, z2] = PADS[id];
    b.box((x1 + x2) / 2, 0, (z1 + z2) / 2, x2 - x1, 0.04, z2 - z1, DISTRICT_MAP[id].ground);
  }
  b.box(0, 0, 0, 220, 0.045, 24, '#a9a9b4');
  for (const [i, s] of EW.entries()) {
    b.box(0, 0, s.z, 220, 0.07, s.w + 4, '#c9c9d2');
    b.box(0, 0, s.z, 220, 0.10 + i * 0.001, s.w, '#3a3d48');
  }
  for (const [i, s] of NS.entries()) {
    b.box(s.x, 0, 0, s.w + 4, 0.075, 150, '#c9c9d2');
    b.box(s.x, 0, 0, s.w, 0.105 + i * 0.001, 150, '#3a3d48');
  }
  const inNS = (x: number, m: number) => NS.some((s) => Math.abs(x - s.x) < s.w / 2 + m);
  const inEW = (z: number, m: number) => EW.some((s) => Math.abs(z - s.z) < s.w / 2 + m);
  for (const s of EW) for (let x = -106; x <= 106; x += 4.5) if (!inNS(x, 2.5)) b.box(x, 0, s.z, 2.2, 0.125, 0.22, s.w > 10 ? '#f0e68c' : '#e6e6e6');
  for (const s of NS) for (let z = -68; z <= 68; z += 4.5) if (!inEW(z, 2.5)) b.box(s.x, 0, z, 0.22, 0.126, 2.2, '#e6e6e6');
  // crosswalks on the boulevard
  for (const s of NS) for (let i = -3; i <= 3; i++) b.box(s.x + i * 1.0, 0, 11, 0.5, 0.13, 2.4, '#f2f2f2'), b.box(s.x + i * 1.0, 0, -11, 0.5, 0.13, 2.4, '#f2f2f2');
  b.jitterOn = true;

  // --- lamps along streets ---
  b.use('props');
  for (const s of EW) for (const side of [-1, 1]) for (let x = -100; x <= 100; x += 14) {
    if (inNS(x, 4)) continue;
    if (s.z !== 0 && NS.some((n) => Math.abs(x - n.x) < 9)) continue;
    lamp(b, x, s.z + side * (s.w / 2 + 1.2), 0, -side);
  }
  for (const s of NS) for (const side of [-1, 1]) for (let z = -64; z <= 64; z += 14) {
    if (inEW(z, 4)) continue;
    lamp(b, s.x + side * (s.w / 2 + 1.2), z, -side, 0);
  }
  // parked cars
  const carCols = ['#e84a5f', '#2a9df4', '#f5c542', '#efefef', '#2ecc71', '#8e44ad', '#ff8a3d', '#333b4d'];
  let ci = 0;
  for (const s of EW) for (const side of [-1, 1]) for (let x = -96; x <= 96; x += 22) {
    const px = x + (b.rng() - 0.5) * 8;
    if (inNS(px, 6) || b.rng() < 0.45) continue;
    if (Math.abs(px - 76) < 12 && s.z !== 0) continue;
    car(b, px, s.z + side * (s.w / 2 - 1.3), Math.PI / 2, carCols[ci++ % carCols.length]);
  }

  // --- districts ---
  for (const id of Object.keys(PADS) as DistrictId[]) {
    const c = DISTRICT_CENTERS[id];
    b.use(CHUNK[id]);
    landmark(b, id);
    const st = STYLE[id];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const qi = (sx > 0 ? 1 : 0) + (sz > 0 ? 2 : 0);
      const slots: [number, number, number, number, number][] = [
        [c.x + sx * 23, c.z + sz * 13, Math.atan2(-sx, 0), 12, 10],
        [c.x + sx * 12, c.z + sz * 24, Math.atan2(0, -sz), 12, 8],
      ];
      slots.forEach(([x, z, rot, w, d], k) => {
        const L = new Local(b, x, z, rot);
        if (id === 'residential' && ((qi === 0 && k === 1) || (qi === 3 && k === 0))) park(L, w, d, b);
        else if (id === 'residential') house(L, w, d, b);
        else pick(b.rng, st.gens)(L, w, d, b);
      });
      // vegetation fill
      for (let n = 0; n < st.fill; n++) {
        const dx = 7 + b.rng() * 24, dz = 7 + b.rng() * 24;
        const inA = dx > 17 && dz > 6 && dz < 20, inB = dx < 19 && dz > 19;
        if (inA || inB) continue;
        const wx = c.x + sx * dx, wz = c.z + sz * dz;
        if (wx < -106 || wx > 106 || Math.abs(wz) < 12 || Math.abs(wz) > 70) continue;
        if (inNS(wx, 3.5) || busy.some((o) => Math.hypot(o.x - wx, o.z - wz) < o.r)) continue;
        tree(b, wx, wz, st.tree);
      }
    }
    for (const it of INTERACTABLES) if (it.district === id) feature(b, it);
  }

  // --- NPC placement colliders (non-tall) + perimeter + skyline ---
  for (const o of [...RIVALS.map((r) => r.home), ...NPCS.map((n) => n.home)]) b.cCircle(o.x, o.z, 0.5, false);
  b.use('edge');
  for (let x = -108; x <= 108; x += 6) for (const z of [-71, 71]) { tree(b, x + b.rng() * 2, z, b.rng() < 0.5 ? 'pine' : 'round'); }
  for (let z = -66; z <= 66; z += 6) for (const x of [-109, 109]) { tree(b, x, z + b.rng() * 2, b.rng() < 0.5 ? 'pine' : 'round'); }
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const side = i % 4;
    const px = side < 2 ? -120 + t * 240 : (side === 2 ? -128 : 128);
    const pz = side < 2 ? (side === 0 ? -86 : 86) : -80 + t * 160;
    const h = 24 + b.rng() * 40;
    b.wbox(px, 0, pz, 12 + b.rng() * 8, h, 12 + b.rng() * 8, pick(b.rng, ['#4a4f7a', '#3a3f66', '#59508a', '#2f6a8a', '#5a6a8a']));
  }
  cached = { chunks: b.finish(), colliders: b.colliders, rings: b.rings, jets: b.jets, flags: b.flags, floaters: b.floaters };
  return cached;
}
