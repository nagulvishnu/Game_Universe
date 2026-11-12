import * as THREE from 'three';
import { GENERALS, COMMANDERS } from './data';
import { GB, GC, GK, GS, GT, M, glowM, mk } from './models';
import { terrainHeight, addCircle, DUNGEON } from './terrain';
import { Batch, W, addInteract, banner, brazier, label, regDestr, rng, sbox, scone, scyl, sdome } from './wlib';

const OB = '#1c1620', CR = '#b0102c', GOLD = '#c8a040', MAR = '#241e2a';
export const npcSpots: { x: number; z: number; kind: string }[] = [];
export const dungeonSpawns: { x: number; z: number }[] = [];
export const trainingCenter = { x: 88, z: 66 };
const occ: { x: number; z: number; r: number }[] = [];
const free = (x: number, z: number, pad = 0) => !(Math.abs(x) < 58 + pad && Math.abs(z) < 66 + pad) && occ.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + pad) && Math.hypot(x, z) < 138;
const yawTo = (x: number, z: number) => Math.atan2(-x, -z);

function hall(parent: THREE.Group) {
  const g = new THREE.Group(); parent.add(g); const H = 34;
  const wo = { col: true, metal: 0.4, rough: 0.5 };
  sbox(g, 72, H, 3, 0, 0, -45, OB, wo); sbox(g, 3, H, 90, -36, 0, 0, OB, wo); sbox(g, 3, H, 90, 36, 0, 0, OB, wo);
  sbox(g, 28, H, 3, -22, 0, 45, OB, wo); sbox(g, 28, H, 3, 22, 0, 45, OB, wo); sbox(g, 16, 12, 3, 0, 22, 45, OB, wo);
  sbox(g, 2.4, 22, 2.4, -8.8, 0, 46.5, CR, { col: true, metal: 0.6 }); sbox(g, 2.4, 22, 2.4, 8.8, 0, 46.5, CR, { col: true, metal: 0.6 }); sbox(g, 21, 2, 3, 0, 22, 47, GOLD, { metal: 0.9 });
  sbox(g, 78, 2, 96, 0, H, 0, '#120c16', { col: true }); sbox(g, 62, 6, 78, 0, H + 2, 0, OB, { col: true }); sbox(g, 46, 8, 60, 0, H + 8, 0, '#241a2a', { col: true }); sbox(g, 30, 10, 42, 0, H + 16, 0, OB, { col: true });
  scone(g, 9, 54, 0, H + 26, 0, CR, 6, { em: CR, ei: 0.35 }); mk(g, GS(2.2, 10, 8), glowM('#ff2d55', 3), 0, H + 28, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 42, z = sz * 50; scyl(g, 6, 7, 64, x, 0, z, OB, { col: true, seg: 12 }); scyl(g, 7.5, 7.5, 2, x, 30, z, GOLD, { metal: 0.9 }); scone(g, 8.5, 22, x, 64, z, CR, 12, { em: CR, ei: 0.3 });
    for (let k = 0; k < 4; k++) sbox(g, 2, 7, 0.4, x + sx * 0, 12 + k * 12, z + sz * 6.1, '#ff6a2a', { em: '#ff6a2a', ei: 1.5 });
    mk(g, GS(1.3, 8, 6), glowM('#ff2d55', 3), x, 87, z);
  }
  for (let i = 0; i < 10; i++) scone(g, 1.2, 6, -34 + i * 7.5, H + 2, 49, '#0e0a12', 4);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { sbox(g, 0.6, 12, 3, s * 34.4, 10, -30 + i * 15, '#ff3a5a', { em: '#ff2a4a', ei: 1.6 }); sbox(g, 0.6, 12, 3, s * 37.6, 10, -30 + i * 15, '#ff3a5a', { em: '#ff2a4a', ei: 1.2 }); banner(g, s * 34, 31, -22 + i * 15, 4, 14, i % 2 ? '#7a0a22' : '#2a0a3a', s * Math.PI / 2 * 0 + (s > 0 ? -Math.PI / 2 : Math.PI / 2)); }
  const fl = mk(g, new THREE.PlaneGeometry(70, 88), M('#15101a', { metal: 0.7, rough: 0.18 }), 0, 0.04, 0, undefined, [-Math.PI / 2, 0, 0]); fl.receiveShadow = true;
  mk(g, new THREE.PlaneGeometry(9, 86), M('#8a0a22', { rough: 0.9, metal: 0 }), 0, 0.07, 0, undefined, [-Math.PI / 2, 0, 0]).receiveShadow = true;
  mk(g, new THREE.PlaneGeometry(10.6, 86), M(GOLD, { metal: 0.9, rough: 0.4 }), 0, 0.05, 0, undefined, [-Math.PI / 2, 0, 0]);
  for (const z of [-30, -15, 0, 15, 30]) for (const s of [-1, 1]) { const x = s * 18; scyl(g, 1.5, 1.7, 31, x, 0, z, '#2a222e', { col: true, seg: 12 }); sbox(g, 4.2, 1, 4.2, x, 0, z, GOLD, { metal: 0.9 }); sbox(g, 4.2, 1.4, 4.2, x, 30.6, z, GOLD, { metal: 0.9 }); mk(g, GS(0.5, 6, 5), glowM('#ff2d55', 2), x, 33, z); }
  sbox(g, 26, 1.2, 16, 0, 0, -35, MAR, { col: true, metal: 0.6, rough: 0.3 }); sbox(g, 20, 2.4, 12, 0, 0, -37, '#2a2230', { col: true, metal: 0.6 }); sbox(g, 14, 3.6, 8, 0, 0, -39, '#322838', { col: true, metal: 0.6 });
  sbox(g, 4.4, 1.2, 3.4, 0, 3.6, -39, '#120c14', { metal: 0.8 }); sbox(g, 5.4, 14, 1.4, 0, 3.6, -41.2, '#120c14', { metal: 0.8 }); sbox(g, 0.9, 2.4, 3.2, -2.5, 4.8, -39, '#120c14'); sbox(g, 0.9, 2.4, 3.2, 2.5, 4.8, -39, '#120c14');
  for (const s of [-1, 1]) { const h = scone(g, 0.5, 6, s * 2.4, 16, -41.2, '#120c14', 5); h.rotation.z = -s * 0.25; mk(g, GS(0.7, 8, 6), glowM('#ff2d55', 3), s * 2.4, 9, -40.5); }
  const sig = new THREE.Group(); sig.position.set(0, 22, -43.2); g.add(sig); mk(sig, GT(9, 0.35, 6, 40), glowM('#ff2040', 2.4)); mk(sig, GT(6.5, 0.2, 6, 40), glowM('#ff6a2a', 1.8));
  for (let i = 0; i < 5; i++) mk(sig, GB(0.3, 17, 0.3), glowM('#ff2040', 2), 0, 0, 0, undefined, [0, 0, (i / 5) * Math.PI]); W.anim.push((t) => { sig.rotation.z = t * 0.15; });
  for (const z of [-24, -4, 16, 36]) for (const s of [-1, 1]) brazier(g, s * 6.5, 0.1, z, '#ff6a2a', 1);
  [[0, 22, 20], [0, 22, -15], [-26, 16, 0], [26, 16, 0], [0, 12, 38]].forEach(([x, y, z]) => { const l = new THREE.PointLight('#ff6a3a', 1100, 80, 1.6); l.position.set(x, y, z); parent.add(l); });
  // command table
  const tb = new THREE.Group(); tb.position.set(0, 0, -8); g.add(tb); scyl(tb, 2.2, 3.2, 1.4, 0, 0, 0, '#1a1420', { col: true, seg: 16 }); scyl(tb, 5.8, 5.8, 0.5, 0, 1.3, 0, '#2a2030', { col: true, seg: 24, metal: 0.8 });
  scyl(tb, 5.2, 5.2, 0.12, 0, 1.8, 0, '#1a4aff', { seg: 24, em: '#2a6aff', ei: 1.2 });
  const holo = new THREE.Group(); holo.position.y = 3; tb.add(holo); for (let i = 0; i < 9; i++) { const a = i * 0.9; mk(holo, GK(0.5 + (i % 3) * 0.3, 1.2 + (i % 4) * 0.4, 5), M('#7ab0ff', { em: '#4a8aff', ei: 1.4, tr: 0.7 }), Math.cos(a) * (0.6 + i * 0.4), 0, Math.sin(a) * (0.6 + i * 0.4)); }
  mk(holo, GT(4.6, 0.07, 6, 40), glowM('#7ab0ff', 2), 0, -0.6, 0, undefined, [Math.PI / 2, 0, 0]); mk(holo, GS(0.3, 8, 6), glowM('#ff2d55', 3), 0, 1.8, 0); W.anim.push((t) => { holo.rotation.y = t * 0.4; holo.position.y = 3 + Math.sin(t * 1.5) * 0.15; });
  const tl = new THREE.PointLight('#4a8aff', 300, 25, 2); tl.position.set(0, 4, -8); parent.add(tl);
  addInteract({ id: 'table', kind: 'table', x: 0, y: 1, z: -2.4, r: 7, label: 'Royal Command Table — open the Command Interface' });
  addInteract({ id: 'throne', kind: 'throne', x: 0, y: 4, z: -31, r: 6, label: 'Sit upon the Demon Throne' });
  addInteract({ id: 'council', kind: 'council', x: -13, y: 1, z: -10, r: 5, label: 'Convene / Dismiss the Royal Council' });
  addInteract({ id: 'dungeon_down', kind: 'dungeon_down', x: -27, y: 1, z: 38, r: 5, label: 'Descend to the Royal Dungeons & Treasury' });
  sbox(g, 8, 0.6, 6, -27, 0, 40, '#0a0a10', { metal: 0.5 }); mk(g, GT(3, 0.2, 6, 24), glowM('#8a4bff', 2.4), -27, 3.2, 38, undefined, [0, 0, 0]); mk(g, GS(0.9, 8, 6), glowM('#8a4bff', 3), -27, 3.2, 38);
  const council = GENERALS.length; for (let i = 0; i < council; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / council); const x = Math.cos(a) * 15, z = -8 + Math.sin(a) * 15; W.council.push({ x, z, yaw: Math.atan2(-x, -(z + 8)) }); }
  W.cmdPos = { x: 0, z: -8 }; W.throne.set(0, 4.8, -38.8);
  npcSpots.push({ x: -26, z: 20, kind: 'citizen' }, { x: 26, z: 25, kind: 'guard' }, { x: -10, z: 41, kind: 'guard' }, { x: 10, z: 41, kind: 'guard' });
}

function generalHQ(parent: THREE.Group, i: number) {
  const gdef = GENERALS[i]; const a = (gdef.hq.angle * Math.PI) / 180; const x = Math.cos(a) * 112, z = Math.sin(a) * 112; const yaw = yawTo(x, z);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; parent.add(g); occ.push({ x, z, r: 22 });
  const c = gdef.color; const o = { col: true, metal: 0.4, rough: 0.5 };
  sbox(g, 26, 13, 1.5, 0, 0, -9.25, OB, o); sbox(g, 1.5, 13, 20, -12.25, 0, 0, OB, o); sbox(g, 1.5, 13, 20, 12.25, 0, 0, OB, o); sbox(g, 9.5, 13, 1.5, -8.25, 0, 9.25, OB, o); sbox(g, 9.5, 13, 1.5, 8.25, 0, 9.25, OB, o); sbox(g, 7, 4, 1.5, 0, 9, 9.25, OB, o);
  sbox(g, 28, 1, 22, 0, 13, 0, '#141018', { col: true }); const rf = scone(g, 19, 11, 0, 14, 0, '#2a2030', 4, { em: c, ei: 0.15 }); rf.rotation.y = Math.PI / 4; mk(g, GS(1.1, 8, 6), glowM(c, 3), 0, 26, 0);
  sbox(g, 28, 0.8, 22, 0, 0, 0, '#17121c', { metal: 0.6, rough: 0.3 }); sbox(g, 5, 0.1, 18, 0, 0.8, 0, c, { em: c, ei: 0.25 });
  for (const s of [-1, 1]) { scone(g, 0.8, 5, s * 12.6, 13, 9.5, c, 5, { em: c, ei: 0.6 }); scone(g, 0.8, 5, s * 12.6, 13, -9.5, c, 5, { em: c, ei: 0.6 }); brazier(g, s * 5.5, 0, 12, c, 0.9); sbox(g, 0.5, 8, 0.5, s * 3.9, 0, 9.9, GOLD, { metal: 0.9 }); }
  banner(g, 0, 12.5, 10, 4.5, 9, c, 0); const sp = label(gdef.name + ' HQ', gdef.glow, 0.9); sp.position.set(0, 21, 0); g.add(sp);
  const orb = mk(g, GS(0.7, 10, 8), glowM(c, 2.5), 0, 3.4, -3); sbox(g, 3, 1.6, 3, 0, 0.8, -3, '#1a1420', { metal: 0.8 }); W.anim.push((t) => { orb.position.y = 3.4 + Math.sin(t * 1.5 + i) * 0.2; });
  const sx = x + 13 * Math.sin(yaw), sz = z + 13 * Math.cos(yaw); W.hq[gdef.id] = { x: sx, z: sz, yaw };
}

function oceanHQ(parent: THREE.Group, i: number) {
  const cd = COMMANDERS[i]; const a = ((155 + i * 10) * Math.PI) / 180; const x = Math.cos(a) * 134, z = Math.sin(a) * 134; const yaw = yawTo(x, z);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; parent.add(g); occ.push({ x, z, r: 14 }); W.commanderHQ.push({ x, z });
  const o = { col: true, metal: 0.5, rough: 0.3 };
  sbox(g, 13, 8, 1, 0, 0, -5, '#0e2a38', o); sbox(g, 1, 8, 10, -6, 0, 0, '#0e2a38', o); sbox(g, 1, 8, 10, 6, 0, 0, '#0e2a38', o); sbox(g, 4, 8, 1, -4.5, 0, 5, '#0e2a38', o); sbox(g, 4, 8, 1, 4.5, 0, 5, '#0e2a38', o);
  sbox(g, 14, 0.8, 11, 0, 8, 0, '#12384a', { col: true }); const rf = scone(g, 9.5, 8, 0, 8.8, 0, '#2a8aa0', 4, { em: cd.color, ei: 0.35 }); rf.rotation.y = Math.PI / 4;
  sdome(g, 2.4, 0, 0.9, -1, '#0a3a5a', cd.color); mk(g, GS(0.8, 8, 6), glowM(cd.color, 3), 0, 3.6, -1); mk(g, GT(2.2, 0.15, 6, 24), glowM(cd.color, 2), 0, 0.95, -1, undefined, [Math.PI / 2, 0, 0]);
  scyl(g, 2.5, 2.5, 0.8, 0, 0, -1, '#06222e', { em: cd.color, ei: 0.4, seg: 20 }); const sp = label(cd.name, '#a8f0ff', 0.7); sp.position.set(0, 15, 0); g.add(sp);
  addInteract({ id: 'cmd_' + cd.id, kind: 'commander', data: cd.id, x: x + 8 * Math.sin(yaw), y: 1, z: z + 8 * Math.cos(yaw), r: 6, label: `Scrying Pool — speak with ${cd.name}` });
}

function dungeon(parent: THREE.Group) {
  const g = new THREE.Group(); g.position.set(0, DUNGEON.y, 0); parent.add(g); const o = { col: true, metal: 0.2, rough: 0.9 }; const hw = DUNGEON.hx;
  sbox(g, hw * 2 + 6, 1, hw * 2 + 6, 0, -1, 0, '#16121a', { metal: 0.3, rough: 0.4, cast: false }); sbox(g, hw * 2 + 6, 2, hw * 2 + 6, 0, 25, 0, '#0c0a10', { col: true });
  sbox(g, hw * 2 + 6, 26, 3, 0, 0, -hw - 1.5, '#241e2c', o); sbox(g, hw * 2 + 6, 26, 3, 0, 0, hw + 1.5, '#241e2c', o); sbox(g, 3, 26, hw * 2, -hw - 1.5, 0, 0, '#241e2c', o); sbox(g, 3, 26, hw * 2, hw + 1.5, 0, 0, '#241e2c', o);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const z = -10 + k * 22; sbox(g, 22, 12, 1.2, s * 40, 0, z - 10, '#2c2434', o); sbox(g, 1.2, 12, 20, s * 51, 0, z, '#2c2434', o); for (let b = 0; b < 8; b++) scyl(g, 0.14, 0.14, 9, s * 40 + (b - 3.5) * 2.4 * -s * 0 + (b - 3.5) * 2.4, 0, z + 0.5 - 10 + 10.4, '#4a4a58', { metal: 0.9 }); dungeonSpawns.push({ x: s * 44, z }); }
  for (const z of [-20, 0, 20, 40]) for (const s of [-1, 1]) { scyl(g, 1.4, 1.6, 24, s * 14, 0, z, '#2a222e', { col: true }); }
  // treasure chamber
  sbox(g, 20, 14, 1.4, -20, 0, -36, '#3a2e22', o); sbox(g, 20, 14, 1.4, 20, 0, -36, '#3a2e22', o); sbox(g, 20, 5, 1.4, 0, 9, -36, '#3a2e22', o);
  sbox(g, 50, 0.3, 50, 0, 0, -48, '#2a1a08', { metal: 0.8, rough: 0.3, em: '#6a4a10', ei: 0.4 });
  const gold = new Batch(GK(1, 1, 7), M('#ffcc33', { metal: 1, rough: 0.2, em: '#ffa010', ei: 0.5 }), 90, g); const r = rng(77);
  for (let i = 0; i < 80; i++) gold.add((r() - 0.5) * 46, 0, -36 - r() * 22, r() * 6, 1 + r() * 2, 0.8 + r() * 2.4, 1 + r() * 2); gold.finish();
  for (let i = 0; i < 7; i++) { const x = -18 + i * 6, z = -58 + (i % 2) * 3; sbox(g, 2.6, 1.6, 1.8, x, 0, z, '#5a3a14', { metal: 0.5 }); sbox(g, 2.8, 0.5, 2, x, 1.6, z, '#c8a040', { metal: 0.9, em: '#ffa010', ei: 0.4 }); mk(g, GS(0.3, 8, 6), glowM(['#ff2d55', '#3fb0ff', '#8fff8f', '#ffd24a'][i % 4], 3), x, 2.6, z); }
  const crown = mk(g, GT(1.3, 0.2, 6, 20), glowM('#ffd24a', 2.4), 0, 4, -50, undefined, [Math.PI / 2, 0, 0]); W.anim.push((t) => { crown.rotation.z = t; crown.position.y = DUNGEON.y + 4 + Math.sin(t * 2) * 0.3; });
  [[-14, 8, -40], [14, 8, 20], [-30, 8, 40]].forEach(([x, y, z]) => { const l = new THREE.PointLight('#ff9a4a', 700, 60, 1.6); l.position.set(x, DUNGEON.y + y, z); parent.add(l); W.dungeonLights.push(l); });
  for (let i = 0; i < 10; i++) brazier(g, (i % 2 ? 1 : -1) * 22, 0, -50 + i * 11, '#ff9a3a', 0.8);
  sbox(g, 8, 0.6, 6, 0, 0, 56, '#0a0a10'); mk(g, GT(3, 0.2, 6, 24), glowM('#8a4bff', 2.4), 0, 3.2, 56); mk(g, GS(0.9, 8, 6), glowM('#8a4bff', 3), 0, 3.2, 56);
  addInteract({ id: 'dungeon_up', kind: 'dungeon_up', x: 0, y: DUNGEON.y + 1, z: 56, r: 5, label: 'Ascend to the Palace' });
  addInteract({ id: 'treasure', kind: 'treasure', x: 0, y: DUNGEON.y + 1, z: -48, r: 9, label: 'Royal Treasure Chamber' });
}

export function buildCapital(scene: THREE.Group) {
  const cap = new THREE.Group(); scene.add(cap);
  hall(cap); GENERALS.forEach((_, i) => generalHQ(cap, i)); COMMANDERS.forEach((_, i) => oceanHQ(cap, i)); dungeon(cap);
  occ.push({ x: -68, z: -78, r: 14 }, { x: 68, z: -78, r: 14 }, { x: 0, z: -108, r: 24 }, { x: -85, z: 62, r: 24 }, { x: 88, z: 66, r: 28 }, { x: 105, z: -48, r: 30 });
  // outer wall
  const N = 62; for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2; const deg = ((a * 180) / Math.PI + 360) % 360; if (deg < 7 || deg > 353 || Math.abs(deg - 90) < 7 || Math.abs(deg - 270) < 7 || (deg > 138 && deg < 222)) continue;
    const x = Math.cos(a) * 152, z = Math.sin(a) * 152; const y = terrainHeight(x, z) - 2;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a + Math.PI / 2; cap.add(g); sbox(g, 16.6, 13, 3, 0, y, 0, '#241c28', { col: true, metal: 0.3 }); sbox(g, 16.6, 1, 4, 0, y + 13, 0, '#120c16');
    for (let k = 0; k < 5; k++) sbox(g, 2, 1.6, 3.2, -6.4 + k * 3.2, y + 14, 0, '#1a1420');
    if (i % 4 === 0) { scyl(g, 3.2, 3.6, 20, 0, y, 0, '#2a2030', { col: true }); scone(g, 4, 8, 0, y + 20, 0, CR, 8, { em: CR, ei: 0.3 }); mk(g, GS(0.5, 6, 5), glowM('#ff6a2a', 3), 0, y + 18, 3); }
  }
  for (const ang of [0, 90, 270]) { const a = (ang * Math.PI) / 180; for (const s of [-1, 1]) { const x = Math.cos(a) * 152 - Math.sin(a) * s * 11, z = Math.sin(a) * 152 + Math.cos(a) * s * 11; const y = terrainHeight(x, z) - 2; scyl(cap, 5, 6, 30, x, y, z, '#241c28', { col: true, seg: 12 }); scone(cap, 7, 14, x, y + 30, z, CR, 10, { em: CR, ei: 0.3 }); brazier(cap, x + Math.cos(a) * 7, y + 2, z + Math.sin(a) * 7, '#ff5a2a', 1.2); } }
  const gate = label('NOX INFERNUM', '#ff9aa8', 1.6); gate.position.set(0, 40, 160); cap.add(gate);
  // marketplace
  const mk0 = new THREE.Group(); mk0.position.set(-85, 0, 62); cap.add(mk0); scyl(mk0, 5, 5.5, 1.1, 0, 0, 0, '#2a2230', { col: true, seg: 20 }); scyl(mk0, 4.2, 4.2, 0.2, 0, 1.0, 0, '#7a1020', { seg: 20, em: '#ff2040', ei: 0.8 }); scone(mk0, 0.9, 6, 0, 1, 0, GOLD, 6); mk(mk0, GS(0.6, 8, 6), glowM('#ff6a2a', 3), 0, 7.5, 0);
  const crates = new Batch(GB(1.6, 1.6, 1.6), M('#4a3220', { rough: 0.9, metal: 0 }), 90, cap, true);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = 14; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; const g = new THREE.Group(); g.position.set(-85 + x, 0, 62 + z); g.rotation.y = -a + Math.PI / 2; cap.add(g); const cols = ['#7a1020', '#2a1a4a', '#7a4a10', '#104a4a', '#4a1a6a']; sbox(g, 5, 2.4, 3, 0, 0, 0, '#2a1c20', { col: true }); sbox(g, 6, 0.3, 4, 0, 3.4, 0.4, cols[i % 5]); sbox(g, 0.3, 3.4, 0.3, -2.8, 0, 1.8, '#111'); sbox(g, 0.3, 3.4, 0.3, 2.8, 0, 1.8, '#111'); mk(g, GS(0.3, 6, 5), glowM('#ffcc66', 2), 0, 3, 1.8); npcSpots.push({ x: -85 + Math.cos(a) * 10.5, z: 62 + Math.sin(a) * 10.5, kind: 'merchant' }); const cx = -85 + Math.cos(a) * 17, cz = 62 + Math.sin(a) * 17; const ci = crates.add(cx, 0.8, cz, a, 1, 1, 1); regDestr('crate', cx, 0.8, cz, 1.4, [[crates, ci]], addCircle(cx, cz, 1.0, 1.6), '#4a3220'); }
  crates.finish(); npcSpots.push({ x: -80, z: 70, kind: 'citizen' }, { x: -92, z: 70, kind: 'citizen' }, { x: -85, z: 50, kind: 'citizen' });
  // training grounds
  const tg = new THREE.Group(); tg.position.set(88, 0, 66); cap.add(tg); sbox(tg, 44, 0.3, 44, 0, 0, 0, '#3a2a20', { rough: 1, cast: false });
  for (let i = 0; i < 12; i++) { const t = i / 12 * 44 - 22; for (const [x, z] of [[t, -22], [t, 22], [-22, t], [22, t]]) if (i % 2 === 0) sbox(tg, 0.4, 2.4, 0.4, x, 0, z, '#2a1a10', { col: true }); }
  for (let i = 0; i < 6; i++) { const d = new THREE.Group(); d.position.set(-14 + i * 5.6, 0, -14); tg.add(d); mk(d, GC(0.2, 0.2, 3, 6), M('#4a3220'), 0, 1.5, 0); mk(d, GB(1.8, 0.3, 0.3), M('#4a3220'), 0, 2.4, 0); const b = mk(d, GC(0.55, 0.5, 1.6, 8), M('#8a6a40', { rough: 1, metal: 0 }), 0, 1.5, 0.1); b.castShadow = true; mk(d, GS(0.32, 8, 6), M('#a08060'), 0, 3.0, 0); addCircle(88 - 14 + i * 5.6, 52, 0.5, 3.2); W.dummies.push(d); }
  for (const [x, z] of [[-10, 10], [10, 10], [0, 16]]) npcSpots.push({ x: 88 + x, z: 66 + z, kind: 'recruit' }); sbox(tg, 5, 3, 1, 14, 0, 19, '#2a1a10', { col: true });
  const tl = label('TRAINING GROUNDS', '#ffd2a0', 0.7); tl.position.set(0, 9, -22); tg.add(tl);
  // barracks
  for (let i = 0; i < 3; i++) { const g = new THREE.Group(); g.position.set(108, 0, -68 + i * 22); cap.add(g); const o = { col: true, metal: 0.3 }; sbox(g, 30, 9, 11, 0, 0, 0, '#2a2028', o); sbox(g, 32, 1.4, 13, 0, 9, 0, '#7a1020', { col: true }); const rf = scone(g, 10, 5, 0, 10.4, 0, '#3a1020', 4); rf.scale.set(1.6, 1, 0.7); rf.rotation.y = Math.PI / 4; for (let k = 0; k < 4; k++) sbox(g, 0.4, 2.6, 0.4, -9 + k * 6, 1, 5.6, '#ff6a2a', { em: '#ff6a2a', ei: 1.2 }); banner(g, -13, 12, 5.5, 2.5, 6, CR); npcSpots.push({ x: 108 - 20, z: -68 + i * 22, kind: 'guard' }); }
  const bl = label('DEMON BARRACKS', '#ffb0a0', 0.7); bl.position.set(108, 16, -46); cap.add(bl);
  // dragon platforms
  for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 68, 0, -78); cap.add(g); scyl(g, 10, 11, 2.2, 0, 0, 0, '#241c28', { col: true, seg: 20 }); scyl(g, 9, 9, 0.2, 0, 2.2, 0, '#3a1020', { seg: 20, em: '#ff2040', ei: 0.5 }); mk(g, GT(8.5, 0.2, 5, 40), glowM('#ff6a2a', 2), 0, 2.5, 0, undefined, [Math.PI / 2, 0, 0]); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; scone(g, 0.6, 5, Math.cos(a) * 10, 0, Math.sin(a) * 10, '#120c16', 5); } }
  // gardens
  const gd = new THREE.Group(); gd.position.set(0, 0, -108); cap.add(gd); scyl(gd, 10, 10, 0.4, 0, 0, 0, '#0a2a3a', { seg: 24, em: '#2a8aff', ei: 0.4 }); const stat = new THREE.Group(); gd.add(stat); scyl(stat, 2, 2.4, 1.6, 0, 0, 0, '#2a222e', { col: true }); sbox(stat, 1.6, 6, 1.2, 0, 1.6, 0, '#1a1420'); scone(stat, 0.4, 3, -0.5, 7, 0, '#1a1420', 5).rotation.z = 0.4; scone(stat, 0.4, 3, 0.5, 7, 0, '#1a1420', 5).rotation.z = -0.4; mk(stat, GS(0.3, 8, 6), glowM('#ff2040', 3), 0, 6.2, 0.6);
  const lt = new Batch(GC(0.35, 0.5, 5, 6), M('#2a1a1e'), 40, gd, true), lc = new Batch(GS(2, 8, 6), M('#a0102c', { em: '#a0102c', ei: 0.35, rough: 0.8 }), 40, gd, true), fw = new Batch(GK(0.3, 0.7, 5), M('#ff4aa0', { em: '#ff4aa0', ei: 1.6 }), 200, gd);
  const rr = rng(5); for (let i = 0; i < 22; i++) { const a = rr() * Math.PI * 2, d = 14 + rr() * 14; const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7; const wx = x, wz = -108 + z; if (!free(wx, wz, -4)) continue; const s = 0.8 + rr() * 0.6; const t1 = lt.add(x, 2.5 * s, z, 0, s, s, s), t2 = lc.add(x, 6 * s, z, 0, s * 1.2, s, s * 1.2); regDestr('tree', wx, 3, wz, 3.2 * s, [[lt, t1], [lc, t2]], addCircle(wx, wz, 0.7 * s, 6), '#a0102c'); }
  for (let i = 0; i < 160; i++) { const a = rr() * Math.PI * 2, d = 11 + rr() * 16; fw.add(Math.cos(a) * d, 0.3, Math.sin(a) * d * 0.7, rr() * 3, 1, 0.6 + rr()); } lt.finish(); lc.finish(); fw.finish();
  const gl = label('ROYAL GARDENS', '#ffa0c0', 0.7); gl.position.set(0, 12, 0); gd.add(gl);
  // residential
  const hw = new Batch(GB(1, 1, 1), M('#ffffff', { rough: 0.9, metal: 0.05 }), 120, cap, true), hr = new Batch(GK(0.9, 1, 4), M('#ffffff', { rough: 0.7, metal: 0.2 }), 120, cap, true), hg = new Batch(GB(0.9, 0.9, 0.9), glowM('#ffb060', 1.6), 120, cap);
  const r3 = rng(21); const wallC = ['#2a2230', '#2e2630', '#241e2a', '#30283a'], roofC = ['#7a1020', '#5a0a30', '#3a1050', '#8a2010'];
  let placed = 0; for (let t = 0; t < 700 && placed < 110; t++) {
    const x = (r3() - 0.5) * 270, z = (r3() - 0.5) * 270; if (!free(x, z, 6) || Math.abs(x) < 9 && z > 40 || Math.abs(x) < 9 || Math.abs(z) < 6 && x > 40) continue;
    if (Math.hypot(x, z) < 70) continue; const w = 6 + r3() * 4, d = 6 + r3() * 4, h = 6 + r3() * 8, yaw = Math.round(r3() * 4) * Math.PI / 2 + (r3() - 0.5) * 0.2;
    const i1 = hw.add(x, h / 2, z, yaw, w, h, d, wallC[placed % 4]), i2 = hr.add(x, h + 2.4, z, yaw + Math.PI / 4, w * 0.85, 5 + r3() * 3, d * 0.85, roofC[placed % 4]), i3 = hg.add(x + Math.sin(yaw) * (d / 2 + 0.05) * 1, h * 0.5, z + Math.cos(yaw) * (d / 2 + 0.05), yaw, 1.2, 1.6, 0.2);
    regDestr('house', x, h / 2, z, Math.max(w, d) * 0.7, [[hw, i1], [hr, i2], [hg, i3]], addBox2(x, z, w / 2, d / 2, yaw, h + 4), '#2a2230'); occ.push({ x, z, r: Math.max(w, d) * 0.8 }); placed++;
    if (placed % 5 === 0) npcSpots.push({ x: x + 8, z: z + 8, kind: 'citizen' });
  }
  hw.finish(); hr.finish(); hg.finish();
  // lamps
  const lamp = new Batch(GS(0.35, 6, 5), glowM('#ffaa55', 2.5), 80, cap), lp = new Batch(GC(0.1, 0.12, 3.6, 5), M('#111'), 80, cap);
  for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2, d = 70 + (i % 3) * 25; const x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 3)) continue; lp.add(x, 1.8, z); lamp.add(x, 3.7, z); } lamp.finish(); lp.finish();
  for (let i = 0; i < 8; i++) { const z = 50 + i * 12; for (const s of [-1, 1]) { scyl(cap, 0.25, 0.3, 5, s * 8, 0, z, '#111'); mk(cap, GS(0.5, 6, 5), glowM('#ff7a2a', 3), s * 8, 5.4, z); } }
  for (const p of [[-20, 24], [20, 24], [-30, -30]] as const) npcSpots.push({ x: p[0] + 60, z: p[1] + 40, kind: 'citizen' });
}
import { addBox } from './terrain';
const addBox2 = (x: number, z: number, hx: number, hz: number, rot: number, y1: number) => addBox(x, z, hx, hz, rot, y1);
