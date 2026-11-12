// Pooled visual effects: particles, shockwaves, telegraphs, damage numbers, weapon trails.
import * as THREE from 'three';

const vs = `attribute float aSize; attribute vec4 aColor; varying vec4 vC; uniform float uScale;
void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const fs = `varying vec4 vC; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; float a=smoothstep(0.5,0.05,d)*vC.a; gl_FragColor=vec4(vC.rgb,a); }`;

export class Particles {
  pts: THREE.Points;
  cap: number;
  head = 0;
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  max: Float32Array;
  s0: Float32Array;
  s1: Float32Array;
  c0: Float32Array;
  c1: Float32Array;
  grav: Float32Array;
  drag: Float32Array;
  mat: THREE.ShaderMaterial;
  geo: THREE.BufferGeometry;
  constructor(scene: THREE.Scene, cap: number, additive: boolean) {
    this.cap = cap;
    const n = cap;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n).fill(1);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.c0 = new Float32Array(n * 3);
    this.c1 = new Float32Array(n * 3);
    this.grav = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vs,
      fragmentShader: fs,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
    });
    this.pts = new THREE.Points(this.geo, this.mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = additive ? 5 : 4;
    scene.add(this.pts);
  }
  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    s0: number,
    s1: number,
    c0: THREE.Color,
    c1: THREE.Color,
    grav = 0,
    drag = 0
  ) {
    const i = this.head;
    this.head = (this.head + 1) % this.cap;
    const a = i * 3;
    this.pos[a] = x;
    this.pos[a + 1] = y;
    this.pos[a + 2] = z;
    this.vel[a] = vx;
    this.vel[a + 1] = vy;
    this.vel[a + 2] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.c0[a] = c0.r;
    this.c0[a + 1] = c0.g;
    this.c0[a + 2] = c0.b;
    this.c1[a] = c1.r;
    this.c1[a + 1] = c1.g;
    this.c1[a + 2] = c1.b;
    this.grav[i] = grav;
    this.drag[i] = drag;
  }
  update(dt: number) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const a = i * 3,
        k = 1 - Math.max(0, this.life[i]) / this.max[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[a] *= d;
      this.vel[a + 1] = this.vel[a + 1] * d - this.grav[i] * dt;
      this.vel[a + 2] *= d;
      this.pos[a] += this.vel[a] * dt;
      this.pos[a + 1] += this.vel[a + 1] * dt;
      this.pos[a + 2] += this.vel[a + 2] * dt;
      if (this.pos[a + 1] < 0.02 && this.grav[i] > 0) {
        this.pos[a + 1] = 0.02;
        this.vel[a + 1] *= -0.3;
      }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      const c = i * 4;
      this.col[c] = this.c0[a] + (this.c1[a] - this.c0[a]) * k;
      this.col[c + 1] = this.c0[a + 1] + (this.c1[a + 1] - this.c0[a + 1]) * k;
      this.col[c + 2] = this.c0[a + 2] + (this.c1[a + 2] - this.c0[a + 2]) * k;
      this.col[c + 3] = Math.min(1, (1 - k) * 1.6);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
  }
}

function crescentTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.shadowColor = '#ffffff';
  g.shadowBlur = 22;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    g.globalAlpha = 0.9 - i * 0.25;
    g.lineWidth = 24 - i * 7;
    g.beginPath();
    g.arc(0, 0, 72 + i * 12, -1.85, 1.85);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, 96, -1.75, 1.75);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 1, 64, 64, 63);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function streakTex() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.3)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(20, 0, 24, 256);
  g.filter = 'blur(4px)';
  g.fillRect(14, 0, 36, 256);
  return new THREE.CanvasTexture(c);
}
function crackTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.shadowColor = '#ffffff';
  g.shadowBlur = 8;
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * 6.283;
    let x = 0,
      y = 0;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(0, 0);
    for (let k = 0; k < 5; k++) {
      x += Math.cos(a + (Math.random() - 0.5) * 1.1) * (12 + Math.random() * 18);
      y += Math.sin(a + (Math.random() - 0.5) * 1.1) * (12 + Math.random() * 18);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const tmpA = new THREE.Color(),
  tmpB = new THREE.Color();
export class FX {
  add: Particles;
  smoke: Particles;
  scene: THREE.Scene;
  density = 1;
  rings: { m: THREE.Mesh; t: number; dur: number; max: number }[] = [];
  tele: {
    g: THREE.Group;
    fill: THREE.Mesh;
    out: THREE.Mesh;
    t: number;
    dur: number;
    type: string;
    len: number;
    on: boolean;
    onDone?: () => void;
  }[] = [];
  nums: { s: THREE.Sprite; t: number; vy: number; c: HTMLCanvasElement }[] = [];
  trailMesh: THREE.Mesh;
  trailPts: THREE.Vector3[][] = [];
  trailAge: number[] = [];
  decals: { m: THREE.Mesh; t: number; dur: number; max: number }[] = [];
  slashPool: { s: THREE.Sprite; t: number; dur: number; base: number; scale: number }[] = [];
  flashPool: { s: THREE.Sprite; t: number; dur: number; base: number }[] = [];
  streakPool: { s: THREE.Sprite; t: number; dur: number; len: number }[] = [];
  crackPool: { m: THREE.Mesh; t: number; dur: number; max: number }[] = [];
  constructor(scene: THREE.Scene, cap: number) {
    this.scene = scene;
    this.add = new Particles(scene, cap, true);
    this.smoke = new Particles(scene, Math.floor(cap * 0.6), false);
    const rg = new THREE.RingGeometry(0.85, 1, 40);
    rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        rg,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      m.visible = false;
      scene.add(m);
      this.rings.push({ m, t: 0, dur: 1, max: 1 });
    }
    const cg = new THREE.CircleGeometry(1, 36);
    cg.rotateX(-Math.PI / 2);
    const pg = new THREE.PlaneGeometry(1, 1);
    pg.rotateX(-Math.PI / 2);
    pg.translate(0, 0, 0.5);
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const mk = (geo: THREE.BufferGeometry, op: number) =>
        new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({
            color: 0xff2030,
            transparent: true,
            opacity: op,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
      const out = mk(cg, 0.22),
        fill = mk(cg, 0.5);
      out.userData.cg = cg;
      out.userData.pg = pg;
      g.add(out, fill);
      g.visible = false;
      g.position.y = 0.06;
      scene.add(g);
      this.tele.push({ g, fill, out, t: 0, dur: 1, type: 'circle', len: 1, on: false });
      (fill.userData as any).cg = cg;
      (fill.userData as any).pg = pg;
    }
    for (let i = 0; i < 24; i++) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 64;
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })
      );
      s.visible = false;
      s.renderOrder = 20;
      scene.add(s);
      this.nums.push({ s, t: 0, vy: 0, c });
    }
    const N = 12;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    tg.setIndex(idx);
    this.trailMesh = new THREE.Mesh(
      tg,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.trailMesh.frustumCulled = false;
    this.trailMesh.visible = false;
    scene.add(this.trailMesh);
    const dg = new THREE.CircleGeometry(1, 40);
    dg.rotateX(-Math.PI / 2);
    const dc = document.createElement('canvas');
    dc.width = dc.height = 256;
    const x = dc.getContext('2d')!;
    const gr = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(10,0,25,0.95)');
    gr.addColorStop(0.6, 'rgba(60,10,140,0.7)');
    gr.addColorStop(1, 'rgba(120,40,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(190,130,255,0.8)';
    x.lineWidth = 3;
    for (let k = 1; k < 4; k++) {
      x.beginPath();
      x.arc(128, 128, 30 * k + 10, 0, 6.3);
      x.stroke();
    }
    for (let k = 0; k < 8; k++) {
      x.beginPath();
      x.moveTo(128, 128);
      x.lineTo(128 + Math.cos(k * 0.785) * 118, 128 + Math.sin(k * 0.785) * 118);
      x.stroke();
    }
    const dt = new THREE.CanvasTexture(dc);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        dg,
        new THREE.MeshBasicMaterial({ map: dt, transparent: true, depthWrite: false, opacity: 1 })
      );
      m.visible = false;
      m.position.y = 0.04;
      scene.add(m);
      this.decals.push({ m, t: 0, dur: 1, max: 1 });
    }
    // combat accents: crescent slashes, impact flashes, dash streaks, ground cracks
    const cres = crescentTex();
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: cres,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        })
      );
      s.visible = false;
      s.renderOrder = 18;
      scene.add(s);
      this.slashPool.push({ s, t: 0, dur: 0.22, base: 1, scale: 1 });
    }
    const glow = glowTex();
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        })
      );
      s.visible = false;
      s.renderOrder = 17;
      scene.add(s);
      this.flashPool.push({ s, t: 0, dur: 0.18, base: 1 });
    }
    const streak = streakTex();
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: streak,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        })
      );
      s.visible = false;
      s.renderOrder = 16;
      scene.add(s);
      this.streakPool.push({ s, t: 0, dur: 0.32, len: 2 });
    }
    const crack = crackTex();
    const cgPlane = new THREE.PlaneGeometry(1, 1);
    cgPlane.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        cgPlane,
        new THREE.MeshBasicMaterial({
          map: crack,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.8,
        })
      );
      m.visible = false;
      m.position.y = 0.055;
      scene.add(m);
      this.crackPool.push({ m, t: 0, dur: 2.4, max: 1 });
    }
  }
  setScale(h: number, fov: number) {
    const u = h / 2 / Math.tan((fov * Math.PI) / 360);
    this.add.mat.uniforms.uScale.value = u;
    this.smoke.mat.uniforms.uScale.value = u;
  }
  burst(
    x: number,
    y: number,
    z: number,
    n: number,
    o: {
      speed?: number;
      up?: number;
      life?: number;
      size?: number;
      end?: number;
      c0?: number;
      c1?: number;
      grav?: number;
      drag?: number;
      smoke?: boolean;
      spread?: number;
    } = {}
  ) {
    const P = o.smoke ? this.smoke : this.add;
    tmpA.set(o.c0 ?? 0xffffff);
    tmpB.set(o.c1 ?? o.c0 ?? 0xffffff);
    const m = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < m; i++) {
      const a = Math.random() * 6.283,
        e = (Math.random() - 0.3) * (o.spread ?? 1.2),
        sp = (o.speed ?? 4) * (0.4 + Math.random() * 0.8);
      P.emit(
        x,
        y,
        z,
        Math.cos(a) * Math.cos(e) * sp,
        Math.sin(e) * sp + (o.up ?? 0),
        Math.sin(a) * Math.cos(e) * sp,
        (o.life ?? 0.6) * (0.6 + Math.random() * 0.6),
        o.size ?? 0.2,
        o.end ?? 0,
        tmpA,
        tmpB,
        o.grav ?? 0,
        o.drag ?? 1.5
      );
    }
  }
  sparks(x: number, y: number, z: number, color = 0xffd070, n = 14) {
    this.burst(x, y, z, n, { speed: 7, life: 0.35, size: 0.14, c0: 0xffffff, c1: color, grav: 14, drag: 1 });
  }
  dust(x: number, z: number, n = 10) {
    this.burst(x, 0.2, z, n, {
      speed: 2.5,
      life: 0.9,
      size: 0.7,
      end: 1.6,
      c0: 0x6a6660,
      c1: 0x3a3830,
      smoke: true,
      spread: 0.3,
      drag: 2,
    });
  }
  shadowBurst(x: number, y: number, z: number, n = 24, speed = 3) {
    this.burst(x, y, z, n, {
      speed,
      up: 1.5,
      life: 1.0,
      size: 0.5,
      end: 1.4,
      c0: 0x120022,
      c1: 0x050008,
      smoke: true,
      spread: 1.0,
      drag: 1.5,
    });
    this.burst(x, y, z, n, {
      speed,
      up: 2,
      life: 0.9,
      size: 0.2,
      end: 0,
      c0: 0xd4a0ff,
      c1: 0x6a2cff,
      spread: 1.2,
      drag: 1.5,
    });
  }
  slash(x: number, y: number, z: number, color: number, size = 2.2, rotation = 0, stretch = 1) {
    const q = this.slashPool.find((p) => !p.s.visible) || this.slashPool[0];
    q.s.visible = true;
    q.s.position.set(x, y, z);
    q.s.material.color.set(color);
    (q.s.material as THREE.SpriteMaterial).rotation = rotation;
    q.s.scale.set(size, size * stretch, 1);
    q.t = 0;
    q.dur = 0.2;
    q.base = size;
    q.scale = stretch;
  }
  flash(x: number, y: number, z: number, color: number, size = 1.8, dur = 0.16) {
    const q = this.flashPool.find((p) => !p.s.visible) || this.flashPool[0];
    q.s.visible = true;
    q.s.position.set(x, y, z);
    q.s.material.color.set(color);
    q.s.scale.setScalar(size);
    q.t = 0;
    q.dur = dur;
    q.base = size;
  }
  streak(x: number, y: number, z: number, color: number, len = 2.4, rotation = 0) {
    const q = this.streakPool.find((p) => !p.s.visible) || this.streakPool[0];
    q.s.visible = true;
    q.s.position.set(x, y, z);
    q.s.material.color.set(color);
    (q.s.material as THREE.SpriteMaterial).rotation = rotation;
    q.s.scale.set(0.6, len, 1);
    q.t = 0;
    q.dur = 0.3;
    q.len = len;
  }
  crack(x: number, z: number, size = 2.4, dur = 2.4, color = 0xffcf70) {
    const q = this.crackPool.find((p) => !p.m.visible) || this.crackPool[0];
    q.m.visible = true;
    q.m.position.set(x, 0.055, z);
    q.m.scale.setScalar(0.1);
    q.m.rotation.y = Math.random() * 6.28;
    (q.m.material as THREE.MeshBasicMaterial).color.set(color);
    (q.m.material as THREE.MeshBasicMaterial).opacity = 0.9;
    q.t = 0;
    q.dur = dur;
    q.max = size;
  }
  soul(x: number, z: number, color = 0xb26bff, n = 10) {
    for (let i = 0; i < Math.max(2, Math.round(n * this.density)); i++) {
      const a = Math.random() * 6.283;
      const r = 0.2 + Math.random() * 0.7;
      this.add.emit(
        x + Math.cos(a) * r,
        0.2 + Math.random() * 0.8,
        z + Math.sin(a) * r,
        -Math.cos(a) * r * 0.5,
        1.4 + Math.random() * 1.6,
        -Math.sin(a) * r * 0.5,
        0.9 + Math.random() * 0.7,
        0.12,
        0,
        tmpA.set(color),
        tmpB.set(0x14002a),
        -0.6,
        0.4
      );
    }
  }
  pillar(x: number, z: number, color: number, height = 5, size = 0.6) {
    this.flash(x, Math.min(1.6, height * 0.3), z, color, size * 2.2, 0.5);
    this.streak(x, height * 0.45, z, color, height, 0);
    this.shock(x, 0, z, color, size * 3.2, 0.55);
  }
  shock(x: number, y: number, z: number, color: number, max: number, dur = 0.5) {
    const r = this.rings.find((q) => !q.m.visible) || this.rings[0];
    r.m.visible = true;
    (r.m.material as THREE.MeshBasicMaterial).color.set(color);
    r.m.position.set(x, y + 0.08, z);
    r.t = 0;
    r.dur = dur;
    r.max = max;
    r.m.scale.setScalar(0.1);
  }
  telegraph(
    type: 'circle' | 'rect',
    x: number,
    z: number,
    yaw: number,
    size: number,
    len: number,
    dur: number,
    color = 0xff2030
  ) {
    const t = this.tele.find((q) => !q.on) || this.tele[0];
    t.on = true;
    t.t = 0;
    t.dur = dur;
    t.type = type;
    t.len = len;
    t.g.visible = true;
    t.g.position.set(x, 0.06, z);
    t.g.rotation.y = yaw;
    (t.out.material as THREE.MeshBasicMaterial).color.set(color);
    (t.fill.material as THREE.MeshBasicMaterial).color.set(color);
    const cg = t.out.userData.cg,
      pg = t.out.userData.pg;
    t.out.geometry = type === 'circle' ? cg : pg;
    t.fill.geometry = type === 'circle' ? cg : pg;
    if (type === 'circle') {
      t.out.scale.set(size, 1, size);
      t.fill.scale.set(0.01, 1, 0.01);
    } else {
      t.out.scale.set(size, 1, len);
      t.fill.scale.set(size, 1, 0.01);
    }
    return t;
  }
  clearTele() {
    this.tele.forEach((t) => {
      t.on = false;
      t.g.visible = false;
    });
  }
  num(pos: THREE.Vector3, text: string, color = '#ffffff', big = false) {
    const n = this.nums.find((q) => !q.s.visible) || this.nums[0];
    const g = n.c.getContext('2d')!;
    g.clearRect(0, 0, 128, 64);
    g.font = `900 ${big ? 46 : 36}px Arial`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = '#05060f';
    g.strokeText(text, 64, 32);
    g.fillStyle = color;
    g.fillText(text, 64, 32);
    (n.s.material.map as THREE.CanvasTexture).needsUpdate = true;
    n.s.visible = true;
    n.s.position.copy(pos);
    n.s.position.x += (Math.random() - 0.5) * 0.6;
    n.t = 0;
    n.vy = 2.2;
    n.s.scale.set(big ? 1.8 : 1.4, big ? 0.9 : 0.7, 1);
  }
  decal(x: number, z: number, r: number, dur: number) {
    const d = this.decals.find((q) => !q.m.visible) || this.decals[0];
    d.m.visible = true;
    d.m.position.set(x, 0.04, z);
    d.t = 0;
    d.dur = dur;
    d.max = r;
    d.m.scale.setScalar(0.1);
    (d.m.material as THREE.MeshBasicMaterial).opacity = 1;
    return d;
  }
  trail(base: THREE.Vector3, tip: THREE.Vector3, color: number) {
    this.trailPts.unshift([base.clone(), tip.clone()]);
    this.trailAge.unshift(0);
    if (this.trailPts.length > 12) {
      this.trailPts.pop();
      this.trailAge.pop();
    }
    (this.trailMesh.material as THREE.MeshBasicMaterial).color.set(0xffffff);
    this.trailMesh.userData.c = color;
    this.trailMesh.visible = true;
  }
  update(dt: number) {
    this.add.update(dt);
    this.smoke.update(dt);
    for (const r of this.rings)
      if (r.m.visible) {
        r.t += dt;
        const k = r.t / r.dur;
        if (k >= 1) {
          r.m.visible = false;
          continue;
        }
        r.m.scale.setScalar(0.1 + (r.max - 0.1) * (1 - Math.pow(1 - k, 3)));
        (r.m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      }
    for (const t of this.tele)
      if (t.on) {
        t.t += dt;
        const k = Math.min(1, t.t / t.dur);
        if (t.type === 'circle') {
          const s = t.out.scale.x * k;
          t.fill.scale.set(s, 1, s);
        } else {
          t.fill.scale.z = t.len * k;
        }
        const urgency = k > 0.8 ? (k - 0.8) * 5 : 0;
        (t.fill.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.3 * Math.sin(t.t * 25) + urgency * 0.35;
        (t.out.material as THREE.MeshBasicMaterial).opacity = 0.18 + urgency * 0.55;
        if (t.t >= t.dur + 0.12) {
          t.on = false;
          t.g.visible = false;
        }
      }
    for (const n of this.nums)
      if (n.s.visible) {
        n.t += dt;
        n.s.position.y += n.vy * dt;
        n.vy *= 0.94;
        (n.s.material as THREE.SpriteMaterial).opacity = Math.min(1, 2.5 - n.t * 2.5);
        if (n.t > 1) n.s.visible = false;
      }
    for (const d of this.decals)
      if (d.m.visible) {
        d.t += dt;
        const k = d.t / d.dur;
        if (k >= 1) {
          d.m.visible = false;
          continue;
        }
        d.m.scale.setScalar(d.max * Math.min(1, k * 4));
        (d.m.material as THREE.MeshBasicMaterial).opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
        d.m.rotation.y += dt * 0.6;
      }
    for (const q of this.slashPool)
      if (q.s.visible) {
        q.t += dt;
        const k = q.t / q.dur;
        if (k >= 1) {
          q.s.visible = false;
          continue;
        }
        const e = 1 - Math.pow(1 - k, 3);
        q.s.scale.set(q.base * (0.75 + e * 0.45), q.base * q.scale * (0.75 + e * 0.45), 1);
        (q.s.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.95;
      }
    for (const q of this.flashPool)
      if (q.s.visible) {
        q.t += dt;
        const k = q.t / q.dur;
        if (k >= 1) {
          q.s.visible = false;
          continue;
        }
        q.s.scale.setScalar(q.base * (0.6 + k * 1.1));
        (q.s.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.85;
      }
    for (const q of this.streakPool)
      if (q.s.visible) {
        q.t += dt;
        const k = q.t / q.dur;
        if (k >= 1) {
          q.s.visible = false;
          continue;
        }
        q.s.scale.set(0.6 * (1 - k * 0.5), q.len * (1 + k * 0.4), 1);
        (q.s.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.7;
      }
    for (const q of this.crackPool)
      if (q.m.visible) {
        q.t += dt;
        const k = q.t / q.dur;
        if (k >= 1) {
          q.m.visible = false;
          continue;
        }
        q.m.scale.setScalar(q.max * Math.min(1, k * 6));
        (q.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - k * 0.9);
      }
    // trail
    const tm = this.trailMesh;
    if (tm.visible) {
      for (let i = 0; i < this.trailAge.length; i++) this.trailAge[i] += dt;
      while (this.trailAge.length && this.trailAge[this.trailAge.length - 1] > 0.22) {
        this.trailAge.pop();
        this.trailPts.pop();
      }
      if (!this.trailPts.length) {
        tm.visible = false;
        return;
      }
      const p = tm.geometry.attributes.position as THREE.BufferAttribute,
        c = tm.geometry.attributes.color as THREE.BufferAttribute;
      const col = tmpA.set(tm.userData.c);
      for (let i = 0; i < 12; i++) {
        const s = this.trailPts[Math.min(i, this.trailPts.length - 1)];
        const age = this.trailAge[Math.min(i, this.trailAge.length - 1)] ?? 0.3;
        const f = i >= this.trailPts.length ? 0 : Math.max(0, 1 - age / 0.22);
        p.setXYZ(i * 2, s[0].x, s[0].y, s[0].z);
        p.setXYZ(i * 2 + 1, s[1].x, s[1].y, s[1].z);
        c.setXYZ(i * 2, col.r * f * 0.2, col.g * f * 0.2, col.b * f * 0.2);
        c.setXYZ(i * 2 + 1, col.r * f, col.g * f, col.b * f);
      }
      p.needsUpdate = true;
      c.needsUpdate = true;
    }
  }
}
