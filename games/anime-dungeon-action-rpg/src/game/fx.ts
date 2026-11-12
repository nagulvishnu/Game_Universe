import * as THREE from 'three';

const NP = 2200;
const pv = `attribute float size; attribute float alpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;
void main(){ vA=alpha; vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const pf = `varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.05,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(vC*(1.0+a),a); }`;

interface Prim { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; dur: number; kind: string; a: number; b: number; active: boolean; op: number }
export interface Tele { active: boolean; t: number; dur: number; base: THREE.Mesh; fill: THREE.Mesh; shape: string; len: number; r: number }
const arcGeos = new Map<string, THREE.BufferGeometry>();
function crescent(arc: number) {
  const k = arc.toFixed(2); let g = arcGeos.get(k);
  if (!g) { g = arc > 6 ? new THREE.RingGeometry(0.8, 1, 48, 1) : new THREE.RingGeometry(0.5, 1, 28, 1, -Math.PI / 2 - arc / 2, arc); g.rotateX(-Math.PI / 2); arcGeos.set(k, g); }
  return g;
}
function wedge(arc: number, r = 1) {
  const k = 'w' + arc.toFixed(2); let g = arcGeos.get(k);
  if (!g) { g = arc > 6 ? new THREE.CircleGeometry(r, 40) : new THREE.CircleGeometry(r, 24, -Math.PI / 2 - arc / 2, arc); g.rotateX(-Math.PI / 2); arcGeos.set(k, g); }
  return g;
}

export class FX {
  scene: THREE.Scene; dens = 1; shakeAmt = 0; shakeMul = 1; layer: HTMLElement | null = null;
  // particles
  pos = new Float32Array(NP * 3); vel = new Float32Array(NP * 3); col = new Float32Array(NP * 3); size = new Float32Array(NP); alpha = new Float32Array(NP);
  life = new Float32Array(NP); maxLife = new Float32Array(NP); grav = new Float32Array(NP); base = new Float32Array(NP); drag = new Float32Array(NP);
  next = 0; points: THREE.Points; geo: THREE.BufferGeometry; pmat: THREE.ShaderMaterial;
  prims: Prim[] = []; teles: Tele[] = []; nums: { el: HTMLElement; p: THREE.Vector3; t: number; vy: number }[] = [];
  beams: Prim[] = [];
  private tmpC = new THREE.Color();
  private _v = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.pmat = new THREE.ShaderMaterial({ vertexShader: pv, fragmentShader: pf, uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(this.geo, this.pmat); this.points.frustumCulled = false; scene.add(this.points);
    for (let i = 0; i < NP; i++) this.pos[i * 3 + 1] = -999;
    const bg = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 90; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(bg, mat); mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh);
      this.prims.push({ mesh, mat, t: 0, dur: 1, kind: '', a: 0, b: 0, active: false, op: 1 });
    }
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), mat); mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh);
      this.beams.push({ mesh, mat, t: 0, dur: 0, kind: 'beam', a: 0, b: 0, active: false, op: 1 });
    }
    for (let i = 0; i < 16; i++) {
      const mk = (op: number) => { const m = new THREE.Mesh(wedge(7), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); m.visible = false; m.frustumCulled = false; m.renderOrder = 2; scene.add(m); return m; };
      this.teles.push({ active: false, t: 0, dur: 1, base: mk(0.28), fill: mk(0.5), shape: 'circle', len: 1, r: 1 });
    }
  }
  setScale(h: number, fov: number) { this.pmat.uniforms.uScale.value = (h * 0.5) / Math.tan((fov * Math.PI) / 360); }
  clear() {
    this.life.fill(0); for (let i = 0; i < NP; i++) { this.pos[i * 3 + 1] = -999; this.alpha[i] = 0; }
    for (const p of this.prims) { p.active = false; p.mesh.visible = false; } for (const t of this.teles) { t.active = false; t.base.visible = t.fill.visible = false; }
    for (const b of this.beams) { b.active = false; b.mesh.visible = false; }
  }
  // ----- particles -----
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, life: number, size: number, grav = 0, drag = 0) {
    const i = this.next; this.next = (this.next + 1) % NP; const j = i * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z; this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.tmpC.setHex(color); this.col[j] = this.tmpC.r; this.col[j + 1] = this.tmpC.g; this.col[j + 2] = this.tmpC.b;
    this.life[i] = this.maxLife[i] = life; this.base[i] = size; this.grav[i] = grav; this.drag[i] = drag;
  }
  burst(x: number, y: number, z: number, color: number, n: number, speed: number, life = 0.6, size = 0.2, grav = 8, up = 0.4) {
    n = Math.max(1, Math.round(n * this.dens));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.6, s = speed * (0.3 + Math.random() * 0.7);
      this.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s * 0.9 + speed * up, Math.sin(a) * Math.cos(e) * s, color, life * (0.5 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8), grav, 1.5);
    }
  }
  cone(x: number, y: number, z: number, dx: number, dz: number, color: number, n: number, speed: number, spread = 0.5, life = 0.4, size = 0.2) {
    n = Math.max(1, Math.round(n * this.dens)); const a0 = Math.atan2(dx, dz);
    for (let k = 0; k < n; k++) { const a = a0 + (Math.random() - 0.5) * spread * 2, s = speed * (0.4 + Math.random() * 0.6); this.emit(x, y, z, Math.sin(a) * s, (Math.random() - 0.3) * speed * 0.4, Math.cos(a) * s, color, life * (0.6 + Math.random() * 0.6), size, 4, 2); }
  }
  // ----- prims -----
  private prim(kind: string, color: number, dur: number, op = 0.8): Prim {
    let p = this.prims.find((q) => !q.active);
    if (!p) { p = this.prims.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b)); }
    p.active = true; p.t = 0; p.dur = dur; p.kind = kind; p.op = op; p.mat.color.setHex(color); p.mat.opacity = op; p.mesh.visible = true; p.mesh.rotation.set(0, 0, 0); p.mesh.rotation.order = 'XYZ';
    return p;
  }
  ring(x: number, y: number, z: number, color: number, r1: number, dur = 0.5, r0 = 0.3, op = 0.8) {
    const p = this.prim('ring', color, dur, op); p.mesh.geometry = crescent(7); p.mesh.position.set(x, y + 0.08, z); p.a = r0; p.b = r1; p.mesh.scale.set(r0, 1, r0);
  }
  slash(x: number, y: number, z: number, yaw: number, tilt: number, range: number, arc: number, color: number, dur = 0.22, op = 0.85) {
    const p = this.prim('slash', color, dur, op); p.mesh.geometry = arc > 6 ? crescent(7) : crescent(Math.round(Math.min(5, Math.max(0.6, arc)) * 4) / 4);
    p.mesh.position.set(x, y, z); p.mesh.rotation.order = 'YXZ'; p.mesh.rotation.set(0, yaw, tilt); p.a = range * 0.85; p.b = range; p.mesh.scale.set(p.a, 1, p.a);
  }
  streak(x: number, y: number, z: number, yaw: number, len: number, w: number, color: number, dur = 0.2) {
    const p = this.prim('streak', color, dur, 0.7); p.mesh.geometry = streakGeo(); p.mesh.position.set(x, y, z); p.mesh.rotation.order = 'YXZ'; p.mesh.rotation.set(0, yaw, 0); p.a = len; p.b = w; p.mesh.scale.set(w, w, len * 0.3);
  }
  blast(x: number, y: number, z: number, color: number, r: number, dur = 0.4, op = 0.7) {
    const p = this.prim('blast', color, dur, op); p.mesh.geometry = sphGeo(); p.mesh.position.set(x, y, z); p.a = r * 0.3; p.b = r; p.mesh.scale.setScalar(p.a);
  }
  pillar(x: number, y: number, z: number, color: number, r: number, h: number, dur = 0.4, op = 0.7) {
    const p = this.prim('pillar', color, dur, op); p.mesh.geometry = cylGeo(); p.mesh.position.set(x, y + h / 2, z); p.a = r; p.b = h; p.mesh.scale.set(r, h, r);
  }
  beam(a: THREE.Vector3, b: THREE.Vector3, color: number, w = 0.4, op = 0.7) {
    let p = this.beams.find((q) => !q.active) || this.beams[0];
    p.active = true; p.t = 0; p.dur = 0.09; p.mat.color.setHex(color); p.mat.opacity = op; p.mesh.visible = true;
    const len = a.distanceTo(b); p.mesh.position.copy(a).lerp(b, 0.5); p.mesh.scale.set(w, len, w);
    p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._v.copy(b).sub(a).normalize());
  }
  // ----- telegraphs -----
  tele(shape: 'circle' | 'cone' | 'rect', x: number, z: number, yaw: number, size: number, arc: number, color: number, dur: number): Tele {
    let t = this.teles.find((q) => !q.active) || this.teles[0];
    t.active = true; t.t = 0; t.dur = dur; t.shape = shape; t.r = size; t.len = size;
    const g = shape === 'circle' ? wedge(7) : shape === 'cone' ? wedge(arc) : rectGeo();
    t.base.geometry = g; t.fill.geometry = g;
    for (const m of [t.base, t.fill]) { m.visible = true; m.position.set(x, 0.07, z); m.rotation.y = shape === 'circle' ? 0 : yaw; (m.material as THREE.MeshBasicMaterial).color.setHex(color); }
    if (shape === 'rect') { t.base.scale.set(arc, 1, size); t.fill.scale.set(arc, 1, 0.01); } else { t.base.scale.set(size, 1, size); t.fill.scale.set(0.01, 1, 0.01); }
    t.len = arc; return t;
  }
  moveTele(t: Tele, x: number, z: number, yaw?: number) { t.base.position.x = t.fill.position.x = x; t.base.position.z = t.fill.position.z = z; if (yaw !== undefined && t.shape !== 'circle') t.base.rotation.y = t.fill.rotation.y = yaw; }
  killTele(t: Tele | null) { if (t) { t.active = false; t.base.visible = t.fill.visible = false; } }
  // ----- numbers -----
  num(p: THREE.Vector3, text: string, color: string, size = 1) {
    if (!this.layer) return;
    let n = this.nums.find((q) => q.t <= 0);
    if (!n) { const el = document.createElement('div'); el.className = 'dmgnum'; this.layer.appendChild(el); n = { el, p: new THREE.Vector3(), t: 0, vy: 0 }; if (this.nums.length < 40) this.nums.push(n); else n = this.nums[0]; }
    n.p.copy(p); n.p.x += (Math.random() - 0.5) * 0.6; n.t = 0.9; n.vy = 2.2; n.el.textContent = text; n.el.style.color = color; n.el.style.fontSize = `${Math.round(18 * size)}px`; n.el.style.display = 'block';
  }
  shake(a: number) { this.shakeAmt = Math.min(1.6, Math.max(this.shakeAmt, a * this.shakeMul)); }
  update(dt: number, cam: THREE.Camera, w: number, h: number) {
    // particles
    for (let i = 0; i < NP; i++) {
      const l = this.life[i];
      if (l <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      const j = i * 3, nl = l - dt; this.life[i] = nl;
      if (nl <= 0) { this.alpha[i] = 0; this.size[i] = 0; this.pos[j + 1] = -999; continue; }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[j] *= dr; this.vel[j + 2] *= dr; this.vel[j + 1] = this.vel[j + 1] * dr - this.grav[i] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.05 && this.grav[i] > 0) { this.pos[j + 1] = 0.05; this.vel[j + 1] *= -0.3; }
      const k = nl / this.maxLife[i]; this.alpha[i] = Math.min(1, k * 1.6); this.size[i] = this.base[i] * (0.4 + k * 0.6);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true; (this.geo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    // prims
    for (const p of this.prims) {
      if (!p.active) continue;
      p.t += dt; const k = Math.min(1, p.t / p.dur), e = 1 - (1 - k) * (1 - k);
      if (k >= 1) { p.active = false; p.mesh.visible = false; continue; }
      p.mat.opacity = p.op * (1 - k * k);
      switch (p.kind) {
        case 'ring': { const s = p.a + (p.b - p.a) * e; p.mesh.scale.set(s, 1, s); break; }
        case 'slash': { const s = p.a + (p.b - p.a) * e; p.mesh.scale.set(s, 1, s); p.mat.opacity = p.op * (1 - k) * (k < 0.15 ? k / 0.15 : 1); break; }
        case 'blast': { const s = p.a + (p.b - p.a) * e; p.mesh.scale.setScalar(s); break; }
        case 'pillar': { const s = p.a * (1 - k * 0.6); p.mesh.scale.set(s, p.b, s); break; }
        case 'streak': { p.mesh.scale.set(p.b * (1 - k), p.b * (1 - k), p.a * (0.3 + e * 0.7)); break; }
      }
    }
    for (const b of this.beams) { if (!b.active) continue; b.t += dt; if (b.t > b.dur) { b.active = false; b.mesh.visible = false; } }
    for (const t of this.teles) {
      if (!t.active) continue;
      t.t += dt; const k = Math.min(1, t.t / t.dur);
      if (t.shape === 'rect') t.fill.scale.z = Math.max(0.01, t.r * k); else { const s = Math.max(0.01, t.r * k); t.fill.scale.set(s, 1, s); }
      if (k >= 1) { t.active = false; t.base.visible = t.fill.visible = false; }
    }
    // numbers
    for (const n of this.nums) {
      if (n.t <= 0) continue;
      n.t -= dt; n.p.y += n.vy * dt; n.vy *= 0.94;
      if (n.t <= 0) { n.el.style.display = 'none'; continue; }
      this._v.copy(n.p).project(cam);
      if (this._v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = 'block'; n.el.style.opacity = String(Math.min(1, n.t * 3));
      n.el.style.transform = `translate(${(this._v.x * 0.5 + 0.5) * w}px, ${(-this._v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${0.8 + Math.min(0.4, n.t * 0.6)})`;
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 3.2);
  }
}
let _sg: THREE.BufferGeometry | null = null, _sp: THREE.BufferGeometry | null = null, _cy: THREE.BufferGeometry | null = null, _rc: THREE.BufferGeometry | null = null;
function streakGeo() { if (!_sg) { _sg = new THREE.ConeGeometry(1, 3, 8, 1, true); _sg.rotateX(Math.PI / 2); _sg.translate(0, 0, 1.5); } return _sg; }
function sphGeo() { return (_sp ||= new THREE.SphereGeometry(1, 16, 12)); }
function cylGeo() { return (_cy ||= new THREE.CylinderGeometry(1, 0.7, 1, 18, 1, true)); }
function rectGeo() { if (!_rc) { _rc = new THREE.PlaneGeometry(1, 1); _rc.rotateX(-Math.PI / 2); _rc.translate(0, 0, 0.5); } return _rc; }

// ----- weapon trail ribbon -----
export class Trail {
  mesh: THREE.Mesh; N = 16; pts: THREE.Vector3[] = []; base: THREE.Vector3[] = []; strength = 0; geo: THREE.BufferGeometry; colr = new THREE.Color(); active = false;
  constructor(scene: THREE.Scene) {
    const N = this.N; this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
    for (let i = 0; i < N; i++) { this.pts.push(new THREE.Vector3()); this.base.push(new THREE.Vector3()); }
  }
  setColor(c: number) { this.colr.setHex(c); }
  push(tip: THREE.Vector3, base: THREE.Vector3, on: boolean, dt: number) {
    this.active = on; this.strength += ((on ? 1 : 0) - this.strength) * Math.min(1, dt * (on ? 30 : 9));
    if (this.strength < 0.02 && !on) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const t = this.pts.pop()!, b = this.base.pop()!; t.copy(tip); b.copy(base); this.pts.unshift(t); this.base.unshift(b);
    const pos = this.geo.attributes.position as THREE.BufferAttribute, col = this.geo.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < this.N; i++) {
      const f = Math.pow(1 - i / (this.N - 1), 1.6) * this.strength;
      pos.setXYZ(i * 2, this.pts[i].x, this.pts[i].y, this.pts[i].z); pos.setXYZ(i * 2 + 1, this.base[i].x, this.base[i].y, this.base[i].z);
      col.setXYZ(i * 2, this.colr.r * f, this.colr.g * f, this.colr.b * f); col.setXYZ(i * 2 + 1, this.colr.r * f * 0.15, this.colr.g * f * 0.15, this.colr.b * f * 0.15);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
  reset() { for (const p of this.pts) p.set(0, -50, 0); for (const p of this.base) p.set(0, -50, 0); this.strength = 0; this.mesh.visible = false; }
}

// ----- ambient region particles -----
export class Ambient {
  pts: THREE.Points; n = 180; pos: Float32Array; seeds: Float32Array; kind = 'dust'; range = 30; geo = new THREE.BufferGeometry(); mat: THREE.PointsMaterial; col = new THREE.Color();
  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(this.n * 3); this.seeds = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n * 3; i++) this.seeds[i] = Math.random();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.16, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.pts = new THREE.Points(this.geo, this.mat); this.pts.frustumCulled = false; scene.add(this.pts);
  }
  set(kind: string, color: number, density: number) { this.kind = kind; this.mat.color.setHex(color); this.geo.setDrawRange(0, Math.round(this.n * density)); this.mat.size = kind === 'snow' ? 0.14 : kind === 'bubble' ? 0.25 : kind === 'feather' ? 0.22 : 0.16; }
  update(t: number, c: THREE.Vector3) {
    const R = this.range, k = this.kind;
    for (let i = 0; i < this.n; i++) {
      const sx = this.seeds[i * 3], sy = this.seeds[i * 3 + 1], sz = this.seeds[i * 3 + 2];
      let x = (sx * 2 - 1) * R, y = sy * 12, z = (sz * 2 - 1) * R;
      const sp = 0.3 + sy * 0.7;
      switch (k) {
        case 'snow': y = 12 - ((t * (1.2 + sp) + sy * 12) % 12); x += Math.sin(t * 0.6 + i) * 0.8; break;
        case 'ember': case 'spark': case 'ash': y = (t * (0.8 + sp) + sy * 12) % 12; x += Math.sin(t * 1.3 + i) * 0.6; break;
        case 'bubble': y = (t * (0.6 + sp * 0.6) + sy * 12) % 12; x += Math.sin(t * 0.8 + i) * 0.5; break;
        case 'feather': y = 12 - ((t * (0.5 + sp * 0.4) + sy * 12) % 12); x += Math.sin(t * 0.7 + i) * 1.4; break;
        case 'star': y = (sy * 12 + Math.sin(t * 0.3 + i) * 1.5); x += Math.sin(t * 0.2 + i) * 1.2; break;
        default: y = 0.6 + sy * 5 + Math.sin(t * 0.9 + i) * 0.6; x += Math.sin(t * 0.4 + i * 1.7) * 1.5; z += Math.cos(t * 0.35 + i) * 1.5;
      }
      // wrap around camera focus
      let wx = x - c.x, wz = z - c.z; wx = ((wx + R) % (2 * R) + 2 * R) % (2 * R) - R; wz = ((wz + R) % (2 * R) + 2 * R) % (2 * R) - R;
      this.pos[i * 3] = c.x + wx; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = c.z + wz;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
