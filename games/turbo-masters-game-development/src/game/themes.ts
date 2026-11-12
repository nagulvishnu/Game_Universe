import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TrackDef } from "./data";
import { Ctx, Item, makeInst, scatter, std, buildTerrain, buildingGeo, windowTexture, signTexture, crowdTexture, noiseColorTexture } from "./worldkit";
import { makeCanvas, fbm, smoothstep, lerp, glowTexture, noise2 } from "./util";

type ThemeInfo = { ground?: THREE.Mesh };

const vcol = (g: THREE.BufferGeometry, hex: number | string) => {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
};
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs, false)!;
const vmat = (rough = 0.9, metal = 0) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, flatShading: true });

function flatGround(ctx: Ctx, color: string, y: number, rough = 0.95, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const g = new THREE.PlaneGeometry(9000, 9000);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, std(color, rough, metal, extra));
  m.position.y = y;
  m.receiveShadow = true;
  ctx.groundY = y;
  ctx.hAt = () => y;
  return m;
}
function centerOf(ctx: Ctx) {
  const t = ctx.track;
  return { x: (t.minX + t.maxX) / 2, z: (t.minZ + t.maxZ) / 2 };
}
function faceRoad(ctx: Ctx, s: { i: number; side: number }) {
  const { track } = ctx;
  return Math.atan2(-s.side * track.nx[s.i], -s.side * track.nz[s.i]);
}
function animatedScreen(ctx: Ctx, w: number, h: number, paint: (g: CanvasRenderingContext2D, t: number, W: number, H: number) => void, rate = 0.5) {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = Math.round(512 * (h / w));
  const g = cv.getContext("2d")!;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  paint(g, 0, cv.width, cv.height);
  tex.needsUpdate = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
  let acc = 0;
  ctx.anim.push((dt, t) => {
    acc += dt;
    if (acc > rate) { acc = 0; paint(g, t, cv.width, cv.height); tex.needsUpdate = true; }
  });
  return mesh;
}
const JP = ["ターボ", "ネオン", "速度", "ラーメン", "電気", "東京", "酒場", "未来", "勝利", "夜"];
function holoArch(ctx: Ctx, i: number, color: string, big = 1) {
  const { track } = ctx;
  const g = new THREE.Group();
  const R = track.wallHalf + 1.5;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(R, 0.3 * big, 8, 48, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), toneMapped: false }));
  g.add(arc);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(R - 1.2, 0.08, 6, 48, Math.PI * 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(1.5), toneMapped: false }));
  g.add(inner);
  ctx.anim.push((_d, t) => { inner.rotation.z = Math.sin(t * 1.3 + i) * 0.45; });
  g.position.set(track.px[i], track.py[i], track.pz[i]);
  g.rotation.y = track.heading(i);
  // torus lies in XY plane facing Z already; arc spans +x->-x over the top
  ctx.group.add(g);
}

// =============================================================== TOKYO
function tokyo(ctx: Ctx, def: TrackDef): ThemeInfo {
  const { track, R } = ctx;
  const ground = flatGround(ctx, "#080912", 0, 0.28, 0.5, { envMapIntensity: 1.6 });
  const winN = windowTexture(true, 11), winN2 = windowTexture(true, 29, 1);
  const mkBuild = (tex: THREE.Texture) => new THREE.MeshStandardMaterial({ color: ctx.night ? 0x101420 : 0x8a92a8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: ctx.night ? 1.25 : 0.25, map: ctx.night ? null : tex, roughness: 0.35, metalness: 0.45 });
  const mats = [mkBuild(winN), mkBuild(winN2)];
  const variants = 8;
  const buckets: Item[][] = Array.from({ length: variants }, () => []);
  const geos: THREE.BufferGeometry[] = [];
  for (let v = 0; v < variants; v++) geos.push(buildingGeo(12 + R() * 12, 70 + R() * 60, 12 + R() * 12, R));
  const spots = scatter(ctx, 330, 33, 190, { minSep: 33 });
  const signMats: THREE.MeshBasicMaterial[] = [];
  const cols = ["#ff2fd0", "#17e0ff", "#ffd21f", "#ff5a3a", "#7affc0", "#b07aff"];
  JP.forEach((txt, k) => signMats.push(new THREE.MeshBasicMaterial({ map: signTexture(txt, cols[k % cols.length]), toneMapped: false, side: THREE.DoubleSide })));
  const vSign = JP.slice(0, 5).map((txt, k) => new THREE.MeshBasicMaterial({ map: signTexture(txt, cols[(k + 2) % cols.length], "#07050c", true), toneMapped: false, side: THREE.DoubleSide }));
  const signs: THREE.Mesh[] = [];
  spots.forEach((s, n) => {
    const v = Math.floor(R() * variants);
    const sy = 0.5 + R() * 1.6;
    const ry = Math.atan2(track.tx[s.i], track.tz[s.i]);
    buckets[v].push({ x: s.x, y: ctx.groundY, z: s.z, ry, sy });
    if (n % 3 === 0) {
      const w = geos[v].boundingBox ?? (geos[v].computeBoundingBox(), geos[v].boundingBox!);
      const half = (w.max.x - w.min.x) / 2;
      const vert = R() < 0.4;
      const sg = new THREE.PlaneGeometry(vert ? 3.2 : 9, vert ? 9 : 4.8);
      const m = new THREE.Mesh(sg, vert ? vSign[n % vSign.length] : signMats[n % signMats.length]);
      m.position.set(s.x - s.side * track.nx[s.i] * (half + 0.2), ctx.groundY + 10 + R() * 40, s.z - s.side * track.nz[s.i] * (half + 0.2));
      m.rotation.y = faceRoad(ctx, s);
      ctx.group.add(m);
      signs.push(m);
    }
  });
  buckets.forEach((b, v) => {
    if (!b.length) return;
    const im = makeInst(geos[v], mats[v % 2], b);
    ctx.group.add(im);
  });
  ctx.anim.push((_d, t) => {
    signMats.forEach((m, k) => m.color.setScalar(1.25 + Math.sin(t * 2.2 + k * 1.7) * 0.25 - (Math.sin(t * 17 + k * 5) > 0.97 ? 0.9 : 0)));
    vSign.forEach((m, k) => m.color.setScalar(1.2 + Math.sin(t * 1.7 + k * 2.1) * 0.3));
  });
  // far skyline ring
  const c = centerOf(ctx);
  const far: Item[] = [];
  for (let k = 0; k < 90; k++) {
    const a = R() * Math.PI * 2, r = 800 + R() * 500;
    far.push({ x: c.x + Math.cos(a) * r, y: 0, z: c.z + Math.sin(a) * r, sx: 2 + R() * 2, sz: 2 + R() * 2, sy: 1.5 + R() * 3, ry: R() * 3 });
  }
  ctx.group.add(makeInst(geos[0], mats[0], far));
  ctx.group.add(makeInst(geos[3], mats[1], far.map((f) => ({ ...f, x: f.x * 0.9 + c.x * 0.1, z: f.z * 0.9 + c.z * 0.1 + 30, sy: f.sy! * 0.8 }))));
  // tower landmark
  const tg = new THREE.ConeGeometry(18, 300, 4, 1, true);
  tg.translate(0, 150, 0);
  const tw = new THREE.Mesh(tg, std("#ff4a2f", 0.5, 0.3, { emissive: new THREE.Color("#ff3a1f"), emissiveIntensity: 0.6, side: THREE.DoubleSide, wireframe: false }));
  tw.position.set(c.x - 420, 0, c.z + 330);
  tw.rotation.y = Math.PI / 4;
  ctx.group.add(tw);
  const tp = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }));
  tp.position.set(tw.position.x, 305, tw.position.z);
  ctx.group.add(tp);
  // street lamps
  const poles: Item[] = [], heads: Item[] = [], streaks: Item[] = [];
  for (let i = 0; i < track.N; i += 6) {
    const z = track.zoneAt(i);
    if (z) continue;
    [-1, 1].forEach((s) => {
      const o = track.wallHalf + 0.9;
      const x = track.px[i] + track.nx[i] * o * s, zz = track.pz[i] + track.nz[i] * o * s, y = track.py[i];
      poles.push({ x, y: y + 4.2, z: zz, sy: 8.4 });
      heads.push({ x: x - track.nx[i] * s * 0.9, y: y + 8.4, z: zz - track.nz[i] * s * 0.9, ry: Math.atan2(track.tx[i], track.tz[i]) });
      if (i % 12 === 0) streaks.push({ x: track.px[i] + track.nx[i] * 0 , y: y + 0.045, z: track.pz[i], ry: Math.atan2(track.tx[i], track.tz[i]) });
    });
  }
  ctx.group.add(makeInst(new THREE.BoxGeometry(0.22, 1, 0.22), std("#1b1d26", 0.6, 0.6), poles));
  ctx.group.add(makeInst(new THREE.BoxGeometry(0.8, 0.14, 1.8), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc47a").multiplyScalar(2.2), toneMapped: false }), heads));
  if (ctx.wet > 0.3) {
    const sg = new THREE.PlaneGeometry(2.4, 26);
    sg.rotateX(-Math.PI / 2);
    ctx.group.add(makeInst(sg, new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color("#ffb070"), transparent: true, opacity: 0.32 * ctx.wet, blending: THREE.AdditiveBlending, depthWrite: false }), streaks.map((s, k) => ({ ...s, x: s.x + (k % 2 ? 4 : -4) * track.nx[0] }))));
  }
  // torii gates
  [0.2, 0.45, 0.66].forEach((f) => {
    const i = Math.floor(track.N * f);
    const g = new THREE.Group();
    const red = std("#d4261c", 0.6, 0.1, { emissive: new THREE.Color("#ff2a10"), emissiveIntensity: 0.35 });
    const W = track.wallHalf + 1.6;
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 11, 10), red); p.position.set(s * W, 5.5, 0); g.add(p); });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 5, 0.9, 1.2), red); b1.position.y = 11.2; g.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.5, 0.7, 0.8), red); b2.position.y = 9; g.add(b2);
    g.position.set(track.px[i], track.py[i], track.pz[i]);
    g.rotation.y = track.heading(i);
    ctx.group.add(g);
  });
  // billboards
  [0.1, 0.38, 0.58, 0.9].forEach((f, k) => {
    const i = Math.floor(track.N * f);
    const side = k % 2 ? 1 : -1;
    const sc = animatedScreen(ctx, 28, 15.75, (g, t, W, H) => {
      const grd = g.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, `hsl(${(t * 40 + k * 90) % 360},80%,35%)`);
      grd.addColorStop(1, `hsl(${(t * 40 + k * 90 + 120) % 360},80%,18%)`);
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.fillStyle = "#fff"; g.font = "bold 90px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "#fff"; g.shadowBlur = 20;
      g.fillText(JP[(Math.floor(t / 2) + k) % JP.length], W / 2, H / 2 - 10);
      g.font = "bold 36px sans-serif"; g.fillText("TURBO MASTERS", W / 2, H - 50);
      g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect((t * 80) % W, 0, 8, H);
    });
    const o = track.wallHalf + 38;
    const x = track.px[i] + track.nx[i] * o * side, z = track.pz[i] + track.nz[i] * o * side;
    sc.position.set(x, track.py[i] + 28, z);
    sc.rotation.y = Math.atan2(-side * track.nx[i], -side * track.nz[i]);
    ctx.group.add(sc);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.5, 40, 1.5), std("#222", 0.6, 0.5));
    post.position.set(x, track.py[i] + 8, z);
    ctx.group.add(post);
  });
  void def;
  return { ground };
}

// =============================================================== MOUNTAIN
function treeGeo() {
  const parts: THREE.BufferGeometry[] = [vcol(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 5).translate(0, 1.2, 0), 0x5a3d26)];
  for (let k = 0; k < 3; k++) parts.push(vcol(new THREE.ConeGeometry(2.8 - k * 0.7, 4.2, 6).translate(0, 3.2 + k * 2.1, 0), 0x2f6a35));
  return merge(parts);
}
function mountain(ctx: Ctx, def: TrackDef): ThemeInfo {
  const { track, R } = ctx;
  const sunny = ctx.tod === "sunny";
  buildTerrain(ctx, {
    pad: 420, res: 210, falloff: 90, bridgeDepth: 45, tunnelH: 13,
    natural: (x, z) => {
      const n = fbm(x / 300 + 7, z / 300 + 3, 5);
      const ridge = 1 - Math.abs(2 * n - 1);
      return 18 + Math.pow(ridge, 2.2) * 240 + n * 40;
    },
    color: (h, sl, x, z) => {
      const v = noise2(x / 9, z / 9) * 0.12;
      if (h > 150) return [0.93 + v, 0.95 + v, 0.98];
      if (sl > 3.2) return [0.46 + v, 0.43 + v, 0.4 + v];
      if (h > 95) return [0.42 + v, 0.4 + v, 0.37 + v];
      const m = smoothstep(20, 90, h);
      return [lerp(0.3, 0.2, m) + v, lerp(0.5, 0.38, m) + v, lerp(0.2, 0.2, m)];
    },
  });
  // trees
  const tg = treeGeo();
  const spots = scatter(ctx, 1500, 20, 300, { minSep: 22 }).filter((s) => s.y < 130);
  const treeMat = vmat(0.9);
  const items: Item[] = spots.map((s) => ({ x: s.x, y: s.y - 0.4, z: s.z, ry: R() * 6, sx: 0.8 + R() * 0.9, sy: 0.8 + R() * 1.1, sz: 0.8 + R() * 0.9 }));
  ctx.group.add(makeInst(tg, treeMat, items));
  // cherry trees
  const cg = merge([vcol(new THREE.CylinderGeometry(0.3, 0.45, 3.2, 5).translate(0, 1.6, 0), 0x5a3d26), vcol(new THREE.SphereGeometry(2.6, 6, 4).translate(0, 4.4, 0), 0xffa6c4), vcol(new THREE.SphereGeometry(1.8, 6, 4).translate(1.5, 3.8, 0.8), 0xffc0d4)]);
  const cs = scatter(ctx, 150, 16, 90, { minSep: 16 }).filter((s) => s.y < 100);
  ctx.group.add(makeInst(cg, vmat(0.9), cs.map((s) => ({ x: s.x, y: s.y - 0.3, z: s.z, ry: R() * 6, sx: 0.9 + R() * 0.6, sy: 0.9 + R() * 0.6, sz: 0.9 + R() * 0.6 }))));
  // rocks
  const rg = new THREE.IcosahedronGeometry(1, 0);
  const rs = scatter(ctx, 260, 14, 200, { minSep: 14 });
  ctx.group.add(makeInst(rg, std(sunny ? "#7d786f" : "#4a4944", 1, 0, { flatShading: true }), rs.map((s) => ({ x: s.x, y: s.y + 0.2, z: s.z, ry: R() * 6, rx: R() * 3, sx: 1.5 + R() * 5, sy: 1 + R() * 4, sz: 1.5 + R() * 5 }))));
  // waterfalls
  const wfMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `varying vec2 vUv; uniform float uTime; void main(){
      float s = sin(vUv.x*38.0+sin(vUv.y*6.0+uTime*3.0)*1.5)*0.5+0.5;
      float f = fract(vUv.y*5.0 + uTime*1.6 + s*0.7);
      float a = (0.55+0.45*s)*smoothstep(0.0,0.08,vUv.x)*smoothstep(1.0,0.92,vUv.x)*(0.65+0.35*f);
      gl_FragColor = vec4(vec3(0.82,0.93,1.0), a*0.85); }`,
  });
  ctx.anim.push((_d, t) => { wfMat.uniforms.uTime.value = t; });
  [0.08, 0.34, 0.8].forEach((f, k) => {
    const i = Math.floor(track.N * f);
    let best = 1, bh = -1e9;
    [-1, 1].forEach((s) => { const h = ctx.hAt(track.px[i] + track.nx[i] * s * 70, track.pz[i] + track.nz[i] * s * 70); if (h > bh) { bh = h; best = s; } });
    const o = 62 + k * 4;
    const x = track.px[i] + track.nx[i] * best * o, z = track.pz[i] + track.nz[i] * best * o;
    const base = ctx.hAt(x, z);
    const H = 60;
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(34, H, 18, 3, 3, 1), std("#6d675d", 1, 0, { flatShading: true }));
    const dirx = -best * track.nx[i], dirz = -best * track.nz[i];
    cliff.position.set(x - dirx * 8, base + H / 2 - 4, z - dirz * 8);
    cliff.rotation.y = Math.atan2(dirx, dirz);
    ctx.group.add(cliff);
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(8, H - 2), wfMat);
    wf.position.set(x + dirx * 1.5, base + H / 2 - 5, z + dirz * 1.5);
    wf.rotation.y = Math.atan2(dirx, dirz);
    ctx.group.add(wf);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(13, 20), new THREE.MeshStandardMaterial({ color: "#3fa7c9", roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x + dirx * 9, base + 0.15, z + dirz * 9);
    ctx.group.add(pool);
  });
  // torii + lanterns
  [0.27, 0.6].forEach((f) => {
    const i = Math.floor(track.N * f);
    if (track.zoneAt(i)) return;
    const g = new THREE.Group();
    const red = std("#c8261c", 0.6, 0.1);
    const W = track.wallHalf + 1.2;
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 10, 10), red); p.position.set(s * W, 5, 0); g.add(p); });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 5, 0.9, 1.2), std("#1a1a1a", 0.6)); b1.position.y = 10.4; g.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.5, 0.7, 0.8), red); b2.position.y = 8.2; g.add(b2);
    g.position.set(track.px[i], track.py[i], track.pz[i]);
    g.rotation.y = track.heading(i);
    ctx.group.add(g);
  });
  // pagodas
  const sp = scatter(ctx, 3, 90, 200, { minSep: 80 });
  sp.forEach((s) => {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(9 - k * 1.3, 3, 9 - k * 1.3), std("#d8c9a8", 0.8));
      b.position.y = 1.5 + k * 4.2; g.add(b);
      const r = new THREE.Mesh(new THREE.ConeGeometry(8 - k * 1.1, 1.8, 4), std("#8a1f18", 0.7));
      r.position.y = 3.8 + k * 4.2; r.rotation.y = Math.PI / 4; g.add(r);
    }
    g.position.set(s.x, s.y, s.z);
    g.scale.setScalar(1.6);
    ctx.group.add(g);
  });
  void def;
  return {};
}

// =============================================================== DESERT
function desert(ctx: Ctx, def: TrackDef): ThemeInfo {
  const { track, R } = ctx;
  buildTerrain(ctx, {
    pad: 700, res: 230, falloff: 70,
    natural: (x, z) => 6 + fbm(x / 190, z / 190, 4) * 36 + Math.abs(Math.sin((x * 0.6 + z * 0.8) / 58 + fbm(x / 320, z / 320, 3) * 6)) * 10,
    color: (h, sl, x, z) => {
      const v = noise2(x / 6, z / 6) * 0.08;
      const rip = Math.sin((x * 0.8 + z * 0.5) / 3.2) * 0.02;
      const m = smoothstep(5, 45, h);
      const c: [number, number, number] = [lerp(0.86, 0.78, m) + v + rip, lerp(0.68, 0.56, m) + v + rip, lerp(0.42, 0.34, m) + v];
      if (sl > 2.6) { c[0] *= 0.8; c[1] *= 0.72; c[2] *= 0.7; }
      return c;
    },
  });
  // mesas
  const bandTex = makeCanvas(32, 128, (g, w, h) => {
    for (let y = 0; y < h; y += 4) { g.fillStyle = `hsl(${18 + Math.random() * 12},${50 + Math.random() * 20}%,${34 + Math.random() * 18}%)`; g.fillRect(0, y, w, 4); }
  });
  bandTex.wrapS = bandTex.wrapT = THREE.RepeatWrapping;
  const mg = new THREE.CylinderGeometry(0.82, 1, 1, 10, 3);
  const ms = scatter(ctx, 46, 160, 900, { minSep: 150 });
  ctx.group.add(makeInst(mg, std("#ffffff", 1, 0, { map: bandTex, flatShading: true }), ms.map((s) => { const r = 28 + R() * 60; const h = 35 + R() * 70; return { x: s.x, y: s.y - 4 + h / 2, z: s.z, sx: r, sy: h, sz: r * (0.7 + R() * 0.5), ry: R() * 3 }; })));
  // cacti
  const cactus = merge([
    vcol(new THREE.CylinderGeometry(0.45, 0.55, 5, 7).translate(0, 2.5, 0), 0x4c7a3c),
    vcol(new THREE.CylinderGeometry(0.28, 0.3, 2, 6).rotateZ(Math.PI / 2).translate(0.9, 3, 0), 0x4c7a3c),
    vcol(new THREE.CylinderGeometry(0.28, 0.3, 1.8, 6).translate(1.7, 3.9, 0), 0x4c7a3c),
    vcol(new THREE.CylinderGeometry(0.26, 0.28, 1.6, 6).rotateZ(Math.PI / 2).translate(-0.8, 2.2, 0), 0x4c7a3c),
    vcol(new THREE.CylinderGeometry(0.26, 0.28, 1.4, 6).translate(-1.5, 2.9, 0), 0x4c7a3c),
  ]);
  const cs = scatter(ctx, 260, 18, 320, { minSep: 18 });
  ctx.group.add(makeInst(cactus, vmat(0.9), cs.map((s) => ({ x: s.x, y: s.y - 0.2, z: s.z, ry: R() * 6, sx: 0.7 + R() * 0.8, sy: 0.7 + R() * 0.9, sz: 0.7 + R() * 0.8 }))));
  // rocks
  const rs = scatter(ctx, 200, 15, 400, { minSep: 15 });
  ctx.group.add(makeInst(new THREE.IcosahedronGeometry(1, 0), std("#a8825a", 1, 0, { flatShading: true }), rs.map((s) => ({ x: s.x, y: s.y + 0.3, z: s.z, ry: R() * 6, rx: R() * 3, sx: 1 + R() * 4, sy: 0.8 + R() * 3, sz: 1 + R() * 4 }))));
  // abandoned outposts
  const spots = scatter(ctx, 9, 38, 100, { minSep: 36 });
  const wood = std("#7e6246", 1, 0, { flatShading: true });
  const rust = std("#8a4a2a", 0.8, 0.4, { flatShading: true });
  spots.forEach((s, k) => {
    const g = new THREE.Group();
    if (k % 3 === 0) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 5.5), wood); body.position.y = 1.8; g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 6.4), rust); roof.position.y = 3.9; roof.rotation.z = 0.12; g.add(roof);
      const hole = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 0.2), std("#1a120c", 1)); hole.position.set(0, 1.4, 2.8); g.add(hole);
    } else if (k % 3 === 1) {
      [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 9, 5), rust); l.position.set(x, 4.5, z); l.rotation.set(z * 0.02, 0, -x * 0.02); g.add(l); });
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 4, 12), rust); tank.position.y = 11; g.add(tank);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.8, 12), rust); cone.position.y = 14; g.add(cone);
    } else {
      const car = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4.4), std("#7a3a2a", 0.9, 0.4)); car.position.y = 0.7; g.add(car);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2), std("#5a2a1e", 0.9, 0.4)); cab.position.set(0, 1.4, -0.3); g.add(cab);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: signTexture("OASIS 5 MI", "#ffb000", "#2a1a10"), side: THREE.DoubleSide }));
      sign.position.set(8, 5, 0); g.add(sign);
      [-3.5, 3.5].forEach((x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.5, 0.4), wood); p.position.set(8 + x, 2.8, 0); g.add(p); });
    }
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = Math.atan2(track.tx[s.i], track.tz[s.i]) + (R() - 0.5) * 0.6;
    ctx.group.add(g);
  });
  // power poles
  const poles: Item[] = [], wires: number[] = [];
  let prev: number[] | null = null;
  for (let i = 0; i < track.N; i += 12) {
    const o = track.wallHalf + 4;
    const x = track.px[i] + track.nx[i] * o, z = track.pz[i] + track.nz[i] * o, y = ctx.hAt(x, z);
    poles.push({ x, y: y + 5.5, z, sy: 11, ry: Math.atan2(track.tx[i], track.tz[i]) });
    const pts = [[x, y + 10.5, z], [x + track.nx[i] * 1.2, y + 10.2, z + track.nz[i] * 1.2], [x - track.nx[i] * 1.2, y + 10.2, z - track.nz[i] * 1.2]];
    if (prev) for (let k = 0; k < 3; k++) wires.push(prev[k * 3], prev[k * 3 + 1], prev[k * 3 + 2], pts[k][0], pts[k][1] - 0.6, pts[k][2]);
    prev = pts.flat();
  }
  ctx.group.add(makeInst(new THREE.BoxGeometry(0.35, 1, 0.35), wood, poles));
  const wg = new THREE.BufferGeometry();
  wg.setAttribute("position", new THREE.Float32BufferAttribute(wires, 3));
  ctx.group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x222222 })));
  void def;
  return {};
}

// =============================================================== COAST
function palmGeo() {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) parts.push(vcol(new THREE.CylinderGeometry(0.28 - k * 0.03, 0.34 - k * 0.03, 2.4, 6).rotateZ(-0.09 * k).translate(-0.12 * k * k * 0.5 - k * 0.1, 1.2 + k * 2.3, 0), 0x8a6a46));
  for (let k = 0; k < 8; k++) {
    const f = new THREE.BoxGeometry(0.9, 0.05, 4.4, 1, 1, 3);
    f.translate(0, 0, 2.2);
    f.rotateX(-0.45);
    f.rotateY((k / 8) * Math.PI * 2);
    f.translate(-1.0, 9.8, 0);
    parts.push(vcol(f, k % 2 ? 0x2f8a3a : 0x3a9a44));
  }
  parts.push(vcol(new THREE.SphereGeometry(0.4, 6, 5).translate(-1.0, 9.5, 0.2), 0x5a3a1e));
  return merge(parts);
}
function coast(ctx: Ctx, def: TrackDef): ThemeInfo {
  const { track, R } = ctx;
  buildTerrain(ctx, {
    pad: 520, res: 230, falloff: 70, bridgeDepth: 12, tunnelH: 13,
    natural: (x, z) => {
      const near = track.nearest(x, z);
      const dist = near.dist === Infinity ? 999 : near.dist;
      const hill = smoothstep(-540, -880, x) * (30 + fbm(x / 140, z / 140, 4) * 90);
      const head = Math.exp(-(((x + 250) ** 2 + (z - 300) ** 2) / (2 * 150 * 150))) * 55;
      const island = 5 - 16 * smoothstep(50, 230, dist) + fbm(x / 60, z / 60, 3) * 3;
      return Math.max(island + hill + head, -9 + fbm(x / 100, z / 100, 2) * 3);
    },
    color: (h, sl, x, z) => {
      const v = noise2(x / 8, z / 8) * 0.08;
      if (h < -0.6) return [0.16 + v, 0.5 + v, 0.55 + v];
      if (h < 2.3) return [0.92 + v, 0.82 + v, 0.6 + v];
      if (sl > 3.2) return [0.5 + v, 0.44 + v, 0.38 + v];
      if (h > 60) return [0.5 + v, 0.46 + v, 0.4];
      return [0.35 + v, 0.6 + v, 0.28];
    },
  });
  // ocean
  const water = new THREE.ShaderMaterial({
    transparent: true, fog: false,
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(ctx.tod === "night" ? "#06142a" : "#0a6aa8") }, uShallow: { value: new THREE.Color(ctx.tod === "night" ? "#0c2a40" : "#33d1d0") }, uSun: { value: new THREE.Vector3(-0.85, 0.2, 0.5).normalize() }, uFog: { value: new THREE.Color("#f5a070") }, uFogD: { value: 0.0011 }, uSunCol: { value: new THREE.Color("#ffb070") } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
    fragmentShader: `varying vec3 vW; uniform float uTime; uniform vec3 uDeep,uShallow,uSun,uFog,uSunCol; uniform float uFogD;
      void main(){
        vec2 p = vW.xz*0.06;
        float w1 = sin(p.x*3.0+uTime*0.8+sin(p.y*2.0)), w2 = sin(p.y*4.0-uTime*1.1+sin(p.x*3.0));
        vec3 n = normalize(vec3(w1*0.12+w2*0.07, 1.0, w2*0.12+w1*0.05));
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0-max(dot(n,v),0.0),3.0);
        vec3 col = mix(uShallow, uDeep, clamp(length(vW.xz-cameraPosition.xz)/700.0,0.0,1.0));
        vec3 r = reflect(-v,n);
        float spec = pow(max(dot(r,uSun),0.0),160.0)*3.0 + pow(max(dot(r,uSun),0.0),12.0)*0.25;
        col = mix(col, uFog, fres*0.55) + uSunCol*spec;
        float foam = smoothstep(0.93,1.0,sin(w1*3.0+w2*2.0)*0.5+0.5)*0.15;
        col += foam;
        float d = length(vW-cameraPosition);
        float f = 1.0-exp(-uFogD*uFogD*d*d);
        gl_FragColor = vec4(mix(col,uFog,f), 0.93);
      }`,
  });
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), water);
  wm.position.y = -0.5;
  ctx.group.add(wm);
  ctx.anim.push((_d, t) => { water.uniforms.uTime.value = t; });
  if (ctx.tod === "sunny") { water.uniforms.uSun.value.set(0.5, 0.75, 0.35).normalize(); water.uniforms.uFog.value.set("#cfe6f8"); water.uniforms.uSunCol.value.set("#fff1d6"); }
  if (ctx.tod === "night") { water.uniforms.uSun.value.set(0.3, 0.7, 0.25).normalize(); water.uniforms.uFog.value.set("#0d0f2c"); water.uniforms.uSunCol.value.set("#8aa0ff"); water.uniforms.uFogD.value = 0.0015; }
  // palms
  const pg = palmGeo();
  const ps = scatter(ctx, 520, 13, 70, { minSep: 13 }).filter((s) => s.y > 0.9 && s.y < 14);
  ctx.group.add(makeInst(pg, vmat(0.9), ps.map((s) => ({ x: s.x, y: s.y - 0.2, z: s.z, ry: R() * 6, sx: 0.8 + R() * 0.5, sy: 0.7 + R() * 0.6, sz: 0.8 + R() * 0.5 }))));
  // bushes + rocks
  const bs = scatter(ctx, 300, 12, 160, { minSep: 12 }).filter((s) => s.y > 1);
  ctx.group.add(makeInst(new THREE.IcosahedronGeometry(1, 0), std("#ffffff", 1, 0, { flatShading: true }), bs.map((s) => ({ x: s.x, y: s.y + 0.3, z: s.z, sx: 1 + R() * 1.6, sy: 0.7 + R() * 0.8, sz: 1 + R() * 1.6, color: R() < 0.5 ? 0x3d7a34 : 0x5a8a3a })), true));
  const rs = scatter(ctx, 120, 14, 200, { minSep: 14 });
  ctx.group.add(makeInst(new THREE.IcosahedronGeometry(1, 0), std("#8a8378", 1, 0, { flatShading: true }), rs.map((s) => ({ x: s.x, y: Math.max(s.y, -1) + 0.2, z: s.z, ry: R() * 6, sx: 1 + R() * 4, sy: 1 + R() * 3, sz: 1 + R() * 4 }))));
  // umbrellas
  const us = scatter(ctx, 26, 16, 40, { minSep: 16 }).filter((s) => s.y > 0.9 && s.y < 3);
  us.forEach((s) => {
    const g = new THREE.Group();
    const col = ["#ff4a4a", "#ffd21f", "#2fb7ff", "#ff7ad0", "#ffffff"][Math.floor(R() * 5)];
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), std("#e8e8e8")); pole.position.y = 1.3; g.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.7, 8), std(col, 0.7)); top.position.y = 2.7; g.add(top);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 2.2), std(col, 0.9)); towel.position.set(1.4, 0.05, 0.4); g.add(towel);
    g.position.set(s.x, s.y, s.z);
    ctx.group.add(g);
  });
  // lighthouse
  {
    const x = -250 - 60, z = 300 + 150;
    const y = ctx.hAt(x, z);
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(3.4 - k * 0.3, 3.8 - k * 0.3, 6, 12), std(k % 2 ? "#d4261c" : "#f4f4f4", 0.7)); c.position.y = 3 + k * 6; g.add(c); }
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff2b0").multiplyScalar(2), toneMapped: false })); lamp.position.y = 32; g.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3, 10), std("#222")); cap.position.y = 35; g.add(cap);
    g.position.set(x, y, z);
    g.scale.setScalar(1.5);
    ctx.group.add(g);
  }
  void def;
  return {};
}

// =============================================================== CYBER
function cyber(ctx: Ctx, def: TrackDef): ThemeInfo {
  const { track, R } = ctx;
  const gridTex = makeCanvas(128, 128, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.strokeStyle = def.accent; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
    g.strokeStyle = "rgba(122,43,255,0.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  });
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(220, 220);
  const ground = flatGround(ctx, "#05060e", 0, 0.35, 0.6, { emissive: new THREE.Color(1, 1, 1), emissiveMap: gridTex, emissiveIntensity: 0.55 });
  const c = centerOf(ctx);
  // stadium wall
  const wallTex = makeCanvas(1024, 128, (g, w, h) => {
    g.fillStyle = "#0a0c1a"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = `hsl(${Math.random() > 0.5 ? 190 : 280},90%,${50 + Math.random() * 30}%)`; g.fillRect(Math.random() * w, 20 + Math.random() * (h - 30), 3, 3); }
    g.fillStyle = def.accent; g.fillRect(0, h - 10, w, 4); g.fillStyle = def.accent2; g.fillRect(0, 8, w, 3);
  });
  wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(3, 1);
  const wallCyl = new THREE.Mesh(new THREE.CylinderGeometry(560, 560, 110, 72, 1, true), new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
  wallCyl.position.set(c.x, 55, c.z);
  ctx.group.add(wallCyl);
  // stands
  const crowd = crowdTexture();
  crowd.repeat.set(3, 1);
  const standMat = new THREE.MeshStandardMaterial({ color: 0x151833, emissive: 0xffffff, emissiveMap: crowd, emissiveIntensity: 0.9, roughness: 0.6 });
  const tiers: Item[][] = [[], [], []];
  const ranges: [number, number, number][] = [[0, 0.16, 0], [0.42, 0.56, 1], [0.7, 0.8, -1], [0.18, 0.3, 1]];
  ranges.forEach(([a, b, sd]) => {
    for (let i = Math.floor(track.N * a); i < track.N * b; i += 4) {
      [-1, 1].forEach((s) => {
        if (sd !== 0 && s !== sd) return;
        for (let t = 0; t < 3; t++) {
          const o = track.wallHalf + 6 + t * 3.4;
          tiers[t].push({ x: track.px[i] + track.nx[i] * o * s, y: 0, z: track.pz[i] + track.nz[i] * o * s, ry: Math.atan2(track.tx[i], track.tz[i]) });
        }
      });
    }
  });
  tiers.forEach((it, t) => { const g = new THREE.BoxGeometry(3.4, 2.4 + t * 2.2, 17); g.translate(0, (2.4 + t * 2.2) / 2, 0); ctx.group.add(makeInst(g, standMat, it)); });
  // floodlight towers & lasers
  const fl = scatter(ctx, 16, 45, 110, { minSep: 40 });
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.accent).multiplyScalar(0.7), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const lasers: THREE.Mesh[] = [];
  fl.forEach((s, k) => {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(1.2, 44, 1.2), std("#1b1f35", 0.6, 0.6)); pole.position.set(s.x, 22, s.z); ctx.group.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(k % 2 ? def.accent : def.accent2).multiplyScalar(2.2), toneMapped: false }));
    panel.position.set(s.x, 45, s.z); panel.rotation.y = faceRoad(ctx, s); ctx.group.add(panel);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(14, 90, 14, 1, true).translate(0, -45, 0), beamMat); cone.position.set(s.x, 45, s.z);
    cone.rotation.set((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3); ctx.group.add(cone);
    if (k % 2 === 0) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 400, 5).translate(0, 200, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(k % 4 ? def.accent2 : "#ff2fd0").multiplyScalar(2), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      l.position.set(s.x, 46, s.z); l.userData.k = k; ctx.group.add(l); lasers.push(l);
    }
  });
  ctx.anim.push((_d, t) => lasers.forEach((l) => { const k = l.userData.k; l.rotation.z = Math.sin(t * 0.7 + k) * 0.9; l.rotation.x = Math.cos(t * 0.5 + k * 2) * 0.9; }));
  // holo arches
  [0.0, 0.14, 0.34, 0.5, 0.68, 0.84].forEach((f, k) => holoArch(ctx, Math.floor(track.N * f) % track.N, k % 2 ? def.accent2 : def.accent));
  // screens
  [0.07, 0.5].forEach((f, k) => {
    const i = Math.floor(track.N * f);
    const sc = animatedScreen(ctx, 40, 15, (g, t, W, H) => {
      g.fillStyle = "#05060e"; g.fillRect(0, 0, W, H);
      for (let b = 0; b < 24; b++) { const hh = (Math.sin(t * 3 + b * 0.6) * 0.5 + 0.5) * H * 0.7; g.fillStyle = `hsl(${180 + b * 6},90%,55%)`; g.fillRect(b * (W / 24) + 3, H - hh - 8, W / 24 - 6, hh); }
      g.fillStyle = "#fff"; g.font = "bold 60px sans-serif"; g.textAlign = "center"; g.fillText(k ? "CYBER CIRCUIT" : "TURBO MASTERS", W / 2, 70);
    }, 0.12);
    const s = -1, o = track.wallHalf + 24;
    sc.position.set(track.px[i] + track.nx[i] * o * s, 16, track.pz[i] + track.nz[i] * o * s);
    sc.rotation.y = Math.atan2(-s * track.nx[i], -s * track.nz[i]);
    ctx.group.add(sc);
  });
  void R;
  return { ground };
}

// =============================================================== SKYLINE
function skyline(ctx: Ctx, def: TrackDef): ThemeInfo {
  const { track, R } = ctx;
  const base = -48;
  const ground = flatGround(ctx, ctx.tod === "night" ? "#20244a" : "#ffb8a0", base, 1, 0, { emissive: new THREE.Color(ctx.tod === "night" ? "#10143a" : "#ff9a80"), emissiveIntensity: 0.35 });
  const win = windowTexture(ctx.tod === "night", 41, 1);
  const win2 = windowTexture(ctx.tod === "night", 77);
  const mk = (tex: THREE.Texture) => new THREE.MeshStandardMaterial({ color: ctx.tod === "night" ? 0x12162a : 0x6a6f92, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: ctx.tod === "night" ? 1.2 : 0.55, roughness: 0.3, metalness: 0.5 });
  const mats = [mk(win), mk(win2)];
  const geos: THREE.BufferGeometry[] = [];
  for (let v = 0; v < 8; v++) geos.push(buildingGeo(18 + R() * 28, 100, 18 + R() * 28, R));
  const buckets: Item[][] = Array.from({ length: 8 }, () => []);
  const c = centerOf(ctx);
  let placed = 0, tries = 0;
  while (placed < 520 && tries < 4000) {
    tries++;
    const x = c.x + (R() - 0.5) * 2600, z = c.z + (R() - 0.5) * 2600;
    const near = track.nearest(x, z);
    const dist = near.dist === Infinity ? 999 : near.dist;
    if (dist < 34) continue;
    const roadY = near.idx >= 0 ? track.py[near.idx] : 80;
    let top = base + 60 + R() * R() * 380 + (dist > 250 ? 60 : 0);
    if (dist < 90) top = Math.min(top, roadY - 10 - R() * 20);
    if (top < base + 30) continue;
    buckets[Math.floor(R() * 8)].push({ x, y: base, z, ry: R() < 0.5 ? 0 : Math.PI / 2, sy: (top - base) / 100 });
    placed++;
  }
  buckets.forEach((b, v) => b.length && ctx.group.add(makeInst(geos[v], mats[v % 2], b)));
  // gates
  [0.05, 0.22, 0.42, 0.6, 0.82].forEach((f, k) => { const i = Math.floor(track.N * f); if (!track.zoneAt(i)) holoArch(ctx, i, k % 2 ? def.accent : def.accent2); });
  // drones
  const drones: Item[] = [];
  for (let k = 0; k < 44; k++) { const a = R() * 6.28, r = 150 + R() * 700; drones.push({ x: c.x + Math.cos(a) * r, y: 40 + R() * 150, z: c.z + Math.sin(a) * r, sx: 1, sy: 1, sz: 1, ry: a }); }
  const dm = makeInst(new THREE.BoxGeometry(2, 0.6, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd21f").multiplyScalar(2.4), toneMapped: false }), drones);
  ctx.group.add(dm);
  const dd = new THREE.Object3D();
  ctx.anim.push((_dt, t) => { drones.forEach((d, k) => { dd.position.set(d.x + Math.cos(t * 0.15 + k) * 40, d.y + Math.sin(t * 0.7 + k * 3) * 3, d.z + Math.sin(t * 0.15 + k) * 40); dd.updateMatrix(); dm.setMatrixAt(k, dd.matrix); }); dm.instanceMatrix.needsUpdate = true; });
  // airships
  [[500, 140, 200], [-1300, 190, -300]].forEach((p, k) => {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10).scale(60, 16, 16), std("#cfd2e8", 0.5, 0.2)); g.add(hull);
    const lt = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(k ? def.accent : "#ffd21f").multiplyScalar(2.4), toneMapped: false })); lt.position.set(0, -14, 0); g.add(lt);
    const bar = animatedScreen(ctx, 70, 8, (gg, t, W, H) => { gg.fillStyle = "#06060e"; gg.fillRect(0, 0, W, H); gg.fillStyle = k ? "#ff4fe0" : "#ffd21f"; gg.font = "bold 50px sans-serif"; gg.textAlign = "center"; gg.fillText("SKYLINE EXPRESS ▸▸", ((t * 60) % (W * 2)) - W * 0.5, H * 0.75); }, 0.1);
    bar.position.set(0, 0, 16); g.add(bar);
    g.position.set(c.x + p[0], p[1], c.z + p[2]);
    ctx.anim.push((_d, t) => { g.position.x = c.x + p[0] + Math.sin(t * 0.03 + k) * 120; });
    ctx.group.add(g);
  });
  // floating holograms
  [0.12, 0.5, 0.74].forEach((f, k) => {
    const i = Math.floor(track.N * f);
    const sc = animatedScreen(ctx, 26, 14, (g, t, W, H) => {
      const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, "#1a0840"); grd.addColorStop(1, "#ff2fb0"); g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.fillStyle = "#fff"; g.font = "bold 80px sans-serif"; g.textAlign = "center"; g.fillText(["未来", "速度", "空"][k], W / 2, H / 2 + Math.sin(t * 2) * 8);
      g.font = "bold 30px sans-serif"; g.fillText("SKYLINE", W / 2, H - 30);
    }, 0.3);
    const s = k % 2 ? 1 : -1, o = track.wallHalf + 40;
    sc.position.set(track.px[i] + track.nx[i] * o * s, track.py[i] + 22, track.pz[i] + track.nz[i] * o * s);
    sc.rotation.y = Math.atan2(-s * track.nx[i], -s * track.nz[i]);
    ctx.group.add(sc);
  });
  void noiseColorTexture;
  return { ground };
}

export function buildTheme(theme: TrackDef["theme"], ctx: Ctx): ThemeInfo {
  const def = { tokyo: 0, mountain: 0, desert: 0, coast: 0, cyber: 0, skyline: 0 };
  void def;
  const d = ctx.track.def;
  switch (theme) {
    case "tokyo": return tokyo(ctx, d);
    case "mountain": return mountain(ctx, d);
    case "desert": return desert(ctx, d);
    case "coast": return coast(ctx, d);
    case "cyber": return cyber(ctx, d);
    default: return skyline(ctx, d);
  }
}
