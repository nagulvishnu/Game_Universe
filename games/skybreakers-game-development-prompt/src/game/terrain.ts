// Imperative world rendering: island meshes, decor instancing, ponds, rivers, lava, waterfalls, bridges, storm barriers, far islands, clouds.
import * as THREE from 'three';
import { cloudTex, glow } from './gfx';
import { GLOW_KINDS, decorGeo } from './models2';
import { BRIDGES, ISLANDS, PALETTE, WORLD, bridgeSag, fbm, mulberry, radiusAt, terrainH, type IslandDef } from './world';
import { useStore } from './store';

export const timeU = { value: 0 };
const flowVS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const flowFS = `uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uSpeed; uniform float uAlpha; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
void main(){ float t=uTime*uSpeed; float a=n(vec2(vUv.x*6.0, vUv.y*14.0 - t)); float b=n(vec2(vUv.x*14.0+3.0, vUv.y*30.0 - t*1.7)); float k=smoothstep(0.35,0.8,a*0.6+b*0.5); vec3 c=mix(uA,uB,k); float edge=smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x); gl_FragColor=vec4(c, uAlpha*edge); }`;
const flowMat = (a: string, b: string, speed: number, alpha: number) => new THREE.ShaderMaterial({ vertexShader: flowVS, fragmentShader: flowFS, uniforms: { uTime: timeU, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uSpeed: { value: speed }, uAlpha: { value: alpha } }, transparent: true, side: THREE.DoubleSide, depthWrite: false });
const fallFS = `uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
void main(){ float s=n(vec2(vUv.x*8.0, vUv.y*26.0 + uTime*5.0)); float s2=n(vec2(vUv.x*20.0, vUv.y*60.0 + uTime*9.0)); float k=s*0.6+s2*0.5; vec3 c=mix(uA,uB,k); float a=(0.35+0.65*k)*smoothstep(0.0,0.08,vUv.x)*smoothstep(1.0,0.92,vUv.x)*smoothstep(0.0,0.35,vUv.y)*(1.0-smoothstep(0.75,1.0,1.0-vUv.y)*0.0); gl_FragColor=vec4(c,a*0.9); }`;

export interface WorldRig { group: THREE.Group; update: (dt: number, cam: THREE.Vector3) => void; clouds: THREE.Sprite[]; cloudMat: THREE.SpriteMaterial; barriers: { isl: IslandDef; mesh: THREE.Mesh }[]; whales: THREE.Group[]; falls: THREE.Mesh[] }

function colorLerp(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) { return out.copy(a).lerp(b, t); }
function buildIslandMesh(isl: IslandDef, quality: string, far = false) {
  const g = new THREE.Group(); const rings = far ? 16 : quality === 'low' ? 30 : 46, segs = far ? 40 : quality === 'low' ? 80 : 120; const pal = PALETTE[isl.biome];
  const top = new THREE.BufferGeometry(); const n = 1 + rings * segs; const pos = new Float32Array(n * 3); const col = new Float32Array(n * 3); const idx: number[] = [];
  const ca = new THREE.Color(pal.top[0]), cb = new THREE.Color(pal.top[1]), rock = new THREE.Color(pal.rock), under = new THREE.Color(pal.under); const tmp = new THREE.Color(); const sand = new THREE.Color('#d8c890');
  const set = (i: number, x: number, y: number, z: number) => { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; };
  set(0, isl.x, terrainH(isl, isl.x, isl.z), isl.z);
  const edgeY: number[] = [];
  for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) { const a = (s / segs) * Math.PI * 2; const R = radiusAt(isl, a); const u = Math.min(0.9995, r / rings); const x = isl.x + Math.cos(a) * u * R, z = isl.z + Math.sin(a) * u * R; const y = terrainH(isl, x, z); set(1 + (r - 1) * segs + s, x, y === y ? y : isl.y, z); if (r === rings) edgeY.push(y); }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) { const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + ((s + 1) % segs), c = 1 + r * segs + s, d = 1 + r * segs + ((s + 1) % segs); idx.push(a, b, c, b, d, c); }
  top.setAttribute('position', new THREE.BufferAttribute(pos, 3)); top.setIndex(idx); top.computeVertexNormals(); const nor = top.attributes.normal.array as Float32Array;
  for (let i = 0; i < n; i++) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; const nn = fbm(x * 0.06, z * 0.06, isl.seed + 3); colorLerp(ca, cb, nn, tmp); const slope = 1 - nor[i * 3 + 1]; const d = Math.hypot(x - isl.x, z - isl.z); const ang = Math.atan2(z - isl.z, x - isl.x); const u = d / radiusAt(isl, ang);
    if (isl.biome === 'emerald' && y - isl.y < -0.9 + (isl.pond ? isl.pond.h! - 0 : 0) + 0.8 && isl.pond && Math.hypot(x - isl.x - isl.pond.x, z - isl.z - isl.pond.z) < isl.pond.r * 1.5) tmp.lerp(sand, 0.8);
    if (isl.biome === 'ember') { const v = fbm(x * 0.15, z * 0.15, 4); if (v > 0.62) tmp.lerp(new THREE.Color('#c2441a'), (v - 0.62) * 3); }
    if (isl.biome === 'frost' && y - isl.y > 14) tmp.lerp(new THREE.Color('#ffffff'), 0.7);
    if (isl.biome === 'ruins' && nn > 0.55) tmp.lerp(new THREE.Color('#e4d9a8'), 0.5);
    const sl = Math.min(1, Math.max(0, (slope - 0.18) * 3.2)); tmp.lerp(rock, sl); tmp.lerp(under, Math.max(0, (u - 0.9) * 8)); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
  top.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mTop = new THREE.Mesh(top, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); mTop.receiveShadow = quality !== 'low' && !far; g.add(mTop);
  // underside rocks
  const ur = far ? 8 : 14; const un = 1 + ur * segs; const up = new Float32Array(un * 3), uc = new Float32Array(un * 3); const uidx: number[] = []; const depth = isl.r * (isl.minor ? 1.5 : 1.0);
  for (let k = 1; k <= ur; k++) for (let s = 0; s < segs; s++) { const a = (s / segs) * Math.PI * 2; const R = radiusAt(isl, a); const sf = k / ur; const rr = R * (1 - Math.pow(sf, 0.9)) * 0.995; const jag = 0.75 + 0.5 * fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + sf * 3, isl.seed + 9); const y = edgeY[s] - depth * Math.pow(sf, 0.75) * jag - 1; const i = (k - 1) * segs + s; up[i * 3] = isl.x + Math.cos(a) * rr; up[i * 3 + 1] = y; up[i * 3 + 2] = isl.z + Math.sin(a) * rr;
    colorLerp(under, rock, Math.min(1, sf * 1.2 + fbm(a * 3, sf * 4, 2) * 0.3), tmp); if (isl.biome === 'emerald' && sf < 0.12) tmp.lerp(new THREE.Color('#4a8a3a'), 0.6); if (isl.biome === 'celestial' && fbm(a * 6, sf * 8, 7) > 0.6) tmp.lerp(new THREE.Color('#ffe9a0'), 0.7); uc[i * 3] = tmp.r; uc[i * 3 + 1] = tmp.g; uc[i * 3 + 2] = tmp.b; }
  const tip = ur * segs; up[tip * 3] = isl.x; up[tip * 3 + 1] = Math.min(...edgeY) - depth * 1.02; up[tip * 3 + 2] = isl.z; colorLerp(under, rock, 1, tmp); uc[tip * 3] = tmp.r; uc[tip * 3 + 1] = tmp.g; uc[tip * 3 + 2] = tmp.b;
  // first ring connects to top edge ring
  const topEdgeBase = 1 + (rings - 1) * segs;
  for (let s = 0; s < segs; s++) { const s2 = (s + 1) % segs; uidx.push(topEdgeBase + s, topEdgeBase + s2, s, topEdgeBase + s2, s2, s); }
  for (let k = 1; k < ur; k++) for (let s = 0; s < segs; s++) { const a = (k - 1) * segs + s, b = (k - 1) * segs + ((s + 1) % segs), c = k * segs + s, d = k * segs + ((s + 1) % segs); uidx.push(a, c, b, b, c, d); }
  for (let s = 0; s < segs; s++) uidx.push((ur - 1) * segs + s, tip, (ur - 1) * segs + ((s + 1) % segs));
  // underside geometry needs the top edge ring vertices too: build combined buffer
  const total = un + segs; const cp = new Float32Array(total * 3), cc = new Float32Array(total * 3); cp.set(up, 0); cc.set(uc, 0);
  for (let s = 0; s < segs; s++) { const sidx = topEdgeBase + s; cp[(un + s) * 3] = pos[sidx * 3]; cp[(un + s) * 3 + 1] = pos[sidx * 3 + 1]; cp[(un + s) * 3 + 2] = pos[sidx * 3 + 2]; cc[(un + s) * 3] = under.r; cc[(un + s) * 3 + 1] = under.g; cc[(un + s) * 3 + 2] = under.b; }
  const fidx: number[] = []; for (let s = 0; s < segs; s++) { const s2 = (s + 1) % segs; fidx.push(un + s, s, un + s2, un + s2, s, s2); }
  for (let k = 1; k < ur; k++) for (let s = 0; s < segs; s++) { const a = (k - 1) * segs + s, b = (k - 1) * segs + ((s + 1) % segs), c = k * segs + s, d = k * segs + ((s + 1) % segs); fidx.push(a, c, b, b, c, d); }
  for (let s = 0; s < segs; s++) fidx.push((ur - 1) * segs + s, tip, (ur - 1) * segs + ((s + 1) % segs));
  void uidx;
  const ug = new THREE.BufferGeometry(); ug.setAttribute('position', new THREE.BufferAttribute(cp, 3)); ug.setAttribute('color', new THREE.BufferAttribute(cc, 3)); ug.setIndex(fidx); ug.computeVertexNormals();
  g.add(new THREE.Mesh(ug, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide })));
  // hanging rocks
  const rnd = mulberry(isl.seed * 77); const rm = new THREE.MeshStandardMaterial({ color: pal.under, flatShading: true, roughness: 1 });
  for (let i = 0; i < (far ? 3 : isl.minor ? 4 : 9); i++) { const a = rnd() * 6.28, d = isl.r * (0.9 + rnd() * 0.5); const s = 2 + rnd() * isl.r * 0.1; const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rm); m.scale.y = 1.4; m.position.set(isl.x + Math.cos(a) * d, isl.y - isl.r * (0.1 + rnd() * 0.9) + 5, isl.z + Math.sin(a) * d); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); (m.userData as any).by = m.position.y; (m.userData as any).ph = rnd() * 6; g.add(m); }
  return g;
}

export function buildWorld(quality: 'low' | 'medium' | 'high'): WorldRig {
  const group = new THREE.Group(); const dens = quality === 'low' ? 0.45 : quality === 'medium' ? 0.75 : 1;
  const bobbing: THREE.Mesh[] = [];
  for (const isl of ISLANDS) { const m = buildIslandMesh(isl, quality); m.children.forEach(c => { if ((c.userData as any).by !== undefined) bobbing.push(c as THREE.Mesh); }); group.add(m); }
  // far decorative islands
  const rnd = mulberry(4242); const biomes: IslandDef['biome'][] = ['emerald', 'frost', 'ruins', 'ember', 'celestial', 'shadow'];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28 + rnd() * 0.3; const d = 900 + rnd() * 500; const r = 40 + rnd() * 70; const isl: IslandDef = { id: 'far' + i, name: '', biome: biomes[i % 6], x: Math.cos(a) * d + 100, y: -60 + rnd() * 320, z: Math.sin(a) * d + 150, r, minLevel: 99, amp: 5 + rnd() * 6, seed: 200 + i, flats: [], rivers: [], falls: [], blurb: '', minor: true }; const m = buildIslandMesh(isl, quality, true); group.add(m);
    const dm = new THREE.InstancedMesh(decorGeo(isl.biome === 'frost' ? 'snowpine' : isl.biome === 'ember' ? 'lavarock' : isl.biome === 'shadow' ? 'dead' : isl.biome === 'celestial' ? 'crystaltree' : 'oak'), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }), 40); const M = new THREE.Matrix4(); let c = 0; for (let k = 0; k < 40; k++) { const aa = rnd() * 6.28, uu = Math.sqrt(rnd()) * 0.85; const x = isl.x + Math.cos(aa) * uu * radiusAt(isl, aa), z = isl.z + Math.sin(aa) * uu * radiusAt(isl, aa); const y = terrainH(isl, x, z); if (y !== y) continue; const s = 1.4 + rnd() * 1.6; M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); dm.setMatrixAt(c++, M); } dm.count = c; group.add(dm); }
  // decor instancing
  const byKind = new Map<string, typeof WORLD.decor>(); for (const d of WORLD.decor) { if (dens < 1 && ['flower', 'bush', 'rock', 'icerock', 'lavarock'].includes(d.k) && Math.random() > dens) continue; if (!byKind.has(d.k)) byKind.set(d.k, []); byKind.get(d.k)!.push(d); }
  const stdMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }); const basicMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  for (const [k, list] of byKind) { const im = new THREE.InstancedMesh(decorGeo(k), GLOW_KINDS.includes(k) ? basicMat : stdMat, list.length); list.forEach((d, i) => { E.set(0, d.rot, 0); Q.setFromEuler(E); M.compose(new THREE.Vector3(d.x, d.y - 0.1, d.z), Q, new THREE.Vector3(d.s, d.s, d.s)); im.setMatrixAt(i, M); }); im.castShadow = quality === 'high' && ['oak', 'pine', 'snowpine', 'dead', 'pillar'].includes(k); im.frustumCulled = false; group.add(im); }
  // ponds
  const waterMat = new THREE.MeshStandardMaterial({ color: '#3a9ad8', transparent: true, opacity: 0.78, roughness: 0.1, metalness: 0.3, emissive: '#1a5a9a', emissiveIntensity: 0.3 });
  for (const w of WORLD.pondWater) { const m = new THREE.Mesh(new THREE.CircleGeometry(w.r, 40), waterMat); m.rotation.x = -Math.PI / 2; m.position.set(w.x, w.y, w.z); group.add(m); }
  // rivers & lava
  for (const isl of ISLANDS) for (const rv of isl.rivers) { const pts = rv.pts; const N = pts.length; const pos: number[] = [], uv: number[] = [], idx: number[] = []; const wd = rv.w * (rv.kind === 'lava' ? 1.3 : 1.2);
    const dense: [number, number][] = []; for (let i = 0; i < N - 1; i++) for (let k = 0; k < 4; k++) dense.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / 4, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / 4]); dense.push(pts[N - 1]);
    dense.forEach((p, i) => { const nx = dense[Math.min(dense.length - 1, i + 1)], pv = dense[Math.max(0, i - 1)]; const dx = nx[0] - pv[0], dz = nx[1] - pv[1]; const l = Math.hypot(dx, dz) || 1; const px = -dz / l, pz = dx / l; for (const s of [-1, 1]) { const x = isl.x + p[0] + px * wd * s, z = isl.z + p[1] + pz * wd * s; const y = (terrainH(isl, isl.x + p[0], isl.z + p[1]) || isl.y) + (rv.kind === 'lava' ? 0.25 : 0.4); pos.push(x, y, z); uv.push(s < 0 ? 0 : 1, i / 3); } if (i < dense.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); const m = new THREE.Mesh(geo, rv.kind === 'lava' ? flowMat('#ff4a0a', '#ffd23a', 0.6, 1) : flowMat('#2a86d0', '#bfe8ff', 1.4, 0.85)); m.renderOrder = 1; group.add(m);
    if (rv.kind === 'lava') { const l = glow('#ff6a1a', 40, [isl.x + pts[1][0], isl.y + 8, isl.z + pts[1][1]], 0.25); group.add(l); } }
  // waterfalls
  const falls: THREE.Mesh[] = [];
  for (const f of WORLD.falls) { const H = 160; const geo = new THREE.PlaneGeometry(f.w * 1.6, H); const mat = new THREE.ShaderMaterial({ vertexShader: flowVS, fragmentShader: fallFS, uniforms: { uTime: timeU, uA: { value: new THREE.Color(f.color) }, uB: { value: new THREE.Color('#ffffff') } }, transparent: true, side: THREE.DoubleSide, depthWrite: false }); const m = new THREE.Mesh(geo, mat); const ox = Math.cos(f.ang), oz = Math.sin(f.ang); m.position.set(f.x + ox * 1.5, f.y - H / 2 + 1, f.z + oz * 1.5); m.rotation.y = Math.PI / 2 - f.ang; m.renderOrder = 2; group.add(m); falls.push(m);
    const isl = ISLANDS.find(i => i.id === f.isl)!; const mist = glow(f.color, 60, [f.x + ox * 4, f.y - H + 10 - isl.r * 0.9, f.z + oz * 4], 0.35); group.add(mist); group.add(glow('#ffffff', 14, [f.x + ox * 2, f.y + 0.5, f.z + oz * 2], 0.4)); }
  // bridges
  for (const b of BRIDGES) { const n = Math.ceil(b.len / 1.3); const dir = new THREE.Vector3(b.b[0] - b.a[0], 0, b.b[2] - b.a[2]).normalize(); const yaw = Math.atan2(dir.x, dir.z);
    const plank = new THREE.InstancedMesh(new THREE.BoxGeometry(b.w, 0.22, 1.05), b.magic ? new THREE.MeshStandardMaterial({ color: '#fff4c8', emissive: '#ffd070', emissiveIntensity: 0.9, transparent: true, opacity: 0.88 }) : new THREE.MeshStandardMaterial({ color: '#8a5a34', flatShading: true }), n);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const y = b.a[1] + (b.b[1] - b.a[1]) * t + bridgeSag(t, b.len) - 0.12; M.compose(new THREE.Vector3(b.a[0] + (b.b[0] - b.a[0]) * t, y, b.a[2] + (b.b[2] - b.a[2]) * t), Q.setFromEuler(E.set(0, yaw, 0)), new THREE.Vector3(1, 1, 1)); plank.setMatrixAt(i, M); } group.add(plank);
    const rail = b.magic ? new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }) : new THREE.MeshStandardMaterial({ color: '#5a3a22', flatShading: true }); const side = new THREE.Vector3(dir.z, 0, -dir.x);
    for (const s of [-1, 1]) { const posts = Math.ceil(b.len / 3); const prev = new THREE.Vector3(); for (let i = 0; i <= posts; i++) { const t = i / posts; const y = b.a[1] + (b.b[1] - b.a[1]) * t + bridgeSag(t, b.len); const px = b.a[0] + (b.b[0] - b.a[0]) * t + side.x * b.w * 0.5 * s, pz = b.a[2] + (b.b[2] - b.a[2]) * t + side.z * b.w * 0.5 * s; const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), rail); post.position.set(px, y + 0.7, pz); group.add(post); if (b.magic) group.add(glow('#ffe9a0', 2.5, [px, y + 1.5, pz], 0.6)); const cur = new THREE.Vector3(px, y + 1.3, pz); if (i > 0) { const len = cur.distanceTo(prev); const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), rail); r.position.copy(prev).add(cur).multiplyScalar(0.5); r.lookAt(cur); group.add(r); } prev.copy(cur); } } }
  // barriers
  const barriers: WorldRig['barriers'] = []; const barMat = new THREE.ShaderMaterial({ vertexShader: flowVS, fragmentShader: flowFS, uniforms: { uTime: timeU, uA: { value: new THREE.Color('#3a1a7a') }, uB: { value: new THREE.Color('#c8a0ff') }, uSpeed: { value: 0.5 }, uAlpha: { value: 0.32 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  for (const isl of ISLANDS) { if (isl.minLevel <= 1) continue; const R = isl.r * 1.22 + 30; const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 340, 48, 1, true), barMat); m.position.set(isl.x, isl.y + 80, isl.z); m.renderOrder = 3; group.add(m); barriers.push({ isl, mesh: m }); }
  // clouds
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex(), transparent: true, depthWrite: false, opacity: 0.85, fog: false }); const clouds: THREE.Sprite[] = []; const cn = quality === 'low' ? 70 : quality === 'medium' ? 130 : 190; const cr = mulberry(99);
  for (let i = 0; i < cn; i++) { const s = new THREE.Sprite(cloudMat); const sea = i < cn * 0.6; const sc = sea ? 200 + cr() * 300 : 90 + cr() * 160; s.scale.set(sc, sc * 0.55, 1); s.position.set((cr() - 0.5) * 3200 + 100, sea ? -200 + cr() * 90 : -60 + cr() * 340, (cr() - 0.5) * 3200 + 150); (s.userData as any).v = 2 + cr() * 4; s.renderOrder = -1; group.add(s); clouds.push(s); }
  // sky whales
  const whales: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) { const w = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: ['#6a7ad8', '#8a6ad8', '#5ab0c8'][i], flatShading: true, emissive: '#2a2a6a', emissiveIntensity: 0.3 })); body.scale.set(9, 7, 26); const tail = new THREE.Mesh(new THREE.ConeGeometry(4, 14, 5), body.material); tail.rotation.x = -Math.PI / 2; tail.position.z = -32; const fin = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 5), body.material); fin.position.set(0, -2, -38); const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: '#e8d8ff', flatShading: true })); bell.scale.set(9, 3, 24); bell.position.y = -4; w.add(body, tail, fin, bell, glow('#9a9aff', 40, [0, 0, 0], 0.15)); w.userData = { a: i * 2.1, r: 420 + i * 160, y: 60 + i * 70, s: 0.012 + i * 0.004 }; group.add(w); whales.push(w); }
  const rig: WorldRig = { group, clouds, cloudMat, barriers, whales, falls, update: (dt, cam) => {
    timeU.value += dt; const lvl = useStore.getState().level; for (const b of barriers) b.mesh.visible = lvl < b.isl.minLevel;
    for (const c of clouds) { c.position.x += (c.userData as any).v * dt; if (c.position.x > cam.x + 1700) c.position.x -= 3400; if (c.position.x < cam.x - 1700) c.position.x += 3400; if (Math.abs(c.position.z - cam.z) > 1700) c.position.z += Math.sign(cam.z - c.position.z) * 3400; }
    for (const w of whales) { const u = w.userData as any; u.a += dt * u.s; w.position.set(Math.cos(u.a) * u.r + 80, u.y + Math.sin(u.a * 4) * 6, Math.sin(u.a) * u.r + 120); w.rotation.y = -u.a + Math.PI; w.rotation.z = Math.sin(u.a * 6) * 0.05; }
    for (const m of bobbing) m.position.y = (m.userData as any).by + Math.sin(timeU.value * 0.4 + (m.userData as any).ph) * 1.2;
  } };
  return rig;
}
