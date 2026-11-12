import * as THREE from 'three';
import { FORMS, ITEM_MAP, OUTFITS, type LookCfg, type Outfit } from './data';

export interface Look {
  skin: string; hairStyle: number; hairColor: string; eyeColor: string; face: number; outfit: Outfit; coat: string; coatColor: string; glove: string; gloveColor: string;
  acc: string[]; aura: string; scale: number; form: number; outline: boolean;
}
export function resolveLook(c: { look: LookCfg; outfit: string; armor: string; accs: string[] }, formId: number): Look {
  const f = FORMS[formId] ?? FORMS[0];
  const oitem = ITEM_MAP[c.outfit]; const aitem = ITEM_MAP[c.armor];
  const acc = [...c.look.acc, ...c.accs.map((a) => ITEM_MAP[a]?.acc ?? '')].filter(Boolean);
  return {
    skin: c.look.skin, hairStyle: formId >= 2 ? 5 : c.look.hairStyle, hairColor: f.hair || c.look.hairColor, eyeColor: f.eye || c.look.eyeColor, face: c.look.face,
    outfit: OUTFITS[oitem?.outfit ?? 'street'], coat: aitem?.coat ?? c.look.coat, coatColor: aitem ? aitem.color : c.look.coatColor, glove: c.look.glove, gloveColor: c.look.gloveColor,
    acc, aura: formId ? f.aura : c.look.aura, scale: 1, form: formId, outline: true,
  };
}

// ───── materials / geometry caches ─────
let gradient: THREE.DataTexture | null = null;
const getGrad = () => {
  if (!gradient) { gradient = new THREE.DataTexture(new Uint8Array([80, 140, 205, 255]), 4, 1, THREE.RedFormat); gradient.minFilter = THREE.NearestFilter; gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true; }
  return gradient;
};
const matCache = new Map<string, THREE.Material>();
export function toon(color: string, emissive = '', ei = 0, opts: { metal?: boolean; transparent?: boolean; opacity?: number; side?: THREE.Side; add?: boolean } = {}): THREE.Material {
  const key = [color, emissive, ei, opts.metal, opts.transparent, opts.opacity, opts.side, opts.add].join('|');
  let m = matCache.get(key); if (m) return m;
  if (opts.metal) m = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.35, emissive: emissive || '#000', emissiveIntensity: ei });
  else m = new THREE.MeshToonMaterial({ color, gradientMap: getGrad(), emissive: emissive || '#000', emissiveIntensity: ei });
  if (opts.transparent || opts.add) { m.transparent = true; m.opacity = opts.opacity ?? 1; m.depthWrite = false; }
  if (opts.add) m.blending = THREE.AdditiveBlending;
  if (opts.side !== undefined) m.side = opts.side;
  matCache.set(key, m); return m;
}
const glow = (color: string, opacity = 1) => { const k = 'glow' + color + opacity; let m = matCache.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false }); matCache.set(k, m); } return m; };
const OUTLINE = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  vertexShader: 'void main(){ vec3 p = position + normal*0.016; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);} ',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.012,0.018,0.045,1.0);} ',
});
const geoCache = new Map<string, THREE.BufferGeometry>();
function geo(key: string, f: () => THREE.BufferGeometry) { let g = geoCache.get(key); if (!g) { g = f(); geoCache.set(key, g); } return g; }
const limb = (len: number, r0: number, r1: number) => geo(`limb${len}${r0}${r1}`, () => new THREE.CylinderGeometry(r0, r1, len, 10).translate(0, -len / 2, 0));
const sph = (r: number, w = 14, h = 10) => geo(`s${r}${w}`, () => new THREE.SphereGeometry(r, w, h));
const box = (x: number, y: number, z: number) => geo(`b${x}${y}${z}`, () => new THREE.BoxGeometry(x, y, z));
const cyl = (r0: number, r1: number, h: number, s = 12, open = false) => geo(`c${r0}${r1}${h}${s}${open}`, () => new THREE.CylinderGeometry(r0, r1, h, s, 1, open));
const cone = (r: number, len: number, s = 5) => geo(`cn${r}${len}${s}`, () => new THREE.ConeGeometry(r, len, s).translate(0, len / 2, 0));
const torus = (r: number, t: number, arc = Math.PI * 2) => geo(`t${r}${t}${arc}`, () => new THREE.TorusGeometry(r, t, 6, 20, arc));
let auraTex: THREE.CanvasTexture | null = null;
function getAuraTex() {
  if (auraTex) return auraTex; const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64); auraTex = new THREE.CanvasTexture(c); return auraTex;
}

// ───── rig ─────
export const N_POSE = 28;
const P = { HY: 0, RP: 1, RR: 2, RY: 3, SX: 4, SY: 5, SZ: 6, HX: 7, HYW: 8, LSX: 9, LSZ: 10, LEX: 11, LSY: 12, RSX: 13, RSZ: 14, REX: 15, RSY: 16, LHX: 17, LHZ: 18, LKX: 19, LAX: 20, RHX: 21, RHZ: 22, RKX: 23, RAX: 24, MO: 25, EO: 26, BR: 27 };
export interface Strand { g: THREE.Group; q: THREE.Quaternion; w: number; ph: number }
export interface Rig {
  root: THREE.Group; body: THREE.Group; look: Look; pose: Float32Array; tgt: Float32Array; t: number; phase: number; blinkT: number; flow: number;
  j: Record<'spine' | 'chest' | 'neck' | 'head' | 'shL' | 'shR' | 'elL' | 'elR' | 'hipL' | 'hipR' | 'knL' | 'knR' | 'anL' | 'anR', THREE.Group>;
  handR: THREE.Group; handL: THREE.Group; eyes: THREE.Object3D[]; mouth: THREE.Mesh; brows: THREE.Object3D[]; hair: Strand[]; cloth: Strand[]; wings: THREE.Group[]; spinners: THREE.Object3D[];
  aura: THREE.Group; auraMats: THREE.Material[]; weapon: string; wGroup: THREE.Group[]; browBase: number; eyeBase: number;
}
export interface AnimState {
  mode: string; speed: number; atkP: number; combo: number; wtype: string; heavy: boolean; lean: number; vy: number; boost: number; fly01: number; castP: number; transP: number;
  hit: number; landP: number; ride: boolean; style: string;
}
export const defaultAnim = (): AnimState => ({ mode: 'idle', speed: 0, atkP: 0, combo: 0, wtype: '', heavy: false, lean: 0, vy: 0, boost: 0, fly01: 0, castP: 0, transP: 0, hit: 0, landP: 0, ride: false, style: '' });

const AXX = new THREE.Vector3(1, 0, 0); const UP = new THREE.Vector3(0, 1, 0); const tq = new THREE.Quaternion(); const tv = new THREE.Vector3();

export function buildRig(look: Look, castShadow = true): Rig {
  const L = look; const o = L.outfit; const ol = L.outline;
  const root = new THREE.Group(); const body = new THREE.Group(); const HIP = 0.99; body.position.y = HIP; root.add(body); root.scale.setScalar(L.scale);
  const skin = toon(L.skin); const darkSkin = toon(new THREE.Color(L.skin).multiplyScalar(0.75).getStyle());
  const mk = (g: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D, x = 0, y = 0, z = 0, outline = true) => {
    const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = castShadow; if (ol && outline) me.add(new THREE.Mesh(g, OUTLINE)); p.add(me); return me;
  };
  const grp = (p: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
  const hair: Strand[] = []; const cloth: Strand[] = []; const wings: THREE.Group[] = []; const spinners: THREE.Object3D[] = [];
  const strand = (parent: THREE.Object3D, list: Strand[], g0: THREE.BufferGeometry, m: THREE.Material, pos: number[], dir: number[], w: number, noOutline = false) => {
    const g = grp(parent, pos[0], pos[1], pos[2]); tv.set(dir[0], dir[1], dir[2]).normalize(); g.quaternion.setFromUnitVectors(UP, tv);
    mk(g0, m, g, 0, 0, 0, !noOutline); list.push({ g, q: g.quaternion.clone(), w, ph: Math.random() * 6 }); return g;
  };

  // pelvis & spine
  const pants = toon(o.bottom); const top = toon(o.top); const trim = toon(o.trim, o.trim, 0.25); const beltM = toon(o.belt, '', 0, { metal: o.belt.startsWith('#d') });
  const pelvis = mk(cyl(0.15, 0.14, 0.2, 14), pants, body, 0, -0.02, 0); pelvis.scale.z = 0.68;
  mk(cyl(0.152, 0.152, 0.04, 14), beltM, body, 0, 0.09, 0).scale.z = 0.7;
  const spine = grp(body, 0, 0.07, 0);
  const abd = mk(cyl(0.135, 0.15, 0.2, 14), top, spine, 0, 0.1, 0); abd.scale.z = 0.66;
  const chest = grp(spine, 0, 0.21, 0);
  const ch = mk(cyl(0.185, 0.135, 0.31, 16), top, chest, 0, 0.14, 0); ch.scale.z = 0.66;
  mk(box(0.04, 0.03, 0.01), toon('#d4af37', '', 0, { metal: true }), spine, 0, 0.09, 0.105, false);
  // suit/ninja details
  if (o.style === 'suit' || o.style === 'regal') { mk(box(0.035, 0.25, 0.01), trim, chest, 0, 0.14, 0.123, false); }
  if (o.style === 'ninja') { mk(box(0.34, 0.03, 0.2), toon(o.trim), chest, 0, 0.2, 0.0, false).scale.z = 0.66; }
  if (o.style === 'hoodie') { mk(torus(0.11, 0.035), top, chest, 0, 0.31, -0.02).rotation.x = Math.PI / 2 - 0.3; mk(box(0.18, 0.02, 0.012), trim, chest, 0, 0.08, 0.125, false); }
  if (o.style === 'tee') { mk(box(0.07, 0.07, 0.01), trim, chest, 0.06, 0.2, 0.123, false); }
  if (o.style === 'armorsuit') { mk(cyl(0.19, 0.14, 0.24, 8), toon('#2a1a40', o.trim, 0.2, { metal: true }), chest, 0, 0.17, 0).scale.z = 0.7; mk(sph(0.035), glow(o.trim), chest, 0, 0.2, 0.125, false); }
  // coat
  if (L.coat !== 'none') {
    const cm = toon(L.coatColor, '', 0, { side: THREE.DoubleSide, metal: L.coat === 'armor' });
    if (L.coat === 'armor') {
      const pl = mk(cyl(0.2, 0.15, 0.3, 10), cm, chest, 0, 0.15, 0.01); pl.scale.z = 0.7; mk(box(0.3, 0.08, 0.05), toon('#d4af37', '', 0, { metal: true }), spine, 0, 0.0, 0.1);
      mk(box(0.36, 0.1, 0.12), cm, body, 0, 0.0, 0.0);
    } else {
      const sh = mk(geo('coatshell', () => new THREE.CylinderGeometry(0.2, 0.17, 0.4, 16, 1, true, 0.5, Math.PI * 2 - 1.0)), cm, chest, 0, 0.1, 0); sh.scale.z = 0.7; sh.material = cm;
      if (L.coat === 'trench' || L.coat === 'cloak') {
        const len = L.coat === 'trench' ? 0.75 : 0.95;
        for (const sx of [-1, 1]) {
          const g = grp(body, sx * 0.08, -0.05, -0.1); mk(box(0.15, len, 0.02), cm, g, 0, -len / 2, 0, false); cloth.push({ g, q: g.quaternion.clone(), w: 1, ph: sx });
        }
        for (const sx of [-1, 1]) { const g = grp(body, sx * 0.14, -0.05, 0.02); mk(box(0.08, len * 0.8, 0.02), cm, g, 0, -len * 0.4, 0, false); cloth.push({ g, q: g.quaternion.clone(), w: 0.4, ph: sx + 1 }); }
        if (L.coat === 'cloak') { const g = grp(chest, 0, 0.3, -0.12); mk(box(0.4, 1.1, 0.02), cm, g, 0, -0.55, 0, false); cloth.push({ g, q: g.quaternion.clone(), w: 1.2, ph: 0.3 }); mk(sph(0.2, 12, 8), cm, chest, 0, 0.3, -0.02).scale.set(1.3, 0.35, 0.9); }
      } else { // jacket: short hem
        const g = grp(body, 0, 0.0, -0.1); mk(box(0.3, 0.2, 0.02), cm, g, 0, -0.1, 0, false); cloth.push({ g, q: g.quaternion.clone(), w: 0.6, ph: 0 });
      }
    }
  }
  // neck, head
  const neck = grp(chest, 0, 0.3, 0); mk(cyl(0.048, 0.055, 0.1, 10), skin, neck, 0, 0.02, 0, false);
  const head = grp(neck, 0, 0.11, 0.0);
  const faceShape = [{ ew: 0.032, eh: 0.036, tilt: 0.16, brow: 0.12, cl: 1 }, { ew: 0.036, eh: 0.045, tilt: -0.05, brow: -0.02, cl: 1 }, { ew: 0.034, eh: 0.03, tilt: 0.1, brow: 0.38, cl: 1 }, { ew: 0.032, eh: 0.027, tilt: 0.04, brow: 0.2, cl: 1 }][L.face % 4];
  mk(sph(0.14, 22, 16), skin, head, 0, 0.06, 0, false).scale.set(0.93, 1.05, 0.99);
  mk(sph(0.1, 14, 10), skin, head, 0, -0.02, 0.025, false).scale.set(0.88, 0.95, 0.95);
  for (const sx of [-1, 1]) { mk(sph(0.028, 8, 6), skin, head, sx * 0.128, 0.05, -0.005, false).scale.set(0.6, 1.1, 0.8); }
  const eyes: THREE.Object3D[] = []; const brows: THREE.Object3D[] = [];
  const irisM = toon(L.eyeColor, L.eyeColor, L.form ? 1.2 : 0.35);
  for (const sx of [-1, 1]) {
    const eg = grp(head, sx * 0.05, 0.06, 0.1235); eg.rotation.y = sx * 0.32; eg.rotation.z = sx * -faceShape.tilt * 0.5;
    const white = mk(geo('eyew', () => new THREE.CircleGeometry(1, 16)), glow('#f7f7fb'), eg, 0, 0, 0, false); white.scale.set(faceShape.ew, faceShape.eh, 1);
    const iris = mk(geo('eyei', () => new THREE.CircleGeometry(1, 16)), irisM, eg, 0, -0.002, 0.001, false); iris.scale.set(faceShape.ew * 0.72, faceShape.eh * 0.88, 1);
    const pup = mk(geo('eyei', () => new THREE.CircleGeometry(1, 16)), glow('#08060c'), eg, 0, -0.002, 0.002, false); pup.scale.set(faceShape.ew * 0.32, faceShape.eh * 0.5, 1);
    const hl = mk(geo('eyei', () => new THREE.CircleGeometry(1, 10)), glow('#ffffff'), eg, sx * -0.007, 0.011, 0.003, false); hl.scale.set(0.0075, 0.0075, 1);
    const hl2 = mk(geo('eyei', () => new THREE.CircleGeometry(1, 8)), glow('#ffffff'), eg, sx * 0.008, -0.012, 0.003, false); hl2.scale.set(0.004, 0.004, 1);
    mk(box(faceShape.ew * 2.3, 0.006, 0.004), glow('#0a0610'), eg, 0, faceShape.eh * 0.95, 0.004, false).rotation.z = sx * -faceShape.tilt;
    eyes.push(eg);
    const br = mk(box(0.05, 0.009, 0.006), toon(new THREE.Color(L.hairColor).multiplyScalar(0.7).getStyle()), head, sx * 0.052, 0.113, 0.121, false); br.rotation.y = sx * 0.3; br.rotation.z = sx * -faceShape.brow; brows.push(br);
  }
  mk(sph(0.01, 6, 4), darkSkin, head, 0, 0.025, 0.136, false);
  const mouth = mk(box(0.036, 0.007, 0.006), glow('#6a1a24'), head, 0, -0.018, 0.128, false);
  // hair
  const hm = toon(L.hairColor, L.hairColor, L.form ? 0.4 : 0.06);
  const cap = mk(geo('haircap', () => new THREE.SphereGeometry(0.153, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.6)), hm, head, 0, 0.065, -0.012); cap.rotation.x = -0.5; cap.scale.set(1.0, 1.02, 1.04);
  const S = (len: number, r: number, pos: number[], dir: number[], w: number) => strand(head, hair, cone(r, len, 5), hm, pos, dir, w);
  const mir = (len: number, r: number, pos: number[], dir: number[], w: number) => { S(len, r, pos, dir, w); if (pos[0] !== 0) S(len, r, [-pos[0], pos[1], pos[2]], [-dir[0], dir[1], dir[2]], w); };
  const bang = () => { mir(0.13, 0.04, [0, 0.16, 0.1], [0, -1, 0.3], 1); mir(0.12, 0.034, [0.045, 0.165, 0.09], [0.25, -1, 0.25], 1); mir(0.11, 0.03, [0.09, 0.15, 0.07], [0.8, -1, 0.15], 1); };
  switch (L.hairStyle % 6) {
    case 0: // spiky rebel
      mir(0.24, 0.06, [0, 0.2, -0.02], [0, 1, -0.15], -1); mir(0.22, 0.055, [0.07, 0.19, 0.02], [0.45, 1, -0.05], -1); mir(0.2, 0.05, [0.11, 0.15, -0.02], [1, 0.7, -0.2], -1);
      mir(0.22, 0.055, [0.07, 0.15, -0.1], [0.4, 0.7, -0.9], -1); mir(0.26, 0.06, [0, 0.12, -0.14], [0, 0.3, -1], -1); bang(); break;
    case 1: // slick villain
      strand(head, hair, cone(0.12, 0.44, 6), hm, [0, 0.12, -0.12], [0, -1, -0.3], 1);
      mir(0.2, 0.05, [0.06, 0.2, -0.04], [0.2, 0.4, -1], -1); mir(0.2, 0.05, [0, 0.21, -0.02], [0, 0.4, -1], -1); mir(0.11, 0.035, [0.13, 0.1, 0.0], [1, -0.5, 0], 1); mir(0.1, 0.03, [0.06, 0.18, 0.1], [0.4, 0.2, 1], 0.5); break;
    case 2: // ponytail
      bang(); mir(0.1, 0.03, [0.13, 0.1, 0.0], [1, -0.6, 0], 1);
      strand(head, hair, cone(0.07, 0.5, 6), hm, [0, 0.19, -0.14], [0, -0.55, -1], 1.3); mk(torus(0.05, 0.012), trim, head, 0, 0.19, -0.15, false); break;
    case 3: // messy
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const r = 0.1 + (i % 3) * 0.02; mir(0.1 + (i % 4) * 0.025, 0.045, [Math.sin(a) * r, 0.19 + (i % 2) * 0.03, Math.cos(a) * r - 0.04], [Math.sin(a), 0.8, Math.cos(a) * 0.7 - 0.2], -0.7); }
      bang(); mir(0.12, 0.04, [0.11, 0.1, -0.02], [1, -0.4, -0.1], 1); break;
    case 4: // long flow
      strand(head, hair, cone(0.14, 0.7, 7), hm, [0, 0.14, -0.1], [0, -1, -0.12], 1.2);
      for (const sx of [-1, 1]) { strand(head, hair, cone(0.06, 0.5, 6), hm, [sx * 0.13, 0.1, 0.0], [sx * 0.1, -1, 0], 1); strand(head, hair, cone(0.05, 0.42, 6), hm, [sx * 0.11, 0.1, 0.06], [sx * 0.2, -1, 0.1], 1); }
      bang(); break;
    default: // flame spikes
      for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.045; mir(0.3 + (i % 3) * 0.07, 0.06, [Math.abs(x), 0.2, -0.03 - Math.abs(x) * 0.5], [Math.sign(x) * (Math.abs(x) * 3 + 0.05), 1, -0.6], -1.2); }
      mir(0.24, 0.06, [0.1, 0.15, -0.06], [1, 0.6, -0.5], -1); mir(0.26, 0.06, [0.0, 0.12, -0.14], [0, 0.4, -1], -1); bang();
  }
  // accessories
  const has = (a: string) => L.acc.includes(a);
  if (has('mask')) { mk(sph(0.1, 12, 8), toon('#eeeef4'), head, 0, 0.0, 0.05, false).scale.set(0.95, 0.62, 0.9); mk(box(0.07, 0.008, 0.005), glow('#222'), head, 0, -0.025, 0.13, false); for (const sx of [-1, 1]) mk(box(0.012, 0.03, 0.005), glow('#222'), head, sx * 0.02, -0.04, 0.128, false); }
  if (has('goggles')) { mk(torus(0.148, 0.012), toon('#222'), head, 0, 0.12, 0, false).rotation.x = Math.PI / 2; for (const sx of [-1, 1]) mk(cyl(0.032, 0.032, 0.02, 12), glow('#00e5ff'), head, sx * 0.055, 0.12, 0.13, false).rotation.x = Math.PI / 2; }
  if (has('headband')) { mk(torus(0.146, 0.011), toon('#1a1a22'), head, 0, 0.115, 0, false).rotation.x = Math.PI / 2 - 0.05; mk(box(0.07, 0.035, 0.008), toon('#c8ced8', '', 0, { metal: true }), head, 0, 0.115, 0.15, false); }
  if (has('earring')) { for (const sx of [-1, 1]) mk(sph(0.012, 6, 5), glow('#ff2e57'), head, sx * 0.134, 0.015, -0.0, false); }
  if (has('visor')) mk(box(0.25, 0.04, 0.05), glow('#ff2040'), head, 0, 0.06, 0.12, false);
  if (has('halo') || L.form >= 4) { const h = mk(torus(0.17, 0.014), glow(L.form >= 4 ? '#ffd54a' : '#ffd54a'), head, 0, 0.36, -0.02, false); h.rotation.x = Math.PI / 2; spinners.push(h); }
  if (has('crown') || L.form >= 4) { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const c = mk(cone(0.018, 0.08, 4), toon('#ffd54a', '#ffb300', 0.8, { metal: true }), head, Math.sin(a) * 0.11, 0.22, Math.cos(a) * 0.11, false); c.rotation.x = Math.cos(a) * 0.2; c.rotation.z = -Math.sin(a) * 0.2; } mk(torus(0.11, 0.012), toon('#ffd54a', '#ffb300', 0.8, { metal: true }), head, 0, 0.22, 0, false).rotation.x = Math.PI / 2; }
  if (L.form >= 3) { for (const sx of [-1, 1]) { const g = grp(head, sx * 0.08, 0.2, 0.0); g.rotation.z = -sx * 0.5; g.rotation.x = -0.3; mk(cone(0.035, 0.22, 6), toon('#1b1030', L.aura, 0.5), g, 0, 0, 0); } }
  if (has('scarf')) { mk(torus(0.075, 0.035), toon('#d4143a'), neck, 0, 0.01, 0, false).rotation.x = Math.PI / 2; const g = grp(neck, 0.04, 0.0, -0.08); mk(box(0.07, 0.5, 0.012), toon('#d4143a'), g, 0, -0.25, 0, false); cloth.push({ g, q: g.quaternion.clone(), w: 1.5, ph: 0.2 }); const g2 = grp(neck, -0.04, 0.0, -0.08); mk(box(0.07, 0.38, 0.012), toon('#b01030'), g2, 0, -0.19, 0, false); cloth.push({ g: g2, q: g2.quaternion.clone(), w: 1.7, ph: 1.2 }); }
  if (has('cape') || L.form >= 3) { const g = grp(chest, 0, 0.3, -0.13); const cc = L.form >= 3 ? '#0c0820' : L.aura; mk(box(0.42, 1.15, 0.015), toon(cc, L.form >= 3 ? L.aura : '', L.form >= 3 ? 0.25 : 0, { side: THREE.DoubleSide }), g, 0, -0.58, 0, false); cloth.push({ g, q: g.quaternion.clone(), w: 1.3, ph: 0.7 }); }

  // arms
  const sleeveLong = o.style !== 'tee'; const sleeveM = sleeveLong ? top : skin; const gloveM = L.glove === 'none' ? skin : toon(L.gloveColor);
  const arm = (side: 1 | -1) => {
    const sh = grp(chest, side * 0.215, 0.28, 0); mk(sph(0.058, 10, 8), top, sh, 0, 0, 0, true);
    mk(limb(0.29, 0.047, 0.042), sleeveM, sh, 0, 0, 0);
    if (o.style === 'tee') mk(limb(0.13, 0.05, 0.048), top, sh, 0, 0, 0, false);
    const el = grp(sh, 0, -0.29, 0); mk(sph(0.04, 8, 6), sleeveM, el, 0, 0, 0, false);
    mk(limb(0.27, 0.04, 0.032), L.glove === 'long' ? gloveM : sleeveLong ? sleeveM : skin, el, 0, 0, 0);
    if (L.glove === 'gauntlet' || L.coat === 'armor') mk(limb(0.15, 0.047, 0.042), toon('#7a8294', '', 0, { metal: true }), el, 0, -0.1, 0);
    const hand = grp(el, 0, -0.29, 0); mk(sph(0.047, 10, 8), gloveM, hand, 0, -0.01, 0).scale.set(1, 1.15, 0.85);
    if (L.glove === 'fingerless') mk(box(0.07, 0.03, 0.05), skin, hand, 0, -0.05, 0, false);
    if (L.coat === 'armor' || L.form >= 2 || o.style === 'armorsuit') { const pd = mk(sph(0.085, 10, 8), toon(L.form >= 2 ? '#1a1020' : L.coatColor, L.form >= 2 ? L.aura : '', L.form >= 2 ? 0.5 : 0, { metal: true }), sh, side * 0.02, 0.03, 0); pd.scale.set(1.1, 0.7, 1.05); }
    return { sh, el, hand };
  };
  const aL = arm(1), aR = arm(-1);
  // legs
  const bootM = toon(o.boots);
  const leg = (side: 1 | -1) => {
    const hip = grp(body, side * 0.088, -0.07, 0); mk(limb(0.47, 0.082, 0.062), pants, hip, 0, 0, 0);
    const kn = grp(hip, 0, -0.47, 0); mk(sph(0.056, 8, 6), pants, kn, 0, 0, 0, false); mk(limb(0.45, 0.06, 0.042), pants, kn, 0, 0, 0);
    mk(limb(0.2, 0.052, 0.046), bootM, kn, 0, -0.25, 0);
    if (L.coat === 'armor') mk(sph(0.06, 8, 6), toon(L.coatColor, '', 0, { metal: true }), kn, 0, 0.0, 0.03).scale.set(1, 1, 0.8);
    const an = grp(kn, 0, -0.45, 0); mk(box(0.095, 0.075, 0.25), bootM, an, 0, -0.02, 0.05); mk(sph(0.048, 8, 6), bootM, an, 0, -0.02, 0.17).scale.set(1, 0.8, 0.9);
    mk(box(0.1, 0.012, 0.26), toon('#d8d8e0'), an, 0, -0.06, 0.05, false);
    return { hip, kn, an };
  };
  const lL = leg(1), lR = leg(-1);
  // form wings
  if (L.form >= 3) {
    const wm = toon(L.aura, L.aura, 1.1, { add: true, opacity: 0.8 });
    for (const sx of [-1, 1]) {
      const wg = grp(chest, sx * 0.08, 0.24, -0.12); const n = L.form >= 4 ? 5 : 4;
      for (let i = 0; i < n; i++) { const f = grp(wg, 0, 0, 0); f.rotation.z = sx * (0.5 + i * 0.28); f.rotation.x = 0.4; mk(cone(0.045, 0.55 + (n - i) * 0.12, 4), wm, f, 0, 0, 0, false); }
      wings.push(wg);
    }
  }
  if (L.form >= 2) mk(sph(0.04, 8, 6), glow(L.aura), chest, 0, 0.2, 0.124, false);
  // aura
  const aura = new THREE.Group(); const auraMats: THREE.Material[] = [];
  const am = new THREE.MeshBasicMaterial({ color: L.aura, map: getAuraTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); auraMats.push(am);
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42 + i * 0.08, 0.62 + i * 0.1, 2.2 + i * 0.3, 18, 1, true), am); m.position.y = 1.0 + i * 0.12; m.userData.i = i; aura.add(m); }
  aura.visible = false; root.add(aura);

  const rig: Rig = {
    root, body, look: L, pose: new Float32Array(N_POSE), tgt: new Float32Array(N_POSE), t: Math.random() * 10, phase: 0, blinkT: 2, flow: 0,
    j: { spine, chest, neck, head, shL: aL.sh, shR: aR.sh, elL: aL.el, elR: aR.el, hipL: lL.hip, hipR: lR.hip, knL: lL.kn, knR: lR.kn, anL: lL.an, anR: lR.an },
    handR: aR.hand, handL: aL.hand, eyes, mouth, brows, hair, cloth, wings, spinners, aura, auraMats, weapon: '', wGroup: [], browBase: faceShape.brow, eyeBase: 1,
  };
  return rig;
}

// ───── weapons ─────
export function setWeapon(rig: Rig, wtype: string, color: string, big = false) {
  const key = wtype + color + big; if (rig.weapon === key) return; rig.weapon = key;
  for (const g of rig.wGroup) g.parent?.remove(g); rig.wGroup = [];
  if (!wtype) return;
  const metal = toon('#cfd6e4', '', 0, { metal: true }); const dark = toon('#1c1a24'); const gl = glow(color); const edge = toon(color, color, 0.8, { metal: true });
  const mkb = (g: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D, x = 0, y = 0, z = 0) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; p.add(me); return me; };
  const handle = (g: THREE.Group, len: number) => { mkb(cyl(0.017, 0.017, len, 8), dark, g, 0, 0, -len * 0.3).rotation.x = Math.PI / 2; };
  const blade = (g: THREE.Group, w: number, len: number, z0: number) => { mkb(box(w, 0.012, len), metal, g, 0, 0, z0 + len / 2); mkb(box(w * 0.3, 0.016, len * 0.96), edge, g, 0, 0, z0 + len / 2); mkb(cone(w * 0.55, w * 1.6, 4), metal, g, 0, 0, z0 + len).rotation.x = Math.PI / 2; };
  const guard = (g: THREE.Group, w: number, z: number) => mkb(box(w, 0.03, 0.035), toon('#d4af37', '', 0, { metal: true }), g, 0, 0, z);
  const make = (kind: string): THREE.Group => {
    const g = new THREE.Group();
    if (kind === 'dagger') { handle(g, 0.14); guard(g, 0.08, 0.06); blade(g, 0.04, 0.3, 0.07); }
    else if (kind === 'sword') { handle(g, 0.24); guard(g, 0.1, 0.08); blade(g, 0.045, 0.92, 0.09); }
    else if (kind === 'blade2') { handle(g, 0.16); guard(g, 0.07, 0.06); blade(g, 0.05, 0.55, 0.07); }
    else if (kind === 'greatsword') { handle(g, 0.34); guard(g, 0.3, 0.1); blade(g, 0.15, 1.35, 0.11); mkb(box(0.03, 0.02, 1.2), gl, g, 0, 0.012, 0.75); }
    else if (kind === 'spear') { mkb(cyl(0.02, 0.02, 2.3, 8), dark, g, 0, 0, 0.6).rotation.x = Math.PI / 2; mkb(cone(0.055, 0.42, 6), edge, g, 0, 0, 1.75).rotation.x = Math.PI / 2; mkb(torus(0.04, 0.012), toon('#d4143a'), g, 0, 0, 1.52); mkb(sph(0.03, 6, 5), gl, g, 0, 0, -0.55); }
    else if (kind === 'scythe') {
      mkb(cyl(0.02, 0.02, 1.9, 8), dark, g, 0, 0, 0.55).rotation.x = Math.PI / 2;
      const arc = mkb(torus(0.55, 0.03, Math.PI * 0.75), edge, g, 0, 0.0, 1.5); arc.rotation.set(0, 0, 0); arc.rotation.z = Math.PI * 0.5 + 0.2; arc.rotation.x = Math.PI / 2; arc.position.set(0, 0.55, 1.5); arc.rotation.order = 'YXZ'; arc.rotation.set(0, Math.PI / 2, -Math.PI * 0.9); arc.scale.set(1, 1, 0.5);
      mkb(sph(0.04, 6, 5), gl, g, 0, 0, 1.5);
    } else if (kind === 'energy') {
      const s = big ? 1.5 : 1; mkb(box(0.05 * s, 0.1 * s, 0.26 * s), dark, g, 0, 0, 0.08); mkb(cyl(0.025 * s, 0.03 * s, 0.3 * s, 10), metal, g, 0, 0.02 * s, 0.3 * s).rotation.x = Math.PI / 2; mkb(sph(0.04 * s, 8, 6), gl, g, 0, 0.04 * s, 0.1 * s); mkb(box(0.012, 0.02, 0.24 * s), gl, g, 0, 0.056 * s, 0.1 * s);
      if (big) { mkb(cyl(0.06, 0.08, 0.2, 10), edge, g, 0, 0.03, 0.55).rotation.x = Math.PI / 2; }
    } else { // special: soul orb on chain
      mkb(cyl(0.015, 0.015, 0.4, 6), dark, g, 0, 0, 0.1).rotation.x = Math.PI / 2; const orb = mkb(sph(0.13, 12, 10), gl, g, 0, 0.0, 0.6); mkb(torus(0.2, 0.012), edge, g, 0, 0, 0.6); orb.userData.orb = true;
      for (let i = 0; i < 3; i++) { const o2 = mkb(sph(0.04, 6, 5), gl, g, Math.sin(i * 2.1) * 0.22, Math.cos(i * 2.1) * 0.22, 0.6); o2.userData.spin = i; }
    }
    return g;
  };
  const K0 = wtype === 'dual' ? 'blade2' : wtype;
  const r = make(K0); rig.handR.add(r); rig.wGroup.push(r);
  if (wtype === 'dual') { const l = make('blade2'); rig.handL.add(l); rig.wGroup.push(l); }
  if (wtype === 'greatsword') for (const g of rig.wGroup) g.rotation.x = 0;
}

// ───── animation ─────
const kf = (p: number, k: number[][]) => {
  if (p <= k[0][0]) return k[0][1]; for (let i = 1; i < k.length; i++) { if (p <= k[i][0]) { const a = k[i - 1], b = k[i]; const t = (p - a[0]) / (b[0] - a[0]); const e = t * t * (3 - 2 * t); return a[1] + (b[1] - a[1]) * e; } } return k[k.length - 1][1];
};
const bump = (p: number) => Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);

function computePose(rig: Rig, s: AnimState, o: Float32Array) {
  o.fill(0); const t = rig.t; const run = Math.min(1, Math.max(0, (s.speed - 4.5) / 7)); const a = Math.min(1, s.speed / 5);
  // defaults: idle/ready
  const armed = !!s.wtype && s.wtype !== 'special';
  o[P.LSZ] = 0.1; o[P.RSZ] = 0.1; o[P.LEX] = -0.22; o[P.REX] = armed ? -1.1 : -0.22; o[P.RSX] = armed ? -0.35 : 0; o[P.LHZ] = 0.03; o[P.RHZ] = 0.03; o[P.EO] = 1; o[P.MO] = 0;
  const m = s.mode;
  if (m === 'idle' || m === 'run') {
    o[P.SX] = Math.sin(t * 1.7) * 0.018; o[P.HX] = Math.sin(t * 1.1) * 0.03; o[P.HY] = Math.sin(t * 1.7) * 0.006; o[P.LSZ] += Math.sin(t * 1.7) * 0.02; o[P.RSZ] += Math.sin(t * 1.7) * 0.02;
    if (m === 'idle') { o[P.HYW] = Math.sin(t * 0.55) * 0.035; o[P.SY] = Math.sin(t * 0.8) * 0.018; o[P.HY] += Math.sin(t * 2.2) * 0.008; }
    if (m === 'run' && a > 0.02) {
      const ph = rig.phase; const sn = Math.sin(ph), cs = Math.cos(ph); const A = 0.5 + run * 0.65;
      o[P.LHX] = -sn * A * a; o[P.RHX] = sn * A * a; o[P.LKX] = (Math.max(0, cs) * (0.7 + run * 0.9) + 0.06) * a; o[P.RKX] = (Math.max(0, -cs) * (0.7 + run * 0.9) + 0.06) * a;
      o[P.LAX] = sn * 0.25 * a; o[P.RAX] = -sn * 0.25 * a;
      o[P.LSX] = sn * (0.55 + run * 0.35) * a; o[P.LEX] = -0.3 - run * 0.9; o[P.SY] = sn * 0.16 * a; o[P.SX] = 0.06 + run * 0.16; o[P.HX] = -0.05 - run * 0.1; o[P.HY] = -Math.abs(cs) * 0.035 * a - run * 0.05;
      if (armed) { o[P.RSX] = -0.3 + Math.sin(ph) * 0.15; o[P.REX] = -1.0; } else { o[P.RSX] = -sn * (0.55 + run * 0.35) * a; o[P.REX] = -0.3 - run * 0.9; }
      o[P.RP] = 0.04 + run * 0.1;
    }
  } else if (m === 'air') {
    const up = Math.max(0, Math.min(1, s.vy / 8)); const dn = 1 - up;
    o[P.LHX] = -0.5 - up * 0.4; o[P.LKX] = 0.9 + up * 0.3; o[P.RHX] = 0.2 + dn * 0.3; o[P.RKX] = 0.5 + dn * 0.4;
    o[P.LSZ] = 0.4 + dn * 1.0; o[P.RSZ] = 0.4 + dn * 1.0; o[P.LSX] = -0.6 * up; o[P.RSX] = -0.6 * up; o[P.LEX] = -0.5; o[P.REX] = -0.5; o[P.SX] = 0.05; o[P.HX] = -0.1; o[P.MO] = 0.3;
  } else if (m === 'fly' || m === 'dive') {
    const f = s.fly01; const b = s.boost; const dive = m === 'dive';
    o[P.RP] = dive ? 1.5 : 0.1 + f * 0.9 + b * 0.4; o[P.RR] = s.lean * 0.7; o[P.HX] = -o[P.RP] * 0.75; o[P.HY] = (1 - f) * Math.sin(t * 2.2) * 0.04;
    const fl = Math.sin(t * 9) * 0.05 * b;
    if (dive || b > 0.3) { o[P.LSX] = -2.9 + fl; o[P.RSX] = -2.9 - fl; o[P.LSZ] = 0.05; o[P.RSZ] = 0.05; o[P.LEX] = -0.05; o[P.REX] = armed && !dive ? -0.1 : -0.05; o[P.LHX] = 0.12; o[P.RHX] = 0.12; o[P.LKX] = 0.12; o[P.RKX] = 0.2; o[P.LHZ] = 0.03; o[P.RHZ] = -0.03; o[P.EO] = 0.8; o[P.MO] = 0.5; o[P.BR] = 0.3; }
    else {
      o[P.LSX] = 0.35 - f * 0.4; o[P.RSX] = 0.15 - f * 0.9; o[P.LSZ] = 0.35; o[P.RSZ] = 0.25; o[P.LEX] = -0.4; o[P.REX] = armed ? -1.0 : -0.4;
      o[P.LHX] = -0.1 + Math.sin(t * 2.1) * 0.08 - f * 0.1; o[P.RHX] = 0.1 + Math.sin(t * 2.1 + 1) * 0.08; o[P.LKX] = 0.4 + f * 0.3; o[P.RKX] = 0.3 + f * 0.3; o[P.LAX] = 0.4; o[P.RAX] = 0.4; o[P.SX] = 0.05; o[P.SY] = s.lean * 0.3;
    }
  } else if (m === 'dash') {
    o[P.RP] = 0.75; o[P.HX] = -0.5; o[P.LSX] = 1.1; o[P.RSX] = 1.1; o[P.LEX] = -0.6; o[P.REX] = -0.6; o[P.LHX] = -0.9; o[P.LKX] = 0.9; o[P.RHX] = 0.9; o[P.RKX] = 0.2; o[P.EO] = 0.7; o[P.BR] = 0.3;
  } else if (m === 'land') {
    const c = 1 - s.landP; o[P.HY] = -0.36 * c; o[P.LHX] = -1.0 * c; o[P.RHX] = -0.8 * c; o[P.LKX] = 1.8 * c; o[P.RKX] = 1.7 * c; o[P.SX] = 0.5 * c; o[P.HX] = -0.35 * c; o[P.RSX] = -0.4 * c; o[P.RSZ] = 0.1 + 0.7 * c; o[P.LSZ] = 0.1 + 0.9 * c; o[P.LSX] = 0.3 * c; o[P.LAX] = 0.5 * c; o[P.RAX] = 0.5 * c;
  } else if (m === 'block') {
    o[P.LSX] = -1.2; o[P.RSX] = -1.3; o[P.LSZ] = -0.45; o[P.RSZ] = -0.4; o[P.LEX] = -2.3; o[P.REX] = -2.3; o[P.SX] = 0.15; o[P.HX] = 0.15; o[P.LKX] = 0.4; o[P.RKX] = 0.4; o[P.LHX] = -0.3; o[P.RHX] = 0.2; o[P.BR] = 0.4; o[P.HY] = -0.05;
  } else if (m === 'hit') {
    const h = s.hit; o[P.SX] = -0.35 * h; o[P.HX] = 0.45 * h; o[P.LSX] = 0.6 * h; o[P.RSX] = 0.6 * h; o[P.LSZ] = 0.1 + 0.9 * h; o[P.RSZ] = 0.1 + 0.9 * h; o[P.LKX] = 0.3 * h; o[P.RKX] = 0.5 * h; o[P.EO] = 0.3; o[P.MO] = 0.8; o[P.RP] = -0.2 * h; o[P.BR] = 0.5;
  } else if (m === 'dead') {
    o[P.RP] = -1.5; o[P.HY] = -0.78; o[P.LSZ] = 0.9; o[P.RSZ] = 0.9; o[P.LHZ] = 0.2; o[P.RHZ] = 0.2; o[P.LKX] = 0.1; o[P.RKX] = 0.25; o[P.HX] = 0.2; o[P.EO] = 0.05; o[P.LEX] = -0.3; o[P.REX] = -0.2; o[P.LSX] = 0.4;
  } else if (m === 'transform') {
    const p = Math.min(1, s.transP); const sh = Math.sin(t * 60) * 0.03 * (1 - p * 0.5);
    o[P.LSZ] = 0.4 + 1.0 * Math.min(1, p * 2.2); o[P.RSZ] = 0.4 + 1.0 * Math.min(1, p * 2.2); o[P.LEX] = -0.5 + sh; o[P.REX] = -0.5 - sh; o[P.HX] = -0.5; o[P.SX] = -0.2 + sh; o[P.HY] = 0.12 * p + sh; o[P.LKX] = 0.5; o[P.RKX] = 0.5; o[P.MO] = 1; o[P.BR] = 0.55; o[P.EO] = 0.7; o[P.LSX] = -0.4; o[P.RSX] = -0.4;
  } else if (m === 'ride') {
    o[P.HY] = -0.44; o[P.LHX] = -1.35; o[P.RHX] = -1.35; o[P.LKX] = 1.4; o[P.RKX] = 1.4; o[P.LHZ] = 0.2; o[P.RHZ] = 0.2; o[P.LSX] = -1.15; o[P.RSX] = -1.15; o[P.LEX] = -0.5; o[P.REX] = -0.5; o[P.SX] = 0.35; o[P.HX] = -0.3; o[P.RR] = s.lean * 0.4;
  } else if (m === 'cast') {
    const p = s.castP; const ch = kf(p, [[0, 0], [0.3, 1], [0.5, 0], [1, 0]]); const th = kf(p, [[0, 0], [0.3, 0], [0.45, 1], [1, 0.6]]);
    o[P.LSX] = -0.9 - th * 0.65 + ch * 0.2; o[P.RSX] = -0.9 - th * 0.65 + ch * 0.2; o[P.LSZ] = 0.15 - ch * 0.1; o[P.RSZ] = 0.15 - ch * 0.1; o[P.LEX] = -1.5 + th * 1.4; o[P.REX] = -1.5 + th * 1.4; o[P.SX] = -0.1 * ch + 0.12 * th; o[P.HX] = -0.1;
    o[P.LHX] = -0.4; o[P.RHX] = 0.3; o[P.LKX] = 0.4; o[P.RKX] = 0.3; o[P.MO] = th * 0.6; o[P.BR] = 0.35; o[P.RP] = 0.05;
    if (s.mode === 'cast' && s.fly01 > 0) { o[P.RP] = 0.1 + s.fly01 * 0.5; o[P.LHX] = 0.05; o[P.RHX] = 0.1; }
  } else if (m === 'attack') {
    attackPose(s, o);
  }
  o[P.MO] = Math.max(o[P.MO], 0); o[P.EO] = Math.max(0.05, o[P.EO]);
  if (s.hit > 0 && m !== 'hit' && m !== 'dead') { o[P.SX] -= 0.2 * s.hit; o[P.HX] += 0.2 * s.hit; o[P.MO] = 0.6; o[P.EO] = 0.5; }
}

function attackPose(s: AnimState, o: Float32Array) {
  const p = s.atkP; const c = s.combo % 3; const w = s.wtype; const lvl = bump(p); const alt = s.combo % 2 ? -1 : 1;
  o[P.EO] = 0.85; o[P.BR] = 0.4; o[P.MO] = kf(p, [[0, 0], [0.3, 0.1], [0.5, 0.9], [1, 0]]);
  const lunge = (f: number) => { o[P.LHX] = -0.55 * f; o[P.LKX] = 0.55 * f; o[P.RHX] = 0.45 * f; o[P.RKX] = 0.25 * f; o[P.LHZ] = 0.1 * f; o[P.RHZ] = 0.15 * f; o[P.HY] = -0.07 * f; };
  const fly = s.fly01 > 0.01;
  const R = (a: number[][]) => kf(p, a);
  if (s.heavy && (w === 'sword' || w === 'dagger' || w === 'dual' || w === 'greatsword' || w === 'scythe' || w === '')) {
    o[P.RSX] = R([[0, -0.4], [0.45, -3.1], [0.6, -3.1], [0.75, -0.15], [1, -0.4]]); o[P.LSX] = R([[0, -0.2], [0.45, -2.9], [0.6, -2.9], [0.75, -0.3], [1, -0.2]]); o[P.REX] = R([[0, -1], [0.45, -0.4], [0.75, -0.1], [1, -0.8]]); o[P.LEX] = R([[0, -0.3], [0.45, -0.5], [0.75, -0.1], [1, -0.3]]);
    o[P.SX] = R([[0, 0], [0.45, -0.35], [0.75, 0.6], [1, 0]]); o[P.HX] = R([[0, 0], [0.45, -0.3], [0.75, 0.3], [1, 0]]); o[P.RSZ] = 0.1; o[P.LSZ] = 0.1; o[P.HY] = R([[0, 0], [0.45, 0.05], [0.75, -0.25], [1, 0]]) * (fly ? 0.3 : 1);
    o[P.LHX] = -0.6 * lvl; o[P.RHX] = 0.6 * lvl; o[P.LKX] = 0.9 * lvl; o[P.RKX] = 0.5 * lvl; return;
  }
  if (w === 'spear') {
    o[P.RSX] = R([[0, -0.7], [0.25, -0.3], [0.45, -1.5], [1, -0.7]]); o[P.REX] = R([[0, -1], [0.25, -2.0], [0.45, -0.1], [1, -1]]); o[P.LSX] = R([[0, -1.0], [0.25, -0.8], [0.45, -1.4], [1, -1.0]]); o[P.LEX] = R([[0, -1], [0.25, -1.6], [0.45, -0.3], [1, -1]]);
    o[P.SY] = R([[0, 0], [0.25, -0.6], [0.45, 0.5], [1, 0]]); o[P.SX] = R([[0, 0], [0.25, -0.1], [0.45, 0.25], [1, 0]]); lunge(lvl * 1.6); o[P.LHX] = -0.9 * lvl; o[P.LKX] = 0.7 * lvl; return;
  }
  if (w === 'scythe') {
    o[P.RSX] = -1.25; o[P.LSX] = -1.1; o[P.RSZ] = R([[0, -0.9], [0.3, -1.3], [0.55, 1.1], [1, 0.1]]); o[P.LSZ] = R([[0, -0.6], [0.3, -0.9], [0.55, 0.9], [1, 0.1]]); o[P.REX] = -0.5; o[P.LEX] = -0.7;
    o[P.SY] = R([[0, 1.1], [0.3, 1.4], [0.55, -1.6], [1, 0]]) * alt; o[P.SX] = 0.15; lunge(lvl); return;
  }
  if (w === 'energy' || w === 'special') {
    o[P.RSX] = R([[0, -1.3], [0.15, -1.55], [0.3, -1.3], [1, -1.2]]); o[P.REX] = R([[0, -0.4], [0.15, -0.05], [1, -0.4]]); o[P.LSX] = w === 'special' ? R([[0, -1.0], [0.2, -1.6], [1, -1.0]]) : -0.6; o[P.LEX] = -1.0; o[P.SY] = -0.25; o[P.SX] = R([[0, 0], [0.15, -0.1], [1, 0]]); o[P.HX] = -0.05; lunge(0.4); return;
  }
  if (w === 'greatsword' ) { /* handled by heavy-like */ }
  if (w === '' || w === 'martial') { // fists & kicks
    if (c === 2) { o[P.RHX] = R([[0, 0], [0.3, -0.3], [0.5, -1.55], [1, 0]]); o[P.RKX] = R([[0, 0.2], [0.3, 1.5], [0.5, 0.05], [1, 0.2]]); o[P.LKX] = 0.4; o[P.LHX] = 0.3; o[P.SX] = R([[0, 0], [0.5, 0.3], [1, 0]]) - 0.1; o[P.LSX] = -0.7; o[P.RSX] = 0.6; o[P.LSZ] = 0.6; o[P.RSZ] = 0.6; o[P.LEX] = -1.2; o[P.REX] = -0.7; return; }
    const side = c === 0 ? 'R' : 'L'; const sx = side === 'R' ? P.RSX : P.LSX, ex = side === 'R' ? P.REX : P.LEX, ox = side === 'R' ? P.LSX : P.RSX, oe = side === 'R' ? P.LEX : P.REX;
    o[sx] = R([[0, -0.5], [0.2, -0.2], [0.4, -1.58], [1, -0.5]]); o[ex] = R([[0, -1.8], [0.2, -2.3], [0.4, -0.04], [1, -1.5]]); o[ox] = -0.6; o[oe] = -1.9;
    o[P.SY] = R([[0, 0], [0.2, side === 'R' ? 0.5 : -0.5], [0.4, side === 'R' ? -0.5 : 0.5], [1, 0]]); lunge(lvl); return;
  }
  // sword / dagger / dual (and greatsword light attacks)
  const two = w === 'greatsword' || c === 2;
  const sd = w === 'dual' && c % 2 === 1 ? 'L' : 'R';
  const aS = sd === 'R' ? P.RSX : P.LSX, aZ = sd === 'R' ? P.RSZ : P.LSZ, aE = sd === 'R' ? P.REX : P.LEX;
  if (c === 0) { o[aS] = R([[0, -0.5], [0.28, -2.6], [0.5, -0.8], [1, -0.4]]); o[aZ] = R([[0, 0.3], [0.28, 1.0], [0.5, -0.3], [1, 0.2]]); o[aE] = R([[0, -0.8], [0.28, -0.4], [0.5, -0.12], [1, -0.8]]); o[P.SY] = R([[0, 0], [0.28, 0.7], [0.5, -0.8], [1, 0]]) * (sd === 'R' ? 1 : -1); o[P.SX] = R([[0, 0], [0.28, -0.1], [0.5, 0.3], [1, 0]]); }
  else if (c === 1) { o[aS] = R([[0, -1.4], [0.25, -1.5], [0.5, -1.45], [1, -0.4]]); o[aZ] = R([[0, 1.3], [0.25, 1.5], [0.5, -0.9], [1, 0.2]]); o[aE] = R([[0, -0.6], [0.5, -0.1], [1, -0.8]]); o[P.SY] = R([[0, 0.9], [0.25, 0.95], [0.5, -1.0], [1, 0]]) * (sd === 'R' ? 1 : -1); o[P.SX] = 0.1 * lvl; }
  else { o[P.RSX] = R([[0, -0.5], [0.3, -3.0], [0.5, -0.2], [1, -0.4]]); o[P.LSX] = R([[0, -0.3], [0.3, -2.8], [0.5, -0.3], [1, -0.2]]); o[P.REX] = R([[0, -1], [0.3, -0.4], [0.5, -0.1], [1, -0.8]]); o[P.LEX] = -0.4 * lvl; o[P.SX] = R([[0, 0], [0.3, -0.25], [0.5, 0.45], [1, 0]]); o[P.HX] = R([[0, 0], [0.3, -0.2], [0.5, 0.25], [1, 0]]); }
  if (two && c !== 2) { o[P.LSX] = o[P.RSX] * 0.9; o[P.LSZ] = o[P.RSZ] * 0.6; o[P.LEX] = -0.6; }
  if (w === 'dual' && c === 2) { o[P.LSX] = o[P.RSX]; }
  lunge(lvl);
}

const smooth = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
export function updateRig(rig: Rig, s: AnimState, dt: number, speedNorm: number) {
  rig.t += dt; const k = Math.min(0.3, dt);
  if (s.mode === 'run') rig.phase += k * (4.5 + s.speed * 0.62);
  computePose(rig, s, rig.tgt);
  const rate = s.mode === 'attack' ? 34 : s.mode === 'hit' || s.mode === 'cast' ? 22 : s.mode === 'dead' ? 10 : 13; const f = smooth(rate, k);
  for (let i = 0; i < N_POSE; i++) rig.pose[i] += (rig.tgt[i] - rig.pose[i]) * f;
  const q = rig.pose, j = rig.j;
  rig.body.position.y = 0.99 + q[P.HY]; rig.body.rotation.set(q[P.RP], q[P.RY], q[P.RR]);
  j.spine.rotation.set(q[P.SX], q[P.SY], q[P.SZ]); j.chest.rotation.set(q[P.SX] * 0.5, q[P.SY] * 0.6, 0);
  j.neck.rotation.set(q[P.HX] * 0.4, q[P.HYW] * 0.4, 0); j.head.rotation.set(q[P.HX] * 0.6, q[P.HYW] * 0.6, 0);
  j.shL.rotation.set(q[P.LSX], q[P.LSY], q[P.LSZ]); j.shR.rotation.set(q[P.RSX], q[P.RSY], -q[P.RSZ]); j.elL.rotation.x = q[P.LEX]; j.elR.rotation.x = q[P.REX];
  j.hipL.rotation.set(q[P.LHX], 0, q[P.LHZ]); j.hipR.rotation.set(q[P.RHX], 0, -q[P.RHZ]); j.knL.rotation.x = q[P.LKX]; j.knR.rotation.x = q[P.RKX]; j.anL.rotation.x = q[P.LAX] - q[P.LKX] * 0.4 - q[P.LHX] * 0.3; j.anR.rotation.x = q[P.RAX] - q[P.RKX] * 0.4 - q[P.RHX] * 0.3;
  // face
  rig.blinkT -= dt; let blink = 1; if (rig.blinkT < 0) { blink = 0.08; if (rig.blinkT < -0.12) rig.blinkT = 2 + Math.random() * 3; }
  for (const e of rig.eyes) e.scale.y = Math.max(0.06, q[P.EO] * blink);
  rig.mouth.scale.set(1 - q[P.MO] * 0.2, 1 + q[P.MO] * 6, 1);
  rig.brows.forEach((b, i) => { const sx = i === 0 ? -1 : 1; b.rotation.z = sx * -(rig.browBase + q[P.BR]); b.position.y = 0.113 - q[P.BR] * 0.01; });
  // dynamic hair & cloth
  rig.flow = damp2(rig.flow, speedNorm, 6, dt); const fl = rig.flow; const t = rig.t;
  for (const h of rig.hair) { const a = (fl * 0.55 + Math.sin(t * 3 + h.ph) * (0.04 + fl * 0.06)) * h.w; tq.setFromAxisAngle(AXX, a); h.g.quaternion.copy(h.q).multiply(tq); }
  for (const c of rig.cloth) { const a = 0.05 + fl * 0.9 * c.w + Math.sin(t * 4 + c.ph) * (0.03 + fl * 0.1); tq.setFromAxisAngle(AXX, a); c.g.quaternion.copy(c.q).multiply(tq); }
  rig.wings.forEach((w, i) => { const sx = i === 0 ? -1 : 1; w.rotation.y = sx * (0.35 + Math.sin(t * 3) * 0.1 + fl * 0.5); });
  for (const sp of rig.spinners) sp.rotation.z += dt * 2;
  // special weapon orbs
  for (const g of rig.wGroup) g.traverse((c) => { if (c.userData.spin !== undefined) { const a = t * 3 + c.userData.spin * 2.1; c.position.x = Math.sin(a) * 0.22; c.position.y = Math.cos(a) * 0.22; } });
}
function damp2(a: number, b: number, k: number, dt: number) { return a + (b - a) * (1 - Math.exp(-k * dt)); }

export function setAura(rig: Rig, intensity: number, color?: string) {
  const v = intensity > 0.02; rig.aura.visible = v; if (!v) return;
  const m = rig.auraMats[0] as THREE.MeshBasicMaterial; m.opacity = Math.min(0.9, intensity * (0.55 + Math.sin(rig.t * 14) * 0.08)); if (color) m.color.set(color);
  rig.aura.children.forEach((c, i) => { c.rotation.y += 0.04 * (i + 1); const s = 1 + Math.sin(rig.t * 9 + i * 2) * 0.05 + intensity * 0.12; c.scale.set(s, 1 + Math.sin(rig.t * 12 + i) * 0.05, s); });
}
export function disposeRig(rig: Rig) { rig.root.parent?.remove(rig.root); }
