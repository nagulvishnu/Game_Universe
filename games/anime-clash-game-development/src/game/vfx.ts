import * as THREE from "three";
import type { Element } from "./data";

export type El = Element | "none";

export const EL_COLORS: Record<El, { core: number; main: number; dark: number }> = {
  fire: { core: 0xffe2a0, main: 0xff5a1f, dark: 0x8a1c08 },
  lightning: { core: 0xffffff, main: 0x4fb8ff, dark: 0x2a5cff },
  dark: { core: 0xff7aea, main: 0xa23cff, dark: 0x2a0a50 },
  ice: { core: 0xffffff, main: 0x76e2ff, dark: 0x3a8ae0 },
  none: { core: 0xffffff, main: 0xffe9b0, dark: 0xcc9a50 },
};

const _c0 = new THREE.Color();
const _c1 = new THREE.Color();
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- particle pool
class Pool {
  pos: Float32Array; vel: Float32Array; col: Float32Array; size: Float32Array;
  life: Float32Array; maxLife: Float32Array; s0: Float32Array; s1: Float32Array;
  c0: Float32Array; c1: Float32Array; drag: Float32Array; grav: Float32Array;
  head = 0;
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  geo = new THREE.BufferGeometry();
  constructor(public cap: number, additive: boolean, scene: THREE.Scene) {
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    this.life = new Float32Array(cap); this.maxLife = new Float32Array(cap);
    this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap);
    this.c0 = new Float32Array(cap * 3); this.c1 = new Float32Array(cap * 3);
    this.drag = new Float32Array(cap); this.grav = new Float32Array(cap);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 }, uSoft: { value: additive ? 0 : 1 } },
      vertexShader: `attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vC;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 0.0, 400.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; uniform float uSoft;
        void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0; if (d > 1.0) discard;
          float a = 1.0 - d; a = a * a * (uSoft > 0.5 ? 1.2 : 1.6);
          gl_FragColor = vec4(vC.rgb, vC.a * min(1.0, a)); }`,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 10 : 9;
    scene.add(this.points);
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, c0: number, c1: number, drag: number, grav: number) {
    const i = this.head;
    this.head = (this.head + 1) % this.cap;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    _c0.set(c0); _c1.set(c1);
    this.c0[k] = _c0.r; this.c0[k + 1] = _c0.g; this.c0[k + 2] = _c0.b;
    this.c1[k] = _c1.r; this.c1[k + 1] = _c1.g; this.c1[k + 2] = _c1.b;
    this.drag[i] = drag; this.grav[i] = grav;
  }
  update(dt: number, smoke: boolean) {
    const { pos, vel, col, size, life, maxLife, s0, s1, c0, c1, drag, grav } = this;
    for (let i = 0; i < this.cap; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const k = i * 3, q = i * 4;
      if (life[i] <= 0) { size[i] = 0; col[q + 3] = 0; continue; }
      const t = 1 - life[i] / maxLife[i];
      const dr = Math.max(0, 1 - drag[i] * dt);
      vel[k] *= dr; vel[k + 1] = vel[k + 1] * dr - grav[i] * dt; vel[k + 2] *= dr;
      pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
      size[i] = s0[i] + (s1[i] - s0[i]) * t;
      col[q] = c0[k] + (c1[k] - c0[k]) * t; col[q + 1] = c0[k + 1] + (c1[k + 1] - c0[k + 1]) * t; col[q + 2] = c0[k + 2] + (c1[k + 2] - c0[k + 2]) * t;
      const fi = Math.min(1, t * (smoke ? 5 : 12));
      col[q + 3] = fi * (1 - t) * (smoke ? 0.55 : 1);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }
  clear() { this.life.fill(0); this.size.fill(0); this.col.fill(0); }
}

// ---------------------------------------------------------------- fx meshes
export interface FxItem {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; life: number; s0: THREE.Vector3; s1: THREE.Vector3;
  op: number; fadeIn: number; spin: THREE.Vector3; vel: THREE.Vector3; billboard: boolean; active: boolean; hold: boolean; ease: number;
}

type FxKind = "sphere" | "dome" | "cyl" | "cone" | "crystal" | "disc" | "ring" | "slash";

export interface Ribbon {
  mesh: THREE.Mesh;
  add: (p: THREE.Vector3) => void;
  update: (dt: number, cam: THREE.Vector3) => void;
  clear: () => void;
  setColor: (c: number) => void;
  dispose: () => void;
}

interface Debris { x: number; y: number; z: number; vx: number; vy: number; vz: number; rx: number; ry: number; rz: number; sx: number; sy: number; sz: number; s: number; life: number; }

export class VFX {
  add: Pool;
  smoke: Pool;
  geos: Record<FxKind, THREE.BufferGeometry>;
  items: FxItem[] = [];
  lights: THREE.PointLight[] = [];
  lightInfo: { t: number; life: number; i0: number }[] = [];
  debrisMesh: THREE.InstancedMesh;
  debris: Debris[] = [];
  debrisHead = 0;
  decals: { mesh: THREE.Mesh; t: number; life: number }[] = [];
  decalHead = 0;
  ribbons: Ribbon[] = [];
  qty = 1;
  private _dummy = new THREE.Object3D();
  private _v = new THREE.Vector3();
  private camPos = new THREE.Vector3();

  constructor(public scene: THREE.Scene, cap = 6000, public maxItems = 56) {
    this.add = new Pool(cap, true, scene);
    this.smoke = new Pool(Math.floor(cap / 4), false, scene);
    const cy = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true); cy.translate(0, 0.5, 0);
    const co = new THREE.ConeGeometry(1, 1, 10); co.translate(0, 0.5, 0);
    const ds = new THREE.CircleGeometry(1, 36); ds.rotateX(-Math.PI / 2);
    const rg = new THREE.RingGeometry(0.84, 1, 56); rg.rotateX(-Math.PI / 2);
    const sl = new THREE.RingGeometry(0.7, 1, 36, 1, 0, Math.PI * 0.8); sl.rotateX(-Math.PI / 2);
    this.geos = {
      sphere: new THREE.SphereGeometry(1, 24, 16),
      dome: new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      cyl: cy, cone: co, crystal: new THREE.OctahedronGeometry(1, 0), disc: ds, ring: rg, slash: sl,
    };
    for (let i = 0; i < maxItems; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const mesh = new THREE.Mesh(this.geos.sphere, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 8;
      scene.add(mesh);
      this.items.push({ mesh, mat, t: 0, life: 1, s0: new THREE.Vector3(), s1: new THREE.Vector3(), op: 1, fadeIn: 0, spin: new THREE.Vector3(), vel: new THREE.Vector3(), billboard: false, active: false, hold: false, ease: 2 });
    }
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 1.6);
      scene.add(l);
      this.lights.push(l);
      this.lightInfo.push({ t: 0, life: 0, i0: 0 });
    }
    this.debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.1 }), 160);
    this.debrisMesh.castShadow = true;
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.count = 0;
    scene.add(this.debrisMesh);
    // decals
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, "rgba(0,0,0,0.85)"); gr.addColorStop(0.6, "rgba(0,0,0,0.5)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 14; i++) { g.strokeStyle = "rgba(0,0,0,0.6)"; g.lineWidth = 2; g.beginPath(); const a = Math.random() * 6.28; g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); g.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0 }));
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      this.decals.push({ mesh: m, t: 0, life: 0 });
    }
  }

  setScale(h: number, fov: number) {
    const s = h / (2 * Math.tan((fov * Math.PI) / 360));
    this.add.mat.uniforms.uScale.value = s;
    this.smoke.mat.uniforms.uScale.value = s;
  }

  // ---- generic particle burst
  burst(o: {
    p: THREE.Vector3; n: number; speed: [number, number]; size: [number, number]; life: [number, number];
    color: number; color2?: number; dir?: THREE.Vector3; spread?: number; drag?: number; grav?: number; jitter?: number; smoke?: boolean; boost?: number;
  }) {
    const n = Math.max(1, Math.round(o.n * this.qty));
    const pool = o.smoke ? this.smoke : this.add;
    const sp = o.spread ?? 1;
    const jit = o.jitter ?? 0;
    const c1 = o.color2 ?? o.color;
    for (let i = 0; i < n; i++) {
      let dx = rnd(-1, 1), dy = rnd(-1, 1), dz = rnd(-1, 1);
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      if (o.dir) { dx = o.dir.x + dx * sp; dy = o.dir.y + dy * sp; dz = o.dir.z + dz * sp; const m = Math.hypot(dx, dy, dz) || 1; dx /= m; dy /= m; dz /= m; }
      const s = rnd(o.speed[0], o.speed[1]);
      const sz = rnd(o.size[0], o.size[1]);
      pool.spawn(o.p.x + rnd(-jit, jit), o.p.y + rnd(-jit, jit), o.p.z + rnd(-jit, jit), dx * s, dy * s, dz * s, rnd(o.life[0], o.life[1]), sz, sz * (o.smoke ? 2.2 : 0.2), o.color, c1, o.drag ?? 1.5, o.grav ?? 0);
    }
  }

  // ---- fx meshes
  fx(kind: FxKind, pos: THREE.Vector3, color: number, s0: number | [number, number, number], s1: number | [number, number, number], life: number, o: { fadeIn?: number; op?: number; spin?: [number, number, number]; vel?: THREE.Vector3; billboard?: boolean; hold?: boolean; ease?: number; rot?: [number, number, number]; hdr?: number } = {}): FxItem | null {
    let it = this.items.find((x) => !x.active);
    if (!it) {
      // steal the oldest
      it = this.items.reduce((a, b) => (a.t / a.life > b.t / b.life ? a : b));
    }
    it.active = true; it.t = 0; it.life = life; it.hold = !!o.hold;
    it.mesh.geometry = this.geos[kind];
    it.mesh.visible = true;
    it.mesh.position.copy(pos);
    it.mesh.rotation.set(...(o.rot ?? [0, 0, 0]));
    if (typeof s0 === "number") it.s0.set(s0, s0, s0); else it.s0.set(...s0);
    if (typeof s1 === "number") it.s1.set(s1, s1, s1); else it.s1.set(...s1);
    it.mesh.scale.copy(it.s0);
    it.mat.color.set(color).multiplyScalar(o.hdr ?? 1.3);
    it.op = o.op ?? 0.9; it.fadeIn = o.fadeIn ?? 0.08;
    if (o.spin) it.spin.set(...o.spin); else it.spin.set(0, 0, 0);
    if (o.vel) it.vel.copy(o.vel); else it.vel.set(0, 0, 0);
    it.billboard = !!o.billboard;
    it.ease = o.ease ?? 2;
    it.mat.opacity = 0;
    return it;
  }
  ring(pos: THREE.Vector3, color: number, r0: number, r1: number, life: number, o: { billboard?: boolean; op?: number; y?: number } = {}) {
    const p = this._v.copy(pos); if (o.y !== undefined) p.y = o.y;
    return this.fx("ring", p, color, r0, r1, life, { billboard: o.billboard, op: o.op ?? 0.9, fadeIn: 0.02, hdr: 1.5 });
  }

  // ---- lights
  flash(pos: THREE.Vector3, color: number, intensity: number, dist: number, life: number) {
    let k = 0, best = Infinity;
    for (let i = 0; i < this.lights.length; i++) {
      const li = this.lightInfo[i];
      const rem = li.life <= 0 ? -1 : (li.life - li.t) * li.i0;
      if (rem < best) { best = rem; k = i; }
    }
    const l = this.lights[k];
    l.position.copy(pos);
    l.color.set(color);
    l.distance = dist;
    l.intensity = intensity;
    this.lightInfo[k] = { t: 0, life: life, i0: intensity };
  }

  // ---- debris & decals
  chunks(p: THREE.Vector3, n: number, color: number, speed: number, size: number) {
    const c = new THREE.Color(color);
    for (let i = 0; i < Math.round(n * Math.min(1, this.qty)); i++) {
      const idx = this.debrisHead;
      this.debrisHead = (this.debrisHead + 1) % 160;
      const a = Math.random() * 6.28, up = rnd(0.5, 1.4);
      const sp = rnd(0.4, 1) * speed;
      const s = rnd(0.4, 1) * size;
      this.debris[idx] = { x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * sp, vy: up * speed * 0.8, vz: Math.sin(a) * sp, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, sx: rnd(-8, 8), sy: rnd(-8, 8), sz: rnd(-8, 8), s, life: rnd(2, 3.5) };
      this.debrisMesh.setColorAt(idx, c.clone().multiplyScalar(rnd(0.6, 1.2)));
    }
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
  }
  scorch(p: THREE.Vector3, r: number) {
    const d = this.decals[this.decalHead];
    this.decalHead = (this.decalHead + 1) % this.decals.length;
    d.mesh.visible = true;
    d.mesh.position.set(p.x, 0.02, p.z);
    d.mesh.scale.set(r * 2, 1, r * 2);
    d.mesh.rotation.y = Math.random() * 6.28;
    d.t = 0; d.life = 14;
  }

  // ---- ribbons
  makeRibbon(color: number, maxPts = 14, width = 0.12, life = 0.28): Ribbon {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(maxPts * 2 * 3);
    const col = new Float32Array(maxPts * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i < maxPts - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 7;
    this.scene.add(mesh);
    const pts: { p: THREE.Vector3; age: number }[] = [];
    const base = new THREE.Color(color);
    const dir = new THREE.Vector3(), side = new THREE.Vector3(), tc = new THREE.Vector3();
    const rb: Ribbon = {
      mesh,
      add: (p) => { pts.unshift({ p: p.clone(), age: 0 }); if (pts.length > maxPts) pts.pop(); },
      update: (dt, cam) => {
        for (const q of pts) q.age += dt;
        while (pts.length && pts[pts.length - 1].age > life) pts.pop();
        const n = pts.length;
        mesh.visible = n > 1;
        if (n < 2) return;
        for (let i = 0; i < maxPts; i++) {
          const q = pts[Math.min(i, n - 1)];
          const qn = pts[Math.min(i + 1, n - 1)], qp = pts[Math.min(Math.max(i - 1, 0), n - 1)];
          if (!q || !qn || !qp) { console.warn("ribbon", i, n, pts.length); continue; }
          const a = i < n ? 1 - q.age / life : 0;
          const nx = qn.p, pv = qp.p;
          dir.subVectors(pv, nx);
          tc.subVectors(cam, q.p);
          side.crossVectors(dir, tc).normalize().multiplyScalar(width * Math.max(0, a));
          const k = i * 6;
          pos[k] = q.p.x + side.x; pos[k + 1] = q.p.y + side.y; pos[k + 2] = q.p.z + side.z;
          pos[k + 3] = q.p.x - side.x; pos[k + 4] = q.p.y - side.y; pos[k + 5] = q.p.z - side.z;
          const c = i * 8;
          const al = Math.max(0, a) * Math.max(0, a) * 0.9;
          col[c] = col[c + 4] = base.r * 1.4; col[c + 1] = col[c + 5] = base.g * 1.4; col[c + 2] = col[c + 6] = base.b * 1.4;
          col[c + 3] = col[c + 7] = al;
        }
        (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      },
      clear: () => { pts.length = 0; mesh.visible = false; },
      setColor: (c) => base.set(c),
      dispose: () => { this.scene.remove(mesh); geo.dispose(); mat.dispose(); },
    };
    this.ribbons.push(rb);
    return rb;
  }

  // ---------------------------------------------------------------- composite effects
  hit(p: THREE.Vector3, el: El, power = 1, dir?: THREE.Vector3) {
    const c = EL_COLORS[el];
    this.burst({ p, n: 14 * power, speed: [4, 11 * power], size: [0.14, 0.3], life: [0.12, 0.3], color: 0xffffff, color2: c.main, drag: 3 });
    this.burst({ p, n: 10 * power, speed: [2, 7], size: [0.1, 0.22], life: [0.2, 0.5], color: c.main, color2: c.dark, dir, spread: 1.2, grav: 6, drag: 1.5 });
    this.fx("sphere", p, c.core, 0.1, 0.5 * power + 0.15, 0.14, { op: 1, ease: 3 });
    this.ring(p, c.main, 0.2, 1.2 * power + 0.5, 0.25, { billboard: true });
    this.flash(p, c.main, 5 * power, 7, 0.18);
    switch (el) {
      case "fire": this.burst({ p, n: 6 * power, speed: [1, 3], size: [0.5, 0.9], life: [0.4, 0.8], color: 0x331510, color2: 0x1a1010, smoke: true, grav: -1.5, drag: 1 }); break;
      case "lightning": for (let i = 0; i < 3; i++) this.bolt(p, this._v.set(p.x + rnd(-1.4, 1.4), p.y + rnd(-1, 1.4), p.z + rnd(-1.4, 1.4)).clone(), c.main, 0.18); break;
      case "ice": for (let i = 0; i < 4; i++) this.shard(p, c.main, rnd(2, 6)); break;
      case "dark": this.fx("sphere", p, c.main, 0.3, 0.9 * power, 0.25, { op: 0.5 }); break;
    }
  }

  shard(p: THREE.Vector3, color: number, speed: number) {
    const v = new THREE.Vector3(rnd(-1, 1), rnd(0.3, 1.2), rnd(-1, 1)).normalize().multiplyScalar(speed);
    this.fx("crystal", p, color, [0.07, 0.28, 0.07], [0.02, 0.1, 0.02], rnd(0.4, 0.8), { vel: v, spin: [rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)], op: 0.95, rot: [rnd(0, 6), rnd(0, 6), 0] });
  }

  bolt(a: THREE.Vector3, b: THREE.Vector3, color: number, jag = 0.5, life = 0.16, size = 0.2) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const segs = Math.max(4, Math.round(len * 1.6));
    const perp1 = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).cross(dir).normalize();
    const perp2 = dir.clone().cross(perp1).normalize();
    const pt = new THREE.Vector3();
    let ox = 0, oz = 0;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const env = Math.sin(t * Math.PI) * jag;
      ox += rnd(-1, 1) * env * 0.7; oz += rnd(-1, 1) * env * 0.7;
      ox *= 0.8; oz *= 0.8;
      pt.copy(a).lerp(b, t).addScaledVector(perp1, ox).addScaledVector(perp2, oz);
      for (let k = 0; k < 2; k++) {
        const l = rnd(life * 0.6, life * 1.3);
        this.add.spawn(pt.x, pt.y, pt.z, 0, 0, 0, l, size * 1.1, size * 0.4, 0xffffff, color, 0, 0);
      }
      this.add.spawn(pt.x, pt.y, pt.z, 0, 0, 0, life * 1.4, size * 3.2, size * 0.5, color, color, 0, 0);
    }
  }

  explosion(p: THREE.Vector3, el: El, size = 1, o: { debris?: boolean; scorch?: boolean; light?: boolean } = {}) {
    const c = EL_COLORS[el];
    const g = this._v.set(p.x, 0.05, p.z).clone();
    this.fx("sphere", p, c.core, 0.3 * size, 3.2 * size, 0.32, { op: 1, ease: 3, hdr: 1.8 });
    this.fx("sphere", p, c.main, 0.5 * size, 5.2 * size, 0.55, { op: 0.55, ease: 2.5, hdr: 1.2 });
    this.fx("dome", g, c.main, 0.5 * size, 6.5 * size, 0.6, { op: 0.45, ease: 3 });
    this.ring(g, c.core, 0.5, 9 * size, 0.55, { op: 0.9 });
    this.ring(g, c.main, 0.3, 13 * size, 0.85, { op: 0.6 });
    if (el === "dark") this.fx("sphere", p, 0x050010, 0.2 * size, 2.6 * size, 0.7, { op: 0.9 });
    this.burst({ p, n: 110 * size, speed: [4, 22 * size], size: [0.18, 0.5], life: [0.4, 1.1], color: c.core, color2: c.main, drag: 2.4, grav: 2 });
    this.burst({ p, n: 70 * size, speed: [2, 14 * size], size: [0.15, 0.4], life: [0.6, 1.5], color: c.main, color2: c.dark, drag: 1.5, grav: 7 });
    this.burst({ p, n: 22 * size, speed: [1, 6 * size], size: [0.9, 1.6], life: [1.2, 2.4], color: el === "ice" ? 0x6a8aa8 : 0x2a2230, color2: 0x15121a, smoke: true, drag: 1.2, grav: -0.6, jitter: 0.8 });
    // ground dust ring
    for (let i = 0; i < 20 * size; i++) {
      const a = (i / (20 * size)) * 6.283;
      this.smoke.spawn(p.x, 0.2, p.z, Math.cos(a) * 9 * size, 0.6, Math.sin(a) * 9 * size, rnd(0.8, 1.6), 0.9, 2.6, 0x8a8494, 0x4a4650, 2.2, 0);
    }
    if (el === "lightning") for (let i = 0; i < 6; i++) this.bolt(p, new THREE.Vector3(p.x + rnd(-4, 4) * size, rnd(0, 1.5), p.z + rnd(-4, 4) * size), c.main, 0.7, 0.2);
    if (el === "ice") for (let i = 0; i < 18 * size; i++) this.shard(p, c.main, rnd(5, 15) * size);
    if (el === "dark") this.burst({ p, n: 60, speed: [8, 18], size: [0.2, 0.4], life: [0.4, 0.9], color: 0xff55e0, color2: 0x300050, drag: 4 });
    if (o.light !== false) this.flash(p, c.main, 22 * size, 26, 0.7);
    if (o.debris !== false) this.chunks(g, 22 * size, el === "ice" ? 0xaadcf0 : 0x6a6070, 12 * size, 0.22);
    if (o.scorch !== false) this.scorch(g, 2.6 * size);
  }

  shockwave(p: THREE.Vector3, el: El, radius: number, life = 0.6) {
    const c = EL_COLORS[el];
    const g = this._v.set(p.x, 0.06, p.z).clone();
    this.ring(g, c.core, 0.5, radius, life, { op: 1 });
    this.ring(g, c.main, 0.3, radius * 0.8, life * 1.2, { op: 0.7 });
    this.fx("dome", g, c.main, 0.4, radius * 0.5, life, { op: 0.28, ease: 3 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * 6.283;
      this.smoke.spawn(g.x, 0.15, g.z, Math.cos(a) * radius / life * 0.8, 0.5, Math.sin(a) * radius / life * 0.8, life, 0.7, 2.0, 0x8a8494, 0x4a4650, 1.8, 0);
    }
  }

  dust(p: THREE.Vector3, n = 8, spd = 3) {
    for (let i = 0; i < n * this.qty; i++) {
      const a = Math.random() * 6.283;
      this.smoke.spawn(p.x, 0.1, p.z, Math.cos(a) * spd * rnd(0.4, 1), rnd(0.2, 1), Math.sin(a) * spd * rnd(0.4, 1), rnd(0.4, 0.9), 0.4, 1.2, 0x9a94a4, 0x5a5662, 2.5, 0);
    }
  }

  // continuous projectile trail (call every frame)
  trail(p: THREE.Vector3, el: El, s = 1) {
    const c = EL_COLORS[el];
    const q = this.qty;
    if (Math.random() < q) this.add.spawn(p.x + rnd(-0.1, 0.1), p.y + rnd(-0.1, 0.1), p.z + rnd(-0.1, 0.1), rnd(-0.5, 0.5), rnd(-0.3, 1.4), rnd(-0.5, 0.5), rnd(0.2, 0.45), 0.5 * s, 0.05, c.core, c.main, 2, el === "fire" ? -3 : 0);
    if (Math.random() < 0.8 * q) this.add.spawn(p.x + rnd(-0.2, 0.2), p.y + rnd(-0.2, 0.2), p.z + rnd(-0.2, 0.2), rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), rnd(0.3, 0.6), 0.35 * s, 0.02, c.main, c.dark, 2, el === "fire" ? -4 : 0);
    if (el === "fire" && Math.random() < 0.5 * q) this.smoke.spawn(p.x, p.y, p.z, rnd(-0.5, 0.5), rnd(0.2, 1), rnd(-0.5, 0.5), rnd(0.5, 0.9), 0.4 * s, 1.1 * s, 0x2a1810, 0x100c0a, 1.2, -1);
    if (el === "lightning" && Math.random() < 0.35 * q) this.bolt(p, this._v.set(p.x + rnd(-0.9, 0.9), p.y + rnd(-0.9, 0.9), p.z + rnd(-0.9, 0.9)).clone(), c.main, 0.2, 0.09, 0.14);
    if (el === "ice" && Math.random() < 0.3 * q) this.add.spawn(p.x, p.y, p.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 0.7, 0.18, 0.04, 0xffffff, c.main, 1, 2);
    if (el === "dark" && Math.random() < 0.7 * q) { const a = Math.random() * 6.28; this.add.spawn(p.x + Math.cos(a) * 1.0, p.y + rnd(-0.6, 0.6), p.z + Math.sin(a) * 1.0, -Math.cos(a) * 3, 0, -Math.sin(a) * 3, 0.33, 0.25, 0.05, 0xff55e0, 0x300050, 0, 0); }
  }

  // aura around a body whose feet are at p
  aura(p: THREE.Vector3, el: El, level: number, form: boolean) {
    if (level <= 0.02) return;
    const c = EL_COLORS[el];
    const n = level * (form ? 3 : 1.6) * this.qty;
    for (let i = 0; i < n; i++) {
      if (Math.random() > Math.min(1, n - i)) continue;
      const a = Math.random() * 6.283, r = rnd(0.2, 0.6);
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, y = p.y + rnd(0, 1.7);
      switch (el) {
        case "fire": this.add.spawn(x, y * 0.5 + p.y, z, rnd(-0.3, 0.3), rnd(2, 4.5), rnd(-0.3, 0.3), rnd(0.4, 0.8), rnd(0.3, 0.6), 0.04, form ? 0xfff0a0 : c.core, form ? 0xffa010 : c.main, 1, -1); break;
        case "lightning": if (Math.random() < 0.5) this.bolt(this._v.set(x, y, z).clone(), new THREE.Vector3(x + rnd(-0.7, 0.7), y + rnd(-0.7, 0.7), z + rnd(-0.7, 0.7)), form ? 0xffe85a : c.main, 0.15, 0.08, 0.1); break;
        case "ice": this.add.spawn(x, y, z, rnd(-0.3, 0.3), rnd(0.3, 1.2), rnd(-0.3, 0.3), rnd(0.8, 1.4), 0.14, 0.03, 0xffffff, form ? 0xb8a6ff : c.main, 0.5, 0); break;
        case "dark": this.add.spawn(x, y * 0.4 + p.y, z, rnd(-0.3, 0.3), rnd(1, 2.5), rnd(-0.3, 0.3), rnd(0.5, 1), rnd(0.3, 0.55), 0.05, form ? 0xff2a5a : c.main, 0x180030, 1, -0.4); break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- update
  update(dt: number, cam: THREE.Camera) {
    this.camPos.copy(cam.position);
    this.add.update(dt, false);
    this.smoke.update(dt, true);
    for (const it of this.items) {
      if (!it.active) continue;
      it.t += dt;
      const u = it.t / it.life;
      if (u >= 1 && !it.hold) { it.active = false; it.mesh.visible = false; continue; }
      const uu = Math.min(1, u);
      const e = 1 - Math.pow(1 - uu, it.ease);
      it.mesh.scale.lerpVectors(it.s0, it.s1, e);
      const fi = it.fadeIn > 0 ? Math.min(1, uu / it.fadeIn) : 1;
      it.mat.opacity = it.op * fi * (it.hold ? 1 : 1 - Math.pow(uu, 1.6));
      if (it.vel.lengthSq() > 0) { it.mesh.position.addScaledVector(it.vel, dt); it.vel.y -= 14 * dt; it.vel.multiplyScalar(1 - 0.5 * dt); }
      if (it.spin.lengthSq() > 0) { it.mesh.rotation.x += it.spin.x * dt; it.mesh.rotation.y += it.spin.y * dt; it.mesh.rotation.z += it.spin.z * dt; }
      if (it.billboard) it.mesh.lookAt(this.camPos);
    }
    for (let i = 0; i < this.lights.length; i++) {
      const li = this.lightInfo[i];
      if (li.life <= 0) { this.lights[i].intensity = 0; continue; }
      li.t += dt;
      const u = li.t / li.life;
      if (u >= 1) { li.life = 0; this.lights[i].intensity = 0; continue; }
      this.lights[i].intensity = li.i0 * (1 - u) * (1 - u);
    }
    // debris
    let cnt = 0;
    const d = this._dummy;
    for (let i = 0; i < this.debris.length; i++) {
      const b = this.debris[i];
      if (!b || b.life <= 0) continue;
      b.life -= dt;
      b.vy -= 26 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.y < b.s * 0.5) { b.y = b.s * 0.5; if (Math.abs(b.vy) > 1.5) b.vy *= -0.35; else b.vy = 0; b.vx *= 0.8; b.vz *= 0.8; b.sx *= 0.6; b.sy *= 0.6; b.sz *= 0.6; }
      b.rx += b.sx * dt; b.ry += b.sy * dt; b.rz += b.sz * dt;
      const sc = b.life < 0.5 ? b.life * 2 : 1;
      d.position.set(b.x, b.y, b.z);
      d.rotation.set(b.rx, b.ry, b.rz);
      d.scale.setScalar(b.s * sc);
      d.updateMatrix();
      this.debrisMesh.setMatrixAt(i, d.matrix);
      cnt = i + 1;
    }
    // hide dead ones among live range
    for (let i = 0; i < cnt; i++) {
      const b = this.debris[i];
      if (!b || b.life <= 0) { d.scale.setScalar(0); d.updateMatrix(); this.debrisMesh.setMatrixAt(i, d.matrix); }
    }
    this.debrisMesh.count = cnt;
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    for (const dc of this.decals) {
      if (!dc.mesh.visible) continue;
      dc.t += dt;
      const u = dc.t / dc.life;
      if (u >= 1) { dc.mesh.visible = false; continue; }
      (dc.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, dc.t * 6) * 0.7 * (1 - u);
    }
    for (const r of this.ribbons) r.update(dt, this.camPos);
  }

  clear() {
    this.add.clear(); this.smoke.clear();
    for (const it of this.items) { it.active = false; it.mesh.visible = false; }
    for (const l of this.lights) l.intensity = 0;
    this.lightInfo.forEach((l) => (l.life = 0));
    this.debris.length = 0;
    this.debrisMesh.count = 0;
    for (const d of this.decals) d.mesh.visible = false;
  }

  dispose() {
    this.add.geo.dispose(); this.add.mat.dispose(); this.smoke.geo.dispose(); this.smoke.mat.dispose();
    Object.values(this.geos).forEach((g) => g.dispose());
    this.items.forEach((i) => i.mat.dispose());
    this.debrisMesh.geometry.dispose();
    (this.debrisMesh.material as THREE.Material).dispose();
    this.ribbons.forEach((r) => r.dispose());
  }
}
