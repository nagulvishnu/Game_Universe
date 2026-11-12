// Visual effects: particles, shuttle trail, flashes, floor rings. Pooled, allocation-free in the hot path.
import * as THREE from 'three';

function spriteTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Particles {
  points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private base: Float32Array;
  private grav: Float32Array;
  private head = 0;
  constructor(n = 900, size = 0.2) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n);
    this.max = new Float32Array(n); this.base = new Float32Array(n * 3); this.grav = new Float32Array(n);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -100;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({ size, map: spriteTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, count: number, o: { speed?: number; color?: THREE.ColorRepresentation; life?: number; gravity?: number; up?: number; dirX?: number; dirY?: number; dirZ?: number; spread?: number } = {}) {
    const c = new THREE.Color(o.color ?? '#ffffff');
    const sp = o.speed ?? 4, life = o.life ?? 0.7, g = o.gravity ?? 6, spread = o.spread ?? 1;
    for (let k = 0; k < count; k++) {
      const i = this.head; this.head = (this.head + 1) % this.n;
      const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
      const s = sp * (0.35 + Math.random() * 0.65);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = (Math.sin(b) * Math.cos(a)) * s * spread + (o.dirX ?? 0) * s;
      this.vel[i * 3 + 1] = (Math.cos(b) * s + (o.up ?? 0)) * spread + (o.dirY ?? 0) * s;
      this.vel[i * 3 + 2] = (Math.sin(b) * Math.sin(a)) * s * spread + (o.dirZ ?? 0) * s;
      this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.6);
      this.base[i * 3] = c.r; this.base[i * 3 + 1] = c.g; this.base[i * 3 + 2] = c.b;
      this.grav[i] = g;
    }
  }
  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; continue; }
      this.life[i] -= dt;
      const f = Math.max(0, this.life[i] / this.max[i]);
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; }
      this.col[i * 3] = this.base[i * 3] * f; this.col[i * 3 + 1] = this.base[i * 3 + 1] * f; this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** Shuttle motion trail made from instanced spheres that taper along the history of positions. */
export class Trail {
  mesh: THREE.InstancedMesh;
  private hist: THREE.Vector3[] = [];
  private n: number;
  private d = new THREE.Object3D();
  private color = new THREE.Color('#8be9ff');
  private rainbow = false;
  private width = 0.5;
  private len = 14;
  private hue = 0;
  constructor(n = 30) {
    this.n = n;
    for (let i = 0; i < n; i++) this.hist.push(new THREE.Vector3(0, -100, 0));
    const mat = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, this.color);
  }
  style(color: string, rainbow: boolean, width: number, len: number) {
    this.color.set(color); this.rainbow = rainbow; this.width = width; this.len = len;
  }
  reset(x: number, y: number, z: number) { for (const h of this.hist) h.set(x, y, z); }
  push(x: number, y: number, z: number, active: boolean, dt: number) {
    const first = this.hist[0];
    if (active && first.distanceToSquared(new THREE.Vector3(x, y, z)) > 0.0004) {
      const last = this.hist.pop()!;
      last.set(x, y, z);
      this.hist.unshift(last);
    } else if (!active) {
      // collapse trail
      for (const h of this.hist) h.y -= 0;
    }
    this.hue = (this.hue + dt * 0.8) % 1;
    const c = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const h = this.hist[i];
      const f = i / this.len;
      const s = active && f < 1 ? (1 - f) * this.width * 6 : 0.0001;
      this.d.position.copy(h);
      this.d.scale.setScalar(s);
      this.d.updateMatrix();
      this.mesh.setMatrixAt(i, this.d.matrix);
      if (this.rainbow) c.setHSL((this.hue + i * 0.04) % 1, 1, 0.6); else c.copy(this.color).multiplyScalar(1 - f * 0.5);
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Flashes {
  group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private rings: THREE.Mesh[] = [];
  private data: { life: number; max: number; grow: number; s0: number }[] = [];
  private rdata: { life: number; max: number; grow: number; s0: number }[] = [];
  private sh = 0; private rh = 0;
  constructor() {
    const tex = spriteTexture();
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      s.visible = false; s.renderOrder = 5;
      this.group.add(s); this.sprites.push(s); this.data.push({ life: 0, max: 1, grow: 1, s0: 1 });
    }
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.visible = false;
      this.group.add(m); this.rings.push(m); this.rdata.push({ life: 0, max: 1, grow: 1, s0: 1 });
    }
  }
  flash(x: number, y: number, z: number, color: string, size: number, dur = 0.22) {
    const i = this.sh; this.sh = (this.sh + 1) % this.sprites.length;
    const s = this.sprites[i];
    s.position.set(x, y, z); (s.material as THREE.SpriteMaterial).color.set(color);
    s.visible = true; s.scale.setScalar(size);
    this.data[i] = { life: dur, max: dur, grow: 2.4, s0: size };
  }
  ring(x: number, z: number, color: string, size: number, dur = 0.55, y = 0.03) {
    const i = this.rh; this.rh = (this.rh + 1) % this.rings.length;
    const m = this.rings[i];
    m.position.set(x, y, z); (m.material as THREE.MeshBasicMaterial).color.set(color);
    m.visible = true; m.scale.setScalar(size * 0.3);
    this.rdata[i] = { life: dur, max: dur, grow: 3.4, s0: size * 0.3 };
  }
  update(dt: number) {
    for (let i = 0; i < this.sprites.length; i++) {
      const d = this.data[i], s = this.sprites[i];
      if (!s.visible) continue;
      d.life -= dt;
      if (d.life <= 0) { s.visible = false; continue; }
      const f = 1 - d.life / d.max;
      s.scale.setScalar(d.s0 * (1 + f * d.grow));
      (s.material as THREE.SpriteMaterial).opacity = 1 - f;
    }
    for (let i = 0; i < this.rings.length; i++) {
      const d = this.rdata[i], m = this.rings[i];
      if (!m.visible) continue;
      d.life -= dt;
      if (d.life <= 0) { m.visible = false; continue; }
      const f = 1 - d.life / d.max;
      m.scale.setScalar(d.s0 * (1 + f * d.grow * 3));
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - f) * 0.9;
    }
  }
}
