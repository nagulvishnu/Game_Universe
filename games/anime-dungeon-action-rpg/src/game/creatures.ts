import * as THREE from 'three';
import { G, M, grp, mat, glowMat, addMat, bladeGeo } from './models';
import type { EnemyDef, BossDef } from './data';

export interface Rig {
  root: THREE.Group; body: THREE.Group; head: THREE.Object3D | null; armR: THREE.Group | null; armL: THREE.Group | null;
  legs: THREE.Group[]; wings: THREE.Group[]; orbit: THREE.Object3D[]; segs: THREE.Object3D[]; tpl: string; height: number; radius: number; hover: number;
  flash: THREE.Mesh[]; tip: THREE.Object3D | null;
}
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
function mk(tpl: string, height: number, radius: number, hover = 0): Rig {
  const root = new THREE.Group(), body = grp(root, [0, hover, 0]);
  return { root, body, head: null, armR: null, armL: null, legs: [], wings: [], orbit: [], segs: [], tpl, height, radius, hover, flash: [], tip: null };
}
function finish(r: Rig): Rig {
  r.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; if (!(m.material as THREE.Material).transparent) { m.userData.m = m.material; r.flash.push(m); } }
  });
  return r;
}
export function setFlash(r: Rig, on: boolean) { for (const m of r.flash) m.material = on ? WHITE : m.userData.m; }
const orb = (r: Rig, o: THREE.Object3D, ang: number, rad: number, y: number, sp = 1) => { o.userData = { ang, rad, y, sp }; r.orbit.push(o); return o; };

// ---------- shared extras ----------
interface Anchor { sx: number; sy: number; head: THREE.Object3D | null; hy: number; back: number; torso: THREE.Object3D }
function extras(r: Rig, def: EnemyDef, a: Anchor) {
  const gl = glowMat(def.glow, 2.4), ac = mat(def.accent, { metal: 0.5, rough: 0.4 }), cm = mat(def.color, { metal: 0.2 });
  for (const e of def.extras || []) {
    switch (e) {
      case 'wings': { const w = grp(a.torso, [0, a.sy, a.back]); for (const sx of [-1, 1]) { const f = grp(w, [sx * 0.15, 0, 0], [0, sx * 0.3, sx * 0.5]); M(f, G.cone(0.12, 1.4, 4), mat(def.accent, { rough: 0.7 }), [sx * 0.5, 0.3, 0], [0, 0, -sx * 1.1], [1, 1, 0.2]); M(f, G.cone(0.09, 1.0, 4), mat(def.color, { rough: 0.7 }), [sx * 0.4, -0.1, 0], [0, 0, -sx * 1.4], [1, 1, 0.2]); r.wings.push(f); } break; }
      case 'flames': for (let i = 0; i < 3; i++) { const f = M(a.torso, G.cone(0.13, 0.55, 6), addMat(def.glow, 0.7), [(i - 1) * 0.3, a.sy + 0.3, 0.05], [0, 0, (i - 1) * 0.3], undefined, false); f.userData.flame = i; r.segs.push(f); } break;
      case 'horns': if (a.head) for (const sx of [-1, 1]) M(a.head, G.cone(0.05, 0.4, 6), mat(0x2a2020, { rough: 0.4 }), [sx * 0.14, 0.2, 0], [0, 0, -sx * 0.5]); break;
      case 'crystals': for (const sx of [-1, 1]) M(a.torso, G.oct(0.14, 0), glowMat(def.glow, 1.6, 0.85), [sx * a.sx, a.sy + 0.15, 0], [0.3, 0, sx * 0.4], [0.7, 1.9, 0.7]); break;
      case 'antlers': if (a.head) for (const sx of [-1, 1]) { M(a.head, G.cyl(0.02, 0.03, 0.5, 5), ac, [sx * 0.12, 0.35, 0], [0, 0, -sx * 0.4]); M(a.head, G.cyl(0.015, 0.02, 0.3, 5), ac, [sx * 0.26, 0.52, 0], [0, 0, -sx * 0.9]); M(a.head, G.cyl(0.015, 0.02, 0.25, 5), ac, [sx * 0.2, 0.5, 0], [0.5, 0, -sx * 0.1]); } break;
      case 'fur': for (let i = 0; i < 8; i++) M(a.torso, G.sph(0.12, 6, 5), mat(def.accent, { rough: 1 }), [Math.cos(i) * a.sx, a.sy + 0.05 + (i % 2) * 0.05, Math.sin(i) * 0.2]); break;
      case 'spikes': for (let i = 0; i < 5; i++) M(a.torso, G.cone(0.05, 0.3, 5), ac, [(i - 2) * 0.12, a.sy + 0.2, a.back], [-1.2, 0, (i - 2) * 0.15]); break;
      case 'antenna': if (a.head) { M(a.head, G.cyl(0.01, 0.01, 0.4, 4), ac, [0.1, 0.35, 0]); M(a.head, G.sph(0.03), gl, [0.1, 0.56, 0]); } break;
      case 'shield': if (r.armL) { const s = grp(r.armL, [-0.12, -0.5, 0.1], [0, 0.4, 0]); M(s, G.cyl(0.4, 0.4, 0.06, 6), ac, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 1.2]); M(s, G.cyl(0.14, 0.14, 0.09, 8), gl, [0, 0, 0.02], [Math.PI / 2, 0, 0]); } break;
      case 'cape': { const c = grp(a.torso, [0, a.sy, a.back]); M(c, G.box(0.55, 1.1, 0.03), mat(def.accent, { rough: 0.9, op: 0.95 }), [0, -0.5, -0.05], [0.12, 0, 0]); break; }
      case 'halo': if (a.head) M(a.head, G.tor(0.28, 0.018, 6, 24), glowMat(def.glow, 3), [0, 0.5, -0.03], [Math.PI / 2, 0, 0], 1, false); break;
      case 'runes': for (let i = 0; i < 4; i++) M(a.torso, G.box(0.06, 0.24, 0.02), gl, [(i % 2 ? 1 : -1) * 0.12, a.sy - 0.1 - Math.floor(i / 2) * 0.28, 0.32]); break;
      case 'rings': for (let i = 0; i < 2; i++) orb(r, M(r.body, G.tor(0.7 + i * 0.25, 0.025, 6, 28), gl, [0, 1 + i * 0.3, 0], [Math.PI / 2 + i * 0.9, 0, 0], 1, false), 0, 0, 1 + i * 0.3, 0.6 + i * 0.4); break;
      case 'eyes': for (let i = 0; i < 3; i++) M(a.torso, G.sph(0.06), gl, [(i - 1) * 0.2, a.sy - 0.1 + (i % 2) * 0.2, 0.28]); break;
      case 'fins': if (a.head) { M(a.head, G.cone(0.08, 0.4, 3), mat(def.accent), [0, 0.22, -0.1], [-0.4, 0, 0], [0.3, 1, 1]); } break;
      case 'pincers': for (const sx of [-1, 1]) { const c = grp(r.body, [sx * 0.6, 0.1, 0.6], [0, -sx * 0.4, 0]); M(c, G.box(0.14, 0.14, 0.5), ac, [0, 0, 0.2]); M(c, G.cone(0.1, 0.35, 5), cm, [sx * 0.08, 0, 0.55], [Math.PI / 2, 0, 0]); } break;
      case 'bubbles': for (let i = 0; i < 4; i++) orb(r, M(r.body, G.sph(0.1, 8, 6), addMat(0xbfeaff, 0.5), [0, 0, 0], undefined, 1, false), i * 1.6, 0.8, 1.2, 1.5); break;
      case 'lure': if (a.head) { M(a.head, G.cyl(0.015, 0.015, 0.6, 4), ac, [0, 0.3, 0.2], [-0.8, 0, 0]); M(a.head, G.sph(0.08), gl, [0, 0.52, 0.45]); } break;
      case 'cannon': if (r.armR) M(r.armR, G.cyl(0.14, 0.18, 0.8, 8), ac, [0, -0.6, 0.3], [-Math.PI / 2, 0, 0]); break;
    }
  }
}

function enemyWeapon(kind: string, def: EnemyDef): THREE.Group {
  const g = new THREE.Group(), steel = mat(0xb8c4d8, { metal: 0.8, rough: 0.3 }), wood = mat(0x4a3a30), ac = mat(def.accent, { metal: 0.6, rough: 0.4 });
  const tint = mat(def.tpl === 'humanoid' && def.color < 0x909090 ? def.accent : 0xc8d0e0, { metal: 0.8, rough: 0.3, em: def.glow, ei: 0.25 });
  switch (kind) {
    case 'sword': M(g, bladeGeo(1.15, 0.15, 0.03, 0.04), tint, [0, 0.1, 0]); M(g, G.box(0.4, 0.06, 0.1), ac, [0, 0.08, 0]); M(g, G.cyl(0.035, 0.035, 0.3, 6), wood, [0, -0.1, 0]); break;
    case 'axe': M(g, G.cyl(0.035, 0.035, 1.5, 6), wood, [0, 0.3, 0]); M(g, G.box(0.5, 0.45, 0.06), tint, [0.22, 0.95, 0], [0, 0, 0.1]); M(g, G.cone(0.1, 0.3, 4), steel, [0, 1.15, 0]); break;
    case 'spear': M(g, G.cyl(0.03, 0.03, 2.1, 6), wood, [0, 0.4, 0]); M(g, bladeGeo(0.5, 0.18, 0, 0.04, (t) => Math.sin(t * 3)), tint, [0, 1.4, 0]); break;
    case 'trident': M(g, G.cyl(0.03, 0.03, 1.9, 6), mat(0xd8b050, { metal: 0.8 }), [0, 0.4, 0]); for (const x of [-0.14, 0, 0.14]) M(g, G.cone(0.04, x ? 0.42 : 0.55, 5), steel, [x, 1.5 + (x ? 0 : 0.06), 0]); M(g, G.box(0.34, 0.04, 0.04), steel, [0, 1.35, 0]); break;
    case 'bow': M(g, G.tor(0.6, 0.03, 5, 14, Math.PI), wood, [0, 0, 0], [0, 0, -Math.PI / 2], [0.4, 1, 1]); M(g, G.cyl(0.006, 0.006, 1.2, 3), steel, [0, 0, 0]); break;
    case 'blades': M(g, bladeGeo(0.75, 0.1, 0.05, 0.03), tint, [0, 0.08, 0]); M(g, G.cyl(0.03, 0.03, 0.22, 6), ac, [0, -0.06, 0]); break;
  }
  return g;
}
function mkHead(_r: Rig, par: THREE.Object3D, def: EnemyDef): THREE.Group {
  const h = grp(par), cm = mat(def.color, { rough: 0.6, metal: 0.2 }), ac = mat(def.accent, { rough: 0.5, metal: 0.4 }), gl = glowMat(def.glow, 3);
  const eyes = (y = 0.02, z = 0.17, s = 0.07) => { for (const sx of [-1, 1]) M(h, G.box(s, s * 0.5, 0.03), gl, [sx * 0.08, y, z], [0, 0, -sx * 0.15]); };
  switch (def.head) {
    case 'skull': M(h, G.sph(0.19, 10, 8), cm, [0, 0.02, 0], undefined, [0.9, 1, 1]); M(h, G.box(0.16, 0.09, 0.15), cm, [0, -0.15, 0.06]); for (const sx of [-1, 1]) M(h, G.sph(0.045, 6, 5), gl, [sx * 0.07, 0.03, 0.16]); M(h, G.box(0.04, 0.05, 0.03), mat(0x222222), [0, -0.05, 0.19]); break;
    case 'hood': M(h, G.cone(0.26, 0.55, 8), mat(0x1c1a22, { rough: 1 }), [0, 0.08, -0.03], [-0.15, 0, 0]); M(h, G.sph(0.15, 8, 6), mat(0x0a0a10), [0, 0, 0.06]); eyes(0.01, 0.18, 0.06); break;
    case 'helm': M(h, G.box(0.34, 0.38, 0.36), cm, [0, 0.02, 0]); M(h, G.box(0.3, 0.05, 0.05), gl, [0, 0.02, 0.19]); M(h, G.cone(0.05, 0.3, 4), ac, [0, 0.33, -0.05], [-0.4, 0, 0], [1, 1.5, 0.4]); break;
    case 'demon': M(h, G.sph(0.2, 10, 8), cm, [0, 0, 0]); M(h, G.box(0.2, 0.1, 0.2), cm, [0, -0.14, 0.1]); for (const sx of [-1, 1]) { M(h, G.cone(0.06, 0.5, 6), mat(0x1a0a0a), [sx * 0.15, 0.22, -0.02], [-0.2, 0, -sx * 0.6]); } eyes(0.04, 0.18, 0.09); break;
    case 'horned': M(h, G.box(0.3, 0.3, 0.32), cm, [0, 0, 0]); M(h, G.box(0.2, 0.15, 0.2), cm, [0, -0.08, 0.2]); for (const sx of [-1, 1]) M(h, G.cone(0.06, 0.45, 6), mat(0xd8d0b8), [sx * 0.18, 0.18, -0.02], [0, 0, -sx * 0.9]); eyes(0.06, 0.17, 0.06); break;
    case 'fish': M(h, G.sph(0.2, 10, 8), cm, [0, 0, 0.02], undefined, [0.8, 1, 1.2]); M(h, G.cone(0.1, 0.3, 4), ac, [0, 0.22, -0.05], [-0.3, 0, 0], [0.3, 1, 1]); for (const sx of [-1, 1]) M(h, G.sph(0.06, 6, 5), gl, [sx * 0.15, 0.04, 0.12]); break;
    case 'robot': M(h, G.box(0.34, 0.3, 0.32), cm, [0, 0, 0]); M(h, G.box(0.28, 0.08, 0.04), gl, [0, 0.03, 0.17]); M(h, G.box(0.1, 0.1, 0.1), ac, [0, -0.2, 0]); break;
    case 'dragon': M(h, G.box(0.28, 0.26, 0.3), cm, [0, 0, 0]); M(h, G.box(0.2, 0.14, 0.3), cm, [0, -0.06, 0.28]); for (const sx of [-1, 1]) M(h, G.cone(0.05, 0.4, 5), ac, [sx * 0.12, 0.2, -0.1], [-0.7, 0, -sx * 0.2]); eyes(0.06, 0.15, 0.06); break;
    default: M(h, G.sph(0.19, 10, 8), mat(0xf2e8d8), [0, 0, 0]); eyes(); M(h, G.sph(0.2, 10, 6), mat(0xf4e8a0, { rough: 0.4 }), [0, 0.06, -0.04], [-0.3, 0, 0], [1, 0.8, 1]);
  }
  return h;
}

function humanoid(def: EnemyDef): Rig {
  const r = mk('humanoid', 1.95, 0.45, 0), skel = def.head === 'skull', torso = grp(r.body);
  const cm = mat(def.color, { rough: 0.6, metal: 0.25 }), ac = mat(def.accent, { rough: 0.5, metal: 0.4 }), dark = mat(0x1a1a22, { rough: 0.9 });
  r.body.position.y = 0.95;
  if (skel) { M(torso, G.cyl(0.05, 0.05, 0.6, 5), cm, [0, 0.35, 0]); for (let i = 0; i < 4; i++) M(torso, G.box(0.34 - i * 0.03, 0.04, 0.2), cm, [0, 0.55 - i * 0.12, 0]); M(torso, G.box(0.3, 0.12, 0.18), cm, [0, 0.05, 0]); }
  else { M(torso, G.box(0.42, 0.2, 0.26), dark, [0, 0.05, 0]); M(torso, G.cyl(0.26, 0.2, 0.5, 7), cm, [0, 0.42, 0], undefined, [1.15, 1, 0.8]); M(torso, G.box(0.46, 0.06, 0.3), ac, [0, 0.2, 0]); for (const sx of [-1, 1]) M(torso, G.sph(0.17, 8, 6), ac, [sx * 0.34, 0.62, 0], undefined, [1.05, 0.7, 1]); }
  r.head = mkHead(r, torso, def); r.head.position.set(0, 0.92, 0);
  const arm = (sx: number) => { const a = grp(torso, [sx * 0.36, 0.58, 0]); M(a, G.cyl(0.07, 0.06, 0.55, 6), skel ? cm : dark, [0, -0.27, 0]); M(a, G.sph(0.08, 6, 5), skel ? cm : ac, [0, -0.6, 0]); return a; };
  r.armR = arm(1); r.armL = arm(-1);
  const leg = (sx: number) => { const l = grp(r.body, [sx * 0.13, 0, 0]); M(l, G.cyl(0.09, 0.07, 0.95, 6), skel ? cm : dark, [0, -0.47, 0]); M(l, G.box(0.14, 0.08, 0.26), skel ? cm : ac, [0, -0.9, 0.05]); return l; };
  r.legs = [leg(1), leg(-1)];
  const w = def.weapon;
  if (w) {
    const wm = enemyWeapon(w, def);
    if (w === 'bow') { wm.position.set(0, -0.1, 0.1); r.armL!.add(wm); wm.position.y = -0.6; r.armL!.rotation.x = -0.6; }
    else { wm.rotation.x = Math.PI / 2 - 0.45; r.armR.add(wm); wm.position.y = -0.6; r.tip = wm; if (w === 'blades') { const w2 = enemyWeapon(w, def); w2.rotation.x = Math.PI / 2 - 0.45; w2.position.y = -0.6; r.armL.add(w2); } }
  }
  extras(r, def, { sx: 0.34, sy: 0.65, head: r.head, hy: 0.9, back: -0.2, torso });
  return finish(r);
}
function beast(def: EnemyDef): Rig {
  const r = mk('beast', 1.1, 0.7, 0), cm = mat(def.color, { rough: 0.85 }), ac = mat(def.accent, { rough: 0.7 }), gl = glowMat(def.glow, 3), torso = grp(r.body);
  r.body.position.y = 0.75;
  M(torso, G.sph(0.5, 10, 8), cm, [0, 0.1, 0], undefined, [0.85, 0.8, 1.55]); M(torso, G.sph(0.4, 8, 6), ac, [0, 0.35, 0.35], undefined, [1, 0.8, 1.1]);
  const head = grp(torso, [0, 0.3, 0.95]); r.head = head;
  M(head, G.sph(0.27, 10, 8), cm, [0, 0, 0], undefined, [0.9, 0.9, 1]); M(head, G.box(0.2, 0.16, 0.34), cm, [0, -0.07, 0.3]); M(head, G.box(0.18, 0.04, 0.3), mat(0xeeeeee), [0, -0.17, 0.3]);
  for (const sx of [-1, 1]) { M(head, G.cone(0.07, 0.25, 4), cm, [sx * 0.15, 0.27, -0.05], [0, 0, -sx * 0.2]); M(head, G.sph(0.045, 6, 5), gl, [sx * 0.12, 0.07, 0.2]); }
  for (let i = 0; i < 4; i++) { const sx = i % 2 ? 1 : -1, z = i < 2 ? 0.5 : -0.5; const l = grp(r.body, [sx * 0.3, 0.1, z]); M(l, G.cyl(0.1, 0.07, 0.8, 6), cm, [0, -0.35, 0]); M(l, G.box(0.14, 0.07, 0.22), ac, [0, -0.74, 0.04]); r.legs.push(l); }
  const tail = grp(torso, [0, 0.2, -0.85], [0.5, 0, 0]); M(tail, G.cone(0.1, 0.9, 6), cm, [0, 0, -0.35], [-Math.PI / 2 - 0.3, 0, 0]); r.armR = tail;
  extras(r, def, { sx: 0.3, sy: 0.5, head, hy: 0.3, back: -0.3, torso });
  return finish(r);
}
function golem(def: EnemyDef): Rig {
  const r = mk('golem', 2.6, 0.8, 0), cm = mat(def.color, { rough: 0.9, metal: 0.1, flat: true }), ac = mat(def.accent, { rough: 0.8, flat: true }), gl = glowMat(def.glow, 2.5), torso = grp(r.body);
  r.body.position.y = 1.2;
  M(torso, G.box(0.9, 0.9, 0.6), cm, [0, 0.4, 0]); M(torso, G.box(0.7, 0.5, 0.5), ac, [0, -0.2, 0]); M(torso, G.sph(0.12, 8, 6), gl, [0, 0.45, 0.32]);
  for (const sx of [-1, 1]) M(torso, G.box(0.4, 0.34, 0.5), cm, [sx * 0.62, 0.72, 0], [0, 0, sx * 0.2]);
  const head = grp(torso, [0, 1.05, 0.05]); r.head = head; M(head, G.box(0.4, 0.34, 0.38), cm, [0, 0, 0]); for (const sx of [-1, 1]) M(head, G.box(0.1, 0.05, 0.03), gl, [sx * 0.1, 0.02, 0.2]);
  const arm = (sx: number) => { const a = grp(torso, [sx * 0.72, 0.7, 0]); M(a, G.box(0.28, 0.8, 0.3), ac, [0, -0.4, 0]); M(a, G.box(0.42, 0.42, 0.42), cm, [0, -0.95, 0.05]); return a; };
  r.armR = arm(1); r.armL = arm(-1);
  const leg = (sx: number) => { const l = grp(r.body, [sx * 0.3, -0.1, 0]); M(l, G.box(0.34, 1.0, 0.36), ac, [0, -0.5, 0]); M(l, G.box(0.46, 0.2, 0.55), cm, [0, -1.05, 0.08]); return l; };
  r.legs = [leg(1), leg(-1)];
  extras(r, def, { sx: 0.6, sy: 0.8, head, hy: 1, back: -0.3, torso });
  return finish(r);
}
function floater(def: EnemyDef): Rig {
  const r = mk('floater', 2, 0.5, 0.8), cm = mat(def.color, { rough: 0.7 }), ac = mat(def.accent, { rough: 0.5, metal: 0.3 }), gl = glowMat(def.glow, 3), torso = grp(r.body);
  const sp = def.name.includes('Sentry') || def.name.includes('Infinity');
  if (sp) { M(torso, G.ico(0.4, 1), cm, [0, 0.5, 0]); M(torso, G.sph(0.18, 10, 8), gl, [0, 0.5, 0.3]); M(torso, G.tor(0.55, 0.04, 6, 24), ac, [0, 0.5, 0], [Math.PI / 2, 0, 0]); r.head = torso; }
  else {
    M(torso, G.cone(0.42, 1.2, 10), cm, [0, 0.2, 0], [Math.PI, 0, 0], undefined); M(torso, G.cyl(0.2, 0.3, 0.35, 8), ac, [0, 0.72, 0]);
    const head = grp(torso, [0, 1.05, 0]); r.head = head; M(head, G.cone(0.25, 0.4, 8), mat(def.accent, { rough: 0.9 }), [0, 0.1, -0.03], [-0.1, 0, 0]); M(head, G.sph(0.13, 8, 6), mat(0x0a0a12), [0, 0, 0.06]); for (const sx of [-1, 1]) M(head, G.sph(0.03, 6, 5), gl, [sx * 0.05, 0.01, 0.15]);
  }
  const arm = (sx: number) => { const a = grp(torso, [sx * 0.34, 0.66, 0.05]); M(a, G.cyl(0.05, 0.045, 0.4, 6), cm, [0, -0.2, 0]); M(a, G.sph(0.07, 6, 5), gl, [0, -0.44, 0]); return a; };
  r.armR = arm(1); r.armL = arm(-1);
  for (let i = 0; i < 3; i++) orb(r, M(r.body, G.oct(0.11, 0), glowMat(def.glow, 2, 0.9), [0, 0, 0], undefined, [0.7, 1.4, 0.7], false), i * 2.1, 0.75, 1.0, 1.2);
  extras(r, def, { sx: 0.34, sy: 0.7, head: r.head, hy: 1.1, back: -0.2, torso });
  return finish(r);
}
function crawler(def: EnemyDef): Rig {
  const r = mk('crawler', 1.1, 0.7, 0), cm = mat(def.color, { rough: 0.6, metal: 0.2 }), ac = mat(def.accent, { rough: 0.5 }), gl = glowMat(def.glow, 3), torso = grp(r.body);
  r.body.position.y = 0.5;
  M(torso, G.sph(0.5, 10, 8), cm, [0, 0.1, -0.1], undefined, [1, 0.7, 1.3]); M(torso, G.sph(0.3, 8, 6), ac, [0, 0.1, 0.45]);
  const head = grp(torso, [0, 0.12, 0.65]); r.head = head; M(head, G.sph(0.2, 8, 6), cm, [0, 0, 0]); for (const sx of [-1, 1]) { M(head, G.sph(0.06, 6, 5), gl, [sx * 0.1, 0.07, 0.14]); M(head, G.cone(0.04, 0.3, 4), ac, [sx * 0.08, -0.12, 0.2], [Math.PI / 2 + 0.3, 0, sx * 0.3]); }
  for (let i = 0; i < 6; i++) { const sx = i % 2 ? 1 : -1, z = 0.3 - Math.floor(i / 2) * 0.4; const l = grp(r.body, [sx * 0.35, 0.05, z], [0, 0, sx * 0.9]); M(l, G.cyl(0.04, 0.025, 0.8, 5), ac, [sx * 0.35, -0.15, 0], [0, 0, -sx * 1.1]); r.legs.push(l); }
  r.armR = grp(torso, [0, 0.2, 0.3]);
  extras(r, def, { sx: 0.3, sy: 0.3, head, hy: 0.2, back: -0.4, torso });
  return finish(r);
}
function winged(def: EnemyDef): Rig {
  const r = mk('winged', 1.4, 0.8, 1.6), cm = mat(def.color, { rough: 0.7 }), ac = mat(def.accent, { rough: 0.6 }), gl = glowMat(def.glow, 3), torso = grp(r.body);
  M(torso, G.sph(0.4, 10, 8), cm, [0, 0, 0], undefined, [0.8, 0.8, 1.5]); M(torso, G.cone(0.22, 0.4, 6), ac, [0, -0.05, -0.8], [-Math.PI / 2, 0, 0], [1, 2.4, 0.6]);
  const head = grp(torso, [0, 0.12, 0.7]); r.head = head; M(head, G.sph(0.2, 8, 6), cm, [0, 0, 0]); M(head, G.cone(0.12, 0.4, 5), ac, [0, -0.02, 0.28], [Math.PI / 2, 0, 0]); for (const sx of [-1, 1]) { M(head, G.sph(0.045, 6, 5), gl, [sx * 0.1, 0.07, 0.12]); M(head, G.cone(0.04, 0.3, 4), ac, [sx * 0.12, 0.2, -0.1], [-0.8, 0, -sx * 0.2]); }
  for (const sx of [-1, 1]) { const w = grp(torso, [sx * 0.25, 0.15, 0.05]); M(w, G.cyl(0.03, 0.03, 1.6, 4), ac, [sx * 0.8, 0, 0], [0, 0, Math.PI / 2]); M(w, G.pla(1.5, 0.9), mat(def.accent, { rough: 0.8, op: 0.9 }), [sx * 0.8, 0, -0.35], [-Math.PI / 2 + 0.2, 0, 0]); r.wings.push(w); }
  r.armR = grp(torso, [0, 0, 0.3]);
  extras(r, def, { sx: 0.3, sy: 0.2, head, hy: 0.1, back: -0.4, torso });
  return finish(r);
}
const TPL: Record<string, (d: EnemyDef) => Rig> = { humanoid, beast, golem, floater, crawler, winged };
export function buildEnemy(def: EnemyDef): Rig { const r = TPL[def.tpl](def); r.root.scale.setScalar(def.scale); r.height *= def.scale; r.radius *= def.scale; r.hover *= def.scale; return r; }

// ---------- BOSSES ----------
function bossColossus(d: BossDef, v: string): Rig {
  const r = mk('humanoid', 6.5, 1.8, 0), cm = mat(d.color, { rough: 0.85, metal: 0.15, flat: v === 'ruin' || v === 'frost' }), ac = mat(d.accent, { rough: 0.6, metal: 0.5 }), gl = glowMat(d.glow, 3), torso = grp(r.body);
  r.body.position.y = 2.6;
  const sk = v === 'monarch';
  if (sk) { M(torso, G.cone(1.3, 3.8, 10), mat(d.color, { rough: 0.95 }), [0, -0.8, 0], [Math.PI, 0, 0]); M(torso, G.cyl(0.5, 0.8, 1.3, 8), ac, [0, 0.9, 0]); }
  else { M(torso, G.box(2.3, 1.6, 1.4), cm, [0, 0.7, 0]); M(torso, G.box(1.8, 1.0, 1.2), ac, [0, -0.6, 0]); M(torso, G.sph(0.35, 10, 8), gl, [0, 0.8, 0.72]); }
  for (const sx of [-1, 1]) M(torso, v === 'overlord' ? G.cyl(0.4, 0.5, 1.2, 8) : G.sph(0.75, 8, 6), cm, [sx * 1.5, 1.45, 0], v === 'overlord' ? [0, 0, Math.PI / 2] : undefined, v === 'overlord' ? 1 : [1, 0.8, 1]);
  const head = grp(torso, [0, 2.0, 0.1]); r.head = head;
  if (v === 'ruin') { M(head, G.box(0.9, 0.85, 0.85), cm, [0, 0, 0]); for (const sx of [-1, 1]) M(head, G.box(0.22, 0.1, 0.05), gl, [sx * 0.23, 0.05, 0.44]); for (let i = 0; i < 5; i++) M(head, G.cone(0.1, 0.5 - (i % 2) * 0.2, 4), ac, [(i - 2) * 0.2, 0.62, 0]); }
  if (v === 'frost') { M(head, G.box(0.85, 0.8, 0.8), cm, [0, 0, 0]); for (let i = 0; i < 7; i++) M(head, G.cone(0.08, 0.7 - Math.abs(i - 3) * 0.1, 5), glowMat(d.glow, 1.4, 0.85), [(i - 3) * 0.17, 0.6, 0]); for (let i = 0; i < 5; i++) M(head, G.cone(0.1, 0.5, 5), mat(0xeaf8ff), [(i - 2) * 0.16, -0.55, 0.3], [Math.PI, 0, 0]); for (const sx of [-1, 1]) { M(head, G.box(0.2, 0.08, 0.05), gl, [sx * 0.22, 0.05, 0.42]); M(head, G.cone(0.14, 1.0, 6), mat(0xeaf8ff), [sx * 0.6, 0.4, 0], [0, 0, -sx * 0.9]); } for (let i = 0; i < 6; i++) M(torso, G.cone(0.14, 0.9, 5), glowMat(d.glow, 1.2, 0.85), [Math.cos(i / 6 * 6.28) * 1.7, 1.6, Math.sin(i / 6 * 6.28) * 0.6 - 0.2], [0.3, 0, Math.cos(i) * 0.5]); }
  if (v === 'overlord') { M(head, G.box(0.9, 0.8, 0.8), cm, [0, 0, 0]); M(head, G.box(0.7, 0.2, 0.05), gl, [0, 0.05, 0.43]); M(head, G.cyl(0.03, 0.03, 1, 4), ac, [0.3, 0.8, 0]); M(head, G.sph(0.08), gl, [0.3, 1.3, 0]); M(torso, G.sph(0.5, 10, 8), glowMat(d.glow, 3, 0.9), [0, 0.8, 0.5]); for (let i = 0; i < 3; i++) orb(r, M(r.body, G.tor(2 + i * 0.5, 0.06, 6, 36), glowMat(i % 2 ? 0x44ccff : d.glow, 2, 0.9), [0, 0, 0], [Math.PI / 2 + i, i, 0], 1, false), 0, 0, 1 + i * 0.6, 0.4 + i * 0.2); for (const sx of [-1, 1]) M(torso, G.cyl(0.25, 0.3, 1.5, 8), ac, [sx * 1.7, 2.0, 0.2], [-0.4, 0, 0]); }
  if (v === 'monarch') { M(head, G.sph(0.5, 10, 8), mat(0x0a0612), [0, 0, 0], undefined, [0.9, 1, 1]); for (const sx of [-1, 1]) M(head, G.box(0.22, 0.07, 0.04), gl, [sx * 0.2, 0.05, 0.42], [0, 0, -sx * 0.3]); for (let i = 0; i < 7; i++) M(head, G.cone(0.08, 0.7 + (i % 2) * 0.4, 5), glowMat(d.accent, 1.5), [(i - 3) * 0.16, 0.55, 0], [0, 0, (i - 3) * 0.12]); for (let i = 0; i < 6; i++) orb(r, M(r.body, bladeGeo(1.6, 0.25, 0, 0.05), glowMat(d.accent, 1.5), [0, 0, 0], [Math.PI, 0, 0], 1, false), i * 1.05, 2.3, 0.2, 0.7); const c = grp(torso, [0, 1.4, -0.5]); M(c, G.box(2.4, 3.6, 0.06), mat(0x120a22, { rough: 1, op: 0.9 }), [0, -1.2, 0], [0.1, 0, 0]); }
  if (v === 'archon') { M(head, G.sph(0.45, 10, 8), mat(0xf4eed8, { rough: 0.3, metal: 0.3 }), [0, 0, 0], undefined, [0.9, 1, 0.95]); M(head, G.box(0.6, 0.12, 0.05), gl, [0, 0.0, 0.4]); for (let i = 0; i < 2; i++) M(head, G.tor(0.65 + i * 0.3, 0.03, 6, 32), glowMat(d.glow, 3, 0.9), [0, 0.9 + i * 0.1, -0.2], [Math.PI / 2 - 0.3, 0, 0], 1, false); for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) { const w = grp(torso, [sx * 0.6, 1.3 - k * 0.3, -0.5], [0, sx * 0.3, sx * (0.5 + k * 0.4)]); M(w, G.cone(0.35, 3.4 - k * 0.5, 4), addMat(k % 2 ? 0xffe27a : 0xfff6e0, 0.55), [sx * 1.5, 0.6, 0], [0, 0, -sx * 1.2], [1, 1, 0.12], false); r.wings.push(w); } for (let i = 0; i < 3; i++) orb(r, M(r.body, G.tor(0.6, 0.06, 6, 20), glowMat(d.glow, 2.5), [0, 0, 0], [0, Math.PI / 2, 0], 1, false), i * 2.1, 2.6, 0.8 + i * 0.3, 0.9); }
  const arm = (sx: number) => { const a = grp(torso, [sx * 1.55, 1.3, 0]); M(a, G.cyl(0.28, 0.24, 1.9, 8), sk ? mat(0x120a22) : ac, [0, -0.95, 0]); M(a, G.box(0.7, 0.75, 0.7), cm, [0, -2.1, 0.05]); return a; };
  r.armR = arm(1); r.armL = arm(-1);
  const leg = (sx: number) => { const l = grp(r.body, [sx * 0.65, -0.9, 0]); if (!sk) { M(l, G.box(0.8, 2.0, 0.85), ac, [0, -1.0, 0]); M(l, G.box(1.0, 0.5, 1.4), cm, [0, -2.3, 0.2]); } return l; };
  r.legs = sk ? [] : [leg(1), leg(-1)];
  if (sk) r.hover = 0.2;
  // weapon
  const wp = grp(r.armR, [0, -2.2, 0.2]); r.tip = wp;
  if (v === 'ruin') { M(wp, G.box(0.5, 5, 0.2), cm, [0, 2.2, 0]); M(wp, G.box(1.8, 0.3, 0.3), ac, [0, -0.2, 0]); M(wp, G.box(0.1, 4, 0.22), gl, [0, 2.4, 0]); wp.rotation.x = Math.PI / 2 - 0.3; }
  if (v === 'frost') { M(wp, G.cyl(0.1, 0.1, 5, 6), mat(0x4a3a30), [0, 1.8, 0]); for (const sx of [-1, 1]) M(wp, G.cone(0.9, 1.6, 4), glowMat(d.glow, 1.3, 0.9), [sx * 0.9, 3.8, 0], [0, 0, -sx * Math.PI / 2], [1, 1, 0.2]); wp.rotation.x = Math.PI / 2 - 0.3; }
  if (v === 'overlord') { M(wp, G.cyl(0.14, 0.14, 3.5, 6), ac, [0, 1.2, 0]); M(wp, G.box(1.6, 1.3, 1.3), cm, [0, 3.2, 0]); M(wp, G.box(1.7, 0.2, 1.4), gl, [0, 3.2, 0]); wp.rotation.x = Math.PI / 2 - 0.3; }
  if (v === 'monarch') { M(wp, bladeGeo(4.5, 0.6, 0.3, 0.1), glowMat(d.accent, 1.3), [0, 0, 0]); wp.rotation.x = Math.PI / 2 - 0.3; }
  if (v === 'archon') { M(wp, G.cyl(0.07, 0.07, 6, 6), glowMat(d.glow, 2), [0, 2.4, 0]); M(wp, bladeGeo(1.8, 0.5, 0, 0.1), glowMat(d.glow, 3), [0, 5.2, 0]); wp.rotation.x = Math.PI / 2 - 0.3; }
  if (v === 'ruin') for (let i = 0; i < 4; i++) orb(r, M(r.body, G.box(0.5, 0.5, 0.5), mat(d.color, { flat: true }), [0, 0, 0], [i, i * 2, 0]), i * 1.57, 2.7, 1.0, 0.5);
  return finish(r);
}
function bossDragon(d: BossDef, v: string): Rig {
  const r = mk('beast', 5, 2.4, 0), cm = mat(d.color, { rough: 0.6, metal: 0.3 }), ac = mat(d.accent, { rough: 0.5, metal: 0.3 }), gl = glowMat(d.glow, 3), torso = grp(r.body), emp = v === 'emperor';
  r.body.position.y = 2.8;
  M(torso, G.sph(1.5, 12, 9), cm, [0, 0, 0], undefined, [0.95, 0.9, 1.7]); M(torso, G.sph(1.1, 10, 8), mat(emp ? 0xffe9a0 : 0xd8a060, { rough: 0.7 }), [0, -0.35, 0.3], undefined, [0.9, 0.7, 1.5]);
  for (let i = 0; i < 7; i++) M(torso, G.cone(0.2, 0.7 + (3 - Math.abs(i - 3)) * 0.1, 5), ac, [0, 1.3 - Math.abs(i - 3) * 0.12, 1.5 - i * 0.5], [-0.3, 0, 0]);
  let neck: THREE.Object3D = grp(torso, [0, 0.4, 2.0], [-0.5, 0, 0]);
  for (let i = 0; i < 3; i++) { M(neck, G.cyl(0.55 - i * 0.07, 0.6 - i * 0.07, 0.9, 8), cm, [0, 0, 0.4], [Math.PI / 2, 0, 0]); neck = grp(neck, [0, 0, 0.8], [0.3, 0, 0]); }
  const head = grp(neck, [0, 0, 0.3]); r.head = head;
  M(head, G.box(0.9, 0.7, 1.0), cm, [0, 0, 0.3]); M(head, G.box(0.7, 0.4, 0.9), cm, [0, -0.1, 1.0]); M(head, G.box(0.6, 0.15, 0.8), mat(0xeeeeee), [0, -0.38, 0.95]); M(head, G.box(0.66, 0.2, 0.85), ac, [0, -0.3, 0.95]);
  for (const sx of [-1, 1]) { M(head, G.cone(0.14, 1.5, 5), ac, [sx * 0.35, 0.45, -0.3], [-1.2, 0, -sx * 0.3]); M(head, G.sph(0.1, 6, 5), gl, [sx * 0.4, 0.15, 0.55]); if (emp) { M(head, G.cone(0.02, 1.8, 3), glowMat(d.glow, 2), [sx * 0.4, -0.2, 1.2], [1.3, 0, -sx * 0.9]); M(head, G.cone(0.12, 0.7, 5), ac, [sx * 0.5, 0.65, 0.1], [-0.5, 0, -sx * 0.6]); } }
  for (let i = 0; i < 6; i++) M(head, G.cone(0.04, 0.2, 4), mat(0xffffff), [(i % 2 ? 1 : -1) * 0.25, -0.35, 0.7 + (i >> 1) * 0.2], [Math.PI, 0, 0]);
  const leg = (sx: number, z: number) => { const l = grp(r.body, [sx * 1.0, -0.4, z]); M(l, G.cyl(0.4, 0.3, 2, 7), cm, [0, -1.0, 0]); M(l, G.box(0.6, 0.2, 0.9), ac, [0, -2.1, 0.2]); for (let k = -1; k <= 1; k++) M(l, G.cone(0.07, 0.4, 4), mat(0xf0e8d0), [k * 0.2, -2.15, 0.7], [Math.PI / 2, 0, 0]); return l; };
  r.legs = [leg(1, 1.0), leg(-1, 1.0), leg(1, -1.0), leg(-1, -1.0)];
  let tail: THREE.Object3D = grp(torso, [0, 0, -2.4], [0.2, 0, 0]);
  for (let i = 0; i < 5; i++) { M(tail, G.cone(0.65 - i * 0.1, 1.3, 7), cm, [0, 0, -0.5], [-Math.PI / 2, 0, 0]); r.segs.push(tail); tail = grp(tail, [0, 0, -1.0]); }
  M(tail, G.cone(0.3, 1, 4), ac, [0, 0, -0.4], [-Math.PI / 2, 0, 0], [3, 1, 0.4]);
  for (const sx of [-1, 1]) {
    const w = grp(torso, [sx * 0.8, 0.9, 0.4], [0, 0, 0]);
    M(w, G.cyl(0.12, 0.09, 4.5, 6), ac, [sx * 2.2, 0.4, 0], [0, 0, Math.PI / 2 - sx * 0.25]);
    for (let k = 0; k < (emp ? 5 : 4); k++) M(w, G.pla(2.2, 3.6 - k * 0.2), mat(emp ? 0xc03a2a : 0x4a1010, { rough: 0.8, op: 0.92 }), [sx * (1.2 + k * 0.7), -0.7, -k * 0.35], [-Math.PI / 2 + 0.15, 0, sx * (-0.3 - k * 0.1)]);
    r.wings.push(w);
  }
  if (emp) { M(torso, G.tor(1.2, 0.06, 6, 28), glowMat(d.glow, 2.5), [0, 1.5, 0.3], [Math.PI / 2, 0, 0], 1, false); }
  r.armR = grp(torso, [0, 0, 1]); r.hover = 0;
  return finish(r);
}
function bossBeast(d: BossDef): Rig {
  const r = mk('beast', 5, 2.2, 0), cm = mat(d.color, { rough: 0.95 }), ac = mat(d.accent, { rough: 0.9 }), gl = glowMat(d.glow, 3), torso = grp(r.body);
  r.body.position.y = 2.7;
  M(torso, G.sph(1.6, 12, 9), cm, [0, 0, 0], undefined, [0.85, 0.85, 1.4]); M(torso, G.sph(1.3, 10, 8), ac, [0, 0.5, 0.8], undefined, [1.1, 1, 1]);
  for (let i = 0; i < 18; i++) M(torso, G.sph(0.4, 6, 5), mat(0x2a5a2a, { rough: 1 }), [Math.cos(i * 1.1) * 0.9, 0.8 + (i % 3) * 0.3, 0.7 + Math.sin(i * 1.7) * 0.5]);
  for (let i = 0; i < 6; i++) M(torso, G.box(0.1, 0.8, 0.08), gl, [(i % 2 ? 1 : -1) * 1.38, 0 + Math.floor(i / 2) * 0.3 - 0.2, 0.2 - Math.floor(i / 2) * 0.6], [0, 0, (i % 2 ? 1 : -1) * 0.2]);
  const head = grp(torso, [0, 0.8, 2.0]); r.head = head;
  M(head, G.sph(0.9, 10, 8), cm, [0, 0, 0], undefined, [0.95, 0.95, 1]); M(head, G.box(0.7, 0.55, 0.9), cm, [0, -0.25, 0.8]); M(head, G.box(0.6, 0.1, 0.8), mat(0xeeeeee), [0, -0.58, 0.8]);
  for (const sx of [-1, 1]) {
    M(head, G.sph(0.11, 6, 5), gl, [sx * 0.45, 0.2, 0.6]); M(head, G.cone(0.25, 0.7, 4), cm, [sx * 0.6, 0.8, -0.2], [0, 0, -sx * 0.3]);
    M(head, G.cone(0.13, 0.35, 5), mat(0xf0f0e0), [sx * 0.25, -0.55, 1.2], [Math.PI, 0, 0]);
    for (let k = 0; k < 4; k++) { M(head, G.cyl(0.05, 0.09, 1.0, 5), mat(0xe8dcc0, { rough: 0.6 }), [sx * (0.7 + k * 0.28), 1.3 + k * 0.3, -0.2], [0, 0, -sx * (0.5 + k * 0.12)]); M(head, G.cone(0.04, 0.8, 4), mat(0xe8dcc0), [sx * (0.9 + k * 0.35), 1.9 + k * 0.28, -0.2], [0, 0, -sx * 0.1]); }
  }
  for (let i = 0; i < 4; i++) { const sx = i % 2 ? 1 : -1, z = i < 2 ? 1.1 : -1.1; const l = grp(r.body, [sx * 1.0, -0.2, z]); M(l, G.cyl(0.45, 0.32, 2.3, 7), cm, [0, -1.1, 0]); M(l, G.box(0.7, 0.25, 1.0), ac, [0, -2.3, 0.2]); for (let k = -1; k <= 1; k++) M(l, G.cone(0.08, 0.5, 4), mat(0xf0e8d0), [k * 0.22, -2.3, 0.8], [Math.PI / 2, 0, 0]); r.legs.push(l); }
  const tail = grp(torso, [0, 0.2, -2.0]); M(tail, G.cone(0.4, 2.2, 6), cm, [0, 0.2, -0.8], [-Math.PI / 2 + 0.5, 0, 0]); r.armR = grp(torso, [0, 0, 1]);
  return finish(r);
}
function bossLeviathan(d: BossDef): Rig {
  const r = mk('serpent', 6, 2.4, 3), cm = mat(d.color, { rough: 0.4, metal: 0.3 }), ac = mat(d.accent, { rough: 0.5 }), gl = glowMat(d.glow, 3);
  const head = grp(r.body, [0, 0, 2.2]); r.head = head;
  M(head, G.sph(1.7, 14, 10), cm, [0, 0, 0], undefined, [1, 0.9, 1.3]);
  const jaw = grp(head, [0, -0.6, 0.4]); M(jaw, G.box(1.8, 0.5, 2.4), ac, [0, -0.2, 1]); for (let i = 0; i < 8; i++) M(jaw, G.cone(0.1, 0.5, 4), mat(0xf0f4ff), [(i % 2 ? 1 : -1) * 0.5, 0.2, 0.3 + (i >> 1) * 0.5]); r.armR = jaw;
  M(head, G.box(1.6, 0.4, 2.0), ac, [0, 0.4, 1.4]); for (let i = 0; i < 8; i++) M(head, G.cone(0.1, 0.5, 4), mat(0xf0f4ff), [(i % 2 ? 1 : -1) * 0.5, -0.1, 0.9 + (i >> 1) * 0.4], [Math.PI, 0, 0]);
  for (const sx of [-1, 1]) { M(head, G.sph(0.22, 8, 6), gl, [sx * 1.0, 0.5, 1.0]); M(head, G.cone(0.2, 1.8, 4), ac, [sx * 1.1, 0.2, -0.5], [0, 0, -sx * 1.2], [1, 1, 0.3]); }
  M(head, G.cyl(0.04, 0.04, 2.2, 4), ac, [0, 1.3, 0.8], [-0.7, 0, 0]); M(head, G.sph(0.3, 8, 6), gl, [0, 2.2, 1.7]);
  for (let i = 0; i < 7; i++) { const s = M(r.body, G.sph(1.5 - i * 0.16, 12, 9), i % 2 ? cm : ac, [0, 0, -i * 1.8], undefined, [1, 0.95, 1.2]); r.segs.push(s); if (i % 2 === 0 && i > 0) for (const sx of [-1, 1]) M(r.body, G.cone(0.25, 1.4, 4), ac, [sx * (1.3 - i * 0.1), -0.4, -i * 1.8], [0, 0, sx * 2], [1, 1, 0.3]); M(r.body, G.cone(0.2, 0.9, 4), gl, [0, 1.4 - i * 0.15, -i * 1.8], [0, 0, 0], [0.4, 1, 1]); }
  const tf = grp(r.body, [0, 0, -13]); M(tf, G.cone(1.2, 3, 4), ac, [0, 0, -0.5], [-Math.PI / 2, 0, 0], [3, 1, 0.3]); r.segs.push(tf);
  for (let i = 0; i < 4; i++) orb(r, M(r.body, G.sph(0.2, 6, 5), addMat(0xbfeaff, 0.5), [0, 0, 0], undefined, 1, false), i * 1.6, 3.5, 0.5, 0.7);
  return finish(r);
}
function bossDevourer(d: BossDef): Rig {
  const r = mk('orb', 6, 2.6, 3.2), gl = glowMat(d.glow, 3), pk = glowMat(d.accent, 3);
  M(r.body, G.sph(2.3, 24, 18), mat(0x050308, { rough: 0.3, metal: 0.6 }), [0, 0, 0]); M(r.body, G.sph(2.55, 18, 14), addMat(d.accent, 0.12), [0, 0, 0], undefined, 1, false);
  const head = grp(r.body, [0, 0, 1.8]); r.head = head;
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; M(head, G.cone(0.14, 0.9, 4), mat(0xe8e0ff, { rough: 0.3 }), [Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.2], [Math.PI / 2 + Math.sin(a) * 0.5, -Math.cos(a) * 0.5, 0]); }
  M(head, G.sph(0.8, 12, 9), pk, [0, 0, 0.1], undefined, [1, 1, 0.5]);
  for (let i = 0; i < 6; i++) { const a = i * 1.1; M(r.body, G.sph(0.3, 8, 6), gl, [Math.cos(a) * 1.7, Math.sin(a * 1.7) * 1.4, -0.6 - Math.abs(Math.sin(a)) * 0.8], undefined, [1, 1.3, 1]); }
  for (let i = 0; i < 3; i++) orb(r, M(r.body, G.tor(3.2 + i * 0.7, 0.07, 6, 48), i % 2 ? gl : pk, [0, 0, 0], [Math.PI / 2 + i * 0.5, i * 0.7, 0], 1, false), 0, 0, 0, 0.5 + i * 0.3);
  for (let i = 0; i < 9; i++) orb(r, M(r.body, G.oct(0.35 + (i % 3) * 0.15, 0), mat(0x1a1030, { em: d.accent, ei: 0.6, flat: true }), [0, 0, 0], [i, i, 0]), i * 0.7, 3.6 + (i % 3) * 0.6, (i % 4) - 1.5, 0.5);
  for (let k = 0; k < 6; k++) { let t: THREE.Object3D = grp(r.body, [Math.cos(k) * 1.5, Math.sin(k) * 1.5 - 0.5, -1.5], [0, Math.PI, 0]); for (let i = 0; i < 4; i++) { M(t, G.cone(0.3 - i * 0.05, 1.2, 5), mat(0x0c0818), [0, 0, 0.5], [Math.PI / 2, 0, 0]); r.segs.push(t); t = grp(t, [0, 0, 1.0]); } }
  r.armR = head;
  return finish(r);
}
export function buildBoss(idx: number, d: BossDef): Rig {
  let r: Rig;
  switch (idx) {
    case 0: r = bossColossus(d, 'ruin'); break; case 1: r = bossColossus(d, 'frost'); break; case 2: r = bossDragon(d, 'inferno'); break; case 3: r = bossBeast(d); break;
    case 4: r = bossLeviathan(d); break; case 5: r = bossColossus(d, 'overlord'); break; case 6: r = bossDragon(d, 'emperor'); break;
    case 7: r = bossColossus(d, 'monarch'); break; case 8: r = bossColossus(d, 'archon'); break; default: r = bossDevourer(d);
  }
  r.root.scale.setScalar(d.scale * 0.8); r.radius *= d.scale * 0.8; r.height *= d.scale * 0.8; r.hover *= d.scale * 0.8;
  return r;
}

// ---------- ANIMATION ----------
export interface AnimIn { move: number; wind: number; strike: number; stagger: number; dead: number; stun: boolean; boss?: boolean }
export function animateRig(r: Rig, t: number, o: AnimIn) {
  const ph = t * (3 + o.move * 5), sw = Math.sin(ph) * Math.min(1, o.move) * 0.85, W = o.wind, S = o.strike;
  const dead = o.dead, bossy = r.radius > 1.5 ? 0.6 : 1;
  // orbiters
  for (const ob of r.orbit) { const u = ob.userData; if (u.rad > 0) { const a = u.ang + t * u.sp; ob.position.set(Math.cos(a) * u.rad, u.y + Math.sin(a * 2) * 0.1, Math.sin(a) * u.rad); ob.rotation.y += 0.02; } else { ob.rotation.x += 0.004 * u.sp; ob.rotation.y += 0.007 * u.sp; } }
  for (const f of r.segs) if (f.userData.flame !== undefined) { const k = 1 + Math.sin(t * 14 + f.userData.flame * 2) * 0.25; f.scale.set(k, 1 + (k - 1) * 2, k); }
  r.body.position.y = r.hover + (r.tpl === 'floater' || r.tpl === 'winged' || r.tpl === 'serpent' || r.tpl === 'orb' ? Math.sin(t * 2) * 0.12 * (r.radius > 1.5 ? 3 : 1) : 0);
  switch (r.tpl) {
    case 'humanoid': case 'golem': {
      const big = r.tpl === 'golem' ? 0.6 : 1;
      r.legs.forEach((l, i) => (l.rotation.x = (i % 2 ? -sw : sw) * big));
      if (r.armR) r.armR.rotation.x = -0.2 + sw * 0.6 * big - W * 2.5 - S * 1.4;
      if (r.armL) r.armL.rotation.x = -0.2 - sw * 0.6 * big - W * (r.tpl === 'golem' ? 2.5 : 0.4) - S * (r.tpl === 'golem' ? 1.4 : 0.2);
      r.body.rotation.x = -W * 0.25 * bossy + S * 0.3 * bossy - o.stagger * 0.5 + Math.abs(sw) * 0.05;
      r.body.rotation.y = W * 0.4 - S * 0.5;
      if (r.head) r.head.rotation.z = o.stagger * Math.sin(t * 40) * 0.2;
      for (const w of r.wings) w.rotation.z = Math.sin(t * 3) * 0.1 * (w.position.x > 0 ? 1 : -1);
      break;
    }
    case 'beast': {
      r.legs.forEach((l, i) => (l.rotation.x = (i === 0 || i === 3 ? sw : -sw) * 0.9));
      r.body.rotation.x = -W * 0.45 + S * 0.35 - o.stagger * 0.4;
      if (r.head) r.head.rotation.x = W * -0.4 + S * 0.6;
      if (r.armR) r.armR.rotation.y = Math.sin(t * 3) * 0.4;
      r.segs.forEach((s, i) => { if (s.userData.flame === undefined) s.rotation.y = Math.sin(t * 2.5 - i * 0.6) * 0.3; });
      r.wings.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * (Math.sin(t * 2) * 0.25 + 0.2 + W * 0.5)));
      break;
    }
    case 'floater': {
      if (r.armR) r.armR.rotation.x = -0.3 - W * 1.8 - S * 0.8; if (r.armL) r.armL.rotation.x = -0.3 - W * 1.8 - S * 0.8;
      r.body.rotation.x = -W * 0.2 + S * 0.2 - o.stagger * 0.4; r.body.position.y += Math.sin(t * 2.6) * 0.1;
      break;
    }
    case 'crawler': {
      r.legs.forEach((l, i) => { l.rotation.z = (i % 2 ? 1 : -1) * 0.9 + Math.sin(ph + i * 1.3) * 0.35 * (0.3 + o.move); l.rotation.y = Math.sin(ph + i) * 0.3 * o.move; });
      r.body.rotation.x = -W * 0.5 + S * 0.35 - o.stagger * 0.4; break;
    }
    case 'winged': {
      r.wings.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * Math.sin(t * 7) * 0.55));
      r.body.rotation.x = -W * 0.4 + S * 0.5 + o.move * 0.15 - o.stagger * 0.4; break;
    }
    case 'serpent': {
      r.segs.forEach((s, i) => { s.position.x = Math.sin(t * 1.6 - i * 0.7) * (0.4 + i * 0.25); s.position.y = Math.cos(t * 1.3 - i * 0.6) * 0.3; });
      if (r.head) { r.head.rotation.x = -W * 0.2 + S * 0.35; r.head.position.x = Math.sin(t * 1.6 + 0.7) * 0.3; }
      if (r.armR) r.armR.rotation.x = W * 0.7 - S * 0.5 + Math.sin(t * 2) * 0.05; break;
    }
    case 'orb': {
      if (r.head) { r.head.scale.setScalar(1 + W * 0.25 - S * 0.15); r.head.rotation.z += 0.03 + W * 0.2; }
      r.segs.forEach((s, i) => { s.rotation.x = Math.sin(t * 2 - i * 0.5) * 0.35; s.rotation.y = Math.cos(t * 1.7 - i * 0.4) * 0.3; });
      break;
    }
  }
  if (r.tpl === 'beast' && r.wings.length && !r.wings[0].userData.k) { /* wings rest handled above */ }
  if (dead > 0) { r.root.rotation.x = -dead * 1.4; r.root.position.y = -dead * (r.hover > 0 ? r.hover : 0.2); }
}
