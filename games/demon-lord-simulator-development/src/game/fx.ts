import * as THREE from 'three';
import { GS, GT } from './models';

const N = 2200;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
interface Ring { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; life: number; r0: number; r1: number; alive: boolean; kind: number }

export class FX {
  mesh: THREE.InstancedMesh; px = new Float32Array(N * 3); pv = new Float32Array(N * 3); life = new Float32Array(N); max = new Float32Array(N); size = new Float32Array(N); col = new Float32Array(N * 3); grav = new Float32Array(N); drag = new Float32Array(N); head = 0;
  rings: Ring[] = []; blobs: Ring[] = [];
  constructor(scene: THREE.Object3D) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), N);
    this.mesh.frustumCulled = false; this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); scene.add(this.mesh);
    for (let i = 0; i < N; i++) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); }
    const mkR = (geo: THREE.BufferGeometry, n: number, arr: Ring[], kind: number) => { for (let i = 0; i < n; i++) { const mat = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); const m = new THREE.Mesh(geo, mat); m.visible = false; m.frustumCulled = false; scene.add(m); arr.push({ mesh: m, mat, t: 0, life: 1, r0: 0, r1: 1, alive: false, kind }); } };
    mkR(GT(1, 0.06, 6, 40), 28, this.rings, 0); mkR(GS(1, 14, 10), 14, this.blobs, 1);
  }
  burst(x: number, y: number, z: number, color: string, count: number, speed: number, size = 0.5, life = 0.8, grav = 0, up = 0, drag = 1.2) {
    _c.set(color);
    for (let k = 0; k < count; k++) {
      const i = this.head; this.head = (this.head + 1) % N; const j = i * 3;
      let dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l; const sp = speed * (0.3 + Math.random() * 0.7);
      this.px[j] = x; this.px[j + 1] = y; this.px[j + 2] = z; this.pv[j] = dx * sp; this.pv[j + 1] = dy * sp + up; this.pv[j + 2] = dz * sp;
      this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.6); this.size[i] = size * (0.5 + Math.random()); this.col[j] = _c.r; this.col[j + 1] = _c.g; this.col[j + 2] = _c.b; this.grav[i] = grav; this.drag[i] = drag;
    }
  }
  trail(x: number, y: number, z: number, color: string, size = 0.6, life = 0.4) { this.burst(x, y, z, color, 1, 0.5, size, life, 0, 0, 2); }
  ring(x: number, y: number, z: number, color: string, r1: number, life = 0.6, r0 = 0.5, vertical = false, rotY = 0) {
    const r = this.rings.find((q) => !q.alive) ?? this.rings[0]; r.alive = true; r.t = 0; r.life = life; r.r0 = r0; r.r1 = r1; r.mat.color.set(color); r.mesh.visible = true; r.mesh.position.set(x, y, z);
    r.mesh.rotation.set(vertical ? 0 : Math.PI / 2, vertical ? rotY : 0, 0); r.mesh.scale.setScalar(r0);
  }
  blob(x: number, y: number, z: number, color: string, r1: number, life = 0.6, r0 = 0.5) {
    const r = this.blobs.find((q) => !q.alive) ?? this.blobs[0]; r.alive = true; r.t = 0; r.life = life; r.r0 = r0; r.r1 = r1; r.mat.color.set(color); r.mesh.visible = true; r.mesh.position.set(x, y, z); r.mesh.scale.setScalar(r0);
  }
  update(dt: number) {
    let any = false;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      if (this.life[i] <= 0) { if (this.size[i] !== 0) { this.size[i] = 0; _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); any = true; } continue; }
      this.life[i] -= dt; const d = Math.max(0, 1 - this.drag[i] * dt); this.pv[j] *= d; this.pv[j + 1] = this.pv[j + 1] * d - this.grav[i] * dt; this.pv[j + 2] *= d;
      this.px[j] += this.pv[j] * dt; this.px[j + 1] += this.pv[j + 1] * dt; this.px[j + 2] += this.pv[j + 2] * dt;
      const f = Math.max(0, this.life[i] / this.max[i]); _m.compose(_p.set(this.px[j], this.px[j + 1], this.px[j + 2]), _q, _s.setScalar(this.size[i] * (0.3 + f * 0.7)));
      this.mesh.setMatrixAt(i, _m); this.mesh.setColorAt(i, _c.setRGB(this.col[j] * f, this.col[j + 1] * f, this.col[j + 2] * f)); any = true;
    }
    if (any) { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
    for (const arr of [this.rings, this.blobs]) for (const r of arr) {
      if (!r.alive) continue; r.t += dt; const k = r.t / r.life; if (k >= 1) { r.alive = false; r.mesh.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 2.2); r.mesh.scale.setScalar(r.r0 + (r.r1 - r.r0) * e); r.mat.opacity = (r.kind === 1 ? 0.45 : 0.9) * (1 - k);
    }
  }
  clear() { this.life.fill(0); for (const r of [...this.rings, ...this.blobs]) { r.alive = false; r.mesh.visible = false; } }
}
