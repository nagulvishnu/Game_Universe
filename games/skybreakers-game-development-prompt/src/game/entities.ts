// World entities: structures, NPCs (routines + reactions), resource nodes, chests, interactables, discovery, barriers.
import * as THREE from 'three';
import { ITEMS, NPCS, QUESTS, SHIPS, type NpcDef } from './data';
import { sfx } from './audio';
import { damageHostile, spawnLoot } from './combat';
import { spawnEnemy } from './enemies';
import { fx } from './fx';
import { glow } from './gfx';
import { buildHuman, type HumanOpt } from './models';
import { buildNode, buildStruct } from './models2';
import { G, angDiff, clamp, input, lerpAng, rand, type Interactable } from './runtime';
import { useStore } from './store';
import { ISLANDS, ISLAND_MAP, WORLD, collide, groundAt, islandAt, placeOn } from './world';
import { startClimb } from './player';
import { boardShip } from './airship';

const V1 = new THREE.Vector3(); const C = { x: 0, z: 0 };
const addI = (i: Interactable) => { G.interactables.push(i); return i; };
export const removeI = (id: string) => { const k = G.interactables.findIndex(i => i.id === id); if (k >= 0) G.interactables.splice(k, 1); };
const spinners: THREE.Object3D[] = []; const bobbers: { o: THREE.Object3D; y: number }[] = [];
interface NodeRt { spec: typeof WORLD.nodes[number]; obj: THREE.Group; hits: number; depleted: boolean; respawn: number; shake: number }
const nodes: NodeRt[] = []; const npcs: NpcRt[] = [];
interface NpcRt { def: NpcDef; obj: THREE.Group; pos: THREE.Vector3; home: THREE.Vector3; bed: THREE.Vector3; target: THREE.Vector3; yaw: number; t: number; walk: number; panic: number; marker: THREE.Sprite; hitCd: number; hidden: boolean; mode: string }

const GATHER: Record<string, { label: string; item: string; n: [number, number]; sfx: string; hits: number }> = {
  wood: { label: 'Chop Tree', item: 'wood', n: [2, 3], sfx: 'chop', hits: 3 }, stone: { label: 'Mine Stone', item: 'stone', n: [2, 3], sfx: 'mine', hits: 3 }, iron: { label: 'Mine Iron Ore', item: 'iron', n: [1, 2], sfx: 'mine', hits: 3 },
  crystal: { label: 'Harvest Crystal', item: 'crystal', n: [1, 2], sfx: 'mine', hits: 3 }, essence: { label: 'Collect Essence', item: 'essence', n: [1, 2], sfx: 'pickup', hits: 2 }, fragment: { label: 'Excavate Fragment', item: 'fragment', n: [1, 1], sfx: 'mine', hits: 4 },
};
function lootChest(isl: string) {
  const st = useStore.getState(); const tier = { verdant: 1, haven: 1, whisper: 1, spire: 2, frost: 2, ruins: 3, ember: 3, shadow: 4, celestial: 5, aurora: 5, dawn: 5 }[isl] || 1;
  const out: [string, number][] = [['gold', Math.round(rand(35, 90) * tier)]]; const pool: [string, number, number][] = [['hp_potion', 1, 3], ['mp_potion', 1, 2], ['essence', 2, 3], ['crystal', 2, 4], ['ingot', 2, 3], ['fragment', 1, 2], ['hide', 2, 4], ['food', 2, 4], ['iron', 3, 5]];
  for (let i = 0; i < 2 + (tier > 2 ? 1 : 0); i++) { const [it, a, b] = pool[Math.floor(Math.random() * pool.length)]; out.push([it, Math.round(rand(a, b))]); }
  if (Math.random() < 0.3 + tier * 0.06) out.push([['engine_core', 'armor_plate', 'gyro', 'sail_silk', 'cargo_net', 'cannon_barrel'][Math.floor(Math.random() * 6)], 1]);
  void st; return out;
}
const mkMarker = (txt: string, color: string) => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; x.font = '900 52px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8; x.strokeStyle = '#1a1030'; x.strokeText(txt, 32, 34); x.fillStyle = color; x.fillText(txt, 32, 34); return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, fog: false }); };
const matNew = () => mkMarker('!', '#ffd23a'), matReady = () => mkMarker('?', '#7affb0'); let mNew: THREE.SpriteMaterial, mReady: THREE.SpriteMaterial;

const OUTFIT: Record<string, Partial<HumanOpt>> = {
  Elder: { hat: 'wizard', hair: '#e8e8f0' }, Blacksmith: { hat: null, hair: '#2a1a12', belt: '#3a2a22', armor: '#7a5a3a' }, Merchant: { hat: 'cap', hair: '#6a3a1a' }, Farmer: { hat: 'cap', hair: '#c9a45a' },
  Explorer: { hat: 'hood' }, Guard: { hat: 'helm', armor: '#aab4c4', hair: '#3a2a1a' }, Builder: { hat: 'cap', hair: '#7a4a1a' }, Keeper: { hat: 'hood', hair: '#ffffff' },
};
export function makeNpcModel(color: string, role: string, scale = 1) { return buildHuman({ skin: ['#f0c8a0', '#d8a878', '#c48a60', '#f4d4b0'][Math.abs(color.charCodeAt(1) + color.charCodeAt(3)) % 4], outfit: color, pants: '#4a3f5a', hair: '#4a2a1a', cape: role === 'Elder' || role === 'Keeper' ? color : undefined, scale, ...(OUTFIT[role] as any) }); }

let built = false;
export function initEntities() {
  if (built) return; built = true; const scene = G.scene!; mNew = matNew(); mReady = matReady();
  // structures
  for (const s of WORLD.structs) {
    const isl = ISLAND_MAP[s.isl]; const o = buildStruct(s.type, isl.biome, s.s || 1); o.position.set(s.x, s.y - (s.type === 'dock' ? 0.15 : 0), s.z); o.rotation.y = s.rot; scene.add(o);
    if (o.userData.spin) spinners.push(o.userData.spin); if (o.userData.bob) bobbers.push({ o: o.userData.bob, y: o.userData.bob.position.y });
    if (s.type === 'tower') { const sc = s.s; const top = new THREE.Vector3(s.x, s.y + 20 * sc + 0.8, s.z); addI({ id: 'ladder' + s.x, x: s.x, y: s.y, z: s.z + 4.4 * sc, r: 3.2, label: () => G.player.climb ? null : 'Climb the ladder', act: () => { startClimb(top, Math.PI); sfx('click'); } }); }
    if (s.type === 'shipyard') addI({ id: 'shipyard', x: s.x, y: s.y, z: s.z, r: 8, label: () => 'Shipwright Workshop — upgrade & customize airships', act: () => { useStore.getState().openPanel('workshop'); sfx('open'); } });
    if (s.type === 'temple' && s.isl === 'whisper') { const orb = o.userData.orb as THREE.Mesh; addI({ id: 'altar', x: s.x, y: s.y, z: s.z, r: 8, label: () => (useStore.getState().flags.temple ? null : 'Activate the Ancient Altar'), act: () => {
      const st = useStore.getState(); st.set_({ flags: { ...st.flags, temple: true } }); st.emitQ('count:temple'); sfx('arcane'); sfx('roar_golem'); st.setBanner('THE TEMPLE AWAKENS', 'Ancient guardians stir...'); st.addItem('temple_key', 1, true); G.templeActive = true;
      const om = (orb.material as THREE.MeshStandardMaterial).clone(); om.color.set('#ff9aff'); om.emissive.set('#c040ff'); orb.material = om; fx.explosion(V1.set(s.x, s.y + 4.2, s.z), 2, 'arcane'); G.cam.shake = 0.6;
      for (let i = 0; i < 2; i++) { const a = i * 3.14 + 0.8; const x = s.x + Math.cos(a) * 13, z = s.z + Math.sin(a) * 13; const e = spawnEnemy('golem', x, groundAt(x, z, s.y + 20), z, 'whisper'); e.aggro = true; e.state = 'chase'; fx.burst(V1.set(x, s.y + 1, z), 20, '#ffb02e', 6, 0.8, 0.8); }
      spawnLoot(V1.set(s.x, s.y + 3, s.z + 3), 'fragment', 2); } }); }
    if (s.type === 'temple' && s.isl === 'verdant') addI({ id: 'runes', x: s.x, y: s.y, z: s.z, r: 9, label: () => (useStore.getState().flags.runes ? 'Read the runes again' : 'Study the ancient runes'), act: () => { const st = useStore.getState(); st.toast('"Aetheria was one sky, one song. The Heart kept the islands bound... until the Wyrm devoured it."', 'quest'); if (!st.flags.runes) { st.set_({ flags: { ...st.flags, runes: true } }); st.addItem('essence', 2, true); st.gainXp(30); sfx('quest'); } } });
    if (s.type === 'pedestal') { /* sigil handled as node */ }
  }
  // nodes
  for (const n of WORLD.nodes) {
    const isl = ISLAND_MAP[n.isl]; const o = buildNode(n.type === 'sigil' ? 'sigil' : n.type, isl.biome); o.position.set(n.x, n.y, n.z); o.rotation.y = rand(0, 6.28); scene.add(o); const rt: NodeRt = { spec: n, obj: o, hits: 0, depleted: false, respawn: 0, shake: 0 }; nodes.push(rt);
    if (o.userData.bob) bobbers.push({ o: o.userData.bob, y: o.userData.bob.position.y });
    if (n.type === 'chest') { if (useStore.getState().chests.includes(n.id)) { o.userData.lid.rotation.x = -1.8; o.children.forEach(c => { if ((c as any).isSprite) c.visible = false; }); } addI({ id: n.id, x: n.x, y: n.y, z: n.z, r: 3.2, label: () => (useStore.getState().chests.includes(n.id) ? null : 'Open Treasure Chest'), act: () => {
      const st = useStore.getState(); if (st.chests.includes(n.id)) return; st.set_({ chests: [...st.chests, n.id] }); sfx('chest'); o.userData.lid.rotation.x = -1.8; o.children.forEach(c => { if ((c as any).isSprite) c.visible = false; }); st.emitQ('count:chest'); fx.burst(V1.set(n.x, n.y + 1, n.z), 24, '#ffe27a', 6, 0.6, 0.9, -2, 3);
      for (const [it, c] of lootChest(n.isl)) spawnLoot(V1.set(n.x + rand(-1, 1), n.y + 1.2, n.z + rand(-1, 1)), it, c); st.gainXp(20); } }); }
    else if (n.type === 'sigil') addI({ id: 'sigil', x: n.x, y: n.y, z: n.z, r: 3.5, label: () => (useStore.getState().inv.frost_sigil || useStore.getState().flags.sigil ? null : 'Take the Frost Sigil'), act: () => {
      const st = useStore.getState(); st.set_({ flags: { ...st.flags, sigil: true } }); st.addItem('frost_sigil', 1, true); sfx('quest'); o.visible = false; st.setBanner('FROST SIGIL', 'The castle guardians awaken!'); G.cam.shake = 0.5;
      for (let i = 0; i < 2; i++) { const a = i * 3.14 + 1; const x = n.x + Math.cos(a) * 12, z = n.z + Math.sin(a) * 12; const e = spawnEnemy('yeti', x, groundAt(x, z, n.y + 20), z, 'frost'); e.aggro = true; e.state = 'chase'; fx.burst(V1.set(x, n.y + 1, z), 20, '#bfeaff', 6, 0.8, 0.8); } } });
    else { const g = GATHER[n.type]; if (g) addI({ id: n.id, x: n.x, y: n.y, z: n.z, r: 3.4, label: () => (rt.depleted ? null : g.label), act: () => {
      const st = useStore.getState(); if (rt.depleted) return; const have = st.inv[g.item] || 0; void have; const add = st.addItem(g.item, Math.round(rand(g.n[0], g.n[1])));
      G.player.castT = 0.35; G.player.state = 'cast'; G.player.yaw = Math.atan2(n.x - G.player.pos.x, n.z - G.player.pos.z); sfx(g.sfx); rt.shake = 0.3; fx.burst(V1.set(n.x, n.y + 1.2, n.z), 8, n.type === 'wood' ? '#8a6a3a' : n.type === 'crystal' ? '#8fe8ff' : '#b8b0a0', 5, 0.5, 0.5, 8, 2); if (add === 0) return; rt.hits++;
      if (rt.hits >= g.hits) { rt.depleted = true; rt.respawn = G.t + 100; rt.obj.visible = false; st.gainXp(4); if (Math.random() < 0.15 && n.type !== 'fragment') st.addItem(Math.random() < 0.5 ? 'crystal' : 'essence', 1); } } }); }
  }
  // NPCs
  for (const d of NPCS) {
    const isl = ISLAND_MAP[d.island]; const [x, y, z] = placeOn(d.island, d.lx, d.lz); const obj = makeNpcModel(d.color, d.role); obj.position.set(x, y, z); scene.add(obj);
    const marker = new THREE.Sprite(mNew); marker.scale.set(1.6, 1.6, 1); marker.position.y = 3.2; marker.visible = false; obj.add(marker); obj.add(glow(d.color, 3.2, [0, 1, 0], 0.25));
    const toVillage = new THREE.Vector3(isl.x - x, 0, isl.z - z).normalize(); const bed = new THREE.Vector3(x + toVillage.x * 6, y, z + toVillage.z * 6);
    const rt: NpcRt = { def: d, obj, pos: new THREE.Vector3(x, y, z), home: new THREE.Vector3(x, y, z), bed, target: new THREE.Vector3(x, y, z), yaw: rand(0, 6), t: rand(0, 3), walk: 0, panic: 0, marker, hitCd: 0, hidden: false, mode: 'idle' }; npcs.push(rt);
    addI({ id: 'npc_' + d.id, x, y, z, r: 3.6, label: () => `Talk to ${d.name}`, act: () => { const st = useStore.getState(); st.set_({ dialogNpc: d.id }); st.openPanel('dialogue'); sfx('npc'); } });
    (rt as any).iact = G.interactables[G.interactables.length - 1];
  }
  // airship interactable
  addI({ id: 'ship', x: 0, y: 0, z: 0, r: 8, label: () => {
    const st = useStore.getState(); if (G.player.inShip) return null; if (!st.repaired) return 'Repair the Sky Scout (8 wood, 3 iron)'; return `Board ${SHIPS[st.activeShip].name}`; }, act: () => {
    const st = useStore.getState(); if (!st.repaired) { if (!st.spend({ wood: 8, iron: 3 })) { st.toast('Repairs need 8 wood and 3 iron. Gather them first (E on trees/ore).', 'bad'); sfx('error'); return; } st.set_({ repaired: true }); st.ships[st.activeShip].hull = 100; st.emitQ('count:repair'); sfx('build'); fx.burst(V1.copy(G.ship.pos), 30, '#ffe9a0', 8, 0.8, 0.9, -1, 3); st.toast('The airship is repaired and ready to fly!', 'good'); return; } boardShip(); } });
}
const shipI = () => G.interactables.find(i => i.id === 'ship');

const tmpV = new THREE.Vector3(); let sec = 0; let discT = 0;
export function updateEntities(dt: number) {
  const p = G.player; const st = useStore.getState(); const t = G.t; sec += dt;
  const si = shipI(); if (si) { si.x = G.ship.pos.x; si.y = G.ship.pos.y; si.z = G.ship.pos.z; si.r = 6 + 4 * (G.ship.obj?.userData.scale || 1); }
  for (const s of spinners) s.rotation.z += dt * 0.8; for (const b of bobbers) { b.o.position.y = b.y + Math.sin(t * 2 + b.o.id) * 0.25; b.o.rotation.y += dt; }
  // nodes
  for (const n of nodes) { if (n.depleted) { if (G.t > n.respawn) { n.depleted = false; n.hits = 0; n.obj.visible = true; fx.burst(V1.set(n.spec.x, n.spec.y + 1, n.spec.z), 6, '#ffe9a0', 3, 0.4, 0.4); } continue; } if (n.shake > 0) { n.shake -= dt; n.obj.rotation.z = Math.sin(t * 60) * 0.05 * n.shake / 0.3; } else n.obj.rotation.z = 0; }
  // NPCs
  const night = G.dayT > 0.78 || G.dayT < 0.2;
  for (const n of npcs) {
    const d = n.def; const dist = Math.hypot(p.pos.x - n.pos.x, p.pos.z - n.pos.z); const iact = (n as any).iact as Interactable; if (dist > 220) { n.obj.visible = false; continue; } n.obj.visible = !n.hidden; iact.x = n.pos.x; iact.y = n.pos.y; iact.z = n.pos.z;
    n.t -= dt; n.hitCd -= dt; let threat: any = null, td = 18; for (const h of G.hostiles) { if (h.dead || h.kind === 'boss' || !h.active || !h.aggro) continue; const dd = Math.hypot(h.pos.x - n.pos.x, h.pos.z - n.pos.z); if (dd < td && Math.abs(h.pos.y - n.pos.y) < 8 && h.def.dmg > 0) { td = dd; threat = h; } }
    let speed = 0, tx = n.target.x, tz = n.target.z; const guard = d.role === 'Guard';
    if (threat && !night || (threat && guard)) { if (guard) { tx = threat.pos.x; tz = threat.pos.z; speed = td > 3 ? 6.5 : 0; n.mode = 'fight'; if (td < 3.4 && n.hitCd <= 0) { n.hitCd = 1.1; n.panic = 0.0; damageHostile(threat, 9 + st.level * 2, { src: 'ally' }); sfx('swing', 0.4); fx.slash(V1.set(n.pos.x, n.pos.y, n.pos.z), n.yaw, 1.6, '#cfe8ff', 1.8, 0.4, 0.2); (n as any).swing = 0.35; } }
      else { if (n.panic <= 0) { fx.dmg(V1.set(n.pos.x, n.pos.y + 3.2, n.pos.z), '!', '#ffd23a'); } n.panic = 3; n.mode = 'flee'; } }
    if (n.panic > 0 && !guard) { n.panic -= dt; const from = threat; if (from) { tx = n.pos.x - (from.pos.x - n.pos.x); tz = n.pos.z - (from.pos.z - n.pos.z); } else { tx = n.home.x; tz = n.home.z; } const dd = Math.hypot(tx - n.pos.x, tz - n.pos.z); if (Math.hypot(n.home.x - n.pos.x, n.home.z - n.pos.z) > 25) { tx = n.home.x; tz = n.home.z; } speed = 6.5; n.mode = 'flee'; void dd; }
    else if (n.mode !== 'fight' || !threat) {
      if (night && !guard) { tx = n.bed.x; tz = n.bed.z; const dd = Math.hypot(tx - n.pos.x, tz - n.pos.z); if (dd > 1.5) { speed = 2.6; n.mode = 'home'; } else { n.hidden = true; n.mode = 'sleep'; } }
      else { if (n.hidden) { n.hidden = false; } if (dist < 5 && dist > 1.2) { n.yaw = lerpAng(n.yaw, Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z), dt * 5); n.mode = 'talk'; speed = 0; } else {
        if (n.t <= 0) { n.t = rand(3, 7); const rad = d.role === 'Merchant' || d.role === 'Blacksmith' ? 1.6 : d.role === 'Guard' ? 10 : d.role === 'Farmer' ? 9 : 5; const a = rand(0, 6.28), r = rand(0, rad); n.target.set(n.home.x + Math.cos(a) * r, n.home.y, n.home.z + Math.sin(a) * r); n.mode = Math.random() < 0.6 ? 'walk' : 'work'; }
        tx = n.target.x; tz = n.target.z; const dd = Math.hypot(tx - n.pos.x, tz - n.pos.z); if (n.mode === 'walk' && dd > 0.8) speed = 1.8; else if (n.mode === 'walk') n.mode = 'work'; } }
    }
    if (speed > 0) { const dx = tx - n.pos.x, dz = tz - n.pos.z, dd = Math.hypot(dx, dz) || 1; n.yaw = lerpAng(n.yaw, Math.atan2(dx, dz), dt * 8); const nx = n.pos.x + (dx / dd) * speed * dt, nz = n.pos.z + (dz / dd) * speed * dt; collide(nx, nz, 0.5, C); const g = groundAt(C.x, C.z, n.pos.y + 1.5); if (g > -1e8) { n.pos.set(C.x, g, C.z); } n.walk += dt * speed * 3.2; }
    n.obj.position.copy(n.pos); n.obj.rotation.y = n.yaw;
    const P = n.obj.userData.parts; const sw = speed > 0 ? Math.sin(n.walk) * 0.7 : 0; const s2 = (o: THREE.Object3D, x: number) => { o.rotation.x += (x - o.rotation.x) * Math.min(1, dt * 12); };
    s2(P.legL, sw); s2(P.legR, -sw); let aL = -sw, aR = sw; if (n.mode === 'flee') { aL = -2.6; aR = -2.6; } if (n.mode === 'work' || n.mode === 'idle') { if (d.role === 'Blacksmith') aR = -1.2 + Math.sin(t * 7) * 0.9; else if (d.role === 'Farmer') aR = -0.6 + Math.sin(t * 3) * 0.4; else if (d.role === 'Merchant') aL = -0.5 + Math.sin(t * 2) * 0.2; else if (d.role === 'Builder') aR = -1 + Math.sin(t * 5) * 0.5; } if ((n as any).swing > 0) { (n as any).swing -= dt; aR = -2.4 + (1 - (n as any).swing / 0.35) * 3; } if (n.mode === 'talk') { aR = -0.8 + Math.sin(t * 3) * 0.2; }
    s2(P.armL, aL); s2(P.armR, aR);
    if (sec > 0.5) { let state = 0; for (const q of QUESTS) { if (q.giver !== d.id) continue; const qs = st.quests[q.id]; if (qs?.state === 'ready') state = 2; else if (!qs && st.questAvailable(q) && state < 1) state = 1; } n.marker.visible = state > 0 && !n.hidden; n.marker.material = state === 2 ? mReady : mNew; }
    n.marker.position.y = 3.2 + Math.sin(t * 3) * 0.12;
  }
  if (sec > 0.5) sec = 0;
  // interactable detection
  let best: Interactable | null = null, bd = 1e9; const origin = p.inShip ? G.ship.pos : p.pos;
  if (!p.inShip && !p.dead && !G.cam.cine) for (const i of G.interactables) { const d = Math.hypot(i.x - origin.x, i.z - origin.z); if (d > i.r + 0.4 || Math.abs(i.y - origin.y) > 7 + (i.id === 'ship' ? 10 : 0)) continue; if (d < bd && i.label()) { bd = d; best = i; } }
  G.interact = best;
  if (best && input.hit('KeyE') && !G.paused) best.act();
  // discovery
  discT += dt; if (discT > 0.3) { discT = 0; const pos = origin; const isl = islandAt(pos.x, pos.z);
    if (isl && Math.abs(pos.y - isl.y) < 90 && isl.id !== G.currentIsland) { G.currentIsland = isl.id; if (!st.discovered.includes(isl.id)) { st.discover(isl.id); st.toast(`New island discovered: ${isl.name}`, 'quest'); } st.emitQ('reach:' + isl.id); if (G.t - G.lastIsland.length > -1) st.setBanner(isl.name.toUpperCase(), isl.blurb); sfx('quest', 0.5); G.lastIsland = isl.id; }
    for (const poi of WORLD.pois) { if (st.reached.includes(poi.id)) continue; if (Math.hypot(pos.x - poi.x, pos.z - poi.z) < poi.r && Math.abs(pos.y - poi.y) < 40) { st.set_({ reached: [...st.reached, poi.id] }); st.emitQ('reach:' + poi.id); st.toast(`Discovered: ${poi.name}`, 'quest'); st.gainXp(15); sfx('quest', 0.6); } } }
  // storm barriers
  G.msgT = Math.max(0, G.msgT - dt);
  for (const isl of ISLANDS) { if (st.level >= isl.minLevel) continue; const o = origin; const dx = o.x - isl.x, dz = o.z - isl.z; const d = Math.hypot(dx, dz); const lim = isl.r * 1.22 + 30; if (d < lim && Math.abs(o.y - isl.y) < 260) { const k = (lim - d) / 30 + 1; const push = 55 * k * dt; if (p.inShip) { G.ship.pos.x += (dx / d) * push; G.ship.pos.z += (dz / d) * push; G.ship.vel.x += (dx / d) * 30 * dt; G.ship.vel.z += (dz / d) * 30 * dt; G.ship.speed *= 0.97; } else { p.pos.x += (dx / d) * push * 0.3; p.pos.z += (dz / d) * push * 0.3; } if (G.msgT <= 0) { G.msgT = 4; st.toast(`A violent storm barrier blocks the way to ${isl.name}. Reach level ${isl.minLevel}.`, 'bad'); sfx('lightning', 0.4); } if (Math.random() < 0.05) fx.bolt(V1.set(isl.x + (dx / d) * lim, o.y + 40, isl.z + (dz / d) * lim).clone(), tmpV.set(isl.x + (dx / d) * lim, o.y - 10, isl.z + (dz / d) * lim), '#c8b0ff', 0.6); } }
  void angDiff; void clamp; void ITEMS;
}
export function npcByUid(id: string) { return npcs.find(n => n.def.id === id); }
export function resetNodes() { for (const n of nodes) { n.depleted = false; n.hits = 0; n.obj.visible = true; if (n.spec.type === 'chest') { const o = n.obj; const open = useStore.getState().chests.includes(n.spec.id); o.userData.lid.rotation.x = open ? -1.8 : 0; o.children.forEach(c => { if ((c as any).isSprite) c.visible = !open; }); } if (n.spec.type === 'sigil') n.obj.visible = !(useStore.getState().flags.sigil); } }
