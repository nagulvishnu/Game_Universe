import * as THREE from 'three';
import { BOSSES, FACTIONS, TERRITORIES, type RegionId, type TerritoryDef } from './data';
import { GB, GC, GK, GO, GS, GT, M, glowM, mk } from './models';
import { buildCapital } from './capital';
import { MAX_R, buildTerrain, regionWeights, sstep, terrainHeight, addCircle, addBox, regionAt } from './terrain';
import { Batch, W, addInteract, banner, brazier, label, regDestr, rng, sbox, scatter, scone, scyl, sdome } from './wlib';

const PI = Math.PI;
const THEME: Record<string, { wall: string; roof: string; accent: string }> = {
  bloodfire: { wall: '#2a1a18', roof: '#7a1a10', accent: '#ff6a1a' }, human: { wall: '#a8a8ac', roof: '#2a4a9a', accent: '#ffd24a' }, shadow: { wall: '#1a1a28', roof: '#3a1a5a', accent: '#a56bff' },
  ruins: { wall: '#8a7a5a', roof: '#5a4a30', accent: '#ffb84a' }, ocean: { wall: '#1a4a5a', roof: '#2a7a8a', accent: '#7affea' }, dragon: { wall: '#5a5048', roof: '#8a4a20', accent: '#ffcc33' },
  frozen: { wall: '#a8d0ee', roof: '#d8f0ff', accent: '#ffffff' }, celestial: { wall: '#f4f0e0', roof: '#ffd24a', accent: '#ffffff' }, capital: { wall: '#241c28', roof: '#b0102c', accent: '#ff6a2a' },
};

export function buildFortress(def: TerritoryDef, parent: THREE.Object3D = W.root) {
  const th = THEME[def.region] ?? THEME.capital; const y = terrainHeight(def.x, def.z); const g = new THREE.Group(); g.position.set(def.x, y, def.z); parent.add(g);
  const city = def.type === 'city', village = def.type === 'village', lair = def.type === 'lair' || def.type === 'ruin', base = def.type === 'base';
  const R = city ? 44 : village ? 0 : lair ? 18 : base ? 28 : def.id.startsWith('outpost') ? 12 : 26; const hh = city ? 12 : 9; const rnd = rng(def.x * 13 + def.z * 7);
  const wc = { col: true, metal: 0.3, rough: 0.7 };
  const wallP = (len: number, x: number, z: number, rot: number) => { const s = sbox(g, len, hh, 2.6, 0, 0, 0, th.wall, wc); void s; };
  void wallP;
  if (!village && !lair) {
    const sides: [number, number, number, number][] = [[0, -R, 0, 2 * R + 2.6], [-R, 0, PI / 2, 2 * R + 2.6], [R, 0, PI / 2, 2 * R + 2.6]];
    for (const [x, z, rot, len] of sides) { const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = rot; g.add(h); const gp = h.position; void gp; wallSeg(g, th, x, z, rot, len, hh); }
    wallSeg(g, th, -(R + 5) / 2 - 2.5, R, 0, R - 5, hh); wallSeg(g, th, (R + 5) / 2 + 2.5, R, 0, R - 5, hh);
    sbox(g, 11, 4, 3, 0, hh - 1, R, th.wall, { col: true }); scone(g, 1.4, 5, -5, hh + 3, R, th.accent, 5, { em: th.accent, ei: 0.5 }); scone(g, 1.4, 5, 5, hh + 3, R, th.accent, 5, { em: th.accent, ei: 0.5 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * R, z = sz * R; scyl(g, 3.6, 4.1, hh + 8, x, 0, z, th.wall, { col: true, seg: 10 }); scone(g, 5, 7, x, hh + 8, z, th.roof, 10, { em: def.faction === 'demon' ? th.accent : undefined, ei: 0.15 }); mk(g, GS(0.4, 6, 5), glowM(th.accent, 3), x, hh + 3, z + sz * 3.7); }
  }
  if (village) {
    const hb = new Batch(GB(1, 1, 1), M('#d8c8a0', { rough: 1, metal: 0 }), 20, g, true), hr = new Batch(GK(0.9, 1, 4), M('#7a3a20', { rough: 0.8 }), 20, g, true);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2, d = 14 + (i % 2) * 7; const x = Math.cos(a) * d, z = Math.sin(a) * d; const w = 6 + rnd() * 3, h = 4 + rnd() * 2; const i1 = hb.add(x, h / 2, z, a, w, h, w), i2 = hr.add(x, h + 1.6, z, a + PI / 4, w * 0.85, 3.4, w * 0.85); const wx = def.x + x, wz = def.z + z; regDestr('house', wx, y + h / 2, wz, w * 0.7, [[hb, i1], [hr, i2]], addBox(wx, wz, w / 2, w / 2, a, y + h + 3), '#d8c8a0'); }
    hb.finish(); hr.finish(); scyl(g, 1.2, 1.4, 1.2, 0, 0, 0, '#777', { col: true }); mk(g, GC(0.15, 0.15, 3, 5), M('#3a2a1a'), 0, 2.5, 0);
    const wm = new THREE.Group(); wm.position.set(24, 0, 10); g.add(wm); scyl(wm, 2.4, 3.2, 10, 0, 0, 0, '#d8c8a0', { col: true }); const bl = new THREE.Group(); bl.position.set(0, 9, 3); wm.add(bl); for (let i = 0; i < 4; i++) mk(bl, GB(0.6, 9, 0.1), M('#e8dcc0'), 0, 0, 0, undefined, [0, 0, (i * PI) / 2]).position.y = 0; W.anim.push((t) => { bl.rotation.z = t * 0.6; });
  } else if (lair) {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; const h = 6 + rnd() * 8; const c = scyl(g, 1.4, 1.8, h, Math.cos(a) * R, 0, Math.sin(a) * R, th.wall, { col: true, seg: 7 }); void c; if (def.type === 'ruin' && i % 2) scone(g, 1.6, 2, Math.cos(a) * R, h, Math.sin(a) * R, th.accent, 6); }
    mk(g, GT(R * 0.85, 0.3, 5, 48), glowM(th.accent, 1.8), 0, 0.4, 0, undefined, [PI / 2, 0, 0]);
    if (def.id === 'dragon_nest_peak') for (let i = 0; i < 6; i++) { const a = i * 1.1; mk(g, GS(1.6, 10, 8), M('#e8d8b0', { rough: 0.5, em: '#ff8a30', ei: 0.3 }), Math.cos(a) * 6, 1.4, Math.sin(a) * 6, undefined, undefined, [1, 1.35, 1]); }
    if (def.id === 'titans_rest') for (let i = 0; i < 7; i++) { const s = i < 4 ? -1 : 1; const r = scone(g, 2.2, 28, s * 6, 0, -12 + (i % 4) * 8, '#cfeaff', 6, { em: '#9ed8ff', ei: 0.3 }); r.rotation.z = -s * 0.4; }
    if (def.id === 'leviathan_reef') for (let i = 0; i < 10; i++) { const r = mk(g, GT(8 - i * 0.4, 0.5, 5, 24, PI), M('#d8d0b8'), 0, 0.5, -16 + i * 3.4, undefined, [0, PI / 2, 0]); r.castShadow = true; }
    if (def.id === 'forgotten_vault') { sbox(g, 5, 18, 5, -9, 0, -R + 2, '#5a4a30', wc); sbox(g, 5, 18, 5, 9, 0, -R + 2, '#5a4a30', wc); sbox(g, 24, 5, 5, 0, 18, -R + 2, '#5a4a30', wc); mk(g, GS(2, 10, 8), glowM('#ffb84a', 2.5), 0, 12, -R + 2); mk(g, new THREE.PlaneGeometry(12, 17), M('#ffb84a', { em: '#ffb84a', ei: 1.2, tr: 0.5, side: THREE.DoubleSide }), 0, 8.5, -R + 3);
      const l = new THREE.PointLight('#ffb84a', 1200, 60, 1.8); l.position.set(0, 10, -R + 6); g.add(l); W.pois.push({ id: 'forgotten_vault', x: def.x, z: def.z, r: 45 }); }
  } else {
    const kh = city ? 28 : 20, kw = city ? 22 : 13; sbox(g, kw, kh, kw, 0, 0, -R * 0.2, th.wall, wc); sbox(g, kw + 2, 1.4, kw + 2, 0, kh, -R * 0.2, th.roof, wc);
    const rf = scone(g, kw * 0.8, kw * 0.9, 0, kh + 1.4, -R * 0.2, th.roof, 4, { em: th.accent, ei: 0.12 }); rf.rotation.y = PI / 4;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) scyl(g, 2.4, 2.6, kh + 6, sx * kw * 0.5, 0, -R * 0.2 + sz * kw * 0.5, th.wall, { col: true }), scone(g, 3.2, 6, sx * kw * 0.5, kh + 6, -R * 0.2 + sz * kw * 0.5, th.roof, 8);
    if (def.region === 'celestial') { sdome(g, kw * 0.55, 0, kh + 1.4, -R * 0.2, '#ffd24a', '#ffcc33'); for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; scyl(g, 0.9, 1, 14, Math.cos(a) * (R * 0.7), 0, Math.sin(a) * (R * 0.7), '#ffffff', { col: true }); } mk(g, GT(R * 0.9, 0.5, 6, 48), glowM('#ffe8a0', 1.5), 0, 16, 0, undefined, [PI / 2, 0, 0]); }
    if (def.region === 'bloodfire' || def.region === 'shadow') for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; scone(g, 0.9, 7, Math.cos(a) * (R + 4), 0, Math.sin(a) * (R + 4), th.wall, 5); }
    if (def.region === 'frozen') for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; const c = scone(g, 1.8, 10 + (i % 3) * 5, Math.cos(a) * (R + 8), 0, Math.sin(a) * (R + 8), '#c8ecff', 5, { em: '#9ed8ff', ei: 0.5 }); c.rotation.z = 0.1; }
    if (def.region === 'ocean') { for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; sdome(g, 4, Math.cos(a) * (R + 10), 0, Math.sin(a) * (R + 10), '#0a4a6a', '#7affea'); scone(g, 1.4, 16, Math.cos(a) * (R + 10), 0, Math.sin(a) * (R + 10), '#2a9aaa', 6, { em: '#7affea', ei: 0.6 }); } }
    if (city) { const hb = new Batch(GB(1, 1, 1), M('#e0d8c8', { rough: 0.9, metal: 0 }), 70, g, true), hr = new Batch(GK(0.9, 1, 4), M('#ffffff', { rough: 0.7 }), 70, g, true); const rc = ['#2a4a9a', '#9a2a2a', '#2a7a4a', '#7a5a2a'];
      for (let i = 0; i < 60; i++) { const a = rnd() * PI * 2, d = 12 + rnd() * (R - 16); const x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(x) < 14 && Math.abs(z + R * 0.2) < 14) continue; if (Math.abs(x) < 4 && z > 0) continue; const w = 5 + rnd() * 3, h = 4 + rnd() * 6; const i1 = hb.add(x, h / 2, z, a, w, h, w), i2 = hr.add(x, h + 2, z, a + PI / 4, w * 0.85, 4.2, w * 0.85, rc[i % 4]); const wx = def.x + x, wz = def.z + z; regDestr('house', wx, y + h / 2, wz, w * 0.7, [[hb, i1], [hr, i2]], addBox(wx, wz, w / 2, w / 2, a, y + h + 3), '#e0d8c8'); } hb.finish(); hr.finish(); }
    if (base) { const tb = new Batch(GK(3.5, 4, 5), M('#c8b890', { rough: 1, side: THREE.DoubleSide }), 30, g, true); for (let i = 0; i < 16; i++) { const x = -R * 0.6 + (i % 4) * 8, z = -R * 0.5 + Math.floor(i / 4) * 8 + 4; tb.add(x, 2, z, i, 1, 1, 1); } tb.finish(); }
  }
  const owner = def.faction; const pole = new THREE.Group(); pole.position.set(0, 0, village ? 6 : lair ? 4 : R * 0.45); g.add(pole); scyl(pole, 0.2, 0.3, 30, 0, 0, 0, '#222', { col: true, seg: 6 });
  const fm = new THREE.MeshStandardMaterial({ color: FACTIONS[owner].color, emissive: FACTIONS[owner].color, emissiveIntensity: 0.4, side: THREE.DoubleSide, roughness: 0.8 }); const flag = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.5, 8, 2), fm); flag.position.set(4.6, 27, 0); pole.add(flag); mk(pole, GS(0.6, 8, 6), glowM('#ffd24a', 2), 0, 30.4, 0);
  W.banners[def.id] = { mat: fm, flag }; const fp = flag.geometry.attributes.position as THREE.BufferAttribute; const base0 = Float32Array.from(fp.array as Float32Array); W.anim.push((t) => { if (flag.position.distanceToSquared(camGlobal) > 160000) return; for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin(t * 3 + base0[i * 3] * 0.8) * (base0[i * 3] + 4.5) * 0.12); fp.needsUpdate = true; });
  const lb = label(def.name, FACTIONS[owner].color === '#e0153f' ? '#ff9aa8' : '#ffffff', 0.9); lb.position.set(0, 38, 0); g.add(lb);
  addInteract({ id: 'banner_' + def.id, kind: 'banner', data: def.id, x: def.x + pole.position.x, y: y + 1, z: def.z + pole.position.z, r: 9, label: `${def.name}` });
  return g;
}
function wallSeg(g: THREE.Group, th: { wall: string; accent: string }, x: number, z: number, rot: number, len: number, hh: number) {
  const m = mk(g, GB(len, hh, 2.6), M(th.wall, { metal: 0.3, rough: 0.7 }), x, hh / 2, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true;
  const gp = g.position; addBox(gp.x + x, gp.z + z, len / 2, 1.3, rot, gp.y + hh, gp.y - 1); for (let k = 0; k < len / 4; k++) { const mm = mk(g, GB(1.6, 1.2, 2.8), M(th.wall), x + Math.cos(rot) * (k * 4 - len / 2 + 2), hh + 0.6, z - Math.sin(rot) * (k * 4 - len / 2 + 2)); mm.rotation.y = rot; }
}
const camGlobal = new THREE.Vector3();

function regionProps() {
  const root = W.root;
  const B = (g: THREE.BufferGeometry, m: THREE.Material, n: number, sh = false) => { const b = new Batch(g, m, n, root, sh); W.batches.push(b); return b; };
  // ---- Shadow forest
  { const tr = B(GC(0.4, 0.75, 9, 6), M('#1c1418', { rough: 1 }), 420, true), c1 = B(GK(3.4, 7, 7), M('#10181e', { rough: 0.9, em: '#1a0a3a', ei: 0.5 }), 420, true), c2 = B(GK(2.4, 5, 7), M('#141a28', { rough: 0.9, em: '#2a1a5a', ei: 0.4 }), 420, true), mu = B(GS(0.7, 6, 5), glowM('#7a4aff', 1.8), 160);
    scatter('shadow', 400, (x, y, z, r) => { const s = 0.8 + r() * 1.2; const i1 = tr.add(x, y + 4.5 * s, z, r() * 6, s, s, s), i2 = c1.add(x, y + 10 * s, z, r() * 6, s, s, s), i3 = c2.add(x, y + 13 * s, z, r() * 6, s, s, s); regDestr('tree', x, y + 5, z, 2.6 * s, [[tr, i1], [c1, i2], [c2, i3]], addCircle(x, z, 0.7 * s, y + 10), '#1c1418'); }, 11);
    scatter('shadow', 150, (x, y, z, r) => { mu.add(x, y + 0.4, z, 0, 1 + r() * 1.8, 0.8 + r(), 1 + r() * 1.8); }, 12); [tr, c1, c2, mu].forEach((b) => b.finish()); }
  // ---- Frozen
  { const tr = B(GC(0.3, 0.45, 5, 5), M('#3a2a20'), 300, true), p1 = B(GK(3.2, 6, 7), M('#dfeaf5', { rough: 0.8 }), 300, true), p2 = B(GK(2.2, 5, 7), M('#e8f2ff', { rough: 0.8 }), 300, true), ic = B(GO(1), M('#a8e0ff', { em: '#6ac8ff', ei: 0.9, metal: 0.2, rough: 0.1, tr: 0.85 }), 120);
    scatter('frozen', 280, (x, y, z, r) => { if (y > 70) return; const s = 0.8 + r() * 1.0; const a = tr.add(x, y + 2.5 * s, z, 0, s, s, s), b = p1.add(x, y + 7 * s, z, 0, s, s, s), c = p2.add(x, y + 10.5 * s, z, 0, s, s, s); regDestr('tree', x, y + 4, z, 2.4 * s, [[tr, a], [p1, b], [p2, c]], addCircle(x, z, 0.6 * s, y + 8), '#dfeaf5'); }, 21);
    scatter('frozen', 120, (x, y, z, r) => { const s = 1 + r() * 3; const i = ic.add(x, y + s * 1.5, z, r() * 6, s * 0.7, s * 2.2, s * 0.7, undefined, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4); regDestr('ice', x, y + s, z, s * 1.2, [[ic, i]], addCircle(x, z, s * 0.6, y + s * 3), '#a8e0ff'); }, 22); [tr, p1, p2, ic].forEach((b) => b.finish()); }
  // ---- Human
  { const tr = B(GC(0.35, 0.5, 4, 6), M('#4a3220'), 420, true), cn = B(GS(2.6, 8, 6), M('#ffffff', { rough: 0.9, metal: 0 }), 420, true); const gc = ['#3a7a2a', '#4a8a30', '#2a6a28', '#5a9a3a', '#a8782a'];
    scatter('human', 400, (x, y, z, r) => { const s = 0.8 + r() * 0.9; const a = tr.add(x, y + 2 * s, z, 0, s, s, s), b = cn.add(x, y + 5.2 * s, z, 0, s, s * 1.1, s, gc[Math.floor(r() * 5)]); regDestr('tree', x, y + 3, z, 2.4 * s, [[tr, a], [cn, b]], addCircle(x, z, 0.6 * s, y + 6), '#3a7a2a'); }, 31, { rmin: 240 }); [tr, cn].forEach((b) => b.finish()); }
  // ---- Bloodfire
  { const tr = B(GC(0.25, 0.55, 7, 5), M('#1a1210'), 160, true), br = B(GK(0.2, 4, 4), M('#1a1210'), 320, true), rk = B(GS(1.6, 6, 5), M('#2a2020', { rough: 1 }), 160, true), em = B(GS(0.35, 5, 4), glowM('#ff6a1a', 2), 200);
    scatter('bloodfire', 140, (x, y, z, r) => { const s = 0.8 + r(); const a = tr.add(x, y + 3.5 * s, z, 0, s, s, s), b = br.add(x + 0.5, y + 6.5 * s, z, r() * 6, s, s, s, undefined, 0, 0.5); regDestr('tree', x, y + 3, z, 2 * s, [[tr, a], [br, b]], addCircle(x, z, 0.6 * s, y + 6), '#1a1210'); }, 41);
    scatter('bloodfire', 110, (x, y, z, r) => { const s = 1 + r() * 2.2; rk.add(x, y + s * 0.3, z, r() * 6, s, s * 0.7, s); addCircle(x, z, s * 1.1, y + s); }, 42); scatter('bloodfire', 150, (x, y, z, r) => { em.add(x, y + 0.3, z, 0, 1 + r(), 1, 1 + r()); }, 43); [tr, br, rk, em].forEach((b) => b.finish());
    for (const [x, z, s] of [[330, -190, 1], [520, 170, 1.3], [610, -80, 1.1]]) { const y = terrainHeight(x, z); if (y < -2) continue; const v = new THREE.Group(); v.position.set(x, y, z); root.add(v); mk(v, GK(70 * s, 95 * s, 12), M('#2a1a16', { rough: 1 }), 0, 47 * s, 0).castShadow = true; mk(v, GT(11 * s, 3 * s, 6, 20), glowM('#ff5a10', 2.6), 0, 92 * s, 0, undefined, [PI / 2, 0, 0]); const l = new THREE.PointLight('#ff5a10', 6000, 220, 1.8); l.position.set(0, 100 * s, 0); v.add(l); } }
  // ---- Ruins
  { const col = B(GC(1, 1.2, 8, 8), M('#9a8a6a', { rough: 0.95 }), 260, true), cap = B(GB(3, 0.8, 3), M('#a89878'), 260, true), gs = B(GB(1, 1.8, 0.35), M('#7a7a7a', { rough: 1 }), 220, true), ob = B(GK(1.2, 14, 4), M('#2a2420', { em: '#ffb84a', ei: 0.25, metal: 0.6 }), 40, true);
    scatter('ruins', 230, (x, y, z, r) => { const s = 0.6 + r() * 0.9; const h = 0.35 + r() * 0.65; const rx = (r() - 0.5) * 0.3, rz = (r() - 0.5) * 0.3; const a = col.add(x, y + 4 * s * h, z, r() * 6, s, s * h, s, undefined, rx, rz); const b = h > 0.8 ? cap.add(x, y + 8 * s * h, z, 0, s, s, s) : -1; regDestr('pillar', x, y + 3, z, 1.6 * s, b >= 0 ? [[col, a], [cap, b]] : [[col, a]], addCircle(x, z, 1.2 * s, y + 8 * s * h), '#9a8a6a'); }, 51);
    scatter('ruins', 200, (x, y, z, r) => { gs.add(x, y + 0.9, z, r() * 6, 1, 1, 1, undefined, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3); }, 52, { rmin: 380 }); scatter('ruins', 30, (x, y, z, r) => { ob.add(x, y + 7, z, r() * 6); addCircle(x, z, 1.4, y + 14); }, 53); [col, cap, gs, ob].forEach((b) => b.finish()); }
  // ---- Dragon mountains
  { const sp = B(GK(5, 26, 5), M('#6a645c', { rough: 1 }), 120, true), dt = B(GC(0.2, 0.4, 6, 5), M('#2a2018'), 120, true); scatter('dragon', 90, (x, y, z, r) => { const s = 0.7 + r() * 1.3; sp.add(x, y + 10 * s, z, r() * 6, s, s, s); addCircle(x, z, 2.2 * s, y + 20 * s); }, 61, { rmin: 240 }); scatter('dragon', 90, (x, y, z, r) => { if (y > 70) return; dt.add(x, y + 3, z, 0, 1, 1 + r(), 1); }, 62); sp.finish(); dt.finish(); }
  // ---- Celestial
  { const pl = B(GC(0.9, 1, 12, 10), M('#f4f0e0', { rough: 0.35, metal: 0.1 }), 200, true), pc = B(GB(3, 0.7, 3), M('#e8c24a', { metal: 0.8, rough: 0.3 }), 400, true);
    scatter('celestial', 100, (x, y, z, r) => { if (y < 80) return; const a = pl.add(x, y + 6, z, 0), b = pc.add(x, y + 12.2, z, 0), c = pc.add(x, y + 0.3, z, 0); regDestr('pillar', x, y + 6, z, 1.6, [[pl, a], [pc, b], [pc, c]], addCircle(x, z, 1.1, y + 12), '#f4f0e0'); }, 71, { rmin: 330 }); [pl, pc].forEach((b) => b.finish());
    for (let i = 0; i < 16; i++) { const a = -PI / 4 + (i / 16 - 0.5) * 1.4, d = 330 + (i % 5) * 70; const x = Math.cos(a) * d, z = Math.sin(a) * d; const isl = new THREE.Group(); isl.position.set(x, 170 + (i % 4) * 30, z); root.add(isl); mk(isl, GK(14, 20, 8), M('#8a8a96', { rough: 1 }), 0, -9, 0, undefined, [PI, 0, 0]); mk(isl, GC(14, 14, 2, 14), M('#9ac86a', { rough: 1 }), 0, 1, 0); if (i % 2) { scyl(isl, 1, 1, 8, 4, 2, 0, '#f4f0e0'); sdome(isl, 4, 0, 10, 0, '#ffd24a', '#ffcc33'); } mk(isl, GS(0.8, 6, 5), glowM('#fff3a0', 2), 0, 14, 0); const ph = i; W.anim.push((t) => { isl.position.y = 170 + (i % 4) * 30 + Math.sin(t * 0.4 + ph) * 2.5; }); } }
  // ---- Ocean
  { const co = B(GK(0.9, 3.2, 5), M('#ffffff', { rough: 0.7, em: '#331122', ei: 0.4 }), 520), br = B(GS(1, 7, 5), M('#ffffff', { rough: 0.8 }), 160), ke = B(GC(0.12, 0.22, 10, 4), M('#2a7a4a', { em: '#0a3a1a', ei: 0.4 }), 160); const cc = ['#ff6aa0', '#ff9a4a', '#b04aff', '#4affc8', '#ff4a4a'];
    scatter('ocean', 520, (x, y, z, r) => { const s = 0.7 + r() * 1.6; co.add(x, y + 1.5 * s, z, r() * 6, s, s, s, cc[Math.floor(r() * 5)]); }, 81, { rmin: 200 }); scatter('ocean', 150, (x, y, z, r) => { const s = 1 + r() * 2; br.add(x, y + 0.6 * s, z, 0, s, s * 0.6, s, cc[Math.floor(r() * 5)]); }, 82); scatter('ocean', 150, (x, y, z, r) => { ke.add(x, y + 5, z, 0, 1, 0.6 + r() * 0.8, 1); }, 83); [co, br, ke].forEach((b) => b.finish());
    const fish = B(GS(0.35, 6, 5), M('#ffcc66', { em: '#ff8a00', ei: 0.3 }), 160); const cen: [number, number][] = [[-300, -150], [-380, 120], [-450, 0], [-520, 200], [-480, -250], [-600, 60], [-350, 300], [-250, 0]]; for (let i = 0; i < 160; i++) fish.add(0, 0, 0, 0, 1, 1, 2.4); fish.mesh.frustumCulled = false; const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 2.4);
    W.anim.push((t, _d, cam) => { if (cam.x > -120) return; for (let i = 0; i < 160; i++) { const c = cen[i % 8], a = t * (0.25 + (i % 5) * 0.04) + i, rr = 10 + (i % 9) * 3; const x = c[0] + Math.cos(a) * rr, z = c[1] + Math.sin(a) * rr; const y = terrainHeight(c[0], c[1]) + 8 + Math.sin(t * 0.7 + i) * 3 + (i % 4) * 3; e.set(0, -a, 0); q.setFromEuler(e); tmp.compose(p.set(x, y, z), q, s); fish.mesh.setMatrixAt(i, tmp); } fish.mesh.instanceMatrix.needsUpdate = true; }); }
}

function bossLairs() {
  for (const b of BOSSES) {
    const y = terrainHeight(b.pos[0], b.pos[1]); const g = new THREE.Group(); g.position.set(b.pos[0], y, b.pos[1]); W.root.add(g); const n = 8, R = 38;
    for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; scyl(g, 2, 2.4, 14 + (i % 3) * 3, Math.cos(a) * R, 0, Math.sin(a) * R, '#2a2630', { col: true, seg: 7 }); mk(g, GS(0.8, 6, 5), glowM(b.color, 3), Math.cos(a) * R, 17 + (i % 3) * 3, Math.sin(a) * R); }
    mk(g, GT(R * 0.8, 0.35, 5, 48), glowM(b.color, 1.8), 0, 0.5, 0, undefined, [PI / 2, 0, 0]); mk(g, GT(R * 0.5, 0.25, 5, 40), glowM(b.color, 1.4), 0, 0.5, 0, undefined, [PI / 2, 0, 0]);
    if (b.id === 'dimensional_destroyer') { const v = mk(g, new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: '#ff4fd0', transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 0, 18, 0); W.anim.push((t) => { v.rotation.z = t * 0.8; v.scale.setScalar(1 + Math.sin(t * 2) * 0.05); }); }
    W.pois.push({ id: 'lair_' + b.id, x: b.pos[0], z: b.pos[1], r: 60 });
  }
}

export function chestSpots(): { id: string; x: number; z: number }[] {
  const out: { id: string; x: number; z: number }[] = []; const r = rng(999); const regs: RegionId[] = ['bloodfire', 'shadow', 'frozen', 'dragon', 'human', 'celestial', 'ruins', 'ocean'];
  regs.forEach((reg, ri) => { for (let k = 0; k < 2; k++) scatter(reg, 1, (x, _y, z) => { out.push({ id: `chest_${ri}_${k}`, x, z }); }, 300 + ri * 7 + k + Math.floor(r() * 3)); });
  return out;
}
export const chestMeshes: Record<string, THREE.Group> = {};
function chests() {
  for (const c of chestSpots()) {
    const y = terrainHeight(c.x, c.z); const g = new THREE.Group(); g.position.set(c.x, y, c.z); W.root.add(g); sbox(g, 2.4, 1.4, 1.6, 0, 0, 0, '#4a2a10', { metal: 0.5 }); sbox(g, 2.5, 0.6, 1.7, 0, 1.4, 0, '#c8a040', { metal: 0.9, em: '#ffa010', ei: 0.5 }); mk(g, GS(0.4, 8, 6), glowM('#ffd24a', 3), 0, 3, 0); const l = new THREE.PointLight('#ffcc44', 120, 14, 2); l.position.set(0, 2, 0); g.add(l); chestMeshes[c.id] = g;
    addInteract({ id: c.id, kind: 'chest', x: c.x, y: y + 1, z: c.z, r: 5, label: 'Open Treasure Chest' });
  }
}

// ---------- atmosphere ----------
const ATMOS: Record<RegionId, { tint: string; mix: number; fog: string; d: number }> = {
  capital: { tint: '#a02040', mix: 0.38, fog: '#3a1a2a', d: 0.0014 }, bloodfire: { tint: '#ff4a10', mix: 0.55, fog: '#4a1a10', d: 0.0024 }, shadow: { tint: '#4a2a8a', mix: 0.55, fog: '#16161f', d: 0.0042 }, frozen: { tint: '#bfe6ff', mix: 0.5, fog: '#c8e0f0', d: 0.003 },
  dragon: { tint: '#8a8a9a', mix: 0.3, fog: '#8a96a8', d: 0.0016 }, ocean: { tint: '#3a8aa0', mix: 0.3, fog: '#5a90a8', d: 0.002 }, human: { tint: '#7aa0d0', mix: 0.1, fog: '#a8c0d8', d: 0.0011 }, celestial: { tint: '#ffeab0', mix: 0.4, fog: '#f4ecd8', d: 0.0012 }, ruins: { tint: '#c8a060', mix: 0.35, fog: '#b89868', d: 0.0018 },
};
const IDS: RegionId[] = ['bloodfire', 'human', 'shadow', 'ruins', 'ocean', 'dragon', 'frozen', 'celestial', 'capital'];
export class Atmos {
  sun = new THREE.DirectionalLight('#fff0d8', 3); moon = new THREE.DirectionalLight('#8aa0ff', 0.3); hemi = new THREE.HemisphereLight('#a8b8e0', '#2a1a20', 0.8); sky: THREE.Mesh; skyMat: THREE.ShaderMaterial; fog = new THREE.FogExp2('#8a8a9a', 0.002);
  flash = 0; dayK = 1; sunH = 1; cur = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), d: 0.002 }; private tmpA = new THREE.Color(); private tmpB = new THREE.Color(); private tmpC = new THREE.Color(); w = new Float32Array(9); mainRegion: RegionId = 'capital';
  constructor(public scene: THREE.Scene, shadows: boolean) {
    this.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#ffddaa') }, night: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){ vec3 d = normalize(vDir); float y = max(d.y,0.0); vec3 col = mix(hor, top, pow(y,0.5));
        float sd = max(dot(d,sunDir),0.0); col += sunCol*(pow(sd,900.0)*4.0 + pow(sd,10.0)*0.3);
        float md = max(dot(d,-sunDir),0.0); col += vec3(0.7,0.8,1.0)*pow(md,1200.0)*3.0*night;
        if(night>0.01 && d.y>0.0){ vec3 q = floor(d*260.0); float s = step(0.9968,h(q)); col += vec3(s)*night*(0.5+0.5*h(q+1.0)); }
        if(d.y<0.0) col = mix(hor, hor*0.35, min(1.0,-d.y*3.0));
        gl_FragColor = vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), this.skyMat); this.sky.frustumCulled = false; this.sky.renderOrder = -10; scene.add(this.sky);
    scene.fog = this.fog; scene.add(this.sun, this.sun.target, this.moon, this.hemi);
    this.sun.castShadow = shadows; this.sun.shadow.mapSize.set(2048, 2048); const c = this.sun.shadow.camera; c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 1; c.far = 400; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
  }
  update(dt: number, tod: number, player: THREE.Vector3, camPos: THREE.Vector3, underwater: boolean) {
    const a = (tod - 0.25) * PI * 2; const s = Math.sin(a); this.sunH = s; const sd = new THREE.Vector3(Math.cos(a) * 0.8, s, 0.45).normalize();
    this.dayK = sstep(-0.05, 0.3, s); const dusk = sstep(-0.2, 0.02, s) * (1 - sstep(0.02, 0.3, s));
    regionWeights(player.x, player.z, this.w); let best = 8; for (let i = 0; i < 8; i++) if (this.w[i] > this.w[best]) best = i; this.mainRegion = IDS[best];
    this.tmpA.set('#04061a'); this.tmpB.set('#101830'); const top = this.tmpA, hor = this.tmpB;
    const dayTop = this.tmpC.set('#3a78d8'); top.lerp(this.tmpC.set('#2a2a6a'), sstep(-0.2, 0.0, s)); top.lerp(dayTop.set('#3a78d8'), this.dayK); hor.lerp(this.tmpC.set('#ff8a50'), dusk * 0.9 + sstep(-0.2, 0.0, s) * 0.2); hor.lerp(this.tmpC.set('#b0cdf0'), this.dayK);
    const tint = new THREE.Color(0, 0, 0), fogc = new THREE.Color(0, 0, 0); let mix = 0, dens = 0;
    for (let i = 0; i < 9; i++) { const wgt = this.w[i]; if (wgt < 0.005) continue; const at = ATMOS[IDS[i]]; tint.add(this.tmpC.set(at.tint).multiplyScalar(wgt)); fogc.add(new THREE.Color(at.fog).multiplyScalar(wgt)); mix += at.mix * wgt; dens += at.d * wgt; }
    const lum = 0.05 + 0.95 * this.dayK + dusk * 0.3; top.lerp(tint, mix * 0.6).multiplyScalar(0.8 + 0.2 * this.dayK); hor.lerp(tint, mix);
    fogc.multiplyScalar(lum); fogc.lerp(hor, 0.25 * this.dayK);
    if (underwater) { fogc.set('#06405a').multiplyScalar(0.25 + 0.75 * this.dayK); dens = 0.022; top.set('#06405a'); hor.set('#0a5a7a'); }
    const k = 1 - Math.exp(-dt * 2.5); this.cur.top.lerp(top, k); this.cur.hor.lerp(hor, k); this.cur.fog.lerp(fogc, k); this.cur.d += (dens - this.cur.d) * k;
    this.skyMat.uniforms.top.value.copy(this.cur.top); this.skyMat.uniforms.hor.value.copy(this.cur.hor); this.skyMat.uniforms.sunDir.value.copy(sd); this.skyMat.uniforms.night.value = 1 - this.dayK; (this.skyMat.uniforms.sunCol.value as THREE.Color).set(dusk > 0.3 ? '#ff7a30' : '#ffe8c0');
    this.fog.color.copy(this.cur.fog); this.fog.density = this.cur.d; this.sky.position.copy(camPos);
    this.flash = Math.max(0, this.flash - dt * 3);
    const dayI = 3.4 * this.dayK + 1.4 * dusk; this.sun.intensity = Math.max(0, dayI) * (0.7 + 0.3 * (1 - mix)); this.sun.color.set(dusk > 0.3 ? '#ff9a5a' : '#fff0dc');
    this.sun.position.copy(player).addScaledVector(sd, 160); this.sun.target.position.copy(player); this.sun.target.updateMatrixWorld();
    this.moon.intensity = 0.45 * (1 - this.dayK); this.moon.position.copy(player).addScaledVector(sd, -160);
    this.hemi.intensity = 0.55 + 0.5 * this.dayK + this.flash * 4; this.hemi.color.copy(this.cur.hor).lerp(new THREE.Color('#ffffff'), 0.35); this.hemi.groundColor.set('#3a2a30').lerp(this.cur.fog, 0.4);
  }
}

// ---------- weather ----------
const WTYPES: Record<string, { v: number; sz: number; c: string; o: number; dx: number; up?: boolean }> = {
  none: { v: 0, sz: 0.3, c: '#ffffff', o: 0, dx: 0 }, ash: { v: 3, sz: 0.5, c: '#d8a080', o: 0.8, dx: 5 }, ember: { v: -3, sz: 0.35, c: '#ff8a3a', o: 0.9, dx: 1 }, snow: { v: 5, sz: 0.55, c: '#ffffff', o: 0.95, dx: 3 }, rain: { v: 55, sz: 0.28, c: '#a8c0e0', o: 0.7, dx: 4 },
  mist: { v: 0.5, sz: 2.4, c: '#8a7ac0', o: 0.18, dx: 1 }, dust: { v: 0.5, sz: 0.5, c: '#d8b878', o: 0.5, dx: 9 }, wind: { v: 1, sz: 0.4, c: '#d0d8e0', o: 0.35, dx: 14 }, holy: { v: -1.5, sz: 0.5, c: '#fff0a0', o: 0.9, dx: 0 }, bubbles: { v: -2.5, sz: 0.35, c: '#bff0ff', o: 0.8, dx: 0 },
};
export class Weather {
  N = 2200; pts: THREE.Points; pos = new Float32Array(2200 * 3); cur = { v: 0, sz: 0.3, o: 0, dx: 0, c: new THREE.Color('#fff') }; kind = 'none'; mat: THREE.PointsMaterial;
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < this.N; i++) { this.pos[i * 3] = (Math.random() - 0.5) * 140; this.pos[i * 3 + 1] = Math.random() * 70 - 20; this.pos[i * 3 + 2] = (Math.random() - 0.5) * 140; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d')!; const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    this.mat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cv), size: 0.3, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending, sizeAttenuation: true, fog: false }); this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts);
  }
  update(dt: number, cam: THREE.Vector3, kind: string) {
    const t = WTYPES[kind] ?? WTYPES.none; const k = 1 - Math.exp(-dt * 1.5); this.cur.v += (t.v - this.cur.v) * k; this.cur.sz += (t.sz - this.cur.sz) * k; this.cur.o += (t.o - this.cur.o) * k; this.cur.dx += (t.dx - this.cur.dx) * k; this.cur.c.lerp(new THREE.Color(t.c), k);
    this.mat.opacity = this.cur.o; this.mat.size = this.cur.sz; this.mat.color.copy(this.cur.c); this.pts.position.set(cam.x, cam.y, cam.z); if (this.cur.o < 0.02) return;
    for (let i = 0; i < this.N; i++) { const j = i * 3; this.pos[j + 1] -= this.cur.v * dt * (0.7 + (i % 7) * 0.06); this.pos[j] += (this.cur.dx * 0.3 + Math.sin(i + performance.now() * 0.001) * 0.5) * dt; if (this.pos[j + 1] < -25) this.pos[j + 1] = 50; else if (this.pos[j + 1] > 50) this.pos[j + 1] = -25; if (this.pos[j] > 70) this.pos[j] = -70; else if (this.pos[j] < -70) this.pos[j] = 70; }
    (this.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

export let waterMat: THREE.MeshStandardMaterial; export let lavaMat: THREE.MeshStandardMaterial; let cloudMesh: THREE.InstancedMesh | null = null;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
export async function buildWorld(scene: THREE.Scene, progress: (p: number, m: string) => void) {
  scene.add(W.root); progress(0.05, 'Carving the terrain…'); await tick(); const terr = buildTerrain(); W.root.add(terr);
  progress(0.3, 'Flooding the Cursed Ocean…'); await tick();
  const rip = document.createElement('canvas'); rip.width = rip.height = 128; const rc = rip.getContext('2d')!; rc.fillStyle = '#9ac'; rc.fillRect(0, 0, 128, 128); for (let i = 0; i < 90; i++) { rc.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; rc.beginPath(); rc.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 8, 0, 7); rc.fill(); }
  const rt = new THREE.CanvasTexture(rip); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(40, 90);
  waterMat = new THREE.MeshStandardMaterial({ color: '#0a6a8a', map: rt, transparent: true, opacity: 0.74, roughness: 0.08, metalness: 0.4, emissive: '#04364a', emissiveIntensity: 0.5 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(620, 1500), waterMat); water.rotation.x = -PI / 2; water.position.set(-390, 0, 0); water.renderOrder = 2; W.root.add(water);
  const lv = document.createElement('canvas'); lv.width = lv.height = 128; const lc = lv.getContext('2d')!; lc.fillStyle = '#ff6a10'; lc.fillRect(0, 0, 128, 128); for (let i = 0; i < 70; i++) { lc.fillStyle = Math.random() > 0.5 ? 'rgba(255,220,60,0.5)' : 'rgba(120,20,0,0.5)'; lc.beginPath(); lc.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 12, 0, 7); lc.fill(); }
  const lt = new THREE.CanvasTexture(lv); lt.wrapS = lt.wrapT = THREE.RepeatWrapping; lt.repeat.set(30, 30); lavaMat = new THREE.MeshStandardMaterial({ color: '#ff6a10', map: lt, emissive: '#ff4a00', emissiveMap: lt, emissiveIntensity: 1.6, roughness: 0.6 });
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(560, 700), lavaMat); lava.rotation.x = -PI / 2; lava.position.set(420, -1.8, 0); W.root.add(lava);
  W.anim.push((t) => { rt.offset.set(t * 0.01, t * 0.02); lt.offset.set(t * 0.004, t * 0.01); water.position.y = Math.sin(t * 0.8) * 0.12; });
  progress(0.4, 'Raising the Demon Capital…'); await tick(); buildCapital(W.root);
  progress(0.6, 'Planting forests and raising ruins…'); await tick(); regionProps();
  progress(0.75, 'Building fortresses and cities…'); await tick(); for (const t of TERRITORIES) if (t.id !== 'capital') buildFortress(t);
  progress(0.88, 'Summoning ancient lairs…'); await tick(); bossLairs(); chests();
  const cl = new THREE.InstancedMesh(GS(1, 8, 6), M('#ffffff', { rough: 1, metal: 0, tr: 0.55, em: '#c8c8d8', ei: 0.9 }), 40); const r = rng(5); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < 40; i++) { const a = r() * PI * 2, d = 100 + r() * 600; const sz = 25 + r() * 40; m4.compose(p.set(Math.cos(a) * d, 150 + r() * 80, Math.sin(a) * d), q, s.set(sz, sz * 0.22, sz * 0.7)); cl.setMatrixAt(i, m4); } cl.frustumCulled = false; W.root.add(cl); cloudMesh = cl;
  W.anim.push((_t, dt) => { if (cloudMesh) cloudMesh.rotation.y += dt * 0.004; });
  progress(1, 'The Demon Realm awakens…'); await tick();
  void MAX_R; void regionAt; void brazier; void banner;
}
export function updateWorld(t: number, dt: number, cam: THREE.Vector3) { camGlobal.copy(cam); for (let i = 0; i < W.anim.length; i++) W.anim[i](t, dt, cam); }
export function updateBanners(owner: (tid: string) => string) { for (const id in W.banners) { const c = FACTIONS[owner(id) as keyof typeof FACTIONS]?.color; if (c) { W.banners[id].mat.color.set(c); W.banners[id].mat.emissive.set(c); } } }
export function destroyAt(x: number, y: number, z: number, r: number, cb: (d: (typeof W.destr)[number]) => void): number {
  let n = 0; const r2 = r * r;
  for (let i = 0; i < W.destr.length; i++) { const d = W.destr[i]; if (!d.alive) continue; const dx = d.x - x, dz = d.z - z; if (dx * dx + dz * dz > (r + d.r) * (r + d.r) || Math.abs(d.y - y) > r + 12) continue; void r2;
    d.alive = false; for (const [b, idx] of d.refs) b.kill(idx); if (d.col) d.col.dead = true; n++; cb(d); }
  return n;
}
