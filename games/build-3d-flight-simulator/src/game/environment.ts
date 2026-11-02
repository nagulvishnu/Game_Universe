import * as THREE from 'three';
import { clamp, hash2, lerp, mulberry32, smoothstep } from './noise';
import { cloudPuffTexture, glowTexture } from './textures';

/* ------------------------------------------------------------------ */
/* Weather & atmosphere                                                */
/* ------------------------------------------------------------------ */
export type WeatherId = 'clear' | 'partly' | 'overcast' | 'rain' | 'storm';
export interface WeatherState {
  cloud: number; dark: number; fog: number; rain: number; storm: number; turb: number; wind: number; sea: number;
}
export const WEATHER: Record<WeatherId, WeatherState> = {
  clear: { cloud: 0.22, dark: 0, fog: 3.0e-5, rain: 0, storm: 0, turb: 0.04, wind: 4, sea: 0.5 },
  partly: { cloud: 0.55, dark: 0.12, fog: 3.8e-5, rain: 0, storm: 0, turb: 0.14, wind: 8, sea: 0.7 },
  overcast: { cloud: 0.92, dark: 0.55, fog: 6.5e-5, rain: 0, storm: 0, turb: 0.3, wind: 11, sea: 0.9 },
  rain: { cloud: 1, dark: 0.72, fog: 1.35e-4, rain: 0.6, storm: 0, turb: 0.45, wind: 13, sea: 1.2 },
  storm: { cloud: 1, dark: 0.96, fog: 2.3e-4, rain: 1, storm: 1, turb: 0.85, wind: 19, sea: 1.8 },
};
export const WEATHER_LABEL: Record<WeatherId, string> = { clear: 'Clear', partly: 'Partly Cloudy', overcast: 'Overcast', rain: 'Rain', storm: 'Thunderstorm' };
export const WEATHER_ORDER: WeatherId[] = ['clear', 'partly', 'overcast', 'rain', 'storm'];

export function lerpWeather(a: WeatherState, b: WeatherState, k: number) {
  for (const key of Object.keys(a) as (keyof WeatherState)[]) a[key] = lerp(a[key], b[key], k);
}

const KEYS: { e: number; zen: number; hor: number }[] = [
  { e: -0.3, zen: 0x02040c, hor: 0x060a16 },
  { e: -0.1, zen: 0x050b20, hor: 0x141a38 },
  { e: -0.01, zen: 0x1a2a5c, hor: 0xd8643a },
  { e: 0.1, zen: 0x3568b8, hor: 0xffaa66 },
  { e: 0.3, zen: 0x3d84d6, hor: 0xa6c9ee },
  { e: 1, zen: 0x2f78d8, hor: 0xb4d4f4 },
];

export interface Atmosphere {
  sunDir: THREE.Vector3;
  moonDir: THREE.Vector3;
  zenith: THREE.Color;
  horizon: THREE.Color;
  fog: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  lightDir: THREE.Vector3;
  lightColor: THREE.Color;
  lightIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  night: number;
  stars: number;
  elevation: number;
}

export function createAtmosphere(): Atmosphere {
  return {
    sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), zenith: new THREE.Color(), horizon: new THREE.Color(), fog: new THREE.Color(),
    sunColor: new THREE.Color(), sunIntensity: 1, lightDir: new THREE.Vector3(), lightColor: new THREE.Color(), lightIntensity: 1,
    hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiIntensity: 1, night: 0, stars: 0, elevation: 1,
  };
}

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
export function computeAtmosphere(out: Atmosphere, hour: number, w: WeatherState, flash: number) {
  const a = ((hour - 6) / 24) * Math.PI * 2;
  out.sunDir.set(Math.cos(a), Math.sin(a), 0.28).normalize();
  out.moonDir.copy(out.sunDir).multiplyScalar(-1);
  const e = out.sunDir.y;
  out.elevation = e;
  let i = 0;
  while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
  const k0 = KEYS[i];
  const k1 = KEYS[i + 1];
  const t = clamp((e - k0.e) / (k1.e - k0.e), 0, 1);
  out.zenith.set(k0.zen).lerp(_c1.set(k1.zen), t);
  out.horizon.set(k0.hor).lerp(_c2.set(k1.hor), t);
  const day = smoothstep(-0.05, 0.3, e);
  // weather greying
  const lum = (c: THREE.Color) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  const gz = lum(out.zenith) * (1 - 0.5 * w.dark) + 0.02;
  const gh = lum(out.horizon) * (1 - 0.35 * w.dark) + 0.02;
  out.zenith.lerp(_c1.setRGB(gz * 0.95, gz, gz * 1.05), w.dark * 0.9);
  out.horizon.lerp(_c1.setRGB(gh, gh * 1.02, gh * 1.06), w.dark * 0.85);
  if (flash > 0) {
    out.zenith.lerp(_c1.setRGB(0.8, 0.85, 1), flash * 0.6);
    out.horizon.lerp(_c1.setRGB(0.8, 0.85, 1), flash * 0.6);
  }
  out.fog.copy(out.horizon);
  out.sunColor.setRGB(1, 0.62 + 0.38 * smoothstep(0, 0.45, e), 0.38 + 0.6 * smoothstep(0.05, 0.6, e));
  out.sunIntensity = day * (1 - w.dark * 0.7);
  out.night = 1 - smoothstep(-0.2, 0.04, e);
  out.stars = out.night * (1 - w.dark * 0.95);
  // directional light: sun by day, moon by night
  const moonI = 0.9 * out.night * (1 - w.dark * 0.6);
  const sunI = 3.1 * day * (1 - w.dark * 0.75);
  if (sunI >= moonI) {
    out.lightDir.copy(out.sunDir);
    out.lightColor.copy(out.sunColor);
    out.lightIntensity = sunI;
  } else {
    out.lightDir.copy(out.moonDir);
    out.lightColor.setRGB(0.55, 0.65, 0.95);
    out.lightIntensity = moonI;
  }
  out.lightIntensity += flash * 2;
  out.hemiSky.copy(out.zenith).lerp(_c1.setRGB(1, 1, 1), 0.35).lerp(_c2.setRGB(0.22, 0.3, 0.55), out.night * 0.8);
  out.hemiGround.setRGB(0.32, 0.29, 0.24).lerp(_c1.setRGB(0.08, 0.1, 0.16), out.night);
  out.hemiIntensity = ((0.55 + 0.4 * day) * (1 - w.dark * 0.25) + 0.45 * out.night + flash * 0.8) * 1.9;
}

/* ------------------------------------------------------------------ */
/* Sky dome                                                            */
/* ------------------------------------------------------------------ */
export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uStars: { value: 0 }, uDark: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = position;
        vec4 p = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w * 0.9999;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHorizon, uSunDir, uSunColor, uMoonDir; uniform float uStars, uDark;
      varying vec3 vDir;
      float h31(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.45));
        float s = max(dot(d, uSunDir), 0.0);
        float glow = pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.5;
        col += uSunColor * glow * (1.0 - uDark * 0.85) * smoothstep(-0.15, 0.1, uSunDir.y);
        float disk = smoothstep(0.9993, 0.9998, s);
        col += uSunColor * disk * 6.0 * (1.0 - uDark) * smoothstep(-0.05, 0.05, uSunDir.y);
        float m = max(dot(d, uMoonDir), 0.0);
        col += vec3(0.85,0.9,1.0) * smoothstep(0.99965, 0.9999, m) * 1.6 * (1.0 - uDark) * step(0.0, uMoonDir.y);
        if (uStars > 0.01 && d.y > 0.0) {
          vec3 g = floor(d * 260.0);
          float r = h31(g);
          float star = step(0.9965, r) * (0.5 + 0.5 * h31(g + 7.3));
          col += vec3(star) * uStars * smoothstep(0.0, 0.15, d.y);
        }
        col = mix(col, uHorizon, smoothstep(0.0, -0.08, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(60000, 32, 20), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, mat };
}

/* ------------------------------------------------------------------ */
/* Ocean                                                               */
/* ------------------------------------------------------------------ */
export function createOcean() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uSunI: { value: 1 },
      uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uDeep: { value: new THREE.Color(0x06324f) },
      uShallow: { value: new THREE.Color(0x1d7f9a) }, uSea: { value: 0.6 }, uNight: { value: 0 },
    },
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime, uSunI, uSea, uNight; uniform vec3 uSunDir, uSunColor, uHorizon, uZenith, uDeep, uShallow;
      varying vec3 vWorld;
      vec2 wv(vec2 p, vec2 dir, float f, float a, float sp){
        float ph = dot(p, normalize(dir)) * f + uTime * sp;
        return normalize(dir) * a * f * cos(ph);
      }
      void main(){
        vec3 V = cameraPosition - vWorld;
        float dist = length(V);
        V /= dist;
        vec2 p = vWorld.xz;
        vec2 g = wv(p, vec2(1.0,0.35), 0.09, 0.55, 1.1) + wv(p, vec2(-0.4,1.0), 0.17, 0.3, 1.5) + wv(p, vec2(0.7,-0.8), 0.33, 0.14, 2.1)
               + wv(p, vec2(-1.0,-0.3), 0.7, 0.05, 2.7) + wv(p, vec2(0.2,1.0), 1.3, 0.02, 3.3);
        g *= uSea * (1.0 / (1.0 + dist * 0.00025));
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        float ry = clamp(R.y, 0.0, 1.0);
        vec3 sky = mix(uHorizon, uZenith, pow(ry, 0.5));
        float diff = max(dot(N, uSunDir), 0.0) * uSunI * 0.5 + 0.18 + 0.1 * (1.0 - uNight);
        vec3 water = mix(uDeep, uShallow, 0.25 + 0.35 * clamp(N.y*N.y*N.y*0.0 + g.x*0.6 + 0.3, 0.0, 1.0)) * diff;
        float sp = pow(max(dot(R, uSunDir), 0.0), 260.0) * 3.0 + pow(max(dot(R, uSunDir), 0.0), 18.0) * 0.18;
        vec3 col = mix(water, sky, fres) + uSunColor * sp * uSunI;
        float crest = smoothstep(0.55, 0.95, length(g) * 3.0) * uSea * 0.35;
        col += vec3(crest) * (0.4 + 0.6 * diff);
        float alpha = mix(0.84, 1.0, fres);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(130000, 130000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return { mesh, mat };
}

/* ------------------------------------------------------------------ */
/* Clouds                                                              */
/* ------------------------------------------------------------------ */
export class CloudSystem {
  mesh: THREE.InstancedMesh;
  mat: THREE.ShaderMaterial;
  private data: Float32Array; // x,y,z,scale
  private rnd: Float32Array; // threshold, shade
  readonly count: number;
  private box = 40000;
  private wind = new THREE.Vector2(1, 0);
  private t = 0;

  constructor(count = 900) {
    this.count = count;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    this.data = new Float32Array(count * 4);
    this.rnd = new Float32Array(count * 2);
    const r = mulberry32(1234);
    let k = 0;
    while (k < count) {
      const high = r() < 0.28;
      const cx = r() * this.box;
      const cz = r() * this.box;
      const cy = high ? 4200 + r() * 2600 : 1300 + r() * 1700;
      const n = high ? 6 : 8 + Math.floor(r() * 7);
      const rad = high ? 1400 : 650;
      const thr = r();
      for (let i = 0; i < n && k < count; i++, k++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * rad;
        this.data[k * 4] = cx + Math.cos(a) * d;
        this.data[k * 4 + 1] = cy + (r() - 0.35) * (high ? 120 : 380) * (1 - d / rad * 0.6);
        this.data[k * 4 + 2] = cz + Math.sin(a) * d;
        this.data[k * 4 + 3] = (high ? 1300 : 520) * (0.6 + r() * 0.9) * (1 - 0.35 * (d / rad));
        this.rnd[k * 2] = thr;
        this.rnd[k * 2 + 1] = r();
      }
    }
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(this.data, 4));
    geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(this.rnd, 2));
    geo.instanceCount = count;
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uMap: { value: cloudPuffTexture() }, uCam: { value: new THREE.Vector3() }, uBox: { value: this.box }, uCover: { value: 0.3 },
        uWind: { value: new THREE.Vector2() }, uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.65, 0.75) },
        uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 4e-5 }, uScale: { value: 1 }, uOpacity: { value: 0.85 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aData; attribute vec2 aRand;
        uniform vec3 uCam; uniform float uBox, uCover, uScale; uniform vec2 uWind;
        varying vec2 vUv; varying float vShade; varying float vDist; varying float vHigh;
        void main(){
          vec3 p = aData.xyz;
          p.xz += uWind;
          p.xz = mod(p.xz - uCam.xz + uBox*0.5, uBox) - uBox*0.5 + uCam.xz;
          float vis = step(aRand.x, uCover);
          float s = aData.w * uScale * vis;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          mv.xy += position.xy * s;
          gl_Position = projectionMatrix * mv;
          vUv = uv; vShade = aRand.y; vDist = -mv.z; vHigh = step(3500.0, aData.y);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uLit, uShade, uFogColor; uniform float uFogDensity, uOpacity;
        varying vec2 vUv; varying float vShade; varying float vDist; varying float vHigh;
        void main(){
          float a = texture2D(uMap, vUv).a;
          float near = smoothstep(60.0, 420.0, vDist);
          a *= near * uOpacity * (1.0 - vHigh * 0.45);
          if (a < 0.01) discard;
          vec3 col = mix(uShade, uLit, clamp(vUv.y * 0.9 + vShade * 0.25, 0.0, 1.0));
          float f = 1.0 - exp(-pow(vDist * uFogDensity, 2.0));
          col = mix(col, uFogColor, f * 0.8);
          gl_FragColor = vec4(col, a * (1.0 - f * 0.5));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo as unknown as THREE.BufferGeometry, this.mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  update(dt: number, cam: THREE.Vector3, windVec: THREE.Vector2, w: WeatherState, atm: Atmosphere) {
    this.t += dt;
    this.wind.addScaledVector(windVec, dt);
    const u = this.mat.uniforms;
    u.uCam.value.copy(cam);
    u.uWind.value.copy(this.wind);
    u.uCover.value = w.cloud;
    u.uScale.value = 1 + w.storm * 0.5;
    const day = clamp(0.25 + 0.8 * atm.sunIntensity + 0.1, 0, 1.05);
    const dark = 1 - 0.65 * w.dark;
    u.uLit.value.copy(atm.sunColor).multiplyScalar(day * dark).lerp(atm.horizon, 0.25).addScalar(0.02);
    u.uShade.value.copy(atm.zenith).lerp(atm.horizon, 0.5).multiplyScalar((0.35 + 0.5 * day) * (1 - 0.55 * w.dark)).addScalar(0.02);
    u.uFogColor.value.copy(atm.fog);
    u.uOpacity.value = 0.55 + 0.35 * w.cloud;
  }

  /** Approximate cloud density at a world position (0..1) used for in-cloud effects. */
  densityAt(p: THREE.Vector3, cover: number, scaleMul: number): number {
    if (p.y < 900 || p.y > 3400) return 0;
    let d = 0;
    const B = this.box;
    const wx = this.wind.x;
    const wz = this.wind.y;
    for (let i = 0; i < this.count; i++) {
      if (this.rnd[i * 2] > cover) continue;
      const dy = Math.abs(this.data[i * 4 + 1] - p.y);
      const s = this.data[i * 4 + 3] * scaleMul * 0.45;
      if (dy > s) continue;
      let dx = this.data[i * 4] + wx - p.x;
      let dz = this.data[i * 4 + 2] + wz - p.z;
      dx = ((dx % B) + B * 1.5) % B - B / 2;
      dz = ((dz % B) + B * 1.5) % B - B / 2;
      if (Math.abs(dx) > s || Math.abs(dz) > s) continue;
      const dd = Math.sqrt(dx * dx + dz * dz + dy * dy) / s;
      if (dd < 1) d += (1 - dd) * 0.6;
    }
    return clamp(d, 0, 1);
  }
}

/* ------------------------------------------------------------------ */
/* Rain                                                                */
/* ------------------------------------------------------------------ */
export class RainSystem {
  mesh: THREE.LineSegments;
  mat: THREE.ShaderMaterial;
  private offset = new THREE.Vector3();

  constructor(count = 3200) {
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(count * 2 * 3);
    const end = new Float32Array(count * 2);
    const rnd = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const sx = hash2(i, 1, 5), sy = hash2(i, 2, 5), sz = hash2(i, 3, 5), rr = hash2(i, 4, 5);
      for (let k = 0; k < 2; k++) {
        seed.set([sx, sy, sz], (i * 2 + k) * 3);
        end[i * 2 + k] = k;
        rnd[i * 2 + k] = rr;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uCam: { value: new THREE.Vector3() }, uOff: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, -1, 0) }, uLen: { value: 1 }, uInt: { value: 0 }, uBox: { value: 70 }, uColor: { value: new THREE.Color(0.7, 0.75, 0.85) } },
      vertexShader: /* glsl */ `
        attribute vec3 aSeed; attribute float aEnd; attribute float aRand;
        uniform vec3 uCam, uOff, uDir; uniform float uLen, uInt, uBox;
        varying float vA;
        void main(){
          vec3 q = mod(aSeed * uBox + uOff - uCam, uBox) - uBox * 0.5;
          vec3 p = uCam + q - uDir * uLen * aEnd;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float vis = step(aRand, uInt);
          if (vis < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          vA = (1.0 - aEnd * 0.8) * 0.45 * smoothstep(2.0, 12.0, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main(){
          gl_FragColor = vec4(uColor, vA);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.LineSegments(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
  }

  update(dt: number, cam: THREE.Vector3, planeVel: THREE.Vector3, intensity: number) {
    const rainV = new THREE.Vector3(0, -14, 0);
    this.offset.addScaledVector(rainV, dt);
    const u = this.mat.uniforms;
    u.uCam.value.copy(cam);
    u.uOff.value.copy(this.offset);
    u.uOff.value.x = ((u.uOff.value.x % 70) + 70) % 70;
    u.uOff.value.y = ((u.uOff.value.y % 70) + 70) % 70;
    u.uOff.value.z = ((u.uOff.value.z % 70) + 70) % 70;
    const rel = rainV.clone().sub(planeVel);
    const sp = rel.length();
    u.uDir.value.copy(rel).multiplyScalar(1 / Math.max(sp, 0.1));
    u.uLen.value = clamp(sp * 0.035, 0.5, 6);
    u.uInt.value = intensity;
    this.mesh.visible = intensity > 0.02;
  }
}

/* ------------------------------------------------------------------ */
/* Particles (smoke, fire, contrails)                                  */
/* ------------------------------------------------------------------ */
export class ParticleSystem {
  points: THREE.Points;
  private cap: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private col: Float32Array;
  private a0: Float32Array;
  private aSize: Float32Array;
  private aCol: Float32Array;
  private head = 0;
  private mat: THREE.ShaderMaterial;
  private drag: number;

  constructor(cap: number, additive: boolean, drag = 0.4) {
    this.cap = cap;
    this.drag = drag;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap).fill(0);
    this.maxLife = new Float32Array(cap).fill(1);
    this.s0 = new Float32Array(cap);
    this.s1 = new Float32Array(cap);
    this.col = new Float32Array(cap * 3);
    this.a0 = new Float32Array(cap);
    this.aSize = new Float32Array(cap);
    this.aCol = new Float32Array(cap * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCol', new THREE.BufferAttribute(this.aCol, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 800 }, uMap: { value: glowTexture() } },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute vec4 aCol; uniform float uScale; varying vec4 vCol;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale / max(-mv.z, 1.0), 0.0, 400.0);
          vCol = aCol;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec4 vCol;
        void main(){
          float a = texture2D(uMap, gl_PointCoord).a * vCol.a;
          gl_FragColor = vec4(vCol.rgb, a);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 15;
  }

  setScale(pxPerUnit: number) { this.mat.uniforms.uScale.value = pxPerUnit; }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, r: number, g: number, b: number, a: number) {
    const i = this.head;
    this.head = (this.head + 1) % this.cap;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.a0[i] = a;
  }

  update(dt: number) {
    const k = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.aCol[i * 4 + 3] = 0; this.aSize[i] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - Math.max(this.life[i], 0) / this.maxLife[i];
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] *= k; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.aSize[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.aCol[i * 4] = this.col[i * 3]; this.aCol[i * 4 + 1] = this.col[i * 3 + 1]; this.aCol[i * 4 + 2] = this.col[i * 3 + 2];
      this.aCol[i * 4 + 3] = this.a0[i] * (1 - t) * Math.min(1, t * 8);
    }
    const g = this.points.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aCol') as THREE.BufferAttribute).needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* Airport / city light points                                         */
/* ------------------------------------------------------------------ */
export function makeLightPoints(positions: number[], colors: number[], size: number) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aCol', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 800 }, uInt: { value: 0.3 }, uSize: { value: size }, uMin: { value: 2.2 } },
    vertexShader: /* glsl */ `
      attribute vec3 aCol; uniform float uScale, uInt, uSize, uMin; varying vec3 vCol; varying float vI;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = max(-mv.z, 1.0);
        gl_PointSize = max(uMin, uSize * uScale / d);
        vCol = aCol; vI = uInt * exp(-pow(d * 0.000055, 2.0));
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vI;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        a = a * a;
        gl_FragColor = vec4(vCol * vI, a);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 12;
  return { points: pts, mat };
}
