import * as THREE from 'three';

let _glow: THREE.CanvasTexture | null = null;
export function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); _glow = new THREE.CanvasTexture(c); return _glow;
}

export class Particles {
  pts: THREE.Points; max: number; pos: Float32Array; col: Float32Array; vel: Float32Array; life: Float32Array; ml: Float32Array; grav: Float32Array; base: Float32Array; head = 0; geo: THREE.BufferGeometry; active = 0;
  constructor(scene: THREE.Scene, max: number, size: number) {
    this.max = max; this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.ml = new Float32Array(max); this.grav = new Float32Array(max); this.base = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;
    this.geo = new THREE.BufferGeometry(); this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({ size, map: glowTex(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.pts = new THREE.Points(this.geo, m); this.pts.frustumCulled = false; this.pts.renderOrder = 5; scene.add(this.pts);
  }
  emit(x: number, y: number, z: number, n: number, o: { color?: number; speed?: number; life?: number; grav?: number; up?: number; spread?: number; dx?: number; dz?: number; dir?: number } = {}) {
    const c = new THREE.Color(o.color ?? 0xffffff); const sp = o.speed ?? 4; const lf = o.life ?? 0.6; const sg = o.spread ?? 1;
    for (let k = 0; k < n; k++) {
      const i = this.head; this.head = (this.head + 1) % this.max;
      const a = Math.random() * Math.PI * 2; const u = Math.random() * 2 - 1; const r = Math.sqrt(1 - u * u); const s = sp * (0.4 + Math.random() * 0.6);
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.2 * sg; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2 * sg;
      this.vel[i * 3] = Math.cos(a) * r * s * sg + (o.dx ?? 0); this.vel[i * 3 + 1] = u * s * 0.8 * sg + (o.up ?? 0) * (0.5 + Math.random() * 0.5); this.vel[i * 3 + 2] = Math.sin(a) * r * s * sg + (o.dz ?? 0);
      this.life[i] = this.ml[i] = lf * (0.6 + Math.random() * 0.6); this.grav[i] = o.grav ?? 0;
      this.base[i * 3] = c.r; this.base[i * 3 + 1] = c.g; this.base[i * 3 + 2] = c.b;
    }
  }
  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue; this.life[i] -= dt; const j = i * 3;
      if (this.life[i] <= 0) { this.pos[j + 1] = -999; this.col[j] = this.col[j + 1] = this.col[j + 2] = 0; continue; }
      this.vel[j + 1] -= this.grav[i] * dt; this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.02 && this.grav[i] > 0) { this.pos[j + 1] = 0.02; this.vel[j + 1] *= -0.3; this.vel[j] *= 0.7; this.vel[j + 2] *= 0.7; }
      const f = this.life[i] / this.ml[i]; this.col[j] = this.base[j] * f; this.col[j + 1] = this.base[j + 1] * f; this.col[j + 2] = this.base[j + 2] * f;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}

const SG = new Map<string, THREE.BufferGeometry>();
export function sectorGeo(inner: number, outer: number, arc: number, seg = 24): THREE.BufferGeometry {
  const k = `${inner}_${outer}_${arc.toFixed(2)}_${seg}`; let g = SG.get(k); if (g) return g;
  const v: number[] = []; const idx: number[] = [];
  for (let i = 0; i <= seg; i++) { const a = -arc / 2 + (arc * i) / seg; const s = Math.sin(a), c = Math.cos(a); v.push(s * inner, 0, c * inner, s * outer, 0, c * outer); if (i < seg) { const b = i * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); } }
  g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); g.userData.keep = true; SG.set(k, g); return g;
}
let _line: THREE.BufferGeometry | null = null;
const lineGeo = () => _line || (_line = (() => { const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5); g.userData.keep = true; return g; })());

export interface TG { g: THREE.Group; base: THREE.Mesh; fill: THREE.Mesh; kind: string; a: number; b: number; used: boolean; set(x: number, z: number, yaw: number, p: number): void; hide(): void }
export class Telegraph {
  pool: TG[] = []; scene: THREE.Scene;
  constructor(scene: THREE.Scene) { this.scene = scene; for (let i = 0; i < 28; i++) this.pool.push(this.mk()); }
  mk(): TG {
    const g = new THREE.Group(); g.visible = false;
    const bm = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    const fm = bm.clone(); fm.opacity = 0.42;
    const base = new THREE.Mesh(lineGeo(), bm); const fill = new THREE.Mesh(lineGeo(), fm); base.renderOrder = 2; fill.renderOrder = 3; base.position.y = fill.position.y = 0.07; g.add(base, fill); this.scene.add(g);
    const t: TG = { g, base, fill, kind: '', a: 1, b: 1, used: false,
      set(x, z, yaw, p) { g.position.set(x, 0, z); g.rotation.y = yaw; p = Math.max(0.001, Math.min(1, p)); if (t.kind === 'line') { fill.scale.set(t.b, 1, t.a * p); } else { fill.scale.set(t.a * p, 1, t.a * p); } },
      hide() { g.visible = false; t.used = false; } };
    return t;
  }
  show(kind: 'circle' | 'cone' | 'line', size: number, arcOrWidth: number, color: number): TG | null {
    const t = this.pool.find((p) => !p.used); if (!t) return null; t.used = true; t.kind = kind; t.a = size; t.b = arcOrWidth; t.g.visible = true;
    const geo = kind === 'line' ? lineGeo() : sectorGeo(0, 1, kind === 'circle' ? Math.PI * 2 : arcOrWidth, kind === 'circle' ? 40 : 24);
    t.base.geometry = geo; t.fill.geometry = geo;
    (t.base.material as THREE.MeshBasicMaterial).color.setHex(color); (t.fill.material as THREE.MeshBasicMaterial).color.setHex(color);
    if (kind === 'line') t.base.scale.set(arcOrWidth, 1, size); else t.base.scale.set(size, 1, size);
    return t;
  }
}

interface Eff { m: THREE.Object3D; t: number; dur: number; fn: (f: number, m: any) => void; mat?: THREE.Material }
export class Effects {
  list: Eff[] = []; scene: THREE.Scene;
  constructor(scene: THREE.Scene) { this.scene = scene; }
  add(m: THREE.Object3D, dur: number, fn: (f: number, m: any) => void, mat?: THREE.Material) { if (this.list.length > 70) this.kill(this.list.shift()!); this.scene.add(m); this.list.push({ m, t: 0, dur, fn, mat }); }
  kill(e: Eff) { this.scene.remove(e.m); e.mat?.dispose(); }
  mat(color: number, op = 0.8) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); }
  ring(x: number, z: number, r0: number, r1: number, color: number, dur = 0.5, y = 0.12, thick = 0.18) {
    const mat = this.mat(color); const m = new THREE.Mesh(sectorGeo(1 - thick, 1, Math.PI * 2, 40), mat); m.position.set(x, y, z); m.scale.setScalar(r0);
    this.add(m, dur, (f, mm) => { const s = r0 + (r1 - r0) * (1 - Math.pow(1 - f, 2)); mm.scale.setScalar(s); mat.opacity = 0.85 * (1 - f); }, mat);
  }
  disc(x: number, z: number, r: number, color: number, dur = 0.4) {
    const mat = this.mat(color, 0.6); const m = new THREE.Mesh(sectorGeo(0, 1, Math.PI * 2, 32), mat); m.position.set(x, 0.1, z); m.scale.setScalar(r);
    this.add(m, dur, (f) => { mat.opacity = 0.6 * (1 - f); m.scale.setScalar(r * (0.6 + 0.5 * f)); }, mat);
  }
  pillar(x: number, z: number, r: number, h: number, color: number, dur = 0.7) {
    const mat = this.mat(color, 0.7); const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), mat); m.position.set(x, h / 2, z);
    this.add(m, dur, (f) => { const k = f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8; m.scale.set(r * (0.4 + 0.6 * k), h, r * (0.4 + 0.6 * k)); mat.opacity = 0.75 * k; }, mat); (m.geometry as THREE.BufferGeometry).userData.own = true;
    const old = mat; const dispose = old.dispose.bind(old); old.dispose = () => { dispose(); m.geometry.dispose(); };
  }
  crescent(x: number, y: number, z: number, yaw: number, range: number, arc: number, color: number, dur = 0.3, tilt = 0) {
    const mat = this.mat(color, 0.85); const m = new THREE.Mesh(sectorGeo(0.55, 1, arc, 24), mat); m.position.set(x, y, z); m.rotation.set(tilt, yaw, 0, 'YXZ'); m.scale.setScalar(range * 0.4);
    this.add(m, dur, (f) => { m.scale.setScalar(range * (0.4 + 0.6 * Math.sqrt(f))); mat.opacity = 0.85 * (1 - f * f); }, mat);
  }
  burst(x: number, y: number, z: number, r: number, color: number, dur = 0.35) {
    const mat = this.mat(color, 0.8); const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat); m.position.set(x, y, z);
    this.add(m, dur, (f) => { m.scale.setScalar(r * (0.2 + f)); mat.opacity = 0.8 * (1 - f); }, mat); const d = mat.dispose.bind(mat); mat.dispose = () => { d(); m.geometry.dispose(); };
  }
  beam(a: THREE.Vector3, b: THREE.Vector3, color: number, w: number, dur: number) {
    const mat = this.mat(color, 0.9); const len = a.distanceTo(b); const m = new THREE.Mesh(new THREE.CylinderGeometry(w, w, len, 8, 1, true), mat);
    m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.add(m, dur, (f) => { mat.opacity = 0.9 * (1 - f); m.scale.x = m.scale.z = 1 - f * 0.6; }, mat); const d = mat.dispose.bind(mat); mat.dispose = () => { d(); m.geometry.dispose(); };
  }
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) { const e = this.list[i]; e.t += dt; const f = e.t / e.dur; if (f >= 1) { this.kill(e); this.list.splice(i, 1); } else e.fn(f, e.m); }
  }
  clear() { for (const e of this.list) this.kill(e); this.list = []; }
}
