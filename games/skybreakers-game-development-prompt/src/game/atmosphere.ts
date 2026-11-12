// Sky dome, sun/moon lighting, fog, weather (rain lines), ambient biome particles.
import * as THREE from 'three';
import { fx } from './fx';
import { G, clamp, rand } from './runtime';
import { PALETTE, islandAt } from './world';
import { sunElev } from './events';

const skyVS = `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const skyFS = `varying vec3 vP; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBot; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uNight; uniform float uTime;
float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){ vec3 d=normalize(vP); float h=d.y; vec3 col = h>0.0 ? mix(uHor,uTop,pow(h,0.55)) : mix(uHor,uBot,pow(-h,0.5));
 float sd=max(dot(d,uSun),0.0); col+=uSunCol*(pow(sd,900.0)*3.0+pow(sd,12.0)*0.35+pow(sd,3.0)*0.12);
 float md=max(dot(d,-uSun),0.0); col+=vec3(0.75,0.82,1.0)*pow(md,1200.0)*2.0*uNight;
 vec3 sp=floor(d*220.0); float st=step(0.9965,hash(sp))*uNight*smoothstep(0.0,0.2,h); col+=vec3(st)*(0.6+0.4*sin(uTime*3.0+hash(sp+1.0)*40.0));
 float aur=smoothstep(0.1,0.5,h)*smoothstep(0.7,0.3,h)*uNight*0.12*(0.5+0.5*sin(d.x*6.0+uTime*0.2)); col+=vec3(0.2,0.9,0.7)*aur;
 gl_FragColor=vec4(col,1.0); }`;

const C = (h: string) => new THREE.Color(h);
const DAY_TOP = C('#2f78d8'), DAY_HOR = C('#c4e6ff'), SET_TOP = C('#3a4a8a'), SET_HOR = C('#ff9a5a'), NIGHT_TOP = C('#04060f'), NIGHT_HOR = C('#16204a'), BOT = C('#8ab4e0'), STORM = C('#4a5260');
export interface Atmos { sky: THREE.Mesh; sun: THREE.DirectionalLight; moon: THREE.DirectionalLight; hemi: THREE.HemisphereLight; fog: THREE.Fog; update: (dt: number, cam: THREE.Camera, focus: THREE.Vector3) => void; rain: THREE.LineSegments; setQuality: (q: string) => void; tint: THREE.Color; tintTop: THREE.Color }

export function createAtmosphere(scene: THREE.Scene, quality: string): Atmos {
  const uni = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#ffd9a0') }, uNight: { value: 0 }, uTime: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({ vertexShader: skyVS, fragmentShader: skyFS, uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false })); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  const hemi = new THREE.HemisphereLight('#bfe0ff', '#8a7a60', 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d0', 2); sun.castShadow = quality !== 'low'; sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024); const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 400; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5; scene.add(sun, sun.target);
  const moon = new THREE.DirectionalLight('#8aa0ff', 0); scene.add(moon);
  const fog = new THREE.Fog('#bfe0ff', 100, 1400); scene.fog = fog;
  // rain
  const RN = 1400; const rp = new Float32Array(RN * 6); for (let i = 0; i < RN; i++) { const x = rand(-50, 50), y = rand(-30, 30), z = rand(-50, 50); rp[i * 6] = x; rp[i * 6 + 1] = y; rp[i * 6 + 2] = z; rp[i * 6 + 3] = x - 0.15; rp[i * 6 + 4] = y - 1.6; rp[i * 6 + 5] = z; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b8d0ff', transparent: true, opacity: 0.45, fog: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const tint = new THREE.Color('#ffffff'), tintTop = new THREE.Color('#ffffff'); let tintAmt = 0; const tmpA = new THREE.Color(), tmpB = new THREE.Color(), sunDir = new THREE.Vector3(); let ambT = 0; let q = quality;
  return { sky, sun, moon, hemi, fog, rain, tint, tintTop, setQuality: (nq: string) => { q = nq; sun.castShadow = nq !== 'low'; },
    update: (dt, cam, focus) => {
      const e = sunElev(); const dayF = clamp((e + 0.12) / 0.5, 0, 1); const setF = clamp(1 - Math.abs(e) * 3.2, 0, 1) * (e > -0.25 ? 1 : 0); const w = G.weather; const isl = islandAt(focus.x, focus.z);
      uni.uTime.value += dt; const tgt = isl && Math.abs(focus.y - isl.y) < 140 ? PALETTE[isl.biome] : null; const want = tgt ? (isl!.biome === 'ember' || isl!.biome === 'shadow' ? 0.65 : isl!.biome === 'emerald' ? 0.0 : 0.35) : 0; tintAmt += (want - tintAmt) * Math.min(1, dt * 0.8); if (tgt) { tint.lerp(tmpA.set(tgt.sky[1]), Math.min(1, dt * 0.8)); tintTop.lerp(tmpB.set(tgt.sky[0]), Math.min(1, dt * 0.8)); }
      const top = uni.uTop.value.copy(NIGHT_TOP).lerp(DAY_TOP, dayF).lerp(SET_TOP, setF * 0.8); const hor = uni.uHor.value.copy(NIGHT_HOR).lerp(DAY_HOR, dayF).lerp(SET_HOR, setF * 0.85);
      const nightF = 1 - dayF; top.lerp(tmpA.copy(tintTop).multiplyScalar(0.25 + dayF * 0.75), tintAmt * 0.8); hor.lerp(tmpA.copy(tint).multiplyScalar(0.2 + dayF * 0.8), tintAmt); top.lerp(STORM, w.i * 0.55 * (0.3 + dayF * 0.7)); hor.lerp(tmpB.copy(STORM).multiplyScalar(0.6 + dayF * 0.6), w.i * 0.6);
      if (w.flash > 0) { top.lerp(tmpA.set('#ffffff'), w.flash * 0.7); hor.lerp(tmpA, w.flash * 0.7); }
      uni.uBot.value.copy(hor).lerp(BOT, 0.4 * dayF); uni.uNight.value = clamp(nightF * 1.3 - w.i * 0.6, 0, 1);
      sunDir.set(Math.cos((G.dayT - 0.25) * Math.PI * 2) * 0.8, e, 0.45).normalize(); uni.uSun.value.copy(sunDir); uni.uSunCol.value.set('#ffd9a0').lerp(tmpA.set('#ff8a40'), setF).multiplyScalar(1 - w.i * 0.8);
      sky.position.copy(cam.position);
      sun.position.copy(focus).addScaledVector(sunDir, 200); sun.target.position.copy(focus); sun.intensity = Math.max(0, e + 0.05) * 2.4 * (1 - w.i * 0.55); sun.color.set('#fff3dd').lerp(tmpA.set('#ff9a5a'), setF * 0.8);
      moon.position.copy(focus).addScaledVector(sunDir, -200); moon.intensity = nightF * 0.55 * (1 - w.i * 0.5);
      hemi.intensity = 0.28 + dayF * 0.7 - w.i * 0.18; hemi.color.copy(hor).lerp(tmpA.set('#ffffff'), 0.5); hemi.groundColor.set('#6a5a48').lerp(tmpA.set('#101830'), nightF);
      fog.color.copy(hor); fog.near = 80 - w.i * 40; fog.far = (q === 'low' ? 900 : 1500) - w.i * 800;
      // rain
      const raining = w.type === 'rain' || w.type === 'storm'; const frost = isl?.biome === 'frost'; rain.visible = raining && w.i > 0.3; if (rain.visible) { const a = rain.geometry.attributes.position as THREE.BufferAttribute; const arr = a.array as Float32Array; const sp = (w.type === 'storm' ? 70 : 50) * dt; for (let i = 0; i < 1400; i++) { arr[i * 6 + 1] -= sp; arr[i * 6 + 4] -= sp; if (arr[i * 6 + 1] < -30) { const x = rand(-50, 50), z = rand(-50, 50); arr[i * 6] = x; arr[i * 6 + 1] = 30; arr[i * 6 + 2] = z; arr[i * 6 + 3] = x - 0.2 - (w.type === 'storm' ? 0.5 : 0); arr[i * 6 + 4] = 28.4; arr[i * 6 + 5] = z; } } a.needsUpdate = true; rain.position.copy(cam.position); (rain.material as THREE.LineBasicMaterial).opacity = 0.2 + w.i * 0.3; }
      // ambient particles
      ambT += dt; if (ambT > 0.06) { ambT = 0; const cp = cam.position; const b = isl?.biome; const o = () => rand(-35, 35); const y0 = focus.y;
        if (frost || (w.type === 'cloudy' && b === 'frost')) fx.emit(cp.x + o(), cp.y + rand(5, 25), cp.z + o(), rand(-1, 1), -3.5, rand(-1, 1), '#ffffff', 0.35, 4, 0, 0, 0, 0.85);
        else if (b === 'ember') fx.emit(cp.x + o(), y0 + rand(0, 8), cp.z + o(), rand(-1, 1), rand(3, 6), rand(-1, 1), Math.random() < 0.5 ? '#ff8a2a' : '#ffd23a', 0.3, 4, 0, 0, 0, 0.9);
        else if (b === 'shadow') fx.emit(cp.x + o(), y0 + rand(0, 6), cp.z + o(), rand(-1, 1), rand(0.5, 2), rand(-1, 1), '#9a4aff', 0.5, 4, 0, 0, 0, 0.6);
        else if (b === 'celestial') fx.emit(cp.x + o(), y0 + rand(0, 14), cp.z + o(), rand(-0.5, 0.5), rand(0.5, 2), rand(-0.5, 0.5), Math.random() < 0.5 ? '#ffe9a0' : '#bfe8ff', 0.35, 5, 0, 0, 0, 0.9);
        else if (b === 'ruins') fx.emit(cp.x + o(), y0 + rand(0, 6), cp.z + o(), rand(1, 3), rand(-0.2, 0.5), rand(-1, 1), '#e8dcc0', 0.25, 4, 0, 0, 0, 0.5);
        else if (b === 'emerald' && w.type !== 'rain' && w.type !== 'storm') fx.emit(cp.x + o(), y0 + rand(0, 8), cp.z + o(), rand(-0.6, 0.6), rand(0.2, 1), rand(-0.6, 0.6), Math.random() < 0.5 ? '#dfff9a' : '#ffffff', 0.25, 5, 0, 0, 0, 0.7); } },
  };
}
