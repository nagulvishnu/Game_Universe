// Zone builders: Seoul + dungeons. Walkability is region-based (rect union) with AABB/circle obstacles.
import * as THREE from 'three';
import { geo, makeLabel, makeStatueDecor, mat } from './models';

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
export interface Box {
  x: number;
  z: number;
  hw: number;
  hd: number;
  id?: string;
  on?: boolean;
}
export interface Circle {
  x: number;
  z: number;
  r: number;
}
export interface Trap {
  plate?: THREE.Mesh;
  x: number;
  z: number;
  r: number;
  up: boolean;
  warn: boolean;
  g: THREE.Group;
  phase: number;
}
export interface Zone {
  id: string;
  name: string;
  group: THREE.Group;
  rects: Rect[];
  roads: Rect[];
  boxes: Box[];
  circles: Circle[];
  spawn: [number, number, number];
  fog: [number, number, number];
  sun: number;
  ambient: number;
  hemi: [number, number];
  anchors: Record<string, [number, number]>;
  labels: { x: number; z: number; text: string; color?: string }[];
  walkPts: [number, number][];
  lights: THREE.PointLight[];
  traps: Trap[];
  music: 'city' | 'temple' | 'cave' | 'arena' | 'penalty';
  update(dt: number, t: number, px: number, pz: number): void;
  shadowRadius: number;
  dark: boolean;
  flicker: THREE.PointLight[];
  [k: string]: any;
}
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const inRect = (r: Rect, x: number, z: number, m = 0) =>
  x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m;
export function walkable(z: Zone, x: number, y: number, r = 0.4): boolean {
  const pts = [
    [x, y],
    [x + r, y],
    [x - r, y],
    [x, y + r],
    [x, y - r],
  ];
  for (const [px, pz] of pts) {
    if (!z.rects.some((q) => inRect(q, px, pz))) return false;
  }
  for (const b of z.boxes) {
    if (b.on === false) continue;
    if (Math.abs(x - b.x) < b.hw + r && Math.abs(y - b.z) < b.hd + r) return false;
  }
  for (const c of z.circles) {
    const dx = x - c.x,
      dz = y - c.z;
    if (dx * dx + dz * dz < (c.r + r) * (c.r + r)) return false;
  }
  return true;
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rep = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noiseFill(g: CanvasRenderingContext2D, w: number, h: number, base: string, amt: number, n = 1800) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * amt;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6);
  }
}
function newZone(id: string, name: string): Zone {
  return {
    id,
    name,
    group: new THREE.Group(),
    rects: [],
    roads: [],
    boxes: [],
    circles: [],
    spawn: [0, 0, 0],
    fog: [0x101018, 20, 120],
    sun: 0.6,
    ambient: 0.6,
    hemi: [0x8090ff, 0x202030],
    anchors: {},
    labels: [],
    walkPts: [],
    lights: [],
    traps: [],
    music: 'city',
    update: () => {},
    shadowRadius: 40,
    dark: false,
    flicker: [],
  };
}
function sky(top: number, mid: number, bot: number, stars = true) {
  const g = new THREE.Group();
  const t = canvasTex(8, 256, (c) => {
    const gr = c.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + new THREE.Color(top).getHexString());
    gr.addColorStop(0.55, '#' + new THREE.Color(mid).getHexString());
    gr.addColorStop(1, '#' + new THREE.Color(bot).getHexString());
    c.fillStyle = gr;
    c.fillRect(0, 0, 8, 256);
  });
  const s = new THREE.Mesh(
    new THREE.SphereGeometry(420, 16, 12),
    new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  s.renderOrder = -10;
  g.add(s);
  g.userData.sky = s;
  if (stars) {
    const p = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const a = Math.random() * 6.28,
        e = Math.random() * 1.2 + 0.1,
        R = 400;
      p[i * 3] = Math.cos(a) * Math.cos(e) * R;
      p[i * 3 + 1] = Math.sin(e) * R;
      p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * R;
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.add(
      new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, fog: false, sizeAttenuation: false }))
    );
  }
  return g;
}
function flame(z: Zone, x: number, y: number, zz: number, color = 0xff8a30, light = true, intensity = 18) {
  const m = new THREE.Mesh(geo.cone, mat(color, { basic: true }));
  m.scale.set(0.22, 0.6, 0.22);
  m.position.set(x, y + 0.3, zz);
  z.group.add(m);
  const m2 = new THREE.Mesh(geo.cone, mat(0xffe08a, { basic: true }));
  m2.scale.set(0.12, 0.4, 0.12);
  m2.position.set(x, y + 0.22, zz);
  z.group.add(m2);
  if (light) {
    const l = new THREE.PointLight(color, intensity, 22, 1.6);
    l.position.set(x, y + 1, zz);
    z.group.add(l);
    z.lights.push(l);
    z.flicker.push(l);
  }
  z.flicker.push(m as any);
  return m;
}
const stoneTex = (c1 = '#4a4640', rep = 24) =>
  canvasTex(
    256,
    256,
    (g) => {
      noiseFill(g, 256, 256, c1, 60, 1500);
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo(0, i * 64);
        g.lineTo(256, i * 64);
        g.stroke();
        g.beginPath();
        g.moveTo(i * 64, 0);
        g.lineTo(i * 64, 256);
        g.stroke();
      }
    },
    rep
  );
let glowTexCache: THREE.CanvasTexture | null = null;
function glowMap() {
  if (glowTexCache) return glowTexCache;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 1, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.22, 'rgba(255,255,255,0.7)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.15)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowTexCache = new THREE.CanvasTexture(c);
  return glowTexCache;
}
function halo(z: Zone, x: number, y: number, zz: number, color: number, size = 2, opacity = 0.35) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowMap(),
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  s.position.set(x, y, zz);
  s.scale.setScalar(size);
  z.group.add(s);
  return s;
}
function addMotes(z: Zone, color: number, count: number, area: number, height = 8, size = 0.45) {
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (Math.random() - 0.5) * area;
    p[i * 3 + 1] = 0.3 + Math.random() * height;
    p[i * 3 + 2] = (Math.random() - 0.5) * area;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      map: glowMap(),
      color,
      size,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  pts.frustumCulled = false;
  z.group.add(pts);
  z.atmo = pts;
  return pts;
}
function addHaze(z: Zone, color: number, count: number, area: number, y: number, size: number, opacity = 0.12) {
  const arr: THREE.Sprite[] = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowMap(),
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const x = (Math.random() - 0.5) * area;
    const zz = (Math.random() - 0.5) * area;
    s.position.set(x, y + Math.random() * 1.6, zz);
    s.scale.set(size * (0.7 + Math.random() * 0.7), size * (0.4 + Math.random() * 0.3), 1);
    s.userData.base = { x, z: zz, y: s.position.y, op: opacity, ph: Math.random() * 6.28 };
    z.group.add(s);
    arr.push(s);
  }
  z.haze = arr;
  return arr;
}
function atmoTick(z: Zone, t: number) {
  if (z.atmo) {
    z.atmo.rotation.y = t * 0.012;
    const m = z.atmo.material as THREE.PointsMaterial;
    m.opacity = 0.42 + Math.sin(t * 0.7) * 0.1;
  }
  if (z.haze)
    (z.haze as THREE.Sprite[]).forEach((s) => {
      const b = s.userData.base as { x: number; z: number; y: number; op: number; ph: number };
      s.position.x = b.x + Math.sin(t * 0.08 + b.ph) * 2.2;
      s.position.z = b.z + Math.cos(t * 0.06 + b.ph) * 2.2;
      s.position.y = b.y + Math.sin(t * 0.12 + b.ph) * 0.25;
      (s.material as THREE.SpriteMaterial).opacity = b.op * (0.65 + Math.sin(t * 0.5 + b.ph) * 0.35);
    });
}
function wrapAtmo(z: Zone) {
  const base = z.update;
  z.update = (dt: number, t: number, px: number, pz: number) => {
    base(dt, t, px, pz);
    atmoTick(z, t);
  };
}
function floorFor(z: Zone, r: Rect, m: THREE.Material, y = 0, tile = 8) {
  const w = r.x1 - r.x0,
    d = r.z1 - r.z0;
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
  me.rotation.x = -Math.PI / 2;
  me.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  me.receiveShadow = true;
  const t = (m as THREE.MeshStandardMaterial).map;
  if (t) {
    const mm = m.clone() as THREE.MeshStandardMaterial;
    mm.map = t.clone();
    mm.map.needsUpdate = true;
    mm.map.repeat.set(w / tile, d / tile);
    me.material = mm;
  }
  z.group.add(me);
  return me;
}
function wallFiller(
  z: Zone,
  o: {
    geo: THREE.BufferGeometry;
    mat: THREE.Material;
    hmin: number;
    hmax: number;
    step?: number;
    w?: number;
    layers?: number;
    seed?: number;
    tint?: number;
  }
) {
  const step = o.step ?? 2.4;
  const R = rng(o.seed ?? 7);
  let x0 = 1e9,
    x1 = -1e9,
    z0 = 1e9,
    z1 = -1e9;
  z.rects.forEach((r) => {
    x0 = Math.min(x0, r.x0);
    x1 = Math.max(x1, r.x1);
    z0 = Math.min(z0, r.z0);
    z1 = Math.max(z1, r.z1);
  });
  const pos: [number, number][] = [];
  for (let x = x0 - 6; x <= x1 + 6; x += step)
    for (let y = z0 - 6; y <= z1 + 6; y += step) {
      if (z.rects.some((q) => inRect(q, x, y, -0.6))) continue;
      if (z.rects.some((q) => inRect(q, x, y, -(step * 1.6)))) pos.push([x, y]);
    }
  const L = o.layers ?? 1;
  const im = new THREE.InstancedMesh(o.geo, o.mat, pos.length * L);
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  let k = 0;
  for (const [x, y] of pos)
    for (let l = 0; l < L; l++) {
      const h = o.hmin + R() * (o.hmax - o.hmin);
      const w = (o.w ?? step) * (1.1 + R() * 0.5);
      d.position.set(x + (R() - 0.5) * 0.8 + l * 0.6, h / 2 - 0.2, y + (R() - 0.5) * 0.8 + l * 0.6);
      d.rotation.set(0, R() * 6, 0);
      d.scale.set(w, h, w);
      d.updateMatrix();
      im.setMatrixAt(k, d.matrix);
      const v = 0.7 + R() * 0.5;
      c.setRGB(v, v, v);
      im.setColorAt(k, c);
      k++;
    }
  im.castShadow = false;
  im.receiveShadow = false;
  z.group.add(im);
  return im;
}

// ===================================================== SEOUL
export function buildSeoul(): Zone {
  const z = newZone('seoul', 'Seoul');
  const g = z.group;
  const R = rng(42);
  z.fog = [0x2a2c5a, 70, 320];
  z.sun = 1.6;
  z.ambient = 2.1;
  z.hemi = [0x9aa8ff, 0x5a5070];
  z.music = 'city';
  z.shadowRadius = 55;
  g.add(sky(0x05061a, 0x1d2250, 0x6a4a7a));
  const moon = new THREE.Mesh(geo.sph, mat(0xd8e8ff, { basic: true }));
  moon.scale.setScalar(13);
  moon.position.set(-150, 118, -260);
  (moon.material as THREE.MeshBasicMaterial).fog = false;
  g.add(moon);
  halo(z, -150, 118, -260, 0x8ab4ff, 70, 0.3);
  addMotes(z, 0x9ad8ff, 110, 230, 22, 0.45);
  const XS = [
      [-130, -72],
      [-58, -7],
      [7, 58],
      [72, 130],
    ],
    ZS = [
      [-130, -72],
      [-58, -7],
      [7, 58],
      [72, 112],
    ];
  z.rects.push({ x0: -130, x1: 130, z0: -130, z1: 112 }, { x0: -6, x1: 6, z0: 112, z1: 134 });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({
      map: canvasTex(
        128,
        128,
        (c) => {
          noiseFill(c, 128, 128, '#4a4c58', 40, 400);
          c.strokeStyle = 'rgba(0,0,0,0.3)';
          c.strokeRect(0, 0, 128, 128);
          c.strokeRect(0, 0, 64, 64);
          c.strokeRect(64, 64, 64, 64);
        },
        130
      ),
      roughness: 0.95,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x15161d, roughness: 0.4, metalness: 0.32 });
  const roads: Rect[] = [];
  [-65, 0, 65].forEach((c) => {
    roads.push({ x0: c - 7, x1: c + 7, z0: -130, z1: 112 }, { x0: -130, x1: 130, z0: c - 7, z1: c + 7 });
  });
  z.roads = roads;
  roads.forEach((r) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((r.x0 + r.x1) / 2, 0.03, (r.z0 + r.z1) / 2);
    m.receiveShadow = true;
    g.add(m);
  });
  // lane dashes + crosswalks (instanced)
  const dashes: [number, number, number][] = [];
  [-65, 0, 65].forEach((c) => {
    for (let t = -126; t < 112; t += 6) {
      if ([-65, 0, 65].some((o) => Math.abs(t - o) < 11)) continue;
      dashes.push([c, t, 0]);
    }
    for (let t = -126; t < 130; t += 6) {
      if ([-65, 0, 65].some((o) => Math.abs(t - o) < 11)) continue;
      dashes.push([t, c, 1]);
    }
  });
  const stripes: [number, number, number][] = [];
  [-65, 0, 65].forEach((cx) =>
    [-65, 0, 65].forEach((cz) => {
      for (let k = -5; k <= 5; k += 1.6) {
        stripes.push([cx + k, cz - 9, 0], [cx + k, cz + 9, 0], [cx - 9, cz + k, 1], [cx + 9, cz + k, 1]);
      }
    })
  );
  const mk = (arr: [number, number, number][], sx: number, sz: number, col: number) => {
    const im = new THREE.InstancedMesh(geo.box, mat(col, { basic: true }), arr.length);
    const d = new THREE.Object3D();
    arr.forEach((a, i) => {
      d.position.set(a[0], 0.06, a[1]);
      d.scale.set(a[2] ? sz : sx, 0.02, a[2] ? sx : sz);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    g.add(im);
  };
  mk(dashes, 0.3, 3, 0xe8d070);
  mk(stripes, 1, 4, 0xdadada);
  // window textures
  const winMat = (kind: 'office' | 'apt' | 'dark', hue: number) => {
    const tex = canvasTex(256, 256, (c) => {
      c.fillStyle = kind === 'apt' ? '#b8a890' : kind === 'dark' ? '#2a2a34' : '#3a4a6a';
      c.fillRect(0, 0, 256, 256);
      const rr = rng(hue);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const lit = rr() > 0.55;
          c.fillStyle = lit ? (rr() > 0.4 ? '#ffe2a0' : '#bfe4ff') : kind === 'office' ? '#16203a' : '#1c1c26';
          const x = i * 64 + 10,
            y = j * 64 + 12;
          c.fillRect(x, y, kind === 'office' ? 46 : 36, 38);
          if (kind === 'apt') {
            c.fillStyle = '#7a6a58';
            c.fillRect(x - 6, y + 40, 52, 8);
          }
        }
    });
    const emi = canvasTex(256, 256, (c) => {
      c.fillStyle = '#000';
      c.fillRect(0, 0, 256, 256);
      const rr = rng(hue);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const lit = rr() > 0.55;
          const w = rr() > 0.4;
          if (lit) {
            c.fillStyle = w ? '#ffe2a0' : '#bfe4ff';
            c.fillRect(i * 64 + 10, j * 64 + 12, kind === 'office' ? 46 : 36, 38);
          }
        }
    });
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: emi,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.7,
      metalness: 0.1,
    });
  };
  const wm = {
    office: [winMat('office', 1), winMat('office', 2), winMat('office', 3)],
    apt: [winMat('apt', 4), winMat('apt', 5)],
    dark: [winMat('dark', 6)],
  };
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2c34, roughness: 0.9 });
  const occ: THREE.Mesh[] = [];
  const building = (
    x: number,
    zz: number,
    w: number,
    h: number,
    d: number,
    kind: 'office' | 'apt' | 'dark' = 'office',
    special?: THREE.Material,
    sign?: string,
    frontZ = 1,
    signColor = '#ffc04a'
  ) => {
    const gm = new THREE.BoxGeometry(w, h, d);
    const uv = gm.attributes.uv as THREE.BufferAttribute;
    for (let f = 0; f < 6; f++) {
      if (f === 2 || f === 3) continue;
      const su = f < 2 ? d / 12 : w / 12;
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * su, (uv.getY(k) * h) / 16);
      }
    }
    const wmat = special || wm[kind][Math.floor(R() * wm[kind].length)];
    const m = new THREE.Mesh(gm, [wmat, wmat, roofMat, roofMat, wmat, wmat]);
    m.position.set(x, h / 2, zz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    occ.push(m);
    z.boxes.push({ x, z: zz, hw: w / 2, hd: d / 2 });
    for (let i = 0; i < 2; i++) {
      const ac = new THREE.Mesh(geo.box, mat(0x6a6e78));
      ac.scale.set(2 + R() * 2, 1.2, 2);
      ac.position.set(x + (R() - 0.5) * w * 0.6, h + 0.6, zz + (R() - 0.5) * d * 0.6);
      g.add(ac);
    }
    if (R() > 0.55) {
      const neonColor = new THREE.Color(SC[(si + 2) % SC.length]).getHex();
      const neon = new THREE.Mesh(geo.box, mat(neonColor, { basic: true }));
      neon.scale.set(0.18, h * 0.6, 0.18);
      neon.position.set(x - w / 2 + 0.15, h * 0.3 + 4, zz + frontZ * (d / 2 + 0.05));
      g.add(neon);
    }
    if (sign) {
      const s = makeLabel(sign, { w: Math.min(w * 0.8, 9), h: 1.6, color: signColor, font: 56 });
      s.position.set(x, 4.3, zz + frontZ * (d / 2 + 0.1));
      if (frontZ < 0) s.rotation.y = Math.PI;
      g.add(s);
      const aw = new THREE.Mesh(geo.box, mat(0x2a1a1a));
      aw.scale.set(w * 0.9, 0.2, 1.4);
      aw.position.set(x, 3.4, zz + frontZ * (d / 2 + 0.6));
      g.add(aw);
      const door = new THREE.Mesh(geo.box, mat(0xffe0a0, { basic: true }));
      door.scale.set(2.2, 2.6, 0.1);
      door.position.set(x, 1.3, zz + frontZ * (d / 2 + 0.05));
      g.add(door);
    }
    return m;
  };
  z.occluders = occ;
  const SH = [
    'CAFE',
    'PC BANG',
    'CHICKEN',
    'KOREAN BBQ',
    'CONVENIENCE',
    'PHARMACY',
    'NOODLES',
    'KARAOKE',
    'BAKERY',
    'TTEOKBOKKI',
    'BOOKSTORE',
    'MART',
  ];
  const SC = ['#ffc04a', '#ff6a8a', '#7affb0', '#7ad0ff', '#ff9a4a', '#c88aff'];
  let si = 0;
  const special: Record<string, 1> = {
    '1,0': 1,
    '2,0': 1,
    '3,0': 1,
    '0,1': 1,
    '1,1': 1,
    '2,1': 1,
    '3,1': 1,
    '1,2': 1,
    '2,2': 1,
    '0,3': 1,
  };
  XS.forEach(([x0, x1], ix) =>
    ZS.forEach(([z0, z1], iz) => {
      z.walkPts.push([x0 + 1.5, z0 + 1.5], [x1 - 1.5, z0 + 1.5], [x0 + 1.5, z1 - 1.5], [x1 - 1.5, z1 - 1.5]);
      const k = `${ix},${iz}`;
      if (special[k]) return;
      const cx = (x0 + x1) / 2,
        cz = (z0 + z1) / 2;
      const w = (x1 - x0 - 8) / 2,
        d = (z1 - z0 - 8) / 2;
      if (ix === 3 && iz === 2) {
        // parking lot
        const lot = new THREE.Mesh(
          new THREE.PlaneGeometry(x1 - x0 - 6, 22),
          new THREE.MeshStandardMaterial({ color: 0x24262c })
        );
        lot.rotation.x = -Math.PI / 2;
        lot.position.set(cx, 0.05, cz + 12);
        g.add(lot);
        for (let i = 0; i < 12; i++) {
          const ln = new THREE.Mesh(geo.box, mat(0xdddddd, { basic: true }));
          ln.scale.set(0.15, 0.02, 5);
          ln.position.set(x0 + 6 + i * 4.6, 0.07, cz + 12);
          g.add(ln);
          if (R() > 0.35) car(x0 + 8.3 + i * 4.6, cz + 12);
        }
        building(cx, z0 + 14, x1 - x0 - 12, 20, 14, 'office', undefined, 'PARKING', 1, '#7ad0ff');
        return;
      }
      for (let a = 0; a < 2; a++)
        for (let b = 0; b < 2; b++) {
          const bx = x0 + 4 + w / 2 + a * (w + 0),
            bz = z0 + 4 + d / 2 + b * d;
          const kind = R() > 0.5 ? 'office' : R() > 0.4 ? 'apt' : 'dark';
          const h = 16 + R() * 44;
          const front = bz < cz ? -1 : 1;
          building(bx, bz, w - 2, h, d - 2, kind as any, undefined, SH[si++ % SH.length], front, SC[si % SC.length]);
        }
    })
  );
  function car(x: number, zz: number, yaw = 0) {
    const c = new THREE.Group();
    const col = [0x8a1c1c, 0x1c2a5a, 0xdddddd, 0x222228, 0x3a5a3a, 0xc8c8d0][Math.floor(R() * 6)];
    const b = new THREE.Mesh(geo.box, mat(col, { metal: true }));
    b.scale.set(1.8, 0.6, 4.2);
    b.position.y = 0.55;
    const cab = new THREE.Mesh(geo.box, mat(0x1a2030, { metal: true }));
    cab.scale.set(1.6, 0.55, 2.2);
    cab.position.set(0, 1.1, -0.2);
    c.add(b, cab);
    [
      [-0.9, 1.3],
      [0.9, 1.3],
      [-0.9, -1.3],
      [0.9, -1.3],
    ].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(geo.cyl, mat(0x111111));
      w.rotation.z = Math.PI / 2;
      w.scale.set(0.35, 0.25, 0.35);
      w.position.set(wx, 0.35, wz);
      c.add(w);
    });
    const tl = new THREE.Mesh(geo.box, mat(0xff2020, { basic: true }));
    tl.scale.set(1.5, 0.12, 0.05);
    tl.position.set(0, 0.7, -2.12);
    c.add(tl);
    c.position.set(x, 0, zz);
    c.rotation.y = yaw;
    g.add(c);
    z.boxes.push({ x, z: zz, hw: yaw ? 2.1 : 1, hd: yaw ? 1 : 2.1 });
    c.traverse((o) => {
      o.castShadow = false;
    });
  }
  [
    [-52, -6, 0],
    [-52, 28, 0],
    [-78, 58, 1.57],
    [24, 8, 0],
    [58, 36, 0],
    [-14, 58, 0],
    [14, -66, 1.57],
    [-40, 66, 1.57],
    [72, 4, 0],
    [-80, -66, 1.57],
    [48, 74, 1.57],
    [-4, -100, 0],
    [4, 90, 0],
    [-70, 90, 0],
  ].forEach(([x, zz, y]) => car(x, zz, y));
  // street lights & trees (instanced)
  const lampPts: [number, number][] = [];
  XS.forEach(([x0, x1]) =>
    ZS.forEach(([z0, z1]) => {
      for (let t = x0 + 6; t < x1; t += 22) {
        lampPts.push([t, z0 + 0.8], [t, z1 - 0.8]);
      }
      for (let t = z0 + 10; t < z1; t += 22) {
        lampPts.push([x0 + 0.8, t], [x1 - 0.8, t]);
      }
    })
  );
  const poles = new THREE.InstancedMesh(geo.cyl, mat(0x2a2c34), lampPts.length),
    bulbs = new THREE.InstancedMesh(geo.sph, mat(0xffd9a0, { basic: true }), lampPts.length);
  const d = new THREE.Object3D();
  lampPts.forEach(([x, y], i) => {
    d.rotation.set(0, 0, 0);
    d.position.set(x, 3.4, y);
    d.scale.set(0.09, 6.8, 0.09);
    d.updateMatrix();
    poles.setMatrixAt(i, d.matrix);
    d.position.set(x, 6.9, y);
    d.scale.set(0.35, 0.22, 0.35);
    d.updateMatrix();
    bulbs.setMatrixAt(i, d.matrix);
  });
  g.add(poles, bulbs);
  {
    const p = new Float32Array(lampPts.length * 3);
    lampPts.forEach(([x, y], i) => {
      p[i * 3] = x;
      p[i * 3 + 1] = 6.9;
      p[i * 3 + 2] = y;
    });
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const glowPts = new THREE.Points(
      lgeo,
      new THREE.PointsMaterial({
        map: glowMap(),
        color: 0xffd9a0,
        size: 3.1,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    g.add(glowPts);
    // curb lines
    const curb = new THREE.MeshStandardMaterial({ color: 0x343842, roughness: 0.7 });
    roads.forEach((r) => {
      const vertical = r.x1 - r.x0 < r.z1 - r.z0;
      const len = vertical ? r.z1 - r.z0 : r.x1 - r.x0;
      const cx = (r.x0 + r.x1) / 2,
        cz = (r.z0 + r.z1) / 2;
      [-1, 1].forEach((s) => {
        const m = new THREE.Mesh(geo.box, curb);
        if (vertical) m.scale.set(0.7, 0.12, len);
        else m.scale.set(len, 0.12, 0.7);
        m.position.set(vertical ? cx + s * 8 : cx, 0.06, vertical ? cz : cz + s * 8);
        g.add(m);
      });
    });
  }
  const treePts: [number, number][] = [];
  for (let i = 0; i < 90; i++) {
    const ix = Math.floor(R() * 4),
      iz = Math.floor(R() * 4);
    const [x0, x1] = XS[ix],
      [z0, z1] = ZS[iz];
    const onEdge = R() > 0.5;
    treePts.push(
      onEdge
        ? [x0 + 2 + R() * (x1 - x0 - 4), R() > 0.5 ? z0 + 1.8 : z1 - 1.8]
        : [R() > 0.5 ? x0 + 1.8 : x1 - 1.8, z0 + 2 + R() * (z1 - z0 - 4)]
    );
  }
  for (let i = 0; i < 70; i++) treePts.push([-55 + R() * 46, 14 + R() * 38]);
  const trunks = new THREE.InstancedMesh(geo.cyl, mat(0x4a3220), treePts.length),
    crowns = new THREE.InstancedMesh(geo.sph, mat(0x2d6a3a), treePts.length);
  const col = new THREE.Color();
  treePts.forEach(([x, y], i) => {
    const hh = 2.5 + R() * 1.5;
    d.position.set(x, hh / 2, y);
    d.scale.set(0.2, hh, 0.2);
    d.updateMatrix();
    trunks.setMatrixAt(i, d.matrix);
    d.position.set(x, hh + 1.2, y);
    d.scale.set(1.8 + R(), 1.6 + R() * 0.6, 1.8 + R());
    d.updateMatrix();
    crowns.setMatrixAt(i, d.matrix);
    col.setHSL(0.3 + R() * 0.08, 0.45, 0.22 + R() * 0.1);
    crowns.setColorAt(i, col);
    if (treePts.length - i > 70) z.circles.push({ x, z: y, r: 0.35 });
  });
  g.add(trunks, crowns);
  // ---- special buildings
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9ad0ff,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0x3a7ac0,
    emissiveIntensity: 0.6,
  });
  // Hunter Association HQ (33,-33) with open lobby
  const HQ = { x: 33, z: -33, w: 38, d: 30 };
  z.anchors.hq = [HQ.x, HQ.z];
  const hqW = (x: number, zz: number, w: number, d: number, h = 8) => {
    const m = new THREE.Mesh(geo.box, new THREE.MeshStandardMaterial({ color: 0xd8dde8, roughness: 0.5 }));
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, zz);
    m.castShadow = true;
    g.add(m);
    z.boxes.push({ x, z: zz, hw: w / 2, hd: d / 2 });
    return m;
  };
  hqW(HQ.x, HQ.z - HQ.d / 2, HQ.w, 1, 8);
  hqW(HQ.x - HQ.w / 2, HQ.z, 1, HQ.d);
  hqW(HQ.x + HQ.w / 2, HQ.z, 1, HQ.d);
  hqW(HQ.x - 12, HQ.z + HQ.d / 2, 14, 1);
  hqW(HQ.x + 12, HQ.z + HQ.d / 2, 14, 1);
  // main entrance: the front segments leave a 10-wide gap (x 28..38). Build an open
  // doorway - only the sidelights/jambs push colliders; the lintel above stays
  // collider-free because z.boxes are 2D and would otherwise reseal the opening.
  const fz = HQ.z + HQ.d / 2;
  const doorTop = 4.6;
  [-1, 1].forEach((s) => {
    const cx = HQ.x + s * 3.75;
    const pane = new THREE.Mesh(geo.box, glass);
    pane.scale.set(2.5, doorTop, 0.22);
    pane.position.set(cx, doorTop / 2, fz);
    g.add(pane);
    z.boxes.push({ x: cx, z: fz, hw: 1.25, hd: 0.5 });
    const jamb = new THREE.Mesh(geo.box, mat(0x1e2636, { metal: true }));
    jamb.scale.set(0.3, doorTop, 1.12);
    jamb.position.set(HQ.x + s * 2.65, doorTop / 2, fz);
    g.add(jamb);
    const leaf = new THREE.Mesh(geo.box, glass);
    leaf.scale.set(0.1, doorTop - 0.3, 2.2);
    leaf.position.set(HQ.x + s * 2.5, (doorTop - 0.3) / 2 + 0.15, fz - 1.1);
    g.add(leaf);
    z.boxes.push({ x: HQ.x + s * 2.5, z: fz - 1.1, hw: 0.18, hd: 1.15 });
    const edge = new THREE.Mesh(geo.box, mat(0x1e2636, { metal: true }));
    edge.scale.set(0.14, doorTop - 0.3, 0.14);
    edge.position.set(HQ.x + s * 2.5, (doorTop - 0.3) / 2 + 0.15, fz - 2.2);
    g.add(edge);
  });
  const lintel = new THREE.Mesh(
    geo.box,
    new THREE.MeshStandardMaterial({ color: 0xd8dde8, roughness: 0.5 })
  );
  lintel.scale.set(10, 8 - doorTop, 1);
  lintel.position.set(HQ.x, doorTop + (8 - doorTop) / 2, fz);
  lintel.castShadow = true;
  g.add(lintel);
  const thr = new THREE.Mesh(geo.box, mat(0x16233c, { em: 0x2a7aff, ei: 0.8 }));
  thr.scale.set(5.4, 0.1, 2);
  thr.position.set(HQ.x, 0.1, fz);
  g.add(thr);
  const strip = new THREE.Mesh(geo.box, mat(0x9ad0ff, { em: 0x9ad0ff, ei: 1 }));
  strip.scale.set(5, 0.18, 0.18);
  strip.position.set(HQ.x, doorTop - 0.12, fz + 0.56);
  g.add(strip);
  const ent = makeLabel('ENTRANCE', { w: 5.4, h: 1, color: '#7ad0ff', font: 56 });
  ent.position.set(HQ.x, doorTop + 1.7, fz + 0.56);
  g.add(ent);
  halo(z, HQ.x, 3, fz + 1, 0x7ad0ff, 5, 0.24);
  [-12, 12].forEach((dx) => {
    const band = new THREE.Mesh(geo.box, glass);
    band.scale.set(12.5, 2.4, 0.16);
    band.position.set(HQ.x + dx, 5.7, fz + 0.5);
    g.add(band);
  });
  const lobbyFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(HQ.w, HQ.d),
    new THREE.MeshStandardMaterial({ color: 0x8a94a8, roughness: 0.25, metalness: 0.3 })
  );
  lobbyFloor.rotation.x = -Math.PI / 2;
  lobbyFloor.position.set(HQ.x, 0.08, HQ.z);
  g.add(lobbyFloor);
  const roof = new THREE.Mesh(geo.box, roofMat);
  roof.scale.set(HQ.w + 1, 0.6, HQ.d + 1);
  roof.position.set(HQ.x, 8.3, HQ.z);
  g.add(roof);
  z.hqRoof = roof;
  const tower = building(HQ.x, HQ.z - 28, 26, 62, 22, 'office', glass);
  tower.castShadow = true;
  const hqSign = makeLabel('HUNTER ASSOCIATION', { w: 16, h: 2.4, color: '#7ad0ff', font: 52 });
  hqSign.position.set(HQ.x, 10.4, HQ.z + HQ.d / 2 + 0.6);
  g.add(hqSign);
  z.hqSign = hqSign;
  const lob = new THREE.PointLight(0x9ad0ff, 40, 40, 1.4);
  lob.position.set(HQ.x, 6.5, HQ.z);
  g.add(lob);
  const desk = new THREE.Mesh(
    geo.box,
    new THREE.MeshStandardMaterial({ color: 0x2a3a5a, emissive: 0x1a4a8a, emissiveIntensity: 0.4 })
  );
  desk.scale.set(10, 1.1, 1.6);
  desk.position.set(HQ.x, 0.55, HQ.z - 8);
  g.add(desk);
  z.boxes.push({ x: HQ.x, z: HQ.z - 8, hw: 5, hd: 0.8 });
  const board = makeLabel('MISSION BOARD', { w: 6, h: 1.5, color: '#7ad0ff', bg: 'rgba(10,40,90,0.6)', font: 54 });
  board.position.set(HQ.x - 14, 2.8, HQ.z - 14.2);
  g.add(board);
  z.anchors.board = [HQ.x - 14, HQ.z - 12];
  const stand = new THREE.Mesh(geo.box, mat(0x1a3a6a, { em: 0x2a7aff, ei: 0.5 }));
  stand.scale.set(6.4, 3.4, 0.2);
  stand.position.set(HQ.x - 14, 2.6, HQ.z - 14.45);
  g.add(stand);
  z.anchors.reception = [HQ.x, HQ.z - 10];
  z.anchors.hqDoor = [HQ.x, HQ.z + HQ.d / 2 + 3];
  z.anchors.hqIn = [HQ.x, HQ.z + 6];
  z.hqRect = { x0: HQ.x - HQ.w / 2, x1: HQ.x + HQ.w / 2, z0: HQ.z - HQ.d / 2, z1: HQ.z + HQ.d / 2 };
  [-14, 14].forEach((dx) =>
    [-6, 6].forEach((dz) => {
      const p = new THREE.Mesh(geo.cyl, mat(0xc8d0e0));
      p.scale.set(0.7, 8, 0.7);
      p.position.set(HQ.x + dx, 4, HQ.z + dz);
      g.add(p);
      z.circles.push({ x: HQ.x + dx, z: HQ.z + dz, r: 0.8 });
    })
  );
  // Association plaza (1,1): gate pad, benches
  z.anchors.dgate = [-30, -34];
  z.anchors.plaza = [-30, -28];
  const pad = new THREE.Mesh(new THREE.CircleGeometry(6, 32), mat(0x2a2a3a));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(-30, 0.06, -34);
  g.add(pad);
  for (let i = 0; i < 6; i++) {
    const bn = new THREE.Mesh(geo.box, mat(0x6a4a2a));
    bn.scale.set(2, 0.5, 0.6);
    bn.position.set(-50 + i * 4, 0.3, -12);
    g.add(bn);
  }
  // Guilds
  building(
    32,
    -101,
    30,
    46,
    26,
    'office',
    new THREE.MeshStandardMaterial({ color: 0xe8eefc, emissive: 0xaab4d0, emissiveIntensity: 0.5, roughness: 0.4 }),
    'WHITE TIGER GUILD',
    1,
    '#ffffff'
  );
  z.anchors.wt = [32, -83];
  for (let i = 0; i < 6; i++) {
    const st = new THREE.Mesh(geo.box, mat(0x151520));
    st.scale.set(0.8, 40, 0.1);
    st.position.set(18 + i * 5.6, 22, -87.9);
    g.add(st);
  }
  building(
    101,
    -101,
    34,
    78,
    30,
    'office',
    new THREE.MeshStandardMaterial({
      color: 0xd8b060,
      emissive: 0xa07828,
      emissiveIntensity: 0.6,
      metalness: 0.7,
      roughness: 0.3,
    }),
    'HUNTERS GUILD',
    1,
    '#ffe08a'
  );
  z.anchors.hg = [101, -81];
  building(
    101,
    -32,
    32,
    38,
    28,
    'dark',
    new THREE.MeshStandardMaterial({ color: 0x3a1418, emissive: 0x801018, emissiveIntensity: 0.6 }),
    'FIEND GUILD',
    -1,
    '#ff4a4a'
  );
  z.anchors.fg = [101, -50];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(geo.cone, mat(0x801018, { em: 0x801018 }));
    sp.scale.set(1.2, 5, 1.2);
    sp.position.set(88 + i * 6, 40, -32);
    g.add(sp);
  }
  // Ahjin lot (locked)
  const fence = new THREE.Mesh(geo.box, mat(0xe0b020));
  fence.scale.set(40, 1.8, 0.2);
  fence.position.set(-32, 0.9, -80);
  g.add(fence);
  const f2 = fence.clone();
  f2.position.set(-32, 0.9, -122);
  g.add(f2);
  const lotSign = makeLabel('AHJIN GUILD', { w: 8, h: 1.6, color: '#b08aff', sub: 'Future site (locked)', font: 56 });
  lotSign.position.set(-32, 3, -79.7);
  g.add(lotSign);
  z.anchors.ahjin = [-32, -74];
  const cranes = new THREE.Mesh(geo.box, mat(0xe0a020));
  cranes.scale.set(0.8, 30, 0.8);
  cranes.position.set(-45, 15, -105);
  g.add(cranes);
  const arm = cranes.clone();
  arm.scale.set(24, 0.8, 0.8);
  arm.position.set(-34, 30, -105);
  g.add(arm);
  z.boxes.push({ x: -32, z: -81, hw: 20, hd: 0.6 });
  // Hospital (0,1)
  building(
    -101,
    -32,
    36,
    34,
    28,
    'office',
    new THREE.MeshStandardMaterial({ color: 0xf0f4f8, emissive: 0xc0c8d0, emissiveIntensity: 0.4 }),
    'SEOUL HOSPITAL',
    1,
    '#ff6a6a'
  );
  z.anchors.hospital = [-101, -14];
  const cr = new THREE.Mesh(geo.box, mat(0xff2020, { basic: true }));
  cr.scale.set(5, 1.4, 0.3);
  cr.position.set(-101, 28, -17.8);
  g.add(cr);
  const cr2 = cr.clone();
  cr2.scale.set(1.4, 5, 0.3);
  g.add(cr2);
  cr2.position.copy(cr.position);
  car(-86, -10); // ambulance-ish
  // Weapon shop (2,2)
  building(
    24,
    26,
    20,
    12,
    16,
    'dark',
    new THREE.MeshStandardMaterial({ color: 0x2a2e3a, emissive: 0x4a2ae0, emissiveIntensity: 0.5 }),
    'HUNTER GEAR SHOP',
    -1,
    '#c88aff'
  );
  z.anchors.shop = [24, 14];
  building(46, 30, 16, 28, 18, 'office', undefined, 'MART', -1);
  // Jin-Woo's home block (0,3)
  building(-112, 92, 20, 26, 18, 'apt', undefined, 'HAPPY APT', -1, '#7affb0');
  building(-90, 92, 20, 30, 18, 'apt', undefined, 'SUNG HOME', -1, '#ffc04a');
  z.anchors.home = [-90, 80];
  z.anchors.family = [-96, 78];
  // Park (1,2)
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(51, 51),
    new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 1 })
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(-32.5, 0.04, 32.5);
  park.receiveShadow = true;
  g.add(park);
  z.anchors.pushup = [-36, 30];
  z.anchors.situp = [-28, 30];
  z.anchors.park = [-32, 32];
  [
    [-36, 30],
    [-28, 30],
  ].forEach(([x, zz]) => {
    const mt = new THREE.Mesh(geo.box, mat(0x3a6ac0));
    mt.scale.set(2.4, 0.08, 1.2);
    mt.position.set(x, 0.1, zz);
    g.add(mt);
  });
  const tl = makeLabel('TRAINING PARK', { w: 6, h: 1.2, color: '#7affb0', font: 56 });
  tl.position.set(-32, 3.6, 30);
  g.add(tl);
  const pole = new THREE.Mesh(geo.cyl, mat(0x333));
  pole.scale.set(0.1, 3.6, 0.1);
  pole.position.set(-32, 1.8, 30);
  g.add(pole);
  // Subway entrance
  const sub = new THREE.Mesh(geo.box, mat(0x2a3a4a));
  sub.scale.set(7, 3.2, 5);
  sub.position.set(-80, 1.6, -62);
  g.add(sub);
  z.boxes.push({ x: -80, z: -62, hw: 3.5, hd: 2.5 });
  const sg = makeLabel('SUBWAY', { w: 5, h: 1.2, color: '#7ad0ff', sub: 'Line 3', font: 56 });
  sg.position.set(-80, 3.9, -59.4);
  g.add(sg);
  // Bridge + river
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 140),
    new THREE.MeshStandardMaterial({
      color: 0x14284a,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0a1a3a,
      emissiveIntensity: 0.5,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.6, 182);
  g.add(water);
  const br = new THREE.Mesh(geo.box, mat(0x3a3e4a));
  br.scale.set(12, 0.5, 24);
  br.position.set(0, 0, 123);
  g.add(br);
  [-6, 6].forEach((x) => {
    const rl = new THREE.Mesh(geo.box, mat(0x8a8e9a));
    rl.scale.set(0.2, 1, 24);
    rl.position.set(x, 0.8, 123);
    g.add(rl);
    z.boxes.push({ x: x * 1.05, z: 123, hw: 0.3, hd: 12 });
  });
  const bl = makeLabel('HAN RIVER BRIDGE', { w: 7, h: 1.4, color: '#7ad0ff', font: 52 });
  bl.position.set(0, 4, 112);
  g.add(bl);
  z.boxes.push({ x: 0, z: 135, hw: 8, hd: 1 });
  // Skyline & Namsan tower
  const skyLights: number[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + R() * 0.1,
      rad = 190 + R() * 40;
    const b = new THREE.Mesh(geo.box, wm.office[i % 3]);
    const w = 18 + R() * 20,
      h = 50 + R() * 110;
    b.scale.set(w, h, w);
    b.position.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad);
    g.add(b);
    const gb = b.material as THREE.MeshStandardMaterial;
    gb.fog = true;
    if (i % 2 === 0) skyLights.push(Math.cos(a) * rad, h + 1.2, Math.sin(a) * rad);
  }
  if (skyLights.length) {
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(skyLights), 3));
    g.add(
      new THREE.Points(
        pg,
        new THREE.PointsMaterial({
          color: 0xff3040,
          size: 2.2,
          transparent: true,
          opacity: 0.8,
          map: glowMap(),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
    );
  }
  const nt = new THREE.Group();
  const sh = new THREE.Mesh(geo.cyl, mat(0xc0c0d0));
  sh.scale.set(2.5, 120, 2.5);
  sh.position.y = 60;
  const dk = new THREE.Mesh(geo.sph, mat(0xe0e0f0, { em: 0x6a8aff, ei: 0.8 }));
  dk.scale.set(9, 5, 9);
  dk.position.y = 120;
  const an = new THREE.Mesh(geo.cone, mat(0xff4040, { basic: true }));
  an.scale.set(0.8, 40, 0.8);
  an.position.y = 146;
  nt.add(sh, dk, an);
  nt.position.set(-170, 0, -150);
  g.add(nt);
  halo(z, -170, 120, -150, 0x8a5cff, 40, 0.28);
  // labels for map
  z.labels.push(
    { x: HQ.x, z: HQ.z, text: 'Hunter Association', color: '#7ad0ff' },
    { x: 32, z: -101, text: 'White Tiger Guild', color: '#ffffff' },
    { x: 101, z: -101, text: 'Hunters Guild', color: '#ffe08a' },
    { x: 101, z: -32, text: 'Fiend Guild', color: '#ff6a6a' },
    { x: -32, z: -101, text: 'Ahjin Guild (locked)', color: '#b08aff' },
    { x: -101, z: -32, text: 'Hospital', color: '#ff8a8a' },
    { x: 24, z: 26, text: 'Gear Shop', color: '#c88aff' },
    { x: -32, z: 32, text: 'Training Park', color: '#7affb0' },
    { x: -90, z: 92, text: "Jin-Woo's Home", color: '#ffc04a' },
    { x: -80, z: -62, text: 'Subway', color: '#7ad0ff' },
    { x: 0, z: 123, text: 'Han River Bridge', color: '#7ad0ff' },
    { x: 101, z: 40, text: 'Parking', color: '#aaaaaa' }
  );
  z.spawn = [-65, 48, Math.PI];
  z.anchors.leakGate = [-65, 20];
  z.anchors.raidGate = [100, 10];
  // gate pad for raid gate
  const rp = new THREE.Mesh(new THREE.CircleGeometry(6, 32), mat(0x2a2a3a));
  rp.rotation.x = -Math.PI / 2;
  rp.position.set(100, 0.06, 10);
  g.add(rp);
  const sg2 = makeLabel('GATE ZONE', { w: 5, h: 1, color: '#ffc04a', font: 52 });
  sg2.position.set(100, 7.5, 3);
  g.add(sg2);
  z.update = (_dt, t, px, pz) => {
    const r = z.hqRect as Rect;
    const inside = inRect(r, px, pz, -1);
    roof.visible = !inside;
    hqSign.visible = true;
    z.flicker.forEach((f) => {
      if ((f as any).isLight) (f as THREE.PointLight).intensity = 16 + Math.sin(t * 9 + f.id) * 2;
    });
  };
  wrapAtmo(z);
  return z;
}

// ===================================================== DOUBLE DUNGEON TEMPLE
export function buildTemple(): Zone {
  const z = newZone('double', 'Double Dungeon: Ancient Temple');
  const g = z.group;
  z.fog = [0x0c0a10, 10, 80];
  z.sun = 0.0;
  z.ambient = 1.1;
  z.hemi = [0x6a5a8a, 0x1a1418];
  z.music = 'temple';
  z.dark = true;
  z.shadowRadius = 40;
  g.add(sky(0x020204, 0x050408, 0x0a0810, false));
  addMotes(z, 0xffb060, 90, 58, 15, 0.4);
  addHaze(z, 0x6a4a2a, 12, 52, 0.5, 8, 0.07);
  z.rects.push(
    { x0: -5, x1: 5, z0: -50, z1: 8 },
    { x0: -26, x1: 26, z0: -104, z1: -48 },
    { x0: -17, x1: -5, z0: -28, z1: -16 }
  );
  const fl = new THREE.MeshStandardMaterial({ map: stoneTex('#3a3630', 1), roughness: 0.9 });
  z.rects.forEach((r) => floorFor(z, r, fl, 0, 6));
  wallFiller(z, {
    geo: geo.box,
    mat: new THREE.MeshStandardMaterial({ map: stoneTex('#5a544a', 1), roughness: 1 }),
    hmin: 10,
    hmax: 13,
    step: 2.4,
    seed: 3,
  });
  // monumental gate into the inner sanctum
  const gateStone = new THREE.MeshStandardMaterial({ map: stoneTex('#6a6256', 1), roughness: 0.95 });
  [-1, 1].forEach((s) => {
    const col = new THREE.Mesh(geo.box, gateStone);
    col.scale.set(1.5, 11.5, 1.5);
    col.position.set(s * 6.7, 5.75, -48.2);
    col.castShadow = true;
    g.add(col);
    z.circles.push({ x: s * 6.7, z: -48.2, r: 1.1 });
    const band = new THREE.Mesh(geo.box, mat(0xb08a3a, { metal: true }));
    band.scale.set(1.7, 0.12, 1.7);
    band.position.set(s * 6.7, 9.2, -48.2);
    g.add(band);
    const cap = new THREE.Mesh(geo.cone, mat(0x8a8478));
    cap.scale.set(0.95, 1.4, 0.95);
    cap.position.set(s * 6.7, 12.2, -48.2);
    g.add(cap);
    flame(z, s * 5.4, 3.3, -47.5, 0xff9a3a, s > 0, 24);
  });
  const lintel = new THREE.Mesh(geo.box, gateStone);
  lintel.scale.set(15.2, 1.1, 1.8);
  lintel.position.set(0, 10.8, -48.2);
  g.add(lintel);
  const sigil = makeLabel('\u16A0 \u16B1 \u16D6', { w: 5.4, h: 1.4, color: '#e0b060', font: 64 });
  sigil.position.set(0, 11.8, -47.2);
  g.add(sigil);
  // hanging banners along the hall
  for (let i = 0; i < 4; i++)
    [-1, 1].forEach((s) => {
      const x = s * 24.6,
        zz = -58 - i * 12;
      const cloth = new THREE.Mesh(geo.box, mat(0x2a1018));
      cloth.scale.set(0.08, 5.6, 2.2);
      cloth.position.set(x, 6.2, zz);
      g.add(cloth);
      const glyph = makeLabel(i % 2 ? '\u16B1 \u16C1' : '\u16A0 \u16DE', { w: 1.6, h: 4.4, color: '#c8943a', font: 54 });
      glyph.position.set(x - s * 0.1, 6.2, zz);
      glyph.rotation.y = (-s * Math.PI) / 2;
      g.add(glyph);
      const rod = new THREE.Mesh(geo.cyl, mat(0x6a5a3a, { metal: true }));
      rod.scale.set(0.07, 2.8, 0.07);
      rod.rotation.x = Math.PI / 2;
      rod.position.set(x, 8.9, zz);
      g.add(rod);
    });
  // ceiling ribs
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(geo.box, mat(0x24201c));
    rib.scale.set(50, 0.45, 0.8);
    rib.position.set(0, 11.5, -53 - i * 8.5);
    g.add(rib);
  }
  // light shafts over the altar
  [0, 1, 2, 3].forEach((i) => {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4 + i * 0.5, 4.2 + i * 0.9, 17, 14, 1, true),
      mat(0xffc070, { add: true, op: 0.035, side: true })
    );
    shaft.position.set(0, 8.5, -76);
    g.add(shaft);
  });
  // ceiling slab for corridor (dark)
  const ceil = new THREE.Mesh(geo.box, mat(0x0a0a0e));
  ceil.scale.set(14, 1, 58);
  ceil.position.set(0, 12, -21);
  g.add(ceil);
  // corridor columns + torches + hieroglyph friezes
  for (let i = 0; i < 6; i++)
    [-1, 1].forEach((s) => {
      const c = new THREE.Mesh(geo.cyl, mat(0x6a645a));
      c.scale.set(0.7, 10, 0.7);
      c.position.set(s * 4.3, 5, -4 - i * 8);
      c.castShadow = true;
      g.add(c);
      z.circles.push({ x: s * 4.3, z: -4 - i * 8, r: 0.7 });
      if (i % 2 === 0) flame(z, s * 3.8, 2.4, -4 - i * 8, 0xff8a30, i < 4);
    });
  // traps
  for (let i = 0; i < 4; i++) {
    const tz = -12 - i * 9;
    const gp = new THREE.Group();
    const plate = new THREE.Mesh(geo.box, mat(0x5a3a2a, { em: 0x802010, ei: 0.2 }));
    plate.scale.set(7, 0.06, 3);
    plate.position.set(0, 0.06, tz);
    g.add(plate);
    gp.position.set(0, -1.2, tz);
    for (let k = 0; k < 12; k++) {
      const sp = new THREE.Mesh(geo.cone, mat(0xbbbbc4, { metal: true }));
      sp.scale.set(0.22, 1.1, 0.22);
      sp.position.set(-2.8 + (k % 6) * 1.12, 0.55, -1 + Math.floor(k / 6) * 2);
      gp.add(sp);
    }
    g.add(gp);
    z.traps.push({ x: 0, z: tz, r: 3.4, up: false, warn: false, g: gp, phase: i * 0.9 });
    (plate as any).userData.trap = true;
    z.traps[z.traps.length - 1].plate = plate;
  }
  // hall: decor statues praying around the room
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const sx = Math.cos(a) * 21.5,
      sz = -76 + Math.sin(a) * 24;
    if (sz > -52 && Math.abs(sx) < 8) continue;
    const st = makeStatueDecor(i);
    st.root.position.set(sx, 0, sz);
    st.root.rotation.y = Math.atan2(-sx, -(sz + 76));
    const base = new THREE.Mesh(geo.box, mat(0x4a463e));
    base.scale.set(2.6, 0.9, 2.6);
    base.position.set(sx, 0.45, sz);
    g.add(base);
    st.root.position.y = 0.9;
    g.add(st.root);
    z.circles.push({ x: sx, z: sz, r: 1.5 });
    z.statues = z.statues || [];
    z.statues.push({ x: sx, z: sz, rig: st, base });
    st.armL.rotation.set(-0.9, 0, 0.2);
    st.armR.rotation.set(-0.9, 0, -0.2);
    st.foreL.rotation.x = -1.2;
    st.foreR.rotation.x = -1.2;
  }
  // altar disk
  const altarTex = canvasTex(256, 256, (c) => {
    c.fillStyle = '#12100e';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#d6b060';
    c.lineWidth = 4;
    [110, 90, 60].forEach((r) => {
      c.beginPath();
      c.arc(128, 128, r, 0, 6.3);
      c.stroke();
    });
    for (let k = 0; k < 12; k++) {
      c.beginPath();
      c.moveTo(128 + Math.cos(k * 0.5236) * 60, 128 + Math.sin(k * 0.5236) * 60);
      c.lineTo(128 + Math.cos(k * 0.5236) * 110, 128 + Math.sin(k * 0.5236) * 110);
      c.stroke();
    }
    c.fillStyle = '#d6b060';
    c.beginPath();
    c.arc(128, 128, 14, 0, 6.3);
    c.fill();
  });
  const altar = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 40),
    new THREE.MeshStandardMaterial({
      map: altarTex,
      emissive: 0xaa7a20,
      emissiveMap: altarTex,
      emissiveIntensity: 0.35,
    })
  );
  altar.rotation.x = -Math.PI / 2;
  altar.position.set(0, 0.07, -76);
  g.add(altar);
  z.altar = altar;
  z.anchors.altar = [0, -76];
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.06, 8, 72), mat(0xd6b060, { em: 0x6a4a16, ei: 0.5 }));
  inlay.rotation.x = Math.PI / 2;
  inlay.position.set(0, 0.075, -76);
  g.add(inlay);
  [
    [-18, -57],
    [18, -57],
    [-18, -94],
    [18, -94],
  ].forEach(([x, zz]) => {
    const base = new THREE.Mesh(geo.cyl, mat(0x3a342c));
    base.scale.set(0.62, 1.3, 0.62);
    base.position.set(x, 0.65, zz);
    g.add(base);
    flame(z, x, 1.4, zz, 0xff7a20, true, 26);
    halo(z, x, 2.1, zz, 0xff8a30, 2.4, 0.3);
  });
  halo(z, 0, 5.5, -100, 0xffcf70, 22, 0.16);
  // Statue of God (big)
  z.anchors.god = [0, -100];
  const pedestal = new THREE.Mesh(geo.box, mat(0x4a463e));
  pedestal.scale.set(10, 1.6, 8);
  pedestal.position.set(0, 0.8, -100);
  g.add(pedestal);
  z.boxes.push({ x: 0, z: -100, hw: 5, hd: 4 });
  // tablet
  const tab = new THREE.Mesh(geo.box, mat(0x2c2a26));
  tab.scale.set(7, 5, 0.6);
  tab.position.set(0, 2.5, -91);
  g.add(tab);
  z.boxes.push({ x: 0, z: -91, hw: 3.5, hd: 0.5 });
  z.tabletMesh = makeLabel('PRAY TO THE STATUE OF GOD', { w: 6.4, h: 1.6, color: '#ffcf70', font: 50 });
  z.tabletMesh.position.set(0, 3, -90.65);
  g.add(z.tabletMesh);
  z.anchors.tablet = [0, -88];
  // runic wall carvings
  for (let i = 0; i < 6; i++)
    [-1, 1].forEach((s) => {
      const c = makeLabel(['\u16A0\u16B1\u16B2', '\u16C1\u16C7\u16D2', '\u16DA\u16DC\u16DE'][i % 3], {
        w: 3,
        h: 1.2,
        color: '#9a8458',
        font: 64,
      });
      c.position.set(s * 4.9, 5, -6 - i * 7.5);
      c.rotation.y = (-s * Math.PI) / 2;
      g.add(c);
    });
  [
    [-22, -52],
    [22, -52],
    [-22, -98],
    [22, -98],
  ].forEach(([x, zz]) => {
    const p = new THREE.Mesh(geo.cyl, mat(0x6a645a));
    p.scale.set(0.9, 12, 0.9);
    p.position.set(x, 6, zz);
    g.add(p);
    z.circles.push({ x, z: zz, r: 0.9 });
    flame(z, x, 3, zz, 0xff7a20, true, 26);
  });
  const glow = new THREE.PointLight(0xffa850, 30, 30, 1.5);
  glow.position.set(0, 4, -76);
  g.add(glow);
  z.godLight = glow;
  // hidden chamber: cracked wall + chest
  const crack = new THREE.Mesh(geo.box, new THREE.MeshStandardMaterial({ map: stoneTex('#6a645a', 1), roughness: 1 }));
  crack.scale.set(0.8, 6, 12);
  crack.position.set(-5.4, 3, -22);
  g.add(crack);
  z.crackWall = crack;
  z.boxes.push({ x: -5.4, z: -22, hw: 0.6, hd: 6, id: 'crack' });
  z.anchors.crack = [-3, -22];
  const crl = makeLabel('~ ~ ~', { w: 3, h: 1, color: '#ff8a50', font: 60 });
  crl.position.set(-4.95, 2, -22);
  crl.rotation.y = Math.PI / 2;
  g.add(crl);
  const chest = new THREE.Mesh(geo.box, mat(0x6a4a1a, { em: 0x402a08 }));
  chest.scale.set(1.6, 1, 1);
  chest.position.set(-14, 0.5, -22);
  g.add(chest);
  z.chest = chest;
  z.anchors.chest = [-14, -22];
  flame(z, -9, 1.5, -18, 0x6a8aff, true, 12);
  z.anchors.exit = [0, 4];
  z.spawn = [0, 2, Math.PI];
  z.anchors.hall = [0, -54];
  z.update = (_dt, t) => {
    z.flicker.forEach((f) => {
      if ((f as any).isLight) (f as THREE.PointLight).intensity = 18 + Math.sin(t * 11 + f.id * 3) * 3;
      else f.scale.y = 0.55 + Math.sin(t * 13 + f.id) * 0.12;
    });
    z.traps.forEach((tp) => {
      const c = (t + tp.phase) % 3.2;
      tp.warn = c > 1.8 && c < 2.4;
      tp.up = c >= 2.4 && c < 3.1;
      tp.g.position.y = THREE.MathUtils.lerp(tp.g.position.y, tp.up ? 0 : -1.3, 0.35);
      ((tp as any).plate.material as THREE.MeshStandardMaterial).emissiveIntensity = tp.warn
        ? 1.4 + Math.sin(t * 40) * 0.6
        : 0.2;
    });
  };
  wrapAtmo(z);
  return z;
}

// ===================================================== VENOM CAVE
export function buildCave(): Zone {
  const z = newZone('venom', 'Instant Dungeon: Venom Cave');
  const g = z.group;
  const R = rng(21);
  z.fog = [0x08140c, 8, 70];
  z.ambient = 1.4;
  z.hemi = [0x4aff8a, 0x10200f];
  z.music = 'cave';
  z.dark = true;
  z.sun = 0.05;
  g.add(sky(0x010503, 0x020804, 0x03100a, false));
  addMotes(z, 0x6aff9a, 100, 104, 12, 0.4);
  addHaze(z, 0x1a6a3a, 16, 116, 0.5, 9, 0.08);
  z.rects.push(
    { x0: -13, x1: 13, z0: -12, z1: 16 },
    { x0: -3.5, x1: 3.5, z0: 16, z1: 34 },
    { x0: -17, x1: 17, z0: 34, z1: 66 },
    { x0: -3.5, x1: 3.5, z0: 66, z1: 86 },
    { x0: -25, x1: 25, z0: 86, z1: 134 }
  );
  const fl = new THREE.MeshStandardMaterial({
    map: canvasTex(256, 256, (c) => noiseFill(c, 256, 256, '#2a3a2a', 70, 2500), 1),
    roughness: 1,
  });
  z.rects.forEach((r) => floorFor(z, r, fl, 0, 8));
  wallFiller(z, {
    geo: new THREE.IcosahedronGeometry(1, 0),
    mat: new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 1, flatShading: true }),
    hmin: 4,
    hmax: 11,
    step: 2.6,
    w: 3,
    layers: 2,
    seed: 5,
  });
  // stalactites
  {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 46; i++) {
      const r = z.rects[i % z.rects.length];
      pts.push([r.x0 + 1.5 + R() * (r.x1 - r.x0 - 3), 8 + R() * 4, r.z0 + 1.5 + R() * (r.z1 - r.z0 - 3)]);
    }
    const im = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 2.4, 5), mat(0x2a3a2a), pts.length);
    const d = new THREE.Object3D();
    pts.forEach(([x, y, zz], i) => {
      d.position.set(x, y, zz);
      d.rotation.set(Math.PI, R() * 3, 0);
      d.scale.set(0.6 + R() * 0.9, 0.8 + R() * 1.1, 0.6 + R() * 0.9);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.castShadow = false;
    g.add(im);
  }
  // stone arches over the tunnels
  [33, 65, 85].forEach((zz) => {
    const archMat = new THREE.MeshStandardMaterial({ color: 0x3e4c3c, roughness: 1, flatShading: true });
    [-1, 1].forEach((s) => {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), archMat);
      p.scale.set(1.2, 4.2, 1.2);
      p.position.set(s * 4.4, 2.4, zz);
      g.add(p);
    });
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), archMat);
    top.scale.set(5.4, 1.4, 1.4);
    top.position.set(0, 5.4, zz);
    g.add(top);
  });
  for (let i = 0; i < 26; i++) {
    const r = z.rects[Math.floor(R() * z.rects.length)];
    const x = r.x0 + 2 + R() * (r.x1 - r.x0 - 4),
      zz = r.z0 + 2 + R() * (r.z1 - r.z0 - 4);
    const cluster = new THREE.Group();
    const h = 1 + R() * 2.2;
    const cr = new THREE.Mesh(geo.cone, mat(0x5aff8a, { basic: true, op: 0.9 }));
    cr.scale.set(0.32, h, 0.32);
    cr.position.y = h / 2;
    cr.rotation.z = (R() - 0.5) * 0.45;
    cluster.add(cr);
    for (let k = 0; k < 2 + Math.floor(R() * 3); k++) {
      const sh = h * (0.35 + R() * 0.45);
      const side = new THREE.Mesh(geo.cone, mat(k % 2 ? 0x9affc0 : 0x3ae07a, { basic: true, op: 0.8 }));
      side.scale.set(0.18 + R() * 0.12, sh, 0.18 + R() * 0.12);
      side.position.set((R() - 0.5) * 0.8, sh / 2, (R() - 0.5) * 0.8);
      side.rotation.z = (R() - 0.5) * 0.9;
      cluster.add(side);
    }
    cluster.position.set(x, 0, zz);
    g.add(cluster);
    if (i % 3 === 0) halo(z, x, 1.2, zz, 0x4aff8a, 4.4, 0.24);
    if (i % 5 === 0) {
      const l = new THREE.PointLight(0x4aff8a, 13, 18, 1.6);
      l.position.set(x, 1.5, zz);
      g.add(l);
      z.lights.push(l);
    }
  }
  for (let i = 0; i < 22; i++) {
    const r = z.rects[Math.floor(R() * z.rects.length)];
    const x = r.x0 + 2 + R() * (r.x1 - r.x0 - 4),
      zz = r.z0 + 2 + R() * (r.z1 - r.z0 - 4);
    if (Math.hypot(x, zz - 112) < 10) continue;
    const stem = new THREE.Mesh(geo.cyl, mat(0x9ad8c0));
    const h = 0.14 + R() * 0.3;
    stem.scale.set(0.035, h, 0.035);
    stem.position.set(x, h / 2, zz);
    g.add(stem);
    const cap = new THREE.Mesh(geo.sph, mat(0x6affc0, { basic: true, em: 0x2aff8a, ei: 0.6 }));
    cap.scale.set(0.13 + R() * 0.09, 0.06, 0.13 + R() * 0.09);
    cap.position.set(x, h, zz);
    g.add(cap);
  }
  for (let i = 0; i < 14; i++) {
    const r = z.rects[(i % 3) * 2];
    const x = r.x0 + 3 + R() * (r.x1 - r.x0 - 6),
      zz = r.z0 + 3 + R() * (r.z1 - r.z0 - 6);
    if (Math.abs(x) < 4 && r.x1 < 14) continue;
    const rk = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x45554a, flatShading: true })
    );
    const s = 0.8 + R() * 1.2;
    rk.scale.set(s, s * 1.3, s);
    rk.position.set(x, s * 0.5, zz);
    g.add(rk);
    z.circles.push({ x, z: zz, r: s * 0.9 });
  }
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(9, 32),
    new THREE.MeshBasicMaterial({ color: 0x1a8a4a, transparent: true, opacity: 0.55 })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.06, 112);
  g.add(pool);
  halo(z, 0, 1.2, 112, 0x2aff7a, 18, 0.22);
  halo(z, 0, 0.3, 112, 0x6affc0, 7, 0.35);
  z.circles.push({ x: 0, z: 112, r: 2 });
  for (let i = 0; i < 10; i++) {
    const a = R() * 6.28,
      rr = 4 + R() * 12;
    const bn = new THREE.Mesh(geo.box, mat(0xd8d4c0));
    bn.scale.set(0.15, 0.15, 1.2);
    bn.position.set(Math.cos(a) * rr, 0.1, 112 + Math.sin(a) * rr);
    bn.rotation.y = R() * 3;
    g.add(bn);
  }
  z.spawn = [0, -6, 0];
  z.anchors.boss = [0, 120];
  z.anchors.exit = [0, -8];
  z.anchors.bossDoor = [0, 84];
  z.spawns = [
    ['lizard', -8, 4],
    ['lizard', 8, 6],
    ['lizard', 0, 10],
    ['lizard', 10, -2],
    ['lizard', -10, 44],
    ['lizard', 10, 48],
    ['lizard', 0, 54],
    ['lizard', -12, 58],
    ['lizard', 12, 38],
    ['lizard', 0, 42],
  ];
  z.update = (_dt, t) => {
    pool.material.opacity = 0.45 + Math.sin(t * 2) * 0.1;
  };
  wrapAtmo(z);
  return z;
}

// ===================================================== JOB CHANGE ARENA
export function buildArena(): Zone {
  const z = newZone('job', 'Job Change Dungeon');
  const g = z.group;
  const R = rng(33);
  z.fog = [0x200a0c, 18, 140];
  z.ambient = 1.4;
  z.hemi = [0xff6a6a, 0x1a0a14];
  z.sun = 0.35;
  z.music = 'arena';
  z.dark = true;
  z.shadowRadius = 55;
  g.add(sky(0x0a0206, 0x3a0a14, 0x6a1a1a));
  addMotes(z, 0xff8a6a, 100, 90, 18, 0.42);
  addHaze(z, 0x6a1a1a, 10, 90, 0.8, 12, 0.06);
  z.rects.push({ x0: -48, x1: 48, z0: -48, z1: 48 });
  const sig = canvasTex(512, 512, (c) => {
    noiseFill(c, 512, 512, '#2a2022', 50, 3000);
    c.strokeStyle = 'rgba(200,40,50,0.8)';
    c.lineWidth = 6;
    [230, 190, 120].forEach((r) => {
      c.beginPath();
      c.arc(256, 256, r, 0, 6.3);
      c.stroke();
    });
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = k * 1.047;
      c.lineTo(256 + Math.cos(a) * 190, 256 + Math.sin(a) * 190);
    }
    c.closePath();
    c.stroke();
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = k * 1.047 + 0.5236;
      c.lineTo(256 + Math.cos(a) * 190, 256 + Math.sin(a) * 190);
    }
    c.closePath();
    c.stroke();
  });
  floorFor(
    z,
    z.rects[0],
    new THREE.MeshStandardMaterial({
      map: sig,
      roughness: 0.8,
      emissive: 0x300508,
      emissiveMap: sig,
      emissiveIntensity: 0.6,
    }),
    0,
    96
  );
  wallFiller(z, {
    geo: geo.box,
    mat: new THREE.MeshStandardMaterial({ map: stoneTex('#3a2c30', 1), roughness: 1 }),
    hmin: 14,
    hmax: 24,
    step: 3,
    w: 3,
    seed: 11,
  });
  // animated rite circle
  const rune = canvasTex(512, 512, (c) => {
    c.translate(256, 256);
    c.strokeStyle = 'rgba(255,70,70,0.9)';
    c.shadowColor = '#ff2030';
    c.shadowBlur = 18;
    c.lineWidth = 3;
    [242, 208, 158, 96].forEach((r) => {
      c.beginPath();
      c.arc(0, 0, r, 0, 6.3);
      c.stroke();
    });
    c.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283;
      c.beginPath();
      c.moveTo(Math.cos(a) * 158, Math.sin(a) * 158);
      c.lineTo(Math.cos(a) * 242, Math.sin(a) * 242);
      c.stroke();
    }
    c.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283 + (k ? 0.5236 : 0);
        c.lineTo(Math.cos(a) * 208, Math.sin(a) * 208);
      }
      c.closePath();
      c.stroke();
    }
  });
  const rite = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 76),
    new THREE.MeshBasicMaterial({
      map: rune,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  rite.rotation.x = -Math.PI / 2;
  rite.position.set(0, 0.085, 0);
  g.add(rite);
  z.rite = rite;
  // hanging war banners
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 6.283;
    const x = Math.cos(a) * 44.5,
      zz = Math.sin(a) * 44.5;
    const cloth = new THREE.Mesh(geo.box, mat(i % 3 ? 0x4a0a12 : 0x2a0a10));
    cloth.scale.set(2.6, 6.4, 0.06);
    cloth.position.set(x, 7.2, zz);
    cloth.rotation.y = -a + Math.PI / 2;
    g.add(cloth);
    const trim = new THREE.Mesh(geo.box, mat(0xb08a3a, { metal: true }));
    trim.scale.set(2.68, 0.12, 0.08);
    trim.position.set(x, 10.35, zz);
    trim.rotation.y = -a + Math.PI / 2;
    g.add(trim);
  }
  // light shafts
  [0, 1, 2].forEach((i) => {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(3 + i, 9 + i * 3, 30, 16, 1, true),
      mat(0xff6a4a, { add: true, op: 0.025, side: true })
    );
    shaft.position.set(0, 15, 0);
    g.add(shaft);
  });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.283;
    const x = Math.cos(a) * 40,
      zz = Math.sin(a) * 40;
    const p = new THREE.Mesh(geo.cyl, mat(0x4a3a40));
    p.scale.set(1.1, 14, 1.1);
    p.position.set(x, 7, zz);
    p.castShadow = true;
    g.add(p);
    z.circles.push({ x, z: zz, r: 1.1 });
    const st = makeStatueDecor(i);
    st.root.scale.multiplyScalar(0.9);
    st.root.position.set(Math.cos(a + 0.2) * 36, 0, Math.sin(a + 0.2) * 36);
    st.root.rotation.y = Math.atan2(-Math.cos(a + 0.2), -Math.sin(a + 0.2)) + Math.PI;
    st.armL.rotation.set(-0.5, 0, 0.3);
    st.armR.rotation.set(-0.5, 0, -0.3);
    g.add(st.root);
    z.circles.push({ x: Math.cos(a + 0.2) * 36, z: Math.sin(a + 0.2) * 36, r: 1.2 });
  }
  [
    [-26, -26],
    [26, -26],
    [-26, 26],
    [26, 26],
  ].forEach(([x, zz]) => {
    const b = new THREE.Mesh(geo.cyl, mat(0x2a2024));
    b.scale.set(0.9, 1.6, 0.9);
    b.position.set(x, 0.8, zz);
    g.add(b);
    z.circles.push({ x, z: zz, r: 1 });
    flame(z, x, 1.6, zz, 0xff3a2a, true, 30);
    halo(z, x, 2.6, zz, 0xff4a2a, 3.4, 0.3);
  });
  for (let i = 0; i < 30; i++) {
    const a = R() * 6.28,
      r = 8 + R() * 28;
    const rb = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat(0x3a3036));
    const s = 0.3 + R() * 0.7;
    rb.scale.set(s, s * 0.6, s);
    rb.position.set(Math.cos(a) * r, s * 0.3, Math.sin(a) * r);
    g.add(rb);
  }
  z.spawn = [0, 38, Math.PI];
  z.anchors.igris = [0, -26];
  z.anchors.exit = [0, 44];
  z.update = (_dt, t) => {
    z.flicker.forEach((f) => {
      if ((f as any).isLight) (f as THREE.PointLight).intensity = 26 + Math.sin(t * 9 + f.id * 3) * 4;
      else f.scale.y = 0.55 + Math.sin(t * 13 + f.id) * 0.15;
    });
    rite.rotation.z = t * 0.06;
    (rite.material as THREE.MeshBasicMaterial).opacity = 0.34 + Math.sin(t * 1.6) * 0.1;
  };
  wrapAtmo(z);
  return z;
}

// ===================================================== PENALTY ZONE
export function buildPenalty(): Zone {
  const z = newZone('penalty', 'Penalty Zone');
  const g = z.group;
  const R = rng(77);
  z.fog = [0x6a3a1a, 20, 140];
  z.ambient = 1.0;
  z.hemi = [0xffd0a0, 0x6a3a1a];
  z.sun = 1.0;
  z.music = 'penalty';
  z.shadowRadius = 50;
  g.add(sky(0x3a1a1a, 0xc06a2a, 0xffc070, false));
  addMotes(z, 0xffc070, 90, 92, 9, 0.42);
  addHaze(z, 0xff8a3a, 12, 96, 1.1, 18, 0.08);
  z.rects.push({ x0: -42, x1: 42, z0: -42, z1: 42 });
  floorFor(
    z,
    z.rects[0],
    new THREE.MeshStandardMaterial({
      map: canvasTex(256, 256, (c) => noiseFill(c, 256, 256, '#b8884a', 60, 3000), 1),
      roughness: 1,
    }),
    0,
    10
  );
  wallFiller(z, {
    geo: new THREE.IcosahedronGeometry(1, 0),
    mat: new THREE.MeshStandardMaterial({ color: 0x8a5a30, flatShading: true }),
    hmin: 6,
    hmax: 16,
    step: 3,
    w: 4,
    layers: 2,
    seed: 2,
  });
  // dunes beyond the trial bounds
  {
    const dune = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 1 }),
      40
    );
    const d = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const a = R() * 6.283;
      const rad = 52 + R() * 90;
      const s = 6 + R() * 16;
      d.position.set(Math.cos(a) * rad, -s * 0.45, Math.sin(a) * rad);
      d.scale.set(s, s * (0.25 + R() * 0.2), s * (0.7 + R() * 0.6));
      d.rotation.y = R() * 3;
      d.updateMatrix();
      dune.setMatrixAt(i, d.matrix);
    }
    g.add(dune);
  }
  // distant monoliths
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.283 + 0.3;
    const rad = 62 + R() * 30;
    const ob = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.95 })
    );
    const h = 12 + R() * 20;
    ob.scale.set(2.2 + R() * 1.4, h, 2.2 + R() * 1.4);
    ob.position.set(Math.cos(a) * rad, h / 2 - 1, Math.sin(a) * rad);
    ob.rotation.y = R() * 3;
    g.add(ob);
    halo(z, ob.position.x, h - 0.5, ob.position.z, 0xff7a2a, 2.6, 0.25);
  }
  for (let i = 0; i < 24; i++) {
    const x = (R() - 0.5) * 70,
      zz = (R() - 0.5) * 70;
    const bn = new THREE.Mesh(geo.box, mat(0xe8e0c8));
    bn.scale.set(0.25, 0.2, 1.6);
    bn.position.set(x, 0.15, zz);
    bn.rotation.y = R() * 3;
    g.add(bn);
  }
  for (let i = 0; i < 8; i++) {
    const x = (R() - 0.5) * 60,
      zz = (R() - 0.5) * 60;
    if (Math.hypot(x, zz) < 8) continue;
    const rb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x7a4a28, flatShading: true })
    );
    const s = 1 + R() * 1.4;
    rb.scale.set(s, s * 1.2, s);
    rb.position.set(x, s * 0.6, zz);
    g.add(rb);
    z.circles.push({ x, z: zz, r: s });
  }
  const sun = new THREE.Mesh(geo.sph, mat(0xff8a30, { basic: true }));
  sun.scale.setScalar(26);
  sun.position.set(-120, 60, -260);
  sun.userData.fogless = true;
  (sun.material as THREE.MeshBasicMaterial).fog = false;
  g.add(sun);
  halo(z, -120, 60, -260, 0xff9a40, 120, 0.28);
  z.spawn = [0, 0, 0];
  wrapAtmo(z);
  return z;
}
