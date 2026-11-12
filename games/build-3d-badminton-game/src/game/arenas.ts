// Six stylized 3D badminton arenas with a correctly proportioned court, net, posts, stands and unique themes.
import * as THREE from 'three';
import { ArenaId, COURT } from './constants';

export interface ArenaBuild {
  group: THREE.Group;
  bg: THREE.Color;
  fog: THREE.Fog;
  update(t: number, dt: number, excite: number): void;
}

interface Theme {
  bg: string; fog: string; fogNear: number; fogFar: number;
  outer: string; court: string; lines: string; wood: boolean;
  wall: string | null; floorGloss?: boolean;
  hemiSky: string; hemiGround: string; hemiI: number; sun: string; sunI: number;
  crowd: string[]; stand: string;
}

const THEMES: Record<ArenaId, Theme> = {
  neon: { bg: '#04050d', fog: '#04050d', fogNear: 25, fogFar: 70, outer: '#0a0f2e', court: '#1346a8', lines: '#ffffff', wood: false, wall: '#090b1c', hemiSky: '#6c8cff', hemiGround: '#2a1450', hemiI: 1.1, sun: '#b8c8ff', sunI: 0.9, crowd: ['#ff2d95', '#18e0ff', '#a855f7', '#fef08a', '#34d399'], stand: '#14172e' },
  royal: { bg: '#1a0a0e', fog: '#2a1215', fogNear: 30, fogFar: 80, outer: '#6b1020', court: '#c98f4f', lines: '#fffdf2', wood: true, wall: '#e8d9b0', hemiSky: '#ffe9c4', hemiGround: '#6b3a2a', hemiI: 1.25, sun: '#fff0d0', sunI: 1.0, crowd: ['#7f1d1d', '#1e293b', '#f5e6c8', '#b45309', '#312e81'], stand: '#4a1018' },
  tropical: { bg: '#8fdcff', fog: '#bfeaff', fogNear: 40, fogFar: 120, outer: '#d7b878', court: '#14a89a', lines: '#ffffff', wood: true, wall: null, hemiSky: '#e6f7ff', hemiGround: '#d9b97c', hemiI: 1.5, sun: '#fff6d8', sunI: 1.3, crowd: ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#ff9f1c', '#ffffff'], stand: '#a9814a' },
  cyber: { bg: '#03010a', fog: '#05020f', fogNear: 25, fogFar: 75, outer: '#06060f', court: '#0a2342', lines: '#eaffff', wood: false, wall: '#05030f', hemiSky: '#7a6bff', hemiGround: '#0a1a2a', hemiI: 1.0, sun: '#9fe8ff', sunI: 0.9, crowd: ['#00ffd5', '#ff00aa', '#7c4dff', '#c6ff00', '#00b0ff'], stand: '#0d0b20' },
  mountain: { bg: '#a9d3f0', fog: '#cfe6f5', fogNear: 35, fogFar: 110, outer: '#7a4a22', court: '#d6a65f', lines: '#ffffff', wood: true, wall: null, hemiSky: '#e3f1ff', hemiGround: '#8a6a44', hemiI: 1.4, sun: '#fff4e0', sunI: 1.2, crowd: ['#c2410c', '#1d4ed8', '#15803d', '#fde68a', '#be123c', '#e5e7eb'], stand: '#6b4423' },
  grand: { bg: '#080c18', fog: '#0a1020', fogNear: 35, fogFar: 95, outer: '#0b3d29', court: '#1c8c52', lines: '#ffffff', wood: false, wall: '#0b1224', hemiSky: '#dfe9ff', hemiGround: '#203040', hemiI: 1.3, sun: '#ffffff', sunI: 1.1, crowd: ['#ef4444', '#3b82f6', '#fbbf24', '#e5e7eb', '#22c55e', '#a855f7'], stand: '#1b2438' },
};

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map<string, THREE.Material>();
function lam(color: string) {
  const k = 'l' + color;
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color }); matCache.set(k, m); }
  return m;
}
function glow(color: string, opacity = 1) {
  const k = 'g' + color + opacity;
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: opacity >= 1 }); matCache.set(k, m); }
  return m;
}
function box(g: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  g.add(m);
  return m;
}

function makeCourtTexture(th: Theme): THREE.CanvasTexture {
  const S = 100, W = 16, L = 27;
  const c = document.createElement('canvas');
  c.width = W * S; c.height = L * S;
  const x = c.getContext('2d')!;
  const px = (wx: number) => (wx + W / 2) * S;
  const pz = (wz: number) => (wz + L / 2) * S;
  x.fillStyle = th.outer; x.fillRect(0, 0, c.width, c.height);
  if (th.wood) {
    for (let i = 0; i < c.width / 22; i++) {
      x.fillStyle = `rgba(0,0,0,${0.03 + (i % 3) * 0.02})`;
      x.fillRect(i * 22, 0, 2, c.height);
    }
  }
  // court area
  x.fillStyle = th.court;
  x.fillRect(px(-COURT.halfWidthD - 0.35), pz(-COURT.halfLen - 0.4), (COURT.halfWidthD + 0.35) * 2 * S, (COURT.halfLen + 0.4) * 2 * S);
  if (th.wood) {
    for (let i = 0; i < 80; i++) {
      x.fillStyle = `rgba(60,30,0,${0.04 + (i % 4) * 0.015})`;
      x.fillRect(px(-COURT.halfWidthD - 0.35) + i * 9, pz(-COURT.halfLen - 0.4), 1.5, (COURT.halfLen + 0.4) * 2 * S);
    }
  }
  const lw = 5;
  x.strokeStyle = th.lines; x.lineWidth = lw; x.lineCap = 'square';
  const line = (x1: number, z1: number, x2: number, z2: number) => { x.beginPath(); x.moveTo(px(x1), pz(z1)); x.lineTo(px(x2), pz(z2)); x.stroke(); };
  const hw = COURT.halfWidthD, hs = COURT.halfWidthS, hl = COURT.halfLen;
  // outer boundary (doubles) & singles sidelines
  line(-hw, -hl, hw, -hl); line(-hw, hl, hw, hl);
  line(-hw, -hl, -hw, hl); line(hw, -hl, hw, hl);
  line(-hs, -hl, -hs, hl); line(hs, -hl, hs, hl);
  // short service lines, long doubles service lines, centre lines
  for (const s of [-1, 1]) {
    line(-hw, s * COURT.shortService, hw, s * COURT.shortService);
    line(-hw, s * COURT.longServiceD, hw, s * COURT.longServiceD);
    line(0, s * COURT.shortService, 0, s * hl);
  }
  // net line
  x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 3;
  line(-hw - 0.4, 0, hw + 0.4, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeNet(g: THREE.Group) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const x = c.getContext('2d')!;
  x.strokeStyle = 'rgba(240,240,240,0.9)'; x.lineWidth = 1.5;
  for (let i = 0; i <= 64; i++) { x.beginPath(); x.moveTo(i * 8, 0); x.lineTo(i * 8, 64); x.stroke(); }
  for (let j = 0; j <= 8; j++) { x.beginPath(); x.moveTo(0, j * 8); x.lineTo(512, j * 8); x.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(COURT.halfWidthD * 2, 0.76), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  net.position.set(0, COURT.netH - 0.38, 0);
  g.add(net);
  const tape = box(g, COURT.halfWidthD * 2, 0.06, 0.03, 0, COURT.netH - 0.02, 0, glow('#ffffff'));
  void tape;
  const postM = lam('#d8dde6');
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, COURT.netPostH, 10), postM);
    p.position.set(s * (COURT.halfWidthD + 0.02), COURT.netPostH / 2, 0);
    g.add(p);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.06, 12), lam('#444a58'));
    foot.position.set(s * (COURT.halfWidthD + 0.02), 0.03, 0);
    g.add(foot);
  }
  // umpire chair
  const chair = new THREE.Group();
  box(chair, 0.5, 0.06, 0.5, 0, 1.4, 0, lam('#2d3340'));
  box(chair, 0.06, 1.4, 0.06, -0.2, 0.7, -0.2, lam('#9aa3b2'));
  box(chair, 0.06, 1.4, 0.06, 0.2, 0.7, -0.2, lam('#9aa3b2'));
  box(chair, 0.06, 1.4, 0.06, -0.2, 0.7, 0.2, lam('#9aa3b2'));
  box(chair, 0.06, 1.4, 0.06, 0.2, 0.7, 0.2, lam('#9aa3b2'));
  box(chair, 0.5, 0.5, 0.06, 0, 1.7, -0.25, lam('#2d3340'));
  chair.position.set(-(COURT.halfWidthD + 1.2), 0, 0);
  g.add(chair);
}

interface CrowdPack {
  update(t: number, excite: number): void;
}
function makeCrowd(g: THREE.Group, th: Theme, low: boolean): CrowdPack {
  const slots: { x: number; y: number; z: number; ph: number; ry: number }[] = [];
  const cols = th.stand;
  const standMat = lam(cols);
  const rows = low ? 4 : 6;
  const addSide = (axis: 'x' | 'z', sign: 1 | -1, half: number, base: number, spacing: number) => {
    for (let r = 0; r < rows; r++) {
      const off = base + r * 0.95;
      const h = 0.45 + r * 0.55;
      if (axis === 'x') box(g, 0.95, h, half * 2 + 2, sign * off, h / 2, 0, standMat);
      else box(g, half * 2 + 2, h, 0.95, 0, h / 2, sign * off, standMat);
      const n = Math.floor((half * 2) / spacing);
      for (let i = 0; i < n; i++) {
        const u = -half + (i + 0.5) * spacing + ((r * 0.37) % 0.3);
        slots.push(axis === 'x'
          ? { x: sign * off, y: h, z: u, ph: Math.random() * 6.28, ry: sign > 0 ? Math.PI / 2 : -Math.PI / 2 }
          : { x: u, y: h, z: sign * off, ph: Math.random() * 6.28, ry: sign > 0 ? Math.PI : 0 });
      }
    }
  };
  addSide('x', 1, 12, 9.4, 0.8); addSide('x', -1, 12, 9.4, 0.8);
  addSide('z', 1, 8.2, 15.2, 0.8); addSide('z', -1, 8.2, 15.2, 0.8);
  const n = slots.length;
  const bodyG = new THREE.CapsuleGeometry(0.2, 0.36, 3, 6);
  const headG = new THREE.SphereGeometry(0.15, 8, 6);
  const body = new THREE.InstancedMesh(bodyG, new THREE.MeshLambertMaterial({ color: '#ffffff' }), n);
  const head = new THREE.InstancedMesh(headG, new THREE.MeshLambertMaterial({ color: '#ffffff' }), n);
  const c = new THREE.Color();
  const skins = ['#f1c9a5', '#d9a577', '#a9744f', '#7a4b2e', '#f6d7bd'];
  slots.forEach((_s, i) => {
    c.set(th.crowd[(i * 7 + (i >> 3)) % th.crowd.length]);
    body.setColorAt(i, c);
    c.set(skins[(i * 3) % skins.length]);
    head.setColorAt(i, c);
  });
  g.add(body); g.add(head);
  const d = new THREE.Object3D();
  let acc = 0;
  const write = (t: number, excite: number) => {
    for (let i = 0; i < n; i++) {
      const s = slots[i];
      const bob = (Math.sin(t * (3 + excite * 7) + s.ph) * 0.5 + 0.5) * (0.02 + excite * 0.22);
      d.position.set(s.x, s.y + 0.42 + bob, s.z);
      d.rotation.set(0, s.ry, Math.sin(t * 2 + s.ph) * 0.05 * (1 + excite * 3));
      d.updateMatrix();
      body.setMatrixAt(i, d.matrix);
      d.position.y += 0.52;
      d.updateMatrix();
      head.setMatrixAt(i, d.matrix);
    }
    body.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true;
  };
  write(0, 0);
  return {
    update(t, excite) {
      acc += 1;
      if (acc % 3 === 0) write(t, excite);
    },
  };
}

function lights(g: THREE.Group, th: Theme) {
  g.add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI));
  const sun = new THREE.DirectionalLight(th.sun, th.sunI);
  sun.position.set(6, 16, 8);
  g.add(sun);
  const fill = new THREE.DirectionalLight(th.sun, th.sunI * 0.4);
  fill.position.set(-6, 10, -10);
  g.add(fill);
}

function walls(g: THREE.Group, th: Theme) {
  if (!th.wall) return;
  const m = lam(th.wall);
  box(g, 0.5, 14, 40, -17, 7, 0, m); box(g, 0.5, 14, 40, 17, 7, 0, m);
  box(g, 34, 14, 0.5, 0, 7, -20, m); box(g, 34, 14, 0.5, 0, 7, 20, m);
  box(g, 34, 0.4, 40, 0, 14, 0, lam('#05060c'));
}

function banners(g: THREE.Group, colors: string[], y = 5) {
  for (let i = 0; i < 6; i++) {
    const c = colors[i % colors.length];
    box(g, 0.1, 3, 1.6, -16.6, y, -12 + i * 4.8, glow(c));
    box(g, 0.1, 3, 1.6, 16.6, y, -12 + i * 4.8, glow(c));
  }
}

function screenPanel(g: THREE.Group, text: string, a: string, b: string, x: number, y: number, z: number, ry: number, w = 12, h = 3) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const x2 = c.getContext('2d')!;
  const gr = x2.createLinearGradient(0, 0, 1024, 0);
  gr.addColorStop(0, a); gr.addColorStop(1, b);
  x2.fillStyle = gr; x2.fillRect(0, 0, 1024, 256);
  x2.fillStyle = 'rgba(255,255,255,0.95)';
  x2.font = '900 120px system-ui, sans-serif';
  x2.textAlign = 'center'; x2.textBaseline = 'middle';
  x2.fillText(text, 512, 135);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(x, y, z); m.rotation.y = ry;
  g.add(m);
  return m;
}

export function buildArena(id: ArenaId, low = false): ArenaBuild {
  const th = THEMES[id];
  const g = new THREE.Group();
  const bg = new THREE.Color(th.bg);
  const fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
  lights(g, th);
  const tex = makeCourtTexture(th);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 27), new THREE.MeshLambertMaterial({ map: tex }));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  // outer ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: id === 'tropical' ? '#3fb6d9' : id === 'mountain' ? '#e8f1f8' : th.outer }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
  g.add(ground);
  makeNet(g);
  walls(g, th);
  const crowd = makeCrowd(g, th, low);
  const anim: ((t: number, dt: number, ex: number) => void)[] = [];

  switch (id) {
    case 'neon': {
      const cols = ['#18e0ff', '#ff2d95', '#a855f7'];
      for (let i = 0; i < 3; i++) {
        for (const s of [-1, 1]) {
          box(g, 0.12, 0.12, 36, s * 16.6, 2.5 + i * 2.6, 0, glow(cols[i]));
          box(g, 30, 0.12, 0.12, 0, 2.5 + i * 2.6, s * 19.6, glow(cols[(i + 1) % 3]));
        }
      }
      const bars: THREE.Mesh[] = [];
      for (let i = 0; i < 8; i++) bars.push(box(g, 0.5, 0.2, 30, -14 + i * 4, 13.5, 0, glow(i % 2 ? '#18e0ff' : '#ff2d95')));
      const beams: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.ConeGeometry(1.8, 14, 16, 1, true), glow(i % 2 ? '#18e0ff' : '#ff2d95', 0.12));
        b.position.set(-9 + i * 6, 7, i % 2 ? -8 : 8);
        g.add(b); beams.push(b);
      }
      screenPanel(g, 'BADMINTON MASTERS', '#ff2d95', '#18e0ff', 0, 5.5, -19.6, 0, 14, 3.5);
      screenPanel(g, 'BADMINTON MASTERS', '#18e0ff', '#a855f7', 0, 5.5, 19.6, Math.PI, 14, 3.5);
      anim.push((t, _dt, ex) => {
        bars.forEach((b, i) => { b.scale.y = 0.2 + (Math.sin(t * 2 + i) * 0.5 + 0.5) * (0.4 + ex); });
        beams.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.8 + i) * 0.35; b.rotation.x = Math.cos(t * 0.6 + i) * 0.3; });
      });
      // glowing court border
      box(g, 6.9, 0.02, 0.07, 0, 0.01, -7.25, glow('#18e0ff')); box(g, 6.9, 0.02, 0.07, 0, 0.01, 7.25, glow('#ff2d95'));
      break;
    }
    case 'royal': {
      const gold = lam('#d4a72c');
      for (let i = 0; i < 6; i++) {
        for (const s of [-1, 1]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 12, 14), lam('#f3e8c8'));
          col.position.set(s * 16.2, 6, -12.5 + i * 5);
          g.add(col);
          box(g, 1.3, 0.4, 1.3, s * 16.2, 12, -12.5 + i * 5, gold);
          box(g, 1.3, 0.5, 1.3, s * 16.2, 0.25, -12.5 + i * 5, gold);
        }
      }
      banners(g, ['#b91c1c', '#d4a72c'], 8);
      const chand: THREE.Group[] = [];
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 6, 20), gold);
        ring.rotation.x = Math.PI / 2; c.add(ring);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), glow('#fff2b0'));
          b.position.set(Math.cos(a) * 1.1, 0.15, Math.sin(a) * 1.1);
          c.add(b);
        }
        box(c, 0.05, 3, 0.05, 0, 1.5, 0, gold);
        c.position.set(0, 10.5, -9 + i * 9);
        g.add(c); chand.push(c);
      }
      screenPanel(g, 'ROYAL CHAMPIONSHIP', '#7f1d1d', '#d4a72c', 0, 6, -19.6, 0, 14, 3.2);
      screenPanel(g, 'ROYAL CHAMPIONSHIP', '#d4a72c', '#7f1d1d', 0, 6, 19.6, Math.PI, 14, 3.2);
      anim.push((t) => chand.forEach((c, i) => { c.rotation.y = t * 0.3 + i; c.position.y = 10.5 + Math.sin(t + i) * 0.05; }));
      break;
    }
    case 'tropical': {
      // palms
      const leaf = lam('#2f9e44'), trunk = lam('#8a5a2b');
      const palms: THREE.Group[] = [];
      const spots: [number, number][] = [[-19, -10], [-20, 4], [-19, 14], [19, -12], [20, 2], [19, 12], [-8, -26], [9, -27], [0, 28], [-12, 27]];
      for (const [px, pz] of spots) {
        const p = new THREE.Group();
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 7, 8), trunk);
        tr.position.y = 3.5; tr.rotation.z = 0.12; p.add(tr);
        for (let k = 0; k < 7; k++) {
          const l = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.6, 4), leaf);
          const a = (k / 7) * Math.PI * 2;
          l.position.set(Math.cos(a) * 1.4, 7.1, Math.sin(a) * 1.4);
          l.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
          p.add(l);
        }
        p.position.set(px, 0, pz);
        g.add(p); palms.push(p);
      }
      // roof canopy beams
      for (let i = 0; i < 7; i++) box(g, 36, 0.3, 0.4, 0, 9.5, -16 + i * 5.3, lam('#9a6a35'));
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) box(g, 0.5, 9.5, 0.5, s * 16.5, 4.75, -15 + i * 10, lam('#9a6a35'));
      box(g, 3.2, 3.2, 0.1, 18, 22, -50, glow('#fff0a0'));
      const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), glow('#fff2a8'));
      sun.position.set(25, 28, -70); g.add(sun);
      // string lights
      const bulbs: THREE.Mesh[] = [];
      for (let i = 0; i < 24; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), glow(['#ffd166', '#ff6b6b', '#4cc9f0'][i % 3]));
        b.position.set(-16 + i * 1.4, 8.6 - Math.sin((i / 23) * Math.PI) * 0.8, -18); g.add(b); bulbs.push(b);
      }
      screenPanel(g, 'TROPICAL OPEN', '#0ea5a4', '#f59e0b', 0, 5.5, -19.8, 0, 12, 3);
      anim.push((t) => palms.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.8 + i) * 0.03; }));
      void bulbs;
      break;
    }
    case 'cyber': {
      const rings: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(2 + i * 0.7, 0.06, 6, 40), glow(['#00ffd5', '#ff00aa', '#7c4dff'][i % 3]));
        r.position.set((i - 2) * 6, 8 + (i % 2) * 2, -6 + (i % 3) * 4);
        g.add(r); rings.push(r);
      }
      const cubes: THREE.Mesh[] = [];
      for (let i = 0; i < 14; i++) {
        const c = box(g, 0.6, 0.6, 0.6, (Math.random() - 0.5) * 30, 5 + Math.random() * 6, (Math.random() - 0.5) * 34, glow(['#00ffd5', '#ff00aa', '#c6ff00'][i % 3], 0.5));
        cubes.push(c);
      }
      for (const s of [-1, 1]) {
        box(g, 0.2, 0.2, 40, s * 8.4, 0.12, 0, glow('#7c4dff'));
        box(g, 0.15, 0.15, 36, s * 16.5, 4, 0, glow('#00ffd5'));
        box(g, 0.15, 0.15, 36, s * 16.5, 9, 0, glow('#ff00aa'));
      }
      // floor grid beyond court
      const grid = new THREE.GridHelper(60, 60, '#2a1a6a', '#150d3a');
      grid.position.y = 0.01; g.add(grid);
      screenPanel(g, 'CYBER LEAGUE', '#00ffd5', '#7c4dff', 0, 6, -19.6, 0, 16, 4);
      screenPanel(g, 'CYBER LEAGUE', '#ff00aa', '#00ffd5', 0, 6, 19.6, Math.PI, 16, 4);
      anim.push((t) => {
        rings.forEach((r, i) => { r.rotation.x = t * (0.4 + i * 0.1); r.rotation.y = t * 0.3; });
        cubes.forEach((c, i) => { c.rotation.set(t + i, t * 0.7, 0); c.position.y += Math.sin(t * 1.2 + i) * 0.002; });
      });
      break;
    }
    case 'mountain': {
      const rock = lam('#8d99a6'), snow = lam('#ffffff');
      for (let i = 0; i < 9; i++) {
        const h = 20 + (i % 4) * 8;
        const m = new THREE.Mesh(new THREE.ConeGeometry(14 + (i % 3) * 4, h, 6), rock);
        m.position.set(-70 + i * 18, h / 2 - 2, -80 - (i % 2) * 15);
        g.add(m);
        const cap = new THREE.Mesh(new THREE.ConeGeometry((14 + (i % 3) * 4) * 0.4, h * 0.36, 6), snow);
        cap.position.set(m.position.x, h * 0.82 - 2, m.position.z);
        g.add(cap);
      }
      const pine = lam('#1f5f3a'), bark = lam('#5b3a1e');
      for (let i = 0; i < 18; i++) {
        const side = i % 2 ? 1 : -1;
        const px = side * (21 + (i % 5) * 3), pz = -30 + i * 3.4;
        const t = new THREE.Group();
        box(t, 0.4, 1.5, 0.4, 0, 0.75, 0, bark);
        for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 - k * 0.35, 2.2, 7), pine); c.position.y = 2 + k * 1.3; t.add(c); }
        t.position.set(px, 0, pz); g.add(t);
      }
      const wood = lam('#7a4b22');
      for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 10, 8), wood); c.position.set(s * 16.5, 5, -16 + i * 8); g.add(c); }
      for (let i = 0; i < 6; i++) box(g, 36, 0.5, 0.6, 0, 10.5, -16 + i * 6.4, wood);
      box(g, 36, 0.4, 40, 0, 11, 0, lam('#6a4220'));
      screenPanel(g, 'MOUNTAIN PAVILION', '#1d4ed8', '#e5e7eb', 0, 6.2, 19.8, Math.PI, 12, 2.8);
      break;
    }
    case 'grand': {
      const spot: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(new THREE.ConeGeometry(2.2, 16, 16, 1, true), glow('#ffffff', 0.07));
        b.position.set(-12.5 + i * 5, 8.5, i % 2 ? 10 : -10);
        g.add(b); spot.push(b);
      }
      const sb = new THREE.Group();
      box(sb, 6, 2.2, 6, 0, 0, 0, lam('#10182c'));
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        const p = screenPanel(sb, 'GRAND FINAL', '#0ea5e9', '#6366f1', Math.sin(a) * 3.02, 0, Math.cos(a) * 3.02, a, 5.6, 1.9);
        void p;
      }
      sb.position.set(0, 10.5, 0); g.add(sb);
      for (let i = 0; i < 8; i++) {
        const c = ['#ef4444', '#3b82f6', '#fbbf24', '#ffffff'][i % 4];
        box(g, 0.08, 0.9, 3.5, -17 + 0.1, 2.3, -14 + i * 4, glow(c)); box(g, 0.08, 0.9, 3.5, 17 - 0.1, 2.3, -14 + i * 4, glow(c));
      }
      // ad boards
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) box(g, 0.1, 0.8, 3.8, s * 8.2, 0.4, -9.5 + i * 3.8, glow(['#0ea5e9', '#f97316', '#22c55e', '#e11d48', '#a855f7', '#facc15'][i], 0.9));
      }
      banners(g, ['#ef4444', '#3b82f6', '#fbbf24'], 8);
      anim.push((t) => spot.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.5 + i * 1.3) * 0.25; }));
      screenPanel(g, 'INTERNATIONAL OPEN', '#1d4ed8', '#0ea5e9', 0, 6, -19.6, 0, 14, 3.4);
      screenPanel(g, 'INTERNATIONAL OPEN', '#0ea5e9', '#1d4ed8', 0, 6, 19.6, Math.PI, 14, 3.4);
      break;
    }
  }

  return {
    group: g, bg, fog,
    update(t, dt, excite) {
      crowd.update(t, excite);
      for (const f of anim) f(t, dt, excite);
    },
  };
}
