import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Theme, TrackDef } from "./data";
import { CURB, nearestInfo, sampleAt, type TrackData } from "./trackMath";
import * as TX from "./textures";

export interface World {
  update: (dt: number, time: number, cam: THREE.Camera) => void;
  dispose: () => void;
}

/* ------------------------------------------------------------------ helpers */

type F = number | ((i: number) => number);
const val = (f: F, i: number) => (typeof f === "number" ? f : f(i));

function strip(t: TrackData, aOff: F, aY: F, bOff: F, bY: F, vLen: number) {
  const n = t.n;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  const idx = new Uint32Array(n * 6);
  const reps = Math.max(1, Math.round(t.length / vLen));
  for (let i = 0; i <= n; i++) {
    const k = i % n;
    const p = t.pts[k];
    const ao = val(aOff, k);
    const bo = val(bOff, k);
    const v = (i / n) * reps;
    pos.set([p.x + p.nx * ao, val(aY, k), p.z + p.nz * ao], i * 6);
    pos.set([p.x + p.nx * bo, val(bY, k), p.z + p.nz * bo], i * 6 + 3);
    uv.set([0, v, 1, v], i * 4);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    idx.set([a, c, b, b, c, d], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

interface Tr {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}
type Part = [THREE.BufferGeometry, number, Tr?];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function buildGeo(parts: Part[]) {
  const list = parts.map(([g, color, tr = {}]) => {
    const geo = g.index ? g.toNonIndexed() : g.clone();
    _e.set(tr.rx ?? 0, tr.ry ?? 0, tr.rz ?? 0, "YXZ");
    _q.setFromEuler(_e);
    _m.compose(_p.set(tr.x ?? 0, tr.y ?? 0, tr.z ?? 0), _q, _s.set(tr.sx ?? 1, tr.sy ?? 1, tr.sz ?? 1));
    geo.applyMatrix4(_m);
    const c = new THREE.Color(color);
    const n = geo.getAttribute("position").count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return geo;
  });
  const merged = mergeGeometries(list)!;
  list.forEach((g) => g.dispose());
  return merged;
}

const cone = (r: number, h: number, seg = 8) => {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(0, h / 2, 0);
  return g;
};
const cyl = (rt: number, rb: number, h: number, seg = 8) => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(0, h / 2, 0);
  return g;
};
const bx = (w: number, h: number, d: number) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
};
const ico = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);

const hash3 = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

function jitter(g: THREE.BufferGeometry, amt: number) {
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (hash3(x, y, z) - 0.5) * amt;
    p.setXYZ(i, x * k, y * (0.9 + (k - 1) * 0.5), z * k);
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ prop models */

const propMat = () =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true, side: THREE.DoubleSide });

function pineGeo(snow: boolean) {
  const parts: Part[] = [[cyl(0.24, 0.36, 2.4, 6), 0x5a3d26]];
  const layers: [number, number, number, number][] = [
    [3.2, 4.4, 1.5, 0x1d5a35],
    [2.6, 3.8, 3.5, 0x236a3c],
    [1.9, 3.2, 5.4, 0x2b7a45],
    [1.2, 2.4, 7.1, 0x328a4e],
  ];
  for (const [r, h, y, c] of layers) {
    parts.push([cone(r, h, 8), c, { y }]);
    if (snow) {
      const hc = h * 0.58;
      parts.push([cone(r * (hc / h) * 1.08, hc, 8), 0xf4f8fc, { y: y + h - hc }]);
    }
  }
  return buildGeo(parts);
}

function broadleafGeo() {
  return buildGeo([
    [cyl(0.28, 0.46, 3.4, 7), 0x5a3d26],
    [ico(2.3, 1), 0x2f6f2b, { y: 4.6, sy: 0.9 }],
    [ico(1.7, 1), 0x3a8031, { x: 1.4, y: 3.9, z: 0.4 }],
    [ico(1.7, 1), 0x2a6428, { x: -1.2, y: 4.1, z: -0.7 }],
    [ico(1.5, 1), 0x4a9137, { x: 0.1, y: 6.0, z: 0.1 }],
  ]);
}

function palmGeo() {
  const parts: Part[] = [];
  let x = 0;
  let y = 0;
  const segs = 6;
  for (let k = 0; k < segs; k++) {
    const lean = 0.07 + k * 0.025;
    const h = 1.5;
    const g = cyl(0.26 - k * 0.025, 0.3 - k * 0.025, h, 7);
    parts.push([g, k % 2 ? 0x9a7650 : 0x866440, { x, y, rz: -lean }]);
    x += Math.sin(lean) * h;
    y += Math.cos(lean) * h;
  }
  for (let i = 0; i < 9; i++) {
    const fr = new THREE.PlaneGeometry(1.5, 4.6, 1, 7);
    fr.translate(0, 2.3, 0);
    const p = fr.getAttribute("position");
    for (let v = 0; v < p.count; v++) {
      const t = p.getY(v) / 4.6;
      p.setX(v, p.getX(v) * (1 - 0.8 * t) * (1 + 0.5 * Math.sin(t * Math.PI)));
      p.setZ(v, t * t * 2.0);
    }
    fr.computeVertexNormals();
    parts.push([fr, i % 2 ? 0x3f9a3f : 0x2f8a35, { x, y, ry: (i / 9) * Math.PI * 2, rx: Math.PI / 2 - 0.5 + (i % 3) * 0.15 }]);
  }
  parts.push([ico(0.22, 0), 0x4a3320, { x: x + 0.2, y: y - 0.2 }]);
  parts.push([ico(0.22, 0), 0x4a3320, { x: x - 0.15, y: y - 0.25, z: 0.2 }]);
  return buildGeo(parts);
}

function cactusGeo() {
  const g = 0x3f8a46;
  return buildGeo([
    [cyl(0.36, 0.42, 4.2, 9), g],
    [ico(0.37, 1), g, { y: 4.2 }],
    [cyl(0.22, 0.22, 1.1, 8), g, { x: 0.25, y: 1.8, rz: -Math.PI / 2 }],
    [cyl(0.2, 0.2, 1.5, 8), g, { x: 1.3, y: 1.8 }],
    [ico(0.21, 1), g, { x: 1.3, y: 3.3 }],
    [cyl(0.22, 0.22, 0.9, 8), g, { x: -0.2, y: 2.6, rz: Math.PI / 2 }],
    [cyl(0.2, 0.2, 1.2, 8), g, { x: -1.1, y: 2.6 }],
    [ico(0.21, 1), g, { x: -1.1, y: 3.8 }],
  ]);
}

const rockGeo = (c: number) => buildGeo([[jitter(ico(1.5, 1), 0.6), c, { sy: 0.75 }]]);
const bushGeo = (c1: number, c2: number) =>
  buildGeo([
    [jitter(ico(0.9, 1), 0.4), c1, { y: 0.45, sy: 0.7 }],
    [jitter(ico(0.7, 1), 0.4), c2, { x: 0.7, y: 0.35, z: 0.2, sy: 0.7 }],
    [jitter(ico(0.6, 1), 0.4), c1, { x: -0.6, y: 0.3, z: -0.3, sy: 0.7 }],
  ]);

function mesaGeo() {
  return buildGeo([
    [cyl(0.9, 1.0, 0.5, 10), 0x9b4a2a],
    [cyl(0.82, 0.9, 0.28, 10), 0xb85d34, { y: 0.5 }],
    [cyl(0.78, 0.82, 0.12, 10), 0xd98a56, { y: 0.78 }],
    [cyl(0.74, 0.78, 0.2, 10), 0xc4683a, { y: 0.9 }],
    [cyl(0.7, 0.74, 0.06, 10), 0xe0a06a, { y: 1.1 }],
  ]);
}

function mountainGeo() {
  const g = new THREE.ConeGeometry(1, 1, 11, 6, true);
  g.translate(0, 0.5, 0);
  const p = g.getAttribute("position");
  const col = new Float32Array(p.count * 3);
  const rock = new THREE.Color(0x6e7480);
  const dark = new THREE.Color(0x565c68);
  const snow = new THREE.Color(0xf6f9fc);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const h = hash3(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100));
    if (y < 0.99) {
      x *= 0.8 + h * 0.5;
      z *= 0.8 + h * 0.5;
      y += (h - 0.5) * 0.1;
      p.setXYZ(i, x, y, z);
    }
    const th = 0.58 + (h - 0.5) * 0.18;
    const c = y > th ? snow : h > 0.5 ? rock : dark;
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g.toNonIndexed();
}

function hillGeo(c: number) {
  return buildGeo([[jitter(ico(1, 2), 0.18), c, { sy: 0.45 }]]);
}

function sailboatGeo() {
  return buildGeo([
    [bx(1.4, 0.6, 4.4), 0xf5f5f5, { y: 0.0 }],
    [bx(1.2, 0.2, 3.8), 0x9a6b3b, { y: 0.6 }],
    [cyl(0.06, 0.06, 6.4, 5), 0xdddddd, { y: 0.6 }],
    [cone(1.6, 5.6, 3), 0xffffff, { y: 1.0, z: -0.3, sz: 0.06, ry: 0 }],
  ]);
}

function lighthouseGeo() {
  return buildGeo([
    [cyl(3.0, 3.6, 8, 12), 0xf5f5f5],
    [cyl(2.6, 3.0, 6, 12), 0xd9322f, { y: 8 }],
    [cyl(2.3, 2.6, 6, 12), 0xf5f5f5, { y: 14 }],
    [cyl(2.0, 2.3, 4, 12), 0xd9322f, { y: 20 }],
    [cyl(2.6, 2.6, 0.5, 12), 0x333333, { y: 24 }],
    [cyl(1.5, 1.5, 2.6, 12), 0xffe9a0, { y: 24.5 }],
    [cone(2.1, 2.2, 12), 0xd9322f, { y: 27.1 }],
  ]);
}

function umbrellaGeo() {
  return buildGeo([
    [cyl(0.05, 0.05, 2.4, 5), 0xdddddd],
    [cone(1.5, 0.55, 8), 0xffffff, { y: 2.2 }],
  ]);
}

function cabinGeo() {
  return buildGeo([
    [bx(6, 3, 4.6), 0x7b5230],
    [cone(4.6, 2.4, 4), 0xf4f7fa, { y: 3, ry: Math.PI / 4, sx: 1.05, sz: 0.8 }],
    [bx(0.7, 1.6, 0.7), 0x8a8a8a, { x: 1.8, y: 3.4, z: 0.6 }],
    [bx(1.2, 1.9, 0.1), 0x3a2a1a, { z: 2.31 }],
  ]);
}

function lampGeo() {
  return buildGeo([
    [cyl(0.1, 0.16, 9.5, 6), 0x2a2d35],
    [bx(2.6, 0.14, 0.14), 0x2a2d35, { x: 1.2, y: 9.5 }],
  ]);
}

/* ------------------------------------------------------------------ sky */

export function buildSky(scene: THREE.Scene, theme: Theme) {
  const group = new THREE.Group();
  const sunDir = new THREE.Vector3(...theme.sunPos).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      mid: { value: new THREE.Color(theme.skyMid) },
      horizon: { value: new THREE.Color(theme.skyHorizon) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(theme.sunColor) },
      night: { value: theme.night ? 1 : 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float night;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.85, h));
        col = mix(col, horizon * 0.85, smoothstep(0.0, -0.2, d.y));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        float disc = smoothstep(0.9994, 0.9998, sd);
        col += sunColor * (disc * (night > 0.5 ? 1.2 : 6.0) + pow(sd, 8.0) * 0.28 + pow(sd, 90.0) * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 20), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  let stars: THREE.Points | null = null;
  if (theme.night) {
    const r = TX.mulberry32(77);
    const arr = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const u = r() * Math.PI * 2;
      const v = Math.acos(1 - r() * 0.95);
      const R = 2200;
      arr.set([R * Math.sin(v) * Math.cos(u), R * Math.cos(v), R * Math.sin(v) * Math.sin(u)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }),
    );
    stars.frustumCulled = false;
    group.add(stars);
  }
  scene.add(group);
  return {
    sunDir,
    update(cam: THREE.Camera) {
      group.position.copy(cam.position);
    },
    dispose() {
      dome.geometry.dispose();
      mat.dispose();
      stars?.geometry.dispose();
    },
    group,
  };
}

/* ------------------------------------------------------------------ weather */

export function buildWeather(scene: THREE.Scene, kind: "rain" | "snow") {
  const box = kind === "rain" ? 46 : 60;
  const count = kind === "rain" ? 2600 : 3200;
  const r = TX.mulberry32(5);
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) base.set([r() * box, r() * 36, r() * box], i * 3);
  let obj: THREE.Object3D;
  let attr: THREE.BufferAttribute;
  let dotTex: THREE.Texture | null = null;
  if (kind === "rain") {
    const pos = new Float32Array(count * 6);
    attr = new THREE.BufferAttribute(pos, 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", attr);
    obj = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ color: 0xcfd9e6, transparent: true, opacity: 0.38, fog: true }),
    );
  } else {
    const pos = new Float32Array(count * 3);
    attr = new THREE.BufferAttribute(pos, 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", attr);
    dotTex = TX.dotTexture();
    obj = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, map: dotTex, transparent: true, depthWrite: false, opacity: 0.9 }),
    );
  }
  obj.frustumCulled = false;
  scene.add(obj);
  const wrap = (v: number, c: number) => ((((v - c) % box) + box) % box) - box / 2 + c;
  return {
    update(cam: THREE.Camera, time: number, camVel: THREE.Vector3) {
      const cx = cam.position.x;
      const cy = cam.position.y;
      const cz = cam.position.z;
      const arr = attr.array as Float32Array;
      if (kind === "rain") {
        const fall = 38;
        for (let i = 0; i < count; i++) {
          const bx0 = base[i * 3];
          const by = base[i * 3 + 1];
          const bz = base[i * 3 + 2];
          const y = cy - 6 + ((((by - time * fall) % 36) + 36) % 36);
          const x = wrap(bx0, cx);
          const z = wrap(bz, cz);
          arr[i * 6] = x;
          arr[i * 6 + 1] = y;
          arr[i * 6 + 2] = z;
          arr[i * 6 + 3] = x + camVel.x * 0.012;
          arr[i * 6 + 4] = y + 0.9;
          arr[i * 6 + 5] = z + camVel.z * 0.012;
        }
      } else {
        for (let i = 0; i < count; i++) {
          const bx0 = base[i * 3];
          const by = base[i * 3 + 1];
          const bz = base[i * 3 + 2];
          arr[i * 3] = wrap(bx0 + Math.sin(time * 0.7 + i) * 0.8, cx);
          arr[i * 3 + 1] = cy - 6 + ((((by - time * 2.6) % 36) + 36) % 36);
          arr[i * 3 + 2] = wrap(bz + Math.cos(time * 0.6 + i * 1.3) * 0.8, cz);
        }
      }
      attr.needsUpdate = true;
    },
    dispose() {
      scene.remove(obj);
      (obj as THREE.Points).geometry.dispose();
      dotTex?.dispose();
    },
  };
}

/* ------------------------------------------------------------------ world */

export function buildWorld(scene: THREE.Scene, t: TrackData, def: TrackDef, theme: Theme): World {
  const root = new THREE.Group();
  scene.add(root);
  const rand = TX.mulberry32(def.seed * 977 + 13);
  const pts = t.pts;
  const hw = t.halfWidth;
  const B = t.barrier;
  const dispose: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(o: T) => {
    dispose.push(o);
    return o;
  };
  const rel = (dy: number) => (i: number) => pts[i].y + dy;
  const night = theme.night;

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, shadowRecv = false, castShadow = false) => {
    keep(geo);
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = shadowRecv;
    m.castShadow = castShadow;
    root.add(m);
    return m;
  };

  const inst = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    mats: THREE.Matrix4[],
    opts: { shadow?: boolean; tint?: number; hue?: boolean } = {},
  ) => {
    if (!mats.length) return null;
    keep(geo);
    const m = new THREE.InstancedMesh(geo, mat, mats.length);
    const c = new THREE.Color();
    mats.forEach((mm, i) => {
      m.setMatrixAt(i, mm);
      if (opts.tint !== undefined) {
        if (opts.hue) c.setHSL(rand(), 0.75, 0.55);
        else c.setHSL(0.0, 0.0, 1 - rand() * opts.tint);
        m.setColorAt(i, c);
      }
    });
    m.castShadow = !!opts.shadow;
    m.frustumCulled = false;
    root.add(m);
    return m;
  };

  const MX = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx) => {
    const m = new THREE.Matrix4();
    _e.set(0, ry, 0);
    _q.setFromEuler(_e);
    m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
    return m;
  };

  /* ---------- ground */
  const noise = keep(TX.noiseTexture(def.seed, theme.id === "alpine" ? 0.08 : 0.22));
  noise.repeat.set(160, 160);
  const groundMat = keep(new THREE.MeshStandardMaterial({ color: theme.ground, map: noise, roughness: 0.95 }));
  const farR = t.maxExtent + 260;
  if (theme.id === "coast") {
    const island = new THREE.CylinderGeometry(farR, farR + 110, 12, 72, 1);
    island.translate(0, -6.05, 0);
    noise.repeat.set(1, 1);
    const sandMat = keep(new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 0.95 }));
    add(island, sandMat, true);
    const sea = TX.waveTexture(8);
    sea.repeat.set(160, 160);
    keep(sea);
    const water = new THREE.PlaneGeometry(14000, 14000);
    water.rotateX(-Math.PI / 2);
    const wm = keep(
      new THREE.MeshStandardMaterial({ color: 0x1b78b4, roughness: 0.16, metalness: 0.15, bumpMap: sea, bumpScale: 1.1 }),
    );
    const wMesh = add(water, wm);
    wMesh.position.y = -3.4;
    root.userData.water = wMesh;
  } else {
    const g = new THREE.CircleGeometry(4200, 48);
    g.rotateX(-Math.PI / 2);
    const gm = add(g, groundMat, true);
    gm.position.y = -0.05;
  }

  /* ---------- road surface */
  const asphalt = keep(TX.asphaltTexture(theme.asphalt, def.seed));
  const roadMat = keep(
    new THREE.MeshStandardMaterial({
      map: asphalt,
      color: theme.id === "forest" ? 0xb0b6bc : 0xffffff,
      roughness: theme.roadRough,
      metalness: theme.id === "forest" || night ? 0.25 : 0,
      side: THREE.DoubleSide,
    }),
  );
  add(strip(t, -hw, rel(0), hw, rel(0), 25), roadMat, true);

  const curbTex = keep(TX.curbTexture());
  const curbMat = keep(new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.7, side: THREE.DoubleSide }));
  add(strip(t, hw, rel(0.035), hw + CURB, rel(0.035), 2), curbMat, true);
  add(strip(t, -hw - CURB, rel(0.035), -hw, rel(0.035), 2), curbMat, true);

  const runNoise = keep(TX.noiseTexture(def.seed + 4, 0.2));
  const runMat = keep(
    new THREE.MeshStandardMaterial({ color: theme.runoff, map: runNoise, roughness: 0.95, side: THREE.DoubleSide }),
  );
  add(strip(t, hw + CURB, rel(-0.02), B, rel(-0.02), 6), runMat, true);
  add(strip(t, -B, rel(-0.02), -hw - CURB, rel(-0.02), 6), runMat, true);

  // barriers
  const accents: Record<string, string> = {
    coast: "#e8505b",
    alpine: "#2f6fe0",
    city: "#d628a8",
    desert: "#f08a1c",
    forest: "#1f9d55",
  };
  const barTex = keep(TX.barrierTexture(accents[theme.id]));
  const barMat = keep(new THREE.MeshStandardMaterial({ map: barTex, roughness: 0.6, side: THREE.DoubleSide }));
  const topMat = keep(new THREE.MeshStandardMaterial({ color: 0xbfc3c9, roughness: 0.6, side: THREE.DoubleSide }));
  for (const sg of [1, -1]) {
    add(strip(t, sg * B, rel(-0.02), sg * B, rel(1.0), 8), barMat, true, true);
    add(strip(t, sg * B, rel(1.0), sg * (B + 0.5), rel(1.0), 8), topMat, true);
    add(strip(t, sg * (B + 0.5), rel(1.0), sg * (B + 0.5), rel(-0.02), 8), topMat, true);
  }

  // shoulder + embankment
  const SH = 4.6;
  const slopeOut = (sg: number) => (i: number) => {
    const inner = B + 0.5 + SH;
    const want = Math.max(3, pts[i].y * 1.7 + 1.5);
    const c = pts[i].curv * sg;
    let lim = Infinity;
    if (c > 1e-4) lim = 0.8 / c;
    return Math.max(inner + 1.2, Math.min(inner + want, lim));
  };
  const shMat = keep(new THREE.MeshStandardMaterial({ color: theme.ground, map: runNoise, roughness: 0.95, side: THREE.DoubleSide }));
  for (const sg of [1, -1]) {
    const o1 = sg * (B + 0.5);
    const o2 = sg * (B + 0.5 + SH);
    const o3 = (i: number) => sg * slopeOut(sg)(i);
    if (sg > 0) {
      add(strip(t, o1, rel(-0.02), o2, rel(-0.02), 6), shMat, true);
      add(strip(t, o2, rel(-0.02), o3, -0.02, 6), shMat, true);
    } else {
      add(strip(t, o2, rel(-0.02), o1, rel(-0.02), 6), shMat, true);
      add(strip(t, o3, -0.02, o2, rel(-0.02), 6), shMat, true);
    }
  }

  /* ---------- placement helpers */
  const slopeW = (i: number) => Math.max(3, pts[i].y * 1.7 + 1.5);
  const clearAt = (x: number, z: number, extra: number) => {
    const ni = nearestInfo(t, x, z, 3);
    if (ni.i < 0) return true;
    return ni.d > B + 0.5 + SH + slopeW(ni.i) + extra + 0.5;
  };
  const nearSpot = (minOff: number, maxOff: number, extra = 0) => {
    for (let tries = 0; tries < 12; tries++) {
      const i = Math.floor(rand() * t.n);
      const sg = rand() > 0.5 ? 1 : -1;
      const off = B + 0.5 + SH + slopeW(i) + minOff + rand() * (maxOff - minOff);
      const x = pts[i].x + pts[i].nx * sg * off;
      const z = pts[i].z + pts[i].nz * sg * off;
      if (clearAt(x, z, extra)) return { x, z, i, sg };
    }
    return null;
  };
  const farSpot = (rmin: number, rmax: number, extra = 0) => {
    for (let tries = 0; tries < 12; tries++) {
      const a = rand() * Math.PI * 2;
      const r = rmin + Math.sqrt(rand()) * (rmax - rmin);
      const x = Math.cos(a) * r * 1.0;
      const z = Math.sin(a) * r * 1.0;
      if (clearAt(x, z, extra)) return { x, z };
    }
    return null;
  };

  const scatter = (
    geo: THREE.BufferGeometry,
    count: number,
    opts: { minOff?: number; maxOff?: number; far?: [number, number]; scale?: [number, number]; shadow?: boolean; tint?: number; hue?: boolean; extra?: number; yOff?: number; yStretch?: [number, number] },
  ) => {
    const mats: THREE.Matrix4[] = [];
    for (let k = 0; k < count; k++) {
      const sp = opts.far ? farSpot(opts.far[0], opts.far[1], opts.extra ?? 0) : nearSpot(opts.minOff ?? 4, opts.maxOff ?? 60, opts.extra ?? 0);
      if (!sp) continue;
      const sc = opts.scale ? opts.scale[0] + rand() * (opts.scale[1] - opts.scale[0]) : 1;
      const ys = opts.yStretch ? opts.yStretch[0] + rand() * (opts.yStretch[1] - opts.yStretch[0]) : 1;
      mats.push(MX(sp.x, opts.yOff ?? 0, sp.z, rand() * Math.PI * 2, sc, sc * ys, sc));
    }
    return inst(geo, propMat_, mats, { shadow: opts.shadow, tint: opts.tint, hue: opts.hue });
  };
  const propMat_ = keep(propMat());

  const ringPos = (rmin: number, rmax: number) => {
    const a = rand() * Math.PI * 2;
    const r = t.maxExtent + rmin + rand() * (rmax - rmin);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  };

  /* ---------- start/finish furniture */
  {
    const s0 = sampleAt(t, 0);
    const startGeo = new THREE.BufferGeometry();
    const a = sampleAt(t, -1.2, -hw);
    const b = sampleAt(t, -1.2, hw);
    const c = sampleAt(t, 1.2, -hw);
    const d = sampleAt(t, 1.2, hw);
    const up = 0.045;
    startGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([a.x, a.y + up, a.z, b.x, b.y + up, b.z, c.x, c.y + up, c.z, d.x, d.y + up, d.z], 3),
    );
    startGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    startGeo.setIndex([0, 2, 1, 1, 2, 3]);
    startGeo.computeVertexNormals();
    const ck = keep(TX.checkerTexture(16, 2));
    add(startGeo, keep(new THREE.MeshStandardMaterial({ map: ck, roughness: 0.7, side: THREE.DoubleSide })), true);

    // gantry
    const gantry = new THREE.Group();
    gantry.position.set(s0.x, s0.y, s0.z);
    gantry.rotation.y = s0.psi;
    const gw = B + 2.2;
    const steel = keep(new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.5, metalness: 0.6 }));
    for (const sg of [-1, 1]) {
      const p = new THREE.Mesh(keep(new THREE.BoxGeometry(1.1, 11, 1.1)), steel);
      p.position.set(sg * gw, 5.4, 0);
      p.castShadow = true;
      gantry.add(p);
    }
    const bannerT = keep(TX.bannerTexture());
    const bannerMat = keep(new THREE.MeshBasicMaterial({ map: bannerT }));
    const beamMats = [steel, steel, steel, steel, bannerMat, bannerMat];
    const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(gw * 2 + 1.1, 3.0, 1.0)), beamMats);
    beam.position.set(0, 10.2, 0);
    beam.castShadow = true;
    gantry.add(beam);
    // start lights
    const lampMat = keep(new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    for (let i = -2; i <= 2; i++) {
      const l = new THREE.Mesh(keep(new THREE.SphereGeometry(0.28, 10, 8)), lampMat);
      l.position.set(i * 1.2, 8.3, 0.1);
      gantry.add(l);
    }
    root.add(gantry);

    // grandstands
    const crowd = keep(TX.crowdTexture(def.seed));
    crowd.repeat.set(2, 9);
    const crowdMat = keep(new THREE.MeshStandardMaterial({ map: crowd, roughness: 0.9 }));
    const concrete = keep(new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.8 }));
    const roofMat = keep(new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5, metalness: 0.3 }));
    for (const [sg, sOff, len] of [
      [1, 40, 70],
      [-1, 90, 60],
      [1, -150, 55],
    ] as [number, number, number][]) {
      const p = sampleAt(t, sOff, 0);
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.psi;
      const base = B + 0.5 + 2.5;
      for (let k = 0; k < 6; k++) {
        const H = p.y + 1 + k;
        const bm = new THREE.Mesh(keep(new THREE.BoxGeometry(2.4, H, len)), concrete);
        bm.position.set(sg * (base + k * 2.4), H / 2, 0);
        bm.castShadow = true;
        bm.receiveShadow = true;
        g.add(bm);
        const cm = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.4, len)), crowdMat);
        cm.rotation.x = -Math.PI / 2;
        cm.position.set(sg * (base + k * 2.4), H + 0.02, 0);
        g.add(cm);
      }
      const roof = new THREE.Mesh(keep(new THREE.BoxGeometry(15, 0.35, len + 2)), roofMat);
      roof.position.set(sg * (base + 6.5), p.y + 11, 0);
      roof.castShadow = true;
      g.add(roof);
      for (const z of [-len / 2, 0, len / 2]) {
        const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.2, 0.2, p.y + 11, 6)), steel);
        post.position.set(sg * (base + 13), (p.y + 11) / 2, z);
        g.add(post);
      }
      root.add(g);
    }
  }

  /* ---------- billboards */
  {
    const sponsors: [string, string, string, string][] = [
      ["VELOX", "#c1121f", "#ffffff", "ENERGY DRINK"],
      ["NITRO-X", "#0b3d91", "#ffd60a", "RACING FUEL"],
      ["APEX OIL", "#111111", "#ff9f1c", "SYNTHETIC"],
      ["RIDGE", "#0b6e4f", "#ffffff", "PERFORMANCE TIRES"],
      ["HYPERNET", "#5a189a", "#e0aaff", "5G EVERYWHERE"],
      ["TURBO", "#ff6d00", "#111111", "COLA"],
    ];
    const sgnMats = sponsors.map(([txt, bg, fg, sub]) => {
      const tx = keep(TX.signTexture(txt, bg, fg, sub));
      return keep(new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide }));
    });
    const poleMat = keep(new THREE.MeshStandardMaterial({ color: 0x333840, roughness: 0.6, metalness: 0.5 }));
    const spacing = Math.round(380 / t.spacing);
    let k = 0;
    for (let i = Math.round(60 / t.spacing); i < t.n; i += spacing) {
      const sg = k % 2 ? 1 : -1;
      const p = pts[i];
      if (Math.abs(p.curv) > 0.006) continue;
      const lat = sg * (B + 0.5 + SH * 0.55);
      const x = p.x + p.nx * lat;
      const z = p.z + p.nz * lat;
      const fx = -p.tx * 0.55 - sg * p.nx * 0.83;
      const fz = -p.tz * 0.55 - sg * p.nz * 0.83;
      const g = new THREE.Group();
      g.position.set(x, p.y, z);
      g.rotation.y = Math.atan2(fx, fz);
      const sign = new THREE.Mesh(keep(new THREE.PlaneGeometry(14, 4.4)), sgnMats[k % sgnMats.length]);
      sign.position.y = 8.6;
      g.add(sign);
      for (const px of [-4.5, 4.5]) {
        const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.18, 0.22, 7, 6)), poleMat);
        pole.position.set(px, 3.5, -0.2);
        pole.castShadow = true;
        g.add(pole);
      }
      root.add(g);
      k++;
    }
  }

  /* ---------- chevrons on tight corners */
  {
    const mkChevron = (dir: number) => {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const g = c.getContext("2d")!;
      g.fillStyle = "#ffd60a";
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = "#111";
      g.lineWidth = 10;
      g.strokeRect(5, 5, 118, 118);
      g.lineWidth = 16;
      g.lineJoin = "miter";
      for (const ox of [-14, 22]) {
        g.beginPath();
        g.moveTo(64 + ox - dir * 22, 30);
        g.lineTo(64 + ox + dir * 22, 64);
        g.lineTo(64 + ox - dir * 22, 98);
        g.stroke();
      }
      const tx = new THREE.CanvasTexture(c);
      tx.colorSpace = THREE.SRGBColorSpace;
      return keep(tx);
    };
    const matL = keep(new THREE.MeshBasicMaterial({ map: mkChevron(-1), side: THREE.DoubleSide }));
    const matR = keep(new THREE.MeshBasicMaterial({ map: mkChevron(1), side: THREE.DoubleSide }));
    const planeGeo = keep(new THREE.PlaneGeometry(2.2, 2.2));
    const poleGeo = keep(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5));
    const poleMat = keep(new THREE.MeshStandardMaterial({ color: 0x777777 }));
    const mL: THREE.Matrix4[] = [];
    const mR: THREE.Matrix4[] = [];
    const mP: THREE.Matrix4[] = [];
    for (let i = 0; i < t.n; i += 4) {
      const p = pts[i];
      if (Math.abs(p.curv) < 0.0105) continue;
      // outer side: opposite to the centre of curvature
      const sg = p.curv > 0 ? -1 : 1;
      const lat = sg * (B + 0.5 + 1.6);
      const x = p.x + p.nx * lat;
      const z = p.z + p.nz * lat;
      const fx = -p.tx * 0.6 - sg * p.nx * 0.8;
      const fz = -p.tz * 0.6 - sg * p.nz * 0.8;
      const ry = Math.atan2(fx, fz);
      (p.curv > 0 ? mL : mR).push(MX(x, p.y + 2.0, z, ry));
      mP.push(MX(x, p.y + 0.9, z, 0));
    }
    inst(planeGeo, matL, mL);
    inst(planeGeo, matR, mR);
    inst(poleGeo, poleMat, mP);
  }

  /* ---------- clouds */
  const cloudTex = keep(TX.cloudTexture(def.seed));
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < theme.cloudCount; i++) {
    const m = new THREE.SpriteMaterial({
      map: cloudTex,
      color: theme.cloudColor,
      transparent: true,
      opacity: night ? 0.35 : theme.id === "forest" ? 0.9 : 0.75,
      depthWrite: false,
      fog: false,
    });
    keep(m);
    const s = new THREE.Sprite(m);
    const a = rand() * Math.PI * 2;
    const r = 300 + rand() * 1500;
    s.position.set(Math.cos(a) * r, 220 + rand() * 260, Math.sin(a) * r);
    const w = 450 + rand() * 700;
    s.scale.set(w, w * 0.34, 1);
    root.add(s);
    clouds.push(s);
  }

  /* ---------- theme-specific scenery */
  let animate: ((dt: number, time: number) => void) | null = null;

  const lampPoolTex = keep(TX.glowTexture());

  if (theme.id === "coast") {
    scatter(palmGeo(), 330, { minOff: 2, maxOff: 55, scale: [0.9, 1.5], shadow: true, tint: 0.2 });
    scatter(palmGeo(), 140, { far: [0, farR - 20], scale: [1, 1.6], tint: 0.2, extra: 20 });
    scatter(rockGeo(0x8d8579), 80, { minOff: 3, maxOff: 80, scale: [0.8, 3], tint: 0.3 });
    scatter(bushGeo(0x5f8a3a, 0x77a04a), 160, { minOff: 2, maxOff: 40, scale: [0.9, 1.6], tint: 0.3 });
    scatter(umbrellaGeo(), 60, { minOff: 2, maxOff: 35, scale: [1, 1.4], tint: 0.5, hue: true });
    // lighthouses on the island rim
    const lh: THREE.Matrix4[] = [];
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2;
      lh.push(MX(Math.cos(a) * (farR - 30), 0, Math.sin(a) * (farR - 30), 0, 1.4));
    }
    inst(lighthouseGeo(), propMat_, lh, { shadow: true });
    // sailboats on the sea
    const boats: THREE.Matrix4[] = [];
    for (let k = 0; k < 28; k++) {
      const a = rand() * Math.PI * 2;
      const r = farR + 160 + rand() * 900;
      boats.push(MX(Math.cos(a) * r, -3.3, Math.sin(a) * r, rand() * Math.PI * 2, 1.6 + rand()));
    }
    inst(sailboatGeo(), propMat_, boats);
    // distant islands
    const isl = hillGeo(0x4f7a46);
    const im: THREE.Matrix4[] = [];
    for (let k = 0; k < 10; k++) {
      const p = ringPos(900, 1500);
      const s = 90 + rand() * 160;
      im.push(MX(p.x, -3.5, p.z, rand() * 6, s, s * (0.5 + rand() * 0.5), s));
    }
    inst(isl, propMat_, im);
    const wmesh = root.userData.water as THREE.Mesh;
    const bump = (wmesh.material as THREE.MeshStandardMaterial).bumpMap!;
    animate = (_dt, time) => {
      bump.offset.set(time * 0.012, time * 0.007);
    };
  }

  if (theme.id === "alpine") {
    const pine = pineGeo(true);
    scatter(pine, 700, { minOff: 1, maxOff: 70, scale: [0.9, 1.9], shadow: true, tint: 0.25 });
    scatter(pine, 260, { far: [0, farR + 100], scale: [1.3, 2.4], tint: 0.2, extra: 20 });
    scatter(rockGeo(0x7e838c), 120, { minOff: 3, maxOff: 80, scale: [0.8, 3], tint: 0.3 });
    scatter(cabinGeo(), 14, { minOff: 14, maxOff: 80, scale: [1.2, 1.8], shadow: true, extra: 6 });
    // mountains
    const mg = mountainGeo();
    const mm: THREE.Matrix4[] = [];
    for (let k = 0; k < 26; k++) {
      const rr = 180 + rand() * 260;
      const p = ringPos(rr * 0.9 + 60, rr * 0.9 + 420);
      mm.push(MX(p.x, -2, p.z, rand() * 6, rr, 260 + rand() * 340, rr));
    }
    inst(mg, propMat_, mm);
  }

  if (theme.id === "city") {
    const winTex = keep(TX.windowTexture(def.seed));
    const bMat = keep(
      new THREE.MeshStandardMaterial({
        color: 0x161824,
        roughness: 0.55,
        metalness: 0.5,
        emissive: 0xffffff,
        emissiveMap: winTex,
        emissiveIntensity: 1.25,
      }),
    );
    const variants: { geo: THREE.BufferGeometry; w: number; d: number; h: number }[] = [];
    for (let v = 0; v < 14; v++) {
      const w = 12 + rand() * 18;
      const d = 12 + rand() * 18;
      const h = 30 + rand() * 100;
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(0, h / 2, 0);
      const uv = g.getAttribute("uv");
      const ox = rand();
      const oy = rand();
      for (let i = 0; i < uv.count; i++) {
        const face = Math.floor(i / 4);
        const u = uv.getX(i);
        const vv = uv.getY(i);
        if (face < 2) uv.setXY(i, (u * d) / 40 + ox, (vv * h) / 40 + oy);
        else if (face < 4) uv.setXY(i, 0.01, 0.01);
        else uv.setXY(i, (u * w) / 40 + ox, (vv * h) / 40 + oy);
      }
      variants.push({ geo: g, w, d, h });
    }
    const per: THREE.Matrix4[][] = variants.map(() => []);
    for (let k = 0; k < 150; k++) {
      const vi = Math.floor(rand() * variants.length);
      const v = variants[vi];
      const sp = nearSpot(14, 110, Math.max(v.w, v.d) * 0.6);
      if (!sp) continue;
      per[vi].push(MX(sp.x, 0, sp.z, Math.round(rand() * 3) * (Math.PI / 2)));
    }
    for (let k = 0; k < 160; k++) {
      const vi = Math.floor(rand() * variants.length);
      const p = ringPos(60, 520);
      const s = 1.2 + rand() * 1.2;
      per[vi].push(MX(p.x, 0, p.z, Math.round(rand() * 3) * (Math.PI / 2), s, s * (1 + rand() * 1.4), s));
    }
    variants.forEach((v, i) => inst(v.geo, bMat, per[i]));

    // street lamps + light pools
    const lamps: THREE.Matrix4[] = [];
    const heads: THREE.Matrix4[] = [];
    const pools: THREE.Matrix4[] = [];
    const step = Math.round(44 / t.spacing);
    for (let i = 0; i < t.n; i += step) {
      for (const sg of [1, -1]) {
        if (sg < 0 && (i / step) % 2) continue;
        const p = pts[i];
        const lat = sg * (B + 0.5 + 1.8);
        const x = p.x + p.nx * lat;
        const z = p.z + p.nz * lat;
        const ry = Math.atan2(p.tx, p.tz) + (sg > 0 ? Math.PI : 0);
        lamps.push(MX(x, p.y - 0.02, z, ry));
        const hx = x + p.nx * -sg * 2.4;
        const hz = z + p.nz * -sg * 2.4;
        heads.push(MX(hx, p.y + 9.4, hz, ry));
        const pm = new THREE.Matrix4();
        _e.set(-Math.PI / 2, 0, 0);
        _q.setFromEuler(_e);
        pm.compose(new THREE.Vector3(hx, p.y + 0.07, hz), _q, new THREE.Vector3(1, 1, 1));
        pools.push(pm);
      }
    }
    inst(lampGeo(), propMat_, lamps);
    inst(
      keep(new THREE.BoxGeometry(0.9, 0.16, 0.45)),
      keep(new THREE.MeshBasicMaterial({ color: 0xffe2b0 })),
      heads,
    );
    inst(
      keep(new THREE.PlaneGeometry(26, 26)),
      keep(
        new THREE.MeshBasicMaterial({
          map: lampPoolTex,
          color: 0xffc27a,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
      pools,
    );
    // neon gates over the road
    const neonCols = [0xff2bd6, 0x2bf0ff, 0xffe62b, 0x7a5cff, 0xff4d4d];
    const gateStep = Math.round(430 / t.spacing);
    let gk = 0;
    for (let i = Math.round(200 / t.spacing); i < t.n; i += gateStep) {
      const p = pts[i];
      if (Math.abs(p.curv) > 0.004) continue;
      const col = neonCols[gk++ % neonCols.length];
      const mat = keep(new THREE.MeshBasicMaterial({ color: col }));
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = Math.atan2(p.tx, p.tz);
      const w = B + 2.4;
      const topGeo = keep(new THREE.BoxGeometry(w * 2, 0.45, 0.45));
      const top = new THREE.Mesh(topGeo, mat);
      top.position.y = 9.5;
      g.add(top);
      const top2 = new THREE.Mesh(topGeo, mat);
      top2.position.y = 8.4;
      top2.scale.set(0.82, 0.6, 0.6);
      g.add(top2);
      for (const sg of [-1, 1]) {
        const pole = new THREE.Mesh(keep(new THREE.BoxGeometry(0.4, 9.7, 0.4)), mat);
        pole.position.set(sg * w, 4.85, 0);
        g.add(pole);
      }
      const glow = new THREE.Mesh(
        keep(new THREE.PlaneGeometry(w * 2.2, 8)),
        keep(
          new THREE.MeshBasicMaterial({
            map: lampPoolTex,
            color: col,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        ),
      );
      glow.position.y = 6.2;
      g.add(glow);
      root.add(g);
    }
  }

  if (theme.id === "desert") {
    scatter(cactusGeo(), 260, { minOff: 3, maxOff: 90, scale: [0.9, 1.7], shadow: true, tint: 0.2 });
    scatter(rockGeo(0xa5603a), 160, { minOff: 3, maxOff: 120, scale: [0.8, 3.4], tint: 0.3 });
    scatter(bushGeo(0x8a7a3a, 0xa08c45), 260, { minOff: 2, maxOff: 80, scale: [0.9, 1.7], tint: 0.3 });
    // near mesas
    const mesa = mesaGeo();
    const ms: THREE.Matrix4[] = [];
    for (let k = 0; k < 40; k++) {
      const sp = nearSpot(120, 520, 90);
      if (!sp) continue;
      const r = 40 + rand() * 80;
      ms.push(MX(sp.x, -0.5, sp.z, rand() * 6, r, 60 + rand() * 90, r * (0.7 + rand() * 0.5)));
    }
    for (let k = 0; k < 24; k++) {
      const p = ringPos(200, 800);
      const r = 90 + rand() * 160;
      ms.push(MX(p.x, -0.5, p.z, rand() * 6, r, 90 + rand() * 150, r * (0.7 + rand() * 0.5)));
    }
    inst(mesa, propMat_, ms, { shadow: false });
    // dunes
    const dune = hillGeo(0xe3b377);
    const dm: THREE.Matrix4[] = [];
    for (let k = 0; k < 60; k++) {
      const sp = farSpot(0, farR + 500, 60);
      if (!sp) continue;
      const s = 60 + rand() * 120;
      dm.push(MX(sp.x, -2, sp.z, rand() * 6, s, s * (0.3 + rand() * 0.3), s * (0.7 + rand() * 0.6)));
    }
    inst(dune, propMat_, dm);
  }

  if (theme.id === "forest") {
    const tree = broadleafGeo();
    const pine = pineGeo(false);
    scatter(tree, 560, { minOff: 0.5, maxOff: 60, scale: [1.0, 1.8], shadow: true, tint: 0.35 });
    scatter(pine, 520, { minOff: 0.5, maxOff: 60, scale: [1.0, 1.9], shadow: true, tint: 0.3 });
    scatter(tree, 260, { far: [0, farR + 100], scale: [1.4, 2.4], tint: 0.3, extra: 20 });
    scatter(pine, 260, { far: [0, farR + 100], scale: [1.4, 2.5], tint: 0.3, extra: 20 });
    scatter(bushGeo(0x2f6a2a, 0x3f7f33), 340, { minOff: 0.5, maxOff: 45, scale: [0.9, 1.8], tint: 0.35 });
    scatter(rockGeo(0x6c7068), 90, { minOff: 2, maxOff: 60, scale: [0.8, 2.6], tint: 0.3 });
    const hills = hillGeo(0x2f5a2c);
    const hm: THREE.Matrix4[] = [];
    for (let k = 0; k < 24; k++) {
      const p = ringPos(80, 520);
      const s = 140 + rand() * 220;
      hm.push(MX(p.x, -4, p.z, rand() * 6, s, s * (0.5 + rand() * 0.7), s));
    }
    inst(hills, propMat_, hm);
  }

  /* ---------- update */
  return {
    update(dt, time, cam) {
      for (const c of clouds) {
        c.position.x += dt * 4;
        if (c.position.x > 1800) c.position.x = -1800;
      }
      animate?.(dt, time);
      void cam;
    },
    dispose() {
      scene.remove(root);
      dispose.forEach((d) => d.dispose());
    },
  };
}
