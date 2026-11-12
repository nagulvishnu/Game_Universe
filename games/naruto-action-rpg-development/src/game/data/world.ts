import type { CampDef, Collectible, LookDef, NpcDef } from '../types';
import { ColliderWorld } from '../logic/collision';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------------------------------------------------------------- Konoha layout
export const TOWER = { x: 0, z: -50, r: 9, h: 26 };
export const ACADEMY = { x: -40, z: -20, w: 18, d: 12, h: 6 };
export const CRATES = [
  { x: -27.2, z: -18, w: 2.4, d: 2.4, h: 2.2 },
  { x: -29.7, z: -18, w: 2.4, d: 2.4, h: 4.4 },
  { x: -31.9, z: -21, w: 2.4, d: 2.4, h: 2.0 },
];
export const BOARD_POS: [number, number] = [12, -28];
export const RAMEN_POS: [number, number] = [18, 3];
export const SHOP_POS: [number, number] = [-22, 20];
export const TRAINING = { x: 55, z: 40 };
export const TRAINING_POSTS: [number, number][] = [[49, 36], [55, 36], [61, 36]];
export const WATER_RECTS: [number, number, number, number][] = [[-305, -182, -75, 75], [175, 245, -270, -205]];
export const BRIDGE = { minX: -300, maxX: -180, z: 0, w: 22, top: 0.45 };

export interface House { x: number; z: number; w: number; d: number; h: number; wall: string; roof: string }
const WALLS = ['#f0e3c8', '#e8d3b0', '#f3ead9', '#dfc9a2'];
const ROOFS = ['#c0562e', '#2f7078', '#9a3a2a', '#3d5a8a'];

function genHouses(): House[] {
  const r = rng(7); const out: House[] = [];
  for (let gx = -63; gx <= 63; gx += 14) for (let gz = -63; gz <= 63; gz += 14) {
    const x = gx + (r() - 0.5) * 3, z = gz + (r() - 0.5) * 3;
    const w = 6.5 + r() * 3, d = 6.5 + r() * 3, h = r() < 0.15 ? 5.4 + r() : 2.6 + r() * 0.7;
    const wi = Math.floor(r() * 4), ri = Math.floor(r() * 4);
    if (Math.abs(x) < 10 || Math.abs(z) < 10) continue;
    if (Math.hypot(x - TOWER.x, z - TOWER.z) < 22) continue;
    if (Math.hypot(x - ACADEMY.x, z - ACADEMY.z) < 20) continue;
    if (Math.hypot(x - RAMEN_POS[0], z - RAMEN_POS[1]) < 9) continue;
    if (Math.hypot(x - SHOP_POS[0], z - SHOP_POS[1]) < 10) continue;
    if (Math.hypot(x - BOARD_POS[0], z - BOARD_POS[1]) < 10) continue;
    if (x > 34 && z > 18) continue;
    if (Math.hypot(x, z - 70) < 12) continue;
    out.push({ x, z, w, d, h, wall: WALLS[wi], roof: ROOFS[ri] });
  }
  return out;
}
export const HOUSES = genHouses();
export const LOW_HOUSES = HOUSES.filter((h) => h.h <= 3.4);
/** A chain of reachable rooftops for the rooftop run (nearest-neighbour walk in the south-west quarter). */
function roofChain(): [number, number, number][] {
  const pool = LOW_HOUSES.filter((h) => h.x < -10 && h.z > 10 && h.z < 60);
  const chain: [number, number, number][] = [];
  if (!pool.length) return chain;
  let cur = pool.reduce((a, b) => (a.x < b.x ? a : b));
  const used = new Set([cur]);
  for (let i = 0; i < 5; i++) {
    chain.push([cur.x, cur.z, cur.h + 0.45]);
    let best: House | null = null; let bd = 1e9;
    for (const h of pool) if (!used.has(h)) { const d = Math.hypot(h.x - cur.x, h.z - cur.z); if (d < bd) { bd = d; best = h; } }
    if (!best) break; used.add(best); cur = best;
  }
  return chain;
}
export const ROOF_RUN = roofChain();

// ---------------------------------------------------------------- Camps
export const CAMPS: CampDef[] = [
  { id: 'c_gate', zone: 'wilds', pos: [0, 108], lv: 2, radius: 60, spawns: [{ def: 'rogue', count: 3 }] },
  { id: 'c_west', zone: 'wilds', pos: [-120, 25], lv: 3, radius: 60, spawns: [{ def: 'rogue', count: 2 }, { def: 'fireNin', count: 1 }] },
  { id: 'c_east', zone: 'wilds', pos: [120, -20], lv: 3, radius: 60, spawns: [{ def: 'rogue', count: 2 }, { def: 'skilled', count: 1 }] },
  { id: 'f1', zone: 'forest', pos: [0, 155], lv: 4, radius: 60, spawns: [{ def: 'rogue', count: 3 }, { def: 'fireNin', count: 1 }] },
  { id: 'f2', zone: 'forest', pos: [-50, 205], lv: 5, radius: 60, spawns: [{ def: 'skilled', count: 2 }, { def: 'illusionist', count: 1 }] },
  { id: 'f3', zone: 'forest', pos: [50, 215], lv: 6, radius: 60, spawns: [{ def: 'lightningNin', count: 2 }, { def: 'rogue', count: 2 }] },
  { id: 'f4', zone: 'forest', pos: [0, 258], lv: 7, radius: 60, spawns: [{ def: 'stoneBrute', count: 1 }, { def: 'rogue', count: 2 }] },
  { id: 'f5', zone: 'forest', pos: [-62, 262], lv: 7, radius: 60, spawns: [{ def: 'skilled', count: 2 }, { def: 'fireNin', count: 1 }, { def: 'illusionist', count: 1 }] },
  { id: 'f6', zone: 'forest', pos: [66, 262], lv: 10, radius: 60, spawns: [{ def: 'akatsuki', count: 1 }] },
  { id: 'w1', zone: 'waves', pos: [-212, 58], lv: 6, radius: 60, spawns: [{ def: 'rogue', count: 3 }, { def: 'lightningNin', count: 1 }] },
  { id: 'w2', zone: 'waves', pos: [-335, 30], lv: 8, radius: 60, spawns: [{ def: 'skilled', count: 2 }, { def: 'mistElite', count: 1 }] },
  { id: 's1', zone: 'sand', pos: [195, 42], lv: 7, radius: 60, spawns: [{ def: 'skilled', count: 2 }, { def: 'fireNin', count: 1 }] },
  { id: 's2', zone: 'sand', pos: [285, -45], lv: 8, radius: 60, spawns: [{ def: 'lightningNin', count: 2 }, { def: 'stoneBrute', count: 1 }] },
  { id: 'v1', zone: 'valley', pos: [215, -195], lv: 9, radius: 60, spawns: [{ def: 'mistElite', count: 1 }, { def: 'skilled', count: 1 }] },
  { id: 'v2', zone: 'valley', pos: [182, -290], lv: 9, radius: 60, spawns: [{ def: 'skilled', count: 3 }, { def: 'illusionist', count: 1 }] },
  { id: 'm1', zone: 'myoboku', pos: [-255, -275], lv: 8, radius: 60, spawns: [{ def: 'stoneBrute', count: 1 }] },
];

// ---------------------------------------------------------------- Forest / Sand / Myoboku props
export interface Tree { x: number; z: number; r: number; h: number; hue: number }
function genForest(): Tree[] {
  const r = rng(99); const out: Tree[] = [];
  for (let i = 0; i < 700 && out.length < 190; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 96;
    const x = Math.cos(a) * d, z = 215 + Math.sin(a) * d;
    if (Math.abs(x) < 4.5 && z < 175) continue; // entrance path
    if (CAMPS.some((c) => Math.hypot(c.pos[0] - x, c.pos[1] - z) < 11)) continue;
    if (Math.hypot(x - 0, z - 215) < 6) continue;
    if (Math.hypot(x + 70, z - 250) < 9) continue; // secret cave
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
    out.push({ x, z, r: 1.3 + r() * 1.3, h: 26 + r() * 16, hue: r() });
  }
  return out;
}
export const FOREST_TREES = genForest();
export const SAKURA_TREES: [number, number][] = [[-14, 16], [-18, 40], [16, 24], [20, 44], [-30, 50], [30, -12], [-16, -34], [26, -34], [-50, 8], [48, 6], [0, 58], [-8, 50]];
export const SAND_BUILDINGS = [
  { x: 205, z: -30, r: 8, h: 8 }, { x: 225, z: -48, r: 6.5, h: 6 }, { x: 255, z: -20, r: 7.5, h: 7 }, { x: 275, z: 20, r: 7, h: 6.5 },
  { x: 215, z: 25, r: 6, h: 5.5 }, { x: 245, z: -62, r: 9, h: 9 }, { x: 195, z: -5, r: 5.5, h: 5 }, { x: 300, z: -10, r: 6, h: 6 },
  { x: 236, z: 62, r: 5.5, h: 5 },
];
export const KAZEKAGE = { x: 240, z: -90, r: 12, h: 18 };
export const PILLARS: { x: number; z: number; w: number; h: number }[] = [
  { x: -196, z: -218, w: 3.2, h: 2.2 }, { x: -191, z: -222, w: 3.2, h: 4.4 }, { x: -185, z: -225, w: 3.2, h: 6.6 }, { x: -179, z: -222, w: 3.2, h: 8.8 },
];
export const SAGE_ROCKS: [number, number, number][] = [[-250, -200, 14], [-165, -255, 18], [-270, -255, 22], [-150, -205, 12], [-230, -295, 20]];
export const VALLEY_STATUES = [{ x: 172, z: -238, dir: 1, name: 'Hashirama' }, { x: 248, z: -238, dir: -1, name: 'Madara' }];
export const MYOBOKU_MUSHROOMS: [number, number, number][] = [[-220, -200, 3], [-175, -230, 4], [-235, -250, 5], [-205, -270, 3.5], [-255, -225, 4], [-160, -270, 3], [-190, -190, 2.5], [-240, -275, 4.5]];

// ---------------------------------------------------------------- NPCs
const L = (o: Partial<LookDef>): LookDef => ({ skin: '#f2cfa8', hair: '#3a2a20', hairStyle: 'spikyShort', outfit: '#445', trim: '#223', pants: '#334', headband: '#1b3d9c', weapon: 'none', ...o });
export const NPCS: NpcDef[] = [
  { id: 'iruka', name: 'Iruka Umino', pos: [-35, -9], yaw: 0.6, zone: 'konoha', role: 'story', portrait: '🍃', look: L({ outfit: '#2a6f4f', trim: '#1a4a34', pants: '#2a3a4a', hair: '#4a3020', hairStyle: 'spikyShort' }), lines: ['Keep training hard! A shinobi never gives up.', 'Don\'t slack off, Naruto!'] },
  { id: 'hokage', name: 'Lord Third Hokage', pos: [0, -38], yaw: 0, zone: 'konoha', role: 'story', portrait: '🔥', look: L({ skin: '#e8c8a0', hair: '#eee', hairStyle: 'hood', outfit: '#f2f2f2', trim: '#c0302a', pants: '#f2f2f2', headband: null, scale: 0.95 }), lines: ['The Will of Fire burns in every Leaf ninja.', 'Konoha is protected by its people.'] },
  { id: 'tsunade', name: 'Tsunade', pos: [8, -34], yaw: -0.4, zone: 'konoha', role: 'healer', portrait: '💚', look: L({ skin: '#f6d8bc', hair: '#e8c860', hairStyle: 'long', outfit: '#3a8a5a', trim: '#e0e0e0', pants: '#3a3a4a', headband: null }), lines: ['Let me patch you up. Your HP and chakra are restored, and your progress is saved.'] },
  { id: 'teuchi', name: 'Teuchi (Ichiraku Ramen)', pos: [18, 5.2], yaw: Math.PI, zone: 'konoha', role: 'shop', portrait: '🍜', shop: ['ramen', 'bigRamen', 'soldierPill', 'chakraPill'], look: L({ outfit: '#f4f4f4', trim: '#cc3030', pants: '#2a2a3a', hair: '#6a5a4a', hairStyle: 'none', headband: '#f4f4f4' }), lines: ['Welcome! Best ramen in Konoha!'] },
  { id: 'tenten', name: 'Tenten (Ninja Tools)', pos: [-22, 22], yaw: Math.PI, zone: 'konoha', role: 'shop', portrait: '🗡️', shop: ['kunai', 'steelKunai', 'chakraBlade', 'chuninVest', 'anbuArmor', 'toadCharm', 'sagePendant', 'focusScroll', 'ironScrap'], look: L({ outfit: '#d83a5a', trim: '#f0e0d0', pants: '#4a3a30', hair: '#5a3a20', hairStyle: 'bob' }), lines: ['Weapons, armor, and tools — all top quality!'] },
  { id: 'kakashi', name: 'Kakashi Hatake', pos: [48, 31], yaw: Math.PI, zone: 'konoha', role: 'story', portrait: '📖', look: L({ hair: '#c9ccd6', hairStyle: 'silver', outfit: '#3d5a80', trim: '#4f6d33', pants: '#2a3a55', mask: true }), lines: ['Sorry I\'m late — I got lost on the path of life.'] },
  { id: 'sasuke', name: 'Sasuke Uchiha', pos: [53, 36], yaw: -2, zone: 'konoha', role: 'flavor', portrait: '⚡', look: L({ hair: '#15151f', hairStyle: 'sasuke', outfit: '#3a4a7a', trim: '#e8e8f0', pants: '#e8e8f0', weapon: 'sword' }), lines: ['Hmph. Don\'t get in my way.'] },
  { id: 'sakura', name: 'Sakura Haruno', pos: [44, 37], yaw: 2, zone: 'konoha', role: 'flavor', portrait: '🌸', look: L({ hair: '#ff8fb8', hairStyle: 'bob', outfit: '#e8264a', trim: '#fff', pants: '#2a2a3a' }), lines: ['Naruto, you idiot! Focus!'] },
  { id: 'hinata', name: 'Hinata Hyuga', pos: [25, -13], yaw: 1, zone: 'konoha', role: 'flavor', portrait: '🤍', look: L({ hair: '#2a2a48', hairStyle: 'bob', outfit: '#d8d8ee', trim: '#6a5acd', pants: '#2a2a48', skin: '#f6e0d0' }), lines: ['N-Naruto-kun... I believe in you.', 'I\'m going to keep trying my best too.'] },
  { id: 'shikamaru', name: 'Shikamaru Nara', pos: [-14, 28], yaw: 0.4, zone: 'konoha', role: 'flavor', portrait: '☁️', look: L({ hair: '#2a2420', hairStyle: 'spiky', outfit: '#3a5a3a', trim: '#2a3a2a', pants: '#2a3a2a' }), lines: ['What a drag... but the clouds are nice today.', 'Always think three moves ahead.'] },
  { id: 'lee', name: 'Rock Lee', pos: [60, 47], yaw: -2.5, zone: 'konoha', role: 'story', portrait: '💚', look: L({ hair: '#101018', hairStyle: 'bowl', outfit: '#1f9a4a', trim: '#ff8a1a', pants: '#1f9a4a', brows: true }), lines: ['The power of youth!'] },
  { id: 'jiraiya', name: 'Jiraiya', pos: [-200, -208], yaw: 0.8, zone: 'myoboku', role: 'story', portrait: '🐸', look: L({ hair: '#f4f4f4', hairStyle: 'long', outfit: '#3f8f4a', trim: '#b32d2d', pants: '#5a4a38', scale: 1.08, back: 'scroll' }), lines: ['Hehe, the Great Toad Sage is always researching!'] },
  { id: 'kankuro', name: 'Kankuro', pos: [232, 10], yaw: 0.8, zone: 'sand', role: 'challenge', portrait: '🎭', look: L({ hair: '#4a3a2a', hairStyle: 'hood', outfit: '#2a2a3a', trim: '#8a3a8a', pants: '#2a2a3a' }), lines: ['Gaara keeps to himself... but he might accept a challenge.'] },
];

// ---------------------------------------------------------------- Collectibles
const lowR = (i: number): House => LOW_HOUSES[Math.min(i, LOW_HOUSES.length - 1)];
const rf = (h: House): [number, number, number] => [h.x, h.h + 0.45, h.z];
export const COLLECTIBLES: Collectible[] = [
  { id: 'chest_roof1', kind: 'chest', pos: rf(lowR(2)), label: 'Rooftop Chest', reward: { ryo: 220, items: [['soldierPill', 2]] } },
  { id: 'chest_roof2', kind: 'chest', pos: rf(lowR(8)), label: 'Rooftop Chest', reward: { ryo: 300, items: [['ironScrap', 3]] } },
  { id: 'chest_roof3', kind: 'chest', pos: rf(lowR(14)), label: 'Rooftop Chest', reward: { ryo: 400, items: [['chakraCrystal', 1]] } },
  { id: 'ls_academy', kind: 'scroll', pos: [-40, ACADEMY.h + 0.5, -20], label: 'Hidden Leaf Scroll', reward: { xp: 60, items: [['leafScrollItem', 1]] } },
  { id: 'ls_wall', kind: 'scroll', pos: [-12, 0.8, 70], label: 'Hidden Leaf Scroll', reward: { xp: 50, items: [['leafScrollItem', 1]] } },
  { id: 'ls_training', kind: 'scroll', pos: [72, 0.8, 52], label: 'Hidden Leaf Scroll', reward: { xp: 50, items: [['leafScrollItem', 1]] } },
  { id: 'ls_wild1', kind: 'scroll', pos: [-125, 0.8, 55], label: 'Hidden Leaf Scroll', reward: { xp: 70, items: [['leafScrollItem', 1]] } },
  { id: 'ls_waves', kind: 'scroll', pos: [-232, 1.2, -62], label: 'Hidden Leaf Scroll', reward: { xp: 90, items: [['leafScrollItem', 1]] } },
  { id: 'chest_waves', kind: 'chest', pos: [-322, 0.8, -18], label: 'Dockside Chest', reward: { ryo: 500, items: [['bigRamen', 2]] } },
  { id: 'ls_sand', kind: 'scroll', pos: [292, 0.8, 38], label: 'Hidden Leaf Scroll', reward: { xp: 90, items: [['leafScrollItem', 1]] } },
  { id: 'chest_sand', kind: 'chest', pos: [245, 0.8, -75], label: 'Sandstone Chest', reward: { ryo: 600, items: [['chakraPill', 1], ['ironScrap', 3]] } },
  { id: 'ls_valley', kind: 'scroll', pos: [210, 0.8, -258], label: 'Hidden Leaf Scroll', reward: { xp: 120, items: [['leafScrollItem', 1]] } },
  { id: 'chest_valley', kind: 'chest', pos: [155, 0.8, -215], label: 'Valley Chest', reward: { ryo: 800, items: [['chakraCrystal', 2]] } },
  { id: 'chest_myoboku', kind: 'chest', pos: [-170, 0.8, -262], label: 'Myoboku Chest', reward: { ryo: 700, items: [['bigRamen', 2], ['chakraCrystal', 1]] } },
  { id: 'chest_peak', kind: 'chest', pos: [-179, 8.8 + 1.2, -222], label: 'Summit Chest', reward: { ryo: 900, items: [['xpScroll', 2]] } },
  // mission specific
  { id: 'fs1', kind: 'scroll', tag: 'forestScroll', mission: 'lost_scroll', pos: [-20, 0.8, 172], label: 'Lost Scroll', reward: {} },
  { id: 'fs2', kind: 'scroll', tag: 'forestScroll', mission: 'lost_scroll', pos: [40, 0.8, 190], label: 'Lost Scroll', reward: {} },
  { id: 'fs3', kind: 'scroll', tag: 'forestScroll', mission: 'lost_scroll', pos: [-55, 0.8, 230], label: 'Lost Scroll', reward: {} },
  { id: 'fs4', kind: 'scroll', tag: 'forestScroll', mission: 'lost_scroll', pos: [30, 0.8, 245], label: 'Lost Scroll', reward: {} },
  { id: 'tora', kind: 'cat', tag: 'cat', mission: 'missing_cat', pos: [-60, 0.6, 40], label: 'Tora the Cat', reward: {} },
  { id: 'secret1', kind: 'secret', tag: 'secretScroll', mission: 'secret_technique', pos: [-70, 1.2, 252], label: 'Secret Wind Scroll', reward: {} },
  { id: 'orb1', kind: 'orb', tag: 'orb', mission: 'sage_training', pos: [-196, 2.2 + 1.2, -218], label: 'Natural Energy', reward: {} },
  { id: 'orb2', kind: 'orb', tag: 'orb', mission: 'sage_training', pos: [-191, 4.4 + 1.2, -222], label: 'Natural Energy', reward: {} },
  { id: 'orb3', kind: 'orb', tag: 'orb', mission: 'sage_training', pos: [-185, 6.6 + 1.2, -225], label: 'Natural Energy', reward: {} },
  { id: 'orb4', kind: 'orb', tag: 'orb', mission: 'sage_training', pos: [-179, 8.8 + 1.2, -222], label: 'Natural Energy', reward: {} },
];

// ---------------------------------------------------------------- Colliders
export function buildColliders(): ColliderWorld {
  const w = new ColliderWorld();
  for (const h of HOUSES) w.box(h.x, h.z, h.w + 1, h.d + 1, h.h + 0.45);
  w.circle(TOWER.x, TOWER.z, TOWER.r, TOWER.h);
  w.box(ACADEMY.x, ACADEMY.z, ACADEMY.w + 1, ACADEMY.d + 1, ACADEMY.h + 0.5);
  for (const c of CRATES) w.box(c.x, c.z, c.w, c.d, c.h);
  for (const [x, z] of TRAINING_POSTS) w.circle(x, z, 0.55, 3.5);
  w.box(RAMEN_POS[0], RAMEN_POS[1], 5, 3, 3);
  w.box(SHOP_POS[0], SHOP_POS[1], 5, 3, 3);
  w.box(BOARD_POS[0], BOARD_POS[1], 3.2, 0.6, 2.8);
  // village wall (gaps at south/west/east gates, north closed)
  const T = 3, H = 7, R = 77;
  w.box(0, -R, R * 2, T, H);
  w.box(-R, -R / 2 - 4, T, R - 8, H); w.box(-R, R / 2 + 4, T, R - 8, H);
  w.box(R, -R / 2 - 4, T, R - 8, H); w.box(R, R / 2 + 4, T, R - 8, H);
  w.box(-R / 2 - 4, R, R - 8, T, H); w.box(R / 2 + 4, R, R - 8, T, H);
  // gate pillars
  for (const [x, z] of [[-8, R], [8, R], [-R, -8], [-R, 8], [R, -8], [R, 8]]) w.circle(x, z, 1.4, 9);
  // Hokage monument cliff
  w.box(0, -110, 140, 40, 40);
  // forest
  for (const t of FOREST_TREES) w.circle(t.x, t.z, t.r, 50);
  // secret cave rocks
  w.circle(-70, 244, 3, 6); w.circle(-76, 250, 3, 6); w.circle(-64, 250, 2.5, 6);
  // bridge deck and rails
  w.box((BRIDGE.minX + BRIDGE.maxX) / 2, BRIDGE.z, BRIDGE.maxX - BRIDGE.minX, BRIDGE.w, BRIDGE.top);
  w.box((BRIDGE.minX + BRIDGE.maxX) / 2, BRIDGE.z - BRIDGE.w / 2 - 0.2, BRIDGE.maxX - BRIDGE.minX, 0.4, 3);
  w.box((BRIDGE.minX + BRIDGE.maxX) / 2, BRIDGE.z + BRIDGE.w / 2 + 0.2, BRIDGE.maxX - BRIDGE.minX, 0.4, 3);
  // waves huts
  for (const [x, z] of [[-325, -30], [-335, 5], [-322, 22], [-345, -15]]) w.box(x, z, 8, 7, 3.5);
  // sand
  for (const b of SAND_BUILDINGS) w.circle(b.x, b.z, b.r, b.h);
  w.circle(KAZEKAGE.x, KAZEKAGE.z, KAZEKAGE.r, KAZEKAGE.h);
  // myoboku
  for (const p of PILLARS) w.box(p.x, p.z, p.w, p.w, p.h);
  for (const [x, z, r] of SAGE_ROCKS) w.circle(x, z, r * 0.7, 40);
  for (const [x, z, r] of MYOBOKU_MUSHROOMS) w.circle(x, z, r * 0.45, 30);
  // valley statues
  for (const s of VALLEY_STATUES) w.box(s.x, s.z, 12, 10, 40);
  w.box(210, -306, 60, 8, 40);
  return w;
}
