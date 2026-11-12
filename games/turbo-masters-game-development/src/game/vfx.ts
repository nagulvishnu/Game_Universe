import * as THREE from "three";
import { glowTexture } from "./util";

const PVERT = /* glsl */ `
attribute float size;
attribute vec4 color;
varying vec4 vC;
uniform float uScale;
void main(){
  vC = color;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = clamp(size * uScale / max(0.1,-mv.z), 0.0, 220.0);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = /* glsl */ `
uniform sampler2D map;
varying vec4 vC;
void main(){
  float a = texture2D(map, gl_PointCoord).a * vC.a;
  if(a < 0.003) discard;
  gl_FragColor = vec4(vC.rgb, a);
}`;

export class ParticlePool {
  points: THREE.Points;
  max: number;
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  s0: Float32Array;
  s1: Float32Array;
  c0: Float32Array;
  grav: Float32Array;
  drag: Float32Array;
  head = 0;
  mat: THREE.ShaderMaterial;
  geo: THREE.BufferGeometry;
  constructor(max: number, additive: boolean) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture() }, uScale: { value: 500 } },
      vertexShader: PVERT,
      fragmentShader: PFRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 12 : 10;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, r: number, g: number, b: number, a: number, grav = 0, drag = 0) {
    const i = this.head;
    this.head = (i + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1;
    this.c0[i * 4] = r; this.c0[i * 4 + 1] = g; this.c0[i * 4 + 2] = b; this.c0[i * 4 + 3] = a;
    this.grav[i] = grav; this.drag[i] = drag;
    this.size[i] = s0;
  }
  update(dt: number) {
    const { pos, vel, life, maxLife, s0, s1, c0, col, size, grav, drag } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) {
        if (size[i] !== 0) { size[i] = 0; col[i * 4 + 3] = 0; }
        continue;
      }
      life[i] -= dt;
      const t = 1 - Math.max(0, life[i]) / maxLife[i];
      const dr = 1 - Math.min(1, drag[i] * dt);
      vel[i * 3] *= dr; vel[i * 3 + 1] = vel[i * 3 + 1] * dr - grav[i] * dt; vel[i * 3 + 2] *= dr;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] = s0[i] + (s1[i] - s0[i]) * t;
      col[i * 4] = c0[i * 4]; col[i * 4 + 1] = c0[i * 4 + 1]; col[i * 4 + 2] = c0[i * 4 + 2];
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      col[i * 4 + 3] = c0[i * 4 + 3] * fade;
    }
    const g = this.geo.attributes;
    g.position.needsUpdate = true; g.color.needsUpdate = true; g.size.needsUpdate = true;
  }
  setScale(s: number) {
    this.mat.uniforms.uScale.value = s;
  }
  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ------------------------------------------------------------------ trails
export class Trail {
  mesh: THREE.Mesh;
  n: number;
  hist: Float32Array;
  posA: Float32Array;
  colA: Float32Array;
  intensity = 0;
  geo: THREE.BufferGeometry;
  constructor(n: number, color: THREE.Color) {
    this.n = n;
    this.hist = new Float32Array(n * 3);
    this.posA = new Float32Array(n * 4 * 3);
    this.colA = new Float32Array(n * 4 * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.posA, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.colA, 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let k = 0; k < n - 1; k++) {
      for (let r = 0; r < 2; r++) {
        const a = k * 4 + r * 2, b = (k + 1) * 4 + r * 2;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 13;
    this.mesh.visible = false;
    this.tint = color;
  }
  tint: THREE.Color;
  reset(x: number, y: number, z: number) {
    for (let k = 0; k < this.n; k++) { this.hist[k * 3] = x; this.hist[k * 3 + 1] = y; this.hist[k * 3 + 2] = z; }
    this.intensity = 0;
  }
  update(dt: number, x: number, y: number, z: number, sx: number, sz: number, active: boolean, width: number) {
    this.intensity += ((active ? 1 : 0) - this.intensity) * Math.min(1, dt * (active ? 14 : 5));
    const n = this.n;
    const h = this.hist;
    h.copyWithin(3, 0, (n - 1) * 3);
    h[0] = x; h[1] = y; h[2] = z;
    if (this.intensity < 0.02) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const p = this.posA, c = this.colA;
    for (let k = 0; k < n; k++) {
      const f = 1 - k / (n - 1);
      const w = width * Math.pow(f, 0.6) * this.intensity;
      const px = h[k * 3], py = h[k * 3 + 1], pz = h[k * 3 + 2];
      const o = k * 12;
      p[o] = px; p[o + 1] = py + w; p[o + 2] = pz;
      p[o + 3] = px; p[o + 4] = py - w; p[o + 5] = pz;
      p[o + 6] = px + sx * w; p[o + 7] = py; p[o + 8] = pz + sz * w;
      p[o + 9] = px - sx * w; p[o + 10] = py; p[o + 11] = pz - sz * w;
      const i = f * f * this.intensity;
      const mix = Math.pow(f, 3) * 0.45;
      const r = (this.tint.r * (1 - mix) + mix) * i, g = (this.tint.g * (1 - mix) + mix) * i, b = (this.tint.b * (1 - mix) + mix) * i;
      for (let v = 0; v < 4; v++) { c[o + v * 3] = r; c[o + v * 3 + 1] = g; c[o + v * 3 + 2] = b; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ------------------------------------------------------------------ skid marks
export class SkidMarks {
  mesh: THREE.Mesh;
  max: number;
  pos: Float32Array;
  col: Float32Array;
  head = 0;
  geo: THREE.BufferGeometry;
  last = new Map<number, number[]>();
  dirty = false;
  constructor(max = 2400) {
    this.max = max;
    this.pos = new Float32Array(max * 4 * 3);
    this.col = new Float32Array(max * 4 * 4);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < max; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2);
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }
  add(id: number, x: number, y: number, z: number, intensity: number) {
    const l = this.last.get(id);
    if (!l) {
      this.last.set(id, [x, y, z]);
      return;
    }
    const dx = x - l[0], dz = z - l[2];
    const d = Math.hypot(dx, dz);
    if (d < 0.35) return;
    if (d > 6) { l[0] = x; l[1] = y; l[2] = z; return; }
    const nx = -dz / d * 0.15, nz = dx / d * 0.15;
    const i = this.head;
    this.head = (i + 1) % this.max;
    const p = this.pos, o = i * 12;
    const y0 = l[1] + 0.04, y1 = y + 0.04;
    p[o] = l[0] + nx; p[o + 1] = y0; p[o + 2] = l[2] + nz;
    p[o + 3] = l[0] - nx; p[o + 4] = y0; p[o + 5] = l[2] - nz;
    p[o + 6] = x + nx; p[o + 7] = y1; p[o + 8] = z + nz;
    p[o + 9] = x - nx; p[o + 10] = y1; p[o + 11] = z - nz;
    const a = Math.min(0.6, 0.15 + intensity * 0.5);
    for (let v = 0; v < 4; v++) { const c = i * 16 + v * 4; this.col[c] = 0.02; this.col[c + 1] = 0.02; this.col[c + 2] = 0.025; this.col[c + 3] = a; }
    l[0] = x; l[1] = y; l[2] = z;
    this.dirty = true;
  }
  stop(id: number) {
    this.last.delete(id);
  }
  flush() {
    if (this.dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
      this.dirty = false;
    }
  }
  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ------------------------------------------------------------------ ambient (rain / sand / dust / petals)
export class Ambient {
  obj: THREE.Object3D;
  mat: THREE.ShaderMaterial;
  geo: THREE.BufferGeometry;
  lines: boolean;
  constructor(count: number, box: THREE.Vector3, vel: THREE.Vector3, color: THREE.Color, opacity: number, lines: boolean, size = 0.2, len = 1.2) {
    this.lines = lines;
    const per = lines ? 2 : 1;
    const seed = new Float32Array(count * per * 3);
    const end = new Float32Array(count * per);
    for (let i = 0; i < count; i++) {
      const sx = Math.random(), sy = Math.random(), sz = Math.random();
      for (let k = 0; k < per; k++) {
        const o = i * per + k;
        seed[o * 3] = sx; seed[o * 3 + 1] = sy; seed[o * 3 + 2] = sz;
        end[o] = k;
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * per * 3), 3));
    this.geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    this.geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uVel: { value: vel }, uTime: { value: 0 },
        uColor: { value: color }, uOpacity: { value: opacity }, uSize: { value: size }, uScale: { value: 500 }, uLen: { value: len },
      },
      vertexShader: /* glsl */ `
      attribute vec3 aSeed; attribute float aEnd;
      uniform vec3 uCam, uBox, uVel; uniform float uTime, uSize, uScale, uLen;
      varying float vA;
      void main(){
        vec3 p = aSeed*uBox + uVel*uTime + vec3(sin(uTime*0.7+aSeed.x*30.0)*0.6,0.0,cos(uTime*0.6+aSeed.z*30.0)*0.6);
        p = mod(p - uCam + uBox*0.5, uBox) + uCam - uBox*0.5;
        ${lines ? "if(aEnd>0.5) p -= normalize(uVel)*uLen;" : ""}
        vec4 mv = viewMatrix * vec4(p,1.0);
        float dist = length(p-uCam);
        vA = clamp(1.0 - dist/(min(uBox.x,uBox.z)*0.5), 0.0, 1.0);
        ${lines ? "" : "gl_PointSize = clamp(uSize*uScale/max(0.1,-mv.z),1.0,60.0);"}
        gl_Position = projectionMatrix * mv;
      }`,
      fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){
        ${lines ? "" : "float r = length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; float soft = 1.0-r;"}
        gl_FragColor = vec4(uColor, uOpacity * vA ${lines ? "" : "* soft"});
      }`,
      transparent: true,
      depthWrite: false,
    });
    this.obj = lines ? new THREE.LineSegments(this.geo, this.mat) : new THREE.Points(this.geo, this.mat);
    this.obj.frustumCulled = false;
    this.obj.renderOrder = 20;
  }
  prepare(cam: THREE.Camera, time: number, scale: number) {
    this.mat.uniforms.uCam.value.copy(cam.position);
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uScale.value = scale;
  }
  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ------------------------------------------------------------------ manager
export class Vfx {
  smoke: ParticlePool;
  glow: ParticlePool;
  skids: SkidMarks;
  rings: { mesh: THREE.Mesh; t: number; max: number }[] = [];
  mult: number;
  light: number;
  root = new THREE.Group();
  constructor(mult: number, light: number) {
    this.mult = mult;
    this.light = light;
    this.smoke = new ParticlePool(Math.round(1600 * mult) + 200, false);
    this.glow = new ParticlePool(Math.round(2600 * mult) + 300, true);
    this.skids = new SkidMarks(Math.round(1800 * Math.min(1.2, mult + 0.3)));
    this.root.add(this.smoke.points, this.glow.points, this.skids.mesh);
    const rg = new THREE.RingGeometry(0.85, 1, 40);
    rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      m.renderOrder = 14;
      this.root.add(m);
      this.rings.push({ mesh: m, t: 0, max: 0.6 });
    }
  }
  private ok(p = 1) {
    return Math.random() < this.mult * p;
  }
  setScale(s: number) {
    this.smoke.setScale(s);
    this.glow.setScale(s);
  }
  update(dt: number) {
    this.smoke.update(dt);
    this.glow.update(dt);
    this.skids.flush();
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / r.max;
      if (k >= 1) { r.mesh.visible = false; continue; }
      const s = 1 + k * r.mesh.userData.grow;
      r.mesh.scale.set(s, s, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8;
    }
  }
  ring(x: number, y: number, z: number, color: THREE.ColorRepresentation, grow = 7, dur = 0.6) {
    const r = this.rings.find((q) => !q.mesh.visible) ?? this.rings[0];
    r.mesh.visible = true;
    r.t = 0;
    r.max = dur;
    r.mesh.position.set(x, y + 0.15, z);
    r.mesh.userData.grow = grow;
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }
  flash(x: number, y: number, z: number, size: number, color: THREE.ColorRepresentation, life = 0.18) {
    const c = new THREE.Color(color);
    this.glow.emit(x, y, z, 0, 0, 0, life, size * 0.4, size, c.r, c.g, c.b, 0.9);
  }
  sparks(x: number, y: number, z: number, dx: number, dz: number, n: number, speed = 10) {
    n = Math.round(n * this.mult);
    for (let i = 0; i < n; i++) {
      const s = speed * (0.4 + Math.random());
      this.glow.emit(x, y, z, dx * s + (Math.random() - 0.5) * s * 0.6, Math.random() * s * 0.5, dz * s + (Math.random() - 0.5) * s * 0.6, 0.35 + Math.random() * 0.4, 0.22, 0.05, 1, 0.65 + Math.random() * 0.3, 0.2, 1, 22, 0.8);
    }
  }
  debris(x: number, y: number, z: number, n: number) {
    n = Math.round(n * this.mult);
    for (let i = 0; i < n; i++) {
      this.glow.emit(x, y, z, (Math.random() - 0.5) * 9, Math.random() * 7, (Math.random() - 0.5) * 9, 0.8 + Math.random() * 0.6, 0.18, 0.12, 0.6, 0.55, 0.5, 0.9, 18, 0.4);
    }
  }
  smokePuff(x: number, y: number, z: number, vx: number, vz: number, size: number, shade = 0.85, alpha = 0.5, rise = 1.2, life = 1.1) {
    const k = shade * (0.35 + 0.65 * this.light);
    this.smoke.emit(x, y, z, vx + (Math.random() - 0.5) * 1.2, rise * (0.6 + Math.random() * 0.8), vz + (Math.random() - 0.5) * 1.2, life * (0.8 + Math.random() * 0.5), size * 0.5, size * 1.8, k, k, k, alpha, -0.2, 0.8);
  }
  tireSmoke(x: number, y: number, z: number, vx: number, vz: number, intensity: number) {
    if (!this.ok(intensity)) return;
    this.smokePuff(x, y + 0.15, z, vx * 0.2, vz * 0.2, 1.1 + intensity, 0.9, 0.38 * intensity + 0.1);
  }
  dust(x: number, y: number, z: number, vx: number, vz: number, color: THREE.Color, amt: number) {
    if (!this.ok(amt)) return;
    const k = 0.4 + 0.6 * this.light;
    this.smoke.emit(x, y + 0.2, z, vx * 0.3 + (Math.random() - 0.5), 0.8 + Math.random(), vz * 0.3 + (Math.random() - 0.5), 1.2, 0.8, 2.8, color.r * k, color.g * k, color.b * k, 0.4, -0.1, 0.9);
  }
  spray(x: number, y: number, z: number, vx: number, vz: number, amt: number) {
    if (!this.ok(amt)) return;
    const k = 0.5 + 0.5 * this.light;
    this.smoke.emit(x, y + 0.2, z, vx * 0.15 + (Math.random() - 0.5) * 1.5, 1.8 + Math.random() * 1.5, vz * 0.15 + (Math.random() - 0.5) * 1.5, 0.7, 0.4, 1.4, 0.8 * k, 0.88 * k, 1 * k, 0.35 * amt + 0.1, 3, 1.2);
  }
  splash(x: number, y: number, z: number) {
    this.glow.emit(x, y + 0.05, z, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5, 0.3, 0.12, 0.05, 0.7, 0.8, 1, 0.5, 14, 0.2);
  }
  flame(x: number, y: number, z: number, vx: number, vz: number, color: THREE.Color, power = 1) {
    this.glow.emit(x + (Math.random() - 0.5) * 0.1, y, z + (Math.random() - 0.5) * 0.1, vx * 0.6 + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5, vz * 0.6 + (Math.random() - 0.5) * 2, 0.35 + Math.random() * 0.25, 0.5 * power, 0.1, color.r, color.g, color.b, 0.8, 0, 2);
    this.glow.emit(x, y, z, vx * 0.7, 0, vz * 0.7, 0.18, 0.35 * power, 0.05, 1, 1, 1, 0.9, 0, 2);
  }
  embers(x: number, y: number, z: number, vx: number, vz: number, color: THREE.Color) {
    if (!this.ok(0.7)) return;
    this.glow.emit(x, y, z, vx * 0.5 + (Math.random() - 0.5) * 5, Math.random() * 3, vz * 0.5 + (Math.random() - 0.5) * 5, 0.5 + Math.random() * 0.5, 0.16, 0.04, color.r, color.g, color.b, 1, 5, 0.5);
  }
  dispose() {
    this.smoke.dispose();
    this.glow.dispose();
    this.skids.dispose();
    this.rings.forEach((r) => (r.mesh.material as THREE.Material).dispose());
  }
}
