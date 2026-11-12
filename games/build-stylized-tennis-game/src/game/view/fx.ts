import * as THREE from 'three';

/** Pooled additive point-sprite particle system (trails, sparks, dust, confetti). */
export class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private siz: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private baseSize: Float32Array;
  private base: Float32Array;
  private head = 0;
  private geo: THREE.BufferGeometry;
  readonly uniforms = { scale: { value: 600 } };

  constructor(readonly max: number, additive = true) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.siz = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.grav = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.base = new Float32Array(max * 4);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.siz, 1));
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -100;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vColor; uniform float scale;
        void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vColor;
        void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0; if(d>1.0) discard; float a=smoothstep(1.0,0.0,d); gl_FragColor=vec4(vColor.rgb*a*vColor.a, a*vColor.a); }`,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, gravity = 0, alpha = 1) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = gravity;
    this.baseSize[i] = size;
    this.base[i * 4] = ((color >> 16) & 255) / 255;
    this.base[i * 4 + 1] = ((color >> 8) & 255) / 255;
    this.base[i * 4 + 2] = (color & 255) / 255;
    this.base[i * 4 + 3] = alpha;
  }

  burst(x: number, y: number, z: number, n: number, speed: number, life: number, size: number, color: number, gravity = 9) {
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const s = speed * (0.4 + Math.random() * 0.8);
      this.emit(x, y, z, Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, gravity);
    }
  }

  update(dt: number) {
    const { pos, vel, life, maxLife, grav, col, siz, base, baseSize } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) {
        siz[i] = 0;
        continue;
      }
      life[i] -= dt;
      const f = Math.max(0, life[i] / maxLife[i]);
      vel[i * 3 + 1] -= grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.02 && grav[i] > 0) {
        pos[i * 3 + 1] = 0.02;
        vel[i * 3 + 1] *= -0.3;
        vel[i * 3] *= 0.7;
        vel[i * 3 + 2] *= 0.7;
      }
      col[i * 4] = base[i * 4];
      col[i * 4 + 1] = base[i * 4 + 1];
      col[i * 4 + 2] = base[i * 4 + 2];
      col[i * 4 + 3] = base[i * 4 + 3] * f;
      siz[i] = baseSize[i] * (0.4 + 0.6 * f);
      if (life[i] <= 0) siz[i] = 0;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}

export function radialTexture(inner = 0, soft = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, inner * 64, 64, 64, 62);
  if (soft) {
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.72, 'rgba(255,255,255,0)');
    gr.addColorStop(0.82, 'rgba(255,255,255,1)');
    gr.addColorStop(0.92, 'rgba(255,255,255,0.7)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pool of expanding flash / ring sprites (always face the camera). */
export class Flashes {
  readonly group = new THREE.Group();
  private items: { s: THREE.Sprite; life: number; max: number; size: number; grow: number }[] = [];
  private head = 0;
  constructor(n = 16) {
    const soft = radialTexture(0, true);
    const ring = radialTexture(0, false);
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: i % 2 ? ring : soft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(m);
      s.visible = false;
      this.group.add(s);
      this.items.push({ s, life: 0, max: 1, size: 1, grow: 1 });
    }
  }
  spawn(x: number, y: number, z: number, size: number, color: number, life = 0.3, ring = false, grow = 2.5) {
    // find a slot of the right texture type (even = glow, odd = ring)
    for (let k = 0; k < this.items.length; k++) {
      const i = (this.head + k) % this.items.length;
      if (i % 2 === (ring ? 1 : 0) && this.items[i].life <= 0) {
        this.head = i + 1;
        const it = this.items[i];
        it.life = it.max = life;
        it.size = size;
        it.grow = grow;
        it.s.position.set(x, y, z);
        (it.s.material as THREE.SpriteMaterial).color.setHex(color);
        it.s.visible = true;
        return;
      }
    }
  }
  update(dt: number) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.s.visible = false;
        continue;
      }
      const f = 1 - it.life / it.max;
      const sc = it.size * (1 + f * it.grow);
      it.s.scale.set(sc, sc, 1);
      (it.s.material as THREE.SpriteMaterial).opacity = (1 - f) * (1 - f);
    }
  }
}

/** Flat ground ripples for court impacts. */
export class Ripples {
  readonly group = new THREE.Group();
  private items: { m: THREE.Mesh; life: number; max: number; size: number }[] = [];
  private head = 0;
  constructor(n = 10) {
    const geo = new THREE.RingGeometry(0.8, 1, 32);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false;
      m.position.y = 0.03;
      this.group.add(m);
      this.items.push({ m, life: 0, max: 1, size: 1 });
    }
  }
  spawn(x: number, z: number, size: number, color: number, life = 0.45) {
    const it = this.items[this.head];
    this.head = (this.head + 1) % this.items.length;
    it.life = it.max = life;
    it.size = size;
    it.m.position.set(x, 0.03, z);
    (it.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    it.m.visible = true;
  }
  update(dt: number) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.m.visible = false;
        continue;
      }
      const f = 1 - it.life / it.max;
      const sc = it.size * (0.2 + f);
      it.m.scale.set(sc, 1, sc);
      (it.m.material as THREE.MeshBasicMaterial).opacity = (1 - f) * 0.9;
    }
  }
}
