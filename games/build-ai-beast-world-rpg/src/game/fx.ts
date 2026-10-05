import * as THREE from "three";

const MAXP = 1600;

export class Telegraph {
  group = new THREE.Group();
  fill: THREE.Mesh;
  kind: string;
  constructor(parent: THREE.Object3D, kind: "circle" | "cone" | "line", a: number, b: number, color: number) {
    this.kind = kind;
    let fg: THREE.BufferGeometry, og: THREE.BufferGeometry;
    if (kind === "circle") {
      fg = new THREE.CircleGeometry(a, 40).rotateX(-Math.PI / 2);
      og = new THREE.RingGeometry(a * 0.97, a, 48).rotateX(-Math.PI / 2);
    } else if (kind === "cone") {
      fg = new THREE.CircleGeometry(a, 28, -b / 2, b).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
      og = new THREE.RingGeometry(a * 0.96, a, 28, 1, -b / 2, b).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
    } else {
      fg = new THREE.PlaneGeometry(a, b).translate(a / 2, 0, 0).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
      og = new THREE.PlaneGeometry(a, b).translate(a / 2, 0, 0).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
    }
    const mk = (g: THREE.BufferGeometry, op: number) => {
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      m.renderOrder = 5; return m;
    };
    this.fill = mk(fg, 0.5);
    const outline = mk(og, kind === "line" ? 0.18 : 0.8);
    this.group.add(outline, this.fill);
    parent.add(this.group);
  }
  set(p: number) {
    p = Math.min(1, Math.max(0, p));
    if (this.kind === "line") this.fill.scale.set(1, 1, Math.max(0.001, p)); else this.fill.scale.setScalar(Math.max(0.001, p));
    (this.fill.material as THREE.MeshBasicMaterial).opacity = 0.25 + p * 0.45;
  }
  remove() {
    this.group.parent?.remove(this.group);
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  }
}

interface Eph { obj: THREE.Object3D; t: number; dur: number; fn: (f: number, o: THREE.Object3D) => void; mat: THREE.Material }

export class FX {
  scene: THREE.Scene;
  pts: THREE.Points;
  pos = new Float32Array(MAXP * 3); col = new Float32Array(MAXP * 4); siz = new Float32Array(MAXP);
  vel = new Float32Array(MAXP * 3); life = new Float32Array(MAXP); max = new Float32Array(MAXP); grav = new Float32Array(MAXP); base = new Float32Array(MAXP); drag = new Float32Array(MAXP);
  head = 0;
  eph: Eph[] = [];
  nums: { el: HTMLElement; p: THREE.Vector3; t: number; vy: number }[] = [];
  mat: THREE.ShaderMaterial;
  host: HTMLElement;
  flashEl: HTMLElement;
  numLayer: HTMLElement;
  shake = 0;
  private ringGeo = new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2);
  private sphGeo = new THREE.SphereGeometry(1, 16, 10);
  private cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
  private arcGeos = new Map<number, THREE.BufferGeometry>();
  private tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, host: HTMLElement) {
    this.scene = scene; this.host = host;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 4));
    g.setAttribute("size", new THREE.BufferAttribute(this.siz, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 500 } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=min(256.0,size*uScale/max(0.1,-mv.z)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.05,d); gl_FragColor=vec4(vC.rgb*vC.a*a, vC.a*a); }`,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.life.fill(0); this.siz.fill(0);
    this.flashEl = document.createElement("div");
    this.flashEl.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0;z-index:5";
    this.numLayer = document.createElement("div");
    this.numLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6";
    host.append(this.flashEl, this.numLayer);
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color | number, size: number, life: number, grav = 0, drag = 0) {
    const i = this.head; this.head = (this.head + 1) % MAXP;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = color instanceof THREE.Color ? color : this.tmpC.set(color);
    this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = 1;
    this.base[i] = size; this.siz[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  private tmpC = new THREE.Color();
  burst(p: THREE.Vector3, n: number, color: number, speed: number, size: number, life: number, grav = 6, up = 0.3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.6, s = speed * (0.35 + Math.random() * 0.65);
      this.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + speed * up, Math.sin(a) * Math.cos(e) * s, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav, 1.5);
    }
  }
  spray(p: THREE.Vector3, dir: THREE.Vector3, n: number, color: number, speed: number, size: number, life: number) {
    for (let i = 0; i < n; i++) {
      const s = speed * (0.4 + Math.random() * 0.8);
      this.emit(p.x, p.y, p.z, dir.x * s + (Math.random() - 0.5) * speed * 0.6, dir.y * s + (Math.random() - 0.2) * speed * 0.6, dir.z * s + (Math.random() - 0.5) * speed * 0.6, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), 8, 1.2);
    }
  }
  dustPuff(p: THREE.Vector3, n = 6, color = 0xb8a68c) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      this.emit(p.x, p.y + 0.1, p.z, Math.cos(a) * 2.2, 0.8 + Math.random(), Math.sin(a) * 2.2, color, 0.9, 0.5, -0.5, 2);
    }
  }

  addEph(obj: THREE.Object3D, dur: number, fn: (f: number, o: THREE.Object3D) => void, mat: THREE.Material) {
    this.scene.add(obj); this.eph.push({ obj, t: 0, dur, fn, mat });
  }
  private bm(color: number, op = 0.8, side = THREE.DoubleSide) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side });
  }
  ring(p: THREE.Vector3, color: number, r0: number, r1: number, dur = 0.5, y = 0.2) {
    const m = new THREE.Mesh(this.ringGeo, this.bm(color)); m.position.copy(p); m.position.y += y;
    this.addEph(m, dur, (f, o) => { const r = r0 + (r1 - r0) * (1 - (1 - f) * (1 - f)); o.scale.set(r, 1, r); (m.material as THREE.Material).opacity = (1 - f) * 0.9; }, m.material as THREE.Material);
  }
  sphere(p: THREE.Vector3, color: number, r0: number, r1: number, dur = 0.4) {
    const m = new THREE.Mesh(this.sphGeo, this.bm(color, 0.7)); m.position.copy(p);
    this.addEph(m, dur, (f, o) => { const r = r0 + (r1 - r0) * Math.sqrt(f); o.scale.setScalar(r); (m.material as THREE.Material).opacity = (1 - f) * 0.7; }, m.material as THREE.Material);
  }
  column(p: THREE.Vector3, color: number, r: number, h: number, dur = 0.5) {
    const m = new THREE.Mesh(this.cylGeo, this.bm(color, 0.8)); m.position.set(p.x, p.y + h / 2, p.z);
    this.addEph(m, dur, (f, o) => { const rr = r * (1 - f * 0.7); o.scale.set(rr, h, rr); (m.material as THREE.Material).opacity = (1 - f) * 0.45; }, m.material as THREE.Material);
  }
  /** crescent slash lying in a tilted plane, facing yaw */
  slash(p: THREE.Vector3, yaw: number, radius: number, arc: number, color: number, tilt = 0.25, roll = 0, dur = 0.22) {
    const k = Math.round(arc * 10);
    let g = this.arcGeos.get(k);
    if (!g) { g = new THREE.RingGeometry(0.55, 1, 28, 1, Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2); this.arcGeos.set(k, g); }
    const m = new THREE.Mesh(g, this.bm(color, 0.95));
    m.position.copy(p); m.rotation.set(tilt, yaw, roll, "YXZ");
    m.rotation.y = yaw + Math.PI; // ring arcs at +Z originally -> flip
    this.addEph(m, dur, (f, o) => { const r = radius * (0.7 + f * 0.45); o.scale.set(r, r, r); (m.material as THREE.Material).opacity = (1 - f) * (1 - f) * 0.95; }, m.material as THREE.Material);
  }

  number(p: THREE.Vector3, text: string, color: string, size = 22) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = `position:absolute;left:0;top:0;font:900 ${size}px 'Trebuchet MS',sans-serif;color:${color};text-shadow:0 0 6px #000,0 2px 0 #000,0 0 14px ${color};will-change:transform,opacity;white-space:nowrap;`;
    this.numLayer.appendChild(el);
    this.nums.push({ el, p: p.clone().add(this.tmp.set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)), t: 0, vy: 2.2 });
    if (this.nums.length > 28) { const o = this.nums.shift()!; o.el.remove(); }
  }
  flash(color: string, alpha: number, ms = 300) {
    const e = this.flashEl;
    e.style.transition = "none"; e.style.background = color; e.style.opacity = String(alpha);
    void e.offsetWidth;
    e.style.transition = `opacity ${ms}ms ease-out`; e.style.opacity = "0";
  }
  addShake(a: number) { this.shake = Math.min(1.6, Math.max(this.shake, a)); }

  update(dt: number, cam: THREE.PerspectiveCamera, vh: number) {
    this.mat.uniforms.uScale.value = vh / (2 * Math.tan((cam.fov * Math.PI) / 360));
    for (let i = 0; i < MAXP; i++) {
      const l = this.life[i];
      if (l <= 0) { if (this.siz[i] !== 0) this.siz[i] = 0; continue; }
      const nl = l - dt; this.life[i] = nl;
      if (nl <= 0) { this.siz[i] = 0; continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = nl / this.max[i];
      this.col[i * 4 + 3] = Math.min(1, f * 2);
      this.siz[i] = this.base[i] * (0.3 + f * 0.7);
    }
    (this.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.pts.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.pts.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    for (let i = this.eph.length - 1; i >= 0; i--) {
      const e = this.eph[i]; e.t += dt;
      const f = e.t / e.dur;
      if (f >= 1) { this.scene.remove(e.obj); e.mat.dispose(); this.eph.splice(i, 1); continue; }
      e.fn(f, e.obj);
    }
    // damage numbers
    const w = this.host.clientWidth, h = this.host.clientHeight;
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.t += dt; n.p.y += n.vy * dt; n.vy *= 0.94;
      if (n.t > 0.9) { n.el.remove(); this.nums.splice(i, 1); continue; }
      this.tmp.copy(n.p).project(cam);
      if (this.tmp.z > 1) { n.el.style.opacity = "0"; continue; }
      const sc = n.t < 0.12 ? 1 + (0.12 - n.t) * 8 : 1;
      n.el.style.transform = `translate(${(this.tmp.x * 0.5 + 0.5) * w}px,${(-this.tmp.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${sc})`;
      n.el.style.opacity = String(Math.min(1, (0.9 - n.t) * 4));
    }
  }
  clear() {
    this.life.fill(0);
    for (const e of this.eph) { this.scene.remove(e.obj); e.mat.dispose(); }
    this.eph.length = 0;
    for (const n of this.nums) n.el.remove();
    this.nums.length = 0;
  }
  dispose() { this.clear(); this.flashEl.remove(); this.numLayer.remove(); }
}
