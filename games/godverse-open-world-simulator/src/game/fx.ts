import * as THREE from 'three';
import type { Game } from './engine';
import { clamp, rand } from './noise';

const V = new THREE.Vector3();
export interface Pal { a: THREE.Color; b: THREE.Color }
export const pal = (a: number, b: number): Pal => ({ a: new THREE.Color(a), b: new THREE.Color(b) });
export const PAL = {
  fire: pal(0xfff0b0, 0xff5a10), blue: pal(0xc8f0ff, 0x2a7aff), ice: pal(0xffffff, 0x7ad8ff), lightning: pal(0xffffff, 0x8ac0ff),
  gold: pal(0xffffff, 0xffc030), purple: pal(0xe8c8ff, 0x8a30ff), dark: pal(0xff5070, 0x5a10b0), green: pal(0xd0ffd8, 0x30d080), white: pal(0xffffff, 0xaaccff),
  lava: pal(0xffe070, 0xff3000), cyan: pal(0xffffff, 0x20e0ff),
};

const VERT = `
attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale;
void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=min(size*uScale/max(0.1,-mv.z),600.0); }`;
const FRAG = `
varying vec4 vC;
void main(){ float d=length(gl_PointCoord-0.5)*2.0; if(d>1.0) discard; float a=pow(1.0-d,1.6); gl_FragColor=vec4(vC.rgb, vC.a*a); }`;

export class Particles {
  cap: number; head = 0;
  pos: Float32Array; col: Float32Array; size: Float32Array; d: Float32Array;
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  static S = 17;
  constructor(scene: THREE.Scene, cap: number, additive: boolean) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap); this.d = new Float32Array(cap * Particles.S);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 800 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, c0: THREE.Color, c1: THREE.Color, a0 = 1, a1 = 0, drag = 0, grav = 0) {
    const i = this.head; this.head = (this.head + 1) % this.cap;
    const d = this.d, o = i * Particles.S;
    d[o] = vx; d[o + 1] = vy; d[o + 2] = vz; d[o + 3] = life; d[o + 4] = life; d[o + 5] = s0; d[o + 6] = s1;
    d[o + 7] = c0.r; d[o + 8] = c0.g; d[o + 9] = c0.b; d[o + 10] = a0; d[o + 11] = c1.r; d[o + 12] = c1.g; d[o + 13] = c1.b; d[o + 14] = a1; d[o + 15] = drag; d[o + 16] = grav;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
  }
  update(dt: number) {
    const d = this.d, p = this.pos, c = this.col, s = this.size;
    for (let i = 0; i < this.cap; i++) {
      const o = i * Particles.S;
      if (d[o + 3] <= 0) { if (s[i] !== 0) s[i] = 0; continue; }
      d[o + 3] -= dt;
      if (d[o + 3] <= 0) { s[i] = 0; continue; }
      const t = 1 - d[o + 3] / d[o + 4];
      const dr = Math.max(0, 1 - d[o + 15] * dt);
      d[o] *= dr; d[o + 1] = d[o + 1] * dr - d[o + 16] * dt; d[o + 2] *= dr;
      p[i * 3] += d[o] * dt; p[i * 3 + 1] += d[o + 1] * dt; p[i * 3 + 2] += d[o + 2] * dt;
      s[i] = d[o + 5] + (d[o + 6] - d[o + 5]) * t;
      c[i * 4] = d[o + 7] + (d[o + 11] - d[o + 7]) * t; c[i * 4 + 1] = d[o + 8] + (d[o + 12] - d[o + 8]) * t; c[i * 4 + 2] = d[o + 9] + (d[o + 13] - d[o + 9]) * t;
      c[i * 4 + 3] = d[o + 10] + (d[o + 14] - d[o + 10]) * t;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
  }
  clear() { this.d.fill(0); this.size.fill(0); }
}

interface Shock { mesh: THREE.Mesh; age: number; life: number; maxR: number; mat: THREE.MeshBasicMaterial; ring: boolean }
interface Bolt { meshes: THREE.Mesh[]; age: number; life: number }
export interface FireSrc { x: number; y: number; z: number; life: number; size: number }

const SPH = new THREE.SphereGeometry(1, 28, 18);
const RING = new THREE.RingGeometry(0.88, 1, 64).rotateX(-Math.PI / 2);
const SMOKE_A = new THREE.Color(0.12, 0.11, 0.1), SMOKE_B = new THREE.Color(0.32, 0.3, 0.28);
const FLAME_A = new THREE.Color(1, 0.85, 0.3), FLAME_B = new THREE.Color(1, 0.25, 0.02);

export class Fx {
  add: Particles; norm: Particles;
  lights: THREE.PointLight[] = [];
  li = 0;
  shocks: Shock[] = [];
  bolts: Bolt[] = [];
  fires: FireSrc[] = [];
  constructor(public game: Game) {
    this.add = new Particles(game.scene, 9000, true);
    this.norm = new Particles(game.scene, 5000, false);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 100, 1.6); l.position.set(0, -1000, 0); game.scene.add(l); this.lights.push(l);
    }
  }
  setScale(h: number, fov: number) {
    const s = h / (2 * Math.tan((fov * Math.PI) / 360));
    this.add.mat.uniforms.uScale.value = s; this.norm.mat.uniforms.uScale.value = s;
  }
  flash(p: THREE.Vector3, color: THREE.Color | number, intensity: number, dist: number) {
    const l = this.lights[this.li++ % this.lights.length];
    l.position.copy(p); l.color.set(color as any); l.intensity = intensity; l.distance = dist;
  }
  puff(p: THREE.Vector3, r: number, color = SMOKE_A, n = 6) {
    for (let i = 0; i < n; i++) this.norm.emit(p.x + rand(-r, r) * 0.5, p.y + rand(0, r * 0.3), p.z + rand(-r, r) * 0.5, rand(-1, 1) * r * 0.4, rand(0.2, 1) * r * 0.6, rand(-1, 1) * r * 0.4, rand(1.5, 3), r * 0.5, r * 1.6, color, SMOKE_B, 0.55, 0, 0.8, -0.2);
  }
  explosion(p: THREE.Vector3, r: number, pl: Pal = PAL.fire, smoke = true) {
    const n = clamp(Math.floor(r * 2.5), 14, 170);
    for (let i = 0; i < n; i++) {
      V.set(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize();
      const sp = r * rand(0.3, 1.3);
      this.add.emit(p.x + V.x * r * 0.15, p.y + V.y * r * 0.15, p.z + V.z * r * 0.15, V.x * sp, V.y * sp + r * 0.3, V.z * sp, rand(0.5, 1.4), r * rand(0.25, 0.55), r * 0.08, pl.a, pl.b, 1, 0, 1.6, -r * 0.05);
    }
    if (smoke) for (let i = 0; i < n * 0.5; i++) {
      V.set(rand(-1, 1), rand(0, 1), rand(-1, 1)).normalize();
      const sp = r * rand(0.2, 0.7);
      this.norm.emit(p.x + V.x * r * 0.2, p.y + V.y * r * 0.2, p.z + V.z * r * 0.2, V.x * sp, V.y * sp + r * 0.5, V.z * sp, rand(2.2, 4.5), r * 0.3, r * rand(0.9, 1.5), SMOKE_A, SMOKE_B, 0.75, 0, 1.2, -r * 0.03);
    }
    for (let i = 0; i < n * 0.5; i++) {
      V.set(rand(-1, 1), rand(-0.1, 1), rand(-1, 1)).normalize().multiplyScalar(r * rand(1, 3));
      this.add.emit(p.x, p.y, p.z, V.x, V.y + r, V.z, rand(0.8, 2), 0.5 + r * 0.02, 0.1, pl.a, pl.b, 1, 0, 0.5, 30);
    }
    if (r > 6) this.shockwave(p, r * 1.7, pl.a, 0.7 + r * 0.004, true, r > 14);
    this.flash(p, pl.b, r * 0.9, r * 9);
  }
  shockwave(p: THREE.Vector3, maxR: number, color: THREE.Color | number, life = 0.8, ring = true, sphere = true) {
    const mk = (g: THREE.BufferGeometry, isRing: boolean, op: number) => {
      const m = new THREE.MeshBasicMaterial({ color: color as any, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const me = new THREE.Mesh(g, m); me.position.copy(p); me.scale.setScalar(0.1); me.renderOrder = 6; me.frustumCulled = false; this.game.scene.add(me);
      this.shocks.push({ mesh: me, age: 0, life, maxR, mat: m, ring: isRing });
    };
    if (sphere) mk(SPH, false, 0.35);
    if (ring) mk(RING, true, 0.9);
  }
  bolt(from: THREE.Vector3, to: THREE.Vector3, color = 0xbfe0ff, thick = 0.35, life = 0.28, branches = 2) {
    const meshes: THREE.Mesh[] = [];
    const make = (a: THREE.Vector3, b: THREE.Vector3, th: number, jit: number) => {
      const len = a.distanceTo(b), N = Math.max(6, Math.min(24, Math.floor(len / 14)));
      const pts: THREE.Vector3[] = [];
      const dir = b.clone().sub(a).normalize();
      const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const s1 = new THREE.Vector3().crossVectors(dir, up).normalize(), s2 = new THREE.Vector3().crossVectors(dir, s1);
      for (let i = 0; i <= N; i++) {
        const t = i / N, p = a.clone().lerp(b, t), amp = i === 0 || i === N ? 0 : jit * Math.sin(t * Math.PI) * rand(0.4, 1);
        p.addScaledVector(s1, rand(-1, 1) * amp).addScaledVector(s2, rand(-1, 1) * amp); pts.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      for (const [r, op] of [[th, 1], [th * 4, 0.25]]) {
        const m = new THREE.Mesh(new THREE.TubeGeometry(curve, N * 3, r, 5), new THREE.MeshBasicMaterial({ color: op === 1 ? 0xffffff : color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.frustumCulled = false; m.renderOrder = 7; this.game.scene.add(m); meshes.push(m);
      }
      return pts;
    };
    const len = from.distanceTo(to);
    const pts = make(from, to, thick, Math.min(len * 0.08, 30));
    for (let i = 0; i < branches; i++) {
      const s = pts[Math.floor(rand(2, pts.length - 2))];
      const e = s.clone().add(new THREE.Vector3(rand(-1, 1), rand(-0.8, -0.1), rand(-1, 1)).multiplyScalar(len * 0.25));
      make(s, e, thick * 0.5, len * 0.03);
    }
    this.bolts.push({ meshes, age: 0, life });
  }
  fire(p: THREE.Vector3, size: number, dur: number) {
    if (this.fires.length > 120) this.fires.shift();
    this.fires.push({ x: p.x, y: p.y, z: p.z, life: dur, size });
  }
  flame(p: THREE.Vector3, vel: THREE.Vector3, size: number, spread = 0.3) {
    this.add.emit(p.x, p.y, p.z, vel.x + rand(-spread, spread) * size, vel.y + rand(0, 1) * size, vel.z + rand(-spread, spread) * size, rand(0.5, 1.1), size * rand(0.6, 1.1), size * 0.2, FLAME_A, FLAME_B, 1, 0, 0.8, -4);
  }
  update(dt: number, rdt: number) {
    this.add.update(dt); this.norm.update(dt);
    for (const l of this.lights) l.intensity *= Math.exp(-rdt * 7);
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i]; s.age += dt;
      const t = s.age / s.life;
      if (t >= 1) { this.game.scene.remove(s.mesh); s.mat.dispose(); this.shocks.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - t, 2.2);
      s.mesh.scale.setScalar(Math.max(0.1, s.maxR * e));
      s.mat.opacity = (s.ring ? 0.9 : 0.35) * (1 - t);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.age += rdt;
      const t = b.age / b.life;
      if (t >= 1) { for (const m of b.meshes) { this.game.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); } this.bolts.splice(i, 1); continue; }
      b.meshes.forEach((m, k) => ((m.material as THREE.MeshBasicMaterial).opacity = (k % 2 ? 0.25 : 1) * (1 - t) * (Math.random() > 0.3 ? 1 : 0.4)));
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i]; f.life -= dt;
      if (f.life <= 0) { this.fires.splice(i, 1); continue; }
      const fade = Math.min(1, f.life / 3);
      const n = Math.random() < dt * 30 * f.size * fade ? 1 : 0;
      for (let k = 0; k < n + (f.size > 3 ? 1 : 0); k++) {
        this.add.emit(f.x + rand(-1, 1) * f.size * 0.5, f.y + 0.3, f.z + rand(-1, 1) * f.size * 0.5, rand(-0.5, 0.5), rand(2, 5) * Math.sqrt(f.size), rand(-0.5, 0.5), rand(0.5, 1), f.size * 0.7 * fade + 0.3, 0.1, FLAME_A, FLAME_B, 1, 0, 0.3, -2);
        if (Math.random() < 0.35) this.norm.emit(f.x, f.y + 1, f.z, rand(-1, 1), rand(3, 6), rand(-1, 1), rand(2, 4), f.size * 0.6, f.size * 2.2, SMOKE_A, SMOKE_B, 0.5 * fade, 0, 0.4, -0.5);
      }
    }
  }
  clear() {
    this.add.clear(); this.norm.clear(); this.fires.length = 0;
    for (const s of this.shocks) { this.game.scene.remove(s.mesh); s.mat.dispose(); } this.shocks.length = 0;
  }
}

// ---------------- DEBRIS ----------------
export interface Deb {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; rx: number; ry: number; rz: number; ax: number; ay: number; az: number;
  sx: number; sy: number; sz: number; life: number; rest: boolean; held: boolean; gm: number; ox: number; oy: number; oz: number; alive: boolean; i: number; sink: boolean;
}
export class Debris {
  mesh: THREE.InstancedMesh;
  list: Deb[] = [];
  head = 0;
  dummy = new THREE.Object3D();
  col = new THREE.Color();
  colDirty = false;
  constructor(public game: Game, public cap = 3800) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 }), cap);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < cap; i++) {
      this.mesh.setMatrixAt(i, z); this.mesh.setColorAt(i, this.col.set(0x888888));
      this.list.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, ax: 0, ay: 0, az: 0, sx: 1, sy: 1, sz: 1, life: 0, rest: true, held: false, gm: 1, ox: 0, oy: 0, oz: 0, alive: false, i, sink: false });
    }
    game.scene.add(this.mesh);
  }
  spawn(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number | THREE.Color, vx = 0, vy = 0, vz = 0): Deb {
    const d = this.list[this.head]; this.head = (this.head + 1) % this.cap;
    d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz; d.rx = rand(0, 6); d.ry = rand(0, 6); d.rz = rand(0, 6);
    d.ax = rand(-4, 4); d.ay = rand(-4, 4); d.az = rand(-4, 4); d.sx = sx; d.sy = sy; d.sz = sz; d.life = rand(35, 60);
    d.rest = false; d.held = false; d.gm = 1; d.ox = x; d.oy = y; d.oz = z; d.alive = true; d.sink = false;
    this.mesh.setColorAt(d.i, this.col.set(color as any)); this.colDirty = true;
    return d;
  }
  kill(d: Deb) {
    d.alive = false; d.life = 0;
    this.dummy.scale.set(0, 0, 0); this.dummy.updateMatrix(); this.mesh.setMatrixAt(d.i, this.dummy.matrix);
  }
  write(d: Deb, s = 1) {
    const o = this.dummy; o.position.set(d.x, d.y, d.z); o.rotation.set(d.rx, d.ry, d.rz); o.scale.set(d.sx * s, d.sy * s, d.sz * s); o.updateMatrix();
    this.mesh.setMatrixAt(d.i, o.matrix);
  }
  update(dt: number, reversing: boolean) {
    const g = this.game, T = g.terrain;
    let any = false;
    for (const d of this.list) {
      if (!d.alive) continue;
      if (reversing) {
        d.held = false; d.rest = false;
        const k = Math.min(1, dt * 3.5);
        d.x += (d.ox - d.x) * k; d.y += (d.oy - d.y) * k; d.z += (d.oz - d.z) * k; d.rx += d.ax * dt * 3; d.ry += d.ay * dt * 3;
        const dist = Math.abs(d.ox - d.x) + Math.abs(d.oy - d.y) + Math.abs(d.oz - d.z);
        if (dist < 1.5) { this.kill(d); any = true; continue; }
        this.write(d); any = true; continue;
      }
      if (d.rest) {
        d.life -= dt;
        if (d.life < 2) { if (d.life <= 0) { this.kill(d); any = true; } else { this.write(d, d.life / 2); any = true; } }
        continue;
      }
      if (!d.held) {
        const grav = g.gravity(d.y) * d.gm;
        d.vy -= grav * dt;
        if (d.y < g.ocean.level) { d.vx *= 0.96; d.vz *= 0.96; d.vy *= 0.94; d.vy += 14 * dt; }
      }
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.rx += d.ax * dt; d.ry += d.ay * dt; d.rz += d.az * dt;
      const sz = Math.max(d.sx, d.sy, d.sz) * 0.4;
      if (d.y < 3000) {
        const gh = Math.max(T.heightAt(d.x, d.z), g.city.heightAt(d.x, d.z, d.y));
        if (d.y - sz < gh && !d.held) {
          d.y = gh + sz;
          if (Math.abs(d.vy) > 3) { d.vy = -d.vy * 0.28; d.vx *= 0.6; d.vz *= 0.6; d.ax *= 0.6; d.ay *= 0.6; d.az *= 0.6; } else { d.vy = 0; d.vx *= 0.8; d.vz *= 0.8; }
          if (Math.hypot(d.vx, d.vy, d.vz) < 1.2) { d.rest = true; d.vx = d.vy = d.vz = 0; }
        }
      }
      d.life -= dt * 0.25;
      if (d.life <= 0) { this.kill(d); any = true; continue; }
      this.write(d); any = true;
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
    if (this.colDirty && this.mesh.instanceColor) { this.mesh.instanceColor.needsUpdate = true; this.colDirty = false; }
  }
  forNear(p: THREE.Vector3, r: number, cb: (d: Deb, dist: number) => void) {
    const r2 = r * r;
    for (const d of this.list) {
      if (!d.alive) continue;
      const dx = d.x - p.x, dy = d.y - p.y, dz = d.z - p.z, q = dx * dx + dy * dy + dz * dz;
      if (q < r2) cb(d, Math.sqrt(q));
    }
  }
  blast(p: THREE.Vector3, r: number, force: number) {
    this.forNear(p, r, (d, dist) => {
      const f = force * (1 - dist / r);
      V.set(d.x - p.x, d.y - p.y + r * 0.2, d.z - p.z).normalize();
      d.rest = false; d.vx += V.x * f; d.vy += V.y * f + f * 0.3; d.vz += V.z * f; d.ax += rand(-5, 5); d.az += rand(-5, 5);
    });
  }
  clear() { for (const d of this.list) if (d.alive) this.kill(d); this.mesh.instanceMatrix.needsUpdate = true; }
}
