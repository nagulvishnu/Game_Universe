import * as THREE from 'three';
import type { Game } from './engine';
import { uniforms } from './shared';
import { clamp, lerp, smoothstep, fbm, rand, hash2 } from './noise';

const SKY_V = `varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; gl_Position.z=gl_Position.w; }`;
const SKY_F = `
uniform vec3 uZen,uHor,uSun,uSunCol,uGlow; uniform float uNight,uSpace,uFlash,uOver;
varying vec3 vDir;
float h3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
void main(){
  vec3 d=normalize(vDir); float y=d.y;
  float t=pow(clamp(y,0.0,1.0),0.45);
  vec3 col=mix(uHor,uZen,t);
  col=mix(col,uHor*0.75,1.0-smoothstep(-0.35,0.0,y));
  float sd=max(dot(d,uSun),0.0);
  float vis=1.0-uOver*0.85;
  col+=uGlow*pow(sd,5.0)*0.55*vis + uSunCol*pow(sd,500.0)*4.0*vis + uSunCol*pow(sd,50.0)*0.5*vis;
  vec3 sp=d*230.0; vec3 ip=floor(sp); float r=h3(ip);
  float st=step(0.9968,r)*(1.0-smoothstep(0.0,0.55,length(fract(sp)-0.5)));
  float sv=max(uNight*(1.0-uOver),uSpace);
  col+=vec3(0.85,0.9,1.0)*st*sv*2.0*(step(0.0,y)+uSpace);
  float band=exp(-pow(dot(d,normalize(vec3(0.3,0.6,0.7))),2.0)*16.0);
  col+=vec3(0.3,0.24,0.42)*band*sv*0.45*(0.5+0.5*h3(floor(d*70.0)));
  col+=uFlash*vec3(0.6,0.65,0.95);
  gl_FragColor=vec4(col,1.0);
}`;
function skyMat() {
  return new THREE.ShaderMaterial({
    vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.8) }, uGlow: { value: new THREE.Color(1, 0.7, 0.4) },
      uNight: { value: 0 }, uSpace: { value: 0 }, uFlash: { value: 0 }, uOver: { value: 0 },
    },
  });
}

const WEATHER: Record<string, { cloud: number; rain: number; snow: number; fog: number; dark: number; sand: number; wind: number; storm: number }> = {
  clear: { cloud: 0.15, rain: 0, snow: 0, fog: 0.00026, dark: 0, sand: 0, wind: 2, storm: 0 },
  cloudy: { cloud: 0.8, rain: 0, snow: 0, fog: 0.0004, dark: 0.25, sand: 0, wind: 6, storm: 0 },
  rain: { cloud: 0.95, rain: 1, snow: 0, fog: 0.0007, dark: 0.5, sand: 0, wind: 8, storm: 0 },
  storm: { cloud: 1, rain: 1.3, snow: 0, fog: 0.0009, dark: 0.75, sand: 0, wind: 18, storm: 1 },
  snow: { cloud: 0.85, rain: 0, snow: 1, fog: 0.0011, dark: 0.25, sand: 0, wind: 4, storm: 0 },
  fog: { cloud: 0.5, rain: 0, snow: 0, fog: 0.0045, dark: 0.2, sand: 0, wind: 1, storm: 0 },
  sand: { cloud: 0.4, rain: 0, snow: 0, fog: 0.0034, dark: 0.3, sand: 1, wind: 30, storm: 0 },
};

class Precip {
  obj: THREE.Object3D; mat: THREE.ShaderMaterial;
  constructor(scene: THREE.Scene, n: number, points: boolean, public speed: number, size: number, color: number, alpha: number) {
    const pos = new Float32Array(n * (points ? 1 : 2) * 3), rr = new Float32Array(n * (points ? 1 : 2)), end = new Float32Array(n * (points ? 1 : 2));
    for (let i = 0; i < n; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random(), r = Math.random();
      if (points) { pos.set([x, y, z], i * 3); rr[i] = r; } else { pos.set([x, y, z, x, y, z], i * 6); rr[i * 2] = rr[i * 2 + 1] = r; end[i * 2 + 1] = 1; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRand', new THREE.BufferAttribute(rr, 1)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uVol: { value: new THREE.Vector3(140, 80, 140) }, uInt: { value: 0 }, uWind: { value: new THREE.Vector2() }, uSpeed: { value: speed }, uSize: { value: size }, uScale: { value: 800 }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha } },
      vertexShader: `attribute float aRand; attribute float aEnd; uniform vec3 uCam,uVol; uniform float uTime,uInt,uSpeed,uSize,uScale; uniform vec2 uWind; varying float vA;
void main(){ vec3 p=position*uVol; p.y-=uTime*uSpeed; p.xz+=uWind*uTime; vec3 rel=mod(p-uCam+uVol*0.5,uVol)-uVol*0.5; vec3 wp=uCam+rel;
${points ? '' : 'wp+=aEnd*normalize(vec3(-uWind.x,uSpeed,-uWind.y))*1.6;'}
vA=step(aRand,uInt)*(1.0-smoothstep(40.0,70.0,length(rel)));
vec4 mv=viewMatrix*vec4(wp,1.0); gl_Position=projectionMatrix*mv; ${points ? 'gl_PointSize=uSize*uScale/max(0.1,-mv.z);' : ''} }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vA; void main(){ ${points ? 'float d=length(gl_PointCoord-0.5)*2.0; if(d>1.0) discard; float a=(1.0-d);' : 'float a=1.0;'} if(vA<0.01) discard; gl_FragColor=vec4(uColor,vA*uAlpha*a); }`,
    });
    this.obj = points ? new THREE.Points(g, this.mat) : new THREE.LineSegments(g, this.mat);
    this.obj.frustumCulled = false; this.obj.renderOrder = 8; this.obj.visible = false; scene.add(this.obj);
  }
}

export interface Planet { name: string; group: THREE.Group; pos: THREE.Vector3; radius: number; alive: boolean; color: number; spin: number; kind: string }

function planetTex(kind: string): THREE.CanvasTexture {
  const W = 256, H = 128;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!; const img = g.createImageData(W, H);
  const craters: [number, number, number][] = []; for (let i = 0; i < 40; i++) craters.push([Math.random() * W, Math.random() * H, 2 + Math.random() * 9]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H; let r = 0.5, gg = 0.5, b = 0.5;
    const n = fbm(u * 8, v * 4, 5);
    if (kind === 'moon') { let c = 0.5 + n * 0.35; for (const k of craters) { const d = Math.hypot(x - k[0], y - k[1]) / k[2]; if (d < 1) c *= 0.7 + 0.3 * d; else if (d < 1.25) c *= 1.18; } r = c; gg = c * 0.98; b = c * 0.95; }
    else if (kind === 'mars') { r = 0.55 + n * 0.4; gg = 0.25 + n * 0.22; b = 0.12 + n * 0.1; if (v < 0.07 || v > 0.93) { r = gg = b = 0.92; } }
    else if (kind === 'gas') { const band = Math.sin(v * 38 + fbm(u * 6, v * 20, 3) * 5) * 0.5 + 0.5; r = 0.78 + band * 0.18 - n * 0.1; gg = 0.62 + band * 0.18 - n * 0.1; b = 0.38 + band * 0.12; }
    else { r = 0.7 + n * 0.3; gg = 0.88 + n * 0.12; b = 1.0; if (n > 0.62) { r *= 0.75; gg *= 0.9; } }
    const o = (y * W + x) * 4; img.data[o] = clamp(r, 0, 1) * 255; img.data[o + 1] = clamp(gg, 0, 1) * 255; img.data[o + 2] = clamp(b, 0, 1) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Sky {
  hour = 9; daySpeed = 1 / 60;
  weather = 'clear';
  cur = { ...WEATHER.clear };
  intensity = 1;
  sunDir = new THREE.Vector3(0, 1, 0);
  dome: THREE.Mesh; domeMat: THREE.ShaderMaterial;
  sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight;
  clouds: THREE.Sprite[] = []; cloudGroup = new THREE.Group(); cloudMat: THREE.SpriteMaterial;
  rain: Precip; snow: Precip; sand: Precip;
  planets: Planet[] = [];
  space = 0; dayF = 1; flashI = 0; thunderT = 4; apocalypse = 0; underwater = false;
  fogCol = new THREE.Color();
  tmp = new THREE.Color(); tmp2 = new THREE.Color();
  shadowSize = 150;

  constructor(public game: Game) {
    const scene = game.scene;
    this.domeMat = skyMat();
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(30000, 32, 20), this.domeMat);
    this.dome.renderOrder = -20; this.dome.frustumCulled = false; scene.add(this.dome);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera; c.left = -this.shadowSize; c.right = this.shadowSize; c.top = this.shadowSize; c.bottom = -this.shadowSize; c.near = 10; c.far = 1200;
    c.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.9;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x9ec5ff, 0x4a4030, 0.6); scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xaec6e0, 0.00026);
    // env map
    const pm = new THREE.PMREMGenerator(game.renderer);
    const es = new THREE.Scene();
    const eg = new THREE.SphereGeometry(100, 24, 16); const ep = eg.attributes.position, ec = new Float32Array(ep.count * 3);
    const cz = new THREE.Color(0.22, 0.46, 0.9), ch = new THREE.Color(0.82, 0.9, 0.98), cg = new THREE.Color(0.38, 0.36, 0.32), ctmp = new THREE.Color();
    for (let i = 0; i < ep.count; i++) { const y = ep.getY(i) / 100; if (y > 0) ctmp.copy(ch).lerp(cz, Math.pow(y, 0.5)); else ctmp.copy(ch).lerp(cg, Math.min(1, -y * 4)); const sx = ep.getX(i) / 100; if (sx > 0.6 && y > 0.3) ctmp.multiplyScalar(2.2); ec[i * 3] = ctmp.r; ec[i * 3 + 1] = ctmp.g; ec[i * 3 + 2] = ctmp.b; }
    eg.setAttribute('color', new THREE.BufferAttribute(ec, 3));
    const emesh = new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })); es.add(emesh);
    scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
    // clouds
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d')!;
    for (let i = 0; i < 26; i++) { const x = 70 + Math.random() * 116, y = 90 + Math.random() * 76, r = 30 + Math.random() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
    const ct = new THREE.CanvasTexture(cv);
    this.cloudMat = new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.9 });
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Sprite(this.cloudMat); const w = rand(500, 1200); s.scale.set(w, w * rand(0.35, 0.5), 1);
      s.position.set(rand(-3500, 3500), rand(650, 950), rand(-3500, 3500)); s.userData.r = i / 90; this.cloudGroup.add(s); this.clouds.push(s);
    }
    scene.add(this.cloudGroup);
    this.rain = new Precip(scene, 7000, false, 70, 0, 0xb8cce6, 0.35);
    this.snow = new Precip(scene, 5000, true, 7, 0.28, 0xffffff, 0.9);
    this.sand = new Precip(scene, 4000, true, 1.5, 0.22, 0xe0b070, 0.55);
    // planets
    const mk = (name: string, kind: string, pos: THREE.Vector3, radius: number, color: number, ring = false, atmo = 0) => {
      const group = new THREE.Group(); group.position.copy(pos);
      const m = new THREE.MeshStandardMaterial({ map: planetTex(kind), roughness: 1, metalness: 0 }); m.fog = false;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), m); group.add(mesh);
      if (atmo) {
        const am = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false, uniforms: { c: { value: new THREE.Color(atmo) } },
          vertexShader: 'varying vec3 n; varying vec3 v; void main(){ n=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); v=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
          fragmentShader: 'uniform vec3 c; varying vec3 n; varying vec3 v; void main(){ float f=pow(1.0-abs(dot(-n,v)),2.5); gl_FragColor=vec4(c,f*0.9); }' });
        const a = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 40, 24), am); group.add(a);
      }
      if (ring) {
        const rc = document.createElement('canvas'); rc.width = 512; rc.height = 4; const rg = rc.getContext('2d')!;
        for (let x = 0; x < 512; x++) { const a = (Math.sin(x * 0.17) * 0.5 + 0.5) * (0.4 + 0.6 * hash2(x, 3)) * smoothstep(0, 40, x) * (1 - smoothstep(440, 512, x)); rg.fillStyle = `rgba(220,200,160,${a * 0.9})`; rg.fillRect(x, 0, 1, 4); }
        const rt = new THREE.CanvasTexture(rc);
        const rgm = new THREE.RingGeometry(radius * 1.35, radius * 2.4, 96, 1); const uv = rgm.attributes.uv; const p = rgm.attributes.position;
        for (let i = 0; i < uv.count; i++) { const d = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (d - radius * 1.35) / (radius * 1.05), 0.5); }
        const rm = new THREE.Mesh(rgm, new THREE.MeshBasicMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
        rm.rotation.x = Math.PI / 2 - 0.4; group.add(rm);
      }
      scene.add(group);
      this.planets.push({ name, group, pos: pos.clone(), radius, alive: true, color, spin: rand(0.005, 0.02), kind });
    };
    mk('The Moon', 'moon', new THREE.Vector3(-2200, 5200, -2300), 420, 0xaaaaaa);
    mk('Mars', 'mars', new THREE.Vector3(3500, 7500, 3300), 650, 0xc2603a, false, 0xff7a4a);
    mk('Gas Giant', 'gas', new THREE.Vector3(-4000, 10000, 5400), 1100, 0xd8b070, true, 0xffd9a0);
    mk('Ice World', 'ice', new THREE.Vector3(500, 13500, -5200), 520, 0xa0d8ff, false, 0x80d0ff);
    // space station
    const st = new THREE.Group(); st.position.set(200, 2700, -300);
    const metal = new THREE.MeshStandardMaterial({ color: 0xcfd6dd, metalness: 0.9, roughness: 0.3 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(30, 3, 12, 40), metal); st.add(ring);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 50, 14).rotateX(Math.PI / 2), metal); st.add(hub);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 28), metal); sp.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0); sp.rotation.z = a; sp.rotation.y = Math.PI / 2; st.add(sp); }
    for (const s of [-1, 1]) { const panel = new THREE.Mesh(new THREE.BoxGeometry(60, 0.4, 18), new THREE.MeshStandardMaterial({ color: 0x1a3a7a, metalness: 0.8, roughness: 0.25, emissive: 0x0a1a40, emissiveIntensity: 0.6 })); panel.position.set(0, s * 14, 22); st.add(panel); }
    scene.add(st);
    this.planets.push({ name: 'Orbital Station', group: st, pos: st.position.clone(), radius: 45, alive: true, color: 0xcfd6dd, spin: 0.05, kind: 'station' });
  }

  setWeather(w: string) { this.weather = w; }
  setHour(h: number) { this.hour = ((h % 24) + 24) % 24; }

  rayPlanet(o: THREE.Vector3, d: THREE.Vector3): { planet: Planet; dist: number } | null {
    let best: { planet: Planet; dist: number } | null = null;
    for (const p of this.planets) {
      if (!p.alive) continue;
      const oc = o.clone().sub(p.pos), b = oc.dot(d), c = oc.dot(oc) - p.radius * p.radius * 1.1;
      const disc = b * b - c; if (disc < 0) continue;
      const t = -b - Math.sqrt(disc); if (t > 0 && (!best || t < best.dist)) best = { planet: p, dist: t };
    }
    return best;
  }
  destroyPlanet(p: Planet) {
    const g = this.game;
    p.alive = false; p.group.visible = false;
    const pos = p.pos;
    g.fx.explosion(pos.clone(), Math.min(p.radius * 0.5, 260), undefined, false);
    g.fx.shockwave(pos, p.radius * 4, 0xffe0a0, 2.5, true, true);
    g.fx.shockwave(pos, p.radius * 2.5, 0xff6030, 1.8, false, true);
    g.fx.flash(pos, 0xffddaa, 40, 9000);
    const col = new THREE.Color(p.color);
    for (let i = 0; i < 160; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      const sz = p.radius * rand(0.03, 0.14);
      g.debris.spawn(pos.x + dir.x * p.radius * rand(0.2, 1), pos.y + dir.y * p.radius * rand(0.2, 1), pos.z + dir.z * p.radius * rand(0.2, 1), sz, sz * rand(0.6, 1), sz * rand(0.6, 1), col.clone().multiplyScalar(rand(0.5, 1.1)), dir.x * rand(60, 320), dir.y * rand(60, 320), dir.z * rand(60, 320));
    }
    for (let i = 0; i < 160; i++) { const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); g.fx.add.emit(pos.x + dir.x * p.radius * 0.5, pos.y + dir.y * p.radius * 0.5, pos.z + dir.z * p.radius * 0.5, dir.x * p.radius * rand(0.3, 1.6), dir.y * p.radius * rand(0.3, 1.6), dir.z * p.radius * rand(0.3, 1.6), rand(2, 5), p.radius * rand(0.1, 0.3), p.radius * 0.02, new THREE.Color(0xfff0c0), new THREE.Color(0xff4010), 1, 0, 0.3); }
    g.audio.play('boom', 0, 1.2); g.audio.play('rumble', 0, 1);
    g.shake(1.5);
    g.toast(`${p.name} has been destroyed`, '#ff6a4a');
  }
  restorePlanets() { for (const p of this.planets) { p.alive = true; p.group.visible = true; } }

  update(dt: number, rdt: number, cam: THREE.Vector3, player: THREE.Vector3) {
    const g = this.game;
    this.hour = (this.hour + dt * this.daySpeed * g.hud.get().daySpeed) % 24;
    const W = WEATHER[this.weather] ?? WEATHER.clear, I = this.intensity;
    const k = 1 - Math.exp(-rdt * 0.35 - dt * 0.2);
    const c = this.cur as any;
    for (const key of Object.keys(W)) { const target = (W as any)[key] * ((key === 'rain' || key === 'snow' || key === 'sand') ? I : key === 'fog' && this.weather !== 'clear' ? Math.pow(I, 0.7) : 1); c[key] += (target - c[key]) * k; }
    const ang = ((this.hour - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.32).normalize();
    const sy = this.sunDir.y;
    this.dayF = smoothstep(-0.14, 0.22, sy);
    const tw = (1 - smoothstep(0, 0.42, Math.abs(sy)));
    this.space = smoothstep(600, 2300, cam.y);
    const over = clamp(this.cur.cloud * 0.55 + this.cur.dark * 0.8, 0, 1);
    const zen = this.tmp.set(0.04, 0.025, 0.07).lerp(this.tmp2.set(0.16, 0.4, 0.85), this.dayF);
    const hor = new THREE.Color(0.03, 0.045, 0.1).lerp(this.tmp2.set(0.66, 0.8, 0.95), this.dayF);
    hor.lerp(this.tmp2.set(1, 0.5, 0.25), tw * 0.8 * (1 - over * 0.6) * (0.3 + 0.7 * this.dayF));
    zen.lerp(this.tmp2.set(0.28, 0.2, 0.42), tw * 0.3 * this.dayF);
    const grey = new THREE.Color(0.5, 0.53, 0.58).multiplyScalar(0.07 + 0.93 * this.dayF);
    zen.lerp(grey.clone().multiplyScalar(0.85), over * 0.8); hor.lerp(grey, over * 0.85);
    if (this.cur.sand > 0.02) { const sc = new THREE.Color(0.75, 0.5, 0.28).multiplyScalar(0.15 + 0.85 * this.dayF); zen.lerp(sc, this.cur.sand * 0.8); hor.lerp(sc, this.cur.sand * 0.9); }
    if (this.apocalypse > 0.01) { const ac = new THREE.Color(0.35, 0.06, 0.03); zen.lerp(ac.clone().multiplyScalar(0.5), this.apocalypse * 0.8); hor.lerp(new THREE.Color(0.8, 0.2, 0.05), this.apocalypse * 0.6); }
    zen.lerp(this.tmp2.set(0, 0, 0), this.space); hor.lerp(this.tmp2.set(0, 0, 0.01), this.space);
    const u = this.domeMat.uniforms;
    u.uZen.value.copy(zen).convertSRGBToLinear(); u.uHor.value.copy(hor).convertSRGBToLinear(); u.uSun.value.copy(this.sunDir);
    u.uNight.value = 1 - this.dayF; u.uSpace.value = this.space; u.uOver.value = over;
    this.flashI = Math.max(0, this.flashI - rdt * 4); u.uFlash.value = this.flashI * 0.7;
    u.uSunCol.value.set(1, 0.92 - tw * 0.3, 0.75 - tw * 0.4); u.uGlow.value.set(1, 0.65 - tw * 0.1, 0.35);
    this.dome.position.copy(cam);
    uniforms.night.value = (1 - this.dayF) * (1 - this.space * 0.9); uniforms.time.value += rdt;
    // lights
    const dayI = 3.4 * this.dayF * (1 - 0.65 * over) + this.flashI * 2;
    const moonI = 0.6 * (1 - this.dayF) * (1 - over * 0.5);
    const ldir = new THREE.Vector3().lerpVectors(this.sunDir.clone().negate(), this.sunDir, this.dayF).normalize();
    ldir.lerp(this.sunDir, this.space).normalize();
    this.sun.intensity = lerp(dayI + moonI, 4, this.space) * (1 - this.apocalypse * 0.4);
    this.sun.color.setRGB(1, 0.96 - tw * 0.3, 0.88 - tw * 0.5).lerp(this.tmp2.set(0.55, 0.65, 1), 1 - this.dayF);
    this.sun.color.lerp(this.tmp2.set(1, 0.4, 0.2), this.apocalypse * 0.6);
    const snap = (this.shadowSize * 2) / 2048;
    const tx = Math.round(player.x / snap) * snap, ty = Math.round(player.y / snap) * snap, tz = Math.round(player.z / snap) * snap;
    this.sun.target.position.set(tx, ty, tz);
    this.sun.position.set(tx + ldir.x * 500, ty + ldir.y * 500, tz + ldir.z * 500);
    this.sun.target.updateMatrixWorld();
    this.hemi.color.copy(hor).lerp(this.tmp2.set(0.4, 0.55, 0.9), 0.4).convertSRGBToLinear(); this.hemi.groundColor.setRGB(0.22, 0.2, 0.16).multiplyScalar(0.3 + this.dayF * 0.7);
    this.hemi.intensity = (0.18 + 0.5 * this.dayF + 0.12 * (1 - this.dayF)) * (1 - this.space * 0.7) + this.flashI * 0.6;
    g.scene.environmentIntensity = (0.08 + 0.85 * this.dayF * (1 - over * 0.5)) * (1 - this.space * 0.3);
    // fog
    const fog = g.scene.fog as THREE.FogExp2;
    if (this.underwater) { fog.color.setRGB(0.02, 0.27, 0.36).convertSRGBToLinear().multiplyScalar(0.15 + 0.85 * this.dayF); fog.density = 0.028; }
    else { fog.color.copy(hor).convertSRGBToLinear(); fog.density = this.cur.fog * (1 - this.space) * (1 + (1 - this.dayF) * 0.3); }
    this.fogCol.copy(fog.color);
    // clouds
    const cloudsVisible = this.space < 0.5 && !this.underwater;
    this.cloudGroup.visible = cloudsVisible;
    if (cloudsVisible) {
      const dark = clamp(this.cur.dark, 0, 1);
      this.cloudMat.color.setRGB(1, 1, 1).multiplyScalar(0.15 + 0.85 * this.dayF).lerp(this.tmp2.set(0.22, 0.23, 0.27), dark * 0.85);
      this.cloudMat.color.lerp(this.tmp2.set(1, 0.6, 0.4), tw * 0.35 * (1 - dark));
      const wind = this.cur.wind;
      for (const s of this.clouds) {
        s.visible = (s.userData.r as number) < this.cur.cloud;
        s.position.x += wind * dt * 2; s.position.z += wind * dt * 0.7;
        const dx = s.position.x - cam.x, dz = s.position.z - cam.z;
        if (dx > 3500) s.position.x -= 7000; if (dx < -3500) s.position.x += 7000; if (dz > 3500) s.position.z -= 7000; if (dz < -3500) s.position.z += 7000;
        s.position.y = (650 + (s.userData.r as number) * 300) - dark * 250;
      }
    }
    // precip
    const sc = g.fx.add.mat.uniforms.uScale.value;
    const upd = (p: Precip, v: number, wind: number) => {
      const vis = v > 0.02 && !this.underwater && this.space < 0.3 && cam.y < 700; p.obj.visible = vis;
      if (!vis) return;
      const m = p.mat.uniforms; m.uCam.value.copy(cam); m.uTime.value = uniforms.time.value; m.uInt.value = clamp(v, 0, 1); m.uWind.value.set(wind * 0.5, wind * 0.2); m.uScale.value = sc;
    };
    upd(this.rain, this.cur.rain * 0.9, this.cur.wind); upd(this.snow, this.cur.snow, this.cur.wind * 0.4); upd(this.sand, this.cur.sand, this.cur.wind);
    // thunder
    if (this.cur.storm > 0.4 && this.space < 0.3 && dt > 0) {
      this.thunderT -= dt;
      if (this.thunderT < 0) {
        this.thunderT = rand(1.4, 5) / Math.max(0.4, I);
        const a = rand(0, 6.28), d = rand(40, 450);
        const tp = new THREE.Vector3(player.x + Math.cos(a) * d, 0, player.z + Math.sin(a) * d);
        if (Math.random() < 0.55) { const b = g.city.nearestBuilding(tp.x, tp.z, 200); if (b) { tp.x = b.x; tp.z = b.z; } }
        tp.y = Math.max(g.terrain.heightAt(tp.x, tp.z), g.city.heightAt(tp.x, tp.z, 900));
        g.strike(tp, false);
      }
    }
    // planets
    for (const p of this.planets) { if (p.alive) p.group.rotation.y += p.spin * rdt * 0.2; }
    const showPlanets = this.space > 0.02 || this.dayF < 0.5;
    for (const p of this.planets) if (p.alive) p.group.visible = showPlanets;
  }
  flash(v = 1) { this.flashI = Math.max(this.flashI, v); }
  get hourStr() { const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
}
