import * as THREE from 'three';
import type { StyleDef } from '../types';

const vert = `
attribute float aSize; attribute float aAlpha; attribute vec3 aCol; uniform float uScale; varying float vA; varying vec3 vC;
void main(){ vA=aAlpha; vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*uScale/max(0.1,-mv.z); }`;
const frag = `
varying float vA; varying vec3 vC;
void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; float a=smoothstep(0.5,0.05,d)*vA; gl_FragColor=vec4(vC,a); }`;

class Particles {
  points: THREE.Points; max: number; head = 0;
  pos: Float32Array; col: Float32Array; size: Float32Array; alpha: Float32Array;
  vel: Float32Array; age: Float32Array; life: Float32Array; s0: Float32Array; s1: Float32Array; a0: Float32Array; grav: Float32Array; drag: Float32Array;
  geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial; alive = 0;
  constructor(max: number, additive: boolean) {
    this.max = max; this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.age = new Float32Array(max).fill(99); this.life = new Float32Array(max).fill(1); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.geo.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 600 } } });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, color: number, alpha = 1, grav = 0, drag = 0) {
    const i = this.head; this.head = (this.head + 1) % this.max; const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z; this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = alpha; this.grav[i] = grav; this.drag[i] = drag;
    this.col[i3] = ((color >> 16) & 255) / 255; this.col[i3 + 1] = ((color >> 8) & 255) / 255; this.col[i3 + 2] = (color & 255) / 255;
  }
  update(dt: number, scale: number) {
    this.mat.uniforms.uScale.value = scale; let n = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) { this.size[i] = 0; continue; }
      n++; this.age[i] += dt; const t = Math.min(1, this.age[i] / this.life[i]); const i3 = i * 3;
      const dr = Math.max(0, 1 - this.drag[i] * dt); this.vel[i3] *= dr; this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt; this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t; this.alpha[i] = this.a0[i] * (1 - t * t);
    }
    this.alive = n;
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.geo.attributes.aCol as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true; (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Item { obj: THREE.Object3D; age: number; life: number; upd: (it: Item, dt: number, t: number) => void; dispose: () => void; data?: Record<string, unknown> }

const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;
const tmpCol = new THREE.Color();

export class FX {
  group = new THREE.Group(); add: Particles; norm: Particles; items: Item[] = []; time = 0; maxItems = 90;
  nums: { s: THREE.Sprite; cv: HTMLCanvasElement; tex: THREE.CanvasTexture; t: number; vy: number }[] = [];
  numHead = 0; quality = 1;
  constructor(quality = 1) {
    this.quality = quality;
    this.add = new Particles(Math.floor(1800 * quality), true); this.norm = new Particles(Math.floor(900 * quality), false);
    this.group.add(this.add.points, this.norm.points);
    for (let i = 0; i < 16; i++) {
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 64; const tex = new THREE.CanvasTexture(cv);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })); s.visible = false; s.renderOrder = 20;
      this.group.add(s); this.nums.push({ s, cv, tex, t: 99, vy: 0 });
    }
  }
  update(dt: number, scale: number) {
    this.time += dt;
    this.add.update(dt, scale); this.norm.update(dt, scale);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.age += dt; it.upd(it, dt, this.time);
      if (it.age >= it.life) { this.group.remove(it.obj); it.dispose(); this.items.splice(i, 1); }
    }
    for (const n of this.nums) {
      if (n.t > 1) { n.s.visible = false; continue; }
      n.t += dt; n.s.position.y += n.vy * dt; n.vy *= 0.96; const m = n.s.material as THREE.SpriteMaterial; m.opacity = n.t > 0.6 ? Math.max(0, 1 - (n.t - 0.6) / 0.4) : 1;
      if (n.t > 1) n.s.visible = false;
    }
  }
  private push(it: Item) {
    if (this.items.length >= this.maxItems) { const o = this.items.shift()!; this.group.remove(o.obj); o.dispose(); }
    this.group.add(it.obj); this.items.push(it);
  }

  // ---------- numbers ----------
  number(pos: THREE.Vector3, text: string, color = '#ffffff', big = false) {
    const n = this.nums[this.numHead]; this.numHead = (this.numHead + 1) % this.nums.length;
    const g = n.cv.getContext('2d')!; g.clearRect(0, 0, 160, 64); g.font = `900 ${big ? 46 : 34}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = 'rgba(10,0,10,0.95)'; g.strokeText(text, 80, 32); g.fillStyle = color; g.fillText(text, 80, 32); n.tex.needsUpdate = true;
    n.s.position.set(pos.x + rnd(0.3), pos.y, pos.z + rnd(0.3)); n.s.scale.set(big ? 1.8 : 1.3, big ? 0.72 : 0.52, 1); n.s.visible = true; n.t = 0; n.vy = 2.2;
  }

  // ---------- particles ----------
  sparks(p: THREE.Vector3, n: number, color: number, speed = 6, size = 0.18, life = 0.45) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; const e = Math.random() * 2 - 0.6; this.add.emit(p.x, p.y, p.z, Math.cos(a) * speed * Math.random(), e * speed * 0.7, Math.sin(a) * speed * Math.random(), life * (0.6 + Math.random() * 0.6), size, 0.02, color, 1, 8, 1); }
  }
  flash(p: THREE.Vector3, color: number, size = 2.2, life = 0.18) { this.add.emit(p.x, p.y, p.z, 0, 0, 0, life, size, size * 1.6, color, 1); }
  dust(p: THREE.Vector3, n = 8, color = 0x8a7a68, spread = 2) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) this.norm.emit(p.x + rnd(0.3), p.y + 0.1, p.z + rnd(0.3), rnd(spread), Math.random() * 1.4, rnd(spread), 0.5 + Math.random() * 0.4, 0.25, 0.7, color, 0.3, -1, 2);
  }
  debris(p: THREE.Vector3, n: number, color: number) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) this.norm.emit(p.x + rnd(0.5), p.y + 0.2, p.z + rnd(0.5), rnd(5), 2 + Math.random() * 5, rnd(5), 0.8 + Math.random() * 0.5, 0.2, 0.15, color, 1, 14, 0.4);
  }
  blood(p: THREE.Vector3, n = 6, color = 0xb01020) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) this.norm.emit(p.x, p.y, p.z, rnd(4), Math.random() * 4, rnd(4), 0.5 + Math.random() * 0.3, 0.18, 0.08, color, 0.9, 12, 0.5);
  }
  /** Style-specific particle burst at a point; dir is optional travel direction. */
  style(st: StyleDef, p: THREE.Vector3, n: number, spread = 1.5, dir?: THREE.Vector3) {
    n = Math.ceil(n * this.quality); const c = st.color; const co = st.core;
    for (let i = 0; i < n; i++) {
      const vx = rnd(spread) + (dir ? dir.x * 3 : 0); const vz = rnd(spread) + (dir ? dir.z * 3 : 0);
      switch (st.particle) {
        case 'water': this.norm.emit(p.x + rnd(0.4), p.y + rnd(0.4), p.z + rnd(0.4), vx, 1.5 + Math.random() * 3, vz, 0.8, 0.16, 0.08, i % 3 ? c : co, 0.9, 9, 0.3); if (i % 3 === 0) this.add.emit(p.x + rnd(0.5), p.y, p.z + rnd(0.5), vx * 0.5, 0.5, vz * 0.5, 0.5, 0.35, 0.8, c, 0.5); break;
        case 'fire': case 'sun': this.add.emit(p.x + rnd(0.4), p.y + rnd(0.3), p.z + rnd(0.4), vx * 0.4, 1 + Math.random() * 2.5, vz * 0.4, 0.55 + Math.random() * 0.4, st.particle === 'sun' ? 0.7 : 0.55, 0.05, i % 2 ? c : co, 0.9, -2, 0.5); break;
        case 'spark': this.add.emit(p.x + rnd(0.4), p.y + rnd(0.5), p.z + rnd(0.4), vx * 2, rnd(3), vz * 2, 0.3, 0.2, 0.02, i % 2 ? c : co, 1, 6, 1); break;
        case 'wind': this.add.emit(p.x + rnd(0.5), p.y + rnd(0.5), p.z + rnd(0.5), vx * 2.5, rnd(1), vz * 2.5, 0.45, 0.28, 0.05, i % 2 ? c : co, 0.6, 0, 1.5); break;
        case 'mist': this.norm.emit(p.x + rnd(0.6), p.y + rnd(0.4), p.z + rnd(0.6), vx * 0.5, rnd(0.4), vz * 0.5, 1.1, 0.8, 2.0, i % 2 ? c : 0xffffff, 0.35, 0, 0.5); break;
        case 'poison': this.add.emit(p.x + rnd(0.4), p.y + rnd(0.4), p.z + rnd(0.4), vx * 0.5, 1 + Math.random() * 2, vz * 0.5, 0.9, 0.3, 0.1, i % 2 ? c : 0x70ff90, 0.8, 1, 0.3); break;
        case 'note': this.add.emit(p.x + rnd(0.4), p.y + rnd(0.4), p.z + rnd(0.4), vx * 2, 1 + Math.random() * 2, vz * 2, 0.6, 0.3, 0.06, i % 2 ? c : co, 1, 3, 0.5); break;
        case 'petal': this.norm.emit(p.x + rnd(0.5), p.y + rnd(0.4), p.z + rnd(0.5), vx * 1.5, 0.5 + Math.random() * 1.5, vz * 1.5, 1.2, 0.28, 0.2, i % 2 ? c : 0xffd0e4, 0.9, 1.5, 0.8); break;
        case 'rock': this.norm.emit(p.x + rnd(0.5), p.y + rnd(0.3), p.z + rnd(0.5), vx * 1.5, 2 + Math.random() * 4, vz * 1.5, 0.9, 0.3, 0.2, i % 2 ? 0x8a7050 : 0xc9a56b, 1, 14, 0.4); break;
        case 'snake': this.add.emit(p.x + rnd(0.4), p.y + rnd(0.4), p.z + rnd(0.4), vx, rnd(1.5), vz, 0.7, 0.3, 0.06, i % 2 ? c : 0xe0ffa0, 0.9, 0, 1); break;
      }
    }
  }

  // ---------- meshes ----------
  slash(origin: THREE.Vector3, yaw: number, o: { radius: number; arc: number; width?: number; color: number; core?: number; tilt?: number; y?: number; dir?: 1 | -1; life?: number; wave?: number; fwd?: number }) {
    const N = 34; const arc = o.arc; const R = o.radius; const wd = o.width ?? R * 0.38; const dir = o.dir ?? 1;
    const build = (rad: number, w: number, col: number, alphaMul: number) => {
      const pos = new Float32Array((N + 1) * 2 * 3); const colr = new Float32Array((N + 1) * 2 * 4); const idx: number[] = [];
      tmpCol.setHex(col);
      for (let i = 0; i <= N; i++) {
        const u = i / N; const th = dir * (u - 0.5) * arc; const tp = Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.96 + 0.04)), 0.5); const ri = rad - w * tp;
        pos.set([Math.sin(th) * rad, 0, Math.cos(th) * rad, Math.sin(th) * ri, 0, Math.cos(th) * ri], i * 6);
        const a = Math.pow(u, 1.4) * alphaMul; colr.set([tmpCol.r, tmpCol.g, tmpCol.b, a * 0.9, tmpCol.r, tmpCol.g, tmpCol.b, 0], i * 8);
        if (i < N) { const a0 = i * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 4)); g.setIndex(idx);
      const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      return new THREE.Mesh(g, m);
    };
    const yawG = new THREE.Group(); yawG.position.set(origin.x, origin.y + (o.y ?? 1.05), origin.z); yawG.rotation.y = yaw;
    const tiltG = new THREE.Group(); tiltG.rotation.z = o.tilt ?? 0; yawG.add(tiltG);
    const outer = build(R, wd, o.color, 1.0); const core = build(R * 0.98, wd * 0.4, o.core ?? 0xffffff, 1.0); tiltG.add(outer, core);
    if (o.fwd) tiltG.position.z = o.fwd;
    const base = (outer.geometry.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array; const wave = o.wave ?? 0; const life = o.life ?? 0.32;
    this.push({
      obj: yawG, age: 0, life,
      upd: (it, _dt, t) => {
        const sweep = 0.4; const p = Math.min(1, it.age / (life * sweep)); const cnt = Math.floor(N * p) * 6 + 6;
        outer.geometry.setDrawRange(0, cnt); core.geometry.setDrawRange(0, cnt);
        const fade = it.age < life * sweep ? 1 : Math.max(0, 1 - (it.age - life * sweep) / (life * (1 - sweep)));
        (outer.material as THREE.MeshBasicMaterial).opacity = fade; (core.material as THREE.MeshBasicMaterial).opacity = fade;
        if (wave > 0) {
          for (const mesh of [outer, core]) {
            const pa = mesh.geometry.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < pa.count; i++) { const bx = base[i * 3]; const bz = base[i * 3 + 2]; pa.setY(i, Math.sin(Math.atan2(bx, bz) * 7 * dir + t * 22) * wave * R * 0.3); }
            pa.needsUpdate = true;
          }
        }
        tiltG.scale.setScalar(1 + it.age * 0.35);
      },
      dispose: () => { outer.geometry.dispose(); core.geometry.dispose(); (outer.material as THREE.Material).dispose(); (core.material as THREE.Material).dispose(); },
    });
  }

  trail(from: THREE.Vector3, to: THREE.Vector3, o: { color: number; core?: number; width?: number; life?: number; jag?: number; y?: number }) {
    const N = 14; const w = o.width ?? 0.7; const y = o.y ?? 1.0; const jag = o.jag ?? 0; const life = o.life ?? 0.45;
    const dir = new THREE.Vector3().subVectors(to, from); const len = dir.length(); dir.normalize(); const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const mk = (col: number, ww: number, vertical: boolean) => {
      const pos = new Float32Array((N + 1) * 2 * 3); const colr = new Float32Array((N + 1) * 2 * 4); const idx: number[] = []; tmpCol.setHex(col);
      for (let i = 0; i <= N; i++) {
        const u = i / N; const cx = from.x + dir.x * len * u; const cz = from.z + dir.z * len * u; const tp = Math.sin(Math.PI * u) ** 0.4 * ww;
        if (vertical) pos.set([cx, y - tp * 0.5, cz, cx, y + tp * 0.5, cz], i * 6); else pos.set([cx + side.x * tp, y - 0.3, cz + side.z * tp, cx - side.x * tp, y - 0.3, cz - side.z * tp], i * 6);
        colr.set([tmpCol.r, tmpCol.g, tmpCol.b, 0.2 + 0.8 * u, tmpCol.r, tmpCol.g, tmpCol.b, 0.2 + 0.8 * u], i * 8);
        if (i < N) { const a0 = i * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 4)); g.setIndex(idx);
      return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    };
    const grp = new THREE.Group(); const meshes = [mk(o.color, w, true), mk(o.color, w, false), mk(o.core ?? 0xffffff, w * 0.4, true)]; meshes.forEach((m) => grp.add(m));
    this.push({
      obj: grp, age: 0, life,
      upd: (it) => {
        const f = 1 - it.age / life; meshes.forEach((m) => { (m.material as THREE.MeshBasicMaterial).opacity = f; });
        if (jag > 0) { const pa = meshes[0].geometry.attributes.position as THREE.BufferAttribute; for (let i = 1; i < N; i++) { pa.setY(i * 2, y - 0.3 + rnd(jag)); pa.setY(i * 2 + 1, y + 0.3 + rnd(jag)); } pa.needsUpdate = true; }
      },
      dispose: () => meshes.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }),
    });
  }

  ring(p: THREE.Vector3, r1: number, color: number, life = 0.5, y = 0.15, thick = 0.18, r0 = 0.3) {
    const g = new THREE.RingGeometry(1 - thick, 1, 40); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(p.x, p.y + y, p.z);
    this.push({ obj: m, age: 0, life, upd: (it) => { const t = it.age / life; const e = 1 - (1 - t) ** 3; m.scale.setScalar(r0 + (r1 - r0) * e); (m.material as THREE.MeshBasicMaterial).opacity = 1 - t; }, dispose: () => { g.dispose(); (m.material as THREE.Material).dispose(); } });
  }

  column(p: THREE.Vector3, color: number, r = 0.8, h = 12, life = 0.5) {
    const g = new THREE.CylinderGeometry(r, r, h, 14, 1, true);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 }));
    m.position.set(p.x, p.y + h / 2, p.z);
    this.push({ obj: m, age: 0, life, upd: (it) => { const t = it.age / life; m.scale.set(1 + t, 1, 1 + t); (m.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.8; }, dispose: () => { g.dispose(); (m.material as THREE.Material).dispose(); } });
  }

  bolt(from: THREE.Vector3, to: THREE.Vector3, color = 0xffe14a, life = 0.18, jag = 0.5) {
    const N = 12; const grp = new THREE.Group(); const lines: THREE.Line[] = [];
    for (let k = 0; k < 3; k++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: k === 0 ? 0xffffff : color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); lines.push(l); grp.add(l);
    }
    const refresh = () => {
      lines.forEach((l, k) => {
        const pa = l.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i <= N; i++) { const u = i / N; const j = i === 0 || i === N ? 0 : jag * (k === 0 ? 0.5 : 1); pa.setXYZ(i, from.x + (to.x - from.x) * u + rnd(j), from.y + (to.y - from.y) * u + rnd(j), from.z + (to.z - from.z) * u + rnd(j)); }
        pa.needsUpdate = true;
      });
    };
    refresh();
    this.push({ obj: grp, age: 0, life, upd: (it) => { refresh(); lines.forEach((l) => { (l.material as THREE.LineBasicMaterial).opacity = 1 - it.age / life; }); }, dispose: () => lines.forEach((l) => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); }) });
    this.flash(to, color, 1.3, 0.15);
  }

  helix(p: THREE.Vector3, r: number, h: number, color: number, core: number, o: { turns?: number; life?: number; spin?: number; strands?: number; grow?: number } = {}) {
    const turns = o.turns ?? 2.5; const life = o.life ?? 0.9; const strands = o.strands ?? 2; const N = 48; const grp = new THREE.Group(); const meshes: THREE.Mesh[] = [];
    for (let s = 0; s < strands; s++) {
      const pos = new Float32Array((N + 1) * 2 * 3); const colr = new Float32Array((N + 1) * 2 * 4); const idx: number[] = []; tmpCol.setHex(s % 2 ? core : color);
      for (let i = 0; i <= N; i++) {
        const u = i / N; const a = u * turns * Math.PI * 2 + (s / strands) * Math.PI * 2; const rr = r * (0.5 + 0.5 * Math.sin(Math.PI * u * 0.9 + 0.3)); const yy = u * h;
        pos.set([Math.cos(a) * rr, yy, Math.sin(a) * rr, Math.cos(a) * rr, yy + 0.35, Math.sin(a) * rr], i * 6);
        const al = Math.sin(Math.PI * u) * 0.9; colr.set([tmpCol.r, tmpCol.g, tmpCol.b, al, tmpCol.r, tmpCol.g, tmpCol.b, al], i * 8);
        if (i < N) { const a0 = i * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 4)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); grp.add(m); meshes.push(m);
    }
    grp.position.copy(p);
    this.push({ obj: grp, age: 0, life, upd: (it, dt) => { const t = it.age / life; grp.rotation.y += dt * (o.spin ?? 9); grp.scale.set(1 + t * (o.grow ?? 0.4), 1 + t * 0.2, 1 + t * (o.grow ?? 0.4)); const f = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85; meshes.forEach((m) => { (m.material as THREE.MeshBasicMaterial).opacity = f; }); }, dispose: () => meshes.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }) });
  }

  /** Persistent ground telegraph; call .set(progress) each frame, .remove() when done. */
  telegraph(shape: 'circle' | 'cone' | 'line', color: number, range: number, arc: number, w: number) {
    const grp = new THREE.Group();
    let fillGeo: THREE.BufferGeometry; let edgeGeo: THREE.BufferGeometry;
    if (shape === 'line') { fillGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5); edgeGeo = fillGeo; }
    else if (shape === 'cone') { const a = (arc * Math.PI) / 180; fillGeo = new THREE.CircleGeometry(1, 28, -Math.PI / 2 - a / 2, a).rotateX(-Math.PI / 2); edgeGeo = fillGeo; }
    else { fillGeo = new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2); edgeGeo = new THREE.RingGeometry(0.93, 1, 40).rotateX(-Math.PI / 2); }
    const base = new THREE.Mesh(shape === 'circle' ? fillGeo : edgeGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    const edge = shape === 'circle' ? new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })) : null;
    grp.add(base, fill); if (edge) grp.add(edge);
    const scaleBase = () => { if (shape === 'line') base.scale.set(w, 1, range); else base.scale.set(range, 1, range); };
    scaleBase(); grp.renderOrder = 5; this.group.add(grp);
    if (edge) edge.scale.set(range, 1, range);
    return {
      grp,
      set: (p: number, x: number, z: number, yaw: number, y: number) => {
        grp.position.set(x, y + 0.08, z); grp.rotation.y = yaw; const pp = Math.max(0.02, Math.min(1, p));
        if (shape === 'line') fill.scale.set(w * 0.98, 1, range * pp); else fill.scale.set(range * pp, 1, range * pp);
      },
      remove: () => { this.group.remove(grp); [base, fill, edge].forEach((m) => { if (m) (m.material as THREE.Material).dispose(); }); if (shape !== 'line') fillGeo.dispose(); if (edgeGeo !== fillGeo) edgeGeo.dispose(); },
    };
  }

  projMesh(kind: 'slash' | 'blast', color: number, core: number, size: number) {
    const g = new THREE.Group();
    if (kind === 'slash') {
      const ge = new THREE.RingGeometry(size * 0.7, size, 18, 1, -Math.PI * 0.32, Math.PI * 0.64); ge.rotateX(-Math.PI / 2); ge.rotateY(Math.PI);
      const m = new THREE.Mesh(ge, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9 })); m.position.z = size * 0.9; g.add(m);
      const g2 = new THREE.RingGeometry(size * 0.85, size, 18, 1, -Math.PI * 0.3, Math.PI * 0.6); g2.rotateX(-Math.PI / 2); g2.rotateY(Math.PI);
      const m2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: core, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m2.position.z = size * 0.9; g.add(m2);
      g.position.y = 1;
    } else {
      const m = new THREE.Mesh(new THREE.SphereGeometry(size * 0.5, 10, 8), new THREE.MeshBasicMaterial({ color: core })); g.add(m);
      const m2 = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(m2);
    }
    return g;
  }

  dispose() {
    this.items.forEach((i) => i.dispose()); this.items = []; this.add.geo.dispose(); this.add.mat.dispose(); this.norm.geo.dispose(); this.norm.mat.dispose();
    this.nums.forEach((n) => { n.tex.dispose(); (n.s.material as THREE.Material).dispose(); });
  }
}
