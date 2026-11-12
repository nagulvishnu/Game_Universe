import * as THREE from 'three';
import { REGIONS, rng, type FloorSpec } from './data';
import { G, M, grp, mat, glowMat, addMat, buildPlayer } from './models';
import type { FX } from './fx';
import { sfx } from './audio';

export interface Obstacle { x: number; z: number; r: number; box?: boolean; hw?: number; hd?: number }
export interface Hazard { type: 'pulse' | 'slip' | 'dmg' | 'push' | 'sweeper' | 'slider'; x: number; z: number; r: number; t: number; cycle: number; state: number; mesh: THREE.Object3D; fill?: THREE.Mesh; ang: number; len: number; hit: boolean; dir: number; tick: number }
export interface Bounds { shape: 'rect' | 'circle'; hw: number; hd: number; r: number }
export interface World {
  group: THREE.Group; bounds: Bounds; obstacles: Obstacle[]; hazards: Hazard[]; entrance: THREE.Vector3; exit: THREE.Vector3; sun: THREE.DirectionalLight; lights: THREE.PointLight[];
  portal: THREE.Group; setPortal(on: boolean): void; update(dt: number, t: number, px: number, pz: number, py: number, env: EnvCb): void;
  collide(x: number, z: number, r: number): [number, number]; blocked(x: number, z: number, r: number): boolean; seg(ax: number, az: number, bx: number, bz: number, m?: number): number;
  point(rand: () => number, margin?: number, avoid?: [number, number, number][]): [number, number]; dispose(): void; secret?: THREE.Vector3; secretMesh?: THREE.Object3D; ambient: { kind: string; color: number };
}
export interface EnvCb { hurt(frac: number, src: string): void; slip(): void; push(dx: number, dz: number): void }

// ---------- textures ----------
const texCache = new Map<number, THREE.CanvasTexture>();
function groundTex(reg: number, hubMode = false): THREE.CanvasTexture {
  const key = hubMode ? 99 : reg; const hit = texCache.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!; const r = rng(reg * 31 + 5);
  const R = REGIONS[reg], hex = (n: number, k = 1) => `rgb(${Math.min(255, ((n >> 16) & 255) * k) | 0},${Math.min(255, ((n >> 8) & 255) * k) | 0},${Math.min(255, (n & 255) * k) | 0})`;
  x.fillStyle = hex(hubMode ? 0xb09a80 : R.ground); x.fillRect(0, 0, 256, 256);
  const tiles = (n: number, grout: string, v = 0.12) => { const s = 256 / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = 1 - v + r() * v * 2; x.fillStyle = hex(hubMode ? 0xb09a80 : R.ground, k); x.fillRect(i * s + 1, j * s + 1, s - 2, s - 2); } x.strokeStyle = grout; x.lineWidth = 2; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 256); x.moveTo(0, i * s); x.lineTo(256, i * s); x.stroke(); } };
  const cracks = (n: number, col: string, w = 1.5, glow = 0) => { x.strokeStyle = col; x.lineWidth = w; x.shadowColor = col; x.shadowBlur = glow; for (let i = 0; i < n; i++) { let px = r() * 256, py = r() * 256; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 50; py += (r() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); } x.shadowBlur = 0; };
  if (hubMode) { tiles(8, 'rgba(60,40,30,0.5)', 0.1); cracks(4, 'rgba(60,40,30,0.4)'); }
  else switch (reg) {
    case 0: tiles(4, 'rgba(20,20,25,0.7)'); cracks(6, 'rgba(20,20,25,0.6)'); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(60,90,50,${r() * 0.2})`; x.fillRect(r() * 256, r() * 256, 4 + r() * 12, 4 + r() * 8); } break;
    case 1: for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.18})`; x.beginPath(); x.moveTo(r() * 256, r() * 256); for (let k = 0; k < 3; k++) x.lineTo(r() * 256, r() * 256); x.fill(); } cracks(8, 'rgba(255,255,255,0.7)', 1); cracks(4, 'rgba(60,100,160,0.5)', 1.5); break;
    case 2: x.fillStyle = '#1a0e0a'; x.fillRect(0, 0, 256, 256); tiles(4, 'rgba(0,0,0,0.6)', 0.2); cracks(9, '#ff6a1a', 2, 10); cracks(5, '#ffcc44', 1, 6); break;
    case 3: for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(${(30 + r() * 60) | 0},${(90 + r() * 90) | 0},${(30 + r() * 40) | 0},0.5)`; x.lineWidth = 1; const px = r() * 256, py = r() * 256; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py - 4 - r() * 8); x.stroke(); } for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(90,60,30,${r() * 0.25})`; x.beginPath(); x.arc(r() * 256, r() * 256, 5 + r() * 15, 0, 7); x.fill(); } break;
    case 4: for (let i = 0; i < 16; i++) { x.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.08})`; x.lineWidth = 2; x.beginPath(); for (let k = 0; k <= 256; k += 8) x.lineTo(k, i * 16 + Math.sin(k * 0.05 + i) * 5); x.stroke(); } x.strokeStyle = 'rgba(120,255,240,0.35)'; x.lineWidth = 1.5; for (let i = 0; i < 12; i++) { x.beginPath(); const px = r() * 256, py = r() * 256; x.arc(px, py, 10 + r() * 24, 0, 2.5 + r() * 3); x.stroke(); } break;
    case 5: tiles(2, 'rgba(10,12,20,0.9)', 0.08); x.strokeStyle = '#44ccff'; x.shadowColor = '#44ccff'; x.shadowBlur = 8; x.lineWidth = 2; x.strokeRect(6, 6, 116, 116); x.strokeStyle = '#ff3df0'; x.shadowColor = '#ff3df0'; x.strokeRect(134, 134, 116, 116); x.shadowBlur = 0; for (let i = 0; i < 24; i++) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(((i % 4) * 64) + 6, (Math.floor(i / 4) * 42) + 6, 3, 3); } break;
    case 6: for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '30,20,20' : '200,170,140'},${r() * 0.15})`; x.beginPath(); x.arc(r() * 256, r() * 256, 3 + r() * 14, 0, 7); x.fill(); } cracks(6, 'rgba(20,10,10,0.6)', 2); break;
    case 7: x.fillStyle = '#150e22'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(176,106,255,0.35)'; x.lineWidth = 1; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 256); x.moveTo(0, i * 32); x.lineTo(256, i * 32); x.stroke(); } for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(200,140,255,${r() * 0.8})`; x.fillRect(r() * 256, r() * 256, 2, 2); } break;
    case 8: tiles(2, 'rgba(200,160,60,0.9)', 0.06); x.strokeStyle = 'rgba(180,170,150,0.5)'; x.lineWidth = 1; for (let i = 0; i < 14; i++) { x.beginPath(); let px = r() * 256, py = r() * 256; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (r() - 0.3) * 40; py += (r() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); } x.strokeStyle = 'rgba(255,226,122,0.8)'; x.lineWidth = 3; x.strokeRect(64, 64, 128, 128); break;
    default: x.fillStyle = '#0c0c20'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(102,255,238,0.4)'; x.lineWidth = 1.5; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.047, px = 32 + i * 64 + (j % 2) * 32 + Math.cos(a) * 28, py = 32 + j * 64 + Math.sin(a) * 28; if (k) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); x.stroke(); } for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${r()})`; x.fillRect(r() * 256, r() * 256, 1.5, 1.5); } cracks(3, 'rgba(255,85,255,0.6)', 1.5, 8);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(key, t); return t;
}

function skyDome(top: number, bottom: number, stars: boolean): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { t: { value: new THREE.Color(top) }, b: { value: new THREE.Color(bottom) } }, vertexShader: 'varying vec3 p; void main(){ p=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'varying vec3 p; uniform vec3 t; uniform vec3 b; void main(){ float h=smoothstep(-0.1,0.7,p.y); gl_FragColor=vec4(mix(b,t,h),1.0); }' });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), m));
  if (stars) { const n = 500, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = Math.random() * 6.28, ph = Math.acos(Math.random() * 0.9 + 0.1), r = 380; a[i * 3] = Math.sin(ph) * Math.cos(th) * r; a[i * 3 + 1] = Math.cos(ph) * r; a[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r; } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }))); }
  return g;
}

// ---------- props ----------
function prop(reg: number, r: number, rand: () => number, broken = false): THREE.Group {
  const R = REGIONS[reg], g = new THREE.Group(), stone = mat(R.ground, { rough: 0.9, flat: true }), dark = mat(new THREE.Color(R.ground).multiplyScalar(0.55).getHex(), { rough: 0.9, flat: true });
  const h = (broken ? 2 + rand() * 2 : 5 + rand() * 3) * (0.7 + r * 0.3);
  switch (reg) {
    case 0: case 8: {
      const gold = reg === 8, cm = gold ? mat(0xf4ecd6, { rough: 0.3, metal: 0.2 }) : stone;
      M(g, G.cyl(r * 1.25, r * 1.4, 0.5, 10), dark, [0, 0.25, 0]); M(g, G.cyl(r, r * 1.05, h, 12), cm, [0, h / 2 + 0.5, 0]);
      for (let i = 0; i < 6; i++) M(g, G.box(0.1, h * 0.9, 0.12), dark, [Math.cos(i) * r, h / 2 + 0.5, Math.sin(i) * r], [0, -i, 0], 1, false);
      if (!broken) { M(g, G.box(r * 2.6, 0.5, r * 2.6), gold ? mat(0xffe27a, { metal: 0.8, rough: 0.3, em: 0xffd860, ei: 0.4 }) : dark, [0, h + 0.75, 0]); if (gold) M(g, G.tor(r * 1.5, 0.05, 6, 24), glowMat(0xffe27a, 2), [0, h * 0.6, 0], [Math.PI / 2, 0, 0], 1, false); }
      else for (let i = 0; i < 3; i++) M(g, G.box(0.6 + rand() * 0.5, 0.4, 0.5), stone, [(rand() - 0.5) * r * 3, 0.2, (rand() - 0.5) * r * 3], [rand(), rand(), 0]);
      if (!gold && reg === 0) M(g, G.sph(r * 0.9, 6, 4), mat(0x3a5a30, { rough: 1 }), [r * 0.5, h * 0.3, r * 0.4], undefined, [1, 0.5, 1]);
      break;
    }
    case 1: case 7: case 9: {
      const col = reg === 1 ? 0x9ed8f5 : reg === 7 ? 0x2a1a44 : 0x1a1a3a, em = reg === 1 ? 0x66ccff : reg === 7 ? 0xb06aff : 0x66ffee;
      const m = reg === 1 ? mat(col, { rough: 0.15, metal: 0.1, em, ei: 0.35, op: 0.88 }) : mat(col, { rough: 0.5, metal: 0.4, em, ei: 0.25, flat: true });
      if (reg === 9) { M(g, G.box(r * 1.5, h * 1.3, r * 0.6), m, [0, h * 0.65, 0], [0, rand(), 0]); M(g, G.box(0.1, h * 0.9, r * 0.62), glowMat(em, 2.5), [0, h * 0.65, 0], [0, 0, 0], 1, false); }
      else for (let i = 0; i < 4; i++) { const hh = h * (0.5 + rand() * 0.7) * (i ? 0.7 : 1.1); M(g, G.cone(r * (i ? 0.45 : 0.7), hh, 5), m, [i ? Math.cos(i * 2) * r * 0.9 : 0, hh / 2, i ? Math.sin(i * 2) * r * 0.9 : 0], [0, 0, (i ? 1 : 0) * Math.cos(i) * 0.25]); }
      break;
    }
    case 2: case 6: {
      const m = reg === 2 ? mat(0x2a2220, { rough: 0.8, flat: true }) : mat(0x6a5a52, { rough: 0.9, flat: true });
      for (let i = 0; i < 5; i++) { const hh = h * (0.5 + rand() * 0.6) * (i ? 0.8 : 1), a = i * 1.3; M(g, G.cyl(r * (i ? 0.38 : 0.6), r * (i ? 0.5 : 0.8), hh, 6), m, [i ? Math.cos(a) * r * 0.85 : 0, hh / 2, i ? Math.sin(a) * r * 0.85 : 0], [0, 0, i ? Math.sin(a) * 0.1 : 0]); }
      if (reg === 2) M(g, G.sph(r * 0.45, 8, 6), glowMat(0xff7a22, 2.2), [0, h * 0.95, 0], undefined, [1, 0.45, 1], false); else for (let i = 0; i < 3; i++) M(g, G.cone(0.12, 1.1, 4), mat(0xe8dcc0), [Math.cos(i * 2.1) * r * 1.1, 0.5, Math.sin(i * 2.1) * r * 1.1], [0.4, 0, Math.cos(i) * 0.4]);
      break;
    }
    case 3: {
      const trunk = mat(0x4a3220, { rough: 1 }), leaf = mat(0x2a6a30, { rough: 0.9, flat: true });
      M(g, G.cyl(r * 0.8, r * 1.2, h * 1.6, 8), trunk, [0, h * 0.8, 0]); for (let i = 0; i < 3; i++) M(g, G.sph(r * (2.2 - i * 0.4), 8, 6), leaf, [Math.cos(i * 2) * 0.6, h * 1.6 + i * 0.6, Math.sin(i * 2) * 0.6], undefined, [1, 0.7, 1]);
      for (let i = 0; i < 3; i++) M(g, G.sph(0.18, 6, 5), glowMat(0x88ffaa, 2), [Math.cos(i * 2.2) * r * 1.2, 0.2, Math.sin(i * 2.2) * r * 1.2], undefined, [1, 0.6, 1], false);
      break;
    }
    case 4: {
      M(g, G.cyl(r, r * 1.1, h * 0.8, 10), mat(0x7ab8c0, { rough: 0.8 }), [0, h * 0.4, 0]); const cor = [0xff6a8a, 0xffaa44, 0xc86aff];
      for (let i = 0; i < 6; i++) M(g, G.cone(0.2, 0.9 + rand(), 5), mat(cor[i % 3], { rough: 0.7, em: cor[i % 3], ei: 0.3 }), [Math.cos(i) * r * 1.0, 0.5, Math.sin(i) * r * 1.0], [0, 0, Math.cos(i) * 0.3]);
      M(g, G.tor(r * 1.15, 0.12, 5, 16), mat(0x8ab8c8), [0, h * 0.8, 0], [Math.PI / 2, 0, 0]);
      break;
    }
    case 5: {
      const metal = mat(0x4a5266, { metal: 0.8, rough: 0.35 }), neon = glowMat(reg === 5 ? (rand() > 0.5 ? 0x44ccff : 0xff3df0) : 0x44ccff, 2.5);
      M(g, G.box(r * 1.8, h, r * 1.5), metal, [0, h / 2, 0]); for (let i = 0; i < 4; i++) M(g, G.box(r * 1.5, 0.08, 0.05), neon, [0, h * (0.2 + i * 0.2), r * 0.76], undefined, 1, false);
      M(g, G.cyl(0.2, 0.2, h * 0.7, 6), mat(0x2a2e3a, { metal: 0.6 }), [r * 1.0, h * 0.35, 0]); M(g, G.box(r * 0.5, 0.4, r * 0.5), neon, [0, h + 0.2, 0], undefined, 1, false);
      break;
    }
  }
  return g;
}

function farProps(reg: number, scene: THREE.Group, R: number) {
  const count = 26, rand = rng(reg + 99), c = REGIONS[reg];
  const geos: THREE.BufferGeometry[] = [G.cone(1, 1, 6), G.cone(1, 1, 5), G.cone(1, 1, 6), G.cone(1, 1.4, 5), G.cone(1, 1, 5), G.box(1, 1, 1), G.cone(1, 1, 5), G.oct(1), G.cyl(1, 0.4, 0.5, 10), G.ico(1)];
  const col = new THREE.Color(c.fog).multiplyScalar(1.5).lerp(new THREE.Color(c.accent), 0.15);
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true, emissive: new THREE.Color(c.glow), emissiveIntensity: reg === 5 || reg === 9 || reg === 7 ? 0.12 : 0.02 });
  const im = new THREE.InstancedMesh(geos[reg], m, count), d = new THREE.Object3D(), floaty = reg === 7 || reg === 8 || reg === 9;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * 6.283 + rand() * 0.2, rr = R + 45 + rand() * 60, s = 12 + rand() * 30;
    d.position.set(Math.cos(a) * rr, floaty ? 8 + rand() * 50 : s * (reg === 5 ? 1.2 : 0.35), Math.sin(a) * rr);
    d.scale.set(s * (reg === 5 ? 0.5 : 1), s * (reg === 5 ? 3 : 1.2), s * (reg === 5 ? 0.5 : 1)); d.rotation.set(floaty ? rand() : 0, rand() * 6, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
  }
  scene.add(im);
}

// ---------- floor ----------
export function buildFloor(spec: FloorSpec, scene: THREE.Scene, fx: FX, q: { shadow: number; view: number; mobile: boolean }): World {
  const reg = spec.region, R = REGIONS[reg], rand = rng(spec.seed), group = new THREE.Group(); scene.add(group);
  const bounds: Bounds = { shape: 'rect', hw: 22, hd: 16, r: 22 }, obstacles: Obstacle[] = [], hazards: Hazard[] = [], lights: THREE.PointLight[] = [];
  const entrance = new THREE.Vector3(), exit = new THREE.Vector3();
  const bossy = spec.type === 'boss' || spec.mode === 'bossrush';
  const voidy = reg === 6 || reg === 7 || reg === 8 || reg === 9;
  switch (spec.layout) {
    case 'arena': Object.assign(bounds, { shape: 'circle', r: bossy ? 30 : spec.type === 'miniboss' ? 26 : 23 }); break;
    case 'ring': Object.assign(bounds, { shape: 'circle', r: 26 }); break;
    case 'vault': Object.assign(bounds, { shape: 'circle', r: 15 }); break;
    case 'hall': Object.assign(bounds, { hw: 22, hd: 17 }); break;
    case 'cross': case 'ruin': Object.assign(bounds, { hw: 25, hd: 25 }); break;
    case 'corridor': Object.assign(bounds, { hw: 8, hd: 46 }); break;
  }
  const circle = bounds.shape === 'circle', Rd = circle ? bounds.r : 0;
  const zs = circle ? Rd : bounds.hd;
  entrance.set(0, 0, zs - 3.5); exit.set(0, 0, -zs + 3.5);
  if (bossy || spec.type === 'secret') exit.set(0, 0, -zs * 0.55);

  // scene environment
  scene.background = new THREE.Color(R.sky); scene.fog = new THREE.FogExp2(R.fog, R.fogD / q.view);
  const sky = skyDome(R.sky, R.fog, reg === 7 || reg === 9 || reg === 5); sky.name = 'sky'; group.add(sky);
  const hemi = new THREE.HemisphereLight(R.hemi, new THREE.Color(R.ground).multiplyScalar(0.3).getHex(), reg === 8 ? 1.5 : 1.0); group.add(hemi);
  const sun = new THREE.DirectionalLight(R.sun, reg === 8 ? 2.4 : 2.0); sun.position.set(20, 40, 15); sun.castShadow = q.shadow > 0;
  const ss = q.shadow === 3 ? 2048 : q.shadow === 2 ? 1536 : 1024; sun.shadow.mapSize.set(ss, ss); const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  group.add(sun, sun.target);
  const amb = new THREE.AmbientLight(R.hemi, 0.35); group.add(amb);

  // ground
  const gw = (circle ? Rd : Math.max(bounds.hw, bounds.hd)) * 2 + 10;
  const tex = groundTex(reg).clone(); tex.needsUpdate = true; tex.repeat.set(gw / 10, gw / 10);
  const gm = new THREE.MeshStandardMaterial({ map: tex, roughness: reg === 1 ? 0.25 : reg === 8 ? 0.35 : 0.85, metalness: reg === 5 ? 0.4 : 0.05, color: 0xffffff });
  const gMesh = circle ? new THREE.Mesh(new THREE.CircleGeometry(Rd + 1, 64), gm) : new THREE.Mesh(new THREE.PlaneGeometry(bounds.hw * 2 + 2, bounds.hd * 2 + 2), gm);
  if (circle) { const uv = (gMesh.geometry as THREE.CircleGeometry).attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - 0.5) * 2, (uv.getY(i) - 0.5) * 2); tex.repeat.set(Rd / 5, Rd / 5); } else tex.repeat.set(bounds.hw / 5, bounds.hd / 5);
  gMesh.rotation.x = -Math.PI / 2; gMesh.receiveShadow = true; group.add(gMesh);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: voidy ? new THREE.Color(R.fog).multiplyScalar(0.8) : new THREE.Color(R.ground).multiplyScalar(0.25) }));
  under.rotation.x = -Math.PI / 2; under.position.y = voidy ? -14 : -0.05; group.add(under);
  // boundary
  const wallH = voidy ? 1.0 : 7, wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(R.ground).multiplyScalar(0.5), roughness: 0.9, flatShading: true, side: THREE.DoubleSide, emissive: new THREE.Color(R.glow), emissiveIntensity: reg === 5 || reg === 2 ? 0.08 : 0 });
  const post = (x: number, z: number, hgt: number) => { const p = prop(reg, 0.55, rand, false); p.position.set(x, 0, z); p.scale.y = hgt; group.add(p); };
  if (circle) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(Rd + 1, Rd + 1, wallH, 48, 1, true), wallMat); w.position.y = wallH / 2; group.add(w);
    const n = Math.round(Rd * 0.9); for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; if (Math.abs(a - 3.1416 / 1) < 0.0 && false) continue; const p = prop(reg, 0.6 + rand() * 0.3, rand, voidy ? rand() > 0.4 : false); p.position.set(Math.sin(a) * (Rd + 1.4), 0, Math.cos(a) * (Rd + 1.4)); group.add(p); }
  } else {
    for (const [cx, cz, ww, dd] of [[0, -bounds.hd - 1, bounds.hw * 2 + 4, 1], [0, bounds.hd + 1, bounds.hw * 2 + 4, 1], [-bounds.hw - 1, 0, 1, bounds.hd * 2 + 2], [bounds.hw + 1, 0, 1, bounds.hd * 2 + 2]]) { const w = new THREE.Mesh(new THREE.BoxGeometry(ww, wallH, dd), wallMat); w.position.set(cx, wallH / 2, cz); group.add(w); }
    for (let x = -bounds.hw; x <= bounds.hw; x += 5) { post(x, -bounds.hd - 1.5, 1); post(x, bounds.hd + 1.5, 1); }
    for (let z = -bounds.hd + 5; z < bounds.hd; z += 5) { post(-bounds.hw - 1.5, z, 1); post(bounds.hw + 1.5, z, 1); }
  }
  if (voidy) { const rim = new THREE.Mesh(circle ? new THREE.TorusGeometry(Rd + 1, 0.12, 6, 64) : new THREE.BoxGeometry(bounds.hw * 2 + 2, 0.12, bounds.hd * 2 + 2), glowMat(R.glow, 2)); if (circle) { rim.rotation.x = Math.PI / 2; rim.position.y = 1.1; } else { rim.visible = false; } group.add(rim); }
  farProps(reg, group, circle ? Rd : Math.max(bounds.hw, bounds.hd));

  const w: World = {
    group, bounds, obstacles, hazards, entrance, exit, sun, lights, portal: new THREE.Group(), ambient: { kind: R.ambient, color: R.glow },
    setPortal() { /* set below */ }, update() { /* set below */ },
    collide(x, z, r) {
      for (const o of obstacles) {
        if (o.box) { const dx = x - o.x, dz = z - o.z, ex = Math.abs(dx) - o.hw! , ez = Math.abs(dz) - o.hd!; if (ex < r && ez < r) { if (ex > ez) x = o.x + Math.sign(dx || 1) * (o.hw! + r); else z = o.z + Math.sign(dz || 1) * (o.hd! + r); } }
        else { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = o.r + r; if (d < m) { const k = d < 0.001 ? 1 : m / d; x = o.x + (d < 0.001 ? m : dx * k); z = o.z + (d < 0.001 ? 0 : dz * k); } }
      }
      if (circle) { const d = Math.hypot(x, z), m = Rd - r; if (d > m) { x *= m / d; z *= m / d; } } else { x = Math.max(-bounds.hw + r, Math.min(bounds.hw - r, x)); z = Math.max(-bounds.hd + r, Math.min(bounds.hd - r, z)); }
      return [x, z];
    },
    blocked(x, z, r) { const [nx, nz] = this.collide(x, z, r); return Math.abs(nx - x) > 0.01 || Math.abs(nz - z) > 0.01; },
    seg(ax, az, bx, bz, m = 0.4) { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.6); for (let i = 1; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (this.blocked(x, z, m)) return Math.max(0, (i - 1) / n); } return 1; },
    point(rd, margin = 3, avoid = []) {
      for (let k = 0; k < 60; k++) {
        const x = circle ? (rd() * 2 - 1) * (Rd - margin) : (rd() * 2 - 1) * (bounds.hw - margin), z = circle ? (rd() * 2 - 1) * (Rd - margin) : (rd() * 2 - 1) * (bounds.hd - margin);
        if (circle && Math.hypot(x, z) > Rd - margin) continue;
        if (this.blocked(x, z, 1.2)) continue; if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
        return [x, z];
      }
      return [0, 0];
    },
    dispose() { scene.remove(group); group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.own) m.geometry.dispose(); }); tex.dispose(); gm.dispose(); lights.length = 0; },
  };

  // layout obstacles
  const addProp = (x: number, z: number, r: number, broken = false) => { const p = prop(reg, r, rand, broken); p.position.set(x, 0, z); p.rotation.y = rand() * 6; group.add(p); obstacles.push({ x, z, r: r * 1.15 }); };
  const keep: [number, number, number][] = [[entrance.x, entrance.z, 7], [exit.x, exit.z, 7], [0, 0, spec.layout === 'ring' ? 0 : bossy ? 14 : 5]];
  switch (spec.layout) {
    case 'hall': for (let i = -3; i <= 3; i++) { if (Math.abs(i) < 1) continue; for (const sz of [-1, 1]) addProp(i * 5.5, sz * 8, 0.9, rand() < 0.2); } break;
    case 'ruin': for (let i = 0; i < 14; i++) { const [x, z] = w.point(rand, 5, keep); addProp(x, z, 0.8 + rand() * 0.9, rand() < 0.5); keep.push([x, z, 3.5]); } break;
    case 'ring': { const p = prop(reg, 4.2, rand); p.scale.setScalar(1.4); group.add(p); obstacles.push({ x: 0, z: 0, r: 5.8 }); for (let i = 0; i < 5; i++) { const a = i * 1.2566 + 0.3; addProp(Math.cos(a) * 15, Math.sin(a) * 15, 0.9, rand() < 0.3); } break; }
    case 'cross': for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const ob: Obstacle = { x: sx * 16, z: sz * 16, r: 9, box: true, hw: 7, hd: 7 }; obstacles.push(ob); const b = M(group, G.box(14, 3.2, 14), mat(new THREE.Color(R.ground).multiplyScalar(0.6).getHex(), { rough: 0.9, flat: true }), [ob.x, 1.6, ob.z]); b.receiveShadow = true; addProp(ob.x + 3, ob.z + 3, 1.2); addProp(ob.x - 3, ob.z - 3, 1.0, true); } break;
    case 'arena': if (!bossy) for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.5; addProp(Math.cos(a) * (Rd * 0.62), Math.sin(a) * (Rd * 0.62), 0.85, rand() < 0.4); } else for (let i = 0; i < 8; i++) { const a = i * 0.785; addProp(Math.cos(a) * (Rd - 3), Math.sin(a) * (Rd - 3), 1.1, false); } break;
    case 'corridor': for (let z = -bounds.hd + 12; z < bounds.hd - 8; z += 14) { const side = rand() < 0.5 ? -1 : 1; addProp(side * 6.4, z, 0.9, rand() < 0.3); } break;
    case 'vault': for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.78; addProp(Math.cos(a) * 11, Math.sin(a) * 11, 0.8, false); } break;
  }
  // decor scatter
  const dn = q.mobile ? 50 : 110, dg = [G.cone(0.15, 0.5, 4), G.box(0.3, 0.2, 0.3), G.cone(0.12, 0.7, 5), G.cone(0.1, 0.5, 4), G.cone(0.2, 0.3, 5), G.box(0.25, 0.08, 0.25), G.cone(0.2, 0.6, 4), G.oct(0.2), G.cyl(0.18, 0.18, 0.04, 6), G.oct(0.15)][reg];
  const dm = new THREE.MeshStandardMaterial({ color: new THREE.Color(R.accent).multiplyScalar(reg === 2 || reg === 9 ? 0.6 : 0.8), roughness: 0.8, flatShading: true, emissive: new THREE.Color(R.glow), emissiveIntensity: reg === 2 || reg === 5 || reg === 7 || reg === 9 ? 0.5 : 0.04 });
  const dim = new THREE.InstancedMesh(dg, dm, dn), dd = new THREE.Object3D(); dim.receiveShadow = true;
  for (let i = 0; i < dn; i++) { const [x, z] = w.point(rand, 1, []); dd.position.set(x, 0.1, z); dd.rotation.set(0, rand() * 6, (rand() - 0.5) * 0.4); const s = 0.5 + rand() * 1.4; dd.scale.set(s, s * (0.6 + rand()), s); dd.updateMatrix(); dim.setMatrixAt(i, dd.matrix); }
  group.add(dim);

  // lights (limited)
  const nl = q.mobile ? 2 : 4;
  for (let i = 0; i < nl; i++) {
    const [x, z] = i === 0 ? [entrance.x, entrance.z - 2] : i === 1 ? [exit.x, exit.z + 2] : w.point(rand, 4, []);
    const l = new THREE.PointLight(R.glow, 28, 24, 1.6); l.position.set(x, 3.2, z); l.userData.base = 28; l.userData.ph = rand() * 6; group.add(l); lights.push(l);
    const b = M(group, G.cyl(0.25, 0.35, 2.4, 6), mat(0x2a2a30, { metal: 0.6 }), [x, 1.2, z]); void b; M(group, G.sph(0.28, 8, 6), glowMat(R.glow, 3), [x, 2.6, z], undefined, [1, 1.3, 1], false);
    if (circle ? Math.hypot(x, z) > 0 : true) obstacles.push({ x, z, r: 0.45 });
  }
  // entrance gate
  const gate = grp(group, [entrance.x, 0, entrance.z + 2.8]);
  for (const sx of [-1, 1]) M(gate, G.box(0.9, 5.5, 0.9), mat(new THREE.Color(R.ground).multiplyScalar(0.6).getHex(), { flat: true }), [sx * 2.6, 2.75, 0]);
  M(gate, G.box(6.4, 0.9, 1), mat(R.accent, { metal: 0.6, rough: 0.4, em: R.glow, ei: 0.2 }), [0, 5.6, 0]); M(gate, G.tor(2.4, 0.08, 6, 24, Math.PI), glowMat(R.glow, 2), [0, 3.4, 0], undefined, 1, false);
  // portal
  const portal = w.portal; portal.position.copy(exit);
  const ringM = glowMat(0xff3a3a, 2.5), disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32), new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  M(portal, G.tor(2.0, 0.14, 8, 36), ringM, [0, 2.2, 0], undefined, 1, false); disc.position.y = 2.2; portal.add(disc);
  const pbeam = M(portal, G.cyl(1.4, 1.8, 14, 14, ), addMat(0xff3a3a, 0.0), [0, 7, 0], undefined, 1, false); (pbeam.material as THREE.Material).opacity = 0;
  for (let i = 0; i < 3; i++) M(portal, G.tor(2.4 + i * 0.4, 0.04, 6, 30), glowMat(0xffffff, 1, 0.5), [0, 0.15 + i * 0.02, 0], [Math.PI / 2, 0, 0], 1, false);
  portal.visible = true; group.add(portal);
  let active = false;
  const pcol = new THREE.Color();
  w.setPortal = (on: boolean) => { active = on; const c = on ? (spec.type === 'secret' ? 0xffd860 : R.glow === 0xff3df0 ? 0x44ccff : 0x66ddff) : 0xff3a3a; pcol.setHex(c); (ringM as THREE.MeshStandardMaterial).color.setHex(c); (ringM as THREE.MeshStandardMaterial).emissive.setHex(c); (disc.material as THREE.MeshBasicMaterial).color.setHex(c); (disc.material as THREE.MeshBasicMaterial).opacity = on ? 0.55 : 0.18; (pbeam.material as THREE.MeshBasicMaterial).color.setHex(c); (pbeam.material as THREE.Material).opacity = on ? 0.16 : 0; if (on) { fx.burst(exit.x, 2, exit.z, c, 60, 8, 1, 0.3, 2); fx.ring(exit.x, 0, exit.z, c, 7, 0.8); sfx('portal'); } };
  w.setPortal(false);

  // secret sigil
  if (spec.hasSecret && spec.type !== 'secret') {
    const [sx, sz] = w.point(rng(spec.seed + 5), 3, [[entrance.x, entrance.z, 10], [exit.x, exit.z, 10]]);
    const s = new THREE.Group(); s.position.set(sx, 0.1, sz);
    M(s, G.tor(1.6, 0.05, 5, 32), glowMat(0xc07aff, 1.4, 0.5), [0, 0, 0], [Math.PI / 2, 0, 0], 1, false); const c2 = M(s, G.cyl(1.6, 1.6, 0.02, 24), addMat(0xc07aff, 0.12), [0, 0.02, 0], undefined, 1, false); void c2;
    group.add(s); w.secret = new THREE.Vector3(sx, 0, sz); w.secretMesh = s; s.visible = true;
  }

  // hazards
  const hn = spec.type === 'trap' || spec.type === 'secret' || spec.mode === 'training' ? 0 : spec.n === 1 ? 0 : Math.min(7, 1 + Math.floor(((spec.n - 1) % 10) / 2) + (R.hazard === 'pulse' ? 1 : 0)) * (spec.type === 'boss' ? 0 : 1);
  const hcol = [0xff7a22, 0x88eeff, 0xff5a1a, 0x88ff33, 0x66ddff, 0x44ddff, 0xff9a44, 0xc040ff, 0xfff0a0, 0xff55ff][reg];
  const hr = rng(spec.seed + 777);
  const mkHaz = (type: Hazard['type'], x: number, z: number, r: number): Hazard => {
    const gp = new THREE.Group(); gp.position.set(x, 0.06, z); group.add(gp);
    let fill: THREE.Mesh | undefined;
    if (type === 'dmg') { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshStandardMaterial({ color: hcol, emissive: hcol, emissiveIntensity: 1.2, roughness: 0.4, transparent: true, opacity: 0.88 })); m.rotation.x = -Math.PI / 2; gp.add(m); fill = m; M(gp, G.tor(r, 0.1, 5, 28), glowMat(hcol, 2), [0, 0.03, 0], [Math.PI / 2, 0, 0], 1, false); }
    else if (type === 'slip') { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshStandardMaterial({ color: 0xcfeaff, roughness: 0.02, metalness: 0.6, transparent: true, opacity: 0.6, emissive: 0x4a8ac0, emissiveIntensity: 0.3 })); m.rotation.x = -Math.PI / 2; gp.add(m); }
    else if (type === 'push') { for (let i = 0; i < 3; i++) M(gp, G.tor(r * (0.35 + i * 0.3), 0.07, 5, 28), glowMat(hcol, 1.6, 0.8), [0, 0.04 + i * 0.01, 0], [Math.PI / 2, 0, 0], 1, false); const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: hcol, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; gp.add(m); }
    else { const base = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 32), new THREE.MeshBasicMaterial({ color: hcol, transparent: true, opacity: 0.4, side: THREE.DoubleSide })); base.rotation.x = -Math.PI / 2; gp.add(base); fill = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: hcol, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.scale.setScalar(0.01); gp.add(fill); }
    const hz: Hazard = { type, x, z, r, t: hr() * 4, cycle: 4.2 + hr() * 1.5, state: 0, mesh: gp, fill, ang: hr() * 6, len: r, hit: false, dir: 1, tick: 0 };
    hazards.push(hz); return hz;
  };
  for (let i = 0; i < hn; i++) {
    const [x, z] = w.point(hr, 5, [[entrance.x, entrance.z, 8], [exit.x, exit.z, 8], [0, 0, 3]]);
    const ty = R.hazard; const r = ty === 'pulse' ? 3 : ty === 'dmg' ? 2.4 + hr() * 1.6 : ty === 'push' ? 4.5 : 3.5;
    mkHaz(ty, x, z, r);
  }
  if (spec.type === 'trap') {
    const len = bounds.hd * 2, n = 7;
    for (let i = 0; i < n; i++) {
      const z = bounds.hd - 12 - i * ((len - 24) / (n - 1)), k = i % 3;
      if (k === 0) { const h = mkHaz('sweeper', 0, z, 0); h.len = 6.6; h.ang = hr() * 6; h.dir = i % 2 ? 1 : -1; gate4(h, hcol, R.hazard); }
      else if (k === 1) { const h = mkHaz('slider', 0, z, 1.2); h.len = 7; h.t = hr() * 6; blade(h, hcol); }
      else { for (let j = -1; j <= 1; j++) mkHaz('pulse', j * 4.2, z, 2.1).t = (j + 1) * 1.3; }
    }
  }
  function gate4(h: Hazard, col: number, kind: string) {
    const arm = grp(h.mesh as THREE.Group, [0, 1.0, 0]); h.fill = undefined; (h.mesh as THREE.Group).userData.arm = arm;
    M(h.mesh as THREE.Group, G.cyl(0.6, 0.8, 2.4, 8), mat(0x2a2a30, { metal: 0.6 }), [0, 1.2, 0]);
    const bm = glowMat(col, 1.8); for (const s of [-1, 1]) { M(arm, G.box(6.5, 0.22, 0.22), mat(0x30303a, { metal: 0.7 }), [s * 3.4, 0, 0]); for (let k = 1; k <= 4; k++) M(arm, kind === 'slip' || kind === 'dmg' ? G.cone(0.2, 0.7, 4) : G.box(0.1, 0.9, 0.5), bm, [s * (0.9 + k * 1.4), 0, 0], [0, 0, 0]); }
  }
  function blade(h: Hazard, col: number) {
    const gp = h.mesh as THREE.Group; const b = grp(gp, [0, 0.9, 0]); gp.userData.arm = b;
    M(b, G.cyl(1.0, 1.0, 0.12, 12), glowMat(col, 1.6), [0, 0, 0], [Math.PI / 2, 0, 0]); for (let k = 0; k < 8; k++) M(b, G.cone(0.14, 0.6, 4), mat(0xc8d0e0, { metal: 0.9, rough: 0.2 }), [Math.cos(k * 0.785) * 1.1, 0, Math.sin(k * 0.785) * 1.1], [0, 0, 0]);
    const rail = M(group, G.box(h.len * 2 + 2.4, 0.08, 0.3), mat(0x2a2a30, { metal: 0.7 }), [0, 0.06, h.z], undefined, 1, false); void rail;
  }

  // update
  w.update = (dt, t, px, pz, py, env) => {
    for (const l of lights) l.intensity = (l.userData.base as number) * (0.85 + Math.sin(t * 9 + l.userData.ph) * 0.1 + Math.sin(t * 23 + l.userData.ph * 2) * 0.05);
    portal.children[0].rotation.z = t; (portal.children[0] as THREE.Mesh).scale.setScalar(1 + Math.sin(t * 3) * (active ? 0.03 : 0.01));
    if (active && (t * 10) % 1 < 0.2) fx.emit(exit.x + (Math.random() - 0.5) * 3, 0.2, exit.z + (Math.random() - 0.5) * 3, 0, 2 + Math.random() * 2, 0, pcol.getHex(), 1, 0.25);
    if (w.secretMesh) { w.secretMesh.rotation.y = t * 0.3; if ((t * 6) % 1 < 0.1) fx.emit(w.secret!.x + (Math.random() - 0.5) * 2.6, 0.1, w.secret!.z + (Math.random() - 0.5) * 2.6, 0, 1.3, 0, 0xc07aff, 1.2, 0.18); }
    for (const h of hazards) {
      const d = Math.hypot(px - h.x, pz - h.z);
      switch (h.type) {
        case 'dmg': { const m = h.fill!.material as THREE.MeshStandardMaterial; m.emissiveIntensity = 1 + Math.sin(t * 3 + h.x) * 0.4; if (d < h.r - 0.2 && py < 0.8) { h.tick -= dt; if (h.tick <= 0) { h.tick = 0.5; env.hurt(0.035, 'dmg'); } } if ((t * 8 + h.x) % 1 < 0.1) fx.emit(h.x + (Math.random() - 0.5) * h.r, 0.2, h.z + (Math.random() - 0.5) * h.r, 0, 1.5, 0, hcol, 0.9, 0.2); break; }
        case 'slip': if (d < h.r) env.slip(); break;
        case 'push': h.mesh.children.forEach((c, i) => { if (i < 3) c.rotation.z += dt * (1 + i * 0.4); }); if (d < h.r && d > 0.5 && py < 1) env.push(((h.x - px) / d) * 5, ((h.z - pz) / d) * 5); break;
        case 'pulse': {
          h.t += dt; const c = h.cycle, p = h.t % c, warn = 1.3, st = p < c - warn ? 0 : p < c ? 1 : 0;
          const fill = h.fill!; if (p >= c - warn) { fill.scale.setScalar(Math.max(0.01, (p - (c - warn)) / warn)); h.hit = false; (fill.material as THREE.MeshBasicMaterial).opacity = 0.35; }
          else { const q2 = p / (c - warn); fill.scale.setScalar(0.01); if (p < 0.25 && !h.hit) { h.hit = true; if (h.state === 1) { fx.burst(h.x, 0.3, h.z, hcol, 24, 9, 0.6, 0.3, 6); fx.ring(h.x, 0, h.z, hcol, h.r * 1.1, 0.35); fx.pillar(h.x, 0, h.z, hcol, h.r * 0.7, 5, 0.3); fx.shake(0.12); sfx(reg === 5 ? 'lightning' : 'explode', 0.4); if (d < h.r && py < 1.0) env.hurt(0.12, 'pulse'); } } void q2; }
          h.state = st || (p >= c - warn ? 1 : 0); break;
        }
        case 'sweeper': {
          h.ang += dt * 1.3 * h.dir; const arm = (h.mesh as THREE.Group).userData.arm as THREE.Object3D; arm.rotation.y = h.ang;
          const dx = px - h.x, dz = pz - h.z, ca = Math.cos(h.ang), sa = Math.sin(h.ang), u = dx * ca - dz * sa, v = dx * sa + dz * ca;
          if (Math.abs(u) < h.len && Math.abs(v) < 0.8 && py < 1.1) { h.tick -= dt; if (h.tick <= 0) { h.tick = 0.9; env.hurt(0.11, 'blade'); fx.burst(px, 1, pz, hcol, 14, 6, 0.4); } } else h.tick -= dt; break;
        }
        case 'slider': {
          h.t += dt * 0.8; const x = Math.sin(h.t) * h.len; h.mesh.position.x = x; const arm = (h.mesh as THREE.Group).userData.arm as THREE.Object3D; arm.rotation.y += dt * 9;
          if (Math.hypot(px - x, pz - h.z) < 1.5 && py < 1.1) { h.tick -= dt; if (h.tick <= 0) { h.tick = 0.9; env.hurt(0.1, 'blade'); fx.burst(px, 1, pz, hcol, 14, 6, 0.4); } } else h.tick -= dt; break;
        }
      }
    }
  };
  return w;
}

// ---------- HUB ----------
export interface Station { id: string; label: string; x: number; z: number; r: number; color: number; npc?: THREE.Group }
export interface Hub { group: THREE.Group; stations: Station[]; update(dt: number, t: number, px: number, pz: number): void; collide(x: number, z: number, r: number): [number, number]; dispose(): void; sun: THREE.DirectionalLight; start: THREE.Vector3 }
function label(text: string, color = '#ffe9a8'): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d')!;
  x.font = 'bold 44px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.lineWidth = 8; x.strokeStyle = 'rgba(10,8,25,0.9)'; x.strokeText(text, 256, 60); x.fillStyle = color; x.fillText(text, 256, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(5.2, 0.98, 1); s.renderOrder = 20; return s;
}
const STATIONS: [string, string, number, number, string][] = [
  ['portal', 'Tower Gate', 0xffd860, 0, 'ruin'], ['merchant', 'Equipment Merchant', 0x66ddff, 40, 'frost'], ['vault', 'Storage Vault', 0xc9a86a, 80, 'umbral'], ['quests', 'Quest Board', 0x88ff99, 120, 'wild'],
  ['training', 'Training Arena', 0xff7a55, 160, 'ember'], ['trainer', 'Skill Trainer', 0xc07aff, 200, 'umbral'], ['achievements', 'Achievement Hall', 0xffe27a, 240, 'radiant'],
  ['trophies', 'Boss Trophy Hall', 0xff6a8a, 280, 'ember'], ['blacksmith', 'Blacksmith', 0xff9a44, 320, 'ember'],
];
export function buildHub(scene: THREE.Scene, fx: FX, q: { shadow: number; mobile: boolean }): Hub {
  const group = new THREE.Group(); scene.add(group);
  scene.background = new THREE.Color(0x2a2448); scene.fog = new THREE.FogExp2(0xc98a7a, 0.0075);
  group.add(skyDome(0x25235a, 0xffa070, true));
  group.add(new THREE.HemisphereLight(0xffd0b0, 0x4a3a5a, 1.1)); group.add(new THREE.AmbientLight(0xffd8c0, 0.3));
  const sun = new THREE.DirectionalLight(0xffc890, 2.2); sun.position.set(-30, 30, 25); sun.castShadow = q.shadow > 0; sun.shadow.mapSize.set(q.shadow >= 2 ? 2048 : 1024, q.shadow >= 2 ? 2048 : 1024);
  const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.far = 140; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; group.add(sun, sun.target);
  const tex = groundTex(0, true).clone(); tex.needsUpdate = true; tex.repeat.set(7, 7);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(36, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const uv = ground.geometry.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - 0.5) * 2, (uv.getY(i) - 0.5) * 2);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 1 })); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.1; outer.receiveShadow = true; group.add(outer);
  // plaza rune circle
  M(group, G.tor(8, 0.12, 6, 64), glowMat(0xffd860, 1.6), [0, 0.06, 0], [Math.PI / 2, 0, 0], 1, false); M(group, G.tor(5.5, 0.08, 6, 48), glowMat(0x66ddff, 1.4), [0, 0.06, 0], [Math.PI / 2, 0, 0], 1, false);
  const fount = grp(group, [0, 0, 0]); M(fount, G.cyl(2.4, 2.6, 0.6, 20), mat(0xb0a898, { rough: 0.7 }), [0, 0.3, 0]); M(fount, G.cyl(2.0, 2.0, 0.1, 20), mat(0x66ccff, { em: 0x3388ff, ei: 0.6, rough: 0.1, op: 0.85 }), [0, 0.58, 0]); M(fount, G.cyl(0.3, 0.45, 2.2, 8), mat(0xd8d0c0), [0, 1.4, 0]); M(fount, G.sph(0.5, 10, 8), glowMat(0xffd860, 2.2), [0, 2.7, 0], undefined, 1, false);
  // the Tower
  const tw = grp(group, [0, 0, -62]);
  M(tw, G.cyl(15, 18, 30, 24), mat(0x6a6a82, { rough: 0.85, flat: true }), [0, 15, 0]); M(tw, G.cyl(12, 15, 50, 24), mat(0x5a5a74, { rough: 0.85, flat: true }), [0, 55, 0]); M(tw, G.cyl(9, 12, 70, 24), mat(0x4a4a66, { rough: 0.85, flat: true }), [0, 115, 0]); M(tw, G.cyl(5, 9, 100, 20), mat(0x3a3a58, { rough: 0.85 }), [0, 200, 0]);
  for (let i = 0; i < 4; i++) M(tw, G.tor(14 - i * 1.6, 0.6, 6, 40), glowMat(0xffd860, 1.2), [0, 25 + i * 28, 0], [Math.PI / 2, 0, 0], 1, false);
  for (let i = 0; i < 60; i++) { const a = i * 2.4, y = 8 + i * 3.4, rr = Math.max(5, 17 - i * 0.18); M(tw, G.box(0.9, 1.8, 0.4), glowMat(i % 3 ? 0xffc870 : 0x66ddff, 2), [Math.sin(a) * rr, y, Math.cos(a) * rr], [0, a, 0], 1, false); }
  const door = grp(tw, [0, 0, 17.6]); M(door, G.box(8, 11, 1), mat(0x2a2a3a, { metal: 0.5 }), [0, 5.5, 0]); M(door, G.box(5.4, 8.4, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd890 }) as unknown as THREE.Material, [0, 4.3, 0.5], undefined, 1, false);
  M(door, G.tor(3.2, 0.3, 6, 24, Math.PI), glowMat(0xffd860, 2), [0, 8.4, 0.6], undefined, 1, false);
  // ring wall of trees + lanterns
  const rnd = rng(11);
  for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.283; if (Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) < 0) continue; const rr = 38 + rnd() * 6, p = grp(group, [Math.sin(a) * rr, 0, Math.cos(a) * rr]); const h = 4 + rnd() * 4; M(p, G.cyl(0.4, 0.6, h, 6), mat(0x4a3220), [0, h / 2, 0]); const cc = rnd() > 0.5 ? 0xff9ac0 : 0x6aa84a; M(p, G.sph(2.6 + rnd(), 8, 6), mat(cc, { rough: 1, flat: true }), [0, h + 1, 0], undefined, [1, 0.8, 1]); }
  const lamps: THREE.Object3D[] = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283 + 0.26, rr = 31, l = grp(group, [Math.sin(a) * rr, 0, Math.cos(a) * rr]); M(l, G.cyl(0.1, 0.12, 3.4, 5), mat(0x3a3a40), [0, 1.7, 0]); M(l, G.sph(0.32, 8, 6), glowMat(0xffc870, 3), [0, 3.5, 0], undefined, 1, false); lamps.push(l); }
  const stations: Station[] = [], pl = [new THREE.PointLight(0xffc870, 40, 30, 1.6), new THREE.PointLight(0xff9a44, 40, 24, 1.6)]; pl[0].position.set(0, 6, 0); group.add(pl[0]);
  const obs: Obstacle[] = [{ x: 0, z: 0, r: 2.8 }];
  const npcs: { g: THREE.Group; rig: ReturnType<typeof buildPlayer>; ph: number }[] = [];
  for (const [id, name, color, deg, setId] of STATIONS) {
    const a = (deg * Math.PI) / 180, x = Math.sin(a) * 23, z = -Math.cos(a) * 23, g = grp(group, [x, 0, z]); g.rotation.y = Math.atan2(-x, -z);
    M(g, G.cyl(3.4, 3.6, 0.2, 16), mat(0x5a4a50, { rough: 0.8 }), [0, 0.1, 0]); M(g, G.tor(3.2, 0.06, 5, 32), glowMat(color, 2), [0, 0.22, 0], [Math.PI / 2, 0, 0], 1, false);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) M(g, G.cyl(0.12, 0.14, 3.2, 6), mat(0x5a3a28), [sx * 2.6, 1.6, sz * 1.6]);
    M(g, G.cone(3.8, 1.5, 4), mat(color, { rough: 0.8, flat: true }), [0, 3.9, 0], [0, Math.PI / 4, 0], [1, 1, 0.75]);
    M(g, G.cyl(0.04, 0.04, 6, 4), glowMat(color, 2), [0, 3, 0], undefined, 1, false); // beacon
    switch (id) {
      case 'blacksmith': M(g, G.box(0.9, 0.7, 0.5), mat(0x2a2a32, { metal: 0.8 }), [-1, 0.5, 1.3]); M(g, G.box(1.3, 0.2, 0.4), mat(0x4a4a56, { metal: 0.8 }), [-1, 0.95, 1.3]); M(g, G.box(1.2, 0.8, 1.0), mat(0x5a4a40), [1.6, 0.5, 0.8]); M(g, G.sph(0.4, 8, 6), glowMat(0xff6a1a, 2.4), [1.6, 1.0, 0.8], undefined, [1, 0.5, 1], false); break;
      case 'merchant': for (let i = 0; i < 4; i++) M(g, G.box(0.4, 0.4, 0.4), mat([0xff6a8a, 0x6aa8ff, 0xffd860, 0x88ff99][i], { em: 0x222222 }), [-1.5 + i, 0.95, 1.2]); M(g, G.box(4, 0.7, 1.2), mat(0x6a4a30), [0, 0.45, 1.2]); break;
      case 'trainer': M(g, G.cyl(0.4, 0.5, 0.9, 6), mat(0x4a3a60), [1.4, 0.55, 1.0]); M(g, G.box(0.7, 0.08, 0.5), glowMat(0xc07aff, 1.5), [1.4, 1.05, 1.0], [-0.4, 0, 0], 1, false); M(g, G.tor(1.2, 0.04, 5, 28), glowMat(0xc07aff, 2.2), [-1.2, 0.3, 1.2], [Math.PI / 2, 0, 0], 1, false); break;
      case 'vault': for (let i = 0; i < 3; i++) M(g, G.box(1, 0.8, 0.7), mat(0x6a5a30, { metal: 0.7 }), [-1.4 + i * 1.4, 0.5, 1.2]); M(g, G.cyl(0.8, 0.8, 0.15, 12), glowMat(0xffd860, 1.3), [0, 0.3, 1.9], [Math.PI / 2, 0, 0], 1, false); break;
      case 'quests': M(g, G.box(2.6, 1.8, 0.15), mat(0x5a3a28), [0, 1.8, 1.4]); for (let i = 0; i < 6; i++) M(g, G.box(0.45, 0.55, 0.02), mat(0xf4e8c0), [-0.9 + (i % 3) * 0.9, 1.45 + Math.floor(i / 3) * 0.7, 1.5], [0, 0, (i - 3) * 0.05]); break;
      case 'training': for (let i = 0; i < 3; i++) { const d = grp(g, [-1.8 + i * 1.8, 0, 1.4]); M(d, G.cyl(0.07, 0.07, 1.4, 5), mat(0x5a3a28), [0, 0.7, 0]); M(d, G.sph(0.35, 8, 6), mat(0xc8a060), [0, 1.5, 0]); M(d, G.box(0.9, 0.12, 0.12), mat(0x5a3a28), [0, 1.15, 0]); } break;
      case 'achievements': M(g, G.cyl(0.5, 0.6, 0.8, 8), mat(0xe8dcc0), [-1.5, 0.5, 1.2]); M(g, G.cone(0.35, 0.9, 6), glowMat(0xffe27a, 2), [-1.5, 1.45, 1.2], undefined, 1, false); M(g, G.cyl(0.5, 0.6, 0.8, 8), mat(0xe8dcc0), [1.5, 0.5, 1.2]); M(g, G.tor(0.35, 0.08, 6, 14), glowMat(0xffe27a, 2), [1.5, 1.35, 1.2], undefined, 1, false); break;
      case 'trophies': for (let i = 0; i < 4; i++) { M(g, G.cyl(0.4, 0.45, 0.7, 6), mat(0x3a2a34), [-1.9 + i * 1.27, 0.45, 1.3]); M(g, G.oct(0.3, 0), glowMat([0xc9a86a, 0x9fe6ff, 0xff7a22, 0x7dff8a][i], 1.6), [-1.9 + i * 1.27, 1.2, 1.3], undefined, 1, false); } break;
      case 'portal': M(g, G.cyl(2.2, 2.4, 0.3, 24), glowMat(0xffd860, 1.0, 0.8), [0, 0.3, 1.0], undefined, 1, false); for (let i = 0; i < 3; i++) M(g, G.tor(1.4 + i * 0.4, 0.05, 5, 32), glowMat(0xffffff, 1.5), [0, 0.45 + i * 0.03, 1.0], [Math.PI / 2, 0, 0], 1, false); break;
    }
    const lb = label(name); lb.position.set(0, 5.6, 0); g.add(lb);
    if (id !== 'portal' && id !== 'training' && id !== 'quests') {
      const set = { id: setId, rarity: 'epic', stats: {}, slot: 'armor', name: '', tier: 1, upg: 0, desc: '' } as never;
      const rig = buildPlayer({ armor: set, helmet: id === 'blacksmith' ? undefined : set, weapon: null });
      rig.root.position.set(0, 0.2, 0.2); rig.root.scale.setScalar(1.05); g.add(rig.root); npcs.push({ g: rig.root, rig, ph: Math.random() * 6 });
    }
    const light = new THREE.PointLight(color, 8, 10, 1.8); light.position.set(0, 2.8, 1); g.add(light);
    obs.push({ x: x + Math.sin(a) * 0 , z: z - Math.cos(a) * -0, r: 0.01 });
    obs.pop();
    // station interaction centre pulled toward the plaza centre
    stations.push({ id, label: name, x: x * 0.88, z: z * 0.88, r: 5.2, color });
  }
  group.add(pl[1]); pl[1].position.set(0, 20, -42);
  void lamps;
  // petals
  const am = fx; void am;
  return {
    group, stations, sun, start: new THREE.Vector3(0, 0, 8),
    update(_dt, t, px, pz) {
      for (const n of npcs) { n.rig.body.position.y = 0.95 + Math.sin(t * 1.6 + n.ph) * 0.015; n.rig.armR.rotation.x = -0.1 + Math.sin(t * 1.3 + n.ph) * 0.05; n.rig.cape.forEach((c, i) => (c.rotation.x = 0.08 + Math.sin(t * 2 + n.ph + i) * 0.05)); const wp = n.g.getWorldPosition(new THREE.Vector3()); const ang = Math.atan2(px - wp.x, pz - wp.z) - (n.g.parent?.rotation.y || 0); const d = Math.hypot(px - wp.x, pz - wp.z); if (d < 9) n.g.rotation.y += (ang - n.g.rotation.y) * 0.08; }
      pl[1].intensity = 40 + Math.sin(t * 2) * 8;
    },
    collide(x, z, r) {
      const d = Math.hypot(x, z); if (d < 2.8 + r) { x = (x / d) * (2.8 + r); z = (z / d) * (2.8 + r); }
      const dd = Math.hypot(x, z), m = 34 - r; if (dd > m) { x *= m / dd; z *= m / dd; }
      return [x, z];
    },
    dispose() { scene.remove(group); tex.dispose(); },
  };
}
