import * as THREE from 'three';
import { COURT, SKIN_TONES, SURFACES, type CourtTheme } from '../constants';

export interface CourtScene {
  group: THREE.Group;
  net: THREE.Group;
  update(t: number, dt: number, excite: number): void;
  dispose(): void;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function surfaceTexture(kind: string, color: number): THREE.CanvasTexture {
  const base = new THREE.Color(color);
  const css = (k: number) => '#' + base.clone().multiplyScalar(k).getHexString();
  if (kind === 'grass')
    return canvasTex(128, 128, (g) => {
      g.fillStyle = css(1);
      g.fillRect(0, 0, 128, 64);
      g.fillStyle = css(0.88);
      g.fillRect(0, 64, 128, 64);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
        g.fillRect(Math.random() * 128, Math.random() * 128, 1, 3);
      }
    }, [1, 6]);
  if (kind === 'carpet')
    return canvasTex(256, 256, (g) => {
      g.fillStyle = css(1);
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(64,255,240,0.22)';
      g.lineWidth = 2;
      for (let i = 0; i <= 256; i += 64) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 256);
        g.moveTo(0, i);
        g.lineTo(256, i);
        g.stroke();
      }
    }, [4, 8]);
  return canvasTex(256, 256, (g) => {
    g.fillStyle = css(1);
    g.fillRect(0, 0, 256, 256);
    const n = kind === 'clay' || kind === 'sand' ? 2600 : 1400;
    for (let i = 0; i < n; i++) {
      g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
      const s = kind === 'sand' ? 2 : 1.5;
      g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
    }
  }, [5, 10]);
}

function skyDome(top: number, bottom: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(320, 24, 16);
  const cols: number[] = [];
  const ct = new THREE.Color(top);
  const cb = new THREE.Color(bottom);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const h = Math.max(0, p.getY(i) / 320);
    const c = cb.clone().lerp(ct, Math.pow(h, 0.6));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}

function stars(n: number): THREE.Points {
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 0.9 + 0.1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pos.push(Math.cos(a) * r * 300, u * 300, Math.sin(a) * r * 300);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
}

class Crowd {
  readonly bodies: THREE.InstancedMesh;
  readonly heads: THREE.InstancedMesh;
  private base: number[] = [];
  private phase: number[] = [];
  private dummy = new THREE.Object3D();
  private frame = 0;
  constructor(spots: { x: number; y: number; z: number; ry: number }[], palette: number[], glow = false) {
    const n = spots.length;
    const bm = glow ? new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8 }) : new THREE.MeshStandardMaterial({ roughness: 0.8 });
    this.bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.4, 2, 6), bm, n);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 7, 5), glow ? new THREE.MeshBasicMaterial({ color: 0xaaffff }) : new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
    const c = new THREE.Color();
    spots.forEach((s, i) => {
      this.base.push(s.x, s.y, s.z, s.ry);
      this.phase.push(Math.random() * 10);
      this.bodies.setColorAt(i, c.setHex(pick(palette)));
      this.heads.setColorAt(i, c.setHex(glow ? pick(palette) : pick(SKIN_TONES)));
    });
    this.bodies.castShadow = false;
    this.write(0, 0);
  }
  private write(t: number, excite: number) {
    const d = this.dummy;
    const n = this.base.length / 4;
    for (let i = 0; i < n; i++) {
      const x = this.base[i * 4];
      const y = this.base[i * 4 + 1];
      const z = this.base[i * 4 + 2];
      const ph = this.phase[i];
      const bob = (Math.max(0, Math.sin(t * (6 + (ph % 3)) + ph)) * 0.38 + 0.0) * excite + Math.sin(t * 1.4 + ph) * 0.015;
      d.position.set(x, y + bob, z);
      d.rotation.set(0, this.base[i * 4 + 3], Math.sin(t * 3 + ph) * 0.1 * excite);
      d.updateMatrix();
      this.bodies.setMatrixAt(i, d.matrix);
      d.position.y += 0.52;
      d.updateMatrix();
      this.heads.setMatrixAt(i, d.matrix);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
  }
  update(t: number, excite: number) {
    if (this.frame++ % 2 === 0) this.write(t, excite);
  }
}

interface TierOpts {
  horizontal: boolean; // length along x
  sign: 1 | -1;
  start: number;
  length: number;
  rows: number;
  center?: number;
  colors: [number, number];
  density: number;
  emissive?: number;
}
function tiers(group: THREE.Group, o: TierOpts) {
  const spots: { x: number; y: number; z: number; ry: number }[] = [];
  const mat = new THREE.MeshStandardMaterial({ color: o.colors[0], roughness: 0.85, emissive: o.emissive ?? 0, emissiveIntensity: 0.3 });
  const mat2 = new THREE.MeshStandardMaterial({ color: o.colors[1], roughness: 0.85 });
  for (let i = 0; i < o.rows; i++) {
    const h = 0.9 + i * 0.85;
    const depth = 1.0;
    const dist = o.start + i * depth;
    const geo = o.horizontal ? new THREE.BoxGeometry(o.length, h, depth) : new THREE.BoxGeometry(depth, h, o.length);
    const m = new THREE.Mesh(geo, i % 2 ? mat : mat2);
    const c = o.center ?? 0;
    if (o.horizontal) m.position.set(c, h / 2, o.sign * (dist + depth / 2));
    else m.position.set(o.sign * (dist + depth / 2), h / 2, c);
    m.receiveShadow = true;
    group.add(m);
    const step = 1 / o.density;
    for (let a = -o.length / 2 + 0.5; a < o.length / 2 - 0.3; a += step * 0.85) {
      if (Math.random() < 0.08) continue;
      const jx = rnd(-0.1, 0.1);
      if (o.horizontal) spots.push({ x: c + a + jx, y: h + 0.35, z: o.sign * (dist + depth * 0.55), ry: o.sign > 0 ? Math.PI : 0 });
      else spots.push({ x: o.sign * (dist + depth * 0.55), y: h + 0.35, z: c + a + jx, ry: o.sign > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }
  return spots;
}

function boxMesh(w: number, h: number, d: number, color: number, x: number, y: number, z: number, emissive = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), emissive ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.position.set(x, y, z);
  m.castShadow = !emissive;
  m.receiveShadow = true;
  return m;
}

function palm(h = 7): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, h, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 }));
  trunk.position.y = h / 2;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  g.add(trunk);
  const leaves = new THREE.Group();
  leaves.position.y = h;
  const lm = new THREE.MeshStandardMaterial({ color: 0x2f9e4a, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.4, 4), lm);
    l.scale.set(1, 1, 0.25);
    const a = (i / 8) * Math.PI * 2;
    l.position.set(Math.cos(a) * 1.4, -0.2, Math.sin(a) * 1.4);
    l.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
    l.castShadow = true;
    leaves.add(l);
  }
  g.add(leaves);
  (g as THREE.Group & { leaves?: THREE.Group }).leaves = leaves;
  return g;
}

function pine(h = 6): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f6a3e, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.35, h * 0.5, 7), mat);
    c.position.y = h * 0.38 + i * h * 0.22;
    c.castShadow = true;
    g.add(c);
  }
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, h * 0.3, 5), new THREE.MeshStandardMaterial({ color: 0x5a3d25 }));
  t.position.y = h * 0.15;
  g.add(t);
  return g;
}

function cloud(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(rnd(5, 10), 8, 6), m);
    s.position.set(i * 7 - 18 + rnd(-2, 2), rnd(-1.5, 2), rnd(-3, 3));
    s.scale.y = 0.55;
    g.add(s);
  }
  return g;
}

function textPlane(text: string, w: number, h: number, color: string, bg = 'rgba(0,0,0,0)'): THREE.Mesh {
  const ch = Math.round((1024 * h) / w);
  const t = canvasTex(1024, ch, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, ch);
    let size = ch * 0.62;
    g.font = `900 ${size}px system-ui, sans-serif`;
    const mw = g.measureText(text).width;
    if (mw > 940) size *= 940 / mw;
    g.font = `900 ${size}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 24;
    g.fillStyle = color;
    g.fillText(text, 512, ch * 0.52);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, fog: false }));
}

export function buildCourt(th: CourtTheme, quality: number): CourtScene {
  const group = new THREE.Group();
  const updaters: ((t: number, dt: number, excite: number) => void)[] = [];
  const surf = SURFACES[th.surface];
  const dens = quality >= 2 ? 1.3 : quality === 1 ? 1 : 0.65;

  // sky
  group.add(skyDome(th.skyTop, th.skyBottom));
  if (th.night) group.add(stars(quality ? 500 : 200));

  // ground + court
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: th.outColor, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(COURT.halfWD * 2 + 7, COURT.halfLen * 2 + 12), new THREE.MeshStandardMaterial({ map: surfaceTexture(th.surface === 'grass' ? 'grass' : 'hard', th.outColor), roughness: 0.9 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.005;
  outer.receiveShadow = true;
  group.add(outer);
  const courtMat = new THREE.MeshStandardMaterial({ map: surfaceTexture(th.surface, th.courtColor), roughness: th.surface === 'carpet' ? 0.25 : 0.88, metalness: th.surface === 'carpet' ? 0.3 : 0 });
  const court = new THREE.Mesh(new THREE.PlaneGeometry(COURT.halfWD * 2, COURT.halfLen * 2), courtMat);
  court.rotation.x = -Math.PI / 2;
  court.receiveShadow = true;
  group.add(court);

  // lines
  const lineMat = new THREE.MeshBasicMaterial({ color: th.lineColor });
  const line = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), lineMat);
    m.position.set(x, 0.008, z);
    group.add(m);
  };
  const lw = 0.09;
  const L = COURT.halfLen;
  line(COURT.halfWD * 2 + lw, lw, 0, L);
  line(COURT.halfWD * 2 + lw, lw, 0, -L);
  for (const x of [-COURT.halfWD, COURT.halfWD, -COURT.halfWS, COURT.halfWS]) line(lw, L * 2, x, 0);
  for (const z of [-COURT.service, COURT.service]) line(COURT.halfWS * 2, lw, 0, z);
  line(lw, COURT.service * 2, 0, 0);
  line(lw, 0.3, 0, L - 0.15);
  line(lw, 0.3, 0, -L + 0.15);

  // net
  const net = new THREE.Group();
  const netTex = canvasTex(128, 64, (g) => {
    g.fillStyle = 'rgba(0,0,0,0)';
    g.clearRect(0, 0, 128, 64);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 8) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 64);
      g.stroke();
    }
    for (let j = 0; j <= 64; j += 8) {
      g.beginPath();
      g.moveTo(0, j);
      g.lineTo(128, j);
      g.stroke();
    }
  }, [16, 2]);
  const netMesh = new THREE.Mesh(new THREE.PlaneGeometry(COURT.netHalf * 2, 0.96), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.2, color: th.night ? 0xdde8ff : 0xffffff }));
  netMesh.position.y = 0.5;
  net.add(netMesh);
  const band = boxMesh(COURT.netHalf * 2, 0.07, 0.04, 0xffffff, 0, 0.97, 0, true);
  net.add(band);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.12, 8), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.5, metalness: 0.5 }));
    post.position.set(sx * (COURT.netHalf + 0.05), 0.56, 0);
    post.castShadow = true;
    group.add(post);
  }
  group.add(net);
  // umpire chair
  const chair = new THREE.Group();
  chair.add(boxMesh(0.8, 0.12, 0.8, 0x444b5a, 0, 2.1, 0));
  chair.add(boxMesh(0.08, 2.1, 0.08, 0x666d7a, -0.35, 1.05, -0.35));
  chair.add(boxMesh(0.08, 2.1, 0.08, 0x666d7a, 0.35, 1.05, -0.35));
  chair.add(boxMesh(0.08, 2.1, 0.08, 0x666d7a, -0.35, 1.05, 0.35));
  chair.add(boxMesh(0.08, 2.1, 0.08, 0x666d7a, 0.35, 1.05, 0.35));
  chair.add(boxMesh(0.4, 0.6, 0.3, 0xffffff, 0, 2.5, 0));
  const uh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe0ac82 }));
  uh.position.set(0, 2.95, 0);
  chair.add(uh);
  chair.position.set(-(COURT.halfWD + 1.7), 0, 0);
  group.add(chair);

  const crowds: Crowd[] = [];
  const addCrowd = (spots: { x: number; y: number; z: number; ry: number }[], palette: number[], glow = false) => {
    const c = new Crowd(spots, palette, glow);
    group.add(c.bodies, c.heads);
    crowds.push(c);
  };
  const sideX = COURT.halfWD + 6.5;
  const endZ = COURT.halfLen + 10.5;
  const festive = [0xff4d6d, 0x3a86ff, 0xffbe0b, 0x2ec4b6, 0x9b5de5, 0xffffff, 0xff7b00, 0x80ed99];

  const neonMats: THREE.MeshBasicMaterial[] = [];

  if (th.id === 'neon') {
    const s1 = tiers(group, { horizontal: true, sign: 1, start: endZ, length: 34, rows: 5, colors: [0x1b1450, 0x2a1f6e], density: 1.1 * dens });
    const s2 = tiers(group, { horizontal: true, sign: -1, start: endZ, length: 34, rows: 5, colors: [0x1b1450, 0x2a1f6e], density: 1.1 * dens });
    const s3 = tiers(group, { horizontal: false, sign: 1, start: sideX, length: 30, rows: 4, colors: [0x1b1450, 0x2a1f6e], density: 1.1 * dens });
    const s4 = tiers(group, { horizontal: false, sign: -1, start: sideX, length: 30, rows: 4, colors: [0x1b1450, 0x2a1f6e], density: 1.1 * dens });
    addCrowd([...s1, ...s2, ...s3, ...s4], festive);
    // neon strips on the barriers
    for (const [w, d, x, z] of [[34, 0.12, 0, endZ - 0.3], [34, 0.12, 0, -endZ + 0.3], [0.12, 30, sideX - 0.3, 0], [0.12, 30, -sideX + 0.3, 0]] as number[][]) {
      const m = new THREE.MeshBasicMaterial({ color: 0xff2fd2 });
      neonMats.push(m);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), m);
      mesh.position.set(x, 0.7, z);
      group.add(mesh);
    }
    // ad boards
    for (const z of [endZ - 1.2, -endZ + 1.2]) group.add(boxMesh(26, 0.9, 0.2, 0x0a0a22, 0, 0.45, z));
    // skyline
    const winTex = canvasTex(64, 128, (g) => {
      g.fillStyle = '#0a0a1c';
      g.fillRect(0, 0, 64, 128);
      for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) if (Math.random() > 0.45) { g.fillStyle = pick(['#ffd27a', '#7ad7ff', '#ff7ad9', '#fff']); g.fillRect(x, y, 4, 5); }
    });
    const bm = new THREE.MeshBasicMaterial({ map: winTex, fog: true });
    const nb = quality ? 46 : 26;
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2 + rnd(-0.05, 0.05);
      const r = rnd(95, 150);
      const h = rnd(25, 85);
      const w = rnd(10, 18);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), bm);
      b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      group.add(b);
    }
    const sign = textPlane('TENNIS MASTERS', 40, 8, '#ff2fd2');
    sign.position.set(0, 16, -62);
    const sign2 = sign.clone();
    sign2.position.set(0, 16, 62);
    sign2.rotation.y = Math.PI;
    group.add(sign, sign2);
    // searchlights
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x9a7bff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const beams: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(3, 90, 12, 1, true), beamMat);
      b.geometry.translate(0, 45, 0);
      b.position.set(i < 2 ? -22 : 22, 0, i % 2 ? 40 : -40);
      group.add(b);
      beams.push(b);
    }
    updaters.push((t) => {
      beams.forEach((b, i) => {
        b.rotation.z = Math.sin(t * 0.6 + i) * 0.5;
        b.rotation.x = Math.cos(t * 0.5 + i * 1.7) * 0.5;
      });
      neonMats.forEach((m, i) => m.color.setHSL((t * 0.08 + i * 0.12) % 1, 1, 0.6));
      (sign.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(t * 3) * 0.25;
    });
  } else if (th.id === 'tropical') {
    const s3 = tiers(group, { horizontal: false, sign: 1, start: sideX, length: 22, rows: 3, colors: [0xb4824a, 0xd9a566], density: 1.0 * dens });
    const s4 = tiers(group, { horizontal: false, sign: -1, start: sideX, length: 22, rows: 3, colors: [0xb4824a, 0xd9a566], density: 1.0 * dens });
    addCrowd([...s3, ...s4], festive);
    // lagoon
    const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 120, 1, 1), new THREE.MeshStandardMaterial({ color: 0x19c2d8, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.0, -150);
    group.add(water);
    const palms: THREE.Group[] = [];
    const np = quality ? 22 : 12;
    for (let i = 0; i < np; i++) {
      const p = palm(rnd(6, 9));
      const side = i % 2 ? 1 : -1;
      p.position.set(side * rnd(17, 30), 0, rnd(-45, 45));
      if (Math.abs(p.position.z) < 14 && Math.abs(p.position.x) < 20) p.position.x *= 1.5;
      p.rotation.y = Math.random() * 6;
      group.add(p);
      palms.push(p);
    }
    for (let i = 0; i < 6; i++) {
      const p = palm(rnd(7, 10));
      p.position.set(rnd(-30, 30), 0, -endZ - rnd(2, 12));
      group.add(p);
      palms.push(p);
    }
    for (let i = 0; i < 8; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(rnd(25, 45), 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: pick([0x2f8a4a, 0x3aa05a, 0x277a44]), roughness: 1 }));
      hill.position.set(rnd(-160, 160), -3, rnd(-120, -70));
      group.add(hill);
    }
    // umbrellas
    for (let i = 0; i < 6; i++) {
      const u = new THREE.Group();
      u.add(boxMesh(0.07, 2.4, 0.07, 0xffffff, 0, 1.2, 0));
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 8), new THREE.MeshStandardMaterial({ color: pick([0xff4d6d, 0xffbe0b, 0x3a86ff, 0xffffff]) }));
      top.position.y = 2.5;
      top.castShadow = true;
      u.add(top);
      u.position.set((i % 2 ? 1 : -1) * rnd(sideX + 5, sideX + 9), 0, -14 + i * 5.5);
      group.add(u);
    }
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const c = cloud();
      c.position.set(rnd(-200, 200), rnd(60, 100), rnd(-250, 100));
      group.add(c);
      clouds.push(c);
    }
    updaters.push((t, dt) => {
      palms.forEach((p, i) => {
        const l = (p as THREE.Group & { leaves?: THREE.Group }).leaves;
        if (l) l.rotation.z = Math.sin(t * 1.3 + i) * 0.05;
        if (l) l.rotation.x = Math.cos(t * 1.1 + i) * 0.04;
      });
      clouds.forEach((c) => {
        c.position.x += dt * 1.5;
        if (c.position.x > 230) c.position.x = -230;
      });
      water.position.y = Math.sin(t * 0.8) * 0.05;
    });
  } else if (th.id === 'stadium') {
    const sp: { x: number; y: number; z: number; ry: number }[] = [];
    sp.push(...tiers(group, { horizontal: true, sign: 1, start: endZ - 1, length: 40, rows: 9, colors: [0x3a4a66, 0x4b5d7e], density: 1.2 * dens }));
    sp.push(...tiers(group, { horizontal: true, sign: -1, start: endZ - 1, length: 40, rows: 9, colors: [0x3a4a66, 0x4b5d7e], density: 1.2 * dens }));
    sp.push(...tiers(group, { horizontal: false, sign: 1, start: sideX - 1, length: 36, rows: 8, colors: [0x3a4a66, 0x4b5d7e], density: 1.2 * dens }));
    sp.push(...tiers(group, { horizontal: false, sign: -1, start: sideX - 1, length: 36, rows: 8, colors: [0x3a4a66, 0x4b5d7e], density: 1.2 * dens }));
    addCrowd(sp, festive);
    const boards = [0xffffff, 0xff4d6d, 0x3a86ff, 0xffbe0b];
    for (let i = 0; i < 8; i++) {
      group.add(boxMesh(5, 0.8, 0.15, boards[i % 4], -17.5 + i * 5, 0.4, endZ - 2.6));
      group.add(boxMesh(5, 0.8, 0.15, boards[(i + 1) % 4], -17.5 + i * 5, 0.4, -endZ + 2.6));
    }
    for (let i = 0; i < 6; i++) {
      group.add(boxMesh(0.15, 0.8, 5, boards[(i + 2) % 4], sideX - 2.5, 0.4, -13 + i * 5.2));
      group.add(boxMesh(0.15, 0.8, 5, boards[i % 4], -sideX + 2.5, 0.4, -13 + i * 5.2));
    }
    // light towers
    for (const [x, z] of [[-30, -34], [30, -34], [-30, 34], [30, 34]]) {
      group.add(boxMesh(0.8, 26, 0.8, 0x666d7a, x, 13, z));
      const lamp = boxMesh(7, 3.5, 0.5, 0xfff7d8, x, 27, z, true);
      lamp.lookAt(0, 10, 0);
      group.add(lamp);
    }
    const screen = textPlane('GRAND CHAMPIONSHIP', 22, 5, '#ffffff', '#12204a');
    screen.position.set(0, 13, -endZ - 9.5);
    screen.rotation.y = 0;
    const screen2 = screen.clone();
    screen2.position.set(0, 13, endZ + 9.5);
    screen2.rotation.y = Math.PI;
    group.add(screen, screen2);
    // flags
    const flags: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ color: pick(festive), side: THREE.DoubleSide }));
      const x = -22 + i * 4.9;
      f.position.set(x, 17, (i % 2 ? 1 : -1) * (endZ + 9));
      group.add(f);
      flags.push(f);
    }
    updaters.push((t, _dt, ex) => {
      flags.forEach((f, i) => (f.rotation.y = Math.sin(t * 3 + i) * 0.35));
      void ex;
    });
  } else if (th.id === 'sunset') {
    const s3 = tiers(group, { horizontal: false, sign: 1, start: sideX, length: 20, rows: 2, colors: [0x9a6a3a, 0xc08850], density: 0.9 * dens });
    const s4 = tiers(group, { horizontal: false, sign: -1, start: sideX, length: 20, rows: 2, colors: [0x9a6a3a, 0xc08850], density: 0.9 * dens });
    addCrowd([...s3, ...s4], festive);
    // ocean
    const seaGeo = new THREE.PlaneGeometry(500, 260, 60, 30);
    seaGeo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0xff7a5a, roughness: 0.2, metalness: 0.4, flatShading: true }));
    sea.position.set(0, -0.3, -190);
    group.add(sea);
    const seaBase = Float32Array.from(seaGeo.attributes.position.array);
    // sun
    const sunTex = canvasTex(256, 256, (g) => {
      const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,250,210,1)');
      gr.addColorStop(0.25, 'rgba(255,200,120,0.95)');
      gr.addColorStop(0.5, 'rgba(255,120,80,0.35)');
      gr.addColorStop(1, 'rgba(255,100,80,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
    });
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    sun.scale.set(150, 150, 1);
    sun.position.set(-30, 16, -270);
    group.add(sun);
    const sun2 = sun.clone();
    sun2.scale.set(150, 150, 1);
    sun2.position.set(30, 18, 270);
    group.add(sun2);
    const palms: THREE.Group[] = [];
    for (let i = 0; i < 14; i++) {
      const p = palm(rnd(6, 9));
      p.position.set((i % 2 ? 1 : -1) * rnd(20, 36), 0, rnd(-50, 50));
      group.add(p);
      palms.push(p);
    }
    // beach huts & flags
    for (let i = 0; i < 4; i++) {
      const hut = new THREE.Group();
      hut.add(boxMesh(4, 3, 4, pick([0xff7a8a, 0xffd27a, 0x7ad7ff, 0xffffff]), 0, 1.5, 0));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x8a5a3a }));
      roof.position.y = 3.8;
      roof.rotation.y = Math.PI / 4;
      hut.add(roof);
      hut.position.set((i % 2 ? 1 : -1) * rnd(sideX + 8, sideX + 14), 0, -20 + i * 12);
      group.add(hut);
    }
    const flags: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const pole = boxMesh(0.1, 5, 0.1, 0xffffff, (i % 2 ? 1 : -1) * (sideX + 3), 2.5, -15 + i * 6);
      group.add(pole);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ color: pick([0xff5a7a, 0xffd23f, 0x2ec4b6]), side: THREE.DoubleSide }));
      f.position.set(pole.position.x + 0.8, 4.5, pole.position.z);
      group.add(f);
      flags.push(f);
    }
    const birds: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Group();
      const wm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), wm);
      const w2 = w1.clone();
      w1.position.x = -0.6;
      w2.position.x = 0.6;
      b.add(w1, w2);
      (b as THREE.Group & { wings?: THREE.Mesh[] }).wings = [w1, w2];
      group.add(b);
      birds.push(b);
    }
    updaters.push((t, dt) => {
      palms.forEach((p, i) => {
        const l = (p as THREE.Group & { leaves?: THREE.Group }).leaves;
        if (l) l.rotation.z = Math.sin(t * 1.2 + i) * 0.05;
      });
      flags.forEach((f, i) => (f.rotation.y = Math.sin(t * 4 + i) * 0.4));
      birds.forEach((b, i) => {
        const a = t * 0.15 + i * 1.1;
        b.position.set(Math.cos(a) * (50 + i * 8), 18 + Math.sin(t * 0.7 + i) * 3 + i, Math.sin(a) * (60 + i * 6) - 40);
        b.rotation.y = -a;
        const w = (b as THREE.Group & { wings?: THREE.Mesh[] }).wings!;
        w[0].rotation.z = Math.sin(t * 9 + i) * 0.6;
        w[1].rotation.z = -Math.sin(t * 9 + i) * 0.6;
      });
      if (Math.floor(t * 20) !== Math.floor((t - dt) * 20)) {
        const arr = seaGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) arr[i + 1] = seaBase[i + 1] + Math.sin(seaBase[i] * 0.08 + t * 1.6) * 0.5 + Math.cos(seaBase[i + 2] * 0.12 + t * 1.2) * 0.4;
        seaGeo.attributes.position.needsUpdate = true;
      }
    });
  } else if (th.id === 'mountain') {
    const s3 = tiers(group, { horizontal: false, sign: 1, start: sideX, length: 20, rows: 3, colors: [0x6a4a30, 0x8a6240], density: 0.9 * dens });
    const s4 = tiers(group, { horizontal: false, sign: -1, start: sideX, length: 20, rows: 3, colors: [0x6a4a30, 0x8a6240], density: 0.9 * dens });
    addCrowd([...s3, ...s4], [0xff4d4d, 0x3a86ff, 0xffffff, 0xffbe0b, 0x2e8b57, 0x222222]);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = rnd(170, 230);
      const h = rnd(60, 130);
      const m = new THREE.Mesh(new THREE.ConeGeometry(rnd(40, 70), h, 6), new THREE.MeshStandardMaterial({ color: 0x6f7a8c, roughness: 1, flatShading: true }));
      m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(rnd(14, 24), h * 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, flatShading: true }));
      cap.position.set(m.position.x, h * 0.86 - 2, m.position.z);
      cap.scale.setScalar(1.15);
      group.add(m, cap);
    }
    const np = quality ? 70 : 36;
    for (let i = 0; i < np; i++) {
      const p = pine(rnd(5, 9));
      let x = rnd(-60, 60);
      let z = rnd(-60, 60);
      if (Math.abs(x) < 20 && Math.abs(z) < 28) {
        x += x < 0 ? -22 : 22;
      }
      p.position.set(x, 0, z);
      group.add(p);
    }
    const lodge = new THREE.Group();
    lodge.add(boxMesh(16, 6, 9, 0x8a5a38, 0, 3, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(11, 4, 4), new THREE.MeshStandardMaterial({ color: 0x4a2a22 }));
    roof.position.y = 8;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.65);
    lodge.add(roof);
    lodge.add(boxMesh(2, 2.2, 0.1, 0xffe9a0, 0, 2.2, 4.55, true));
    lodge.position.set(0, 0, -endZ - 12);
    group.add(lodge);
    const lake = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshStandardMaterial({ color: 0x4aa8d8, roughness: 0.1, metalness: 0.3 }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(-55, 0.02, 40);
    group.add(lake);
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 5; i++) {
      const c = cloud();
      c.position.set(rnd(-200, 200), rnd(70, 110), rnd(-200, 80));
      group.add(c);
      clouds.push(c);
    }
    // snow flakes
    const snowN = quality ? 400 : 160;
    const sp = new Float32Array(snowN * 3);
    for (let i = 0; i < snowN; i++) {
      sp[i * 3] = rnd(-40, 40);
      sp[i * 3 + 1] = rnd(0, 25);
      sp[i * 3 + 2] = rnd(-45, 45);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.8 }));
    group.add(snow);
    updaters.push((t, dt) => {
      clouds.forEach((c) => {
        c.position.x += dt * 1.2;
        if (c.position.x > 230) c.position.x = -230;
      });
      const arr = sg.attributes.position.array as Float32Array;
      for (let i = 0; i < snowN; i++) {
        arr[i * 3 + 1] -= dt * (0.8 + (i % 5) * 0.2);
        arr[i * 3] += Math.sin(t + i) * dt * 0.3;
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 25;
      }
      sg.attributes.position.needsUpdate = true;
    });
  } else {
    // cyber
    const holo = new THREE.MeshBasicMaterial({ color: 0x1de9ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
    const sp: { x: number; y: number; z: number; ry: number }[] = [];
    const mk = (horizontal: boolean, sign: 1 | -1, start: number, length: number, rows: number) => {
      for (let i = 0; i < rows; i++) {
        const h = 0.9 + i * 0.85;
        const mesh = new THREE.Mesh(horizontal ? new THREE.BoxGeometry(length, h, 1) : new THREE.BoxGeometry(1, h, length), holo);
        const dist = start + i + 0.5;
        if (horizontal) mesh.position.set(0, h / 2, sign * dist);
        else mesh.position.set(sign * dist, h / 2, 0);
        group.add(mesh);
        const eg = new THREE.Mesh(horizontal ? new THREE.BoxGeometry(length, 0.05, 0.05) : new THREE.BoxGeometry(0.05, 0.05, length), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x40fff0 : 0xff40d0 }));
        eg.position.set(horizontal ? 0 : sign * (dist - 0.5), h, horizontal ? sign * (dist - 0.5) : 0);
        group.add(eg);
        for (let a = -length / 2 + 0.6; a < length / 2; a += 1.1 / dens) {
          if (Math.random() < 0.15) continue;
          if (horizontal) sp.push({ x: a, y: h + 0.35, z: sign * (dist + 0.1), ry: sign > 0 ? Math.PI : 0 });
          else sp.push({ x: sign * (dist + 0.1), y: h + 0.35, z: a, ry: sign > 0 ? -Math.PI / 2 : Math.PI / 2 });
        }
      }
    };
    mk(true, 1, endZ, 32, 4);
    mk(true, -1, endZ, 32, 4);
    mk(false, 1, sideX, 28, 3);
    mk(false, -1, sideX, 28, 3);
    addCrowd(sp, [0x40fff0, 0xff40d0, 0xb0ff40, 0xffffff, 0x7a5cff], true);
    // light pillars
    const pillars: THREE.Mesh[] = [];
    for (const [x, z] of [[-14, -26], [14, -26], [-14, 26], [14, 26], [-22, 0], [22, 0]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x40fff0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      p.position.set(x, 20, z);
      group.add(p);
      pillars.push(p);
    }
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(7 + i * 2.2, 0.12, 8, 48), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff40d0 : 0x40fff0, transparent: true, opacity: 0.75 }));
      r.position.set(0, 20 + i * 2.4, i % 2 ? -34 : 34);
      group.add(r);
      rings.push(r);
    }
    const panel = textPlane('CYBER COURT', 30, 6, '#40fff0');
    panel.position.set(0, 12, -36);
    const panel2 = panel.clone();
    panel2.position.set(0, 12, 36);
    panel2.rotation.y = Math.PI;
    group.add(panel, panel2);
    // grid on ground
    const grid = new THREE.GridHelper(400, 160, 0x40fff0, 0x12306a);
    grid.position.y = -0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    group.add(grid);
    // motes
    const mn = quality ? 260 : 100;
    const mp = new Float32Array(mn * 3);
    for (let i = 0; i < mn; i++) {
      mp[i * 3] = rnd(-35, 35);
      mp[i * 3 + 1] = rnd(0, 30);
      mp[i * 3 + 2] = rnd(-45, 45);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0x40fff0, size: 0.25, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(motes);
    updaters.push((t, dt) => {
      pillars.forEach((p, i) => ((p.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(t * 2 + i) * 0.12));
      rings.forEach((r, i) => {
        r.rotation.x = t * (0.4 + i * 0.15);
        r.rotation.y = t * 0.3 * (i % 2 ? -1 : 1);
      });
      (holo as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(t * 1.5) * 0.03;
      const arr = mg.attributes.position.array as Float32Array;
      for (let i = 0; i < mn; i++) {
        arr[i * 3 + 1] += dt * (0.6 + (i % 4) * 0.3);
        if (arr[i * 3 + 1] > 30) arr[i * 3 + 1] = 0;
      }
      mg.attributes.position.needsUpdate = true;
    });
  }

  // trophy-less decorations: corner flags / benches shared
  void hex;
  void surf;

  return {
    group,
    net,
    update(t, dt, excite) {
      for (const c of crowds) c.update(t, excite);
      for (const u of updaters) u(t, dt, excite);
      net.rotation.x *= 1 - Math.min(1, dt * 6);
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      group.removeFromParent();
    },
  };
}
