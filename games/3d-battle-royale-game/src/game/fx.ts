import * as THREE from 'three';

const N = 900;

interface Tracer {
  mesh: THREE.Mesh;
  sx: number; sy: number; sz: number;
  ex: number; ey: number; ez: number;
  age: number; life: number; active: boolean;
}
interface Flash {
  mesh: THREE.Mesh;
  age: number; life: number; s0: number; s1: number; active: boolean;
}

export class FX {
  scene: THREE.Scene;
  inst: THREE.InstancedMesh;
  pos = new Float32Array(N * 3);
  vel = new Float32Array(N * 3);
  life = new Float32Array(N);
  max = new Float32Array(N);
  size = new Float32Array(N);
  grav = new Float32Array(N);
  alive = new Uint8Array(N);
  head = 0;
  dummy = new THREE.Object3D();
  col = new THREE.Color();
  colorDirty = false;
  tracers: Tracer[] = [];
  flashes: Flash[] = [];
  tIdx = 0;
  fIdx = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
    this.inst.frustumCulled = false;
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < N; i++) {
      this.inst.setMatrixAt(i, this.dummy.matrix);
      this.inst.setColorAt(i, this.col.set(0xffffff));
    }
    scene.add(this.inst);

    const tg = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
      m.visible = false;
      scene.add(m);
      this.tracers.push({ mesh: m, sx: 0, sy: 0, sz: 0, ex: 0, ey: 0, ez: 0, age: 0, life: 0.1, active: false });
    }
    const fg = new THREE.SphereGeometry(1, 12, 9);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, depthWrite: false, fog: false }));
      m.visible = false;
      scene.add(m);
      this.flashes.push({ mesh: m, age: 0, life: 0.2, s0: 0.3, s1: 1, active: false });
    }
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grav = 12) {
    const i = this.head;
    this.head = (this.head + 1) % N;
    const p = i * 3;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
    this.alive[i] = 1;
    this.inst.setColorAt(i, this.col.set(color));
    this.colorDirty = true;
  }

  burst(x: number, y: number, z: number, n: number, speed: number, life: number, size: number, color: number, grav = 12, up = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 2 - 1 + up;
      const s = speed * (0.35 + Math.random() * 0.65);
      const c = Math.sqrt(Math.max(0, 1 - Math.min(1, e * e)));
      this.emit(x, y, z, Math.cos(a) * c * s, e * s, Math.sin(a) * c * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, grav);
    }
  }

  tracer(sx: number, sy: number, sz: number, ex: number, ey: number, ez: number, color: number, w = 0.05) {
    const t = this.tracers[this.tIdx];
    this.tIdx = (this.tIdx + 1) % this.tracers.length;
    t.sx = sx; t.sy = sy; t.sz = sz; t.ex = ex; t.ey = ey; t.ez = ez;
    t.age = 0;
    const dist = Math.hypot(ex - sx, ey - sy, ez - sz);
    t.life = Math.max(0.05, Math.min(0.14, dist / 700));
    t.active = true;
    (t.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    t.mesh.userData.w = w;
    t.mesh.visible = true;
  }

  flash(x: number, y: number, z: number, s0: number, s1: number, life: number, color: number, opacity = 1) {
    const f = this.flashes[this.fIdx];
    this.fIdx = (this.fIdx + 1) % this.flashes.length;
    f.mesh.position.set(x, y, z);
    f.age = 0; f.life = life; f.s0 = s0; f.s1 = s1; f.active = true;
    const m = f.mesh.material as THREE.MeshBasicMaterial;
    m.color.set(color);
    m.opacity = opacity;
    f.mesh.userData.op = opacity;
    f.mesh.scale.setScalar(s0);
    f.mesh.visible = true;
  }

  update(dt: number) {
    const d = this.dummy;
    let any = false;
    for (let i = 0; i < N; i++) {
      if (!this.alive[i]) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alive[i] = 0;
        d.scale.setScalar(0);
        d.position.set(0, -100, 0);
        d.updateMatrix();
        this.inst.setMatrixAt(i, d.matrix);
        continue;
      }
      const p = i * 3;
      this.vel[p + 1] -= this.grav[i] * dt;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      if (this.pos[p + 1] < 0.05) {
        this.pos[p + 1] = 0.05;
        this.vel[p + 1] *= -0.3;
        this.vel[p] *= 0.6;
        this.vel[p + 2] *= 0.6;
      }
      const k = this.life[i] / this.max[i];
      const s = this.size[i] * Math.min(1, k * 2.5);
      d.position.set(this.pos[p], this.pos[p + 1], this.pos[p + 2]);
      d.scale.setScalar(s);
      d.rotation.set(k * 6, k * 4, 0);
      d.updateMatrix();
      this.inst.setMatrixAt(i, d.matrix);
    }
    if (any) this.inst.instanceMatrix.needsUpdate = true;
    if (this.colorDirty && this.inst.instanceColor) {
      this.inst.instanceColor.needsUpdate = true;
      this.colorDirty = false;
    }
    for (const t of this.tracers) {
      if (!t.active) continue;
      t.age += dt;
      const k = t.age / t.life;
      if (k >= 1) {
        t.active = false;
        t.mesh.visible = false;
        continue;
      }
      const dx = t.ex - t.sx, dy = t.ey - t.sy, dz = t.ez - t.sz;
      const h = k, tl = Math.max(0, k - 0.4);
      const hx = t.sx + dx * h, hy = t.sy + dy * h, hz = t.sz + dz * h;
      const tx = t.sx + dx * tl, ty = t.sy + dy * tl, tz = t.sz + dz * tl;
      const len = Math.hypot(hx - tx, hy - ty, hz - tz);
      t.mesh.position.set((hx + tx) / 2, (hy + ty) / 2, (hz + tz) / 2);
      t.mesh.lookAt(t.ex, t.ey, t.ez);
      const w = t.mesh.userData.w as number;
      t.mesh.scale.set(w, w, Math.max(0.01, len));
    }
    for (const f of this.flashes) {
      if (!f.active) continue;
      f.age += dt;
      const k = f.age / f.life;
      if (k >= 1) {
        f.active = false;
        f.mesh.visible = false;
        continue;
      }
      const e = 1 - (1 - k) * (1 - k);
      f.mesh.scale.setScalar(f.s0 + (f.s1 - f.s0) * e);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = (f.mesh.userData.op as number) * (1 - k);
    }
  }

  clear() {
    for (let i = 0; i < N; i++) this.alive[i] = 0;
    const d = this.dummy;
    d.scale.setScalar(0);
    d.updateMatrix();
    for (let i = 0; i < N; i++) this.inst.setMatrixAt(i, d.matrix);
    this.inst.instanceMatrix.needsUpdate = true;
    for (const t of this.tracers) { t.active = false; t.mesh.visible = false; }
    for (const f of this.flashes) { f.active = false; f.mesh.visible = false; }
  }
}
