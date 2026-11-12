import * as THREE from 'three';
import type { Look } from '../types';
import { newAnim, type RigHandle } from '../runtime';

const grad = (() => {
  const t = new THREE.DataTexture(Uint8Array.from([95, 175, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
export const toonGrad = grad;
const OUT = new THREE.MeshBasicMaterial({ color: 0x140a18, side: THREE.BackSide });
const G = {
  sphere: new THREE.SphereGeometry(1, 14, 10), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0), ico: new THREE.IcosahedronGeometry(1, 0), torus: new THREE.TorusGeometry(1, 0.18, 6, 18),
  cap: new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
};
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const texCache = new Map<string, THREE.CanvasTexture>();

function patternTex(kind: string, c1: number, c2: number) {
  const key = `${kind}-${c1}-${c2}`; const hit = texCache.get(key); if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d')!;
  g.fillStyle = hex(c1); g.fillRect(0, 0, 64, 64); g.fillStyle = hex(c2);
  if (kind === 'checker') { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 16, y * 16, 16, 16); }
  else if (kind === 'triangle') { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.moveTo(x * 16, y * 16); g.lineTo(x * 16 + 16, y * 16); g.lineTo(x * 16 + 8, y * 16 + 16); g.fill(); } }
  else if (kind === 'half') { g.fillRect(32, 0, 32, 64); }
  else if (kind === 'flame') { for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 16, 64); g.quadraticCurveTo(i * 16 + 4, 40, i * 16 + 8, 28); g.quadraticCurveTo(i * 16 + 12, 40, i * 16 + 16, 64); g.fill(); } }
  else if (kind === 'butterfly') { g.fillRect(0, 36, 64, 28); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(20, 20, 8, 5, 0.5, 0, 7); g.ellipse(44, 14, 8, 5, -0.5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t); return t;
}

export interface RigOpts { blade?: number; glow?: number; dual?: boolean; weapon?: string; outline?: boolean; shadow?: boolean; sword?: boolean }

type V3 = [number, number, number];
const lerpA = (o: number[], a: number[], b: number[], t: number) => { for (let i = 0; i < o.length; i++) o[i] = a[i] + (b[i] - a[i]) * t; };
const ease = (t: number) => { t = Math.min(1, Math.max(0, t)); return 1 - Math.pow(1 - t, 2.2); };
const easeIO = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
function key(out: number[], rest: number[], a: number[], b: number[], pt: number, t1 = 0.22, t2 = 0.5) {
  if (pt < t1) lerpA(out, rest, a, easeIO(pt / t1));
  else if (pt < t2) lerpA(out, a, b, ease((pt - t1) / (t2 - t1)));
  else lerpA(out, b, rest, easeIO((pt - t2) / (1 - t2)));
}

export function buildRig(look: Look, o: RigOpts = {}): RigHandle {
  const mats: THREE.Material[] = []; const cache = new Map<string, THREE.Material>();
  const M = (c: number, opt?: { basic?: boolean; double?: boolean; tex?: THREE.Texture }) => {
    const k = `${c}-${opt?.basic ? 'b' : 't'}-${opt?.tex?.uuid ?? ''}-${opt?.double ? 1 : 0}`; const h = cache.get(k); if (h) return h;
    const prm: Record<string, unknown> = { color: c }; if (opt?.tex) prm.map = opt.tex; const m = opt?.basic ? new THREE.MeshBasicMaterial(prm) : new THREE.MeshToonMaterial({ ...prm, gradientMap: grad, side: opt?.double ? THREE.DoubleSide : THREE.FrontSide });
    cache.set(k, m); mats.push(m); return m;
  };
  const P = (parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, pos: V3, sc: V3, rot?: V3, opt?: { basic?: boolean; noOut?: boolean; tex?: THREE.Texture; double?: boolean }) => {
    const m = new THREE.Mesh(geo, M(color, opt)); m.position.set(...pos); m.scale.set(...sc); if (rot) m.rotation.set(...rot);
    m.castShadow = !!o.shadow; parent.add(m);
    if (o.outline && !opt?.noOut && !opt?.basic) { const ol = new THREE.Mesh(geo, OUT); ol.scale.setScalar(1.09); m.add(ol); }
    return m;
  };
  const grp = (parent: THREE.Object3D, pos: V3) => { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; };
  const has = (e: string) => look.extras.includes(e);

  const root = new THREE.Group(); const body = grp(root, [0, 0, 0]);
  root.scale.setScalar(look.scale);
  const skin = look.skin; const demon = !!look.demon;

  if (has('dummy') || has('boulder')) {
    // static training targets
    if (has('boulder')) {
      const r = P(body, G.ico, 0x7a7a82, [0, 1.1, 0], [1.5, 1.2, 1.4]); r.rotation.y = 0.5; P(body, G.ico, 0x6a6a72, [0.7, 0.5, 0.5], [0.8, 0.6, 0.7]);
      P(body, G.box, 0xd8d0c0, [0, 1.8, 0], [2.4, 0.08, 0.08], undefined, { noOut: true }); // shimenawa rope
    } else {
      P(body, G.cyl, 0x8a6a40, [0, 0.9, 0], [0.16, 0.9, 0.16]); P(body, G.box, 0xb08a50, [0, 1.35, 0], [0.9, 0.12, 0.12]);
      P(body, G.sphere, 0xc8a060, [0, 1.65, 0], [0.22, 0.26, 0.22]); P(body, G.cyl, 0xa07a44, [0, 0.1, 0], [0.5, 0.1, 0.5]);
      P(body, G.cyl, 0xd03030, [0, 1.1, 0.17], [0.15, 0.05, 0.02], [Math.PI / 2, 0, 0], { noOut: true });
    }
    const dummyHandle: RigHandle = {
      group: root, anim: newAnim(), swordTip: root,
      update(_dt, time) { const a = dummyHandle.anim; const h = a.pose === 'hurt' ? Math.sin((1 - a.pt) * 18) * 0.12 * (1 - a.pt) : 0; body.rotation.z = h; body.rotation.x = h * 0.4; if (a.pose === 'dead') { body.scale.setScalar(Math.max(0.01, 1 - a.pt)); } else body.scale.setScalar(1); void time; },
      flash(v) { mats.forEach((m) => { (m as THREE.MeshToonMaterial).emissive?.setRGB(v, v * 0.4, v * 0.2); }); },
      setSwordVisible() {}, dispose() { mats.forEach((m) => m.dispose()); },
    };
    return dummyHandle;
  }

  const hips = grp(body, [0, 0.8, 0]);
  // ---- legs
  const mkLeg = (x: number) => {
    const l = grp(hips, [x, 0, 0]);
    P(l, G.cyl, look.pants, [0, -0.4, 0], [0.095, 0.42, 0.095]);
    P(l, G.box, 0xe8e0d0, [0, -0.78, 0.04], [0.14, 0.07, 0.24], undefined, { noOut: true });
    P(l, G.box, 0x1a1a1e, [0, -0.83, 0.05], [0.15, 0.04, 0.26], undefined, { noOut: true });
    return l;
  };
  const legL = mkLeg(0.11); const legR = mkLeg(-0.11);
  // ---- torso
  const torso = grp(hips, [0, 0, 0]);
  const barechest = has('bare');
  P(torso, G.cyl, barechest ? skin : look.outfit, [0, 0.28, 0], [0.22, 0.28, 0.14]);
  P(torso, G.box, look.sash ?? (barechest ? 0x2a2a30 : 0x2a2a34), [0, 0.02, 0], [0.26, 0.08, 0.17]);
  if (!barechest && !demon) P(torso, G.box, 0xf4f4f4, [0, 0.55, 0.03], [0.17, 0.045, 0.1], undefined, { noOut: true });
  if (has('fur')) P(torso, G.cyl, 0xe0e0e0, [0, 0.0, 0], [0.28, 0.1, 0.2]);
  if (has('scars')) { P(torso, G.box, 0xa04040, [-0.06, 0.32, 0.14], [0.2, 0.012, 0.01], [0, 0, 0.6], { noOut: true }); P(torso, G.box, 0xa04040, [0.08, 0.22, 0.14], [0.2, 0.012, 0.01], [0, 0, -0.5], { noOut: true }); }
  if (has('tattoo')) { for (let i = 0; i < 3; i++) P(torso, G.box, 0x3a8aff, [0, 0.14 + i * 0.14, 0.14], [0.2, 0.012, 0.01], undefined, { noOut: true, basic: true }); }
  if (has('beads')) { P(torso, G.torus, 0x6a3a1a, [0, 0.54, 0.05], [0.2, 0.2, 0.2], [Math.PI / 2, 0, 0]); }
  if (has('armor')) { P(torso, G.sphere, 0x555560, [0.28, 0.5, 0], [0.12, 0.08, 0.14]); P(torso, G.sphere, 0x555560, [-0.28, 0.5, 0], [0.12, 0.08, 0.14]); }
  if (has('drums')) { [0.3, 0.1, -0.1].forEach((y, i) => P(torso, G.cyl, 0xd0603a, [0.05 * i, y + 0.15, 0.2], [0.14, 0.05, 0.14], [Math.PI / 2, 0, 0.3 * i])); }
  if (has('pot')) { P(torso, G.sphere, 0x3a8a4a, [0, 0.12, 0], [0.34, 0.4, 0.3]); P(torso, G.torus, 0xd04a8a, [0, 0.3, 0], [0.26, 0.26, 0.26], [Math.PI / 2, 0, 0]); }
  // haori
  let haoriBack: THREE.Group | null = null; let haoriL: THREE.Group | null = null; let haoriR: THREE.Group | null = null;
  const sleeveCol = look.haori ?? look.outfit; let sleeveTex: THREE.Texture | undefined;
  if (look.haori !== undefined && !demon || (look.haori !== undefined && look.pattern !== 'none')) {
    const tex = look.pattern && look.pattern !== 'none' && look.pattern !== 'plain' ? patternTex(look.pattern, look.haori!, look.haori2 ?? 0x111111) : undefined;
    sleeveTex = tex; const hc = look.haori!;
    haoriBack = grp(torso, [0, 0.5, -0.145]); P(haoriBack, G.box, hc, [0, -0.42, 0], [0.5, 0.82, 0.04], undefined, { tex, double: true });
    haoriL = grp(torso, [0.2, 0.5, 0.125]); P(haoriL, G.box, hc, [0, -0.4, 0], [0.16, 0.8, 0.04], undefined, { tex, double: true });
    haoriR = grp(torso, [-0.2, 0.5, 0.125]); P(haoriR, G.box, hc, [0, -0.4, 0], [0.16, 0.8, 0.04], undefined, { tex, double: true });
  }
  if (has('spiderlegs')) { for (let i = 0; i < 4; i++) { const s = i < 2 ? 1 : -1; P(torso, G.cyl, 0xe8e0e8, [s * 0.4, 0.5, -0.3 - (i % 2) * 0.1], [0.02, 0.5, 0.02], [0.8, 0, s * (0.9 + (i % 2) * 0.4)], { noOut: true }); } }
  if (has('tendrils')) { for (let i = 0; i < 4; i++) P(torso, G.cyl, 0xa01830, [(i - 1.5) * 0.18, 0.4, -0.2], [0.035, 0.6, 0.035], [0.6, 0, (i - 1.5) * 0.4], { noOut: true }); }
  if (has('obi')) { for (let i = 0; i < 3; i++) P(torso, G.box, 0xff5a8a, [(i - 1) * 0.3, 0.2, -0.2], [0.06, 1.0, 0.01], [0.5, 0, (i - 1) * 0.5], { basic: true, noOut: true }); }
  // ---- neck + head
  P(torso, G.cyl, skin, [0, 0.62, 0], [0.07, 0.06, 0.07], undefined, { noOut: true });
  const headPivot = grp(torso, [0, 0.82, 0]); const head = grp(headPivot, [0, 0, 0]);
  P(head, G.sphere, skin, [0, 0, 0], [0.235, 0.25, 0.23]);
  // face
  const eyeG = grp(head, [0, 0.01, 0.185]); const eyeMeshes: THREE.Object3D[] = [];
  const browMeshes: THREE.Mesh[] = [];
  const mouth = P(head, G.box, 0x6a2a2a, [0, -0.1, 0.215], [0.05, 0.012, 0.01], undefined, { noOut: true, basic: true });
  const showEyes = !has('boarmask') && !has('tengu') && !has('hyottoko');
  const eyeLook = look.eye;
  for (const s of [-1, 1]) {
    const e = grp(eyeG, [s * 0.088, 0, 0.03]); eyeMeshes.push(e);
    if (!showEyes) { e.visible = false; continue; }
    P(e, G.sphere, demon ? eyeLook : 0xffffff, [0, 0, 0], [0.058, 0.07, 0.02], undefined, { basic: true, noOut: true });
    P(e, G.sphere, demon ? 0x220008 : eyeLook, [0, -0.005, 0.014], [demon ? 0.012 : 0.04, demon ? 0.06 : 0.058, 0.01], undefined, { basic: true, noOut: true });
    if (!demon) { P(e, G.sphere, 0x141018, [0, -0.005, 0.02], [0.02, 0.03, 0.006], undefined, { basic: true, noOut: true }); P(e, G.sphere, 0xffffff, [0.014, 0.02, 0.026], [0.011, 0.011, 0.005], undefined, { basic: true, noOut: true }); }
    const br = P(head, G.box, look.hair === 0xf0f0f6 || look.hair === 0xf0f0f5 ? 0xb0b0b8 : look.hair, [s * 0.088, 0.115, 0.205], [0.06, 0.014, 0.012], [0, 0, 0], { noOut: true });
    if (!showEyes) br.visible = false;
    browMeshes.push(br);
  }
  if (has('sixeyes') && showEyes) for (const s of [-1, 1]) P(head, G.sphere, 0xff2030, [s * 0.088, 0.075, 0.2], [0.03, 0.022, 0.01], undefined, { basic: true, noOut: true });
  if (has('eyes3') && showEyes) P(head, G.sphere, 0xff70ff, [0, 0.14, 0.195], [0.03, 0.03, 0.01], undefined, { basic: true, noOut: true });
  // ears
  P(head, G.sphere, skin, [0.235, -0.01, 0], [0.04, 0.06, 0.03], undefined, { noOut: true }); P(head, G.sphere, skin, [-0.235, -0.01, 0], [0.04, 0.06, 0.03], undefined, { noOut: true });
  // hair
  const hc = look.hair; const tip = look.tip ?? look.hair; const hs = look.hairStyle;
  if (hs !== 'none' && !has('boarmask')) {
    P(head, G.cap, hc, [0, 0.015, -0.02], [0.265, 0.27, 0.26], [-0.45, 0, 0]);
    const spike = (x: number, y: number, z: number, len: number, w: number, rx: number, rz: number, col = hc, tipCol?: number) => {
      P(head, G.cone, col, [x, y, z], [w, len, w], [rx, 0, rz]);
      if (tipCol !== undefined) P(head, G.cone, tipCol, [x + Math.sin(-rz) * len * 0.6, y + Math.cos(rz) * len * 0.6, z + Math.sin(rx) * len * 0.6], [w * 0.55, len * 0.5, w * 0.55], [rx, 0, rz], { noOut: true });
    };
    if (hs === 'spiky' || hs === 'wild' || hs === 'flame') {
      const n = hs === 'wild' ? 11 : 8; const len = hs === 'flame' ? 0.36 : hs === 'wild' ? 0.3 : 0.26;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const rr = 0.2; spike(Math.cos(a) * rr, 0.12 + (i % 2) * 0.04, Math.sin(a) * rr - 0.04, len * (0.8 + (i % 3) * 0.2), 0.065, Math.sin(a) * 0.6, -Math.cos(a) * 0.7, hc, hs === 'flame' ? tip : undefined); }
      spike(0, 0.24, -0.05, len, 0.08, -0.2, 0, hc, hs === 'flame' ? tip : undefined);
      for (let i = 0; i < 4; i++) spike((i - 1.5) * 0.09, 0.2, 0.2, 0.2, 0.05, 2.6 - (i % 2) * 0.2, (i - 1.5) * 0.15); // bangs
    }
    if (hs === 'short') { for (let i = 0; i < 5; i++) spike((i - 2) * 0.085, 0.2, 0.2, 0.15, 0.05, 2.5, (i - 2) * 0.12, hc); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; spike(Math.cos(a) * 0.22, 0.12, Math.sin(a) * 0.2 - 0.05, 0.17, 0.06, Math.sin(a) * 0.9, -Math.cos(a) * 0.9, hc, look.tip ? tip : undefined); } }
    if (hs === 'long') { P(head, G.cyl, hc, [0, -0.3, -0.18], [0.2, 0.46, 0.08]); P(head, G.cyl, tip, [0, -0.7, -0.18], [0.17, 0.12, 0.06], undefined, { noOut: true }); for (const s of [-1, 1]) P(head, G.cyl, hc, [s * 0.22, -0.12, 0.03], [0.035, 0.28, 0.035]); for (let i = 0; i < 5; i++) spike((i - 2) * 0.085, 0.2, 0.2, 0.15, 0.05, 2.5, (i - 2) * 0.12, hc); }
    if (hs === 'pony') { P(head, G.cyl, hc, [0, 0.08, -0.34], [0.07, 0.42, 0.07], [0.8, 0, 0]); P(head, G.torus, 0xf0f0f0, [0, 0.18, -0.28], [0.08, 0.08, 0.08], undefined, { noOut: true }); for (let i = 0; i < 5; i++) spike((i - 2) * 0.085, 0.2, 0.2, 0.18, 0.05, 2.5, (i - 2) * 0.15, hc); }
    if (hs === 'bob') { P(head, G.cyl, hc, [0, -0.1, -0.1], [0.27, 0.2, 0.25]); for (let i = 0; i < 5; i++) spike((i - 2) * 0.085, 0.2, 0.2, 0.14, 0.05, 2.5, (i - 2) * 0.12, hc); }
  }
  if (has('scar')) P(head, G.box, 0xb03030, [0.1, 0.14, 0.212], [0.05, 0.05, 0.01], [0, 0, 0.5], { noOut: true, basic: true });
  if (has('earrings')) for (const s of [-1, 1]) P(head, G.box, s > 0 ? 0xe8e8f0 : 0xd04040, [s * 0.255, -0.1, 0], [0.025, 0.07, 0.01], undefined, { noOut: true, basic: true });
  if (has('headband')) { P(head, G.torus, 0xf0f0f0, [0, 0.12, 0], [0.24, 0.24, 0.24], [Math.PI / 2, 0, 0], { noOut: true }); P(head, G.sphere, 0x40d0ff, [0, 0.14, 0.24], [0.04, 0.04, 0.02], undefined, { basic: true, noOut: true }); }
  if (has('butterflyclip')) { P(head, G.box, 0xd0a0ff, [0.18, 0.18, 0.0], [0.07, 0.05, 0.01], [0, 0, 0.4], { basic: true, noOut: true }); P(head, G.box, 0xd0a0ff, [0.26, 0.2, 0.0], [0.07, 0.05, 0.01], [0, 0, -0.3], { basic: true, noOut: true }); }
  if (has('bandage')) P(head, G.cyl, 0xf0f0f0, [0, -0.1, 0.02], [0.215, 0.07, 0.2], undefined, { noOut: true });
  if (has('snake')) { P(torso, G.torus, 0xe8e8e8, [0, 0.58, 0], [0.2, 0.2, 0.2], [Math.PI / 2, 0, 0], { noOut: true }); P(torso, G.sphere, 0xe8e8e8, [0.22, 0.58, 0.1], [0.05, 0.04, 0.06]); }
  if (has('bamboo')) { P(head, G.cyl, 0x6aa84a, [0, -0.1, 0.22], [0.035, 0.065, 0.035], [0, 0, Math.PI / 2]); }
  if (has('bow')) { P(head, G.box, 0xff8aa8, [0, 0.0, -0.27], [0.12, 0.06, 0.03], undefined, { noOut: true }); }
  if (has('hat')) { P(head, G.cyl, 0x14141a, [0, 0.28, 0], [0.18, 0.15, 0.18]); P(head, G.cyl, 0x14141a, [0, 0.13, 0], [0.3, 0.02, 0.3]); }
  if (has('horns')) for (const s of [-1, 1]) P(head, G.cone, 0xece0c0, [s * 0.1, 0.2, 0.15], [0.04, 0.2, 0.04], [0.5, 0, -s * 0.3]);
  if (has('tusks')) for (const s of [-1, 1]) P(head, G.cone, 0xf0f0e0, [s * 0.05, -0.12, 0.2], [0.02, 0.07, 0.02], [Math.PI, 0, 0], { noOut: true });
  if (has('old')) P(head, G.cone, 0xe8e8ee, [0, -0.1, 0.2], [0.1, 0.3, 0.06], [Math.PI, 0, 0]);
  if (has('boarmask')) { P(head, G.sphere, 0x6a7a96, [0, 0, 0.02], [0.3, 0.3, 0.3]); P(head, G.cyl, 0x58688a, [0, -0.07, 0.3], [0.1, 0.1, 0.12], [Math.PI / 2, 0, 0]); for (const s of [-1, 1]) { P(head, G.cone, 0x58688a, [s * 0.2, 0.2, 0], [0.09, 0.2, 0.06], [0, 0, -s * 0.4]); P(head, G.sphere, 0xffe060, [s * 0.1, 0.05, 0.28], [0.06, 0.04, 0.02], undefined, { basic: true, noOut: true }); } P(head, G.cone, 0x14141a, [0, 0.25, -0.05], [0.12, 0.2, 0.12]); }
  if (has('tengu')) { P(head, G.sphere, 0xc8402a, [0, 0, 0.02], [0.3, 0.3, 0.3]); P(head, G.cone, 0xc8402a, [0, -0.02, 0.28], [0.06, 0.35, 0.06], [Math.PI / 2, 0, 0]); for (const s of [-1, 1]) P(head, G.sphere, 0xffffff, [s * 0.1, 0.06, 0.26], [0.05, 0.03, 0.02], undefined, { basic: true, noOut: true }); }
  if (has('hyottoko')) { P(head, G.sphere, 0xd8c8a0, [0, 0, 0.02], [0.28, 0.3, 0.3]); P(head, G.sphere, 0x222222, [0.08, 0.06, 0.28], [0.03, 0.02, 0.01], undefined, { basic: true, noOut: true }); P(head, G.sphere, 0x222222, [-0.08, 0.06, 0.28], [0.03, 0.02, 0.01], undefined, { basic: true, noOut: true }); P(head, G.cone, 0xc8a070, [0, 0.28, 0.1], [0.08, 0.15, 0.08]); }
  if (has('pot')) P(head, G.sphere, 0x3a8a4a, [0, 0.0, 0], [0.01, 0.01, 0.01]);

  // ---- arms
  const mkArm = (s: number) => {
    const a = grp(torso, [s * 0.3, 0.52, 0]); const big = has('muscle') ? 1.3 : 1;
    P(a, G.cyl, barechest ? skin : sleeveCol, [0, -0.22, 0], [0.075 * big, 0.26, 0.075 * big], undefined, { tex: sleeveTex });
    P(a, G.cyl, skin, [0, -0.5, 0], [0.06 * big, 0.12, 0.06 * big], undefined, { noOut: true });
    P(a, G.sphere, skin, [0, -0.62, 0], [0.065, 0.065, 0.065], undefined, { noOut: true });
    if (has('claws') || demon) for (let i = -1; i <= 1; i++) P(a, G.cone, 0x2a2024, [i * 0.03, -0.66, 0.02], [0.012, 0.09, 0.012], [Math.PI, 0, 0], { noOut: true });
    return a;
  };
  const armL = mkArm(1); const armR = mkArm(-1);
  if (has('hands')) { const hg = grp(root, [0, 1.3, 0]); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const h = grp(hg, [Math.cos(a) * 0.9, (i % 2) * 0.3, Math.sin(a) * 0.9]); P(h, G.sphere, 0x8a8a98, [0, 0, 0], [0.18, 0.2, 0.1]); for (let k = -2; k <= 2; k++) P(h, G.cone, 0x7a7a88, [k * 0.07, 0.15, 0], [0.025, 0.16, 0.025], [0, 0, -k * 0.1]); h.rotation.y = -a; } (root.userData as { hands: THREE.Group }).hands = hg; }
  if (has('fan')) { const f = P(armL, G.box, 0xf0f8ff, [0, -0.72, 0.1], [0.3, 0.02, 0.2], [0, 0, 0.3], { noOut: true }); f.rotation.x = 0.2; }
  if (has('sickles')) { P(armR, G.cone, 0xb0b0b8, [0, -0.7, 0.05], [0.04, 0.3, 0.04], [2.2, 0, 0]); }

  // ---- sword(s)
  const swordTip = new THREE.Object3D(); let swordGroup: THREE.Group | null = null; let sword2: THREE.Group | null = null;
  const bladeCol = o.blade ?? 0x9aa4b0; const glow = o.glow ?? bladeCol; const wk = o.weapon ?? 'sword';
  const mkSword = (arm: THREE.Group, withTip: boolean) => {
    const g = grp(arm, [0, -0.64, 0.03]); g.rotation.x = 2.0;
    const len = wk === 'whip' ? 1.5 : wk === 'cleaver' ? 0.8 : 1.0; const wd = wk === 'cleaver' ? 0.12 : wk === 'whip' ? 0.025 : 0.045;
    P(g, G.cyl, 0x1a1418, [0, 0.07, 0], [0.022, 0.1, 0.022], undefined, { noOut: true });
    P(g, G.cyl, wk === 'whip' ? 0xd0a040 : 0xc8a850, [0, 0.18, 0], [0.065, 0.014, 0.065], undefined, { noOut: true });
    const blade = P(g, G.box, bladeCol, [0, 0.2 + len / 2, 0], [wd, len, 0.014], undefined, { noOut: true });
    if (wk === 'serrated') for (let i = 0; i < 5; i++) P(g, G.cone, bladeCol, [0.03, 0.4 + i * 0.16, 0], [0.03, 0.07, 0.014], [0, 0, -Math.PI / 2], { noOut: true });
    const em = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    em.scale.set(wd * 1.8, len * 1.02, 0.03); em.position.set(0, 0.2 + len / 2, 0); g.add(em); mats.push(em.material as THREE.Material);
    void blade;
    if (wk === 'flail') { P(g, G.sphere, 0x666670, [0, 0.4 + len, 0], [0.16, 0.16, 0.16]); }
    if (withTip) { swordTip.position.set(0, 0.2 + len, 0); g.add(swordTip); }
    return g;
  };
  if (o.sword !== false && !demon && !has('dummy')) {
    swordGroup = mkSword(armR, true);
    if (o.dual) sword2 = mkSword(armL, false);
  } else { armR.add(swordTip); swordTip.position.set(0, -0.8, 0.3); }

  // ---- animation state
  const anim = newAnim();
  const cur = { aR: [0.1, 0, -0.1], aL: [0.1, 0, 0.1], torso: [0, 0, 0], hipsX: 0, hipsY: 0, headX: 0, rootYaw: 0, rootX: 0, rootY: 0, legL: 0, legR: 0, hair: 0 };
  const tg = { aR: [0, 0, 0], aL: [0, 0, 0], torso: [0, 0, 0], hipsX: 0, hipsY: 0, headX: 0, rootYaw: 0, rootX: 0, rootY: 0, legL: 0, legR: 0 };
  let phase = Math.random() * 10; let w = 0; let blinkT = 2 + Math.random() * 3; let blink = 0; let flashV = 0; let flashTarget = 0;
  const restR = [0.12, 0, -0.12]; const restL = [0.12, 0, 0.12];
  const tmpA = [0, 0, 0]; const tmpB = [0, 0, 0]; const tmpC = [0, 0, 0];
  const dual = !!o.dual;

  const handle: RigHandle = {
    group: root, anim, swordTip,
    setSwordVisible(v) { if (swordGroup) swordGroup.visible = v; if (sword2) sword2.visible = v; },
    flash(v) { flashTarget = v; },
    update(dt, time) {
      const a = anim; const pt = a.pt;
      w += (Math.min(1.5, a.walk) - w) * Math.min(1, dt * 10);
      phase += dt * (3.2 + w * 5.2) * (a.sprint ? 1.25 : 1);
      const sn = Math.sin(phase); const idle = Math.sin(time * 1.9 + phase * 0.0);
      // defaults
      tg.aR.splice(0, 3, ...restR); tg.aL.splice(0, 3, ...restL); tg.torso.splice(0, 3, 0, 0, 0);
      tg.hipsX = 0; tg.hipsY = 0; tg.headX = 0; tg.rootYaw = 0; tg.rootX = 0; tg.rootY = 0; tg.legL = 0; tg.legR = 0;
      let k = 14; let expr = a.expr; const lean = w * (a.sprint ? 0.32 : 0.12);
      // locomotion
      tg.legL = sn * 0.85 * w; tg.legR = -sn * 0.85 * w; tg.hipsY = -Math.abs(sn) * 0.04 * w + idle * 0.006;
      tg.torso[0] = lean + idle * 0.012; tg.aR[0] = restR[0] + sn * 0.6 * w; tg.aL[0] = restL[0] - sn * 0.6 * w;
      tg.aR[2] = -0.12 - w * 0.05; tg.aL[2] = 0.12 + w * 0.05; tg.headX = -lean * 0.7 + idle * 0.02;
      if (a.sprint) { tg.aR[0] = -0.2 + sn * 0.5; tg.aL[0] = 0.3 - sn * 0.5; }
      const atk = (v: number) => {
        k = 30;
        const R = tmpA; const L = tmpB; const tw = tmpC;
        if (v === 0) { key(R, restR, [-1.5, 0.3, -1.3], [-1.4, -0.3, 1.3], pt); key(L, restL, dual ? [-1.4, -0.3, 1.3] : [-0.5, 0, 0.5], dual ? [-1.4, 0.3, -1.3] : [-0.5, 0, 0.9], pt); key(tw, [0, 0, 0], [0.15, -0.65, 0], [0.2, 0.65, 0], pt); }
        else if (v === 1) { key(R, restR, [-1.4, -0.2, 1.2], [-1.5, 0.3, -1.4], pt); key(L, restL, dual ? [-1.4, 0.2, -1.2] : [-0.4, 0, 0.3], dual ? [-1.5, -0.3, 1.4] : [-0.4, 0, 0.5], pt); key(tw, [0, 0, 0], [0.15, 0.65, 0], [0.2, -0.65, 0], pt); }
        else if (v === 2) { key(R, restR, [-3.0, 0, -0.3], [-0.5, 0, 0], pt, 0.28, 0.5); key(L, restL, [-2.7, 0, 0.3], [-0.7, 0, 0.2], pt, 0.28, 0.5); key(tw, [0, 0, 0], [-0.25, 0, 0], [0.55, 0, 0], pt, 0.28, 0.5); }
        else { key(R, restR, [-1.5, 0, -1.5], [-1.5, 0, -1.5], pt, 0.15, 0.7); key(L, restL, [-1.5, 0, 1.5], [-1.5, 0, 1.5], pt, 0.15, 0.7); key(tw, [0, 0, 0], [0.2, 0, 0], [0.2, 0, 0], pt, 0.15, 0.7); tg.rootYaw = easeIO((pt - 0.12) / 0.55) * Math.PI * 2; }
        tg.aR.splice(0, 3, ...R); tg.aL.splice(0, 3, ...L); tg.torso.splice(0, 3, ...tw); tg.legL = -0.5; tg.legR = 0.4; tg.hipsY = -0.05;
        expr = 'angry';
      };
      switch (a.pose) {
        case 'attack': atk(a.variant); break;
        case 'heavy': {
          k = 26; key(tmpA, restR, [-3.1, 0, -0.2], [-0.25, 0, 0.05], pt, 0.5, 0.68); key(tmpB, restL, [-2.8, 0, 0.3], [-0.4, 0, 0.1], pt, 0.5, 0.68); key(tmpC, [0, 0, 0], [-0.35, 0, 0], [0.7, 0, 0], pt, 0.5, 0.68);
          tg.aR.splice(0, 3, ...tmpA); tg.aL.splice(0, 3, ...tmpB); tg.torso.splice(0, 3, ...tmpC); tg.legL = -0.6; tg.legR = 0.5; tg.hipsY = -0.12; expr = 'angry'; break;
        }
        case 'thrust': k = 22; tg.aR.splice(0, 3, -1.55, 0.1, -0.1); tg.aL.splice(0, 3, dual ? -1.55 : -1.0, -0.1, 0.4); tg.torso[0] = 0.55; tg.legL = 0.9; tg.legR = -0.9; tg.hipsY = -0.12; tg.headX = -0.4; expr = 'angry'; break;
        case 'spin': k = 24; tg.aR.splice(0, 3, -1.5, 0, -1.4); tg.aL.splice(0, 3, -1.5, 0, 1.4); tg.torso[0] = 0.2; tg.rootYaw = pt * Math.PI * 2 * 2.5; tg.legL = -0.4; tg.legR = 0.4; tg.hipsY = -0.06; expr = 'angry'; break;
        case 'skill': { k = 26; tg.aR.splice(0, 3, -1.9 + Math.sin(pt * 12) * 0.5, 0, -0.8); tg.aL.splice(0, 3, dual ? -1.9 : -0.9, 0, dual ? 0.8 : 0.5); tg.torso[1] = Math.sin(pt * 14) * 0.5; tg.torso[0] = 0.3; tg.legL = 0.5; tg.legR = -0.5; tg.hipsY = -0.1; expr = 'angry'; break; }
        case 'cast': k = 18; tg.aR.splice(0, 3, -2.8, 0, -0.5); tg.aL.splice(0, 3, -2.8, 0, 0.5); tg.torso[0] = -0.25; tg.headX = -0.2; expr = 'angry'; break;
        case 'dodge': k = 40; tg.rootX = -easeIO(pt) * Math.PI * 2; tg.hipsY = -0.25; tg.aR.splice(0, 3, -0.8, 0, -0.5); tg.aL.splice(0, 3, -0.8, 0, 0.5); tg.legL = 0.7; tg.legR = 0.7; tg.rootY = 0.2 * Math.sin(pt * Math.PI); break;
        case 'guard': k = 24; tg.aR.splice(0, 3, -1.95, 0.0, -0.25); tg.aL.splice(0, 3, -1.7, 0.0, 0.55); tg.torso[1] = 0.3; tg.torso[0] = 0.12; tg.hipsY = -0.07; tg.legL = 0.3; tg.legR = -0.35; expr = 'angry'; break;
        case 'hurt': k = 30; tg.torso[0] = -0.45; tg.headX = -0.4; tg.aR.splice(0, 3, -0.2, 0, -1.0); tg.aL.splice(0, 3, -0.2, 0, 1.0); tg.hipsY = -0.05; expr = 'hurt'; break;
        case 'stagger': k = 12; tg.torso[0] = 0.25 + Math.sin(time * 6) * 0.1; tg.torso[2] = Math.sin(time * 5) * 0.2; tg.headX = 0.3; tg.aR.splice(0, 3, 0.3, 0, -0.5); tg.aL.splice(0, 3, 0.3, 0, 0.5); tg.hipsY = -0.08; expr = 'hurt'; break;
        case 'dead': k = 9; tg.rootX = -easeIO(pt * 1.4) * (Math.PI / 2); tg.rootY = -0.0; tg.aR.splice(0, 3, -0.2, 0, -1.0); tg.aL.splice(0, 3, -0.2, 0, 1.0); tg.headX = -0.3; expr = 'hurt'; break;
        case 'air': k = 18; tg.legL = -0.7; tg.legR = 0.35; tg.aR.splice(0, 3, -0.6, 0, -1.0); tg.aL.splice(0, 3, -0.6, 0, 1.0); tg.torso[0] = 0.1; break;
        case 'intro': k = 12; tg.aR.splice(0, 3, -0.4, 0, -0.9); tg.aL.splice(0, 3, -0.4, 0, 0.9); tg.torso[0] = -0.15; tg.headX = -0.1; expr = 'angry'; break;
        default: break;
      }
      const f = 1 - Math.exp(-dt * k);
      for (let i = 0; i < 3; i++) { cur.aR[i] += (tg.aR[i] - cur.aR[i]) * f; cur.aL[i] += (tg.aL[i] - cur.aL[i]) * f; cur.torso[i] += (tg.torso[i] - cur.torso[i]) * f; }
      cur.hipsY += (tg.hipsY - cur.hipsY) * f; cur.headX += (tg.headX - cur.headX) * f; cur.legL += (tg.legL - cur.legL) * f; cur.legR += (tg.legR - cur.legR) * f;
      cur.rootYaw = tg.rootYaw; cur.rootX = a.pose === 'dodge' || a.pose === 'dead' ? tg.rootX : cur.rootX + (tg.rootX - cur.rootX) * f; cur.rootY += (tg.rootY - cur.rootY) * f;
      armR.rotation.set(cur.aR[0], cur.aR[1], cur.aR[2]); armL.rotation.set(cur.aL[0], cur.aL[1], cur.aL[2]);
      torso.rotation.set(cur.torso[0], cur.torso[1], cur.torso[2]); head.rotation.x = cur.headX;
      hips.position.y = 0.8 + cur.hipsY; legL.rotation.x = cur.legL; legR.rotation.x = cur.legR;
      body.rotation.y = cur.rootYaw; body.rotation.x = cur.rootX; body.position.y = cur.rootY + (a.pose === 'dodge' ? 0.5 * Math.sin(pt * Math.PI) : 0);
      if (a.pose === 'dead') body.position.y = -Math.min(1, pt * 1.2) * 0.55 + 0.4 * Math.min(1, pt * 1.4);
      // cloth
      const sw = 0.08 + w * 0.5 + Math.sin(time * 2 + phase * 0.3) * 0.03 + (a.pose === 'attack' || a.pose === 'skill' ? 0.4 : 0);
      if (haoriBack) haoriBack.rotation.x = sw; if (haoriL) haoriL.rotation.x = -sw * 0.25; if (haoriR) haoriR.rotation.x = -sw * 0.25;
      const hd = (root.userData as { hands?: THREE.Group }).hands; if (hd) { hd.rotation.y += dt * 0.8; hd.position.y = 1.3 + Math.sin(time * 2) * 0.1; }
      // face
      blinkT -= dt; if (blinkT < 0) { blink = 0.12; blinkT = 2 + Math.random() * 3.5; } blink = Math.max(0, blink - dt);
      const eyeY = blink > 0 ? 0.1 : expr === 'hurt' ? 0.45 : expr === 'happy' ? 0.55 : expr === 'angry' ? 0.8 : 1;
      eyeMeshes.forEach((e) => { e.scale.y += (eyeY - e.scale.y) * 0.4; });
      browMeshes.forEach((b, i) => { const s = i === 0 ? -1 : 1; const tz = expr === 'angry' ? -s * 0.45 : expr === 'hurt' ? s * 0.35 : 0; b.rotation.z += (tz - b.rotation.z) * 0.3; b.position.y += ((expr === 'angry' ? 0.1 : 0.115) - b.position.y) * 0.3; });
      mouth.scale.y = expr === 'angry' || expr === 'hurt' ? 0.04 : 0.012; mouth.scale.x = expr === 'happy' ? 0.08 : 0.05;
      // flash
      flashV += (flashTarget - flashV) * Math.min(1, dt * 18); flashTarget *= Math.max(0, 1 - dt * 9);
      if (flashV > 0.01 || flashV !== 0) {
        const v = flashV < 0.01 ? 0 : flashV;
        mats.forEach((m) => { const mm = m as THREE.MeshToonMaterial; if (mm.emissive) mm.emissive.setRGB(v, v * 0.35, v * 0.35); });
        if (v === 0) flashV = 0;
      }
    },
    dispose() { mats.forEach((m) => m.dispose()); },
  };
  return handle;
}
