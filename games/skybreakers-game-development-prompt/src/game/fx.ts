// Visual effects: pooled GPU points particles, shockwaves, telegraphs, lightning bolts, slashes, floating damage numbers.
import * as THREE from 'three';
import { glowTex } from './gfx';
import { rand } from './runtime';

const VS = `attribute float aSize; attribute vec4 aColor; varying vec4 vC; uniform float uScale;
void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const FS = `varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d)*2.0; if(r>1.0) discard; float a=1.0-smoothstep(0.0,1.0,r); gl_FragColor=vec4(vC.rgb*(0.6+0.8*a), vC.a*a); }`;

interface Temp { obj: THREE.Object3D; t: number; dur: number; upd: (k: number, o: THREE.Object3D) => void; dispose?: boolean; loop?: boolean }
const tmpC = new THREE.Color();
class FX {
  scene!: THREE.Scene; N = 2500; pts!: THREE.Points; pos!: Float32Array; col!: Float32Array; size!: Float32Array; vel!: Float32Array; life!: Float32Array; maxLife!: Float32Array; grav!: Float32Array; drag!: Float32Array; grow!: Float32Array; base!: Float32Array;
  head = 0; temps: Temp[] = []; uniforms = { uScale: { value: 500 } }; mult = 1; numCache = new Map<string, THREE.SpriteMaterial>();
  ringGeo = new THREE.RingGeometry(0.85, 1, 40); discGeo = new THREE.CircleGeometry(1, 36); boxGeo = new THREE.BoxGeometry(1, 1, 1);

  init(scene: THREE.Scene, quality: 'low' | 'medium' | 'high') {
    this.scene = scene; this.N = quality === 'low' ? 1200 : quality === 'medium' ? 2600 : 4200; this.mult = quality === 'low' ? 0.5 : quality === 'medium' ? 0.8 : 1; const N = this.N;
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 4); this.size = new Float32Array(N); this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.maxLife = new Float32Array(N).fill(1); this.grav = new Float32Array(N); this.drag = new Float32Array(N); this.grow = new Float32Array(N); this.base = new Float32Array(N);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); this.pts.frustumCulled = false; this.pts.renderOrder = 10; scene.add(this.pts);
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color | number | string, size: number, life: number, grav = 0, drag = 0, grow = 0, alpha = 1) {
    const i = this.head; this.head = (this.head + 1) % this.N; const c = color instanceof THREE.Color ? color : tmpC.set(color as any);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = alpha; this.size[i] = size; this.base[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
  }
  burst(p: THREE.Vector3 | { x: number; y: number; z: number }, n: number, color: number | string, speed: number, size: number, life: number, grav = 0, up = 0) {
    n = Math.ceil(n * this.mult); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1); const s = speed * (0.3 + Math.random() * 0.7); this.emit(p.x, p.y, p.z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s + up, Math.sin(b) * Math.sin(a) * s, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav, 1.2); }
  }
  sparks(p: THREE.Vector3, color: number | string = '#ffe9a0', n = 10) { this.burst(p, n, color, 9, 0.35, 0.4, 14); this.burst(p, 3, '#ffffff', 5, 0.5, 0.2, 0); }
  trail(p: THREE.Vector3, color: number | string, size = 0.5, life = 0.35, spread = 0.3) { this.emit(p.x + rand(-spread, spread), p.y + rand(-spread, spread), p.z + rand(-spread, spread), rand(-0.5, 0.5), rand(-0.5, 1), rand(-0.5, 0.5), color, size, life, 0, 1, -size * 1.2); }
  add(obj: THREE.Object3D, dur: number, upd: Temp['upd'], dispose = false) { this.scene.add(obj); const t = { obj, t: 0, dur, upd, dispose }; this.temps.push(t); return t; }
  flash(p: THREE.Vector3, color: number | string, size: number, dur = 0.25) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.position.copy(p); s.scale.setScalar(size);
    this.add(s, dur, (k, o) => { const m = (o as THREE.Sprite).material as THREE.SpriteMaterial; m.opacity = 1 - k; o.scale.setScalar(size * (0.6 + k * 0.9)); }, true);
  }
  shockwave(p: THREE.Vector3, radius: number, color: number | string, dur = 0.6, flat = true) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.copy(p); if (flat) m.rotation.x = -Math.PI / 2; else m.lookAt(p.x, p.y + 1, p.z);
    this.add(m, dur, (k, o) => { o.scale.setScalar(0.3 + radius * k); ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9; }, true);
  }
  explosion(p: THREE.Vector3, size = 1, kind: 'fire' | 'ice' | 'arcane' | 'lightning' | 'dark' | 'stone' | 'big' = 'fire') {
    const pal = { fire: ['#ff8a1a', '#ffd23a', '#ff4a0a'], ice: ['#8fe8ff', '#ffffff', '#4ac8ff'], arcane: ['#c26bff', '#ffffff', '#8a3aff'], lightning: ['#fff27a', '#ffffff', '#8fd8ff'], dark: ['#b04cff', '#5a1a9a', '#ff4aff'], stone: ['#b8a888', '#8a8478', '#d8c8a8'], big: ['#ff8a1a', '#ffd23a', '#ff4a0a'] }[kind];
    for (let i = 0; i < 3; i++) this.burst(p, 18 * size, pal[i], 10 * size, 1.2 * size, 0.7, kind === 'stone' ? 12 : -1);
    this.flash(p, pal[0], 9 * size, 0.35); this.shockwave(new THREE.Vector3(p.x, p.y + 0.2, p.z), 5 * size, pal[0], 0.5);
    if (kind === 'fire' || kind === 'big') this.burst(p, 8 * size, '#3a2a28', 4 * size, 1.8 * size, 1.1, -2, 3);
  }
  telegraph(p: THREE.Vector3, radius: number, dur: number, color: number | string = '#ff3a2a') {
    const g = new THREE.Group(); const d = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide })); const r = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    const f = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); [d, r, f].forEach(m => { m.rotation.x = -Math.PI / 2; g.add(m); }); g.position.set(p.x, p.y + 0.25, p.z); d.scale.setScalar(radius); r.scale.setScalar(radius);
    return this.add(g, dur, (k) => { f.scale.setScalar(radius * k); (d.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.12 * Math.sin(k * 40); }, true);
  }
  telegraphBox(p: THREE.Vector3, yaw: number, w: number, l: number, dur: number, color: number | string = '#ff3a2a') {
    const g = new THREE.Group(); const d = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })); const f = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    d.rotation.x = -Math.PI / 2; f.rotation.x = -Math.PI / 2; d.position.z = l / 2; f.position.z = l / 2; g.add(d, f); g.position.set(p.x, p.y + 0.3, p.z); g.rotation.y = yaw;
    return this.add(g, dur, (k) => { f.scale.set(1, k, 1); f.position.z = (l * k) / 2; }, true);
  }
  pillar(p: THREE.Vector3, radius: number, height: number, color: number | string, dur = 0.5) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.position.set(p.x, p.y + height / 2, p.z);
    this.add(m, dur, (k, o) => { o.scale.set(1 - k * 0.6, 1, 1 - k * 0.6); ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k); }, true);
  }
  bolt(from: THREE.Vector3, to: THREE.Vector3, color: number | string = '#fff6a0', width = 0.35, dur = 0.28) {
    const g = new THREE.Group(); const mt = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); const segs = 12; let prev = from.clone(); const dir = to.clone().sub(from);
    for (let i = 1; i <= segs; i++) { const t = i / segs; const q = from.clone().addScaledVector(dir, t); if (i < segs) { q.x += rand(-1, 1) * 1.4 * (1 - t * 0.3); q.z += rand(-1, 1) * 1.4 * (1 - t * 0.3); }
      const len = prev.distanceTo(q); const m = new THREE.Mesh(this.boxGeo, mt); m.scale.set(width, width, len); m.position.copy(prev).add(q).multiplyScalar(0.5); m.lookAt(q); g.add(m); prev = q; }
    const t = this.add(g, dur, (k) => { mt.opacity = (1 - k) * (0.6 + 0.4 * Math.random()); }, true); this.flash(to, color, 7, dur);
    for (let i = 0; i < 12 * this.mult; i++) this.emit(to.x, to.y + 0.3, to.z, rand(-6, 6), rand(1, 8), rand(-6, 6), color, 0.5, 0.4, 14, 1);
    return t;
  }
  slash(p: THREE.Vector3, yaw: number, radius: number, color: number | string, arc = 2.2, tilt = 0, dur = 0.22, y = 1.2) {
    const geo = new THREE.RingGeometry(radius * 0.55, radius, 24, 1, -arc / 2, arc); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    const g = new THREE.Group(); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2; g.add(m); g.position.set(p.x, p.y + y, p.z); g.rotation.set(tilt, yaw, 0, 'YXZ');
    this.add(g, dur, (k) => { (m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9; g.scale.setScalar(0.85 + k * 0.3); m.rotation.z = Math.PI / 2 - arc * 0.15 + k * arc * 0.3; }, true).obj.userData.geo = geo;
  }
  dmg(p: THREE.Vector3, text: string, color = '#ffffff', big = false) {
    const key = text + color + (big ? 'b' : ''); let sm = this.numCache.get(key);
    if (!sm) { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d')!; x.font = `900 ${big ? 46 : 36}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 7; x.strokeStyle = 'rgba(10,10,30,0.95)'; x.strokeText(text, 64, 34); x.fillStyle = color; x.fillText(text, 64, 34); sm = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, fog: false }); if (this.numCache.size > 300) this.numCache.clear(); this.numCache.set(key, sm); }
    const s = new THREE.Sprite(sm); s.position.set(p.x + rand(-0.4, 0.4), p.y + 0.5, p.z + rand(-0.4, 0.4)); s.scale.set(big ? 3.4 : 2.6, big ? 1.7 : 1.3, 1); s.renderOrder = 20; const y0 = s.position.y;
    this.add(s, 0.9, (k, o) => { o.position.y = y0 + k * 2.2; (o.scale as THREE.Vector3).multiplyScalar(1 + (k < 0.15 ? 0.04 : -0.002)); });
  }
  update(dt: number, h: number) {
    this.uniforms.uScale.value = h * 0.8;
    const { pos, vel, life, size, base, grav, drag, grow, col, maxLife } = this; let dirty = false;
    for (let i = 0; i < this.N; i++) { if (life[i] <= 0) continue; dirty = true; life[i] -= dt; const i3 = i * 3;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
      const dg = 1 - Math.min(1, drag[i] * dt); vel[i3] *= dg; vel[i3 + 1] = vel[i3 + 1] * dg - grav[i] * dt; vel[i3 + 2] *= dg; pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      const k = life[i] / maxLife[i]; base[i] = Math.max(0, base[i] + grow[i] * dt); size[i] = base[i] * (0.3 + 0.7 * Math.min(1, k * 2)); col[i * 4 + 3] = Math.min(1, k * 1.6); }
    if (dirty) { const a = this.pts.geometry.attributes; a.position.needsUpdate = true; a.aColor.needsUpdate = true; a.aSize.needsUpdate = true; }
    for (let i = this.temps.length - 1; i >= 0; i--) { const t = this.temps[i]; t.t += dt; const k = Math.min(1, t.t / t.dur); t.upd(k, t.obj); if (k >= 1) { this.scene.remove(t.obj); if (t.dispose) t.obj.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as any)?.dispose) (m.material as THREE.Material).dispose(); }); this.temps.splice(i, 1); } }
  }
}
export const fx = new FX();
