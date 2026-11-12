import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { REGIONS, REGION_SIZE, regionCenter, type TState } from './data';
import { G, rnd, clamp } from './runtime';
import { buildEnterable, buildHQExterior, buildHighway, clearBoxes, generateWorld, getSignTex, labelTex, regionTexture, windowTextures } from './world';
import { hqTier, useGame } from './store';
import { DECORS } from './data';
import { interiorRoot } from './interact';
import { CHOP, vehiclesRoot } from './vehiclesys';
import { actorsRoot, barsRoot } from './actors';
import { fxRoot } from './fx';
import { playerGroup } from './player';
import { hatchPos } from './interact';
import { sfx } from './audio';

export type Gfx = 'low' | 'medium' | 'high' | 'ultra';
const STATE_COL: Record<TState, string> = { Neutral: '#9ca3af', 'Hero-Controlled': '#4aa3ff', Contested: '#ff9a3c', 'Villain-Controlled': '#ff2e57', 'Fully Conquered': '#fbbf24' };
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export interface WorldScene { root: THREE.Group; update: (dt: number, cam: THREE.PerspectiveCamera) => void; applyGfx: (g: Gfx) => void; geos: ReturnType<typeof generateWorld> }

export function createWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer, gfx: Gfx): WorldScene {
  clearBoxes(); const root = new THREE.Group(); const geos = generateWorld();
  // environment for reflections
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = env; scene.environmentIntensity = 0.35;
  scene.fog = new THREE.FogExp2('#aabbd0', 0.001);
  // lights
  const hemi = new THREE.HemisphereLight('#bcd4ff', '#3a3040', 0.9); root.add(hemi);
  const sun = new THREE.DirectionalLight('#fff2dd', 2.4); sun.castShadow = true; sun.shadow.camera.near = 1; sun.shadow.camera.far = 400; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; root.add(sun); root.add(sun.target);
  const indoor = new THREE.PointLight('#ffe2b8', 0, 30, 1.6); root.add(indoor);
  const flash = new THREE.AmbientLight('#cfe0ff', 0); root.add(flash);
  // sky
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, night: { value: 0 }, sunCol: { value: new THREE.Color('#fff') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform float night; uniform vec3 sunCol; void main(){ vec3 d = normalize(vP); float h = clamp(d.y,0.0,1.0); vec3 c = mix(hor, top, pow(h,0.55)); float s = max(dot(d,sunDir),0.0); c += sunCol*(pow(s,1200.0)*3.0 + pow(s,12.0)*0.35); float m = max(dot(d,-sunDir),0.0); c += vec3(0.8,0.85,1.0)*pow(m,900.0)*2.0*night; c = mix(c, hor*0.6, smoothstep(0.0,-0.4,d.y)); gl_FragColor = vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; root.add(sky);
  const starPos = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) { const a = rnd(0, 6.283), b = Math.acos(rnd(0.02, 1)); starPos[i * 3] = Math.sin(b) * Math.cos(a) * 1300; starPos[i * 3 + 1] = Math.cos(b) * 1300; starPos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * 1300; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }); const stars = new THREE.Points(sg, starMat); stars.frustumCulled = false; root.add(stars);
  // water
  const waterMat = new THREE.MeshStandardMaterial({ color: '#0a4d78', roughness: 0.15, metalness: 0.4 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), waterMat); water.position.y = -0.5; root.add(water);
  // regions
  const tex = windowTextures(); const bMat = new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.emi, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, vertexColors: true, roughness: 0.55, metalness: 0.25 });
  const sMat = new THREE.MeshBasicMaterial({ map: getSignTex(), toneMapped: false, side: THREE.DoubleSide });
  const regionMeshes: { c: { x: number; z: number }; bld: THREE.Mesh; sign: THREE.Mesh | null; ground: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  const texSize = { low: 512, medium: 1024, high: 1024, ultra: 2048 }[gfx];
  const lampM: number[] = []; const treeM: number[] = [];
  for (const g of geos) {
    const r = REGIONS.find((x) => x.id === g.id)!; const c = regionCenter(r);
    const gm = new THREE.MeshStandardMaterial({ map: regionTexture(r, texSize), roughness: 0.92, metalness: 0.0, transparent: r.theme === 'island', alphaTest: r.theme === 'island' ? 0.5 : 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(REGION_SIZE, REGION_SIZE).rotateX(-Math.PI / 2), gm); ground.position.set(c.x, 0, c.z); ground.receiveShadow = true; root.add(ground);
    const bld = new THREE.Mesh(g.bld, bMat); bld.castShadow = true; bld.receiveShadow = true; root.add(bld);
    let sign: THREE.Mesh | null = null; if (g.sign) { sign = new THREE.Mesh(g.sign, sMat); root.add(sign); }
    regionMeshes.push({ c, bld, sign, ground, mat: gm });
    for (let i = 0; i < g.lamps.length; i += 2) lampM.push(g.lamps[i], g.lamps[i + 1]); for (let i = 0; i < g.trees.length; i += 3) treeM.push(g.trees[i], g.trees[i + 1], g.trees[i + 2]);
    for (const e of g.ents) { e.group = buildEnterable(e); root.add(e.group); G.enterables.push(e); }
  }
  // lamps
  const lampN = lampM.length / 2; const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6).translate(0, 3.5, 0), new THREE.MeshStandardMaterial({ color: '#2a2d35', roughness: 0.6, metalness: 0.5 }), lampN);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffe2a0', toneMapped: false }); const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6).translate(0, 7.2, 0), bulbMat, lampN);
  const dm = new THREE.Object3D(); for (let i = 0; i < lampN; i++) { dm.position.set(lampM[i * 2], 0, lampM[i * 2 + 1]); dm.updateMatrix(); pole.setMatrixAt(i, dm.matrix); bulb.setMatrixAt(i, dm.matrix); } pole.frustumCulled = false; bulb.frustumCulled = false; root.add(pole, bulb);
  // trees
  const treeN = treeM.length / 3; const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 6).translate(0, 1.5, 0), new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 1 }), treeN);
  const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.1, 0).translate(0, 4.2, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }), treeN); const col = new THREE.Color();
  for (let i = 0; i < treeN; i++) { const s = treeM[i * 3 + 2]; dm.position.set(treeM[i * 3], 0, treeM[i * 3 + 1]); dm.scale.setScalar(s); dm.rotation.y = i; dm.updateMatrix(); trunk.setMatrixAt(i, dm.matrix); leaf.setMatrixAt(i, dm.matrix); leaf.setColorAt(i, col.setHSL(0.27 + rnd(-0.04, 0.04), 0.5, 0.22 + rnd(0, 0.12))); } trunk.frustumCulled = false; leaf.frustumCulled = false; root.add(trunk, leaf);
  // highway & bridge
  root.add(buildHighway().group);
  // command towers
  const towers: { r: typeof REGIONS[number]; beam: THREE.Mesh; flag: THREE.Mesh; ring: THREE.Mesh; mats: THREE.MeshBasicMaterial[] }[] = [];
  for (const r of REGIONS) {
    const c = regionCenter(r); const g = new THREE.Group(); g.position.set(c.x, 0, c.z); root.add(g);
    const stone = new THREE.MeshStandardMaterial({ color: '#2b2e38', roughness: 0.5, metalness: 0.6 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.2, 10, 8), stone); base.position.y = 5; base.castShadow = true; g.add(base);
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 22, 8), stone); mid.position.y = 21; mid.castShadow = true; g.add(mid);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.2, 10, 8), stone); top.position.y = 37; g.add(top);
    const mat = new THREE.MeshBasicMaterial({ color: '#fff', toneMapped: false }); const featureMats: THREE.MeshBasicMaterial[] = [];
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.3, 6, 24).rotateX(Math.PI / 2), mat); ring.position.y = 10.3; g.add(ring);
    if (r.theme === 'industrial') {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 2.8, h = 14 + i * 3;
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.9, h, 6), stone); stack.position.set(x, 12 + h / 2, 0); g.add(stack);
        const cap = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.12, 4, 10), mat); cap.position.set(x, 12 + h, 0); g.add(cap);
      }
    } else if (r.theme === 'martial') {
      for (let i = 0; i < 3; i++) {
        const size = 5.2 - i * 1.1, y = 13 + i * 8;
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(size, size * 0.78, 0.8, 8), stone); roof.position.y = y; g.add(roof);
        const trim = new THREE.Mesh(new THREE.TorusGeometry(size * 0.85, 0.12, 4, 12), mat); trim.position.y = y - 0.42; g.add(trim);
      }
    } else if (r.theme === 'research') {
      const domeMat = mat.clone(); domeMat.transparent = true; domeMat.opacity = 0.55; featureMats.push(domeMat);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      dome.position.y = 39; g.add(dome);
    } else if (r.theme === 'capital') {
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 22, 6), stone); column.position.set(x * 3, 16, z * 3); g.add(column);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat); crown.position.set(x * 3, 27.2, z * 3); g.add(crown);
      }
    } else if (r.theme === 'shadow') {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4, spike = new THREE.Mesh(new THREE.ConeGeometry(1.1, 15, 5), stone);
        spike.position.set(Math.cos(a) * 4.8, 16, Math.sin(a) * 4.8); g.add(spike);
      }
    } else if (r.theme === 'island') {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2, fin = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 5), stone);
        fin.position.set(Math.cos(a) * 4.5, 12.5, Math.sin(a) * 4.5); fin.rotation.z = Math.cos(a) * -0.25; fin.rotation.x = Math.sin(a) * 0.25; g.add(fin);
      }
    }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide, toneMapped: false })); flag.position.set(3.6, 40, 0); g.add(flag);
    const bm = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 500, 12, 1, true), bm); beam.position.y = 250; g.add(beam);
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(r.name.toUpperCase(), r.accent), transparent: true, depthWrite: false })); lab.scale.set(22, 5.5, 1); lab.position.y = 52; g.add(lab);
    towers.push({ r, beam, flag, ring, mats: [mat, flag.material as THREE.MeshBasicMaterial, bm, ...featureMats] });
  }
  // chop shop & hatch markers
  const mk = new THREE.Group(); mk.position.set(CHOP.x, 0.1, CHOP.z); root.add(mk);
  const chopRing = new THREE.Mesh(new THREE.RingGeometry(8, 10, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.6, toneMapped: false })); mk.add(chopRing);
  const cl = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('CHOP SHOP / GARAGE', '#ffd23f'), transparent: true, depthWrite: false })); cl.scale.set(12, 3, 1); cl.position.y = 6; mk.add(cl);
  const hm = new THREE.Group(); hm.position.copy(hatchPos); root.add(hm); hm.add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.2, 16), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ff2bd6', emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.4 })));
  const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('BLACK MARKET HATCH', '#ff2bd6'), transparent: true, depthWrite: false })); hl.scale.set(10, 2.5, 1); hl.position.y = 4; hm.add(hl);
  // groups from other modules
  root.add(interiorRoot, vehiclesRoot, actorsRoot, barsRoot, fxRoot, playerGroup);
  // rain
  const RN = 1400; const rainPos = new Float32Array(RN * 6); const rainOff = new Float32Array(RN * 3); for (let i = 0; i < RN; i++) { rainOff[i * 3] = rnd(-35, 35); rainOff[i * 3 + 1] = rnd(0, 40); rainOff[i * 3 + 2] = rnd(-35, 35); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3)); const rainMat = new THREE.LineBasicMaterial({ color: '#a8c4e8', transparent: true, opacity: 0.35, depthWrite: false, fog: false }); const rain = new THREE.LineSegments(rg, rainMat); rain.frustumCulled = false; root.add(rain);
  let rainCount = 900;
  // HQ exterior
  let hqExt: THREE.Group | null = null, hqKey = '', lastPoll = 0, weatherT = 120, lightningT = 6; let rainTarget = 0;
  const applyGfx = (g: Gfx) => {
    const sz = { low: 0, medium: 1024, high: 2048, ultra: 4096 }[g]; sun.castShadow = sz > 0; if (sz) { sun.shadow.mapSize.set(sz, sz); sun.shadow.map?.dispose(); (sun.shadow as any).map = null; const e = g === 'medium' ? 55 : 70; sun.shadow.camera.left = -e; sun.shadow.camera.right = e; sun.shadow.camera.top = e; sun.shadow.camera.bottom = -e; sun.shadow.camera.updateProjectionMatrix(); }
    rainCount = { low: 400, medium: 800, high: 1200, ultra: 1400 }[g]; rg.setDrawRange(0, rainCount * 2);
  };
  applyGfx(gfx);
  const tmpC = new THREE.Color(); const dayTop = new THREE.Color('#3f7fdc'), dayHor = new THREE.Color('#bcd9f5'), duskTop = new THREE.Color('#3b2a6b'), duskHor = new THREE.Color('#ff9060'), nightTop = new THREE.Color('#04050f'), nightHor = new THREE.Color('#10142c'), grey = new THREE.Color('#6a7380');
  const sunDir = new THREE.Vector3();

  const update = (dt: number, cam: THREE.PerspectiveCamera) => {
    const p = G.p; if (!G.paused) { G.time = (G.time + dt / 50) % 24; weatherT -= dt; if (weatherT <= 0) { weatherT = rnd(100, 240); const r = Math.random(); G.weather = r < 0.5 ? 'clear' : r < 0.72 ? 'rain' : r < 0.86 ? 'fog' : 'storm'; rainTarget = G.weather === 'rain' ? 0.6 : G.weather === 'storm' ? 1 : 0; useGame.getState().toast(G.weather === 'clear' ? 'The skies clear.' : G.weather === 'rain' ? 'Rain begins to fall...' : G.weather === 'fog' ? 'A thick fog rolls in.' : 'A thunderstorm approaches!', '#93c5fd'); } }
    G.rain += (rainTarget - G.rain) * Math.min(1, dt * 0.4); const wetF = G.rain; const fogW = G.weather === 'fog' ? 1 : 0;
    const a = ((G.time - 6) / 24) * Math.PI * 2; sunDir.set(Math.cos(a) * 0.8, Math.sin(a), 0.45).normalize(); const el = sunDir.y; const night = smoothstep0(0.12, -0.12, el); const dusk = Math.max(0, 1 - Math.abs(el) * 4.5) * (1 - night * 0.3);
    skyMat.uniforms.sunDir.value.copy(sunDir); skyMat.uniforms.night.value = night;
    tmpC.copy(dayTop).lerp(duskTop, dusk * 0.9).lerp(nightTop, night).lerp(grey, wetF * 0.6 * (1 - night)); skyMat.uniforms.top.value.copy(tmpC);
    tmpC.copy(dayHor).lerp(duskHor, dusk).lerp(nightHor, night).lerp(grey, wetF * 0.6 * (1 - night * 0.7) + fogW * 0.7); skyMat.uniforms.hor.value.copy(tmpC);
    (scene.fog as THREE.FogExp2).color.copy(tmpC); (scene.fog as THREE.FogExp2).density = 0.0009 + wetF * 0.0018 + fogW * 0.0065 + night * 0.0003;
    scene.environmentIntensity = 0.35 + wetF * 0.2;
    skyMat.uniforms.sunCol.value.set('#ffe9c0').lerp(tmpC.set('#ff7a3a'), dusk);
    sky.position.copy(cam.position); stars.position.copy(cam.position); starMat.opacity = night * (1 - wetF) * (1 - fogW);
    const interior = !!p.interior; const sunI = interior ? 0 : Math.max(0, el) * 2.6 * (1 - wetF * 0.55 - fogW * 0.3) + night * 0.25; sun.intensity = sunI; sun.color.set('#fff2dd').lerp(tmpC.set('#ff9a5a'), dusk * 0.8).lerp(tmpC.set('#8fa8ff'), night);
    sun.position.set(p.pos.x + sunDir.x * 140 * (el > -0.05 ? 1 : -1), p.pos.y + Math.abs(sunDir.y) * 140 + 10, p.pos.z + sunDir.z * 140 * (el > -0.05 ? 1 : -1)); sun.target.position.set(p.pos.x, p.pos.y, p.pos.z);
    hemi.intensity = interior ? 0.55 : 0.25 + (1 - night) * 0.75 - wetF * 0.15;
    hemi.color.set('#bcd4ff').lerp(tmpC.set('#7666d6'), night); hemi.groundColor.set('#3a3040').lerp(tmpC.set('#19142f'), night);
    bMat.emissiveIntensity = night * 1.65 + dusk * 0.55 + wetF * 0.2; bulbMat.color.set('#ffe2a0').multiplyScalar(0.2 + (night + dusk * 0.5) * 1.2);
    waterMat.roughness = 0.15 - wetF * 0.08;
    renderer.toneMappingExposure = 0.95 + night * 0.15;
    // lightning
    if (G.weather === 'storm') { lightningT -= dt; if (lightningT < 0) { lightningT = rnd(4, 12); G.lightning = 1; setTimeout(() => sfx('thunder'), rnd(300, 1500)); } } G.lightning = Math.max(0, G.lightning - dt * 3.5); flash.intensity = G.lightning * 2.2;
    // wet roads
    for (const r of regionMeshes) { r.mat.roughness = 0.92 - wetF * 0.5; r.mat.metalness = wetF * 0.15; }
    // region culling
    for (const r of regionMeshes) { const d = Math.max(Math.abs(p.pos.x - r.c.x), Math.abs(p.pos.z - r.c.z)); const vis = d < REGION_SIZE / 2 + (gfx === 'low' ? 320 : 520); r.bld.visible = vis; if (r.sign) r.sign.visible = vis; }
    // indoor light
    let inside = interior; if (!inside) for (const e of G.enterables) if (Math.abs(p.pos.x - e.x) < e.w / 2 && Math.abs(p.pos.z - e.z) < e.d / 2 && p.pos.y < e.h) { inside = true; break; }
    indoor.intensity = inside ? 55 : 0; indoor.position.set(p.pos.x, p.pos.y + 4.5, p.pos.z); indoor.distance = interior ? 60 : 26;
    // rain
    rain.visible = wetF > 0.04 && !inside; if (rain.visible) { rainMat.opacity = Math.min(0.5, wetF * 0.55); const sp = 38; for (let i = 0; i < rainCount; i++) { rainOff[i * 3 + 1] -= sp * dt; if (rainOff[i * 3 + 1] < 0) { rainOff[i * 3 + 1] += 40; rainOff[i * 3] = rnd(-35, 35); rainOff[i * 3 + 2] = rnd(-35, 35); } const x = cam.position.x + rainOff[i * 3], y = cam.position.y - 12 + rainOff[i * 3 + 1], z = cam.position.z + rainOff[i * 3 + 2]; rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z; rainPos[i * 6 + 3] = x + 0.1; rainPos[i * 6 + 4] = y - 1.3; rainPos[i * 6 + 5] = z + 0.05; } rg.attributes.position.needsUpdate = true; }
    // territory beacons & HQ exterior (poll)
    lastPoll -= dt; if (lastPoll <= 0) {
      lastPoll = 0.8; const st = useGame.getState();
      for (const t of towers) { const s = st.terr[t.r.id]?.state ?? 'Neutral'; const c = STATE_COL[s]; for (const m of t.mats) m.color.set(c); }
      const key = JSON.stringify([hqTier(st), st.decor]); if (key !== hqKey) { hqKey = key; if (hqExt) root.remove(hqExt); const dc = DECORS.find((d) => d.id === st.decor)?.color ?? '#a855f7'; hqExt = buildHQExterior(hqTier(st), st.decor === 'none' ? '#c4a24a' : dc); root.add(hqExt); }
    }
    for (const t of towers) { t.flag.rotation.y = Math.sin(performance.now() / 700) * 0.2; t.ring.rotation.y += dt; }
    (chopRing.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(performance.now() / 300) * 0.2;
  };
  return { root, update, applyGfx, geos };
}
function smoothstep0(a: number, b: number, x: number) { return smooth(a, b, x); }
