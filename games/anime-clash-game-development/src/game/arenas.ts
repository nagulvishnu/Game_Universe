import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export interface Prop { obj: THREE.Object3D; r: number; alive: boolean; color: number }

export interface Arena {
  id: string;
  group: THREE.Group;
  envScene: THREE.Scene;
  fogColor: number;
  fogDensity: number;
  sun: { color: number; intensity: number; pos: [number, number, number] };
  hemi: { sky: number; ground: number; intensity: number };
  exposure: number;
  bloom: number;
  rx: number;
  rz: number;
  props: Prop[];
  ambience: string;
  update: (dt: number, t: number, focus: THREE.Vector3) => void;
  breakAt: (p: THREE.Vector3, r: number) => { pos: THREE.Vector3; color: number }[];
  dispose: () => void;
}

// ------------------------------------------------------------------ helpers
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number], srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

function rockGeo(radius: number, detail: number, jitter: number, seed: number, yScale = 1) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute("normal"); g.deleteAttribute("uv");
  g = mergeVertices(g, 0.01);
  const r = rng(seed);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (r() - 0.5) * jitter;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * yScale, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

const NOISE_GLSL = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
`;

function skyDome(frag: string) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform float uTime; varying vec3 vDir;\n" + NOISE_GLSL + frag,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, mat };
}

const glowSprite = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    t = tex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.4)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    return t;
  };
})();

function makeBreakAt(props: Prop[]) {
  return (p: THREE.Vector3, r: number) => {
    const out: { pos: THREE.Vector3; color: number }[] = [];
    for (const pr of props) {
      if (!pr.alive) continue;
      const d = Math.hypot(pr.obj.position.x - p.x, pr.obj.position.z - p.z);
      if (d < r + pr.r) {
        pr.alive = false;
        pr.obj.visible = false;
        out.push({ pos: pr.obj.position.clone().add(new THREE.Vector3(0, 0.6, 0)), color: pr.color });
      }
    }
    return out;
  };
}

function finish(a: Omit<Arena, "breakAt" | "dispose">, disposables: (THREE.Texture | THREE.BufferGeometry | THREE.Material)[] = []): Arena {
  return {
    ...a,
    breakAt: makeBreakAt(a.props),
    dispose: () => {
      a.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => { const mm = x as THREE.MeshStandardMaterial; mm.map?.dispose(); mm.emissiveMap?.dispose(); x.dispose(); });
      });
      disposables.forEach((d) => d.dispose());
    },
  };
}

function basicMat(color: number, hdr = 1.8) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(hdr) });
}

// ------------------------------------------------------------------ NEO TOKYO
function buildTokyo(): Arena {
  const group = new THREE.Group();
  const r = rng(77);
  const sky = skyDome(`
    void main(){ vec3 d = normalize(vDir); float h = d.y;
      vec3 zen = vec3(0.015,0.01,0.08), mid = vec3(0.22,0.04,0.30), hor = vec3(0.95,0.16,0.52);
      vec3 col = mix(hor, mid, smoothstep(-0.05, 0.22, h)); col = mix(col, zen, smoothstep(0.18, 0.75, h));
      vec2 uv = d.xz / (abs(d.y) + 0.3) * 1.4;
      float c = fbm(uv * 1.4 + vec2(uTime * 0.012, 0.0));
      col += vec3(0.38, 0.08, 0.42) * smoothstep(0.42, 0.9, c) * smoothstep(0.0, 0.25, h) * 0.7;
      vec3 q = floor(d * 240.0); float st = step(0.9965, hash3(q)); col += vec3(0.9,0.9,1.0) * st * smoothstep(0.1,0.4,h) * (0.5 + 0.5*sin(uTime*2.0 + hash3(q)*30.0));
      vec3 m = normalize(vec3(-0.35, 0.33, -0.85)); float md = dot(d, m);
      col += vec3(1.6,1.3,1.5) * smoothstep(0.9972, 0.9980, md) + vec3(1.0,0.3,0.8) * pow(max(md, 0.0), 80.0) * 0.5;
      gl_FragColor = vec4(col, 1.0); }`);
  group.add(sky.mesh);

  // floor
  const floorTex = tex(1024, 560, (g, w, h) => {
    g.fillStyle = "#12141d"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = "#232a3c"; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 56) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // hazard edges
    for (const y of [0, h - 26]) { for (let x = -40; x < w; x += 52) { g.fillStyle = "#c8a020"; g.beginPath(); g.moveTo(x, y + 26); g.lineTo(x + 26, y); g.lineTo(x + 52, y); g.lineTo(x + 26, y + 26); g.closePath(); g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1; } }
    // central ring emblem
    g.save(); g.translate(w / 2, h / 2);
    g.shadowBlur = 24;
    g.strokeStyle = "#ff2bd6"; g.shadowColor = "#ff2bd6"; g.lineWidth = 8; g.beginPath(); g.ellipse(0, 0, 330, 175, 0, 0, 7); g.stroke();
    g.strokeStyle = "#18d4ff"; g.shadowColor = "#18d4ff"; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 0, 290, 150, 0, 0, 7); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(0, -150); g.lineTo(0, 150); g.stroke();
    g.beginPath(); g.moveTo(-8, -20); g.lineTo(8, -20); g.lineTo(8, 20); g.lineTo(-8, 20); g.closePath(); g.stroke();
    g.restore();
    g.fillStyle = "rgba(255,255,255,0.12)"; g.font = "bold 70px sans-serif"; g.textAlign = "center"; g.fillText("NEO TOKYO", w / 2, h - 70);
  });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.45, envMapIntensity: 0.3 });
  const floor = new THREE.Mesh(new RoundedBoxGeometry(36, 1.0, 19.5, 3, 0.08), floorMat);
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  group.add(floor);
  // neon edges
  const edgeM = basicMat(0xff2bd6, 2.2), edgeC = basicMat(0x18d4ff, 2.2);
  const edge = (w: number, d: number, x: number, z: number, m: THREE.Material) => { const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), m); e.position.set(x, 0.03, z); group.add(e); };
  edge(36, 0.12, 0, 9.7, edgeM); edge(36, 0.12, 0, -9.7, edgeC); edge(0.12, 19.5, 17.9, 0, edgeC); edge(0.12, 19.5, -17.9, 0, edgeM);
  // railings at back
  const rail = new THREE.Mesh(new THREE.BoxGeometry(36, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a4058, metalness: 0.8, roughness: 0.3 }));
  rail.position.set(0, 1.1, -9.5); group.add(rail);
  const rail2 = rail.clone(); rail2.position.y = 0.6; group.add(rail2);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), rail.material, 13);
  const dm = new THREE.Object3D();
  for (let i = 0; i < 13; i++) { dm.position.set(-18 + i * 3, 0.6, -9.5); dm.updateMatrix(); posts.setMatrixAt(i, dm.matrix); }
  group.add(posts);
  const stripM = basicMat(0x18d4ff, 2.5);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(36, 0.03, 0.03), stripM);
  strip.position.set(0, 1.16, -9.5); group.add(strip);

  // props (breakables)
  const props: Prop[] = [];
  const crateM = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.6, metalness: 0.5 });
  const addCrate = (x: number, z: number, s: number, color = 0x18d4ff) => {
    const c = new THREE.Group();
    const b = new THREE.Mesh(new RoundedBoxGeometry(s, s, s, 2, 0.05), crateM); b.position.y = s / 2; b.castShadow = true; b.receiveShadow = true; c.add(b);
    const l = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, 0.06, s * 1.02), basicMat(color, 2)); l.position.y = s * 0.7; c.add(l);
    c.position.set(x, 0, z); c.rotation.y = r() * 3; group.add(c);
    props.push({ obj: c, r: s, alive: true, color: 0x2a3550 });
  };
  addCrate(-15.5, -6, 1.5); addCrate(-14.2, -7.4, 1.0, 0xff2bd6); addCrate(15.2, -6.5, 1.6, 0xff2bd6); addCrate(14.8, 5.5, 1.1);
  addCrate(-6, -8.4, 1.0); addCrate(8.5, -8.6, 1.3, 0x18d4ff);
  // AC units & tank (static)
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a5068, roughness: 0.5, metalness: 0.7 });
  for (const [x, z, w] of [[-12, -13, 4], [4, -14, 5], [14, -12, 3.5], [-4, -12, 2.5]] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 3), metal); b.position.set(x, 1.1, z); b.castShadow = true; group.add(b);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x151824 })); f.position.set(x, 2.25, z); group.add(f);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 4, 20), metal); tank.position.set(-17, 2, -12); tank.castShadow = true; group.add(tank);
  // antenna with beacon
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 14, 6), metal); ant.position.set(10, 7, -14); group.add(ant);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), basicMat(0xff2040, 3)); beacon.position.set(10, 14, -14); group.add(beacon);

  // neon sign poles
  const signs: THREE.Mesh[] = [];
  const mkSign = (x: number, z: number, color: number, text: string) => {
    const t = tex(256, 128, (g, w, h) => { g.fillStyle = "#05030a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#" + color.toString(16).padStart(6, "0"); g.shadowColor = g.strokeStyle; g.shadowBlur = 16; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = g.strokeStyle; g.font = "bold 54px sans-serif"; g.textAlign = "center"; g.fillText(text, w / 2, h / 2 + 18); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.6, 1.6, 1.6) }));
    m.position.set(x, 4.5, z); group.add(m); signs.push(m);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), metal); p.position.set(x, 2, z - 0.1); group.add(p);
  };
  mkSign(-9, -12.5, 0xff2bd6, "RAMEN"); mkSign(9, -12.8, 0x18d4ff, "CLASH");

  // city (merged buildings)
  const geos: THREE.BufferGeometry[] = [];
  const roofGeos: THREE.BufferGeometry[] = [];
  const addB = (x: number, z: number, w: number, d: number, top: number) => {
    const base = -90;
    const h = top - base;
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const cell = 3.2;
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4);
      if (face === 2 || face === 3) { uv.setXY(i, 0.01, 0.01); continue; }
      const ex = face < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * ex / cell / 8 + (x * 0.37) % 1, uv.getY(i) * h / cell / 8);
    }
    g.translate(x, base + h / 2, z);
    const tint = new THREE.Color().setHSL(r() < 0.5 ? 0.85 : 0.55, 0.5, 0.65 + r() * 0.35);
    const cols = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < cols.length; i += 3) { cols[i] = tint.r; cols[i + 1] = tint.g; cols[i + 2] = tint.b; }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    geos.push(g);
    if (r() < 0.7) {
      const s = new THREE.BoxGeometry(w + 0.2, 0.25, d + 0.2);
      s.translate(x, top + 0.1, z);
      const nc = new THREE.Color(r() < 0.5 ? 0xff2bd6 : 0x18d4ff).multiplyScalar(2.2);
      const cc = new Float32Array(s.attributes.position.count * 3);
      for (let i = 0; i < cc.length; i += 3) { cc[i] = nc.r; cc[i + 1] = nc.g; cc[i + 2] = nc.b; }
      s.setAttribute("color", new THREE.BufferAttribute(cc, 3));
      roofGeos.push(s);
    }
  };
  for (let i = 0; i < 70; i++) addB(-110 + r() * 220, -45 - r() * 130, 7 + r() * 10, 7 + r() * 10, -10 + r() * 80);
  for (let i = 0; i < 26; i++) { const sx = r() < 0.5 ? -1 : 1; addB(sx * (30 + r() * 70), -34 + r() * 60, 7 + r() * 9, 7 + r() * 9, -25 + r() * 50); }
  const winTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = "#080a16"; g.fillRect(0, 0, w, h);
    const cols = ["#ffd89a", "#9ae8ff", "#ff9ae0", "#ffffff", "#ffe08a"];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (Math.random() < 0.5) { g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.globalAlpha = 0.55 + Math.random() * 0.45; g.fillRect(x * 32 + 6, y * 32 + 7, 20, 17); g.globalAlpha = 1; }
      else { g.fillStyle = "#141830"; g.fillRect(x * 32 + 6, y * 32 + 7, 20, 17); }
    }
  }, [1, 1]);
  const bld = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshBasicMaterial({ map: winTex, vertexColors: true }));
  group.add(bld);
  const roofs = new THREE.Mesh(mergeGeometries(roofGeos)!, new THREE.MeshBasicMaterial({ vertexColors: true }));
  group.add(roofs);

  // billboards (animated canvases)
  const bbCanvases: { c: HTMLCanvasElement; t: THREE.CanvasTexture; kind: number }[] = [];
  const mkBB = (x: number, y: number, z: number, w: number, h: number, kind: number, rotY: number) => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 256;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.5, 1.5) }));
    m.position.set(x, y, z); m.rotation.y = rotY; group.add(m);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 1, h + 1, 0.6), new THREE.MeshStandardMaterial({ color: 0x151824, metalness: 0.8, roughness: 0.4 }));
    frame.position.set(x, y, z - 0.45); frame.rotation.y = rotY; group.add(frame);
    bbCanvases.push({ c, t, kind });
  };
  mkBB(-26, 24, -52, 34, 17, 0, 0.25); mkBB(30, 30, -62, 38, 19, 1, -0.2); mkBB(0, 46, -90, 46, 23, 2, 0);
  const drawBB = (b: { c: HTMLCanvasElement; t: THREE.CanvasTexture; kind: number }, t: number) => {
    const g = b.c.getContext("2d")!; const w = 512, h = 256;
    const hues = [[320, 190], [30, 280], [190, 330]][b.kind];
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, `hsl(${hues[0]},90%,30%)`); gr.addColorStop(1, `hsl(${hues[1]},90%,30%)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.25;
    for (let i = 0; i < 16; i++) { const x = ((i * 90 + t * 120) % (w + 120)) - 60; g.fillStyle = "#fff"; g.fillRect(x, 0, 30, h); }
    g.globalAlpha = 1;
    g.fillStyle = "#fff"; g.shadowColor = "#fff"; g.shadowBlur = 20; g.textAlign = "center";
    const texts = ["ANIME CLASH", "NEON FIGHT NIGHT", "NEO TOKYO 2099"];
    g.font = "bold 70px sans-serif"; g.fillText(texts[b.kind], w / 2 + Math.sin(t * 3) * 3, h / 2 + 10);
    g.font = "bold 30px sans-serif"; g.fillText(Math.floor(t * 2) % 2 ? "▶ FIGHT NOW ◀" : "▷ FIGHT NOW ◁", w / 2, h - 40);
    b.t.needsUpdate = true;
  };
  bbCanvases.forEach((b) => drawBB(b, 0));

  // vehicles
  const veh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.5, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }), 14);
  const vdat = Array.from({ length: 14 }, () => ({ x: -120 + r() * 240, y: 4 + r() * 45, z: -30 - r() * 90, s: (r() < 0.5 ? -1 : 1) * (8 + r() * 14) }));
  veh.frustumCulled = false;
  group.add(veh);

  // rain
  const N = 1400;
  const rp = new Float32Array(N * 6);
  const rb = Array.from({ length: N }, () => ({ x: (r() - 0.5) * 70, y: r() * 28, z: -22 + r() * 44, s: 28 + r() * 14 }));
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rp, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.32, fog: false }));
  rain.frustumCulled = false;
  group.add(rain);

  // lights
  const mag = new THREE.PointLight(0xff2bd6, 70, 30, 1.8); mag.position.set(14, 5, -7); group.add(mag);
  const cy = new THREE.PointLight(0x18d4ff, 70, 30, 1.8); cy.position.set(-14, 5, -7); group.add(cy);
  const front = new THREE.PointLight(0x8a5cff, 30, 26, 1.8); front.position.set(0, 7, 10); group.add(front);

  // env scene
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.mesh.geometry, sky.mat));
  for (const [x, z, c] of [[-30, -30, 0xff2bd6], [30, -30, 0x18d4ff], [0, -50, 0xffffff]] as const) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3), side: THREE.DoubleSide }));
    m.position.set(x, 8, z); envScene.add(m);
  }

  let bbT = 0;
  const update = (dt: number, t: number) => {
    sky.mat.uniforms.uTime.value = t;
    bbT += dt;
    if (bbT > 0.12) { bbT = 0; bbCanvases.forEach((b) => drawBB(b, t)); }
    for (let i = 0; i < N; i++) {
      const d = rb[i];
      d.y -= d.s * dt;
      if (d.y < 0) { d.y = 28; d.x = (r() - 0.5) * 70; d.z = -22 + r() * 44; }
      const k = i * 6;
      rp[k] = d.x; rp[k + 1] = d.y; rp[k + 2] = d.z; rp[k + 3] = d.x - 0.08; rp[k + 4] = d.y + 1.1; rp[k + 5] = d.z;
    }
    rainGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < 14; i++) {
      const v = vdat[i];
      v.x += v.s * dt; if (v.x > 130) v.x = -130; if (v.x < -130) v.x = 130;
      dm.position.set(v.x, v.y, v.z); dm.rotation.set(0, 0, 0); dm.scale.set(v.s < 0 ? -1 : 1, 1, 1); dm.updateMatrix(); veh.setMatrixAt(i, dm.matrix);
    }
    dm.scale.set(1, 1, 1);
    veh.instanceMatrix.needsUpdate = true;
    (beacon.material as THREE.MeshBasicMaterial).color.setScalar(Math.sin(t * 5) > 0 ? 3 : 0.2).multiply(new THREE.Color(1, 0.1, 0.15));
    signs.forEach((s, i) => { (s.material as THREE.MeshBasicMaterial).color.setScalar(Math.sin(t * 9 + i * 2) > -0.9 ? 1.6 : 0.5); });
    mag.intensity = 66 + Math.sin(t * 2) * 8;
    cy.intensity = 66 + Math.cos(t * 2.3) * 8;
  };

  return finish({
    id: "tokyo", group, envScene, fogColor: 0x2a0a3e, fogDensity: 0.0075,
    sun: { color: 0xb4c4ff, intensity: 1.9, pos: [-6, 14, 9] }, hemi: { sky: 0x7a6cff, ground: 0x301038, intensity: 0.8 },
    exposure: 1.05, bloom: 0.75, rx: 15.5, rz: 7.2, props, ambience: "tokyo", update,
  }, [floorTex, winTex]);
}

// ------------------------------------------------------------------ DRAGON SANCTUARY
function buildDragon(): Arena {
  const group = new THREE.Group();
  const r = rng(1234);
  const sky = skyDome(`
    void main(){ vec3 d = normalize(vDir); float h = d.y;
      vec3 zen = vec3(0.10,0.06,0.26), mid = vec3(0.72,0.24,0.32), hor = vec3(1.0,0.62,0.22);
      vec3 col = mix(hor, mid, smoothstep(-0.05, 0.2, h)); col = mix(col, zen, smoothstep(0.15, 0.7, h));
      vec3 s = normalize(vec3(0.12, 0.13, -1.0)); float sd = dot(d, s);
      vec2 uv = d.xz / (abs(d.y) + 0.25) * 1.6;
      float c = fbm(uv * vec2(1.2, 2.4) + vec2(uTime * 0.01, 0.0));
      vec3 cc = mix(vec3(0.55,0.2,0.35), vec3(1.0,0.7,0.35), pow(max(sd,0.0), 3.0));
      col = mix(col, cc, smoothstep(0.45, 0.85, c) * smoothstep(-0.02, 0.15, h) * 0.8);
      col += vec3(3.0, 2.2, 1.2) * smoothstep(0.9987, 0.9992, sd) + vec3(1.0,0.5,0.2) * pow(max(sd, 0.0), 14.0) * 0.9 + vec3(1.0,0.7,0.4) * pow(max(sd,0.0), 120.0);
      gl_FragColor = vec4(col, 1.0); }`);
  group.add(sky.mesh);

  // platform
  const stoneTex = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#6e625c"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 80 + Math.random() * 60; g.fillStyle = `rgba(${v},${v - 8},${v - 14},0.2)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.save(); g.translate(w / 2, h / 2);
    g.strokeStyle = "rgba(20,12,10,0.7)"; g.lineWidth = 6;
    for (const rr of [470, 400, 250, 120]) { g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke(); }
    g.lineWidth = 3;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * 250, Math.sin(a) * 250); g.lineTo(Math.cos(a) * 470, Math.sin(a) * 470); g.stroke(); }
    g.restore();
  });
  const glowTexMap = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2);
    g.shadowColor = "#ff8a30"; g.shadowBlur = 20; g.strokeStyle = "#ff9a40"; g.lineWidth = 5;
    for (const rr of [435, 325, 185]) { g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke(); }
    const rg = rng(5);
    for (let i = 0; i < 48; i++) { const a = (i / 48) * 6.283; g.save(); g.rotate(a); g.translate(0, -360); g.lineWidth = 4; g.beginPath(); g.moveTo(-9, -12); g.lineTo(9, -12); g.moveTo(0, -12); g.lineTo(0, 14); if (rg() < 0.5) { g.moveTo(-9, 4); g.lineTo(9, 4); } g.stroke(); g.restore(); }
    // dragon-ish sigil
    g.lineWidth = 7; g.beginPath(); for (let a = 0; a < 6.283 * 2.2; a += 0.05) { const rr = 20 + a * 13; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke();
    g.restore();
  });
  const platM = new THREE.MeshStandardMaterial({ map: stoneTex, emissiveMap: glowTexMap, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.82, metalness: 0.05 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(17.5, 18.5, 1.2, 72), platM);
  plat.position.y = -0.6; plat.receiveShadow = true; group.add(plat);
  const stone = new THREE.MeshStandardMaterial({ color: 0x7a6e68, roughness: 0.9 });
  const step = new THREE.Mesh(new THREE.CylinderGeometry(19.5, 20.5, 0.8, 72), stone); step.position.y = -1.5; step.receiveShadow = true; group.add(step);
  const under = new THREE.Mesh(rockGeo(17, 2, 0.35, 9, 1.1), new THREE.MeshStandardMaterial({ color: 0x4a3f48, roughness: 1, flatShading: true }));
  under.position.y = -19; under.scale.set(1.1, 0.8, 1.1); group.add(under);

  const props: Prop[] = [];
  // balustrade pillars + lanterns
  const pillM = new THREE.MeshStandardMaterial({ color: 0x8a7c74, roughness: 0.85 });
  const lanM = new THREE.MeshStandardMaterial({ color: 0x2a1c18, emissive: 0xff8a30, emissiveIntensity: 2.4, roughness: 0.6 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * 17.6, z = Math.sin(a) * 17.6;
    const p = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.5, 8), pillM); s.position.y = 0.75; s.castShadow = true; p.add(s);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 4), pillM); cap.position.y = 1.7; cap.rotation.y = Math.PI / 4; p.add(cap);
    if (i % 2 === 0) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), lanM); l.position.y = 2.2; p.add(l); }
    p.position.set(x, 0, z);
    group.add(p);
    if (z > -4 || i % 2 === 0) props.push({ obj: p, r: 0.8, alive: true, color: 0x8a7c74 });
  }
  // torii gate
  const red = new THREE.MeshStandardMaterial({ color: 0xb02820, roughness: 0.5, emissive: 0x401008, emissiveIntensity: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a040, roughness: 0.3, metalness: 0.8 });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 13, 14), red); p.position.set(sx * 8, 6.5, -17); p.castShadow = true; group.add(p); const b = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 14), gold); b.position.set(sx * 8, 0.2, -17); group.add(b); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(22, 0.9, 1.1), red); beam.position.set(0, 11, -17); group.add(beam);
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(25, 0.6, 1.8), new THREE.MeshStandardMaterial({ color: 0x2a1818, roughness: 0.6 })); beam2.position.set(0, 12.3, -17); group.add(beam2);
  for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 1.8), beam2.material); t.position.set(sx * 13.5, 12.8, -17); t.rotation.z = sx * 0.2; group.add(t); }
  const beam3 = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 0.7), red); beam3.position.set(0, 9, -17); group.add(beam3);
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0xff8a30, emissiveIntensity: 1.2 })); plaque.position.set(0, 10, -16.9); group.add(plaque);

  // dragon statues
  const dragonMat = new THREE.MeshStandardMaterial({ color: 0x5a5058, roughness: 0.75, metalness: 0.15 });
  const eyeM = basicMat(0xff7a20, 3);
  const dragon = (sx: number) => {
    const g = new THREE.Group();
    const segs = 14;
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const rad = 1.3 - t * 0.7;
      const s = new THREE.Mesh(new THREE.SphereGeometry(rad, 12, 10), dragonMat);
      s.position.set(Math.sin(t * 5) * 1.6 * -sx, 0.8 + t * 9, Math.cos(t * 5) * 0.9);
      s.castShadow = true; g.add(s);
      if (i % 2 === 0) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0 - t * 0.4, 5), dragonMat); sp.position.set(s.position.x, s.position.y + rad, s.position.z - 0.4); sp.rotation.x = -0.4; g.add(sp); }
    }
    const hd = new THREE.Group(); hd.position.set(Math.sin(5) * 1.6 * -sx, 10.2, Math.cos(5) * 0.9);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), dragonMat); skull.scale.set(1, 0.9, 1.4); hd.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.9), dragonMat); snout.position.set(0, -0.2, 1.7); hd.add(snout);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.8), dragonMat); jaw.position.set(0, -0.8, 1.6); jaw.rotation.x = 0.25; hd.add(jaw);
    for (const e of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), eyeM); eye.position.set(e * 0.7, 0.3, 0.9); hd.add(eye);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.25, 2.4, 6), dragonMat); horn.position.set(e * 0.6, 0.7, -0.5); horn.rotation.x = -1.1; hd.add(horn);
      const whisk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 3, 4), gold); whisk.position.set(e * 0.7, -0.1, 2.5); whisk.rotation.set(1.2, 0, e * 0.8); hd.add(whisk);
    }
    hd.rotation.y = sx * 0.6; hd.rotation.x = 0.15;
    g.add(hd);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), basicMat(0xff8a30, 2.2)); orb.position.set(hd.position.x + sx * 0.3, 8.4, hd.position.z + 2.2); g.add(orb);
    g.position.set(sx * 16, 0, -10);
    g.rotation.y = sx * -0.5;
    group.add(g);
    return g;
  };
  dragon(-1); dragon(1);

  // pagoda
  const roofM = new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.5, metalness: 0.2 });
  const wallM = new THREE.MeshStandardMaterial({ color: 0xa83a2a, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const w = 18 - i * 2.4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 3.2, w * 0.7), wallM); b.position.set(0, 1.6 + i * 6, -75); group.add(b);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(w * 0.95, 2.6, 4), roofM); rf.rotation.y = Math.PI / 4; rf.position.set(0, 4.4 + i * 6, -75); group.add(rf);
    const lit = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.9, w * 0.72), basicMat(0xffb060, 1.6)); lit.position.set(0, 1.8 + i * 6, -75); group.add(lit);
  }
  // mountains
  const mtM = new THREE.MeshStandardMaterial({ color: 0x3a2a48, roughness: 1, flatShading: true });
  const snowM = new THREE.MeshStandardMaterial({ color: 0xffd8c0, roughness: 0.9, flatShading: true, emissive: 0x401810, emissiveIntensity: 0.4 });
  for (let i = 0; i < 16; i++) {
    const h = 60 + r() * 90, rad = 35 + r() * 40;
    const x = -230 + i * 30 + r() * 20, z = -150 - r() * 120;
    const g = new THREE.ConeGeometry(rad, h, 7, 4);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const j = 1 + (r() - 0.5) * 0.35; p.setX(k, p.getX(k) * j); p.setZ(k, p.getZ(k) * j); p.setY(k, p.getY(k) + (r() - 0.5) * 6); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mtM); m.position.set(x, h / 2 - 45, z); group.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.34, h * 0.3, 7), snowM); cap.position.set(x, h - 45 - h * 0.15 + 1, z); group.add(cap);
  }
  // floating rocks
  const floaters: { m: THREE.Group; y0: number; ph: number; sp: number }[] = [];
  const rockM = new THREE.MeshStandardMaterial({ color: 0x5a4a52, roughness: 1, flatShading: true });
  const crysM = new THREE.MeshStandardMaterial({ color: 0xff9a40, emissive: 0xff7a20, emissiveIntensity: 2.2 });
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const s = 1.5 + r() * 4;
    const m = new THREE.Mesh(rockGeo(s, 1, 0.5, i + 30, 0.8), rockM); m.castShadow = true; g.add(m);
    if (r() < 0.6) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.35), crysM); c.scale.y = 2; c.position.y = s * 0.9; g.add(c); }
    const a = (i / 12) * 6.283 + r();
    const dist = 28 + r() * 25;
    g.position.set(Math.cos(a) * dist, 3 + r() * 22, -Math.abs(Math.sin(a)) * dist - 12);
    group.add(g);
    floaters.push({ m: g, y0: g.position.y, ph: r() * 6, sp: 0.3 + r() * 0.4 });
  }
  // clouds
  const cloudTex = tex(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = Math.random() * w, y = Math.random() * h, rr = 40 + Math.random() * 110; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, "rgba(255,200,170,0.5)"); gr.addColorStop(1, "rgba(255,160,140,0)"); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  });
  const clouds: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.8 - i * 0.15, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = -16 - i * 7; m.rotation.z = i; group.add(m); clouds.push(m);
  }
  // light shafts
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8 + i * 3, 70), new THREE.MeshBasicMaterial({ map: glowSprite(), color: 0xffa860, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.set(-24 + i * 14, 25, -40 - i * 6); m.rotation.z = 0.35; group.add(m);
  }
  // motes
  const M = 360;
  const mp = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) { mp[i * 3] = (r() - 0.5) * 50; mp[i * 3 + 1] = r() * 18; mp[i * 3 + 2] = (r() - 0.5) * 36; }
  const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffb060, size: 0.22, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, map: glowSprite() }));
  motes.frustumCulled = false; group.add(motes);
  // energy pillars of light behind statues
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); b.position.set(sx * 27, 20, -16); group.add(b); }

  // lights
  const rim = new THREE.DirectionalLight(0xff9050, 2.2); rim.position.set(2, 8, -30); group.add(rim); group.add(rim.target);
  const warm = new THREE.PointLight(0xff8a30, 60, 36, 1.8); warm.position.set(-12, 4, 4); group.add(warm);
  const warm2 = new THREE.PointLight(0xff5a3a, 50, 36, 1.8); warm2.position.set(13, 4, 4); group.add(warm2);

  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.mesh.geometry, sky.mat));

  const update = (dt: number, t: number) => {
    sky.mat.uniforms.uTime.value = t;
    for (const f of floaters) { f.m.position.y = f.y0 + Math.sin(t * f.sp + f.ph) * 1.2; f.m.rotation.y += dt * 0.1; }
    clouds.forEach((c, i) => { c.rotation.z += dt * 0.003 * (i + 1); });
    for (let i = 0; i < M; i++) { mp[i * 3 + 1] += dt * (0.5 + (i % 5) * 0.2); mp[i * 3] += Math.sin(t + i) * dt * 0.2; if (mp[i * 3 + 1] > 18) mp[i * 3 + 1] = 0; }
    mg.attributes.position.needsUpdate = true;
    lanM.emissiveIntensity = 2.2 + Math.sin(t * 6) * 0.3;
    warm.intensity = 56 + Math.sin(t * 3.1) * 8;
  };
  return finish({
    id: "dragon", group, envScene, fogColor: 0xd98a60, fogDensity: 0.0042,
    sun: { color: 0xffc890, intensity: 2.6, pos: [-7, 15, 12] }, hemi: { sky: 0xffa070, ground: 0x4a2a50, intensity: 1.2 },
    exposure: 1.0, bloom: 0.7, rx: 15.5, rz: 7.2, props, ambience: "dragon", update,
  }, [stoneTex, glowTexMap, cloudTex]);
}

// ------------------------------------------------------------------ CELESTIAL RUINS
function buildCelestial(): Arena {
  const group = new THREE.Group();
  const r = rng(4321);
  const sky = skyDome(`
    void main(){ vec3 d = normalize(vDir);
      vec2 p = d.xy * 2.2 + d.z * 1.7;
      float n1 = fbm(p + vec2(uTime * 0.004, 0.0)), n2 = fbm(p * 2.3 - 7.0 + n1);
      vec3 col = vec3(0.012, 0.01, 0.045);
      col += mix(vec3(0.20, 0.05, 0.5), vec3(0.0, 0.35, 0.6), n2) * smoothstep(0.35, 0.85, n1) * 0.9;
      col += vec3(0.7, 0.15, 0.55) * smoothstep(0.55, 0.9, n2) * 0.35;
      vec3 bn = normalize(vec3(0.3, 0.85, 0.2)); float bd = abs(dot(d, bn));
      col += vec3(0.5, 0.45, 0.9) * exp(-bd * bd * 22.0) * (0.25 + 0.6 * fbm(d.xz * 9.0 + d.y * 4.0));
      vec3 q = floor(d * 300.0); float h = hash3(q); float st = step(0.9955, h);
      col += mix(vec3(0.7,0.8,1.0), vec3(1.0,0.8,0.7), hash3(q + 3.0)) * st * (0.6 + 0.4 * sin(uTime * 1.5 + h * 40.0)) * 1.5;
      vec3 pl = normalize(vec3(0.6, 0.28, -0.75)); float pd = dot(d, pl);
      float disc = smoothstep(0.9915, 0.9925, pd);
      vec3 pcol = mix(vec3(0.15,0.2,0.5), vec3(0.9,0.6,0.9), smoothstep(0.995, 0.9915, pd) * 0.4 + fbm(d.xy * 40.0) * 0.4);
      col = mix(col, pcol, disc) + vec3(0.4, 0.5, 1.0) * pow(max(pd, 0.0), 160.0) * 0.8;
      gl_FragColor = vec4(col, 1.0); }`);
  group.add(sky.mesh);

  const marbleTex = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#cfd4e6"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(120,130,170,${0.1 + Math.random() * 0.25})`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (Math.random() - 0.5) * 160; y += (Math.random() - 0.5) * 160; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 8000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.save(); g.translate(w / 2, h / 2); g.strokeStyle = "rgba(40,40,80,0.5)"; g.lineWidth = 5;
    for (const rr of [470, 330, 160]) { g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke(); }
    g.restore();
  });
  const runeTex = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2); g.shadowColor = "#4de1ff"; g.shadowBlur = 22; g.strokeStyle = "#7de8ff"; g.lineWidth = 6;
    for (const rr of [440, 300, 140]) { g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke(); }
    g.lineWidth = 4;
    for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, -140); g.lineTo(0, -440); g.stroke(); }
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; g.lineTo(Math.cos(a) * 300, Math.sin(a) * 300); } g.closePath(); g.stroke();
    g.beginPath(); for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.283 - 1.57; g.lineTo(Math.cos(a) * 140, Math.sin(a) * 140); } g.closePath(); g.stroke();
    const rg = rng(8);
    for (let i = 0; i < 36; i++) { g.save(); g.rotate((i / 36) * 6.283); g.translate(0, -370); g.lineWidth = 3; g.beginPath(); g.moveTo(-8, -10); g.lineTo(8, -10); g.moveTo(0, -10); g.lineTo(0, 12); if (rg() < 0.5) g.moveTo(-8, 5), g.lineTo(8, 5); g.stroke(); g.restore(); }
    g.restore();
  });
  const platM = new THREE.MeshStandardMaterial({ map: marbleTex, emissiveMap: runeTex, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.28, metalness: 0.15, envMapIntensity: 1.0 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(17, 16, 1.2, 72), platM);
  plat.position.y = -0.6; plat.receiveShadow = true; group.add(plat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(17, 0.22, 8, 72), basicMat(0x7de8ff, 1.8)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.02; group.add(rim);
  const rockM = new THREE.MeshStandardMaterial({ color: 0x5a5470, roughness: 1, flatShading: true });
  const under = new THREE.Mesh(rockGeo(16.5, 2, 0.45, 55, 1.15), rockM); under.position.y = -18.5; under.scale.set(1, 0.75, 1); group.add(under);
  const crysM = (c: number) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.2, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 9; i++) { const a = r() * 6.283, d = r() * 9; const c = new THREE.Mesh(new THREE.ConeGeometry(0.5 + r() * 0.7, 3 + r() * 5, 5), crysM(r() < 0.5 ? 0x4de1ff : 0x8c6bff)); c.rotation.x = Math.PI; c.position.set(Math.cos(a) * d, -9 - r() * 4, Math.sin(a) * d); group.add(c); }

  // ruins: broken columns and arches
  const props: Prop[] = [];
  const colM = new THREE.MeshStandardMaterial({ color: 0xc4c8de, roughness: 0.5 });
  const column = (x: number, z: number, h: number, tilt = 0, breakable = false) => {
    const g = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, h, 12), colM); sh.position.y = h / 2; sh.castShadow = true; g.add(sh);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 2.0), colM); base.position.y = 0.25; g.add(base);
    if (h > 6) { const cap = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 2.0), colM); cap.position.y = h; g.add(cap); }
    else { const brk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), colM); brk.position.y = h; brk.scale.set(1, 0.5, 1); g.add(brk); }
    g.position.set(x, 0, z); g.rotation.z = tilt; group.add(g);
    if (breakable) props.push({ obj: g, r: 1.4, alive: true, color: 0xc4c8de });
  };
  column(-19, -4, 10); column(19, -5, 6, 0.1); column(-14, -11, 8); column(15, -12, 11); column(-9, -15, 4, -0.15); column(8, -16, 7);
  column(-16.5, 5.5, 3.5, 0.2, true); column(17, 6, 4.2, -0.15, true); column(-8, -8.5, 2.2, 0, true); column(10.5, -8.8, 2.6, 0, true);
  // arches
  for (const [x, z, s] of [[-4, -24, 1.0], [14, -22, 0.8]] as const) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(6 * s, 0.9, 10, 24, Math.PI * 0.85), colM); a.position.set(x, 3, z); a.rotation.z = 0.1; a.castShadow = true; group.add(a);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.8, 6 * s, 1.8), colM); p.position.set(x + sx * 6 * s, 3 * s, z); group.add(p); }
  }
  // steps
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(14 - i * 2, 0.4, 3), colM); s.position.set(0, -0.2 + i * 0.0, -18 - i * 2.5); s.position.y = i * 0.4 - 0.2; group.add(s); }
  // crystals around the edge
  const halos: THREE.Sprite[] = [];
  const bigCr: { m: THREE.Mesh; y0: number; ph: number }[] = [];
  const crystalSpots: [number, number, number, number][] = [[-14, -9, 0x4de1ff, 2.2], [14, -10, 0x8c6bff, 2.6], [-17, 2, 0xff6bd6, 1.6], [17.5, 1, 0x4de1ff, 1.8], [0, -19, 0x8c6bff, 3.2]];
  for (const [x, z, c, s] of crystalSpots) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(s), crysM(c)); m.scale.set(0.6, 1.6, 0.6); m.position.set(x, s * 1.4 + 1, z); group.add(m);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(s * 6); sp.position.copy(m.position); group.add(sp); halos.push(sp);
    bigCr.push({ m, y0: m.position.y, ph: r() * 6 });
    const l = new THREE.PointLight(c, 22, 20, 1.8); l.position.set(x, s * 1.4 + 1, z); group.add(l);
    props.push({ obj: new THREE.Object3D(), r: 0, alive: false, color: c }); props.pop();
  }
  // floating islands
  const islands: { g: THREE.Group; y0: number; ph: number }[] = [];
  const grassM = new THREE.MeshStandardMaterial({ color: 0x4a8a78, roughness: 0.9, emissive: 0x0a2a30, emissiveIntensity: 0.5 });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const s = 5 + r() * 9;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.95, 1.1, 14), grassM); g.add(top);
    const bot = new THREE.Mesh(rockGeo(s * 0.95, 1, 0.45, i + 90, 1.2), rockM); bot.position.y = -s * 1.4; bot.scale.set(1, 0.9, 1); g.add(bot);
    if (r() < 0.8) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3 + r() * 5, 8), colM); c.position.set((r() - 0.5) * s, 2, (r() - 0.5) * s); g.add(c); }
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.8 + r()), crysM(r() < 0.5 ? 0x4de1ff : 0xff6bd6)); cr.scale.y = 2; cr.position.set((r() - 0.5) * s, 1.8, (r() - 0.5) * s); g.add(cr);
    const a = (i / 9) * Math.PI + r() * 0.3;
    g.position.set(Math.cos(a) * 70 + (r() - 0.5) * 30, -8 + r() * 40, -35 - Math.sin(a) * 90);
    group.add(g);
    islands.push({ g, y0: g.position.y, ph: r() * 6 });
  }
  // energy ribbons
  const ribbons: THREE.Mesh[] = [];
  for (let k = 0; k < 3; k++) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60; const a = t * Math.PI * 4 + k * 2.1; pts.push(new THREE.Vector3(Math.cos(a) * (21 + Math.sin(t * 9) * 2), 3 + t * 22 + Math.sin(a * 2) * 2, Math.sin(a) * 19 - 4)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.07, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color([0x4de1ff, 0x8c6bff, 0xff6bd6][k]).multiplyScalar(1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(tube); ribbons.push(tube);
  }
  // sparkles
  const S = 420;
  const sp = new Float32Array(S * 3);
  for (let i = 0; i < S; i++) { sp[i * 3] = (r() - 0.5) * 60; sp[i * 3 + 1] = r() * 20; sp[i * 3 + 2] = (r() - 0.5) * 40 - 4; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const sparkles = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xaad8ff, size: 0.2, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, map: glowSprite() }));
  sparkles.frustumCulled = false; group.add(sparkles);

  const rimL = new THREE.DirectionalLight(0x8c6bff, 2.0); rimL.position.set(5, 10, -25); group.add(rimL); group.add(rimL.target);
  const front = new THREE.PointLight(0x4de1ff, 30, 30, 1.8); front.position.set(0, 6, 12); group.add(front);

  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.mesh.geometry, sky.mat));

  const update = (dt: number, t: number) => {
    sky.mat.uniforms.uTime.value = t;
    islands.forEach((i) => { i.g.position.y = i.y0 + Math.sin(t * 0.3 + i.ph) * 1.5; i.g.rotation.y += dt * 0.02; });
    bigCr.forEach((c, i) => { c.m.position.y = c.y0 + Math.sin(t * 0.9 + c.ph) * 0.35; c.m.rotation.y += dt * 0.5; halos[i].position.y = c.m.position.y; halos[i].material.opacity = 0.45 + Math.sin(t * 2 + c.ph) * 0.12; });
    ribbons.forEach((m, i) => { m.rotation.y += dt * 0.05 * (i % 2 ? -1 : 1); });
    for (let i = 0; i < S; i++) { sp[i * 3 + 1] += dt * (0.3 + (i % 4) * 0.15); sp[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.3; if (sp[i * 3 + 1] > 20) sp[i * 3 + 1] = 0; }
    sg.attributes.position.needsUpdate = true;
  };
  return finish({
    id: "celestial", group, envScene, fogColor: 0x1a1240, fogDensity: 0.0035,
    sun: { color: 0xc4d0ff, intensity: 2.2, pos: [-6, 15, 10] }, hemi: { sky: 0x8c9cff, ground: 0x30204a, intensity: 1.2 },
    exposure: 1.05, bloom: 0.8, rx: 15.5, rz: 7.2, props, ambience: "celestial", update,
  }, [marbleTex, runeTex]);
}

export function buildArena(id: string): Arena {
  if (id === "dragon") return buildDragon();
  if (id === "celestial") return buildCelestial();
  return buildTokyo();
}
