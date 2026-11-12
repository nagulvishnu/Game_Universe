// Procedural models: airships, structures, resource nodes, kingdom buildings, instanced decor.
import * as THREE from 'three';
import { SHIPS } from './data';
import { at, box, cone, cyl, gBox, gCone, gCyl, gIco, glow, grp, ico, mat, mergeParts, shadowify, sph, torus, type GPart } from './gfx';

export interface PaintInst { hullColor: string; sailColor: string; trimColor: string; decor: string[]; style: string; upgrades: Record<string, number> }

// ───────── airships ─────────
export function buildAirship(typeId: string, inst: PaintInst, pirate = false): THREE.Group {
  const def = SHIPS[typeId]; const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const hc = inst.hullColor, sc = inst.sailColor, tc = inst.trimColor; const props: THREE.Object3D[] = []; const exhausts: THREE.Vector3[] = [];
  const s = new THREE.Shape(); s.moveTo(-3.6, 1.15); s.lineTo(-3.3, -0.1); s.quadraticCurveTo(-1, -1.0, 2.6, -0.5); s.lineTo(4.3, 0.95); s.lineTo(4.3, 1.15); s.closePath();
  const hg = new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 }); hg.translate(0, 0, -1.1); hg.rotateY(-Math.PI / 2); hg.computeVertexNormals();
  body.add(new THREE.Mesh(hg, mat(hc, { rough: 0.7 })));
  body.add(box(2.0, 0.08, 7.4, '#c8a06a', [0, 1.2, 0.2]), box(0.1, 0.14, 7.8, tc, [-1.14, 1.12, 0.2], { metal: 0.5 }), box(0.1, 0.14, 7.8, tc, [1.14, 1.12, 0.2], { metal: 0.5 }), box(2.0, 0.14, 0.1, tc, [0, 1.15, 4.0], { metal: 0.5 }));
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) body.add(cyl(0.035, 0.035, 0.5, tc, [1.1 * sx, 1.5, -3 + i * 1.3], { metal: 0.5 }, 4));
  for (const sx of [-1, 1]) body.add(box(0.05, 0.05, 7.4, tc, [1.1 * sx, 1.75, 0.2]));
  const cab = grp(box(1.7, 1.0, 1.9, hc, [0, 0.5, 0]), box(1.9, 0.12, 2.1, tc, [0, 1.05, 0]), box(0.9, 0.35, 0.05, '#ffe9a0', [0, 0.6, 0.97], { em: '#ffcf70', ei: 1.6 }), box(0.05, 0.3, 0.8, '#ffe9a0', [0.86, 0.6, 0], { em: '#ffcf70', ei: 1.6 }), box(0.05, 0.3, 0.8, '#ffe9a0', [-0.86, 0.6, 0], { em: '#ffcf70', ei: 1.6 })); cab.position.set(0, 1.2, -2.5); body.add(cab);
  body.add(box(0.08, 1.4, 1.2, tc, [0, 0.9, -3.75], { metal: 0.4 }), cyl(0.06, 0.06, 0.5, '#4a3a2a', [0, 1.5, -1.2], undefined, 6), torus(0.35, 0.05, '#5a3a22', [0, 1.8, -1.2], undefined, [0, 0, 0]));
  const eng = (x: number, y: number, z: number, r = 0.32) => { const pod = grp(cyl(r, r * 0.8, 1.3, '#3a3a48', [0, 0, 0], { metal: 0.6 }, 10, [Math.PI / 2, 0, 0]), torus(r * 0.85, 0.05, tc, [0, 0, 0.5], { metal: 0.5 }, [0, 0, 0]), cone(r * 0.7, 0.5, '#4fd8ff', [0, 0, -0.85], { em: '#2ac8ff', ei: 1.8, opacity: 0.7 }, 8, [-Math.PI / 2, 0, 0])); pod.position.set(x, y, z);
    const pr = new THREE.Group(); pr.position.set(0, 0, 0.75); for (let b = 0; b < 3; b++) { const bl = box(0.1, r * 3, 0.03, '#d8d8e0', [0, r * 1.5, 0], { metal: 0.5 }); const h = new THREE.Group(); h.rotation.z = (b / 3) * Math.PI * 2; h.add(bl); pr.add(h); } pr.add(sph(0.09, tc, [0, 0, 0.05])); pod.add(pr); props.push(pr); body.add(pod); exhausts.push(new THREE.Vector3(x, y, z - 0.9)); body.add(glow('#4fd8ff', 1.4, [x, y, z - 0.85], 0.8)); };
  eng(-1.45, 0.6, -0.8); eng(1.45, 0.6, -0.8);
  if (def.id === 'titan') { eng(-1.7, 0.2, 1.8, 0.4); eng(1.7, 0.2, 1.8, 0.4); }
  const style = inst.style;
  if (style === 'balloon') {
    const env = sph(1, sc, [0, 4.7, 0.2], { rough: 0.6, flat: false }, 16, [2.2, 1.6, 4.0]); body.add(env);
    for (const z of [-2.2, -0.4, 1.4, 3]) { const rr = 2.15 * Math.sqrt(Math.max(0.05, 1 - Math.pow((z - 0.2) / 4.0, 2))); const t = torus(1, 0.06, tc, [0, 4.7, z], { metal: 0.4 }, [0, 0, 0]); t.scale.set(rr * 1.02, rr * 0.74, 1); body.add(t); }
    for (const sx of [-1, 1]) for (const z of [-1.6, 1.8]) { const top = new THREE.Vector3(0.95 * sx, 3.3, z * 0.9), bot = new THREE.Vector3(0.95 * sx, 1.25, z); const m = cyl(0.025, 0.025, top.distanceTo(bot), '#3a2a1a', [(top.x + bot.x) / 2, (top.y + bot.y) / 2, (top.z + bot.z) / 2], undefined, 4); body.add(m); }
    body.add(box(0.1, 1.8, 1.6, tc, [0, 5.0, -3.9], { metal: 0.3 }), box(1.8, 0.1, 1.4, tc, [0, 4.7, -3.8], { metal: 0.3 }));
    if (def.id === 'titan') for (const sx of [-1, 1]) { body.add(sph(1, sc, [3.4 * sx, 3.8, 0.4], { flat: false }, 12, [1.2, 1, 2.4]), cyl(0.04, 0.04, 2.4, '#3a2a1a', [2.6 * sx, 2.5, 0.4], undefined, 4, [0, 0, 0.5 * sx])); }
  } else if (style === 'sails') {
    for (const [z, h] of [[1.6, 6.2], [-1.0, 5.4]] as [number, number][]) { body.add(cyl(0.09, 0.11, h, '#5a3a22', [0, 1.2 + h / 2, z], undefined, 6));
      for (let k = 0; k < 2; k++) { const y = 2.6 + k * 1.9; const w = 3.2 - k * 0.7; body.add(box(w + 0.3, 0.09, 0.09, '#5a3a22', [0, y + 0.85, z]), at(box(w, 1.7, 0.07, sc, [0, y, z + 0.1], { flat: false, side: THREE.DoubleSide, rough: 0.9 }), 0, y, z + 0.1, 0.08, 0, 0), box(w * 0.9, 0.12, 0.09, tc, [0, y - 0.2, z + 0.15])); } }
    body.add(cone(0.18, 0.8, tc, [0, 1.2 + 6.2 + 0.3, 1.6], { metal: 0.6 }, 5));
  } else {
    for (const sx of [-1, 1]) { const w = grp(box(4.6, 0.12, 1.9, sc, [2.3 * sx, 0, 0], { rough: 0.5 }), box(4.6, 0.14, 0.14, tc, [2.3 * sx, 0.02, 0.95], { metal: 0.5 }), box(0.3, 0.15, 1.9, tc, [4.5 * sx, 0, 0], { metal: 0.5 })); w.position.set(0.7 * sx, 1.5, 0.4); w.rotation.set(0, -0.35 * sx, 0.12 * sx); body.add(w); }
    body.add(box(0.12, 1.8, 1.6, sc, [0, 2.0, -3.4]), box(0.9, 0.5, 1.4, '#9ad8ff', [0, 1.6, 0.8], { opacity: 0.7, em: '#4ac8ff', ei: 0.4 }), cone(0.5, 1.2, '#3a3a48', [0, 0.6, 4.8], { metal: 0.7 }, 6, [Math.PI / 2, 0, 0]));
    if (def.id === 'falcon') for (const sx of [-1, 1]) body.add(box(0.12, 0.9, 5, '#3a3a48', [1.12 * sx, 0.6, 0.4], { metal: 0.7, rough: 0.35 }), box(0.14, 0.2, 5.2, tc, [1.14 * sx, 1.0, 0.4], { metal: 0.6 }));
  }
  // weapon mounts
  const W = def.weapons; const gun = (x: number, y: number, z: number, l = 1.2, r = 0.12) => body.add(cyl(r, r * 1.2, l, '#2a2a34', [x, y, z + l / 2 - 0.2], { metal: 0.7 }, 8, [Math.PI / 2, 0, 0]), sph(r * 1.5, '#4a4a58', [x, y, z - 0.1], { metal: 0.6 }, 6));
  if (W.includes('cannon')) { gun(-0.7, 1.45, 2.8); gun(0.7, 1.45, 2.8); }
  if (W.includes('repeater')) { gun(-1.05, 1.5, 0.8, 0.8, 0.06); gun(1.05, 1.5, 0.8, 0.8, 0.06); }
  if (W.includes('missile')) for (const sx of [-1, 1]) body.add(box(0.5, 0.35, 1.3, '#3a3a48', [1.0 * sx, 1.55, -0.6], { metal: 0.6 }), cone(0.1, 0.4, '#d94a4a', [1.0 * sx - 0.12, 1.55, 0.2], undefined, 5, [Math.PI / 2, 0, 0]), cone(0.1, 0.4, '#d94a4a', [1.0 * sx + 0.12, 1.55, 0.2], undefined, 5, [Math.PI / 2, 0, 0]));
  if (W.includes('energy')) body.add(cyl(0.3, 0.38, 0.8, '#3a3a58', [0, 1.5, 3.2], { metal: 0.7 }, 8, [Math.PI / 2, 0, 0]), sph(0.3, '#6af0ff', [0, 1.5, 3.65], { em: '#2ad8ff', ei: 3 }, 8), glow('#6af0ff', 1.2, [0, 1.5, 3.65], 0.9));
  if (W.includes('bomb')) body.add(box(0.9, 0.3, 1.4, '#2a2a34', [0, -0.35, 0.4], { metal: 0.6 }));
  const ar = inst.upgrades?.armor || 0; for (let i = 0; i < ar; i++) for (const sx of [-1, 1]) body.add(box(0.08, 0.55, 1.1, '#9aa5b5', [1.15 * sx, 0.45, -2.5 + i * 1.3], { metal: 0.7, rough: 0.3 }));
  // decor
  const d = inst.decor || [];
  if (d.includes('flag')) { const f = grp(cyl(0.03, 0.03, 1.8, '#4a3a2a', [0, 0.9, 0], undefined, 4), box(1.1, 0.55, 0.03, tc, [0.6, 1.5, 0], { flat: false, em: tc, ei: 0.3, side: THREE.DoubleSide })); f.position.set(0, 1.9, -3.7); body.add(f); root.userData.flag = f.children[1]; }
  if (d.includes('lanterns')) for (const [x, z] of [[-1.1, 3.6], [1.1, 3.6], [-1.1, -3], [1.1, -3]]) body.add(sph(0.12, '#ffe9a0', [x, 1.9, z], { em: '#ffcf70', ei: 2.5 }, 6), glow('#ffd070', 1.2, [x, 1.9, z], 0.7));
  if (d.includes('figurehead')) body.add(cone(0.35, 1.1, tc, [0, 1.6, 4.6], { metal: 0.5 }, 5, [Math.PI / 2.4, 0, 0]), sph(0.28, tc, [0, 1.9, 4.3], { metal: 0.5 }, 6), cone(0.08, 0.5, '#fff', [-0.16, 2.2, 4.2], undefined, 4), cone(0.08, 0.5, '#fff', [0.16, 2.2, 4.2], undefined, 4));
  if (d.includes('runes')) for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) body.add(box(0.04, 0.3, 0.3, '#6af0ff', [1.19 * sx, 0.55, -2.4 + i * 1.5], { em: '#2ad8ff', ei: 3 }));
  if (d.includes('ribbons')) for (const sx of [-1, 1]) body.add(box(0.15, 0.03, 3.2, tc, [0.8 * sx, 1.8, -5.2], { em: tc, ei: 0.5, opacity: 0.8 }));
  if (pirate) { body.add(box(1.0, 0.7, 0.04, '#111', [0, 7.4, 1.6], { side: THREE.DoubleSide }), box(0.28, 0.28, 0.05, '#eee', [0, 7.4, 1.62]), box(0.5, 0.06, 0.05, '#eee', [0, 7.25, 1.62])); }
  root.userData = { ...root.userData, props, exhausts, body, scale: def.scale };
  body.scale.setScalar(def.scale); for (const e of exhausts) e.multiplyScalar(def.scale);
  return shadowify(root);
}

// ───────── structures ─────────
const WOOD = '#8a5a34', STONE = '#9a9486', ROOF = '#b5472f', PLASTER = '#e8dcc0';
const GLOWWIN = { em: '#ffcf70', ei: 1.8 };
function roof(w: number, h: number, d: number, c: string) { const r = cone(1, h, c, [0, 0, 0], undefined, 4, [0, Math.PI / 4, 0]); r.scale.set(w * 0.72, 1, d * 0.72); return r; }
function houseBase(w: number, h: number, d: number, wall: string, rf: string) {
  const g = new THREE.Group(); g.add(box(w, h, d, wall, [0, h / 2, 0]), at(roof(w, h * 0.8, d, rf), 0, h + h * 0.4, 0), box(0.9, 1.7, 0.1, '#5a3a22', [0, 0.85, d / 2 + 0.02]), box(0.7, 0.6, 0.1, '#ffe9a0', [w * 0.28, h * 0.6, d / 2 + 0.02], GLOWWIN), box(0.7, 0.6, 0.1, '#ffe9a0', [-w * 0.28, h * 0.6, d / 2 + 0.02], GLOWWIN), box(0.6, 1.4, 0.6, STONE, [w * 0.3, h + 1.0, -d * 0.2])); return g;
}
export function buildStruct(type: string, biome: string, s = 1): THREE.Group {
  const g = new THREE.Group(); const frost = biome === 'frost', cel = biome === 'celestial', shd = biome === 'shadow', emb = biome === 'ember';
  const wall = frost ? '#dbe8f5' : cel ? '#f6f2ea' : shd ? '#4a3c66' : emb ? '#4a3a36' : PLASTER, rf = frost ? '#7aa8d8' : cel ? '#ffe08a' : shd ? '#2a1f44' : emb ? '#6a2a1a' : ROOF, stn = frost ? '#b5c9de' : cel ? '#e8e4f4' : shd ? '#3a2f55' : emb ? '#3a2c28' : STONE;
  const glw = cel ? { em: '#bfe8ff', ei: 1.2 } : shd ? { em: '#b04cff', ei: 2 } : GLOWWIN;
  switch (type) {
    case 'house': g.add(houseBase(5, 3, 4.2, ['#e8dcc0', '#d8c8a8', '#e4d0b0'][Math.floor(Math.abs(Math.sin(s * 99)) * 3)], rf)); break;
    case 'smithy': g.add(box(6, 3, 5, '#7a7468', [0, 1.5, 0]), at(roof(6, 2, 5, '#4a3a32'), 0, 4, 0), box(1.2, 4.5, 1.2, '#5a5448', [2, 3, -1.5]), glow('#ff7a1a', 2.5, [0, 1.2, 2.4], 0.9), box(1.6, 1.2, 0.2, '#ff7a1a', [0, 1.0, 2.52], { em: '#ff5a00', ei: 2.2 }), box(0.8, 0.5, 0.5, '#2a2a30', [2.4, 0.6, 3], { metal: 0.7 }), box(0.3, 0.3, 0.3, '#2a2a30', [2.4, 0.2, 3])); break;
    case 'stall': { const c1 = ['#d94a4a', '#4a8ad9', '#e0b030'][Math.floor(Math.abs(Math.sin(s * 77 + 1)) * 3)]; g.add(box(2.4, 0.9, 1.2, WOOD, [0, 0.45, 0]), box(2.8, 0.12, 1.8, c1, [0, 2.4, 0], undefined, [0.2, 0, 0]), cyl(0.06, 0.06, 2.4, WOOD, [-1.3, 1.2, 0.8]), cyl(0.06, 0.06, 2.4, WOOD, [1.3, 1.2, 0.8]), sph(0.2, '#e0553a', [-0.6, 1.0, 0]), sph(0.2, '#7ac04a', [0, 1.0, 0]), sph(0.2, '#e0b030', [0.6, 1.0, 0])); break; }
    case 'dock': { g.add(box(14, 0.5, 11, '#7a5a3a', [0, 0.25, 0]), box(14.4, 0.2, 0.4, '#5a3a22', [0, 0.55, 5.4]), box(14.4, 0.2, 0.4, '#5a3a22', [0, 0.55, -5.4])); for (const x of [-6.5, 0, 6.5]) for (const z of [-5, 5]) g.add(cyl(0.2, 0.25, 1.8, '#4a3220', [x, 0.9, z], undefined, 6)); g.add(box(1, 1, 1, '#a07a4a', [-5, 1, -3]), box(1, 1, 1, '#a07a4a', [-5, 2, -3]), cyl(0.5, 0.5, 1.1, '#6a4a2a', [-5.5, 1.05, 3], undefined, 8), cyl(0.06, 0.06, 3, '#4a3220', [6.5, 2, 4.8]), sph(0.2, '#ffe9a0', [6.5, 3.6, 4.8], { em: '#ffcf70', ei: 2 }), glow('#ffd070', 2, [6.5, 3.6, 4.8], 0.7)); break; }
    case 'shipyard': { g.add(box(8, 0.3, 8, '#6a5a4a', [0, 0.15, 0]), box(0.5, 6, 0.5, WOOD, [-3, 3, -3]), box(0.5, 6, 0.5, WOOD, [3, 3, -3]), box(6.5, 0.5, 0.5, WOOD, [0, 6, -3]), box(0.2, 3, 0.2, '#3a3a40', [0, 4.5, -3], { metal: 0.6 }), box(1.6, 0.8, 1.6, '#3a3a40', [0, 2.8, -3], { metal: 0.6 }), box(2.6, 2.4, 2.6, '#7a6248', [-2, 1.2, 2.5]), at(roof(2.6, 1.2, 2.6, '#4a3a32'), -2, 3, 2.5), box(0.14, 2, 5, WOOD, [2.4, 1.2, 1]), box(0.14, 2, 5, WOOD, [3.4, 1.2, 1]), box(1.0, 0.5, 0.1, '#6af0ff', [0, 2.5, 4.1], { em: '#2ad8ff', ei: 2 }), glow('#6af0ff', 3, [0, 2.5, 4.2], 0.5)); const gr = grp(cyl(0.7, 0.7, 0.2, '#8a6a2a', undefined, { metal: 0.6 }, 10, [Math.PI / 2, 0, 0]), box(1.6, 0.18, 0.2, '#8a6a2a'), box(0.18, 1.6, 0.2, '#8a6a2a')); gr.position.set(0, 4.5, -2.6); g.add(gr); g.userData.spin = gr; break; }
    case 'temple': {
      const sc = (c: string) => (cel ? '#f6f2ea' : c); g.add(box(14, 0.8, 14, sc('#8f8a7a'), [0, 0.4, 0]), box(11, 0.8, 11, sc('#a09a8a'), [0, 1.2, 0]), box(8, 0.6, 8, sc('#b0aa9a'), [0, 1.9, 0]));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; const h = i % 3 === 1 ? 3 : 6; g.add(cyl(0.6, 0.7, h, '#c4bfae', [Math.cos(a) * 4.6, 2.2 + h / 2, Math.sin(a) * 4.6], undefined, 8), box(1.6, 0.4, 1.6, '#b0aa9a', [Math.cos(a) * 4.6, 2.2 + h + 0.2, Math.sin(a) * 4.6])); if (i % 3 !== 1) g.add(box(2.6, 0.5, 1.2, '#a09a8a', [Math.cos(a) * 4.6 * 0.5, 8.4, Math.sin(a) * 4.6 * 0.5], undefined, [0, -a, 0])); }
      const orb = sph(0.6, '#6af0ff', [0, 4.2, 0], { em: '#2ad8ff', ei: 2.5 }, 12); g.add(box(1.8, 1.6, 1.8, '#d4cfbe', [0, 2.9, 0]), orb, glow('#6af0ff', 4, [0, 4.2, 0], 0.7), torus(1.2, 0.05, '#6af0ff', [0, 4.2, 0], { em: '#2ad8ff', ei: 2 }, [Math.PI / 2, 0, 0]));
      for (let i = 0; i < 4; i++) g.add(box(0.2, 0.05, 4, '#2ad8ff', [Math.cos(i * 1.57) * 2.5, 2.25, Math.sin(i * 1.57) * 2.5], { em: '#2ad8ff', ei: 1.5 }, [0, i * 1.57, 0]));
      g.add(box(2.6, 0.7, 2, '#8f8a7a', [0, 0.5, 8], undefined, [0, 0, 0])); g.userData.orb = orb; break; }
    case 'tent': g.add(cone(2.2, 2.6, ['#c9a45a', '#a8483a', '#6a8aa8'][Math.floor(Math.abs(Math.sin(s * 31)) * 3)], [0, 1.3, 0], undefined, 5), box(0.9, 1.5, 0.05, '#2a2018', [0, 0.75, 1.5])); break;
    case 'camp': g.add(cyl(0.9, 1.0, 0.25, '#3a3a40', [0, 0.12, 0], undefined, 8), cone(0.5, 1.1, '#ff8a1a', [0, 0.8, 0], { em: '#ff6a00', ei: 2.5 }, 5), cone(0.3, 0.8, '#ffe27a', [0, 0.7, 0], { em: '#ffc400', ei: 3 }, 5), glow('#ff8a2a', 5, [0, 1, 0], 0.8), cyl(0.15, 0.15, 1.6, '#5a3a22', [1.6, 0.3, 0.3], undefined, 5, [0, 0, Math.PI / 2]), cyl(0.15, 0.15, 1.6, '#5a3a22', [-1.5, 0.3, -0.5], undefined, 5, [0, 0.5, Math.PI / 2])); break;
    case 'bigCastle': {
      const rooft = cel ? '#ffd86a' : frost ? '#6aa8e8' : '#8a3a3a'; g.add(box(26, 5, 26, stn, [0, 2.5, 0]), box(18, 4, 18, wall, [0, 7, 0]));
      for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) { g.add(cyl(3, 3.4, 14, wall, [x, 7, z], undefined, 10), cone(3.8, 5.5, rooft, [x, 16.5, z], cel ? { em: '#ffd070', ei: 0.5 } : undefined, 10), box(0.5, 1.4, 0.2, '#ffe9a0', [x, 9, z + 3.1], glw)); if (cel) g.add(glow('#ffe9a0', 6, [x, 19.5, z], 0.6)); }
      g.add(cyl(4.5, 5, 22, wall, [0, 11, 0], undefined, 12), cone(5.6, 9, rooft, [0, 26.5, 0], cel ? { em: '#ffd070', ei: 0.5 } : undefined, 12), box(5, 7, 0.4, '#3a3a50', [0, 3.5, 13.1]), box(6, 1, 1, '#c4bfae', [0, 7.4, 13.3]));
      for (let i = 0; i < 6; i++) g.add(box(0.7, 2.2, 0.15, '#ffe9a0', [(i - 2.5) * 2.4, 12 + (i % 2) * 3, 4.6], glw));
      if (frost) for (let i = 0; i < 14; i++) g.add(cone(0.35, 2 + (i % 3), '#bfe8ff', [(i - 7) * 1.8, 4.6, 13.2], { em: '#6ac8ff', ei: 0.5, opacity: 0.8 }, 5, [Math.PI, 0, 0]));
      if (cel) { g.add(cone(0.3, 6, '#ffe9a0', [0, 33, 0], { em: '#ffd070', ei: 2 }, 5), glow('#ffe9a0', 14, [0, 32, 0], 0.7)); for (let i = 0; i < 6; i++) g.add(torus(8 + i * 0.4, 0.15, '#ffe9a0', [0, 5 + i * 0.1, 0], { em: '#ffd070', ei: 1.5, opacity: 0.6 }, [Math.PI / 2, 0, 0])); }
      for (let i = 0; i < 4; i++) g.add(box(1.4, 3, 0.1, i % 2 ? '#3a6ad9' : '#d9a03a', [(i - 1.5) * 3.2, 9, 9.1])); break; }
    case 'castle': g.add(houseBase(6, 4, 6, wall, rf)); break;
    case 'tower': { const H = 20; g.add(cyl(3, 3.6, H, '#9a9486', [0, H / 2, 0], undefined, 10), cyl(3.8, 3.8, 0.7, '#7a7468', [0, H + 0.35, 0], undefined, 10));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; g.add(box(1, 1.1, 1, '#8a8478', [Math.cos(a) * 3.5, H + 1.2, Math.sin(a) * 3.5])); }
      for (let i = 0; i < 13; i++) g.add(box(1.1, 0.12, 0.15, '#6a4a2a', [0, 1 + i * 1.5, 3.6])); g.add(box(0.1, H, 0.1, '#6a4a2a', [-0.55, H / 2, 3.6]), box(0.1, H, 0.1, '#6a4a2a', [0.55, H / 2, 3.6]), box(0.5, 0.9, 0.1, '#ffe9a0', [0, 14, 3.1], GLOWWIN)); break; }
    case 'gear': { const gr = new THREE.Group(); gr.add(cyl(4, 4, 0.8, '#8a6a2a', [0, 0, 0], { metal: 0.6 }, 16, [Math.PI / 2, 0, 0]), cyl(1.2, 1.2, 1.2, '#5a4a2a', [0, 0, 0], { metal: 0.6 }, 10, [Math.PI / 2, 0, 0])); for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; gr.add(box(1.1, 1.4, 0.8, '#8a6a2a', [Math.cos(a) * 4.3, Math.sin(a) * 4.3, 0], { metal: 0.6 }, [0, 0, a])); } gr.add(box(8, 0.5, 0.6, '#6a5a3a', [0, 0, 0]), box(0.5, 8, 0.6, '#6a5a3a', [0, 0, 0])); gr.position.y = 4.2; g.add(gr, box(3, 2, 3, '#6a6458', [0, 1, 0]), glow('#ffb02e', 5, [0, 4.2, 0.6], 0.5)); g.userData.spin = gr; break; }
    case 'hauntedTower': { let y = 0; for (let i = 0; i < 6; i++) { const w = 6 - i * 0.7; const b = box(w, 4, w, '#3a2f55', [Math.sin(i * 1.3) * 0.7, y + 2, Math.cos(i * 1.7) * 0.7], undefined, [0.03 * Math.sin(i * 2), i * 0.3, 0.04 * Math.cos(i)]); g.add(b, box(0.7, 1.4, 0.1, '#b04cff', [Math.sin(i * 1.3) * 0.7, y + 2.3, Math.cos(i * 1.7) * 0.7 + w / 2 + 0.05], { em: '#b04cff', ei: 2.5 })); y += 3.8; } g.add(cone(2.2, 6, '#1a1030', [0, y + 3, 0], undefined, 6), glow('#b04cff', 8, [0, 8, 3], 0.4)); break; }
    case 'forge': g.add(box(10, 4, 7, '#3a2c28', [0, 2, 0]), box(3, 7, 3, '#2a1c18', [3, 5, -1.5]), box(3, 2.4, 0.3, '#ff7a1a', [-1, 1.4, 3.6], { em: '#ff5a00', ei: 2.5 }), glow('#ff6a1a', 7, [-1, 1.8, 4], 0.8), glow('#ff6a1a', 6, [3, 8.8, -1.5], 0.7), box(2, 0.9, 1.1, '#1a1a1e', [3.4, 0.5, 4.8], { metal: 0.7 })); break;
    case 'shrine': { g.add(cyl(7, 7.5, 0.8, '#f6f2ea', [0, 0.4, 0], undefined, 12), torus(6, 0.15, '#bfe8ff', [0, 0.9, 0], { em: '#8fe8ff', ei: 2 }, [Math.PI / 2, 0, 0])); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; g.add(cyl(0.45, 0.5, 6, '#f6f2ea', [Math.cos(a) * 5.6, 3.8, Math.sin(a) * 5.6], undefined, 8), box(1.2, 0.4, 1.2, '#ffe9a0', [Math.cos(a) * 5.6, 7, Math.sin(a) * 5.6], { em: '#ffd070', ei: 0.8 })); } const c = ico(1.1, '#ffe9a0', [0, 4, 0], { em: '#ffd070', ei: 2.5 }, 0); g.add(c, glow('#ffe9a0', 7, [0, 4, 0], 0.8)); g.userData.bob = c; break; }
    case 'graveyard': for (let i = 0; i < 10; i++) g.add(box(0.9, 1.4 + (i % 3) * 0.3, 0.3, '#5a5470', [(i % 5 - 2) * 3, 0.7, Math.floor(i / 5) * 4 - 2], undefined, [0, (i * 0.7) % 1 - 0.5, (i % 2 ? 0.1 : -0.1)]), box(0.3, 0.1, 0.9, '#3a3450', [(i % 5 - 2) * 3, 0.05, Math.floor(i / 5) * 4 - 1.2])); g.add(glow('#b04cff', 9, [0, 1, 0], 0.25)); break;
    case 'ruinArch': g.add(cyl(0.7, 0.8, 5, stn === STONE ? '#b8b2a0' : stn, [-2, 2.5, 0], undefined, 7), cyl(0.7, 0.8, 3, stn === STONE ? '#b8b2a0' : stn, [2, 1.5, 0], undefined, 7), box(3.2, 0.7, 1.1, stn === STONE ? '#a8a290' : stn, [-0.6, 5.2, 0], undefined, [0, 0, 0.1])); if (cel) g.add(glow('#ffe9a0', 6, [-2, 5.5, 0], 0.5)); if (shd) g.add(glow('#b04cff', 5, [-2, 4, 0], 0.5)); break;
    case 'cave': g.add(ico(5, '#6a6a72', [0, 1.5, 0], undefined, 0, [1.6, 1, 1.2]), box(3, 3.6, 3, '#07070c', [0, 1.8, 3.2]), ico(1.4, '#7a7a84', [-3.2, 1, 3.4]), ico(1.6, '#7a7a84', [3.2, 1.2, 3.4]), cone(0.5, 2, frost ? '#8fe8ff' : '#c26bff', [-1.5, 0.8, 4.2], { em: frost ? '#4ac8ff' : '#a04cff', ei: 2 }, 5), cone(0.4, 1.4, frost ? '#8fe8ff' : '#c26bff', [1.4, 0.6, 4.4], { em: frost ? '#4ac8ff' : '#a04cff', ei: 2 }, 5), glow(frost ? '#6ac8ff' : '#b04cff', 6, [0, 1.5, 4], 0.5)); break;
    case 'pedestal': g.add(cyl(0.9, 1.3, 1.6, '#c8d8e8', [0, 0.8, 0], undefined, 6), torus(0.9, 0.06, '#8fe8ff', [0, 1.7, 0], { em: '#4ac8ff', ei: 2 }, [Math.PI / 2, 0, 0])); break;
    case 'bannerPole': g.add(cyl(0.1, 0.12, 7, '#6a4a2a', [0, 3.5, 0], undefined, 5), box(2.2, 1.4, 0.05, '#d9a03a', [1.2, 6, 0]), box(1.4, 0.2, 0.06, '#3a6ad9', [0.8, 6, 0.02])); break;
  }
  g.scale.setScalar(s); return shadowify(g);
}

// ───────── resource nodes ─────────
export function buildNode(type: string, biome: string): THREE.Group {
  const g = new THREE.Group(); const lid = new THREE.Group();
  const rock = biome === 'frost' ? '#9ab5d0' : biome === 'ember' ? '#4a3430' : biome === 'shadow' ? '#3a3050' : biome === 'celestial' ? '#d8def0' : '#8a8a90';
  const crys = biome === 'ember' ? ['#ff7a3a', '#ff4a1a'] : biome === 'shadow' ? ['#b04cff', '#7a2ad8'] : biome === 'celestial' ? ['#ffe9a0', '#9ae8ff'] : biome === 'frost' ? ['#8fe8ff', '#4ac8ff'] : ['#6af0ff', '#4aa8ff'];
  switch (type) {
    case 'wood': g.add(cyl(0.45, 0.65, 3.4, '#6a4a2a', [0, 1.7, 0], undefined, 7), ico(2.0, biome === 'frost' ? '#bfe0d0' : biome === 'shadow' ? '#4a3a6a' : '#3f9a3a', [0, 4.4, 0], undefined, 0, [1, 0.9, 1]), ico(1.4, biome === 'frost' ? '#d0eadc' : '#58b848', [0.9, 3.6, 0.5]), cyl(0.2, 0.2, 1.5, '#7a5a3a', [1.2, 0.2, 0.8], undefined, 5, [0, 0, Math.PI / 2]), glow('#ffe27a', 1.5, [0, 2.2, 0.8], 0.5)); break;
    case 'stone': g.add(ico(1.2, rock, [0, 0.7, 0], undefined, 0, [1.2, 0.9, 1]), ico(0.8, rock, [1, 0.4, 0.4]), ico(0.7, '#a0a0a6', [-0.9, 0.35, -0.3]), glow('#ffffff', 1.4, [0, 1.6, 0], 0.35)); break;
    case 'iron': g.add(ico(1.3, '#4a4a54', [0, 0.8, 0], undefined, 0, [1.2, 0.9, 1]), ico(0.8, '#3a3a44', [1, 0.4, 0.4]), box(0.3, 0.3, 0.3, '#e08a4a', [0.4, 1.2, 0.8], { metal: 0.8, em: '#c06a2a', ei: 0.6 }), box(0.25, 0.4, 0.25, '#e8c8a8', [-0.5, 1.0, 0.9], { metal: 0.8, em: '#c09a6a', ei: 0.5 }), glow('#ffb070', 1.6, [0, 1.7, 0], 0.4)); break;
    case 'crystal': for (let i = 0; i < 5; i++) { const a = i * 1.25; const h = 1.4 + (i % 3) * 0.8; g.add(cone(0.35, h, crys[i % 2], [Math.cos(a) * 0.5, h / 2, Math.sin(a) * 0.5], { em: crys[i % 2], ei: 1.8, opacity: 0.92 }, 5, [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25])); } g.add(glow(crys[0], 3.2, [0, 1.2, 0], 0.6)); break;
    case 'essence': { const o = sph(0.5, '#9a8aff', [0, 1.8, 0], { em: '#7a6aff', ei: 2.5, opacity: 0.9 }, 10); g.add(o, torus(0.8, 0.04, '#d8caff', [0, 1.8, 0], { em: '#bba8ff', ei: 2 }, [Math.PI / 2, 0.3, 0]), glow('#9a8aff', 3.5, [0, 1.8, 0], 0.8), cyl(0.5, 0.7, 0.3, '#5a5470', [0, 0.15, 0], undefined, 6)); g.userData.bob = o; break; }
    case 'fragment': g.add(box(0.9, 2.2, 0.5, '#8a8270', [0, 1.1, 0], undefined, [0, 0.3, 0.08]), box(0.5, 0.15, 0.1, '#ffd070', [0, 1.5, 0.28], { em: '#ffb020', ei: 2.5 }, [0, 0.3, 0]), box(0.15, 0.7, 0.1, '#ffd070', [0, 1.1, 0.28], { em: '#ffb020', ei: 2.5 }, [0, 0.3, 0]), cone(0.3, 0.9, '#6af0d0', [0.7, 0.45, 0.3], { em: '#2ad8b0', ei: 1.6 }, 4), glow('#ffd070', 2.5, [0, 1.3, 0], 0.5)); break;
    case 'chest': g.add(box(1.5, 0.8, 1, '#7a4a28', [0, 0.4, 0]), box(1.56, 0.12, 1.06, '#d4a537', [0, 0.82, 0], { metal: 0.6 }), box(0.2, 0.3, 0.1, '#d4a537', [0, 0.75, 0.53], { metal: 0.6 })); lid.position.set(0, 0.8, -0.5); lid.add(box(1.5, 0.3, 1, '#8a5a30', [0, 0.15, 0.5]), cyl(0.5, 0.5, 1.5, '#8a5a30', [0, 0.3, 0.5], undefined, 8, [0, 0, Math.PI / 2])); g.add(lid, glow('#ffe27a', 3.2, [0, 1.2, 0], 0.55)); g.userData.lid = lid; break;
    case 'sigil': g.add(ico(0.55, '#8fe8ff', [0, 2.6, 0], { em: '#4ac8ff', ei: 3, opacity: 0.95 }, 0), glow('#8fe8ff', 4.5, [0, 2.6, 0], 0.8)); g.userData.bob = g.children[0]; break;
  }
  return shadowify(g);
}

// ───────── kingdom buildings ─────────
export function buildBuilding(type: string, level: number): THREE.Group {
  const g = new THREE.Group(); const lv = level;
  switch (type) {
    case 'castle': { g.add(box(14, 3, 14, '#a8a294', [0, 1.5, 0]), box(9, 5 + lv * 1.5, 9, '#e8e0cc', [0, 5.5 + lv * 0.7, 0]));
      for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) g.add(cyl(1.7, 2, 9 + lv * 2, '#e8e0cc', [x, 4.5 + lv, z], undefined, 8), cone(2.3, 3.4, '#b53a3a', [x, 10.7 + lv * 2.2, z], undefined, 8));
      g.add(cyl(2.8, 3.1, 12 + lv * 3, '#f0e8d4', [0, 12, 0], undefined, 10), cone(3.6, 5.5, '#2d6bb5', [0, 21 + lv * 1.5, 0], undefined, 10), box(0.15, 3, 0.15, '#6a4a2a', [0, 26 + lv * 1.5, 0]), box(1.8, 1, 0.06, '#d9a03a', [0.95, 27 + lv * 1.5, 0]), box(3, 4, 0.3, '#3a3a50', [0, 2, 7.1]));
      for (let i = 0; i < 4; i++) g.add(box(0.5, 1.2, 0.1, '#ffe9a0', [(i - 1.5) * 2, 7 + lv * 0.5, 4.6], GLOWWIN)); break; }
    case 'workshop': g.add(houseBase(7, 3.5, 6, '#d8c8a8', '#b5472f')); { const gr = grp(cyl(0.8, 0.8, 0.2, '#8a6a2a', undefined, { metal: 0.6 }, 10, [Math.PI / 2, 0, 0]), box(1.8, 0.2, 0.2, '#8a6a2a'), box(0.2, 1.8, 0.2, '#8a6a2a')); gr.position.set(0, 7.2, 0); g.add(gr); g.userData.spin = gr; } g.add(box(2, 1, 1.5, '#a07a4a', [4.5, 0.5, 1.5]), box(2, 1, 1.5, '#a07a4a', [4.5, 1.5, 1.5])); break;
    case 'blacksmith': g.add(buildStruct('smithy', 'emerald', 0.9)); break;
    case 'storage': g.add(box(9, 4, 6, '#9a6a3a', [0, 2, 0]), at(roof(9, 3, 6, '#6a4a2a'), 0, 5.5, 0), box(3, 3, 0.2, '#5a3a22', [0, 1.5, 3.1]), box(1.4, 1.4, 1.4, '#a07a4a', [5.5, 0.7, 2]), box(1.4, 1.4, 1.4, '#a07a4a', [5.5, 0.7, 0.4]), cyl(0.7, 0.7, 1.4, '#6a4a2a', [-5.5, 0.7, 2], undefined, 8)); break;
    case 'farm': { g.add(box(5, 3, 4, '#c04a3a', [-6, 1.5, -4]), at(roof(5, 2.4, 4, '#4a3a32'), -6, 4.2, -4), cyl(1, 1.1, 6, '#c8c8c8', [-2, 3, -6], undefined, 8), cone(1.2, 1.2, '#8a8a90', [-2, 6.6, -6], undefined, 8)); for (let r = 0; r < 4; r++) { g.add(box(10, 0.3, 2, '#5a3a22', [3, 0.15, -3 + r * 2.6])); for (let i = 0; i < 10; i++) g.add(cone(0.2, 1.1, '#e8c84a', [-1.5 + i * 1, 0.8, -3 + r * 2.6], undefined, 4)); } break; }
    case 'market': for (let i = 0; i < 3; i++) { const st = buildStruct('stall', 'emerald', 1.3 + i * 0.01); st.position.set((i - 1) * 4.5, 0, i === 1 ? -2 : 0); g.add(st); } g.add(cyl(0.9, 1, 0.5, '#8a8a90', [0, 0.25, 3], undefined, 10), sph(0.4, '#6af0ff', [0, 1.4, 3], { em: '#2ad8ff', ei: 1.5 })); break;
    case 'barracks': g.add(box(11, 3.6, 5, '#8a8478', [0, 1.8, 0]), at(roof(11, 2.4, 5, '#4a5a7a'), 0, 4.8, 0), box(1.6, 2.4, 0.2, '#4a3220', [0, 1.2, 2.6])); for (let i = 0; i < 3; i++) g.add(cyl(0.08, 0.08, 4, '#6a4a2a', [-3.5 + i * 3.5, 2, 4], undefined, 5), box(0.9, 1.4, 0.05, '#3a6ad9', [-3.5 + i * 3.5 + 0.5, 3, 4])); g.add(cyl(0.3, 0.4, 2, '#8a5a34', [-5, 1, 5], undefined, 6), box(1.4, 0.2, 0.2, '#8a5a34', [-5, 1.8, 5])); break;
    case 'dock': g.add(buildStruct('dock', 'emerald', 0.9)); break;
    case 'tower': { const H = 10 + lv * 2; g.add(cyl(2, 2.4, H, '#a8a294', [0, H / 2, 0], undefined, 8), cyl(2.7, 2.7, 0.6, '#8a8478', [0, H + 0.3, 0], undefined, 8), cone(0.3, 2, '#4fd8ff', [0, H + 1.4, 0], { em: '#2ad8ff', ei: 2 }, 5), glow('#4fd8ff', 4, [0, H + 1.8, 0], 0.7)); for (let i = 0; i < 8; i++) { const a = i * 0.785; g.add(box(0.8, 0.9, 0.8, '#8a8478', [Math.cos(a) * 2.4, H + 1.0, Math.sin(a) * 2.4])); } g.add(box(0.5, 0.9, 0.1, '#ffe9a0', [0, H * 0.6, 2.1], GLOWWIN)); g.userData.top = H + 1; break; }
    case 'research': { const H = 14 + lv * 2; g.add(cyl(1.8, 2.8, H, '#d8d0e8', [0, H / 2, 0], undefined, 8), cone(2.4, 4, '#6a4ad9', [0, H + 2, 0], undefined, 8), sph(0.8, '#c26bff', [0, H + 5, 0], { em: '#a04cff', ei: 2.5 }), glow('#c26bff', 6, [0, H + 5, 0], 0.7)); const r1 = torus(3.4, 0.1, '#c26bff', [0, H * 0.75, 0], { em: '#a04cff', ei: 2 }, [Math.PI / 2.4, 0, 0]); g.add(r1); g.userData.spin = r1; for (let i = 0; i < 5; i++) g.add(box(0.5, 1, 0.1, '#bfe8ff', [0, 2 + i * 2.2, 2.2 + (0.2 * (4 - i))], { em: '#8fe8ff', ei: 1.5 })); break; }
  }
  g.userData.lv = lv; return shadowify(g);
}
export function buildScaffold(r: number): THREE.Group {
  const g = new THREE.Group(); const c = '#a07a4a'; for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.25, 10, 0.25, c, [x * r, 5, z * r])); for (let y = 2; y <= 10; y += 4) { g.add(box(r * 2, 0.2, 0.2, c, [0, y, r]), box(r * 2, 0.2, 0.2, c, [0, y, -r]), box(0.2, 0.2, r * 2, c, [r, y, 0]), box(0.2, 0.2, r * 2, c, [-r, y, 0])); } return g;
}

// ───────── instanced decor ─────────
const T = (h: number, c = '#6a4a2a', r = 0.3): GPart => ({ g: gCyl(r * 0.7, r, h, 6), c, p: [0, h / 2, 0] });
export function decorParts(kind: string): GPart[] {
  switch (kind) {
    case 'oak': return [T(3), { g: gIco(1.9), c: '#3f9a3a', p: [0, 4.2, 0], s: [1, 0.9, 1] }, { g: gIco(1.3), c: '#58b848', p: [0.9, 3.5, 0.5] }, { g: gIco(1.2), c: '#4aa83a', p: [-0.8, 3.8, -0.4] }];
    case 'pine': return [T(1.5), { g: gCone(2, 3), c: '#2d7a3a', p: [0, 2.8, 0] }, { g: gCone(1.5, 2.6), c: '#34883f', p: [0, 4.4, 0] }, { g: gCone(1, 2.2), c: '#3a9645', p: [0, 5.9, 0] }];
    case 'snowpine': return [T(1.5, '#5a4a3a'), { g: gCone(2, 3), c: '#cfe4ef', p: [0, 2.8, 0] }, { g: gCone(1.5, 2.6), c: '#e4f2f8', p: [0, 4.4, 0] }, { g: gCone(1, 2.2), c: '#fff', p: [0, 5.9, 0] }];
    case 'dead': return [T(4.5, '#3a3040', 0.35), { g: gCyl(0.08, 0.16, 2.2, 5), c: '#3a3040', p: [0.8, 3.8, 0], r: [0, 0, -0.9] }, { g: gCyl(0.06, 0.12, 1.8, 5), c: '#3a3040', p: [-0.7, 3.2, 0.2], r: [0, 0, 0.8] }, { g: gCyl(0.05, 0.1, 1.4, 5), c: '#3a3040', p: [0.1, 4.6, 0.5], r: [0.8, 0, 0.1] }];
    case 'rock': return [{ g: gIco(1.2), c: '#8a8a8e', p: [0, 0.5, 0], s: [1.2, 0.8, 1] }, { g: gIco(0.7), c: '#9a9a9e', p: [1, 0.25, 0.3] }];
    case 'icerock': return [{ g: gIco(1.3), c: '#a8c8e4', p: [0, 0.5, 0], s: [1.2, 0.8, 1] }, { g: gIco(0.7), c: '#cfe4f4', p: [1, 0.25, 0.3] }];
    case 'lavarock': return [{ g: gIco(1.3), c: '#2a1c1a', p: [0, 0.6, 0], s: [1.2, 0.9, 1] }, { g: gIco(0.8), c: '#3a2622', p: [1.1, 0.3, 0.3] }, { g: gCone(0.2, 0.5, 4), c: '#ff6a1a', p: [0.2, 1.4, 0.3] }];
    case 'pillar': return [{ g: gBox(1.8, 0.5, 1.8), c: '#a8a290', p: [0, 0.25, 0] }, { g: gCyl(0.6, 0.7, 4.5, 8), c: '#c4bfae', p: [0, 2.7, 0] }, { g: gBox(1.5, 0.4, 1.5), c: '#b0aa9a', p: [0, 5.1, 0] }];
    case 'ruinwall': return [{ g: gBox(5, 2.4, 0.9), c: '#9a9486', p: [0, 1.2, 0] }, { g: gBox(2, 1.2, 0.9), c: '#8a8478', p: [-1.5, 3, 0] }, { g: gBox(0.9, 0.5, 0.9), c: '#8a8478', p: [1.5, 2.65, 0] }];
    case 'crystaltree': return [{ g: gCyl(0.15, 0.3, 3.5, 6), c: '#f4efe8', p: [0, 1.75, 0] }, { g: gCone(0.9, 3, 5), c: '#ffe9a0', p: [0, 4.6, 0] }, { g: gCone(0.6, 2.2, 5), c: '#9ae8ff', p: [1, 3.8, 0.3], r: [0, 0, -0.6] }, { g: gCone(0.6, 2.2, 5), c: '#ffc8f0', p: [-1, 3.6, -0.3], r: [0, 0, 0.6] }];
    case 'glowpillar': return [{ g: gCyl(0.5, 0.6, 5, 6), c: '#fff6d8', p: [0, 2.5, 0] }, { g: gIco(0.7), c: '#ffe9a0', p: [0, 5.5, 0] }];
    case 'crystal': return [{ g: gCone(0.5, 2.4, 5), c: '#9ae8ff', p: [0, 1.2, 0] }, { g: gCone(0.4, 1.6, 5), c: '#ffc8f0', p: [0.7, 0.8, 0.2], r: [0, 0, -0.3] }, { g: gCone(0.35, 1.3, 5), c: '#c8b4ff', p: [-0.6, 0.65, -0.2], r: [0, 0, 0.3] }];
    case 'darkcrystal': return [{ g: gCone(0.5, 2.6, 5), c: '#b04cff', p: [0, 1.3, 0] }, { g: gCone(0.4, 1.8, 5), c: '#7a2ad8', p: [0.7, 0.9, 0.2], r: [0, 0, -0.3] }];
    case 'emberspike': return [{ g: gCone(0.6, 3, 5), c: '#ff6a1a', p: [0, 1.5, 0] }, { g: gCone(0.4, 2, 5), c: '#ffb03a', p: [0.8, 1, 0.2], r: [0, 0, -0.3] }];
    case 'icespike': return [{ g: gCone(0.6, 3.4, 5), c: '#bfe8ff', p: [0, 1.7, 0] }, { g: gCone(0.4, 2.2, 5), c: '#8fd0f0', p: [0.8, 1.1, 0.2], r: [0, 0, -0.3] }];
    case 'flower': return [{ g: gCyl(0.03, 0.03, 0.5, 4), c: '#4a9a3a', p: [0, 0.25, 0] }, { g: gIco(0.16), c: '#ff7ab0', p: [0, 0.55, 0] }, { g: gCyl(0.03, 0.03, 0.4, 4), c: '#4a9a3a', p: [0.3, 0.2, 0.1] }, { g: gIco(0.14), c: '#ffe04a', p: [0.3, 0.45, 0.1] }, { g: gCyl(0.03, 0.03, 0.4, 4), c: '#4a9a3a', p: [-0.3, 0.2, -0.1] }, { g: gIco(0.14), c: '#b48aff', p: [-0.3, 0.45, -0.1] }];
    case 'bush': return [{ g: gIco(0.9), c: '#3a8a3a', p: [0, 0.6, 0], s: [1.2, 0.8, 1] }, { g: gIco(0.6), c: '#4aa048', p: [0.7, 0.4, 0.2] }];
    case 'mushroom': return [{ g: gCyl(0.15, 0.2, 1.2, 6), c: '#d8c8f0', p: [0, 0.6, 0] }, { g: gCone(0.9, 0.6, 8), c: '#9a4aff', p: [0, 1.4, 0] }, { g: gCyl(0.1, 0.12, 0.7, 6), c: '#d8c8f0', p: [0.9, 0.35, 0.2] }, { g: gCone(0.5, 0.4, 8), c: '#4aa8ff', p: [0.9, 0.85, 0.2] }];
  }
  return [{ g: gIco(1), c: '#888' }];
}
export const GLOW_KINDS = ['crystal', 'crystaltree', 'darkcrystal', 'mushroom', 'emberspike', 'glowpillar'];
export const decorGeo = (k: string) => mergeParts(decorParts(k));
