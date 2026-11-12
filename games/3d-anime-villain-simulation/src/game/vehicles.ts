import * as THREE from 'three';

export interface VSpec {
  type: string; name: string; l: number; w: number; g: number; belt: number; nose: number; tail: number; roof: number; cab: [number, number, number, number]; wr: number;
  max: number; acc: number; steer: number; hp: number; bike?: boolean; extras?: string[]; colors: string[];
}
export const VSPECS: Record<string, VSpec> = {
  sports: { type: 'sports', name: 'Falcon GT Coupe', l: 4.4, w: 1.86, g: 0.2, belt: 0.74, nose: 0.56, tail: 0.76, roof: 1.22, cab: [-0.2, -0.1, 0.07, 0.22], wr: 0.34, max: 56, acc: 24, steer: 1.0, hp: 100, extras: ['spoiler'], colors: ['#d4143a', '#1d6bff', '#ffcc00', '#f4f4f6'] },
  supercar: { type: 'supercar', name: 'Vortex Hypercar', l: 4.6, w: 2.0, g: 0.12, belt: 0.62, nose: 0.42, tail: 0.7, roof: 1.12, cab: [-0.1, -0.02, 0.1, 0.25], wr: 0.35, max: 74, acc: 34, steer: 1.05, hp: 90, extras: ['wing', 'intake'], colors: ['#ff6a00', '#7c3aed', '#14d1b0', '#111111'] },
  sedan: { type: 'sedan', name: 'Civic Sedan', l: 4.6, w: 1.78, g: 0.22, belt: 0.82, nose: 0.76, tail: 0.88, roof: 1.45, cab: [-0.32, -0.2, 0.08, 0.2], wr: 0.32, max: 42, acc: 16, steer: 0.9, hp: 110, colors: ['#8a94a6', '#2b3a55', '#a8182b', '#e5e7eb', '#1b5e3a'] },
  suv: { type: 'suv', name: 'Titan SUV', l: 4.9, w: 2.0, g: 0.34, belt: 1.1, nose: 1.0, tail: 1.05, roof: 1.85, cab: [-0.44, -0.42, 0.1, 0.22], wr: 0.4, max: 40, acc: 15, steer: 0.8, hp: 160, extras: ['rack'], colors: ['#222831', '#5c4a32', '#e5e7eb', '#33415c'] },
  bike: { type: 'bike', name: 'Reaper Superbike', l: 2.1, w: 0.7, g: 0.2, belt: 0.6, nose: 0.5, tail: 0.6, roof: 0.6, cab: [0, 0, 0, 0], wr: 0.33, max: 62, acc: 28, steer: 1.3, hp: 60, bike: true, colors: ['#e11d48', '#0ea5e9', '#111827', '#f59e0b'] },
  truck: { type: 'truck', name: 'Hauler Truck', l: 7.2, w: 2.5, g: 0.5, belt: 1.5, nose: 1.4, tail: 1.2, roof: 2.9, cab: [0.1, 0.12, 0.3, 0.4], wr: 0.55, max: 30, acc: 9, steer: 0.55, hp: 260, extras: ['cargo'], colors: ['#c2410c', '#1e40af', '#e5e7eb', '#166534'] },
  van: { type: 'van', name: 'Courier Van', l: 5.0, w: 2.0, g: 0.3, belt: 1.15, nose: 1.0, tail: 1.2, roof: 2.1, cab: [-0.5, -0.5, 0.28, 0.4], wr: 0.36, max: 34, acc: 12, steer: 0.75, hp: 150, colors: ['#e5e7eb', '#7c8aa5', '#111827', '#b45309'] },
  luxury: { type: 'luxury', name: 'Majestic Limousine', l: 5.6, w: 1.98, g: 0.24, belt: 0.88, nose: 0.82, tail: 0.95, roof: 1.5, cab: [-0.36, -0.28, 0.1, 0.2], wr: 0.35, max: 48, acc: 17, steer: 0.8, hp: 130, extras: ['chrome'], colors: ['#0a0a0f', '#f5f0e6', '#2d0a1a', '#0f2a3a'] },
  delivery: { type: 'delivery', name: 'Parcel Box Truck', l: 6.2, w: 2.2, g: 0.4, belt: 1.25, nose: 1.15, tail: 1.1, roof: 2.4, cab: [0.18, 0.2, 0.36, 0.44], wr: 0.45, max: 30, acc: 10, steer: 0.65, hp: 200, extras: ['cargo2'], colors: ['#facc15', '#e5e7eb', '#38bdf8'] },
  taxi: { type: 'taxi', name: 'Metro Cab', l: 4.5, w: 1.8, g: 0.22, belt: 0.82, nose: 0.78, tail: 0.88, roof: 1.46, cab: [-0.32, -0.2, 0.08, 0.2], wr: 0.32, max: 42, acc: 16, steer: 0.9, hp: 110, extras: ['taxi'], colors: ['#fbbf24'] },
};
export const VTYPES = Object.keys(VSPECS);

export interface VParts { wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean }[]; door: THREE.Group | null; head: THREE.MeshStandardMaterial; tail: THREE.MeshStandardMaterial; brake: THREE.MeshStandardMaterial; h: number }
const geoCache = new Map<string, THREE.BufferGeometry>();
const cached = (k: string, f: () => THREE.BufferGeometry) => { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g; };
const matCache = new Map<string, THREE.MeshStandardMaterial>();
const pm = (c: string, m = 0.55, r = 0.3, e = '', ei = 0) => { const k = [c, m, r, e, ei].join(); let x = matCache.get(k); if (!x) { x = new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, emissive: e || '#000', emissiveIntensity: ei }); matCache.set(k, x); } return x; };

export function buildVehicle(type: string, color: string): { group: THREE.Group; parts: VParts } {
  const s = VSPECS[type]; const group = new THREE.Group(); const inner = new THREE.Group(); group.add(inner);
  const head = new THREE.MeshStandardMaterial({ color: '#fff4cc', emissive: '#fff0b0', emissiveIntensity: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: '#ff1a2a', emissive: '#ff0010', emissiveIntensity: 0.4 });
  const brake = tail;
  const paint = pm(color, 0.6, 0.25); const glass = pm('#0b1220', 0.9, 0.05); const dark = pm('#15161a', 0.2, 0.7); const chrome = pm('#d8dde6', 1, 0.15);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, p: THREE.Object3D = inner) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; p.add(me); return me; };
  const wheels: VParts['wheels'] = [];
  const wheelAt = (x: number, z: number, front: boolean, R: number, wd = 0.26) => {
    const pivot = new THREE.Group(); pivot.position.set(x, R, z); const spin = new THREE.Group(); pivot.add(spin); inner.add(pivot);
    add(cached(`tire${R}${wd}`, () => new THREE.CylinderGeometry(R, R, wd, 20).rotateZ(Math.PI / 2)), pm('#0c0c0e', 0.1, 0.9), 0, 0, 0, spin);
    add(cached(`rim${R}${wd}`, () => new THREE.CylinderGeometry(R * 0.64, R * 0.64, wd + 0.03, 5).rotateZ(Math.PI / 2)), chrome, 0, 0, 0, spin);
    add(cached(`hub${R}`, () => new THREE.CylinderGeometry(R * 0.2, R * 0.2, wd + 0.06, 8).rotateZ(Math.PI / 2)), dark, 0, 0, 0, spin);
    wheels.push({ pivot, spin, front });
  };
  let door: THREE.Group | null = null;

  if (s.bike) {
    const R = s.wr; wheelAt(0, 0.78, true, R, 0.16); wheelAt(0, -0.72, false, R, 0.2);
    add(cached('bkframe', () => new THREE.BoxGeometry(0.14, 0.18, 1.1)), dark, 0, 0.58, -0.05);
    add(cached('bktank', () => new THREE.SphereGeometry(0.3, 14, 10)), paint, 0, 0.82, 0.18).scale.set(0.55, 0.62, 1.15);
    add(cached('bkseat', () => new THREE.BoxGeometry(0.28, 0.1, 0.62)), pm('#101014', 0.1, 0.8), 0, 0.82, -0.42);
    add(cached('bktail', () => new THREE.BoxGeometry(0.22, 0.14, 0.4)), paint, 0, 0.88, -0.78).rotation.x = -0.25;
    add(cached('bkeng', () => new THREE.BoxGeometry(0.3, 0.3, 0.45)), pm('#555a66', 0.8, 0.4), 0, 0.42, 0.0);
    for (const sx of [-1, 1]) {
      const fk = add(cached('bkfork', () => new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6)), chrome, sx * 0.11, 0.62, 0.7); fk.rotation.x = 0.35;
      add(cached('bkpipe', () => new THREE.CylinderGeometry(0.04, 0.05, 0.7, 8).rotateX(Math.PI / 2)), chrome, sx * 0.17, 0.3, -0.5);
    }
    add(cached('bkbar', () => new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6).rotateZ(Math.PI / 2)), dark, 0, 1.0, 0.55);
    add(cached('bkfair', () => new THREE.SphereGeometry(0.22, 12, 8)), paint, 0, 0.95, 0.62).scale.set(0.9, 0.9, 0.7);
    add(cached('bklamp', () => new THREE.SphereGeometry(0.08, 8, 6)), head, 0, 0.98, 0.78);
    add(cached('bktl', () => new THREE.BoxGeometry(0.16, 0.05, 0.04)), tail, 0, 0.9, -1.0);
    return { group, parts: { wheels, door: null, head, tail, brake, h: 1.1 } };
  }

  const { l, w, g, belt, nose, tail: tl, roof, wr } = s; const [cr, r0, r1, cf] = s.cab;
  // body silhouette (x = forward, y = up)
  const body = cached(`body${type}`, () => {
    const sh = new THREE.Shape(); const f = (x: number) => x * l;
    sh.moveTo(-l / 2, g + 0.05); sh.lineTo(-l / 2, tl); sh.quadraticCurveTo(-l / 2, belt, -l / 2 + l * 0.08, belt); sh.lineTo(f(cf) - 0.05, belt);
    sh.quadraticCurveTo(l / 2 - l * 0.12, belt, l / 2, nose); sh.lineTo(l / 2, g + 0.1); sh.lineTo(l / 2 - 0.2, g); sh.lineTo(-l / 2 + 0.2, g); sh.closePath();
    const eg = new THREE.ExtrudeGeometry(sh, { depth: w - 0.2, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 3, curveSegments: 8 }); eg.translate(0, 0, -(w - 0.2) / 2); return eg;
  });
  const bm = new THREE.Mesh(body, paint); bm.rotation.y = -Math.PI / 2; bm.castShadow = true; inner.add(bm);
  if (s.extras?.includes('cargo')) { // truck
    add(cached('cargo', () => new THREE.BoxGeometry(w - 0.1, 2.2, l * 0.58)), pm('#d1d5db', 0.2, 0.6), 0, 0.8 + 1.1, -l * 0.17);
    add(cached('cargoframe', () => new THREE.BoxGeometry(w - 0.3, 0.2, l * 0.7)), dark, 0, 0.5, -l * 0.1);
  }
  if (s.extras?.includes('cargo2')) add(cached('cargo2', () => new THREE.BoxGeometry(w - 0.05, 1.9, l * 0.58)), paint, 0, 0.55 + 0.95 + 0.4, -l * 0.16);
  const cab = cached(`cab${type}`, () => {
    const sh = new THREE.Shape(); const f = (x: number) => x * l; const bt = belt - 0.04;
    sh.moveTo(f(cr), bt); sh.lineTo(f(r0), roof); sh.lineTo(f(r1), roof); sh.lineTo(f(cf), bt); sh.closePath();
    const d = (w - 0.3); const eg = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }); eg.translate(0, 0, -d / 2); return eg;
  });
  const cm = new THREE.Mesh(cab, glass); cm.rotation.y = -Math.PI / 2; cm.castShadow = true; inner.add(cm);
  // roof slab + pillars
  const rl = (r1 - r0) * l; add(cached(`roof${type}`, () => new THREE.BoxGeometry(w - 0.26, 0.07, rl + 0.15)), paint, 0, roof + 0.02, ((r0 + r1) / 2) * l);
  for (const sx of [-1, 1]) add(cached(`pil${type}`, () => new THREE.BoxGeometry(0.06, 0.05, (cf - cr) * l * 0.7)), paint, sx * (w / 2 - 0.19), belt + 0.03, ((cr + cf) / 2) * l);
  // lights, bumpers
  for (const sx of [-1, 1]) {
    add(cached('hl', () => new THREE.BoxGeometry(0.34, 0.1, 0.06)), head, sx * (w / 2 - 0.34), nose - 0.14, l / 2 + 0.07);
    add(cached('tl', () => new THREE.BoxGeometry(0.4, 0.1, 0.05)), tail, sx * (w / 2 - 0.34), tl - 0.1, -l / 2 - 0.07);
    add(cached('mir', () => new THREE.BoxGeometry(0.16, 0.1, 0.08)), paint, sx * (w / 2 + 0.05), belt + 0.08, l * cf - 0.25);
  }
  add(cached('bumpF', () => new THREE.BoxGeometry(w - 0.1, 0.18, 0.14)), dark, 0, g + 0.18, l / 2 + 0.05);
  add(cached('bumpR', () => new THREE.BoxGeometry(w - 0.1, 0.18, 0.14)), dark, 0, g + 0.18, -l / 2 - 0.05);
  add(cached('grill', () => new THREE.BoxGeometry(w * 0.5, 0.14, 0.05)), dark, 0, nose - 0.3 > g + 0.1 ? nose - 0.3 : g + 0.28, l / 2 + 0.08);
  add(cached('plate', () => new THREE.BoxGeometry(0.4, 0.12, 0.02)), pm('#f2f2f2', 0, 0.5), 0, tl - 0.35 > g ? tl - 0.35 : g + 0.3, -l / 2 - 0.15);
  // extras
  if (s.extras?.includes('spoiler')) { add(cached('spl', () => new THREE.BoxGeometry(w - 0.3, 0.05, 0.3)), dark, 0, tl + 0.2, -l / 2 + 0.2); for (const sx of [-1, 1]) add(cached('spls', () => new THREE.BoxGeometry(0.05, 0.2, 0.2)), dark, sx * 0.5, tl + 0.1, -l / 2 + 0.2); }
  if (s.extras?.includes('wing')) { add(cached('wing', () => new THREE.BoxGeometry(w + 0.1, 0.06, 0.55)), pm('#0a0a0c', 0.3, 0.4), 0, tl + 0.45, -l / 2 + 0.1); for (const sx of [-1, 1]) add(cached('wings', () => new THREE.BoxGeometry(0.06, 0.4, 0.3)), dark, sx * 0.55, tl + 0.2, -l / 2 + 0.15); }
  if (s.extras?.includes('intake')) for (const sx of [-1, 1]) add(cached('intk', () => new THREE.BoxGeometry(0.06, 0.2, 0.7)), dark, sx * (w / 2 + 0.02), belt - 0.18, -0.5);
  if (s.extras?.includes('rack')) for (const sx of [-1, 1]) add(cached('rack', () => new THREE.BoxGeometry(0.05, 0.05, (r1 - r0) * l + 0.4)), chrome, sx * 0.7, roof + 0.1, ((r0 + r1) / 2) * l);
  if (s.extras?.includes('chrome')) for (const sx of [-1, 1]) add(cached('chr', () => new THREE.BoxGeometry(0.02, 0.04, l * 0.8)), chrome, sx * (w / 2 + 0.1), belt - 0.15, 0);
  if (s.extras?.includes('taxi')) { add(cached('taxi', () => new THREE.BoxGeometry(0.6, 0.18, 0.25)), pm('#fff7c2', 0, 0.5, '#fff08a', 0.9), 0, roof + 0.16, ((r0 + r1) / 2) * l); add(cached('chk', () => new THREE.BoxGeometry(w + 0.02, 0.1, l * 0.5)), pm('#111', 0.1, 0.6), 0, belt - 0.25, 0); }
  // wheels
  const zf = l * 0.32 * (s.type === 'truck' ? 1.05 : 1), zr = -l * 0.31 * (s.type === 'truck' ? 0.95 : 1); const wx = w / 2 - 0.1;
  for (const sx of [-1, 1]) { wheelAt(sx * wx, zf, true, wr); wheelAt(sx * wx, zr, false, wr); if (s.type === 'truck') wheelAt(sx * wx, zr - 1.5, false, wr); }
  // driver door (left side +x)
  door = new THREE.Group(); door.position.set(w / 2 + 0.03, belt - 0.04, l * (cf - 0.04)); inner.add(door);
  const dl = (cf - cr) * l * 0.55; add(cached(`door${type}`, () => new THREE.BoxGeometry(0.05, belt - g - 0.1, dl)), paint, 0, -(belt - g - 0.1) / 2 + 0.05, -dl / 2, door);
  add(cached(`dwin${type}`, () => new THREE.BoxGeometry(0.052, roof - belt - 0.12, dl * 0.8)), glass, 0, (roof - belt) / 2 - 0.02, -dl / 2, door);
  return { group, parts: { wheels, door, head, tail, brake, h: roof } };
}
