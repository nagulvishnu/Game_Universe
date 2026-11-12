import * as THREE from "three";
import { TrackDef, Tod, Weather, Gfx, EFFECT_MULT } from "./data";
import { Track } from "./track";
import { Ambient } from "./vfx";
import { Ctx, sweep, archProfile, std, makeInst, asphaltTexture, roughTexture, checkerTexture, stripeTexture, addPillars, rangeIter, Item, noiseColorTexture } from "./worldkit";
import { buildTheme } from "./themes";
import { rng, makeCanvas, disposeObject } from "./util";

const TOD_P: Record<Tod, { top: string; hor: string; gnd: string; sunCol: string; sunI: number; hemiSky: string; hemiGnd: string; hemiI: number; sunDir: [number, number, number]; fog: string; fogD: number; stars: number; exposure: number; grey: string }> = {
  sunny: { top: "#2f86e6", hor: "#cfe9ff", gnd: "#8a9a7a", sunCol: "#fff1d6", sunI: 3.0, hemiSky: "#cfe8ff", hemiGnd: "#7b7560", hemiI: 1.15, sunDir: [0.5, 0.75, 0.35], fog: "#cfe6f8", fogD: 0.00075, stars: 0, exposure: 1.0, grey: "#8e98a4" },
  sunset: { top: "#2a2670", hor: "#ff9a5c", gnd: "#4a3550", sunCol: "#ff9350", sunI: 2.5, hemiSky: "#ffb089", hemiGnd: "#3c2c52", hemiI: 0.85, sunDir: [-0.85, 0.2, 0.5], fog: "#f5a070", fogD: 0.0011, stars: 0.25, exposure: 1.05, grey: "#6b5a66" },
  night: { top: "#02030c", hor: "#1b1b46", gnd: "#06060e", sunCol: "#8aa0ff", sunI: 0.7, hemiSky: "#5060b0", hemiGnd: "#10121f", hemiI: 0.6, sunDir: [0.3, 0.7, 0.25], fog: "#0d0f2c", fogD: 0.0015, stars: 1, exposure: 1.15, grey: "#101320" },
};

export interface World {
  scene: THREE.Scene;
  track: Track;
  sky: THREE.Mesh;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  tod: Tod;
  weather: Weather;
  dark: boolean;
  wet: number;
  light: number;
  shoulderGrip: number;
  shoulderTop: number;
  exposure: number;
  rain: Ambient | null;
  ambient: Ambient | null;
  lamps: number;
  groundAt: (x: number, z: number) => number;
  onThunder: (() => void) | null;
  update(dt: number, t: number): void;
  prepareView(cam: THREE.Camera, scale: number, t: number): void;
  shadowTarget(x: number, y: number, z: number): void;
  dispose(): void;
}

function skyMaterial(P: (typeof TOD_P)["sunny"], overcast: number) {
  const grey = new THREE.Color(P.grey);
  const top = new THREE.Color(P.top).lerp(grey, overcast);
  const hor = new THREE.Color(P.hor).lerp(grey, overcast * 0.85);
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: top }, uHor: { value: hor }, uGnd: { value: new THREE.Color(P.gnd) },
      uSunDir: { value: new THREE.Vector3(...P.sunDir).normalize() }, uSunCol: { value: new THREE.Color(P.sunCol).multiplyScalar(1 - overcast * 0.85) },
      uStars: { value: P.stars * (1 - overcast) }, uFlash: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uTop,uHor,uGnd,uSunDir,uSunCol; uniform float uStars,uFlash;
      void main(){
        float h = vDir.y;
        vec3 col = mix(uHor, uTop, pow(clamp(h,0.0,1.0),0.55));
        col = mix(col, uGnd, smoothstep(0.0,-0.3,h));
        float sd = max(dot(vDir,uSunDir),0.0);
        col += uSunCol*(pow(sd,1200.0)*8.0 + pow(sd,14.0)*0.35 + pow(sd,3.0)*0.12);
        vec3 q = floor(vDir*200.0);
        float s = fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5453);
        col += vec3(1.0)*uStars*step(0.9975,s)*smoothstep(0.05,0.4,h);
        float band = sin(vDir.x*7.0+sin(vDir.z*5.0)*2.0)*0.5+0.5;
        col = mix(col, uHor*1.08, 0.18*smoothstep(0.55,0.95,band)*smoothstep(0.02,0.2,h)*(1.0-smoothstep(0.3,0.6,h)));
        col += vec3(uFlash);
        gl_FragColor = vec4(col,1.0);
      }`,
  });
}

export function buildWorld(renderer: THREE.WebGLRenderer, def: TrackDef, todSel: Tod | "auto", weatherSel: Weather | "auto", gfx: Gfx): World {
  const track = new Track(def);
  const tod: Tod = todSel === "auto" ? def.tod : todSel;
  const weather: Weather = weatherSel === "auto" ? def.weather : weatherSel;
  const P = TOD_P[tod];
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);

  let overcast = 0, wet = def.wet, fogMul = 1, rainK = 0, storm = false;
  if (weather === "rain") { overcast = 0.45; wet = Math.max(wet, 0.6); fogMul = 1.8; rainK = 1; }
  if (weather === "heavy") { overcast = 0.7; wet = 0.95; fogMul = 3; rainK = 2; }
  if (weather === "fog") { overcast = 0.35; fogMul = 9; }
  if (weather === "storm") { overcast = 0.85; wet = 1; fogMul = 3.5; rainK = 2; storm = true; }
  const dark = tod === "night" || weather === "heavy" || weather === "storm";
  const light = (tod === "night" ? 0.28 : tod === "sunset" ? 0.65 : 1) * (1 - overcast * 0.3);

  // fog
  let fogColor = new THREE.Color(P.fog).lerp(new THREE.Color(P.grey), overcast * 0.9);
  let fogD = P.fogD * fogMul;
  if (def.ambient === "sand") { fogColor = new THREE.Color("#d9b27a").multiplyScalar(tod === "sunny" ? 1 : 0.6); fogD += 0.0042; }
  if (weather === "fog") fogColor.lerp(new THREE.Color(tod === "night" ? "#242a40" : "#c9d0d8"), 0.7);
  scene.fog = new THREE.FogExp2(fogColor, fogD);
  scene.background = fogColor;

  // sky
  const skyMat = skyMaterial(P, overcast);
  (skyMat.uniforms.uHor.value as THREE.Color).lerp(fogColor, 0.35);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // lights
  const hemi = new THREE.HemisphereLight(new THREE.Color(P.hemiSky).lerp(new THREE.Color(P.grey), overcast * 0.6), P.hemiGnd, P.hemiI * (1 - overcast * 0.25));
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(P.sunCol, P.sunI * (1 - overcast * 0.78));
  const sd = new THREE.Vector3(...P.sunDir).normalize();
  sun.position.copy(sd).multiplyScalar(90);
  if (gfx.shadows > 0) {
    sun.castShadow = true;
    const ms = [0, 1024, 2048, 4096][gfx.shadows];
    sun.shadow.mapSize.set(ms, ms);
    const c = sun.shadow.camera;
    c.left = -42; c.right = 42; c.top = 42; c.bottom = -42; c.near = 1; c.far = 260;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.06;
  }
  scene.add(sun, sun.target);

  // environment (reflections)
  {
    const es = new THREE.Scene();
    const esky = new THREE.Mesh(sky.geometry, skyMat);
    es.add(esky);
    const accent = [def.accent, def.accent2];
    if (tod === "night" || def.theme === "cyber" || def.theme === "tokyo") {
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(260, 90), new THREE.MeshBasicMaterial({ color: new THREE.Color(accent[i % 2]).multiplyScalar(2.2), side: THREE.DoubleSide }));
        const a = (i / 14) * Math.PI * 2;
        m.position.set(Math.cos(a) * 800, 80 + (i % 3) * 60, Math.sin(a) * 800);
        m.lookAt(0, 50, 0);
        es.add(m);
      }
    }
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(es, 0.02, 1, 3000);
    scene.environment = rt.texture;
    (scene as any).environmentIntensity = gfx.reflections ? (dark ? 0.9 : 0.8 + wet * 0.5) : 0.35;
    pm.dispose();
    (scene.userData as any).envRT = rt;
  }

  const R = rng(def.id.length * 7919 + def.pts.length);
  const ctx: Ctx = {
    group, track, R, anim: [], tod, weather, night: tod === "night", wet, hAt: () => -0.05, groundY: -0.05,
    fx: EFFECT_MULT[gfx.effects] > 1 ? 1 : EFFECT_MULT[gfx.effects], rings: [],
  };
  // theme (terrain & scenery)
  const themeInfo = buildTheme(def.theme, ctx);

  // ---- road
  const N = track.N;
  const wetK = wet;
  const accentC = new THREE.Color(def.accent);
  const neonEdge = def.theme === "tokyo" || def.theme === "cyber" || def.theme === "skyline";
  const roadTex = asphaltTexture("#e8e8e8", def.theme === "desert" ? "#e8c040" : "#f0f0f0", wetK);
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const rough = roughTexture();
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex, roughnessMap: rough, roughness: 0.9 - 0.62 * wetK, metalness: 0.05 + 0.25 * wetK, envMapIntensity: 0.8 + wetK * 1.6, side: THREE.DoubleSide,
    color: new THREE.Color(1 - wetK * 0.35, 1 - wetK * 0.35, 1 - wetK * 0.3),
  });
  if (neonEdge) {
    const et = makeCanvas(256, 8, (g, w, h) => {
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, h);
      g.fillStyle = def.accent;
      g.fillRect(w * 0.025, 0, w * 0.02, h);
      g.fillStyle = def.accent2;
      g.fillRect(w * 0.955, 0, w * 0.02, h);
    });
    roadMat.emissiveMap = et;
    roadMat.emissive = new THREE.Color(1, 1, 1);
    roadMat.emissiveIntensity = 1.4;
  }
  const road = new THREE.Mesh(sweep(track, [[-track.halfW, 0], [track.halfW, 0]], 24), roadMat);
  road.receiveShadow = true;
  group.add(road);

  // shoulder
  const shCol = { none: "#444", grass: "#4f7a3a", sand: def.theme === "coast" ? "#e6cf9a" : "#d2ab6a", gravel: "#7b7468" }[def.shoulder];
  if (def.shoulder !== "none" && track.wallHalf > track.halfW + 0.5) {
    const stex = noiseColorTexture(shCol, 0.25);
    stex.repeat.set(1, 1);
    const sm = new THREE.MeshStandardMaterial({ map: stex, roughness: 1, side: THREE.DoubleSide });
    [-1, 1].forEach((s) => {
      const a = track.halfW, b = track.wallHalf;
      const g = sweep(track, s > 0 ? [[a, -0.02], [b, -0.02]] : [[-b, -0.02], [-a, -0.02]], 12);
      const m = new THREE.Mesh(g, sm);
      m.receiveShadow = true;
      group.add(m);
    });
    // curbs
    const ct = stripeTexture();
    const cm = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.7, side: THREE.DoubleSide });
    [-1, 1].forEach((s) => {
      const a = track.halfW - 1.1, b = track.halfW + 0.15;
      const g = sweep(track, s > 0 ? [[a, 0.025], [b, 0.025]] : [[-b, 0.025], [-a, 0.025]], 4);
      group.add(new THREE.Mesh(g, cm));
    });
  }

  // ---- walls
  const wallH = { tokyo: 1.1, mountain: 0.95, desert: 1.0, coast: 1.0, cyber: 1.2, skyline: 1.2 }[def.theme];
  const wallColor = { tokyo: "#5a5e6b", mountain: "#9aa3ad", desert: "#c9bfae", coast: "#d8d2c4", cyber: "#161a2e", skyline: "#2b3045" }[def.theme];
  const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.7, metalness: def.theme === "mountain" ? 0.7 : 0.1, side: THREE.DoubleSide, emissive: def.theme === "cyber" ? new THREE.Color(def.accent).multiplyScalar(0.18) : 0x000000 });
  const stripeMat = new THREE.MeshBasicMaterial({ color: accentC.clone().multiplyScalar(neonEdge ? 1.8 : 0.0), side: THREE.DoubleSide, toneMapped: false });
  const wh = track.wallHalf;
  [-1, 1].forEach((s) => {
    const t = 0.5;
    const prof = s > 0 ? [[wh, 0], [wh, wallH], [wh + t, wallH], [wh + t, 0]] : [[-wh - t, 0], [-wh - t, wallH], [-wh, wallH], [-wh, 0]];
    const m = new THREE.Mesh(sweep(track, prof, 10), wallMat);
    m.castShadow = false;
    group.add(m);
    if (neonEdge) {
      const sp = s > 0 ? [[wh - 0.02, wallH * 0.55], [wh - 0.02, wallH * 0.75]] : [[-wh + 0.02, wallH * 0.55], [-wh + 0.02, wallH * 0.75]];
      const sm = stripeMat.clone();
      sm.color = new THREE.Color(s > 0 ? def.accent2 : def.accent).multiplyScalar(2);
      group.add(new THREE.Mesh(sweep(track, sp, 10), sm));
    }
  });

  // ---- deck & pillars for elevated themes
  const elevated = def.theme === "tokyo" || def.theme === "skyline";
  const deckMat = std(def.theme === "skyline" ? "#39405a" : "#4a4d58", 0.8, 0.2, { side: THREE.DoubleSide });
  if (elevated) {
    const dw = wh + 0.9;
    group.add(new THREE.Mesh(sweep(track, [[-dw, 0], [-dw, -0.9], [-dw * 0.7, -2.2], [dw * 0.7, -2.2], [dw, -0.9], [dw, 0]], 12), deckMat));
    const gy = def.theme === "skyline" ? -48 : 0;
    addPillars(ctx, 0, N, def.theme === "skyline" ? 22 : 12, () => gy, 0x4c505e);
  }
  // ---- zones
  const lampItems: Item[] = [];
  track.zones.forEach((z, zi) => {
    const { len, at } = rangeIter(track, z.i0, z.i1);
    if (z.kind === "tunnel") {
      const W = wh + 0.5;
      const tunMat = std(def.theme === "skyline" ? "#2b3a58" : def.theme === "mountain" ? "#5c5a55" : "#3b3d47", 0.9, 0.1, { side: THREE.DoubleSide });
      if (def.theme === "skyline") { tunMat.transparent = true; tunMat.opacity = 0.55; tunMat.metalness = 0.6; tunMat.roughness = 0.2; }
      group.add(new THREE.Mesh(sweep(track, archProfile(W, 8.2, 3.2), 8, z.i0, z.i1), tunMat));
      const portal = std(def.theme === "mountain" ? "#3d3a36" : "#23262f", 0.8, 0.2, { side: THREE.DoubleSide });
      [z.i0, z.i1 - 2].forEach((s) => group.add(new THREE.Mesh(sweep(track, archProfile(W + 1.2, 9.2, 3.4), 8, s % N, (s + 2) % N), portal)));
      // light strips
      const lg = new THREE.BoxGeometry(0.5, 0.18, 2.4);
      const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.theme === "tokyo" ? "#ffb060" : def.theme === "coast" ? "#ffe0a0" : def.theme === "skyline" ? def.accent2 : "#fff0c0").multiplyScalar(2.2), toneMapped: false });
      const items: Item[] = [];
      for (let k = 2; k < len - 1; k += 2) {
        const i = at(k);
        [-5.5, 0, 5.5].forEach((o) => items.push({ x: track.px[i] + track.nx[i] * o, y: track.py[i] + 8.0 - Math.abs(o) * 0.1, z: track.pz[i] + track.nz[i] * o, ry: Math.atan2(track.tx[i], track.tz[i]) }));
      }
      group.add(makeInst(lg, lm, items));
      // side lights
      const sg = new THREE.BoxGeometry(0.12, 0.12, 2.4);
      const sm = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.accent).multiplyScalar(2), toneMapped: false });
      const it2: Item[] = [];
      for (let k = 1; k < len; k += 2) {
        const i = at(k);
        [-1, 1].forEach((s) => it2.push({ x: track.px[i] + track.nx[i] * (W - 0.1) * s, y: track.py[i] + 1.6, z: track.pz[i] + track.nz[i] * (W - 0.1) * s, ry: Math.atan2(track.tx[i], track.tz[i]) }));
      }
      group.add(makeInst(sg, sm, it2));
    }
    if (z.kind === "bridge") {
      const dw = wh + 0.6;
      const steel = std(def.accent, 0.5, 0.5, { side: THREE.DoubleSide });
      group.add(new THREE.Mesh(sweep(track, [[-dw, 0.0], [-dw, -1.2], [dw, -1.2], [dw, 0.0]], 6, z.i0, z.i1), steel));
      addPillars(ctx, z.i0, z.i1, 7, (x, zz) => ctx.hAt(x, zz) - 2, 0x8a8d96, 2.4);
      // arch-ish side trusses
      const tg = new THREE.BoxGeometry(0.35, 0.35, track.ds * 1.4);
      const items: Item[] = [];
      for (let k = 0; k < len; k++) {
        const i = at(k);
        const h = Math.sin((k / len) * Math.PI) * 3.2 + 0.4;
        [-1, 1].forEach((s) => items.push({ x: track.px[i] + track.nx[i] * (wh + 0.3) * s, y: track.py[i] + wallH + h, z: track.pz[i] + track.nz[i] * (wh + 0.3) * s, ry: Math.atan2(track.tx[i], track.tz[i]) }));
        if (k % 4 === 0) [-1, 1].forEach((s) => items.push({ x: track.px[i] + track.nx[i] * (wh + 0.3) * s, y: track.py[i] + wallH + h / 2, z: track.pz[i] + track.nz[i] * (wh + 0.3) * s, ry: Math.atan2(track.tx[i], track.tz[i]), sx: 1, sy: h / 0.35, sz: 0.2 }));
      }
      group.add(makeInst(tg, steel, items));
    }
    if (z.kind === "cable") {
      const towerMat = std("#2c3350", 0.5, 0.6);
      const cableGeo: number[] = [];
      const nT = 2;
      for (let t = 0; t < nT; t++) {
        const k = Math.floor(((t + 0.5) / nT) * len);
        const i = at(k);
        const H = 70;
        const gy = -48;
        [-1, 1].forEach((s) => {
          const x = track.px[i] + track.nx[i] * (wh + 2.2) * s, z2 = track.pz[i] + track.nz[i] * (wh + 2.2) * s;
          const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, H + track.py[i] - gy, 3.2), towerMat);
          m.position.set(x, gy + (H + track.py[i] - gy) / 2, z2);
          group.add(m);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.accent).multiplyScalar(2), toneMapped: false }));
          cap.position.set(x, track.py[i] + H, z2);
          group.add(cap);
          for (let q = -12; q <= 12; q++) {
            if (q === 0) continue;
            const j = (i + q * 3 + N) % N;
            cableGeo.push(x, track.py[i] + H - 2, z2, track.px[j] + track.nx[j] * (wh * 0.9) * s, track.py[j], track.pz[j] + track.nz[j] * (wh * 0.9) * s);
          }
        });
      }
      const cg = new THREE.BufferGeometry();
      cg.setAttribute("position", new THREE.Float32BufferAttribute(cableGeo, 3));
      group.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: new THREE.Color(def.accent2).multiplyScalar(1.5), toneMapped: false })));
      group.add(new THREE.Mesh(sweep(track, [[-wh - 0.9, 0], [-wh - 0.9, -1.4], [wh + 0.9, -1.4], [wh + 0.9, 0]], 6, z.i0, z.i1), std("#1e2338", 0.5, 0.6)));
      void zi;
    }
  });
  void lampItems;

  // ---- start / finish gate
  {
    const g = new THREE.Group();
    const p0 = track.at(0);
    g.position.copy(p0);
    g.rotation.y = track.heading(0);
    const postMat = std("#20232d", 0.5, 0.6);
    [-1, 1].forEach((s) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 1), postMat);
      post.position.set(s * (wh + 1), 4.5, 0);
      g.add(post);
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(wh * 2 + 3, 1.6, 1), postMat);
    bar.position.set(0, 9, 0);
    g.add(bar);
    const bt = makeCanvas(512, 96, (c, w, h) => {
      c.fillStyle = "#0a0a12";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 64; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? "#fff" : "#111"; c.fillRect(i * 8, j * 8, 8, 8); c.fillRect(i * 8, h - 16 + j * 8, 8, 8); }
      c.fillStyle = "#fff";
      c.font = "bold 44px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("START / FINISH", w / 2, h / 2);
    });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(wh * 2 + 2, 1.5), new THREE.MeshBasicMaterial({ map: bt, side: THREE.DoubleSide, toneMapped: false }));
    banner.position.set(0, 9, 0.55);
    const b2 = banner.clone();
    b2.position.z = -0.55;
    b2.rotation.y = Math.PI;
    g.add(banner, b2);
    const lights = new THREE.Mesh(new THREE.BoxGeometry(wh * 2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.accent).multiplyScalar(2.5), toneMapped: false }));
    lights.position.set(0, 8.1, 0);
    g.add(lights);
    group.add(g);
    const ct = checkerTexture(16, 2);
    const cg = sweep(track, [[-track.halfW, 0.035], [track.halfW, 0.035]], track.ds, 0, 1);
    const ck = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: ct, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    group.add(ck);
    // checkpoint arches
    const cpMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.accent2).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.8 });
    const items: Item[] = [];
    for (let k = 1; k < 8; k++) {
      const i = Math.floor((k * N) / 8);
      const ry = Math.atan2(track.tx[i], track.tz[i]);
      [-1, 1].forEach((s) => items.push({ x: track.px[i] + track.nx[i] * (wh + 0.9) * s, y: track.py[i] + 2.2, z: track.pz[i] + track.nz[i] * (wh + 0.9) * s, ry, sx: 0.35, sy: 4.4, sz: 0.35 }));
      items.push({ x: track.px[i], y: track.py[i] + 4.4, z: track.pz[i], ry, sx: wh * 2 + 1.8, sy: 0.3, sz: 0.3 });
    }
    group.add(makeInst(new THREE.BoxGeometry(1, 1, 1), cpMat, items));
  }

  // ---- ground plane when theme did not build terrain
  const groundMesh = themeInfo.ground;
  if (groundMesh) group.add(groundMesh);

  // ---- weather particles
  let rain: Ambient | null = null;
  if (rainK > 0) {
    const cnt = Math.round(2400 * rainK * gfx.weatherDensity);
    rain = new Ambient(cnt, new THREE.Vector3(46, 30, 46), new THREE.Vector3(-4, -42, -2), new THREE.Color(tod === "night" ? "#8fb0ff" : "#d4e6ff"), tod === "night" ? 0.45 : 0.33, true, 0, 1.3 + rainK * 0.4);
    scene.add(rain.obj);
  }
  let ambient: Ambient | null = null;
  const dens = gfx.weatherDensity;
  const addAmb = (n: number, box: number[], vel: number[], col: string, op: number, size: number) => {
    ambient = new Ambient(Math.round(n * dens), new THREE.Vector3(box[0], box[1], box[2]), new THREE.Vector3(vel[0], vel[1], vel[2]), new THREE.Color(col), op, false, size);
    scene.add(ambient.obj);
  };
  if (def.ambient === "sand") addAmb(2600, [70, 30, 70], [-38, -1, -9], "#e6c38a", 0.4, 0.5);
  if (def.ambient === "petals") addAmb(260, [50, 25, 50], [-1.6, -1.4, -0.6], "#ffb7d0", 0.9, 0.16);
  if (def.ambient === "sparks") addAmb(220, [60, 26, 60], [0.4, 3.5, 0.2], "#ffb04a", 0.85, 0.11);
  if (def.ambient === "dust") addAmb(260, [60, 30, 60], [-7, 0.2, -2], "#ffe9d6", 0.55, 0.12);

  const stormState = { t: 4 + Math.random() * 6, flash: 0 };
  const lightningBase = hemi.intensity;
  const world: World = {
    scene, track, sky, sun, hemi, tod, weather, dark, wet, light,
    shoulderGrip: def.shoulder === "none" ? 1 : def.shoulder === "sand" ? 0.62 : def.shoulder === "gravel" ? 0.74 : 0.7,
    shoulderTop: def.shoulder === "none" ? 1 : def.shoulder === "sand" ? 0.72 : 0.8,
    exposure: P.exposure, rain, ambient, lamps: 0, groundAt: (x, z) => ctx.hAt(x, z), onThunder: null,
    update(dt, t) {
      ctx.anim.forEach((f) => f(dt, t));
      ctx.rings.forEach((r) => (r.mesh.rotation.y += r.speed * dt));
      if (storm) {
        stormState.t -= dt;
        if (stormState.t < 0) {
          stormState.flash = 1;
          stormState.t = 5 + Math.random() * 9;
          setTimeout(() => world.onThunder?.(), 300 + Math.random() * 900);
        }
        stormState.flash = Math.max(0, stormState.flash - dt * 2.5);
        const f = stormState.flash > 0.5 ? Math.random() * stormState.flash : stormState.flash * 0.3;
        (skyMat.uniforms.uFlash as any).value = f * 0.5;
        hemi.intensity = lightningBase + f * 2.5;
      }
    },
    prepareView(cam, scale, t) {
      sky.position.copy(cam.position);
      rain?.prepare(cam, t, scale);
      (ambient as Ambient | null)?.prepare(cam, t, scale);
    },
    shadowTarget(x, y, z) {
      sun.target.position.set(x, y, z);
      sun.position.set(x + sd.x * 90, y + sd.y * 90, z + sd.z * 90);
      sun.target.updateMatrixWorld();
    },
    dispose() {
      disposeObject(scene);
      (scene.userData as any).envRT?.dispose();
      rain?.dispose();
      (ambient as Ambient | null)?.dispose();
      scene.clear();
    },
  };
  return world;
}
