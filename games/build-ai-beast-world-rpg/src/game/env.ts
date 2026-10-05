import * as THREE from "three";
import { smooth, lerp } from "./noise";

export type Weather = "clear" | "rain" | "fog" | "sand" | "snow" | "ash" | "storm";
const TABLE: Weather[][] = [
  ["clear", "clear", "ash", "fog", "ash"],
  ["clear", "rain", "rain", "fog", "storm"],
  ["clear", "clear", "sand", "sand", "clear"],
  ["snow", "snow", "fog", "clear", "snow"],
];
const DAY = { top: new THREE.Color(0x2f72d0), hor: new THREE.Color(0xa6cfee), sun: new THREE.Color(0xfff0d4) };
const GOLD = { top: new THREE.Color(0x35508f), hor: new THREE.Color(0xf0a066), sun: new THREE.Color(0xffa860) };
const NIGHT = { top: new THREE.Color(0x03071a), hor: new THREE.Color(0x14204a), sun: new THREE.Color(0x6f8bd0) };

export class Environment {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh;
  skyMat: THREE.ShaderMaterial;
  fog: THREE.FogExp2;
  time = 0.3;
  weather: Weather = "clear";
  wI = 0;
  nextChange = 40;
  flash = 0;
  nextBolt = 6;
  onThunder?: () => void;
  rain: THREE.LineSegments;
  dust: THREE.Points;
  private rp: Float32Array; private dp: Float32Array;
  private tmpA = new THREE.Color(); private tmpB = new THREE.Color();
  lightDir = new THREE.Vector3();
  sunDir = new THREE.Vector3();
  nightF = 0;
  cur = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color() };

  constructor(scene: THREE.Scene, shadows: boolean) {
    this.scene = scene;
    this.fog = new THREE.FogExp2(0xa6cfee, 0.0012);
    scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0x6b5a48, 0.9);
    this.sun = new THREE.DirectionalLight(0xfff0d4, 2.4);
    this.sun.castShadow = shadows;
    if (shadows) {
      this.sun.shadow.mapSize.set(2048, 2048);
      const c = this.sun.shadow.camera; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 10; c.far = 500;
      this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.6;
    }
    scene.add(this.hemi, this.sun, this.sun.target);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 }, flash: { value: 0 } },
      vertexShader: "varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader: `varying vec3 vD; uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; uniform float flash;
        float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){ vec3 d=normalize(vD); float y=max(d.y,0.0);
          vec3 c=mix(hor, top, pow(y,0.55));
          float s=max(dot(d,sunDir),0.0);
          c+=sunCol*(pow(s,900.0)*3.0+pow(s,12.0)*0.25);
          vec3 sp=floor(d*220.0); float st=step(0.9975,h(sp))*night*smoothstep(0.05,0.4,d.y);
          c+=vec3(st);
          c+=vec3(0.6,0.7,1.0)*flash;
          gl_FragColor=vec4(c,1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), this.skyMat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    scene.add(this.sky);

    const RN = 650;
    this.rp = new Float32Array(RN * 6);
    for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 80, y = Math.random() * 50, z = (Math.random() - 0.5) * 80; this.rp.set([x, y, z, x, y, z], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(this.rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaac4e0, transparent: true, opacity: 0.45, fog: false }));
    this.rain.frustumCulled = false; this.rain.visible = false;
    const DN = 900;
    this.dp = new Float32Array(DN * 3);
    for (let i = 0; i < DN; i++) this.dp.set([(Math.random() - 0.5) * 90, Math.random() * 45, (Math.random() - 0.5) * 90], i * 3);
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(this.dp, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.25, color: 0xffffff, transparent: true, opacity: 0.8, sizeAttenuation: true, fog: false, depthWrite: false }));
    this.dust.frustumCulled = false; this.dust.visible = false;
    scene.add(this.rain, this.dust);
  }

  setWeather(w: Weather) { this.weather = w; this.nextChange = 70 + Math.random() * 90; }

  update(dt: number, cam: THREE.Camera, focus: THREE.Vector3, biome: number, boss: boolean, underwater: boolean) {
    this.time = (this.time + dt / 540) % 1;
    const e = Math.sin((this.time - 0.25) * Math.PI * 2);
    this.nextChange -= dt;
    if (boss) { if (this.weather !== "storm") this.setWeather("storm"); this.nextChange = 30; }
    else if (this.nextChange < 0) { const t = TABLE[biome]; this.setWeather(t[Math.floor(Math.random() * t.length)]); }
    const on = this.weather !== "clear" ? 1 : 0;
    this.wI += (on - this.wI) * Math.min(1, dt * 0.3);

    const dayF = smooth(0.05, 0.42, e), nightF = smooth(0.08, -0.22, e), goldF = Math.max(0, 1 - dayF - nightF);
    this.nightF = nightF;
    for (const k of ["top", "hor", "sun"] as const) {
      const c = this.cur[k];
      c.r = DAY[k].r * dayF + GOLD[k].r * goldF + NIGHT[k].r * nightF;
      c.g = DAY[k].g * dayF + GOLD[k].g * goldF + NIGHT[k].g * nightF;
      c.b = DAY[k].b * dayF + GOLD[k].b * goldF + NIGHT[k].b * nightF;
    }
    // weather darkening
    const gray = this.weather === "storm" ? 0.28 : this.weather === "rain" ? 0.5 : this.weather === "fog" ? 0.75 : this.weather === "sand" ? 0.6 : this.weather === "ash" ? 0.35 : this.weather === "snow" ? 0.7 : 0;
    const lum = (this.cur.hor.r + this.cur.hor.g + this.cur.hor.b) / 3;
    const tint = this.weather === "sand" ? this.tmpA.setRGB(0.75 * lum * 1.4, 0.55 * lum * 1.3, 0.3 * lum * 1.2) : this.weather === "ash" ? this.tmpA.setRGB(lum * 0.9, lum * 0.7, lum * 0.6) : this.tmpA.setRGB(lum * 0.75, lum * 0.8, lum * 0.9);
    const g = gray * this.wI;
    this.cur.hor.lerp(tint, g); this.cur.top.lerp(this.tmpB.copy(tint).multiplyScalar(0.8), g * 0.8);

    const a = (this.time - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(a) * 0.85, Math.sin(a), 0.45).normalize();
    this.lightDir.copy(this.sunDir); if (this.lightDir.y < 0.12) { this.lightDir.copy(this.sunDir).negate(); this.lightDir.y = Math.max(0.35, this.lightDir.y); this.lightDir.normalize(); }
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 220);
    this.sun.target.position.copy(focus);
    this.sun.color.copy(this.cur.sun);
    const lightK = 1 - g * 0.55;
    this.sun.intensity = (0.5 + 2.0 * dayF + 1.6 * goldF) * lightK;
    this.hemi.intensity = (0.35 + 0.65 * dayF + 0.45 * goldF) * (1 - g * 0.2) + this.flash * 2.5;
    this.hemi.color.copy(this.cur.hor).lerp(new THREE.Color(1, 1, 1), 0.4);

    const fogBase = this.weather === "fog" ? 0.0045 : this.weather === "sand" ? 0.0065 : this.weather === "storm" ? 0.0032 : this.weather === "rain" ? 0.002 : this.weather === "snow" ? 0.0032 : this.weather === "ash" ? 0.0022 : 0;
    this.fog.density = lerp(0.0011, Math.max(0.0011, fogBase), this.wI);
    this.fog.color.copy(this.cur.hor);
    if (underwater) { this.fog.color.setRGB(0.03, 0.18, 0.28); this.fog.density = 0.03; }
    this.skyMat.uniforms.top.value.copy(this.cur.top);
    this.skyMat.uniforms.hor.value.copy(this.fog.color);
    this.skyMat.uniforms.sunDir.value.copy(this.sunDir);
    this.skyMat.uniforms.sunCol.value.copy(this.cur.sun).multiplyScalar(1 - g);
    this.skyMat.uniforms.night.value = nightF * (1 - g);
    this.sky.position.copy(cam.position);

    // lightning
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.weather === "storm" || (this.weather === "rain" && this.wI > 0.8 && biome === 1)) {
      this.nextBolt -= dt;
      if (this.nextBolt < 0) { this.flash = 1; this.nextBolt = 5 + Math.random() * 9; setTimeout(() => this.onThunder?.(), 300 + Math.random() * 700); }
    }
    this.skyMat.uniforms.flash.value = this.flash * 0.7;

    // particles
    const cp = cam.position;
    const wet = (this.weather === "rain" || this.weather === "storm") && this.wI > 0.2;
    this.rain.visible = wet && !underwater;
    (this.rain.material as THREE.LineBasicMaterial).opacity = 0.45 * this.wI;
    if (this.rain.visible) {
      const sp = this.weather === "storm" ? 42 : 32;
      for (let i = 0; i < this.rp.length / 6; i++) {
        let x = this.rp[i * 6], y = this.rp[i * 6 + 1] - sp * dt, z = this.rp[i * 6 + 2];
        x -= 4 * dt;
        if (y < cp.y - 15) y += 50; if (x < cp.x - 40) x += 80; else if (x > cp.x + 40) x -= 80; if (z < cp.z - 40) z += 80; else if (z > cp.z + 40) z -= 80;
        if (y > cp.y + 35) y -= 50;
        this.rp.set([x, y, z, x + 0.1, y + 1.1, z], i * 6);
      }
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    const dustOn = (this.weather === "snow" || this.weather === "ash" || this.weather === "sand") && this.wI > 0.2 && !underwater;
    this.dust.visible = dustOn;
    if (dustOn) {
      const m = this.dust.material as THREE.PointsMaterial;
      m.opacity = 0.8 * this.wI;
      m.color.set(this.weather === "snow" ? 0xffffff : this.weather === "ash" ? 0x6a5a52 : 0xd9b070);
      m.size = this.weather === "sand" ? 0.18 : 0.3;
      const t = performance.now() * 0.001;
      for (let i = 0; i < this.dp.length / 3; i++) {
        let x = this.dp[i * 3], y = this.dp[i * 3 + 1], z = this.dp[i * 3 + 2];
        if (this.weather === "sand") { x += (30 + Math.sin(t + i) * 4) * dt; y += Math.sin(t * 2 + i) * 0.4 * dt; z += Math.cos(t + i) * 2 * dt; }
        else { y -= (this.weather === "snow" ? 2.6 : 1.4) * dt; x += Math.sin(t + i) * 1.2 * dt + 2 * dt; z += Math.cos(t * 0.8 + i) * 1.2 * dt; }
        if (y < cp.y - 15) y += 45; if (y > cp.y + 30) y -= 45;
        if (x < cp.x - 45) x += 90; else if (x > cp.x + 45) x -= 90; if (z < cp.z - 45) z += 90; else if (z > cp.z + 45) z -= 90;
        this.dp[i * 3] = x; this.dp[i * 3 + 1] = y; this.dp[i * 3 + 2] = z;
      }
      (this.dust.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    // initial placement near camera first time
    if (!this._init) {
      this._init = true;
      for (let i = 0; i < this.rp.length / 6; i++) { this.rp[i * 6] += cp.x; this.rp[i * 6 + 1] += cp.y - 15; this.rp[i * 6 + 2] += cp.z; this.rp[i * 6 + 3] = this.rp[i * 6]; this.rp[i * 6 + 4] = this.rp[i * 6 + 1]; this.rp[i * 6 + 5] = this.rp[i * 6 + 2]; }
      for (let i = 0; i < this.dp.length / 3; i++) { this.dp[i * 3] += cp.x; this.dp[i * 3 + 1] += cp.y - 15; this.dp[i * 3 + 2] += cp.z; }
    }
  }
  private _init = false;
}
