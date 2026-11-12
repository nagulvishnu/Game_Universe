import * as THREE from "three";
import { Track } from "./track";
import { Tod, Weather } from "./data";
import { makeCanvas, rng, smoothstep, lerp, noise2 } from "./util";

export interface Ctx {
  group: THREE.Group;
  track: Track;
  R: () => number;
  anim: ((dt: number, t: number) => void)[];
  tod: Tod;
  weather: Weather;
  night: boolean;
  wet: number;
  hAt: (x: number, z: number) => number;
  groundY: number;
  fx: number; // effect density 0..1
  terrain?: THREE.Mesh;
  rings: { mesh: THREE.Object3D; speed: number }[];
}

/** Sweep a cross-section profile [d, y] along the track. */
export function sweep(track: Track, profile: number[][], vScale: number, i0 = 0, i1 = track.N, yOff = 0): THREE.BufferGeometry {
  const N = track.N;
  const count = ((i1 - i0 + N) % N || N) + (i1 === track.N && i0 === 0 ? 1 : 1);
  const steps = i0 === 0 && i1 === N ? N + 1 : count;
  const P = profile.length;
  const pos = new Float32Array(steps * P * 3);
  const uv = new Float32Array(steps * P * 2);
  let acc = 0;
  for (let k = 0; k < steps; k++) {
    const i = (i0 + k) % N;
    for (let j = 0; j < P; j++) {
      const o = (k * P + j) * 3;
      pos[o] = track.px[i] + track.nx[i] * profile[j][0];
      pos[o + 1] = track.py[i] + profile[j][1] + yOff;
      pos[o + 2] = track.pz[i] + track.nz[i] * profile[j][0];
      uv[(k * P + j) * 2] = j / (P - 1);
      uv[(k * P + j) * 2 + 1] = acc / vScale;
    }
    acc += track.ds;
  }
  const idx: number[] = [];
  for (let k = 0; k < steps - 1; k++)
    for (let j = 0; j < P - 1; j++) {
      const a = k * P + j, b = a + 1, c = a + P, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function archProfile(W: number, H: number, wallH: number, seg = 14): number[][] {
  const pts: number[][] = [[-W, 0], [-W, wallH]];
  for (let k = 0; k <= seg; k++) {
    const a = Math.PI - (k / seg) * Math.PI;
    pts.push([Math.cos(a) * W, wallH + Math.sin(a) * (H - wallH)]);
  }
  pts.push([W, 0]);
  return pts;
}

export const std = (color: THREE.ColorRepresentation, rough = 0.8, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

export interface Item { x: number; y: number; z: number; ry?: number; rx?: number; rz?: number; sx?: number; sy?: number; sz?: number; color?: THREE.ColorRepresentation }
export function makeInst(geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[], colored = false) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  items.forEach((it, i) => {
    d.position.set(it.x, it.y, it.z);
    d.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
    d.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
    if (colored) m.setColorAt(i, c.set(it.color ?? 0xffffff));
  });
  m.count = items.length;
  m.instanceMatrix.needsUpdate = true;
  if (colored && m.instanceColor) m.instanceColor.needsUpdate = true;
  m.computeBoundingSphere();
  return m;
}

export interface Spot { x: number; y: number; z: number; i: number; side: number; off: number; dist: number }
export function scatter(ctx: Ctx, count: number, minOff: number, maxOff: number, opt: { minSep?: number; iRange?: [number, number] } = {}): Spot[] {
  const { track, R } = ctx;
  const out: Spot[] = [];
  let tries = 0;
  while (out.length < count && tries < count * 8) {
    tries++;
    let i = Math.floor(R() * track.N);
    if (opt.iRange) i = Math.floor(opt.iRange[0] + R() * (opt.iRange[1] - opt.iRange[0])) % track.N;
    const side = R() < 0.5 ? -1 : 1;
    const off = minOff + R() * (maxOff - minOff);
    const x = track.px[i] + track.nx[i] * off * side + (R() - 0.5) * 6;
    const z = track.pz[i] + track.nz[i] * off * side + (R() - 0.5) * 6;
    const near = track.nearest(x, z);
    if (near.dist < Math.max(minOff * 0.92, opt.minSep ?? 0)) continue;
    out.push({ x, z, y: ctx.hAt(x, z), i, side, off, dist: near.dist });
  }
  return out;
}

// ------------------------------------------------------------------ textures
export function asphaltTexture(edge: string, center: string, wet: number) {
  return makeCanvas(256, 512, (g, w, h) => {
    g.fillStyle = "#2c2e35";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 30 + Math.random() * 40;
      g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // tyre lanes
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fillRect(w * 0.26, 0, w * 0.1, h);
    g.fillRect(w * 0.64, 0, w * 0.1, h);
    g.fillStyle = edge;
    g.fillRect(w * 0.035, 0, w * 0.015, h);
    g.fillRect(w * 0.95, 0, w * 0.015, h);
    g.fillStyle = center;
    for (let k = 0; k < 2; k++) g.fillRect(w * 0.495, h * (k * 0.5), w * 0.012, h * 0.25);
    void wet;
  });
}
export function roughTexture() {
  const t = makeCanvas(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = noise2(x / 14, y / 14) * 0.6 + noise2(x / 5, y / 5) * 0.4;
        const v = Math.floor(120 + n * 135);
        const o = (y * w + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
        img.data[o + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function noiseColorTexture(base: string, var1: number) {
  const t = makeCanvas(128, 128, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      const a = Math.random() > 0.5 ? 255 : 0;
      g.fillStyle = `rgba(${a},${a},${a},${var1 * Math.random()})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function checkerTexture(cols: number, rows: number) {
  const t = makeCanvas(cols * 8, rows * 8, (g) => {
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      g.fillStyle = (i + j) % 2 ? "#f5f5f5" : "#111";
      g.fillRect(i * 8, j * 8, 8, 8);
    }
  });
  t.magFilter = THREE.NearestFilter;
  return t;
}
export function stripeTexture() {
  const t = makeCanvas(16, 64, (g, w, h) => {
    g.fillStyle = "#e8e8e8";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#d4161c";
    g.fillRect(0, 0, w, h / 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function windowTexture(night: boolean, seed: number, hue = 0) {
  const R = rng(seed);
  const t = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = "#06070c";
    g.fillRect(0, 0, w, h);
    const n = 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n * 2; j++) {
      const lit = R() < (night ? 0.55 : 0.4);
      const c = R();
      const col = c < 0.55 ? "#ffd89a" : c < 0.8 ? "#9fe8ff" : hue ? "#ff6fd0" : "#fff4d8";
      g.fillStyle = lit ? col : night ? "#0d1020" : "#2a3350";
      g.fillRect(i * (w / n) + 4, j * (h / (n * 2)) + 3, w / n - 8, h / (n * 2) - 6);
    }
    g.fillStyle = "#06070c";
    g.fillRect(0, 0, 2, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function buildingGeo(w: number, h: number, d: number, R: () => number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const ox = R(), oy = R();
  const faces = [[0, d, h], [1, d, h], [2, 0, 0], [3, 0, 0], [4, w, h], [5, w, h]];
  for (const [f, fw, fh] of faces) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(i, 0.01, 0.01); continue; }
      uv.setXY(i, uv.getX(i) * (fw / 36) + ox, uv.getY(i) * (fh / 36) + oy);
    }
  }
  g.translate(0, h / 2, 0);
  return g;
}
export function signTexture(text: string, col: string, bg = "#07050c", vertical = false) {
  return makeCanvas(vertical ? 128 : 256, vertical ? 256 : 128, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = col;
    g.lineWidth = 6;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = col;
    g.shadowColor = col;
    g.shadowBlur = 14;
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (vertical) {
      g.font = "bold 54px sans-serif";
      const chars = [...text];
      chars.forEach((c, i) => g.fillText(c, w / 2, h / (chars.length + 1) * (i + 1)));
    } else {
      g.font = `bold ${Math.min(80, (w - 30) / Math.max(2, text.length) * 1.2)}px sans-serif`;
      g.fillText(text, w / 2, h / 2 + 4);
    }
  });
}
export function crowdTexture() {
  const t = makeCanvas(256, 64, (g, w, h) => {
    g.fillStyle = "#0b0d18";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = `hsl(${Math.floor(Math.random() * 360)},80%,${45 + Math.random() * 30}%)`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------------ terrain
export interface TerrainOpts {
  pad: number;
  res: number;
  natural: (x: number, z: number) => number;
  color: (h: number, slope: number, x: number, z: number) => [number, number, number];
  falloff: number;
  bridgeDepth?: number;
  tunnelH?: number;
}
export function buildTerrain(ctx: Ctx, o: TerrainOpts) {
  const { track } = ctx;
  const x0 = track.minX - o.pad, x1 = track.maxX + o.pad, z0 = track.minZ - o.pad, z1 = track.maxZ + o.pad;
  const carve = track.wallHalf + 5;
  const hAt = (x: number, z: number) => {
    const nat = o.natural(x, z);
    const near = track.nearest(x, z);
    if (near.idx < 0) return nat;
    const roadY = track.py[near.idx];
    const zone = track.zoneAt(near.idx);
    const t = smoothstep(carve, carve + o.falloff, near.dist);
    let h = lerp(roadY - 0.45, nat, t);
    if (zone && (zone.kind === "bridge" || zone.kind === "tunnel")) {
      const N = track.N;
      const a = (near.idx - zone.i0 + N) % N, b = (zone.i1 - near.idx + N) % N;
      const f = smoothstep(0, 9, Math.min(a, b));
      let zh: number;
      if (zone.kind === "bridge") zh = Math.min(nat, roadY - (o.bridgeDepth ?? 20));
      else zh = lerp(roadY + (o.tunnelH ?? 13), Math.max(nat, roadY + 2), smoothstep(14, 14 + o.falloff, near.dist));
      h = lerp(h, zh, f);
    }
    return h;
  };
  const nx = o.res, nz = Math.round((o.res * (z1 - z0)) / (x1 - x0));
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const hs = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const h = hAt(p.getX(i), p.getZ(i));
    p.setY(i, h);
    hs[i] = h;
  }
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const sl = Math.abs(hs[Math.min(p.count - 1, i + 1)] - hs[i]) + Math.abs(hs[Math.min(p.count - 1, i + nx + 1)] - hs[i]);
    const c = o.color(hs[i], sl / ((x1 - x0) / nx), x, z);
    cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2];
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  ctx.group.add(mesh);
  ctx.terrain = mesh;
  ctx.hAt = hAt;
  return mesh;
}

export function addPillars(ctx: Ctx, i0: number, i1: number, every: number, groundFn: (x: number, z: number) => number, color = 0x555a66, w = 2.2) {
  const { track } = ctx;
  const N = track.N;
  const items: Item[] = [];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const len = (i1 - i0 + N) % N || N;
  for (let s = 0; s <= len; s += every) {
    const k = (i0 + s) % N;
    const x = track.px[k], z = track.pz[k], y = track.py[k] - 1.8;
    const gy = groundFn(x, z);
    const h = y - gy;
    if (h < 2) continue;
    items.push({ x, y: gy + h / 2, z, ry: Math.atan2(track.tx[k], track.tz[k]), sx: w, sy: h, sz: w * 1.6 });
    items.push({ x: x + track.nx[k] * 0, y: y + 0.5, z, ry: Math.atan2(track.tx[k], track.tz[k]), sx: track.halfW * 1.8, sy: 1.4, sz: w * 1.2 });
    if (items.length > 4000) break;
  }
  if (!items.length) return;
  const m = makeInst(geo, std(color, 0.9, 0.1), items);
  m.castShadow = false;
  ctx.group.add(m);
}

export function rangeIter(track: Track, i0: number, i1: number) {
  const N = track.N;
  const len = (i1 - i0 + N) % N;
  return { len, at: (k: number) => (i0 + k) % N };
}
