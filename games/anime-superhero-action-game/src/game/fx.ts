import * as THREE from "three";
import { G, V3, rnd } from "./core";

const _c = new THREE.Color();
const rgb = (c: number) => {
  _c.set(c);
  return [_c.r, _c.g, _c.b];
};

class Particles {
  pos: Float32Array; col: Float32Array; size: Float32Array;
  vel: Float32Array; life: Float32Array; maxLife: Float32Array; grav: Float32Array; drag: Float32Array; grow: Float32Array; base: Float32Array; rgb: Float32Array;
  head = 0;
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  constructor(public max: number, additive: boolean) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.base = new Float32Array(max);
    this.rgb = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aCol", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC;
        void main(){ vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.15,d)*vC.a; if(a<0.01) discard; gl_FragColor=vec4(vC.rgb, a); }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, size: number, life: number, grav = 0, drag = 0, grow = 0) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = rgb(color);
    this.rgb[i * 3] = c[0]; this.rgb[i * 3 + 1] = c[1]; this.rgb[i * 3 + 2] = c[2];
    this.base[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
    this.size[i] = size;
  }
  update(dt: number) {
    const { pos, vel, life, maxLife, col, size, base, grow, drag, grav } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { size[i] = 0; continue; }
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; continue; }
      const k = 1 - life[i] / maxLife[i];
      const d = Math.max(0, 1 - drag[i] * dt);
      vel[i * 3] *= d; vel[i * 3 + 1] = vel[i * 3 + 1] * d - grav[i] * dt; vel[i * 3 + 2] *= d;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] = base[i] * (1 + grow[i] * k) * (k > 0.7 ? 1 - (k - 0.7) * 1.2 : 1);
      col[i * 4] = this.rgb[i * 3]; col[i * 4 + 1] = this.rgb[i * 3 + 1]; col[i * 4 + 2] = this.rgb[i * 3 + 2];
      col[i * 4 + 3] = k < 0.1 ? k * 10 : 1 - (k - 0.1) / 0.9 * 0.9;
    }
    const g = this.points.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aCol as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }
}

export interface FxM {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; life: number; s0: V3; s1: V3; o0: number; o1: number; active: boolean; spin: number; kind: string; ease: number;
}
const geos: Record<string, THREE.BufferGeometry> = {};
function geo(kind: string) {
  if (geos[kind]) return geos[kind];
  let g: THREE.BufferGeometry;
  switch (kind) {
    case "sphere": g = new THREE.SphereGeometry(1, 16, 12); break;
    case "ring": g = new THREE.RingGeometry(0.88, 1, 40); g.rotateX(-Math.PI / 2); break;
    case "disc": g = new THREE.CircleGeometry(1, 32); g.rotateX(-Math.PI / 2); break;
    case "beam": g = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true); g.translate(0, 0.5, 0); break;
    case "cone": g = new THREE.ConeGeometry(1, 1, 14, 1, true); g.translate(0, 0.5, 0); break;
    case "dome": g = new THREE.SphereGeometry(1, 24, 14); break;
    case "slash": g = new THREE.RingGeometry(0.7, 1, 24, 1, 0, Math.PI * 0.8); g.rotateX(-Math.PI / 2); break;
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  return (geos[kind] = g);
}
export interface MeshOpt { life?: number; s0?: number[]; s1?: number[]; o0?: number; o1?: number; dir?: V3; dark?: boolean; spin?: number; ease?: number; back?: boolean; ry?: number }

const lights: { l: THREE.PointLight; t: number; life: number; i: number }[] = [];
const dust: any = null;
void dust;
export const fx = {
  add: null as Particles | null,
  dark: null as Particles | null,
  pool: [] as FxM[],
  head: 0,
  density: 0.85,
  init(root: THREE.Group) {
    this.add = new Particles(3500, true);
    this.dark = new Particles(1500, false);
    root.add(this.add.points, this.dark.points);
    for (let i = 0; i < 230; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const mesh = new THREE.Mesh(geo("sphere"), mat);
      mesh.visible = false;
      mesh.renderOrder = 4;
      root.add(mesh);
      this.pool.push({ mesh, mat, t: 0, life: 1, s0: new V3(1, 1, 1), s1: new V3(1, 1, 1), o0: 1, o1: 0, active: false, spin: 0, kind: "sphere", ease: 1 });
    }
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 60, 1.6);
      root.add(l);
      lights.push({ l, t: 0, life: 1, i: 0 });
    }
  },
  em(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, size: number, life: number, grav = 0, drag = 0, grow = 0) {
    if (this.density < 1 && Math.random() > this.density) return;
    this.add!.emit(x, y, z, vx, vy, vz, color, size, life, grav, drag, grow);
  },
  smoke(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, size: number, life: number, grav = 0, drag = 0, grow = 1.5) {
    if (this.density < 1 && Math.random() > this.density) return;
    this.dark!.emit(x, y, z, vx, vy, vz, color, size, life, grav, drag, grow);
  },
  mesh(kind: string, x: number, y: number, z: number, color: number, o: MeshOpt = {}): FxM {
    let m = this.pool[this.head];
    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[(this.head + i) % this.pool.length];
      if (!c.active) { m = c; break; }
    }
    this.head = (this.head + 1) % this.pool.length;
    m.active = true; m.t = 0; m.life = o.life ?? 0.5; m.kind = kind; m.ease = o.ease ?? 1;
    const s0 = o.s0 ?? [1, 1, 1];
    m.s0.set(s0[0], s0[1], s0[2]);
    const s1 = o.s1 ?? s0;
    m.s1.set(s1[0], s1[1], s1[2]);
    m.o0 = o.o0 ?? 0.8; m.o1 = o.o1 ?? 0; m.spin = o.spin ?? 0;
    m.mesh.geometry = geo(kind);
    m.mat.color.set(color);
    m.mat.blending = o.dark ? THREE.NormalBlending : THREE.AdditiveBlending;
    m.mat.side = kind === "dome" && o.back ? THREE.BackSide : kind === "beam" || kind === "cone" || kind === "slash" ? THREE.DoubleSide : THREE.FrontSide;
    m.mat.opacity = m.o0;
    m.mesh.position.set(x, y, z);
    m.mesh.rotation.set(0, o.ry ?? 0, 0);
    m.mesh.quaternion.identity();
    if (o.ry) m.mesh.rotation.y = o.ry;
    if (o.dir) m.mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), o.dir.clone().normalize());
    m.mesh.scale.copy(m.s0);
    m.mesh.visible = true;
    return m;
  },
  kill(m: FxM | null | undefined) {
    if (!m) return;
    m.active = false;
    m.mesh.visible = false;
  },
  ring(x: number, z: number, r0: number, r1: number, color: number, life = 0.5, y = 0.15, o = 0.8) {
    return this.mesh("ring", x, y, z, color, { life, s0: [r0, 1, r0], s1: [r1, 1, r1], o0: o, o1: 0 });
  },
  light(p: V3, color: number, intensity: number, life = 0.4) {
    if (G.settings.quality === "low") return;
    const L = lights[0].t > lights[1].t ? lights[1] : lights[0];
    L.l.position.copy(p);
    L.l.color.set(color);
    L.i = intensity;
    L.t = life;
    L.life = life;
  },
  burst(p: V3, color: number, n: number, speed: number, size = 0.4, life = 0.6, grav = 6, y = 0) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), e = rnd(-0.3, 1), s = rnd(0.3, 1) * speed;
      this.em(p.x, p.y, p.z, Math.cos(a) * s * (1 - e * 0.5), s * (e + y), Math.sin(a) * s * (1 - e * 0.5), color, size * rnd(0.6, 1.2), life * rnd(0.6, 1.1), grav, 1.5);
    }
  },
  sparks(p: V3, color: number, n = 8, speed = 10) {
    this.burst(p, color, n, speed, 0.25, 0.35, 12);
  },
  explosion(p: V3, radius: number, color = 0xff7a1a, color2 = 0xffd23f, dark = false) {
    const n = Math.min(70, Math.floor(10 + radius * 3));
    this.mesh("sphere", p.x, p.y + radius * 0.2, p.z, color2, { life: 0.35, s0: [radius * 0.25, radius * 0.25, radius * 0.25], s1: [radius * 0.85, radius * 0.85, radius * 0.85], o0: 0.9, o1: 0 });
    this.mesh("sphere", p.x, p.y + radius * 0.2, p.z, color, { life: 0.6, s0: [radius * 0.15, radius * 0.15, radius * 0.15], s1: [radius * 0.65, radius * 0.5, radius * 0.65], o0: 0.7, o1: 0 });
    this.ring(p.x, p.z, radius * 0.2, radius * 1.1, color2, 0.45, Math.max(0.15, p.y + 0.15));
    this.burst(p, color, n, radius * 2.2, Math.max(0.5, radius * 0.18), 0.9, 4, 0.8);
    this.burst(p, color2, Math.floor(n / 2), radius * 3, Math.max(0.3, radius * 0.1), 0.5, 8);
    for (let i = 0; i < n / 2; i++) this.smoke(p.x + rnd(-1, 1) * radius * 0.3, p.y + rnd(0, 1), p.z + rnd(-1, 1) * radius * 0.3, rnd(-1, 1) * radius * 0.4, rnd(1, 3) + radius * 0.2, rnd(-1, 1) * radius * 0.4, dark ? 0x120a22 : 0x2a2420, Math.max(1, radius * 0.45), rnd(1, 1.8), -0.5, 1, 1.5);
    this.light(p.clone().add(new V3(0, 3, 0)), color2, 80 + radius * 8, 0.45);
  },
  update(dt: number, renderer?: THREE.WebGLRenderer, fov = 70) {
    this.add!.update(dt);
    this.dark!.update(dt);
    if (renderer) {
      const h = renderer.domElement.height;
      const sc = h / (2 * Math.tan((fov * Math.PI) / 360));
      this.add!.mat.uniforms.uScale.value = sc;
      this.dark!.mat.uniforms.uScale.value = sc;
    }
    for (const m of this.pool) {
      if (!m.active) continue;
      m.t += dt;
      const k = m.life === Infinity ? 0 : Math.min(1, m.t / m.life);
      const e = 1 - Math.pow(1 - k, 1 + m.ease);
      m.mesh.scale.lerpVectors(m.s0, m.s1, e);
      m.mat.opacity = m.o0 + (m.o1 - m.o0) * k;
      if (m.spin) m.mesh.rotation.y += m.spin * dt;
      if (k >= 1) { m.active = false; m.mesh.visible = false; }
    }
    for (const L of lights) {
      if (L.t > 0) { L.t -= dt; L.l.intensity = Math.max(0, (L.t / L.life) * L.i); } else L.l.intensity = 0;
    }
  },
};

export function shake(a: number) {
  if (!G.settings.shake) return;
  G.shake = Math.max(G.shake, a);
}
export function hitstop(t: number) {
  G.hitstop = Math.max(G.hitstop, t);
}
export function dmgNum(p: V3, text: string | number, color = "#ffffff", size = 1) {
  G.dmgNums.push({ x: p.x + rnd(-0.4, 0.4), y: p.y, z: p.z + rnd(-0.4, 0.4), text: String(text), color, t: 0, size });
  if (G.dmgNums.length > 60) G.dmgNums.shift();
}
