// Procedural stylized models: humans, weapons, enemies, bosses.
import * as THREE from 'three';
import { at, box, cone, cyl, glow, grp, ico, limb, mat, shadowify, sph, torus } from './gfx';

type Parts = Record<string, THREE.Object3D>;
const fin = (g: THREE.Group, parts: Parts) => { g.userData.parts = parts; shadowify(g); return g; };

// ───────── humans ─────────
export interface HumanOpt { skin: string; outfit: string; pants: string; hair: string; hat?: 'wizard' | 'hood' | 'helm' | 'cap' | null; cape?: string; belt?: string; scale?: number; scarf?: string; armor?: string }
export function buildHuman(o: HumanOpt) {
  const g = new THREE.Group(); const p: Parts = {};
  const legL = limb(0.27, 0.9, 0.3, o.pants, -0.17, 0.92, 0); legL.add(box(0.31, 0.2, 0.42, '#3a2a22', [0, -0.82, 0.05])); const legR = limb(0.27, 0.9, 0.3, o.pants, 0.17, 0.92, 0); legR.add(box(0.31, 0.2, 0.42, '#3a2a22', [0, -0.82, 0.05]));
  const torso = grp(box(0.72, 0.74, 0.4, o.outfit, [0, 0.36, 0]), box(0.76, 0.12, 0.44, o.belt || '#d4a537', [0, 0.04, 0]), box(0.2, 0.2, 0.05, '#f2d36b', [0, 0.04, 0.23], { em: '#a07a10', ei: 0.4 })); torso.position.y = 0.92;
  if (o.armor) { torso.add(box(0.8, 0.3, 0.46, o.armor, [0, 0.6, 0], { metal: 0.5, rough: 0.4 }), box(0.28, 0.2, 0.3, o.armor, [-0.45, 0.72, 0], { metal: 0.5 }), box(0.28, 0.2, 0.3, o.armor, [0.45, 0.72, 0], { metal: 0.5 })); }
  const mkArm = (s: number) => { const a = limb(0.2, 0.7, 0.22, o.outfit, 0.47 * s, 2.12 - 0.92 + 0.92 - 0.9 + 0.0, 0); a.position.set(0.47 * s, 2.14 - 0.92, 0); a.position.y = 1.9 - 0.7 + 0.0; a.position.y = 1.58; a.add(box(0.21, 0.2, 0.23, o.skin, [0, -0.72, 0])); const hand = new THREE.Group(); hand.position.set(0, -0.78, 0); a.add(hand); return { a, hand }; };
  const AL = mkArm(-1), AR = mkArm(1);
  const head = new THREE.Group(); head.position.y = 1.78;
  head.add(sph(0.27, o.skin, [0, 0, 0], { flat: false }, 12), box(0.07, 0.07, 0.05, '#1a1a2a', [-0.1, 0.02, 0.25]), box(0.07, 0.07, 0.05, '#1a1a2a', [0.1, 0.02, 0.25]), sph(0.29, o.hair, [0, 0.08, -0.05], undefined, 8, [1, 0.85, 1.05]));
  if (!o.hat || o.hat === 'cap') { for (let i = -1; i <= 1; i++) head.add(cone(0.08, 0.28, o.hair, [i * 0.13, 0.33, -0.02], undefined, 5, [-0.2, 0, -i * 0.5])); }
  if (o.hat === 'wizard') { head.add(cone(0.34, 0.7, o.outfit, [0, 0.5, 0], undefined, 8), cyl(0.42, 0.42, 0.04, o.outfit, [0, 0.2, 0], undefined, 10)); }
  if (o.hat === 'hood') head.add(sph(0.33, o.outfit, [0, 0.05, -0.04], undefined, 8, [1, 1, 1.05]));
  if (o.hat === 'helm') head.add(sph(0.31, '#9aa5b5', [0, 0.1, 0], { metal: 0.6, rough: 0.4 }, 8, [1, 0.8, 1]), box(0.05, 0.3, 0.3, '#c0392b', [0, 0.38, -0.05]));
  const scarf = torus(0.2, 0.07, o.scarf || '#d94a4a', [0, 1.52, 0], undefined, [Math.PI / 2, 0, 0]);
  g.add(legL, legR, torso, AL.a, AR.a, head, scarf);
  let cape: THREE.Group | null = null;
  if (o.cape) { cape = new THREE.Group(); cape.position.set(0, 1.55, -0.24); cape.add(box(0.62, 0.95, 0.04, o.cape, [0, -0.48, 0])); g.add(cape); p.cape = cape; }
  Object.assign(p, { legL, legR, torso, armL: AL.a, armR: AR.a, handL: AL.hand, handR: AR.hand, head });
  g.scale.setScalar(o.scale || 1); return fin(g, p);
}
export const buildHero = (armor = 'cloth') => buildHuman({ skin: '#f0c8a0', outfit: armor === 'cloth' ? '#2a7f8f' : armor === 'leather' ? '#8a5a34' : armor === 'iron' ? '#6a7a8a' : armor === 'crystal' ? '#4ab0d8' : '#e8d890', pants: '#3a3f66', hair: '#243a8f', cape: armor === 'celestial' ? '#fff0a0' : '#b8323a', armor: armor === 'iron' ? '#aab4c4' : armor === 'crystal' ? '#8fe8ff' : armor === 'celestial' ? '#ffe9a0' : undefined, scarf: '#e8b84a' });

export function buildWeapon(id: string, color = '#cfe8ff') {
  const g = new THREE.Group(); const gold = '#d4a537';
  const blade = (len: number, w: number, c = color) => grp(box(w, len, 0.03, c, [0, len / 2 + 0.2, 0], { metal: 0.7, rough: 0.25, em: c, ei: 0.25 }), cone(w / 2 * 1.4, 0.2, c, [0, len + 0.3, 0], { metal: 0.7, em: c, ei: 0.25 }, 4));
  const hilt = (w = 0.3) => grp(cyl(0.035, 0.035, 0.28, '#5a3a22', [0, 0, 0]), box(w, 0.05, 0.08, gold, [0, 0.16, 0], { metal: 0.6 }), sph(0.05, gold, [0, -0.15, 0]));
  switch (id) {
    case 'sword': g.add(hilt(), blade(0.95, 0.11)); break;
    case 'dual': g.add(hilt(0.22), blade(0.6, 0.09)); break;
    case 'greatsword': g.add(cyl(0.04, 0.04, 0.55, '#4a2e1c', [0, 0.05, 0]), box(0.5, 0.08, 0.12, gold, [0, 0.35, 0], { metal: 0.6 }), blade(1.7, 0.26, color)); break;
    case 'spear': g.add(cyl(0.035, 0.035, 2.4, '#7a5a3a', [0, 0.7, 0]), cone(0.1, 0.5, color, [0, 2.15, 0], { metal: 0.7, em: color, ei: 0.35 }, 4), box(0.25, 0.04, 0.04, gold, [0, 1.9, 0]), at(grp(box(0.02, 0.4, 0.15, '#d94a4a')), 0, 1.75, 0)); break;
    case 'staff': g.add(cyl(0.04, 0.05, 1.8, '#6a4a8a', [0, 0.5, 0]), torus(0.13, 0.03, gold, [0, 1.5, 0], { metal: 0.6 }), sph(0.1, color, [0, 1.5, 0], { em: color, ei: 2 }), glow(color, 0.9, [0, 1.5, 0])); break;
    case 'bow': { const b = new THREE.Group(); b.add(torus(0.55, 0.035, '#8a5a34', [0, 0, 0], undefined, [0, 0, -Math.PI / 2], Math.PI), box(0.012, 1.1, 0.012, '#f0f0e0', [0, 0, 0])); b.rotation.y = -Math.PI / 2; g.add(b); break; }
  }
  return g;
}

// ───────── enemies ─────────
export function buildEnemy(type: string, color: string): THREE.Group {
  const g = new THREE.Group(); const p: Parts = {}; const eye = (c: string) => ({ em: c, ei: 2 });
  switch (type) {
    case 'wolf': {
      const body = grp(box(0.72, 0.7, 1.5, color, [0, 0, 0]), box(0.8, 0.8, 0.6, color, [0, 0.05, 0.4]), box(0.2, 0.15, 1.3, '#d8e0f0', [0, 0.38, 0])); body.position.y = 1.0;
      const head = grp(box(0.5, 0.46, 0.5, color, [0, 0, 0]), box(0.26, 0.22, 0.36, '#aab2c4', [0, -0.08, 0.38]), box(0.08, 0.07, 0.06, '#111', [0, -0.02, 0.58]), box(0.08, 0.08, 0.05, '#ffe27a', [-0.14, 0.08, 0.26], eye('#ffd23a')), box(0.08, 0.08, 0.05, '#ffe27a', [0.14, 0.08, 0.26], eye('#ffd23a')), cone(0.1, 0.25, color, [-0.17, 0.35, -0.05], undefined, 4), cone(0.1, 0.25, color, [0.17, 0.35, -0.05], undefined, 4)); head.position.set(0, 0.2, 0.95); body.add(head);
      const tail = grp(cone(0.12, 0.8, '#d8e0f0', [0, 0, -0.4], undefined, 5, [-Math.PI / 2 - 0.4, 0, 0])); tail.position.set(0, 0.15, -0.75); body.add(tail);
      const wl = grp(box(0.8, 0.03, 0.5, '#8ff0ff', [-0.45, 0, 0], { em: '#5ad8ff', ei: 1.2, opacity: 0.6 })), wr = grp(box(0.8, 0.03, 0.5, '#8ff0ff', [0.45, 0, 0], { em: '#5ad8ff', ei: 1.2, opacity: 0.6 })); wl.position.set(-0.3, 0.38, 0); wr.position.set(0.3, 0.38, 0); body.add(wl, wr);
      const L = (x: number, z: number) => limb(0.2, 0.95, 0.2, color, x, 0.7, z); const fl = L(-0.27, 0.55), fr = L(0.27, 0.55), bl = L(-0.27, -0.55), br = L(0.27, -0.55);
      g.add(body, fl, fr, bl, br); Object.assign(p, { body, head, tail, legFL: fl, legFR: fr, legBL: bl, legBR: br, wingL: wl, wingR: wr }); break;
    }
    case 'deer': case 'stag': {
      const light = type === 'stag'; const body = grp(box(0.7, 0.75, 1.6, color, [0, 0, 0]), box(0.5, 0.4, 1.0, '#f0dcc0', [0, -0.25, 0.1])); body.position.y = 1.5;
      const neck = grp(box(0.3, 0.9, 0.3, color, [0, 0.4, 0], undefined, [0.4, 0, 0])); neck.position.set(0, 0.2, 0.7); body.add(neck);
      const head = grp(box(0.32, 0.34, 0.5, color, [0, 0, 0.1]), box(0.1, 0.1, 0.05, '#111', [-0.12, 0.05, 0.3]), box(0.1, 0.1, 0.05, '#111', [0.12, 0.05, 0.3]));
      for (const s of [-1, 1]) { head.add(cyl(0.025, 0.035, 0.7, light ? '#fff0ff' : '#d8c4a0', [0.15 * s, 0.5, -0.05], light ? { em: '#ff9aff', ei: 1.5 } : undefined, 5, [0, 0, -0.4 * s]), cyl(0.02, 0.025, 0.4, light ? '#fff0ff' : '#d8c4a0', [0.3 * s, 0.6, 0.05], light ? { em: '#ff9aff', ei: 1.5 } : undefined, 5, [0.3, 0, -0.9 * s])); }
      head.position.set(0, 0.95, 0.35); neck.add(head); head.position.set(0, 0.85, 0.35);
      const L = (x: number, z: number) => limb(0.14, 1.15, 0.14, '#7a5a3a', x, 1.2, z); const fl = L(-0.25, 0.65), fr = L(0.25, 0.65), bl = L(-0.25, -0.65), br = L(0.25, -0.65);
      body.add(box(0.14, 0.16, 0.16, '#fff', [0, 0.25, -0.85])); g.add(body, fl, fr, bl, br); if (light) g.add(glow('#ff9aff', 6, [0, 1.6, 0], 0.5)); Object.assign(p, { body, head, legFL: fl, legFR: fr, legBL: bl, legBR: br }); break;
    }
    case 'harpy': {
      const body = grp(box(0.55, 0.75, 0.38, color, [0, 0, 0]), box(0.5, 0.3, 0.3, '#f0d0e8', [0, 0.1, 0.1])); body.position.y = 1.2;
      const head = grp(sph(0.24, '#f0c8d8', [0, 0, 0], undefined, 8), cone(0.08, 0.3, '#ffcf3a', [0, -0.03, 0.28], undefined, 4, [Math.PI / 2, 0, 0]), box(0.06, 0.06, 0.05, '#c00', [-0.1, 0.05, 0.2], eye('#f00')), box(0.06, 0.06, 0.05, '#c00', [0.1, 0.05, 0.2], eye('#f00')), cone(0.1, 0.4, '#e060c0', [0, 0.3, -0.1], undefined, 4, [-0.4, 0, 0])); head.position.set(0, 0.55, 0.05); body.add(head);
      const wing = (s: number) => { const w = new THREE.Group(); w.position.set(0.25 * s, 0.2, -0.05); w.add(box(1.4, 0.06, 0.55, color, [0.7 * s, 0, 0]), box(1.0, 0.05, 0.4, '#e060c0', [1.55 * s, 0, 0.05]), box(0.7, 0.04, 0.3, '#f0a0e0', [2.3 * s, 0, 0.1])); return w; };
      const wl = wing(-1), wr = wing(1); body.add(wl, wr); body.add(box(0.1, 0.6, 0.03, '#e060c0', [0, -0.55, -0.15], undefined, [0.3, 0, 0]));
      const lg = limb(0.08, 0.5, 0.08, '#ffcf3a', -0.14, -0.4, 0.05), rg = limb(0.08, 0.5, 0.08, '#ffcf3a', 0.14, -0.4, 0.05); body.add(lg, rg);
      g.add(body); Object.assign(p, { body, head, wingL: wl, wingR: wr, legL: lg, legR: rg }); break;
    }
    case 'goblin': {
      const torso = grp(box(0.6, 0.62, 0.36, '#7a5a38', [0, 0.3, 0]), box(0.64, 0.12, 0.4, '#3a2a1a', [0, 0, 0]), box(0.5, 0.3, 0.3, '#8a3a2a', [0, -0.18, 0.02])); torso.position.y = 0.8;
      const head = grp(sph(0.27, color, [0, 0, 0], { flat: false }, 10), cone(0.09, 0.45, color, [-0.38, 0.06, 0], undefined, 4, [0, 0, 1.4]), cone(0.09, 0.45, color, [0.38, 0.06, 0], undefined, 4, [0, 0, -1.4]), cone(0.06, 0.2, color, [0, -0.02, 0.28], undefined, 4, [Math.PI / 2, 0, 0]), box(0.07, 0.07, 0.05, '#f33', [-0.1, 0.05, 0.24], eye('#f22')), box(0.07, 0.07, 0.05, '#f33', [0.1, 0.05, 0.24], eye('#f22')), box(0.4, 0.05, 0.05, '#fff', [0, -0.13, 0.22])); head.position.y = 1.5;
      const aL = limb(0.16, 0.65, 0.16, color, -0.4, 1.38, 0), aR = limb(0.16, 0.65, 0.16, color, 0.4, 1.38, 0); const dag = grp(box(0.07, 0.55, 0.03, '#c8c8d0', [0, 0.35, 0], { metal: 0.7 }), box(0.18, 0.04, 0.05, '#4a3a22')); dag.position.set(0, -0.65, 0.1); dag.rotation.x = Math.PI / 2; aR.add(dag);
      const lL = limb(0.2, 0.6, 0.22, color, -0.17, 0.6, 0), lR = limb(0.2, 0.6, 0.22, color, 0.17, 0.6, 0);
      g.add(torso, head, aL, aR, lL, lR); Object.assign(p, { torso, head, armL: aL, armR: aR, legL: lL, legR: lR }); break;
    }
    case 'golem': {
      const rune = (x: number, y: number, z: number, w: number, h: number) => box(w, h, 0.05, '#ffb02e', [x, y, z], { em: '#ff9a1a', ei: 2 });
      const torso = grp(box(1.5, 1.3, 1.0, color, [0, 0.6, 0]), box(0.8, 0.8, 0.1, '#6a6458', [0, 0.6, 0.52]), rune(0, 0.7, 0.56, 0.12, 0.6), rune(0, 0.7, 0.56, 0.5, 0.1), box(0.6, 0.12, 0.7, '#5a8a3a', [-0.4, 1.28, 0.1]), box(1.0, 0.7, 0.8, '#7a7468', [0, -0.15, 0])); torso.position.y = 1.5;
      const head = grp(box(0.7, 0.6, 0.65, '#9a9484', [0, 0, 0]), box(0.14, 0.1, 0.05, '#ffb02e', [-0.17, 0.05, 0.34], eye('#ffa000')), box(0.14, 0.1, 0.05, '#ffb02e', [0.17, 0.05, 0.34], eye('#ffa000')), box(0.2, 0.3, 0.2, '#7a7468', [-0.2, 0.42, 0]), box(0.2, 0.4, 0.2, '#7a7468', [0.15, 0.45, 0.05])); head.position.set(0, 2.9, 0.05);
      const mkA = (s: number) => { const a = limb(0.5, 1.3, 0.5, color, 1.1 * s, 2.55, 0); a.add(box(0.7, 0.75, 0.7, '#8a8474', [0, -1.4, 0]), box(0.75, 0.5, 0.75, '#7a7468', [0, 0.05, 0])); return a; };
      const aL = mkA(-1), aR = mkA(1); const lL = limb(0.55, 1.2, 0.55, '#7a7468', -0.45, 1.3, 0), lR = limb(0.55, 1.2, 0.55, '#7a7468', 0.45, 1.3, 0); lL.add(box(0.7, 0.3, 0.8, '#6a6458', [0, -1.15, 0.1])); lR.add(box(0.7, 0.3, 0.8, '#6a6458', [0, -1.15, 0.1]));
      g.add(torso, head, aL, aR, lL, lR); Object.assign(p, { torso, head, armL: aL, armR: aR, legL: lL, legR: lR }); break;
    }
    case 'yeti': {
      const fur = color; const torso = grp(box(1.5, 1.5, 1.0, fur, [0, 0.6, 0]), sph(0.8, fur, [0, 1.0, 0.1], { flat: true }, 7), sph(0.5, '#f4faff', [-0.5, 1.1, 0.5], undefined, 6), sph(0.5, '#f4faff', [0.5, 0.9, 0.5], undefined, 6)); torso.position.y = 1.6;
      const head = grp(sph(0.5, fur, [0, 0, 0], undefined, 8), box(0.55, 0.4, 0.2, '#6aa0d8', [0, -0.05, 0.4]), box(0.12, 0.08, 0.05, '#fff', [-0.14, 0.08, 0.5], eye('#8ff')), box(0.12, 0.08, 0.05, '#fff', [0.14, 0.08, 0.5], eye('#8ff')), box(0.4, 0.1, 0.05, '#fff', [0, -0.2, 0.5]), cone(0.1, 0.5, '#bfe4ff', [-0.4, 0.45, 0], { em: '#6ac', ei: 0.4 }, 5, [0, 0, 0.5]), cone(0.1, 0.5, '#bfe4ff', [0.4, 0.45, 0], { em: '#6ac', ei: 0.4 }, 5, [0, 0, -0.5])); head.position.set(0, 2.7, 0.1);
      const mkA = (s: number) => { const a = limb(0.5, 1.5, 0.5, fur, 1.0 * s, 2.5, 0); a.add(sph(0.38, '#6aa0d8', [0, -1.6, 0], undefined, 6), box(0.1, 0.3, 0.1, '#ddeeff', [-0.12, -1.9, 0.1]), box(0.1, 0.3, 0.1, '#ddeeff', [0.12, -1.9, 0.1])); return a; };
      const aL = mkA(-1), aR = mkA(1); const lL = limb(0.55, 1.2, 0.55, fur, -0.45, 1.3, 0), lR = limb(0.55, 1.2, 0.55, fur, 0.45, 1.3, 0);
      g.add(torso, head, aL, aR, lL, lR); Object.assign(p, { torso, head, armL: aL, armR: aR, legL: lL, legR: lR }); break;
    }
    case 'mech': {
      const metal = { metal: 0.7, rough: 0.35 }; const gear = grp(cyl(0.45, 0.45, 0.12, '#8a6a2a', [0, 0, 0], metal, 10, [Math.PI / 2, 0, 0]), box(0.9, 0.1, 0.12, '#8a6a2a', [0, 0, 0], metal), box(0.1, 0.9, 0.12, '#8a6a2a', [0, 0, 0], metal)); gear.position.set(0, 1.9, -0.6);
      const torso = grp(box(1.1, 1.0, 0.8, color, [0, 0.5, 0], metal), sph(0.3, '#6af0ff', [0, 0.55, 0.42], { em: '#2ad8ff', ei: 2.5 }, 8), box(1.2, 0.2, 0.9, '#8a6a2a', [0, 1.05, 0], metal), box(0.9, 0.3, 0.7, '#6a5a3a', [0, -0.1, 0], metal)); torso.position.y = 1.5;
      const head = grp(box(0.55, 0.45, 0.5, '#d8b46a', [0, 0, 0], metal), sph(0.14, '#6af0ff', [0, 0, 0.26], { em: '#2ad8ff', ei: 3 }, 8), cyl(0.03, 0.03, 0.4, '#8a6a2a', [0.2, 0.4, 0], metal, 5)); head.position.y = 2.65;
      const aL = limb(0.28, 1.1, 0.28, '#b8944a', -0.8, 2.3, 0, metal), aR = limb(0.28, 1.1, 0.28, '#b8944a', 0.8, 2.3, 0, metal); aR.add(cyl(0.18, 0.2, 0.9, '#3a3a44', [0, -1.35, 0.35], metal, 8, [Math.PI / 2, 0, 0]), sph(0.22, '#6af0ff', [0, -1.35, 0.8], { em: '#2ad8ff', ei: 2 }, 6)); aL.add(box(0.15, 0.8, 0.5, '#c8c8d8', [0, -1.4, 0.15], metal));
      const lL = limb(0.3, 1.2, 0.3, '#8a6a2a', -0.35, 1.2, 0, metal), lR = limb(0.3, 1.2, 0.3, '#8a6a2a', 0.35, 1.2, 0, metal); lL.add(box(0.4, 0.2, 0.6, '#5a4a2a', [0, -1.15, 0.1])); lR.add(box(0.4, 0.2, 0.6, '#5a4a2a', [0, -1.15, 0.1]));
      g.add(gear, torso, head, aL, aR, lL, lR); Object.assign(p, { torso, head, armL: aL, armR: aR, legL: lL, legR: lR, gear }); break;
    }
    case 'shadow': {
      const T = { opacity: 0.85, em: '#5a1f9a', ei: 0.5 };
      const body = grp(cone(0.55, 1.9, color, [0, 0.0, 0], T, 7, [Math.PI, 0, 0]), sph(0.5, color, [0, 0.8, 0], T, 8)); body.position.y = 1.4;
      const head = grp(sph(0.32, '#1a0f30', [0, 0, 0], { opacity: 0.95 }, 8), box(0.1, 0.16, 0.05, '#ff4aff', [-0.12, 0.04, 0.28], eye('#ff40ff')), box(0.1, 0.16, 0.05, '#ff4aff', [0.12, 0.04, 0.28], eye('#ff40ff')), cone(0.07, 0.4, '#1a0f30', [-0.2, 0.35, 0], undefined, 4, [0, 0, 0.4]), cone(0.07, 0.4, '#1a0f30', [0.2, 0.35, 0], undefined, 4, [0, 0, -0.4])); head.position.set(0, 2.35, 0.05);
      const mkA = (s: number) => { const a = limb(0.14, 1.3, 0.14, '#2a1745', 0.55 * s, 2.0, 0, { opacity: 0.9 }); for (let i = -1; i <= 1; i++) a.add(cone(0.04, 0.4, '#d8a0ff', [i * 0.07, -1.4, 0.05], eye('#b04cff'), 4, [Math.PI, 0, 0])); return a; };
      const aL = mkA(-1), aR = mkA(1); g.add(body, head, aL, aR, glow('#8a2aff', 3.5, [0, 1.6, 0], 0.4)); Object.assign(p, { body, head, armL: aL, armR: aR }); break;
    }
    case 'fire': {
      const body = grp(ico(0.8, '#ff5a10', [0, 0, 0], { em: '#ff4a00', ei: 1.8 }, 1), ico(0.55, '#ffd23a', [0, 0, 0], { em: '#ffcc22', ei: 2.5 }, 1)); body.position.y = 1.7;
      for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; body.add(cone(0.22, 1.0 + (i % 3) * 0.3, i % 2 ? '#ff7a1a' : '#ffa21a', [Math.cos(a) * 0.45, 0.8, Math.sin(a) * 0.45], { em: '#ff5a00', ei: 1.6 }, 5, [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3])); }
      body.add(box(0.14, 0.14, 0.05, '#fff', [-0.25, 0.15, 0.7], { em: '#fff', ei: 3 }), box(0.14, 0.14, 0.05, '#fff', [0.25, 0.15, 0.7], { em: '#fff', ei: 3 }));
      const mkA = (s: number) => { const a = grp(ico(0.3, '#ff6a10', [0, -0.8, 0], { em: '#ff4a00', ei: 1.8 }, 0), cone(0.15, 0.5, '#ffaa22', [0, -0.5, 0], { em: '#ff7a00', ei: 1.5 }, 5, [Math.PI, 0, 0])); a.position.set(1.0 * s, 2.0, 0); return a; };
      const aL = mkA(-1), aR = mkA(1); g.add(body, aL, aR, glow('#ff6a1a', 6, [0, 1.8, 0], 0.7), cone(0.7, 0.5, '#2a0a00', [0, 0.1, 0], { opacity: 0.6 }, 8, [Math.PI, 0, 0])); Object.assign(p, { body, armL: aL, armR: aR }); break;
    }
  }
  return fin(g, p);
}

// ───────── bosses ─────────
export function buildBoss(id: string): THREE.Group {
  const g = new THREE.Group(); const p: Parts = {}; const eye = (c: string) => ({ em: c, ei: 3 });
  const wingShape = (c: string, c2: string) => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(3, 1.5, 7, 3.2, 12, 0.5); s.lineTo(10, -1); s.lineTo(8.6, -0.2); s.lineTo(7.5, -2.4); s.lineTo(5.6, -0.8); s.lineTo(4, -3); s.lineTo(2.4, -1); s.lineTo(0.6, -1.4); s.closePath();
    const geo = new THREE.ShapeGeometry(s); geo.rotateX(Math.PI / 2); const w = new THREE.Group(); const m = new THREE.Mesh(geo, mat(c, { side: THREE.DoubleSide, em: c2, ei: 0.35, flat: true })); w.add(m);
    w.add(cyl(0.18, 0.1, 12, '#1a2438', [6, 0.05, 0.3], undefined, 5, [0, 0, Math.PI / 2]), cyl(0.1, 0.06, 6, '#1a2438', [3.6, 0.05, -1.8], undefined, 5, [0, -0.5, Math.PI / 2])); return w;
  };
  switch (id) {
    case 'titan': {
      const rune = (x: number, y: number, z: number, w: number, h: number) => box(w, h, 0.1, '#ffc552', [x, y, z], { em: '#ffa000', ei: 2.5 });
      const torso = grp(box(5.2, 4.4, 3.2, '#8d8878', [0, 2.2, 0]), box(3.2, 3, 0.4, '#6a6458', [0, 2.2, 1.7]), rune(0, 2.4, 1.95, 0.4, 2.4), rune(0, 2.4, 1.95, 2, 0.35), sph(0.7, '#ffd070', [0, 2.4, 2.0], { em: '#ffa000', ei: 3 }, 8), box(3, 1.4, 2.6, '#7a7468', [0, -0.4, 0]), box(2.4, 0.8, 2, '#5a8a3a', [-1.2, 4.5, 0.2]), box(1.8, 0.6, 1.6, '#5a8a3a', [1.6, 4.4, -0.4])); torso.position.y = 6.2;
      const head = grp(box(2.2, 1.8, 2.1, '#9a9484', [0, 0, 0]), box(0.5, 0.35, 0.1, '#ffc552', [-0.55, 0.15, 1.08], eye('#ffa000')), box(0.5, 0.35, 0.1, '#ffc552', [0.55, 0.15, 1.08], eye('#ffa000')), box(0.6, 1.2, 0.6, '#7a7468', [-0.7, 1.4, 0]), box(0.6, 1.8, 0.6, '#7a7468', [0.1, 1.6, 0]), box(0.5, 1, 0.5, '#7a7468', [0.9, 1.3, 0.1])); head.position.set(0, 9.9, 0.3);
      const mkA = (s: number) => { const a = limb(1.6, 4.2, 1.6, '#8d8878', 3.6 * s, 8.4, 0); a.add(sph(1.5, '#7a7468', [0, 0.1, 0], undefined, 6), box(2.4, 2.4, 2.4, '#7a7468', [0, -4.5, 0.2]), box(2.0, 0.4, 2.0, '#ffc552', [0, -3.2, 0], { em: '#ffa000', ei: 1.2 })); return a; };
      const aL = mkA(-1), aR = mkA(1); const mkL = (s: number) => { const l = limb(2, 4, 2, '#7a7468', 1.5 * s, 4.2, 0); l.add(box(2.4, 0.8, 3, '#5a5448', [0, -4, 0.3])); return l; };
      const lL = mkL(-1), lR = mkL(1); g.add(torso, head, aL, aR, lL, lR, glow('#ffa000', 8, [0, 8.6, 2], 0.6)); Object.assign(p, { torso, head, armL: aL, armR: aR, legL: lL, legR: lR }); break;
    }
    case 'inferno': {
      const lava = { em: '#ff5a00', ei: 2.5 }; const obs = { metal: 0.5, rough: 0.35 };
      const torso = grp(box(5.4, 4.6, 3.4, '#241410', [0, 2.3, 0], obs), box(0.4, 3.4, 0.1, '#ff7a1a', [-0.9, 2.3, 1.72], lava), box(0.4, 3.0, 0.1, '#ff7a1a', [0.8, 2.2, 1.72], lava), box(2.8, 0.4, 0.1, '#ff7a1a', [0, 2.8, 1.72], lava), ico(1.1, '#ffb03a', [0, 2.4, 1.8], { em: '#ff8a00', ei: 3 }, 1), box(3.4, 1.4, 2.8, '#1a0c08', [0, -0.3, 0], obs)); torso.position.y = 6.4;
      const head = grp(box(2.3, 2, 2.2, '#2a1814', [0, 0, 0], obs), box(0.6, 0.3, 0.1, '#ffe27a', [-0.6, 0.2, 1.12], eye('#ffc400')), box(0.6, 0.3, 0.1, '#ffe27a', [0.6, 0.2, 1.12], eye('#ffc400')), box(1.4, 0.2, 0.1, '#ff5a00', [0, -0.5, 1.12], lava), cone(0.5, 2.8, '#1a0c08', [-1.3, 1.5, 0], obs, 6, [0, 0, 0.55]), cone(0.5, 2.8, '#1a0c08', [1.3, 1.5, 0], obs, 6, [0, 0, -0.55]));
      for (let i = 0; i < 6; i++) head.add(cone(0.3, 1.4 + (i % 3) * 0.5, '#ff8a1a', [(i - 2.5) * 0.4, 1.3, -0.2], { em: '#ff5a00', ei: 2.2 }, 5)); head.position.set(0, 10.1, 0.3);
      const mkA = (s: number) => { const a = limb(1.7, 4.2, 1.7, '#241410', 3.7 * s, 8.5, 0, obs); a.add(ico(1.5, '#ff5a10', [0, 0.2, 0], { em: '#ff4a00', ei: 1.8 }, 1), ico(1.6, '#ff7a1a', [0, -4.6, 0.2], { em: '#ff5a00', ei: 2.2 }, 1), glow('#ff6a1a', 6, [0, -4.6, 0.2], 0.8)); return a; };
      const aL = mkA(-1), aR = mkA(1); const lL = limb(2.1, 4, 2.1, '#1a0c08', -1.5, 4.2, 0, obs), lR = limb(2.1, 4, 2.1, '#1a0c08', 1.5, 4.2, 0, obs); lL.add(box(0.2, 3, 0.1, '#ff6a1a', [0, -2, 1.06], lava)); lR.add(box(0.2, 3, 0.1, '#ff6a1a', [0, -2, 1.06], lava));
      g.add(torso, head, aL, aR, lL, lR, glow('#ff5a00', 16, [0, 7, 0], 0.5)); Object.assign(p, { torso, head, armL: aL, armR: aR, legL: lL, legR: lR }); break;
    }
    case 'void': {
      const V = { opacity: 0.92, em: '#4a1a8a', ei: 0.7 };
      const torso = grp(cone(3.2, 8, '#1a0f2e', [0, 0, 0], V, 8, [Math.PI, 0, 0]), ico(3, '#241540', [0, 4.2, 0], V, 1)); torso.position.y = 6;
      for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; torso.add(box(0.5, 0.7, 0.1, '#ff4aff', [Math.cos(a) * 1.3, 4.2 + Math.sin(i * 2) * 0.9, 2.6 + Math.sin(a) * 0.4 - 0.4], eye('#ff40ff'))); }
      const head = grp(ico(1.9, '#120a22', [0, 0, 0], { opacity: 0.95 }, 1), box(0.7, 0.45, 0.1, '#ff6aff', [-0.7, 0.15, 1.7], eye('#ff40ff')), box(0.7, 0.45, 0.1, '#ff6aff', [0.7, 0.15, 1.7], eye('#ff40ff')), cone(0.4, 2.6, '#120a22', [-1.3, 1.9, 0], undefined, 5, [0, 0, 0.5]), cone(0.4, 2.6, '#120a22', [1.3, 1.9, 0], undefined, 5, [0, 0, -0.5])); head.position.set(0, 11, 0);
      const mkA = (s: number) => { const a = limb(1.0, 6, 1.0, '#1a0f2e', 3.4 * s, 9.8, 0, V); for (let i = -1; i <= 1; i++) a.add(cone(0.22, 2.2, '#c890ff', [i * 0.4, -6.6, 0.2], eye('#b04cff'), 4, [Math.PI, 0, 0])); return a; };
      const aL = mkA(-1), aR = mkA(1); const orbit = new THREE.Group(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; orbit.add(cone(0.5, 1.8, '#b04cff', [Math.cos(a) * 7, 5 + Math.sin(i * 1.7) * 2, Math.sin(a) * 7], eye('#9a30ff'), 4, [Math.sin(a) * 1, 0, Math.cos(a)])); }
      orbit.add(torus(7.4, 0.12, '#b04cff', [0, 6, 0], eye('#b04cff'), [Math.PI / 2, 0, 0])); g.add(torso, head, aL, aR, orbit, glow('#8a2aff', 22, [0, 8, 0], 0.5)); Object.assign(p, { torso, head, armL: aL, armR: aR, orbit }); break;
    }
    case 'wyrm': {
      const sc = '#3a4f7a', belly = '#c8d8f0'; const zap = { em: '#6ac8ff', ei: 2.5 };
      const body = new THREE.Group(); body.add(ico(2.6, sc, [0, 0, 0], undefined, 1, [1, 0.9, 1.7]), ico(2.2, belly, [0, -0.7, 0.4], undefined, 1, [0.9, 0.7, 1.5]));
      for (let i = 0; i < 5; i++) body.add(cone(0.4, 1.4, '#8fd8ff', [0, 2.2 - Math.abs(i - 2) * 0.2, -2 + i * 1], zap, 4));
      const neck = new THREE.Group(); neck.position.set(0, 0.6, 3.6); body.add(neck); neck.add(ico(1.3, sc, [0, 0.4, 0.6], undefined, 1, [1, 1, 1.5]), ico(1.1, sc, [0, 0.8, 2.0], undefined, 1, [1, 1, 1.3]));
      const head = new THREE.Group(); head.position.set(0, 1.2, 3.4); neck.add(head);
      head.add(ico(1.2, sc, [0, 0, 0], undefined, 1, [1, 0.9, 1.3]), box(1.0, 0.5, 1.8, sc, [0, -0.15, 1.5]), box(0.9, 0.2, 1.6, '#e8d8c0', [0, -0.6, 1.4]), box(0.3, 0.3, 0.1, '#ffe27a', [-0.6, 0.35, 0.8], eye('#6af0ff')), box(0.3, 0.3, 0.1, '#ffe27a', [0.6, 0.35, 0.8], eye('#6af0ff')), cone(0.25, 2.4, '#d8e8ff', [-0.6, 0.9, -0.8], zap, 5, [-1.2, 0, 0.3]), cone(0.25, 2.4, '#d8e8ff', [0.6, 0.9, -0.8], zap, 5, [-1.2, 0, -0.3]));
      for (let i = 0; i < 5; i++) { body.add(cone(0.18, 0.7, '#fff', [(i % 2 ? 0.4 : -0.4), -0.6, 4.5 + i * 0.01], undefined, 4)); }
      const tail: THREE.Group[] = []; let prev: THREE.Object3D = body; for (let i = 0; i < 6; i++) { const t = new THREE.Group(); t.position.set(0, 0, i === 0 ? -3.6 : -2.2); t.add(ico(1.7 - i * 0.22, sc, [0, 0, -1], undefined, 1, [1, 1, 1.4]), cone(0.3, 1.2 - i * 0.12, '#8fd8ff', [0, 1.2 - i * 0.15, -1], zap, 4)); prev.add(t); prev = t; tail.push(t); }
      prev.add(cone(0.9, 2.8, '#8fd8ff', [0, 0, -3.5], zap, 4, [-Math.PI / 2, 0, 0]));
      const wl = wingShape('#2c3e66', '#3a7ac0'), wr = wingShape('#2c3e66', '#3a7ac0'); wl.scale.x = -1; wl.position.set(-1.5, 1.4, 1); wr.position.set(1.5, 1.4, 1); body.add(wl, wr);
      for (const s of [-1, 1]) for (const z of [1.5, -1.8]) body.add(cyl(0.5, 0.35, 2, sc, [1.8 * s, -2, z], undefined, 6), cone(0.2, 0.6, '#fff', [1.8 * s, -3.2, z + 0.3], undefined, 4, [Math.PI, 0, 0]));
      g.add(body, glow('#6ac8ff', 14, [0, 1, 0], 0.5)); Object.assign(p, { body, neck, head, wingL: wl, wingR: wr, tail0: tail[0], tail1: tail[1], tail2: tail[2], tail3: tail[3], tail4: tail[4], tail5: tail[5] }); break;
    }
  }
  return fin(g, p);
}
